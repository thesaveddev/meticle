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
  person_name?: string
  person_address?: string
  package_name?: string
  assigned_staff_name?: string
  actual_travel_minutes?: number | null
  actual_mileage_miles?: number | null
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
