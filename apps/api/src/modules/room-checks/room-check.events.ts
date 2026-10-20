import crypto from 'crypto';
import { publishDomainEvent } from '../events/events.outbox';

/** Who on the rota is owed the nudge about a room. */
export interface RoomCheckRecipient {
  user_id: string;
  name: string;
}

export interface RoomCheckOverduePayload {
  location_id: string;
  location_name: string;
  room_number: string;
  /** The provider's own day the check was expected on (`YYYY-MM-DD`). */
  check_date: string;
  /** The local hour after which a room without a check counts as overdue. */
  due_hour: number;
  /** The staff rostered at that location today — the people who can record it. */
  rostered: RoomCheckRecipient[];
}

/**
 * Publish `room_check.overdue` for one room on one day.
 *
 * The aggregate id is the room's key for the day (`location:date:room`) rather than
 * a `room_checks` row, because the state being reported is the *absence* of a row:
 * there is no record to point at, and Mission Control de-duplicates on exactly this
 * key so one empty room produces one alert, not one per sweep.
 */
export async function publishRoomCheckOverdueEvent(args: {
  organizationId: string;
  locationId: string;
  locationName: string;
  roomNumber: string;
  checkDate: string;
  dueHour: number;
  rostered: RoomCheckRecipient[];
}): Promise<{ id: string }> {
  const payload: RoomCheckOverduePayload = {
    location_id: args.locationId,
    location_name: args.locationName,
    room_number: args.roomNumber,
    check_date: args.checkDate,
    due_hour: args.dueHour,
    rostered: args.rostered,
  };

  return publishDomainEvent({
    organizationId: args.organizationId,
    eventName: 'room_check.overdue',
    aggregateType: 'room_check',
    aggregateId: roomCheckAggregateId(args.locationId, args.checkDate, args.roomNumber),
    payload: payload as unknown as Record<string, unknown>,
  });
}

/**
 * The stable id for "this room, on this day".
 *
 * `domain_events.aggregate_id` is a UUID, so the natural key (location, day, room)
 * is hashed into one rather than stored as text. The hash is deterministic, which is
 * what makes the id usable as a de-duplication key: Mission Control upserts on
 * (organization, alert_type, aggregate_id), so one empty room produces one alert on
 * the day it went unchecked, and a second sweep updates that row instead of adding
 * another. A random id per run would defeat exactly that.
 *
 * The UUID's version and variant bits are set so the value is a well-formed v5-style
 * id rather than an arbitrary 128-bit string.
 */
export function roomCheckAggregateId(locationId: string, checkDate: string, roomNumber: string): string {
  const digest = crypto.createHash('sha256')
    .update(`${locationId}:${checkDate}:${roomNumber}`)
    .digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The nudge ledger's own key — the same three facts, in the table's own columns. */
export function roomCheckNudgeKey(locationId: string, checkDate: string, roomNumber: string): string {
  return `${locationId}:${checkDate}:${roomNumber}`;
}
