import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createStaffProfile, createPerson, createLocation, generateToken } from '../../test/factories'

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
      .send({ description: 'Updated groceries' })
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

    const voided = await request(app)
      .put(`/expenses/${created.body.id}/void`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Test void - duplicate entry' })
    expect(voided.status).toBe(200)
    expect(voided.body.is_voided).toBe(true)
  })

  it('requires a different staff member to accept a cash check and records the acceptance', async () => {
    const org = await createOrg()
    const location = await createLocation({ organizationId: org.id })
    const counter = await createUser({ email: `cash-counter-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const confirmer = await createUser({ email: `cash-confirmer-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    await createStaffProfile({ userId: counter.id, firstName: 'Cash', lastName: 'Counter' })
    await createStaffProfile({ userId: confirmer.id, firstName: 'Cash', lastName: 'Confirmer' })
    const counterToken = generateToken(counter)
    const confirmerToken = generateToken(confirmer)

    const created = await request(app)
      .post('/expenses/petty-cash/daily-check')
      .set('Authorization', `Bearer ${counterToken}`)
      .send({
        moneySource: 'house',
        locationId: location.id,
        expectedBalancePence: 10000,
        physicalBalancePence: 10000,
        checkDate: '2026-08-01',
        notes: 'Two-person count',
        handedOverTo: confirmer.id,
      })
    expect(created.status).toBe(201)
    expect(created.body.counted_by).toBe(counter.id)
    expect(created.body.handed_over_to).toBe(confirmer.id)
    expect(created.body.accepted_at).toBeNull()

    const selfAssigned = await request(app)
      .post('/expenses/petty-cash/daily-check')
      .set('Authorization', `Bearer ${counterToken}`)
      .send({
        moneySource: 'house',
        locationId: location.id,
        expectedBalancePence: 10000,
        physicalBalancePence: 10000,
        checkDate: '2026-08-01',
        handedOverTo: counter.id,
      })
    expect(selfAssigned.status).toBe(400)

    const accepted = await request(app)
      .post(`/expenses/petty-cash/daily-checks/${created.body.id}/accept`)
      .set('Authorization', `Bearer ${confirmerToken}`)
    expect(accepted.status).toBe(200)
    expect(accepted.body.accepted_by).toBe(confirmer.id)
    expect(accepted.body.accepted_at).toBeTruthy()

    const duplicate = await request(app)
      .post(`/expenses/petty-cash/daily-checks/${created.body.id}/accept`)
      .set('Authorization', `Bearer ${confirmerToken}`)
    expect(duplicate.status).toBe(409)
  })

  it('keeps reconciliation pending until the assigned second person approves it', async () => {
    const org = await createOrg()
    const location = await createLocation({ organizationId: org.id })
    const requester = await createUser({ email: `recon-requester-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const reviewer = await createUser({ email: `recon-reviewer-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const requesterToken = generateToken(requester)
    const reviewerToken = generateToken(reviewer)

    const topUp = await request(app)
      .post('/expenses/petty-cash/top-up')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ moneySource: 'house', locationId: location.id, amountPence: 10000 })
    expect(topUp.status).toBe(201)

    const submitted = await request(app)
      .post('/expenses/petty-cash/reconcile')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ moneySource: 'house', locationId: location.id, actualBalancePence: 8500, handedOverTo: reviewer.id, notes: 'Counted cash after close' })
    expect(submitted.status).toBe(201)
    expect(submitted.body.status).toBe('pending')
    expect(submitted.body.expected_balance_pence).toBe(10000)
    expect(submitted.body.variance_pence).toBe(-1500)

    const beforeApproval = await request(app)
      .get('/expenses/petty-cash/balances')
      .set('Authorization', `Bearer ${requesterToken}`)
    expect(beforeApproval.body.find((b: any) => b.location_id === location.id).current_balance_pence).toBe(10000)

    const selfReview = await request(app)
      .post(`/expenses/petty-cash/reconciliations/${submitted.body.id}/review`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ decision: 'accepted' })
    expect(selfReview.status).toBe(403)

    const accepted = await request(app)
      .post(`/expenses/petty-cash/reconciliations/${submitted.body.id}/review`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ decision: 'accepted' })
    expect(accepted.status).toBe(200)
    expect(accepted.body.request.status).toBe('accepted')
    expect(accepted.body.balance.current_balance_pence).toBe(8500)

    const duplicate = await request(app)
      .post(`/expenses/petty-cash/reconciliations/${submitted.body.id}/review`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ decision: 'accepted' })
    expect(duplicate.status).toBe(409)
  })

  it('requires a reason and leaves the balance unchanged when a reconciliation is rejected', async () => {
    const org = await createOrg()
    const location = await createLocation({ organizationId: org.id })
    const requester = await createUser({ email: `recon-reject-requester-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const reviewer = await createUser({ email: `recon-reject-reviewer-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const requesterToken = generateToken(requester)
    const reviewerToken = generateToken(reviewer)

    await request(app)
      .post('/expenses/petty-cash/top-up')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ moneySource: 'house', locationId: location.id, amountPence: 5000 })
    const submitted = await request(app)
      .post('/expenses/petty-cash/reconcile')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ moneySource: 'house', locationId: location.id, actualBalancePence: 4500, handedOverTo: reviewer.id })

    const noReason = await request(app)
      .post(`/expenses/petty-cash/reconciliations/${submitted.body.id}/review`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ decision: 'rejected' })
    expect(noReason.status).toBe(400)

    const rejected = await request(app)
      .post(`/expenses/petty-cash/reconciliations/${submitted.body.id}/review`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ decision: 'rejected', rejectionReason: 'Cash count needs to be repeated' })
    expect(rejected.status).toBe(200)
    expect(rejected.body.status).toBe('rejected')

    const balance = await request(app)
      .get('/expenses/petty-cash/balances')
      .set('Authorization', `Bearer ${requesterToken}`)
    expect(balance.body.find((b: any) => b.location_id === location.id).current_balance_pence).toBe(5000)
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
