import { query, transaction } from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';
import { HomecarePackageInput, HomecareVisitInput, HomecareVisitPlanInput, HomecareVisitUpdateInput, VisitExecutionInput, HomecareTimesheetUpdateInput, HomecareExceptionInput, PayrollExportFilters } from './homecare.types';
import { applyVat, buildFundingBreakdown, calculateClientBillingLine, fundingLabel, cancellationPolicyLabel, type ClientBillingUtilisationRow } from './client-billing';

const PACKAGE_SELECT = `
  SELECT p.*, pe.first_name || ' ' || pe.last_name AS person_name
  FROM homecare_packages p
  JOIN people pe ON pe.id = p.person_id
`;

const VISIT_SELECT = `
  SELECT v.*, pe.first_name || ' ' || pe.last_name AS person_name,
    sp.first_name || ' ' || sp.last_name AS assigned_staff_name,
    l.address AS person_address,
    p.name AS package_name,
    p.mileage_rate_pence
  FROM homecare_visits v
  JOIN people pe ON pe.id = v.person_id
  JOIN homecare_packages p ON p.id = v.package_id AND p.organization_id = v.organization_id
  LEFT JOIN staff_profiles sp ON sp.id = v.assigned_staff_id
  LEFT JOIN locations l ON l.id = pe.location_id
`;

async function assertPackage(packageId: string, orgId: string) {
  const result = await query('SELECT * FROM homecare_packages WHERE id = $1 AND organization_id = $2', [packageId, orgId]);
  if (!result.rows[0]) throw new AppError(404, 'Care package not found');
  return result.rows[0];
}

async function assertPerson(personId: string, orgId: string) {
  const result = await query('SELECT id FROM people WHERE id = $1 AND organization_id = $2', [personId, orgId]);
  if (!result.rows[0]) throw new AppError(404, 'Person not found');
}

async function assertStaff(staffId: string | null | undefined, orgId: string) {
  if (!staffId) return;
  const result = await query(`SELECT sp.id FROM staff_profiles sp JOIN users u ON u.id = sp.user_id WHERE sp.id = $1 AND u.organization_id = $2 AND u.status = 'active'`, [staffId, orgId]);
  if (!result.rows[0]) throw new AppError(400, 'Assigned carer is not an active member of this organisation');
}

export async function listClientBillingRuns(orgId: string) {
  return (await query(`SELECT r.*, u.email AS created_by_email, au.email AS approved_by_email
    FROM homecare_client_billing_runs r
    LEFT JOIN users u ON u.id = r.created_by
    LEFT JOIN users au ON au.id = r.approved_by
    WHERE r.organization_id = $1 ORDER BY r.period_from DESC, r.created_at DESC`, [orgId])).rows;
}

export async function getClientBillingRun(orgId: string, runId: string) {
  const result = await query(`SELECT r.*, u.email AS created_by_email, au.email AS approved_by_email
    FROM homecare_client_billing_runs r
    LEFT JOIN users u ON u.id = r.created_by
    LEFT JOIN users au ON au.id = r.approved_by
    WHERE r.organization_id = $1 AND r.id = $2`, [orgId, runId]);
  return result.rows[0] || null;
}

export async function getSupplierInfo(orgId: string) {
  const result = await query(
    `SELECT name, primary_color, billing_config FROM organizations WHERE id = $1`, [orgId]);
  const org = result.rows[0] || {};
  const config = (org.billing_config || {}) as any;
  return {
    name: org.name || 'Meticle Care Provider',
    address: config?.registered_address || 'United Kingdom',
    vat_number: config?.vat_number || null,
    company_number: config?.company_number || null,
    email: config?.invoice_email || 'billing@meticlecare.com',
    phone: config?.phone || null,
    color: org.primary_color || '#0F4C81',
  };
}

export async function getCustomerInfo(orgId: string, run: any) {
  // For client billing, the "customer" is the funder or the client
  const billingBreakdown = run.funding_breakdown || {};
  const funderTypes = Object.keys(billingBreakdown);
  // Use the org name as the customer (the provider is billing on behalf of funders)
  const result = await query(`SELECT name FROM organizations WHERE id = $1`, [orgId]);
  return {
    name: result.rows[0]?.name || 'Meticle Care Client',
    address: null,
    contact_email: null,
  };
}

async function resolveBillingVat(orgId: string) {
  const billing = await query('SELECT billing_config FROM organizations WHERE id = $1', [orgId]);
  const config = (billing.rows[0]?.billing_config || {}) as any;
  const vatRate = config?.domiciliary?.vat_rate == null ? null : Number(config.domiciliary.vat_rate);
  const vatInclusive = Boolean(config?.domiciliary?.vat_inclusive);
  const validatedRate = vatRate == null || Number.isNaN(vatRate) ? null : Math.max(0, Math.min(100, Math.round(vatRate)));
  return { vatRate: validatedRate, vatInclusive };
}

export async function buildClientBillingUtilisation(orgId: string, from: string, to: string): Promise<ClientBillingUtilisationRow[]> {
  const vat = await resolveBillingVat(orgId);
  const result = await query(`SELECT v.id AS visit_id, v.package_id, v.person_id,
      pe.first_name || ' ' || pe.last_name AS person_name, p.name AS package_name,
      p.funding_type, v.status AS visit_status, v.scheduled_start,
      EXTRACT(EPOCH FROM (v.scheduled_end - v.scheduled_start)) / 60 AS scheduled_minutes,
      CASE WHEN v.status = 'completed' AND v.check_in_at IS NOT NULL AND v.check_out_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (v.check_out_at - v.check_in_at)) / 60 ELSE 0 END AS delivered_minutes,
      p.client_rate_pence
    FROM homecare_visits v
    JOIN homecare_packages p ON p.id = v.package_id AND p.organization_id = v.organization_id
    JOIN people pe ON pe.id = v.person_id
    WHERE v.organization_id = $1 AND v.scheduled_start >= $2::date
      AND v.scheduled_start < ($3::date + INTERVAL '1 day')
    ORDER BY v.scheduled_start, person_name`, [orgId, from, to]);
  return result.rows.map((row: any) => {
    const line = calculateClientBillingLine({
      visitStatus: row.visit_status,
      scheduledMinutes: Number(row.scheduled_minutes),
      deliveredMinutes: Number(row.delivered_minutes),
      clientRatePence: row.client_rate_pence == null ? null : Number(row.client_rate_pence),
      fundingType: row.funding_type,
      vatRate: vat.vatRate,
      vatInclusive: vat.vatInclusive,
    });
    return {
      ...row,
      scheduled_start: new Date(row.scheduled_start).toISOString(),
      scheduled_minutes: line.scheduledMinutes,
      delivered_minutes: line.deliveredMinutes,
      client_rate_pence: line.clientRatePence,
      amount_pence: line.amountPence,
      net_amount_pence: line.netAmountPence,
      vat_rate: line.vatRate,
      vat_inclusive: line.vatInclusive,
      vat_amount_pence: line.vatAmountPence,
      gross_amount_pence: line.grossAmountPence,
      funding_applied: fundingLabel(row.funding_type),
      cancellation_policy_applied: cancellationPolicyLabel(row.visit_status),
      billing_status: line.billingStatus,
      exclusion_reason: line.exclusionReason,
    };
  });
}

