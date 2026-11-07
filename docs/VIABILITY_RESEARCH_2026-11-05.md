# MeticleCare — independent viability research

**Date:** 5–6 November 2026
**Question asked:** Is there a market for this product, is there demand for it, and is it worth completing and investing into?
**Method:** three independent external research streams (sector economics, demand/buyer behaviour, competitive landscape), one multi-source investment synthesis, official DHSC/CQC/NHS England/Insolvency Service sources where available, plus a read of this repository's own commercial and readiness documents. Every material number below carries a date and a source. Assumptions are labelled. This is desk research plus internal-document review — **it is not customer evidence**, and no customer evidence was found.

---

## 1. Executive verdict

| Question | Answer | Confidence |
|---|---|---|
| Is there a market? | **Yes, but small, mature and financially weak.** Roughly 19,000 adult social care provider organisations in England; ~13,500 homecare and ~4,500 supported-living services; an estimated UK care-management software pool of only **~£80–120m/year**. | High on buyer counts, medium on software spend (no official series exists) |
| Is there demand? | **Yes for digitisation — but ~80% of providers have already bought.** The remaining demand is *replacement/consolidation*, not first-time adoption, and it sits with the smallest, least able to pay providers. There is **no binding software mandate** and no national subsidy wave left. | High |
| Is it worth completing? | **Only conditionally.** The engineering is unusually complete; the missing work is commercial and regulatory (NHS assurance, DSPT, legal pack), not features. | High |
| Is it worth investing £400–650k into as currently positioned? | **No — not yet.** Do not fund the full plan on an unvalidated horizontal all-in-one thesis. Fund a time-boxed validation gate instead. | Medium-high |

**One sentence:** MeticleCare is a genuinely well-built product pointed at a real but late-cycle, low-budget, incumbent-locked market; the constraint on its value is no longer code, it is evidence that a care provider will switch and pay — and that evidence does not currently exist.

**Recommended decision: a conditional NO-GO on the current investment case, with a 90-day, cheap, evidence-generating gate that can convert it to a GO.** Details in §8.

---

## 2. What is actually built (inside evidence)

From `PRODUCT.md`, `AGENTS.md`, `docs/MARKET_READINESS_AUDIT.md` and `docs/FEATURE_READINESS_AUDIT.md`:

- A multi-tenant, RLS-isolated Express/React platform with ~51 API modules, ~132 web routes, ~1,505 API tests and 310 mobile tests; production is live with TLS 1.3, HSTS, MFA, per-request RBAC, audit logging, Prometheus metrics, Swagger docs, Stripe billing and a branded email queue.
- Full operational coverage: rota with min-safe-staffing and 11-hour rest enforcement, eMAR, care notes/plans/goals, incidents, leave, training matrix, compliance evidence packs/KLOEs, CQC readiness, DSPT page, policies with versions/sharing/reminders, chat, notifications, reporting/custom report builder, family portal, mobile/PWA offline check-in with GPS point-in-time capture.
- Phase 2 multi-service expansion (domiciliary packages, visits, mileage, approved payroll CSV exports) is already substantially implemented.
- Deliberate differentiators: four-nations regulator frameworks, on-demand location privacy (DPIA v1.0–1.4, kill switch), a governed AI capability registry with method disclosure, and a claims guard that forbids unevidenced marketing claims.

**Internal honesty worth keeping:** `docs/INNF_8.2_VIABILITY_EVIDENCE.md` (28 Sep 2026) states outright that everything built is evidence of *innovation and capability*, not *viability*; that viability is evidenced by customers, advisers and a funding record; and that "no further engineering moves this score". This independent research reaches the same conclusion from the outside.

---

## 3. Market — how big, how healthy

### 3.1 Buyer base (strong, growing, fragmented)

