import { query } from '../../shared/database'

export async function getStaffComplianceData(orgId: string) {
  const staff = await query(
    `SELECT sp.first_name, sp.last_name, sp.compliance_profile,
            d.document_status as dbs_status,
            CASE WHEN EXISTS (SELECT 1 FROM training_records tr2 JOIN training_modules tm2 ON tr2.module_id = tm2.id WHERE tr2.staff_id = sp.id AND tm2.is_mandatory = true AND tr2.status = 'expired') THEN 'expired' ELSE 'valid' END as training_status,
            sp.updated_at as last_review,
            COALESCE(
              (SELECT ROUND(AVG(CASE WHEN tr.status = 'completed' THEN 100.0 ELSE 0 END)) FROM training_records tr WHERE tr.staff_id = sp.id)
            , 0) as compliance_rate
     FROM staff_profiles sp
     LEFT JOIN LATERAL (
       SELECT CASE WHEN d.expiry_date < NOW() THEN 'expired' ELSE 'valid' END as document_status
       FROM documents d WHERE d.staff_id = sp.id AND d.type = 'DBS' ORDER BY d.created_at DESC LIMIT 1
     ) d ON true
     WHERE sp.organization_id = $1
     ORDER BY sp.first_name`,
    [orgId]
  )
  const compliant_count = staff.rows.filter((s: any) => Number(s.compliance_rate) >= 80).length
  const at_risk_count = staff.rows.filter((s: any) => Number(s.compliance_rate) < 80).length
  return { staff: staff.rows, compliant_count, at_risk_count }
}

export async function getTrainingMatrixData(orgId: string) {
  const records = await query(
    `SELECT sp.first_name, sp.last_name, tm.name as module_name, tm.category as module_category,
            tr.status, tr.completed_at, tr.expires_at
     FROM training_records tr
     JOIN staff_profiles sp ON tr.staff_id = sp.id
     JOIN training_modules tm ON tr.module_id = tm.id
     WHERE sp.organization_id = $1
     ORDER BY sp.first_name, tm.name`,
    [orgId]
  )
  return { records: records.rows }
}

export async function getIncidentLogData(orgId: string) {
  const incidents = await query(
    `SELECT i.occurred_at, i.created_at, i.title, i.category as incident_type, i.severity, i.status, i.resolution,
            l.name as location_name,
            u.first_name as reported_by_first, u.last_name as reported_by_last
     FROM incidents i
     LEFT JOIN locations l ON i.location_id = l.id
     LEFT JOIN users u ON i.reported_by = u.id
     WHERE i.organization_id = $1
     ORDER BY i.occurred_at DESC`,
    [orgId]
  )
  return { incidents: incidents.rows }
}

export async function getLeaveOverviewData(orgId: string) {
  const balances = await query(
    `SELECT sp.first_name, sp.last_name,
            lb.days_allocated, lb.days_taken,
            COALESCE(lb.days_remaining, lb.days_allocated - lb.days_taken) as days_remaining,
            (SELECT COALESCE(SUM(
              CASE WHEN lr.duration_type = 'hours' THEN CEIL(lr.hours_requested / 7.5)
                   ELSE (EXTRACT(EPOCH FROM lr.end_date - lr.start_date) / 86400 + 1)::int
              END), 0)
             FROM leave_requests lr WHERE lr.staff_id = sp.id AND lr.status = 'pending'
            ) as days_pending
     FROM leave_balances lb
     JOIN staff_profiles sp ON lb.staff_id = sp.id
     WHERE sp.organization_id = $1
     ORDER BY sp.first_name`,
    [orgId]
  )
  return { balances: balances.rows }
}

export async function getServiceUserRosterData(orgId: string) {
  const service_users = await query(
    `SELECT su.first_name, su.last_name, su.status, su.created_at, su.care_level,
            l.name as location_name,
            kw.first_name as key_worker_first, kw.last_name as key_worker_last
     FROM service_users su
     LEFT JOIN locations l ON su.location_id = l.id
     LEFT JOIN staff_profiles sp ON su.key_worker_id = sp.id
     LEFT JOIN users kw ON sp.user_id = kw.id
     WHERE su.organization_id = $1
     ORDER BY l.name, su.first_name`,
    [orgId]
  )
  return { service_users: service_users.rows }
}

