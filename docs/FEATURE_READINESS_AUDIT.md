# Feature and blueprint readiness audit — Meticle Care

**Date:** 16 October 2026 · **Commit audited:** `43ed66de` (master, CI green) · **Scope:** every feature in
the product, measured against the two blueprints and against what the product tells customers.

**Method:** each row below was checked against the repository on the date above — a route file, a
controller branch, a schema, a screen, or a test — and the file:line is quoted so it can be re-checked
rather than believed. Where a number came from running a command, the command's own exit status is
recorded. Where something could not be verified from inside the repository, §7 says so.

**Companion documents:** `MARKET_READINESS_AUDIT.md` (13 Oct, the store/go-to-market pass — its P0s are
re-verified in §4.1 and two of them are unchanged), `GO_LIVE_READINESS.md` (the tracked commercial and
legal list), `PUBLIC_SITE_CAPABILITY_MATRIX.md` (what the public site may claim), `CLAIM_REGISTER.md`.

---

## 1. Verdict

**The engineering is not what is blocking the market. Three things are, and one of them is a
safeguarding defect that a paying customer can reach today.**

1. **A DBS check can be recorded as clear when no check was performed.** The production route is
   mounted, the web UI has a Submit and a Poll button, and the provider behind both is a mock that
   always answers `CLEAR` with a fabricated certificate number — which the system then files as an
   approved DBS document with a three-year expiry. §2. This is the only finding here that is a reason
   not to sell, rather than a reason to hurry.
   **Closed later the same day** by phase 0 of `docs/DBS_INTEGRATION_PLAN.md`, which is now complete:
   submission and polling refuse with 503 and nothing is synthesised, the permitted certificate metadata is
   the only thing the record holds and it is deleted six months after the recruitment decision, and the
   compliance screen states that MeticleCare does not submit checks yet. §2 states what remains — a real
   partner, and one production query nobody has run.
2. **All five P0 gaps in the supported-living blueprint are now closed at the API.** Shift clock-on/off
   and shift handover — the last two — were built on 16 October 2026 with the visit check-in idempotency
   contract, so the section has no P0 left in it. What each of the five is still waiting on is its mobile
   screen, not its endpoint — **and handover's screen shipped on 17 October 2026** (`HandoverScreen`:
   record, amend with the version history kept, acknowledge as a named reader, a draft kept on the phone
   when the send fails, reached from the handover-due notification and the Schedule tab's handover list),
   so that one is now closed end to end rather than at the API. §3.2. **Later the same day, §9.9's handover-due event landed too** — a sweep
   now raises `shift.handover_due` when a shift ends with no handover recorded, and **on 17 October 2026
   room check overdue closed too** — the last of §9.9's six event types, detected from the residents'
   occupied rooms and delivered to the staff rostered at that location — so §9.9 has no open item and the
   phone receives all six on tap and on cold start.
3. **The store artefacts and the legal/commercial papers are still not ready**, exactly as the 13 October
   audit found: the seven Android screenshots are still one frame, the Data safety form still cannot be
   generated (its template is still absent), and the DPA, solicitor review, PI insurance, org-wide DPIA
   and the AI Article 28 agreement are all still open. §4.

### Scorecard

| Area | State | Basis |
| --- | --- | --- |
| API | ✅ Ready | CI green 16 Oct: typecheck + **1,631 tests / 168 files** |
| Web app | ✅ Ready | CI green: typecheck + lint + **511 tests / 67 files** |
| Mobile app (build) | 🟡 Domiciliary only | 322 tests / 40 suites green, but no service-type branch — §3.3 |
| Design system | ✅ Ready | `design:check` / `design:lint` / `design:test` green; 16 screenshot comparisons green |
| Feature breadth vs blueprint | 🟡 No P0 gaps; screen work remains | 49 of 51 API modules expose routes; §3.2's five P0s are all closed at the API as of 16 Oct 2026, and what is left of them is the mobile screens |
| DBS integration | 🟡 **Phase 0 complete; no partner yet** | A mock no longer files a cleared check (submit/poll refuse 503, no document is minted), only the permitted metadata is stored and the six-month purge deletes it on a nightly sweep, and the screen says submission is closed — §2. There is still no automated checking at all: a real partner adapter is phase 2. |
| Store submission (Play) | ⛔ Blocked | screenshots still identical (`store:verify-screenshots` exit **1**); Data safety template absent |
| iOS | ⬜ Not started | no build, no capture, no App Privacy label |
| Billing / revenue | 🟡 Partial | subscription and per-org quote flow real; add-ons recorded but **not purchasable** — §4.2 |
| Commercial / legal | ⛔ Blocked | DPA, solicitor review, PI insurance, DPIA, AI Art 28 — all tracker-open, all non-engineering |
| Operations (backup, monitoring) | 🟡 Unproven | backups real, **restore never run**; Kuma monitors invisible from the repo (T0-2, T0-4) |

---

## 2. The one thing to fix before selling anything: a cleared DBS that never happened

This is reachable in production today, by an ORG_ADMIN, through the product's own UI.

