# MeticleCare: AI-First Care Operating System Blueprint

## Version 2.1 — Competitive review, 6 October 2026

### Change Summary

Adds a sourced competitive review of AIM (WeAim), evidence-qualified differentiators, and a prioritized capability response. The July 2026 counts and implementation notes below are a historical inventory, not a current system-of-record; current capability claims must be checked against `docs/PUBLIC_SITE_CAPABILITY_MATRIX.md`, `docs/AI_PRODUCT_ROADMAP.md`, `PRODUCT.md`, the focused blueprints, and the implementation. This document is a product direction, not customer traction or independent validation of vendor claims.

---

# 1. Product Goal

MeticleCare is a multi-tenant care management platform, with supported living as a core operating model, that is evolving toward:

> **The AI Operating System for Care Providers**

This is a product vision, not a statement that every capability below is shipped. Current shipped scope and constraints are distinguished in `docs/AI_PRODUCT_ROADMAP.md` and `docs/PUBLIC_SITE_CAPABILITY_MATRIX.md`.

The platform should help care organisations:
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

These are integrated capabilities within the main MeticleCare platform, with clear module boundaries, permissions, subscription controls and audit records.

---

# 2. Product State Baseline (July 2026 — Historical Snapshot)

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

## 2.5 Infrastructure (July 2026 Historical Inventory)

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

## 2.6 Testing (July 2026 Historical Inventory)

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
| Multi-tenancy | Historical July snapshot: helper-based; current project status records request-scoped context and PostgreSQL RLS. Verify the live policy set and migrations before describing coverage. |
| Billing | Stripe auto-provisions on first use; test mode allowed in dev |
| Manager self-approval | Manager cannot self-approve leave; manager/admin leave routes to different ORG_ADMIN; fallback to any ORG_ADMIN |
| Rota Planner | Location-based min safe staffing, compliance block on assign, view-only for non-`scheduling:edit` |
| Rest enforcement | 11-hour rest enforced for OT; conflicting shifts blocked |
| Duplicate handling | Duplicate manager delegations → 409; notifications on OT + dept/team assignment |
| Email | Branded HTML templates, queue with retry (DB-backed inbox) |
| Error display | Inside modals (not behind); tables paginated; buttons have loading spinners |
| Guard | `npx tsc --noEmit` in both `apps/web` and `apps/api` |
| Voice input | Browser-native Web Speech API (en-GB), no server-side transcription |
| AI content | Documented source-linked intelligence is labelled AI-assisted and human-reviewed; audit older AI routes and saved-record surfaces before claiming product-wide labelling. |

---

# 4. Current Architecture

> Historical snapshot (July 2026): the module/page/table counts and technology inventory below are not a current implementation manifest. Resolve drift against the repository and current status docs before using these lists for planning.

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

## 4.3 Tech Stack (July 2026 Inventory; Verify Before Reuse)

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + MUI 5 + TanStack React Query + React Router 6 |
| Backend | Node.js + Express + TypeScript (modular monolith) |
| Database | PostgreSQL 15 (raw SQL via pg pool, no ORM) |
| Cache | Redis with in-memory fallback |
| Realtime | Socket.IO v4 with JWT auth + DB validation + rate limiting |
| Auth | JWT access + refresh tokens, MFA (TOTP/speakeasy), RBAC + per-request permissions |
| AI | OpenAI/Anthropic provider integrations and per-organisation config; do not claim AI provider credentials are application-encrypted without verifying the active secret-storage path |
| Validation | Zod (154 schemas) |
| Email | Nodemailer SMTP, 20+ branded HTML templates, DB-backed queue |
| Billing | Stripe (subscriptions, invoices, payment methods, webhooks) |
| PDF | Puppeteer-core for HTML→PDF generation |
| OCR | tesseract.js (installed, zero callers) |
| Infra | Docker Compose, GitHub Actions CI, Prometheus metrics, Swagger auto-docs |

## 4.4 Existing AI Infrastructure (Baseline Details Are Historical)

The exact flag count and legacy feature inventory in this table come from the July snapshot; the current intelligence surface and its guardrails are described in `docs/AI_PRODUCT_ROADMAP.md`. Verify credential storage/encryption claims against current call sites and configuration rather than relying on the historic AES-256-GCM description.

| Component | Status | Details |
|---|---|---|
| AI provider abstraction | ✅ | OpenAI/Anthropic adapters and provider selection are documented; verify the current factory and credential-handling path before relying on this historic detail |
| Per-org AI config | ✅ | JSONB in `organizations.ai_config` with per-organisation settings; production processor/transfer sign-off remains open |
| Feature flags | ✅ | Per-org `enabledFeatures[]` array with 4 flags currently defined |
| Prompt templates | ✅ | Prompt text is maintained in code; runtime prompt versioning and a customer-configurable prompt registry are not documented as shipped |
| Structured output parsing | 🟡 | Structured validation is documented for the source-linked intelligence pipeline; audit legacy routes separately before claiming every AI endpoint is schema-validated |
| AI audit logging | ✅ | `ai_audit_logs` record feature/provider/model, duration, token use and outcome; intelligence entries also retain selected dates and source references |
| AI usage stats | ✅ | Aggregated usage statistics endpoint |
| Existing AI features | ✅ | Compliance gap analysis, incident triage, rota analysis/generation, daily note generation and source-linked intelligence; see current capability matrix for boundaries |
| Unused prompts | ⚠️ | `visit_note_care_plan_gap` and `competency_assessment_assistant` defined but never called |

---

# 5. Existing AI Capabilities (Historical Baseline; Current Matrix Is Authoritative)

The following describes workflows recorded in the July inventory. Treat detailed input/output fields, flags and UI behaviour as baseline notes, not a complete current route contract; use the current AI roadmap and implementation for live scope.

## 5.1 AI Configuration (July Snapshot; Verify Secret Handling)
- Per-organisation AI settings are stored as JSONB in `organizations.ai_config`.
- Provider/model settings and feature configuration exist; the exact current feature names are not limited to the four July examples below.
- Do not treat the general AES-256-GCM utility or person-column encryption as proof that provider API keys in `ai_config` are encrypted. Verify the live write/read path and deployed secret controls before making an encryption claim.
- Settings > AI exists; production provider use remains gated on legal processor/transfer agreements.

## 5.2 Compliance Gap Analysis
- Input: domain scores, key issues, regulator context
- Output: overall assessment, critical gaps with CQC statement references, quick wins, timeline
- Used in: CQC Readiness page, Settings AI tab

## 5.3 Incident Triage
- Input: incident context within the authorised organisation scope
- Output: advisory severity classification, confidence/reasoning and suggested follow-up; regulator-notification language is nation-aware and does not decide whether a statutory notification must be made
- AI results are validated on the current structured intelligence path; audit each older endpoint independently rather than assuming uniform schema coverage
- A manager retains responsibility for triage, safeguarding decisions and any notification

## 5.4 Rota Analysis & Generation
- Input: week range, location, staffing requirements, staff roster, existing shifts, leave, contracted hours
- Output (analysis): coverage warnings, overtime risks, staffing suggestions and optimisation tips
- Output (generation): proposed rota assignments, coverage summary and warnings; a human reviews before applying, and hard server-side staffing/rest/conflict constraints remain authoritative
- Used in: Rota Planner page
- Domiciliary call recommendations separately rank carers using availability, leave/conflict, workload and a rough straight-line travel estimate; the travel-time endpoint can query OSRM with a fallback estimate. This is not yet a robust multi-stop route/continuity optimisation service

## 5.5 AI Daily Notes
- Input: staff voice/text observation + service user context (allergies, care plans, goals, baseline mood)
- Output: structured daily note, mood analysis (1-10 score + indicators), safeguarding flags, care plan updates, intervention suggestions, risk level
- Approval workflow: staff reviews, edits, approves → saves to DB with audit trail
- Used in: AI Daily Notes page

---

# 6. Current Gaps

## 6.1 Production Readiness (Reconciled 6 October 2026)

The July inventory below is stale in several material places. The repository's current project status records versioned migrations, production Docker services, CI/CD, Redis-backed realtime, RLS, and 395 tests across 44 modules. Do not present those older gaps as current. The remaining operational evidence gaps to verify are:
- Monitoring: Prometheus metrics and Uptime Kuma are deployed. The repository cannot verify that uptime monitors and phone alert contacts are configured and have passed a test; Grafana dashboards/Prometheus alert rules are not recorded as implemented (`docs/GO_LIVE_READINESS.md`, T0-4).
- Backup and recovery: require a successful, documented restore rehearsal and recovery objectives before making resilience promises.
- Release evidence: validate current end-to-end pilot and external payroll-provider round trips against the live target environment.

## 6.2 Tenant Isolation

Implemented using request-scoped tenant context, dual database pools and PostgreSQL row-level security policies. Continue to treat tenant-scoped query and migration tests as release gates, especially when adding tables or background jobs; this is an implementation control, not a certification claim.

## 6.3 AI Gaps (Current, Evidence-Limited)

MeticleCare already has configured AI workflows and a source-linked intelligence surface. The current capability matrix and AI roadmap describe date-bounded outputs with source references, audit records, schema validation, human review, organisation scoping and deterministic signals. Important qualification: the live readiness tracker records that production LLM processing remains blocked on the legal processor/transfer agreement even though the approved-processor gate exists. Legal sign-off is a release prerequisite, not an advantage over AIM until closed. The remaining product gaps are narrower and more consequential than the July list suggested:
- No general intent/tool/action layer that safely turns natural-language requests into permission-checked, reviewable cross-module drafts; current assistants are bounded workflows, not autonomous operators. The existing event outbox/worker and several alert/triage consumers are implemented, but do not yet amount to a broad, user-configurable agent action/approval queue. Prompt version management also remains on the roadmap; prompts are currently maintained in code.
- No continuously running, clinically validated deterioration predictor. Change/risk signals are bounded to selected records and periods; there is no learned baseline or validated early-warning model.
- No AI drafting workflow for care plans and risk assessments comparable to the competitor's public examples; daily-note assistance exists, but generated clinical content must remain reviewable and must not change care or medication instructions.
- No full organisational knowledge/RAG layer with version-aware policy citations; source-linked operational records are not equivalent to policy retrieval.
- No persistent prompt evaluation/versioning system or production-quality feedback/evaluation loop documented as complete. Current code has per-organisation enablement, monthly token/cost caps, processor approval gate and structured validation on the source-linked intelligence path; general prompt version management and feedback capture remain proposals, not shipped capabilities. Legacy endpoint validation should be audited independently.
- The natural-language assistant still needs an explicit query-intent layer; it receives a bounded source set and must not gain arbitrary SQL access.
- Browser speech is available; a managed server-side transcription fallback is not documented as shipped.

Do not restore the former blanket claims that structured output validation, AI labelling, audit logging, budgets or all event infrastructure are absent: those conflict with current product evidence. See `docs/AI_PRODUCT_ROADMAP.md` and `docs/PUBLIC_SITE_CAPABILITY_MATRIX.md` for qualifications and hardening work.

## 6.4 Missing Features and Capability Boundaries (Non-AI)

