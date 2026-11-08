-- 176: location + dietary tags on meal plan templates (Figma 11.1 hub).
-- A template row is one meal slot (meal_type, optional day_of_week); rows
-- that share a name are one menu ("Autumn menu - week A"). location_id lets
-- the weekly planner show one home's week, and dietary_tags records what the
-- menu was designed around (vegetarian, soft, halal …) so the planner and
-- the suggest-a-plan draft can match menus to residents' profiles.
ALTER TABLE meal_plan_templates
  ADD COLUMN location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  ADD COLUMN dietary_tags TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_meal_plan_templates_location ON meal_plan_templates(organization_id, location_id);
