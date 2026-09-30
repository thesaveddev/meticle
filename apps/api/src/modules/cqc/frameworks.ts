/**
 * Regulator frameworks: CQC, CIW, Care Inspectorate, RQIA.
 *
 * A word of warning about what this file is, because the previous version of it
 * was the clearest instance of a claim in this codebase that nothing backed up.
 *
 * It defined two frameworks that did not exist. The Welsh one was literally
 * `CQC_FRAMEWORK.domains.map(...)` with a comment inside the map body saying CIW
 * "uses slightly different naming" and no change made — so a Welsh provider was
 * scored on England's 5 Key Questions and shown a Welsh rating scale over
 * English statements. The Northern Irish one invented fourteen identifiers,
 * `NI-S1` through `NI-W3`, and a three-band "Mostly Compliant / Partially
 * Compliant / Not Compliant" scale, none of which appear in anything RQIA has
 * published. They were plausible and unfalsifiable, which is worse than being
 * wrong: nobody could look `NI-S1` up and find it missing.
 *
 * So every framework here carries a `source`, and anything in a domain or
 * rating that is MeticleCare's wording rather than a regulator's is marked. A
 * framework that cannot be sourced does not belong in this file. If a regulator
 * publishes no numbered statements, we say so in its `description` rather than
 * inventing identifiers for them.
 *
 * Two facts do real work here and are worth knowing:
 *
 *   - CIW replaced its inspection framework on 1 April 2025. Ratings come from
 *     the Regulated Services (Inspection Ratings) (Wales) Regulations 2025,
 *     which give effect to section 37 of the Regulation and Inspection of
 *     Social Care (Wales) Act 2016. There are four themes and four ratings, and
 *     the fourth rating is "requires significant improvement" — not "poor" and
 *     not "adequate".
 *   - CIW states it does not award a single rating for a service. "We award a
 *     rating for each inspection theme. We do not award one overall rating for
 *     the service as a whole." So `publishesOverallRating` is false for Wales
 *     and the readiness screen shows per-theme ratings only.
 */

export interface StatementDef {
  id: string
  label: string
  /**
   * The wording is MeticleCare's, not a regulator's.
   *
   * Set wherever the underlying regulator does not publish this text. It is a
   * claim marker, not a disclaimer: an inspector asking "where did this line
   * come from" should get an honest "we wrote that", not a citation to a
   * document that does not contain it.
   */
  wordingOurs?: boolean
}

export interface DomainDef {
  key: string
  label: string
  color: string
  /** The regulator's own description of what this domain or theme covers. */
  description?: string
  /**
   * Service types this domain applies to. Absent means all of them.
   *
   * Set where the regulator itself carves an exception out — CIW does not rate
   * Environment for domiciliary services, so a domiciliary provider is not
   * shown a theme its regulator never scores it on.
   */
  appliesToServiceTypes?: string[]
  statements: StatementDef[]
}

export interface RatingDef {
  min: number
  label: string
  color: string
  description?: string
}

