/**
 * The database-level guard added by migration 140.
 *
 * The grant in `auth.middleware.ts` is only as safe as the column underneath
 * it. If application traffic could write `review_access_expires_at`, then any
 * bug, any careless query and any future endpoint that accepted an expiry date
 * from a request body would become a way to turn off billing for a paying
 * customer. These tests assert that at the database level rather than trusting
 * the middleware to be the only thing that ever looks at the column.
 *
 * The first attempt at this guard was `REVOKE UPDATE (col) FROM meticle_app`,
 * which does nothing: migration 004 grants UPDATE at the table level and
 * PostgreSQL privileges are additive, so the table grant still covers the new
 * columns. An UPDATE as `meticle_app` succeeded against it. The trigger is what
 * actually holds, and that is what is tested here.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { migrateQuery } from '../../shared/database'

const COLUMNS = ['review_access_expires_at', 'review_access_reason']

let owner: Client
let appRole: Client

beforeAll(async () => {
  const url = process.env.DATABASE_MIGRATE_URL || process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL / DATABASE_MIGRATE_URL must be set for this test')

  owner = new Client({ connectionString: url })
  await owner.connect()

  if (!process.env.APP_ROLE_PASSWORD) {
    await owner.end()
    throw new Error('APP_ROLE_PASSWORD must be set to test the application role')
  }
  const parsed = new URL(url)
  appRole = new Client({
    host: parsed.hostname,
    port: Number(parsed.port) || 5432,
    user: 'meticle_app',
    password: process.env.APP_ROLE_PASSWORD,
    database: parsed.pathname.replace('/', ''),
  })
  await appRole.connect()
})

afterAll(async () => {
  await owner?.end()
  await appRole?.end()
})

/** A throwaway organisation owned by this test, removed afterwards. */
async function withScratchOrg<T>(fn: (orgId: string) => Promise<T>): Promise<T> {
  const created = await migrateQuery(
    `INSERT INTO organizations (name, status, plan, subscription_status)
     VALUES ($1, 'active', 'professional', 'trial') RETURNING id`,
    [`Review-guard scratch ${Date.now()}-${Math.random()}`],
  )
  const orgId = created.rows[0].id
  try {
    return await fn(orgId)
  } finally {
    await migrateQuery('DELETE FROM organizations WHERE id = $1', [orgId])
  }
}

describe('review access column guard', () => {
  it('refuses to let the application role set the expiry', async () => {
    await withScratchOrg(async (orgId) => {
      await expect(
        appRole.query(
          `UPDATE organizations SET review_access_expires_at = NOW() WHERE id = $1`,
          [orgId],
        ),
      ).rejects.toThrow(/review access columns may only be set by the review-access tooling/i)
    })
  })

  it('refuses the reason column too, not just the expiry', async () => {
    // A reason without an expiry is harmless, but leaving one writable would
    // mean the guard only covers half of what it claims to cover.
    await withScratchOrg(async (orgId) => {
      await expect(
        appRole.query(
          `UPDATE organizations SET review_access_reason = 'self granted' WHERE id = $1`,
          [orgId],
        ),
      ).rejects.toThrow(/review access columns may only be set by the review-access tooling/i)
    })
  })

  it('still lets the application role update every other column', async () => {
    // The guard must not brick the org table for ordinary traffic. Stripe sync
    // and the billing controller write subscription_status through this role.
    await withScratchOrg(async (orgId) => {
      await expect(
        appRole.query(
          `UPDATE organizations SET updated_at = NOW() WHERE id = $1`,
          [orgId],
        ),
      ).resolves.toBeDefined()
    })
  })

  it('does not fire when an unrelated update leaves the grant untouched', async () => {
    // Updating a row that happens to carry a grant must still work; the trigger
    // is a value-change check, not a blanket ban on the row.
    await withScratchOrg(async (orgId) => {
      await migrateQuery(
        `UPDATE organizations SET review_access_expires_at = NOW() + interval '1 day', review_access_reason = 'test' WHERE id = $1`,
        [orgId],
      )
      await expect(
        appRole.query(
          `UPDATE organizations SET subscription_status = subscription_status WHERE id = $1`,
          [orgId],
        ),
      ).resolves.toBeDefined()
    })
  })

  it('lets the privileged migration role set the grant', async () => {
    // Otherwise the seed script could not arm the window at all.
    await withScratchOrg(async (orgId) => {
      await expect(
        migrateQuery(
          `UPDATE organizations SET review_access_expires_at = NOW() + interval '1 day', review_access_reason = 'test' WHERE id = $1`,
          [orgId],
        ),
      ).resolves.toBeDefined()
    })
  })

  it('keeps the gate readable for the application role', async () => {
    // The middleware SELECTs the column on every authenticated request. If this
    // ever stops working, every tenant is affected, not just the reviewer.
    await expect(
      appRole.query(
        `SELECT id, subscription_status, review_access_expires_at FROM organizations LIMIT 1`,
      ),
    ).resolves.toBeDefined()
  })

  it('covers both guarded columns', async () => {
    const rows = await migrateQuery(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'organizations' AND column_name = ANY($1::text[])`,
      [COLUMNS],
    )
    expect(rows.rows.map((r) => r.column_name).sort()).toEqual([...COLUMNS].sort())
  })
})