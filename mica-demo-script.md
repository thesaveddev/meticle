# Mica Demo Script — click-by-click, recordable as written

Grounded in the live UI: [MicaFab.tsx](apps/web/src/components/mica/MicaFab.tsx),
[MicaOverlay.tsx](apps/web/src/components/mica/MicaOverlay.tsx),
[useMica.ts](apps/web/src/components/mica/useMica.ts),
[LoginPage.tsx](apps/web/src/pages/auth/LoginPage.tsx), and the seed login naming in
[seed-orbis.ts](apps/api/src/scripts/seed-orbis.ts). Every label typed below is the real
text the running app shows.

**Login for every actor:** `firstname.lastname@orbisgroup.care` — password `Password123$`
(the password you supplied; the seed script accepts it, since it meets the 12-char
minimum).

> The dev DB was empty at time of writing, so the first step of any recording session is
> seeding (Step 0). It's a one-off — subsequent replays skip it.

---

## Step 0 — one-time seed (off camera, ~2 min)

```bash
cd apps/api
SEED_PASSWORD='Password123$' \
SEED_ADMIN_EMAIL='admin@orbisgroup.care' \
npx tsx src/scripts/seed-orbis.ts
```

When it finishes it prints the confirmation you're looking for:
`✓ "<random org name>" DEMO SEEDED SUCCESSFULLY` and
`Org admin login: james.mercer@orbisgroup.care (password: the SEED_PASSWORD you supplied)`.

**Optional but worth 30 seconds:** if you also want Mica's AI features (ask-a-question,
care-note drafting, task drafting) to work in the recording, sign in as
`james.mercer@orbisgroup.care`, go to **Settings → AI Integration**, enter a real OpenAI
API key, and make sure the **Natural-language Assistant (Mica)** toggle is on. Without
this, Mica will still open, listen, and draft against stored records — but any reply that
needs the LLM will say "Mica could not reach the AI service. Check AI settings."

---

## Act 1 — Sign in & land on the dashboard (~20s)

1. Open the browser to `http://localhost:5173`.
2. You should already be on the **Sign in** page — page title reads "Sign in",
   supporting text "Access your MeticleCare account."
3. Type into **Email address**: `james.mercer@orbisgroup.care`
4. Type into **Password**: `Password123$`
5. Click **Sign in**.
6. You'll land on the role-based dashboard for the ORG_ADMIN — notice the Mica orb
   floating bottom-right of every authenticated page.

> Say on camera: "This is MeticleCare — our care-management platform. This round icon,
> bottom-right, is Mica, our voice-first care assistant."

## Act 2 — Tap the orb, open the overlay (~15s)

1. Click the Mica orb (bottom-right).
2. It swaps for a **full-screen overlay**: dimmed dashboard behind, a live waveform orb
   in the middle, and the sub-line **"MICA is listening…"** with a hint
   **"Tap to cancel · Esc"**.
3. A **"Who is this about?"** person picker appears near the orb (auto-focuses).
4. Choose **Elsie Fletcher** from the picker.

> Say on camera: "Mica is listening. I can pick who this is about first, so the note
> lands on the right person's record."

## Act 3 — Speak (or type) a care note (~30s)

Pick **one** of these, whichever you prefer on camera:

**A. Speak it** — hold the mic and say, in a normal voice:

> "Elsie was cheerful at breakfast this morning, ate all of her porridge, and asked twice
> about her daughter's visit this weekend."

Mica's browser speech-recognition transcribes live into the overlay; transcription also
shows as your transcript.

**B. Type it into the box** labelled roughly:

> "Type instead of speaking — questions, notes or tasks"

This keyboard path exists for quiet rooms and hearing-impaired users; it runs through the
**exact same** intent pipeline as the mic, so what you see next is identical either way.

When you finish, the overlay moves to **"MICA is thinking…"**, then **"MICA is
responding…"**. Mica reads back a short spoken summary of the drafted care note. (If the utterance was
actually a question — ending in "?" or phrased as one — Mica routes it to the
question-answering flow instead and answers it, rather than drafting a note.)

## Act 4 — Ask Mica a question instead (~30s)

