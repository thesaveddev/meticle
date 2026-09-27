import { describe, expect, it } from 'vitest';
import { buildDigestEmailContent } from '../../shared/utils/email.service';
import { describeVisit, summariseVisits, visitsNeedingAttention, type DigestVisit } from './homecare.digests';

const NOW = new Date('2026-09-27T13:00:00.000Z');
const DATE = '2026-09-27';

function visit(overrides: Partial<DigestVisit> = {}): DigestVisit {
  return {
    label: 'Personal Care',
    visit_type: 'personal_care',
    status: 'scheduled',
    scheduled_start: '2026-09-27T09:00:00.000Z',
    scheduled_end: '2026-09-27T10:00:00.000Z',
    check_in_at: null,
    check_out_at: null,
    late_reason: null,
    assigned_staff_id: 'staff-1',
    person_name: 'Margaret Ellis',
    carer_name: 'Joyce Amankwah',
    ...overrides,
  };
}

/** Builds the same summary shape `buildDigestSummary` produces. */
function summary(visits: DigestVisit[], extra: Record<string, unknown> = {}) {
  const annotate = (v: DigestVisit) => ({ ...v, digestState: describeVisit(v, NOW) });
  return {
    timezone: 'Europe/London',
    totals: summariseVisits(visits, NOW),
    visits: visits.map(annotate),
    attention: visitsNeedingAttention(visits, NOW).map(annotate),
    managerView: true,
    incidents: [],
    ...extra,
  };
}

/**
 * Strips tags so assertions read like the email does.
 *
 * The figures are rendered as `5<span> scheduled today</span>`, so asserting on
 * "5 scheduled today" against raw HTML fails on markup rather than on content.
 * This checks what the recipient actually sees.
 */
const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const day = [
  visit({ status: 'completed', check_in_at: '2026-09-27T08:58:00.000Z', check_out_at: '2026-09-27T10:02:00.000Z' }),
  visit({ status: 'completed', check_in_at: '2026-09-27T09:40:00.000Z', check_out_at: '2026-09-27T11:05:00.000Z' }),
  visit({ status: 'missed', scheduled_start: '2026-09-27T11:00:00.000Z', scheduled_end: '2026-09-27T12:00:00.000Z' }),
  // Ends at 12:30 and NOW is 13:00, so this one is checked in but overrun.
  visit({ status: 'checked_in', scheduled_start: '2026-09-27T12:00:00.000Z', scheduled_end: '2026-09-27T12:30:00.000Z', check_in_at: '2026-09-27T12:05:00.000Z' }),
  visit({ status: 'scheduled', assigned_staff_id: null, scheduled_start: '2026-09-27T16:00:00.000Z', scheduled_end: '2026-09-27T17:00:00.000Z' }),
];

describe('digest email reports the day in numbers', () => {
  const html = buildDigestEmailContent('Adetoye', 'evening', DATE, summary(day));

  it('states every count the recipient asked for', () => {
    // Scheduled, closed, late, missed were the explicit ask.
    const body = text(html);
    expect(body).toContain('5 scheduled today');
    expect(body).toContain('2 completed');
    expect(body).toContain('1 late');
    expect(body).toContain('1 missed');
  });

  it('adds the counts needed to read those figures honestly', () => {
    const body = text(html);
    expect(body).toContain('due by now');
    expect(body).toContain('in progress');
    expect(body).toContain('not started');
    expect(body).toContain('overdue');
    expect(body).toContain('no carer assigned');
    expect(body).toContain('cancelled');
    expect(body).toContain('completion of calls due');
  });

  it('names the client, the call and the carer on each row', () => {
    expect(html).toContain('Margaret Ellis');
    expect(html).toContain('Personal Care');
    expect(html).toContain('Joyce Amankwah');
  });

  it('says what is wrong with each call, not just its raw status', () => {
    const body = text(html);
    expect(body).toContain('MISSED');
    expect(body).toContain('40 min late');
    expect(body).toContain('No carer assigned');
    expect(body).toContain('Overdue');
  });

  it('shows the actual arrival and departure times', () => {
    // 09:40 BST for a 09:40Z check-in on a September date — the point is that
    // the times are rendered in the recipient's zone at all.
    expect(html).toMatch(/in 1[01]:\d\d/);
    expect(html).toContain('on site');
  });

  it('leads with the exceptions rather than the clock', () => {
    const attentionAt = html.indexOf('Needs attention');
    const allAt = html.indexOf('All calls today');
    expect(attentionAt).toBeGreaterThan(-1);
    expect(allAt).toBeGreaterThan(attentionAt);
    // And within the exception block, the missed call precedes the unassigned one.
    const block = html.slice(attentionAt, allAt);
    expect(block.indexOf('MISSED')).toBeLessThan(block.indexOf('No carer assigned'));
  });

  it('says so plainly when nothing needs attention', () => {
    const calm = buildDigestEmailContent('Adetoye', 'midday', DATE, summary([
      visit({ status: 'completed', check_in_at: '2026-09-27T08:58:00.000Z', check_out_at: '2026-09-27T10:00:00.000Z' }),
    ]));
    expect(calm).toContain('Nothing needs attention');
  });
});

