import { Box, Button, Container, Grid, Stack, Typography } from '@mui/material'
import {
  ArrowForward, Check, Shield, Insights, Security, VerifiedUser, Lock, Star,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { M } from '../../styles/marketing-tokens'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'

/* Hallmark · modern-minimal · Split Studio — alternating care workflow and platform proof. */

function CTA({
  label = 'Book a demo', to = '/contact', variant = 'primary',
}: { label?: string; to?: string; variant?: 'primary' | 'secondary' }) {
  const nav = useNavigate()
  const styles = {
    primary: {
      // Navy with white text keeps the primary action high-contrast; emerald
      // remains an accent rather than a button fill with low-contrast white text.
      bgcolor: M.navy, color: '#FFFFFF', fontWeight: 700,
      '&:hover': { bgcolor: M.navyMid },
    },
    secondary: {
      bgcolor: 'transparent', color: M.ink,
      border: `1.5px solid ${M.subtle}`, fontWeight: 600,
      '&:hover': { borderColor: M.navy, bgcolor: M.faint },
    },
  }
  return (
    <Button
      variant="contained" endIcon={<ArrowForward />}
      onClick={() => nav(to)}
      sx={{ px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.9rem', ...styles[variant] }}
    >{label}</Button>
  )
}

/* ─── Data ──────────────────────────────────────────── */

const careDay = [
  { step: 'Plan', desc: 'Schedule visits, assign carers, review availability' },
  { step: 'Deliver', desc: 'Mobile check-in, care notes, travel and disruptions' },
  { step: 'Record', desc: 'Medication, risks, incidents, body maps' },
  { step: 'Review', desc: 'Compliance evidence, person reviews, reporting' },
]

const aiCapabilities = [
  { title: 'Care summaries', desc: '7, 14 or 30-day person summaries linked to source records.' },
  { title: 'Record change summaries', desc: 'Compares the two halves of a period you choose, across notes, incidents, missed calls and medication.' },
  { title: 'Risk signals', desc: 'Deterministic signals with AI explanations — not diagnoses.' },
  { title: 'Compliance copilot', desc: 'Training gaps, overdue reviews and evidence that may need attention.' },
  { title: 'Manager briefing', desc: 'End-of-day intelligence covering people, workforce and operations.' },
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
      <Box sx={{ bgcolor: M.card, pt: { xs: 7, md: 12 }, pb: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 5, md: 9 }} alignItems="center">
            <Grid item xs={12} md={7}>
              <Typography component="h1" sx={{ ...M.display, color: M.ink, mb: 3 }}>
                Run your care operation with confidence.
              </Typography>
              <Typography sx={{ ...M.bodyLg, color: M.slate, mb: 4, maxWidth: 560 }}>
                One platform connecting care delivery, workforce, compliance, medication and reporting for UK domiciliary and supported living providers.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <CTA />
                <Button
                  variant="outlined" endIcon={<ArrowForward />}
                  onClick={() => nav('/platform')}
                  sx={{
                    px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none',
                    fontSize: '0.9rem', fontWeight: 600, color: M.ink,
                    borderColor: M.subtle, '&:hover': { borderColor: M.navy, bgcolor: M.paper },
                  }}
                >Explore the platform</Button>
              </Stack>
            </Grid>
            <Grid item xs={12} md={5}>
              <Box sx={{ p: { xs: 2.5, sm: 3.5 }, borderRadius: M.r.lg, bgcolor: M.paper, border: `1px solid ${M.faint}` }}>
                <Typography sx={{ ...M.overline, color: M.navy, mb: 1.5, display: 'block' }}>A connected care day</Typography>
                <Stack spacing={0}>
                  {careDay.map((c, i) => (
                    <Stack key={c.step} direction="row" spacing={2} alignItems="flex-start" sx={{ py: 1.5, borderBottom: i < careDay.length - 1 ? `1px solid ${M.faint}` : 'none' }}>
                      <Box sx={{
                        width: 32, height: 32, borderRadius: '50%', bgcolor: M.card, border: `1px solid ${M.subtle}`,
                        display: 'grid', placeItems: 'center', flexShrink: 0,
                      }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: M.navy }}>{i + 1}</Typography>
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700, color: M.ink, fontSize: '0.95rem', mb: 0.25 }}>{c.step}</Typography>
                        <Typography sx={{ color: M.slate, fontSize: '0.84rem', lineHeight: 1.5 }}>{c.desc}</Typography>
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ═══ 02 · CONNECTED PLATFORM ═══ */}
      <Box sx={{ py: { xs: 8, md: 14 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 8 }} alignItems="center">
            <Grid item xs={12} md={5}>
              <Typography sx={{ ...M.h1, mb: 2 }}>One platform. Every part of your care operation.</Typography>
              <Typography sx={{ ...M.bodyLg, color: M.slate }}>
                Not a collection of disconnected modules. A connected operating system where care records, workforce, compliance and intelligence share context.
              </Typography>
            </Grid>
            <Grid item xs={12} md={7}>
              <Stack spacing={2}>
                {[
                  { group: 'Care', items: 'Care notes · Support plans · Reviews · Body mapping · Appointments', color: M.tealDeep },
                  { group: 'Workforce', items: 'Staff profiles · Training · Competency · Availability · Rota', color: M.navy },
                  { group: 'Compliance', items: 'Audit trails · Evidence · Reporting · Policies', color: M.tealDeep },
                ].map((col) => (
                  <Box key={col.group} sx={{
                    p: 3, borderRadius: M.r.lg, border: `1px solid ${M.faint}`, bgcolor: M.card,
                    transition: `all ${M.transition.base}`,
                    '&:hover': { boxShadow: M.shadow.md, borderColor: col.color },
                  }}>
                    <Typography sx={{ ...M.overline, color: col.color, mb: 0.5, display: 'block' }}>{col.group}</Typography>
                    <Typography sx={{ fontSize: '0.88rem', fontWeight: 500, color: M.slate }}>{col.items}</Typography>
                  </Box>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ═══ 03 · INSPECTION READINESS ═══ */}
      <Box sx={{ py: { xs: 8, md: 14 }, bgcolor: M.card, borderTop: `1px solid ${M.faint}`, borderBottom: `1px solid ${M.faint}` }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 8 }} alignItems="center">
            <Grid item xs={12} md={5}>
              <Typography sx={{ ...M.h1, mb: 2 }}>Stay ready for inspection. Every day.</Typography>
              <Typography sx={{ ...M.bodyLg, color: M.slate, mb: 3 }}>
                Compliance should be part of everyday operations — not something assembled when an inspection is announced.
              </Typography>
              <Typography sx={{ ...M.body, color: M.slate, mb: 4 }}>
                Requirements differ across England, Scotland, Wales and Northern Ireland. MeticleCare tracks what matters for your regulatory environment.
              </Typography>
              <CTA label="Explore compliance" to="/compliance" variant="secondary" />
            </Grid>
            <Grid item xs={12} md={7}>
              <Box sx={{ p: { xs: 3, md: 4 }, bgcolor: M.paper, borderRadius: M.r.xl, border: `1px solid ${M.faint}` }}>
                <Typography sx={{ ...M.label, color: M.slate, mb: 2.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Readiness</Typography>
                <Stack spacing={1.5}>
                  {[
                    { label: 'Care records', status: 'Daily work' },
                    { label: 'Reviews', status: 'People' },
                    { label: 'Training', status: 'Workforce' },
                    { label: 'Competency', status: 'Workforce' },
                    { label: 'Risk assessments', status: 'Care' },
                    { label: 'Open actions', status: 'Follow-up' },
                  ].map((m) => (
                    <Stack key={m.label} direction="row" justifyContent="space-between" alignItems="center"
                      sx={{ py: 1.5, borderBottom: `1px solid ${M.faint}` }}>
                      <Typography sx={{ fontWeight: 500, fontSize: '0.9rem' }}>{m.label}</Typography>
                      <Typography sx={{
                        fontSize: '0.78rem', fontWeight: 600, color: M.navy,
                        bgcolor: M.card, px: 1.5, py: 0.5, borderRadius: M.r.sm,
                      }}>{m.status}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ═══ 04 · FOUR NATIONS ═══ */}
      <Box sx={{ py: { xs: 8, md: 14 }, bgcolor: M.card }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography sx={{ ...M.h1, mb: 2 }}>Built for regulated care across the UK.</Typography>
            <Typography sx={{ ...M.bodyLg, color: M.slate, maxWidth: 600, mx: 'auto' }}>
              Different nations. Different regulatory frameworks. One platform for managing the records, evidence, people and processes behind your care service.
            </Typography>
          </Box>
          <Grid container spacing={2.5}>
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
                    p: 3, borderRadius: M.r.lg, border: `1px solid ${M.faint}`, height: '100%', bgcolor: M.card,
                    transition: `all ${M.transition.base}`,
                    '&:hover': { borderColor: M.navy, boxShadow: M.shadow.md, transform: 'translateY(-2px)' },
                    '&:focus-visible': { outline: `2px solid ${M.navy}`, outlineOffset: 2 },
                  }}
                >
                  <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: M.tealDeep, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{r.nation}</Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', mt: 1, mb: 0.5 }}>{r.code}</Typography>
                  <Typography sx={{ color: M.muted, fontSize: '0.8rem', lineHeight: 1.5 }}>{r.name}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ═══ 05 · SOLUTIONS ═══ */}
      <Box sx={{ py: { xs: 8, md: 14 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography sx={{ ...M.h1, mb: 2 }}>Built for how you actually work.</Typography>
          </Box>
          <Grid container spacing={3}>
            {[
              {
                title: 'Domiciliary Care', tagline: 'From the office to the doorstep.',
                points: ['Visit scheduling with a call board that updates as carers check in', 'Mobile check-in, notes, travel and disruptions', 'Carer availability and open-call marketplace', 'Missed-call follow-up and escalation', 'Timesheet and payroll export'],
                path: '/solutions/domiciliary-care',
              },
              {
                title: 'Supported Living', tagline: 'Connected around the person.',
                points: ['Person-centred support plans and daily notes', 'Medication, body mapping and MAR workflows', 'Risk assessments, incidents and safeguarding', 'Rota, staff, training and competency', 'Reviews, reporting and compliance evidence'],
                path: '/solutions/supported-living',
              },
            ].map((sol) => (
              <Grid item xs={12} md={6} key={sol.title}>
                <Box sx={{
                  p: { xs: 3.5, md: 4.5 }, bgcolor: M.card, borderRadius: M.r.xl,
                  border: `1px solid ${M.faint}`, height: '100%',
                  transition: `all ${M.transition.base}`,
                  '&:hover': { boxShadow: M.shadow.lg, borderColor: M.navy },
                }}>
                  <Typography sx={{ ...M.overline, color: M.navy, mb: 1 }}>{sol.title}</Typography>
                  <Typography sx={{ ...M.h2, mb: 3 }}>{sol.tagline}</Typography>
                  <Stack spacing={1.5} sx={{ mb: 4 }}>
                    {sol.points.map((pt) => (
                      <Stack key={pt} direction="row" spacing={1.5} alignItems="flex-start">
                        <Check sx={{ color: M.tealDeep, fontSize: 17, mt: 0.3 }} />
                        <Typography sx={{ fontWeight: 500, lineHeight: 1.5 }}>{pt}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                  <Button endIcon={<ArrowForward />} onClick={() => nav(sol.path)} sx={{ color: M.tealDeep, fontWeight: 700, px: 0, textTransform: 'none' }}>Learn more</Button>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ═══ 06 · AI INTELLIGENCE ═══ */}
      <Box sx={{ py: { xs: 8, md: 14 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 5, md: 9 }} alignItems="start">
            <Grid item xs={12} md={5}>
              <Typography component="h2" sx={{ ...M.h1, mb: 2 }}>AI that works with your care team.</Typography>
              <Typography sx={{ ...M.bodyLg, color: M.slate, mb: 3 }}>
                Intelligence embedded throughout MeticleCare — not a separate chatbot. AI analyses the data your team already creates, surfaces patterns and generates briefings — with source traceability and human review at the centre.
              </Typography>
              <Button
                variant="outlined" endIcon={<ArrowForward />}
                onClick={() => nav('/features/ai')}
                sx={{ px: 3, py: 1.25, borderRadius: M.r.md, textTransform: 'none', fontWeight: 600, color: M.navy, borderColor: M.subtle, whiteSpace: 'nowrap', '&:hover': { borderColor: M.navy, bgcolor: M.card } }}
              >See intelligence features</Button>
            </Grid>
            <Grid item xs={12} md={7}>
              <Stack spacing={0}>
                {aiCapabilities.map((f, i) => (
                  <Box key={f.title} sx={{ py: 2, borderBottom: i < aiCapabilities.length - 1 ? `1px solid ${M.faint}` : 'none' }}>
                    <Typography sx={{ fontWeight: 700, color: M.ink, fontSize: '0.95rem', mb: 0.35 }}>{f.title}</Typography>
                    <Typography sx={{ color: M.slate, fontSize: '0.9rem', lineHeight: 1.6 }}>{f.desc}</Typography>
                  </Box>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ═══ 07 · MOBILE ═══ */}
      <Box sx={{ py: { xs: 8, md: 14 }, bgcolor: M.card }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography sx={{ ...M.h1, mb: 2 }}>Care doesn't happen behind a desk.</Typography>
              <Typography sx={{ ...M.bodyLg, color: M.slate, mb: 4 }}>
                Give carers a focused React Native mobile experience for the work in front of them — check in, record notes, report disruptions, view care plans and access client information. Store links will be published when the releases are available.
              </Typography>
              <Stack spacing={1.5} sx={{ mb: 4 }}>
                {['Care notes at the point of care', 'Availability and leave workflows', 'Client records, care plans and risk assessments', 'Shift marketplace and open-call pickup', 'Chat, notifications and team communication'].map((item) => (
                  <Stack key={item} direction="row" spacing={1.5} alignItems="center">
                    <Check sx={{ color: M.tealDeep, fontSize: 17 }} />
                    <Typography sx={{ fontWeight: 500 }}>{item}</Typography>
                  </Stack>
                ))}
              </Stack>
              <CTA label="Download the app" to="/download" variant="secondary" />
            </Grid>
            <Grid item xs={12} md={6} sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'center' }}>
              <Box sx={{
                width: 280, height: 560, borderRadius: '32px',
                border: `3px solid ${M.subtle}`, bgcolor: M.card,
                boxShadow: M.shadow.xl, display: 'flex', flexDirection: 'column', overflow: 'hidden',
              }}>
                <Box sx={{ height: 44, bgcolor: M.faint, borderBottom: `1px solid ${M.faint}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Box sx={{ width: 80, height: 20, borderRadius: 10, bgcolor: M.subtle }} />
                </Box>
                <Box sx={{ flex: 1, p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ height: 32, borderRadius: M.r.sm, bgcolor: M.tealSoft }} />
                  <Box sx={{ height: 14, width: '55%', borderRadius: M.r.sm, bgcolor: M.faint }} />
                  <Box sx={{ flex: 1, borderRadius: M.r.md, bgcolor: M.faint }} />
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Box sx={{ flex: 1, height: 72, borderRadius: M.r.sm, bgcolor: M.tealSoft }} />
                    <Box sx={{ flex: 1, height: 72, borderRadius: M.r.sm, bgcolor: M.faint }} />
                  </Box>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ═══ 08 · SECURITY ═══ */}
      <Box sx={{ py: { xs: 8, md: 14 }, bgcolor: M.card, borderTop: `1px solid ${M.faint}`, borderBottom: `1px solid ${M.faint}` }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography sx={{ ...M.h1, mb: 2 }}>Care data deserves serious protection.</Typography>
            <Typography sx={{ ...M.bodyLg, color: M.slate, maxWidth: 520, mx: 'auto' }}>
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
                  p: 3, borderRadius: M.r.lg, border: `1px solid ${M.faint}`, height: '100%',
                  transition: `all ${M.transition.base}`, '&:hover': { borderColor: M.navy, boxShadow: M.shadow.md },
                }}>
                  <Stack direction="row" spacing={1.5} alignItems="center" mb={1.5}>
                    <Box sx={{ width: 36, height: 36, borderRadius: M.r.sm, bgcolor: M.tealSoft, display: 'grid', placeItems: 'center' }}>
                      <t.icon sx={{ color: M.tealDeep, fontSize: 18 }} />
                    </Box>
                    <Typography sx={{ fontWeight: 600 }}>{t.title}</Typography>
                  </Stack>
                  <Typography sx={{ color: M.slate, fontSize: '0.85rem', lineHeight: 1.55 }}>{t.desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ═══ 09 · BLOG ═══ */}
      <Box sx={{ py: { xs: 8, md: 14 }, bgcolor: M.card }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography sx={{ ...M.h1, mb: 2 }}>Ideas for better care operations.</Typography>
            <Typography sx={{ ...M.bodyLg, color: M.slate, maxWidth: 480, mx: 'auto' }}>
              Practical guidance on care technology, compliance and operations.
            </Typography>
          </Box>
          <Grid container spacing={3}>
            {[
              { slug: 'inspection-ready-care-records', title: 'What inspection-ready care records look like in practice', category: 'Compliance', time: '6 min' },
              { slug: 'domiciliary-care-scheduling', title: 'A practical approach to domiciliary care scheduling', category: 'Domiciliary care', time: '5 min' },
              { slug: 'responsible-ai-in-care', title: 'Using AI responsibly in care operations', category: 'AI & care', time: '7 min' },
              { slug: 'medication-safety-domiciliary-care', title: 'Medication safety in domiciliary care: what good looks like', category: 'Domiciliary care', time: '6 min' },
            ].map((a) => (
              <Grid item xs={12} md={3} key={a.slug}>
                <Box
                  component="a" href={`/blog/${a.slug}`}
                  sx={{
                    display: 'block', textDecoration: 'none', color: 'inherit',
                    p: 3, borderRadius: M.r.lg, border: `1px solid ${M.faint}`, bgcolor: M.card, height: '100%',
                    transition: `all ${M.transition.base}`,
                    '&:hover': { borderColor: M.navy, boxShadow: M.shadow.md },
                    '&:focus-visible': { outline: `2px solid ${M.navy}`, outlineOffset: 2 },
                  }}
                >
                  <Typography sx={{ ...M.overline, color: M.navy, mb: 1.5, display: 'block' }}>{a.category}</Typography>
                  <Typography sx={{ fontWeight: 600, lineHeight: 1.4, mb: 2, fontSize: '0.92rem' }}>{a.title}</Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: M.muted }}>{a.time} read</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ═══ 10 · FINAL CTA ═══ */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.card, borderTop: `1px solid ${M.faint}` }}>
        <Container maxWidth="md">
          <Typography component="h2" sx={{ ...M.display, color: M.ink, mb: 2 }}>
            Run your care operation with more clarity.
          </Typography>
          <Typography sx={{ ...M.bodyLg, color: M.slate, mb: 4, maxWidth: 560 }}>
            See how MeticleCare connects care delivery, workforce, compliance and reporting. Talk to the team about your service.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <CTA />
            <Button
              variant="outlined" endIcon={<ArrowForward />}
              onClick={() => nav('/platform')}
              sx={{ px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.9rem', fontWeight: 600, color: M.ink, borderColor: M.subtle, whiteSpace: 'nowrap', '&:hover': { borderColor: M.navy, bgcolor: M.paper } }}
            >Explore the platform</Button>
          </Stack>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