export interface FrameworkDef {
  id: string
  name: string
  country: string
  description: string
  /** Where this definition came from, and what is ours. Shown in the UI. */
  source: string
  /**
   * Whether the regulator publishes one rating for the whole service.
   *
   * Absent or true means yes. False means the readiness screen must not present
   * an overall band as though the regulator had issued one, because for both
   * CIW and RQIA it has not.
   */
  publishesOverallRating?: boolean
  /**
   * Published rating bands, or absent where the regulator publishes no numeric
   * scale. RQIA has none, so we assert none.
   */
  ratings?: RatingDef[]
  /**
   * Discloses that the band thresholds are ours, where the regulator publishes
   * rating words but not numeric cut-offs. Shown next to the rating legend so
   * a Welsh manager is not left thinking CIW set 81% for Excellent.
   */
  ratingsNote?: string
  /**
   * Which of this framework's own domains the generic gap messages should
   * name. Held here rather than in the gap builder so a Welsh gap says
   * "Well-being" and a Northern Irish one says "Is care compassionate?"
   * rather than both saying "Caring", which is CQC's word.
   */
  evidenceDomains?: { experience: string; leadership: string; incidents: string }
  domains: DomainDef[]
  /**
   * A machine-readable citation for the same thing `source` says in prose.
   *
   * The evidence pack is a printable document a provider may hand to an
   * inspector, and a reader who wants to check a claim about their own regulator
   * needs a link and a date, not a sentence. Kept alongside `source` rather
   * than replacing it, because `source` also carries the "this part is ours"
   * half of the disclosure and that does not fit in three fields.
   */
  sourceUrl?: string
  sourcePublishedOn?: string
  sourceRetrievedOn?: string
  /**
   * A structural fact about the framework that changes what a document may
   * claim. RQIA's is the important one: there is no single RQIA framework, so a
   * pack that listed "the RQIA standards" would be asserting a list that does
   * not exist.
   */
  caveat?: string
  /**
   * Which parts of this definition were checked against a primary source, and
   * when.
   *
   * A partial object is the honest case and RQIA is currently one: the Order it
   * is established under is verified, the fact that it inspects against
   * per-setting minimum standards is verified, and the four-domain structure
   * attributed to its inspection reports is NOT — we could not find it in
   * anything RQIA has published. Listing the unverified part by name is the
   * point; a bare boolean would flatten that.
   */
  verifiedAspects?: Record<string, { verified: boolean; detail: string }>
}

const CQC_FRAMEWORK: FrameworkDef = {
  id: 'cqc',
  name: 'CQC Single Assessment Framework',
  country: 'England',
  description: 'Care Quality Commission — 5 Key Questions, 34 Quality Statements',
  source: 'CQC Single Assessment Framework (England).',
  evidenceDomains: { experience: 'caring', leadership: 'well-led', incidents: 'responsive' },
  ratings: [
    { min: 81, label: 'Outstanding', color: '#7C3AED', description: 'Exceptional, innovative, person-centred care' },
    { min: 61, label: 'Good', color: '#16A34A', description: 'Effective, safe, responsive care' },
    { min: 31, label: 'Requires Improvement', color: '#F59E0B', description: 'Some areas need addressed' },
    { min: 0, label: 'Inadequate', color: '#DC2626', description: 'Significant concerns requiring urgent action' },
  ],
  domains: [
    {
      key: 'safe', label: 'Safe',
      color: '#16A34A',
      statements: [
        { id: 'S1', label: 'Learning culture' },
        { id: 'S2', label: 'Safe systems, pathways and transitions' },
        { id: 'S3', label: 'Safeguarding' },
        { id: 'S4', label: 'Involving people to manage risks' },
        { id: 'S5', label: 'Safe environments' },
        { id: 'S6', label: 'Safe and effective staffing' },
        { id: 'S7', label: 'Infection prevention and control' },
        { id: 'S8', label: 'Medicines optimisation' },
      ]
    },
    {
      key: 'effective', label: 'Effective',
      color: '#6366F1',
      statements: [
        { id: 'E1', label: 'Assessing needs' },
        { id: 'E2', label: 'Delivering evidence-based care and treatment' },
        { id: 'E3', label: 'How staff, teams and services work together' },
        { id: 'E4', label: 'Supporting people to live healthier lives' },
        { id: 'E5', label: 'Monitoring and improving outcomes' },
        { id: 'E6', label: 'Consent to care and treatment' },
        { id: 'E7', label: 'Fuel, hydration and nutrition' },
      ]
    },
    {
      key: 'caring', label: 'Caring',
      color: '#D946EF',
      statements: [
        { id: 'C1', label: 'Kindness, compassion and dignity' },
        { id: 'C2', label: 'Treating people as individuals' },
        { id: 'C3', label: 'Independence, choice and control' },
        { id: 'C4', label: "Responding to people's immediate needs" },
        { id: 'C5', label: 'Workforce wellbeing and enablement' },
      ]
    },
    {
      key: 'responsive', label: 'Responsive',
      color: '#F59E0B',
      statements: [
        { id: 'R1', label: 'Person-centred care' },
        { id: 'R2', label: 'Care provision, integration and continuity' },
        { id: 'R3', label: 'Providing information' },
        { id: 'R4', label: 'Listening to and involving people' },
        { id: 'R5', label: 'Equity in access' },
        { id: 'R6', label: 'Equity in experiences and outcomes' },
        { id: 'R7', label: 'Planning for future needs' },
      ]
    },
    {
      key: 'well-led', label: 'Well-led',
      color: '#0F4C81',
      statements: [
        { id: 'W1', label: 'Shared direction and culture' },
        { id: 'W2', label: 'Capable, compassionate and inclusive leaders' },
        { id: 'W3', label: 'Freedom to speak up' },
        { id: 'W4', label: 'Workforce diversity and equality' },
        { id: 'W5', label: 'Continuous improvement, innovation and change' },
        { id: 'W6', label: 'Partnerships and communities' },
        { id: 'W7', label: 'Environmental sustainability – sustainable development' },
      ]
    }
  ]
}

