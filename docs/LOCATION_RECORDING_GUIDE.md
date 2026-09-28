# Carer location recording: what it does, how to turn it off, and what that costs you

**For:** registered managers, owners and operations leads at organisations using Meticle Care
**Applies to:** domiciliary and live-in services
**Last reviewed:** 28 September 2026

This is a plain-English guide to a decision that is yours to make, and to what you give up
when you make it. It is written to be read by someone deciding, not someone defending the
software afterwards, so the costs are stated in the same breath as the features.

If you only read one section, read **[What you lose](#what-you-lose)** and
**[Talking to your workforce](#talking-to-your-workforce)**. Everything else is detail behind
those two.

---

## The short version

Meticle Care can record where a carer was when they checked in and out of a visit, and show
those positions to managers on a check-in map. You can turn that off entirely, in one setting.

There are **two separate controls**, and this is the part most people get wrong:

| Control | Who controls it | Scope |
|---|---|---|
| **"Collect and show carer location"** — your organisation's setting | You | Everyone in your organisation, at once |
| **Each carer's own answer** — the notice each carer reads in the app | The carer, alone | That one carer |

Your setting sets the ceiling. A carer can lower it for themselves; **a carer cannot raise it
for themselves, and neither can you**. If you turn collection off, it is off, and no carer
answer brings it back.

A carer who says no is honoured by the system. You will see that they declined, and when —
you cannot un-record it, and you cannot record it for them.

---

## Where the settings are

| What | Where | Who can use it |
|---|---|---|
| Turn location recording on/off | Settings → **Organization** → *Carer location* | Organisation admin changes it. Managers can see the state. |
| See who has agreed | Settings → **Organization** → *Who has agreed to location recording* | Organisation admins and managers |
| A carer's own answer | Settings → **My Profile** → *Your location* | Every user, for themselves |
| The check-in map | Homecare → **Visit Check-In Map** | Organisation admins and managers |

If your organisation does not use domiciliary or live-in services, there is no map and
nothing on this page applies.

---

## What actually stops when you turn it off

This is the exact behaviour, layer by layer, so you are not relying on a summary.

| Layer | What happens |
|---|---|
| **The app on the carer's phone** | No position is requested or read. The carer is not asked for the phone's location permission, and there is no "check my distance" button. |
| **Check-in and check-out** | No coordinates are sent, and none are stored. The visit is still recorded in full — times, tasks, notes, photos, signature. |
| **The visit record** | The visit is marked as having had no position recorded, and why. You can tell a visit with no position because of your decision from one that failed to capture. |
| **The check-in map** | The link disappears from the menu. Anyone who had the page open gets a clear message that your organisation has switched it off — not an error, and not a "try again" button. The map itself returns a refusal from the server, so an old browser tab cannot keep plotting pins. |
| **Proximity check** | Switched off. See below — this is the real cost. |
| **Visits, care records, tasks, notes** | Unaffected |
| **Timesheets, mileage, payroll, client invoicing** | Unaffected |

### What does not stop

Two things, both deliberate, and both worth knowing before you tell anyone:

- **Positions already recorded stay recorded.** Turning the switch off is forward-looking. It
  does not delete anything from visits that have already happened, and it is not a way to
  erase history. How long that data is kept is your decision as the data controller, under
  your own retention policy — see [Limits](#limits-and-what-we-cannot-tell-you).
- **The carer's phone keeps its own permission.** If a carer has already allowed location
  access to Meticle Care, that permission stays in their phone's settings after you switch
  off. The app simply stops using it. Turning your switch back on does not require asking
  them again.

---

## What you lose

### You lose the ability to require a carer to be at the address

This is the honest heart of it, and the thing to be clear about in any conversation with your
team.

**While location recording is on**, the app checks the distance between the carer's position
and the address of the visit when they check in. If they are further away than your
configured distance — **500 metres by default** — the app stops the check-in and tells them
how far off they are. It is a real block: the visit does not start, and nothing is recorded
for that attempt.

**With location recording off, that check cannot happen.** There is no position to compare,
so the app has nothing to test. A carer can check in to a visit from anywhere, and the visit
is recorded normally.

That is a genuine reduction in assurance and you should treat it as one. The check is
designed to catch an honest mistake — checking in at the wrong house, in the wrong street,
having driven to the wrong client. It is **not** a security control, and we want to be
straight about that: it runs on the carer's own phone, so it stops an honest slip rather than
a deliberate one. If you are looking for a tamper-proof attendance control, this is not it,
and no version of it is.

The 500-metre distance is configurable, though not from the settings screen — raise it with
your Meticle Care contact if 500 metres is wrong for your patch (dense city rounds, rural
travel, large estate sites all differ).

### You lose the map as evidence of attendance

The map is how you would answer "was this carer at this address at 08:15?". With it off you
have the check-in *time*, which is reliable, and no check-in *position*. If you need to
evidence arrival at a particular address, you no longer can from the system.

### What that means in practice

Worth being blunt about the trade: it is **verification of *where* the carer was**, or
**collection of *where the carer is***. You cannot have "off for the map, on for the
attendance check" without keeping the collection, because the attendance check is the
collection.

If your primary driver for location recording was lone-worker safety, note that the map has
never actually supported that. It shows a position captured at check-in; it does not update,
and it cannot locate someone who has not checked in. The overdue-call alert is the feature
that does address a missed call, and it does not depend on location. Turning location off
does not remove it.

### What you do not lose — pay, in particular

**Turning location recording off does not affect anyone's pay, timesheet, mileage claim or
invoice.** This is the first question almost every manager asks, so it is worth being precise
about why:

- **Worked time** is calculated from the check-in and check-out *timestamps*.
- **Travel time and mileage** come from what the carer enters, under your organisation's
  travel and mileage policy.
- **Rates** come from your care packages, pay profiles and mileage policy.

No GPS coordinate is an input to any of it. The position and the money are entirely separate
paths in the system, which is why the switch can be turned on and off without a single
timesheet changing shape.

---

## Talking to your workforce

This is a consultation matter, not an announcement, wherever your staff are represented.
The guidance below is about being straight; the legal obligations around introducing or
withdrawing staff monitoring are yours, and we cannot discharge them for you.

### Do this before you switch, not after

- **Consult first.** If you have a recognised union or works council, introducing staff
  location monitoring is a consultation matter as well as a contractual one. So is *removing*
  it, if staff have been told they are monitored. This is the step most often skipped and the
  one most likely to cause a dispute.
- **Have your paperwork ready.** A contract clause, a handbook entry, and a short written
  policy of your own. We can show you the software behaves as you describe; we cannot show
  you that your employment documents say what you say they say.
- **Decide what you are asking for, and why, before you ask.** The most common failure is
  turning it on "just in case" and then being unable to justify it to a sceptical worker or
  an inspector. If you cannot name the operational reason, that is a reason to leave it off.

### Say the true thing

Each carer is shown a notice in the app, in their own words, and asked to say yes or no. They
can also change that answer at any time, in either direction, from the app or from a browser,
without giving a reason. The notice tells them, accurately, what you can see and what you
cannot.

A script that holds up:

> "We can record where you were when you check in and out, and I can see it on a map. If we
> do that, I can see if you were at the client's address, within 500 metres, at the moment
> you checked in. If we turn it off, I can't check that — you'd be able to check in from
> anywhere. Visits, notes, care records, your timesheet, your mileage and your pay are the
> same either way. You'll be asked whether you agree, in the app, and the answer is yours
> alone — I can't change it for you and you can't change mine. If you say no, I can see that
> you said no, and that's all I can see about it."

### Do not say these

- **Do not say the app tracks people.** It does not. It takes one reading at check-in and one
  at check-out. There is no background tracking, no tracking between visits, and nothing
  running while a visit is open. If a carer believes otherwise and checks, they will find you
  were right, and that is worth a conversation.
- **Do not say it is real-time or a live map.** It is not. A pin is where someone was at
  check-in. If it is hours old, the screen says so.
- **Do not say consent makes it lawful.** We are your processor and cannot consent on a
  staff member's behalf. If you rely on legitimate interests, that is your assessment to
  document — a worker's agreement is one input to it, not a substitute for it.
- **Do not promise that saying no costs them nothing.** It does not cost them pay, and that is
  genuinely true. But it does mean nobody can check they were at the address. Say so. A
  refusal made without that context is a refusal made under a misapprehension, and if it
  later mattered, that misapprehension would be the first thing examined.
- **Do not tell a carer what to answer.** A recorded agreement your employer asked for is not
  a worker telling you what you wanted to hear, and the evidence is worth nothing if it is
  that.

### Expect some carers to say no, and be ready

That is the system working, not a problem to manage away. It is worth deciding in advance how
you will handle it, because the honest answer is that you will not collect from that carer
and the arrival check will not apply to them. It is a real operational effect on your rota and
your assurance, and it lands unevenly.

You can see the position in **Settings → Organization → Who has agreed to location recording**.
Every active worker is counted, including those who have not answered, so the number cannot
look better than it is by asking fewer people. If you want a high number there, the lever is
that staff have actually been told and actually agreed — not that you have recorded fewer
answers.

---

## If someone asks "what can you actually see?"

Being able to answer this precisely is most of the value of doing it properly. With location
recording **on**, against a carer's name and the visit, a manager can see:

- the carer's name, and the name and address of the person visited
- the position recorded at check-in, and the time
- the position recorded at check-out, and the time
- how accurate each of those two readings was
- who opened the check-in map, and when (opening the map is recorded)

They cannot see: a live feed, a position during the visit, where a carer is between visits,
where a carer is outside working time, or anything about a carer who has declined — for whom
there is no position at all.

One detail worth knowing: a carer who is too far away to check in is **not** recorded as
having tried. The app stops that on their phone and does not tell you about it. So you cannot
use the system to monitor failed attempts, and that is deliberate.

---

## What you can show an inspector

- **When location recording was switched off, and by whom.** Both are stored against your
  organisation and each change is written to the audit log. If the setting has been changed
  more than once, the history is still there — which is the point, because "when did you stop
  collecting, and who authorised it" is the first question of any review of staff monitoring.
- **Who was told, and what they answered.** The notice each carer was shown is recorded
  against their account, and their answer is recorded with the date and the version of the
  notice it was given under. The screen above shows all three.

What we cannot do is give you a lawful basis. That is yours to establish and document, and we
will not write it for you.

---

## Limits and what we cannot tell you

Stated plainly so nobody is surprised later.

- **It is per organisation, not per location or per branch.** If several registered
  organisations share a single Meticle Care account, the switch covers all of them together.
  We cannot scope it more finely than that.
- **It is not retroactive.** Already-recorded positions are not deleted by turning it off, and
  this is not a data-erasure tool.
- **Retention is your decision.** We store carer location on the visit record and have not set
  a separate deletion period for it. How long your organisation keeps visit records — and
  whether a carer's position should be held on the same basis as a client's clinical notes, or
  a shorter one — is a judgement for you and your data protection adviser. We think it is
  worth making explicitly rather than inheriting by default. Meticle Care's DPIA for this
  feature flags the same question and escalates it rather than answering it.
- **A carer cannot see their own position history in the app.** There is no in-app view of
  what has been kept about them. To see it, ask us; we will not produce it by default.
- **A carer who has not yet answered is not recorded from.** If someone has not got to the
  question, no position is collected from them. Silence is not agreement, and we do not
  treat it as one.
- **The app build matters.** The server-side guarantees above — no collection, no storage, map
  withdrawn — apply from the moment you save the setting, on any app version. However, the
  *app-side* change, where the app stops asking for the phone's location permission
  altogether, is a change to the mobile app and reaches carers when a new app build is
  published. **Until that build is on their phones, a carer may still see their phone ask for
  location permission even though you have turned the setting off.** Nothing is sent or stored
  — the server drops it — but if a carer asks, that is the honest answer, and it is better to
  give it than to have them discover it. We will tell you when the build is available.

---

## Related reading

- **Data Protection Impact Assessment — carer location** (`DPIA_Live_Active_Visit_Map.md`) —
  our full assessment of this feature, including the risks we think remain and what we do not
  claim. Written by engineers, not by a data protection professional, and it says so.
- **The notice your carers actually read** — every line of it is a claim about what the
  software does, and each claim is checked against the code rather than against our
  intentions. If you want to know precisely what a carer has been told, that is the text.

Questions about anything here, including anything you would rather not ask in writing, go to
your Meticle Care contact.
