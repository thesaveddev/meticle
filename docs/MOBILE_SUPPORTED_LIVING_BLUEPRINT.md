# Meticle Care Mobile — Supported Living Blueprint

## Version 1.0 — Draft, not yet built

**Status:** Specification only. No code has been written against this document.
**Scope:** The Meticle Care mobile app (Expo, `apps/mobile`) for organisations whose primary service model is `supported_living` or `residential`.
**Companion:** `METICLE_BLUEPRINT.md` (platform-wide), `PRODUCT.md`, `docs/DPIA_Live_Active_Visit_Map.md`.

---

## 1. Why this document exists

The mobile app was built for **domiciliary** care. Almost all of its data layer calls `/homecare/*`, which is mounted behind `requireDomiciliaryOnly` in `apps/api/src/index.ts:323`. A supported-living organisation is refused every one of those endpoints, so the app as shipped has no usable home screen for them.

This blueprint specifies what the app becomes for supported living: the full capability set for **managers** (ORG_ADMIN, MANAGER) and **support workers** (CARE_WORKER), plus the compliance officer role where it differs.

Every endpoint named below was read from the route files in `apps/api/src/modules/*/`. Where a capability does not exist in the backend yet, it is listed in §9 as required work rather than described as if it were available. That distinction is the point of this document.

---

## 2. Roles

From `packages/shared/src/types.ts`:

| Role | Constant | Mobile treatment |
|---|---|---|
| Organisation admin | `ORG_ADMIN` | Manager surface + settings and org configuration |
| Manager | `MANAGER` | Manager surface |
| Support worker | `CARE_WORKER` | Field surface |
| Compliance officer | `COMPLIANCE_OFFICER` | **New third treatment.** Today the app's `isManager` check in `App.tsx` treats them as support workers, which is wrong for supported living where they are a distinct audience |
| Super admin | `SUPER_ADMIN` | Not applicable; platform console is web-only |

The app must read the role from `/auth/me` and the service model from the session organisation payload, exactly as the web `ModuleGuard` does. It must **not** infer service type from `localStorage` or from a cached copy; the web app was bitten by exactly that and now treats `primary_service_type` as authoritative.

---

## 3. What is different about supported living

The domiciliary app is built around **visits**: a carer travels to a client's home, checks in with GPS, completes care tasks, checks out with a photo. Supported living is built around **shifts and residents in a setting**. That changes the primary object of the app.

| Dimension | Domiciliary (shipped) | Supported living (this blueprint) |
|---|---|---|
| Primary object | A visit | A shift, and the residents on it |
| Location evidence | GPS check-in/out per visit | Shift attendance (clock on/off) — **does not exist yet**, see §9.1 |
| Evidence model | Photo at check-out | Room checks, body maps, MAR chart, observations |
| Time model | Discrete appointments | Continuous shift, break logging, handover |
| Core daily rhythm | Next visit | Shift start → rounds → handover → shift end |
| Key handover artefact | None | Shift handover notes — **does not exist yet**, see §9.2 |
| Medication | Not offered (gated out) | MAR rounds, a first-class daily task |
| Data protection | Client's home address | Several residents' sensitive data on one device |

The last row is the one that most shapes the design. A support worker on an SL shift has legitimate access to many residents' health data simultaneously, held in one person's pocket. §11 treats this directly.

---

## 4. Information architecture

Five tabs, differing by role. This mirrors the existing `carerTabs` / `managerTabs` split in `App.tsx` so the shell does not have to be rewritten.

### 4.1 Support worker (CARE_WORKER)

| Tab | Purpose |
|---|---|
| **Today** | The shift: who is on, what is due, attention flags. Replaces the visit list. |
| **Rota** | My shifts, week view, open calls, swap/transfer. |
| **People** | Resident directory and record, scoped to residents on my shift or my team. |
| **Chat** | Channels, DMs, handover groups. Reuse of the shipped screen. |
| **Settings** | Profile, availability, leave, training, sync. |

### 4.2 Manager (ORG_ADMIN, MANAGER)

| Tab | Purpose |
|---|---|
| **Today** | Operational dashboard: on-shift now, unfilled shifts, incidents, overdue meds, exceptions. |
| **Rota** | Full rota, create/edit shifts, approve claims, agency cover. |
| **People** | All residents; assessments, care plans, risk, time away, discharge. |
| **Tasks** | House-level tasks, room checks, allocation. |
| **More** | Incidents, medication oversight, staff, compliance, expenses, reporting, chat, settings. |