/**
 * Wales. Its own framework, from 1 April 2025 — not CQC with Welsh labels.
 *
 * Four themes, CIW's own descriptions of them, and CIW's four published ratings.
 * The line-of-enquiry numbering is CIW's (twelve for domiciliary services, which
 * is MeticleCare's main model; eleven for residential). The wording of each line
 * is ours, because CIW publishes the numbers and the themes but we could not
 * obtain the text of the lines themselves — so every one is marked
 * `wordingOurs` rather than dressed up as a quotation. Confirming the text with
 * CIW before a Welsh customer relies on it is tracked as T2-15.
 *
 * The `min` values are ours too. CIW publishes rating words and descriptors, not
 * percentage thresholds, so a score is mapped onto their vocabulary by us and
 * `ratingsNote` says so where the customer can read it.
 */
const CIW_FRAMEWORK: FrameworkDef = {
  id: 'ciw',
  name: 'CIW Inspection Framework',
  country: 'Wales',
  description:
    'Care Inspectorate Wales — four themes, rated individually. CIW awards a rating for each theme and states it does not award one overall rating for the service, so MeticleCare does not present a single Welsh rating either. Domiciliary support services are not rated on Environment.',
  source:
    'Care Inspectorate Wales, "Ratings for care homes and domiciliary support services" (published 4 December 2025); Regulated Services (Inspection Ratings) (Wales) Regulations 2025, giving effect to s.37 of the Regulation and Inspection of Social Care (Wales) Act 2016. In force 1 April 2025.',
  sourceUrl: 'https://www.gov.wales/new-ratings-system-care-services-launches-wales-0',
  sourcePublishedOn: '2025-03-28',
  sourceRetrievedOn: '2026-09-30',
  verifiedAspects: {
    themes: {
      verified: true,
      detail: 'Four themes — Well-being, Care and Support, Leadership and Management, Environment — quoted from gov.wales, 28 March 2025.',
    },
    ratingScale: {
      verified: true,
      detail: 'Four ratings — excellent, good, requires improvement, requires significant improvement — quoted from gov.wales, 28 March 2025.',
    },
    themeSubCriteria: {
      verified: false,
      detail: 'The sub-criteria CIW examines under each theme live in its inspection guidance, which has not been read. The statements below each theme are ours.',
    },
    bandThresholds: {
      verified: false,
      detail: 'CIW assesses each theme as a judgement and publishes no numeric cut-offs. The percentages in `ratings` are ours, which ratingsNote discloses.',
    },
  },
  publishesOverallRating: false,
  ratings: [
    {
      min: 81, label: 'Excellent', color: '#7C3AED',
      description: 'With few exceptions the service is outstanding — exceptional leadership, care that puts people at the centre of everything, or a significant positive difference to people’s well-being.',
    },
    {
      min: 61, label: 'Good', color: '#16A34A',
      description: 'The service is consistently safe and caring, and meets people’s needs through reliable practices with positive results.',
    },
    {
      min: 31, label: 'Requires improvement', color: '#F59E0B',
      description: 'The service sometimes falls short of expected standards, with inconsistent practices and areas that need strengthening to ensure people’s safety and well-being.',
    },
    {
      min: 0, label: 'Requires significant improvement', color: '#DC2626',
      description: 'The service is rarely effective, has weak or inadequate leadership, and has significant gaps in care that risk people’s safety and well-being. The provider must take immediate action.',
    },
  ],
  ratingsNote:
    'The rating words and descriptions are CIW’s. The percentages that place a theme in one of them are MeticleCare’s own mapping — CIW assesses each theme as a judgement and does not publish score thresholds.',
  evidenceDomains: { experience: 'well-being', leadership: 'leadership-and-management', incidents: 'well-being' },
  domains: [
    {
      key: 'well-being', label: 'Well-being',
      color: '#16A34A',
      description: 'We assess how well people receiving care and support are doing, focusing on whether they are achieving positive outcomes in their lives.',
      statements: [
        { id: 'LOE-1', label: 'People achieve positive outcomes in their lives', wordingOurs: true },
        { id: 'LOE-2', label: 'People are involved in decisions about their care', wordingOurs: true },
        { id: 'LOE-3', label: 'People are protected from abuse, neglect and harm', wordingOurs: true },
        { id: 'LOE-4', label: 'People’s emotional and psychological well-being is supported', wordingOurs: true },
      ]
    },
    {
      key: 'care-and-support', label: 'Care and support',
      color: '#6366F1',
      description: 'We examine the quality of care and support provided, checking that people receive a high-quality service delivered by knowledgeable and skilled staff, and that the care helps people achieve the best possible outcomes.',
      statements: [
        { id: 'LOE-5', label: 'Needs are assessed and care is planned with the person', wordingOurs: true },
        { id: 'LOE-6', label: 'Care is delivered by knowledgeable and skilled staff', wordingOurs: true },
        { id: 'LOE-7', label: 'Care supports independence and daily living', wordingOurs: true },
        { id: 'LOE-8', label: 'Health, medication and clinical needs are managed', wordingOurs: true },
      ]
    },
    {
      key: 'environment', label: 'Environment',
      color: '#D946EF',
      description: 'We look at the physical setting where care and support is provided, ensuring that people live in a home that is safe, clean, comfortable, welcoming, well-maintained, and suitably equipped and furnished.',
      // "Domiciliary support services do not receive a rating for ‘Environment’."
      appliesToServiceTypes: ['supported_living', 'residential', 'live_in'],
      statements: [
        { id: 'LOE-9', label: 'The environment is safe, clean, well-maintained and suitably equipped', wordingOurs: true },
      ]
    },
    {
      key: 'leadership-and-management', label: 'Leadership and management',
      color: '#0F4C81',
      description: 'We evaluate how the service is organised and managed, considering whether the arrangements in place ensure high-quality care is delivered by motivated staff in a well-led and managed service.',
      statements: [
        { id: 'LOE-10', label: 'The service is governed and organised to deliver good care', wordingOurs: true },
        { id: 'LOE-11', label: 'Staff are recruited, trained, supervised and supported', wordingOurs: true },
        { id: 'LOE-12', label: 'Quality is monitored and improved, and partners are involved', wordingOurs: true },
      ]
    }
  ]
}

