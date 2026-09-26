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

This control is organisational and cannot be satisfied from the repository.

| Item | Answer required | Status |
| --- | --- | --- |
| Staff device antivirus / MDM | Managed, definition updates automatic | **Owner to confirm** |
| Server malware protection | Whether the host runs AV beyond OS patching | **Owner to confirm** |
| Email filtering | Inbound filtering and attachment scanning | **Owner to confirm** |
| Removable media policy | Whether the estate permits it | **Owner to confirm** |

On the server side the compensating controls are: a minimal container image
(`node:20-alpine`, `nginx:alpine`), no unnecessary packages, digest-pinned
dependencies, and a web application that does not execute uploaded content —
SVG is served as an attachment for exactly this reason.

## 7. Backups

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

## 8. The three principles

**Understanding the business.** This document, the asset inventory below, and
`docs/STORE_LAUNCH_CHECKLIST.md`. The organisation holds special category data
— health information about identifiable people — so the consequence of failure
is assessed accordingly.

**Securing the business.** Backups (§7), the deploy pipeline, and the release
gate that refuses to deploy a commit which has not passed CI.

**Staying secure.** Dependency review (§5), Dependabot, and annual review of this
policy. Incident response and security awareness training are organisational and
are owned outside the engineering team.

## 9. Asset inventory

| Asset | Type | Location | Data | Owner |
| --- | --- | --- | --- | --- |
| API | Container | Cloud VPS (region to confirm) | Special category — health data | Engineering |
| Web | Container | Cloud VPS | Public + auth | Engineering |
| PostgreSQL | Container | Cloud VPS | Special category — health data | Engineering |
| Redis | Container | Cloud VPS | Session and queue state | Engineering |
| Backups | Volume | Cloud VPS | Special category — health data | Engineering |
| Cloudflare | SaaS | Edge | Request metadata, TLS termination | Engineering |
| Object storage | SaaS | Provider | Documents | Engineering |

The hosting provider holds no ISO 27001 certification that could be cited, which
is why no such claim is made anywhere in public copy. Provider certification
evidence is being obtained as part of the hosting migration; see the runbook.
