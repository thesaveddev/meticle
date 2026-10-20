export type UserRole = 'ORG_ADMIN' | 'MANAGER' | 'CARE_WORKER' | 'COMPLIANCE_OFFICER'

export interface MobileUser {
  id: string
  email: string
  role: UserRole
  organizationId?: string | null
  first_name?: string
  last_name?: string
  organization?: { id?: string; name?: string } | null
}

/** The organisation fields the app reads directly from the session payload. */
export interface SessionOrganisation {
  id?: string
  name?: string
  logo_url?: string | null
  service_types?: string[]
  emergency_contact_1_label?: string | null
  emergency_contact_1_phone?: string | null
  emergency_contact_2_label?: string | null
  emergency_contact_2_phone?: string | null
  [key: string]: unknown
}

export interface AuthSession {
  accessToken: string
  refreshToken: string
  user: MobileUser
  organization?: SessionOrganisation | null
}

export interface HomecareVisit {
  id: string
  label: string
  visit_type: string
  status: 'scheduled' | 'en_route' | 'checked_in' | 'completed' | 'missed' | 'cancelled'
  scheduled_start: string
  scheduled_end: string
  person_id?: string
  person_name?: string
  person_address?: string
  person_latitude?: number | null
  person_longitude?: number | null
  package_name?: string
  assigned_staff_id?: string
  assigned_staff_name?: string
  actual_travel_minutes?: number | null
  actual_mileage_miles?: number | null
  mileage_rate_pence?: number | null
  travel_buffer_minutes?: number | null
  check_in_at?: string | null
  check_out_at?: string | null
  visit_notes?: string | null
  photos?: string[]
  requires_two_staff?: boolean
  second_staff_id?: string | null
  second_staff_name?: string | null
}

export type VisitAction = 'check-in' | 'check-out'
export type SyncState = 'pending' | 'syncing' | 'synced' | 'failed'

export interface OfflineVisitAction {
  id: string
  visitId: string
  action: VisitAction
  payload: {
    latitude: number
    longitude: number
    accuracy_meters?: number
    actual_travel_minutes?: number
    actual_mileage_miles?: number
    note?: string
    photos?: string[]
  }
  createdAt: string
  state: SyncState
  error?: string
  /** How many times this action has been sent to the server. */
  attempts?: number
  /**
   * Set when the server rejected the payload itself (a 4xx that will keep
   * failing). Such an action is kept for the record but never retried, so a
   * check-in that can never succeed does not block the queue forever.
   */
  permanent?: boolean
}

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface IncidentReportPayload {
  title: string
  description?: string
  witnesses?: string
  category_id?: string
  severity: IncidentSeverity
  location?: string
  is_near_miss?: boolean
  incident_date: string
  incident_time?: string
  person_ids?: string[]
  visit_id?: string
}

export interface QueuedIncidentReport extends IncidentReportPayload {
  id: string
  createdAt: string
  state: 'pending' | 'failed'
  attempts: number
  ownerId: string
  organizationId: string | null
  nextAttemptAt?: string
  error?: string
  permanent?: boolean
}

export interface AvailabilityRecord {
  id: string
  staff_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_available: boolean
  availability_date?: string | null
}

/* ─── Body Map ───────────────────────────────────────────── */
export interface BodyMapEntry {
  id: string
  person_id: string
  body_view: 'front' | 'back'
  body_zone: string
  zone_x: number | null
  zone_y: number | null
  condition_type: 'bruise' | 'wound' | 'rash' | 'injection' | 'burn' | 'pressure_sore' | 'scar' | 'swelling' | 'skin_tear' | 'other'
  description: string | null
  severity: 'mild' | 'moderate' | 'severe'
  status: 'active' | 'healing' | 'resolved'
  recorded_date: string
  resolved_date: string | null
  image_url: string | null
  recorded_by_name: string | null
  created_at: string
}

export interface BodyMapStats {
  active_count: number
  healing_count: number
  resolved_count: number
  total_count: number
}

/* ─── Nutrition ───────────────────────────────────────────── */
export interface DietaryProfile {
  id: string
  person_id: string
  dietary_type: string | null
  texture_modified: string | null
  vegetarian: boolean
  vegan: boolean
  halal: boolean
  kosher: boolean
  gluten_free: boolean
  dairy_free: boolean
  nut_allergy: boolean
  other_allergies: string | null
  food_preferences: string | null
  food_dislikes: string | null
  fluid_daily_target_ml: number
  appetite_level: 'poor' | 'fair' | 'good' | 'excellent' | null
  eating_abilities: string | null
  additional_notes: string | null
}

export interface MealRecord {
  id: string
  person_id: string
  meal_date: string
  meal_time: string | null
  meal_type: 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'dinner' | 'evening_snack' | 'supplement'
  notes: string | null
  appetite_level: 'poor' | 'fair' | 'good' | 'excellent' | null
  amount_offered: string | null
  amount_consumed: string | null
  consumed_percent: number | null
  refused: boolean
  refusal_reason: string | null
  staff_concerns: string | null
  fluid_ml: number | null
  calories_estimate: number | null
  items?: MealItem[]
  created_at: string
}

