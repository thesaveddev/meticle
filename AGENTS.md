## Goal
Supported living care management platform. Phase 1 is complete and launched. Focus: hardening, testing, monitoring, and Phase 2 features.

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
- Audit: every mutation's `audit_logs` row is committed before its response is sent (per-request tracking + a bounded `res.end` deferral in `rls.middleware.ts`); an audit failure is logged, never a 500
- Error messages inside modals (not behind); tables paginated; buttons have loading spinners
- Guard: `npx tsc --noEmit` in both `apps/web` and `apps/api`
- **No eye icons** (`VisibilityIcon`/`RemoveRedEye`/`Visibility` as a "view" affordance) anywhere except password show/hide toggles on auth forms; use `OpenInNewIcon`/`DownloadIcon` for file-open actions
- **Cards and entries are clickable to view**: list rows/cards open a read-only detail dialog on click (hover cursor + border/shadow feedback); edit/delete buttons use `stopPropagation`; never add a separate "view" icon button
- **Design work** (new UI, redesigns, polish): load `/taste` and `/impeccable` skills and follow their guidance (brand palette navy `#0F4C81`, emerald `#10B981`, bone `#F7F4EE`, ink `#1B2430`)

## Architecture
- **Monorepo**: npm workspaces (`apps/api`, `apps/web`, `apps/marketing`, `packages/shared`)
- **Marketing tool** (`apps/marketing`): a standalone lead-gen service for outbound email to care providers scraped from the public register — its own SQLite database and its own SMTP. It is deliberately not part of the product API (no tenant, no RLS, leads are not users), but it sends real marketing email, so it carries its own opt-out: `src/email/unsubscribe.ts` signs a `/u/:leadId?sig=` link per lead, the footer and the RFC 8058 headers are added in the sender rather than per template, and `leads.unsubscribed_at` is the suppression list every send checks. **18 Oct 2026:** added — before it, the intro, follow-up and evidence-pack emails had no unsubscribe at all, which is the one thing PECR requires of them. `verify-unsubscribe.cts` is the runnable check (`npx tsx verify-unsubscribe.cts`): this tool has no test runner and its SQLite driver has no native build on every machine, so that script drives the real modules over Node's built-in SQLite and a fake SMTP.
- **Backend**: Express modular monolith, 51 module dirs, raw SQL (no ORM), Zod validation (80+ schemas)
- **Frontend**: React 18 + TypeScript + MUI 5 + TanStack React Query + React Router 6
- **Database**: PostgreSQL 15 (pg pool), dual-pool (app role + superuser), AsyncLocalStorage request-scoped clients, RLS enforcement, session timezone set per request from `organizations.timezone` (migration 149, applied in `setRlsSessionVars`) so `CURRENT_DATE` means the provider's day; `DB_TIMEZONE` is only the deploy-time default/fallback
- **Cache**: Redis with in-memory fallback (rate limiter, token blacklist)
- **Realtime**: Socket.IO v4 with JWT auth + DB validation + rate limiting + Redis adapter
- **Auth**: JWT access + refresh tokens issued as `httpOnly` session cookies (`accessToken` 15 min / `refreshToken` 7 days, SameSite=Lax) and accepted as `Authorization: Bearer` for the mobile app and scripts — the web client stores no token; MFA (TOTP/speakeasy), RBAC + permission checks per request
- **Infra**: Docker compose (dev 4 services + prod 6 services), GitHub Actions CI/CD with GHCR + auto-rollback, Prometheus-format metrics (exported, not yet collected — T1-13), Swagger auto-docs
- **AI**: OpenAI + Anthropic adapters, per-org API keys, audit logging

## Current State (Phase 1 — Launched August 2026)