**Status, later on 16 October 2026 — the fabrication is closed.** Phase 0 of `docs/DBS_INTEGRATION_PLAN.md`
landed: `dbs.service.ts` ships no mock, `provider` defaults to `null` and is chosen only by
`resolveDbsProvider()` reading `DBS_PROVIDER` at boot, `submitDbsCheck` and `pollDbsStatus` refuse with
**503** before any staff data is decrypted or any provider is called, and a `clear` result no longer inserts
a `documents` row. `dbs.integration.test.ts` now asserts the refusals (and that the check stays `draft`),
and `dbs.providerGuard.test.ts` fails if a mock, a non-null default, a production `setDbsProvider` call or an
`INSERT INTO documents` returns — five of its assertions fail against the pre-change source. **Closed out the
same day:** the compliance screen states that MeticleCare does not submit DBS checks yet, in the API's own
words, with Submit and Poll **disabled** and the reason on the control (plan item 6); migration 153 stores the
permitted certificate metadata and nothing else — reference, issue date, recruitment decision and its date, a
renewal marker and a note — with a `purge_after` six months from the recruitment decision, deleted by a
nightly sweep that keeps the check itself and stamps the deletion (item 5); a deadline is never extended, so
a write past its date is refused with the dates named; and `dbs.certificateRetention.guard.test.ts` fails if
the route's field list grows a place to put a copy or an image of a certificate. The one thing still open on
this finding is not code: **whether a production organisation has already polled a `MOCK-%` check** is still
an unanswered query, and it is on the follow-up list below.
Steps 1–3 below describe the mechanism as it was, before this landed.

**The mechanism, in four steps.**

1. **The route is mounted and gated only by role.** `apps/api/src/index.ts:265` — `app.use('/dbs', dbsRoutes)`.
   Every route in `dbs.routes.ts` is `requireRole(ORG_ADMIN, MANAGER)`; `POST /checks` and
   `POST /checks/:id/submit` are ORG_ADMIN only. Nothing else stands in front of it.
2. **The provider is a mock, and nothing ever replaces it.** `apps/api/src/modules/dbs/dbs.service.ts:59`
   — `let provider: DbsProvider = new MockDbsProvider();`. A `setDbsProvider()` hook exists
   (`dbs.service.ts:61`), and **nothing in the codebase calls it**: `grep -rn "setDbsProvider" apps/api/src`
   returns the definition and nothing else. There is no real provider implementation in the file, and no
   environment variable that selects one.
3. **The mock's status answer is `CLEAR`, with an invented certificate.**
   `dbs.service.ts:54-56`:
   ```ts
   async getStatus(providerReference: string) {
     return { status: DbsStatus.CLEAR, certificate_number: `CERT-${providerReference.slice(-8)}`,
              disclosure_date: new Date().toISOString() };
   }
   ```
4. **Polling writes that answer into the compliance record.** `pollDbsStatus` → `updateDbsStatus`
   (`dbs.service.ts:176-193`): status `CLEAR` stamps `completed_at = NOW()` and stores the fabricated
   `certificate_number`, and the same call **auto-inserts a `documents` row of type `DBS` with
   `status = 'approved'` and a three-year expiry** — the row the compliance dashboard, the identity
   monitor and the evidence pack all read as evidence.

**The UI exposes every step.** `apps/web/src/pages/compliance/CompliancePage.tsx` — `GET /dbs/checks`
(746), `GET /dbs/checks/stats` (751), `POST /dbs/checks` (766), `POST /dbs/checks/{id}/submit` (772),
`POST /dbs/checks/{id}/poll` (778). So: create a check, submit it, press poll, and a person is recorded
as holding a clear criminal-records disclosure that nobody requested.

**Why the existing guardrails did not catch it.** `dbs.integration.test.ts` drives exactly this flow and
**asserts the mock's behaviour as the expected behaviour** ("checks CRUD via mock provider") — so the
suite is green, CI is green, and the defect is asserted rather than caught. A mock in a test is right; a
mock as the module-level default of a mounted production route is the opposite of that.

**What "fixed" looks like, in order of preference.**

1. **Fail closed.** Refuse `submit` and `poll` (409/503 with a message naming the missing integration)
   unless a provider is configured by environment. One guard, at the single choke point both already
   pass through.
2. **Remove the route and the UI until Phase 2's DBS API integration lands.** The real DBS capability the
   product *does* have — expiry tracking and reminders over uploaded certificates — is unaffected and is
   what the marketing copy actually claims ("right to work and DBS reminders", `PUBLIC_SITE_CAPABILITY_MATRIX.md`).
3. **Whichever is chosen, the test must assert the refusal**, so the mock cannot come back as a default.

**Also unverified from the repo, and worth confirming while this is open:** whether any production
organisation has already polled a check. `dbs_checks` carries `provider_reference LIKE 'MOCK-%'` and
`documents` carries auto-created `DBS` rows with empty `url`, so the answer is a query, not an
investigation.

---

## 3. Feature audit against the blueprints

There are two blueprints and they answer different questions. `METICLE_BLUEPRINT.md` (v2.1, 6 Oct) is the
platform vision, explicitly running on a **July 2026 historical baseline** for its inventories.
`MOBILE_SUPPORTED_LIVING_BLUEPRINT.md` (v1.0) is a delivery spec, written as "specification only, no code
has been written against this document" — and its §9 is a list of things the backend *cannot* do yet.

### 3.1 Platform blueprint (`METICLE_BLUEPRINT.md`)

