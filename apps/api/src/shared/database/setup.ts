import fs from 'fs';
import path from 'path';
import { migrateQuery as query } from './index';
import logger from '../utils/logger';
import { runMigrations, Migration } from './migrate';

const RLS_MIGRATION: Migration = {
  name: '002_enable_rls',
  strict: false,
  statements: (() => {
    const p = path.join(__dirname, 'migrations', '002_enable_rls.sql');
    return [fs.readFileSync(p, 'utf8')];
  })(),
};

const MIGRATION_003: Migration = {
  name: '003_add_missing_rls',
  strict: false,
  statements: (() => {
    const p = path.join(__dirname, 'migrations', '003_add_missing_rls.sql');
    return [fs.readFileSync(p, 'utf8')];
  })(),
};

const APP_ROLE_MIGRATION: Migration = {
  name: '004_create_app_role',
  strict: false,
  statements: (() => {
    const p = path.join(__dirname, 'migrations', '004_create_app_role.sql');
    return [fs.readFileSync(p, 'utf8')];
  })(),
};

const MIGRATION_005: Migration = {
  name: '005_daily_shift_audit_toggle',
  strict: false,
  statements: [
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS daily_shift_audit_enabled BOOLEAN DEFAULT true`,
  ],
};

const MIGRATION_006: Migration = {
  name: '006_daily_shift_audit_time',
  strict: false,
  statements: [
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS daily_shift_audit_time TIME DEFAULT '19:00'`,
  ],
};

const MIGRATION_007: Migration = {
  name: '007_person_location_staffing',
  strict: false,
  statements: [
    `ALTER TABLE people ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL`,
    `ALTER TABLE people ADD COLUMN IF NOT EXISTS min_staff_required INTEGER DEFAULT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_people_location ON people(location_id)`,
  ],
};

const MIGRATION_008: Migration = {
  name: '008_medication_alert_settings',
  strict: false,
  statements: [
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS reorder_alert_enabled BOOLEAN DEFAULT true`,
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS late_med_alert_enabled BOOLEAN DEFAULT true`,
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS late_med_alert_delay_minutes INTEGER DEFAULT 30`,
    `ALTER TABLE emedication_administrations ADD COLUMN IF NOT EXISTS late_alert_sent_at TIMESTAMPTZ`,
  ],
};

const MIGRATION_010: Migration = {
  name: '010_goal_outcome_fields',
  strict: false,
  statements: [
    `ALTER TABLE person_goals ADD COLUMN IF NOT EXISTS provider_clarification TEXT`,
    `ALTER TABLE person_goals ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL`,
    `ALTER TABLE person_goals ADD COLUMN IF NOT EXISTS status_reason TEXT`,
    `ALTER TABLE person_goals ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false`,
    `ALTER TABLE person_goals ADD COLUMN IF NOT EXISTS started_at DATE`,
  ],
};

const MIGRATION_011: Migration = {
  name: '011_care_plan_file_name',
  strict: false,
  statements: [
    `ALTER TABLE care_plans ADD COLUMN IF NOT EXISTS file_name TEXT`,
  ],
};

const MIGRATION_012: Migration = {
  name: '012_rename_service_user_to_person',
  strict: false,
  statements: (() => {
    const p = path.join(__dirname, 'migrations', '012_rename_service_user_to_person.sql');
    return [fs.readFileSync(p, 'utf8')];
  })(),
};

const MIGRATION_013: Migration = {
  name: '013_risk_assessment_file',
  strict: false,
  statements: [
    `ALTER TABLE risk_assessments ADD COLUMN IF NOT EXISTS file_url TEXT`,
    `ALTER TABLE risk_assessments ADD COLUMN IF NOT EXISTS file_name TEXT`,
  ],
};

const MIGRATION_014: Migration = {
  name: '014_assessment_pathway_file',
  strict: false,
  statements: [
    `ALTER TABLE care_assessments ADD COLUMN IF NOT EXISTS file_url VARCHAR(500)`,
    `ALTER TABLE care_assessments ADD COLUMN IF NOT EXISTS file_name VARCHAR(255)`,
    `ALTER TABLE person_care_pathways ADD COLUMN IF NOT EXISTS file_url VARCHAR(500)`,
    `ALTER TABLE person_care_pathways ADD COLUMN IF NOT EXISTS file_name VARCHAR(255)`,
  ],
};

const MIGRATION_015: Migration = {
  name: '015_fluid_daily_target',
  strict: false,
  statements: [
    `ALTER TABLE people ADD COLUMN IF NOT EXISTS fluid_daily_target INTEGER DEFAULT 2000`,
  ],
};

const MIGRATION_016: Migration = {
  name: '016_time_away',
  strict: false,
  statements: [
    // Parent record for a titled period away (weekend visit, hospital stay, permanent discharge)
    `CREATE TABLE IF NOT EXISTS person_time_away (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      time_away_type VARCHAR(50) NOT NULL DEFAULT 'other' CHECK (time_away_type IN ('family_visit','short_break','hospital_admission','hospital_discharge','trial_leave','discharge','other')),
      destination VARCHAR(255),
      start_date DATE,
      end_date DATE,
      notes TEXT,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_time_away_person ON person_time_away(person_id)`,
    // Items table (legacy name person_discharge_checklist) gains a parent link + optional quantity/unit
    `ALTER TABLE person_discharge_checklist ADD COLUMN IF NOT EXISTS time_away_id UUID REFERENCES person_time_away(id) ON DELETE CASCADE`,
    `ALTER TABLE person_discharge_checklist ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2)`,
    `ALTER TABLE person_discharge_checklist ADD COLUMN IF NOT EXISTS unit VARCHAR(50)`,
    `CREATE INDEX IF NOT EXISTS idx_discharge_checklist_time_away ON person_discharge_checklist(time_away_id)`,
    // RLS: person_time_away inherits tenant isolation via FK traversal to people.organization_id
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'person_time_away' AND policyname = 'tenant_isolation') THEN
         ALTER TABLE person_time_away ENABLE ROW LEVEL SECURITY;
         ALTER TABLE person_time_away FORCE ROW LEVEL SECURITY;
         CREATE POLICY tenant_isolation ON person_time_away FOR ALL USING (
           org_check((SELECT organization_id FROM people WHERE people.id = person_time_away.person_id))
         );
       END IF;
     END $$`,
    // Backfill: existing checklist items without a parent become a single "Discharge" record
    `INSERT INTO person_time_away (person_id, title, time_away_type, destination, created_at)
     SELECT DISTINCT dc.person_id, 'Discharge', 'discharge', 'Leaving the care home', NOW()
     FROM person_discharge_checklist dc
     WHERE dc.time_away_id IS NULL
     ON CONFLICT DO NOTHING`,
    `UPDATE person_discharge_checklist dc SET time_away_id = ta.id
     FROM person_time_away ta
     WHERE ta.person_id = dc.person_id AND dc.time_away_id IS NULL AND ta.title = 'Discharge' AND ta.time_away_type = 'discharge'`,
  ],
};

const MIGRATION_017: Migration = {
  name: '017_delivery_received_by_text',
  strict: false,
  statements: [
    // received_by was a UUID FK to users but the UI collects a free-text name
    `ALTER TABLE emedication_deliveries DROP CONSTRAINT IF EXISTS emedication_deliveries_received_by_fkey`,
    `ALTER TABLE emedication_deliveries ALTER COLUMN received_by TYPE VARCHAR(255)`,
  ],
};

const MIGRATION_018: Migration = {
  name: '018_deliveries_person_id',
  strict: false,
  statements: [
    // Legacy databases created before person-scoped deliveries lack the person_id column
    // (setup.ts only adds it for fresh DBs; migrations must backfill existing ones).
    `ALTER TABLE emedication_deliveries ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES people(id) ON DELETE SET NULL`,
    `CREATE INDEX IF NOT EXISTS idx_emed_deliveries_person ON emedication_deliveries(person_id)`,
  ],
};

const MIGRATION_019: Migration = {
  name: '019_emed_daily_count_sessions',
  strict: false,
  statements: [
    // Legacy databases created before per-session daily counts lack count_session/counted_at
    // (setup.ts only adds them for fresh DBs; migrations must backfill existing ones).
    `ALTER TABLE emedication_daily_counts ADD COLUMN IF NOT EXISTS count_session VARCHAR(50) DEFAULT 'end_of_day'`,
    `ALTER TABLE emedication_daily_counts ADD COLUMN IF NOT EXISTS counted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`,
    // Replace the legacy UNIQUE(person_id, count_date) constraint so AM/PM counts can coexist.
    // 012 renames service_user_id -> person_id but the constraint may carry either auto-name.
    `ALTER TABLE emedication_daily_counts DROP CONSTRAINT IF EXISTS emedication_daily_counts_person_id_count_date_key`,
    `ALTER TABLE emedication_daily_counts DROP CONSTRAINT IF EXISTS emedication_daily_counts_service_user_id_count_date_key`,
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_emed_daily_counts_person_date_session ON emedication_daily_counts(person_id, count_date, count_session)`,
    // Escalation flag on per-medication count items (schema.sql-only for fresh DBs)
    `ALTER TABLE emedication_daily_count_items ADD COLUMN IF NOT EXISTS escalate BOOLEAN DEFAULT FALSE`,
  ],
};

const MIGRATION_020: Migration = {
  name: '020_emedication_count_convention',
  strict: false,
  statements: [
    // Org-level medication count convention was added to INITIAL_MIGRATION (001_initial) after
    // existing DBs had already applied it, so the name-based runner never re-ran the statement.
    // Versioned backfill so settings GET/PATCH no longer 500 on the missing column.
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS emedication_count_convention VARCHAR(20) DEFAULT 'end_of_day' CHECK (emedication_count_convention IN ('end_of_day', 'am_pm', 'after_each'))`,
  ],
};

