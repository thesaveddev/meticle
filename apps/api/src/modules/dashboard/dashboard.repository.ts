import { query } from '../../shared/database';

export class DashboardRepository {
  static async getStats(orgId: string) {
    const result = await query(`
      SELECT
        (SELECT COUNT(*)::int FROM staff_profiles sp JOIN users u ON u.id = sp.user_id WHERE u.organization_id = $1) as total_staff,
        (SELECT COALESCE(ROUND(
          (SELECT COUNT(*)::numeric FROM compliance_records cr
           JOIN staff_profiles sp2 ON sp2.id = cr.staff_id
           JOIN users u2 ON u2.id = sp2.user_id
           WHERE cr.status = 'complete' AND u2.organization_id = $1) /
          NULLIF((SELECT COUNT(*)::numeric FROM compliance_records cr2
           JOIN staff_profiles sp3 ON sp3.id = cr2.staff_id
           JOIN users u3 ON u3.id = sp3.user_id
           WHERE u3.organization_id = $1), 0) * 100
        , 1), 0)::float) as compliance_rate,
        (SELECT COUNT(*)::int FROM shifts sh JOIN locations l ON l.id = sh.location_id WHERE l.organization_id = $1 AND sh.status = 'open') as open_shifts,
        (SELECT COALESCE(SUM(
          (COALESCE(o2.default_hourly_rate, 12.00) - (sh.agency_cost / NULLIF(EXTRACT(EPOCH FROM (sh.end_time - sh.start_time))/3600, 0)))
          * EXTRACT(EPOCH FROM (sh.end_time - sh.start_time))/3600
        ), 0)::float FROM shifts sh
         JOIN locations l4 ON sh.location_id = l4.id
         CROSS JOIN organizations o2
         WHERE l4.organization_id = $1 AND sh.agency_id IS NOT NULL AND sh.agency_covered = true
           AND o2.id = $1) as agency_saved,
        (SELECT COUNT(*)::int FROM people WHERE organization_id = $1 AND status = 'active') as active_people,
        (SELECT COUNT(DISTINCT sa.staff_id)::int FROM shift_assignments sa
         JOIN shifts sh2 ON sa.shift_id = sh2.id
         JOIN locations l2 ON l2.id = sh2.location_id
         WHERE l2.organization_id = $1
         AND sh2.start_time >= CURRENT_DATE
         AND sh2.start_time < CURRENT_DATE + INTERVAL '1 day'
         AND sa.status IN ('assigned', 'accepted')) as staff_on_duty,
        (SELECT COUNT(*)::int FROM incidents WHERE organization_id = $1 AND status IN ('reported', 'investigating')) as open_incidents
    `, [orgId]);
    return result.rows[0];
  }

