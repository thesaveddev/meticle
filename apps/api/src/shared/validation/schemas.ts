import { z } from 'zod';
import { isDisposableEmail } from '../utils/disposableEmail';

// Coerce empty strings to null for optional string fields (e.g. cleared form inputs)
const emptyToNull = (schema: z.ZodTypeAny) => z.preprocess(v => (v === '' ? null : v), schema.nullable().optional());

// === Auth ===
export const registerSchema = z.object({
  email: z.string().email().refine(v => !isDisposableEmail(v), 'Temporary email addresses are not allowed'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  role: z.enum(['CARE_WORKER', 'ORG_ADMIN'], { errorMap: () => ({ message: 'Role must be CARE_WORKER or ORG_ADMIN' }) }),
  name: z.string().min(1),
  organizationId: z.string().uuid().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const sendEmailCodeSchema = z.object({
  email: z.string().email().refine(v => !isDisposableEmail(v), 'Temporary email addresses are not allowed'),
});

export const verifyEmailCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, 'Code must be 6 digits'),
});

export const mfaVerifyLoginSchema = z.object({
  mfaToken: z.string().min(1),
  token: z.string().min(1),
});

export const mfaSendBackupCodesSchema = z.object({
  mfaToken: z.string().min(1),
});

// === AI ===
export const updateAIConfigSchema = z.object({
  enabled: z.boolean().optional(),
  provider: z.enum(['openai', 'anthropic']).optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  enabledFeatures: z.array(z.string()).optional(),
});

export const aiAnalysisRequestSchema = z.object({
  orgName: z.string().optional(),
  regulator: z.string().optional(),
  overallRate: z.number().optional(),
  domainScores: z.string().optional(),
  keyIssues: z.string().optional(),
});

export const aiRotaAnalysisSchema = z.object({
  weekRange: z.string(),
  locationName: z.string(),
  locationId: z.string().optional(),
  minStaffPerDay: z.number().optional(),
  minDayStaff: z.number().optional(),
  minNightStaff: z.number().optional(),
  minSleepStaff: z.number().optional(),
  staffRoster: z.string(),
  shifts: z.string(),
  openShifts: z.string(),
  staffCompliance: z.string(),
  overtimeHours: z.string(),
});

export const aiRotaGenerateSchema = z.object({
  generatePeriod: z.string(),
  locationName: z.string(),
  minStaffPerDay: z.string(),
  minDayStaff: z.string().optional(),
  minNightStaff: z.string().optional(),
  minSleepStaff: z.string().optional(),
  staffRoster: z.string(),
  existingShifts: z.string(),
  staffOnLeave: z.string(),
  people: z.string(),
  contractedHours: z.string(),
  mandatoryStartTimes: z.string().optional(),
  minEndTime: z.string().optional(),
  allSameEnd: z.string().optional(),
});

export const aiDailyNoteGenerateSchema = z.object({
  personId: z.string().uuid(),
  staffInput: z.string().min(1, 'Staff observation is required'),
  shift: z.enum(['day', 'night']).optional().default('day'),
  noteDate: z.string().optional(),
});

export const aiDailyNoteApproveSchema = z.object({
  personId: z.string().uuid(),
  dailyNote: z.object({
    content: z.string(),
    shift: z.enum(['day', 'night']),
    category: z.string(),
    support_level: z.string().optional(),
  }),
  moodAnalysis: z.object({
    mood_score: z.number().min(1).max(10),
    mood_label: z.string(),
    indicators: z.array(z.string()).optional(),
    compared_to_baseline: z.enum(['improved', 'stable', 'declined', 'unknown']).optional(),
  }).optional(),
  safeguardingFlags: z.array(z.object({
    concern_type: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    description: z.string(),
    action_required: z.string(),
    reference_regulation: z.string().optional(),
  })).optional(),
  carePlanUpdates: z.array(z.object({
    goal_area: z.string(),
    suggested_update: z.string(),
    evidence: z.string(),
    priority: z.enum(['low', 'medium', 'high']),
  })).optional(),
  interventionsSuggested: z.array(z.object({
    intervention: z.string(),
    reason: z.string(),
    expected_outcome: z.string(),
  })).optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).optional(),
  followUpRequired: z.boolean().optional(),
  followUpDetails: z.string().optional(),
  linkedGoalId: z.string().uuid().optional(),
  noteDate: z.string().optional(),
});

export const mfaCompleteSetupSchema = z.object({
  setupToken: z.string().min(1),
  token: z.string().min(1),
});

export const registerWithInvitationSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1),
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

// === MFA ===
export const mfaSetupSchema = z.object({
  password: z.string().optional(),
});

export const mfaVerifySchema = z.object({
  token: z.string().min(1),
});

export const mfaDisableSchema = z.object({}).passthrough();

export const mfaAdminDisableSchema = z.object({}).passthrough();

// === Organizations ===
export const createOrganizationSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(255),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: z.string().optional(),
  plan: z.string().optional(),
  regulator: z.string().optional(),
  onboarding_step: z.number().int().min(0).optional(),
  onboarding_completed: z.boolean().optional(),
  auto_approve_documents: z.boolean().optional(),
});

export const createLocationSchema = z.object({
  name: z.string().min(1, 'Location name is required').max(255),
  address: z.string().optional(),
  manager_id: z.string().uuid().nullable().optional(),
  minimum_staff_per_day: z.number().int().min(0).optional(),
  min_day_staff: z.number().int().min(0).optional(),
  min_night_staff: z.number().int().min(0).optional(),
  min_sleep_staff: z.number().int().min(0).optional(),
});

export const updateLocationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  address: z.string().optional(),
  manager_id: z.string().uuid().nullable().optional(),
  minimum_staff_per_day: z.number().int().min(0).optional(),
  min_day_staff: z.number().int().min(0).optional(),
  min_night_staff: z.number().int().min(0).optional(),
  min_sleep_staff: z.number().int().min(0).optional(),
});

