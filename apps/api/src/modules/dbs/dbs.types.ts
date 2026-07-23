export enum DbsStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  IN_PROGRESS = 'in_progress',
  AWAITING_IDENTITY = 'awaiting_identity',
  CLEAR = 'clear',
  DISCLOSURE = 'disclosure',
  CANCELLED = 'cancelled',
  ERROR = 'error',
}

export enum DbsLevel {
  STANDARD = 'standard',
  ENHANCED = 'enhanced',
  ENHANCED_WITH_BARRED = 'enhanced_with_barred',
}

export enum DbsWorkforce {
  ADULT = 'adult',
  CHILD = 'child',
  BOTH = 'both',
}

export interface DbsCheck {
  id: string;
  organization_id: string;
  staff_id: string;
  staff_name?: string;
  level: DbsLevel;
  workforce: DbsWorkforce;
  status: DbsStatus;
  application_reference?: string;
  provider_reference?: string;
  certificate_number?: string;
  disclosure_date?: string;
  requested_at: string;
  completed_at?: string;
  submitted_at?: string;
  cost_pence?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DbsProviderConfig {
  apiKey?: string;
  apiUrl?: string;
  organisationId?: string;
  username?: string;
  password?: string;
}

export interface DbsSubmitRequest {
  staff_id: string;
  level: DbsLevel;
  workforce: DbsWorkforce;
  cost_pence?: number;
  notes?: string;
}

export interface DbsStats {
  total: number;
  clear: number;
  in_progress: number;
  awaiting_identity: number;
  submitted: number;
  draft: number;
  cancelled: number;
  error: number;
  expiring_soon: number;
  expired: number;
  cost_total_pounds: number;
}
