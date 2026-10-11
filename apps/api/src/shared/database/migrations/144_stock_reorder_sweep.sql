-- Stock reorder sweep alerts.
--
-- notifyReorder() fires per stock transaction the moment a line crosses its
-- reorder level, but a level-crossing is not the only way a line ends up low:
-- a delivery may never be logged, the crossing email may have fired while the
-- manager was off shift, or a pre-existing under-level line may be carried
-- over from before the toggle existed. This migration gives the periodic
-- sweep its own state so it can re-warn at a sane cadence instead of either
-- spamming every 5 minutes or staying silent until a transaction happens.
--
--   1. emedication_stock.last_reorder_alerted_at — per-line dedupe marker for
--      the sweep. NULL means "never swept".
--   2. organizations.stock_reorder_alert_frequency_hours — how long to keep
--      quiet about the same line after warning (default 24h). The toggle for
--      the whole feature is the existing reorder_alert_enabled column, so a
--      manager has one switch for "warn me about stock" regardless of how the
--      warning was generated.
ALTER TABLE emedication_stock
  ADD COLUMN IF NOT EXISTS last_reorder_alerted_at TIMESTAMPTZ;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS stock_reorder_alert_frequency_hours INTEGER DEFAULT 24;
