-- Migration 002: Enable Row-Level Security for tenant isolation
-- Targets all tables with a direct organization_id column.
-- RLS is defense-in-depth — the app already enforces org scoping via tenant.ts helpers.

-- Helper: get current org_id from session (null for SUPER_ADMIN / system queries)
CREATE OR REPLACE FUNCTION app_current_org_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_org_id', true), '')::UUID;
$$ LANGUAGE SQL STABLE;

-- Helper: get current user_id from session
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::UUID;
$$ LANGUAGE SQL STABLE;

-- Helper: get current user role from session
CREATE OR REPLACE FUNCTION app_current_user_role() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.current_user_role', true), '');
$$ LANGUAGE SQL STABLE;

-- Bypass for SUPER_ADMIN (cross-org access)
CREATE OR REPLACE FUNCTION app_is_super_admin() RETURNS BOOLEAN AS $$
  SELECT app_current_user_role() = 'SUPER_ADMIN';
$$ LANGUAGE SQL STABLE;

-- Generic tenant isolation policy: row visible only if org matches session, unless SUPER_ADMIN
-- Usage: CREATE POLICY tenant_isolation ON <table> FOR ALL USING (org_check(<table>.<org_column>));
CREATE OR REPLACE FUNCTION org_check(org_col UUID) RETURNS BOOLEAN AS $$
  SELECT app_is_super_admin() OR org_col = app_current_org_id();
$$ LANGUAGE SQL STABLE;

-- ══════════════════════════════════════════════════════════
-- APPLY RLS
-- ══════════════════════════════════════════════════════════

DO $$ DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'locations', 'teams',
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
    'family_members', 'outcome_scales'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I FOR ALL USING (org_check(organization_id))',
      tbl
    );
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════
-- Child tables without direct organization_id
-- RLS via FK traversal (subquery to parent org_id)
-- ══════════════════════════════════════════════════════════

-- staff_profiles: user_id -> users.organization_id
ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON staff_profiles;
CREATE POLICY tenant_isolation ON staff_profiles FOR ALL USING (
  org_check((SELECT organization_id FROM users WHERE users.id = staff_profiles.user_id))
);

-- documents: staff_id -> staff_profiles -> users -> org
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON documents;
CREATE POLICY tenant_isolation ON documents FOR ALL USING (
  org_check((SELECT u.organization_id FROM staff_profiles sp JOIN users u ON u.id = sp.user_id WHERE sp.id = documents.staff_id))
);

-- leave_requests: staff_id -> staff_profiles -> users -> org
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON leave_requests;
CREATE POLICY tenant_isolation ON leave_requests FOR ALL USING (
  org_check((SELECT u.organization_id FROM staff_profiles sp JOIN users u ON u.id = sp.user_id WHERE sp.id = leave_requests.staff_id))
);

-- leave_balances: staff_id -> staff_profiles -> users -> org
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON leave_balances;
CREATE POLICY tenant_isolation ON leave_balances FOR ALL USING (
  org_check((SELECT u.organization_id FROM staff_profiles sp JOIN users u ON u.id = sp.user_id WHERE sp.id = leave_balances.staff_id))
);

-- shifts: location_id -> locations.organization_id
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON shifts;
CREATE POLICY tenant_isolation ON shifts FOR ALL USING (
  org_check((SELECT organization_id FROM locations WHERE locations.id = shifts.location_id))
);

-- shift_assignments: shift_id -> shifts -> locations -> org
ALTER TABLE shift_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON shift_assignments;
CREATE POLICY tenant_isolation ON shift_assignments FOR ALL USING (
  org_check((SELECT l.organization_id FROM shifts s JOIN locations l ON l.id = s.location_id WHERE s.id = shift_assignments.shift_id))
);

-- shift_swaps: shift_id -> shifts -> locations -> org
ALTER TABLE shift_swaps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON shift_swaps;
CREATE POLICY tenant_isolation ON shift_swaps FOR ALL USING (
  org_check((SELECT l.organization_id FROM shifts s JOIN locations l ON l.id = s.location_id WHERE s.id = shift_swaps.shift_id))
);

-- care_plans: service_user_id -> service_users -> org
ALTER TABLE care_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON care_plans;
CREATE POLICY tenant_isolation ON care_plans FOR ALL USING (
  org_check((SELECT organization_id FROM service_users WHERE service_users.id = care_plans.service_user_id))
);

