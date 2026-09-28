# Multi-jurisdiction expansion research

**Status:** internal research paper — for Adetoye's go/no-go. **Evidence verified
28 Sep 2026** via regulator sites and 2025–26 legislation; anything not
primary-sourced is marked. Builds directly on the four-nations work
(`frameworks.ts`, `compliance.vetting.ts`, `regulators.ts`): the pattern to
repeat is *registry + migration + per-nation resolution*, and the estimate for
each candidate assumes that pattern.

**The question is not "where can we sell" but "where does our four-nations
architecture transfer with the least new modelling" — because that is what
determines cost.**

---

## Candidate 1 — Ireland (HIQA): strongest, with a deadline tailwind

**Regulator:** HIQA (Chief Inspector within HIQA), under the Health Act 2007
for existing centres. **The change that makes this the top candidate:** the
Health Bill 2025 pathway brings **home support (domiciliary care) into HIQA
registration for the first time**, with draft National Standards for Home
Support Services published (hiqa.ie, 2024) and a registration requirement with
a transitional period for existing providers (Lexology, Sep 2026). Every
Irish homecare provider is about to face, for the first time, the exact
compliance burden our product automates — and they have no incumbent
inspection-ready software to turn to.

**What transfers from the four-nations work with minimal change:**

| Dimension | Ireland | Cost to model |
|---|---|---|
| Framework shape | HIQA standards thematic model | Low — mirrors CQC/CIW domain structure already in `frameworks.ts` |
| Background check | **Garda vetting** — one scheme, one issuer, no tiers like DBS/PVG | **Lowest of any jurisdiction** — a one-row `vetting_schemes` seed |
| Right to work | Employment Permits / EU residency | Low — same `IDENTITY_TYPES` pattern |
| Data protection | **EU GDPR + Irish DPC** | Medium — see data transfer below |

**The real cost is not the framework — it is data residency.** An Irish
provider's care records under EU GDPR cannot casually sit in a UK-primary
database. Options, in order of preference: an EU-region Postgres (Hetzner
Helsinki/Falkenstein or AWS eu-west-1 Dublin) with the same compose stack and
region-scoped tenancy routing; or EU-resident hosting partner. This is the
one genuinely new engineering investment: **tenancy-region routing + an EU
deployment**, estimated 3–5 weeks. The AI processor gate (`AI_APPROVED_PROCESSORS`,
T2-21) is already per-deployment, which helps: an EU deployment's allowlist
differs by default.

**Verdict: best candidate.** Regulation arrives on a known timetable, the
vetting model is trivially small, the framework shape is familiar, and
first-mover inspection-readiness is a sale our four-nations customers
already understand. Main risk: the Bill's commencement date has slipped
before — verify the current status before committing a quarter.

## Candidate 2 — Australia (ACQSC): large market, tiered model is genuinely new

**Regulator:** Aged Care Quality and Safety Commission, under the **Aged Care
Act 2024** — in force from 1 Nov 2025, with the *Support at Home* program
replacing home-care packages. All government-funded providers must be
registered; the new Act introduces a **tiered registration system** by service
type (health.gov.au; ACQSC guidance 2026).

**Transfer assessment:**

| Dimension | Australia | Cost to model |
|---|---|---|
| Framework shape | Tiered registration categories + strengthened Aged Care Quality Standards | **Medium-high** — the tier dimension does not exist in our model; the readiness scorer assumes one framework per org |
| Background check | NDIS Worker Screening + national police check, state-administered | Medium — issuer varies by state, which our `regulators` table handles, but worker-screening *expiry cycles* differ |
| Funding linkage | Care minutes, AN-ACC, government funding compliance | High if in scope — funding compliance is a product area we do not have |
| Data protection | Privacy Act 1988 + APPs — no GDPR, but Notifiable Data Breaches applies | Low — a data-residency note (AWS ap-southeast-2) and policy fork |

**Verdict: second.** The market is large and the new Act creates the same
"providers suddenly need inspection software" window Ireland does, two years
more mature. The tier dimension and funding compliance are the cost. Worth a
scoping spike (~1 week) before committing; do not start without the spike,
because tier-modelling touches the readiness scorer's core assumption.

## Candidate 3 — New Zealand (Health New Zealand | Te Whatu Ora certification): smallest lift

**Regulator:** certification under the Health and Disability Services (Safety)
Act 2001, administered by Health New Zealand; audited against the Ngā paerewa
Health and Disability Services Standard. Home and community support services
sit in this scope; sector consolidation is ongoing (2024–26).

**Transfer assessment:** framework is outcome-based standards (Ngā paerewa)
— structurally similar to our per-nation frameworks; background checking is
the **NZ Police Vetting Service + NZ Workforce vetting** under the Children's
Act where applicable — again a single-scheme seed row. Data protection under
the Privacy Act 2020 (13 IPPs, close cousin of UK GDPR). Market is small
(~4.7m population) but the sector is consolidating with reported workforce and
compliance strain, and an English-language, UK-adjacent model lands easily.

**Verdict: third — cheapest lift, smallest market.** Worth doing opportunistically
if an inbound lead appears; not worth a dedicated quarter on its own.

## Ranked recommendation

1. **Ireland/HIQA** — start a scoping spike now (2 weeks: Garda vetting seed,
   HIQA standards draft mapping, EU-region deploy proof-of-concept). The
   regulatory window is open *now*.
2. **Australia/ACQSC** — tier-modelling spike (1 week) before any commitment;
   sequence after Ireland so the EU residency work is reused only once.
3. **NZ/Te Whatu Ora** — opportunistic; keep the framework stub ready.

**What NOT to do:** do not add a jurisdiction without its vetting scheme seed,
because the nation-aware compliance engine treats a missing scheme as
England-by-default — a wrong-by-construction readiness score for a real
provider. The four-nations work made the registry honest; expansion must keep
it honest. (T2-14's scope note updated accordingly.)

## What every candidate needs that the four nations did not

- **EU/APAC data residency** — tenancy-region routing is the single largest
  new platform investment. Design it once, reuse for all overseas candidates.
- **Per-jurisdiction claim-guard entries** — HIQA/Ngā paerewa/ACQSC claims
  need FORBIDDEN_CLAIMS entries from day one, so marketing cannot overclaim a
  framework we half-implemented (the four-nations lesson, pre-applied).
- **Local payroll/timesheet law** — out of scope for the readiness engine but
  a buying criterion; flag for commercial evaluation per market.

---

*Primary sources: hiqa.ie (Registration Handbook v2.3 Jun 2026; Draft National
Standards for Home Support Services), health.gov.au (Aged Care Act 2024
resources; Guide to Aged Care Law ch. 3), agedcarequality.gov.au (provider
registration guidance), Lexology Sep 2026 (HIQA home-care registration
transitional period). Statutory texts and commencement orders should be
verified by the solicitor before commercial commitments — this is research,
not legal advice.*
