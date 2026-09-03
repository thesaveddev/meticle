import { query, transaction } from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';
import { Expense, ExpenseInput, ExpenseStats, PettyCashBalance, PettyCashTransaction, PettyCashTransactionType } from './expenses.types';

// --- Expenses ---

export async function createExpense(orgId: string, userId: string, data: ExpenseInput): Promise<Expense> {
  if (data.money_source === 'person') {
    const su = await query('SELECT id FROM people WHERE id = $1 AND organization_id = $2', [data.person_id, orgId]);
    if (su.rows.length === 0) throw new AppError(404, 'Person not found');
  }

  if (data.location_id) {
    const loc = await query('SELECT id FROM locations WHERE id = $1 AND organization_id = $2', [data.location_id, orgId]);
    if (loc.rows.length === 0) throw new AppError(404, 'Location not found');
  }

  const result = await query(
    `INSERT INTO person_expenses (organization_id, person_id, location_id, money_source, payment_method, category, amount_pence, description, receipt_url, incurred_date, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [orgId, data.person_id || null, data.location_id || null, data.money_source || 'person', data.payment_method || null, data.category, data.amount_pence, data.description || null, data.receipt_url || null, data.incurred_date, userId]
  );
  return result.rows[0];
}

export async function getExpenses(orgId: string, filters: { person_id?: string; location_id?: string; money_source?: string; category?: string; from?: string; to?: string; include_voided?: boolean }): Promise<Expense[]> {
  const conditions: string[] = ['e.organization_id = $1'];
  const params: any[] = [orgId];
  let idx = 2;

  if (filters.person_id) { conditions.push(`e.person_id = $${idx++}`); params.push(filters.person_id); }
  if (filters.location_id) { conditions.push(`e.location_id = $${idx++}`); params.push(filters.location_id); }
  if (filters.money_source) { conditions.push(`e.money_source = $${idx++}`); params.push(filters.money_source); }
  if (filters.category) { conditions.push(`e.category = $${idx++}`); params.push(filters.category); }
  if (filters.from) { conditions.push(`e.incurred_date >= $${idx++}`); params.push(filters.from); }
  if (filters.to) { conditions.push(`e.incurred_date <= $${idx++}`); params.push(filters.to); }
  if (!filters.include_voided) { conditions.push('e.is_voided = FALSE'); }

  const result = await query(
    `SELECT e.*, COALESCE(su.first_name || ' ' || su.last_name, 'House funds') as person_name,
            l.name as location_name, sp.first_name || ' ' || sp.last_name as created_by_name,
            vu.first_name || ' ' || vu.last_name as voided_by_name
     FROM person_expenses e
     LEFT JOIN people su ON e.person_id = su.id
     LEFT JOIN locations l ON e.location_id = l.id
     LEFT JOIN staff_profiles sp ON sp.user_id = e.created_by
     LEFT JOIN staff_profiles vu ON vu.user_id = e.voided_by
     WHERE ${conditions.join(' AND ')}
     ORDER BY e.incurred_date DESC, e.created_at DESC`,
    params
  );
  return result.rows;
}

export async function getExpense(orgId: string, expenseId: string): Promise<Expense> {
  const result = await query(
    `SELECT e.*, COALESCE(su.first_name || ' ' || su.last_name, 'House funds') as person_name,
            l.name as location_name, sp.first_name || ' ' || sp.last_name as created_by_name
     FROM person_expenses e
     LEFT JOIN people su ON e.person_id = su.id
     LEFT JOIN locations l ON e.location_id = l.id
     LEFT JOIN staff_profiles sp ON sp.user_id = e.created_by
     WHERE e.id = $1 AND e.organization_id = $2`,
    [expenseId, orgId]
  );
  if (result.rows.length === 0) throw new AppError(404, 'Expense not found');
  return result.rows[0];
}

export async function updateExpense(orgId: string, expenseId: string, data: Partial<ExpenseInput>, userId: string): Promise<Expense> {
  const existing = await getExpense(orgId, expenseId);

  // Only description and category may be edited after creation (audit trail requirement)
  const fields: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (data.category !== undefined) { fields.push(`category = $${idx++}`); params.push(data.category); }
  if (data.description !== undefined) { fields.push(`description = $${idx++}`); params.push(data.description); }

  if (fields.length === 0) return existing;

  fields.push('updated_at = NOW()');
  fields.push(`updated_by = $${idx++}`);
  params.push(userId);
  params.push(expenseId, orgId);

  await query(
    `UPDATE person_expenses SET ${fields.join(', ')} WHERE id = $${idx++} AND organization_id = $${idx} RETURNING *`,
    params
  );
  // Return fresh data with joins
  return getExpense(orgId, expenseId);
}

export async function voidExpense(orgId: string, expenseId: string, userId: string, reason: string): Promise<Expense> {
  const existing = await getExpense(orgId, expenseId);
  if (existing.is_voided) throw new AppError(400, 'Expense is already voided');

  const result = await query(
    `UPDATE person_expenses SET is_voided = TRUE, void_reason = $1, voided_by = $2, voided_at = NOW(), updated_at = NOW()
     WHERE id = $3 AND organization_id = $4 RETURNING *`,
    [reason, userId, expenseId, orgId]
  );
  return result.rows[0];
}

export async function getExpenseStats(orgId: string, from?: string, to?: string): Promise<ExpenseStats> {
  const conditions: string[] = ['e.organization_id = $1'];
  const params: any[] = [orgId];
  let idx = 2;

  if (from) { conditions.push(`e.incurred_date >= $${idx++}`); params.push(from); }
  if (to) { conditions.push(`e.incurred_date <= $${idx++}`); params.push(to); }

  const where = conditions.join(' AND ');

  const voidedCondition = ' AND e.is_voided = FALSE';
  const total = await query(`SELECT COUNT(*)::int as count, COALESCE(SUM(e.amount_pence), 0) as total FROM person_expenses e WHERE ${where}${voidedCondition}`, params);
  const byCat = await query(
    `SELECT e.category, COUNT(*)::int as count, COALESCE(SUM(e.amount_pence), 0) as total
     FROM person_expenses e WHERE ${where}${voidedCondition} GROUP BY e.category ORDER BY total DESC`,
    params
  );
  const bySu = await query(
    `SELECT e.person_id, COALESCE(su.first_name || ' ' || su.last_name, 'House funds') as person_name,
            COUNT(*)::int as count, COALESCE(SUM(e.amount_pence), 0) as total
     FROM person_expenses e
     LEFT JOIN people su ON e.person_id = su.id
     WHERE ${where}${voidedCondition} GROUP BY e.person_id, su.first_name, su.last_name ORDER BY total DESC LIMIT 20`,
    params
  );
  const byLoc = await query(
    `SELECT e.location_id, COALESCE(l.name, 'Unknown') as location_name, COALESCE(SUM(e.amount_pence), 0) as total
     FROM person_expenses e
     LEFT JOIN locations l ON e.location_id = l.id
     WHERE ${where} AND e.location_id IS NOT NULL${voidedCondition}
     GROUP BY e.location_id, l.name ORDER BY total DESC`,
    params
  );

  return {
    total_expenses: total.rows[0]?.count || 0,
    total_amount_pounds: Math.round(Number(total.rows[0]?.total || 0) / 100),
    by_category: byCat.rows.map((r: any) => ({ category: r.category, count: r.count, total_pounds: Math.round(Number(r.total) / 100) })),
    by_person: bySu.rows.map((r: any) => ({ person_id: r.person_id, person_name: r.person_name, count: r.count, total_pounds: Math.round(Number(r.total) / 100) })),
    by_location: byLoc.rows.map((r: any) => ({ location_id: r.location_id, location_name: r.location_name, total_pounds: Math.round(Number(r.total) / 100) })),
    period_start: from || 'all',
    period_end: to || 'all',
  };
}

// --- Petty Cash ---

export async function getPettyCashBalances(orgId: string, locationId?: string): Promise<PettyCashBalance[]> {
  const conditions: string[] = ['pcb.organization_id = $1'];
  const params: any[] = [orgId];
  let idx = 2;

  if (locationId) { conditions.push(`pcb.location_id = $${idx++}`); params.push(locationId); }

  const result = await query(
    `SELECT pcb.*, l.name as location_name, 'house' as money_source
     FROM petty_cash_balances pcb
     JOIN locations l ON pcb.location_id = l.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY l.name`,
    params
  );
  const people = await query(`SELECT pcb.*, p.first_name || ' ' || p.last_name AS person_name, 'person' as money_source
    FROM person_cash_balances pcb JOIN people p ON p.id = pcb.person_id
    WHERE pcb.organization_id = $1 ORDER BY person_name`, [orgId]);
  return [...result.rows, ...people.rows];
}

export async function getOrCreatePettyCashBalance(orgId: string, locationId: string): Promise<PettyCashBalance> {
  const result = await query(
    `INSERT INTO petty_cash_balances (organization_id, location_id, current_balance_pence)
     VALUES ($1, $2, 0) ON CONFLICT (location_id) DO UPDATE SET location_id = EXCLUDED.location_id
     RETURNING *`,
    [orgId, locationId]
  );
  return result.rows[0];
}

export async function topUpPettyCash(orgId: string, userId: string, target: { moneySource: 'house' | 'person'; locationId?: string; personId?: string }, amountPence: number, notes?: string): Promise<{ balance: PettyCashBalance; transaction: PettyCashTransaction }> {
  const locationId = target.locationId;
  if (target.moneySource === 'person') {
    if (!target.personId) throw new AppError(400, 'Person is required for person funds');
    const person = await query('SELECT id FROM people WHERE id = $1 AND organization_id = $2', [target.personId, orgId]);
    if (!person.rows.length) throw new AppError(404, 'Person not found');
    const balance = await query(`INSERT INTO person_cash_balances (organization_id, person_id, current_balance_pence) VALUES ($1,$2,0) ON CONFLICT (person_id) DO UPDATE SET person_id = EXCLUDED.person_id RETURNING *`, [orgId, target.personId]);
    const previous = Number(balance.rows[0].current_balance_pence); const next = previous + amountPence;
    const updated = await query(`UPDATE person_cash_balances SET current_balance_pence = $1, updated_at = NOW() WHERE id = $2 RETURNING *`, [next, balance.rows[0].id]);
    const transaction = await query(`INSERT INTO person_cash_transactions (organization_id, person_id, type, amount_pence, previous_balance_pence, new_balance_pence, notes, performed_by) VALUES ($1,$2,'top_up',$3,$4,$5,$6,$7) RETURNING *`, [orgId, target.personId, amountPence, previous, next, notes || null, userId]);
    return { balance: { ...updated.rows[0], money_source: 'person' }, transaction: { ...transaction.rows[0], money_source: 'person' } };
  }
  if (!locationId) throw new AppError(400, 'Location is required for house funds');
  const loc = await query('SELECT id FROM locations WHERE id = $1 AND organization_id = $2', [locationId, orgId]);
  if (loc.rows.length === 0) throw new AppError(404, 'Location not found');

  const balance = await getOrCreatePettyCashBalance(orgId, locationId);
  const previous = Number(balance.current_balance_pence);
  const newBalance = previous + amountPence;

  const updated = await query(
    `UPDATE petty_cash_balances SET current_balance_pence = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [newBalance, balance.id]
  );

  const txn = await query(
    `INSERT INTO petty_cash_transactions (organization_id, location_id, type, amount_pence, previous_balance_pence, new_balance_pence, notes, performed_by)
     VALUES ($1, $2, 'top_up', $3, $4, $5, $6, $7) RETURNING *`,
    [orgId, locationId, amountPence, previous, newBalance, notes || null, userId]
  );

  return { balance: updated.rows[0], transaction: txn.rows[0] };
}