const MIGRATION_021: Migration = {
  name: '021_agency_booking_fields',
  strict: false,
  statements: [
    `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS agency_shift_reference VARCHAR(100)`,
    `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS agency_notes TEXT`,
  ],
};

const MIGRATION_022: Migration = {
  name: '022_subscription_expiry_tracking',
  strict: false,
  statements: [
    // Persist the Stripe subscription period end so background jobs can send 7/3/1-day
    // renewal reminders + win-back emails for paid subscriptions (was live-read only).
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE`,
    // trial_reminders was trial-only; widen it to subscriptions and dedupe per kind.
    `ALTER TABLE trial_reminders ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'trial' CHECK (kind IN ('trial', 'subscription'))`,
    `DO $$ BEGIN
       ALTER TABLE trial_reminders DROP CONSTRAINT IF EXISTS trial_reminders_organization_id_reminder_days_key;
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trial_reminders_org_kind_days_uniq') THEN
         ALTER TABLE trial_reminders ADD CONSTRAINT trial_reminders_org_kind_days_uniq UNIQUE (organization_id, kind, reminder_days);
       END IF;
     END $$`,
  ],
};

const MIGRATION_023: Migration = {
  name: '023_stripe_webhook_dedupe',
  strict: false,
  statements: [
    // Stripe webhook events can be delivered multiple times; dedupe so receipts and
    // dunning emails are sent exactly once per event. App role gets DML via the
    // ALTER DEFAULT PRIVILEGES set in 004_create_app_role.
    `CREATE TABLE IF NOT EXISTS stripe_webhook_events (
       event_id TEXT PRIMARY KEY,
       event_type TEXT NOT NULL,
       processed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
     )`,
    // Track which dunning-email milestones (days since first failure) have been sent,
    // so the escalating failed-payment sequence fires once per stage.
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS dunning_email_milestones INTEGER[] DEFAULT '{}'`,
  ],
};

const MIGRATION_024: Migration = {
  name: '024_chat_reactions',
  strict: false,
  statements: [
    `CREATE TABLE IF NOT EXISTS chat_reactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji VARCHAR(32) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(message_id, user_id, emoji)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_chat_reactions_message ON chat_reactions(message_id)`,
    // RLS: org via message_id -> chat_messages -> channel_id -> chat_channels -> org
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chat_reactions' AND policyname = 'tenant_isolation') THEN
         ALTER TABLE chat_reactions ENABLE ROW LEVEL SECURITY;
         ALTER TABLE chat_reactions FORCE ROW LEVEL SECURITY;
         CREATE POLICY tenant_isolation ON chat_reactions FOR ALL USING (
           org_check((SELECT organization_id FROM chat_channels WHERE chat_channels.id = (SELECT channel_id FROM chat_messages WHERE chat_messages.id = chat_reactions.message_id)))
         );
       END IF;
     END $$`,
  ],
};

const MIGRATION_025: Migration = {
  name: '025_onboarding_dismissed',
  strict: false,
  statements: [
    // Server-side record of the dashboard welcome/onboarding card being dismissed,
    // so the "don't show again" choice survives logout (localStorage is cleared).
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_dismissed_at TIMESTAMP WITH TIME ZONE`,
  ],
};

const MIGRATION_026: Migration = {
  name: '026_location_operational_profile',
  strict: false,
  statements: [
    // Operational profile for a supported-living / care location: what the
    // house provides, contact details and regulator ratings used on the
    // location detail page (Health & Safety / ratings).
    `ALTER TABLE locations ADD COLUMN IF NOT EXISTS service_type VARCHAR(30) CHECK (service_type IN ('supported_living', 'residential', 'domiciliary'))`,
    `ALTER TABLE locations ADD COLUMN IF NOT EXISTS service_capacity INTEGER`,
    `ALTER TABLE locations ADD COLUMN IF NOT EXISTS phone VARCHAR(50)`,
    `ALTER TABLE locations ADD COLUMN IF NOT EXISTS email VARCHAR(255)`,
    `ALTER TABLE locations ADD COLUMN IF NOT EXISTS food_hygiene_rating SMALLINT CHECK (food_hygiene_rating BETWEEN 0 AND 5)`,
    `ALTER TABLE locations ADD COLUMN IF NOT EXISTS cqc_rating VARCHAR(30) CHECK (cqc_rating IN ('outstanding', 'good', 'requires_improvement', 'inadequate'))`,
    `ALTER TABLE locations ADD COLUMN IF NOT EXISTS last_cqc_inspection DATE`,
  ],
};

const MIGRATION_027: Migration = {
  name: '027_location_certificate_file_name',
  strict: false,
  statements: [
    // Original filename for a certificate document so the UI can show a
    // friendly label alongside the private file URL.
    `ALTER TABLE location_certificates ADD COLUMN IF NOT EXISTS file_name VARCHAR(255)`,
  ],
};

const MIGRATION_028: Migration = {
  name: '028_leave_type_approval_flags',
  strict: false,
  statements: [
    // Whether a leave type is paid and whether requests need manager approval.
    // requires_approval=false makes requests auto-approve on submission.
    `ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT TRUE`,
    `ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT TRUE`,
  ],
};

const MIGRATION_009: Migration = {
  name: '009_care_plan_person_centred_sections',
  strict: false,
  statements: [
    `ALTER TABLE care_plans ADD COLUMN IF NOT EXISTS sections JSONB DEFAULT '{}'`,
    `ALTER TABLE care_plans ADD COLUMN IF NOT EXISTS file_name TEXT`,
  ],
};

