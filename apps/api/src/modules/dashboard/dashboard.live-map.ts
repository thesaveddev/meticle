import { query } from '../../shared/database';

export interface LiveMapVisit {
  id: string;
  label: string;
  person_name: string;
  person_address: string | null;
  carer_name: string | null;
  carer_id: string | null;
  status: string;
  scheduled_start: string;
  scheduled_end: string;
  check_in_at: string | null;
  latitude: number | null;
  longitude: number | null;
  last_updated: string;
  is_active: boolean;
}

export interface LiveMapData {
  active_visits: LiveMapVisit[];
  scheduled_visits: LiveMapVisit[];
  completed_today: number;
  total_today: number;
  centre: { lat: number; lng: number } | null;
}

export async function getLiveMapData(orgId: string): Promise<LiveMapData> {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const result = await query(`
    SELECT v.id, v.status, v.scheduled_start, v.scheduled_end, v.label,
           v.check_in_at, v.updated_at,
           COALESCE(v.check_in_latitude, v.check_out_latitude) AS latitude,
           COALESCE(v.check_in_longitude, v.check_out_longitude) AS longitude,
           pe.first_name || ' ' || pe.last_name AS person_name,
           pe.address AS person_address,
           sp.first_name || ' ' || sp.last_name AS carer_name,
           v.assigned_staff_id AS carer_id
    FROM homecare_visits v
    JOIN people pe ON pe.id = v.person_id
    LEFT JOIN staff_profiles sp ON sp.id = v.assigned_staff_id
    WHERE v.organization_id = $1
      AND v.scheduled_start >= $2
      AND v.scheduled_start < $3
      AND v.status IN ('en_route', 'checked_in', 'scheduled')
    ORDER BY v.scheduled_start
  `, [orgId, today, tomorrow]);

  const allToday = await query(`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status = 'completed') AS completed
    FROM homecare_visits
    WHERE organization_id = $1
      AND scheduled_start >= $2
      AND scheduled_start < $3
  `, [orgId, today, tomorrow]);

  const visits: LiveMapVisit[] = result.rows.map((v: any) => ({
    id: v.id,
    label: v.label,
    person_name: v.person_name,
    person_address: v.person_address,
    carer_name: v.carer_name,
    carer_id: v.carer_id,
    status: v.status,
    scheduled_start: v.scheduled_start,
    scheduled_end: v.scheduled_end,
    check_in_at: v.check_in_at,
    latitude: v.latitude != null ? Number(v.latitude) : null,
    longitude: v.longitude != null ? Number(v.longitude) : null,
    last_updated: v.updated_at,
    is_active: ['en_route', 'checked_in'].includes(v.status),
  }));

  // Centre the map on the average of available GPS points
  const withGps = visits.filter(v => v.latitude != null && v.longitude != null);
  const centre = withGps.length > 0
    ? {
        lat: withGps.reduce((s, v) => s + v.latitude!, 0) / withGps.length,
        lng: withGps.reduce((s, v) => s + v.longitude!, 0) / withGps.length,
      }
    : null;

  return {
    active_visits: visits.filter(v => v.is_active),
    scheduled_visits: visits.filter(v => !v.is_active),
    completed_today: Number(allToday.rows[0]?.completed || 0),
    total_today: Number(allToday.rows[0]?.total || 0),
    centre,
  };
}