export async function createClientBillingRun(orgId: string, userId: string, from: string, to: string) {
  // Prevent duplicate billing runs for the same period
  const existing = await query(
    `SELECT id, status FROM homecare_client_billing_runs
     WHERE organization_id = $1 AND period_from = $2 AND period_to = $3 AND status != 'void'
     LIMIT 1`, [orgId, from, to]);
  if (existing.rows[0]) {
    throw new AppError(409, `A billing run already exists for ${from} to ${to} (status: ${existing.rows[0].status})`);
  }
  const vat = await resolveBillingVat(orgId);
  const lines = await buildClientBillingUtilisation(orgId, from, to);
  const fundedRows = lines.map((row) => ({
    funding_type: row.funding_type,
    gross_amount_pence: row.gross_amount_pence,
    net_amount_pence: row.net_amount_pence,
    vat_amount_pence: row.vat_amount_pence,
    billing_status: row.billing_status,
  }));
  const fundingBreakdown = buildFundingBreakdown(fundedRows);
  const totals = lines.reduce(
    (acc, row) => ({
      net: acc.net + row.net_amount_pence,
      vat: acc.vat + row.vat_amount_pence,
      gross: acc.gross + row.gross_amount_pence,
    }),
    { net: 0, vat: 0, gross: 0 },
  );
  return transaction(async (client) => {
    const runResult = await client.query(`INSERT INTO homecare_client_billing_runs
      (organization_id, period_from, period_to, row_count, total_amount_pence, subtotal_pence, vat_rate, vat_inclusive, vat_amount_pence, gross_amount_pence, funding_breakdown, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`, [orgId, from, to, lines.length, totals.gross, totals.net, vat.vatRate, vat.vatInclusive, totals.vat, totals.gross, JSON.stringify(fundingBreakdown), userId]);
    for (const line of lines) {
      await client.query(`INSERT INTO homecare_client_billing_lines
        (organization_id, run_id, visit_id, package_id, person_id, funding_type, visit_status,
         scheduled_minutes, delivered_minutes, client_rate_pence, amount_pence, net_amount_pence, vat_rate, vat_inclusive, vat_amount_pence, gross_amount_pence, funding_applied, cancellation_policy_applied, billing_status, exclusion_reason)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
        [orgId, runResult.rows[0].id, line.visit_id, line.package_id, line.person_id, line.funding_type, line.visit_status,
          line.scheduled_minutes, line.delivered_minutes, line.client_rate_pence, line.amount_pence, line.net_amount_pence, line.vat_rate, line.vat_inclusive, line.vat_amount_pence, line.gross_amount_pence, line.funding_applied, line.cancellation_policy_applied, line.billing_status, line.exclusion_reason]);
    }
    return { run: runResult.rows[0], lines };
  });
}

export async function listClientBillingLines(orgId: string, runId: string) {
  return (await query(`SELECT l.*, pe.first_name || ' ' || pe.last_name AS person_name, p.name AS package_name
    FROM homecare_client_billing_lines l
    JOIN people pe ON pe.id = l.person_id
    JOIN homecare_packages p ON p.id = l.package_id
    WHERE l.organization_id = $1 AND l.run_id = $2 ORDER BY l.created_at`, [orgId, runId])).rows;
}

export async function approveClientBillingRun(orgId: string, userId: string, runId: string) {
  const existing = await query('SELECT id, status, voided_at FROM homecare_client_billing_runs WHERE id = $1 AND organization_id = $2', [runId, orgId]);
  if (!existing.rows[0]) throw new AppError(404, 'Billing run not found');
  if (existing.rows[0].voided_at) throw new AppError(409, 'A voided billing run cannot be approved');
  const result = await query(`UPDATE homecare_client_billing_runs
    SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW(),
        invoice_number = COALESCE(invoice_number, 'HC-' || to_char(NOW(), 'YYYYMM') || '-' || substring(id::text from 1 for 8))
    WHERE id = $2 AND organization_id = $3 AND status = 'draft' RETURNING *`, [userId, runId, orgId]);
  if (!result.rows[0]) throw new AppError(409, 'Only a draft billing run can be approved');
  return result.rows[0];
}

export async function voidClientBillingRun(orgId: string, userId: string, runId: string, reason?: string | null) {
  const current = await query('SELECT id, status, voided_at FROM homecare_client_billing_runs WHERE id = $1 AND organization_id = $2', [runId, orgId]);
  if (!current.rows[0]) throw new AppError(404, 'Billing run not found');
  if (current.rows[0].voided_at) throw new AppError(409, 'Billing run is already voided');
  if (current.rows[0].status !== 'approved') throw new AppError(409, 'Only an approved billing run can be voided');
  const result = await query(`UPDATE homecare_client_billing_runs
    SET status = 'void', voided_at = NOW(), voided_by = $1, void_reason = $2, updated_at = NOW()
    WHERE id = $3 AND organization_id = $4 RETURNING *`, [userId, reason || 'Voided by manager', runId, orgId]);
  return result.rows[0];
}

export async function listPackages(orgId: string) {
  const result = await query(`${PACKAGE_SELECT} WHERE p.organization_id = $1 ORDER BY p.status, p.start_date DESC, p.created_at DESC`, [orgId]);
  return result.rows;
}

export async function createPackage(orgId: string, userId: string, input: HomecarePackageInput) {
  if (input.person_id) await assertPerson(input.person_id, orgId);
  const result = await query(`INSERT INTO homecare_packages (organization_id, person_id, name, status, funding_type, start_date, end_date, weekly_hours, hourly_rate_pence, travel_time_paid, mileage_rate_pence, client_rate_pence, notes, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`, [orgId, input.person_id || null, input.name, input.status || 'draft', input.funding_type || 'private', input.start_date || new Date().toISOString().slice(0, 10), input.end_date || null, input.weekly_hours ?? null, input.hourly_rate_pence ?? null, input.travel_time_paid ?? true, input.mileage_rate_pence ?? null, (input as any).client_rate_pence ?? null, input.notes || null, userId]);
  return result.rows[0];
}

export async function updatePackage(orgId: string, packageId: string, input: Partial<HomecarePackageInput>) {
  await assertPackage(packageId, orgId);
  const allowed = ['name','status','funding_type','start_date','end_date','weekly_hours','hourly_rate_pence','travel_time_paid','mileage_rate_pence','client_rate_pence','notes'];
  const entries = Object.entries(input).filter(([key]) => allowed.includes(key));
  if (!entries.length) return (await query(`${PACKAGE_SELECT} WHERE p.id = $1 AND p.organization_id = $2`, [packageId, orgId])).rows[0];
  const values = entries.map(([, value]) => value);
  const set = entries.map(([key], index) => `${key} = $${index + 1}`).join(', ');
  const result = await query(`UPDATE homecare_packages SET ${set}, updated_at = NOW() WHERE id = $${values.length + 1} AND organization_id = $${values.length + 2} RETURNING *`, [...values, packageId, orgId]);
  return result.rows[0];
}

export async function listStaff(orgId: string) {
  return (await query(`SELECT sp.id, sp.first_name, sp.last_name, sp.user_id
    FROM staff_profiles sp JOIN users u ON u.id = sp.user_id
    WHERE u.organization_id = $1 AND u.status = 'active' AND u.role = 'CARE_WORKER'
    ORDER BY sp.first_name, sp.last_name`, [orgId])).rows;
}

export async function listVisitPlans(orgId: string, packageId: string) {
  await assertPackage(packageId, orgId);
  return (await query('SELECT * FROM homecare_visit_plans WHERE organization_id = $1 AND package_id = $2 ORDER BY start_time, label', [orgId, packageId])).rows;
}

export async function createVisitPlan(orgId: string, input: HomecareVisitPlanInput) {
  await assertPackage(input.package_id, orgId);
  await assertStaff(input.default_staff_id, orgId);
  const result = await query(`INSERT INTO homecare_visit_plans (organization_id, package_id, visit_type, label, days_of_week, start_time, duration_minutes, travel_buffer_minutes, required_skills, default_staff_id, default_tasks, hourly_rate_pence, mileage_rate_pence)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`, [orgId, input.package_id, input.visit_type, input.label, input.days_of_week, input.start_time, input.duration_minutes, input.travel_buffer_minutes ?? 15, input.required_skills || [], input.default_staff_id || null, JSON.stringify(input.default_tasks || []), input.hourly_rate_pence ?? null, input.mileage_rate_pence ?? null]);
  return result.rows[0];
}

export async function listVisits(orgId: string, filters: { from?: string; to?: string; staffId?: string; status?: string }) {
  const conditions = ['v.organization_id = $1'];
  const params: any[] = [orgId];
  let i = 2;
  if (filters.from) { conditions.push(`v.scheduled_start >= $${i++}`); params.push(filters.from); }
  if (filters.to) { conditions.push(`v.scheduled_start < $${i++}`); params.push(filters.to); }
  if (filters.staffId) { conditions.push(`v.assigned_staff_id = $${i++}`); params.push(filters.staffId); }
  if (filters.status) { conditions.push(`v.status = $${i++}`); params.push(filters.status); }
  return (await query(`${VISIT_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY v.scheduled_start`, params)).rows;
}

export async function createVisit(orgId: string, userId: string, input: HomecareVisitInput) {
  const pkg = await assertPackage(input.package_id, orgId);
  await assertPerson(input.person_id, orgId);
  if (pkg.person_id !== input.person_id) throw new AppError(400, 'The visit person must belong to the selected care package');
  await assertStaff(input.assigned_staff_id, orgId);
  if (input.assigned_staff_id && await hasVisitConflict(orgId, input.assigned_staff_id, input.scheduled_start, input.scheduled_end)) {
    throw new AppError(409, 'Assigned carer already has an overlapping homecare visit');
  }
  const result = await query(`INSERT INTO homecare_visits (organization_id, package_id, visit_plan_id, person_id, assigned_staff_id, visit_type, label, scheduled_start, scheduled_end, created_by, hourly_rate_pence, mileage_rate_pence)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`, [orgId, input.package_id, input.visit_plan_id || null, input.person_id, input.assigned_staff_id || null, input.visit_type, input.label, input.scheduled_start, input.scheduled_end, userId, input.hourly_rate_pence ?? null, input.mileage_rate_pence ?? null]);
  return result.rows[0];
}

async function hasVisitConflict(orgId: string, staffId: string, start: string, end: string, excludeVisitId?: string, travelBufferMinutes = 30) {
  // Check for overlap considering travel buffer: extend end time by buffer
  // and check if any existing visit falls within [start - buffer, end + buffer]
  const bufferedEnd = new Date(new Date(end).getTime() + travelBufferMinutes * 60000).toISOString();
  const bufferedStart = new Date(new Date(start).getTime() - travelBufferMinutes * 60000).toISOString();
  const params: any[] = [orgId, staffId, bufferedStart, bufferedEnd];
  let sql = `SELECT 1 FROM homecare_visits
    WHERE organization_id = $1 AND assigned_staff_id = $2 AND status NOT IN ('cancelled', 'missed')
      AND scheduled_start < $4::timestamptz AND scheduled_end > $3::timestamptz`;
  if (excludeVisitId) { sql += ' AND id <> $5'; params.push(excludeVisitId); }
  sql += ' LIMIT 1';
  return (await query(sql, params)).rows.length > 0;
}

async function assertVisit(visitId: string, orgId: string) {
  const result = await query('SELECT * FROM homecare_visits WHERE id = $1 AND organization_id = $2', [visitId, orgId]);
  if (!result.rows[0]) throw new AppError(404, 'Visit not found');
  return result.rows[0];
}

export async function updateVisit(orgId: string, visitId: string, input: HomecareVisitUpdateInput) {
  await assertStaff(input.assigned_staff_id, orgId);
  const existingVisit = await assertVisit(visitId, orgId);
  if (input.assigned_staff_id && input.assigned_staff_id !== existingVisit.assigned_staff_id && await hasVisitConflict(orgId, input.assigned_staff_id, existingVisit.scheduled_start, existingVisit.scheduled_end, visitId)) {
    throw new AppError(409, 'Assigned carer already has an overlapping homecare visit');
  }
  const allowed = ['assigned_staff_id','status','actual_travel_minutes','actual_mileage_miles','mileage_status','late_reason','visit_notes'];
  const entries = Object.entries(input).filter(([key]) => allowed.includes(key));
  if (!entries.length) return (await query(`${VISIT_SELECT} WHERE v.id = $1 AND v.organization_id = $2`, [visitId, orgId])).rows[0];
  const values = entries.map(([, value]) => value);
  const set = entries.map(([key], index) => `${key} = $${index + 1}`).join(', ');
  const exceptionType = input.status === 'missed' ? 'missed' : input.status === 'cancelled' ? 'cancelled' : input.late_reason ? 'late' : null;
  const exceptionParams = values.length + 1;
  const exceptionSql = exceptionType ? `, exception_type = $${exceptionParams}, exception_resolved_at = NULL, exception_resolved_by = NULL, exception_resolution_note = NULL` : '';
  await query(`UPDATE homecare_visits SET ${set}${exceptionSql}, updated_at = NOW() WHERE id = $${values.length + (exceptionType ? 2 : 1)} AND organization_id = $${values.length + (exceptionType ? 3 : 2)}`, exceptionType ? [...values, exceptionType, visitId, orgId] : [...values, visitId, orgId]);
  return (await query(`${VISIT_SELECT} WHERE v.id = $1 AND v.organization_id = $2`, [visitId, orgId])).rows[0];
}

export async function checkIn(orgId: string, staffUserId: string, visitId: string, input: VisitExecutionInput) {
  const visit = await assertVisit(visitId, orgId);
  const staff = await query('SELECT id FROM staff_profiles WHERE user_id = $1', [staffUserId]);
  if (!staff.rows[0] || visit.assigned_staff_id !== staff.rows[0].id) throw new AppError(403, 'This visit is not assigned to you');
  if (['completed','cancelled','missed'].includes(visit.status)) throw new AppError(409, 'This visit is no longer open for check-in');

  // Prevent check-in if already checked in at another visit
  const activeVisit = await query(
    `SELECT id, label FROM homecare_visits WHERE assigned_staff_id = $1 AND status = 'checked_in' AND id <> $2 AND organization_id = $3 LIMIT 1`,
    [visit.assigned_staff_id, visitId, orgId]
  );
  if (activeVisit.rows[0]) {
    throw new AppError(409, `You are already checked in at ${activeVisit.rows[0].label}. Please check out first.`);
  }

  // Date/time validation: only allow check-in within a window around scheduled_start
  // Window: 30 minutes before scheduled_start to scheduled_end
  if (visit.scheduled_start && visit.scheduled_end) {
    const now = new Date();
    const scheduledStart = new Date(visit.scheduled_start);
    const scheduledEnd = new Date(visit.scheduled_end);
    const earliestCheckIn = new Date(scheduledStart.getTime() - 30 * 60 * 1000); // 30 min before
    if (now < earliestCheckIn) {
      const minutesUntil = Math.ceil((scheduledStart.getTime() - now.getTime()) / 60000);
      throw new AppError(400, `This call is scheduled for ${scheduledStart.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. You can check in up to 30 minutes before. ${minutesUntil} minutes remaining.`);
    }
    if (now > scheduledEnd) {
      const minutesOver = Math.ceil((now.getTime() - scheduledEnd.getTime()) / 60000);
      throw new AppError(400, `This call ended at ${scheduledEnd.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. It is ${minutesOver} minutes past the scheduled end time. Please contact your manager.`);
    }
  }
  const result = await query(`UPDATE homecare_visits SET status = 'checked_in', check_in_at = COALESCE(check_in_at, NOW()), check_in_latitude = $1, check_in_longitude = $2, check_in_accuracy_meters = $3, actual_travel_minutes = COALESCE($4, actual_travel_minutes), actual_mileage_miles = COALESCE($5, actual_mileage_miles), updated_at = NOW()
    WHERE id = $6 AND organization_id = $7 RETURNING *`, [input.latitude, input.longitude, input.accuracy_meters ?? null, input.actual_travel_minutes ?? null, input.actual_mileage_miles ?? null, visitId, orgId]);
  return result.rows[0];
}

export async function checkOut(orgId: string, staffUserId: string, visitId: string, input: VisitExecutionInput) {
  const visit = await assertVisit(visitId, orgId);
  const staff = await query('SELECT id FROM staff_profiles WHERE user_id = $1', [staffUserId]);
  if (!staff.rows[0] || visit.assigned_staff_id !== staff.rows[0].id) throw new AppError(403, 'This visit is not assigned to you');
  if (!visit.check_in_at) throw new AppError(409, 'Check in before checking out');
  if (visit.status === 'completed') throw new AppError(409, 'This visit is already complete');
  // Check task completion — block checkout if tasks exist and not all done
  const taskCount = await query('SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE done)::int AS done FROM homecare_visit_tasks WHERE visit_id = $1', [visitId]);
  const { total, done } = taskCount.rows[0];
  if (total > 0 && done < total) throw new AppError(409, `Complete all tasks before checking out (${done}/${total} done)`);
  return transaction(async (client) => {
    const updated = await client.query(`UPDATE homecare_visits SET status = 'completed', check_out_at = NOW(), check_out_latitude = $1, check_out_longitude = $2, visit_notes = COALESCE($3, visit_notes), actual_travel_minutes = COALESCE($4, actual_travel_minutes), actual_mileage_miles = COALESCE($5, actual_mileage_miles), care_plan_id = COALESCE($8, care_plan_id), mileage_status = CASE WHEN COALESCE($5, actual_mileage_miles) > 0 THEN 'submitted' ELSE mileage_status END, updated_at = NOW() WHERE id = $6 AND organization_id = $7 RETURNING *`, [input.latitude, input.longitude, input.note || null, input.actual_travel_minutes ?? null, input.actual_mileage_miles ?? null, visitId, orgId, input.care_plan_id || null]);
    if (!updated.rows[0]) throw new AppError(404, 'Visit not found');
    const v = updated.rows[0];
    const workMinutes = Math.max(0, Math.round((new Date(v.check_out_at).getTime() - new Date(v.check_in_at).getTime()) / 60000));
    const pkg = await client.query('SELECT hourly_rate_pence, travel_time_paid, mileage_rate_pence FROM homecare_packages WHERE id = $1 AND organization_id = $2', [v.package_id, orgId]);
    const policy = pkg.rows[0];
    const travelMinutes = Number(v.actual_travel_minutes || 0);
    const paidTravelMinutes = policy?.travel_time_paid ? travelMinutes : 0;
    const workRate = policy?.hourly_rate_pence == null ? null : Number(policy.hourly_rate_pence);
    // Auto-select mileage rate from organisation policy if package has none
    let mileageRate = policy?.mileage_rate_pence == null ? null : Number(policy.mileage_rate_pence);
    if (mileageRate == null) {
      const rateRow = await client.query(
        `SELECT rate_pence FROM homecare_mileage_policies
         WHERE organization_id = $1 AND is_active = TRUE
         ORDER BY effective_from DESC NULLS LAST, created_at DESC LIMIT 1`, [orgId]);
      mileageRate = rateRow.rows[0] ? Number(rateRow.rows[0].rate_pence) : 45; // HMRC default
    }
    // Apply ride share split if applicable
    const splitPct = v.ride_share_split_pct != null ? Number(v.ride_share_split_pct) : 100;
    const effectiveMileage = Number(v.actual_mileage_miles || 0) * (splitPct / 100);
    const gross = workRate == null ? null : Math.round(((workMinutes + paidTravelMinutes) / 60) * workRate + effectiveMileage * Number(mileageRate || 0));
    await client.query(`INSERT INTO homecare_timesheets (organization_id, visit_id, staff_id, work_minutes, travel_minutes, paid_travel_minutes, mileage_miles, mileage_rate_pence, hourly_rate_pence, gross_pay_pence, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'submitted') ON CONFLICT (visit_id) DO UPDATE SET work_minutes = EXCLUDED.work_minutes, travel_minutes = EXCLUDED.travel_minutes, paid_travel_minutes = EXCLUDED.paid_travel_minutes, mileage_miles = EXCLUDED.mileage_miles, mileage_rate_pence = EXCLUDED.mileage_rate_pence, hourly_rate_pence = EXCLUDED.hourly_rate_pence, gross_pay_pence = EXCLUDED.gross_pay_pence, updated_at = NOW()`, [orgId, visitId, v.assigned_staff_id, workMinutes, travelMinutes, paidTravelMinutes, effectiveMileage, mileageRate, workRate, gross]);
    return v;
  });
}

export async function generateVisitsFromPlan(orgId: string, userId: string, planId: string, from: string, to: string) {
  const startDate = new Date(`${from}T00:00:00.000Z`);
  const endDate = new Date(`${to}T00:00:00.000Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
    throw new AppError(400, 'Generation date range is invalid');
  }
  const days = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  if (days > 31) throw new AppError(400, 'Generate no more than 31 days at a time');

  return transaction(async (client) => {
    const planResult = await client.query(`SELECT vp.*, p.person_id, p.organization_id, p.status AS package_status, p.start_date, p.end_date,
        p.travel_time_paid, p.mileage_rate_pence
      FROM homecare_visit_plans vp JOIN homecare_packages p ON p.id = vp.package_id
      WHERE vp.id = $1 AND vp.organization_id = $2 AND p.organization_id = $2 AND vp.active = TRUE`, [planId, orgId]);
    const plan = planResult.rows[0];
    if (!plan) throw new AppError(404, 'Active visit plan not found');
    if (!['active', 'draft'].includes(plan.package_status)) throw new AppError(409, 'Visits cannot be generated for this package');

    const staffId = plan.default_staff_id || null;
    if (staffId) {
      const staffResult = await client.query(`SELECT sp.id FROM staff_profiles sp JOIN users u ON u.id = sp.user_id
        WHERE sp.id = $1 AND u.organization_id = $2 AND u.status = 'active'`, [staffId, orgId]);
      if (!staffResult.rows[0]) throw new AppError(409, 'The visit plan default carer is no longer active');
    }

    const generated: string[] = [];
    let skipped = 0;
    for (let offset = 0; offset < days; offset += 1) {
      const date = new Date(startDate.getTime() + offset * 86400000);
      const dateText = date.toISOString().slice(0, 10);
      const packageStart = plan.start_date instanceof Date ? plan.start_date.toISOString().slice(0, 10) : String(plan.start_date).slice(0, 10);
      const packageEnd = plan.end_date ? (plan.end_date instanceof Date ? plan.end_date.toISOString().slice(0, 10) : String(plan.end_date).slice(0, 10)) : null;
      if (dateText < packageStart || (packageEnd && dateText > packageEnd)) continue;
      if (!plan.days_of_week.map(Number).includes(date.getUTCDay())) continue;

      const time = String(plan.start_time).slice(0, 8);
      const scheduledStart = `${dateText}T${time}Z`;
      const scheduledEnd = new Date(new Date(scheduledStart).getTime() + Number(plan.duration_minutes) * 60000).toISOString();
      const existing = await client.query('SELECT id FROM homecare_visits WHERE visit_plan_id = $1 AND scheduled_start = $2', [plan.id, scheduledStart]);
      if (existing.rows[0]) { skipped += 1; continue; }
      if (staffId) {
        const availability = await client.query(`SELECT 1 FROM staff_availability
          WHERE staff_id = $1 AND day_of_week = $2 AND is_available = TRUE
            AND ((start_time <= $3::time AND end_time >= $4::time)
              OR (end_time < start_time AND (start_time <= $3::time OR end_time >= $4::time))) LIMIT 1`,
          [staffId, date.getUTCDay(), time, scheduledEnd.slice(11, 19)]);
        if (!availability.rows[0]) throw new AppError(409, `Carer is not available for ${dateText} ${time}`);
        if (await hasVisitConflict(orgId, staffId, scheduledStart, scheduledEnd, undefined, plan.travel_buffer_minutes ?? 30)) {
          throw new AppError(409, `Carer has an overlapping visit or insufficient travel time on ${dateText} ${time}`);
        }
      }
      const result = await client.query(`INSERT INTO homecare_visits (organization_id, package_id, visit_plan_id, person_id, assigned_staff_id, visit_type, label, scheduled_start, scheduled_end, created_by, hourly_rate_pence, mileage_rate_pence)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT DO NOTHING RETURNING id`, 
        [orgId, plan.package_id, plan.id, plan.person_id, staffId, plan.visit_type, plan.label, scheduledStart, scheduledEnd, userId, plan.hourly_rate_pence ?? null, plan.mileage_rate_pence ?? null]);
      if (result.rows[0]) {
        const visitId = result.rows[0].id;
        generated.push(visitId);
        // Copy default_tasks from plan to visit_tasks
        const defaultTasks = plan.default_tasks;
        if (Array.isArray(defaultTasks) && defaultTasks.length > 0) {
          for (let ti = 0; ti < defaultTasks.length; ti++) {
            const task = defaultTasks[ti];
            if (task.label && task.label.trim()) {
              await client.query(
                'INSERT INTO homecare_visit_tasks (visit_id, label, sort_order) VALUES ($1, $2, $3)',
                [visitId, task.label.trim(), task.sort_order ?? ti]
              );
            }
          }
        }
      } else skipped += 1;
    }
    return { generated, generated_count: generated.length, skipped_existing: skipped };
  });
}

export async function resolveVisitException(orgId: string, visitId: string, userId: string, input: HomecareExceptionInput) {
  const result = await query(`UPDATE homecare_visits SET exception_type = $1, exception_resolved_at = NOW(), exception_resolved_by = $2,
      exception_resolution_note = $3, updated_at = NOW()
    WHERE id = $4 AND organization_id = $5 AND (status IN ('missed', 'cancelled') OR exception_type IS NOT NULL)
    RETURNING *`, [input.exception_type, userId, input.resolution_note || null, visitId, orgId]);
  if (!result.rows[0]) throw new AppError(404, 'Open visit exception not found');
  return result.rows[0];
}

export async function listOpenExceptions(orgId: string) {
  return (await query(`${VISIT_SELECT} WHERE v.organization_id = $1 AND (v.status IN ('missed', 'cancelled') OR v.exception_type IS NOT NULL) AND v.exception_resolved_at IS NULL ORDER BY v.scheduled_start`, [orgId])).rows;
}

export async function getApprovedPayrollRows(orgId: string, filters: PayrollExportFilters) {
  const result = await query(`SELECT t.id AS timesheet_id, t.staff_id, sp.first_name || ' ' || sp.last_name AS staff_name,
      pe.first_name || ' ' || pe.last_name AS client_name, v.label AS visit_label, v.scheduled_start, v.scheduled_end,
      t.work_minutes, t.travel_minutes, t.paid_travel_minutes, t.mileage_miles,
      t.mileage_rate_pence, t.hourly_rate_pence, t.gross_pay_pence
    FROM homecare_timesheets t JOIN staff_profiles sp ON sp.id = t.staff_id
    JOIN homecare_visits v ON v.id = t.visit_id JOIN people pe ON pe.id = v.person_id
    WHERE t.organization_id = $1 AND t.status = 'approved' AND v.scheduled_start >= $2::date
      AND v.scheduled_start < ($3::date + INTERVAL '1 day') ORDER BY v.scheduled_start, staff_name`,
    [orgId, filters.from, filters.to]);
  return result.rows;
}

export async function listTimesheets(orgId: string, status?: string) {
  const conditions = ['t.organization_id = $1'];
  const params: any[] = [orgId];
  if (status) { conditions.push('t.status = $2'); params.push(status); }
  return (await query(`SELECT t.*, sp.first_name || ' ' || sp.last_name AS staff_name, v.label, v.scheduled_start, pe.first_name || ' ' || pe.last_name AS person_name FROM homecare_timesheets t JOIN staff_profiles sp ON sp.id = t.staff_id JOIN homecare_visits v ON v.id = t.visit_id JOIN people pe ON pe.id = v.person_id WHERE ${conditions.join(' AND ')} ORDER BY t.created_at DESC`, params)).rows;
}

export async function listCarePlans(orgId: string, personId: string) {
  const result = await query(
    `SELECT cp.id, cp.title, cp.category, cp.status, cp.review_date
     FROM care_plans cp
     JOIN people p ON p.id = cp.person_id
     WHERE cp.person_id = $1 AND p.organization_id = $2 AND cp.status = 'active'
     ORDER BY cp.title`,
    [personId, orgId]
  );
  return result.rows;
}

export async function getMonthlyCarerTotals(orgId: string, from: string, to: string) {
  const result = await query(`
    SELECT sp.id AS staff_id, sp.first_name || ' ' || sp.last_name AS staff_name,
      COUNT(t.id) AS visit_count,
      SUM(t.work_minutes) AS total_work_minutes,
      SUM(t.travel_minutes) AS total_travel_minutes,
      SUM(t.paid_travel_minutes) AS total_paid_travel_minutes,
      SUM(t.mileage_miles) AS total_mileage_miles,
      SUM(t.gross_pay_pence) AS total_gross_pay_pence,
      SUM(CASE WHEN t.status = 'approved' THEN t.gross_pay_pence ELSE 0 END) AS approved_gross_pence,
      SUM(CASE WHEN t.status = 'submitted' THEN 1 ELSE 0 END) AS pending_count,
      SUM(CASE WHEN t.status = 'approved' THEN 1 ELSE 0 END) AS approved_count,
      SUM(CASE WHEN t.status = 'rejected' THEN 1 ELSE 0 END) AS rejected_count,
      SUM(CASE WHEN v.status = 'missed' OR v.status = 'cancelled' THEN 1 ELSE 0 END) AS exception_count
    FROM homecare_timesheets t
    JOIN staff_profiles sp ON sp.id = t.staff_id
    JOIN users u ON u.id = sp.user_id
    JOIN homecare_visits v ON v.id = t.visit_id
    WHERE t.organization_id = $1 AND v.scheduled_start >= $2::date
      AND v.scheduled_start < ($3::date + INTERVAL '1 day')
    GROUP BY sp.id, sp.first_name, sp.last_name
    ORDER BY sp.first_name, sp.last_name`, [orgId, from, to]);
  return result.rows;
}

/**
 * Staff profile for a user, restricted to the caller's organisation so a user
 * can never resolve a profile belonging to another tenant.
 */
export async function getStaffProfileIdForUser(orgId: string, userId: string): Promise<string | null> {
  const result = await query(
    `SELECT sp.id
     FROM staff_profiles sp
     JOIN users u ON u.id = sp.user_id
     WHERE sp.user_id = $1 AND u.organization_id = $2`,
    [userId, orgId]
  );
  return result.rows[0]?.id || null;
}

/**
 * Completed visits with their timesheet figures for one carer and period.
 * `to` is inclusive of the whole end day, so a call on the final day of a pay
 * period is never dropped from the total.
 */
export async function getStaffPeriodEarnings(orgId: string, staffId: string, from: string, to: string) {
  const result = await query(
    `SELECT hv.id, hv.label, hv.visit_type, hv.scheduled_start, hv.scheduled_end,
            hv.status, hv.check_in_at, hv.check_out_at,
            hv.actual_travel_minutes, hv.actual_mileage_miles, hv.mileage_status,
            pe.first_name || ' ' || pe.last_name AS person_name,
            t.work_minutes, t.travel_minutes, t.paid_travel_minutes,
            t.mileage_miles, t.mileage_rate_pence, t.hourly_rate_pence, t.gross_pay_pence,
            t.status AS timesheet_status,
            (SELECT COUNT(*)::int FROM homecare_visit_tasks WHERE visit_id = hv.id) AS tasks_total,
            (SELECT COUNT(*)::int FROM homecare_visit_tasks WHERE visit_id = hv.id AND done) AS tasks_completed
     FROM homecare_visits hv
     JOIN people pe ON pe.id = hv.person_id
     LEFT JOIN homecare_timesheets t ON t.visit_id = hv.id
     WHERE hv.organization_id = $1 AND hv.assigned_staff_id = $2
       AND hv.scheduled_start >= $3::date
       AND hv.scheduled_start < ($4::date + INTERVAL '1 day')
       AND hv.status IN ('completed', 'checked_in')
     ORDER BY hv.scheduled_start`,
    [orgId, staffId, from, to]
  );
  return result.rows;
}

/**
 * Per-month earnings totals for one carer, used to build the year-to-date
 * summary on a payslip. Month buckets come from the same timesheet rows the
 * payslip itself is calculated from.
 */
export async function getStaffYearToDateMonths(orgId: string, staffId: string, yearStart: string, throughDate: string) {
  const result = await query(
    `SELECT to_char(date_trunc('month', v.scheduled_start), 'YYYY-MM') AS month,
            COUNT(t.id)::int AS visit_count,
            COALESCE(SUM(t.work_minutes), 0)::int AS work_minutes,
            COALESCE(SUM(t.mileage_miles), 0)::numeric AS mileage_miles,
            COALESCE(SUM(t.gross_pay_pence), 0)::int AS gross_pay_pence
     FROM homecare_timesheets t
     JOIN homecare_visits v ON v.id = t.visit_id
     WHERE t.organization_id = $1 AND t.staff_id = $2
       AND v.scheduled_start >= $3::date
       AND v.scheduled_start < ($4::date + INTERVAL '1 day')
       AND v.status IN ('completed', 'checked_in')
     GROUP BY 1
     ORDER BY 1`,
    [orgId, staffId, yearStart, throughDate]
  );
  return result.rows as { month: string; visit_count: number; work_minutes: number; mileage_miles: string | number; gross_pay_pence: number }[];
}

/** Carer identity plus organisation name for a payslip, scoped to the tenant. */
export async function getPayslipStaffContext(orgId: string, staffId: string) {
  const result = await query(
    `SELECT sp.id, sp.first_name, sp.last_name, u.email, o.name AS org_name
     FROM staff_profiles sp
     JOIN users u ON u.id = sp.user_id
     JOIN organizations o ON o.id = u.organization_id
     WHERE sp.id = $1 AND u.organization_id = $2`,
    [staffId, orgId]
  );
  return result.rows[0] || null;
}

/**
 * Every carer with timesheet rows in a period, across all organisations. Used
 * by the end-of-period payslip run; each row is scoped back to its own org when
 * the payslip is built.
 */
export async function listCarersWithEarningsForPeriod(from: string, to: string) {
  const result = await query(
    `SELECT DISTINCT t.organization_id AS org_id, t.staff_id, u.email
     FROM homecare_timesheets t
     JOIN homecare_visits v ON v.id = t.visit_id
     JOIN staff_profiles sp ON sp.id = t.staff_id
     JOIN users u ON u.id = sp.user_id
     WHERE v.scheduled_start >= $1::date
       AND v.scheduled_start < ($2::date + INTERVAL '1 day')
       AND v.status IN ('completed', 'checked_in')
       AND u.email IS NOT NULL
       AND u.status = 'active'
     ORDER BY t.organization_id, t.staff_id`,
    [from, to]
  );
  return result.rows as { org_id: string; staff_id: string; email: string }[];
}

export async function listAvailableStaff(orgId: string, start: string, end: string, excludeVisitId?: string) {
  const params: any[] = [orgId, start, end];
  const exclude = excludeVisitId ? ' AND v.id <> $4' : '';
  if (excludeVisitId) params.push(excludeVisitId);
  return (await query(`
    SELECT sp.id, sp.first_name, sp.last_name, u.email,
      CASE WHEN EXISTS (
        SELECT 1 FROM staff_availability sa
        WHERE sa.staff_id = sp.id AND sa.is_available = TRUE
          AND sa.day_of_week = EXTRACT(DOW FROM $2::timestamptz)::int
          AND sa.start_time <= $2::timestamptz::time AND sa.end_time >= $3::timestamptz::time
      ) AND NOT EXISTS (
        SELECT 1 FROM homecare_visits conflict
        WHERE conflict.assigned_staff_id = sp.id AND conflict.organization_id = $1
          AND conflict.status NOT IN ('cancelled', 'missed')
          AND conflict.scheduled_start < $3::timestamptz + INTERVAL '30 minutes'
          AND conflict.scheduled_end > $2::timestamptz - INTERVAL '30 minutes'
          ${excludeVisitId ? 'AND conflict.id <> $4' : ''}
      ) AND NOT EXISTS (
        SELECT 1 FROM leave_requests lr
        WHERE lr.staff_id = sp.id AND lr.organization_id = $1
          AND lr.status IN ('approved', 'pending')
          AND lr.start_date <= $3::date AND lr.end_date >= $2::date
      ) THEN TRUE ELSE FALSE END AS available_in_window,
      EXISTS (
        SELECT 1 FROM leave_requests lr2
        WHERE lr2.staff_id = sp.id AND lr2.organization_id = $1
          AND lr2.status IN ('approved', 'pending')
          AND lr2.start_date <= $3::date AND lr2.end_date >= $2::date
      ) AS on_leave,
      COALESCE(SUM(EXTRACT(EPOCH FROM (v.scheduled_end - v.scheduled_start)) / 60), 0)::int AS assigned_minutes
    FROM staff_profiles sp
    JOIN users u ON u.id = sp.user_id AND u.organization_id = $1 AND u.status = 'active' AND u.role = 'CARE_WORKER'
    LEFT JOIN homecare_visits v ON v.assigned_staff_id = sp.id AND v.organization_id = $1
      AND v.status NOT IN ('cancelled', 'missed')
      AND v.scheduled_start < $3::timestamptz + INTERVAL '30 minutes'
      AND v.scheduled_end > $2::timestamptz - INTERVAL '30 minutes'${exclude}
    GROUP BY sp.id, sp.first_name, sp.last_name, u.email
    ORDER BY available_in_window DESC, assigned_minutes ASC, sp.first_name, sp.last_name`, params)).rows;
}

export async function listAvailability(orgId: string, staffId?: string) {
  const params: any[] = [orgId];
  const filter = staffId ? ' AND sa.staff_id = $2' : '';
  if (staffId) params.push(staffId);
  return (await query(`SELECT sa.*, sp.first_name || ' ' || sp.last_name AS staff_name
    FROM staff_availability sa JOIN staff_profiles sp ON sp.id = sa.staff_id JOIN users u ON u.id = sp.user_id
    WHERE u.organization_id = $1${filter} ORDER BY sa.staff_id, sa.availability_date NULLS FIRST, sa.day_of_week, sa.start_time`, params)).rows;
}

export async function upsertAvailability(orgId: string, input: import('./homecare.types').HomecareAvailabilityInput) {
  await assertStaff(input.staff_id, orgId);
  if (input.day_of_week < 0 || input.day_of_week > 6 || input.start_time >= input.end_time) throw new AppError(400, 'Availability day or time range is invalid');
  if (input.availability_date) {
    const selected = new Date(`${input.availability_date}T00:00:00`);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const maximum = new Date(today); maximum.setMonth(maximum.getMonth() + 4);
    if (Number.isNaN(selected.getTime()) || selected < today || selected > maximum) {
      throw new AppError(400, 'Dated availability must be from today up to four months ahead');
    }
  }
  // Dated entries override a single calendar date; undated entries remain recurring weekly slots.
  const existing = await query(
    `SELECT id FROM staff_availability
     WHERE staff_id = $1 AND day_of_week = $2
       AND availability_date IS NOT DISTINCT FROM $3::date`,
    [input.staff_id, input.day_of_week, input.availability_date || null]
  );
  if (existing.rows.length > 0) {
    const result = await query(
      `UPDATE staff_availability SET start_time = $3, end_time = $4, is_available = $5, availability_date = $6, updated_at = NOW()
       WHERE id = $1 AND staff_id = $2 RETURNING *`,
      [existing.rows[0].id, input.staff_id, input.start_time, input.end_time, input.is_available ?? true, input.availability_date || null]
    );
    return result.rows[0];
  }
  const result = await query(`INSERT INTO staff_availability (staff_id, day_of_week, start_time, end_time, is_available, availability_date)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [input.staff_id, input.day_of_week, input.start_time, input.end_time, input.is_available ?? true, input.availability_date || null]);
  return result.rows[0];
}

export async function deleteAvailability(orgId: string, availabilityId: string) {
  const result = await query(`DELETE FROM staff_availability sa USING staff_profiles sp, users u
    WHERE sa.id = $1 AND sp.id = sa.staff_id AND u.id = sp.user_id AND u.organization_id = $2 RETURNING sa.id`, [availabilityId, orgId]);
  if (!result.rows[0]) throw new AppError(404, 'Availability record not found');
  return result.rows[0];
}

export async function createDisruption(orgId: string, userId: string, visitId: string, input: import('./homecare.types').HomecareDisruptionInput) {
  await assertVisit(visitId, orgId);
  const result = await query(`INSERT INTO homecare_visit_disruptions
    (organization_id, visit_id, reported_by, disruption_type, severity, delay_minutes, description, expected_arrival)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [orgId, visitId, userId, input.disruption_type, input.severity || 'medium', input.delay_minutes || 0, input.description, input.expected_arrival || null]);
  await query(`UPDATE homecare_visits SET status = CASE WHEN status = 'scheduled' THEN 'en_route' ELSE status END,
    late_reason = COALESCE(late_reason, $1), updated_at = NOW() WHERE id = $2 AND organization_id = $3`, [input.description, visitId, orgId]);
  return result.rows[0];
}

export async function listDisruptions(orgId: string, openOnly = false) {
  return (await query(`SELECT d.*, v.label, v.scheduled_start, pe.first_name || ' ' || pe.last_name AS person_name,
      sp.first_name || ' ' || sp.last_name AS reported_by_name
    FROM homecare_visit_disruptions d JOIN homecare_visits v ON v.id = d.visit_id JOIN people pe ON pe.id = v.person_id
    JOIN users u ON u.id = d.reported_by LEFT JOIN staff_profiles sp ON sp.user_id = u.id
    WHERE d.organization_id = $1${openOnly ? " AND d.status = 'open'" : ''} ORDER BY d.created_at DESC`, [orgId])).rows;
}

export async function resolveDisruption(orgId: string, userId: string, disruptionId: string) {
  const result = await query(`UPDATE homecare_visit_disruptions SET status = 'resolved', resolved_by = $1, resolved_at = NOW(), updated_at = NOW()
    WHERE id = $2 AND organization_id = $3 AND status = 'open' RETURNING *`, [userId, disruptionId, orgId]);
  if (!result.rows[0]) throw new AppError(404, 'Open disruption not found');
  return result.rows[0];
}

export async function listMileagePolicies(orgId: string) {
  return (await query('SELECT * FROM homecare_mileage_policies WHERE organization_id = $1 ORDER BY tax_year DESC, vehicle_type, fuel_category', [orgId])).rows;
}

export async function createMileagePolicy(orgId: string, userId: string, input: import('./homecare.types').HomecareMileagePolicyInput) {
  const result = await query(`INSERT INTO homecare_mileage_policies
    (organization_id, tax_year, vehicle_type, fuel_category, rate_pence, effective_from, effective_to, source_label, is_active, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (organization_id, tax_year, vehicle_type, fuel_category) DO UPDATE SET rate_pence = EXCLUDED.rate_pence,
      effective_from = EXCLUDED.effective_from, effective_to = EXCLUDED.effective_to, source_label = EXCLUDED.source_label,
      is_active = EXCLUDED.is_active, updated_at = NOW() RETURNING *`,
    [orgId, input.tax_year, input.vehicle_type, input.fuel_category, input.rate_pence, input.effective_from || null, input.effective_to || null, input.source_label || null, input.is_active ?? true, userId]);
  return result.rows[0];
}

export async function updateMileagePolicy(orgId: string, policyId: string, input: Partial<import('./homecare.types').HomecareMileagePolicyInput>) {
  const fields: string[] = []
  const values: any[] = [orgId, policyId]
  let idx = 3
  for (const [key, val] of Object.entries(input)) {
    if (val !== undefined) {
      fields.push(`${key} = $${idx}`)
      values.push(val)
      idx++
    }
  }
  if (fields.length === 0) throw new AppError(400, 'No fields to update')
  fields.push('updated_at = NOW()')
  const result = await query(`UPDATE homecare_mileage_policies SET ${fields.join(', ')} WHERE organization_id = $1 AND id = $2 RETURNING *`, values)
  if (!result.rows[0]) throw new AppError(404, 'Mileage policy not found')
  return result.rows[0]
}

export async function deleteMileagePolicy(orgId: string, policyId: string) {
  const result = await query(`DELETE FROM homecare_mileage_policies WHERE organization_id = $1 AND id = $2 RETURNING id`, [orgId, policyId])
  if (!result.rows[0]) throw new AppError(404, 'Mileage policy not found')
}

export async function createFollowup(orgId: string, userId: string, visitId: string, input: import('./homecare.types').HomecareFollowupInput) {
  await assertVisit(visitId, orgId);
  if (input.incident_id) {
    const incident = await query('SELECT id FROM incidents WHERE id = $1 AND organization_id = $2', [input.incident_id, orgId]);
    if (!incident.rows[0]) throw new AppError(400, 'Incident is not in this organisation');
  }
  const result = await query(`INSERT INTO homecare_visit_followups
    (organization_id, visit_id, created_by, followup_type, channel, recipient, outcome, notes, incident_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [orgId, visitId, userId, input.followup_type, input.channel || null, input.recipient || null, input.outcome || 'recorded', input.notes, input.incident_id || null]);
  return result.rows[0];
}

export async function listFollowups(orgId: string, visitId?: string) {
  const params: any[] = [orgId];
  const filter = visitId ? ' AND f.visit_id = $2' : '';
  if (visitId) params.push(visitId);
  return (await query(`SELECT f.*, v.label, sp.first_name || ' ' || sp.last_name AS created_by_name
    FROM homecare_visit_followups f JOIN homecare_visits v ON v.id = f.visit_id
    LEFT JOIN staff_profiles sp ON sp.user_id = f.created_by WHERE f.organization_id = $1${filter} ORDER BY f.created_at DESC`, params)).rows;
}

export async function recordOfflineAction(orgId: string, userId: string, visitId: string, input: VisitExecutionInput, actionType: 'check-in' | 'check-out') {
  const actionKey = input.action_key;
  if (!actionKey) throw new AppError(400, 'Offline action key is required');
  const existing = await query('SELECT status, error_message FROM homecare_offline_actions WHERE organization_id = $1 AND action_key = $2', [orgId, actionKey]);
  if (existing.rows[0]) {
    if (existing.rows[0].status === 'failed') throw new AppError(409, existing.rows[0].error_message || 'Offline action previously failed');
    return { replayed: true, status: existing.rows[0].status };
  }
  await assertVisit(visitId, orgId);
  try {
    const result = actionType === 'check-in'
      ? await checkIn(orgId, userId, visitId, input)
      : await checkOut(orgId, userId, visitId, input);
    await query(`INSERT INTO homecare_offline_actions (organization_id, visit_id, user_id, action_key, action_type, payload, status, processed_at)
      VALUES ($1,$2,$3,$4,$5,$6,'processed',NOW())`, [orgId, visitId, userId, actionKey, actionType, JSON.stringify(input)]);
    return { replayed: false, status: 'processed', visit: result };
  } catch (error: any) {
    await query(`INSERT INTO homecare_offline_actions (organization_id, visit_id, user_id, action_key, action_type, payload, status, error_message)
      VALUES ($1,$2,$3,$4,$5,$6,'failed',$7) ON CONFLICT (organization_id, action_key) DO NOTHING`, [orgId, visitId, userId, actionKey, actionType, JSON.stringify(input), String(error?.message || 'Offline action failed').slice(0, 1000)]);
    throw error;
  }
}

export async function createPayrollExport(orgId: string, userId: string, filters: PayrollExportFilters, rows: any[], fileChecksum?: string) {
  // Prevent duplicate exports for the same period and provider
  const dupCheck = await query(
    `SELECT id FROM homecare_payroll_exports
     WHERE organization_id = $1 AND provider = $2 AND period_from = $3 AND period_to = $4
     LIMIT 1`, [orgId, filters.provider || 'generic_csv', filters.from, filters.to]);
  if (dupCheck.rows[0]) {
    throw new AppError(409, 'A payroll export already exists for this period and provider');
  }
  const result = await query(`INSERT INTO homecare_payroll_exports (organization_id, provider, period_from, period_to, row_count, file_checksum, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [orgId, filters.provider || 'generic_csv', filters.from, filters.to, rows.length, fileChecksum || null, userId]);
  for (const row of rows) await query(`INSERT INTO homecare_payroll_reconciliations (organization_id, export_id, timesheet_id, exported_gross_pay_pence)
    VALUES ($1,$2,$3,$4) ON CONFLICT (export_id, timesheet_id) DO NOTHING`, [orgId, result.rows[0].id, row.timesheet_id, row.gross_pay_pence]);
  return result.rows[0];
}

export async function listPayrollReconciliations(orgId: string, exportId?: string) {
  const params: any[] = [orgId];
  const filter = exportId ? ' AND r.export_id = $2' : '';
  if (exportId) params.push(exportId);
  return (await query(`SELECT r.*, e.provider, e.period_from, e.period_to, sp.first_name || ' ' || sp.last_name AS staff_name
    FROM homecare_payroll_reconciliations r JOIN homecare_payroll_exports e ON e.id = r.export_id
    JOIN homecare_timesheets t ON t.id = r.timesheet_id JOIN staff_profiles sp ON sp.id = t.staff_id
    WHERE r.organization_id = $1${filter} ORDER BY r.created_at DESC`, params)).rows;
}

export async function reconcilePayroll(orgId: string, userId: string, reconciliationId: string, input: import('./homecare.types').HomecareReconciliationInput) {
  const result = await query(`UPDATE homecare_payroll_reconciliations SET status = $1, external_reference = $2,
    reconciled_gross_pay_pence = $3, note = $4, reconciled_by = $5, reconciled_at = NOW()
    WHERE id = $6 AND organization_id = $7 RETURNING *`, [input.status, input.external_reference || null, input.reconciled_gross_pay_pence ?? null, input.note || null, userId, reconciliationId, orgId]);
  if (!result.rows[0]) throw new AppError(404, 'Payroll reconciliation row not found');
  await query(`UPDATE homecare_payroll_exports SET status = CASE WHEN NOT EXISTS (SELECT 1 FROM homecare_payroll_reconciliations WHERE export_id = $1 AND status IN ('pending','exception')) THEN 'reconciled' ELSE status END WHERE id = (SELECT export_id FROM homecare_payroll_reconciliations WHERE id = $2)`, [result.rows[0].export_id, reconciliationId]);
  return result.rows[0];
}

export async function getCarerTimesheetDetail(orgId: string, staffId: string, from: string, to: string) {
  const result = await query(`
    SELECT hv.id, hv.label, hv.visit_type, hv.scheduled_start, hv.scheduled_end,
      hv.status, hv.check_in_at, hv.check_out_at,
      hv.check_in_latitude, hv.check_in_longitude, hv.check_in_accuracy_meters,
      hv.check_out_latitude, hv.check_out_longitude,
      hv.actual_travel_minutes, hv.actual_mileage_miles,
      hv.visit_notes, hv.progress_notes, hv.care_plan_notes,
      hv.client_mood, hv.wellbeing_notes, hv.personal_care, hv.fluid_intake_ml,
      hv.exception_type, hv.late_reason,
      pe.first_name || ' ' || pe.last_name AS person_name,
      l.address AS person_address,
      t.id AS timesheet_id, t.work_minutes, t.travel_minutes, t.paid_travel_minutes,
      t.mileage_miles, t.mileage_rate_pence, t.hourly_rate_pence, t.gross_pay_pence,
      t.status AS timesheet_status, t.submitted_at, t.approved_at, t.rejection_reason,
      (SELECT COUNT(*)::int FROM homecare_visit_tasks WHERE visit_id = hv.id) AS tasks_total,
      (SELECT COUNT(*)::int FROM homecare_visit_tasks WHERE visit_id = hv.id AND done) AS tasks_completed,
      (SELECT COALESCE(SUM(hv2.actual_travel_minutes), 0)::int
       FROM homecare_visits hv2 WHERE hv2.organization_id = $1
         AND hv2.assigned_staff_id = $2 AND hv2.status = 'completed'
         AND hv2.scheduled_start >= $3::date AND hv2.scheduled_start < ($4::date + INTERVAL '1 day')
         AND hv2.actual_travel_minutes IS NOT NULL) AS total_travel_minutes,
      (SELECT COALESCE(SUM(t2.work_minutes), 0)::int
       FROM homecare_timesheets t2
       JOIN homecare_visits hv3 ON hv3.id = t2.visit_id
       WHERE t2.organization_id = $1 AND hv3.assigned_staff_id = $2
         AND hv3.scheduled_start >= $3::date AND hv3.scheduled_start < ($4::date + INTERVAL '1 day')
         AND t2.status = 'approved') AS total_approved_work_minutes
    FROM homecare_visits hv
    JOIN staff_profiles sp ON sp.id = hv.assigned_staff_id
    JOIN people pe ON pe.id = hv.person_id
    LEFT JOIN locations l ON l.id = pe.location_id
    LEFT JOIN homecare_timesheets t ON t.visit_id = hv.id AND t.organization_id = hv.organization_id
    WHERE hv.organization_id = $1 AND hv.assigned_staff_id = $2
      AND hv.scheduled_start >= $3::date AND hv.scheduled_start < ($4::date + INTERVAL '1 day')
    ORDER BY hv.scheduled_start`, [orgId, staffId, from, to]);
  return result.rows;
}

export async function getPendingTimesheets(orgId: string, from: string, to: string) {
  const result = await query(`
    SELECT t.id AS timesheet_id, t.work_minutes, t.travel_minutes, t.paid_travel_minutes,
      t.mileage_miles, t.gross_pay_pence, t.status AS timesheet_status, t.submitted_at,
      sp.first_name || ' ' || sp.last_name AS staff_name, sp.id AS staff_id,
      hv.label AS visit_label, hv.visit_type, hv.scheduled_start, hv.scheduled_end,
      hv.visit_notes, hv.progress_notes, hv.check_in_at AS actual_check_in, hv.check_out_at AS actual_check_out,
      pe.first_name || ' ' || pe.last_name AS person_name,
      (SELECT COUNT(*) FROM homecare_visit_tasks vt WHERE vt.visit_id = hv.id) AS tasks_total,
      (SELECT COUNT(*) FROM homecare_visit_tasks vt WHERE vt.visit_id = hv.id AND vt.completed = true) AS tasks_completed
    FROM homecare_timesheets t
    JOIN staff_profiles sp ON sp.id = t.staff_id
    JOIN homecare_visits hv ON hv.id = t.visit_id
    JOIN people pe ON pe.id = hv.person_id
    WHERE t.organization_id = $1 AND t.status = 'submitted'
      AND hv.scheduled_start >= $2::date AND hv.scheduled_start < ($3::date + INTERVAL '1 day')
    ORDER BY hv.scheduled_start`, [orgId, from, to]);
  return result.rows;
}

export async function updateTimesheet(orgId: string, timesheetId: string, userId: string, input: HomecareTimesheetUpdateInput) {
  const current = await query('SELECT * FROM homecare_timesheets WHERE id = $1 AND organization_id = $2', [timesheetId, orgId]);
  if (!current.rows[0]) throw new AppError(404, 'Timesheet not found');
  if (input.status === 'approved') {
    if (current.rows[0].status !== 'submitted') throw new AppError(409, 'Only submitted timesheets can be approved');
    return transaction(async (client) => {
      const result = await client.query(`UPDATE homecare_timesheets SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW() WHERE id = $2 AND organization_id = $3 RETURNING *`, [userId, timesheetId, orgId]);
      return result.rows[0];
    });
  }
  const allowed = ['work_minutes','travel_minutes','paid_travel_minutes','mileage_miles','mileage_rate_pence','hourly_rate_pence','gross_pay_pence','status','rejection_reason'];
  const entries = Object.entries(input).filter(([key]) => allowed.includes(key));
  if (!entries.length) return current.rows[0];
  const values = entries.map(([, value]) => value);
  const set = entries.map(([key], index) => `${key} = $${index + 1}`).join(', ');
  const statusParam = values.length + 1;
  const idParam = values.length + 2;
  const orgParam = values.length + 3;
  const result = await query(`UPDATE homecare_timesheets SET ${set}, submitted_at = CASE WHEN $${statusParam} = 'submitted' THEN COALESCE(submitted_at, NOW()) ELSE submitted_at END, updated_at = NOW() WHERE id = $${idParam} AND organization_id = $${orgParam} RETURNING *`, [...values, input.status || current.rows[0].status, timesheetId, orgId]);
  return result.rows[0];
}

/**
 * AI-powered carer suggestion for a visit.
 * Scores each active carer on: availability fit, no leave conflict, no time clash,
 * proximity to client, current workload. Returns ranked suggestions.
 */
export async function suggestCarersForVisit(orgId: string, visitId: string) {
  // Get the visit details
  const visitResult = await query(`
    SELECT hv.*, p.latitude, p.longitude
    FROM homecare_visits hv
    JOIN people p ON p.id = hv.person_id AND p.organization_id = $1
    WHERE hv.id = $2 AND hv.organization_id = $1`, [orgId, visitId]);
  if (!visitResult.rows[0]) throw new AppError(404, 'Visit not found');
  const visit = visitResult.rows[0];

  const dayOfWeek = new Date(visit.scheduled_start).getUTCDay();
  const startTime = new Date(visit.scheduled_start).toISOString();
  const endTime = new Date(visit.scheduled_end).toISOString();

  // Get all active carers with their data
  const result = await query(`
    WITH visit_window AS (
      SELECT $2::timestamptz AS ws, $3::timestamptz AS we, $4::int AS dow
    ),
    staff_base AS (
      SELECT sp.id, sp.first_name, sp.last_name, u.email
      FROM staff_profiles sp
      JOIN users u ON u.id = sp.user_id AND u.organization_id = $1 AND u.status = 'active' AND u.role = 'CARE_WORKER'
    ),
    avail_check AS (
      SELECT sb.id,
        EXISTS (
          SELECT 1 FROM staff_availability sa
          WHERE sa.staff_id = sb.id AND sa.is_available = TRUE
            AND sa.day_of_week = vw.dow
            AND sa.start_time <= vw.ws::time AND sa.end_time >= vw.we::time
        ) AS has_availability
      FROM staff_base sb, visit_window vw
    ),
    leave_check AS (
      SELECT sb.id,
        EXISTS (
          SELECT 1 FROM leave_requests lr
          WHERE lr.staff_id = sb.id AND lr.organization_id = $1
            AND lr.status IN ('approved', 'pending')
            AND lr.start_date <= vw.we::date AND lr.end_date >= vw.ws::date
        ) AS on_leave
      FROM staff_base sb, visit_window vw
    ),
    conflict_check AS (
      SELECT sb.id,
        EXISTS (
          SELECT 1 FROM homecare_visits v
          WHERE v.assigned_staff_id = sb.id AND v.organization_id = $1
            AND v.id <> $5
            AND v.status NOT IN ('cancelled', 'missed')
            AND v.scheduled_start < vw.we + INTERVAL '30 minutes'
            AND v.scheduled_end > vw.ws - INTERVAL '30 minutes'
        ) AS has_conflict
      FROM staff_base sb, visit_window vw
    ),
    workload AS (
      SELECT sp2.id AS staff_id,
        COALESCE(SUM(EXTRACT(EPOCH FROM (v2.scheduled_end - v2.scheduled_start)) / 60), 0)::int AS assigned_minutes,
        COUNT(v2.id)::int AS assigned_calls
      FROM staff_base sp2
      LEFT JOIN homecare_visits v2 ON v2.assigned_staff_id = sp2.id AND v2.organization_id = $1
        AND v2.status NOT IN ('cancelled', 'missed')
        AND v2.scheduled_start >= CURRENT_DATE AND v2.scheduled_start < CURRENT_DATE + INTERVAL '1 day'
      GROUP BY sp2.id
    ),
    prev_call AS (
      SELECT hv2.assigned_staff_id, hv2.scheduled_end, hv2.latitude AS prev_lat, hv2.longitude AS prev_lon
      FROM homecare_visits hv2
      WHERE hv2.organization_id = $1 AND hv2.id <> $5
        AND hv2.assigned_staff_id IS NOT NULL
        AND hv2.scheduled_end <= vw.ws
        AND hv2.scheduled_end > vw.ws - INTERVAL '4 hours'
        AND hv2.status NOT IN ('cancelled', 'missed')
      ORDER BY hv2.scheduled_end DESC
      LIMIT 1
    )
    SELECT sb.id, sb.first_name, sb.last_name,
      COALESCE(ac.has_availability, FALSE) AS available,
      COALESCE(lc.on_leave, FALSE) AS on_leave,
      COALESCE(cc.has_conflict, FALSE) AS has_conflict,
      COALESCE(wl.assigned_minutes, 0) AS workload_minutes,
      COALESCE(wl.assigned_calls, 0) AS workload_calls
    FROM staff_base sb
    LEFT JOIN avail_check ac ON ac.id = sb.id
    LEFT JOIN leave_check lc ON lc.id = sb.id
    LEFT JOIN conflict_check cc ON cc.id = sb.id
    LEFT JOIN workload wl ON wl.staff_id = sb.id
    ORDER BY (COALESCE(ac.has_availability, FALSE)) DESC, (COALESCE(cc.has_conflict, FALSE)) ASC, (COALESCE(lc.on_leave, FALSE)) ASC, COALESCE(wl.assigned_minutes, 0) ASC`, [orgId, startTime, endTime, dayOfWeek, visitId]);

  // Score each carer: 0-100 scale
  const visitLat = visit.latitude;
  const visitLon = visit.longitude;

  const scored = result.rows.map((s: any) => {
    let score = 50; // base
    const reasons: string[] = [];

    // Availability fit: +25 if available, -40 if not
    if (s.available) { score += 25; reasons.push('Available at this time'); }
    else { score -= 40; reasons.push('No availability recorded for this window'); }

    // On leave: -50 (hard block)
    if (s.on_leave) { score -= 50; reasons.push('On leave'); }

    // Existing conflict: -50 (hard block)
    if (s.has_conflict) { score -= 50; reasons.push('Already assigned to another call at this time'); }

    // Workload balancing: up to +15 for lighter load
    const maxMins = 480; // 8 hours ideal max
    const loadPct = Math.min(s.workload_minutes / maxMins, 1);
    const workloadScore = Math.round((1 - loadPct) * 15);
    score += workloadScore;
    if (s.workload_calls > 0) reasons.push(`${s.workload_calls} calls today (${s.workload_minutes} min)`);
    else reasons.push('No calls today');

    return {
      staff_id: s.id,
      first_name: s.first_name,
      last_name: s.last_name,
      score: Math.max(0, Math.min(100, score)),
      available: s.available,
      on_leave: s.on_leave,
      has_conflict: s.has_conflict,
      workload_minutes: s.workload_minutes,
      workload_calls: s.workload_calls,
      reasons,
    };
  });

  // Sort by score descending
  scored.sort((a: any, b: any) => b.score - a.score);
  return scored;
}