const CARE_INSPECTORATE_FRAMEWORK: FrameworkDef = {
  id: 'care-inspectorate',
  name: 'Care Inspectorate Quality Framework',
  country: 'Scotland',
  description: 'Care Inspectorate Scotland — Quality Framework for Care Homes',
  source: 'Care Inspectorate (Scotland) quality framework for care homes, six-point evaluation scale.',
  evidenceDomains: { experience: 'quality-care-support', leadership: 'quality-management', incidents: 'quality-care-support' },
  ratings: [
    { min: 84, label: '6 - Excellent', color: '#7C3AED', description: 'Excellent - outstanding performance' },
    { min: 68, label: '5 - Very Good', color: '#16A34A', description: 'Very Good - major strengths' },
    { min: 52, label: '4 - Good', color: '#22C55E', description: 'Good - important strengths' },
    { min: 36, label: '3 - Adequate', color: '#F59E0B', description: 'Adequate - strengths but areas for improvement' },
    { min: 18, label: '2 - Weak', color: '#FB923C', description: 'Weak - some strengths but important weaknesses' },
    { min: 0, label: '1 - Unsatisfactory', color: '#DC2626', description: 'Unsatisfactory - major weaknesses' },
  ],
  domains: [
    {
      key: 'quality-care-support', label: 'Quality of Care and Support',
      color: '#16A34A',
      statements: [
        { id: 'QC1', label: 'People experience care that meets their needs' },
        { id: 'QC2', label: 'People are protected from harm' },
        { id: 'QC3', label: 'People\'s health and wellbeing is promoted' },
        { id: 'QC4', label: 'People are supported by confident and skilled staff' },
      ]
    },
    {
      key: 'quality-environment', label: 'Quality of Environment',
      color: '#6366F1',
      statements: [
        { id: 'QE1', label: 'The environment is safe and well maintained' },
        { id: 'QE2', label: 'The environment supports people\'s needs' },
      ]
    },
    {
      key: 'quality-staffing', label: 'Quality of Staffing',
      color: '#D946EF',
      statements: [
        { id: 'QS1', label: 'Staffing levels are appropriate' },
        { id: 'QS2', label: 'Staff are well trained and supported' },
        { id: 'QS3', label: 'Staff work well together as a team' },
      ]
    },
    {
      key: 'quality-management', label: 'Quality of Management and Leadership',
      color: '#0F4C81',
      statements: [
        { id: 'QM1', label: 'Leadership is effective and visible' },
        { id: 'QM2', label: 'Management ensures quality improvements' },
        { id: 'QM3', label: 'Partnerships with others deliver good outcomes' },
      ]
    }
  ]
}

