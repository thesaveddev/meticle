/**
 * Types for shift attendance and shift handover (mobile blueprint §9.1/§9.2).
 *
 * The offline input shapes carry `action_key` and `recorded_at` for the same
 * reason the visit ones do: a phone with no signal has to be able to send an
 * action later and have the server recognise it as the same action, and the
 * time the worker actually did it has to survive the trip.
 */

export type ShiftOfflineActionType = 'clock-on' | 'clock-off' | 'handover';

export type ShiftAttendanceEventName = 'clock_on' | 'clock_off';

export type ShiftAttendanceSource = 'online' | 'offline';

export interface ShiftAttendanceInput {
  note?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracy_meters?: number | null;
  /** When the worker actually clocked on/off. Only sent by an offline queue. */
  recorded_at?: string | null;
  /** Idempotency key for the offline contract. */
  action_key?: string | null;
}

export interface ShiftHandoverInput {
  what_happened: string;
  outstanding?: string | null;
  who_is_aware?: string | null;
  recorded_at?: string | null;
  action_key?: string | null;
}

export interface ShiftAttendanceEvent {
  id: string;
  shift_id: string;
  event: ShiftAttendanceEventName;
  source: ShiftAttendanceSource;
  staff_id: string | null;
  user_id: string;
  staff_name: string;
  note: string | null;
  recorded_at: string;
  created_at: string;
}

export interface RosteredShiftStaff {
  staff_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  assignment_status: string;
  is_overtime: boolean;
  /** True on the row belonging to the signed-in user. */
  is_me: boolean;
  clocked_on_at: string | null;
  clocked_off_at: string | null;
  worked_minutes: number;
  on_duty: boolean;
}

export interface ShiftAttendance {
  shift_id: string;
  location_id: string;
  location_name: string;
  status: string;
  shift_type: string;
  start_time: string;
  end_time: string;
  actual_start_at: string | null;
  actual_end_at: string | null;
  /** True when nobody on the shift has clocked on at all. */
  unattended: boolean;
  rostered: RosteredShiftStaff[];
  events: ShiftAttendanceEvent[];
}

export interface ShiftHandoverAcknowledgement {
  id: string;
  user_id: string;
  staff_id: string | null;
  acknowledged_by_name: string;
  note: string | null;
  acknowledged_at: string;
}

export interface ShiftHandover {
  id: string;
  shift_id: string;
  author_id: string;
  author_name: string;
  what_happened: string;
  outstanding: string | null;
  who_is_aware: string | null;
  version: number;
  recorded_at: string;
  created_at: string;
  updated_at: string;
  acknowledgements: ShiftHandoverAcknowledgement[];
}

export interface ShiftHandoverRevision {
  id: string;
  version: number;
  author_id: string;
  author_name: string;
  what_happened: string;
  outstanding: string | null;
  who_is_aware: string | null;
  source: ShiftAttendanceSource;
  recorded_at: string;
  created_at: string;
}

export interface ShiftHandoverView {
  handover: ShiftHandover | null;
  revisions: ShiftHandoverRevision[];
  viewer_acknowledged: boolean;
  /** True when the signed-in user wrote the current wording. */
  viewer_is_author: boolean;
}