### 4.3 Compliance officer (COMPLIANCE_OFFICER)

| Tab | Purpose |
|---|---|
| **Today** | Compliance dashboard: readiness, expiring documents, DBS, training, open actions. |
| **Evidence** | CQC readiness, evidence packs, audits, action items. |
| **People** | Read-only resident records. |
| **Staff** | Staff compliance, training matrix, DBS, competency. |
| **More** | Chat, settings. |

---

## 5. Capability matrix — support worker

Read = can view. Write = can create or edit. Everything below is the **target**; the "status" column states what exists today.

| # | Capability | Endpoints | Read | Write | Offline | Status |
|---|---|---|---|---|---|---|
| S1 | My shifts | `GET /shifts/my-shifts`, `GET /shifts/:id` | ✓ | — | cache | Exists |
| S2 | Open calls / claim | `GET /shifts/open`, `POST /shifts/:id/claim` | ✓ | ✓ | queue | Exists |
| S3 | Swap / transfer | `POST /shifts/:shiftId/swap-request`, `GET /shifts/swap-requests/my`, `PATCH /shifts/swap-response/:swapId` | ✓ | ✓ | queue | Exists (dom client) |
| S4 | Shift clock-on / clock-off | *none* | — | ✓ | **queue** | **Missing, §9.1** |
| S5 | Shift handover note | *none* | ✓ | ✓ | queue | **Missing, §9.2** |
| S6 | Resident directory | `GET /people`, `GET /people/:id` | ✓ | — | cache | Exists |
| S7 | Daily notes | `GET /people/:personId/daily-notes`, `POST` | ✓ | ✓ | **queue** | Exists (write is role-gated to CW ✓) |
| S8 | Risk assessments | `GET /people/:personId/timeline` | ✓ | — | cache | Exists, read-only |
| S9 | Body map | `GET /body-map/person/:id`, `POST /body-map`, `PATCH /body-map/:id` | ✓ | ✓ | **queue** | Exists (shipped screen) |
| S10 | MAR — today's chart | `GET /emedication/daily-counts/medications`, `GET /emedication/records` | ✓ | — | cache | Exists (shipped screen) |
| S11 | Record administration | `POST /emedication/administrations` | ✓ | ✓ | **queue** | Exists |
| S12 | Meal / nutrition record | `GET /nutrition/:personId/meals`, `POST` | ✓ | ✓ | queue | Exists (shipped screen) |
| S13 | Health observations | `GET/POST /health/:personId/observations`, `/fluid`, `/sleep`, `/bowel`, `/dental` | ✓ | ✓ | **queue** | Exists, not surfaced on mobile |
| S14 | Room check | `GET /room-checks` | ✓ | — | cache | Exists, but write blocked, §9.4 |
| S15 | Tasks — view | `GET /tasks`, `GET /tasks/:id` | ✓ | — | cache | Exists |
| S16 | Tasks — complete | `PATCH /tasks/:id` | — | ✓ | queue | **Blocked, §9.3** |
| S17 | Report an incident | `POST /incidents` | — | ✓ | **queue** | **Blocked, §9.5 — P0** |
| S18 | Incident categories (picker) | `GET /incidents/categories` | ✓ | — | cache | **Blocked, §9.5** |
| S19 | Wellbeing | `GET/POST /people/:personId/wellbeing` | ✓ | ✓ | queue | Exists |
| S20 | Communication log | `GET/POST /people/:personId/communication-log` | ✓ | ✓ | queue | Exists |
| S21 | Capacity assessment | `GET/POST /people/:personId/capacity` | ✓ | — | cache | Exists, read-only |
| S22 | Care pathway | `GET/POST /people/:personId/care-pathways` | ✓ | — | cache | Exists, read-only |
| S23 | Clinical scores | `GET/POST /people/:personId/clinical-scores` | ✓ | — | cache | Exists, read-only |
| S24 | Time away | `GET/POST /people/:personId/time-away` | ✓ | — | cache | Exists, read-only |
| S25 | Assessments | `GET/POST /people/:personId/assessments` | ✓ | — | cache | Exists, read-only |
| S26 | Documents | `GET /people/:personId/documents` | ✓ | — | cache | Exists (shipped) |
| S27 | My training | `GET /training/records`, `GET /training/expiring` | ✓ | — | cache | Exists |
| S28 | My competency assessments | `GET /competency/pending` | ✓ | — | cache | Exists |
| S29 | My leave | `GET /leave/my-requests`, `POST`, `PATCH /leave/requests/:id/cancel` | ✓ | ✓ | queue | Exists (shipped screen) |
| S30 | Leave balances | `GET /leave/balances` | ✓ | — | cache | Exists |
| S31 | Chat / handover comms | `/chat/*` | ✓ | ✓ | queue | Exists (shipped) |
| S32 | Notifications | `GET /notifications`, `PATCH /:id/read`, `PATCH /read-all` | ✓ | ✓ | — | Exists (shipped) |
| S33 | My profile | `GET/PATCH /staff/:userId/profile`, `POST /staff/me/photo` | ✓ | ✓ | queue | Exists (shipped, recently fixed) |
| S34 | Emergency contacts (mine) | `POST /staff/:userId/emergency-contacts` | — | ✓ | queue | Exists, ORG_ADMIN-gated, §9.6 |
| S35 | Deactivate my account | `POST /staff/self-deactivate` | — | ✓ | — | Exists, **not surfaced**, §9.6 |
| S36 | Expenses / petty cash | `GET /expenses/petty-cash/balances`, `POST /expenses/petty-cash/transactions` | ✓ | ✓ | queue | Exists, no role gate |
| S37 | Policy acknowledgement | *none* | ✓ | ✓ | queue | **Missing, §9.7** |

