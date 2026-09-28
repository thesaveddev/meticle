# INNF 8.3(d) evidence index

**Status:** master index — prepared 28 September 2026, by engineering, for
Adetoye to complete the commercial evidence. **Read this before reading or
submitting anything else in the pack.** It maps the endorsement requirement to
every artefact that answers it, and it keeps one honest ledger of what is real
today versus what becomes real only when its owner acts.

**The requirement (INNF 8.3(d)):** *"evidence of structured planning and of
potential for job creation and growth into national and international markets."*

**Correction, 28 Sep 2026 — the route scores three criteria, not one.** The
Home Office endorses a business that is **innovative, viable and scalable**.
8.3(d) is the scalability limb only. Read against the viability limb
(`INNF_8.2_VIABILITY_EVIDENCE.md`), the honest diagnosis is that the pack
addresses scalability well, innovation well, and **viability barely** — and that
viability is evidenced by customers, advisers and a funding record, never by the
codebase. Start there, not here.

**A claim made in this pack is either** (a) evidenced in the repository or in a
dated external source, **(b) a plan clearly labelled as a plan, or (c) absent.**
Nothing is presented as traction that is not traction; the reviewer's central
criticism — *"everything you have built is evidence of capability; none of it is
evidence of viability"* — is answered by building the viability layer *and*
keeping it honest, because an overstated viability file is worse than a modest
true one.

---

## 1. Requirement → evidence map

