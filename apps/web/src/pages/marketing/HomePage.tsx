import { Box, Button, Container, Grid, Stack, Typography } from '@mui/material'
import {
  ArrowForward, Check, Shield, Warning, Insights, AutoAwesome,
  TrendingUp, People, Security, VerifiedUser, Lock, Star,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { P, T, R, S, X } from '../../styles/tokens'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'

/* ─── Primitives ────────────────────────────────────── */

function Tag({ children, color = P.teal }: { children: React.ReactNode; color?: string }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 2.5 }}>
      <Box sx={{ width: 6, height: 6, borderRadius: R.full, bgcolor: color }} />
      <Typography sx={{ ...T.overline, color, textTransform: 'uppercase' }}>{children}</Typography>
    </Stack>
  )
}

function CTA({
  label = 'Book a demo', to = '/contact', variant = 'primary',
}: { label?: string; to?: string; variant?: 'primary' | 'secondary' | 'ghost' }) {
  const nav = useNavigate()
  const styles = {
    primary: { bgcolor: P.teal, color: P.navy, fontWeight: 700, '&:hover': { bgcolor: P.tealDark } },
    secondary: { bgcolor: 'transparent', color: P.navy, border: `1.5px solid ${P.subtle}`, fontWeight: 600, '&:hover': { borderColor: P.navy, bgcolor: P.faint } },
    ghost: { bgcolor: 'transparent', color: '#fff', border: '1.5px solid rgba(255,255,255,0.2)', fontWeight: 600, '&:hover': { borderColor: 'rgba(255,255,255,0.5)' } },
  }
  return (
    <Button
      variant="contained" endIcon={<ArrowForward />}
      onClick={() => nav(to)}
      sx={{ px: 3.5, py: 1.5, borderRadius: R.md, textTransform: 'none', fontSize: '0.9rem', ...styles[variant] }}
    >{label}</Button>
  )
}

/* ─── Data ──────────────────────────────────────────── */

const platformTree = [
  {
    group: 'Care', color: '#6366F1',
    items: ['Care notes', 'Support plans', 'Reviews', 'Body mapping', 'Appointments'],
  },
  {
    group: 'Workforce', color: '#EC4899',
    items: ['Staff profiles', 'Training', 'Competency', 'Availability', 'Rota'],
  },
  {
    group: 'Compliance', color: '#8B5CF6',
    items: ['Audit trails', 'Evidence', 'Reporting', 'Competency', 'Policies'],
  },
]

const evidenceFlow = [
  'Deliver care',
  'Record care notes',
  'Manage medication',
  'Track risks',
  'Record incidents',
  'Review people',
  'Monitor competency',
  'Track training',
  'Audit',
  'Report',
  'Maintain evidence',
]

const trustItems = [
  { icon: VerifiedUser, label: 'UK data hosting' },
  { icon: Lock, label: 'Encryption at rest & in transit' },
  { icon: Shield, label: 'MFA & RBAC' },
  { icon: Insights, label: 'Full audit trail' },
  { icon: Security, label: 'Tenant isolation' },
  { icon: Star, label: 'GDPR-ready' },
]

/* ─── Page ──────────────────────────────────────────── */

