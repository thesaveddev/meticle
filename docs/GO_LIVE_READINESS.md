# Go-live readiness

**This is the single tracked list for taking Meticle Care to its first paying customer.**
It replaces `MeticleCare_GoLive_Readiness.csv` and `.xlsx`, which were a 33-item template that
sat at "Not Started, 0%" with nobody's name on it and quietly went stale. A list nobody owns
and nobody updates is worse than no list, because it looks like progress.

**Owners:** **Adetoye** = Adetoye Adenuga (co-founder, commercial/legal/ops).
**Opeyemi** = Opeyemi Olorunfemi (co-founder, engineering).
**Appoint** = a person who does not exist yet. Adetoye hires or engages them; that act *is* the task.

Old IDs are preserved so anything you saw in the spreadsheet still cross-references.

---

## How to read the state column

| | Meaning |
|---|---|
| ✅ | **Verified done.** Checked against the repo or a live system, with the date. |
| 🟡 | **Partially done.** The part that exists works; the rest is named. |
| ⬜ | **Not started.** |
| ⛔ | **Blocked** — and the blocker is named, because an unblocked-sounding blocker is the worst kind |

**The rule that keeps this honest:** nothing gets ✅ without evidence in the "Basis" column.
A claim with no citation is a guess wearing a tick. If you cannot cite it, it is 🟡 or ⬜.

**Last full pass: 27 September 2026.** T0-2/T0-3/T0-3a revisited the same day after WAL archiving was configured.

---

## Tier 0 — blocks the first paying customer

