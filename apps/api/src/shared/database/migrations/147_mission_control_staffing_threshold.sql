ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS minimum_staffing_coverage_percent INTEGER NOT NULL DEFAULT 100
  CHECK (minimum_staffing_coverage_percent BETWEEN 1 AND 100);
