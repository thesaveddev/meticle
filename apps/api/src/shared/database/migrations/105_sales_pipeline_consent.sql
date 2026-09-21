ALTER TABLE contact_submissions ADD COLUMN IF NOT EXISTS privacy_consent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE contact_submissions ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE contact_submissions ADD COLUMN IF NOT EXISTS privacy_policy_version VARCHAR(30) NOT NULL DEFAULT '2026-09-20';
ALTER TABLE contact_submissions ADD COLUMN IF NOT EXISTS consented_at TIMESTAMPTZ;
ALTER TABLE contact_submissions ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE TABLE IF NOT EXISTS marketing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name VARCHAR(80) NOT NULL,
  source VARCHAR(100) NOT NULL DEFAULT 'website',
  consent_basis VARCHAR(80) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT marketing_events_name_check CHECK (event_name IN ('demo_request_submitted'))
);
CREATE INDEX IF NOT EXISTS idx_marketing_events_name_created ON marketing_events(event_name, created_at DESC);
