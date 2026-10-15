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
`2026-13` falls back to the current one rather than breaking the page). Three more
destinations carry detail since §9 — the rota's week, a profile's tab, one incident
by title.

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

Pinned by `mica.facts.test.ts` (54 unit tests: the phrases, the refusals, and the
exact sentences) and `mica.facts.integration.test.ts` (22 tests: the real tools and
real SQL, end to end, with `ai_config.enabled = false` — plus the control that a
question needing judgement still gets the gate).

### 6. The list answer hands you the page it came from (13 Oct)

The list answers above are the one shape a page beats: "who is on shift today" is
answered by a count and five names, and the rota itself is a 7x24 grid. So the
answers that have a page behind them now end by asking whether to open it —
*"2 staff are on shift today: Fatima Iqbal (day shift, Oak House, 8am to 8pm); …
Want me to open the rota planner?"* — and the carer's next word opens it:

> "who is on shift today" → the list, then the question
> "yes" → "Opening the rota planner." and the rota is pushed

Both halves are deterministic. The destination was already known when the list was
read (`factPageForRole`), the offer is remembered in the same conversation memory the
follow-ups use (a `pendingPage` on the session: a route, a label and a destination —
never a name or an id), and the confirmation is matched whole-utterance against a
spoken-yes set (`parseFactConfirmation`: "yes", "okay", "go on", "please do", …).
Confirming runs **before every AI gate**, like the answer it confirms, so an
organisation with no provider configured hears the offer and can still say yes. It
is audited as `mica_navigation` with `confirmed: true` and the path.

Three rules keep it from being a trap:

- **Four pages, not eight.** The rota, the appointments list, expiring training and
  a leave balance are offered — each because its page is where that list is actually
  read. The medication round, who is on leave, who is supporting one person and the
  month's incident count are answered by the sentence itself: the chart behind a
  round is reached by naming it ("open Nora's MAR chart"), the leave page cannot
  show the day's leave list, and a count is not a list. The training offer is
  additionally withheld from a role that cannot open the matrix — see section 8.
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

Pinned by `mica.facts.test.ts` (54 unit tests: the offer text, the four pages that
offer, the four that must not, the role gate, and the confirmations that are
refused) and `mica.facts.integration.test.ts` (22 tests, still with
`ai_config.enabled = false`: the offer on the answer, "yes" opening the rota, the
appointments list, the training matrix and the leave page, the latest offer
winning, a second "yes" opening nothing, a care worker hearing the training answer
with no offer at all, and a "yes" that answered no question opening nothing), plus
`MicaProvider.navigation.test.tsx` for the client routing.

### 7. The next four list questions, and a corpus that keeps them honest (13 Oct)

Section 5 said the deterministic set was the four answers a day's rows could give,
and that the obvious next additions were the questions a manager asks as often as a
carer asks who is on shift. They are now read the same way, before every AI gate:

- **whose training is expiring** — "2 training records are expiring soon: Priya
  Sharma — Fire Safety, expired on 1 October; Jane Doyle — Safeguarding, expires 3
  November."
- **how much leave a staff member has left** — "Priya Sharma has 12 days + 6 hours of
  leave left in 2026." The aggregate the leave cards use, never a decimal, and an
  over-taken balance is said as "2 days over" rather than as a negative number.
- **who is supporting one person** — "One person is supporting Grace Roberts today:
  Priya Sharma (day shift, Oak House, 8am to 8pm). 1 visit has nobody assigned yet."
  Rota shifts and domiciliary visits in one sentence, and an unassigned visit is said
  rather than hidden — "Grace has a visit and no carer" is the answer a manager
  needs.
- **how many incidents this month** — "There have been 7 incidents this month: 1
  critical, 2 high, 3 medium and 1 low. 1 was a near miss. 4 are still open."

Four decisions are worth stating, because each is a rule a later widening could
break:

- **A count is not a narrative.** "how many incidents this month" is answered;
  "summarise this month's incidents" is not. The count is scoped by `incident_date`
  (what the incidents page itself filters on), **excludes confidential incidents**
  exactly as the incidents stats endpoint does, and returns the summary row alone —
  no titles, no names — so this path cannot become a second door onto a confidential
  record.