async function getActiveReconciliationReviewer(orgId: string, userId: string, reviewerId: string): Promise<void> {
  if (!reviewerId || reviewerId === userId) {
    throw new AppError(400, 'A different staff member must review the reconciliation');
  }
  const reviewer = await query(
    `SELECT id FROM users WHERE id = $1 AND organization_id = $2 AND status = 'active'`,
    [reviewerId, orgId]
  );
  if (!reviewer.rows.length) throw new AppError(400, 'The reviewing staff member is not an active member of this organisation');
}

export async function requestPettyCashReconciliation(orgId: string, userId: string, target: { moneySource: 'house' | 'person'; locationId?: string; personId?: string }, actualBalancePence: number, handedOverTo: string, notes?: string) {
  await getActiveReconciliationReviewer(orgId, userId, handedOverTo);
  if (!Number.isInteger(actualBalancePence) || actualBalancePence < 0) throw new AppError(400, 'Actual balance must be a non-negative amount in pence');

  return transaction(async (client) => {
    let balance: any;
    if (target.moneySource === 'person') {
      if (!target.personId) throw new AppError(400, 'Person is required for person funds');
      const person = await client.query('SELECT id FROM people WHERE id = $1 AND organization_id = $2', [target.personId, orgId]);
      if (!person.rows.length) throw new AppError(404, 'Person not found');
      const result = await client.query(
        `INSERT INTO person_cash_balances (organization_id, person_id, current_balance_pence)
         VALUES ($1, $2, 0) ON CONFLICT (person_id) DO UPDATE SET person_id = EXCLUDED.person_id RETURNING *`,
        [orgId, target.personId]
      );
      balance = result.rows[0];
    } else {
      if (!target.locationId) throw new AppError(400, 'Location is required for house funds');
      const location = await client.query('SELECT id FROM locations WHERE id = $1 AND organization_id = $2', [target.locationId, orgId]);
      if (!location.rows.length) throw new AppError(404, 'Location not found');
      const result = await client.query(
        `INSERT INTO petty_cash_balances (organization_id, location_id, current_balance_pence)
         VALUES ($1, $2, 0) ON CONFLICT (location_id) DO UPDATE SET location_id = EXCLUDED.location_id RETURNING *`,
        [orgId, target.locationId]
      );
      balance = result.rows[0];
    }

    const expectedBalancePence = Number(balance.current_balance_pence);
    const variancePence = actualBalancePence - expectedBalancePence;
    const result = await client.query(
      `INSERT INTO cash_reconciliation_requests
       (organization_id, money_source, location_id, person_id, expected_balance_pence, actual_balance_pence, variance_pence, notes, requested_by, handed_over_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [orgId, target.moneySource, target.locationId || null, target.personId || null, expectedBalancePence, actualBalancePence, variancePence, notes || null, userId, handedOverTo]
    );
    const request = result.rows[0];
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
       VALUES ($1, 'create', 'cash_reconciliation_request', $2, $3)`,
      [userId, request.id, JSON.stringify({
        money_source: target.moneySource,
        location_id: target.locationId || null,
        person_id: target.personId || null,
        expected_balance_pence: expectedBalancePence,
        actual_balance_pence: actualBalancePence,
        variance_pence: variancePence,
        requested_by: userId,
        handed_over_to: handedOverTo,
      })]
    );
    return request;
  });
}

