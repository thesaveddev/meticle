import { useEffect, useRef, useState } from 'react'
import { Box, Button, Container, Grid, Stack, Typography } from '@mui/material'
import { ArrowForward as ArrowForwardIcon, Check as CheckIcon } from '@mui/icons-material'
import { keyframes } from '@emotion/react'
import { useNavigate } from 'react-router-dom'
import MarketingLayout from '../components/marketing/MarketingLayout'
import PageMeta from '../components/PageMeta'
import {
  EmarIcon, CareNoteIcon, SupportPlanIcon, BodyMapIcon, AppointmentIcon, GoalsIcon,
  RotaIcon, LeaveIcon, IncidentIcon, TaskIcon, ChatIcon, TrainingIcon,
  ShieldIcon, EvidenceIcon, SurveyIcon, PolicyIcon, DsptIcon, AuditIcon,
  ManagerIcon, CareWorkerIcon, FamilyIcon, OwnerIcon,
} from '../components/marketing/icons'

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'MeticleCare',
      url: 'https://meticlecare.com',
      description: 'MeticleCare is care management software for UK supported living providers, bringing daily records, medication, staffing and compliance together.',
    },
    {
      '@type': 'SoftwareApplication',
      name: 'MeticleCare',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: 'Care management software for UK supported living providers. Manage care plans, daily notes, medication, rotas, incidents and compliance in one place.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'GBP',
        description: '14-day free trial',
        url: 'https://meticlecare.com/register',
      },
    },
    {
      '@type': 'WebSite',
      name: 'MeticleCare',
      url: 'https://meticlecare.com',
      potentialAction: { '@type': 'SearchAction', target: 'https://meticlecare.com/blog?search={search_term_string}', 'query-input': 'required name=search_term_string' },
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

const HERO_IMAGE = '/illustrations/hero-care.svg'
const SHOWCASE_IMAGE = '/illustrations/care-moment.svg'
const TIMELINE_IMAGE = '/illustrations/timeline-card.svg'

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
  const [heroIn, setHeroIn] = useState(true)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = window.setTimeout(() => setHeroIn(true), 80)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <MarketingLayout>
      <PageMeta
        title="Supported Living Care Management Software | MeticleCare"
        description="MeticleCare brings care planning, staffing, compliance, medication, incidents and daily operations together in one connected platform for UK supported living providers. Start a free 14-day trial."
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
Care operations, without the gaps.
              </Typography>

              <Typography sx={{ color: MIST, fontSize: '1.12rem', lineHeight: 1.7, mb: 4, maxWidth: 520 }}>
Keep care records, medication, staffing and compliance in one working view — built for UK supported living teams.
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
14-day free trial · No card required · Set up in minutes
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
                    <img src={HERO_IMAGE} alt="Stylised illustration of the MeticleCare tablet dashboard showing a person's daily support plan and medication administration chart, with a care note being recorded" width="1280" height="854" loading="eager" style={{ display: 'block', width: '100%', height: 'auto' }} />
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
A clear working record for the people you support — and a calmer day for the team delivering it.
              </Typography>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* TRUST STRIP — regulators & standards */}
      <Box
        component="section"
        aria-label="Standards MeticleCare is built for"
        sx={{ bgcolor: '#FFFFFF', borderBottom: `1px solid ${HAIRLINE}`, py: { xs: 5, md: 6 } }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 3, md: 4 }} alignItems="center">
            <Grid item xs={12} md={3}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: NAVY, letterSpacing: '0.14em', textTransform: 'uppercase', mb: { xs: 1, md: 0 } }}>
                Built for the UK's care regulators
              </Typography>
            </Grid>
            <Grid item xs={12} md={9}>
              <Grid container spacing={{ xs: 3, md: 4 }} alignItems="center">
                {[
                  { src: '/logos/cqc.svg', alt: 'CQC - Care Quality Commission' },
                  { src: '/logos/ciw.svg', alt: 'CIW - Care Inspectorate Wales' },
                  { src: '/logos/cis.svg', alt: 'Care Inspectorate Scotland' },
                  { src: '/logos/rqia.svg', alt: 'RQIA - Quality & Improvement Northern Ireland' },
                  { src: '/logos/nhs.svg', alt: 'NHS - National Health Service' },
                  { src: '/logos/ukgdpr.svg', alt: 'UK GDPR and DPA 2018' },
                ].map((logo) => (
                  <Grid item xs={6} sm={4} md key={logo.alt}>
                    <Box
                      sx={{
                        height: 52,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        filter: 'grayscale(100%) opacity(0.55)',
                        transition: 'all 0.3s ease',
                        '&:hover': { filter: 'grayscale(0%) opacity(1)', transform: 'scale(1.05)' },
                      }}
                    >
                      <img
                        src={logo.src}
                        alt={logo.alt}
                        style={{ height: '100%', width: 'auto', maxWidth: '100%' }}
                      />
                    </Box>
                  </Grid>
                ))}
              </Grid>
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
  The work is connected. Your records should be too.
              </Typography>
              <Typography sx={{ color: MIST, lineHeight: 1.75 }}>
