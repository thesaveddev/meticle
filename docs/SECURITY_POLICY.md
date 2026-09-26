# Security operations policy

Evidence for a Cyber Essentials self-assessment, and the operating document for
the controls it describes. Written from the actual configuration, not from
intent: every "as implemented" line below was read out of the repository or
observed in production, and every gap is stated rather than smoothed over.

Last reviewed: September 2026. Next review: September 2027, or sooner after any
security incident or material change to the estate.

---

## 1. Scope

Covers the Meticle Care production estate: the API, the web application, the
PostgreSQL database, Redis, and the infrastructure host that runs them. Client
devices and staff laptops are out of scope and belong to the organisation's
endpoint management, which is a separate control (see §6).

## 2. Boundary firewall

**As implemented.** Every published container port binds to `127.0.0.1` in
`docker-compose.prod.yml`. The database and Redis publish no ports at all and
are reachable only on the internal `meticle` Docker network. The only component
exposed to the internet is the nginx reverse proxy, which fronts the application
and proxies `/api/`, `/socket.io/` and `/files/` to the API container. Uptime
Kuma is bound to loopback and reached through the proxy only.

**Traffic filtering.** The public entry point is Cloudflare. Requests carry
`X-Real-IP`, `X-Forwarded-For` and `X-Forwarded-Proto` from the proxy.

**Outstanding.** Two items are configuration *outside* this repository and are
tracked as actions:

| Item | Why it matters | Status |
| --- | --- | --- |
| Origin IP reachable directly | If the host answers on its own IP, Cloudflare's filtering is bypassed and any IP allowlist is defeated | **Verify before Plus** |
| Host firewall (ufw/nftables) | Container binding is not a host firewall; SSH should be restricted to known sources | **Verify before Plus** |

Both are answered with evidence, not assumption, in the self-assessment. A scan
of the origin will reveal the first one immediately.

## 3. Secure configuration

**Secrets.** Every credential required by the application is declared with
`${VAR:?message}` in `docker-compose.prod.yml`, so the stack refuses to start
rather than falling back to a default. `JWT_SECRET` and `JWT_REFRESH_SECRET` are
rejected at boot if absent or under 32 characters. Secrets live in a `.env` on
the host, which is not in the repository, and are injected by the deploy
workflow from GitHub environment secrets.

**Diagnostic endpoints.** `/metrics` returns 404 in production unless
`METRICS_SECRET` is set, and requires that secret when it is. `/health/email`
returns 404 unless `HEALTH_EMAIL_SECRET` matches. Both fail closed rather than
open. `/api/docs.json` and `/api/docs` are **not** served in production unless
`SWAGGER_ENABLED=true`; they were previously unconditional and have been closed.

**File serving.** Documents are served through authenticated routes only.
Tenant isolation is enforced in SQL — `WHERE d.id = $1 AND u.organization_id = $2`
— so a cross-organisation request returns 404 rather than 403 and does not
confirm that a document exists. Private files resolve their owning organisation
first and return 403 on mismatch. Path traversal is blocked by resolving the
requested path and confirming it remains within the upload directory. SVG
responses are forced to `attachment`, which removes the stored-XSS vector that
inline SVG would otherwise create. Content types come from an allowlist, never
from user input.

**Demo and seed data.** `seed-orbis.ts` refuses to run when `NODE_ENV=production`
unless `ALLOW_DEMO_SEED=true` is set explicitly. `seed-team.ts` accepts a
`SEED_TEAM_PASSWORD` override. All seed hashes use bcrypt cost 12. The
workflow-driven demo seed runs only on manual dispatch, executes the script from
the reviewed checkout rather than a mutable remote ref, and no longer triggers on
a branch push.

**Residual risk accepted.** `seed-team.ts` still defaults to a published
password. It is retained because it is a documented bootstrap path for a fresh
deployment; deployments carrying real care data must set
`SEED_TEAM_PASSWORD` or delete the seeded accounts.