export const createDepartmentSchema = z.object({
  name: z.string().min(1, 'Department name is required').max(255),
  location_id: z.string().uuid(),
  member_ids: z.array(z.string().uuid()).optional(),
});

export const updateDepartmentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  location_id: z.string().uuid().optional(),
});

export const createTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(255),
  description: z.string().optional(),
  member_ids: z.array(z.string().uuid()).optional(),
});

export const updateTeamSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
});

export const addTeamMemberSchema = z.object({
  userId: z.string().uuid(),
});

export const updateBrandingSchema = z.object({
  primary_color: z.string().optional(),
  secondary_color: z.string().optional(),
  accent_color: z.string().optional(),
  logo_url: z.string().optional(),
});

// === Staff ===
export const createStaffProfileSchema = z.object({
  user_id: z.string().uuid(),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  employment_status: z.string().max(50).optional(),
  birth_date: z.string().optional(),
});

export const updateStaffProfileSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  phone: z.string().nullish(),
  address: z.string().nullish(),
  city: z.string().nullish(),
  country: z.string().nullish(),
  postal_code: z.string().nullish(),
  birth_date: z.string().nullish(),
  employment_type: z.string().nullish(),
  contracted_hours_weekly: z.union([z.number().min(0), z.string()]).nullish(),
  max_hours_weekly: z.union([z.number().min(0), z.string()]).nullish(),
  location_id: z.string().uuid().nullable().optional(),
  profile_picture_url: z.string().nullish(),
});

export const updateStaffRoleSchema = z.object({
  role: z.enum(['CARE_WORKER', 'MANAGER', 'ORG_ADMIN']),
});

export const updateStaffStatusSchema = z.object({
  status: z.enum(['active', 'deactivated']),
});

export const updateStaffDepartmentSchema = z.object({
  department_id: z.string().uuid().nullable(),
});

export const addQualificationSchema = z.object({
  name: z.string().min(1, 'Qualification name is required'),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
});

export const addSkillSchema = z.object({
  name: z.string().min(1),
});

export const addEmergencyContactSchema = z.object({
  name: z.string().min(1),
  relationship: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

export const savePreferencesSchema = z.object({
  availability: z.array(z.object({ day: z.string(), start: z.string(), end: z.string() })).optional(),
  preferred_locations: z.array(z.string()).optional(),
  min_pay_rate: z.number().positive().optional(),
  max_travel_distance: z.number().int().positive().optional(),
});

export const forcePasswordResetSchema = z.object({}).passthrough();

// === Scheduling ===
export const createShiftSchema = z.object({
  location_id: z.string().uuid(),
  department_id: z.string().uuid().optional(),
  start_time: z.string().datetime({ offset: true, message: 'Start time must be an ISO 8601 datetime string' }),
  end_time: z.string().datetime({ offset: true, message: 'End time must be an ISO 8601 datetime string' }),
  assigned_staff_ids: z.array(z.string().uuid()).optional().default([]),
  person_id: z.string().uuid().optional(),
  shift_type: z.enum(['day', 'sleep', 'wake_night']).optional(),
});

export const updateShiftSchema = z.object({
  location_id: z.string().uuid().optional(),
  department_id: z.string().uuid().optional(),
  start_time: z.string().datetime({ offset: true, message: 'Start time must be an ISO 8601 datetime string' }).optional(),
  end_time: z.string().datetime({ offset: true, message: 'End time must be an ISO 8601 datetime string' }).optional(),
  status: z.string().optional(),
  person_id: z.string().uuid().optional(),
  shift_type: z.enum(['day', 'sleep', 'wake_night']).optional(),
});

export const assignStaffSchema = z.object({
  staffId: z.string().uuid(),
});

export const applyShiftSchema = z.object({
  staffId: z.string().uuid(),
  notes: z.string().optional(),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
});

// === People ===
export const createPersonSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  date_of_birth: z.string().min(1, 'Date of birth is required'),
  nhs_number: z.string().nullable().optional(),
  room_number: z.string().nullable().optional(),
  status: z.enum(['active', 'discharged', 'deceased']).optional(),
  gp_name: z.string().nullable().optional(),
  gp_surgery: z.string().nullable().optional(),
  gp_phone: z.string().nullable().optional(),
  gp_email: z.string().nullable().optional(),
  gp_address: z.string().nullable().optional(),
  dietary_requirements: z.string().nullable().optional(),
  allergies: z.union([z.string(), z.array(z.any()), z.null()]).transform(v => typeof v === 'string' ? [v] : v).optional(),
  pharmacy_name: z.string().nullable().optional(),
  pharmacy_phone: z.string().nullable().optional(),
  pharmacy_address: z.string().nullable().optional(),
  social_worker_name: z.string().nullable().optional(),
  social_worker_phone: z.string().nullable().optional(),
  social_worker_email: z.string().nullable().optional(),
  photo_url: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  pronouns: z.string().nullable().optional(),
  marital_status: z.string().nullable().optional(),
  religion: z.string().nullable().optional(),
  communication_language: z.string().nullable().optional(),
  communication_interpreter: z.boolean().nullable().optional(),
  communication_method: z.string().nullable().optional(),
  admission_date: z.string().nullable().optional(),
  admission_source: z.string().nullable().optional(),
  funding_type: z.string().nullable().optional(),
  funding_details: z.string().nullable().optional(),
  flags: z.array(z.string()).nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  dnacpr_status: z.string().nullable().optional(),
  dnacpr_date: z.string().nullable().optional(),
  dnacpr_review_date: z.string().nullable().optional(),
  dnacpr_details: z.string().nullable().optional(),
  advance_decision: z.string().nullable().optional(),
  advance_decision_date: z.string().nullable().optional(),
  discharge_date: z.string().nullable().optional(),
  discharge_reason: z.string().nullable().optional(),
  discharge_summary: z.string().nullable().optional(),
  discharge_destination: z.string().nullable().optional(),
  support_level: z.string().nullable().optional(),
  location_id: z.string().uuid('Location is required'),
  min_staff_required: z.coerce.number().int().min(0).max(6).nullable().optional(),
});

