/**
 * Job heartbeats — the record of work that should be happening whether or not it
 * finds anything to do.
 *
 * Every sweep in this product reports what it finds, and every one of those reports is
 * written *by the run*. A job that stops running entirely therefore reports nothing:
 * the nightly DBS certificate retention purge can be absent for a month while providers
 * hold certificate information the rules say must already be deleted, and the only
 * signal is silence. The alert the purge raises cannot save you from this, because it
 * is written by the run that stopped.
 *
 * So a job stamps a heartbeat when it completes — including a run that found nothing,
 * which is the whole point: "nothing to do" and "did not happen" are indistinguishable
 * from the outside unless the job says so, and one of them is fine and the other is a
 * provider out of compliance. Each stamp records completion separately from success,
 * because a job that runs and throws is a different problem from one that never ran.
 *
 * `EXPECTED_JOB_CADENCE` belongs here rather than in each job so the expectation sits
 * beside the reading of it: a job whose cadence is not declared cannot be called late,
 * and a job that silently stopped being declared is how this rots.
 *
 * Times come from the database, not from the process, so a container with a wrong clock
 * cannot make a job look fresh.
 */
import { query } from '../database';
import logger from '../utils/logger';

export interface JobCadence {
  /** What the job is, in the words an operator reading a health response needs. */
  description: string;
  /**
   * How long a completed run stays believable. Deliberately generous: this is for
   * noticing a job that has stopped, not for measuring punctuality, and a tight window
   * turns one slow night into an incident.
   */
  maxAgeMinutes: number;
}

/** Every scheduled job whose absence is worth noticing, with the cadence it keeps. */
export const EXPECTED_JOB_CADENCE: Record<string, JobCadence> = {
  dbs_certificate_retention: {
    description: 'Nightly DBS certificate retention purge (six-month rule)',
    maxAgeMinutes: 26 * 60,
  },
};

export interface JobHeartbeat {
  job_name: string;
  last_started_at: string | null;
  last_completed_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  last_result: unknown;
  /** Minutes since the last completed run, computed by the database. */
  age_minutes: number | null;
  /** The declared cadence, or null for a job this module does not know. */
  max_age_minutes: number | null;
  /**
   * Late or never run. A job with no completion recorded at all is stale: it was
   * declared, so somebody expects it to run, and nothing has said it did.
   */
  stale: boolean;
}

/**
 * Record that a job started. Paired with `recordJobCompletion` so a job that begins and
 * never finishes is distinguishable from one that never began.
 */
export async function recordJobStart(jobName: string): Promise<void> {
  await query(
    `INSERT INTO job_heartbeats (job_name, last_started_at, updated_at)
     VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (job_name) DO UPDATE SET
       last_started_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP`,
    [jobName],
  );
}

/**
 * Record that a job finished, and whether it succeeded.
 *
 * `error` is the message, not the error object: it is written to a row that an
 * unauthenticated health endpoint may render, so it must never carry a provider's data.
 * A failure is still a completion — the job ran and did not work, which is not the same
 * as the job being gone, and `last_success_at` is what keeps the two apart.
 */
export async function recordJobCompletion(
  jobName: string,
  result: unknown,
  error?: string | null,
): Promise<void> {
  try {
    await query(
      `INSERT INTO job_heartbeats
         (job_name, last_completed_at, last_success_at, last_error, last_result, updated_at)
       VALUES ($1, CURRENT_TIMESTAMP, CASE WHEN $3::text IS NULL THEN CURRENT_TIMESTAMP END, $3, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (job_name) DO UPDATE SET
         last_completed_at = CURRENT_TIMESTAMP,
         last_success_at = CASE WHEN $3::text IS NULL THEN CURRENT_TIMESTAMP ELSE job_heartbeats.last_success_at END,
         last_error = $3,
         last_result = $2,
         updated_at = CURRENT_TIMESTAMP`,
      [jobName, result === undefined ? null : JSON.stringify(result), error ?? null],
    );
  } catch (err: any) {
    // A heartbeat that cannot be written is worth a log line and nothing more: it must
    // never turn a working job into a failing one.
    logger.error({ err: err?.message, jobName }, 'Could not record a job heartbeat');
  }
}

/**
 * Every declared job's last run, with the age and the verdict computed here rather than
 * in each caller — the health endpoint, the stale check and its tests all have to agree
 * about what "late" means, and three copies of that arithmetic is three chances to
 * disagree.
 *
 * A declared job with no row is included, because a job that has never run is late.
 */
export async function readJobHeartbeats(): Promise<JobHeartbeat[]> {
  const result = await query(
    `SELECT job_name, last_started_at, last_completed_at, last_success_at, last_error, last_result,
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_completed_at))::int / 60 AS age_minutes
       FROM job_heartbeats`,
  );

  const byName = new Map<string, any>(result.rows.map((row: any) => [row.job_name, row]));
  const names = new Set<string>([...Object.keys(EXPECTED_JOB_CADENCE), ...byName.keys()]);

  return [...names].sort().map((jobName) => {
    const row = byName.get(jobName);
    const cadence = EXPECTED_JOB_CADENCE[jobName] ?? null;
    const ageMinutes = row?.age_minutes === null || row?.age_minutes === undefined
      ? null
      : Number(row.age_minutes);
    return {
      job_name: jobName,
      last_started_at: row?.last_started_at ?? null,
      last_completed_at: row?.last_completed_at ?? null,
      last_success_at: row?.last_success_at ?? null,
      last_error: row?.last_error ?? null,
      last_result: row?.last_result ?? null,
      age_minutes: ageMinutes,
      max_age_minutes: cadence?.maxAgeMinutes ?? null,
      stale: cadence === null ? false : ageMinutes === null || ageMinutes > cadence.maxAgeMinutes,
    };
  });
}

/** The declarations that are late, or have never run. */
export async function readStaleJobs(): Promise<JobHeartbeat[]> {
  return (await readJobHeartbeats()).filter((job) => job.stale);
}
