# Meticle Care Mobile — Supported Living Blueprint

## Version 1.0 — Draft, not yet built

**Status:** Specification only. No code has been written against this document.
**Re-checked 16 October 2026 (see `FEATURE_READINESS_AUDIT.md` §3.2):** §9.3, §9.4 and §9.5 are **closed** — the API no longer refuses a support worker those duties. **§9.1 (shift attendance) and §9.2 (shift handover) closed on the same day** — both now exist at the API, with the visit check-in idempotency contract, and are reachable from the web rota's shift detail. **§9.2's mobile half closed on 17 October 2026:** the phone records, amends and acknowledges a shift handover, reached from the handover-due notification and from the Schedule tab's handover list. **§9.1's mobile half closed on 18 October 2026:** `ShiftClockScreen` clocks on and off from the shift card on the Schedule tab, keeps a press that could not reach the server, and leads into the shift's handover — so the whole supported-living lifecycle is native on the device. **Added 16 October 2026:** §9.9's *handover due at shift end* is no longer a missing event type — a sweeper raises `shift.handover_due` for a shift that ended with no handover recorded and notifies the staff on that shift. **Added 17 October 2026:** the last of §9.9's six event types, *room check overdue*, now has a producer too (`room_check.overdue`, detected from the residents' occupied rooms), and the mobile notifications screen receives all six on tap and on cold start — so §9.9 is closed at the API and what remains is the screens that record the underlying work.
**Scope:** The Meticle Care mobile app (Expo, `apps/mobile`) for organisations whose primary service model is `supported_living` or `residential`.
**Companion:** `METICLE_BLUEPRINT.md` (platform-wide), `PRODUCT.md`, `docs/DPIA_Live_Active_Visit_Map.md`.

---

## 1. Why this document exists