## 4. Access control

**Authentication.** JWT access tokens with rotating single-use refresh tokens.
Refresh tokens are held in `httpOnly`, `secure` (in production) cookies with
`sameSite=lax`, so they are not readable from JavaScript.

**Multi-factor.** Available and enforced per user. Progressive lockout applies:
three failed MFA attempts trigger a one-hour block.

**Rate limiting.** Applied per route at the API boundary: registration 5 per 15
minutes, login 10 per 15 minutes, MFA verification 10 per minute, backup codes 3
per minute, refresh 10 per minute. nginx does not rate limit; the application
does, and the limits are per endpoint rather than global.

**Account enumeration.** Knowing which addresses have accounts on a care platform
is worth something: it is a list of the staff who hold client records, on the
domains whose mail the organisation is trusted to send. Every unauthenticated
auth endpoint therefore answers identically for a registered address and an
unregistered one.

`forgot-password` was already correct and returns the same message either way.
Two endpoints were not, and were corrected on 26 September 2026:

| Endpoint | Was | Now |
| --- | --- | --- |
| `/auth/send-email-code` | `409 An account with this email already exists` | Always `200 Verification code sent`. The code is still sent |
| `/auth/login` | `403 Your account has been deactivated` for a deactivated account, `401` for an unknown one — distinguishing existence without comparing a password | `401 Invalid email or password` in both cases |

The login change costs a deactivated user the message telling them who to
contact. The account is equally unusable either way and the administrator
already knows, so the disclosure is not worth it.

`apps/api/src/test/authEnumeration.test.ts` asserts this contract, including
that `forgot-password` does not drift.

| Required | Why | Status |
| --- | --- | --- |
| `/auth/register` must require a verified email code server-side | It returns `400 An account with this email already exists`, and `registrationSchema` carries no verification code — so the duplicate error is currently an oracle with no proof of mailbox ownership. Disclosure is only safe once the caller has proved they own the address, which is the state the client enforces and the server does not | **Open — a change to the signup contract, not a one-line edit** |
| Timing equalisation on `/auth/login` | An unknown address returns before any password hash comparison, so response time distinguishes it from a known one even with identical bodies | Not done |

**Least privilege and tenant isolation.** PostgreSQL row-level security enforces
organisation boundaries in the database itself. The application connects as
`meticle_app`, a separate role that cannot bypass RLS; migrations run as a
distinct superuser credential. A defect in application code therefore cannot
expose another tenant's data, which is the single most important control in this
system given it holds health data.

**Password storage.** bcrypt, cost factor 12.

## 5. Patch management

**As implemented.** All four long-running images in `docker-compose.prod.yml`
are pinned by digest (`@sha256:`), not by tag. What is deployed is exactly what
was reviewed, and a rebuilt image cannot silently differ. The API and web images
are built in CI and published to a registry as immutable artifacts; deployment
promotes a digest rather than rebuilding.

**Automation.** Dependabot is configured for npm and GitHub Actions on a weekly
schedule, opening grouped pull requests. This was added after an audit found 14
high-severity and 22 moderate advisories in production dependencies with nothing
surfacing them automatically.

**Targets.**

| Class | Target |
| --- | --- |
| Critical or actively exploited advisories | 48 hours |
| High-severity advisories in production dependencies | 14 days |
| All other security updates | 30 days |
| Routine dependency updates (via Dependabot) | 30 days |

**Outstanding.** High-severity production advisories fell from 14 to 11. Closed
so far:

| Package | Advisory | Fix |
| --- | --- | --- |
| axios | Prototype pollution in auth sub-fields can inject Basic auth credentials | 1.20.0 |
| multer | Denial of service via deeply nested field names | 2.4.0 |

The remaining 11 are **not yet closed**, and two cannot be closed by a version
bump at all:

| Package | Why it is still open |
| --- | --- |
| `xlsx` | **No fix exists.** 0.18.5 is the last version published to npm; SheetJS now distributes only from its own CDN. Used in one place, `apps/web/src/pages/staff/StaffDirectoryPage.tsx`, to read and write staff spreadsheets. Accepted risk for now; the honest options are replacing it with a maintained library or removing the import/export feature. |
| `nodemailer` | Fix is in 10.x; a major bump from 9.x, so it needs its own testing pass rather than a lockfile refresh. |
| `vite` | Fix is in 8.x from 5.x, a dev-only dependency. It does not ship to production, so it is not a production exposure. |
| `brace-expansion`, `browserslist`, `fast-uri`, `js-yaml`, `nanoid`, `shell-quote`, `socket.io-parser`, `undici` | Transitive. `npm overrides` was tried for each and npm retained the older versions to satisfy dependents, so forcing them is a per-package exercise rather than a blanket one. |

`npm audit fix` at the repository root was tried first and made things worse —
14 advisories became 16 including a new critical in `expo`, because it reshuffled
the lockfile across the monorepo. The lockfile was reverted. Updating direct
dependencies deliberately, one at a time, is the approach that works here.

**Action list.**

1. Replace or remove `xlsx`; it has no upgrade path.
2. Take `nodemailer` to 10.x as a tested change.
3. Work the remaining transitive advisories package by package.
4. Confirm the Dependabot schedule is producing pull requests and that they are
   being reviewed weekly.

**Reviewer:** _unassigned — assign a named owner_
**Last dependency review:** September 2026
**Next:** October 2026

## 6. Malware protection

The preventive control is endpoint antivirus on staff devices and on the host.
Neither can be evidenced from this repository, so the control is split below
into what is genuinely in place, what the owner must answer, and what the
organisation is relying on in the meantime.

| Leg | Required answer | Status |
| --- | --- | --- |
| Staff device antivirus / MDM | Managed, definition updates automatic | **Owner to confirm** |
| Server malware protection | Whether the host runs AV beyond OS patching | **Owner to confirm** |
| Email filtering | Inbound filtering and attachment scanning | **Owner to confirm** |
| Removable media policy | Whether the estate permits it | **Owner to confirm** |

**Evidence an assessor will ask for.** A screenshot of the AV console showing
the product, the last successful scan and the definition date; the MDM enrolment
list showing every device that can reach production data; and a dated note
confirming the host is or is not covered. A statement that antivirus is
"enabled" without a definition date and a last-scan date is not evidence.

### 6.1 Compensating controls — server estate

These reduce the likelihood of malware reaching the server and the damage it
would do if it did. They do not detect malware, and they are accepted as
compensating measures only for the server leg. They compensate for nothing on
the staff-device leg: a compromised laptop holding a care record is not made
acceptable by anything on this list, so the device antivirus row above is a
genuine requirement, not a formality.

| Control | As implemented |
| --- | --- |
| Digest-pinned images | Every image in `docker-compose.prod.yml` is a `sha256` digest, including PostgreSQL, Redis and Uptime Kuma. The application images are passed as `${WEB_IMAGE:?}` and `${API_IMAGE:?}` and the stack refuses to start without them, so a tag cannot silently become a different build |
| Minimal base | `node:20-alpine` and `nginx:alpine`. The API runtime stage installs one package (`tini`) and nothing else |
| Production dependency resolution | `npm ci --omit=dev` in the runtime stage, so the shipped tree is the reviewed lockfile and not a fresh resolution of semver ranges |
| No execution of user content | The application never evaluates uploaded content. Documents are stored, never opened in-process, and SVG is served as `attachment` (§3) specifically to remove the stored-XSS path |
| No inbound code path | The only thing the internet can hand the API is request data. There is no deserialisation of remote objects, no template evaluation, and no `eval` of request content |
| Least privilege at the data layer | PostgreSQL row-level security with a non-superuser application role (§4) means a foothold in the application tier does not automatically become access to another tenant's records |
| Continuous review | Dependabot and the CI gate (§5) mean the dependency set that carries the interpreter's instruction set is reviewed weekly |

