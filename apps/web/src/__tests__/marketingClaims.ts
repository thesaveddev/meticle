/**
 * Registry of claims that appear in public marketing or legal copy.
 *
 * The problem this exists to solve: a public page once advertised "Point-in-time
 * recovery" when we only take a nightly snapshot, and "ISO 27001" when neither
 * we nor our host held any such certificate. Both were found by hand, months
 * apart. Nothing stopped the second one going back in, and nothing would have
 * stopped either reaching a customer.
 *
 * So claims are recorded here with the evidence that permits them, and
 * `marketingClaims.test.ts` fails the build when a page says something this
 * file does not allow.
 *
 * The rule: **nothing may be said on a public page unless it is either
 * obviously fine or registered here with a reason.** A claim with no entry is
 * an accident waiting to ship.
 *
 * Not named `.test.ts`, so vitest's include pattern (which matches only
 * `*.test.ts` and `*.test.tsx` under `src`) will not collect this file as a
 * suite and try to run it.
 */

/** Where public copy lives. Anything a customer can read on a public route. */
export const PUBLIC_COPY_GLOBS = [
  'src/pages/marketing/*.tsx',
  'src/pages/legal/*.tsx',
]

/**
 * Every other surface a claim can reach, and which the blocklist above does
 * not see.
 *
 * The original two globs covered the only pages that are public. That left
 * three gaps, each of which has now produced a false claim:
 *
 *   - `download` and `landing` are public pages outside `pages/marketing`, and
 *     one still advertised "Live location" months after we withdrew it.
 *   - The signed-in app is not public but is not private either — a carer
 *     reading the mobile app is exactly the audience most harmed by a claim
 *     they cannot check.
 *   - Store listing answers and the public capability matrix are customer- and
 *     regulator-facing documents that ship in app store metadata.
 *
 * Paths are relative to the repository root unless marked `web:`, because these
 * span three applications and `docs/`.
 */
export const CLAIM_SURFACES: {
  rootedAt: 'repo' | 'web' | 'mobile'
  globs: string[]
  /**
   * `published` surfaces are read by a customer, a regulator or a worker, and a
   * claim there is an assertion about the product. `internal` surfaces are ours.
   *
   * The distinction is not a convenience. An internal tracker has to be able to
   * write "the page used to claim point-in-time recovery and we removed it" —
   * that sentence quotes the claim precisely in order to record its removal.
   * Sweeping internal documents for forbidden phrases produced 12 false
   * positives on the first run, all of them of that kind, and a guard that
   * cries wolf gets switched off. The fix is to scope it, not to add a
   * thousand exemptions.
   */
  kind: 'published' | 'internal'
  why: string
}[] = [
  { rootedAt: 'web', globs: ['src/pages/*.tsx'], kind: 'published', why: 'Public landing and download pages. They sit outside pages/marketing and were never scanned.' },
  { rootedAt: 'mobile', globs: ['src/screens/*.tsx', 'src/content/*.ts'], kind: 'published', why: 'The carer-facing app. A claim here is read by the person being tracked, who has least ability to check it.' },
  { rootedAt: 'repo', globs: ['docs/*.md'], kind: 'internal', why: 'Internal trackers and runbooks. Allowed to quote a removed claim in order to record its removal.' },
  { rootedAt: 'repo', globs: ['docs/STORE_PRIVACY_ANSWERS.md', 'docs/PUBLIC_SITE_CAPABILITY_MATRIX.md', 'docs/SECURITY_POLICY.md'], kind: 'published', why: 'Customer- and regulator-facing documents. The store answers ship as app store metadata and are reviewed by Apple and Google; the capability matrix is public; the security policy is published.' },
]

/**
 * Claims we cannot evidence today. Any occurrence in public copy is a failure.
 *
 * Each entry records what evidence *would* permit it, so this is a to-do list
 * rather than a permanent list of things that are forbidden forever.
 */
