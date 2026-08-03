import { Fragment, useEffect, useRef, useState } from 'react'
import { Box, Button, Container, Grid, Stack, Typography } from '@mui/material'
import { ArrowForward as ArrowForwardIcon, Check as CheckIcon } from '@mui/icons-material'
import { keyframes } from '@emotion/react'
import { useNavigate } from 'react-router-dom'
import MarketingLayout from '../components/marketing/MarketingLayout'
import PageMeta from '../components/PageMeta'

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'MeticleCare',
      url: 'https://meticlecare.com',
      description: 'Care operations platform for UK supported living and domiciliary care providers.',
    },
    {
      '@type': 'SoftwareApplication',
      name: 'MeticleCare',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: 'Care management software combining care planning, staff rotas, medication records, compliance oversight, incident reporting and daily operations for UK care providers.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'GBP',
        description: '14-day free trial',
      },
    },
    {
      '@type': 'WebSite',
      name: 'MeticleCare',
      url: 'https://meticlecare.com',
    },
  ],
}

const INK = '#1B2430'
const NAVY = '#0F4C81'
const NAVY_DEEP = '#0A3A63'
const EMERALD = '#10B981'
const EMERALD_DEEP = '#047857'
const BONE = '#F7F4EE'
const MIST = '#5B6672'
const HAIRLINE = '#E7E1D6'
const INK_DARK = '#141C24'

const HERO_IMAGE = '/hero-care.jpg'

const pulse = keyframes`
  0%, 100% { opacity: 1 }
  50% { opacity: 0.35 }
`

