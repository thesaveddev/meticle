-- Link visit notes to care plans for structured care documentation.
-- care_plan_id is optional — visit notes remain usable without a care plan link.

ALTER TABLE homecare_visits
  ADD COLUMN IF NOT EXISTS care_plan_id UUID REFERENCES care_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_homecare_visits_care_plan
  ON homecare_visits(care_plan_id) WHERE care_plan_id IS NOT NULL;
