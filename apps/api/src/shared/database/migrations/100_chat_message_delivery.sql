CREATE TABLE IF NOT EXISTS org_chat_message_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES org_chat_messages(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_chat_deliveries_message
  ON org_chat_message_deliveries(message_id, delivered_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_chat_deliveries_recipient
  ON org_chat_message_deliveries(organization_id, user_id, delivered_at DESC);
