-- Phase 2 scheduling controls: recurring generation, safe assignment checks and exception resolution.
ALTER TABLE homecare_visit_plans
  ADD COLUMN IF NOT EXISTS default_staff_id UUID REFERENCES staff_profiles(id) ON DELETE SET NULL;

ALTER TABLE homecare_visits
  ADD COLUMN IF NOT EXISTS exception_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS exception_resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS exception_resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS exception_resolution_note TEXT;

DO $$
BEGIN
  ALTER TABLE homecare_visits DROP CONSTRAINT IF EXISTS homecare_visits_exception_type_check;
  ALTER TABLE homecare_visits ADD CONSTRAINT homecare_visits_exception_type_check
    CHECK (exception_type IS NULL OR exception_type IN ('late','missed','cancelled','no_show','other'));
EXCEPTION WHEN undefined_table THEN
  RAISE EXCEPTION 'homecare_visits must exist before migration 067';
END $$;

-- A visit plan can produce one visit at a given start instant only once.
CREATE UNIQUE INDEX IF NOT EXISTS uq_homecare_visit_plan_schedule
  ON homecare_visits (visit_plan_id, scheduled_start)
  WHERE visit_plan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_homecare_visits_exceptions
  ON homecare_visits (organization_id, status, exception_resolved_at)
  WHERE status IN ('missed', 'cancelled') OR exception_type IS NOT NULL;
