# Medicines in care: which framework, and what the software actually does

**For a provider choosing a medication system, and for the person who has to
show an inspector it works.**

Last reviewed against `apps/api/src/modules/emedication/medicationFrameworks.ts`
and `medicationRules.ts`.

---

## The short version

MeticleCare refuses to record a dose that the framework you are registered
under does not permit. That is the whole claim, and the rest of this document is
how to check it.

Three frameworks are modelled, and which one applies is decided by the service
regulator you are registered with — not by a setting you choose:

| You are registered with | Nation | Framework the system applies | Inspected by |
|---|---|---|---|
| Care Quality Commission | England | Medicines for Care Homes (MCA) | CQC |
| Care Inspectorate Wales | Wales | All Wales Medicines for Care Homes (AWMCH) standard | CIW |
| Care Inspectorate | Scotland | Scottish medicines-in-care guidance | Care Inspectorate |
| RQIA | Northern Ireland | *None registered* — England's, as a labelled fallback | RQIA |

Northern Ireland is called out rather than left blank. There is no framework
registered for it, so England is applied and the system **says so** every time
you open the screen. If you are in Belfast, treat everything under MCA as
unconfirmed until somebody has checked it against whatever actually applies to
you.

## What is refused, and what is only reported

This distinction is the most important thing on this page. A software system
that lists fifteen requirements and enforces two of them is describing a policy,
not operating one. Every rule below is marked.

### Refused — the dose is not recorded

| Rule | What you get told |
|---|---|
| No named responsible clinician | "No registered nurse or pharmacist is recorded as responsible for medicines at this service." |
| No current competence for the person giving it | "No current medication competence assessment is recorded for you." |
| Controlled drug, no controlled-drugs scope | "This is a controlled drug and you have no current controlled-drugs competence recorded." |
| Controlled drug, no witness | "No witness was recorded for this controlled drug." |
| Witness is the person giving the dose | "The witness recorded is the same person giving the dose, which is not a witness." |
| Witness has no controlled-drugs scope | "The person recorded as witnessing this controlled drug has no current controlled-drugs competence." |
| PRN dose with no reason | "This medicine is recorded as 'as needed', so the reason has to be recorded with the dose." |
| Covert dose with no usable authorisation | Names the instrument your framework uses, and why the one you have does not satisfy it. |

A PRN medicine cannot be **added** without an indication and a 24-hour maximum,
which is caught by the person writing the prescription rather than by the care
worker on the round.

### Reported — shown to you, never blocks a dose

| Rule | Why it does not block |
|---|---|
| Structured medication review overdue | Refusing a dose because a review is late would push your staff back onto a paper MAR, which is worse for you than a visible overdue review. |
| Self-administration assessed | Recorded, not enforced. There is no self-administration data model yet. |

## The one rule that genuinely differs

**Covert administration rests on a different legal instrument in Scotland.**

In England and Wales it is a best-interests decision under the **Mental
Capacity Act 2005**. In Scotland it is not: it rests on the welfare powers in
the **Mental Welfare (Scotland) Act 2000**, and a written protocol is expected.

The system enforces this, and it is the clearest example of why the framework
being a property of the software matters. Recorded as an English best-interests
decision, a Scottish covert dose is **refused**, and the refusal names the
instrument. An English best-interests record is not accepted as satisfying a
Scottish requirement, and the reverse is equally refused in Wales.

A covert authorisation must also name the specific medicine it covers. A
blanket covert decision covering every medicine on a chart is refused, because
that is the practice these frameworks exist to prevent.

## What you have to set up, in this order

1. **A responsible clinician.** A named registered nurse or registered
   pharmacist, with their registration number. Nobody can administer anything
   until this exists. Appointing a new one ends the previous appointment and
   keeps the history — "who was accountable when" is the first question an
   inspection opens with, and deleting the answer is not an answer.
2. **Competence, per person.** Recorded with a scope, an assessor, a date and
   optionally an expiry. General `administration` covers ordinary medicines;
   `controlled_drugs` is separate and has to be recorded separately.
3. **Then** anything else: covert authorisations, medication reviews.

## What upgrading does to your existing data

Two things, and the second one is a real operational cost.

**Your existing competency ticks are carried forward.** Every staff member with
"medication competent" ticked on their record gets a real, dated, expiring
competence row so the system does not stop working on the day it deploys. Those
rows are tagged `backfilled_from_staff_flag` and have **no assessor, no
assessment date and no expiry**, because none was ever recorded. Your readiness
screen counts them separately, and you should read that count as "these people
have not been assessed by us", not as "these people are competent".

**Controlled-drug scope is deliberately not carried forward.** A tick that said
"may give medication" has never once meant "may give a controlled drug", and
inferring it would hand every existing care worker an authority nobody assessed
them for. After upgrading, controlled drugs are refused until you record the
scope. That is the intended behaviour and it is a change you need to plan for.

---

## What this document is not

**It is not a statement that your service complies with anything.** MeticleCare
holds the record. Your service is what is inspected, and the legal and clinical
judgement about what a person should be given is yours and your clinician's.

**The framework names are not verified against a primary source.** The
identifiers above are the ones the sector uses, and the rules are the
operational shape these frameworks describe — but the editions, dates and
precise wording have not been checked against the current published guidance
by anyone here. `verified_against_primary_source` is `false` on every framework
in the code and is returned by the API on purpose. Confirming them is tracked
as **T2-22**.

Read that as: the software asks the right questions, and it has not been
signed off by anybody qualified to say the answers are complete.
