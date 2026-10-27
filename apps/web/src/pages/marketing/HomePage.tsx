import { Box, Button, Chip, Container, Grid, Stack, Typography } from '@mui/material'
import {
  ArrowForward, Check, Dns, ExpandMore, Favorite, Home, Key, Layers, Lock, Smartphone,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { M } from '../../styles/marketing-tokens'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'
import SplitText from '../../components/marketing/SplitText'
import { useScrollReveal } from '../../styles/useScrollReveal'

/* Figma · MeticleCare Website Redesign · 1.1 Home (Desktop 1440 / Mobile 390).
 * Section order, copy, spacing (104px sections, 1152 content), radii, borders
 * and the hero visual (photo + floating call-board card, attention pill and
 * check-in toast) follow the Home desktop frame exactly. Product-UI mock rows
 * are illustrative interface copy, not marketing claims. */

const HERO_BG = '#EAF3FD'
const HAIRLINE = '#E4E9F1'
const CARD_SHADOW = '0 24px 48px -12px rgba(12,27,46,0.14)'

function Eyebrow({ children }: { children: string }) {
  return (
    <Typography
      data-reveal
      sx={{ color: M.navy, fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', mb: 2, display: 'block' }}
    >
      {children}
    </Typography>
  )
}

function SectionHead({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <Grid container spacing={{ xs: 3, md: 10 }} sx={{ mb: { xs: 5, md: 7 } }}>
      <Grid item xs={12} md={6}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <Typography data-reveal component="h2" sx={{ ...M.h1, color: M.ink }}>
          {title}
        </Typography>
      </Grid>
      <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'flex-end' }}>
        <Typography data-reveal data-reveal-delay="0.1" sx={{ ...M.bodyLg, color: M.slate }}>
          {copy}
        </Typography>
      </Grid>
    </Grid>
  )
}

function TextLink({ label, to }: { label: string; to: string }) {
  const nav = useNavigate()
  return (
    <Button
      endIcon={<ArrowForward />}
      onClick={() => nav(to)}
      sx={{ color: M.navy, fontWeight: 600, px: 0, mt: 4, textTransform: 'none', fontSize: '0.95rem', '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' } }}
    >
      {label}
    </Button>
  )
}

/* ─── Data (verbatim from the Home frame) ───────────────── */

const heroChecks = ['30-minute scoping call', '14-day free trial', 'Named point of contact']
const regulators = ['CQC', 'Care Inspectorate', 'CIW', 'RQIA']

/* Verbatim from the Home frame: header, four timed rows and status pills. */
const callBoardRows = [
  { time: '09:00', name: 'Margaret W.', sub: 'Sarah M. · checked in 08:58', status: 'Checked in', tone: 'teal' },
  { time: '10:30', name: 'John D.', sub: 'James K. · en route', status: 'En route', tone: 'blue' },
  { time: '11:00', name: 'Patricia L.', sub: 'No carer assigned', subTone: 'red', status: 'At risk', tone: 'red' },
  { time: '13:00', name: 'Robert H.', sub: 'Priya S.', status: 'Scheduled', tone: 'grey' },
] as const

const statusStyle: Record<string, { color: string; bgcolor: string }> = {
  teal: { color: '#004e45', bgcolor: '#d2fbf4' },
  blue: { color: M.navy, bgcolor: '#E8F1FD' },
  red: { color: '#b42318', bgcolor: '#fef0f0' },
  grey: { color: M.slate, bgcolor: M.faint },
}

const careDay = [
  { n: '01', step: 'Plan', desc: 'Schedule visits, assign carers, review availability.' },
  { n: '02', step: 'Deliver', desc: 'Mobile check-in, notes, travel and disruptions.' },
  { n: '03', step: 'Record', desc: 'Medication, vitals, incidents and body maps.' },
  { n: '04', step: 'Review', desc: 'Compliance evidence, person reviews and reporting.' },
]

/* Verbatim from the Module index cells (title case, no trailing periods). */
const modules = [
  { n: '01', title: 'Care Management', desc: 'Plans, notes, reviews and observations' },
  { n: '02', title: 'Medication (eMAR)', desc: 'Administration records and audit trails' },
  { n: '03', title: 'Workforce', desc: 'Staff, training and competency' },
  { n: '04', title: 'Scheduling', desc: 'Rota planning and open calls' },
  { n: '05', title: 'Risk & Incidents', desc: 'Assessments, recording and follow-up' },
  { n: '06', title: 'Reporting', desc: 'Dashboards and evidence' },
  { n: '07', title: 'Family Portal', desc: 'Authorised family access' },
  { n: '08', title: 'AI Intelligence', desc: 'Summaries, detection and copilot' },
  { n: '09', title: 'Compliance', desc: 'Readiness across four nations' },
]

