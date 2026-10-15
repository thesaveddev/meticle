# Market readiness audit — Meticle Care

**Date:** 13 October 2026 · **Branch:** `master` (clean tree) · **Scope:** web, API, mobile, stores, go-to-market
**Method:** every claim below was checked against the repository or a live system on the date above. Where a
number or a state came from a document rather than a check, it says so.

---

## 1. Verdict

**The product is closer to market than its own documents say, and the store artefacts are further away.**

Two independent things are true at once:

- **The engineering is in unusually good shape.** Both typechecks are clean, the mobile suite is green
  (310 tests / 37 suites), the fixture-leak gate passes against a *real production bundle*, the store
  listing validates, the Play icon and feature graphic pass every published requirement, and the public
  site's claim guard passes 46 assertions. Production is up, healthy, on TLS 1.3, with HSTS and a correct
  CORS policy for real clients.
- **The go-to-market surface is not ready, and one part of it is lying.** All seven Android store
  screenshots are the *same frame* — byte-identical — while the manifest beside them records
  `playFormat.ok: true` and names seven different screens. iOS has no capture at all. The Data safety
  form cannot be generated. The store assets are gitignored, so they exist on one machine and nowhere else.

Nothing here is a reason the product cannot be sold. It is a reason it cannot be *submitted* yet, and the
gap is mostly non-engineering: legal, commercial, and a capture run on a machine with headroom.

### Scorecard

| Area | State | Basis |
| --- | --- | --- |
| Web app | ✅ Ready | typecheck clean; 58 GTM-critical tests pass; live 200 |
| API | ✅ Ready | typecheck clean; **1505 tests / 159 files green**; CORS defect found **and fixed** this audit; healthy in prod |
| Mobile app (build) | ✅ Ready | typecheck clean; 310 tests; 8 fixture markers absent from a real bundle |
| Android store listing | 🟡 Config ready, assets broken | listing validates, icon/graphic pass, **screenshots unusable** |
| iOS store listing | ⬜ Not started | no screenshots, no build, no App Privacy label |
| Play Data safety | ⛔ Blocked | template missing; needs a human decision anyway |
| Monitoring | 🟡 Present but unproven | `monitor/health_check.py` is real; whether it runs on the host is unverifiable from here |
| Backups / DR | 🟡 Backup real, restore never run | nightly `pg_dump` + WAL; **no restore has ever been performed** (T0-2) |
| Legal / commercial | ⛔ Blocked | DPA, solicitor review, PI insurance, org-wide DPIA, AI Art 28 — all open, all non-engineering |
| Security posture | 🟡 Good controls, messy headers | TLS 1.3, HSTS, RLS, MFA; duplicated/contradictory edge headers |

---

## 2. The mobile go-to-market readiness test

This is the dedicated pass the audit was asked for. Each row is something a store or a reviewer actually
gates on.

