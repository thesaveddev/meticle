import { describe, expect, it } from 'vitest';
import { buildDigestEmailContent } from '../../shared/utils/email.service';
import {
  describeVisit,
  formatWeekLabel,
  getLocalWeekday,
  isWeeklyDigestDue,
  previousCompleteWeek,
  summariseWeek,
  visitsNeedingAttention,
  type DigestVisit,
} from './homecare.digests';

/**
 * Monday 28 September 2026, 07:30 London. The weekly fires on the Monday
 * morning *after* the week it reports, so this instant should resolve to the
 * week of Mon 21 – Sun 27 Sep 2026 and never include today.
 *
 * 07:30 London in late September is BST, i.e. UTC+1, hence 06:30Z. The instant
 * has to sit on the configured time, not merely on the right day: the send
 * window is ten minutes wide, as it is for the daily digests.
 */
const MONDAY_MORNING = new Date('2026-09-28T06:30:00.000Z');
const TZ = 'Europe/London';

/** The Monday-to-Sunday the weekly sent on MONDAY_MORNING reports: 21–27 Sep. */
const WEEK_LABEL = 'Mon, 21 Sept 2026 – Sun, 27 Sept 2026';

function visit(overrides: Partial<DigestVisit> = {}): DigestVisit {
  return {
    label: 'Personal Care',
    visit_type: 'personal_care',
    status: 'completed',
    scheduled_start: '2026-09-15T09:00:00.000Z',
    scheduled_end: '2026-09-15T10:00:00.000Z',
    check_in_at: '2026-09-15T08:58:00.000Z',
    check_out_at: '2026-09-15T10:02:00.000Z',
    late_reason: null,
    assigned_staff_id: 'staff-1',
    person_name: 'Margaret Ellis',
    carer_name: 'Joyce Amankwah',
    ...overrides,
  };
}

const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/** Same shape `buildWeeklySummary` produces. */
function weeklySummary(visits: DigestVisit[], extra: Record<string, unknown> = {}) {
  const annotate = (v: DigestVisit) => ({ ...v, digestState: describeVisit(v, MONDAY_MORNING) });
  const week = summariseWeek(visits, MONDAY_MORNING, TZ);
  return {
    type: 'weekly',
    date: WEEK_LABEL,
    timezone: TZ,
    totals: week,
    week,
    total: week.scheduled,
    completed: week.completed,
    missed: week.missed,
    late: week.late,
    completionRate: week.completionRate,
    visits: visits.map(annotate),
    attention: visitsNeedingAttention(visits, MONDAY_MORNING).map(annotate),
    managerView: true,
    incidents: [],
    ...extra,
  };
}

describe('the weekly window is a finished week, not a rolling seven days', () => {
  it('reports the Monday-to-Sunday that has just ended', () => {
    // Sent on Mon 28 Sep, so the last complete week is 21–27 Sep. Reporting
    // 14–20 here would skip a week of care and quietly understate the numbers.
    const week = previousCompleteWeek(MONDAY_MORNING, TZ);
    expect(week.startDate).toBe('2026-09-21');
    expect(week.endDate).toBe('2026-09-28');
  });

  it('never includes the Monday it is sent on', () => {
    const week = previousCompleteWeek(MONDAY_MORNING, TZ);
    // This Monday is the exclusive end, so a call at 09:00 today is outside.
    expect(week.startDate <= '2026-09-28' && week.endDate <= '2026-09-28').toBe(true);
  });

  it('does not drift when read on a Tuesday or a Sunday', () => {
    // Tuesday and Sunday of the same ISO week must both resolve to the same
    // completed week, or the "week" would mean something different depending on
    // when the scheduler happened to run.
    const tuesday = previousCompleteWeek(new Date('2026-09-22T08:00:00.000Z'), TZ);
    const sunday = previousCompleteWeek(new Date('2026-09-27T08:00:00.000Z'), TZ);
    expect(sunday.startDate).toBe('2026-09-14');
    expect(tuesday.startDate).toBe('2026-09-14');
  });

  it('rolls forward a week after the following Monday arrives', () => {
    const nextMonday = previousCompleteWeek(new Date('2026-10-05T06:30:00.000Z'), TZ);
    expect(nextMonday.startDate).toBe('2026-09-28');
  });

  it('labels the range readably', () => {
    expect(formatWeekLabel('2026-09-21', '2026-09-28')).toBe(WEEK_LABEL);
  });
});

