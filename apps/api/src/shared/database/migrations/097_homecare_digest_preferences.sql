CREATE TABLE IF NOT EXISTS homecare_digest_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  morning_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  midday_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  evening_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  morning_time TIME NOT NULL DEFAULT '08:00',
  midday_time TIME NOT NULL DEFAULT '13:00',
  evening_time TIME NOT NULL DEFAULT '19:00',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS homecare_digest_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  digest_date DATE NOT NULL,
  digest_type VARCHAR(16) NOT NULL CHECK (digest_type IN ('morning', 'midday', 'evening')),
  status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, digest_date, digest_type)
);

CREATE INDEX IF NOT EXISTS idx_homecare_digest_deliveries_due
  ON homecare_digest_deliveries (digest_date, digest_type, status);