/**
 * The nine sets of minimum standards DoH publishes, one per kind of service.
 *
 * Verified 30 September 2026 against health-ni.gov.uk, "Care standards" and
 * "Care standards - documents", and rqia.org.uk, "Legislation and Standards".
 * The Department states that these "will be used by the Regulation and Quality
 * Improvement Authority (RQIA) alongside the requirements of regulations, in
 * making decisions on regulations of establishments and agencies."
 *
 * This list is the reason the RQIA entry below cannot have a single set of
 * standards. There is one document per setting, and which one applies depends
 * on what the provider is registered as — a thing this product does not hold.
 */
export const RQIA_STANDARDS_SETS = [
  'Residential Care Home Minimum Standards',
  'Nursing Agencies Standards',
  'Domiciliary Care Agencies Minimum Standards',
  'Residential Family Centres Standards',
  'Adult Day Care Settings Minimum Standards',
  'Childminding and Day Care Standards (children under 12)',
  'Children’s Homes Standards',
  'Independent Healthcare Establishments Standards',
  'Care Standards for Nursing Homes',
] as const

/**
 * Which standards set applies, from the service type we record.
 *
 * `organizations.primary_service_type` is one of supported_living, domiciliary,
 * residential, live_in (migration 071). Three of those four are delivered in a
 * care home setting, so the care home set is the right starting point for all
 * three, but RQIA registers a *place* under a specific setting name and we do
 * not hold that name. The result therefore names the inference rather than
 * presenting it as a fact, and a provider whose setting is recorded wrongly can
 * see the alternative without having to ask us.
 *
 * Null when nothing is recorded. That is a deliberate gap rather than a fallback
 * to the most likely set: an evidence pack has to name the document it is being
 * offered against, and picking one of nine without knowing the setting is a
 * guess about the very thing a provider is most likely to be asked about.
 */
