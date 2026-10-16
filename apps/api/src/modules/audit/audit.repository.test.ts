/**
 * The property that makes it safe to *wait* for an audit write.
 *
 * Waiting for an insert is only acceptable because a failure of that insert
 * cannot become the caller's failure: the mutation has already committed, and a
 * carer clocking in must not get a 500 because the audit log is unwritable.
 * That is a property of `AuditRepository.log` — it catches and logs, and resolves
 * either way — and it is what the request-path flush relies on.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../shared/database', () => ({ query: vi.fn() }))

import { query } from '../../shared/database'
import { AuditRepository } from './audit.repository'
import logger from '../../shared/utils/logger'

const mockQuery = query as unknown as ReturnType<typeof vi.fn>

describe('AuditRepository.log', () => {
  beforeEach(() => {
    mockQuery.mockReset()
    mockQuery.mockResolvedValue({ rows: [] })
    vi.spyOn(logger, 'error').mockImplementation(() => logger as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('writes the row and resolves', async () => {
    await expect(
      AuditRepository.log({ user_id: 'u1', action: 'update', entity_type: 'organization', entity_id: 'o1' })
    ).resolves.toBeUndefined()

    expect(mockQuery).toHaveBeenCalledTimes(1)
    expect(String(mockQuery.mock.calls[0][0])).toContain('INSERT INTO audit_logs')
  })

  it('resolves rather than rejecting when the insert fails, and says so in the log', async () => {
    mockQuery.mockRejectedValueOnce(new Error('relation "audit_logs" does not exist'))

    // A rejection here would become an unhandled rejection in the flush and, at
    // any awaited call site, a 500 for a request whose real work had succeeded.
    await expect(
      AuditRepository.log({ user_id: 'u1', action: 'update', entity_type: 'organization', entity_id: 'o1' })
    ).resolves.toBeUndefined()

    expect(logger.error).toHaveBeenCalled()
  })

  it('still redacts sensitive fields before they reach the log', async () => {
    await AuditRepository.log({
      user_id: 'u1',
      action: 'update',
      entity_type: 'staff_profile',
      entity_id: 's1',
      new_data: { phone: '07700 900123', first_name: 'Ada', nhs_number: '999 999 9999' },
    })

    const [, params] = mockQuery.mock.calls[0]
    expect(params[5]).toEqual({ phone: '[REDACTED]', first_name: 'Ada', nhs_number: '[REDACTED]' })
  })
})