const INITIAL_MIGRATION: Migration = {
  name: '001_initial',
  strict: false,
  statements: [
  // Missing updated_at for organizations (exists in CREATE TABLE but never had ALTER TABLE migration)
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`,
  // Original onboarding columns (added to CREATE TABLE after DB was created)
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE`,
  // New subscription columns
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'starter'`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'trial'`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE`,
  // Ensure staff_profiles.user_id has unique constraint for ON CONFLICT
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_profiles_user_id_key') THEN ALTER TABLE staff_profiles ADD CONSTRAINT staff_profiles_user_id_key UNIQUE (user_id); END IF; END $$`,
  // Users table may have been created before email_verified was added to schema
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE`,
  // Force password reset column for admin-triggered resets
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_reset BOOLEAN DEFAULT FALSE`,
  // Extended staff profile columns
  `ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS profile_picture_url TEXT`,
  `ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(50)`,
  `ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS address TEXT`,
  `ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS city VARCHAR(100)`,
  `ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS country VARCHAR(100)`,
  `ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20)`,
  // Staff profile employment fields
  `ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS employment_type VARCHAR(20) DEFAULT 'full_time'`,
  `ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS contracted_hours_weekly DECIMAL(5,1) DEFAULT 37.5`,
  `ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL`,
  // Leave type duration_type
  `ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS duration_type VARCHAR(10) NOT NULL DEFAULT 'days' CHECK (duration_type IN ('days', 'hours'))`,
  `ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS hours_allowed DECIMAL(6,1) DEFAULT 0`,
  // Leave request hours support
  `ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS hours_requested DECIMAL(5,1)`,
  `ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS duration_type VARCHAR(10) NOT NULL DEFAULT 'days' CHECK (duration_type IN ('days', 'hours'))`,
  // Leave balance hours support
  `ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS hours_allocated DECIMAL(6,1) NOT NULL DEFAULT 0`,
  `ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS hours_taken DECIMAL(6,1) NOT NULL DEFAULT 0`,
  // Organization settings columns
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS leave_start_month INTEGER DEFAULT 1`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS leave_calculation_type VARCHAR(20) DEFAULT 'proportional'`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_hours_per_leave_day DECIMAL(5,1) DEFAULT 7.5`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS base_leave_hours DECIMAL(6,1) DEFAULT 240`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS base_contracted_hours DECIMAL(5,1) DEFAULT 40`,
  // Location manager
  `ALTER TABLE locations ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES users(id) ON DELETE SET NULL`,
  // Staff on-leave status
  `ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS is_on_leave BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS on_leave_until DATE`,
  // Compliance config
  `ALTER TABLE compliance_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`,
  // Invoices table columns (for existing DBs)
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS description TEXT`,
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'GBP'`,
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE`,
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_at DATE`,
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT`,
  `ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS cardholder_name VARCHAR(255)`,
  // Payment methods
  `ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT`,
  // Compliance profile columns
  `ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS compliance_profile_id UUID REFERENCES compliance_profiles(id) ON DELETE SET NULL`,
  `ALTER TABLE compliance_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`,
  // Fix compliance_records to reference compliance_config (was compliance_requirements which doesn't exist)
  `ALTER TABLE compliance_records ADD COLUMN IF NOT EXISTS issued_at DATE`,
  `ALTER TABLE compliance_records ADD COLUMN IF NOT EXISTS expires_at DATE`,
  `ALTER TABLE compliance_records ADD COLUMN IF NOT EXISTS notes TEXT`,
  `ALTER TABLE compliance_records ADD COLUMN IF NOT EXISTS file_url TEXT`,
  `ALTER TABLE compliance_records ALTER COLUMN status SET DEFAULT 'incomplete'`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS minimum_compliance_percent INTEGER DEFAULT 100`,
  `ALTER TABLE locations ADD COLUMN IF NOT EXISTS minimum_staff_per_day INTEGER DEFAULT 1`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS overtime_requires_approval BOOLEAN DEFAULT TRUE`,
  `ALTER TABLE shift_assignments ADD COLUMN IF NOT EXISTS is_overtime BOOLEAN DEFAULT FALSE`,
  // Multi-regulator support
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS regulator VARCHAR(20) DEFAULT 'cqc'`,
  // Document auto-approval
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS auto_approve_documents BOOLEAN DEFAULT FALSE`,
  // AI integration config
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS ai_config JSONB DEFAULT '{"enabled": false}'`,
  `CREATE TABLE IF NOT EXISTS ai_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    feature VARCHAR(50) NOT NULL,
    provider VARCHAR(20) NOT NULL,
    model VARCHAR(50) NOT NULL,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    cost_usd DECIMAL(10,6),
    input_summary TEXT,
    output_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `ALTER TABLE ai_audit_logs ADD COLUMN IF NOT EXISTS prompt_key VARCHAR(100)`,
  `ALTER TABLE ai_audit_logs ADD COLUMN IF NOT EXISTS duration_ms INTEGER`,
  `ALTER TABLE ai_audit_logs ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT TRUE`,
  `ALTER TABLE ai_audit_logs ADD COLUMN IF NOT EXISTS error_message TEXT`,
  `ALTER TABLE ai_audit_logs ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL`,
  `ALTER TABLE ai_audit_logs ADD COLUMN IF NOT EXISTS request_data JSONB`,
  `ALTER TABLE ai_audit_logs ADD COLUMN IF NOT EXISTS response_summary TEXT`,
  `CREATE INDEX IF NOT EXISTS idx_ai_audit_org ON ai_audit_logs(organization_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_audit_feature ON ai_audit_logs(feature)`,
  // Compliance snapshots for trend tracking
  `CREATE TABLE IF NOT EXISTS compliance_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    overall_score DECIMAL(5,2) NOT NULL,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_comp_snap_org_date ON compliance_snapshots(organization_id, snapshot_date)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_comp_snap_staff_date ON compliance_snapshots(staff_id, snapshot_date)`,
  // Person Management
  `CREATE TABLE IF NOT EXISTS people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    nhs_number VARCHAR(20),
    room_number VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','discharged','deceased')),
    gp_name VARCHAR(255),
    gp_surgery VARCHAR(255),
    gp_phone VARCHAR(50),
    dietary_requirements TEXT,
    allergies JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS care_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    risk_assessment TEXT,
    review_date DATE,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS daily_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note_date DATE NOT NULL DEFAULT CURRENT_DATE,
    shift VARCHAR(10) NOT NULL CHECK (shift IN ('day','night')),
    category VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS risk_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low','medium','high','critical')),
    details TEXT,
    mitigation_actions TEXT,
    review_date DATE,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS family_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    relationship VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(255),
    is_emergency_contact BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  // Indexes for people
  `CREATE INDEX IF NOT EXISTS idx_people_org ON people(organization_id)`,
  `CREATE INDEX IF NOT EXISTS idx_people_status ON people(status)`,
  `CREATE INDEX IF NOT EXISTS idx_care_plans_person ON care_plans(person_id)`,
  `CREATE INDEX IF NOT EXISTS idx_daily_notes_person ON daily_notes(person_id)`,
  `CREATE INDEX IF NOT EXISTS idx_daily_notes_date ON daily_notes(note_date)`,
  `CREATE INDEX IF NOT EXISTS idx_risk_assessments_person ON risk_assessments(person_id)`,
  `CREATE INDEX IF NOT EXISTS idx_family_contacts_person ON family_contacts(person_id)`,
  // Incident Management tables
  `CREATE TABLE IF NOT EXISTS incident_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
    is_cqc_reportable BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category_id UUID REFERENCES incident_categories(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    incident_date DATE NOT NULL DEFAULT CURRENT_DATE,
    incident_time TIME,
    location VARCHAR(255),
    severity VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
    status VARCHAR(20) NOT NULL DEFAULT 'reported' CHECK (status IN ('reported','investigating','resolved','closed')),
    is_cqc_reportable BOOLEAN DEFAULT FALSE,
    reported_to_cqc_at TIMESTAMP WITH TIME ZONE,
    cqc_reference VARCHAR(100),
    root_cause TEXT,
    outcomes TEXT,
    reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS incident_involved_residents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    person_id UUID REFERENCES people(id) ON DELETE SET NULL,
    involvement_type VARCHAR(50) DEFAULT 'affected' CHECK (involvement_type IN ('affected','witness','involved')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS incident_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    due_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  // Incident indexes
  `CREATE INDEX IF NOT EXISTS idx_incidents_org ON incidents(organization_id)`,
  `CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status)`,
  `CREATE INDEX IF NOT EXISTS idx_incidents_date ON incidents(incident_date)`,
  `CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity)`,
  `CREATE INDEX IF NOT EXISTS idx_incident_categories_org ON incident_categories(organization_id)`,
  `CREATE INDEX IF NOT EXISTS idx_incident_involved_incident ON incident_involved_residents(incident_id)`,
  `CREATE INDEX IF NOT EXISTS idx_incident_actions_incident ON incident_actions(incident_id)`,
  // Restore unique constraint on email (globally unique users)
  // First deduplicate: keep newest user per email, deactivate older duplicates
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key') THEN
    WITH dupes AS (
      SELECT email FROM users GROUP BY email HAVING COUNT(*) > 1
    ), to_keep AS (
      SELECT DISTINCT ON (u.email) u.id FROM users u WHERE u.email IN (SELECT email FROM dupes) ORDER BY u.email, u.created_at DESC
    ), to_deactivate AS (
      SELECT u.id FROM users u WHERE u.email IN (SELECT email FROM dupes) AND u.id NOT IN (SELECT id FROM to_keep)
    )
    UPDATE users SET status = 'deactivated' WHERE id IN (SELECT id FROM to_deactivate);
    ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
  END IF; END $$`,
  // MFA columns
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS backup_codes TEXT[] DEFAULT '{}'`,
  // Teams
  `CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_teams_org ON teams(organization_id)`,
  `CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id)`,
  `CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id)`,
  // Branding columns for organizations
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url TEXT`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7) DEFAULT '#0F4C81'`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(7) DEFAULT '#6B7280'`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS accent_color VARCHAR(7) DEFAULT '#F8FAFC'`,
  // Department ID on staff profiles for staff-to-department linking
  `ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL`,
  // Force MFA for organization
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS force_mfa BOOLEAN DEFAULT FALSE`,
  // Chat / Communication tables
  `CREATE TABLE IF NOT EXISTS chat_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'group' CHECK (type IN ('general', 'group', 'dm')),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_chat_channels_org ON chat_channels(organization_id)`,
  `CREATE TABLE IF NOT EXISTS chat_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(channel_id, user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_chat_members_channel ON chat_members(channel_id)`,
  `CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id)`,
  `CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT,
    file_url TEXT,
    file_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    edited_at TIMESTAMP WITH TIME ZONE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON chat_messages(channel_id)`,
  `CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(channel_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS chat_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_size BIGINT,
    file_type VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_chat_files_channel ON chat_files(channel_id)`,
  // Training Compliance Matrix
  `CREATE TABLE IF NOT EXISTS training_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    frequency_days INTEGER,
    is_mandatory BOOLEAN DEFAULT TRUE,
    requires_competency BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_training_modules_org ON training_modules(organization_id)`,
  `CREATE TABLE IF NOT EXISTS training_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
    completed_at DATE,
    expires_at DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'incomplete' CHECK (status IN ('incomplete','completed','expired')),
    competency_passed BOOLEAN,
    trainer_name VARCHAR(255),
    digital_signature TEXT,
    notes TEXT,
    file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(module_id, staff_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_training_records_module ON training_records(module_id)`,
  `CREATE INDEX IF NOT EXISTS idx_training_records_staff ON training_records(staff_id)`,
  `CREATE INDEX IF NOT EXISTS idx_training_records_expires ON training_records(expires_at)`,
  // Competency Assessments
  `CREATE TABLE IF NOT EXISTS competency_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    criteria TEXT,
    requires_reassessment_days INTEGER DEFAULT 365,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_competency_templates_org ON competency_templates(organization_id)`,
  `CREATE TABLE IF NOT EXISTS competency_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES competency_templates(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
    assessor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    passed BOOLEAN NOT NULL,
    assessed_at DATE NOT NULL DEFAULT CURRENT_DATE,
    reassessment_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(template_id, staff_id, assessed_at)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_competency_assessments_staff ON competency_assessments(staff_id)`,
  `CREATE INDEX IF NOT EXISTS idx_competency_assessments_template ON competency_assessments(template_id)`,
  `ALTER TABLE competency_assessments ADD COLUMN IF NOT EXISTS involved_parties TEXT`,

  // Location certificates (gas safety, food hygiene, fire safety, etc.)
  `CREATE TABLE IF NOT EXISTS location_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    certificate_type VARCHAR(100) NOT NULL,
    issuing_body VARCHAR(255),
    certificate_number VARCHAR(100),
    issue_date DATE,
    expiry_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'expiring_soon', 'expired', 'pending_renewal')),
    file_url TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_location_certificates_location ON location_certificates(location_id)`,
  `CREATE INDEX IF NOT EXISTS idx_location_certificates_expiry ON location_certificates(expiry_date)`,
  `DO $$ BEGIN CREATE TRIGGER trg_location_certificates_updated BEFORE UPDATE ON location_certificates FOR EACH ROW EXECUTE FUNCTION update_updated_at(); EXCEPTION WHEN duplicate_object THEN null; END $$`,
  // Satisfaction surveys for CQC Caring domain
  `CREATE TABLE IF NOT EXISTS satisfaction_surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    person_id UUID REFERENCES people(id) ON DELETE SET NULL,
    respondent_name VARCHAR(255),
    relationship VARCHAR(100),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_satisfaction_surveys_org ON satisfaction_surveys(organization_id)`,
  `CREATE INDEX IF NOT EXISTS idx_satisfaction_surveys_person ON satisfaction_surveys(person_id)`,
  // Engagement survey templates (must be created before references below)
  `CREATE TABLE IF NOT EXISTS engagement_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    questions JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_engagement_templates_org ON engagement_templates(organization_id)`,
  // Staff engagement surveys for CQC Well-led domain
  `CREATE TABLE IF NOT EXISTS staff_engagement_surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    respondent_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ratings JSONB NOT NULL DEFAULT '{}',
    comments TEXT,
    is_anonymous BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_staff_engagement_org ON staff_engagement_surveys(organization_id)`,
  `ALTER TABLE staff_engagement_surveys ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES engagement_templates(id) ON DELETE SET NULL`,
  `ALTER TABLE satisfaction_surveys ADD COLUMN IF NOT EXISTS manager_notes TEXT`,
  // Task Management
  `CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    assigned_to UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
    person_id UUID REFERENCES people(id) ON DELETE SET NULL,
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','cancelled')),
    due_date DATE,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_org ON tasks(organization_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(organization_id, status)`,
  // Room Checks
  `CREATE TABLE IF NOT EXISTS room_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    room_number VARCHAR(50) NOT NULL,
    checked_by UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
    check_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'pass' CHECK (status IN ('pass','fail','needs_attention')),
    cleanliness_rating INTEGER CHECK (cleanliness_rating BETWEEN 1 AND 5),
    safety_rating INTEGER CHECK (safety_rating BETWEEN 1 AND 5),
    notes TEXT,
    photo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_room_checks_org ON room_checks(organization_id)`,
  `CREATE INDEX IF NOT EXISTS idx_room_checks_date ON room_checks(organization_id, check_date)`,
  // Mobile PWA: SecureVisit check-ins
  `CREATE TABLE IF NOT EXISTS mobile_check_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION,
    checked_in_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_mobile_checkins_user ON mobile_check_ins(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_mobile_checkins_date ON mobile_check_ins(user_id, checked_in_at DESC)`,
  // Trial reminders — track sent email milestones to avoid duplicates
  `CREATE TABLE IF NOT EXISTS trial_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    reminder_days INTEGER NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, reminder_days)
  )`,
  // CQC-mandated training tagging per role
  `ALTER TABLE training_modules ADD COLUMN IF NOT EXISTS cqc_mandated BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE training_modules ADD COLUMN IF NOT EXISTS cqc_mandated_for_roles JSONB DEFAULT '[]'`,
  // Competency-to-CQC-statement mapping
  `ALTER TABLE competency_templates ADD COLUMN IF NOT EXISTS cqc_statement_id VARCHAR(10)`,
  // Compliance alert threshold for escalation
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS compliance_alert_threshold INTEGER DEFAULT 80`,
  // Survey invitations for email-based feedback
  `CREATE TABLE IF NOT EXISTS survey_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('satisfaction', 'engagement')),
    email VARCHAR(255) NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    respondent_name VARCHAR(255),
    relationship VARCHAR(100),
    person_id UUID REFERENCES people(id) ON DELETE SET NULL,
    person_name VARCHAR(255),
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    template_id UUID REFERENCES engagement_templates(id) ON DELETE SET NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_survey_invitations_org ON survey_invitations(organization_id)`,
  `CREATE INDEX IF NOT EXISTS idx_survey_invitations_token ON survey_invitations(token)`,
  // Add template_id to survey_invitations for engagement surveys
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='survey_invitations' AND column_name='template_id') THEN ALTER TABLE survey_invitations ADD COLUMN template_id UUID REFERENCES engagement_templates(id) ON DELETE SET NULL; END IF; END $$`,
  // Engagement survey templates
  `CREATE TABLE IF NOT EXISTS engagement_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    questions JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_engagement_templates_org ON engagement_templates(organization_id)`,
  // Add invitation_token to satisfaction_surveys
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='satisfaction_surveys' AND column_name='invitation_token') THEN ALTER TABLE satisfaction_surveys ADD COLUMN invitation_token VARCHAR(64); END IF; END $$`,
  // Fix survey_invitations FK from staff_profiles to people
  `DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'survey_invitations_person_id_fkey' AND table_name = 'survey_invitations') THEN ALTER TABLE survey_invitations DROP CONSTRAINT survey_invitations_person_id_fkey; ALTER TABLE survey_invitations ADD CONSTRAINT survey_invitations_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL; END IF; END $$`,
  // Rename satisfaction_surveys.staff_id to person_id and point FK at people
  `DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='satisfaction_surveys' AND column_name='staff_id') THEN
      IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'satisfaction_surveys_staff_id_fkey' AND table_name = 'satisfaction_surveys') THEN
        ALTER TABLE satisfaction_surveys DROP CONSTRAINT satisfaction_surveys_staff_id_fkey;
      END IF;
      IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_satisfaction_surveys_staff') THEN
        DROP INDEX idx_satisfaction_surveys_staff;
      END IF;
      ALTER TABLE satisfaction_surveys RENAME COLUMN staff_id TO person_id;
      ALTER TABLE satisfaction_surveys ADD CONSTRAINT satisfaction_surveys_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL;
      CREATE INDEX idx_satisfaction_surveys_person ON satisfaction_surveys(person_id);
    END IF;
  END $$`,
  // Email queue for async sending
  `CREATE TABLE IF NOT EXISTS email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    to_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    html_body TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP WITH TIME ZONE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status)`,
  // Unique organization name (case-insensitive) — remove duplicates first
  `DELETE FROM organizations WHERE id NOT IN (SELECT DISTINCT ON (LOWER(name)) id FROM organizations ORDER BY LOWER(name), created_at ASC)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_organizations_name ON organizations(LOWER(name))`,
  // Health monitoring tables for people
  `CREATE TABLE IF NOT EXISTS health_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    observation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    category VARCHAR(50) NOT NULL DEFAULT 'general' CHECK (category IN ('general','skin','medication','sleep','pain','weight','other')),
    notes TEXT,
    severity VARCHAR(20) DEFAULT 'normal' CHECK (severity IN ('normal','mild','moderate','severe')),
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_health_obs_person ON health_observations(person_id)`,
  `CREATE INDEX IF NOT EXISTS idx_health_obs_date ON health_observations(person_id, observation_date)`,
  `CREATE TABLE IF NOT EXISTS bowel_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
    recorded_time TIME,
    bristol_type INTEGER CHECK (bristol_type BETWEEN 1 AND 7),
    color VARCHAR(50),
    frequency INT DEFAULT 1,
    consistency VARCHAR(50),
    notes TEXT,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_bowel_person ON bowel_movements(person_id)`,
  `CREATE INDEX IF NOT EXISTS idx_bowel_date ON bowel_movements(person_id, recorded_date)`,
  `CREATE TABLE IF NOT EXISTS dental_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    checkup_date DATE NOT NULL,
    dentist_name VARCHAR(255),
    findings TEXT,
    actions_taken TEXT,
    next_checkup_date DATE,
    notes TEXT,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_dental_person ON dental_records(person_id)`,
  `CREATE TABLE IF NOT EXISTS fluid_intake (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
    recorded_time TIME,
    amount_ml INTEGER NOT NULL,
    fluid_type VARCHAR(100),
    notes TEXT,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_fluid_person ON fluid_intake(person_id)`,
  `CREATE INDEX IF NOT EXISTS idx_fluid_date ON fluid_intake(person_id, recorded_date)`,
  // Appointments table
  `CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    person_id UUID REFERENCES people(id) ON DELETE SET NULL,
    staff_id UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled','no_show')),
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_appointments_org ON appointments(organization_id)`,
  `CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(organization_id, start_time)`,
  // Policies table
  `CREATE TABLE IF NOT EXISTS policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    version VARCHAR(10) DEFAULT '1.0',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','archived','draft')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_policies_org ON policies(organization_id)`,
  `CREATE INDEX IF NOT EXISTS idx_policies_category ON policies(organization_id, category)`,
  // Add updated_by to policies
  `ALTER TABLE policies ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL`,
  `ALTER TABLE incidents ADD COLUMN IF NOT EXISTS root_cause TEXT`,
  // Investigation fields for incidents
  `ALTER TABLE incidents ADD COLUMN IF NOT EXISTS investigation_notes TEXT`,
  `ALTER TABLE incidents ADD COLUMN IF NOT EXISTS actions_taken TEXT DEFAULT '[]'`,
  // Status field for incident_actions
  `ALTER TABLE incident_actions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','cancelled'))`,
  // Shift-start notification tracking
  `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS start_notification_sent_at TIMESTAMP WITH TIME ZONE`,
  // Person Goals table
  `CREATE TABLE IF NOT EXISTS person_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    target_date DATE,
    review_date DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','completed','cancelled','on_hold')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    cqc_domain VARCHAR(50),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_person_goals_org ON person_goals(organization_id)`,
  `CREATE INDEX IF NOT EXISTS idx_person_goals_person ON person_goals(person_id)`,
  // eMAR tables
  `CREATE TABLE IF NOT EXISTS emedication_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_emedr_org ON emedication_records(organization_id)`,
  `CREATE INDEX IF NOT EXISTS idx_emedr_person ON emedication_records(person_id)`,
  `CREATE TABLE IF NOT EXISTS emedication_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    emedication_record_id UUID NOT NULL REFERENCES emedication_records(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100) NOT NULL,
    unit VARCHAR(50) NOT NULL DEFAULT 'mg',
    route VARCHAR(50) NOT NULL DEFAULT 'oral',
    frequency VARCHAR(50) NOT NULL,
    times JSONB DEFAULT '[]',
    instructions TEXT,
    is_prn BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_emed_item_record ON emedication_items(emedication_record_id)`,
  `CREATE TABLE IF NOT EXISTS emedication_administrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    emedication_item_id UUID NOT NULL REFERENCES emedication_items(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
    scheduled_time TIMESTAMPTZ NOT NULL,
    administered_time TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('given', 'refused', 'missed', 'not_available', 'n/a', 'pending')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_emed_admin_item ON emedication_administrations(emedication_item_id)`,
  `CREATE INDEX IF NOT EXISTS idx_emed_admin_staff ON emedication_administrations(staff_id)`,
  `CREATE INDEX IF NOT EXISTS idx_emed_admin_scheduled ON emedication_administrations(scheduled_time)`,
  `ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS medication_competent BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE emedication_administrations ADD COLUMN IF NOT EXISTS prn_reason TEXT`,
  `ALTER TABLE emedication_administrations ADD COLUMN IF NOT EXISTS prn_effectiveness VARCHAR(20) DEFAULT 'unknown' CHECK (prn_effectiveness IN ('effective','partial','ineffective','unknown'))`,
  `ALTER TABLE emedication_administrations ADD COLUMN IF NOT EXISTS wastage_amount VARCHAR(50)`,
  `ALTER TABLE emedication_administrations ADD COLUMN IF NOT EXISTS wastage_reason TEXT`,
  `ALTER TABLE emedication_administrations ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100)`,
  `ALTER TABLE emedication_administrations ADD COLUMN IF NOT EXISTS expiry_date DATE`,
  `CREATE TABLE IF NOT EXISTS emedication_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    changes JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_emed_audit_org ON emedication_audit_log(organization_id)`,
  `CREATE INDEX IF NOT EXISTS idx_emed_audit_entity ON emedication_audit_log(entity_type, entity_id)`,
  `CREATE TABLE IF NOT EXISTS emedication_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    medication_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100), unit VARCHAR(50),
    batch_number VARCHAR(100), expiry_date DATE,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
    quantity_unit VARCHAR(50) DEFAULT 'tablet(s)',
    reorder_level DECIMAL(10,2) DEFAULT 10,
    location VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_emed_stock_org ON emedication_stock(organization_id)`,
  `CREATE TABLE IF NOT EXISTS emedication_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    supplier VARCHAR(255), delivery_note VARCHAR(255),
    delivery_date DATE NOT NULL,
    received_by VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS emedication_delivery_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID NOT NULL REFERENCES emedication_deliveries(id) ON DELETE CASCADE,
    stock_id UUID REFERENCES emedication_stock(id) ON DELETE SET NULL,
    medication_name VARCHAR(255) NOT NULL, dosage VARCHAR(100), unit VARCHAR(50),
    batch_number VARCHAR(100), expiry_date DATE,
    quantity DECIMAL(10,2) NOT NULL, quantity_unit VARCHAR(50) DEFAULT 'tablet(s)',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `ALTER TABLE person_goals ADD COLUMN IF NOT EXISTS frequency VARCHAR(20) DEFAULT 'one_time' CHECK (frequency IN ('daily','weekly','monthly','quarterly','one_time'))`,
  `ALTER TABLE person_goals ADD COLUMN IF NOT EXISTS goal_category VARCHAR(50)`,
  // Care Assessments
  `CREATE TABLE IF NOT EXISTS care_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    assessment_type VARCHAR(50) NOT NULL,
    assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    assessor_name VARCHAR(255),
    findings TEXT,
    recommendations TEXT,
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('draft','completed','reviewed')),
    next_review_date DATE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_care_assessments_su ON care_assessments(person_id)`,
  `CREATE INDEX IF NOT EXISTS idx_care_assessments_org ON care_assessments(organization_id)`,
  `ALTER TABLE care_assessments ADD COLUMN IF NOT EXISTS file_url VARCHAR(500)`,
  `ALTER TABLE care_assessments ADD COLUMN IF NOT EXISTS file_name VARCHAR(255)`,
  // Person extended details
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS pharmacy_name TEXT`,
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS pharmacy_phone TEXT`,
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS pharmacy_address TEXT`,
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS social_worker_name TEXT`,
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS social_worker_phone TEXT`,
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS social_worker_email TEXT`,
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS gp_email TEXT`,
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS gp_address TEXT`,
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS photo_url VARCHAR(500)`,
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS gender VARCHAR(20)`,
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS pronouns VARCHAR(50)`,
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS marital_status VARCHAR(30)`,
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS religion VARCHAR(100)`,
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS communication_language VARCHAR(100)`,
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS communication_interpreter BOOLEAN DEFAULT false`,
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS communication_method VARCHAR(50)`,
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS admission_date DATE`,
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS admission_source VARCHAR(100)`,
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS funding_type VARCHAR(30)`,
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS funding_details TEXT`,
  // Body Map
  `CREATE TABLE IF NOT EXISTS body_map_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    body_view VARCHAR(10) NOT NULL CHECK (body_view IN ('front', 'back')),
    body_zone VARCHAR(50) NOT NULL,
    zone_x FLOAT,
    zone_y FLOAT,
    condition_type VARCHAR(50) NOT NULL CHECK (condition_type IN ('bruise','wound','rash','injection','burn','pressure_sore','scar','swelling','skin_tear','other')),
    description TEXT,
    severity VARCHAR(20) DEFAULT 'mild' CHECK (severity IN ('mild','moderate','severe')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','healing','resolved')),
    recorded_date DATE DEFAULT CURRENT_DATE,
    resolved_date DATE,
    image_url TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_body_map_person ON body_map_entries(person_id)`,
  `CREATE INDEX IF NOT EXISTS idx_body_map_status ON body_map_entries(person_id, status)`,
  // Memory Book
  `CREATE TABLE IF NOT EXISTS memory_book_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    recorded_date DATE DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_memory_book_person ON memory_book_entries(person_id)`,
  `CREATE INDEX IF NOT EXISTS idx_memory_book_date ON memory_book_entries(person_id, recorded_date)`,
  // Evidence Mappings (configurable KLOE domain assignments)
  `CREATE TABLE IF NOT EXISTS evidence_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('training','documents','competency','care_plans','incidents','satisfaction')),
    source_category VARCHAR(100),
    target_domain VARCHAR(20) NOT NULL CHECK (target_domain IN ('safe','effective','caring','responsive','well-led')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_evidence_mappings_unique ON evidence_mappings(organization_id, source_type, COALESCE(source_category, ''))`,
  // eMAR: link stock to person
  `ALTER TABLE emedication_stock ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES people(id) ON DELETE SET NULL`,
  // eMAR: item period dates and stock linkage
  `ALTER TABLE emedication_items ADD COLUMN IF NOT EXISTS start_date DATE`,
  `ALTER TABLE emedication_items ADD COLUMN IF NOT EXISTS end_date DATE`,
  `ALTER TABLE emedication_items ADD COLUMN IF NOT EXISTS stock_item_id UUID REFERENCES emedication_stock(id) ON DELETE SET NULL`,
  // eMAR: daily medication count checks
  `CREATE TABLE IF NOT EXISTS emedication_daily_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    count_date DATE NOT NULL,
    staff_name TEXT NOT NULL,
    matches_physical BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(person_id, count_date)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_emed_daily_counts_person ON emedication_daily_counts(person_id)`,
  // eMAR: stock adjustments for damaged/expired/lost/returned
  `CREATE TABLE IF NOT EXISTS emedication_stock_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    stock_item_id UUID NOT NULL REFERENCES emedication_stock(id) ON DELETE CASCADE,
    adjustment_type VARCHAR(20) NOT NULL CHECK (adjustment_type IN ('damaged','expired','lost','returned','other')),
    quantity_adjusted INTEGER NOT NULL,
    reason TEXT,
    adjusted_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_emed_adj_stock ON emedication_stock_adjustments(stock_item_id)`,
  // eMAR: stock archive status
  `ALTER TABLE emedication_stock ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived'))`,
  // eMAR: daily count per-medication items
  `CREATE TABLE IF NOT EXISTS emedication_daily_count_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_count_id UUID NOT NULL REFERENCES emedication_daily_counts(id) ON DELETE CASCADE,
    medication_item_id UUID NOT NULL REFERENCES emedication_items(id) ON DELETE CASCADE,
    medication_name VARCHAR(255) NOT NULL,
    expected_quantity INTEGER NOT NULL DEFAULT 0,
    actual_quantity INTEGER NOT NULL DEFAULT 0,
    reason_for_mismatch TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_emed_dci_count ON emedication_daily_count_items(daily_count_id)`,
  // eMAR: escalation flag on daily count items
  `ALTER TABLE emedication_daily_count_items ADD COLUMN IF NOT EXISTS escalate BOOLEAN DEFAULT FALSE`,
  // eMAR: controlled drug flag + prescriber info on items
  `ALTER TABLE emedication_items ADD COLUMN IF NOT EXISTS is_controlled_drug BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE emedication_items ADD COLUMN IF NOT EXISTS prescriber_name VARCHAR(255)`,
  `ALTER TABLE emedication_items ADD COLUMN IF NOT EXISTS prescriber_phone VARCHAR(50)`,
  `ALTER TABLE emedication_items ADD COLUMN IF NOT EXISTS prescription_ref VARCHAR(255)`,
  // eMAR: add omitted status to administration statuses
  `ALTER TABLE emedication_administrations DROP CONSTRAINT IF EXISTS emedication_administrations_status_check`,
  `ALTER TABLE emedication_administrations ADD CONSTRAINT emedication_administrations_status_check CHECK (status IN ('given', 'refused', 'missed', 'omitted', 'not_available', 'n/a', 'pending'))`,
  // eMAR: deliveries can be scoped to an individual's stock
  `ALTER TABLE emedication_deliveries ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES people(id) ON DELETE SET NULL`,
  `CREATE INDEX IF NOT EXISTS idx_emed_deliveries_person ON emedication_deliveries(person_id)`,
  // eMAR: org-level medication count convention (once a day / AM-PM / after each administration)
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS emedication_count_convention VARCHAR(20) DEFAULT 'end_of_day' CHECK (emedication_count_convention IN ('end_of_day', 'am_pm', 'after_each'))`,
  // eMAR: daily counts can record multiple sessions per day (e.g. AM + PM)
  `ALTER TABLE emedication_daily_counts ADD COLUMN IF NOT EXISTS count_session VARCHAR(50) DEFAULT 'end_of_day'`,
  `ALTER TABLE emedication_daily_counts DROP CONSTRAINT IF EXISTS emedication_daily_counts_person_id_count_date_key`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_emed_daily_counts_person_date_session ON emedication_daily_counts(person_id, count_date, count_session)`,
  // eMAR: record when a daily count was performed
  `ALTER TABLE emedication_daily_counts ADD COLUMN IF NOT EXISTS counted_at TIMESTAMPTZ`,
  // AI Integration: ai_config JSONB on organizations
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS ai_config JSONB DEFAULT '{"enabled":false,"provider":"openai","apiKey":"","model":"gpt-4o-mini","enabledFeatures":[]}'::jsonb`,
  // AI Integration: additional audit log columns (already created above)
  `ALTER TABLE ai_audit_logs ADD COLUMN IF NOT EXISTS prompt_key VARCHAR(100)`,
  `ALTER TABLE ai_audit_logs ADD COLUMN IF NOT EXISTS duration_ms INTEGER`,
  `ALTER TABLE ai_audit_logs ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT TRUE`,
  `ALTER TABLE ai_audit_logs ADD COLUMN IF NOT EXISTS error_message TEXT`,
  `ALTER TABLE ai_audit_logs ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL`,
  `ALTER TABLE ai_audit_logs ADD COLUMN IF NOT EXISTS request_data JSONB`,
  `ALTER TABLE ai_audit_logs ADD COLUMN IF NOT EXISTS response_summary TEXT`,
  `CREATE INDEX IF NOT EXISTS idx_ai_audit_org ON ai_audit_logs(organization_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_audit_created ON ai_audit_logs(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_audit_feature ON ai_audit_logs(feature)`,
  // Agencies table for agency shift management
  `CREATE TABLE IF NOT EXISTS agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    contact_phone VARCHAR(50),
    contact_email VARCHAR(255),
    address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_agencies_org ON agencies(organization_id)`,
  // Agency reference on shifts
  `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL`,
  `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS agency_cost DECIMAL(10,2)`,
  `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS agency_contact_name VARCHAR(255)`,
  `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS agency_contact_phone VARCHAR(50)`,
  `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS agency_sent_at TIMESTAMPTZ`,
  // Crown Jewels: pgcrypto extension for column-level PII encryption at rest
  `CREATE EXTENSION IF NOT EXISTS pgcrypto`,
  // Crown Jewels: audit log for person record access
  `CREATE TABLE IF NOT EXISTS person_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    accessed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL DEFAULT 'view',
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_person_access_user ON person_access_log(person_id)`,
  `CREATE INDEX IF NOT EXISTS idx_person_access_accessed_by ON person_access_log(accessed_by, created_at DESC)`,
  // Link shifts to a person
  `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES people(id) ON DELETE SET NULL`,
  `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS shift_type VARCHAR(20) DEFAULT 'day' NOT NULL`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shifts_shift_type_check') THEN ALTER TABLE shifts ADD CONSTRAINT shifts_shift_type_check CHECK (shift_type IN ('day', 'sleep', 'wake_night')); END IF; END $$`,
  `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS unclaimed_notified_at TIMESTAMP WITH TIME ZONE`,
  `ALTER TABLE locations ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES users(id) ON DELETE SET NULL`,
  `CREATE TABLE IF NOT EXISTS shift_swaps (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), shift_id UUID REFERENCES shifts(id) ON DELETE CASCADE, from_staff_id UUID REFERENCES staff_profiles(id) ON DELETE CASCADE, to_staff_id UUID REFERENCES staff_profiles(id) ON DELETE CASCADE, to_shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL, status VARCHAR(20) DEFAULT 'pending', reason TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, responded_at TIMESTAMP WITH TIME ZONE)`,
`ALTER TABLE shift_swaps ADD COLUMN IF NOT EXISTS to_shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL`,
  `CREATE INDEX IF NOT EXISTS idx_shifts_person ON shifts(person_id)`,
  `CREATE INDEX IF NOT EXISTS idx_shifts_end_time ON shifts(end_time)`,
  `CREATE INDEX IF NOT EXISTS idx_shifts_range ON shifts(location_id, start_time, end_time)`,
  `CREATE TABLE IF NOT EXISTS delegation_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delegation_id UUID NOT NULL REFERENCES manager_delegations(id) ON DELETE CASCADE,
    delegate_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    primary_manager_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_del_audit_delegation ON delegation_audit_logs(delegation_id)`,
  `CREATE INDEX IF NOT EXISTS idx_del_audit_primary ON delegation_audit_logs(primary_manager_id)`,
  // Location ID for invitations
  `ALTER TABLE invitations ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL`,
  // Add-ons for billing
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS addons JSONB DEFAULT '[]'`,
  // Agency module — status + contract dates
  `ALTER TABLE agencies ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'`,
  `ALTER TABLE agencies ADD COLUMN IF NOT EXISTS contract_start_date DATE`,
  `ALTER TABLE agencies ADD COLUMN IF NOT EXISTS contract_end_date DATE`,
  // Agency workers
  `CREATE TABLE IF NOT EXISTS agency_workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    role VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(255),
    dbs_check_date DATE,
    dbs_expiry_date DATE,
    mandatory_training_completed BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'active',
    rating DECIMAL(2,1),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_agency_workers_agency ON agency_workers(agency_id)`,
  `CREATE INDEX IF NOT EXISTS idx_agency_workers_org ON agency_workers(organization_id)`,
  // Agency rates per shift type
  `CREATE TABLE IF NOT EXISTS agency_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    shift_type VARCHAR(20) NOT NULL DEFAULT 'day',
    rate_per_hour DECIMAL(10,2) NOT NULL,
    effective_from DATE DEFAULT CURRENT_DATE,
    effective_to DATE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_agency_rates_agency ON agency_rates(agency_id)`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agency_rates_shift_type_check') THEN ALTER TABLE agency_rates ADD CONSTRAINT agency_rates_shift_type_check CHECK (shift_type IN ('day', 'sleep', 'wake_night')); END IF; END $$`,
  // Agency shift tracking columns
  `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS agency_worker_id UUID REFERENCES agency_workers(id) ON DELETE SET NULL`,
  `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS agency_check_in TIMESTAMPTZ`,
  `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS agency_check_out TIMESTAMPTZ`,
  `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS agency_status VARCHAR(20) DEFAULT 'sent'`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shifts_agency_status_check') THEN ALTER TABLE shifts ADD CONSTRAINT shifts_agency_status_check CHECK (agency_status IN ('sent', 'accepted', 'declined', 'cancelled', 'completed')); END IF; END $$`,
  // Agency coverage tracking & default hourly rate
  `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS agency_covered BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_hourly_rate DECIMAL(10,2) DEFAULT 12.00`,
  // DBS auto-renewal flow columns
  `ALTER TABLE documents ADD COLUMN IF NOT EXISTS renewal_status VARCHAR(20) DEFAULT NULL`,
  `ALTER TABLE documents ADD COLUMN IF NOT EXISTS replaced_by UUID REFERENCES documents(id) ON DELETE SET NULL`,
  // Competency observation scoring rubric
  `ALTER TABLE competency_templates ADD COLUMN IF NOT EXISTS rubric_definition JSONB DEFAULT '[]'`,
  `ALTER TABLE competency_assessments ADD COLUMN IF NOT EXISTS score INTEGER`,
  `ALTER TABLE competency_assessments ADD COLUMN IF NOT EXISTS max_score INTEGER`,
  `ALTER TABLE competency_assessments ADD COLUMN IF NOT EXISTS rubric_responses JSONB DEFAULT '[]'`,
  // NHS DSPT certification
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS dspt_status VARCHAR(20) DEFAULT 'not_started'`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'dspt_assessments') THEN
    CREATE TABLE dspt_assessments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      assessment_year VARCHAR(9) NOT NULL DEFAULT '2025-26',
      status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','standards_met','standards_exceeded')),
      submitted_at TIMESTAMP WITH TIME ZONE,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_dspt_assessments_org ON dspt_assessments(organization_id);
    CREATE TRIGGER trg_dspt_assessments_updated BEFORE UPDATE ON dspt_assessments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF; END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'dspt_standard_status') THEN
    CREATE TABLE dspt_standard_status (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assessment_id UUID NOT NULL REFERENCES dspt_assessments(id) ON DELETE CASCADE,
      standard_key VARCHAR(10) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'not_assessed' CHECK (status IN ('not_assessed','partially','met','exceeded')),
      evidence_notes TEXT,
      evidence_files JSONB DEFAULT '[]',
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(assessment_id, standard_key)
    );
    CREATE INDEX idx_dspt_standard_assessment ON dspt_standard_status(assessment_id);
  END IF; END $$`,
  // Shift-type minimum staffing levels per location
  `ALTER TABLE locations ADD COLUMN IF NOT EXISTS min_day_staff INTEGER DEFAULT 1`,
  `ALTER TABLE locations ADD COLUMN IF NOT EXISTS min_night_staff INTEGER DEFAULT 1`,
  `ALTER TABLE locations ADD COLUMN IF NOT EXISTS min_sleep_staff INTEGER DEFAULT 0`,
  // Visa/contract max hours restriction per staff member (can be lower than contracted_hours_weekly)
  `ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS max_hours_weekly DECIMAL(5,1)`,
  // Daily compliance digest for location managers
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS compliance_digest_enabled BOOLEAN DEFAULT false`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS predictive_alerts_enabled BOOLEAN DEFAULT true`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS auto_evidence_pack_enabled BOOLEAN DEFAULT false`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS auto_evidence_pack_frequency VARCHAR(20) DEFAULT 'monthly'`,
  // CQC Action Plan tracking
  `CREATE TABLE IF NOT EXISTS cqc_action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
    cqc_statement VARCHAR(10) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','cancelled')),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
    due_date DATE,
    assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cqc_actions_org ON cqc_action_items(organization_id)`,
  `CREATE INDEX IF NOT EXISTS idx_cqc_actions_status ON cqc_action_items(organization_id, status)`,
  // Competency: evidence upload support
  `ALTER TABLE competency_assessments ADD COLUMN IF NOT EXISTS evidence_url TEXT`,
  `ALTER TABLE competency_templates ADD COLUMN IF NOT EXISTS required_for_roles JSONB DEFAULT '[]'`,
  // Care plan enrichment — structured fields matching CQC expectations
  `ALTER TABLE care_plans ADD COLUMN IF NOT EXISTS mobility_level VARCHAR(50)`,
  `ALTER TABLE care_plans ADD COLUMN IF NOT EXISTS mobility_aids TEXT`,
  `ALTER TABLE care_plans ADD COLUMN IF NOT EXISTS communication_needs TEXT`,
  `ALTER TABLE care_plans ADD COLUMN IF NOT EXISTS capacity_status TEXT`,
  `ALTER TABLE care_plans ADD COLUMN IF NOT EXISTS sleep_pattern TEXT`,
  `ALTER TABLE care_plans ADD COLUMN IF NOT EXISTS emergency_info TEXT`,
  `ALTER TABLE care_plans ADD COLUMN IF NOT EXISTS personal_goals TEXT`,
  `ALTER TABLE care_plans ADD COLUMN IF NOT EXISTS likes_dislikes TEXT`,
  `ALTER TABLE care_plans ADD COLUMN IF NOT EXISTS cultural_needs TEXT`,
  `ALTER TABLE care_plans ADD COLUMN IF NOT EXISTS file_url TEXT`,
  // Notification preferences per user
  `CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('compliance','training','documents','leave','shift','swap','overtime','survey','delegation','general')),
    enabled BOOLEAN DEFAULT TRUE,
    UNIQUE(user_id, notification_type)
  )`,
  // Family portal access
  `CREATE TABLE IF NOT EXISTS family_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    relationship VARCHAR(100),
    phone VARCHAR(50),
    access_token UUID UNIQUE,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'invited' CHECK (status IN ('invited','active','revoked')),
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  // Person Alerts / Flags, DNACPR, Tags, Discharge
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS flags JSONB DEFAULT '[]'`,
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'`,
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS dnacpr_status VARCHAR(20)`,
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS dnacpr_date DATE`,
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS dnacpr_review_date DATE`,
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS dnacpr_details TEXT`,
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS advance_decision TEXT`,
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS advance_decision_date DATE`,
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS discharge_date DATE`,
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS discharge_reason TEXT`,
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS discharge_summary TEXT`,
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS discharge_destination VARCHAR(100)`,
  // Clinical Scores
  `CREATE TABLE IF NOT EXISTS clinical_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    score_type VARCHAR(20) NOT NULL CHECK (score_type IN ('waterlow','must','bmi')),
    score NUMERIC(6,2),
    risk_level VARCHAR(20),
    recorded_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_clinical_scores_person ON clinical_scores(person_id)`,
  // Person Documents
  `CREATE TABLE IF NOT EXISTS person_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    file_url TEXT NOT NULL,
    description TEXT,
    upload_date DATE DEFAULT CURRENT_DATE,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_person_documents_person ON person_documents(person_id)`,
  `ALTER TABLE care_plans ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1`,
  `CREATE TABLE IF NOT EXISTS person_wellbeing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    recorded_date DATE DEFAULT CURRENT_DATE,
    domain VARCHAR(50) NOT NULL CHECK (domain IN ('mood','engagement','sleep','appetite','pain','mobility','social','overall')),
    score INTEGER NOT NULL CHECK (score >= 1 AND score <= 10),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_wellbeing_person_date ON person_wellbeing(person_id, recorded_date)`,
  `CREATE TABLE IF NOT EXISTS person_communication_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    contact_name VARCHAR(255),
    relationship VARCHAR(100),
    contact_method VARCHAR(50) NOT NULL CHECK (contact_method IN ('phone','email','letter','visit','video_call','other')),
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound','outbound')),
    summary TEXT NOT NULL,
    follow_up_actions TEXT,
    recorded_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_commlog_person ON person_communication_log(person_id)`,
  `CREATE TABLE IF NOT EXISTS person_capacity_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    assessment_date DATE DEFAULT CURRENT_DATE,
    decision_to_be_made TEXT NOT NULL,
    capacity_found BOOLEAN,
    capacity_status VARCHAR(20) CHECK (capacity_status IN ('has_capacity','lacks_capacity','fluctuating','not_assessed')),
    best_interest_decision TEXT,
    best_interest_meeting_date DATE,
    independent_advocate VARCHAR(255),
    relevant_people_informed TEXT,
    review_date DATE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_capacity_person ON person_capacity_assessments(person_id)`,
  `CREATE TABLE IF NOT EXISTS person_care_pathways (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    pathway_type VARCHAR(50) NOT NULL CHECK (pathway_type IN ('hospital_admission','hospital_discharge','short_break','assessment_unit','transition','other')),
    title VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    location_name VARCHAR(255),
    referral_reason TEXT,
    discharge_notes TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_carepathways_person ON person_care_pathways(person_id)`,
  `ALTER TABLE person_care_pathways ADD COLUMN IF NOT EXISTS file_url VARCHAR(500)`,
  `ALTER TABLE person_care_pathways ADD COLUMN IF NOT EXISTS file_name VARCHAR(255)`,
  // Time away (leaves / discharges) — parent record for a titled period away from the care home
  `CREATE TABLE IF NOT EXISTS person_time_away (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    time_away_type VARCHAR(50) NOT NULL DEFAULT 'other' CHECK (time_away_type IN ('family_visit','short_break','hospital_admission','hospital_discharge','trial_leave','discharge','other')),
    destination VARCHAR(255),
    start_date DATE,
    end_date DATE,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_time_away_person ON person_time_away(person_id)`,
  // Items table is legacy-named person_discharge_checklist but serves time-away checklists
  `CREATE TABLE IF NOT EXISTS person_discharge_checklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    time_away_id UUID REFERENCES person_time_away(id) ON DELETE CASCADE,
    item VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('documentation','medication','equipment','notification','property','financial','other')),
    quantity NUMERIC(10,2),
    unit VARCHAR(50),
    is_complete BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_discharge_checklist_person ON person_discharge_checklist(person_id)`,
  `CREATE INDEX IF NOT EXISTS idx_discharge_checklist_time_away ON person_discharge_checklist(time_away_id)`,

  // Phase 2b: support_level for person onboarding, daily notes, memory book
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS support_level VARCHAR(50) DEFAULT NULL`,
  `ALTER TABLE daily_notes ADD COLUMN IF NOT EXISTS support_level VARCHAR(50) DEFAULT NULL`,
  `ALTER TABLE memory_book_entries ADD COLUMN IF NOT EXISTS support_level VARCHAR(50) DEFAULT NULL`,
  `ALTER TABLE memory_book_entries ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]'::jsonb`,

  // DBS API integration — dedicated table
  `CREATE TABLE IF NOT EXISTS dbs_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
    level VARCHAR(30) NOT NULL DEFAULT 'enhanced' CHECK (level IN ('standard','enhanced','enhanced_with_barred')),
    workforce VARCHAR(10) NOT NULL DEFAULT 'adult' CHECK (workforce IN ('adult','child','both')),
    status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','in_progress','awaiting_identity','clear','disclosure','cancelled','error')),
    application_reference VARCHAR(100),
    provider_reference VARCHAR(100),
    certificate_number VARCHAR(100),
    disclosure_date DATE,
    cost_pence INTEGER,
    notes TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_dbs_checks_org ON dbs_checks(organization_id)`,
  `CREATE INDEX IF NOT EXISTS idx_dbs_checks_staff ON dbs_checks(staff_id)`,
  // Expense tracking tables
  `CREATE TABLE IF NOT EXISTS person_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    category VARCHAR(30) NOT NULL CHECK (category IN ('food','clothing','activities','transport','personal','health','other')),
    amount_pence INTEGER NOT NULL CHECK (amount_pence > 0),
    description TEXT, receipt_url TEXT,
    incurred_date DATE NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_expenses_org ON person_expenses(organization_id)`,
  `CREATE INDEX IF NOT EXISTS idx_expenses_person ON person_expenses(person_id)`,
  `CREATE INDEX IF NOT EXISTS idx_expenses_date ON person_expenses(organization_id, incurred_date)`,
  `CREATE TABLE IF NOT EXISTS petty_cash_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    current_balance_pence INTEGER NOT NULL DEFAULT 0 CHECK (current_balance_pence >= 0),
    last_reconciled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(location_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pcb_org ON petty_cash_balances(organization_id)`,
  `CREATE TABLE IF NOT EXISTS petty_cash_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('top_up','reconciliation','adjustment')),
    amount_pence INTEGER NOT NULL,
    previous_balance_pence INTEGER NOT NULL,
    new_balance_pence INTEGER NOT NULL,
    notes TEXT,
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pct_org ON petty_cash_transactions(organization_id)`,
  `CREATE INDEX IF NOT EXISTS idx_pct_location ON petty_cash_transactions(location_id)`,
  // Billing: card fingerprint for duplicate detection
  `ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS stripe_fingerprint TEXT`,
  // Billing: payment failure tracking
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS failed_payment_count INTEGER DEFAULT 0`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS last_payment_failed_at TIMESTAMP WITH TIME ZONE`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS first_payment_failed_at TIMESTAMP WITH TIME ZONE`,
  `CREATE INDEX IF NOT EXISTS idx_pm_fingerprint ON payment_methods(organization_id, stripe_fingerprint)`,
  // Email verification codes for signup flow
  `CREATE TABLE IF NOT EXISTS email_verification_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_evc_email ON email_verification_codes(email)`,

  // ═══════════════════════════════════════════════════
  // OUTCOME MANAGEMENT SYSTEM
  // ═══════════════════════════════════════════════════

  // Goal Milestones
  `CREATE TABLE IF NOT EXISTS goal_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID NOT NULL REFERENCES person_goals(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_goal_milestones_goal ON goal_milestones(goal_id)`,

  // Goal Progress History (immutable log)
  `CREATE TABLE IF NOT EXISTS goal_progress_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID NOT NULL REFERENCES person_goals(id) ON DELETE CASCADE,
    progress INTEGER NOT NULL CHECK (progress >= 0 AND progress <= 100),
    notes TEXT,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    recorded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_goal_progress_goal ON goal_progress_history(goal_id)`,
  `CREATE INDEX IF NOT EXISTS idx_goal_progress_date ON goal_progress_history(recorded_at)`,

  // Goal columns: care_plan link, baseline, target, unit
  `ALTER TABLE person_goals ADD COLUMN IF NOT EXISTS care_plan_id UUID REFERENCES care_plans(id) ON DELETE SET NULL`,
  `ALTER TABLE person_goals ADD COLUMN IF NOT EXISTS baseline_value NUMERIC`,
  `ALTER TABLE person_goals ADD COLUMN IF NOT EXISTS target_value NUMERIC`,
  `ALTER TABLE person_goals ADD COLUMN IF NOT EXISTS value_unit VARCHAR(50)`,

  // Daily notes: link to goals
  `ALTER TABLE daily_notes ADD COLUMN IF NOT EXISTS linked_goal_id UUID REFERENCES person_goals(id) ON DELETE SET NULL`,

  // Outcome Scale Templates
  `CREATE TABLE IF NOT EXISTS outcome_scales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    shortcode VARCHAR(20) NOT NULL,
    description TEXT,
    min_score NUMERIC NOT NULL DEFAULT 0,
    max_score NUMERIC NOT NULL DEFAULT 100,
    questions JSONB NOT NULL DEFAULT '[]',
    score_bands JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, shortcode)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_outcome_scales_org ON outcome_scales(organization_id)`,

  // Outcome Scale Results (individual assessments)
  `CREATE TABLE IF NOT EXISTS outcome_scale_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scale_id UUID NOT NULL REFERENCES outcome_scales(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    scores JSONB NOT NULL DEFAULT '{}',
    total_score NUMERIC NOT NULL,
    band_label VARCHAR(100),
    assessed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    assessed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_outcome_results_scale ON outcome_scale_results(scale_id)`,
  `CREATE INDEX IF NOT EXISTS idx_outcome_results_person ON outcome_scale_results(person_id)`,
  `CREATE INDEX IF NOT EXISTS idx_outcome_results_date ON outcome_scale_results(assessed_at)`,

  // Evidence mappings: expand source_type to include goals/wellbeing/outcomes
  `DO $$ BEGIN
    ALTER TABLE evidence_mappings DROP CONSTRAINT IF EXISTS evidence_mappings_source_type_check;
  EXCEPTION WHEN undefined_object THEN null; END $$`,
  `DO $$ BEGIN
    ALTER TABLE evidence_mappings ADD CONSTRAINT evidence_mappings_source_type_check
      CHECK (source_type IN ('training','documents','competency','care_plans','incidents','satisfaction','goals','wellbeing','outcomes'));
  EXCEPTION WHEN undefined_object THEN null; END $$`,

  // Clinical scores: expand score_type to include standardized scales
  `DO $$ BEGIN
    ALTER TABLE clinical_scores DROP CONSTRAINT IF EXISTS clinical_scores_score_type_check;
  EXCEPTION WHEN undefined_object THEN null; END $$`,
  `ALTER TABLE clinical_scores ADD CONSTRAINT clinical_scores_score_type_check
    CHECK (score_type IN ('waterlow','must','bmi','wemwbs','phq9','gad7','eq5d','outcome_star'))`,
  // Daily notes: add generated_by_ai flag
  `ALTER TABLE daily_notes ADD COLUMN IF NOT EXISTS generated_by_ai BOOLEAN NOT NULL DEFAULT FALSE`,
  // Daily notes: add AI analysis metadata columns
  `ALTER TABLE daily_notes ADD COLUMN IF NOT EXISTS ai_mood_analysis JSONB`,
  `ALTER TABLE daily_notes ADD COLUMN IF NOT EXISTS ai_safeguarding_flags JSONB`,
  `ALTER TABLE daily_notes ADD COLUMN IF NOT EXISTS ai_care_plan_updates JSONB`,
  `ALTER TABLE daily_notes ADD COLUMN IF NOT EXISTS ai_interventions JSONB`,
  `ALTER TABLE daily_notes ADD COLUMN IF NOT EXISTS ai_risk_level VARCHAR(20)`,
  `ALTER TABLE daily_notes ADD COLUMN IF NOT EXISTS ai_follow_up_required BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE daily_notes ADD COLUMN IF NOT EXISTS ai_follow_up_details TEXT`,
  ],
};

async function isFreshDatabase(): Promise<boolean> {
  try {
    const result = await query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_migrations') AS exists`);
    return !result.rows[0].exists;
  } catch {
    // If the query itself fails, assume fresh (table might not exist)
    return true;
  }
}

export const setupDatabase = async () => {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Check if the DB has been initialized before (fresh vs upgrade)
    const freshDb = await isFreshDatabase();

    // Execute full schema only on a fresh database
    // On existing databases, migrations handle all schema changes
    if (freshDb) {
      await query(schema);
      logger.info('Database schema setup completed.');
    } else {
      logger.info('Existing database detected — skipping schema.sql, migrations handle changes.');
    }

    // Run versioned migrations (tracks applied ones in _migrations table)
    await runMigrations([INITIAL_MIGRATION, RLS_MIGRATION, MIGRATION_003, APP_ROLE_MIGRATION, MIGRATION_005, MIGRATION_006, MIGRATION_007, MIGRATION_008, MIGRATION_009, MIGRATION_010, MIGRATION_011, MIGRATION_012, MIGRATION_013, MIGRATION_014, MIGRATION_015, MIGRATION_016, MIGRATION_017, MIGRATION_018,            MIGRATION_019, MIGRATION_020, MIGRATION_021, MIGRATION_022, MIGRATION_023, MIGRATION_024, MIGRATION_025,
           MIGRATION_026, MIGRATION_027, MIGRATION_028]);
    logger.info('Migrations completed.');

    // Ensure meticle_app role has correct password (init script only runs on first DB init)
    const appRolePassword = process.env.APP_ROLE_PASSWORD;
    if (appRolePassword) {
      // ALTER ROLE doesn't support parameterized queries in pg — escape single quotes
      const escaped = appRolePassword.replace(/'/g, "''");
      await query(`ALTER ROLE meticle_app WITH PASSWORD '${escaped}'`);
      logger.info('App role password updated.');
    }

    // Auto-seed standard outcome scales for orgs that have none
    try {
      const orgsRes = await query(`SELECT id FROM organizations`);
      const standardScales = [
        { name: 'Warwick-Edinburgh Mental Wellbeing Scale', shortcode: 'WEMWBS', desc: '14-item scale measuring positive mental wellbeing', min: 14, max: 70, bands: '[{"min":14,"max":27,"label":"Low Wellbeing","color":"#DC2626"},{"min":28,"max":41,"label":"Below Average","color":"#D97706"},{"min":42,"max":56,"label":"Average","color":"0F4C81"},{"min":57,"max":70,"label":"High Wellbeing","color":"#16A34A"}]' },
        { name: 'Patient Health Questionnaire', shortcode: 'PHQ-9', desc: '9-item depression screening and severity measure', min: 0, max: 27, bands: '[{"min":0,"max":4,"label":"Minimal Depression","color":"#16A34A"},{"min":5,"max":9,"label":"Mild Depression","color":"#D97706"},{"min":10,"max":14,"label":"Moderate Depression","color":"#EA580C"},{"min":15,"max":19,"label":"Moderately Severe","color":"#DC2626"},{"min":20,"max":27,"label":"Severe Depression","color":"#991B1B"}]' },
        { name: 'Generalised Anxiety Disorder Scale', shortcode: 'GAD-7', desc: '7-item anxiety screening and severity measure', min: 0, max: 21, bands: '[{"min":0,"max":4,"label":"Minimal Anxiety","color":"#16A34A"},{"min":5,"max":9,"label":"Mild Anxiety","color":"#D97706"},{"min":10,"max":14,"label":"Moderate Anxiety","color":"#EA580C"},{"min":15,"max":21,"label":"Severe Anxiety","color":"#DC2626"}]' },
        { name: 'EQ-5D-5L', shortcode: 'EQ5D', desc: '5-dimensional quality of life measure', min: 0, max: 100, bands: '[{"min":0,"max":25,"label":"Severe Problems","color":"#DC2626"},{"min":26,"max":50,"label":"Moderate Problems","color":"#D97706"},{"min":51,"max":75,"label":"Mild Problems","color":"#0F4C81"},{"min":76,"max":100,"label":"No Problems","color":"#16A34A"}]' },
        { name: 'Outcome Star', shortcode: 'OSTAR', desc: '5-domain personal outcome measure', min: 0, max: 50, bands: '[{"min":0,"max":10,"label":"Low Outcome","color":"#DC2626"},{"min":11,"max":25,"label":"Developing","color":"#D97706"},{"min":26,"max":40,"label":"Good Outcome","color":"#0F4C81"},{"min":41,"max":50,"label":"Excellent Outcome","color":"#16A34A"}]' },
      ];
      for (const org of orgsRes.rows) {
        const existing = await query(`SELECT COUNT(*)::int AS cnt FROM outcome_scales WHERE organization_id = $1`, [org.id]);
        if (existing.rows[0].cnt > 0) continue;
        for (const s of standardScales) {
          await query(
            `INSERT INTO outcome_scales (organization_id, name, shortcode, description, min_score, max_score, score_bands) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
            [org.id, s.name, s.shortcode, s.desc, s.min, s.max, s.bands]
          );
        }
      }
      logger.info('Standard outcome scales seeded.');
    } catch {
      // silent — table may not exist yet on fresh DB
    }
  } catch (error) {
    logger.error(error, 'Error setting up database schema');
    throw error;
  }
};

// Standalone execution for deploy workflow: `node dist/shared/database/setup.js`
if (require.main === module) {
  setupDatabase()
    .then(() => {
      logger.info('setup-db complete — exiting');
      process.exit(0);
    })
    .catch((err) => {
      logger.error(err, 'setup-db failed');
      process.exit(1);
    });
}
