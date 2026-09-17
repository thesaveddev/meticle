import { migrateQuery } from '../../shared/database';
import { EmailService } from '../../shared/utils/email.service';
import logger from '../../shared/utils/logger';

const DIGEST_EMAILS_ENABLED = process.env.HOMECARE_DIGEST_EMAILS_ENABLED !== 'false';
export const DEFAULT_DIGEST_TIMEZONE = 'Europe/London';
const DIGEST_WINDOW_GRACE_MINUTES = 10;
export type DigestType = 'morning' | 'midday' | 'evening';

type ZonedParts = { year: string; month: string; day: string; hour: string; minute: string };

export function getLocalParts(now: Date, timezone = DEFAULT_DIGEST_TIMEZONE): ZonedParts {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(now);
    const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
    return { year: values.year, month: values.month, day: values.day, hour: values.hour, minute: values.minute };
  } catch {
    return getLocalParts(now, DEFAULT_DIGEST_TIMEZONE);
  }
}

export function localDateKey(now: Date, timezone = DEFAULT_DIGEST_TIMEZONE): string {
  const local = getLocalParts(now, timezone);
  return `${local.year}-${local.month}-${local.day}`;
}

/**
 * A digest is due only during its configured send window. We deliberately do
 * not use `current >= configuredTime`: that would send missed afternoon and
 * evening digests together when the API restarts in the morning.
 */
export function isDigestDue(now: Date, time: string, timezone = DEFAULT_DIGEST_TIMEZONE): boolean {
  const local = getLocalParts(now, timezone);
  const configured = String(time || '').slice(0, 5);
  const match = /^(\d{2}):(\d{2})$/.exec(configured);
  if (!match) return false;
  const currentMinutes = Number(local.hour) * 60 + Number(local.minute);
  const configuredMinutes = Number(match[1]) * 60 + Number(match[2]);
  const elapsed = currentMinutes - configuredMinutes;
  return elapsed >= 0 && elapsed < DIGEST_WINDOW_GRACE_MINUTES;
}

/**
 * Sends operational summaries rather than one email per visit. Push/in-app
 * alerts remain independent and continue to handle urgent exceptions.
 * Digest times and dates are interpreted in each user's timezone; new users
 * default to Europe/London.
 */
export async function runHomecareDigestEmails(now = new Date()): Promise<{ sent: number; failed: number }> {
  if (!DIGEST_EMAILS_ENABLED) return { sent: 0, failed: 0 };

  const recipients = await migrateQuery(`
    SELECT u.id, u.organization_id, u.email, u.role,
           COALESCE(sp.first_name || ' ' || sp.last_name, u.email) AS name,
           COALESCE(dp.morning_enabled, TRUE) AS morning_enabled,
           COALESCE(dp.midday_enabled, TRUE) AS midday_enabled,
           COALESCE(dp.evening_enabled, TRUE) AS evening_enabled,
           COALESCE(dp.morning_time, '08:00'::time) AS morning_time,
           COALESCE(dp.midday_time, '13:00'::time) AS midday_time,
           COALESCE(dp.evening_time, '19:00'::time) AS evening_time,
           COALESCE(dp.timezone, 'Europe/London') AS timezone
    FROM users u
    LEFT JOIN staff_profiles sp ON sp.user_id = u.id
    LEFT JOIN homecare_digest_preferences dp ON dp.user_id = u.id
    WHERE u.status = 'active'
      AND u.email IS NOT NULL
      AND u.role IN ('ORG_ADMIN', 'MANAGER', 'CARE_WORKER')
  `);

  let sent = 0;
  let failed = 0;

  for (const recipient of recipients.rows) {
    const timezone = recipient.timezone || DEFAULT_DIGEST_TIMEZONE;
    const windows: Array<{ type: DigestType; enabled: boolean; time: string }> = [
      { type: 'morning', enabled: recipient.morning_enabled, time: recipient.morning_time },
      { type: 'midday', enabled: recipient.midday_enabled, time: recipient.midday_time },
      { type: 'evening', enabled: recipient.evening_enabled, time: recipient.evening_time },
    ];

    for (const window of windows) {
      if (!window.enabled || !isDigestDue(now, window.time, timezone)) continue;

      const date = localDateKey(now, timezone);
      const delivery = await migrateQuery(`
        INSERT INTO homecare_digest_deliveries (user_id, organization_id, digest_date, digest_type, status, attempt_count)
        VALUES ($1, $2, $3, $4, 'pending', 0)
        ON CONFLICT (user_id, digest_date, digest_type) DO UPDATE
          SET status = 'pending', updated_at = NOW()
          WHERE homecare_digest_deliveries.status = 'failed'
            AND homecare_digest_deliveries.attempt_count < 3
        RETURNING id
      `, [recipient.id, recipient.organization_id, date, window.type]);
      if (!delivery.rows[0]) continue;

      try {
        const summary = await buildDigestSummary(recipient, window.type, now, date, timezone);
        await EmailService.sendHomecareDigestEmail(recipient.email, recipient.name, window.type, date, summary);
        await migrateQuery(`
          UPDATE homecare_digest_deliveries
          SET status = 'sent', attempt_count = attempt_count + 1, sent_at = NOW(), updated_at = NOW()
          WHERE id = $1
        `, [delivery.rows[0].id]);
        sent++;
      } catch (error: any) {
        await migrateQuery(`
          UPDATE homecare_digest_deliveries
          SET status = 'failed', attempt_count = attempt_count + 1, last_error = $2, updated_at = NOW()
          WHERE id = $1
        `, [delivery.rows[0].id, String(error?.message || 'Digest email failed').slice(0, 1000)]);
        failed++;
        logger.warn({ userId: recipient.id, digestType: window.type, error: error?.message }, 'Homecare digest email failed');
      }
    }
  }

  return { sent, failed };
}

