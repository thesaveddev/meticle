import { query } from '../../shared/database';
import { vettingDocumentTypeSql } from '../compliance/compliance.vetting';

// Counts of expiring identity documents, by each person's own nation's scheme
// rather than one England-and-Wales list.
const RESOLVED_VETTING_SCHEME_SQL = 'COALESCE(sp.vetting_scheme, o.vetting_scheme)';
const VETTING_DOC_TYPES_SQL = vettingDocumentTypeSql(RESOLVED_VETTING_SCHEME_SQL);
// The background check itself, excluding right-to-work documents.
const VETTING_CHECK_TYPES_SQL = vettingDocumentTypeSql(RESOLVED_VETTING_SCHEME_SQL, 'check');
// Every document a person's nation accepts, check and right-to-work together.
const VETTING_IDENTITY_TYPES_SQL = vettingDocumentTypeSql(RESOLVED_VETTING_SCHEME_SQL);

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
        (SELECT COUNT(*)::int FROM incidents WHERE organization_id = $1 AND status IN ('reported', 'investigating')) as open_incidents,
        (SELECT COUNT(*)::int FROM locations WHERE organization_id = $1) as locations
    `, [orgId]);
    return result.rows[0];
  }

  static async getWidgets(orgId: string, userId: string) {
    const [dbsResult, trainingResult, leaveResult, overdueResult, competencyResult, belowThresholdResult, openIncidentsResult] = await Promise.all([
      query(`
        SELECT COUNT(DISTINCT d.staff_id)::int as count FROM documents d
        JOIN staff_profiles sp ON d.staff_id = sp.id
        JOIN users u ON u.id = sp.user_id
        JOIN organizations o ON o.id = u.organization_id
        WHERE u.organization_id = $1 AND d.type = ANY(${VETTING_DOC_TYPES_SQL}) AND d.status = 'approved'
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

    // Document-based stats.
    //
    // The background-check count was `d.type = 'DBS'`, so a Scottish provider's
    // PVG records and a Northern Irish provider's AccessNI checks were invisible
    // and the tile read 0%. Derived from the registry like everything else, and
    // named "checks" rather than "DBS" because DBS is only England's.
    const docResult = await query(`
      SELECT
        COALESCE(SUM(CASE WHEN d.type = ANY(${VETTING_CHECK_TYPES_SQL}) THEN 1 ELSE 0 END), 0) as checks_total,
        COALESCE(SUM(CASE WHEN d.type = ANY(${VETTING_CHECK_TYPES_SQL}) AND d.status = 'approved' THEN 1 ELSE 0 END), 0) as checks_complete,
        COALESCE(SUM(CASE WHEN d.type = ANY(${VETTING_IDENTITY_TYPES_SQL}) THEN 1 ELSE 0 END), 0) as identity_total,
        COALESCE(SUM(CASE WHEN d.type = ANY(${VETTING_IDENTITY_TYPES_SQL}) AND d.status = 'approved' THEN 1 ELSE 0 END), 0) as identity_complete
      FROM documents d
      JOIN staff_profiles sp ON sp.id = d.staff_id
      JOIN users u ON u.id = sp.user_id
      JOIN organizations o ON o.id = u.organization_id
      WHERE u.organization_id = $1
    `, [orgId]);

    const training = trainingResult.rows[0] || { total: 0, complete: 0 };
    const docs = docResult.rows[0] || { checks_total: 0, checks_complete: 0, identity_total: 0, identity_complete: 0 };

    const calcPct = (complete: number, total: number) =>
      total > 0 ? Math.round((complete / total) * 100) : 0;

    return [
      { label: 'Mandatory Training', val: calcPct(training.complete, training.total), color: '#16A34A' },
      { label: 'Background Checks', val: calcPct(docs.checks_complete, docs.checks_total), color: '#16A34A' },
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

  static async getDomiciliarySummary(orgId: string) {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const [visitsResult, exceptionsResult, packagesResult] = await Promise.all([
      query(`
        SELECT v.id, v.status, v.scheduled_start, v.scheduled_end, v.label,
               pe.first_name || ' ' || pe.last_name AS person_name,
               sp.first_name || ' ' || sp.last_name AS carer_name
        FROM homecare_visits v
        JOIN people pe ON pe.id = v.person_id
        LEFT JOIN staff_profiles sp ON sp.id = v.assigned_staff_id
        WHERE v.organization_id = $1
          AND v.scheduled_start >= $2
          AND v.scheduled_start < $3
        ORDER BY v.scheduled_start
      `, [orgId, today, tomorrow]),
      query(`
        SELECT COUNT(*) AS exception_count
        FROM homecare_visits
        WHERE organization_id = $1
          AND status IN ('late', 'missed', 'cancelled')
          AND scheduled_start >= $2
      `, [orgId, today]),
      query(`
        SELECT COUNT(*) AS package_count,
               COUNT(*) FILTER (WHERE status = 'active') AS active_count
        FROM homecare_packages
        WHERE organization_id = $1
      `, [orgId]),
    ]);

    return {
      today_visits: visitsResult.rows,
      today_exceptions: Number(exceptionsResult.rows[0]?.exception_count ?? 0),
      today_total: visitsResult.rows.length,
      today_completed: visitsResult.rows.filter((v: any) => v.status === 'completed').length,
      today_in_progress: visitsResult.rows.filter((v: any) => v.status === 'checked_in' || v.status === 'en_route').length,
      total_packages: Number(packagesResult.rows[0]?.package_count ?? 0),
      active_packages: Number(packagesResult.rows[0]?.active_count ?? 0),
    };
  }

  /**
   * One aggregate for the redesigned dashboard (brief phases 7–8):
   * people-you're-supporting, today's tasks, care-notes activity,
   * medication overview and today's appointments. Four queries instead of the
   * frontend fanning out to five endpoints; each section degrades independently
   * on the client, but the server keeps them consistent to the same instant.
   */
  static async getDailyOverview(orgId: string) {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(new Date(today).getTime() + 86400000).toISOString().split('T')[0];

    const [peopleResult, tasksResult, notesResult, medsResult, apptsResult] = await Promise.all([
      // People you're supporting: active people with room, flags and the next
      // scheduled event (appointment or medication) that drives the "next task".
      query(`
        SELECT p.id, p.first_name, p.last_name, p.room_number, p.photo_url, p.flags,
          (SELECT COUNT(*)::int FROM risk_assessments ra WHERE ra.person_id = p.id AND ra.risk_level IN ('high','critical')) AS open_risks,
          (SELECT COUNT(*)::int FROM daily_notes dn WHERE dn.person_id = p.id AND dn.note_date = $2) AS notes_today,
          (SELECT a.title FROM appointments a WHERE a.person_id = p.id AND a.start_time >= NOW() AND a.status = 'scheduled' ORDER BY a.start_time LIMIT 1) AS next_event,
          (SELECT a.start_time FROM appointments a WHERE a.person_id = p.id AND a.start_time >= NOW() AND a.status = 'scheduled' ORDER BY a.start_time LIMIT 1) AS next_event_time,
          (SELECT mi2.name FROM emedication_administrations a2
             JOIN emedication_items mi2 ON mi2.id = a2.emedication_item_id
             JOIN emedication_records r2 ON r2.id = mi2.emedication_record_id
           WHERE r2.person_id = p.id AND r2.status = 'active' AND mi2.is_active = TRUE
             AND a2.status = 'pending' AND a2.scheduled_time >= NOW()
           ORDER BY a2.scheduled_time LIMIT 1) AS next_medication
        FROM people p
        WHERE p.organization_id = $1 AND p.status = 'active'
        ORDER BY p.last_name, p.first_name
        LIMIT 8
      `, [orgId, today]),
      // Today's tasks: open tasks due today (or overdue), completing flag included.
      query(`
        SELECT t.id, t.title, t.status, t.priority, t.due_date, t.completed_at,
               p.first_name || ' ' || p.last_name AS person_name
        FROM tasks t
        LEFT JOIN people p ON p.id = t.person_id
        WHERE t.organization_id = $1
          AND (t.status != 'completed')
          AND (t.due_date IS NULL OR t.due_date < $2)
        ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, t.due_date ASC NULLS LAST
        LIMIT 8
      `, [orgId, tomorrow]),
      // Care-notes activity: today's daily notes and medication administrations
      // in one timeline, newest first.
      query(`
        (
          SELECT dn.id, dn.created_at, 'care_note' AS kind, dn.category AS summary_title,
                 LEFT(dn.content, 90) AS summary, pe.first_name || ' ' || pe.last_name AS person_name, pe.photo_url
          FROM daily_notes dn
          JOIN people pe ON pe.id = dn.person_id
          WHERE pe.organization_id = $1 AND dn.note_date = $2
          ORDER BY dn.created_at DESC
          LIMIT 12
        )
        UNION ALL
        (
          SELECT a.id, COALESCE(a.administered_time, a.created_at) AS created_at, 'medication' AS kind,
                 mi.name AS summary_title, a.status AS summary,
                 pe.first_name || ' ' || pe.last_name AS person_name, pe.photo_url
          FROM emedication_administrations a
          JOIN emedication_items mi ON mi.id = a.emedication_item_id
          JOIN emedication_records r ON r.id = mi.emedication_record_id
          JOIN people pe ON pe.id = r.person_id
          WHERE r.organization_id = $1 AND r.status = 'active'
            AND COALESCE(a.administered_time, a.created_at) >= $2
            AND a.status != 'pending'
          ORDER BY created_at DESC
          LIMIT 12
        )
        ORDER BY created_at DESC
        LIMIT 10
      `, [orgId, today]),
      // Medication overview: today's due counts for the donut.
      query(`
        SELECT
          COUNT(*) FILTER (WHERE a.status = 'pending' AND a.scheduled_time < NOW())::int AS due_now,
          COUNT(*) FILTER (WHERE a.status = 'pending' AND a.scheduled_time >= NOW())::int AS upcoming,
          COUNT(*) FILTER (WHERE a.status IN ('given'))::int AS completed
        FROM emedication_administrations a
        JOIN emedication_items mi ON mi.id = a.emedication_item_id
        JOIN emedication_records r ON r.id = mi.emedication_record_id
        WHERE r.organization_id = $1 AND r.status = 'active' AND mi.is_active = TRUE
          AND a.scheduled_time >= $2 AND a.scheduled_time < $3
      `, [orgId, today, tomorrow]),
      // Today's upcoming appointments.
      query(`
        SELECT a.id, a.title, a.start_time, a.status,
               pe.first_name || ' ' || pe.last_name AS person_name, pe.room_number, pe.photo_url
        FROM appointments a
        JOIN people pe ON pe.id = a.person_id
        WHERE a.organization_id = $1 AND a.start_time >= $2 AND a.start_time < $3
          AND a.status = 'scheduled'
        ORDER BY a.start_time
        LIMIT 6
      `, [orgId, today, tomorrow]),
    ]);

    const people = peopleResult.rows.map((row: any) => {
      const nextMedication = row.next_medication || null;
      const nextEvent = row.next_event || null;
      const nextEventTime = row.next_event_time || null;
      const nextTask = nextEvent
        ? { label: nextEvent, time: nextEventTime }
        : nextMedication
          ? { label: 'Medication', time: null }
          : null;
      // Status derives from real signals: high/critical risks -> under review,
      // flags -> needs support, otherwise stable.
      const status = (row.open_risks ?? 0) > 0 ? 'under_review' : ((row.flags?.length ?? 0) > 0 ? 'needs_support' : 'stable');
      return {
        id: row.id,
        name: `${row.first_name} ${row.last_name}`.trim(),
        room: row.room_number || null,
        photo_url: row.photo_url || null,
        status,
        notes_today: row.notes_today ?? 0,
        next_task: nextTask,
      };
    });

    return {
      people,
      tasks: tasksResult.rows.map((t: any) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        due_date: t.due_date,
        person_name: t.person_name || null,
      })),
      activity: notesResult.rows.map((n: any) => ({
        id: n.id,
        kind: n.kind,
        time: n.created_at,
        title: n.summary_title,
        summary: n.summary,
        person_name: n.person_name,
        photo_url: n.photo_url || null,
      })),
      medication: {
        due_now: Number(medsResult.rows[0]?.due_now ?? 0),
        upcoming: Number(medsResult.rows[0]?.upcoming ?? 0),
        completed: Number(medsResult.rows[0]?.completed ?? 0),
      },
      appointments: apptsResult.rows.map((a: any) => ({
        id: a.id,
        title: a.title,
        start_time: a.start_time,
        status: a.status,
        person_name: a.person_name,
        room: a.room_number || null,
        photo_url: a.photo_url || null,
      })),
    };
  }
}
