-- 175: who-can-view on saved custom reports (Figma 10.2 save dialog).
-- A saved configuration carries a visibility: 'managers' (everyone with
-- reporting access, the previous behaviour), 'team' (the creator, admins,
-- and managers in the creator's department) or 'me' (the creator and
-- admins). The API enforces it on list/get/run/export/schedules; the
-- scheduled-delivery sweep keeps running whatever was scheduled because it
-- acts as the organisation, not as a viewer.
ALTER TABLE custom_reports
  ADD COLUMN visibility TEXT NOT NULL DEFAULT 'managers'
  CHECK (visibility IN ('managers', 'team', 'me'));
CREATE INDEX IF NOT EXISTS idx_custom_reports_visibility ON custom_reports(organization_id, visibility);
