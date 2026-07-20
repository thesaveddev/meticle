import { Container, Typography, Grid, Box, Card, Divider, List, ListItem, ListItemIcon, ListItemText, Button } from '@mui/material'
import { CheckCircle as CheckIcon } from '@mui/icons-material'
import MarketingLayout from '../../components/marketing/MarketingLayout'

export default function PricingPage() {
  const plans = [
    {
      name: 'STARTER',
      price: '£99',
      description: 'Ideal for small care teams looking to digitize their basic operations.',
      staff: 'Up to 25 staff',
      features: [
        'Staff profile management',
        'Basic qualification tracking',
        'Standard reporting',
        'Email support',
        'Mobile app access'
      ]
    },
    {
      name: 'PROFESSIONAL',
      price: '£299',
      description: 'The complete solution for established care homes and agencies.',
      staff: 'Up to 100 staff',
      popular: true,
      features: [
        'Everything in Starter',
        'Automated rota planning',
        'Cross-site staff sharing',
        'DBS & Visa monitoring',
        'Advanced audit reports',
        'Priority phone support'
      ]
    },
    {
      name: 'ENTERPRISE',
      price: 'Custom',
      description: 'Dedicated infrastructure and support for large healthcare organizations.',
      staff: 'Unlimited staff',
      features: [
        'Everything in Professional',
        'Multi-location management',
        'Custom API integrations',
        'Single Sign-On (SSO)',
        'Dedicated success manager',
        'On-site training'
      ]
    }
  ]

  return (
    <MarketingLayout>
      <Box sx={{ py: 12 }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 10 }}>
            <Typography variant="h2" sx={{ mb: 2 }}>Simple, Transparent Pricing</Typography>
            <Typography variant="h5" sx={{ color: '#6B7280', fontWeight: 500 }}>Choose the plan that fits your care organization.</Typography>
          </Box>

          <Grid container spacing={4} alignItems="stretch">
            {plans.map((plan) => (
              <Grid item xs={12} md={4} key={plan.name}>
                <Card sx={{ 
                  p: 6, 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column',
                  position: 'relative',
                  border: plan.popular ? '2px solid #0F4C81' : '1px solid #E5E7EB',
                  boxShadow: plan.popular ? '0 20px 25px -5px rgba(0, 0, 0, 0.1)' : 'none'
                }}>
                  {plan.popular && (
                    <Box sx={{ 
                      position: 'absolute', 
                      top: 0, 
                      left: '50%', 
                      transform: 'translate(-50%, -50%)',
                      bgcolor: '#0F4C81',
                      color: 'white',
                      px: 2,
                      py: 0.5,
                      borderRadius: 10,
                      fontSize: '0.75rem',
                      fontWeight: 800
                    }}>
                      MOST POPULAR
                    </Box>
                  )}
                  <Typography variant="overline" sx={{ fontWeight: 800, color: '#6B7280' }}>{plan.name}</Typography>
                  <Typography variant="h3" sx={{ mt: 2, mb: 1 }}>{plan.price}{plan.price !== 'Custom' && <span style={{ fontSize: '1rem', color: '#6B7280' }}>/mo</span>}</Typography>
                  <Typography sx={{ color: '#0F4C81', fontWeight: 700, mb: 3 }}>{plan.staff}</Typography>
                  <Typography variant="body2" sx={{ color: '#6B7280', mb: 4, minHeight: '40px' }}>{plan.description}</Typography>
                  
                  <Divider sx={{ mb: 4 }} />
                  
                  <List sx={{ mb: 6, flexGrow: 1 }}>
                    {plan.features.map(f => (
                      <ListItem key={f} disableGutters>
                        <ListItemIcon sx={{ minWidth: 32 }}><CheckIcon sx={{ color: '#16A34A', fontSize: 20 }} /></ListItemIcon>
                        <ListItemText primary={f} primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }} />
                      </ListItem>
                    ))}
                  </List>

                  <Button 
                    variant={plan.popular ? 'contained' : 'outlined'} 
                    fullWidth 
                    size="large"
                    onClick={() => window.location.href = '/register'}
                    sx={{ 
                      py: 1.5, 
                      fontWeight: 800, 
                      bgcolor: plan.popular ? '#0F4C81' : 'transparent',
                      color: plan.popular ? 'white' : '#111827'
                    }}
                  >
                    {plan.price === 'Custom' ? 'Contact Sales' : 'Sign Up Now'}
                  </Button>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Detailed comparison or FAQ section could go here */}
          <Box sx={{ mt: 15, p: 8, bgcolor: '#F8FAFC', borderRadius: 4, textAlign: 'center' }}>
            <Typography variant="h4" sx={{ mb: 2 }}>Need a custom solution?</Typography>
            <Typography sx={{ color: '#6B7280', mb: 4 }}>We offer tailored packages for large healthcare groups and franchises.</Typography>
            <Button variant="contained" size="large" onClick={() => window.location.href = '/register'} sx={{ bgcolor: '#0F4C81' }}>Sign Up Now</Button>
          </Box>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
