import { query } from '../../shared/database';

export class InsightsRepository {
  static async getOverview(orgId: string) {
    const result = await query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE organization_id = $1 AND status = 'active' AND role IN ('MANAGER','CARE_WORKER','COMPLIANCE_OFFICER')) AS total_staff,
        (SELECT ROUND(AVG(CASE WHEN cr.status = 'complete' THEN 100 ELSE 0 END), 1) FROM compliance_records cr JOIN staff_profiles sp ON cr.staff_id = sp.id JOIN users u ON sp.user_id = u.id WHERE u.organization_id = $1) AS compliance_rate,
        (SELECT COUNT(*) FROM shifts s JOIN locations l ON s.location_id = l.id WHERE l.organization_id = $1 AND s.status = 'open' AND s.start_time >= CURRENT_DATE) AS open_shifts,
        (SELECT COUNT(*) FROM staff_profiles sp JOIN users u ON sp.user_id = u.id WHERE u.organization_id = $1 AND sp.is_on_leave = TRUE) AS staff_on_leave,
        (SELECT COUNT(*) FROM leave_requests lr JOIN staff_profiles sp ON lr.staff_id = sp.id JOIN users u ON sp.user_id = u.id WHERE u.organization_id = $1 AND lr.status = 'pending') AS pending_leave,
        (SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600), 0)::numeric(10,1) FROM shift_assignments sa JOIN shifts s ON sa.shift_id = s.id JOIN locations l ON s.location_id = l.id WHERE l.organization_id = $1 AND sa.is_overtime = TRUE AND sa.status IN ('assigned','accepted') AND DATE_TRUNC('month', s.start_time) = DATE_TRUNC('month', CURRENT_DATE)) AS overtime_hours_month
    `, [orgId]);
    return result.rows[0];
  }

  static async getStaffing(orgId: string) {
    const byRole = await query(`
      SELECT role::text, COUNT(*)::int AS count
      FROM users WHERE organization_id = $1 AND status = 'active'
      GROUP BY role ORDER BY count DESC
    `, [orgId]);

    const byLocation = await query(`
      SELECT l.id, l.name, COUNT(sp.id)::int AS staff_count
      FROM locations l
      LEFT JOIN staff_profiles sp ON sp.location_id = l.id
      LEFT JOIN users u ON sp.user_id = u.id AND u.status = 'active'
      WHERE l.organization_id = $1
      GROUP BY l.id, l.name ORDER BY staff_count DESC
    `, [orgId]);

    const monthlyShifts = await query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', s.start_time), 'YYYY-MM') AS month,
        COUNT(*) FILTER (WHERE s.status IN ('filled','completed'))::int AS filled,
        COUNT(*) FILTER (WHERE s.status = 'open')::int AS open,
        COUNT(*)::int AS total
      FROM shifts s JOIN locations l ON s.location_id = l.id
      WHERE l.organization_id = $1 AND s.start_time >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', s.start_time) ORDER BY month
    `, [orgId]);

    const overtimeByMonth = await query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', s.start_time), 'YYYY-MM') AS month,
        COALESCE(SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600), 0)::numeric(10,1) AS hours
      FROM shift_assignments sa
      JOIN shifts s ON sa.shift_id = s.id
      JOIN locations l ON s.location_id = l.id
      WHERE l.organization_id = $1 AND sa.is_overtime = TRUE AND sa.status IN ('assigned','accepted')
        AND s.start_time >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', s.start_time) ORDER BY month
    `, [orgId]);

    return { byRole: byRole.rows, byLocation: byLocation.rows, monthlyShifts: monthlyShifts.rows, overtimeByMonth: overtimeByMonth.rows };
  }

  static async getCompliance(orgId: string) {
    const overall = await query(`
      SELECT
        COUNT(*)::int AS total_records,
        COUNT(*) FILTER (WHERE cr.status = 'complete')::int AS completed,
        ROUND(AVG(CASE WHEN cr.status = 'complete' THEN 100 ELSE 0 END), 1) AS rate
      FROM compliance_records cr
      JOIN staff_profiles sp ON cr.staff_id = sp.id
      JOIN users u ON sp.user_id = u.id
      WHERE u.organization_id = $1
    `, [orgId]);

    const byCategory = await query(`
      SELECT cc.category, COUNT(cr.id)::int AS total, COUNT(*) FILTER (WHERE cr.status = 'complete')::int AS completed
      FROM compliance_config cc
      JOIN compliance_records cr ON cr.requirement_id = cc.id
      JOIN staff_profiles sp ON cr.staff_id = sp.id
      JOIN users u ON sp.user_id = u.id
      WHERE u.organization_id = $1
      GROUP BY cc.category ORDER BY total DESC
    `, [orgId]);

    const expiring = await query(`
      SELECT
        COUNT(*) FILTER (WHERE cr.expires_at BETWEEN NOW() AND NOW() + INTERVAL '30 days')::int AS next_30,
        COUNT(*) FILTER (WHERE cr.expires_at BETWEEN NOW() + INTERVAL '30 days' AND NOW() + INTERVAL '60 days')::int AS next_60,
        COUNT(*) FILTER (WHERE cr.expires_at BETWEEN NOW() + INTERVAL '60 days' AND NOW() + INTERVAL '90 days')::int AS next_90
      FROM compliance_records cr
      JOIN staff_profiles sp ON cr.staff_id = sp.id
      JOIN users u ON sp.user_id = u.id
      WHERE u.organization_id = $1 AND cr.expires_at IS NOT NULL
    `, [orgId]);

    const minPct = await query('SELECT minimum_compliance_percent FROM organizations WHERE id = $1', [orgId]);
    const threshold = minPct.rows[0]?.minimum_compliance_percent ?? 100;

    const belowThreshold = await query(`
      SELECT COUNT(*)::int AS count FROM (
        SELECT sp.id
        FROM staff_profiles sp
        JOIN users u ON sp.user_id = u.id
        LEFT JOIN compliance_records cr ON cr.staff_id = sp.id
        WHERE u.organization_id = $1 AND u.status = 'active'
        GROUP BY sp.id
        HAVING AVG(CASE WHEN cr.status = 'complete' THEN 100 ELSE 0 END) < $2
      ) sub
    `, [orgId, threshold]);

    return {
      overall: overall.rows[0],
      byCategory: byCategory.rows,
      expiring: expiring.rows[0],
      threshold,
      staffBelowThreshold: belowThreshold.rows[0]?.count ?? 0,
    };
  }

  static async getLeave(orgId: string) {
    const byType = await query(`
      SELECT lt.id, lt.name, lt.color,
        COALESCE(SUM(lr.hours_requested), 0)::numeric(10,1) AS total_hours,
        COUNT(*)::int AS total_requests,
        COUNT(*) FILTER (WHERE lr.status = 'approved')::int AS approved,
        COUNT(*) FILTER (WHERE lr.status = 'rejected')::int AS rejected,
        COUNT(*) FILTER (WHERE lr.status = 'pending')::int AS pending
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      JOIN staff_profiles sp ON lr.staff_id = sp.id
      JOIN users u ON sp.user_id = u.id
      WHERE u.organization_id = $1 AND EXTRACT(YEAR FROM lr.start_date) = EXTRACT(YEAR FROM CURRENT_DATE)
      GROUP BY lt.id, lt.name, lt.color ORDER BY total_hours DESC
    `, [orgId]);

    const monthlyTrend = await query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', start_date), 'YYYY-MM') AS month,
        COALESCE(SUM(hours_requested), 0)::numeric(10,1) AS hours,
        COUNT(*)::int AS requests
      FROM leave_requests lr
      JOIN staff_profiles sp ON lr.staff_id = sp.id
      JOIN users u ON sp.user_id = u.id
      WHERE u.organization_id = $1 AND start_date >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', start_date) ORDER BY month
    `, [orgId]);

    const currentlyOnLeave = await query(`
      SELECT sp.first_name, sp.last_name, lt.name AS leave_type, lr.end_date
      FROM leave_requests lr
      JOIN staff_profiles sp ON lr.staff_id = sp.id
      JOIN users u ON sp.user_id = u.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE u.organization_id = $1 AND lr.status = 'approved'
        AND lr.start_date <= CURRENT_DATE AND lr.end_date >= CURRENT_DATE
      ORDER BY sp.first_name
    `, [orgId]);

    return { byType: byType.rows, monthlyTrend: monthlyTrend.rows, currentlyOnLeave: currentlyOnLeave.rows };
  }

  static async getRota(orgId: string) {
    const byStatus = await query(`
      SELECT s.status, COUNT(*)::int AS count
      FROM shifts s JOIN locations l ON s.location_id = l.id
      WHERE l.organization_id = $1 AND s.start_time >= NOW() - INTERVAL '30 days'
      GROUP BY s.status ORDER BY count DESC
    `, [orgId]);

    const fillRateByLocation = await query(`
      SELECT l.name,
        COUNT(*)::int AS total_shifts,
        COUNT(*) FILTER (WHERE s.status IN ('filled','completed'))::int AS filled
      FROM shifts s
      JOIN locations l ON s.location_id = l.id
      WHERE l.organization_id = $1 AND s.start_time >= NOW() - INTERVAL '30 days'
      GROUP BY l.id, l.name ORDER BY l.name
    `, [orgId]);

    const upcoming = await query(`
      SELECT s.id, s.start_time, s.end_time, l.name AS location,
        (SELECT COUNT(*) FROM shift_assignments WHERE shift_id = s.id)::int AS assigned_staff,
        l.minimum_staff_per_day
      FROM shifts s
      JOIN locations l ON s.location_id = l.id
      WHERE l.organization_id = $1 AND s.start_time >= NOW() AND s.start_time <= NOW() + INTERVAL '7 days'
        AND s.status IN ('open','filled')
      ORDER BY s.start_time LIMIT 20
    `, [orgId]);

    return { byStatus: byStatus.rows, fillRateByLocation: fillRateByLocation.rows, upcoming: upcoming.rows };
  }

  static async getOutcomes(orgId: string) {
    const goalCompletionByDomain = await query(`
      SELECT cqc_domain,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        ROUND(AVG(progress) FILTER (WHERE status = 'active'))::int AS avg_progress
      FROM service_user_goals
      WHERE organization_id = $1 AND cqc_domain IS NOT NULL
      GROUP BY cqc_domain ORDER BY cqc_domain
    `, [orgId]);

    const wellbeingByDomain = await query(`
      SELECT w.domain,
        ROUND(AVG(w.score), 1)::numeric AS avg_score,
        COUNT(*)::int AS entries,
        MIN(w.score) AS min_score,
        MAX(w.score) AS max_score
      FROM su_wellbeing w
      JOIN service_users su ON w.service_user_id = su.id
      WHERE su.organization_id = $1 AND w.recorded_date >= CURRENT_DATE - 30
      GROUP BY w.domain ORDER BY w.domain
    `, [orgId]);

    const scaleDistribution = await query(`
      SELECT osr.band_label, COUNT(*)::int AS count
      FROM outcome_scale_results osr
      JOIN outcome_scales os ON osr.scale_id = os.id
      WHERE os.organization_id = $1 AND osr.band_label IS NOT NULL
      GROUP BY osr.band_label ORDER BY count DESC
    `, [orgId]);

    const overdueReviews = await query(`
      SELECT COUNT(*)::int AS count
      FROM service_user_goals
      WHERE organization_id = $1 AND status = 'active' AND review_date < CURRENT_DATE
    `, [orgId]);

    const goalProgressTrend = await query(`
      SELECT DATE_TRUNC('week', gph.recorded_at)::date AS week,
        ROUND(AVG(gph.progress))::int AS avg_progress,
        COUNT(*)::int AS updates
      FROM goal_progress_history gph
      JOIN service_user_goals g ON gph.goal_id = g.id
      WHERE g.organization_id = $1 AND gph.recorded_at >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('week', gph.recorded_at)
      ORDER BY week
    `, [orgId]);

    return {
      goal_completion_by_domain: goalCompletionByDomain.rows,
      wellbeing_by_domain: wellbeingByDomain.rows,
      scale_distribution: scaleDistribution.rows,
      overdue_reviews: overdueReviews.rows[0]?.count ?? 0,
      goal_progress_trend: goalProgressTrend.rows,
    };
  }
}