export const updatePersonSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  date_of_birth: z.string().nullable().optional(),
  nhs_number: z.string().nullable().optional(),
  room_number: z.string().nullable().optional(),
  status: z.enum(['active', 'discharged', 'deceased']).optional(),
  gp_name: z.string().nullable().optional(),
  gp_surgery: z.string().nullable().optional(),
  gp_phone: z.string().nullable().optional(),
  gp_email: z.string().nullable().optional(),
  gp_address: z.string().nullable().optional(),
  dietary_requirements: z.string().nullable().optional(),
  allergies: z.union([z.string(), z.array(z.any()), z.null()]).transform(v => typeof v === 'string' ? [v] : v).optional(),
  pharmacy_name: z.string().nullable().optional(),
  pharmacy_phone: z.string().nullable().optional(),
  pharmacy_address: z.string().nullable().optional(),
  social_worker_name: z.string().nullable().optional(),
  social_worker_phone: z.string().nullable().optional(),
  social_worker_email: z.string().nullable().optional(),
  photo_url: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  pronouns: z.string().nullable().optional(),
  marital_status: z.string().nullable().optional(),
  religion: z.string().nullable().optional(),
  communication_language: z.string().nullable().optional(),
  communication_interpreter: z.boolean().nullable().optional(),
  communication_method: z.string().nullable().optional(),
  admission_date: z.string().nullable().optional(),
  admission_source: z.string().nullable().optional(),
  funding_type: z.string().nullable().optional(),
  funding_details: z.string().nullable().optional(),
  flags: z.array(z.string()).nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  dnacpr_status: z.string().nullable().optional(),
  dnacpr_date: z.string().nullable().optional(),
  dnacpr_review_date: z.string().nullable().optional(),
  dnacpr_details: z.string().nullable().optional(),
  advance_decision: z.string().nullable().optional(),
  advance_decision_date: z.string().nullable().optional(),
  discharge_date: z.string().nullable().optional(),
  discharge_reason: z.string().nullable().optional(),
  discharge_summary: z.string().nullable().optional(),
  discharge_destination: z.string().nullable().optional(),
  support_level: z.string().nullable().optional(),
  location_id: z.string().uuid().nullable().optional(),
  min_staff_required: z.coerce.number().int().min(0).max(6).nullable().optional(),
  fluid_daily_target: z.number().int().min(0).optional(),
});

export const createClinicalScoreSchema = z.object({
  score_type: z.enum(['waterlow', 'must', 'bmi']),
  score: z.number().optional(),
  risk_level: z.string().optional(),
  recorded_date: z.string().optional(),
  notes: z.string().optional(),
});

export const createDocumentSchema = z.object({
  title: z.string().min(1),
  document_type: z.string().min(1),
  file_url: z.string().min(1),
  description: z.string().optional(),
  upload_date: z.string().optional(),
});

export const createCarePlanSchema = z.object({
  title: z.string().min(1),
  category: z.string().min(1),
  description: z.string().optional(),
  risk_assessment: z.string().optional(),
  review_date: z.string().optional(),
  status: z.string().optional(),
  mobility_level: z.string().optional(),
  mobility_aids: z.string().optional(),
  communication_needs: z.string().optional(),
  capacity_status: z.string().optional(),
  sleep_pattern: z.string().optional(),
  emergency_info: z.string().optional(),
  personal_goals: z.string().optional(),
  likes_dislikes: z.string().optional(),
  cultural_needs: z.string().optional(),
  file_url: z.string().optional(),
  file_name: z.string().optional(),
  sections: z.record(z.string(), z.any()).optional(),
});

export const updateCarePlanSchema = z.object({
  title: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  risk_assessment: z.string().optional(),
  review_date: z.string().optional(),
  status: z.string().optional(),
  mobility_level: z.string().optional(),
  mobility_aids: z.string().optional(),
  communication_needs: z.string().optional(),
  capacity_status: z.string().optional(),
  sleep_pattern: z.string().optional(),
  emergency_info: z.string().optional(),
  personal_goals: z.string().optional(),
  likes_dislikes: z.string().optional(),
  cultural_needs: z.string().optional(),
  file_url: z.string().optional(),
  file_name: z.string().optional(),
  sections: z.record(z.string(), z.any()).optional(),
});

export const createDailyNoteSchema = z.object({
  note_date: z.string().optional(),
  shift: z.enum(['day', 'night']).optional(),
  category: z.string().min(1),
  content: z.string().min(1),
  support_level: z.string().optional(),
});

export const createRiskAssessmentSchema = z.object({
  type: z.string().min(1),
  risk_level: z.enum(['low', 'medium', 'high', 'critical']),
  details: z.string().optional(),
  mitigation_actions: z.string().optional(),
  review_date: z.string().optional(),
  file_url: z.string().optional(),
  file_name: z.string().optional(),
});

export const updateRiskAssessmentSchema = z.object({
  type: z.string().optional(),
  risk_level: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  details: z.string().optional(),
  mitigation_actions: z.string().optional(),
  review_date: z.string().optional(),
  file_url: z.string().optional(),
  file_name: z.string().optional(),
});

export const createFamilyContactSchema = z.object({
  name: z.string().min(1),
  relationship: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  is_emergency_contact: z.boolean().optional(),
});

export const updateFamilyContactSchema = z.object({
  name: z.string().optional(),
  relationship: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  is_emergency_contact: z.boolean().optional(),
});

