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
 * A visit is only called late once it is meaningfully past its start.
 *
 * Without a grace period every carer who clocks in ninety seconds after the
 * scheduled minute is reported late, the figure stops meaning anything, and
 * managers learn to ignore it. Five minutes is short enough to still catch a
 * real delay and long enough to absorb phone clocks and signal.
 */
export const LATE_GRACE_MINUTES = 5;

export type DigestVisit = {
  label: string;
  visit_type: string;
  status: string;
  scheduled_start: string;
  scheduled_end: string;
  check_in_at: string | null;
  check_out_at: string | null;
  late_reason: string | null;
  assigned_staff_id: string | null;
  person_name: string;
  carer_name: string;
};

export type DigestTotals = {
  scheduled: number;
  dueSoFar: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  late: number;
  missed: number;
  cancelled: number;
  unassigned: number;
  overdue: number;
  completedWithoutCheckIn: number;
  completionRate: number;
};

const CLOSED_STATUSES = ['completed', 'missed', 'cancelled'];

/** Minutes after the scheduled start that this visit actually began, or null if it has not begun. */
export function minutesLate(visit: DigestVisit): number | null {
  if (!visit.check_in_at) return null;
  const delta = (new Date(visit.check_in_at).getTime() - new Date(visit.scheduled_start).getTime()) / 60000;
  return Math.round(delta);
}

/**
 * Late means started materially after its scheduled time, or a human said so.
 *
 * This used to be `Boolean(late_reason)` alone, which was wrong in the
 * direction that matters: `late_reason` is only ever set by someone typing it
 * in (`homecare.repository.ts`), so a call that started forty minutes late and
 * nobody got round to entering a reason was reported as on time. The reason
 * text is still surfaced, but it no longer decides the number.
 */
export function isLate(visit: DigestVisit): boolean {
  const minutes = minutesLate(visit);
  if (minutes !== null && minutes > LATE_GRACE_MINUTES) return true;
  return Boolean(visit.late_reason && visit.late_reason.trim());
}

/** Past its end time and not yet closed out. */
export function isOverdue(visit: DigestVisit, now: Date): boolean {
  if (CLOSED_STATUSES.includes(visit.status)) return false;
  return new Date(visit.scheduled_end).getTime() < now.getTime();
}

/** Observed time on site, when both ends were recorded. */
export function durationMinutes(visit: DigestVisit): number | null {
  if (!visit.check_in_at || !visit.check_out_at) return null;
  return Math.max(0, Math.round((new Date(visit.check_out_at).getTime() - new Date(visit.check_in_at).getTime()) / 60000));
}

/**
 * Counts for one digest.
 *
 * `dueSoFar` exists because a midday digest that divides completed calls by
 * every call booked for the day is not measuring anything — half the
 * denominator has not happened yet. The rate is therefore taken against calls
 * that were actually due by now, and the email states that denominator so the
 * number can be read honestly.
 */
export function summariseVisits(visits: DigestVisit[], now: Date): DigestTotals {
  const nowMs = now.getTime();
  const scheduled = visits.length;
  const completed = visits.filter((v) => v.status === 'completed').length;
  const missed = visits.filter((v) => v.status === 'missed').length;
  const cancelled = visits.filter((v) => v.status === 'cancelled').length;
  const inProgress = visits.filter((v) => ['en_route', 'checked_in'].includes(v.status)).length;
  const notStarted = visits.filter((v) => v.status === 'scheduled').length;
  const dueSoFar = visits.filter((v) => new Date(v.scheduled_start).getTime() <= nowMs).length;
  const late = visits.filter(isLate).length;
  const overdue = visits.filter((v) => isOverdue(v, now)).length;
  const unassigned = visits.filter((v) => !v.assigned_staff_id && !CLOSED_STATUSES.includes(v.status)).length;
  // Completed without a recorded arrival: usually a back-filled entry. Worth
  // surfacing, because it is the one case where the visit log and the timesheet
  // can quietly disagree.
  const completedWithoutCheckIn = visits.filter((v) => v.status === 'completed' && !v.check_in_at).length;

  return {
    scheduled,
    dueSoFar,
    completed,
    inProgress,
    notStarted,
    late,
    missed,
    cancelled,
    unassigned,
    overdue,
    completedWithoutCheckIn,
    completionRate: dueSoFar === 0 ? 100 : Math.round((completed / dueSoFar) * 100),
  };
}

/**
 * The calls a manager has to do something about, worst first.
 *
 * This was the missing piece: the email listed every call in schedule order, so
 * a missed call at 09:00 sat above a carer still on site at 14:00 purely because
 * of the clock. Exceptions now lead, and the full list follows underneath.
 */
