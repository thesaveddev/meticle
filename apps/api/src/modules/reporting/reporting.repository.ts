import { query } from '../../shared/database';
import { ReportFilters } from './reporting.types';

function buildWhere(orgId: string, filters: ReportFilters, tableAlias: string = '') {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  const conditions: string[] = [`${prefix}organization_id = $1`];
  const params: any[] = [orgId];
  let idx = 2;

  if (filters.location_id) {
    conditions.push(`${prefix}location_id = $${idx}`);
    params.push(filters.location_id);
    idx++;
  }
  if (filters.department_id) {
    conditions.push(`${prefix}department_id = $${idx}`);
    params.push(filters.department_id);
    idx++;
  }
  if (filters.dateFrom) {
    conditions.push(`${prefix}created_at >= $${idx}`);
    params.push(filters.dateFrom);
    idx++;
  }
  if (filters.dateTo) {
    conditions.push(`${prefix}created_at <= $${idx}`);
    params.push(filters.dateTo);
    idx++;
  }
  return { where: conditions.join(' AND '), params, idx };
}

function buildTimeWhere(filters: ReportFilters, timeCol: string, tableAlias: string = '') {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (filters.dateFrom) {
    conditions.push(`${prefix}${timeCol} >= $${idx}`);
    params.push(filters.dateFrom);
    idx++;
  }
  if (filters.dateTo) {
    conditions.push(`${prefix}${timeCol} <= $${idx}`);
    params.push(filters.dateTo);
    idx++;
  }
  return { where: conditions.length ? conditions.join(' AND ') : '1=1', params, idx };
}

export class ReportingRepository {
  // ─── Staff Reports ───────────────────────────────────────

  static async staffDirectory(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT sp.id, sp.first_name, sp.last_name, sp.position, sp.start_date, sp.status,
             sp.emergency_contact_name, sp.emergency_contact_phone,
             u.email, u.role, u.status as user_status, u.last_login_at,
             l.name as location_name, d.name as department_name,
             COALESCE(
               (SELECT ROUND(AVG(CASE WHEN tr.status = 'completed' THEN 100.0 ELSE 0 END))
                FROM training_records tr WHERE tr.staff_id = sp.id), 0
             )::int as compliance_rate
      FROM staff_profiles sp
      JOIN users u ON sp.user_id = u.id
      LEFT JOIN locations l ON sp.location_id = l.id
      LEFT JOIN departments d ON sp.department_id = d.id
      WHERE u.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;

    if (f.location_id) { sql += ` AND sp.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.department_id) { sql += ` AND sp.department_id = $${idx}`; params.push(f.department_id); idx++; }
    if (f.role) { sql += ` AND u.role = $${idx}`; params.push(f.role); idx++; }
    if (f.status) { sql += ` AND (sp.status = $${idx} OR u.status = $${idx})`; params.push(f.status); idx++; }
    sql += ' ORDER BY sp.last_name, sp.first_name';

    const result = await query(sql, params);
    return result.rows;
  }

  static async staffByLocation(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT l.name as name, COUNT(sp.id)::int as value, l.id as location_id
      FROM locations l
      LEFT JOIN staff_profiles sp ON sp.location_id = l.id
      LEFT JOIN users u ON sp.user_id = u.id AND u.status = 'active'
      WHERE l.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.role) { sql += ` AND u.role = $${idx}`; params.push(f.role); idx++; }
    sql += ' GROUP BY l.id, l.name ORDER BY value DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  static async staffByRole(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT u.role as name, COUNT(u.id)::int as value
      FROM users u
      JOIN staff_profiles sp ON sp.user_id = u.id
      WHERE u.organization_id = $1 AND u.status = 'active' AND u.role != 'SUPER_ADMIN'`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND sp.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.department_id) { sql += ` AND sp.department_id = $${idx}`; params.push(f.department_id); idx++; }
    sql += ' GROUP BY u.role ORDER BY value DESC';
    const result = await query(sql, params);
    return result.rows.map((r: any) => ({
      ...r,
      name: r.name === 'CARE_WORKER' ? 'Care Worker' : r.name === 'ORG_ADMIN' ? 'Admin' : r.name === 'MANAGER' ? 'Manager' : r.name === 'COMPLIANCE_OFFICER' ? 'Compliance' : r.name,
    }));
  }

