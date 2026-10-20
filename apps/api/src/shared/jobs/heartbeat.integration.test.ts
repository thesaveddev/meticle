/**
 * Job heartbeats — the difference between "nothing to do" and "did not happen".
 *
 * Every sweep in this product reports what it finds, and it reports it *by running*. A
 * job that has stopped therefore reports nothing at all: the nightly DBS certificate
 * retention purge can be gone for a month while providers hold certificate information
 * the six-month rule says must already be deleted, and the only signal is silence. The
 * alert the purge raises cannot save you from that, because it is written by the run
 * that stopped.
 *
 * These tests buy three properties, and each of them is a way an operator is told the
 * wrong thing:
 *
 *  * A declared job with no heartbeat at all is *late*, not healthy — silence is the
 *    failure, so it cannot read as an absence of problems.
 *  * A run that completed and failed is *not* the same as a run that never happened. It
 *    completed (the job is alive), and `last_success_at` is what keeps the two apart.
 *  * A stale reading recovers when a run completes, so the alert withdraws rather than
 *    sticking after the job was fixed.
 *
 * The cadence is declared per job beside the reading of it, so this suite registers its
 * own job rather than borrowing a production one: sharing `dbs_certificate_retention`
 * with the retention suites would make both files race over one row, and a test of
 * silence that is itself noisy is worse than none.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { migrateQuery } from '../database'
import {
  EXPECTED_JOB_CADENCE,
  readJobHeartbeats,
  readStaleJobs,
  recordJobCompletion,
  recordJobStart,
} from './heartbeat'

const JOB = `test_heartbeat_job_${Date.now()}`

beforeAll(() => {
  // Declared, because a job whose cadence is not declared can never be called late — and
  // the point of the suite is the declared case.
  EXPECTED_JOB_CADENCE[JOB] = {
    description: 'A job that exists only for this suite',
    maxAgeMinutes: 60,
  }
})

afterAll(async () => {
  delete EXPECTED_JOB_CADENCE[JOB]
  await migrateQuery(`DELETE FROM job_heartbeats WHERE job_name = $1`, [JOB])
})

async function clearHeartbeat() {
  await migrateQuery(`DELETE FROM job_heartbeats WHERE job_name = $1`, [JOB])
}

describe('job heartbeats', () => {
  it('calls a declared job that has never run late, rather than healthy', async () => {
    await clearHeartbeat()

    const reading = (await readJobHeartbeats()).find(job => job.job_name === JOB)

    // Present because it is declared: a job somebody expects to run and which has said
    // nothing is the case this whole module exists for.
    expect(reading).toBeDefined()
    expect(reading!.last_completed_at).toBeNull()
    expect(reading!.age_minutes).toBeNull()
    expect(reading!.max_age_minutes).toBe(60)
    expect(reading!.stale).toBe(true)
    expect((await readStaleJobs()).some(job => job.job_name === JOB)).toBe(true)
  })

  it('goes healthy when a run completes, including a run that found nothing to do', async () => {
    await clearHeartbeat()

    await recordJobStart(JOB)
    // "Nothing to do" is a result, not an absence: the run happened.
    await recordJobCompletion(JOB, { purged: 0, failed: 0 })

    const reading = (await readJobHeartbeats()).find(job => job.job_name === JOB)!
    expect(reading.last_started_at).toBeTruthy()
    expect(reading.last_completed_at).toBeTruthy()
    expect(reading.last_success_at).toBeTruthy()
    expect(reading.age_minutes).toBe(0)
    expect(reading.stale).toBe(false)
    expect(reading.last_result).toEqual({ purged: 0, failed: 0 })
    expect((await readStaleJobs()).some(job => job.job_name === JOB)).toBe(false)
  })

  it('records a failed run as a run: alive but unsuccessful, with the reason', async () => {
    await clearHeartbeat()

    // A clean run first, so the failure has a success to be measured against.
    await recordJobCompletion(JOB, { purged: 3 })
    const successes = (await readJobHeartbeats()).find(job => job.job_name === JOB)!
    expect(successes.last_success_at).toBeTruthy()

    await recordJobCompletion(JOB, null, 'connection terminated unexpectedly')
    const after = (await readJobHeartbeats()).find(job => job.job_name === JOB)!

    expect(after.last_error).toBe('connection terminated unexpectedly')
    // It ran, so the job is not missing — that is a different failure and it belongs on
    // the `last_error` line rather than dressed up as a dead job.
    expect(after.stale).toBe(false)
    // The last run that actually worked is not overwritten by the one that did not.
    expect(new Date(after.last_success_at).toISOString()).toBe(new Date(successes.last_success_at).toISOString())
    expect(after.last_completed_at).toBeTruthy()
  })

  it('goes late again once the last completion is older than the declared cadence', async () => {
    await clearHeartbeat()
    await recordJobCompletion(JOB, { purged: 0 })

    // Two hours past a one-hour cadence, written from the database's clock so the age
    // arithmetic is measured against the same clock the reader uses.
    await migrateQuery(
      `UPDATE job_heartbeats
          SET last_completed_at = CURRENT_TIMESTAMP - INTERVAL '2 hours'
        WHERE job_name = $1`,
      [JOB],
    )

    const reading = (await readJobHeartbeats()).find(job => job.job_name === JOB)!
    expect(reading.age_minutes).toBeGreaterThanOrEqual(120)
    expect(reading.stale).toBe(true)
  })

  it('never lets an undeclared row be called late, so an unmaintained job is visible as such', async () => {
    // The declared set is the source of truth: a job that was deleted from it stops being
    // judged rather than silently failing forever. It is still listed, so the drift is
    // readable, but it does not raise an alarm nobody can act on.
    const undeclared = `${JOB}_undeclared`
    await migrateQuery(
      `INSERT INTO job_heartbeats (job_name, last_completed_at, last_success_at, updated_at)
       VALUES ($1, CURRENT_TIMESTAMP - INTERVAL '400 days', CURRENT_TIMESTAMP - INTERVAL '400 days', CURRENT_TIMESTAMP)
       ON CONFLICT (job_name) DO UPDATE SET last_completed_at = CURRENT_TIMESTAMP - INTERVAL '400 days'`,
      [undeclared],
    )

    const reading = (await readJobHeartbeats()).find(job => job.job_name === undeclared)!
    expect(reading.max_age_minutes).toBeNull()
    expect(reading.stale).toBe(false)

    await migrateQuery(`DELETE FROM job_heartbeats WHERE job_name = $1`, [undeclared])
  })
})