async function buildDigestSummary(recipient: any, type: DigestType, now: Date, date: string, timezone: string) {
  const isManager = recipient.role === 'ORG_ADMIN' || recipient.role === 'MANAGER';
  const filter = isManager
    ? `v.organization_id = $1`
    : `v.organization_id = $1 AND v.assigned_staff_id = (SELECT id FROM staff_profiles WHERE user_id = $2)`;
  const params = isManager
    ? [recipient.organization_id, date, timezone]
    : [recipient.organization_id, recipient.id, date, timezone];
  const dateParam = isManager ? 2 : 3;
  const timezoneParam = isManager ? 3 : 4;
  const visits = await migrateQuery(`
    SELECT v.label, v.visit_type, v.status, v.scheduled_start, v.scheduled_end,
           v.late_reason, v.assigned_staff_id,
           COALESCE(pe.first_name || ' ' || pe.last_name, 'Client') AS person_name,
           COALESCE(sp.first_name || ' ' || sp.last_name, 'Unassigned') AS carer_name
    FROM homecare_visits v
    JOIN people pe ON pe.id = v.person_id
    LEFT JOIN staff_profiles sp ON sp.id = v.assigned_staff_id
    WHERE ${filter}
      AND v.scheduled_start >= ($${dateParam}::date AT TIME ZONE $${timezoneParam})
      AND v.scheduled_start < (($${dateParam}::date + INTERVAL '1 day') AT TIME ZONE $${timezoneParam})
    ORDER BY v.scheduled_start
  `, params);

  const rows = visits.rows;
  const completed = rows.filter((v: any) => v.status === 'completed').length;
  const missed = rows.filter((v: any) => v.status === 'missed').length;
  const covered = rows.filter((v: any) => v.assigned_staff_id && v.status !== 'missed' && v.status !== 'cancelled').length;
  const overdue = rows.filter((v: any) => ['scheduled', 'en_route'].includes(v.status) && new Date(v.scheduled_end) < now).length;
  const late = rows.filter((v: any) => Boolean(v.late_reason)).length;
  const completionRate = rows.length ? Math.round((completed / rows.length) * 100) : 0;

  const incidents = await migrateQuery(`
    SELECT i.title, i.severity, i.status
    FROM incidents i
    WHERE i.organization_id = $1 AND i.incident_date = $2::date
    ORDER BY i.created_at DESC LIMIT 20
  `, [recipient.organization_id, date]);

  return {
    type,
    date,
    timezone,
    total: rows.length,
    completed,
    missed,
    covered,
    overdue,
    late,
    completionRate,
    visits: rows.slice(0, 80),
    incidents: incidents.rows,
    managerView: isManager,
  };
}