1. Tap the orb again to restart.
2. Pick **Elsie Fletcher** (same person) or leave it unset.
3. Say or type:

> "Who supported Elsie on the night shift yesterday?"

Mica turns to a read-only tool-calling flow (it runs SELECT queries only — never a
write), pseudonymises names before the LLM sees them, then answers back in 1–3 sentences
using real data from the org's records.

> Say on camera: "Notice — Mica is read-only when asked a question. She can *look up*
> anything: who's on shift, who supports a person, medication rounds, expiring training.
> She never writes without asking first."

## Act 5 — Draft, don't write: the confirm-before-persist card (~40s)

1. Tap the orb a third time.
2. Say or type:

> "Priya Sharma's medication training expires next month"

(no person picker needed for this shape — it's an implicit task, not a care note)

3. Mica replies with a **draft summary**, spoken and shown in the response card —
   something like a reviewable task draft referencing Priya Sharma's medication training.
   Importantly: **nothing is saved yet.** Drafts surface on the review card in the
   overlay; only a deliberate tap on the review card persists the task.
4. Open Settings → AI Integration while this is on-screen if you want to demonstrate
   compliance — the **"What is sent to the AI provider"** panel and the per-feature
   **"what is sent"** expanders on every AI toggle show exactly which record types Mica
   touches.

> Say on camera: "This is the good part. Mica drafted a medication-training renewal task
> just from me speaking — the review card is showing it. Nothing hit the database yet.
> I confirm it myself. Voice alone never writes."

5. Click the confirm action on the review card. The task lands in **Tasks**;
   navigate to it to show it saved for real.

## Act 6 — Close (~10s)

Hit **Esc** (or "Tap to cancel") with the overlay open — the overlay dismisses and the
floating orb comes back.

> Say on camera: "That's Mica — voice-first care notes, read-only questions, and
> draft-then-confirm actions, with every data boundary published, not promised."

---

## Shot checklist (if using a screen recorder)

- [ ] Record at `localhost:5173`, browser window 1440×900 or 1920×1080
- [ ] Text visible → any "MICA is listening" state needs your mic **unmuted** in the
      recorder if you want to narrate — Mica also speaks replies via TTS, so capture
      system audio too, not just mic audio
- [ ] Acts 3 and 5 are the two money shots: care-note draft, and the confirm card
- [ ] Do Act 5 before showing the Settings panel so the "what is sent" reveal feels like
      a closer, not a setup
- [ ] Re-shoot note: Esc-to-cancel is snappy; keep takes ≤5s if you fluff a line

## Repeatable takes without resetting the world

- Care notes and questions can be repeated for **any** seeded person — the seed script
  created 18 people across 3 locations, so a bad take doesn't dirty anything; just switch
  the picker to a different person and go again.
- Act 5's task can repeat too, on different staff (e.g. swap Priya Sharma for another
  staff `firstname.lastname@orbisgroup.care` from the seed roster).

## Troubleshooting one-liners

| Symptom | Cause | Fix |
|---|---|---|
| "Mica needs Chrome or Edge for voice" | Non-Chromium browser | Open in Chrome or Edge; or use the type box (same pipeline) |
| Mic denied permission toast | OS or browser blocks mic | Allow site mic access in browser settings; reload |
| "Mica could not reach the AI service. Check AI settings." | Org's `ai_config` has no provider key, or NATURAL_LANGUAGE_ASSISTANT toggle off | Settings → AI Integration → add key; or use the type path to see draft text anyway |
| "Mica conversation store unavailable" | Rare — Redis wedge; in-memory fallback should have caught it | Retry once |
| Login rejected | Seed not run, or wrong domain | Re-run Step 0; confirm email is `firstname.lastname@orbisgroup.care` |

## One-command dry run (types your way through the whole script)

If you'd rather not speak during a take, run it as a typed-path demo — same pipeline,
silent-friendly for screen recording:

1. Open orb → pick person → **type** the care-note sentence into the box
2. Open orb → type the question "Who supported … on the night shift yesterday?"
3. Open orb → type "Priya Sharma's medication training expires next month"

Step 2 and 3 each produce voice (spoken) replies even on the typed path — TTS still
speaks responses back, so this combo works great for a takes-without-talking shoot.