const RECONCILIATION_SELECT = `
  SELECT r.*,
    l.name AS location_name,
    p.first_name || ' ' || p.last_name AS person_name,
    COALESCE(requester.first_name || ' ' || requester.last_name, requester_user.email) AS requested_by_name,
    COALESCE(reviewer.first_name || ' ' || reviewer.last_name, reviewer_user.email) AS handed_over_to_name,
    COALESCE(reviewer_decision.first_name || ' ' || reviewer_decision.last_name, reviewer_decision_user.email) AS reviewed_by_name
  FROM cash_reconciliation_requests r
  LEFT JOIN locations l ON l.id = r.location_id
  LEFT JOIN people p ON p.id = r.person_id
  LEFT JOIN users requester_user ON requester_user.id = r.requested_by
  LEFT JOIN staff_profiles requester ON requester.user_id = requester_user.id
  LEFT JOIN users reviewer_user ON reviewer_user.id = r.handed_over_to
  LEFT JOIN staff_profiles reviewer ON reviewer.user_id = reviewer_user.id
  LEFT JOIN users reviewer_decision_user ON reviewer_decision_user.id = r.reviewed_by
  LEFT JOIN staff_profiles reviewer_decision ON reviewer_decision.user_id = reviewer_decision_user.id
`;

export async function getCashReconciliationRequests(orgId: string) {
  const result = await query(`${RECONCILIATION_SELECT} WHERE r.organization_id = $1 ORDER BY r.created_at DESC`, [orgId]);
  return result.rows;
}

