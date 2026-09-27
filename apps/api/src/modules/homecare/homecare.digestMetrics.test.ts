import { describe, expect, it } from 'vitest';
import {
  summariseVisits,
  visitsNeedingAttention,
  describeVisit,
  minutesLate,
  isLate,
  isOverdue,
  durationMinutes,
  LATE_GRACE_MINUTES,
  type DigestVisit,
} from './homecare.digests';

// Scheduling behaviour (localDateKey, isDigestDue) is covered by
// ./homecare.digests.test.ts and deliberately not repeated here.

const NOW = new Date('2026-09-27T13:00:00.000Z');

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

describe('lateness is measured, not remembered', () => {
  it('counts a call that started well after its slot, even with no reason typed', () => {
    // This is the bug being fixed. `late_reason` is only ever set by a human
    // typing it, so before this existed the digest reported this as on time.
    const v = visit({ status: 'completed', check_in_at: '2026-09-27T09:40:00.000Z' });
    expect(minutesLate(v)).toBe(40);
    expect(isLate(v)).toBe(true);
  });

  it('does not flag a carer who is a minute or two past the hour', () => {
    const v = visit({ status: 'completed', check_in_at: '2026-09-27T09:02:00.000Z' });
    expect(isLate(v)).toBe(false);
  });

  it('treats the grace boundary as the boundary', () => {
    const atGrace = visit({ status: 'completed', check_in_at: `2026-09-27T09:${String(LATE_GRACE_MINUTES).padStart(2, '0')}:00.000Z` });
    expect(isLate(atGrace)).toBe(false);
  });

  it('still honours a reason a human recorded even without a check-in', () => {
    const v = visit({ status: 'completed', late_reason: 'Traffic on the ring road' });
    expect(isLate(v)).toBe(true);
    expect(describeVisit(v, NOW)).toMatchObject({ state: 'Late', tone: 'warn' });
    expect(describeVisit(v, NOW).detail).toContain('Traffic on the ring road');
  });

  it('reports no lateness for a call that has not begun', () => {
    expect(minutesLate(visit())).toBeNull();
    expect(isLate(visit())).toBe(false);
  });
});

describe('overdue and duration', () => {
  it('is overdue once the end time passes and the call is not closed out', () => {
    expect(isOverdue(visit({ status: 'checked_in' }), NOW)).toBe(true);
  });

  it('is not overdue once closed, however late the close was', () => {
    expect(isOverdue(visit({ status: 'completed' }), NOW)).toBe(false);
    expect(isOverdue(visit({ status: 'missed' }), NOW)).toBe(false);
    expect(isOverdue(visit({ status: 'cancelled' }), NOW)).toBe(false);
  });

  it('measures time on site from the recorded pair', () => {
    const v = visit({
      status: 'completed',
      check_in_at: '2026-09-27T09:05:00.000Z',
      check_out_at: '2026-09-27T10:35:00.000Z',
    });
    expect(durationMinutes(v)).toBe(90);
  });

  it('has no duration when either end is missing', () => {
    expect(durationMinutes(visit({ check_in_at: '2026-09-27T09:05:00.000Z' }))).toBeNull();
    expect(durationMinutes(visit())).toBeNull();
  });
});

describe('digest totals describe the day honestly', () => {
  it('counts each status once and totals them', () => {
    const visits = [
      visit({ status: 'completed', check_in_at: '2026-09-27T08:58:00.000Z', check_out_at: '2026-09-27T10:00:00.000Z' }),
      visit({ status: 'completed', check_in_at: '2026-09-27T09:40:00.000Z', check_out_at: '2026-09-27T10:30:00.000Z' }),
      visit({ status: 'missed' }),
      visit({ status: 'cancelled' }),
      visit({ status: 'checked_in', scheduled_start: '2026-09-27T12:00:00.000Z', scheduled_end: '2026-09-27T13:00:00.000Z' }),
      visit({ status: 'en_route', scheduled_start: '2026-09-27T15:00:00.000Z', scheduled_end: '2026-09-27T16:00:00.000Z' }),
      visit({ status: 'scheduled', scheduled_start: '2026-09-27T16:00:00.000Z', scheduled_end: '2026-09-27T17:00:00.000Z' }),
    ];
    const totals = summariseVisits(visits, NOW);
    expect(totals.scheduled).toBe(7);
    expect(totals.completed).toBe(2);
    expect(totals.missed).toBe(1);
    expect(totals.cancelled).toBe(1);
    expect(totals.inProgress).toBe(2);
    expect(totals.notStarted).toBe(1);
    expect(totals.late).toBe(1);
  });

  // The reason `dueSoFar` exists: dividing by the whole day at midday makes
  // the number look like a failure when the afternoon simply has not happened.
  it('measures completion against calls actually due, not the whole day', () => {
    const morning = Array.from({ length: 4 }, () =>
      visit({ status: 'completed', scheduled_start: '2026-09-27T08:00:00.000Z', check_in_at: '2026-09-27T08:00:00.000Z' }));
    const afternoon = Array.from({ length: 6 }, () =>
      visit({ status: 'scheduled', scheduled_start: '2026-09-27T16:00:00.000Z', scheduled_end: '2026-09-27T17:00:00.000Z' }));

    const totals = summariseVisits([...morning, ...afternoon], NOW);
    expect(totals.scheduled).toBe(10);
    expect(totals.dueSoFar).toBe(4);
    expect(totals.completionRate).toBe(100);
  });

  it('reports zero rather than dividing by nothing before any call is due', () => {
    const totals = summariseVisits(
      [visit({ status: 'scheduled', scheduled_start: '2026-09-27T18:00:00.000Z' })],
      NOW,
    );
    expect(totals.dueSoFar).toBe(0);
    expect(totals.completionRate).toBe(100);
    expect(Number.isNaN(totals.completionRate)).toBe(false);
  });

  it('counts an unassigned call that is still live', () => {
    const totals = summariseVisits(
      [visit({ status: 'scheduled', scheduled_start: '2026-09-27T16:00:00.000Z', assigned_staff_id: null })],
      NOW,
    );
    expect(totals.unassigned).toBe(1);
  });

  it('does not call a cancelled or missed call unassigned', () => {
    const totals = summariseVisits([
      visit({ status: 'cancelled', assigned_staff_id: null }),
      visit({ status: 'missed', assigned_staff_id: null }),
    ], NOW);
    expect(totals.unassigned).toBe(0);
  });

  it('flags a completed call with no check-in, since the timesheet can disagree with the log', () => {
    const totals = summariseVisits([visit({ status: 'completed' })], NOW);
    expect(totals.completedWithoutCheckIn).toBe(1);
  });
});

