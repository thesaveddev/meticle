import { Box, Container, Typography, Grid, Paper, Stack, Chip, Button } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { ArrowForward as ArrowIcon } from '@mui/icons-material'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'

const INK = '#1B2430'
const NAVY = '#0F4C81'
const EMERALD = '#10B981'
const MIST = '#5B6672'
const HAIRLINE = '#E7E1D6'

interface Badge {
  name: string
  acronym: string
  /**
   * Optional, because not every body on this page may be used as a logo. The
   * NHS wordmark is restricted to NHS bodies, so the NHS entry carries none and
   * falls back to the acronym alone rather than to a broken image.
   */
  logo?: string
  color: string
  region: string
  description: string
  whatItDoes: string
  howMeticleHelps: string[]
  keyRequirements: string[]
  website: string
  /**
   * A limitation stated on the same card as the claims it qualifies.
   *
   * A page of badges invites a reader to conclude "this is all covered". The
   * honest version of that page puts the gaps in the same typeface as the
   * features, because a disclaimer three screens below a claim is a disclaimer
   * nobody reads.
   */
  caveat?: string
}

const badges: Badge[] = [
  {
    name: 'Care Quality Commission',
    acronym: 'CQC',
    logo: '/logos/cqc.png',
    color: '#005EA5',
    region: 'England',
    description: 'The independent regulator of health and adult social care in England. CQC monitors, inspects and regulates services to ensure they meet fundamental standards of quality and safety.',
    whatItDoes: 'CQC inspects care services against five key questions: Safe, Effective, Caring, Responsive, and Well-led. Services are rated as Outstanding, Good, Requires Improvement, or Inadequate.',
    howMeticleHelps: [
      'Real-time inspection readiness dashboard scoring all five CQC domains',
      'Automated evidence packs assembled from daily records, mapped to KLOE frameworks',
      'Training compliance matrix with gap-flagging for mandatory modules',
      'Incident tracking with safeguarding escalation workflows',
      'Satisfaction and engagement surveys feeding the Caring and Well-led domains',
      'Audit trail on every action — medications, care notes, incidents, and more',
    ],
    keyRequirements: [
      'Safe care and treatment',
      'Staffing — sufficient numbers of suitably qualified staff',
      'Fit and proper persons employed',
      'Duty of candour — open and transparent about mistakes',
      'Good governance — effective quality assurance',
    ],
    website: 'https://www.cqc.org.uk',
  },
  {
    name: 'Care Inspectorate Wales',
    acronym: 'CIW',
    logo: '/logos/ciw.png',
    color: '#00855A',
    region: 'Wales',
    description: 'The independent regulator and inspector of care and support services in Wales. CIW registers and inspects services under the Regulation and Inspection of Social Care (Wales) Act 2016.',
    whatItDoes: 'CIW inspects services across six areas: Well-being, Care and support, Environment, Staffing, Management and leadership, and Suitability. Services receive a rating from excellent to bad.',
    howMeticleHelps: [
      'Wales-specific compliance templates aligned to CIW inspection frameworks',
      'Person-centred support plans with outcomes tracking',
      'Daily care records demonstrating consistent, quality support',
      'Staff competency assessments and training records',
      'Incident and complaint management with root-cause analysis',
      'Regular wellbeing assessments with trend analysis',
    ],
    keyRequirements: [
      'Person-centred care plans',
      'Regular risk assessments',
      'Safe staffing levels',
      'Effective complaints procedures',
      'Quality assurance and continuous improvement',
    ],
    website: 'https://www.ciw.wales',
  },
  {
    name: 'Care Inspectorate',
    acronym: 'CI',
    logo: '/logos/cis.png',
    color: '#0065BD',
    region: 'Scotland',
    // Named "Care Inspectorate", not "Care Inspectorate Scotland", and not "CIS".
    // "CIS" was not an acronym this body used anywhere — the API's regulator
    // registry has called it `care-inspectorate` with the display name "Care
    // Inspectorate" all along — and printing an invented acronym on a page
    // about a regulator is the sort of thing that gets noticed by the regulator.
    description: 'The national regulator and inspector of care services in Scotland. The Care Inspectorate regulates care homes, domiciliary care, childminding and more, and is established under the Public Services Reform (Scotland) Act 2010.',
    whatItDoes: 'The Care Inspectorate publishes the quality indicators it inspects against. The themes it reports on are published on careinspectorate.com and are changed from time to time; the list below is not a substitute for the current published set.',
    howMeticleHelps: [
      'Four-nations vetting, so a Scottish worker is measured against PVG rather than a DBS',
      'Care plans and daily records that evidence person-centred practice',
      'Incidents, training and medication records assembled as one evidence trail',
      'Medicines-in-care rules enforced on the statutory footing Scotland uses — covert administration is checked against the Mental Welfare (Scotland) Act 2000, not the Mental Capacity Act',
      'Compliance readiness scored against the framework the provider is actually registered with',
    ],
    keyRequirements: [
      'Registration with the Care Inspectorate',
      'PVG checks for staff in regulated roles — Scotland does not use DBS',
      'Staff registration with the Scottish Social Services Council, where the role requires it (we do not hold or check SSSC numbers — see T2-18)',
      'Notification of significant events and annual returns, per the Care Inspectorate\'s published notifications guidance',
    ],
    website: 'https://www.careinspectorate.com',
  },
  {
    name: 'Regulation and Quality Improvement Authority',
    acronym: 'RQIA',
    logo: '/logos/rqia.png',
    color: '#6D2077',
    region: 'Northern Ireland',
    // An Order, not an Act, and "Care Services" not "Social Services". This
    // page said "Health and Personal Social Services (Quality, Improvement and
    // Regulation) Act (NI) 2003" while the API's regulator registry had the
    // correct title — the same statute, wrong twice, in the document a customer
    // would most likely quote.
    description: 'The independent body responsible for inspecting and regulating health and social care services in Northern Ireland, established under the Health and Personal Care Services (Quality Improvement and Regulation) (Northern Ireland) Order 2003.',
    whatItDoes: 'RQIA inspects against the quality standards it publishes, focused on quality of care, safety, effectiveness and responsiveness. We do not reproduce the standards themselves here; they are on rqia.org.uk and are the ones to work from.',
    howMeticleHelps: [
      'Records organised as an evidence trail a provider can hand over',
      'Safe care and treatment documentation',
      'Staffing and training compliance tracking',
      'Incident and complaint management',
      'Quality improvement evidence and reporting',
      'AccessNI-aware vetting, so a Northern Irish worker is not asked for a DBS',
    ],
    keyRequirements: [
      'RQIA registration',
      'The quality standards RQIA publishes for the service type',
      'Safe staffing',
      'Effective governance',
      'Regular quality assurance',
    ],
    website: 'https://www.rqia.org.uk',
  },
  {
    name: 'NHS Digital / NHS England',
    acronym: 'NHS',
    // No logo. NHS England's brand guidelines do not permit the NHS wordmark or
    // logo to be used by organisations outside the NHS, and using it on a
    // commercial page implies an endorsement or accreditation we do not hold.
    // This is a trademark problem, not a copy problem, so no wording fixes it.
    logo: undefined,
    color: '#005EB8',
    region: 'United Kingdom',
    description: 'The National Health Service sets standards for healthcare in England. It is not the regulator of adult social care — that is CQC, CIW, Care Inspectorate or RQIA, listed above — and we hold no NHS accreditation. We have not submitted the NHS Data Security and Protection Toolkit, and we have no integration with NHS Digital or any NHS system.',
    whatItDoes: 'NHS standards apply to NHS providers. Where a care provider also supports people with NHS-funded care, its own obligations come from the commissioner and the local authority, not from us — and those are matters for the provider, not for software.',
    howMeticleHelps: [
      'An eMAR that enforces the medicines-in-care rules for the provider\'s own nation rather than a generic one',
      'Clinical records structured so a commissioner or inspection can be shown what happened',
      'Fluid, nutrition and health monitoring recorded as part of the care record',
      'No NHS integration, accreditation or DSPT submission — see the note above',
    ],
    keyRequirements: [
      'Whichever data-sharing agreement the commissioner requires — that is between the provider and the commissioner, not something this software supplies',
      'Clinical documentation standards the provider adopts',
      'Patient safety reporting per the provider\'s own arrangements',
    ],
    website: 'https://www.nhs.uk',
  },
  {
    name: 'UK GDPR & Data Protection Act 2018',
    acronym: 'DPA',
    logo: '/logos/ukgdpr.png',
    color: '#1B2430',
    region: 'United Kingdom',
    description: 'The UK General Data Protection Regulation and Data Protection Act 2018 set the rules for how personal data must be handled. The Data Security and Protection Toolkit (DSPT) is the NHS-specific self-assessment.',
    whatItDoes: 'UK GDPR and DPA 2018 require organisations to protect personal data, report breaches, and maintain appropriate security measures. The DSPT is the annual self-assessment for NHS and social care organisations.',
    howMeticleHelps: [
      'Role-based access controls with audit logging',
      'A DSPT self-assessment module, for organisations that are in scope for it',
      'Retention and deletion rules you set, enforced nightly, with a written receipt of every run',
      'Pseudonymisation of personal data in anything sent to an AI provider, and a per-organisation setting for how much clinical free text leaves the system',
      'Account erasure that keeps the care record and removes the person\'s account',
      'Data protection impact assessment templates',
    ],
    keyRequirements: [
      'A lawful basis for processing, chosen and recorded by the provider — not by us',
      'Data security measures appropriate to the data',
      'Breach notification procedures: you hold them, you notify the ICO, and you have 72 hours from becoming aware',
      'Data Protection Officer appointment where required',
      'DSPT annual submission, if you are in scope',
      'Staff data protection training',
    ],
    // Read this before the list above. Two of the things a reader will expect
    // to find here are deliberately not claimed.
    caveat: 'Where an AI provider is used, clinical free text is sent to that provider, which is a transfer outside the UK and is not covered by our data residency. We are pseudonymising, not anonymising, and we have not yet signed an Article 28 agreement with either provider. Both are open items, not features.',
    website: 'https://ico.org.uk',
  },
]

