import { query } from '../../shared/database';
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

export async function getExpenses(orgId: string, filters: { person_id?: string; location_id?: string; money_source?: string; category?: string; from?: string; to?: string }): Promise<Expense[]> {
  const conditions: string[] = ['e.organization_id = $1'];
  const params: any[] = [orgId];
  let idx = 2;

  if (filters.person_id) { conditions.push(`e.person_id = $${idx++}`); params.push(filters.person_id); }
  if (filters.location_id) { conditions.push(`e.location_id = $${idx++}`); params.push(filters.location_id); }
  if (filters.money_source) { conditions.push(`e.money_source = $${idx++}`); params.push(filters.money_source); }
  if (filters.category) { conditions.push(`e.category = $${idx++}`); params.push(filters.category); }
  if (filters.from) { conditions.push(`e.incurred_date >= $${idx++}`); params.push(filters.from); }
  if (filters.to) { conditions.push(`e.incurred_date <= $${idx++}`); params.push(filters.to); }

  const result = await query(
    `SELECT e.*, COALESCE(su.first_name || ' ' || su.last_name, 'House funds') as person_name,
            l.name as location_name, sp.first_name || ' ' || sp.last_name as created_by_name
     FROM person_expenses e
     LEFT JOIN people su ON e.person_id = su.id
     LEFT JOIN locations l ON e.location_id = l.id
     LEFT JOIN staff_profiles sp ON sp.user_id = e.created_by
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

export async function updateExpense(orgId: string, expenseId: string, data: Partial<ExpenseInput>): Promise<Expense> {
  const existing = await getExpense(orgId, expenseId);
  const nextMoneySource = data.money_source ?? existing.money_source;
  const nextPersonId = data.person_id !== undefined ? data.person_id : existing.person_id;

  if (nextMoneySource === 'person') {
    const person = await query('SELECT id FROM people WHERE id = $1 AND organization_id = $2', [nextPersonId, orgId]);
    if (person.rows.length === 0) throw new AppError(404, 'Person not found');
  }
  if (data.location_id) {
    const location = await query('SELECT id FROM locations WHERE id = $1 AND organization_id = $2', [data.location_id, orgId]);
    if (location.rows.length === 0) throw new AppError(404, 'Location not found');
  }

  const fields: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (data.category !== undefined) { fields.push(`category = $${idx++}`); params.push(data.category); }
  if (data.amount_pence !== undefined) { fields.push(`amount_pence = $${idx++}`); params.push(data.amount_pence); }
  if (data.description !== undefined) { fields.push(`description = $${idx++}`); params.push(data.description); }
  if (data.receipt_url !== undefined) { fields.push(`receipt_url = $${idx++}`); params.push(data.receipt_url); }
  if (data.incurred_date !== undefined) { fields.push(`incurred_date = $${idx++}`); params.push(data.incurred_date); }
  if (data.location_id !== undefined) { fields.push(`location_id = $${idx++}`); params.push(data.location_id); }
  if (data.person_id !== undefined) { fields.push(`person_id = $${idx++}`); params.push(data.person_id); }
  if (data.money_source !== undefined) { fields.push(`money_source = $${idx++}`); params.push(data.money_source); }
  if (data.payment_method !== undefined) { fields.push(`payment_method = $${idx++}`); params.push(data.payment_method); }

  if (fields.length === 0) return existing;

  fields.push('updated_at = NOW()');
  params.push(expenseId, orgId);

  const result = await query(
    `UPDATE person_expenses SET ${fields.join(', ')} WHERE id = $${idx++} AND organization_id = $${idx} RETURNING *`,
    params
  );
  return result.rows[0];
}

export async function deleteExpense(orgId: string, expenseId: string): Promise<void> {
  const result = await query('DELETE FROM person_expenses WHERE id = $1 AND organization_id = $2', [expenseId, orgId]);
  if (result.rowCount === 0) throw new AppError(404, 'Expense not found');
}

export async function getExpenseStats(orgId: string, from?: string, to?: string): Promise<ExpenseStats> {
  const conditions: string[] = ['e.organization_id = $1'];
  const params: any[] = [orgId];
  let idx = 2;

  if (from) { conditions.push(`e.incurred_date >= $${idx++}`); params.push(from); }
  if (to) { conditions.push(`e.incurred_date <= $${idx++}`); params.push(to); }

  const where = conditions.join(' AND ');

  const total = await query(`SELECT COUNT(*)::int as count, COALESCE(SUM(e.amount_pence), 0) as total FROM person_expenses e WHERE ${where}`, params);
  const byCat = await query(
    `SELECT e.category, COUNT(*)::int as count, COALESCE(SUM(e.amount_pence), 0) as total
     FROM person_expenses e WHERE ${where} GROUP BY e.category ORDER BY total DESC`,
    params
  );
  const bySu = await query(
    `     SELECT e.person_id, COALESCE(su.first_name || ' ' || su.last_name, 'House funds') as person_name,
            COUNT(*)::int as count, COALESCE(SUM(e.amount_pence), 0) as total
     FROM person_expenses e
     LEFT JOIN people su ON e.person_id = su.id
     WHERE ${where} GROUP BY e.person_id, su.first_name, su.last_name ORDER BY total DESC LIMIT 20`,
    params
  );
  const byLoc = await query(
    `SELECT e.location_id, COALESCE(l.name, 'Unknown') as location_name, COALESCE(SUM(e.amount_pence), 0) as total
     FROM person_expenses e
     LEFT JOIN locations l ON e.location_id = l.id
     WHERE ${where} AND e.location_id IS NOT NULL
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

export async function reconcilePettyCash(orgId: string, userId: string, target: { moneySource: 'house' | 'person'; locationId?: string; personId?: string }, actualBalancePence: number, notes?: string): Promise<{ balance: PettyCashBalance; transaction: PettyCashTransaction }> {
  if (target.moneySource === 'person') {
    if (!target.personId) throw new AppError(400, 'Person is required for person funds');
    const person = await query('SELECT id FROM people WHERE id = $1 AND organization_id = $2', [target.personId, orgId]);
    if (!person.rows.length) throw new AppError(404, 'Person not found');
    const balance = await query(`INSERT INTO person_cash_balances (organization_id, person_id, current_balance_pence) VALUES ($1,$2,0) ON CONFLICT (person_id) DO UPDATE SET person_id = EXCLUDED.person_id RETURNING *`, [orgId, target.personId]);
    const previous = Number(balance.rows[0].current_balance_pence);
    const updated = await query(`UPDATE person_cash_balances SET current_balance_pence = $1, last_reconciled_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *`, [actualBalancePence, balance.rows[0].id]);
    const transaction = await query(`INSERT INTO person_cash_transactions (organization_id, person_id, type, amount_pence, previous_balance_pence, new_balance_pence, notes, performed_by) VALUES ($1,$2,'reconciliation',$3,$4,$5,$6,$7) RETURNING *`, [orgId, target.personId, actualBalancePence - previous, previous, actualBalancePence, notes || null, userId]);
    return { balance: { ...updated.rows[0], money_source: 'person' }, transaction: { ...transaction.rows[0], money_source: 'person' } };
  }
  const locationId = target.locationId;
  if (!locationId) throw new AppError(400, 'Location is required for house funds');
  const loc = await query('SELECT id FROM locations WHERE id = $1 AND organization_id = $2', [locationId, orgId]);
  if (loc.rows.length === 0) throw new AppError(404, 'Location not found');

  const balance = await getOrCreatePettyCashBalance(orgId, locationId);
  const previous = Number(balance.current_balance_pence);

  const updated = await query(
    `UPDATE petty_cash_balances SET current_balance_pence = $1, last_reconciled_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *`,
    [actualBalancePence, balance.id]
  );

  const txn = await query(
    `INSERT INTO petty_cash_transactions (organization_id, location_id, type, amount_pence, previous_balance_pence, new_balance_pence, notes, performed_by)
     VALUES ($1, $2, 'reconciliation', $3, $4, $5, $6, $7) RETURNING *`,
    [orgId, locationId, actualBalancePence - previous, previous, actualBalancePence, notes || null, userId]
  );

  return { balance: updated.rows[0], transaction: txn.rows[0] };
}

export async function dailyCashCheck(orgId: string, userId: string, data: { moneySource: 'house' | 'person'; locationId?: string; personId?: string; expectedBalancePence: number; physicalBalancePence: number; checkDate: string; notes?: string }) {
  if (data.moneySource === 'house' && data.locationId) {
    const loc = await query('SELECT id FROM locations WHERE id = $1 AND organization_id = $2', [data.locationId, orgId]);
    if (!loc.rows.length) throw new AppError(404, 'Location not found');
  } else if (data.moneySource === 'person' && data.personId) {
    const person = await query('SELECT id FROM people WHERE id = $1 AND organization_id = $2', [data.personId, orgId]);
    if (!person.rows.length) throw new AppError(404, 'Person not found');
  }
  const result = await query(`INSERT INTO cash_balance_checks (organization_id, money_source, location_id, person_id, check_date, expected_balance_pence, physical_balance_pence, variance_pence, notes, checked_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [orgId, data.moneySource, data.locationId || null, data.personId || null, data.checkDate, data.expectedBalancePence, data.physicalBalancePence, data.physicalBalancePence - data.expectedBalancePence, data.notes || null, userId]);
  return result.rows[0];
}

export async function getDailyCashChecks(orgId: string, filters: { from?: string; to?: string }) {
  const result = await query(`SELECT c.*, l.name AS location_name, p.first_name || ' ' || p.last_name AS person_name FROM cash_balance_checks c LEFT JOIN locations l ON l.id = c.location_id LEFT JOIN people p ON p.id = c.person_id WHERE c.organization_id = $1 ORDER BY c.check_date DESC, c.created_at DESC`, [orgId]);
  return result.rows;
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
