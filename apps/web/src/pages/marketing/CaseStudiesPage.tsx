import { Box, Button, Container, Grid, Stack, Typography } from '@mui/material'
import { ArrowForward, CheckCircle, Insights, Tune } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'
import { M } from '../../styles/marketing-tokens'

const INK = M.ink
const NAVY = M.navy
const BONE = M.paper
const MIST = M.slate
const HAIRLINE = M.faint

const pilotAreas = [
  { icon: <Tune sx={{ color: NAVY }} />, title: 'Operational visibility', body: 'Agree the measures that matter to your service: visit completion, staffing pressure, outstanding actions and reporting time.' },
  { icon: <CheckCircle sx={{ color: NAVY }} />, title: 'Compliance readiness', body: 'Map your evidence requirements and review whether records, training, incidents and actions are easier to find and keep current.' },
  { icon: <Insights sx={{ color: NAVY }} />, title: 'Time returned to teams', body: 'Compare the time your managers spend coordinating care, chasing information and preparing reports before and after rollout.' },
]

export default function CaseStudiesPage() {
  const navigate = useNavigate()
  return (
    <MarketingLayout>
      <PageMeta
        title="Customer outcomes | MeticleCare"
        description="See how MeticleCare helps care providers define and measure better operational visibility, compliance readiness and team efficiency during a structured pilot."
        canonicalPath="/case-studies"
      />
      <Box component="section" sx={{ pt: { xs: 9, md: 13 }, pb: { xs: 8, md: 11 }, bgcolor: BONE, borderBottom: `1px solid ${HAIRLINE}` }}>
        <Container maxWidth="lg">
          <Typography sx={{ color: NAVY, fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.08em', mb: 2 }}>Customer outcomes</Typography>
          <Typography variant="h1" sx={{ fontSize: { xs: '2.5rem', md: '4rem' }, fontWeight: 600, lineHeight: 1.02, letterSpacing: '-0.04em', color: INK, mb: 3 }}>Measure the work that matters.</Typography>
          <Typography sx={{ color: MIST, fontSize: { xs: '1.05rem', md: '1.2rem' }, lineHeight: 1.7, maxWidth: 720 }}>
            We do not publish unverified customer numbers or invented testimonials. In a structured pilot, we agree baseline measures with your team, then review the evidence together.
          </Typography>
        </Container>
      </Box>
      <Box component="section" sx={{ py: { xs: 8, md: 12 }, bgcolor: BONE, borderBottom: `1px solid ${HAIRLINE}` }}>
        <Container maxWidth="lg">
          <Grid container spacing={3}>
            {pilotAreas.map((area) => (
              <Grid item xs={12} md={4} key={area.title}>
                <Box sx={{ height: '100%', p: { xs: 3, md: 3.5 }, border: `1px solid ${HAIRLINE}`, borderRadius: 2.5, bgcolor: M.card }}>
                  <Box sx={{ width: 42, height: 42, borderRadius: 1.5, bgcolor: 'rgba(15,76,129,0.08)', display: 'grid', placeItems: 'center', mb: 3 }}>{area.icon}</Box>
                  <Typography variant="h2" sx={{ color: INK, fontSize: '1.25rem', fontWeight: 600, mb: 1.5 }}>{area.title}</Typography>
                  <Typography sx={{ color: MIST, lineHeight: 1.7 }}>{area.body}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
      <Box component="section" sx={{ py: { xs: 8, md: 11 }, bgcolor: M.card, borderBottom: `1px solid ${HAIRLINE}` }}>
        <Container maxWidth="lg">
          <Typography sx={{ color: NAVY, fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.08em', mb: 2 }}>What a pilot includes</Typography>
          <Stack spacing={2}>
            {['A defined service scope and success measures', 'A guided setup for your people, locations and workflows', 'Regular review points with evidence from the platform', 'A written recommendation on next steps and commercial fit'].map((item) => (
              <Stack direction="row" spacing={1.5} alignItems="flex-start" key={item}>                          <CheckCircle sx={{ color: NAVY, fontSize: 21, mt: 0.2 }} />
                <Typography sx={{ color: INK, fontSize: '1rem', lineHeight: 1.6 }}>{item}</Typography>
              </Stack>
            ))}
          </Stack>
        </Container>
      </Box>
      <Box component="section" sx={{ py: { xs: 10, md: 14 }, bgcolor: M.card }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 4, md: 6 }} alignItems="center">
            <Grid item xs={12} md={7}>
              <Typography variant="h2" sx={{ fontSize: { xs: '2rem', md: '2.6rem' }, fontWeight: 600, lineHeight: 1.1, letterSpacing: '-0.03em', color: INK, mb: 2 }}>Build the evidence with us.</Typography>
              <Typography sx={{ color: MIST, fontSize: '1.1rem', lineHeight: 1.7 }}>Tell us how your service runs and we will show you what a focused evaluation could look like.</Typography>
            </Grid>
            <Grid item xs={12} md={5}>
              <Box sx={{ display: 'flex', justifyContent: { md: 'flex-end' } }}>
                <Button variant="contained" endIcon={<ArrowForward />} onClick={() => navigate('/contact')} sx={{ bgcolor: NAVY, color: '#FFFFFF', fontWeight: 600, px: 4, py: 1.6, textTransform: 'none', '&:hover': { bgcolor: M.navyHover } }}>Talk to our team</Button>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