describe('digest email frames each of the three sends differently', () => {
  it('opens the morning one with the schedule and unassigned count', () => {
    const html = buildDigestEmailContent('Adetoye', 'morning', DATE, summary(day));
    expect(text(html)).toContain("Today's schedule");
    expect(text(html)).toMatch(/1 call still has no carer assigned/);
  });

  it('opens the midday one with where the day stands', () => {
    const html = buildDigestEmailContent('Adetoye', 'midday', DATE, summary(day));
    expect(text(html)).toContain('Where the day stands');
    expect(text(html)).toContain('exceptions below that need a decision');
  });

  it('opens the evening one with the day in numbers', () => {
    const html = buildDigestEmailContent('Adetoye', 'evening', DATE, summary(day));
    expect(text(html)).toContain('The day in numbers');
    // Singular reads "was missed", plural "were missed".
    expect(text(html)).toContain('1 call was missed and 1 ran late');
  });

  it('agrees with itself when more than one call was missed', () => {
    const html = buildDigestEmailContent('Adetoye', 'evening', DATE, summary([
      visit({ status: 'missed' }),
      visit({ status: 'missed', scheduled_start: '2026-09-27T11:00:00.000Z', scheduled_end: '2026-09-27T12:00:00.000Z' }),
    ]));
    expect(text(html)).toContain('2 calls were missed');
  });
});

describe('digest email is safe to render from user-supplied text', () => {
  it('escapes a client name that contains markup', () => {
    const html = buildDigestEmailContent('Adetoye', 'midday', DATE, summary([
      visit({ status: 'missed', person_name: '<script>alert(1)</script>' }),
    ]));
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes a late reason that contains markup', () => {
    const html = buildDigestEmailContent('Adetoye', 'midday', DATE, summary([
      visit({ status: 'completed', check_in_at: '2026-09-27T09:40:00.000Z', late_reason: '<b>traffic</b>' }),
    ]));
    expect(html).not.toContain('<b>traffic</b>');
    expect(html).toContain('&lt;b&gt;traffic&lt;/b&gt;');
  });

  it('omits visit notes entirely, since they are clinical free text', () => {
    const html = buildDigestEmailContent('Adetoye', 'midday', DATE, summary([
      { ...visit({ status: 'completed', check_in_at: '2026-09-27T09:00:00.000Z' }), visit_notes: 'Fall risk; catheter care' } as DigestVisit,
    ]));
    expect(html).not.toContain('Fall risk');
    expect(html).not.toContain('catheter');
  });
});

describe('digest email does not over-claim what it is showing', () => {
  it('reveals truncation instead of quietly showing a subset', () => {
    const html = buildDigestEmailContent('Adetoye', 'evening', DATE, summary(day, { visitsTruncated: 12 }));
    expect(text(html)).toContain('12 further calls not shown');
    expect(text(html)).toContain('showing first 5');
  });

  it('hides the carer column from a care worker', () => {
    const html = buildDigestEmailContent('Joyce', 'evening', DATE, summary(day, { managerView: false }));
    expect(html).not.toContain('Joyce Amankwah');
  });
});