export interface MealItem {
  id: string
  meal_id: string
  food_name: string
  portion_size: string | null
  allergens: string | null
  preparation_notes: string | null
}

export interface NutritionSummary {
  total_meals: number
  total_fluid_ml: number
  avg_consumed_percent: number
  meals_refused: number
}

/* ─── Two-person calls ─────────────────────────────────────── */
export interface TeamMember {
  id: string
  user_id: string
  first_name: string | null
  last_name: string | null
  email: string
  role: string
}

/* ─── Supported living: shift handover ──────────────────────── */

/**
 * The supported-living shift handover, as the API returns it (`GET /shifts/:id/handover`).
 *
 * One current handover per shift, amended by keeping every version: `revisions` is
 * newest first and carries the wording a colleague already read, so an amendment
 * cannot quietly rewrite history. `viewer_*` are computed for the signed-in user —
 * the server refuses an author's own acknowledgement, and the screen relies on
 * `viewer_is_author` never offering the button rather than discovering the 400.
 */
export interface ShiftHandoverAcknowledgement {
  id: string
  user_id: string
  staff_id: string | null
  acknowledged_by_name: string
  note: string | null
  acknowledged_at: string
}

export interface ShiftHandover {
  id: string
  shift_id: string
  author_id: string
  author_name: string
  what_happened: string
  outstanding: string | null
  who_is_aware: string | null
  version: number
  recorded_at: string
  created_at: string
  updated_at: string
  acknowledgements: ShiftHandoverAcknowledgement[]
}

export interface ShiftHandoverRevision {
  id: string
  version: number
  author_id: string
  author_name: string
  what_happened: string
  outstanding: string | null
  who_is_aware: string | null
  source: 'online' | 'offline'
  recorded_at: string
  created_at: string
}

export interface ShiftHandoverView {
  handover: ShiftHandover | null
  revisions: ShiftHandoverRevision[]
  viewer_acknowledged: boolean
  viewer_is_author: boolean
}

/** One of the signed-in carer's own shifts, with its handover state. */
export interface MyShift {
  id: string
  location_id: string
  location_name: string
  shift_type: string
  status: string
  start_time: string
  end_time: string
  actual_start_at: string | null
  actual_end_at: string | null
  /** The first time this carer clocked on, across every interval they worked. */
  clocked_on_at?: string | null
  /** The last time this carer clocked off. Null when they are still on duty. */
  clocked_off_at?: string | null
  /** Counted clock-ons exceed clock-offs, so this carer is on duty right now. */
  on_duty?: boolean
  /** The shift has ended and nobody has written its handover. */
  handover_due: boolean
  handover: {
    id: string
    version: number
    author_name: string
    recorded_at: string
    what_happened: string
    acknowledgement_count: number
    viewer_acknowledged: boolean
    viewer_is_author: boolean
  } | null
}

/* ─── Supported living: shift attendance ────────────────────── */

/**
 * One of the people rostered on a shift, with their own duty state.
 *
 * `worked_minutes` counts closed intervals only: an unfinished interval is not
 * evidence of hours worked, so an on-duty row carries the time they have already
 * completed rather than a running total that would move under the reader.
 */
export interface RosteredShiftStaff {
  staff_id: string
  user_id: string
  first_name: string
  last_name: string
  assignment_status: string
  is_overtime: boolean
  /** The row belonging to the signed-in user. */
  is_me: boolean
  clocked_on_at: string | null
  clocked_off_at: string | null
  worked_minutes: number
  on_duty: boolean
}

/** An append-only attendance event: when somebody clocked on or off. */
export interface ShiftAttendanceEvent {
  id: string
  shift_id: string
  event: 'clock_on' | 'clock_off'
  source: 'online' | 'offline'
  staff_id: string | null
  user_id: string
  staff_name: string
  note: string | null
  recorded_at: string
  created_at: string
}

/** `GET /shifts/:id/attendance` — who was rostered, who was on duty, and when. */
export interface ShiftAttendance {
  shift_id: string
  location_id: string
  location_name: string
  status: string
  shift_type: string
  start_time: string
  end_time: string
  actual_start_at: string | null
  actual_end_at: string | null
  /** True when nobody on the shift has clocked on at all. */
  unattended: boolean
  rostered: RosteredShiftStaff[]
  events: ShiftAttendanceEvent[]
}

/**
 * A clock action that could not reach the server, kept on the phone.
 *
 * `action_key` is generated once, when the worker presses the button, and reused by
 * every retry: the API treats it as unique, so the retry is the same clock-on rather
 * than a second one. `recorded_at` is the moment they actually pressed it, because
 * that is the evidence — the server's receipt time is kept separately.
 */
export interface QueuedShiftClockAction {
  key: string
  shiftId: string
  action: 'clock-on' | 'clock-off'
  payload: { note?: string | null; recorded_at: string; action_key: string }
  createdAt: string
}

/* ─── Manager view ─────────────────────────────────────────── */
export interface ManagerVisitSummary {
  total: number
  completed: number
  in_progress: number
  scheduled: number
  missed: number
  unassigned: number
}
