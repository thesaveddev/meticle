-- Auditable checksum baselines for historical migrations.
-- This does not alter or rerun any historical migration.
CREATE TABLE IF NOT EXISTS _migration_baselines (
  name VARCHAR(255) PRIMARY KEY,
  checksum TEXT NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by VARCHAR(255) NOT NULL,
  reason TEXT NOT NULL
);
