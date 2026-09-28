# INNF 8.2 — viability evidence

**Status:** internal analysis — for the endorsement file. Prepared 28 September
2026. Companion to the `INNF_8.3d_*` pack; read this first, because it identifies
which criterion we actually fail.

## The criteria, in the Home Office's own words

The Innovator Founder route endorses a business that is **innovative, viable and
scalable**. These are three separate tests, and each must be satisfied:

- **Innovation** — "a genuine, original business plan that meets new or existing
  market needs and/or creates a competitive advantage."
- **Viability (8.2)** — "your business plan must be realistic and achievable
  based on your available resources and you must have, or be actively developing,
  the necessary skills, knowledge, experience and market awareness to
  successfully run your business."
- **Scalability (8.3(d))** — "there must be evidence of structured planning and
  of potential for job creation and growth into national and international
  markets."

## Scorecard

| Criterion | What an assessor looks for | Where we are |
|---|---|---|
| Innovation | Genuine originality; a real market need or a competitive advantage | **Strong.** Four-nations compliance engine, on-demand location privacy (continuous tracking deleted, kill switch, DPIA v1.0–1.4), a governed AI capability registry with method disclosure. Every claim verifiable in the repo. |
| **Viability** | Realistic plan against real resources; founder skills; **market awareness** | **Weak — this is the actual gap.** Below. |
| Scalability | Structured planning; job creation; national and international growth | **Now documented** (`INNF_8.3d_*`) — but it rests on viability: a scalability plan built on unvalidated demand is not credible. |

**The second reviewer's point, accepted and sharpened:** everything built so far
is evidence of *innovation and capability*. The route scores *viability*, which
is evidenced by other people — customers, advisers, a funding record — not by the
codebase. No further engineering moves this score.

## Limb A — "realistic and achievable based on your available resources"

**The model is not the problem.** `docs/funding/meticlecare-financial-model.html`
§6.2 already states the honest requirement: £542k cash to break-even at month 30,
a £600k recommended raise, and **£400k–£650k total funding needed** across an
initial raise and a bridge round at months 12–15. That is a coherent plan.

**The problem is commitment.** None of it is committed. SEIS advance assurance
is *prepared* (August 2026), no investors are named, no LOIs exist, and committed
funds appear nowhere in the pack. An assessor asking "achievable based on your
available resources" is asking one question: *what have you actually secured?*
Today the honest answer is: nothing yet.

**Fix — a funding and runway statement (T3-7, owner Adetoye).** One page, dated,
four rows:

| | Amount | Evidence to attach |
|---|---|---|
| Committed (signed) | £— | share subscription agreements, bank statements |
| Conditional (named, in process) | £— | investor name, stage, expected date |
| Forecast (not yet raised) | £— | round plan, timing, target list |
| **Total requirement** | **£400–650k** | financial model §6.2 |

It doubles as the endorsement requirement on the "legitimacy of the sources of
funds": the trail of where every pound comes from is the same document.

## Limb B — "necessary skills, knowledge, experience and market awareness"

Three parts, not equally evidenced:

- **Skills and knowledge** — strong on paper: the platform is built, tested and
  deployed (`INNF_8.3d_FOUNDERS.md`). Two gaps: the founder CVs are unwritten
  (T3-4), and there is no named DPO or compliance adviser — the tracker's
  "Appoint" role is a genuine skills gap for a health-data business, not just an
  open task.
- **Experience** — whatever the founders' prior careers were, it is not
  documented. Nobody outside the company can read it.
- **Market awareness** — **the weakest limb, and the most fixable.** Market
  awareness is evidenced by documented contact with buyers, not by desk
  research. The pack records "providers spoken to — in progress" and nothing
  more: no interviews, no notes, no names, no findings. The market research
  shows *we can read*; it does not show *we have listened*.

**Fix — run the interview protocol (T3-2, owner Adetoye).**
`INNF_8.2_CUSTOMER_INTERVIEW_PROTOCOL.md` turns 15–20 structured conversations
into a dated, citable evidence base. It is deliberately research rather than
sales: 15 interviews with no conversion still satisfies this limb; a signed LOI
satisfies it more strongly, and is the same conversation continued.

## Two structural warnings

**1. If both founders apply, each needs their own endorsement — and one is
currently not eligible.** Every applicant must receive an individual
endorsement, must be a director or member of the business, and must be an
instrumental member of the founding team. The SEIS document in `docs/funding/`
names **Opeyemi as sole director and 100% shareholder**. On that record Adetoye
cannot be endorsed for this business, because he holds no directorship or
membership. That is a decision, not a document: either Opeyemi applies alone, or
the Companies House record changes first. **Sequencing trap:** the advance
assurance is built around the current share structure, so issuing shares to add
a director/founder before the raise can invalidate it — and the valuation and
allotment questions that raises are a solicitor's job, not an engineer's. Decide
the applicant set *before* the raise (T3-8).

**2. The endorsed plan becomes a monitored commitment, so a bigger plan is a
worse plan.** The route requires at least two contact point meetings per grant of
leave, endorsers check progress against the endorsed plan, and endorsement can be
withdrawn if progress departs from it. Submitting the full three-year model — 20
staff, break-even at month 30, three international markets — means committing in
writing, in advance, to numbers nobody has validated. **Recommendation: endorse
a staged plan.** Put Year 1 forward as the endorsed commitment (hiring
triggers, pilot targets, funding milestones) and present Year 2–3 expansion as
options that follow the evidence. A modest plan that is hit is a strategy; an
ambitious plan that is missed is a withdrawal.

## Fit-and-proper: the go-live tracker is also visa evidence

The endorsement letter must confirm the applicant is a "fit and proper person",
with no concerns about the sources of funds or unexplained wealth. Several Tier 0
items are therefore not only product hygiene — they belong in the visa file: PI
insurance (T0-7), solicitor-reviewed terms (T0-8), a standalone DPA (T0-9), the
organisation-wide DPIA (T0-5), and the Art 28 / transfer-basis position on AI
(T0-17b). A business that cannot produce a DPIA, insurance and a DPA is harder to
call fit and proper, whatever its code looks like.

## What only owners can do

Nothing in this document closes by engineering. The two moves that change the 8.2
score are both commercial: **run the interviews** and **convert one provider into
a signed design partner**. The rest of this file is preparation for that
conversation.
