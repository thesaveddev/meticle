import { Box, Button, Container, Grid, Stack, Typography } from '@mui/material'
import { ArrowForward, CheckCircle, Insights, Tune } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'

const INK = '#1B2430'
const NAVY = '#0F4C81'
const EMERALD = '#10B981'
const BONE = '#F7F4EE'
const MIST = '#5B6672'
const HAIRLINE = '#E7E1D6'

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
        <Container maxWidth="md">
          <Typography sx={{ color: NAVY, fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase', mb: 2 }}>Customer outcomes</Typography>
          <Typography variant="h1" sx={{ fontSize: { xs: '2.5rem', md: '4rem' }, fontWeight: 900, lineHeight: 1.02, letterSpacing: '-0.04em', color: INK, mb: 3 }}>Measure the work that matters.</Typography>
          <Typography sx={{ color: MIST, fontSize: { xs: '1.05rem', md: '1.2rem' }, lineHeight: 1.7, maxWidth: 650 }}>
            We do not publish unverified customer numbers or invented testimonials. In a structured pilot, we agree baseline measures with your team, then review the evidence together.
          </Typography>
        </Container>
      </Box>
      <Box component="section" sx={{ py: { xs: 8, md: 12 }, bgcolor: '#FFFFFF' }}>
        <Container maxWidth="lg">
          <Grid container spacing={3}>
            {pilotAreas.map((area) => (
              <Grid item xs={12} md={4} key={area.title}>
                <Box sx={{ height: '100%', p: { xs: 3, md: 3.5 }, border: `1px solid ${HAIRLINE}`, borderRadius: 2.5, bgcolor: BONE }}>
                  <Box sx={{ width: 42, height: 42, borderRadius: 1.5, bgcolor: '#FFFFFF', display: 'grid', placeItems: 'center', mb: 3 }}>{area.icon}</Box>
                  <Typography variant="h2" sx={{ color: INK, fontSize: '1.25rem', fontWeight: 800, mb: 1.5 }}>{area.title}</Typography>
                  <Typography sx={{ color: MIST, lineHeight: 1.7 }}>{area.body}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
      <Box component="section" sx={{ py: { xs: 8, md: 11 }, bgcolor: '#FFFFFF', borderTop: `1px solid ${HAIRLINE}` }}>
        <Container maxWidth="md">
          <Typography sx={{ color: NAVY, fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase', mb: 2 }}>What a pilot includes</Typography>
          <Stack spacing={2}>
            {['A defined service scope and success measures', 'A guided setup for your people, locations and workflows', 'Regular review points with evidence from the platform', 'A written recommendation on next steps and commercial fit'].map((item) => (
              <Stack direction="row" spacing={1.5} alignItems="flex-start" key={item}>
                <CheckCircle sx={{ color: EMERALD, fontSize: 21, mt: 0.2 }} />
                <Typography sx={{ color: INK, fontSize: '1rem', lineHeight: 1.6 }}>{item}</Typography>
              </Stack>
            ))}
          </Stack>
        </Container>
      </Box>
      <Box component="section" sx={{ py: { xs: 10, md: 14 }, bgcolor: NAVY, color: '#FFFFFF', textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography variant="h2" sx={{ fontSize: { xs: '2.1rem', md: '3rem' }, fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.03em', mb: 2 }}>Build the evidence with us.</Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '1.1rem', lineHeight: 1.7, mb: 4 }}>Tell us how your service runs and we will show you what a focused evaluation could look like.</Typography>
          <Button variant="contained" endIcon={<ArrowForward />} onClick={() => navigate('/contact')} sx={{ bgcolor: EMERALD, color: '#07251E', fontWeight: 800, px: 4, py: 1.5, textTransform: 'none', '&:hover': { bgcolor: '#34D399' } }}>Talk to our team</Button>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
