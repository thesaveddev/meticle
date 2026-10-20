/**
 * Shift attendance — the evidence that a support worker was on duty.
 *
 * A shift could be scheduled, claimed and approved with no record that anybody
 * turned up, so overtime and the 11-hour rest rule rested on manager inference
 * (mobile blueprint §9.1). This records the two facts that were missing: when
 * the worker clocked on and when they clocked off.
 *
 * Four decisions are worth stating because they are what makes the record
 * survivable rather than merely present:
 *
 *  * The event log is append-only and the pairing is counted, not ordered.
 *    A worker steps out and returns mid-shift, and an offline phone replays a
 *    queued clock-on after a later action has already landed, so "is this
 *    person on duty?" is answered by comparing how many clock-ons they have
 *    with how many clock-offs — a question whose answer does not depend on
 *    arrival order.
 *  * The shift row is locked for the duration of a clock action, so the counts
 *    cannot both pass in two concurrent requests and leave a worker with an
 *    open interval they never closed.
 *  * Attendance belongs to the worker who is rostered, not to the manager who
 *    can edit the rota. A manager reads it; only the person on the shift
 *    records it. That is the same duty-without-ownership shape the audit
 *    praised for tasks and room checks.
 *  * The time recorded is the device's when the action was queued offline and
 *    the server's when it is not, and both are kept, so the two are
 *    reconcilable at inspection (§11).
 */
import { query, transaction } from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';
import type {
  RosteredShiftStaff,
  ShiftAttendance,
  ShiftAttendanceEvent,
  ShiftAttendanceInput,
  ShiftAttendanceSource,
} from './shiftAttendance.types';

/** A device clock can run slightly fast; anything further ahead is not credible. */
const MAX_FUTURE_SKEW_MS = 15 * 60 * 1000;

/** Assignment states that mean the person is on the rota. A pending claim is not. */
const ON_DUTY_ASSIGNMENT_STATUSES = ['assigned', 'accepted'];

/** Anything that can run a query: the request-scoped client, or a transaction's. */
type Queryable = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> };

/**
 * The timestamp an action is recorded at: the device's when an offline queue
 * replayed it, the server's otherwise. A device clock in the future is refused
 * rather than clamped — a shift that ends before it starts is worse evidence
 * than no record, and the queue can send the action again with a corrected time.
 */
export function resolveRecordedAt(recordedAt?: string | null): Date {
  if (!recordedAt) return new Date();
  const at = new Date(recordedAt);
  if (Number.isNaN(at.getTime())) throw new AppError(400, 'Recorded time is not a valid datetime');
  if (at.getTime() > Date.now() + MAX_FUTURE_SKEW_MS) {
    throw new AppError(400, 'Recorded time cannot be in the future');
  }
  return at;
}

interface ClockArgs {
  orgId: string;
  userId: string;
  staffId: string;
  shiftId: string;
  input: ShiftAttendanceInput;
  source: ShiftAttendanceSource;
}

export class ShiftAttendanceRepository {
  /** The shift, scoped to the tenant. Null when it is not this organisation's. */
  static async getShiftForAttendance(orgId: string, shiftId: string) {
    const result = await query(
      `SELECT s.id, s.status, s.shift_type, s.start_time, s.end_time,
              s.actual_start_at, s.actual_end_at,
              l.id AS location_id, l.name AS location_name
       FROM shifts s
       JOIN locations l ON l.id = s.location_id
       WHERE s.id = $1 AND l.organization_id = $2`,
      [shiftId, orgId]
    );
    return result.rows[0] || null;
  }

