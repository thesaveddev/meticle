# Claim register: regulators, standards and legal requirements

An audit of every place the codebase asserts something about a regulator, a
standard, or a legal requirement, and whether it can be traced to a citable
source.

**Date of audit:** 30 September 2026. **Audited:** `apps/api`, `apps/web`,
`apps/mobile`, `apps/marketing`, `docs`.

---

## Why this audit exists

The pattern it is looking for is established. In the medicines-in-care work
(T0-6h) the marketing site advertised a Controlled Drug Register with
"witness sign-off", and the database had no witness column and no way to set
the controlled-drug flag through the API. Before that, a Scottish carer was
marked non-compliant for not holding a DBS.

In all three cases the prose was plausible, the code said something else, and
nothing in review caught it. A regulator name in a string literal reads like a
fact to anyone skimming. This register exists so the next person adding one has
to look it up.

## How claims are classified

| Class | Meaning |
|---|---|
| **Fixed** | Contradicted by the code, or demonstrably wrong. Corrected in this change. |
| **Unverifiable** | Cannot be traced to a citable source from inside the repository. Needs an owner decision. Not necessarily false. |
| **Honest** | Already carries its own caveat, and must not be "tidied" into a confident claim. |

**A note on the limits of this audit.** This is a codebase audit, not legal
advice. "Unverifiable" means *we cannot trace it from here* — not *it is
false*. Several entries are probably correct. The point of listing them is that
nobody should be telling a customer they are correct until someone has checked.

**Update, 30 September 2026 — two entries moved from Class 2 to Class 1.** The
original audit had no way to reach a regulator's website. This pass did, so U2
and U4 were checked against gov.wales, health-ni.gov.uk and rqia.org.uk, and
**both were wrong** (F22, F21, F20). That is a result worth sitting with: of the
two Class 2 entries anyone has actually managed to check, neither was right. The
remaining Class 2 entries should not be assumed safer than these were.

Verified sources, for anyone re-checking:
- CIW themes and ratings — gov.wales, "New ratings system for care services
  launches in Wales", 28 March 2025, in force 1 April 2025.
- CIW's statutory basis — Regulated Services (Inspection Ratings) (Wales)
  Regulations 2025, giving effect to s.37 of the Regulation and Inspection of
  Social Care (Wales) Act 2016.
- RQIA founding Order and the nine standards sets — health-ni.gov.uk "Care
  standards", rqia.org.uk "Legislation and Standards".

---

## Class 1: Fixed

### F1. The AI was being asked to invent statutory citations — **most serious**

**Where:** `apps/api/src/modules/ai/ai.prompts.ts`, three prompts.
**Was:** A JSON output field named `reference_regulation` / `regulation_reference`, whose worked example was the literal string `"e.g. Care Act 2014 s.42, CQC Reg. 12"`.
**Problem:** A model asked to fill a field whose example is a real-looking citation will produce a real-looking citation, right or wrong, and nothing in a JSON response says "I am not certain this is real". The output landed in a **safeguarding record** — the one category of record a provider may put in front of an inspector, a commissioner, or a court.
**Why the example is the dangerous part:** Care Act 2014 s.42 *is* a real provision. That is exactly what makes it dangerous — it teaches the model that a correct-looking answer is the expected output, and there is no field distinguishing a correct citation from a plausible one.
**Fix:** The field is gone, replaced with `who_should_know` — an actionable question rather than an uncheckable assertion. Three dead prompts removed. A new test refuses the shape from returning.

### F2. England-only safeguarding bodies in prompts for a four-nations product

**Where:** `ai.prompts.ts` — `requires_mash_referral`, and "Apply the Care Act 2014 framework and CQC Fundamental Standards".
**Problem:** MASH (the Multi-Agency Safeguarding Hub) is an England mechanism. Wales routes through the National Safeguarding Team, Scotland through national adult protection guidance, Northern Ireland through a Regional Adult Protection Team. A Scottish service was being asked whether it needed a "MASH referral" — a question with no answer in that country. This is the same error class as the DBS/PVG bug, in a place nobody had looked.
**Also removed:** "Follow CQC's 'Better care for our people' framework". That is a CQC slogan, not a framework.
**Fix:** Nation-neutral prompts; a test fails if any prompt names an England-only route.

