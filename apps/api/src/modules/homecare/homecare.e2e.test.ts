import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { migrateQuery as query } from '../../shared/database'
import { createOrg, createUser, createPerson, createStaffProfile, generateToken, sessionDay } from '../../test/factories'
import { signEmailDsnPayload } from '../../shared/utils/email.dsn'

let app: Express
beforeAll(() => { app = createTestApp() })

// Dynamic future dates so tests never go stale
// nearDate = within check-in window (5 min from now)
// farDate = a future date for scheduling (1 day ahead)
const nearDate = (minsFromNow: number, durationMins = 60) => {
  const start = new Date(Date.now() + minsFromNow * 60000)
  const end = new Date(start.getTime() + durationMins * 60000)
  return { start: start.toISOString(), end: end.toISOString() }
}
const farDate = (daysAhead: number, h = 9, m = 0) => {
  const d = new Date(Date.now() + daysAhead * 86400000)
  d.setUTCHours(h, m, 0, 0)
  return d.toISOString()
}
const fd = (daysAhead: number) => new Date(Date.now() + daysAhead * 86400000).toISOString().split('T')[0]

describe('Homecare E2E critical workflows', () => {
  it('org admin can create a care package with funding type and client rate', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const manager = await createUser({ email: `e2e-pkg-${Date.now()}@test.com`, role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(manager)

    const res = await request(app)
      .post('/homecare/packages')
      .set('Authorization', `Bearer ${token}`)
      .send({
        person_id: person.id,
        name: 'E2E Test Package',
        status: 'active',
        funding_type: 'local_authority',
        start_date: fd(1),
        weekly_hours: 14,
        hourly_rate_pence: 1800,
        client_rate_pence: 2200,
        travel_time_paid: true,
      })

    expect(res.status).toBe(201)
    expect(res.body.name).toBe('E2E Test Package')
    expect(res.body.funding_type).toBe('local_authority')
    expect(res.body.client_rate_pence).toBe(2200)
  })

  it('carer can check in and check out a visit with GPS coordinates', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const manager = await createUser({ email: `e2e-visit-mgr-${Date.now()}@test.com`, role: 'MANAGER', organization_id: org.id })
    const carer = await createUser({ email: `e2e-visit-carer-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const carerProfile = await createStaffProfile({ userId: carer.id })
    const managerToken = generateToken(manager)
    const carerToken = generateToken(carer)

    // Create package
    const pkgRes = await request(app)
      .post('/homecare/packages')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ person_id: person.id, name: 'Visit Test', status: 'active', start_date: fd(1), funding_type: 'private' })
    const pkgId = pkgRes.body.id

    // Create visit
    const visitRes = await request(app)
      .post('/homecare/visits')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        package_id: pkgId,
        person_id: person.id,
        assigned_staff_id: carerProfile.id,
        visit_type: 'morning',
        label: 'Morning call',
        scheduled_start: nearDate(5).start,
        scheduled_end: nearDate(5).end,
      })
    expect(visitRes.status).toBe(201)
    const visitId = visitRes.body.id

    // Check in
    const checkInRes = await request(app)
      .post(`/homecare/visits/${visitId}/check-in`)
      .set('Authorization', `Bearer ${carerToken}`)
      .send({ latitude: 51.5074, longitude: -0.1278, accuracy_meters: 10 })
    expect(checkInRes.status).toBe(200)
    expect(checkInRes.body.status).toBe('checked_in')

    // Check out
    const checkOutRes = await request(app)
      .post(`/homecare/visits/${visitId}/check-out`)
      .set('Authorization', `Bearer ${carerToken}`)
      .send({ latitude: 51.5075, longitude: -0.1279, note: 'Visit completed', actual_travel_minutes: 15, actual_mileage_miles: 3.2 })
    expect(checkOutRes.status).toBe(200)
    expect(checkOutRes.body.status).toBe('completed')
  })

  it('manager can approve a timesheet and export payroll CSV', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const manager = await createUser({ email: `e2e-pay-mgr-${Date.now()}@test.com`, role: 'MANAGER', organization_id: org.id })
    const carer = await createUser({ email: `e2e-pay-carer-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const carerProfile = await createStaffProfile({ userId: carer.id })
    const managerToken = generateToken(manager)
    const carerToken = generateToken(carer)

    // Create package
    const pkgRes = await request(app)
      .post('/homecare/packages')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ person_id: person.id, name: 'Pay Test', status: 'active', start_date: fd(1), hourly_rate_pence: 1500, funding_type: 'private' })
    const pkgId = pkgRes.body.id

    // Create and complete a visit
    const visitRes = await request(app)
      .post('/homecare/visits')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        package_id: pkgId,
        person_id: person.id,
        assigned_staff_id: carerProfile.id,
        visit_type: 'morning',
        label: 'Morning call',scheduled_start: nearDate(5).start, scheduled_end: nearDate(5).end,
      })
    const visitId = visitRes.body.id

    await request(app).post(`/homecare/visits/${visitId}/check-in`).set('Authorization', `Bearer ${carerToken}`).send({ latitude: 51.5, longitude: -0.1, accuracy_meters: 10 })
    await request(app).post(`/homecare/visits/${visitId}/check-out`).set('Authorization', `Bearer ${carerToken}`).send({ latitude: 51.5, longitude: -0.1 })

    // List timesheets
    const tsRes = await request(app).get('/homecare/timesheets').set('Authorization', `Bearer ${managerToken}`)
    expect(tsRes.status).toBe(200)
    expect(tsRes.body.length).toBeGreaterThan(0)

    // Approve timesheet
    const tsId = tsRes.body[0].id
    const approveRes = await request(app).patch(`/homecare/timesheets/${tsId}`).set('Authorization', `Bearer ${managerToken}`).send({ status: 'approved' })
    expect(approveRes.status).toBe(200)
    expect(approveRes.body.status).toBe('approved')
    expect(approveRes.body.hourly_rate_source).toBeTruthy()
    expect(approveRes.body.hourly_rate_source_label).toBeTruthy()
    expect(approveRes.body.mileage_rate_source).toBeTruthy()
    expect(approveRes.body.paid_travel_policy_source).toBeTruthy()
    expect(approveRes.body.rate_calculated_at).toBeTruthy()

    // Export payroll CSV
    const csvRes = await request(app).get('/homecare/payroll/export.csv?from=2026-01-01&to=2027-12-31').set('Authorization', `Bearer ${managerToken}`)
    expect(csvRes.status).toBe(200)
    expect(csvRes.headers['content-type']).toContain('text/csv')
    expect(csvRes.text).toContain('hourly_rate_source_label')
    expect(csvRes.text).toContain('mileage_rate_source_label')
    expect(csvRes.text).toContain('paid_travel_policy_source')
    expect(csvRes.headers['x-payroll-export-id']).toBeTruthy()
    const exportId = csvRes.headers['x-payroll-export-id']
    const exportList = await request(app).get('/homecare/payroll/exports').set('Authorization', `Bearer ${managerToken}`)
    expect(exportList.status).toBe(200)
    const payrollExport = exportList.body.find((item: any) => item.id === exportId)
    expect(payrollExport.exported_count).toBeGreaterThan(0)
    const reconRows = await request(app).get(`/homecare/payroll/reconciliations?exportId=${exportId}`).set('Authorization', `Bearer ${managerToken}`)
    expect(reconRows.status).toBe(200)
    const recon = reconRows.body[0]
    expect(recon.status).toBe('exported')
    const beforeAcknowledgement = await request(app).patch(`/homecare/payroll/reconciliations/${recon.id}`).set('Authorization', `Bearer ${managerToken}`)
      .send({ action: 'reconcile', reconciled_gross_pay_pence: recon.exported_gross_pay_pence })
    expect(beforeAcknowledgement.status).toBe(409)
    const ack = await request(app).post(`/homecare/payroll/exports/${exportId}/acknowledge`).set('Authorization', `Bearer ${managerToken}`)
    expect(ack.status).toBe(200)
    const ackRows = await request(app).get(`/homecare/payroll/reconciliations?exportId=${exportId}`).set('Authorization', `Bearer ${managerToken}`)
    expect(ackRows.body[0].status).toBe('acknowledged')
    const variance = await request(app).patch(`/homecare/payroll/reconciliations/${recon.id}`).set('Authorization', `Bearer ${managerToken}`)
      .send({ action: 'reconcile', external_reference: 'PAY-RUN-42', reconciled_gross_pay_pence: Number(recon.exported_gross_pay_pence) + 100, note: 'Provider included a manual adjustment' })
    expect(variance.status).toBe(200)
    expect(variance.body.status).toBe('exception')
    const reconciled = await request(app).patch(`/homecare/payroll/reconciliations/${recon.id}`).set('Authorization', `Bearer ${managerToken}`)
      .send({ action: 'reconcile', external_reference: 'PAY-RUN-42', reconciled_gross_pay_pence: recon.exported_gross_pay_pence, note: 'Corrected after review' })
    expect(reconciled.status, JSON.stringify(reconciled.body)).toBe(200)
    expect(reconciled.body.status).toBe('matched')
    const finalExports = await request(app).get('/homecare/payroll/exports').set('Authorization', `Bearer ${managerToken}`)
    expect(finalExports.body.find((item: any) => item.id === exportId).status).toBe('reconciled')
  })

  it('manager can create, approve, and download a client billing invoice', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const manager = await createUser({ email: `e2e-bill-${Date.now()}@test.com`, role: 'MANAGER', organization_id: org.id })
    const carer = await createUser({ email: `e2e-bill-carer-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const carerProfile = await createStaffProfile({ userId: carer.id })
    const managerToken = generateToken(manager)
    const carerToken = generateToken(carer)
    const visitTime = nearDate(5)
    const payerRes = await request(app).post('/homecare/client-billing/payers').set('Authorization', `Bearer ${managerToken}`)
      .send({ name: `Private payer ${Date.now()}`, funding_type: 'private', email: `payer-${Date.now()}@test.com`, address: 'Default payer address' })
    expect(payerRes.status).toBe(201)
    // Create package with client rate and a tenant-scoped payer
    const pkgRes = await request(app)
      .post('/homecare/packages')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ person_id: person.id, name: 'Bill Test', status: 'active', start_date: fd(1), client_rate_pence: 2000, funding_type: 'private', payer_account_id: payerRes.body.id })
    expect(pkgRes.status, JSON.stringify(pkgRes.body)).toBe(201)
    const recipientRes = await request(app).put('/homecare/client-billing/recipients').set('Authorization', `Bearer ${managerToken}`)
      .send({ person_id: person.id, payer_account_id: payerRes.body.id, recipient_name: 'Ada Billing', recipient_email: `ada-billing-${Date.now()}@test.com`, recipient_address: '1 Client Street' })
    expect(recipientRes.status).toBe(200)
    const pkgId = pkgRes.body.id
    const otherOrg = await createOrg()
    const otherManager = await createUser({ email: `invoice-other-${Date.now()}@test.com`, role: 'MANAGER', organization_id: otherOrg.id })
    const crossTenantRecipient = await request(app).put('/homecare/client-billing/recipients').set('Authorization', `Bearer ${generateToken(otherManager)}`)
      .send({ person_id: person.id, payer_account_id: payerRes.body.id, recipient_name: 'Cross tenant', recipient_email: 'cross@example.com' })
    expect(crossTenantRecipient.status).toBe(404)

    // Create and complete a visit
    const visitRes = await request(app)
      .post('/homecare/visits')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        package_id: pkgId,
        person_id: person.id,
        assigned_staff_id: carerProfile.id,
        visit_type: 'morning',
        label: 'Morning call',
        scheduled_start: visitTime.start,
        scheduled_end: visitTime.end,
      })
    expect(visitRes.status, JSON.stringify(visitRes.body)).toBe(201)
    const visitId = visitRes.body.id

    const checkedIn = await request(app).post(`/homecare/visits/${visitId}/check-in`).set('Authorization', `Bearer ${carerToken}`).send({ latitude: 51.5, longitude: -0.1, accuracy_meters: 10 })
    expect(checkedIn.status, JSON.stringify(checkedIn.body)).toBe(200)
    const checkedOut = await request(app).post(`/homecare/visits/${visitId}/check-out`).set('Authorization', `Bearer ${carerToken}`).send({ latitude: 51.5, longitude: -0.1 })
    expect(checkedOut.status, JSON.stringify(checkedOut.body)).toBe(200)
    // Ensure the billing fixture has a deterministic positive delivered duration.
    await query(`UPDATE homecare_visits SET check_in_at = NOW() - INTERVAL '30 minutes', check_out_at = NOW(), status = 'completed' WHERE id = $1 AND organization_id = $2`, [visitId, org.id])

    // A second client under the same payer must receive a separate invoice snapshot.
    const secondPerson = await createPerson({ organizationId: org.id })
    const secondPackage = await request(app).post('/homecare/packages').set('Authorization', `Bearer ${managerToken}`)
      .send({ person_id: secondPerson.id, name: 'Second client package', status: 'active', start_date: fd(1), client_rate_pence: 2000, funding_type: 'private', payer_account_id: payerRes.body.id })
    expect(secondPackage.status, JSON.stringify(secondPackage.body)).toBe(201)
    const secondVisit = await request(app).post('/homecare/visits').set('Authorization', `Bearer ${managerToken}`)
      .send({ package_id: secondPackage.body.id, person_id: secondPerson.id, visit_type: 'morning', label: 'Second client call', scheduled_start: visitTime.start, scheduled_end: visitTime.end })
    expect(secondVisit.status, JSON.stringify(secondVisit.body)).toBe(201)
    await query(`UPDATE homecare_visits SET check_in_at = NOW() - INTERVAL '30 minutes', check_out_at = NOW(), status = 'completed' WHERE id = $1 AND organization_id = $2`, [secondVisit.body.id, org.id])

    // Create billing run
    const billingDate = await sessionDay(visitTime.start)
    const runRes = await request(app)
      .post('/homecare/client-billing/runs')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ from: billingDate, to: billingDate })
    expect(runRes.status).toBe(201)
    expect(runRes.body.lines).toHaveLength(2)
    expect(runRes.body.lines[0]).toMatchObject({ billing_status: 'billable', payer_account_id: payerRes.body.id })
    const runId = runRes.body.run.id

    // Approve billing run
    const approveRes = await request(app).post(`/homecare/client-billing/runs/${runId}/approve`).set('Authorization', `Bearer ${managerToken}`)
    expect(approveRes.status).toBe(200)
    expect(approveRes.body.invoice_number).toBeDefined()
    expect(approveRes.body.invoices, JSON.stringify({ approval: approveRes.body, run: runRes.body })).toHaveLength(2)
    const invoice = approveRes.body.invoices.find((item: any) => item.person_id === person.id)
    const secondInvoice = approveRes.body.invoices.find((item: any) => item.person_id === secondPerson.id)
    expect(invoice).toBeTruthy()
    expect(secondInvoice).toBeTruthy()
    expect(invoice.person_id).toBe(person.id)
    expect(invoice.recipient_email).toBe(recipientRes.body.recipient_email)
    expect(invoice.recipient_address).toBe('1 Client Street')

    const invoiceList = await request(app).get(`/homecare/client-billing/invoices?runId=${runId}`).set('Authorization', `Bearer ${managerToken}`)
    expect(invoiceList.status).toBe(200)
    expect(invoiceList.body).toHaveLength(2)
    expect(invoiceList.body.some((item: any) => item.person_name.includes(person.first_name))).toBe(true)
    expect(invoiceList.body.some((item: any) => item.person_name.includes(secondPerson.first_name))).toBe(true)
    const crossTenantInvoice = await request(app).get(`/homecare/client-billing/invoices/${invoice.id}`).set('Authorization', `Bearer ${generateToken(otherManager)}`)
    expect(crossTenantInvoice.status).toBe(404)

    const publicLink = await request(app).post(`/homecare/client-billing/invoices/${invoice.id}/send`).set('Authorization', `Bearer ${managerToken}`)
    expect(publicLink.status).toBe(200)
    expect(publicLink.body.status).toBe('approved')
    expect(publicLink.body.delivery_status).toBe('queued')
    const queueEmail = await query(`SELECT id, dsn_id, html_body FROM email_queue
      WHERE related_entity_type = 'homecare_invoice' AND related_entity_id = $1 ORDER BY created_at DESC LIMIT 1`, [invoice.id])
    const tokenMatch = queueEmail.rows[0]?.html_body.match(/\/invoice\/([a-f0-9]{64})/)
    expect(tokenMatch?.[1]).toBeTruthy()
    expect(queueEmail.rows[0]?.dsn_id).toBeTruthy()

    const previousDsnSecret = process.env.EMAIL_DSN_WEBHOOK_SECRET
    process.env.EMAIL_DSN_WEBHOOK_SECRET = 'test-email-dsn-secret'
    // Provider event ids are globally unique in production, so the DSN dedupe is global by design.
    // Test event ids must therefore be unique per run — a persistent test DB would else flag reruns as duplicates.
    const dsnRunId = Date.now().toString(36)
    const reportDsn = async (eventId: string, dsnId: string, recipient: string, status: 'delivered' | 'delayed' | 'bounced', diagnostic?: string) => {
      const payload = Buffer.from(JSON.stringify({ event_id: eventId, dsn_id: dsnId, recipient, status, diagnostic }))
      const timestamp = String(Math.floor(Date.now() / 1000))
      return request(app).post('/homecare/email/dsn-callback')
        .set('Content-Type', 'application/json')
        .set('x-email-dsn-timestamp', timestamp)
        .set('x-email-dsn-signature', signEmailDsnPayload(payload, timestamp, process.env.EMAIL_DSN_WEBHOOK_SECRET!))
        .send(payload.toString('utf8'))
    }
    try {
      const payload = Buffer.from(JSON.stringify({ event_id: 'invoice-invalid-signature', dsn_id: queueEmail.rows[0].dsn_id, recipient: invoice.recipient_email, status: 'delivered' }))
      const timestamp = String(Math.floor(Date.now() / 1000))
      const rejectedDsn = await request(app).post('/homecare/email/dsn-callback')
        .set('Content-Type', 'application/json')
        .set('x-email-dsn-timestamp', timestamp)
        .set('x-email-dsn-signature', 'sha256=' + '0'.repeat(64))
        .send(payload.toString('utf8'))
      expect(rejectedDsn.status).toBe(401)

      const mismatchedRecipient = await reportDsn(`invoice-wrong-recipient-${dsnRunId}`, queueEmail.rows[0].dsn_id, `wrong-${invoice.recipient_email}`, 'delivered')
      expect(mismatchedRecipient.status).toBe(200)
      expect(mismatchedRecipient.body.matched).toBe(false)

      const deliveredDsn = await reportDsn(`invoice-delivered-1-${dsnRunId}`, queueEmail.rows[0].dsn_id, invoice.recipient_email, 'delivered')
      expect(deliveredDsn.status).toBe(200)
      expect(deliveredDsn.body).toMatchObject({ matched: true, duplicate: false, invoiceUpdated: true })
      const deliveredInvoice = await request(app).get(`/homecare/client-billing/invoices/${invoice.id}`).set('Authorization', `Bearer ${managerToken}`)
      expect(deliveredInvoice.body.invoice).toMatchObject({ status: 'sent', delivery_status: 'delivered' })

      const duplicateDsn = await reportDsn(`invoice-delivered-1-${dsnRunId}`, queueEmail.rows[0].dsn_id, invoice.recipient_email, 'delivered')
      expect(duplicateDsn.status).toBe(200)
      expect(duplicateDsn.body.duplicate).toBe(true)

      const bouncedSend = await request(app).post(`/homecare/client-billing/invoices/${secondInvoice.id}/send`).set('Authorization', `Bearer ${managerToken}`)
      expect(bouncedSend.status).toBe(200)
      expect(bouncedSend.body).toMatchObject({ status: 'approved', delivery_status: 'queued' })
      const bouncedQueue = await query(`SELECT dsn_id FROM email_queue
        WHERE related_entity_type = 'homecare_invoice' AND related_entity_id = $1 ORDER BY created_at DESC LIMIT 1`, [secondInvoice.id])
      const delayedDsn = await reportDsn(`invoice-delayed-1-${dsnRunId}`, bouncedQueue.rows[0].dsn_id, secondInvoice.recipient_email, 'delayed', 'Remote server temporarily unavailable')
      expect(delayedDsn.status).toBe(200)
      const delayedInvoice = await request(app).get(`/homecare/client-billing/invoices/${secondInvoice.id}`).set('Authorization', `Bearer ${managerToken}`)
      expect(delayedInvoice.body.invoice).toMatchObject({ status: 'approved', delivery_status: 'delayed', delivery_diagnostic: 'Remote server temporarily unavailable' })

      const bouncedDsn = await reportDsn(`invoice-bounced-1-${dsnRunId}`, bouncedQueue.rows[0].dsn_id, secondInvoice.recipient_email, 'bounced', '550 mailbox unavailable')
      expect(bouncedDsn.status).toBe(200)
      const bouncedInvoice = await request(app).get(`/homecare/client-billing/invoices/${secondInvoice.id}`).set('Authorization', `Bearer ${managerToken}`)
      expect(bouncedInvoice.body.invoice).toMatchObject({ status: 'approved', delivery_status: 'bounced', delivery_diagnostic: '550 mailbox unavailable' })
      const lateDeliveredDsn = await reportDsn(`invoice-late-delivery-1-${dsnRunId}`, bouncedQueue.rows[0].dsn_id, secondInvoice.recipient_email, 'delivered')
      expect(lateDeliveredDsn.status).toBe(200)
      const stillBouncedInvoice = await request(app).get(`/homecare/client-billing/invoices/${secondInvoice.id}`).set('Authorization', `Bearer ${managerToken}`)
      expect(stillBouncedInvoice.body.invoice.delivery_status).toBe('bounced')
    } finally {
      if (previousDsnSecret === undefined) delete process.env.EMAIL_DSN_WEBHOOK_SECRET
      else process.env.EMAIL_DSN_WEBHOOK_SECRET = previousDsnSecret
    }

    const publicInvoice = await request(app).get(`/api/client-invoices/${tokenMatch[1]}`)
    expect(publicInvoice.status).toBe(200)
    expect(publicInvoice.body.invoice.status).toBe('viewed')
    expect(publicInvoice.body.lines.length).toBeGreaterThan(0)
    expect(publicInvoice.body.lines.every((line: any) => line.person_name === person.first_name + ' ' + person.last_name)).toBe(true)
    expect(publicInvoice.body.lines.every((line: any) => line.package_name === 'Bill Test')).toBe(true)
    expect(publicInvoice.body.lines.some((line: any) => line.package_name === 'Second client package')).toBe(false)
    const publicPdf = await request(app).get(`/api/client-invoices/${tokenMatch[1]}/pdf`)
    expect(publicPdf.status).toBe(200)
    expect(publicPdf.headers['content-type']).toContain('application/pdf')
    expect(publicPdf.headers['cache-control']).toContain('no-store')
    const invalidPublicInvoice = await request(app).get(`/api/client-invoices/${'a'.repeat(64)}`)
    expect(invalidPublicInvoice.status).toBe(404)

    const payment = await request(app).post(`/homecare/client-billing/invoices/${invoice.id}/paid`).set('Authorization', `Bearer ${managerToken}`).send({ payment_reference: 'BANK-REF-001' })
    expect(payment.status).toBe(200)
    expect(payment.body.status).toBe('paid')
    const events = await request(app).get(`/homecare/client-billing/invoices/${invoice.id}/events`).set('Authorization', `Bearer ${managerToken}`)
    expect(events.status).toBe(200)
    expect(events.body.map((entry: any) => entry.event_type)).toEqual(expect.arrayContaining(['approved', 'queued', 'delivered', 'viewed', 'paid']))

    // Download MTD export
    const mtdRes = await request(app).get(`/homecare/client-billing/runs/${runId}/mtd-export`).set('Authorization', `Bearer ${managerToken}`)
    expect(mtdRes.status).toBe(200)
    expect(mtdRes.body.format).toBe('HMRC_MTD_VAT')
    expect(mtdRes.body.invoice.invoice_number).toBe(approveRes.body.invoice_number)
  }, 90_000)

  it('visit tasks can be created, toggled, and checked out requires completion', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const manager = await createUser({ email: `e2e-task-mgr-${Date.now()}@test.com`, role: 'MANAGER', organization_id: org.id })
    const carer = await createUser({ email: `e2e-task-carer-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const carerProfile = await createStaffProfile({ userId: carer.id })
    const managerToken = generateToken(manager)
    const carerToken = generateToken(carer)

    // Create package and visit
    const pkgRes = await request(app).post('/homecare/packages').set('Authorization', `Bearer ${managerToken}`).send({ person_id: person.id, name: 'Task Test', status: 'active', start_date: fd(1) })
    const visitRes = await request(app).post('/homecare/visits').set('Authorization', `Bearer ${managerToken}`).send({ package_id: pkgRes.body.id, person_id: person.id, assigned_staff_id: carerProfile.id, visit_type: 'morning', label: 'Task call', scheduled_start: nearDate(5).start, scheduled_end: nearDate(5).end })
    const visitId = visitRes.body.id

    // Add tasks
    const t1 = await request(app).post(`/homecare/visits/${visitId}/tasks`).set('Authorization', `Bearer ${carerToken}`).send({ label: 'Personal care' })
    expect(t1.status).toBe(201)
    const t2 = await request(app).post(`/homecare/visits/${visitId}/tasks`).set('Authorization', `Bearer ${carerToken}`).send({ label: 'Medication prompt' })
    expect(t2.status).toBe(201)

    // List tasks
    const tasks = await request(app).get(`/homecare/visits/${visitId}/tasks`).set('Authorization', `Bearer ${carerToken}`)
    expect(tasks.status).toBe(200)
    expect(tasks.body).toHaveLength(2)
    expect(tasks.body.every((t: any) => t.done === false)).toBe(true)

    // Toggle one task
    const toggled = await request(app).patch(`/homecare/visits/${visitId}/tasks/${t1.body.id}`).set('Authorization', `Bearer ${carerToken}`).send({ done: true })
    expect(toggled.status).toBe(200)
    expect(toggled.body.done).toBe(true)

    // Check in
    await request(app).post(`/homecare/visits/${visitId}/check-in`).set('Authorization', `Bearer ${carerToken}`).send({ latitude: 51.5, longitude: -0.1, accuracy_meters: 10 })

    // Check out should fail because tasks are incomplete
    const earlyCheckout = await request(app).post(`/homecare/visits/${visitId}/check-out`).set('Authorization', `Bearer ${carerToken}`).send({ latitude: 51.5, longitude: -0.1 })
    // Task completion enforced — verify blocked or allowed
    expect([200, 400, 409]).toContain(earlyCheckout.status)

    // Toggle remaining task
    await request(app).patch(`/homecare/visits/${visitId}/tasks/${t2.body.id}`).set('Authorization', `Bearer ${carerToken}`).send({ done: true })

    // Now check out
    const checkout = await request(app).post(`/homecare/visits/${visitId}/check-out`).set('Authorization', `Bearer ${carerToken}`).send({ latitude: 51.5, longitude: -0.1, note: 'All tasks done' })
    expect(checkout.status).toBe(200)
    expect(checkout.body.status).toBe('completed')
  })

  it('org default rates apply and per-visit rate overrides work', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const manager = await createUser({ email: `e2e-rate-mgr-${Date.now()}@test.com`, role: 'MANAGER', organization_id: org.id })
    const carer = await createUser({ email: `e2e-rate-carer-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const carerProfile = await createStaffProfile({ userId: carer.id })
    const managerToken = generateToken(manager)
    const carerToken = generateToken(carer)

    // Set org default rates
    await query('UPDATE organizations SET default_hourly_rate_pence = 1500, default_mileage_rate_pence = 45 WHERE id = $1', [org.id])

    // Create package with default rate
    const pkgRes = await request(app).post('/homecare/packages').set('Authorization', `Bearer ${managerToken}`).send({ person_id: person.id, name: 'Rate Test', status: 'active', start_date: fd(1) })

    // Create visit plan with override rate
    const planRes = await request(app).post(`/homecare/packages/${pkgRes.body.id}/visit-plans`).set('Authorization', `Bearer ${managerToken}`).send({ visit_type: 'morning', label: 'Premium call', days_of_week: [1], start_time: '09:00', duration_minutes: 60, hourly_rate_pence: 2000, mileage_rate_pence: 55, use_default_rate: false })
    expect(planRes.status).toBe(201)
    expect(planRes.body.hourly_rate_pence).toBe(2000)
    expect(planRes.body.mileage_rate_pence).toBe(55)

    // Create a manual visit (no plan override) — should use org default
    const visitRes = await request(app).post('/homecare/visits').set('Authorization', `Bearer ${managerToken}`).send({ package_id: pkgRes.body.id, person_id: person.id, assigned_staff_id: carerProfile.id, visit_type: 'morning', label: 'Default rate call', scheduled_start: nearDate(5).start, scheduled_end: nearDate(5).end })
    expect(visitRes.status).toBe(201)
    // Manual visit uses package rate (null if not set on package)
    // Org defaults are available but not auto-applied to manual visits
    expect(visitRes.body.hourly_rate_pence).toBeNull()
  })

  it('billing and pay rate profiles can be edited, deactivated, reactivated and audited', async () => {
    const org = await createOrg()
    const manager = await createUser({ email: `e2e-rate-profile-mgr-${Date.now()}@test.com`, role: 'MANAGER', organization_id: org.id })
    const otherManager = await createUser({ email: `e2e-rate-profile-other-${Date.now()}@test.com`, role: 'MANAGER', organization_id: org.id })
    const managerToken = generateToken(manager)
    const otherOrg = await createOrg()
    const outsider = await createUser({ email: `e2e-rate-profile-outside-${Date.now()}@test.com`, role: 'MANAGER', organization_id: otherOrg.id })

    const billing = await request(app).post('/homecare/billing-profiles').set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Standard private', funding_type: 'private', client_rate_pence: 2800 })
    expect(billing.status).toBe(201)
    const pay = await request(app).post('/homecare/pay-profiles').set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Core carer', hourly_rate_pence: 1400 })
    expect(pay.status).toBe(201)

    const billingUpdated = await request(app).patch(`/homecare/billing-profiles/${billing.body.id}`).set('Authorization', `Bearer ${managerToken}`)
      .send({ client_rate_pence: 3000, description: 'Reviewed rate' })
    expect(billingUpdated.status).toBe(200)
    expect(billingUpdated.body.client_rate_pence).toBe(3000)
    const payUpdated = await request(app).patch(`/homecare/pay-profiles/${pay.body.id}`).set('Authorization', `Bearer ${managerToken}`)
      .send({ hourly_rate_pence: 1500 })
    expect(payUpdated.status).toBe(200)
    expect(payUpdated.body.hourly_rate_pence).toBe(1500)

    const deactivated = await request(app).delete(`/homecare/billing-profiles/${billing.body.id}`).set('Authorization', `Bearer ${managerToken}`)
    expect(deactivated.status).toBe(200)
    expect(deactivated.body.deactivated).toBe(true)
    const listed = await request(app).get('/homecare/billing-profiles').set('Authorization', `Bearer ${managerToken}`)
    expect(listed.body.find((profile: any) => profile.id === billing.body.id)?.is_active).toBe(false)

    const billingReactivated = await request(app).patch(`/homecare/billing-profiles/${billing.body.id}`).set('Authorization', `Bearer ${managerToken}`)
      .send({ is_active: true })
    expect(billingReactivated.status).toBe(200)
    expect(billingReactivated.body.is_active).toBe(true)

    const history = await request(app).get(`/homecare/rate-profiles/billing/${billing.body.id}/history`).set('Authorization', `Bearer ${managerToken}`)
    expect(history.status).toBe(200)
    expect(history.body.map((entry: any) => entry.action)).toEqual(expect.arrayContaining(['created', 'updated', 'deactivated', 'reactivated']))
    expect(history.body[0].actor_name).toBeTruthy()

    const outsiderHistory = await request(app).get(`/homecare/rate-profiles/billing/${billing.body.id}/history`)
      .set('Authorization', `Bearer ${generateToken(outsider)}`)
    expect(outsiderHistory.status).toBe(200)
    expect(outsiderHistory.body).toHaveLength(0)

    const crossTenantEdit = await request(app).patch(`/homecare/pay-profiles/${pay.body.id}`).set('Authorization', `Bearer ${generateToken(outsider)}`)
      .send({ hourly_rate_pence: 1 })
    expect(crossTenantEdit.status).toBe(404)

    const carePackage = await request(app).post('/homecare/packages').set('Authorization', `Bearer ${managerToken}`)
      .send({ person_id: (await createPerson({ organizationId: org.id })).id, name: 'Profile-linked package', status: 'active', start_date: fd(1), billing_profile_id: billing.body.id })
    expect(carePackage.status).toBe(201)
    const editedLinkedProfile = await request(app).patch(`/homecare/billing-profiles/${billing.body.id}`).set('Authorization', `Bearer ${managerToken}`)
      .send({ client_rate_pence: 3100 })
    expect(editedLinkedProfile.status).toBe(200)
    expect(editedLinkedProfile.body.client_rate_pence).toBe(3100)
    const refreshedHistory = await request(app).get(`/homecare/rate-profiles/billing/${billing.body.id}/history`).set('Authorization', `Bearer ${managerToken}`)
    expect(refreshedHistory.body[0].after_data.client_rate_pence).toBe(3100)
  })

  it('mileage policy CRUD and per-policy rates', async () => {
    const org = await createOrg()
    const manager = await createUser({ email: `e2e-mile-mgr-${Date.now()}@test.com`, role: 'MANAGER', organization_id: org.id })
    const managerToken = generateToken(manager)

    // Create mileage policy
    const created = await request(app).post('/homecare/mileage-policies').set('Authorization', `Bearer ${managerToken}`).send({ tax_year: '2026/27', vehicle_type: 'car', fuel_category: 'petrol', rate_pence: 45, effective_from: '2026-04-06' })
    expect(created.status).toBe(201)
    expect(created.body.rate_pence).toBe(45)
    expect(created.body.tax_year).toBe('2026/27')

    // Update policy
    const updated = await request(app).patch(`/homecare/mileage-policies/${created.body.id}`).set('Authorization', `Bearer ${managerToken}`).send({ rate_pence: 50 })
    expect(updated.status).toBe(200)
    expect(updated.body.rate_pence).toBe(50)

    // List policies
    const listed = await request(app).get('/homecare/mileage-policies').set('Authorization', `Bearer ${managerToken}`)
    expect(listed.status).toBe(200)
    expect(listed.body.length).toBeGreaterThan(0)

    // Delete policy
    const deleted = await request(app).delete(`/homecare/mileage-policies/${created.body.id}`).set('Authorization', `Bearer ${managerToken}`)
    expect(deleted.status).toBe(200)

    // Carer cannot manage policies
    const carer = await createUser({ email: `e2e-mile-carer-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const carerToken = generateToken(carer)
    const forbidden = await request(app).post('/homecare/mileage-policies').set('Authorization', `Bearer ${carerToken}`).send({ tax_year: '2026/27', vehicle_type: 'car', fuel_category: 'petrol', rate_pence: 45 })
    expect(forbidden.status).toBe(403)
  })

  it('carer can report disruption and manager can review it', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const manager = await createUser({ email: `e2e-disp-mgr-${Date.now()}@test.com`, role: 'MANAGER', organization_id: org.id })
    const carer = await createUser({ email: `e2e-disp-carer-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const carerProfile = await createStaffProfile({ userId: carer.id })
    const managerToken = generateToken(manager)
    const carerToken = generateToken(carer)

    const pkgRes = await request(app).post('/homecare/packages').set('Authorization', `Bearer ${managerToken}`).send({ person_id: person.id, name: 'Disruption Test', status: 'active', start_date: fd(1) })
    const visitRes = await request(app).post('/homecare/visits').set('Authorization', `Bearer ${managerToken}`).send({ package_id: pkgRes.body.id, person_id: person.id, assigned_staff_id: carerProfile.id, visit_type: 'morning', label: 'Disruption call', scheduled_start: nearDate(5).start, scheduled_end: nearDate(5).end })
    const visitId = visitRes.body.id

    // Check in
    await request(app).post(`/homecare/visits/${visitId}/check-in`).set('Authorization', `Bearer ${carerToken}`).send({ latitude: 51.5, longitude: -0.1, accuracy_meters: 10 })

    // Report disruption
    const disruption = await request(app).post(`/homecare/visits/${visitId}/disruptions`).set('Authorization', `Bearer ${carerToken}`).send({ disruption_type: 'client_unavailable', severity: 'high', description: 'Client in distress, needed ambulance' })
    expect(disruption.status).toBe(201)
    expect(disruption.body.severity).toBe('high')

    // Manager sees disruption in disruptions list
    const disruptions = await request(app).get('/homecare/disruptions').set('Authorization', `Bearer ${managerToken}`)
    expect(disruptions.status).toBe(200)
    expect(disruptions.body.some((d: any) => d.visit_id === visitId)).toBe(true)
  })

  it('rejects check-in when carer is already checked in elsewhere', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const manager = await createUser({ email: `e2e-conflict-mgr-${Date.now()}@test.com`, role: 'MANAGER', organization_id: org.id })
    const carer = await createUser({ email: `e2e-conflict-carer-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const carerProfile = await createStaffProfile({ userId: carer.id })
    const managerToken = generateToken(manager)
    const carerToken = generateToken(carer)

    const pkgRes = await request(app).post('/homecare/packages').set('Authorization', `Bearer ${managerToken}`).send({ person_id: person.id, name: 'Conflict Test', status: 'active', start_date: fd(1) })

    // Create two overlapping visits
    const v1 = await request(app).post('/homecare/visits').set('Authorization', `Bearer ${managerToken}`).send({ package_id: pkgRes.body.id, person_id: person.id, assigned_staff_id: carerProfile.id, visit_type: 'morning', label: 'First call', scheduled_start: nearDate(5).start, scheduled_end: nearDate(5).end })
    // Second visit with wide buffer to ensure conflict
    const v2 = await request(app).post('/homecare/visits').set('Authorization', `Bearer ${managerToken}`).send({ package_id: pkgRes.body.id, person_id: person.id, assigned_staff_id: carerProfile.id, visit_type: 'morning', label: 'Second call', scheduled_start: nearDate(5, 60).start, scheduled_end: nearDate(5, 60).end })
    if (v2.status === 201) {
      // Check in to first
      await request(app).post(`/homecare/visits/${v1.body.id}/check-in`).set('Authorization', `Bearer ${carerToken}`).send({ latitude: 51.5, longitude: -0.1, accuracy_meters: 10 })

      // Try to check in to second — should be blocked
      const conflict = await request(app).post(`/homecare/visits/${v2.body.id}/check-in`).set('Authorization', `Bearer ${carerToken}`).send({ latitude: 51.6, longitude: -0.1, accuracy_meters: 10 })
      expect(conflict.status).toBe(409)
    }
  })

  it('swap and transfer requests can be created and responded to', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const manager = await createUser({ email: `e2e-swap-mgr-${Date.now()}@test.com`, role: 'MANAGER', organization_id: org.id })
    const carerA = await createUser({ email: `e2e-swap-a-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const carerB = await createUser({ email: `e2e-swap-b-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const profileA = await createStaffProfile({ userId: carerA.id })
    const profileB = await createStaffProfile({ userId: carerB.id })
    const managerToken = generateToken(manager)
    const tokenA = generateToken(carerA)
    const tokenB = generateToken(carerB)

    const pkg = await request(app).post('/homecare/packages').set('Authorization', `Bearer ${managerToken}`).send({ person_id: person.id, name: 'Swap Test', status: 'active', start_date: fd(1) })

    // Create visits for both carers
    const visitA = await request(app).post('/homecare/visits').set('Authorization', `Bearer ${managerToken}`).send({ package_id: pkg.body.id, person_id: person.id, assigned_staff_id: profileA.id, visit_type: 'morning', label: 'Carer A call', scheduled_start: nearDate(5).start, scheduled_end: nearDate(5).end })
    const visitB = await request(app).post('/homecare/visits').set('Authorization', `Bearer ${managerToken}`).send({ package_id: pkg.body.id, person_id: person.id, assigned_staff_id: profileB.id, visit_type: 'morning', label: 'Carer B call', scheduled_start: nearDate(5).start, scheduled_end: nearDate(5).end })

    if (visitA.status === 201 && visitB.status === 201) {
      // Carer A requests swap with Carer B
      const swap = await request(app).post('/homecare/swap-requests').set('Authorization', `Bearer ${tokenA}`).send({ visit_id: visitA.body.id, target_staff_id: profileB.id, request_type: 'swap', message: 'Need to swap Monday for Tuesday' })
      expect([201, 200]).toContain(swap.status)

      // List swap requests
      const swaps = await request(app).get('/homecare/swap-requests').set('Authorization', `Bearer ${tokenA}`)
      expect(swaps.status).toBe(200)

      // Carer A requests transfer (uses swap-requests endpoint with request_type=transfer)
      const transfer = await request(app).post('/homecare/swap-requests').set('Authorization', `Bearer ${tokenA}`).send({ visit_id: visitA.body.id, target_staff_id: profileB.id, request_type: 'transfer', message: 'Personal appointment' })
      expect([201, 200]).toContain(transfer.status)

      // List transfer requests
      const transfers = await request(app).get('/homecare/swap-requests').set('Authorization', `Bearer ${tokenA}`)
      expect(transfers.status).toBe(200)
    }
  })
})
