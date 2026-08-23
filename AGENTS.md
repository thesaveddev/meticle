## Goal
Supported living + domiciliary care platform. Phase 1 is complete and launched. Focus: hardening, testing, monitoring, and Phase 2 features.

## Constraints & Preferences
- ORG_ADMIN promotes other ORG_ADMINs; MANAGERs cannot change own role
- Leave Manager standalone (not in Rota Planner); calendar day-click popup with status, duration, approve/reject
- Leave balance cards: compact inline header row, aggregated "X days + Y hours" format
- Compliance profiles role-based; role changes reflect instantly via `/auth/me` on page focus + periodic poll
- Multi-tenant via AsyncLocalStorage + dual-pool + RLS policies on all tables
- Stripe auto-provisions on first use; test mode allowed in dev
- Manager cannot self-approve leave; manager/admin leave routes to: (1) active delegation (deputy) → (2) a different ORG_ADMIN → (3) any other manager/admin; auto-approves (audit-logged) only if no alternative approver exists
- Rota Planner: location-based min safe staffing, compliance block on assign, view-only for non-`scheduling:edit`
- 11-hour rest enforced for OT; conflicting shifts blocked
- Duplicate manager delegations → 409; notifications on OT + dept/team assignment
- Email: branded HTML templates, queue with retry (DB-backed inbox)
- Error messages inside modals (not behind); tables paginated; buttons have loading spinners
- Guard: `npx tsc --noEmit` in both `apps/web` and `apps/api`
- **No eye icons** (`VisibilityIcon`/`RemoveRedEye`/`Visibility` as a "view" affordance) anywhere except password show/hide toggles on auth forms; use `OpenInNewIcon`/`DownloadIcon` for file-open actions
- **Cards and entries are clickable to view**: list rows/cards open a read-only detail dialog on click (hover cursor + border/shadow feedback); edit/delete buttons use `stopPropagation`; never add a separate "view" icon button
- **Design work** (new UI, redesigns, polish): load `/taste` and `/impeccable` skills and follow their guidance (brand palette navy `#0F4C81`, emerald `#10B981`, bone `#F7F4EE`, ink `#1B2430`)

## Architecture
- **Monorepo**: npm workspaces (`apps/api`, `apps/web`, `apps/marketing`, `packages/shared`)
- **Backend**: Express modular monolith, 45 module dirs, raw SQL (no ORM), Zod validation (80+ schemas)
- **Frontend**: React 18 + TypeScript + MUI 5 + TanStack React Query + React Router 6
- **Database**: PostgreSQL 15 (pg pool), dual-pool (app role + superuser), AsyncLocalStorage request-scoped clients, RLS enforcement
- **Cache**: Redis with in-memory fallback (rate limiter, token blacklist)
- **Realtime**: Socket.IO v4 with JWT auth + DB validation + rate limiting + Redis adapter
- **Auth**: JWT access + refresh tokens, MFA (TOTP/speakeasy), RBAC + permission checks per request
- **Infra**: Docker compose (dev 4 services + prod 6 services), GitHub Actions CI/CD with GHCR + auto-rollback, Prometheus metrics, Swagger auto-docs
- **AI**: OpenAI + Anthropic adapters, per-org API keys, audit logging

## Current State (Phase 1 — Launched August 2026)