- **Two name spaces, resolved separately.** A balance and a training record belong to
  a member of staff; every other answer here is about a resident. `resolveStaffName`
  is the service-user resolver's twin, and the question decides which one is used, so
  a "Grace" who is a resident cannot answer a colleague's leave question. Two
  colleagues sharing a first name produce the same spoken "say the full name" two
  residents do, and no balance is read out in the meantime.
- **A window it cannot parse is still refused, in every shape.** "within 7 days",
  "in the next 90 days", "last year" and "3 weeks from now" all return `null` rather
  than being answered with the tool's own default window — the same rule that refuses
  "next Tuesday" for the rota. The model can pass the window the carer actually said;
  this module cannot, so it does not guess.
- **Two of the four offer a page, as of section 8.** Expiring training offers the
  training matrix and a leave balance offers the leave page. Who is supporting one
  person is answered by the sentence, and a count offers nothing at all.
- **The question has to reach the answer.** The client has a vocabulary of its own,
  and its training-expiry rule treated *any* sentence with a training word and an
  expiry word as a renewal-task draft — so "whose training is expiring" was filed as
  a generic "Training renewal follow-up" and the answer never arrived. This is the
  misroute class the settle fallback exists for, one layer down. `looksLikeQuestion`
  now guards that implicit write (a leading question word, or a trailing question
  mark) and the routing table sends the question to the endpoint that answers it:
  the answer is spoken instead of a task being drafted, and neither the note nor the
  action endpoint is touched. The *statement* keeps its long-standing draft — "Tom's
  manual handling runs out soon" is still a renewal task — so the write path is
  unchanged; only questions moved.

And the corpus. `mica.facts.corpus.test.ts` holds the vocabulary as a table instead
of as scattered assertions: 40 phrases that must resolve (each naming the kind and the
read-only tool, with every kind covered by at least two), 28 that must stay on the
model path (each labelled with the class of refusal it guards — judgement, write,
window, statement, no-person — and every class held by more than one phrase). Around
the table sit the invariants no table can hold: every kind formats without leaking
`undefined` or `NaN`, every argument the parser builds is one the tool actually
declares, the pages offered are still exactly two, and a list answer's offer is still
appended to the sentence it already had. Widening the vocabulary is now one row;
narrowing it is one failing row.

Pinned by `mica.facts.test.ts` (51 unit tests: the phrases, the refusals and the exact
sentences), `mica.facts.corpus.test.ts` (14: the corpus and the invariants around it,
including that the capability disclosure an admin reads names every answer this path
gives) and `mica.facts.integration.test.ts` (19 tests, still with
`ai_config.enabled = false`: the four new answers end to end, including a month's
count that excludes both the confidential row and last month's, plus the controls that
a summary and a nameless balance still get the gate). The voice path is pinned from
the transcript in `MicaProvider.navigation.test.tsx`, and the client-side vocabulary
in `useMica.intents.test.ts`.

### 8. Training and leave balances offer their pages, and one door is role-checked (13 Oct)

Section 7 recorded the four newer answers as page-less, on the argument that the
training matrix and the leave page are not where those lists are read. Two of them
are: the matrix's own "Expiring soon" tab *is* the expiry list, and the leave page is
the only place in the product that draws a balance. So both answers now end the way
the rota and the appointments always have:

> "whose training is expiring" → the list, then "Want me to open the training matrix?"
> "yes" → "Opening the training matrix." and `/training` is pushed

> "how much leave does Priya Sharma have left" → "…has 12 days + 6 hours of leave
> left in 2026. Want me to open the leave page?"
> "yes" → "Opening the leave page." and `/leave` is pushed

Nothing else about the flow changed. The destination was already known when the list
was read, the offer still lives one turn in the session memory, and confirming it
still runs before every AI gate — so an organisation with no provider gets the whole
exchange.

