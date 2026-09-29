/**
 * Standing a real provider has before the first dose.
 *
 * The framework rules (see `medicationFrameworks.ts`) refuse an administration
 * unless a named registered clinician is responsible for medicines and the
 * person giving it holds a current competence. That is the behaviour under test,
 * but it means every test that logs a dose has to arrange the standing first —
 * which is what a real service does, and what a fixture that skips it is no
 * longer modelling.
 *
 * Kept in one place so a test that sets up the standing is doing the same three
 * things as every other one. The alternative, repeating the appointment in each
 * test file, is how fixtures drift from the product: one file would end up
 * granting a controlled-drugs scope everywhere and the next nowhere, and a
 * failure would look like a rule bug.
 */

import request from 'supertest'
import { Express } from 'express'
import { createUser, generateToken } from './factories'
import { migrateQuery } from '../shared/database'

export type MedicinesStanding = {
  assessorStaffProfileId: string
  assessorToken: string
  responsibleClinicianStaffId: string
}

export type StandingOptions = {
  organizationId: string
  /**
   * The manager who can record a competence, as user id and their token.
   *
   * Both, because the token has to have been minted from a real user row — the
   * auth middleware re-reads the user on every request, so a token built from a
   * bare id is rejected as "User no longer exists". A separate ORG_ADMIN is
   * created when this is omitted.
   */
  assessor?: { userId: string; token: string }
  /** The people who should be able to administer. */
  competentStaffProfileIds?: string[]
  /** Give these people the controlled-drugs scope as well. */
  controlledDrugStaffProfileIds?: string[]
  /** Set a regulator so the framework resolves to a nation's rules. */
  regulator?: string
  /** Override the framework outright. */
  framework?: string
}

/**
 * Appoint a responsible clinician and record competences.
 *
 * The responsible clinician is a real nurse user with a real staff profile,
 * rather than the manager, because the frameworks name a registered nurse or
 * pharmacist and a test fixture that appoints the manager is quietly asserting
 * something untrue about the scenario it is modelling.
 */
export async function appointMedicinesStanding(
  app: Express,
  opts: StandingOptions,
): Promise<MedicinesStanding> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  if (opts.regulator) {
    await migrateQuery('UPDATE organizations SET regulator = $1 WHERE id = $2', [opts.regulator, opts.organizationId])
  }
  if (opts.framework) {
    await migrateQuery('UPDATE organizations SET medication_framework = $1 WHERE id = $2', [
      opts.framework,
      opts.organizationId,
    ])
  }

  // Either the caller's own manager, or a fresh ORG_ADMIN whose staff profile
  // is created below. The profile matters: `assessed_by` defaults to the
  // caller, so an assessor with no staff profile produces a competence nobody
  // signed off.
  const assessorUser = opts.assessor
    ? { id: opts.assessor.userId }
    : await createUser({
        email: `med-assessor-${stamp}@test.com`,
        password: 'TestPass123!',
        role: 'ORG_ADMIN',
        organization_id: opts.organizationId,
      })
  const assessorToken = opts.assessor?.token ?? generateToken(assessorUser)
  const assessorProfile = await ensureStaffProfile(assessorUser.id, opts.organizationId)

  const clinicianUser = await createUser({
    email: `med-nurse-${stamp}@test.com`,
    password: 'TestPass123!',
    role: 'CARE_WORKER',
    organization_id: opts.organizationId,
  })
  const clinicianProfile = await ensureStaffProfile(clinicianUser.id, opts.organizationId)

  const appointed = await request(app)
    .post('/emedication/responsible-clinicians')
    .set('Authorization', `Bearer ${assessorToken}`)
    .send({ staff_id: clinicianProfile, profession: 'registered_nurse', registration_number: 'N-000123' })
  if (appointed.status !== 201) {
    throw new Error(`Failed to appoint responsible clinician: ${appointed.status} ${JSON.stringify(appointed.body)}`)
  }

  for (const staffProfileId of opts.competentStaffProfileIds ?? []) {
    await recordCompetence(app, assessorToken, staffProfileId, 'administration')
  }
  for (const staffProfileId of opts.controlledDrugStaffProfileIds ?? []) {
    await recordCompetence(app, assessorToken, staffProfileId, 'controlled_drugs')
  }

  return {
    assessorStaffProfileId: assessorProfile,
    assessorToken,
    responsibleClinicianStaffId: clinicianProfile,
  }
}

/**
 * A staff profile for a user, created if absent.
 *
 * Uses `migrateQuery` rather than the factories' RLS-scoped `query`, because
 * this runs outside any request context and `RETURNING *` comes back empty
 * there — which shows up much later as "staff_id: Required" from an endpoint
 * that is working perfectly.
 */
async function ensureStaffProfile(userId: string, organizationId: string): Promise<string> {
  const existing = await migrateQuery('SELECT id FROM staff_profiles WHERE user_id = $1', [userId])
  if (existing.rows[0]) return existing.rows[0].id
  const created = await migrateQuery(
    `INSERT INTO staff_profiles (user_id, first_name, last_name, employment_status, medication_competent)
     VALUES ($1, 'Test', 'Nurse', 'active', FALSE)
     RETURNING id`,
    [userId],
  )
  void organizationId
  return created.rows[0].id
}

async function recordCompetence(
  app: Express,
  token: string,
  staffProfileId: string,
  scope: string,
): Promise<void> {
  const res = await request(app)
    .post('/emedication/competences')
    .set('Authorization', `Bearer ${token}`)
    .send({ staff_id: staffProfileId, scope })
  if (res.status !== 201) {
    throw new Error(`Failed to record ${scope} competence: ${res.status} ${JSON.stringify(res.body)}`)
  }
}