### ✅ Backend Modules (45)
| Module | Endpoints | Key Features |
|---|---|---|
| auth | 11 | Register, login, MFA challenge, refresh, forgot/reset, me, logout |
| mfa | 5 | Setup (QR), verify, disable, admin-disable |
| orgs | 20 | Org CRUD, locations, departments, teams, branding, subscription |
| organization | 6 | Invitations: send, validate, accept, list, resend, cancel |
| people | 32 | People (SU/carer/family/visitor/emergency), notes, documents, activities, care plans, goals, risk assessments, contacts |
| staff | 18 | Profiles, role/status/skills/qualifications/emergency-contacts, dept assignment |
| compliance | 16 | Docs, evidence packs (KLOE), identity dashboard, trends, mappings, records, PDF |
| scheduling | 30+ | Shifts CRUD, assign/claim/swap/approve/reject, templates, min-staff, OT |
| marketplace | 3 | Open shifts, apply, publish |
| reporting | 2 | Compliance audit, staffing stats — reports across 9 categories (staff, people, scheduling, leave, incidents, compliance, training, eMAR, operations) with filters, charts, and CSV export |
| insights | 5 | Overview, staffing, compliance, leave, rota analytics (Recharts on frontend) |
| incidents | 24 | CRUD, categories, involved residents, action items (owners/due/overdue), evidence attachments, near-miss + confidential events (admin-only visibility), CQC reporting fields, audit timeline, admin notifications, AI triage |
| dashboard | 5 | Stats (7 KPIs), compliance snapshot, today-rota, widgets, review scheduler |
| notifications | 6 | List, unread count, mark read (single/all), preferences |
| permissions | 3 | Modules, get user, update user |
| training | 11 | Modules CRUD, records, matrix, expiring, dashboard, bulk-assign, auto-assign |
| competency | 5 | Templates CRUD, assessments (with evidence), pending (role-filtered) |
| cqc | 7 | Readiness (5-domain real-data), frameworks (4 regulators), gap analysis, action items |
| surveys | 16 | Satisfaction (manual + email invite), engagement templates, public token forms |
| appointments | 6 | CRUD + today-stats |
| policies | 7 | CRUD + categories + seed 12 standard CQC policies |
| emedication | 33 | MAR records, chart grid, administrations, stock, deliveries, daily counts, adjustments, audit, competence, monthly auto-create, archive/import |
| goals | 6 | CRUD + per-service-user stats (CQC domain mapped) |
| health | 16 | Observations, bowel (Bristol scale), dental, fluid intake — all CRUD |
| leave | 15 | Requests, balances, calendar, types CRUD, entitlements, review with delegation |
| settings | 33 | Org settings, locations, certs, compliance config, delegations, records, profiles, upload |
| chat | 16 | Channels, messages, DMs, groups, files, link preview, read receipts, org-members |
| billing | 10 | Subscription, invoices, payment methods, setup intent, add-ons, Stripe webhook |
| audit | 1 | Logs (wired across 40+ mutation points) |
| ai | 7 | Config, compliance gap analysis, incident triage, rota analysis/generation, audit, usage |
| family-portal | 13 | Members CRUD + invite/revoke/refresh + public token-based (care notes, care plans, goals, observations) |
| delegations | 1 | Delegation audit trail |
| agencies | 19 | Agencies, workers, rates CRUD + savings analytics + shift history |
| dspt | 5 | NHS DSPT: assessment, 10 standards, submit |
| tasks | 4 | CRUD (kanban-style) |
| room-checks | 4 | CRUD with photo upload + MUI ratings |
| events | 5 | Domain event outbox, publish helper, consumer registry, in-process worker, admin endpoints |
| mobile | 3 | GPS check-in, roster (7-day), voice-to-text notes |
| families | 12 | People-type family member CRUD + user account linking + invite + dashboard |
| payments | 17 | Invoice CRUD + approve/send/pay + Stripe line items + payment link + portal + webhooks + statement + dashboard |
| expenses | 10 | Petty cash CRUD + approve + stats + reports + dashboard |
| alerts | 4 | Alert rules CRUD + evaluate + acknowledge + preferences |
| audit-trail | 1 | Audit trail viewer (filtered, paginated, exportable) |

