-- The handover-due nudge, marked on the shift it was sent about.
--
-- A supported-living shift ends in a handover, and §9.2 made that a record. What
-- no part of the product did was notice a shift that ended *without* one: the
-- sweep in `modules/scheduling/shiftHandoverDue.ts` finds that state and raises
-- `shift.handover_due`, and this column is how it knows it has already told the
-- staff on that shift.
--
-- Same shape as the two one-shot messages this table already carries —
-- `start_notification_sent_at` (the daily plan) and `unclaimed_notified_at` (the
-- manager warning). A marker column rather than a ledger table, because the
-- question is "has this shift been nudged?" and the shift is one row; the partial
-- index keeps the sweep's own read to the handful of shifts that are still
-- unnotified instead of scanning a rota's worth of history every fifteen minutes.
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS handover_due_notified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_shifts_handover_due
  ON shifts(end_time)
  WHERE handover_due_notified_at IS NULL;
