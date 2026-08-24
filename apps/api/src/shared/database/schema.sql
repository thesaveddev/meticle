-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    plan VARCHAR(50) DEFAULT 'starter',
    subscription_status VARCHAR(50) DEFAULT 'trial',
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    onboarding_step INTEGER DEFAULT 0,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    minimum_compliance_percent INTEGER DEFAULT 100,
    overtime_requires_approval BOOLEAN DEFAULT TRUE,
    force_mfa BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'CARE_WORKER', 'COMPLIANCE_OFFICER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'active',
    email_verified BOOLEAN DEFAULT FALSE,
    force_password_reset BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Locations
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    minimum_staff_per_day INTEGER DEFAULT 1,
    manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Departments
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Staff Profiles
CREATE TABLE IF NOT EXISTS staff_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    employment_status VARCHAR(50),
    birth_date DATE,
    profile_picture_url TEXT,
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    compliance_profile_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Qualifications
CREATE TABLE IF NOT EXISTS qualifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID REFERENCES staff_profiles(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    issue_date DATE,
    expiry_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Skills
CREATE TABLE IF NOT EXISTS skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID REFERENCES staff_profiles(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Emergency Contacts
CREATE TABLE IF NOT EXISTS emergency_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID REFERENCES staff_profiles(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    relationship VARCHAR(100),
    phone VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Staff Availability
CREATE TABLE IF NOT EXISTS staff_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID REFERENCES staff_profiles(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL, -- 0-6
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID REFERENCES staff_profiles(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL, -- 'DBS', 'PASSPORT', 'VISA', 'RIGHT_TO_WORK', etc.
    url TEXT NOT NULL,
    expiry_date DATE,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Compliance Requirements
CREATE TABLE IF NOT EXISTS compliance_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_mandatory BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Compliance Configuration
CREATE TABLE IF NOT EXISTS compliance_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'document',
    is_mandatory BOOLEAN DEFAULT TRUE,
    days_warning INTEGER DEFAULT 30,
    days_overdue INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Compliance Records
CREATE TABLE IF NOT EXISTS compliance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID REFERENCES staff_profiles(id) ON DELETE CASCADE,
    requirement_id UUID REFERENCES compliance_config(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'incomplete', -- 'complete', 'incomplete', 'expired', 'pending_review'
    issued_at DATE,
    expires_at DATE,
    notes TEXT,
    file_url TEXT,
    last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Shifts
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'open', -- 'open', 'filled', 'completed', 'cancelled'
    published_at TIMESTAMP WITH TIME ZONE,
    start_notification_sent_at TIMESTAMP WITH TIME ZONE,
    unclaimed_notified_at TIMESTAMP WITH TIME ZONE,
    person_id UUID,
    shift_type VARCHAR(20) DEFAULT 'day' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_shift_type_check;
ALTER TABLE shifts ADD CONSTRAINT shifts_shift_type_check CHECK (shift_type IN ('day', 'sleep', 'wake_night'));

-- Shift Assignments
CREATE TABLE IF NOT EXISTS shift_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID REFERENCES shifts(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES staff_profiles(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'assigned', -- 'assigned', 'accepted', 'rejected'
    is_overtime BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Shift Swaps
CREATE TABLE IF NOT EXISTS shift_swaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID REFERENCES shifts(id) ON DELETE CASCADE,
    from_staff_id UUID REFERENCES staff_profiles(id) ON DELETE CASCADE,
    to_staff_id UUID REFERENCES staff_profiles(id) ON DELETE CASCADE,
    to_shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'pending',
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP WITH TIME ZONE
);

-- Shift Templates
CREATE TABLE IF NOT EXISTS shift_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Verification Tokens
CREATE TABLE IF NOT EXISTS verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    type TEXT NOT NULL, -- 'email_verification', 'password_reset'
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Staff Invitations
CREATE TABLE IF NOT EXISTS invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'expired'
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Carer Preferences
CREATE TABLE IF NOT EXISTS carer_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    availability JSONB DEFAULT '[]', -- JSON array of shifts
    preferred_locations TEXT[],
    min_pay_rate DECIMAL(10, 2),
    max_travel_distance INTEGER, -- in miles
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'info',
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User Permissions (granular module-level permissions)
CREATE TABLE IF NOT EXISTS user_permissions (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module VARCHAR(50) NOT NULL,
    permission_level VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (permission_level IN ('none', 'view', 'edit')),
    PRIMARY KEY (user_id, module)
);

-- Leave Types
CREATE TABLE IF NOT EXISTS leave_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#0F4C81',
    days_allowed DECIMAL(5,1) DEFAULT 0,
    hours_allowed DECIMAL(6,1) DEFAULT 0,
    duration_type VARCHAR(10) NOT NULL DEFAULT 'days' CHECK (duration_type IN ('days', 'hours')),
    is_paid BOOLEAN NOT NULL DEFAULT TRUE,
    requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (organization_id, name)
);

-- Leave Requests
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    hours_requested DECIMAL(5,1),
    duration_type VARCHAR(10) NOT NULL DEFAULT 'days' CHECK (duration_type IN ('days', 'hours')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    reason TEXT,
    notes TEXT,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Leave Balances
CREATE TABLE IF NOT EXISTS leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    days_allocated DECIMAL(5,1) NOT NULL DEFAULT 0,
    days_taken DECIMAL(5,1) NOT NULL DEFAULT 0,
    hours_allocated DECIMAL(6,1) NOT NULL DEFAULT 0,
    hours_taken DECIMAL(6,1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (staff_id, leave_type_id, year)
);

-- Manager Delegations
CREATE TABLE IF NOT EXISTS manager_delegations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    primary_manager_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delegate_manager_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    starts_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ends_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS delegation_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delegation_id UUID NOT NULL REFERENCES manager_delegations(id) ON DELETE CASCADE,
    delegate_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    primary_manager_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_del_audit_delegation ON delegation_audit_logs(delegation_id);
CREATE INDEX IF NOT EXISTS idx_del_audit_primary ON delegation_audit_logs(primary_manager_id);

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Staff on-leave tracking view (materialized via trigger)
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS is_on_leave BOOLEAN DEFAULT FALSE;
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS on_leave_until DATE;

-- Password History (prevent password reuse)
CREATE TABLE IF NOT EXISTS password_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Compliance Profiles
CREATE TABLE IF NOT EXISTS compliance_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    role_name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, name)
);

CREATE TABLE IF NOT EXISTS compliance_profile_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES compliance_profiles(id) ON DELETE CASCADE,
    requirement_id UUID NOT NULL REFERENCES compliance_config(id) ON DELETE CASCADE,
    UNIQUE(profile_id, requirement_id)
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) NOT NULL,
    description TEXT,
    amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'GBP',
    status VARCHAR(20) DEFAULT 'upcoming',
    issued_at DATE,
    due_at DATE,
    paid_at TIMESTAMP WITH TIME ZONE,
    stripe_invoice_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, invoice_number)
);

-- Payment Methods
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    card_last_four VARCHAR(4),
    card_brand VARCHAR(20),
    cardholder_name VARCHAR(255),
    expiry_month INTEGER,
    expiry_year INTEGER,
    is_default BOOLEAN DEFAULT FALSE,
    stripe_payment_method_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Auto-update function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Organization Settings
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS leave_start_month INTEGER DEFAULT 1;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS leave_calculation_type VARCHAR(20) DEFAULT 'proportional';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_hours_per_leave_day DECIMAL(5,1) DEFAULT 7.5;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS base_leave_hours DECIMAL(6,1) DEFAULT 240;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS base_contracted_hours DECIMAL(5,1) DEFAULT 40;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add missing updated_at columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'starter';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'trial';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS employment_type VARCHAR(20) DEFAULT 'full_time';
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS contracted_hours_weekly DECIMAL(5,1) DEFAULT 37.5;
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE emergency_contacts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE staff_availability ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE compliance_requirements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE compliance_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE shift_assignments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE shift_templates ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE shift_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE compliance_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Triggers for auto-updating updated_at
DO $$ BEGIN
    CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TRIGGER trg_organizations_updated BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TRIGGER trg_locations_updated BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TRIGGER trg_departments_updated BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TRIGGER trg_staff_profiles_updated BEFORE UPDATE ON staff_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TRIGGER trg_qualifications_updated BEFORE UPDATE ON qualifications FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TRIGGER trg_skills_updated BEFORE UPDATE ON skills FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TRIGGER trg_emergency_contacts_updated BEFORE UPDATE ON emergency_contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TRIGGER trg_staff_availability_updated BEFORE UPDATE ON staff_availability FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TRIGGER trg_documents_updated BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TRIGGER trg_compliance_requirements_updated BEFORE UPDATE ON compliance_requirements FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TRIGGER trg_compliance_records_updated BEFORE UPDATE ON compliance_records FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TRIGGER trg_shifts_updated BEFORE UPDATE ON shifts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TRIGGER trg_shift_assignments_updated BEFORE UPDATE ON shift_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TRIGGER trg_shift_templates_updated BEFORE UPDATE ON shift_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TRIGGER trg_invitations_updated BEFORE UPDATE ON invitations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TRIGGER trg_carer_preferences_updated BEFORE UPDATE ON carer_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TRIGGER trg_leave_types_updated BEFORE UPDATE ON leave_types FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TRIGGER trg_leave_requests_updated BEFORE UPDATE ON leave_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TRIGGER trg_leave_balances_updated BEFORE UPDATE ON leave_balances FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TRIGGER trg_compliance_config_updated BEFORE UPDATE ON compliance_config FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Location certificates
CREATE TABLE IF NOT EXISTS location_certificates (
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
);
DO $$ BEGIN
    CREATE TRIGGER trg_location_certificates_updated BEFORE UPDATE ON location_certificates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_org ON users(email, organization_id);
CREATE INDEX IF NOT EXISTS idx_locations_organization_id ON locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_departments_location_id ON departments(location_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_user_id ON staff_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_qualifications_staff_id ON qualifications(staff_id);
CREATE INDEX IF NOT EXISTS idx_skills_staff_id ON skills(staff_id);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_staff_id ON emergency_contacts(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_availability_staff_id ON staff_availability(staff_id);
CREATE INDEX IF NOT EXISTS idx_documents_staff_id ON documents(staff_id);
CREATE INDEX IF NOT EXISTS idx_documents_expiry_date ON documents(expiry_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_compliance_records_staff_requirement ON compliance_records(staff_id, requirement_id);
CREATE INDEX IF NOT EXISTS idx_compliance_records_requirement_id ON compliance_records(requirement_id);
CREATE INDEX IF NOT EXISTS idx_shifts_location_id ON shifts(location_id);
CREATE INDEX IF NOT EXISTS idx_shifts_department_id ON shifts(department_id);
CREATE INDEX IF NOT EXISTS idx_shifts_start_time ON shifts(start_time);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_shift_id ON shift_assignments(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_staff_id ON shift_assignments(staff_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_invitations_organization_id ON invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_types_organization_id ON leave_types(organization_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_staff_id ON leave_requests(staff_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_date ON leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_balances_staff_id ON leave_balances(staff_id);
CREATE INDEX IF NOT EXISTS idx_locations_manager_id ON locations(manager_id);
CREATE INDEX IF NOT EXISTS idx_manager_delegations_primary ON manager_delegations(primary_manager_id);
CREATE INDEX IF NOT EXISTS idx_manager_delegations_delegate ON manager_delegations(delegate_manager_id);
CREATE INDEX IF NOT EXISTS idx_compliance_config_org ON compliance_config(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_organization_id ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_payment_methods_org ON payment_methods(organization_id);
CREATE INDEX IF NOT EXISTS idx_compliance_profiles_org ON compliance_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_cp_requirements_profile ON compliance_profile_requirements(profile_id);
CREATE INDEX IF NOT EXISTS idx_cp_requirements_requirement ON compliance_profile_requirements(requirement_id);
CREATE INDEX IF NOT EXISTS idx_staff_compliance_profile ON staff_profiles(compliance_profile_id);

-- Person / Resident Management
CREATE TABLE IF NOT EXISTS people (
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
    support_level VARCHAR(50),
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    min_staff_required INTEGER DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS care_plans (
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
);

CREATE TABLE IF NOT EXISTS daily_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note_date DATE NOT NULL DEFAULT CURRENT_DATE,
    shift VARCHAR(10) NOT NULL CHECK (shift IN ('day','night')),
    category VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    support_level VARCHAR(50),
    generated_by_ai BOOLEAN NOT NULL DEFAULT FALSE,
    ai_mood_analysis JSONB,
    ai_safeguarding_flags JSONB,
    ai_care_plan_updates JSONB,
    ai_interventions JSONB,
    ai_risk_level VARCHAR(20),
    ai_follow_up_required BOOLEAN DEFAULT FALSE,
    ai_follow_up_details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS risk_assessments (
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
);

CREATE TABLE IF NOT EXISTS family_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    relationship VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(255),
    is_emergency_contact BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Triggers for updated_at
DO $$ BEGIN CREATE TRIGGER trg_people_updated BEFORE UPDATE ON people FOR EACH ROW EXECUTE FUNCTION update_updated_at(); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TRIGGER trg_care_plans_updated BEFORE UPDATE ON care_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at(); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TRIGGER trg_risk_assessments_updated BEFORE UPDATE ON risk_assessments FOR EACH ROW EXECUTE FUNCTION update_updated_at(); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_people_org ON people(organization_id);
CREATE INDEX IF NOT EXISTS idx_people_status ON people(status);
CREATE INDEX IF NOT EXISTS idx_care_plans_person ON care_plans(person_id);
CREATE INDEX IF NOT EXISTS idx_daily_notes_person ON daily_notes(person_id);
CREATE INDEX IF NOT EXISTS idx_daily_notes_date ON daily_notes(note_date);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_person ON risk_assessments(person_id);
CREATE INDEX IF NOT EXISTS idx_family_contacts_person ON family_contacts(person_id);

-- Incident Management
CREATE TABLE IF NOT EXISTS incident_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
    is_cqc_reportable BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS incidents (
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
    is_near_miss BOOLEAN DEFAULT FALSE,
    is_confidential BOOLEAN DEFAULT FALSE,
    investigation_notes TEXT,
    lessons_learned TEXT,
    reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS incident_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(100),
    file_size BIGINT,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS incident_involved_residents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    person_id UUID REFERENCES people(id) ON DELETE SET NULL,
    involvement_type VARCHAR(50) DEFAULT 'affected' CHECK (involvement_type IN ('affected','witness','involved')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS incident_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    due_date DATE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','cancelled')),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN CREATE TRIGGER trg_incidents_updated BEFORE UPDATE ON incidents FOR EACH ROW EXECUTE FUNCTION update_updated_at(); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS idx_incidents_org ON incidents(organization_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_date ON incidents(incident_date);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incident_categories_org ON incident_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_incident_involved_incident ON incident_involved_residents(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_actions_incident ON incident_actions(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_attachments_incident ON incident_attachments(incident_id);

-- Training Compliance Matrix
CREATE TABLE IF NOT EXISTS training_modules (
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
);

CREATE INDEX IF NOT EXISTS idx_training_modules_org ON training_modules(organization_id);

CREATE TABLE IF NOT EXISTS training_records (
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
);

CREATE INDEX IF NOT EXISTS idx_training_records_module ON training_records(module_id);
CREATE INDEX IF NOT EXISTS idx_training_records_staff ON training_records(staff_id);
CREATE INDEX IF NOT EXISTS idx_training_records_expires ON training_records(expires_at);

-- Competency Assessments
CREATE TABLE IF NOT EXISTS competency_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    criteria TEXT,
    requires_reassessment_days INTEGER DEFAULT 365,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_competency_templates_org ON competency_templates(organization_id);

CREATE TABLE IF NOT EXISTS competency_assessments (
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
);

CREATE INDEX IF NOT EXISTS idx_competency_assessments_staff ON competency_assessments(staff_id);
CREATE INDEX IF NOT EXISTS idx_competency_assessments_template ON competency_assessments(template_id);

-- eMAR tables
CREATE TABLE IF NOT EXISTS emedication_records (
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
);

CREATE INDEX IF NOT EXISTS idx_emedr_org ON emedication_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_emedr_person ON emedication_records(person_id);

CREATE TABLE IF NOT EXISTS emedication_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    medication_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100), unit VARCHAR(50),
    batch_number VARCHAR(100), expiry_date DATE,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
    quantity_unit VARCHAR(50) DEFAULT 'tablet(s)',
    reorder_level DECIMAL(10,2) DEFAULT 10,
    location VARCHAR(255),
    person_id UUID REFERENCES people(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_emed_stock_org ON emedication_stock(organization_id);

CREATE TABLE IF NOT EXISTS emedication_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    supplier VARCHAR(255), delivery_note VARCHAR(255),
    delivery_date DATE NOT NULL,
    received_by VARCHAR(255),
    notes TEXT,
    person_id UUID REFERENCES people(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_emed_deliveries_person ON emedication_deliveries(person_id);

CREATE TABLE IF NOT EXISTS emedication_delivery_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID NOT NULL REFERENCES emedication_deliveries(id) ON DELETE CASCADE,
    stock_id UUID REFERENCES emedication_stock(id) ON DELETE SET NULL,
    medication_name VARCHAR(255) NOT NULL, dosage VARCHAR(100), unit VARCHAR(50),
    batch_number VARCHAR(100), expiry_date DATE,
    quantity DECIMAL(10,2) NOT NULL, quantity_unit VARCHAR(50) DEFAULT 'tablet(s)',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS emedication_items (
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
    stock_item_id UUID REFERENCES emedication_stock(id) ON DELETE SET NULL,
    start_date DATE,
    end_date DATE,
    is_controlled_drug BOOLEAN DEFAULT FALSE,
    prescriber_name VARCHAR(255),
    prescriber_phone VARCHAR(50),
    prescription_ref VARCHAR(255),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_emed_item_record ON emedication_items(emedication_record_id);

CREATE TABLE IF NOT EXISTS emedication_administrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    emedication_item_id UUID NOT NULL REFERENCES emedication_items(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
    scheduled_time TIMESTAMPTZ NOT NULL,
    administered_time TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('given', 'refused', 'missed', 'not_available', 'n/a', 'pending')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_emed_admin_item ON emedication_administrations(emedication_item_id);
CREATE INDEX IF NOT EXISTS idx_emed_admin_staff ON emedication_administrations(staff_id);
CREATE INDEX IF NOT EXISTS idx_emed_admin_scheduled ON emedication_administrations(scheduled_time);

-- Body Map
CREATE TABLE IF NOT EXISTS body_map_entries (
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
);

CREATE INDEX IF NOT EXISTS idx_body_map_person ON body_map_entries(person_id);
CREATE INDEX IF NOT EXISTS idx_body_map_status ON body_map_entries(person_id, status);

-- Memory Book (adventures, photos for families)
CREATE TABLE IF NOT EXISTS memory_book_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    image_urls JSONB DEFAULT '[]',
    support_level VARCHAR(50),
    recorded_date DATE DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_memory_book_person ON memory_book_entries(person_id);
CREATE INDEX IF NOT EXISTS idx_memory_book_date ON memory_book_entries(person_id, recorded_date);

CREATE TABLE IF NOT EXISTS emedication_daily_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    count_date DATE NOT NULL,
    staff_name TEXT NOT NULL,
    matches_physical BOOLEAN DEFAULT TRUE,
    notes TEXT,
    counted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    count_session VARCHAR(50) DEFAULT 'end_of_day',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(person_id, count_date, count_session)
);
CREATE INDEX IF NOT EXISTS idx_emed_daily_counts_person ON emedication_daily_counts(person_id);

CREATE TABLE IF NOT EXISTS emedication_daily_count_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_count_id UUID NOT NULL REFERENCES emedication_daily_counts(id) ON DELETE CASCADE,
    medication_item_id UUID NOT NULL REFERENCES emedication_items(id) ON DELETE CASCADE,
    medication_name VARCHAR(255) NOT NULL,
    expected_quantity INTEGER NOT NULL DEFAULT 0,
    actual_quantity INTEGER NOT NULL DEFAULT 0,
    reason_for_mismatch TEXT,
    escalate BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_emed_dci_count ON emedication_daily_count_items(daily_count_id);

-- DBS API integration
CREATE TABLE IF NOT EXISTS dbs_checks (
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
);
CREATE INDEX IF NOT EXISTS idx_dbs_checks_org ON dbs_checks(organization_id);
CREATE INDEX IF NOT EXISTS idx_dbs_checks_staff ON dbs_checks(staff_id);

-- Expense tracking (person spending ledger)
CREATE TABLE IF NOT EXISTS person_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    person_id UUID REFERENCES people(id) ON DELETE SET NULL,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    money_source VARCHAR(20) NOT NULL DEFAULT 'person' CHECK (money_source IN ('house','person')),
    payment_method VARCHAR(30),
    category VARCHAR(30) NOT NULL CHECK (category IN ('food','clothing','activities','transport','personal','health','other')),
    amount_pence INTEGER NOT NULL CHECK (amount_pence > 0),
    description TEXT,
    receipt_url TEXT,
    incurred_date DATE NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_expenses_org ON person_expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_person ON person_expenses(person_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON person_expenses(organization_id, incurred_date);

-- Petty cash per location
CREATE TABLE IF NOT EXISTS petty_cash_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    current_balance_pence INTEGER NOT NULL DEFAULT 0 CHECK (current_balance_pence >= 0),
    last_reconciled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(location_id)
);
CREATE INDEX IF NOT EXISTS idx_pcb_org ON petty_cash_balances(organization_id);

CREATE TABLE IF NOT EXISTS person_cash_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE, current_balance_pence INTEGER NOT NULL DEFAULT 0 CHECK (current_balance_pence >= 0),
    last_reconciled_at TIMESTAMP WITH TIME ZONE, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(person_id)
);
CREATE INDEX IF NOT EXISTS idx_person_cash_balances_org ON person_cash_balances(organization_id);

-- Petty cash transaction log
CREATE TABLE IF NOT EXISTS petty_cash_transactions (
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
);
CREATE INDEX IF NOT EXISTS idx_pct_org ON petty_cash_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_pct_location ON petty_cash_transactions(location_id);

CREATE TABLE IF NOT EXISTS person_cash_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE, type VARCHAR(20) NOT NULL CHECK (type IN ('top_up','reconciliation','adjustment')),
    amount_pence INTEGER NOT NULL, previous_balance_pence INTEGER NOT NULL, new_balance_pence INTEGER NOT NULL, notes TEXT,
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_person_cash_tx_org_person ON person_cash_transactions(organization_id, person_id);

-- Deferred FK: shifts.person_id (people defined after shifts)
DO $$ BEGIN
    ALTER TABLE shifts ADD CONSTRAINT shifts_person_id_fkey
        FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
