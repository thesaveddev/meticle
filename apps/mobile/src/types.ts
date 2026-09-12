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

export interface AuthSession {
  accessToken: string
  refreshToken: string
  user: MobileUser
  organization?: Record<string, unknown> | null
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
  package_name?: string
  assigned_staff_name?: string
  actual_travel_minutes?: number | null
  actual_mileage_miles?: number | null
  mileage_rate_pence?: number | null
  travel_buffer_minutes?: number | null
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
}

export interface AvailabilityRecord {
  id: string
  staff_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_available: boolean
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

/* ─── Manager view ─────────────────────────────────────────── */
export interface ManagerVisitSummary {
  total: number
  completed: number
  in_progress: number
  scheduled: number
  missed: number
  unassigned: number
}