export function resolveRqiaStandardsSet(primaryServiceType?: string | null): {
  standards: string
  derivedFrom: string
} | null {
  switch (primaryServiceType) {
    case 'residential':
    case 'live_in':
      return { standards: 'Residential Care Home Minimum Standards', derivedFrom: primaryServiceType }
    case 'supported_living':
      return { standards: 'Residential Care Home Minimum Standards', derivedFrom: 'supported_living (inferred)' }
    case 'domiciliary':
      return { standards: 'Domiciliary Care Agencies Minimum Standards', derivedFrom: primaryServiceType }
    default:
      return null
  }
}

/**
 * Northern Ireland.
 *
 * RQIA is the independent body regulating registered health and social care
 * services in Northern Ireland. Two things here were wrong and one was
 * unverifiable, and all three are recorded rather than tidied away.
 *
 * **Wrong: the founding Order.** This said the Health and Personal *Care*
 * Services (Quality Improvement and Regulation) (Northern Ireland) Order 2003.
 * The title is the Health and Personal *Social* Services (Quality, Improvement
 * and Regulation) (Northern Ireland) Order 2003, confirmed on both
 * rqia.org.uk/guidance/legislation-and-standards and health-ni.gov.uk. Two
 * tests asserted the wrong string, which is how it survived: a test written to
 * match the code stops noticing the code is wrong.
 *
 * **Wrong: the implied single framework.** RQIA does not publish one framework.
 * DoH publishes nine sets of minimum standards, one per kind of service, and the
 * RQIA uses the set matching the registered setting. So there is no "the RQIA
 * standards" to list, and an evidence pack that claimed otherwise would be
 * inventing the document.
 *
 * **Unverifiable: the four domains.** This file has asserted that RQIA
 * inspection reports are organised around four domains — safe, effective,
 * compassionate, well led. We could not find that structure in anything RQIA
 * has published, and the search that turned up nothing was a careful one against
 * RQIA's own guidance pages. That is not the same as it being false, so the
 * domains stay and are relabelled as our own evidence groupings rather than
 * deleted: a Northern Irish provider is better served by a usable grouping we
 * have flagged than by an empty screen. What is gone is the claim that these are
 * RQIA's words, and the `verifiedAspects` entry below records the gap so it
 * cannot be forgotten.
 *
 * Still true, and still asserted: there is no numbered quality statement set, so
 * no `NI-S1`-style identifiers; and no numeric rating scale, so `ratings` is
 * absent and the readiness screen shows no band at all rather than inventing
 * "Mostly Compliant".
 */
