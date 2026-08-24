# CareDesk: AI-First Care Operating System Blueprint

## Version 2.0 — Updated July 2026

### Change Summary

This revision transforms the MVP blueprint into a comprehensive AI-first product and architecture specification. All existing capabilities have been verified against the live codebase (41 backend modules, 484 API endpoints, 78 frontend pages, 108 database tables, 154 Zod validation schemas). The blueprint now covers the complete current state, the AI-first transformation vision, event-driven intelligence, agent architecture, Mission Control, cross-module workflows, governance, phased roadmap, and commercial packaging.

---

# 1. Product Goal

CareDesk is a multi-tenant supported-living care management platform that must evolve into:

> **The AI Operating System for Care Providers**

The platform must actively help care organisations:
- Deliver safer care
- Reduce documentation time
- Remain inspection-ready
- Detect operational and compliance risks
- Improve staff deployment
- Identify changes in service-user wellbeing
- Produce high-quality care documentation
- Coordinate actions across departments
- Prepare evidence for regulators
- Reduce duplicated work
- Make management decisions from real organisational data

The AI experience should feel less like a chatbot and more like having:
- An experienced compliance officer
- An operations manager
- A documentation specialist
- A quality-assurance manager
- A rota coordinator
- An inspection-readiness adviser
- A care-record reviewer

These are integrated capabilities within the main CareDesk platform, with clear module boundaries, permissions, subscription controls and audit records.

---

# 2. Current Product State (Verified July 2026)

## 2.1 Scale

| Metric | Count |
|---|---|
| Backend modules | 41 |
| API endpoints | 484 |
| Frontend pages | 78 |
| Frontend routes | 77 |
| Database tables | 108 |
| Zod validation schemas | 154 |
| Sidebar navigation items | 24 |
| Backend test files | 2 |
| Frontend component files | ~120 |

## 2.2 Backend Modules (41)

| # | Module | Endpoints | Key Capabilities |
|---|---|---|---|
| 1 | auth | 14 | Register (self + invitation), login with MFA, JWT refresh, email verification (token + code), password reset, logout with token blacklist |
| 2 | mfa | 5 | TOTP setup (QR), verify, self-disable, admin-disable |
| 3 | orgs | 19 | Org CRUD, locations, departments, teams, branding, subscription |
| 4 | organization | 6 | Invitation lifecycle: send, validate, list, resend, accept, cancel |
| 5 | staff | 20 | Profiles, role/status, qualifications, skills, emergency contacts, department assignment, force password reset, self-deactivation |
| 6 | compliance | 19 | Document management, expiring alerts, evidence packs (KLOE), PDF generation, identity dashboard, trends, notification runner, DBS renewal workflow |
| 7 | scheduling | 30 | Shift CRUD, assign/claim/swap/approve/reject, templates, min-staffing, OT claims, agency forwarding, 11-hour rest enforcement |
| 8 | marketplace | 3 | Open shifts, apply, publish |
| 9 | reporting | 3 | Compliance audit, staffing stats, PDF/CSV export |
| 10 | insights | 6 | Overview KPIs, staffing, compliance, leave, rota, outcomes analytics |
| 11 | service-users | 59 | Full CRUD + 20 sub-tabs: care plans, daily notes, assessments, risk assessments, family contacts, body map, memory book, clinical scores, documents, wellbeing, communication log, capacity, care pathways, discharge, timeline |
| 12 | incidents | 17 | CRUD, categories, involved residents, action items, CQC reportability |
| 13 | dashboard | 5 | 7 KPI stats, compliance snapshot, today's rota, widgets, review scheduler |
| 14 | notifications | 6 | List, unread count, mark read (single/all), preferences |
| 15 | permissions | 3 | Module-level RBAC, get/update user permissions |
| 16 | training | 12 | Module CRUD, records, matrix, expiring, dashboard, bulk-assign, auto-assign |
| 17 | competency | 8 | Templates CRUD, assessments with evidence, pending (role-filtered) |
| 18 | cqc | 7 | Readiness (5-domain real-data), frameworks (4 regulators), gap analysis, action items |
| 19 | surveys | 18 | Satisfaction (manual + email invite), engagement templates, public token forms |
| 20 | dspt | 5 | NHS DSPT: assessment, 10 standards, submit |
| 21 | leave | 15 | Requests, balances, calendar, types CRUD, entitlements, delegation-aware review |
| 22 | settings | 33 | Org settings, locations, certificates, compliance config, delegations, records, profiles, upload |
| 23 | chat | 16 | Channels (DM/group/general), messages, files, link preview, read receipts, org-members |
| 24 | billing | 12 | Subscription, invoices, payment methods, setup intent, add-ons, Stripe webhook |
| 25 | audit | 1 | Centralized audit log querying (wired across 40+ mutation points) |
| 26 | appointments | 6 | CRUD + today-stats |
| 27 | policies | 7 | CRUD + categories + seed 12 standard CQC policies |
| 28 | emedication | 34 | MAR records, chart grid, administrations, PRN, stock, deliveries, daily counts, adjustments, audit, competence, monthly auto-create, archive/import |
| 29 | goals | 12 | CRUD + milestones + progress history + CQC domain mapping + per-SU stats |
| 31 | ai | 10 | Config (per-org), compliance gap analysis, incident triage, rota analysis/generation, daily note generation (voice→structured), audit/usage |
| 32 | family-portal | 12 | Members CRUD + invite/revoke/refresh + public token-based (care notes, care plans, goals, observations) |
| 33 | delegations | 1 | Delegation audit trail |
| 34 | agencies | 19 | Agencies, workers, rates CRUD + savings analytics + shift history |
| 35 | dbs | 7 | DBS check lifecycle, statistics, polling, renewal tracking |
| 36 | expenses | 10 | Service user expense tracking, petty cash (balances, top-up, reconciliation) |
| 37 | platform-admin | 5 | SUPER_ADMIN: org stats, org list/detail, user list, suspend/reactivate |
| 38 | tasks | 4 | Kanban-style CRUD with priority/status |
| 39 | room-checks | 4 | CRUD with photo upload + MUI ratings |
| 40 | mobile | 4 | GPS check-in, roster (7-day), voice-to-text notes |
| 41 | health | 17 | Observations, bowel (Bristol scale), dental, fluid intake — all CRUD per SU |

## 2.3 Frontend Pages (78)

| Area | Pages | Key Features |
|---|---|---|
| Auth | 7 | Login, Register, Forgot/Reset Password, Verify Email, MFA Challenge, MFA Setup |
| Dashboard | 1 | Role-based KPIs (7 cards), compliance widget, rota timeline, appointments, training/DBS expiry |
| Compliance | 8 | Hub, Identity Monitoring, Competency Assessments (3 tabs), Evidence Packs (KLOE), CQC Readiness (5-domain gauge + AI gap), Records, Satisfaction Surveys, Staff Engagement |
| Scheduling | 3 | Rota Planner (7x24 grid, drag/drop, quick-add, AI generation), OT Claims (4 tabs), Shift Calendar |
| Leave | 1 | 5 tabs: Types, Requests, Balances (compact "X days + Y hours"), Calendar (day-click popup), Settings |
| Chat | 1 | DMs/groups, real-time, emoji, files, link preview, read receipts, unread divider |
| Service Users | 5 | Directory (CSV import), Profile (20 tabs in 5 categories), HealthTab (4 sub-tabs), Memory Book, Body Map (interactive SVG) |
| Staff | 3 | Directory (CSV import, filters), Profile (compliance, permissions, assess), Compliance View |
| Incidents | 2 | Directory (stats), Detail (residents, actions) |
| eMAR | 2 | Active charts (31-day grid, PRN, stock, daily counts), Archived |
| Settings | 1 | 12 tabs: Profile, Compliance, Leave, Delegates, Org, Billing, Integrations, Schedule, Notifications, Security, AI, Appearance |
| Goals | 1 | Milestones, progress history, CQC domain mapping, care plan links |
| AI | 1 | AI Daily Notes: voice input, mood analysis, safeguarding flags, care plan updates |
| Other | 20+ | Appointments, Policies, Care Assessments, Tasks, Room Checks, Marketplace (x2), Agencies (5 tabs), Reporting (6 templates), Insights (5 sections), Training Matrix (4 tabs), DSPT (4 themes/11 standards), Billing (Stripe), Onboarding, Organization (4 tabs), Family Portal, Mobile (GPS + Voice Notes), Learning Center, Legal (3), Marketing (7), Landing, Survey Form, Errors (2) |

## 2.4 Database (108 Tables)

### Core Tables (schema.sql — 57)
organizations, locations, departments, users, staff_profiles, qualifications, skills, emergency_contacts, staff_availability, documents, compliance_requirements, compliance_config, compliance_records, shifts, shift_assignments, shift_swaps, shift_templates, audit_logs, verification_tokens, invitations, carer_preferences, notifications, user_permissions, leave_types, leave_requests, leave_balances, manager_delegations, delegation_audit_logs, password_history, compliance_profiles, compliance_profile_requirements, invoices, payment_methods, location_certificates, service_users, care_plans, daily_notes, risk_assessments, family_contacts, incident_categories, incidents, incident_involved_residents, incident_actions, training_modules, training_records, competency_templates, competency_assessments, emedication_records, emedication_items, emedication_administrations, body_map_entries, memory_book_entries, emedication_daily_count_items, dbs_checks, service_user_expenses, petty_cash_balances, petty_cash_transactions

### Migration Tables (setup.ts — 51)
ai_audit_logs, compliance_snapshots, teams, team_members, chat_channels, chat_members, chat_messages, chat_files, satisfaction_surveys, staff_engagement_surveys, tasks, room_checks, mobile_check_ins, trial_reminders, survey_invitations, engagement_templates, email_queue, health_observations, bowel_movements, dental_records, fluid_intake, appointments, policies, service_user_goals, emedication_audit_log, emedication_stock, emedication_deliveries, emedication_delivery_items, care_assessments, evidence_mappings, emedication_daily_counts, emedication_stock_adjustments, agencies, service_user_access_log, agency_workers, agency_rates, cqc_action_items, notification_preferences, family_members, clinical_scores, service_user_documents, su_wellbeing, su_communication_log, su_capacity_assessments, su_care_pathways, su_discharge_checklist, email_verification_codes, goal_milestones, goal_progress_history