export const FORBIDDEN_CLAIMS: {
  label: string
  pattern: RegExp
  why: string
  whatWouldPermitIt: string
  /**
   * Files permitted to carry this claim, with the reason recorded here.
   *
   * Used sparingly and only where editing the copy is not ours to decide — see
   * the uptime entry, which is a contractual service level in the Terms of Use
   * that a solicitor should rule on, not an engineer.
   */
  exemptFiles?: string[]
  /**
   * Exact strings permitted to contain the phrase, where the phrase is a proper
   * noun rather than an assertion.
   *
   * "NHS Digital / NHS England" is the name of a body on a page explaining what
   * that body does. Blocking it would push someone to rename a regulator, which
   * is both silly and worse. Listed exactly rather than as a pattern, so the
   * exemption cannot quietly widen to cover a sentence that claims something.
   */
  allowedPhrases?: string[]
}[] = [
  {
    label: 'Anomaly or change detection presented as a model',
    pattern: /\banomaly detection\b|\bchange detection\b/i,
    why: 'Neither exists as a model. All twelve intelligence entry points run the same thing: date and status filters over records, then a language model writes prose about what came back. "Anomaly detection" and "change detection" both name a technique — a baseline, a deviation from expected, a learned threshold — that is not implemented, and an assessor can establish that with one query because there is nothing underneath the name. Renamed to "operational activity review" and "record change summary" on 28 Sep 2026.',
    whatWouldPermitIt: 'A genuine detection model: a stored per-service baseline, a comparison against it, and a documented threshold with the false-positive rate someone is willing to accept in a care record.',
    // The capability ids are frozen feature-flag keys in every existing
    // customer\'s enabledFeatures array and in the AI audit log. Renaming one
    // would silently disable a feature a customer had switched on, so the
    // internal key survives the rename while the customer-facing name does not.
    allowedPhrases: [
      'operational_anomaly_detection',
      'change_detection',
    ],
  },
  {
    label: 'ISO 27001',
    pattern: /ISO[\s/]*(?:IEC[\s]*)?27001/i,
    why: 'Neither we nor the hosting provider hold ISO 27001. A previous version of the privacy policy claimed it; it was removed on 26 Sep 2026 because there is no certificate to cite.',
    whatWouldPermitIt: 'A certificate covering us or our host, with its scope and expiry recorded here.',
  },
  {
    label: 'Cyber Essentials',
    pattern: /Cyber Essentials/i,
    why: 'Not held, and never applied for.',
    whatWouldPermitIt: 'A current certificate, or an in-date assessment covering the relevant scope.',
  },
  {
    label: 'NHS accreditation or Data Security Toolkit certification',
    pattern: /NHS\s+(?:Data Security Toolkit|Digital Accreditation|accredited|approved)/i,
    why: 'We have no NHS accreditation and have not submitted a DSPT. Selling to an NHS trust makes this claim more likely to be checked, not less.',
    whatWouldPermitIt: 'A published DSPT submission covering the service, or NHS Digital accreditation.',
  },
  {
    label: 'CQC registration',
    pattern: /CQC[-\s]registered/i,
    why: 'We are not a registered provider. Whether we need to be is still an open question (tracker T2-7), and we should not answer it in marketing copy before we know.',
    whatWouldPermitIt: 'A registration number, or a written legal position that we are a software supplier and out of scope.',
  },
  {
    label: 'Penetration tested',
    pattern: /penetration[-\s]tested|pen[-\s]tested/i,
    why: 'No independent penetration test has been carried out. We have secured this codebase ourselves, repeatedly, which is precisely why an outside pair of eyes has not happened yet (tracker T2-1).',
    whatWouldPermitIt: 'A completed CREST/CHECK-registered test, with date and scope.',
  },
  {
    label: 'Point-in-time recovery',
    pattern: /point[-\s]in[-\s]time recovery/i,
    why: 'Our backup job is a nightly `pg_dump`. Nothing archives the Postgres write-ahead log, so the only recoverable state is the last snapshot. Claiming PITR means promising to rewind to an arbitrary moment, which we cannot do.',
    whatWouldPermitIt: 'WAL archiving in the backup job (pgBackRest, wal-g or `archive_command`), plus a proven restore.',
  },
  {
    label: 'Restore tested',
    pattern: /restore[-\s]tested|disaster[-\s]recovery[-\s]tested/i,
    why: 'No restore has ever been performed (tracker T0-2). Backups existing and backups restoring are separate claims and only the first is true.',
    whatWouldPermitIt: 'A completed restore into a scratch database with the result recorded.',
  },
  {
    label: 'Absolute data residency',
    pattern: /no data (?:ever )?leaves|none of your data (?:ever )?leaves|never leaves (?:the UK|our jurisdiction)/i,
    why: 'Cannot be evidenced. Application data sits on a UK server, but Cloudflare sits in front of the site and our transactional mail is sent by a US-based provider. "No data leaves UK jurisdiction" is an absolute we have not verified and are not in a position to guarantee.',
    whatWouldPermitIt: 'A documented data-flow review covering CDN, email, backups and subprocessors, and a decision that the claim is defensible as written.',
  },
  {
    label: 'Numeric uptime promise',
    pattern: /\b\d{2,3}(?:\.\d+)?\s*%\s*(?:uptime|availability|uptime SLA)/i,
    why: 'We cannot evidence an availability figure. Uptime Kuma is deployed but nobody has confirmed a monitor exists, let alone what it has recorded (tracker T0-4). A number on a marketing page that we cannot substantiate is exactly what an NHS procurement questionnaire finds, and it is far harder to walk back once a customer has relied on it.',
    whatWouldPermitIt: 'Measured availability over a stated period from a monitor we have verified is working.',
    // The one place a number is allowed to appear is the Terms of Use, and only
    // because changing a contractual service level is not an engineer's call.
    // It is tracked as a registered claim below, and it must never appear on a
    // marketing page — a "target" in binding terms is a commitment; the same
    // number in a brochure is a promise we cannot keep.
    exemptFiles: ['src/pages/legal/TermsOfUsePage.tsx'],
  },
  {
    label: 'NHS accreditation, DSPT alignment, or NHS integration',
    // The earlier DSPT pattern matched the spelled-out name only, so
    // "DSPT-aligned" walked straight past it. Widened to catch the acronym and
    // the weasel verbs, because "aligned" and "integration-ready" are how an
    // unevidenced claim usually arrives.
    pattern: /\bNHS\s+(?:Data Security|DSPT|Digital|accredit\w+|approved|integrat\w+|trust)/i,
    why: 'We have no NHS accreditation, have not submitted the Data Security and Protection Toolkit, and have no integration with NHS Digital or any NHS system. The compliance page said "Meticle Care integrates with NHS workflows" and the contact page offered "NHS DSPT-aligned controls" — both untrue, and both on pages written for NHS and council buyers, who check.',
    whatWouldPermitIt: 'A submitted DSPT return we can produce, or a working integration we can demonstrate.',
    allowedPhrases: ['NHS Digital / NHS England'],
  },
  {
    label: 'Named third-party integration',
    // Any "integrates with X" naming a specific external system. We have no
    // outbound integrations beyond Stripe, which is evidenced in billing.
    pattern: /\bintegrat\w+ with (?!Stripe\b)[A-Z][\w ]{2,30}/,
    why: 'We have no integrations with NHS, council, telecare, funding or FHIR systems. "Integration-ready" is the same claim wearing a softer word.',
    whatWouldPermitIt: 'A working integration, or a documented interface we have actually built against.',
  },
  {
    label: 'Live or real-time claim for something that is not live',
    // The recurring one. Genuinely live: Socket.IO chat, and the call
    // assignment board via homecare:visit-updated. Everything else — dashboards,
    // compliance scoring, earnings, role changes — is a query on load.
    pattern: /\blive (?:data|feed|location|tracking|scoring|percentage|preview)\b|\breal[- ]time (?:data|feed|location|tracking|status|scoring)\b/i,
    why: 'Most of the product is queried on load, not pushed. "Live CQC readiness scoring", "Live data — not estimates", "Live location" and "see your earnings in real time" were all on public pages. The map in particular shows a check-in position, which is where someone was at that moment, not where they are.',
    whatWouldPermitIt: 'A server push or polling subscription for that specific surface, named in the registry.',
    // Chat and the call assignment board really are live, and saying so is
    // accurate. Both are registered below with the event that proves it.
    exemptFiles: ['src/pages/marketing/FeaturesPage.tsx'],
  },
  {
    label: 'Unverifiable pricing or discount',
    pattern: /\b\d{1,2}\s*%\s*(?:off|discount|below list|off-list)|off-list price|list price of/i,
    why: 'We have no published price list, no tier pricing behind a quote, and no discount schedule. "We hold a 15% off-list price for these organisations" was a number on a public page that nothing behind it could substantiate.',
    whatWouldPermitIt: 'A published price list the discount is calculated against.',
  },
  {
    label: 'Named clinical assessment or framework not implemented',
    pattern: /\bNHS Continuing Healthcare\b|\bCare Quality Information Framework\b/i,
    why: '"Support for NHS Continuing Healthcare assessments" appeared in the NHS compliance entry. The only occurrence of that term in the repository is a seed script, not a feature.',
    whatWouldPermitIt: 'An implemented assessment workflow, evidenced by routes and tests.',
  },
  // --- Regulator frameworks, checked against primary sources on 30 Sep 2026 ---
  // These four are here because each one was *wrong on a public page* and each
  // survived review, and because three of them are the kind of phrase that
  // sounds right because it is nearly right. See docs/CLAIM_REGISTER.md F20-F22.
  {
    label: 'CIW inspecting six areas',
    pattern: /six areas|well-being,?\s*care and support,?\s*environment,?\s*staffing/i,
    why: 'The CIW card said CIW "inspects services across six areas: Well-being, Care and support, Environment, Staffing, Management and leadership, and Suitability". CIW inspects across FOUR themes — Well-being, Care and Support, Leadership and Management, Environment — per gov.wales, "New ratings system for care services launches in Wales", 28 March 2025. "Staffing" and "Suitability" are not CIW themes and there is no sixth area. CIW also awards no overall rating, only per-theme. Corrected 30 Sep 2026; the pattern stays so the invented set cannot come back in a reworded sentence.',
    whatWouldPermitIt: 'It already has permission in its correct form: the four themes, quoted from gov.wales. Nothing more is needed to restore the wrong wording.',
  },
  {
    label: 'A CIW-style rating band that is not CIW\'s',
    pattern: /\bexcellent to bad\b|\brated from excellent\b/i,
    why: 'CIW\'s four ratings are excellent, good, requires improvement, requires significant improvement. There is no band called "bad" — the phrase "excellent to bad" was on the CIW card and is the shape of answer you produce by reasoning from the CQC\'s Outstanding/Good/Requires improvement/Inadequate instead of looking. "Inadequate" and "Adequate" are CQC\'s words, not CIW\'s, and appear nowhere in the CIW framework.',
    whatWouldPermitIt: 'CIW\'s own four band names, which the API already uses.',
  },
  {
    label: 'The RQIA founding Order misnamed',
    pattern: /Health and Personal Care Services/i,
    why: 'The title is the Health and Personal SOCIAL Services (Quality, Improvement and Regulation) (Northern Ireland) Order 2003 — confirmed on rqia.org.uk/guidance/legislation-and-standards and health-ni.gov.uk. "Personal Care Services" is not the title of the instrument. The wrong string was in the API registry, in a migration seed, and on the marketing page simultaneously, and two API tests asserted the wrong string, which is how it survived. Corrected 30 Sep 2026.',
    whatWouldPermitIt: 'Nothing — the correct title is not a claim being made, it is the name of an instrument.',
  },
  {
    label: 'RQIA domain labels in the regulator\'s voice',
    pattern: /\bIs care safe\?|\bIs care effective\?|\bIs care compassionate\?|\bIs the service well led\?/,
    why: 'These read as questions RQIA asks, attributed to a four-domain report structure that could not be traced to anything RQIA publishes. What RQIA does publish is nine sets of minimum standards, one per kind of service, chosen by registered setting. The groupings remain in the product, relabelled as ours ("Safety and protection" and so on), which is the honest form: useful to a provider, and not claiming to be RQIA\'s words.',
    whatWouldPermitIt: 'A citation to a published RQIA document that uses those questions. We have not found one.',
  },
]

