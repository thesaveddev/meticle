import { query } from '../../shared/database';

export interface DomiciliaryDashboardData {
  calls_today: number;
  calls_completed: number;
  calls_in_progress: number;
  calls_scheduled: number;
  calls_missed: number;
  calls_cancelled: number;
  calls_unassigned: number;
  coverage_percent: number;
  carers_working_today: number;
  carers_with_calls: number;
  next_call: { label: string; person_name: string; scheduled_start: string; carer_name: string | null } | null;
  call_timeline: { id: string; label: string; person_name: string; scheduled_start: string; scheduled_end: string; status: string; carer_name: string | null }[];
  carer_breakdown: { carer_name: string; calls_assigned: number; calls_completed: number; calls_remaining: number }[];
  exceptions: { id: string; label: string; person_name: string; scheduled_start: string; status: string; carer_name: string | null; exception_type: string | null }[];
}

export async function getDomiciliaryDashboard(orgId: string): Promise<DomiciliaryDashboardData> {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const [visitsResult, exceptionsResult, packagesResult] = await Promise.all([
    query(`
      SELECT v.id, v.status, v.scheduled_start, v.scheduled_end, v.label,
             v.assigned_staff_id, v.exception_type,
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
        AND status IN ('missed', 'cancelled')
        AND scheduled_start >= $2
        AND scheduled_start < $3
    `, [orgId, today, tomorrow]),
    query(`
      SELECT COUNT(*) AS package_count,
             COUNT(*) FILTER (WHERE status = 'active') AS active_count
      FROM homecare_packages
      WHERE organization_id = $1
    `, [orgId]),
  ]);

  const allVisits = visitsResult.rows;
  const total = allVisits.length;
  const completed = allVisits.filter((v: any) => v.status === 'completed').length;
  const inProgress = allVisits.filter((v: any) => ['checked_in', 'en_route'].includes(v.status)).length;
  const scheduled = allVisits.filter((v: any) => v.status === 'scheduled').length;
  const missed = allVisits.filter((v: any) => v.status === 'missed').length;
  const cancelled = allVisits.filter((v: any) => v.status === 'cancelled').length;
  const unassigned = allVisits.filter((v: any) => !v.assigned_staff_id).length;

  const coveragePercent = total > 0 ? Math.round(((total - unassigned) / total) * 100) : 100;

  // Find next upcoming call
  const nowTime = new Date(now).getTime();
  const nextCall = allVisits
    .filter((v: any) => v.status === 'scheduled' && new Date(v.scheduled_start).getTime() > nowTime)
    .sort((a: any, b: any) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())[0] || null;

  // Call timeline (all calls for today)
  const callTimeline = allVisits.map((v: any) => ({
    id: v.id,
    label: v.label,
    person_name: v.person_name,
    scheduled_start: v.scheduled_start,
    scheduled_end: v.scheduled_end,
    status: v.status,
    carer_name: v.carer_name,
  }));

  // Carer breakdown
  const carerMap = new Map<string, { name: string; assigned: number; completed: number }>();
  for (const v of allVisits) {
    const name = v.carer_name || 'Unassigned';
    const key = v.assigned_staff_id || 'unassigned';
    const existing = carerMap.get(key) || { name, assigned: 0, completed: 0 };
    existing.assigned++;
    if (v.status === 'completed') existing.completed++;
    carerMap.set(key, existing);
  }
  const carerBreakdown = Array.from(carerMap.entries())
    .filter(([key]) => key !== 'unassigned')
    .map(([, data]) => ({
      carer_name: data.name,
      calls_assigned: data.assigned,
      calls_completed: data.completed,
      calls_remaining: data.assigned - data.completed,
    }));

  // Exceptions
  const exceptions = allVisits
    .filter((v: any) => ['missed', 'cancelled'].includes(v.status) || v.exception_type)
    .map((v: any) => ({
      id: v.id,
      label: v.label,
      person_name: v.person_name,
      scheduled_start: v.scheduled_start,
      status: v.status,
      carer_name: v.carer_name,
      exception_type: v.exception_type,
    }));

  return {
    calls_today: total,
    calls_completed: completed,
    calls_in_progress: inProgress,
    calls_scheduled: scheduled,
    calls_missed: missed,
    calls_cancelled: cancelled,
    calls_unassigned: unassigned,
    coverage_percent: coveragePercent,
    carers_working_today: carerBreakdown.length,
    carers_with_calls: carerBreakdown.filter(c => c.calls_assigned > 0).length,
    next_call: nextCall ? {
      label: nextCall.label,
      person_name: nextCall.person_name,
      scheduled_start: nextCall.scheduled_start,
      carer_name: nextCall.carer_name,
    } : null,
    call_timeline: callTimeline,
    carer_breakdown: carerBreakdown,
    exceptions,
  };
}