export async function getMedicationAdminData(orgId: string) {
  const medications = await query(
    `SELECT m.name as medication_name,
            COALESCE(
              (SELECT STRING_AGG(DISTINCT a.admin_time::text, ', ') FROM administrations a WHERE a.medication_id = m.id),
              '-'
            ) as scheduled_times,
            ROUND(
              CASE WHEN COUNT(a.id) > 0
                THEN SUM(CASE WHEN a.status = 'administered' OR a.status = 'self_administered' THEN 100.0 ELSE 0 END) / COUNT(a.id)
                ELSE 0
              END, 1
            ) as administered_pct,
            COUNT(a.id) FILTER (WHERE a.status = 'missed') as missed_count,
            COUNT(a.id) FILTER (WHERE a.status = 'refused') as refused_count,
            COUNT(a.id) FILTER (WHERE a.status = 'self_administered') as self_administered_count
     FROM medications m
     JOIN mar_records mr ON m.mar_record_id = mr.id
     LEFT JOIN administrations a ON a.medication_id = m.id
     WHERE mr.organization_id = $1
     GROUP BY m.id, m.name
     ORDER BY m.name`,
    [orgId]
  )
  return { medications: medications.rows }
}

export async function getServiceUserOutcomesData(orgId: string) {
  const serviceUsers = await query(
    `SELECT su.id, su.first_name, su.last_name,
      (SELECT COUNT(*)::int FROM service_user_goals g WHERE g.service_user_id = su.id AND g.organization_id = $1) AS total_goals,
      (SELECT COUNT(*)::int FROM service_user_goals g WHERE g.service_user_id = su.id AND g.organization_id = $1 AND g.status = 'completed') AS completed_goals,
      (SELECT ROUND(AVG(g.progress))::int FROM service_user_goals g WHERE g.service_user_id = su.id AND g.organization_id = $1 AND g.status = 'active') AS avg_progress,
      (SELECT ROUND(AVG(w.score), 1)::numeric FROM su_wellbeing w WHERE w.service_user_id = su.id AND w.recorded_date >= CURRENT_DATE - 30) AS avg_wellbeing,
      (SELECT COUNT(*)::int FROM outcome_scale_results osr WHERE osr.service_user_id = su.id) AS scale_assessments
     FROM service_users su WHERE su.organization_id = $1 AND su.status = 'active'
     ORDER BY su.first_name`,
    [orgId]
  );
  return { service_users: serviceUsers.rows }
}

export async function getOrgOutcomesSummaryData(orgId: string) {
  const goalStats = await query(`
    SELECT
      COUNT(*)::int AS total_goals,
      COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_goals,
      COUNT(*) FILTER (WHERE status = 'active')::int AS active_goals,
      COUNT(*) FILTER (WHERE status = 'active' AND review_date < CURRENT_DATE)::int AS overdue_reviews,
      ROUND(AVG(progress) FILTER (WHERE status = 'active'))::int AS avg_progress
    FROM service_user_goals WHERE organization_id = $1
  `, [orgId]);

  const byCqcDomain = await query(`
    SELECT cqc_domain,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
    FROM service_user_goals WHERE organization_id = $1 AND cqc_domain IS NOT NULL
    GROUP BY cqc_domain ORDER BY cqc_domain
  `, [orgId]);

  const wellbeingAvg = await query(`
    SELECT w.domain, ROUND(AVG(w.score), 1)::numeric AS avg_score, COUNT(*)::int AS entries
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

  return {
    goal_stats: goalStats.rows[0],
    by_cqc_domain: byCqcDomain.rows,
    wellbeing_avg: wellbeingAvg.rows,
    scale_distribution: scaleDistribution.rows,
  }
}

export type ReportType = 'staff-compliance' | 'training-matrix' | 'incident-log' | 'leave-overview' | 'service-user-roster' | 'medication-admin' | 'service-user-outcomes' | 'org-outcomes-summary'

export async function getReportData(type: ReportType, orgId: string) {
  switch (type) {
    case 'staff-compliance': return getStaffComplianceData(orgId)
    case 'training-matrix': return getTrainingMatrixData(orgId)
    case 'incident-log': return getIncidentLogData(orgId)
    case 'leave-overview': return getLeaveOverviewData(orgId)
    case 'service-user-roster': return getServiceUserRosterData(orgId)
    case 'medication-admin': return getMedicationAdminData(orgId)
    case 'service-user-outcomes': return getServiceUserOutcomesData(orgId)
    case 'org-outcomes-summary': return getOrgOutcomesSummaryData(orgId)
  }
}
