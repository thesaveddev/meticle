import { publishDomainEvent } from '../events/events.outbox';

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