### ✅ Frontend Pages (68)
| Area | Pages | Features |
|---|---|---|
| Auth | 7 | Login, Register, Forgot/Reset Password, Verify Email, MFA Challenge, MFA Setup |
| Dashboard | 1 | Role-based KPIs (7 cards), compliance widget, rota timeline, appointments, training/DBS expiry widgets |
| Compliance | 8 | Hub, Identity Monitoring, Competency Assessments (3 tabs), Evidence Packs (KLOE), CQC Readiness (5-domain gauge + AI gap), Records, Satisfaction Surveys, Staff Engagement |
| Scheduling | 1 | Rota Planner (7x24 grid, quick-add) |
| Leave | 1 | 5 tabs: Types, Requests, Balances, Calendar (with popup), Settings |
| Chat | 1 | DMs/groups, real-time, emoji, files, link preview, read receipts, unread divider |
| People | 3 | Directory, Profile (20 tabs in 5 categories), Health (4 sub-tabs) |
| Staff | 2 | Directory (CSV import, filters), Profile (compliance, permissions, assess) |
| Incidents | 2 | Directory (filters, stat cards, near-miss/confidential chips), Detail (AI triage, update, actions, evidence, timeline, delete) |
| eMAR | 2 | Active charts (31-day grid, PRN, stock, daily counts), Archived |
| Settings | 1 | 12 tabs: Profile, Compliance, Leave, Delegates, Org, Billing, Integrations, Schedule, Notifications, Security, AI, Appearance |
| Payments | 1 | Invoice list, create, detail, customer portal |
| Expenses | 1 | Petty cash list, create, detail, reports |
| Other | 20+ | Appointments, Goals, Policies, Care Assessments, Tasks, Room Checks, Marketplace (x2), Agencies (5 tabs), Reporting (6 template cards), Insights (5 sections), Training Matrix (4 tabs), DSPT (4 themes/11 standards), Billing (Stripe), Onboarding, Organization (4 tabs), Family Portal, Mobile (GPS + Voice Notes), Learning Center, Legal (3), Marketing (7), Landing, Survey Form, Errors (2) |

### ✅ Infrastructure
| Component | Status |
|---|---|
| Docker compose (dev) | ✅ 4 services (postgres, redis, api, web) with health checks + volumes |
| Docker compose (prod) | ✅ 6 services (postgres, redis, api, web, nginx, prometheus) with health checks + volumes |
| CI (GitHub Actions) | ✅ Lint + typecheck + test + build + Docker push to GHCR + deploy with auto-rollback |
| Redis | ✅ In-memory fallback (rate limiter, token blacklist) |
| Socket.IO | ✅ JWT auth, DB validation, rate limiting, membership gating, online presence, Redis adapter |
| Prometheus metrics | ✅ Histograms + counters |
| Swagger docs | ✅ Auto-generated from router stack |
| File uploads | ✅ Multer + UUID names + MIME allowlist + extension/magic-byte blocking |
| Email | ✅ 20+ branded templates, Nodemailer SMTP, DB-backed queue with retry |
| Stripe | ✅ Customer/price auto-provisioning, webhook, test/live gating |
| Encryption | ✅ AES-256-GCM per-org key derivation |
| HTTPS | ✅ Optional cert-based |
| PWA | ✅ Service worker, manifest, offline caching, installable, GPS/voice pages |
| Testing | ✅ 395 tests across 44 modules (integration + unit) |
| Postgres RLS | ✅ AsyncLocalStorage + dual-pool + RLS policies on all tables |
| Migrations | ✅ 33 migrations, versioned with checksums |
| Monitoring | ⚠️ Prometheus only — no alerting, no dashboards, no uptime checks |

### ✅ Seed Script (`seed-orbis.ts`)
Creates a fresh demo org with random name each run (~1,550 rows total):
- 22 staff (1 ORG_ADMIN, 3 MANAGER, 18 CARE_WORKER) — email: `firstname.lastname@orbisgroup.care`, password: `DemoPass123!`
- 18 service users across 3 locations
- 3 locations, 4 departments, 4 teams
- 4 leave types, 88 balances, 16 requests
- 12 training modules, ~206 records; 12 competency templates, ~60 assessments
- 12 compliance configs, ~216 records
- 12 incidents (3 low, 4 med, 4 high, 1 critical)
- 12 policies (CQC-aligned), 16 appointments, 24 goals
- 24 room checks, 16 tasks, ~168 shifts
- 30 memory book entries, 12 satisfaction surveys
- 24 care assessments, 36 clinical scores
- 60 wellbeing, 30 comm logs, 12 capacity, 10 pathways, 12 discharge
- 20 notifications, 24 SU documents, 5 delegations, 30 audit logs
- 15 body map entries, 6 engagement templates, 8 invitations
- 4 eMAR records (12 meds, ~76 administrations)
- 15 evidence mappings

