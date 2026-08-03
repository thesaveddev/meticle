import { migrateQuery as query } from '../shared/database'
import { hashPassword } from '../modules/auth/password.util'
import { v4 as uuidv4 } from 'uuid'

/** Create an organization with defaults. Returns the full row. */
export async function createOrg(overrides: Record<string, any> = {}) {
  const id = uuidv4()
  const name = overrides.name || `Test Org ${id.slice(0, 8)}`
  const status = overrides.status || 'active'
  const plan = overrides.plan || 'starter'
  const subscriptionStatus = overrides.subscription_status || 'active'
  const trialEndsAt = overrides.trial_ends_at || null
  const onboardingStep = overrides.onboarding_step ?? 1
  const onboardingCompleted = overrides.onboarding_completed ?? true
  const minimumCompliancePercent = overrides.minimum_compliance_percent ?? 100
  const overtimeRequiresApproval = overrides.overtime_requires_approval ?? true
  const forceMfa = overrides.force_mfa ?? false
  const createdAt = overrides.created_at || new Date().toISOString()

  const result = await query(
    `INSERT INTO organizations (id, name, status, plan, subscription_status, trial_ends_at, onboarding_step, onboarding_completed, minimum_compliance_percent, overtime_requires_approval, force_mfa, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
     RETURNING *`,
    [id, name, status, plan, subscriptionStatus, trialEndsAt, onboardingStep, onboardingCompleted, minimumCompliancePercent, overtimeRequiresApproval, forceMfa, createdAt]
  )
  return result.rows[0]
}

/** Create a user. Returns the full row (without password_hash). */
export async function createUser(overrides: Record<string, any> = {}) {
  const id = overrides.id || uuidv4()
  const email = overrides.email || `test-${id.slice(0, 8)}@example.com`
  const passwordHash = await hashPassword(overrides.password || 'TestPass123!')
  const role = overrides.role || 'CARE_WORKER'
  const status = overrides.status || 'active'
  const organizationId = overrides.organization_id || overrides.organizationId || null
  const createdAt = overrides.created_at || new Date().toISOString()

  await query(
    `INSERT INTO users (id, email, password_hash, role, status, organization_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (email) DO NOTHING`,
    [id, email, passwordHash, role, status, organizationId, createdAt]
  )
  const result = await query('SELECT * FROM users WHERE id = $1', [id])
  return result.rows[0]
}

/** Create a staff profile linked to a user. Returns the full row. */
export async function createStaffProfile(overrides: Record<string, any> = {}) {
  const id = overrides.id || uuidv4()
  const userId = overrides.user_id || overrides.userId
  const firstName = overrides.first_name || overrides.firstName || 'Test'
  const lastName = overrides.last_name || overrides.lastName || 'Staff'
  const phone = overrides.phone || '07700000000'
  const employmentType = overrides.employment_type || 'full_time'
  const contractedHoursWeekly = overrides.contracted_hours_weekly ?? 37.5
  const locationId = overrides.location_id || overrides.locationId || null
  const departmentId = overrides.department_id || overrides.departmentId || null

  const result = await query(
    `INSERT INTO staff_profiles (id, user_id, first_name, last_name, phone, employment_type, contracted_hours_weekly, location_id, department_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [id, userId, firstName, lastName, phone, employmentType, contractedHoursWeekly, locationId, departmentId]
  )
  return result.rows[0]
}

/** Create a location for an organization. Returns the full row. */
export async function createLocation(overrides: Record<string, any> = {}) {
  const id = overrides.id || uuidv4()
  const organizationId = overrides.organization_id || overrides.organizationId
  const name = overrides.name || `Test Location ${id.slice(0, 8)}`
  const address = overrides.address || '123 Test Street'
  const managerId = overrides.manager_id || overrides.managerId || null
  const minStaffPerDay = overrides.minimum_staff_per_day ?? 1

  const result = await query(
    `INSERT INTO locations (id, organization_id, name, address, manager_id, minimum_staff_per_day)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [id, organizationId, name, address, managerId, minStaffPerDay]
  )
  return result.rows[0]
}

