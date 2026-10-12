# Mica voice-phrasing test — "schedule a task" / "book podiatry"

**Date:** 9 Oct 2026 · **Env:** live dev API (`:3002`), org `Mica Test Org` (user's real OpenAI key) · Method: the same HTTP calls the web overlay makes (`useMica.ts` → `/ai/mica/ask` and `/ai/mica/actions`).

## How Mica actually routes phrases (two doors)

1. **Frontend intent regex** (`useMica.ts` → `detectActionIntent`) matches the transcript *before* any AI call:
   - Task: needs a creator verb **(create|add|make|set|remind me about/to|schedule|book|arrange) AND** a task noun **(task|reminder|to-do|todo)**.
   - Appointment: needs **(book|schedule|arrange|add) AND** an appointment noun **(appointment|visit|clinic|check-up|review)**.
   - Training-expiry phrasing is a third implicit task intent.
   - No match → sent to `/ai/mica/ask` (read-only Q&A).
2. **Server** drafts the write (`200 { draft: true }`) or asks a clarification (`400` with a spoken prompt), and never persists until `/ai/mica/actions/confirm`.

## Results — the phrases requested

| Carer says | What the regex does | Result |
|---|---|---|
| "schedule a task" | hits task regex | `400` clarification: *"What should the task be called? Say or type a short title."* ✅ good |
| "schedule a task check the fire doors" | hits task regex | draft ✅ → confirm ✅ `200 {confirmed, taskId}` |
| "book podiatry" | **misses** appointment regex — "podiatry" is not in the noun list → goes to `/ask` | LLM says *"I will start the care-note flow to record the request for a podiatry appointment"* ❌ wrong flow (it is an appointment, not a note) |
| "book a podiatry appointment" | hits appointment regex ("book" + "appointment") | ✅ correct door |

## E2E confirm flow (both actions)

- Task draft→confirm: 200/200; task row created; `mica.task_confirmed` event published (from the earlier verified work) → assignee notification.
- Appointment: needs date+time; "book podiatry for tomorrow at 2pm" + `startTime` → draft speaks *"I've prepared 'Podiatry appointment' on Saturday 10 October at 23:15"* → confirm 200, appointment row created. **Note the timezone quirk below.**

## Phrasings Mica misses (the list for the carer's feedback)

1. **"book podiatry"** — no appointment-noun word; routed to Q&A which replies with the care-note flow (misflight). Fix: add `podiatry|chiropody|dentist|optician|gp|doctor|hairdresser` (common clinic words) to the appointment regex, or fall back to the LLM for intent.
2. **"put podiatry in the diary"** — "put"/"diary" absent from both verb and noun lists → care-note-flow misflight from `/ask`.
3. **"schedule fire door check"** — task noun missing ("check" is not "task") → care-note-flow misflight.
4. **"can you put a task in for the fire doors"** — "put a task in" doesn't match verb list ("put" missing) → care-note misflight.
5. **"remind me podiatry Friday"** — "remind me" needs "about/to" after it, and no task noun → wrong door.
6. **Person-resolution:** *"Joyce's podiatry is due"* → `/ask` correctly reports no person named Joyce in this org (correct — Q&A is read-only, but the phrasing may have been intended as a write).

## Root cause & recommendation

The client-side regex is a closed vocabulary. Phrases with real care-world words ("podiatry", "diary", "check") slip through to the question answerer, whose system prompt only says to "start the care-note flow" for writes — so it mislabels appointment/task intents as care notes, audibly wrong.

**Recommended (small, high value):** let `/ai/mica/ask` return a structured `writeIntent: { action: 'CREATE_TASK' | 'CREATE_APPOINTMENT', utterance }` field when the LLM detects a write, and have `useMica` route on that instead of only its regex. That is the single change that makes every miss above work with no frontend vocabulary to maintain. Alternatively, widen the regex with the clinic words in item 1 and verbs "put (a task in)|diary|check".

**Also worth fixing:** the appointment draft's "tomorrow at 2pm" came out as *23:15 UTC* because the test passed a UTC `startTime`; when the frontend extracts times it must send the carer's local wall-clock, or better, let the server parse the raw utterance ("tomorrow at 2pm") directly instead of requiring the client to pre-resolve times.

**Stats:** 6 `/ask` misroutes, 2 regex hits, 2 full draft→confirm successes (1 task, 1 appointment), 0 unexpected 5xx.

---

## Status — what shipped since this pass

Recorded here because the recommendations above are now partly built, and a test
note that still reads as a wish list is worse than no note.

### 1. The settle fallback (shipped 11 Oct, commit `01dfccb`)

The recommendation above was taken in its stronger form. Instead of the client
widening its regex, `POST /ai/mica/settle` (`ai.controller.ts → micaSettle`)
classifies an utterance the regexes missed with one small LLM call and returns
`{ intent: { action, utterance, title, personName } }`, which `useMica.ts` routes
on. The model is constrained to `CREATE_APPOINTMENT | CREATE_TASK | none` and is
told to answer `none` for everything else, so the fallback can only choose among
registered write actions — it cannot invent a fifth, and it never writes.
`mica.settle.integration.test.ts` pins the classification with scripted replies,
including "book podiatry".

### 2. Spoken times are resolved server-side (12 Oct)

This was the other half of the note, and the half that was still open: the time
in an utterance had nowhere to live. `mica.spoken-time.ts` now reads the spoken
time out of the utterance and `CreateAppointmentAction` uses it when the client
sends none — so "book podiatry for tomorrow at 2pm" drafts instead of asking the
user for a time they just said.

What the resolver reads, in UK wall-clock: `2pm`, `14:00`, `2.30 p.m.`, `half
past two pm`, `quarter to three pm`, `noon`, `midnight`; with a day of `today`,
`tonight`, `tomorrow`, `day after tomorrow`, `next week`, `in 3 days`, a weekday,
`on the 20th`, `15 November`, or an ISO day. It converts using the offset in
force **on the day being booked**, so booking across 25 October (clocks back) or
29 March (clocks forward) is an hour-correct, not fixed-offset, conversion.

What it deliberately refuses, and asks about instead: a bare hour with no
meridiem ("at 2" is 02:00 or 14:00 — the server does not choose), and a date
with no time ("tomorrow"). Both keep the clarification, whose message now names
an example phrasing.

### 3. A defect this work uncovered, and fixed

The draft's spoken summary formatted its timestamp in the container's zone. The
API runs in UTC, so from the day the resolver landed, a 2pm London appointment
read back as "at 13:00" — the one number the user is asked to confirm, printed
an hour wrong. Both labels now format in `Europe/London`.
`mica.write.integration.test.ts` asserts the read-back says 14:00 and not 13:00,
and separately that a zone-less `startTime` from a client (`2026-10-13T14:00`,
what a date-time input produces) is read as the carer's wall-clock rather than
the container's.

### 4. The phrases from this pass, re-stated

| Carer says | Route today | Time resolved |
|---|---|---|
| "schedule a task" | task regex → clarification for a title | n/a |
| "schedule a task check the fire doors" | task regex → draft | n/a |
| "book podiatry" | regex miss → settle → `CREATE_APPOINTMENT`, title "podiatry" | asks: no time was spoken |
| "book a podiatry appointment" | appointment regex → draft | yes, when a time is spoken |
| "book podiatry for tomorrow at 2pm" | settle → draft | yes — tomorrow, 14:00 London |
| "put podiatry in the diary" | settle (no regex vocabulary needed) | yes, if a time is spoken |
| "schedule fire door check" | settle → `CREATE_TASK`, subject "fire door check" | n/a |

**Still open, and honestly so:** the settle call runs on the path where a person
is already selected; with nobody selected `useMica.ts` still routes the utterance
to `/ai/mica/ask` first, which is a routing decision of its own and was not
changed here. Item 6 (person resolution for *"Joyce's podiatry is due"*) is
unchanged: a name that matches nobody stays a question, because guessing a person
is the one failure this flow must not make. And none of the above has been
re-run against a live provider since the change — the pinned evidence is the
scripted tests named above, not a fresh end-to-end pass with a real key.
