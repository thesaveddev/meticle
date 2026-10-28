import { Box, Button, Container, Grid, Stack, Typography, useMediaQuery, useTheme } from '@mui/material'
import {
  ArrowForward, Warning, AssignmentTurnedIn, People, TrendingUp,
  Description, Security, CheckCircle, AccessTime, Person, InfoOutlined, ExpandMore, Check,
  BarChart, FindInPage, LockOutlined, OpenInNew,
} from '@mui/icons-material'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { M } from '../../styles/marketing-tokens'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'

/* Figma 4.1 shared bits (overview): plain navy eyebrow, hero pill, assure row (4.4 live) */

function Eyebrow({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: M.navy, mb: 1.5, textAlign: center ? 'center' : 'left' }}>{children}</Typography>
  )
}

function EyebrowPill({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, bgcolor: '#FFFFFF', border: `1px solid ${M.faint}`, borderRadius: 999, px: 1.5, py: 0.625, boxShadow: M.shadow.sm, mb: 3 }}>
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: M.navy, flexShrink: 0 }} />
      <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: M.dark }}>{children}</Typography>
    </Box>
  )
}

function ContextBanner({ tinted }: { tinted?: boolean }) {
  return (
    <Box sx={{ p: { xs: 2.5, md: 3 }, bgcolor: tinted ? M.paper : '#FFFFFF', border: `1px solid ${M.faint}`, borderRadius: M.r.md, display: 'flex', gap: 2 }}>
      <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: M.paper, border: `1px solid ${M.faint}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <InfoOutlined sx={{ color: M.slate, fontSize: 20 }} />
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 700, color: M.dark, mb: 0.5 }}>Important context</Typography>
        <Typography sx={{ color: M.slate, fontSize: '0.9rem', lineHeight: 1.6 }}>
          MeticleCare is a software tool, not a regulator, legal adviser or substitute for your organisation's policies and professional judgement. Requirements differ by nation and service type. The responsibility for compliance remains with the provider.
        </Typography>
      </Box>
    </Box>
  )
}

function AssureRow() {
  const items = [
    { icon: <AccessTime sx={{ fontSize: 16 }} />, label: '30-minute scoping call' },
    { icon: <CheckCircle sx={{ fontSize: 16 }} />, label: '14-day free trial' },
    { icon: <Person sx={{ fontSize: 16 }} />, label: 'Named point of contact' },
  ]
  return (
    <Stack direction="row" spacing={3} sx={{ mt: 3, flexWrap: 'wrap', rowGap: 1 }}>
      {items.map((a) => (
        <Stack key={a.label} direction="row" spacing={0.75} alignItems="center" sx={{ color: M.slate }}>
          {a.icon}
          <Typography sx={{ fontSize: '0.8125rem' }}>{a.label}</Typography>
        </Stack>
      ))}
    </Stack>
  )
}

/* ─── Regulator data with nation-specific guidance ──────── */

/**
 * These lists are our summary of what each regulator looks at, not the
 * regulator's words, and the difference matters.
 *
 * An earlier version of this page asserted "CIW inspects against the Care
 * Standards Act 2000" while the API's own regulator registry had the correct
 * instrument — the Regulation and Inspection of Social Care (Wales) Act 2016 —
 * in the same repository. Two files, same statute, one right and one wrong,
 * and the wrong one was on a page a customer reads.
 *
 * So: statutes are named only where they are right, and everything that is
 * a summary of a regulator's approach is marked as ours below. The source of
 * truth for regulator facts is `apps/api/src/modules/compliance/regulators.ts`,
 * which carries its own `sourceNote` per entry and is explicit about which
 * formats are verified. Re-stating it here is a known duplication, tracked as
 * T2-24.
 */
type Regulator = {
  slug: string; code: string; name: string; nation: string; color: string; desc: string;
  guidance: string[]; evidenceFocus: string[]; facts: { label: string; value: string }[];
  tileText: string; tileRadius?: string; officialLink?: { label: string; href: string }; note?: string;
  tags?: string[];
}
const regulators: Regulator[] = [
  {
    slug: 'cqc', code: 'CQC', name: 'Care Quality Commission', nation: 'England', color: '#0164C8',
    desc: 'CQC uses its own assessment approach and quality statements. MeticleCare helps providers organise care records, workforce evidence, incidents, reviews and governance information for their own inspection-readiness work.',
    guidance: [
      'CQC assesses services against five key questions: Safe, Effective, Caring, Responsive and Well-led.',
      'Providers are expected to demonstrate continuous improvement, not just minimum compliance.',
      'Evidence should show how care is personalised, how risks are managed and how learning drives change.',
      'Staff competency, training and supervision records support the Well-led and Effective domains.',
      'Incident records, risk assessments and safeguarding evidence demonstrate the Safe domain.',
      'The list above is ours; CQC\'s own wording is on cqc.org.uk.',
    ],
    evidenceFocus: ['Quality statements alignment', 'Staff training and supervision evidence', 'Person-centred care demonstrations', 'Governance and leadership evidence', 'Risk management and incident follow-up'],
    facts: [
      { label: 'Regulator', value: 'Care Quality Commission' },
      { label: 'Nation', value: 'England' },
      { label: 'Assessment', value: 'Five key questions' },
    ],
    tileText: 'CQC',
    tileRadius: '6px',
    tags: ['Safe', 'Effective', 'Caring', 'Responsive', 'Well-led'],
  },
  {
    slug: 'care-inspectorate', code: 'Care Inspectorate', name: 'Care Inspectorate', nation: 'Scotland', color: '#EF4444',
    desc: "The Care Inspectorate operates within Scotland's health and social care context. MeticleCare helps teams keep evidence, reviews, actions and operational records organised.",
    guidance: [
      'The Care Inspectorate is established under the Public Services Reform (Scotland) Act 2010.',
      'It publishes the quality indicators it inspects against; this is our summary of them, not the Care Inspectorate\'s wording.',
      'Providers should demonstrate how they involve people in decisions about their care and support.',
      'Evidence should show how feedback from people, families and staff drives improvement.',
    ],
    evidenceFocus: ['Quality indicator evidence', 'National Care Standards alignment', 'People\'s experience and outcomes', 'Continuous improvement evidence', 'Staff and management oversight'],
    facts: [
      { label: 'Regulator', value: 'Care Inspectorate' },
      { label: 'Nation', value: 'Scotland' },
      { label: 'Established under', value: 'Public Services Reform (Scotland) Act 2010' },
      { label: 'Inspects against', value: 'Published quality indicators' },
    ],
    tileText: 'CI',
    tileRadius: '50%',
    officialLink: { label: 'Official guidance on careinspectorate.com', href: 'https://www.careinspectorate.com' },
    note: "This is our summary of the quality indicators, not the Care Inspectorate's wording.",
  },
  {
    slug: 'ciw', code: 'CIW', name: 'Care Inspectorate Wales', nation: 'Wales', color: '#087A55',
    desc: 'Care Inspectorate Wales has its own regulatory and inspection context. MeticleCare helps Welsh providers connect everyday records, governance and follow-up actions.',
    guidance: [
      'CIW registers and inspects services under the Regulation and Inspection of Social Care (Wales) Act 2016.',
      'The Social Services and Well-being (Wales) Act 2014 is the framework those regulations sit under, and it is the one to work from.',
      'CIW publishes the inspection questions and ratings it uses; this is our summary of them, not CIW\'s wording.',
      'Evidence should show how services are person-centred and outcome-focused.',
    ],
    evidenceFocus: ['Essential Quality Standards evidence', 'Person-centred care records', 'Safeguarding and protection evidence', 'Staff training and deployment records', 'Management and leadership evidence'],
    facts: [
      { label: 'Regulator', value: 'Care Inspectorate Wales' },
      { label: 'Nation', value: 'Wales' },
      { label: 'Registers and inspects under', value: 'Regulation and Inspection of Social Care (Wales) Act 2016' },
      { label: 'Framework to work from', value: 'Social Services and Well-being (Wales) Act 2014' },
    ],
    tileText: 'CIW',
    tileRadius: '8px',
    officialLink: { label: 'Official guidance on careinspectorate.wales', href: 'https://www.careinspectorate.wales' },
    note: "This is our summary of CIW's inspection questions and ratings, not CIW's wording.",
  },
  {
    slug: 'rqia', code: 'RQIA', name: 'Regulation and Quality Improvement Authority', nation: 'Northern Ireland', color: '#8B7CF6',
    desc: 'RQIA regulates health and social care services in Northern Ireland. MeticleCare supports structured records, workforce information, incidents and actions.',
    guidance: [
      'RQIA is established under the Health and Personal Social Services (Quality, Improvement and Regulation) (Northern Ireland) Order 2003.',
      'RQIA publishes the standards and minimum standards it inspects against; this is our summary of them, not RQIA\'s wording.',
      'Providers should demonstrate how they protect the safety and welfare of people receiving care.',
      'Evidence should show effective communication between staff, management and external agencies.',
      'RQIA uses a quality improvement approach alongside inspection.',
    ],
    evidenceFocus: ['Minimum standards evidence', 'Safety and welfare records', 'Staffing and training evidence', 'Management oversight and governance', 'Communication and liaison records'],
    facts: [
      { label: 'Regulator', value: 'Regulation and Quality Improvement Authority' },
      { label: 'Nation', value: 'Northern Ireland' },
      { label: 'Established under', value: 'HPSS (Quality, Improvement and Regulation) (NI) Order 2003' },
      { label: 'Inspects against', value: 'Standards and minimum standards' },
    ],
    tileText: 'RQIA',
    tileRadius: '12px',
    officialLink: { label: 'Official guidance on rqia.org.uk', href: 'https://www.rqia.org.uk' },
    note: "This is our summary of RQIA's standards, not RQIA's wording.",
  },
]

const evidenceAreas = [
  { icon: Description, title: 'Care records & plans', desc: 'Person-centred support plans, daily notes, reviews and health observations — connected and current.' },
  { icon: People, title: 'Workforce & competency', desc: 'Training matrices, competency assessments, identity monitoring and right-to-work evidence.' },
  { icon: Warning, title: 'Risk, incidents & actions', desc: 'Risk assessments, incident records, follow-up actions and escalation history with full audit trail.' },
  { icon: TrendingUp, title: 'Reports & audit logs', desc: 'Operational reports, AI-assisted insights, compliance dashboards and exportable evidence packs.' },
  { icon: AssignmentTurnedIn, title: 'Governance & policies', desc: 'Policy management, satisfaction surveys, staff engagement and compliance portal access.' },
  { icon: Security, title: 'Data protection', desc: 'MFA, role-based access, audit logging and a DSPT self-assessment module for organisations in scope. Encryption in transit, pseudonymisation at the AI boundary, and retention you control.' },
]

const readinessMetrics = [
  { label: 'Care records', value: '—', color: M.green },
  { label: 'Reviews', value: '—', color: M.green },
  { label: 'Training', value: '—', color: M.amber },
  { label: 'Competency', value: '—', color: M.green },
  { label: 'Risk reviews', value: '—', color: M.green },
  { label: 'Open actions', value: '—', color: M.coral },
]

const attentionItems = [
  { text: 'Training renewal due', count: 2, color: M.amber },
  { text: 'Care plan reviews overdue', count: 4, color: M.amber },
  { text: 'Risk assessments needing review', count: 2, color: M.coral },
  { text: 'DBS certificate expiring', count: 1, color: M.coral },
]

/* ─── Nation guidance: tabs on desktop, accordion on mobile (Figma 4.1) */

/* Figma 4.2–4.5: a guidance item ending "; this is our summary…" renders
   the first clause as the numbered point and the summary note as the card
   footer; a leading "The list above…" item is always a footer note. */
function guidancePoints(r: (typeof regulators)[number]) {
  return r.guidance
    .filter((g) => !g.startsWith('The list above') && !g.startsWith('This is our summary'))
    .map((g) => g.replace(/;\s*this is our summary[^.]*\.?\s*$/i, '.'))
}
function guidanceNotes(r: (typeof regulators)[number]) {
  return [...r.guidance.filter((g) => g.startsWith('The list above') || g.startsWith('This is our summary')), ...(r.note ? [r.note] : [])]
}

function NationBody({ r }: { r: (typeof regulators)[number] }) {
  const notes = guidanceNotes(r)
  const points = guidancePoints(r)
  return (
    <Grid container spacing={{ xs: 4, md: 6 }}>
      <Grid item xs={12} md={7}>
        <Typography sx={{ fontSize: '0.8125rem', color: M.slate, mb: 1 }}>{r.nation} · {r.code}</Typography>
        <Typography sx={{ fontWeight: 700, fontSize: '1.5rem', color: M.dark, letterSpacing: '-0.02em', mb: 2 }}>{r.name}</Typography>
        <Typography sx={{ fontWeight: 600, color: M.dark, mb: 1.5, fontSize: '0.9rem' }}>Key considerations</Typography>
        <Stack spacing={1.25}>
          {points.map((g, i) => (
            <Stack key={i} direction="row" spacing={1.5} alignItems="flex-start">
              <CheckCircle sx={{ color: M.navy, fontSize: 18, mt: 0.2, flexShrink: 0 }} />
              <Typography sx={{ fontSize: '0.9rem', color: M.slate, lineHeight: 1.6 }}>{g}</Typography>
            </Stack>
          ))}
        </Stack>
        {notes.map((n) => (
          <Typography key={n} sx={{ fontSize: '0.8rem', color: M.muted, mt: 2 }}>{n}</Typography>
        ))}
      </Grid>
      <Grid item xs={12} md={5}>
        <Box sx={{ bgcolor: M.paper, borderRadius: M.r.md, p: { xs: 2.5, md: 3 } }}>
          <Typography sx={{ fontWeight: 700, color: M.dark, fontSize: '0.9rem', mb: 1.5 }}>Evidence focus</Typography>
          <Stack spacing={1}>
            {r.evidenceFocus.map((ef) => (
              <Stack key={ef} direction="row" spacing={1} alignItems="flex-start">
                <Check sx={{ color: M.navy, fontSize: 18, mt: 0.15, flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.875rem', color: M.dark, fontWeight: 500 }}>{ef}</Typography>
              </Stack>
            ))}
          </Stack>
          <Button component="a" href={`/compliance/${r.slug}`} endIcon={<ArrowForward />} sx={{ color: M.navy, fontWeight: 600, px: 0, mt: 1.5, textTransform: 'none', fontSize: '0.85rem' }}>
            Explore {r.code} guidance
          </Button>
        </Box>
      </Grid>
    </Grid>
  )
}

function NationGuidance() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [tab, setTab] = useState(regulators[0].slug)
  const active = regulators.find((r) => r.slug === tab) || regulators[0]
  return (
    <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#FFFFFF' }}>
      <Container maxWidth="lg">
        <Grid container spacing={{ xs: 3, md: 8 }} sx={{ mb: { xs: 4, md: 6 } }}>
          <Grid item xs={12} md={6}>
            <Eyebrow>Nation-specific guidance</Eyebrow>
            <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: 700, letterSpacing: '-0.025em', color: M.dark }}>
              Four nations. Different frameworks. One platform.
            </Typography>
          </Grid>
          <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'flex-end' }}>
            <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, lineHeight: M.bodyLg.lineHeight }}>
              Each UK nation has its own regulatory framework. MeticleCare supports the evidence and governance work across all four — without claiming equivalence between them.
            </Typography>
          </Grid>
        </Grid>
        {isMobile ? (
          <Stack spacing={1.5}>
            {regulators.map((r) => {
              const open = r.slug === tab
              return (
                <Box key={r.slug} sx={{ border: `1px solid ${M.faint}`, borderRadius: M.r.md, bgcolor: '#FFFFFF', overflow: 'hidden' }}>
                  <Box
                    component="button"
                    type="button"
                    onClick={() => setTab(open ? '' : r.slug)}
                    aria-expanded={open}
                    sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, border: 0, bgcolor: 'transparent', cursor: 'pointer', p: 2, fontFamily: 'inherit', textAlign: 'left' }}
                  >
                    <Box>
                      <Typography sx={{ fontSize: '0.72rem', color: M.slate }}>{r.nation}</Typography>
                      <Typography sx={{ fontWeight: 700, color: M.dark, fontSize: '1rem' }}>{r.code}</Typography>
                    </Box>
                    <ExpandMore sx={{ color: M.slate, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </Box>
                  {open && (
                    <Box sx={{ px: 2, pb: 2.5, borderTop: `1px solid ${M.faint}`, pt: 2.5 }}>
                      <NationBody r={r} />
                    </Box>
                  )}
                </Box>
              )
            })}
          </Stack>
        ) : (
          <Box sx={{ bgcolor: '#FFFFFF', border: `1px solid ${M.faint}`, borderRadius: M.r.lg, overflow: 'hidden' }}>
            <Box role="tablist" aria-label="Nations" sx={{ display: 'flex', borderBottom: `1px solid ${M.faint}` }}>
              {regulators.map((r) => {
                const selected = r.slug === tab
                return (
                  <Box
                    key={r.slug}
                    component="button"
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setTab(r.slug)}
                    sx={{
                      flex: 1, border: 0, bgcolor: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                      px: 2, py: 2, textAlign: 'left',
                      borderBottom: selected ? `2px solid ${M.navy}` : '2px solid transparent',
                      '&:hover': { bgcolor: M.paper },
                    }}
                  >
                    <Typography sx={{ fontSize: '0.72rem', color: M.slate }}>{r.nation}</Typography>
                    <Typography sx={{ fontWeight: 700, color: selected ? M.navy : M.dark, fontSize: '1rem' }}>{r.code}</Typography>
                  </Box>
                )
              })}
            </Box>
            <Box sx={{ p: { xs: 3, md: 5 } }}>
              <NationBody r={active} />
            </Box>
          </Box>
        )}
      </Container>
    </Box>
  )
}

/* ─── Overview Page ────────────────────────────────────── */

export function ComplianceOverviewPage() {
  const nav = useNavigate()

  return (
    <MarketingLayout>
      <PageMeta
        title="Compliance & inspection readiness"
        description="Organise care evidence and governance across CQC, Care Inspectorate, CIW and RQIA contexts. Stay ready for inspection every day."
        canonicalPath="/compliance"
        keywords={['care compliance software', 'CQC software', 'care inspection readiness', 'care evidence management', 'UK care compliance']}
        breadcrumbs={[{ name: 'Home', path: '/' }, { name: 'Compliance', path: '/compliance' }]}
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Compliance & inspection readiness',
          description: 'Organise care evidence and governance across CQC, Care Inspectorate, CIW and RQIA contexts.',
        }}
      />

      {/* Breadcrumb */}
      <Box sx={{ background: `linear-gradient(180deg, ${M.heroTint} 0%, ${M.heroTint} 100%)`, pt: { xs: 11, md: 15 }, pb: 0 }}>
        <Container maxWidth="lg">
          <Stack direction="row" alignItems="center" spacing={1} sx={{ fontSize: '0.8125rem' }}>
            <Typography component="button" type="button" onClick={() => nav('/platform')} sx={{ border: 0, bgcolor: 'transparent', cursor: 'pointer', color: M.slate, fontSize: 'inherit', fontFamily: 'inherit', p: 0, '&:hover': { color: M.navy } }}>Platform</Typography>
            <Typography sx={{ color: M.slate }}>›</Typography>
            <Typography sx={{ fontWeight: 700, color: M.dark }}>Compliance</Typography>
          </Stack>
        </Container>
      </Box>
      {/* Hero */}
      <Box sx={{ background: `radial-gradient(640px 520px at 82% 220px, ${M.heroGlow} 0%, rgba(210,227,246,0) 70%), linear-gradient(180deg, ${M.heroTint} 0%, ${M.card} 100%)`, py: { xs: 5, md: 8 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 8 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <EyebrowPill>Compliance & inspection readiness</EyebrowPill>
              <Typography sx={{ fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', lineHeight: 1.05, fontWeight: 700, letterSpacing: '-0.03em', color: M.dark }}>
                Compliance isn't a once-a-year exercise.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography sx={{ color: M.slate, fontSize: '1.125rem', lineHeight: 1.65, mb: 2 }}>
                Build evidence and governance into everyday care work. MeticleCare supports inspection readiness — it does not guarantee compliance, a rating or an inspection outcome.
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: '1rem', lineHeight: 1.65, mb: 3 }}>
                Requirements differ across England, Scotland, Wales and Northern Ireland. The platform helps your team maintain the continuous, evidence-rich record that inspection-ready services require — without claiming equivalence between UK regulatory frameworks.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', boxShadow: 'none', '&:hover': { bgcolor: M.navyMid, boxShadow: 'none' } }}>Book a demo</Button>
                <Button variant="outlined" onClick={() => nav('/platform')} sx={{ borderColor: M.rule, color: M.dark, fontWeight: 600, px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', bgcolor: '#FFFFFF', '&:hover': { borderColor: M.navy } }}>Explore the platform</Button>
              </Stack>
              <AssureRow />
            </Grid>
          </Grid>
          <Grid container spacing={2} sx={{ mt: { xs: 4, md: 6 } }}>
            {regulators.map((r) => (
              <Grid item xs={12} sm={6} md={3} key={r.slug}>
                <Box component="a" href={`/compliance/${r.slug}`} sx={{
                  display: 'flex', flexDirection: 'column', textDecoration: 'none', color: 'inherit',
                  p: 2.5, borderRadius: M.r.lg, border: `1px solid ${M.faint}`, bgcolor: '#FFFFFF',
                  height: '100%', minHeight: 168,
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: r.color, boxShadow: M.shadow.md },
                }}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: r.color, letterSpacing: '0.08em' }}>{r.nation}</Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: '1.3rem', color: M.dark, mt: 0.5 }}>{r.code}</Typography>
                  <Typography sx={{ color: M.muted, fontSize: '0.85rem', mt: 0.5, flex: 1 }}>{r.name}</Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1, color: M.slate }}>
                    <ArrowForward sx={{ fontSize: 20 }} />
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Inspection Readiness Dashboard Mockup */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={5}>
              <Eyebrow>Always-on readiness</Eyebrow>
              <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: 700, letterSpacing: '-0.025em', color: M.dark, mb: 2 }}>
                Stay ready for inspection. Every day.
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, lineHeight: M.bodyLg.lineHeight, mb: 3 }}>
                See your compliance position at a glance. Training gaps, overdue reviews, open actions and care record completeness are tracked continuously — not assembled before an inspection.
              </Typography>
              <Typography sx={{ color: M.slate, lineHeight: 1.7 }}>
                MeticleCare surfaces what needs attention so managers can act proactively. The dashboard shows real data from your organisation's records.
              </Typography>
            </Grid>
            <Grid item xs={12} md={7}>
              <Box sx={{ p: { xs: 3, md: 4 }, bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.lg }}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 2 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>Inspection readiness</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>From your records</Typography>
                </Stack>
                <Grid container>
                  {readinessMetrics.map((m, i) => (
                    <Grid item xs={4} key={m.label} sx={{
                      p: 2,
                      borderBottom: i < 3 ? `1px solid ${M.faint}` : 'none',
                      borderRight: i % 3 !== 2 ? `1px solid ${M.faint}` : 'none',
                    }}>
                      <Typography sx={{ fontSize: '0.8rem', color: M.slate, fontWeight: 500, mb: 1 }}>{m.label}</Typography>
                      <Box sx={{ height: 8, borderRadius: 999, bgcolor: M.skel, width: '72%', mb: 0.75 }} />
                      <Box sx={{ height: 8, borderRadius: 999, bgcolor: M.skel, width: '48%' }} />
                    </Grid>
                  ))}
                </Grid>
                <Box sx={{ mt: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: M.amber, flexShrink: 0 }} />
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#9A6700' }}>Needs attention</Typography>
                  </Stack>
                  <Stack>
                    {attentionItems.map((a, i) => (
                      <Stack key={a.text} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1.5, borderTop: i === 0 ? 'none' : `1px solid ${M.faint}` }}>
                        <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: M.dark }}>{a.text}</Typography>
                        <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: M.amberLight, color: '#9A6700', display: 'grid', placeItems: 'center', fontSize: '0.78rem', fontWeight: 700, flexShrink: 0 }}>{a.count}</Box>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Continuous Record */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#FFFFFF' }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={5}>
              <Eyebrow>A continuous record</Eyebrow>
              <Typography sx={{ fontSize: M.h2.fontSize, fontWeight: 700, letterSpacing: '-0.02em', color: M.dark, mb: 2 }}>
                Evidence created as part of everyday work.
              </Typography>
              <Typography sx={{ color: M.slate, lineHeight: 1.7, mb: 3 }}>
                When care plans, notes, medication records, risks, incidents, reviews, competency and training are connected in one system, evidence is created continuously — not assembled under pressure before an inspection.
              </Typography>
              <Typography sx={{ color: M.slate, lineHeight: 1.7 }}>
                Managers can see overdue reviews, open actions, training gaps and compliance status at any time. The inspection story writes itself through the work your team already does.
              </Typography>
            </Grid>
            <Grid item xs={12} md={7}>
              <Stack spacing={0}>
                {['Care plans and support records', 'Daily care notes and observations', 'Medication administration records', 'Risk assessments and linked actions', 'Incident records and follow-up', 'Reviews, goals and health checks', 'Training and competency evidence', 'Audit logs, reports and governance'].map((label, i) => (
                  <Stack key={label} direction="row" spacing={2} alignItems="center" sx={{ py: 1.8, borderBottom: i < 7 ? `1px solid ${M.faint}` : 'none' }}>
                    <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: M.skel, color: M.slate, display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: '0.8rem', flexShrink: 0 }}>{i + 1}</Box>
                    <Typography sx={{ fontWeight: 600, color: M.dark }}>{label}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Evidence Areas */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Eyebrow center>Evidence categories</Eyebrow>
            <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: 700, letterSpacing: '-0.025em', color: M.dark }}>
              What inspectors look for. What you can show.
            </Typography>
          </Box>
          <Grid container spacing={2.5}>
            {evidenceAreas.map((e) => (
              <Grid item xs={12} sm={6} md={4} key={e.title}>
                <Box sx={{
                  p: 3.5, bgcolor: '#FFFFFF', borderRadius: M.r.lg, border: `1px solid ${M.faint}`, height: '100%',
                  transition: 'all 0.25s', '&:hover': { borderColor: M.navy, boxShadow: M.shadow.md },
                }}>
                  <Box sx={{ width: 48, height: 48, borderRadius: M.r.md, bgcolor: M.paper, border: `1px solid ${M.faint}`, display: 'grid', placeItems: 'center', mb: 2.5 }}>
                    <e.icon sx={{ color: M.navy, fontSize: 24 }} />
                  </Box>
                  <Typography sx={{ fontWeight: 600, color: M.dark, mb: 1 }}>{e.title}</Typography>
                  <Typography sx={{ color: M.slate, fontSize: '0.9rem', lineHeight: 1.6 }}>{e.desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Nation-Specific Guidance */}
      <NationGuidance />

      {/* How evidence flows */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.ink }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 4, md: 8 }} sx={{ mb: { xs: 5, md: 7 } }}>
            <Grid item xs={12} md={6}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: M.teal, mb: 1.5 }}>The evidence chain</Typography>
              <Typography sx={{ fontSize: M.h2.fontSize, fontWeight: 700, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
                From care delivery to inspection evidence.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'flex-end' }}>
              <Typography sx={{ color: M.onNavyMuted, lineHeight: 1.7 }}>
                Every interaction in MeticleCare creates an auditable trail. When an inspector asks "show me your evidence for X", the information is already connected, timestamped and traceable to the source.
              </Typography>
            </Grid>
          </Grid>
          <Box sx={{ position: 'relative' }}>
            <Box sx={{ display: { xs: 'none', md: 'block' }, position: 'absolute', top: 20, left: '8%', right: '8%', height: 2, bgcolor: 'rgba(255,255,255,0.18)' }} />
            <Box sx={{ display: { xs: 'block', md: 'none' }, position: 'absolute', top: 8, bottom: 8, left: 20, width: 2, bgcolor: 'rgba(255,255,255,0.18)' }} />
            <Grid container spacing={{ xs: 3, md: 2 }}>
              {[
                { step: 'Care delivered', detail: 'Carer records notes, administers medication, completes tasks' },
                { step: 'Records created', detail: 'Notes link to person, care plan, visit and staff member' },
                { step: 'Risks tracked', detail: 'Incidents, concerns and risk assessments updated with full history' },
                { step: 'Compliance monitored', detail: 'Training, competency and review dates tracked with alerts' },
                { step: 'Evidence generated', detail: 'Audit logs, reports and dashboards reflect real operational data' },
                { step: 'Inspection ready', detail: 'Evidence is already organised, connected and available on demand' },
              ].map((item, i) => (
                <Grid item xs={12} md={2} key={item.step}>
                  <Stack direction={{ xs: 'row', md: 'column' }} spacing={{ xs: 2, md: 0 }} alignItems={{ xs: 'flex-start', md: 'flex-start' }}>
                    <Box sx={{
                      width: 40, height: 40, borderRadius: '50%',
                      bgcolor: i === 5 ? M.teal : M.bodyText,
                      color: '#FFFFFF', position: 'relative', zIndex: 1,
                      display: 'grid', placeItems: 'center',
                      fontWeight: 700, fontSize: '0.9rem', flexShrink: 0,
                      mb: { xs: 0, md: 2 },
                    }}>{i + 1}</Box>
                    <Box>
                      <Typography sx={{ fontWeight: 700, color: '#FFFFFF', fontSize: '0.95rem' }}>{item.step}</Typography>
                      <Typography sx={{ fontSize: '0.82rem', color: M.onNavyMuted, mt: 0.5, lineHeight: 1.55 }}>{item.detail}</Typography>
                    </Box>
                  </Stack>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Container>
      </Box>

      {/* Disclaimer + CTA */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#FFFFFF' }}>
        <Container maxWidth="lg">
          <Box sx={{ p: { xs: 2.5, md: 3 }, bgcolor: '#FFFFFF', border: `1px solid ${M.faint}`, borderRadius: M.r.md, display: 'flex', gap: 2 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: M.paper, border: `1px solid ${M.faint}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <InfoOutlined sx={{ color: M.slate, fontSize: 20 }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, color: M.dark, mb: 0.5 }}>Important context</Typography>
              <Typography sx={{ color: M.slate, fontSize: '0.9rem', lineHeight: 1.6 }}>
                MeticleCare is a software tool, not a regulator, legal adviser or substitute for your organisation's policies and professional judgement. Requirements differ by nation and service type. The responsibility for compliance remains with the provider.
              </Typography>
            </Box>
          </Box>
          <Box sx={{ borderTop: `1px solid ${M.faint}`, mt: { xs: 6, md: 8 }, pt: { xs: 6, md: 8 } }}>
            <Grid container spacing={{ xs: 4, md: 8 }} alignItems="center">
              <Grid item xs={12} md={6}>
                <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: 700, letterSpacing: '-0.025em', color: M.dark }}>
                  Ready to see your evidence more clearly?
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', boxShadow: 'none', '&:hover': { bgcolor: M.navyMid, boxShadow: 'none' } }}>Book a demo</Button>
                <AssureRow />
              </Grid>
            </Grid>
          </Box>
        </Container>
      </Box>
    </MarketingLayout>
  )
}

