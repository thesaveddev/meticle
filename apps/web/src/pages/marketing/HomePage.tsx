import { Box, Button, Container, Grid, Stack, Typography } from '@mui/material'
import {
  ArrowForward, Check, Shield, Insights, Security, VerifiedUser, Lock, Star,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { M } from '../../styles/marketing-tokens'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'

/* ─── Shared Elements ──────────────────────────────── */

function SectionLabel({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <Box sx={{ mb: 1, textAlign: center ? 'center' : 'left' }}>
      <Typography
        component="span"
        sx={{
          ...M.overline, color: M.tealDeep,
          borderBottom: `2px solid ${M.teal}`,
          pb: 0.5,
        }}
      >{children}</Typography>
    </Box>
  )
}

function CTA({
  label = 'Book a demo', to = '/contact', variant = 'primary',
}: { label?: string; to?: string; variant?: 'primary' | 'secondary' }) {
  const nav = useNavigate()
  const styles = {
    primary: {
      bgcolor: M.teal, color: M.navy, fontWeight: 700,
      '&:hover': { bgcolor: M.tealDark },
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

const trustItems = [
  { icon: VerifiedUser, label: 'UK data hosting' },
  { icon: Lock, label: 'Encryption at rest & in transit' },
  { icon: Shield, label: 'MFA & RBAC' },
  { icon: Insights, label: 'Full audit trail' },
  { icon: Security, label: 'Tenant isolation' },
  { icon: Star, label: 'GDPR-ready' },
]

const careDay = [
  { step: 'Plan', desc: 'Schedule visits, assign carers, review availability' },
  { step: 'Deliver', desc: 'Mobile check-in, care notes, travel and disruptions' },
  { step: 'Record', desc: 'Medication, risks, incidents, body maps' },
  { step: 'Review', desc: 'Compliance evidence, person reviews, reporting' },
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

const aiCapabilities = [
  { title: 'Care summaries', desc: '7, 14 or 30-day person summaries linked to source records.' },
  { title: 'Change detection', desc: 'Surfaces changes across notes, incidents, missed calls and medication.' },
  { title: 'Risk signals', desc: 'Deterministic signals with AI explanations — not diagnoses.' },
  { title: 'Compliance copilot', desc: 'Training gaps, overdue reviews and evidence that may need attention.' },
  { title: 'Manager briefing', desc: 'End-of-day intelligence covering people, workforce and operations.' },
]

/* ─── Styles ────────────────────────────────────────── */

const animKeyframes = `
@keyframes slideUp {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes pulseDot {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.6); }
}
@keyframes signalMove {
  0% { left: 0%; }
  100% { left: 100%; }
}
@keyframes progressFill {
  from { width: 0%; }
  to { width: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .mc-animate { animation: none !important; opacity: 1 !important; }
  .mc-animate-delay { animation: none !important; opacity: 1 !important; }
}
`

const sectionIn = {
  animation: 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
}
const fadeInDelay = {
  animation: 'fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both',
}

/* ─── Page ──────────────────────────────────────────── */

export default function HomePage() {
  const nav = useNavigate()

  return (
    <MarketingLayout>
      <style>{animKeyframes}</style>
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
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP', description: 'Book a demo for pricing' },
        }}
      />

      {/* ═══ 01 · HERO ═══ */}
      <Box sx={{ bgcolor: M.navy, pt: { xs: 10, md: 16 }, pb: { xs: 8, md: 14 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 8 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <Box className="mc-animate" sx={sectionIn}>
                <SectionLabel>MeticleCare</SectionLabel>
                <Typography sx={{ ...M.display, color: '#fff', mb: 3 }}>
                  Run your care operation with confidence.
                </Typography>
              </Box>
              <Typography className="mc-animate-delay" sx={{ ...M.bodyLg, color: M.subtle, mb: 5, maxWidth: 480 }} style={{ animation: 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both' }}>
                One platform connecting care delivery, workforce, compliance, medication and reporting for UK domiciliary and supported living providers.
              </Typography>
              <Box className="mc-animate-delay" style={{ animation: 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.25s both' }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <CTA />
                  <Button
                    variant="outlined" endIcon={<ArrowForward />}
                    onClick={() => nav('/platform')}
                    sx={{
                      px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none',
                      fontSize: '0.9rem', fontWeight: 600, color: '#fff',
                      borderColor: 'rgba(255,255,255,0.2)', '&:hover': { borderColor: 'rgba(255,255,255,0.5)', bgcolor: 'rgba(255,255,255,0.05)' },
                    }}
                  >Explore the platform</Button>
                </Stack>
              </Box>
            </Grid>
            <Grid item xs={12} md={6} sx={{ display: { xs: 'none', md: 'block' } }}>
              <Box className="mc-animate-delay" sx={fadeInDelay}>
                {/* Care day timeline — the animated centerpiece */}
                <Box sx={{
                  p: 4, borderRadius: M.r.xl,
                  bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <Typography sx={{ ...M.overline, color: M.teal, mb: 3, display: 'block' }}>The care day</Typography>
                  <Stack spacing={0}>
                    {careDay.map((c, i) => (
                      <Box key={c.step}>
                        <Stack direction="row" spacing={2.5} alignItems="flex-start" sx={{ py: 2 }}>
                          <Box sx={{
                            width: 40, height: 40, borderRadius: M.r.sm,
                            bgcolor: i < careDay.length - 1 ? 'rgba(0,201,167,0.1)' : M.teal,
                            display: 'grid', placeItems: 'center', flexShrink: 0,
                            position: 'relative',
                          }}>
                            <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: i < careDay.length - 1 ? M.teal : M.navy }}>
                              {i + 1}
                            </Typography>
                            {i < careDay.length - 1 && (
                              <Box sx={{
                                position: 'absolute', bottom: -20, left: '50%', transform: 'translateX(-50%)',
                                width: 1, height: 18, bgcolor: 'rgba(0,201,167,0.2)',
                              }} />
                            )}
                          </Box>
                          <Box>
                            <Typography sx={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem', mb: 0.25 }}>{c.step}</Typography>
                            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', lineHeight: 1.5 }}>{c.desc}</Typography>
                          </Box>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                  {/* Animated signal dot */}
                  <Box sx={{ mt: 2, height: 2, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden' }}>
                    <Box sx={{
                      position: 'absolute', top: -2, width: 20, height: 6, borderRadius: 3,
                      bgcolor: M.teal, boxShadow: `0 0 12px ${M.teal}60`,
                      animation: 'signalMove 4s linear infinite',
                    }} />
                  </Box>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ═══ 02 · TRUST BAR ═══ */}
      <Box sx={{ bgcolor: M.card, borderBottom: `1px solid ${M.faint}`, py: 2.5 }}>
        <Container maxWidth="lg">
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1.5, sm: 4 }} alignItems="center" justifyContent="center" useFlexGap>
            {trustItems.map((t) => (
              <Stack key={t.label} direction="row" spacing={0.75} alignItems="center">
                <t.icon sx={{ fontSize: 15, color: M.teal }} />
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 500, color: M.slate, whiteSpace: 'nowrap' }}>{t.label}</Typography>
              </Stack>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* ═══ 03 · CONNECTED PLATFORM ═══ */}
      <Box sx={{ py: { xs: 8, md: 14 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 8 }} alignItems="center">
            <Grid item xs={12} md={5}>
              <SectionLabel>Connected platform</SectionLabel>
              <Typography sx={{ ...M.h1, mb: 2 }}>One platform. Every part of your care operation.</Typography>
              <Typography sx={{ ...M.bodyLg, color: M.slate }}>
                Not a collection of disconnected modules. A connected operating system where care records, workforce, compliance and intelligence share context.
              </Typography>
            </Grid>
            <Grid item xs={12} md={7}>
              <Stack spacing={2}>
                {[
                  { group: 'Care', items: 'Care notes · Support plans · Reviews · Body mapping · Appointments', color: M.teal },
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

      {/* ═══ 04 · INSPECTION READINESS ═══ */}
      <Box sx={{ py: { xs: 8, md: 14 }, bgcolor: M.card, borderTop: `1px solid ${M.faint}`, borderBottom: `1px solid ${M.faint}` }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 8 }} alignItems="center">
            <Grid item xs={12} md={5}>
              <SectionLabel>Inspection readiness</SectionLabel>
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
                <Typography sx={{ ...M.label, color: M.muted, mb: 2.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Readiness</Typography>
                <Stack spacing={1.5}>
                  {[
                    { label: 'Care records', status: 'Tracked', color: M.green },
                    { label: 'Reviews', status: 'Tracked', color: M.green },
                    { label: 'Training', status: 'Needs review', color: M.amber },
                    { label: 'Competency', status: 'Tracked', color: M.green },
                    { label: 'Risk reviews', status: 'Tracked', color: M.green },
                    { label: 'Open actions', status: '3 items', color: M.coral },
                  ].map((m) => (
                    <Stack key={m.label} direction="row" justifyContent="space-between" alignItems="center"
                      sx={{ py: 1.5, borderBottom: '1px solid #F0F4F8' }}>
                      <Typography sx={{ fontWeight: 500, fontSize: '0.9rem' }}>{m.label}</Typography>
                      <Typography sx={{
                        fontSize: '0.78rem', fontWeight: 600, color: m.color,
                        bgcolor: `${m.color}12`, px: 1.5, py: 0.5, borderRadius: M.r.sm,
                      }}>{m.status}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ═══ 05 · FOUR NATIONS ═══ */}
      <Box sx={{ py: { xs: 8, md: 14 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <SectionLabel center>Regulatory environments</SectionLabel>
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
                    '&:hover': { borderColor: M.teal, boxShadow: M.shadow.md, transform: 'translateY(-2px)' },
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

      {/* ═══ 06 · EVIDENCE FLOW ═══ */}
      <Box sx={{ py: { xs: 8, md: 14 }, bgcolor: M.card, borderTop: `1px solid ${M.faint}`, borderBottom: `1px solid ${M.faint}` }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 8 }} alignItems="center">
            <Grid item xs={12} md={4}>
              <SectionLabel>How evidence is created</SectionLabel>
              <Typography sx={{ ...M.h2, mb: 2 }}>Evidence created through everyday work.</Typography>
              <Typography sx={{ ...M.bodyLg, color: M.slate }}>
                When your team delivers care, records medication, tracks risks and manages incidents in one system, inspection evidence is created continuously — not assembled under pressure.
              </Typography>
            </Grid>
            <Grid item xs={12} md={8}>
              <Stack spacing={0}>
                {evidenceFlow.map((step, i) => (
                  <Stack key={step} direction="row" spacing={2} alignItems="center" sx={{
                    py: 1.5,
                    borderBottom: i < evidenceFlow.length - 1 ? `1px solid ${M.faint}` : 'none',
                  }}>
                    <Box sx={{
                      width: 28, height: 28, borderRadius: M.r.sm,
                      bgcolor: i === evidenceFlow.length - 1 ? M.teal : M.faint,
                      color: i === evidenceFlow.length - 1 ? M.navy : M.muted,
                      display: 'grid', placeItems: 'center',
                      fontWeight: 700, fontSize: '0.72rem', flexShrink: 0,
                    }}>{i + 1}</Box>
                    <Typography sx={{ fontWeight: i === evidenceFlow.length - 1 ? 700 : 500, color: i === evidenceFlow.length - 1 ? M.tealDeep : M.slate }}>{step}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ═══ 07 · SOLUTIONS ═══ */}
      <Box sx={{ py: { xs: 8, md: 14 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <SectionLabel center>Solutions</SectionLabel>
            <Typography sx={{ ...M.h1, mb: 2 }}>Built for how you actually work.</Typography>
          </Box>
          <Grid container spacing={3}>
            {[
              {
                title: 'Domiciliary Care', tagline: 'From the office to the doorstep.',
                points: ['Visit scheduling with real-time status', 'Mobile check-in, notes, travel and disruptions', 'Carer availability and open-call marketplace', 'Missed-call follow-up and escalation', 'Timesheet and payroll export'],
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
                  '&:hover': { boxShadow: M.shadow.lg, borderColor: M.teal },
                }}>
                  <Typography sx={{ ...M.overline, color: M.tealDeep, mb: 1 }}>{sol.title}</Typography>
                  <Typography sx={{ ...M.h2, mb: 3 }}>{sol.tagline}</Typography>
                  <Stack spacing={1.5} sx={{ mb: 4 }}>
                    {sol.points.map((pt) => (
                      <Stack key={pt} direction="row" spacing={1.5} alignItems="flex-start">
                        <Check sx={{ color: M.teal, fontSize: 17, mt: 0.3 }} />
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

      {/* ═══ 08 · AI INTELLIGENCE ═══ */}
      <Box sx={{ py: { xs: 8, md: 14 }, bgcolor: M.navy }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={5}>
              <SectionLabel>Intelligence</SectionLabel>
              <Typography sx={{ ...M.h1, color: '#fff', mb: 2 }}>AI that works with your care team.</Typography>
              <Typography sx={{ ...M.bodyLg, color: M.subtle, mb: 4 }}>
                Intelligence embedded throughout MeticleCare — not a separate chatbot. AI analyses the data your team already creates, surfaces patterns and generates briefings — with source traceability and human review at the centre.
              </Typography>
              <Button
                variant="outlined" endIcon={<ArrowForward />}
                onClick={() => nav('/features/ai')}
                sx={{
                  px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none',
                  fontSize: '0.9rem', fontWeight: 600, color: '#fff',
                  borderColor: 'rgba(255,255,255,0.2)', '&:hover': { borderColor: 'rgba(255,255,255,0.5)', bgcolor: 'rgba(255,255,255,0.05)' },
                }}
              >See intelligence features</Button>
            </Grid>
            <Grid item xs={12} md={7}>
              <Stack spacing={2}>
                {aiCapabilities.map((f) => (
                  <Box key={f.title} sx={{
                    p: 2.5, borderRadius: M.r.md,
                    border: '1px solid rgba(255,255,255,0.06)',
                    transition: `border-color ${M.transition.fast}`,
                    '&:hover': { borderColor: M.teal },
                  }}>
                    <Typography sx={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem', mb: 0.25 }}>{f.title}</Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', lineHeight: 1.5 }}>{f.desc}</Typography>
                  </Box>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ═══ 09 · MOBILE ═══ */}
      <Box sx={{ py: { xs: 8, md: 14 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <SectionLabel>Mobile app</SectionLabel>
              <Typography sx={{ ...M.h1, mb: 2 }}>Care doesn't happen behind a desk.</Typography>
              <Typography sx={{ ...M.bodyLg, color: M.slate, mb: 4 }}>
                Give carers a focused mobile experience for the work in front of them — check in, record notes, report disruptions, view care plans and access client information. Available for iOS and Android.
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

      {/* ═══ 10 · SECURITY ═══ */}
      <Box sx={{ py: { xs: 8, md: 14 }, bgcolor: M.card, borderTop: `1px solid ${M.faint}`, borderBottom: `1px solid ${M.faint}` }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <SectionLabel center>Security</SectionLabel>
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
                  transition: `all ${M.transition.base}`, '&:hover': { borderColor: M.teal, boxShadow: M.shadow.md },
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

      {/* ═══ 11 · BLOG ═══ */}
      <Box sx={{ py: { xs: 8, md: 14 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <SectionLabel center>Resources</SectionLabel>
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
                    '&:hover': { borderColor: M.teal, boxShadow: M.shadow.md },
                  }}
                >
                  <Typography sx={{ ...M.overline, color: M.tealDeep, mb: 1.5, display: 'block' }}>{a.category}</Typography>
                  <Typography sx={{ fontWeight: 600, lineHeight: 1.4, mb: 2, fontSize: '0.92rem' }}>{a.title}</Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: M.muted }}>{a.time} read</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ═══ 12 · FINAL CTA ═══ */}
      <Box sx={{ py: { xs: 10, md: 16 }, bgcolor: M.navy, textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography sx={{ ...M.display, color: '#fff', mb: 2 }}>
            Run your care operation with more clarity.
          </Typography>
          <Typography sx={{ ...M.bodyLg, color: M.subtle, mb: 5, maxWidth: 480, mx: 'auto' }}>
            See how MeticleCare connects care delivery, workforce, compliance and reporting. Talk to the team about your service.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <CTA />
            <Button
              variant="outlined" endIcon={<ArrowForward />}
              onClick={() => nav('/platform')}
              sx={{
                px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none',
                fontSize: '0.9rem', fontWeight: 600, color: '#fff',
                borderColor: 'rgba(255,255,255,0.2)', '&:hover': { borderColor: 'rgba(255,255,255,0.5)', bgcolor: 'rgba(255,255,255,0.05)' },
              }}
            >Explore the platform</Button>
          </Stack>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
