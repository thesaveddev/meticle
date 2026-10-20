-- Job heartbeats — so a scheduled job that stops running altogether is noticed.
--
-- The DBS certificate retention purge already reports what it finds: a check still
-- holding certificate information past its six-month date raises a Mission Control
-- alert and a notification to the provider's admins. That covers the sweep that runs
-- and fails. It covers nothing at all when the sweep *never runs* — a deleted cron,
-- a deploy that dropped the timer, a process that boots without its scheduled work.
-- The provider is then non-compliant and hears nothing, because every warning in the
-- system is written by the run that stopped happening.
--
-- A row per job, keyed by name. `last_started_at` and `last_completed_at` are separate
-- so a job that starts and hangs is visible as a job that started and did not finish,
-- and `last_success_at` is separate again so a job that completes but throws is not
-- mistaken for one that works.
--
-- No organisation column, and no RLS: this is platform operations metadata — a job
-- name, three timestamps and a summary — not tenant data. It is written by the job
-- itself and read by the health endpoint, which is unauthenticated in the same way
-- `/health/ready` is, so nothing here may ever carry a provider's data.
CREATE TABLE IF NOT EXISTS job_heartbeats (
  job_name TEXT PRIMARY KEY,
  last_started_at TIMESTAMPTZ,
  last_completed_at TIMESTAMPTZ,
  -- The last run that finished without an error, kept apart from the last run of any
  -- kind: "it ran" and "it worked" are different facts and only the second one means
  -- the work is happening.
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  last_result JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