**The one new idea is the role check.** `/training` is restricted to ORG_ADMIN,
MANAGER and COMPLIANCE_OFFICER, while `/ai/mica/ask` also serves CARE_WORKER: the
expiry list is speakable for a carer who could not open the matrix it came from.
Offering it anyway would ask "want me to open the training matrix?" and then land
them on `/unauthorized`, which is worse than never asking. So `factPageForRole`
withholds the page — and the question with it, because a sentence that asks about a
page it did not offer is its own bug — from a role that cannot open it. It fails
closed: a caller whose role is unknown gets no gated page rather than the ungated
benefit of the doubt. The answer itself is untouched, so a care worker still hears
whose training is expiring; what is withheld is the door.

As written here, that check read a role list carried on the page's own row in
`mica.facts.ts`, and only `/training` had one: `/scheduling` and `/leave` name no roles
in the router, so the check was a no-op for the offers that already worked. §10
replaced that list with the router's own answer — which is where the three roles above
come from now, and which turned out to gate `/appointments` as well.

Worth stating plainly, because it is the same bargain the rota already makes: the
leave page shows the *viewer's* own balance cards, so a manager who hears a
colleague's figure and says yes lands on their own — the colleague's numbers live in
the sentence. "Who is on shift today" offers the week grid rather than the day for
the same reason. The offer means "go to the page this came from", not "open a view
filtered to my answer".

