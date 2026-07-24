import { Container, Typography, Grid, Box, Stack, Paper, Button } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import {
  Business as SetupIcon,
  People as TeamIcon,
  Verified as CareIcon,
  CheckCircle as CheckIcon,
  Speed as QuickIcon,
  Security as SecureIcon,
  Map as RegulatorIcon,
} from '@mui/icons-material'
import MarketingLayout from '../../components/marketing/MarketingLayout'

const steps = [
  {
    number: '1',
    title: 'Set Up Your Service',
    icon: <SetupIcon sx={{ fontSize: 48 }} />,
    description: 'Add your organisation details and configure your regulatory body. Choose from CQC, CIW, Care Inspectorate Scotland, or RQIA — your compliance scoring and evidence packs automatically adjust.',
    details: [
      'Create your organisation account in under 10 minutes',
      'Select your regulator — framework-aware scoring activates automatically',
      'Configure locations, departments, and teams',
      'Set compliance thresholds and escalation rules',
      'Upload your logo and brand colours for branded evidence packs',
    ]
  },
  {
    number: '2',
    title: 'Invite Your Team',
    icon: <TeamIcon sx={{ fontSize: 48 }} />,
    description: 'Add staff with role-based access controls. Compliance profiles are role-based — each role gets a profile of linked requirements, and staff are auto-assigned based on their role.',
    details: [
      'Invite staff by email with role assignment',
      'Compliance profiles auto-assign based on staff role',
      'Role-based permissions control access to every module',
      'Staff see their own compliance status on their dashboard',
      'Managers and ORG_ADMINs get full organisational oversight',
    ]
  },
  {
    number: '3',
    title: 'Start Recording Care & Compliance',
    icon: <CareIcon sx={{ fontSize: 48 }} />,
    description: 'Daily operations feed your compliance scoring automatically. Training, competency, surveys, incidents — every action produces evidence that keeps you inspection-ready.',
    details: [
      'Training completion scores feed the Effective domain',
      'Competency assessments with CQC statement mapping feed Safe',
      'Satisfaction surveys (email-invited) feed Caring',
      'Staff engagement surveys feed Well-led',
      'Incident severity tracking feeds Responsive',
    ]
  },
]

