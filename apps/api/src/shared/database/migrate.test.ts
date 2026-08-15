import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./index', () => ({
  migrateQuery: vi.fn(),
}))

import { getMigrationVersion, sortMigrations, runMigrations, Migration } from './migrate'
import { migrateQuery } from './index'

const mockMigrateQuery = migrateQuery as unknown as ReturnType<typeof vi.fn>

function m(name: string, statements: string[] = []): Migration {
  return { name, statements }
}

describe('getMigrationVersion', () => {
  it('extracts the leading numeric prefix from a migration name', () => {
    expect(getMigrationVersion('031_event_outbox')).toBe(31)
    expect(getMigrationVersion('001_initial')).toBe(1)
    expect(getMigrationVersion('010_thing')).toBe(10)
  })

  it('throws when a migration name has no numeric prefix', () => {
    expect(() => getMigrationVersion('initial_setup')).toThrow(/numeric version prefix/)
    expect(() => getMigrationVersion('_031_leading_underscore')).toThrow(/numeric version prefix/)
  })
})

describe('sortMigrations', () => {
  it('orders by version number, ignoring the array position they are declared in', () => {
    const sorted = sortMigrations([m('030_late'), m('002_early'), m('010_middle')])
    expect(sorted.map((x) => x.name)).toEqual(['002_early', '010_middle', '030_late'])
  })

  it('throws on duplicate version numbers even with different names', () => {
    expect(() => sortMigrations([m('005_a'), m('005_b')])).toThrow(/Duplicate migration version 5/)
  })

  it('leaves already-ordered input untouched', () => {
    const sorted = sortMigrations([m('001_a'), m('002_b'), m('003_c')])
    expect(sorted.map((x) => x.name)).toEqual(['001_a', '002_b', '003_c'])
  })
})

describe('runMigrations', () => {
  beforeEach(() => {
    mockMigrateQuery.mockReset()
    mockMigrateQuery.mockResolvedValue({ rows: [] })
  })

  it('applies migrations in version order even when declared out of order', async () => {
    await runMigrations([m('030_late', ['stmt-late']), m('002_early', ['stmt-early'])])

    const calls = mockMigrateQuery.mock.calls.map((c) => c[0])
    const earlyIdx = calls.indexOf('stmt-early')
    const lateIdx = calls.indexOf('stmt-late')
    expect(earlyIdx).toBeGreaterThan(-1)
    expect(lateIdx).toBeGreaterThan(-1)
    expect(earlyIdx).toBeLessThan(lateIdx)
  })

  it('skips already-applied migrations without re-running their statements', async () => {
    // Applied map includes '010_missing' so its statements must never run.
    mockMigrateQuery.mockResolvedValue({ rows: [{ name: '010_missing', checksum: 'whatever' }] })
    await runMigrations([m('010_missing', ['SHOULD-NOT-RUN'])])

    const calls = mockMigrateQuery.mock.calls.map((c) => c[0])
    expect(calls).not.toContain('SHOULD-NOT-RUN')
  })

  it('refuses an unapplied migration whose version is older than the newest applied one', async () => {
    // Newest applied is 030; the not-yet-applied '010_backfill' is a late insertion.
    mockMigrateQuery.mockResolvedValue({
      rows: [
        { name: '002_old', checksum: 'a' },
        { name: '030_new', checksum: 'b' },
      ],
    })

    await expect(runMigrations([m('010_backfill', ['stmt-backfill'])])).rejects.toThrow(
      /010_backfill.*older than the newest applied migration \(30\)/
    )
  })

  it('applies a fresh migration whose version is above the watermark', async () => {
    mockMigrateQuery.mockResolvedValue({
      rows: [{ name: '030_new', checksum: 'b' }],
    })
    await runMigrations([m('031_fresh', ['stmt-fresh'])])

    const calls = mockMigrateQuery.mock.calls.map((c) => c[0])
    expect(calls).toContain('stmt-fresh')
  })
})
