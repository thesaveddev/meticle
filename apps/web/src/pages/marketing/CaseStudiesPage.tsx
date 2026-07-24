import { Container, Typography, Grid, Box, Stack, Button, Chip } from '@mui/material'
import { TrendingDown, CheckCircle, People, Speed } from '@mui/icons-material'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import { useNavigate } from 'react-router-dom'

const caseStudies = [
  {
    company: 'Brightside Care',
    tagline: '40% reduction in agency spend within 3 months',
    sector: 'Supported Living',
    size: '120 staff across 8 locations',
    results: [
      { icon: <TrendingDown sx={{ color: '#16A34A' }} />, label: 'Agency Spend', value: '-40%' },
      { icon: <CheckCircle sx={{ color: '#16A34A' }} />, label: 'Compliance Rate', value: '98%' },
      { icon: <People sx={{ color: '#16A34A' }} />, label: 'Staff Retention', value: '+25%' },
      { icon: <Speed sx={{ color: '#16A34A' }} />, label: 'Hours Saved/Week', value: '12h' },
    ],
    quote: 'Meticle has completely transformed how we manage our staff compliance. We no longer worry about missing renewals.',
    quoteAuthor: 'Sarah Jenkins, Operations Director',
    body: 'Brightside Care was managing rosters across 8 locations using spreadsheets and email. Compliance tracking was manual, leading to missed DBS renewals and inspection scares. After implementing Meticle, they gained real-time visibility into staffing across all sites, automated their compliance workflows, and filled 60% more shifts internally through the Shift Marketplace.'
  },
  {
    company: 'Maple Leaf Housing',
    tagline: 'From inspection warning to "Good" rating in 6 months',
    sector: 'Learning Disabilities',
    size: '45 staff across 3 homes',
    results: [
      { icon: <TrendingDown sx={{ color: '#16A34A' }} />, label: 'Agency Spend', value: '-55%' },
      { icon: <CheckCircle sx={{ color: '#16A34A' }} />, label: 'Compliance Rate', value: '100%' },
      { icon: <People sx={{ color: '#16A34A' }} />, label: 'Staff Retention', value: '+35%' },
      { icon: <Speed sx={{ color: '#16A34A' }} />, label: 'Hours Saved/Week', value: '8h' },
    ],
    quote: 'The readiness dashboard showed us exactly where we were falling short. We fixed our training gaps before the next inspection.',
    quoteAuthor: 'David Okonkwo, Registered Manager',
    body: 'Maple Leaf Housing received a "Requires Improvement" rating from CQC with compliance flagged as a key concern. They deployed Meticle across all three homes, used the Training Matrix to close gaps in mandatory training, and leveraged the evidence pack feature to prepare for re-inspection. Six months later they achieved a "Good" rating across all five key questions.'
  },
  {
    company: 'Prestige Care Group',
    tagline: 'Scaled from 1 to 5 locations without adding back-office headcount',
    sector: 'Residential & Nursing',
    size: '200 staff across 5 homes',
    results: [
      { icon: <TrendingDown sx={{ color: '#16A34A' }} />, label: 'Agency Spend', value: '-30%' },
      { icon: <CheckCircle sx={{ color: '#16A34A' }} />, label: 'Compliance Rate', value: '95%' },
      { icon: <People sx={{ color: '#16A34A' }} />, label: 'Staff Retention', value: '+20%' },
      { icon: <Speed sx={{ color: '#16A34A' }} />, label: 'Hours Saved/Week', value: '15h' },
    ],
    quote: 'We doubled our locations without hiring extra managers. The platform gives us central control with local flexibility.',
    quoteAuthor: 'James Cooper, CEO',
    body: 'Prestige Care Group was planning to expand from 1 to 5 homes but worried about the administrative overhead. Meticle\'s multi-site dashboard, unified compliance tracking, and cross-location shift marketplace allowed them to scale seamlessly. Each home maintains local scheduling autonomy while head office gets consolidated reporting and oversight.'
  }
]

export default function CaseStudiesPage() {
  const navigate = useNavigate()
  return (
    <MarketingLayout>
      <Box sx={{ py: 15, bgcolor: '#F8FAFC', borderBottom: '1px solid #E5E7EB', textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography variant="overline" sx={{ fontWeight: 800, color: '#0F4C81' }}>CASE STUDIES</Typography>
          <Typography variant="h2" sx={{ mt: 2, mb: 3 }}>Real Results From Real Care Providers</Typography>
          <Typography sx={{ color: '#6B7280', fontSize: '1.15rem' }}>
            See how care organisations across the UK are transforming their workforce operations with Meticle.
          </Typography>
        </Container>
      </Box>

      {caseStudies.map((cs, i) => (
        <Box key={i} sx={{ py: 12, bgcolor: i % 2 === 0 ? 'white' : '#F8FAFC' }}>
          <Container maxWidth="lg">
            <Grid container spacing={6} alignItems="center">
              <Grid item xs={12} md={6}>
                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                  <Chip label={cs.sector} size="small" variant="outlined" color="primary" />
                  <Chip label={cs.size} size="small" variant="outlined" />
                </Stack>
                <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>{cs.company}</Typography>
                <Typography variant="h6" sx={{ color: '#0F4C81', mb: 4, fontWeight: 600 }}>{cs.tagline}</Typography>
                <Typography sx={{ color: '#6B7280', lineHeight: 1.8, mb: 4 }}>{cs.body}</Typography>
                <Box sx={{ p: 3, bgcolor: '#F0F9FF', borderRadius: 3, borderLeft: '4px solid #0F4C81' }}>
                  <Typography sx={{ fontStyle: 'italic', mb: 1, fontWeight: 500 }}>"{cs.quote}"</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>— {cs.quoteAuthor}</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Stack spacing={2}>
                  {cs.results.map((r, j) => (
                    <Box key={j} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 3, bgcolor: 'white', borderRadius: 2, border: '1px solid #E5E7EB' }}>
                      {r.icon}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" color="text.secondary">{r.label}</Typography>
                      </Box>
                      <Typography variant="h5" sx={{ fontWeight: 900, color: '#0F4C81' }}>{r.value}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Grid>
            </Grid>
          </Container>
        </Box>
      ))}

      <Box sx={{ py: 15, bgcolor: '#0F4C81', color: 'white', textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography variant="h3" sx={{ mb: 3 }}>Be Our Next Success Story</Typography>
          <Typography sx={{ mb: 6, fontSize: '1.25rem', opacity: 0.9 }}>See what Meticle can do for your organisation.</Typography>
          <Stack direction="row" spacing={2} justifyContent="center">
            <Button variant="contained" size="large" onClick={() => navigate('/register')} sx={{ bgcolor: 'white', color: '#0F4C81', py: 2, px: 6, fontWeight: 800 }}>Get Started</Button>
            <Button variant="outlined" size="large" onClick={() => navigate('/contact')} sx={{ borderColor: 'rgba(255,255,255,0.5)', color: 'white', py: 2, px: 6, fontWeight: 800 }}>Book a Demo</Button>
          </Stack>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
