import { Fragment, useState } from 'react'
import {
  Container, Typography, Grid, Box, Button, Stack, Divider,
  Table, TableBody, TableCell, TableHead, TableRow,
  Collapse, IconButton,
} from '@mui/material'
import {
  ArrowForward as ArrowForwardIcon,
  Add as PlusIcon,
  Remove as MinusIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'
import {
  ShieldIcon, AuditIcon, DsptIcon, TrainingIcon, ChatIcon,
  ManagerIcon, CareWorkerIcon, FamilyIcon, OwnerIcon,
  EmarIcon, RotaIcon, IncidentIcon, SurveyIcon, PolicyIcon,
} from '../../components/marketing/icons'

// Brand tokens — keep aligned with LandingPage.tsx so restyling cascades.
const INK = '#1B2430'
const INK_DARK = '#141C24'
const NAVY = '#0F4C81'
const NAVY_DEEP = '#0A3A63'
const EMERALD = '#10B981'
const EMERALD_DEEP = '#047857'
const BONE = '#F7F4EE'
const MIST = '#5B6672'
const HAIRLINE = '#E7E1D6'

interface Tier {
  id: 'essential' | 'service' | 'multi'
  name: string
  tagline: string
  monthly: number | null
  blurb: string
  capacity: string
  perResident: string
  bestFor: string
  highlights: string[]
  popular?: boolean
  cta: { label: string; to: string; variant: 'contained' | 'outlined' }
}

const TIERS: Tier[] = [
  {
    id: 'essential',
    name: 'Essential',
    tagline: 'For sole traders and small supported-living services',
    monthly: 99,
    blurb: 'Digitise daily notes, eMAR and basic compliance for one location with up to 25 staff.',
    capacity: 'Up to 25 staff · 15 people supported',
    perResident: '+ £4.50 / person / month above 15',
    bestFor: 'Single-location supported-living services, owner-managed.',
    highlights: [
      'Care notes, eMAR and daily records',
      'Person-centred support plans & goals',
      'Standard reporting & audit log',
      'Family Portal for relatives',
      'UK GDPR + DPA 2018 compliant hosting',
      'Email support, 1 business-day SLA',
    ],
    cta: { label: 'Start 14-day free trial', to: '/register', variant: 'outlined' },
  },
  {
    id: 'service',
    name: 'Care Service',
    tagline: 'For established supported-living services and multi-site groups',
    monthly: 299,
    popular: true,
    blurb: 'Run rotas, incidents, training and live compliance across a single care service or agency.',
    capacity: 'Up to 100 staff · 200 people supported',
    perResident: '+ £3.50 / person / month above 200',
    bestFor: 'Established supported-living services, single-service groups, agencies.',
    highlights: [
      'Everything in Essential',
      'Rota planner with safe-staffing rules',
      'Incidents, safeguarding & action tracking',
      'Live CQC-domain readiness score',
      'Evidence packs (KLOE-aligned)',
      'Apprenticeship & training matrix',
      'Priority phone support, 4-hour SLA',
    ],
    cta: { label: 'Start 14-day free trial', to: '/register', variant: 'contained' },
  },
  {
    id: 'multi',
    name: 'Multi-Site',
    tagline: 'For groups, franchises and local authorities',
    monthly: null,
    blurb: 'One roll-up across services, with dedicated success, SSO, custom integrations and on-site training.',
    capacity: 'Unlimited staff · unlimited locations',
    perResident: 'Volume rebate from 500 people supported',
    bestFor: 'Multi-service groups, franchises, local authority frameworks.',
    highlights: [
      'Everything in Care Service',
      'Multi-location oversight & roll-up reporting',
      'Single Sign-On (SAML / OIDC), custom domain',
      'Custom API & webhooks',
      'Dedicated success manager',
      'On-site training and quarterly review',
      '99.95% uptime SLA, named on-call',
    ],
    cta: { label: 'Talk to our team', to: '/contact', variant: 'contained' },
  },
]

interface Capability {
  group: string
  rows: { label: string; essential: string | boolean; service: string | boolean; multi: string | boolean; icon?: React.ComponentType<{ size?: number }> }[]
}

const COMPARISON: Capability[] = [
  {
    group: 'Care & medication',
    rows: [
      { label: 'Daily care notes & recordings', essential: true, service: true, multi: true, icon: ChatIcon },
      { label: 'eMAR with 31-day chart, stock & PRN', essential: true, service: true, multi: true, icon: EmarIcon },
      { label: 'Person-centred support plans + goals', essential: true, service: true, multi: true },
      { label: 'Body mapping & observations', essential: true, service: true, multi: true },
      { label: 'Appointments & reviews', essential: true, service: true, multi: true },
    ],
  },
  {
    group: 'People & operations',
    rows: [
      { label: 'Staff profiles, qualifications, expiry', essential: true, service: true, multi: true, icon: TrainingIcon },
      { label: 'Rota planner with safe-staffing rules', essential: false, service: true, multi: true, icon: RotaIcon },
      { label: 'Holiday, absence & delegation', essential: false, service: true, multi: true },
      { label: 'Incidents, safeguarding & actions', essential: false, service: true, multi: true, icon: IncidentIcon },
      { label: 'Secure team messaging', essential: true, service: true, multi: true },
      { label: 'Shift marketplace for open shifts', essential: false, service: true, multi: true },
    ],
  },
  {
    group: 'Compliance & oversight',
    rows: [
      { label: 'Audit log on every action', essential: true, service: true, multi: true, icon: AuditIcon },
      { label: 'Live CQC-domain readiness score', essential: false, service: true, multi: true, icon: ShieldIcon },
      { label: 'Evidence packs (KLOE-aligned)', essential: false, service: true, multi: true },
      { label: 'DSPT self-assessment & submission', essential: false, service: true, multi: true, icon: DsptIcon },
      { label: 'Surveys (Caring & Well-led domains)', essential: false, service: true, multi: true, icon: SurveyIcon },
      { label: 'Policies & procedures, versioned', essential: false, service: true, multi: true, icon: PolicyIcon },
    ],
  },
  {
    group: 'Multi-location & integration',
    rows: [
      { label: 'Locations supported', essential: '1', service: '1', multi: 'Unlimited' },
      { label: 'Single Sign-On (SAML / OIDC)', essential: false, service: false, multi: true },
      { label: 'Custom domain', essential: false, service: false, multi: true },
      { label: 'Public API & webhooks', essential: false, service: 'Read-only', multi: 'Read & write' },
      { label: 'Real DBS provider integration', essential: 'Add-on', service: 'Add-on', multi: 'Included' },
    ],
  },
  {
    group: 'Support & service',
    rows: [
      { label: 'Support channel', essential: 'Email', service: 'Phone + Email', multi: 'Named CSM' },
      { label: 'First-response SLA', essential: '1 business day', service: '4 hours', multi: '1 hour' },
      { label: 'Uptime SLA', essential: '99.5%', service: '99.9%', multi: '99.95%' },
      { label: 'On-site training', essential: false, service: false, multi: true },
    ],
  },
]

const ADDONS: { name: string; who: string; price: string; desc: string }[] = [
  {
    name: 'Real DBS provider integration',
    who: 'Essential & Care Service',
    price: '£39 / mo',
    desc: 'Live DBS status, expiry alerts and re-check reminders via our partner provider — no manual re-keying.',
  },
  {
    name: 'Bespoke e-parental consent & e-signature',
    who: 'All plans',
    price: '+ £1.50 / consent',
    desc: 'Audit-trailed e-signature flows for support plans, consent-to-share and risk assessments.',
  },
  {
    name: 'Twilio SMS alerts',
    who: 'All plans',
    price: '£0.04 / SMS',
    desc: 'SMS fallback for urgent notifications when a relative has no app installed.',
  },
]

const FAQ = [
  {
    q: 'Is there a free trial?',
    a: 'Every plan starts with a 14-day free trial of the full Care Service tier — no credit card required, no auto-charge. You can downgrade or cancel from settings at any point during or after the trial.',
  },
  {
    q: 'How are "people supported" counted?',
    a: 'We count active people on the platform at the start of each billing period. A person becomes active when their first care note, support plan, or eMAR record is created, and inactive after 90 days of no activity. Family-portal accounts for relatives and next-of-kin are always free, regardless of how many people supported.',
  },
  {
    q: 'Can we upgrade or downgrade mid-contract?',
    a: 'Yes. Upgrades take effect immediately and are pro-rated to the day. Downgrades take effect at the next billing date and we recalculate any per-active-person charge then. No fees or penalties for changing tiers.',
  },
  {
    q: 'What happens to our data if we cancel?',
    a: 'You keep full read access to historical records for 90 days after cancellation, including all audit trails and signed PDFs. After 90 days, your tenant data is permanently deleted in line with our DPA 2018 agreement; we provide a written certificate of deletion on request.',
  },
  {
    q: 'Do you offer non-profit or local-authority pricing?',
    a: 'Yes. Local authorities, NHS trusts, registered charities and Section 1(1) of the Health and Social Care Act 2008 bodies receive 15% off list price across all plans. Contact our team with your organisation details for a tailored quote.',
  },
  {
    q: 'How does this interact with CQC, CIW, CIS and RQIA?',
    a: 'MeticleCare supports all four UK care regulators and produces inspection-ready evidence packs aligned to the CQC single assessment framework, CIW and Care Inspectorate quality frameworks. The same readiness score, audit log and KLOE evidence packs apply — there is no per-regulator surcharge.',
  },
  {
    q: 'Where is data hosted? Is it UK-only?',
    a: 'All production data is hosted in UK-only data centres (London and Manchester AWS regions) with no cross-border replication. We are UK GDPR compliant, hold an up-to-date DSPT submission, and can sign data-processing agreements aligned with NHS DSPT standards.',
  },
  {
    q: 'Can families, local-authority commissioners and GPs see what our team records?',
    a: 'Yes — you control exactly what each external audience can see. The Family Portal is read-only for relatives by default; commissioners can be given scoped dashboards; and you can share signed PDFs of specific care plans, risk assessments or audits by link with a full access log.',
  },
]

function MonYearToggle({ value, onChange }: { value: 'monthly' | 'annual'; onChange: (v: 'monthly' | 'annual') => void }) {
  return (
    <Box
      role="tablist"
      aria-label="Billing frequency"
      sx={{
        display: 'inline-flex', p: 0.5, bgcolor: BONE, borderRadius: 999,
        border: `1px solid ${HAIRLINE}`,
      }}
    >
      {(['monthly', 'annual'] as const).map((v) => {
        const active = value === v
        return (
          <Box
            key={v}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(v)}
            sx={{
              cursor: 'pointer',
              px: 3, py: 1.25, borderRadius: 999,
              fontWeight: 800, fontSize: '0.85rem',
              color: active ? '#FFFFFF' : INK,
              bgcolor: active ? NAVY : 'transparent',
              transition: 'background-color 0.15s ease, color 0.15s ease',
              display: 'flex', alignItems: 'center', gap: 1.25,
            }}
          >
            {v === 'monthly' ? 'Monthly' : 'Annual'}
            {v === 'annual' && (
              <Box
                sx={{
                  bgcolor: EMERALD, color: '#FFFFFF',
                  px: 1, py: 0.25, borderRadius: 1, fontSize: '0.65rem',
                  fontWeight: 900, letterSpacing: '0.04em',
                }}
              >
                SAVE 2 MONTHS
              </Box>
            )}
          </Box>
        )
      })}
    </Box>
  )
}