const attentionRows = [
  { label: 'Care plan reviews overdue', count: 4 },
  { label: 'Training renewal due', count: 2 },
  { label: 'Risk assessments needing review', count: 2 },
  { label: 'DBS certificate expiring', count: 1 },
]

const nations = ['CQC', 'CI', 'CIW', 'RQIA']

const solutions = [
  {
    label: 'Domiciliary care',
    tag: 'Domiciliary care · Carer',
    title: 'From the office to the doorstep.',
    img: '/figma/home-domiciliary.png',
    alt: 'Care worker walking down a residential street on a home care round',
    points: [
      'Visit scheduling with a call board that updates as carers check in',
      'Mobile check-in, notes, travel and disruptions',
      'Missed-call follow-up and escalation',
      'Timesheet and payroll export',
    ],
    path: '/solutions/domiciliary-care',
  },
  {
    label: 'Supported living',
    tag: 'Supported living · Support worker',
    title: 'Connected around the person.',
    img: '/figma/home-supported-living.png',
    alt: 'Care workers supporting someone in a home kitchen',
    points: [
      'Person-centred support plans and daily notes',
      'Medication, body mapping and MAR workflows',
      'Risk assessments, incidents and safeguarding',
      'Reviews, reporting and compliance evidence',
    ],
    path: '/solutions/supported-living',
  },
]

const aiRows = [
  { n: '01', title: 'Care summaries', desc: '7, 14 or 30-day person summaries linked to source records.' },
  { n: '02', title: 'Record change summaries', desc: 'Compare the two halves of a period you choose, across notes, incidents, missed calls and medication.' },
  { n: '03', title: 'Risk signals', desc: 'Deterministic signals with AI explanations — not diagnoses.' },
  { n: '04', title: 'Compliance copilot', desc: 'Training gaps, overdue reviews and evidence that may need attention.' },
  { n: '05', title: 'Manager briefing', desc: 'End-of-day intelligence covering people, workforce and operations.' },
]

const securityCards = [
  { title: 'MFA & role-based access', desc: 'Permissions enforced at the API level.', icon: Key },
  { title: 'Tenant isolation', desc: 'Organisation data strictly separated.', icon: Layers },
  { title: 'Encryption in transit', desc: 'TLS. Ask us about encryption at rest.', icon: Lock },
  { title: 'UK record storage', desc: 'AI processing may leave the UK when enabled.', icon: Dns },
]

/* Cover colours are the flat fills from the Home frame (Cover/medication,
 * Cover/compliance, Cover/schedule); read times are verbatim. */
const articles = [
  {
    slug: 'medication-safety-domiciliary-care',
    category: 'Domiciliary care',
    title: 'Medication safety in domiciliary care: what good looks like',
    time: '6 min read',
    img: '/figma/cover-medication.png',
    alt: 'Medication administration grid illustration',
  },
  {
    slug: 'inspection-ready-care-records',
    category: 'Compliance',
    title: 'What inspection-ready care records look like in practice',
    time: '6 min read',
    img: '/figma/cover-compliance.png',
    alt: 'Compliance checklist illustration',
  },
  {
    slug: 'domiciliary-care-scheduling',
    category: 'Domiciliary care',
    title: 'A practical approach to domiciliary care scheduling',
    time: '5 min read',
    img: '/figma/cover-schedule.png',
    alt: 'Scheduling board illustration',
  },
] as const

/* ─── Page ──────────────────────────────────────────────── */

