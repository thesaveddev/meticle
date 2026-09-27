# Before we take our first paying customer

**For:** Adetoye Adenuga
**From:** engineering
**Written:** 27 September 2026
**Read time:** 10 minutes. The whole point of this is that you can work through it without opening a terminal.

---

## How to use this

Everything is in three boxes. The box tells you **who has to do it**.

| | Meaning |
|---|---|
| 🟢 | **You can do this yourself.** A browser, an account, maybe a decision. No developer needed. |
| 🟡 | **You decide, pay, or grant access.** Might need a developer to *carry it out*, but the block is a decision, a budget, or a login only you can give. |
| 🔴 | **A developer has to write or fix something.** You cannot unblock this on your own, and it is not a quick favour. |

There is a trap in reading any list like this: treating the 🟢 items as optional because they are easy, and the 🔴 items as someone else's problem. The thing most likely to embarrass us in front of a first customer is item 2 — a promise on our own website about recovering their residents' data, half of which we cannot keep. It is marked 🟡 because the decision is yours, and it is waiting on you, not on me.

**If you only do three things,** do 1, 2 and 3. They are the difference between "we onboarded a customer" and "we onboarded a customer and could prove we did nothing wrong".

Three items on this list were open when it was first written and have since been fixed by engineering — 4, 7 and 8. They are marked ✅ and the reasoning is kept, so the list reads as a record of decisions rather than a wish list.

---

## Tier 0 — before the first paying customer

### 1. 🟡 The website says we are "ICO registered". We have not registered.

> **DECISION 27 Sep: register and keep the claim.** Adetoye is registering with the ICO. Once the number exists, it has to be added to `FeaturesPage.tsx:305` — the sentence is not true until the number is on the page, so the claim stays under review until then.

This is the most urgent item on the list, and it is not a technical problem.

`apps/web/src/pages/marketing/FeaturesPage.tsx:305` tells visitors:

> **UK GDPR & DPA 2018** — "ICO registered. UK data sovereignty. No data leaves UK jurisdiction."

There is no ICO registration number anywhere in the product, and our own readiness list has ICO registration as **Not Started**.

This matters more than a normal marketing inaccuracy. We are selling software that holds health data about named, vulnerable people, to care homes and NHS trusts. A care home's compliance lead *will* check the ICO register. It is a two-minute check and it is exactly the sort of thing that gets made. If we are not on that register, the claim is not a "slightly bold" claim — it is a false statement about our regulatory status on our marketing site, and it is the kind of thing that damages trust permanently once seen.

**What to do:**