  static async staffCompliance(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT sp.id, sp.first_name, sp.last_name, u.role, l.name as location_name, d.name as department_name,
             COALESCE(cr.total_records, 0)::int as total_records,
             COALESCE(cr.completed, 0)::int as completed,
             CASE WHEN COALESCE(cr.total_records, 0) > 0
               THEN ROUND(cr.completed::numeric / cr.total_records * 100)::int ELSE 0
             END as compliance_rate
      FROM staff_profiles sp
      JOIN users u ON sp.user_id = u.id
      LEFT JOIN locations l ON sp.location_id = l.id
      LEFT JOIN departments d ON sp.department_id = d.id
      LEFT JOIN (
        SELECT staff_id, COUNT(*)::int as total_records,
               COUNT(*) FILTER (WHERE status = 'completed' OR status = 'valid')::int as completed
        FROM compliance_records GROUP BY staff_id
      ) cr ON cr.staff_id = sp.id
      WHERE u.organization_id = $1 AND u.status = 'active'`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND sp.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.department_id) { sql += ` AND sp.department_id = $${idx}`; params.push(f.department_id); idx++; }
    if (f.role) { sql += ` AND u.role = $${idx}`; params.push(f.role); idx++; }
    sql += ' ORDER BY compliance_rate ASC, sp.last_name';
    const result = await query(sql, params);
    return result.rows;
  }

  static async trainingMatrix(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT sp.first_name, sp.last_name, tm.name as module_name, tm.category as module_category,
             tr.status, tr.completed_at, tr.expires_at, l.name as location_name,
             d.name as department_name
      FROM training_records tr
      JOIN staff_profiles sp ON tr.staff_id = sp.id
      JOIN users u ON sp.user_id = u.id
      JOIN training_modules tm ON tr.module_id = tm.id
      LEFT JOIN locations l ON sp.location_id = l.id
      LEFT JOIN departments d ON sp.department_id = d.id
      WHERE u.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND sp.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.department_id) { sql += ` AND sp.department_id = $${idx}`; params.push(f.department_id); idx++; }
    if (f.role) { sql += ` AND u.role = $${idx}`; params.push(f.role); idx++; }
    if (f.status) { sql += ` AND tr.status = $${idx}`; params.push(f.status); idx++; }
    sql += ' ORDER BY sp.last_name, tm.name';
    const result = await query(sql, params);
    return result.rows;
  }

  static async staffDocuments(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT sp.first_name, sp.last_name, d.type as document_type, d.title, d.expiry_date, d.status,
             l.name as location_name, u.role,
             CASE WHEN d.expiry_date < CURRENT_DATE THEN 'expired'
                  WHEN d.expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_30'
                  WHEN d.expiry_date < CURRENT_DATE + INTERVAL '90 days' THEN 'expiring_90'
                  ELSE 'valid' END as expiry_status
      FROM documents d
      JOIN staff_profiles sp ON d.staff_id = sp.id
      JOIN users u ON sp.user_id = u.id
      LEFT JOIN locations l ON sp.location_id = l.id
      WHERE u.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND sp.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.department_id) { sql += ` AND sp.department_id = $${idx}`; params.push(f.department_id); idx++; }
    if (f.role) { sql += ` AND u.role = $${idx}`; params.push(f.role); idx++; }
    if (f.status) { sql += ` AND d.status = $${idx}`; params.push(f.status); idx++; }
    sql += ' ORDER BY d.expiry_date ASC NULLS LAST';
    const result = await query(sql, params);
    return result.rows;
  }

  static async staffSkills(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT sk.name as skill_name, sk.category as skill_category, sp.first_name, sp.last_name,
             ss.proficiency_level, ss.years_experience, l.name as location_name, d.name as department_name
      FROM staff_skills ss
      JOIN staff_profiles sp ON ss.staff_id = sp.id
      JOIN users u ON sp.user_id = u.id
      JOIN skills sk ON ss.skill_id = sk.id
      LEFT JOIN locations l ON sp.location_id = l.id
      LEFT JOIN departments d ON sp.department_id = d.id
      WHERE u.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND sp.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.department_id) { sql += ` AND sp.department_id = $${idx}`; params.push(f.department_id); idx++; }
    if (f.role) { sql += ` AND u.role = $${idx}`; params.push(f.role); idx++; }
    sql += ' ORDER BY sk.name, sp.last_name';
    const result = await query(sql, params);
    return result.rows;
  }

  // ─── Person Reports ────────────────────────────────

  static async suDirectory(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT su.id, su.first_name, su.last_name, su.date_of_birth, su.status, su.care_level,
             su.nhs_number, su.created_at,
             l.name as location_name,
             kw.first_name as key_worker_first, kw.last_name as key_worker_last
      FROM people su
      LEFT JOIN locations l ON su.location_id = l.id
      LEFT JOIN staff_profiles sp ON su.key_worker_id = sp.id
      LEFT JOIN users kw ON sp.user_id = kw.id
      WHERE su.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND su.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.status) { sql += ` AND su.status = $${idx}`; params.push(f.status); idx++; }
    sql += ' ORDER BY su.last_name, su.first_name';
    const result = await query(sql, params);
    return result.rows;
  }

  static async suByLocation(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT l.name as name, COUNT(su.id)::int as value
      FROM locations l
      LEFT JOIN people su ON su.location_id = l.id
      WHERE l.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.status) { sql += ` AND su.status = $${idx}`; params.push(f.status); idx++; }
    if (f.dateFrom) { sql += ` AND su.created_at >= $${idx}`; params.push(f.dateFrom); idx++; }
    if (f.dateTo) { sql += ` AND su.created_at <= $${idx}`; params.push(f.dateTo); idx++; }
    sql += ' GROUP BY l.id, l.name ORDER BY value DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  static async suCarePlans(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT su.first_name, su.last_name, su.status as su_status, l.name as location_name,
             cp.id as plan_id, cp.status as plan_status, cp.created_at as plan_created, cp.updated_at as plan_updated,
             CASE WHEN cp.updated_at < CURRENT_DATE - INTERVAL '90 days' THEN true ELSE false END as overdue_review
      FROM people su
      LEFT JOIN locations l ON su.location_id = l.id
      LEFT JOIN LATERAL (
        SELECT id, status, created_at, updated_at FROM care_plans
        WHERE person_id = su.id ORDER BY updated_at DESC LIMIT 1
      ) cp ON true
      WHERE su.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND su.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.status) { sql += ` AND su.status = $${idx}`; params.push(f.status); idx++; }
    sql += ' ORDER BY su.last_name';
    const result = await query(sql, params);
    return result.rows;
  }

  static async suOutcomes(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT su.first_name, su.last_name, su.status as su_status, l.name as location_name,
        (SELECT COUNT(*)::int FROM person_goals g WHERE g.person_id = su.id) AS total_goals,
        (SELECT COUNT(*)::int FROM person_goals g WHERE g.person_id = su.id AND g.status = 'completed') AS completed_goals,
        (SELECT ROUND(AVG(progress))::int FROM person_goals g WHERE g.person_id = su.id AND g.status = 'active') AS avg_progress,
        (SELECT ROUND(AVG(w.score), 1)::numeric FROM person_wellbeing w WHERE w.person_id = su.id
         AND w.recorded_date >= COALESCE($2::date, CURRENT_DATE - 30)) AS avg_wellbeing,
        (SELECT COUNT(*)::int FROM outcome_scale_results osr WHERE osr.person_id = su.id) AS scale_assessments
      FROM people su
      LEFT JOIN locations l ON su.location_id = l.id
      WHERE su.organization_id = $1 AND su.status = 'active'`;
    const params: any[] = [orgId, f.dateFrom || null];
    let idx = 3;
    if (f.location_id) { sql += ` AND su.location_id = $${idx}`; params.push(f.location_id); idx++; }
    sql += ' ORDER BY su.last_name';
    const result = await query(sql, params);
    return result.rows;
  }