---

## 6. Capability matrix — manager

Everything in §5 that is marked read-only becomes read/write, plus:

| # | Capability | Endpoints | Status |
|---|---|---|---|
| M1 | Rota — create / edit / delete shifts | `POST /shifts`, `PATCH /shifts/:id`, `DELETE /shifts/:id` | Exists |
| M2 | Assign / unassign staff | `POST /shifts/:id/assign`, `DELETE /shifts/:shiftId/assign/:staffId` | Exists |
| M3 | Approve / reject claims | `PATCH /shifts/:shiftId/approve-claim/:staffId`, `reject-claim` | Exists |
| M4 | Unfilled shift alerts | `GET /shifts/unclaimed`, `GET /shifts/pending-claims` | Exists |
| M5 | Send to agency | `PATCH /shifts/:id/send-to-agency` | Exists |
| M6 | Agency directory & rates | `GET /agencies`, `/rates`, `/savings`, `POST /agencies` | Exists, SL-gated |
| M7 | Shift templates & min staffing | `GET/POST /shifts/templates`, `GET /shifts/min-staff` | Exists |
| M8 | 11-hour rest enforcement | server-side on `POST /shifts` | Exists |
| M9 | Review leave | `GET /leave/requests`, `PATCH /leave/requests/:id/review` | Exists (shipped screen) |
| M10 | Staff directory | `GET /staff/org-members`, `GET /staff/:userId` | Exists (shipped screen) |
| M11 | Staff compliance view | `GET /staff/:userId/compliance` | Exists |
| M12 | DBS checks | `GET /dbs/checks`, `/stats`, `POST /dbs/checks/:id/poll` | Exists, not on mobile |
| M13 | Training matrix & bulk assign | `GET /training/matrix`, `POST /training/bulk-assign`, `auto-assign` | Exists, not on mobile |
| M14 | Competency templates & assessments | `GET/POST /competency/templates`, `/assessments` | Exists, not on mobile |
| M15 | Room checks — full CRUD | `POST/PATCH/DELETE /room-checks` | Exists, not on mobile |
| M16 | Tasks — full CRUD | `POST/PATCH/DELETE /tasks` | Exists, not on mobile |
| M17 | Incidents — full lifecycle | `/incidents/*`, actions, attachments, timeline | Exists, not on mobile |
| M18 | Appointments | `GET/POST/PATCH/DELETE /appointments`, `GET /today-stats` | Exists, not on mobile |
| M19 | MAR oversight & audit | `GET /emedication/audit-logs`, `/overdue`, `POST /emedication/ensure-monthly-mar` | Exists, not on mobile |
| M20 | Medication stock & deliveries | `/emedication/stock`, `/deliveries`, `/daily-counts` | Exists, not on mobile |
| M21 | Nutrition — meal plans, shopping list, PDF | `GET/POST /nutrition/meal-plans`, `POST /nutrition/export/meal-plan-pdf` | Exists, not on mobile |
| M22 | Care plans & risk assessments | `POST /people/:personId/care-plans`, `/risk-assessments` | Exists, not on mobile |
| M23 | Assessments, capacity, pathways, clinical scores | write variants under `/people` | Exists, not on mobile |
| M24 | Discharge & time-away checklist | `GET /people/:id/time-away/:id/checklist`, `PATCH /discharge-checklist/:id` | Exists, not on mobile |
| M25 | Operational dashboard | `GET /dashboard/stats`, `/compliance`, `/today-rota`, `/widgets`, `/review-scheduler` | Exists, SL-gated |
| M26 | Mission Control | `GET /mission-control/summary`, `/alerts`, `/trends`; `PATCH .../dismiss`, `/assign` | Exists, SL-gated |
| M27 | Insights | `GET /insights/overview`, `/staffing`, `/compliance`, `/leave`, `/rota`, `/care-outcomes` | Exists, not on mobile |
| M28 | Shift audit & email | `GET /shift-audit/daily`, `POST /send-emails` | Exists, not on mobile |
| M29 | Expenses & petty cash reconciliation | `/expenses/petty-cash/*` | Exists, not on mobile |
| M30 | Surveys | `GET /surveys/satisfaction`, `/engagement`, `POST .../invite` | Exists, not on mobile |
| M31 | AI assistance | `POST /ai/manager-briefing`, `/end-of-day`, `/rota-alternatives`, `/operations-copilot` | Exists, not on mobile |
| M32 | Compliance documents & evidence packs | `GET /compliance/documents`, `/expiring`, `/evidence-pack` | Exists, not on mobile |
| M33 | CQC readiness & action items | `GET /cqc/readiness`, `/gap-analysis`; `POST/PATCH /cqc/action-items` | Exists, not on mobile |
| M34 | Staff onboarding | `POST /staff`, `PATCH /staff/:userId/role`, `/status`, `POST /staff/:userId/force-password-reset` | Exists, web-only by design |

