import pool from './index';
import { AppError } from '../middleware/error.middleware';
import { AuthUser } from '../middleware/auth.middleware';

/**
 * Verify a resource belongs to the authenticated user's organization.
 * Throws AppError(404) if not found or not in the same org.
 */
export async function requireOrgAccess(
  user: AuthUser,
  table: string,
  idColumn: string,
  id: string,
  customOrgColumn?: string
): Promise<void> {
  const col = customOrgColumn || 'organization_id';
  const { rows } = await pool.query(
    `SELECT 1 FROM ${table} WHERE ${idColumn} = $1 AND ${col} = $2`,
    [id, user.organizationId]
  );
  if (rows.length === 0) throw new AppError(404, `${table} not found`);
}

/**
 * Verify a user belongs to the authenticated user's organization.
 */
export async function requireSameOrgForUser(user: AuthUser, userId: string): Promise<void> {
  const { rows } = await pool.query(
    'SELECT 1 FROM users WHERE id = $1 AND organization_id = $2',
    [userId, user.organizationId]
  );
  if (rows.length === 0) throw new AppError(404, 'User not found');
}

/**
 * Verify a staff profile belongs to the authenticated user's organization.
 */
export async function requireSameOrgForStaff(user: AuthUser, staffId: string): Promise<string | undefined> {
  const { rows } = await pool.query(
    `SELECT u.id FROM staff_profiles sp
     JOIN users u ON sp.user_id = u.id
     WHERE sp.id = $1 AND u.organization_id = $2`,
    [staffId, user.organizationId]
  );
  if (rows.length === 0) throw new AppError(404, 'Staff not found');
  return rows[0].id;
}

/**
 * Verify a user (by user_id) belongs to the same org.
 */
export async function getUserIdIfInOrg(user: AuthUser, userId: string): Promise<string> {
  const { rows } = await pool.query(
    'SELECT id FROM users WHERE id = $1 AND organization_id = $2',
    [userId, user.organizationId]
  );
  if (rows.length === 0) throw new AppError(404, 'User not found');
  return rows[0].id;
}

/**
 * Wrap a simple org-scoped existence check and return the row if found.
 */
export async function findOrgScoped<T = any>(
  user: AuthUser,
  table: string,
  idColumn: string,
  id: string,
  columns: string = '*',
  customOrgColumn?: string
): Promise<T | null> {
  const col = customOrgColumn || 'organization_id';
  const { rows } = await pool.query(
    `SELECT ${columns} FROM ${table} WHERE ${idColumn} = $1 AND ${col} = $2`,
    [id, user.organizationId]
  );
  return rows[0] || null;
}

/**
 * Enforce that a location belongs to the org.
 */
export async function requireLocationInOrg(user: AuthUser, locationId: string): Promise<void> {
  await requireOrgAccess(user, 'locations', 'id', locationId);
}

/**
 * Enforce that a team belongs to the org.
 */
export async function requireTeamInOrg(user: AuthUser, teamId: string): Promise<void> {
  await requireOrgAccess(user, 'teams', 'id', teamId);
}

/**
 * Enforce that a department belongs to the org (departments are under locations which are under orgs).
 */
export async function requireDepartmentInOrg(user: AuthUser, departmentId: string): Promise<void> {
  const { rows } = await pool.query(
    `SELECT d.id FROM departments d
     JOIN locations l ON d.location_id = l.id
     WHERE d.id = $1 AND l.organization_id = $2`,
    [departmentId, user.organizationId]
  );
  if (rows.length === 0) throw new AppError(404, 'Department not found');
}

/**
 * Enforce that a shift belongs to the org (via location).
 */
export async function requireShiftInOrg(user: AuthUser, shiftId: string): Promise<void> {
  const { rows } = await pool.query(
    `SELECT s.id FROM shifts s
     JOIN locations l ON s.location_id = l.id
     WHERE s.id = $1 AND l.organization_id = $2`,
    [shiftId, user.organizationId]
  );
  if (rows.length === 0) throw new AppError(404, 'Shift not found');
}

/**
 * Enforce that a leave request belongs to the org.
 */
export async function requireLeaveInOrg(user: AuthUser, requestId: string): Promise<void> {
  const { rows } = await pool.query(
    `SELECT lr.id FROM leave_requests lr
     JOIN staff_profiles sp ON lr.staff_id = sp.id
     JOIN users u ON sp.user_id = u.id
     WHERE lr.id = $1 AND u.organization_id = $2`,
    [requestId, user.organizationId]
  );
  if (rows.length === 0) throw new AppError(404, 'Leave request not found');
}

/**
 * Enforce that a compliance config/profile/record belongs to the org.
 */
export async function requireComplianceInOrg(user: AuthUser, table: string, id: string): Promise<void> {
  await requireOrgAccess(user, table, 'id', id);
}

/**
 * Enforce that a person belongs to the org.
 */
export async function requirePersonInOrg(user: AuthUser, personId: string): Promise<void> {
  await requireOrgAccess(user, 'people', 'id', personId);
}

/**
 * Enforce that an incident belongs to the org.
 */
export async function requireIncidentInOrg(user: AuthUser, incidentId: string): Promise<void> {
  await requireOrgAccess(user, 'incidents', 'id', incidentId);
}

/**
 * Append an organization_id filter to a WHERE clause.
 * Useful when building dynamic queries.
 */
export function orgFilter(orgId: string, paramIndex: number): string {
  return `organization_id = $${paramIndex}`;
}
