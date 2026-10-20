import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createPerson, createStaffProfile, generateToken } from '../../test/factories'
import { migrateQuery } from '../../shared/database'
import { FamilyFeedbackRepository } from './familyFeedback.repository'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

/** A completed visit, which is the only thing a feedback token can point at. */
async function completedVisit(orgId: string, personId: string, staffId?: string) {
  const pkg = await migrateQuery(
    `INSERT INTO homecare_packages (organization_id, person_id, name, status, funding_type, start_date)
     VALUES ($1, $2, 'Weekly package', 'active', 'private', CURRENT_DATE) RETURNING id`,
    [orgId, personId]
  )
  const visit = await migrateQuery(
    `INSERT INTO homecare_visits (organization_id, package_id, person_id, assigned_staff_id, visit_type, label, scheduled_start, scheduled_end, status)
     VALUES ($1, $2, $3, $4, 'morning', 'Morning call',
             NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '1 hour', 'completed')
     RETURNING *`,
    [orgId, pkg.rows[0].id, personId, staffId ?? null]
  )
  return visit.rows[0]
}

/**
 * These endpoints were mounted while `family_feedback` did not exist in any
 * database — migration 103 declared it, was never registered, and could not be
 * applied below the watermark. Every call here was a 500. This suite is what keeps
 * the table honest: it drives the public form, the submission, and the manager's
 * list the way a family member and a manager reach them.
 */
describe('Family visit feedback', () => {
  it('gives a family member a form, stores their ratings, and shows them to the manager', async () => {
    const org = await createOrg()
    const person = await createPerson({ organization_id: org.id, first_name: 'Margaret', last_name: 'Ellis' })
    const carer = await createUser({ email: `ff-carer-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const carerStaff = await createStaffProfile({ userId: carer.id, firstName: 'Nia', lastName: 'Okafor' })
    const mgr = await createUser({ email: `ff-mgr-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const visit = await completedVisit(org.id, person.id, carerStaff.id)

    const token = await FamilyFeedbackRepository.createFeedbackToken({
      organization_id: org.id,
      visit_id: visit.id,
      person_id: person.id,
      family_member_name: 'Sarah Ellis',
      relationship: 'Daughter',
    })
    expect(token?.access_token).toBeTruthy()

    const form = await request(app).get(`/api/family-feedback/${token!.access_token}`)
    expect(form.status).toBe(200)
    expect(form.body.person.first_name).toBe('Margaret')
    expect(form.body.visit.label).toBe('Morning call')

    const submitted = await request(app)
      .post(`/api/family-feedback/${token!.access_token}`)
      .send({
        overall_rating: 5,
        care_quality_rating: 5,
        communication_rating: 4,
        feedback_text: 'Nia was kind and unhurried with Mum.',
        would_recommend: true,
      })
    expect(submitted.status).toBe(200)
    expect(submitted.body.submitted).toBe(true)

    // The token is one-shot: a second visit to the link says so rather than
    // accepting a second opinion against the same visit.
    const again = await request(app).get(`/api/family-feedback/${token!.access_token}`)
    expect(again.status).toBe(404)

    const list = await request(app)
      .get('/family-feedback')
      .set('Authorization', `Bearer ${generateToken(mgr)}`)
    expect(list.status).toBe(200)
    expect(list.body.feedback).toHaveLength(1)
    expect(list.body.feedback[0].feedback_text).toBe('Nia was kind and unhurried with Mum.')
    expect(list.body.feedback[0].person_first_name).toBe('Margaret')
    expect(list.body.stats.total_feedback).toBe(1)
    expect(Number(list.body.stats.avg_overall)).toBe(5)
  })

  it('refuses an unknown token and an out-of-range rating', async () => {
    const unknown = await request(app).get('/api/family-feedback/00000000-0000-0000-0000-000000000000')
    expect(unknown.status).toBe(404)

    const org = await createOrg()
    const person = await createPerson({ organization_id: org.id })
    const visit = await completedVisit(org.id, person.id)
    const token = await FamilyFeedbackRepository.createFeedbackToken({
      organization_id: org.id,
      visit_id: visit.id,
      person_id: person.id,
      family_member_name: 'A relative',
    })

    const tooHigh = await request(app)
      .post(`/api/family-feedback/${token!.access_token}`)
      .send({ overall_rating: 9 })
    expect(tooHigh.status).toBe(400)
  })

  it('keeps the table tenant-isolated', async () => {
    const rls = await migrateQuery(
      `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'family_feedback'`
    )
    expect(rls.rows[0]?.relrowsecurity).toBe(true)
    expect(rls.rows[0]?.relforcerowsecurity).toBe(true)
  })
})