### F3. "CQC-compliant" daily care notes

**Where:** `ai.prompts.ts` `daily_note_generation` — the system prompt said "structured, CQC-compliant daily care notes" and asked for the Care Act 2014 duties, for a provider who may be in Wales.
**Fix:** Framing is now documentation practice, with a nation-neutral note. Guarded by a test that fails when a prompt names one regulator and not the others.

### F4. `requires_cqc_notification` as an output field

**Where:** `ai.prompts.ts` `incident_severity_triage`.
**Problem:** A field named for one regulator's notification regime, in a product sold on four. A Scottish incident triage would return `requires_cqc_notification: true`, which is a false label on a record.
**Fix:** Renamed `requires_regulator_notification`, with the prompt told that notifiability differs by nation and service type.

### F5. The evidence pack PDF was hardcoded to "CQC"

**Where:** `apps/api/src/modules/compliance/compliance.pdf.ts` — `const frameworkName = 'CQC'`, rendered as a badge on the cover.
**Problem:** The same module scores four frameworks. A Welsh or Scottish provider downloaded a document with a CQC badge on the cover and no indication it was a default. An evidence pack is the artefact a provider shows an inspector; a wrong regulator on the cover is the first thing noticed and it undermines every number inside it.
**Fix:** The cover reads the organisation's stored regulator, and says **"Not recorded"** rather than guessing.

### F6. Wrong statute for CIW — the codebase contradicted itself

**Where:** `ComplianceBadgesPage.tsx` and `CompliancePage.tsx`.
**Was:** "CIW inspects against the Care and Social Services Inspectorate (Wales) Act 2001"; "CIW inspects against the Care Standards Act 2000 and related Welsh regulations."
**Problem:** Both superseded. CIW registers and inspects services under the **Regulation and Inspection of Social Care (Wales) Act 2016**. The API's own `regulators.ts` had this right — the wrong version was on the page a customer reads.
**Fix:** Corrected in both places, cross-referenced to the registry.

### F7. Wrong title for the RQIA's founding instrument — twice in one sentence

**Where:** `ComplianceBadgesPage.tsx`.
**Was:** "the Health and Personal Social Services (Quality, Improvement and Regulation) Act (NI) 2003".
**Problem:** It is an **Order**, not an Act, and it is "Health and Personal **Care** Services". The API's `regulators.ts` had the correct title. Same statute, wrong twice, in the most-quoted document on the site.
**Fix:** Corrected. The standards themselves are no longer paraphrased as if authoritative.

### F8. An invented regulator name and acronym

**Where:** `ComplianceBadgesPage.tsx` — "Care Inspectorate Scotland", acronym **"CIS"**.
**Problem:** The body is the **Care Inspectorate**. "CIS" is not an acronym it uses — `regulators.ts` has had `care-inspectorate` / "Care Inspectorate" throughout, and the blog page said "Care Inspectorate". Printing an invented acronym on a page about a regulator invites exactly the attention it should not get.
**Fix:** Renamed. "CIS" appears nowhere.

### F9. "Data is processed and stored in the United Kingdom"

**Where:** `SecurityPage.tsx`.
**Problem:** False, and false in the way that matters commercially. Clinical free text is sent to OpenAI and Anthropic (T0-17b, still open, no Article 28 agreement signed). A buyer's international-transfer assessment depends on this sentence, and the sentence said the thing that makes the product look safe rather than the thing that is true. The API already had a `data_boundary` disclosure; the public page did not.
**Fix:** "Records are stored in the United Kingdom. Where AI features are switched on, parts of a record are processed by our AI provider outside the UK." The security status table now has a separate **AI processing** row that does not carry a tick.

### F10. "Encrypted data at rest" — claimed twice, implemented zero times