### Explicitly web-only for managers

Subscription and billing, organisation branding, departments and teams, module permissions, role editing, platform admin, report builder, and AI configuration. These are desk tasks with no field value; putting them on a phone would dilute the app without helping anyone.

---

## 7. Screen inventory

### Shared
| Screen | Notes |
|---|---|
| `LoginScreen` | Reuse. Extend biometric prompt copy for "support worker". |
| `RotaScreen` | **New.** Week grid, my shifts / full rota by role, tap a shift for detail. |
| `ShiftDetailScreen` | **New.** Times, location, assigned staff, claim state, clock-on/off, handover. |
| `PeopleScreen` | **New.** Searchable resident list, scoped by role and shift. |
| `ResidentRecordScreen` | **New.** A single scrollable record with the §5 sections as anchors. Deliberately *not* the tab-per-section pattern the domiciliary client uses — on a phone, one long record with a sticky section index reads better and avoids the deep-navigation problem. |
| `MedicationRoundScreen` | **New.** Today's MAR by resident, one-tap given/refused/omitted with reason. |
| `TaskScreen` | **New.** Assigned tasks, complete with note and optional photo. |
| `RoomCheckScreen` | **New.** Checklist per room, photo evidence. |
| `ObservationScreen` | **New.** Health observations: fluid, sleep, bowel, dental, weight, skin. |
| `HandoverScreen` | **New.** Per-shift handover: what happened, what is outstanding, who is aware. |
| `IncidentReportScreen` | **New** for SL (a dom version exists but cannot call the API). |
| `ChatScreen` | Reuse. |
| `SettingsScreen` | Reuse. |
| `ProfileScreen` | Reuse. |
| `SwapTransferScreen` | Reuse, repointed from `/homecare` to `/shifts`. |
| `AnnualLeaveScreen` | Reuse. |

### Manager-only
| Screen | Notes |
|---|---|
| `ManagerDashboardScreen` | Reuse the shape of the dom `ManagerDashboard`, repointed to `/dashboard/*`. |
| `RotaBuilderScreen` | **New.** Create/edit shifts, drag-free but fast: pick date, time, location, staff. |
| `ClaimsScreen` | **New.** Pending approvals. |
| `IncidentManagerScreen` | **New.** Triage, action items, attachments, CQC reportability. |
| `StaffComplianceScreen` | **New.** DBS, training, competency per person. |
| `ComplianceHomeScreen` | **New.** Readiness, expiring, evidence packs. |
| `InsightsScreen` | **New.** Read-only charts. |

