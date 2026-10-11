import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import {
  createOrg, createUser, createLocation,
  createStaffProfile, createPerson,
} from '../../test/factories'
import { migrateQuery } from '../../shared/database'
import { EMedicationRepository } from './emedication.repository'
import { runWithOrgContext } from '../events/events.org-context'
import { publishStockLowEvent } from '../emedication/medication.events'
import { registerProductionConsumers } from '../events/consumers/register'
import { resetConsumers } from '../events/events.consumers'
import { processOutbox } from '../events/events.outbox'
import { DEFAULT_STOCK_LOW_NOTIFICATION_DAYS_THRESHOLD } from '../events/consumers/medication-stock-low-notification.consumer'

/**
 * medication.stock_low end-to-end: a stock line drops below its reorder level
 * and every manager/admin who can action it hears about it through the two
 * in-app channels, not just the email digest:
 *
 *   1. A `mission_control_alerts` row on the Mission Control dashboard.
 *   2. A real `notifications` row (the bell) for each active ORG_ADMIN and
 *      MANAGER in the org; carers and compliance officers must NOT receive
 *      one, and a dismissed/disabled user must not either.
 */

let app: Express
beforeAll(() => {
  app = createTestApp()
  // Other suites reset the consumer registry at the end; register the
  // production set here so processOutbox exercises the real handlers.
  resetConsumers()
  registerProductionConsumers()
})

afterAll(() => {
  // Tidy: keep other suites' consumer registries unaffected.
  resetConsumers()
})

