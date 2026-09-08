-- Winback campaign tracking — records every post-expiry email sent
-- so the scheduler never double-sends and we have an audit trail.
CREATE TABLE IF NOT EXISTS winback_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email_type VARCHAR(50) NOT NULL,        -- 'day_3', 'day_7', 'day_14', 'day_30', 'final'
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_winback_org_type ON winback_emails(organization_id, email_type);
CREATE INDEX IF NOT EXISTS idx_winback_sent_at ON winback_emails(sent_at);

-- Add data_retention_days to organizations (default 90 days after expiry)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS data_retention_days INTEGER DEFAULT 90;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS data_deleted_at TIMESTAMP WITH TIME ZONE;
