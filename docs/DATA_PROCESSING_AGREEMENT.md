# Data Processing Agreement — MeticleCare

**Status: DRAFT — pending solicitor review (T0-8). Do not sign or send to a customer until reviewed.**
**Version:** 0.1 (draft) · **Date:** 23 October 2026 · **Owner:** Adetoye
**Controller:** the care provider organisation signing Section 11 ("Customer", "you")
**Processor:** 34Orients Ltd, company number 17446318, 3 Dan-Y-Coedcae Road, Pontypridd, CF37 1LS ("MeticleCare", "we", "us")

This DPA forms part of the Terms of Use (/terms Section 5, which incorporates it by reference). Where this DPA and the Terms conflict on data protection, this DPA prevails. Nothing here is legal advice.

## 1. Subject matter and duration

1.1 We process personal data only to provide the MeticleCare care-management platform: rostering, visit check-in/out, care notes, incidents, eMAR, compliance, training, billing, support, and — only where the Customer switches them on — AI briefings/drafts.
1.2 Term: from Customer signup/acceptance until 90 days after subscription end (Terms Section 10), except where Schedule 1 requires longer statutory retention.
1.3 This DPA covers all staff, service-user, family-contact and location data the Customer puts into the Service, as listed in Schedule 1.

## 2. Roles

2.1 Customer is controller. We are processor. Nothing here creates joint controllership.
2.2 The Customer warrants it has authority to instruct us, a UK GDPR Article 6 basis for its own processing, and — for health data — an Article 9 condition (normally 9(2)(h) health/social care).
2.3 A worker pressing "agree" in the location notice, or a manager ticking a box, is not the Customer's Article 6/9 basis and is not relied on as one. See DPIA v1.6 Section 1.3.

## 3. Instructions

3.1 We process only on documented Customer instructions: (a) this DPA, (b) the Customer's in-product settings (location on/off, retention period, AI on/off and features), (c) support tickets requesting a specific action.
3.2 If an instruction appears to infringe UK GDPR we tell the Customer promptly and pause that instruction until confirmed in writing, unless law requires us to proceed (in which case we notify beforehand unless prohibited).
3.3 If EU/UK law requires us to process outside instructions we inform the Customer before doing so unless prohibited on public-interest grounds.

## 4. Confidentiality and access

4.1 Access is need-to-know: ORG_ADMIN/MANAGER roles, organisation-scoped by database row-level security; support access only on Customer request and logged.
4.2 Personnel are bound by confidentiality; credentials are per-user, no shared accounts (Terms Section 3).
4.3 We do not use Customer personal data for our own purposes, advertising, profiling, or model training.

## 5. Security (Article 32) — as implemented

TLS 1.3 in transit; AES-256-GCM application encryption for NHS numbers, DOBs, addresses, phones and contact details under per-organisation keys (`FIELD_ENCRYPTION_KEY` mandatory at boot); host disk encryption underneath; database-enforced tenant isolation (RLS, non-superuser app role); JWT httpOnly Secure SameSite=Lax sessions (15-min access / 7-day rotating refresh) + MFA available; audit logging of record access; digest-pinned images; nightly encrypted backups. Detail: Privacy Policy Section 5, SECURITY_POLICY.md. Known gap disclosed: narrative care text (notes, incidents, risk assessments) currently relies on host encryption, not application encryption — see Privacy Policy Section 5.

## 6. Sub-processors (Article 28(2)-(4))

6.1 General authorisation for Schedule 3 list. We give 30 days in-app + email notice of any new sub-processor; the Customer may object on data-protection grounds, and if unresolved may terminate with pro-rata refund.
6.2 Each sub-processor is bound by a written contract with at least our protections here. We remain fully liable for sub-processor failures.
6.3 AI model providers (OpenAI, Anthropic) are **conditional sub-processors**: off by default, engaged only for Customers that enable AI features, and — until the Article 28 terms + UK transfer mechanism in 6.4 are signed — technically blocked in production (`AI_TRANSFER_BASIS_ACKNOWLEDGED` gate). Enabling AI without those terms signed is not permitted under this DPA.
6.4 International transfers: hosting and primary processing in the UK. AI processing transfers pseudonymised (not anonymised) records to the US. No such transfer occurs until the UK IDTA / adequacy mechanism and provider Article 28 terms are signed and recorded in Schedule 3. `store:false` (OpenAI) is a retention opt-out, not a transfer mechanism.