| Blueprint section | What it promises | State today, checked | Note |
| --- | --- | --- | --- |
| §2 product baseline | 41 modules, 78 pages, 108 tables | **Historical, and now wrong**: 51 module dirs, 103 `*Page.tsx`, 97 migration files + `schema.sql` | Fine as a snapshot; it says so in the heading. Do not quote these counts externally. |
| §5 AI capabilities | Config, compliance gap analysis, incident triage, rota analysis, AI daily notes | ✅ All five exist; the AI module is 15,543 LOC across **29 test files** | The most heavily tested module in the repo. |
| §7.2 AI levels 1–3 | Assistance, generation/agentic support, event-driven signals | ✅ Level 1 is what ships; signals exist via the event engine and Mission Control | Levels 4–5 are marked future in the blueprint and are still future. |
| §8 event engine | Outbox, domain events, consumers | ✅ `events` module (1,416 LOC), consumers registered, worker running; `dbs.expiring` is a real consumer | |
| §9.2 nine named agents | Compliance Officer, Operations Manager, Documentation, Resident Intelligence, Medication Safety, Incident/Safeguarding, Inspection Readiness, Policy/Knowledge, Family Communication | 🟡 **Design, not shipped as agents.** What exists is 13 capability endpoints with prompts, plus a `mica` assistant with an action gateway | The blueprint's own §5 calls its baseline historical; §9.2 reads as an architecture, but a reader who skims it will believe nine agents exist. Worth one sentence in the blueprint saying so. |
| §11 tool/action framework | Read interfaces, write tools | 🟡 Read tools and a small set of validated writes exist (`ai.actions.ts`, `createTask`, `createAppointment`, `createCareNote`, prepare handover, summarise changes) | §11 already labels the write tools "Not Implemented"; that is now partly out of date in the product's favour. |
| §12 Mission Control | Daily briefing, operational health, quality/compliance, attention, recommended actions, explainability | ✅ Built (`mission-control` module + workspace, 811 LOC, tested, SL-gated) | |

### 3.2 Mobile supported-living blueprint — §9 gap status, re-checked line by line

The blueprint's §9 list is the most useful thing in either document, because every item is a capability a
support worker needs and the API refused. **All five P0s are now closed at the API** — three by reopening the role gate, and §9.1/§9.2 by building
them on 16 October 2026 — so the remaining items in this list are P1s, and the P0s' own remaining work is
their screens.

| § | Gap as written | Status **today** | Evidence |
| --- | --- | --- | --- |
| 9.3 | Support workers cannot complete tasks (`PATCH /tasks/:id` was `requireRole(ORG_ADMIN, MANAGER)`) | ✅ **Closed** | `tasks.routes.ts:19` — PATCH is no longer role-gated; `tasks.controller.ts:94,109` narrows a non-manager to `COMPLETER_FIELDS = ['status','notes']` and refuses anything else with `403 'You can only change a task status or add a note'`. That is the right shape: the duty, without the ownership. |
| 9.4 | Support workers cannot record room checks (was manager-only) | ✅ **Closed** | `room-checks.routes.ts:18-19` — `POST /` and `PATCH /:id` are open to any authenticated user; only `DELETE` is ORG_ADMIN. |
| 9.5 | Support workers cannot report incidents — "the most serious gap in the whole blueprint", incl. `GET /categories` | ✅ **Closed**, with reporter-scoped visibility | `incidents.routes.ts:22,39` — categories and `POST /` are ungated; `incidents.controller.ts:36-47` `requireVisibleIncident` limits a `CARE_WORKER` to incidents where `reported_by === their user id`, with the reason written in the comment. |
| 9.1 | Shift clock-on/off does not exist — no attendance evidence | ✅ **Closed 16 Oct 2026** | `POST /shifts/:id/clock-on`, `/clock-off`, `GET /:id/attendance` and the offline contract at `POST /:id/offline/clock-on|clock-off` (`scheduling.routes.ts`); migration 152 adds `shifts.actual_start_at/actual_end_at/clocked_on_by/clocked_off_by` plus the append-only `shift_attendance_events`. Attendance is claimed by count, not arrival order, and the shift row is locked during a clock action, so a replayed offline action is one clock-on. Only the worker rostered on the shift may record it. |
| 9.2 | Shift handover does not exist | ✅ **Closed 16 Oct 2026 at the API; closed on the phone 17 Oct 2026** | `POST/GET /shifts/:id/handover`, `POST /:id/handover/acknowledge`, and `POST /:id/offline/handover`. One current handover per shift, amended by keeping every version (`shift_handover_revisions`), acknowledgement by named staff and never the author's own, and a manager may write one attributed to the manager. `shift.handover_acknowledged` notifies the outgoing worker. **17 Oct 2026:** `HandoverScreen` writes, amends and acknowledges one on the phone; `GET /mobile/my-shifts` gives the Schedule tab each shift's handover state (`handover_due`, awaiting read, read by you) because `/my-roster` only looks forward and the shift that owes a handover has just ended; a `shift.handover_due` link with a shift id now resolves to that shift's handover rather than the week view; a handover the phone could not send is kept as a draft and offered back. |
| 9.6 | Self-service account management, incl. Play-required deletion | ✅ Closed on web and mobile | Deletion exists in both; the 13 Oct store pass verified it (6 integration tests). |
| 9.7 | Policy acknowledgement | ⬜ Open | Still no read/acknowledge path with a record of who read what. Inspection evidence gap, not a bug. |
| 9.8 | Compliance officer treated as a carer on mobile | ⬜ Open | `App.tsx:183` — `isManager = role === 'ORG_ADMIN' \|\| role === 'MANAGER'`, so a `COMPLIANCE_OFFICER` gets the carer tab set. |
| 9.9 | Notification targeting for SL events | ✅ **Closed 17 October 2026 — all six event types** | `shift.handover_due`: `modules/scheduling/shiftHandoverDue.ts` runs every fifteen minutes (wired in `index.ts`), raises the event for a shift whose rota end time passed more than thirty minutes ago with staff on it and no handover recorded, and stamps `shifts.handover_due_notified_at` (migration 154) so it nudges once per shift. `room_check.overdue` (**added 17 Oct 2026**): `modules/room-checks/roomCheckOverdue.ts` runs every thirty minutes, derives the expectation from the residents' own rooms (an active person's `room_number`, in a supported-living service), and raises the event for a room with no check recorded by 18:00 in the provider's own timezone — the state being reported is the *absence* of a row, so the ledger is `room_check_nudges` (migration 155) and one room produces one nudge a day, with an empty roster still raising it for Mission Control's manager copy. Both notifications open the record they are about, and the mobile notifications screen resolves that link on tap and on cold start (a record the phone has no screen for lands on the notifications screen rather than doing nothing). **Re-checked 17 Oct 2026:** the manager-facing copy was landing in `mission_control_alerts` but under no category, so `/mission-control/alerts?category=compliance` hid a missing room check and the row's chip read `room_check.overdue`. It is now filed and counted with compliance (`mission-control.repository.ts`), labelled "Room Checks" (`alertLabels.ts`), and both are covered by tests — the summary's `care` list was also brought back into line with the filter it is supposed to mirror. **Also 17 Oct 2026:** the handover-due gap is no longer only an alert — `GET /mission-control/handover-gaps` (supported living) lists the shifts that ended with no handover in a 1–30 day window, using the sweep's own 30-minute grace so the two cannot disagree, with the rostered staff and whether they were nudged, and Mission Control's Compliance tab shows it with a row click through to the shift on the rota. It reads the shifts rather than the alerts, because an alert can be dismissed and the sweep stops looking after 24 hours. **Also 17 Oct 2026:** a room nobody checked is now clearable from the phone — `GET /mobile/room-checks/today` returns today's rooms with the day's check attached (same rooms, same normalised room key and same due hour as the sweep) and the `RoomChecksScreen` records the check — so the nudge is a task the carer can finish where they are standing rather than a reminder to do it later; the mobile inbox is keyset-paginated for the same reason (a fixed twenty rows made the oldest notification of a week away unreachable). |
| 9.10 | Read-scoping for residents | ⬜ Open | `GET /people` is org-wide for signed-in staff. The blueprint calls this a data-protection item, not a nicety. |

