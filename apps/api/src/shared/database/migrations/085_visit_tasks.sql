-- Visit tasks: carers see these on each call and must complete them before checkout

-- Add default_tasks to visit_plans so managers can configure per-plan tasks
ALTER TABLE homecare_visit_plans ADD COLUMN IF NOT EXISTS default_tasks JSONB DEFAULT '[]'::jsonb;

-- Create visit_tasks table
CREATE TABLE IF NOT EXISTS homecare_visit_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES homecare_visits(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  done BOOLEAN NOT NULL DEFAULT false,
  completed_by UUID REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visit_tasks_visit ON homecare_visit_tasks(visit_id);