/**
 * Claims that are permitted only because someone recorded why, and what the
 * state of the evidence is.
 *
 * `status: 'pending'` is the interesting one. It means we are saying this
 * today on the strength of an assumption rather than a check. Pending entries
 * must name the tracker item that will close them, and the test fails if that
 * item stops appearing in the readiness list — so a pending claim cannot
 * quietly outlive the decision that was supposed to settle it.
 */
export const REGISTERED_CLAIMS: {
  label: string
  pattern: RegExp
  status: 'verified' | 'pending'
  /** Why this is allowed. Required. "Trust me" is not a reason. */
  evidence: string
  /** For `verified`: a repo path that must exist. Keeps the citation checkable. */
  evidencePath?: string
  owner: string
  /** For `pending`: the tracker item in docs/GO_LIVE_READINESS.md that closes it. */
  closesOn?: string
  notes?: string
}[] = [
  {
    label: '99.9% uptime target in the Terms of Use',
    pattern: /99\.9\s*%\s*uptime/i,
    status: 'pending',
    evidence: 'The Terms of Use state "We target 99.9% uptime but cannot guarantee uninterrupted service", with a 48-hour planned-maintenance commitment. It is qualified, which is why it is tolerated rather than treated as a marketing overclaim — but it is still a service level in a contract, and we cannot currently evidence any availability figure at all.',
    owner: 'Adetoye',
    closesOn: 'T0-8',
    notes: 'Two things to settle, and neither is mine to settle: whether the solicitor is content with this drafting, and whether 99.9% is a number we can actually stand behind once monitoring is verified (T0-4). If monitoring shows we are nowhere near it, the number has to change, and it is better to change it before signature than after a customer relies on it. Do not move this wording to a marketing page.',
  },
  {
    label: 'ICO registered',
    pattern: /ICO registered/i,
    status: 'pending',
    evidence: 'Application submitted to the ICO on 28 Sep 2026 and awaiting approval; no registration number exists yet. The public pages state the claim but cite nothing. Decision taken 27 Sep 2026: register and keep the claim, then print the number on the page.',
    owner: 'Adetoye',
    closesOn: 'T0-1',
    notes: 'Progressed from not-submitted to submitted-and-waiting on 28 Sep 2026. The claim is not true until the number is on the page, so this stays registered-and-pending rather than being deleted. When the number arrives it goes on FeaturesPage and into the privacy policy, and this entry flips to verified.',
  },
  {
    label: 'AES-256 / encryption at rest',
    pattern: /AES-?256|encrypted at rest/i,
    status: 'verified',
    evidence: 'Scoped to one named column. `people.nhs_number` is encrypted with aes-256-gcm under an HKDF-derived per-organisation key (`apps/api/src/shared/utils/encryption.ts`), written encrypted on create and update, decrypted on read in the people and reporting repositories, and proven by an integration test that reads the raw column over a connection bypassing RLS. FIELD_ENCRYPTION_KEY is now mandatory: the API refuses to start without a well-formed one. Everything else is unencrypted — dates of birth, addresses and phone numbers are still plaintext, and pgcrypto is still installed and unused. Migration 137 widened the column from VARCHAR(20), which could not hold a ciphertext.',
    evidencePath: 'apps/api/src/shared/utils/encryption.ts',
    owner: 'Opeyemi',
    closesOn: 'T0-15',
    // Scope of the published wording is enforced by a positive test in
    // marketingClaims.test.ts rather than by an allowance here: this registry
    // records claims, FORBIDDEN_CLAIMS blocks them, and a permitted phrasing
    // would have let a blanket "encrypted at rest" back onto the page.
    notes: 'Went through three states and each one was documented as if it were settled. First "implemented twice", then "not implemented at all", now "implemented for NHS numbers only". The middle state was the dangerous one: encryption.ts existed, nothing imported it, and the register said column-level encryption "genuinely exists", so the recorded fix was to set FIELD_ENCRYPTION_KEY — which would have changed nothing. Widening T0-15 from "is the key set" to "is anything actually calling encryptField" was the actual repair. What remains is adoption on dates of birth, addresses and phone numbers, and pgcrypto should go if pgcrypt is not going to be used. Do not let this entry drift into implying more coverage than the migrations prove.',
  },
  {
    label: 'TLS 1.3',
    pattern: /TLS 1\.3/i,
    status: 'pending',
    evidence: 'TLS 1.3 is confirmed on the outbound mail path (observed in Gmail Received headers: version=TLS1_3). TLS 1.3 is NOT yet confirmed for the web and API edge, which is terminated by our own nginx.',
    owner: 'Opeyemi',
    closesOn: 'T0-16',
    notes: 'Verify the negotiated version against meticlecare.com and either keep the claim or restate it as TLS 1.2+.',
  },
  {
    // The three below were found by the 27 Sep 2026 sweep and are the reason
    // this list is not only a list of things we refuse to say. A guard that can
    // only delete copy trains people to avoid the guard rather than use it.
    label: 'Real-time messaging',
    pattern: /real-?time messaging|chat:message/i,
    status: 'verified',
    evidence: 'Chat is Socket.IO end to end. The API emits chat:message/chat:delivered/chat:read and the mobile ChatScreen subscribes to all three, so a message genuinely arrives without a refresh.',
    evidencePath: 'apps/mobile/src/screens/ChatScreen.tsx',
    owner: 'Opeyemi',
    notes: 'Exempt from the "live or real-time" block above for this phrase only. The same file also says "Live preview while typing" for OG metadata, which is a request-per-keystroke and is not a push — that one is a different phrase and is not covered by this exemption.',
  },
  {
    label: 'Call assignment board updates as carers check in',
    pattern: /monitor call completion in real time/i,
    status: 'verified',
    evidence: 'The one genuinely pushed surface in the web app: homecare.controller emits homecare:visit-updated on check-in and check-out, and CallAssignmentBoard subscribes to it. This is why "Monitor call completion in real time" on the download page was allowed to stand while "live CQC scoring" was corrected.',
    evidencePath: 'apps/web/src/pages/homecare/CallAssignmentBoard.tsx',
    owner: 'Opeyemi',
  },
  {
    label: 'AI-assisted care summaries',
    pattern: /AI-assisted care summar\w+/i,
    status: 'verified',
    evidence: 'The wording does not name a capability key, so it was checked rather than assumed. It corresponds to the manager_briefing and unified_intelligence routes, which take a from/to period and return source row counts, and the intelligence route returns per-item source_ids rendered as source links. "Traceable to the underlying data" is therefore accurate for that route. Twelve prompt keys ship in total: manager_briefing, compliance_gap_analysis, incident_severity_triage, rota_optimization, rota_generation, daily_note_generation, meal_plan_generation, shopping_list_generation, weekly_meal_plan, competency_assessment_assistant, visit_note_care_plan_gap, unified_intelligence.',
    evidencePath: 'apps/api/src/modules/ai/ai.controller.ts',
    owner: 'Opeyemi',
    notes: 'Carried on the pricing page as a Professional-tier feature, so it is a commitment rather than a description. If the 7/14/30-day period framing on the features page is ever dropped, the endpoint still takes from/to, so the claim survives it. What this claim does NOT say is that the output is reviewed before it is used, and nothing in the product reviews it.',
  },
  {
    label: 'Scheduling conflict detection',
    pattern: /conflict detection/i,
    status: 'verified',
    evidence: 'Genuinely implemented and more than a duplicate check: checkStaffShiftConflict rejects overlapping shifts, checkRestPeriod enforces working-time rest between shifts, and open-call assignment rejects a call that collides with an existing shift including a travel-time buffer. All three return 409.',
    evidencePath: 'apps/api/src/modules/scheduling/scheduling.repository.ts',
    owner: 'Opeyemi',
    notes: 'This is the strongest verified claim found in the sweep and it was nearly deleted for being adjacent to "rota optimisation", which is prompt-based and not a constraint solver. They are different features and only one of them is a solver.',
  },
]

