import { afterEach, describe, expect, it, vi } from 'vitest'

const { connect, release, dbQuery } = vi.hoisted(() => ({
  connect: vi.fn(),
  release: vi.fn(),
  dbQuery: vi.fn(),
}))

vi.mock('../database', () => ({
  migratePool: { connect },
}))

import { applyEmailDsn, processEmailDsnWebhook, signEmailDsnPayload, verifyEmailDsnSignature } from './email.dsn'
import { AppError } from '../middleware/error.middleware'

const dsnId = '9f90f271-99c4-4f5c-8cdf-c1973f1c84cb'
const queueId = 'b5ae7188-1c46-4f3b-b2fd-d37347528aa9'
const orgId = '1a9dbd74-c89c-4dc7-88c3-b5568a0a50c0'
const invoiceId = 'dc886568-d351-4c26-9ad0-5926484382d3'
const recipient = 'billing@example.org'

function mockDb(lastStatus: string | null = null, invoiceUpdated = true) {
  const queries: Array<{ text: string; params?: any[] }> = []
  dbQuery.mockImplementation(async (text: string, params?: any[]) => {
    queries.push({ text, params })
    if (text.includes('SELECT id, to_email, dsn_requested')) {
      return { rows: [{ id: queueId, to_email: recipient, dsn_requested: true, last_dsn_status: lastStatus }] }
    }
    if (text.includes('INSERT INTO email_dsn_events')) return { rows: [{ event_id: params?.[0] }] }
    if (text.includes('UPDATE homecare_client_billing_invoices')) {
      return { rows: invoiceUpdated ? [{ id: invoiceId, organization_id: orgId, status: params?.[0] === 'delivered' ? 'sent' : 'approved', delivery_status: params?.[0] }] : [] }
    }
    return { rows: [] }
  })
  const client = { query: dbQuery, release }
  connect.mockResolvedValue(client)
  return queries
}

function payload(status: 'delivered' | 'delayed' | 'bounced', eventId = `event-${status}`, diagnostic?: string) {
  return { event_id: eventId, dsn_id: dsnId, recipient, status, diagnostic }
}

afterEach(() => {
  vi.clearAllMocks()
  delete process.env.EMAIL_DSN_WEBHOOK_SECRET
})

describe('email DSN delivery tracking', () => {
  it('verifies HMAC signatures and rejects stale timestamps', () => {
    const body = Buffer.from(JSON.stringify(payload('delivered')))
    const timestamp = String(Math.floor(Date.now() / 1000))
    const signature = signEmailDsnPayload(body, timestamp, 'secret')

    expect(verifyEmailDsnSignature(body, timestamp, signature, 'secret')).toBe(true)
    expect(verifyEmailDsnSignature(body, timestamp, signature, 'wrong-secret')).toBe(false)
    expect(verifyEmailDsnSignature(body, String(Number(timestamp) - 301), signature, 'secret')).toBe(false)
  })

  it('requires the configured webhook secret before processing a callback', async () => {
    const body = Buffer.from(JSON.stringify(payload('delivered')))
    await expect(processEmailDsnWebhook(body, '1770000000', 'sha256=invalid')).rejects.toMatchObject<AppError>({ statusCode: 503 })
  })

  it.each([
    ['delivered', 'sent'],
    ['delayed', 'approved'],
    ['bounced', 'approved'],
  ] as const)('applies %s callback to the linked invoice', async (deliveryStatus, invoiceStatus) => {
    const queries = mockDb()
    const result = await applyEmailDsn(payload(deliveryStatus, `event-${deliveryStatus}`, deliveryStatus === 'bounced' ? '550 mailbox unavailable' : undefined))

    expect(result).toEqual({ matched: true, duplicate: false, invoiceUpdated: true })
    expect(queries.some(q => q.text.includes('UPDATE email_queue'))).toBe(true)
    expect(queries.some(q => q.text.includes('UPDATE homecare_client_billing_invoices'))).toBe(true)
    expect(queries.find(q => q.text.includes('UPDATE homecare_client_billing_invoices'))?.params?.[0]).toBe(deliveryStatus)
    expect(queries.some(q => q.text.includes('INSERT INTO homecare_client_billing_invoice_events'))).toBe(true)
    expect(invoiceStatus).toBe(deliveryStatus === 'delivered' ? 'sent' : 'approved')
    expect(release).toHaveBeenCalledOnce()
  })

  it('does not mutate terminal delivery when a late contradictory DSN arrives', async () => {
    const queries = mockDb('bounced')
    const result = await applyEmailDsn(payload('delivered', 'late-delivered'))

    expect(result).toEqual({ matched: true, duplicate: false, invoiceUpdated: false })
    expect(queries.some(q => q.text.includes('UPDATE email_queue'))).toBe(false)
    expect(queries.some(q => q.text.includes('UPDATE homecare_client_billing_invoices'))).toBe(false)
  })

  it('does not mutate database state for duplicate event IDs', async () => {
    const queries = mockDb()
    dbQuery.mockImplementation(async (text: string, params?: any[]) => {
      queries.push({ text, params })
      if (text.includes('SELECT id, to_email, dsn_requested')) return { rows: [{ id: queueId, to_email: recipient, dsn_requested: true, last_dsn_status: null }] }
      if (text.includes('INSERT INTO email_dsn_events')) return { rows: [] }
      return { rows: [] }
    })

    const result = await applyEmailDsn(payload('delivered', 'duplicate-event'))
    expect(result).toEqual({ matched: true, duplicate: true, invoiceUpdated: false })
    expect(queries.some(q => q.text.includes('UPDATE email_queue'))).toBe(false)
    expect(queries.some(q => q.text.includes('UPDATE homecare_client_billing_invoices'))).toBe(false)
  })

  it('does not match a DSN to a different recipient', async () => {
    mockDb()
    const result = await applyEmailDsn({ ...payload('delivered'), recipient: 'other@example.org' })
    expect(result).toEqual({ matched: false, duplicate: false, invoiceUpdated: false })
    expect(dbQuery).toHaveBeenCalledWith('ROLLBACK')
  })
})