export function visitsNeedingAttention(visits: DigestVisit[], now: Date): DigestVisit[] {
  const severity = (v: DigestVisit): number => {
    if (v.status === 'missed') return 0;
    if (isOverdue(v, now)) return 1;
    if (!v.assigned_staff_id && !CLOSED_STATUSES.includes(v.status)) return 2;
    if (isLate(v)) return 3;
    if (v.status === 'completed' && !v.check_in_at) return 4;
    return 9;
  };
  return visits
    .filter((v) => severity(v) < 9)
    .sort((a, b) => severity(a) - severity(b) || new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime());
}

export type VisitDigestState = {
  /** Plain words a manager would use, e.g. "12 min late", "MISSED". */
  state: string;
  /** Drives colour in the email. */
  tone: 'ok' | 'warn' | 'bad' | 'neutral';
  /** Supporting facts: actual times, duration, late reason. */
  detail: string;
};

/**
 * Turns a visit row into a state a manager can act on.
 *
 * Computed here rather than in the email renderer so the wording lives with the
 * rules that produce it, and so the renderer stays a renderer. It also keeps
 * the two modules from having to import each other to agree on what "late"
 * means.
 */
export function describeVisit(visit: DigestVisit, now: Date): VisitDigestState {
  // Only zone-independent facts go in `detail`. Actual arrival and departure
  // times are rendered by the email in the recipient's own timezone; baking a
  // clock string in here would print UTC next to local and be quietly wrong by
  // an hour for every UK summer.
  const bits: string[] = [];
  const duration = durationMinutes(visit);
  if (duration !== null) bits.push(`${duration} min on site`);
  if (visit.late_reason) bits.push(`reason: ${visit.late_reason}`);

  if (visit.status === 'missed') return { state: 'MISSED', tone: 'bad', detail: bits.join(' · ') };
  if (visit.status === 'cancelled') return { state: 'Cancelled', tone: 'neutral', detail: bits.join(' · ') };

  const late = minutesLate(visit);
  if (isOverdue(visit, now)) return { state: 'Overdue — not closed out', tone: 'bad', detail: bits.join(' · ') };
  if (!visit.assigned_staff_id) return { state: 'No carer assigned', tone: 'warn', detail: bits.join(' · ') };
  if (isLate(visit)) return { state: late !== null ? `${late} min late` : 'Late', tone: 'warn', detail: bits.join(' · ') };
  if (visit.status === 'checked_in') return { state: 'On site', tone: 'ok', detail: bits.join(' · ') };
  if (visit.status === 'en_route') return { state: 'On the way', tone: 'ok', detail: bits.join(' · ') };
  if (visit.status === 'completed' && !visit.check_in_at) return { state: 'Completed, no check-in recorded', tone: 'warn', detail: bits.join(' · ') };
  if (visit.status === 'completed') return { state: 'Completed', tone: 'ok', detail: bits.join(' · ') };
  return { state: 'Scheduled', tone: 'neutral', detail: bits.join(' · ') };
}

export type AnnotatedVisit = DigestVisit & { digestState: VisitDigestState };

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
           v.check_in_at, v.check_out_at,
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

  const rows: DigestVisit[] = visits.rows;
  const totals = summariseVisits(rows, now);
  const annotate = (v: DigestVisit): AnnotatedVisit => ({ ...v, digestState: describeVisit(v, now) });

  const incidents = await migrateQuery(`
    SELECT i.title, i.severity, i.status
    FROM incidents i
    WHERE i.organization_id = $1 AND i.incident_date = $2::date
    ORDER BY i.created_at DESC LIMIT 20
  `, [recipient.organization_id, date]);

  // 80 was chosen to keep the email readable, but truncating silently means a
  // manager reads "all calls" and is quietly looking at a subset. Cap the full
  // list, and say so, so the number in the heading and the number of rows agree.
  const FULL_LIST_CAP = 80;
  const allAttention = visitsNeedingAttention(rows, now);

  return {
    type,
    date,
    timezone,
    totals,
    // Kept for anything still reading the old flat shape.
    total: totals.scheduled,
    completed: totals.completed,
    missed: totals.missed,
    covered: rows.filter((v) => v.assigned_staff_id && !CLOSED_STATUSES.includes(v.status)).length,
    overdue: totals.overdue,
    late: totals.late,
    completionRate: totals.completionRate,
    visits: rows.slice(0, FULL_LIST_CAP).map(annotate),
    visitsTruncated: Math.max(0, rows.length - FULL_LIST_CAP),
    attention: allAttention.slice(0, 25).map(annotate),
    attentionTruncated: Math.max(0, allAttention.length - 25),
    incidents: incidents.rows,
    managerView: isManager,
  };
}
