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
  /**
   * Which capture the plotted point came from, or null when there is no point.
   * A carer position is taken once at check-in and once at check-out and never
   * again, so the point is always a record of a moment rather than a live fix —
   * and the client needs to be able to say which moment.
   */
  position_source: 'check_in' | 'check_out' | null;
  /**
   * When that point was captured. Always paired with `position_source` by the
   * query below, so the two cannot describe different moments.
   */
  position_captured_at: string | null;
  /**
   * Why there is no position, when there is not one. Null whenever a position
   * exists. Carried so the page can say "this worker declined" rather than
   * showing a bare "No GPS", which reads as a broken phone.
   */
  location_skip_reason: 'organisation_disabled' | 'worker_declined' | 'not_agreed' | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  location_id: string | null;
  location_name: string | null;
}

export interface LiveMapArea {
  id: string;
  name: string;
}

export interface LiveMapAreaStat {
  location_id: string | null;
  total: number;
  completed: number;
}

export interface LiveMapData {
  active_visits: LiveMapVisit[];
  scheduled_visits: LiveMapVisit[];
  completed_today: number;
  total_today: number;
  centre: { lat: number; lng: number } | null;
  areas: LiveMapArea[];
  area_stats: LiveMapAreaStat[];
}

export async function getLiveMapData(orgId: string): Promise<LiveMapData> {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const result = await query(`
    SELECT v.id, v.status, v.scheduled_start, v.scheduled_end, v.label,
           p.latitude, p.longitude, p.position_source, p.position_captured_at,
           v.location_capture_skip_reason,
           pe.first_name || ' ' || pe.last_name AS person_name,
           l.address AS person_address,
           pe.location_id AS location_id,
           l.name AS location_name,
           sp.first_name || ' ' || sp.last_name AS carer_name,
           v.assigned_staff_id AS carer_id
    FROM homecare_visits v
    JOIN people pe ON pe.id = v.person_id
    LEFT JOIN locations l ON l.id = pe.location_id
    LEFT JOIN staff_profiles sp ON sp.id = v.assigned_staff_id
    -- A worker's own decision gates their position here as well as at capture.
    -- The check-in path already refuses to store a position for someone who
    -- declined, so this is belt and braces rather than the primary control — but
    -- it is the primary control for the rows that are already in the table. A
    -- worker who declined today still has the position they agreed to last
    -- month, and showing it as a live pin would honour neither the decision nor
    -- the person who made it.
    LEFT JOIN staff_location_decisions sld ON sld.user_id = sp.user_id
    -- One lateral, so the coordinates and the timestamp that describes them are
    -- chosen by the same branch and cannot drift apart.
    --
    -- The previous shape was COALESCE(check_in_lat, check_out_lat) for the point
    -- and v.updated_at for the time, which the client rendered as though the two
    -- were related. They are not: updated_at is when the visit row was last
    -- written, and a note, a task or a status change moves it forward. A pin
    -- captured at 09:00 would read 14:32 after an afternoon edit and look
    -- current. The capture time is check_in_at or check_out_at, matched to
    -- whichever branch supplied the coordinates.
    --
    -- Each branch is filtered to a complete coordinate pair, so a half-recorded
    -- position plots nothing rather than a pin on one axis.
    LEFT JOIN LATERAL (
      SELECT v.check_in_latitude AS latitude, v.check_in_longitude AS longitude,
             'check_in'::text AS position_source, v.check_in_at AS position_captured_at
      WHERE v.check_in_latitude IS NOT NULL AND v.check_in_longitude IS NOT NULL
        AND sld.decision = 'agreed'
      UNION ALL
      SELECT v.check_out_latitude, v.check_out_longitude,
             'check_out'::text, v.check_out_at
      WHERE v.check_out_latitude IS NOT NULL AND v.check_out_longitude IS NOT NULL
        AND sld.decision = 'agreed'
      LIMIT 1
    ) p ON TRUE
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

  const areasResult = await query(`
    SELECT id, name FROM locations WHERE organization_id = $1 ORDER BY name
  `, [orgId]);

  const areaStatsResult = await query(`
    SELECT pe.location_id,
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE v.status = 'completed')::int AS completed
    FROM homecare_visits v
    JOIN people pe ON pe.id = v.person_id
    WHERE v.organization_id = $1
      AND v.scheduled_start >= $2
      AND v.scheduled_start < $3
    GROUP BY pe.location_id
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
    position_source: v.position_source ?? null,
    position_captured_at: v.position_captured_at ?? null,
    location_skip_reason: v.location_capture_skip_reason ?? null,
    latitude: v.latitude != null ? Number(v.latitude) : null,
    longitude: v.longitude != null ? Number(v.longitude) : null,
    is_active: ['en_route', 'checked_in'].includes(v.status),
    location_id: v.location_id ?? null,
    location_name: v.location_name ?? null,
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
    areas: areasResult.rows.map((a: any) => ({ id: a.id, name: a.name })),
    area_stats: areaStatsResult.rows.map((s: any) => ({
      location_id: s.location_id ?? null,
      total: Number(s.total),
      completed: Number(s.completed),
    })),
  };
}
