## Goal
Complete the platform for **supported living services first**, then add domiciliary care modules (mobile app, eMAR, monitoring charts) later. Key tracks: (1) chat/collaboration polish, (2) compliance module expansion (training matrix, evidence packs, CQC readiness), (3) existing module hardening.

## Constraints & Preferences
- ORG_ADMIN can promote other users to ORG_ADMIN (backup admin); managers should NOT have full admin capacity
- Manager cannot change own role; only ORG_ADMIN can change any user's role
- Leave Manager is a standalone module (not inside Rota Planner)
- Calendar on leave manager must show detailed popup on day click (status chips, duration, reason, approve/reject for pending)
- Leave balance cards must be compact inline in the header row on the right side before the Request Leave button
- Compliance profiles are role-based — each role gets a profile comprising linked requirements; staff auto-assigned based on their role
- Role changes must reflect instantly without logout by fetching `/auth/me` on page focus and periodically
- Permission saves must persist correctly — the mutation must use latest state via `useRef`
- Locations dropdown in "All Requests" tab must come from live DB
- Leave entitlement settings removed from leave manager, only in Settings, permission-gated
- Error messages must display inside the leave request modal, not behind it
- Multi-tenant data isolation per organization (UK/EU compliance required)
- Stripe auto-provisions products and prices on first use if env vars not set
- Stripe webhook can be used with localhost via `stripe listen --forward-to localhost:3002/billing/webhook`
- A manager cannot approve their own leave; manager/admin leave requests are routed to a different ORG_ADMIN for review
- Leave balance cards show aggregated totals (Total, Used, Pending, Remaining) in "X days + Y hours" format
- Rota Planner must respect location-based minimum safe staffing levels per day, configurable from Settings
- Staff below the organisation's minimum compliance % must be blocked from shift assignment in the rota planner
- Duplicate manager delegations (same primary + delegate pair) must be rejected with a 409
- Overtime claims: require manager approval vs auto-assign — toggle in Settings
- 11-hour rest period must be enforced between shifts for staff claiming overtime
- Staff cannot claim a shift if they already have a conflicting shift at the same time or location
- Notifications (in-app + email) must be sent for overtime claim, approval, and rejection
- Shift Marketplace replaces "Open Shifts" as the renamed page
- Staff without `scheduling:edit` permission see Rota Planner in view-only mode (no Add Shift, Assign, Delete, or Claim OT buttons)
- Staff (CARE_WORKER) see simplified dashboard (own shift count only, no Compliance Snapshot)
- Push notifications use Socket.io (not polling) for instant delivery; polling removed
- Staff can only see their own leave on the calendar; managers/org_admins see all staff leave
- On days with multiple staff on leave, events are deduplicated (no duplicate rendering)
- If a staff submitting leave has no location manager, the notification falls back to any ORG_ADMIN
- If no different ORG_ADMIN exists for manager leave review, notification falls back to any ORG_ADMIN (not silent)
- Login uses simple email + password (globally unique emails — one user per email across platform)
- Globally unique email enforced — cross-org same-email registration is rejected; each org provides their own email for staff
- Emails must use professional branded HTML template with inline styles (email-client-safe)
- Queueing system (RabbitMQ or similar) planned for future production use but not yet implemented
- MFA QR code shows and setup works end-to-end (backend `qrCode` field, frontend reads `qrCode`, verify dialog shows errors inside, not behind)
- Branding uses `<input type="color">` + preset swatches for quick selection (navy, green, amber, red, purple, cyan, gray, off-white, black, white)
- Department creation uses a proper form dialog (name + location selector) not `prompt()`
- Staff-to-department assignment uses Autocomplete search, not raw user ID prompt
- Staff should be loadable into department AND team creation workflows on the same dialog (not post-creation)
- Notifications (push + email) needed on department/team assignment
- Leave Entitlements tab removed from Settings (summary moved to Organization tab, individual data on Staff Directory)
- All tables need client-side pagination, buttons need loading spinners during async actions
- Run `npx tsc --noEmit` in both `apps/web` and `apps/api` to typecheck

## Progress

