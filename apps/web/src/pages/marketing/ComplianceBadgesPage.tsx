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
  logo: string
  color: string
  region: string
  description: string
  whatItDoes: string
  howMeticleHelps: string[]
  keyRequirements: string[]
  website: string
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
    description: 'The independent regulator and inspector of care and support services in Wales. CIW inspects against the Care and Social Services Inspectorate (Wales) Act 2001.',
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
    name: 'Care Inspectorate Scotland',
    acronym: 'CIS',
    logo: '/logos/cis.png',
    color: '#0065BD',
    region: 'Scotland',
    description: 'The national regulator and inspector of care services in Scotland. CIS regulates care homes, domiciliary care, childminding and more under the Public Services Reform (Scotland) Act 2010.',
    whatItDoes: 'CIS inspects against the National Care Standards, focusing on six quality themes: Care and support, Environment, Staffing, Management and leadership, Quality assurance, and Atmosphere.',
    howMeticleHelps: [
      'Scotland-specific compliance tracking aligned to National Care Standards',
      'Care plans built around the Scottish outcome-based framework',
      'Daily records demonstrating person-centred approach',
      'Staffing records including PVG checks and SSSC registration',
      'Incident reporting meeting Scottish regulatory requirements',
      'Quality improvement plans with measurable outcomes',
    ],
    keyRequirements: [
      'National Care Standards compliance',
      'Care Inspectorate registration',
      'PVG scheme membership for staff',
      'SSSC registration requirements',
      'Annual returns and notifications',
    ],
    website: 'https://www.careinspectorate.com',
  },
  {
    name: 'Regulation and Quality Improvement Authority',
    acronym: 'RQIA',
    logo: '/logos/rqia.png',
    color: '#6D2077',
    region: 'Northern Ireland',
    description: 'The independent body responsible for inspecting and regulating health and social care services in Northern Ireland under the Health and Personal Social Services (Quality, Improvement and Regulation) Act (NI) 2003.',
    whatItDoes: 'RQIA inspects against the quality standards defined in the Health and Personal Social Services regulations, focusing on quality of care, safety, and effectiveness of services.',
    howMeticleHelps: [
      'Northern Ireland-specific compliance templates',
      'Records meeting RQIA registration requirements',
      'Safe care and treatment documentation',
      'Staffing and training compliance tracking',
      'Incident and complaint management',
      'Quality improvement evidence and reporting',
    ],
    keyRequirements: [
      'RQIA registration requirements',
      'Quality standards compliance',
      'Safe staffing levels',
      'Effective governance structures',
      'Regular quality audits',
    ],
    website: 'https://www.rqia.org.uk',
  },
  {
    name: 'NHS Digital / NHS England',
    acronym: 'NHS',
    logo: '/logos/nhs.svg',
    color: '#005EB8',
    region: 'United Kingdom',
    description: 'The National Health Service provides the framework for healthcare standards across the UK. MeticleCare integrates with NHS workflows and supports NHS-aligned care delivery.',
    whatItDoes: 'NHS standards ensure care is delivered safely, effectively, and equitably. MeticleCare supports NHS-aligned medication management, health records, and clinical documentation.',
    howMeticleHelps: [
      'eMAR system aligned with NHS medication administration standards',
      'Clinical records following NHS documentation guidelines',
      'Health monitoring aligned with NHS health check frameworks',
      'Integration-ready for NHS Digital APIs and interoperability standards',
      'Support for NHS Continuing Healthcare assessments',
      'Fluid and nutrition monitoring meeting NHS best practice',
    ],
    keyRequirements: [
      'Medication safety standards',
      'Clinical documentation standards',
      'Data sharing agreements',
      'Interoperability requirements',
      'Patient safety reporting',
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
      'Built-in data encryption at rest and in transit',
      'Role-based access controls with audit logging',
      'DSPT self-assessment completion and tracking',
      'Automated data retention and deletion policies',
      'Breach notification workflow with 72-hour reporting',
      'Data protection impact assessment templates',
      'Right to access, rectification, and erasure workflows',
    ],
    keyRequirements: [
      'Lawful basis for processing personal data',
      'Data security measures',
      'Breach notification procedures',
      'Data Protection Officer appointment',
      'DSPT annual submission',
      'Staff data protection training',
    ],
    website: 'https://ico.org.uk',
  },
]

export default function ComplianceBadgesPage() {
  const navigate = useNavigate()

  return (
    <MarketingLayout>
      <PageMeta
        title="Regulatory Compliance & Standards | MeticleCare"
        description="MeticleCare is built for UK care regulators including CQC, CIW, CIS, RQIA, NHS, and UK GDPR. See how we help you stay compliant."
      />

      {/* Hero */}
      <Box sx={{ bgcolor: NAVY, pt: { xs: 12, md: 16 }, pb: { xs: 8, md: 10 } }}>
        <Container maxWidth="md" sx={{ textAlign: 'center' }}>
          <Chip label="Compliance & Standards" sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: 'white', fontWeight: 700, mb: 3 }} />
          <Typography variant="h1" sx={{ fontSize: { xs: '2.2rem', md: '3.2rem' }, fontWeight: 900, color: 'white', lineHeight: 1.1, mb: 3 }}>
            Built for the regulators that matter
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '1.1rem', maxWidth: 600, mx: 'auto', lineHeight: 1.7 }}>
            MeticleCare is designed from the ground up to meet UK care regulations.
            Every record, every audit trail, every report is aligned to the standards
            your inspectors expect.
          </Typography>
        </Container>
      </Box>

      {/* Badge Overview Grid */}
      <Box sx={{ py: { xs: 8, md: 10 }, bgcolor: '#FFFFFF' }}>
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
                      <img src={badge.logo} alt={badge.name} style={{ height: '100%', width: 'auto' }} />
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

                    {/* How MeticleCare helps */}
                    <Grid item xs={12} md={4} sx={{ px: { xs: 3, md: 4 }, py: 3, borderRight: { md: `1px solid ${HAIRLINE}` }, borderBottom: { xs: `1px solid ${HAIRLINE}`, md: 'none' } }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: badge.color, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.7rem', mb: 1.5 }}>
                        How MeticleCare helps
                      </Typography>
                      <Stack spacing={0.75}>
                        {badge.howMeticleHelps.map((item, i) => (
                          <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                            <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: EMERALD, mt: '6px', flexShrink: 0 }} />
                            <Typography variant="body2" sx={{ fontSize: '0.82rem', color: '#374151', lineHeight: 1.5 }}>
                              {item}
                            </Typography>
                          </Stack>
                        ))}
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
                            <Typography variant="body2" sx={{ fontSize: '0.82rem', color: '#374151', lineHeight: 1.5 }}>
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
      <Box sx={{ py: { xs: 8, md: 10 }, bgcolor: '#F7F4EE' }}>
        <Container maxWidth="sm" sx={{ textAlign: 'center' }}>
          <Typography variant="h2" sx={{ fontSize: { xs: '1.8rem', md: '2.4rem' }, fontWeight: 800, color: INK, mb: 2 }}>
            Ready to simplify compliance?
          </Typography>
          <Typography color={MIST} sx={{ mb: 4, lineHeight: 1.7 }}>
            Start a free 14-day trial and see how MeticleCare keeps your records inspection-ready across every regulatory framework.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button
              variant="contained"
              size="large"
              sx={{ bgcolor: NAVY, '&:hover': { bgcolor: '#0A3A63' }, fontWeight: 700, px: 5, borderRadius: 2 }}
              onClick={() => navigate('/register')}
            >
              Start free trial
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