## 2.5 Infrastructure

| Component | Status | Details |
|---|---|---|
| Docker dev | ✅ | 4 services (postgres, redis, api, web) with health checks + volumes |
| Docker prod | ⚠️ | Partial — missing web service, port mismatch, no health checks/volumes |
| CI (GitHub Actions) | ✅ | Lint + typecheck + test + build (no deploy, no Docker push) |
| Redis | ✅ | Graceful in-memory fallback (rate limiter, token blacklist) |
| Socket.IO | ✅ | JWT auth, DB validation, rate limiting, membership gating, online presence |
| Prometheus metrics | ✅ | Histograms + counters |
| Swagger docs | ✅ | Auto-generated from router stack |
| File uploads | ✅ | Multer + UUID names + MIME allowlist + extension/magic-byte blocking |
| Email | ✅ | 20+ branded templates, Nodemailer SMTP, DB-backed queue with retry |
| Stripe | ✅ | Customer/price auto-provisioning, webhook, test/live gating |
| Encryption | ✅ | AES-256-GCM per-org key derivation |
| HTTPS | ✅ | Optional cert-based |
| PWA | ✅ | Service worker, manifest, offline caching, installable, GPS/voice pages |
| Rate limiting | ✅ | In-memory + Redis fallback; 10/min login, 5/min register, 200/min general |
| Virus scanning | ✅ | Extension blocking + magic-byte validation |
| OCR | ✅ | tesseract.js lazy-loaded (zero callers — available but unused) |

## 2.6 Testing

| Type | Status |
|---|---|
| Unit tests | ⚠️ 2 files (jwt.service.test.ts, mfa.controller.test.ts) |
| Integration tests | ❌ None |
| Controller tests | ❌ None |
| E2E tests | ❌ None |

---

# 3. Existing Constraints and Preferences

| Constraint | Rule |
|---|---|
| Role hierarchy | ORG_ADMIN promotes other ORG_ADMINs; MANAGERs cannot change own role |
| Leave Manager | Standalone (not in Rota Planner); calendar day-click popup with status, duration, approve/reject |
| Leave balance format | Compact inline header row, aggregated "X days + Y hours" |
| Compliance profiles | Role-based; role changes reflect instantly via `/auth/me` on page focus + periodic poll |
| Multi-tenancy | Via tenant.ts helpers (no RLS yet) |
| Billing | Stripe auto-provisions on first use; test mode allowed in dev |
| Manager self-approval | Manager cannot self-approve leave; manager/admin leave routes to different ORG_ADMIN; fallback to any ORG_ADMIN |
| Rota Planner | Location-based min safe staffing, compliance block on assign, view-only for non-`scheduling:edit` |
| Rest enforcement | 11-hour rest enforced for OT; conflicting shifts blocked |
| Duplicate handling | Duplicate manager delegations → 409; notifications on OT + dept/team assignment |
| Email | Branded HTML templates, queue with retry (DB-backed inbox) |
| Error display | Inside modals (not behind); tables paginated; buttons have loading spinners |
| Guard | `npx tsc --noEmit` in both `apps/web` and `apps/api` |
| Voice input | Browser-native Web Speech API (en-GB), no server-side transcription |
| AI content | All AI-generated content marked as AI-generated until reviewed and approved by authorised user |

---

# 4. Current Architecture

## 4.1 Monorepo Structure

```
meticle/
├── apps/
│   ├── api/              # Express modular monolith
│   │   ├── src/
│   │   │   ├── modules/          # 41 domain modules
│   │   │   ├── shared/           # Database, middleware, utils, email, PDF, OCR
│   │   │   ├── scripts/          # DB purge, org seed
│   │   │   └── index.ts          # Entry point, router mounting
│   │   └── package.json
│   ├── web/              # React SPA
│   │   ├── src/
│   │   │   ├── pages/            # 78 page components
│   │   │   ├── components/       # Layout, AuthGuard, ModuleGuard, etc.
│   │   │   ├── services/         # API client, socket
│   │   │   └── App.tsx           # 77 routes
│   │   └── package.json
│   └── marketing/        # Marketing site
├── packages/
│   └── shared/           # Shared types, enums, validation
└── package.json          # npm workspaces root
```

## 4.2 Backend Module Pattern

Each module follows a consistent structure:
```
modules/<name>/
├── <name>.controller.ts    # Request handlers
├── <name>.repository.ts    # Raw SQL queries
├── <name>.routes.ts        # Express router with validation
├── <name>.types.ts         # TypeScript interfaces
└── <name>.service.ts       # Business logic (where needed)
```

## 4.3 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + MUI 5 + TanStack React Query + React Router 6 |
| Backend | Node.js + Express + TypeScript (modular monolith) |
| Database | PostgreSQL 15 (raw SQL via pg pool, no ORM) |
| Cache | Redis with in-memory fallback |
| Realtime | Socket.IO v4 with JWT auth + DB validation + rate limiting |
| Auth | JWT access + refresh tokens, MFA (TOTP/speakeasy), RBAC + per-request permissions |
| AI | OpenAI SDK + Anthropic SDK, per-org API keys (AES-256-GCM encrypted), provider abstraction |
| Validation | Zod (154 schemas) |
| Email | Nodemailer SMTP, 20+ branded HTML templates, DB-backed queue |
| Billing | Stripe (subscriptions, invoices, payment methods, webhooks) |
| PDF | Puppeteer-core for HTML→PDF generation |
| OCR | tesseract.js (installed, zero callers) |
| Infra | Docker Compose, GitHub Actions CI, Prometheus metrics, Swagger auto-docs |

## 4.4 Existing AI Infrastructure

| Component | Status | Details |
|---|---|---|
| AI provider abstraction | ✅ | `OpenAIProvider` + `AnthropicProvider` with factory pattern |
| Per-org AI config | ✅ | JSONB in `organizations.ai_config` with encrypted API key storage |
| Feature flags | ✅ | Per-org `enabledFeatures[]` array with 4 flags currently defined |
| Prompt templates | ✅ | 8 named prompts with `{{var}}` mustache-style substitution |
| Structured output parsing | ✅ | JSON.parse with fallback to `{ raw: content }` |
| AI audit logging | ✅ | `ai_audit_logs` table: feature, tokens, model, provider, duration, success/error |
| AI usage stats | ✅ | Aggregated usage statistics endpoint |
| Existing AI features | ✅ | Compliance gap analysis, incident triage, rota analysis/generation, daily note generation |
| Unused prompts | ⚠️ | `visit_note_care_plan_gap` and `competency_assessment_assistant` defined but never called |

---

# 5. Existing AI Capabilities (Implemented)

## 5.1 AI Configuration
- Per-organisation AI settings stored as JSONB
- Provider selection (OpenAI or Anthropic)
- Model selection per provider
- API key encryption (AES-256-GCM)
- Feature flag toggles (4 defined: compliance_gap_analysis, incident_severity_triage, rota_optimization, daily_note_generation)
- Frontend settings page with AI tab

## 5.2 Compliance Gap Analysis
- Input: domain scores, key issues, regulator context
- Output: overall assessment, critical gaps with CQC statement references, quick wins, timeline
- Used in: CQC Readiness page, Settings AI tab

## 5.3 Incident Triage
- Input: incident title, description, category, date, location, involved parties
- Output: severity classification (low/medium/high/critical), confidence, reasoning, actions, CQC notification flag
- Note: Missing Zod validation schema on this endpoint

## 5.4 Rota Analysis & Generation
- Input: week range, location, staffing requirements, staff roster, existing shifts, leave, contracted hours
- Output (analysis): coverage warnings, overtime risks, staffing suggestions, optimization tips
- Output (generation): complete staff rota with shift assignments, coverage summary, warnings
- Used in: Rota Planner page

## 5.5 AI Daily Notes
- Input: staff voice/text observation + service user context (allergies, care plans, goals, baseline mood)
- Output: structured daily note, mood analysis (1-10 score + indicators), safeguarding flags, care plan updates, intervention suggestions, risk level
- Approval workflow: staff reviews, edits, approves → saves to DB with audit trail
- Used in: AI Daily Notes page

---

# 6. Current Gaps