function TierCard({ tier, billing }: { tier: Tier; billing: 'monthly' | 'annual' }) {
  const showAnnual = billing === 'annual' && tier.monthly !== null
  const annualPrice = tier.monthly !== null ? Math.round(tier.monthly * 10 * 12) / 100 : null
  return (
    <Box
      sx={{
        position: 'relative',
        bgcolor: '#FFFFFF',
        border: tier.popular ? `2px solid ${NAVY}` : `1px solid ${HAIRLINE}`,
        borderRadius: 3,
        p: { xs: 4, md: 5 },
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: tier.popular ? '0 24px 48px -28px rgba(15,76,129,0.45)' : 'none',
        transition: 'border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease',
        '&:hover': {
          transform: tier.popular ? 'translateY(-2px)' : 'translateY(-1px)',
          borderColor: tier.popular ? NAVY_DEEP : EMERALD,
        },
      }}
    >
      {tier.popular && (
        <Box
          sx={{
            position: 'absolute',
            top: 0, left: '50%',
            transform: 'translate(-50%, -50%)',
            bgcolor: NAVY, color: '#FFFFFF',
            px: 2, py: 0.5, borderRadius: 999,
            fontSize: '0.7rem', fontWeight: 900,
            letterSpacing: '0.12em',
          }}
        >
          MOST POPULAR
        </Box>
      )}

      <Stack spacing={1}>
        <Typography
          sx={{
            color: NAVY, fontWeight: 900, fontSize: '0.78rem',
            letterSpacing: '0.12em', textTransform: 'uppercase',
          }}
        >
          {tier.name}
        </Typography>
        <Typography sx={{ fontWeight: 700, color: INK, fontSize: '0.92rem' }}>
          {tier.tagline}
        </Typography>
      </Stack>

      <Box sx={{ mt: 3.5, mb: 1 }}>
        {tier.monthly === null ? (
          <Stack direction="row" spacing={1} alignItems="baseline">
            <Typography sx={{ fontWeight: 900, color: INK, fontSize: '2.4rem', lineHeight: 1, letterSpacing: '-0.02em' }}>
              Custom
            </Typography>
          </Stack>
        ) : (
          <Stack direction="row" spacing={1.25} alignItems="baseline">
            <Typography sx={{ fontWeight: 900, color: INK, fontSize: '2.6rem', lineHeight: 1, letterSpacing: '-0.025em' }}>
              £
            </Typography>
            <Typography sx={{ fontWeight: 900, color: INK, fontSize: '2.6rem', lineHeight: 1, letterSpacing: '-0.025em' }}>
              {showAnnual ? String(annualPrice).replace(/^0+/, '') : tier.monthly}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              <Typography sx={{ color: MIST, fontSize: '0.85rem', fontWeight: 700, lineHeight: 1 }}>
                / month
              </Typography>
              {showAnnual && (
                <Typography sx={{ color: EMERALD_DEEP, fontSize: '0.7rem', fontWeight: 800, lineHeight: 1 }}>
                  billed annually
                </Typography>
              )}
            </Box>
          </Stack>
        )}
        <Typography sx={{ color: NAVY, fontWeight: 800, fontSize: '0.85rem', mt: 1 }}>
          {tier.capacity}
        </Typography>
        <Typography sx={{ color: MIST, fontSize: '0.8rem', mt: 0.35 }}>
          {tier.perResident}
        </Typography>
      </Box>

      <Typography sx={{ color: MIST, fontSize: '0.88rem', lineHeight: 1.55, mt: 2 }}>
        {tier.blurb}
      </Typography>

      <Divider sx={{ my: 3, borderColor: HAIRLINE }} />

      <Stack spacing={1.1}>
        {tier.highlights.map((h) => (
          <Stack key={h} direction="row" spacing={1.25} alignItems="flex-start">
            <CheckIcon sx={{ color: EMERALD, fontSize: 18, mt: 0.25, flexShrink: 0 }} />
            <Typography sx={{ color: INK, fontSize: '0.88rem', fontWeight: 500, lineHeight: 1.55 }}>
              {h}
            </Typography>
          </Stack>
        ))}
      </Stack>

      <Box sx={{ mt: 'auto', pt: 4 }}>
        <Button
          variant={tier.cta.variant}
          fullWidth
          size="large"
          endIcon={<ArrowForwardIcon />}
          onClick={() => { window.location.href = tier.cta.to }}
          sx={{
            fontWeight: 800, py: 1.5, fontSize: '0.95rem',
            bgcolor: tier.cta.variant === 'contained' ? (tier.popular ? NAVY : EMERALD_DEEP) : 'transparent',
            color: tier.cta.variant === 'contained' ? '#FFFFFF' : INK,
            borderColor: tier.cta.variant === 'contained' ? 'transparent' : HAIRLINE,
            '&:hover': {
              bgcolor: tier.cta.variant === 'contained' ? (tier.popular ? NAVY_DEEP : '#065F46') : 'rgba(15,76,129,0.06)',
              borderColor: tier.cta.variant === 'outlined' ? INK : undefined,
            },
          }}
        >
          {tier.cta.label}
        </Button>
        <Typography sx={{ color: MIST, fontSize: '0.75rem', fontWeight: 600, mt: 1.5, textAlign: 'center' }}>
          No credit card required
        </Typography>
      </Box>
    </Box>
  )
}

