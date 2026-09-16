ALTER TABLE staff_availability
  ADD COLUMN IF NOT EXISTS availability_date DATE;

CREATE INDEX IF NOT EXISTS idx_staff_availability_staff_date
  ON staff_availability (staff_id, availability_date);
