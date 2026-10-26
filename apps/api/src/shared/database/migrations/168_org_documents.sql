-- 168: per-organisation compliance files (DPA, DPIA, ICO, insurance, contracts).
-- One row per stored file so platform admin can keep each org's signed
-- paperwork under that org, instead of in email or a shared drive.
-- Files live on disk under private/uploads and are served through the
-- existing /files/private route; this table is the ownership + metadata.
CREATE TABLE IF NOT EXISTS org_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('DPA','DPIA','ICO','INSURANCE','CONTRACT','POLICY','OTHER')),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  file_size_bytes INTEGER NOT NULL DEFAULT 0 CHECK (file_size_bytes >= 0),
  version TEXT NOT NULL DEFAULT '1.0',
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_org_documents_org ON org_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_documents_org_type ON org_documents(organization_id, doc_type);

-- RLS: org members read their own org's files; writes go through
-- SUPER_ADMIN platform-admin endpoints (service-level checks), so no
-- write policy for member roles. Follows person_documents pattern.
ALTER TABLE org_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_documents_select ON org_documents;
CREATE POLICY org_documents_select ON org_documents FOR SELECT USING (
  organization_id = (SELECT organization_id FROM users WHERE id = current_setting('app.current_user_id', true)::uuid)
);