### To retire for supported living
`MileageScreen`, `RideShareScreen`, `CarerTotalsScreen`, `TimesheetsScreen`, `AllVisitsScreen`, `LiveMapScreen`, `CallAssignmentBoard`, `AvailabilityScreen`, `MyWeekPage` equivalents. All are domiciliary concepts backed by `requireDomiciliaryOnly` endpoints. They should be removed from the supported-living bundle rather than hidden, so the app has one coherent information architecture.

---

## 8. Offline and sync

The domiciliary app already has the right primitive: a durable action queue in `expo-secure-store` with transient-vs-permanent failure classification and bounded retries. Supported living reuses it, generalised.

**Queueable offline:** shift clock-on/off (S4), handover (S5), daily notes (S7), body map (S9), medication administration (S11), meals (S12), observations (S13), task completion (S16), incident reports (S17), wellbeing (S19), communication log (S20), swaps (S3), leave (S29), chat (S31).

**Cache-only offline:** resident directory and records, rota, tasks, room checks, medication charts, training.

**Never offline:** medication *stock* adjustments, DBS, compliance documents, anything that moves money or a person's legal employment status.

**Conflict rules**, stated up front so they are not improvised later:
- **Idempotent by action key.** Every queued write carries a client-generated idempotency key, exactly as `executeVisitAction` does with `action_key`. A retry must never double-record a dose.
- **Last-write-wins is not acceptable for clinical records.** For daily notes, observations and handover, the server keeps both versions and the manager is shown a conflict. Two support workers recording "resident seemed low" at the same time is exactly the case where silent overwriting destroys evidence.
- **Medication is append-only.** A recorded administration is never edited offline, only voided by a new record. The MAR audit trail depends on it.
- **Ordering per resident.** All queued writes for one resident flush in the order they were made.

**Retention:** unsynced actions are never deleted by a sign-out. The app flushes first, warns, and refuses to discard silently.

---

## 9. Backend work required before any of this can ship

These are the real blockers. Items 9.1, 9.3, 9.4 and 9.5 are role-gate changes that currently make core support-worker duties impossible.

### 9.1 Shift attendance — P0, does not exist
There is no equivalent of `/homecare/visits/:id/offline/check-in` for supported living. Shifts are scheduled but not attended. Without this the app cannot evidence that a support worker was on duty, and overtime and the 11-hour rest rule rest on manager inference.

Needs: `POST /shifts/:id/clock-on`, `POST /shifts/:id/clock-off`, `GET /shifts/:id/attendance`, columns on `shifts` for actual start/end, and the same offline idempotency contract as visits.

### 9.2 Shift handover — P0, does not exist
The defining handover artefact of supported living. Needs `POST /shifts/:id/handover`, `GET /shifts/:id/handover`, with acknowledgement by named staff.

### 9.3 Support workers cannot complete tasks — P0
`PATCH /tasks/:id` is `requireRole(ORG_ADMIN, MANAGER)` in `apps/api/src/modules/tasks/tasks.routes.ts:16`, but the web navigation offers Tasks to `CARE_WORKER` for supported living. A support worker opens Tasks, sees the list, and gets a 403 on completion. Needs a self-service patch path that permits status and completion fields while keeping title, ownership and deletion manager-only.

### 9.4 Support workers cannot record room checks — P0
`POST /room-checks` and `PATCH /room-checks/:id` are manager-only (`room-checks.routes.ts:15-16`). Room checks are precisely a support worker's task. Needs a create-with-checklist-results path for the staff member on shift.

### 9.5 Support workers cannot report incidents — P0
Every route in `incidents.routes.ts` is `requireRole(ORG_ADMIN, MANAGER)`, including `POST /` and `GET /categories`. This is the most serious gap in the whole blueprint: a support worker who witnesses a fall, a medication error or a safeguarding concern **has no way to report it from the field**, and must phone a manager. It also affects the web app today. Needs a support-worker reporting path with a narrow read scope limited to incidents they are recorded as involved in.

This should be treated as a safeguarding control, not a feature. The CQC and local authority expectations are explicit that any staff member can raise a concern.

### 9.6 Self-service account management — P1
`POST /staff/:userId/emergency-contacts` is ORG_ADMIN-only, and `POST /staff/self-deactivate` is not surfaced anywhere in the mobile app. Both matter for store compliance: Google Play requires a user-reachable account deletion path, and the endpoint already exists.