export async function reviewPettyCashReconciliation(orgId: string, requestId: string, userId: string, decision: 'accepted' | 'rejected', rejectionReason?: string) {
  return transaction(async (client) => {
    const current = await client.query(
      `SELECT r.* FROM cash_reconciliation_requests r
       JOIN users reviewer ON reviewer.id = $3
         AND reviewer.organization_id = r.organization_id
         AND reviewer.status = 'active'
       WHERE r.id = $1 AND r.organization_id = $2
       FOR UPDATE OF r`,
      [requestId, orgId, userId]
    );
    if (!current.rows.length) throw new AppError(404, 'Reconciliation request not found');
    const request = current.rows[0];
    if (request.handed_over_to !== userId) throw new AppError(403, 'Only the assigned reviewing staff member can decide this reconciliation');
    if (request.status !== 'pending') throw new AppError(409, 'Reconciliation request has already been reviewed');
    if (decision === 'rejected') {
      if (!rejectionReason || rejectionReason.trim().length < 3) throw new AppError(400, 'A reason is required when rejecting a reconciliation');
      const rejected = await client.query(
        `UPDATE cash_reconciliation_requests
         SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), rejection_reason = $2, updated_at = NOW()
         WHERE id = $3 AND status = 'pending' RETURNING *`,
        [userId, rejectionReason.trim(), requestId]
      );
      await client.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
         VALUES ($1, 'reject', 'cash_reconciliation_request', $2, $3, $4)`,
        [userId, requestId, JSON.stringify({ status: 'pending' }), JSON.stringify({ status: 'rejected', reviewed_by: userId, rejection_reason: rejectionReason.trim() })]
      );
      return rejected.rows[0];
    }

    let balance: any;
    if (request.money_source === 'person') {
      const result = await client.query(
        `SELECT * FROM person_cash_balances WHERE organization_id = $1 AND person_id = $2 FOR UPDATE`,
        [orgId, request.person_id]
      );
      balance = result.rows[0];
    } else {
      const result = await client.query(
        `SELECT * FROM petty_cash_balances WHERE organization_id = $1 AND location_id = $2 FOR UPDATE`,
        [orgId, request.location_id]
      );
      balance = result.rows[0];
    }
    if (!balance || Number(balance.current_balance_pence) !== Number(request.expected_balance_pence)) {
      throw new AppError(409, 'The expected balance changed after this request. A new physical count is required');
    }

    const nowUpdate = request.money_source === 'person'
      ? await client.query(`UPDATE person_cash_balances SET current_balance_pence = $1, last_reconciled_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *`, [request.actual_balance_pence, balance.id])
      : await client.query(`UPDATE petty_cash_balances SET current_balance_pence = $1, last_reconciled_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *`, [request.actual_balance_pence, balance.id]);
    const delta = Number(request.actual_balance_pence) - Number(request.expected_balance_pence);
    if (request.money_source === 'person') {
      await client.query(
        `INSERT INTO person_cash_transactions (organization_id, person_id, type, amount_pence, previous_balance_pence, new_balance_pence, notes, performed_by)
         VALUES ($1,$2,'reconciliation',$3,$4,$5,$6,$7)`,
        [orgId, request.person_id, delta, request.expected_balance_pence, request.actual_balance_pence, request.notes || null, userId]
      );
    } else {
      await client.query(
        `INSERT INTO petty_cash_transactions (organization_id, location_id, type, amount_pence, previous_balance_pence, new_balance_pence, notes, performed_by)
         VALUES ($1,$2,'reconciliation',$3,$4,$5,$6,$7)`,
        [orgId, request.location_id, delta, request.expected_balance_pence, request.actual_balance_pence, request.notes || null, userId]
      );
    }
    const accepted = await client.query(
      `UPDATE cash_reconciliation_requests
       SET status = 'accepted', reviewed_by = $1, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND status = 'pending' RETURNING *`,
      [userId, requestId]
    );
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
       VALUES ($1, 'accept', 'cash_reconciliation_request', $2, $3, $4)`,
      [userId, requestId, JSON.stringify({ status: 'pending', expected_balance_pence: request.expected_balance_pence }), JSON.stringify({ status: 'accepted', reviewed_by: userId, actual_balance_pence: request.actual_balance_pence })]
    );
    return { request: accepted.rows[0], balance: nowUpdate.rows[0] };
  });
}

