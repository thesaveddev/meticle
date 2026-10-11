# Mica demo recording — blocked, needs your input

You asked me to record the Mica demo video now that it's verified working. I checked the stack first; the recording itself is blocked on something only you can supply.

## What I found

| Component | Status |
|---|---|
| Web dev server | ✅ Running on `localhost:5173` (HTTP 200) |
| API dev server | ✅ Running on `localhost:3002` (responds, proxies wired) |
| Postgres | ✅ Listening on 5432 |
| **Database contents** | ❌ **Completely empty — 0 users, 0 organizations** |

The dev servers are healthy, but there's nothing to log in as: the database has no accounts at all. [.env](apps/api/.env) doesn't carry `SEED_PASSWORD`/`SEED_ADMIN_EMAIL`, and by design the seed script ([seed-orbis.ts](apps/api/src/scripts/seed-orbis.ts)) refuses to run without an operator-supplied password (min 12 chars) — demo credentials are deliberately never committed to source.

## Options to unblock

1. **Give me a demo password** (12+ chars) and an admin email to seed with — I'll run `SEED_PASSWORD=… SEED_ADMIN_EMAIL=… npx tsx src/scripts/seed-orbis.ts`, log in, enable the Natural-language Assistant flag, and record the demo. Note this creates a real loginable account in the dev database.
2. **You already have a password from a previous seed run** on another database — tell me the details and I'll use it.
3. **Skip the recording and write out the demo script** instead — a click-by-click flow (login → dashboard → open Mica orb → ask a question → care-note draft → approve) for you to walk through yourself on camera.

One more thing that will matter either way: a *guided* Mica demo of actually asking questions or generating care notes needs a working LLM configured on the org's `ai_config` in the seeded org — if the OpenAI key isn't set in the seed, the AI features will error and the recording will only show the UI shell (orb, overlay, mic UX). Tell me whether to configure a provider key for the demo, or restrict it to the UI shell.

## Tell me

Which option (1, 2, or 3), plus the password/email if option 1, and whether to configure an AI provider for the demo org.