**Phase 1 of the blueprint's §12 delivery sequence ("make the app usable at all") is not done**, and the
consequence is visible in one place: the mobile shell branches on **role only** —
`apps/mobile/App.tsx:184`, `const tabs = isManager ? managerTabs : carerTabs` — while every home-screen
call it makes goes to `/homecare/*`, which `apps/api/src/index.ts:321` mounts behind
`requireDomiciliaryOnly`. The only service-type awareness in the whole app is
`apps/mobile/src/utils/serviceType.ts`, a single helper used to gate open calls and two screen details.
So a supported-living provider that buys today installs an app whose tabs are domiciliary tabs and whose
requests the API refuses. `serviceType.test.ts` proves the helper is correct; nothing proves the app uses
it to choose a shell.

### 3.3 Feature inventory — all 51 modules, with the honest status

`49` of the 51 module directories expose an HTTP router (`rbac` and `reviews` are services only). LOC is
source lines in the module, tests are files; both are measures of where attention went, not of quality.
Status is my judgement from reading the route file, the controller and the tests.

| Module | Routes | Test files | LOC | Status | Notable finding |
| --- | --- | ---: | ---: | --- | --- |
| homecare | 1 | 19 | 10,795 | ✅ Mature | The domiciliary product. Carries the location/privacy controls (T0-6 series). |
| ai | 1 | 29 | 15,543 | ✅ Mature | 13 capabilities, redaction, per-org config, audit. Heaviest test coverage in the repo. |
| emedication | 1 | 5 | 5,853 | ✅ Mature | Framework-aware since migration 135 (witness rule, controlled drugs). |
| compliance | 1 | 7 | 5,128 | ✅ Ready | Evidence packs per regulator; see the claim register for the Class 2 caveats. |
| scheduling | 1 | 3 | 2,773 | ✅ Ready | Rota, min-staff, 11-hour rest, and (since 16 Oct 2026) shift attendance and handover with the offline action contract — the §3.2 9.1/9.2 gaps are closed at the API, and the same day's handover-due sweep closed §9.9's missing event type. |
| reporting | 1 | 1 | 2,682 | ✅ Ready | 9 report categories (verified: distinct `category` values in `reporting.types.ts`), charts (`ReportBuilder.tsx` imports the shared chart components), CSV export (`reporting.csv.ts`, `format=csv` default in the controller). **Its in-app help still calls it a Phase 1 stub** — §3.5. |
| billing | 1 | 8 | 2,654 | 🟡 Partial | Subscription + per-org quote flow real. Add-ons stored, never sold — §4.2. |
| cqc | 1 | 3 | 2,440 | ✅ Ready | 5-domain readiness, 4 regulator frameworks, gap analysis. |
| people | 1 | 2 | 2,161 | ✅ Ready | 32 routes incl. care plans, goals, risk. |
| leave | 1 | 1 | 1,932 | ✅ Ready | 15 routes, delegation-aware approver chain. |
| incidents | 1 | 2 | 1,736 | ✅ Ready | Now includes reporter-scoped care-worker access (§3.2 9.5). |
| settings | 1 | 2 | 1,721 | ✅ Ready | 33 routes; timezone (149), location controls, delegations. |
| events | 1 | 2 | 1,416 | ✅ Ready | Outbox + consumers + worker. |
| nutrition | 2 | 1 | 1,398 | ✅ Ready | Meal plans, shopping list, PDF. |
| staff | 1 | 2 | 1,321 | ✅ Ready | Profiles, role/status, vetting scheme awareness. |
| chat | 1 | 1 | 1,310 | ✅ Ready | Real-time, files, deep links. |
| expenses | 1 | 1 | 1,093 | ✅ Ready | Petty cash + reconciliation. |
| dashboard | 1 | 2 | 1,182 | ✅ Ready | 7 KPIs, widgets, service-mode branch. |
| platform-admin | 1 | 2 | 982 | ✅ Ready | Org/user admin, email queue, leads. |
| mission-control | 1 | 1 | 811 | ✅ Ready | SL-gated workspace with explainability. |
| family-portal | 2 | 1 | 801 | ✅ Ready | Token-based member access. **No finances tab exists** — see the drift list. |
| orgs | 1 | 1 | 677 | ✅ Ready | Org CRUD, locations, departments, teams. |
| surveys | 1 | 1 | 655 | ✅ Ready | Satisfaction + engagement, public token forms. |
| training | 1 | 1 | 634 | ✅ Ready | Matrix, expiring, bulk/auto-assign. |
| health | 1 | 1 | 599 | ✅ Ready | Observations, bowel, dental, fluid, sleep. |
| agencies | 1 | 1 | 572 | ✅ Ready | Agencies, workers, rates, savings analytics. |
| compliance-portal | 1 | **0** | 503 | 🟡 **Untested** | External portal; 503 LOC and **no test file**. |
| shift-audit | 1 | 1 | 488 | ✅ Ready | Daily audit + email. |
| dbs | 1 | 1 | 471 | ⛔ **Broken** | A mock files a cleared check — §2. |
| goals | 1 | 1 | 468 | ✅ Ready | Per-person stats, CQC-mapped. |
| organization | 1 | 1 | 405 | ✅ Ready | Invitations lifecycle. |
| policies | 1 | 1 | 351 | ✅ Ready | CRUD + 12 seeded CQC policies. |
| insights | 1 | 1 | 340 | ✅ Ready | 5 sections, Recharts. |
| supervisions | 1 | 1 | 328 | ✅ Ready | 1-2-1 records + actions — **this was listed as Phase 2 "still to build" and is built**; AGENTS is stale. |
| competency | 1 | 1 | 310 | ✅ Ready | Templates, assessments, pending. |
| mobile | 1 | 1 | 291 | ✅ Ready | GPS check-in, roster, voice notes. |
| permissions | 1 | 2 | 290 | ✅ Ready | Module/role matrix. |
| appointments | 1 | 1 | 281 | ✅ Ready | CRUD + today stats. |
| mfa | 1 | 1 | 270 | ✅ Ready | TOTP setup/verify/disable. |
| dspt | 1 | 1 | 238 | ✅ Ready | 10 standards + submit. |
| body-map | 1 | **0** | 231 | 🟡 **Untested** | Pressure-area/wound evidence with **no test file** — clinical records, so the gap matters more here than the LOC suggests. |
| room-checks | 1 | 1 | 193 | ✅ Ready | Worker-create reopened (§3.2 9.4). |
| marketplace | 1 | 1 | 166 | 🟡 Partial | API is sound (and validates the staff id). The web page on `/marketplace` cannot call it — §3.4. |
| tasks | 1 | 2 | 450 | ✅ Ready | Completer fields narrowed for non-managers. |
| audit | 1 | 3 | 365 | ✅ Ready | Wired across 40+ mutation points; durability bounded. |
| auth | 1 | 4 | 1,522 | ✅ Ready | JWT + refresh + MFA + reset, rate limits. |
| notifications | 2 | 1 | 530 | ✅ Ready | List, read, preferences, push. |
| delegations | 1 | 1 | 120 | ✅ Ready | Audit trail for approvals. |
| contact | 1 | 1 | 162 | ✅ Ready | Public enquiry form. |
| rbac | 0 | — | — | ✅ Service only | Service-type gates. |
| reviews | 0 | — | — | ✅ Service only | Review scheduling notifications. |