  static async getWidgets(orgId: string, userId: string) {
    const [dbsResult, trainingResult, leaveResult, overdueResult, competencyResult, belowThresholdResult, openIncidentsResult] = await Promise.all([
      query(`
        SELECT COUNT(DISTINCT d.staff_id)::int as count FROM documents d
        JOIN staff_profiles sp ON d.staff_id = sp.id
        JOIN users u ON u.id = sp.user_id
        WHERE u.organization_id = $1 AND d.type IN ('DBS','PASSPORT','VISA','RIGHT_TO_WORK') AND d.status = 'approved'
        AND d.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      `, [orgId]),
      query(`
        SELECT COUNT(*)::int as count FROM training_records tr
        JOIN training_modules tm ON tr.module_id = tm.id
        WHERE tm.organization_id = $1 AND tr.status = 'completed'
        AND tr.expires_at BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      `, [orgId]),
      query(`
        SELECT COUNT(*)::int as count FROM leave_requests lr
        JOIN staff_profiles sp ON lr.staff_id = sp.id
        JOIN users u ON u.id = sp.user_id
        WHERE u.organization_id = $1 AND lr.status = 'pending'
      `, [orgId]),
      query(`
        SELECT COUNT(*)::int AS count
        FROM emedication_administrations a
        JOIN emedication_items mi ON a.emedication_item_id = mi.id
        JOIN emedication_records r ON mi.emedication_record_id = r.id
        WHERE r.organization_id = $1
          AND r.status = 'active'
          AND mi.is_active = TRUE
          AND a.status = 'pending'
          AND a.scheduled_time < CURRENT_TIMESTAMP - interval '30 minutes'
      `, [orgId]),
      query(`
        SELECT COUNT(*)::int as count
        FROM competency_assessments ca
        JOIN competency_templates ct ON ca.template_id = ct.id
        JOIN staff_profiles sp ON ca.staff_id = sp.id
        JOIN users u ON sp.user_id = u.id
        WHERE ct.organization_id = $1 AND u.status = 'active'
          AND (ca.reassessment_date <= CURRENT_DATE OR ca.passed = false)
      `, [orgId]),
      query(`
        SELECT COUNT(*)::int as count FROM staff_profiles sp
        JOIN users u ON sp.user_id = u.id
        WHERE u.organization_id = $1 AND u.status = 'active'
          AND COALESCE(
            (SELECT ROUND(COUNT(*) FILTER (WHERE cr.status = 'complete')::numeric / NULLIF(COUNT(*), 0) * 100, 0)
             FROM compliance_records cr WHERE cr.staff_id = sp.id), 0
          ) < COALESCE((SELECT minimum_compliance_percent FROM organizations WHERE id = $1), 70)
      `, [orgId]),
      query(`
        SELECT COUNT(*)::int as count FROM incidents
        WHERE organization_id = $1 AND severity IN ('high', 'critical')
          AND status IN ('reported', 'investigating')
      `, [orgId]),
    ]);
    const notifResult = await query(
      `SELECT COUNT(*)::int as count FROM notifications WHERE user_id = $1 AND read = FALSE`,
      [userId]
    );

    // Satisfaction average
    const satResult = await query(
      `SELECT ROUND(AVG(rating)::numeric, 1) as avg_rating, COUNT(*)::int as total
       FROM satisfaction_surveys WHERE organization_id = $1`,
      [orgId]
    );

    // Staff compliance breakdown
    const compBreakdown = await query(
      `SELECT
         COUNT(*)::int as total_active,
         COUNT(*) FILTER (WHERE COALESCE(
           (SELECT ROUND(COUNT(*) FILTER (WHERE cr.status = 'complete')::numeric / NULLIF(COUNT(*), 0) * 100, 0)
            FROM compliance_records cr WHERE cr.staff_id = sp.id), 0
         ) >= COALESCE((SELECT minimum_compliance_percent FROM organizations WHERE id = $1), 70))::int as compliant_count,
         COUNT(*) FILTER (WHERE COALESCE(
           (SELECT ROUND(COUNT(*) FILTER (WHERE cr.status = 'complete')::numeric / NULLIF(COUNT(*), 0) * 100, 0)
            FROM compliance_records cr WHERE cr.staff_id = sp.id), 0
         ) < COALESCE((SELECT minimum_compliance_percent FROM organizations WHERE id = $1), 70))::int as below_threshold
       FROM staff_profiles sp
       JOIN users u ON sp.user_id = u.id
       WHERE u.organization_id = $1 AND u.status = 'active'`,
      [orgId]
    );

    return {
      dbs_expiring_soon: dbsResult.rows[0]?.count ?? 0,
      training_expiring_soon: trainingResult.rows[0]?.count ?? 0,
      pending_leave_requests: leaveResult.rows[0]?.count ?? 0,
      unread_notifications: notifResult.rows[0]?.count ?? 0,
      overdue_medications: overdueResult.rows[0]?.count ?? 0,
      competency_due: competencyResult.rows[0]?.count ?? 0,
      staff_below_threshold: belowThresholdResult.rows[0]?.count ?? 0,
      open_severe_incidents: openIncidentsResult.rows[0]?.count ?? 0,
      satisfaction_avg: satResult.rows[0]?.avg_rating || null,
      satisfaction_total: satResult.rows[0]?.total || 0,
      compliance_breakdown: compBreakdown.rows[0] || { total_active: 0, compliant_count: 0, below_threshold: 0 },
    };
  }

  static async getComplianceSnapshot(orgId: string) {
    // Training stats from training_records
    const trainingResult = await query(`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE tr.status = 'completed')::int as complete
      FROM training_records tr
      JOIN training_modules tm ON tr.module_id = tm.id
      WHERE tm.organization_id = $1
    `, [orgId]);

    // Document-based stats (DBS, identity, professional)
    const docResult = await query(`
      SELECT
        COALESCE(SUM(CASE WHEN d.type = 'DBS' THEN 1 ELSE 0 END), 0) as dbs_total,
        COALESCE(SUM(CASE WHEN d.type = 'DBS' AND d.status = 'approved' THEN 1 ELSE 0 END), 0) as dbs_complete,
        COALESCE(SUM(CASE WHEN d.type IN ('PASSPORT', 'VISA', 'RIGHT_TO_WORK') THEN 1 ELSE 0 END), 0) as identity_total,
        COALESCE(SUM(CASE WHEN d.type IN ('PASSPORT', 'VISA', 'RIGHT_TO_WORK') AND d.status = 'approved' THEN 1 ELSE 0 END), 0) as identity_complete
      FROM documents d
      JOIN staff_profiles sp ON sp.id = d.staff_id
      JOIN users u ON u.id = sp.user_id
      WHERE u.organization_id = $1
    `, [orgId]);

    const training = trainingResult.rows[0] || { total: 0, complete: 0 };
    const docs = docResult.rows[0] || { dbs_total: 0, dbs_complete: 0, identity_total: 0, identity_complete: 0 };

    const calcPct = (complete: number, total: number) =>
      total > 0 ? Math.round((complete / total) * 100) : 0;

    return [
      { label: 'Mandatory Training', val: calcPct(training.complete, training.total), color: '#16A34A' },
      { label: 'DBS Verifications', val: calcPct(docs.dbs_complete, docs.dbs_total), color: '#16A34A' },
      { label: 'Identity Checks', val: calcPct(docs.identity_complete, docs.identity_total), color: '#D97706' },
    ];
  }

