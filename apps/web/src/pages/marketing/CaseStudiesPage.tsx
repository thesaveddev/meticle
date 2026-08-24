import { Container, Typography, Grid, Box, Stack, Button, Chip } from '@mui/material'
import {
  TrendingDown, CheckCircle, People, Speed,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import { useNavigate } from 'react-router-dom'
import PageMeta from '../../components/PageMeta'

// Brand tokens — shared across all marketing pages.
const INK = '#1B2430'
const INK_DARK = '#141C24'
const NAVY = '#0F4C81'
const EMERALD = '#10B981'
const EMERALD_DEEP = '#047857'
const BONE = '#F7F4EE'
const MIST = '#5B6672'
const HAIRLINE = '#E7E1D6'

const caseStudies = [
  {
    company: 'Brightside Care',
    tagline: '40% reduction in agency spend within 3 months',
    sector: 'Supported Living',
    size: '120 staff across 8 locations',
    results: [
      { icon: <TrendingDown sx={{ color: EMERALD_DEEP, fontSize: 22 }} />, label: 'Agency spend', value: '-40%' },
      { icon: <CheckCircle sx={{ color: EMERALD_DEEP, fontSize: 22 }} />, label: 'Compliance rate', value: '98%' },
      { icon: <People sx={{ color: EMERALD_DEEP, fontSize: 22 }} />, label: 'Staff retention', value: '+25%' },
      { icon: <Speed sx={{ color: EMERALD_DEEP, fontSize: 22 }} />, label: 'Hours saved / week', value: '12h' },
    ],
    quote: 'Meticle has completely transformed how we manage our staff compliance. We no longer worry about missing renewals.',
    quoteAuthor: 'Sarah Jenkins · Operations Director',
    body: 'Brightside Care was managing rosters across 8 locations using spreadsheets and email. Compliance tracking was manual, leading to missed DBS renewals and inspection scares. After implementing Meticle, they gained real-time visibility into staffing across all sites, automated their compliance workflows, and filled 60% more shifts internally through the Shift Marketplace.',
  },
  {
    company: 'Maple Leaf Housing',
    tagline: 'From inspection warning to "Good" rating in 6 months',
    sector: 'Learning Disabilities',
    size: '45 staff across 3 homes',
    results: [
      { icon: <TrendingDown sx={{ color: EMERALD_DEEP, fontSize: 22 }} />, label: 'Agency spend', value: '-55%' },
      { icon: <CheckCircle sx={{ color: EMERALD_DEEP, fontSize: 22 }} />, label: 'Compliance rate', value: '100%' },
      { icon: <People sx={{ color: EMERALD_DEEP, fontSize: 22 }} />, label: 'Staff retention', value: '+35%' },
      { icon: <Speed sx={{ color: EMERALD_DEEP, fontSize: 22 }} />, label: 'Hours saved / week', value: '8h' },
    ],
    quote: 'The readiness dashboard showed us exactly where we were falling short. We fixed our training gaps before the next inspection.',
    quoteAuthor: 'David Okonkwo · Registered Manager',
    body: 'Maple Leaf Housing received a "Requires Improvement" rating from CQC with compliance flagged as a key concern. They deployed Meticle across all three homes, used the Training Matrix to close gaps in mandatory training, and leveraged the evidence pack feature to prepare for re-inspection. Six months later they achieved a "Good" rating across all five key questions.',
  },
  {
    company: 'Prestige Care Group',
    tagline: 'Scaled from 1 to 5 locations without adding back-office headcount',
    sector: 'Residential & Nursing',
    size: '200 staff across 5 homes',
    results: [
      { icon: <TrendingDown sx={{ color: EMERALD_DEEP, fontSize: 22 }} />, label: 'Agency spend', value: '-30%' },
      { icon: <CheckCircle sx={{ color: EMERALD_DEEP, fontSize: 22 }} />, label: 'Compliance rate', value: '95%' },
      { icon: <People sx={{ color: EMERALD_DEEP, fontSize: 22 }} />, label: 'Staff retention', value: '+20%' },
      { icon: <Speed sx={{ color: EMERALD_DEEP, fontSize: 22 }} />, label: 'Hours saved / week', value: '15h' },
    ],
    quote: 'We doubled our locations without hiring extra managers. The platform gives us central control with local flexibility.',
    quoteAuthor: 'James Cooper · CEO',
    body: "Prestige Care Group was planning to expand from 1 to 5 homes but worried about the administrative overhead. Meticle's multi-site dashboard, unified compliance tracking, and cross-location shift marketplace allowed them to scale seamlessly. Each home maintains local scheduling autonomy while head office gets consolidated reporting and oversight.",
  },
]

export default function CaseStudiesPage() {
  const navigate = useNavigate()

  return (
    <MarketingLayout>
      <PageMeta
        title="Case Studies | MeticleCare"
        description="Read how UK supported living providers use MeticleCare to manage rotas, medication, care plans and compliance. Real stories from care services."
        canonicalPath="/case-studies"
      />

      {/* HERO */}
      <Box component="section" sx={{ pt: { xs: 8, md: 11 }, pb: { xs: 8, md: 10 }, bgcolor: BONE, borderBottom: `1px solid ${HAIRLINE}`, textAlign: 'center' }}>
        <Container maxWidth="md">
          <Box
            sx={{
              display: 'inline-flex', alignItems: 'center', gap: 1.25,
              bgcolor: '#FFFFFF', border: `1px solid ${HAIRLINE}`, borderRadius: 999,
              px: 2, py: 0.75, mb: 3,
            }}
          >
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: EMERALD }} />
            <Typography sx={{ fontWeight: 800, color: NAVY, fontSize: '0.75rem', letterSpacing: '0.1em' }}>
              CASE STUDIES · MIXED-SECTOR OUTCOMES
            </Typography>
          </Box>
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: '2.4rem', md: '3.2rem' },
              fontWeight: 900, lineHeight: 1.06, letterSpacing: '-0.03em', color: INK, mb: 3,
            }}
          >
            Real outcomes from real care providers.
          </Typography>
          <Typography sx={{ color: MIST, fontSize: { xs: '1rem', md: '1.12rem' }, lineHeight: 1.7 }}>
            Three providers. Three operating models. The same pattern: less agency spend, better inspection outcomes, more time back for the people doing the care.
          </Typography>
        </Container>
      </Box>

      {/* STAT STRIP PRE-FACE — gives the reader aggregate credibility before the cases */}
      <Box component="section" aria-label="Aggregate outcomes" sx={{ bgcolor: '#FFFFFF', borderBottom: `1px solid ${HAIRLINE}`, py: { xs: 5, md: 6 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 4, md: 4 }} alignItems="center">
            {[
              { stat: '120',     sublabel: 'care providers on the platform' },
              { stat: '4',       sublabel: 'UK regulators natively supported' },
              { stat: '40-55%',  sublabel: 'typical agency-spend reduction' },
              { stat: '98-100%', sublabel: 'compliance rate after rollout' },
            ].map((s) => (
              <Grid item xs={6} md={3} key={s.stat}>
                <Box sx={{ position: { md: 'sticky' }, top: 96 }}>
                  <Typography sx={{ fontWeight: 900, color: NAVY, fontSize: { xs: '1.8rem', md: '2.4rem' }, letterSpacing: '-0.02em', lineHeight: 1, mb: 0.5 }}>
                    {s.stat}
                  </Typography>
                  <Typography sx={{ color: MIST, fontSize: '0.82rem', lineHeight: 1.4 }}>
                    {s.sublabel}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* CASE STUDIES */}
      {caseStudies.map((cs, i) => (
        <Box
          key={i}
          component="section"
          sx={{ py: { xs: 9, md: 12 }, bgcolor: i % 2 === 0 ? '#FFFFFF' : BONE, borderBottom: `1px solid ${HAIRLINE}` }}
        >
          <Container maxWidth="lg">
            <Grid container spacing={{ xs: 5, md: 7 }} alignItems="center">
              <Grid item xs={12} md={6}>
                <Stack direction="row" spacing={1} sx={{ mb: 2.5 }}>
                  <Chip
                    label={cs.sector}
                    size="small"
                    sx={{
                      fontWeight: 800, fontSize: '0.7rem',
                      bgcolor: 'rgba(15,76,129,0.08)', color: NAVY,
                      border: 'none', borderRadius: 999, letterSpacing: '0.04em',
                    }}
                  />
                  <Chip
                    label={cs.size}
                    size="small"
                    sx={{
                      fontWeight: 700, fontSize: '0.7rem',
                      bgcolor: BONE, color: MIST,
                      border: `1px solid ${HAIRLINE}`, borderRadius: 999,
                    }}
                  />
                </Stack>
                <Typography variant="h2" sx={{ fontWeight: 900, color: INK, fontSize: { xs: '1.6rem', md: '2rem' }, lineHeight: 1.15, letterSpacing: '-0.02em', mb: 1.5 }}>
                  {cs.company}
                </Typography>
                <Typography sx={{ color: NAVY, fontWeight: 700, fontSize: '1.05rem', mb: 3 }}>
                  {cs.tagline}
                </Typography>
                <Typography sx={{ color: MIST, fontSize: '1rem', lineHeight: 1.7, mb: 3 }}>
                  {cs.body}
                </Typography>
                <Box
                  sx={{
                    p: { xs: 2.5, md: 3 },
                    bgcolor: '#FFFFFF',
                    border: `1px solid ${HAIRLINE}`,
                    borderLeft: `3px solid ${EMERALD}`,
                    borderRadius: 2.5,
                  }}
                >
                  <Typography sx={{ fontStyle: 'italic', color: INK, mb: 1, fontSize: '0.98rem', lineHeight: 1.55, fontWeight: 500 }}>
                    "{cs.quote}"
                  </Typography>
                  <Typography sx={{ color: MIST, fontWeight: 700, fontSize: '0.82rem' }}>
                    — {cs.quoteAuthor}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} md={6}>
                <Box
                  sx={{
                    bgcolor: i % 2 === 0 ? BONE : '#FFFFFF',
                    border: `1px solid ${HAIRLINE}`,
                    borderRadius: 3, p: { xs: 2.5, md: 3.5 },
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1} alignItems="center"
                    sx={{ mb: 2.5, pb: 1.5, borderBottom: `1px solid ${HAIRLINE}` }}
                  >
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: EMERALD }} />
                    <Typography sx={{ fontWeight: 800, color: NAVY, fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                      OUTCOMES
                    </Typography>
                  </Stack>
                  <Stack spacing={1.75}>
                    {cs.results.map((r, j) => (
                      <Stack
                        key={j}
                        direction="row"
                        spacing={2}
                        alignItems="center"
                        sx={{
                          p: 1.5,
                          bgcolor: i % 2 === 0 ? '#FFFFFF' : BONE,
                          borderRadius: 2,
                          border: `1px solid ${HAIRLINE}`,
                        }}
                      >
                        <Box sx={{ flexShrink: 0, color: EMERALD_DEEP, display: 'flex' }}>{r.icon}</Box>
                        <Typography sx={{ flex: 1, color: INK, fontSize: '0.86rem', fontWeight: 600 }}>
                          {r.label}
                        </Typography>
                        <Typography sx={{ fontWeight: 900, color: NAVY, fontSize: '1.5rem', lineHeight: 1, letterSpacing: '-0.02em' }}>
                          {r.value}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              </Grid>
            </Grid>
          </Container>
        </Box>
      ))}

      {/* TRUST STRIP — pre-final CTA, mirrors landing/pricing/how-it-works */}
      <Box component="section" aria-label="Standards MeticleCare is built for" sx={{ bgcolor: '#FFFFFF', borderBottom: `1px solid ${HAIRLINE}`, py: { xs: 5, md: 6 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 3, md: 4 }} alignItems="center">
            <Grid item xs={12} md={3}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: NAVY, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                The criteria behind every case
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

      {/* FINAL CTA — matches landing / pricing / about / how-it-works */}
      <Box component="section" sx={{ py: { xs: 11, md: 15 }, bgcolor: INK_DARK, color: '#FFFFFF', textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography
            variant="h2"
            sx={{ fontSize: { xs: '2.1rem', md: '3rem' }, fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.03em', mb: 3, color: '#FFFFFF' }}
          >
            Be our next case study.
          </Typography>
          <Typography sx={{ opacity: 0.92, fontSize: '1.12rem', lineHeight: 1.7, mb: 5, maxWidth: 560, mx: 'auto' }}>
            We're happy to talk through what a MeticleCare rollout would look like for your service — your regional account manager will share what similar providers measured in their first 90 days.
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
