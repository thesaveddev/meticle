import { Container, Typography, Grid, Box, Stack, Paper, Button, Divider } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import {
  Business as SetupMuiIcon,
  People as TeamMuiIcon,
  VerifiedUser as CareMuiIcon,
  CheckCircle as CheckIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'
import {
  ShieldIcon, ManagerIcon, CareWorkerIcon,
} from '../../components/marketing/icons'

// Brand tokens — shared with LandingPage / PricingPage / FeaturesPage / About.
const INK = '#1B2430'
const INK_DARK = '#141C24'
const NAVY = '#0F4C81'
const EMERALD = '#10B981'
const EMERALD_DEEP = '#047857'
const BONE = '#F7F4EE'
const MIST = '#5B6672'
const HAIRLINE = '#E7E1D6'

type StepPanel = { label: string; val: string }

interface Step {
  number: string
  title: string
  icon: React.ReactElement
  description: string
  details: string[]
  panelTitle: string
  panelItems: StepPanel[]
  timeEstimate: string
}

const STEPS: Step[] = [
  {
    number: '1',
    title: 'Set up your service',
    icon: <SetupMuiIcon sx={{ fontSize: 36 }} />,
    timeEstimate: 'About 10 minutes',
    description:
      'Add your organisation details and select your regulator. MeticleCare activates framework-aware scoring and the right KLOE evidence template automatically — no integrator, no manual mapping.',
    details: [
      'Create organisation and pick the regulator you report to',
      'Framework-aware compliance scoring switches on immediately',
      'Configure locations, departments, teams and shifts',
      'Set compliance threshold and escalation rules',
      'Optional: upload your logo and brand colours for branded evidence packs',
    ],
    panelTitle: 'What you configure in Step 1',
    panelItems: [
      { label: 'Regulator', val: 'CQC · CIW · CIS · RQIA' },
      { label: 'Compliance threshold', val: 'Configurable % (default 80%)' },
      { label: 'Locations', val: '1 (Essential) · N (Multi-Site)' },
      { label: 'Staff roles', val: 'ORG_ADMIN · MANAGER · CARE_WORKER' },
      { label: 'Evidence format', val: 'KLOE-organised PDF packs' },
      { label: 'Scoring source', val: 'Live data — not estimates' },
    ],
  },
  {
    number: '2',
    title: 'Invite your team',
    icon: <TeamMuiIcon sx={{ fontSize: 36 }} />,
    timeEstimate: 'Same session',
    description:
      'Add staff by email and assign roles. Compliance profiles auto-attach to roles, so when a new starter gets the MANAGER role they immediately see what CQC requires them to evidence.',
    details: [
      'Invite by email — staff receive a one-tap activation link',
      'Compliance profile auto-assigns based on role',
      'Role-based permissions gate every module and record',
      'Staff see their own compliance status on their dashboard',
      'Managers and ORG_ADMINs get full organisational oversight',
    ],
    panelTitle: 'What your team sees',
    panelItems: [
      { label: 'Care worker', val: 'Shift, eMAR, daily notes' },
      { label: 'Senior carer', val: '+ Observations, body map' },
      { label: 'Manager', val: '+ Rota, incidents, compliance' },
      { label: 'ORG_ADMIN', val: '+ Multi-site roll-up, billing' },
      { label: 'Family (read-only)', val: 'Care notes + photos' },
      { label: 'Auditor (scoped)', val: 'Evidence packs you grant' },
    ],
  },
  {
    number: '3',
    title: 'Record care. Score itself.',
    icon: <CareMuiIcon sx={{ fontSize: 36 }} />,
    timeEstimate: 'From day one',
    description:
      'Daily operations feed your compliance scoring automatically. Training, competency, surveys, incidents — every action produces evidence that keeps you inspection-ready without a separate paper exercise.',
    details: [
      'Training completion scores feed the Effective domain',
      'Competency assessments (CQC statement mapping) feed Safe',
      'Satisfaction surveys (email-invited) feed Caring',
      'Staff engagement surveys feed Well-led',
      'Incident severity + escalation timing feed Responsive',
    ],
    panelTitle: 'Live compliance scoring',
    panelItems: [
      { label: 'Safe', val: 'Incidents · risk · competency' },
      { label: 'Effective', val: 'Training · outcomes · reviews' },
      { label: 'Caring', val: 'Surveys · daily notes · goals' },
      { label: 'Responsive', val: 'Incidents · complaints · cases' },
      { label: 'Well-led', val: 'Engagement · audit · governance' },
      { label: 'Refreshed', val: 'Real time on every record change' },
    ],
  },
]

const TIMELINE_IMAGE = '/illustrations/timeline-card.svg'

const WHY = [
  { icon: <ShieldIcon size={28} />, title: 'All four regulators', desc: 'CQC, CIW, Care Inspectorate Scotland and RQIA are natively supported — your evidence packs adjust automatically.' },
  { icon: <ManagerIcon size={28} />, title: '5-minute setup', desc: 'No lengthy onboarding. Configure your service, invite your team, and start recording care within the hour.' },
  { icon: <CareWorkerIcon size={28} />, title: 'UK data sovereignty', desc: 'All data hosted in UK-locked ISO 27001-certified data centres. AES-256 encryption at rest, TLS 1.3 in transit.' },
  { icon: <CheckIcon sx={{ fontSize: 26, color: '#86EFAC' }} />, title: 'No long contracts', desc: 'Month-to-month pricing with no lock-in. Cancel anytime. Your data is yours to export — including read access after cancellation.' },
]

export default function HowItWorksPage() {
  const navigate = useNavigate()

  return (
    <MarketingLayout>
      <PageMeta
        title="How MeticleCare Works | MeticleCare"
        description="See how MeticleCare connects care planning, staff rotas, medication records and compliance into one platform for UK care providers."
        canonicalPath="/how-it-works"
      />

      {/* HEADER */}
      <Box component="section" sx={{ pt: { xs: 8, md: 11 }, pb: { xs: 8, md: 10 }, bgcolor: BONE, borderBottom: `1px solid ${HAIRLINE}` }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', maxWidth: 760, mx: 'auto' }}>
            <Box
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 1.25,
                bgcolor: '#FFFFFF', border: `1px solid ${HAIRLINE}`, borderRadius: 999,
                px: 2, py: 0.75, mb: 3,
              }}
            >
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: EMERALD }} />
              <Typography sx={{ fontWeight: 800, color: NAVY, fontSize: '0.75rem', letterSpacing: '0.1em' }}>
                GET STARTED IN MINUTES
              </Typography>
            </Box>
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: '2.4rem', md: '3.2rem' },
                fontWeight: 900, lineHeight: 1.06, letterSpacing: '-0.03em', color: INK, mb: 3,
              }}
            >
              Three steps. Then the platform runs itself.
            </Typography>
            <Typography sx={{ color: MIST, fontSize: { xs: '1rem', md: '1.12rem' }, lineHeight: 1.7 }}>
              No long contracts. No complex onboarding. No integrator. Pick a regulator, invite your team, start recording care. Compliance scoring runs from day one.
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* STEPS */}          {STEPS.map((step, idx) => {
        const reverse = idx % 2 === 1
        return (
          <Box
            key={step.number}
            component="section"
            sx={{
              py: { xs: 8, md: 11 },
              bgcolor: idx % 2 === 0 ? '#FFFFFF' : BONE,
              borderBottom: `1px solid ${HAIRLINE}`,
            }}
          >
            <Container maxWidth="lg">
              <Grid container spacing={{ xs: 4, md: 7 }} alignItems="center" direction={reverse ? 'row-reverse' : 'row'}>
                <Grid item xs={12} md={5}>
                  <Stack spacing={2.5}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box
                        sx={{
                          width: 56, height: 56, borderRadius: '50%', bgcolor: NAVY,
                          color: '#FFFFFF', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: '1.6rem', fontWeight: 900,
                          flexShrink: 0,
                        }}
                      >
                        {step.number}
                      </Box>
                      <Box>
                        <Typography sx={{ fontWeight: 800, color: MIST, fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                          STEP {step.number}
                        </Typography>
                        <Typography sx={{ fontWeight: 800, color: NAVY, fontSize: '0.78rem' }}>
                          {step.timeEstimate}
                        </Typography>
                      </Box>
                    </Stack>

                    <Box sx={{ color: NAVY, display: 'flex', alignItems: 'center' }}>
                      {step.icon}
                    </Box>

                    <Typography variant="h3" sx={{ fontWeight: 900, color: INK, fontSize: { xs: '1.6rem', md: '1.9rem' }, lineHeight: 1.15, letterSpacing: '-0.02em' }}>
                      {step.title}
                    </Typography>

                    <Typography sx={{ color: MIST, fontSize: '1rem', lineHeight: 1.7 }}>
                      {step.description}
                    </Typography>

                    <Stack spacing={1.25}>
                      {step.details.map((d, i) => (
                        <Stack key={i} direction="row" spacing={1.5} alignItems="flex-start">
                          <CheckIcon sx={{ fontSize: 18, color: EMERALD, mt: 0.3, flexShrink: 0 }} />
                          <Typography sx={{ color: INK, fontSize: '0.92rem', fontWeight: 500, lineHeight: 1.55 }}>
                            {d}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Stack>
                </Grid>
                <Grid item xs={12} md={7}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: { xs: 3.5, md: 5 },
                      border: `1px solid ${HAIRLINE}`,
                      borderRadius: 3,
                      bgcolor: '#FFFFFF',
                      boxShadow: '0 24px 60px -32px rgba(20,32,45,0.18)',
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2.5 }}>
                      <Typography sx={{ fontWeight: 900, color: NAVY, fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                        {step.panelTitle}
                      </Typography>
                    </Stack>
                    <Divider sx={{ borderColor: HAIRLINE, mb: 2.5 }} />
                    <Grid container spacing={2}>
                      {step.panelItems.map((item) => (
                        <Grid item xs={12} sm={6} key={item.label}>
                          <Box
                            sx={{
                              p: { xs: 1.75, md: 2.25 },
                              bgcolor: BONE, borderRadius: 2,
                              border: `1px solid ${HAIRLINE}`,
                              height: '100%',
                            }}
                          >
                            <Typography sx={{ color: MIST, fontWeight: 800, fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                              {item.label}
                            </Typography>
                            <Typography sx={{ fontWeight: 800, color: INK, fontSize: '0.95rem', mt: 0.5 }}>
                              {item.val}
                            </Typography>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </Paper>
                </Grid>
              </Grid>
            </Container>
          </Box>
        )
      })}

      {/* ILLUSTRATED WHAT-HAPPENS-NEXT — the timeline-card.svg with our caption */}
      <Box component="section" sx={{ py: { xs: 9, md: 12 }, bgcolor: '#FFFFFF', borderBottom: `1px solid ${HAIRLINE}` }}>
        <Container maxWidth="lg">
          <Stack spacing={2} sx={{ maxWidth: 760, mb: { xs: 5, md: 7 } }}>
            <Typography
              variant="h2"
              sx={{ fontSize: { xs: '2rem', md: '2.4rem' }, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.02em', color: INK }}
            >
              From one action to a complete record.
            </Typography>
            <Typography sx={{ color: MIST, fontSize: '1.05rem', lineHeight: 1.7 }}>
              Once care starts being recorded, the platform runs. A single visit to administer medication touches the MAR, the daily record, the family portal, and the compliance score — automatically.
            </Typography>
          </Stack>
          <Box
            sx={{
              borderRadius: 3, overflow: 'hidden',
              border: `1px solid ${HAIRLINE}`,
              boxShadow: '0 24px 60px -32px rgba(20,32,45,0.2)',
            }}
          >
            <img
              src={TIMELINE_IMAGE}
              alt="A five-step flow showing how one care action travels through MeticleCare: care given, MAR updated, note recorded, family informed, compliance scored"
              width="1280"
              height="360"
              loading="lazy"
              style={{ display: 'block', width: '100%', height: 'auto' }}
            />
          </Box>
        </Container>
      </Box>

      {/* WHY METICLE — band of four cards */}
      <Box component="section" sx={{ py: { xs: 9, md: 12 }, bgcolor: BONE }}>
        <Container maxWidth="lg">
          <Stack spacing={2} sx={{ maxWidth: 720, mb: { xs: 5, md: 7 } }}>
            <Typography
              variant="h2"
              sx={{ fontSize: { xs: '2rem', md: '2.4rem' }, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.02em', color: INK }}
            >
              Why care providers pick us.
            </Typography>
          </Stack>
          <Grid container spacing={{ xs: 3, md: 3 }}>
            {WHY.map((item) => (
              <Grid item xs={12} sm={6} md={3} key={item.title}>
                <Box
                  sx={{
                    height: '100%',
                    bgcolor: '#FFFFFF',
                    border: `1px solid ${HAIRLINE}`,
                    borderRadius: 3,
                    p: { xs: 3, md: 4 },
                    transition: 'border-color 0.15s ease, transform 0.15s ease',
                    '&:hover': { borderColor: EMERALD, transform: 'translateY(-2px)' },
                  }}
                >
                  <Box
                    sx={{
                      width: 52, height: 52, borderRadius: 1.5,
                      bgcolor: 'rgba(15,76,129,0.08)', color: NAVY,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      mb: 2.5,
                    }}
                  >
                    {item.icon}
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: INK, fontSize: '1.1rem', mb: 1.25, lineHeight: 1.3 }}>
                    {item.title}
                  </Typography>
                  <Typography sx={{ color: MIST, fontSize: '0.9rem', lineHeight: 1.6 }}>
                    {item.desc}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* FINAL CTA — matches landing / pricing / about */}
      <Box component="section" sx={{ py: { xs: 11, md: 15 }, bgcolor: INK_DARK, color: '#FFFFFF', textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography
            variant="h2"
            sx={{ fontSize: { xs: '2.1rem', md: '3rem' }, fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.03em', mb: 3, color: '#FFFFFF' }}
          >
            Ready to set up in minutes?
          </Typography>
          <Typography sx={{ opacity: 0.92, fontSize: '1.12rem', lineHeight: 1.7, mb: 5, maxWidth: 560, mx: 'auto' }}>
            Try the full Care Service tier free for 14 days. Or chat with us on a 30-minute call — we'll walk through anything specific to your service before you commit.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowForwardIcon />}
              onClick={() => navigate('/register')}
              sx={{
                bgcolor: EMERALD_DEEP, '&:hover': { bgcolor: '#065F46' },
                fontWeight: 800, px: { xs: 5, sm: 7 }, py: 1.9, fontSize: '1.05rem',
              }}
            >
              Start your free trial
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/contact')}
              sx={{
                borderColor: 'rgba(255,255,255,0.4)', color: '#FFFFFF',
                '&:hover': { borderColor: '#FFFFFF', bgcolor: 'rgba(255,255,255,0.06)' },
                fontWeight: 700, px: { xs: 5, sm: 6 }, py: 1.9, fontSize: '1.05rem',
              }}
            >
              Talk to our team
            </Button>
          </Stack>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
