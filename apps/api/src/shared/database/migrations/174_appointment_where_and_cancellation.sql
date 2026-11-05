-- 174: free-text venue and cancellation record on appointments.
-- `where_text` holds an external venue ("Specsavers, Five Ways") that is not
-- an org location: the location_id FK only covers the provider's own homes,
-- so external visits had nowhere to record where they happen. It is shown to
-- staff on their day with a map link on mobile.
-- `cancellation_reason` / `cancellation_note` keep why an appointment was
-- cancelled and the message left for the team, so a cancelled row stays a
-- useful record instead of only a status. Both nullable: existing rows and
-- non-cancelled appointments simply have none.
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS where_text TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(50),
  ADD COLUMN IF NOT EXISTS cancellation_note TEXT;