### ✅ Backend Modules (51 directories; the 45 rows below are the Phase 1 set, so a module missing from this table is not a module that does not exist — check `apps/api/src/modules/`)
| Module | Endpoints | Key Features |
|---|---|---|
| auth | 11 | Register, login, MFA challenge, refresh, forgot/reset, me, logout |
| mfa | 5 | Setup (QR), verify, disable, admin-disable |
| orgs | 20 | Org CRUD, locations, departments, teams, branding, subscription |
| organization | 6 | Invitations: send, validate, accept, list, resend, cancel |
| people | 32 | People (SU/carer/family/visitor/emergency), notes, documents, activities, care plans, goals, risk assessments, contacts |
| staff | 18 | Profiles, role/status/skills/qualifications/emergency-contacts, dept assignment |
| compliance | 16 | Docs, evidence packs (KLOE), identity dashboard, trends, mappings, records, PDF |
| scheduling | 42 | Shifts CRUD, assign/claim/swap/approve/reject, templates, min-staff, OT, shift clock-on/off + handover with the visit check-in offline contract (migration 152; blueprint §9.1/§9.2 closed 16 Oct 2026), a 15-minute handover-due sweep that raises `shift.handover_due` for a shift that ended with no handover (migration 154; blueprint §9.9's missing event type closed 16 Oct 2026 — notified to the staff on the shift, kept in Mission Control for the manager, and since 17 Oct 2026 read there as a list rather than only an alert: `GET /mission-control/handover-gaps` returns the shifts that ended with no handover in a 1–30 day window on the sweep's own 30-minute grace, with who was rostered and whether they were nudged, and Mission Control's Compliance tab shows it with a row click through to the shift on the rota), and (17 Oct 2026) the phone-side handover: `HandoverScreen` records/amends with the version history kept, acknowledges as a named reader (never the author), keeps a draft when the send fails, and is reached from the handover-due notification and the Schedule tab's handover list |
| marketplace | 3 | Open shifts, apply, publish |
| reporting | 2 | Compliance audit, staffing stats — reports across 9 categories (staff, people, scheduling, leave, incidents, compliance, training, eMAR, operations) with filters, charts, and CSV export |
| insights | 5 | Overview, staffing, compliance, leave, rota analytics (Recharts on frontend) |
| incidents | 24 | CRUD, categories, involved residents, action items (owners/due/overdue), evidence attachments, near-miss + confidential events (admin-only visibility), CQC reporting fields, audit timeline, admin notifications, AI triage |
| dashboard | 5 | Stats (7 KPIs), compliance snapshot, today-rota, widgets, review scheduler |
| notifications | 6 | List, unread count, mark read (single/all), preferences. **17 Oct 2026:** the inbox is paged — `GET /notifications?limit=&before=&beforeId=` is keyset on `(created_at, id)`, default 20 up to 100, and the body is still the bare array so the web bell and anything already calling it keep working. A fixed `LIMIT 20` used to decide that a carer's thirty-first notification did not exist; an offset page would have been worse (a sweep writing a row mid-read shifts the boundary and skips one). A half or malformed cursor is a 400, because silently returning page one makes "load more" look broken forever. **18 Oct 2026:** the same paging reached the web inbox — `NotificationsPage` loads 30 at a time, continues from the last row on screen, reports the server's own unread total rather than counting loaded rows, and no longer says "No notifications" when the read failed. `GET /notifications/unread-count` is what the header reads. |
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
| dspt | 5 | NHS DSPT: assessment, 11 standards across 4 themes, submit |
| tasks | 4 | CRUD (kanban-style) |
| room-checks | 4 | CRUD with photo upload + MUI ratings, and (17 Oct 2026) the overdue sweep: `modules/room-checks/roomCheckOverdue.ts` derives the rooms that should have a check from the residents' own `room_number`, raises `room_check.overdue` after the provider's own 18:00 for any room with none, and the ledger `room_check_nudges` (migration 155) keeps it to one nudge per room per day — the staff rostered at that location are told, Mission Control keeps the manager's copy (filed and counted under Compliance, labelled "Room Checks"). **17 Oct 2026:** the room numbers are normalised (`room_number_normalized`, migration 156) so "12", "12 " and "Room 12" are one room — before that the sweep could report a room somebody had checked and report one physical room twice — and the nudge is clearable from the phone: `GET /mobile/room-checks/today` (`modules/mobile/mobile.roomChecks.ts`) returns today's rooms with the day's check attached, scoped to the locations the worker is rostered at (the whole provider when they are not), and `RoomChecksScreen` records the check through the existing `POST /room-checks`. The board asks for every room rather than only the unchecked ones, so a shift can see what it has already done |
| events | 5 | Domain event outbox, publish helper, consumer registry, in-process worker, admin endpoints |
| mobile | 5 | GPS check-in, roster (7-day), voice-to-text notes, (17 Oct 2026) `GET /my-shifts` — the carer's own shifts for the week either side with each shift's handover state, because `/my-roster` only looks forward — and `GET /room-checks/today`, the room-check board the phone clears an overdue nudge from (see the room-checks row). **18 Oct 2026:** `/my-shifts` now also carries this carer's own attendance per shift — `clocked_on_at`, `clocked_off_at` and `on_duty` — from the `shift_attendance_events` log, counted clock-ons against clock-offs (not "the latest event") so a replay that lands out of order, or a worker who stepped out and returned, reads correctly. The Schedule tab uses it to say which shift is open |
| families | 12 | People-type family member CRUD + user account linking + invite + dashboard |
| payments | 17 | Invoice CRUD + approve/send/pay + Stripe line items + payment link + portal + webhooks + statement + dashboard |
| expenses | 10 | Petty cash CRUD + approve + stats + reports + dashboard |
| alerts | 4 | Alert rules CRUD + evaluate + acknowledge + preferences |
| audit-trail | 1 | Audit trail viewer (filtered, paginated, exportable) |

### ✅ Frontend Pages (103 `*Page.tsx` files; the 68 described below are the Phase 1 set)
| Area | Pages | Features |
|---|---|---|
| Auth | 7 | Login, Register, Forgot/Reset Password, Verify Email, MFA Challenge, MFA Setup |
| Dashboard | 1 | Role-based KPIs (7 cards), compliance widget, rota timeline, appointments, training/DBS expiry widgets |
| Compliance | 8 | Hub, Identity Monitoring, Competency Assessments (3 tabs), Evidence Packs (KLOE), CQC Readiness (5-domain gauge + AI gap), Records, Satisfaction Surveys, Staff Engagement |
| Scheduling | 1 | Rota Planner (7x24 grid, quick-add) + shift detail: attendance (clock on/off, who was on duty), handover (record/amend, acknowledgement by named staff), and an on-device retry queue for a clock action that never reached the server. **18 Oct 2026 — the phone's half of the shift lifecycle:** `ShiftClockScreen` (mobile) clocks on and off, shows who else is on the shift and the server's counted time, keeps a press that could not be sent under its own `action_key` and replays it as the same action, and leads into the shift's handover; the Schedule tab's shift card carries that state and opens it |
| Leave | 1 | 5 tabs: Types, Requests, Balances, Calendar (with popup), Settings |
| Chat | 1 | DMs/groups, real-time, emoji, files, link preview, read receipts, unread divider |
| People | 3 | Directory, Profile (23 tabs in 6 categories for supported living/residential; 13 in 5 for domiciliary), Health (5 sub-tabs: observations, bowel, dental, fluid intake, sleep) |
| Staff | 2 | Directory (CSV import, filters), Profile (compliance, permissions, assess) |
| Incidents | 2 | Directory (filters, stat cards, near-miss/confidential chips), Detail (AI triage, update, actions, evidence, timeline, delete) |
| eMAR | 2 | Active charts (31-day grid, PRN, stock, daily counts), Archived |
| Settings | 1 | 12 tabs: Profile, Compliance, Leave, Delegates, Org, Billing, Integrations, Schedule, Notifications, Security, AI, Appearance |
| Payments | 1 | Invoice list, create, detail, customer portal |
| Expenses | 1 | Petty cash list, create, detail, reports |
| Other | 20+ | Appointments, Goals, Policies, Care Assessments, Tasks, Room Checks, Marketplace (x2), Agencies (5 tabs), Reporting (**40 live reports across 9 categories** — corrected 16 Oct 2026, it said "6 template cards"), Insights (**6 sections** — overview cards, staffing, compliance, leave, shifts, care outcomes; corrected 16 Oct 2026, it said 5), Training Matrix (4 tabs), DSPT (4 themes/11 standards), Billing (Stripe), Onboarding, Organization (4 tabs), Family Portal, Mobile (GPS + Voice Notes), Learning Center, Legal (3), Marketing (7), Landing, Survey Form, Errors (2) |

### ✅ Infrastructure
| Component | Status |
|---|---|
| Docker compose (dev) | ✅ 5 services (postgres, redis, api, web, uptime-kuma) with health checks + volumes — corrected 16 Oct 2026, the row said 4 and omitted the uptime service |
| Docker compose (prod) | ✅ 6 services (web — which is nginx, api, postgres, redis, backup, uptime-kuma) with health checks + volumes. **Corrected 16 Oct 2026:** this row previously listed nginx and prometheus as separate services; neither exists — nginx is inside the web image, and no Prometheus is deployed anywhere (T1-13). |
| CI (GitHub Actions) | ✅ Lint + typecheck + test + build + Docker push to GHCR + deploy with auto-rollback |
| Redis | ✅ In-memory fallback (rate limiter, token blacklist) |
| Socket.IO | ✅ JWT auth, DB validation, rate limiting, membership gating, online presence, Redis adapter |
| Prometheus metrics | 🟡 Histograms + counters, exposed at `/metrics` — behind `METRICS_SECRET` in production, and **scraped by nothing**: there is no Prometheus in either compose file, no alert rules and no dashboard (T1-13). The format is emitted; the collection is not built. |
| Swagger docs | ✅ Auto-generated from router stack |
| File uploads | ✅ Multer + UUID names + MIME allowlist + extension/magic-byte blocking |
| Email | ✅ 20+ branded templates, Nodemailer SMTP, DB-backed queue with retry. **Added 18 Oct 2026 — the way out, and an audit of who needed one:** every send is classified at the point it is queued. Transactional mail (password resets, verification codes, MFA notices, invites, payslips, receipts, invoices, payments, family-portal access links, statutory data-retention notices) carries no unsubscribe, because there is nothing to stop. Operational mail (reminders, digests, alerts, shift and rota notices, compliance and stock warnings) arrives as `sendNotificationMail`/`sendEmail(..., 'notifications')` and lifecycle/winback/trial/nurture mail as `sendMarketingMail`; both get a signed unsubscribe line in the footer, the RFC 8058 `List-Unsubscribe` pair on the queued row, and a send-time skip for an address that has already opted out of that scope. `users` rows are never the key — the address is, because a leaver's account is gone exactly when they are most likely to ask. Migration 158 (`email_opt_outs`) plus `shared/utils/emailUnsubscribe.ts`, `POST|GET /email/unsubscribe` (public) and the web page at `/unsubscribe`. The `List-Unsubscribe` URL points at the API and not at the page: a static shell answers a POST with HTML and a 200, which tells the recipient they are unsubscribed while the digest keeps coming. **Audit finding:** `EmailService.sendEmail` used to add no link at all, and the compliance reminders, the manager review notices, the family-feedback prompt and the homecare family feedback invite all went through it — those now pass `'notifications'`, and the calls that reply to someone's own enquiry or grant a one-off access link deliberately pass nothing. |
| Stripe | ✅ Customer/price auto-provisioning, webhook, test/live gating |
| Encryption | ✅ AES-256-GCM per-org key derivation |
| HTTPS | ✅ Optional cert-based |
| PWA | ✅ Service worker, manifest, offline caching, installable, GPS/voice pages |
| Testing | ✅ **2,464 tests in one CI run on 16 Oct 2026** — 2,465 counting one web helper test that runs outside the whole-suite web run: API 168 files / 1,631, web 67 files / **511**, mobile 40 suites / 322. **Corrected 16 Oct 2026:** this row said "web 512" and totalled 2,465, which included a test the whole-suite web run does not; that mismatch is the drift the feature-readiness audit flagged in §3.5. The per-module table further down is the Phase 1 count (395) and is stale as a breakdown — trust the totals and the suites themselves. **Also 16 Oct 2026:** the DBS phase-0 work added two API test files (the certificate-retention integration suite and the metadata-only source guard) and one web test file, so the file counts are now 170 and 68 — the test totals above are CI's and were not re-measured, while the DBS module itself measures 57 tests across 5 files. **17 Oct 2026:** the retention-stall work re-wrote the alert suite (4 tests) and added the room-check-overdue suite (API: `roomCheckOverdue.integration.test.ts`, 6 tests) plus two mobile suites (`notificationLinks.test.ts` and `NotificationsScreen.test.tsx`, 13 tests) and three cases in `App.test.tsx` — the CI totals above are unchanged until CI next runs, and these counts were measured locally, not in CI. **Later on 17 Oct 2026:** the mobile suite as a whole measures **45 suites / 369 tests, green** (the launch-notification reader and its 8 tests, the notifications screen's unread-reporting cases, and the handover screen's 8 tests plus the Schedule tab's handover-state cases, are included); the API and web numbers above are still the 16 Oct CI figures. The API gained `mobile.integration.test.ts` cases for `/my-shifts` (now 8 tests in that file) and a compliance-category case in the Mission Control suite. **Latest on 17 Oct 2026, measured locally:** the mobile suite is **46 suites / 380 tests, green** (adds `RoomChecksScreen.test.tsx`, 6 tests, and the notifications screen's older-page cases; `/room-checks` now opens the board, so the App and link suites assert that instead of the web fallback). The API gained `shared/jobs/heartbeat.integration.test.ts` (5), `mobile/mobile.roomChecks.integration.test.ts` (6) and two cursor cases in `notifications.integration.test.ts`. **Measured locally later on 17 Oct 2026:** web is **75 files / 560 tests, green** (adds `StaffProfilePage.deepLink.test.tsx`, the Update Service panel and compliance-section suites; the palette audit passes again now that the mobile notification icons take their colours from the shared `CHART_PALETTE`), and the mobile suite is 46 / 380. The API's whole-suite count is still the 16 Oct CI figure. **18 Oct 2026, measured locally:** the mobile suite is **48 suites / 399 tests, green** — it adds `ShiftClockScreen.test.tsx` (12) and `shiftClockQueue.test.ts` (6) plus two clock-state cases in `WeekScreen.test.tsx`, and `mobile.integration.test.ts` gained the per-shift attendance case (9 tests in that file). The API and web suites were not re-measured. |
| Postgres RLS | ✅ AsyncLocalStorage + dual-pool + RLS policies on all tables |
| Migrations | ✅ 103 files on disk (numbered to 155), versioned with checksums. **Added 16 Oct 2026:** 152 (shift attendance and handover), 153 (DBS certificate metadata — it also backfills a retention date onto existing rows that hold certificate information) and 154 (`shifts.handover_due_notified_at`, the handover-due sweep's one-shot marker). **Added 17 Oct 2026:** 155 (`room_check_nudges`, the ledger that lets the room-check-overdue sweep say "this room, today" once), 156 (the generated `room_number_normalized` columns on `people` and `room_checks`, plus the index the room-check queries read), 157 (`job_heartbeats`, the per-job record of when work last started, completed and succeeded). **Added 18 Oct 2026:** 158 (`email_opt_outs` — the address, the scope it opted out of, and `email_queue.headers` for the `List-Unsubscribe` pair). **Corrected 16 Oct 2026:** the count said 97 to 149, and six of the files on disk are in no registered list at all — 053, 063, 064, 102, 103 and 116. The runner refuses a late insertion below the applied watermark, so an unregistered migration never applies anywhere: 102's column (`organizations.compliance_warning_days`, read by the compliance reminders) did not exist in any database and was silently defaulted to 14 days, re-stated as migration 151; 103's table (`family_feedback`) is still absent, so the family-feedback endpoints fail — see the audit follow-up list. |
| Monitoring | ⚠️ Uptime Kuma **is** deployed (loopback-bound) but whether it has monitors is invisible from the repo (T0-4); `monitor/health_check.py` emails on container failure via cron, unverified in production; `/metrics` is exported and unscraped (T1-13). **Added 17 Oct 2026 — as far as a scheduled job's own absence:** `shared/jobs/heartbeat.ts` + migration 157 record when each declared job (`EXPECTED_JOB_CADENCE`) last started, completed and succeeded, so "nothing to do" and "did not happen" stop being indistinguishable. `GET /health/jobs` reports it unauthenticated (job names, timestamps and summaries only — never provider data, and 200 even when late, because a health check that fails would restart containers instead of reporting the job), the API logs a stale job hourly, and a stalled DBS retention sweep raises the over-retention alert per provider from the data itself rather than from the missing run. A run that completed and failed is *not* stale — it ran — and `last_success_at` keeps that apart from a good run. The monitor still does not poll `/health/jobs`: nothing consumes the reading but the API log and the DBS alert |

### ✅ Seed Script (`seed-orbis.ts`)
Creates a fresh demo org with random name each run (~1,550 rows total):
- 22 staff (1 ORG_ADMIN, 3 MANAGER, 18 CARE_WORKER) — email: `firstname.lastname@orbisgroup.care`, password: `***REMOVED***`
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

### ✅ Test Suite

**Totals as measured by CI on 16 Oct 2026:** API 168 files / 1,631 tests, web 67 files / **511** tests in the whole-suite run (plus one helper test added after it, verified on its own with its file and the source guards — 512 counting that), mobile 40 suites / 322 tests — **2,464 in one run, green; 2,465 counting the helper test.** **Corrected 16 Oct 2026, per the audit's §3.5 drift list:** the previous wording listed web 512 and totalled 2,465, so the total and the suites did not agree. A fresh local re-measurement of all three suites was attempted on 16 Oct and **not** completed — the web suite alone exceeded thirteen minutes under load and running the API suite alongside it exhausted the Node heap — so these stay CI's numbers rather than a new local count; re-measure before quoting them in another document. The per-module breakdown below is the Phase 1 count and has not been re-attributed since; new modules (homecare, mission-control, supervisions, shift-audit, rbac, reviews, contact, shift-marketplace) appear in the suites but not in this table.
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
| **DBS API integration** | No GBG/uCheck partnership for automated DBS checks. **Corrected 16 Oct 2026:** everything that needs no partner now ships — the **Update Service re-check workflow** (consent-led subscriptions, recorded status checks, renewal marker, due-date reminders, migration 150) and **all of phase 0** (`docs/DBS_INTEGRATION_PLAN.md` §5): the permitted certificate metadata (migration 153, `PATCH /dbs/checks/:id/certificate`), the six-month retention purge that deletes it on a nightly sweep and never extends a deadline, and the compliance screen's *MeticleCare does not submit DBS checks yet* notice with Submit/Poll disabled. What is missing is submission itself — a partner and the adapter (phases 1–2) — plus the one production query nobody has run: whether any organisation already polled a `MOCK-%` check. |
| **SMS notifications** | No Twilio — currently email-only |
| **PrintNode printing** | Physical document delivery |
| **Document Drive** | File management UI for evidence packs |
| **Family Portal Finances** | **Corrected 16 Oct 2026:** there is no finances tab and no placeholder — searching `FamilyPortalPage.tsx` for finance, invoice or payment returns nothing, and its tabs are Visits, Care Notes, Care Plans, Goals, Health, Medications and Contact. The capability is absent rather than stubbed, so this needs a decision (build it, or keep invoices out of the family portal deliberately), not a fix. |
| **Payroll integration** | **Corrected 16 Oct 2026:** timesheets themselves ship — `GET /homecare/timesheets`, `/timesheets/pending`, `/timesheets/monthly-totals`, `/timesheets/carer/:staffId` and `PATCH /timesheets/:id` (approve/reject), with `PayrollExportPage` (status filter, export, payroll-import confirmation) and the carer's `MyEarningsPanel` and payslip PDF. What is missing is integration with a payroll *provider*: the export is imported into whatever the provider runs, so there is no direct feed to Xero, Sage, BrightPay or similar. |
| **Monitoring & Alerting** | Metrics are exported but nothing collects them; no alerting rules, no dashboards, no verified uptime checks (T1-13, T0-4) |

**Listed here in error until 16 Oct 2026, now removed: Staff 1-2-1s.** One-to-one meeting records, action tracking and review scheduling are built — the `supervisions` module (controller, routes, integration tests) and `SupervisionsPage`, with review scheduling served by `GET /dashboard/review-scheduler`. Reporting it as a gap understated the product.