## 6.1 Production Readiness
- Docker prod missing web service, ports, health checks
- No migration versioning (flat array)
- No integration/controller/E2E tests
- No deployment pipeline (CI builds but doesn't deploy)
- No monitoring dashboards or alerting
- No backup/recovery testing
- Socket.IO not scaled horizontally (no Redis adapter)

## 6.2 Tenant Isolation
- Helper-based (not RLS)
- No row-level security in PostgreSQL
- Risk of cross-tenant data leakage in complex queries

## 6.3 AI Gaps
- No event-driven intelligence (all AI is request/response)
- No continuous monitoring or proactive alerts
- No cross-module AI workflows
- No organisational knowledge retrieval (RAG)
- No prompt versioning or A/B testing
- No AI cost controls or budgets
- No AI-generated content labelling on saved records
- No AI approval queue for multi-step workflows
- No AI feedback mechanism
- No structured output validation (just JSON.parse)
- `visit_note_care_plan_gap` and `competency_assessment_assistant` prompts defined but unused
- OCR utility exists but has zero callers
- No Whisper API integration (voice-to-text is browser-native only)

## 6.4 Missing Features (Non-AI)
- E-learning (SCORM/xAPI)
- Digital signatures
- DBS API integration (GBG/uCheck)
- SMS notifications (Twilio)
- PrintNode printing
- Document Drive (file management UI)
- Full reporting suite (live PDF exports from all modules)
- Family Portal Finances tab

---

# 7. AI-First Product Vision

## 7.1 Core Principle: AI as Horizontal Intelligence Layer

AI must not remain an isolated module. It should become a horizontal intelligence layer operating across the platform.

**AI Infrastructure Module** (centralised):
- AI provider configuration
- Model selection and routing
- API key management
- Prompt management (versioned)
- Usage monitoring and cost controls
- Audit records
- Organisation-level AI settings
- AI consent and governance controls

**Domain AI Capabilities** (distributed):
- Incident intelligence → incidents module
- Medication intelligence → emedication module
- Rota intelligence → scheduling module
- Care-plan intelligence → service-users module
- Compliance intelligence → compliance/CQC/training/competency/policies
- Documentation generation → available within each relevant workflow

## 7.2 AI Operating Model (5 Levels)

### Level 1: Assistance
AI helps a user complete a task but does not perform actions independently.
- Rewrite a daily note professionally
- Summarise a service-user timeline
- Explain a compliance gap
- Search organisational policies
- Summarise an incident
- Generate a draft email
- Explain a staffing report

### Level 2: Generation and Workflow Support
AI creates structured drafts using existing CareDesk information.
- Draft daily notes from voice input ✅ (implemented)
- Draft incident reports
- Draft care-plan sections
- Draft risk assessments
- Draft handover summaries
- Draft family updates
- Draft supervision records
- Draft audit reports
- Draft action plans
- Draft inspection evidence summaries
- Draft meeting notes
- Draft policies and procedures

All generated content must be marked as AI-generated until reviewed and approved.

### Level 3: Continuous Intelligence
System continuously analyses data and identifies risks, patterns or missing information.
- Overdue care-plan reviews
- Missing signatures
- Repeated late medication administrations
- Increased falls
- Declining food or fluid intake
- Behavioural changes
- Gaps in daily documentation
- Expiring training
- Missing competency evidence
- Staffing below configured safe levels
- Recurring incident categories
- Uncompleted incident actions
- Policies requiring review
- Compliance evidence becoming stale

### Level 4: Prediction and Decision Support
System estimates future risk or operational demand.
- Likelihood of staffing shortages
- Possible increase in agency usage
- Potential service-user deterioration
- Increased falls risk
- Increased medication-adherence risk
- Risk of overdue reviews
- Possible staff burnout or excessive overtime
- Likelihood of compliance failure
- Inspection-readiness trend
- Predicted training and competency gaps

Predictive outputs must include: confidence level, supporting factors, data period used, limitations, recommended human review, no unsupported clinical diagnosis.

### Level 5: Controlled Automation
System may perform approved low-risk actions under clearly defined policies.
- Create a draft task
- Schedule a review reminder
- Send an internal notification
- Prepare a draft action plan
- Request missing documentation
- Add an item to a manager's approval queue
- Generate a draft evidence pack
- Send approved training reminders
- Escalate an overdue action through configured workflows

**High-risk decisions must never be fully autonomous.** The system must not independently:
- Make clinical diagnoses
- Change medication instructions
- Administer medication
- Submit statutory notifications without approval
- Complete safeguarding referrals without approval
- Change care plans without approval
- Make disciplinary decisions
- Dismiss staff
- Approve its own generated work
- Override staffing safety rules
- Alter regulatory evidence to conceal gaps

---

# 8. Event and Intelligence Engine

## 8.1 Why Events Are Needed

The current application is highly modular but operates in request/response mode only. Intelligent workflows require modules to react to events occurring elsewhere in the platform.

Example: A missed medication administration should trigger checks across medication safety, incident management, care plan review, staffing compliance, and inspection readiness — all from a single event.

## 8.2 Domain Events

### Core Domain Events

| Event Name | Producing Module | Trigger Condition |
|---|---|---|
| `service_user.created` | service-users | New service user created |
| `service_user.status_changed` | service-users | Status changes (active/discharged/deceased) |
| `care_plan.created` | service-users | New care plan created |
| `care_plan.updated` | service-users | Care plan modified |
| `care_plan.review_due` | service-users | Review date reached |
| `daily_note.created` | service-users/mobile/ai | New daily note saved |
| `daily_note.flagged` | ai | AI flags note for review |
| `risk_assessment.updated` | service-users | Risk assessment modified |
| `incident.created` | incidents | New incident submitted |
| `incident.severity_changed` | incidents | Severity level changed |
| `incident.action_overdue` | incidents | Action item past due date |
| `medication.administration_missed` | emedication | Missed dose recorded |
| `medication.administration_late` | emedication | Late administration logged |
| `medication.stock_low` | emedication | Stock below configured threshold |
| `medication.prn_threshold_reached` | emedication | PRN frequency exceeds threshold |
| `health.observation_recorded` | health | New health observation |
| `wellbeing.score_declined` | service-users | Wellbeing score drops below baseline |
| `fluid.intake_below_target` | health | Fluid intake below configured target |
| `training.expiring` | training | Training record within expiry window |
| `training.expired` | training | Training record past expiry |
| `competency.expiring` | competency | Competency assessment within expiry |
| `shift.unfilled` | scheduling | Shift with no assignment before deadline |
| `shift.assigned` | scheduling | Staff assigned to shift |
| `shift.conflict_detected` | scheduling | Overlapping shift assignments detected |
| `staff.overtime_threshold_reached` | scheduling | Staff overtime exceeds configured limit |
| `leave.approved` | leave | Leave request approved |
| `staff.role_changed` | staff | Staff role modified |
| `compliance.record_expiring` | compliance | Compliance document within expiry window |
| `policy.review_due` | policies | Policy review date reached |
| `audit.action_overdue` | audit | Audit action past due |
| `dbs.expiring` | dbs | DBS check within renewal window |
| `family_update.requested` | family-portal | Family member requests update |

### Event Schema

Every event must include:

```typescript
interface DomainEvent {
  eventName: string              // e.g. 'medication.administration_missed'
  producingModule: string        // e.g. 'emedication'
  tenantId: string               // Multi-tenant isolation
  organisationId: string         // Organisation scope
  locationId?: string            // Location scope where applicable
  subjectEntityType: string      // e.g. 'emedication_administrations'
  subjectEntityId: string        // ID of the affected record
  actorId?: string               // User who triggered the action
  actorRole?: string             // Role of the actor
  timestamp: Date                // When the event occurred
  correlationId: string          // Groups related events
  causationId?: string           // Links to the event that caused this one
  eventVersion: number           // Schema version
  sensitivity: 'normal' | 'sensitive' | 'highly_sensitive'
  payload: Record<string, any>   // Event-specific data
}
```

## 8.3 Event Infrastructure Strategy

### Recommended Phased Approach

| Phase | Mechanism | Rationale |
|---|---|---|
| Phase 1 | PostgreSQL transactional outbox | No new infrastructure; events published within existing DB transactions; reliable delivery |
| Phase 2 | Background worker polling outbox | Async processing without new deps; simple retry logic |
| Phase 3 | Redis pub/sub for real-time | Low-latency notifications for UI updates |
| Phase 4 (if needed) | BullMQ on Redis | Mature job queue with retries, delays, priorities, rate limiting |
| Future | Kafka/NATS | Only if horizontal scaling of event processing is required |

### Outbox Table Schema

```sql
CREATE TABLE domain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name VARCHAR(100) NOT NULL,
  producing_module VARCHAR(50) NOT NULL,
  tenant_id UUID NOT NULL,
  organisation_id UUID NOT NULL,
  location_id UUID,
  subject_entity_type VARCHAR(50) NOT NULL,
  subject_entity_id UUID NOT NULL,
  actor_id UUID,
  actor_role VARCHAR(30),
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  correlation_id UUID NOT NULL,
  causation_id UUID,
  event_version INT NOT NULL DEFAULT 1,
  sensitivity VARCHAR(20) NOT NULL DEFAULT 'normal',
  payload JSONB NOT NULL,
  published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  publish_attempts INT DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_events_unpublished (published, event_timestamp) WHERE published = FALSE,
  INDEX idx_events_org (organisation_id, event_name, event_timestamp),
  INDEX idx_events_correlation (correlation_id)
);
```

### Key Design Decisions

1. **Transactional outbox**: Events are written in the same transaction as the business operation. A background worker polls unpublished events and publishes them. This guarantees at-least-once delivery without losing events when the publisher fails after the DB commit.

2. **Idempotency**: Every consumer must handle duplicate events. Use `(event_name, subject_entity_id, event_timestamp)` or a deduplication key in the payload.

3. **Retry**: Failed publishes are retried with exponential backoff. After 5 attempts, events are flagged for manual review.

4. **Retention**: Published events are retained for 90 days, then archived. Audit-critical events are retained per organisational policy.

### Technology Comparison

| Technology | Pros | Cons | Recommendation |
|---|---|---|---|
| PostgreSQL outbox | No new infra, transactional, reliable | Polling overhead, not real-time | ✅ Phase 1 |
| In-process EventEmitter | Simple, fast | Lost on restart, no persistence | ❌ Not reliable |
| Redis pub/sub | Real-time, fast | No persistence, no retry | ✅ Phase 3 (complementary) |
| BullMQ | Mature, retries, delays, priorities | New dependency | ✅ Phase 4 |
| RabbitMQ | Full AMQP, routing | Heavy, operational complexity | ❌ Overkill |
| Kafka | Massive throughput, replay | Extreme complexity | ❌ Overkill |

---

# 9. Agent Architecture

## 9.1 Agent Design Principles

Agents are logical domain agents — they do not need to be separate microservices. They share:
- Common AI provider infrastructure (OpenAI/Anthropic)
- Common prompt management
- Common audit logging
- Common tool framework
- Common approval workflow

Each agent has:
- Defined responsibilities
- Authorised data sources
- Prohibited actions
- Required permissions
- Available tools
- Prompt/version management
- Audit requirements
- Human-approval requirements
- Output schemas
- Cost controls
- Timeout behaviour
- Failure handling
- Evaluation criteria

## 9.2 Agent Registry

### 9.2.1 Compliance Officer Agent

**Responsibilities:**
- Calculate inspection-readiness indicators
- Explain compliance gaps
- Identify expiring evidence
- Detect overdue reviews
- Identify missing records
- Recommend corrective actions
- Prepare draft action plans
- Gather evidence suggestions
- Generate compliance summaries
- Compare locations and departments
- Show compliance trends
- Prepare inspection questions
- Explain what evidence supports each score
- Identify areas where the score cannot be calculated reliably

**Authorised Sources:**
Compliance records, training records, competency records, DBS records, policies, incidents, complaints, surveys, evidence packs, CQC readiness data, DSPT data, audits, care-plan review dates, medication audits, staff documentation, organisation compliance configuration

**Prohibited Actions:**
- Artificially mark an organisation compliant
- Modify compliance scores without evidence
- Submit regulatory notifications without approval

**Output Schema:**
```typescript
interface ComplianceAgentOutput {
  overall_readiness_score: number;
  domain_scores: { domain: string; score: number; confidence: number; evidence_count: number }[];
  critical_gaps: { area: string; statement: string; current_state: string; recommended_action: string; priority: 'critical' | 'high' | 'medium' }[];
  expiring_items: { type: string; entity: string; expiry_date: string; days_remaining: number }[];
  overdue_reviews: { type: string; entity: string; due_date: string; days_overdue: number }[];
  recommended_actions: RecommendedAction[];
  explainability: { domain: string; sources: string[]; missing: string[]; calculation_method: string }[];
}
```

### 9.2.2 Operations Manager Agent

**Responsibilities:**
- Detect upcoming staffing gaps
- Detect unsafe staffing levels
- Recommend suitable staff
- Respect compliance assignment blocks
- Respect role and skill requirements
- Respect 11-hour rest requirements
- Detect excessive overtime
- Estimate agency demand
- Compare agency and internal staffing costs
- Recommend shift publication
- Recommend shift reassignment
- Highlight likely operational pressure
- Prepare a daily operations briefing

**Authorised Sources:**
Scheduling, leave, staff availability, staffing minimums, skills, qualifications, competency, training, agency workers, open shifts, overtime, locations, departments, teams, appointment schedules

**Prohibited Actions:**
- Bypass rota rules
- Assign non-compliant staff
- Override 11-hour rest requirement
- Make staffing assignments without approval

### 9.2.3 Documentation Agent

**Responsibilities:**
Provide structured drafting across the platform for:
- Daily notes (✅ implemented)
- Care plans
- Risk assessments
- Incident reports
- Body-map descriptions
- Handover summaries
- Communication logs
- Supervision records
- Competency evidence summaries
- Audit reports
- Action plans
- Family updates
- Meeting minutes
- Letters and emails
- Policies and procedures
- Review summaries
- Discharge summaries
- Inspection evidence narratives

**Requirements:**
- Use module-specific schemas
- Return structured JSON before document rendering
- Avoid inventing facts
- Clearly identify unavailable information
- Preserve the original staff account
- Allow users to compare source input with generated text
- Require review before finalisation
- Record author, reviewer and AI contribution
- Retain generation history where legally appropriate

### 9.2.4 Resident Intelligence Agent

**Authorised Sources:**
Care plans, daily notes, risk assessments, goals, health observations, fluid intake, bowel records, dental records, clinical scores, wellbeing records, communication logs, capacity records, incidents, medication records, appointments, memory-book entries, family communications, care pathways, discharge records, timeline data

**Responsibilities:**
- Generate resident summaries
- Identify changes over time
- Highlight overdue reviews
- Detect conflicting records
- Identify missing documentation
- Identify changes requiring professional review
- Summarise recent events
- Prepare handover information
- Produce family-friendly summaries where authorised
- Recommend records that may need review

**Prohibited Actions:**
- Diagnose conditions
- Present uncertain conclusions as clinical facts
- Modify care plans without approval

### 9.2.5 Medication Safety Agent

**Authorised Sources:**
MAR records, scheduled administrations, actual administrations, missed doses, late doses, refusals, PRN usage, stock, deliveries, adjustments, medication competency, medication incidents, daily counts, audit history

**Responsibilities:**
- Highlight missed and late administrations
- Detect recurring patterns
- Detect low stock
- Identify unusual PRN frequency
- Identify required medication competency review
- Prepare medication audit summaries
- Link relevant incidents
- Recommend human review

**Prohibited Actions:**
- Recommend dosage changes
- Stop medication
- Change administration instructions
- Override a prescriber
- Make unsupported drug-interaction conclusions

### 9.2.6 Incident and Safeguarding Agent

**Responsibilities:**
- Assist with incident classification
- Draft structured incident reports
- Identify missing required information
- Highlight potential safeguarding indicators
- Link similar incidents
- Identify recurring locations, times or contributing factors
- Suggest investigation questions
- Draft action items
- Track overdue actions
- Prepare anonymised trend reports

**Prohibited Actions:**
- Make final safeguarding determination autonomously
- Submit statutory notifications without approval
- Close incidents without human review

### 9.2.7 Inspection Readiness Agent

**Responsibilities:**
- Prepare evidence by regulatory domain
- Review missing or expired evidence
- Generate likely inspection questions
- Prepare mock-inspection workflows
- Create location-level inspection packs
- Highlight unresolved action plans
- Explain changes in readiness score
- Track progress from one inspection simulation to another
- Produce read-only snapshots of evidence at a point in time

**Regulator Frameworks:**
- CQC (England)
- CIW (Wales)
- Care Inspectorate Scotland
- RQIA (Northern Ireland)
- Future: other regulators via configurable framework mappings

### 9.2.8 Policy and Knowledge Agent

**Responsibilities:**
- Answer questions from approved organisational policies
- Show citations to the exact policy section used
- Identify policies due for review
- Compare policy content with configured regulatory requirements
- Identify conflicting policies
- Suggest draft updates
- Identify where organisational practice may not match policy
- Prevent the use of superseded policy versions

### 9.2.9 Family Communication Agent

**Responsibilities:**
- Generate family-friendly summaries
- Remove inappropriate clinical or staff-only information
- Follow service-user consent and capacity rules
- Respect portal permissions
- Draft appointment or wellbeing updates
- Allow staff review before sharing
- Log exactly what information was shared and by whom

---

# 10. Organisational Knowledge Layer

## 10.1 Data Sources

The AI should be able to retrieve information from:
- Policies and procedures
- Care plans
- Risk assessments
- Incidents
- Staff records
- Training records
- Competency records
- Compliance evidence
- CQC mappings
- DSPT mappings
- Service-user documents
- Organisational documents
- Audit results

## 10.2 Requirements

| Requirement | Detail |
|---|---|
| Tenant isolation | No cross-tenant retrieval under any circumstances |
| Organisation isolation | Queries scoped to the user's organisation |
| Location-level restrictions | Respect location-based permissions |
| Service-user access checks | Only authorised personnel access SU data |
| Role and permission checks | Enforce RBAC on all retrieval |
| Data classification | Tag data by sensitivity level |
| Document version control | Use only current approved versions |
| Deleted/superseded handling | Exclude deprecated content from retrieval |
| Source citations | Every AI response must cite its sources |
| Retrieval audit logging | Log what data was retrieved for each AI interaction |
| Re-indexing | Trigger re-indexing when records change |
| Immediate revocation | Remove access when permissions change |

## 10.3 Retrieval Strategy

| Technology | Use Case | Recommendation |
|---|---|---|
| PostgreSQL full-text search | Keyword search across documents | ✅ Phase 1 (already available) |
| pgvector | Semantic similarity search | ✅ Phase 2 |
| Hybrid search | Combine keyword + vector | ✅ Phase 2 |
| Record-level metadata filters | Scope retrieval by location/role/SU | ✅ Phase 1 |
| Document chunking | Break long documents into searchable segments | ✅ Phase 2 |
| Structured-data retrieval | Live module queries via tools | ✅ Phase 1 |
| Tool calling | Agents call module services via defined tools | ✅ Phase 1 |

**Key principle:** Live structured data should normally be retrieved from authoritative module services via tool calling, not from vector search. Vector search is supplementary for unstructured content (policies, documents, notes).

---

# 11. AI Tool and Action Framework

## 11.1 Tool Registry

All agent interactions with CareDesk data go through approved tools. Agents must not have unrestricted database access.

### Read Tools

| Tool | Module | Description |
|---|---|---|
| `get_service_user_summary` | service-users | Get SU profile, care plans, goals, recent notes |
| `get_care_plans` | service-users | Get active care plans for a SU |
| `get_recent_daily_notes` | service-users | Get recent daily notes for a SU |
| `get_health_observations` | health | Get health observations for a SU |
| `get_medication_administrations` | emedication | Get MAR data for a SU |
| `get_incident_history` | incidents | Get incidents for a SU or location |
| `get_staff_compliance` | compliance | Get compliance status for staff |
| `get_training_matrix` | training | Get training completion data |
| `get_upcoming_shifts` | scheduling | Get upcoming shift schedule |
| `get_safe_staffing_requirements` | scheduling | Get min staffing config per location |
| `get_policy_section` | policies | Search and retrieve policy content |
| `get_cqc_evidence` | cqc | Get CQC readiness data |
| `get_overdue_actions` | audit | Get overdue action items |
| `get_audit_logs` | audit | Get audit trail for records |

### Controlled Write Tools

| Tool | Module | Approval Required |
|---|---|---|
| `create_draft_task` | tasks | Yes — user must approve |
| `create_draft_care_plan_update` | service-users | Yes — qualified staff must approve |
| `create_draft_risk_assessment` | service-users | Yes — qualified staff must approve |
| `create_draft_incident_actions` | incidents | Yes — manager must approve |
| `create_internal_notification` | notifications | No (informational) |
| `schedule_review_reminder` | notifications | No (reminder only) |
| `request_missing_evidence` | compliance | Yes — manager must approve |
| `prepare_draft_family_update` | family-portal | Yes — staff must review before sharing |

### Tool Schema Template

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  module: string;
  inputSchema: ZodSchema;
  outputSchema: ZodSchema;
  requiredPermission: string;      // e.g. 'compliance:view', 'service_users:edit'
  allowedRoles: UserRole[];
  requiresTenantCheck: boolean;
  requiresOrgCheck: boolean;
  requiresLocationCheck: boolean;
  humanApprovalRequired: boolean;
  auditLogging: boolean;
  rateLimit?: { maxCalls: number; windowMs: number };
  timeoutMs: number;
  onError: 'fail' | 'retry' | 'fallback';
  idempotencyKey?: (input: any) => string;
}
```

---

# 12. Mission Control

## 12.1 Vision

Mission Control is an enhanced manager workspace that answers:
- What needs attention today?
- Who may be at risk?
- Is the organisation safely staffed?
- What compliance items are approaching expiry?
- What documentation is missing?
- What actions are overdue?
- Are there emerging medication concerns?
- Are care plans current?
- Are incidents increasing?
- Is the service inspection-ready?
- What changed since yesterday?
- Which actions will have the greatest impact?

## 12.2 Sections

### Daily Briefing
```
"Good morning. Three items require urgent review:
1. Friday night shift is below safe staffing level
2. 5 care plans are due this week
3. 2 medication records require attention"
```

### Operational Health
- Safe staffing status per location
- Open shifts with countdown to start
- Overtime exposure (hours + cost)
- Agency reliance trend
- Leave pressure (who's off, impact on staffing)
- Appointment pressure

### Quality and Compliance
- Inspection-readiness score (trend)
- Expiring records (next 30/60/90 days)
- Overdue audits
- Missing evidence by KLOE domain
- Policy reviews due
- Training and competency risks
- DBS renewal timeline

### Service-User Attention
- Recent incidents (last 7 days)
- Declining wellbeing indicators
- Missed observations
- Nutrition/hydration concerns
- Care-plan reviews overdue
- Medication concerns (missed/late/PRN patterns)
- Falls trend
- Weight change alerts

### Recommended Actions
Each recommendation includes:
- Reason
- Supporting evidence
- Urgency (informational/advisory/action_required/urgent/critical)
- Suggested owner
- Due date
- Required permission
- Whether the action is AI-generated
- Approve, edit, dismiss or assign controls

### Explainability
Managers must be able to ask:
- Why was this flagged?
- Which records caused this alert?
- When did the trend begin?
- What changed?
- How confident is the system?
- Which rule or model was used?
- What action is recommended?
- Has someone already reviewed it?

---

# 13. Cross-Module Intelligence Workflows

## 13.1 Missed Medication Workflow

When a medication administration is marked missed:
1. Create a `medication.administration_missed` event
2. Check whether the medication is time-critical
3. Check recent missed or late administrations for this medication/person
4. Check related medication incidents
5. Check staff medication competency
6. Check whether required follow-up has been recorded
7. Create an appropriate alert (severity based on pattern)
8. Recommend a manager review
9. Create a draft task if configured
10. Update relevant medication-quality indicators
11. Log every automated step
12. Do not provide clinical instructions beyond approved organisational protocols

## 13.2 Repeated Falls Workflow

When multiple falls occur within a configured period:
1. Link related incidents
2. Review existing falls-risk assessment
3. Review recent health observations where authorised
4. Review staffing and location context
5. Check whether the care plan has been reviewed
6. Recommend a risk-assessment review
7. Recommend appropriate professional review without diagnosing
8. Create a manager action
9. Include the trend in the resident summary
10. Update inspection-readiness evidence where relevant

## 13.3 Declining Hydration Workflow

When fluid records fall below configured thresholds:
1. Evaluate the completeness of fluid documentation
2. Compare with the service user's configured target
3. Identify repeated low-intake periods
4. Check relevant care-plan instructions
5. Flag for staff review
6. Recommend appropriate escalation according to approved protocols
7. Do not make a medical diagnosis

## 13.4 Staffing Gap Workflow

When an upcoming shift is unfilled:
1. Check safe staffing requirements
2. Determine role and skill requirements
3. Find compliant internal staff
4. Check rest requirements (11-hour rule)
5. Check overtime limits
6. Check training and competency
7. Check location and team assignment
8. Recommend internal staff (ranked by suitability)
9. Recommend open-shift publication if required
10. Estimate agency cost if internal cover is unavailable
11. Require authorised approval before assignment

## 13.5 Incident Follow-Up Workflow

When an incident is submitted:
1. Validate required fields
2. Perform AI-supported triage (✅ partially implemented)
3. Identify missing information
4. Identify possible safeguarding indicators
5. Suggest severity and category (without finalising automatically)
6. Identify similar incidents
7. Draft action items
8. Assign approval to an authorised manager
9. Track action completion
10. Include outstanding actions in Mission Control

## 13.6 Inspection Preparation Workflow

When inspection mode is activated:
1. Select regulator and framework
2. Freeze/timestamp the inspection snapshot
3. Review required evidence
4. Identify missing evidence
5. Identify expired evidence
6. Identify overdue reviews
7. Review unresolved incidents and complaints
8. Review training and competency
9. Review policy currency
10. Review medication-quality records
11. Generate a prioritised action plan
12. Prepare evidence-pack links
13. Generate likely inspector questions
14. Track remediation progress

---

# 14. AI Documentation Platform Capabilities

## 14.1 Voice-to-Structured-Record (✅ Partially Implemented)

Current state: Browser-native Web Speech API transcribes voice → staff saves as daily note → AI generates structured analysis with mood, safeguarding flags, care plan updates.

**Enhancement needed:**

A staff member dictates a natural-language account. The system should:
1. Transcribe the recording (currently browser-only; server-side Whisper API recommended for reliability)
2. Preserve the original transcription
3. Identify possible record categories
4. Convert the content into the correct structured fields
5. Show which words or statements generated each field
6. Highlight uncertain interpretations
7. Allow the staff member to edit
8. Require confirmation
9. Save the final record with an audit link to the original input

**Example:**
```
Input: "Mary had breakfast at around eight, took her medication and spent
about half an hour gardening. She seemed quieter than usual but said
she was okay."

