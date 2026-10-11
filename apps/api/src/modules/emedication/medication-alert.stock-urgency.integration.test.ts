import { describe, it, expect, beforeEach } from 'vitest'
import { migrateQuery } from '../../shared/database'
import { createOrg, createUser, createPerson, createLocation } from '../../test/factories'
import { MedicationAlertService } from './medication-alert.service'

/**
 * The reorder sweep must say how urgent each low line is, not merely that it
 * is low. The sweep computes days_until_empty from the last 28 days of given
 * administrations (the same arithmetic as Mica's stock tool and the daily
 * shift audit), and the queued email must carry that urgency, with the
 * no-usage case honestly stating "no estimate" instead of inventing a number.
 *
 * The email path enqueues into `email_queue`; the browser-URL record is
 * asserted on the queued HTML body itself, which is exactly what the manager
 * will read.
 */

describe('reorder sweep email urgency (days until empty)', () => {
  let orgId: string
  let adminId: string
  let personId: string

  beforeEach(async () => {
    const org = await createOrg()
    orgId = org.id
    // The sweep only runs for organisations with reorder alerts on (and the
    // transaction path gates on the same flag) — testing urgency requires it.
    await migrateQuery(`UPDATE organizations SET reorder_alert_enabled = TRUE WHERE id = $1`, [orgId])
    const admin = await createUser({
      email: `sweep-urgency-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'TestPass123!',
      role: 'ORG_ADMIN',
      organization_id: orgId,
    })
    adminId = admin.id
    // The sweep emails the location manager first, then any manager at that
    // location — give the location this admin as manager so a recipient
    // always resolves.
    const location = await createLocation({ organization_id: orgId, name: 'Urgency House', manager_id: admin.id })
    const person = await createPerson({
      organization_id: orgId,
      first_name: 'Urgency',
      last_name: `Tester${Date.now()}`,
      status: 'active',
      location_id: location.id,
    })
    personId = person.id
  })

  /** Create a MAR record + item + n given doses (2 days ago), then a matching low stock line. */
  const seedLine = async (med: string, dosage: string, doses: number, qty: number, reorderLevel = 20) => {
    const persons = await migrateQuery(`SELECT id FROM people WHERE organization_id = $1 LIMIT 1`, [orgId])
    const personId: string = persons.rows[0].id
    const carerUser = await createUser({
      email: `sweep-carer-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'TestPass123!', role: 'CARE_WORKER', organization_id: orgId,
    })
    const carer = await migrateQuery(
      `INSERT INTO staff_profiles (user_id, first_name, last_name)
       VALUES ($1, 'Sam', 'Onyx') RETURNING id`,
      [carerUser.id],
    )
    const mar = await migrateQuery(
      `INSERT INTO emedication_records (organization_id, person_id, title, start_date, end_date, status, created_by)
       VALUES ($1, $2, 'Urgency MAR', CURRENT_DATE - 10, CURRENT_DATE + 20, 'active', $3) RETURNING id`,
      [orgId, personId, adminId],
    )
    const item = await migrateQuery(
      `INSERT INTO emedication_items (emedication_record_id, name, dosage, unit, route, frequency, is_active)
       VALUES ($1, $2, $3, 'mg', 'oral', 'daily', TRUE) RETURNING id`,
      [mar.rows[0].id, med, dosage],
    )
    if (doses > 0) {
      await migrateQuery(
        `INSERT INTO emedication_administrations (emedication_item_id, staff_id, scheduled_time, status)
         SELECT $1, $2, NOW() - interval '2 days' + ($3 || ' minutes')::interval, 'given'
         FROM generate_series(1, $3::int)`,
        [item.rows[0].id, carer.rows[0].id, String(doses)],
      )
    }
    const stock = await migrateQuery(
      `INSERT INTO emedication_stock (organization_id, medication_name, dosage, unit, quantity, quantity_unit, reorder_level, person_id, status)
       VALUES ($1, $2, $3, 'mg', $4, 'tablet(s)', $6, $5, 'active') RETURNING id, quantity`,
      [orgId, med, dosage, qty, personId, reorderLevel],
    )
    return stock.rows[0]
  }

  const queuedHtml = async (subjectLike: string) => {
    const rows = await migrateQuery(
      `SELECT html_body FROM email_queue WHERE subject LIKE $1 ORDER BY created_at DESC`,
      [`%${subjectLike}%`],
    )
    return rows.rows.map((r: any) => String(r.html_body)).join('\n')
  }

  it('the sweep email says how many days a line has at the seeded rate', async () => {
    // 14 given doses over the window → 0.5/day → qty 7 → 14.0 days.
    const line = await seedLine('AriceptUrg', '5', 14, 7)
    expect(line.id).toBeTruthy()

    await MedicationAlertService.sendStockReorderAlerts()

    const html = await queuedHtml('AriceptUrg')
    expect(html).toContain('7 tablet')
    // The urgency line, from the rate: 14 days, order this week band.
    expect(html).toContain('14 days')
    expect(html).toContain('14 doses in the last 28 days')
  })

  it('writes the ≤3-day and already-out cases distinctly', async () => {
    // qty 1 at 1/day → 1 day (≤3, red, "Order today").
    const fast = await seedLine('FastEmpty', '2', 28, 1)
    // qty 0 → already out, no arithmetic involved.
    const out = await seedLine('ZeroLine', '5', 28, 0)

    await MedicationAlertService.sendStockReorderAlerts()

    const html = await queuedHtml('Stock Reorder Alert —')
    expect(html).toContain('Runs out in about 1 day')
    expect(html).toContain('Order today')
    expect(html).toContain('Already out of stock')
    void fast; void out
  })

  it('reports incoming deliveries and expiry-before-run-out in the reorder email', async () => {
    // 14 doses / 28 days = 0.5/day; qty 7 runs out in 14 days.
    const line = await seedLine('ExpiringPipelineMed', '5', 14, 7)
    await migrateQuery(
      `UPDATE emedication_stock SET expiry_date = CURRENT_DATE + 7 WHERE id = $1`,
      [line.id],
    )
    const delivery = await migrateQuery(
      `INSERT INTO emedication_deliveries (organization_id, person_id, delivery_date, supplier)
       VALUES ($1, $2, CURRENT_DATE + 2, 'Test Pharmacy') RETURNING id`,
      [orgId, personId],
    )
    await migrateQuery(
      `INSERT INTO emedication_delivery_items (delivery_id, medication_name, dosage, unit, quantity, quantity_unit)
       VALUES ($1, 'ExpiringPipelineMed', '5', 'mg', 4, 'tablet(s)')`,
      [delivery.rows[0].id],
    )

    await MedicationAlertService.sendStockReorderAlerts()

    const html = await queuedHtml('ExpiringPipelineMed')
    expect(html).toContain('4 tablets already in the delivery pipeline, due ')
    expect(html).toMatch(/due \d{1,2} \w+ \d{4}/)
    expect(html).toContain('check it arrives before run-out and is sufficient')
    expect(html).toContain('expires in 7 days, before the projected run-out')
    expect(html).toContain('Replacement stock is still needed')
    expect(html).toContain('check it arrives before run-out and is sufficient')
  })

  it('states no estimate when the line had no recent usage, instead of inventing one', async () => {
    await seedLine('QuietMed', '10', 0, 3)

    await MedicationAlertService.sendStockReorderAlerts()

    const html = await queuedHtml('QuietMed')
    expect(html).toContain('No doses given in the last 28 days')
    expect(html).not.toMatch(/lasts about \d+ days/)
  })

  it('the shift-audit low-stock rows carry the same days_until_empty projection', async () => {
    // Directly pin the shared projection the daily audit email reads.
    // 0.25/day rate; qty 21 against reorder 30 keeps the line low so the
    // audit row is returned and the projection is 21 / 0.25 = 84 days.
    await seedLine('AuditMed', '8', 7, 21, 30) // 0.25/day → 84 days
    const { EMedicationRepository } = await import('./emedication.repository')
    const { runWithOrgContext } = await import('../events/events.org-context')
    // The repository runs on the RLS-scoped app pool; it needs the request
    // org context the sweep itself would provide.
    const rows = await runWithOrgContext(orgId, () => EMedicationRepository.getLowStockForOrg(orgId))
    const audit = rows.find((r: any) => r.medication_name === 'AuditMed')
    expect(audit).toBeTruthy()
    expect(Number(audit.days_until_empty)).toBeCloseTo(84, 1)

    // The same projection powers the eMedication Stock tab API response.
    const stockRows = await runWithOrgContext(orgId, () => EMedicationRepository.listStock(orgId))
    const stockRow = stockRows.find((r: any) => r.medication_name === 'AuditMed')
    expect(stockRow).toBeTruthy()
    expect(stockRow.given_28d).toBe(7)
    expect(Number(stockRow.daily_usage)).toBeCloseTo(0.25, 4)
    expect(Number(stockRow.days_until_empty)).toBeCloseTo(84, 1)
  })
})