The mobile app was built for **domiciliary** care. Almost all of its data layer calls `/homecare/*`, which is mounted behind `requireDomiciliaryOnly` in `apps/api/src/index.ts:321`. A supported-living organisation is refused every one of those endpoints, so the app as shipped has no usable home screen for them.

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
| Location evidence | GPS check-in/out per visit | Shift attendance (clock on/off) — `POST /shifts/:id/clock-on`, `/:id/clock-off`, `GET /:id/attendance`, offline replay via `/:id/offline/clock-on`; **built on the phone 18 October 2026** (`ShiftClockScreen`), see §9.1 |
| Evidence model | Photo at check-out | Room checks, body maps, MAR chart, observations |
| Time model | Discrete appointments | Continuous shift, break logging, handover |
| Core daily rhythm | Next visit | Shift start → rounds → handover → shift end |
| Key handover artefact | None | Shift handover notes — **API and mobile**, 17 Oct 2026: `POST/GET /shifts/:id/handover` with amendment by version and acknowledgement by named staff, and the phone's `HandoverScreen` records, amends and acknowledges one (§9.2) |
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
| S4 | Shift clock-on / clock-off | `/shifts/:id/clock-on`, `/clock-off`, `/attendance`, `/offline/clock-on` | — | ✓ | **queue** | **Built 18 Oct 2026, §9.1** — `ShiftClockScreen`, reached from the Schedule tab's shift card, with the press kept on the phone if it cannot be sent |
| S5 | Shift handover note | `/shifts/:id/handover` (+`/handover/acknowledge`, `/offline/handover`) | ✓ | ✓ | draft kept on the phone | **Built 17 Oct 2026, §9.2** — `HandoverScreen`, with the draft offered back after a failed send |
| S6 | Resident directory | `GET /people`, `GET /people/:id` | ✓ | — | cache | Exists |
| S7 | Daily notes | `GET /people/:personId/daily-notes`, `POST` | ✓ | ✓ | **queue** | Exists (write is role-gated to CW ✓) |
| S8 | Risk assessments | `GET /people/:personId/timeline` | ✓ | — | cache | Exists, read-only |
| S9 | Body map | `GET /body-map/person/:id`, `POST /body-map`, `PATCH /body-map/:id` | ✓ | ✓ | **queue** | Exists (shipped screen) |
| S10 | MAR — today's chart | `GET /emedication/daily-counts/medications`, `GET /emedication/records` | ✓ | — | cache | Exists (shipped screen) |
| S11 | Record administration | `POST /emedication/administrations` | ✓ | ✓ | **queue** | Exists |
| S12 | Meal / nutrition record | `GET /nutrition/:personId/meals`, `POST` | ✓ | ✓ | queue | Exists (shipped screen) |
| S13 | Health observations | `GET/POST /health/:personId/observations`, `/fluid`, `/sleep`, `/bowel`, `/dental` | ✓ | ✓ | **queue** | Exists, not surfaced on mobile |
| S14 | Room check | `GET /room-checks`, `POST`, `PATCH /:id` | ✓ | ✓ | cache | **API open — §9.4 closed 16 Oct 2026**; the screen is still to build |
| S15 | Tasks — view | `GET /tasks`, `GET /tasks/:id` | ✓ | — | cache | Exists |
| S16 | Tasks — complete | `PATCH /tasks/:id` | — | ✓ | queue | **API open — §9.3 closed 16 Oct 2026** (a non-manager is narrowed to status and notes); the screen is still to build |
| S17 | Report an incident | `POST /incidents`, `GET /incidents/:id` | ✓ own | ✓ | **queue** | **API open — §9.5 closed 16 Oct 2026**; a reporter can read back their own incident and nothing else, and the screen is still to build |
| S18 | Incident categories (picker) | `GET /incidents/categories` | ✓ | — | cache | **API open — §9.5 closed 16 Oct 2026**; needed by the report screen, still to build |
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
| S35 | Deactivate my account | `POST /staff/self-deactivate` | — | ✓ | — | Exists and **surfaced 16 Oct 2026** — Settings, under a destructive confirm (§9.6) |
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
| `HandoverScreen` | **Built 17 Oct 2026** (`src/screens/HandoverScreen.tsx`). Per-shift handover: what happened, what is outstanding, who is aware; version history, acknowledgement by a named reader (never the author), and a handover typed with no connection kept on the device until it is sent. Opened from the handover-due notification, which now resolves to the shift it names, and from the Schedule tab's handover list. |
| `IncidentReportScreen` | **New** for SL (a dom version exists but cannot call the API). The API path is open since 16 Oct 2026 — §9.5 — so this is screen work, not backend work. |
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

**Queueable offline:** shift clock-on/off (S4), handover (S5), daily notes (S7), body map (S9), medication administration (S11), meals (S12), observations (S13), task completion (S16), incident reports (S17), wellbeing (S19), communication log (S20), swaps (S3), leave (S29), chat (S31). **Handover's offline handling shipped on 17 Oct 2026 as a retained draft rather than a background queue** — one handover per shift, typed by one person, is not the same traffic as a stream of medication administrations, and a paragraph reappearing for the carer to send is the honest version of "queued" for it.

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

These were the real blockers. Items 9.3, 9.4 and 9.5 were role-gate changes that made core support-worker duties impossible; **all three closed at the API on 16 October 2026**. **9.1 (shift attendance) and 9.2 (handover) — the last two P0s — closed later the same day**, so there is no P0 left in this section. **9.6 has closed as well** — deletion is now reachable in web and mobile — so 9.7, 9.8 and 9.10 are unchanged and all three are P1; **9.9 is now closed at the API** — the handover-due event landed on 16 October 2026 and **room check overdue closed on 17 October 2026**, so all six of its event types have a producer and the phone receives them (see §9.9).

### 9.1 Shift attendance — P0, **closed 16 October 2026 at the API**
There was no equivalent of `/homecare/visits/:id/offline/check-in` for supported living. Shifts were scheduled but not attended. Without this the app could not evidence that a support worker was on duty, and overtime and the 11-hour rest rule rested on manager inference.

