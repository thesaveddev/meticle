import { query } from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';
import { DbsCheck, DbsLevel, DbsStatus, DbsSubmitRequest, DbsStats, DbsWorkforce } from './dbs.types';

// --- Provider abstraction ---

interface DbsProvider {
  submitCheck(staff: { first_name: string; last_name: string; email: string; birth_date?: string; address?: string; postcode?: string }, level: DbsLevel, workforce: DbsWorkforce): Promise<{ provider_reference: string; application_reference: string }>;
  getStatus(providerReference: string): Promise<{ status: DbsStatus; certificate_number?: string; disclosure_date?: string }>;
  cancelCheck(providerReference: string): Promise<void>;
}

class MockDbsProvider implements DbsProvider {
  async submitCheck(staff: any, level: DbsLevel, workforce: DbsWorkforce) {
    await new Promise(r => setTimeout(r, 500));
    return {
      provider_reference: `MOCK-${Date.now()}`,
      application_reference: `APP-${Date.now()}`,
    };
  }
  async getStatus(providerReference: string) {
    return { status: DbsStatus.CLEAR, certificate_number: `CERT-${providerReference.slice(-8)}`, disclosure_date: new Date().toISOString() };
  }
  async cancelCheck(providerReference: string) {}
}

let provider: DbsProvider = new MockDbsProvider();

export function setDbsProvider(p: DbsProvider) {
  provider = p;
}

// --- Status helpers ---

const STATUS_ORDER: Record<DbsStatus, number> = {
  [DbsStatus.DRAFT]: 0,
  [DbsStatus.SUBMITTED]: 1,
  [DbsStatus.IN_PROGRESS]: 2,
  [DbsStatus.AWAITING_IDENTITY]: 3,
  [DbsStatus.CLEAR]: 4,
  [DbsStatus.DISCLOSURE]: 4,
  [DbsStatus.CANCELLED]: -1,
  [DbsStatus.ERROR]: -1,
};

// --- Repository ---