export const createAssessmentSchema = z.object({
  assessment_type: z.string().min(1, 'Assessment type is required'),
  assessment_date: z.string().optional(),
  assessor_name: z.string().optional(),
  findings: z.string().optional(),
  recommendations: z.string().optional(),
  status: z.enum(['draft','completed','reviewed']).optional(),
  next_review_date: z.string().optional(),
  file_url: emptyToNull(z.string().max(500)),
  file_name: emptyToNull(z.string().max(255)),
});

export const updateAssessmentSchema = createAssessmentSchema.partial();

// === Incidents ===
export const createIncidentSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  incident_date: z.string().optional(),
  location: z.string().optional(),
  severity: z.string().optional(),
  category_id: z.string().uuid().optional(),
  status: z.string().optional(),
});

export const updateIncidentSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  incident_date: z.string().optional(),
  location: z.string().optional(),
  severity: z.string().optional(),
  category_id: z.string().uuid().optional(),
  status: z.string().optional(),
});

export const createIncidentCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export const addInvolvedResidentSchema = z.object({
  person_id: z.string().uuid(),
  involvement_type: z.enum(['affected', 'witness', 'involved']).optional(),
  notes: z.string().optional(),
});

export const createIncidentActionSchema = z.object({
  action: z.string().min(1),
  assigned_to: z.string().uuid().optional(),
  due_date: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
});

// === Leave ===
export const createLeaveRequestSchema = z.object({
  leave_type_id: z.string().uuid(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD format'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD format'),
  reason: z.string().optional(),
  hours_requested: z.number().optional(),
  duration_type: z.enum(['days', 'hours']).optional(),
});

export const reviewLeaveRequestSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  notes: z.string().optional(),
});

export const createLeaveTypeSchema = z.object({
  name: z.string().min(1),
  is_paid: z.boolean().optional(),
  color: z.string().optional(),
  requires_approval: z.boolean().optional(),
  days_allowed: z.number().min(0).optional(),
  hours_allowed: z.number().min(0).optional(),
  duration_type: z.enum(['days', 'hours']).optional(),
});

export const updateLeaveTypeSchema = z.object({
  name: z.string().optional(),
  is_paid: z.boolean().optional(),
  color: z.string().optional(),
  requires_approval: z.boolean().optional(),
  days_allowed: z.number().min(0).optional(),
  hours_allowed: z.number().min(0).optional(),
  duration_type: z.enum(['days', 'hours']).optional(),
});

export const updateStaffEntitlementSchema = z.object({
  leave_type_id: z.string().uuid(),
  year: z.number().int().optional(),
  days_allocated: z.number().min(0).optional(),
  hours_allocated: z.number().min(0).optional(),
});

// === Settings ===
export const updateOrgSettingsSchema = z.object({
  leave_start_month: z.number().int().min(1).max(12).optional(),
  leave_calculation_type: z.string().optional(),
  default_hours_per_leave_day: z.number().min(0).optional(),
  base_leave_hours: z.number().min(0).optional(),
  base_contracted_hours: z.number().min(0).optional(),
  minimum_compliance_percent: z.number().min(0).max(100).optional(),
  overtime_requires_approval: z.boolean().optional(),
  force_mfa: z.boolean().optional(),
  compliance_digest_enabled: z.boolean().optional(),
  predictive_alerts_enabled: z.boolean().optional(),
  auto_evidence_pack_enabled: z.boolean().optional(),
  auto_evidence_pack_frequency: z.enum(['weekly', 'monthly']).optional(),
  daily_shift_audit_enabled: z.boolean().optional(),
  daily_shift_audit_time: z.string().optional(),
  reorder_alert_enabled: z.boolean().optional(),
  late_med_alert_enabled: z.boolean().optional(),
  late_med_alert_delay_minutes: z.number().int().min(1).max(1440).optional(),
  emedication_count_convention: z.enum(['end_of_day', 'am_pm', 'after_each']).optional(),
});

export const createComplianceConfigSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  is_mandatory: z.boolean().optional(),
  days_warning: z.number().int().min(0).optional(),
  days_overdue: z.number().int().min(0).optional(),
});

export const updateComplianceConfigSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  is_mandatory: z.boolean().optional(),
  days_warning: z.number().int().min(0).optional(),
  days_overdue: z.number().int().min(0).optional(),
});

export const createManagerDelegationSchema = z.object({
  primary_manager_id: z.string().uuid(),
  delegate_manager_id: z.string().uuid(),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
});

export const updateManagerDelegationSchema = z.object({
  delegate_manager_id: z.string().uuid().optional(),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
  is_active: z.boolean().optional(),
});

export const updateComplianceRecordSchema = z.object({
  status: z.string().optional(),
  notes: z.string().optional(),
  completed_date: z.string().optional(),
});

export const createComplianceProfileSchema = z.object({
  name: z.string().min(1),
  role_name: z.string().min(1),
  description: z.string().optional(),
  requirement_ids: z.array(z.string().uuid()).optional(),
});

export const updateComplianceProfileSchema = z.object({
  name: z.string().optional(),
  role_name: z.string().optional(),
  description: z.string().optional(),
  requirement_ids: z.array(z.string().uuid()).optional(),
});

export const assignComplianceProfileSchema = z.object({
  staff_id: z.string().uuid(),
  profile_id: z.string().uuid(),
});

export const uploadDocumentSchema = z.object({
  staffId: z.string().uuid(),
  type: z.string().min(1, 'Document type is required'),
  expiryDate: z.string().optional(),
});

// === Invitation ===
export const inviteStaffSchema = z.object({
  email: z.string().email(),
  role: z.string().min(1),
  location_id: z.string().uuid().optional(),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1),
});

// === Billing ===
export const updatePlanSchema = z.object({
  plan: z.enum(['starter', 'professional']),
});

export const addPaymentMethodSchema = z.object({
  payment_method_id: z.string().optional(),
  card_last_four: z.string().length(4).optional(),
  card_brand: z.string().optional(),
  cardholder_name: z.string().max(255).optional(),
  expiry_month: z.number().int().min(1).max(12).optional(),
  expiry_year: z.number().int().optional(),
});

