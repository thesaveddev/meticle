# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Registered managers** (ORG_ADMIN / MANAGER): run care operations end to end — rota, medication (eMAR), compliance evidence, leave, incidents, training. Work in the office and on the go.
- **Care workers** (CARE_WORKER): claim shifts, log care notes, take medication records, check in on the mobile/PWA surfaces, and communicate with the team.
- **Relatives & families**: read care notes, care plans, goals, and observations through the Family Portal.
- **Owners & operations leads**: oversight via reporting, insights, billing, and CQC readiness.

## Product Purpose

MeticleCare is a connected care-management platform for UK supported living providers. It runs the whole care working day — rota, medication, notes, compliance, leave, incidents, training — from one platform, with multi-tenant isolation. Success means a care team can run their entire operations day credibly from one connected system: every shift staffed safely, every medication given and recorded, every note captured at the point of care, every compliance claim backed by real records.

## Positioning

One honest, connected platform for UK care operations, grounded in the records the team already keeps. It refuses the metric-stacked, icon-card SaaS default: every claim is supported by real data (live compliance snapshots, real rota, real evidence packs, CQC readiness scored from actual records), and every role sees the surface shaped for the part of the day they own.

## Operating Context

- UK supported-living providers, CQC-regulated, working across 3+ locations with shifts, departments, and teams.
- Shift-based staffing: rota planner with min safe staffing per location, 11-hour rest enforcement, overtime, conflict blocking.
- Care is recorded at the point of care — daily notes, observations, MAR administrations, room checks, incident reports — often on phones/tablets (PWA with GPS check-in and voice-to-text).
- Compliance is continuous: evidence packs (KLOE), identity monitoring, training matrix, competency assessments, DSPT, policies.
- Real-time teamwork: chat with presence, read receipts, typing indicators; notifications for OT, delegations, and assignments.
- Multi-tenant: orgs are isolated (tenant helpers today, RLS policies enforced on all tables via dual-pool + AsyncLocalStorage).
- Finances flow through Stripe subscriptions, agencies billing, and payroll/timesheet work-in-progress.

## Capabilities and Constraints

- Backend: Express modular monolith, 37 modules, raw SQL (no ORM), Zod validation, Redis cache (in-memory fallback), Socket.IO realtime with JWT auth + DB validation + rate limiting, Prometheus metrics, Swagger auto-docs, AES-256-GCM per-org encryption.
- Frontend: React 18 + TypeScript + MUI 5, TanStack React Query, React Router 6, ~50 pages, PWA offline.
- Auth: JWT access + refresh, MFA (TOTP), RBAC + per-request permission checks; role changes reflect instantly via `/auth/me`.
- Role rules: ORG_ADMIN promotes other ORG_ADMINs; MANAGERs cannot change own role; manager cannot self-approve leave; manager/admin leave routes to a different ORG_ADMIN with fallback to any other.
- Chat: channels (general/group/dm), messages, files, link previews, reactions, read receipts, presence, member management.
- Email: branded HTML templates, DB-backed queue with retry.
- Constraints: no eye icons for "view" affordances (OpenInNew/Download instead); cards/rows open read-only detail dialogs on click; error messages inside modals; tables paginated; buttons have loading spinners; guard `npx tsc --noEmit` in both apps/web and apps/api.

## Brand Commitments

- Name: MeticleCare.
- Two-key color system: deep navy `#0F4C81` identity + single emerald `#10B981` accent; everything else warm neutral (bone `#F7F4EE` grounds, white, charcoal ink `#1B2430`, hairline `#E7E1D6`). No third hue (no purple, cyan, orange accents).
- Inter across 400–900 only; hierarchy by weight, tracking, case — no second typeface.
- Editorial 1px hairlines; flat surfaces; deep-ink seated shadows reserved for floating objects; emerald only as small marks / focus ring.
- Voice: serious care software for people who read paper.

## Evidence on Hand

- Seed script (`apps/api/src/scripts/seed-orbis.ts`): full demo org with 22 staff, 18 service users, shifts, eMAR, leave, incidents, training, compliance records.
- `DESIGN.md`: marketing-site design contract (editorial-operations world, palette, typography, layout).
- Real backend data models across all 37 modules (no fabricated metrics; KPIs computed from live data).
- CI: GitHub Actions lint + typecheck + test + build.

## Domiciliary care package — Phase 2

MeticleCare is extending from supported living into community-based care delivered in a person's own home. The first sellable slice is intentionally operational rather than promotional: package definition, scheduled calls, assigned carers, point-of-care visit execution, travel/mileage capture, and manager-approved payroll inputs.

### Who this serves

- **Care coordinators and registered managers:** build packages, define morning/breakfast/routine/evening calls, assign carers, see exceptions and approve time/mileage.
- **Domiciliary carers:** receive a clear day route, enough travel notice, and a fast mobile check-in/out flow that works at the point of care.
- **Payroll/finance teams:** receive approved work minutes, paid travel minutes, mileage and configured gross-pay inputs rather than an unreviewed “automatic payroll” number.
- **Clients and commissioners:** receive consistent visit records, package dates, funding context and an auditable account of delivered/cancelled visits.