**Where:** `SecurityPage.tsx` (the detail list and the practices block), and "encryption" on `CompliancePage.tsx`.
**Problem:** `setup.ts:1977` installs `pgcrypto` under the comment "Crown Jewels: pgcrypto extension for column-level PII encryption at rest". A repo-wide search for `pgp_sym_encrypt` / `pgp_sym_decrypt` returns **nothing**. The extension is installed and unused. Whatever the disk layer does is the infrastructure provider's claim, not one this codebase can make.
**Fix:** Now says encrypted in transit, and states plainly that encryption at rest is not handled by the application. The status table's green tick — which previously certified this — is now a dash.

**Second correction, 1 Oct 2026.** The search above was for `pgcrypto`, and it was the wrong thing to search for. There is a second, real implementation that is equally unused: `apps/api/src/shared/utils/encryption.ts` implements aes-256-gcm over an HKDF-derived per-tenant key — a genuine cipher, not a stub — and **nothing imports it**. `encryptField` and `decryptField` have no call sites outside their own definitions. So the conclusion was right and the reason was incomplete: no column is encrypted at rest because **no column is encrypted at all**, not merely because an extension went unused. Anyone reading the register would have concluded that setting `FIELD_ENCRYPTION_KEY` would enable encryption. It would not have.

That misreading had already spread. The claim guard's registry entry said column-level encryption "genuinely exists" and named the unset key as the only open question, and readiness item T0-15 instructed the owner to go and set the key. Both now corrected, and `apps/api/src/shared/utils/encryption.sentinel.test.ts` asserts the absence so the cipher cannot be adopted without the claim being revisited.

Separately: **this fix was applied to the marketing site and missed on `apps/web/src/pages/legal/PrivacyPolicyPage.tsx`**, which still read "Encrypted in transit (TLS 1.3) and at rest (AES-256)" — on the page Play reads for the Data safety form. Corrected 1 Oct 2026. The lesson is the one this register keeps re-learning: a claim withdrawn on one surface stays live on another unless the guard covers every surface, which is why the guard scans `docs/` and `src/` together.

**Third state, later the same day.** Having found that nothing encrypted anything, the gap was closed rather than merely re-documented. `people.nhs_number` is now encrypted on write and decrypted on read, under an HKDF key derived per organisation, with the key made mandatory so the process exits at boot rather than writing plaintext. An integration test reads the raw column over an RLS-bypassing connection and asserts it is ciphertext — the assertion that was missing while the cipher sat unused and three documents called it working. The published wording is deliberately narrow: it names NHS numbers, and says plainly that dates of birth, addresses and phone numbers are **not** encrypted by the application. That narrowness is the point. The unqualified phrase "encrypted at rest" was false, and would have stayed false against every column except one.

F10 is therefore reopened rather than closed: the claim is now accurate and evidence-backed for one column, and remains an open engineering task for the rest (T0-15).

### F11. "Breach notification workflow with 72-hour reporting"

**Where:** `ComplianceBadgesPage.tsx`, under "How Meticle Care helps".
**Problem:** There is no breach module. The only matches for "breach" in the API are MFA backup codes, a DSPT standard's *label* about preventing data breaches, and a seeded GDPR policy paragraph. The 72-hour figure is correct as a matter of UK GDPR Article 33 — it is just attached to a feature that does not exist, which makes the correct figure look like evidence.
**Fix:** Removed from the capability list. The 72 hours now appears where it belongs, as the provider's own obligation.

### F12. "Right to access, rectification, and erasure workflows"

**Where:** `ComplianceBadgesPage.tsx` and `SecurityPage.tsx`.
**Problem:** No DSAR, rectification or erasure workflow exists. The only erasure is account deletion on leaving (`staff.controller.ts:245`). Claiming "workflows" implies tooling a controller would expect to find during a subject access request.
**Fix:** Reworded to what exists: pseudonymisation at the AI boundary, per-organisation control over outbound free text, and account erasure.

### F13. "Staffing records including PVG checks and SSSC registration"

