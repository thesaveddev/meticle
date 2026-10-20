-- DBS Update Service re-checks — phase 3 of docs/DBS_INTEGRATION_PLAN.md.
--
-- What this is. The Update Service is the only DBS facility an employer can use
-- without becoming an Umbrella Body: a free online status check against the
-- individual's subscription. It is lawful only where the individual has
-- consented, the employer is entitled to the *same* level and workforce as the
-- certificate it holds, the original paper certificate has been seen, and the
-- person's identity has been verified. DBS does not tell employers when a
-- certificate changes, so the re-check is the provider's own job — this
-- migration is what lets that job be scheduled, recorded and evidenced instead
-- of remembered.
--
-- What this is NOT, and the reason for the shape of every column below:
--
--   1. Not a submission. Nothing here can produce a `dbs_checks` row or a
--      `documents` row. Phase 0 removed the code that minted a three-year
--      "approved" DBS document from a result, and a status check must not
--      quietly bring that back: a status check records what the Update Service
--      said about a certificate that already exists, and the certificate itself
--      remains a document a person uploaded.
--   2. Not a second copy of the certificate. Only metadata is stored — level,
--      workforce, the certificate reference, the subscription reference and the
--      dates. The DBS handling rules forbid keeping a copy or image of the
--      certificate, and metadata is what the certificate's own reference line
--      holds, so no column here is a place to put one.
--   3. Not a certificate of its own. `consent_withdrawn_on` and
--      `paper_certificate_seen_on` / `identity_verified_on` are the employer's
--      preconditions, stored per subscription because they are what has to be
--      true before a check is lawful, not per check.
--
-- One subscription per staff member, active at a time (the partial unique index
-- below). Withdrawing one is done by recording the withdrawal, never by
-- deleting: a provider has to be able to show when consent ended and that no
-- check was recorded after it.

-- ── 1. Subscriptions ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dbs_update_service_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,

  -- Standard and Enhanced certificates only: a Basic check is not eligible for
  -- the Update Service, so the list is the eligibility rule, not a preference.
  level VARCHAR(30) NOT NULL CHECK (level IN ('standard', 'enhanced', 'enhanced_with_barred')),
  workforce VARCHAR(10) NOT NULL CHECK (workforce IN ('adult', 'child', 'both')),

  -- The individual's own subscription reference, and the certificate it covers.
  update_service_id VARCHAR(100) NOT NULL,
  certificate_reference VARCHAR(100),
  certificate_issued_on DATE,

  -- Consent. Recorded with who gave it, how, and who entered it, because
  -- "consent-led" is a claim that has to survive an audit months later.
  consent_given_on DATE NOT NULL,
  consent_method VARCHAR(20) NOT NULL CHECK (consent_method IN ('written', 'email', 'verbal', 'online_form')),
  consent_recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  consent_withdrawn_on DATE,
  consent_withdrawn_reason TEXT,

  -- The other two preconditions DBS puts on the employer before a status check.
  paper_certificate_seen_on DATE NOT NULL,
  identity_verified_on DATE NOT NULL,
  identity_method VARCHAR(30) NOT NULL CHECK (identity_method IN ('manual_document_check', 'digital_identity_service')),

  -- Cadence and the next due date. The due date is stored rather than derived
  -- from the interval, so a manager can pull one forward (a certificate about to
  -- be relied on for a new role) without changing the cadence for everyone after.
  check_interval_months INTEGER NOT NULL DEFAULT 12 CHECK (check_interval_months BETWEEN 1 AND 36),
  next_check_due_on DATE NOT NULL,
  last_checked_on DATE,

  -- The renewal marker: set when a check comes back changed, or when a manager
  -- records that a new certificate has to be obtained by a date. It survives
  -- until the new certificate's details are recorded — see completeRenewal().
  renewal_due_on DATE,
  renewal_note TEXT,
  renewal_completed_on DATE,

  -- `withdrawn` = consent ended (checks must stop); `lapsed` = the subscription
  -- ended with the Update Service. Neither is a delete.
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'lapsed')),

  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- One active subscription per person. A withdrawn one stays on the record, so
-- this is partial rather than a plain unique constraint.
CREATE UNIQUE INDEX IF NOT EXISTS idx_dbs_update_service_active_staff
  ON dbs_update_service_subscriptions (staff_id)
  WHERE status = 'active';

-- The sweep's access path: active subscriptions due per organisation.
CREATE INDEX IF NOT EXISTS idx_dbs_update_service_due
  ON dbs_update_service_subscriptions (organization_id, next_check_due_on)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_dbs_update_service_staff
  ON dbs_update_service_subscriptions (staff_id);

-- ── 2. Status checks ────────────────────────────────────────────────────────