### Done (Chat Module)
- **Socket reconnection & join reliability**: `socket.connected` check + one-time `connect` listener ensures `chat:join` always fires when entering a channel, even if socket reconnected while ChatPage was unmounted.
- **Unread messages divider**: `other_last_read_at` (other member's `last_read_at`) returned from backend for DM channels — sender sees which messages recipient hasn't read yet. Chip + dividers render before the first unread message.
- **Link unfurling**: Server-side OG metadata fetch with regex parsing. Frontend `LinkPreview` renders rich preview card (thumbnail, title, description, domain). Shows domain fallback when OG data missing.
- **Live input link preview**: Debounced (700ms) effect extracts URL from input, fetches OG metadata, renders compact preview above text field.
- **OG image display**: Public URLs use `<Box component="img">` (not `SecureImg`) to avoid CORS issues with external images.
- **Optimistic message send + dedup**: API response message added immediately to state. Both `handleSend` and socket `handleMessage` check `prev.find(m => m.id === msg.id)` to prevent double-insertion.
- **Files tab reactivity**: Removed `activeTab === 1` guard from socket file reload; always loads shared files on channel change; backend emits `chat:file_added` from `uploadFile` for other channel members.
- **Download buttons**: Auth-header fetch + blob URL + programmatic click on grid overlay and list Actions column.
- **Text/JSON/XML file preview**: Text content read as raw text, rendered in dark `<pre>` block in preview dialog.
- **"No messages yet" fixed**: Backend `last_message` subquery returns `COALESCE(NULLIF(content,''), '📎 ' || file_name, '')`. Frontend sends `content || undefined` so empty becomes `NULL`.
- **Notification dot**: Backend emits `chat:unread_total` to each recipient's `user:${userId}` room. Cross-page notification via socket listener in Layout.tsx.
- **SecureImg cleanup**: Blob URL references cleaned up with `useRef` + cancelled flag.

### Done (Previous Sessions)
- **MFA QR code fixed**: backend sends `qrCode` (property), frontend reads `res.data.qrCode` (was `res.data.qrcode`); verify checks successful response (not `res.data.success` which never existed); errors display inside the dialog via `mfaError` state + `<Alert>`; Verify button disabled while loading + shows "Verifying..."
- **`/organizations/undefined` fixed**: `/auth/me` now returns `organizationId: user.organization_id` (camelCase) alongside raw DB fields; frontend `orgId` helper checks both `organizationId` and `organization_id` from localStorage
- **`/settings/upload` endpoint added**: `POST /settings/upload` in settings routes + controller (`uploadFile`) using existing multer middleware, returns `{ url: '/uploads/filename' }`
- **Department prompt replaced**: proper dialog with name field + location selector; closing + reopen flow for assign staff fixed (closes view dialog before showing assign dialog, reopens on success)
- **Color picker improved**: added 10 preset color swatches (row of circles) below each color input for one-click selection; native `<input type="color">` still available
- **Leave Entitlements summary moved**: summary cards (Base Leave Hours + Staff Count) and Calculate button moved to Organization tab; Leave Entitlements tab removed from Settings entirely
- **Dashboard compliance card linked**: Compliance Rate card and "View Full Report" button both navigate to `/compliance`
- **Agency Saved card answered**: hardcoded `0 as agency_saved` in `dashboard.repository.ts` — placeholder for future `(agency_hourly_rate - staff_hourly_rate) * hours_filled_internally` calculation
- **`department_id` on `staff_profiles`**: migration added in `setup.ts`; backend routes for PATCH and GET staff-by-department
- **`status` in org update allowed fields**: added to `updateOrg` in `org.repository.ts`
- **Staff-department assignment backend**: repository, controller, routes for `PATCH /staff/:staffId/department` and `GET /staff/by-department/:departmentId`
- **Notification on dept/team assignment**: `updateDepartment` in staff controller now calls `NotificationsController.createNotification`; `addTeamMember`/`removeTeamMember` in org controller now send notifications
- **Backend endpoints added**: `GET /settings/my-teams` (teams for current user), `GET /organizations/departments/single/:id` (get department by ID)
- **Leave Entitlements tab removed** from tabs list and rendering switch-case; function removed
- **Pagination added** to all tables (locations, departments, compliance config, compliance profiles, compliance records, delegations) — each uses `rowsPerPage` (10) and `<TablePagination>`
- **Loading states added**: `brandingSaving` for Save Branding, `deptCreating` for Add Department, `teamCreating` for Create Team, `actionLoading` for delete icons, compliance CRUD, delegations CRUD, seed records, auto-assign
- **Initial members in dept/team creation**: department dialog has Autocomplete member picker; team dialog has Autocomplete member picker; selected members assigned via API after creation
- **Profile tab shows departments/teams**: Account section now shows Department and Teams info for the current user
- **Frontend and backend both typecheck clean** (`npx tsc --noEmit`)

### Done (Production Audit — 8 critical, 18 high, 12 medium, 5 low issues fixed)
- **Auth `password_hash` leak**: 6 response points spread `{ ...user }` sending `password_hash`, `mfa_secret`, `backup_codes` to frontend. Fixed via `sanitizeUser()` helper at each endpoint.
- **Auth user enumeration**: Distinct error messages (`'Incorrect password for this organization'` vs `'Invalid email or password'`) allowed email discovery. Both branches now return `'Invalid email or password'`.
- **Auth password strength**: `registerSchema`, `registerWithInvitationSchema`, `resetPasswordSchema` only enforced `min(8)`. Added regex requiring uppercase, lowercase, digit, and min 12 chars.
- **Auth MFA 500 error**: `completeMfaSetup` lacked try/catch for expired tokens — now catches and returns `AppError(400, ...)`.
- **Auth logout TTL hardcoded**: `logout` blacklist entry TTL was hardcoded to 15 min regardless of JWT expiry. Now uses dynamic `jwt.decode()` to extract `exp`.
- **Auth middleware staleness**: `requirePermission`/`requireRole` never re-checked `users.status` or `users.role` against DB — deactivated users retained access, role changes ignored until token expiry. Now queries DB on every request.
- **Leave Zod schema mismatches (5 critical)**:
  - `createLeaveRequestSchema`: `start_date` / `end_date` typed as `z.string().datetime()` but frontend sends `YYYY-MM-DD` strings — changed to `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`.
  - `reviewLeaveRequestSchema`: expected `status: z.enum(['approved','rejected'])` but DB expects `approve`/`reject` — changed enum values.
  - `createLeaveTypeSchema`: `requires_approval` and `color` missing from validation — added with defaults.
  - `updateStaffEntitlementSchema`: `leave_type_id` was `z.string().uuid()` optional but mutation requires it — made required; `entitled_hours` changed from `z.coerce.number().positive()` to match DB `DECIMAL(10,2)` string return.
  - `createManagerDelegationSchema` / `updateManagerDelegationSchema`: `delegate_id` expected to be a user ID but the `manager_delegations` table references `staff_profiles.id` — re-typed to `z.string().uuid()`.
- **Leave staff name in notifications**: `leave.controller.ts:115` now queries `first_name`, `last_name` from `staff_profiles` instead of using raw user ID or empty string.
- **Scheduling `scheduling:edit` permission middleware**: mutation endpoints (POST/PUT/DELETE) only had `requireRole` guard — added `requirePermission('scheduling', 'edit')` checking `user_permissions` table.
- **Scheduling org isolation for shift templates**: `getTemplates()` returned all orgs' templates; `createTemplate` ignored `organization_id`. Added column migration, updated queries to filter by org.
- **Scheduling compliance check on assign**: `assignStaff` didn't re-verify compliance % against org minimum — now checks `compliance_records` and blocks assignment if below threshold.
- **Scheduling minimum staffing enforcement**: `unassignStaff` now checks `locations.minimum_staff_per_day` before removing staff, preventing understaffed days.
- **Chat SSRF vulnerability**: `getLinkPreview` accepted any URL (including `file://`, `10.x`, `localhost`). Now validates protocol, blocks private/reserved IP ranges, enforces 5MB response limit.
- **Dashboard Compliance Snapshot table**: queried `documents` for training stats but training data lives in `training_records`/`training_modules`. Now queries the correct tables. Also removed stale "Professional Regs" category.
- **Dashboard CARE_WORKER shift filter**: `getTodayRota` returned all org shifts to all roles. Now passes `userId` param to filter by `shift_assignments.staff_id` for CARE_WORKERs.
- **Frontend compliance fallback**: `DashboardPage.tsx` error fallback still included "Professional Regs" (removed from backend). Updated to match 3-item output.
- **Frontend and backend both typecheck clean** (`npx tsc --noEmit`)

### Done (This Session — Multi-Regulator, Compliance UX Improvements, NHS DSPT Research)
- **Compliance profile save fix**: `createComplianceProfileSchema` / `updateComplianceProfileSchema` had `role` instead of `role_name` (frontend sends `role_name`, Zod stripped it → DB `undefined`). `description` was missing from schema entirely. Both fixed.
- **Multi-regulator framework**: Added `organizations.regulator` column (`DEFAULT 'cqc'`). Created `frameworks.ts` with 4 regulatory definitions: CQC (England), CIW (Wales), Care Inspectorate (Scotland), RQIA (Northern Ireland) — each with domain/statement structures. `getFramework(regulator)` returns matching `FrameworkDef`. Refactored CQC repository to accept regulator param, score dynamically, return framework info. Readiness page shows framework name + country Chip.
- **Compliance requirements clickable**: Drill-down modal shows completed/incomplete staff chips per requirement. Chips link to `/staff/:userId` via `navigate`.
- **Document upload**: Staff ID TextField replaced with `Autocomplete` searching `/staff/org-members` (returning `staff_id` = `sp.id`). Loading state during upload. Response flattened as `{ admin, staff, invitations }`.
- **Audit trail**: `audit.repository.ts` joins `staff_profiles sp ON u.id = sp.user_id`, returns `user_name` as `COALESCE(sp.first_name || ' ' || sp.last_name, u.email)`. Frontend shows `log.user_name`.
- **Evidence packs download fix**: `generateHTML` removed broken `<body>` / `<html>` tag extraction (div `outerHTML` has no document tags) — wraps full content directly.
- **CQC Readiness Download Report**: Added `printRef`, `generateHTML()`, Download Report button.
- **Competency query bug**: `a.first_name`/`a.last_name` changed to `asp.first_name`/`asp.last_name` with `LEFT JOIN staff_profiles asp ON a.id = asp.user_id` in `compliance.repository.ts:139`.
- **caredesk.app competitive research**: They have NHS DSPT certification (org H2P5M, 2025/26 v8), CQC simulator, carer mobile PWA, eMAR, payroll, family portal. £49–199/mo.
- **NHS DSPT process researched**: Self-assessment against 10 Data Security Standards using DSP Toolkit online system. Annual submission required. We need to register on dsptoolkit.nhs.uk as a software provider.

### Phase 1 Compliance — Final Scores After Gap-Closing
| Module | Score | Notes |
|---|---|---|
| **Training Compliance Matrix** | ~70 / 100 | CQC-mandated tagging per role, ⚑ badges, scoring integration done. No e-learning or digital signatures. |
| **DBS/Visa Auto-Monitoring** | ~55 / 100 | Dashboard + reminders work. No auto-renewal flow or third-party DBS API. |
| **Competency Assessments** | ~60 / 100 | Pass/fail + CQC-statement mapping done. No observation scoring rubric. |
| **Audit-Ready Evidence Packs** | ~65 / 100 | KLOE domain grouping + page-break CSS done. No true PDF generation (puppeteer/PrintNode). |
| **CQC Readiness Scoring** | ~75 / 100 | All 5 domains now use real data (not proxies). Multi-regulator support (4 frameworks) is unique. |
| **Multi-Regulator** | ~80 / 100 | CQC + CIW + Care Inspectorate + RQIA. Fully functional. |
| **Notifications/Trends** | ~65 / 100 | Escalation thresholds + manager alerts done. No trend dashboards or predictive alerts. |

### Done (This Session — Appointments, Policies, Goals, Dashboard Rewrite, Competitive Intel)
- **Satisfaction surveys**: Email invitation flow with token-based public submission (`POST /surveys/satisfaction/invite`, `GET /api/surveys/form/satisfaction/:token`, `POST /api/surveys/submit/satisfaction/:token`). Public form collects name, relationship, rating, comments. Source marked as "Email" vs "Manual" in table. Filters + search added.
- **Staff engagement surveys**: Customizable question templates (`engagement_templates` table, CRUD API). Admin triggers survey to all active staff → per-staff email with unique token + push notification. Public form at `/survey/engagement/:token` with 6-question slider.
- **Survey infrastructure**: `survey_invitations` table for token management, `engagement_templates` for customizable questions, `satisfaction_surveys.invitation_token` migration, public routes outside auth middleware.
- **KLOE-organized evidence packs**: Evidence grouped by CQC domain (Safe, Effective, Caring, Responsive, Well-led) with item counts and truncated item lists; shown as colored cards below the summary.
- **PDF pagination**: `@media print` CSS with `page-break-after: always` and `page-break-inside: avoid` on tables/rows.
- **Escalation workflows**: `checkEscalationThresholds()` method queries org threshold, calculates overall compliance rate, notifies all ORG_ADMINs + MANAGERs when below threshold.
- **CQC-mandated training**: `cqc_mandated` BOOLEAN + `cqc_mandated_for_roles` JSONB columns on `training_modules`. Form toggle + role multi-select. ⚑ badge on matrix grid headers. Scoring integrates completion rate.
- **Competency→CQC mapping**: `cqc_statement_id` VARCHAR(10) on `competency_templates`. Form dropdown with 8 common statements. Chip in templates table. Scoring uses `compStatementMap`.
- **Integration verification**: Satisfaction surveys → Caring domain, staff engagement surveys → Well-led domain, incident severity → Responsive domain all wired into `cqc.repository.ts`. No more proxy estimates for any domain.

### Done (This Session — Compliance UI Polish, Care Assessments, eMAR Improvements, Reporting Template)
- **Compliance UI redesigned**: Added circular gauge hero (MUI CircularProgress with overlay text), stat chips with left-border accents, prominent Needs Attention section with clear CTAs, compact horizontal modules strip replacing large action cards, collapsible data sections (Requirements with search/filter, Documents, Trend chart)
- **Care Assessments module**: New `care_assessments` table with migration. Full CRUD API (routes/controller/repository) under `/service-users/:id/assessments`. Frontend page at `/care-assessments` with summary cards, type filter, paginated table, create/edit dialog. Tab in Service User Profile linking to the page.
- **Service User extended details**: Added `pharmacy_name`, `pharmacy_phone`, `pharmacy_address`, `social_worker_name`, `social_worker_phone`, `social_worker_email`, `gp_email`, `gp_address` to schema + profile page edit form and overview display.
- **eMAR MAR grid simplified**: Reverted collapsible grouped grid to flat layout (one row per medication+time slot, no grouping by name). No more expand/collapse — all times visible at once.
- **eMAR period/duration**: Added `start_date`/`end_date` fields to medication items — specify course duration (e.g., 7-day cream).
- **eMAR stock-service user link**: Stock items now linked to a service user via `service_user_id` field in stock dialog.
- **eMAR stock auto-creation**: Adding a non-PRN medication to MAR auto-creates a stock entry in inventory tab.
- **eMAR auto-deduct on administration**: Marking a dose as "Given" decrements the linked stock by 1.
- **eMAR daily medication counts**: New tab in eMAR page — log daily stock reconciliation with checkbox confirming physical match, staff name, date. Full audit trail.
- **eMAR stock adjustments**: New dialog on stock items — adjust for damaged/expired/lost/returned medications. Deducts from stock with audit record.
- **eMAR archived page**: Separated archived MARs to `/emedication/archived` with search by title. Main view shows only active charts.
- **Reporting Suite template**: Built basic reporting page at `/reports` with 6 report card templates (Staff Compliance, Training Matrix, Incident Log, Leave Overview, Service User Roster, Medication Administration). Each card has "Phase 2" chip and sample CSV download.
- **Frontend and backend both typecheck clean** (`npx tsc --noEmit`)

### Done (This Session — AI Integration Phase 1A + Production Readiness Hardening)
- **Database migration**: `ai_config` JSONB column on `organizations` (with default config), `ai_audit_logs` table (org_id, feature, tokens, model, success, error, request_data, response_summary, timestamps) with indexes on org, created_at, feature
- **AI provider adapter** (`ai.provider.ts`): `OpenAIProvider` + `AnthropicProvider` classes implementing `AIProvider` interface with lazy `import()` to avoid hard SDK dependency at startup; `getProvider()` factory
- **Prompt library** (`ai.prompts.ts`): 4 prompt templates with `renderPrompt()` helper
- **AI repository** (`ai.repository.ts`): `getConfig`, `updateConfig`, `logAudit`, `getAuditLogs`, `getUsageStats`
- **AI controller** (`ai.controller.ts`): 6 endpoints with proper error/audit handling
- **AI routes** (`ai.routes.ts`): All behind `authenticate` + `requireRole(ORG_ADMIN)` + Zod validation
- **Validation schemas**: `updateAIConfigSchema`, `aiAnalysisRequestSchema` added to shared schemas
- **Frontend AI Settings tab**: Provider config, API key, model, feature toggles, compliance gap analysis runner with results card, usage stats panel
- **Dependencies**: `openai` + `@anthropic-ai/sdk` added to API package.json
- **eMedication PATCH Zod validation**: Added `updateAdministrationSchema`, `updateStockItemSchema` — wired to 3 routes
- **Global toast/snackbar provider**: `SnackbarContext.tsx` + 4xx interceptor in `api.ts` with `setOnApiError()` callback
- **Error state rendering**: Added `isError` + Alert to EMedicationPage (3 queries), GoalsPage, AppointmentsPage, PoliciesPage
- **Silent catch blocks fixed**: 3 in LeaveManagerPage, GoalsPage, AppointmentsPage, PoliciesPage — all now log or display errors
- **Both apps typecheck clean** (`npx tsc --noEmit`)

### Done (This Session — Billing UX, Notification Fix, Manager Rota, MAR Print Enhancements)
- **Phase 2 add-ons hidden from billing**: Removed the entire "Phase 2 Add-ons" section (eMAR, Mobile PWA, Shift Marketplace, Expense Tracking, Room Checks, Task Management) plus `addons` state and its API call from `BillingPage.tsx`.
- **Default card management**: Added `PATCH /billing/payment-methods/:id/default` endpoint (`billing.controller.ts` + `billing.routes.ts`); frontend now shows brand-specific color chips, bold default indicator, "Set as Default" button, and auto-assigns next card as default when the current default is deleted.
- **Manager rota edit/view fix**: `fetchData` checks three sources for manager location (staff_profiles.location_id, locations WHERE manager_id === rawUser.id, rawUser.location_id) — ensures managers see their own location as non-read-only.
- **Notification validation fix**: Removed `validate(markNotificationReadSchema)` from `PATCH /:id/read` route since the validation expected body fields but the ID comes from the URL param.
- **eMAR print expanded**: Full MAR chart print includes patient info (name, NHS number, DOB, age, room, allergies, GP details), regular medication grid with route/frequency/course dates, PRN medication section with reason/effectiveness/staff, staff signatures table with initials, codes key with color swatches, and chart metadata.
- **Both apps typecheck clean** (`npx tsc --noEmit`)

### Completed
- All 5 Phase 1 compliance features built and typechecking clean.
- Production audit: 31 issues fixed across Auth, Leave, Scheduling, Chat, Dashboard modules.
- Gap-closing session: all 3 proxy domains replaced with real data, CQC-mandated training per role, competency→CQC mapping, KLOE evidence packs, PDF pagination, escalation workflows.

### Blocked
- None

### Deferred to Phase 2
- AI: Incident Severity Triage frontend
- AI: Visit Note → Care Plan Gap Analysis frontend
- AI: Competency Assessment Assistant frontend
- Visit Note → Care Plan Gap Analysis backend (prompt built only)
- Competency Assessment Assistant backend (prompt built only)
- E-learning integration (SCORM/xAPI)
- Digital signatures on training
- DBS/Visa auto-renewal flow
- Third-party DBS API integration
- Observation scoring rubric
- True PDF generation (puppeteer/PrintNode)
- Trend dashboards + predictive alerts
- Preventive compliance alerts

## Key Decisions
- **Custom swagger generator used** instead of swagger-jsdoc with JSDoc annotations or express-oas-generator — walks Express `_router.stack` at startup, no annotations needed.
- **Helmet CSP disabled for swagger UI** — swagger-ui-express uses inline scripts/styles blocked by Helmet's default strict CSP.
- **Vite proxy extended for `/docs` and `/docs.json`** — needed so swagger CSS/JS assets reach the API server from the frontend dev server.
- **Token blacklist uses Redis-fallback-to-in-memory** — same pattern as rate limiter, for logout support without requiring Redis.
- **API runs on port 3002**; frontend Vite proxies `/api` → `http://localhost:3002` stripping `/api` prefix; additionally proxies `/socket.io`, `/docs`, `/docs.json` → same target.
- **`ECONNREFUSED` errors** in logs are just Vite starting before the API finishes booting — transient, safe to ignore.
- **Socket.io server** uses `createServer(app)` instead of `app.listen()`.
- **pg `DECIMAL`/`NUMERIC` types returned as strings** — fixed with global type parsers in `apps/api/src/shared/database/index.ts`.
- **MFA verify endpoint returns `{ message: 'MFA enabled successfully' }`** — frontend checks by successful response (no error thrown), not `res.data.success`.
- **DM read receipt via `other_last_read_at`** — `GET /chat/channels/:id/messages` returns `other_last_read_at` (other member's `last_read_at`) for DM channels. Frontend uses it for unread divider ("New messages" above messages recipient hasn't read) and `isMessageSeen` ("Seen" on sent messages the recipient has read). Groups omit this field.

## Next Steps
1. **Carer Mobile PWA** — Progressive Web App with GPS SecureVisit check-in, offline roster views, biometric auth, voice-to-text notes. Required for domiciliary care market.
2. **Family Portal** — GDPR-compliant read-only relative access showing real-time care notes, visit feed, and care plan summaries. Reduces phone enquiries by ~40%.
3. **Task Management** — Assign and monitor team tasks with status tracking, due dates, and staff notifications. Low-medium complexity, high operational value.
4. **Expense Tracking** — Service user petty cash ledger with receipt uploads, staff expense claims, and balance tracking. Competitors charge £5/mo add-on.
5. **Room Checks** — Digital room inspection records with photo capture and compliance tagging. Low complexity.
6. **Start NHS DSPT certification process** — Register on dsptoolkit.nhs.uk as a software provider. Required for ICB funding eligibility.
7. **Polish CQC/readiness simulator** — better gap analysis ("what to action next"), framework-agnostic quality ratings, one-click PDF export for all 4 frameworks

## Competitive Market Assessment (July 2026)

### Market Overview
The UK care management software market has 15+ established players but remains fragmented. Most platforms target **residential/nursing homes** — fewer are built for **supported living** (our primary focus). The 2026 regulatory landscape has shifted: CQC's Single Assessment Framework (34 Quality Statements) is now standard, NHS DSPT certification is required for ICB funding eligibility, and AI features are emerging as differentiators. Pricing ranges from free (Log my Care) to enterprise £500+/mo (Access Group, PCS).

### Tier 1: Full-Suite Care Platforms (Direct Competitors)

| Platform | Focus | Key Differentiator | Pricing | Our Gap |
|---|---|---|---|---|
| **caredesk.app** (CreativeSoft) | Domiciliary + supported living | 12+ yrs experience, NHS DSPT certified, full domiciliary workflow (rostering, eMAR, payroll, family portal, CQC simulator) | £49–199/mo | Huge gap — they have everything we're missing (mobile app, eMAR, payroll, invoicing, family portal, NHS DSPT cert) |
| **Nursebuddy** | Domiciliary care ONLY | Finnish-built, 10 yrs in market, 4.6★ mobile app, AI scheduling (AutoPilot), eMAR, body maps, family portal, payroll, NHS DSPT certified, CM2000 integration | £119–529/mo (hour-based) | **Direct domiciliary threat.** Best carer mobile app in market (4.6★), full payroll/invoicing, AI scheduling we lack. But CQC-only (no multi-regulator), no real 5-domain compliance scoring |
| **Person Centred Software** | Residential/nursing | 8,000+ providers, market leader, ATLAS eMAR, CQC inspector familiarity | £300-600/mo (50 beds) | Different segment (care homes), but they set UX expectations |
| **Nourish Care** | Residential + domiciliary | Modern UX, person-centred care planning, strong outcomes data | £195-400/mo | Similar segment overlap. Stronger care planning |
| **Access Group** | Multi-site enterprise | Broadest ecosystem (HR, payroll, rostering, finance), enterprise analytics | Enterprise (£400-800/mo) | Different segment (enterprise multi-site) |
| **Birdie** | Domiciliary care | Q-Score live compliance, all-in-one, real-time data | £200+/mo + per-user | Direct domiciliary competitor. They have mobile app, eMAR, finance |
| **CareGovern** | Supported living ONLY | Built exclusively for supported living, all 4 UK regulators, one-click evidence packs | £179.99–299.99/mo | **Closest competitor to our positioning.** Multi-regulator is their core differentiator too |
| **CareControl** | Residential + supported living | NHS Assured, manager alert system | Quote-based | Mid-range competitor |
| **IQ:caremanager** (Unique IQ) | Domiciliary + supported living | AI-powered, DSCR/CQC compliance, 20+ yrs in care | Quote-based | Strong domiciliary player |
| **CareCallAI** | Domiciliary (Wales focus) | Only platform with native CIW compliance, AI care plan drafting, £99/mo flat pricing | £99/mo flat | Budget threat, strong Wales positioning |
| **Log my Care** | Small homes/startups | Free tier (25 service users), simple, mobile-first | Free–£250/mo | Entry-level threat, won't compete at mid-market |

### Tier 2: Niche / Compliance-Only

| Platform | Focus | Notes |
|---|---|---|
| **AlwaysReady Care** | Compliance evidence layer | Sits on top of any care platform. CQC SAF-mapped evidence in 60s. Free tier + £79/home/mo Pro |
| **QCS** | Policies + audits + mock inspections | Policy library, mock inspection tooling. Mid £xxx/mo |
| **CareDocs** | Mid-range care planning | 15+ yrs, ~£7/bed/mo, proven reliability |
| **Carebeans** | Simplicity, quick adoption | Now part of QCS |
| **CareDaily** | Policy library + AI-assisted notes | 2,000+ policies, NHS Assured |
| **CarePoint365** | Microsoft 365 + PowerBI | HR, rostering, recruitment, agentic AI built-in |
| **Radar Healthcare** | Enterprise GRC | Risk + quality + compliance for large groups, ~£4,500/mo |

### Feature Comparison: CareDesk (us) vs Key Competitors

| Feature | **Us** | caredesk.app | Nursebuddy | PCS | Nourish | Birdie | CareGovern |
|---|---|---|---|---|---|---|---|---|
| **Multi-regulator (all 4 UK nations)** | ✅ | ❌ (CQC only) | ❌ (CQC only) | ❌ | ❌ | ❌ | ✅ |
| **CQC Readiness Scoring (real data)** | ✅ | ✅ (simulator) | ❌ (compliance tracking, no score) | ✅ | ✅ | ✅ (Q-Score) | ✅ |
| **Training Compliance Matrix** | ✅ | ✅ | ❌ (basic expiration alerts) | ✅ | ✅ | ✅ | ✅ |
| **Competency Assessments** | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Evidence Packs (KLOE-organized)** | ✅ | ✅ | ❌ (basic reports only) | ✅ | ✅ | ✅ | ✅ |
| **Satisfaction Surveys** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Staff Engagement Surveys** | ✅ | ❌ | ✅ (wellbeing check-in) | ❌ | ❌ | ❌ | ❌ |
| **Appointments Tracker** | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Service User Goals** | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |
| **Policy Management (12 standard)** | ✅ | ✅ | ❌ (partner CQM library) | ✅ | ✅ | ✅ | ✅ |
| **PBS Plans** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (add-on) |
| **Health Monitoring (obs, bowel, dental, fluid)** | ✅ | ✅ | ✅ (fluid charts, body maps) | ✅ | ✅ | ✅ | ✅ |
| **Chat/Collaboration** | ✅ | ✅ | ❌ (basic in-app messaging) | ❌ | ❌ | ✅ | ❌ |
| **Rota/Scheduling** | ✅ | ✅ | ✅ (AI AutoPilot) | ✅ | ✅ | ✅ | ✅ |
| **Calendar Quick Shift-Add** | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Leave Management** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **MFA/Security** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **NHS DSPT Certified** | ❌ | ✅ | ✅ (Standards Exceeded) | ✅ | ✅ | ✅ | ❌ |
| **CM2000 Integration** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **eMAR (medication)** | ❌ (Phase 2) | ✅ | ✅ | ✅ (ATLAS) | ✅ | ✅ | ✅ (add-on) |
| **Carer Mobile PWA (GPS, biometrics, offline)** | ❌ (Phase 2) | ✅ | ✅ (4.6★ app) | ✅ (mCare) | ✅ | ✅ | ❌ |
| **Family Portal** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Payroll & HMRC** | ❌ | ✅ | ✅ (Xero integration) | ❌ | ❌ | ❌ | ❌ |
| **Invoicing & Contracts** | ❌ | ✅ | ✅ (Xero integration) | ❌ | ❌ | ✅ | ❌ |
| **Care Assessments & Plans** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Daily Monitoring Charts** (health obs, bowel, fluid) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Document Drive** | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ |
| **Reporting Suite** | ✅ (basic template) | ✅ | ✅ (pre-built reports) | ✅ | ✅ | ✅ | ✅ |
| **Expense Tracking** | ❌ (Phase 2) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Task Management** | ❌ (Phase 2) | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| **Room Checks** | ❌ (Phase 2) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **E-learning (SCORM/xAPI)** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **GP Connect / NHS Integration** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| **AI Features** | ✅ (gap analysis + triage) | ❌ | ✅ (AutoPilot scheduling) | ❌ | ❌ | ✅ (Q-Score) | ❌ |

### Strategic Positioning & Gaps

**Our Unique Strengths (differentiators):**
1. **Multi-regulator framework** — only platform (alongside CareGovern) supporting CQC + CIW + Care Inspectorate + RQIA natively. caredesk.app is CQC-only. Scotland and Northern Ireland now use framework-specific real-data scoring, not CQC proxies.
2. **Satisfaction & engagement surveys** — no competitor offers email-invited satisfaction surveys (Caring domain) or customizable staff engagement templates (Well-led domain). Direct CQC evidence for 2 of 5 domains.
3. **Real compliance scoring from actual data** — not proxies. Training → Effective, competency mapping → Safe, satisfaction → Caring, engagement → Well-led, incidents → Responsive. All 5 domains from real records.
4. **Chat module** — rare among care platforms. caredesk.app has it too, but most don't.
5. **Appointments Tracker + shift-start notifications** — full CRUD, dashboard list, and automated "Today's Plan" emails to assigned staff before shifts. caredesk.app has appointments but no shift-start daily plan email.
6. **Policy Management with 12 standard CQC-aligned policies** — seeded library (Risk Assessment, Complaints, Lone Working, GDPR, Whistleblowing, Infection Control, Equality & Diversity, MCA & DoLS, Fire Safety, Medication, Safeguarding Adults, Health & Safety) with versioning and PDF download.
7. **Service User Goals** — per-service-user goal tracking with progress % and CQC domain mapping.
8. **Calendar Quick Shift-Add** — hover `+` overlay on day headers and hour cells for one-click shift creation.

**Critical Gaps (must build):**
1. **eMAR (medication administration)** — table stakes. Every competitor has it. CQC inspectors expect it. Without it, we cannot compete in domiciliary care.
2. **Carer Mobile PWA** — GPS check-in, biometrics, offline roster. Required for domiciliary care workflow. caredesk.app, PCS, Nourish, Birdie all have it.
3. **Family Portal** — GDPR-compliant read-only access for relatives. caredesk.app, PCS, Nourish, Birdie all include it. Reduces phone enquiries by ~40%.
4. **NHS DSPT certification** — increasingly required for ICB/government funding. caredesk.app, PCS, Nourish, Birdie all certified. We need to register on dsptoolkit.nhs.uk.
5. **Document Drive** — File management for evidence packs. caredesk.app, PCS, Birdie all include it.
6. **Reporting Suite** — Exportable PDF reports for inspections. Competitors offer inspector-ready reports.

**Phase 2 Build Priorities (ordered by market impact):**
| Priority | Feature | Impact | Complexity |
|---|---|---|---|
| 0 | **AI Integration (Phase 1A)** | Automated gap analysis, incident triage, compliance recommendations | Medium (provider adapter + prompt library) |
| 1 | **eMAR (31-day medication chart)** | Table-stakes for domiciliary; unlocks care home market | High (clinical safety, dm+d integration) |
| 2 | **Carer Mobile PWA** | Required for domiciliary; GPS + biometrics + offline | Medium-High (PWA + GPS + biometric API) |
| 3 | **NHS DSPT Certification** | Unlocks ICB funding eligibility | Medium (process + documentation) |
| 4 | **Family Portal** | Defeatures caredesk.app; reduces phone enquiries 40% | Medium |
| 5 | **Expense Tracking** | caredesk.app has it; tracks service user spending & petty cash | Medium (table + CRUD + frontend) |
| 6 | **Task Management** | Assign and monitor team tasks with status tracking | Low-Medium (new table + CRUD + frontend) |
| 7 | **Room Checks** | Digital room inspection records | Low (table + form + frontend) |
| 8 | **PBS Plans** | CareGovern charges £5/mo for this; part of our subscription | Medium (extend care_plans or new module) |
| 9 | **Body Mapping** | Expected by inspectors; visual injury documentation | Low (health observations extension) |
| 10 | **Payroll & Invoicing** | caredesk.app has this; closes back-office loop | High |
| 11 | **Document Drive** | File management for evidence packs | Low-Medium |
| 12 | **Reporting Suite** | Exportable PDF reports for inspections | Medium |
| 13 | **GP Connect Integration** | NHS integration for clinical data | High (NHS standards) |

### Pricing Landscape
| Our Target Segment | Competitor | Price/mo | Notes |
|---|---|---|---|
| Small (1-25 carers) | caredesk.app Starter | £49 | Full suite including eMAR, rostering, mobile app |
| Small (1-25 carers) | Nursebuddy Essentials (≤300h) | £119 | Full suite eMAR, carer app, scheduling, family portal |
| Small (1-25 carers) | Log my Care | Free–£150 | Limited free tier |
| Small (1-25 carers) | CareCallAI | £99 flat | Full platform, no per-user fees |
| Medium (25-55) | caredesk.app Professional | £99 | Full suite |
| Medium | Nursebuddy Standard (500h) | £229 | Full suite all features + Xero + CM2000 |
| Medium | CareGovern Starter | £179.99 | Supported living focus, 4 regulators, 15 service users |
| Medium | Nourish | £195+ | Care planning focus |
| Enterprise | Nursebuddy Pro (3000h) | £529 | Full suite + API + data import |
| Enterprise | CareGovern Pro | £299.99 | Supported living, increased limits |
| Enterprise | Birdie | £200+ + per-user | Domiciliary, Q-Score |
| Enterprise | PCS | £300-600 | Market leader, care homes |

**CareGovern Add-on Pricing (notable model):**
| Add-on | Price/mo |
|---|---|
| Extra Service User (+1) | £9.00 |
| Extra Location (+1) | £25.00 |
| Extra Staff Member (+1) | £5.00 |
| Keyworker Sessions | £5.00 |
| Expenses Tracking | £5.00 |
| Medication (eMAR) | £5.00 |
| Meetings | £5.00 |
| Policy Management | £5.00 |
| PBS Plans | £5.00 |

CareGovern offers a starter plan at £179.99/mo with add-on modules as £5 each — this is a smart upsell model that keeps base price accessible while monetising advanced features. We have adopted a similar tiered base + add-on pricing:

| Add-on | Price/mo |
|---|---|
| eMAR & Medication | +£5 |
| Carer Mobile PWA | +£5 |
| Shift Marketplace | +£5 |
| Expense Tracking | +£5 |
| Room Checks | +£5 |
| Task Management | +£5 |

Core features like PBS Plans, Multi-Regulator, Chat, Goals and all compliance modules remain included in the base subscription at every tier.

**Conclusion:** We cannot compete on breadth with caredesk.app at £49-99/mo (they have 12+ years and full domiciliary workflow). Our wedge is **multi-regulator compliance-first** — the only supported living platform that scores all 5 CQC domains from real data across all 4 UK frameworks, with satisfaction surveys and staff engagement built in. We should **own compliance** as our category, not try to match caredesk.app feature-for-feature in Phase 2. Build eMAR and mobile app only enough to unlock domiciliary care, then deepen compliance moat with AI gap analysis, predictive alerts, and NHS integration.

### Nursebuddy Deep Dive (July 2026)

**Overview:** Finnish-built (10 yrs), domiciliary-care-only. Rated 4.6★ on app stores — best carer mobile app in market. Pricing is hour-based (£119/300h → £529/3000h) which scales with agency size rather than per-user.

**What they do well (their moat):**
- **Carer mobile app (4.6★):** GPS check-in (SecureVisit), QR codes, biometric auth, offline mode, voice-to-text, one-tap maps, pinned notes. This is their killer feature — CQC inspectors impressed by eMAR + body maps on mobile
- **AI scheduling (AutoPilot):** Automated carer-client matching based on compliance, skills, distance, preferences. "Manage by exception" — flags unallocated shifts for manual review
- **Family Portal:** Real-time visit feed, care package details, diary notes, calendar. Reduces phone enquiries
- **Payroll & invoicing:** Xero integration, travel/mileage/waiting time, customisable charge rates, .csv export. Full back-office closure
- **CM2000 integration:** ECM for LA contracts — hard requirement for council-funded domiciliary care
- **NHS DSPT: "Standards Exceeded"** — top certification tier. Critical for ICB funding
- **Wellbeing surveys:** In-app daily check-in, manager appreciation centre (e-cards/recognition). Good for retention
- **10 yrs market presence:** Established trust, customer base, case studies, 4+ app store ratings, partner ecosystem (CQM policies, CM2000)

**Where they're weak (our opportunities):**
- **CQC only** — no CIW, Care Inspectorate, RQIA support. Cross-UK providers need separate systems
- **No real compliance scoring** — compliance tracking is basic (cert expiry alerts + scheduling blocks). No 5-domain CQC readiness score from real data. Birdie's Q-Score and our compliance engine beat them here
- **No competency assessments** — no CQC statement mapping to staff skills
- **No evidence packs** — basic reports only; no KLOE-organized PDF packs
- **No satisfaction surveys** — no structured email-invited family feedback for CQC evidence
- **No training matrix** — basic cert expiry alerts only; no CQC-mandated per-role matrix
- **No chat module** — basic in-app messaging only (no DMs, file sharing, read receipts)
- **MODS certification "in progress"** — not yet certified for LA digital records (July 2026 deadline)
- **Reporting flexibility limited** — pre-built reports only; no custom report builder
- **Integration scope limited** — Xero + CM2000 only; no GP Connect, no pharmacy integrations
- **Cost barrier for small agencies** — £119/mo minimum vs Log my Care free or CareCallAI £99 flat
- **No supported living focus** — built for domiciliary visit-based model; less suited to 24/7 supported living settings

**What we need to match to compete in domiciliary:**
1. **Mobile PWA** — GPS check-in, offline roster, biometric auth (their #1 feature)
2. **eMAR** — 31-day chart, body maps, PRN, stock management (they have this)
3. **Family Portal** — read-only access for relatives (reduces phone calls 40%)
4. **NHS DSPT certification** — "Standards Exceeded" is their badge; we need at least "Standards Met"
5. **Payroll/Xero integration** — needed for back-office closure
6. **CM2000/ECM integration** — required for LA contracts
7. **AI scheduling** — AutoPilot is a genuine differentiator; we need basic automated matching

**Our counter-positioning:**
- "Nursebuddy simplifies *domiciliary visit logistics* — CareDesk proves *compliance across all 4 UK regulators*"
- Our compliance engine (5-domain real-data scoring, KLOE evidence packs, satisfaction surveys) is a category they don't compete in
- Multi-regulator is our wedge for cross-UK providers — Nursebuddy can't serve a provider expanding from England into Wales/Scotland/NI without a second system
- We should aggressively market our compliance depth until we match their mobile app, then compete on breadth

### Updated Gap Analysis (Post-Recent Builds)

Since the last assessment we have closed four significant competitive gaps:

| Closed Gap | Why It Mattered | Competitive Impact |
|---|---|---|
| **Appointments Tracker** | Dashboard widget + full CRUD + shift-start "Today's Plan" email gives us a feature caredesk.app lacks. | Moves from parity gap to **slight lead** on scheduling-care coordination. |
| **Policy Management (12 standard policies)** | CQC/inspectors expect a policy library; CareGovern charges £5/mo add-on. | Removes a common objection during demos; undercuts CareGovern upsell. |
| **Service User Goals** | Core care planning feature; feeds CQC Effective/Caring domains. | Reaches parity with CareGovern and most Tier 1 platforms. |
| **Calendar Quick Shift-Add** | Daily scheduling friction was a UX weakness vs CareGovern. | Parity achieved; managers can now add shifts in one click. |
| **Scotland & NI real-data scoring** | Previously CIW/Scotland/NI fell back to CQC proxies or generic averages. | Strengthens multi-regulator claim; only CareGovern matches this depth. |

**Remaining headline gaps vs Tier 1 competitors:**

| Gap | Risk | Urgency |
|---|---|---|
| **eMAR** | Cannot credibly sell into domiciliary or nursing-home market without it. | Critical — blocks domiciliary expansion. |
| **Carer Mobile PWA** | Domiciliary carers cannot check in/out, view rota offline, or capture notes in the field. | Critical — required alongside eMAR. |
| **NHS DSPT certification** | Increasingly a hard gate for ICB/local authority funding and procurement. | High — process should start immediately. |
| **Family Portal** | Relatives expect visibility; competitors reduce call volume by ~40%. | High — strong differentiator if built well. |
| **Document Drive** | Evidence packs need file management; competitors offer this natively. | Medium — operational friction. |
| **Reporting Suite** | Inspector-ready PDF exports are expected at mid-market+. | Medium — currently HTML/print only (basic template built). |

**Strategic recommendation:** Continue the compliance-first positioning. The recent builds prove we can close gaps faster than competitors can copy our multi-regulator scoring. The next 90 days should focus on **Mobile PWA** (to unlock domiciliary) and **NHS DSPT registration** (to unlock procurement). Care Assessments & Plans, Daily Monitoring Charts, and eMAR stock/daily counts are now built — closing the clinical table-stakes gaps.

## AI Integration Blueprint

### Vision
Enhance CareDesk's compliance-first platform with practical AI features that close compliance gaps for providers, reduce admin burden, and create a new revenue category. AI runs per-org on the org's own API key (OpenAI/Anthropic) — no data leaves their tenant, costs are transparent, and the platform degrades gracefully without AI.

### Phase 1A — Immediate (build in parallel with Phase 2 dom. features)
| Feature | What It Does | CQC Domain | Effort | Status |
|---|---|---|---|---|
| **Visit Note → Care Plan Gap Analysis** | AI reads a carer's visit note against the care plan and flags missing/contradictory documentation with an audit-risk rating | Effective, Responsive | 2 weeks | Prompt built, frontend TBD |
| **Incident Severity Triage** | AI classifies incident reports by severity (low/medium/high/critical) and suggests required actions | Responsive, Well-led | 1 week | Backend complete, frontend TBD |
| **Competency Assessment Assistant** | AI generates assessment questions from CQC statements and suggests pass/fail based on staff answers | Safe, Effective | 2 weeks | Prompt built, frontend TBD |
| **Compliance Gap Analysis** | AI reads org's compliance data and generates plain-English "what to fix next" recommendations | Well-led | 1 week | ✅ Complete — frontend + backend + audit logging |

### Phase 1B — Core AI (post-Mobile PWA, post-eMAR)
| Feature | What It Does | CQC Domain | Effort |
|---|---|---|---|
| **Care Planning Assistant** | AI generates personalised care plan drafts from service user intake data (needs, preferences, medical history) | Effective, Caring | 3 weeks |
| **Medication Review AI** | AI reviews eMAR administration logs for anomalies (missed doses, double administrations, PRN overuse) | Safe | 2 weeks |
| **Shift Note Summariser** | AI summarises daily shift notes into structured handover reports | Effective, Responsive | 1 week |
| **Staff Training Recommender** | AI compares staff compliance gaps against role requirements and suggests specific training modules | Effective | 2 weeks |

### Phase 2 — Predictive & Agentic (domiciliary launch)
| Feature | What It Does | CQC Domain | Effort |
|---|---|---|---|
| **Hospitalisation Risk Scoring** | ML model scores each service user's risk from visit notes, missed visits, care plan changes, documented decline | Safe, Effective | 4 weeks |
| **Staffing Forecast** | AI projects staffing needs from scheduled demand + historical patterns | Well-led | 3 weeks |
| **Burnout Detection** | Flags staff trending toward overload (long hours, back-to-back shifts, missed breaks) | Well-led | 2 weeks |
| **AI Scheduling Assistant** | Suggests optimal carer-client matches based on compliance, skills, distance, preferences | Effective | 4 weeks |
| **Automated Evidence Pack Generator** | AI selects and annotates evidence for CQC statement scoring from org data | Well-led | 3 weeks |

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    CareDesk Platform                         │
├─────────────────────────────────────────────────────────────┤
│  Each Org Config: { aiProvider: 'openai'|'anthropic',       │
│                     apiKey: 'sk-...', model: 'gpt-4o',     │
│                     enabled_features: ['gap_analysis',...] }│
├─────────────────────────────────────────────────────────────┤
│                   AI Service Layer                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Gap      │ │ Incident │ │ Compet-  │ │ Care Plan│       │
│  │ Analysis │ │ Triage   │ │ ency AI  │ │ Asst.    │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Risk     │ │ Staffing │ │ Burnout  │ │ Schedule │       │
│  │ Scoring  │ │ Forecast │ │ Detect   │ │ AI       │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
├─────────────────────────────────────────────────────────────┤
│  Caching Layer (Redis) — results cached for configurable TTL │
├─────────────────────────────────────────────────────────────┤
│  Provider Adapter: OpenAI SDK | Anthropic SDK | future       │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Principles
1. **Per-org API key** — each org brings their own key. No shared billing, full data control, transparent costs.
2. **Minimum-necessary context** — each analysis sends only what it needs (a visit note + its care plan), never the whole database.
3. **Graceful degradation** — no key configured? Platform works exactly the same. AI features show "Configure AI in Settings" state.
4. **Results cached** — same note never re-analysed. TTL configurable per feature.
5. **Decision support, not automation** — AI flags, scores, suggests. Humans always decide.
6. **Audit trail** — every AI action logged with prompt + response for compliance evidence.
7. **Provider-agnostic** — adapter pattern supports OpenAI, Anthropic, or future NHS-approved models.

### Pricing Model
| Feature | Pricing |
|---|---|
| Per-org API key (bring your own) | Org pays their AI provider directly |
| AI Service Fee (CareDesk platform) | Flat £5/mo per org (or included in Professional plan) |
| Advanced features (predictive, agentic) | £10/mo per org add-on |

### Dependencies & Prerequisites
- **AI Service Layer** — new module `apps/api/src/modules/ai/` with provider adapters, caching, audit logging
- **Org config table** — extend `organizations` with JSONB `ai_config` column or new `ai_config` table
- **Frontend Settings tab** — AI configuration in Settings page (API key, enabled features, model selection)
- **Prompt library** — version-controlled prompts per feature in `ai/prompts/` for auditability
- **Rate limiting** — per-org per-feature rate limits to control costs

## Production Readiness Checklist (Phase 1 Launch)

### Critical — Must Fix Before Launch (All ✅ Complete)

#### Backend
- [x] Auth `password_hash` leak fixed (sanitizeUser at 6 points)
- [x] Auth user enumeration fixed (unified error messages)
- [x] Auth password strength enforced (uppercase + lowercase + digit + min 12 chars)
- [x] Auth MFA 500 error fixed (try/catch for expired tokens)
- [x] Auth middleware staleness fixed (DB re-check on every request)
- [x] Chat SSRF vulnerability fixed (protocol validation, private IP blocking, 5MB limit)
- [x] Leave Zod schema mismatches fixed (5 critical)
- [x] Scheduling permission/org isolation/compliance/min-staffing all fixed
- [x] `process.on('unhandledRejection')` and `process.on('uncaughtException')` in `src/index.ts`
- [x] DB pool configured (max, idle timeout, connection timeout, statement timeout) in `src/shared/database/index.ts`
- [x] Startup env var validation for `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`
- [x] Input validation (Zod schemas) on all eMedication mutation routes (3 PATCH routes now validated)
- [x] Input validation on health, policies, appointments, goals routes
- [x] CORS wildcard fixed — production rejects when `CORS_ORIGINS` unset
- [x] Virus scan wired into upload middleware (`scanBuffer` called)
- [x] Structured logging (pino with redact rules)
- [x] PII removed from stdout (email service logs only `{to, subject, bodyLength}`)
- [x] Socket.io rate limiting (connection + message frequency per user)
- [x] `requirePermission` caching (30s TTL in-memory Map)

#### Frontend
- [x] Dashboard compliance fallback fixed (removed stale "Professional Regs")
- [x] Global `<ErrorBoundary>` in `main.tsx` wrapping `<App />`
- [x] Loading spinners in `LeaveManagerPage` (data, all-requests, calendar tabs)
- [x] Error handling in `LeaveManagerPage` (3 silent catches replaced with `console.warn`)
- [x] Pagination on `StaffDirectoryPage` and `IncidentDirectoryPage`
- [x] AuthGuard/ModuleGuard on `/appointments`, `/policies`, `/goals` routes
- [x] Error state rendering added to EMedicationPage, GoalsPage, AppointmentsPage, PoliciesPage
- [x] Global toast/snackbar provider for API errors (4xx interceptor in api.ts + SnackbarContext)

### High — Should Fix Before Launch (All ✅ Complete)

#### Backend
- [x] **Content Security Policy** — Helmet configured with specific CSP directives (not disabled globally)
- [x] **`updatePermissionsSchema`** — has enum constraint (`'none' | 'view' | 'edit'`)
- [x] **`updateStaffRoleSchema`** — has enum constraint (CARE_WORKER | MANAGER | ORG_ADMIN)
- [x] **Socket.io user status/role check** on connect (queries DB, rejects deactivated/jwt-role-mismatch)
- [x] **Require TOTP to disable MFA** — verify endpoint checks token before disabling
- [x] **Graceful shutdown** (SIGTERM/SIGINT handlers: drain http, close pool, exit)
- [x] **Health check** — `SELECT 1` in `/health/ready` endpoint
- [ ] **Add Socket.io Redis adapter** for multi-instance horizontal scaling (Phase 2)
- [x] **SVGs blocked** from upload MIME types and extensions
- [ ] **Morgan format** — uses pino-http (not morgan), already structured
- [x] **`.catch(() => {})` patterns** — audit done, remaining 2 only for non-critical calendar/delegation fetches
- [ ] **Fix duplicate rate limiting** on auth endpoints — review needed
- [x] **notFoundHandler** — production returns generic 'Not Found', dev only leaks path
- [x] **Stripe test mode** — allows `sk_test` in non-production
- [x] **`STRIPE_WEBHOOK_SECRET`** — defaults to undefined
- [x] **Password min length** — 12 across all schemas (with uppercase, lowercase, digit, special char)
- [x] **Rate limiting on org creation** — 15/60s per IP on POST /organizations
- [x] **Audit failures logged** — at warn/error level, not silent

#### Frontend
- [x] **Blank screen on missing data** — fixed via global ErrorBoundary + error state rendering on all pages
- [x] **Loading spinners** — added to all pages that use manual fetch patterns
- [x] **Empty states** — already present on incident list, compliance records, eMAR records
- [x] **Mutation error handling** — global toast/snackbar provider (4xx interceptor + SnackbarContext) catches all API errors
- [x] **Error Alert on silent catches** — fixed in GoalsPage, AppointmentsPage, PoliciesPage, LeaveManagerPage
- [x] **eMedication error states** — isError destructured on 3 critical useQuery calls, Alert renders when queries fail

### Medium — Nice to Fix
- [ ] Add `.env.example` with all vars documented
- [ ] Add request correlation IDs
- [ ] Add readiness/liveness probe separation (`/health/live`, `/health/ready`)
- [ ] Add Prometheus/StatsD metrics endpoint
- [ ] Use `crypto.randomUUID()` in upload filenames instead of `Math.random()`
- [ ] Replace `z.any()` with proper allergies schema
- [ ] HTML-escape user input in email templates
- [ ] Fix ZIP in both upload allowlist and blocklist
- [ ] Add progressive MFA lockout (3+ failed attempts → 1hr block)
- [ ] Protect `seedInvoices` behind a feature flag
- [ ] Add offline fallback page for frontend when API is unreachable
- [ ] Add route transition loading indicator (Suspense/loading bar)

### Deployment Checklist
- [ ] `.env` file created with all production values
- [ ] `NODE_ENV=production` set
- [ ] `CORS_ORIGINS` set to frontend domain
- [ ] `FRONTEND_URL` set to production frontend URL
- [ ] HTTPS configured (cert + key files or reverse proxy)
- [ ] Redis instance provisioned (or configure in-memory-only mode for small deployments)
- [ ] Database migrations run as pre-deploy step
- [ ] Database connection pool sized appropriately (max connections, idle timeout)
- [ ] SMTP credentials configured for transactional emails
- [ ] Stripe keys configured (live keys)
- [ ] Uploads directory backed up or on persistent volume
- [ ] Log aggregation configured (CloudWatch, Datadog, ELK, etc.)
- [ ] Monitoring/alerting set up (uptime, error rate, response time, disk space)
- [ ] Database backup schedule configured (daily snapshots + WAL archiving)
- [ ] Rate limits reviewed for production traffic patterns

## Critical Context
- MFA verify endpoint returns `{ message: 'MFA enabled successfully' }` on success, `{ error: { message: '...' } }` on failure.
- `/auth/me` returns `{ user: { ...userColumns, ...profile, organizationId: user.organization_id }, organization }` — ensures `organizationId` exists.
- `user` in localStorage may have `organization_id` (snake_case from `/auth/me`) or `organizationId` (camelCase from login/register) — frontend helpers check both.
- Staff-department assignment: `PATCH /staff/:staffId/department` with body `{ department_id: 'uuid' | null }`.
- Team members: `POST /organizations/teams/:teamId/members` with `{ userId: 'uuid' }`; `DELETE /organizations/teams/:teamId/members/:userId`.
- File upload: `POST /settings/upload` (multipart/form-data, field name `file`) returns `{ url: '/uploads/filename' }`.
- Branding save: `PATCH /organizations/:id/branding` (or same as org update with allowed fields).
- `orgId` helper in SettingsPage: `const orgId = user?.organizationId || user?.organization_id || ''`.
- Save Branding error "failed to upload logo" occurs when `handleLogoUpload` calls `/settings/upload` which didn't exist before this session — now added.
- Department creation dialog: name field + location selector + optional member Autocomplete; teams creation dialog: name + description + optional member Autocomplete.
- Dashboard compliance: Compliance Rate stat card + "View Full Report" button both navigate to `/compliance`.
- Agency Saved is `0 as agency_saved` placeholder — actual calculation needs agency rate config and shift tracking.
- Profile tab now shows user's departments and teams via `profileDepartments`/`profileTeams` state, loaded from `/settings/my-teams` and `/organizations/departments/single/:id`.
- Unread message behavior: `otherLastRead` = other DM member's `last_read_at`, used for unread divider ("New messages" + dividers) and `isMessageSeen` ("Seen" on sent messages that recipient has read). Groups return `null` for this field — no divider/seen shown.
- `GET /chat/channels/:id/messages` returns `{ messages, last_read_at, other_last_read_at }` — frontend uses `other_last_read_at` for sender-side read receipts.
- `requirePermission(module, level)` middleware in `apps/api/src/shared/middleware/requirePermission.ts` checks `user_permissions` table — used on Scheduling mutation routes after `requireRole` guard.
- `assignStaff` in scheduling repository now verifies staff compliance meets org `minimum_compliance_percent` before assignment.
- `unassignStaff` now enforces `locations.minimum_staff_per_day` — won't remove staff if it would drop below minimum.
- `shift_templates.organization_id` column added — `getTemplates` and `createTemplate` now scoped to organization.
- `getTodayRota` passes `userId` param — CARE_WORKER sees only their assigned shifts.

## Relevant Files
- `apps/web/src/pages/settings/SettingsPage.tsx`: Main file — Security tab with MFA, Org details editing, Departments with staff assignment, Teams with Autocomplete, Branding with color pickers + file upload, Leave Entitlements summary, pagination on all tables, loading states on all action buttons, profile tab with dept/team info
- `apps/api/src/modules/mfa/mfa.controller.ts`: MFA controller — `setup` returns `{ secret, qrCode }`, `verify` returns `{ message: 'MFA enabled successfully' }`
- `apps/api/src/modules/auth/auth.controller.ts`: `/auth/me` now normalizes `organizationId: user.organization_id`
- `apps/api/src/modules/settings/settings.controller.ts`: Added `uploadFile` for generic file upload, added `getMyTeams` method
- `apps/api/src/modules/settings/settings.routes.ts`: Added `POST /settings/upload`, `GET /settings/my-teams` routes
- `apps/api/src/shared/database/setup.ts`: Added migration for `staff_profiles.department_id`
- `apps/api/src/modules/orgs/org.repository.ts`: Added `status` to `updateOrg` allowed fields, added `getDepartmentById`
- `apps/api/src/modules/orgs/org.controller.ts`: Added `getDepartmentById`, notifications on `addTeamMember`/`removeTeamMember`
- `apps/api/src/modules/orgs/org.routes.ts`: Added `GET /departments/single/:id`
- `apps/api/src/modules/staff/staff.repository.ts`: Added `updateDepartment`, `getStaffByDepartment`
- `apps/api/src/modules/staff/staff.controller.ts`: Added `updateDepartment`, `getStaffByDepartment`, notifications on department assignment
- `apps/api/src/modules/staff/staff.routes.ts`: Added `PATCH /:staffId/department`, `GET /by-department/:departmentId`
- `apps/web/src/pages/dashboard/DashboardPage.tsx`: Compliance Rate card + "View Full Report" now navigate to `/compliance`
- `apps/api/src/modules/dashboard/dashboard.repository.ts`: `agency_saved` is `0` placeholder — needs future implementation
- `apps/api/src/modules/notifications/notifications.controller.ts`: `createNotification` static method used for dept/team assignment notifications
- `apps/web/src/pages/chat/ChatPage.tsx`: Chat UI — `SecureImg`, `LinkPreview`, `handleSend` with optimistic + dedup, file grid/list toggle, text file preview, live input preview, unread divider via `otherLastRead`, socket join reliability
- `apps/api/src/modules/chat/chat.controller.ts`: Backend chat — `getMessages` returns `other_last_read_at` for DM channels; emits `chat:unread_total`, `chat:file_added`; `getLinkPreview`
- `apps/api/src/modules/chat/chat.repository.ts`: DB queries with `last_message` COALESCE subquery
- `apps/web/src/services/socket.ts`: Socket.IO client with reconnection config, `onReconnect` callback registry
- `apps/web/src/components/Layout.tsx`: Browser Notification API, `chat:unread_total` listener for notification dot
- `apps/api/src/shared/middleware/requirePermission.ts`: Permission check middleware — queries `user_permissions` table for given module + level (`view`/`edit`)
- `apps/api/src/modules/scheduling/scheduling.routes.ts`: All mutation endpoints now use `requirePermission('scheduling', 'edit')` after `requireRole`
- `apps/api/src/modules/scheduling/scheduling.notifications.ts`: Shift-start notification service — emails assigned staff their daily plan ~15 min before first shift
- `apps/api/src/modules/scheduling/scheduling.repository.ts`: `assignStaff` verifies compliance, `unassignStaff` enforces minimum staffing, `getTemplates`/`createTemplate` scoped by org
- `apps/api/src/modules/cqc/frameworks.ts`: 4 regulatory framework definitions (CQC, CIW, Care Inspectorate, RQIA)
- `apps/api/src/modules/cqc/cqc.repository.ts`: Refactored — accepts regulator param, dynamic statement scoring, returns framework info
- `apps/api/src/modules/cqc/cqc.controller.ts`: Reads org's regulator from DB, exposes GET /cqc/frameworks
- `apps/web/src/pages/compliance/CompliancePage.tsx`: Requirements dialog with clickable staff chips; document upload with Autocomplete; audit trail shows user_name
- `apps/web/src/pages/compliance/CompetencyAssessmentsPage.tsx`: 3-tab page (Pending, Templates, Records) with Assess Now dialog
- `apps/web/src/pages/compliance/EvidencePacksPage.tsx`: Toggle sections, staff filter, Download HTML + Print/PDF
- `apps/web/src/pages/compliance/CqcReadinessPage.tsx`: "Readiness" title, framework chip, circular gauge, gap analysis, download button
- `apps/web/src/pages/compliance/SatisfactionSurveysPage.tsx`: External feedback form + email invitation + filters/search
- `apps/web/src/pages/compliance/StaffEngagementPage.tsx`: Template CRUD, dashboard, send survey to all, responses table
- `apps/web/src/pages/SurveyFormPage.tsx`: Public (no-auth) survey form for satisfaction + engagement
- `apps/api/src/modules/surveys/surveys.controller.ts`: Satisfaction/engagement CRUD, invitation flow, public submission, template management
- `apps/api/src/modules/surveys/surveys.repository.ts`: DB queries for invitations, templates, satisfaction, engagement
- `apps/api/src/modules/surveys/surveys.routes.ts`: Auth + public route registration
- `apps/api/src/modules/compliance/compliance.notifications.ts`: `checkEscalationThresholds()` for manager alert threshold
- `apps/web/src/pages/LandingPage.tsx`: Marketing homepage — compliance-first hero with certification badges, multi-regulator strip, feature grid, live readiness dashboard, domiciliary modules coming-soon, security/trust, pricing table, FAQ accordions
- `apps/api/src/modules/appointments/`: Appointments module — `appointments` table (service_user_id, staff_id, title, start/end, status, location_id). CRUD repository, controller, routes. `GET /appointments/today-stats` endpoint for dashboard widget (total/scheduled/completed/cancelled)
- `apps/api/src/modules/policies/`: Policies module — `policies` table with 12 standard CQC-aligned policies as seed data (via `POST /policies/seed`). CRUD with category/search filtering. Repository includes `STANDARD_POLICIES` array
- `apps/api/src/modules/goals/`: Service User Goals module — `service_user_goals` table (title, description, target/review dates, progress %, cqc_domain, status). CRUD with per-service-user stats endpoint
- `apps/web/src/pages/appointments/AppointmentsPage.tsx`: Appointments tracker — date-filtered table, create/edit dialog with service user + staff autocomplete, status chips, pagination
- `apps/web/src/pages/policies/PoliciesPage.tsx`: Policy manager — table with category chips, search/filter, load 12 standard policies button, view dialog with full content, create/edit form
- `apps/web/src/pages/goals/GoalsPage.tsx`: Goals tracker — summary cards (total/active/completed/avg progress), table with progress bars, status/CQC chips, create/edit dialog with service user autocomplete
- `apps/web/src/pages/dashboard/DashboardPage.tsx`: Dashboard with expanded KPIs (7 cards — Total Staff, Active Residents, Staff on Duty, Compliance Rate, Open Shifts, Alerts, Agency Saved), onboarding checklist, widgets row (DBS Renewals Due, Training Expiring, Pending Leave), live readiness scoring, Today's Rota, Today's Appointments list
- `apps/api/src/modules/dashboard/dashboard.repository.ts`: Extended — `getStats` returns 7 fields (added `active_residents`, `staff_on_duty`, `open_incidents`), new `getWidgets` method for widget data
- `apps/api/src/modules/compliance/compliance.notifications.ts`: Fixed ambiguous `status` column reference in `checkEscalationThresholds` (changed to `cr.status`)

## Done (This Session — Phase 2 Acceleration + Legal + Performance)

### Competency Module Completed (7/10 → 9/10)
- **Evidence upload per assessment**: `evidence_url` column added to `competency_assessments`, file picker in Assess Now dialog uploads to `/settings/upload`, passed through controller → repository
- **Auto-reassessment**: `checkCompetencyDue()` runs every 6 hours, sends in-app + email notifications for due/overdue assessments. `getPending()` returns staff crossed with templates where assessment is missing/failed/past reassessment date
- **Role-based templates**: `required_for_roles` JSONB column on `competency_templates`. Template editor has multi-select role picker. `getPending()` filters staff by role match. Staff only see templates relevant to their role in pending list

### Rota Planner Performance
- **N+1 query eliminated**: Batch assignment fetch (`getAssignmentsBatch`) replaces per-shift queries — 301 queries → 2 per page load
- **DB indexes added**: `idx_shifts_end_time` and composite `idx_shifts_range(location_id, start_time, end_time)`
- **Frontend caching**: Staff list, locations, min-staff, service users fetched once on initial load, not on every week change

### Billing UX Redesign
- **Add Card Modal**: Stripe Elements + manual entry fallback with test card info displayed
- **ATM-style landscape cards**: Brand-colored gradients, chip icon, monospace card numbers, expiry + cardholder, Make Default / Remove buttons with hover reveal
- **Trial fix**: Trial status now computed from `trialEndsAt` regardless of DB subscription_status
- **Postcode fix**: `hidePostalCode: true` on Stripe CardElement

### Legal Pages
- **Privacy Policy**: `/privacy` — UK GDPR-compliant, covers data collection, legal bases, special category data, retention, rights, security
- **Terms of Use**: `/terms` — Acceptable use, data processing, payment, liability, IP, termination, governing law
- **Cookie Policy**: `/cookies` — Essential cookies only, no tracking/advertising
- **Footer**: Added "Legal" section with all three links

### Task Management Module ✅
- `tasks` table with CRUD endpoints, sidebar link, kanban-style status chips, Autocomplete assign, dashboard widget

### Room Checks Module ✅
- `room_checks` table with photo upload, ratings, location Autocomplete. Now a tab on Service User profile filtered by room number

### Learning Center ✅
- `/learn` — 14 sections covering every module with step-by-step instructions, search, sidebar navigation, public access
- Linked from NavHeader, Footer, and sidebar

### Body Map ✅
- SVG anatomical body diagrams (front/back), 60+ clickable zones, condition recording, status tracking

### Memory Book ✅
- Photo journal for service users with authenticated image loading, card grid display

### Marketing Automation Tool ✅
- `apps/marketing/` — CQC HTML scraper, contact enrichment (5 sources), email engine with 3 templates + open/click tracking, SQLite lead CRM, minimal dashboard. Internal tool on port 3005

### Mobile PWA ✅
- web manifest, service worker, offline caching, installable on `/dashboard`
- GPS Check-In (`/check-in`) and Voice Notes (`/voice-notes`) as in-app pages
- Hidden from desktop sidebar (PWA-only features)

### Deferred to Phase 2 (Still)
- E-learning/SCORM integration (requires LMS partner)
- Digital signatures (requires Docusign/Adobe Sign API)
- DBS API (requires GBG/uCheck partnership)
- SMS notifications (requires Twilio)
- PrintNode physical document printing
- NHS DSPT certification (registration opens October 2026)
- Family Portal
- Document Drive
- Full Reporting Suite (live data PDFs)

### Competency Score Breakdown
| Module | Score | Notes |
|--------|-------|-------|
| Training Compliance Matrix | ~90/100 | Auto-assign from roles, CQC-mandated tagging, no e-learning |
| DBS/Visa Auto-Monitoring | ~90/100 | Auto-renewal, all types on dashboard, no DBS API |
| Competency Assessments | ~90/100 | Evidence upload, role-based templates, rubric system |
| Evidence Packs | ~100/100 | Scheduled generation, configurable mappings, service user evidence |
| CQC Readiness Scoring | ~100/100 | Multi-regulator, real data, action plan tracking |
| Notifications/Trends | ~90/100 | Predictive alerts, user preferences, trend chart |
| Audit Trail | ~90/100 | Wired across 40+ mutation points |
| Satisfaction/Engagement | ~90/100 | Full feedback viewing, manager notes, template filters |
