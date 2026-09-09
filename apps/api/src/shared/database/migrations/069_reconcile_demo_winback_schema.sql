-- Forward-only repair for deployments where the 063/064 migrations were
-- introduced after later migrations had already been recorded.
-- Every statement is idempotent so it is safe on both old and current databases.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_organizations_is_demo ON organizations(is_demo) WHERE is_demo = TRUE;

CREATE TABLE IF NOT EXISTS winback_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email_type VARCHAR(50) NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_winback_org_type ON winback_emails(organization_id, email_type);
CREATE INDEX IF NOT EXISTS idx_winback_sent_at ON winback_emails(sent_at);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS data_retention_days INTEGER DEFAULT 90;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS data_deleted_at TIMESTAMP WITH TIME ZONE;
