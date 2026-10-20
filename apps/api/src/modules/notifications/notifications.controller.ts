import { Request, Response } from 'express';
import pool from '../../shared/database';
import { safeIo } from '../../shared/socket';
import { AppError } from '../../shared/middleware/error.middleware';

/**
 * The ordering key of a notification page, as the client can actually see it.
 *
 * `created_at` is a timestamptz and holds microseconds. The row that reaches a
 * client has been through a JS `Date`, which holds milliseconds, so the
 * `created_at` a client echoes back as its cursor is the stored value *truncated*.
 * Comparing the stored value against that truncated cursor excluded every row in
 * the microsecond gap behind it: 25 notifications written in one burst paged back
 * as 24, missing one from the middle of the burst, because the row before it sat
 * at .123456 and its cursor said .123.
 *
 * Truncating both sides makes the predicate agree with the order the client is
 * holding, so the tie-break is `id` on both sides rather than microseconds only
 * one of them can see. That is what the keyset contract already claimed.
 */
const KEYSET_AT = "date_trunc('milliseconds', created_at)";
/** The same truncation applied to the cursor, so both sides compare at one precision. */
const KEYSET_CURSOR_AT = "date_trunc('milliseconds', $2::timestamptz)";

export class NotificationsController {
  /** The default page: what one screen holds without scrolling for a while. */
  private static readonly PAGE_SIZE = 20;
  private static readonly MAX_PAGE_SIZE = 100;

  /**
   * The caller's own notifications, newest first, in pages.
   *
   * This used to be `LIMIT 20` and nothing else, which quietly decided that the
   * thirty-first notification of a week away did not exist: a carer returning from
   * leave saw twenty rows and no way to reach the twenty-first, and the handover nudge
   * or missed round that actually mattered was the one that had fallen off.
   *
   * Paging is keyset on `(created_at, id)`, not `OFFSET`. Notifications are written
   * while the list is being read — a room-check sweep or a handover nudge lands between
   * page one and page two — and an offset page shifts under the reader by one row for
   * every arrival, silently skipping the row that got pushed across the boundary. A
   * keyset page always continues from the row it was handed.
   *
   * The key is millisecond-truncated `created_at` (see `KEYSET_AT`), because that is
   * the precision the cursor carries: ordering by the microsecond column while
   * comparing against a millisecond cursor skips rows created in the same millisecond.
   *
   * The body stays the bare array it has always been, so nothing that already calls
   * this has to change: a caller that wants older rows passes the last row it holds as
   * `before` (its `created_at`) and `beforeId` (its `id`). Two plain values rather than
   * an opaque cursor token, because they are already on the row the client is looking
   * at and an operator reading a query string can see exactly what it means.
   *
   * A malformed cursor is a 400 rather than a silent fall back to page one: quietly
   * returning the newest rows to a client asking for older ones makes "load more"
   * appear to do nothing, forever, which is harder to diagnose than a rejected request.
   */
  static async getMyNotifications(req: Request, res: Response) {
    const userId = req.user!.userId;

    const rawLimit = Number.parseInt(String(req.query.limit ?? ''), 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, NotificationsController.MAX_PAGE_SIZE)
      : NotificationsController.PAGE_SIZE;

    const before = typeof req.query.before === 'string' && req.query.before.trim() ? req.query.before.trim() : null;
    const beforeId = typeof req.query.beforeId === 'string' && req.query.beforeId.trim() ? req.query.beforeId.trim() : null;

    if ((before && !beforeId) || (beforeId && !before)) {
      throw new AppError(400, 'A page cursor needs both `before` and `beforeId`.');
    }
    if (before && beforeId) {
      const when = new Date(before);
      if (Number.isNaN(when.getTime())) throw new AppError(400, '`before` must be a timestamp.');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(beforeId)) {
        throw new AppError(400, '`beforeId` must be a notification id.');
      }
    }

    const params: unknown[] = [userId];
    let where = 'user_id = $1';
    if (before && beforeId) {
      params.push(before, beforeId);
      where += ` AND (${KEYSET_AT}, id) < (${KEYSET_CURSOR_AT}, $3::uuid)`;
    }
    params.push(limit);

