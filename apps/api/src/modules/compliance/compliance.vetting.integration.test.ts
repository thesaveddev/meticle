/**
 * Nation-specific vetting, end to end.
 *
 * The finding this pins down was citable: MeticleCare claimed four-regulator
 * support at the scoring layer and only had England and Wales at the operational
 * layer. A Scottish provider's staff were shown as non-compliant for not holding
 * a DBS — a document Scotland does not use — while a valid PVG certificate in
 * the same table counted for nothing.
 *
 * These are integration tests on purpose. The unit tests in
 * compliance.vetting.test.ts prove the registry is right; these prove the
 * dashboard, which is what a manager actually reads, follows it.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createStaffProfile, generateToken } from '../../test/factories'
import { migrateQuery as db } from '../../shared/database'

vi.mock('../../shared/middleware/rateLimit.middleware', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}))

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

/** An org with an admin, a manager, and `count` staff profiles. */
async function orgWithStaff(options: {
  vettingScheme?: string
  count?: number
  role?: string
} = {}) {
  const { vettingScheme, count = 1, role = 'ORG_ADMIN' } = options
  const org = await createOrg()
  if (vettingScheme) {
    await db('UPDATE organizations SET vetting_scheme = $1 WHERE id = $2', [vettingScheme, org.id])
  }
  const user = await createUser({
    email: `vetting-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
    password: 'TestPass123!',
    role,
    organization_id: org.id,
  })
  const staff = []
  for (let i = 0; i < count; i++) {
    const su = await createUser({
      email: `carer-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      password: 'TestPass123!',
      role: 'CARE_WORKER',
      organization_id: org.id,
    })
    staff.push(await createStaffProfile({ user_id: su.id, first_name: `Carer${i}` }))
  }
  return { org, user, staff, token: generateToken(user) }
}

async function giveDocuments(
  staffId: string,
  types: string[],
  expiry: string | null = '2099-01-01',
) {
  for (const type of types) {
    await db(
      `INSERT INTO documents (staff_id, type, url, expiry_date, status)
       VALUES ($1, $2, '/files/private/vetting-test.pdf', $3, 'approved')`,
      [staffId, type, expiry],
    )
  }
}

const RIGHT_TO_WORK = ['PASSPORT', 'VISA', 'RIGHT_TO_WORK']

async function dashboardRow(token: string, staffId: string) {
  const res = await request(app)
    .get('/compliance/identity-dashboard')
    .set('Authorization', `Bearer ${token}`)
  expect(res.status).toBe(200)
  return res.body.staff.find((s: any) => s.id === staffId)
}