**Where:** `ComplianceBadgesPage.tsx` Scotland card, and `SSSC registration requirements` in its key requirements.
**Problem:** **Zero real SSSC references in the codebase.** The six apparent matches are substrings of unrelated identifiers (`updateSetupIntentSchema`, `ProgressSchema`). T2-18 already states workforce registration is *deliberately not modelled*. The marketing page was claiming a capability the readiness task list says we do not have.
**Fix:** Reworded to PVG (which is real) and an honest note that SSSC numbers are neither held nor checked.

### F14. "CQC-Mandated Training per Role"

**Where:** `BlogPage.tsx` post title and excerpt, which asked "Which training modules does CQC mandate?"
**Problem:** CQC does not mandate named training courses. It regulates competence and asks whether the evidence shows the right people can do the job. A post framing it as a list of mandated modules teaches providers to buy the wrong thing.
**Fix:** Retitled to what a provider actually has to evidence, with the distinction stated in the excerpt.

### F15. "GDPR-compliant", three times

**Where:** `FeaturesPage.tsx` (×2), `LandingPage.tsx`.
**Problem:** "GDPR-compliant" is a legal conclusion a vendor cannot make on a customer's behalf, and this product has a **live blocker** on exactly this: pseudonymised but not anonymised health data sent to a third-country processor with no Article 28 agreement (T0-17b, T0-17b open).
**Fix:** Replaced with descriptions of what the product does.

### F16. "Data minimisation — collects only what is needed"

**Where:** `SecurityPage.tsx`.
**Problem:** Contradicted by the code. The AI boundary's default mode is `full`, which sends narrative free text (T2-20). Saying "unnecessary data is not requested and not stored" is false of our own default behaviour.
**Fix:** Now states what the setting does and that the default sends the narrative — "a setting to decide on rather than a property you inherit."

### F17. A sales email asserting a CQC rating to every prospect

**Where:** `apps/marketing/src/email/` — `templates.ts`, `sender.ts`.
**Problems, three of them:**
1. "I know how overwhelming **CQC** inspections can be" and "Your **CQC score**" went to all prospects, in a service that claims four-regulator support.
2. "{{provider_name}} currently holds a {{cqc_rating}} rating" — a factual claim about a **named third party**, scraped from a public register, which can be stale. It is also sent to a provider's competitor list in some configurations.
3. **A live bug:** the renderer has no conditional-block support — it strips every `{{#...}}` — so with an empty scrape the email rendered the literal words **"has a CQC rating of Not rated"**. That is a grammatical artefact in a sales email and it is now fixed.
**Fix:** Regulator-aware wording; the rating sentence is precomputed, attributed and dated, and omitted entirely when there is no rating.
**Found while fixing it:** the templates were handed a `{{regulator}}` variable, but `leads` had no such column — `lead` is typed `any`, so TypeScript accepted the reference and every email would have silently taken the fallback. A column that only exists in the template is the same failure as a claim that only exists in the copy. Added to `apps/marketing/src/db/database.ts` with an idempotent `ALTER TABLE` guarded on `PRAGMA table_info`, so existing installs get it. Every row defaults to the Care Quality Commission because the CQC scraper is currently the only source; that is now a recorded fact rather than an assumption in a string literal.

### F18. `SecurityPage` status table: a green tick that certified nothing

**Where:** `SecurityPage.tsx`.
**Problem:** Every row rendered a green `Check` beside its claim — including "Encryption: TLS + at rest" (F10) and "Backups: Regular schedule" (F11b, below). A tick is a visual claim of verification, and it was applied to claims nobody had verified.
**Fix:** Each row now declares whether we can evidence it. The tick means "we can show you this in the product"; without it, the row is a question, not an assurance.

---

### F19. The evidence pack was in our database's order, not the regulator's

**Where:** `compliance.pdf.ts`, `cqc/frameworks.ts`.

**Problem:** One layout for everybody: Staff, People, Care Plans, Incidents, Training, Documents, Competency, Satisfaction, Nutrition. That is the order of our tables. A Welsh provider handed it to a CIW inspector gets a document with no Well-being, no Environment, no Care and Support and no rating scale — none of the words CIW uses. A Northern Irish provider got the same.