// Kept as a compatibility alias for internal callers; new writes must use the request workflow.
export const reconcilePettyCash = requestPettyCashReconciliation;

export async function dailyCashCheck(orgId: string, userId: string, data: { moneySource: 'house' | 'person'; locationId?: string; personId?: string; expectedBalancePence: number; physicalBalancePence: number; checkDate: string; notes?: string; escalate?: boolean; escalationReason?: string; handedOverTo: string }) {
  if (data.moneySource === 'house' && data.locationId) {
    const loc = await query('SELECT id FROM locations WHERE id = $1 AND organization_id = $2', [data.locationId, orgId]);
    if (!loc.rows.length) throw new AppError(404, 'Location not found');
  } else if (data.moneySource === 'person' && data.personId) {
    const person = await query('SELECT id FROM people WHERE id = $1 AND organization_id = $2', [data.personId, orgId]);
    if (!person.rows.length) throw new AppError(404, 'Person not found');
  }

  if (!data.handedOverTo || data.handedOverTo === userId) {
    throw new AppError(400, 'A different staff member must be selected to confirm the count');
  }

  const confirmer = await query(
    `SELECT id FROM users WHERE id = $1 AND organization_id = $2 AND status = 'active'`,
    [data.handedOverTo, orgId]
  );
  if (!confirmer.rows.length) throw new AppError(400, 'The confirming staff member is not an active member of this organisation');

  const variance = data.physicalBalancePence - data.expectedBalancePence;
  const escalated = data.escalate || false;
  return transaction(async (client) => {
    const result = await client.query(
      `INSERT INTO cash_balance_checks (organization_id, money_source, location_id, person_id, check_date, expected_balance_pence, physical_balance_pence, variance_pence, notes, checked_by, counted_by, handed_over_to, escalated, escalation_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11,$12,$13) RETURNING *`,
      [orgId, data.moneySource, data.locationId || null, data.personId || null, data.checkDate, data.expectedBalancePence, data.physicalBalancePence, variance, data.notes || null, userId, data.handedOverTo, escalated, data.escalationReason || null]
    );
    const check = result.rows[0];
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'create', 'cash_balance_check', check.id, JSON.stringify({
        money_source: data.moneySource,
        check_date: data.checkDate,
        expected_balance_pence: data.expectedBalancePence,
        physical_balance_pence: data.physicalBalancePence,
        variance_pence: variance,
        counted_by: userId,
        handed_over_to: data.handedOverTo,
      })]
    );
    return check;
  });
}

