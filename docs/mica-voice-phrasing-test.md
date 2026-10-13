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

**Still open at that point:** item 6 (person resolution for *"Joyce's podiatry
is due"*) stayed unchanged: a name that matches nobody stays a question, because
guessing a person is the one failure this flow must not make. And none of the
above has been re-run against a live provider since the change — the pinned
evidence is the scripted tests named above, not a fresh end-to-end pass with a
real key.

---

## Status — the voice-first session (12 Oct, later the same day)

The note above ended with a routing caveat and, more importantly, with Mica still
behaving as a *modal*: tap, say one sentence, hear one reply, session over. The
carer's request that changed that, in their words: no text box, no "select a
person" step, recognise *"give me Evan Turner's Mar chart for March"*, open the
page instead of reciting it, minimise while still listening, keep listening until
"bye", and perform actions rather than only talk.

### 1. Voice only, and nobody to pick

The overlay's typing box and person picker are gone, along with their tests.
Voice is the only entry point. The subject of a care note is read from the
sentence (`extractPersonNameFromUtterance`), and when the organisation's own
roster cannot place that name, `/ai/voice/notes` rejects it and Mica **asks
aloud** — "Multiple people match \"Grace\". Please choose one." — and the next
sentence is the answer. That message is the one the picker existed to satisfy;
it is now a conversational turn rather than a dropdown.

### 2. A destination is a place, not a monologue

`mica.navigation.ts` (pure; nothing imported, no clock, no database) reads a
spoken destination, and `AIController.resolveMicaNavigation` resolves the only
thing a parser cannot know — which person or staff member a name refers to — then
returns `{ answer, navigate: { destination, path, label, person? } }`, which
`useMica` pushes through the router and `MicaProvider` performs. "give me Evan
Turner's mar chart for march" now opens
`/emedication?personId=…&month=2026-03`, and `/emedication` was taught to honour
exactly those two parameters (`?personId`, `?month`; an impossible month such as
`2026-13` falls back to the current one rather than breaking the page).

Three properties are deliberate:

- **It runs before every AI gate in `micaAsk`.** Navigation needs no provider and
  no tokens, so it works for an organisation with AI switched off —
  `mica.navigate.integration.test.ts` asserts exactly that, and separately that
  the *same* endpoint still refuses a question in that state.
- **An ambiguous or unknown name is never guessed.** Two people called Grace, or
  a name matching nobody, produce a spoken sentence and no route. Opening the
  wrong medication chart is the one failure this flow must not make.
- **"give me" is weak.** "give me today's appointments" and "give me the
  incidents" stay questions — the list is the answer. (Since §5, that list is
  answered deterministically rather than recited by the tool loop.) Only a named
  person or a named chart turns "give me" into a destination. "open"/"show"/"take
  me to" navigate on any destination.

Audited as `mica_navigation` with `model: 'deterministic'`, so the AI audit log
does not read as if a model answered.

### 3. It keeps listening, and gets out of the way

