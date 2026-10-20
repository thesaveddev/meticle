# Getting a real DBS integration — options, plan and cost

**Date:** 16 October 2026 · **Status:** plan; **phase 0 (§5) and phase 3 are implemented, as of 16 October 2026** — phases 1, 2 and 4 not started · **Driver:** the 16 Oct feature audit found
that the DBS module in production files a **cleared** check from a mock provider
(`docs/FEATURE_READINESS_AUDIT.md` §2). This document answers what a real one looks like, how to get it, and
what to build in the meantime.

Sources are cited inline. Every external claim was read from the page linked, not recalled; where a page
could not be retrieved, that is said rather than filled in.

---

## 1. The short answer

**There is no DBS API to integrate with.** The Disclosure and Barring Service publishes no public API for
submitting applications. Electronic submission runs through **e-bulk**, which is available only to
**Registered Bodies** and **approved e-brokers**, and the road in is short and steep: an organisation can
register as a Registered Body if it submits **more than 100 eligible applications a year**, and running its
own e-bulk connection requires **more than 1,500 applications in a rolling 12-month period within the
previous 18 months**, a payment-on-account facility, lead-countersignatory authorisation and suitable IT
infrastructure. A non-registered organisation applies through an **Umbrella Body**, which is legally
responsible for the submission it makes.
([employer guidance](https://www.gov.uk/guidance/dbs-check-requests-guidance-for-employers),
[e-bulk guidance](https://www.gov.uk/guidance/e-bulk-submitting-multiple-applications-for-dbs-checking-formerly-crb))

Two consequences that decide the whole design:

1. **We integrate with a partner, not with the DBS.** A commercial Umbrella Body / e-broker exposes its own
   API in front of the DBS process. Several do, publicly documented (§3).
2. **If our software touches DBS electronic application data, DBS must approve us first.** The e-bulk
   guidance says a third-party data processor or supplier must be approved **before** it can access that
   data — a pre-qualification questionnaire, then a contract with DBS setting out its obligations — whether
   the access is occasional or ongoing.
   ([e-bulk guidance](https://www.gov.uk/guidance/e-bulk-submitting-multiple-applications-for-dbs-checking-formerly-crb))

There is one place DBS does document a web service, and it is the cheap, high-value half: the **Update
Service multiple-status checking** facility, which the official guide describes as a Web Service providing
an API (§5). That is re-checking, not applying.

---

## 2. What our code has today, and what is wrong with each part

**Read this table as the 16 October snapshot taken *before* phase 0.** It is kept as written because
it is the analysis that decided the plan, and its ⛔ rows are the defects phase 0 was written to remove —
four of them (the mock default, the synthesised document, the three-year retention and the absent screen
copy) are now closed. Where a row is still the current state, §5 says so.

| Piece | Where | Verdict |
| --- | --- | --- |
| Provider seam | `DbsProvider` interface — `submitCheck`, `getStatus`, `cancelCheck` (`apps/api/src/modules/dbs/dbs.service.ts:39-43`) | ✅ The right idea. It needs a fourth method (results/void), a capabilities flag and per-org credentials. |
| Provider selection | `let provider: DbsProvider = new MockDbsProvider()` (`:59`), `setDbsProvider()` (`:61`) | ⛔ **Never called.** The mock *is* the production provider. |
| Provider config type | `DbsProviderConfig { apiKey, apiUrl, organisationId, username, password }` (`dbs.types.ts:45-51`) | 🟡 Declared and unused — no storage, no wiring, no encryption. |
| Routes | `apps/api/src/modules/dbs/dbs.routes.ts` — create, submit, patch status, poll | 🟡 No webhook endpoint, no consent record, no eligibility capture, no idempotency key. |
| Result handling | `updateDbsStatus()` (`dbs.service.ts:162-200`) | ⛔ Two defects: it accepts an **operator-typed** `status: 'clear'` + certificate number as evidence, and on `clear` it **auto-inserts a `documents` row of type DBS, `status = 'approved'`, expiry `+3 years`** — a synthetic record nothing verified. |
| Retention | same | ⛔ A 3-year derived document is not a retention period we can defend (§6). |
| Four-nation awareness | `compliance.vetting.ts` — `VETTING_SCHEMES` for DBS / PVG / AccessNI / Garda vetting, tiers, required documents, `resolveVettingScheme`, `vettingDocumentTypeSql` | ✅ Genuinely good, and it already refuses a DBS for a Scottish worker with the correct scheme named (`dbs.service.ts:19-35`). |
| PII leaving the process | `decryptRowForOrg('staff_profiles', …)` before `provider.submitCheck` (`dbs.service.ts:126-128`) | ✅ Already correct, and the read path is one of the two that decrypt on purpose. |
| Credentials at rest | `ENCRYPTED_COLUMNS` (`apps/api/src/shared/utils/encrypted-columns.ts`) covers identity/contact columns per org key | 🟡 **Note:** the AI integration stores its provider key inside `organizations.ai_config` JSONB (`setup.ts:1945`) — plaintext JSON, **not** in the encrypted registry. Do not copy that shape for a vetting partner key. |
| Webhook pattern to reuse | `POST /billing/webhook` mounted with `express.raw` (`index.ts:218`), signature verified with `stripe.webhooks.constructEvent`, idempotent via `stripe_webhook_events` with `attempt_count`, stale-`processing` reclaim and recorded failures (`billing.controller.ts:786-803`) | ✅ Exactly the shape a partner result-callback needs. |
| Check levels | `DbsLevel` — `standard`, `enhanced`, `enhanced_with_barred` (`dbs.types.ts:12-16`) | 🟡 Nothing wrong asserted, but **`basic` is missing** — Basic is a real, cheaper product (now £20) used by care providers for roles that are not eligible for Standard, and the *eligibility* question is exactly what must not be guessed. Decide deliberately whether we support it or refuse it. |
| Retention job precedent | `cleanupOutbox(retentionDays = 90, consumerRetentionDays = 30)` (`events/events.outbox.ts:225`), scheduled by `events.worker.ts:36`, and the nightly per-org location purge | ✅ A purge job is normal here, not new machinery. |

**So the work is not "call an API".** It is: choose a partner, get approved, hold credentials safely, capture
consent and eligibility, receive results through a signed callback, map statuses honestly, and stop
fabricating evidence.

---

## 3. The partner route (recommended): what is actually available

Providers with **publicly documented** DBS APIs. "Documented" means a public page describing the
integration; it does not mean a schema you can read today, and none of these prices is a quote.

| Partner | Public API evidence | Public price evidence | Notes |
| --- | --- | --- | --- |
| **uCheck** | Applicant Request, Add Applicant, Add Application, **Get Results** APIs; says the API covers DBS checks ([uCheck API](https://www.ucheck.co.uk/api/)) | API development is a **negotiated charge**; PAYG examples show Enhanced **£52.80–£56.70** and Basic **£31.80–£35.70** including the DBS fee and VAT ([pricing](https://www.ucheck.co.uk/pricing/)) | Digital-ID material points at Yoti/EasyID partnerships rather than its own certified DVS. |
| **Care Check** | API integration offered for HR systems against its e-bulk platform; **free** ([integration page](https://www.carecheck.co.uk/products/integration-via-api/)) | Enhanced **£47** total (£41 DBS + £6 admin); Standard/Basic **£26** (£20 + £6) at the lowest displayed band ([pricing](https://www.carecheck.co.uk/about/pricing-and-payments/)) | Cheapest published admin fee seen; exact endpoints to be confirmed. |
| **Verifile** | REST/JSON API with documentation and a **sandbox**; orders, status tracking and results incl. DBS ([G-Cloud listing](https://www.applytosupply.digitalmarketplace.service.gov.uk/g-cloud/services/252994000430867)) | **£2.50 per transaction** on the listing | Whether £2.50 is the service charge *on top of* the DBS fee is not stated on the listing — ask. |
| **Agenda Screening** | API with OpenAPI/Swagger, docs and sandbox ([G-Cloud listing](https://www.applytosupply.digitalmarketplace.service.gov.uk/g-cloud/services/802183960642654)) | **£5–£60 per unit** (broad screening range) | Unit definition unclear; ask. |
| **Atlantic Data**, **GBG / First Advantage** | Both are **approved e-brokers** listed by DBS ([list](https://www.gov.uk/guidance/e-bulk-submitting-multiple-applications-for-dbs-checking-formerly-crb)) | Not published | Being an e-broker does not mean a public vendor API — ask for UK DBS technical documentation. |
| **TrustID** | Developer documentation includes a "Using the API to initiate DBS check" workflow | Not published | Documentation pages could not be retrieved in this research; confirm directly. |

**Identity verification is a separate buy, and a stricter one.** DBS does not accept "DIATF-certified" as a
blanket: the identity service must be certified against the **current UK digital verification services trust
framework and the current DBS supplementary code**, and an **Enhanced** check needs **GPG 45 high**
confidence. Manual document checks remain valid. Certification is per service and per code version — check
the live [DVS register](https://www.access-dvs-register.service.gov.uk/register/all-services) at
procurement and again at integration, and **pin the code version**: the guidance in force is the **04**
publication (26 June 2025), while a **1.0** is published as *pre-release*, with the DVS register already
showing services certified against dated versions. So the version a partner is certified against will move
and our procurement must record which one we bought.
([DBS digital identity guidance](https://www.gov.uk/government/publications/dbs-identity-checking-guidelines/dbs-digital-identity-verification-guidance),
[code 04 in force](https://www.gov.uk/guidance/supplementary-code-for-disclosure-and-barring-service-digital-identity-checks-04),
[code 1.0 pre-release](https://www.gov.uk/government/publications/supplementary-code-for-disclosure-and-barring-service-digital-identity-checks-1-0/supplementary-code-for-disclosure-and-barring-service-digital-identity-checks-1-0-pre-release))

**Providers with published *identity* APIs** (a component, not a submission service): Yoti
([developer docs](https://developers.yoti.com/digital-id/dbs-rtw-overview) — the same service behind Post
Office EasyID), GBG Go ([API docs](https://docs.go.gbgplc.com/docs/go-v1/developer-integration/overview)),
TrustID ([API page](https://www.trustid.co.uk/trustid-services-right-to-work/developer-api/)), Entrust,
Persona.

### What to ask each of them (send as one email, compare on the answers)

1. Are you the Registered Body or Umbrella Body that submits, and is the **submitter's legal responsibility**
   yours or ours? What is the countersignatory arrangement?
2. Do you have a **sandbox**, API documentation and a test applicant, and can we see them before signing?
3. Submit / status / **result delivery**: do you push a **signed webhook**, or must we poll? Replay and
   idempotency semantics?
4. Which **check levels** can you submit (Standard, Enhanced, Enhanced with barred list, adult/child
   workforce), and who assesses eligibility (we do — but how do you record it)?
5. Is **digital identity** included, and is that service certified against the DBS supplementary code and
   GPG45 high? If not, do you accept our DVS?
6. What **applicant-limited PII** do you need? (We propose name, date of birth, email, address, postcode and
   nothing else.) Which fields do you hold, where, and for how long?
7. Are you able to sign a **data processing agreement** and name us as a sub-processor to the provider? Do
   you require **DBS approval** of us as a supplier before data access (§4)?
8. **Price per level**, admin fee, API/development charge, minimum volume, and whether you charge the
   provider or we bill the customer.
9. **Update Service** re-check: can you do multiple-status checks, and is that via DBS's web service?
10. Scotland (**PVG**), Northern Ireland (**AccessNI**) and Ireland (**Garda**) — do you cover them, or is
    DBS-only your boundary? (Our own research says those routes are portal-based; see §7.)

---

## 4. The other two routes, and why not

| Route | What it means | Verdict |
| --- | --- | --- |
| **Become a Registered Body and run e-bulk ourselves** | Register (>100 eligible applications a year), then meet the e-bulk conditions (>1,500 applications in a rolling 12 months within 18 months, payment on account, lead countersignatory, IT infrastructure), plus DBS approval of our data access and a contract | ❌ **Not now.** We would take on the legal responsibility for every submission a care provider makes, and the volume test is passed by scale we do not have. Revisit only if we process thousands of checks a year and want the margin. |
| **Become an Umbrella Body ourselves** | Same liability profile, plus countersignatory duties | ❌ Same reasoning. |
| **Don't submit; track only** | No partner. The provider uploads the certificate metadata (or nothing) and MeticleCare tracks level, issue date, certificate reference and a renewal date, with reminders | ✅ **Ship this today** as the honest product (§5 Phase 0). It is what the public site already claims, and it needs no partner, no approval and no DBS data access. |

---

## 5. The plan

### Phase 0 — this week: make the module honest (no partner needed)

This is the fix from the feature audit and it is independent of §3. Roughly a day.

**Status: complete, 16 October 2026 — all six items.** Items 1–3 removed the fabrication, and items 4–6
added the permitted metadata, the six-month retention purge that deletes it, and the compliance-screen
copy that says submission is closed before a button is pressed. What phase 0 deliberately does not do is
submit anything: that is phase 1 (partner and legal) and phase 2 (the adapter).

1. **Fail closed.** `submitDbsCheck` and `pollDbsStatus` refuse unless a real provider is configured for the
   organisation, with a message that says what is missing. One guard at the single choke point both already
   pass through (`dbs.service.ts:59-61` — the provider is a module-level variable today, so the guard has
   to read configuration rather than trust whatever `setDbsProvider` was last called with).
   **Done:** `requireConfiguredProvider()` refuses with 503 and names which of the two causes applies, and
   it runs *before* the staff record is decrypted — no name, date of birth or address leaves the process on
   the way to a provider that is not there.
2. **Delete the mock as a default.** `provider` becomes `null`; `setDbsProvider` is called from one factory
   that reads configuration at boot. A test asserts that with no configuration, `submit` returns 409/503 —
   the mock must not be reachable from a production path, and the test must fail if someone re-adds it.
   **Done:** `let provider: DbsProvider | null = null`, chosen only by `resolveDbsProvider(env)` from
   `DBS_PROVIDER` at boot; no adapter exists yet, so a configured key is logged and still refused.
   `dbs.providerGuard.test.ts` fails on a mock class, a non-null default, or a `setDbsProvider` call from
   anywhere outside the service; five of its assertions fail against the pre-change source.
3. **Stop synthesising the document.** Remove the auto-insert of an approved DBS `documents` row on
   `clear` (`dbs.service.ts:191-198`). A check result is a *fact about a check*; a document is evidence a
   human uploaded. Conflating them is how the mock's output became "evidence" in the first place.
   **Done:** the insert is gone, and `updateDbsStatus` carries the reason.
4. **Metadata-only is the model.** Track level, workforce, issue date, certificate reference, the
   recruitment decision and a renewal date. **Never a copy or image of the certificate** — the DBS model
   policy says do not keep a photocopy, image or copy of certificate contents, and allows only limited audit
   metadata. ([handling DBS certificate information](https://www.gov.uk/government/publications/handling-of-dbs-certificate-information/handling-of-dbs-certificate-information))
   **Done:** migration 153 adds the recruitment decision, its date, who took it and a renewal date to
   `dbs_checks`, and `PATCH /dbs/checks/:id/certificate` records exactly that set — the reference, the
   issue date (the column called `disclosure_date` since the table was created), the decision and its date,
   the renewal marker and a note. There is no upload path in the module and no column for an image, and
   two tests keep it that way: `dbs.certificateRetention.guard.test.ts` asserts the route's accepted field
   names are exactly the permitted list and that no multer, multipart, base64, storage call or
   `certificateImage`-shaped field exists anywhere in it, and the integration suite asserts the fields the
   endpoint does and does not touch. Nothing on this path mints a `documents` row — a check result is a
   fact about a check and a certificate is a document a human uploaded, which is what item 3 restored.
5. **Retention.** Certificate information is kept for the recruitment decision and normally **no longer than
   six months**; store a `purge_after` and let a nightly job clear it, reusing the purge-job shape already in
   `events/events.outbox.ts` (`cleanupOutbox`) and the location-retention job. Where the provider needs a
   longer *renewal* marker,
   store the renewal date, not the certificate.
   **Done:** `purge_after` is written by every path that can put certificate information on a check — the
   metadata endpoint and the operator-recorded completion in `updateDbsStatus` — and `dbs.certificateRetention.ts`
   computes it as six months from the recruitment decision, or six months from today where no decision has
   been taken yet (an outer bound, re-dated when the decision lands). `runScheduledDbsCertificatePurges()`
   runs nightly, date-keyed so a restart cannot skip a day, visits only providers with something genuinely
   due, and is fail-per-org so one tenant's bad data cannot hold up another's deletion. It empties the
   reference, the issue date and the note, stamps `certificate_purged_at` so an emptied field reads as a
   retention decision rather than as loss, and leaves the check itself — level, workforce, status, times,
   cost, the recruitment decision and the renewal date — completely intact. Two properties are worth
   stating because they are the ones a reviewer would look for: **a deadline is never extended**, so a
   write whose deadline has already passed is refused with the dates named rather than stored or silently
   re-dated (§6 is a ceiling); and **information with no deadline cannot exist**, which is why the
   completion path starts the clock too. `POST /dbs/certificates/purge` runs the same purge on demand for
   an ORG_ADMIN answering an erasure request, and `GET /dbs/checks/stats` carries
   `certificate_details_held`, `certificate_details_purged` and `certificate_purge_due` — the last being
   the alarm, since anything above zero means the sweep is not running and the provider is holding what it
   should have deleted.
6. **Say it in the UI.** The compliance screen's DBS tab should state that MeticleCare does not submit checks
   yet where that is true, rather than offering a Submit button that fabricates a result.
   **Done:** the card opens with a warning that says *MeticleCare does not submit DBS checks yet*, carries the
   API's own refusal sentence as its body — `GET /dbs/checks/stats` returns `submission: { available, message }`
   from the same function the 503 comes from, so the screen and the refusal cannot drift — spells out the
   metadata-only alternative and the six-month rule, and shows Submit and Poll **disabled** with that reason
   on the control instead of letting them fail. When a partner is configured the notice disappears on its
   own, because nothing in the UI hard-codes the sentence. The same card gains a *Certificate / decision*
   column: the reference and what will happen to it while it is held, and the recruitment decision with the
   deletion date once it has gone.

### Phase 1 — partner and legal (external, weeks not days)

1. Send the §3 questions to **Care Check, uCheck, Verifile and Agenda** (cheapest documented admin fees and
   the clearest sandbox evidence). Compare on total per-check cost, sandbox access, webhook support and
   whether they cover identity.
2. **Confirm whether we need DBS approval as a supplier** — it turns on whether our software accesses e-bulk
   application data. It probably does, in which case the PQQ and the DBS contract are a real lead-time item
   and belong on the go-live tracker now, not later.
3. **DPA with the partner** (we are the processor of the provider's data, the partner is our
   sub-processor), named in the privacy policy and in the customer-facing sub-processor list.
4. **Update the DPIA** for employment-vetting data: what leaves, to whom, under what instrument, for how
   long, and what happens to it when a provider leaves. The existing
   `DPIA_Live_Active_Visit_Map.md` is the house style for this.
5. **Commercial model decision:** does the provider pay per check through us (we re-charge), or do they hold
   their own account with the partner and we only record the result? The second is far less work and less
   risk, and is the recommended default — it also means §4's approval question may not arise at all.

### Phase 2 — build the adapter (about 5–10 days of work, once credentials exist)

**Interface** (`dbs.types.ts`):

```ts
export interface DbsProvider {
  readonly key: string                       // 'carecheck' | 'ucheck' | …
  readonly capabilities: { submit: boolean; status: boolean; webhook: boolean; cancel: boolean; identity: boolean }
  submitCheck(applicant: DbsApplicant, check: { level: DbsLevel; workforce: DbsWorkforce; idempotencyKey: string }): Promise<DbsSubmission>
  getStatus(providerReference: string): Promise<DbsResult>
  cancelCheck(providerReference: string): Promise<void>            // void, never delete
}
type DbsResult = { status: DbsStatus; certificateReference?: string; issuedAt?: string; raw?: unknown }
```

**Data model** (migration `150_dbs_checks_provider.sql`):

- `dbs_checks`: `provider_key`, `provider_check_id`, `idempotency_key` (unique per org), `consent_at`,
  `consent_by_user_id`, `eligibility_role`, `eligibility_asserted_by`, `identity_method`
  (`manual` | `dvs:<service>`), `certificate_reference`, `issued_at`, `result_received_at`,
  `purge_after` (six months), `voided_at`, `void_reason`, `status` (add `refused`, `withdrawn`).
- `organization_integrations`: one row per org per partner, credentials **field-encrypted** with
  `encryptField` under the org key and added to `ENCRYPTED_COLUMNS` — with the write path, the read path and
  a widening migration, because that file's own rule is that a name in the list does nothing on its own.
  Do **not** put a partner key in an `ai_config`-style JSONB column.
- `dbs_webhook_events`: partner event id, type, status, `attempt_count`, mirroring `stripe_webhook_events`.

**Endpoints:**

- `POST /dbs/checks` — captures consent and eligibility with the request (refuses without both), then
  submits. Idempotent on `idempotencyKey` with a unique key per org, which is the contract
  `homecare_offline_actions` already implements on `(organization_id, action_key)`
  (`homecare.repository.ts:1468-1485`) — reuse the shape, not the table.
- `POST /dbs/webhook/:partnerKey` — mounted with `express.raw` like `/billing/webhook`, HMAC verified,
  idempotent by event id, stale-`processing` reclaim, failures recorded.
- `POST /dbs/checks/:id/refresh` — manual poll, for partners without webhooks; rate-limited, and it can only
  move a check forwards, never straight to a terminal `clear` without a result document.
- `GET /dbs/checks` / `/stats` — unchanged shape, so the existing compliance UI keeps working.

**Rules that belong in code, not in prose:**

- A status only becomes `clear`/`disclosure` from a **provider result** (webhook or verified poll). An
  operator typing a status is a data-entry path for evidence they hold, and it must be labelled as such —
  `PATCH /dbs/checks/:id/status` should record a *manually recorded* result with the uploader and date, or be
  removed. **Half done in phase 0:** the route still exists, but it can no longer put certificate information
  on a check without a retention date, and a new reference clears a previous purge stamp — it starts the
  clock the same way the metadata route does. What remains is the labelling: the uploader, the date and the
  word *manually* on the result.
- Every state change writes an audit row (the module wrote **none** until phase 0 — verified by grep) and,
  on a terminal result, emits a domain event so the existing consumer fires: `dbs.expiring` is published by
  `compliance.events.ts:35` and registered to `MissionControlAlertConsumer` at
  `events/consumers/register.ts:27`, which is the path a `dbs.result_received` event should join.
- The four-nation refusal stays exactly as it is: a DBS is refused for a Scottish or Northern Irish worker
  with the correct scheme named.
- `retention_purge` is fail-per-org, like the location purge, so one tenant's bad data cannot block another's
  deletion.

**Tests** (the reason the current defect survived is that the suite asserted the mock):

- no provider configured → 409/503 on submit and poll, asserted directly;
- the module's default provider is `null` (a source-level guard, in the style of
  `encrypted-columns.sentinel.test.ts`);
- signature-verified webhook, replay produces one state change, tampered signature is rejected;
- consent and eligibility are required before submission, and a change of level/workforce re-asks;
- `clear` never creates a `documents` row and never sets a 3-year expiry;
- purge clears certificate information after the window and leaves the *fact of the check* intact;
- a Scottish/PVG worker is refused with PVG named (already covered — keep it).

### Phase 3 — re-checks: the DBS Update Service (high value, low cost)

An Update Service status check is free to the employer, requires the individual's consent, requires the
employer to be legally entitled to the same level and workforce, and requires the **original paper
certificate** to have been seen and the person's identity verified. DBS does **not** notify employers of a
change, so periodic re-checks are the provider's job.
([employer guide](https://www.gov.uk/government/publications/dbs-update-service-employer-guide/dbs-update-service-employer-guide))

The **multiple-status checking** facility is documented by DBS as a Web Service that provides an API — that
is the only DBS-published API in this entire picture. Its onboarding requirements could not be
retrieved in this research (the guide PDF would not extract), so treat access as provisioned, not
self-service, and ask the partner (§3 question 9) whether they already have it.
([guide landing page](https://www.gov.uk/government/publications/dbs-update-service-multiple-status-checking-guide))

This is the cheapest way to sell "stays compliant after the check": a consent-led, scheduled status check
with the result recorded against the staff record, plus a renewal marker. It needs no e-bulk access and no
submission responsibility.

**Status: implemented 16 October 2026** — migration 150 (three tables, RLS on all of them),
`apps/api/src/modules/dbs/dbs.updateService.ts`, and the **DBS Update Service** section on the compliance
page. What that means, and what it deliberately does not do:

- **A subscription is a consent record.** The individual's Update Service reference, the level and workforce
  of the certificate they hold, the consent (date, method, who recorded it) and the two preconditions DBS
  puts on the employer — the paper certificate seen, identity verified. Both preconditions are required: a
  subscription without them is one that could never lawfully be used.
- **A check is recorded, not performed.** `POST /dbs/update-service/:id/checks` stores what the person
  checking was told — `no_change`, `changed` or `unable_to_check`. Nothing is submitted and no certificate is
  created; `dbs.providerGuard.test.ts` asserts the workflow cannot reach the provider seam or write to
  `dbs_checks`/`documents`, and the integration suite asserts a status check mints neither. The
  multiple-status-checking Web Service described above is **not** used: its access is provisioned rather than
  self-service, and this workflow does not need it.
- **The entitlement rule is enforced on every check.** Level and workforce are re-asserted each time and a
  difference from the certificate held is refused with the rule quoted, because the employer must be entitled
  to the same level and workforce every time it uses the Update Service.
- **Withdrawing consent stops everything** and is recorded with its date and reason rather than deleted.
  Checks and reminders are refused from that point on, and consenting again creates a new subscription rather
  than reopening the old one.
- **The renewal marker** is raised automatically by a `changed` result (and managers are notified at once,
  because DBS tells employers nothing), or set by hand when a role change calls for it. It is cleared only by
  recording the new certificate's reference and issue date. `unable_to_check` records the attempt and leaves
  the check due, rather than pretending it happened.
- **Reminders** come from a six-hourly sweep keyed on `dbs_update_service_reminders` (subscription, kind, due
  date), so a provider is told once per due date, in-app. Not email: this is work a manager does inside the
  product and it is not time-critical the way a missed medication is. The warning window is the provider's own
  `organizations.compliance_warning_days` (default 14).
- **Retention is unchanged.** Metadata only — level, workforce, reference, dates. Never a copy or an image of
  the certificate, and no column here is a place to put one.

**Also fixed on the way.** `organizations.compliance_warning_days` did not exist in any database:
`102_compliance_warning_days.sql` is not in the registered migration list and the column is not in
`schema.sql`, so `ComplianceNotificationService.getWarningDays` caught the resulting error and silently used
14 days for every provider. Migration 151 creates it idempotently, and both the compliance reminders and the
DBS re-check now read the real setting. **Phase 0's remaining two items closed on 16 October 2026 as well**
(§5): the metadata retention purge and the compliance-screen copy. What this document still owes is phase 1
(four emails and a decision about who holds the partner account) and phase 2 (the adapter), which need a
partner rather than more code.

### Phase 4 — the other three nations (no APIs exist; sell honesty)

| Nation | Route today | What we can build |
| --- | --- | --- |
| **Scotland — PVG** | A registered organisation starts the application in its Disclosure Scotland account; the applicant completes their part in their own account and must **share** the result before the organisation can see it. Lead signatory plus countersignatories; umbrella bodies for non-registered organisations. No public API verified. ([mygov.scot](https://www.mygov.scot/apply-to-pvg-scheme/organisations)) | A guided workflow: record the application started, the applicant-completed step, the share step, then upload the outcome metadata. Evidence, not automation. |
| **Northern Ireland — AccessNI** | The applicant applies online through nidirect with their own account and a PIN; the registered body approves; the digital certificate goes to the **applicant's** account and an employer gets **one-time viewing for five days**. Registered bodies only; umbrella bodies for the rest. ([nidirect](https://www.nidirect.gov.uk/services/apply-online-enhanced-check-through-registered-body)) | Same guided workflow, with the five-day window modelled — a two-state record ("shared", "expired") rather than an uploaded document. |
| **Ireland — Garda vetting** | Organisation validates identity and invites; applicant submits to the organisation; the **liaison person** submits to the National Vetting Bureau and receives the disclosure. Written authorisation required. ([vetting.garda.ie](https://vetting.garda.ie/Application/About)) | Guided workflow plus a place to record the appointed liaison person — which the vetting registry already notes is required and currently unrecordable. |

**Do not** build a DBS-shaped API into these three. Their own guidance is portal-based, and a fake
integration here would repeat exactly the defect this document exists to remove.

---

## 6. Retention and consent, stated once so it is not improvised

| Question | Answer | Source |
| --- | --- | --- |
| May we keep a copy of the certificate? | No — the model policy says do not keep a photocopy, image or copy of certificate contents; limited audit metadata is permitted (issue date, name, certificate type, role, certificate reference number, recruitment decision) | [handling certificate information](https://www.gov.uk/government/publications/handling-of-dbs-certificate-information/handling-of-dbs-certificate-information) |
| How long? | Only for the purpose obtained; the usual period is **no longer than six months** after the recruitment decision | same, and [employer guidance](https://www.gov.uk/guidance/dbs-check-requests-guidance-for-employers) |
| What about consent? | Use only for the specific purpose consented to; record the consent, its date and the check it covers. Written consent is a *disclosure* exception under s.124 Police Act 1997 — it is not a right to retain a certificate | [s.124](https://www.legislation.gov.uk/ukpga/1997/50/section/124) |
| Are these rules the same across the UK? | No. AccessNI says registered bodies retain information for **no more than six months**; Disclosure Scotland says do not retain a photocopy or image and keep information only as long as necessary. Apply each nation's own rule | [AccessNI](https://www.nidirect.gov.uk/articles/accessni-registered-bodies), [mygov.scot](https://www.mygov.scot/disclosure-scotland-code-of-practice/information) |
| Who assesses eligibility? | The employer. Requesting a level the role does not justify is unlawful; the DBS countersignatory declares eligibility, and an umbrella body is legally responsible for what it submits | [eligibility guidance](https://www.gov.uk/government/collections/dbs-eligibility-guidance) |

That last row is a product requirement, not a footnote: the UI must make the provider **assert the role and
the level**, because the software cannot know whether a post is regulated activity — and the current
`POST /dbs/checks` accepts a level with nothing behind it.

---

## 7. Cost picture (as of 5 October 2026 fees)

| Item | Cost | Source |
| --- | --- | --- |
| Basic check | £20 | [DBS fee announcement](https://www.gov.uk/government/news/dbs-reduces-fees-for-checks-and-update-service-from-5-october-2026) |
| Standard check | £20 | same |
| Enhanced, and Enhanced with barred list | £41 | same |
| Volunteer (eligible) — Standard/Enhanced/barred list | Free (Basic still £20) | [volunteer guidance](https://www.gov.uk/government/publications/dbs-check-application-process-for-volunteers/disclosure-application-process-for-volunteers) |
| Update Service subscription | £15/year (free for volunteers); Standard and Enhanced certificates only | [fee announcement](https://www.gov.uk/government/news/dbs-reduces-fees-for-checks-and-update-service-from-5-october-2026) |
| Partner admin fee | Care Check £6/admin at the lowest band; uCheck's API is a negotiated charge; Verifile lists £2.50/transaction; Agenda £5–£60/unit | §3 table |

**Recommended commercial position:** the care provider holds the account with the partner and pays per
check; MeticleCare charges for the workflow, the record and the re-check discipline. That keeps us out of
handling a regulated fee, out of the submission liability, and — importantly — may keep us outside the DBS
third-party approval requirement entirely. If we later want to resell checks, §1's approval and §4's volume
tests come back onto the table.

---

## 8. What is not verified (and must be before committing)

- **Partner API specifics.** No schema, endpoint list or formal sandbox has been read for any provider on
  the §3 list; the evidence is public marketing and catalogue pages.
- **Whether DBS approval of us as a third-party supplier is triggered** by the design we choose — it depends
  on whether our software accesses e-bulk application data, which the recommended model may avoid entirely.
- **Update Service multiple-status API onboarding.** The official guide exists and describes a Web Service;
  the PDF would not extract, so access terms, credentials and limits are unknown.
- **DBS supplementary code in force.** The guidance in force is the **04** publication; **1.0** is published
  as *pre-release* and the DVS register already lists services certified against dated codes. Whether the
  1.0 pre-release has become the version a partner must hold could not be confirmed — re-check the live DVS
  register at selection time and record which code version the chosen service is certified against.
- **Atlantic Data, GBG/First Advantage, Reed, TrustID and Yoti** DBS-submission APIs: pages were listed but
  not retrievable, so their capability is recorded as unverified rather than as absent.
- **PVG, AccessNI and Garda APIs.** None was verified. Absence of a public API is what the sources show;
  a permissioned route may exist that is not published.

---

## 9. The decision to make

| Option | Cost | Time | Liability | Recommendation |
| --- | --- | --- | --- | --- |
| **A. Partner API, provider holds the account** | partner admin fee per check, paid by the provider | weeks (partner contract, DPIA) then ~1–2 weeks of code | lowest | ✅ **Do this** |
| **B. Partner API, we resell and bill** | we carry the DBS fee (£20/£41) plus admin | longer: DBS supplier approval, Art 28, billing surface | medium | Only if check volume justifies it |
| **C. Become a Registered/Umbrella Body** | countersignatory duty, e-bulk infrastructure, >1,500 applications condition | months | highest — we own every submission | ❌ Not now |
| **D. No submission; metadata + Update Service re-checks** | £0 | ~1 day (Phase 0) | none | ✅ **Ship now, in every case** |

Phases 0 and 3 are the ones that can start immediately and are worth doing whether or not a partner is ever
signed: they remove the fabrication, keep us inside the DBS handling rules, and make the compliance record
say only what is true. **All of phase 0 and phase 3 shipped on 16 October 2026** — the fabrication is gone,
the certificate metadata is held for six months and then deleted, and the screen says so. What is left of
route D is nothing; what is left of the whole plan is phases 1 and 2, which start with four emails.

---

## 10. Related documents

- `docs/FEATURE_READINESS_AUDIT.md` §2 — the defect this plan responds to, with file:line evidence.
- The marketing pages that actually make the DBS claim: `apps/web/src/pages/marketing/FeaturePage.tsx:293`
  and `FeaturesPage.tsx:197` ("Right to Work & DBS Reminders") — true today, and they should stay true.
  `docs/CLAIM_REGISTER.md` now carries the DBS line as **F24** — added when phase 0 landed, as this section
  asked: the module's own "three-year approved DBS document" was a claim the handling rules do not support,
  and the permitted metadata, its six-month retention and the screen copy are the fix.
- `docs/GO_LIVE_READINESS.md` — where the PQQ/DPA/DPIA work should be tracked once Phase 1 starts.
- `apps/api/src/modules/compliance/compliance.vetting.ts` — the four-nation registry the integration must
  speak through, not around.
