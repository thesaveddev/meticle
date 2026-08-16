import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createPerson, createLocation, createStaffProfile, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('eMedication — MAR records, stock, deliveries, audit', () => {
  it('should create a record, add items, log administrations and view the chart', async () => {
    const org = await createOrg()
    const location = await createLocation({ organizationId: org.id })
    const person = await createPerson({ organizationId: org.id, locationId: location.id })
    const mgr = await createUser({ email: `em-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const worker = await createUser({ email: `em2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    await createStaffProfile({ userId: worker.id, medicationCompetent: true })
    const token = generateToken(mgr)
    const workerToken = generateToken(worker)

    const record = await request(app)
      .post('/emedication/records')
      .set('Authorization', `Bearer ${token}`)
      .send({ person_id: person.id, title: 'August MAR', start_date: '2026-08-01', end_date: '2026-08-31' })
    expect(record.status).toBe(201)
    expect(record.body.person_id).toBe(person.id)

    const item = await request(app)
      .post(`/emedication/records/${record.body.id}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Paracetamol', dosage: '500mg', unit: 'mg', frequency: 'twice daily', route: 'oral' })
    expect(item.status).toBe(201)

    if (item.body.stock_item_id) {
      const stocked = await request(app)
        .patch(`/emedication/stock/${item.body.stock_item_id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: 100 })
      expect(stocked.status).toBe(200)
    }

    const admin = await request(app)
      .post('/emedication/administrations')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ emedication_item_id: item.body.id, scheduled_time: '2026-08-15T08:00:00', status: 'given' })
    expect(admin.status).toBe(201)

    const chart = await request(app)
      .get(`/emedication/records/${record.body.id}/chart`)
      .set('Authorization', `Bearer ${token}`)
    expect(chart.status).toBe(200)

    const list = await request(app)
      .get('/emedication/records')
      .set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    expect(list.body.some((r: any) => r.id === record.body.id)).toBe(true)

    const overdue = await request(app)
      .get('/emedication/overdue')
      .set('Authorization', `Bearer ${token}`)
    expect(overdue.status).toBe(200)

    const auditLogs = await request(app)
      .get('/emedication/audit-logs')
      .set('Authorization', `Bearer ${token}`)
    expect(auditLogs.status).toBe(200)
    expect(auditLogs.body.some((l: any) => l.action === 'create_record')).toBe(true)
  })

  it('should create stock and a delivery as CARE_WORKER', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const worker = await createUser({ email: `em3-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const token = generateToken(worker)

    const stock = await request(app)
      .post('/emedication/stock')
      .set('Authorization', `Bearer ${token}`)
      .send({ medication_name: 'Ibuprofen', dosage: '200mg', unit: 'mg', quantity: 100, reorder_level: 20 })
    expect(stock.status).toBe(201)
    expect(stock.body.medication_name).toBe('Ibuprofen')

    const stockList = await request(app)
      .get('/emedication/stock')
      .set('Authorization', `Bearer ${token}`)
    expect(stockList.status).toBe(200)
    expect(stockList.body.some((s: any) => s.id === stock.body.id)).toBe(true)

    const delivery = await request(app)
      .post('/emedication/deliveries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        person_id: person.id,
        supplier: 'Boots',
        delivery_date: '2026-08-12',
        items: [{ medication_name: 'Ibuprofen', dosage: '200mg', quantity: 50, quantity_unit: 'tablets' }],
      })
    expect(delivery.status).toBe(201)
  })

  it('should reject a CARE_WORKER creating a MAR record (403)', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const worker = await createUser({ email: `em4-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })

    const res = await request(app)
      .post('/emedication/records')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ person_id: person.id, title: 'Nope', start_date: '2026-08-01', end_date: '2026-08-31' })
    expect(res.status).toBe(403)
  })

  it('should reject without auth (401)', async () => {
    const res = await request(app).get('/emedication/records')
    expect(res.status).toBe(401)
  })
})
