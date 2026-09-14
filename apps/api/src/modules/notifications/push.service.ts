import webpush, { PushSubscription } from 'web-push';
import { migrateQuery, query } from '../../shared/database';
import logger from '../../shared/utils/logger';

let configured = false;

function configure(): boolean {
  if (configured) return true;
  const subject = process.env.WEB_PUSH_SUBJECT;
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) return false;
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
    return true;
  } catch (error: any) {
    logger.error({ error: error?.message }, 'Web push VAPID configuration is invalid');
    return false;
  }
}

export function getWebPushPublicKey(): string | null {
  return process.env.WEB_PUSH_VAPID_PUBLIC_KEY || null;
}

export function isWebPushConfigured(): boolean {
  return configure();
}

export async function upsertPushSubscription(params: {
  organizationId: string;
  userId: string;
  subscription: PushSubscription;
  userAgent?: string;
}) {
  const { endpoint, keys } = params.subscription;
  if (!endpoint || !keys?.p256dh || !keys.auth) throw new Error('Invalid push subscription');
  const result = await query(
    `INSERT INTO push_subscriptions
       (organization_id, user_id, endpoint, p256dh, auth, user_agent, last_used_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     ON CONFLICT (endpoint) DO UPDATE SET
       organization_id = EXCLUDED.organization_id,
       user_id = EXCLUDED.user_id,
       p256dh = EXCLUDED.p256dh,
       auth = EXCLUDED.auth,
       user_agent = EXCLUDED.user_agent,
       last_used_at = NOW(),
       updated_at = NOW()
     RETURNING id, endpoint`,
    [params.organizationId, params.userId, endpoint, keys.p256dh, keys.auth, params.userAgent || null],
  );
  return result.rows[0];
}

export async function removePushSubscription(userId: string, endpoint: string): Promise<void> {
  await query('DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2', [userId, endpoint]);
}

export async function sendPushToUser(userId: string, payload: Record<string, unknown>, notificationType = 'homecare'): Promise<{ sent: number; failed: number; skipped: number }> {
  if (!configure()) return { sent: 0, failed: 0, skipped: 1 };

  const preference = await migrateQuery(
    'SELECT enabled FROM notification_preferences WHERE user_id = $1 AND notification_type = $2',
    [userId, notificationType],
  );
  if (preference.rows.length > 0 && preference.rows[0].enabled === false) {
    return { sent: 0, failed: 0, skipped: 1 };
  }
  // This worker runs outside a request and therefore has no RLS session
  // variables. Use the migration/superuser pool for the cross-request lookup;
  // the user id is still a mandatory scope in the query.
  const subscriptions = await migrateQuery(
    'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
    [userId],
  );
  if (subscriptions.rows.length === 0) return { sent: 0, failed: 0, skipped: 1 };
  let sent = 0;
  let failed = 0;
  for (const subscription of subscriptions.rows) {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify(payload),
        { TTL: 300 },
      );
      await migrateQuery('UPDATE push_subscriptions SET last_used_at = NOW(), updated_at = NOW() WHERE id = $1', [subscription.id]);
      sent++;
    } catch (error: any) {
      failed++;
      const statusCode = Number(error?.statusCode);
      if (statusCode === 404 || statusCode === 410) {
        await migrateQuery('DELETE FROM push_subscriptions WHERE id = $1', [subscription.id]);
      }
      logger.warn({ userId, subscriptionId: subscription.id, statusCode, error: error?.message }, 'Web push delivery failed');
    }
  }
  return { sent, failed, skipped: 0 };
}

/**
 * Send push notification to a user via Expo push (mobile) and web push.
 * This is the unified function that should be used for all notifications.
 */
export async function sendPushNotification(userId: string, payload: { title: string; body: string; data?: Record<string, unknown>; url?: string }, notificationType = 'homecare'): Promise<void> {
  // Send web push (VAPID)
  await sendPushToUser(userId, { ...payload, type: notificationType, url: payload.url || '/' }, notificationType).catch(() => {});

  // Send Expo push to mobile devices
  try {
    const tokens = await migrateQuery(
      'SELECT push_token, platform FROM device_push_tokens WHERE user_id = $1 AND is_active = true',
      [userId]
    );

    if (tokens.rows.length === 0) return;

    const messages = tokens.rows.map((t: any) => ({
      to: t.push_token,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: { ...payload.data, url: payload.url },
      channelId: 'default',
    }));

    // Expo push API accepts batches of up to 100
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.warn({ userId, status: response.status, body: errText }, 'Expo push delivery failed');
    } else {
      const result = await response.json();
      // Check for individual errors (e.g., invalid tokens)
      if (result.data) {
        for (const ticket of result.data) {
          if (ticket.status === 'error' && (ticket.message?.includes('DeviceNotRegistered') || ticket.message?.includes('InvalidCredentials'))) {
            // Deactivate invalid token
            await migrateQuery(
              'UPDATE device_push_tokens SET is_active = false WHERE push_token = $1',
              [ticket.message?.includes('DeviceNotRegistered') ? '' : ticket.push_token]
            ).catch(() => {});
          }
        }
      }
    }
  } catch (error: any) {
    logger.warn({ userId, error: error?.message }, 'Expo push failed');
  }
}