### ✅ Test Suite (395 tests)
| Module | Tests | Coverage |
|---|---|---|
| auth | 12 | Register, login, MFA, refresh, forgot/reset, logout, /auth/me |
| mfa | 10 | Setup, verify, disable, admin-disable, TOTP flow |
| orgs | 13 | Org CRUD, locations, departments, teams |
| organization | 12 | Invitation send, validate, accept, list, resend, cancel |
| people | 15 | CRUD, notes, documents, activities, care plans |
| staff | 11 | Profiles, role/status, skills, qualifications, emergency contacts |
| compliance | 13 | Docs, evidence packs, identity dashboard, trends, records |
| scheduling | 13 | Shifts CRUD, assign, templates, min-staff |
| reporting | 9 | Compliance audit, staffing stats, goals/wellbeing reports |
| incidents | 11 | CRUD, categories, actions, evidence, near-miss |
| dashboard | 7 | Stats, compliance, rota, widgets |
| notifications | 8 | List, unread, mark read, preferences |
| permissions | 6 | Modules, get user, update user |
| training | 10 | Modules CRUD, records, matrix, expiring, dashboard |
| competency | 7 | Templates CRUD, assessments, pending |
| cqc | 7 | Readiness, frameworks, gap analysis, action items |
| surveys | 9 | Satisfaction, engagement, public forms |
| appointments | 5 | CRUD, today-stats |
| policies | 5 | CRUD, categories |
| emedication | 10 | MAR records, chart grid, administrations, stock |
| goals | 5 | CRUD, stats |
| health | 9 | Observations, bowel, dental, fluid |
| leave | 10 | Requests, balances, calendar, types, review |
| settings | 8 | Org settings, locations, certs, config |
| chat | 7 | Channels, messages, DMs, groups, files |
| billing | 5 | Subscription, invoices, payment methods |
| audit | 5 | Logs, filters, export |
| ai | 7 | Config, compliance, triage, rota, usage |
| family-portal | 6 | Members, invite, token access |
| delegations | 5 | CRUD, delegation trail |
| agencies | 5 | CRUD, workers, rates |
| dspt | 5 | Assessment, standards, submit |
| tasks | 5 | CRUD, kanban |
| room-checks | 5 | CRUD, photos, ratings |
| events | 5 | Domain events, consumers, admin |
| mobile | 5 | GPS, roster, voice notes |
| families | 12 | People-type family members, user linking, invite |
| payments | 10 | Invoices, approve, Stripe, portal |
| expenses | 8 | Petty cash CRUD, approve, stats, reports |
| alerts | 5 | Rules, evaluate, acknowledge, preferences |
| audit-trail | 5 | Viewer, filters, export |
| **Total** | **395** | **44 modules** |

### ❌ Phase 2 — Still to Build
| Feature | Notes |
|---|---|
| **Drag & Drop Rota** | Interactive drag-and-drop shift scheduling on the rota grid |
| **E-learning (SCORM/xAPI)** | No LMS integration — partner with Highfield or similar for accredited care courses |
| **Digital signatures** | No DocuSign/Adobe Sign integration |
| **DBS API integration** | No GBG/uCheck partnership for automated DBS checks |
| **SMS notifications** | No Twilio — currently email-only |
| **PrintNode printing** | Physical document delivery |
| **Document Drive** | File management UI for evidence packs |
| **Family Portal Finances** | Tab placeholder — invoices/payments not exposed to family members |
| **Staff 1-2-1s** | One-to-one meeting records, action tracking, review scheduling |
| **Payroll & Timesheets** | Timesheet submission, approval workflow, payroll export/integration |
| **Monitoring & Alerting** | Prometheus exists but no alerting rules, no dashboards, no uptime checks |
