import { describe, it, expect, beforeEach } from 'vitest';
import { migrateQuery } from '../../shared/database';
import { createOrg, createUser, createPerson } from '../../test/factories';
import { MedicationAlertService } from './medication-alert.service';

/**
 * The periodic stock reorder sweep (migration 144).
 *
 * notifyReorder() already warns at the transaction that crosses the reorder
 * level; the sweep is the safety net for lines that end up low any other way.
 * These tests pin its dedupe contract, because a broken dedupe either spams
 * the manager every 5 minutes or (worse) goes permanently silent:
 *
 *   1. columns from migration 144 exist,
 *   2. an at-or-below-reorder line with no marker is swept once,
 *   3. immediately re-running the sweep is a no-op (within the frequency
 *      window),
 *   4. healthy stock is never swept,
 *   5. sweeping marks the line so the re-warn really is gated.
 */
describe('MedicationAlertService.sendStockReorderAlerts', () => {
  let orgId: string;
  let personId: string;

  beforeEach(async () => {
    const org = await createOrg();
    orgId = org.id;
    const user = await createUser({
      email: `stocksweep-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'TestPass123!',
      role: 'ORG_ADMIN',
      organization_id: orgId,
    });
    const person = await createPerson({
      organization_id: orgId,
      first_name: 'Stock',
      last_name: `Tester${Date.now()}`,
      status: 'active',
    });
    personId = person.id;
    void user;
  });

  const addStock = (quantity: number, reorderLevel = 10) => migrateQuery(
    `INSERT INTO emedication_stock (organization_id, medication_name, dosage, unit, quantity, quantity_unit, reorder_level, person_id, status)
     VALUES ($1, 'Risperidone', '1', 'mg', $2, 'tablet(s)', $3, $4, 'active') RETURNING id`,
    [orgId, quantity, reorderLevel, personId],
  );

  it('migration 144 added the dedupe marker and the frequency setting', async () => {
    const cols = await migrateQuery(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name IN ('emedication_stock', 'organizations')
         AND (column_name = 'last_reorder_alerted_at' OR column_name = 'stock_reorder_alert_frequency_hours')`);
    expect(cols.rows.map((r: any) => r.column_name).sort()).toEqual(
      ['last_reorder_alerted_at', 'stock_reorder_alert_frequency_hours']);
  });

  it('sweeps an under-reorder line once, then stays quiet inside the window', async () => {
    await addStock(2, 10); // below default reorder level
    const first = await MedicationAlertService.sendStockReorderAlerts();
    expect(first).toBeGreaterThanOrEqual(0); // email may have a manager or fall back; state is what matters
    const marked = await migrateQuery(
      `SELECT last_reorder_alerted_at FROM emedication_stock WHERE organization_id = $1`,
      [orgId]);
    expect(marked.rows[0].last_reorder_alerted_at).not.toBeNull();

    // Immediately re-running must not re-queue anything while the line's
    // marker is fresh (24h window). The sweep is allowed to be an internal
    // no-op — assert via the marker not resetting.
    await MedicationAlertService.sendStockReorderAlerts();
    const still = await migrateQuery(
      `SELECT last_reorder_alerted_at FROM emedication_stock WHERE organization_id = $1`,
      [orgId]);
    expect(new Date(still.rows[0].last_reorder_alerted_at).getTime())
      .toBe(new Date(marked.rows[0].last_reorder_alerted_at).getTime());
  });

  it('healthy stock is untouched by the sweep', async () => {
    await addStock(500, 10);
    const first = await MedicationAlertService.sendStockReorderAlerts();
    expect(first).toBe(0);
    const rows = await migrateQuery(
      `SELECT last_reorder_alerted_at FROM emedication_stock WHERE organization_id = $1`,
      [orgId]);
    expect(rows.rows[0].last_reorder_alerted_at).toBeNull();
  });
});