export async function createDbsCheck(orgId: string, data: DbsSubmitRequest): Promise<DbsCheck> {
  const sp = await query(
    `SELECT sp.user_id, sp.first_name, sp.last_name, sp.birth_date
     FROM staff_profiles sp
     JOIN users u ON u.id = sp.user_id
     WHERE sp.id = $1 AND u.organization_id = $2`,
    [data.staff_id, orgId]
  );
  if (sp.rows.length === 0) throw new AppError(404, 'Staff member not found');

  const user = await query('SELECT email FROM users WHERE id = $1', [sp.rows[0].user_id]);

  const result = await query(
    `INSERT INTO dbs_checks (organization_id, staff_id, level, workforce, status, cost_pence, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [orgId, data.staff_id, data.level, data.workforce, DbsStatus.DRAFT, data.cost_pence || null, data.notes || null]
  );
  return result.rows[0];
}

export async function submitDbsCheck(orgId: string, checkId: string): Promise<DbsCheck> {
  const check = await query('SELECT * FROM dbs_checks WHERE id = $1 AND organization_id = $2', [checkId, orgId]);
  if (check.rows.length === 0) throw new AppError(404, 'DBS check not found');
  const c = check.rows[0];
  if (c.status !== DbsStatus.DRAFT) throw new AppError(400, `Cannot submit check in status: ${c.status}`);

  const sp = await query(
    `SELECT sp.first_name, sp.last_name, sp.birth_date, sp.address, sp.postal_code, u.email
     FROM staff_profiles sp JOIN users u ON sp.user_id = u.id WHERE sp.id = $1`,
    [c.staff_id]
  );
  const staff = sp.rows[0];

  const providerResult = await provider.submitCheck(staff, c.level, c.workforce);

  const result = await query(
    `UPDATE dbs_checks SET status = $1, submitted_at = NOW(), provider_reference = $2, application_reference = $3, updated_at = NOW()
     WHERE id = $4 RETURNING *`,
    [DbsStatus.SUBMITTED, providerResult.provider_reference, providerResult.application_reference, checkId]
  );
  return result.rows[0];
}

export async function getDbsChecks(orgId: string): Promise<DbsCheck[]> {
  const result = await query(
    `SELECT dc.*, sp.first_name || ' ' || sp.last_name as staff_name
     FROM dbs_checks dc
     JOIN staff_profiles sp ON dc.staff_id = sp.id
     WHERE dc.organization_id = $1
     ORDER BY dc.created_at DESC`,
    [orgId]
  );
  return result.rows;
}

export async function getDbsCheck(orgId: string, checkId: string): Promise<DbsCheck> {
  const result = await query(
    `SELECT dc.*, sp.first_name || ' ' || sp.last_name as staff_name
     FROM dbs_checks dc
     JOIN staff_profiles sp ON dc.staff_id = sp.id
     WHERE dc.id = $1 AND dc.organization_id = $2`,
    [checkId, orgId]
  );
  if (result.rows.length === 0) throw new AppError(404, 'DBS check not found');
  return result.rows[0];
}

export async function updateDbsStatus(orgId: string, checkId: string, status: DbsStatus, certificateNumber?: string): Promise<DbsCheck> {
  const check = await getDbsCheck(orgId, checkId);
  const newOrder = STATUS_ORDER[status];
  const curOrder = STATUS_ORDER[check.status];
  if (newOrder < curOrder && status !== DbsStatus.CANCELLED && status !== DbsStatus.ERROR) {
    throw new AppError(400, `Cannot move from ${check.status} to ${status}`);
  }

  const updates: string[] = ['status = $1', 'updated_at = NOW()'];
  const params: any[] = [status];

  if (status === DbsStatus.CLEAR || status === DbsStatus.DISCLOSURE) {
    updates.push('completed_at = NOW()');
    if (certificateNumber) {
      updates.push(`certificate_number = $${params.length + 1}`);
      params.push(certificateNumber);
    }
  }

  params.push(checkId);
  const result = await query(
    `UPDATE dbs_checks SET ${updates.join(', ')} WHERE id = $${params.length} AND organization_id = $${params.length + 1} RETURNING *`,
    [...params, orgId]
  );

  // When clear, auto-create a DBS document in the compliance system
  if (status === DbsStatus.CLEAR) {
    const disclosureDate = result.rows[0]?.completed_at;
    await query(
      `INSERT INTO documents (staff_id, type, url, status, expiry_date)
       VALUES ($1, 'DBS', '', 'approved',
         CASE WHEN $2::timestamptz IS NOT NULL THEN $2::timestamptz + INTERVAL '3 years' ELSE NOW() + INTERVAL '3 years' END)
       ON CONFLICT DO NOTHING`,
      [check.staff_id, disclosureDate]
    );
  }

  return result.rows[0];
}

export async function pollDbsStatus(orgId: string, checkId: string): Promise<DbsCheck> {
  const check = await getDbsCheck(orgId, checkId);
  if (!check.provider_reference) throw new AppError(400, 'Check has not been submitted yet');
  if (check.status === DbsStatus.CLEAR || check.status === DbsStatus.DISCLOSURE || check.status === DbsStatus.CANCELLED) {
    return check;
  }

  const providerStatus = await provider.getStatus(check.provider_reference);
  return updateDbsStatus(orgId, checkId, providerStatus.status, providerStatus.certificate_number);
}

export async function getDbsStats(orgId: string): Promise<DbsStats> {
  const all = await query('SELECT status, certificate_number, completed_at FROM dbs_checks WHERE organization_id = $1', [orgId]);
  const rows = all.rows;
  const stats: DbsStats = { total: rows.length, clear: 0, in_progress: 0, awaiting_identity: 0, submitted: 0, draft: 0, cancelled: 0, error: 0, expiring_soon: 0, expired: 0, cost_total_pounds: 0 };

  for (const r of rows) {
    if (r.status === DbsStatus.CLEAR || r.status === DbsStatus.DISCLOSURE) stats.clear++;
    else if (r.status === DbsStatus.IN_PROGRESS) stats.in_progress++;
    else if (r.status === DbsStatus.AWAITING_IDENTITY) stats.awaiting_identity++;
    else if (r.status === DbsStatus.SUBMITTED) stats.submitted++;
    else if (r.status === DbsStatus.DRAFT) stats.draft++;
    else if (r.status === DbsStatus.CANCELLED) stats.cancelled++;
    else if (r.status === DbsStatus.ERROR) stats.error++;

    if (r.completed_at) {
      const expiry = new Date(r.completed_at);
      expiry.setFullYear(expiry.getFullYear() + 3);
      const daysUntilExpiry = Math.ceil((expiry.getTime() - Date.now()) / 86400000);
      if (daysUntilExpiry < 0) stats.expired++;
      else if (daysUntilExpiry <= 30) stats.expiring_soon++;
    }
  }

  const costs = await query('SELECT COALESCE(SUM(cost_pence), 0) as total FROM dbs_checks WHERE organization_id = $1', [orgId]);
  stats.cost_total_pounds = Math.round(Number(costs.rows[0]?.total || 0) / 100);
  return stats;
}
