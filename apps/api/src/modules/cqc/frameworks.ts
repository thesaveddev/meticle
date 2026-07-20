export interface StatementDef {
  id: string
  label: string
}

export interface DomainDef {
  key: string
  label: string
  color: string
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
  domains: DomainDef[]
  ratings: RatingDef[]
}

const CQC_FRAMEWORK: FrameworkDef = {
  id: 'cqc',
  name: 'CQC Single Assessment Framework',
  country: 'England',
  description: 'Care Quality Commission — 5 Key Questions, 34 Quality Statements',
  ratings: [
    { min: 81, label: 'Outstanding', color: '#7C3AED', description: 'Exceptional, innovative, person-centred care' },
    { min: 61, label: 'Good', color: '#16A34A', description: 'Effective, safe, responsive care' },
    { min: 31, label: 'Requires Improvement', color: '#F59E0B', description: 'Some areas need addressing' },
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

const CIW_FRAMEWORK: FrameworkDef = {
  id: 'ciw',
  name: 'CIW Performance Framework',
  country: 'Wales',
  description: 'Care Inspectorate Wales — aligned with the 5 Key Questions',
  ratings: [
    { min: 81, label: 'Excellent', color: '#7C3AED', description: 'Excellent service with outstanding features' },
    { min: 61, label: 'Good', color: '#16A34A', description: 'Good service with no significant concerns' },
    { min: 41, label: 'Adequate', color: '#F59E0B', description: 'Adequate but could be improved' },
    { min: 0, label: 'Poor', color: '#DC2626', description: 'Poor service requiring significant improvement' },
  ],
  domains: CQC_FRAMEWORK.domains.map(d => ({
    ...d,
    statements: d.statements.map(s => ({
      ...s,
      // CIW uses slightly different naming; keep IDs aligned for compatibility
    }))
  }))
}

const CARE_INSPECTORATE_FRAMEWORK: FrameworkDef = {
  id: 'care-inspectorate',
  name: 'Care Inspectorate Quality Framework',
  country: 'Scotland',
  description: 'Care Inspectorate Scotland — Quality Framework for Care Homes',
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

const RQIA_FRAMEWORK: FrameworkDef = {
  id: 'rqia',
  name: 'RQIA Inspection Framework',
  country: 'Northern Ireland',
  description: 'Regulation and Quality Improvement Authority',
  ratings: [
    { min: 81, label: 'Mostly Compliant', color: '#16A34A', description: 'Meeting all regulatory requirements' },
    { min: 41, label: 'Partially Compliant', color: '#F59E0B', description: 'Some requirements not fully met' },
    { min: 0, label: 'Not Compliant', color: '#DC2626', description: 'Significant non-compliance requiring action' },
  ],
  domains: [
    {
      key: 'safe', label: 'Safe',
      color: '#16A34A',
      statements: [
        { id: 'NI-S1', label: 'Safeguarding and protection' },
        { id: 'NI-S2', label: 'Medicines management' },
        { id: 'NI-S3', label: 'Infection prevention and control' },
        { id: 'NI-S4', label: 'Environment and equipment safety' },
      ]
    },
    {
      key: 'effective', label: 'Effective',
      color: '#6366F1',
      statements: [
        { id: 'NI-E1', label: 'Assessment and care planning' },
        { id: 'NI-E2', label: 'Staff training and competence' },
        { id: 'NI-E3', label: 'Outcomes for people' },
      ]
    },
    {
      key: 'caring', label: 'Caring',
      color: '#D946EF',
      statements: [
        { id: 'NI-C1', label: 'Dignity and respect' },
        { id: 'NI-C2', label: 'Person-centred approach' },
      ]
    },
    {
      key: 'responsive', label: 'Responsive',
      color: '#F59E0B',
      statements: [
        { id: 'NI-R1', label: 'Meeting individual needs' },
        { id: 'NI-R2', label: 'Complaints and feedback' },
      ]
    },
    {
      key: 'well-led', label: 'Well-led',
      color: '#0F4C81',
      statements: [
        { id: 'NI-W1', label: 'Governance and accountability' },
        { id: 'NI-W2', label: 'Leadership and culture' },
        { id: 'NI-W3', label: 'Quality improvement' },
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
  return Object.values(FRAMEWORKS).map(f => ({ id: f.id, name: f.name, country: f.country }))
}