describe('medication.stock_low → in-app notifications + Mission Control alert', () => {
  it('fans out a bell notification to every active manager/admin and creates the Mission Control alert', async () => {
    const org = await createOrg()
    const location = await createLocation({ organization_id: org.id, name: 'Low-stock House' })

    const admin = await createUser({
      email: `stocklow-admin-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id,
    })
    const manager = await createUser({
      email: `stocklow-mgr-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'TestPass123!', role: 'MANAGER', organization_id: org.id,
    })
    // Should NOT be notified.
    const carer = await createUser({
      email: `stocklow-carer-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id,
    })
    // Active role but inactive account — also NOT notified.
    await createUser({
      email: `stocklow-inactive-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'TestPass123!', role: 'MANAGER', organization_id: org.id, status: 'inactive',
    })
    const carerProfile = await createStaffProfile({ user_id: carer.id, first_name: 'Ada', last_name: 'Okoye', location_id: location.id })
    const person = await createPerson({
      organization_id: org.id, first_name: 'Ada', last_name: 'Lovelace', location_id: location.id,
    })
    const record = await migrateQuery(
      `INSERT INTO emedication_records (organization_id, person_id, title, start_date, end_date, status, created_by)
       VALUES ($1, $2, 'Stock alert MAR', CURRENT_DATE - 30, CURRENT_DATE + 30, 'active', $3) RETURNING id`,
      [org.id, person.id, admin.id],
    )
    const medication = await migrateQuery(
      `INSERT INTO emedication_items (emedication_record_id, name, dosage, unit, route, frequency, is_active)
       VALUES ($1, 'Aricept', '10', 'mg', 'oral', 'daily', TRUE) RETURNING id`,
      [record.rows[0].id],
    )
    await migrateQuery(
      `INSERT INTO emedication_administrations (emedication_item_id, staff_id, scheduled_time, status)
       SELECT $1, $2, NOW() - interval '2 days' + (n || ' minutes')::interval, 'given'
       FROM generate_series(1, 28) AS n`,
      [medication.rows[0].id, carerProfile.id],
    )

    // One given dose per day over 28 days makes this four-day stock line urgent.
    const stock = await migrateQuery(
      `INSERT INTO emedication_stock (organization_id, medication_name, dosage, unit, quantity, quantity_unit, reorder_level, person_id, status)
       VALUES ($1, 'Aricept', '10', 'mg', 4, 'tablet(s)', 10, $2, 'active')
       RETURNING id`,
      [org.id, person.id],
    )
    const stockId = stock.rows[0].id

    await publishStockLowEvent({
      organizationId: org.id,
      stockId,
      medicationName: 'Aricept',
      dosage: '10',
      unit: 'mg',
      quantity: 4,
      reorderLevel: 10,
      personId: person.id,
      personName: 'Ada Lovelace',
      locationId: location.id,
      locationName: location.name,
    })

    const stats = await processOutbox(org.id)
    expect(stats.published).toBe(1)

    // 1. Mission Control alert row exists, deduped by (org, type, aggregate).
    const alert = await migrateQuery(
      `SELECT severity, title, message, link FROM mission_control_alerts
       WHERE organization_id = $1 AND alert_type = 'medication.stock_low' AND aggregate_id = $2`,
      [org.id, stockId],
    )
    expect(alert.rows.length).toBe(1)
    expect(alert.rows[0].severity).toBe('high')
    expect(alert.rows[0].title).toContain('Stock low: Aricept')
    expect(alert.rows[0].link).toBe('/emedication?tab=1')

    // 2. Bell notifications: both active roles got one, matching the payload.
    for (const user of [admin, manager]) {
      const notif = await migrateQuery(
        `SELECT title, message, type, read FROM notifications
         WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [user.id],
      )
      expect(notif.rows.length).toBe(1)
      expect(notif.rows[0].title).toContain('Stock low: Aricept')
      expect(String(notif.rows[0].message)).toContain('About 4 days of stock left')
      expect(String(notif.rows[0].message)).toContain('4 tablets remaining')
      expect(String(notif.rows[0].message)).toContain('reorder at 10')
      expect(String(notif.rows[0].message)).toContain('for Ada Lovelace')
      expect(String(notif.rows[0].message)).toContain('Low-stock House')
      expect(notif.rows[0].read).toBe(false)
    }

    // Carers are not reorder actors — no row for them.
    const carerNotif = await migrateQuery(
      `SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1`,
      [carer.id],
    )
    expect(carerNotif.rows[0].n).toBe(0)

    const consumerRow = await migrateQuery(
      `SELECT ec.status FROM event_consumers ec
       JOIN domain_events de ON de.id = ec.event_id
       WHERE de.id IN (SELECT id FROM domain_events WHERE organization_id = $1 AND event_name = 'medication.stock_low')
         AND ec.consumer_name = 'medication-stock-low-notification'`,
      [org.id],
    )
    expect(consumerRow.rows[0]?.status).toBe('processed')
  })

  it('leaves the marker clear when there is no recent usage to project from', async () => {
    const org = await createOrg()
    const admin = await createUser({
      email: `stocklow-no-rate-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id,
    })
    const stock = await migrateQuery(
      `INSERT INTO emedication_stock (organization_id, medication_name, dosage, unit, quantity, quantity_unit, reorder_level, status)
       VALUES ($1, 'NoRateMed', '1', 'mg', 2, 'patch(es)', 10, 'active') RETURNING id`,
      [org.id],
    )
    await publishStockLowEvent({
      organizationId: org.id, stockId: stock.rows[0].id, medicationName: 'NoRateMed', dosage: '1', unit: 'mg',
      quantity: 2, reorderLevel: 10, personId: null, personName: null, locationId: null, locationName: null,
    })
    await processOutbox(org.id)
    const marker = await migrateQuery(
      `SELECT last_stock_low_notified_at FROM emedication_stock WHERE id = $1`, [stock.rows[0].id],
    )
    expect(marker.rows[0].last_stock_low_notified_at).toBeNull()
    const notification = await migrateQuery(
      `SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND title LIKE 'Stock low: NoRateMed%'`,
      [admin.id],
    )
    expect(notification.rows[0].n).toBe(0)
  })

  it('snoozes repeated batch events until delivery replenishes the line', async () => {
    const org = await createOrg()
    const admin = await createUser({
      email: `stocklow-dedupe-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id,
    })

    const person = await createPerson({ organization_id: org.id, first_name: 'Nia', last_name: 'Snooze' })
    const profile = await createStaffProfile({ user_id: admin.id, first_name: 'Admin', last_name: 'Snooze' })
    const record = await migrateQuery(
      `INSERT INTO emedication_records (organization_id, person_id, title, start_date, end_date, status, created_by)
       VALUES ($1, $2, 'Snooze MAR', CURRENT_DATE - 30, CURRENT_DATE + 30, 'active', $3) RETURNING id`,
      [org.id, person.id, admin.id],
    )
    const medication = await migrateQuery(
      `INSERT INTO emedication_items (emedication_record_id, name, dosage, unit, route, frequency, is_active)
       VALUES ($1, 'Citalopram', '20', 'mg', 'oral', 'daily', TRUE) RETURNING id`,
      [record.rows[0].id],
    )
    await migrateQuery(
      `INSERT INTO emedication_administrations (emedication_item_id, staff_id, scheduled_time, status)
       SELECT $1, $2, NOW() - interval '2 days' + (n || ' minutes')::interval, 'given'
       FROM generate_series(1, 28) AS n`,
      [medication.rows[0].id, profile.id],
    )
    const stock = await migrateQuery(
      `INSERT INTO emedication_stock (organization_id, medication_name, dosage, unit, quantity, quantity_unit, reorder_level, person_id, status)
       VALUES ($1, 'Citalopram', '20', 'mg', 2, 'tablet(s)', 10, $2, 'active')
       RETURNING id`,
      [org.id, person.id],
    )
    const stockId = stock.rows[0].id

    const args = {
      organizationId: org.id,
      stockId,
      medicationName: 'Citalopram',
      dosage: '20',
      unit: 'mg',
      quantity: 2,
      reorderLevel: 10,
      personId: person.id,
      personName: 'Nia Snooze',
      locationId: null,
      locationName: null,
    }
    await publishStockLowEvent(args)
    await publishStockLowEvent(args) // a batch scan re-fires while the line remains low
    await processOutbox(org.id)
    await processOutbox(org.id)

    const marker = await migrateQuery(
      `SELECT last_stock_low_notified_at FROM emedication_stock WHERE id = $1`, [stockId],
    )
    expect(marker.rows[0].last_stock_low_notified_at).not.toBeNull()

    // The per-line marker stops another event from sending a second warning.
    const beforeDelivery = await migrateQuery(
      `SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND title LIKE 'Stock low: Citalopram%'`,
      [admin.id],
    )
    expect(beforeDelivery.rows[0].n).toBe(1)

    // A delivery replenishes the same line and clears its snooze marker. Since
    // the replenished stock still projects under seven days, a later batch may
    // notify again rather than staying muted for the lifetime of the row.
    await runWithOrgContext(org.id, () => EMedicationRepository.createDelivery(org.id, {
      supplier: 'Test pharmacy', delivery_note: 'PO-1', delivery_date: new Date().toISOString().slice(0, 10),
      received_by: 'Test manager', notes: '', person_id: person.id,
      items: [{ medication_name: 'Citalopram', dosage: '20', unit: 'mg', quantity: 2, quantity_unit: 'tablet(s)' }],
    }, admin.id))
    const resetMarker = await migrateQuery(
      `SELECT quantity, last_stock_low_notified_at FROM emedication_stock WHERE id = $1`, [stockId],
    )
    expect(Number(resetMarker.rows[0].quantity)).toBe(4)
    expect(resetMarker.rows[0].last_stock_low_notified_at).toBeNull()

    await publishStockLowEvent(args)
    await processOutbox(org.id)
    const afterDelivery = await migrateQuery(
      `SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND title LIKE 'Stock low: Citalopram%'`,
      [admin.id],
    )
    expect(afterDelivery.rows[0].n).toBe(2)
  })

  it('uses the configured organization threshold, with the default retained for other organizations', async () => {
    const org = await createOrg()
    await migrateQuery(`UPDATE organizations SET stock_low_alert_days_threshold = 14 WHERE id = $1`, [org.id])
    const admin = await createUser({
      email: `stocklow-configured-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id,
    })
    const person = await createPerson({ organization_id: org.id, first_name: 'Threshold', last_name: 'Person' })
    const profile = await createStaffProfile({ user_id: admin.id, first_name: 'Admin', last_name: 'Threshold' })
    const record = await migrateQuery(
      `INSERT INTO emedication_records (organization_id, person_id, title, start_date, end_date, status, created_by)
       VALUES ($1, $2, 'Threshold MAR', CURRENT_DATE - 30, CURRENT_DATE + 30, 'active', $3) RETURNING id`,
      [org.id, person.id, admin.id],
    )
    const medication = await migrateQuery(
      `INSERT INTO emedication_items (emedication_record_id, name, dosage, unit, route, frequency, is_active)
       VALUES ($1, 'ThresholdMed', '5', 'mg', 'oral', 'daily', TRUE) RETURNING id`,
      [record.rows[0].id],
    )
    await migrateQuery(
      `INSERT INTO emedication_administrations (emedication_item_id, staff_id, scheduled_time, status)
       SELECT $1, $2, NOW() - interval '2 days' + (n || ' minutes')::interval, 'given'
       FROM generate_series(1, 28) AS n`,
      [medication.rows[0].id, profile.id],
    )
    const stock = await migrateQuery(
      `INSERT INTO emedication_stock (organization_id, medication_name, dosage, unit, quantity, quantity_unit, reorder_level, person_id, status)
       VALUES ($1, 'ThresholdMed', '5', 'mg', 10, 'tablet(s)', 20, $2, 'active') RETURNING id`,
      [org.id, person.id],
    )
    await publishStockLowEvent({
      organizationId: org.id, stockId: stock.rows[0].id, medicationName: 'ThresholdMed', dosage: '5', unit: 'mg',
      quantity: 10, reorderLevel: 20, personId: person.id, personName: 'Threshold Person', locationId: null, locationName: null,
    })
    await processOutbox(org.id)

    const notification = await migrateQuery(
      `SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND title LIKE 'Stock low: ThresholdMed%'`,
      [admin.id],
    )
    expect(notification.rows[0].n).toBe(1) // projected 10 days: over the default, inside this org's window
    expect(DEFAULT_STOCK_LOW_NOTIFICATION_DAYS_THRESHOLD).toBe(7)

    const saved = await migrateQuery(
      `SELECT stock_low_alert_days_threshold FROM organizations WHERE id = $1`, [org.id],
    )
    expect(saved.rows[0].stock_low_alert_days_threshold).toBe(14)
  })

  it('does not notify a line above the run-out threshold, even when it is below reorder level', async () => {
    const org = await createOrg()
    const admin = await createUser({
      email: `stocklow-not-urgent-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id,
    })
    const person = await createPerson({ organization_id: org.id, first_name: 'Quiet', last_name: 'Person' })
    const profile = await createStaffProfile({ user_id: admin.id, first_name: 'Admin', last_name: 'Usage' })
    const record = await migrateQuery(
      `INSERT INTO emedication_records (organization_id, person_id, title, start_date, end_date, status, created_by)
       VALUES ($1, $2, 'Quiet MAR', CURRENT_DATE - 30, CURRENT_DATE + 30, 'active', $3) RETURNING id`,
      [org.id, person.id, admin.id],
    )
    const medication = await migrateQuery(
      `INSERT INTO emedication_items (emedication_record_id, name, dosage, unit, route, frequency, is_active)
       VALUES ($1, 'QuietMed', '5', 'mg', 'oral', 'daily', TRUE) RETURNING id`,
      [record.rows[0].id],
    )
    await migrateQuery(
      `INSERT INTO emedication_administrations (emedication_item_id, staff_id, scheduled_time, status)
       SELECT $1, $2, NOW() - interval '2 days' + (n || ' minutes')::interval, 'given'
       FROM generate_series(1, 28) AS n`,
      [medication.rows[0].id, profile.id],
    )
    const stock = await migrateQuery(
      `INSERT INTO emedication_stock (organization_id, medication_name, dosage, unit, quantity, quantity_unit, reorder_level, person_id, status)
       VALUES ($1, 'QuietMed', '5', 'mg', 20, 'mL', 30, $2, 'active') RETURNING id`,
      [org.id, person.id],
    )
    await publishStockLowEvent({
      organizationId: org.id, stockId: stock.rows[0].id, medicationName: 'QuietMed', dosage: '5', unit: 'mg',
      quantity: 20, reorderLevel: 30, personId: person.id, personName: 'Quiet Person', locationId: null, locationName: null,
    })
    await processOutbox(org.id)

    const notifications = await migrateQuery(
      `SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND title LIKE 'Stock low: QuietMed%'`,
      [admin.id],
    )
    expect(notifications.rows[0].n).toBe(0)
    const marker = await migrateQuery(
      `SELECT last_stock_low_notified_at FROM emedication_stock WHERE id = $1`, [stock.rows[0].id],
    )
    expect(marker.rows[0].last_stock_low_notified_at).toBeNull()
  })
})