-- One row per check that was actually performed. Append-only in practice: a
-- recorded check is a record of an act, and a mistyped one is corrected by
-- recording another, not by editing history away.
CREATE TABLE IF NOT EXISTS dbs_update_service_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES dbs_update_service_subscriptions(id) ON DELETE CASCADE,

  checked_on DATE NOT NULL,
  -- `no_change` — the certificate stands as issued.
  -- `changed`    — the Update Service reports information not on the certificate
  --                the employer holds; a new certificate has to be obtained, and
  --                that is the renewal marker.
  -- `unable_to_check` — the check could not be completed (service unavailable,
  --                details did not match). Recorded rather than dropped, so the
  --                attempt is visible, and the subscription stays due.
  outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('no_change', 'changed', 'unable_to_check')),

  -- The entitlement assertion, held per check as well as per subscription: the
  -- employer must be entitled to the same level and workforce every time it
  -- asks, and a manager who cannot assert it must not record a check.
  level VARCHAR(30) NOT NULL CHECK (level IN ('standard', 'enhanced', 'enhanced_with_barred')),
  workforce VARCHAR(10) NOT NULL CHECK (workforce IN ('adult', 'child', 'both')),

  checked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  next_check_due_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dbs_update_service_checks_subscription
  ON dbs_update_service_checks (subscription_id, checked_on DESC);

-- ── 3. Reminder ledger ──────────────────────────────────────────────────────

-- What a sweep has already said, keyed on the date it was about.
--
-- The sweep runs on a timer and does not know whether it has already run today,
-- so the sentence "this subscription is due on the 3rd" has to be sayable once.
-- The key is (subscription, kind, due_on) rather than a column on the
-- subscription because the state can move while a check is outstanding — a check
-- recorded with `unable_to_check` pushes the due date out by a day, and the
-- provider should be reminded again on the new date, which this key allows.
CREATE TABLE IF NOT EXISTS dbs_update_service_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES dbs_update_service_subscriptions(id) ON DELETE CASCADE,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('check_due', 'check_overdue', 'renewal_due')),
  due_on DATE NOT NULL,
  notified_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (subscription_id, kind, due_on)
);

CREATE INDEX IF NOT EXISTS idx_dbs_update_service_reminders_subscription
  ON dbs_update_service_reminders (subscription_id);

-- ── 4. Tenant isolation ─────────────────────────────────────────────────────
--
-- Same shape as the medicines-in-care tables (migration 135): the role check is
-- what lets the background sweep see the rows at all, because it runs with the
-- synthetic SYSTEM_ACTOR whose role is ORG_ADMIN (events.org-context.ts), and
-- the org check is what keeps one provider out of another's records. Both are
-- needed on USING and WITH CHECK, so an INSERT cannot place a row in a tenant
-- the session is not scoped to.

ALTER TABLE dbs_update_service_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dbs_update_service_subscriptions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dbs_update_service_subscriptions_manager ON dbs_update_service_subscriptions;
CREATE POLICY dbs_update_service_subscriptions_manager ON dbs_update_service_subscriptions
  FOR ALL USING (
    NULLIF(current_setting('app.current_user_role', true), '') IN ('ORG_ADMIN', 'MANAGER')
    AND organization_id = NULLIF(current_setting('app.current_org_id', true), '')::UUID
  )
  WITH CHECK (
    NULLIF(current_setting('app.current_user_role', true), '') IN ('ORG_ADMIN', 'MANAGER')
    AND organization_id = NULLIF(current_setting('app.current_org_id', true), '')::UUID
  );

ALTER TABLE dbs_update_service_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE dbs_update_service_checks FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dbs_update_service_checks_manager ON dbs_update_service_checks;
CREATE POLICY dbs_update_service_checks_manager ON dbs_update_service_checks
  FOR ALL USING (
    NULLIF(current_setting('app.current_user_role', true), '') IN ('ORG_ADMIN', 'MANAGER')
    AND organization_id = NULLIF(current_setting('app.current_org_id', true), '')::UUID
  )
  WITH CHECK (
    NULLIF(current_setting('app.current_user_role', true), '') IN ('ORG_ADMIN', 'MANAGER')
    AND organization_id = NULLIF(current_setting('app.current_org_id', true), '')::UUID
  );

ALTER TABLE dbs_update_service_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE dbs_update_service_reminders FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dbs_update_service_reminders_manager ON dbs_update_service_reminders;
CREATE POLICY dbs_update_service_reminders_manager ON dbs_update_service_reminders
  FOR ALL USING (
    NULLIF(current_setting('app.current_user_role', true), '') IN ('ORG_ADMIN', 'MANAGER')
    AND organization_id = NULLIF(current_setting('app.current_org_id', true), '')::UUID
  )
  WITH CHECK (
    NULLIF(current_setting('app.current_user_role', true), '') IN ('ORG_ADMIN', 'MANAGER')
    AND organization_id = NULLIF(current_setting('app.current_org_id', true), '')::UUID
  );