function CapacityMeter() {
  const rows: { label: string; essential: string; service: string; multi: string; tone?: 'base' | 'plus' }[] = [
    { label: 'Active people supported', essential: 'up to 15', service: 'up to 200', multi: 'Unlimited', tone: 'base' },
    { label: 'Above the included tier', essential: '+ £4.50 / person / mo', service: '+ £3.50 / person / mo', multi: 'volume rebate from 500', tone: 'plus' },
    { label: 'Staff (active logins)', essential: 'up to 25', service: 'up to 100', multi: 'Unlimited', tone: 'base' },
    { label: 'Care locations', essential: '1', service: '1', multi: 'Unlimited', tone: 'base' },
    { label: 'Family Portal — relatives', essential: 'Always free', service: 'Always free', multi: 'Always free' },
  ]
  return (
    <Box
      sx={{
        bgcolor: BONE, mt: 6, p: { xs: 3, md: 4 },
        borderRadius: 3, border: `1px solid ${HAIRLINE}`,
      }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 2, md: 3 }} alignItems={{ md: 'center' }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 900, color: INK, fontSize: '1.05rem', mb: 0.5 }}>
            Capacity that scales with your service
          </Typography>
          <Typography sx={{ color: MIST, fontSize: '0.9rem', lineHeight: 1.6 }}>
            Each plan includes capacity out of the box. If your service grows, additional people supported are billed at low flat rates — never per-record.
          </Typography>
        </Box>
        <Grid container spacing={1.5} sx={{ flex: 1.4 }}>
          {rows.map((r) => (
            <Grid item xs={12} sm={6} md={4} key={r.label}>
              <Box sx={{ p: 1.5, bgcolor: '#FFFFFF', borderRadius: 2, border: `1px solid ${HAIRLINE}`, height: '100%' }}>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: MIST, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {r.label}
                </Typography>
                <Stack direction="row" spacing={1.25} alignItems="baseline" sx={{ mt: 0.5 }}>
                  <Typography sx={{ fontWeight: 800, color: r.tone === 'plus' ? EMERALD_DEEP : INK, fontSize: '0.85rem' }}>
                    Essential:
                  </Typography>
                  <Typography sx={{ color: INK, fontSize: '0.85rem', fontWeight: 600 }}>{r.essential}</Typography>
                </Stack>
                <Stack direction="row" spacing={1.25} alignItems="baseline">
                  <Typography sx={{ fontWeight: 800, color: r.tone === 'plus' ? EMERALD_DEEP : NAVY, fontSize: '0.85rem' }}>
                    Care Service:
                  </Typography>
                  <Typography sx={{ color: INK, fontSize: '0.85rem', fontWeight: 600 }}>{r.service}</Typography>
                </Stack>
                <Stack direction="row" spacing={1.25} alignItems="baseline">
                  <Typography sx={{ fontWeight: 800, color: r.tone === 'plus' ? EMERALD_DEEP : NAVY_DEEP, fontSize: '0.85rem' }}>
                    Multi-Site:
                  </Typography>
                  <Typography sx={{ color: INK, fontSize: '0.85rem', fontWeight: 600 }}>{r.multi}</Typography>
                </Stack>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Stack>
    </Box>
  )
}

function ComparisonRow({ row }: { row: Capability['rows'][number] }) {
  const Icon = row.icon
  return (
    <TableRow sx={{ '& td': { borderBottom: `1px solid ${HAIRLINE}` } }}>
      <TableCell sx={{ py: 1.6, pl: { xs: 1, md: 2.5 }, pr: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          {Icon && (
            <Box sx={{ color: NAVY, display: 'flex', flexShrink: 0 }}>
              <Icon size={18} />
            </Box>
          )}
          <Typography sx={{ color: INK, fontWeight: 600, fontSize: '0.9rem' }}>{row.label}</Typography>
        </Stack>
      </TableCell>
      <TableCell align="center" sx={{ py: 1.6, width: { md: 120 } }}>
        <CellValue value={row.essential} />
      </TableCell>
      <TableCell align="center" sx={{ py: 1.6, width: { md: 140 }, bgcolor: { md: 'rgba(15,76,129,0.04)' } }}>
        <CellValue value={row.service} />
      </TableCell>
      <TableCell align="center" sx={{ py: 1.6, width: { md: 140 } }}>
        <CellValue value={row.multi} />
      </TableCell>
    </TableRow>
  )
}

function CellValue({ value }: { value: string | boolean }) {
  if (value === true) {
    return <CheckIcon sx={{ color: EMERALD, fontSize: 20 }} aria-label="Included" />
  }
  if (value === false) {
    return <Typography sx={{ color: MIST, fontSize: '1.1rem' }} aria-label="Not included">—</Typography>
  }
  return (
    <Typography sx={{ color: INK, fontSize: '0.85rem', fontWeight: 700 }}>{value}</Typography>
  )
}

function FaqItem({ q, a, defaultOpen }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <Box
      sx={{
        borderTop: `1px solid ${HAIRLINE}`,
        '&:last-of-type': { borderBottom: `1px solid ${HAIRLINE}` },
      }}
    >
      <Box
        component="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        sx={{
          all: 'unset',
          cursor: 'pointer',
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          py: { xs: 2.5, md: 3 }, pr: 2,
        }}
      >
        <Typography sx={{ fontWeight: 800, color: INK, fontSize: { xs: '1rem', md: '1.05rem' }, lineHeight: 1.4 }}>
          {q}
        </Typography>
        <IconButton
          component="span"
          size="small"
          sx={{ color: NAVY, ml: 2 }}
          aria-hidden
        >
          {open ? <MinusIcon /> : <PlusIcon />}
        </IconButton>
      </Box>
      <Collapse in={open} unmountOnExit>
        <Typography sx={{ color: MIST, fontSize: '0.95rem', lineHeight: 1.7, pb: { xs: 2.5, md: 3 }, pr: { xs: 0, md: 6 }, maxWidth: 820 }}>
          {a}
        </Typography>
      </Collapse>
    </Box>
  )
}