describe('four-nations vetting — Scotland (the reported failure)', () => {
  it('calls a Scottish worker with a PVG certificate compliant', async () => {
    const { staff, token } = await orgWithStaff({ vettingScheme: 'pvg_scotland' })
    await giveDocuments(staff[0].id, ['PVG', ...RIGHT_TO_WORK])

    const row = await dashboardRow(token, staff[0].id)

    // Before the fix this row read 'incomplete', with a red 'missing DBS'.
    expect(row.overall).toBe('compliant')
    expect(row.statuses.PVG.status).toBe('valid')
    expect(row.vetting_nation).toBe('scotland')
    expect(row.vetting_check_name).toBe('PVG')
  })

  it('never shows DBS as a requirement for a Scottish worker', async () => {
    const { staff, token } = await orgWithStaff({ vettingScheme: 'pvg_scotland' })
    await giveDocuments(staff[0].id, ['PVG', ...RIGHT_TO_WORK])

    const row = await dashboardRow(token, staff[0].id)

    // Not a missing entry, not a valid one: not part of the question at all.
    expect(row.statuses.DBS).toBeUndefined()
  })

  it('does not count a DBS as evidence in Scotland', async () => {
    const { staff, token } = await orgWithStaff({ vettingScheme: 'pvg_scotland' })
    // A DBS and full right to work, but the check Scotland actually uses is absent.
    await giveDocuments(staff[0].id, ['DBS', ...RIGHT_TO_WORK])

    const row = await dashboardRow(token, staff[0].id)

    expect(row.overall).toBe('incomplete')
    expect(row.statuses.PVG.status).toBe('missing')
    expect(row.statuses.PVG.issuer).toContain('Disclosure Scotland')
  })

  it('accepts a Disclosure Scotland record as Scotland evidence', async () => {
    const { staff, token } = await orgWithStaff({ vettingScheme: 'pvg_scotland' })
    await giveDocuments(staff[0].id, ['DISCLOSURE_SCOTLAND', ...RIGHT_TO_WORK])

    const row = await dashboardRow(token, staff[0].id)
    // One route into the scheme is enough. Asking for the other as well would
    // report a correctly-vetted carer as non-compliant.
    expect(row.overall).toBe('compliant')
    expect(row.statuses.PVG.status).toBe('valid')
    expect(row.statuses.PVG.doc.type).toBe('DISCLOSURE_SCOTLAND')
  })

  it('accepts a valid PVG even when an old Disclosure Scotland record has lapsed', async () => {
    const { staff, token } = await orgWithStaff({ vettingScheme: 'pvg_scotland' })
    await giveDocuments(staff[0].id, ['PVG', ...RIGHT_TO_WORK])
    await giveDocuments(staff[0].id, ['DISCLOSURE_SCOTLAND'], '2000-01-01')

    const row = await dashboardRow(token, staff[0].id)
    // The alternatives are alternatives: a lapsed one the carer no longer needs
    // to renew must not drag the current one down.
    expect(row.overall).toBe('compliant')
  })

  it('does not list a DBS among a Scottish worker documents', async () => {
    const { staff, token } = await orgWithStaff({ vettingScheme: 'pvg_scotland', count: 2 })
    await giveDocuments(staff[0].id, ['PVG', ...RIGHT_TO_WORK])
    // The wrong-regulator document a well-meaning admin might upload.
    await giveDocuments(staff[1].id, ['DBS', 'PVG', ...RIGHT_TO_WORK])

    const row = await dashboardRow(token, staff[0].id)
    // Surfacing it would invite a manager to read a document the wrong
    // regulator will not accept.
    expect(row.documents.map((d: any) => d.type).sort()).toEqual(
      ['PASSPORT', 'PVG', 'RIGHT_TO_WORK', 'VISA'],
    )
  })
})

describe('four-nations vetting — Northern Ireland', () => {
  it('calls an AccessNI check the required evidence', async () => {
    const { staff, token } = await orgWithStaff({ vettingScheme: 'accessni_northern_ireland' })
    await giveDocuments(staff[0].id, ['ACCESSNI', ...RIGHT_TO_WORK])

    const row = await dashboardRow(token, staff[0].id)
    expect(row.overall).toBe('compliant')
    expect(row.statuses.DBS).toBeUndefined()
    expect(row.vetting_nation).toBe('northern_ireland')
  })

  it('rejects a DBS in Northern Ireland', async () => {
    const { staff, token } = await orgWithStaff({ vettingScheme: 'accessni_northern_ireland' })
    await giveDocuments(staff[0].id, ['DBS', ...RIGHT_TO_WORK])

    const row = await dashboardRow(token, staff[0].id)
    expect(row.overall).toBe('incomplete')
    // Keyed on the check's own name, which is how an England row has always
    // been keyed on 'DBS'.
    expect(row.statuses.AccessNI.status).toBe('missing')
  })
})