describe('the weekly digest only fires on Mondays', () => {
  it('is due at the configured time on a Monday', () => {
    expect(getLocalWeekday(MONDAY_MORNING, TZ)).toBe(1);
    expect(isWeeklyDigestDue(MONDAY_MORNING, '07:30', TZ)).toBe(true);
  });

  it('is no longer due once the send window has passed', () => {
    // The window is 10 minutes wide. A scheduler that wakes up late must not
    // send a week-old summary hours afterwards.
    expect(isWeeklyDigestDue(new Date('2026-09-28T08:00:00.000Z'), '07:30', TZ)).toBe(false);
  });

  it('is not due on any other day, however well the time matches', () => {
    // Sunday 27 Sep, 07:30 London.
    const sunday = new Date('2026-09-27T06:30:00.000Z');
    expect(getLocalWeekday(sunday, TZ)).toBe(0);
    expect(isWeeklyDigestDue(sunday, '07:30', TZ)).toBe(false);
  });

  it('is not due at the wrong time on a Monday', () => {
    expect(isWeeklyDigestDue(MONDAY_MORNING, '23:00', TZ)).toBe(false);
  });
});

describe('weekly metrics do not flatter the week', () => {
  it('counts completion, lateness and misses across the whole week', () => {
    const visits = [
      visit(),
      visit({ scheduled_start: '2026-09-16T09:00:00.000Z', scheduled_end: '2026-09-16T10:00:00.000Z', check_in_at: '2026-09-16T09:40:00.000Z', check_out_at: '2026-09-16T10:30:00.000Z' }),
      visit({ status: 'missed', scheduled_start: '2026-09-17T09:00:00.000Z', scheduled_end: '2026-09-17T10:00:00.000Z', check_in_at: null, check_out_at: null }),
    ];
    const week = summariseWeek(visits, MONDAY_MORNING, TZ);
    expect(week.scheduled).toBe(3);
    expect(week.completed).toBe(2);
    expect(week.missed).toBe(1);
    expect(week.late).toBe(1);
  });

  it('measures lateness against delivered calls, not everything scheduled', () => {
    // Two delivered (one late) plus two cancelled. Cancelled calls have no
    // arrival, so they can never be late; counting them in the denominator
    // would report 25% lateness on a week where half the work was stood down.
    const visits = [
      visit(),
      visit({ scheduled_start: '2026-09-16T09:00:00.000Z', scheduled_end: '2026-09-16T10:00:00.000Z', check_in_at: '2026-09-16T09:40:00.000Z', check_out_at: '2026-09-16T10:30:00.000Z' }),
      visit({ status: 'cancelled', scheduled_start: '2026-09-17T09:00:00.000Z', scheduled_end: '2026-09-17T10:00:00.000Z', check_in_at: null, check_out_at: null }),
      visit({ status: 'cancelled', scheduled_start: '2026-09-18T09:00:00.000Z', scheduled_end: '2026-09-18T10:00:00.000Z', check_in_at: null, check_out_at: null }),
    ];
    const week = summariseWeek(visits, MONDAY_MORNING, TZ);
    expect(week.delivered).toBe(2);
    expect(week.late).toBe(1);
    expect(week.lateRate).toBe(50);
  });

  it('missed is a share of everything due, which for a closed week is everything', () => {
    const visits = [
      visit(),
      visit({ status: 'missed', scheduled_start: '2026-09-16T09:00:00.000Z', scheduled_end: '2026-09-16T10:00:00.000Z', check_in_at: null, check_out_at: null }),
    ];
    const week = summariseWeek(visits, MONDAY_MORNING, TZ);
    expect(week.dueSoFar).toBe(week.scheduled);
    expect(week.missedRate).toBe(50);
    expect(week.completionRate).toBe(50);
  });

  it('does not call a clock-skewed arrival late', () => {
    const week = summariseWeek([visit({ check_in_at: '2026-09-15T09:03:00.000Z' })], MONDAY_MORNING, TZ);
    expect(week.late).toBe(0);
  });
});

