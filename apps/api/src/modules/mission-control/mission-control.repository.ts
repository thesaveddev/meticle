import { query } from '../../shared/database';

export class MissionControlRepository {
  /** Get all active (undismissed) alerts for an org, with optional filters. */
  static async getAlerts(orgId: string, filters?: { severity?: string; category?: string }) {
    const conditions = ['organization_id = $1', 'dismissed = FALSE'];
    const params: any[] = [orgId];
    let idx = 2;

    if (filters?.severity) {
      conditions.push(`severity = $${idx}`);
      params.push(filters.severity);
      idx++;
    }
    if (filters?.category) {
      const catMap: Record<string, string[]> = {
        medication: ["alert_type LIKE 'medication.%'"],
        staffing: ["alert_type IN ('shift.unfilled')"],
        safety: ["alert_type IN ('incident.action_overdue')"],
        compliance: ["alert_type IN ('training.expiring', 'dbs.expiring', 'policy.review_due')"],
        care: ["alert_type IN ('care_plan.review_due', 'fluid.intake_below_target', 'nutrition.appetite_decline', 'nutrition.refused_meal')"],
      };
      const parts = catMap[filters.category];
      if (parts) {
        conditions.push(`(${parts.join(' OR ')})`);
      }
    }

    const where = conditions.join(' AND ');
    const result = await query(
      `SELECT * FROM mission_control_alerts
       WHERE ${where}
       ORDER BY
         CASE severity
           WHEN 'critical' THEN 0
           WHEN 'high' THEN 1
           WHEN 'medium' THEN 2
           WHEN 'low' THEN 3
         END,
         created_at DESC`,
      params
    );
    return result.rows;
  }

  /** Dismiss a single alert by id. */
  static async dismissAlert(id: string, orgId: string) {
    const result = await query(
      `UPDATE mission_control_alerts SET dismissed = TRUE, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 RETURNING id`,
      [id, orgId]
    );
    return result.rowCount ?? 0;
  }

  /** Dismiss all alerts of a given type for an org. */
  static async dismissByType(orgId: string, alertType: string) {
    const result = await query(
      `UPDATE mission_control_alerts SET dismissed = TRUE, updated_at = NOW()
       WHERE organization_id = $1 AND alert_type = $2 AND dismissed = FALSE`,
      [orgId, alertType]
    );
    return result.rowCount ?? 0;
  }

  /** Get dismissed alerts (history) for audit trail. */
  static async getAlertHistory(orgId: string, limit = 50) {
    const result = await query(
      `SELECT * FROM mission_control_alerts
       WHERE organization_id = $1 AND dismissed = TRUE
       ORDER BY updated_at DESC
       LIMIT $2`,
      [orgId, limit]
    );
    return result.rows;
  }

  /** Assign an alert to a staff member. */
  static async assignAlert(id: string, orgId: string, assignedTo: string, assignedName: string) {
    const result = await query(
      `UPDATE mission_control_alerts
       SET assigned_to = $3, assigned_name = $4, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 RETURNING *`,
      [id, orgId, assignedTo, assignedName]
    );
    return result.rows[0] || null;
  }

  /** Batch dismiss multiple alerts by IDs. */
  static async batchDismiss(ids: string[], orgId: string) {
    const result = await query(
      `UPDATE mission_control_alerts SET dismissed = TRUE, updated_at = NOW()
       WHERE id = ANY($1) AND organization_id = $2 AND dismissed = FALSE`,
      [ids, orgId]
    );
    return result.rowCount ?? 0;
  }