describe('four-nations vetting — England and Wales are unchanged', () => {
  it('still requires a DBS by default', async () => {
    // The default is dbs_england_wales, so an org that has never touched the
    // setting must behave exactly as it did before any of this.
    const { staff, token } = await orgWithStaff()
    await giveDocuments(staff[0].id, RIGHT_TO_WORK)

    const row = await dashboardRow(token, staff[0].id)
    expect(row.overall).toBe('incomplete')
    expect(row.statuses.DBS.status).toBe('missing')
  })

  it('still reads an England worker as compliant with a DBS', async () => {
    const { staff, token } = await orgWithStaff()
    await giveDocuments(staff[0].id, ['DBS', ...RIGHT_TO_WORK])

    const row = await dashboardRow(token, staff[0].id)
    expect(row.overall).toBe('compliant')
    expect(row.vetting_scheme).toBe('dbs_england_wales')
  })

  it('still requires a DBS in Wales', async () => {
    const { staff, token } = await orgWithStaff({ vettingScheme: 'ciw_wales' })
    await giveDocuments(staff[0].id, ['DBS', ...RIGHT_TO_WORK])

    const row = await dashboardRow(token, staff[0].id)
    expect(row.overall).toBe('compliant')
    expect(row.vetting_nation).toBe('wales')
  })

  it('still requires right to work in Scotland', async () => {
    // A nation-specific fix must not quietly drop the UK-wide requirement.
    const { staff, token } = await orgWithStaff({ vettingScheme: 'pvg_scotland' })
    await giveDocuments(staff[0].id, ['PVG'])

    const row = await dashboardRow(token, staff[0].id)
    expect(row.overall).toBe('incomplete')
    expect(row.statuses.RIGHT_TO_WORK.status).toBe('missing')
  })
})

describe('four-nations vetting — a person in the wrong nation of the org', () => {
  it('prefers a worker own scheme over the organisation one', async () => {
    const { org, staff, token } = await orgWithStaff({ count: 2 })
    // An England-registered provider with one carer working in Scotland.
    await db('UPDATE staff_profiles SET vetting_scheme = $1 WHERE id = $2', ['pvg_scotland', staff[0].id])
    await giveDocuments(staff[0].id, ['PVG', ...RIGHT_TO_WORK])

    const row = await dashboardRow(token, staff[0].id)
    expect(row.overall).toBe('compliant')
    expect(row.vetting_scheme).toBe('pvg_scotland')
    // The organisation is still an English one; only this person differs.
    const orgRow = await request(app)
      .get('/compliance/vetting-scheme')
      .set('Authorization', `Bearer ${token}`)
    expect(orgRow.body.vetting_scheme).toBe('dbs_england_wales')
    expect(orgRow.body.staff_with_own_scheme).toBe(1)
  })

  it('leaves the rest of the organisation on the org scheme', async () => {
    const { staff, token } = await orgWithStaff({ count: 2 })
    await db('UPDATE staff_profiles SET vetting_scheme = $1 WHERE id = $2', ['pvg_scotland', staff[0].id])
    await giveDocuments(staff[0].id, ['PVG', ...RIGHT_TO_WORK])
    await giveDocuments(staff[1].id, ['DBS', ...RIGHT_TO_WORK])

    const english = await dashboardRow(token, staff[1].id)
    expect(english.overall).toBe('compliant')
    expect(english.vetting_scheme).toBe('dbs_england_wales')
  })

  it('applies a change of org scheme to everyone without an override', async () => {
    const { org, staff, token } = await orgWithStaff({ vettingScheme: 'pvg_scotland' })
    await giveDocuments(staff[0].id, ['DBS', ...RIGHT_TO_WORK])
    expect((await dashboardRow(token, staff[0].id)).overall).toBe('incomplete')

    await request(app)
      .put('/compliance/vetting-scheme')
      .set('Authorization', `Bearer ${token}`)
      .send({ vetting_scheme: 'dbs_england_wales' })

    // The same documents, now read against England's scheme.
    const row = await dashboardRow(token, staff[0].id)
    expect(row.overall).toBe('compliant')
  })
})

