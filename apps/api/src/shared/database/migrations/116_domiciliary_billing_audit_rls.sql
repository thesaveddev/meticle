ALTER TABLE domiciliary_billing_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE domiciliary_billing_audit FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON domiciliary_billing_audit;
CREATE POLICY tenant_isolation ON domiciliary_billing_audit
  FOR ALL USING (org_check(organization_id)) WITH CHECK (org_check(organization_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON domiciliary_billing_audit TO meticle_app;
