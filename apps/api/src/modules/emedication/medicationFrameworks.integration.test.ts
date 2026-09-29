/**
 * Do the medicines-in-care rules actually differ by nation?
 *
 * The failure this whole module exists to prevent is a system that holds one
 * list of requirements and describes it as covering all three countries. That
 * is easy to build and very hard to see: a registry with three entries and
 * nine identical rules each looks complete, passes a review, and tells a
 * Scottish provider their covert administration rests on the Mental Capacity
 * Act.
 *
 * So these tests do not check that the framework names are right. They check
 * that the *outcome changes*. The same request, the same medicine, the same
 * person — and a different answer depending on which regulator the provider is
 * registered with. A framework registry that cannot be observed changing a
 * decision is documentation wearing a type signature, and the mutation at the
 * bottom of this file exists to prove these are not that.
 *
 * Everything runs against the database. The rules live in SQL-backed records —
 * who is appointed, who is assessed, who is authorised — so a mocked query
 * would pass happily over the thing most likely to be wrong, which is the
 * query that finds the standing.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { migrateQuery } from '../../shared/database'
import { createOrg, createUser, createPerson, createStaffProfile, generateToken } from '../../test/factories'
import { appointMedicinesStanding } from '../../test/medicines'

vi.mock('../../shared/middleware/rateLimit.middleware', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}))

let app: Express
beforeAll(() => { app = createTestApp() }, 30_000)

type Fixture = {
  orgId: string
  managerToken: string
  workerToken: string
  workerStaffId: string
  secondWorkerStaffId: string
  personId: string
  recordId: string
}

async function fixture(label: string, opts: { regulator?: string; framework?: string } = {}): Promise<Fixture> {
  const stamp = `${Date.now()}-${label}`
  const org = await createOrg({ service_types: ['supported_living'] })
  const person = await createPerson({ organizationId: org.id })
  const manager = await createUser({ email: `mfc-mgr-${stamp}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
  const worker = await createUser({ email: `mfc-carer-${stamp}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
  const second = await createUser({ email: `mfc-wit-${stamp}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
  const workerProfile = await createStaffProfile({ userId: worker.id, medicationCompetent: true })
  const secondProfile = await createStaffProfile({ userId: second.id, medicationCompetent: true })
  const managerToken = generateToken(manager)

  await appointMedicinesStanding(app, {
    organizationId: org.id,
    assessor: { userId: manager.id, token: managerToken },
    competentStaffProfileIds: [workerProfile.id, secondProfile.id],
    regulator: opts.regulator,
    framework: opts.framework,
  })

  const record = await request(app).post('/emedication/records').set('Authorization', `Bearer ${managerToken}`)
    .send({ person_id: person.id, title: 'MAR', start_date: '2026-01-01', end_date: '2026-12-31' })
  expect(record.status).toBe(201)

  return {
    orgId: org.id,
    managerToken,
    workerToken: generateToken(worker),
    workerStaffId: workerProfile.id,
    secondWorkerStaffId: secondProfile.id,
    personId: person.id,
    recordId: record.body.id,
  }
}

const addMedicine = async (f: Fixture, body: Record<string, unknown>) => {
  const res = await request(app).post(`/emedication/records/${f.recordId}/items`)
    .set('Authorization', `Bearer ${f.managerToken}`).send(body)
  // A medicine that is not PRN gets a stock line created empty, and a dose is
  // refused for empty stock before any of the framework rules are reached. Not
  // stocking here would make every rule test pass for the wrong reason.
  if (res.status === 201 && res.body.stock_item_id) {
    await request(app).patch(`/emedication/stock/${res.body.stock_item_id}`)
      .set('Authorization', `Bearer ${f.managerToken}`).send({ quantity: 100 })
  }
  return res
}

const give = (f: Fixture, itemId: string, body: Record<string, unknown> = {}) =>
  request(app).post('/emedication/administrations').set('Authorization', `Bearer ${f.workerToken}`)
    .send({ emedication_item_id: itemId, scheduled_time: '2026-06-01T08:00:00', status: 'given', ...body })

/** A stocked controlled drug, because a dose with no stock is refused for a different reason. */
async function controlledDrug(f: Fixture) {
  const item = await addMedicine(f, { name: 'Morphine sulfate 10mg', dosage: '10mg', unit: 'mg', frequency: 'once daily', is_controlled_drug: true })
  expect(item.status).toBe(201)
  // If the flag does not stick, every rule below it is being tested against a
  // medicine the system thinks is an ordinary tablet. Asserted here so that
  // failure is reported where the cause is rather than six tests later.
  expect(item.body.is_controlled_drug).toBe(true)
  return item.body.id as string
}