| Figure | Value | Date | Source |
|---|---|---|---|
| Adult social care provider organisations, England | **~19,000**, described by DHSC as "complex and fragmented" | 2024/25, updated 16 Jul 2026 | [DHSC Fair Pay Agreement consultation](https://www.gov.uk/government/consultations/fair-pay-agreement-process-in-adult-social-care/fair-pay-agreement-process-in-adult-social-care-consultation-document) |
| LA-funded adult social care gross expenditure | **just under £30bn**, +9% YoY (state-funded spend only) | 2024/25, pub. 23 Oct 2026 | [CQC State of Care 2025/26: Pressures](https://www.cqc.org.uk/publications/major-report/state-care/2025-2026/asc/pressures) |
| Homecare services registered with CQC | **13,500+**, +42% vs April 2019 | April 2026, pub. 23 Oct 2026 | [CQC State of Care 2025/26: Fragmentation](https://www.cqc.org.uk/publications/major-report/state-care/2025-2026/asc/fragmentation) |
| Supported-living services | **4,500+**, +20% in 2025/26 | April 2026 | same CQC source |
| Homecare services supporting ≤4 people | **30%** of the market, +2pp YoY | April 2026 | same CQC source |
| Workforce | **1.5m** people, ~5% of all adults in employment | 2024/25 | DHSC / CQC State of Care 2025/26 |

The segments MeticleCare targets are **the growing ones**: homecare +42% since 2019, supported living +20% in the last year. But they are fragmenting *downwards*: more micro-providers. A long tail of tiny buyers means low ACV, high support cost and high churn. (An investment synthesis of CQC registration data also puts single-location providers at ~87%; that figure is second-hand and is not used in the TAM below.)

### 3.2 The software slice is much smaller than the care market

Neither DHSC nor CQC publishes a care-software spend series. Syndicated "market reports" quoting USD 0.9–1.2bn for "social work management tools" or "private duty care software" use US/LA case-management definitions and should not be used as a TAM. A defensible bottom-up estimate:

| Step | Assumption | Value |
|---|---|---|
| England ASC provider organisations | DHSC 2024/25 | 19,000 |
| Community-only (homecare + supported living) organisations | *assumption* given multi-location groups | ~13,000 |
| Blended annual platform spend per org | *assumption*: micro ~£2k, small ~£5k, medium ~£15k, large ~£50k, weighted by DHSC size mix | ~£6–9k |
| **Serviceable software TAM** | B × C | **~£80–120m/year** |
| Realistic capturable share for a new entrant in 3–5 years | 1–3% of community orgs | **~130–390 customers = £0.8–3.5m ARR** |

An independent investment synthesis puts the UK DSCR pool at "~£100m+" and notes a UK home-health record segment of ~US$230m in 2026 growing ~7.8% CAGR — directions agree: **this is a tens-of-millions-to-low-hundreds-of-millions market, not a billion-pound one.** On its own it cannot support a venture-scale outcome without international expansion.

### 3.3 Buyers are in financial distress (the underweighted risk)

- Council homecare rate **£25.05/hr for 2026/27** vs the Homecare Association's **£34.42/hr Minimum Price** — a **£9.37/hr gap** on the 70–80% of hours bought by councils/NHS. Only 1% of reviewed council contracts met the minimum in 2025/26 ([Homecare Association, Jul 2026](https://www.homecareassociation.org.uk/resource/homecare-association-responds-to-adass-spring-survey-2026-and-cqc-local-authority-assessment-findings.html)).
- **£715m adult social care budget overspend in 2025/26**; **66%** of councils saw providers close, cease trading or hand back contracts in the six months to May 2026; **>400,000** people waiting for assessment/care (ADASS Spring Survey 2026, cited in the same source).
- **33 homecare company insolvencies (SIC 881) in Jan–Aug 2026** — more than any full year since 2016; 63 care-company insolvencies including residential vs 36 in the same period of 2025 ([Insolvency Service data analysed by Care Brief](https://carebrief.co.uk/news/sixty-three-care-companies-gone-in-eight-months-what-the-record-2026-insolvency-data-says-about-the-homecare-market-and-the-four-checks-to-run-before-you-take-on-a-failed-competitors-clients)) — *secondary analysis; directionally credible, treat with care.*
- National Living Wage **£12.71/hr from 1 April 2026** and employer NIC at 15%; homecare vacancy rate still **~9%** ([CQC State of Care 2025/26: Workforce](https://www.cqc.org.uk/publications/major-report/state-care/2025-2026/asc/workforce)).
- Care homes are a healthier two-tier exception (27% profitability, self-funder share 48%→52%), but that is not MeticleCare's primary ICP.

**Implication:** a SaaS book in this sector suffers *involuntary* churn from customer insolvency, and price rises/upsell face structural resistance. Any financial model assuming smooth NRR is optimistic.

### 3.4 Policy tailwind, but no near-term budget event

- 2025 Spending Review: **>£4bn extra ASC funding by 2028/29** and **£500m** for the first Fair Pay Agreement (effective April 2028) — real, but back-loaded ([DHSC consultation](https://www.gov.uk/government/consultations/fair-pay-agreement-process-in-adult-social-care/fair-pay-agreement-process-in-adult-social-care-consultation-document)).
- Casey Commission's final report is now expected **summer 2027**; funding architecture still unresolved after decades of commissions.
- The Health and Care Worker visa route closed to new overseas entrants on **22 July 2025**; international recruitment fell 105,000 (2023/24) → 50,000 (2024/25) → ~30,000 (2025/26). Good for "admin efficiency" software narratives, bad for provider cost bases.

---

## 4. Demand — real, but the land-grab is over

### 4.1 Adoption is already ~80%

| Measure | Value | Date | Source |
|---|---|---|---|
| Providers using a Digital Social Care Record | **80%**, covering ~90% of people drawing on care (41% in Dec 2021 → 77% Mar 2025 → 80% Jul 2025) | 5 Dec 2025 | [DHSC press release](https://www.gov.uk/government/news/digital-revolution-in-care-saves-millions-of-admin-hours) |
| Surveyed providers using DSCR / digital rostering / eMAR | **73% / 63% / 53%** | fieldwork Feb–Mar 2025, pub. 6 Mar 2026 (n=1,085) | [DHSC 2025 technology survey findings](https://www.gov.uk/government/statistics/technology-use-in-adult-social-care-2025-survey-results/findings-from-the-2025-adult-social-care-provider-technology-survey) |
| DSCR by provider size | micro **57%** / small 77% / medium 79% / large **88%** | same | same |
| Barriers to adoption | set-up cost **73%**, ongoing licence cost **70%**, staff training/turnover 52%, cyber cost 41%, connectivity 40%, digital skills 39% | same | same |
| Support wanted | **82% want ongoing-cost funding**, 67% upfront | same | same |

The 20% who have not bought are disproportionately micro-providers — the exact group with the least ability to pay. **The residual greenfield is a price/access gap, not a product gap.**

### 4.2 The "mandate" is weaker than the pitch deck assumes

- The original "80% of providers digitised by March 2024" was a **policy aim**, not a statutory requirement ([DHSC, *A plan for digital health and social care*, 29 Jun 2022](https://www.gov.uk/government/publications/a-plan-for-digital-health-and-social-care/a-plan-for-digital-health-and-social-care)); it was missed and reached ~16 months late.
- The **Digitising Social Care (DiSC) programme ended in April 2025**; the current formulation is an **"ambition for all care providers to be fully digitised by the end of this Parliament"** ([ministerial answer, 15 Dec 2025](https://www.parallelparliament.co.uk/question/98012/medical-records-digital-technology)).
- CQC requires accurate, complete records under Regulation 17 — **paper is compliant**; CQC does not endorse any system ([CQC guidance, 4 Mar 2024](https://www.cqc.org.uk/guidance-providers/adult-social-care/digital-record-systems-adult-social-care-services)).
- DHSC's own buyer guidance says there is **"no formal public sector process"** for DSCR procurement, prices are **negotiable**, and an in-house DSCR need not be on the assured list ([29 Sep 2026](https://www.gov.uk/guidance/digital-social-care-records-choosing-and-implementing-solutions)).
- The genuinely binding pressure is **contractual**: DSPT "Standards Met" by 30 June is written into many LA/ICB contracts, and GP Connect access requires an assured DSCR + DSPT + National Data Sharing Agreement ([Digital Care Hub](https://www.digitalcarehub.co.uk/dspt/commissioners/including-dspt-requirements-in-adult-social-care-contracts/), DHSC guidance above).
- **2025/26 public money funds training, not licences**: the April 2025 announcement funded a Level 5 Digital Leadership qualification, £12m LDSS training and £12m workforce courses ([DHSC, 9 Apr 2025](https://www.gov.uk/government/news/cutting-edge-tech-introduced-in-social-care)). The old ICB match-funded grant rounds no longer run in that form.

**Conclusion:** the government-subsidised adoption wave that created the incumbents' installed bases **cannot be ridden again**. This is the single most important demand finding.

### 4.3 What demand remains

1. **Replacement/consolidation** — providers unhappy with a point solution or a legacy system; DHSC itself notes DSCRs "do not normally include rostering or eMAR" and that NHS England's remaining priority is "providers with legacy systems" ([NHS England, Digitising the frontline](https://www.england.nhs.uk/digitaltechnology/digitising-the-frontline)). This is real, but it is a displacement fight.
2. **Inspection/evidence pressure** — only **6,294 ASC services assessed** under the Single Assessment Framework since Jan 2024 against ~22,000+ locations; CQC says assessment volumes are "too low to be representative" ([CQC State of Care 2025/26: Ratings](https://www.cqc.org.uk/publications/major-report/state-care/2025-2026/asc/ratings)). A large uninspected backlog is a genuine "produce evidence quickly" trigger.
3. **Workforce admin efficiency** — 9% homecare vacancies and a collapsed overseas recruitment route make admin-per-visit reduction one of the few levers providers control.
4. **Interoperability / shared care records** — Connecting Care Records (£20m by March 2026), the national social care data infrastructure and the single patient record favour structured, connected data — but favour already-connected incumbents most.

---

## 5. Competition — crowded, consolidated, price-anchored

### 5.1 The gate is the assured list

NHS England's assured DSCR solutions list carried **21 products in December 2025** and **23 as of November 2026** ([assured solutions list](https://adultsocialcare.standards.nhs.uk/assured-solutions)). Access to GP Connect and to ICB digitisation funding is gated on it. Several listed products are already all-in-one: Birdie (rota + eMAR + care notes + family app + Q-Score CQC benchmarking), PASS (rota + eMAR + ECM + family portal + GP Connect), Careberry, sorted.care, CareLineLive, Access (rota/HR/compliance across all four UK regulators), QCS (340+ auto-updated policies, mock inspections, four regulators). Two 2026 entrants — **Flocare** and **CareGovern** — already target *supported living specifically*, and CareGovern already claims all four UK regulators.

**Every gap MeticleCare positions on is occupied**: supported-living workflows, CQC evidence automation, family portal, chat, training matrix, multi-service providers, four-nations compliance. These are feature gaps, not market gaps, and the largest incumbents can copy them within a sprint.

### 5.2 Pricing — MeticleCare's tiers are headline-competitive but structurally wrong

| Vendor | Published price | Unit | Source |
|---|---|---|---|
| Log my Care | **Free** Starter for <10 service users; rota/eMAR/family app are paid add-ons | per service user | [logmycare.co.uk/pricing](https://logmycare.co.uk/pricing) |
| CareLineLive | **£120/month floor**; £8.10/carer/month eRoster, £19.70 BYOD, £45 managed handset; onboarding up to £300 | per carer / device | [carelinelive.com/pricing](https://carelinelive.com/pricing) |
| PASS (everyLIFE) | **£185/month** Foundation, 1–15 service users, single location; Pro per service user; 12-month minimum; **3 months free to switch**, migration + training included | per service → per service user | [pass.care/care-software-pricing](https://pass.care/care-software-pricing) |
| Birdie | **from £200/month** ex VAT; AI tools £2.75–£3.50/recording hour | per scheduled care hour | [birdie.care/pricing](https://www.birdie.care/pricing) |
| Market benchmark | **£12–£35 per carer per month** for combined rostering + care planning | per carer | [Birdie buyer's guide, 16 Dec 2025](https://www.birdie.care/blog/price-of-care-management-software) — *vendor-authored* |
| Access / Nourish / PCS / QCS / CareDocs / Careberry | quote-only | per carer / per bed / per client | DHSC guidance, 29 Sep 2026 |

MeticleCare's internal planned tiers (**£99 / £299 / £749 per month**) sit inside the observed range, but:

- **£99 is not disruptive** — it is £99 more than free, and only £21 below CareLineLive's floor, in a market where 70% cite licence cost as a barrier and 82% want ongoing subsidies.
- **£749 "Enterprise" is too cheap**: 50 carers on CareLineLive BYOD already cost ~£985/month plus onboarding. A flat cap under-monetises large multi-site groups and signals "SMB product" to enterprise buyers.
- **Flat tiers ignore the market's revenue-linked units** (care hours / carers / service users / beds), inviting adverse selection and leaving money on the table at the top.
- **£99/month cannot credibly fund** assurance, customer DSPT support, ISO 27001, Cyber Essentials Plus, GP Connect, 24/7 UK support, data migration and staff training. **Price is not the barrier — credibility is.**

### 5.3 Consolidation and capital

| Date | Deal | Source |
|---|---|---|
| Aug 2026 | **Hg acquires majority of Nourish Care** (Hg Mercury Fund; ~£20m from HgCapital Trust; Livingbridge rolls over). Hg plans to embed its Catalyst AI layer and move pricing off seats | [SaasRise deal note](https://www.saasrise.com/deals/hgs-majority-acquisition-of-nourish-care-systems-1b817b94-044f-4bc7-b45e-7367a9b7f334) |
| Dec 2025 | **Person Centred Software + Clearcare** combination financed by new debt + **Brighton Park Capital** minority equity; Cow Corner remains majority; PCS used in **8,400+ care homes** | [Houlihan Lokey transaction](https://hl.com/about-us/transactions/person-centred-software-cow-corner-brighton-park-capital/) |
| 2024 | PCS acquired DepenSys/ResHub (Feb), Redcrier (Apr), KareInn (Jun); Camascope (eMAR) in Jun 2026 | Cow Corner / company announcements |
| 2023–24 | Nourish acquired CarePlanner; CareLineLive acquired CareFor and Ulysses; QCS absorbed Carebeans | vendor announcements |
| 2021 | Access acquired Servelec (and Alcuris) — the enterprise roll-up | [Access Group](https://www.theaccessgroup.com/en-gb/about/news/access-group-acquires-servelec/) |

No 2024–26 software deal values were publicly disclosed; the Nourish 2022 MBO at ~£35m EV ≈ **9.5× ARR** is the most useful public benchmark. **The category is mid-consolidation under well-capitalised PE owners who are arming incumbents with AI.** "AI-first" is now a table stake, not a differentiator.

### 5.4 Switching costs and the credibility checklist

To be credible to a UK care provider in 2026 a vendor needs: assured-list inclusion; DSPT ("Standards Met", own plus customer support); live GP Connect integration; PRSB conformance; ISO 27001; Cyber Essentials Plus; UK data hosting; offline mode; tamper-proof audit trails; 24/7 UK support; funded migration and retraining; an interoperability roadmap. Realistically a **12–24 month hurdle that pricing cannot shortcut**. Incumbents actively neutralise the challenger pitch: PASS gives free migration, ~30-day go-live and 3 months free; CareLineLive offers free migration; CareDocs runs champion-led training.

**Against that checklist, the repository's own documents record the gap:**

- `docs/CLAIM_REGISTER.md` notes the Compliance Badges page correctly states **"we have not submitted the DSPT"** and hold no accreditation.
- `docs/FEATURE_READINESS_AUDIT.md` says the legal/commercial set (DPA, solicitor-reviewed terms, PI insurance, org-wide DPIA, AI Art 28 position) is **unstarted "before the first paying customer"**, and that add-ons cannot be sold because no Stripe mechanism exists.
- `docs/MARKET_READINESS_AUDIT.md` (13 Oct 2026) rates legal/commercial **blocked**, Play data safety **blocked**, iOS listing **not started**, monitoring **present but unproven**, backups **real but no restore has ever been run**.
- `docs/INNF_8.2_VIABILITY_EVIDENCE.md` records **no signed LOIs, no named investors, no committed funds, no completed customer interviews**, and a funding plan requiring **£400–650k** total with **£542k cash to break-even at month 30** (from the internal financial model).

No evidence of paying customers, pilots, design partners, tender wins or a waitlist was found anywhere in the reviewed materials.

---

## 6. Investment math

| Dimension | Assessment | Score /5 |
|---|---|---|
| Market timing | Digitisation land-grab complete; subsidy wave ended April 2025 | 1.5 |
| TAM | ~£80–120m/yr UK serviceable; UK-only cannot carry venture scale | 2 |
| Competitive defensibility | 23 assured incumbents, PE consolidation, high switching costs, AI table stakes | 1.5 |
| Buyer ability to pay | Record insolvencies, £9.37/hr fee gap, 82% want ongoing subsidy | 1.5 |
| Policy tailwind | Direction right, funding deferred to 2027–2029 | 4 |
| Capital environment | Selective healthtech VC; UK private SaaS ~3–10× ARR, 8–15× at £0.5–2m ARR with high growth | 3 |
| Exit path | Genuine strategic appetite (Hg, Access, Cow Corner/BPC, Livingbridge) at ~9–10× ARR for quality assets | 3.5 |
| **Aggregate for a new horizontal DSCR entrant** | | **~2.4** |
| **Aggregate for a differentiated adjacent layer with non-UK growth vector** | | **~3.3** |

*Multiple ranges are indicative from UK SaaS valuation surveys and are second-hand — treat as context, not a valuation.*

The internal model's £542k-to-break-even at month 30 assumes a sales motion that this research does not support: entering a market where 80% have bought, 23 assured competitors exist, 12-month contracts are the norm, incumbents give migration away free, and the buyer base is insolvent at a record rate. A **£3–5m ARR** business could be a credible **£30–50m strategic acquisition** at ~9.5× ARR — but only with a defensible data/workflow asset and real contracts, not a lighter DSCR.

**What investors would need to see before a Series A** (industry standard in 2026): £1m+ ARR, >100% growth, NRR >120%, CAC payback <12–18 months, and multi-year council/group contracts. MeticleCare is currently at zero on all of these. The realistic path is SEIS/EIS seed → specialist healthtech/SaaS fund → strategic acquisition, not an independent scale story.

---

## 7. Honest strengths (why this is not simply "kill it")

- **Engineering depth is a real asset.** Very few pre-revenue products ship RLS multi-tenancy, MFA, offline mobile sync with idempotency, an audit-log-before-response guarantee, 1,500+ tests, a claims guard that polices its own marketing, and a live production deployment. This is a credible *team + codebase* asset.
- **The bundle is coherent.** Rota → care record → medication → compliance evidence → billing is genuinely one data model. DHSC acknowledges most DSCRs do not include rostering or eMAR; point-solution reconciliation is a real, documented cost.
- **Compliance/privacy posture is unusually thoughtful** — four-nations frameworks, on-demand location privacy, DPIAs, an AI capability registry. In a regulated, trust-based sale that matters, even if it is not a purchase criterion on its own.
- **Market need is not imaginary.** An ageing population, 400,000+ people waiting for assessment/care, a large uninspected CQC backlog and a structural workforce shortage all keep the category alive.
- **The acquirer set is active.** Hg (Nourish), Access, Cow Corner/PCS and Brighton Park Capital are buying. A niche asset with real ARR has an exit.

---

## 8. Recommendation: a conditional no-go with a 90-day gate

**Do not commit the full £400–650k raise or continue broad feature completion on the current thesis.** More engineering will not change the binding constraints, which are (in order): customer proof, regulatory credibility, and a defensible wedge.

### The 90-day gate (cheap, non-engineering, decisive)

| # | Action | Pass condition |
|---|---|---|
| 1 | Run the existing `docs/INNF_8.2_CUSTOMER_INTERVIEW_PROTOCOL.md`: **15–20 structured buyer conversations** (registered managers, owners, and at least 3 LA/ICB commissioners) | Documented notes with named roles, dated; clear evidence of a *switching* trigger and a budget owner |
| 2 | Convert **one design partner** into a signed LOI and **one paying pilot** | ≥1 signed LOI and ≥1 paying account at a real price (target ≥£299/month, not a free trial) |
| 3 | Start the credibility work: **submit DSPT**, begin NHS England assured-solution pre-application, scope GP Connect, ISO 27001 and Cyber Essentials Plus | DSPT submitted; a dated, costed assurance plan with an owner |
| 4 | Close the legal set: DPA, solicitor-reviewed terms, PI insurance, org-wide DPIA, restore drill | All five signed off / executed |
| 5 | Rewrite pricing to **scale with a unit** (per carer or per care hour) and re-cut the plan around one narrow ICP | A one-page pricing model with a defensible ACV and CAC payback |
| 6 | Re-score the investment case against §6 using real pipeline numbers | Score ≥3.5/5 with at least one paying customer |

**Kill criteria:** if after 90 days there is no paying pilot, no LOI, or buyers consistently say "we already have a system and would not migrate", stop the horizontal all-in-one and either (a) pivot to a narrow compliance/outcomes/interoperability layer that sits *on top of* assured incumbents, (b) sell the codebase/team as an acqui-hire to an Assured-list incumbent, or (c) keep it as a low-cost, self-funded niche product with no outside capital.

### If you proceed anyway, the only two defensible positions

1. **Narrow wedge, not replacement.** A supported-living outcomes / tenancy / four-nations evidence layer that integrates with Birdie/PASS/Nourish rather than displacing them. Higher credibility, lower switching cost — but note Flocare and CareGovern already occupy this niche, and supported living was only 6% of the DHSC survey base.
2. **Multi-service / mixed-provider consolidation play.** Sell to consolidating mid-tier groups and multi-site community providers (who have a budget owner and a group-level pain), not to the 30% of homecare services supporting ≤4 people. Pair with international expansion from day one, because the UK-only TAM is too small for venture scale.

**What not to do:** do not underwrite the plan on the £13.4bn care-delivery market or USD-billion "care software" reports; do not lead with price; do not lead with "AI"; do not spend the raise before the 90-day evidence exists.

---

## 9. Caveats and evidence quality

- **No traction evidence was found.** Absence of LOIs/pilots/customers in the reviewed internal documents is not proof there are none, but nothing in `docs/`, `PRODUCT.md` or the readiness audits indicates any. If real customers exist, the verdict changes materially and the §8 gate can be shortened.
- **Software TAM/SOM figures are analyst estimates with stated assumptions.** No official UK care-software market size exists. The £80–120m range and £0.8–3.5m capturable ARR are illustrative, not sourced facts.
- **Some statistics are secondary analyses** of official data (Insolvency Service via Care Brief; ADASS/Care England figures via trade press). Directionally credible, not primary-verified here.
- **Vendor pricing and customer counts are vendor-published.** Birdie's buyer's guides are vendor-authored but link to public pricing pages; PASS/PCS/Nourish customer counts are marketing claims.
- **England-only bias.** CQC regulates England; Scotland (Care Inspectorate), Wales (CIW) and NI (RQIA) provider counts are not included in most figures. The four-nations differentiator therefore rests on a TAM that has *not* been sized here.
- **Internal financial model figures** (£400–650k, £542k, month-30 break-even, £99/£299/£749) come from this repository's docs dated Aug–Oct 2026 and were not independently re-verified.
- This research reflects sources available on **5–6 November 2026**. Re-check anything older than 12 months before citing it externally.

---

## 10. Principal sources

**Official / primary**
- CQC, *State of Care 2025/26* (23 Oct 2026): [Pressures](https://www.cqc.org.uk/publications/major-report/state-care/2025-2026/asc/pressures), [Fragmentation](https://www.cqc.org.uk/publications/major-report/state-care/2025-2026/asc/fragmentation), [Consolidation](https://www.cqc.org.uk/publications/major-report/state-care/2025-2026/asc/consolidation), [Workforce](https://www.cqc.org.uk/publications/major-report/state-care/2025-2026/asc/workforce), [Ratings](https://www.cqc.org.uk/publications/major-report/state-care/2025-2026/asc/ratings)
- DHSC, [2025 adult social care provider technology survey findings](https://www.gov.uk/government/statistics/technology-use-in-adult-social-care-2025-survey-results/findings-from-the-2025-adult-social-care-provider-technology-survey) (6 Mar 2026)
- DHSC, [Digital revolution in care saves millions of admin hours](https://www.gov.uk/government/news/digital-revolution-in-care-saves-millions-of-admin-hours) (5 Dec 2025)
- DHSC, [Choosing and implementing DSCR solutions](https://www.gov.uk/guidance/digital-social-care-records-choosing-and-implementing-solutions) (29 Sep 2026)
- DHSC, [*A plan for digital health and social care*](https://www.gov.uk/government/publications/a-plan-for-digital-health-and-social-care/a-plan-for-digital-health-and-social-care) (29 Jun 2022) and [Fair Pay Agreement consultation](https://www.gov.uk/government/consultations/fair-pay-agreement-process-in-adult-social-care/fair-pay-agreement-process-in-adult-social-care-consultation-document) (updated 16 Jul 2026)
- CQC, [Digital record systems in adult social care](https://www.cqc.org.uk/guidance-providers/adult-social-care/digital-record-systems-adult-social-care-services) (4 Mar 2024)
- NHS England, [Assured DSCR solutions list](https://adultsocialcare.standards.nhs.uk/assured-solutions) and [Digitising the frontline](https://www.england.nhs.uk/digitaltechnology/digitising-the-frontline)
- [Ministerial answer on DiSC / assured solutions](https://www.parallelparliament.co.uk/question/98012/medical-records-digital-technology) (15 Dec 2025)
- Homecare Association, [response to ADASS Spring Survey 2026](https://www.homecareassociation.org.uk/resource/homecare-association-responds-to-adass-spring-survey-2026-and-cqc-local-authority-assessment-findings.html) (Jul 2026); [The Homecare Deficit 2025](https://www.homecareassociation.org.uk/resource/the-homecare-deficit-2025.html)
- Low Pay Commission, [The National Minimum Wage in 2026](https://www.gov.uk/government/publications/the-national-minimum-wage-in-2026/the-national-minimum-wage-in-2026)

**Competitive / commercial**
- [Birdie pricing](https://www.birdie.care/pricing), [PASS pricing](https://pass.care/care-software-pricing), [CareLineLive pricing](https://carelinelive.com/pricing), [Log my Care pricing](https://logmycare.co.uk/pricing)
- [Houlihan Lokey: PCS / Brighton Park Capital](https://hl.com/about-us/transactions/person-centred-software-cow-corner-brighton-park-capital/); [Hg / Nourish deal note](https://www.saasrise.com/deals/hgs-majority-acquisition-of-nourish-care-systems-1b817b94-044f-4bc7-b45e-7367a9b7f334); [Access / Servelec](https://www.theaccessgroup.com/en-gb/about/news/access-group-acquires-servelec/)
- [PRSB on assurance standards](https://theprsb.org/?p=51699); [Digital Care Hub on DSPT in contracts](https://www.digitalcarehub.co.uk/dspt/commissioners/including-dspt-requirements-in-adult-social-care-contracts/)

**Internal (this repository)**
- `PRODUCT.md`, `AGENTS.md`, `docs/INNF_8.2_VIABILITY_EVIDENCE.md`, `docs/INNF_8.3d_MARKET_RESEARCH.md`, `docs/MARKET_READINESS_AUDIT.md`, `docs/FEATURE_READINESS_AUDIT.md`, `docs/CLAIM_REGISTER.md`, `docs/INNF_8.2_CUSTOMER_INTERVIEW_PROTOCOL.md`
