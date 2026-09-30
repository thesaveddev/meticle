/**
 * Four regulators, served.
 *
 * The unit tests in frameworks.test.ts pin the definitions. These pin what a
 * provider actually gets back from /cqc/readiness, which is where the previous
 * version of this was observable: a Welsh provider received England's five key
 * questions, and a Northern Irish provider received fourteen identifiers that
 * did not exist.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'
import { migrateQuery as db } from '../../shared/database'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

async function orgFor(regulator: string, serviceTypes: string[] = ['domiciliary']) {
  const org = await createOrg({ service_types: serviceTypes })
  await db('UPDATE organizations SET regulator = $1 WHERE id = $2', [regulator, org.id])
  const user = await createUser({
    email: `${regulator}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.com`,
    password: 'TestPass123!',
    role: 'ORG_ADMIN',
    organization_id: org.id,
  })
  return { org, token: generateToken(user) }
}

async function readiness(regulator: string, serviceTypes?: string[]) {
  const { token } = await orgFor(regulator, serviceTypes)
  const res = await request(app)
    .get('/cqc/readiness')
    .set('Authorization', `Bearer ${token}`)
  expect(res.status).toBe(200)
  return res.body.data
}

describe('Wales — CIW served as its own framework', () => {
  it('returns CIW’s four themes, not CQC’s five key questions', async () => {
    const data = await readiness('ciw', ['residential'])
    expect(data.framework.id).toBe('ciw')
    expect(data.domains.map((d: any) => d.label)).toEqual([
      'Well-being', 'Care and support', 'Environment', 'Leadership and management',
    ])
    // The five key questions, one of which is "Responsive", has no place here.
    expect(data.domains.map((d: any) => d.key)).not.toContain('responsive')
  })

  it('scores CIW’s lines of enquiry, and nothing else', async () => {
    const data = await readiness('ciw', ['residential'])
    const ids = data.domains.flatMap((d: any) => d.statements.map((s: any) => s.id))
    expect(ids).toEqual([
      'LOE-1', 'LOE-2', 'LOE-3', 'LOE-4',
      'LOE-5', 'LOE-6', 'LOE-7', 'LOE-8',
      'LOE-9',
      'LOE-10', 'LOE-11', 'LOE-12',
    ])
    for (const id of ['S1', 'E1', 'C1', 'R1', 'W1']) {
      expect(ids, `CQC statement ${id} leaked into the Welsh framework`).not.toContain(id)
    }
  })

  it('uses CIW’s rating words', async () => {
    const data = await readiness('ciw', ['residential'])
    expect(data.framework.ratings.map((r: any) => r.label)).toEqual([
      'Excellent', 'Good', 'Requires improvement', 'Requires significant improvement',
    ])
  })

  it('withholds an overall rating, because CIW does not award one', async () => {
    const data = await readiness('ciw', ['residential'])
    expect(data.overallLabel).toBeNull()
    expect(data.publishesOverallRating).toBe(false)
    // The internal summary still exists, it is just not dressed as CIW's word.
    expect(typeof data.overall).toBe('number')
  })

  it('sends the source so a Welsh manager can check it', async () => {
    const data = await readiness('ciw', ['residential'])
    expect(data.framework.source).toContain('Care Inspectorate Wales')
    expect(data.framework.source).toContain('2025')
    expect(data.framework.ratingsNote).toContain('MeticleCare')
  })

  it('hides Environment from a domiciliary provider', async () => {
    const data = await readiness('ciw', ['domiciliary'])
    expect(data.domains.map((d: any) => d.key)).not.toContain('environment')
    // Said out loud rather than silently absent.
    expect(data.notApplicableDomains).toContain('Environment')
  })

  it('shows Environment to a residential provider', async () => {
    const data = await readiness('ciw', ['residential'])
    expect(data.domains.map((d: any) => d.key)).toContain('environment')
    expect(data.notApplicableDomains).toEqual([])
  })

  it('names Welsh domains in its gap messages, not CQC’s', async () => {
    const data = await readiness('ciw', ['residential'])
    const gaps = data.gaps.join(' ')
    expect(gaps).toContain('Well-being')
    expect(gaps).not.toContain('the Caring domain')
    expect(gaps).not.toContain('the Responsive domain')
  })

  it('scores every Welsh theme', async () => {
    const data = await readiness('ciw', ['residential'])
    for (const d of data.domains) {
      expect(typeof d.score).toBe('number')
      expect(d.score).toBeGreaterThanOrEqual(0)
      expect(d.score).toBeLessThanOrEqual(100)
    }
  })
})

describe('Northern Ireland — RQIA served with nothing invented', () => {
  it('returns four evidence groupings, labelled as ours', async () => {
    const data = await readiness('rqia')
    expect(data.framework.id).toBe('rqia')
    // Relabelled from "Is care safe?" etc. Those read as RQIA's own words, and
    // the four-domain structure they came from could not be traced to anything
    // RQIA publishes. Same areas of care, labelled as ours.
    expect(data.domains.map((d: any) => d.label)).toEqual([
      'Safety and protection',
      'Assessment and planning',
      'Dignity and person-centred practice',
      'Governance and leadership',
    ])
  })

  it('sends no rating scale at all', async () => {
    const data = await readiness('rqia')
    expect(data.framework.ratings).toBeUndefined()
    // The invented three-band scale, gone.
    const labels = (data.framework.ratings ?? []).map((r: any) => r.label)
    expect(labels.join(' ')).not.toMatch(/Compliant/i)
  })

  it('withholds an overall rating', async () => {
    const data = await readiness('rqia')
    expect(data.overallLabel).toBeNull()
    expect(data.publishesOverallRating).toBe(false)
  })

  it('returns no fabricated statement identifiers', async () => {
    const data = await readiness('rqia')
    const ids = data.domains.flatMap((d: any) => d.statements.map((s: any) => s.id))
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) expect(id).not.toMatch(/^NI-/i)
  })

  it('says in its own description that the sub-items are ours', async () => {
    const data = await readiness('rqia')
    expect(data.framework.description).toMatch(/MeticleCare/)
    // Corrected: the Order is the Health and Personal *Social* Services
    // (Quality, Improvement and Regulation) (Northern Ireland) Order 2003.
    // See frameworks.test.ts for why a test asserting the old title is worse
    // than no test at all.
    expect(data.framework.source).toContain('Health and Personal Social Services')
  })
})

describe('England is unchanged', () => {
  it('still returns five key questions and an overall rating', async () => {
    const data = await readiness('cqc')
    expect(data.framework.id).toBe('cqc')
    expect(data.domains).toHaveLength(5)
    expect(data.domains.map((d: any) => d.key)).toEqual([
      'safe', 'effective', 'caring', 'responsive', 'well-led',
    ])
    expect(data.publishesOverallRating).toBe(true)
    expect(data.overallLabel).toBeTruthy()
    expect(data.framework.ratings.map((r: any) => r.label)).toEqual([
      'Outstanding', 'Good', 'Requires Improvement', 'Inadequate',
    ])
  })

  it('still scores CQC statements', async () => {
    const data = await readiness('cqc')
    const ids = data.domains.flatMap((d: any) => d.statements.map((s: any) => s.id))
    for (const id of ['S1', 'E1', 'C1', 'R1', 'W1']) expect(ids).toContain(id)
  })
})

describe('Scotland is unchanged', () => {
  it('still returns its four quality domains and six-point scale', async () => {
    const data = await readiness('care-inspectorate')
    expect(data.framework.id).toBe('care-inspectorate')
    expect(data.domains).toHaveLength(4)
    expect(data.framework.ratings).toHaveLength(6)
    expect(data.publishesOverallRating).toBe(true)
  })
})

describe('the framework list tells a client what it may show', () => {
  it('marks which regulators publish an overall rating', async () => {
    const { token } = await orgFor('cqc')
    const res = await request(app)
      .get('/cqc/frameworks')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    const byId = Object.fromEntries(res.body.map((f: any) => [f.id, f.publishesOverallRating]))
    expect(byId.cqc).toBe(true)
    expect(byId['care-inspectorate']).toBe(true)
    // CIW states it does not award one. RQIA publishes no rating to band.
    expect(byId.ciw).toBe(false)
    expect(byId.rqia).toBe(false)
  })
})