After a reply, listening resumes on its own. The session ends on a stop phrase
said **on its own** (`MICA_STOP_PHRASES`, matched whole-utterance, so "close the
incident" and "stop the fire door task" do not cut the carer off), on Escape, on
the close button, or after three consecutive turns that heard nothing — spoken,
not silent-failed. A navigation reply also minimises the session into the bottom
bar (`MicaMiniBar`), where it stays live over the page it just opened instead of
covering it; the bar restates the live words, the reply, or the destination, in
that order.

The microphone opens once per session and is reused across turns
(`startMicMeter` returns early when a stream is already open), so continuous
listening does not renegotiate the device between sentences.

### 4. A failure is either retryable or not

`402` (budget) and `403` (feature disabled) stop the session with the error
treatment, because no sentence changes them. Every other failure — including
`400`/`404` from the Mica gates and from person resolution — is spoken and then
listening continues, because "multiple people match" is fixed by saying the full
name.

### 5. The list answers need no model either (12 Oct)

Navigation made "take me to X" free. The questions a carer actually asks most —
"who is on shift today", "give me today's appointments", "how is Nora's
medication round looking", "who is on leave" — were still going to the tool loop,
which needs an OpenAI key, the `natural_language_assistant` feature, budget
headroom and a round trip; with AI switched off they did not degrade, they failed
with *"AI not configured"*, even though the answer was four rows and a sentence.

`mica.facts.ts` (pure: no clock, no database, `today` is a parameter) parses those
phrases and phrases the answer, and `AIController.resolveMicaFact` runs the one
bounded read-only tool that supplies the rows. It runs **before every AI gate**,
in the same place and for the same reason as navigation, and the answer joins the
same conversation memory (`sessionId`), so "what about tomorrow?" is still a
grounded follow-up.

What it answers, in the house style: "2 staff are on shift today: Fatima Iqbal
(day shift, Oak House, 8am to 8pm); …"; "There are 2 appointments today: 2pm
Dental check for Ade Okafor; …"; "Across the home, 2 doses are scheduled today:
1 given, 0 still due, 1 overdue. Overdue: Nora Whitfield's Risperidone 1 mg was
due at 1am. Stock to watch: …"; "2 staff are on approved leave today: …". Times
are spoken in UK wall-clock (`Europe/London`), the same zone the action drafts
use.

What it deliberately does **not** answer, because a confident wrong answer is
worse than a round trip:

- **Anything needing judgement.** "Any medication overdue today?" and "how urgent
  is the Risperidone reorder?" depend on the stock urgency bands the tool
descriptions define, and "summarise this month's incidents" is a narrative.
  Those stay on the model path — and with AI off they still return the gate.
- **Writes.** "book an appointment for the podiatry clinic" names appointments and
  is a draft; a write verb sends it to the action gateway untouched.
- **Any day it cannot resolve.** "who is on shift next Tuesday", "appointments
  coming up", "who is on shift on 5 November" return `null` rather than answer
  about today. A day window this module has no arithmetic for is the model's.
- **A person it cannot place.** One named person is resolved by one org-scoped
  query (`resolveServiceUserName`, shared with navigation); two matches or none
  produce a spoken sentence instead of an answer about a stranger.

Audited as `mica_fact` with `model: 'deterministic'` and the *kind* (never the
answer — that log is readable by ORG_ADMINs and the answer echoes names). The
assistant capability disclosure in Settings now states the same thing to admins:
these list questions are read from their own records and nothing is sent to the
provider.

Pinned by `mica.facts.test.ts` (32 unit tests: the phrases, the refusals, and the
exact sentences) and `mica.facts.integration.test.ts` (13 tests: the real tools and
real SQL, end to end, with `ai_config.enabled = false` — plus the control that a
question needing judgement still gets the gate).

### 6. The list answer hands you the page it came from (13 Oct)

The list answers above are the one shape a page beats: "who is on shift today" is
answered by a count and five names, and the rota itself is a 7x24 grid. So the two
answers that have a page behind them now end by asking whether to open it —
*"2 staff are on shift today: Fatima Iqbal (day shift, Oak House, 8am to 8pm); …
Want me to open the rota planner?"* — and the carer's next word opens it:

> "who is on shift today" → the list, then the question
> "yes" → "Opening the rota planner." and the rota is pushed

Both halves are deterministic. The destination was already known when the list was
read (`factPageFor`), the offer is remembered in the same conversation memory the
follow-ups use (a `pendingPage` on the session: a route, a label and a destination —
never a name or an id), and the confirmation is matched whole-utterance against a
spoken-yes set (`parseFactConfirmation`: "yes", "okay", "go on", "please do", …).
Confirming runs **before every AI gate**, like the answer it confirms, so an
organisation with no provider configured hears the offer and can still say yes. It
is audited as `mica_navigation` with `confirmed: true` and the path.

Three rules keep it from being a trap:

- **Two pages, not four.** Only the rota and the appointments list are offered. A
  medication round and who is on leave are answered by the sentence itself, and the
  chart behind a round is reached by naming it ("open Nora's MAR chart").
- **Whole-utterance, like the stop phrases.** "yes, but what about tomorrow" is a
  new question and opens nothing; "no" is not a confirmation, and the offer simply
  lapses.
- **One turn of life.** Every recorded turn replaces the offer, so a carer who hears
  the question and then asks something else is not one "yes" away from being taken
  there. The one case where a lapsed offer can still be answered is a turn that
  failed a gate before it could be recorded (no provider, no budget): the offer
  stands until the conversation moves on, bounded by the 30-minute session TTL.

The client's half is small but load-bearing. A bare "yes" is not a question and not
a destination, so without it the routing table would draft a care note from the
word; `looksLikeConfirmation` is checked before the care-note fallback in
`useMica.ts`, and the server still owns the route — the client only decides which
endpoint the word goes to, exactly as it does for navigation.

Pinned by `mica.facts.test.ts` (unit: the offer text, the two pages that offer,
the two that must not, and the confirmations that are refused) and
`mica.facts.integration.test.ts` (13 tests, still with `ai_config.enabled = false`:
the offer on the answer, "yes" opening the rota and the appointments list, the
latest offer winning, a second "yes" opening nothing, and a "yes" that answered no
question opening nothing), plus `MicaProvider.navigation.test.tsx` for the client
routing.

### Still open, and honestly so

- **No live pass.** Everything above is pinned by scripted tests
  (`mica.navigation.test.ts` 54, `mica.navigate.integration.test.ts` 6,
  `mica.facts.test.ts` 32, `mica.facts.integration.test.ts` 13, `mica.session.test.ts`
  6, and the web tests across `src/components/mica`). Nothing here has been re-run
  against a real provider or a real microphone since the change.
- **The deterministic set is intentionally small.** Training expiry, leave
  *balances*, "who is supporting X" and the Incidents count are still model
  questions; the first three are the obvious next additions.
- **The voice loop itself is component-tested, not browser-tested.** Continuous
  listening, the VAD hand-off and the bar's audio pulse need a browser and a
  device; what is asserted is the vocabulary, the routing, the surfaces and the
  deep link, not the acoustics.
- **Only `/emedication` honours query parameters.** The parser therefore gives
  every other destination a bare path rather than inventing parameters those
  pages ignore. If Mica should open the rota on a given week, that page has to
  accept a date first.
- **The offer is not permission-aware.** It is made from the answer, so a carer
  whose role or modules exclude the rota can be offered it and land on the same
  guard screen the nav bar would give them. That is no worse than the spoken
  destination ("open the rota") it sits beside, and making the offer
  permission-aware would mean asking about the person's modules on the answer
  path, which the list facts deliberately do not do.
- **Item 6 stands.** "Joyce's podiatry is due" is still a question, not a guess.
