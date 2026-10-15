import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import {
  createOrg, createUser, createPerson, createLocation, createStaffProfile, generateToken,
} from '../../test/factories'
import { migrateQuery } from '../../shared/database'

/**
 * Mica's navigation path, end to end.
 *
 * The property under test is the product decision: a spoken destination is a
 * request to *go* somewhere, so /ai/mica/ask answers it with a route the client
 * pushes — and it does so without a model, which is why the org in these tests
 * has AI switched off. The same endpoint still refuses a question in that state,
 * and that pair of assertions is the interesting one: navigation is deterministic
 * and always available, answering a question is not.
 */
let app: Express
beforeAll(() => { app = createTestApp() })

/** The database's today, which is what the parser resolves a bare month against. */
async function dbToday(): Promise<string> {
  const r = await migrateQuery(`SELECT CURRENT_DATE::text AS day`)
  return String(r.rows[0].day)
}

async function seedOrg() {
  const org = await createOrg()
  const admin = await createUser({
    email: `micanav-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
    password: 'TestPass123!',
    role: 'ORG_ADMIN',
    organization_id: org.id,
  })
  // AI deliberately off: navigation must not depend on a provider.
  await migrateQuery(
    `UPDATE organizations SET ai_config = $1::jsonb WHERE id = $2`,
    [JSON.stringify({ enabled: false }), org.id],
  )
  return { org, admin, token: generateToken(admin) }
}

const ask = (token: string, question: string) =>
  request(app).post('/ai/mica/ask').set('Authorization', `Bearer ${token}`).send({ question })

/** An incident with a title, the way the incidents module stores one. */
async function seedIncident(orgId: string, title: string, confidential = false) {
  const res = await migrateQuery(
    `INSERT INTO incidents (id, organization_id, title, description, incident_date, severity, status, is_confidential)
     VALUES (gen_random_uuid(), $1, $2, 'test', CURRENT_DATE, 'medium', 'reported', $3)
     RETURNING id`,
    [orgId, title, confidential],
  )
  return { id: res.rows[0].id as string }
}

describe('POST /ai/mica/ask — navigation', () => {
  it('opens a named person’s MAR chart for a named month, with no AI configured', async () => {
    const seeded = await seedOrg()
    const person = await createPerson({
      organization_id: seeded.org.id, first_name: 'Evan', last_name: 'Turner', status: 'active',
    })
    const year = (await dbToday()).slice(0, 4)

    const res = await ask(seeded.token, "give me Evan Turner's mar chart for march")

    expect(res.status).toBe(200)
    expect(res.body.navigate).toBeTruthy()
    expect(res.body.navigate.destination).toBe('mar-chart')
    expect(res.body.navigate.path).toBe(`/emedication?personId=${person.id}&month=${year}-03`)
    expect(res.body.navigate.label).toBe(`Evan Turner's March ${year} MAR chart`)
    // The person comes back so the next question has context ("and February?").
    expect(res.body.navigate.person).toEqual({ id: person.id, name: 'Evan Turner' })
    expect(res.body.answer).toBe(`Here's Evan Turner's March ${year} MAR chart.`)
  })

  it('opens a destination that needs no person at all', async () => {
    const seeded = await seedOrg()
    const res = await ask(seeded.token, 'open the incidents')

    expect(res.status).toBe(200)
    expect(res.body.navigate.path).toBe('/incidents')
    expect(res.body.navigate.destination).toBe('incidents')
    expect(res.body.answer).toBe('Opening incidents.')
  })

  it('will not guess between two people with the same first name', async () => {
    const seeded = await seedOrg()
    await createPerson({ organization_id: seeded.org.id, first_name: 'Grace', last_name: 'Roberts', status: 'active' })
    await createPerson({ organization_id: seeded.org.id, first_name: 'Grace', last_name: 'Reed', status: 'active' })

    const res = await ask(seeded.token, "open Grace's MAR chart")

    // No route is pushed and no person is chosen: an ambiguous medication chart
    // is the one outcome this flow must never produce. Mica asks instead, and
    // the carer's next sentence retries with the full name.
    expect(res.status).toBe(200)
    expect(res.body.navigate).toBeUndefined()
    expect(res.body.answer).toMatch(/more than one match/i)
    expect(res.body.answer).toContain('Grace Roberts')
    expect(res.body.answer).toContain('Grace Reed')
  })

  it('says so plainly when nobody matches, rather than opening someone else', async () => {
    const seeded = await seedOrg()
    await createPerson({ organization_id: seeded.org.id, first_name: 'Elsie', last_name: 'Fletcher', status: 'active' })

    const res = await ask(seeded.token, "open Wilhelmina Webb's MAR chart")

    expect(res.status).toBe(200)
    expect(res.body.navigate).toBeUndefined()
    expect(res.body.answer).toMatch(/couldn't find anyone called Wilhelmina Webb/i)
  })

  it('resolves a staff member’s profile without treating them as a care-note subject', async () => {
    const seeded = await seedOrg()
    const location = await createLocation({ organization_id: seeded.org.id, name: 'Ash Grove' })
    const worker = await createUser({
      email: `micanavstaff-${Date.now()}@test.com`,
      password: 'TestPass123!',
      role: 'CARE_WORKER',
      organization_id: seeded.org.id,
    })
    await createStaffProfile({ user_id: worker.id, first_name: 'Priya', last_name: 'Sharma', location_id: location.id })

    const res = await ask(seeded.token, "open Priya Sharma's profile")

    expect(res.status).toBe(200)
    expect(res.body.navigate.path).toBe(`/staff/${worker.id}`)
    expect(res.body.navigate.label).toBe("Priya Sharma's profile")
    // A staff member is not a person a care note can be about.
    expect(res.body.navigate.person).toBeUndefined()
  })

  it('leaves a question on the question path — which needs the provider it is missing', async () => {
    const seeded = await seedOrg()
    // Reading coverage needs open-versus-filled judgement, so the fact path answers
    // neither this question nor any part of it — and the word "rota" in the
    // sentence must not tempt navigation into opening the planner either.
    const res = await ask(seeded.token, 'how is the rota looking today')

    // The gate, not a route: this is the proof that the question path was taken
    // and that navigation did not swallow a question.
    expect(res.status).toBe(400)
    expect(res.body.error.message).toMatch(/AI not configured/i)
    expect(res.body.navigate).toBeUndefined()
  })
})