  /** Get week-over-week alert trend data. */
  static async getTrends(orgId: string) {
    const result = await query(
      `SELECT
         DATE(created_at) AS date,
         COUNT(*) FILTER (WHERE severity = 'critical')::int AS critical,
         COUNT(*) FILTER (WHERE severity = 'high')::int AS high,
         COUNT(*) FILTER (WHERE severity = 'medium')::int AS medium,
         COUNT(*) FILTER (WHERE severity = 'low')::int AS low,
         COUNT(*)::int AS total
       FROM mission_control_alerts
       WHERE organization_id = $1
         AND created_at >= CURRENT_DATE - interval '14 days'
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [orgId]
    );

    const thisWeek = result.rows.filter((r: any) => {
      const d = new Date(r.date);
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return d >= weekAgo;
    });
    const lastWeek = result.rows.filter((r: any) => {
      const d = new Date(r.date);
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      return d >= twoWeeksAgo && d < weekAgo;
    });

    const sumField = (rows: any[], field: string) => rows.reduce((s, r) => s + (r[field] || 0), 0);

    return {
      daily: result.rows,
      this_week: {
        total: sumField(thisWeek, 'total'),
        critical: sumField(thisWeek, 'critical'),
        high: sumField(thisWeek, 'high'),
        medium: sumField(thisWeek, 'medium'),
        low: sumField(thisWeek, 'low'),
      },
      last_week: {
        total: sumField(lastWeek, 'total'),
        critical: sumField(lastWeek, 'critical'),
        high: sumField(lastWeek, 'high'),
        medium: sumField(lastWeek, 'medium'),
        low: sumField(lastWeek, 'low'),
      },
    };
  }

  /**
   * Get a consolidated Mission Control summary for the dashboard:
   * - counts by severity
   * - counts by category (medication, staffing, compliance, care)
   * - overdue medications count
   * - unfilled shifts count
   * - expiring compliance items count
   * - overdue reviews count
   */
  static async getSummary(orgId: string) {
    // Alert counts by severity
    const severityResult = await query(
      `SELECT
         COUNT(*) FILTER (WHERE severity = 'critical' AND dismissed = FALSE)::int AS critical,
         COUNT(*) FILTER (WHERE severity = 'high' AND dismissed = FALSE)::int AS high,
         COUNT(*) FILTER (WHERE severity = 'medium' AND dismissed = FALSE)::int AS medium,
         COUNT(*) FILTER (WHERE severity = 'low' AND dismissed = FALSE)::int AS low,
         COUNT(*) FILTER (WHERE dismissed = FALSE)::int AS total
       FROM mission_control_alerts
       WHERE organization_id = $1`,
      [orgId]
    );

    // Category breakdown from alerts
    const categoryResult = await query(
      `SELECT
         COUNT(*) FILTER (WHERE alert_type LIKE 'medication.%' AND dismissed = FALSE)::int AS medication,
         COUNT(*) FILTER (WHERE alert_type IN ('shift.unfilled', 'shift.understaffed', 'incident.action_overdue') AND dismissed = FALSE)::int AS staffing_safety,
         COUNT(*) FILTER (WHERE alert_type IN ('training.expiring', 'dbs.expiring', 'policy.review_due') AND dismissed = FALSE)::int AS compliance,
         COUNT(*) FILTER (WHERE alert_type IN ('care_plan.review_due', 'fluid.intake_below_target') AND dismissed = FALSE)::int AS care
       FROM mission_control_alerts
       WHERE organization_id = $1`,
      [orgId]
    );

    // Overdue medication administrations
    const overdueMeds = await query(
      `SELECT COUNT(*)::int AS count
       FROM emedication_administrations a
       JOIN emedication_items mi ON a.emedication_item_id = mi.id
       JOIN emedication_records r ON mi.emedication_record_id = r.id
       WHERE r.organization_id = $1
         AND r.status = 'active'
         AND mi.is_active = TRUE
         AND a.status = 'pending'
         AND a.scheduled_time < CURRENT_TIMESTAMP - interval '30 minutes'`,
      [orgId]
    );

    // Unfilled shifts (open shifts with no assigned staff, starting in next 24h)
    const unfilledShifts = await query(
      `SELECT COUNT(*)::int AS count
       FROM shifts s
       JOIN locations l ON s.location_id = l.id
       WHERE l.organization_id = $1
         AND s.staff_id IS NULL
         AND s.status NOT IN ('cancelled', 'completed')
         AND s.start_time > CURRENT_TIMESTAMP
         AND s.start_time < CURRENT_TIMESTAMP + interval '24 hours'`,
      [orgId]
    );

    // Understaffed shifts (has staff but below minimum)
    const understaffedShifts = await query(
      `SELECT COUNT(*)::int AS count
       FROM (
         SELECT s.id
         FROM shifts s
         JOIN locations l ON s.location_id = l.id
         LEFT JOIN shift_assignments sa ON sa.shift_id = s.id
         WHERE l.organization_id = $1
           AND s.status NOT IN ('cancelled', 'completed')
           AND s.start_time > CURRENT_TIMESTAMP
           AND s.start_time < CURRENT_TIMESTAMP + interval '24 hours'
           AND l.minimum_staff_per_day IS NOT NULL
           AND l.minimum_staff_per_day > 0
         GROUP BY s.id, l.minimum_staff_per_day
         HAVING COUNT(sa.id) > 0 AND COUNT(sa.id) < l.minimum_staff_per_day
       ) sub`,
      [orgId]
    );

    // Expiring training (within 30 days)
    const expiringTraining = await query(
      `SELECT COUNT(*)::int AS count
       FROM training_records tr
       JOIN training_modules tm ON tr.module_id = tm.id
       WHERE tm.organization_id = $1
         AND tr.status = 'completed'
         AND tr.expires_at IS NOT NULL
         AND tr.expires_at <= CURRENT_DATE + interval '30 days'
         AND tr.expires_at > CURRENT_DATE`,
      [orgId]
    );

    // Expired DBS checks
    const expiringDbs = await query(
      `SELECT COUNT(*)::int AS count
       FROM documents d
       JOIN staff_profiles sp ON d.staff_id = sp.id
       JOIN users u ON sp.user_id = u.id
       WHERE u.organization_id = $1
         AND u.status = 'active'
         AND d.type IN ('DBS', 'ENHANCED_DBS')
         AND d.status NOT IN ('expired', 'rejected')
         AND d.expiry_date IS NOT NULL
         AND d.expiry_date <= CURRENT_DATE + interval '30 days'`,
      [orgId]
    );

    // Overdue care plan reviews
    const overdueCarePlanReviews = await query(
      `SELECT COUNT(*)::int AS count
       FROM care_plans cp
       JOIN people p ON cp.person_id = p.id
       WHERE p.organization_id = $1
         AND cp.status = 'active'
         AND cp.review_date IS NOT NULL
         AND cp.review_date < CURRENT_DATE`,
      [orgId]
    );

    // Overdue policy reviews
    const overduePolicyReviews = await query(
      `SELECT COUNT(*)::int AS count
       FROM policies
       WHERE organization_id = $1
         AND status = 'published'
         AND review_due_at IS NOT NULL
         AND review_due_at < CURRENT_DATE`,
      [orgId]
    );

    // Low fluid intake today (below 70% of target)
    const todayStr = new Date().toISOString().split('T')[0];
    const lowFluid = await query(
      `SELECT COUNT(*)::int AS count
       FROM (
         SELECT fi.person_id, COALESCE(SUM(fi.amount_ml), 0)::int AS total_ml,
                COALESCE(p.fluid_daily_target, 2000) AS target_ml
         FROM fluid_intake fi
         JOIN people p ON p.id = fi.person_id
         WHERE p.organization_id = $1
           AND fi.recorded_date = $2
         GROUP BY fi.person_id, p.fluid_daily_target
       ) sub
       WHERE total_ml < target_ml * 0.7`,
      [orgId, todayStr]
    );

    // Open incident actions overdue
    const overdueIncidentActions = await query(
      `SELECT COUNT(*)::int AS count
       FROM incident_actions ia
       JOIN incidents i ON ia.incident_id = i.id
       WHERE i.organization_id = $1
         AND ia.completed_at IS NULL
         AND ia.status != 'cancelled'
         AND ia.due_date IS NOT NULL
         AND ia.due_date < CURRENT_DATE`,
      [orgId]
    );

    return {
      alerts: severityResult.rows[0] || { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
      categories: categoryResult.rows[0] || { medication: 0, staffing_safety: 0, compliance: 0, care: 0 },
      overdue_medications: overdueMeds.rows[0]?.count || 0,
      unfilled_shifts: unfilledShifts.rows[0]?.count || 0,
      understaffed_shifts: understaffedShifts.rows[0]?.count || 0,
      expiring_training: expiringTraining.rows[0]?.count || 0,
      expiring_dbs: expiringDbs.rows[0]?.count || 0,
      overdue_care_plan_reviews: overdueCarePlanReviews.rows[0]?.count || 0,
      overdue_policy_reviews: overduePolicyReviews.rows[0]?.count || 0,
      low_fluid_intake: lowFluid.rows[0]?.count || 0,
      overdue_incident_actions: overdueIncidentActions.rows[0]?.count || 0,
    };
  }
}