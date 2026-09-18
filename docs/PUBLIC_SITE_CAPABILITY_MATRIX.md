# MeticleCare public website capability matrix

Updated: 2026-09-18

This matrix is the working source of truth for the public-site repositioning. “Exists” means there is code or an existing product workflow in the repository. “Public proof” means the public website can show the capability without inventing a UI or metric. Claims about regulation, security, customers and AI remain deliberately qualified.

| Capability | Exists in product | Public route | Product proof status | Notes |
|---|---:|---|---|---|
| Care notes | Yes | `/features/care-management` | Existing product imagery / workflow copy | Avoid claiming AI writes notes without human review. |
| Support plans | Yes | `/features/care-management` | Existing product workflow | Person-centred language is appropriate. |
| eMAR / medication | Yes, capability-gated | `/features/medication` | Existing product workflow | Domiciliary medication support is optional per organisation. |
| Body mapping | Yes | `/features/care-management` | Existing product workflow | Keep clinical claims factual. |
| Appointments / health reviews | Yes | `/platform` | Existing product workflow | Service-type visibility varies. |
| Scheduling / rota | Yes | `/features/scheduling`, `/features/workforce` | Existing product workflow | AI rota claims must remain “where enabled”. |
| Staff / training / competency | Yes | `/features/workforce` | Existing product workflow | Good evidence-backed feature area. |
| Risk assessments | Yes | `/features/risk-management` | Existing product workflow | Do not imply automated clinical decisions. |
| Incidents / actions | Yes | `/features/incident-management` | Existing product workflow | Keep escalation and governance wording qualified. |
| Reporting | Yes | `/features/reporting` | Existing product workflow | No invented KPI values. |
| Family Portal | Yes | `/features/family-portal` | Existing product workflow | Avoid listing capabilities not available to the specific portal role. |
| Mobile app | Yes | `/download` and `/mobile` | Existing mobile app | Store URLs are environment-driven and show a safe unavailable state until configured. |
| UK hosting | Configured / deployment-dependent | `/security` | Needs infrastructure evidence review | Do not claim certification. |
| Encryption | Yes in application/deployment design | `/security` | Needs security evidence review | Avoid unsupported algorithm/certification claims on public pages. |
| MFA | Yes | `/security` | Existing authentication workflow | Good public claim with qualified wording. |
| RBAC / tenant isolation | Yes | `/security` | Existing product architecture | Do not expose implementation details that increase attack surface. |
| Audit logs | Yes | `/security`, `/compliance` | Existing product workflow | Strong evidence-backed positioning. |
| Backups | Deployment / operations | `/security` | Needs operational evidence review | Avoid retention or recovery-time promises until confirmed. |
| AI note assistance | Yes, configured feature | `/features/ai` | Existing AI workflow | Preserve original text, human review and audit trail. |
| AI compliance gap analysis | Yes, configured feature | `/features/ai`, `/compliance` | Existing AI endpoint | Requires organisation AI configuration. |
| AI rota analysis / generation | Yes, configured feature | `/features/ai`, `/features/scheduling` | Existing AI endpoint | Must never silently overwrite a rota. |
| AI Care Summary | First source-linked version implemented | Authenticated `/intelligence` | Date-bounded result with source IDs | Requires organisation AI configuration and person ID; human review required. |
| AI change detection | First source-linked version implemented | Authenticated `/intelligence` | Deterministic signals plus validated AI explanation | Signals only; not diagnoses or automated decisions. |
| AI risk signals | First dedicated source-linked version implemented | Authenticated `/intelligence` | Missed/overdue/incident signals with evidence | Uses “may need attention”; managers remain responsible for interpretation. |
| AI natural-language assistant | First bounded version implemented | Authenticated `/intelligence` | Question plus tenant-scoped source set | Does not execute arbitrary SQL; requires further intent-layer hardening. |
| AI compliance copilot | First source-linked version implemented | Authenticated `/intelligence` | Training/evidence attention signals | Requires broader competency/review/action sources before public claim. |
| AI Manager Briefing | First end-to-end version implemented | `/manager-briefing`, `/intelligence` | Source-linked manager summary | Requires organisation AI configuration and manager/admin role. |
| AI end-of-day intelligence | First source-linked version implemented | Authenticated `/intelligence` | Date-bounded review with source IDs | Does not replace existing operational digests or make regulatory judgements. |
| Domiciliary operations copilot | First source-linked version implemented | Authenticated `/intelligence` | Missed/overdue/medication/action signals | Manager-only; does not modify calls. |
| Rules-first anomaly detection | First source-linked version implemented | Authenticated `/intelligence` | Deterministic operational signals plus AI explanation | Signals require human review. |
| Explainable rota alternatives | Advisory version implemented | Authenticated `/intelligence` | Shift sources and constraint explanation | No automatic rota publication. |
| Competency coaching | Advisory version implemented | Authenticated `/intelligence` | Training and competency sources | Does not grade staff or change employment records. |
| Family communication drafting | Manager-reviewed draft version implemented | Authenticated `/intelligence` | Person records and family contact source | Never sends automatically. |

## Public route architecture implemented

- `/` — care operations positioning, four-nation compliance context, product-led capabilities and demo CTA.
- `/platform` — connected capability overview.
- `/solutions/domiciliary-care` — homecare operations.
- `/solutions/supported-living` — supported living operations.
- `/compliance` — continuous evidence and governance overview.
- `/compliance/cqc` — England-specific context.
- `/compliance/care-inspectorate` — Scotland-specific context.
- `/compliance/ciw` — Wales-specific context.
- `/compliance/rqia` — Northern Ireland-specific context.
- `/features/:slug` — capability pages for care, medication, workforce, scheduling, risk, incidents, compliance, reporting, family portal and AI.
- `/security` — evidence-qualified security and data protection overview.
- `/download`, `/mobile`, `/app` — web/mobile positioning and environment-driven store links.
- `/blog`, `/blog/:slug` — readable article index and article routes with Article JSON-LD.
- `/about` — company/product story.

## Claims intentionally excluded

- Public pricing.
- Customer logos, testimonials, ratings, awards or usage numbers without verified evidence.
- CQC approval, regulator endorsement, guaranteed compliance or guaranteed inspection outcomes.
- ISO 27001, Cyber Essentials, NHS accreditation or DSP Toolkit completion unless independently verified.
- AI diagnoses, autonomous care decisions or unsupported clinical conclusions.
- App Store / Google Play URLs until the real listings are configured.
