import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import bcrypt from 'bcryptjs'

// The seed writes to Postgres, so the client is faked and every statement it
// issues is recorded. That keeps the assertions on the real code path — the
// password hashes the seed actually builds — without touching a database.
const { recorded } = vi.hoisted(() => ({ recorded: [] as { text: string; params?: any[] }[] }))

vi.mock('pg', () => ({
  Client: class {
    async connect() {}
    async end() {}
    async query(text: string, params?: any[]) {
      recorded.push({ text, params })
      return { rows: [] }
    }
  },
}))

const SMOKE_EMAIL = 'contact.techville@gmail.com'
const DEFAULT_PASSWORD = 'Password123$'
const PIPELINE_PASSWORD = 'fresh-env-smoke-secret-9x!'

const originalDatabaseUrl = process.env.DATABASE_URL

async function runSeed(env: Record<string, string | undefined>) {
  recorded.length = 0
  process.env.DATABASE_URL = 'postgres://seed:seed@localhost:5432/seed'
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  vi.resetModules()
  const mod = await import('./seed-clean-care')
  await mod.seedDone
}

/** The password hash the seed inserts for a given account, i.e. what login will accept. */
function seededPasswordHash(email: string): string {
  const insert = recorded.find(
    entry => entry.text.startsWith('INSERT INTO users') && entry.params?.[2] === email,
  )
  if (!insert) throw new Error(`the seed never inserted a users row for ${email}`)
  return insert.params![4] as string
}

beforeEach(() => {
  delete process.env.DEPLOY_SMOKE_EMAIL
  delete process.env.DEPLOY_SMOKE_PASSWORD
})

afterEach(() => {
  vi.resetModules()
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL
  else process.env.DATABASE_URL = originalDatabaseUrl
})

describe('seed-clean-care smoke credentials', () => {
  it('seeds the smoke account with DEPLOY_SMOKE_PASSWORD, so a fresh environment passes the deploy smoke test', async () => {
    await runSeed({ DEPLOY_SMOKE_PASSWORD: PIPELINE_PASSWORD })

    const hash = seededPasswordHash(SMOKE_EMAIL)
    expect(bcrypt.compareSync(PIPELINE_PASSWORD, hash)).toBe(true)
    expect(bcrypt.compareSync(DEFAULT_PASSWORD, hash)).toBe(false)
  })

  it('leaves the other seeded accounts on the documented default', async () => {
    await runSeed({ DEPLOY_SMOKE_PASSWORD: PIPELINE_PASSWORD })

    for (const email of ['itsopeyemi@gmail.com', 'opeyemi@gmail.com', 'faithhopey@gmail.com']) {
      const hash = seededPasswordHash(email)
      expect(bcrypt.compareSync(DEFAULT_PASSWORD, hash)).toBe(true)
      expect(bcrypt.compareSync(PIPELINE_PASSWORD, hash)).toBe(false)
    }
  })

  it('falls back to the documented default when DEPLOY_SMOKE_PASSWORD is unset or blank', async () => {
    await runSeed({ DEPLOY_SMOKE_PASSWORD: undefined })
    expect(bcrypt.compareSync(DEFAULT_PASSWORD, seededPasswordHash(SMOKE_EMAIL))).toBe(true)

    await runSeed({ DEPLOY_SMOKE_PASSWORD: '   ' })
    expect(bcrypt.compareSync(DEFAULT_PASSWORD, seededPasswordHash(SMOKE_EMAIL))).toBe(true)
  })

  it('honours DEPLOY_SMOKE_EMAIL, case-insensitively, so the account the pipeline logs in as is the one that gets the password', async () => {
    await runSeed({ DEPLOY_SMOKE_EMAIL: ' NIROCARTS@Gmail.com ', DEPLOY_SMOKE_PASSWORD: PIPELINE_PASSWORD })

    expect(bcrypt.compareSync(PIPELINE_PASSWORD, seededPasswordHash('nirocarts@gmail.com'))).toBe(true)
    expect(bcrypt.compareSync(DEFAULT_PASSWORD, seededPasswordHash(SMOKE_EMAIL))).toBe(true)
  })

  it('refuses to seed an account the pipeline could not log in as, before it purges anything', async () => {
    await expect(runSeed({ DEPLOY_SMOKE_EMAIL: 'ops@cleancare.example', DEPLOY_SMOKE_PASSWORD: PIPELINE_PASSWORD }))
      .rejects.toThrow(/not one of the seeded accounts/)

    expect(recorded.filter(entry => entry.text.startsWith('INSERT'))).toHaveLength(0)
    expect(recorded.some(entry => entry.text.startsWith('TRUNCATE'))).toBe(false)
  })
})