**Built:** `POST /shifts/:id/clock-on`, `POST /shifts/:id/clock-off`, `GET /shifts/:id/attendance`, and the offline contract at `POST /shifts/:id/offline/clock-on|clock-off`. `shifts` carries `actual_start_at`, `actual_end_at`, `clocked_on_by` and `clocked_off_by` as the rolled-up summary the rota and reports read (migration 152).

The three decisions that shape it, all of which a later screen must not undo:

- **Attendance is an append-only event log, and the pairing is counted rather than ordered.** A worker steps out and returns mid-shift, and an offline phone replays a queued clock-on *after* a later action has already landed, so "is this person on duty?" is answered by comparing clock-ons with clock-offs — a question whose answer does not depend on arrival order. The shift row is locked for the duration of a clock action, so two concurrent retries cannot both pass that comparison.
- **Attendance belongs to the worker who is rostered.** A manager reads it; only the person on the shift records it, which is enforced in the repository (`requireRosteredStaff`, and an unapproved claim is not a duty). Same duty-without-ownership shape as §9.3 and §9.4.
- **The device's clock is kept next to the server's.** An offline action sends `recorded_at` from the phone and the row keeps both it and the server's `created_at`, so the two are reconcilable at inspection (§11). A device clock in the future is refused rather than clamped.

**The phone screen closed on 18 October 2026** — `ShiftClockScreen` (§7 `ShiftDetailScreen`, phase 2): clock on, clock off, an optional note on the record, who else is on the shift and what the server counted, and a way straight into the shift's handover. It closes the §9.1 loop end to end on the device: the Schedule tab says which shift is open (`GET /mobile/my-shifts` now carries this carer's own `clocked_on_at`, `clocked_off_at` and `on_duty`, counted the same way the attendance endpoint counts them), the screen records the press, and a press that cannot reach the server is kept with its own `action_key` and replayed as the same action rather than a second one. Worked time is the server's counted figure, not a stopwatch: an open interval is shown as open.

### 9.2 Shift handover — P0, **closed 16 October 2026 at the API**
The defining handover artefact of supported living, and the only "handover" the API had was the AI's `prepare_handover` summary draft — a document Mica writes, not a per-shift artefact a named worker acknowledges.

**Built:** `POST /shifts/:id/handover` (record or amend), `GET /shifts/:id/handover` (the handover, its amendment history and its acknowledgements), `POST /shifts/:id/handover/acknowledge`, and the offline contract at `POST /shifts/:id/offline/handover` (migration 152).

- **One current handover per shift, amended by keeping every version.** The wording a colleague already read survives the amendment that followed it, which is what makes it a record rather than a note.
- **Acknowledgement is by named staff and never the author's own.** A handover acknowledged by the person who wrote it evidences nothing, so that is a 400 rather than a recorded row; a second acknowledgement from the same person is the same acknowledgement (one row, replayed).
- **A manager may write one** when the shift had nobody to write it, and the record names the manager — never the worker they wrote it for.

`shift.handover_recorded` and `shift.handover_acknowledged` are published to the event outbox; the acknowledgement notifies the **outgoing** worker (§10), because they are off shift by the time their handover is read and nothing else tells them it landed. `shift.handover_due` covers the other direction — the handover that was never written (§9.9).

**The phone now writes and reads one (17 Oct 2026).** `HandoverScreen` records or amends the handover, shows the amendment history rather than only the current wording, and acknowledges a colleague's — with the author shown the readers instead of a button the API would refuse. Two things make it usable where a handover actually happens:

- **It has a way in.** `GET /mobile/my-shifts` returns the carer's own shifts for the week either side with each handover's state, because `/my-roster` only looks forward and the shift that owes a handover has just *ended*. The Schedule tab lists the selected day's shifts with `Handover due`, `Awaiting read`, or `Read by you · v2`, and the `shift.handover_due` notification resolves straight to that shift's handover.
- **A handover that cannot reach the server is not lost.** End of shift is when signal is worst; the draft is kept on the device and offered back, and it is sent when the carer says so rather than silently in the background — the wording is theirs and they should see it land.

