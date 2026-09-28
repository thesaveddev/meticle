# API key rotation policy

**Owner:** Opeyemi (rotation execution) · **Accountability:** Adetoye (vendor accounts)
**Created:** 28 September 2026 · **Review:** every 6 months, or immediately after any suspected exposure
**Tracker:** T1-4 in `GO_LIVE_READINESS.md`

## Why this exists

Live API keys exist for OpenAI, Anthropic and Stripe, and until now there was no
recorded policy for rotating any of them. A key that never rotates is a secret
whose compromise is undetectable by design: nothing looks wrong when a stolen
credential is quietly used. Rotation bounds the window in which a leaked key is
worth anything, and doing it on a calendar means the *first* time anyone performs
the procedure is not during an incident.

## The register

Every secret with external scope lives here. If a secret is not in this table it
either has no rotation story or the table is out of date — both are findings.

| Secret | Where it lives | Rotate every | Last rotated | How to rotate |
|---|---|---|---|---|
| OpenAI API key | `.env` `OPENAI_API_KEY`, per-org `ai_config.apiKey` | 180 days | *(never — set initial date on first rotation)* | §1 below |
| Anthropic API key | `.env` `ANTHROPIC_API_KEY`, per-org `ai_config.*` fallback | 180 days | *(never)* | §1 below |
| Stripe secret key + webhook secret | `.env` `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | 180 days | *(never)* | §2 below |
| Postgres `APP_ROLE_PASSWORD` / `POSTGRES_PASSWORD` | `.env`, docker-compose env | 180 days | *(set date)* | §3 below |
| `FIELD_ENCRYPTION_KEY` | `.env` | **Special** — see note | *(set date)* | §4 below |
| JWT signing secret | `.env` | 180 days | *(set date)* | §5 below |
| SMTP password | `.env` `SMTP_PASS` | 180 days | *(set date)* | Vendor's console |

The `Last rotated` column is the point of the table. Fill it in on the day each
secret is rotated; a row that has never been rotated is a row with a date missing,
not a row that is fine.

## Cadence and triggers

Rotate **every 180 days**, and **immediately** on any of:

- a suspicion or confirmation that a key was committed, logged, screenshotted, or
  sent to anyone outside the two named owners;
- a departure or role change of anyone with vendor-console or production-server
  access;
- an unexpected key usage pattern in a vendor's dashboard (usage you cannot
  attribute to a deploy or a feature is a finding, not a curiosity);
- a vendor-side disclosure affecting the account.

Rotation-on-a-calendar and rotation-on-trigger are both mandatory; the calendar
exists because triggers only work when someone notices the trigger.

## Procedures

### 1. OpenAI / Anthropic

1. Create the **new** key in the vendor console first. Do not revoke the old one
   yet — this is what makes the rotation zero-downtime.
2. Add the new key to `.env` alongside the old (e.g. `OPENAI_API_KEY_NEW`).
3. Deploy or restart the API with the new key in place. `AIRepository.getConfig`
   reads per-org config at request time, so orgs configured through Settings
   (encrypted in `organizations.ai_config`) are unaffected by the env change.
4. Verify: run one AI action through the web UI and confirm it appears in the
   vendor's usage dashboard.
5. Only then revoke the old key in the vendor console, and remove any lingering
   env reference.
6. Update the register's `Last rotated` date.

Org-configured keys (customer-supplied, stored encrypted) are rotated by the
customer through Settings → AI; our register only covers keys *we* hold.

### 2. Stripe

1. In the Stripe dashboard, **roll** the secret key (Stripe keeps the previous
   key live for a grace window — use it; do not create a second restricted key
   and leave both active indefinitely).
2. Update `STRIPE_SECRET_KEY` in `.env` and restart.
3. Roll the webhook secret in the same pass and update
   `STRIPE_WEBHOOK_SECRET`; webhook signatures fail closed, so a stale secret
   silently disables every subscription event until fixed.
4. Make one test-mode and one live-mode payment through staging before declaring
   the rotation done.
5. Update the register.

### 3. Postgres passwords

The compose file wires `APP_ROLE_PASSWORD` into the app connection string and
`POSTGRES_PASSWORD` into the migrate/admin path. Change the password in Postgres
*first* (`ALTER ROLE meticle_app PASSWORD '...'` for each role), then update
`.env`, then restart the stack. The reverse order produces an outage; the same
order done as two separate restarts produces none. Because both roles are used
by long-lived pools, schedule the restart (this is a T0-3a-style restart window).

### 4. `FIELD_ENCRYPTION_KEY` — rotation is NOT a simple re-encrypt

This key encrypts columns in the database (see T0-15). Rotating it naively makes
every existing ciphertext undecryptable. Rotation requires a dual-key reading
period: add `FIELD_ENCRYPTION_KEY_OLD`, decrypt-and-re-encrypt rows in batches,
drop the old key only when no row still depends on it. **Do not rotate this key
as part of a routine pass** — schedule it as its own change with its own test.
If the key itself is believed compromised, that is an incident (see
`SECURITY_POLICY.md`), and the rotation plan above is executed with the incident
timeline attached.

### 5. JWT signing secret

Rotating the JWT secret signs out every active session — that is the point when
the trigger is "suspected compromise", and an outage-sized annoyance when it is
the calendar. For calendar rotation, introduce the new secret as a *secondary*
verification key for one release (verify against either), then flip signing to
the new key in the next release, then drop the old. If we have not built
dual-key verification by the first calendar rotation, accept the sign-out and
do it in a quiet window rather than skipping the rotation.

## After any rotation

1. Update the register in this file — the date, not "recently".
2. Confirm the old credential shows as revoked/inactive in the vendor console.
3. Check the vendor dashboard 24 hours later for failed-auth noise: a burst of
   failures against the old key usually means a consumer was missed.
4. Note the rotation in the deploy log so the timeline in an incident review can
   be reconstructed.

## What would make this policy real rather than paperwork

The register above with real dates. An endorsement assessor will not ask
"does a policy exist" — they will ask "when was each key last rotated" and
compare against the stated cadence. The first calendar rotation should be
diarised the day this policy is adopted, and the second exactly 180 days later.