  /**
   * Refuse attendance to anyone who is not rostered on the shift. An unapproved
   * claim is not a duty, and a manager who can edit the rota is still not the
   * person whose attendance this is.
   */
  static async requireRosteredStaff(orgId: string, shiftId: string, staffId: string) {
    const result = await query(
      `SELECT sa.id, sa.status
       FROM shift_assignments sa
       JOIN shifts s ON s.id = sa.shift_id
       JOIN locations l ON l.id = s.location_id
       WHERE sa.shift_id = $1 AND sa.staff_id = $2 AND l.organization_id = $3`,
      [shiftId, staffId, orgId]
    );
    const assignment = result.rows[0];
    if (!assignment) throw new AppError(403, 'Only a staff member rostered on this shift can record attendance');
    if (assignment.status === 'rejected') {
      throw new AppError(403, 'You are no longer rostered on this shift');
    }
    if (!ON_DUTY_ASSIGNMENT_STATUSES.includes(assignment.status)) {
      throw new AppError(403, 'Your place on this shift has not been approved yet');
    }
  }

  /**
   * How many clock-ons and clock-offs this worker has on this shift. The
   * difference is whether they are on duty, and it is order-independent, which
   * is what an out-of-order offline replay requires.
   */
  static async countEvents(db: Queryable, orgId: string, shiftId: string, userId: string) {
    const result = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE event = 'clock_on')::int AS clock_ons,
         COUNT(*) FILTER (WHERE event = 'clock_off')::int AS clock_offs
       FROM shift_attendance_events
       WHERE shift_id = $1 AND user_id = $2 AND organization_id = $3`,
      [shiftId, userId, orgId]
    );
    return result.rows[0] as { clock_ons: number; clock_offs: number };
  }

  static async clockOn(args: ClockArgs) {
    return this.record(args, 'clock_on');
  }

  static async clockOff(args: ClockArgs) {
    return this.record(args, 'clock_off');
  }

  private static async record(args: ClockArgs, event: 'clock_on' | 'clock_off') {
    const recordedAt = resolveRecordedAt(args.input.recorded_at);
    const at = recordedAt.toISOString();
    return transaction(async (client) => {
      // Lock the shift so two concurrent clock actions cannot both read the same
      // counts and both insert — a retry and a double tap are exactly how that
      // would otherwise happen.
      const locked = await client.query('SELECT id, status FROM shifts WHERE id = $1 FOR UPDATE', [args.shiftId]);
      if (!locked.rows[0]) throw new AppError(404, 'Shift not found');
      if (locked.rows[0].status === 'cancelled') {
        throw new AppError(400, 'Attendance cannot be recorded on a cancelled shift');
      }

      const counts = await this.countEvents(client, args.orgId, args.shiftId, args.userId);
      if (event === 'clock_on' && counts.clock_ons > counts.clock_offs) {
        throw new AppError(409, 'You are already clocked on to this shift');
      }
      if (event === 'clock_off' && counts.clock_ons <= counts.clock_offs) {
        throw new AppError(409, 'You are not clocked on to this shift');
      }

      const inserted = await client.query(
        `INSERT INTO shift_attendance_events
           (organization_id, shift_id, staff_id, user_id, event, source, recorded_at, note, latitude, longitude, accuracy_meters)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [
          args.orgId, args.shiftId, args.staffId, args.userId, event, args.source, at,
          args.input.note || null, args.input.latitude ?? null, args.input.longitude ?? null,
          args.input.accuracy_meters ?? null,
        ]
      );

      // The shift's own columns are the rolled-up summary: earliest clock-on and
      // latest clock-off across everyone rostered, so the rota and any report
      // reading a shift alone see attendance without walking the event log.
      const updated = event === 'clock_on'
        ? await client.query(
          `UPDATE shifts
              SET actual_start_at = LEAST(COALESCE(actual_start_at, $2::timestamptz), $2::timestamptz),
                  clocked_on_by = COALESCE(clocked_on_by, $3::uuid)
            WHERE id = $1
          RETURNING actual_start_at, actual_end_at`,
          [args.shiftId, at, args.userId]
        )
        : await client.query(
          `UPDATE shifts
              SET actual_end_at = GREATEST(COALESCE(actual_end_at, $2::timestamptz), $2::timestamptz),
                  clocked_off_by = $3::uuid
            WHERE id = $1
          RETURNING actual_start_at, actual_end_at`,
          [args.shiftId, at, args.userId]
        );

      return { event: inserted.rows[0] as ShiftAttendanceEvent, shift: updated.rows[0] };
    });
  }

  /**
   * The shift's attendance record, or null when the shift is another tenant's.
   * `viewerId` marks which roster row is the caller's, so a client does not have
   * to know the signed-in user's staff id to show them their own clock button.
   */
  static async getAttendance(orgId: string, shiftId: string, viewerId?: string): Promise<ShiftAttendance | null> {
    const shift = await this.getShiftForAttendance(orgId, shiftId);
    if (!shift) return null;

    const rostered = await query(
      `SELECT sa.staff_id, sa.status AS assignment_status, sa.is_overtime,
              sp.first_name, sp.last_name, sp.user_id
       FROM shift_assignments sa
       JOIN staff_profiles sp ON sp.id = sa.staff_id
       WHERE sa.shift_id = $1 AND sa.status <> 'rejected'
       ORDER BY sp.first_name, sp.last_name`,
      [shiftId]
    );

    const events = await query(
      `SELECT e.id, e.shift_id, e.event, e.source, e.staff_id, e.user_id, e.note, e.recorded_at, e.created_at,
              COALESCE(NULLIF(TRIM(sp.first_name || ' ' || sp.last_name), ''), u.email, 'Former user') AS staff_name
       FROM shift_attendance_events e
       LEFT JOIN staff_profiles sp ON sp.id = e.staff_id
       LEFT JOIN users u ON u.id = e.user_id
       WHERE e.shift_id = $1 AND e.organization_id = $2
       ORDER BY e.recorded_at, e.created_at`,
      [shiftId, orgId]
    );

    const byUser = new Map<string, ShiftAttendanceEvent[]>();
    for (const item of events.rows as ShiftAttendanceEvent[]) {
      const list = byUser.get(item.user_id) || [];
      list.push(item);
      byUser.set(item.user_id, list);
    }

    const rosteredStaff: RosteredShiftStaff[] = rostered.rows.map((row: any) => ({
      staff_id: row.staff_id,
      user_id: row.user_id,
      first_name: row.first_name,
      last_name: row.last_name,
      assignment_status: row.assignment_status,
      is_overtime: row.is_overtime === true,
      is_me: !!viewerId && row.user_id === viewerId,
      ...summariseDuty(byUser.get(row.user_id) || []),
    }));

    return {
      shift_id: shift.id,
      location_id: shift.location_id,
      location_name: shift.location_name,
      status: shift.status,
      shift_type: shift.shift_type,
      start_time: shift.start_time,
      end_time: shift.end_time,
      actual_start_at: shift.actual_start_at,
      actual_end_at: shift.actual_end_at,
      unattended: !events.rows.some((e: any) => e.event === 'clock_on'),
      rostered: rosteredStaff,
      events: events.rows,
    };
  }
}

/**
 * Pair each clock-on with the clock-off after it. A worker who steps out and
 * returns has two intervals; an open one is reported as `on_duty` with the
 * minutes of the closed intervals only, because counting an unfinished interval
 * as worked time would print a number that is not evidence of anything.
 */
export function summariseDuty(events: ShiftAttendanceEvent[]): {
  clocked_on_at: string | null;
  clocked_off_at: string | null;
  worked_minutes: number;
  on_duty: boolean;
} {
  const pending: string[] = [];
  let worked = 0;
  let firstOn: string | null = null;
  let lastOff: string | null = null;

  for (const item of events) {
    if (item.event === 'clock_on') {
      pending.push(item.recorded_at);
      if (!firstOn) firstOn = item.recorded_at;
      continue;
    }
    const on = pending.shift();
    if (!on) continue;
    worked += Math.max(0, Math.round((new Date(item.recorded_at).getTime() - new Date(on).getTime()) / 60000));
    lastOff = item.recorded_at;
  }

  return {
    clocked_on_at: firstOn,
    clocked_off_at: lastOff,
    worked_minutes: worked,
    on_duty: pending.length > 0,
  };
}
