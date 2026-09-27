import { migrateQuery } from '../../shared/database';
import { EmailService } from '../../shared/utils/email.service';
import logger from '../../shared/utils/logger';

const DIGEST_EMAILS_ENABLED = process.env.HOMECARE_DIGEST_EMAILS_ENABLED !== 'false';
export const DEFAULT_DIGEST_TIMEZONE = 'Europe/London';
const DIGEST_WINDOW_GRACE_MINUTES = 10;
export type DigestType = 'morning' | 'midday' | 'evening' | 'weekly';

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

// ---------------------------------------------------------------------------
// Weekly summary
// ---------------------------------------------------------------------------

/** Monday, to match `Date.prototype.getUTCDay`. */
export const WEEKLY_DIGEST_WEEKDAY = 1;
export const WEEKLY_DIGEST_DEFAULT_TIME = '07:30';

/** Day of the week for an instant, in the recipient's timezone (0 = Sunday). */
export function getLocalWeekday(now: Date, timezone = DEFAULT_DIGEST_TIMEZONE): number {
  const local = getLocalParts(now, timezone);
  // Date.UTC on the local calendar parts, read back in UTC, gives the weekday
  // without any offset arithmetic. The alternative — building a Date in the
  // target zone — silently shifts the day for anyone west of Greenwich.
  return new Date(Date.UTC(Number(local.year), Number(local.month) - 1, Number(local.day))).getUTCDay();
}

/**
 * The weekly summary is due on its configured time, on Mondays only.
 *
 * `isDigestDue` alone is not enough: it is day-agnostic by design, because the
 * three daily windows fire every day. Left alone it would send a "week in
 * review" email seven days a week, each one covering the same completed week.
 */
export function isWeeklyDigestDue(now: Date, time: string, timezone = DEFAULT_DIGEST_TIMEZONE): boolean {
  if (getLocalWeekday(now, timezone) !== WEEKLY_DIGEST_WEEKDAY) return false;
  return isDigestDue(now, time, timezone);
}

/** Add whole days to a `YYYY-MM-DD` key, using UTC so no DST shift can occur. */
function shiftDateKey(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export type DigestWeek = {
  /** `YYYY-MM-DD` of the Monday the reported week starts on. */
  startDate: string;
  /** Exclusive end: the following Monday. */
  endDate: string;
  /** Human label, e.g. "Mon 15 – Sun 21 Sep 2026". */
  label: string;
};

/**
 * The last *complete* Monday-to-Sunday week, in the recipient's timezone.
 *
 * A trailing seven days would have been easier and would have been dishonest:
 * the denominator would be ragged and a figure reported at 07:30 on Monday
 * would be measured against a Monday that has barely started. Anchoring to a
 * finished week means every call in it was genuinely due, so the completion
 * rate means what it says without needing a "due by now" caveat.
 *
 * `startDate` doubles as the delivery key, which is what makes the weekly
 * idempotent per week through the existing deliveries unique constraint.
 */
export function previousCompleteWeek(now: Date, timezone = DEFAULT_DIGEST_TIMEZONE): DigestWeek {
  const today = localDateKey(now, timezone);
  const weekday = getLocalWeekday(now, timezone);
  // Days elapsed since this week's Monday: Mon 0 … Sun 6.
  const sinceMonday = (weekday + 6) % 7;
  const thisMonday = shiftDateKey(today, -sinceMonday);
  const startDate = shiftDateKey(thisMonday, -7);
  return { startDate, endDate: thisMonday, label: formatWeekLabel(startDate, thisMonday) };
}

/**
 * Format a Monday-to-Monday span for display, as "Mon, 14 Sept 2026 – Sun, 20 Sept 2026".
 *
 * Both ends are rendered from their calendar parts at UTC noon rather than by
 * passing a string to `Date`, because `new Date('2026-09-15')` is UTC midnight
 * and prints as the 14th anywhere west of Greenwich.
 */
export function formatWeekLabel(startDate: string, endDate: string, locale = 'en-GB'): string {
  const parse = (key: string) => {
    const [year, month, day] = key.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 12));
  };
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  // The end is exclusive, so the last day in the range is the day before it.
  return `${fmt.format(parse(startDate))} – ${fmt.format(parse(shiftDateKey(endDate, -1)))}`;
}