/**
 * Phrases that look like a forbidden claim but are not — our disclaimers.
 *
 * These are asserted to be *present on specific pages*, not merely tolerated
 * somewhere on the site. That distinction is not pedantry: a site-wide
 * "does any page carry this?" check is satisfied as long as one page does, so
 * deleting the qualification from an individual compliance page passes while a
 * reader landing on that page meets an unqualified promise. Per-page is the
 * only granularity that matches the risk.
 *
 * Paths are relative to `apps/web`, the same base as PUBLIC_COPY_GLOBS.
 */
export const REQUIRED_DISCLAIMERS: {
  label: string
  phrase: RegExp
  why: string
  requiredIn: string[]
}[] = [
  {
    label: 'Compliance is not guaranteed',
    phrase: /does not guarantee compliance/i,
    why: 'We support inspection readiness. We do not produce a CQC rating and must never imply we do.',
    requiredIn: [
      'src/pages/marketing/CompliancePage.tsx',
      'src/pages/marketing/FeaturePage.tsx',
      'src/pages/marketing/PublicSitePage.tsx',
    ],
  },
  {
    label: 'Regulatory outcome is not claimed',
    phrase: /without claiming to guarantee any regulatory outcome/i,
    why: 'The domiciliary pages must carry the same qualification as the others, so a reader cannot meet a stronger promise on one page than we make on another.',
    requiredIn: ['src/pages/marketing/SolutionsPage.tsx'],
  },
  {
    label: 'AI data processing is disclosed',
    // Not a forbidden claim but a required one. The privacy policy described
    // what we collect and never mentioned that enabling AI sends records to a
    // third-party model provider, which for a health-data processor is not a
    // detail but the whole question a controller asks first.
    phrase: /pseudonymis|not raw/i,
    why: 'If AI features are enabled, care records go to a model provider. A controller signing up is entitled to know that, and to know the difference between pseudonymised and anonymised data. Removing this section would leave the policy describing a product that does less than it does.',
    requiredIn: ['src/pages/legal/PrivacyPolicyPage.tsx'],
  },
  {
    label: 'The "not anonymised" caveat survives',
    phrase: /still personal data|does not achieve/i,
    why: 'Pseudonymisation does not make data non-personal, and a policy that says only that data is "anonymised before sending" would be a false assurance to a health-data controller. The caveat is the part that has to stay.',
    requiredIn: ['src/pages/legal/PrivacyPolicyPage.tsx'],
  },
  {
    label: 'The encryption claim names the field it covers',
    phrase: /NHS numbers are encrypted/i,
    why: 'At-rest encryption is real for exactly one column — people.nhs_number — and nothing else. A policy that said simply "encrypted at rest" would be false against the schema, and would stay false however many columns are added later, because the sentence would not move. Naming the field keeps the claim tied to what a migration can actually prove.',
    requiredIn: ['src/pages/legal/PrivacyPolicyPage.tsx'],
  },
  {
    label: 'The unencrypted remainder is still disclosed',
    phrase: /not currently encrypted/i,
    why: 'Dates of birth, addresses and phone numbers are still plaintext in the database (T0-15). This sentence is the only thing stopping a reader inferring that the whole record is encrypted, and it is the sentence most likely to be tidied away as redundant by someone who has read the bullet above it. It is not redundant.',
    requiredIn: ['src/pages/legal/PrivacyPolicyPage.tsx'],
  },
]