-- daily_notes
ALTER TABLE daily_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON daily_notes;
CREATE POLICY tenant_isolation ON daily_notes FOR ALL USING (
  org_check((SELECT organization_id FROM service_users WHERE service_users.id = daily_notes.service_user_id))
);

-- risk_assessments
ALTER TABLE risk_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON risk_assessments;
CREATE POLICY tenant_isolation ON risk_assessments FOR ALL USING (
  org_check((SELECT organization_id FROM service_users WHERE service_users.id = risk_assessments.service_user_id))
);

-- family_contacts, body_map_entries, memory_book_entries, clinical_scores,
-- service_user_documents, su_wellbeing, su_communication_log,
-- su_capacity_assessments, su_care_pathways, su_discharge_checklist
DO $$ DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'family_contacts', 'body_map_entries', 'memory_book_entries',
    'clinical_scores', 'service_user_documents', 'su_wellbeing',
    'su_communication_log', 'su_capacity_assessments', 'su_care_pathways',
    'su_discharge_checklist', 'service_user_access_log'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I FOR ALL USING (
        org_check((SELECT organization_id FROM service_users WHERE service_users.id = %I.service_user_id))
      )', tbl, tbl
    );
  END LOOP;
END $$;

-- training_records: module_id -> training_modules -> org
ALTER TABLE training_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON training_records;
CREATE POLICY tenant_isolation ON training_records FOR ALL USING (
  org_check((SELECT organization_id FROM training_modules WHERE training_modules.id = training_records.module_id))
);

-- competency_assessments: template_id -> competency_templates -> org
ALTER TABLE competency_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON competency_assessments;
CREATE POLICY tenant_isolation ON competency_assessments FOR ALL USING (
  org_check((SELECT organization_id FROM competency_templates WHERE competency_templates.id = competency_assessments.template_id))
);

-- compliance_records: requirement_id -> compliance_config -> org
ALTER TABLE compliance_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON compliance_records;
CREATE POLICY tenant_isolation ON compliance_records FOR ALL USING (
  org_check((SELECT organization_id FROM compliance_config WHERE compliance_config.id = compliance_records.requirement_id))
);

-- incident_involved_residents: incident_id -> incidents -> org
ALTER TABLE incident_involved_residents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON incident_involved_residents;
CREATE POLICY tenant_isolation ON incident_involved_residents FOR ALL USING (
  org_check((SELECT organization_id FROM incidents WHERE incidents.id = incident_involved_residents.incident_id))
);

-- incident_actions: incident_id -> incidents -> org
ALTER TABLE incident_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON incident_actions;
CREATE POLICY tenant_isolation ON incident_actions FOR ALL USING (
  org_check((SELECT organization_id FROM incidents WHERE incidents.id = incident_actions.incident_id))
);

-- location_certificates: location_id -> locations -> org
ALTER TABLE location_certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON location_certificates;
CREATE POLICY tenant_isolation ON location_certificates FOR ALL USING (
  org_check((SELECT organization_id FROM locations WHERE locations.id = location_certificates.location_id))
);

-- team_members: team_id -> teams -> org
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON team_members;
CREATE POLICY tenant_isolation ON team_members FOR ALL USING (
  org_check((SELECT organization_id FROM teams WHERE teams.id = team_members.team_id))
);

-- chat_members: channel_id -> chat_channels -> org
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON chat_members;
CREATE POLICY tenant_isolation ON chat_members FOR ALL USING (
  org_check((SELECT organization_id FROM chat_channels WHERE chat_channels.id = chat_members.channel_id))
);

-- chat_messages: channel_id -> chat_channels -> org
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON chat_messages;
CREATE POLICY tenant_isolation ON chat_messages FOR ALL USING (
  org_check((SELECT organization_id FROM chat_channels WHERE chat_channels.id = chat_messages.channel_id))
);

-- chat_files: channel_id -> chat_channels -> org
ALTER TABLE chat_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON chat_files;
CREATE POLICY tenant_isolation ON chat_files FOR ALL USING (
  org_check((SELECT organization_id FROM chat_channels WHERE chat_channels.id = chat_files.channel_id))
);

-- emedication_items: emedication_record_id -> emedication_records -> org
ALTER TABLE emedication_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON emedication_items;
CREATE POLICY tenant_isolation ON emedication_items FOR ALL USING (
  org_check((SELECT organization_id FROM emedication_records WHERE emedication_records.id = emedication_items.emedication_record_id))
);