/**
 * The detail a destination carries: the week, the tab, the incident.
 *
 * Every case runs with AI switched off, like the rest of this file, because that is
 * the property being extended rather than a new one — a deep link is still a
 * deterministic route, so an organisation that has configured no provider gets it.
 */
describe('POST /ai/mica/ask — the detail a destination carries', () => {
  /** The Monday of the week an ISO day is in. Computed here, not imported. */
  const mondayOf = (iso: string) => {
    const [year, month, day] = iso.split('-').map(Number)
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const monday = new Date(Date.UTC(year, month - 1, day + (weekday === 0 ? -6 : 1 - weekday)));
    return monday.toISOString().slice(0, 10);
  };
  const plusDays = (iso: string, days: number) =>
    new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);

  it('opens the rota on the week the carer asked for', async () => {
    const seeded = await seedOrg();
    const nextWeek = plusDays(mondayOf(await dbToday()), 7);

    const res = await ask(seeded.token, 'open the rota for next week');

    expect(res.status).toBe(200);
    expect(res.body.navigate.destination).toBe('rota');
    expect(res.body.navigate.path).toBe(`/scheduling?week=${nextWeek}`);
    // The label names the week, so the carer hears which one opened rather than
    // having to infer it from the grid.
    expect(res.body.navigate.label).toContain('week of');
  });

  it('leaves the week off a rota request that named none', async () => {
    const seeded = await seedOrg();
    const res = await ask(seeded.token, 'open the rota planner');

    // The planner's own default week: sending one here would change what a carer
    // gets today for a request that is not about a week at all.
    expect(res.body.navigate.path).toBe('/scheduling');
  });

  it("opens a person's profile on the tab that was asked for", async () => {
    const seeded = await seedOrg();
    const person = await createPerson({
      organization_id: seeded.org.id, first_name: 'Grace', last_name: 'Roberts', status: 'active',
    });

    const res = await ask(seeded.token, "open Grace Roberts's health tab");

    expect(res.status).toBe(200);
    expect(res.body.navigate.path).toBe(`/people/${person.id}?tab=health`);
    expect(res.body.navigate.label).toBe("Grace Roberts's health tab");
    // Still a person, so the next question ("and her care plan?") has its subject.
    expect(res.body.navigate.person).toEqual({ id: person.id, name: 'Grace Roberts' });
  });

  it('opens the one incident the carer named, from its title', async () => {
    const seeded = await seedOrg();
    const incident = await seedIncident(seeded.org.id, 'Fire door held open');

    const res = await ask(seeded.token, 'open the fire door incident');

    expect(res.status).toBe(200);
    expect(res.body.navigate.destination).toBe('incidents');
    expect(res.body.navigate.path).toBe(`/incidents/${incident.id}`);
    expect(res.body.navigate.label).toBe('Fire door held open');
  });

  it('asks which incident when the subject matches more than one', async () => {
    const seeded = await seedOrg();
    await seedIncident(seeded.org.id, 'Medication error at Oak House');
    await seedIncident(seeded.org.id, 'Missed medication round');

    const res = await ask(seeded.token, 'open the medication incident');

    // Two records and one spoken subject: the carer is asked, exactly as they are
    // when two residents share a first name.
    expect(res.status).toBe(200);
    expect(res.body.navigate).toBeUndefined();
    expect(res.body.answer).toMatch(/more than one incident matching/i);
    expect(res.body.answer).toContain('Medication error at Oak House');
  });

  it('says so when no incident matches, rather than opening the directory', async () => {
    const seeded = await seedOrg();
    await seedIncident(seeded.org.id, 'Fire door held open');

    const res = await ask(seeded.token, 'open the unicorn incident');

    expect(res.body.navigate).toBeUndefined();
    expect(res.body.answer).toMatch(/couldn't find an incident matching "unicorn"/i);
  });

  it('will not open a confidential incident for a care worker, and will for an admin', async () => {
    const seeded = await seedOrg();
    const location = await createLocation({ organization_id: seeded.org.id, name: 'Ash Grove' });
    const worker = await createUser({
      email: `micanavcw-${Date.now()}@test.com`,
      password: 'TestPass123!',
      role: 'CARE_WORKER',
      organization_id: seeded.org.id,
    });
    await createStaffProfile({ user_id: worker.id, first_name: 'Dana', last_name: 'Reyes', location_id: location.id });
    const confidential = await seedIncident(seeded.org.id, 'Medication error at Oak House', true);

    // The carer hears the sentence a miss gets: a confidential record's title must
    // not be read back to them, and no route to it may be pushed either. This is the
    // same rule `IncidentsController.isAdmin` applies to the directory.
    const carer = await ask(generateToken(worker), 'open the medication error incident');
    expect(carer.body.navigate).toBeUndefined();
    expect(carer.body.answer).not.toContain('Medication error at Oak House');
    expect(carer.body.answer).toMatch(/couldn't find an incident matching/i);

    // The admin, who can see confidential incidents, gets the record they named.
    const admin = await ask(seeded.token, 'open the medication error incident');
    expect(admin.body.navigate.path).toBe(`/incidents/${confidential.id}`);
  });
})