A medication round, a care note, a staffing decision and an incident review belong to the same day of care. MeticleCare keeps them together, so managers can act on the same information their teams record.
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
The essentials, in one working set.
            </Typography>
            <Typography sx={{ color: MIST, fontSize: '1.05rem', mb: { xs: 7, md: 9 }, maxWidth: 560 }}>
The tools your team uses every day, connected around the person and the service. Explore a capability when you are ready.
            </Typography>
          </FadeSection>

          {[
            { label: 'Care & medication', desc: 'The daily record of care, kept at the point it happens.', items: [
              { name: 'eMAR & medication administration', desc: '31-day medication records, stock and daily counts, with an audit trail on every administration.', icon: EmarIcon, to: '/features#emar' },
              { name: 'Daily care notes', desc: "Record and share the day's care as it happens.", icon: CareNoteIcon, to: '/features#care-notes' },
              { name: 'Person-centred support plans', desc: 'Support plans built around the person, not the template.', icon: SupportPlanIcon, to: '/features#support-plans' },
              { name: 'Body mapping', desc: 'Visual documentation of marks and injuries on a body map.', icon: BodyMapIcon, to: '/features#body-mapping' },
              { name: 'Appointments & health checks', desc: 'Reviews, appointments and follow-ups in one calendar.', icon: AppointmentIcon, to: '/features#appointments' },
              { name: 'Goals & progress', desc: 'Set goals and show progress over time.', icon: GoalsIcon, to: '/features#goals' },
            ] },
            { label: 'People & operations', desc: 'The shift, the team and the paperwork that surrounds them.', items: [
              { name: 'Rota planner', desc: 'Build rotas on a week grid, with safe-staffing rules that block risky assignments.', icon: RotaIcon, to: '/features#rota' },
              { name: 'Holiday & absence', desc: 'Requests, balances and approvals — with delegation when the manager is away.', icon: LeaveIcon, to: '/features#leave' },
              { name: 'Incidents & safeguarding', desc: 'Report, track and escalate incidents with action items that stay open until done.', icon: IncidentIcon, to: '/features#incidents' },
              { name: 'Tasks', desc: 'Assign and close tasks across the team.', icon: TaskIcon, to: '/features#tasks' },
              { name: 'Secure staff messaging', desc: 'GDPR-compliant chat between staff, teams and departments.', icon: ChatIcon, to: '/features#chat' },
              { name: 'Training & competencies', desc: 'A matrix per role with gap-flagging, plus competency assessments with evidence.', icon: TrainingIcon, to: '/features#training' },
            ] },
            { label: 'Compliance & oversight', desc: 'Readiness you can see, from records you already keep.', items: [
              { name: 'Inspection readiness', desc: 'Five CQC domains scored from live records — not estimates.', icon: ShieldIcon, to: '/features#compliance' },
              { name: 'Evidence packs', desc: 'KLOE-aligned packs assembled from the documents you already keep.', icon: EvidenceIcon, to: '/features#compliance' },
              { name: 'Satisfaction & engagement surveys', desc: 'Email-invited surveys that feed the Caring and Well-led domains.', icon: SurveyIcon, to: '/features#surveys' },
              { name: 'Policies & procedures', desc: 'Version-controlled policies shared with the whole team.', icon: PolicyIcon, to: '/features#policies' },
              { name: 'DSPT self-assessment', desc: 'All ten data-security standards, submitted and tracked.', icon: DsptIcon, to: '/features#compliance' },
              { name: 'Audit & reporting', desc: 'Every action logged, and reports that make compliance visible.', icon: AuditIcon, to: '/features#audit' },
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
            <Box
              sx={{
                borderRadius: 3,
                overflow: 'hidden',
                border: `1px solid ${HAIRLINE}`,
                bgcolor: '#FFFFFF',
                boxShadow: '0 24px 60px -32px rgba(20, 32, 45, 0.25)',
              }}
            >
              <img
                src={TIMELINE_IMAGE}
                alt="A five-step flow showing how one care action travels through MeticleCare: care given, MAR updated, note recorded, family informed, compliance scored"
                width="1280"
                height="360"
                loading="lazy"
                style={{ display: 'block', width: '100%', height: 'auto' }}
              />
            </Box>

            <Grid container spacing={{ xs: 2, md: 3 }} sx={{ mt: { xs: 3, md: 4 } }}>
              {[
                { t: 'Care given', d: 'A medication or support task is recorded at the point of care.' },
                { t: 'MAR updated', d: "The medication record updates for the day's round." },
                { t: 'Note recorded', d: "The note is saved to the person's daily record." },
                { t: 'Family informed', d: 'Relatives see the note in their portal view.' },
                { t: 'Compliance scored', d: 'The record feeds readiness where it matters.' },
              ].map((step, i) => (
                <Grid item xs={6} md key={step.t}>
                  <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ borderTop: `2px solid ${EMERALD}`, pt: 1.5 }}>
                    <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: NAVY, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, flexShrink: 0 }}>
                      {i + 1}
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 800, color: INK, fontSize: '0.92rem', lineHeight: 1.2, mb: 0.5 }}>{step.t}</Typography>
                      <Typography sx={{ color: MIST, fontSize: '0.8rem', lineHeight: 1.55 }}>{step.d}</Typography>
                    </Box>
                  </Stack>
                </Grid>
              ))}
            </Grid>
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
A useful view for every role.
            </Typography>
            <Typography sx={{ color: MIST, fontSize: '1.05rem', mb: { xs: 7, md: 9 }, maxWidth: 560 }}>
