-- Add target_visit_id to swap requests for proper swap-with-specific-call flow
ALTER TABLE visit_swap_requests ADD COLUMN IF NOT EXISTS target_visit_id UUID REFERENCES homecare_visits(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_swap_requests_target_visit ON visit_swap_requests(target_visit_id);