const CASH_CHECK_SELECT = `
  SELECT c.*, l.name AS location_name, p.first_name || ' ' || p.last_name AS person_name,
    COALESCE(counter.first_name || ' ' || counter.last_name, counter_user.email) AS counted_by_name,
    COALESCE(confirmer.first_name || ' ' || confirmer.last_name, confirmer_user.email) AS handed_over_to_name,
    COALESCE(acceptor.first_name || ' ' || acceptor.last_name, acceptor_user.email) AS accepted_by_name
  FROM cash_balance_checks c
  LEFT JOIN locations l ON l.id = c.location_id
  LEFT JOIN people p ON p.id = c.person_id
  LEFT JOIN users counter_user ON counter_user.id = c.counted_by
  LEFT JOIN staff_profiles counter ON counter.user_id = counter_user.id
  LEFT JOIN users confirmer_user ON confirmer_user.id = c.handed_over_to
  LEFT JOIN staff_profiles confirmer ON confirmer.user_id = confirmer_user.id
  LEFT JOIN users acceptor_user ON acceptor_user.id = c.accepted_by
  LEFT JOIN staff_profiles acceptor ON acceptor.user_id = acceptor_user.id
`;

export async function getDailyCashChecks(orgId: string, filters: { from?: string; to?: string }) {
  const result = await query(`${CASH_CHECK_SELECT} WHERE c.organization_id = $1 ORDER BY c.check_date DESC, c.created_at DESC`, [orgId]);
  return result.rows;
}

