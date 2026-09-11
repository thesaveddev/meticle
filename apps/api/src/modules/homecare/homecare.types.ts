export type HomecarePackageStatus = 'draft' | 'active' | 'paused' | 'ended';
export type HomecareFundingType = 'private' | 'local_authority' | 'nhs' | 'other';
export type HomecareVisitType = 'morning' | 'breakfast' | 'lunch' | 'tea' | 'evening' | 'night' | 'routine' | 'medication' | 'custom';
export type HomecareVisitStatus = 'scheduled' | 'en_route' | 'checked_in' | 'completed' | 'missed' | 'cancelled';
export type HomecareTimesheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
export type HomecareExceptionType = 'late' | 'missed' | 'cancelled' | 'no_show' | 'other';
export type HomecareDisruptionType = 'traffic' | 'public_transport' | 'weather' | 'vehicle' | 'client_unavailable' | 'unsafe' | 'other';
export type HomecareDisruptionSeverity = 'low' | 'medium' | 'high';
export type HomecareMileageVehicle = 'car' | 'motorcycle' | 'bicycle' | 'public_transport' | 'other';
export type HomecareMileageFuel = 'petrol' | 'diesel' | 'hybrid' | 'electric' | 'lpg' | 'not_applicable' | 'other';
export type HomecarePayrollProvider = 'sage' | 'xero' | 'quickbooks' | 'brightpay' | 'staffology' | 'generic_csv';
export type HomecareFollowupType = 'communication' | 'incident';
export type HomecareFollowupOutcome = 'recorded' | 'attempted' | 'completed' | 'no_answer' | 'escalated';

export interface HomecarePackageInput {
  person_id: string;
  name: string;
  status?: HomecarePackageStatus;
  funding_type?: HomecareFundingType;
  start_date: string;
  end_date?: string | null;
  weekly_hours?: number | null;
  hourly_rate_pence?: number | null;
  client_rate_pence?: number | null;
  travel_time_paid?: boolean;
  mileage_rate_pence?: number | null;
  notes?: string | null;
}

export interface HomecareVisitPlanInput {
  package_id: string;
  visit_type: HomecareVisitType;
  label: string;
  days_of_week: number[];
  start_time: string;
  duration_minutes: number;
  travel_buffer_minutes?: number;
  required_skills?: string[];
  default_staff_id?: string | null;
}

export interface HomecareVisitInput {
  package_id: string;
  visit_plan_id?: string | null;
  person_id: string;
  assigned_staff_id?: string | null;
  visit_type: HomecareVisitType;
  label: string;
  scheduled_start: string;
  scheduled_end: string;
}

export interface HomecareVisitUpdateInput {
  assigned_staff_id?: string | null;
  status?: HomecareVisitStatus;
  actual_travel_minutes?: number | null;
  actual_mileage_miles?: number | null;
  mileage_status?: 'not_submitted' | 'submitted' | 'approved' | 'rejected';
  late_reason?: string | null;
  visit_notes?: string | null;
}

export interface VisitExecutionInput {
  latitude: number;
  longitude: number;
  accuracy_meters?: number;
  actual_travel_minutes?: number;
  actual_mileage_miles?: number;
  note?: string;
  action_key?: string;
}

export interface HomecareTimesheetUpdateInput {
  work_minutes?: number;
  travel_minutes?: number;
  paid_travel_minutes?: number;
  mileage_miles?: number;
  mileage_rate_pence?: number | null;
  hourly_rate_pence?: number | null;
  gross_pay_pence?: number | null;
  status?: HomecareTimesheetStatus;
  rejection_reason?: string | null;
}

export interface HomecareExceptionInput {
  exception_type: HomecareExceptionType;
  resolution_note?: string | null;
}

export interface PayrollExportFilters {
  from: string;
  to: string;
  provider?: HomecarePayrollProvider;
}

export interface HomecareAvailabilityInput {
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available?: boolean;
}

export interface HomecareDisruptionInput {
  disruption_type: HomecareDisruptionType;
  severity?: HomecareDisruptionSeverity;
  delay_minutes?: number;
  description: string;
  expected_arrival?: string | null;
}

export interface HomecareMileagePolicyInput {
  tax_year: string;
  vehicle_type: HomecareMileageVehicle;
  fuel_category: HomecareMileageFuel;
  rate_pence: number;
  effective_from?: string | null;
  effective_to?: string | null;
  source_label?: string | null;
  is_active?: boolean;
}

export interface HomecareReconciliationInput {
  status: 'matched' | 'exception' | 'ignored';
  external_reference?: string | null;
  reconciled_gross_pay_pence?: number | null;
  note?: string | null;
}

export interface HomecareFollowupInput {
  followup_type: HomecareFollowupType;
  channel?: string | null;
  recipient?: string | null;
  outcome?: HomecareFollowupOutcome;
  notes: string;
  incident_id?: string | null;
}