export type WeekDaySummary = {
  /** `YYYY-MM-DD` in the recipient's timezone. */
  date: string;
  /** Three-letter weekday label, e.g. "Mon". */
  label: string;
  scheduled: number;
  completed: number;
  missed: number;
  late: number;
  completionRate: number;
};

export type DigestWeekTotals = DigestTotals & {
  /** Calls actually delivered. The honest denominator for a lateness rate. */
  delivered: number;
  /** Lateness as a share of delivered calls, not of everything scheduled. */
  lateRate: number;
  /** Misses as a share of everything that was due — which, for a closed week, is everything. */
  missedRate: number;
  /** Per-day figures, so one bad day is not hidden inside a weekly total. */
  days: WeekDaySummary[];
  /** The worst day by completion rate, when there was at least one call due. */
  worstDay: WeekDaySummary | null;
};

/** The local `YYYY-MM-DD` a visit was scheduled for, in the given timezone. */
export function visitDayKey(visit: DigestVisit, timezone = DEFAULT_DIGEST_TIMEZONE): string {
  return localDateKey(new Date(visit.scheduled_start), timezone);
}

/**
 * Counts for a completed week.
 *
 * Two things are deliberately different from the daily figures.
 *
 * The lateness rate is taken against `delivered`, not `scheduled`. A cancelled
 * call cannot be late — there is no arrival to be late to — so counting it in
 * the denominator would quietly flatter the figure for any week with
 * cancellations.
 *
 * A per-day breakdown is included because a single weekly total is the kind of
 * number that gets quoted and never questioned. If Tuesday was 40% completion
 * and the rest of the week was fine, the total looks like a trend and is
 * actually one bad day.
 */