/* ─── Regulator evidence categories (cards on desktop, rows on mobile) */

const regulatorIcons = [AssignmentTurnedIn, People, Warning, BarChart, FindInPage, LockOutlined]

function RegulatorEvidence({ r }: { r: (typeof regulators)[number] }) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  return (
    <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#FFFFFF' }}>
      <Container maxWidth="lg">
        <Box sx={{ mb: { xs: 4, md: 6 } }}>
          <EyebrowPill>Evidence categories</EyebrowPill>
          <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: 700, letterSpacing: '-0.025em', color: M.dark, maxWidth: 640 }}>
            How MeticleCare supports {r.code} evidence.
          </Typography>
        </Box>
        {isMobile ? (
          <Stack>
            {evidenceAreas.map((e, i) => {
              const Icon = regulatorIcons[i % regulatorIcons.length]
              return (
                <Stack key={e.title} direction="row" spacing={2} alignItems="flex-start" sx={{ py: 2.5, borderBottom: i < evidenceAreas.length - 1 ? `1px solid ${M.faint}` : 'none' }}>
                  <Box sx={{ color: M.navy, display: 'flex', flexShrink: 0, mt: 0.25 }}>
                    <Icon sx={{ fontSize: 26 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 700, color: M.dark }}>{e.title}</Typography>
                    <Typography sx={{ color: M.slate, fontSize: '0.9rem', lineHeight: 1.6, mt: 0.5 }}>{e.desc}</Typography>
                  </Box>
                </Stack>
              )
            })}
          </Stack>
        ) : (
          <Grid container spacing={2.5}>
            {evidenceAreas.map((e, i) => {
              const Icon = regulatorIcons[i % regulatorIcons.length]
              return (
                <Grid item xs={12} sm={6} md={4} key={e.title}>
                  <Box sx={{
                    p: 3.5, bgcolor: '#FFFFFF', borderRadius: M.r.lg, border: `1px solid ${M.faint}`, height: '100%',
                    transition: 'all 0.25s', '&:hover': { borderColor: M.navy, boxShadow: M.shadow.md },
                  }}>
                    <Box sx={{ color: M.navy, mb: 2.5, display: 'flex' }}>
                      <Icon sx={{ fontSize: 28 }} />
                    </Box>
                    <Typography sx={{ fontWeight: 700, color: M.dark, mb: 1 }}>{e.title}</Typography>
                    <Typography sx={{ color: M.slate, fontSize: '0.9rem', lineHeight: 1.6 }}>{e.desc}</Typography>
                  </Box>
                </Grid>
              )
            })}
          </Grid>
        )}
      </Container>
    </Box>
  )
}