- E-learning/LMS integration (SCORM/xAPI) and accredited course catalogue.
- General electronic-signature workflow for care plans, family consent, contracts and policies. A `digital_signature` field on training records is not a general e-signature product or evidence of a signed care document.
- External DBS-check provider integration (for example GBG/uCheck); the DBS lifecycle module is not itself a live provider connection.
- SMS delivery; email, in-app notifications and selected web-push flows exist, but no SMS provider/sender/consent operation is approved.
- Physical printing integration (for example PrintNode).
- A versioned document workspace with signature requests, review/approval lifecycle and family-facing sign-off; existing document/evidence uploads do not provide that complete lifecycle.
- Family Portal finance access and family-facing invoice/payment workflows.
- Supported-living mobile experience; see the explicitly unbuilt requirements and role-gate findings in `docs/MOBILE_SUPPORTED_LIVING_BLUEPRINT.md`.
- Productized staff 1-to-1/supervision records with action and review scheduling.
- Recruitment applicant pipeline, lead CRM, sales follow-up and marketing campaign automation. Treat these as an adjacent-suite decision, not assumed core care-record scope.
- Advanced multi-stop travel-time/continuity optimisation comparable to AIM's public description; supported-living drag-and-drop rota scheduling (the domiciliary call-assignment board already supports drag/drop).
- Managed, repeatable legacy-data migration with a documented scope, reconciliation and customer sign-off.
- Homecare timesheet approval, approved-only payroll exports and reconciliation exist; remaining gaps are validated external provider round trips and statutory payroll processing (which remains outside the product's current payslip/export boundary). See the competitive benchmark below.

> **Mobile, supported living.** The shipped mobile app is domiciliary-oriented: its data layer calls `/homecare/*`, which is mounted behind `requireDomiciliaryOnly`. The supported-living capability and role-gate gaps—including shift attendance/handover and support-worker incident/task paths—are specified in `docs/MOBILE_SUPPORTED_LIVING_BLUEPRINT.md`. Verify each route against the current branch before release; do not describe this app as a supported-living field workflow until the blueprint's backend and mobile acceptance criteria pass.

## 6.5 Competitive Readout

Against AIM's public positioning, MeticleCare's strongest defensible advantages are its supported-living operating model, enforced scheduling/permission boundaries, four-regulator architecture and source-linked, audited, human-reviewed intelligence. Its clearest gaps are end-to-end conversational action workflows, sophisticated travel/continuity-aware optimisation (despite existing basic homecare suggestions and travel estimates), supported-living drag/drop scheduling, general electronic-signature/document lifecycle, multi-channel family/staff messaging, managed migration and adjacent recruitment/sales/marketing automation. The full evidence table and response priorities appear later in this roadmap. These are product comparisons, not claims that AIM lacks a feature: absence from a public page is not proof of absence in its product.

---

# 7. AI-First Product Vision

## 7.1 Core Principle: AI as Horizontal Intelligence Layer

AI must not remain an isolated module. It should become a horizontal intelligence layer operating across the platform.

**Target AI Infrastructure** (centralised design, not all shipped):
- Organisation-scoped AI provider/configuration, feature enablement and monthly usage caps exist.
- Prompts are maintained in code; a runtime version registry, general model-routing console and shared agent/action framework are not documented as shipped.
- Audit records and provider fallback exist; legal processor/transfer agreements remain a production gate, and a general consent/governance workflow is not established by this blueprint.

**Domain AI Capabilities** (distributed; shipped scope is bounded):
- Incident intelligence → incidents module
- Medication intelligence → emedication module
- Rota intelligence → scheduling module
- Care-plan intelligence → service-users module
- Compliance intelligence → compliance/CQC/training/competency/policies
- Documentation generation → available within each relevant workflow

## 7.2 AI Operating Model (5 Levels)

This is a target-state capability ladder, not a checklist of shipped features. The current implementation is narrower: bounded AI workflows and source-linked intelligence are available behind organisation controls; the shared agent/action framework, autonomous workflows and many drafting examples below are proposals. See §6 and `docs/AI_PRODUCT_ROADMAP.md` for current scope.

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
AI creates structured drafts using existing MeticleCare information.
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

### Level 3: Event-Driven Signals and Intelligence
Implemented event consumers can react to selected events (including incident triage, missed/late medication, low stock, unfilled/understaffed shifts and expiry/review events); the `/intelligence` surface also computes selected date-bounded, rules-first signals. This is not comprehensive continuous monitoring, statistical anomaly detection or a validated clinical early-warning service. Extend event coverage and source-backed rules incrementally, with owners and tests per signal.

Potential coverage (not all currently implemented):
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

### Level 4: Validated Prediction and Decision Support (Future)
No learned prediction or validated clinical deterioration model is documented as shipped. Consider future statistical/model estimates of risk or operational demand only after the data-quality, bias, explainability, held-out validation, clinical-safety and monitoring prerequisites in §19.3 are met.
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

### Level 5: Controlled Automation (Future, gated)
The current autonomy default is **advisory**. Existing workflows may create reviewed records (for example, an approved daily note), and event consumers can create defined alerts or triage outputs; a generic action/approval queue and organisation-configurable agent automation are not shipped. Any future low-risk automation requires explicit organisation opt-in, role/permission checks, immutable audit evidence, idempotency, limits, monitoring, an undo/compensation path where practical and a clear human owner.
- Create a draft task
- Schedule a review reminder
- Send an internal notification
- Prepare a draft action plan
- Request missing documentation
- Add an item to a manager's approval queue
- Generate a draft evidence pack
- Send approved training reminders
- Escalate an overdue action through configured workflows

**High-risk decisions must never be fully autonomous.** Regardless of any future low-risk automation opt-in, the system must not independently:
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

## 8.1 Current State and Remaining Scope

The PostgreSQL domain-event outbox, consumer registry, retry handling and in-process worker are implemented, with selected production consumers registered for incident triage, medication exceptions, Mission Control alerts and related operational events. The current source of truth is `apps/api/src/modules/events/` and the consumer registry. Coverage is partial: not every event in the proposed catalogue below is published or consumed, and the engine does not itself provide an AI recommendation/approval queue or general cross-module action orchestration.

Further intelligent workflows require additional event coverage, narrowly scoped consumers, idempotency, org context, and monitoring/retry evidence. Do not rebuild the outbox as a new project; extend and test the shipped infrastructure.

Example: A missed medication administration should trigger checks across medication safety, incident management, care plan review, staffing compliance, and inspection readiness — all from a single event.

## 8.2 Domain Events

### Target Event Catalogue (Not All Published)

The catalogue is a design inventory. Only selected events currently have production publishers/consumers; event names and trigger descriptions below do not guarantee implementation. Check the live module routes and consumer registry before planning against any event.

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

### Remaining Event-Driven Work

| Work | State |
|---|---|
| PostgreSQL outbox, worker, consumer registry, per-consumer state/retries and admin endpoints | Implemented; see `apps/api/src/modules/events/` |
| Production consumers for incident triage, medication exceptions, Mission Control alerts | Implemented for selected event types; extend coverage with tests |
| Broad event publishing across every domain mutation and complete operational coverage | Not complete; prioritize safety-relevant, owned workflows |
| General user-configurable AI action and human approval queue | Not implemented; define before attaching write tools |
| Real-time Redis fan-out / separate queue service | Not currently required; consider only if measured latency/throughput needs justify it |

### Existing Outbox Contract (Reference)

The following schema and strategy describe the original design intent, not necessarily the exact current implementation. For changes, follow the live schema and `apps/api/src/modules/events/` contracts.

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

### Shipped Outbox Semantics (Verify Against Current Code)

- `publishDomainEvent` inserts into `domain_events` through the request-scoped database client; when called inside the originating transaction, the event commits with that transaction.
- The in-process worker claims pending rows with `FOR UPDATE SKIP LOCKED` and invokes registered consumers under organisation context.
- Consumer failures are tracked and retried up to the current `MAX_PUBLISH_ATTEMPTS` (3); the earlier five-attempt/exponential-backoff description is not the live contract.
- `cleanupOutbox` deletes published events older than 90 days and processed consumer rows older than 30 days; it does not archive rows as the earlier design text claimed.
- Consumers must remain idempotent because retries and multi-instance delivery can repeat work. See `apps/api/src/modules/events/events.outbox.ts` and `events.worker.ts` for implementation truth.

### Technology Comparison (Original Design Options)

The comparison below records architectural alternatives, not a schedule. The PostgreSQL outbox/worker is already implemented; add a separate queue or real-time fan-out only in response to measured operational need.

| Technology | Pros | Cons | Current position |
|---|---|---|---|
| PostgreSQL outbox + worker | Transactional persistence, retryable delivery, no separate broker | Polling overhead; not a real-time guarantee | ✅ Shipped; extend and measure |
| In-process EventEmitter | Simple, fast | Lost on restart, no persistence | ❌ Not a substitute for the durable outbox |
| Redis pub/sub | Low-latency fan-out | No persistence/retry by itself | Not required by current evidence; add only for a measured realtime use case |
| BullMQ | Mature retries, delays and priorities | New dependency and operational surface | Reassess only if current worker limitations are measured |
| RabbitMQ | Full AMQP routing | Additional operational complexity | No current requirement established |
| Kafka | High throughput and replay | Significant complexity | No current requirement established |

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

The roles and responsibilities below are conceptual product boundaries, not a registry of deployed autonomous agents. Shipped AI capabilities are bounded endpoints listed in `docs/AI_PRODUCT_ROADMAP.md`; several examples below remain future workflows.

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

Target sources for a future organisational knowledge layer (not evidence that a full RAG/indexing service exists today):
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

## 10.3 Retrieval Strategy (Future Design)

A full organisational search/index and general-purpose tool-calling layer are not documented as shipped. Current intelligence endpoints use bounded, tenant-scoped record sets; do not infer that the capabilities below are available as a general service.

| Capability | Intended use | Current position |
|---|---|---|
| PostgreSQL full-text search | Keyword search across approved documents | No general AI knowledge-search service is documented as shipped |
| pgvector / hybrid search | Semantic and keyword retrieval | Future option; decide only after retention, deletion, permissions and processor terms are resolved |
| Record-level metadata filters | Scope by organisation, location, role and person | Tenant/RBAC checks exist for current AI source paths; extend and test per endpoint |
| Document chunking/version control | Search current approved document sections | Future capability; source freshness and superseded-version handling required |
| Structured-data retrieval | Read operational records | Bounded source retrieval exists in intelligence endpoints; generic agent tools are not shipped |
| Tool calling | Invoke narrowly-scoped module actions | Proposed only; writes require permissions, validation, audit and explicit human approval |

**Key principle:** Live structured data should normally come from authoritative module services. Any future document/vector search is supplementary and must respect source permissions, versions, deletion and tenant scope.

---

# 11. AI Tool and Action Framework

## 11.1 Proposed Tool Registry

This registry is a target design, not a shipped general-purpose agent tool framework. Current assistants use bounded, permission-checked source retrieval and do not execute arbitrary SQL; cross-module write tools and the approval system below remain unimplemented. Any future agent interaction with MeticleCare data must use approved, tenant- and role-scoped interfaces rather than unrestricted database access.

### Candidate Read Interfaces (Not a Live API Contract)

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

### Candidate Write Tools (Not Implemented)

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

### Proposed Tool Schema Template

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

## 12.1 Current Surface and Vision

A Mission Control page/surface and event-backed alerts exist. This section describes desired manager outcomes and candidate widgets, not a guarantee that each metric, insight, workflow or control listed is implemented. Check the current dashboard and mission-control APIs before treating a row below as shipped.

Mission Control is an enhanced manager workspace that aims to answer:
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

### Daily Briefing (Illustrative)
```
"Good morning. Three items require urgent review:
1. Friday night shift is below safe staffing level
2. 5 care plans are due this week
3. 2 medication records require attention"
```

Example only; not a live result or evidence that Mission Control currently displays each item.

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

# 13. Cross-Module Intelligence Workflows (Target Scenarios)

The scenarios below describe intended end-to-end behaviour. Existing events, alerts and AI triage cover selected steps; do not infer that each numbered sequence currently runs automatically. Verify publishers, consumers, permissions and human-review gates before presenting a workflow as live.

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

The subsections distinguish current daily-note assistance from proposed expansions. They do not imply that all listed document types or workflows are available.

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

## 15.1 Proposed Organisation-Level Autonomy Policy

The product has organisation-level AI configuration, feature enablement, budgets and an approved-processor gate. A selectable Advisory/Draft/Controlled autonomy-level setting and generic action permissions are not documented as shipped; advisory, user-reviewed behaviour remains the safe default. Existing workflows may save records after human review; this policy ladder does not disable those established workflows.

| Target level | Permitted behaviour | Boundary |
|---|---|---|
| **Advisory Only** | Analyse, suggest, answer questions; existing bounded workflows can proceed through their own human-reviewed save path | No new autonomous cross-module writes or unattended action |
| **Draft Mode** | Produce a draft in a supported workflow | Human must review/approve before saving or sharing |
| **Controlled Automation (future)** | Only explicitly approved, low-risk actions under organisation opt-in | No high-risk action without approval; require role/permission checks, audit, idempotency, limits, monitoring and undo/compensation where practical |

## 15.2 Feature-Level Controls

Organisation-scoped feature configuration exists for selected AI capabilities. The following is a target control surface, not a list of current toggles; verify each capability against the live Settings > AI form and API:
- Voice documentation
- Incident triage
- Compliance monitoring
- Rota recommendations
- Family-summary generation
- Policy assistance
- Predictive alerts
- Automatic task creation
- Automatic internal reminders

## 15.3 Risk-Level Controls (Target Design)

Future autonomy rules may be scoped by:
- Organisation
- Location
- Module
- Role
- Risk level (low/medium/high/critical)
- Action type (read/write/notify/automate)

---

# 16. AI Governance, Safety and Compliance

## 16.1 Data Protection and AI Governance (Requirements, Not Legal Advice)

The following are governance questions and release controls, not a declaration of legal compliance. Lawful basis, special-category condition, controller/processor roles and notices depend on the provider's actual use and require qualified review.

| Area | Required control / current evidence |
|---|---|
| Lawful basis and special-category condition | Provider-specific assessment and documentation; do not assume one Article 6/9 basis applies to every organisation or workflow. |
| Data minimisation | Configurable boundary/pseudonymisation controls exist, but the readiness/claim records say the default can send narrative free text. Review the setting and payload for each enabled capability. |
| Processor agreement and transfers | Production LLM processing remains gated on the provider processor/transfer agreement (`docs/GO_LIVE_READINESS.md`, T0-17b); an approved-processor gate is not itself a signed agreement. |
| Processing location | Requests route through MeticleCare's backend; external providers may process data outside the UK. Disclose and assess actual processing/transfer terms—do not imply UK-only processing. |
| Subprocessor records | Maintain and review the processor/subprocessor register and customer-facing disclosures before production use. |
| Correction and challenge | Keep human review and correction/rejection available for supported workflows; a generic recommendation queue is not shipped. |
| Subject access and deletion | Treat AI-related records under the provider's applicable information-rights and retention processes. Do not imply automated SAR or deletion-propagation workflows absent evidence. |
| DPIA and accountability | Feature-level location DPIA exists; organisation-wide DPIA/legal assessment remains open in the go-live tracker. Complete the provider-specific assessment before deployment. |

## 16.2 Safety and Regulatory Considerations (Not a Compliance Determination)

Use these as product-design principles, not as a statement that a regulator has approved the product or that a single regulator's AI guidance applies to every UK nation/service:
- **Support, not replace:** retain qualified human decision-making for care, safeguarding, medication and statutory reporting.
- **Human oversight:** make responsibility, review and escalation explicit for each workflow.
- **Transparency:** explain where AI is used and what data it processes in language suitable for staff and affected people.
- **Safety and fairness:** evaluate errors, bias and impact in representative operational settings.
- **Security and governance:** control access, data flows, retention and incident handling.
- **Training and accountability:** ensure staff understand limitations and know how to challenge or escalate outputs.
- **Jurisdictional review:** verify current primary sources and provider obligations for the relevant regulator and nation; this blueprint is not legal advice.

## 16.3 High-Risk Contexts

The following require heightened review, qualified owners and clear warnings:
- Safeguarding
- Medication
- Capacity assessments
- Health deterioration
- Staff disciplinary decisions
- Regulatory submissions
- Care-plan changes
- Risk-rating changes
- Family disclosures

## 16.4 Safety Controls and Evidence Status

| Control | Current evidence / remaining work |
|---|---|
| AI-generated content labelling | AI-assisted labels are implemented for documented intelligence workflows; audit older endpoints and saved-record surfaces individually. |
| Human review | Required before consequential action, saving, publishing, notifying or sharing on the documented intelligence surface; do not generalise to every legacy endpoint without checking. |
| Prompt-injection protection | Treat as a required security control; verify the concrete protections and tests for each endpoint before claiming coverage. |
| Retrieval integrity and access | Tenant/RBAC-scoped retrieval is implemented for current AI source sets; a general knowledge retrieval/indexing layer is not shipped. |
| Output validation and provenance | Structured validation, date ranges and source references exist on the intelligence path; audit legacy endpoints and preserve source links. |
| Sensitive-data minimisation | Boundary controls exist, but the default may include narrative text; review enabled configuration, provider terms and payloads. |
| Prompt/model change management | Prompts live in code; no runtime prompt registry/version approval workflow is documented as shipped. Add evaluation/rollback evidence before changing models or prompts broadly. |
| Bias and quality evaluation | Maintain a governed evaluation plan and representative evidence; no independent fairness validation is claimed here. |
| AI incident response and provider outage | Provider fallback/configuration exist; verify an operational AI incident process and tested degradation path before asserting readiness. |

---

# 17. AI Audit Trail

## 17.1 Existing Audit (✅ Implemented)

The `ai_audit_logs` table includes:
- organisation_id, feature, prompt_key, prompt_tokens, completion_tokens, total_tokens
- model, provider, duration_ms, success, error_message
- created_by, request_data, response_summary, created_at

`request_data` may contain prompt/request fields; do not assume it contains only source IDs or non-sensitive metadata. Review route-specific payloads, access, retention and deletion before describing audit storage as data-minimised.

## 17.2 Audit Extensions (Not Uniformly Implemented)

For the source-linked intelligence surface, the roadmap documents user, capability, selected period/source IDs, provider/model, token use and duration in its audit trail. Before treating any field as a gap or implementing duplicate storage, compare that documented path with the live `ai_audit_logs` schema and route-specific audit payloads. Candidate extensions for workflows that need durable actions include:
- location/role and action requested
- prompt/schema version and tool calls (once a general tool framework exists)
- records accessed and structured output reference
- human edits, final saved result, and approval/rejection actor/time
- confidence/uncertainty, safety flags and correlation ID

**Privacy note:** retain only what is necessary for accountability; avoid storing full prompts or sensitive clinical text when references suffice. Apply documented access, retention and deletion controls.



---

# 18. Prompt and Model Management

## 18.1 Prompt and Model Management

| Capability | Current evidence / remaining work |
|---|---|
| Prompt storage and history | Prompt text is maintained in code and benefits from source-control history; runtime prompt versioning/registry and prompt activation workflow are not documented as shipped. |
| Organisation controls | Per-organisation AI configuration and feature enablement exist; verify exact model-selection controls against the live settings/API before relying on them. |
| Provider fallback and cost limits | Provider fallback and monthly token/cost caps are documented as implemented; keep the production processor/transfer gate closed until legal sign-off. |
| Routing by feature | Treat model routing and per-feature tuning as a design option; verify current code/config before describing it as configurable. |
| Structured output | Validated schemas are used on the source-linked intelligence path; validate remaining legacy endpoints independently. |
| Retry, timeout and quota policy | Set and test an explicit policy for each endpoint; this blueprint's historic numeric defaults are not a verified global contract. |
| Evaluation and rollback | Add persistent evaluations and tested prompt/model rollback before broad changes; code history alone is not a runtime evaluation or rollback workflow. |

## 18.2 Model Change Governance (Target Requirements)

The following are requirements for future changes, not evidence of a complete runtime workflow:
- Separate and verify development, staging and production provider configurations
- Review prompt changes before release
- Test model upgrades against representative evaluation cases
- Maintain evaluation datasets with privacy, retention and access controls

---

# 19. Predictive Analytics Strategy

## 19.1 Three Tiers

The tiers below describe an analytical roadmap, not a claim that all signals are implemented. Current intelligence is date-bounded and rules-first for selected sources; the current project matrix does not establish a learned baseline or comprehensive statistical trend service.

### Tier 1: Rules (Selected Signals Implemented)
Simple business rules — do NOT label as AI:
- Training expiry within 30 days
- Care plan overdue
- Shift below safe staffing
- Three missed administrations within seven days
- Compliance document expiring
- Policy review overdue

### Tier 2: Statistical Trends (Future / Validate Before Claiming)
Potential pattern detection across time series (not a statement of current shipped capability):
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

## 20.1 Existing and Candidate Tables (Verify Against Migrations Before Build)

The event infrastructure, `ai_audit_logs`, `organizations.ai_config`, notifications, tasks and domain records already exist. Other concepts below are optional design candidates, not implementation requests; audit current records and lifecycle needs before adding schema.

### Existing event tables: `domain_events` and `event_consumers`
Their actual fields and constraints are implemented by current event migrations. Do not use historic schema sketches as migration templates. For authoritative structure and RLS policies, inspect `apps/api/src/shared/database/setup.ts` and `apps/api/src/modules/events/`.

The shipped system already has the outbox, consumers, retry handling and worker. Extend it rather than creating duplicates.

### Runtime prompt registry (Optional candidate; not shipped)
**Why:** Support runtime prompt versioning only if code-based version history and release controls prove insufficient.
**Existing overlap:** Prompts currently live in code and source-control history.
**Design boundary:** Define approver, evaluation, rollback, tenant isolation and retention before choosing a table; do not make prompts customer-editable by default.

### `ai_recommendations` (Proposed — not implemented)
**Why:** Persist AI-generated recommendations for a durable review/approval workflow.
**Existing overlap:** Current intelligence outputs are source-linked and audited, but the general pending recommendation/approval queue described here does not exist.
**Candidate design:** Store an organisation-scoped recommendation reference, source/evidence references, allowed action, expiry/status and review actor/time. Decide schema, retention and audit boundaries only after the action lifecycle and privacy requirements are specified; enforce RLS and revalidate permissions when a reviewer acts.

### Approval history and feedback (Optional designs; not shipped)

A recommendation workflow may need durable approval history; feedback may support evaluation. First decide whether approval belongs in the recommendation lifecycle and existing audit log. Store only minimum necessary metadata; avoid a second approval table or retained clinical text without an established purpose and retention policy.

### `knowledge_documents` and `knowledge_chunks` (Candidate; not shipped)
**Why:** Index approved organisational documents for future AI retrieval.
**Existing overlap:** Person/compliance documents exist, but a version-aware AI search/index service is not documented as shipped.
**Candidate fields:** source organisation/module/entity, title/version/current state, content reference or approved text, chunk position and retrieval metadata; avoid duplicating sensitive source content unnecessarily.
**Tenant isolation and retention:** Must follow source permissions, deletion and retention; choose schema only after those requirements are approved.

### `ai_organisation_policies` (Candidate; audit current config first)
**Why:** Add governance state only if the current per-organisation config and existing governance records cannot satisfy a documented requirement.
**Existing overlap:** `organizations.ai_config` already stores provider/features, limits and configuration; do not create a parallel source of truth.
**Candidate fields:** only approved governance metadata that cannot be represented safely in existing settings; do not store legal consent, DPIA or agreement status as a substitute for formal records.
**Tenant isolation and retention:** Define with the owning governance workflow before schema design.

### `inspection_snapshots` (Candidate; audit current evidence-pack functions first)
**Why:** Preserve an inspection evidence state at a point in time if existing evidence-pack exports do not meet the requirement.
**Existing overlap:** Readiness and evidence-pack functions exist; do not claim there is no snapshot-like output without checking their implementation.
Candidate structure and retention must be selected only after auditing current exports, applicable evidence retention, legal requirements and RLS.

### `operational_briefings` (Candidate; do not duplicate existing briefing records)
**Why:** Persist briefing history only if required by product and retention needs.
**Existing overlap:** Manager briefing endpoints/surfaces exist; verify current persistence and audit before proposing another table.
**Candidate fields:** organisation/location, date, source references, generated-by and review acknowledgement—only if persistence is a validated product need.
**Tenant isolation and retention:** Follow existing RLS and the approved retention schedule.

## 20.2 Tables That Already Exist (Do Not Duplicate)

`domain_events`, `event_consumers`, `ai_audit_logs`, `organizations.ai_config`, `notifications`, `tasks`, `audit_logs` and current domain-record tables are existing components. Verify the live migrations before making schema changes.

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

## 21.1 Existing Event Infrastructure (Shipped)

The route list below is implemented in `apps/api/src/modules/events/events.routes.ts`; routes are authenticated and organisation-scoped. Keep its live interface authoritative.

| Endpoint | Method | Module | Description |
|---|---|---|---|
| `POST /events/publish` | POST | events | Internal: publish pending events from outbox |
| `GET /events/pending` | GET | events | Internal: list unpublished events |
| `POST /events/retry/:id` | POST | events | Internal: retry failed event publish |
| `GET /events/correlation/:id` | GET | events | Internal: get all events in a correlation chain |

## 21.2 Proposed AI Governance and Review Endpoint Extensions

Organisation-scoped AI settings, feature controls, data-minimisation settings, prompt disclosure and monthly budgets already exist through `/ai/config`, `/ai/data-minimisation` and `GET /ai/prompts`; audit/usage APIs also exist. The durable recommendation review flow is new. A runtime prompt-version API and generic feedback API are optional designs; no separate `/ai/governance` endpoint is proposed because it would duplicate existing settings surfaces.

| Candidate endpoint | Method | Module | Permission | Description |
|---|---|---|---|---|
| `GET /ai/recommendations` | GET | ai | ORG_ADMIN, MANAGER | List authorised, pending recommendations |
| `POST /ai/recommendations/:id/approve` | POST | ai | ORG_ADMIN, MANAGER | Approve an allowed action with revalidation and audit |
| `POST /ai/recommendations/:id/reject` | POST | ai | ORG_ADMIN, MANAGER | Reject/dismiss with reason and audit |
| `POST /ai/prompts/versions` | POST | ai | ORG_ADMIN | Optional runtime prompt-version workflow; existing `GET /ai/prompts` only discloses current templates |
| `POST /ai/feedback` | POST | ai | Role-scoped | Optional feedback capture after purpose, access and retention are defined |

## 21.3 Candidate Knowledge Layer (Not Shipped)

Candidate endpoints below are sketches only; do not add them until policy/document search requirements, retention, deletion, provider processing and existing search APIs have been reviewed.

| Candidate endpoint | Method | Module | Permission | Description |
|---|---|---|---|---|
| `POST /knowledge/search` | POST | knowledge | Role-scoped | Search approved organisational knowledge with exact citations |
| `POST /knowledge/index` | POST | knowledge | ORG_ADMIN | Trigger permission-aware indexing of approved documents |
| `GET /knowledge/status` | GET | knowledge | ORG_ADMIN | Index health and statistics, with no sensitive content exposure |

## 21.4 Mission Control API (Existing Interface)

Mission Control surfaces and event-backed alerts are shipped. Do not add these speculative route names; use the current `/mission-control/summary`, `/alerts` and related implemented API contracts, and extend them only for an identified gap.

## 21.5 Candidate AI Endpoint Extensions (Check Existing `/ai/*` Routes First)

The intelligence API already includes care summaries, manager/end-of-day briefings, change/risk/compliance signals, operational assistance, rota alternatives, competency coaching and manager-reviewed family communication drafts. Do not add duplicate endpoints for those capabilities. Potential new APIs should be limited to validated roadmap work:

| Candidate capability | Status | Boundary |
|---|---|---|
| Care-plan/risk-assessment drafting | Not documented as shipped | Draft-only, source-linked, preserve prior version and require qualified human approval |
| Handover/incident structured-draft expansion | Existing incident triage and note workflows are not equivalent to a complete drafting lifecycle | Add only if user research identifies a need; preserve original and role-scope source evidence |
| Persistent recommendations and approvals | Not shipped | Permission-checked, durable, auditable and idempotent; no silent writes |
| Version-aware policy Q&A | Not shipped | Approved current sources only, tenant/RBAC scoped with exact citations and retention controls |
| Clinical or staffing prediction | Research/future | Separate validation, safety and monitoring programme; never market as a current endpoint |

---

# 22. Frontend/UX Changes

## 22.1 AI Daily-Note Assistance (Existing; Verify UI Details)

AI-assisted daily-note generation and review are documented as existing. Browser-native speech input is available; do not assume every listed field-level extraction or saved-record provenance feature is present across all note workflows.

Potential enhancements:
- Evaluate a governed server-side transcription fallback (not shipped)
- Show field-level provenance from the staff's original words
- Add batch/history views only if validated by user research and retention requirements

## 22.2 Mission Control (Existing Surface; Enhancements Proposed)

The manager-facing Mission Control surface and event-backed alerts already exist. Candidate improvements, subject to verifying existing widgets and APIs:
- Expand operational and compliance source coverage
- Add route-aware source drill-down for signals that currently expose IDs only
- Build a durable AI recommended-actions queue with approve/edit/dismiss (not shipped)
- Add real-time updates only where measured latency/user needs justify them

## 22.3 AI Recommendation Queue (Not Shipped)

New page or sidebar widget:
- List of pending AI recommendations
- Priority-sorted (critical → informational)
- Each item shows: reason, evidence, suggested action, owner
- Approve / Edit / Dismiss / Assign controls
- Filter by agent type, priority, date

## 22.4 AI Governance Settings (Existing Configuration; Extensions Proposed)

The Settings > AI area and organisation-scoped AI configuration/feature controls exist. These proposed additions are not all documented as shipped: a selectable autonomy level, DPIA status workflow, consent recording and configurable AI-retention policy. Reconcile each against the live settings API before building or marketing it.

## 22.5 Organisational Knowledge Search (Not Shipped)

Future component (available in sidebar or as a global search enhancement):
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
- Keep `npx tsc --noEmit` passing in both `apps/web` and `apps/api` as a release guard (not a check run for this document-only update)

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

## 23.2 Alert Controls (Target Requirements; Not All Shipped)

Selected event-backed alerts, notifications and acknowledgement/assignment flows exist. The table is a target-state checklist; it does not assert that each control is implemented. Map and test each row against the current `alerts` and `notifications` modules before planning work.

| Feature | Target behaviour |
|---|---|
| Deduplication | Idempotent, event-key-based dedupe where a signal is retried |
| Alert grouping | Group related items only where the existing UI and data model support it |
| Cooldown periods | Configure by alert type where operationally needed; no universal four-hour rule assumed |
| Escalation | Define an owner, timing and tested delivery channel per safety-relevant alert |
| Snoozing | Optional, with due-time and accountability visible |
| Assignment | Keep assignment permission-checked and auditable |
| Acknowledgement | Provide acknowledgement for actionable alerts where required |
| Resolution | Record resolution evidence and actor for supported alert types |
| Dismissal reasons | Capture a reason where dismissal is supported and safety-relevant |
| Feedback/evaluation | Capture feedback only with a retention/privacy plan; no automatic model learning is implied |
| Location-level routing | Apply only where the user's authorised location scope is known |
| Role-based routing | Route according to configured responsibility, not hardcoded regulator or job assumptions |
| Digest mode | Offer only if validated against urgency and delivery needs |
| Urgent mode | Use a tested channel and escalation owner for critical items |

---

# 24. Feedback and Continuous Improvement

## 24.1 Proposed User Feedback Mechanism (Not Shipped as a General Loop)

A future feedback control could offer:
- 👍 Helpful
- ❌ Incorrect
- 📝 Missing context
- ⚠️ Unsafe suggestion
- 🔁 Duplicate alert
- 🏷️ Wrong priority
- 🏷️ Wrong category
- ✏️ Poor wording

## 24.2 Feedback Data (Future; Not a General Capture Workflow)

If a feedback workflow is built, capture only the minimum approved information needed for evaluation, such as feedback category, capability, timestamp and a source reference. Do not default to retaining full original output, user corrections or clinical content; define purpose, access, retention and deletion first.

## 24.3 Governed Use

- Build evaluation cases from reviewed, permissioned evidence
- Track quality and safety trends without reusing sensitive customer data to train external models
- Compare models only under an approved test protocol
- Assess bias and errors with representative data; do not imply dismissal feedback automatically changes model behaviour

**Privacy:** Do not automatically use sensitive customer data to train external models without explicit contractual and organisational approval.

---

# 25. Commercial Packaging

## 25.1 Proposed Packaging (Not a Published Offer)

The following tier boundaries are commercial hypotheses, not approved pricing or a statement that every listed capability is available as a purchasable SKU. Separate currently enabled features from roadmap items and validate price/seat definitions before customer-facing use.

### MeticleCare Core
- Core care management (service users, care plans, daily records)
- Staff management
- Incidents
- Scheduling
- Basic compliance
- Tasks
- Notifications
- Mobile (GPS check-in, voice notes)

### MeticleCare Intelligence (Proposed Bundle)
- Existing AI daily-note assistance and configured, bounded intelligence capabilities
- Source-linked care summaries, manager briefings, risk/change/compliance signals
- Advisory AI rota analysis and alternatives
- Additional drafting and policy search only when delivered and governed; not all are shipped today

### MeticleCare Compliance (Proposed Bundle)
- Existing readiness, evidence mapping and bounded compliance signals
- Evidence-gap analysis with jurisdiction-specific caveats
- Policy intelligence and automated action plans only if separately built and approved
- Frameworks named in product architecture include CQC, CIW, Care Inspectorate Scotland and RQIA; individual framework content has unresolved source qualifications in `docs/CLAIM_REGISTER.md`, so verify it before sale
- Existing DSPT assessment workflow; completion/submission is not implied

### MeticleCare Operations Intelligence (Proposed Bundle)
- Existing selected staffing and operational signals, manager briefings and Mission Control
- Proposed deeper overtime/travel/continuity analysis and suitable-worker recommendations
- Agency forecasting and autonomous resource optimisation are not current capabilities

## 25.2 Commercial and Entitlement Decisions

| Feature | Current position / proposed work |
|---|---|
| Feature flags | Per-organisation AI feature enablement exists; verify current field/API rather than assuming `enabledFeatures[]` shape |
| Subscription entitlements | Existing Stripe subscription; map proposed AI bundles to entitlements only after commercial approval |
| Usage limits | Per-organisation monthly token/cost caps are documented as implemented; do not propose duplicate budget tables without a measured need |
| Add-on options | Commercial hypothesis; validate price, active-seat definition and included capabilities before sale |
| Trial controls | Not asserted as shipped; define only after billing and support requirements are agreed |
| Provider-cost protection | Existing monthly caps; test enforcement and keep the processor/transfer gate for production providers |

---

# 26. Phased Roadmap

## 26.0 Phase 2 — Multi-Service Care Platform (Commercial and Operational Expansion)

MeticleCare is evolving from a supported-living-focused platform into a multi-service care management system. Organisation-level service-type configuration and service-aware navigation/onboarding exist; treat the July-listed types, per-location granularity and pricing behaviour as historical claims to verify against current schemas and UI before quoting them as universal product coverage.

### Organisation type-aware provisioning (implemented foundations; exact scope verify)

| Component | Current evidence / caveat |
|---|---|
| Service model | Organisation-level service-type configuration exists; verify current schema and service options before quoting historical field details |
| Sign-up/onboarding | Service-aware setup exists; step count and each service-specific pathway require current UI verification |
| Navigation | Service-aware navigation is implemented; verify every module gate for mixed-service organisations |
| Dashboard | Domiciliary visit/exception widgets exist; other per-service widgets need current route verification |
| Pricing | Service-specific pricing is a commercial proposal; verify the approved offer before asserting configuration exists |
| Location granularity | July blueprint described per-location variation; do not treat as supported without current schema/UI evidence |

### Release 2A — Homecare foundation (implemented in this increment)

| Capability | Scope | Safety boundary |
|---|---|---|
| Care packages | Person-linked package, funding source, dates, weekly hours, client rate, travel-time and mileage policy | Managers own rates and effective dates; changes are audited |
| Call patterns | Morning, breakfast, lunch, tea, evening, night, routine, medication-support and custom visit plans | A plan is not a completed care record; each actual visit is recorded separately |
| Visit schedule | Individual visits with carer assignment, scheduled start/end and status | Cross-tenant person and carer references are rejected |
| Field execution | Carer-only check-in/out with coordinates, accuracy, actual travel and mileage | Location is collected only during an assigned visit; no continuous off-duty tracking |
| Exceptions | En-route, late/missed/cancelled state and reason fields | A manager reviews exceptions; the system does not silently mark a visit complete |
| Payroll preparation | Work, travel, paid travel, mileage, configured rates and gross input per completed visit | Statutory PAYE, NI, pension, holiday pay and deductions remain with payroll integration/review |
| Approval | Manager review of submitted timesheet inputs | No self-approval; approved records retain who/when evidence |

### Release 2B — Scheduling and mobile depth (Reconciled)

- **Implemented:** recurring visit generation from call patterns for a bounded date range, idempotent generation, default-carer availability checks, overlap protection and manager-visible scheduling errors.
- **Implemented:** manager exception queue for missed/cancelled/late calls, required resolution notes and retained resolver/time audit fields.
- **Implemented:** approved-timesheet CSV export with explicit date range and approved-only filtering; this is a payroll input, not a payslip or statutory payroll calculation.
- **Implemented:** domiciliary carer mobile/PWA day route, assigned-visit execution, offline queue and explicit sync status. This is not the supported-living shift/rounds workflow specified in `docs/MOBILE_SUPPORTED_LIVING_BLUEPRINT.md`.
- **Implemented:** travel-aware reminders based on configured buffer and route estimates, plus carer disruption reporting; this is not advanced multi-stop route optimisation.
- **Implemented:** missed/late call workflow with client/family follow-up and incident linkage.
- **Implemented:** mileage claims with evidence, configurable tax-year rate tables and manager approval.
- **Implemented:** visit notes linked to person care records; informal note text does not itself evidence medication administration.

### Release 2C — Workforce and finance integration (Reconciled)

- **Implemented:** approved-only payroll CSV adapters and reconciliation ledger; validate live provider round trips before claiming integrations. Statutory payroll remains external.
- **Implemented:** manager timesheet approval, paid/travel/mileage totals and exceptions; use the current homecare payroll modules as implementation truth.
- **Implemented:** client billing package utilisation and audited draft/approve/void invoice-ready lifecycle; it does not itself charge Stripe.
- **Implemented with governance gates:** active-visit map and server-side location controls; worker-facing UX is gated on an EAS build, and an organisation-wide DPIA/legal assessment remains open.
- **Implemented:** email and selected web-push reminders/notifications. SMS remains deferred until provider, sender, consent, quiet-hours and cost decisions are approved.

### UK operating and compliance decisions before go-live

- Travel between client assignments must be treated as working time for National Minimum Wage purposes where applicable; ordinary home-to-work commuting is distinct. Every organisation must configure and review its paid-travel policy with an employment/payroll adviser.
- Mileage rates must be versioned by tax year and organisation policy; do not hardcode a single rate into payroll. HMRC advisory rates are a reference, not a universal employer entitlement.
- Domiciliary personal care may be a CQC regulated activity. The provider must confirm registration, nominated individual/registered manager responsibilities, care-plan/visit-record requirements and local safeguarding arrangements.
- GPS/location monitoring requires a documented purpose, necessity/proportionality assessment, staff transparency, working-hours boundaries, access controls, retention and a DPIA where required. It is not a covert surveillance feature.
- Package funding, client consent, capacity/best-interest decisions, lone-worker risk, medication support, travel disruption and emergency escalation require organisation-approved policy and training.

### Confirmed policy decisions (owner sign-off, September 2026)

| Decision | Owner's confirmation | Implementation status |
|---|---|---|
| Travel between clients paid | Configurable per organisation, not globally mandated | ✅ Implemented: `travel_time_paid` is set per care package at creation and drives paid-travel minutes on timesheets; HMRC/NMW treatment remains the employer's adviser-reviewed policy |
| First payroll export targets | Owner delegated research; provide five launch options | ✅ Implemented: export adapters for Sage, Xero, QuickBooks, BrightPay and Staffology, plus a generic CSV; reconciliation ledger records exported vs. reported gross per timesheet |
| Mileage rate configurability | Configurable across all available options | ✅ Implemented: `homecare_mileage_policies` keyed by tax year × vehicle type (car, motorcycle, bicycle, public transport, other) × fuel category (petrol, diesel, hybrid, electric, LPG, n/a, other), with effective dates and active flag; HMRC AMAP rates are reference values, never hardcoded entitlements |
| Per-client/per-carer pricing (internal quote) | Owner undecided; no product action yet | Quote remains hidden and internal; no billing configuration built |
| VAT treatment of future pricing | Must be configurable (inclusive vs. exclusive) | ✅ Implemented: `organizations.billing_config.domiciliary.vat_rate` + `vat_inclusive` drive client-billing VAT via exclusive/inclusive helpers with net/VAT/gross snapshot per visit line and per-run funding breakdown; registration number and statutory VAT handling remain with the provider's finance configuration |
| Mobile GPS and payroll exports as paid add-ons | Included for launch; may become paid add-ons later | Pricing model note only; no gating code until the commercial decision lands |
| Visit GPS retention | Follow industry standard | Decision: check-in/out coordinates are point-in-time evidence forming part of the immutable visit audit record, retained with the visit record per the organisation's care-records retention policy (recommended baseline: Records Management Code of Practice 2023 — adult social care records commonly 8 years after last entry); there is no continuous or off-duty tracking, so no separate short-life GPS stream exists |
| Reminder channels | All three: email, browser push, SMS — prioritise email and push | ✅ Email + web push implemented with independent retry ledgers and per-device opt-in; SMS deliberately deferred until a provider, sender identity, consent policy and cost model are approved |
| Missed/severely delayed visit procedure | Follow industry standard (CQC-aligned) | 📋 Implemented in-product as: carer reports disruption from the visit (severity "high — contact the office now") → real-time exception to the duty manager → manager attempts client/family contact and records the attempt → escalation ladder per the organisation's on-call/safeguarding policy → outcome recorded in the visit follow-up ledger (communication or incident-linked, with who/when audit); final telephone-tree and out-of-hours arrangements must be configured by each provider |
| First pilot provider | CQC-registered for domiciliary personal care | Pilot gates below apply in full, including regulated-activity record requirements |

### Commercial assumption to validate

A private domiciliary-care quote has been recorded separately for internal commercial planning. It must not appear in the product UI, public website, demo data, customer-facing documents or billing configuration until the offer is approved. Before publication or billing: confirm minimum commitment, active-seat definition, whether the quote supplements the existing plan, and whether mobile/GPS/payroll exports become add-ons.

### Definition of done for the vertical slice

A pilot is not ready until a provider can create a package, define calls, assign a carer, execute a visit on a phone, record actual travel/mileage, review a late/missed call, approve a timesheet, export payroll inputs, retrieve the audit trail and demonstrate tenant/role boundaries in tests.


## Competitive Benchmark and Product Response — AIM (WeAim)

**Evidence checked:** public pages fetched 6 October 2026: [AIM homepage](https://www.weaim.io/), [features](https://www.weaim.io/features), and [pricing](https://www.weaim.io/pricing). AIM's feature, outcome and performance statements below are what the vendor publicly says—not independently verified delivery, safety, customer results or model performance. For example, the site advertises 70% admin/staffing savings, 90% work automation and Sentinel alerts “up to 48 hours” early; the pages reviewed do not publish the evaluation method or validation evidence behind those figures. Do not repeat those numbers as established facts. Repository-side comparisons were checked against `PRODUCT.md`, `docs/PUBLIC_SITE_CAPABILITY_MATRIX.md`, `docs/AI_PRODUCT_ROADMAP.md`, `docs/MOBILE_SUPPORTED_LIVING_BLUEPRINT.md`, `docs/GO_LIVE_READINESS.md`, `docs/CLAIM_REGISTER.md`, `apps/api/src/modules/homecare/homecare.repository.ts`, `apps/api/src/modules/homecare/homecare.controller.ts`, `apps/web/src/pages/homecare/CallAssignmentBoard.tsx`, and the AI/event implementation under `apps/api/src/modules/ai/` and `apps/api/src/modules/events/`.

| Area | AIM / WeAim public position | MeticleCare: verified product position | Competitive read and missing capability |
|---|---|---|---|
| AI workflow | AIM Assist is presented as text/voice-commanded workflow automation across onboarding, care plans, medication setup, rostering, reporting, finance and compliance. | Twelve bounded intelligence capabilities are documented: source-linked care summaries, manager briefings, change/risk/compliance signals, natural-language assistance, rota alternatives, competency coaching and reviewed family drafts. They are tenant-scoped, audited, schema-validated and require human review before consequential action (`docs/AI_PRODUCT_ROADMAP.md`). | AIM presents the more unified action-taking assistant. MeticleCare's advantage is explainability and governed, review-before-action outputs. Build a permission-checked intent → draft → approval → execution layer; do not grant an LLM direct database or unsupervised clinical write access. |
| Care planning and clinical signals | AIM advertises generated care plans/risk assessments, note rewriting and “Sentinel” early infection/UTI/injury/deterioration detection. | Care plans, risk assessments, daily notes, eMAR, observations and incidents exist. AI note assistance and bounded record-based signals exist; the public capability matrix explicitly says no learned baseline, diagnosis or validated clinical predictor. AI care-plan/risk drafting is not documented as shipped. | Add staff-reviewed care-plan and risk-assessment drafting with citations and source comparison. Treat predictive deterioration as a separate clinical-safety programme: named clinical owner, lawful data governance, representative validation, false-positive/negative analysis and post-deployment monitoring are prerequisites. No “48-hour”, diagnosis or admission-avoidance claim without evidence. |
| Rota and field operations | AIM advertises prompt-generated rotas, availability/travel-time matching, continuity, drag-and-drop fine-tuning, conflict detection and missed-visit coverage. | MeticleCare has supported-living minimum staffing, rest/conflict and compliance gates; AI rota analysis/generation is advisory. The domiciliary Call Assignment Board already supports drag/drop; homecare also has recurring call generation, availability/overlap checks, offline visit execution, exceptions, basic carer suggestions and OSRM/fallback travel estimates. | AIM publicly presents a more unified travel/continuity proposition. Our homecare recommendations are a foundation, not route optimisation; the supported-living rota still lacks drag/drop. Improve multi-stop travel/continuity explanations and supported-living rota interaction, while keeping server-side staffing/rest/compliance constraints authoritative and human-confirming assignments/publication. |
| Medication | AIM advertises digital MAR, PRN/reminder handling and AI interaction warnings. | MeticleCare has eMAR charts, administration audit, PRN controls, stock/deliveries, daily counts and competency records. The implementation blocks some invalid medication states; it is not evidence of a comprehensive drug-interaction checking service. | Preserve the operational MAR depth. If interaction checking is pursued, use an appropriately licensed, maintained clinical knowledge source and a clinically governed alert policy—not free-form LLM inference. |
| Finance and payroll | AIM presents automated invoices, payroll/payslips, expenses, mileage and profit analytics. Pricing displayed AI Care Manager at £15/staff/month + VAT and AIM Business Suite at £20/staff/month + VAT, each with a minimum 12-month commitment. Annual payment advertises the first 3 months free. Migration packages displayed £950 + VAT (Standard) and £1,950 + VAT (Full); migration timing/scope depends on source exports. The page did not establish a minimum seat count. | MeticleCare supports homecare timesheet approval, approved-only exports for Sage, Xero, QuickBooks, BrightPay, Staffology and generic CSV, plus per-row reconciliation. Domiciliary client billing has an auditable draft/approve/void path. Payslips are explicitly estimates from approved timesheet data and do not calculate statutory deductions; external provider round trips still need pilot validation. | Our defensible distinction is reviewable, reconciled payroll input rather than an unqualified “automatic payroll” promise. Close provider round-trip testing and exception reconciliation; then consider accounting sync, invoice/payslip automation and margin analytics. No price leadership claim: MeticleCare has no verified public like-for-like price in this evidence set. |
| Documents and signatures | AIM advertises cloud document storage, automatic versioning, expiry tracking, digital signatures and family sign-off. | MeticleCare has person/compliance documents, evidence packs and audit records; the training-record signature field is narrow and is not a general electronic-signature workflow. | Build a document lifecycle (versions, signatory identity/intent, timestamps, immutable evidence, revocation/expiry, audit export) and connect it to care-plan/family consent only after legal and provider requirements are defined. Do not describe uploads or a text field as e-signatures. |
| Family and notifications | AIM advertises a family portal, family alerts, real-time multi-channel delivery and escalation workflows. | MeticleCare's Family Portal exposes permitted care notes, plans, goals and observations; manager-reviewed family communication drafts exist. Email, in-app notifications and selected web push are available. SMS is deferred; family finance access and automatic family communication are absent. | Add consent- and preference-aware escalation across channels, delivery receipts and family-approved scopes; keep sensitive updates human-approved. SMS requires an approved provider, sender identity, opt-in/consent, quiet-hours and cost controls. |
| Workforce and growth suite | AIM positions HR/recruitment agents, onboarding, applicant screening, sales/lead management, marketing campaigns and support as part of its broader suite. | MeticleCare has staff profiles, invitations, compliance/DBS workflows, training, competency and workforce operations; a recruitment CRM, sales pipeline and marketing automation are not evidenced. | This is a genuine breadth gap if buyers want one vendor for growth operations, but not automatically core care-management scope. Validate demand; prefer integrations/partners before building sales and ad automation into a sensitive care-record platform. |
| Migration and adoption | AIM advertises fully managed migration from other UK care systems in under 14 days, with public migration packages/prices on its pricing page. | MeticleCare has CSV staff and people imports; no equivalent verified, productized legacy-data migration service/SLA appears in the current evidence. | Extend import coverage to care plans, documents, medication, schedules and history with reconciliation and sign-off before making a time-bound migration promise. AIM's deadline is a vendor claim, not a benchmark we have independently tested. |
| UK regulatory scope | AIM describes UK-wide compliance and its feature examples are prominently CQC-oriented. Its public pages reviewed did not detail four-nation framework mappings. | MeticleCare documents CQC, CIW, Care Inspectorate Scotland and RQIA framework support, with regulator-aware evidence/readiness paths and explicit claim controls. | This is a differentiator in documented scope and explicitness, not proof AIM lacks equivalent support, nor regulator endorsement/certification. Keep each jurisdiction's framework evidence sourced and avoid “compliant” guarantees. |

### What MeticleCare is currently doing better (defensible, qualified)

1. **Supported-living operating fit.** The product is designed around shifts, residents, eMAR rounds, room checks, staffing levels, competencies and multi-location oversight, with service-type-aware configuration. This is a product-fit argument, not a verified claim that AIM lacks a supported-living workflow; AIM advertises use across agencies, care homes and nursing services, but the pages reviewed do not permit a direct workflow comparison.
2. **Safety and permission boundaries.** Rest windows, minimum staffing, assignment compliance blocks, role gates, audited approvals and multi-tenant isolation are part of product behaviour. A specific differentiator is evidenced controls and boundaries, rather than a claim that AIM omits safeguards; the supported-living mobile role-path gaps still need to be closed.
3. **Inspectable AI governance.** MeticleCare's documented intelligence outputs have date windows and source IDs, are logged and schema-validated, and remain advisory pending human review. The natural-language assistant is bounded rather than arbitrary-SQL. This is a concrete transparency strength in MeticleCare; it is not a proven superiority over AIM, whose reviewed pages do not expose enough implementation detail for a governance comparison. Production use still depends on closing the legal processor/transfer gate.
4. **Four-nation specificity.** MeticleCare's framework architecture explicitly names the four UK regulators. AIM says UK-wide and provides CQC-centred examples; the pages reviewed do not detail four-nation mappings. This is an evidence-backed specificity advantage in public documentation, not proof of missing AIM capability or regulator endorsement. Individual framework content remains subject to the source qualifications in `docs/CLAIM_REGISTER.md`.
5. **Location privacy controls for homecare.** MeticleCare has worker-level agree/decline controls, collection limited to assigned visits, and documented retention/kill-switch handling (`docs/GO_LIVE_READINESS.md`, `docs/DPIA_Live_Active_Visit_Map.md`, `docs/LOCATION_RECORDING_GUIDE.md`). The server-side controls are implemented, but updated worker-facing mobile notice/permission UX is still gated on an EAS build and the organisation-wide DPIA/legal assessment is outstanding. This is a documented privacy design position, not proof of legal compliance.
6. **Auditable payroll handoff.** Approved-only payroll exports and reconciliation make the boundary between care-time evidence and payroll processing explicit. AIM's public material promotes more automation; provider-level round trips and statutory calculations are not a like-for-like comparison until independently tested.

### Prioritized response (build the customer outcome, not a feature-count clone)

| Priority | Blueprint addition | Acceptance boundary |
|---|---|---|
| **P0 — safety** | Complete the supported-living field workflow in `docs/MOBILE_SUPPORTED_LIVING_BLUEPRINT.md`: scoped resident access, shift attendance/handover, and support-worker incident/task/room-check paths. | Resolve the documented role-gate/safeguarding blockers; test offline idempotency, role scopes and audit evidence before calling the mobile experience supported-living ready. |
| **P1 — core parity** | Safe AI workflow drafts for care plans/risk assessments plus a shared intent → permission check → evidence-backed draft → human approval → audited action path. | No arbitrary SQL, no silent publication, show source/uncertainty, preserve the original, prohibit autonomous clinical/medication/regulatory decisions. |
| **P1 — operations** | Upgrade existing domiciliary carer suggestions/travel estimates into explainable multi-stop travel/continuity recommendations, and add drag/drop interaction to the supported-living rota (not the already-draggable homecare call board). | Explain match factors and estimate confidence; enforce availability, qualifications, configured safe staffing, rest and conflicts on the server; user confirms every assignment/publication. |
| **P1 — records** | Versioned document and electronic-signature lifecycle for care plans, family consent and policy acknowledgement. | Verify signer identity/intent, timestamps and immutable audit evidence; retain existing review/consent safeguards; select a provider only after requirements are agreed. |
| **P1 — finance** | Complete live round-trip validation for payroll export partners; add exception handling and accounting reconciliation before any automation claims. | Approved timesheets only; reconcile returned totals; statutory tax/NI/pension/payroll calculations remain with a qualified provider unless separately validated and approved. |
| **P1 — adoption** | Repeatable migration/import and customer onboarding service. | Document source coverage, field mapping, rejects, reconciliation and customer acceptance; do not promise a fixed migration duration until measured across representative systems. |
| **P1 — communications** | Consent-, preference- and quiet-hours-aware multi-channel escalation; evaluate SMS and family-alert workflows. | Provider/sender approval, opt-in, delivery audit, role-scoped content and human approval for sensitive family updates. |
| **P2 — adjacent suite** | Decide whether recruitment CRM, applicant automation, lead/sales pipeline and marketing automation belong in MeticleCare or should be partner integrations. | Validate buyer demand and data-protection boundaries first; keep advertising/lead data segregated from care records. |
| **Research gate — clinical AI** | Evaluate longitudinal change detection only as a governed, clinically reviewed programme, not a marketing parity checkbox. | Prospective/retrospective validation, representative data, clinical safety case, false-positive/negative monitoring, human escalation and independent review before any outcome or lead-time claim. |

### Competitive evidence and claim rules

- WeAim public pages are a vendor's current product description and commercial offer, not proof every capability is generally available, integrated or independently evaluated. Re-check before a board, investor or sales pack is issued.
- The public prices and migration fees are a dated observed offer, not MeticleCare's price recommendation: AI Care Manager £15/staff/month + VAT; Business Suite £20/staff/month + VAT; minimum 12-month commitment; annual billing promotion advertises three months free; Standard migration £950 + VAT and Full migration £1,950 + VAT. The pages reviewed did not establish minimum seat count, and migration scope depends on source exports. Do not claim cheaper/better value until scope, minimum term, VAT, implementation, migration and seat definitions match.
- Do not quote WeAim's “70%”, “90%”, “48 hours”, “38% retention”, cost-savings or customer-result figures as verified outcomes without an independently inspectable methodology.
- Do not claim MeticleCare is “more compliant”, “safer”, “more accurate” or “better AI” without a defined test, comparison cohort and evidence. Prefer the implementation facts and boundaries in the matrix above.

## Phase 0: Production Hardening (Before AI Expansion)

| Item | Priority | Effort | Status |
|---|---|---|---|
| Docker production services and health checks | Critical | M | ✅ Implemented (current infrastructure inventory) |
| Versioned, checksummed migrations | Critical | M | ✅ Implemented (current infrastructure inventory) |
| Tenant isolation (request context, dual pool, PostgreSQL RLS) | Critical | L | ✅ Implemented; keep tenant/migration tests as release gates |
| API unit/integration tests | High | L | ✅ 395 tests across 44 modules reported in current project inventory |
| End-to-end pilot / UAT of critical workflows | High | XL | 🟡 Pilot/UAT remains unexecuted; 381-case QA/UAT pack is recorded as not run in `docs/GO_LIVE_READINESS.md` |
| CI/CD pipeline with image build and deploy/rollback | High | M | ✅ Implemented (current infrastructure inventory) |
| Monitoring visibility (Prometheus, uptime checks, dashboards) | High | M | 🟡 Prometheus metrics and Uptime Kuma are deployed; monitor/contact test is unverified and Grafana dashboards/Prometheus alert rules are not recorded as implemented (`docs/GO_LIVE_READINESS.md`, T0-4) |
| Alert delivery and on-call test | Medium | S | 🟡 Confirm uptime monitors and phone contact, then fire a test alert; application alerting remains to be operationally verified (`docs/GO_LIVE_READINESS.md`, T0-4) |
| Backup and recovery testing | Critical | S | 🔵 Require a documented restore rehearsal and agreed recovery objectives before making resilience promises |
| Independent security review / penetration test | Critical | L | 🔵 Evidence not recorded in the current readiness documents; confirm scope and obtain review |
| AI data-flow governance | High | M | 🟡 Pseudonymisation, minimisation controls and production processor gate exist; legal processor/transfer agreements remain open (`docs/GO_LIVE_READINESS.md`, T0-17b) |

## Phase 2: Domiciliary Care Delivery

| Item | Priority | Effort | Status |
|---|---|---|---|
| Homecare package, visit, travel and timesheet foundation | Critical | M | ✅ Implemented |
| Manager/carer role boundaries and tenant-scoped API | Critical | M | ✅ Implemented |
| Domiciliary mobile day route and assigned-visit check-in/out | Critical | L | ✅ Implemented — online/offline check-in/out; this does not mean supported-living mobile is ready |
| Recurring call generation and rota conflict detection | High | L | ✅ Implemented — idempotent generation, availability and overlap checks |
| Manager late/missed/cancelled exception queue | High | M | ✅ Implemented — resolution note and resolver audit fields |
| Travel-aware reminders and disruption handling | High | M | ✅ Implemented — email + web-push travel-buffer reminders with retry ledgers, carer disruption reporting, manager disruption queue |
| Mileage policy by tax year and approval workflow | High | M | ✅ Implemented — tax-year/vehicle/fuel policy tables; approval follows manager timesheet sign-off |
| Payroll CSV export and provider integration | High | L | ✅ Implemented — approved-only CSV adapters for Sage, Xero, QuickBooks, BrightPay, Staffology and generic, plus reconciliation ledger; live provider round-trip still to validate with the pilot |
| Carer availability management | High | S | ✅ Implemented — manager UI records weekly availability used by generation and overlap checks |
| Offline visit execution with explicit sync status | Critical | M | ✅ Implemented — offline queue, sync banner, retry-safe server idempotency ledger |
| Missed-visit client/family communication and incident linkage | High | M | ✅ Implemented — visit follow-up ledger with channel, outcome and optional incident link, resolver audit |
| VAT-configurable pricing | Medium | S | ✅ Implemented — domiciliary `vat_rate`/`vat_inclusive` in `billing_config` (072) with exclusive/inclusive helpers, per-line net/VAT/gross snapshot, and per-run vat_amount/gross + funding breakdown (074) |
| Client billing and package utilisation | Medium | L | ✅ Implemented — invoice-ready utilisation (delivered min × client rate) with funding type, cancellation/no-charge policy, review/billable decisions, draft → approved (immutable) → void (audited reversal) lifecycle, funding breakdown, RLS + manager-only approval, and audit logging; does not charge Stripe |
| Active-visit oversight with GPS governance controls | High | M | 🟡 Server-side point-in-time controls, worker decisions, retention and audit exist; EAS worker-facing UX is not released and organisation-wide DPIA remains open. Not continuous/off-duty tracking (`docs/LOCATION_RECORDING_GUIDE.md`, `docs/GO_LIVE_READINESS.md`) |
| SMS reminder channel | Medium | S | 🔵 Deferred until provider, sender identity, consent policy and cost model are approved |
| End-to-end pilot/UAT across manager/carer roles and 320–768px mobile widths | Critical | L | 🟡 Provider is identified, but the 381-case QA/UAT pack is not executed; live payroll-provider round trips also remain to validate (`docs/GO_LIVE_READINESS.md`, T0-14) |

## AI Enablement Roadmap (Reconciled 6 October 2026)

This roadmap separates shipped foundations from unfinished product work. The existing event infrastructure, selected consumers, per-organisation monthly budgets/provider fallback, output labels and source-linked intelligence are implemented; do not schedule them as greenfield work. Prompt versioning, general tool/action orchestration, durable recommendations/approval queue, broad policy knowledge retrieval and extra drafting workflows remain proposed.

| Horizon | Work | Status / boundary |
|---|---|---|
| **Foundation — shipped** | Domain-event outbox/worker and selected event consumers | Extend consumer coverage; do not recreate infrastructure |
| **Foundation — shipped** | Per-org AI configuration, approved-processor gate, provider fallback, monthly token/cost limits, audit logs, output labels and validated source-linked intelligence | Production provider use remains subject to legal processor/transfer agreements; audit legacy endpoints individually |
| **P1 — governed action layer** | Durable AI recommendations, permissions-aware action registry and manager approval queue | New capability; all write actions need explicit authorization, source evidence, audit, idempotency, expiry and rejection/undo semantics |
| **P1 — workflow parity** | Care-plan/risk-assessment drafting and improved voice-to-structured records | Draft-only, preserve source text, citations/provenance, human review; no medication/care-plan change without qualified approval |
| **P1 — intelligence quality** | Route-aware source links, intent layer for bounded natural language, more deterministic review/identity evidence | Never allow arbitrary SQL; source retrieval remains permission and tenant scoped |
| **P2 — organisational knowledge** | Version-aware search/Q&A over approved policies and documents | Build only after retention, deletion, permissions, source freshness and processor terms are resolved |
| **Research gate** | Clinical prediction / deterioration lead-time claims | Separate clinical safety and validation programme; not ordinary feature parity |

## AI Documentation Workflows (Planned)

These are add-on workflow expansions: incident triage, daily-note assistance and manager-reviewed family drafts already exist, but are not equivalent to every draft lifecycle proposed below.

| Capability | Priority | Acceptance boundary |
|---|---|---|
| Server-side speech transcription fallback | Medium | Explicit consent/data handling, provider governance, transcript review and offline fallback |
| Care-plan / risk-assessment drafts | High | Source citations, provenance, version comparison and qualified human approval |
| Incident/handover summaries | Medium | Advisory/draft only; preserve original and role-scoped evidence |
| Policy Q&A with citations | Medium | Approved current versions only; cite exact document sections; never assert legal compliance |
| Broader family communication drafting | Medium | Manager reviewed, consent-aware, permission-filtered and never sent automatically |

Do not list already shipped family drafts, manager briefings, care summaries, rota alternatives, competency coaching, source-linked signals, AI labels, audit and budget controls as unimplemented. See `docs/AI_PRODUCT_ROADMAP.md` for the current intelligence matrix and specific hardening tickets.

## Compliance Intelligence Roadmap (Incremental Work)

The platform already has CQC readiness, compliance gap analysis, evidence mapping, selected deterministic compliance signals, and source-linked manager intelligence. The following are extensions, not greenfield replacements:

| Remaining work | Priority | Boundary / dependency |
|---|---|---|
| Extend deterministic checks to reviews and identity documents | High | Current checks cover training, risk assessments, competency assessments and incident actions; cite the exact record and avoid a blanket readiness claim. |
| Add route-aware source links and evidence freshness/ownership follow-up | High | Source IDs are already returned; link only to records the reviewer is authorised to see. |
| Broaden event-driven compliance coverage | Medium | Reuse the outbox and selected consumers; define an owner, threshold, deduplication and test for each new signal. |
| Improve framework-specific explanation and inspection preparation | Medium | Build on existing regulator-aware readiness/evidence paths; cite verified sources and preserve jurisdictional caveats. |
| Connect compliance signals to existing manager briefings and Mission Control | Medium | Incremental integration; do not describe briefings or Mission Control as unbuilt. |

## Operations Intelligence Roadmap (Incremental Work)

AI manager/end-of-day briefings, domiciliary operations signals, advisory rota alternatives, operational activity review, basic carer ranking and travel estimates already exist. The work below deepens those capabilities; it does not introduce the first briefing or worker suggestions.

| Remaining work | Priority | Boundary / dependency |
|---|---|---|
| Explain and extend suitable-worker recommendations | High | Build on current availability/conflict/workload ranking; add qualifications, continuity and multi-stop travel factors with visible uncertainty and manager confirmation. |
| Broaden event coverage for unfilled/understaffed shifts and exceptions | High | Selected alerts/consumers exist; add only owned, deduplicated signals and retain server-side staffing, rest and compliance constraints. |
| Extend overtime/rest and shift-pressure analysis | Medium | Distinguish scheduled from actual hours; test across service models and keep legal/workforce policy configurable. |
| Add measured operational anomaly detection | Medium | Current operational review is date/status-filtered, not statistical outlier detection; define a validated baseline and thresholds before using “anomaly” as a predictive claim. |
| Consider agency-demand forecasting | Research | A future forecast needs sufficient representative history and back-testing; current agency analytics are not a forecast. |

## Resident and Medication Intelligence Roadmap (Incremental Work)

Person care summaries, change/risk signals, eMAR controls and competency coaching are present. Expansion must stay record-bounded and advisory; none of these items is a diagnosis, interaction checker or treatment recommendation.

| Remaining work | Priority | Boundary / dependency |
|---|---|---|
| Expand sourced resident change summaries | High | Extend selected time windows and source coverage; no learned baseline or deterioration prediction is currently documented. |
| Add note/documentation completeness signals | High | Identify missing evidence against configured workflow requirements; do not infer clinical facts or regulatory compliance. |
| Add reviewed wellbeing, falls and hydration trend views | Medium | Use available observations with dates and source links; validate data completeness and present trends as signals only. |
| Extend medication exception and PRN trend reporting | High | Reuse eMAR administration/stock evidence; no free-form AI interaction warning or medicine-change recommendation. |
| Link stock, administration and competency evidence | Medium | Existing stock and competency records remain authoritative; AI may summarise but cannot grant competence or authorise a dose. |

## Controlled Automation Roadmap (Not Shipped)

Event consumers already create selected alerts and triage outputs, and standard product workflows include reminders/notifications. What is not shipped is a generic, durable AI recommendation-to-action queue or organisation-configurable agent that writes across modules.

| Remaining work | Priority | Boundary / dependency |
|---|---|---|
| Durable recommendation and manager-approval queue | High | New capability; require explicit permissions, source evidence, expiry, audit, idempotency, rejection and undo/compensation semantics. |
| Human-approved draft tasks or follow-up actions | Medium | Reuse existing task workflows only after approval; never silently assign or close care/safeguarding work. |
| Configurable escalation policies for selected operational events | Medium | Keep event-specific ownership, quiet-hours, deduplication and delivery evidence; do not rebuild the notification system. |
| Evidence requests and review reminders from validated signals | Low | Draft for a named authorised reviewer; no automatic external/family communication. |
| Organisation-level autonomy controls | High | Advisory remains default; opt-in is per capability and role, with limits, monitoring and a practical undo path. |

> **Scope note:** “not shipped” here refers to general AI-controlled cross-module actions. It does not mean domain events, notifications, ordinary reminders, existing task workflows or selected automated exception consumers are absent.


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

## 27.1 Current State (October 2026)

- Current project inventory reports 395 backend tests across 44 modules, plus a separately run web suite; the July file/module counts elsewhere in this document are historical.
- API integration tests cover many modules and workflows; coverage is uneven, and external provider round-trips remain to validate.
- The 381-case manual QA/UAT pack is recorded as not executed (`docs/GO_LIVE_READINESS.md`, T0-14).
- End-to-end pilot validation across manager/carer roles and real care operations remains a release gate; passing CI is not equivalent to completed provider UAT.
- CI runs lint, typecheck, tests and builds; verify the active pipeline before relying on this statement.

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

The figures below are proposed pilot targets from the historical blueprint, not measured MeticleCare outcomes or approved customer-facing claims. Establish baselines, definitions, sample sizes, time windows and data owners before using them to assess performance or publish results.

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

The impact/likelihood labels below are a qualitative planning snapshot, not quantified risk assessments. Re-rate them with operational and clinical owners using current evidence.

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| AI generates inaccurate care documentation | High | Unknown / open | Keep human review for documented workflows; use structured validation and source citations where implemented; audit legacy routes and test realistic failure cases |
| AI misses safeguarding concern | Critical | Unknown / open | AI is not a safeguarding determination; train staff to follow provider policy and never rely on AI as a complete screening control |
| API cost overrun | Medium | Medium | Enforce existing per-org token/cost caps; verify alerting and feature/model-routing controls before relying on them |
| Model provider outage | Medium | Medium | Use configured provider fallback; test user-visible graceful degradation; do not rely on cached responses unless implemented for the specific workflow |
| Prompt injection attack | High | Unknown / open | Treat as an unresolved test surface; validate inputs, isolate instructions, validate outputs and red-team each endpoint before claiming coverage |
| Cross-tenant data leakage | Critical | Low | Request-scoped tenant context and PostgreSQL RLS are implemented; enforce tenant-scoped tool access, RLS/migration tests and regular audits |
| Staff over-reliance on AI | Medium | Unknown / open | Train users; label documented AI-assisted outputs; retain human review for consequential use; verify legacy workflow safeguards and audit actual adoption |
| Data-protection or international-transfer failure | Critical | Unknown / open | Close processor/transfer agreements, complete provider governance/DPIA and verify minimisation, retention and user disclosures before production use |
| Regulatory change or guidance update | Medium | Medium | Verify jurisdiction- and service-specific primary sources; update mappings with reviewed evidence |
| User resistance to AI | Medium | Medium | Start with advisory mode; demonstrate value; gather feedback; iterate |
| Event system overload | Medium | Unknown / open | Measure queue age, retry/failure rates and consumer latency; define alert thresholds and load tests before asserting capacity or rate-limit coverage |

---

# 30. Decisions Still Required (Reconciled 6 October 2026)

The previous table mixed already-built foundations with unresolved decisions. The choices below are current product/technical questions; AI processor terms remain a launch gate, not a feature preference.



## Product Decisions

| # | Decision | Options | Recommendation |
|---|---|---|---|
| 1 | How should the existing Mission Control surface evolve? | Extend current surface / Replace / Split by role | Extend the shipped surface; avoid duplicating dashboards before validating user needs |
| 2 | Add managed server-side speech transcription? | Browser only / Provider fallback / Defer | Browser remains primary; evaluate fallback only after processor/transfer approval and pilot evidence |
| 3 | When to add policy/document knowledge retrieval? | Next release / Later / Partner | Defer until retention, deletion, permissions, source freshness and processor terms are resolved |
| 4 | AI autonomy default for new orgs? | Advisory / Draft / Controlled | Advisory initially; require explicit authorised user confirmation for consequential actions. Expand draft capability only after each workflow passes role, tenant, safety and audit tests; low-risk controlled automation needs organisation opt-in and undo/monitoring controls. |
| 5 | Family summaries: auto-generate or on-demand? | Auto / On-demand / Both | On-demand with staff review |
| 6 | Daily briefing: push notification or pull only? | Push / Pull / Both | Pull (Mission Control page) with push for critical items |
| 7 | Pricing: AI features per-user or per-org? | Per-user / Per-org / Per-feature | Per-org with usage caps |
| 8 | E-learning priority relative to AI? | Before AI / After AI / Parallel | Parallel (different teams) |
| 9 | Should AI be available to CARE_WORKER role? | Yes (limited) / No / Configurable | Configurable per org |
| 10 | Which provider processing arrangements are approved for production? | OpenAI / Anthropic / Both / Neither until signed | No provider is production-approved until applicable processor and transfer terms are signed and governance review is complete; allow organisations to select only from approved options |

## Technical Decisions

| # | Decision | Options | Recommendation |
|---|---|---|---|
| 1 | Event delivery contract for new consumers? | At-least-once / At-most-once / Exactly-once | Existing outbox uses retryable delivery; preserve idempotent consumer semantics and verify the exact live contract before extending |
| 2 | When should the event worker move out of process? | Keep in-process / Separate container | Keep the shipped worker until measured throughput, isolation or reliability needs justify a split |
| 3 | AI output storage: full result or references? | Full JSONB / References only | Full JSONB for audit, references for large outputs |
| 4 | Knowledge indexing: real-time or batch? | Real-time / Batch (hourly/daily) | Batch (hourly) initially |
| 5 | Should agents share conversation context? | Yes / No / Limited | No (stateless per request) |
| 6 | AI response caching? | Yes / No | Yes (for identical inputs within TTL) |
| 7 | Structured output for new capabilities? | Schema-constrained response / JSON mode / Both | Use the existing validated response pattern where possible; provider-specific function/JSON modes are implementation details, not a product decision |

---

# 31. Assumptions

1. The existing Express modular monolith architecture will be preserved. No microservices extraction planned.
2. PostgreSQL remains the primary database. No migration to a different RDBMS.
3. Redis remains the caching layer. No migration to Memcached or similar.
4. OpenAI and Anthropic remain the primary AI providers. No immediate need for local/on-premise models.
5. Existing intelligence outputs use structured validation; extend schema validation to every remaining legacy AI endpoint and newly introduced action payload.
6. The existing audit log pattern will be extended to all AI interactions.
7. Reuse the shipped notification and alert modules for AI-linked alerts; do not add a parallel alerting system without measured operational need.
8. Browser-native Web Speech API remains the current voice-input path; a governed server-side transcription fallback is a future option, not an approved dependency.
9. The existing Stripe billing integration will be extended for AI feature entitlements.
10. The existing Docker infrastructure will be extended (not replaced) for new components.
11. The existing CI pipeline will be extended to include new test types.
12. All AI features will be opt-in per organisation (no forced AI adoption).
13. AI-generated content will never override human decisions without explicit approval.
14. The platform will remain UK-focused but architecturally regulator-agnostic.

---

# 32. Immediate Next Actions (Reconciled 6 October 2026)

| # | Action | Owner | Priority |
|---|---|---|---|
| 1 | Reconcile the remaining historical status tables against current code before using the blueprint as an engineering checklist | Product + Engineering | Critical |
| 2 | Execute the existing 381-case QA/UAT pack and close supported-living field-workflow blockers | Product + Engineering | Critical |
| 3 | Verify uptime monitors and phone alert delivery with a test; perform the pending restore rehearsal and record measured recovery objectives | Operations | Critical |
| 4 | Close AI processor agreement/transfer work and obtain formal governance review before enabling production provider traffic | Compliance + Product | Critical |
| 5 | Implement a cross-module AI recommendation and human-approval queue, reusing current domain events/outbox | Backend Engineer | High |
| 6 | Add route-aware source links and broaden deterministic compliance coverage to reviews and identity evidence | AI + Frontend | High |
| 7 | Validate all payroll export partners with representative pilot round trips and reconciliation | Product + Engineering | High |
| 8 | Prioritise supported-living mobile role/access blockers before mobile polish | Mobile + Backend | High |
| 9 | Decide demand and build-vs-partner for e-signature/document workflow and SMS | Product Owner | Medium |
| 10 | Evaluate clinical prediction only through a separately governed validation programme | Product + Clinical Safety | Future gate |

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

*This blueprint is a product direction document for MeticleCare. Its status tables are historical unless explicitly date-stamped; implementation truth is maintained in the source code and current capability/roadmap documents. Update it as delivery and evidence change.*