/**
 * Marks we may not display, checked separately from copy.
 *
 * A wordmark is a trademark, not a sentence, so no rewording fixes it and none
 * of it would ever match a claim pattern. The NHS identity guidelines do not
 * permit the NHS logo to be used by organisations outside the NHS, and placing
 * it in a row of four real regulators on a commercial page reads as
 * accreditation we do not hold.
 *
 * The four care regulators are not listed here. We are a software supplier and
 * not a registered provider, so we are not purporting to be them — but using a
 * regulator's mark at all is worth a permission check, and that is a legal
 * question rather than an engineering one. Logged as an open item rather than
 * blocked, because blocking it would be a decision that is not ours to make
 * quietly either.
 */
export const RESTRICTED_LOGOS: { file: string; blocked: boolean; why: string; owner: string; tracker: string }[] = [
  {
    file: 'nhs.svg',
    blocked: true,
    why: 'NHS England restricts the NHS wordmark and logo to NHS bodies. It appeared on the landing page and in the regulator row of the compliance page, where it implied accreditation we do not hold. Removed 27 Sep 2026 and replaced with a text-only acronym tile.',
    owner: 'Adetoye',
    tracker: 'T1-5a',
  },
  {
    file: 'cqc.png',
    blocked: false,
    why: 'The CQC logo is used by the Commission for its own purposes. We are a software supplier, not a registered provider, so we are not purporting to be them. Worth confirming against the CQC brand guidance before launch rather than assuming a logo on a marketing page is fine — but blocking it here would be an engineer deciding a legal question, which is the same error as asserting the claim.',
    owner: 'Adetoye',
    tracker: 'T1-5b',
  },
  {
    file: 'ciw.png',
    blocked: false,
    why: 'Same question as CQC, for Care Inspectorate Wales.',
    owner: 'Adetoye',
    tracker: 'T1-5b',
  },
  {
    file: 'cis.png',
    blocked: false,
    why: 'Same question as CQC, for the Care Inspectorate (Scotland).',
    owner: 'Adetoye',
    tracker: 'T1-5b',
  },
  {
    file: 'rqia.png',
    blocked: false,
    why: 'Same question as CQC, for RQIA in Northern Ireland.',
    owner: 'Adetoye',
    tracker: 'T1-5b',
  },
]