| ID | Item | State | Basis (verified how) | Owner | Next action |
|---|---|---|---|---|---|
| **T0-1** | ICO registration | ⬜ | No ICO number anywhere in `apps/web`; `FeaturesPage.tsx:305` claims "ICO registered" | **Adetoye** | Register at ico.org.uk (~£40–60, 1hr). **Decision taken 27 Sep: register, keep the claim.** Then add the number to `FeaturesPage.tsx` — the claim is not true until it is on the page. |
| **T0-2** | Backup restore test | 🟡 | Backups **verified real**: `backup` service in `docker-compose.prod.yml`, nightly `pg_dump` 02:00, 30-day retention, atomic tmp→rename. WAL archiving is now **live in production** — enabled 27 Sep 2026 19:49 UTC, confirmed in the deploy log (`archive_mode=on`; `PITR check OK: enabled, 0 segment(s) archived so far`, the expected state for a fresh archiver), and `backup.sh` fails the nightly job if archiving stalls. **Still no restore has ever been performed.** | **Opeyemi** + access decision from **Adetoye** | Run the drill: `PG_IMAGE=<digest-pinned image> ./apps/api/scripts/restore.sh`. It builds a **disposable** container, never touches the live DB, and refuses to run without an explicit image. Needs prod DB access — Opeyemi gets credentials, or Adetoye runs the commands and sends output, or screen share. A green drill is not proof of the *right* point in time: check the `people` row counts the script prints against a known-good marker. First scheduled backup after 02:00 UTC on 28 Sep will confirm the archiver is genuinely moving segments. |
| **T0-2a** | Restore drill has a rehearsed owner | ⬜ The drill script exists; nobody has been told it exists or that they are the one to run it | **Adetoye** | Name the person who owns the restore drill and the cadence. A script nobody knows about is the same as no script. |
| **T0-3** | Public backup claim accuracy | ✅ | `FeaturesPage.tsx:321` corrected 27 Sep. Was claiming "Point-in-time recovery"; we had a nightly dump and **no WAL archiving** (`archive_command`/pgbackrest/wal-g all absent), so the strongest true claim was being made. Now states daily snapshots / 30-day retention only. | **Opeyemi** | Do not re-add "point-in-time" or "restore-tested" until each is true. Archiving is live but no restore has been performed, so the marketing guard (`apps/web/src/__tests__/marketingClaims.ts`) still forbids both. **Configuration is not capability, and a drill that has never been run is not a restore.** |
| **T0-3a** | Postgres restart window for WAL archiving | ✅ | Done 27 Sep 2026 19:49 UTC. `meticle-db-1` was recreated by the deploy; healthy again ~6 s later. The restart was the only planned outage in the release. | — | None. Recorded because "we knew it would restart Postgres" and "it restarted for six seconds" are different facts, and only the second one is evidence. |
| **T0-4** | Uptime monitoring actually works | 🟡 | Uptime Kuma **is deployed** (`docker-compose.prod.yml`, loopback-bound — good). Whether any monitor or alert contact exists is **invisible to the repo**; it lives in Kuma's own DB. | **Adetoye** | 30 min: log in, confirm a monitor on the site and API, confirm alerts go to a **phone**, then fire a test alert. A monitor that has never fired is untested. Also agree a break-glass phone number (not email). |
| **T0-5** | Organisation-wide DPIA | 🟡 | `DPIA_Live_Active_Visit_Map.md` exists but assesses **one feature**, authored by engineering. No org-wide DPIA. Required under UK GDPR Art. 35 for health data at scale. | **Adetoye** to **Appoint** a DPO | Commission. The feature DPIA is a genuine head start. |
| **T0-6** | Live Map DPIA contains a false statement | ✅ | Resolved in two steps. The **document** was corrected in v1.1 — the §6 claim that an organisation "can disable the live map feature per-location" was retracted as a control that did not exist, with no feature-flag mechanism anywhere in `apps/api`. The **control** is now built (27 Sep, DPIA v1.3): `PUT /homecare/settings/location-tracking`, `ORG_ADMIN` only, writing `location_tracking_enabled` + `_disabled_at` + `_disabled_by` (migration `126`). "Off" stops collection at check-in/out, skips the GPS proximity check, returns **403** from `GET /dashboard/live-map`, hides the web nav, and stops the mobile app asking for a position at all — not a hidden map over data we still hold. 14 API integration tests + 3 mobile tests, mutation-checked. | — | None outstanding, with one consequence to disclose: switching it off also switches off **GPS visit verification**, which cannot exist without collecting a position. The settings copy states this before saving, and DPIA §6.1 sets it out. Per *organisation*, not per location — several claiming orgs share a tenant, so a per-location control is not expressible in the current data model. |
| **T0-6a** | Kill switch reaches carers' devices | 🟡 | The API refuses to collect and the web hides the map **server-side, from 27 Sep** — so a carer on the current mobile build sends no coordinates, because the API drops them. The app-side change (no permission prompt, no "Check my distance", and — fixed 27 Sep, found while writing the privacy notice — the navigation sheet also honours it) is committed but **ships through EAS separately and has not been cut**. | **Opeyemi** | Cut an EAS build. Until then the switch is effective server-side but the app still asks the OS for a position and discards it — which is the worst of both states for a workforce-monitoring conversation. |
| **T0-6b** | Carers are actually told what location collection is | ✅ | The location notice is shown in the mobile app at first launch, once per worker per version, and the acknowledgement is recorded server-side in `staff_data_notices` (migration `127`) via `POST /homecare/staff-notices` — `ORG_ADMIN` is irrelevant here, any signed-in worker records their own. Content: `apps/mobile/src/content/staffLocationNotice.ts`, each capture point carrying the code reference that proves it. States **no retention period** (none has been decided — §2.2) and makes **no consent claim** (MeticleCare is a processor and cannot consent for a worker). 21 content tests + 7 gate tests + 9 API tests, all mutation-checked. The public privacy policy also listed staff location nowhere; added 27 Sep. | — | App-side, so **gated on the same EAS build as T0-6a**. Two deliberate behaviours to be aware of: the gate **fails open**, because a carer with no signal must still be able to clock in; and it does not appear at all to a worker whose employer has location switched off. |
| **T0-7** | PI insurance | ⬜ | Nothing in repo; organisational purchase | **Adetoye** | ~1 week to arrange. Ask about cyber liability too. |
| **T0-8** | Terms + Privacy solicitor review | ⬜ | Both written by engineers | **Adetoye** to **Appoint** | Solicitor reviews enforceability/indemnity for health/social care software. Send edits to Opeyemi to implement. |
| **T0-9** | Standalone DPA | ⬜ | Terms reference a DPA; no such document exists. A care home signing as data controller will ask for it. | **Adetoye** to **Appoint**; **Opeyemi** implements | Author it, then wire the in-product flow to it. |
| **T0-10** | Signup works for a whole care home at once | ✅ | Registration 5→30 per 15 min (`auth.routes.ts`), verification codes 5→10/min, password resets 5→20/hr. Client now waits out a per-IP 429 via `Retry-After` instead of erroring (`withRateLimitRetry`). 18 tests, mutation-checked. | **Opeyemi** | Done 27 Sep. Per-recipient caps (3 codes/15min) deliberately untouched — see the code comment. |
| **T0-11** | Email authentication (SPF/DKIM/DMARC) | ✅ | Gmail `Authentication-Results` on a message **the application sent**: `dkim=pass header.i=@meticlecare.com header.s=x`, `spf=pass`, `dmarc=pass`. Envelope aligned (`Return-Path: <security@meticlecare.com>`, Google's own `smtp.mailfrom`). Evidence in `EMAIL_SECURITY_RUNBOOK.md` steps 2 and 6. | **Opeyemi** | Leave `p=quarantine` alone — its precondition is now met. |
| **T0-12** | `SMTP_USER` off the previous vendor's domain | ⬜ | Production value is `***REMOVED***`. Verified to be **only** the SMTP auth username — it reaches no header. | **Adetoye** | Create `app@meticlecare.com`, follow §7.8.1 of `SECURITY_POLICY.md` (AUTH/MAIL/RCPT pre-flight, record the old value first). Unblocked by T0-11. Hygiene, not a security fix. |
| **T0-13** | Docker log rotation | 🟡 | 6 services have `restart: unless-stopped`, but **no `logging:` block and no `max-size` anywhere** in `docker-compose.prod.yml`. | **Opeyemi** | Add a `json-file` size/count cap per service. Unbounded logs fill the disk, and a full disk stops writes — an availability *and* a data-integrity failure on a database holding health records. |
| **T0-14** | QA / UAT pass | 🟡 | `MeticleCare_QA_UAT_Test_Pack.xlsx` (381 cases) not executed. Onboarding wizard tests were dead and are now fixed; 4 known failures remain in `Layout.test.tsx` (stale selectors, not a product bug). | **shared** | Opeyemi fixes the 4 stale Layout selectors. Adetoye walks the pack manually — he is the one who will use the product without a developer sitting next to him. |
| **T0-15** | **Encryption at rest actually enabled in production** | ⛔ | Found 27 Sep 2026 by the marketing claim guard. Column-level encryption is real (`pgcrypto`, and `apps/api/src/shared/utils/encryption.ts` uses aes-256-gcm over an HKDF per-tenant key), and two public pages advertise "encrypted at rest (AES-256)". But `getMasterKey()` returns an **empty buffer** if `FIELD_ENCRYPTION_KEY` is unset, `encryptField()` then returns the plaintext **unchanged**, and the only signal is a log warning reading "PII columns are stored in plaintext". Whether the key is set on production **cannot be seen from the repo**. | **Opeyemi** | Confirm `FIELD_ENCRYPTION_KEY` is set in the production environment and that the key length is what the cipher expects. Add a startup check that **fails loudly** rather than degrading to plaintext. Then either scope the copy to "sensitive fields" (accurate today) or leave it. This is the highest-consequence item in Tier 0 that is not blocked on anyone. |
| **T0-17** | Lead database committed to the repository | ⛔ | `apps/marketing/data/marketing.db` plus its `-wal` and `-shm` are tracked in git. The WAL was 1 MB against a 4 KB main file, i.e. the data lived in the WAL. Inspected on a copy: 28 lead records, **22 with a named individual contact**, sourced from `cqc-scrape` and `google-search`. **No individual email addresses** are present (`contact_email` is null throughout); the remaining data is provider names, addresses, postcodes, business phone numbers and CQC ratings. | **Opeyemi** | Add `apps/marketing/data/` to `.gitignore` and `git rm --cached` the three files. Then decide, deliberately, whether the 22 names need purging from **history** — that rewrites published commits, so it is a decision with consequences, not a cleanup. Note also that `apps/marketing` is **not** in the deploy trigger pattern (`apps/api/`, `apps/web/`, `packages/`, `deploy.sh`, `docker-compose`), so confirm it is meant to be deployed at all. |
| **T0-16** | TLS version at the public edge | ⛔ | Found 27 Sep 2026 by the marketing claim guard. Two public pages claim "TLS 1.3". Confirmed on the **outbound mail** path (Gmail headers show `version=TLS1_3`), but the web and API edge is terminated by our own nginx and has never been checked. | **Opeyemi** | Check the negotiated version against meticlecare.com. Keep "TLS 1.3" if it holds, otherwise restate as "TLS 1.2+" — the weaker claim is still a good one. |
| **T0-17b** | **Health data still crosses a border to an LLM provider** | ⛔ | Found 27 Sep 2026. All 13 AI capabilities built a JSON payload from real rows and sent it **verbatim** to OpenAI or Anthropic: service-user names, staff names, and up to 600 characters of raw daily-note and incident free text — Article 9 health data, with names attached. No `store: false`, so the provider's own abuse-monitoring retention applied on top. **Fixed 27 Sep** at the `renderPrompt` chokepoint (`ai.redaction.ts`): names → org-scoped HMAC pseudonyms, substituted into free text as well as structured fields, plus emails, phones, postcodes, DOBs and long digit runs. 23 tests, 4 mutations verified. **Still a real exposure, and this is the part that is not a bug:** the result is **pseudonymised, not anonymised**. "Client 4F2A refused medication on Tuesday" is health data about an identifiable person to anyone holding the care record, and a small agency can re-identify from context alone. | **Adetoye** to **Appoint**; **Opeyemi** implements | Three things, in order. (1) Confirm no production org has AI enabled — the default is `{"enabled": false}` and every capability is off, so the blast radius today is likely nil, and that is worth knowing before anything else. (2) Sign an Art 28 agreement with the chosen provider covering processor use, and put a UK transfer mechanism in place; MeticleCare is a **processor** and the care provider is the controller, so a controller that has not authorised this has had it done to them. (3) Decide whether raw free-text note content belongs in a prompt at all — a UK-region or self-hosted model removes the transfer entirely, and dropping free text from prompts removes the health data regardless of where the model runs. The redaction is a mitigation, not the answer. |

---

## Tier 1 — first week with real customers

| ID | Item | State | Basis | Owner | Next action |
|---|---|---|---|---|---|
| **T1-1** | Store submission blockers | ⛔ | Blocked on accounts only Adetoye can create | **Adetoye** | Apple + Play accounts **in the company's name, not personal**. ⚠️ **The first Play upload permanently fixes the upload key** — commands in `STORE_RELEASE_RUNBOOK.md`, do not improvise. Privacy forms are pre-drafted in `STORE_PRIVACY_ANSWERS.md` and need his sign-off, not engineering. Store screenshots need a booted device — the only remaining hardware gap. |
| **T1-2** | Customer support process | ⬜ | Undefined | **Adetoye** | How tickets arrive, who answers, response targets, escalation for urgent. Note: a rate-limit or "no GPS" message must not read as a fault — see T0-10. |
| **T1-3** | Incident response plan | ⬜ | Undefined | **shared** | Data breach, outage, safeguarding concern. Who decides, who tells the customer, what we say. Write before needed. |
| **T1-4** | API key rotation | ⬜ | Live keys for OpenAI, Anthropic, Stripe | **Opeyemi** | Policy + recurring calendar reminder. 2 hours. |
| **T1-4a** | Nobody is watching the deploy alerts | 🟡 | Master was red for **21 hours** (26 Sep 22:12 → 27 Sep 19:31 UTC). The cause was a two-line lint error in a web test. Every CI run failed, every deploy was correctly refused, and `notify-failure` alerted Slack and `ops@meticlecare.com` each time. Whether anyone saw it is **unknown** — the only fact is that nothing reached production until a human went looking. The guardrails worked; the response loop did not. | **Adetoye** | Find out whether those alerts were received and read. If nobody reads `ops@meticlecare.com`, move deploy failures to a channel with a named human on it, or add a check that a red master on a working day gets looked at. A correctly-failing pipeline that nobody watches is an outage you find out about from a customer. |
| **T1-5** | Rate limits verified in production | 🟡 | Now unit-tested incl. `Retry-After` behaviour and the per-recipient/per-IP distinction | **Opeyemi** | Exercise the real thresholds against staging once (see T2-4) and confirm a 429 looks right end to end. |
| **T1-5a** | NHS logo used on a commercial page | ✅ | The NHS wordmark appeared on the landing page and in the regulator row of the compliance page, beside four real regulators, implying accreditation we do not hold. NHS England restricts it to NHS bodies — a trademark problem no rewording fixes. Removed 27 Sep 2026, replaced with a text-only acronym tile, and the file is now blocked in CI by `FORBIDDEN_LOGO_REFERENCES`. | — | None for the logo. The associated **copy** claims were separate and are fixed: "integrates with NHS workflows" and "NHS DSPT-aligned controls" are both gone. |
| **T1-5b** | Regulator logos used without a permissions check | 🟡 | CQC, CIW, Care Inspectorate and RQIA marks are on the landing page and compliance page. We are a software supplier, not a registered provider, so we are not purporting to be them — but using a regulator's mark is a permissions question nobody has answered. **Deliberately not blocked in CI**: that would be an engineer settling a legal question, which is the same error as asserting a claim we cannot evidence. Logged here instead. | **Adetoye** | Check each regulator's brand guidance. If any restricts the mark to regulated bodies, remove it the way the NHS logo was. 30 minutes with the four brand pages. |
| **T1-6** | Data retention enforcement | 🟡 | The **position is published** on `/delete-account` (worker name kept; care-provider records retained) but no one has checked it is lawful, and enforcement is unverified | **Adetoye** to **Appoint**; **Opeyemi** enforces | Get the published position reviewed. If it is wrong we have published a commitment we do not meet. |
| **T1-7** | Production env audit | 🟡 | Digest-pinned images ✅, loopback-only published ports ✅, DB/Redis unpublished ✅, healthchecks ✅, restart policies ✅. **Resource limits and log rotation absent** (T0-13). | **Opeyemi** | Add `mem_limit`/`cpus`; confirm the rest of the checklist in `SECURITY_POLICY.md`. |
| **T1-8** | Connection pooling headroom | 🟡 | App pool verified: `max: 20`, statement/query timeouts, keepAlive (`shared/database/index.ts`). **No PgBouncer** — fine on one API instance, a real constraint at several. | **Opeyemi** | Not a day-one blocker. Check Postgres `max_connections` before scaling past ~4 instances. |
| **T1-9** | Redis / Socket.IO at scale | ✅ | `@socket.io/redis-streams-adapter` wired (`shared/socket/index.ts`). The CSV called this "Not Started" — wrong. | **Opeyemi** | Note `onlyPlaintext: true`; acceptable on the internal Docker network, revisit if Redis is ever exposed. |
| **T1-10** | Cookie policy accuracy | ⬜ | Written before later analytics changes | **Opeyemi** | Re-check against what actually sets cookies. |
| **T1-11** | AI output labelling | ⬜ | Unverified that every AI surface is labelled in UI **and** persisted | **Opeyemi** | 1 day. |
| **T1-12** | AI claims on public pages | ✅ | `PUBLIC_SITE_CAPABILITY_MATRIX.md` requires human review, no invented KPIs, no unevidenced certifications. ISO 27001 claim **removed** 26 Sep after the host was found to hold no such certificate. The 27 Sep sweep then **verified** rather than removed the AI copy: "AI-assisted care summaries" maps to the `manager_briefing` / `unified_intelligence` routes, which take a period and return per-item source links, so "traceable to the underlying data" holds. Twelve prompt keys ship. What the copy does *not* say, and should not start saying without a review step, is that any output is checked before use — nothing in the product checks it. | **Opeyemi** | Do not reintroduce certification claims without a certificate to cite. |
| **T1-12a** | Claim guard now actually runs in CI | ✅ | The guard existed since 26 Sep and had **never gated a build**: `ci.yml` linted and typechecked `apps/web` but ran no web tests. A guard nobody runs is a comment, and the two claims it had already found (T0-15, T0-16) were found by running it locally. Added a `Run web tests` step. This also required fixing 4 long-broken `Layout.test.tsx` tests, which had been failing for unrelated reasons: the mock returned `{ permissions: [] }` and the sidebar is fail-closed, so the page rendered with **no navigation at all** and every assertion failed for a reason unrelated to what it tested. Mutation-checked — removing the focus handler or the localStorage write fails 2 tests each. | — | None. Web suite is 160 tests / 22 files, green. |
| **T1-12b** | A test in the newly-gated suite was a calendar time bomb | ✅ | `WeeklyCallPlanner.test.tsx` hardcoded a visit on **2026-09-21** and the planner renders the *current* week. It passed for as long as that date was inside the displayed week and began failing the moment the week rolled over — **on 28 September, with nothing in the diff to explain it**, found in the first CI-gated run. Now date-relative. Wiring the suite into CI surfaced a class of failure that had been hiding precisely because nothing ran the suite. | **Opeyemi** | Four more web test files still hold hardcoded dates (`CallAssignmentBoard`, `MyEarningsPanel`, `PayrollExportPage`, `SwapTransfer`). They pass today because their components do not derive the current week, so they are not currently bombs — but they are the same pattern, and `CallAssignmentBoard` is closest to the boundary. Worth a sweep before any of them gain week-scoped behaviour. |

---

## Tier 2 — before scaling past the first few customers

| ID | Item | State | Owner |
|---|---|---|---|
| **T2-1** | Independent penetration test | ⛔ Budget ~£3–5k. Not a first-customer blocker; **is** an NHS/commissioning one. | **Adetoye** (budget) / **Opeyemi** (scope) |
| **T2-2** | Org-wide DPIA sign-off | ⛔ Depends on T0-5 | **Appoint** |
| **T2-3** | Load testing | ⬜ k6/Artillery at 50/100/200 users | **Opeyemi** |
| **T2-4** | Env-configurable rate limits | ⬜ So staging can exercise real thresholds without weakening production | **Opeyemi** |
| **T2-5** | WCAG 2.1 AA audit | ⬜ Contrast tokens are done and measured; full audit outstanding | **Opeyemi** |
| **T2-6** | Disaster recovery runbook | ⬜ Extend with the T0-2 restore procedure once proven; `apps/api/scripts/restore.sh` is the start of it but covers restore only, not the decisions (when to fail over, who declares it, what we tell clients) | **Opeyemi** |
| **T2-7** | CQC registration question | ⬜ Research: software provider vs registered provider | **Adetoye** |
| **T2-8** | CQC evidence pack test | ⬜ With real-shaped data, all five domains | **shared** |
| **T2-9** | API documentation | ⬜ | **Opeyemi** |
| **T2-10** | Landing page A/B plan | ⬜ | **Adetoye** |
| **T2-11** | Testimonials / social proof | ⬜ Ongoing — start collecting at first customer | **Adetoye** |
| **T2-12** | PVG / AccessNI scheme names and tiers confirmed | ⬜ The registry in `compliance.vetting.ts` carries basic/standard/advanced/advanced+barring for Scotland and basic/standard/enhanced/enhanced+barred for NI. These are the public tier names, but a wrong tier makes a real check look missing, so a regulated party should confirm them against current regulator guidance before a customer relies on them. | **Adetoye** |
| **T2-13** | Readiness denominator decision | ⬜ `document_compliance_rate` is the share of *held* identity documents that are valid, so it reads 100% when nobody has been checked. `background_check_coverage_rate` was added to cover that, but changing the denominator itself would move existing customer scores, which is a product decision rather than a bug fix. | **Adetoye** / **Opeyemi** |
| **T2-14** | Nation-specific rules beyond vetting | ⬜ Vetting now follows the nation. The rest of the operational layer does not: Scottish best-practice statements, the All Wales Standards, and Welsh / Scottish medication practice (MCA scope) are not modelled. Four-regulator readiness is a framework plus a background check; it is not yet four nations' worth of operational rules. | **shared** |

---

## What is verified, and when

Verification ages. Anything checked in **August 2026 or earlier** should be treated as
unverified until re-checked, because production changes underneath it.

**Verified 27 September 2026** (this pass):

- The four-nations gap is closed at the operational data layer, not just the scoring layer. The scoring layer has carried CQC, CIW, Care Inspectorate and RQIA for a while, but every query behind it counted one hardcoded list — DBS / PASSPORT / VISA / RIGHT_TO_WORK — for all four. A Scottish provider was shown as non-compliant for not holding a DBS, a document Scotland does not use, while a valid PVG certificate counted for nothing. Identity documents are now resolved per person from their own scheme (organisation default, per-person override), and both the dashboard and the readiness metric use it. Mutation-checked five ways; reverting the scoring query alone breaks 10 of the new tests.
- Because `document_compliance_rate` is a share of documents *held*, it would still read 100% for a Scottish provider holding only passports. `background_check_coverage_rate` was added so an absence counts, with a gap message that names the check the provider actually needs. The denominator change itself is T2-13.

- Email authentication end to end, on a message the application sent — SPF, DKIM, DMARC, envelope alignment.
- Backups exist, are scheduled, retain 30 days, and are written atomically.
- Redis adapter present for Socket.IO.
- Application DB pool configured with timeouts.
- Registration and email-code rate limits raised; retry behaviour tested and mutation-checked.
- Onboarding wizard tests restored (6 broken → 10 passing, incl. resume-after-abandon and load failure).
- No secrets, keys or `.env` files tracked; only `.env.example` placeholders.
- Tenant isolation enforced in the database, not only in application code.
- Docker images digest-pinned; published ports loopback-only.
- No general-purpose feature-flag system exists. The one product-level switch that does exist (`location_tracking_enabled`, T0-6) is a column with its own endpoint, not a framework — nothing else in `apps/api` can be turned off without a deploy.
- No log rotation or resource limits in the production compose file (T0-13).

**Not verified, and I could not verify from the repo:**

- Anything inside Uptime Kuma's own database (T0-4).
- Production `SMTP_*` values (T0-12).
- SSL certificate auto-renewal — HTTPS confirmed serving; the renewal mechanism is not in this repo (T2 area).
- Whether the full web test suite passes. `Layout.test.tsx` has 4 known failures from stale
  selectors; a full `vitest run` across all web tests exceeds a 10-minute cap and **has not been
  re-run end to end since the onboarding fix**. Treat the suite as unverified rather than green.

---

## Housekeeping

- **The old spreadsheet is gone.** `MeticleCare_GoLive_Readiness.csv` and `.xlsx` were removed so
  there is one list. Both are recoverable from git history if someone needs the old artefact.
- **Nothing reads those files** — no build step or script consumed them — so removing them breaks
  nothing. (Verified: no generator, no reference outside this directory.)
- **Marketing claims are now guarded by a test.** `apps/web/src/__tests__/marketingClaims.test.ts`
  fails the build when a public page claims a certification or capability we cannot evidence. It
  reads the registry in `marketingClaims.ts`, which requires each permitted claim to cite its
  evidence, and ties every *pending* claim to a tracker item **in this file** — so a claim cannot
  quietly outlive the decision meant to settle it. Adding T0-15 and T0-16 came from running it.
- **Update rule:** when an item changes state, change it here in the same commit, with the basis.
  A state change with no basis is not a state change.
- **Review cadence:** re-verify Tier 0 monthly. Tier 1 when the first customer signs. Tier 2 when
  the first three are live.
