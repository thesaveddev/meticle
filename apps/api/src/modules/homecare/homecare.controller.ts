import { Request, Response } from 'express';
import { AppError } from '../../shared/middleware/error.middleware';
import pool, { query } from '../../shared/database';
import { AuditRepository } from '../audit/audit.repository';
import { sendPushToUser } from '../notifications/push.service';
import { safeIo } from '../../shared/socket';

import * as repo from './homecare.repository';
import { summariseEarnings, getYearToDateTotals, buildPayslipData, renderPayslipPdf } from './payslip.service';
import { UserRole } from '@meticle/shared';

function orgId(req: Request): string {
  const value = req.user?.organizationId;
  if (!value) throw new AppError(403, 'Organization context required');
  return value;
}

function userId(req: Request): string {
  return req.user!.userId;
}

function audit(req: Request, action: string, entityType: string, entityId?: string, newData?: unknown) {
  AuditRepository.log({ user_id: userId(req), action, entity_type: entityType, entity_id: entityId, new_data: newData, ip_address: req.ip }).catch(() => {});
}

export class HomecareController {
  static async listPackages(req: Request, res: Response) {
    res.json(await repo.listPackages(orgId(req)));
  }

  static async createPackage(req: Request, res: Response) {
    const result = await repo.createPackage(orgId(req), userId(req), req.body);
    audit(req, 'create', 'homecare_package', result.id, req.body);
    res.status(201).json(result);
  }

  static async updatePackage(req: Request, res: Response) {
    const result = await repo.updatePackage(orgId(req), req.params.id, req.body);
    audit(req, 'update', 'homecare_package', req.params.id, req.body);
    res.json(result);
  }

  static async listVisitPlans(req: Request, res: Response) {
    res.json(await repo.listVisitPlans(orgId(req), req.params.packageId));
  }

  static async listStaff(req: Request, res: Response) {
    res.json(await repo.listStaff(orgId(req)));
  }

  static async getStaffVisits(req: Request, res: Response) {
    const oid = orgId(req);
    const { staffId } = req.params;
    const from = req.query.from as string || new Date().toISOString();
    const to = req.query.to as string || new Date(Date.now() + 7 * 86400000).toISOString();
    const result = await query(
      `SELECT v.*, pe.first_name || ' ' || pe.last_name AS person_name, l.address AS person_address, p.name AS package_name
       FROM homecare_visits v
       JOIN people pe ON pe.id = v.person_id
       JOIN homecare_packages p ON p.id = v.package_id AND p.organization_id = v.organization_id
       LEFT JOIN locations l ON l.id = pe.location_id
       WHERE v.organization_id = $1 AND v.assigned_staff_id = $2 AND v.scheduled_start >= $3 AND v.scheduled_start <= $4 AND v.status IN ('scheduled', 'en_route')
       ORDER BY v.scheduled_start`,
      [oid, staffId, from, to]
    );
    res.json(result.rows);
  }

  static async createVisitPlan(req: Request, res: Response) {
    const result = await repo.createVisitPlan(orgId(req), { ...req.body, package_id: req.params.packageId });
    audit(req, 'create', 'homecare_visit_plan', result.id, req.body);
    res.status(201).json(result);
  }

  static async generateVisits(req: Request, res: Response) {
    const result = await repo.generateVisitsFromPlan(orgId(req), userId(req), req.params.planId, req.body.from, req.body.to);
    audit(req, 'generate', 'homecare_visit_plan', req.params.planId, { from: req.body.from, to: req.body.to, generated_count: result.generated_count });
    res.status(201).json(result);
  }

  static async listVisits(req: Request, res: Response) {
    res.json(await repo.listVisits(orgId(req), {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      staffId: req.query.staffId as string | undefined,
      status: req.query.status as string | undefined,
    }));
  }

  static async createVisit(req: Request, res: Response) {
    const result = await repo.createVisit(orgId(req), userId(req), req.body);
    audit(req, 'create', 'homecare_visit', result.id, req.body);

    // Notify assigned carer
    if (result.assigned_staff_id) {
      HomecareController.notifyCarerAssigned(orgId(req), result, result.assigned_staff_id).catch(() => {});
    }

    res.status(201).json(result);
  }

  static async updateVisit(req: Request, res: Response) {
    const result = await repo.updateVisit(orgId(req), req.params.id, req.body);
    audit(req, 'update', 'homecare_visit', req.params.id, req.body);

    // Notify carer when reassigned
    if (req.body.assigned_staff_id) {
      HomecareController.notifyCarerAssigned(orgId(req), result, req.body.assigned_staff_id).catch(() => {});
    }

    // Send notifications for missed calls
    if (req.body.status === 'missed') {
      HomecareController.notifyMissedCall(orgId(req), result).catch(() => {});
    }
    // Send notification for completed calls
    if (req.body.status === 'completed') {
      HomecareController.notifyCallCompleted(orgId(req), result).catch(() => {});
    }

    // Broadcast real-time update to other managers
    try {
      safeIo().to(`org:${orgId(req)}`).emit('homecare:visit-updated', {
        visitId: result.id,
        assigned_staff_id: result.assigned_staff_id,
        status: result.status,
        scheduled_start: result.scheduled_start,
        updatedBy: userId(req),
      });
    } catch { /* socket emit is best-effort */ }

    res.json(result);
  }

  static async listExceptions(req: Request, res: Response) {
    res.json(await repo.listOpenExceptions(orgId(req)));
  }

  static async resolveException(req: Request, res: Response) {
    const result = await repo.resolveVisitException(orgId(req), req.params.id, userId(req), req.body);
    audit(req, 'resolve', 'homecare_visit_exception', req.params.id, req.body);
    res.json(result);
  }

  static async myVisits(req: Request, res: Response) {
    const staff = await import('../../shared/database').then(({ query }) => query('SELECT id FROM staff_profiles WHERE user_id = $1', [userId(req)]));
    res.json(await repo.listVisits(orgId(req), {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      staffId: staff.rows[0]?.id || '__none__',
      status: req.query.status as string | undefined,
    }));
  }

  static async checkIn(req: Request, res: Response) {
    const result = await repo.checkIn(orgId(req), userId(req), req.params.id, req.body);
    audit(req, 'check_in', 'homecare_visit', req.params.id, { latitude: req.body.latitude, longitude: req.body.longitude, accuracy_meters: req.body.accuracy_meters });
    res.json(result);
  }

  static async checkOut(req: Request, res: Response) {
    const result = await repo.checkOut(orgId(req), userId(req), req.params.id, req.body);
    audit(req, 'check_out', 'homecare_visit', req.params.id, { actual_travel_minutes: req.body.actual_travel_minutes, actual_mileage_miles: req.body.actual_mileage_miles });
    res.json(result);
  }

  static async listCarePlans(req: Request, res: Response) {
    const personId = req.query.personId as string;
    if (!personId) throw new AppError(400, 'personId query parameter is required');
    res.json(await repo.listCarePlans(orgId(req), personId));
  }

  static async listTimesheets(req: Request, res: Response) {
    res.json(await repo.listTimesheets(orgId(req), req.query.status as string | undefined));
  }

  static async getMonthlyCarerTotals(req: Request, res: Response) {
    const from = req.query.from as string;
    const to = req.query.to as string;
    if (!from || !to) throw new AppError(400, 'from and to date parameters are required');
    res.json(await repo.getMonthlyCarerTotals(orgId(req), from, to));
  }

  static async getCarerTimesheetDetail(req: Request, res: Response) {
    const staffId = req.params.staffId as string;
    const from = req.query.from as string;
    const to = req.query.to as string;
    if (!from || !to) throw new AppError(400, 'from and to date parameters are required');
    res.json(await repo.getCarerTimesheetDetail(orgId(req), staffId, from, to));
  }

  static async getPendingTimesheets(req: Request, res: Response) {
    const from = req.query.from as string;
    const to = req.query.to as string;
    if (!from || !to) throw new AppError(400, 'from and to date parameters are required');
    res.json(await repo.getPendingTimesheets(orgId(req), from, to));
  }