/**
 * Logo files that must not be referenced from user-facing copy at all.
 *
 * Enforced by failing the build rather than by a review comment, because the
 * failure mode is invisible: someone adds a logo to a row of "trusted by"
 * badges and the next reviewer sees a grid of official-looking marks and
 * assumes someone checked.
 */
export const FORBIDDEN_LOGO_REFERENCES = RESTRICTED_LOGOS.filter(l => l.blocked).map(l => l.file)

/**
 * A claim phrase preceded by a negation is a disclaimer, not a claim.
 *
 * "Your employer's managers do not see a live feed" contains the forbidden
 * phrase "live feed" and means the opposite of claiming one. Without this, the
 * only way to satisfy the guard would be to delete the sentence that tells a
 * worker they are not being tracked live — which is the single most important
 * sentence in the notice.
 *
 * Deliberately narrow: a negation has to be close behind the claim, within
 * `NEGATION_WINDOW` characters, so "we do not collect location but our ISO
 * 27001 certification covers the rest" still fails on the certification.
 */
export const NEGATION_WINDOW = 60

export const NEGATION_PATTERN =
  /\b(?:not|never|no|without|cannot|isn'?t|aren'?t|don'?t|doesn'?t|didn'?t|hasn'?t|haven'?t|neither|nor)\b[^.]{0,60}$/i

/** True when the claim at `index` is inside a negation, i.e. being denied. */
export function isDenied(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - NEGATION_WINDOW), index)
  return NEGATION_PATTERN.test(before)
}