### 3.4 Defect: the `/marketplace` route is live and its only action cannot work

`apps/web/src/App.tsx:262` routes `/marketplace` to `pages/marketplace/MarketplacePage.tsx`. That page's
Apply button is:

```ts
// apps/web/src/pages/marketplace/MarketplacePage.tsx:18-19
// Mocking staffId for now
return api.post(`/marketplace/apply/${shiftId}`, { staffId: 'mock-id' })
```

and the API validates it: `applyShiftSchema` requires `staffId: z.string().uuid()`
(`apps/api/src/shared/validation/schemas.ts:492-493`). So **every click is a 400**, and the comment has
been sitting on the line since the page was written. The replacement surface
(`/shift-marketplace` → `ShiftMarketplacePage`) is correct and is the one in the navigation
(`components/Layout.tsx:175`).

**Fix (either is a small change):** delete the page and its route, or derive the staff id from the session
the way every other page does. Leaving a reachable page whose button cannot succeed is the kind of thing
one prospect clicks and then asks about.

### 3.5 Documentation drift found by this audit

None of these is a code defect; all of them mislead whoever reads them next, including a customer.

| Where | Says | Reality today |
| --- | --- | --- |
| `AGENTS.md` Phase 2 table | "**Staff 1-2-1s** — one-to-one meeting records, action tracking, review scheduling" is not built | Built: `supervisions` module (328 LOC + tests), `SupervisionsPage`, review scheduling in `reviews`. |
| `AGENTS.md` Phase 2 table | "**Family Portal Finances** — tab placeholder; invoices/payments not exposed to family members" | There is no finances tab and **no placeholder**: `grep -i "financ\|invoice\|payment" apps/web/src/pages/FamilyPortalPage.tsx` returns nothing, and the page's tabs are care content ("Care Notes", "Care Plans"). The capability is absent rather than stubbed, which needs a decision, not a fix. |
| `AGENTS.md` counts | "2,465 tests" (web "512") | CI today measured **2,464**: API 1,631 / web **511** / mobile 322. The one-test difference is the helper test `AGENTS.md` itself says was added after the whole-suite web run, so 511 in-suite plus 1 elsewhere is where the 512 comes from — the total is right, the suites that produce it are one off. |
| `apps/web/src/data/learn-content.ts:708,710,711` | "Six report card templates … **Download Sample CSV** … These are Phase 1 templates. Full live-data reporting is planned for **Phase 2** … Phase 2 will replace samples with live data and add PDF export" | Reporting is **live**: 9 categories, chart components in `ReportBuilder.tsx`, and a working CSV export (`reporting.controller.ts:73-75`). The only "Sample CSV" string in the app is this help text — no such control exists — so the help tells a paying customer their reporting module is a stub. |
| `apps/web/src/data/learn-content.ts:67,856` | "**Agency Saved** … Placeholder … (Phase 2 feature)" | No such KPI is rendered or computed: 0 matches for `agency_saved`/`savings` in `modules/dashboard` and none in the dashboard pages, while the `agencies` module does have real savings analytics. The help describes a KPI that no longer exists. |
| `MOBILE_SUPPORTED_LIVING_BLUEPRINT.md` §9.1–9.5 | P0 "blocked" / "does not exist" | **Corrected 16 Oct 2026, twice:** §9.3–9.5 first read closed (role gates reopened), and later the same day §9.1–9.2 were built and now read closed too — in their headings and bodies, the §5 status column (S4, S5, S14, S16–S18), the §7 incident screen note, the §12 phases and the §13 open question about handover. Its status paragraph at the top of the document carries the same correction. |
| `GO_LIVE_READINESS.md` T0-16 | ⛔ TLS "has never been checked" | The 13 Oct audit measured **TLS 1.3** at the edge. Still marked blocked. **Corrected 16 Oct 2026:** T0-16 now reads ✅ with the 13 Oct measurement, the housekeeping note about certificate renewal is closed against the same probe, and the `TLS 1.3` entry in `apps/web/src/__tests__/marketingClaims.ts` is `verified` with that evidence rather than `pending` — it was still pending, with evidence saying the edge "is terminated by our own nginx", when this table was first written. |
| `GO_LIVE_READINESS.md` T1-10(2) | the `accessToken` cookie "is set and read by nothing … dead weight rather than a half-finished migration" | Half right: the write was the only occurrence of the name, but the cookie read the row cited (`auth.controller.ts:687`) is in `logout`, and `/auth/refresh` could not read a cookie at all because its schema required the token in the body. **Corrected 16 Oct 2026 by making the sentence true rather than rewording it:** the cookie is the web session — accepted by `authenticate` and the socket handshake, renewable from the refresh cookie, revoked and cleared on logout — with the client storing no token (see T1-10). |

