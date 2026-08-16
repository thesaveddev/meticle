import { Container, Typography, Grid, Box, Stack, Button, Divider } from '@mui/material'
import {
  Group as TeamIcon,
  TrendingDown as SavingsIcon,
  Lightbulb as InnovationIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'
import { ShieldIcon } from '../../components/marketing/icons'

// Brand tokens — shared with LandingPage / PricingPage / FeaturesPage.
const INK = '#1B2430'
const INK_DARK = '#141C24'
const NAVY = '#0F4C81'
const NAVY_DEEP = '#0A3A63'
const EMERALD = '#10B981'
const EMERALD_DEEP = '#047857'
const BONE = '#F7F4EE'
const MIST = '#5B6672'
const HAIRLINE = '#E7E1D6'

const VALUES = [
  {
    icon: <ShieldIcon size={28} />,
    title: 'Trust & Compliance',
    text: 'Every feature is built with regulatory compliance at its core. We help care providers stay inspection-ready across all four UK frameworks — CQC, CIW, Care Inspectorate Scotland and RQIA.',
  },
  {
    icon: <TeamIcon sx={{ fontSize: 28 }} />,
    title: 'People First',
    text: 'Better technology creates better care — but only if it gets out of the way of the people doing the care. Our platform is shaped around how a working shift actually runs.',
  },
  {
    icon: <SavingsIcon sx={{ fontSize: 28 }} />,
    title: 'Value Driven',
    text: 'We measure our success by agency-spend reduction, inspection outcomes, and the time your team gets back — not by feature count or platform size.',
  },
  {
    icon: <InnovationIcon sx={{ fontSize: 28 }} />,
    title: 'Continuous Improvement',
    text: 'The care sector evolves rapidly. We ship every week, push updates at the weekend so Monday is quieter than last Monday, and ship features the sector tells us it needs.',
  },
]

export default function AboutPage() {
  const navigate = useNavigate()

  return (
    <MarketingLayout>
      <PageMeta
        title="About MeticleCare | MeticleCare"
        description="MeticleCare was built for UK care providers — supported living, domiciliary care and care homes. Our team combines care-sector experience with technology to simplify care operations."
        canonicalPath="/about"
      />

      {/* HERO */}
      <Box component="section" sx={{ pt: { xs: 8, md: 11 }, pb: { xs: 8, md: 10 }, bgcolor: BONE, borderBottom: `1px solid ${HAIRLINE}` }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 5, md: 7 }} alignItems="center">
            <Grid item xs={12} md={7}>
              <Box
                sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 1.25,
                  bgcolor: '#FFFFFF', border: `1px solid ${HAIRLINE}`, borderRadius: 999,
                  px: 2, py: 0.75, mb: 3,
                }}
              >
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: EMERALD }} />
                <Typography sx={{ fontWeight: 800, color: NAVY, fontSize: '0.75rem', letterSpacing: '0.1em' }}>
                  OUR STORY
                </Typography>
              </Box>
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: '2.4rem', md: '3.2rem' },
                  fontWeight: 900, lineHeight: 1.06, letterSpacing: '-0.03em', color: INK, mb: 3,
                  maxWidth: 620,
                }}
              >
                Built by care operators, for care operators.
              </Typography>
              <Stack spacing={2.5} sx={{ color: MIST, fontSize: '1.05rem', lineHeight: 1.75 }}>
                <Typography>
                  MeticleCare was founded by a team of care operators and software engineers who saw first-hand how fragmented tools
                  were hurting care quality. Spreadsheets for rotas. WhatsApp for communication. Paper for compliance.
                  A unified platform built specifically for supported living and domiciliary care was overdue.
                </Typography>
                <Typography>
                  Today we serve providers across England, Wales, Scotland and Northern Ireland — helping them reduce agency
                  spend, stay inspection-ready, and give their staff digital tools that don't fight the way they actually
                  work on shift.
                </Typography>
              </Stack>
            </Grid>

            <Grid item xs={12} md={5}>
              <Box
                sx={{
                  p: { xs: 4, md: 5 },
                  bgcolor: '#FFFFFF',
                  border: `1px solid ${HAIRLINE}`,
                  borderRadius: 3,
                  boxShadow: '0 24px 60px -32px rgba(20,32,45,0.2)',
                }}
              >
                <Stack spacing={3}>
                  <Box>
                    <Typography sx={{ fontWeight: 800, color: NAVY, fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', mb: 0.75 }}>
                      Where we work from
                    </Typography>
                    <Typography sx={{ fontWeight: 900, color: INK, fontSize: '2.05rem', letterSpacing: '-0.025em', lineHeight: 1.05 }}>
                      UK-based,
                    </Typography>
                    <Typography sx={{ fontWeight: 900, color: INK, fontSize: '2.05rem', letterSpacing: '-0.025em', lineHeight: 1.05 }}>
                      care-operated.
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: HAIRLINE }} />
                  <Stack spacing={2}>
                    {[
                      { label: 'Founded', value: '2023 · Manchester' },
                      { label: 'Hosted', value: 'UK-locked, ISO 27001' },
                      { label: 'Regulators', value: 'CQC · CIW · CIS · RQIA' },
                      { label: 'Team', value: 'Care operators + engineers' },
                    ].map((row) => (
                      <Stack key={row.label} direction="row" justifyContent="space-between" alignItems="baseline" sx={{ borderBottom: `1px solid ${HAIRLINE}`, pb: 1.25 }}>
                        <Typography sx={{ fontWeight: 700, color: MIST, fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                          {row.label}
                        </Typography>
                        <Typography sx={{ fontWeight: 700, color: INK, fontSize: '0.92rem' }}>
                          {row.value}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* TRUST STRIP */}
      <Box component="section" aria-label="Standards MeticleCare is built for" sx={{ bgcolor: '#FFFFFF', borderBottom: `1px solid ${HAIRLINE}`, py: { xs: 5, md: 6 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 3, md: 4 }} alignItems="center">
            <Grid item xs={12} md={3}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: NAVY, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                Trusted by every UK regulator
              </Typography>
            </Grid>
            <Grid item xs={12} md={9}>
              <Grid container spacing={{ xs: 2, md: 2.5 }}>
                {[
                  { mark: 'CQC', label: 'Care Quality Commission', detail: 'England · 5 KLOEs' },
                  { mark: 'CIW', label: 'Care Inspectorate Wales', detail: 'CIW framework' },
                  { mark: 'CIS', label: 'Care Inspectorate Scotland', detail: 'Health & social care' },
                  { mark: 'RQIA', label: 'NI Quality & Improvement', detail: 'Northern Ireland' },
                  { mark: 'GDPR', label: 'UK GDPR · DPA 2018', detail: 'DSPT self-assessment' },
                ].map((t) => (
                  <Grid item xs={6} sm={4} md key={t.mark}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Box
                        sx={{
                          width: 36, height: 36, borderRadius: 1.5,
                          bgcolor: t.mark === 'CIW' || t.mark === 'GDPR' ? EMERALD : NAVY,
                          color: '#FFFFFF', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontWeight: 900, fontSize: '0.7rem',
                          flexShrink: 0,
                        }}
                      >
                        {t.mark}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 800, color: INK, fontSize: '0.82rem', lineHeight: 1.25 }} noWrap>{t.label}</Typography>
                        <Typography sx={{ color: MIST, fontSize: '0.74rem', lineHeight: 1.3 }} noWrap>{t.detail}</Typography>
                      </Box>
                    </Stack>
                  </Grid>
                ))}
              </Grid>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* VALUES */}
      <Box component="section" sx={{ py: { xs: 9, md: 12 }, bgcolor: '#FFFFFF' }}>
        <Container maxWidth="lg">
          <Stack spacing={ 1.5 } sx={{ maxWidth: 720, mb: { xs: 5, md: 7 } }}>
            <Typography
              variant="h2"
              sx={{ fontSize: { xs: '2rem', md: '2.4rem' }, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.02em', color: INK }}
            >
              What we believe.
            </Typography>
            <Typography sx={{ color: MIST, fontSize: '1.05rem', lineHeight: 1.7 }}>
              Four principles guide every release, sales call and support ticket. They're not on a poster — they're in the build-vs-buy meetings every Monday.
            </Typography>
          </Stack>
          <Grid container spacing={{ xs: 3, md: 4 }}>
            {VALUES.map((v) => (
              <Grid item xs={12} sm={6} key={v.title}>
                <Box
                  sx={{
                    height: '100%',
                    p: { xs: 3, md: 4 },
                    bgcolor: BONE,
                    border: `1px solid ${HAIRLINE}`,
                    borderRadius: 3,
                    transition: 'border-color 0.15s ease, transform 0.15s ease',
                    '&:hover': { borderColor: EMERALD, transform: 'translateY(-2px)' },
                  }}
                >
                  <Box
                    sx={{
                      width: 52, height: 52, borderRadius: 1.5,
                      bgcolor: '#FFFFFF', color: NAVY,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      mb: 2.5, border: `1px solid ${HAIRLINE}`,
                    }}
                  >
                    {v.icon}
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: INK, fontSize: '1.15rem', mb: 1.25, lineHeight: 1.3 }}>
                    {v.title}
                  </Typography>
                  <Typography sx={{ color: MIST, fontSize: '0.92rem', lineHeight: 1.65 }}>
                    {v.text}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* HOW WE WORK */}
      <Box component="section" sx={{ py: { xs: 9, md: 12 }, bgcolor: BONE, borderTop: `1px solid ${HAIRLINE}` }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 4, md: 7 }} alignItems="flex-start">
            <Grid item xs={12} md={5}>
              <Typography
                variant="h2"
                sx={{ fontSize: { xs: '2rem', md: '2.4rem' }, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.02em', color: INK, mb: 3 }}
              >
                How we work with care providers.
              </Typography>
              <Typography sx={{ color: MIST, fontSize: '1.02rem', lineHeight: 1.75, mb: 3 }}>
                We sell to the operations manager and the registered manager — never hard-sell cold. Our CSM team runs a 30-minute scoping call so the trial fits your service, not a generic demo dataset.
              </Typography>
              <Typography sx={{ color: MIST, fontSize: '1.02rem', lineHeight: 1.75, mb: 4 }}>
                After onboarding, every account gets a named point of contact. We don't hide behind support tiers — you talk to the person who knows your service.
              </Typography>
              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  endIcon={<ArrowForwardIcon />}
                  onClick={() => navigate('/contact')}
                  sx={{ bgcolor: NAVY, '&:hover': { bgcolor: NAVY_DEEP }, fontWeight: 800, px: 4, py: 1.5 }}
                >
                  Talk to the team
                </Button>
              </Stack>
            </Grid>
            <Grid item xs={12} md={7}>
              <Grid container spacing={2}>
                {[
                  { stat: '14 days', label: 'Free trial of the full Care Service tier' },
                  { stat: '90 days', label: 'Read-only access after cancellation with full data export' },
                  { stat: 'UK-only', label: 'Hosting in London and Manchester, ISO 27001 + DSPT' },
                  { stat: '1 hour', label: 'First-response SLA on Multi-Site, named CSM' },
                ].map((row) => (
                  <Grid item xs={12} sm={6} key={row.label}>
                    <Box
                      sx={{
                        bgcolor: '#FFFFFF',
                        border: `1px solid ${HAIRLINE}`,
                        borderLeft: `3px solid ${EMERALD}`,
                        borderRadius: 2.5,
                        p: { xs: 2.5, md: 3 },
                        height: '100%',
                      }}
                    >
                      <Typography sx={{ fontWeight: 900, color: INK, fontSize: '1.6rem', lineHeight: 1, letterSpacing: '-0.02em', mb: 0.75 }}>
                        {row.stat}
                      </Typography>
                      <Typography sx={{ color: MIST, fontSize: '0.85rem', lineHeight: 1.55 }}>
                        {row.label}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* FINAL CTA — matches pricing + landing */}
      <Box component="section" sx={{ py: { xs: 11, md: 15 }, bgcolor: INK_DARK, color: '#FFFFFF', textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography
            variant="h2"
            sx={{ fontSize: { xs: '2.1rem', md: '3rem' }, fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.03em', mb: 3, color: '#FFFFFF' }}
          >
            Try MeticleCare for 14 days, on us.
          </Typography>
          <Typography sx={{ opacity: 0.92, fontSize: '1.12rem', lineHeight: 1.7, mb: 5, maxWidth: 560, mx: 'auto' }}>
            Full Care Service functionality. No credit card. UK-only data centres. We pull migration data from your existing system for free in the first 30 days.
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
