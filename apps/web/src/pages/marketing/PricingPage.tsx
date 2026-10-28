import { Box, Button, Container, Grid, Stack, Typography, Chip, Divider } from '@mui/material'
import { ArrowForward, Check, Groups, Shield, Insights } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { M } from '../../styles/marketing-tokens'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'

function SectionLabel({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <Box sx={{ mb: 1, textAlign: center ? "center" : "left" }}>
      <Typography component="span" sx={{ fontSize: "0.8rem", lineHeight: 1.3, fontWeight: 600, letterSpacing: "0.08em", color: M.navy }}>{children}</Typography>
    </Box>
  )
}

const tiers = [
  {
    name: 'Essential',
    subtitle: 'For smaller care providers getting started',
    price: 'Talk to us',
    period: 'sales-led pricing based on your service',
    color: M.navy,
    icon: Groups,
    features: [
      'Care plan management',
      'Daily care notes',
      'Staff directory & profiles',
      'Visit scheduling & rota',
      'Basic compliance tracking',
      'Mobile app for carers',
      'Family portal access',
      'Email support',
    ],
    highlight: false,
  },
  {
    name: 'Professional',
    subtitle: 'For growing domiciliary and supported living providers',
    price: 'Talk to us',
    period: 'sales-led pricing based on your service',
    color: M.teal,
    icon: Shield,
    features: [
      'Everything in Essential',
      'Medication (eMAR) management',
      'Incident recording & follow-up',
      'Advanced compliance dashboards',
      'AI-assisted care summaries',
      'Reporting & analytics',
      'Shift marketplace',
      'Priority support',
    ],
    highlight: true,
    badge: 'Most popular',
  },
  {
    name: 'Enterprise',
    subtitle: 'For multi-site organisations with complex needs',
    price: 'Talk to us',
    period: 'tailored to your organisation',
    color: M.tealDeep,
    icon: Insights,
    features: [
      'Everything in Professional',
      'Multi-organisation management',
      'Custom integrations & API access',
      'Advanced AI intelligence suite',
      'Dedicated account manager',
      'Custom training & onboarding',
      'Agreed service and support terms',
      'Phone & video support',
    ],
    highlight: false,
  },
]

const faqs = [
  {
    q: 'How is pricing calculated?',
    a: 'Pricing is based on the number of people you support (clients/residents) and the modules you enable. There are no hidden fees — you pay for what you use.',
  },
  {
    q: 'Can we evaluate the platform?',
    a: 'We offer a structured evaluation for suitable organisations. We will agree the scope, duration and commercial terms with you before access is enabled.',
  },
  {
    q: 'Can I change plans later?',
    a: 'Yes. Your plan can be reviewed as your service changes. We will confirm any change in scope or price with you before it takes effect.',
  },
  {
    q: 'What about data migration?',
    a: 'We will assess your existing records during onboarding and agree a migration approach, responsibilities and any associated work before the project starts.',
  },
  {
    q: 'Is my data secure?',
    a: 'Yes. All data is encrypted at rest and in transit, hosted in UK data centres, and compliant with UK GDPR. We never share or sell your data.',
  },
  {
    q: 'Do you offer discounts for charities?',
    a: 'We can discuss the right commercial structure for charities and not-for-profit providers during the sales conversation.',
  },
]