Nothing changed at the API for this: the endpoints, the version history and the acknowledgement rules were already closed on 16 October 2026.

### 9.3 Support workers cannot complete tasks — P0, **closed 16 October 2026**
`PATCH /tasks/:id` is no longer role-gated (`apps/api/src/modules/tasks/tasks.routes.ts:19`); `tasks.controller.ts:94,106,109` narrows a `CARE_WORKER` to `COMPLETER_FIELDS = ['status', 'notes']` and refuses every other field with `403 'You can only change a task status or add a note'`. That is the shape this section asked for: the duty, without the ownership — `POST /` and `DELETE /:id` remain ORG_ADMIN/MANAGER. What is left is the mobile screen (§7 `TaskScreen`), not the API.

### 9.4 Support workers cannot record room checks — P0, **closed 16 October 2026**
`POST /room-checks` and `PATCH /room-checks/:id` are open to any authenticated user (`room-checks.routes.ts:18-19`); only `DELETE /:id` is ORG_ADMIN. Reopening the write did not open the safety record: `room-checks.controller.ts:29` attributes the check to the signed-in user (the `checked_by` column is resolved from `staffProfileId(user.userId)` and a supplied one is never read), and `:39-44` limits amendment to its author with `403 'You can only change a room check you recorded'`. The screen (§7 `RoomCheckScreen`) is still to build.

### 9.5 Support workers cannot report incidents — P0, **closed 16 October 2026**
Every route in `incidents.routes.ts` used to be `requireRole(ORG_ADMIN, MANAGER)`, including `POST /` and `GET /categories`. Both are ungated now (`incidents.routes.ts:22,39`), and the read scope is the narrow one this section asked for: `incidents.controller.ts:42,49-50` limits a `CARE_WORKER` to incidents where `reported_by` is their own user id (`403 'You can only view incidents you reported'`), enforced through `visibleIncident` on every sub-resource read, and `REPORTER_FIELDS` (`:160`) reduces their submission to the reporting fields so triage and investigation stay a manager's job. A support worker who witnesses a fall, a medication error or a safeguarding concern can now file it from the field — and still cannot see the organisation's incident history.

This was a safeguarding control rather than a feature, and the CQC and local authority expectation that any staff member can raise a concern is now met at the API. The remaining work is the screen (§12 phase 3).

### 9.6 Self-service account management — P1, **half closed 16 October 2026**
The store-compliance half is done and it is the half that mattered: `POST /staff/self-deactivate` (`staff.routes.ts:31`, ungated) is reachable from the mobile app's Settings (`apps/mobile/src/screens/SettingsScreen.tsx:352-381`, behind a destructive confirm whose copy states that care records are retained and personal data erased) and from the web settings, and the deletion erases personal data server-side in `staff.controller.ts` with six integration tests behind it. The other half is still open: `POST /staff/:staffId/emergency-contacts` remains `requireRole(ORG_ADMIN)` (`staff.routes.ts:43`), so a support worker cannot maintain their own emergency contact.

### 9.7 Policy acknowledgement — P1
The web app has a policy library; there is no way for a support worker to read or acknowledge a policy on mobile, and no record of who has read what. Needed for inspection evidence.

### 9.8 Compliance officer mobile treatment — P1
The app has no third role model. See §2.

### 9.9 Notification targeting — P1, **closed at the API on 17 October 2026**
The notification service is shared and works, but supported living needs event types the domiciliary app never produces: unfilled shift, handover due, missed medication round, incident raised, DBS or training expiring, room check overdue.

**Built, 16 October 2026 — the list above is now almost entirely covered at the API:**

| Event type | Producer |
|---|---|
| Unfilled shift | `shift.unfilled` (`scheduling.events.ts`) |
| Handover due at shift end | `shift.handover_due` — **added 16 October 2026** |
| Missed medication round | `medication.administration_missed` |
| Incident raised | `incident.created` (plus `incident.action_overdue`) |
| DBS or training expiring | `dbs.expiring`, `training.expiring` |
| Room check overdue | `room_check.overdue` — **added 17 October 2026** |