Pinned by the corpus invariants (the four offering kinds enumerated, the gated one
failing closed with no role, and each offer's path held against the route "open the
training" and "open the leave" send) and end to end by the integration suite: the
training answer offering and opening `/training`, the balance offering and opening
`/leave`, and a care worker hearing the training answer with no offer and a "yes"
that opens nothing. §10 adds the invariant that ties all of it to the router.

### 9. The detail travels with the destination (13 Oct)

§8's open list said only `/emedication` honoured query parameters, so every other
destination got a bare path and the carer's own detail — which week, which tab,
which incident — was dropped on the way. Three of them carry it now, and the pages
were taught to read what they are handed.

**The week.** "open the rota for next week" opens `/scheduling?week=2026-11-02`, the
Monday of the week meant. The shapes are "this week", "next week", "last week", a
weekday and a stated date; a weekday is the *coming* one, so "the rota for Monday"
said on a Wednesday is the Monday five days away rather than the one already gone.
Anything else — "the week after next" — leaves the parameter off and the planner
opens its own default, because the alternative is a confident wrong week. The page
snaps whatever it is given to that week's Monday, parses the day by hand (`new
Date('2026-11-04')` is UTC midnight, which is the 3rd west of Greenwich, and that is
the wrong week), and ignores a malformed or impossible value rather than refusing to
render. It also re-reads the parameter when it changes while the page is mounted,
because asking for next week and then the week after pushes the same route twice.

**The tab.** "open Grace Roberts's health tab" opens `/people/:id?tab=health`. The
slugs are `PersonProfilePage`'s own `TAB_SLUGS` — the 21 tabs a person can name out
loud — and `mica.navigation.test.ts` reads that page's source to assert every slug
the parser can emit is one the page declares, because a slug it does not know opens
the profile on its first tab, silently and plausibly. The tab is read only when a
person is named, and after the name is: "open the goals" is the organisation's goals
page, while "Grace's goals" is hers. That is the same upgrade §2 describes for the
charts — a name turns a module noun into that person's own view.

**The incident.** An incident's only handle is its free-text title, so "the fire door
incident" is opened by resolving the *subject* it was named by (`fire door`) against
the organisation's titles: one match opens `/incidents/:id`, two ask which, none says
so and pushes no route. Two details there are deliberate. Confidential incidents are
excluded for everyone but an ORG_ADMIN, the same rule the directory applies, so a
carer hears the sentence a miss gets rather than a confidential record's title. And
the incident reading happens *before* the destination table, because the carer's noun
is the incident and whatever else is in the sentence qualifies it: "the medication
incident" is an incident **about** medication, and the table matched "medication"
first and opened the charts. That misroute is what the first run of the integration
tests caught, which is the argument for testing the sentence and not the path.

Everything else still takes a bare path, and on purpose.

### 10. The offer gate is the router's answer, not a copy of it (14 Oct)

§8 gave one page a role list, and that list was a copy of a decision taken
somewhere else. `apps/web/src/App.tsx` already says who may open `/training` —
`allowedRoles={[…]}` on the route — so Mica carried a second, hand-maintained answer
to a question the router had already answered. A copy is right on the day it is
written and wrong the first time somebody changes the route, and wrong in the one
direction that matters: the carer is asked "want me to open the training matrix?",
says yes, and lands on `/unauthorized`, with nothing on either side having changed
enough to notice. Nobody editing a route has any reason to think a voice assistant's
table needs the same edit.

So the copy is gone, and the router stays the only place a gate is written.
`scripts/design/route-access.mjs` reads `App.tsx` — its routes, their nesting, their
`allowedRoles`, and the `ModuleGuard` module each one names — and writes
`packages/shared/src/pageAccess.generated.ts`, which the API reads through
`@meticle/shared`. It is a generated artifact in the same sense as the DESIGN.md
blocks: `design:check` runs in CI on every push, so a route that changes without a
`npm run design:sync` is a red build, and the offer gate moves with the router rather
than two edits later. The web suite runs the same check, so the local loop that made
the change sees it too. `App.tsx` is untouched by any of this.

Four readings the derivation had to get right, each with a test of its own:

- **Nesting is inherited.** Mission Control's views are children of a role-narrowed
  parent; a traversal that ignored nesting would report them as public.
- **A duplicated path takes the restrictive reading.** `/compliance` is declared both
  as a marketing page and as an application page, so the union of the two sets of
  restrictions is what an offer is checked against.
- **A gate the generator cannot read stops it.** `allowedRoles={SOME_CONSTANT}`, a
  spread, or a list whose names cannot be read is an error — not an empty gate, which
  would silently widen access, which is the one wrong answer. A router that yields no
  authenticated route at all is an error too, rather than a table claiming every page
  is unreachable.
- **Unknown is never allowed.** A path with no route entry, a public path, and a
  gated path with an unknown role all withhold the offer (`pageAccessFor`), because
  the direction that matters is never "unknown, so allow".

Two consequences worth stating plainly. The first is a behaviour change: `/appointments`
declares three roles in the router, which the hand-written list never knew, so a caller
whose role is unknown no longer gets that offer. That path is defensive rather than
reached — the ask endpoint authenticates and names a role — and it now fails in the
safe direction. The second is the point of the work: restricting `/leave` to ORG_ADMIN
and MANAGER in the router, regenerating, and rebuilding is *all* it takes for Mica to
stop offering it to anyone else. No Mica file is edited, and the drift cannot be
shipped — the check runs before the change can.

Second half named here rather than implied, and left open at the time: the
`ModuleGuard` module is recorded in the table but was not consulted, so a page the
caller's *module permission* excludes — or one whose module the organisation's service
model does not provide — could still be offered. A route's gate has two halves and they
now live in one place; on this pass only the first was wired. §12 closes the second, and
closes it the same way: from the router's recorded module, against the caller's own
modules.

### 11. A write ends where a read answer ends (14 Oct)

Everything above ends on a page. Mica speaks a list, asks whether to open the page
it came from, and the carer's next word — resolved in the conversation, not parsed
again — takes them there. The write flows did not. "Add a task to order new grip
rails" produced a saved row and a sentence, and the carer who wanted to look at what
had just been written had to leave the conversation, find the tasks page, and find
the row: the record was created and then handed over to be hunted for.

So a write now ends the same way, with the same two halves. The reply carries
`offer` — the page the new record is on, with the question in it — under the same key
a list answer uses, because it is the same kind of thing arriving by a different
door. And the page is remembered on the session (`setPendingPage`), because a write
is a *save* rather than a question and an answer: there is no turn to hang the offer
on, and inventing one would put a sentence nobody said in front of the model on the
next follow-up. `POST /ai/mica/actions/confirm` takes the optional `sessionId` the
voice flow already holds, the new task's or appointment's page is recorded there, and
a bare "yes" resolves through the confirmation branch of `/ai/mica/ask` — one read of
the conversation and no second parse, exactly as the rota offer resolves.

Three properties are worth naming, because each one is a decision rather than a
consequence:

- **The write retires the offer before it.** A carer who heard "want me to open the
  rota planner?" and instead asked for a task to be created has stopped talking
  about the rota, so the create replaces that offer with its own — including with
  nothing when the record's page cannot be offered. An offer is answerable only by
  the sentence straight after it, and that stays true whether the sentence in
  between was a question or a save.
- **The gate is the router's, again.** `recordPageFor` asks `pageAccessFor` — the
  same generated table §10 built — so a record whose page the caller's role cannot
  open is offered to nobody, and a caller is never told to open a door that is
  locked for them. `/appointments` is the interesting one: it names three roles, so
  the identical booking ends with a question for a manager and a plain sentence for a
  compliance officer.
- **The link is one string with two ends, so it lives in one place.** The API composes
  it and a page reads it; nothing at either end fails loudly if they disagree — the
  server would return `?task=` and the page would go on looking for something else,
  landing the carer on an unfiltered list with no explanation. So `micaRecordPath` and
  the parameter names live in `packages/shared/src/micaDeepLinks.ts`, next to the
  page-access table that exists for the same reason: `?task=<id>`,
  `?appointment=<id>`, and `?tab=daily-notes&source=<noteId>` for a care note, which
  names the profile *and* the note.

The pages were taught to read what they are handed, and a link is followed rather
than filtered to: `TasksPage` opens the task the id names, reading `/tasks/:id` when
the list on screen does not hold it (the list is status-filtered); `AppointmentsPage`
reads `/appointments/:id` and moves its own day filter to the appointment's day, so
the record is in the table behind its dialog and not only in the dialog — a newly
booked appointment is almost never on the day the page opens on. Both clear the
parameter when the record is closed, because the URL is what re-opens the dialog.
`PersonProfilePage` reads `?source=` and opens that one note, which is the door a
notification, another device or a colleague arrives through; and the care-note
approval itself now lands on the note it just saved rather than on the top of the
list, because the reply carries the row.

Pinned by `mica.recordPages.test.ts` (the link shapes, and the gate failing closed
for a role the router keeps out), by `mica.session.test.ts` (a write's offer is held
and retired), and end to end in `mica.write.integration.test.ts`: confirm returns
`/tasks?task=<id>`, the following "yes" to `/ai/mica/ask` answers `Opening the new
task.` and navigates to that link, a create following a rota offer retires it, the
booking offers `/appointments?appointment=<id>`, and `/ai/daily-notes/approve`
offers `/people/<id>?tab=daily-notes&source=<noteId>`. The three page readers are
pinned in the web suite (`TasksPage.deepLink.test.tsx`,
`AppointmentsPage.deepLink.test.tsx`, `PersonProfilePage.test.tsx`).

One thing this work found and fixed, which is worth recording because it is the kind
of bug that hides behind an untested endpoint: `/ai/daily-notes/approve` was writing
through `pool.connect()`, a different pooled connection from the request's — the one
carrying the RLS session variables `rlsMiddleware` and `authenticate` set. The
`daily_notes` tenant policy therefore rejected every insert and the endpoint answered
500, so the care note was never saved at all. It now uses `transaction()`, the helper
that reaches for the request-scoped client, which is what the care-note offer in this
section rides on. No test had ever called that endpoint; there is one now.

The client half came with it, because without it the offer was a question nobody
could answer. The gateway has always drafted before persisting, and `useMica` wrote
the draft to `sessionStorage` under `mica.pendingDraft` — but nothing in the product
read that key, so there was no way to confirm a task or an appointment at all: a
carer could ask for one, hear it read back, and never save it. The draft is now a
review card in the overlay (`MicaOverlay.tsx`), listing the fields the server
resolved — title, who it is for, owner or attending staff, due date or start,
priority — with Save and Discard, and with the voice answer named on it: the reply
ended by asking "shall I save it?", so the card says *or say “yes” to save it* and
the dispatcher makes that word write rather than fall through to the care-note path,
where a bare "yes" used to be drafted into a note about nobody.

The offer that follows a save is shown as well as spoken — "Saved. Want me to open
the new task?" with a control that opens it — and that control turned out to be the
same one a *list* answer should have had: the offer state is filled by both flows
(`useMica`'s `offer`), so the rota question is now tappable too. Two details of the
card are decisions rather than cosmetics. It is read-only: a wrong field means saying
the request again, because letting the card rewrite the envelope would put unaudited
client edits in front of `confirm`, which re-validates the draft as the server issued
it. And it persists: the draft is written to the tab and read back on mount, and the
conversation handle went with it (`mica.sessionId`) — the id is opaque and scoped
server-side to org+user, and without it a reloaded draft would save and then leave the
carer's "yes" addressing a conversation the server no longer had. That also made the
module's own comment true, which had claimed per-tab persistence the code did not do.

Pinned by `mica.draft.test.tsx`: the spoken request drafts and writes nothing, a tap
saves with the envelope the server issued, "yes" saves it too and reaches no care-note
endpoint, the confirm carries the session the draft was prepared in, a draft already
in the tab is on the card after a reload, and Discard writes nothing and keeps nothing.

### 12. The gate's second half, resolved the way the guard resolves it (15 Oct)

§10 left one thing named as open: the router's `module`, recorded next to the roles and
never read. It is read now.

A route's gate is written twice in `App.tsx` — `allowedRoles={[…]}` and
`<ModuleGuard module="…">` — and the offer gate consulted only the first, so the second
road to a locked door stayed open. An organisation with scheduling switched off still
heard "want me to open the rota planner?"; a care worker whose `tasks` permission is
`'none'` by default was still asked whether to open the tasks page they had just written
into. Both are pages `ModuleGuard` answers with `/unauthorized`.

Closing it needed one input and no new source of truth. `pageAccessFor` takes the
caller's modules as a third argument — `MicaModuleAccess`, resolved once per turn by
`mica.moduleAccess.ts` — and `loadModuleAccess` asks the two questions
`GET /permissions/:userId` already answers: the organisation's service model, through
`getAvailableModules`, and the caller's own `user_permissions` row falling back to
`ROLE_DEFAULTS`. Both are imported from `permissions.controller.ts` instead of restated,
so a module added to the availability list or a default changed for a role moves the
offer gate with it. That is deliberately the same resolution `ModuleGuard` performs from
the client side of the same endpoint: the gate's job is to predict the guard, so it is
built out of the guard's own inputs. `undefined` — modules nobody resolved — withholds,
exactly as an unknown role does.

Three properties are decisions rather than consequences. It is **lazy**: the modules are
resolved for an answer that has a page at all (`factPageFor`) and for a write that
produced a record, so a question that could never end in an offer does not pay for two
lookups and the fact path costs what it did before for the five kinds that offer
nothing. It is **fail-closed at the interface**: a module-gated page and no module map is
`false`, so a future caller cannot forget the half by omitting it — and `options` on
`formatFactReply` is required for the same reason. And **delegations are not consulted**:
`requirePermission` lets a delegate inherit the primary manager's permissions and
`ModuleGuard` does not, so neither does this — the question is whether the door opens,
not whether the API may be called, and the offer has to match the door.

The behaviour that changes is the intended direction, and it is worth naming because it
is visible. A care worker can create a task — `CREATE_TASK` names CARE_WORKER — and is no
longer asked whether to open it: `/tasks` is gated on the `tasks` module and their level
for it is `'none'` by default, so the row is saved and the sentence is plain. The
daily-note flow runs the same way through `/people/:id`, gated on `people` and also
`'none'` for a care worker by default: the offer of the note appears for a caller who has
that module — granted by an admin, or higher up the roles — and not otherwise, which is
what the guard would have done with the link it was about to hand over.

Pinned by `mica.moduleAccess.test.ts` (availability is the endpoint's own function, a
primary service model is authoritative over a legacy secondary one, a row beats a role
default, a grant cannot conjure a module the organisation does not have), by the module
half of `mica.facts.corpus.test.ts` and `mica.recordPages.test.ts` (a gated page with the
module shut is withheld question-and-all, for every role, and cannot be granted a module
`MODULES` does not carry), and end to end in `mica.write.integration.test.ts`: an admin's
task save still returns `/tasks?task=<id>`, and a care worker's identical save returns the
record with no `offer` at all.

### Still open, and honestly so

- **No live pass.** Everything above is pinned by scripted tests
  (`mica.navigation.test.ts` 88, `mica.navigate.integration.test.ts` 13,
  `mica.facts.test.ts` 54, `mica.facts.corpus.test.ts` 22,
  `mica.facts.integration.test.ts` 22, `mica.moduleAccess.test.ts` 6,
  `mica.recordPages.test.ts` 10,
  `mica.write.integration.test.ts` 17, `mica.session.test.ts` 7, and 112 web tests
  across `src/components/mica` (six of them §11's draft card) plus the page-access
  check and §11's nine record-link reader tests). §10's derivation is pinned
  once more outside both suites, in `scripts/design/design.test.mjs`, which is the
  half CI runs on every push. Nothing here has been re-run against a real provider
  or a real microphone since the change.
- **The deterministic set is still deliberately narrow.** It answers lists and counts
  of the organisation's own rows, and nothing else: a percentage, a trend, a summary
  and advice all stay the model's. The next candidates — "how is the rota looking
  today" and "any medication overdue" — are both judgement questions rather than list
  reads, so they are not next; the list-shaped gaps are a person's care plan and
  incident *reporting* status, which have pages that would have to accept a filter
  first (see the query-parameter note below).
- **The voice loop itself is component-tested, not browser-tested.** Continuous
  listening, the VAD hand-off and the bar's audio pulse need a browser and a
  device; what is asserted is the vocabulary, the routing, the surfaces and the
  deep link, not the acoustics.
- **A destination can carry only what its page reads.** §9 closed the three that
  mattered most — the rota's week, a profile's tab, one incident by title — and §11
  added the three record links (`?task=`, `?appointment=`, `?source=`), alongside
  `/emedication`'s `?personId`/`?month`. The rest still take a bare path deliberately,
  because a parameter a page ignores is a link that looks like it worked: the rota
  cannot be given a location or a carer, and no page has the support for it yet.
- **The review card cannot be edited.** §11 closed the gap that made a spoken write
  unsaveable, so a task or appointment is now saved from the card; but a field the
  server read back wrongly — the wrong Tom Bradley, a due date a week out — can only
  be fixed by saying the request again, because the card renders the draft and does
  not rewrite it. The action gateway already takes a client-supplied `input` and
  `createAppointment` names a "review card edit" as the first source of a time, so the
  door is open; what is missing is a form in the overlay and a decision about which
  edits are trusted.
- **The draft is per tab, and the microphone is still untested.** A reload keeps the
  draft (that is the point of the write), a second tab does not show it, and nothing
  here has been re-run against a real provider or a microphone since the card was
  added: the flow is pinned by `mica.draft.test.tsx`, which stubs the recogniser and
  the synthesiser exactly as the rest of the Mica suite does.
- **The offer is module-aware as well as role-aware.** §8 opened this, §10 closed the
  role half, and §12 closed the half §10 had left: a page is offered only where both
  halves of the router's gate open, and the module half is read from the two functions
  `/permissions/:userId` answers rather than from a list of its own. Spoken
  *navigation* is still untouched by all of this: "open the training" from a care worker
  still resolves to `/training` and meets the guard, exactly as the nav bar would — the
  checks are on the offer, which is the path where Mica asks the question. What remains
  is outside Mica, and named so it is not mistaken for done: the module availability
  list is still written twice (`permissions.controller.ts` and the client's
  `ModuleGuard.tsx` keep a copy each, and they agree today), and `/nutrition` is gated on
  a module neither carries, so it is unreachable for every caller — for which Mica
  withholding the offer is the honest half.
- **Item 6 stands.** "Joyce's podiatry is due" is still a question, not a guess.