export default function HomePage() {
  const nav = useNavigate()

  return (
    <MarketingLayout>
      <PageMeta
        title="Care operations, unified"
        description="MeticleCare connects care delivery, scheduling, medication, risk, compliance, workforce and reporting in one platform for UK domiciliary and supported living providers."
        canonicalPath="/"
        structuredData={{ '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'MeticleCare', applicationCategory: 'BusinessApplication', operatingSystem: 'Web and mobile' }}
      />

      {/* ═══ HERO ═══ */}
      <Box sx={{
        background: `linear-gradient(165deg, ${P.navy} 0%, ${P.navyMid} 55%, ${P.navyLight} 100%)`,
        pt: { xs: 12, md: 20 }, pb: { xs: 10, md: 16 }, position: 'relative', overflow: 'hidden',
      }}>
        {/* Subtle grid */}
        <Box sx={{
          position: 'absolute', inset: 0, opacity: 0.025,
          backgroundImage: `linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }} />
        {/* Glow */}
        <Box sx={{ position: 'absolute', top: -120, right: -80, width: 500, height: 500, borderRadius: '50%', background: `radial-gradient(circle, ${P.teal}12 0%, transparent 70%)` }} />

        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <Tag color={P.teal}>Care operations software</Tag>
          <Typography sx={{ ...T.display, color: '#fff', mb: 3 }}>
            Run your care operation with confidence.
          </Typography>
          <Typography sx={{ ...T.bodyLg, color: 'rgba(255,255,255,0.55)', mb: 5, maxWidth: 600, mx: 'auto' }}>
            MeticleCare connects care delivery, workforce management, compliance, medication, reporting and intelligent automation in one platform for UK domiciliary and supported living providers.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <CTA />
            <CTA label="Explore the platform" to="/platform" variant="ghost" />
          </Stack>
          <Stack direction="row" spacing={5} justifyContent="center" sx={{ mt: 6 }}>
            {[
              { v: '4', l: 'UK nations' },
              { v: '24/7', l: 'Mobile access' },
              { v: '100%', l: 'Audit-tracked' },
            ].map((s) => (
              <Stack key={s.l} alignItems="center" spacing={0.5}>
                <Typography sx={{ fontSize: { xs: '1.5rem', md: '1.75rem' }, fontWeight: 800, color: P.teal, letterSpacing: '-0.03em' }}>{s.v}</Typography>
                <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', textAlign: 'center' }}>{s.l}</Typography>
              </Stack>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* ═══ TRUST BAR ═══ */}
      <Box sx={{ bgcolor: P.card, borderBottom: `1px solid ${P.faint}`, py: 2.5 }}>
        <Container maxWidth="lg">
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1.5, sm: 4 }} alignItems="center" justifyContent="center" useFlexGap>
            {trustItems.map((t) => (
              <Stack key={t.label} direction="row" spacing={0.75} alignItems="center">
                <t.icon sx={{ fontSize: 15, color: P.teal }} />
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 500, color: P.slate, whiteSpace: 'nowrap' }}>{t.label}</Typography>
              </Stack>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* ═══ CONNECTED OPERATING SYSTEM ═══ */}
      <Box sx={{ py: L.sectionPy, bgcolor: P.paper }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Tag>Connected platform</Tag>
            <Typography sx={{ ...T.h1, mb: 2 }}>One platform. Every part of your care operation.</Typography>
            <Typography sx={{ ...T.bodyLg, color: P.slate, maxWidth: 560, mx: 'auto' }}>
              Not a collection of disconnected modules. A connected operating system where care records, workforce, compliance and intelligence share context.
            </Typography>
          </Box>

          {/* Visual: connected tree */}
          <Box sx={{
            p: { xs: 3, md: 5 }, bgcolor: P.card, borderRadius: R.xl,
            border: `1px solid ${P.faint}`, boxShadow: S.md, position: 'relative',
          }}>
            {/* Central label */}
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Typography sx={{ ...T.overline, color: P.muted, mb: 0.5, display: 'block' }}>MeticleCare</Typography>
              <Typography sx={{ ...T.h2, color: P.navy }}>Everything is connected.</Typography>
            </Box>

            <Grid container spacing={3}>
              {platformTree.map((col) => (
                <Grid item xs={12} md={4} key={col.group}>
                  <Box sx={{
                    p: 2.5, borderRadius: R.lg, border: `1px solid ${P.faint}`,
                    borderTop: `3px solid ${col.color}`,
                  }}>
                    <Typography sx={{ ...T.overline, color: col.color, mb: 1.5, display: 'block' }}>{col.group}</Typography>
                    <Stack spacing={1}>
                      {col.items.map((item) => (
                        <Stack key={item} direction="row" spacing={1} alignItems="center">
                          <Box sx={{ width: 5, height: 5, borderRadius: R.full, bgcolor: col.color, opacity: 0.4 }} />
                          <Typography sx={{ fontSize: '0.88rem', fontWeight: 500 }}>{item}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                </Grid>
              ))}
            </Grid>

            {/* Intelligence layer */}
            <Box sx={{
              mt: 3, p: 2.5, borderRadius: R.lg,
              background: `linear-gradient(135deg, ${P.tealLight} 0%, ${P.indigoLight} 100%)`,
              border: `1px solid ${P.teal}30`,
              textAlign: 'center',
            }}>
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
                <AutoAwesome sx={{ fontSize: 18, color: P.tealDeep }} />
                <Typography sx={{ ...T.label, color: P.tealDeep }}>Intelligence layer — AI summaries, change detection, risk signals, compliance copilot</Typography>
              </Stack>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* ═══ INSPECTION READINESS ═══ */}
      <Box sx={{ py: L.sectionPy, bgcolor: P.card }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={5}>
              <Tag>Inspection readiness</Tag>
              <Typography sx={{ ...T.h1, mb: 2 }}>Stay ready for inspection. Every day.</Typography>
              <Typography sx={{ ...T.bodyLg, color: P.slate, mb: 3 }}>
                Compliance shouldn't begin when an inspection is announced. MeticleCare helps make good governance part of everyday care operations.
              </Typography>
              <Typography sx={{ ...T.body, color: P.slate, mb: 4 }}>
                Requirements differ across England, Scotland, Wales and Northern Ireland. The platform supports your team's evidence and governance work without claiming to guarantee any regulatory outcome.
              </Typography>
              <CTA label="Explore compliance" to="/compliance" variant="secondary" />
            </Grid>
            <Grid item xs={12} md={7}>
              {/* Readiness dashboard mockup */}
              <Box sx={{ p: { xs: 3, md: 4 }, bgcolor: P.paper, borderRadius: R.xl, border: `1px solid ${P.faint}` }}>
                <Typography sx={{ ...T.label, color: P.muted, mb: 2.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Inspection readiness</Typography>
                <Grid container spacing={2}>
                  {[
                    { label: 'Care records', value: '98%', color: P.green },
                    { label: 'Reviews', value: '96%', color: P.green },
                    { label: 'Training', value: '94%', color: P.amber },
                    { label: 'Competency', value: '97%', color: P.green },
                    { label: 'Risk reviews', value: '99%', color: P.green },
                    { label: 'Open actions', value: '3', color: P.red },
                  ].map((m) => (
                    <Grid item xs={4} key={m.label}>
                      <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: R.md, bgcolor: P.card, border: `1px solid ${P.faint}` }}>
                        <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: m.color, letterSpacing: '-0.03em' }}>{m.value}</Typography>
                        <Typography sx={{ fontSize: '0.72rem', color: P.muted, mt: 0.25 }}>{m.label}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
                <Box sx={{ mt: 2.5, p: 2, borderRadius: R.md, bgcolor: P.card, border: `1px solid ${P.faint}` }}>
                  <Typography sx={{ ...T.label, color: P.muted, mb: 1 }}>Needs attention</Typography>
                  <Stack spacing={0.75}>
                    {[
                      { text: 'Training renewal', count: 2, color: P.amber },
                      { text: 'Reviews due', count: 4, color: P.amber },
                      { text: 'Risk review', count: 2, color: P.red },
                    ].map((a) => (
                      <Stack key={a.text} direction="row" justifyContent="space-between" alignItems="center">
                        <Typography sx={{ fontSize: '0.82rem', fontWeight: 500 }}>{a.text}</Typography>
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: a.color, bgcolor: `${a.color}15`, px: 1, py: 0.25, borderRadius: R.sm }}>{a.count}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ═══ FOUR NATIONS ═══ */}
      <Box sx={{ py: L.sectionPy, bgcolor: P.paper }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Tag>Regulatory environments</Tag>
            <Typography sx={{ ...T.h1, mb: 2 }}>Built for regulated care across the UK.</Typography>
            <Typography sx={{ ...T.bodyLg, color: P.slate, maxWidth: 600, mx: 'auto' }}>
              Different nations. Different regulatory frameworks. One platform for managing the records, evidence, people and processes behind your care service.
            </Typography>
          </Box>
          <Grid container spacing={2.5}>
            {[
              { code: 'CQC', name: 'Care Quality Commission', nation: 'England', color: '#2563EB' },
              { code: 'Care Inspectorate', name: 'Scotland\'s regulator', nation: 'Scotland', color: '#DC2626' },
              { code: 'CIW', name: 'Care Inspectorate Wales', nation: 'Wales', color: '#059669' },
              { code: 'RQIA', name: 'Quality authority for NI', nation: 'Northern Ireland', color: '#7C3AED' },
            ].map((r) => (
              <Grid item xs={12} sm={6} md={3} key={r.code}>
                <Box
                  component="a"
                  href={`/compliance/${r.code === 'Care Inspectorate' ? 'care-inspectorate' : r.code.toLowerCase()}`}
                  sx={{
                    display: 'block', textDecoration: 'none', color: 'inherit',
                    p: 3, borderRadius: R.lg, border: `1px solid ${P.faint}`,
                    borderLeft: `3px solid ${r.color}`, height: '100%', bgcolor: P.card,
                    transition: `all ${X.base}`,
                    '&:hover': { borderColor: r.color, boxShadow: S.md, transform: 'translateY(-2px)' },
                  }}
                >
                  <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: r.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{r.nation}</Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', mt: 1, mb: 0.5 }}>{r.code}</Typography>
                  <Typography sx={{ color: P.muted, fontSize: '0.8rem', lineHeight: 1.5 }}>{r.name}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ═══ EVIDENCE FLOW ═══ */}
      <Box sx={{ py: L.sectionPy, bgcolor: P.card }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={5}>
              <Tag>How evidence is created</Tag>
              <Typography sx={{ ...T.h2, mb: 2 }}>Evidence created through everyday work.</Typography>
              <Typography sx={{ ...T.bodyLg, color: P.slate }}>
                When your team delivers care, records medication, tracks risks and manages incidents in one system, inspection evidence is created continuously — not assembled under pressure.
              </Typography>
            </Grid>
            <Grid item xs={12} md={7}>
              <Stack spacing={0}>
                {evidenceFlow.map((step, i) => (
                  <Stack key={step} direction="row" spacing={2} alignItems="center" sx={{
                    py: 1.5,
                    borderBottom: i < evidenceFlow.length - 1 ? `1px solid ${P.faint}` : 'none',
                  }}>
                    <Box sx={{
                      width: 28, height: 28, borderRadius: R.sm,
                      bgcolor: i === evidenceFlow.length - 1 ? P.teal : P.faint,
                      color: i === evidenceFlow.length - 1 ? P.navy : P.muted,
                      display: 'grid', placeItems: 'center',
                      fontWeight: 700, fontSize: '0.72rem', flexShrink: 0,
                    }}>{i + 1}</Box>
                    <Typography sx={{ fontWeight: i === evidenceFlow.length - 1 ? 700 : 500, color: i === evidenceFlow.length - 1 ? P.tealDeep : P.slate }}>{step}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ═══ TWO SOLUTIONS ═══ */}
      <Box sx={{ py: L.sectionPy, bgcolor: P.paper }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Tag>Solutions</Tag>
            <Typography sx={{ ...T.h1, mb: 2 }}>Built for how you actually work.</Typography>
          </Box>
          <Grid container spacing={3}>
            {[
              {
                title: 'Domiciliary Care', tagline: 'From the office to the doorstep.',
                points: ['Visit scheduling with real-time status', 'Mobile check-in, notes, travel and disruptions', 'Carer availability and open-call marketplace', 'Missed-call follow-up and escalation', 'Timesheet and payroll export'],
                path: '/solutions/domiciliary-care', accent: P.teal,
              },
              {
                title: 'Supported Living', tagline: 'Connected around the person.',
                points: ['Person-centred support plans and daily notes', 'Medication, body mapping and MAR workflows', 'Risk assessments, incidents and safeguarding', 'Rota, staff, training and competency', 'Reviews, reporting and compliance evidence'],
                path: '/solutions/supported-living', accent: P.indigo,
              },
            ].map((sol) => (
              <Grid item xs={12} md={6} key={sol.title}>
                <Box sx={{
                  p: { xs: 3.5, md: 4.5 }, bgcolor: P.card, borderRadius: R.xl,
                  border: `1px solid ${P.faint}`, height: '100%',
                  borderTop: `3px solid ${sol.accent}`,
                  transition: `all ${X.base}`,
                  '&:hover': { boxShadow: S.lg },
                }}>
                  <Typography sx={{ ...T.overline, color: sol.accent, mb: 1 }}>{sol.title}</Typography>
                  <Typography sx={{ ...T.h2, mb: 3 }}>{sol.tagline}</Typography>
                  <Stack spacing={1.5} sx={{ mb: 4 }}>
                    {sol.points.map((pt) => (
                      <Stack key={pt} direction="row" spacing={1.5} alignItems="flex-start">
                        <Check sx={{ color: sol.accent, fontSize: 17, mt: 0.3 }} />
                        <Typography sx={{ fontWeight: 500, lineHeight: 1.5 }}>{pt}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                  <Button endIcon={<ArrowForward />} onClick={() => nav(sol.path)} sx={{ color: sol.accent, fontWeight: 700, px: 0, textTransform: 'none' }}>Learn more</Button>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ═══ AI INTELLIGENCE ═══ */}
      <Box sx={{
        py: L.sectionPy,
        background: `linear-gradient(165deg, ${P.navy} 0%, ${P.navyMid} 55%, ${P.navyLight} 100%)`,
        position: 'relative', overflow: 'hidden',
      }}>
        <Box sx={{ position: 'absolute', top: -100, right: -80, width: 400, height: 400, borderRadius: '50%', background: `radial-gradient(circle, ${P.teal}08 0%, transparent 70%)` }} />
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <Tag color="rgba(255,255,255,0.5)">AI & Intelligence</Tag>
              <Typography sx={{ ...T.h1, color: '#fff', mb: 2 }}>AI that works with your care team.</Typography>
              <Typography sx={{ ...T.bodyLg, color: 'rgba(255,255,255,0.5)', mb: 4 }}>
                Intelligence embedded throughout MeticleCare — not a separate chatbot. AI analyses the data your team already creates, surfaces patterns and generates briefings — with source traceability and human review at the centre.
              </Typography>
              <CTA label="See intelligence features" to="/features/ai" variant="ghost" />
            </Grid>
            <Grid item xs={12} md={6}>
              <Stack spacing={2}>
                {[
                  { icon: AutoAwesome, title: 'Care summaries', desc: '7, 14 or 30-day person summaries linked to source records.' },
                  { icon: TrendingUp, title: 'Change detection', desc: 'Surfaces changes across notes, incidents, missed calls and medication.' },
                  { icon: Warning, title: 'Risk signals', desc: 'Deterministic signals with AI explanations — not diagnoses.' },
                  { icon: Insights, title: 'Compliance copilot', desc: 'Training gaps, overdue reviews and evidence that may need attention.' },
                  { icon: People, title: 'Manager briefing', desc: 'End-of-day intelligence covering people, workforce and operations.' },
                ].map((f) => (
                  <Box key={f.title} sx={{
                    p: 2.5, borderRadius: R.md,
                    border: '1px solid rgba(255,255,255,0.06)',
                    bgcolor: 'rgba(255,255,255,0.03)',
                    transition: `border-color ${X.fast}`,
                    '&:hover': { borderColor: P.teal },
                  }}>
                    <Stack direction="row" spacing={2} alignItems="flex-start">
                      <Box sx={{ width: 36, height: 36, borderRadius: R.sm, bgcolor: `${P.teal}15`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <f.icon sx={{ color: P.teal, fontSize: 18 }} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>{f.title}</Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', lineHeight: 1.5, mt: 0.25 }}>{f.desc}</Typography>
                      </Box>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ═══ MOBILE ═══ */}
      <Box sx={{ py: L.sectionPy, bgcolor: P.paper }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={6} sx={{ display: 'flex', justifyContent: 'center' }}>
              <Box sx={{
                width: 260, height: 520, borderRadius: '28px',
                border: `3px solid ${P.subtle}`, bgcolor: P.card,
                boxShadow: S.xl, display: 'flex', flexDirection: 'column', overflow: 'hidden',
              }}>
                <Box sx={{ height: 36, bgcolor: P.faint, borderBottom: `1px solid ${P.faint}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Box sx={{ width: 72, height: 18, borderRadius: 9, bgcolor: P.subtle }} />
                </Box>
                <Box sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ height: 28, borderRadius: R.sm, bgcolor: P.tealLight }} />
                  <Box sx={{ height: 14, width: '55%', borderRadius: R.sm, bgcolor: P.faint }} />
                  <Box sx={{ flex: 1, borderRadius: R.md, bgcolor: P.faint }} />
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Box sx={{ flex: 1, height: 64, borderRadius: R.sm, bgcolor: P.tealLight }} />
                    <Box sx={{ flex: 1, height: 64, borderRadius: R.sm, bgcolor: P.faint }} />
                  </Box>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Tag>Mobile app</Tag>
              <Typography sx={{ ...T.h1, mb: 2 }}>Care doesn't happen behind a desk.</Typography>
              <Typography sx={{ ...T.bodyLg, color: P.slate, mb: 4 }}>
                Give carers a focused mobile experience for the work in front of them — check in, record notes, report disruptions, view care plans and access client information. Available for iOS and Android.
              </Typography>
              <Stack spacing={1.5} sx={{ mb: 4 }}>
                {['Care notes at the point of care', 'Availability and leave workflows', 'Client records, care plans and risk assessments', 'Shift marketplace and open-call pickup', 'Chat, notifications and team communication'].map((item) => (
                  <Stack key={item} direction="row" spacing={1.5} alignItems="center">
                    <Check sx={{ color: P.teal, fontSize: 17 }} />
                    <Typography sx={{ fontWeight: 500 }}>{item}</Typography>
                  </Stack>
                ))}
              </Stack>
              <CTA label="Download the app" to="/download" variant="secondary" />
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ═══ SECURITY ═══ */}
      <Box sx={{ py: L.sectionPy, bgcolor: P.card }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Tag>Security</Tag>
            <Typography sx={{ ...T.h1, mb: 2 }}>Care data deserves serious protection.</Typography>
            <Typography sx={{ ...T.bodyLg, color: P.slate, maxWidth: 520, mx: 'auto' }}>
              Security is a core product concern. Tenant isolation, role-based access, encryption and audit logging are built in from the start.
            </Typography>
          </Box>
          <Grid container spacing={2}>
            {[
              { icon: VerifiedUser, title: 'UK data hosting', desc: 'Data processed and stored in the United Kingdom.' },
              { icon: Lock, title: 'Encryption', desc: 'Data encrypted at rest and in transit (TLS).' },
              { icon: Shield, title: 'MFA & RBAC', desc: 'Multi-factor auth and role-based access control.' },
              { icon: Insights, title: 'Audit logging', desc: 'User activity, AI actions and changes recorded.' },
              { icon: Security, title: 'Tenant isolation', desc: 'Organisation data strictly separated.' },
              { icon: Star, title: 'GDPR-ready', desc: 'Privacy by design, data minimisation, SAR support.' },
            ].map((t) => (
              <Grid item xs={12} sm={6} md={4} key={t.title}>
                <Box sx={{
                  p: 3, borderRadius: R.lg, border: `1px solid ${P.faint}`, height: '100%',
                  transition: `all ${X.base}`, '&:hover': { borderColor: P.teal, boxShadow: S.md },
                }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: R.md, bgcolor: P.tealLight, display: 'grid', placeItems: 'center', mb: 2 }}>
                    <t.icon sx={{ color: P.tealDeep, fontSize: 20 }} />
                  </Box>
                  <Typography sx={{ fontWeight: 600, mb: 0.75 }}>{t.title}</Typography>
                  <Typography sx={{ color: P.slate, fontSize: '0.85rem', lineHeight: 1.55 }}>{t.desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ═══ BLOG ═══ */}
      <Box sx={{ py: L.sectionPy, bgcolor: P.paper }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Tag>Resources</Tag>
            <Typography sx={{ ...T.h1, mb: 2 }}>Ideas for better care operations.</Typography>
            <Typography sx={{ ...T.bodyLg, color: P.slate, maxWidth: 480, mx: 'auto' }}>
              Practical guidance on care technology, compliance and operations.
            </Typography>
          </Box>
          <Grid container spacing={3}>
            {[
              { slug: 'inspection-ready-care-records', title: 'What inspection-ready care records look like in practice', category: 'Compliance', time: '6 min' },
              { slug: 'domiciliary-care-scheduling', title: 'A practical approach to domiciliary care scheduling', category: 'Domiciliary care', time: '5 min' },
              { slug: 'responsible-ai-in-care', title: 'Using AI responsibly in care operations', category: 'AI & care', time: '7 min' },
            ].map((a) => (
              <Grid item xs={12} md={4} key={a.slug}>
                <Box
                  component="a" href={`/blog/${a.slug}`}
                  sx={{
                    display: 'block', textDecoration: 'none', color: 'inherit',
                    p: 3, borderRadius: R.lg, border: `1px solid ${P.faint}`, bgcolor: P.card, height: '100%',
                    transition: `all ${X.base}`,
                    '&:hover': { borderColor: P.teal, boxShadow: S.md },
                  }}
                >
                  <Typography sx={{ ...T.overline, color: P.teal, mb: 1.5, display: 'block' }}>{a.category}</Typography>
                  <Typography sx={{ fontWeight: 600, lineHeight: 1.4, mb: 2 }}>{a.title}</Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: P.muted }}>{a.time} read</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ═══ FINAL CTA ═══ */}
      <Box sx={{
        py: { xs: 10, md: 16 },
        background: `linear-gradient(165deg, ${P.navy} 0%, ${P.navyMid} 55%, ${P.navyLight} 100%)`,
        textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        <Box sx={{ position: 'absolute', bottom: -80, left: '50%', transform: 'translateX(-50%)', width: 500, height: 500, borderRadius: '50%', background: `radial-gradient(circle, ${P.teal}08 0%, transparent 70%)` }} />
        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
          <Typography sx={{ ...T.display, color: '#fff', mb: 2 }}>
            Run your care operation with more clarity.
          </Typography>
          <Typography sx={{ ...T.bodyLg, color: 'rgba(255,255,255,0.5)', mb: 5, maxWidth: 480, mx: 'auto' }}>
            See how MeticleCare connects care delivery, workforce, compliance and reporting. Talk to the team about your service.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <CTA />
            <CTA label="Explore the platform" to="/platform" variant="ghost" />
          </Stack>
        </Container>
      </Box>
    </MarketingLayout>
  )
}

const L = { sectionPy: { xs: 8, md: 14 } }
