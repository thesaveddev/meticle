import { Box, Button, Container, Grid, Stack, Typography } from '@mui/material'
import {
  ArrowForward, Check, Shield, Insights,
  Security, VerifiedUser, Lock, Star,
  Description, People, Medication,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { M } from '../../styles/marketing-tokens'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'
import type { ReactNode } from 'react'

/* ─── Shared Elements ──────────────────────────────── */

function EditorialLabel({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <Typography sx={{
      ...M.caption,
      display: 'inline-block',
      color: light ? M.tealMuted : M.tealDeep,
      borderBottom: `2px solid ${light ? M.teal : M.tealDeep}`,
      pb: 0.75,
      mb: 2.5,
      textTransform: 'uppercase',
    }}>
      {children}
    </Typography>
  )
}

function CTA({
  label = 'Book a demo', to = '/contact', variant = 'primary',
}: { label?: string; to?: string; variant?: 'primary' | 'secondary' | 'ghost' }) {
  const nav = useNavigate()
  const styles = {
    primary: { bgcolor: M.tealDeep, color: '#fff', fontWeight: 800, '&:hover': { bgcolor: M.tealDark } },
    secondary: { bgcolor: 'transparent', color: M.navy, border: `1.5px solid ${M.navy}`, fontWeight: 700, '&:hover': { bgcolor: `${M.navy}08` } },
    ghost: { bgcolor: 'transparent', color: '#fff', border: `1.5px solid rgba(255,255,255,0.3)`, fontWeight: 700, '&:hover': { borderColor: 'rgba(255,255,255,0.7)', bgcolor: 'rgba(255,255,255,0.04)' } },
  }
  return (
    <Button
      variant="contained" endIcon={<ArrowForward />}
      onClick={() => nav(to)}
      sx={{ px: 3.5, py: 1.5, borderRadius: M.r.sm, textTransform: 'none', fontSize: '0.9rem', ...styles[variant] }}
    >{label}</Button>
  )
}

function TextLink({ label, to, light = false }: { label: string; to: string; light?: boolean }) {
  const nav = useNavigate()
  return (
    <Button
      onClick={() => nav(to)}
      endIcon={<ArrowForward />}
      sx={{
        px: 0, minHeight: 44, borderRadius: 0, textTransform: 'none', fontWeight: 800,
        color: light ? 'rgba(255,255,255,0.85)' : M.navy,
        '&:hover': { bgcolor: 'transparent', color: light ? M.teal : M.tealDeep },
        '& .MuiButton-endIcon': { transition: 'transform 180ms ease' },
        '&:hover .MuiButton-endIcon': { transform: 'translateX(4px)' },
      }}
    >
      {label}
    </Button>
  )
}

/* ─── Data ──────────────────────────────────────────── */

const trustItems = [
  { icon: VerifiedUser, label: 'UK data hosting' },
  { icon: Lock, label: 'Encryption' },
  { icon: Shield, label: 'MFA & RBAC' },
  { icon: Insights, label: 'Full audit trail' },
  { icon: Security, label: 'Tenant isolation' },
  { icon: Star, label: 'GDPR-ready' },
]

const capabilities = [
  { icon: Description, title: 'Care', text: 'Plans, notes, reviews and observations stay connected to the person.' },
  { icon: People, title: 'Workforce', text: 'Staff, training, competency, availability and rota from one context.' },
  { icon: Medication, title: 'Medication', text: 'Administration records, exceptions and audit trails where the service provides medication support.' },
  { icon: Shield, title: 'Oversight', text: 'Risks, incidents, actions, evidence and reporting remain visible to managers.' },
]

const roles = [
  { role: 'Registered managers', text: 'See what needs attention before it becomes a surprise.' },
  { role: 'Care workers', text: 'Get a focused view of the work in front of you.' },
  { role: 'Families', text: 'Stay connected through controlled, authorised communication.' },
  { role: 'Operations leads', text: 'Understand how the service is performing from the records it creates.' },
]

const evidenceSteps = ['Deliver care', 'Record care', 'Track risks', 'Review people', 'Maintain evidence']

/* ─── Working Day Board ─────────────────────────── */

function WorkingDayBoard() {
  const stages = [
    { time: '08:00', title: 'Plan', text: 'Calls, people and priorities in one view.' },
    { time: '09:15', title: 'Deliver', text: 'A carer checks in at the point of care.' },
    { time: '10:05', title: 'Record', text: 'The visit note becomes part of the record.' },
    { time: '10:30', title: 'Review', text: 'Exceptions stay visible until resolved.' },
  ]

  return (
    <Box sx={{
      bgcolor: M.warm, border: `1px solid ${M.subtle}`, borderRadius: M.r.lg,
      p: { xs: 2.5, md: 4 }, boxShadow: M.shadow.navy, overflow: 'hidden',
      '@keyframes signal': {
        '0%': { transform: 'translateX(0)', opacity: 0.45 },
        '10%': { opacity: 1 },
        '90%': { opacity: 1 },
        '100%': { transform: 'translateX(calc(100% - 12px))', opacity: 0.45 },
      },
      '@keyframes pulse': {
        '0%, 100%': { opacity: 0.45, transform: 'scale(0.9)' },
        '50%': { opacity: 1, transform: 'scale(1)' },
      },
      '@media (prefers-reduced-motion: reduce)': {
        '.sig, .pul': { animation: 'none !important' },
      },
    }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 4 }}>
        <Box>
          <Typography sx={{ ...M.caption, color: M.navy, display: 'block', mb: 0.75 }}>THE WORKING DAY</Typography>
          <Typography sx={{ ...M.h3, color: M.ink }}>From plan to proof.</Typography>
        </Box>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: M.tealDeep }}>
          <Box className="pul" sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: M.teal, animation: 'pulse 1.8s ease-in-out infinite' }} />
          <Typography sx={{ ...M.caption, color: M.tealDeep }}>LIVE</Typography>
        </Stack>
      </Stack>

      <Box sx={{ position: 'relative', height: 4, bgcolor: M.subtle, borderRadius: 4, mb: 4 }}>
        <Box sx={{ position: 'absolute', inset: 0, bgcolor: M.teal, borderRadius: 4 }} />
        <Box className="sig" sx={{
          position: 'absolute', top: -4, left: 0, width: 12, height: 12,
          borderRadius: '50%', bgcolor: M.teal, border: `3px solid ${M.warm}`,
          boxShadow: `0 0 0 1px ${M.teal}`,
          animation: 'signal 4.8s cubic-bezier(0.16, 1, 0.3, 1) infinite',
        }} />
      </Box>

      <Grid container spacing={{ xs: 2, md: 2.5 }}>
        {stages.map((stage, i) => (
          <Grid item xs={6} sm={3} key={stage.title}>
            <Box sx={{ borderTop: `2px solid ${i === 0 ? M.teal : M.subtle}`, pt: 1.5, minHeight: 120 }}>
              <Typography sx={{ ...M.caption, color: M.muted, display: 'block', mb: 0.75 }}>{stage.time}</Typography>
              <Typography sx={{ fontWeight: 800, color: M.navy, mb: 0.5 }}>{stage.title}</Typography>
              <Typography sx={{ color: M.slate, fontSize: '0.76rem', lineHeight: 1.5 }}>{stage.text}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}

/* ─── Page ──────────────────────────────────────────── */

export default function HomePage() {
  return (
    <MarketingLayout>
      <PageMeta
        title="Care operations, unified"
        description="MeticleCare connects care delivery, scheduling, medication, risk, compliance, workforce and reporting for UK domiciliary and supported living providers."
        canonicalPath="/"
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'MeticleCare',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web and mobile',
          description: 'Care operations software for UK domiciliary and supported living providers.',
        }}
      />

      {/* ═══ 01 · HERO ═══ */}
      <Box component="section" sx={{ bgcolor: M.navy, color: M.card, borderBottom: `1px solid ${M.navyLight}`, py: { xs: 9, md: 16 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography sx={{ ...M.caption, color: M.teal, display: 'block', mb: 2.5 }}>CARE OPERATIONS SOFTWARE</Typography>
              <Typography component="h1" sx={{ ...M.display, color: M.card, maxWidth: 620, mb: 3 }}>
                Run your care operation with confidence.
              </Typography>
              <Typography sx={{ ...M.bodyLg, color: 'rgba(255,255,255,0.72)', maxWidth: 560, mb: 4 }}>
                Connect care delivery, workforce, compliance, medication and reporting in one place built for the real working day.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <CTA />
                <CTA label="Explore the platform" to="/platform" variant="ghost" />
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <WorkingDayBoard />
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ═══ 02 · TRUST ═══ */}
      <Box component="section" sx={{ bgcolor: M.card, borderBottom: `1px solid ${M.faint}`, py: 2.5 }}>
        <Container maxWidth="lg">
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1.5, sm: 4 }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
            {trustItems.map((t) => (
              <Stack key={t.label} direction="row" spacing={0.75} alignItems="center">
                <t.icon sx={{ fontSize: 15, color: M.tealDeep }} />
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: M.slate, whiteSpace: 'nowrap' }}>{t.label}</Typography>
              </Stack>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* ═══ 03 · CONNECTED ═══ */}
      <Box component="section" sx={{ bgcolor: M.paper, py: { xs: 9, md: 15 } }}>
        <Container maxWidth="lg">
          <EditorialLabel>One working set</EditorialLabel>
          <Typography component="h2" sx={{ ...M.h1, color: M.ink, mb: 2, maxWidth: 720 }}>
            Everything is connected to the work, not just the menu.
          </Typography>
          <Typography sx={{ ...M.bodyLg, color: M.slate, maxWidth: 640, mb: { xs: 6, md: 8 } }}>
            Not a collection of separate modules. A connected operating system where care records, workforce, compliance and intelligence share context.
          </Typography>

          <Grid container spacing={0} sx={{ borderTop: `1px solid ${M.faint}` }}>
            {capabilities.map((c) => (
              <Grid item xs={12} md={3} key={c.title}>
                <Box sx={{ p: { xs: 2.5, md: 3.5 }, minHeight: 220, borderBottom: { xs: `1px solid ${M.faint}`, md: 'none' }, borderRight: { md: `1px solid ${M.faint}` } }}>
                  <c.icon sx={{ color: M.navy, fontSize: 28, mb: 3 }} />
                  <Typography component="h3" sx={{ ...M.h3, color: M.ink, mb: 1 }}>{c.title}</Typography>
                  <Typography sx={{ ...M.body, color: M.slate }}>{c.text}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>

          <Box sx={{ borderBottom: `1px solid ${M.faint}`, py: 3 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
              <Typography sx={{ fontWeight: 800, color: M.navy, fontSize: '0.95rem' }}>
                Operational intelligence sits on top of the records your team already creates.
              </Typography>
              <TextLink label="See the platform" to="/platform" />
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* ═══ 04 · INSPECTION READINESS ═══ */}
      <Box component="section" sx={{ bgcolor: M.card, py: { xs: 9, md: 15 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 12 }} alignItems="start">
            <Grid item xs={12} md={5}>
              <EditorialLabel>Inspection readiness</EditorialLabel>
              <Typography component="h2" sx={{ ...M.h1, color: M.ink, mb: 2 }}>
                Stay ready for inspection. Every day.
              </Typography>
              <Typography sx={{ ...M.bodyLg, color: M.slate, mb: 4 }}>
                Good governance is easier to demonstrate when it is created through normal work rather than assembled at the last minute.
              </Typography>
              <TextLink label="Explore compliance" to="/compliance" />
            </Grid>
            <Grid item xs={12} md={7}>
              <Box sx={{ borderTop: `2px solid ${M.teal}` }}>
                {evidenceSteps.map((step, i) => (
                  <Stack key={step} direction="row" spacing={2} alignItems="center" sx={{ py: 2.5, borderBottom: i < evidenceSteps.length - 1 ? `1px solid ${M.faint}` : 'none' }}>
                    <Typography sx={{ color: M.tealDeep, fontWeight: 900, width: 28 }}>{String(i + 1).padStart(2, '0')}</Typography>
                    <Typography sx={{ color: M.ink, fontWeight: 700, fontSize: '0.95rem' }}>{step}</Typography>
                    {i < evidenceSteps.length - 1 && <ArrowForward sx={{ ml: 'auto', color: M.muted, fontSize: 18 }} />}
                  </Stack>
                ))}
              </Box>
              <Typography sx={{ ...M.small, color: M.muted, mt: 2 }}>
                MeticleCare supports evidence gathering; it does not guarantee a regulatory outcome.
              </Typography>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ═══ 05 · REGULATORS ═══ */}
      <Box component="section" sx={{ bgcolor: M.paper, py: { xs: 9, md: 15 } }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: { xs: 6, md: 8 } }}>
            <EditorialLabel>Regulatory environments</EditorialLabel>
            <Typography component="h2" sx={{ ...M.h1, color: M.ink, mb: 2 }}>Built for regulated care across the UK.</Typography>
            <Typography sx={{ ...M.bodyLg, color: M.slate, maxWidth: 600, mx: 'auto' }}>
              Different nations. Different regulatory frameworks. One platform for managing the records, evidence, people and processes behind your care service.
            </Typography>
          </Box>
          <Grid container spacing={2}>
            {[
              { code: 'CQC', name: 'Care Quality Commission', nation: 'England' },
              { code: 'Care Inspectorate', name: "Scotland's regulator", nation: 'Scotland' },
              { code: 'CIW', name: 'Care Inspectorate Wales', nation: 'Wales' },
              { code: 'RQIA', name: 'Quality authority for NI', nation: 'Northern Ireland' },
            ].map((r) => (
              <Grid item xs={12} sm={6} md={3} key={r.code}>
                <Box
                  component="a"
                  href={`/compliance/${r.code === 'Care Inspectorate' ? 'care-inspectorate' : r.code.toLowerCase()}`}
                  sx={{
                    display: 'block', textDecoration: 'none', color: 'inherit',
                    p: 3, borderRadius: M.r.lg, border: `1px solid ${M.faint}`,
                    borderTop: `2px solid ${M.teal}`, bgcolor: M.card,
                    transition: `border-color ${M.transition.base}`,
                    '&:hover': { borderColor: M.teal },
                  }}
                >
                  <Typography sx={{ ...M.caption, color: M.tealDeep }}>{r.nation}</Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', mt: 1, mb: 0.5 }}>{r.code}</Typography>
                  <Typography sx={{ color: M.muted, fontSize: '0.8rem', lineHeight: 1.5 }}>{r.name}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ═══ 06 · ROLES ═══ */}
      <Box component="section" sx={{ bgcolor: M.navy, color: M.card, py: { xs: 9, md: 15 } }}>
        <Container maxWidth="lg">
          <EditorialLabel light>For the whole care team</EditorialLabel>
          <Typography component="h2" sx={{ ...M.h1, color: M.card, mb: { xs: 6, md: 8 } }}>
            A clearer day for every role.
          </Typography>
          <Box sx={{ borderTop: `1px solid rgba(255,255,255,0.22)` }}>
            {roles.map((item) => (
              <Grid container key={item.role} sx={{ borderBottom: `1px solid rgba(255,255,255,0.22)`, py: 2.5 }}>
                <Grid item xs={12} md={4}>
                  <Typography sx={{ color: M.card, fontWeight: 800 }}>{item.role}</Typography>
                </Grid>
                <Grid item xs={12} md={8}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>{item.text}</Typography>
                </Grid>
              </Grid>
            ))}
          </Box>
        </Container>
      </Box>

      {/* ═══ 07 · SECURITY ═══ */}
      <Box component="section" sx={{ bgcolor: M.paper, py: { xs: 9, md: 15 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 8 }} alignItems="center">
            <Grid item xs={12} md={5}>
              <EditorialLabel>Security</EditorialLabel>
              <Typography component="h2" sx={{ ...M.h1, color: M.ink, mb: 2 }}>Care data deserves serious protection.</Typography>
              <Typography sx={{ ...M.bodyLg, color: M.slate }}>
                Security is a core product concern. Tenant isolation, role-based access, encryption and audit logging are built in from the start.
              </Typography>
            </Grid>
            <Grid item xs={12} md={7}>
              <Box sx={{ borderTop: `1px solid ${M.faint}` }}>
                {[
                  { title: 'UK data hosting', text: 'Data processed and stored in the United Kingdom.' },
                  { title: 'Encryption', text: 'Data encrypted at rest and in transit.' },
                  { title: 'MFA & RBAC', text: 'Multi-factor auth and role-based access control.' },
                  { title: 'Audit logging', text: 'User activity, AI actions and changes recorded.' },
                  { title: 'Tenant isolation', text: 'Organisation data strictly separated.' },
                  { title: 'GDPR-ready', text: 'Privacy by design, data minimisation, SAR support.' },
                ].map((item, i) => (
                  <Stack key={item.title} sx={{ py: 2.5, borderBottom: i < 5 ? `1px solid ${M.faint}` : 'none' }} direction="row" spacing={2} alignItems="flex-start">
                    <Check sx={{ color: M.teal, fontSize: 18, mt: 0.25 }} />
                    <Box>
                      <Typography sx={{ fontWeight: 800, color: M.navy, fontSize: '0.95rem' }}>{item.title}</Typography>
                      <Typography sx={{ color: M.slate, fontSize: '0.88rem', mt: 0.25 }}>{item.text}</Typography>
                    </Box>
                  </Stack>
                ))}
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ═══ 08 · MOBILE ═══ */}
      <Box component="section" sx={{ bgcolor: M.card, borderBottom: `1px solid ${M.faint}`, py: { xs: 9, md: 15 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={6} sx={{ display: 'flex', justifyContent: 'center' }}>
              <Box sx={{
                width: 260, height: 520, borderRadius: '28px',
                border: `3px solid ${M.subtle}`, bgcolor: M.card,
                boxShadow: M.shadow.xl, display: 'flex', flexDirection: 'column', overflow: 'hidden',
              }}>
                <Box sx={{ height: 36, bgcolor: M.faint, borderBottom: `1px solid ${M.faint}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Box sx={{ width: 72, height: 18, borderRadius: 9, bgcolor: M.subtle }} />
                </Box>
                <Box sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ height: 28, borderRadius: M.r.sm, bgcolor: M.tealSoft }} />
                  <Box sx={{ height: 14, width: '55%', borderRadius: M.r.sm, bgcolor: M.faint }} />
                  <Box sx={{ flex: 1, borderRadius: M.r.md, bgcolor: M.faint }} />
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Box sx={{ flex: 1, height: 64, borderRadius: M.r.sm, bgcolor: M.tealSoft }} />
                    <Box sx={{ flex: 1, height: 64, borderRadius: M.r.sm, bgcolor: M.faint }} />
                  </Box>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <EditorialLabel>Mobile app</EditorialLabel>
              <Typography component="h2" sx={{ ...M.h1, color: M.ink, mb: 2 }}>
                Care doesn't happen behind a desk.
              </Typography>
              <Typography sx={{ ...M.bodyLg, color: M.slate, mb: 4 }}>
                Give carers a focused mobile experience for the work in front of them — check in, record notes, report disruptions, view care plans and access client information.
              </Typography>
              <Stack spacing={1.5} sx={{ mb: 4 }}>
                {['Care notes at the point of care', 'Availability and leave workflows', 'Client records, care plans and risk assessments', 'Shift marketplace and open-call pickup', 'Chat, notifications and team communication'].map((item) => (
                  <Stack key={item} direction="row" spacing={1.5} alignItems="center">
                    <Check sx={{ color: M.teal, fontSize: 17 }} />
                    <Typography sx={{ fontWeight: 500 }}>{item}</Typography>
                  </Stack>
                ))}
              </Stack>
              <CTA label="Download the app" to="/download" variant="secondary" />
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ═══ 09 · FINAL CTA ═══ */}
      <Box component="section" sx={{ bgcolor: M.navy, color: M.card, py: { xs: 10, md: 16 } }}>
        <Container maxWidth="md" sx={{ textAlign: 'center' }}>
          <Typography component="h2" sx={{ ...M.h2, color: M.card, mb: 2, fontSize: { xs: '1.75rem', md: '2.25rem' } }}>
            See how the working day comes together.
          </Typography>
          <Typography sx={{ ...M.bodyLg, color: 'rgba(255,255,255,0.65)', mb: 4, maxWidth: 480, mx: 'auto' }}>
            Explore the platform, compare domiciliary and supported living workflows, and talk to the team about your service.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <CTA />
            <CTA label="Explore solutions" to="/solutions/domiciliary-care" variant="ghost" />
          </Stack>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