/**
 * Every match of `pattern` in `text` that is not a denial.
 *
 * Exists because checking only the first match is a hole, and a quiet one. The
 * copy "we hold no NHS accreditation and we have not submitted the NHS Data
 * Security and Protection Toolkit" contains a denied first mention and two
 * genuine-looking later ones. A guard that looks at `exec()[0]` and stops
 * passes that line, and the person reading the result is told the guard passed.
 */
export function unDeniedMatches(text: string, pattern: RegExp): RegExpExecArray[] {
  const global = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g')
  const out: RegExpExecArray[] = []
  let match: RegExpExecArray | null
  while ((match = global.exec(text)) !== null) {
    if (!isDenied(text, match.index)) out.push(match)
    // A zero-length match would loop forever.
    if (match[0].length === 0) global.lastIndex++
  }
  return out
}

/**
 * Places where naming a forbidden claim is the point of the sentence.
 *
 * Our own published documents have to be able to say "the privacy policy
 * claimed ISO 27001-certified and we removed it", or "we must not publish
 * ISO 27001 until a certificate exists", or "an NHS trust mail relay will
 * fail SPF alignment". Those are controls, not claims, and a guard that blocks
 * them forces us to delete the instructions that stop the claim being made.
 *
 * Each allowance is tied to a qualifier that must appear on the same line, so
 * it cannot rot. Delete "unless independently verified" from the capability
 * matrix and the ISO 27001 mention on that line starts failing again — which
 * is the intended behaviour, because that line is the prohibition itself.
 */
