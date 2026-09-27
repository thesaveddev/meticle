-- Accuracy of the check-out position fix.
--
-- `homecare_visits` has carried `check_in_accuracy_meters` since the table was
-- created, but no equivalent column for check-out. The mobile app has always
-- sent `accuracy_meters` on both check-in and check-out — the same single fix
-- feeds both — so the value was arriving on every check-out request and being
-- dropped on the floor.
--
-- That matters beyond tidiness. A 500 m threshold that is applied to a fix
-- with ±80 m of uncertainty is not the same check as one applied to a fix with
-- ±8 m, and the accuracy figure is the only way to tell them apart afterwards.
-- Without it, a check-out that landed on the threshold boundary is
-- indistinguishable from one that did not.
--
-- Nullable, matching check-in: existing rows have no value to backfill and a
-- fabricated zero would be worse than a null.
ALTER TABLE homecare_visits
  ADD COLUMN IF NOT EXISTS check_out_accuracy_meters NUMERIC(8,2);