  static async updateTimesheet(req: Request, res: Response) {
    const result = await repo.updateTimesheet(orgId(req), req.params.id, userId(req), req.body);
    audit(req, req.body.status === 'approved' ? 'approve' : 'update', 'homecare_timesheet', req.params.id, req.body);
    res.json(result);
  }

  static async getMyAvailability(req: Request, res: Response) {
    const userId = req.user!.userId;
    const staff = await pool.query('SELECT id FROM staff_profiles WHERE user_id = $1', [userId]);
    if (!staff.rows[0]) throw new AppError(404, 'Staff profile not found');
    res.json(await repo.listAvailability(orgId(req), staff.rows[0].id));
  }

  static async listAvailability(req: Request, res: Response) {
    res.json(await repo.listAvailability(orgId(req), req.query.staffId as string | undefined));
  }

  static async listAvailableStaff(req: Request, res: Response) {
    const start = req.query.start as string;
    const end = req.query.end as string;
    if (!start || !end || Number.isNaN(new Date(start).getTime()) || Number.isNaN(new Date(end).getTime())) {
      throw new AppError(400, 'A valid start and end time are required');
    }
    res.json(await repo.listAvailableStaff(orgId(req), start, end, req.query.excludeVisitId as string | undefined));
  }

  static async suggestCarers(req: Request, res: Response) {
    const visitId = req.params.visitId;
    res.json(await repo.suggestCarersForVisit(orgId(req), visitId));
  }

  static async bulkAutoAssign(req: Request, res: Response) {
    const oid = orgId(req);
    const from = req.query.from as string;
    const to = req.query.to as string;
    if (!from || !to) throw new AppError(400, 'from and to date parameters are required');

    // Get all visits for the period
    const visitsResult = await query(
      `SELECT hv.*, pe.first_name || ' ' || pe.last_name AS person_name,
              l.latitude, l.longitude
       FROM homecare_visits hv
       JOIN people pe ON pe.id = hv.person_id
       LEFT JOIN locations l ON l.id = pe.location_id
       WHERE hv.organization_id = $1 AND hv.status = 'scheduled'
         AND hv.scheduled_start >= $2::date AND hv.scheduled_start < ($3::date + INTERVAL '1 day')
       ORDER BY hv.scheduled_start`,
      [oid, from, to]
    );
    const allVisits = visitsResult.rows;
    const unassigned = allVisits.filter((v: any) => !v.assigned_staff_id);
    if (unassigned.length === 0) return res.json({ assignments: [], message: 'No unassigned calls' });

    // Get all active staff
    const staffResult = await query(
      `SELECT sp.id, sp.first_name, sp.last_name
       FROM staff_profiles sp JOIN users u ON u.id = sp.user_id
       WHERE u.organization_id = $1 AND u.status = 'active' AND u.role IN ('CARE_WORKER', 'MANAGER')`,
      [oid]
    );
    const staffList = staffResult.rows;
    if (staffList.length === 0) return res.json({ assignments: [], message: 'No active staff' });

    // Get availability for all staff
    const availResult = await query(
      `SELECT * FROM staff_availability WHERE organization_id = $1`, [oid]
    );
    const availability = availResult.rows;

    // Get pending/approved leave for the period
    const leaveResult = await query(
      `SELECT * FROM leave_requests WHERE organization_id = $1
         AND status IN ('pending', 'approved')
         AND start_date <= $3::date AND end_date >= $2::date`,
      [oid, from, to]
    );
    const leaves = leaveResult.rows;

    // Get existing assigned visits for conflict checking
    const assignedVisits = allVisits.filter((v: any) => v.assigned_staff_id);

    // Haversine distance
    const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    // Score a carer for a visit
    const scoreVisit = (visit: any, staffId: string, currentAssignments: Map<string, any[]>): number => {
      let score = 50; // base

      // Check leave conflict
      const onLeave = leaves.some((l: any) => l.staff_id === staffId && new Date(l.start_date) <= new Date(visit.scheduled_end) && new Date(l.end_date) >= new Date(visit.scheduled_start));
      if (onLeave) return -1;

      // Check availability match
      const visitDay = new Date(visit.scheduled_start).getDay();
      const visitStart = new Date(visit.scheduled_start).getHours() * 60 + new Date(visit.scheduled_start).getMinutes();
      const visitEnd = new Date(visit.scheduled_end).getHours() * 60 + new Date(visit.scheduled_end).getMinutes();
      const avail = availability.find((a: any) => a.staff_id === staffId && a.day_of_week === visitDay);
      if (avail && !avail.is_unavailable) {
        const aStart = avail.start_time ? parseTime(avail.start_time) : 0;
        const aEnd = avail.end_time ? parseTime(avail.end_time) : 1440;
        if (visitStart >= aStart && visitEnd <= aEnd) score += 25;
        else score -= 10;
      } else if (avail?.is_unavailable) {
        return -1;
      }

      // Check time overlap with existing assignments
      const carerVisits = [...(currentAssignments.get(staffId) || []), ...assignedVisits.filter((v: any) => v.assigned_staff_id === staffId)];
      const vStart = new Date(visit.scheduled_start).getTime();
      const vEnd = new Date(visit.scheduled_end).getTime();
      const buffer = 30 * 60 * 1000;
      for (const cv of carerVisits) {
        if (cv.id === visit.id) continue;
        const cStart = new Date(cv.scheduled_start).getTime();
        const cEnd = new Date(cv.scheduled_end).getTime();
        if (vStart < cEnd + buffer && vEnd > cStart - buffer) return -1;
      }

      // Proximity bonus for back-to-back calls
      for (const cv of carerVisits) {
        if (cv.id === visit.id) continue;
        const cEnd = new Date(cv.scheduled_end).getTime();
        const gapMins = (vStart - cEnd) / 60000;
        if (gapMins >= 0 && gapMins <= 90 && visit.latitude && visit.longitude && cv.latitude && cv.longitude) {
          const distKm = haversineKm(visit.latitude, visit.longitude, cv.latitude, cv.longitude);
          const travelNeeded = distKm * 3;
          if (travelNeeded <= gapMins + 15) score += 15;
        }
      }

      // Workload balance — prefer carers with fewer hours today
      const currentHours = carerVisits.reduce((sum: number, cv: any) => {
        return sum + (new Date(cv.scheduled_end).getTime() - new Date(cv.scheduled_start).getTime()) / 3600000;
      }, 0);
      const visitHours = (vEnd - vStart) / 3600000;
      if (currentHours + visitHours <= 8) score += 10;
      else score -= 5;

      return score;
    };

    function parseTime(timeStr: string): number {
      const parts = String(timeStr).split(':');
      return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
    }

    // Greedy assignment: sort unassigned by time, assign best available carer
    const assignments: { visit_id: string; staff_id: string; score: number; person_name: string; carer_name: string; time: string }[] = [];
    const tempAssignments = new Map<string, any[]>();

    for (const visit of unassigned) {
      let bestStaff: string | null = null;
      let bestScore = -1;

      for (const staff of staffList) {
        const s = scoreVisit(visit, staff.id, tempAssignments);
        if (s > bestScore) {
          bestScore = s;
          bestStaff = staff.id;
        }
      }

      if (bestStaff && bestScore > 0) {
        // Actually assign
        await query('UPDATE homecare_visits SET assigned_staff_id = $1 WHERE id = $2 AND organization_id = $3', [bestStaff, visit.id, oid]);
        if (!tempAssignments.has(bestStaff)) tempAssignments.set(bestStaff, []);
        tempAssignments.get(bestStaff)!.push(visit);
        const staffMember = staffList.find((s: any) => s.id === bestStaff);
        assignments.push({
          visit_id: visit.id,
          staff_id: bestStaff,
          score: bestScore,
          person_name: visit.person_name,
          carer_name: staffMember ? `${staffMember.first_name} ${staffMember.last_name}` : 'Unknown',
          time: visit.scheduled_start,
        });
      }
    }

    // Broadcast bulk assignment to other managers
    try {
      safeIo().to(`org:${oid}`).emit('homecare:visit-updated', {
        type: 'bulk-auto-assign',
        assignedCount: assignments.length,
        updatedBy: userId(req),
      });
    } catch { /* socket emit is best-effort */ }

    res.json({
      assignments,
      total_unassigned: unassigned.length,
      assigned_count: assignments.length,
      unassigned_count: unassigned.length - assignments.length,
    });
  }

