import { Container, Typography, Grid, Box, Stack, Button, Divider } from '@mui/material'
import { Verified as ShieldIcon, Group as TeamIcon, TrendingDown as SavingsIcon, Lightbulb as InnovationIcon } from '@mui/icons-material'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import { useNavigate } from 'react-router-dom'

const values = [
  { icon: <ShieldIcon sx={{ fontSize: 40, color: '#0F4C81' }} />, title: 'Trust & Compliance', text: 'Every feature is built with regulatory compliance at its core. We help care providers stay inspection-ready across all four UK frameworks.' },
  { icon: <TeamIcon sx={{ fontSize: 40, color: '#0F4C81' }} />, title: 'People First', text: 'We believe better technology creates better care. Our platform empowers carers and managers to focus on what matters — delivering quality support.' },
  { icon: <SavingsIcon sx={{ fontSize: 40, color: '#0F4C81' }} />, title: 'Value Driven', text: 'We measure our success by the tangible savings and efficiency gains we deliver to care providers, not by feature count.' },
  { icon: <InnovationIcon sx={{ fontSize: 40, color: '#0F4C81' }} />, title: 'Continuous Improvement', text: 'The care sector evolves rapidly. We invest relentlessly in R&D to keep our platform ahead of regulatory changes and operational needs.' },
]

export default function AboutPage() {
  const navigate = useNavigate()
  return (
    <MarketingLayout>
      <Box sx={{ py: 15, bgcolor: '#F8FAFC', borderBottom: '1px solid #E5E7EB' }}>
        <Container maxWidth="lg">
          <Grid container spacing={8} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography variant="overline" sx={{ fontWeight: 800, color: '#0F4C81' }}>OUR STORY</Typography>
              <Typography variant="h2" sx={{ mt: 2, mb: 3 }}>Modernising Care Workforce Management</Typography>
              <Typography sx={{ color: '#6B7280', fontSize: '1.15rem', lineHeight: 1.8, mb: 3 }}>
                CareDesk was founded by a team of care operators and software engineers who saw first-hand how fragmented 
                tools were hurting care quality. Spreadsheets for rotas, WhatsApp for communication, paper for compliance — 
                it was time for a unified platform built specifically for supported living and domiciliary care.
              </Typography>
              <Typography sx={{ color: '#6B7280', fontSize: '1.15rem', lineHeight: 1.8 }}>
                Today, we serve care providers across the UK, helping them reduce agency spend, stay inspection-ready, 
                and give their staff the digital tools they deserve.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 6, bgcolor: '#0F4C81', borderRadius: 4, color: 'white', textAlign: 'center' }}>
                <Typography variant="h3" sx={{ fontWeight: 900, mb: 2 }}>UK-Based</Typography>
                <Typography sx={{ opacity: 0.9, mb: 3 }}>Headquartered in London, serving care providers nationwide</Typography>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)', mb: 3 }} />
                <Typography variant="h3" sx={{ fontWeight: 900, mb: 2 }}>Care-Operated</Typography>
                <Typography sx={{ opacity: 0.9 }}>Built by former care managers who understand your challenges</Typography>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Box sx={{ py: 15 }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 10 }}>
            <Typography variant="h2" sx={{ mb: 3 }}>Our Values</Typography>
            <Typography sx={{ color: '#6B7280', fontSize: '1.15rem', maxWidth: 600, mx: 'auto' }}>
              The principles that guide every decision we make.
            </Typography>
          </Box>
          <Grid container spacing={4}>
            {values.map((v, i) => (
              <Grid item xs={12} sm={6} key={i}>
                <Box sx={{ p: 4, border: '1px solid #E5E7EB', borderRadius: 3, height: '100%' }}>
                  <Box sx={{ mb: 3 }}>{v.icon}</Box>
                  <Typography variant="h5" sx={{ mb: 2, fontWeight: 800 }}>{v.title}</Typography>
                  <Typography sx={{ color: '#6B7280', lineHeight: 1.7 }}>{v.text}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <Box sx={{ py: 15, bgcolor: '#0F4C81', color: 'white', textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography variant="h3" sx={{ mb: 3 }}>Ready to Transform Your Care Operations?</Typography>
          <Typography sx={{ mb: 6, fontSize: '1.25rem', opacity: 0.9 }}>Join hundreds of care providers already using CareDesk.</Typography>
          <Stack direction="row" spacing={2} justifyContent="center">
            <Button variant="contained" size="large" onClick={() => navigate('/register')} sx={{ bgcolor: 'white', color: '#0F4C81', py: 2, px: 6, fontWeight: 800 }}>Sign Up Now</Button>
            <Button variant="outlined" size="large" onClick={() => navigate('/contact')} sx={{ borderColor: 'rgba(255,255,255,0.5)', color: 'white', py: 2, px: 6, fontWeight: 800 }}>Contact Us</Button>
          </Stack>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