| # | Check | Result | Evidence / what to fix |
| --- | --- | --- | --- |
| 1 | Store screenshots are seven distinct screens | ❌ **FAIL** | All 7 files are byte-identical (`sha256 427eeaa5…5161b`). Recapture. |
| 2 | Screenshots meet Play's format rules | ✅ PASS | 1080×1920, 24-bit RGB, no alpha, 140 KB — within every Play limit |
| 3 | Screenshots show what the captions say | ❌ **FAIL** | `00-login.png` is the **Today** screen ("Good morning, Amara"), not a login screen |
| 4 | iOS screenshots exist | ⬜ **NONE** | `store-assets/screenshots/` has only `android/` |
| 5 | Listing copy within Play limits, no restricted claims | ✅ PASS | title 30 / short 80 / full 4000 respected; includes the non-medical-device disclaimer Play's health policy wants |
| 6 | App icon meets Play's spec | ✅ PASS | 512×512, 32-bit RGBA, fully opaque, 251 KB (`brand:check`) |
| 7 | Feature graphic meets Play's spec | ✅ PASS | 1024×500, 24-bit RGB, no alpha, 526 KB |
| 8 | Target API level | 🟡 **Per docs only** | `STORE_LAUNCH_CHECKLIST.md` records API 36 verified against a resolved manifest. Could not re-check here (no Android SDK); re-confirm on the next EAS build. |
| 9 | Permissions are minimal and declared | ✅ PASS | location coarse+fine, POST_NOTIFICATIONS only; `SYSTEM_ALERT_WINDOW` and storage permissions **blocked**; microphone set `false`; camera/photo/Face ID strings customised |
| 10 | No fixture/real care data can reach a store build | ✅ PASS | `verify:no-fixtures` built a 3983 KB production bundle: **none of the 8 fixture markers present** |
| 11 | In-app account deletion (both stores require it) | ✅ PASS | Settings → Delete my account; erases PII, retains professional attribution; 6 integration tests |
| 12 | Public web deletion URL | ✅ PASS | `/delete-account` exists, linked in the sitemap, states the retention position |
| 13 | Play **Data safety** form | ⛔ **BLOCKED** | `store/data-safety/template.csv` absent → cannot generate. Also needs the DPO sign-off recorded in `listing.json`. |
| 14 | Content rating questionnaire | ⛔ **NOT DONE** | Play Console only; no API. Blocks production. |
| 15 | Categories / contact / privacy URL | ⬜ Play Console clicks | Recorded in `listing.json consoleOnly`; no Play API resource exists |
| 16 | Reviewer access | 🟡 Decision made, real data risk | Reviewer account is the founder's own ORG_ADMIN. Safe **only while** that org holds dummy data — the docs say so and the day that changes, this must too. |
| 17 | Upload key ownership decided before first upload | ⚠️ **Irreversible** | The first bundle uploaded fixes the upload key forever. EAS holds it ("Build Credentials 1LdWOI-6iH"); losing Expo access loses the key. Decide and back it up. |
| 18 | `versionCode` / `buildNumber` in step | ✅ PASS | both `1`; `storeVersion.test.ts` fails a half-bump; `npm run bump:version` moves them together |
| 19 | Apple Privacy label + age-rating questionnaire | ⬜ Not started | Apple added social-media age-rating questions required for submissions from Sept 2026 |
| 20 | Production API base URL correct in the app | ✅ PASS | `https://meticlecare.com/api` in `app.json` `extra.apiBaseUrl` |

### The headline defect, in detail

`store-assets/screenshots/android/` holds seven files. They are the same image:

```
427eeaa5099094a78ea778a677a119e32a6183effb94f37511cf0e22a125161b  00-login.png
427eeaa5099094a78ea778a677a119e32a6183effb94f37511cf0e22a125161b  01-today.png
… the same digest for all seven
```

**Every one of them is the Today screen.** Not a blank or grey frame — a fully rendered screen with fixture
data ("Good morning, Amara", 25%, 3 actions waiting to sync, an 07:30 call). So the tour did render; the
capture photographed the same moment seven times.

Three things make this worse than it looks:

1. **The manifest asserts the opposite.** `capture-manifest.json` records seven distinct titles/captions and
   `playFormat.ok: true` with a per-file `ok: true`. Nothing in the artefact folder is wrong-looking.
2. **The docs under-describe it.** `STORE_RELEASE_RUNBOOK.md` §2 says *"the first three shots photograph one
   unrendered frame — the three files come out byte-identical — and the fourth lands on a blank screen"*.
   Reality: **all seven** are identical, and the frame is rendered, not blank. Anyone trusting that
   paragraph would expect to find three bad files and four usable ones. There are zero usable ones.
3. **Nothing could have caught it after the fact.** `store-assets/` is gitignored, so no CI step and no
   reviewer ever sees these files again.

