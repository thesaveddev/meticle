ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS visit_id UUID;

DO $$ BEGIN
  ALTER TABLE incidents
    ADD CONSTRAINT incidents_visit_id_fkey
    FOREIGN KEY (visit_id) REFERENCES homecare_visits(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_incidents_visit_id
  ON incidents (visit_id)
  WHERE visit_id IS NOT NULL;