  // ─── Travel Time Estimation ─────────────────────────────────
  // Simple in-memory cache for OSRM responses (TTL 1 hour)
  private static travelTimeCache = new Map<string, { data: any; expiresAt: number }>()

  private static getCacheKey(origin: string, destination: string): string {
    return `${origin}:${destination}`
  }

  private static async fetchOsrmTravelTime(origin: string, destination: string): Promise<{ duration_minutes: number; distance_km: number; route_summary: string } | null> {
    const cacheKey = HomecareController.getCacheKey(origin, destination)
    const cached = HomecareController.travelTimeCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) return cached.data

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${origin};${destination}?overview=false&alternatives=false&steps=false`
      const response = await fetch(url, {
        headers: { 'User-Agent': 'MeticleCare/1.0' },
        signal: AbortSignal.timeout(5000),
      })
      if (!response.ok) return null
      const data = await response.json()
      if (!data.routes || data.routes.length === 0) return null

      const route = data.routes[0]
      const result = {
        duration_minutes: Math.round(route.duration / 60),
        distance_km: Math.round((route.distance / 1000) * 10) / 10,
        route_summary: `${Math.round(route.distance / 1000)}km · ${Math.round(route.duration / 60)}min`,
      }

      // Cache for 1 hour
      HomecareController.travelTimeCache.set(cacheKey, { data: result, expiresAt: Date.now() + 3600000 })
      return result
    } catch {
      return null
    }
  }

  static async getTravelTime(req: Request, res: Response) {
    const origin = req.query.origin as string
    const destination = req.query.destination as string
    if (!origin || !destination) throw new AppError(400, 'origin and destination coordinates required (lat,lon)')

    const result = await HomecareController.fetchOsrmTravelTime(origin, destination)
    if (!result) {
      // Fallback to haversine estimate
      const [oLat, oLon] = origin.split(',').map(Number)
      const [dLat, dLon] = destination.split(',').map(Number)
      const R = 6371
      const dLat2 = ((dLat - oLat) * Math.PI) / 180
      const dLon2 = ((dLon - oLon) * Math.PI) / 180
      const a = Math.sin(dLat2 / 2) ** 2 + Math.cos((oLat * Math.PI) / 180) * Math.cos((dLat * Math.PI) / 180) * Math.sin(dLon2 / 2) ** 2
      const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      return res.json({
        duration_minutes: Math.round(distKm * 3), // rough 20km/h UK urban
        distance_km: Math.round(distKm * 10) / 10,
        route_summary: `${Math.round(distKm)}km (estimated)`,
        source: 'haversine',
      })
    }

    res.json({ ...result, source: 'osrm' })
  }

  static async bulkTravelTime(req: Request, res: Response) {
    const { pairs } = req.body as { pairs: Array<{ origin: string; destination: string; label?: string }> }
    if (!Array.isArray(pairs) || pairs.length === 0) throw new AppError(400, 'pairs array required')
    if (pairs.length > 50) throw new AppError(400, 'Maximum 50 pairs per request')

    const results = await Promise.all(
      pairs.map(async (pair) => {
        const result = await HomecareController.fetchOsrmTravelTime(pair.origin, pair.destination)
        if (!result) {
          const [oLat, oLon] = pair.origin.split(',').map(Number)
          const [dLat, dLon] = pair.destination.split(',').map(Number)
          const R = 6371
          const dLat2 = ((dLat - oLat) * Math.PI) / 180
          const dLon2 = ((dLon - oLon) * Math.PI) / 180
          const a = Math.sin(dLat2 / 2) ** 2 + Math.cos((oLat * Math.PI) / 180) * Math.cos((dLat * Math.PI) / 180) * Math.sin(dLon2 / 2) ** 2
          const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
          return { ...pair, duration_minutes: Math.round(distKm * 3), distance_km: Math.round(distKm * 10) / 10, source: 'haversine' }
        }
        return { ...pair, ...result, source: 'osrm' }
      })
    )

    res.json({ results })
  }

  static async createAvailability(req: Request, res: Response) {
    // Carers can only set their own availability
    const userRole = req.user!.role;
    if (userRole === 'CARE_WORKER') {
      const staff = await pool.query('SELECT id FROM staff_profiles WHERE user_id = $1', [req.user!.userId]);
      if (!staff.rows[0]) throw new AppError(404, 'Staff profile not found');
      req.body.staff_id = staff.rows[0].id;
    }
    const result = await repo.upsertAvailability(orgId(req), req.body);
    audit(req, 'create', 'homecare_availability', result.id, req.body);
    res.status(201).json(result);
  }

  static async deleteAvailability(req: Request, res: Response) {
    // Carers can only delete their own availability
    if (req.user!.role === 'CARE_WORKER') {
      const staff = await pool.query('SELECT id FROM staff_profiles WHERE user_id = $1', [req.user!.userId]);
      if (!staff.rows[0]) throw new AppError(404, 'Staff profile not found');
      const owner = await pool.query('SELECT id FROM staff_availability WHERE id = $1 AND staff_id = $2', [req.params.id, staff.rows[0].id]);
      if (!owner.rows[0]) throw new AppError(403, 'You can only delete your own availability');
    }
    const result = await repo.deleteAvailability(orgId(req), req.params.id);
    audit(req, 'delete', 'homecare_availability', req.params.id);
    res.json(result);
  }

  /* ── Visit tasks ─────────────────────────────────────────── */
  static async getVisitTasks(req: Request, res: Response) {
    const { visitId } = req.params;
    const result = await pool.query(
      'SELECT * FROM homecare_visit_tasks WHERE visit_id = $1 ORDER BY sort_order, created_at',
      [visitId]
    );
    res.json(result.rows);
  }

  static async addVisitTask(req: Request, res: Response) {
    const { visitId } = req.params;
    const { label } = req.body;
    if (!label || !label.trim()) throw new AppError(400, 'Task label is required');
    const maxOrder = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM homecare_visit_tasks WHERE visit_id = $1',
      [visitId]
    );
    const result = await pool.query(
      'INSERT INTO homecare_visit_tasks (visit_id, label, sort_order) VALUES ($1, $2, $3) RETURNING *',
      [visitId, label.trim(), maxOrder.rows[0].next]
    );
    res.status(201).json(result.rows[0]);
  }

  static async updateVisitTask(req: Request, res: Response) {
    const { visitId, taskId } = req.params;
    const { done, label } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (typeof done === 'boolean') {
      updates.push(`done = $${idx++}`); values.push(done);
      if (done) {
        updates.push(`completed_by = $${idx++}`); values.push(userId(req));
        updates.push(`completed_at = now()`);
      } else {
        updates.push('completed_by = NULL');
        updates.push('completed_at = NULL');
      }
    }
    if (label !== undefined) {
      updates.push(`label = $${idx++}`); values.push(label.trim());
    }
    if (updates.length === 0) throw new AppError(400, 'No fields to update');
    values.push(visitId, taskId);
    const result = await pool.query(
      `UPDATE homecare_visit_tasks SET ${updates.join(', ')} WHERE visit_id = $${idx++} AND id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) throw new AppError(404, 'Task not found');
    res.json(result.rows[0]);
  }

  static async deleteVisitTask(req: Request, res: Response) {
    const { visitId, taskId } = req.params;
    const result = await pool.query(
      'DELETE FROM homecare_visit_tasks WHERE visit_id = $1 AND id = $2 RETURNING id',
      [visitId, taskId]
    );
    if (result.rows.length === 0) throw new AppError(404, 'Task not found');
    res.json({ deleted: true });
  }

  static async createDisruption(req: Request, res: Response) {
    const oid = orgId(req); const uid = userId(req);
    const result = await repo.createDisruption(oid, uid, req.params.id, req.body);
    audit(req, 'create', 'homecare_visit_disruption', result.id, req.body);

    // Notify managers about disruption
    try {
      const visitResult = await query(`
        SELECT v.label, pe.first_name || ' ' || pe.last_name AS person_name
        FROM homecare_visits v JOIN people pe ON pe.id = v.person_id
        WHERE v.id = $1 AND v.organization_id = $2`, [req.params.id, oid]);
      const visit = visitResult.rows[0];
      const staffResult = await query(`
        SELECT COALESCE(sp.first_name, u.email) AS name
        FROM users u LEFT JOIN staff_profiles sp ON sp.user_id = u.id
        WHERE u.id = $1`, [uid]);
      const carerName = staffResult.rows[0]?.name || 'A carer';

      if (visit) {
        const { sendPushToUser } = await import('../notifications/push.service');
        const managers = await query(`
          SELECT u.id, u.email, COALESCE(sp.first_name, u.email) AS name
          FROM users u LEFT JOIN staff_profiles sp ON sp.user_id = u.id
          WHERE u.organization_id = $1 AND u.role IN ('ORG_ADMIN', 'MANAGER')`, [oid]);

        for (const m of managers.rows) {
          await sendPushToUser(m.id, {
            type: 'disruption_reported',
            title: `Disruption — ${visit.person_name}`,
            body: `${carerName} reported a ${req.body.disruption_type || 'disruption'} during ${visit.label}`,
            url: '/homecare',
          }, 'homecare');
          // Disruptions remain immediate push notifications and are included in the digest email.
        }
      }
    } catch { /* notification failure should not block response */ }

    res.status(201).json(result);
  }

  static async listDisruptions(req: Request, res: Response) {
    res.json(await repo.listDisruptions(orgId(req), req.query.openOnly === 'true'));
  }

  static async resolveDisruption(req: Request, res: Response) {
    const result = await repo.resolveDisruption(orgId(req), userId(req), req.params.id);
    audit(req, 'resolve', 'homecare_visit_disruption', req.params.id);
    res.json(result);
  }

  static async listMileagePolicies(req: Request, res: Response) {
    res.json(await repo.listMileagePolicies(orgId(req)));
  }

  static async createMileagePolicy(req: Request, res: Response) {
    const result = await repo.createMileagePolicy(orgId(req), userId(req), req.body);
    audit(req, 'upsert', 'homecare_mileage_policy', result.id, req.body);
    res.status(201).json(result);
  }

  static async updateMileagePolicy(req: Request, res: Response) {
    const result = await repo.updateMileagePolicy(orgId(req), req.params.id, req.body);
    audit(req, 'update', 'homecare_mileage_policy', req.params.id, req.body);
    res.json(result);
  }

  static async deleteMileagePolicy(req: Request, res: Response) {
    await repo.deleteMileagePolicy(orgId(req), req.params.id);
    audit(req, 'delete', 'homecare_mileage_policy', req.params.id);
    res.json({ deleted: true });
  }

  static async createFollowup(req: Request, res: Response) {
    const result = await repo.createFollowup(orgId(req), userId(req), req.params.id, req.body);
    audit(req, 'create', 'homecare_visit_followup', result.id, req.body);
    res.status(201).json(result);
  }

  static async listFollowups(req: Request, res: Response) {
    res.json(await repo.listFollowups(orgId(req), req.query.visitId as string | undefined));
  }

  static async offlineAction(req: Request, res: Response) {
    const actionType = req.params.action as 'check-in' | 'check-out';
    const result = await repo.recordOfflineAction(orgId(req), userId(req), req.params.id, req.body, actionType);
    audit(req, 'offline_' + actionType, 'homecare_visit', req.params.id, { action_key: req.body.action_key });
    res.json(result);
  }

  static async listPayrollReconciliations(req: Request, res: Response) {
    res.json(await repo.listPayrollReconciliations(orgId(req), req.query.exportId as string | undefined));
  }

  static async reconcilePayroll(req: Request, res: Response) {
    const result = await repo.reconcilePayroll(orgId(req), userId(req), req.params.id, req.body);
    audit(req, 'reconcile', 'homecare_payroll_reconciliation', req.params.id, req.body);
    res.json(result);
  }

  static async exportPayroll(req: Request, res: Response) {
    const rows = await repo.getApprovedPayrollRows(orgId(req), { from: req.query.from as string, to: req.query.to as string, provider: req.query.provider as any });
    const headers = ['timesheet_id', 'staff_id', 'staff_name', 'client_name', 'visit_label', 'scheduled_start', 'scheduled_end', 'work_minutes', 'travel_minutes', 'paid_travel_minutes', 'mileage_miles', 'mileage_rate_pence', 'hourly_rate_pence', 'gross_pay_pence'];
    const escape = (value: unknown) => {
      const text = value == null ? '' : String(value);
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const csv = [headers.join(','), ...rows.map(row => headers.map(header => escape(row[header])).join(','))].join('\n') + '\n';
    const checksum = require('crypto').createHash('sha256').update(csv).digest('hex');
    await repo.createPayrollExport(orgId(req), userId(req), { from: req.query.from as string, to: req.query.to as string, provider: req.query.provider as any }, rows, checksum);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="homecare-payroll-${req.query.from}-${req.query.to}.csv"`);
    res.send(csv);
  }

  static async listClientBillingRuns(req: Request, res: Response) {
    res.json(await repo.listClientBillingRuns(orgId(req)));
  }

  static async getClientBillingUtilisation(req: Request, res: Response) {
    res.json(await repo.buildClientBillingUtilisation(orgId(req), req.query.from as string, req.query.to as string));
  }

  static async createClientBillingRun(req: Request, res: Response) {
    const result = await repo.createClientBillingRun(orgId(req), userId(req), req.body.from, req.body.to);
    audit(req, 'create', 'homecare_client_billing_run', result.run.id, { from: req.body.from, to: req.body.to, row_count: result.lines.length });
    res.status(201).json(result);
  }

  static async listClientBillingLines(req: Request, res: Response) {
    res.json(await repo.listClientBillingLines(orgId(req), req.params.runId));
  }

  static async approveClientBillingRun(req: Request, res: Response) {
    const result = await repo.approveClientBillingRun(orgId(req), userId(req), req.params.runId);
    audit(req, 'approve', 'homecare_client_billing_run', req.params.runId, { invoice_number: result.invoice_number });
    res.json(result);
  }

  static async voidClientBillingRun(req: Request, res: Response) {
    const result = await repo.voidClientBillingRun(orgId(req), userId(req), req.params.runId, req.body?.void_reason || req.body?.reason || null);
    audit(req, 'void', 'homecare_client_billing_run', req.params.runId, { void_reason: result.void_reason, invoice_number: result.invoice_number });
    res.json(result);
  }

  static async getClientBillingRun(req: Request, res: Response) {
    const run = await repo.getClientBillingRun(orgId(req), req.params.runId);
    if (!run) throw new AppError(404, 'Billing run not found');
    res.json(run);
  }

  static async downloadClientInvoicePdf(req: Request, res: Response) {
    const run = await repo.getClientBillingRun(orgId(req), req.params.runId);
    if (!run) throw new AppError(404, 'Billing run not found');
    if (run.status !== 'approved') throw new AppError(409, 'Only approved billing runs have statutory invoices');

    const lines = await repo.listClientBillingLines(orgId(req), req.params.runId);
    const { buildClientInvoicePdf } = await import('./client-invoice.pdf' as string);

    const supplier = await repo.getSupplierInfo(orgId(req));
    const customer = await repo.getCustomerInfo(orgId(req), run);

    const pdf = await buildClientInvoicePdf({
      invoice_number: run.invoice_number || `HC-${run.id.slice(0, 8)}`,
      invoice_date: run.approved_at || run.created_at,
      tax_point: run.period_to,
      period_from: run.period_from,
      period_to: run.period_to,
      status: run.status,
      subtotal_pence: run.subtotal_pence,
      vat_rate: run.vat_rate,
      vat_inclusive: run.vat_inclusive,
      vat_amount_pence: run.vat_amount_pence,
      gross_amount_pence: run.gross_amount_pence,
      funding_breakdown: run.funding_breakdown || {},
      voided_at: run.voided_at,
      void_reason: run.void_reason,
      lines,
    }, supplier, customer);

    const filename = `invoice-${(run.invoice_number || run.id).replace(/[^A-Za-z0-9-_]/g, '')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  }

  static async getMtdExport(req: Request, res: Response) {
    const run = await repo.getClientBillingRun(orgId(req), req.params.runId);
    if (!run) throw new AppError(404, 'Billing run not found');
    if (run.status !== 'approved') throw new AppError(409, 'Only approved billing runs have MTD exports');

    const lines = await repo.listClientBillingLines(orgId(req), req.params.runId);
    const { buildMtdDigitalLink } = await import('./client-invoice.pdf' as string);

    const supplier = await repo.getSupplierInfo(orgId(req));
    const customer = await repo.getCustomerInfo(orgId(req), run);

    const mtd = buildMtdDigitalLink({
      invoice_number: run.invoice_number || `HC-${run.id.slice(0, 8)}`,
      invoice_date: run.approved_at || run.created_at,
      tax_point: run.period_to,
      period_from: run.period_from,
      period_to: run.period_to,
      status: run.status,
      subtotal_pence: run.subtotal_pence,
      vat_rate: run.vat_rate,
      vat_inclusive: run.vat_inclusive,
      vat_amount_pence: run.vat_amount_pence,
      gross_amount_pence: run.gross_amount_pence,
      funding_breakdown: run.funding_breakdown || {},
      voided_at: run.voided_at,
      void_reason: run.void_reason,
      lines,
    }, supplier, customer);

    audit(req, 'mtd_export', 'homecare_client_billing_run', req.params.runId, { invoice_number: run.invoice_number });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="mtd-${(run.invoice_number || run.id).replace(/[^A-Za-z0-9-_]/g, '')}.json"`);
    res.json(mtd);
  }

  // ── Notification helpers ──
  private static async notifyMissedCall(orgId: string, visit: any) {
    try {
      const personResult = await query('SELECT first_name, last_name FROM people WHERE id = $1', [visit.person_id]);
      const personName = personResult.rows[0] ? `${personResult.rows[0].first_name} ${personResult.rows[0].last_name}` : 'Unknown';

      // Notify managers
      const managers = await query(
        `SELECT u.id, u.email, COALESCE(sp.first_name, u.email) as name
         FROM users u LEFT JOIN staff_profiles sp ON sp.user_id = u.id
         WHERE u.organization_id = $1 AND u.role IN ('ORG_ADMIN', 'MANAGER')`,
        [orgId]
      );
      for (const m of managers.rows) {
          // Missed calls are included in the next digest; keep the immediate push alert.
        sendPushToUser(m.id, { type: 'missed_call', title: `Missed call — ${personName}`, body: `${visit.label || visit.visit_type} was marked missed`, url: '/homecare' }, 'homecare').catch(() => {});
      }

      // Also push to the assigned carer
      if (visit.assigned_staff_id) {
        const staffUser = await query('SELECT user_id FROM staff_profiles WHERE id = $1', [visit.assigned_staff_id]);
        if (staffUser.rows.length) {
          sendPushToUser(staffUser.rows[0].user_id, { type: 'missed_call', title: 'Call marked missed', body: `Your ${visit.label || visit.visit_type} call for ${personName} was marked as missed.`, url: '/homecare' }, 'homecare').catch(() => {});
        }
      }
    } catch (e: any) { /* notification failure should not block */ }
  }

  private static async notifyCarerAssigned(orgId: string, visit: any, staffId: string) {
    try {
      const staffResult = await query('SELECT user_id FROM staff_profiles WHERE id = $1', [staffId]);
      if (!staffResult.rows.length) return;
      const userId = staffResult.rows[0].user_id;
      const personResult = await query('SELECT first_name, last_name FROM people WHERE id = $1', [visit.person_id]);
      const personName = personResult.rows[0] ? `${personResult.rows[0].first_name} ${personResult.rows[0].last_name}` : 'Unknown';
      const msg = `You have been assigned the ${visit.label || visit.visit_type} call for ${personName}`;
      sendPushToUser(userId, { type: 'call_assigned', title: 'New call assigned', body: msg, url: '/homecare' }, 'homecare').catch(() => {});
      await query(
        `INSERT INTO call_assignment_notifications (organization_id, visit_id, staff_id, notification_type, message)
         VALUES ($1, $2, $3, 'assigned', $4)`,
        [orgId, visit.id, staffId, msg]
      );
    } catch (e: any) { /* non-critical */ }
  }

  private static async notifyCallCompleted(orgId: string, visit: any) {
    try {
      const managers = await query(
        `SELECT u.id, u.email, COALESCE(sp.first_name, u.email) as name
         FROM users u LEFT JOIN staff_profiles sp ON sp.user_id = u.id
         WHERE u.organization_id = $1 AND u.role IN ('ORG_ADMIN', 'MANAGER')`,
        [orgId]
      );
      const personResult = await query('SELECT first_name, last_name FROM people WHERE id = $1', [visit.person_id]);
      const personName = personResult.rows[0] ? `${personResult.rows[0].first_name} ${personResult.rows[0].last_name}` : 'Unknown';
      // Completion is reported in the midday/evening digest rather than by email per call.
      void managers;
    } catch (e: any) { /* notification failure should not block */ }
  }

  /* ─── Location threshold settings ──────────────────────────── */

  static async updateLocationThreshold(req: Request, res: Response) {
    const oid = orgId(req);
    const { location_threshold_meters } = req.body;
    await query('UPDATE organizations SET location_threshold_meters = $1, updated_at = NOW() WHERE id = $2', [location_threshold_meters, oid]);
    audit(req, 'update', 'organization_settings', oid, { location_threshold_meters });
    res.json({ location_threshold_meters });
  }

  static async getLocationThreshold(req: Request, res: Response) {
    const oid = orgId(req);
    const result = await query('SELECT location_threshold_meters FROM organizations WHERE id = $1', [oid]);
    res.json({ location_threshold_meters: result.rows[0]?.location_threshold_meters || 500 });
  }

  static async updateRequirePhoto(req: Request, res: Response) {
    const oid = orgId(req);
    const { require_photo_on_checkout } = req.body;
    await query('UPDATE organizations SET require_photo_on_checkout = $1, updated_at = NOW() WHERE id = $2', [require_photo_on_checkout, oid]);
    audit(req, 'update', 'organization_settings', oid, { require_photo_on_checkout });
    res.json({ require_photo_on_checkout });
  }

  static async getRequirePhoto(req: Request, res: Response) {
    const oid = orgId(req);
    const result = await query('SELECT require_photo_on_checkout FROM organizations WHERE id = $1', [oid]);
    res.json({ require_photo_on_checkout: result.rows[0]?.require_photo_on_checkout || false });
  }

  /* ─── Swap / Transfer ─────────────────────────────────────── */

  static async createSwapRequest(req: Request, res: Response) {
    const oid = orgId(req); const uid = userId(req);
    const { visit_id, target_staff_id, target_visit_id, request_type, message } = req.body;
    if (!visit_id || !request_type) throw new AppError(400, 'visit_id and request_type required');

    // Verify visit exists and belongs to this org
    const visitResult = await query('SELECT * FROM homecare_visits WHERE id = $1 AND organization_id = $2', [visit_id, oid]);
    if (!visitResult.rows.length) throw new AppError(404, 'Visit not found');
    const visit = visitResult.rows[0];

    // Get staff profile for current user
    const staffResult = await query('SELECT id FROM staff_profiles WHERE user_id = $1', [uid]);
    if (!staffResult.rows.length) throw new AppError(404, 'Staff profile not found');
    const staffId = staffResult.rows[0].id;

    // For swap: target must be different staff. For transfer: target is required
    if (request_type === 'swap' && target_staff_id && target_staff_id === staffId) throw new AppError(400, 'Cannot swap with yourself');
    if (request_type === 'transfer' && !target_staff_id) throw new AppError(400, 'Transfer requires a target carer');

    const result = await query(
      `INSERT INTO visit_swap_requests (organization_id, visit_id, requested_by, target_staff_id, target_visit_id, request_type, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [oid, visit_id, uid, target_staff_id || null, target_visit_id || null, request_type, message || null]
    );

    // Notify target carer
    if (target_staff_id) {
      const targetUser = await query('SELECT user_id FROM staff_profiles WHERE id = $1', [target_staff_id]);
      if (targetUser.rows.length) {
        const reqName = await query('SELECT COALESCE(sp.first_name, u.email) as name FROM users u LEFT JOIN staff_profiles sp ON sp.user_id = u.id WHERE u.id = $1', [uid]);
        const msg = `${reqName.rows[0]?.name || 'A carer'} wants to ${request_type} the ${visit.label || visit.visit_type} call`;
        sendPushToUser(targetUser.rows[0].user_id, { type: 'swap_request', title: `${request_type === 'swap' ? 'Swap' : 'Transfer'} request`, body: msg, url: '/homecare' }, 'homecare').catch(() => {});
        await query(
          `INSERT INTO call_assignment_notifications (organization_id, visit_id, staff_id, notification_type, message)
           VALUES ($1, $2, $3, $4, $5)`,
          [oid, visit_id, target_staff_id, request_type === 'swap' ? 'swap_offered' : 'reassigned', msg]
        );
      }
    }

    // Notify managers
    try {
      const managers = await query(
        `SELECT u.id FROM users u WHERE u.organization_id = $1 AND u.role IN ('ORG_ADMIN', 'MANAGER')`, [oid]
      );
      for (const m of managers.rows) {
        sendPushToUser(m.id, { type: 'swap_request', title: `Call ${request_type} request`, body: `A ${request_type} request has been submitted for ${visit.label}`, url: '/homecare' }, 'homecare').catch(() => {});
      }
    } catch { /* non-critical */ }

    audit(req, 'SWAP_REQUEST_CREATED', 'visit_swap_request', result.rows[0].id, result.rows[0]);
    res.status(201).json(result.rows[0]);
  }

  static async respondSwapRequest(req: Request, res: Response) {
    const oid = orgId(req); const uid = userId(req);
    const { id } = req.params;
    const { status, response_message } = req.body;
    if (!['accepted', 'rejected'].includes(status)) throw new AppError(400, 'Status must be accepted or rejected');

    const swapResult = await query(
      'SELECT * FROM visit_swap_requests WHERE id = $1 AND organization_id = $2', [id, oid]
    );
    if (!swapResult.rows.length) throw new AppError(404, 'Request not found');
    const swap = swapResult.rows[0];
    if (swap.status !== 'pending') throw new AppError(400, 'Request is no longer pending');

    await query(
      `UPDATE visit_swap_requests SET status = $1, responded_by = $2, responded_at = NOW(), response_message = $3, updated_at = NOW() WHERE id = $4`,
      [status, uid, response_message || null, id]
    );

    if (status === 'accepted' && swap.request_type === 'swap' && swap.target_staff_id) {
      // Swap the assigned staff
      const visit = (await query('SELECT assigned_staff_id FROM homecare_visits WHERE id = $1', [swap.visit_id])).rows[0];
      if (visit) {
        const staffResult = await query('SELECT id FROM staff_profiles WHERE user_id = $1', [uid]);
        if (staffResult.rows.length) {
          await query('UPDATE homecare_visits SET assigned_staff_id = $1 WHERE id = $2', [staffResult.rows[0].id, swap.visit_id]);
        }
      }
    } else if (status === 'accepted' && swap.request_type === 'transfer' && swap.target_staff_id) {
      await query('UPDATE homecare_visits SET assigned_staff_id = $1 WHERE id = $2', [swap.target_staff_id, swap.visit_id]);
    }

    // Notify requester
    const reqUser = swap.requested_by;
    const staffName = await query('SELECT COALESCE(sp.first_name, u.email) as name FROM users u LEFT JOIN staff_profiles sp ON sp.user_id = u.id WHERE u.id = $1', [uid]);
    const msg = `${staffName.rows[0]?.name || 'Someone'} ${status}d your ${swap.request_type} request`;
    sendPushToUser(reqUser, { type: 'swap_response', title: `Request ${status}`, body: msg, url: '/homecare' }, 'homecare').catch(() => {});
    await query(
      `INSERT INTO call_assignment_notifications (organization_id, visit_id, staff_id, notification_type, message)
       VALUES ($1, $2, $3, $4, $5)`,
      [oid, swap.visit_id, reqUser, status === 'accepted' ? 'swap_accepted' : 'swap_rejected', msg]
    );

    audit(req, 'SWAP_REQUEST_RESPONDED', 'visit_swap_request', id, { status });
    res.json({ message: `Request ${status}` });
  }

  static async listSwapRequests(req: Request, res: Response) {
    const oid = orgId(req); const uid = userId(req);
    const staffResult = await query('SELECT id FROM staff_profiles WHERE user_id = $1', [uid]);
    const staffId = staffResult.rows[0]?.id;

    const result = await query(
      `SELECT sr.*, hv.label as visit_label, hv.visit_type, hv.scheduled_start, hv.scheduled_end,
              p.first_name || ' ' || p.last_name as client_name,               COALESCE(NULLIF(TRIM(sp_req.first_name || ' ' || sp_req.last_name), ''), u_req.email) as requested_by_name,
               COALESCE(NULLIF(TRIM(sp_tgt.first_name || ' ' || sp_tgt.last_name), ''), u_tgt.email) as target_name,
               (sr.requested_by = $2) AS is_requested_by_me,
               (sr.target_staff_id = $3) AS is_target_for_me

       FROM visit_swap_requests sr
       JOIN homecare_visits hv ON hv.id = sr.visit_id
       LEFT JOIN people p ON p.id = hv.person_id
       LEFT JOIN users u_req ON u_req.id = sr.requested_by
       LEFT JOIN staff_profiles sp_req ON sp_req.user_id = u_req.id
       LEFT JOIN staff_profiles sp_tgt ON sp_tgt.id = sr.target_staff_id
       LEFT JOIN users u_tgt ON u_tgt.id = sp_tgt.user_id
       WHERE sr.organization_id = $1
         AND (sr.requested_by = $2 OR sr.target_staff_id = $3)
       ORDER BY sr.created_at DESC LIMIT 50`,
      [oid, uid, staffId]
    );
    res.json(result.rows);
  }

  static async getCarerNotifications(req: Request, res: Response) {
    const oid = orgId(req); const uid = userId(req);
    const staffResult = await query('SELECT id FROM staff_profiles WHERE user_id = $1', [uid]);
    if (!staffResult.rows.length) return res.json([]);
    const staffId = staffResult.rows[0].id;

    const result = await query(
      `SELECT * FROM call_assignment_notifications
       WHERE organization_id = $1 AND staff_id = $2
       ORDER BY created_at DESC LIMIT 50`,
      [oid, staffId]
    );
    res.json(result.rows);
  }

  static async markNotificationsRead(req: Request, res: Response) {
    const oid = orgId(req); const uid = userId(req);
    const staffResult = await query('SELECT id FROM staff_profiles WHERE user_id = $1', [uid]);
    if (!staffResult.rows.length) return res.json({ updated: 0 });
    const staffId = staffResult.rows[0].id;

    const result = await query(
      `UPDATE call_assignment_notifications SET read = TRUE
       WHERE organization_id = $1 AND staff_id = $2 AND read = FALSE`,
      [oid, staffId]
    );
    res.json({ updated: result.rowCount });
  }

  static async getWeekVisits(req: Request, res: Response) {
    const oid = orgId(req); const uid = userId(req);
    const staffResult = await query('SELECT id FROM staff_profiles WHERE user_id = $1', [uid]);
    if (!staffResult.rows.length) return res.json([]);
    const staffId = staffResult.rows[0].id;

    const from = req.query.from as string;
    const to = req.query.to as string;
    if (!from || !to) throw new AppError(400, 'from and to query params required');

    const result = await query(
      `SELECT hv.*, p.first_name || ' ' || p.last_name as person_name,
              p.address as person_address, hp.name as package_name,
              sp.first_name || ' ' || sp.last_name as assigned_staff_name
       FROM homecare_visits hv
       LEFT JOIN people p ON p.id = hv.person_id
       LEFT JOIN homecare_packages hp ON hp.id = hv.package_id
       LEFT JOIN staff_profiles sp ON sp.id = hv.assigned_staff_id
       WHERE hv.organization_id = $1
         AND hv.assigned_staff_id = $2
         AND hv.scheduled_start >= $3 AND hv.scheduled_start <= $4
         AND hv.status NOT IN ('cancelled')
       ORDER BY hv.scheduled_start`,
      [oid, staffId, from, to]
    );
    res.json(result.rows);
  }

  /* ─── Earnings summary ────────────────────────────────────── */
  static async getMyEarnings(req: Request, res: Response) {
    const oid = orgId(req); const uid = userId(req);
    const staffId = await repo.getStaffProfileIdForUser(oid, uid);
    if (!staffId) return res.json({ summary: {}, visits: [], ytd: null });
    const from = req.query.from as string;
    const to = req.query.to as string;
    if (!from || !to) throw new AppError(400, 'from and to date parameters are required');

    // Completed visits and their timesheet figures for the period. The same
    // repository query and the same totals function build the carer's payslip,
    // so the screen and the payslip can never disagree.
    const visits = await repo.getStaffPeriodEarnings(oid, staffId, from, to);
    const totals = summariseEarnings(visits);
    const ytd = await getYearToDateTotals(oid, staffId, to);
    const avgHourlyRate = totals.hourly_rate_pence;
    const avgMileageRate = totals.mileage_rate_pence;

    // Also get upcoming scheduled visits for the same period to show projected earnings
    const scheduled = await query(
      `SELECT hv.id, hv.label, hv.visit_type, hv.scheduled_start, hv.scheduled_end, hv.status,
              pe.first_name || ' ' || pe.last_name AS person_name,
              p.hourly_rate_pence, p.mileage_rate_pence, p.travel_time_paid,
              hv.actual_mileage_miles, hv.actual_travel_minutes
       FROM homecare_visits hv
       JOIN people pe ON pe.id = hv.person_id
       JOIN homecare_packages p ON p.id = hv.package_id
       WHERE hv.organization_id = $1 AND hv.assigned_staff_id = $2
         AND hv.scheduled_start >= $3 AND hv.scheduled_start <= $4
         AND hv.status IN ('scheduled', 'en_route')
       ORDER BY hv.scheduled_start`,
      [oid, staffId, from, to]
    );

    const projectedWorkMinutes = scheduled.rows.reduce((s: number, v: any) => {
      const dur = Math.round((new Date(v.scheduled_end).getTime() - new Date(v.scheduled_start).getTime()) / 60000);
      return s + Math.max(0, dur);
    }, 0);
    const projectedWorkHours = projectedWorkMinutes / 60;
    const projectedWorkPay = avgHourlyRate ? Math.round(projectedWorkHours * Number(avgHourlyRate)) : 0;
    const projectedMileagePay = avgMileageRate ? scheduled.rows.length * 0.5 * Number(avgMileageRate) : 0; // rough estimate

    res.json({
      summary: {
        ...totals,
        scheduled_count: scheduled.rows.length,
        projected_work_minutes: projectedWorkMinutes,
        projected_gross_pay_pence: projectedWorkPay + projectedMileagePay,
      },
      visits,
      scheduled: scheduled.rows,
      ytd,
    });
  }

  /**
   * Download a payslip as a PDF. Carers get their own payslip; managers and
   * admins may request any carer in their own organisation with `staffId`.
   * Payroll data is sensitive, so every download is audited.
   */
  static async downloadPayslip(req: Request, res: Response) {
    const oid = orgId(req);
    const uid = userId(req);
    const rawFrom = req.query.from as string;
    const rawTo = req.query.to as string;
    if (!rawFrom || !rawTo) throw new AppError(400, 'from and to date parameters are required');
    // Accept either a date or a full ISO timestamp (the mobile app sends the
    // latter); the period is a calendar day range either way.
    const from = rawFrom.slice(0, 10);
    const to = rawTo.slice(0, 10);

    const requestedStaffId = (req.query.staffId as string) || undefined;
    let staffId: string | null;
    if (requestedStaffId) {
      const role = req.user!.role;
      if (role !== UserRole.ORG_ADMIN && role !== UserRole.MANAGER) {
        throw new AppError(403, 'Only managers can download another carer\u2019s payslip');
      }
      staffId = requestedStaffId;
    } else {
      staffId = await repo.getStaffProfileIdForUser(oid, uid);
    }
    if (!staffId) throw new AppError(404, 'No staff profile found for this account');

    // buildPayslipData refuses a staff member outside the caller's organisation.
    const data = await buildPayslipData(oid, staffId, from, to);
    if (!data) throw new AppError(404, 'Staff member not found');

    const pdf = await renderPayslipPdf(data);
    const namePart = data.userName.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'carer';
    audit(req, 'download_payslip', 'staff_profile', staffId, { from, to });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="payslip-${namePart}-${from}.pdf"`);
    res.send(pdf);
  }

  /* ─── Ride Sharing ─────────────────────────────────────── */

  /**
   * Colleagues a carer can swap, transfer or share a ride with. Returns only what
   * those flows need — the staff profile id (what `/staff-visits/:staffId` takes)
   * and a display name — so carers do not need access to the manager-only staff
   * directory, which carries contact and employment details.
   */
  static async listColleagues(req: Request, res: Response) {
    const oid = orgId(req);
    const uid = userId(req);
    const result = await query(
      `SELECT sp.id, sp.user_id, sp.first_name, sp.last_name, u.role,
              COALESCE(sp.first_name || ' ' || sp.last_name, u.email) AS name
       FROM staff_profiles sp
       JOIN users u ON u.id = sp.user_id
       WHERE u.organization_id = $1 AND u.id <> $2 AND u.status = 'active'
       ORDER BY COALESCE(sp.first_name, u.email)`,
      [oid, uid]
    );
    res.json(result.rows);
  }

  static async listRideShareRequests(req: Request, res: Response) {
    const oid = orgId(req);
    const uid = userId(req);
    const staffResult = await query('SELECT id FROM staff_profiles WHERE user_id = $1', [uid]);
    const staffId = staffResult.rows[0]?.id;

    const result = await query(
      `SELECT rsr.*,
              hv.label AS visit_label, hv.scheduled_start, hv.scheduled_end,
              hv2.label AS target_visit_label, hv2.scheduled_start AS target_scheduled_start, hv2.scheduled_end AS target_scheduled_end,
              pe1.first_name || ' ' || pe1.last_name AS client_name,
              pe2.first_name || ' ' || pe2.last_name AS target_client_name,
              sp1.first_name || ' ' || sp1.last_name AS carer_name,
              sp2.first_name || ' ' || sp2.last_name AS target_carer_name,
              COALESCE(ts1.mileage_miles, hv.actual_mileage_miles, 0)::numeric AS mileage_miles,
              COALESCE(ts2.mileage_miles, hv2.actual_mileage_miles, 0)::numeric AS target_mileage_miles,
              COALESCE(ts1.mileage_rate_pence, ts2.mileage_rate_pence, hv.mileage_rate_pence, hv2.mileage_rate_pence, 45)::integer AS mileage_rate_pence,
              l1.latitude AS client_latitude, l1.longitude AS client_longitude,
              l2.latitude AS target_client_latitude, l2.longitude AS target_client_longitude
       FROM ride_share_requests rsr
       JOIN homecare_visits hv ON hv.id = rsr.visit_id
       JOIN people pe1 ON pe1.id = hv.person_id
       JOIN staff_profiles sp1 ON sp1.id = hv.assigned_staff_id
       LEFT JOIN homecare_visits hv2 ON hv2.id = rsr.target_visit_id
       LEFT JOIN people pe2 ON pe2.id = hv2.person_id
       LEFT JOIN staff_profiles sp2 ON sp2.id = hv2.assigned_staff_id
       LEFT JOIN locations l1 ON l1.id = pe1.location_id
       LEFT JOIN locations l2 ON l2.id = pe2.location_id
       LEFT JOIN homecare_timesheets ts1 ON ts1.visit_id = hv.id
       LEFT JOIN homecare_timesheets ts2 ON ts2.visit_id = hv2.id
       WHERE rsr.organization_id = $1
         AND (rsr.requested_by = $2 OR hv2.assigned_staff_id = $3)
       ORDER BY rsr.created_at DESC LIMIT 50`,
      [oid, uid, staffId]
    );
    const rows = result.rows.map((row: any) => {
      const directMiles = (lat1: number | null, lon1: number | null, lat2: number | null, lon2: number | null) => {
        if ([lat1, lon1, lat2, lon2].some(value => value == null || Number.isNaN(Number(value)))) return 0;
        const radians = (value: number) => value * Math.PI / 180;
        const dLat = radians(Number(lat2) - Number(lat1));
        const dLon = radians(Number(lon2) - Number(lon1));
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(Number(lat1))) * Math.cos(radians(Number(lat2))) * Math.sin(dLon / 2) ** 2;
        return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      };
      const ownMiles = Number(row.mileage_miles || 0) || directMiles(row.client_latitude, row.client_longitude, row.target_client_latitude, row.target_client_longitude);
      const targetMiles = Number(row.target_mileage_miles || 0) || directMiles(row.target_client_latitude, row.target_client_longitude, row.client_latitude, row.client_longitude);
      const estimatedMiles = Math.round((ownMiles + targetMiles) * 0.5 * 100) / 100;
      return { ...row, estimated_mileage_savings_miles: estimatedMiles, estimated_savings_pence: Math.round(estimatedMiles * Number(row.mileage_rate_pence || 45)) };
    });
    res.json(rows);
  }

  static async createRideShareRequest(req: Request, res: Response) {
    const oid = orgId(req);
    const uid = userId(req);
    const { visit_id, target_visit_id, message } = req.body;
    if (!visit_id || !target_visit_id) throw new AppError(400, 'visit_id and target_visit_id required');
    if (visit_id === target_visit_id) throw new AppError(400, 'Cannot share a ride with yourself');

    const v1 = await query(`SELECT v.*, sp.user_id AS assigned_user_id
      FROM homecare_visits v LEFT JOIN staff_profiles sp ON sp.id = v.assigned_staff_id
      WHERE v.id = $1 AND v.organization_id = $2`, [visit_id, oid]);
    const v2 = await query(`SELECT v.*, sp.user_id AS assigned_user_id
      FROM homecare_visits v LEFT JOIN staff_profiles sp ON sp.id = v.assigned_staff_id
      WHERE v.id = $1 AND v.organization_id = $2`, [target_visit_id, oid]);
    if (!v1.rows.length || !v2.rows.length) throw new AppError(404, 'Visit not found');
    if (v1.rows[0].assigned_user_id !== uid) throw new AppError(403, 'You can only share one of your own assigned visits');
    if (!v2.rows[0].assigned_user_id || v2.rows[0].assigned_user_id === uid) throw new AppError(400, 'The target visit must be assigned to another carer');

    // Check for existing request on either visit
    const existing = await query(
      `SELECT id FROM ride_share_requests
       WHERE organization_id = $1 AND status = 'pending'
         AND (visit_id = $2 OR target_visit_id = $2 OR visit_id = $3 OR target_visit_id = $3)`,
      [oid, visit_id, target_visit_id]
    );
    if (existing.rows.length) throw new AppError(409, 'A ride share request already exists for one of these visits');

    const result = await query(
      `INSERT INTO ride_share_requests (organization_id, visit_id, target_visit_id, requested_by, message)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [oid, visit_id, target_visit_id, uid, message || null]
    );

    // Notify target carer
    const targetVisit = v2.rows[0];
    if (targetVisit.assigned_staff_id) {
      const targetUser = await query('SELECT user_id FROM staff_profiles WHERE id = $1', [targetVisit.assigned_staff_id]);
      if (targetUser.rows.length) {
        const reqName = await query('SELECT COALESCE(sp.first_name, u.email) as name FROM users u LEFT JOIN staff_profiles sp ON sp.user_id = u.id WHERE u.id = $1', [uid]);
        const msg = `${reqName.rows[0]?.name || 'A carer'} wants to share a ride for the ${v1.rows[0].label || v1.rows[0].visit_type} call`;
        const { sendPushToUser } = await import('../notifications/push.service');
        sendPushToUser(targetUser.rows[0].user_id, { type: 'ride_share_request', title: 'Ride share request', body: msg, url: '/homecare' }, 'homecare').catch(() => {});
      }
    }

    audit(req, 'RIDE_SHARE_REQUEST', 'ride_share_request', result.rows[0].id, result.rows[0]);
    res.status(201).json(result.rows[0]);
  }

  static async respondRideShareRequest(req: Request, res: Response) {
    const oid = orgId(req);
    const uid = userId(req);
    const { id } = req.params;
    const { status } = req.body;
    if (!['accepted', 'declined'].includes(status)) throw new AppError(400, 'Status must be accepted or declined');

    const reqResult = await query(
      'SELECT * FROM ride_share_requests WHERE id = $1 AND organization_id = $2', [id, oid]
    );
    if (!reqResult.rows.length) throw new AppError(404, 'Request not found');
    const rsr = reqResult.rows[0];
    if (rsr.status !== 'pending') throw new AppError(409, 'Request already responded to');
    const targetStaff = await query(`SELECT sp.user_id FROM homecare_visits v
      JOIN staff_profiles sp ON sp.id = v.assigned_staff_id
      WHERE v.id = $1 AND v.organization_id = $2`, [rsr.target_visit_id, oid]);
    if (!targetStaff.rows[0] || targetStaff.rows[0].user_id !== uid) throw new AppError(403, 'Only the target carer can respond to this request');

    await query(
      `UPDATE ride_share_requests SET status = $1, responded_by = $2, responded_at = NOW(), updated_at = NOW() WHERE id = $3`,
      [status, uid, id]
    );
    if (status === 'accepted') {
      // Link the visits and split mileage 50/50
      await query('UPDATE homecare_visits SET ride_share_id = $1, ride_share_split_pct = 50 WHERE id = $2', [rsr.id, rsr.visit_id]);
      await query('UPDATE homecare_visits SET ride_share_id = $1, ride_share_split_pct = 50 WHERE id = $2', [rsr.id, rsr.target_visit_id]);
    }

    const staffName = await query('SELECT COALESCE(sp.first_name, u.email) as name FROM users u LEFT JOIN staff_profiles sp ON sp.user_id = u.id WHERE u.id = $1', [uid]);
    const msg = `${staffName.rows[0]?.name || 'Someone'} ${status}d your ride share request`;
    const { sendPushToUser } = await import('../notifications/push.service');
    sendPushToUser(rsr.requested_by, { type: 'ride_share_response', title: `Ride share ${status}`, body: msg, url: '/homecare' }, 'homecare').catch(() => {});

    audit(req, 'RIDE_SHARE_RESPONSE', 'ride_share_requests', id, { status });
    res.json({ message: `Ride share ${status}` });
  }
}
