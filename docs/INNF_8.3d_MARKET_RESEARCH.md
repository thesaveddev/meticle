# Market research summary — UK domiciliary care software

**Status:** internal research summary — for the INNF 8.3(d) endorsement file and
Adetoye's commercial planning. Evidence dated **28 September 2026**; every figure
carries its source and its age, because a market number without a date is
marketeering, not research.

**What this document is:** a citable, sourced summary of the market MeticleCare
sells into, of the kind an endorsing body's assessor can check line by line.
**What it is not:** evidence of traction. Traction evidence (pilots, LOIs,
revenue) is tracked separately in the tracker's Tier 3 — nothing here should be
presented as customer proof.

---

## 1. The market in numbers

| Figure | Value | Source (dated) |
|---|---|---|
| UK homecare & supported living market | **£15.1bn+** (surpassed £15bn; est. 915,000 adults in England receiving homecare/supported living, FY2024/25) | LaingBuisson press release, 25 Jun 2026 — [laingbuisson.com](https://www.laingbuisson.com/press-releases/uk-homecare-and-supported-living-market-surpasses-15-billion/) |
| Domiciliary care industry revenue | **£13.4bn**, growing ~1.9% CAGR through 2026–27 | IBISWorld Domiciliary Care in the UK, 2026 — [ibisworld.com](https://www.ibisworld.com/united-kingdom/industry/domiciliary-care/14561/) |
| Care homes for older people (adjacent, for context) | **£27.3bn** annualised 2025/26 | LaingBuisson 36th ed., 22 Apr 2026 — [go.laingbuisson.com](https://go.laingbuisson.com/care-home-report-36) |
| CQC-registered domiciliary care organisations, England | **15,232** | CQC registration count cited in Sectorial SIC 88100 analysis, 2026 — [sectorial.io](https://sectorial.io/sector/health-social-work/sic-88100-non-residential-social-care) |
| Community social care services never assessed/rated by CQC | **36.9%** | Homecare Association analysis, Jun 2026, quoted in public commentary |
| Domiciliary care vacancy rate | **9.1%** (overall adult social care 6.2%; wider economy 2.2%) | Skills for Care 2025/26 figures, quoted Jul 2026 — [skillsforcare.org.uk](https://www.skillsforcare.org.uk/Adult-Social-Care-Workforce-Data/workforceintelligence/Monthly-statistics/Recruitment-and-retention.aspx) |
| Sector vacancies | ~111,000–152,000 depending on vintage; domiciliary care consistently the worst | King's Fund Social Care 360 (Apr 2026); Skills for Care 2026 report coverage |
| International recruitment collapse | 105,000 → 50,000 new direct-care arrivals 2023/24 → 2024/25 | Homecare Association response to Skills for Care, 29 Jul 2025 — [homecareassociation.org.uk](https://www.homecareassociation.org.uk/resource/homecare-association-responds-to-skills-for-care-workforce-data.html) |

**How to read this honestly.** The software slice of the £13.4bn is a small
percentage; the market size establishes the *pool of customers*, not our revenue
opportunity. The correct presentation to an assessor is: "a £13.4bn care-delivery
market of 15,232 CQC-registered English providers, under inspection pressure,
with a 9.1% vacancy rate that makes administrative efficiency — not more
recruitment — the only lever most providers control."

## 2. Why providers buy now (demand drivers)

1. **Inspection exposure without inspection coverage.** 36.9% of community social
   care services have never been assessed. When assessment arrives, providers
   must produce evidence quickly; our readiness scorer, four-nations frameworks,
   and evidence pack export exist precisely for that moment.
2. **The workforce squeeze is administrative.** 9.1% domiciliary vacancy rate and
   the collapse of international recruitment mean the marginal carer is harder to
   hire than the marginal care hour is to sell. Providers buy software that
   reduces admin per visit, not software that promises growth they cannot staff.
3. **Regulatory multiplication.** Four UK nations → four frameworks is already
   modelled (`apps/api/src/.../frameworks.ts`); Ireland's Health Bill 2025 and
   Australia's Aged Care Act 2024 both create "suddenly need inspection software"
   windows abroad (see `MULTI_JURISDICTION_EXPANSION_RESEARCH.md`).
4. **The buy-side mandate.** NHS-commissioned providers are increasingly expected
   to hold or be working towards digital care records / DSCR; the sales package
   and NHS pilot proposal (docs/funding) are built on this. *(Unsourced in our
   pack yet — Adetoye: add the current NHS/DSPT digitisation mandate reference
   before the file goes to the assessor.)*

## 3. Who we sell to (segments)

- **Primary:** single-site and small-group domiciliary agencies (1–15 locations)
  — the tier our Starter (£99/mo) and Professional (£299/mo) pricing maps to.
  Largest count, least served by enterprise incumbents.
- **Secondary:** multi-branch groups (15+) via Enterprise (£749/mo) and the four-nations
  differentiator.
- **Tertiary (12–18 mo):** NHS-adjacent discharge-to-assess placements via the
  pilot proposal in `docs/funding/nhs-pilot-proposal.html`.

## 4. Competition, honestly

| Competitor | Their strength | Where we differ, verifiably |
|---|---|---|
| Birdie, CarePlanner, Nourish, CareDocs | Installed base, integrations, NHS connections | Four-nations readiness model (one platform, four regulators); on-demand location privacy (three reads per visit, kill switch, DPIA v1.0–1.4 — see `POSITIONING_LOCATION_PRIVACY.md`) |
| Incumbent enterprise suites | Procurement tick-boxes, DSPT/ISO posture | We publish an honest AI capability registry (`ai.capabilities.ts`, 12 capabilities, method disclosure) rather than inflated AI claims |
| In-house/Excel | Free | Compliance automation, audit trails, per-nation vetting, family portal |

**Claim hygiene:** nothing in this table may be quoted on public pages — the
claims guard (`marketingClaims.ts`) forbids unevidenced competitive and
certification claims; this document is internal and dates every number so a
stale figure cannot be repeated silently.

## 5. What would change these numbers

- Any figure older than 12 months at the time of use → re-check before citing.
- The 15,232 figure is England-only; Wales (CIW), Scotland (Care Inspectorate),
  NI (RQIA) counts are **not yet sourced** — open item for Adetoye.
- If the Health Bill 2025 commencement (Ireland) is confirmed, the international
  plan's Ireland window opens; see the international plan, §Ireland.

## 6. Open items (owner: Adetoye)

1. **Add the current NHS/DSPT digitisation mandate citation** (buy-side driver 4).
2. **Source Wales/Scotland/NI provider counts** to complete the four-nations TAM.
3. **Decide the primary/secondary split %** for TAM/SAM/SOM presentation — the
   funding docs do not currently present a defensible SOM; build it from the
   15,232 × tier counts, not from percentages of a £13.4bn pool.
4. **Date-stamp re-verification**: figures above verified 28 Sep 2026; calendar
   a re-check before the endorsement file is submitted.

---

*Companion documents: `INNF_8.3d_JOB_CREATION_PLAN.md`,
`INNF_8.3d_INTERNATIONAL_GROWTH_PLAN.md`, `INNF_8.3d_FOUNDERS.md`,
`INNF_8.3d_PILOT_AND_LOI_KIT.md`, `INNF_8.3d_EVIDENCE_INDEX.md` — and the
existing funding pack in `docs/funding/` (business plan, financial model,
NHS pilot proposal, sales package), which this evidence pack builds on.*