| Requirement element | Evidence | State |
|---|---|---|
| **Structured planning** — business plan | `docs/funding/seis-advance-assurance.html` (§Business Plan, HMRC submission) + `docs/funding/meticlecare-pitch-deck.html` (three-phase commercialisation) | **Exists** (dated Aug 2026; review for currency before submission) |
| Structured planning — financial model | `docs/funding/meticlecare-financial-model.html` (3-year P&L, cash flow, sensitivity, EBITDA break-even Month 30, £542k cash to break-even) | **Exists** |
| Structured planning — pilot design | `docs/funding/nhs-pilot-proposal.html` + `INNF_8.3d_PILOT_AND_LOI_KIT.md` §2 | **Exists** |
| Structured planning — go-to-market | `docs/funding/meticlecare-sales-package.html` (procurement readiness, pricing) + `INNF_8.3d_PILOT_AND_LOI_KIT.md` §3 | **Exists** |
| Structured planning — delivery capability | `docs/GO_LIVE_READINESS.md` (tracker with owners/evidence, 40+ items), `docs/ONBOARDING_READINESS.md`, 1,000+ automated tests, CI claim guard | **Exists, verifiable in repo** |
| **Job creation** — plan | `INNF_8.3d_JOB_CREATION_PLAN.md` (2 → 20 over 3 years, role-by-role, trigger-gated; from the model's §4.1 headcount) | **New — plan only; no hires yet, says so** |
| Job creation — founder team | `INNF_8.3d_FOUNDERS.md` scaffolds → real CVs | **New — scaffolds; content pending from founders** |
| **Growth into national markets** | Four-nations architecture (CQC/CIW/Care Inspectorate/RQIA) built: `frameworks.ts`, `compliance.vetting.ts`, `regulator_registrations` (migration 129); market sizing `INNF_8.3d_MARKET_RESEARCH.md` | **Built (capability) + market research (new)** |
| **Growth into international markets** | `INNF_8.3d_INTERNATIONAL_GROWTH_PLAN.md` (Ireland → Australia → NZ, entry-condition gated; from `MULTI_JURISDICTION_EXPANSION_RESEARCH.md`) | **New — plan; research already existed** |
| **Market research** | `INNF_8.3d_MARKET_RESEARCH.md` (sourced, dated: £13.4bn domiciliary, 15,232 CQC agencies, 9.1% vacancy) | **New — with open items for Adetoye** |
| **Customer / pilot / LOI / revenue** | `INNF_8.3d_PILOT_AND_LOI_KIT.md` pipeline + signed LOIs | **NOT REAL YET — 0 LOIs, 0 pilots. Only Adetoye can create these.** The kit is the acquisition machinery; the artefacts must be earned. |
| **Viability (8.2)** — plan realistic against *available resources* | `INNF_8.2_VIABILITY_EVIDENCE.md`; the financial model already bridges the gap honestly (total need £400–650k across two rounds) | Model sound; **committed funds unproven** — T3-7 |
| **Viability (8.2)** — founder skills, experience, **market awareness** | `INNF_8.2_VIABILITY_EVIDENCE.md`; `INNF_8.2_CUSTOMER_INTERVIEW_PROTOCOL.md`; CV scaffolds | **The real gap.** Desk research is not customer contact — T3-2/T3-4 |

## 2. The honest ledger (update as state changes)

| Evidence class | Real today | Becomes real when | Owner |
|---|---|---|---|
| Business/financial/pilot planning | ✅ | — | Adetoye (currency review) |
| Market research (sourced) | ✅ (4 open items in §6 of that doc) | — | Adetoye |
| Job-creation plan | ✅ as a plan | first hire starts | Adetoye |
| Founder CVs | ⬜ scaffolds only | founders complete them | Adetoye + Opeyemi |
| National growth capability | ✅ built | first non-England customer | shared |
| International growth plan | ✅ as a plan | Ireland entry conditions met (§2 of that doc) | Adetoye |
| **Customer / LOI / pilot / revenue** | ⬜ **zero** | first signed LOI → first pilot → first invoice | **Adetoye** |

**The bottom line for the endorsement file:** the planning layer is now
complete and honest. What the file will still lack until the pipeline runs is
**third-party validation** — a signed LOI from a named provider outweighs every
document in this pack combined. Start with `INNF_8.3d_PILOT_AND_LOI_KIT.md` §3
this week.

## 3. Reading order for an assessor

1. `INNF_8.2_VIABILITY_EVIDENCE.md` — the limb we actually fail, and the two
   structural warnings. **If short on time, read this one only.**
2. `INNF_8.2_CUSTOMER_INTERVIEW_PROTOCOL.md` — the record of having talked to
   buyers, with counts.
3. `INNF_8.3d_MARKET_RESEARCH.md` — the market, sourced and dated.
4. `INNF_8.3d_JOB_CREATION_PLAN.md` — who gets hired, when, and why.
5. `INNF_8.3d_INTERNATIONAL_GROWTH_PLAN.md` — national/international sequencing.
6. `docs/funding/meticlecare-financial-model.html` — the numbers behind 4 and 5.
7. `INNF_8.3d_PILOT_AND_LOI_KIT.md` + signed LOIs — the demand evidence.
8. `INNF_8.3d_FOUNDERS.md` — the team.
9. `docs/GO_LIVE_READINESS.md` — proof that plans here get executed (the
   tracker's closed items are executed planning, not promises).

## 4. Assembly checklist (before the file leaves the company)

- [ ] Founder CVs completed and signed off by both founders (`INNF_8.3d_FOUNDERS.md`).
- [ ] Salary bands in the job-creation plan confirmed against current market data (marked *indicative*).
- [ ] Market research's four open items closed (§6 of that doc).
- [ ] At least one signed LOI in hand, or the file submitted with the pipeline section showing dated outreach activity instead.
- [ ] Financial model and pitch deck reviewed for currency (dated Aug 2026).
- [ ] Claims guard green: `npx vitest run src/__tests__/claimsSweep.test.ts` from `apps/web` (nothing in this pack may be quoted on public pages without evidence).
- [ ] **Applicant set decided** (T3-8): one applicant or two, and the Companies House record matches. Each applicant needs their own endorsement and must be a director or member.
- [ ] **Staged plan submitted** (T3-9): Year 1 as the endorsed commitment, Year 2–3 as options — the endorsed plan is monitored at contact point meetings, so a plan that is missed can cost the endorsement.
- [ ] **Committed-funds statement** (T3-7) attached: committed / conditional / forecast / total requirement, with the source-of-funds trail.

---

*Tracker: Tier 3 of `docs/GO_LIVE_READINESS.md` tracks these items (T3-1 …
T3-6) with owners. This index is the map; the tracker is the commitment.*