### 6.2 Limits of the compensating controls

Stated plainly so this section is not read as more than it is:

- **No detection.** None of the above will identify malware that is already
  running. That is what an antivirus product is for, and on the server leg it
  is currently unanswered.
- **Node is an interpreter.** It executes code by design. The mitigation is that
  untrusted input is never evaluated as code and that the third-party code it
  does execute is lockfile-pinned and dependency-reviewed; it is not that the
  interpreter is inert.
- **Two known weaknesses in the chain.** `apps/web/Dockerfile` runs
  `npm install` rather than `npm ci`, and the API runtime stage runs
  `npm install pino-pretty` after `npm ci --omit=dev`. Both resolve fresh from
  the registry instead of the reviewed lockfile. Tracked in §5 and to be closed.
- **The host itself is unmeasured.** Container hardening constrains what runs
  inside a container. It says nothing about the host kernel, its packages, or a
  process started outside Compose.

## 7. Email authentication and anti-spoofing

Meticle Care sends care records, password resets and account-recovery mail from
`@meticlecare.com`. Anyone able to send mail claiming that domain can phish a
carer into handing over credentials or a resident's details, and there is no
technical control that stops them unless the receiving server is told to check.
This section is the record of those checks. The work list to close them out is
`docs/EMAIL_SECURITY_RUNBOOK.md`.

**Verified against public DNS on 26 September 2026** (authoritative nameservers
`ziggy.ns.cloudflare.com`; transport is MXRocket, `MX 10 safari.mxrouting.net`):

| Record | Value found | Verdict |
| --- | --- | --- |
| SPF | `v=spf1 include:mxroute.com -all` | Correct. Authorises the sending provider and nobody else; `-all` is a hard fail, not a soft fail |
| DMARC | `v=DMARC1; p=none; rua=mailto:dmarc-reports@meticlecare.com` | **Monitoring only.** Reports are collected and nothing is enforced |
| DKIM | `x._domainkey.meticlecare.com` — `v=DKIM1;k=rsa`, 2048-bit RSA public key | Present and resolving. Selector is `x` |
| MTA-STS / TLS-RPT | Not checked | Unknown |
| BIMI | Not checked | Unknown |

**A published DKIM record is not a signed message.** The record is the public
half; the signature is applied by the sending service at the moment it hands
the message to the receiving server. The record can be perfect, the key can be
in the panel, and outbound mail can still go out unsigned — if signing is not
enabled for the sending account, or if mail leaves by a different route. Only
`Authentication-Results` on a received message proves the signature is applied.
That check is still outstanding and is the last thing standing between this
domain and `p=quarantine`.

### 7.1 Why `p=none` is the wrong resting state

With `p=none` the policy is advisory. A receiving server that honours DMARC
collects a report and delivers the message anyway, because the policy tells it
to take no action. An attacker can therefore send as `@meticlecare.com` today
and the message lands in the inbox, marked "not authenticated" at best.

Moving to `p=quarantine` with `pct=100` is the correct next step, and it is
strictly better than `p=reject` for a first enforcement step because a
misconfigured legitimate sender lands in spam, where someone will notice and
report it, rather than being silently discarded.

### 7.2 DKIM is the prerequisite, not the follow-up

**Do not move to `p=quarantine` until a received message is confirmed to carry
`dkim=pass`.** The public key is published (§7, verified 26 September 2026),
which is the necessary half. The half still unproven is that MXRocket actually
signs with it. SPF alone is not sufficient, for two reasons:

