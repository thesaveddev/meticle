-- Add two-person call support to homecare visits
ALTER TABLE homecare_visits ADD COLUMN IF NOT EXISTS requires_two_staff BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE homecare_visits ADD COLUMN IF NOT EXISTS second_staff_id UUID REFERENCES staff_profiles(id) ON DELETE SET NULL;

-- Add care plan notes for structured checkout
ALTER TABLE homecare_visits ADD COLUMN IF NOT EXISTS care_plan_notes JSONB DEFAULT '[]';

-- Add progress notes (carer observations during visit)
ALTER TABLE homecare_visits ADD COLUMN IF NOT EXISTS progress_notes TEXT;

-- Add mood and wellbeing tracking
ALTER TABLE homecare_visits ADD COLUMN IF NOT EXISTS client_mood VARCHAR(20) CHECK (client_mood IS NULL OR client_mood IN ('happy', 'settled', 'anxious', 'distressed', 'agitated', 'sleepy', 'unresponsive'));
ALTER TABLE homecare_visits ADD COLUMN IF NOT EXISTS wellbeing_notes TEXT;

-- Add personal care tracking
ALTER TABLE homecare_visits ADD COLUMN IF NOT EXISTS personal_care JSONB DEFAULT '{}';

-- Add fluid intake tracking during visit
ALTER TABLE homecare_visits ADD COLUMN IF NOT EXISTS fluid_intake_ml INTEGER CHECK (fluid_intake_ml IS NULL OR fluid_intake_ml >= 0);

-- Index for two-person calls
CREATE INDEX IF NOT EXISTS idx_homecare_visits_two_staff ON homecare_visits(requires_two_staff) WHERE requires_two_staff = TRUE;
