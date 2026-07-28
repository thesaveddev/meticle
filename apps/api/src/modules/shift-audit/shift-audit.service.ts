import { ShiftAuditRepository } from './shift-audit.repository';
import { EmailService } from '../../shared/utils/email.service';
import logger from '../../shared/utils/logger';

interface ShiftAssignment {
  staff_id: string;
  first_name: string;
  last_name: string;
  email: string;
  user_role: string;
  assignment_status: string;
  is_overtime: boolean;
}

interface EmarAdmin {
  service_user_id: string;
  medication_name: string;
  admin_status: string;
  is_prn: boolean;
}

export interface LocationAudit {
  location_name: string;
  manager_name: string;
  manager_email: string;
  total_shifts: number;
  staff_deployed: number;
  minimum_staff: number;
  staffing_ok: boolean;
  shifts: {
    shift_type: string;
    start_time: string;
    end_time: string;
    status: string;
    su_name: string | null;
    staff: ShiftAssignment[];
  }[];
  emar: {
    service_user_name: string;
    required: number;
    given: number;
    missed: number;
    refused: number;
  }[];
}

export class ShiftAuditService {
  static async generateDailyAudit(organizationId: string, date?: string): Promise<{ date: string; locations: LocationAudit[] } | null> {
    const auditDate = date || new Date().toISOString().slice(0, 10);

    const shifts = await ShiftAuditRepository.getShiftsForDate(organizationId, auditDate);
    if (shifts.length === 0) return null;

    const shiftIds = shifts.map((s: any) => s.id);
    const assignments = await ShiftAuditRepository.getShiftAssignments(shiftIds);

    const assignmentsByShift = new Map<string, ShiftAssignment[]>();
    for (const a of assignments) {
      const list = assignmentsByShift.get(a.shift_id) || [];
      list.push(a);
      assignmentsByShift.set(a.shift_id, list);
    }

    const serviceUserIds = [...new Set(shifts.filter((s: any) => s.service_user_id).map((s: any) => s.service_user_id))];
    const emarData = serviceUserIds.length > 0
      ? await ShiftAuditRepository.getEmedicationAdministrations(serviceUserIds, auditDate)
      : [];

    const emarBySu = new Map<string, EmarAdmin[]>();
    for (const e of emarData) {
      const list = emarBySu.get(e.service_user_id) || [];
      list.push(e);
      emarBySu.set(e.service_user_id, list);
    }

    const managers = await ShiftAuditRepository.getLocationManagers(organizationId);
    const managerMap = new Map<string, any>();
    for (const m of managers) {
      managerMap.set(m.location_id, m);
    }

    const locationMap = new Map<string, LocationAudit>();
    const locationSuIds = new Map<string, Set<string>>();

    for (const s of shifts) {
      if (!locationMap.has(s.location_id)) {
        const mgr = managerMap.get(s.location_id);
        locationMap.set(s.location_id, {
          location_name: s.location_name,
          manager_name: mgr?.manager_name || 'No manager assigned',
          manager_email: mgr?.manager_email || '',
          total_shifts: 0,
          staff_deployed: 0,
          minimum_staff: s.minimum_staff_per_day || 1,
          staffing_ok: true,
          shifts: [],
          emar: [],
        });
        locationSuIds.set(s.location_id, new Set());
      }
      const loc = locationMap.get(s.location_id)!;
      loc.total_shifts++;

      const staff = assignmentsByShift.get(s.id) || [];
      loc.staff_deployed += staff.length;

      loc.shifts.push({
        shift_type: s.shift_type,
        start_time: s.start_time,
        end_time: s.end_time,
        status: s.status,
        su_name: s.su_first_name && s.su_last_name
          ? `${s.su_first_name} ${s.su_last_name}`
          : null,
        staff,
      });

      if (s.service_user_id) {
        locationSuIds.get(s.location_id)!.add(s.service_user_id);
      }
    }

    for (const [, loc] of locationMap) {
      loc.staffing_ok = loc.staff_deployed >= loc.minimum_staff;
    }

    for (const [locId, loc] of locationMap) {
      const suIds = locationSuIds.get(locId) || new Set<string>();
      const emarStats: LocationAudit['emar'] = [];

      for (const suId of suIds) {
        const admins = emarBySu.get(suId) || [];
        if (admins.length === 0) continue;

        const first = shifts.find((s: any) => s.service_user_id === suId);
        const suName = first
          ? `${first.su_first_name} ${first.su_last_name}`
          : 'Unknown';

        const nonPrn = admins.filter(a => !a.is_prn);
        emarStats.push({
          service_user_name: suName,
          required: nonPrn.length,
          given: nonPrn.filter(a => a.admin_status === 'given').length,
          missed: nonPrn.filter(a => a.admin_status === 'missed').length,
          refused: nonPrn.filter(a => a.admin_status === 'refused').length,
        });
      }

      loc.emar = emarStats;
    }

    return {
      date: auditDate,
      locations: Array.from(locationMap.values()),
    };
  }

  static async sendDailyAuditEmails(date?: string): Promise<number> {
    const auditDate = date || new Date().toISOString().slice(0, 10);

    const orgResult = await ShiftAuditRepository.getAllOrgIds();
    if (orgResult.length === 0) {
      logger.info('Shift audit: no organizations with shifts today');
      return 0;
    }

    let emailsSent = 0;

    for (const orgId of orgResult) {
      const audit = await this.generateDailyAudit(orgId, auditDate);
      if (!audit) continue;

      for (const loc of audit.locations) {
        if (!loc.manager_email) {
          logger.warn({ location: loc.location_name }, 'Shift audit: no manager email, skipping');
          continue;
        }

        try {
          await EmailService.sendShiftAuditEmail(
            loc.manager_email,
            loc.manager_name,
            auditDate,
            loc
          );
          emailsSent++;
          logger.info({
            location: loc.location_name,
            manager: loc.manager_email,
            date: auditDate,
          }, 'Shift audit email sent');
        } catch (err: any) {
          logger.error({
            err: err.message,
            location: loc.location_name,
            manager: loc.manager_email,
          }, 'Shift audit email failed');
        }
      }
    }

    return emailsSent;
  }
}