  static async getTodayRota(orgId: string, userId?: string) {
    const userFilter = userId
      ? `AND EXISTS (SELECT 1 FROM shift_assignments sa3 JOIN staff_profiles sp4 ON sp4.id = sa3.staff_id WHERE sa3.shift_id = sh.id AND sp4.user_id = $2)`
      : '';
    const params = userId ? [orgId, userId] : [orgId];
    const result = await query(`
      SELECT
        sh.id,
        sh.start_time,
        sh.end_time,
        sh.status,
        l.name as location_name,
        COALESCE(
          (SELECT string_agg(u2.email, ', ') FROM shift_assignments sa2
           JOIN staff_profiles sp2 ON sp2.id = sa2.staff_id
           JOIN users u2 ON u2.id = sp2.user_id
           WHERE sa2.shift_id = sh.id),
          ''
        ) as assigned_staff
      FROM shifts sh
      JOIN locations l ON l.id = sh.location_id
      WHERE l.organization_id = $1
        AND sh.start_time >= CURRENT_DATE
        AND sh.start_time < CURRENT_DATE + INTERVAL '1 day'
        ${userFilter}
      ORDER BY sh.start_time
      LIMIT 10
    `, params);
    return result.rows;
  }

  static async getReviewScheduler(orgId: string) {
    const result = await query(`
      SELECT * FROM (
        SELECT 'care_plan' AS entity_type, cp.id, su.first_name || ' ' || su.last_name AS person, cp.title AS item_name,
          cp.review_date AS due_date, cp.status, su.id AS person_id
        FROM care_plans cp JOIN people su ON cp.person_id = su.id
        WHERE su.organization_id = $1 AND cp.review_date IS NOT NULL
        UNION ALL
        SELECT 'risk_assessment' AS entity_type, ra.id, su.first_name || ' ' || su.last_name, ra.type,
          ra.review_date, ra.risk_level, su.id
        FROM risk_assessments ra JOIN people su ON ra.person_id = su.id
        WHERE su.organization_id = $1 AND ra.review_date IS NOT NULL
        UNION ALL
        SELECT 'care_assessment' AS entity_type, ca.id, su.first_name || ' ' || su.last_name, ca.assessment_type,
          ca.next_review_date, ca.status, su.id
        FROM care_assessments ca JOIN people su ON ca.person_id = su.id
        WHERE su.organization_id = $1 AND ca.next_review_date IS NOT NULL
        UNION ALL
        SELECT 'dnacpr' AS entity_type, su.id, su.first_name || ' ' || su.last_name, 'DNACPR Review',
          su.dnacpr_review_date, su.dnacpr_status, su.id
        FROM people su WHERE su.organization_id = $1 AND su.dnacpr_review_date IS NOT NULL
        UNION ALL
        SELECT 'capacity' AS entity_type, ca2.id, su2.first_name || ' ' || su2.last_name,
          'MCA: ' || LEFT(ca2.decision_to_be_made, 50), ca2.review_date, ca2.capacity_status, su2.id
        FROM person_capacity_assessments ca2 JOIN people su2 ON ca2.person_id = su2.id
        WHERE su2.organization_id = $1 AND ca2.review_date IS NOT NULL
        UNION ALL
        SELECT 'goal' AS entity_type, g.id, su3.first_name || ' ' || su3.last_name, g.title,
          g.review_date, g.status, su3.id
        FROM person_goals g JOIN people su3 ON g.person_id = su3.id
        WHERE su3.organization_id = $1 AND g.review_date IS NOT NULL
      ) reviews
      ORDER BY due_date ASC
    `, [orgId]);
    return result.rows;
  }
}