1. **Alignment.** DMARC passes when SPF *or* DKIM passes *and* is aligned with
   the visible `From:` domain. A forwarding service or mailing list that sends
   on the organisation's behalf passes SPF for *its own* domain, which does not
   align with `meticlecare.com`. DKIM survives forwarding; SPF does not. Any
   mail that passes through a forwarder — an NHS trust mail relay, a shared
   inbox, a support tool — will fail SPF alignment and, under `p=quarantine`,
   will start landing in spam for real staff.
2. **Gmail and Yahoo.** Since February 2024 both require bulk senders to publish
   a DMARC record of at least `p=quarantine` *and* have both SPF and DKIM
   aligned, or they bulk-spam the sender. Publishing `p=quarantine` without DKIM
   meets the letter of that rule and fails its purpose.

The DKIM record resolves at selector `x`, so the alignment property is
available. What is unproven is that it is used. Sending a message and reading
`Authentication-Results` (§7.3) settles it in one step.

### 7.3 Confirming DKIM from a real message

This is the only reliable test, and it takes one email. Two obstacles, both
found by trying them on 26 September 2026:

**The password-reset form cannot be used to test it.** `forgotPassword` looks up
the user and returns the same non-enumerable message whether or not an account
exists, so it sends nothing to an unregistered address. That is correct — it is
what stops the endpoint confirming which addresses have accounts — but it means
a throwaway address produces a cheerful "check your inbox" and no email.

**mail-tester.com is refused.** `send-email-code` rejects disposable domains,
and its MX lookup catches `srv1.mail-tester.com` even though that domain is not
in the package list. Also correct behaviour.

What works is `POST /api/auth/send-email-code` to a real address you control, so
the application sends a genuine message to a real receiving server:

1. `POST /api/auth/send-email-code` with an address you own that is not already
   registered. No account is needed.
2. Mail is **queued**, not sent inline — the request enqueues and a worker
   delivers. Allow a minute.
3. Read `Authentication-Results` on receipt: Gmail *Show original*, Outlook
   *View message details*.
4. `dkim=pass` with `d=meticlecare.com` and `s=x` is the answer we need.
   `dkim=none`, `dkim=fail`, or no DKIM line at all means the key is not used.
5. The same header should show `spf=pass` and `dmarc=pass`.

A hand-written message from the sender's own mailbox does not count: it travels
the mailbox's path, not the application's.

**Why DKIM matters more here than SPF.** Until §7.8 the transport set no
`envelope` or `sender`, so `MAIL FROM` was whatever `SMTP_USER` authenticated
as and MXRocket could rewrite `Return-Path` to its own bounce domain. The
envelope is now pinned in code, so SPF alignment no longer depends on a
credential. A provider may still rewrite the return path in transit, and only
the received `Return-Path` proves what went on the wire — which is why step 2
remains a gate rather than a formality.

### 7.8 The envelope sender is pinned, and a stale one was found

**What changed.** `buildMailOptions` now sets `envelope: { from }` to the same
address as the visible `From:`, and a queued row's sender always wins. Alignment
is therefore structural rather than incidental: the two addresses share a domain
by construction and no credential can quietly change it. Bounces return to the
mailbox for that category, which is where the team that cares is already looking.

**What was found while fixing it.** The `SMTP_FROM` fallback — used only when a
queued row somehow has no sender — resolved to `***REMOVED***`, an
unrelated vendor domain left over from a previous integration. Any message that
took that path would have asserted a domain this organisation does not control:
DMARC alignment fails, and every recipient learns which other company runs the
system. `resolveSender` now honours `SMTP_FROM` only when it is on the
organisational domain and refuses it loudly otherwise, falling back to an aligned
default. The value is a free-form secret, so constraining it in code is the only
place this can be enforced.

**Boot check.** `index.ts` logs an error naming any `SMTP_FROM_*` category that
does not share the organisational domain, and confirms the domain when all are
aligned. A misconfiguration is then visible in the logs at deploy rather than in
a spam folder later.