export const createSetupIntentSchema = z.object({}).passthrough();

// === Notifications ===
export const markNotificationReadSchema = z.object({
  id: z.string().uuid(),
});

export const markAllNotificationsReadSchema = z.object({}).passthrough();

// === Permissions ===
export const updatePermissionsSchema = z.object({
  permissions: z.array(z.object({
    module: z.string(),
    permission_level: z.enum(['none', 'view', 'edit']),
  })),
});

// === Marketplace ===
export const publishShiftSchema = z.object({
  location_id: z.string().uuid().optional(),
  department_id: z.string().uuid().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
});

// === Training ===
export const createTrainingModuleSchema = z.object({
  name: z.string().min(1, 'Module name is required'),
  category: z.string().optional(),
  description: z.string().optional(),
  frequency_days: z.number().int().min(0).optional(),
  is_mandatory: z.boolean().optional(),
  requires_competency: z.boolean().optional(),
});

export const updateTrainingModuleSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  frequency_days: z.number().int().min(0).optional(),
  is_mandatory: z.boolean().optional(),
  requires_competency: z.boolean().optional(),
});

export const upsertTrainingRecordSchema = z.object({
  module_id: z.string().uuid(),
  staff_id: z.string().uuid(),
  completed_at: z.string().optional(),
  expires_at: z.string().optional(),
  status: z.string().optional(),
  competency_passed: z.boolean().optional(),
  trainer_name: z.string().optional(),
  digital_signature: z.string().optional(),
  notes: z.string().optional(),
  file_url: z.string().optional(),
});

export const bulkAssignTrainingSchema = z.object({
  staffId: z.string().uuid(),
  moduleIds: z.array(z.string().uuid()).min(1, 'At least one module is required'),
});

// === Competency ===
const rubricItemSchema = z.object({
  criterion: z.string().min(1),
  max_score: z.number().int().min(1).default(5),
  weight: z.number().min(0).max(1).default(1),
});

export const createCompetencyTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  category: z.string().optional(),
  description: z.string().optional(),
  criteria: z.string().optional(),
  requires_reassessment_days: z.number().int().min(0).optional(),
  cqc_statement_id: z.string().optional(),
  is_active: z.boolean().optional(),
  rubric_definition: z.array(rubricItemSchema).optional(),
});

export const updateCompetencyTemplateSchema = z.object({
  name: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  criteria: z.string().optional(),
  requires_reassessment_days: z.number().int().min(0).optional(),
  cqc_statement_id: z.string().optional(),
  is_active: z.boolean().optional(),
  rubric_definition: z.array(rubricItemSchema).optional(),
});

const rubricResponseSchema = z.object({
  criterion: z.string().min(1),
  score: z.number().int().min(0),
  max_score: z.number().int().min(1),
  notes: z.string().optional(),
});

export const createCompetencyAssessmentSchema = z.object({
  template_id: z.string().uuid(),
  staff_id: z.string().uuid(),
  passed: z.boolean(),
  assessed_at: z.string().optional(),
  reassessment_date: z.string().optional(),
  assessor_id: z.string().uuid().optional(),
  involved_parties: z.string().optional(),
  notes: z.string().optional(),
  score: z.number().int().min(0).optional(),
  max_score: z.number().int().min(1).optional(),
  rubric_responses: z.array(rubricResponseSchema).optional(),
});

// === Compliance document ===
export const updateDocumentStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'expired']),
});

// === Location certificates ===
export const createLocationCertificateSchema = z.object({
  name: z.string().min(1, 'Certificate name is required'),
  certificate_type: z.string().min(1, 'Type is required'),
  issuing_body: z.string().optional(),
  certificate_number: z.string().optional(),
  issue_date: z.string().optional(),
  expiry_date: z.string().optional(),
  status: z.enum(['valid', 'expiring_soon', 'expired', 'pending_renewal']).optional(),
  notes: z.string().optional(),
}).refine(data => {
  if (data.issue_date && data.expiry_date) {
    return new Date(data.issue_date) <= new Date(data.expiry_date);
  }
  return true;
}, { message: 'Issue date must be on or before expiry date', path: ['issue_date'] });

export const updateLocationCertificateSchema = z.object({
  name: z.string().min(1).optional(),
  certificate_type: z.string().optional(),
  issuing_body: z.string().optional(),
  certificate_number: z.string().optional(),
  issue_date: z.string().optional(),
  expiry_date: z.string().optional(),
  status: z.enum(['valid', 'expiring_soon', 'expired', 'pending_renewal']).optional(),
  notes: z.string().optional(),
}).refine(data => {
  if (data.issue_date && data.expiry_date) {
    return new Date(data.issue_date) <= new Date(data.expiry_date);
  }
  return true;
}, { message: 'Issue date must be on or before expiry date', path: ['issue_date'] });

// === eMedication ===
export const createMedicationRecordSchema = z.object({
  person_id: z.string().uuid(),
  title: z.string().min(1).max(255),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['active', 'discontinued', 'archived']).optional(),
});

export const updateMedicationRecordSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['active', 'discontinued', 'archived']).optional(),
});

