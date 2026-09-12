CREATE TABLE IF NOT EXISTS org_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel VARCHAR(50) NOT NULL DEFAULT 'general',
  message TEXT NOT NULL,
  reply_to_id UUID REFERENCES org_chat_messages(id) ON DELETE SET NULL,
  edited BOOLEAN DEFAULT FALSE,
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_org_channel ON org_chat_messages(organization_id, channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON org_chat_messages(sender_id);

CREATE TABLE IF NOT EXISTS org_chat_read_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel VARCHAR(50) NOT NULL DEFAULT 'general',
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, user_id, channel)
);