  static async suDailyNotes(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT l.name as location_name, TO_CHAR(dn.created_at, 'YYYY-MM') as month,
             COUNT(*)::int as note_count,
             COUNT(*) FILTER (WHERE dn.mood IS NOT NULL)::int as mood_flagged,
             COUNT(*) FILTER (WHERE dn.safeguarding_concern = true)::int as safeguarding_flags
      FROM daily_notes dn
      JOIN people su ON dn.person_id = su.id
      LEFT JOIN locations l ON su.location_id = l.id
      WHERE su.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND su.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.dateFrom) { sql += ` AND dn.created_at >= $${idx}`; params.push(f.dateFrom); idx++; }
    if (f.dateTo) { sql += ` AND dn.created_at <= $${idx}`; params.push(f.dateTo); idx++; }
    sql += ' GROUP BY l.name, month ORDER BY month DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  // ─── Scheduling Reports ──────────────────────────────────

  static async shiftCoverage(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT l.name as location_name, TO_CHAR(s.start_time, 'YYYY-MM') as month,
             s.status, s.shift_type,
             COUNT(*)::int as shift_count,
             SUM(s.duration_hours)::numeric(10,1) as total_hours
      FROM shifts s
      JOIN locations l ON s.location_id = l.id
      WHERE l.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND s.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.department_id) { sql += ` AND s.department_id = $${idx}`; params.push(f.department_id); idx++; }
    if (f.status) { sql += ` AND s.status = $${idx}`; params.push(f.status); idx++; }
    if (f.dateFrom) { sql += ` AND s.start_time >= $${idx}`; params.push(f.dateFrom); idx++; }
    if (f.dateTo) { sql += ` AND s.start_time <= $${idx}`; params.push(f.dateTo); idx++; }
    sql += ' GROUP BY l.name, month, s.status, s.shift_type ORDER BY month DESC, s.status';
    const result = await query(sql, params);
    return result.rows;
  }

  static async shiftFillRate(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT l.name as location_name, TO_CHAR(s.start_time, 'YYYY-MM') as month,
             COUNT(*)::int as total_shifts,
             COUNT(sa.id)::int as filled_shifts,
             COUNT(*) FILTER (WHERE sa.id IS NULL AND s.status != 'cancelled')::int as open_shifts,
             CASE WHEN COUNT(*) FILTER (WHERE s.status != 'cancelled') > 0
               THEN ROUND(COUNT(sa.id)::numeric / COUNT(*) FILTER (WHERE s.status != 'cancelled') * 100)::int
               ELSE 0 END as fill_rate
      FROM shifts s
      JOIN locations l ON s.location_id = l.id
      LEFT JOIN shift_assignments sa ON sa.shift_id = s.id
      WHERE l.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND s.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.dateFrom) { sql += ` AND s.start_time >= $${idx}`; params.push(f.dateFrom); idx++; }
    if (f.dateTo) { sql += ` AND s.start_time <= $${idx}`; params.push(f.dateTo); idx++; }
    sql += ' GROUP BY l.name, month ORDER BY month DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  static async overtimeAnalysis(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT sp.first_name, sp.last_name, l.name as location_name, d.name as department_name,
             TO_CHAR(s.start_time, 'YYYY-MM') as month,
             COUNT(*)::int as overtime_shifts,
             COALESCE(SUM(s.duration_hours), 0)::numeric(10,1) as total_hours
      FROM shifts s
      JOIN shift_assignments sa ON sa.shift_id = s.id
      JOIN staff_profiles sp ON sa.staff_id = sp.id
      JOIN users u ON sp.user_id = u.id
      LEFT JOIN locations l ON s.location_id = l.id
      LEFT JOIN departments d ON sp.department_id = d.id
      WHERE l.organization_id = $1 AND s.shift_type = 'overtime'`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND s.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.department_id) { sql += ` AND sp.department_id = $${idx}`; params.push(f.department_id); idx++; }
    if (f.role) { sql += ` AND u.role = $${idx}`; params.push(f.role); idx++; }
    if (f.dateFrom) { sql += ` AND s.start_time >= $${idx}`; params.push(f.dateFrom); idx++; }
    if (f.dateTo) { sql += ` AND s.start_time <= $${idx}`; params.push(f.dateTo); idx++; }
    sql += ' GROUP BY sp.first_name, sp.last_name, l.name, d.name, month ORDER BY total_hours DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  static async agencyUsage(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT a.name as agency_name, l.name as location_name,
             TO_CHAR(s.start_time, 'YYYY-MM') as month,
             COUNT(*)::int as agency_shifts,
             COALESCE(SUM(s.duration_hours), 0)::numeric(10,1) as total_hours
      FROM shifts s
      JOIN agencies a ON s.agency_id = a.id
      JOIN locations l ON s.location_id = l.id
      WHERE l.organization_id = $1 AND s.agency_id IS NOT NULL`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND s.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.dateFrom) { sql += ` AND s.start_time >= $${idx}`; params.push(f.dateFrom); idx++; }
    if (f.dateTo) { sql += ` AND s.start_time <= $${idx}`; params.push(f.dateTo); idx++; }
    sql += ' GROUP BY a.name, l.name, month ORDER BY agency_shifts DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  // ─── Leave Reports ───────────────────────────────────────

  static async leaveByType(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT lt.name as name, lt.color, lt.id,
             COUNT(lr.id)::int as value,
             COUNT(lr.id) FILTER (WHERE lr.status = 'approved')::int as approved,
             COUNT(lr.id) FILTER (WHERE lr.status = 'rejected')::int as rejected,
             COUNT(lr.id) FILTER (WHERE lr.status = 'pending')::int as pending,
             COALESCE(SUM(lr.hours_requested) FILTER (WHERE lr.status = 'approved'), 0)::numeric(10,1) as total_hours
      FROM leave_types lt
      LEFT JOIN leave_requests lr ON lr.leave_type_id = lt.id
      LEFT JOIN staff_profiles sp ON lr.staff_id = sp.id
      WHERE lt.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND sp.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.department_id) { sql += ` AND sp.department_id = $${idx}`; params.push(f.department_id); idx++; }
    if (f.dateFrom) { sql += ` AND lr.start_date >= $${idx}`; params.push(f.dateFrom); idx++; }
    if (f.dateTo) { sql += ` AND lr.end_date <= $${idx}`; params.push(f.dateTo); idx++; }
    sql += ' GROUP BY lt.id, lt.name, lt.color ORDER BY value DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  static async leaveByMonth(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT TO_CHAR(lr.start_date, 'YYYY-MM') as name,
             lt.name as leave_type, lt.color,
             COUNT(lr.id)::int as value,
             COALESCE(SUM(lr.hours_requested) FILTER (WHERE lr.status = 'approved'), 0)::numeric(10,1) as total_hours
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      JOIN staff_profiles sp ON lr.staff_id = sp.id
      WHERE lt.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND sp.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.department_id) { sql += ` AND sp.department_id = $${idx}`; params.push(f.department_id); idx++; }
    if (f.dateFrom) { sql += ` AND lr.start_date >= $${idx}`; params.push(f.dateFrom); idx++; }
    if (f.dateTo) { sql += ` AND lr.start_date <= $${idx}`; params.push(f.dateTo); idx++; }
    sql += ' GROUP BY name, leave_type, color ORDER BY name DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  static async leaveByDepartment(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT COALESCE(d.name, 'Unassigned') as name,
             COUNT(lr.id)::int as value,
             COALESCE(SUM(lr.hours_requested) FILTER (WHERE lr.status = 'approved'), 0)::numeric(10,1) as total_hours,
             COUNT(lr.id) FILTER (WHERE lr.status = 'approved')::int as approved,
             COUNT(lr.id) FILTER (WHERE lr.status = 'pending')::int as pending
      FROM leave_requests lr
      JOIN staff_profiles sp ON lr.staff_id = sp.id
      LEFT JOIN departments d ON sp.department_id = d.id
      WHERE sp.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND sp.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.dateFrom) { sql += ` AND lr.start_date >= $${idx}`; params.push(f.dateFrom); idx++; }
    if (f.dateTo) { sql += ` AND lr.start_date <= $${idx}`; params.push(f.dateTo); idx++; }
    sql += ' GROUP BY d.name ORDER BY value DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  static async leaveBalances(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT sp.first_name, sp.last_name, l.name as location_name, d.name as department_name,
             lb.days_allocated as allocated, lb.days_taken as taken,
             (lb.days_allocated - lb.days_taken) as remaining,
             lt.name as leave_type_name
      FROM leave_balances lb
      JOIN staff_profiles sp ON lb.staff_id = sp.id
      JOIN users u ON sp.user_id = u.id
      JOIN leave_types lt ON lb.leave_type_id = lt.id
      LEFT JOIN locations l ON sp.location_id = l.id
      LEFT JOIN departments d ON sp.department_id = d.id
      WHERE sp.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND sp.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.department_id) { sql += ` AND sp.department_id = $${idx}`; params.push(f.department_id); idx++; }
    if (f.role) { sql += ` AND u.role = $${idx}`; params.push(f.role); idx++; }
    sql += ' ORDER BY sp.last_name, lt.name';
    const result = await query(sql, params);
    return result.rows;
  }

  // ─── Incident Reports ────────────────────────────────────

  static async incidentSummary(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT i.severity as name, i.category, i.status, l.name as location_name,
             COUNT(*)::int as value,
             COUNT(*) FILTER (WHERE i.status = 'open')::int as open_count,
             COUNT(*) FILTER (WHERE i.status = 'investigating')::int as investigating_count,
             COUNT(*) FILTER (WHERE i.status = 'resolved')::int as resolved_count
      FROM incidents i
      LEFT JOIN locations l ON i.location_id = l.id
      WHERE i.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND i.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.severity) { sql += ` AND i.severity = $${idx}`; params.push(f.severity); idx++; }
    if (f.category) { sql += ` AND i.category = $${idx}`; params.push(f.category); idx++; }
    if (f.status) { sql += ` AND i.status = $${idx}`; params.push(f.status); idx++; }
    if (f.dateFrom) { sql += ` AND i.created_at >= $${idx}`; params.push(f.dateFrom); idx++; }
    if (f.dateTo) { sql += ` AND i.created_at <= $${idx}`; params.push(f.dateTo); idx++; }
    sql += ' GROUP BY i.severity, i.category, i.status, l.name ORDER BY i.severity DESC, value DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  static async incidentTrends(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT TO_CHAR(i.created_at, 'YYYY-MM') as name,
             i.severity as severity,
             COUNT(*)::int as value
      FROM incidents i
      WHERE i.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND i.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.severity) { sql += ` AND i.severity = $${idx}`; params.push(f.severity); idx++; }
    if (f.category) { sql += ` AND i.category = $${idx}`; params.push(f.category); idx++; }
    if (f.dateFrom) { sql += ` AND i.created_at >= $${idx}`; params.push(f.dateFrom); idx++; }
    if (f.dateTo) { sql += ` AND i.created_at <= $${idx}`; params.push(f.dateTo); idx++; }
    sql += ' GROUP BY name, severity ORDER BY name DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  static async incidentByLocation(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT COALESCE(l.name, 'Unknown') as name, i.severity,
             COUNT(*)::int as value
      FROM incidents i
      LEFT JOIN locations l ON i.location_id = l.id
      WHERE i.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.severity) { sql += ` AND i.severity = $${idx}`; params.push(f.severity); idx++; }
    if (f.category) { sql += ` AND i.category = $${idx}`; params.push(f.category); idx++; }
    if (f.dateFrom) { sql += ` AND i.created_at >= $${idx}`; params.push(f.dateFrom); idx++; }
    if (f.dateTo) { sql += ` AND i.created_at <= $${idx}`; params.push(f.dateTo); idx++; }
    sql += ' GROUP BY l.name, i.severity ORDER BY value DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  // ─── Compliance Reports ──────────────────────────────────

  static async complianceOverall(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT cr.category as name,
             COUNT(*)::int as value,
             COUNT(*) FILTER (WHERE cr.status = 'completed' OR cr.status = 'valid')::int as completed,
             COUNT(*) FILTER (WHERE cr.status = 'expired' OR cr.status = 'overdue')::int as overdue,
             CASE WHEN COUNT(*) > 0
               THEN ROUND(COUNT(*) FILTER (WHERE cr.status = 'completed' OR cr.status = 'valid')::numeric / COUNT(*) * 100)::int
               ELSE 0 END as rate
      FROM compliance_records cr
      WHERE cr.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) {
      sql += ` AND cr.staff_id IN (SELECT sp.id FROM staff_profiles sp WHERE sp.location_id = $${idx})`;
      params.push(f.location_id); idx++;
    }
    if (f.department_id) {
      sql += ` AND cr.staff_id IN (SELECT sp.id FROM staff_profiles sp WHERE sp.department_id = $${idx})`;
      params.push(f.department_id); idx++;
    }
    sql += ' GROUP BY cr.category ORDER BY rate ASC, cr.category';
    const result = await query(sql, params);
    return result.rows;
  }

  static async complianceByStaff(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT sp.first_name, sp.last_name, u.role, l.name as location_name, d.name as department_name,
             COUNT(cr.id)::int as total_records,
             COUNT(cr.id) FILTER (WHERE cr.status = 'completed' OR cr.status = 'valid')::int as completed,
             CASE WHEN COUNT(cr.id) > 0
               THEN ROUND(COUNT(cr.id) FILTER (WHERE cr.status = 'completed' OR cr.status = 'valid')::numeric / COUNT(cr.id) * 100)::int
               ELSE 0 END as compliance_rate
      FROM staff_profiles sp
      JOIN users u ON sp.user_id = u.id
      LEFT JOIN locations l ON sp.location_id = l.id
      LEFT JOIN departments d ON sp.department_id = d.id
      LEFT JOIN compliance_records cr ON cr.staff_id = sp.id
      WHERE u.organization_id = $1 AND u.status = 'active'`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND sp.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.department_id) { sql += ` AND sp.department_id = $${idx}`; params.push(f.department_id); idx++; }
    if (f.role) { sql += ` AND u.role = $${idx}`; params.push(f.role); idx++; }
    if (f.status) { sql += ` AND (cr.status = $${idx})`; params.push(f.status); idx++; }
    sql += ' GROUP BY sp.id, sp.first_name, sp.last_name, u.role, l.name, d.name ORDER BY compliance_rate ASC, sp.last_name';
    const result = await query(sql, params);
    return result.rows;
  }

  static async complianceExpiring(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT sp.first_name, sp.last_name, d.type as document_type, d.title, d.expiry_date,
             l.name as location_name, u.role,
             (d.expiry_date - CURRENT_DATE)::int as days_until_expiry
      FROM documents d
      JOIN staff_profiles sp ON d.staff_id = sp.id
      JOIN users u ON sp.user_id = u.id
      LEFT JOIN locations l ON sp.location_id = l.id
      WHERE u.organization_id = $1 AND d.expiry_date >= CURRENT_DATE
        AND d.expiry_date <= CURRENT_DATE + INTERVAL '90 days'`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND sp.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.department_id) { sql += ` AND sp.department_id = $${idx}`; params.push(f.department_id); idx++; }
    sql += ' ORDER BY d.expiry_date ASC';
    const result = await query(sql, params);
    return result.rows;
  }

  // ─── Training Reports ────────────────────────────────────

  static async trainingCompletion(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT tm.name as name, tm.category,
             COUNT(tr.id)::int as total_records,
             COUNT(tr.id) FILTER (WHERE tr.status = 'completed')::int as completed,
             COUNT(tr.id) FILTER (WHERE tr.status = 'expired')::int as expired,
             COUNT(tr.id) FILTER (WHERE tr.status = 'in_progress')::int as in_progress,
             CASE WHEN COUNT(tr.id) > 0
               THEN ROUND(COUNT(tr.id) FILTER (WHERE tr.status = 'completed')::numeric / COUNT(tr.id) * 100)::int
               ELSE 0 END as completion_rate
      FROM training_modules tm
      LEFT JOIN training_records tr ON tr.module_id = tm.id
      LEFT JOIN staff_profiles sp ON tr.staff_id = sp.id
      WHERE tm.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND sp.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.department_id) { sql += ` AND sp.department_id = $${idx}`; params.push(f.department_id); idx++; }
    if (f.role) {
      sql += ` AND (tm.required_roles IS NULL OR $${idx} = ANY(string_to_array(tm.required_roles, ',')))`;
      params.push(f.role); idx++;
    }
    sql += ' GROUP BY tm.id, tm.name, tm.category ORDER BY completion_rate ASC, tm.name';
    const result = await query(sql, params);
    return result.rows;
  }

  static async trainingOverdue(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT sp.first_name, sp.last_name, tm.name as module_name, tm.category,
             tr.expires_at, tr.status, l.name as location_name, d.name as department_name,
             (tr.expires_at - CURRENT_DATE)::int as days_overdue
      FROM training_records tr
      JOIN staff_profiles sp ON tr.staff_id = sp.id
      JOIN users u ON sp.user_id = u.id
      JOIN training_modules tm ON tr.module_id = tm.id
      LEFT JOIN locations l ON sp.location_id = l.id
      LEFT JOIN departments d ON sp.department_id = d.id
      WHERE u.organization_id = $1 AND tr.status = 'expired'`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND sp.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.department_id) { sql += ` AND sp.department_id = $${idx}`; params.push(f.department_id); idx++; }
    if (f.role) { sql += ` AND u.role = $${idx}`; params.push(f.role); idx++; }
    sql += ' ORDER BY days_overdue DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  static async competencyScores(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT ct.name as template_name, ct.cqc_domain,
             sp.first_name, sp.last_name, l.name as location_name,
             ca.score, ca.assessed_at, ca.overall_notes
      FROM competency_assessments ca
      JOIN competency_templates ct ON ca.template_id = ct.id
      JOIN staff_profiles sp ON ca.staff_id = sp.id
      LEFT JOIN locations l ON sp.location_id = l.id
      WHERE ca.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND sp.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.department_id) { sql += ` AND sp.department_id = $${idx}`; params.push(f.department_id); idx++; }
    if (f.role) {
      sql += ` AND (ct.required_roles IS NULL OR $${idx} = ANY(string_to_array(ct.required_roles, ',')))`;
      params.push(f.role); idx++;
    }
    if (f.dateFrom) { sql += ` AND ca.assessed_at >= $${idx}`; params.push(f.dateFrom); idx++; }
    if (f.dateTo) { sql += ` AND ca.assessed_at <= $${idx}`; params.push(f.dateTo); idx++; }
    sql += ' ORDER BY ca.score ASC, ct.name';
    const result = await query(sql, params);
    return result.rows;
  }

  // ─── eMAR Reports ────────────────────────────────────────

  static async marCompliance(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT TO_CHAR(ea.administered_at, 'YYYY-MM') as name,
             ea.status,
             COUNT(*)::int as value,
             l.name as location_name
      FROM emedication_administrations ea
      JOIN emedication_records er ON ea.medication_record_id = er.id
      JOIN people su ON er.person_id = su.id
      LEFT JOIN locations l ON su.location_id = l.id
      WHERE er.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND su.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.dateFrom) { sql += ` AND ea.administered_at >= $${idx}`; params.push(f.dateFrom); idx++; }
    if (f.dateTo) { sql += ` AND ea.administered_at <= $${idx}`; params.push(f.dateTo); idx++; }
    sql += ' GROUP BY name, ea.status, l.name ORDER BY name DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  static async marPrn(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT ei.name as medication_name, l.name as location_name,
             TO_CHAR(ea.administered_at, 'YYYY-MM') as month,
             COUNT(*)::int as value
      FROM emedication_administrations ea
      JOIN emedication_items ei ON ea.medication_item_id = ei.id
      JOIN emedication_records er ON ea.medication_record_id = er.id
      JOIN people su ON er.person_id = su.id
      LEFT JOIN locations l ON su.location_id = l.id
      WHERE er.organization_id = $1 AND ea.is_prn = true`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND su.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.dateFrom) { sql += ` AND ea.administered_at >= $${idx}`; params.push(f.dateFrom); idx++; }
    if (f.dateTo) { sql += ` AND ea.administered_at <= $${idx}`; params.push(f.dateTo); idx++; }
    sql += ' GROUP BY ei.name, l.name, month ORDER BY value DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  // ─── Outcomes Reports ────────────────────────────────────

  static async outcomesByDomain(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT sg.cqc_domain as name, sg.cqc_domain as domain,
             COUNT(*)::int as value,
             COUNT(*) FILTER (WHERE sg.status = 'completed')::int as completed,
             COUNT(*) FILTER (WHERE sg.status = 'active')::int as active,
             ROUND(AVG(sg.progress))::int as avg_progress
      FROM person_goals sg
      WHERE sg.organization_id = $1 AND sg.cqc_domain IS NOT NULL`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) {
      sql += ` AND sg.person_id IN (SELECT su.id FROM people su WHERE su.location_id = $${idx})`;
      params.push(f.location_id); idx++;
    }
    if (f.dateFrom) { sql += ` AND sg.created_at >= $${idx}`; params.push(f.dateFrom); idx++; }
    if (f.dateTo) { sql += ` AND sg.created_at <= $${idx}`; params.push(f.dateTo); idx++; }
    sql += ' GROUP BY sg.cqc_domain ORDER BY avg_progress ASC';
    const result = await query(sql, params);
    return result.rows;
  }

  static async outcomesWellbeing(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT w.domain as name, w.domain,
             ROUND(AVG(w.score), 1)::numeric as value,
             ROUND(AVG(w.score), 1)::numeric as avg_score,
             COUNT(*)::int as entries,
             MIN(w.score) as min_score,
             MAX(w.score) as max_score
      FROM person_wellbeing w
      JOIN people su ON w.person_id = su.id
      WHERE su.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND su.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.dateFrom) { sql += ` AND w.recorded_date >= $${idx}`; params.push(f.dateFrom); idx++; }
    if (f.dateTo) { sql += ` AND w.recorded_date <= $${idx}`; params.push(f.dateTo); idx++; }
    sql += ' GROUP BY w.domain ORDER BY w.domain';
    const result = await query(sql, params);
    return result.rows;
  }

  static async outcomesGoalTrend(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT TO_CHAR(gph.recorded_at, 'YYYY-MM-DD') as name,
             TO_CHAR(gph.recorded_at, 'IYYY-IW') as week,
             ROUND(AVG(gph.progress))::int as value,
             ROUND(AVG(gph.progress))::int as avg_progress,
             COUNT(*)::int as updates
      FROM goal_progress_history gph
      JOIN person_goals sg ON gph.goal_id = sg.id
      WHERE sg.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) {
      sql += ` AND sg.person_id IN (SELECT su.id FROM people su WHERE su.location_id = $${idx})`;
      params.push(f.location_id); idx++;
    }
    if (f.dateFrom) { sql += ` AND gph.recorded_at >= $${idx}`; params.push(f.dateFrom); idx++; }
    if (f.dateTo) { sql += ` AND gph.recorded_at <= $${idx}`; params.push(f.dateTo); idx++; }
    sql += ' GROUP BY week, name ORDER BY name ASC';
    const result = await query(sql, params);
    return result.rows;
  }

  // ─── Appointments ────────────────────────────────────────

  static async appointmentsSummary(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT a.status as name, l.name as location_name,
             TO_CHAR(a.start_time, 'YYYY-MM') as month,
             COUNT(*)::int as value
      FROM appointments a
      LEFT JOIN locations l ON a.location_id = l.id
      WHERE a.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND a.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.dateFrom) { sql += ` AND a.start_time >= $${idx}`; params.push(f.dateFrom); idx++; }
    if (f.dateTo) { sql += ` AND a.start_time <= $${idx}`; params.push(f.dateTo); idx++; }
    sql += ' GROUP BY a.status, l.name, month ORDER BY month DESC, value DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  // ─── Room Checks ─────────────────────────────────────────

  static async roomChecks(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT l.name as location_name, rc.status,
             COUNT(*)::int as value,
             ROUND(AVG(rc.cleanliness_rating), 1) as cleanliness_avg,
             ROUND(AVG(rc.safety_rating), 1) as safety_avg
      FROM room_checks rc
      LEFT JOIN locations l ON rc.location_id = l.id
      WHERE rc.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND rc.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.dateFrom) { sql += ` AND rc.check_date >= $${idx}`; params.push(f.dateFrom); idx++; }
    if (f.dateTo) { sql += ` AND rc.check_date <= $${idx}`; params.push(f.dateTo); idx++; }
    sql += ' GROUP BY l.name, rc.status ORDER BY value DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  // ─── Surveys ─────────────────────────────────────────────

  static async satisfactionSurveys(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT COALESCE(l.name, 'Unassigned') as location_name,
             TO_CHAR(s.created_at, 'YYYY-MM') as month,
             COUNT(*)::int as value,
             ROUND(AVG(s.rating), 1) as avg_rating,
             COUNT(*) FILTER (WHERE s.rating >= 4)::int as satisfied_count
      FROM satisfaction_surveys s
      LEFT JOIN people p ON s.person_id = p.id
      LEFT JOIN locations l ON p.location_id = l.id
      WHERE s.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND p.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.dateFrom) { sql += ` AND s.created_at >= $${idx}`; params.push(f.dateFrom); idx++; }
    if (f.dateTo) { sql += ` AND s.created_at <= $${idx}`; params.push(f.dateTo); idx++; }
    sql += ' GROUP BY l.name, month ORDER BY month DESC, value DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  // ─── Health ──────────────────────────────────────────────

  static async healthObservations(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT TO_CHAR(ho.observation_date, 'YYYY-MM') as name,
             ho.category, ho.severity,
             COUNT(*)::int as value
      FROM health_observations ho
      JOIN people p ON ho.person_id = p.id
      WHERE p.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND p.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.dateFrom) { sql += ` AND ho.observation_date >= $${idx}`; params.push(f.dateFrom); idx++; }
    if (f.dateTo) { sql += ` AND ho.observation_date <= $${idx}`; params.push(f.dateTo); idx++; }
    sql += ' GROUP BY name, ho.category, ho.severity ORDER BY name DESC, value DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  // ─── Tasks ───────────────────────────────────────────────

  static async taskCompletion(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT t.status as name, t.priority,
             COUNT(*)::int as value,
             COUNT(*) FILTER (WHERE t.status NOT IN ('completed','cancelled') AND t.due_date < CURRENT_DATE)::int as overdue,
             COUNT(*) FILTER (WHERE t.status = 'completed')::int as completed_count
      FROM tasks t
      LEFT JOIN staff_profiles sp ON t.assigned_to = sp.id
      WHERE t.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND sp.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.department_id) { sql += ` AND sp.department_id = $${idx}`; params.push(f.department_id); idx++; }
    if (f.dateFrom) { sql += ` AND t.created_at >= $${idx}`; params.push(f.dateFrom); idx++; }
    if (f.dateTo) { sql += ` AND t.created_at <= $${idx}`; params.push(f.dateTo); idx++; }
    sql += ' GROUP BY t.status, t.priority ORDER BY value DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  // ─── Expenses ────────────────────────────────────────────

  static async expensesSummary(orgId: string, f: ReportFilters) {
    let sql = `
      SELECT pe.category as name, l.name as location_name,
             TO_CHAR(pe.incurred_date, 'YYYY-MM') as month,
             COUNT(*)::int as value,
             SUM(pe.amount_pence)::numeric as total_pence
      FROM person_expenses pe
      LEFT JOIN locations l ON pe.location_id = l.id
      WHERE pe.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (f.location_id) { sql += ` AND pe.location_id = $${idx}`; params.push(f.location_id); idx++; }
    if (f.dateFrom) { sql += ` AND pe.incurred_date >= $${idx}`; params.push(f.dateFrom); idx++; }
    if (f.dateTo) { sql += ` AND pe.incurred_date <= $${idx}`; params.push(f.dateTo); idx++; }
    sql += ' GROUP BY pe.category, l.name, month ORDER BY total_pence DESC';
    const result = await query(sql, params);
    return result.rows;
  }
}
