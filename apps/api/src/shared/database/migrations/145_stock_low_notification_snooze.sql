-- One notification per low-stock cycle. A receipt that increments stock clears
-- this marker, allowing a new warning if the replenished quantity is still
-- projected to run out within the urgency window.
ALTER TABLE emedication_stock
  ADD COLUMN IF NOT EXISTS last_stock_low_notified_at TIMESTAMPTZ;
