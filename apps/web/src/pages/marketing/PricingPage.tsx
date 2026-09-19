import { Box, Button, Container, Grid, Stack, Typography, Chip, Divider } from '@mui/material'
import { ArrowForward, Check, Groups, Shield, AutoAwesome } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { M } from '../../styles/marketing-tokens'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
      <Box sx={{ width: 8, height: 8, borderRadius: M.r.full, bgcolor: M.teal }} />
      <Typography sx={{ color: M.tealDeep, fontSize: M.caption.size, fontWeight: M.caption.weight, letterSpacing: M.caption.tracking, textTransform: 'uppercase' }}>{children}</Typography>
    </Stack>
  )
}

const tiers = [
  {
    name: 'Essential',
    subtitle: 'For small domiciliary care providers',
    price: 'From £2.50',
    period: 'per person per week',
    color: '#6366F1',
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
    price: 'From £4.00',
    period: 'per person per week',
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
    price: 'Custom',
    period: 'tailored to your organisation',
    color: '#8B5CF6',
    icon: AutoAwesome,
    features: [
      'Everything in Professional',
      'Multi-organisation management',
      'Custom integrations & API access',
      'Advanced AI intelligence suite',
      'Dedicated account manager',
      'Custom training & onboarding',
      'SLA guarantees',
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
    q: 'Is there a free trial?',
    a: 'Yes. Every organisation starts with a free trial period. No credit card required. You can explore all features before committing.',
  },
  {
    q: 'Can I change plans later?',
    a: 'Absolutely. You can upgrade, downgrade or add modules at any time. Changes take effect on your next billing cycle.',
  },
  {
    q: 'What about data migration?',
    a: 'Our team helps migrate your existing data — client records, care plans, staff information — at no extra cost for Professional and Enterprise plans.',
  },
  {
    q: 'Is my data secure?',
    a: 'Yes. All data is encrypted at rest and in transit, hosted in UK data centres, and compliant with UK GDPR. We never share or sell your data.',
  },
  {
    q: 'Do you offer discounts for charities?',
    a: 'Yes. Registered charities and not-for-profit care providers qualify for discounted pricing. Contact us for details.',
  },
]

export default function PricingPage() {
  const nav = useNavigate()

  return (
    <MarketingLayout>
      <PageMeta title="Pricing" description="Simple, transparent pricing for domiciliary and supported living care providers. No hidden fees. Start with a free trial." canonicalPath="/pricing" />

      {/* Hero */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', maxWidth: 700, mx: 'auto' }}>
            <Eyebrow>Pricing</Eyebrow>
            <Typography sx={{ fontSize: M.display.size, lineHeight: M.display.height, fontWeight: M.display.weight, letterSpacing: M.display.tracking, mb: 3 }}>
              Simple pricing for better care.
            </Typography>
            <Typography sx={{ color: M.slate, fontSize: M.bodyLg.size, lineHeight: M.bodyLg.height, mb: 4 }}>
              No hidden fees, no per-seat licensing surprises. Pay for the people you support and the modules you need. Start with a free trial — no credit card required.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
              <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.teal, color: M.navy, fontWeight: 700, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', '&:hover': { bgcolor: M.tealDark } }}>
                Book a demo
              </Button>
              <Button variant="outlined" onClick={() => nav('/contact')} sx={{ borderColor: M.subtle, color: M.ink, fontWeight: 700, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none' }}>
                Start free trial
              </Button>
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* Tier cards */}
      <Box sx={{ py: { xs: 6, md: 10 }, bgcolor: M.card, mt: -2 }}>
        <Container maxWidth="lg">
          <Grid container spacing={3} alignItems="stretch">
            {tiers.map((tier) => (
              <Grid item xs={12} md={4} key={tier.name}>
                <Box sx={{
                  p: 4, borderRadius: M.r.lg, height: '100%', display: 'flex', flexDirection: 'column',
                  border: tier.highlight ? `2px solid ${tier.color}` : `1px solid ${M.faint}`,
                  bgcolor: tier.highlight ? `${tier.color}06` : M.paper,
                  position: 'relative',
                  transition: 'all 0.25s',
                  '&:hover': { boxShadow: M.shadow.md, transform: 'translateY(-2px)' },
                }}>
                  {tier.badge && (
                    <Chip label={tier.badge} size="small" sx={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', bgcolor: tier.color, color: 'white', fontWeight: 700, fontSize: '0.7rem' }} />
                  )}
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                    <Box sx={{ width: 40, height: 40, borderRadius: M.r.md, bgcolor: `${tier.color}12`, display: 'grid', placeItems: 'center' }}>
                      <tier.icon sx={{ color: tier.color, fontSize: 20 }} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>{tier.name}</Typography>
                      <Typography sx={{ color: M.muted, fontSize: '0.78rem' }}>{tier.subtitle}</Typography>
                    </Box>
                  </Stack>
                  <Box sx={{ mb: 3 }}>
                    <Typography sx={{ fontSize: '2rem', fontWeight: 900, color: tier.color }}>{tier.price}</Typography>
                    <Typography sx={{ color: M.muted, fontSize: '0.82rem' }}>{tier.period}</Typography>
                  </Box>
                  <Divider sx={{ mb: 3 }} />
                  <Stack spacing={1.5} sx={{ flex: 1 }}>
                    {tier.features.map((f) => (
                      <Stack key={f} direction="row" spacing={1.5} alignItems="center">
                        <Check sx={{ color: tier.color, fontSize: 16 }} />
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
                      mt: 3, py: 1.5, fontWeight: 700, textTransform: 'none', borderRadius: M.r.md,
                      bgcolor: tier.highlight ? tier.color : 'transparent',
                      color: tier.highlight ? 'white' : tier.color,
                      borderColor: tier.color,
                      '&:hover': { bgcolor: tier.highlight ? tier.color : `${tier.color}08` },
                    }}
                  >
                    {tier.price === 'Custom' ? 'Contact sales' : 'Start free trial'}
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
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography sx={{ fontSize: M.h2.size, fontWeight: M.h2.weight, letterSpacing: M.h2.tracking, mb: 2 }}>
              Compare plans in detail
            </Typography>
          </Box>
          <Box sx={{ overflowX: 'auto' }}>
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <Box component="thead">
                <Box component="tr">
                  <Box component="th" sx={{ textAlign: 'left', py: 2, px: 2, borderBottom: `2px solid ${M.faint}`, fontWeight: 700, fontSize: '0.85rem' }}>Feature</Box>
                  {tiers.map(t => (
                    <Box key={t.name} component="th" sx={{ textAlign: 'center', py: 2, px: 2, borderBottom: `2px solid ${t.color}`, fontWeight: 700, fontSize: '0.85rem', color: t.color }}>{t.name}</Box>
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
                  { feature: 'SLA guarantees', essential: false, professional: false, enterprise: true },
                ].map((row) => (
                  <Box key={row.feature} component="tr" sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                    <Box component="td" sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${M.faint}`, fontSize: '0.88rem' }}>{row.feature}</Box>
                    {[row.essential, row.professional, row.enterprise].map((val, j) => (
                      <Box key={j} component="td" sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${M.faint}`, textAlign: 'center' }}>
                        {val ? (
                          <Check sx={{ color: '#22C55E', fontSize: 18 }} />
                        ) : (
                          <Typography sx={{ color: '#D1D5DB', fontSize: '0.8rem' }}>—</Typography>
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
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.card }}>
        <Container maxWidth="md">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography sx={{ fontSize: M.h2.size, fontWeight: M.h2.weight, letterSpacing: M.h2.tracking, mb: 2 }}>
              Frequently asked questions
            </Typography>
          </Box>
          <Stack spacing={3}>
            {faqs.map((faq) => (
              <Box key={faq.q} sx={{ p: 3, bgcolor: M.paper, borderRadius: M.r.md, border: `1px solid ${M.faint}` }}>
                <Typography sx={{ fontWeight: 700, mb: 1 }}>{faq.q}</Typography>
                <Typography sx={{ color: M.slate, lineHeight: 1.7 }}>{faq.a}</Typography>
              </Box>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* CTA */}
      <Box sx={{ py: { xs: 10, md: 14 }, background: `linear-gradient(160deg, ${M.navy} 0%, #162032 50%, #1A2744 100%)`, textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography sx={{ fontSize: M.h1.size, lineHeight: M.h1.height, fontWeight: M.h1.weight, letterSpacing: M.h1.tracking, color: M.card, mb: 2 }}>
            Ready to get started?
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: M.bodyLg.size, mb: 4, maxWidth: 500, mx: 'auto' }}>
            Book a demo to see MeticleCare in action, or start your free trial today.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.teal, color: M.navy, fontWeight: 700, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', '&:hover': { bgcolor: M.tealDark } }}>
              Book a demo
            </Button>
            <Button variant="outlined" onClick={() => nav('/contact')} sx={{ borderColor: 'rgba(255,255,255,0.3)', color: 'white', fontWeight: 700, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none' }}>
              Start free trial
            </Button>
          </Stack>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