Structured result:
- Meal: Breakfast consumed
- Medication: Referenced, but verify against eMAR (do NOT mark as administered)
- Activity: Gardening, ~30 minutes
- Mood observation: Quieter than usual
- Follow-up: Monitor mood, record any continued change
```

**Critical rule:** The AI must not mark medication as administered based solely on an informal voice note.

## 14.2 AI-Assisted Care Plans

The system may:
- Draft sections from assessments
- Identify gaps
- Detect contradictory information
- Suggest review questions
- Highlight outdated content
- Compare previous and current versions
- Suggest measurable outcomes
- Link relevant risks and goals

A qualified or authorised human must approve all final care-plan changes.

## 14.3 AI-Assisted Risk Assessments

The system may:
- Draft hazards from existing records
- Suggest controls
- Highlight unreviewed incidents
- Compare residual risk over time
- Identify missing required fields
- Request human confirmation

The AI must not silently change a person's risk rating.

---

# 15. Human Approval and Autonomy Controls

## 15.1 Organisation-Level Autonomy Settings

| Level | AI Can | AI Cannot |
|---|---|---|
| **Advisory Only** | Analyse, suggest, answer questions | Create records, create tasks, send notifications |
| **Draft Mode** | Create drafts of notes, plans, reports | Save anything without human approval |
| **Controlled Automation** | Perform approved low-risk actions (reminders, draft tasks) | High-risk actions without approval |

## 15.2 Feature-Level Controls

Administrators can enable/disable:
- Voice documentation
- Incident triage
- Compliance monitoring
- Rota recommendations
- Family-summary generation
- Policy assistance
- Predictive alerts
- Automatic task creation
- Automatic internal reminders

## 15.3 Risk-Level Controls

Controls may be configured by:
- Organisation
- Location
- Module
- Role
- Risk level (low/medium/high/critical)
- Action type (read/write/notify/automate)

---

# 16. AI Governance, Safety and Compliance

## 16.1 UK GDPR

| Requirement | Implementation |
|---|---|
| Lawful basis | Article 6(1)(f) legitimate interest + Article 9(2)(h) healthcare treatment |
| Special-category data | Health data requires explicit safeguards; DPA 2018 Schedule 1 conditions |
| Data minimisation | AI only receives data necessary for the specific task |
| Data Processing Agreement | Required with OpenAI/Anthropic as data processor |
| Data residency | API calls routed through our backend; data processing location documented |
| Subprocessor records | Maintain list of AI providers as subprocessors |
| Right to correction | Users can correct AI-generated content before approval |
| Right to challenge | Users can dismiss/reject AI recommendations |
| Subject-access requests | AI-generated content about a person is included in SARs |
| Data deletion propagation | When a record is deleted, associated AI data must be cleaned |

## 16.2 CQC Compliance

Per CQC's May 2026 AI statement:
- **AI to support, not replace** — enhance but never replace human decision-making
- **Human oversight** — outputs continuously monitored and evaluated
- **Transparency and choice** — service users informed about AI's role
- **Safety and reliability** — AI must deliver safe, equitable outcomes
- **Security** — GDPR-compliant storage and processing
- **Fairness** — bias mitigated, equity maintained
- **Training** — staff sufficiently trained and confident
- **Effective governance** — risk assessments, incident reporting, lessons learned
- **DPIA** — mandatory before deployment
- **Accountability** — clear mechanisms for addressing AI-related harm

## 16.3 High-Risk Contexts

The following require heightened review and clear warnings:
- Safeguarding
- Medication
- Capacity assessments
- Health deterioration
- Staff disciplinary decisions
- Regulatory submissions
- Care-plan changes
- Risk-rating changes
- Family disclosures

## 16.4 Safety Controls

| Control | Implementation |
|---|---|
| AI-generated content labelling | Every AI output tagged with `ai_generated: true` |
| Human-in-the-loop | All write operations require human approval |
| Prompt-injection protection | Input sanitisation, system prompt isolation |
| Retrieval poisoning protection | Validate retrieved content integrity |
| Hallucination controls | Structured output validation, source citations, confidence scores |
| Sensitive-data redaction | PII stripped from prompts where not needed |
| Model-risk management | Version pinning, rollback capability |
| Bias testing | Regular evaluation of output fairness |
| Incident-response procedures | Defined escalation path for AI failures |
| Model-provider outage procedures | Fallback provider, graceful degradation |

---

# 17. AI Audit Trail

## 17.1 Existing Audit (✅ Implemented)

The `ai_audit_logs` table currently stores:
- organisation_id, feature, prompt_key, prompt_tokens, completion_tokens, total_tokens
- model, provider, duration_ms, success, error_message
- created_by, request_data, response_summary, created_at

## 17.2 Enhanced Audit (Planned)

Every AI interaction should additionally record:
- tenant_id
- location_id
- user_role
- agent_type
- action_requested
- prompt_template_version
- tool_calls (list of tools invoked)
- records_accessed (list of entity IDs)
- output_schema_version
- generated_result (structured)
- confidence/uncertainty
- human_changes (diff between AI output and final saved version)
- approval or rejection (who approved, when)
- final_saved_result
- estimated_cost
- safety_flags
- correlation_id (links related AI interactions)

**Privacy note:** Avoid storing unnecessary full prompts containing highly sensitive information when structured references are sufficient.

---

# 18. Prompt and Model Management

## 18.1 Prompt Versioning

| Feature | Implementation |
|---|---|
| Versioned templates | Each prompt has a version number; templates stored in code with git history |
| Organisation-level config | Per-org model selection and feature flags |
| Provider fallback | If primary provider fails, fallback to secondary |
| Model routing | Route different tasks to different models (e.g., quick tasks → gpt-4o-mini, complex analysis → claude-sonnet) |
| Task-specific model selection | Configurable per feature |
| Structured-output validation | Zod schemas validate all AI JSON output before use |
| Retry policy | Exponential backoff, max 3 retries |
| Timeout policy | 30s default, configurable per task |
| Cost ceilings | Per-org daily and monthly token budgets |
| Usage alerts | Notify when approaching budget limits |
| Feature quotas | Rate limits per feature per org |
| Rollback | Ability to revert to previous prompt version |

## 18.2 Model Management

- Development, staging and production separation
- Prompt-change approval workflow
- Model-upgrade testing
- Evaluation datasets for quality assurance

---

# 19. Predictive Analytics Strategy

## 19.1 Three Tiers

### Tier 1: Rules (Immediate)
Simple business rules — do NOT label as AI:
- Training expiry within 30 days
- Care plan overdue
- Shift below safe staffing
- Three missed administrations within seven days
- Compliance document expiring
- Policy review overdue

### Tier 2: Statistical Trends (Near-term)
Pattern detection across time series:
- Increase in falls relative to previous period
- Declining wellbeing scores
- Rising agency usage
- Increasing overtime
- Medication refusal patterns
- Documentation completeness trends

### Tier 3: Machine-Learning Predictions (Future — requires data quality + governance)
- Predicted staffing shortage
- Elevated falls risk
- Likely review non-completion
- Potential staff burnout
- Service-user deterioration indicators
- Compliance-risk forecasting

**Requirements before ML deployment:**
- Sufficient training data (minimum 12 months)
- Data-quality assessment
- Bias review
- Explainability
- Validation on held-out data
- Monitoring for drift
- False-positive/negative analysis
- Human review
- Model retraining strategy

---

# 20. Database Changes

## 20.1 New Tables Required

### `domain_events` (Event Outbox)
**Why:** Core infrastructure for event-driven intelligence.
**Existing overlap:** None.
**Tenant isolation:** `organisation_id` column + index.
**Key indexes:** `(published, event_timestamp) WHERE published = FALSE`, `(organisation_id, event_name, event_timestamp)`, `(correlation_id)`.
**Retention:** 90 days published, indefinitely for audit-critical events.
**Encryption:** Normal (not special category).

### `event_consumers`
**Why:** Track which modules/agents have processed which events.
**Existing overlap:** None.
**Key columns:** `event_id`, `consumer_name`, `status`, `attempts`, `last_error`, `completed_at`.
**Retention:** 30 days.

### `ai_prompt_templates`
**Why:** Version prompt templates outside of code for runtime configuration.
**Existing overlap:** Prompts currently in `ai.prompts.ts` (code).
**Key columns:** `key`, `version`, `system_prompt`, `user_template`, `output_schema`, `is_active`, `created_by`.
**Retention:** Indefinite (version history).

### `ai_recommendations`
**Why:** Store AI-generated recommendations for review/approval workflow.
**Existing overlap:** None (current AI outputs are returned in response only).
**Key columns:** `organisation_id`, `agent_type`, `feature`, `entity_type`, `entity_id`, `recommendation`, `evidence`, `priority`, `status` (pending/approved/rejected/expired), `reviewed_by`, `reviewed_at`.
**Tenant isolation:** `organisation_id`.
**Retention:** 1 year.

### `ai_approvals`
**Why:** Track the approval workflow for AI-generated actions.
**Existing overlap:** None.
**Key columns:** `recommendation_id`, `approver_id`, `action`, `changes_made`, `approved_at`.
**Retention:** 2 years.

### `ai_feedback`
**Why:** Capture user feedback on AI output quality.
**Existing overlap:** None.
**Key columns:** `organisation_id`, `feature`, `agent_type`, `prompt_version`, `output_quality`, `feedback_type`, `user_correction`, `original_output`, `final_output`.
**Tenant isolation:** `organisation_id`.
**Retention:** 1 year.

### `ai_budgets`
**Why:** Cost controls per organisation.
**Existing overlap:** None (usage stats exist but no budgets).
**Key columns:** `organisation_id`, `daily_token_limit`, `monthly_token_limit`, `daily_cost_limit`, `monthly_cost_limit`, `current_daily_usage`, `current_monthly_usage`, `reset_at`.
**Retention:** Indefinite.

### `knowledge_documents`
**Why:** Index organisational documents for AI retrieval.
**Existing overlap:** `documents` table exists but not indexed for AI retrieval.
**Key columns:** `organisation_id`, `source_module`, `source_entity_id`, `title`, `content`, `content_embedding` (pgvector), `metadata`, `version`, `is_current`.
**Tenant isolation:** `organisation_id`.
**Retention:** Matches source document retention.

### `knowledge_chunks`
**Why:** Break long documents into searchable segments.
**Existing overlap:** None.
**Key columns:** `document_id`, `chunk_index`, `content`, `embedding` (pgvector), `metadata`.
**Retention:** Matches parent document.

### `aiorganisation_policies`
**Why:** Organisation-level AI governance configuration.
**Existing overlap:** `organizations.ai_config` exists but limited to provider/model/features.
**Key columns:** `organisation_id`, `autonomy_level`, `enabled_agents`, `data_retention_days`, `consent_recorded`, `dpia_completed`, `dpia_date`, `data_processing_agreement`.
**Tenant isolation:** `organisation_id`.
**Retention:** Indefinite.

### `inspection_snapshots`
**Why:** Freeze evidence state at a point in time for inspection preparation.
**Existing overlap:** None (CQC readiness is real-time only).
**Key columns:** `organisation_id`, `location_id`, `regulator`, `framework`, `snapshot_data` (JSONB), `created_by`, `created_at`.
**Tenant isolation:** `organisation_id`.
**Retention:** 3 years.

### `operational_briefings`
**Why:** Store generated daily briefings for history and comparison.
**Existing overlap:** None.
**Key columns:** `organisation_id`, `location_id`, `briefing_date`, `content` (JSONB), `generated_by`, `acknowledged_by`.
**Tenant isolation:** `organisation_id`.
**Retention:** 1 year.

## 20.2 Tables That Already Exist (Do Not Duplicate)

| Proposed | Existing Equivalent |
|---|---|
| AI audit | `ai_audit_logs` ✅ |
| AI config | `organizations.ai_config` ✅ |
| Notifications | `notifications` ✅ |
| Tasks | `tasks` ✅ |
| Audit logs | `audit_logs` ✅ |
| Compliance records | `compliance_records` ✅ |
| Training records | `training_records` ✅ |

---

# 21. Backend/API Changes

## 21.1 Event Infrastructure

| Endpoint | Method | Module | Description |
|---|---|---|---|
| `POST /events/publish` | POST | events | Internal: publish pending events from outbox |
| `GET /events/pending` | GET | events | Internal: list unpublished events |
| `POST /events/retry/:id` | POST | events | Internal: retry failed event publish |
| `GET /events/correlation/:id` | GET | events | Internal: get all events in a correlation chain |

## 21.2 AI Infrastructure

| Endpoint | Method | Module | Permission | Description |
|---|---|---|---|---|
| `GET /ai/prompts` | GET | ai | ORG_ADMIN | List prompt templates with versions |
| `POST /ai/prompts` | POST | ai | ORG_ADMIN | Create new prompt version |
| `PUT /ai/prompts/:id/activate` | PUT | ai | ORG_ADMIN | Activate a prompt version |
| `POST /ai/feedback` | POST | ai | All | Submit feedback on AI output |
| `GET /ai/recommendations` | GET | ai | ORG_ADMIN, MANAGER | List pending recommendations |
| `POST /ai/recommendations/:id/approve` | POST | ai | ORG_ADMIN, MANAGER | Approve recommendation |
| `POST /ai/recommendations/:id/reject` | POST | ai | ORG_ADMIN, MANAGER | Reject recommendation |
| `GET /ai/budgets` | GET | ai | ORG_ADMIN | Get current budget status |
| `PUT /ai/budgets` | PUT | ai | ORG_ADMIN | Update budget limits |
| `GET /ai/governance` | GET | ai | ORG_ADMIN | Get AI governance settings |
| `PUT /ai/governance` | PUT | ai | ORG_ADMIN | Update governance settings |

## 21.3 Knowledge Layer

| Endpoint | Method | Module | Permission | Description |
|---|---|---|---|---|
| `POST /knowledge/search` | POST | knowledge | All (role-scoped) | Search organisational knowledge |
| `POST /knowledge/index` | POST | knowledge | ORG_ADMIN | Trigger re-indexing of documents |
| `GET /knowledge/status` | GET | knowledge | ORG_ADMIN | Index health and statistics |

## 21.4 Mission Control

| Endpoint | Method | Module | Permission | Description |
|---|---|---|---|---|
| `GET /mission-control/briefing` | GET | dashboard | ORG_ADMIN, MANAGER | Daily briefing |
| `GET /mission-control/operational` | GET | dashboard | ORG_ADMIN, MANAGER | Operational health summary |
| `GET /mission-control/quality` | GET | dashboard | ORG_ADMIN, MANAGER | Quality and compliance summary |
| `GET /mission-control/attention` | GET | dashboard | ORG_ADMIN, MANAGER | Service-user attention items |
| `GET /mission-control/actions` | GET | dashboard | ORG_ADMIN, MANAGER | Recommended actions |

## 21.5 New AI Domain Endpoints

| Endpoint | Method | Module | Permission | Description |
|---|---|---|---|---|
| `POST /ai/summarise/service-user/:id` | POST | ai | All (role-scoped) | Generate resident summary |
| `POST /ai/draft/care-plan` | POST | ai | ORG_ADMIN, MANAGER | Draft care plan section |
| `POST /ai/draft/risk-assessment` | POST | ai | ORG_ADMIN, MANAGER | Draft risk assessment |
| `POST /ai/draft/handover` | POST | ai | ORG_ADMIN, MANAGER, CARE_WORKER | Draft handover summary |
| `POST /ai/draft/incident-report` | POST | ai | ORG_ADMIN, MANAGER | Draft incident report |
| `POST /ai/draft/family-update/:suId` | POST | ai | ORG_ADMIN, MANAGER | Draft family update |
| `POST /ai/analyse/medication-patterns` | POST | ai | ORG_ADMIN, MANAGER | Medication pattern analysis |
| `POST /ai/analyse/staffing-predict` | POST | ai | ORG_ADMIN | Staffing demand prediction |
| `POST /ai/compliance/continuous-check` | POST | ai | ORG_ADMIN, MANAGER | Run continuous compliance check |

---

# 22. Frontend/UX Changes

## 22.1 AI Daily Notes Page (✅ Implemented)

Current: Voice input, service user selector, AI analysis (daily note, mood, safeguarding, care plan updates, interventions), approve workflow.

Enhancement needed:
- Whisper API server-side transcription (reliable across browsers)
- Field-level provenance (highlight which words generated each field)
- Batch mode (multiple SUs in sequence)
- History view (recent AI-generated notes)

## 22.2 Mission Control (Planned)

New page or enhanced dashboard section:
- Daily briefing card
- Operational health widgets (staffing, overtime, agency)
- Quality/compliance summary with trend
- Service-user attention list
- Recommended actions queue with approve/edit/dismiss
- Explainability drill-down (click any alert to see source records)
- Real-time updates via Socket.IO

## 22.3 AI Recommendation Queue (Plared)

New page or sidebar widget:
- List of pending AI recommendations
- Priority-sorted (critical → informational)
- Each item shows: reason, evidence, suggested action, owner
- Approve / Edit / Dismiss / Assign controls
- Filter by agent type, priority, date

## 22.4 AI Governance Settings (Planned)

Extension to existing Settings > AI tab:
- Autonomy level selector (Advisory / Draft / Controlled)
- Per-feature enable/disable toggles
- Budget configuration
- DPIA status tracking
- Consent recording
- Data retention settings

## 22.5 Knowledge Search (Planned)

New component (available in sidebar or as a global search enhancement):
- Natural-language search across policies, procedures, documents
- Results with source citations
- Permission-scoped (only shows what the user can access)
- "Ask a question" interface

## 22.6 Frontend Principles (Preserved)

- Errors inside modals (not behind)
- Tables paginated
- Buttons show loading spinners
- Role changes reflect quickly
- Non-editing roles remain view-only
- Existing leave and scheduling constraints intact
- `tsc --noEmit` passes in both apps

---

# 23. Notifications and Alert Management

## 23.1 Severity Levels

| Level | Description | Example |
|---|---|---|
| Informational | FYI, no action needed | "Training completed successfully" |
| Advisory | Worth reviewing | "2 care plans due this week" |
| Action Required | Must be addressed | "Medication administration missed" |
| Urgent Review | Time-sensitive | "Shift below safe staffing in 2 hours" |
| Critical Escalation | Immediate attention | "Potential safeguarding concern identified" |

## 23.2 Alert Controls

| Feature | Implementation |
|---|---|
| Deduplication | Same alert not repeated within cooldown window |
| Alert grouping | Related alerts grouped (e.g., "3 medication issues today") |
| Cooldown periods | Configurable per alert type (e.g., 4 hours for medication alerts) |
| Escalation | Unacknowledged alerts escalate after configurable period |
| Snoozing | Staff can snooze alerts for configurable duration |
| Assignment | Alerts can be assigned to specific staff |
| Acknowledgement | Staff must acknowledge action-required alerts |
| Resolution | Alerts can be resolved with resolution notes |
| Dismissal reasons | Dismissed alerts require a reason (false positive, already addressed, etc.) |
| False-positive feedback | System learns from dismissed alerts |
| Location-level routing | Alerts routed to staff responsible for the relevant location |
| Role-based routing | Safeguarding → safeguarding lead, medication → medication lead |
| Digest mode | Daily/weekly summary instead of real-time alerts |
| Urgent mode | Real-time push for critical alerts |

---

# 24. Feedback and Continuous Improvement

## 24.1 User Feedback Mechanism

Every AI output should offer:
- 👍 Helpful
- ❌ Incorrect
- 📝 Missing context
- ⚠️ Unsafe suggestion
- 🔁 Duplicate alert
- 🏷️ Wrong priority
- 🏷️ Wrong category
- ✏️ Poor wording

## 24.2 Feedback Data Captured

- Original AI output
- User correction (if provided)
- Final approved result
- Feedback category
- Agent and prompt version
- Relevant record references
- Timestamp

## 24.3 Usage

- Evaluation datasets for prompt improvement
- Quality dashboards
- Model comparison (when multiple models available)
- Bias detection

**Privacy:** Do not automatically use sensitive customer data to train external models without explicit contractual and organisational approval.

---

# 25. Commercial Packaging

## 25.1 Subscription Tiers

### CareDesk Core
- Core care management (service users, care plans, daily records)
- Staff management
- Incidents
- Scheduling
- Basic compliance
- Tasks
- Notifications
- Mobile (GPS check-in, voice notes)

### CareDesk Intelligence
- Documentation assistance (AI daily notes, incident drafting, care-plan drafting)
- Resident summaries
- AI search
- AI rota analysis
- Outcome tracking

### CareDesk Compliance Officer
- Continuous compliance monitoring
- Inspection readiness (5-domain gauge + AI gap analysis)
- Evidence gap analysis
- Policy intelligence
- Automated action plans
- Regulatory framework mapping (CQC/CIW/CIS/RQIA)
- DSPT assessment

### CareDesk Operations Intelligence
- Staffing-gap detection
- Overtime analysis
- Agency-cost optimisation
- Operational briefings
- Resource recommendations
- Mission Control

## 25.2 Implementation

| Feature | Mechanism |
|---|---|
| Feature flags | Per-org `enabledFeatures[]` in `ai_config` (✅ partially implemented) |
| Subscription entitlements | Map features to Stripe subscription plans |
| Usage limits | Per-org token budgets with daily/monthly caps |
| Per-organisation AI budget | Configurable limits with alerts |
| Add-on options | Additional AI features as bolt-ons to base subscription |
| Trial controls | Time-limited access to Intelligence features |
| Provider-cost protection | Hard budget caps to prevent runaway API costs |

---

# 26. Phased Roadmap

## Phase 0: Production Hardening (Before AI Expansion)

| Item | Priority | Effort | Status |
|---|---|---|---|
| Docker prod correction (web service, ports, health checks) | Critical | M | 🔵 Planned |
| Migration versioning (replace flat array) | Critical | M | 🔵 Planned |
| Tenant-isolation review (RLS or comprehensive helper audit) | Critical | L | 🔵 Planned |
| Integration tests (controller + repository) | High | L | 🔵 Planned |
| E2E tests (critical workflows) | High | XL | 🔵 Planned |
| Deployment pipeline (Docker push + deploy) | High | M | 🔵 Planned |
| Monitoring dashboards (Grafana + Prometheus) | High | M | 🔵 Planned |
| Alerting ( PagerDuty/Opsgenie integration) | Medium | S | 🔵 Planned |
| Backup and recovery testing | Critical | S | 🔵 Planned |
| Security review (OWASP, penetration testing) | Critical | L | 🔵 Planned |
| AI data-flow review (GDPR compliance) | High | M | 🔵 Planned |

## Phase 1: AI Foundation

| Item | Priority | Effort | Dependencies |
|---|---|---|---|
| Event outbox table + background worker | Critical | L | Phase 0 |
| Domain event publishing across all mutation points | Critical | L | Event outbox |
| Prompt versioning system | High | M | None |
| Structured-output validation (Zod for all AI outputs) | High | S | None |
| Tool registry + defined tool interfaces | High | L | Event outbox |
| AI recommendation store + approval queue | High | M | None |
| Enhanced AI audit records | High | M | None |
| AI usage budgets + cost controls | High | S | None |
| Provider routing + fallback | Medium | S | None |
| Organisation AI governance controls | High | M | None |
| Basic knowledge retrieval (PostgreSQL FTS) | Medium | M | None |
| AI-generated-content labelling | High | S | None |
| Fix unused prompts (visit_note_care_plan_gap, competency_assessment_assistant) | Low | S | None |

## Phase 2: Documentation Intelligence

| Item | Priority | Effort | Dependencies |
|---|---|---|---|
| Whisper API server-side transcription | High | M | None |
| Voice-to-structured daily notes (enhanced) | High | L | Whisper API, tool registry |
| Incident report drafting | High | M | Tool registry |
| Care-plan section drafting | High | M | Tool registry |
| Risk-assessment drafting | High | M | Tool registry |
| Handover summaries | Medium | S | Tool registry |
| Timeline summaries | Medium | S | Tool registry |
| Family-summary drafts | Medium | M | Tool registry |
| Policy Q&A with citations | Medium | L | Knowledge retrieval |
| Body-map description drafting | Low | S | Tool registry |

## Phase 3: Compliance Officer

| Item | Priority | Effort | Dependencies |
|---|---|---|---|
| Continuous compliance checks (background) | High | L | Event engine |
| Evidence freshness monitoring | High | M | Event engine |
| Readiness score explanation | High | M | None |
| Missing-evidence detection | High | M | None |
| Corrective-action drafts | High | M | Tool registry |
| Inspection preparation workflow | High | L | All compliance modules |
| Framework-aware evidence mapping | Medium | L | None |
| Mission Control compliance briefing | High | M | Mission Control |

## Phase 4: Operations Intelligence

| Item | Priority | Effort | Dependencies |
|---|---|---|---|
| Staffing-gap detection (background) | High | L | Event engine |
| Suitable-staff recommendations | High | L | Tool registry |
| Overtime and rest analysis | High | M | Event engine |
| Agency-demand forecast | Medium | M | Historical data |
| Shift-pressure briefing | Medium | M | Mission Control |
| Operational daily briefing | Medium | M | Mission Control |

## Phase 5: Resident and Medication Intelligence

| Item | Priority | Effort | Dependencies |
|---|---|---|---|
| Resident trend summaries | High | L | Tool registry |
| Documentation-gap detection | High | M | Event engine |
| Wellbeing trend analysis | Medium | M | Historical data |
| Falls trend analysis | Medium | M | Historical data |
| Hydration trend analysis | Medium | M | Historical data |
| Medication-pattern alerts | High | L | Event engine |
| PRN trend analysis | Medium | M | Historical data |
| Stock and competency intelligence | Medium | S | None |

## Phase 6: Controlled Automation

| Item | Priority | Effort | Dependencies |
|---|---|---|---|
| Automatic draft tasks | Medium | M | Approval queue |
| Internal reminder scheduling | Medium | S | Event engine |
| Escalation workflows | Medium | L | Event engine |
| Evidence requests | Low | M | Approval queue |
| Review scheduling | Low | S | Event engine |
| Configurable autonomy levels | High | L | Governance controls |

## Phase 7: Validated Prediction (Future)

Only after data quality, evaluation and governance requirements are met:
- Staffing demand prediction
- Falls-risk support
- Burnout indicators
- Compliance-risk forecasting
- Service-user deterioration indicators

**Prerequisites:**
- 12+ months of quality data
- Bias review completed
- Explainability validated
- False-positive analysis acceptable
- Human review process established
- Model monitoring in place

---

# 27. Testing Strategy

## 27.1 Current State

- 2 unit test files (jwt.service.test.ts, mfa.controller.test.ts)
- No integration tests
- No controller tests
- No E2E tests
- CI runs: lint + typecheck + build + test (Vitest)

## 27.2 Required Testing

### Unit Tests
- All Zod validation schemas (154 schemas)
- AI prompt rendering
- AI provider abstraction
- Password utilities
- JWT service
- Encryption utilities

### Controller Tests (supertest)
- Every endpoint tested with valid/invalid/missing data
- Role-based access tested for each endpoint
- Tenant isolation verified

### Integration Tests
- Cross-module workflows (e.g., incident → notification → audit)
- Event publishing and consumption
- AI generate → approve → save flow

### E2E Tests (Playwright or Cypress)
- Login → MFA → Dashboard
- Service user create → care plan → daily note
- Incident create → triage → action → resolve
- AI daily note: voice input → generate → review → approve
- Rota: create shift → assign → claim → approve

### AI-Specific Tests
- Prompt output validation (Zod)
- Structured output parsing
- Cost control enforcement
- Budget limit enforcement
- Provider fallback behaviour
- Recommendation approval workflow

---

# 28. Success Metrics

## 28.1 Documentation

| Metric | Target |
|---|---|
| Time to complete daily note | 50% reduction |
| AI draft approval rate (no major edits) | > 80% |
| Missing-field reduction | 60% |
| Documentation completion rate | > 95% |

## 28.2 Compliance

| Metric | Target |
|---|---|
| Overdue compliance items | 70% reduction |
| Expired evidence | Zero |
| Time to prepare for inspection | 60% reduction |
| Action-plan completion rate | > 90% |
| Readiness-score improvement | +15 points |
| False-positive alert rate | < 10% |

## 28.3 Operations

| Metric | Target |
|---|---|
| Unfilled shifts | 50% reduction |
| Agency spend | 30% reduction |
| Overtime | 25% reduction |
| Staffing-rule breaches | Zero |
| Time to produce rotas | 70% reduction |

## 28.4 Safety and Quality

| Metric | Target |
|---|---|
| Missed follow-up actions | Zero |
| Repeated incident detection | > 90% captured |
| Medication-record discrepancies | 80% reduction |
| Care-plan review completion | > 95% |
| Alert acknowledgement time | < 4 hours (average) |

## 28.5 AI Quality

| Metric | Target |
|---|---|
| Approval rate | > 80% |
| Edit distance (AI draft vs final) | < 20% |
| Incorrect output rate | < 5% |
| Unsafe suggestion rate | < 1% |
| Hallucination rate | < 2% |
| User feedback score | > 4.0/5.0 |
| Tool-call failure rate | < 2% |
| Cost per completed workflow | Within budget |
| Model latency (p95) | < 10 seconds |

---

# 29. Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| AI generates inaccurate care documentation | High | Medium | Human-in-the-loop required; structured output validation; source citations |
| AI misses safeguarding concern | Critical | Low | AI is advisory only for safeguarding; mandatory human review; explicit disclaimers |
| API cost overrun | Medium | Medium | Hard budget caps; per-org limits; usage alerts; provider routing to cheaper models |
| Model provider outage | Medium | Medium | Provider fallback; graceful degradation; cached responses |
| Prompt injection attack | High | Low | Input sanitisation; system prompt isolation; output validation |
| Cross-tenant data leakage | Critical | Low | Tenant isolation enforced at every tool; RLS in future; regular audits |
| Staff over-reliance on AI | Medium | Medium | Training; "AI-generated" labels; approval required; regular audits |
| GDPR non-compliance | Critical | Low | DPIA before deployment; DPA with providers; data minimisation; audit logs |
| Regulatory change (CQC AI guidance) | Medium | Medium | Modular framework design; regulator-agnostic architecture |
| User resistance to AI | Medium | Medium | Start with advisory mode; demonstrate value; gather feedback; iterate |
| Event system overload | Medium | Low | Rate limiting per org; batch processing; monitoring |

---

# 30. Decisions Still Required

## Product Decisions

| # | Decision | Options | Recommendation |
|---|---|---|---|
| 1 | Mission Control: new page or enhanced dashboard? | New page / Enhance existing DashboardPage | New page (separate concerns) |
| 2 | Voice transcription: browser-only or Whisper API? | Browser Web Speech API / OpenAI Whisper / Both | Both (browser primary, Whisper fallback) |
| 3 | Knowledge retrieval: when to add pgvector? | Phase 1 / Phase 2 / Skip | Phase 2 (after event engine proven) |
| 4 | AI autonomy default for new orgs? | Advisory / Draft / Controlled | Draft (balance of safety and utility) |
| 5 | Family summaries: auto-generate or on-demand? | Auto / On-demand / Both | On-demand with staff review |
| 6 | Daily briefing: push notification or pull only? | Push / Pull / Both | Pull (Mission Control page) with push for critical items |
| 7 | Pricing: AI features per-user or per-org? | Per-user / Per-org / Per-feature | Per-org with usage caps |
| 8 | E-learning priority relative to AI? | Before AI / After AI / Parallel | Parallel (different teams) |
| 9 | Should AI be available to CARE_WORKER role? | Yes (limited) / No / Configurable | Configurable per org |
| 10 | How to handle AI provider data processing agreements? | OpenAI only / Anthropic only / Both | Both (org chooses provider) |

## Technical Decisions

| # | Decision | Options | Recommendation |
|---|---|---|---|
| 1 | Event delivery guarantee? | At-least-once / At-most-once / Exactly-once | At-least-once (idempotent consumers) |
| 2 | Background worker: in-process or separate? | In-process / Separate container | In-process initially (separate if needed for scaling) |
| 3 | AI output storage: full result or references? | Full JSONB / References only | Full JSONB for audit, references for large outputs |
| 4 | Knowledge indexing: real-time or batch? | Real-time / Batch (hourly/daily) | Batch (hourly) initially |
| 5 | Should agents share conversation context? | Yes / No / Limited | No (stateless per request) |
| 6 | AI response caching? | Yes / No | Yes (for identical inputs within TTL) |
| 7 | Structured output: function calling or JSON mode? | Function calling / JSON mode / Both | Both (provider-dependent) |

---

# 31. Assumptions

1. The existing Express modular monolith architecture will be preserved. No microservices extraction planned.
2. PostgreSQL remains the primary database. No migration to a different RDBMS.
3. Redis remains the caching layer. No migration to Memcached or similar.
4. OpenAI and Anthropic remain the primary AI providers. No immediate need for local/on-premise models.
5. The existing Zod validation pattern will be extended to all AI structured outputs.
6. The existing audit log pattern will be extended to all AI interactions.
7. The existing notification system will be used for AI alerts (no separate alerting system).
8. Browser-native Web Speech API remains the primary voice input method, with Whisper API as server-side fallback.
9. The existing Stripe billing integration will be extended for AI feature entitlements.
10. The existing Docker infrastructure will be extended (not replaced) for new components.
11. The existing CI pipeline will be extended to include new test types.
12. All AI features will be opt-in per organisation (no forced AI adoption).
13. AI-generated content will never override human decisions without explicit approval.
14. The platform will remain UK-focused but architecturally regulator-agnostic.

---

# 32. Immediate Next Actions

| # | Action | Owner | Priority |
|---|---|---|---|
| 1 | Review and approve this blueprint | Product Owner | Critical |
| 2 | Prioritise Phase 0 items (production hardening) | Engineering Lead | Critical |
| 3 | Design event outbox schema and worker | Backend Engineer | High |
| 4 | Implement structured-output validation for existing AI endpoints | Backend Engineer | High |
| 5 | Add AI-generated-content labels to daily notes | Frontend Engineer | High |
| 6 | Fix missing Zod validation on incident triage endpoint | Backend Engineer | Medium |
| 7 | Wire unused prompts (visit_note_care_plan_gap, competency_assessment_assistant) | Backend Engineer | Low |
| 8 | Add Whisper API integration for server-side transcription | Backend Engineer | Medium |
| 9 | Design Mission Control page layout | Product + Frontend | Medium |
| 10 | Create DPIA for AI features | Compliance | High |

---

# Appendix A: Complete Database Table Count

**108 unique tables** across two creation mechanisms:
- `schema.sql`: 57 core tables (run on every startup)
- `setup.ts` migrations: 51 additional tables (IF NOT EXISTS)

# Appendix B: Complete API Endpoint Count

**484 endpoints** across 41 modules, mounted at 43 paths in `index.ts`.

# Appendix C: Complete Frontend Page Count

**78 page components** across 38 subdirectories + 3 root-level files, mapped to **77 routes** in `App.tsx`.

# Appendix D: Complete Zod Schema Count

**154 exported validation schemas** (143 explicit `z.object()` + 11 `.partial()` derived) in a single `schemas.ts` file (1,331 lines).

---

*This blueprint is the authoritative reference document for future engineering work on CareDesk. It should be updated as implementation progresses and decisions are made.*