**All seven rows above were corrected on 16 October 2026, and the two that pointed at code were not closed with a sentence.** `learn-content.ts`'s reporting and agency-savings articles were rewritten against the product; `AGENTS.md`'s counts, Phase 2 table and test totals were corrected in place; the blueprint's and the tracker's rows now state what the code does; and the cookie row was closed by wiring the session, because no honest wording was available for a cookie the policy described as authenticating a session the product did not authenticate. Re-verified against the code on 16 October 2026: `tasks.routes.ts:19` (`PATCH` ungated, `tasks.controller.ts:94,106,109` narrowing a completer to status and notes), `room-checks.routes.ts:18-19` (`POST`/`PATCH` open, `DELETE` ORG_ADMIN, `room-checks.controller.ts:29,42-44` attributing and limiting the record), `incidents.routes.ts:22,39` (categories and reporting ungated, `incidents.controller.ts:42,49-50,160` scoping a reporter to their own); `zero` matches for `clock_on`/`actual_start` in the API; `apps/web/nginx.conf` `listen 80` with no `ssl_protocols` and nothing publishing 443 in `docker-compose.prod.yml`; one distinct screenshot digest (`427eeaa5…`, seven files) with `store:verify-screenshots` exiting **1**. The table is kept as the record of what was wrong, because a corrected document that forgets it was ever wrong invites the same mistake.

---

## 4. Market-facing surfaces

### 4.1 Store submission — re-verified today, two P0s unchanged

| Check | Command or evidence | Result |
| --- | --- | --- |
| Seven screenshots are distinct | `sha256sum store-assets/screenshots/android/*.png` | ❌ **FAIL — unchanged since 13 Oct.** All seven are `427eeaa5099094a7…`, 143,366 bytes each: byte-for-byte the same frame. |
| The gate that catches it | `npm run store:verify-screenshots -- --platform android` | **exit 1** — `FAIL 1 group(s) of identical screenshot(s)… NOT UPLOADABLE` |
| Listing validity | `npm run store:validate` | exit 0, 6 notes |
| Data safety form generatable | `ls store/data-safety/` | ❌ **BLOCKED** — `template.csv` still absent (only `README.md`, `make-fixture.mjs`, `template.fixture.csv`, `generated.csv`); `store:validate` warns `requiresTemplate … is absent, so the Data safety form cannot be generated` |
| Content rating, categories, contact, target audience | `store/listing.json consoleOnly` | ⬜ Console-only clicks, nobody has done them |
| iOS | — | ⬜ No build, no capture, no App Privacy label |
| Upload key | `STORE_RELEASE_RUNBOOK.md` | ⚠️ Irreversible on first upload — **and the first upload already happened** on 2 October, so the key is fixed to whatever EAS signed that draft with. EAS holds it ("Build Credentials 1LdWOI-6iH") and the outstanding item is the backup, not the decision. |