| Required | Why | Status |
| --- | --- | --- |
| Confirm `DEPLOY_SMTP_FROM` in production is on the organisational domain | It is a free-form GitHub secret; the code now refuses an off-domain value, but the secret should still be correct | **Owner to confirm** |
| Remove the stale `SMTP_FROM=***REMOVED***` from the local dev env | Leftover from a previous vendor; discloses an unrelated third party if used | **Owner to confirm** |
| Confirm no queued rows exist with a null `from_email` | The fallback path should be unreachable in practice | **Owner to confirm** |

### 7.4 Outstanding

| Required | Why | Status |
| --- | --- | --- |
| DKIM public key published | Prerequisite for any enforcement policy | **Done — `x._domainkey`, verified 26 Sep 2026** |
| DKIM signing confirmed on real outbound mail | A published key that is never used protects nothing | **Blocked — one message to mail-tester.com** |
| Staff replies signed for the organisational domain | See §7.6 — a reply from a personal mailbox fails DMARC and is indistinguishable from a spoof | Not started |
| DMARC moved to `p=quarantine; pct=100` | Makes receivers act on failures | **Change made 26 Sep 2026; still resolving as `p=none`** |
| Then `p=reject` after a clean reporting period | Refuses spoofed mail outright | Not started; requires a quarantine period first |
| `dmarc-reports@meticlecare.com` mailbox exists | Reports are sent by the receiving server; without the mailbox they are discarded or bounce | **Confirmed 26 Sep 2026** |
| `v=spf1 -all` at `dmarc-reports.meticlecare.com` | Stops the report mailbox itself being spoofed, and stops report spam being treated as spam | Not set |
| `ruf=` pointing at a human-readable aggregate service | `rua` delivers compressed XML attachments that nobody reads unaided | Not set |
| MTA-STS and TLS-RPT | Stops an active attacker downgrading the session to plaintext in transit | Not set |
| Weekly review of DMARC reporting | A policy nobody reads is `p=none` with extra steps | Not started |
| Aligned envelope sender (`MAIL FROM`) | DMARC SPF alignment fails if the envelope sender is not `@meticlecare.com` | **Fixed** — pinned to the visible sender in code; see §7.8. `DEPLOY_SMTP_FROM` still to be checked in production |
| A spoof test from a domain we do not own | Proves the policy is actually enforced rather than merely published | Not run |

**Note on the change made on 26 September 2026.** The DMARC record was edited
from `p=none` to `p=quarantine; pct=100` with the report address unchanged. At
the time of writing the public record still resolves to `p=none`, which is
expected within the 300-second TTL and the resolver caches, but it must be
re-checked before it is treated as in force. More importantly, §7.2 applies:
this change should not stand until DKIM is confirmed.

### 7.5 Where the reports go, and how they are read

Reports are delivered to `dmarc-reports@meticlecare.com` as gzipped XML
attachments, one per receiving organisation per day, and are unreadable without
a parser. They are not notifications; they do not arrive one per spoofed
message, and an empty inbox means "nobody reported anything", which is not the
same as "nothing was spoofed".

Monitoring is done by a reporting service that parses the XML and presents
sources, counts and alignment failures: Cloudflare Email Security (already on
the same account as the DNS), Valimail, or dmarcian. The service address goes in
a `ruf=` tag alongside `rua=`. The raw `rua` mailbox is then retained as the
assessor's evidence that reporting is switched on and pointed somewhere real.

**Review cadence.** Weekly during the quarantine period: any source reported
against `meticlecare.com` that is not MXRocket is an active spoofing attempt
and is treated as a security incident in its own right. After a clean quarter,
move to `p=reject`.

### 7.6 Where organisational mail is sent from, and what that means

**Confirmed 26 September 2026:** the organisation runs on neither Microsoft 365
nor Google Workspace. All `@meticlecare.com` mail — staff replies included — is
handled by MXRocket, the same provider that hosts the MX record and sends the
application's mail. There is one sending path, and it signs.

