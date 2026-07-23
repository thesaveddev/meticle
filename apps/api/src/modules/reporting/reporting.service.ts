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

export type ReportType = 'staff-compliance' | 'training-matrix' | 'incident-log' | 'leave-overview' | 'service-user-roster' | 'medication-admin'

export async function getReportData(type: ReportType, orgId: string) {
  switch (type) {
    case 'staff-compliance': return getStaffComplianceData(orgId)
    case 'training-matrix': return getTrainingMatrixData(orgId)
    case 'incident-log': return getIncidentLogData(orgId)
    case 'leave-overview': return getLeaveOverviewData(orgId)
    case 'service-user-roster': return getServiceUserRosterData(orgId)
    case 'medication-admin': return getMedicationAdminData(orgId)
  }
}