export default function PricingPage() {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual')
  const navigate = useNavigate()

  return (
    <MarketingLayout>
      <PageMeta
        title="Pricing | MeticleCare"
        description="MeticleCare pricing for UK care providers. Three plans from £99 / month — Essential, Care Service and Multi-Site. 14-day free trial, no credit card required."
        canonicalPath="/pricing"
      />

      {/* HERO + TRIAL BANNER */}
      <Box component="section" sx={{ bgcolor: BONE, pt: { xs: 8, md: 11 }, pb: { xs: 8, md: 10 }, borderBottom: `1px solid ${HAIRLINE}` }}>
        <Container maxWidth="lg">
          <Stack spacing={3} alignItems="center" sx={{ textAlign: 'center' }}>
            <Box
              sx={{
                bgcolor: '#FFFFFF', border: `1px solid ${HAIRLINE}`, borderRadius: 999,
                px: 2, py: 0.75, display: 'inline-flex', alignItems: 'center', gap: 1.25,
              }}
            >
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: EMERALD }} />
              <Typography sx={{ fontWeight: 800, color: NAVY, fontSize: '0.75rem', letterSpacing: '0.1em' }}>
                14-DAY FREE TRIAL · NO CREDIT CARD
              </Typography>
            </Box>
            <Typography variant="h1" sx={{ fontSize: { xs: '2.4rem', md: '3.4rem' }, fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.03em', color: INK, maxWidth: 820 }}>
              Pricing that scales with the people you support.
            </Typography>
            <Typography sx={{ color: MIST, fontSize: { xs: '1rem', md: '1.15rem' }, lineHeight: 1.7, maxWidth: 700 }}>
              Three plans built for UK supported-living providers. Start on any tier — switch up, down or cancel anytime. Family Portal is always free, and data lives only in UK data centres.
            </Typography>
            <Box sx={{ pt: 1 }}>
              <MonYearToggle value={billing} onChange={setBilling} />
            </Box>
          </Stack>
        </Container>
      </Box>

      {/* TIER CARDS */}
      <Box component="section" sx={{ bgcolor: '#FFFFFF', py: { xs: 8, md: 11 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 3, md: 4 }} alignItems="stretch">
            {TIERS.map((tier) => (
              <Grid item xs={12} md={4} key={tier.id}>
                <TierCard tier={tier} billing={billing} />
              </Grid>
            ))}
          </Grid>
          <CapacityMeter />
        </Container>
      </Box>

      {/* COMPARISON TABLE */}
      <Box component="section" sx={{ bgcolor: BONE, py: { xs: 9, md: 13 } }}>
        <Container maxWidth="lg">
          <Stack spacing={{ xs: 3, md: 5 }} sx={{ mb: { xs: 5, md: 7 }, maxWidth: 720 }}>
            <Typography
              variant="h2"
              sx={{ fontSize: { xs: '2rem', md: '2.6rem' }, fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.025em', color: INK }}
            >
              What's in every plan.
            </Typography>
            <Typography sx={{ color: MIST, fontSize: '1.05rem' }}>
              Some things should be obvious from a comparison table, not buried in a brochure. The grid below shows what each tier includes — and where the differences are.
            </Typography>
          </Stack>

          <Box
            sx={{
              bgcolor: '#FFFFFF', border: `1px solid ${HAIRLINE}`, borderRadius: 3, overflow: 'hidden',
            }}
          >
            <Box sx={{ overflowX: 'auto' }}>
              <Table sx={{ minWidth: 720 }}>
                <caption style={{ position: 'absolute', left: -9999 }}>
                  Feature comparison between Essential, Care Service and Multi-Site plans.
                </caption>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ pt: 3, pb: 2, pl: { xs: 1, md: 2.5 }, pr: 2, borderBottom: `1px solid ${HAIRLINE}`, width: '40%' }}>
                      <Typography sx={{ fontWeight: 900, color: INK, fontSize: '0.95rem' }}>Capability</Typography>
                    </TableCell>
                    <TableCell align="center" sx={{ pt: 3, pb: 2, borderBottom: `1px solid ${HAIRLINE}` }}>
                      <Typography sx={{ fontWeight: 900, color: INK, fontSize: '0.85rem' }}>Essential</Typography>
                      <Typography sx={{ color: MIST, fontSize: '0.72rem' }}>£99 / mo</Typography>
                    </TableCell>
                    <TableCell align="center" sx={{ pt: 3, pb: 2, borderBottom: `1px solid ${HAIRLINE}`, bgcolor: { md: 'rgba(15,76,129,0.04)' } }}>
                      <Stack alignItems="center" spacing={0.25}>
                        <Typography sx={{ fontWeight: 900, color: NAVY, fontSize: '0.85rem' }}>Care Service</Typography>
                        <Typography sx={{ color: MIST, fontSize: '0.72rem' }}>£299 / mo</Typography>
                        <Box sx={{ bgcolor: NAVY, color: '#FFFFFF', px: 1, py: 0.25, borderRadius: 0.75, fontSize: '0.6rem', fontWeight: 900, letterSpacing: '0.1em' }}>
                          POPULAR
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell align="center" sx={{ pt: 3, pb: 2, borderBottom: `1px solid ${HAIRLINE}` }}>
                      <Typography sx={{ fontWeight: 900, color: INK, fontSize: '0.85rem' }}>Multi-Site</Typography>
                      <Typography sx={{ color: MIST, fontSize: '0.72rem' }}>Custom</Typography>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {COMPARISON.map((group) => (
                    <Fragment key={group.group}>
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          sx={{
                            py: 1.5, pl: { xs: 1, md: 2.5 }, pr: 2,
                            borderBottom: `1px solid ${HAIRLINE}`,
                            bgcolor: 'rgba(15,76,129,0.06)',
                          }}
                        >
                          <Typography
                            sx={{
                              fontWeight: 900, color: NAVY, fontSize: '0.72rem',
                              letterSpacing: '0.1em', textTransform: 'uppercase',
                            }}
                          >
                            {group.group}
                          </Typography>
                        </TableCell>
                      </TableRow>
                      {group.rows.map((row) => (
                        <ComparisonRow key={row.label} row={row} />
                      ))}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* ADD-ONS */}
      <Box component="section" sx={{ bgcolor: '#FFFFFF', py: { xs: 9, md: 12 } }}>
        <Container maxWidth="lg">
          <Stack spacing={2} sx={{ maxWidth: 720, mb: { xs: 5, md: 7 } }}>
            <Typography
              variant="h2"
              sx={{ fontSize: { xs: '2rem', md: '2.4rem' }, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.02em', color: INK }}
            >
              Add-ons & integrations
            </Typography>
            <Typography sx={{ color: MIST, fontSize: '1rem' }}>
              Pick the extras you need, billed monthly or by use. Most services don't need them; they're here for the ones that do.
            </Typography>
          </Stack>
          <Grid container spacing={{ xs: 3, md: 3 }}>
            {ADDONS.map((a) => (
              <Grid item xs={12} md={4} key={a.name}>
                <Box
                  sx={{
                    height: '100%',
                    bgcolor: BONE, border: `1px solid ${HAIRLINE}`,
                    borderRadius: 3, p: { xs: 3, md: 4 },
                    transition: 'border-color 0.15s ease',
                    '&:hover': { borderColor: EMERALD },
                  }}
                >
                  <Typography sx={{ fontWeight: 900, color: INK, fontSize: '1.05rem', mb: 0.75 }}>{a.name}</Typography>
                  <Stack direction="row" spacing={1.25} alignItems="baseline" sx={{ mb: 2 }}>
                    <Typography sx={{ fontWeight: 900, color: NAVY, fontSize: '1.15rem' }}>{a.price}</Typography>
                    <Typography sx={{ color: MIST, fontSize: '0.8rem', fontWeight: 600 }}>· {a.who}</Typography>
                  </Stack>
                  <Typography sx={{ color: MIST, fontSize: '0.9rem', lineHeight: 1.6 }}>{a.desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* TRUST STRIP */}
      <Box
        component="section"
        aria-label="Standards MeticleCare is built for"
        sx={{ bgcolor: '#FFFFFF', borderTop: `1px solid ${HAIRLINE}`, borderBottom: `1px solid ${HAIRLINE}`, py: { xs: 5, md: 6 } }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 3, md: 4 }} alignItems="center">
            <Grid item xs={12} md={3}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: NAVY, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                Built for the UK's care regulators
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

      {/* ROLE SNAPSHOT */}
      <Box component="section" sx={{ bgcolor: BONE, py: { xs: 8, md: 11 } }}>
        <Container maxWidth="lg">
          <Stack spacing={1.5} sx={{ maxWidth: 720, mb: { xs: 4, md: 6 } }}>
            <Typography
              variant="h2"
              sx={{ fontSize: { xs: '1.8rem', md: '2.2rem' }, fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em', color: INK }}
            >
              What every role in your service gets.
            </Typography>
            <Typography sx={{ color: MIST, fontSize: '1rem' }}>
              MeticleCare is shaped for each part of the day, so the time spent in front of the screen never feels like the work.
            </Typography>
          </Stack>
          <Grid container spacing={{ xs: 2, md: 3 }}>
            {[
              { role: 'Registered managers', desc: 'See readiness before the inspector does.', Icon: ManagerIcon, bullets: ['Compliance snapshot & inspection readiness', 'Rota planner with safe-staffing rules', 'Leave approvals with delegation', 'Reporting you can act on'] },
              { role: 'Care workers', desc: 'The whole shift, in your pocket.', Icon: CareWorkerIcon, bullets: ['Mobile app with GPS check-in', 'eMAR rounds on the 31-day chart', 'Claim open shifts', 'Secure team messaging'] },
              { role: 'Relatives & families', desc: 'A quiet window into daily life.', Icon: FamilyIcon, bullets: ['Read-only Family Portal', 'Care notes & observations', 'Direct line to the team'] },
              { role: 'Owners & ops leads', desc: 'Every home, every number, one view.', Icon: OwnerIcon, bullets: ['Multi-location roll-up', 'Insights across services', 'Billing & subscription oversight'] },
            ].map((r) => (
              <Grid item xs={12} sm={6} md={3} key={r.role}>
                <Box
                  sx={{
                    height: '100%',
                    bgcolor: '#FFFFFF', border: `1px solid ${HAIRLINE}`,
                    borderRadius: 3, p: { xs: 2.5, md: 3 },
                  }}
                >
                  <Box
                    sx={{
                      width: 40, height: 40, borderRadius: 1.5,
                      bgcolor: 'rgba(15,76,129,0.08)', color: NAVY,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2,
                    }}
                  >
                    <r.Icon size={20} />
                  </Box>
                  <Typography sx={{ fontWeight: 800, color: INK, fontSize: '1rem', mb: 0.5 }}>{r.role}</Typography>
                  <Typography sx={{ color: NAVY, fontWeight: 600, fontSize: '0.82rem', mb: 1.75 }}>{r.desc}</Typography>
                  <Stack spacing={0.85}>
                    {r.bullets.map((b) => (
                      <Stack key={b} direction="row" spacing={1} alignItems="flex-start">
                        <Box sx={{ width: 5, height: 5, borderRadius: 1, bgcolor: EMERALD, mt: 0.55, flexShrink: 0 }} />
                        <Typography sx={{ color: '#3A4551', fontSize: '0.82rem', fontWeight: 500, lineHeight: 1.55 }}>{b}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* FAQ */}
      <Box component="section" sx={{ bgcolor: '#FFFFFF', py: { xs: 9, md: 13 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 5, md: 8 }}>
            <Grid item xs={12} md={4}>
              <Stack spacing={2} sx={{ position: { md: 'sticky' }, top: 96 }}>
                <Typography
                  variant="h2"
                  sx={{ fontSize: { xs: '2rem', md: '2.4rem' }, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.02em', color: INK }}
                >
                  Pricing questions, answered.
                </Typography>
                <Typography sx={{ color: MIST, fontSize: '1rem', lineHeight: 1.7 }}>
                  The honest answers come up most often. If yours isn't here, our team replies same-day during UK office hours.
                </Typography>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ pt: 1 }}>
                  <Button
                    variant="contained"
                    onClick={() => navigate('/contact')}
                    endIcon={<ArrowForwardIcon />}
                    sx={{
                      bgcolor: NAVY, fontWeight: 800, '&:hover': { bgcolor: NAVY_DEEP },
                    }}
                  >
                    Ask our team
                  </Button>
                </Stack>
              </Stack>
            </Grid>
            <Grid item xs={12} md={8}>
              <Box>
                {FAQ.map((f, i) => (
                  <FaqItem key={f.q} q={f.q} a={f.a} defaultOpen={i === 0} />
                ))}
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* FINAL CTA */}
      <Box component="section" sx={{ py: { xs: 11, md: 15 }, bgcolor: INK_DARK, color: '#FFFFFF', textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography variant="h2" sx={{ fontSize: { xs: '2.1rem', md: '3rem' }, fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.03em', mb: 3, color: '#FFFFFF' }}>
            Try MeticleCare for 14 days, on us.
          </Typography>
          <Typography sx={{ opacity: 0.92, fontSize: '1.12rem', lineHeight: 1.7, mb: 5, maxWidth: 560, mx: 'auto' }}>
            Full Care Service functionality. No credit card. Migrate from any existing system for free in your first 30 days.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/register')}
              endIcon={<ArrowForwardIcon />}
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
          <Typography variant="body2" sx={{ opacity: 0.7, mt: 4, fontWeight: 600 }}>
            14-day free trial · No credit card required · UK-only data centres
          </Typography>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