**The handover-due event, and the five decisions in it.** §9.2's handover is the transfer of responsibility for the people in the setting, so a shift that ends without one is the moment that transfer silently did not happen. Nothing noticed it; only a manager who happened to open the rota could see it. The sweep is `modules/scheduling/shiftHandoverDue.ts`, run every fifteen minutes from `index.ts`, the marker is `shifts.handover_due_notified_at` (migration 154) and the notification goes to the staff on the shift with a link to the shift on its rota week:

- **A grace period after the rota's end time (30 minutes).** The rota's end time is not the moment a worker stops working — they finish up, lock up, and then write the sentence. A second nudge in the doorway is what teaches people to ignore the first.
- **A bounded lookback (24 hours).** Otherwise the first run after a deploy raises a nudge for every historical shift with no handover: thousands of notifications about work nobody can still do.
- **The roster is the audience, so there has to be one.** The join on `shift_assignments` is the audience test rather than an optimisation — a shift that ended with nobody rostered has nobody to hand over to and nobody to tell, and an unstaffed shift is already `shift.unfilled`'s business.
- **Once per shift, and marked after the event, never before.** A crash between the two nudges twice rather than losing the nudge, which is the direction to fail in.
- **The manager-facing copy is Mission Control's.** The worker is told because the handover is theirs to write; the manager's workspace keeps the gap, because a shift whose responsibility was never transferred is a compliance gap as well as an unfinished note. **Added 17 October 2026:** that copy is now a list and not only an alert — Mission Control's Compliance tab shows the shifts that ended with no handover over the last seven days, with who was rostered and whether they were nudged, read from the shifts themselves so a dismissed alert or the sweep's 24-hour lookback cannot erase the gap.

**The room-check-overdue event, and why it was a detection problem first.** Nothing computed it because there was nothing to compute: a room check is a row that exists, and the state being reported is the *absence* of one. There is no schedule row to be "due", so the sweep derives the expectation from the residents' own records — every room an active person sleeps in, in a supported-living service — and reports the rooms with no `room_checks` row for the provider's today. `modules/room-checks/roomCheckOverdue.ts` runs every thirty minutes from `index.ts`, the ledger is `room_check_nudges` (migration 155) and the notifications go to the staff rostered at that location, with Mission Control holding the manager's copy:

- **A due hour (18:00 local), not midnight.** A sweep in the morning would report every room as overdue for a day that has not finished, which is how an alert trains people to ignore it. The hour is judged in the provider's own timezone, so a sweep at 23:00 UTC does not start on a provider whose afternoon is still running.
- **The expectation is derived, not configured.** The rooms to check are the rooms people live in (`people.room_number` at an active person's location). A second list of rooms maintained by a manager would be a list that disagrees with the residents' own records, and a room with nobody in it cannot be overdue.
- **Only supported living.** `organizations.service_types` is the product's own answer to "does this service have rooms"; a domiciliary provider has none to check.
- **Once per room per day, recorded after the event.** The state is an absence, so there is nothing to stamp — the ledger row says what has been said. A crash between the two nudges twice rather than losing the nudge, which is the direction to fail in.
- **An empty roster still raises it.** The support workers on shift at the location are the people who can record the check; with nobody rostered there is no audience, and the Mission Control alert is then the whole of the signal — which is honest, because a room nobody was rostered around is a staffing gap as well as a missing check.

**The phone receives them.** The mobile notifications screen renders each event family with its own icon and, on tap, opens the record the server linked to: the week view for a shift and its handover, the room-check board for a room nobody checked (added 17 October 2026 — see below), the chat tab for a message, and — where the phone has no screen for the record, as with the MAR chart and compliance — the notification's own message, rather than a tap that does nothing. A notification that *launched* the app is honoured on cold start (`getLaunchNotification`), including one whose record the phone cannot open, which lands on the notifications screen. The link decision is a pure module (`src/utils/notificationLinks.ts`), so it is asserted without rendering the app.

**Room checks are now clearable from the phone (17 October 2026).** `GET /mobile/room-checks/today` returns the rooms that should have a check today — derived from the residents' own room numbers with the same normalised key and the same 18:00 due hour the sweep uses — with the day's check attached where somebody recorded one, and the `RoomChecksScreen` records the check through the existing `POST /room-checks`. A worker who is told "12 at Ash Grove has no room check recorded today" can answer it in the corridor instead of remembering it for a computer. The board is scoped to the locations they are rostered at (the whole provider when they are not) and keeps the rooms already checked visible, so a shift can see what it has done as well as what it owes.

**The inbox pages (17 October 2026).** `GET /notifications` was a fixed twenty rows, which decided that a carer's thirty-first notification did not exist — the Monday handover nudge fell off a week's absence. It is now keyset-paginated on `(created_at, id)` and the screen asks for the next page as the reader reaches the bottom, keeping what it has already fetched through the 30-second poll.

**Remaining work in this section: nothing at the API.** The screens that record the underlying work are §7's (`RoomCheckScreen`, `HandoverScreen`, `ShiftDetailScreen`) and are tracked there.

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

Every notification must deep-link to the thing it is about, and a notification that launched the app must be honoured on cold start. The shipped app now does this for the events it knows about; the same contract applies here. Five rows of this table are live in the API today — "Handover due at shift end", "Room check overdue" (both added 16–17 October 2026), "Unfilled shift within 48h", "Medication round not started" and "DBS or training expiring" — each carrying the record path of the thing it is about (§9.9), and the phone resolves that path on tap and on cold start.

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

**Phase 2 — the field write path.** Shift clock-on/off (9.1), daily notes, body map, medication round, observations, meals, task completion (9.3), room checks (9.4). This is the phase that makes it a working tool rather than a browser. None of these need backend work now: the API was reopened for task completion and room checks on 16 October 2026, and clock-on/off landed the same day. Clock-on/off's screen landed on 18 October 2026 and room checks' on 17 October 2026; what is left is the screens for daily notes, body map, the medication round, observations, meals and task completion.

**Phase 3 — safeguarding.** Incident reporting (9.5), handover (9.2), notifications (9.9), read-scoping (9.10). These are the regulatory items and should not be allowed to slip behind convenience work. Incident reporting is API-ready as of 16 October 2026 and needs its screen; **handover now has one** (the phone writes, amends and acknowledges it, 17 October 2026) — handover's backend gap closed with §9.1/§9.2, and 9.9's handover-due event landed the same day — so the phase is now screen work for incidents and notifications, plus the one P1 left in it (9.10, and 9.7/9.8 above).

**Phase 4 — manager.** Dashboard, rota builder, claims, staff compliance, incident management, insights, compliance home.

**Phase 5 — polish.** Policy acknowledgement, the staff member's own emergency contacts (§9.6), remote wipe, app switcher protection, store assets and listing copy.

The ordering is deliberate. Phases 1 and 2 are the value; phase 3 is the obligation; phase 4 is the upsell. The safeguard against doing phase 4 first is weaker than it was — the API accepts a concern from any authenticated user since 16 October 2026 — but a support worker still has no screen for it, so the phase 3 obligation stands.

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
3. Does handover need to be a formal CQC-recorded artefact, or an operational note? The answer changes §9.2 substantially. **Partly answered by the shipped shape (16 Oct 2026):** it is now a record — versioned, attributed and acknowledged by name — rather than a note, and it is linked from the shift it belongs to. Whether it also needs to be exportable as inspection evidence in its own right is still open.
4. Should the app show live location to managers in supported living, as the domiciliary live map does? It is a materially different privacy decision in a setting where staff are already on site.
5. Is per-device remote wipe required by any prospect's security questionnaire, or only by policy?