This is worse than a wrong claim, because it was not even wrong in a checkable way. Nobody catches this by looking: the pack looks complete.

**Fix:** The pack is laid out against `cqc/frameworks.ts`, which is the sourced registry Wales already used correctly and this work brought into the printable path. Wales gets its four themes and four ratings; Northern Ireland gets its applicable standards document; England keeps its five key questions. Where a regulator has no verified framework the pack says so on the cover rather than falling back — `getFramework` still defaults to the CQC, which is right for the readiness screen and catastrophic for a document an inspector reads, so printable paths call the new `findFramework` instead.

### F20. A test that asserted the wrong statute, and kept it wrong

**Where:** `cqc/frameworks.test.ts`, `cqc.frameworks.integration.test.ts`, `regulators.ts`, `ComplianceBadgesPage.tsx`.

**Problem:** The RQIA entry named the Health and Personal *Care* Services (Quality Improvement and Regulation) (Northern Ireland) Order 2003. The title is the Health and Personal **Social** Services (Quality, Improvement and Regulation) (Northern Ireland) Order 2003 — confirmed on rqia.org.uk and health-ni.gov.uk. Two tests asserted the wrong string:

```js
expect(rqia.source).toContain('Health and Personal Care Services')
```

A test written to match the code is not evidence the code is right. It is the most effective way to keep a wrong string alive, because it turns a typo into a contract. And the marketing page carried the same wrong title while a comment directly above it insisted the API registry had it right — the two held the error independently, and that comment was itself a claim nobody had checked.

**Fix:** Correct title in all three places. The tests now assert the real title *and* assert the wrong one is absent. The comment that lied about the other copy is corrected to say what actually happened, which is the only reason the next person does not trust it either.

### F21. RQIA's "four inspection domains" could not be traced

**Where:** `cqc/frameworks.ts` RQIA entry.

**Problem:** The file asserted that RQIA inspection reports "are structured around four domains: is care safe, is care effective, is care compassionate, and is the service well led", and a test was named `uses RQIA's four inspection domains`. A careful search of RQIA's own guidance turned up nothing of that shape, while what DoH and the RQIA *do* publish is nine sets of minimum standards, one per kind of service.

**This is not recorded as "wrong".** Not finding a structure is not the same as disproving it, and deleting a useful grouping because it could not be cited would be its own kind of error. So the four areas of care stay and stay useful; what is gone is the claim that RQIA words them that way. The labels moved from questions in the regulator's voice ("Is care safe?") to ours ("Safety and protection"), and `verifiedAspects.fourDomainStructure` records the gap in the data so it cannot be quietly forgotten.

F20 and F21 look alike and are not. F20 was checkable and was wrong. F21 is not checkable from here and is marked not checkable.

### F22. CIW was described as inspecting six areas and rating "from excellent to bad"

**Where:** `ComplianceBadgesPage.tsx`.

**Problem:** The CIW card said CIW "inspects services across six areas: Well-being, Care and support, Environment, Staffing, Management and leadership, and Suitability. Services receive a rating from excellent to bad." This is U2 from the list below, and checking it turned out to be checkable after all: CIW has **four** themes and **four** ratings. "Staffing" and "Suitability" are not CIW themes, there is no sixth area, and the bottom band is *requires significant improvement* — not "bad".

**Fix:** Replaced with the four themes and four ratings, plus the fact CIW deliberately issues **no overall rating**, only per-theme. Verified against gov.wales, 28 March 2025.

### F23. Ireland: two things that would have been repeated by reflex

**Where:** `compliance.vetting.ts`, `136_ireland_hiqa_garda_vetting.sql`, `cqc/frameworks.ts`.

The Ireland spike is in the register rather than only in the readiness list because the two failures it nearly walked into are the same two this file already documents — one for Scotland, one for the `NI-S1` identifiers.

