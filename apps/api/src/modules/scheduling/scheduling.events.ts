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