describe('four-nations vetting — the settings endpoints', () => {
  it('lists the four schemes', async () => {
    const { token } = await orgWithStaff()
    const res = await request(app)
      .get('/compliance/vetting-schemes')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.schemes).toHaveLength(4)
    expect(res.body.schemes.map((s: any) => s.id).sort()).toEqual([
      'accessni_northern_ireland', 'ciw_wales', 'dbs_england_wales', 'pvg_scotland',
    ])
  })

  it('reports the default and its consequences for a new org', async () => {
    const { token } = await orgWithStaff()
    const res = await request(app)
      .get('/compliance/vetting-scheme')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.vetting_scheme).toBe('dbs_england_wales')
    expect(res.body.document_types).toContain('DBS')
    expect(res.body.document_types).toContain('RIGHT_TO_WORK')
    expect(res.body.staff_with_own_scheme).toBe(0)
  })

  it('lets an org admin change it', async () => {
    const { token } = await orgWithStaff()
    const res = await request(app)
      .put('/compliance/vetting-scheme')
      .set('Authorization', `Bearer ${token}`)
      .send({ vetting_scheme: 'pvg_scotland' })

    expect(res.status).toBe(200)
    expect(res.body.vetting_scheme).toBe('pvg_scotland')
    expect(res.body.document_types).toContain('PVG')
    expect(res.body.document_types).not.toContain('DBS')
  })

  it('stops a manager changing it', async () => {
    // This decides which background check the whole organisation is measured
    // against, so it is an ORG_ADMIN decision and not a rostering preference.
    const { token } = await orgWithStaff({ role: 'MANAGER' })
    const res = await request(app)
      .put('/compliance/vetting-scheme')
      .set('Authorization', `Bearer ${token}`)
      .send({ vetting_scheme: 'pvg_scotland' })

    expect(res.status).toBe(403)
  })

  it('rejects a scheme that does not exist', async () => {
    const { token } = await orgWithStaff()
    const res = await request(app)
      .put('/compliance/vetting-scheme')
      .set('Authorization', `Bearer ${token}`)
      .send({ vetting_scheme: 'dbs_mars' })

    expect(res.status).toBe(400)
  })

  it('rejects a missing scheme rather than defaulting silently', async () => {
    const { token } = await orgWithStaff({ vettingScheme: 'pvg_scotland' })
    const res = await request(app)
      .put('/compliance/vetting-scheme')
      .set('Authorization', `Bearer ${token}`)
      .send({})

    expect(res.status).toBe(400)

    const after = await request(app)
      .get('/compliance/vetting-scheme')
      .set('Authorization', `Bearer ${token}`)
    expect(after.body.vetting_scheme).toBe('pvg_scotland')
  })

  it('requires auth', async () => {
    expect((await request(app).get('/compliance/vetting-scheme')).status).toBe(401)
    expect((await request(app).get('/compliance/vetting-schemes')).status).toBe(401)
  })
})

