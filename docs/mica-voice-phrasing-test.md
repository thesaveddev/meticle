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