Managers need oversight. Care workers need speed. Families need a clear, respectful view of daily life.
            </Typography>
          </FadeSection>

          <Grid container spacing={{ xs: 3, md: 3 }}>
            {[
              {
                role: 'Registered managers',
                tagline: 'See readiness before the inspector does.',
                Icon: ManagerIcon,
                items: ['Live compliance snapshot and inspection readiness', 'Rota planner with safe-staffing rules', 'Leave approvals, with delegation', 'Incident and safeguarding oversight', 'Reporting you can act on'],
              },
              {
                role: 'Care workers',
                tagline: 'The whole shift, in your pocket.',
                Icon: CareWorkerIcon,
                items: ['Mobile app with GPS check-in and voice notes', 'eMAR rounds on the 31-day chart', 'Claim open shifts from the marketplace', 'Secure team messaging'],
              },
              {
                role: 'Relatives & families',
                tagline: 'A quiet window into daily life.',
                Icon: FamilyIcon,
                items: ['Care notes, care plans and goals in the family portal', 'Observations you can see, not just hear about', 'A direct line to the team that cares'],
              },
              {
                role: 'Owners & operations leads',
                tagline: 'Every home, every number, one view.',
                Icon: OwnerIcon,
                items: ['Multi-location oversight in one dashboard', 'Insights and reporting across services', 'Agency and rate management', 'Billing and subscriptions in one place'],
              },
            ].map((r, idx) => (
              <Grid item xs={12} sm={6} md={3} key={r.role}>
                <FadeSection delay={idx * 90}>
                  <Box
                    sx={{
                      height: '100%',
                      bgcolor: '#FFFFFF',
                      border: `1px solid ${HAIRLINE}`,
                      borderRadius: 3,
                      p: { xs: 3, md: 3.5 },
                      transition: 'border-color 0.15s ease, transform 0.15s ease',
                      '&:hover': { borderColor: EMERALD, transform: 'translateY(-2px)' },
                    }}
                  >
                    <Box
                      sx={{
                        width: 44, height: 44, borderRadius: 1.5,
                        bgcolor: 'rgba(15,76,129,0.08)', color: NAVY,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        mb: 2.5,
                      }}
                    >
                      <r.Icon size={22} />
                    </Box>
                    <Typography variant="h3" sx={{ fontWeight: 800, color: INK, fontSize: '1.2rem', lineHeight: 1.2, mb: 0.75 }}>
                      {r.role}
                    </Typography>
                    <Typography sx={{ color: NAVY, fontWeight: 600, fontSize: '0.86rem', mb: 2.5 }}>
                      {r.tagline}
                    </Typography>
                    <Stack spacing={1.25}>
                      {r.items.map((item) => (
                        <Stack key={item} direction="row" spacing={1.25} alignItems="flex-start">
                          <Box sx={{ width: 6, height: 6, borderRadius: 1, bgcolor: EMERALD, mt: 0.55, flexShrink: 0 }} />
                          <Typography sx={{ color: '#3A4551', fontSize: '0.86rem', fontWeight: 500, lineHeight: 1.55 }}>{item}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                </FadeSection>
              </Grid>
            ))}
          </Grid>
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
                <img src={SHOWCASE_IMAGE} alt="Mobile view of a care note being recorded in MeticleCare with family and manager receiving the update" width="1280" height="800" loading="lazy" style={{ display: 'block', width: '100%', height: 'auto' }} />
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
  Inspection readiness should come from good care records.
              </Typography>
              <Typography sx={{ opacity: 0.88, lineHeight: 1.75, mb: 4 }}>
When records are complete and current, compliance work becomes easier to evidence. MeticleCare supports teams working with CQC, CIW, the Care Inspectorate and RQIA.
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
Make the working day easier to see.
            </Typography>
            <Typography sx={{ opacity: 0.92, fontSize: '1.12rem', lineHeight: 1.7, mb: 5, maxWidth: 560, mx: 'auto' }}>
Give your team one place for the records, decisions and follow-through that keep care safe.
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
14-day free trial · No card required · Set up in minutes
            </Typography>
          </FadeSection>
        </Container>
      </Box>
    </MarketingLayout>
  )
}

type CapItem = { name: string; desc: string; to: string; icon?: React.ComponentType<{ size?: number; color?: string }> }

function CapRow({ item, onNavigate }: { item: CapItem; onNavigate: (to: string) => void }) {
  const Icon = item.icon
  return (
    <Stack
      direction="row"
      spacing={2.5}
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
        py: 2.25,
        cursor: 'pointer',
        '&:hover .cap-arrow': { transform: 'translateX(4px)', color: EMERALD_DEEP },
        '&:hover .cap-name': { color: NAVY },
        '&:hover .cap-icon': { color: NAVY, backgroundColor: 'rgba(15,76,129,0.12)' },
        '&:focus-visible': { outline: `2px solid ${EMERALD}`, outlineOffset: '-2px' },
        transition: 'background-color 0.15s ease',
      }}
    >
      <Stack direction="row" spacing={2.25} alignItems="center" sx={{ minWidth: 0 }}>
        {Icon && (
          <Box
            className="cap-icon"
            sx={{
              width: 36, height: 36, borderRadius: 1.5, bgcolor: 'rgba(15,76,129,0.06)',
              color: EMERALD_DEEP, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'color 0.15s ease, background-color 0.15s ease',
            }}
          >
            <Icon size={20} />
          </Box>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography className="cap-name" sx={{ fontWeight: 700, color: INK, mb: 0.5, fontSize: '0.98rem', transition: 'color 0.15s ease' }}>
            {item.name}
          </Typography>
          <Typography sx={{ color: MIST, fontSize: '0.88rem', lineHeight: 1.55 }}>{item.desc}</Typography>
        </Box>
      </Stack>
      <ArrowForwardIcon className="cap-arrow" sx={{ fontSize: 20, color: MIST, flexShrink: 0, transition: 'transform 0.15s ease, color 0.15s ease' }} />
    </Stack>
  )
}