export const addMedicationItemSchema = z.object({
  name: z.string().min(1).max(255),
  dosage: z.string().min(1).max(100),
  unit: z.string().max(50).optional(),
  stock_item_id: z.string().uuid().optional(),
  route: z.string().max(100).optional(),
  frequency: z.string().min(1).max(100),
  times: z.array(z.string()).optional(),
  instructions: z.string().max(500).optional(),
  is_prn: z.boolean().optional(),
  is_active: z.boolean().optional(),
  is_controlled_drug: z.boolean().optional(),
  prescriber_name: z.string().max(255).optional(),
  prescriber_phone: z.string().max(50).optional(),
  prescription_ref: z.string().max(255).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const updateMedicationItemSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  dosage: z.string().min(1).max(100).optional(),
  unit: z.string().max(50).optional(),
  route: z.string().max(100).optional(),
  frequency: z.string().min(1).max(100).optional(),
  times: z.array(z.string()).optional(),
  instructions: z.string().max(500).optional(),
  is_prn: z.boolean().optional(),
  is_active: z.boolean().optional(),
  is_controlled_drug: z.boolean().optional(),
  prescriber_name: z.string().max(255).optional(),
  prescriber_phone: z.string().max(50).optional(),
  prescription_ref: z.string().max(255).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const logAdministrationSchema = z.object({
  emedication_item_id: z.string().uuid(),
  scheduled_time: z.string().min(1),
  status: z.enum(['given', 'refused', 'missed', 'omitted', 'not_available', 'n/a', 'pending']),
  notes: z.string().max(1000).optional(),
  administered_time: z.string().optional(),
  staff_user_id: z.string().uuid().optional(),
  prn_reason: z.string().max(500).optional(),
  prn_effectiveness: z.string().max(500).optional(),
  wastage_amount: z.string().max(50).optional(),
  wastage_reason: z.string().max(500).optional(),
  batch_number: z.string().max(100).optional(),
  expiry_date: z.string().max(50).optional(),
});

export const createStockItemSchema = z.object({
  medication_name: z.string().min(1).max(255),
  dosage: z.string().min(1).max(100),
  unit: z.string().max(50).optional(),
  batch_number: z.string().max(255).optional(),
  expiry_date: z.string().max(50).optional(),
  quantity: z.number().min(0).optional(),
  quantity_unit: z.string().max(50).optional(),
  reorder_level: z.number().min(0).optional(),
  location: z.string().max(255).optional(),
  person_id: z.string().uuid().optional(),
});

export const deliveryNewMedicationSchema = z.object({
  route: z.string().max(50).optional(),
  frequency: z.string().min(1).max(100),
  times: z.array(z.string()).max(24).optional(),
  instructions: z.string().max(1000).optional(),
  is_prn: z.boolean().optional(),
  is_controlled_drug: z.boolean().optional(),
  prescriber_name: z.string().max(255).optional(),
  prescriber_phone: z.string().max(50).optional(),
  prescription_ref: z.string().max(255).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const deliveryItemSchema = z.object({
  id: z.string().uuid().optional(),
  stock_id: z.string().uuid().optional(),
  medication_name: z.string().min(1).max(255),
  dosage: z.string().max(100).optional(),
  unit: z.string().max(50).optional(),
  batch_number: z.string().max(100).optional(),
  expiry_date: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')]).optional(),
  quantity: z.number().min(0),
  quantity_unit: z.string().max(50).optional(),
  new_medication: deliveryNewMedicationSchema.optional(),
});

export const createDeliverySchema = z.object({
  person_id: z.string().uuid().optional(),
  supplier: z.string().max(255).optional(),
  delivery_note: z.string().max(255).optional(),
  delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  received_by: z.string().max(255).optional(),
  notes: z.string().max(1000).optional(),
  items: z.array(deliveryItemSchema).min(1).max(100),
});

export const createDailyCountSchema = z.object({
  person_id: z.string().uuid(),
  count_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  staff_name: z.string().min(1).max(255),
  matches_physical: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
  count_session: z.string().max(50).optional(),
  counted_at: z.string().max(50).optional(),
});

export const dailyCountItemInputSchema = z.object({
  medication_item_id: z.string().uuid(),
  medication_name: z.string().min(1).max(255),
  expected_quantity: z.number().min(0),
  actual_quantity: z.number().min(0),
  reason_for_mismatch: z.string().max(500).optional(),
  escalate: z.boolean().optional(),
});

export const upsertDailyCountSchema = z.object({
  person_id: z.string().uuid(),
  count_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  count_session: z.string().max(50).optional(),
  staff_name: z.string().min(1).max(255),
  counted_at: z.string().max(50).optional(),
  notes: z.string().max(1000).optional(),
  items: z.array(dailyCountItemInputSchema).min(1).max(200),
});

export const upsertDailyCountItemSchema = dailyCountItemInputSchema.extend({
  daily_count_id: z.string().uuid(),
});

export const updateAdministrationSchema = z.object({
  scheduled_time: z.string().min(1).optional(),
  status: z.enum(['given', 'refused', 'missed', 'omitted', 'not_available', 'n/a', 'pending']).optional(),
  notes: z.string().max(1000).optional(),
  administered_time: z.string().optional(),
  staff_user_id: z.string().uuid().optional(),
  prn_reason: z.string().max(500).optional(),
  prn_effectiveness: z.string().max(500).optional(),
  wastage_amount: z.string().max(50).optional(),
  wastage_reason: z.string().max(500).optional(),
  batch_number: z.string().max(100).optional(),
  expiry_date: z.string().max(50).optional(),
});

export const updateStockItemSchema = z.object({
  medication_name: z.string().min(1).max(255).optional(),
  dosage: z.string().min(1).max(100).optional(),
  unit: z.string().max(50).optional(),
  batch_number: z.string().max(255).optional(),
  expiry_date: z.string().max(50).optional(),
  quantity: z.number().min(0).optional(),
  quantity_unit: z.string().max(50).optional(),
  reorder_level: z.number().min(0).optional(),
  location: z.string().max(255).optional(),
  person_id: z.string().uuid().optional(),
});

export const toggleMedicationCompetenceSchema = z.object({
  medication_competent: z.boolean(),
});

export const ensureMonthlyMarSchema = z.object({
  personId: z.string().uuid(),
});

// === Person new modules ===
export const createWellbeingSchema = z.object({
  recorded_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  domain: z.enum(['mood','engagement','sleep','appetite','pain','mobility','social','overall']),
  score: z.number().int().min(1).max(10),
  notes: z.string().max(2000).optional(),
});

export const updateWellbeingSchema = createWellbeingSchema.partial();

export const createCommunicationLogSchema = z.object({
  contact_name: z.string().max(255).optional(),
  relationship: z.string().max(100).optional(),
  contact_method: z.enum(['phone','email','letter','visit','video_call','other']),
  direction: z.enum(['inbound','outbound']),
  summary: z.string().min(1).max(5000),
  follow_up_actions: z.string().max(2000).optional(),
  recorded_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const updateCommunicationLogSchema = createCommunicationLogSchema.partial();

export const createCapacityAssessmentSchema = z.object({
  assessment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  decision_to_be_made: z.string().min(1).max(2000),
  capacity_found: z.boolean().nullable().optional(),
  capacity_status: z.enum(['has_capacity','lacks_capacity','fluctuating','not_assessed']).optional(),
  best_interest_decision: z.string().max(5000).optional(),
  best_interest_meeting_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  independent_advocate: z.string().max(255).optional(),
  relevant_people_informed: z.string().max(2000).optional(),
  review_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

export const updateCapacityAssessmentSchema = createCapacityAssessmentSchema.partial();

export const createCarePathwaySchema = z.object({
  pathway_type: z.enum(['hospital_admission','hospital_discharge','short_break','assessment_unit','transition','other']),
  title: z.string().min(1).max(255),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: emptyToNull(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  location_name: emptyToNull(z.string().max(255)),
  referral_reason: emptyToNull(z.string().max(2000)),
  discharge_notes: emptyToNull(z.string().max(5000)),
  status: z.enum(['active','completed','cancelled']).optional(),
  file_url: emptyToNull(z.string().max(500)),
  file_name: emptyToNull(z.string().max(255)),
});

export const updateCarePathwaySchema = createCarePathwaySchema.partial();

export const TIME_AWAY_TYPES = ['family_visit','short_break','hospital_admission','hospital_discharge','trial_leave','discharge','other'] as const;
export const TIME_AWAY_ITEM_CATEGORIES = ['documentation','medication','equipment','notification','property','financial','other'] as const;

export const createTimeAwaySchema = z.object({
  title: z.string().min(1).max(255),
  time_away_type: z.enum(TIME_AWAY_TYPES).default('other'),
  destination: emptyToNull(z.string().max(255)).optional(),
  start_date: emptyToNull(z.string()).optional(),
  end_date: emptyToNull(z.string()).optional(),
  notes: emptyToNull(z.string().max(5000)).optional(),
});

export const updateTimeAwaySchema = createTimeAwaySchema.partial();

export const createTimeAwayItemSchema = z.object({
  item: z.string().min(1).max(255),
  category: z.enum(TIME_AWAY_ITEM_CATEGORIES).default('documentation'),
  quantity: z.number().positive().max(1000000).nullable().optional(),
  unit: emptyToNull(z.string().max(50)).optional(),
});

export const updateTimeAwayItemSchema = z.object({
  item: z.string().min(1).max(255).optional(),
  category: z.enum(TIME_AWAY_ITEM_CATEGORIES).optional(),
  quantity: z.number().positive().max(1000000).nullable().optional(),
  unit: emptyToNull(z.string().max(50)).optional(),
  is_complete: z.boolean().optional(),
});

export const updateClinicalScoreSchema = z.object({
  score_type: z.enum(['waterlow','must','bmi']).optional(),
  score: z.number().optional(),
  risk_level: z.string().optional(),
  recorded_date: z.string().optional(),
  notes: z.string().optional(),
});

// === Health (Observations, Bowel, Dental, Fluid) ===
export const createObservationSchema = z.object({
  observation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.string().max(100),
  notes: z.string().max(2000).optional(),
  severity: z.enum(['normal', 'mild', 'moderate', 'severe']).optional(),
});

export const createBowelMovementSchema = z.object({
  recorded_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recorded_time: z.string().optional(),
  bristol_type: z.number().int().min(1).max(7).optional(),
  color: z.string().max(50).optional(),
  frequency: z.number().int().positive().optional(),
  consistency: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

export const createDentalRecordSchema = z.object({
  checkup_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dentist_name: z.string().max(200).optional(),
  findings: z.string().max(2000).optional(),
  actions_taken: z.string().max(2000).optional(),
  next_checkup_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(2000).optional(),
});

export const createFluidIntakeSchema = z.object({
  recorded_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recorded_time: z.string().optional(),
  amount_ml: z.number().int().positive(),
  fluid_type: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateObservationSchema = createObservationSchema.partial();
export const updateBowelMovementSchema = createBowelMovementSchema.partial();
export const updateDentalRecordSchema = createDentalRecordSchema.partial();
export const updateFluidIntakeSchema = createFluidIntakeSchema.partial();
export const updateDailyNoteSchema = createDailyNoteSchema.partial();

// === Policies ===
export const createPolicySchema = z.object({
  title: z.string().min(1).max(500),
  category: z.string().max(100),
  content: z.string().min(1),
  version: z.string().max(50).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

export const updatePolicySchema = z.object({
  title: z.string().min(1).max(500).optional(),
  category: z.string().max(100).optional(),
  content: z.string().min(1).optional(),
  version: z.string().max(50).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

// === Appointments ===
export const createAppointmentSchema = z.object({
  person_id: z.string().uuid(),
  staff_id: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  start_time: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)),
  end_time: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)).optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled', 'no-show']).optional(),
  location_id: z.string().uuid().optional(),
});

export const updateAppointmentSchema = z.object({
  person_id: z.string().uuid().optional(),
  staff_id: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  start_time: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)).optional(),
  end_time: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)).optional().nullable(),
  status: z.enum(['scheduled', 'completed', 'cancelled', 'no-show']).optional(),
  location_id: z.string().uuid().optional().nullable(),
});

// === Person Goals ===
export const createGoalSchema = z.object({
  person_id: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional().nullable(),
  target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  review_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  status: z.enum(['active', 'completed', 'cancelled', 'on-hold']).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  cqc_domain: z.enum(['safe', 'effective', 'caring', 'responsive', 'well-led']).optional().nullable(),
  frequency: z.string().max(100).optional(),
  goal_category: z.string().max(100).optional().nullable(),
  care_plan_id: z.string().uuid().optional().nullable(),
  baseline_value: z.number().optional().nullable(),
  target_value: z.number().optional().nullable(),
  value_unit: z.string().max(50).optional().nullable(),
  provider_clarification: z.enum(['person_centred_review', 'la_review', 'persons_request', 'family_request', 'safeguarding', 'organisational_priority', 'other']).optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  status_reason: z.string().max(1000).optional().nullable(),
  is_private: z.boolean().optional(),
  started_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

export const updateGoalSchema = z.object({
  person_id: z.string().uuid().optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional().nullable(),
  target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  review_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  status: z.enum(['active', 'completed', 'cancelled', 'on-hold']).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  cqc_domain: z.enum(['safe', 'effective', 'caring', 'responsive', 'well-led']).optional().nullable(),
  frequency: z.string().max(100).optional(),
  goal_category: z.string().max(100).optional().nullable(),
  care_plan_id: z.string().uuid().optional().nullable(),
  baseline_value: z.number().optional().nullable(),
  target_value: z.number().optional().nullable(),
  value_unit: z.string().max(50).optional().nullable(),
  provider_clarification: z.enum(['person_centred_review', 'la_review', 'persons_request', 'family_request', 'safeguarding', 'organisational_priority', 'other']).optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  status_reason: z.string().max(1000).optional().nullable(),
  is_private: z.boolean().optional(),
  started_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

// === Body Map ===
export const createBodyMapEntrySchema = z.object({
  body_view: z.enum(['front', 'back']),
  body_zone: z.string().min(1).max(50),
  zone_x: z.number().min(0).max(100).optional(),
  zone_y: z.number().min(0).max(100).optional(),
  condition_type: z.enum(['bruise', 'wound', 'rash', 'injection', 'burn', 'pressure_sore', 'scar', 'swelling', 'skin_tear', 'other']),
  description: z.string().max(2000).optional(),
  severity: z.enum(['mild', 'moderate', 'severe']).optional(),
  recorded_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const updateBodyMapEntrySchema = z.object({
  body_view: z.enum(['front', 'back']).optional(),
  body_zone: z.string().min(1).max(50).optional(),
  zone_x: z.number().min(0).max(100).optional(),
  zone_y: z.number().min(0).max(100).optional(),
  condition_type: z.enum(['bruise', 'wound', 'rash', 'injection', 'burn', 'pressure_sore', 'scar', 'swelling', 'skin_tear', 'other']).optional(),
  description: z.string().max(2000).optional(),
  severity: z.enum(['mild', 'moderate', 'severe']).optional(),
  status: z.enum(['active', 'healing', 'resolved']).optional(),
  recorded_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  resolved_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

// === Memory Book ===
export const createMemoryBookEntrySchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  recorded_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  support_level: z.string().optional(),
});

export const updateMemoryBookEntrySchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  recorded_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  support_level: z.string().optional(),
  image_urls: z.array(z.string()).optional(),
});

// === Task Management ===
export const createTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  assigned_to: z.string().uuid().optional(),
  person_id: z.string().uuid().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  assigned_to: z.string().uuid().optional().nullable(),
  person_id: z.string().uuid().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

// === Room Checks ===
export const createRoomCheckSchema = z.object({
  location_id: z.string().uuid().optional(),
  room_number: z.string().min(1).max(50),
  check_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['pass', 'fail', 'needs_attention']).optional(),
  cleanliness_rating: z.number().int().min(1).max(5).optional(),
  safety_rating: z.number().int().min(1).max(5).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateRoomCheckSchema = z.object({
  location_id: z.string().uuid().optional().nullable(),
  room_number: z.string().min(1).max(50).optional(),
  check_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['pass', 'fail', 'needs_attention']).optional(),
  cleanliness_rating: z.number().int().min(1).max(5).optional().nullable(),
  safety_rating: z.number().int().min(1).max(5).optional().nullable(),
  notes: z.string().max(2000).optional(),
});

// === Family Portal ===
export const createFamilyMemberSchema = z.object({
  person_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  relationship: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
});

export const updateFamilyMemberSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().max(255).optional(),
  relationship: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
});

// === Goal Milestones ===
export const createMilestoneSchema = z.object({
  title: z.string().min(1).max(255),
  sort_order: z.number().int().min(0).optional(),
});

export const updateMilestoneSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  is_completed: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
});

// === Goal Progress ===
export const recordProgressSchema = z.object({
  progress: z.number().int().min(0).max(100),
  notes: z.string().max(2000).optional(),
});

// === Outcome Scales ===
export const createScaleSchema = z.object({
  name: z.string().min(1).max(255),
  shortcode: z.string().min(1).max(20),
  description: z.string().max(2000).optional(),
  min_score: z.number(),
  max_score: z.number(),
  questions: z.array(z.object({ text: z.string().min(1), order: z.number().int().min(0) })).min(1),
  score_bands: z.array(z.object({ min: z.number(), max: z.number(), label: z.string(), color: z.string() })).min(1),
});

export const updateScaleSchema = createScaleSchema.partial();

export const recordAssessmentSchema = z.object({
  person_id: z.string().uuid(),
  scores: z.record(z.string(), z.number()),
  total_score: z.number(),
  band_label: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

// === Contact Form ===
export const contactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('A valid email is required').max(255),
  company: z.string().max(255).optional(),
  message: z.string().min(1, 'Message is required').max(5000),
});