/** Create a department. Returns the full row. */
export async function createDepartment(overrides: Record<string, any> = {}) {
  const id = overrides.id || uuidv4()
  const organizationId = overrides.organization_id || overrides.organizationId
  const name = overrides.name || `Test Dept ${id.slice(0, 8)}`
  const description = overrides.description || 'Test department description'

  const result = await query(
    `INSERT INTO departments (id, organization_id, name, description)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [id, organizationId, name, description]
  )
  return result.rows[0]
}

/** Create a team. Returns the full row. */
export async function createTeam(overrides: Record<string, any> = {}) {
  const id = overrides.id || uuidv4()
  const organizationId = overrides.organization_id || overrides.organizationId
  const name = overrides.name || `Test Team ${id.slice(0, 8)}`

  const result = await query(
    `INSERT INTO teams (id, organization_id, name)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [id, organizationId, name]
  )
  return result.rows[0]
}

/** Create a shift. Returns the full row. */
export async function createShift(overrides: Record<string, any> = {}) {
  const id = overrides.id || uuidv4()
  const locationId = overrides.location_id || overrides.locationId
  const departmentId = overrides.department_id || overrides.departmentId || null
  const startTime = overrides.start_time || overrides.startTime || new Date(Date.now() + 86400000).toISOString()
  const endTime = overrides.end_time || overrides.endTime || new Date(Date.now() + 90000000).toISOString()
  const shiftType = overrides.shift_type || overrides.shiftType || 'day'
  const status = overrides.status || 'open'
  const personId = overrides.person_id || overrides.personId || null

  const result = await query(
    `INSERT INTO shifts (id, location_id, department_id, start_time, end_time, shift_type, status, person_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [id, locationId, departmentId, startTime, endTime, shiftType, status, personId]
  )
  return result.rows[0]
}

/** Create a leave type. Returns the full row. */
export async function createLeaveType(overrides: Record<string, any> = {}) {
  const id = overrides.id || uuidv4()
  const organizationId = overrides.organization_id || overrides.organizationId
  const name = overrides.name || 'Annual Leave'
  const color = overrides.color || '#0F4C81'
  const daysAllowed = overrides.days_allowed ?? 28
  const hoursAllowed = overrides.hours_allowed ?? 0
  const durationType = overrides.duration_type || 'days'

  const result = await query(
    `INSERT INTO leave_types (id, organization_id, name, color, days_allowed, hours_allowed, duration_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [id, organizationId, name, color, daysAllowed, hoursAllowed, durationType]
  )
  return result.rows[0]
}

/** Create a leave request. Returns the full row. */
export async function createLeaveRequest(overrides: Record<string, any> = {}) {
  const id = overrides.id || uuidv4()
  const staffId = overrides.staff_id || overrides.staffId
  const leaveTypeId = overrides.leave_type_id || overrides.leaveTypeId
  const startDate = overrides.start_date || '2026-08-01'
  const endDate = overrides.end_date || '2026-08-05'
  const status = overrides.status || 'pending'
  const durationType = overrides.duration_type || 'days'
  const hoursRequested = overrides.hours_requested ?? null
  const reason = overrides.reason || 'Test leave request'
  const reviewedBy = overrides.reviewed_by || overrides.reviewedBy || null

  const result = await query(
    `INSERT INTO leave_requests (id, staff_id, leave_type_id, start_date, end_date, status, duration_type, hours_requested, reason, reviewed_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [id, staffId, leaveTypeId, startDate, endDate, status, durationType, hoursRequested, reason, reviewedBy]
  )
  return result.rows[0]
}

/** Create a training module. Returns the full row. */
export async function createTrainingModule(overrides: Record<string, any> = {}) {
  const id = overrides.id || uuidv4()
  const organizationId = overrides.organization_id || overrides.organizationId
  const name = overrides.name || 'Test Training Module'
  const category = overrides.category || 'mandatory'
  const description = overrides.description || 'Test description'
  const frequencyDays = overrides.frequency_days ?? 365
  const isMandatory = overrides.is_mandatory ?? true
  const requiresCompetency = overrides.requires_competency ?? false

  const result = await query(
    `INSERT INTO training_modules (id, organization_id, name, category, description, frequency_days, is_mandatory, requires_competency)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [id, organizationId, name, category, description, frequencyDays, isMandatory, requiresCompetency]
  )
  return result.rows[0]
}

/** Create a training record. Returns the full row. */
export async function createTrainingRecord(overrides: Record<string, any> = {}) {
  const id = overrides.id || uuidv4()
  const moduleId = overrides.module_id || overrides.moduleId
  const staffId = overrides.staff_id || overrides.staffId
  const status = overrides.status || 'completed'
  const completedAt = overrides.completed_at || '2026-01-15'
  const expiresAt = overrides.expires_at || '2027-01-15'
  const competencyPassed = overrides.competency_passed ?? null
  const trainerName = overrides.trainer_name || 'Trainer Name'

  const result = await query(
    `INSERT INTO training_records (id, module_id, staff_id, status, completed_at, expires_at, competency_passed, trainer_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (module_id, staff_id) DO UPDATE SET status = EXCLUDED.status
     RETURNING *`,
    [id, moduleId, staffId, status, completedAt, expiresAt, competencyPassed, trainerName]
  )
  return result.rows[0]
}

/** Create an incident category. Returns the full row. */
export async function createIncidentCategory(overrides: Record<string, any> = {}) {
  const id = overrides.id || uuidv4()
  const organizationId = overrides.organization_id || overrides.organizationId
  const name = overrides.name || 'Test Category'
  const severity = overrides.severity || 'medium'
  const isCqcReportable = overrides.is_cqc_reportable ?? false
  const isActive = overrides.is_active ?? true

  const result = await query(
    `INSERT INTO incident_categories (id, organization_id, name, severity, is_cqc_reportable, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [id, organizationId, name, severity, isCqcReportable, isActive]
  )
  return result.rows[0]
}

/** Create an incident. Returns the full row. */
export async function createIncident(overrides: Record<string, any> = {}) {
  const id = overrides.id || uuidv4()
  const organizationId = overrides.organization_id || overrides.organizationId
  const categoryId = overrides.category_id || overrides.categoryId || null
  const title = overrides.title || 'Test Incident'
  const description = overrides.description || 'Test description'
  const location = overrides.location || 'Wing A'
  const severity = overrides.severity || 'medium'
  const status = overrides.status || 'reported'
  const reportedBy = overrides.reported_by || overrides.reportedBy || null
  const incidentDate = overrides.incident_date || new Date().toISOString().split('T')[0]

  const result = await query(
    `INSERT INTO incidents (id, organization_id, category_id, title, description, incident_date, location, severity, status, reported_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [id, organizationId, categoryId, title, description, incidentDate, location, severity, status, reportedBy]
  )
  return result.rows[0]
}

/** Generate a JWT token for a given user. */
import jwt from 'jsonwebtoken'

export function generateToken(user: { id: string; email: string; role: string; organization_id?: string }) {
  const secret = process.env.JWT_SECRET || 'test-jwt-secret'
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role, organizationId: user.organization_id },
    secret,
    { expiresIn: '1h' }
  )
}

/** Clean all data from all tables (for test teardown). Ordered by dependency (children first). */
export async function cleanDatabase() {
  const tables = [
    'leave_requests', 'leave_balances', 'leave_types',
    'incident_actions', 'incident_involved_residents', 'incidents', 'incident_categories',
    'training_records', 'training_modules',
    'chat_messages', 'chat_files', 'chat_members', 'chat_channels',
    'shift_swaps', 'shift_assignments', 'shifts',
    'competency_assessments', 'competency_templates',
    'compliance_snapshots', 'compliance_records', 'compliance_config',
    'staff_profiles', 'users', 'team_members', 'teams',
    'departments', 'locations', 'organizations',
  ]
  for (const table of tables) {
    try {
      await query(`DELETE FROM ${table}`)
    } catch {
      // table might not exist or FK constraints — skip
    }
  }
}