### Phase 2 operating model

1. A manager creates a client-linked package with funding source, dates, weekly hours and organisation-approved care/travel/mileage policy.
2. The coordinator defines call patterns: morning, breakfast, lunch, tea, evening, night, routine, medication-support or custom.
3. Each visit is assigned to an active carer and has a scheduled start/end plus travel buffer.
4. The carer sees assigned visits on mobile, checks in/out only for that visit, records actual travel/mileage and adds a factual visit note.
5. A manager reviews late/missed calls, records a resolution note, and approves timesheet inputs before downloading an approved-only payroll CSV.

### Current Phase 2 tranche

- Recurring call patterns can generate visits for a bounded date range without duplicates.
- Assigned default carers are checked against recorded weekly availability and overlapping homecare visits are rejected.
- Missed, cancelled and late visits appear in a manager exception queue until a resolution note is recorded.
- Payroll CSV export includes only manager-approved timesheets and is explicitly an input for payroll review, not a statutory payroll replacement.
- Carers check in and out online or offline: queued actions show an explicit sync status and sync automatically when connection returns, with server-side idempotency preventing duplicates.
- Carers can report travel or safety disruptions per visit; high-severity issues prompt office contact and surface in a manager queue.
- Managers record weekly carer availability from the homecare page; generation validates availability before assigning.
- Visit reminders reach carers by email and browser push inside the travel-buffer window, each with an independent retry ledger and per-device opt-in in Settings.
- Missed-visit follow-ups can be logged as client/family communication (with outcome) or linked to an incident, keeping the escalation audit in one place.

### Confirmed operating policies (September 2026)

- **Travel pay:** configurable per organisation, set per care package at creation. NMW treatment of between-client travel remains the employer's adviser-reviewed decision.
- **Payroll exports:** launch with five named providers — Sage, Xero, QuickBooks, BrightPay and Staffology — plus a generic CSV. Exports reconcile against a per-timesheet ledger recording exported and reported gross pay.
- **Mileage rates:** configurable by tax year, vehicle type (car, motorcycle, bicycle, public transport, other) and fuel category (petrol, diesel, hybrid, electric, LPG, n/a, other), with effective dates. HMRC rates are reference values, not hardcoded entitlements.
- **Reminder channels:** email, browser push and SMS are all planned; email and push are live, SMS follows once a provider, sender identity and consent policy are approved.
- **Missed/severely delayed visits:** follow the CQC-aligned escalation standard — carer reports, duty manager is alerted in real time, client/family contact attempts are recorded, escalation follows the provider's on-call/safeguarding policy, and every step lands in the visit follow-up ledger.
- **Visit GPS:** point-in-time check-in/out coordinates only, part of the immutable visit audit record, retained with care records per the organisation's retention policy (Records Management Code of Practice 2023 baseline: commonly 8 years after the last entry). No continuous or off-duty tracking.
- **VAT:** pricing will support configurable VAT-inclusive/exclusive display per billing account before any domiciliary price is published or invoiced.

### Safeguards and policy boundaries

- Travel between client assignments is represented separately from ordinary commuting and can be marked paid according to the employer's reviewed policy; payroll/legal advice is required before configuring a provider's rules.
- Mileage is recorded as actual mileage and rate against configurable tax-year/vehicle/fuel policy tables rather than a hardcoded statutory promise.
- GPS is event-based, visible to staff, limited to active work, access-controlled and retained only for the documented operational/safety purpose. Continuous off-duty tracking is not part of the product.
- A visit record does not administer medication, make a clinical decision or silently complete a missed call. High-risk care actions remain under the existing care-plan/eMAR and human approval workflows.
- Statutory PAYE, National Insurance, pension, holiday pay, deductions and payslip production require a payroll-provider integration or qualified payroll review.

### Commercial proposal to validate

A private domiciliary-care quote has been retained as an internal planning guide only. It must remain hidden from the product UI, public website, demo data, customer-facing documents and Stripe configuration until the offer is approved. Before publication or billing, confirm VAT treatment, minimum commitment, active-seat definition, whether it supplements the existing plan, and whether mobile/GPS/payroll exports are included or add-ons.


1. Records are the product: every compliance claim, insight, and readiness score must be backed by real data the team already keeps.
2. One working day, one platform: the rota, medication, notes, and compliance must feel like one connected system, not a portal of apps.
3. Safe operations over convenience: min safe staffing, rest windows, conflict blocking, and delegation rules are enforced, not suggested.
4. Isolation by default: org boundaries hold at the data layer, and roles gate every action.
5. The point of care is primary: phones and tablets in the field are first-class surfaces, not afterthoughts.

## Accessibility & Inclusion

- Keyboard-reachable everywhere; focus-visible ring on interactive elements.
- Contrast pairs target AA/AAA on the two-key palette (ink on bone ~13:1, mist on white/bone AA).
- `prefers-reduced-motion` honored (skip entrances, disable pulses).
- Inter at 400–900; readable secondary copy at relaxed line heights.