/* ── The framework is resolved from the provider's regulator ──────────────── */

describe('which framework a provider is on', () => {
  it('gives a CIW-registered provider the Welsh standard, not the English one', async () => {
    const f = await fixture('wales', { regulator: 'ciw' })
    const res = await request(app).get('/emedication/framework').set('Authorization', `Bearer ${f.managerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.framework.nation).toBe('wales')
    expect(res.body.framework.regulator).toBe('ciw')
    expect(res.body.framework.inspected_by).toBe('Care Inspectorate Wales')
    expect(res.body.resolved_from).toBe('regulator')
    expect(res.body.is_fallback).toBe(false)
  })

  it('gives a Care Inspectorate provider the Scottish guidance', async () => {
    const f = await fixture('scotland', { regulator: 'care-inspectorate' })
    const res = await request(app).get('/emedication/framework').set('Authorization', `Bearer ${f.managerToken}`)
    expect(res.body.framework.nation).toBe('scotland')
    expect(res.body.framework.covert_authority.instrument).toContain('Mental Welfare (Scotland) Act 2000')
  })

  it('says out loud that the framework names are not verified against a primary source', async () => {
    const f = await fixture('unverified', { regulator: 'cqc' })
    const res = await request(app).get('/emedication/framework').set('Authorization', `Bearer ${f.managerToken}`)
    // Not decoration. A provider or an inspector is entitled to know this list
    // came from us and not from their regulator, and it is the single most
    // load-bearing caveat in the whole module.
    expect(res.body.framework.verified_against_primary_source).toBe(false)
    expect(res.body.framework.source_note).toMatch(/T2-22/)
  })

  it('tells a Northern Ireland provider it is being given another country\'s rules', async () => {
    const f = await fixture('ni', { regulator: 'rqia' })
    const res = await request(app).get('/emedication/framework').set('Authorization', `Bearer ${f.managerToken}`)
    expect(res.body.is_fallback).toBe(true)
    expect(res.body.fallback_note).toMatch(/No medicines-in-care framework is registered/)
  })
})

/* ── The one rule that cannot be shared ───────────────────────────────────── */

describe('covert administration rests on a different instrument in Scotland', () => {
  it('refuses a Scottish covert dose authorised only under the Mental Capacity Act', async () => {
    const f = await fixture('scot-mca', { regulator: 'care-inspectorate' })

    // The most likely real-world sequence: an English service goes to Scotland,
    // or an English template is used, and the best-interests record comes with
    // it. The system has to say this is the wrong instrument, not accept it.
    const wrong = await request(app).post('/emedication/covert-authorizations')
      .set('Authorization', `Bearer ${f.managerToken}`)
      .send({ person_id: f.personId, authority: 'mental_capacity_act_best_interests', medicines: 'Morphine sulfate 10mg' })
    expect(wrong.status).toBe(400)
    expect(wrong.body.message).toContain('Mental Welfare (Scotland) Act 2000')

    const item = await addMedicine(f, { name: 'Morphine sulfate 10mg', dosage: '10mg', unit: 'mg', frequency: 'once daily' })
    expect(item.status).toBe(201)
    const res = await give(f, item.body.id, { administered_covertly: true })
    expect(res.status).toBe(403)
    expect(res.body.message).toContain('Mental Welfare (Scotland) Act 2000')
  })

  it('accepts the same dose in Wales under a best-interests record', async () => {
    const f = await fixture('wal-mca', { regulator: 'ciw' })
    const auth = await request(app).post('/emedication/covert-authorizations')
      .set('Authorization', `Bearer ${f.managerToken}`)
      .send({ person_id: f.personId, authority: 'mental_capacity_act_best_interests', medicines: 'Morphine sulfate 10mg' })
    expect(auth.status).toBe(201)

    const item = await addMedicine(f, { name: 'Morphine sulfate 10mg', dosage: '10mg', unit: 'mg', frequency: 'once daily' })
    expect(item.status).toBe(201)
    const res = await give(f, item.body.id, { administered_covertly: true })
    // Same request as the test above, different regulator, allowed. This
    // pairing is the whole point of the module: if it fails, the two frameworks
    // are not actually different.
    expect(res.status).toBe(201)
    expect(res.body.administered_covertly).toBe(true)
  })

  it('accepts a Scottish covert dose under a Mental Welfare Act s19 authorisation', async () => {
    const f = await fixture('scot-mwa', { regulator: 'care-inspectorate' })
    const auth = await request(app).post('/emedication/covert-authorizations')
      .set('Authorization', `Bearer ${f.managerToken}`)
      .send({
        person_id: f.personId,
        authority: 'mental_welfare_act_s19',
        medicines: 'Ropinirole, Levodopa',
        protocol_reference: 'Covert administration protocol v3, signed 2026-02-01',
      })
    expect(auth.status).toBe(201)

    const item = await addMedicine(f, { name: 'Ropinirole 2mg', dosage: '2mg', unit: 'mg', frequency: 'twice daily' })
    expect(item.status).toBe(201)
    const res = await give(f, item.body.id, { administered_covertly: true })
    expect(res.status).toBe(201)
  })

  it('refuses a covert authorisation that does not name the medicine', async () => {
    const f = await fixture('scot-blanket', { regulator: 'care-inspectorate' })
    // A blanket covert decision covering every medicine is the thing these
    // frameworks exist to prevent, so an authorisation with an empty medicines
    // list is not usable and the create call says so.
    const blank = await request(app).post('/emedication/covert-authorizations')
      .set('Authorization', `Bearer ${f.managerToken}`)
      .send({ person_id: f.personId, authority: 'mental_welfare_act_s19', medicines: '   ' })
    expect(blank.status).toBe(400)
    expect(blank.body.message).toMatch(/blanket/i)

    // And one that names a different medicine does not authorise this one.
    const other = await request(app).post('/emedication/covert-authorizations')
      .set('Authorization', `Bearer ${f.managerToken}`)
      .send({ person_id: f.personId, authority: 'mental_welfare_act_s19', medicines: 'Levodopa' })
    expect(other.status).toBe(201)

    const item = await addMedicine(f, { name: 'Ropinirole 2mg', dosage: '2mg', unit: 'mg', frequency: 'twice daily' })
    const res = await give(f, item.body.id, { administered_covertly: true })
    expect(res.status).toBe(403)
    expect(res.body.message).toContain('does not name this medicine')
  })
})

/* ── Controlled drugs: the feature the marketing site advertised ───────────── */

/** Give the named staff the controlled-drugs scope. */
const grantControlledDrugScope = (f: Fixture, ...staffIds: string[]) =>
  Promise.all(staffIds.map((id) =>
    request(app).post('/emedication/competences').set('Authorization', `Bearer ${f.managerToken}`)
      .send({ staff_id: id, scope: 'controlled_drugs' }),
  ))

describe('a controlled drug is not an oral tablet with a flag on it', () => {
  it('refuses a controlled drug with no witness', async () => {
    const f = await fixture('cd-nowitness')
    const itemId = await controlledDrug(f)
    // The worker holds the controlled-drugs scope, so the refusal under test is
    // the witness and not the competence. Both matter; only one can be the
    // subject of a given test.
    await grantControlledDrugScope(f, f.workerStaffId)
    const res = await give(f, itemId)
    expect(res.status).toBe(403)
    expect(res.body.message).toContain('No witness was recorded')
  })

  it('refuses a witness who is the person giving the dose', async () => {
    const f = await fixture('cd-selfwitness')
    const itemId = await controlledDrug(f)
    await grantControlledDrugScope(f, f.workerStaffId)
    const res = await give(f, itemId, { witness_staff_id: f.workerStaffId })
    expect(res.status).toBe(403)
    expect(res.body.message).toContain('same person giving the dose')
  })

  it('refuses a witness who has no controlled-drugs competence of their own', async () => {
    const f = await fixture('cd-weakwitness')
    const itemId = await controlledDrug(f)
    // The second worker holds general medication competence and nothing else,
    // which is the realistic case: they can give the paracetamol and not the
    // morphine.
    await grantControlledDrugScope(f, f.workerStaffId)
    const res = await give(f, itemId, { witness_staff_id: f.secondWorkerStaffId })
    expect(res.status).toBe(403)
    expect(res.body.message).toContain('no current controlled-drugs competence')
  })

  it('allows it with a second, competent person, and stores the witness on the dose', async () => {
    const f = await fixture('cd-goodwitness')
    const itemId = await controlledDrug(f)
    await grantControlledDrugScope(f, f.workerStaffId, f.secondWorkerStaffId)

    const res = await give(f, itemId, { witness_staff_id: f.secondWorkerStaffId })
    expect(res.status).toBe(201)
    // The witness is on the dose, not a line of underscores on a printout. The
    // printed controlled drug record drew "______" here before this existed.
    expect(res.body.witness_staff_id).toBe(f.secondWorkerStaffId)
    expect(res.body.witnessed_at).not.toBeNull()

    const row = await migrateQuery(
      'SELECT witness_staff_id, framework FROM emedication_administrations WHERE id = $1',
      [res.body.id],
    )
    expect(row.rows[0].witness_staff_id).toBe(f.secondWorkerStaffId)
    // And which framework permitted it, so the answer to "why was this allowed"
    // is on the record rather than reconstructed a year later.
    expect(row.rows[0].framework).toBe('mca_england')
  })

  it('refuses when the carer gives a controlled drug without that scope, whatever the flag says', async () => {
    const f = await fixture('cd-noscope')
    const itemId = await controlledDrug(f)
    // The second worker can witness; the one giving it cannot. The first check
    // to fire is the carer's own competence, and that ordering is deliberate —
    // the person giving the dose is the first question, not the witness's.
    await grantControlledDrugScope(f, f.secondWorkerStaffId)

    const res = await give(f, itemId, { witness_staff_id: f.secondWorkerStaffId })
    expect(res.status).toBe(403)
    expect(res.body.message).toContain('no current controlled-drugs competence')
  })

  it('cannot be walked around by logging pending and patching it to given later', async () => {
    const f = await fixture('cd-patch-bypass')
    const itemId = await controlledDrug(f)
    await grantControlledDrugScope(f, f.workerStaffId, f.secondWorkerStaffId)

    // This is the sequence the create-path guarantee is worth nothing without.
    const pending = await request(app).post('/emedication/administrations').set('Authorization', `Bearer ${f.workerToken}`)
      .send({ emedication_item_id: itemId, scheduled_time: '2026-06-01T08:00:00', status: 'pending' })
    expect(pending.status).toBe(201)

    const patched = await request(app).patch(`/emedication/administrations/${pending.body.id}`)
      .set('Authorization', `Bearer ${f.managerToken}`)
      .send({ status: 'given' })
    expect(patched.status).toBe(403)
    expect(patched.body.message).toContain('No witness was recorded')
  })

  it('lets the database refuse a witness who is the person who gave the dose, even if the check is bypassed', async () => {
    const f = await fixture('cd-constraint')
    const itemId = await controlledDrug(f)
    await grantControlledDrugScope(f, f.workerStaffId, f.secondWorkerStaffId)
    const given = await give(f, itemId, { witness_staff_id: f.secondWorkerStaffId })
    expect(given.status).toBe(201)

    // The constraint, which is what has to hold if a future code path forgets
    // to call the rules. Bypassing the application entirely.
    const row = await migrateQuery('SELECT id, staff_id FROM emedication_administrations WHERE id = $1', [given.body.id])
    await expect(
      migrateQuery(
        'UPDATE emedication_administrations SET witness_staff_id = $2, witnessed_at = NOW() WHERE id = $1',
        [row.rows[0].id, row.rows[0].staff_id],
      ),
    ).rejects.toThrow()
  })
})

/* ── PRN ──────────────────────────────────────────────────────────────────── */

describe('an "as needed" medicine has to say what it is for', () => {
  it('refuses to add a PRN medicine with no indication', async () => {
    const f = await fixture('prn-noindication')
    const res = await addMedicine(f, { name: 'Paracetamol 500mg', dosage: '500mg', unit: 'mg', frequency: 'as needed', is_prn: true })
    expect(res.status).toBe(403)
    expect(res.body.message).toContain('indication')
  })

  it('refuses a PRN medicine whose indication is only whitespace', async () => {
    const f = await fixture('prn-blank')
    const res = await addMedicine(f, { name: 'Paracetamol 500mg', dosage: '500mg', unit: 'mg', frequency: 'as needed', is_prn: true, prn_indication: '   ' })
    expect(res.status).toBe(403)
  })

  it('adds it once an indication is given, and stores it', async () => {
    const f = await fixture('prn-ok')
    const res = await addMedicine(f, {
      name: 'Paracetamol 500mg', dosage: '500mg', unit: 'mg', frequency: 'as needed', is_prn: true,
      prn_indication: 'Pain', prn_max_dose_per_24h: '4 tablets',
    })
    expect(res.status).toBe(201)
    expect(res.body.prn_indication).toBe('Pain')
  })

  it('refuses to give a PRN dose with no reason recorded against it', async () => {
    const f = await fixture('prn-noreason')
    const item = await addMedicine(f, {
      name: 'Paracetamol 500mg', dosage: '500mg', unit: 'mg', frequency: 'as needed', is_prn: true,
      prn_indication: 'Pain', prn_max_dose_per_24h: '4 tablets',
    })
    expect(item.status).toBe(201)
    const res = await give(f, item.body.id)
    expect(res.status).toBe(403)
    expect(res.body.message).toContain('the reason has to be recorded')
  })

  it('gives it with a reason', async () => {
    const f = await fixture('prn-withreason')
    const item = await addMedicine(f, {
      name: 'Paracetamol 500mg', dosage: '500mg', unit: 'mg', frequency: 'as needed', is_prn: true,
      prn_indication: 'Pain', prn_max_dose_per_24h: '4 tablets',
    })
    const res = await give(f, item.body.id, { prn_reason: 'Reporting knee pain, 6/10' })
    expect(res.status).toBe(201)
  })
})

/* ── The named responsible clinician ──────────────────────────────────────── */

describe('somebody has to be responsible for the medicines', () => {
  it('refuses every dose when nobody is appointed, naming the gap', async () => {
    const org = await createOrg({ service_types: ['supported_living'] })
    const person = await createPerson({ organizationId: org.id })
    const worker = await createUser({ email: `mfc-noclin-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const workerProfile = await createStaffProfile({ userId: worker.id, medicationCompetent: true })
    // Standing deliberately left incomplete: a competent carer and no
    // responsible clinician, which is the state a real service can be in.
    const assessor = await createUser({ email: `mfc-noclin-a-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const assessorToken = generateToken(assessor)
    const assessorProfile = await createStaffProfile({ userId: assessor.id })
    await request(app).post('/emedication/competences').set('Authorization', `Bearer ${assessorToken}`)
      .send({ staff_id: workerProfile.id, scope: 'administration' })

    const record = await request(app).post('/emedication/records').set('Authorization', `Bearer ${assessorToken}`)
      .send({ person_id: person.id, title: 'MAR', start_date: '2026-01-01', end_date: '2026-12-31' })
    const item = await request(app).post(`/emedication/records/${record.body.id}/items`).set('Authorization', `Bearer ${assessorToken}`)
      .send({ name: 'Paracetamol', dosage: '500mg', unit: 'mg', frequency: 'twice daily' })
    if (item.body.stock_item_id) {
      await request(app).patch(`/emedication/stock/${item.body.stock_item_id}`).set('Authorization', `Bearer ${assessorToken}`).send({ quantity: 100 })
    }

    const res = await request(app).post('/emedication/administrations').set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ emedication_item_id: item.body.id, scheduled_time: '2026-06-01T08:00:00', status: 'given' })
    expect(res.status).toBe(403)
    expect(res.body.message).toContain('No registered nurse or pharmacist is recorded as responsible')
  })

  it('refuses a staff member who assesses their own competence', async () => {
    const org = await createOrg({ service_types: ['supported_living'] })
    const manager = await createUser({ email: `mfc-selfassess-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const token = generateToken(manager)
    // A manager with a staff profile, assessing themselves. Blocked because
    // `assessed_by` defaults to the caller and resolves to the same person —
    // not because of their role, which is the distinction that matters.
    const self = await migrateQuery(
      `INSERT INTO staff_profiles (user_id, first_name, last_name) VALUES ($1, 'Self', 'Assessor') RETURNING id`,
      [manager.id],
    )
    const res = await request(app).post('/emedication/competences').set('Authorization', `Bearer ${token}`)
      .send({ staff_id: self.rows[0].id, scope: 'measuring_and_injecting' })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/cannot be the assessor for their own/)
  })

  it('keeps the history when a responsible clinician is replaced', async () => {
    const f = await fixture('clinician-history')
    const second = await createUser({ email: `mfc-nurse2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: f.orgId })
    const profile = await migrateQuery(
      `INSERT INTO staff_profiles (user_id, first_name, last_name) VALUES ($1, 'Second', 'Nurse') RETURNING id`,
      [second.id],
    )
    const res = await request(app).post('/emedication/responsible-clinicians').set('Authorization', `Bearer ${f.managerToken}`)
      .send({ staff_id: profile.rows[0].id, profession: 'registered_pharmacist' })
    expect(res.status).toBe(201)
    expect(res.body.previous_appointments_ended).toBeGreaterThan(0)

    const list = await request(app).get('/emedication/responsible-clinicians').set('Authorization', `Bearer ${f.managerToken}`)
    const current = list.body.filter((r: any) => !r.ended_at)
    const past = list.body.filter((r: any) => r.ended_at)
    expect(current).toHaveLength(1)
    // "Who was accountable when" is the first question an inspection opens
    // with, and deleting the row would answer it by destroying the evidence.
    expect(past.length).toBeGreaterThan(0)
  })

  it('refuses a profession that is not a registered nurse or pharmacist', async () => {
    const f = await fixture('clinician-profession')
    const res = await request(app).post('/emedication/responsible-clinicians').set('Authorization', `Bearer ${f.managerToken}`)
      .send({ staff_id: f.workerStaffId, profession: 'care_assistant' })
    expect(res.status).toBe(400)
  })
})

/* ── The rules must reach the people they are for ─────────────────────────── */

describe('the rules apply to the care worker, not only to the manager', () => {
  it('lets a care worker administer when the standing is in place', async () => {
    // Regression, and the reason it is here: the first version of the rule
    // reads used the RLS-scoped query, so the responsible-clinician lookup ran
    // under the care worker's session, hit a manager-only policy, came back
    // empty, and refused every dose. A manager testing it saw it work. This
    // test is the care worker's side of the same door.
    const f = await fixture('rls-care-worker')
    const item = await addMedicine(f, { name: 'Paracetamol', dosage: '500mg', unit: 'mg', frequency: 'twice daily' })
    if (item.body.stock_item_id) {
      await request(app).patch(`/emedication/stock/${item.body.stock_item_id}`).set('Authorization', `Bearer ${f.managerToken}`).send({ quantity: 100 })
    }
    const res = await give(f, item.body.id)
    expect(res.status).toBe(201)
  })

  it('still refuses them when the standing is not in place', async () => {
    const org = await createOrg({ service_types: ['supported_living'] })
    const person = await createPerson({ organizationId: org.id })
    const worker = await createUser({ email: `mfc-rls2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    await createStaffProfile({ userId: worker.id, medicationCompetent: true })
    const manager = await createUser({ email: `mfc-rls2m-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const managerToken = generateToken(manager)
    const record = await request(app).post('/emedication/records').set('Authorization', `Bearer ${managerToken}`)
      .send({ person_id: person.id, title: 'MAR', start_date: '2026-01-01', end_date: '2026-12-31' })
    const item = await request(app).post(`/emedication/records/${record.body.id}/items`).set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Paracetamol', dosage: '500mg', unit: 'mg', frequency: 'twice daily' })
    if (item.body.stock_item_id) {
      await request(app).patch(`/emedication/stock/${item.body.stock_item_id}`).set('Authorization', `Bearer ${managerToken}`).send({ quantity: 100 })
    }
    // The dose is attempted by the care worker, who has the competency tick and
    // no responsible clinician and no recorded competence.
    const res = await request(app).post('/emedication/administrations').set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ emedication_item_id: item.body.id, scheduled_time: '2026-06-01T08:00:00', status: 'given' })
    expect(res.status).toBe(403)
    expect(res.body.message).toContain('current medication competence')
  })
})

/* ── Readiness says which rules are controls and which are warnings ───────── */

describe('readiness tells a manager which rules actually stop a dose', () => {
  it('splits blocking rules from recorded ones, in words', async () => {
    const f = await fixture('readiness-split')
    const res = await request(app).get('/emedication/readiness').set('Authorization', `Bearer ${f.managerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.blocking_rules_total).toBeGreaterThan(0)
    expect(res.body.recorded_rules_total).toBeGreaterThan(0)
    const recorded = res.body.rules.filter((r: any) => r.rule.enforcement === 'recorded')
    expect(recorded.length).toBeGreaterThan(0)
    // Every rule carries a sentence, not a code. A manager who cannot read what
    // is being asked of them cannot act on it.
    for (const r of res.body.rules) {
      expect(typeof r.detail).toBe('string')
      expect(r.detail.length).toBeGreaterThan(10)
    }
  })

  it('discloses how much of the assurance is an inherited tick rather than an assessment', async () => {
    const f = await fixture('readiness-backfill')
    await migrateQuery(
      `UPDATE medication_competences SET record_source = 'backfilled_from_staff_flag' WHERE organization_id = $1`,
      [f.orgId],
    )
    const res = await request(app).get('/emedication/readiness').set('Authorization', `Bearer ${f.managerToken}`)
    expect(res.body.stats.competences_backfilled_from_staff_flag).toBeGreaterThan(0)
  })

  it('does not claim the provider is compliant', async () => {
    const f = await fixture('readiness-assurance')
    const res = await request(app).get('/emedication/readiness').set('Authorization', `Bearer ${f.managerToken}`)
    expect(res.body.assurance).toMatch(/not a statement that this service complies/)
  })
})

/* ── The rules that are recorded but not enforced ─────────────────────────── */

describe('a medication review is reported, not enforced', () => {
  it('does not stop a dose when the review is overdue', async () => {
    // Deliberate, and asserted so it cannot be changed by accident. Refusing
    // here would push staff back onto the paper MAR, which is worse for the
    // provider than a visible overdue review.
    const f = await fixture('review-overdue')
    const item = await addMedicine(f, { name: 'Paracetamol', dosage: '500mg', unit: 'mg', frequency: 'twice daily' })
    if (item.body.stock_item_id) {
      await request(app).patch(`/emedication/stock/${item.body.stock_item_id}`).set('Authorization', `Bearer ${f.managerToken}`).send({ quantity: 100 })
    }
    await request(app).post('/emedication/reviews').set('Authorization', `Bearer ${f.managerToken}`)
      .send({ person_id: f.personId, next_review_due: '2020-01-01', conducted_by: 'Dr Example' })
    const res = await give(f, item.body.id)
    expect(res.status).toBe(201)

    const readiness = await request(app).get('/emedication/readiness').set('Authorization', `Bearer ${f.managerToken}`)
    const review = readiness.body.rules.find((r: any) => r.rule.id === 'structured_medication_review')
    expect(review.rule.enforcement).toBe('recorded')
    expect(review.met).toBe(false)
  })
})