- **Register with the ICO.** Go to [ico.org.uk](https://ico.org.uk) → register as a data controller. Roughly £40–60/year, about an hour of forms, and it is a legal requirement for us to be doing anyway. Then add the registration number to that sentence.
- **Or change the sentence** to something we can defend, such as *"UK GDPR & DPA 2018 compliant. UK data sovereignty. No data leaves UK jurisdiction."* — drop the three words "ICO registered."

**We have decided to register**, so the fallback is no longer needed — but please do not treat the claim as settled until the number is actually on the page. The single most important part of this task is not the forms; it is the follow-up edit, because that is what stops us making a claim we cannot back up.

---

### 2. 🟡 One half of our backup claim is true, and the other half is not

`FeaturesPage.tsx:302` promises customers:

> **Automated Daily Backups** — "Point-in-time recovery available. Full database snapshots every 24 hours with 30-day retention."

I checked the actual backup configuration, and it splits cleanly in two. **This matters, because we currently promise a customer the stronger half and can only deliver the weaker one.**

**What is true:** backups are real and well built. A scheduled job takes a full database snapshot every night at 2am and keeps them for 30 days. The script is careful — it writes to a temporary file and only renames it into place once the dump has fully succeeded, so a backup that is interrupted cannot masquerade as a good one. That is the correct way to do it, and I would rather say so than treat it as a problem.

**What is not true:** "point-in-time recovery" is a different capability from a nightly snapshot, and we do not have it. Point-in-time recovery means being able to rewind the database to an arbitrary moment — 10:15am on Tuesday — which requires continuously archiving the database's write-ahead log. **We are not archiving that log.** Our configuration has no WAL archiving, no `pgbackrest`, no `wal-g`, nothing of that kind. The only way back is the last nightly snapshot.

The practical difference, for a care home, is this: if something corrupts the database at 9am on a Tuesday, we restore to **2am on Tuesday**. Everything the service did in those seven hours is gone. For a system holding medication administration records and daily care notes, a day of missing entries is a serious incident, not an inconvenience.

**So there is a straight choice, and it is yours:**

- **Tell the truth, cheaply.** Change the sentence to describe what we actually do — *"Automated daily backups. Full database snapshots every 24 hours, retained for 30 days."* — and drop the two words "Point-in-time recovery". Costs you five minutes, and it is defensible in front of any customer's IT lead who asks a follow-up question. **I recommend this, and I would do it today regardless of what you decide below.**
- **Or make the claim true.** Proper point-in-time recovery means adding WAL archiving to the backup job, which is a half-day of work plus somewhere to put the archived logs. It is a real, contained piece of engineering, and it closes the gap rather than papering over it.

I would not leave the current wording up while deciding. It is the specific sentence in this document that I would not want a compliance lead to read aloud.

**Either way, we should still prove a restore works.** The backups existing and the backups *restoring* are separate claims, and nobody has ever tried the second one. That test needs production database access, so tell me how you want that arranged — I run it, or you run the commands and send me the output, or we do it together on a screen share. Until that has happened once, treat "we have backups" as an untested assumption.

---

### 3. 🟢 Monitoring is installed — but nobody has proved it is watching, or that it tells anyone

I had this wrong when I first wrote this list, so here is the corrected version.

Monitoring software **is** deployed. Uptime Kuma runs as a service alongside the database and the app, and it is deliberately kept off the public internet — bound to loopback, reachable only through our own proxy. That part is good practice and it is done.

The problem is what I cannot see: whether anyone has actually set it up. Uptime Kuma does nothing until someone logs in and creates monitors pointing at our website and API, and then adds contacts to be told when one goes red. Both of those live inside the tool's own database, not in the code, so **there is no way for me to confirm from here that a single check exists.**

So the honest position is: *we have the instrument, and I cannot tell you whether anyone is listening to it.* Please open it and check. It should be reachable at `http://127.0.0.1:3099` on the server, or through the proxy.

**What to do — about 30 minutes, and it is genuinely quick:**

1. Log in to Uptime Kuma on the production server.
2. Confirm there is a monitor for `https://meticlecare.com` and one for the API health endpoint, both checking every few minutes.
3. Confirm an alert contact is set — and that it goes to **a phone**, not just an email inbox. An outage that emails an inbox nobody is watching is the same as no monitoring at all.
4. Deliberately break something for thirty seconds, or use Kuma's own "test" button on the alert, and confirm the alert actually arrives. **This is the step people skip.** A monitor that has never fired is an untested monitor.

While you are in there, also write down a **break-glass contact route that does not use email**. If the server dies, or someone needs to reach us at 3am, email may be exactly the thing that is broken. Agree a phone number now, while nothing is on fire.

The reason this matters is not abstract. We are proposing to run mission-critical software for care homes — medication records, care notes, rota. Their operational question is "if it is down at 7am on Monday and the medication round has not been logged, who do I ring?" An untested monitor means we cannot answer that question honestly.

---

### 4. ✅ FIXED 27 Sep — a whole care home signing up at once hit a rate limit

**This one is done, and nothing is left for you to do.** Read it anyway, because there is one deliberate decision in here that looks wrong until you know why, and I would rather you had the reasoning than found it later.

**The problem.** Our limits are counted **per IP address**. A care home is one office on one internet connection, so activating a customer meant 15–30 of their staff sharing a single budget of 5 registrations per 15 minutes and consuming it between them. The limit was sized for "one person" and was being used up by "one customer".

**First, a correction to what I told you originally.** I said the request "fails quietly". That was wrong, and it matters, because I had built a recommendation on it. The form does show an error — a proper one, saying how many times the request was refused. The real defect was quieter and more wasteful than a missing message: **the person was being shown a failure for something that was a few seconds of normal congestion behind us**, and so they gave up on a signup that would have worked moments later.

**What I changed, and why it is the right way round rather than just a bigger number:**

1. **Registration: 5 → 30 per 15 minutes.** Safe to be this generous because creating an account already requires proving you own the mailbox. Every one of those 30 requests corresponds to a real inbox someone controls — a far stronger check than counting requests.

2. **The site now waits the limit out instead of showing an error.** This is the part that actually fixes it. The server tells the client exactly how many seconds to wait, and the signup button now waits and tries again on its own. A burst of twenty people onboarding together now succeeds and **nobody sees a failure at all.** Before, the unlucky ones who clicked during the peak were shown an error and lost.

3. **Verification codes: 5 → 10 per minute.** This is the one that looks like a compromise, so here is the reasoning. There are two different limits here and they do different jobs. The strict one is **per recipient** — three codes per address per 15 minutes — and that is untouched, because it is the control that actually protects an individual mailbox. The per-IP one exists only to bound volume, and an unwanted verification code is low harm: fixed text, no link, nothing to click. A tight cap on it bought little safety while breaking the most common moment in onboarding.

4. **Password resets: 5 → 20 per hour.** Same reasoning, even more comfortably. A reset email can only be sent to an address that **already has an account**, so the worst case is a nuisance email to someone who is already our user. It cannot be used to contact a stranger. Four staff forgetting passwords on the same Tuesday morning is an ordinary day at a care home, not an attack.

**The one thing I deliberately did not do:** I did not make the site retry everything that hits a rate limit. A *per-recipient* cap is not congestion — if someone has used their three codes, no amount of waiting inside that request helps, and retrying would quietly burn their remaining allowance while the page appeared to hang. Those still surface immediately, with the server's own wording, which is the more useful message anyway.

**For your support notes:** if anyone does report a rate-limit message, it is now always specific — either a number of seconds or a number of minutes — and a signup that hits one will usually have recovered on its own before they noticed.

---

### 5. 🟡 Insurance and legal sign-off

Two things a paying care home's owners or compliance lead will expect to see, and neither is mine to arrange:

- **Professional indemnity insurance** covering software defects that cause harm in a care setting. Budget roughly a week to arrange. Also ask about cyber liability cover.
- **A solicitor review** of the Terms of Use and the Privacy Policy. Ours were written by engineers. Care-sector software needs a real look at the liability and indemnity clauses.
- **A standalone Data Processing Agreement.** Our Terms reference a DPA, but the DPA does not exist as its own document. A care home signing up as a data controller will ask for it.

Send me the solicitor's edits when they come back and I will implement them.

---

### 6. 🟡 The organisation-wide Data Protection Impact Assessment does not exist

We do have one DPIA in `docs/DPIA_Live_Active_Visit_Map.md` — but read what it is. It assesses **one feature** (the live map showing where carers are during visits). It was written by engineering.

Processing health data at scale requires an **organisation-wide** DPIA under UK GDPR Article 35, covering lawful basis, data minimisation, retention periods, international transfers, and automated decision-making. That does not exist yet, and our readiness list has it as Not Started.

One specific point that needs a legal opinion rather than an engineer's: **we publish a retention position on our account-deletion page** stating that a worker's professional name is kept after their record is deleted, and that care-provider records are retained. That position is published on the public website already. It was written by us. Nobody has checked it. If it is wrong, we have published a commitment we do not meet.

**What to do:** commission a DPO or data-protection solicitor to review the existing feature DPIA and write the organisation-level one. The live-map DPIA gives them a genuine head start.

---

## Tier 1 — first week of real customers

### 7. ✅ FIXED 27 Sep — the "forgot password" dead end

**Also done, nothing for you here.**

For the record, this one was closer to correct than I first thought when I wrote the list. The reset page already said "If an account exists for {your email}, you'll receive a reset link shortly" — carefully worded so it does not reveal whether your address is registered, which is the whole point of that design.

The real gap was what happened next: someone who has never signed up was told to check their inbox, with no way forward except pressing the button again and receiving nothing. That page now offers a "Create one" link instead. It appears to everyone, whether or not the address is registered, so it gives away nothing — the check is unaffected.

---

### 8. ✅ FIXED 27 Sep — the signup wizard had no working tests

**Also done.** The onboarding wizard — the first thing a new customer sees after creating an account — had six tests and all six were failing, because the test's fake network layer had fallen behind the code.

The wizard itself was fine, and I confirmed that before changing anything rather than assuming. But the effect was that our safety net for the most customer-critical flow in the product was dead, and the next change to it would have failed silently.

Now fixed and expanded to ten tests, including three that were missing entirely and that I think matter more than the six that existed:

- **Picking up where you left off.** A customer who abandons onboarding and returns days later. Care homes activate over days, not one sitting, so this is the *normal* path and it had no coverage at all.
- **Already finished.** Confirms a user who completed onboarding is not shown the wizard again — they are not silently able to overwrite service types that are in real use.
- **The network drops mid-load.** Previously a failed load could leave someone staring at a spinner with no way forward. That is now a clear message, and it is tested.

I deliberately checked that these new tests actually fail when I break the code, rather than trusting that green means working. All three do.

---

### 9. 🟡 The mobile app cannot be submitted without your accounts

The app itself is built. What is missing is entirely on your side of the wall, and none of it is engineering:

- **Apple Developer account** and **Google Play developer account**, if you do not have them. These are organisational accounts paid for by the company, and they should be in the company's name, not a personal one — you do not want to leave the company unable to update its own app.
- **The privacy forms** for both stores. I have already drafted every answer from the code, in `docs/STORE_PRIVACY_ANSWERS.md`. They need your review and your signature, not more engineering. Be careful with these: they are legal declarations, and a store rejection over a mis-stated data practice is a delay measured in weeks.
- **The Play upload key.** ⚠️ **The very first bundle you upload permanently fixes this key.** Get it wrong and you cannot ship another update to that listing without deleting the app and starting the listing history again. Please do not do this one casually — I have written the exact commands in `docs/STORE_RELEASE_RUNBOOK.md`, and I will walk you through it.
- **Store screenshots.** Needs a physical phone or a computer with the app running. Nobody has done this pass. It is the only remaining gap that is a hardware constraint rather than a missing decision.

---

## Tier 2 — before you scale past the first few customers

These do not block a first customer, but they become urgent fast. From `docs/MeticleCare_GoLive_Readiness.csv` (currently 33 items, all "Not Started", no owners — I suggest we rewrite it with names on it).

**You can start now, no cost:**

| Item | Why | Effort |
|---|---|---|
| Independent penetration test | We have secured this ourselves, repeatedly, which is exactly why an outside pair of eyes matters before customer data arrives. Budget £3–5k. | 1–2 weeks |
| Uptime monitoring + alerting | The tool is deployed; item 3 above is about proving it works and that it alerts a phone. Half an hour. | 30 min |
| API key rotation policy | We hold live keys for OpenAI, Anthropic, Stripe. Put a recurring calendar reminder in place. | 2 hours |
| Verify rate limits in production | Test that the limits genuinely return a clear error rather than failing quietly. Related to item 4. | 2 hours |
| Customer support process | Decide how support tickets arrive and who answers. Write it down. | Half a day |
| Incident response plan | What happens if we lose data, or the site goes down, or there's a safeguarding concern? Who decides, who tells the customer, what do we say? Write it *before* you need it. | 2–3 days |
| CQC registration question | Find out whether we need to register, or whether we are purely software for registered providers. A phone call or an email. | Research |

**Needs budget or an adviser:** professional indemnity insurance (item 5), solicitor reviews, DPIA sign-off, backup restore testing (item 2), load testing, disaster recovery runbook, WCAG accessibility audit, data retention policy implementation, AI output labelling audit.

---

## Already done — do not redo these

So you don't go looking for work that's finished:

- ✅ **Email authentication is correct and verified.** SPF, DKIM and DMARC all pass on mail the application itself sends. Gmail confirms `dkim=pass`, signed with our published key. This was the big one — verification codes will arrive in Gmail without landing in spam, and nobody can send mail pretending to be from us. Full evidence in `docs/EMAIL_SECURITY_RUNBOOK.md`.
- ✅ **The misleading ISO 27001 claim was removed.** It used to appear in our privacy policy and would have been a false certification claim. It is gone. Do not let anyone add it back.
- ✅ **Account deletion page exists** and is publicly linked, as Apple and Google both require.
- ✅ **Tenant isolation is enforced in the database itself**, not just in application code, so a bug in our code cannot leak one care home's data into another's.
- ✅ **Login and signup are hardened** against account enumeration and timing attacks.
- ✅ **No passwords, keys or `.env` files are in the code repository.**

---

## Two traps, so you don't lose a week to each

**1. Don't use the demo data against production.** There is a seed script that creates a fully populated demo organisation — 3 care homes, staff, residents, rotas, medication records. It creates a super-admin account. It is hard-blocked from running in production unless a specific override flag is set, which is deliberate and should stay that way. It exists for demos and screenshots. It is not customer data.

**2. The first store upload fixes the upload key forever.** See item 9. This is the single most expensive mistake available to us right now, and it is entirely a "didn't read the warning" mistake.

---

## What I'd do first, if it helps

Send Adetoye this in priority order: **1** (an hour, removes a false legal claim), **2** (five minutes to correct a claim we cannot back up, then a restore test), **3** (half an hour, finds out whether our monitoring works). Items 5 and 6 need a budget conversation and start clocks that take weeks, so they should be started in parallel even though they finish last.

Items 4, 7 and 8 were open when this was first written and are now done. The reasoning behind each is kept, because "we can't register a whole care home at once" and "we deliberately did not raise the email-code limit" are the kind of things that look like bugs to whoever is on support, and I would rather they were written down than remembered.

**Two corrections I made to this document after writing it,** because both of my first answers were wrong and the corrections changed what the tasks actually are:

- I said we had no uptime monitoring. We do — Uptime Kuma is deployed and correctly kept off the public internet. The real task is proving anyone configured it.
- I said the backup claim was untested and probably untrue. Half of it is true and well built; the other half — "point-in-time recovery" — is genuinely not something we can do today.

I would rather flag both than quietly leave the first draft standing.

**Still waiting on you:** the restore test in item 2. I have the procedure ready; it needs production database access, so tell me how you want that arranged — I get credentials, or you run the commands and send me the output, or we do it together on a screen share.