export default function ComplianceBadgesPage() {
  const navigate = useNavigate()

  return (
    <MarketingLayout>
      <PageMeta
        title="Regulatory Compliance & Standards | Meticle Care"
        description="Meticle Care is built for UK care regulators including CQC, CIW, CIS, RQIA, NHS, and UK GDPR. See how we help you stay compliant."
      />

      {/* Hero */}
      <Box sx={{ bgcolor: NAVY, pt: { xs: 12, md: 16 }, pb: { xs: 8, md: 10 } }}>
        <Container maxWidth="md" sx={{ textAlign: 'center' }}>
          <Chip label="Compliance & Standards" sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: 'white', fontWeight: 700, mb: 3 }} />
          <Typography variant="h1" sx={{ fontSize: { xs: '2.2rem', md: '3.2rem' }, fontWeight: 900, color: 'white', lineHeight: 1.1, mb: 3 }}>
            Built for the regulators that matter
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '1.1rem', maxWidth: 600, mx: 'auto', lineHeight: 1.7 }}>
            Meticle Care is designed from the ground up to meet UK care regulations.
            Every record, every audit trail, every report is aligned to the standards
            your inspectors expect.
          </Typography>
        </Container>
      </Box>

      {/* Badge Overview Grid */}
      <Box sx={{ py: { xs: 8, md: 10 }, bgcolor: 'background.paper' }}>
        <Container maxWidth="lg">
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mb: 6, justifyContent: 'center' }}>
            {badges.map((b) => (
              <Chip
                key={b.acronym}
                label={b.name}
                onClick={() => document.getElementById(b.acronym)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                sx={{
                  bgcolor: b.color + '10',
                  color: b.color,
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  px: 1,
                  cursor: 'pointer',
                  border: `1px solid ${b.color}30`,
                  '&:hover': { bgcolor: b.color + '20' },
                }}
              />
            ))}
          </Stack>

          <Grid container spacing={4}>
            {badges.map((badge) => (
              <Grid item xs={12} key={badge.acronym} id={badge.acronym}>
                <Paper
                  elevation={0}
                  sx={{
                    border: `1px solid ${HAIRLINE}`,
                    borderRadius: 3,
                    overflow: 'hidden',
                    transition: 'box-shadow 0.3s ease',
                    '&:hover': { boxShadow: `0 8px 32px -8px ${badge.color}20` },
                  }}
                >
                  {/* Header */}
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={3}
                    alignItems={{ md: 'center' }}
                    sx={{ px: { xs: 3, md: 4 }, py: 3, bgcolor: badge.color + '06', borderBottom: `1px solid ${HAIRLINE}` }}
                  >
                    <Box sx={{ height: 56, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      {badge.logo
                        ? <img src={badge.logo} alt={badge.name} style={{ height: '100%', width: 'auto' }} />
                        : <Box sx={{ height: 56, width: 56, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: badge.color }}>
                            <Typography variant="h5" sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff' }}>{badge.acronym}</Typography>
                          </Box>}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                        <Typography variant="h3" sx={{ fontSize: { xs: '1.3rem', md: '1.5rem' }, fontWeight: 800, color: INK }}>
                          {badge.name}
                        </Typography>
                        <Chip
                          label={badge.region}
                          size="small"
                          sx={{ bgcolor: badge.color + '15', color: badge.color, fontWeight: 600, height: 22 }}
                        />
                      </Stack>
                      <Typography variant="body2" color={MIST} sx={{ lineHeight: 1.6 }}>
                        {badge.description}
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      size="small"
                      endIcon={<ArrowIcon />}
                      onClick={() => window.open(badge.website, '_blank')}
                      sx={{
                        borderColor: badge.color + '40',
                        color: badge.color,
                        textTransform: 'none',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        '&:hover': { borderColor: badge.color, bgcolor: badge.color + '08' },
                      }}
                    >
                      Website
                    </Button>
                  </Stack>

                  {/* Body */}
                  <Grid container>
                    {/* What it does */}
                    <Grid item xs={12} md={4} sx={{ px: { xs: 3, md: 4 }, py: 3, borderRight: { md: `1px solid ${HAIRLINE}` }, borderBottom: { xs: `1px solid ${HAIRLINE}`, md: 'none' } }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: badge.color, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.7rem', mb: 1.5 }}>
                        What it does
                      </Typography>
                      <Typography variant="body2" color={MIST} sx={{ lineHeight: 1.7, fontSize: '0.85rem' }}>
                        {badge.whatItDoes}
                      </Typography>
                    </Grid>

                    {/* How Meticle Care helps */}
                    <Grid item xs={12} md={4} sx={{ px: { xs: 3, md: 4 }, py: 3, borderRight: { md: `1px solid ${HAIRLINE}` }, borderBottom: { xs: `1px solid ${HAIRLINE}`, md: 'none' } }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: badge.color, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.7rem', mb: 1.5 }}>
                        How Meticle Care helps
                      </Typography>
                      <Stack spacing={0.75}>
                        {badge.howMeticleHelps.map((item, i) => (
                          <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                            <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: EMERALD, mt: '6px', flexShrink: 0 }} />
                            <Typography variant="body2" sx={{ fontSize: '0.82rem', color: 'text.primary', lineHeight: 1.5 }}>
                              {item}
                            </Typography>
                          </Stack>
                        ))}
                        {badge.caveat && (
                          <Box sx={{ mt: 1.5, p: 1.5, borderLeft: `3px solid ${badge.color}`, bgcolor: badge.color + '08' }}>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: badge.color, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.62rem', display: 'block', mb: 0.5 }}>
                              What we do not claim
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.primary', lineHeight: 1.55 }}>
                              {badge.caveat}
                            </Typography>
                          </Box>
                        )}
                      </Stack>
                    </Grid>

                    {/* Key Requirements */}
                    <Grid item xs={12} md={4} sx={{ px: { xs: 3, md: 4 }, py: 3 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: badge.color, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.7rem', mb: 1.5 }}>
                        Key requirements
                      </Typography>
                      <Stack spacing={0.75}>
                        {badge.keyRequirements.map((req, i) => (
                          <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                            <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: badge.color, mt: '6px', flexShrink: 0 }} />
                            <Typography variant="body2" sx={{ fontSize: '0.82rem', color: 'text.primary', lineHeight: 1.5 }}>
                              {req}
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* CTA */}
      <Box sx={{ py: { xs: 8, md: 10 }, bgcolor: 'notice.subtle.bg' }}>
        <Container maxWidth="sm" sx={{ textAlign: 'center' }}>
          <Typography variant="h2" sx={{ fontSize: { xs: '1.8rem', md: '2.4rem' }, fontWeight: 800, color: INK, mb: 2 }}>
            Ready to simplify compliance?
          </Typography>
          <Typography color={MIST} sx={{ mb: 4, lineHeight: 1.7 }}>
            Book a walkthrough to see how MeticleCare helps organise evidence for your regulatory and governance workflows.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button
              variant="contained"
              size="large"
              sx={{ bgcolor: NAVY, '&:hover': { bgcolor: '#0A3A63' }, fontWeight: 700, px: 5, borderRadius: 2 }}
              onClick={() => navigate('/contact')}
            >
              Book a demo
            </Button>
            <Button
              variant="outlined"
              size="large"
              sx={{ borderColor: NAVY, color: NAVY, fontWeight: 700, px: 5, borderRadius: 2 }}
              onClick={() => navigate('/features')}
            >
              Explore features
            </Button>
          </Stack>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
