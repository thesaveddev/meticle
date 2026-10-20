import { query } from '../../shared/database';
import { vettingDocumentTypeSql } from '../compliance/compliance.vetting';
import { HANDOVER_GRACE_MINUTES } from '../scheduling/shiftHandoverDue';

// Nation-aware identity documents. ENHANCED_DBS is a legacy type that nothing
// writes today, kept only in this alert's type list so historical rows do not
// silently stop producing an expiry warning; it is not a requirement anywhere.
const VETTING_DOC_TYPES_SQL = vettingDocumentTypeSql('COALESCE(sp.vetting_scheme, o.vetting_scheme)');

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
        // A shift that ended with no handover belongs here with the other staffing
        // gaps: it is a shift that ran without its responsibility being handed on.
        staffing: ["alert_type IN ('shift.unfilled', 'shift.understaffed', 'shift.handover_due', 'staffing.coverage_low')"],
        safety: ["alert_type IN ('incident.action_overdue')"],
        // A room with no check today is a missing daily safety and cleanliness
        // record, so it is an evidence gap a manager filters for — the same place
        // they would look for an expiring certificate. Filing it under no category
        // at all is what made §9.9's alert invisible once a filter was applied.
        compliance: ["alert_type IN ('training.expiring', 'dbs.expiring', 'policy.review_due', 'room_check.overdue')"],
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
         COUNT(*) FILTER (WHERE alert_type IN ('shift.unfilled', 'shift.understaffed', 'shift.handover_due', 'staffing.coverage_low', 'incident.action_overdue') AND dismissed = FALSE)::int AS staffing_safety,
         -- These lists must match the category filter above, or the chip counts and
         -- the filtered rows disagree — the drift audit §3.5 keeps finding.
         COUNT(*) FILTER (WHERE alert_type IN ('training.expiring', 'dbs.expiring', 'policy.review_due', 'room_check.overdue') AND dismissed = FALSE)::int AS compliance,
         COUNT(*) FILTER (WHERE alert_type IN ('care_plan.review_due', 'fluid.intake_below_target', 'nutrition.appetite_decline', 'nutrition.refused_meal') AND dismissed = FALSE)::int AS care
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
         AND NOT EXISTS (
           SELECT 1 FROM shift_assignments assigned
           WHERE assigned.shift_id = s.id AND assigned.status IN ('assigned', 'accepted')
         )
         AND s.status NOT IN ('cancelled', 'completed')
         AND s.start_time > CURRENT_TIMESTAMP
         AND s.start_time < CURRENT_TIMESTAMP + interval '24 hours'`,
      [orgId]
    );

    // Understaffed shifts (below configured location minimum), including
    // completely unfilled shifts so the operational count matches coverage.
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
         HAVING COUNT(sa.id) FILTER (WHERE sa.status IN ('assigned', 'accepted')) < l.minimum_staff_per_day
       ) sub`,
      [orgId]
    );

    // Coverage is the average staffed share of each location's configured
    // minimum across active shifts in the next seven days. Keep scheduled shifts
    // with no assignee in the denominator so a wholly uncovered shift is a
    // critical gap rather than disappearing from the calculation.
    const staffingCoverage = await query(
      `WITH shift_coverage AS (
         SELECT s.id AS shift_id, s.location_id, l.name AS location_name,
                s.start_time, s.end_time, s.shift_type,
                l.minimum_staff_per_day AS minimum_staff,
                COUNT(sa.id) FILTER (WHERE sa.status IN ('assigned', 'accepted'))::int AS assigned_staff,
                CASE WHEN l.minimum_staff_per_day > 0
                     THEN LEAST(COUNT(sa.id) FILTER (WHERE sa.status IN ('assigned', 'accepted'))::numeric / l.minimum_staff_per_day, 1)
                     ELSE 1 END AS coverage_ratio
         FROM shifts s
         JOIN locations l ON l.id = s.location_id
         LEFT JOIN shift_assignments sa ON sa.shift_id = s.id
         WHERE l.organization_id = $1
           AND s.status NOT IN ('cancelled', 'completed')
           AND s.end_time > CURRENT_TIMESTAMP
           AND s.start_time < CURRENT_TIMESTAMP + interval '7 days'
           AND l.minimum_staff_per_day > 0
         GROUP BY s.id, l.id, l.name, s.start_time, s.end_time, s.shift_type, l.minimum_staff_per_day
       )
       SELECT COUNT(c.shift_id)::int AS shifts_with_target,
              COUNT(*) FILTER (WHERE assigned_staff < minimum_staff)::int AS below_minimum_shifts,
              COUNT(*) FILTER (WHERE assigned_staff = 0)::int AS unstaffed_shifts,
              COALESCE(ROUND(AVG(coverage_ratio) * 100), 100)::int AS coverage_percent,
              COALESCE(SUM(GREATEST(minimum_staff - assigned_staff, 0)), 0)::int AS staffing_shortfall,
              COALESCE(o.minimum_staffing_coverage_percent, 100)::int AS required_coverage_percent,
              COALESCE(json_agg(json_build_object(
                'shift_id', c.shift_id,
                'location_id', c.location_id,
                'location_name', c.location_name,
                'start_time', c.start_time,
                'end_time', c.end_time,
                'shift_type', c.shift_type,
                'minimum_staff', c.minimum_staff,
                'assigned_staff', c.assigned_staff,
                'shortfall', GREATEST(c.minimum_staff - c.assigned_staff, 0),
                'coverage_percent', ROUND(c.coverage_ratio * 100)::int
              ) ORDER BY c.start_time) FILTER (WHERE c.assigned_staff < c.minimum_staff), '[]'::json) AS affected_shifts
       FROM organizations o
       LEFT JOIN shift_coverage c ON TRUE
       WHERE o.id = $1
       GROUP BY o.minimum_staffing_coverage_percent`,
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

    // Expiring background checks. Counted by each person's own nation's scheme,
    // so a Scottish PVG certificate counts here the way a DBS does in England.
    const expiringDbs = await query(
      `SELECT COUNT(*)::int AS count
       FROM documents d
       JOIN staff_profiles sp ON d.staff_id = sp.id
       JOIN users u ON sp.user_id = u.id
       JOIN organizations o ON o.id = u.organization_id
       WHERE u.organization_id = $1
         AND u.status = 'active'
         AND (d.type = ANY(${VETTING_DOC_TYPES_SQL}) OR d.type = 'ENHANCED_DBS')
         AND d.status NOT IN ('expired', 'rejected')
         AND d.expiry_date IS NOT NULL
         AND d.expiry_date <= CURRENT_DATE + interval '30 days'
         AND d.expiry_date >= CURRENT_DATE`,
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
      staffing_coverage: staffingCoverage.rows[0] || {
        shifts_with_target: 0, below_minimum_shifts: 0, unstaffed_shifts: 0,
        coverage_percent: 100,
        staffing_shortfall: 0,
        required_coverage_percent: 100,
        affected_shifts: [],
      },
      expiring_training: expiringTraining.rows[0]?.count || 0,
      expiring_dbs: expiringDbs.rows[0]?.count || 0,
      overdue_care_plan_reviews: overdueCarePlanReviews.rows[0]?.count || 0,
      overdue_policy_reviews: overduePolicyReviews.rows[0]?.count || 0,
      low_fluid_intake: lowFluid.rows[0]?.count || 0,
      overdue_incident_actions: overdueIncidentActions.rows[0]?.count || 0,
    };
  }

  /**
   * Shifts that ended with nobody's handover recorded.
   *
   * The handover-due sweep (§9.9) notices this state and nudges the staff who were
   * on the shift, but a nudge is not a record: it is one notification, marked sent
   * once per shift (`handover_due_notified_at`), and after 24 hours the sweep stops
   * looking. A manager asking "which shifts this week ended without a handover?" had
   * no way to answer it — the alert may have been dismissed, and the sweep's window
   * is deliberately short.
   *
   * So this reads the state itself rather than the alerts: a supported-living shift
   * that has ended, with staff on it, and no `shift_handovers` row. Three decisions
   * keep it honest rather than noisy:
   *
   *  * **The same grace period as the sweep.** A shift that ended ten minutes ago is
   *    one somebody is still writing up. `HANDOVER_GRACE_MINUTES` is imported from the
   *    sweep rather than repeated, because two copies drift and the drift is silent.
   *  * **Only shifts with somebody on them.** A shift that ended with no roster has
   *    nobody to write a handover and no responsibility to transfer; that is
   *    `shift.unfilled`'s business, not this one's.
   *  * **The rota's own employees.** Rostered names come from the same joins the sweep
   *    notifies, so the manager sees exactly who was told — including a worker whose
   *    account has since been deactivated, who is deliberately not listed, because
   *    the notification did not reach them either.
   *
   * Cancelled shifts are excluded: a shift that did not happen hands nothing over.
   * `staff_notified` distinguishes "we already nudged them" from "nobody has been
   * told", which is the difference between a chase and a first warning.
   */
  static async getHandoverGaps(orgId: string, days = 7) {
    const windowDays = Math.min(Math.max(Math.trunc(days) || 7, 1), 30);
    const result = await query(
      `SELECT s.id AS shift_id, s.shift_type, s.start_time, s.end_time,
              l.id AS location_id, l.name AS location_name,
              (s.handover_due_notified_at IS NOT NULL) AS staff_notified,
              FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - s.end_time)) / 3600)::int AS hours_since_end,
              JSON_AGG(JSON_BUILD_OBJECT(
                'user_id', sp.user_id,
                'name', COALESCE(NULLIF(TRIM(sp.first_name || ' ' || sp.last_name), ''), u.email)
              ) ORDER BY sp.first_name, sp.last_name) AS rostered,
              COUNT(*) OVER ()::int AS total_matches
       FROM shifts s
       JOIN locations l ON l.id = s.location_id
       JOIN shift_assignments sa ON sa.shift_id = s.id AND sa.status <> 'rejected'
       JOIN staff_profiles sp ON sp.id = sa.staff_id
       JOIN users u ON u.id = sp.user_id AND u.status = 'active'
       LEFT JOIN shift_handovers h ON h.shift_id = s.id
       WHERE l.organization_id = $1
         AND s.status <> 'cancelled'
         AND h.id IS NULL
         AND s.end_time <= CURRENT_TIMESTAMP - make_interval(mins => $3::int)
         AND s.end_time > CURRENT_TIMESTAMP - make_interval(days => $2::int)
       GROUP BY s.id, s.shift_type, s.start_time, s.end_time, l.id, l.name, s.handover_due_notified_at
       ORDER BY s.end_time DESC
       LIMIT 200`,
      [orgId, windowDays, HANDOVER_GRACE_MINUTES],
    );

    const rows = result.rows as Array<Record<string, any> & { total_matches: number }>;
    return {
      window_days: windowDays,
      grace_minutes: HANDOVER_GRACE_MINUTES,
      total: rows[0]?.total_matches ?? 0,
      shifts: rows.map(({ total_matches: _total, ...row }) => row),
    };
  }

  /* ═══════════════════════════════════════════════════════════
     DOMICILIARY CARE — Mission Control Summary
     Surfaces: missed calls, unassigned calls, overdue calls,
     compliance gaps, incidents, coverage, exception trends
     ═══════════════════════════════════════════════════════════ */

  static async getHomecareSummary(orgId: string, selectedDate?: string) {
    const today = selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)
      ? selectedDate
      : new Date().toISOString().split('T')[0];
    const tomorrow = new Date(`${today}T12:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const nextDate = tomorrow.toISOString().split('T')[0];

    // Missed calls today
    const missedCalls = await query(
      `SELECT COUNT(*)::int AS count FROM homecare_visits
       WHERE organization_id = $1 AND status = 'missed'
         AND scheduled_start >= $2::date AND scheduled_start < $3::date`, [orgId, today, nextDate]
    );

    // Unassigned calls today and upcoming
    const unassignedToday = await query(
      `SELECT COUNT(*)::int AS count FROM homecare_visits
       WHERE organization_id = $1 AND assigned_staff_id IS NULL
         AND status IN ('scheduled')
         AND scheduled_start >= $2::date AND scheduled_start < $3::date`, [orgId, today, nextDate]
    );

    const unassignedUpcoming = await query(
      `SELECT COUNT(*)::int AS count FROM homecare_visits
       WHERE organization_id = $1 AND assigned_staff_id IS NULL
         AND status IN ('scheduled')
         AND scheduled_start > NOW()
         AND scheduled_start <= NOW() + interval '3 days'`, [orgId]
    );

    // Overdue calls (should be completed but not checked in/out)
    const overdueCalls = await query(
      `SELECT COUNT(*)::int AS count FROM homecare_visits
       WHERE organization_id = $1 AND status IN ('scheduled', 'en_route')
         AND scheduled_end < NOW()`, [orgId]
    );

    // Completion belongs to the selected scheduled-call set, so it shares the
    // schedule's date window (and its denominator) instead of checkout date.
    const completedToday = await query(
      `SELECT COUNT(*)::int AS count FROM homecare_visits
       WHERE organization_id = $1 AND status = 'completed'
         AND scheduled_start >= $2::date AND scheduled_start < $3::date`, [orgId, today, nextDate]
    );

    // Total calls in the selected scheduled-call window.
    const totalToday = await query(
      `SELECT COUNT(*)::int AS count FROM homecare_visits
       WHERE organization_id = $1 AND scheduled_start >= $2::date AND scheduled_start < $3::date`, [orgId, today, nextDate]
    );

    // Carer compliance: training expiring within 14 days
    const trainingExpiring = await query(
      `SELECT COUNT(DISTINCT tr.staff_id)::int AS count
       FROM training_records tr
       JOIN training_modules tm ON tr.module_id = tm.id
       JOIN staff_profiles sp ON tr.staff_id = sp.id
       JOIN users u ON sp.user_id = u.id
       WHERE u.organization_id = $1 AND u.status = 'active'
         AND tr.status = 'completed' AND tr.expires_at IS NOT NULL
         AND tr.expires_at <= CURRENT_DATE + interval '14 days'`, [orgId]
    );

    // DBS / right-to-work expiring within 30 days
    const docsExpiring = await query(
      `SELECT COUNT(DISTINCT sp.id)::int AS count
       FROM documents d
       JOIN staff_profiles sp ON d.staff_id = sp.id
       JOIN users u ON sp.user_id = u.id
       JOIN organizations o ON o.id = u.organization_id
       WHERE u.organization_id = $1 AND u.status = 'active'
         AND d.status NOT IN ('expired', 'rejected')
         AND d.expiry_date IS NOT NULL
         AND d.expiry_date <= CURRENT_DATE + interval '30 days'
         AND d.expiry_date >= CURRENT_DATE
         AND (d.type = ANY(${VETTING_DOC_TYPES_SQL}) OR d.type = 'ENHANCED_DBS')`, [orgId]
    );

    // Open incidents needing follow-up
    // Match the incidents module/dashboard definition of open work exactly.
    const openIncidents = await query(
      `SELECT COUNT(*)::int AS count FROM incidents
       WHERE organization_id = $1 AND status IN ('reported', 'investigating')`, [orgId]
    );

    // Overdue incident actions
    const overdueIncidentActions = await query(
      `SELECT COUNT(*)::int AS count
       FROM incident_actions ia
       JOIN incidents i ON ia.incident_id = i.id
       WHERE i.organization_id = $1 AND ia.completed_at IS NULL
         AND ia.status != 'cancelled'
         AND ia.due_date IS NOT NULL AND ia.due_date < CURRENT_DATE`, [orgId]
    );

    // Care plan reviews overdue
    const overdueCarePlans = await query(
      `SELECT COUNT(*)::int AS count FROM care_plans cp
       JOIN people p ON cp.person_id = p.id
       WHERE p.organization_id = $1 AND cp.status = 'active'
         AND cp.review_date < CURRENT_DATE`, [orgId]
    );

    const activeStaff = await query(
      `SELECT COUNT(*)::int AS count FROM users
       WHERE organization_id = $1 AND status = 'active' AND role != 'SUPER_ADMIN'`, [orgId]
    );
    const peopleSupported = await query(
      `SELECT COUNT(*)::int AS count FROM people
       WHERE organization_id = $1 AND status = 'active'`, [orgId]
    );

    // Coverage: carers assigned to at least one call in the selected date window
    const carersWorkingToday = await query(
      `SELECT COUNT(DISTINCT assigned_staff_id)::int AS count FROM homecare_visits
       WHERE organization_id = $1 AND scheduled_start >= $2::date AND scheduled_start < $3::date
         AND assigned_staff_id IS NOT NULL
         AND status NOT IN ('cancelled')`, [orgId, today, nextDate]
    );

    // Today's calls by status for the breakdown
    const callsByStatus = await query(
      `SELECT status, COUNT(*)::int AS count FROM homecare_visits
       WHERE organization_id = $1 AND scheduled_start >= $2::date AND scheduled_start < $3::date
       GROUP BY status`, [orgId, today, nextDate]
    );

    // Exception trends: missed calls last 7 days
    const missedTrend = await query(
      `SELECT scheduled_start::date AS day, COUNT(*)::int AS count
       FROM homecare_visits
       WHERE organization_id = $1 AND status = 'missed'
         AND scheduled_start >= CURRENT_DATE - interval '7 days'
       GROUP BY day ORDER BY day`, [orgId]
    );

    // Missed calls by carer (last 7 days)
    const missedByCarer = await query(
      `SELECT sp.first_name || ' ' || sp.last_name AS carer_name, COUNT(*)::int AS count
       FROM homecare_visits hv
       JOIN staff_profiles sp ON sp.id = hv.assigned_staff_id
       WHERE hv.organization_id = $1 AND hv.status = 'missed'
         AND hv.scheduled_start >= CURRENT_DATE - interval '7 days'
       GROUP BY carer_name ORDER BY count DESC LIMIT 10`, [orgId]
    );

    return {
      missed_today: missedCalls.rows[0]?.count || 0,
      unassigned_today: unassignedToday.rows[0]?.count || 0,
      unassigned_upcoming: unassignedUpcoming.rows[0]?.count || 0,
      overdue_calls: overdueCalls.rows[0]?.count || 0,
      completed_today: completedToday.rows[0]?.count || 0,
      total_today: totalToday.rows[0]?.count || 0,
      training_expiring: trainingExpiring.rows[0]?.count || 0,
      docs_expiring: docsExpiring.rows[0]?.count || 0,
      open_incidents: openIncidents.rows[0]?.count || 0,
      overdue_incident_actions: overdueIncidentActions.rows[0]?.count || 0,
      overdue_care_plans: overdueCarePlans.rows[0]?.count || 0,
      active_staff: activeStaff.rows[0]?.count || 0,
      people_supported: peopleSupported.rows[0]?.count || 0,
      carers_working_today: carersWorkingToday.rows[0]?.count || 0,
      calls_by_status: callsByStatus.rows,
      missed_trend: missedTrend.rows,
      missed_by_carer: missedByCarer.rows,
    };
  }
}