## 7. Assistance (Articles 12-22, 32-36)

7.1 Data-subject rights: we provide self-service export/delete where the product supports it and forward any request we receive to the Customer within 5 working days; we act only on Customer instruction, within 25 days to meet the Customer's 30-day deadline.
7.2 Breach: we notify the Customer without undue delay and within 48 hours of becoming aware, with nature, categories/numbers affected, likely consequences, mitigations; we do not notify the ICO or data subjects except on Customer instruction.
7.3 DPIA/consultation: we provide system descriptions, security measures and Schedule information on request; the feature DPIA (`DPIA_Live_Active_Visit_Map.md`) is available as input, not as the Customer's organisation-wide assessment.

## 8. Retention, return, deletion

8.1 On termination: 90-day wind-down, then deletion except where Schedule 1 requires statutory retention (person records 8 years, financial 7, compliance 6, audit 2 — see Privacy Policy Section 6).
8.2 Staff location: deleted per the Customer's own `location_retention_days` by nightly job (receipted runs); no default is set by us.
8.3 On Customer written request within the 90 days we return exportable data in a structured format and then delete copies, including backup copies on expiry of the 30-day backup window, unless law requires retention (in which case we isolate and protect it).

## 9. Audit

9.1 Once per year, on 30 days notice and under confidentiality, the Customer (or a qualified auditor, not a competitor) may audit our compliance with this DPA via documentation, system reports and a supervised walkthrough — no intrusive testing. We cooperate with regulator enquiries at any time.
9.2 Uptime Kuma monitors, backup receipts, audit-log samples and penetration-test summaries (when commissioned, T2-1) are provided as evidence on request.

## 10. Liability and term

10.1 Liability caps and exclusions in Terms Section 8 apply to this DPA to the extent permitted by law; nothing limits liability that cannot be limited.
10.2 Changes to this DPA follow Terms Section 12 (30 days notice). A version bump re-prompts acceptance in-product; continued use after the effective date is acceptance.

## 11. Signatures

| | Customer (controller) | MeticleCare (processor) |
|---|---|---|
| Organisation / name | ______________________ | 34Orients Ltd |
| Signatory + role | ______________________ | ______________________ |
| Date | ______________________ | ______________________ |
| DPA version accepted | 1.0 | 1.0 |

## Schedule 1 — data and purposes

| Category | Examples (from Privacy Policy Section 1) | Purpose | Special-category condition |
|---|---|---|---|
| Account/organisation | staff names, emails, org details | access, support, billing | n/a |
| Person records | names, care plans, medical details, daily notes, incidents, risks | care delivery, CQC evidence | Art 9(2)(h) — Customer asserts |
| Staff compliance | training, DBS/PVG/AccessNI, identity docs | safer recruitment, readiness | Art 9(2)(b)/(h) employment/health — Customer asserts |
| Staff location | check-in/out coordinates, accuracy, decision record | attendance evidence, dispatch | Art 9(2)(h) — Customer asserts; worker agreement is not the basis |
| AI outputs | briefings, drafts (only if enabled) | efficiency | as input data; pseudonymised, still personal data |
| Billing | Stripe payment metadata (no full card) | subscription | n/a |

Retention per Privacy Policy Section 6 as qualified in Sections 8.1-8.2 above.

## Schedule 2 — security measures

Per Section 5: UK hosting, TLS 1.3, AES-256-GCM field encryption (named columns; narrative gap disclosed), RLS tenant isolation, RBAC + MFA, audit logging, rate limiting, digest-pinned images, nightly backups + WAL archiving, restore tested quarterly (target — first drill pending T0-2).

## Schedule 3 — sub-processors

| Sub-processor | Role | Location | Terms status |
|---|---|---|---|
| Cloud VPS host | compute, Postgres, Redis, backups | UK | hosting terms — record provider + region at signing |
| Cloudflare | edge, TLS, DNS | global edge / UK | standard terms — record at signing |
| MXRoute (MXRocket) | transactional + staff email | per provider | standard terms — record at signing |
| Stripe | payments | UK/EU/US per Stripe | Stripe DPA |
| OpenAI — CONDITIONAL | AI briefings/drafts, only if Customer enables | US | Article 28 + IDTA — PENDING (T0-17b). Blocked until signed |
| Anthropic — CONDITIONAL | as above | US | Article 28 + IDTA — PENDING (T0-17b). Blocked until signed |

Update this table at signing — "record at signing" is not a placeholder to ship.