-- emedication_administrations: emedication_item_id -> emedication_items -> emedication_records -> org
ALTER TABLE emedication_administrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON emedication_administrations;
CREATE POLICY tenant_isolation ON emedication_administrations FOR ALL USING (
  org_check((SELECT er.organization_id FROM emedication_items ei JOIN emedication_records er ON er.id = ei.emedication_record_id WHERE ei.id = emedication_administrations.emedication_item_id))
);

-- emedication_delivery_items: delivery_id -> emedication_deliveries -> org
ALTER TABLE emedication_delivery_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON emedication_delivery_items;
CREATE POLICY tenant_isolation ON emedication_delivery_items FOR ALL USING (
  org_check((SELECT organization_id FROM emedication_deliveries WHERE emedication_deliveries.id = emedication_delivery_items.delivery_id))
);

-- emedication_daily_count_items: daily_count_id -> emedication_daily_counts -> org
ALTER TABLE emedication_daily_count_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON emedication_daily_count_items;
CREATE POLICY tenant_isolation ON emedication_daily_count_items FOR ALL USING (
  org_check((SELECT organization_id FROM emedication_daily_counts WHERE emedication_daily_counts.id = emedication_daily_count_items.daily_count_id))
);

-- goal_milestones: goal_id -> service_user_goals -> org
ALTER TABLE goal_milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON goal_milestones;
CREATE POLICY tenant_isolation ON goal_milestones FOR ALL USING (
  org_check((SELECT organization_id FROM service_user_goals WHERE service_user_goals.id = goal_milestones.goal_id))
);

-- goal_progress_history: goal_id -> service_user_goals -> org
ALTER TABLE goal_progress_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON goal_progress_history;
CREATE POLICY tenant_isolation ON goal_progress_history FOR ALL USING (
  org_check((SELECT organization_id FROM service_user_goals WHERE service_user_goals.id = goal_progress_history.goal_id))
);

-- outcome_scale_results: scale_id -> outcome_scales -> org
ALTER TABLE outcome_scale_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON outcome_scale_results;
CREATE POLICY tenant_isolation ON outcome_scale_results FOR ALL USING (
  org_check((SELECT organization_id FROM outcome_scales WHERE outcome_scales.id = outcome_scale_results.scale_id))
);

-- delegation_audit_logs: delegation_id -> manager_delegations -> org
ALTER TABLE delegation_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON delegation_audit_logs;
CREATE POLICY tenant_isolation ON delegation_audit_logs FOR ALL USING (
  org_check((SELECT organization_id FROM manager_delegations WHERE manager_delegations.id = delegation_audit_logs.delegation_id))
);

-- dspt_standard_status: assessment_id -> dspt_assessments -> org
ALTER TABLE dspt_standard_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON dspt_standard_status;
CREATE POLICY tenant_isolation ON dspt_standard_status FOR ALL USING (
  org_check((SELECT organization_id FROM dspt_assessments WHERE dspt_assessments.id = dspt_standard_status.assessment_id))
);

-- notification_preferences: user_id -> users -> org
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON notification_preferences;
CREATE POLICY tenant_isolation ON notification_preferences FOR ALL USING (
  org_check((SELECT organization_id FROM users WHERE users.id = notification_preferences.user_id))
);

-- user_permissions: user_id -> users -> org
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON user_permissions;
CREATE POLICY tenant_isolation ON user_permissions FOR ALL USING (
  org_check((SELECT organization_id FROM users WHERE users.id = user_permissions.user_id))
);

-- departments: location_id -> locations -> org
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON departments;
CREATE POLICY tenant_isolation ON departments FOR ALL USING (
  org_check((SELECT organization_id FROM locations WHERE locations.id = departments.location_id))
);

-- notifications: user_id -> users -> org
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON notifications;
CREATE POLICY tenant_isolation ON notifications FOR ALL USING (
  org_check((SELECT organization_id FROM users WHERE users.id = notifications.user_id))
);

-- audit_logs: user_id -> users -> org
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON audit_logs;
CREATE POLICY tenant_isolation ON audit_logs FOR ALL USING (
  org_check((SELECT organization_id FROM users WHERE users.id = audit_logs.user_id))
);

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