export function summariseWeek(visits: DigestVisit[], now: Date, timezone = DEFAULT_DIGEST_TIMEZONE): DigestWeekTotals {
  const base = summariseVisits(visits, now);
  const delivered = visits.filter((v) => v.status === 'completed').length;
  const byDay = new Map<string, DigestVisit[]>();
  for (const visit of visits) {
    const key = visitDayKey(visit, timezone);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(visit);
    else byDay.set(key, [visit]);
  }

  const dayFormatter = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' });
  const days: WeekDaySummary[] = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, rows]) => {
      const [year, month, day] = date.split('-').map(Number);
      const dayTotals = summariseVisits(rows, now);
      return {
        date,
        label: dayFormatter.format(new Date(Date.UTC(year, month - 1, day, 12))),
        scheduled: dayTotals.scheduled,
        completed: dayTotals.completed,
        missed: dayTotals.missed,
        late: dayTotals.late,
        // A day with nothing due is not 0% completion, it is not measured.
        completionRate: dayTotals.dueSoFar === 0 ? 100 : Math.round((dayTotals.completed / dayTotals.dueSoFar) * 100),
      };
    });

  // Only judge a day "worst" if it had calls due; an empty day would otherwise
  // win on a 100% rate and be reported as the strongest day of the week.
  const withCalls = days.filter((d) => d.scheduled > 0);
  const worstDay = withCalls.length
    ? withCalls.reduce((worst, d) => (d.completionRate < worst.completionRate ? d : worst))
    : null;

  return {
    ...base,
    delivered,
    lateRate: delivered === 0 ? 0 : Math.round((base.late / delivered) * 100),
    missedRate: base.dueSoFar === 0 ? 0 : Math.round((base.missed / base.dueSoFar) * 100),
    days,
    worstDay,
  };
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
           COALESCE(dp.weekly_enabled, TRUE) AS weekly_enabled,
           COALESCE(dp.weekly_time, '07:30'::time) AS weekly_time,
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
    const isManager = recipient.role === 'ORG_ADMIN' || recipient.role === 'MANAGER';
    const windows: Array<{ type: DigestType; enabled: boolean; time: string }> = [
      { type: 'morning', enabled: recipient.morning_enabled, time: recipient.morning_time },
      { type: 'midday', enabled: recipient.midday_enabled, time: recipient.midday_time },
      { type: 'evening', enabled: recipient.evening_enabled, time: recipient.evening_time },
      // Manager-only. A weekly view of organisation-wide completion, lateness and
      // missed calls is not meaningful to a single care worker, and the daily
      // windows already cover what they need to know about their own calls.
      { type: 'weekly', enabled: isManager && recipient.weekly_enabled, time: recipient.weekly_time },
    ];

    for (const window of windows) {
      if (!window.enabled) continue;
      // The weekly window additionally has to land on a Monday. The daily
      // windows are day-agnostic, so isDigestDue on its own would send the same
      // week's summary seven times.
      const due = window.type === 'weekly'
        ? isWeeklyDigestDue(now, window.time, timezone)
        : isDigestDue(now, window.time, timezone);
      if (!due) continue;

      const week = previousCompleteWeek(now, timezone);
      // Keyed on the Monday the reported week starts, which is what makes the
      // weekly idempotent across restarts and retries via the deliveries unique
      // constraint. The daily windows keep their single-day key.
      const date = window.type === 'weekly' ? week.startDate : localDateKey(now, timezone);
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
        const summary = window.type === 'weekly'
          ? await buildWeeklySummary(recipient, now, week, timezone)
          : await buildDigestSummary(recipient, window.type, now, date, timezone);
        // `date` is the de-duplication key (an ISO Monday for the weekly
        // window); the summary carries the human range. Sending the key would
        // print "2026-09-14" where the reader expects "Mon 14 – Sun 20 Sep".
        await EmailService.sendHomecareDigestEmail(recipient.email, recipient.name, window.type, summary.date ?? date, summary);
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

/**
 * Assembles the weekly summary for one manager.
 *
 * The window is a finished Monday-to-Sunday, so unlike the daily digests there
 * is no "due by now" caveat to print: every call in the range was genuinely
 * due. The digest column label is passed through as the period, because the
 * deliveries table needs an ISO key for de-duplication and the email needs a
 * readable range, and the two are not the same string.
 */
async function buildWeeklySummary(recipient: any, now: Date, week: DigestWeek, timezone: string) {
  const visits = await migrateQuery(`
    SELECT v.label, v.visit_type, v.status, v.scheduled_start, v.scheduled_end,
           v.late_reason, v.assigned_staff_id,
           v.check_in_at, v.check_out_at,
           COALESCE(pe.first_name || ' ' || pe.last_name, 'Client') AS person_name,
           COALESCE(sp.first_name || ' ' || sp.last_name, 'Unassigned') AS carer_name
    FROM homecare_visits v
    JOIN people pe ON pe.id = v.person_id
    LEFT JOIN staff_profiles sp ON sp.id = v.assigned_staff_id
    WHERE v.organization_id = $1
      AND v.scheduled_start >= ($2::date AT TIME ZONE $3)
      AND v.scheduled_start < (($2::date + INTERVAL '7 days') AT TIME ZONE $3)
    ORDER BY v.scheduled_start
  `, [recipient.organization_id, week.startDate, timezone]);

  const rows: DigestVisit[] = visits.rows;
  const weekTotals = summariseWeek(rows, now, timezone);
  const annotate = (v: DigestVisit): AnnotatedVisit => ({ ...v, digestState: describeVisit(v, now) });

  const incidents = await migrateQuery(`
    SELECT i.title, i.severity, i.status
    FROM incidents i
    WHERE i.organization_id = $1 AND i.incident_date >= $2::date AND i.incident_date < $3::date
    ORDER BY i.created_at DESC LIMIT 20
  `, [recipient.organization_id, week.startDate, week.endDate]);

  const FULL_LIST_CAP = 80;
  const allAttention = visitsNeedingAttention(rows, now);

  return {
    type: 'weekly' as const,
    date: week.label,
    timezone,
    totals: weekTotals,
    week: weekTotals,
    // Kept for anything still reading the old flat shape.
    total: weekTotals.scheduled,
    completed: weekTotals.completed,
    missed: weekTotals.missed,
    late: weekTotals.late,
    completionRate: weekTotals.completionRate,
    visits: rows.slice(0, FULL_LIST_CAP).map(annotate),
    visitsTruncated: Math.max(0, rows.length - FULL_LIST_CAP),
    attention: allAttention.slice(0, 25).map(annotate),
    attentionTruncated: Math.max(0, allAttention.length - 25),
    incidents: incidents.rows,
    managerView: true,
  };
}

async function buildDigestSummary(recipient: any, type: Exclude<DigestType, 'weekly'>, now: Date, date: string, timezone: string) {
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
