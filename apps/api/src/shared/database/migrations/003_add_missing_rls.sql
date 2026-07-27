-- Migration 003: Add missing RLS policies (2026-07 update)
-- Covers tables that were omitted from 002_enable_rls.
-- All statements use IF NOT EXISTS / DROP IF EXISTS for idempotency.

-- ══════════════════════════════════════════════════════════
-- Ensure helper functions exist (idempotent)
-- ══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION app_current_org_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_org_id', true), '')::UUID;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::UUID;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION app_current_user_role() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.current_user_role', true), '');
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION app_is_super_admin() RETURNS BOOLEAN AS $$
  SELECT app_current_user_role() = 'SUPER_ADMIN';
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION org_check(org_col UUID) RETURNS BOOLEAN AS $$
  SELECT app_is_super_admin() OR org_col = app_current_org_id();
$$ LANGUAGE SQL STABLE;

-- ══════════════════════════════════════════════════════════
-- USERS table (foundation for all FK-traversal policies)
-- ══════════════════════════════════════════════════════════

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON users;
CREATE POLICY tenant_isolation ON users FOR ALL USING (
  app_is_super_admin() OR organization_id = app_current_org_id()
);

-- ══════════════════════════════════════════════════════════
-- Staff sub-tables: staff_id -> staff_profiles -> users -> org
-- ══════════════════════════════════════════════════════════

ALTER TABLE qualifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON qualifications;
CREATE POLICY tenant_isolation ON qualifications FOR ALL USING (
  org_check((SELECT u.organization_id FROM staff_profiles sp JOIN users u ON u.id = sp.user_id WHERE sp.id = qualifications.staff_id))
);

ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON skills;
CREATE POLICY tenant_isolation ON skills FOR ALL USING (
  org_check((SELECT u.organization_id FROM staff_profiles sp JOIN users u ON u.id = sp.user_id WHERE sp.id = skills.staff_id))
);

ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON emergency_contacts;
CREATE POLICY tenant_isolation ON emergency_contacts FOR ALL USING (
  org_check((SELECT u.organization_id FROM staff_profiles sp JOIN users u ON u.id = sp.user_id WHERE sp.id = emergency_contacts.staff_id))
);

ALTER TABLE staff_availability ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON staff_availability;
CREATE POLICY tenant_isolation ON staff_availability FOR ALL USING (
  org_check((SELECT u.organization_id FROM staff_profiles sp JOIN users u ON u.id = sp.user_id WHERE sp.id = staff_availability.staff_id))
);

-- ══════════════════════════════════════════════════════════
-- Health tables: service_user_id -> service_users -> org
-- ══════════════════════════════════════════════════════════

ALTER TABLE health_observations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON health_observations;
CREATE POLICY tenant_isolation ON health_observations FOR ALL USING (
  org_check((SELECT organization_id FROM service_users WHERE service_users.id = health_observations.service_user_id))
);

ALTER TABLE bowel_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON bowel_movements;
CREATE POLICY tenant_isolation ON bowel_movements FOR ALL USING (
  org_check((SELECT organization_id FROM service_users WHERE service_users.id = bowel_movements.service_user_id))
);

ALTER TABLE dental_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON dental_records;
CREATE POLICY tenant_isolation ON dental_records FOR ALL USING (
  org_check((SELECT organization_id FROM service_users WHERE service_users.id = dental_records.service_user_id))
);

ALTER TABLE fluid_intake ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON fluid_intake;
CREATE POLICY tenant_isolation ON fluid_intake FOR ALL USING (
  org_check((SELECT organization_id FROM service_users WHERE service_users.id = fluid_intake.service_user_id))
);

-- ══════════════════════════════════════════════════════════
-- Compliance junction: profile_id -> compliance_profiles -> org
-- ══════════════════════════════════════════════════════════

ALTER TABLE compliance_profile_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON compliance_profile_requirements;
CREATE POLICY tenant_isolation ON compliance_profile_requirements FOR ALL USING (
  org_check((SELECT organization_id FROM compliance_profiles WHERE compliance_profiles.id = compliance_profile_requirements.profile_id))
);

-- ══════════════════════════════════════════════════════════
-- FORCE ROW LEVEL SECURITY on ALL tenant-scoped tables
-- Without this, table owners (the DB role the app connects as)
-- silently bypass RLS policies.
-- ══════════════════════════════════════════════════════════

DO $$ DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'users', 'locations', 'teams', 'departments',
    'compliance_requirements', 'compliance_config', 'compliance_profiles',
    'invitations',
    'leave_types', 'manager_delegations',
    'invoices', 'payment_methods',
    'shift_templates',
    'service_users',
    'incident_categories', 'incidents',
    'training_modules',
    'competency_templates',
    'emedication_records', 'emedication_daily_counts', 'emedication_stock',
    'emedication_deliveries',
    'dbs_checks',
    'service_user_expenses', 'petty_cash_balances', 'petty_cash_transactions',
    'ai_audit_logs', 'compliance_snapshots',
    'chat_channels',
    'satisfaction_surveys', 'staff_engagement_surveys',
    'tasks', 'room_checks', 'mobile_check_ins', 'trial_reminders',
    'survey_invitations', 'engagement_templates',
    'appointments', 'policies',
    'service_user_goals',
    'emedication_audit_log',
    'care_assessments', 'evidence_mappings', 'emedication_stock_adjustments',
    'agencies', 'agency_workers', 'agency_rates',
    'dspt_assessments', 'cqc_action_items',
    'family_members', 'outcome_scales',
    -- Child/FK-traversal tables
    'staff_profiles', 'documents', 'leave_requests', 'leave_balances',
    'shifts', 'shift_assignments', 'shift_swaps',
    'care_plans', 'daily_notes', 'risk_assessments',
    'family_contacts', 'body_map_entries', 'memory_book_entries',
    'clinical_scores', 'service_user_documents', 'su_wellbeing',
    'su_communication_log', 'su_capacity_assessments', 'su_care_pathways',
    'su_discharge_checklist', 'service_user_access_log',
    'training_records', 'competency_assessments', 'compliance_records',
    'incident_involved_residents', 'incident_actions',
    'location_certificates', 'team_members',
    'chat_members', 'chat_messages', 'chat_files',
    'emedication_items', 'emedication_administrations',
    'emedication_delivery_items', 'emedication_daily_count_items',
    'goal_milestones', 'goal_progress_history',
    'outcome_scale_results', 'delegation_audit_logs',
    'dspt_standard_status', 'notification_preferences', 'user_permissions',
    'notifications', 'audit_logs',
    -- New tables from this migration
    'qualifications', 'skills', 'emergency_contacts', 'staff_availability',
    'health_observations', 'bowel_movements', 'dental_records', 'fluid_intake',
    'compliance_profile_requirements'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE 'Table % does not exist, skipping FORCE RLS', tbl;
    END;
  END LOOP;
END $$;