describe('four-nations vetting — the scoring layer now agrees with the data layer', () => {
  /**
   * This is the whole finding in one assertion.
   *
   * The frameworks were already four: getReadiness returned a Care Inspectorate
   * score, a CIW score and an RQIA score. But document_compliance_rate was
   * computed from one hardcoded England-and-Wales document list for all of them.
   * So the layer making the four-regulator claim measured Scotland and Northern
   * Ireland against evidence only England and Wales produces. A Scottish
   * provider with a complete, current PVG file scored 0% on documents.
   */
  it('counts a Scottish PVG file in the readiness score', async () => {
    const { org, staff, token } = await orgWithStaff({ vettingScheme: 'pvg_scotland' })
    await db('UPDATE organizations SET regulator = $1 WHERE id = $2', ['care-inspectorate', org.id])
    await giveDocuments(staff[0].id, ['PVG', ...RIGHT_TO_WORK])

    const res = await request(app)
      .get('/cqc/readiness')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    // The framework really is the Scottish one, so this is a four-nations score.
    expect(res.body.data.framework.id).toBe('care-inspectorate')
    // 3 of 3 held documents valid. Before the fix: 0, because none were DBS.
    expect(res.body.data.metrics.document_compliance_rate).toBe(100)
    expect(res.body.data.metrics.background_check_coverage_rate).toBe(100)
  })

  it('does not read 100% when nobody in Scotland holds a PVG', async () => {
    const { org, staff, token } = await orgWithStaff({ vettingScheme: 'pvg_scotland' })
    await db('UPDATE organizations SET regulator = $1 WHERE id = $2', ['care-inspectorate', org.id])
    // Full set of passports and visas, and no PVG at all.
    await giveDocuments(staff[0].id, ['DBS', ...RIGHT_TO_WORK])

    const res = await request(app)
      .get('/cqc/readiness')
      .set('Authorization', `Bearer ${token}`)

    // document_compliance_rate is the share of held documents that are valid,
    // so a DBS-free pile of passports still scores 100 there. That is why
    // coverage is a separate metric, and why the gap message exists.
    expect(res.body.data.metrics.background_check_coverage_rate).toBe(0)
    expect(res.body.data.gaps.join(' ')).toContain('PVG')
  })

  it('names the check the provider actually needs, not DBS', async () => {
    const { org, staff, token } = await orgWithStaff({ vettingScheme: 'pvg_scotland' })
    await db('UPDATE organizations SET regulator = $1 WHERE id = $2', ['care-inspectorate', org.id])
    await giveDocuments(staff[0].id, [...RIGHT_TO_WORK])

    const res = await request(app)
      .get('/cqc/readiness')
      .set('Authorization', `Bearer ${token}`)

    // Telling a Scottish provider to go and get DBS certificates is the
    // original defect wearing different clothes.
    expect(res.body.data.gaps.join(' ')).not.toContain('DBS')
  })

  it('counts an AccessNI file for an RQIA score', async () => {
    const { org, staff, token } = await orgWithStaff({ vettingScheme: 'accessni_northern_ireland' })
    await db('UPDATE organizations SET regulator = $1 WHERE id = $2', ['rqia', org.id])
    await giveDocuments(staff[0].id, ['ACCESSNI', ...RIGHT_TO_WORK])

    const res = await request(app)
      .get('/cqc/readiness')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body.data.framework.id).toBe('rqia')
    expect(res.body.data.metrics.background_check_coverage_rate).toBe(100)
  })

  it('leaves the English document rate exactly as it was', async () => {
    const { staff, token } = await orgWithStaff()
    await giveDocuments(staff[0].id, ['DBS', ...RIGHT_TO_WORK])

    const res = await request(app)
      .get('/cqc/readiness')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body.data.framework.id).toBe('cqc')
    expect(res.body.data.metrics.document_compliance_rate).toBe(100)
    expect(res.body.data.metrics.background_check_coverage_rate).toBe(100)
  })

  it('reports zero coverage when an English org has nobody checked', async () => {
    const { token } = await orgWithStaff()
    const res = await request(app)
      .get('/cqc/readiness')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body.data.metrics.background_check_coverage_rate).toBe(0)
    // And it says so, rather than passing silently on an empty document table.
    expect(res.body.data.gaps.join(' ')).toContain('DBS')
  })

  it('scores a mixed workforce per person, not per organisation', async () => {
    // One English carer and one Scottish, in an English-registered provider.
    const { staff, token } = await orgWithStaff({ count: 2 })
    await db('UPDATE staff_profiles SET vetting_scheme = $1 WHERE id = $2', ['pvg_scotland', staff[1].id])
    // Carer 0 is English: a DBS. Carer 1 is Scottish, and holds a DBS —
    // the wrong one. The England-only list would have scored that DBS as
    // valid evidence for them; the Scottish one excludes it entirely.
    await giveDocuments(staff[0].id, ['DBS', ...RIGHT_TO_WORK])
    await giveDocuments(staff[1].id, ['DBS', ...RIGHT_TO_WORK])

    const res = await request(app)
      .get('/cqc/readiness')
      .set('Authorization', `Bearer ${token}`)

    // Carer 1's DBS is not counted at all — neither valid nor invalid — so the
    // held-document rate stays clean rather than being dragged down by evidence
    // the wrong regulator will not accept.
    expect(res.body.data.metrics.document_compliance_rate).toBe(100)
    // And the person it does not count for is visibly uncovered.
    expect(res.body.data.metrics.background_check_coverage_rate).toBe(50)
  })

  it('counts a PVG as valid evidence for the person who actually holds it', async () => {
    const { staff, token } = await orgWithStaff({ count: 2 })
    await db('UPDATE staff_profiles SET vetting_scheme = $1 WHERE id = $2', ['pvg_scotland', staff[1].id])
    await giveDocuments(staff[0].id, ['DBS', ...RIGHT_TO_WORK])
    await giveDocuments(staff[1].id, ['PVG', ...RIGHT_TO_WORK])

    const res = await request(app)
      .get('/cqc/readiness')
      .set('Authorization', `Bearer ${token}`)

    // Before the fix this was 0: neither the DBS nor the PVG was in the
    // single hardcoded list, so every document was discarded.
    expect(res.body.data.metrics.document_compliance_rate).toBe(100)
    expect(res.body.data.metrics.background_check_coverage_rate).toBe(100)
  })

  it('counts one person covered and one not, in the same organisation', async () => {
    const { staff, token } = await orgWithStaff({ vettingScheme: 'pvg_scotland', count: 2 })
    await giveDocuments(staff[0].id, ['PVG', ...RIGHT_TO_WORK])
    await giveDocuments(staff[1].id, [...RIGHT_TO_WORK])

    const res = await request(app)
      .get('/cqc/readiness')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body.data.metrics.background_check_coverage_rate).toBe(50)
  })

  it('does not count an expired check as coverage', async () => {
    const { staff, token } = await orgWithStaff()
    // Approved, but the certificate ran out last millennium. A regulator would
    // not accept it, so neither does the score.
    await giveDocuments(staff[0].id, ['DBS', ...RIGHT_TO_WORK], '2000-01-01')

    const res = await request(app)
      .get('/cqc/readiness')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body.data.metrics.background_check_coverage_rate).toBe(0)
  })

  it('does not count an unapproved check as coverage', async () => {
    const { staff, token } = await orgWithStaff()
    await giveDocuments(staff[0].id, ['DBS', ...RIGHT_TO_WORK])
    await db(
      `UPDATE documents SET status = 'rejected' WHERE staff_id = $1 AND type = 'DBS'`,
      [staff[0].id],
    )

    const res = await request(app)
      .get('/cqc/readiness')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body.data.metrics.background_check_coverage_rate).toBe(0)
  })

  it('counts a check with no expiry date, since some do not expire', async () => {
    const { staff, token } = await orgWithStaff()
    await giveDocuments(staff[0].id, ['DBS', ...RIGHT_TO_WORK], null)

    const res = await request(app)
      .get('/cqc/readiness')
      .set('Authorization', `Bearer ${token}`)

    // A NULL expiry means "no expiry", which is different from "expired" and
    // must not be read as a missing date.
    expect(res.body.data.metrics.background_check_coverage_rate).toBe(100)
  })

  it('counts a Disclosure Scotland record as covering the check', async () => {
    const { org, staff, token } = await orgWithStaff({ vettingScheme: 'pvg_scotland' })
    await db('UPDATE organizations SET regulator = $1 WHERE id = $2', ['care-inspectorate', org.id])
    await giveDocuments(staff[0].id, ['DISCLOSURE_SCOTLAND', ...RIGHT_TO_WORK])

    const res = await request(app)
      .get('/cqc/readiness')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body.data.metrics.background_check_coverage_rate).toBe(100)
  })
})