This is the favourable answer, and it is worth being precise about why. A member
of staff replying from a phone or a laptop, authenticating with their
`@meticlecare.com` mailbox credentials over IMAP and SMTP, produces a message
that leaves through MXRocket and is signed with the `x` key at
`d=meticlecare.com`. That is aligned, so it passes DMARC. Enforcing
`p=quarantine` therefore does **not** catch the organisation's own staff mail,
which was the specific risk that made enforcement feel unsafe.

It is worth recording that this was checked rather than assumed. A staff member
who instead configures a personal Microsoft or Google account to *send as*
`@meticlecare.com` would produce exactly the failure described above — signed by
`d=outlook.com`, unaligned, quarantined, and indistinguishable from an attack to
the recipient. The difference is entirely which credentials authenticate the
outgoing session.

| Item | Position |
| --- | --- |
| Staff replies from the MXRocket mailbox | Signed and aligned. Passes DMARC. No action |
| Office provider DKIM (365 / Google) | **Not applicable** — neither is in use. No second signer needed |
| Staff send-as a personal account | Would fail DMARC. Prohibited by the rule below |
| Client-side forwarding to a personal address | **Would fail DMARC.** See below — this is the real residual risk |
| Third-party tools sending on the domain | Unknown. Each needs its own DKIM or it will be quarantined |

**The residual risk is forwarding, not replying.** A mail-client rule that
forwards a copy to a personal address re-sends the message from that provider.
The copy carries `From: @meticlecare.com` and arrives signed by the forwarding
service, unaligned — and it is sent *by the organisation's own mailbox*, so it
looks entirely legitimate to the recipient. DMARC `p=quarantine` will quarantine
it, which is the correct outcome, but the underlying habit is worth prohibiting
rather than relying on the policy to absorb.

| Required | Why | Status |
| --- | --- | --- |
| Staff send as `@meticlecare.com` only from the MXRocket account | The only path that stays signed | **Policy to issue** |
| No client-side auto-forwarding to personal addresses | Forwards leave as unaligned mail from a trusted sender | **Policy to issue** |
| No personal account configured with send-as for the domain | Would fail DMARC and be indistinguishable from an attack | **Policy to issue** |
| Inventory of third-party tools sending as the domain | Each needs its own DKIM, or it will be quarantined | **Owner to confirm** |
| Weekly report review for legitimate senders being failed | Distinguishes misconfiguration from attack | Not started |

**Concentration risk, stated plainly.** Because MXRocket is the sole path for
all organisational mail, it is now a single point of failure for the entire
anti-spoofing posture: if their signing is disabled, misconfigured, or
unavailable, every `@meticlecare.com` message in the country fails DMARC at
once. That is a consequence of the consolidation, accepted because the
alternative — several providers each needing their own key and alignment — is
materially more complex for a small organisation. It is the reason step 2 of
`docs/EMAIL_SECURITY_RUNBOOK.md` matters more than it would in a split setup:
the confirmation is not just about our mail, it is about our only mail path.

### 7.7 Reducing the single-provider risk

The realistic failure modes are not the ones a second provider would help with,
so they are worth separating before spending money on the wrong one.

| Failure | Would a second authorised sender help? | What actually helps |
| --- | --- | --- |
| MXRocket silently disables DKIM signing | No | Monitoring. Step 2 plus weekly report review catches it within days; nothing architectural catches it faster |
| MXRocket has an outage | **Yes** | A second sender in DNS, and a break-glass contact route that does not use email |
| Our SPF or DKIM record is deleted or overwritten in error | **Yes** | A second signer means one mistake is not total |
| Staff cannot reach each other during an outage | No | A documented phone or in-person route. A business-continuity control, not a mail control |

**The one mitigation worth doing.** Authorise a second sending provider in DNS
now, without switching to it. Two records:

