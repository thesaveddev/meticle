import { publishDomainEvent } from '../events/events.outbox';

export interface StaffingCoveragePayload {
  coverage_percent: number;
  required_coverage_percent: number;
  shifts_with_target: number;
  below_minimum_shifts: number;
  unstaffed_shifts: number;
  staffing_shortfall: number;
  affected_shifts: Array<Record<string, unknown>>;
}

/** Publish the organization-wide, seven-day staffing coverage state. */
export async function publishStaffingCoverageEvent(args: {
  organizationId: string;
  recovered: boolean;
  payload: StaffingCoveragePayload;
}): Promise<{ id: string }> {
  return publishDomainEvent({
    organizationId: args.organizationId,
    eventName: args.recovered ? 'staffing.coverage_recovered' : 'staffing.coverage_low',
    aggregateType: 'staffing_coverage',
    aggregateId: args.organizationId,
    payload: args.payload as unknown as Record<string, unknown>,
  });
}

export interface ShiftUnfilledPayload {
  shift_id: string;
  location_id: string;
  location_name: string;
  start_time: string;
  end_time: string;
  shift_type: string;
  hours_until_start: number;
}

/**
 * Publish `shift.unfilled` when a shift is approaching its start time and
 * has no staff assigned.
 */
export async function publishShiftUnfilledEvent(args: {
  organizationId: string;
  shiftId: string;
  locationId: string;
  locationName: string;
  startTime: string;
  endTime: string;
  shiftType: string;
  hoursUntilStart: number;
}): Promise<{ id: string }> {
  const payload: ShiftUnfilledPayload = {
    shift_id: args.shiftId,
    location_id: args.locationId,
    location_name: args.locationName,
    start_time: args.startTime,
    end_time: args.endTime,
    shift_type: args.shiftType,
    hours_until_start: args.hoursUntilStart,
  };

  return publishDomainEvent({
    organizationId: args.organizationId,
    eventName: 'shift.unfilled',
    aggregateType: 'shift',
    aggregateId: args.shiftId,
    payload: payload as unknown as Record<string, unknown>,
  });
}

export interface ShiftHandoverRecordedPayload {
  shift_id: string;
  handover_id: string;
  version: number;
  author_id: string;
  location_id: string;
  location_name: string;
  recorded_at: string;
  amended: boolean;
  /** The ISO day the rota grid opens on, which is how a link finds the shift. */
  week: string;
}

/**
 * Publish `shift.handover_recorded` when the outgoing worker records or amends
 * the handover for their shift. The event carries the shift and the week rather
 * than only ids, because the notification that follows it has to open the same
 * record the rota grid does.
 */
export async function publishShiftHandoverRecordedEvent(args: {
  organizationId: string;
  shiftId: string;
  handoverId: string;
  version: number;
  authorId: string;
  locationId: string;
  locationName: string;
  recordedAt: string;
  amended: boolean;
  week: string;
}): Promise<{ id: string }> {
  const payload: ShiftHandoverRecordedPayload = {
    shift_id: args.shiftId,
    handover_id: args.handoverId,
    version: args.version,
    author_id: args.authorId,
    location_id: args.locationId,
    location_name: args.locationName,
    recorded_at: args.recordedAt,
    amended: args.amended,
    week: args.week,
  };
  return publishDomainEvent({
    organizationId: args.organizationId,
    eventName: 'shift.handover_recorded',
    aggregateType: 'shift_handover',
    aggregateId: args.handoverId,
    payload: payload as unknown as Record<string, unknown>,
  });
}

export interface ShiftHandoverAcknowledgedPayload {
  shift_id: string;
  handover_id: string;
  version: number;
  author_id: string;
  acknowledged_by_user_id: string;
  acknowledged_by_name: string;
  location_name: string;
  acknowledged_at: string;
  week: string;
}

/**
 * Publish `shift.handover_acknowledged` when a named staff member confirms they
 * have read a handover. This is the event blueprint §10 routes to the outgoing
 * support worker — the person who handed over is the one who needs to know it
 * landed, and nothing else tells them.
 */