export default function HomePage() {
  const nav = useNavigate()
  const revealRoot = useScrollReveal<HTMLDivElement>()

  return (
    <MarketingLayout>
      <Box ref={revealRoot} sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
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

        {/* ═══ HERO ═══ */}
        <Box
          data-reveal-group
          sx={{
            position: 'relative', overflow: 'clip',
            bgcolor: HERO_BG,
            pt: { xs: 7, md: 14 }, pb: { xs: 8, md: 12 },
          }}
        >
          {/* Decor glows (aria-hidden) */}
          <Box aria-hidden sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <Box sx={{
              position: 'absolute', width: 560, height: 560, right: '-4%', top: '-12%',
              borderRadius: '50%', bgcolor: 'rgba(1,100,200,0.14)', filter: 'blur(140px)',
            }} />
            <Box sx={{
              position: 'absolute', width: 420, height: 420, right: '2%', bottom: '-30%',
              borderRadius: '50%', bgcolor: 'rgba(3,198,177,0.14)', filter: 'blur(140px)',
            }} />
          </Box>

          <Container maxWidth="lg" sx={{ position: 'relative' }}>
            <Grid container spacing={{ xs: 6, md: 6 }} alignItems="center">
              <Grid item xs={12} md={6}>
                <Box
                  data-reveal
                  sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 1.25,
                    bgcolor: M.card, border: `1px solid ${HAIRLINE}`, borderRadius: M.r.full,
                    pl: 0.75, pr: 2, py: 0.5, mb: 3.5, boxShadow: M.shadow.xs,
                  }}
                >
                  <Box sx={{ bgcolor: M.navy, color: '#FFFFFF', fontSize: '0.72rem', fontWeight: 800, borderRadius: M.r.full, px: 1.25, py: 0.5, letterSpacing: '0.04em' }}>
                    UK
                  </Box>
                  <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: M.navy }}>
                    Care operations platform
                  </Typography>
                </Box>

                <SplitText
                  text="Run your care operation with confidence."
                  style={{ ...M.display, color: M.ink, marginBottom: 24 }}
                />
                <Typography data-reveal data-reveal-delay="0.12" sx={{ ...M.bodyLg, color: M.slate, mb: 4, maxWidth: 520 }}>
                  One platform connecting care delivery, workforce, compliance, medication and reporting for UK domiciliary and supported living providers.
                </Typography>

                <Stack data-reveal data-reveal-delay="0.2" direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 3.5 }}>
                  <Button
                    variant="contained" endIcon={<ArrowForward />}
                    onClick={() => nav('/contact')}
                    sx={{ px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', fontWeight: 600, bgcolor: M.navy, boxShadow: 'none', '&:hover': { bgcolor: M.navyMid, boxShadow: 'none' } }}
                  >Book a demo</Button>
                  <Button
                    variant="outlined" endIcon={<ArrowForward />}
                    onClick={() => nav('/platform')}
                    sx={{ px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', fontWeight: 600, color: M.ink, borderColor: M.subtle, bgcolor: M.card, '&:hover': { borderColor: M.navy, bgcolor: M.card } }}
                  >Explore the platform</Button>
                </Stack>

                <Stack data-reveal data-reveal-delay="0.26" direction="row" spacing={2.5} flexWrap="wrap" useFlexGap sx={{ mb: 4 }}>
                  {heroChecks.map((c) => (
                    <Stack key={c} direction="row" spacing={0.75} alignItems="center">
                      <Check sx={{ fontSize: 16, color: M.green }} />
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 500, color: M.ink }}>{c}</Typography>
                    </Stack>
                  ))}
                </Stack>

                <Box data-reveal data-reveal-delay="0.3">
                  <Typography sx={{ fontSize: '0.78rem', color: M.slate, mb: 1.25 }}>
                    Built for every UK regulator:
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {regulators.map((r) => (
                      <Chip
                        key={r} label={r} size="small"
                        sx={{ bgcolor: M.card, border: `1px solid ${HAIRLINE}`, fontWeight: 600, fontSize: '0.75rem', color: M.ink, borderRadius: M.r.full }}
                      />
                    ))}
                  </Stack>
                </Box>
              </Grid>

              {/* Hero visual: photo + floating product UI */}
              <Grid item xs={12} md={6}>
                <Box data-reveal data-reveal-delay="0.15" sx={{ position: 'relative', maxWidth: 592, mx: { xs: 'auto', md: 0 }, ml: { md: 'auto' } }}>
                  <Box
                    component="img"
                    src="/figma/home-hero.png"
                    alt="Care worker walking outdoors on a home care visit"
                    sx={{ display: 'block', width: '100%', maxWidth: 500, ml: 'auto', borderRadius: '28px', boxShadow: M.shadow.lg }}
                    onError={(e) => { (e.target as HTMLImageElement).src = '/hero-care.jpg' }}
                  />

                  {/* Check-in toast */}
                  <Box sx={{
                    position: 'absolute', top: { xs: 8, sm: 24 }, left: { xs: -4, sm: 8 },
                    display: 'flex', alignItems: 'center', gap: 1.25,
                    bgcolor: M.card, borderRadius: '12px', border: `1px solid ${HAIRLINE}`,
                    boxShadow: CARD_SHADOW, px: 1.5, py: 1.25, maxWidth: 250,
                  }}>
                    <Box sx={{ width: 28, height: 28, borderRadius: '8px', bgcolor: '#d2fbf4', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Check sx={{ fontSize: 16, color: '#004e45' }} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: M.ink, lineHeight: 1.3 }}>Sarah M. checked in</Typography>
                      <Typography sx={{ fontSize: '0.72rem', color: M.slate, lineHeight: 1.3 }}>Margaret W. · 08:58 · via mobile</Typography>
                    </Box>
                  </Box>

                  {/* Call board card */}
                  <Box sx={{
                    position: 'absolute', left: { xs: -4, sm: 0 }, bottom: { xs: 52, sm: 64 }, width: { xs: '78%', sm: 380 },
                    bgcolor: M.card, borderRadius: '14px', border: `1px solid ${HAIRLINE}`,
                    boxShadow: CARD_SHADOW, overflow: 'hidden',
                  }}>
                    <Box sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${HAIRLINE}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: M.ink }}>Today&apos;s call board</Typography>
                        <Typography sx={{ fontSize: '0.72rem', color: M.slate }}>North area · 14 calls</Typography>
                      </Box>
                      <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#004e45', bgcolor: '#d2fbf4', px: 1.25, py: 0.5, borderRadius: M.r.full, flexShrink: 0 }}>Live</Typography>
                    </Box>
                    {callBoardRows.map((r) => (
                      <Box key={r.name} sx={{ px: 2.5, py: 1.5, borderBottom: `1px solid ${HAIRLINE}`, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: M.slate, width: 36, flexShrink: 0 }}>{r.time}</Typography>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ fontSize: '0.76rem', fontWeight: 600, color: M.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</Typography>
                          <Typography sx={{ fontSize: '0.7rem', color: 'subTone' in r && r.subTone === 'red' ? '#b42318' : M.slate }}>{r.sub}</Typography>
                        </Box>
                        <Typography sx={{
                          fontSize: '0.68rem', fontWeight: 700, px: 1.25, py: 0.5, borderRadius: M.r.full, flexShrink: 0,
                          ...statusStyle[r.tone],
                        }}>{r.status}</Typography>
                      </Box>
                    ))}
                  </Box>

                  {/* Attention pill */}
                  <Box sx={{
                    position: 'absolute', right: { xs: 0, sm: 8 }, bottom: { xs: -8, sm: -4 },
                    display: 'flex', alignItems: 'center', gap: 1.25,
                    bgcolor: M.card, borderRadius: '14px', border: `1px solid ${HAIRLINE}`,
                    boxShadow: CARD_SHADOW, px: 2.5, py: 1.75,
                  }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: M.coral, flexShrink: 0 }} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: M.ink, whiteSpace: 'nowrap' }}>9 items need attention</Typography>
                      <Typography sx={{ fontSize: '0.7rem', color: M.slate, whiteSpace: 'nowrap' }}>Care plan reviews, training renewals, risk reviews</Typography>
                    </Box>
                    <ArrowForward sx={{ fontSize: 16, color: M.slate }} />
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Container>
        </Box>

        {/* ═══ CONNECTED CARE DAY ═══ */}
        <Box data-reveal-group sx={{ py: { xs: 8, md: '104px' }, bgcolor: M.card }}>
          <Container maxWidth="lg">
            <SectionHead
              eyebrow="A connected care day"
              title="From plan to proof, in one record."
              copy="Every visit flows through the same record — so what was planned, delivered and recorded is ready to review without chasing anyone."
            />
            <Grid container spacing={4}>
              {careDay.map((s, i) => (
                <Grid item xs={12} sm={6} md={3} key={s.step}>
                  {/* Top rule: blue for Plan, grey for the rest (Figma Step strokes). */}
                  <Box
                    data-reveal data-reveal-delay={`${i * 0.07}`}
                    sx={{ borderTop: `1px solid ${i === 0 ? M.navy : '#c9d5e2'}`, pt: 3 }}
                  >
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: M.navy, letterSpacing: '0.06em', mb: 1 }}>{s.n}</Typography>
                    <Typography sx={{ fontSize: '1.05rem', fontWeight: 700, color: M.ink, mb: 1 }}>{s.step}</Typography>
                    <Typography sx={{ color: M.slate, fontSize: '0.9rem', lineHeight: 1.6 }}>{s.desc}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        {/* ═══ PLATFORM ═══ */}
        <Box data-reveal-group sx={{ py: { xs: 8, md: '104px' }, bgcolor: M.card }}>
          <Container maxWidth="lg">
            <SectionHead
              eyebrow="The platform"
              title="One platform. Every part of your care operation."
              copy="Not a collection of disconnected modules. A connected operating system where care records, workforce, compliance and intelligence share context."
            />
            {/* Module index: one connected container, cells tile with dividers — no card radii. */}
            <Box
              data-reveal
              sx={{ borderRadius: '16px', border: `1px solid ${HAIRLINE}`, bgcolor: M.card, overflow: 'hidden' }}
            >
              <Grid container spacing={0}>
                {modules.map((m, i) => (
                  <Grid item xs={12} sm={6} md={4} key={m.title}>
                    <Box
                      sx={{
                        p: 3, height: '100%', display: 'flex', alignItems: 'center', gap: 2,
                        borderRight: { xs: 'none', sm: i % 2 === 0 ? `1px solid ${HAIRLINE}` : 'none', md: i % 3 !== 2 ? `1px solid ${HAIRLINE}` : 'none' },
                        borderBottom: { xs: i < modules.length - 1 ? `1px solid ${HAIRLINE}` : 'none', sm: i < 8 ? `1px solid ${HAIRLINE}` : 'none', md: i < 6 ? `1px solid ${HAIRLINE}` : 'none' },
                      }}
                    >
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: M.slate, flexShrink: 0 }}>{m.n}</Typography>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.ink }}>{m.title}</Typography>
                        <Typography sx={{ color: M.slate, fontSize: '0.85rem', lineHeight: 1.5 }}>{m.desc}</Typography>
                      </Box>
                      <ArrowForward sx={{ fontSize: 16, color: M.muted, flexShrink: 0 }} />
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
            <TextLink label="Explore the platform" to="/platform" />
          </Container>
        </Box>

        {/* ═══ COMPLIANCE ═══ */}
        <Box data-reveal-group sx={{ py: { xs: 8, md: '104px' }, bgcolor: M.paper }}>
          <Container maxWidth="lg">
            <Grid container spacing={{ xs: 5, md: 12 }} alignItems="center">
              <Grid item xs={12} md={5}>
                <Eyebrow>Compliance</Eyebrow>
                <Typography data-reveal component="h2" sx={{ ...M.h1, color: M.ink, mb: 2 }}>
                  Stay ready for inspection. Every day.
                </Typography>
                <Typography data-reveal data-reveal-delay="0.1" sx={{ ...M.body, color: M.slate, mb: 4 }}>
                  Compliance should be part of everyday operations — not something assembled when an inspection is announced. Requirements differ across England, Scotland, Wales and Northern Ireland, and MeticleCare tracks what matters for yours.
                </Typography>
                <TextLink label="Explore compliance" to="/compliance" />
              </Grid>
              <Grid item xs={12} md={7}>
                <Box data-reveal data-reveal-delay="0.15" sx={{ bgcolor: M.card, borderRadius: '16px', border: `1px solid ${HAIRLINE}`, boxShadow: CARD_SHADOW, overflow: 'hidden' }}>
                  <Box sx={{ px: 3, py: 2.5, borderBottom: `1px solid ${HAIRLINE}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                    <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: M.ink }}>Needs attention</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>From your records</Typography>
                  </Box>
                  {attentionRows.map((r) => (
                    <Box key={r.label} sx={{ px: 3, py: 2, borderBottom: `1px solid ${HAIRLINE}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                      <Typography sx={{ fontSize: '0.88rem', fontWeight: 500, color: M.ink }}>{r.label}</Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ minWidth: 24, height: 23, borderRadius: M.r.full, bgcolor: '#E8F1FD', color: M.navy, fontSize: '0.7rem', fontWeight: 700, display: 'grid', placeItems: 'center', px: 1 }}>{r.count}</Box>
                        <ArrowForward sx={{ fontSize: 16, color: M.muted }} />
                      </Stack>
                    </Box>
                  ))}
                  <Box sx={{ display: 'flex' }}>
                    {nations.map((n, i) => (
                      <Box
                        key={n}
                        sx={{
                          flex: 1, py: 1.5, textAlign: 'center',
                          borderRight: i < nations.length - 1 ? `1px solid ${HAIRLINE}` : 'none',
                        }}
                      >
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: M.slate }}>{n}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Container>
        </Box>

        {/* ═══ SOLUTIONS ═══ */}
        <Box data-reveal-group sx={{ py: { xs: 8, md: '104px' }, bgcolor: M.card }}>
          <Container maxWidth="lg">
            <SectionHead
              eyebrow="Solutions"
              title="Built for how you actually work."
              copy="Whether your team is on the road or supporting people at home, MeticleCare fits the way your service runs."
            />
            <Grid container spacing={3}>
              {solutions.map((s, i) => (
                <Grid item xs={12} md={6} key={s.label}>
                  <Box
                    data-reveal data-reveal-delay={`${i * 0.1}`}
                    sx={{
                      p: { xs: 3, md: 5 }, borderRadius: '20px', border: `1px solid ${HAIRLINE}`,
                      bgcolor: M.card, height: '100%', transition: `all ${M.transition.base}`,
                      '&:hover': { boxShadow: M.shadow.lg, borderColor: M.navy },
                    }}
                  >
                    <Box sx={{ position: 'relative', mb: 3 }}>                                                                                                                    <Box
                        component="img" src={s.img} alt={s.alt}
                        sx={{ display: 'block', width: '100%', height: 240, objectFit: 'cover', borderRadius: '14px' }}
                      />
                      {/* Photo tag, verbatim from the frame (the supported-living
                          placeholder now reads Support worker, not Carer). */}
                      <Box sx={{
                        position: 'absolute', top: 16, left: 16,
                        bgcolor: 'rgba(12,27,46,0.72)', color: '#FFFFFF',
                        fontSize: '0.72rem', fontWeight: 600, borderRadius: '6px', px: 1.25, py: 0.625,
                      }}>
                        {s.tag}
                      </Box>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                      {i === 0 ? <Home sx={{ fontSize: 18, color: M.navy }} /> : <Favorite sx={{ fontSize: 18, color: M.navy }} />}
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: M.navy, letterSpacing: '0.06em' }}>{s.label}</Typography>
                    </Stack>
                    <Typography sx={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.19, color: M.ink, mb: 2.5 }}>{s.title}</Typography>
                    <Stack spacing={1.5} sx={{ mb: 3.5 }}>
                      {s.points.map((pt) => (
                        <Stack key={pt} direction="row" spacing={1.5} alignItems="flex-start">
                          <Check sx={{ color: M.green, fontSize: 18, mt: 0.25 }} />
                          <Typography sx={{ fontWeight: 500, lineHeight: 1.55, color: M.ink }}>{pt}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                    <Button endIcon={<ArrowForward />} onClick={() => nav(s.path)} sx={{ color: M.navy, fontWeight: 600, px: 0, textTransform: 'none', fontSize: '0.95rem' }}>
                      Learn more
                    </Button>
                  </Box>
                </Grid>
              ))}
            </Grid>

            {/* Mobile app banner */}
            <Box
              data-reveal
              sx={{
                mt: 3, borderRadius: '16px', bgcolor: M.paper, border: `1px solid ${HAIRLINE}`,
                px: { xs: 3, md: 3.5 }, py: { xs: 2.25, md: 2.5 },
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2,
                cursor: 'pointer', transition: `all ${M.transition.base}`,
                '&:hover': { borderColor: M.navy, boxShadow: M.shadow.md },
              }}
              onClick={() => nav('/download')}
              role="link" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') nav('/download') }}
            >
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Smartphone sx={{ fontSize: 20, color: M.navy, mt: 0.25 }} />
                <Box>
                  <Typography sx={{ fontWeight: 700, color: M.ink, fontSize: '1rem' }}>Mobile app for carers</Typography>
                  <Typography sx={{ color: M.slate, fontSize: '0.88rem', mt: 0.25 }}>Check in, record notes, report disruptions and see care plans on the go.</Typography>
                </Box>
              </Stack>
              <Box sx={{ width: 40, height: 40, borderRadius: '50%', border: `1px solid ${HAIRLINE}`, bgcolor: M.card, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <ExpandMore sx={{ transform: 'rotate(-90deg)', color: M.navy }} />
              </Box>
            </Box>
          </Container>
        </Box>

        {/* ═══ AI INTELLIGENCE (dark) ═══ */}
        <Box data-reveal-group sx={{ py: { xs: 8, md: '104px' }, bgcolor: M.ink, color: '#FFFFFF' }}>
          <Container maxWidth="lg">
            <Grid container spacing={{ xs: 4, md: 10 }} sx={{ mb: { xs: 4, md: 6 } }}>
              <Grid item xs={12} md={6}>
                <Typography data-reveal sx={{ color: M.sky, fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', mb: 2, display: 'block' }}>
                  MeticleCare intelligence
                </Typography>
                <Typography data-reveal component="h2" sx={{ ...M.h1, color: '#FFFFFF' }}>
                  AI that works with your care team.
                </Typography>
              </Grid>
              <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'flex-end' }}>
                <Typography data-reveal data-reveal-delay="0.1" sx={{ ...M.bodyLg, color: 'rgba(255,255,255,0.72)' }}>
                  Intelligence embedded throughout MeticleCare — not a separate chatbot. It analyses the data your team already creates and surfaces patterns, with source traceability and human review at the centre.
                </Typography>
              </Grid>
            </Grid>
            <Box>
              {aiRows.map((f, i) => (
                <Grid key={f.title} container data-reveal data-reveal-delay={`${i * 0.05}`} sx={{ py: 2.75, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                  <Grid item xs={12} md={5}>
                    <Typography sx={{ fontWeight: 700, color: '#FFFFFF', fontSize: '1rem' }}>
                      <Box component="span" sx={{ color: M.sky, mr: 1.5, fontSize: '0.85rem' }}>{f.n}</Box>
                      {f.title}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={7}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.92rem', lineHeight: 1.6 }}>{f.desc}</Typography>
                  </Grid>
                </Grid>
              ))}
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2} sx={{ pt: 4, mt: 1, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
              <Typography data-reveal sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>
                Every AI output is selective, source-linked and auditable.
              </Typography>
              <Button endIcon={<ArrowForward />} onClick={() => nav('/features/ai')} sx={{ color: M.sky, fontWeight: 600, px: 0, textTransform: 'none', whiteSpace: 'nowrap' }}>
                See intelligence features
              </Button>
            </Stack>
          </Container>
        </Box>

        {/* ═══ SECURITY ═══ */}
        <Box data-reveal-group sx={{ pt: { xs: 8, md: '104px' }, pb: { xs: 8, md: '96px' }, bgcolor: M.card }}>
          <Container maxWidth="lg">
            <SectionHead
              eyebrow="Security"
              title="Care data deserves serious protection."
              copy="Security is a core product concern. Here is exactly what is in place — and where to ask us for detail."
            />
            {/* Controls: one connected container with dividers — no card radii. */}
            <Box
              data-reveal
              sx={{ borderRadius: '16px', border: `1px solid ${HAIRLINE}`, bgcolor: M.card, overflow: 'hidden' }}
            >
              <Grid container spacing={0}>
                {securityCards.map((t, i) => (
                  <Grid item xs={12} sm={6} md={3} key={t.title}>
                    <Box
                      sx={{
                        p: '28px', height: '100%',
                        borderRight: { xs: 'none', sm: i % 2 === 0 ? `1px solid ${HAIRLINE}` : 'none', md: i < securityCards.length - 1 ? `1px solid ${HAIRLINE}` : 'none' },
                        borderBottom: { xs: i < securityCards.length - 1 ? `1px solid ${HAIRLINE}` : 'none', sm: i < 2 ? `1px solid ${HAIRLINE}` : 'none', md: 'none' },
                      }}
                    >
                      <t.icon sx={{ fontSize: 20, color: '#2a3a50', mb: 1.25 }} />
                      <Typography sx={{ fontWeight: 600, fontSize: '1rem', color: M.ink, mb: 1 }}>{t.title}</Typography>
                      <Typography sx={{ color: M.slate, fontSize: '0.87rem', lineHeight: 1.55 }}>{t.desc}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
            <TextLink label="How we handle your data" to="/security" />
          </Container>
        </Box>

        {/* ═══ RESOURCES ═══ */}
        <Box data-reveal-group sx={{ py: { xs: 8, md: '104px' }, bgcolor: M.card }}>
          <Container maxWidth="lg">
            <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 3, mb: { xs: 5, md: 6 } }}>
              <Box>
                <Eyebrow>Resources</Eyebrow>
                <Typography data-reveal component="h2" sx={{ ...M.h1, color: M.ink }}>
                  Ideas for better care operations.
                </Typography>
              </Box>
              <Button
                data-reveal endIcon={<ArrowForward />} onClick={() => nav('/blog')}
                sx={{ color: M.navy, fontWeight: 600, px: 0, textTransform: 'none', fontSize: '0.95rem', flexShrink: 0, display: { xs: 'none', sm: 'inline-flex' } }}
              >
                All articles
              </Button>
            </Box>
            <Grid container spacing={3}>
              {articles.map((a, i) => (
                <Grid item xs={12} md={4} key={a.slug}>
                  <Box
                    data-reveal data-reveal-delay={`${i * 0.08}`}
                    component="a" href={`/blog/${a.slug}`}
                    sx={{
                      display: 'block', textDecoration: 'none', color: 'inherit',
                      borderRadius: '20px', border: `1px solid ${HAIRLINE}`, bgcolor: M.card, overflow: 'hidden', height: '100%',
                      transition: `all ${M.transition.base}`,
                      '&:hover': { borderColor: M.navy, boxShadow: M.shadow.md, transform: 'translateY(-2px)' },
                      '&:focus-visible': { outline: `2px solid ${M.navy}`, outlineOffset: 2 },
                    }}
                  >
                    <Box
                      component="img" src={a.img} alt={a.alt}
                      sx={{ display: 'block', width: '100%', height: 190, objectFit: 'cover' }}
                    />
                    <Box sx={{ p: 3 }}>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: M.navy, letterSpacing: '0.05em', mb: 1.25, display: 'block' }}>{a.category}</Typography>
                      <Typography sx={{ fontWeight: 700, lineHeight: 1.35, mb: 2, fontSize: '1.02rem', color: M.ink }}>{a.title}</Typography>
                      <Typography sx={{ fontSize: '0.78rem', color: M.slate }}>{a.time}</Typography>
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        {/* ═══ FINAL CTA ═══ */}
        <Box data-reveal-group sx={{ py: { xs: 8, md: 12 }, bgcolor: M.card, borderTop: `1px solid ${HAIRLINE}` }}>
          <Container maxWidth="lg">
            <Grid container spacing={{ xs: 4, md: 6 }} alignItems="center" justifyContent="space-between">
              <Grid item xs={12} md={7}>
                <Typography data-reveal component="h2" sx={{ ...M.display, color: M.ink, mb: 2 }}>
                  Run your care operation with more clarity.
                </Typography>
                <Typography data-reveal data-reveal-delay="0.1" sx={{ ...M.bodyLg, color: M.slate, maxWidth: 600 }}>
                  See how MeticleCare connects care delivery, workforce, compliance and reporting. Talk to the team about your service.
                </Typography>
              </Grid>
              <Grid item xs={12} md={5}>
                <Stack data-reveal data-reveal-delay="0.18" direction={{ xs: 'column', sm: 'row', md: 'row' }} spacing={1.5} sx={{ mb: 2.5 }}>
                  <Button
                    variant="contained" endIcon={<ArrowForward />}
                    onClick={() => nav('/contact')}
                    sx={{ px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', fontWeight: 600, bgcolor: M.navy, boxShadow: 'none', '&:hover': { bgcolor: M.navyMid, boxShadow: 'none' } }}
                  >Book a demo</Button>
                  <Button
                    variant="outlined" endIcon={<ArrowForward />}
                    onClick={() => nav('/platform')}
                    sx={{ px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', fontWeight: 600, color: M.ink, borderColor: M.subtle, '&:hover': { borderColor: M.navy, bgcolor: M.card } }}
                  >Explore the platform</Button>
                </Stack>
                <Stack data-reveal data-reveal-delay="0.24" direction="row" spacing={2.5} flexWrap="wrap" useFlexGap>
                  {heroChecks.map((c) => (
                    <Stack key={c} direction="row" spacing={0.75} alignItems="center">
                      <Check sx={{ fontSize: 16, color: M.green }} />
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 500, color: M.ink }}>{c}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Grid>
            </Grid>
          </Container>
        </Box>
      </Box>
    </MarketingLayout>
  )
}