**Right-to-work.** Every UK row carries `PASSPORT, VISA, RIGHT_TO_WORK`, and migration 128 explains why: right-to-work checking is a UK-wide immigration requirement. True, and it does not travel. Ireland is in the EU and the Common Travel Area, an Irish citizen has an implicit right to work and needs no visa, and carrying that list across would report most Irish care workers non-compliant for documents that do not apply to them. This would have been **completely silent** — the compliance query is correct, the requirement underneath it is wrong — which is the defining property of every entry in Class 1. The Irish row's `required_document_types` is therefore empty, with the reasoning in a named constant so it cannot be tidied away. T2-29.

**Garda tiers.** DBS, PVG and AccessNI are all graded. Garda vetting is not: an organisation applies on behalf of a person and a disclosure comes back. Writing `basic/standard/enhanced/enhanced_barred` would have been a fresh `NI-S1` — four plausible tier names, unlookupable, that would make a real disclosure look like the wrong tier. One honest state instead.

**What was verified rather than assumed** (hiqa.ie, garda.ie, 30 September 2026): HIQA sets national standards under the Health Act 2007, approved by the Minister for Health; the instrument is the National Standards for Residential Care Settings for Older People in Ireland, 2009 and updated 2016; **a review commenced 18 August 2026** whose findings go to the Department of Health "to inform a decision on whether to update" them. Garda vetting applications go to the National Vetting Bureau; disclosures are made by the Garda National Vetting Bureau, the unit formerly called the Garda Central Vetting Unit; a disclosure goes to an **authorised liaison person** at the organisation.

**What is deliberately absent.** HIQA's framework has an empty `domains` array. The standards are published only as a PDF, hiqa.ie renders in JavaScript, and the theme list could not be extracted. Theme 1 is known to be "Person-centred Care and Support"; the remaining themes were not inferred from Northern Ireland or from what care regulation tends to look like. The gap is recorded in `verifiedAspects` and a test asserts it stays recorded. T2-30.

---

## Class 2: Unverifiable from the repository

These are **not** asserted to be false. Each needs an owner to check a source and then either keep the wording or correct it.

| # | Claim | Where | Why it cannot be traced |
|---|---|---|---|
| U1 | CQC's five key questions and four ratings | `ComplianceBadgesPage`, `CompliancePage`, `FeaturesPage` | Almost certainly correct and widely known, but nothing in the repo cites a source. We would rather cite than assert. |
| U2 | ~~CIW's six inspection areas~~ | `ComplianceBadgesPage` | **RESOLVED, and the claim was wrong.** CIW has **four** themes — Well-being, Care and Support, Leadership and Management, Environment — and four ratings: excellent, good, requires improvement, requires significant improvement. Verified against gov.wales, "New ratings system for care services launches in Wales", 28 March 2025. "Six inspection areas" is not a CIW set at all. The marketing page still needs correcting (T2-27). CIW also awards **no overall rating**, only per-theme. |
| U3 | The Care Inspectorate's "National Care Standards" and "Health and Social Care Standards" | `ComplianceBadgesPage`, `CompliancePage` | These are real Scottish instruments, but their current status, edition and relationship to each other has not been verified. **This is the one I would check first** — it is the nearest neighbour to the medicines-in-care work and would be embarrassing to get wrong twice. |
| U4 | RQIA's "minimum standards" and their coverage areas | `ComplianceBadgesPage`, `CompliancePage` | **RESOLVED, and the shape of the claim was wrong.** There is no single RQIA framework. DoH publishes **nine** sets of minimum standards, one per kind of service, and the RQIA uses the set matching the registered setting. Verified against health-ni.gov.uk and rqia.org.uk, 30 September 2026. The individual standards within each set are still unread, so no standard number appears anywhere in the product (**T2-28**). |
| U5 | `locations.cqc_rating` and `last_cqc_inspection` columns | `settings.controller.ts`, `schema.sql`, `compliance-portal` | A field named for one regulator, on a table shared by all four nations, surfaced to every provider. CQC ratings are an England concept. Renaming is a migration and a UI change. **T2-25.** |
| U6 | "Backups — Regular schedule" | `SecurityPage.tsx` | No backup configuration, script or schedule exists anywhere in the repository. It is a real operational claim about infrastructure we cannot see. **T2-26.** |
| U7 | "Wales-specific compliance templates aligned to CIW inspection frameworks" | `ComplianceBadgesPage` | No CIW template was found. Flagged rather than deleted because a template may exist under a different name. |
| U8 | "Care plans built around the Scottish outcome-based framework" | `ComplianceBadgesPage` (removed) | Vague, and no Scottish framework is modelled. Removed with the card rewrite. |
| U9 | CQC "KLOE frameworks", "Quality Statements" | `FeaturesPage`, `ComplianceBadgesPage`, `ai.prompts` | Key Lines of Enquiry and Quality Statements are real CQC terms, but the marketing usage ("mapped to KLOE frameworks", "reference CQC Quality Statements") implies a mapping we have not built. |
| U10 | The 11-hour rest rule in rota optimisation | `ai.prompts.ts` `rota_optimization` | The Working Time Regulations 1998 11-hour rest right is real, and the care-sector 24-hour voluntary opt-out is the reason it is often not enforceable. A prompt that asserts the 11-hour rule without the opt-out is incomplete. Low severity — it is a suggestion, not a claim to a customer. |
| U11 | "DSPT self-assessment completion and tracking" | `ComplianceBadgesPage` | **True** — there is a `/dspt` module. Noted here because the audit initially flagged it as absent; the disclaimer that we have *not submitted* it is the part that matters and is correct. |
| U12 | T2-17: CQC and RQIA registration number formats | `regulators.ts` | Pre-existing and correctly disclosed. No action. |

