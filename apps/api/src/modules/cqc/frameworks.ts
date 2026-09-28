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
 * Northern Ireland.
 *
 * RQIA is the independent body regulating registered health and social care
 * services in Northern Ireland, established under the Health and Personal Care
 * Services (Quality Improvement and Regulation) (Northern Ireland) Order 2003. It
 * publishes narrative inspection reports, and those reports are organised around
 * four domains: is care safe, is care effective, is care compassionate, and is
 * the service well led.
 *
 * What RQIA does not publish is the thing the previous version of this file
 * invented. There is no numbered quality statement set, so there are no
 * `NI-S1`-style identifiers — the ones we removed were ours, made up, and
 * unlookupable. There is no numeric rating scale, so `ratings` is absent and the
 * readiness screen shows no band at all for Northern Ireland rather than
 * inventing "Mostly Compliant". The sub-items below are MeticleCare's own
 * evidence groupings, marked as such.
 */
const RQIA_FRAMEWORK: FrameworkDef = {
  id: 'rqia',
  name: 'RQIA Inspection Domains',
  country: 'Northern Ireland',
  description:
    'Regulation and Quality Improvement Authority — inspection reports are organised around four domains. RQIA publishes narrative inspection reports, not a numeric rating, so no overall rating is shown for Northern Ireland. RQIA does not publish numbered quality statements; the items below are MeticleCare’s own evidence groupings, not RQIA references.',
  source:
    'Regulation and Quality Improvement Authority, Northern Ireland, under the Health and Personal Care Services (Quality Improvement and Regulation) (Northern Ireland) Order 2003. Inspection reports are structured around four domains: is care safe, is care effective, is care compassionate, is the service well led.',
  publishesOverallRating: false,
  evidenceDomains: { experience: 'compassionate', leadership: 'well-led', incidents: 'safe' },
  domains: [
    {
      key: 'safe', label: 'Is care safe?',
      color: '#16A34A',
      statements: [
        { id: 'safe-1', label: 'Safeguarding and protection from abuse', wordingOurs: true },
        { id: 'safe-2', label: 'Management of medicines', wordingOurs: true },
        { id: 'safe-3', label: 'Infection prevention and control', wordingOurs: true },
        { id: 'safe-4', label: 'Environment and equipment safety', wordingOurs: true },
      ]
    },
    {
      key: 'effective', label: 'Is care effective?',
      color: '#6366F1',
      statements: [
        { id: 'effective-1', label: 'Assessment and care planning', wordingOurs: true },
        { id: 'effective-2', label: 'Staff training and competence', wordingOurs: true },
        { id: 'effective-3', label: 'Outcomes achieved for people using the service', wordingOurs: true },
      ]
    },
    {
      key: 'compassionate', label: 'Is care compassionate?',
      color: '#D946EF',
      statements: [
        { id: 'compassionate-1', label: 'Dignity and respect', wordingOurs: true },
        { id: 'compassionate-2', label: 'Person-centred practice and choice', wordingOurs: true },
      ]
    },
    {
      key: 'well-led', label: 'Is the service well led?',
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