The screenshot fix is one capture run on a machine with headroom **and then opening the images** — the
runbook's own rule, and the step it names as the only one that catches this.

### 4.2 Billing and revenue

| Question | Answer, from the code |
| --- | --- |
| Can a customer subscribe? | ✅ Yes. Subscription status/trial/period are Stripe-backed (`billing.controller.ts:115-148`); the domiciliary price is created on first use and verified against the stored pence value before reuse (`:240-345`). |
| Is there a public price? | ❌ **No price is published.** `PricingPage.tsx` contains no currency symbol, no "pcm", no "per month" and no "per user" (`grep -oi` over the file returns no such string) — it sells conversation instead: "Book a demo" ×2, "Talk to" ×5, "contact" ×5. That matches `PUBLIC_SITE_CAPABILITY_MATRIX.md`'s "public pricing excluded", and sales-led pricing needs a quote path, which the domiciliary flow has (`domiciliary_quote_accepted_at`). |
| Can add-ons be sold? | ❌ **No.** `GET/PATCH /billing/addons` (`billing.routes.ts:33-34`) reads and writes a JSON array on `organizations` (`billing.controller.ts:1312-1321`). There is no Stripe price, line item or checkout for an add-on anywhere, and `BillingPage.tsx` contains no add-on UI (0 matches). Any plan that assumes add-on revenue has no mechanism behind it. |
| Trial → paid | 🟡 Stripe is the source of truth for `trialing`/`active`/`past_due`; the web has a `SubscriptionGuard`. Whether production runs **live** Stripe keys is not visible from the repository (§7). |

### 4.3 Onboarding and first-run

Signup → email verification → organisation → onboarding wizard exist and are tested
(`OnboardingFlow.test.tsx`, `RegisterPage`, `SignupPage`), and the rate limits were raised specifically so
a whole care home can register at once (T0-10, closed). The gap is the one §3.3 describes: the first-run
experience never asks "is this organisation domiciliary or supported living?", so a supported-living
customer is onboarded into a mobile shell that does not work for them.

### 4.4 Public claims

* `apps/web/src/__tests__/marketingClaims.ts` (578 lines, and it only grows) is a claim corpus with per-claim evidence, and
  CI **runs it** (`Run web tests`) — it is green on `43ed66de`. That guard has already caused three real
  claims to be withdrawn (T0-15, T0-16, the ISO 27001 line) and is the reason to trust the public copy
  more than the average B2B site.
* `PUBLIC_SITE_CAPABILITY_MATRIX.md` is honest about what may not be claimed (no pricing, no logos, no
  certifications, no AI autonomy). The claims that remain qualified in the matrix are qualified in the
  copy.
* The Class 2 gaps in `CLAIM_REGISTER.md` — regulator and legal statements that cannot be traced to a
  source from inside the repository — are still open, and the two that were checked against primary
  sources (CIW, RQIA) **were both wrong**. That is the strongest argument for finishing the register
  before an inspector or a procurement team reads the site.

### 4.5 Commercial, legal and operational (tracker, unchanged)

These are not engineering and no amount of code closes them: standalone DPA (**T0-9**), solicitor review
of Terms + Privacy (**T0-8**), PI insurance (**T0-7**), organisation-wide DPIA (**T0-5**), AI Article 28 /
transfer basis (**T0-17b** — enforced in code as a fail-closed processor gate, so **AI cannot be sold
until it is signed**), ICO number awaited (**T0-1**), support process (**T1-2**), incident response plan
(**T1-3**), restore drill never run (**T0-2**), monitors unproven (**T0-4**), PII encryption backfill
(**T0-15**), and the **uncut EAS build** that leaves four location-privacy fixes and one corrected notice
on this machine rather than on carers' phones (**T0-6a/6b/6c/6f/6g**).

---

## 5. Prioritised fix list

### P0 — do not sell or submit until these are done

| # | Fix | Evidence it is needed | Owner |
| --- | --- | --- | --- |
| 1 | **Fail closed on DBS submit/poll**, or remove the route and UI until the real integration lands, and make the test assert the refusal | §2 — a mock files `CLEAR` + a `CERT-` number + an approved DBS document | Opeyemi |
| 2 | **Recapture the seven store screenshots, then open them** | `store:verify-screenshots` exit **1**; all seven digests identical | Opeyemi (needs a device/emulator) |
| 3 | **Get `store/data-safety/template.csv` from Play Console** and generate the form | template absent; form required for production | Adetoye |
| 4 | **Answer the content-rating questionnaire** and set categories/contact | console-only | Adetoye |
| 5 | **Back up the upload key** — the 2 October draft fixed it, so it can no longer be chosen | irreversible | Adetoye |
| 6 | **Decide iOS scope** (Android-first is a legitimate answer) | nothing exists for iOS | Adetoye |
| 7 | **Legal set:** DPA, solicitor review, PI insurance, org-wide DPIA, AI Art 28 | T0-5/7/8/9/17b | Adetoye → Appoint |
| 8 | **Cut the mobile EAS build** carrying T0-6a/6b/6c/6f/6g | the shipped build still contains a claim corrected in v1.2 | Opeyemi |
| 9 | **Confirm no production org holds real data** before the reviewer account is used | it is the founder's own ORG_ADMIN | Adetoye |

### P1 — before the first supported-living customer, or in the first week