export default function HowItWorksPage() {
  const navigate = useNavigate()

  return (
    <MarketingLayout>
      {/* Header */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#F8FAFC', borderBottom: '1px solid #E5E7EB' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', maxWidth: 700, mx: 'auto' }}>
            <Stack direction="row" spacing={1} justifyContent="center" alignItems="center" sx={{ mb: 3 }}>
              <RegulatorIcon sx={{ fontSize: 18, color: '#16A34A' }} />
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#16A34A', letterSpacing: 1, textTransform: 'uppercase' }}>
                Get Started in Minutes
              </Typography>
            </Stack>
            <Typography variant="h2" sx={{ mb: 3, fontSize: { xs: '2rem', md: '2.8rem' } }}>
              How Meticle Works
            </Typography>
            <Typography sx={{ color: '#6B7280', fontSize: '1.15rem', lineHeight: 1.7 }}>
              Get started in minutes with a simple three-step process. No long contracts, no complex software, no painful onboarding.
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* Steps */}
      {steps.map((step, idx) => (
        <Box key={step.number} sx={{ py: { xs: 8, md: 12 }, bgcolor: idx % 2 === 0 ? 'white' : '#F8FAFC', borderBottom: '1px solid #E5E7EB' }}>
          <Container maxWidth="lg">
            <Grid container spacing={6} alignItems="center" direction={idx % 2 === 0 ? 'row' : 'row-reverse'}>
              <Grid item xs={12} md={5}>
                <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
                  <Box sx={{
                    width: 80, height: 80, borderRadius: '50%', bgcolor: '#0F4C81', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3,
                    fontSize: '2rem', fontWeight: 900, mx: { xs: 'auto', md: 0 }
                  }}>
                    {step.number}
                  </Box>
                  <Box sx={{ color: '#0F4C81', mb: 2 }}>{step.icon}</Box>
                  <Typography variant="h3" sx={{ mb: 2, fontWeight: 900, fontSize: '1.8rem' }}>{step.title}</Typography>
                  <Typography sx={{ color: '#6B7280', lineHeight: 1.7, mb: 4 }}>{step.description}</Typography>
                  <Stack spacing={1.5}>
                    {step.details.map((d, i) => (
                      <Stack key={i} direction="row" spacing={1.5} alignItems="flex-start">
                        <CheckIcon sx={{ fontSize: 18, color: '#16A34A', mt: 0.3, flexShrink: 0 }} />
                        <Typography variant="body2" sx={{ color: '#4B5563', fontWeight: 500 }}>{d}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              </Grid>
              <Grid item xs={12} md={7}>
                <Paper elevation={0} sx={{ p: 5, border: '1px solid #E5E7EB', borderRadius: 4, bgcolor: '#F8FAFC' }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>
                    {step.number === '1' && 'What you configure in Step 1'}
                    {step.number === '2' && 'Role-based access levels'}
                    {step.number === '3' && 'Your live compliance dashboard'}
                  </Typography>
                  <Grid container spacing={2}>
                    {[
                      { label: 'Regulator', val: 'CQC / CIW / Care Inspectorate / RQIA' },
                      { label: 'Compliance Threshold', val: 'Configurable % (default 80%)' },
                      { label: 'Locations', val: 'Unlimited with minimum staffing' },
                      { label: 'Staff Roles', val: 'ORG_ADMIN / MANAGER / CARE_WORKER' },
                      { label: 'Evidence Format', val: 'KLOE-organised PDF packs' },
                      { label: 'Scoring', val: 'Real data, 5 CQC domains' },
                    ].map((item, i) => (
                      <Grid item xs={12} sm={6} key={i}>
                        <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 2, border: '1px solid #E5E7EB' }}>
                          <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase' }}>{item.label}</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.5 }}>{item.val}</Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
              </Grid>
            </Grid>
          </Container>
        </Box>
      ))}

      {/* Why Meticle */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#0F4C81', color: 'white' }}>
        <Container maxWidth="lg">
          <Typography variant="h3" sx={{ textAlign: 'center', mb: 8, fontWeight: 900 }}>Why Meticle?</Typography>
          <Grid container spacing={4}>
            {[
              { icon: <QuickIcon />, title: 'Setup in Minutes', desc: 'No lengthy onboarding. Configure your service, invite your team, and start recording care in under an hour.' },
              { icon: <RegulatorIcon />, title: 'All 4 Regulators', desc: 'CQC, CIW, Care Inspectorate, and RQIA — all natively supported. Your evidence packs adjust automatically.' },
              { icon: <SecureIcon />, title: 'UK Data Sovereignty', desc: 'All data hosted in UK-based ISO 27001-certified data centres. AES-256 encryption, full audit trails.' },
              { icon: <CheckIcon />, title: 'No Long Contracts', desc: 'Month-to-month pricing with no lock-in. Cancel anytime. Your data is yours to export.' },
            ].map((item, i) => (
              <Grid item xs={12} sm={6} md={3} key={i}>
                <Box sx={{ textAlign: 'center', p: 3 }}>
                  <Box sx={{ mb: 2, '& svg': { fontSize: 40, color: '#86EFAC' } }}>{item.icon}</Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>{item.title}</Typography>
                  <Typography variant="body2" sx={{ opacity: 0.85 }}>{item.desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
          <Box sx={{ textAlign: 'center', mt: 6 }}>
            <Button variant="contained" size="large" onClick={() => navigate('/register')} sx={{ bgcolor: 'white', color: '#0F4C81', py: 2, px: 6, fontWeight: 800, '&:hover': { bgcolor: '#F8FAFC' } }}>
              Start Your 14-Day Free Trial
            </Button>
          </Box>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
