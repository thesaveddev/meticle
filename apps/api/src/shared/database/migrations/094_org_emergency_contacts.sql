-- Two organisation-defined numbers that appear alongside 999 and 111 on the mobile
-- SOS button, so a carer can reach the office or their supervisor directly.
-- Labels are optional; a phone present without a label still shows in the SOS sheet.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS emergency_contact_1_label VARCHAR(40),
  ADD COLUMN IF NOT EXISTS emergency_contact_1_phone VARCHAR(30),
  ADD COLUMN IF NOT EXISTS emergency_contact_2_label VARCHAR(40),
  ADD COLUMN IF NOT EXISTS emergency_contact_2_phone VARCHAR(30);