### 9.7 Policy acknowledgement — P1
The web app has a policy library; there is no way for a support worker to read or acknowledge a policy on mobile, and no record of who has read what. Needed for inspection evidence.

### 9.8 Compliance officer mobile treatment — P1
The app has no third role model. See §2.

### 9.9 Notification targeting — P1
The notification service is shared and works, but supported living needs event types the domiciliary app never produces: unfilled shift, handover due, missed medication round, incident raised, DBS or training expiring, room check overdue.

### 9.10 Read-scoping for residents — P1
`GET /people` currently returns the organisation's residents. For supported living, a support worker should see residents on their shift or their team, not the whole organisation. This is a least-privilege change with a real data-protection argument behind it.

---

## 10. Notifications

| Event | Audience | Deep link |
|---|---|---|
| Shift starts soon | Support worker | Shift detail |
| Handover due at shift end | Support worker | Handover |
| Unfilled shift within 48h | Manager | Rota builder |
| Claim awaiting approval | Manager | Claims |
| Medication round not started | Support worker, manager | Medication round |
| Incident raised | Manager, compliance | Incident |
| Room check overdue | Support worker, manager | Room check |
| DBS or training expiring (30 days) | Support worker, manager | Staff compliance |
| Direct message | Recipient | Chat |
| Handover acknowledged by named staff | Outgoing support worker | Handover |

Every notification must deep-link to the thing it is about, and a notification that launched the app must be honoured on cold start. The shipped app now does this for the events it knows about; the same contract applies here.

---

## 11. Privacy, security and store posture

- **Least privilege on the device.** §9.10 is not optional. A phone that lists every resident in the organisation is a data-protection incident waiting to happen.
- **Remote wipe.** The secure-store session should be revocable server-side so a lost phone can be signed out. Needs a session-list endpoint.
- **Screenshot and background protection.** A pragmatic option is to obscure the app switcher snapshot. Worth deciding explicitly rather than by default.
- **Audit trail.** Anything written offline is timestamped on the device and on the server, and the two are reconcilable. For an SL inspection, "when was this recorded and by whom" is the first question asked.
- **Data declarations.** Play Data safety and Apple App Privacy must declare health data, precise location, photos and identifiers. This is the same declaration work identified in the store-launch audit.
- **Permission strings.** Camera, photo library and Face ID purpose strings must be Meticle Care's own, not Expo's defaults, and must say why a care worker needs each.

---

## 12. Delivery sequence

**Phase 1 — make the app usable at all.** Service-type branching, role modelling including compliance officer, rota screen, resident list and record, repoint swaps and leave to `/shifts` and `/leave`. Read-mostly. Retires the domiciliary screens.

**Phase 2 — the field write path.** Shift clock-on/off (9.1), daily notes, body map, medication round, observations, meals, task completion (9.3), room checks (9.4). This is the phase that makes it a working tool rather than a browser.

**Phase 3 — safeguarding.** Incident reporting (9.5), handover (9.2), notifications (9.9), read-scoping (9.10). These are the regulatory items and should not be allowed to slip behind convenience work.

**Phase 4 — manager.** Dashboard, rota builder, claims, staff compliance, incident management, insights, compliance home.

**Phase 5 — polish.** Policy acknowledgement, self-service account management and deletion, remote wipe, app switcher protection, store assets and listing copy.

The ordering is deliberate. Phases 1 and 2 are the value; phase 3 is the obligation; phase 4 is the upsell. Doing phase 4 before phase 3 would ship a manager app that cannot report its own safeguarding concerns.

---

## 13. Non-goals

- Not replacing the web app. Anything that is a desk task stays on the web.
- Not a client or family portal. That is a separate product with separate consent.
- Not offline-first for everything. Clinical and money-moving records stay online.
- Not a rota drag-and-drop planner. The web planner is better and managers use a bigger screen.
- Not an HR system. Employment status changes stay on the web.

---

## 14. Open questions for the product owner

1. Should support workers see all residents in the organisation, or only those on their team and shift? §9.10 assumes the latter.
2. Is a support worker allowed to record that a medication was *refused*? This is a safeguarding-adjacent decision, not a technical one.
3. Does handover need to be a formal CQC-recorded artefact, or an operational note? The answer changes §9.2 substantially.
4. Should the app show live location to managers in supported living, as the domiciliary live map does? It is a materially different privacy decision in a setting where staff are already on site.
5. Is per-device remote wipe required by any prospect's security questionnaire, or only by policy?