describe('exceptions lead the email', () => {
  it('ranks a missed late-afternoon call above a lesser problem in the morning', () => {
    // Deliberately built so clock order and severity order disagree, because a
    // test where they agree proves nothing. Sorted by clock this reads
    // [completed, missed]; by how much a manager needs to act it reads
    // [missed, completed]. The old email could only ever produce the former.
    const visits = [
      // Morning, minor: finished with no check-in recorded.
      visit({ status: 'completed', scheduled_start: '2026-09-27T09:00:00.000Z', scheduled_end: '2026-09-27T10:00:00.000Z' }),
      // Afternoon, serious: never happened.
      visit({ status: 'missed', scheduled_start: '2026-09-27T16:00:00.000Z', scheduled_end: '2026-09-27T17:00:00.000Z' }),
    ];
    const attention = visitsNeedingAttention(visits, NOW);
    expect(attention.map((v) => v.status)).toEqual(['missed', 'completed']);
  });

  it('puts an unassigned call above a late one, whatever the clock says', () => {
    // `visitsNeedingAttention` works on raw rows; the display wording is added
    // later by `describeVisit`, so this asserts on the ordering of the rows.
    const visits = [
      visit({ status: 'completed', check_in_at: '2026-09-27T09:45:00.000Z', scheduled_start: '2026-09-27T09:00:00.000Z', scheduled_end: '2026-09-27T10:00:00.000Z' }),
      visit({ status: 'scheduled', assigned_staff_id: null, scheduled_start: '2026-09-27T16:00:00.000Z', scheduled_end: '2026-09-27T17:00:00.000Z' }),
    ];
    const attention = visitsNeedingAttention(visits, NOW);
    expect(attention[0].assigned_staff_id).toBeNull();
    expect(attention[1].assigned_staff_id).toBe('staff-1');
    // And the wording the manager reads follows that order.
    expect(attention.map((v) => describeVisit(v, NOW).state))
      .toEqual(['No carer assigned', '45 min late']);
  });

  it('shows a missed morning call above a later call that has overrun', () => {
    const visits = [
      visit({ status: 'checked_in', scheduled_start: '2026-09-27T12:00:00.000Z', scheduled_end: '2026-09-27T12:30:00.000Z' }),
      visit({ status: 'missed', scheduled_start: '2026-09-27T09:00:00.000Z', scheduled_end: '2026-09-27T10:00:00.000Z' }),
    ];
    const attention = visitsNeedingAttention(visits, NOW);
    expect(attention.map((v) => v.status)).toEqual(['missed', 'checked_in']);
  });

  it('includes every kind of exception and excludes ordinary calls', () => {
    const visits = [
      visit({ status: 'missed', scheduled_start: '2026-09-27T09:00:00.000Z', scheduled_end: '2026-09-27T10:00:00.000Z' }),
      visit({ status: 'scheduled', assigned_staff_id: null, scheduled_start: '2026-09-27T16:00:00.000Z', scheduled_end: '2026-09-27T17:00:00.000Z' }),
      visit({ status: 'completed', check_in_at: '2026-09-27T09:45:00.000Z' }),
      visit({ status: 'completed', check_in_at: '2026-09-27T08:58:00.000Z' }),
      visit({ status: 'scheduled', scheduled_start: '2026-09-27T18:00:00.000Z', scheduled_end: '2026-09-27T19:00:00.000Z' }),
    ];
    const attention = visitsNeedingAttention(visits, NOW);
    // Missed, unassigned and 45-minutes-late are exceptions. The on-time
    // completed call and the call not due until 18:00 are not.
    expect(attention).toHaveLength(3);
  });

  it('describes a late call with the minutes, not just the word late', () => {
    const v = visit({ status: 'completed', check_in_at: '2026-09-27T09:23:00.000Z' });
    expect(describeVisit(v, NOW).state).toBe('23 min late');
  });
});