describe('the weekly email surfaces a bad day rather than hiding it in a total', () => {
  it('breaks the week down day by day', () => {
    const visits = [
      visit(),
      visit(),
      // Tuesday collapses.
      visit({ status: 'missed', scheduled_start: '2026-09-15T14:00:00.000Z', scheduled_end: '2026-09-15T15:00:00.000Z', check_in_at: null, check_out_at: null }),
      visit({ status: 'missed', scheduled_start: '2026-09-15T15:00:00.000Z', scheduled_end: '2026-09-15T16:00:00.000Z', check_in_at: null, check_out_at: null }),
    ];
    const html = buildDigestEmailContent('Joyce', 'weekly', WEEK_LABEL, weeklySummary(visits));
    const body = text(html);
    expect(body).toContain('Day by day');
    expect(body).toContain('Tue 2026-09-15');
    expect(body).toContain('50%');
  });

  it('names the weakest day so a manager can act on it', () => {
    const visits = [
      visit(),
      visit(),
      visit({ status: 'missed', scheduled_start: '2026-09-15T14:00:00.000Z', scheduled_end: '2026-09-15T15:00:00.000Z', check_in_at: null, check_out_at: null }),
    ];
    const html = buildDigestEmailContent('Joyce', 'weekly', WEEK_LABEL, weeklySummary(visits));
    expect(text(html)).toContain('Weakest day: Tue 2026-09-15');
  });

  it('does not call an empty day the best day of the week', () => {
    // A day with no calls has no rate to judge, so it cannot win "weakest".
    const week = summariseWeek([visit()], MONDAY_MORNING, TZ);
    expect(week.worstDay?.date).toBe('2026-09-15');
  });

  it('states the week figures the reader asked for', () => {
    const visits = [
      visit(),
      visit({ scheduled_start: '2026-09-16T09:00:00.000Z', scheduled_end: '2026-09-16T10:00:00.000Z', check_in_at: '2026-09-16T09:40:00.000Z', check_out_at: '2026-09-16T10:30:00.000Z' }),
      visit({ status: 'missed', scheduled_start: '2026-09-17T09:00:00.000Z', scheduled_end: '2026-09-17T10:00:00.000Z', check_in_at: null, check_out_at: null }),
    ];
    const body = text(buildDigestEmailContent('Joyce', 'weekly', WEEK_LABEL, weeklySummary(visits)));
    expect(body).toContain('The week in numbers');
    expect(body).toContain('2 of 3 calls due were completed');
    expect(body).toContain('1 call was missed');
    expect(body).toContain('50% of the 2 delivered');
  });

  it('says plainly when nothing was missed', () => {
    const body = text(buildDigestEmailContent('Joyce', 'weekly', WEEK_LABEL, weeklySummary([visit(), visit()])));
    expect(body).toContain('No calls were missed');
  });

  it('does not reuse the daily wording that would be false of a whole week', () => {
    const body = text(buildDigestEmailContent('Joyce', 'weekly', WEEK_LABEL, weeklySummary([visit()])));
    expect(body).toContain('calls in the week');
    expect(body).not.toContain('scheduled today');
    expect(body).not.toContain('due by now');
    expect(body).not.toContain('All calls today');
  });

  it('handles a week with no calls at all without dividing by zero', () => {
    const body = text(buildDigestEmailContent('Joyce', 'weekly', WEEK_LABEL, weeklySummary([])));
    expect(body).toContain('No calls were scheduled in this week');
    expect(body).toContain('No calls were missed');
  });

  it('escapes user-supplied text in the day-by-day table', () => {
    const week = summariseWeek([visit()], MONDAY_MORNING, TZ);
    const html = buildDigestEmailContent('<script>alert(1)</script>', 'weekly', 'Mon 14 – Sun 20 Sep 2026', weeklySummary([visit()], { week: { ...week, days: [{ date: '2026-09-15', label: '<img src=x onerror=1>' }] } }));
    expect(html).not.toContain('<img src=x');
  });
});