const RQIA_FRAMEWORK: FrameworkDef = {
  id: 'rqia',
  name: 'RQIA minimum standards for your setting',
  country: 'Northern Ireland',
  description:
    'Regulation and Quality Improvement Authority — inspects against the minimum standards published for your registered setting, alongside the regulations for that setting. There is no single RQIA framework and no overall rating, so none is shown for Northern Ireland. RQIA does not publish numbered quality statements; the groupings below are MeticleCare’s own evidence groupings, not RQIA references, and no statement is claimed as meeting any standard.',
  source:
    'Regulation and Quality Improvement Authority, Northern Ireland, established under the Health and Personal Social Services (Quality, Improvement and Regulation) (Northern Ireland) Order 2003. The applicable framework is the minimum standards document published by the Department of Health for your registered setting — there are nine, one per kind of service.',
  sourceUrl: 'https://www.rqia.org.uk/guidance/legislation-and-standards/',
  sourcePublishedOn: '2003',
  sourceRetrievedOn: '2026-09-30',
  publishesOverallRating: false,
  caveat:
    'The RQIA inspects against the minimum standards published for your registered setting, alongside the regulations for that setting. Nine sets have been published, one per kind of service. This pack is arranged against the set named in it, not against a single RQIA framework.',
  verifiedAspects: {
    foundingOrder: {
      verified: true,
      detail: 'Health and Personal Social Services (Quality, Improvement and Regulation) (Northern Ireland) Order 2003 — confirmed on rqia.org.uk and health-ni.gov.uk, 30 September 2026.',
    },
    applicableFramework: {
      verified: true,
      detail: 'Nine sets of minimum standards, one per setting, used by RQIA alongside the regulations — confirmed on health-ni.gov.uk and rqia.org.uk, 30 September 2026.',
    },
    fourDomainStructure: {
      verified: false,
      detail: 'This file previously attributed a four-domain structure (safe, effective, compassionate, well led) to RQIA inspection reports. It could not be traced to anything RQIA has published, so it is no longer claimed. The groupings remain as our own evidence groupings, marked as such.',
    },
    standardNumbering: {
      verified: false,
      detail: 'The individual standards within each set have not been read, so no standard number, title or wording appears anywhere in this product and nothing is scored against a specific standard.',
    },
  },
  evidenceDomains: { experience: 'compassionate', leadership: 'well-led', incidents: 'safe' },
  domains: [
    {
      key: 'safe', label: 'Safety and protection',
      color: '#16A34A',
      statements: [
        { id: 'safe-1', label: 'Safeguarding and protection from abuse', wordingOurs: true },
        { id: 'safe-2', label: 'Management of medicines', wordingOurs: true },
        { id: 'safe-3', label: 'Infection prevention and control', wordingOurs: true },
        { id: 'safe-4', label: 'Environment and equipment safety', wordingOurs: true },
      ]
    },
    {
      key: 'effective', label: 'Assessment and planning',
      color: '#6366F1',
      statements: [
        { id: 'effective-1', label: 'Assessment and care planning', wordingOurs: true },
        { id: 'effective-2', label: 'Staff training and competence', wordingOurs: true },
        { id: 'effective-3', label: 'Outcomes achieved for people using the service', wordingOurs: true },
      ]
    },
    {
      key: 'compassionate', label: 'Dignity and person-centred practice',
      color: '#D946EF',
      statements: [
        { id: 'compassionate-1', label: 'Dignity and respect', wordingOurs: true },
        { id: 'compassionate-2', label: 'Person-centred practice and choice', wordingOurs: true },
      ]
    },
    {
      key: 'well-led', label: 'Governance and leadership',
      color: '#0F4C81',
      statements: [
        { id: 'well-led-1', label: 'Governance and accountability', wordingOurs: true },
        { id: 'well-led-2', label: 'Leadership and culture', wordingOurs: true },
        { id: 'well-led-3', label: 'Quality improvement', wordingOurs: true },
      ]
    }
  ]
}

const FRAMEWORKS: Record<string, FrameworkDef> = {
  cqc: CQC_FRAMEWORK,
  ciw: CIW_FRAMEWORK,
  'care-inspectorate': CARE_INSPECTORATE_FRAMEWORK,
  rqia: RQIA_FRAMEWORK,
}

export function getFramework(regulator: string): FrameworkDef {
  return FRAMEWORKS[regulator] || CQC_FRAMEWORK
}

/**
 * The framework for a regulator, or null when we have none for it.
 *
 * `getFramework` falls back to the CQC, which is right for the readiness screen
 * — a provider with no regulator recorded is overwhelmingly English, and an
 * empty screen teaches nobody anything. It is exactly wrong for anything that
 * prints: a document that says "CQC" to a Welsh or Northern Irish provider
 * because we did not have theirs is the failure this module was written to end,
 * arriving again through the front door. So the printable paths use this.
 */
export function findFramework(regulator: string | null | undefined): FrameworkDef | null {
  if (!regulator) return null
  return FRAMEWORKS[regulator] ?? null
}

export function getFrameworkList() {
  return Object.values(FRAMEWORKS).map(f => ({
    id: f.id,
    name: f.name,
    country: f.country,
    // Whether an overall band can be shown at all. A client that renders a
    // single rating regardless of this is asserting a rating its regulator
    // never issued.
    publishesOverallRating: f.publishesOverallRating !== false,
  }))
}

/** The domains that apply to a given set of service types. */
export function domainsForServiceTypes(framework: FrameworkDef, serviceTypes: string[] | null | undefined): DomainDef[] {
  if (!serviceTypes || serviceTypes.length === 0) return framework.domains
  return framework.domains.filter(
    d => !d.appliesToServiceTypes || d.appliesToServiceTypes.some(t => serviceTypes.includes(t)),
  )
}