**The gate that catches this already exists** — it was added on 4 Oct in `4edcf31` ("make the capture gate
stop lying"), one day *after* this capture. Run against the artefacts on disk today it fails:

```
FAIL  1 group(s) of identical screenshot(s): 00-login.png = 01-today.png = … = 06-offline-sync.png.
      The app did not move between these shots, so the set does not show the app.
```
`store:verify-screenshots -- --platform android` → **exit 1**.

So the fix is not code. It is one capture run on a machine with headroom (or raised dwell times in
`src/capture/shots.ts`), and then **opening the images** — which the runbook already tells you to do.

---

## 3. Findings this audit adds or corrects

### 3.1 Live production defect — found and **fixed**

**Any request carrying a disallowed `Origin` returned HTTP 500.** Reproduced against production:

| Request | Before | After (expected) |
| --- | --- | --- |
| `OPTIONS /api/health/ready` `Origin: https://evil.example.com` | **500** | 204, no ACAO |
| `GET /api/health/ready` `Origin: https://evil.example.com` | **500** | 200, no ACAO |
| `OPTIONS /api/health/ready` (no `Origin`) | 204 | 204 |

**Cause:** `apps/api/src/index.ts` rejected a foreign origin with `callback(new Error('Not allowed by CORS'))`.
`cors` forwards that to `next(err)`, so Express's terminal handler answered `500 Internal Server Error` and
logged `Unhandled error`.

**Why it matters more than it looks:** no legitimate client sends a foreign `Origin`, so every real user was
unaffected — and that is exactly why it survived. Meanwhile any bot, link unfurler, security scanner, or
**uptime check that sets the header** was recorded as a server fault. It inflates error rates, it puts a 500
where a 500 does not belong, and it is the first thing a penetration test or an NHS-style assessment reads
as unhandled errors.

**Fix:** the policy moved to `apps/api/src/shared/middleware/corsOrigin.ts` and now rejects with
`callback(null, false)` — no `Access-Control-Allow-Origin`, request completes normally, browser withholds the
response. That is what CORS is: enforced by the browser, not an error in the server. `index.ts` is now three
lines. Ten tests cover it, including express+supertest regression tests that assert **status codes**, because
asserting only the callback would not have caught this.

### 3.2 The public edge is Cloudflare, and the security headers are duplicated

`Server: cloudflare` on every response — not the nginx the tracker describes. Both layers are setting the
same headers, and they disagree:

- `x-frame-options: DENY` **and** `SAMEORIGIN`
- `x-content-type-options: nosniff` (twice)
- `referrer-policy: no-referrer` **and** `strict-origin-when-cross-origin`
- `strict-transport-security: max-age=15552000` **and** `max-age=31536000`
- **two different `content-security-policy` headers** on API responses (helmet's and nginx's)

Nothing is currently exploitable — browsers intersect multiple CSPs and take the strictest of duplicated
others — but the *effective* policy is not knowable by reading either config, and it will confuse the first
auditor who reads the headers. One layer should own each header.

**Also answered:** the TLS question. `GO_LIVE_READINESS.md` carries **T0-16 as ⛔ "never checked"**. Checked
today: **TLS 1.3** (`TLS_AES_256_GCM_SHA384`), certificate from Google Trust Services via Cloudflare, valid to
23 Dec 2026. The public pages' "TLS 1.3" claim is **accurate**, and certificate renewal is now outside the
repo (Cloudflare's), which closes the tracker's standing "renewal mechanism not in this repo" note.

### 3.3 Documentation drift — documents that contradict each other or reality

| Where | Says | Reality on 13 Oct 2026 |
| --- | --- | --- |
| `STORE_RELEASE_RUNBOOK.md` §4 | "**No build has been produced**, no device has run this, and nothing has been uploaded." | Two APKs exist (26 Sep, 3 Oct) and a compliant AAB was uploaded to the Play internal track as **draft, versionCode 1**, sha256-verified through the Play API. |
| `AGENTS.md` | "Monitoring ⚠️ Prometheus only — **no alerting**, no dashboards, no uptime checks" | `monitor/health_check.py` is a **real alerting monitor**: cron every 5 min, container status/health/restart counts, HTTP probes on `/health/live` and `/health/ready`, disk, memory, 30-min alert cooldown, and recovery emails. Uptime Kuma is also deployed. |
| `GO_LIVE_READINESS.md` T0-4 | Monitoring config is "**invisible to the repo**" | True of Kuma's database, but the repository contains its own monitor — the row should point at it, because "we have nothing" and "we have something nobody installed" need different actions. |
| `GO_LIVE_READINESS.md` T0-16 | ⛔ TLS version "has never been checked" | Checked and **passes** (TLS 1.3). Close it. |
| `AGENTS.md` | "395 tests across 44 modules" | `STORE_LAUNCH_CHECKLIST.md` says "API 650 across 92 files, mobile 103 across 15". Measured this audit: **API 1505 tests across 159 files**, **mobile 310 across 37 suites**. Four documents, four different numbers, and the newest one is also the smallest. |

This is worth stating plainly: **the drift is not dishonesty.** These documents are self-critical to a degree
rare in a codebase this size — they record their own retracted claims and mark unverified things as
unverified. The risk is the opposite of spin: the documents are careful, so they get trusted, and several
have simply fallen behind the code.

### 3.4 Store assets live only on one machine

`store-assets/` is in `.gitignore` (line 42). The Play icon, the feature graphic, the screenshots, and both
preview APKs therefore exist **only on this developer's machine**: not in version control, not in CI, not in
any backup this repository can see. `STORE_LAUNCH_CHECKLIST.md` describes them as delivered and "wired into
`app.json`", which is true locally and nowhere else. Losing this machine loses the store assets.

---

## 4. Verified green

Recorded so the audit is not only a list of problems. All commands were run for this audit.

| Check | Result |
| --- | --- |
| `apps/mobile` `tsc --noEmit` | clean (exit 0) |
| `apps/mobile` jest | **310 passed / 310, 37 suites** |
| `apps/mobile` `verify:no-fixtures` | production bundle 3983 KB, **none of 8 fixture markers present** |
| `apps/api` `tsc --noEmit` | clean (exit 0) |
| `apps/api` full vitest suite | **1505 passed / 1505, 159 files, exit 0** (333 s) — includes the 10 new CORS tests |
| `apps/web` `tsc --noEmit` | clean (exit 0) |
| `apps/web` claims + headers + palette guards | **58 passed** (marketingClaims 46, securityHeaders 6, paletteAudit 6) |
| `npm run store:validate` | listing valid (6 actionable notes) |
| `npm run brand:check` | icon + feature graphic pass every Play requirement |
| `npm run brand:test` | 9/9 |
| `npm run design:check` / `design:test` | up to date; 23/23 |
| `https://meticlecare.com` | 200; HTTP→HTTPS 301; HSTS present |
| `https://meticlecare.com/api/health/ready` | `{"status":"ok","database":"connected"}` |
| TLS | 1.3, valid cert to 23 Dec 2026 |
| CORS for the real origin | 204 preflight with correct ACAO/methods/headers; foreign origin leaks no ACAO |

---

## 5. Prioritised fix list

### P0 — blocks the first paying customer or a store submission

1. **Recapture the seven screenshots until they are seven distinct images.** The gate is already in place
   (`npm run store:verify-screenshots`) so it cannot silently regress again. Then open them — the runbook's
   own rule, and the one that was skipped.
2. **Obtain `store/data-safety/template.csv` from Play Console** and generate the Data safety CSV. It cannot
   be fabricated: the question identifiers are undocumented, and a wrong one makes Play reject the file
   silently. Required for production; internal testing is exempt.
3. **Answer the content rating questionnaire** and set categories/contact in Play Console (`listing.json`
   `consoleOnly` has the values ready).
4. **Decide and back up the upload key** — irreversible on first upload. EAS currently holds it.
5. **Confirm no production org holds real data** before the reviewer account (the founder's own ORG_ADMIN)
   is used. The moment it does, this must become a throwaway login.
6. **Decide iOS scope.** Android-first is a legitimate answer; shipping both means screenshots, an App
   Privacy label, an age-rating questionnaire, and a macOS build that has never been attempted.
7. **Legal/commercial, all Adetoye or a hire:** standalone DPA (T0-9), solicitor review of Terms + Privacy
   (T0-8), PI insurance (T0-7), organisation-wide DPIA (T0-5), and the AI Art 28 / transfer basis (T0-17b).
   The last one is enforced in code as a fail-closed gate — which is correct, and also means AI cannot be
   sold until it is signed.
8. **Confirm the lawful basis** for retaining a worker's professional name after deletion. It blocks the
   Data safety answer and is the position published on `/delete-account`.
9. **Confirm where production data actually lives** before the "stored in the United Kingdom" claim stays on
   the privacy policy Play reads.

### P1 — do before or in the first week with customers

10. **Get `store-assets/` under version control** (or an explicit, documented backup), so the store assets
    are not single-machine.
11. **Deduplicate the edge security headers** so one layer owns each one.
12. **Prove monitoring works:** confirm `monitor/health_check.py` is installed and cronned on the host, that
    Uptime Kuma has monitors, and that an alert reaches a **phone**. An untested monitor is not monitoring
    (T0-4). Note the script **silently skips email** when SMTP configuration is incomplete — it logs the
    skip and continues, which is the same failure mode as no monitoring at all.
13. **Fix the documentation drift** in §3.3 — runbook §4, the AGENTS.md monitoring and test-count lines, and
    T0-4 / T0-16.
14. **Run the backup restore drill** (T0-2). Backups are verified real; a restore has never been performed,
    so RTO/RPO are targets, not measurements.
15. **Backfill PII encryption in production** (`npm run backfill:pii-encryption`), then take on clinical free
    text as its own piece of work (T0-15). Do not do it half-way.
16. **Apply T0-13 to the live host** and confirm log rotation and resource limits with `docker inspect`.
17. **Ship the mobile release that the carer-facing location work is waiting on.** T0-6a/6b/6c/6f/6g are all
    server-side complete and **gated on an EAS build that has not been cut**. Until it is, a carer's phone may
    still ask for a location the API then discards, and the notice text in the shipped build still contains a
    claim that was corrected in v1.2.

### P2 — before scaling past the first few customers

18. Independent penetration test (T2-1) — an NHS/commissioning requirement, not a launch one.
19. WCAG 2.1 AA audit (T2-5) — contrast tokens are done, the audit is not.
20. Load testing and the PgBouncer question before running more than one API instance (T2-3, T1-8).
21. Decide whether public API docs are wanted at all (T2-9); Swagger is deliberately off in production.
22. Close the Class 2 claim-register items — regulator and legal claims that cannot be traced to a source
    from inside the repository (T2-24, T2-28, T0-6k/T2-30 for Ireland).

---

## 6. What I could not verify

Stated so nobody mistakes absence of evidence here for evidence of absence.

- **No device or emulator was run.** The screenshot findings are from the bytes on disk; I did not execute the
  capture tour, so I cannot say *why* the app did not move between shots. The runbook's own explanation
  (slow boot on this machine) is plausible and unconfirmed.
- **iOS is entirely unverified.** No macOS, so no `xcrun`, no simulator, no `eas build` for iOS.
- **The full web test suite did not run.** It exceeds a 10-minute budget on this machine — a limitation the
  readiness docs already record. I ran the three GTM-critical files (58 tests), not the whole suite.
- **Play and Apple console state is invisible** without credentials: Data safety, content rating, categories,
  reviewer access. `STORE_LAUNCH_CHECKLIST.md`'s Play API checks (Oct 2) are the most recent evidence and I
  could not refresh them.
- **The production host is invisible.** Whether the health monitor is installed and cronned, whether Uptime
  Kuma has monitors or alert contacts, whether backups actually run on schedule, whether T0-13's limits were
  applied, and whether the organisation holds only dummy data are all facts about the server, not the repo.
- **`targetSdkVersion` 36** is taken from the launch checklist's record of a resolved manifest. I had no
  Android SDK to re-derive it.
- **Certificate details** are those presented at the edge today; per-protocol and cipher support across all
  clients was not enumerated.

---

## 7. One-line summary for each audience

- **For a store submission:** Android config is done and the assets are not; iOS has not started; the Data
  safety form is blocked on a template and a legal decision.
- **For a customer:** the product works and production is healthy; the monitoring and backup story needs one
  hour of proof, and the legal papers are not signed.
- **For an investor or an assessor:** the capability is real and unusually well-evidenced; the missing half is
  commercial — no customers, no LOIs, no pilot, and no committed funds.
- **For engineering:** one real bug was found and fixed (CORS 500), the store gate was strengthened, and the
  remaining work in the tracker is honest and mostly not code.