---

## Class 3: Already honest — do not "fix" these

These are the good ones. Listed so a future pass does not sand them down into confident-sounding copy.

| Where | Why it is right |
|---|---|
| `ComplianceBadgesPage` NHS card | The only place in the codebase that gets a trademark question right. It carries no NHS logo, states we hold no accreditation, states we have **not** submitted the DSPT, and says NHS obligations are the provider's and the commissioner's, not ours. This is the model the other cards should follow. |
| `regulators.ts` `formatHint` discipline | A hint is shown only where verified, and is never used to reject a value. "Absent means we have not verified one, not that no format exists." |
| `compliance.vetting.ts` header | States the schemes are correct names and tiers, states they are not a compliance claim, and carries T2-12. |
| `medicationFrameworks.ts` | `verified_against_primary_source: false` on every framework, returned by the API so the caveat reaches the product. **T2-22.** |
| `LOCATION_RECORDING_GUIDE.md` | Cross-checks its own claims against the code via assertions, so a claim cannot outlive the code that made it true. |
| `ai.capabilities.ts` `FORBIDDEN_CLAIMS` | Machine-readable guard against a capability's marketing name returning. The same idea as the new prompt tests, and it is why the marketing sweep is a test rather than a review. |
| `ai.boundary.test.ts` | Fails the build if any call site bypasses the redaction seam. |

---

## What this audit does not cover

- **Anything asserted verbally.** Sales calls, the demo script, the ICO number
  on the website, the "compliant" in a deck. The claim register starts at the
  repository.
- **Primary-source verification.** Nothing here was checked against a
  regulator's published guidance. That is the whole of Class 2, and it is
  owner work, not engineering work.
- **The mobile app.** No regulator or legal claims were found in
  `apps/mobile/src` beyond the staff location notice, which is already
  covered by its own anti-stale tests.
- **Welsh, Scottish and Northern Irish medicines-in-care frameworks.** Covered
  by T0-6h and T2-22, not re-audited here.

## The rule this suggests

Any future string naming a regulator, a standard, or a section of an Act needs
one of three things next to it:

1. a citation (a URL, or a registry entry with a `sourceNote`), or
2. `verified: false` and a task number, or
3. a sentence that says it is our summary rather than the regulator's words.

Option 3 is what the Scotland and RQIA cards now do, and it is the cheapest.
A claim with a URL next to it can be checked by a reader in ten seconds; a
claim with nothing next to it cannot be checked at all, which is how F5 and F9
survived as long as they did.