export async function publishShiftHandoverAcknowledgedEvent(args: {
  organizationId: string;
  shiftId: string;
  handoverId: string;
  version: number;
  authorId: string;
  acknowledgedByUserId: string;
  acknowledgedByName: string;
  locationName: string;
  acknowledgedAt: string;
  week: string;
}): Promise<{ id: string }> {
  const payload: ShiftHandoverAcknowledgedPayload = {
    shift_id: args.shiftId,
    handover_id: args.handoverId,
    version: args.version,
    author_id: args.authorId,
    acknowledged_by_user_id: args.acknowledgedByUserId,
    acknowledged_by_name: args.acknowledgedByName,
    location_name: args.locationName,
    acknowledged_at: args.acknowledgedAt,
    week: args.week,
  };
  return publishDomainEvent({
    organizationId: args.organizationId,
    eventName: 'shift.handover_acknowledged',
    aggregateType: 'shift_handover',
    aggregateId: args.handoverId,
    payload: payload as unknown as Record<string, unknown>,
  });
}

export interface ShiftHandoverDueRecipient {
  user_id: string;
  /** The name as the rota knows it, so the notification does not need a second read. */
  name: string;
}

export interface ShiftHandoverDuePayload {
  shift_id: string;
  location_id: string;
  location_name: string;
  shift_type: string;
  start_time: string;
  end_time: string;
  /** The ISO day the rota grid opens on, which is how the link finds the shift. */
  week: string;
  /** Minutes since the rota's end time, so a reader can see how late the nudge is. */
  minutes_since_end: number;
  /**
   * The staff who could write the handover: everyone on the shift whose place was
   * not rejected.
   *
   * The recipients travel with the event because the sweep that raises it already
   * read the roster to decide the shift had anybody on it at all. A consumer that
   * looked them up again would read the roster a second time, and would be reading
   * it after the shift could have changed — the event says who was owed the nudge
   * at the moment it was raised, which is the fact.
   */
  rostered: ShiftHandoverDueRecipient[];
}

/**
 * Publish `shift.handover_due` for a shift that ended with no handover recorded.
 *
 * Raised by the sweep in `shiftHandoverDue.ts`, never by a request: nothing a
 * person does makes this true, the clock does. The notification that follows it
 * (§10) goes to the staff on the shift, because the handover is theirs to write —
 * and Mission Control keeps the manager-facing copy, because a shift whose
 * responsibility was never transferred is a compliance gap and not only an
 * unfinished note.
 */
export async function publishShiftHandoverDueEvent(args: {
  organizationId: string;
  shiftId: string;
  locationId: string;
  locationName: string;
  shiftType: string;
  startTime: string;
  endTime: string;
  week: string;
  minutesSinceEnd: number;
  rostered: ShiftHandoverDueRecipient[];
}): Promise<{ id: string }> {
  const payload: ShiftHandoverDuePayload = {
    shift_id: args.shiftId,
    location_id: args.locationId,
    location_name: args.locationName,
    shift_type: args.shiftType,
    start_time: args.startTime,
    end_time: args.endTime,
    week: args.week,
    minutes_since_end: args.minutesSinceEnd,
    rostered: args.rostered,
  };
  return publishDomainEvent({
    organizationId: args.organizationId,
    eventName: 'shift.handover_due',
    aggregateType: 'shift',
    aggregateId: args.shiftId,
    payload: payload as unknown as Record<string, unknown>,
  });
}

export interface ShiftUnderstaffedPayload {
  shift_id: string;
  location_id: string;
  location_name: string;
  start_time: string;
  shift_type: string;
  assigned_staff: number;
  minimum_staff: number;
  shortfall: number;
}

/**
 * Publish `shift.understaffed` when a shift has some staff but fewer than
 * the location's minimum_staff_per_day requirement.
 */
export async function publishShiftUnderstaffedEvent(args: {
  organizationId: string;
  shiftId: string;
  locationId: string;
  locationName: string;
  startTime: string;
  shiftType: string;
  assignedStaff: number;
  minimumStaff: number;
}): Promise<{ id: string }> {
  const payload: ShiftUnderstaffedPayload = {
    shift_id: args.shiftId,
    location_id: args.locationId,
    location_name: args.locationName,
    start_time: args.startTime,
    shift_type: args.shiftType,
    assigned_staff: args.assignedStaff,
    minimum_staff: args.minimumStaff,
    shortfall: args.minimumStaff - args.assignedStaff,
  };

  return publishDomainEvent({
    organizationId: args.organizationId,
    eventName: 'shift.understaffed',
    aggregateType: 'shift',
    aggregateId: args.shiftId,
    payload: payload as unknown as Record<string, unknown>,
  });
}