    const result = await pool.query(
      `SELECT * FROM notifications WHERE ${where} ORDER BY ${KEYSET_AT} DESC, id DESC LIMIT $${params.length}`,
      params
    );
    res.json(result.rows);
  }

  static async getUnreadCount(req: Request, res: Response) {
    const userId = req.user!.userId;
    const result = await pool.query(
      'SELECT COUNT(*)::int as count FROM notifications WHERE user_id = $1 AND read = FALSE',
      [userId]
    );
    res.json({ count: result.rows[0].count });
  }

  static async markAsRead(req: Request, res: Response) {
    const { id } = req.params;
    const userId = req.user!.userId;
    await pool.query(
      'UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    res.json({ message: 'Marked as read' });
  }

  static async markAllAsRead(req: Request, res: Response) {
    const userId = req.user!.userId;
    await pool.query(
      'UPDATE notifications SET read = TRUE WHERE user_id = $1',
      [userId]
    );
    res.json({ message: 'All marked as read' });
  }

  /**
   * Raises a notification for a user, their active delegates, and nobody else.
   *
   * `link` is the record path this notification is about, where it is about one
   * (`micaRecordPath` in `@meticle/shared`). It is stored on the row and travels to
   * the client with it, so the bell is not a dead end: the carer who reads "New
   * Task Assigned" taps it and lands on that task, exactly as they would from
   * Mica's own offer or from the email about the same record. Callers that have no
   * record to point at simply omit it — a notification with no link opens nothing,
   * which is honest, where a guessed link is not.
   *
   * The path is relative and the client pushes it, so the row keeps working on
   * whatever origin the app is served from and nothing parses a host out of a stored
   * string. Email is the one channel that needs an absolute address; it composes it
   * from the same path at send time (`micaRecordUrl`).
   *
   * `type` is also the preference key, so a user who has switched that type off is
   * skipped — which is right for the everyday messages a preference exists for, and
   * wrong for a statutory obligation the provider cannot opt out of. Those callers
   * pass `ignorePreferences`, and there is one: DBS certificate information held past
   * its six-month retention date, which a rule says must already have been deleted.
   * Muting a category is a preference; being told you are still holding something you
   * must not hold is not.
   */
  static async createNotification(
    userId: string,
    title: string,
    message: string,
    type: string = 'info',
    link?: string,
    options: { ignorePreferences?: boolean } = {},
  ) {
    const notifyUserIds = new Set<string>([userId]);
    try {
      const delegateRes = await pool.query(
        `SELECT delegate_manager_id FROM manager_delegations
         WHERE primary_manager_id = $1 AND is_active = true
           AND (ends_at IS NULL OR ends_at > CURRENT_TIMESTAMP)`,
        [userId]
      );
      for (const row of delegateRes.rows) notifyUserIds.add(row.delegate_manager_id);
    } catch { /* delegation lookup non-critical */ }

    for (const uid of notifyUserIds) {
      try {
        if (!options.ignorePreferences && type && type !== 'info') {
          const prefRes = await pool.query(
            'SELECT enabled FROM notification_preferences WHERE user_id = $1 AND notification_type = $2',
            [uid, type]
          );
          if (prefRes.rows.length > 0 && !prefRes.rows[0].enabled) continue;
        }

        const result = await pool.query(
          'INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1, $2, $3, $4, $5) RETURNING *',
          [uid, title, message, type, link ?? null]
        );
        const io = safeIo();
        io.to(`user:${uid}`).emit('notification', result.rows[0]);
        const countRes = await pool.query(
          "SELECT COUNT(*)::int as count FROM notifications WHERE user_id = $1 AND read = FALSE",
          [uid]
        );
        io.to(`user:${uid}`).emit('unread_count', { count: countRes.rows[0].count });
      } catch { /* notification per user non-critical */ }
    }
  }

  static async getPreferences(req: Request, res: Response) {
    const userId = req.user!.userId;
    const types = ['compliance', 'training', 'documents', 'leave', 'shift', 'swap', 'overtime', 'survey', 'delegation', 'general'];
    const existing = await pool.query('SELECT notification_type, enabled FROM notification_preferences WHERE user_id = $1', [userId]);
    const map: Record<string, boolean> = {};
    existing.rows.forEach((r: any) => { map[r.notification_type] = r.enabled });
    const prefs = types.map(t => ({ notification_type: t, enabled: map[t] !== false }));
    res.json(prefs);
  }

  static async updatePreference(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { notification_type, enabled } = req.body;
    await pool.query(
      `INSERT INTO notification_preferences (user_id, notification_type, enabled) VALUES ($1,$2,$3)
       ON CONFLICT (user_id, notification_type) DO UPDATE SET enabled = EXCLUDED.enabled`,
      [userId, notification_type, enabled]
    );
    res.json({ notification_type, enabled });
  }

  static async getHomecareDigestPreferences(req: Request, res: Response) {
    const userId = req.user!.userId;
    const result = await pool.query(
      `SELECT morning_enabled, midday_enabled, evening_enabled,
              TO_CHAR(morning_time, 'HH24:MI') AS morning_time,
              TO_CHAR(midday_time, 'HH24:MI') AS midday_time,
              TO_CHAR(evening_time, 'HH24:MI') AS evening_time,
              weekly_enabled,
              TO_CHAR(weekly_time, 'HH24:MI') AS weekly_time,
              COALESCE(timezone, 'Europe/London') AS timezone
       FROM homecare_digest_preferences WHERE user_id = $1`,
      [userId]
    );
    // No row yet. The three daily windows default on because that is what the
    // table has always done; the weekly report defaults off, matching
    // migration 132. A user who never opens settings must not acquire a
    // Monday-morning report here.
    res.json(result.rows[0] || {
      morning_enabled: true, midday_enabled: true, evening_enabled: true,
      morning_time: '08:00', midday_time: '13:00', evening_time: '19:00',
      weekly_enabled: false, weekly_time: '07:30',
      timezone: 'Europe/London',
    });
  }

  static async updateHomecareDigestPreferences(req: Request, res: Response) {
    const userId = req.user!.userId;
    const body = req.body || {};
    const timeFields = ['morning_time', 'midday_time', 'evening_time', 'weekly_time'];
    for (const field of timeFields) {
      // The double backslash that used to live in this pattern made it match a
      // literal backslash instead of a digit, so it rejected every real HH:MM
      // time and accepted the malformed ones. That meant no digest send time
      // had ever been saveable through this endpoint, and the weekly field
      // would have inherited it. Single-escaped on purpose.
      if (body[field] !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(body[field]))) {
        throw new AppError(400, `${field} must use HH:MM format`);
      }
    }
    const timezone = body.timezone === undefined ? undefined : String(body.timezone);
    if (timezone) {
      try { new Intl.DateTimeFormat('en-GB', { timeZone: timezone }).format(); }
      catch { throw new AppError(400, 'timezone must be a valid IANA timezone'); }
    }
    const existing = await pool.query('SELECT * FROM homecare_digest_preferences WHERE user_id = $1', [userId]);
    const current = existing.rows[0] || { morning_enabled: true, midday_enabled: true, evening_enabled: true, morning_time: '08:00', midday_time: '13:00', evening_time: '19:00', weekly_enabled: false, weekly_time: '07:30', timezone: 'Europe/London' };
    const values = {
      morning_enabled: body.morning_enabled === undefined ? current.morning_enabled : Boolean(body.morning_enabled),
      midday_enabled: body.midday_enabled === undefined ? current.midday_enabled : Boolean(body.midday_enabled),
      evening_enabled: body.evening_enabled === undefined ? current.evening_enabled : Boolean(body.evening_enabled),
      morning_time: body.morning_time || current.morning_time,
      midday_time: body.midday_time || current.midday_time,
      evening_time: body.evening_time || current.evening_time,
      // Opt-in: absent from the body means "leave it as it is", and a user with
      // no row at all gets it off.
      weekly_enabled: body.weekly_enabled === undefined ? Boolean(current.weekly_enabled) : Boolean(body.weekly_enabled),
      weekly_time: body.weekly_time || current.weekly_time || '07:30',
      timezone: timezone || current.timezone || 'Europe/London',
    };
    const result = await pool.query(
      `INSERT INTO homecare_digest_preferences (user_id, morning_enabled, midday_enabled, evening_enabled, morning_time, midday_time, evening_time, weekly_enabled, weekly_time, timezone, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (user_id) DO UPDATE SET morning_enabled = EXCLUDED.morning_enabled, midday_enabled = EXCLUDED.midday_enabled, evening_enabled = EXCLUDED.evening_enabled, morning_time = EXCLUDED.morning_time, midday_time = EXCLUDED.midday_time, evening_time = EXCLUDED.evening_time, weekly_enabled = EXCLUDED.weekly_enabled, weekly_time = EXCLUDED.weekly_time, timezone = EXCLUDED.timezone, updated_at = NOW()
       RETURNING morning_enabled, midday_enabled, evening_enabled, TO_CHAR(morning_time, 'HH24:MI') AS morning_time, TO_CHAR(midday_time, 'HH24:MI') AS midday_time, TO_CHAR(evening_time, 'HH24:MI') AS evening_time, weekly_enabled, TO_CHAR(weekly_time, 'HH24:MI') AS weekly_time, timezone`,
      [userId, values.morning_enabled, values.midday_enabled, values.evening_enabled, values.morning_time, values.midday_time, values.evening_time, values.weekly_enabled, values.weekly_time, values.timezone]
    );
    res.json(result.rows[0]);
  }

  static async registerPushToken(req: Request, res: Response) {
    const userId = req.user!.userId;
    const orgId = req.user!.organizationId;
    const { push_token, platform } = req.body;

    if (!push_token || typeof push_token !== 'string') throw new AppError(400, 'push_token is required');
    if (!platform || !['ios', 'android', 'web'].includes(platform)) throw new AppError(400, 'platform must be ios, android, or web');

    await pool.query(
      `INSERT INTO device_push_tokens (organization_id, user_id, push_token, platform, is_active, updated_at)
       VALUES ($1, $2, $3, $4, true, NOW())
       ON CONFLICT (user_id, push_token) DO UPDATE SET is_active = true, updated_at = NOW()`,
      [orgId, userId, push_token, platform]
    );

    res.json({ registered: true });
  }
}
