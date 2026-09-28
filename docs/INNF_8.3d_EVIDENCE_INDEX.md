# INNF 8.3(d) evidence index

**Status:** master index — prepared 28 September 2026, by engineering, for
Adetoye to complete the commercial evidence. **Read this before reading or
submitting anything else in the pack.** It maps the endorsement requirement to
every artefact that answers it, and it keeps one honest ledger of what is real
today versus what becomes real only when its owner acts.

**The requirement (INNF 8.3(d)):** *"evidence of structured planning and of
potential for job creation and growth into national and international markets."*

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

1. `INNF_8.3d_MARKET_RESEARCH.md` — the market, sourced and dated.
2. `INNF_8.3d_JOB_CREATION_PLAN.md` — who gets hired, when, and why.
3. `INNF_8.3d_INTERNATIONAL_GROWTH_PLAN.md` — national/international sequencing.
4. `docs/funding/meticlecare-financial-model.html` — the numbers behind 2 and 3.
5. `INNF_8.3d_PILOT_AND_LOI_KIT.md` + signed LOIs — the demand evidence.
6. `INNF_8.3d_FOUNDERS.md` — the team.
7. `docs/GO_LIVE_READINESS.md` — proof that plans here get executed (the
   tracker's closed items are executed planning, not promises).

## 4. Assembly checklist (before the file leaves the company)

- [ ] Founder CVs completed and signed off by both founders (`INNF_8.3d_FOUNDERS.md`).
- [ ] Salary bands in the job-creation plan confirmed against current market data (marked *indicative*).
- [ ] Market research's four open items closed (§6 of that doc).
- [ ] At least one signed LOI in hand, or the file submitted with the pipeline section showing dated outreach activity instead.
- [ ] Financial model and pitch deck reviewed for currency (dated Aug 2026).
- [ ] Claims guard green: `npx vitest run src/__tests__/claimsSweep.test.ts` from `apps/web` (nothing in this pack may be quoted on public pages without evidence).

---

*Tracker: Tier 3 of `docs/GO_LIVE_READINESS.md` tracks these items (T3-1 …
T3-6) with owners. This index is the map; the tracker is the commitment.*