/* ─── Regulator Detail Page ────────────────────────────── */

export function RegulatorPage() {
  const { slug } = useParams<{ slug: string }>()
  const nav = useNavigate()
  const r = regulators.find((x) => x.slug === slug) || regulators[0]

  return (
    <MarketingLayout>
      <PageMeta
        title={`${r.code} compliance support`}
        description={r.desc}
        canonicalPath={`/compliance/${r.slug}`}
        keywords={[`${r.code} software`, `${r.nation} care compliance`, `${r.code} inspection readiness`, 'care management software']}
        breadcrumbs={[
          { name: 'Home', path: '/' },
          { name: 'Compliance', path: '/compliance' },
          { name: r.code, path: `/compliance/${r.slug}` },
        ]}
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: `${r.code} compliance support`,
          description: r.desc,
        }}
      />

      {/* Breadcrumb */}
      <Box sx={{ background: `linear-gradient(180deg, ${M.heroTint} 0%, ${M.heroTint} 100%)`, pt: { xs: 11, md: 15 }, pb: 0 }}>
        <Container maxWidth="lg">
          <Stack direction="row" alignItems="center" spacing={1} sx={{ fontSize: '0.8125rem' }}>
            <Typography component="button" type="button" onClick={() => nav('/compliance')} sx={{ border: 0, bgcolor: 'transparent', cursor: 'pointer', color: M.slate, fontSize: 'inherit', fontFamily: 'inherit', p: 0, '&:hover': { color: M.navy } }}>Compliance</Typography>
            <Typography sx={{ color: M.slate }}>›</Typography>
            <Typography sx={{ fontWeight: 700, color: M.navy }}>{r.code} — {r.nation}</Typography>
          </Stack>
        </Container>
      </Box>
      {/* Hero */}
      <Box sx={{ background: `radial-gradient(640px 520px at 82% 220px, ${M.heroGlow} 0%, rgba(210,227,246,0) 70%), linear-gradient(180deg, ${M.heroTint} 0%, ${M.card} 100%)`, py: { xs: 5, md: 8 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 8 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <EyebrowPill>{r.nation} · {r.code}</EyebrowPill>
              <Typography sx={{ fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', lineHeight: 1.05, fontWeight: 700, letterSpacing: '-0.03em', color: M.dark, mb: 2.5 }}>
                {r.desc.split('.')[0]}.
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: '1.125rem', lineHeight: 1.65, mb: 3 }}>
                {r.desc}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', boxShadow: 'none', '&:hover': { bgcolor: M.navyMid, boxShadow: 'none' } }}>Book a demo</Button>
                <Button variant="outlined" onClick={() => nav('/compliance')} sx={{ borderColor: M.rule, color: M.dark, fontWeight: 600, px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', bgcolor: '#FFFFFF', '&:hover': { borderColor: M.navy } }}>See all UK regulators</Button>
              </Stack>
              <AssureRow />
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.lg, p: { xs: 2.5, md: 3 } }}>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ pb: 2.5, borderBottom: `1px solid ${M.faint}` }}>
                  <Box sx={{ width: 56, height: 56, borderRadius: r.tileRadius || M.r.md, bgcolor: M.dark, color: '#FFFFFF', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '1rem', flexShrink: 0 }}>{r.tileText}</Box>
                  <Box>
                    <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>{r.nation}</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', color: M.dark }}>{r.name}</Typography>
                  </Box>
                </Stack>
                <Stack>
                  {r.facts.map((f, i) => (
                    <Box key={f.label} sx={{ py: 1.75, borderBottom: i < r.facts.length - 1 || r.tags || r.officialLink ? `1px solid ${M.faint}` : 'none' }}>
                      <Typography sx={{ fontSize: '0.75rem', color: M.slate, mb: 0.25 }}>{f.label}</Typography>
                      <Typography sx={{ fontWeight: 600, color: M.dark }}>{f.value}</Typography>
                    </Box>
                  ))}
                  {r.tags && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, py: 1.75, borderBottom: r.officialLink ? `1px solid ${M.faint}` : 'none' }}>
                      {r.tags.map((t) => (
                        <Box key={t} sx={{ fontSize: '0.72rem', fontWeight: 700, color: M.navy, bgcolor: M.chipBlue, borderRadius: M.r.full, px: 1.5, py: 0.5 }}>{t}</Box>
                      ))}
                    </Box>
                  )}
                  {r.officialLink && (
                    <Box
                      component="a"
                      href={r.officialLink.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 1.75, textDecoration: 'none', color: M.navy, fontWeight: 600, fontSize: '0.875rem', '&:hover': { textDecoration: 'underline' } }}
                    >
                      {r.officialLink.label}
                      <OpenInNew sx={{ fontSize: 16 }} />
                    </Box>
                  )}
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Key guidance */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 3, md: 8 }} sx={{ mb: { xs: 4, md: 6 } }}>
            <Grid item xs={12} md={6}>
              <EyebrowPill>Key guidance for {r.nation}</EyebrowPill>
              <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: 700, letterSpacing: '-0.025em', color: M.dark }}>
                What this regulatory context requires.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'flex-end' }}>
              <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, lineHeight: M.bodyLg.lineHeight }}>
                Understanding your regulatory framework is the first step to building evidence that supports inspection readiness. MeticleCare helps organise the information your team already creates.
              </Typography>
            </Grid>
          </Grid>
          <Grid container spacing={{ xs: 3, md: 4 }}>
            <Grid item xs={12} md={6}>
              <Box sx={{ bgcolor: '#FFFFFF', border: `1px solid ${M.faint}`, borderRadius: M.r.lg, p: { xs: 2.5, md: 3.5 }, height: '100%' }}>
                <Typography sx={{ fontWeight: 700, color: M.dark, fontSize: '1rem', pb: 2, borderBottom: `1px solid ${M.faint}` }}>Key considerations</Typography>
                <Stack>
                  {guidancePoints(r).map((g, i, arr) => (
                    <Stack key={i} direction="row" spacing={2} alignItems="flex-start" sx={{ py: 2, borderBottom: i < arr.length - 1 ? `1px solid ${M.faint}` : 'none' }}>
                      <Typography sx={{ fontWeight: 600, color: M.muted, fontSize: '0.85rem', flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</Typography>
                      <Typography sx={{ fontSize: '0.92rem', color: M.dark, lineHeight: 1.6, fontWeight: 500 }}>{g}</Typography>
                    </Stack>
                  ))}
                </Stack>
                {guidanceNotes(r).map((n) => (
                  <Typography key={n} sx={{ fontSize: '0.8rem', color: M.muted, mt: 2 }}>{n}</Typography>
                ))}
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ bgcolor: '#FFFFFF', border: `1px solid ${M.faint}`, borderRadius: M.r.lg, p: { xs: 2.5, md: 3.5 }, height: '100%' }}>
                <Typography sx={{ fontWeight: 700, color: M.dark, fontSize: '1rem', pb: 2, borderBottom: `1px solid ${M.faint}` }}>Evidence focus</Typography>
                <Stack>
                  {r.evidenceFocus.map((ef, i) => (
                    <Stack key={ef} direction="row" spacing={1.5} alignItems="flex-start" sx={{ py: 1.75, borderBottom: i < r.evidenceFocus.length - 1 ? `1px solid ${M.faint}` : 'none' }}>
                      <CheckCircle sx={{ color: M.navy, fontSize: 18, mt: 0.2, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: '0.9rem', color: M.dark, fontWeight: 500 }}>{ef}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Evidence Areas */}
      <RegulatorEvidence r={r} />

      {/* Context + other nations + CTA */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#FFFFFF' }}>
        <Container maxWidth="lg">
          <ContextBanner tinted />
          <Typography sx={{ fontSize: M.h2.fontSize, fontWeight: 700, letterSpacing: '-0.02em', color: M.dark, mt: { xs: 6, md: 8 }, mb: 3 }}>
            Other UK nations
          </Typography>
          <Grid container spacing={2}>
            {regulators.filter((o) => o.slug !== r.slug).map((o) => (
              <Grid item xs={12} md={4} key={o.slug}>
                <Box component="a" href={`/compliance/${o.slug}`} sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2,
                  textDecoration: 'none', color: 'inherit', p: 2.5,
                  borderRadius: M.r.md, border: `1px solid ${M.faint}`, bgcolor: '#FFFFFF',
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: o.color, boxShadow: M.shadow.md },
                }}>
                  <Box>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: o.color, letterSpacing: '0.08em' }}>{o.nation}</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.15rem', color: M.dark, mt: 0.5 }}>{o.code}</Typography>
                  </Box>
                  <Box sx={{ color: M.navy, display: 'flex' }}>
                    <ArrowForward sx={{ fontSize: 20 }} />
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
          <Box sx={{ borderTop: `1px solid ${M.faint}`, mt: { xs: 6, md: 8 }, pt: { xs: 6, md: 8 } }}>
            <Grid container spacing={{ xs: 4, md: 8 }} alignItems="center">
              <Grid item xs={12} md={6}>
                <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: 700, letterSpacing: '-0.025em', color: M.dark }}>
                  Talk through your {r.nation} regulatory context.
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', boxShadow: 'none', '&:hover': { bgcolor: M.navyMid, boxShadow: 'none' } }}>Book a demo</Button>
                <AssureRow />
              </Grid>
            </Grid>
          </Box>
        </Container>
      </Box>
    </MarketingLayout>
  )
}

export default function CompliancePageWrapper() {
  const { slug } = useParams<{ slug: string }>()
  if (slug) return <RegulatorPage />
  return <ComplianceOverviewPage />
}
