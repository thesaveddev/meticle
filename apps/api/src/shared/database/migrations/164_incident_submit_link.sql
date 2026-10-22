-- Incident submit wiring (P1a) — links the report to the engines.
--
-- P0 built three engines with their own tables; the incident row itself still
-- pointed at none of them, so a filed report never assessed its severity and
-- never started a workflow. These two nullable columns are the link: which
-- published form version the report was filed against, and which severity
-- assessment is current. Answers live in incident_answers (161); assessments
-- append in incident_severity_assessments (162); the workflow hangs off the
-- incident id (163). All three stay history-safe — this only names the head.

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS form_version_id UUID REFERENCES incident_form_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_severity_assessment_id UUID REFERENCES incident_severity_assessments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_incidents_form_version ON incidents(form_version_id);
CREATE INDEX IF NOT EXISTS idx_incidents_severity_head ON incidents(current_severity_assessment_id);