function FadeSection({ children, direction = 'up', delay = 0, variant = 'slide' }: { children?: React.ReactNode; direction?: 'up' | 'down'; delay?: number; variant?: 'slide' | 'scale-slide' }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) { setVisible(true); return }
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.1, rootMargin: '0px 0px -30px 0px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const y = direction === 'up' ? 40 : -40
  const scaleIn = variant === 'scale-slide' ? ' scale(0.98)' : ''
  const scaleOut = variant === 'scale-slide' ? ' scale(1)' : ''
  return (
    <Box
      ref={ref}
      sx={{
        transform: visible ? `translateY(0)${scaleOut}` : `translateY(${y}px)${scaleIn}`,
        opacity: visible ? 1 : 0,
        transition: `transform ${variant === 'scale-slide' ? '0.85s' : '0.75s'} cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, opacity ${variant === 'scale-slide' ? '0.7s' : '0.65s'} ease ${delay}ms`,
      }}
    >
      {children}
    </Box>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  const [heroIn, setHeroIn] = useState(false)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setHeroIn(true)
      return
    }
    const t = window.setTimeout(() => setHeroIn(true), 80)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <MarketingLayout>
      <PageMeta
        title="Care Management Software for UK Care Providers | MeticleCare"
        description="MeticleCare brings care planning, staffing, compliance, medication, incidents and daily operations together in one connected platform for UK care providers. Start a free 14-day trial."
        canonicalPath="/"
        structuredData={structuredData}
      />
      {/* HERO */}
      <Box sx={{ bgcolor: BONE, pt: { xs: 7, md: 10 }, pb: { xs: 10, md: 14 }, borderBottom: `1px solid ${HAIRLINE}` }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 5, lg: 7 }} alignItems="center">
            <Grid item xs={12} lg={6}>
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: '2.4rem', sm: '3rem', md: '3.4rem' },
                  fontWeight: 900,
                  lineHeight: 1.06,
                  letterSpacing: '-0.03em',
                  color: INK,
                  mb: 3,
                  maxWidth: 560,
                }}
              >
                Run your care operations from one connected platform.
              </Typography>

              <Typography sx={{ color: MIST, fontSize: '1.12rem', lineHeight: 1.7, mb: 4, maxWidth: 520 }}>
                Care planning, medication, rotas and compliance in one place — built for supported living and domiciliary care teams across the UK.
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => navigate('/register')}
                  sx={{ bgcolor: NAVY, '&:hover': { bgcolor: NAVY_DEEP }, fontWeight: 800, px: { xs: 4, sm: 5 }, py: 1.75, fontSize: '1rem', transition: 'background-color 0.15s ease' }}
                >
                  Start your free trial
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => navigate('/how-it-works')}
                  sx={{ borderColor: '#C9C2B4', color: INK, '&:hover': { borderColor: INK, bgcolor: 'rgba(27,36,48,0.04)' }, fontWeight: 700, px: { xs: 4, sm: 5 }, py: 1.75, fontSize: '1rem', transition: 'border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease' }}
                >
                  See how it works
                </Button>
              </Stack>

              <Typography variant="body2" sx={{ color: MIST, fontWeight: 600, fontSize: '0.9rem' }}>
                14-day free trial · No credit card required
              </Typography>
            </Grid>

            <Grid item xs={12} lg={6}>
              <Box
                  sx={{
                    transform: heroIn ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.97)',
                    opacity: heroIn ? 1 : 0,
                    transition: 'transform 0.9s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.9s ease',
                  }}
              >
                <Box sx={{ position: 'relative' }}>
                  <Box sx={{ borderRadius: 3, overflow: 'hidden', border: `1px solid #E0D9CA`, bgcolor: '#FFFFFF', boxShadow: '0 32px 64px -28px rgba(20, 32, 45, 0.4)' }}>
                    {/* Window chrome */}
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: { xs: 2, sm: 2.5 }, py: 1.5, borderBottom: `1px solid #F0EBE1`, bgcolor: '#FCFAF6' }}>
                      <Stack direction="row" spacing={1.25} alignItems="center">
                        <Box sx={{ width: 10, height: 10, borderRadius: 1, bgcolor: NAVY, flexShrink: 0 }} />
                        <Typography sx={{ fontWeight: 800, color: INK, fontSize: '0.85rem' }}>MeticleCare</Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                          sx={{
                            width: 8, height: 8, borderRadius: '50%', bgcolor: EMERALD, flexShrink: 0,
                            animation: `${pulse} 2.4s ease-in-out infinite`,
                            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
                          }}
                        />
                        <Typography sx={{ fontSize: '0.7rem', color: MIST, fontWeight: 600 }}>Care in progress</Typography>
                      </Stack>
                    </Stack>
                    <img src={HERO_IMAGE} alt="A warm, connected care moment — two people sharing coffee in a comfortable home, representing the human side of supported living care" width="1600" height="1067" loading="eager" style={{ display: 'block', width: '100%', height: 'auto' }} />
                  </Box>

                  {/* Care-note toast */}
                  <Box
                    sx={{
                      position: 'absolute', left: { xs: 12, sm: -18 }, bottom: 26,
                      bgcolor: '#FFFFFF', border: `1px solid ${HAIRLINE}`, borderRadius: 2,
                      boxShadow: '0 20px 44px -20px rgba(20, 32, 45, 0.45)',
                      px: 1.75, py: 1.25, display: 'flex', alignItems: 'center', gap: 1.5,
                      opacity: heroIn ? 1 : 0,
                      transition: 'opacity 0.6s ease 1.05s',
                    }}
                  >
                    <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: EMERALD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <CheckIcon sx={{ fontSize: 14, color: '#FFFFFF' }} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, color: INK, lineHeight: 1.2 }}>Care note recorded</Typography>
                      <Typography sx={{ fontSize: '0.7rem', color: MIST, lineHeight: 1.3 }}>Saved to today's daily record</Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>

              <Typography variant="body2" sx={{ mt: 3, color: MIST, fontSize: '0.85rem', maxWidth: 460 }}>
                Care that feels like home — your team stays connected, your records stay current, and every moment of support is captured where it happens.
              </Typography>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* TRUST & VALUE */}
      <Box sx={{ py: { xs: 9, md: 12 }, bgcolor: '#FFFFFF' }}>
        <Container maxWidth="lg">
          <FadeSection>
            <Grid container spacing={{ xs: 5, md: 8 }} alignItems="center">
              <Grid item xs={12} md={5}>
              <Typography variant="h2" sx={{ fontSize: { xs: '2rem', md: '2.4rem' }, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.02em', color: INK, mb: 3 }}>
                Built for the way care actually runs.
              </Typography>
              <Typography sx={{ color: MIST, lineHeight: 1.75 }}>
                MeticleCare treats every record as part of one working system — the same note that informs the rota also feeds the evidence base your inspectors will ask for.
              </Typography>
            </Grid>
            <Grid item xs={12} md={7}>
              <Grid container spacing={{ xs: 3, md: 4 }}>
                {[
                  { t: 'UK GDPR & DPA 2018', d: 'Personal data handled to UK standards.' },
                  { t: 'AES-256 encryption', d: 'At rest and in transit, per organisation.' },
                  { t: 'Full audit trail', d: 'Every administration, approval and change is logged.' },
                  { t: 'Role-based access', d: 'Permissions that follow roles across every module.' },
                ].map((item) => (
                  <Grid item xs={12} sm={6} key={item.t}>
                    <Box sx={{ borderTop: `2px solid ${EMERALD}`, pt: 2.5 }}>
                      <Typography sx={{ fontWeight: 800, color: INK, mb: 0.75, fontSize: '1rem' }}>{item.t}</Typography>
                      <Typography sx={{ color: MIST, fontSize: '0.9rem', lineHeight: 1.6 }}>{item.d}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Grid>
          </Grid>
          </FadeSection>
        </Container>
      </Box>

      {/* CORE CAPABILITIES */}
      <Box sx={{ py: { xs: 9, md: 14 }, bgcolor: BONE }}>
        <Container maxWidth="lg">
          <FadeSection>
            <Typography variant="h2" sx={{ fontSize: { xs: '2.1rem', md: '2.7rem' }, fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.025em', color: INK, mb: 2, maxWidth: 720 }}>
              Everything a care team does, in one working set.
            </Typography>
            <Typography sx={{ color: MIST, fontSize: '1.05rem', mb: { xs: 7, md: 9 }, maxWidth: 560 }}>
              No gaps between modules, no re-typing the same record twice. Select any line to see it in the full feature tour.
            </Typography>
          </FadeSection>

          {[
            { label: 'Care & medication', desc: 'The daily record of care, kept at the point it happens.', items: [
              { name: 'eMAR & medication administration', desc: '31-day medication records, stock and daily counts, with an audit trail on every administration.', to: '/features#emar' },
              { name: 'Daily care notes', desc: "Record and share the day's care as it happens.", to: '/features#care-notes' },
              { name: 'Person-centred support plans', desc: 'Support plans built around the person, not the template.', to: '/features#support-plans' },
              { name: 'Body mapping', desc: 'Visual documentation of marks and injuries on a body map.', to: '/features#body-mapping' },
              { name: 'Appointments & health checks', desc: 'Reviews, appointments and follow-ups in one calendar.', to: '/features#appointments' },
              { name: 'Goals & progress', desc: 'Set goals and show progress over time.', to: '/features#goals' },
            ] },
            { label: 'People & operations', desc: 'The shift, the team and the paperwork that surrounds them.', items: [
              { name: 'Rota planner', desc: 'Build rotas on a week grid, with safe-staffing rules that block risky assignments.', to: '/features#rota' },
              { name: 'Holiday & absence', desc: 'Requests, balances and approvals — with delegation when the manager is away.', to: '/features#leave' },
              { name: 'Incidents & safeguarding', desc: 'Report, track and escalate incidents with action items that stay open until done.', to: '/features#incidents' },
              { name: 'Tasks', desc: 'Assign and close tasks across the team.', to: '/features#tasks' },
              { name: 'Secure staff messaging', desc: 'GDPR-compliant chat between staff, teams and departments.', to: '/features#chat' },
              { name: 'Training & competencies', desc: 'A matrix per role with gap-flagging, plus competency assessments with evidence.', to: '/features#training' },
            ] },
            { label: 'Compliance & oversight', desc: 'Readiness you can see, from records you already keep.', items: [
              { name: 'Inspection readiness', desc: 'Five CQC domains scored from live records — not estimates.', to: '/features#compliance' },
              { name: 'Evidence packs', desc: 'KLOE-aligned packs assembled from the documents you already keep.', to: '/features#compliance' },
              { name: 'Satisfaction & engagement surveys', desc: 'Email-invited surveys that feed the Caring and Well-led domains.', to: '/features#surveys' },
              { name: 'Policies & procedures', desc: 'Version-controlled policies shared with the whole team.', to: '/features#policies' },
              { name: 'DSPT self-assessment', desc: 'All ten data-security standards, submitted and tracked.', to: '/features#compliance' },
              { name: 'Audit & reporting', desc: 'Every action logged, and reports that make compliance visible.', to: '/features#audit' },
            ] },
          ].map((group, gi) => (
            <FadeSection key={group.label} direction="down" delay={gi * 120}>
              <Box sx={{ mb: gi < 2 ? { xs: 8, md: 10 } : 0 }}>
              <Grid container spacing={{ xs: 3, md: 6 }}>
                <Grid item xs={12} md={4}>
                  <Box sx={{ position: { md: 'sticky' }, top: 96 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: 1, bgcolor: EMERALD, flexShrink: 0 }} />
                      <Typography sx={{ fontWeight: 800, color: NAVY, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '0.8rem' }}>
                        {group.label}
                      </Typography>
                    </Stack>
                    <Typography sx={{ color: MIST, fontSize: '0.95rem', lineHeight: 1.6, maxWidth: 300 }}>{group.desc}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={8}>
                  <Stack sx={{ borderTop: `1px solid ${HAIRLINE}` }}>
                    {group.items.map((item) => (
                      <CapRow key={item.name} item={item} onNavigate={(to) => navigate(to)} />
                    ))}
                  </Stack>
                </Grid>
              </Grid>
              </Box>
            </FadeSection>
          ))}
        </Container>
      </Box>

      {/* CONNECTED OPERATIONS */}
      <Box sx={{ py: { xs: 9, md: 14 }, bgcolor: '#FFFFFF' }}>
        <Container maxWidth="lg">
          <FadeSection>
            <Box sx={{ maxWidth: 680, mb: { xs: 7, md: 9 } }}>
            <Typography variant="h2" sx={{ fontSize: { xs: '2.1rem', md: '2.7rem' }, fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.025em', color: INK, mb: 2 }}>
              The shift, connected end to end.
            </Typography>
            <Typography sx={{ color: MIST, fontSize: '1.05rem' }}>
              One action travels through the whole platform on its own. Here is a single visit, in five steps.
            </Typography>
          </Box>
          </FadeSection>

          <FadeSection delay={150}>
          <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} spacing={{ xs: 3, md: 0 }}>
            {[
              { t: 'Care given', d: 'A medication or support task is recorded at the point of care.' },
              { t: 'MAR updated', d: "The medication record updates for the day's round." },
              { t: 'Note recorded', d: "The note is saved to the person's daily record." },
              { t: 'Family informed', d: 'Relatives see the note in their portal view.' },
              { t: 'Compliance scored', d: 'The record feeds readiness where it matters.' },
            ].map((step, i) => (
              <Fragment key={step.t}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction={{ xs: 'row', md: 'column' }} spacing={{ xs: 2, md: 0 }} alignItems={{ xs: 'center', md: 'flex-start' }}>
                    <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: NAVY, flexShrink: 0, mt: 1.25, mb: { md: 1.75 } }} />
                    <Box sx={{ pb: 0.5 }}>
                      <Typography sx={{ fontWeight: 800, color: INK, mb: 0.5, fontSize: '1rem' }}>{step.t}</Typography>
                      <Typography sx={{ color: MIST, fontSize: '0.86rem', lineHeight: 1.55, maxWidth: 200 }}>{step.d}</Typography>
                    </Box>
                  </Stack>
                </Box>
                {i < 4 && (
                  <Box
                    sx={{
                      alignSelf: { md: 'center' },
                      mx: { xs: 'auto', md: 2 },
                      width: { xs: 2, md: 'auto' },
                      height: { xs: 22, md: 2 },
                      flexGrow: { md: 1 },
                      flexShrink: 0,
                      bgcolor: 'rgba(16, 185, 129, 0.4)',
                      borderRadius: 1,
                    }}
                  />
                )}
              </Fragment>
            ))}
          </Stack>
          </FadeSection>

          <FadeSection delay={250}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }} sx={{ mt: { xs: 8, md: 9 }, pt: 5, borderTop: `1px solid ${HAIRLINE}` }}>
            <Typography sx={{ color: INK, fontWeight: 700, fontSize: '1.05rem' }}>
              From one action to a complete, connected record — automatically.
            </Typography>
            <Button
              endIcon={<ArrowForwardIcon />}
              onClick={() => navigate('/how-it-works')}
              sx={{ color: NAVY, fontWeight: 800, textTransform: 'none', px: 0, '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' } }}
            >
              See how it works
            </Button>
          </Stack>
          </FadeSection>
        </Container>
      </Box>

      {/* ROLE-BASED BENEFITS */}
      <Box sx={{ py: { xs: 9, md: 14 }, bgcolor: BONE }}>
        <Container maxWidth="lg">
          <FadeSection>
            <Typography variant="h2" sx={{ fontSize: { xs: '2.1rem', md: '2.7rem' }, fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.025em', color: INK, mb: 2, maxWidth: 640 }}>
              One platform, shaped for each part of the day.
            </Typography>
            <Typography sx={{ color: MIST, fontSize: '1.05rem', mb: { xs: 7, md: 9 }, maxWidth: 560 }}>
              The same system, a different view for everyone who keeps the service running.
            </Typography>
          </FadeSection>

          <Stack spacing={0} sx={{ borderTop: `1px solid ${HAIRLINE}` }}>
            {[
              {
                role: 'Registered managers',
                tagline: 'See readiness before the inspector does.',
                items: ['Live compliance snapshot and inspection readiness', 'Rota planner with safe-staffing rules', 'Leave approvals, with delegation', 'Incident and safeguarding oversight', 'Reporting you can act on'],
              },
              {
                role: 'Care workers',
                tagline: 'The whole shift, in your pocket.',
                items: ['Mobile app with GPS check-in and voice notes', 'eMAR rounds on the 31-day chart', 'Claim open shifts from the marketplace', 'Secure team messaging'],
              },
              {
                role: 'Relatives & families',
                tagline: 'A quiet window into daily life.',
                items: ['Care notes, care plans and goals in the family portal', 'Observations you can see, not just hear about', 'A direct line to the team that cares'],
              },
              {
                role: 'Owners & operations leads',
                tagline: 'Every home, every number, one view.',
                items: ['Multi-location oversight in one dashboard', 'Insights and reporting across services', 'Agency and rate management', 'Billing and subscriptions in one place'],
              },
            ].map((r, idx) => (
              <FadeSection key={r.role} delay={idx * 120}>
                <Box sx={{ borderBottom: `1px solid ${HAIRLINE}`, py: { xs: 5, md: 6 } }}>
                <Grid container spacing={{ xs: 2, md: 6 }} alignItems={{ md: 'center' }}>
                  <Grid item xs={12} md={4}>
                    <Stack direction="row" spacing={2} alignItems="baseline">
                      <Typography variant="h3" sx={{ fontWeight: 800, color: INK, fontSize: { xs: '1.4rem', md: '1.6rem' }, lineHeight: 1.2 }}>
                        {r.role}
                      </Typography>
                    </Stack>
                    <Typography sx={{ color: NAVY, fontWeight: 600, mt: 1, fontSize: '0.98rem' }}>{r.tagline}</Typography>
                  </Grid>
                  <Grid item xs={12} md={8}>
                    <Grid container spacing={{ xs: 1.5, md: 2 }}>
                      {r.items.map((item) => (
                        <Grid item xs={12} sm={6} key={item}>
                          <Stack direction="row" spacing={1.5} alignItems="flex-start">
                            <Box sx={{ width: 7, height: 7, borderRadius: 1, bgcolor: EMERALD, mt: 0.55, flexShrink: 0 }} />
                            <Typography sx={{ color: '#3A4551', fontSize: '0.94rem', fontWeight: 500, lineHeight: 1.55 }}>{item}</Typography>
                          </Stack>
                        </Grid>
                      ))}
                    </Grid>
                  </Grid>
                </Grid>
              </Box>
              </FadeSection>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* PRODUCT INTERFACE SHOWCASE */}
      <Box sx={{ py: { xs: 9, md: 14 }, bgcolor: '#FFFFFF' }}>
        <Container maxWidth="lg">
          <FadeSection>
            <Grid container spacing={{ xs: 5, md: 8 }} alignItems="center">
              <Grid item xs={12} md={7}>
              <Box sx={{ borderRadius: 3, overflow: 'hidden', border: `1px solid #E0D9CA`, bgcolor: '#FFFFFF', boxShadow: '0 32px 64px -28px rgba(20, 32, 45, 0.35)' }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, py: 1.5, borderBottom: `1px solid #F0EBE1`, bgcolor: '#FCFAF6' }}>
                  <Typography sx={{ fontWeight: 800, color: INK, fontSize: '0.85rem' }}>MeticleCare · Today's care</Typography>
                </Stack>
                <img src={HERO_IMAGE} alt="Supported living care in practice — a moment of connection and everyday care at home" width="1600" height="1067" loading="lazy" style={{ display: 'block', width: '100%', height: 'auto' }} />
              </Box>
            </Grid>
            <Grid item xs={12} md={5}>
              <Typography variant="h2" sx={{ fontSize: { xs: '2rem', md: '2.5rem' }, fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.025em', color: INK, mb: 3 }}>
                Care that puts people first.
              </Typography>
              <Stack spacing={0} sx={{ mb: 4 }}>
                {[
                  { t: 'Person-centred support', d: 'Care plans built around the person, not the template.' },
                  { t: 'Daily records that write themselves', d: 'Every interaction, medication, and wellbeing check captured as it happens.' },
                  { t: 'Connected families', d: 'Relatives see care notes, goals, and observations through a dedicated portal.' },
                ].map((c) => (
                  <Stack key={c.t} direction="row" spacing={2} alignItems="flex-start" sx={{ borderTop: `1px solid ${HAIRLINE}`, py: 2 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: 1, bgcolor: EMERALD, mt: 0.6, flexShrink: 0 }} />
                    <Box>
                      <Typography sx={{ fontWeight: 800, color: INK, mb: 0.5 }}>{c.t}</Typography>
                      <Typography sx={{ color: MIST, fontSize: '0.9rem', lineHeight: 1.55 }}>{c.d}</Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
              <Typography sx={{ color: MIST, fontSize: '0.95rem', lineHeight: 1.65 }}>
                The same platform that captures every care moment also feeds your compliance evidence — nothing is entered twice, and nothing is estimated.
              </Typography>
            </Grid>
          </Grid>
          </FadeSection>
        </Container>
      </Box>

      {/* COMPLIANCE & OVERSIGHT */}
      <Box sx={{ py: { xs: 9, md: 14 }, bgcolor: NAVY, color: '#FFFFFF' }}>
        <Container maxWidth="lg">
          <FadeSection>
            <Grid container spacing={{ xs: 5, md: 8 }} alignItems="center">
              <Grid item xs={12} md={5}>
              <Typography variant="h2" sx={{ fontSize: { xs: '2rem', md: '2.5rem' }, fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.02em', mb: 3 }}>
                Compliance, supported by the records you keep.
              </Typography>
              <Typography sx={{ opacity: 0.88, lineHeight: 1.75, mb: 4 }}>
                MeticleCare supports compliance management across the four UK regulators — CQC, CIW, the Care Inspectorate and RQIA — without asking your team to do the paperwork twice.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => navigate('/features#compliance')}
                  sx={{ bgcolor: '#FFFFFF', color: NAVY, '&:hover': { bgcolor: '#F3F1EA' }, fontWeight: 800, px: 4, transition: 'background-color 0.15s ease' }}
                >
                  See the compliance module
                </Button>
                <Button
                  variant="text"
                  size="large"
                  onClick={() => navigate('/features#audit')}
                  sx={{ color: '#FFFFFF', fontWeight: 800, px: 2, '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' }, transition: 'background-color 0.15s ease' }}
                >
                  Explore reporting →
                </Button>
              </Stack>
            </Grid>
            <Grid item xs={12} md={7}>
              <Stack sx={{ borderTop: '1px solid rgba(255,255,255,0.24)' }}>
                {[
                  { t: 'Five CQC domains scored from live records', d: 'Safe, effective, caring, responsive and well-led — from real activity, not estimates.' },
                  { t: 'Evidence packs assembled from real documents', d: 'KLOE-aligned packs, inspection-ready, without re-keying.' },
                  { t: 'Training matrix with gap-flagging', d: 'Role-by-role, with expiring certificates surfaced early.' },
                  { t: 'DSPT self-assessment', d: 'All ten data-security standards, submitted and tracked.' },
                  { t: 'Audit trail on every action', d: 'From administration to approval, every step is recorded.' },
                ].map((item) => (
                  <Stack key={item.t} direction="row" spacing={2.25} alignItems="flex-start" sx={{ borderBottom: '1px solid rgba(255,255,255,0.24)', py: 2.5 }}>
                    <Box sx={{ width: 9, height: 9, borderRadius: 1, bgcolor: EMERALD, mt: 0.6, flexShrink: 0 }} />
                    <Box>
                      <Typography sx={{ fontWeight: 800, mb: 0.5, fontSize: '1rem' }}>{item.t}</Typography>
                      <Typography sx={{ opacity: 0.82, fontSize: '0.9rem', lineHeight: 1.6 }}>{item.d}</Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            </Grid>
          </Grid>
          </FadeSection>
        </Container>
      </Box>

      {/* FINAL CTA */}
      <Box sx={{ py: { xs: 11, md: 15 }, bgcolor: INK_DARK, color: '#FFFFFF', textAlign: 'center' }}>
        <Container maxWidth="md">
          <FadeSection variant="scale-slide" delay={200}>
            <Typography variant="h2" sx={{ fontSize: { xs: '2.1rem', md: '3rem' }, fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.03em', mb: 3, color: '#FFFFFF' }}>
              Bring your care operations together.
            </Typography>
            <Typography sx={{ opacity: 0.92, fontSize: '1.12rem', lineHeight: 1.7, mb: 5, maxWidth: 560, mx: 'auto' }}>
              Move rota, medication, care notes and compliance onto one connected platform — and see the working day in one view.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate('/register')}
                sx={{ bgcolor: EMERALD_DEEP, '&:hover': { bgcolor: '#065F46' }, fontWeight: 800, px: { xs: 5, sm: 7 }, py: 1.9, fontSize: '1.05rem', transition: 'background-color 0.15s ease' }}
              >
                Start your free trial
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={() => navigate('/contact')}
                sx={{ borderColor: 'rgba(255,255,255,0.4)', color: '#FFFFFF', '&:hover': { borderColor: '#FFFFFF', bgcolor: 'rgba(255,255,255,0.06)' }, fontWeight: 700, px: { xs: 5, sm: 6 }, py: 1.9, fontSize: '1.05rem', transition: 'border-color 0.15s ease, background-color 0.15s ease' }}
              >
                Talk to our team
              </Button>
            </Stack>
            <Typography variant="body2" sx={{ opacity: 0.7, mt: 4, fontWeight: 600 }}>
              14-day free trial · No credit card required
            </Typography>
          </FadeSection>
        </Container>
      </Box>
    </MarketingLayout>
  )
}

function CapRow({ item, onNavigate }: { item: { name: string; desc: string; to: string }; onNavigate: (to: string) => void }) {
  return (
    <Stack
      direction="row"
      spacing={3}
      alignItems="center"
      justifyContent="space-between"
      role="link"
      tabIndex={0}
      aria-label={item.name}
      onClick={() => onNavigate(item.to)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onNavigate(item.to)
        }
      }}
      sx={{
        borderBottom: `1px solid ${HAIRLINE}`,
        py: 2.5,
        cursor: 'pointer',
        '&:hover .cap-arrow': { transform: 'translateX(4px)', color: EMERALD_DEEP },
        '&:hover .cap-name': { color: NAVY },
        '&:focus-visible': { outline: `2px solid ${EMERALD}`, outlineOffset: '-2px' },
      }}
    >
      <Box>
        <Typography className="cap-name" sx={{ fontWeight: 700, color: INK, mb: 0.5, fontSize: '0.98rem', transition: 'color 0.15s ease' }}>
          {item.name}
        </Typography>
        <Typography sx={{ color: MIST, fontSize: '0.88rem', lineHeight: 1.55 }}>{item.desc}</Typography>
      </Box>
      <ArrowForwardIcon className="cap-arrow" sx={{ fontSize: 20, color: MIST, flexShrink: 0, transition: 'transform 0.15s ease, color 0.15s ease' }} />
    </Stack>
  )
}