| # | Fix | Evidence | Owner |
| --- | --- | --- | --- |
| 10 | **Branch the mobile shell on service type**, or state plainly that the app is domiciliary-only for now | `App.tsx:184` role-only tabs + `/homecare/*` behind `requireDomiciliaryOnly` | Opeyemi |
| 11 | ~~**Shift clock-on/off and handover** (blueprint §9.1, §9.2)~~ | ✅ **Closed 16 Oct 2026**: both exist at the API with the offline idempotency contract, and both are reachable from the web rota's shift detail. The `/impeccable`-class remaining work is the two mobile screens (blueprint §12 phases 2 and 3) | — |
| 12 | **Fix or delete `/marketplace`** | `staffId: 'mock-id'` vs `z.string().uuid()` → every click 400s | Opeyemi |
| 13 | **Rewrite the stale Learning Center articles** (reporting, agency savings) | §3.5 — in-app help contradicts the product | Opeyemi |
| 14 | **Resident read-scoping for support workers** (blueprint §9.10) | least privilege, data protection | Opeyemi |
| 15 | **Tests for `body-map` and `compliance-portal`** | the only two modules with zero test files | Opeyemi |
| 16 | **Prove monitoring**: cron installed, Kuma has monitors, an alert reaches a phone | T0-4 | Adetoye |
| 17 | **Run the restore drill** | T0-2 — a backup nobody has restored is a hypothesis | Adetoye/Opeyemi |
| 18 | **Policy acknowledgement + compliance-officer mobile role** (blueprint §9.7, §9.8) | inspection evidence gap | Opeyemi |
| 19 | **Fix the doc drift in §3.5** | five documents, five wrong statements — ✅ **closed 16 Oct 2026**: seven rows corrected across `AGENTS.md`, `learn-content.ts`, `MOBILE_SUPPORTED_LIVING_BLUEPRINT.md`, `GO_LIVE_READINESS.md`, `STORE_RELEASE_RUNBOOK.md` and the audit's own §3.5, one of them (the session cookie) by code rather than by wording | Opeyemi |

### P2 — before scaling

20. **Add-on purchasing** (a Stripe price and a UI) or drop the concept from the plan (§4.2).
21. Finish the claim register's Class 2 items against primary sources — Scotland first, then England.
22. Independent penetration test and WCAG 2.1 AA audit — commissioning prerequisites, not launch ones.
23. Public pricing, once a price exists to publish.

---

## 6. Verified green on this commit (so the audit is not only a list of problems)

| Check | Command / source | Result |
| --- | --- | --- |
| CI, whole workflow | `gh run view 38898426982` | all three jobs **success** (lint+typecheck, design system, visual 36 passed) |
| API suite | CI log | **168 files / 1,631 tests passed** |
| Web suite | CI log | **67 files / 511 tests passed** |
| Mobile suite | CI log | **40 suites / 322 tests passed** |
| Screenshot comparisons against baselines | CI visual job | **16 comparisons passed** (light and dark, desktop and mobile) |
| Design system drift + palette gate | CI design-system job | `design:check`, `design:lint`, `design:test` all green |
| Store listing | `npm run store:validate` | exit 0, listing valid, 6 non-blocking notes |
| Scale of the product | repo census today | 51 module dirs (49 with routes), 103 page components, 29 mobile screens, 97 migrations |

---

## 7. What I could not verify

Stated so that absence of evidence here is not read as evidence of absence.

- **No production host access.** Whether the DBS check has ever been polled in production, whether
  Stripe runs in live or test mode, whether Kuma has monitors, whether the restore drill has been run,
  and whether any org holds real data are facts about the server. §2's `LIKE 'MOCK-%'` query is the
  cheapest one to run.
- **No device, emulator or Android SDK.** The screenshot finding is the bytes on disk; I did not run the
  capture tour or re-derive `targetSdkVersion`.
- **No macOS.** iOS is unverified end to end.
- **No Play or Apple credentials**, so console state (Data safety, content rating, categories, reviewer
  access) is from the repo's own records, not re-checked.
- **I did not execute the 381-case manual UAT pack** (`MeticleCare_QA_UAT_Test_Pack.xlsx`). Every
  statement in §3 is from source and from the automated suites; nobody has yet walked the product as a
  care provider would.
- **The two blueprints were read, not reconciled with each other.** `METICLE_BLUEPRINT.md`'s inventories
  are July 2026 snapshots and its §9.2 agents are architecture; I treated them as intent, not claims.
- **Add-on revenue intent is a product question I cannot answer from code** — §4.2 records that no
  mechanism exists, not that none is wanted.

---

## 8. One line per audience

- **Before selling anything:** fix the DBS path (§2). Everything else on this list costs money or time;
  that one costs credibility with a regulator, a commissioner, or a safeguarding team.
- **Before a Play submission:** recapture the screenshots (one run) and get the Data safety template
  (one Play Console download). Everything else in §4.1 is console clicks.
- **Before selling supported living:** the web product is ready, and as of 16 October 2026 so is every
  blueprint P0 — shift attendance and handover included (§3.2). The mobile app is still
  domiciliary-only, so the attendance claim is a **web** claim until the app's screens exist.
- **Before the first paying customer:** the legal set in §4.5 is unstarted, and the AI feature cannot be
  sold until the Article 28 agreement is signed — that gate is enforced in code, so it is not a
  suggestion.
- **For engineering:** the feature surface is genuinely broad and unusually well tested; the two live
  defects found here are small in code and large in consequence (a mock in production, a hardcoded
  `mock-id` in a live route), which is the pattern this codebase's own documents keep warning about.