1. A second DKIM public key (CNAME) for a low-cost transactional provider —
   Amazon SES, Postmark or similar.
2. Extend SPF, keeping the hard fail last:

   ```
   v=spf1 include:mxroute.com include:<second-provider> -all
   ```

   SPF permits ten DNS lookups; this uses two, so there is ample headroom. The
   trailing `-all` must stay, or the record stops being a policy and starts
   being a suggestion.

With that in place, an MXRocket outage becomes a one-line `SMTP_HOST` change
against a provider whose key is already published and aligned — a config
rollback, not a DNS project worked out under pressure.

**Two honest caveats.** Publishing a CNAME for a provider that has not been
provisioned is inert, so provision the account first; the DNS record does
nothing on its own. And this does not make MXRocket optional for *reading* mail
— staff mailboxes are still there, so an outage stops both sending and
receiving. The break-glass route is still needed, and it is the part that
actually protects a care organisation.

## 8. Backups

**As implemented.** A `backup` container runs `pg_dump` daily at 02:00 via
crond. The script writes to a temporary file and renames on success, so a
partial dump can never appear as a valid backup; it removes its temporaries on
failure and exits non-zero. Backups are retained for 30 days. Dumps use
`--clean --if-exists --no-owner --no-privileges` and are therefore portable
across hosts.

**Outstanding — this is the significant one.** `backup_data` is a named volume
in the same Compose project as `postgres_data`. The backup is on the same disk,
the same host and the same failure domain as the database it protects. Disk
failure, accidental `docker compose down -v`, or a compromised host destroys both
together. A schedule is not a backup.

| Required | Why | Status |
| --- | --- | --- |
| Off-host copy of every dump | Survives loss of the host and volume | **Not implemented** |
| A tested restore | Proves the dump is usable, not merely present | **Not implemented** |
| Restore recorded in writing | Assessor evidence | **Not implemented** |

**Target:** encrypted off-host copy of every dump within 30 days, and at least
one full restore verified per quarter, recorded here.

**Last verified restore:** _never_
**Next verification:** _not scheduled_

## 9. The three principles

**Understanding the business.** This document, the asset inventory below, and
`docs/STORE_LAUNCH_CHECKLIST.md`. The organisation holds special category data
— health information about identifiable people — so the consequence of failure
is assessed accordingly.

**Securing the business.** Backups (§8), the deploy pipeline, and the release
gate that refuses to deploy a commit which has not passed CI.

**Staying secure.** Dependency review (§5), Dependabot, email authentication
(§7), and annual review of this policy. Incident response and security awareness
training are organisational and are owned outside the engineering team.

## 10. Asset inventory

| Asset | Type | Location | Data | Owner |
| --- | --- | --- | --- | --- |
| API | Container | Cloud VPS (region to confirm) | Special category — health data | Engineering |
| Web | Container | Cloud VPS | Public + auth | Engineering |
| PostgreSQL | Container | Cloud VPS | Special category — health data | Engineering |
| Redis | Container | Cloud VPS | Session and queue state | Engineering |
| Backups | Volume | Cloud VPS | Special category — health data | Engineering |
| Cloudflare | SaaS | Edge | Request metadata, TLS termination | Engineering |
| Object storage | SaaS | Provider | Documents | Engineering |
| Outbound email | SaaS (MXRocket) | SMTP relay, `safari.mxrouting.net` | Recipient addresses, care-record content in documents | Engineering |
| Inbound email domain | DNS + SaaS | `meticlecare.com`, Cloudflare DNS | Reputation; spoofing exposure | Engineering |
| DMARC report store | SaaS | `dmarc-reports@meticlecare.com` | Metadata about senders claiming our domain | Engineering |

The hosting provider holds no ISO 27001 certification that could be cited, which
is why no such claim is made anywhere in public copy. Provider certification
evidence is being obtained as part of the hosting migration; see the runbook.