export const DOCUMENT_ALLOWANCES: { file: string; label: string; mustContain: RegExp; why: string }[] = [
  {
    file: 'docs/STORE_PRIVACY_ANSWERS.md',
    label: 'Record of the removed ISO 27001 claim',
    mustContain: /claimed ISO 27001|Do not reintroduce an ISO 27001|remains a planned item/i,
    why: 'The store answers exist to stop the removed claim being reintroduced. The sentence naming ISO 27001 is the instruction, not an assertion.',
  },
  {
    file: 'docs/PUBLIC_SITE_CAPABILITY_MATRIX.md',
    label: 'The prohibited-claims list',
    mustContain: /unless independently verified/i,
    why: 'This line is the list of things that must not be claimed. Removing the qualifier would turn the prohibition into a claim.',
  },
  {
    file: 'docs/SECURITY_POLICY.md',
    label: 'Cyber Essentials is an open action, not a held control',
    mustContain: /Evidence for a Cyber Essentials self-assessment/i,
    why: 'The document states the evidence is what we are seeking. It is a to-do, and the surrounding text is explicit that the policy is written from actual configuration.',
  },
  {
    file: 'docs/SECURITY_POLICY.md',
    label: 'NHS trust used as an example of a mail forwarder',
    mustContain: /mail relay|forwarder/i,
    why: 'An example of a relay that breaks SPF alignment. Says nothing about accreditation or integration, and the same sentence applies to a shared inbox or a support tool.',
  },
]

/** Whether a line in a given file is covered by an allowance. */
export function allowanceFor(file: string, lineText: string): string | null {
  for (const a of DOCUMENT_ALLOWANCES) {
    if (file.endsWith(a.file) && a.mustContain.test(lineText)) return a.label
  }
  return null
}