export default function PricingPage() {
  const nav = useNavigate()

  return (
    <MarketingLayout>
      <PageMeta title="Pricing" description="Sales-led pricing for UK domiciliary and supported living care providers. Book a conversation to scope your service and modules." canonicalPath="/pricing" />

      {/* Hero */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Box sx={{ maxWidth: 720 }}>
            <SectionLabel>Pricing</SectionLabel>
            <Typography sx={{ fontSize: M.display.fontSize, lineHeight: M.display.lineHeight, fontWeight: M.display.fontWeight, letterSpacing: M.display.letterSpacing, mb: 3 }}>
              Simple pricing for better care.
            </Typography>
            <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, lineHeight: M.bodyLg.lineHeight, mb: 4 }}>
              We scope pricing around your service type, people supported, locations and the modules you need. Book a conversation and receive a clear proposal before you commit.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', '&:hover': { bgcolor: M.navyHover } }}>
                Book a demo
              </Button>
              <Button variant="outlined" onClick={() => nav('/contact')} sx={{ borderColor: M.navy, color: M.navy, fontWeight: 600, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', '&:hover': { borderColor: M.navy, bgcolor: 'rgba(1,100,200,0.06)' } }}>
                Talk through your needs
              </Button>
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* Tier cards */}
      <Box sx={{ py: { xs: 6, md: 10 }, bgcolor: M.paper, borderTop: `1px solid ${M.faint}` }}>
        <Container maxWidth="lg">
          <Grid container spacing={3} alignItems="stretch">
            {tiers.map((tier) => (
              <Grid item xs={12} md={4} key={tier.name}>
                <Box sx={{
                  p: 4, borderRadius: M.r.lg, height: '100%', display: 'flex', flexDirection: 'column',
                  border: tier.highlight ? `2px solid ${tier.color}` : `1px solid ${M.faint}`,
                  bgcolor: tier.highlight ? `${tier.color}06` : M.card,
                  position: 'relative',
                  transition: 'all 0.25s',
                  '&:hover': { boxShadow: M.shadow.md, transform: 'translateY(-2px)' },
                }}>
                  {tier.badge && (
                    <Chip label={tier.badge} size="small" sx={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', bgcolor: tier.color, color: 'white', fontWeight: 600, fontSize: '0.7rem' }} />
                  )}
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                    <Box sx={{ width: 40, height: 40, borderRadius: M.r.md, bgcolor: `${tier.color}12`, display: 'grid', placeItems: 'center' }}>
                      <tier.icon sx={{ color: tier.color, fontSize: 20 }} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 600, fontSize: '1.1rem' }}>{tier.name}</Typography>
                      <Typography sx={{ color: M.muted, fontSize: '0.78rem' }}>{tier.subtitle}</Typography>
                    </Box>
                  </Stack>
                  <Box sx={{ mb: 3 }}>
                    <Typography sx={{ fontSize: '2rem', fontWeight: 600, color: tier.color }}>{tier.price}</Typography>
                    <Typography sx={{ color: M.muted, fontSize: '0.82rem' }}>{tier.period}</Typography>
                  </Box>
                  <Divider sx={{ mb: 3 }} />
                  <Stack spacing={1.5} sx={{ flex: 1 }}>
                    {tier.features.map((f) => (
                      <Stack key={f} direction="row" spacing={1.5} alignItems="center">
                        <Check sx={{ color: M.navy, fontSize: 16 }} />
                        <Typography sx={{ fontSize: '0.88rem' }}>{f}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                  <Button
                    variant={tier.highlight ? 'contained' : 'outlined'}
                    endIcon={<ArrowForward />}
                    onClick={() => nav('/contact')}
                    fullWidth
                    sx={{
                      mt: 3, py: 1.5, fontWeight: 600, textTransform: 'none', borderRadius: M.r.md,
                      bgcolor: tier.highlight ? M.navy : 'transparent',
                      color: tier.highlight ? '#FFFFFF' : M.navy,
                      borderColor: M.navy,
                      '&:hover': { bgcolor: tier.highlight ? M.navyHover : 'rgba(1,100,200,0.06)', borderColor: M.navy },
                    }}
                  >
                    Talk to sales
                  </Button>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Feature comparison */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Box sx={{ mb: 6, maxWidth: 720 }}>
            <Typography sx={{ fontSize: M.h2.fontSize, fontWeight: M.h2.fontWeight, letterSpacing: M.h2.letterSpacing, mb: 2 }}>
              Compare plans in detail
            </Typography>
          </Box>
          <Box sx={{ overflowX: 'auto' }}>
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <Box component="thead">
                <Box component="tr">
                  <Box component="th" sx={{ textAlign: 'left', py: 2, px: 2, borderBottom: `2px solid ${M.faint}`, fontWeight: 600, fontSize: '0.85rem' }}>Feature</Box>
                  {tiers.map(t => (
                    <Box key={t.name} component="th" sx={{ textAlign: 'center', py: 2, px: 2, borderBottom: `2px solid ${M.navy}`, fontWeight: 600, fontSize: '0.85rem', color: t.color }}>{t.name}</Box>
                  ))}
                </Box>
              </Box>
              <Box component="tbody">
                {[
                  { feature: 'Care plans & daily notes', essential: true, professional: true, enterprise: true },
                  { feature: 'Staff directory & profiles', essential: true, professional: true, enterprise: true },
                  { feature: 'Visit scheduling & rota', essential: true, professional: true, enterprise: true },
                  { feature: 'Mobile app for carers', essential: true, professional: true, enterprise: true },
                  { feature: 'Family portal', essential: true, professional: true, enterprise: true },
                  { feature: 'Basic compliance tracking', essential: true, professional: true, enterprise: true },
                  { feature: 'Medication (eMAR)', essential: false, professional: true, enterprise: true },
                  { feature: 'Incident recording & follow-up', essential: false, professional: true, enterprise: true },
                  { feature: 'Advanced compliance dashboards', essential: false, professional: true, enterprise: true },
                  { feature: 'AI-assisted care summaries', essential: false, professional: true, enterprise: true },
                  { feature: 'Reporting & analytics', essential: false, professional: true, enterprise: true },
                  { feature: 'Shift marketplace', essential: false, professional: true, enterprise: true },
                  { feature: 'Multi-organisation management', essential: false, professional: false, enterprise: true },
                  { feature: 'Custom integrations & API', essential: false, professional: false, enterprise: true },
                  { feature: 'Advanced AI intelligence', essential: false, professional: false, enterprise: true },
                  { feature: 'Dedicated account manager', essential: false, professional: false, enterprise: true },
                  { feature: 'Agreed service and support terms', essential: false, professional: false, enterprise: true },
                ].map((row) => (
                  <Box key={row.feature} component="tr" sx={{ '&:hover': { bgcolor: M.paper } }}>
                    <Box component="td" sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${M.faint}`, fontSize: '0.88rem' }}>{row.feature}</Box>
                    {[row.essential, row.professional, row.enterprise].map((val, j) => (
                      <Box key={j} component="td" sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${M.faint}`, textAlign: 'center' }}>
                        {val ? (
                          <Check sx={{ color: M.navy, fontSize: 18 }} />
                        ) : (
                          <Typography sx={{ color: M.faint, fontSize: '0.8rem' }}>—</Typography>
                        )}
                      </Box>
                    ))}
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* FAQs */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.paper, borderTop: `1px solid ${M.faint}` }}>
        <Container maxWidth="lg">
          <Box sx={{ mb: 6, maxWidth: 720 }}>
            <Typography sx={{ fontSize: M.h2.fontSize, fontWeight: M.h2.fontWeight, letterSpacing: M.h2.letterSpacing, mb: 2 }}>
              Frequently asked questions
            </Typography>
          </Box>
          <Stack spacing={3}>
            {faqs.map((faq) => (
              <Box key={faq.q} sx={{ p: 3, bgcolor: M.card, borderRadius: M.r.md, border: `1px solid ${M.faint}` }}>
                <Typography sx={{ fontWeight: 600, mb: 1 }}>{faq.q}</Typography>
                <Typography sx={{ color: M.slate, lineHeight: 1.7 }}>{faq.a}</Typography>
              </Box>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* CTA */}
      <Box sx={{ py: { xs: 10, md: 14 }, bgcolor: M.card, borderTop: `1px solid ${M.faint}` }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 4, md: 6 }} alignItems="center">
            <Grid item xs={12} md={7}>
              <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing, color: M.ink, mb: 2 }}>
                Ready to get started?
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize }}>
                Talk to the team about your service and receive a proposal built around your needs.
              </Typography>
            </Grid>
            <Grid item xs={12} md={5}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent={{ md: 'flex-end' }}>
                <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', '&:hover': { bgcolor: M.navyHover } }}>
                  Book a demo
                </Button>
                <Button variant="outlined" onClick={() => nav('/contact')} sx={{ borderColor: M.navy, color: M.navy, fontWeight: 600, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', '&:hover': { borderColor: M.navy, bgcolor: 'rgba(1,100,200,0.06)' } }}>
                  Talk through your needs
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
