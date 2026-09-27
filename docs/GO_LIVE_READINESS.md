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
| **T0-2** | Backup restore test | 🟡 | Backups **verified real**: `backup` service in `docker-compose.prod.yml`, nightly `pg_dump` 02:00, 30-day retention, atomic tmp→rename. WAL archiving now **configured** (`archive_mode=on`, `archive_command`, `archive_timeout=300` on the `db` service) and `backup.sh` fails the job if archiving stalls — but **no restore has ever been run.** | **Opeyemi** + access decision from **Adetoye** | Run the drill: `PG_IMAGE=<digest-pinned image> ./apps/api/scripts/restore.sh`. It builds a **disposable** container, never touches the live DB, and refuses to run without an explicit image. Needs prod DB access — Opeyemi gets credentials, or Adetoye runs the commands and sends output, or screen share. A green drill is not proof of the *right* point in time: check the `people` row counts the script prints against a known-good marker. See also T0-3a. |
| **T0-3** | Public backup claim accuracy | ✅ | `FeaturesPage.tsx:321` corrected 27 Sep. Was claiming "Point-in-time recovery"; we had a nightly dump and **no WAL archiving** (`archive_command`/pgbackrest/wal-g all absent), so the strongest true claim was being made. Now states daily snapshots / 30-day retention only. | **Opeyemi** | Do not re-add "point-in-time" or "restore-tested" until each is true. PITR is now *configured* but unproven, so the marketing guard (`apps/web/src/__tests__/marketingClaims.ts`) still forbids both. Configuration is not capability. |
| **T0-3a** | Postgres restart window for WAL archiving | 🟡 | `db.command` in `docker-compose.prod.yml` now sets `archive_mode`/`wal_level`/`archive_command`/`archive_timeout`. These are `postmaster`-level, so **the existing container must be recreated** before any archiving happens — and the old container never archived a segment. | **Opeyemi** (execute) + **Adetoye** (pick the window) | Applying this is a **brief production outage**, not a rolling restart. Agree a low-traffic window with Adetoye first, then `docker compose -f docker-compose.prod.yml up -d db` and confirm `SHOW archive_mode;` returns `on`. Until this lands, T0-2's archiving half is inert. |
| **T0-4** | Uptime monitoring actually works | 🟡 | Uptime Kuma **is deployed** (`docker-compose.prod.yml`, loopback-bound — good). Whether any monitor or alert contact exists is **invisible to the repo**; it lives in Kuma's own DB. | **Adetoye** | 30 min: log in, confirm a monitor on the site and API, confirm alerts go to a **phone**, then fire a test alert. A monitor that has never fired is untested. Also agree a break-glass phone number (not email). |
| **T0-5** | Organisation-wide DPIA | 🟡 | `DPIA_Live_Active_Visit_Map.md` exists but assesses **one feature**, authored by engineering. No org-wide DPIA. Required under UK GDPR Art. 35 for health data at scale. | **Adetoye** to **Appoint** a DPO | Commission. The feature DPIA is a genuine head start. |
| **T0-6** | Live Map DPIA contains a false statement | ⛔ | DPIA §6 claims the organisation "can disable the live map feature per-location". **No toggle exists** — no feature-flag system anywhere in `apps/api`. A customer signing this signs a claim about a capability we lack. | **Opeyemi** | Fix the document, and decide whether to build the kill switch or drop the claim. Highest-urgency item here that is not blocked on anyone. |
| **T0-7** | PI insurance | ⬜ | Nothing in repo; organisational purchase | **Adetoye** | ~1 week to arrange. Ask about cyber liability too. |
| **T0-8** | Terms + Privacy solicitor review | ⬜ | Both written by engineers | **Adetoye** to **Appoint** | Solicitor reviews enforceability/indemnity for health/social care software. Send edits to Opeyemi to implement. |
| **T0-9** | Standalone DPA | ⬜ | Terms reference a DPA; no such document exists. A care home signing as data controller will ask for it. | **Adetoye** to **Appoint**; **Opeyemi** implements | Author it, then wire the in-product flow to it. |
| **T0-10** | Signup works for a whole care home at once | ✅ | Registration 5→30 per 15 min (`auth.routes.ts`), verification codes 5→10/min, password resets 5→20/hr. Client now waits out a per-IP 429 via `Retry-After` instead of erroring (`withRateLimitRetry`). 18 tests, mutation-checked. | **Opeyemi** | Done 27 Sep. Per-recipient caps (3 codes/15min) deliberately untouched — see the code comment. |
| **T0-11** | Email authentication (SPF/DKIM/DMARC) | ✅ | Gmail `Authentication-Results` on a message **the application sent**: `dkim=pass header.i=@meticlecare.com header.s=x`, `spf=pass`, `dmarc=pass`. Envelope aligned (`Return-Path: <security@meticlecare.com>`, Google's own `smtp.mailfrom`). Evidence in `EMAIL_SECURITY_RUNBOOK.md` steps 2 and 6. | **Opeyemi** | Leave `p=quarantine` alone — its precondition is now met. |
| **T0-12** | `SMTP_USER` off the previous vendor's domain | ⬜ | Production value is `caredesk@reydesk.com`. Verified to be **only** the SMTP auth username — it reaches no header. | **Adetoye** | Create `app@meticlecare.com`, follow §7.8.1 of `SECURITY_POLICY.md` (AUTH/MAIL/RCPT pre-flight, record the old value first). Unblocked by T0-11. Hygiene, not a security fix. |
| **T0-13** | Docker log rotation | 🟡 | 6 services have `restart: unless-stopped`, but **no `logging:` block and no `max-size` anywhere** in `docker-compose.prod.yml`. | **Opeyemi** | Add a `json-file` size/count cap per service. Unbounded logs fill the disk, and a full disk stops writes — an availability *and* a data-integrity failure on a database holding health records. |
| **T0-14** | QA / UAT pass | 🟡 | `MeticleCare_QA_UAT_Test_Pack.xlsx` (381 cases) not executed. Onboarding wizard tests were dead and are now fixed; 4 known failures remain in `Layout.test.tsx` (stale selectors, not a product bug). | **shared** | Opeyemi fixes the 4 stale Layout selectors. Adetoye walks the pack manually — he is the one who will use the product without a developer sitting next to him. |
| **T0-15** | **Encryption at rest actually enabled in production** | ⛔ | Found 27 Sep 2026 by the marketing claim guard. Column-level encryption is real (`pgcrypto`, and `apps/api/src/shared/utils/encryption.ts` uses aes-256-gcm over an HKDF per-tenant key), and two public pages advertise "encrypted at rest (AES-256)". But `getMasterKey()` returns an **empty buffer** if `FIELD_ENCRYPTION_KEY` is unset, `encryptField()` then returns the plaintext **unchanged**, and the only signal is a log warning reading "PII columns are stored in plaintext". Whether the key is set on production **cannot be seen from the repo**. | **Opeyemi** | Confirm `FIELD_ENCRYPTION_KEY` is set in the production environment and that the key length is what the cipher expects. Add a startup check that **fails loudly** rather than degrading to plaintext. Then either scope the copy to "sensitive fields" (accurate today) or leave it. This is the highest-consequence item in Tier 0 that is not blocked on anyone. |
| **T0-17** | Lead database committed to the repository | ⛔ | `apps/marketing/data/marketing.db` plus its `-wal` and `-shm` are tracked in git. The WAL was 1 MB against a 4 KB main file, i.e. the data lived in the WAL. Inspected on a copy: 28 lead records, **22 with a named individual contact**, sourced from `cqc-scrape` and `google-search`. **No individual email addresses** are present (`contact_email` is null throughout); the remaining data is provider names, addresses, postcodes, business phone numbers and CQC ratings. | **Opeyemi** | Add `apps/marketing/data/` to `.gitignore` and `git rm --cached` the three files. Then decide, deliberately, whether the 22 names need purging from **history** — that rewrites published commits, so it is a decision with consequences, not a cleanup. Note also that `apps/marketing` is **not** in the deploy trigger pattern (`apps/api/`, `apps/web/`, `packages/`, `deploy.sh`, `docker-compose`), so confirm it is meant to be deployed at all. |
| **T0-16** | TLS version at the public edge | ⛔ | Found 27 Sep 2026 by the marketing claim guard. Two public pages claim "TLS 1.3". Confirmed on the **outbound mail** path (Gmail headers show `version=TLS1_3`), but the web and API edge is terminated by our own nginx and has never been checked. | **Opeyemi** | Check the negotiated version against meticlecare.com. Keep "TLS 1.3" if it holds, otherwise restate as "TLS 1.2+" — the weaker claim is still a good one. |

---

## Tier 1 — first week with real customers

| ID | Item | State | Basis | Owner | Next action |
|---|---|---|---|---|---|
| **T1-1** | Store submission blockers | ⛔ | Blocked on accounts only Adetoye can create | **Adetoye** | Apple + Play accounts **in the company's name, not personal**. ⚠️ **The first Play upload permanently fixes the upload key** — commands in `STORE_RELEASE_RUNBOOK.md`, do not improvise. Privacy forms are pre-drafted in `STORE_PRIVACY_ANSWERS.md` and need his sign-off, not engineering. Store screenshots need a booted device — the only remaining hardware gap. |
| **T1-2** | Customer support process | ⬜ | Undefined | **Adetoye** | How tickets arrive, who answers, response targets, escalation for urgent. Note: a rate-limit or "no GPS" message must not read as a fault — see T0-10. |
| **T1-3** | Incident response plan | ⬜ | Undefined | **shared** | Data breach, outage, safeguarding concern. Who decides, who tells the customer, what we say. Write before needed. |
| **T1-4** | API key rotation | ⬜ | Live keys for OpenAI, Anthropic, Stripe | **Opeyemi** | Policy + recurring calendar reminder. 2 hours. |
| **T1-5** | Rate limits verified in production | 🟡 | Now unit-tested incl. `Retry-After` behaviour and the per-recipient/per-IP distinction | **Opeyemi** | Exercise the real thresholds against staging once (see T2-4) and confirm a 429 looks right end to end. |
| **T1-6** | Data retention enforcement | 🟡 | The **position is published** on `/delete-account` (worker name kept; care-provider records retained) but no one has checked it is lawful, and enforcement is unverified | **Adetoye** to **Appoint**; **Opeyemi** enforces | Get the published position reviewed. If it is wrong we have published a commitment we do not meet. |
| **T1-7** | Production env audit | 🟡 | Digest-pinned images ✅, loopback-only published ports ✅, DB/Redis unpublished ✅, healthchecks ✅, restart policies ✅. **Resource limits and log rotation absent** (T0-13). | **Opeyemi** | Add `mem_limit`/`cpus`; confirm the rest of the checklist in `SECURITY_POLICY.md`. |
| **T1-8** | Connection pooling headroom | 🟡 | App pool verified: `max: 20`, statement/query timeouts, keepAlive (`shared/database/index.ts`). **No PgBouncer** — fine on one API instance, a real constraint at several. | **Opeyemi** | Not a day-one blocker. Check Postgres `max_connections` before scaling past ~4 instances. |
| **T1-9** | Redis / Socket.IO at scale | ✅ | `@socket.io/redis-streams-adapter` wired (`shared/socket/index.ts`). The CSV called this "Not Started" — wrong. | **Opeyemi** | Note `onlyPlaintext: true`; acceptable on the internal Docker network, revisit if Redis is ever exposed. |
| **T1-10** | Cookie policy accuracy | ⬜ | Written before later analytics changes | **Opeyemi** | Re-check against what actually sets cookies. |
| **T1-11** | AI output labelling | ⬜ | Unverified that every AI surface is labelled in UI **and** persisted | **Opeyemi** | 1 day. |
| **T1-12** | AI claims on public pages | ✅ | `PUBLIC_SITE_CAPABILITY_MATRIX.md` requires human review, no invented KPIs, no unevidenced certifications. ISO 27001 claim **removed** 26 Sep after the host was found to hold no such certificate. | **Opeyemi** | Do not reintroduce certification claims without a certificate to cite. |

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

---

## What is verified, and when

Verification ages. Anything checked in **August 2026 or earlier** should be treated as
unverified until re-checked, because production changes underneath it.

**Verified 27 September 2026** (this pass):

- Email authentication end to end, on a message the application sent — SPF, DKIM, DMARC, envelope alignment.
- Backups exist, are scheduled, retain 30 days, and are written atomically.
- Redis adapter present for Socket.IO.
- Application DB pool configured with timeouts.
- Registration and email-code rate limits raised; retry behaviour tested and mutation-checked.
- Onboarding wizard tests restored (6 broken → 10 passing, incl. resume-after-abandon and load failure).
- No secrets, keys or `.env` files tracked; only `.env.example` placeholders.
- Tenant isolation enforced in the database, not only in application code.
- Docker images digest-pinned; published ports loopback-only.
- No feature-flag system exists — established while auditing the Live Map DPIA (T0-6).
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