export async function acceptDailyCashCheck(orgId: string, checkId: string, userId: string) {
  return transaction(async (client) => {
    const current = await client.query(
      `SELECT c.id, c.counted_by, c.handed_over_to, c.accepted_by, c.accepted_at
       FROM cash_balance_checks c
       JOIN users u ON u.id = $3 AND u.organization_id = c.organization_id AND u.status = 'active'
       WHERE c.id = $1 AND c.organization_id = $2
       FOR UPDATE`,
      [checkId, orgId, userId]
    );
    if (!current.rows.length) throw new AppError(404, 'Cash check not found');
    const check = current.rows[0];
    if (check.handed_over_to !== userId) throw new AppError(403, 'Only the assigned confirming staff member can accept this cash check');
    if (check.counted_by === userId) throw new AppError(403, 'The person who counted the cash cannot accept the same check');
    if (check.accepted_at) throw new AppError(409, 'Cash check has already been accepted');

    const updated = await client.query(
      `UPDATE cash_balance_checks
       SET accepted_by = $1, accepted_at = NOW()
       WHERE id = $2 AND organization_id = $3 AND accepted_at IS NULL
       RETURNING id, accepted_by, accepted_at`,
      [userId, checkId, orgId]
    );
    if (!updated.rows.length) throw new AppError(409, 'Cash check has already been accepted');

    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, 'accept', 'cash_balance_check', checkId,
        JSON.stringify({ accepted_by: null, accepted_at: null }),
        JSON.stringify({ accepted_by: userId, accepted_at: updated.rows[0].accepted_at, counted_by: check.counted_by, handed_over_to: check.handed_over_to })]
    );

    const result = await client.query(`${CASH_CHECK_SELECT} WHERE c.id = $1 AND c.organization_id = $2`, [checkId, orgId]);
    return result.rows[0];
  });
}

export async function getExpenseReport(orgId: string, filters: { from?: string; to?: string }) {
  const expenses = await getExpenses(orgId, { from: filters.from, to: filters.to });
  return { generated_at: new Date().toISOString(), period_start: filters.from || null, period_end: filters.to || null, expenses, totals: { count: expenses.length, amount_pence: expenses.reduce((sum, e) => sum + Number(e.amount_pence || 0), 0) } };
}

export async function getPettyCashTransactions(orgId: string, filters: { location_id?: string; from?: string; to?: string }): Promise<PettyCashTransaction[]> {
  const conditions: string[] = ['pct.organization_id = $1'];
  const params: any[] = [orgId];
  let idx = 2;

  if (filters.location_id) { conditions.push(`pct.location_id = $${idx++}`); params.push(filters.location_id); }
  if (filters.from) { conditions.push(`pct.created_at >= $${idx++}`); params.push(filters.from); }
  if (filters.to) { conditions.push(`pct.created_at <= $${idx++}`); params.push(filters.to); }

  const result = await query(
    `SELECT pct.*, l.name as location_name, 'house' as money_source, sp.first_name || ' ' || sp.last_name as performed_by_name
     FROM petty_cash_transactions pct
     JOIN locations l ON pct.location_id = l.id
     LEFT JOIN staff_profiles sp ON sp.user_id = pct.performed_by
     WHERE ${conditions.join(' AND ')}
     ORDER BY pct.created_at DESC`,
    params
  );
  const people = await query(`SELECT pct.*, p.first_name || ' ' || p.last_name AS person_name, 'person' as money_source, sp.first_name || ' ' || sp.last_name as performed_by_name
    FROM person_cash_transactions pct JOIN people p ON p.id = pct.person_id LEFT JOIN staff_profiles sp ON sp.user_id = pct.performed_by
    WHERE pct.organization_id = $1 ORDER BY pct.created_at DESC`, [orgId]);
  return [...result.rows, ...people.rows];
}
