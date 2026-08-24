import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createPerson, createLocation, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Expenses â€” CRUD, stats, petty cash', () => {
  it('should create, list, update, delete an expense and top up petty cash', async () => {
    const org = await createOrg()
    const location = await createLocation({ organizationId: org.id })
    const person = await createPerson({ organizationId: org.id })
    const mgr = await createUser({ email: `ex-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const token = generateToken(mgr)

    const created = await request(app)
      .post('/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({ personId: person.id, locationId: location.id, category: 'food', amountPence: 1200, incurredDate: '2026-08-01', description: 'Weekly groceries' })
    expect(created.status).toBe(201)
    expect(created.body.category).toBe('food')

    const houseExpense = await request(app)
      .post('/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({ moneySource: 'house', locationId: location.id, category: 'other', amountPence: 2500, incurredDate: '2026-08-02', description: 'Shared cleaning supplies' })
    expect(houseExpense.status).toBe(201)
    expect(houseExpense.body.money_source).toBe('house')
    expect(houseExpense.body.person_id).toBeNull()

    const list = await request(app)
      .get('/expenses')
      .set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    expect(list.body.some((e: any) => e.id === created.body.id)).toBe(true)

    const stats = await request(app)
      .get('/expenses/stats')
      .set('Authorization', `Bearer ${token}`)
    expect(stats.status).toBe(200)

    const got = await request(app)
      .get(`/expenses/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(got.status).toBe(200)

    const updated = await request(app)
      .patch(`/expenses/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amountPence: 1500 })
    expect(updated.status).toBe(200)

    const topUp = await request(app)
      .post('/expenses/petty-cash/top-up')
      .set('Authorization', `Bearer ${token}`)
      .send({ moneySource: 'house', locationId: location.id, amountPence: 50000, notes: 'Opening float' })
    expect(topUp.status).toBe(201)

    const balances = await request(app)
      .get('/expenses/petty-cash/balances')
      .set('Authorization', `Bearer ${token}`)
    expect(balances.status).toBe(200)

    const transactions = await request(app)
      .get('/expenses/petty-cash/transactions')
      .set('Authorization', `Bearer ${token}`)
    expect(transactions.status).toBe(200)

    const deleted = await request(app)
      .delete(`/expenses/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(deleted.status).toBe(204)
  })

  it('should let a CARE_WORKER list but not create expenses', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const worker = await createUser({ email: `ex2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const token = generateToken(worker)

    const list = await request(app)
      .get('/expenses')
      .set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)

    const res = await request(app)
      .post('/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({ personId: person.id, category: 'food', amountPence: 500, incurredDate: '2026-08-01' })
    expect(res.status).toBe(403)
  })

  it('should reject without auth (401)', async () => {
    const res = await request(app).get('/expenses')
    expect(res.status).toBe(401)
  })
})
