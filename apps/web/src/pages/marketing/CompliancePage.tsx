import { Box, Button, Container, Grid, Stack, Typography } from '@mui/material'
import {
  ArrowForward, Shield, AssignmentTurnedIn, People, TrendingUp,
  Description, Security, CheckCircle,
} from '@mui/icons-material'
import { useNavigate, useParams } from 'react-router-dom'
import { M } from '../../styles/marketing-tokens'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'

function Eyebrow({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
      <Box sx={{ width: 8, height: 8, borderRadius: M.r.full, bgcolor: color || M.teal }} />
      <Typography sx={{ color: color || M.tealDeep, fontSize: M.caption.fontSize, fontWeight: M.caption.fontWeight, letterSpacing: M.caption.letterSpacing, textTransform: 'uppercase' }}>{children}</Typography>
    </Stack>
  )
}

/* ─── Regulator data with nation-specific guidance ──────── */

const regulators = [
  {
    slug: 'cqc', code: 'CQC', name: 'Care Quality Commission', nation: 'England', color: '#2563EB',
    desc: 'CQC uses its own assessment approach and quality statements. MeticleCare helps providers organise care records, workforce evidence, incidents, reviews and governance information for their own inspection-readiness work.',
    guidance: [
      'CQC assesses services against five key questions: Safe, Effective, Caring, Responsive and Well-led.',
      'Providers are expected to demonstrate continuous improvement, not just minimum compliance.',
      'Evidence should show how care is personalised, how risks are managed and how learning drives change.',
      'Staff competency, training and supervision records support the Well-led and Effective domains.',
      'Incident records, risk assessments and safeguarding evidence demonstrate the Safe domain.',
    ],
    evidenceFocus: ['Quality statements alignment', 'Staff training and supervision evidence', 'Person-centred care demonstrations', 'Governance and leadership evidence', 'Risk management and incident follow-up'],
  },
  {
    slug: 'care-inspectorate', code: 'Care Inspectorate', name: 'Care Inspectorate', nation: 'Scotland', color: '#DC2626',
    desc: "The Care Inspectorate operates within Scotland's health and social care context. MeticleCare helps teams keep evidence, reviews, actions and operational records organised.",
    guidance: [
      'The Care Inspectorate uses quality indicators covering staffing, care and support, and management and leadership.',
      'Scotland\'s Health and Social Care Standards emphasise dignity, choice and control for people receiving care.',
      'Providers should demonstrate how they involve people in decisions about their care and support.',
      'Evidence should show how feedback from people, families and staff drives improvement.',
      'National Care Standards apply across all care settings in Scotland.',
    ],
    evidenceFocus: ['Quality indicator evidence', 'National Care Standards alignment', 'People\'s experience and outcomes', 'Continuous improvement evidence', 'Staff and management oversight'],
  },
  {
    slug: 'ciw', code: 'CIW', name: 'Care Inspectorate Wales', nation: 'Wales', color: '#059669',
    desc: 'Care Inspectorate Wales has its own regulatory and inspection context. MeticleCare helps Welsh providers connect everyday records, governance and follow-up actions.',
    guidance: [
      'CIW inspects against the Care Standards Act 2000 and related Welsh regulations.',
      'Essential Quality Standards cover staffing, management, care and support, and premises.',
      'Welsh providers must demonstrate how they meet the Needs and Safeguarding standards.',
      'Evidence should show how services are person-centred and outcome-focused.',
      'The Social Services and Well-being (Wales) Act 2014 shapes the regulatory framework.',
    ],
    evidenceFocus: ['Essential Quality Standards evidence', 'Person-centred care records', 'Safeguarding and protection evidence', 'Staff training and deployment records', 'Management and leadership evidence'],
  },
  {
    slug: 'rqia', code: 'RQIA', name: 'Regulation and Quality Improvement Authority', nation: 'Northern Ireland', color: '#7C3AED',
    desc: 'RQIA regulates health and social care services in Northern Ireland. MeticleCare supports structured records, workforce information, incidents and actions.',
    guidance: [
      'RQIA assesses services against standards set by the Health and Personal Social Services Order.',
      'Minimum standards cover staffing, care and support, management and administration, and environment.',
      'Providers should demonstrate how they protect the safety and welfare of people receiving care.',
      'Evidence should show effective communication between staff, management and external agencies.',
      'RQIA uses a quality improvement approach alongside traditional inspection.',
    ],
    evidenceFocus: ['Minimum standards evidence', 'Safety and welfare records', 'Staffing and training evidence', 'Management oversight and governance', 'Communication and liaison records'],
  },
]

const evidenceAreas = [
  { icon: Description, title: 'Care records & plans', desc: 'Person-centred support plans, daily notes, reviews and health observations — connected and current.' },
  { icon: People, title: 'Workforce & competency', desc: 'Training matrices, competency assessments, identity monitoring and right-to-work evidence.' },
  { icon: Shield, title: 'Risk, incidents & actions', desc: 'Risk assessments, incident records, follow-up actions and escalation history with full audit trail.' },
  { icon: TrendingUp, title: 'Reports & audit logs', desc: 'Operational reports, AI-assisted insights, compliance dashboards and exportable evidence packs.' },
  { icon: AssignmentTurnedIn, title: 'Governance & policies', desc: 'Policy management, satisfaction surveys, staff engagement and compliance portal access.' },
  { icon: Security, title: 'Data protection', desc: 'DSPT compliance, MFA, RBAC, encryption and audit logging for governance evidence.' },
]

const readinessMetrics = [
  { label: 'Care records', value: '98%', color: M.green },
  { label: 'Reviews', value: '96%', color: M.green },
  { label: 'Training', value: '94%', color: M.amber },
  { label: 'Competency', value: '97%', color: M.green },
  { label: 'Risk reviews', value: '99%', color: M.green },
  { label: 'Open actions', value: '3', color: M.coral },
]

const attentionItems = [
  { text: 'Training renewal due', count: 2, color: M.amber },
  { text: 'Care plan reviews overdue', count: 4, color: M.amber },
  { text: 'Risk assessments needing review', count: 2, color: M.coral },
  { text: 'DBS checks expiring', count: 1, color: M.coral },
]

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

      {/* Hero */}
      <Box sx={{ py: { xs: 10, md: 16 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <Eyebrow>Compliance & inspection readiness</Eyebrow>
              <Typography sx={{ fontSize: M.display.fontSize, lineHeight: M.display.lineHeight, fontWeight: M.display.fontWeight, letterSpacing: M.display.letterSpacing, mb: 3 }}>
                Compliance isn't a once-a-year exercise.
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, lineHeight: M.bodyLg.lineHeight, mb: 3 }}>
                Build evidence and governance into everyday care work. MeticleCare supports inspection readiness — it does not guarantee compliance, a rating or an inspection outcome.
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: M.body.fontSize, lineHeight: M.body.lineHeight, mb: 4 }}>
                Requirements differ across England, Scotland, Wales and Northern Ireland. The platform helps your team maintain the continuous, evidence-rich record that inspection-ready services require — without claiming equivalence between UK regulatory frameworks.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.teal, color: M.navy, fontWeight: 700, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', '&:hover': { bgcolor: M.tealDark } }}>Book a demo</Button>
                <Button variant="outlined" onClick={() => nav('/platform')} sx={{ borderColor: M.subtle, color: M.ink, fontWeight: 700, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none' }}>See the platform</Button>
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Grid container spacing={2}>
                {regulators.map((r) => (
                  <Grid item xs={12} sm={6} key={r.slug}>
                    <Box component="a" href={`/compliance/${r.slug}`} sx={{
                      display: 'block', textDecoration: 'none', color: 'inherit',
                      p: 2.5, borderRadius: M.r.md, border: `1px solid ${M.faint}`,
                      borderLeft: `3px solid ${r.color}`, height: '100%',
                      transition: 'all 0.2s',
                      '&:hover': { borderColor: r.color, boxShadow: M.shadow.md },
                    }}>
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: r.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{r.nation}</Typography>
                      <Typography sx={{ fontWeight: 700, fontSize: '1.15rem', mt: 0.5 }}>{r.code}</Typography>
                      <Typography sx={{ color: M.muted, fontSize: '0.82rem', mt: 0.5 }}>{r.name}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Inspection Readiness Dashboard Mockup */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.card }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={5}>
              <Eyebrow>Always-on readiness</Eyebrow>
              <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing, mb: 2 }}>
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
              <Box sx={{ p: { xs: 3, md: 4 }, bgcolor: M.paper, borderRadius: M.r.xl, border: `1px solid ${M.faint}` }}>
                <Typography sx={{ ...M.label, color: M.muted, mb: 2.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Inspection readiness</Typography>
                <Grid container spacing={2}>
                  {readinessMetrics.map((m) => (
                    <Grid item xs={4} key={m.label}>
                      <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: M.r.md, bgcolor: M.card, border: `1px solid ${M.faint}` }}>
                        <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: m.color, letterSpacing: '-0.03em' }}>{m.value}</Typography>
                        <Typography sx={{ fontSize: '0.72rem', color: M.muted, mt: 0.25 }}>{m.label}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
                <Box sx={{ mt: 2.5, p: 2, borderRadius: M.r.md, bgcolor: M.card, border: `1px solid ${M.faint}` }}>
                  <Typography sx={{ ...M.label, color: M.muted, mb: 1 }}>Needs attention</Typography>
                  <Stack spacing={0.75}>
                    {attentionItems.map((a) => (
                      <Stack key={a.text} direction="row" justifyContent="space-between" alignItems="center">
                        <Typography sx={{ fontSize: '0.82rem', fontWeight: 500 }}>{a.text}</Typography>
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: a.color, bgcolor: `${a.color}15`, px: 1, py: 0.25, borderRadius: M.r.sm }}>{a.count}</Typography>
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
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={5}>
              <Eyebrow>A continuous record</Eyebrow>
              <Typography sx={{ fontSize: M.h2.fontSize, fontWeight: M.h2.fontWeight, letterSpacing: M.h2.letterSpacing, mb: 2 }}>
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
                    <Box sx={{ width: 32, height: 32, borderRadius: M.r.sm, bgcolor: M.tealSoft, color: M.tealDeep, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.82rem', flexShrink: 0 }}>{i + 1}</Box>
                    <Typography sx={{ fontWeight: 600 }}>{label}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Evidence Areas */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.card }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Eyebrow>Evidence categories</Eyebrow>
            <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing }}>
              What inspectors look for. What you can show.
            </Typography>
          </Box>
          <Grid container spacing={2.5}>
            {evidenceAreas.map((e) => (
              <Grid item xs={12} sm={6} md={4} key={e.title}>
                <Box sx={{
                  p: 3.5, bgcolor: M.paper, borderRadius: M.r.lg, border: `1px solid ${M.faint}`, height: '100%',
                  transition: 'all 0.25s', '&:hover': { borderColor: M.teal, boxShadow: M.shadow.md },
                }}>
                  <Box sx={{ width: 48, height: 48, borderRadius: M.r.md, bgcolor: M.tealSoft, display: 'grid', placeItems: 'center', mb: 2.5 }}>
                    <e.icon sx={{ color: M.tealDeep, fontSize: 24 }} />
                  </Box>
                  <Typography sx={{ fontWeight: 700, mb: 1 }}>{e.title}</Typography>
                  <Typography sx={{ color: M.slate, fontSize: '0.9rem', lineHeight: 1.6 }}>{e.desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Nation-Specific Guidance */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Eyebrow>Nation-specific guidance</Eyebrow>
            <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing, mb: 2 }}>
              Four nations. Different frameworks. One platform.
            </Typography>
            <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, maxWidth: 600, mx: 'auto' }}>
              Each UK nation has its own regulatory framework. MeticleCare supports the evidence and governance work across all four — without claiming equivalence between them.
            </Typography>
          </Box>
          <Stack spacing={4}>
            {regulators.map((r) => (
              <Box key={r.slug} sx={{
                p: { xs: 3, md: 4 }, bgcolor: M.card, borderRadius: M.r.lg,
                border: `1px solid ${M.faint}`, borderLeft: `3px solid ${r.color}`,
              }}>
                <Grid container spacing={{ xs: 4, md: 6 }} alignItems="flex-start">
                  <Grid item xs={12} md={4}>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: r.color, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>{r.nation}</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.3rem', mb: 1 }}>{r.code}</Typography>
                    <Typography sx={{ color: M.muted, fontSize: '0.85rem', mb: 2 }}>{r.name}</Typography>
                    <Button component="a" href={`/compliance/${r.slug}`} endIcon={<ArrowForward />} sx={{ color: r.color, fontWeight: 700, px: 0, textTransform: 'none', fontSize: '0.85rem' }}>
                      Explore {r.code} guidance
                    </Button>
                  </Grid>
                  <Grid item xs={12} md={8}>
                    <Typography sx={{ fontWeight: 600, mb: 1.5, fontSize: '0.9rem' }}>Key considerations:</Typography>
                    <Stack spacing={1}>
                      {r.guidance.map((g, i) => (
                        <Stack key={i} direction="row" spacing={1.5} alignItems="flex-start">
                          <CheckCircle sx={{ color: r.color, fontSize: 16, mt: 0.25, flexShrink: 0 }} />
                          <Typography sx={{ fontSize: '0.88rem', color: M.slate, lineHeight: 1.5 }}>{g}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
                      {r.evidenceFocus.map((ef) => (
                        <Box key={ef} sx={{ px: 1.5, py: 0.5, borderRadius: M.r.sm, bgcolor: M.faint, fontSize: '0.75rem', fontWeight: 600, color: M.slate }}>
                          {ef}
                        </Box>
                      ))}
                    </Stack>
                  </Grid>
                </Grid>
              </Box>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* How evidence flows */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.card }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={5}>
              <Eyebrow>The evidence chain</Eyebrow>
              <Typography sx={{ fontSize: M.h2.fontSize, fontWeight: M.h2.fontWeight, letterSpacing: M.h2.letterSpacing, mb: 2 }}>
                From care delivery to inspection evidence.
              </Typography>
              <Typography sx={{ color: M.slate, lineHeight: 1.7 }}>
                Every interaction in MeticleCare creates an auditable trail. When an inspector asks "show me your evidence for X", the information is already connected, timestamped and traceable to the source.
              </Typography>
            </Grid>
            <Grid item xs={12} md={7}>
              <Stack spacing={0}>
                {[
                  { step: 'Care delivered', detail: 'Carer records notes, administers medication, completes tasks' },
                  { step: 'Records created', detail: 'Notes link to person, care plan, visit and staff member' },
                  { step: 'Risks tracked', detail: 'Incidents, concerns and risk assessments updated with full history' },
                  { step: 'Compliance monitored', detail: 'Training, competency and review dates tracked with alerts' },
                  { step: 'Evidence generated', detail: 'Audit logs, reports and dashboards reflect real operational data' },
                  { step: 'Inspection ready', detail: 'Evidence is already organised, connected and available on demand' },
                ].map((item, i) => (
                  <Stack key={item.step} direction="row" spacing={2} alignItems="flex-start" sx={{ py: 2, borderBottom: i < 5 ? `1px solid ${M.faint}` : 'none' }}>
                    <Box sx={{
                      width: 28, height: 28, borderRadius: M.r.sm,
                      bgcolor: i === 5 ? M.teal : M.faint,
                      color: i === 5 ? M.navy : M.muted,
                      display: 'grid', placeItems: 'center',
                      fontWeight: 700, fontSize: '0.72rem', flexShrink: 0, mt: 0.25,
                    }}>{i + 1}</Box>
                    <Box>
                      <Typography sx={{ fontWeight: i === 5 ? 700 : 600, color: i === 5 ? M.tealDeep : M.ink }}>{item.step}</Typography>
                      <Typography sx={{ fontSize: '0.85rem', color: M.slate, mt: 0.25 }}>{item.detail}</Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Disclaimer */}
      <Box sx={{ py: { xs: 6, md: 8 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Box sx={{ p: 3, bgcolor: M.amberLight, borderRadius: M.r.md, borderLeft: `3px solid ${M.amber}` }}>
            <Typography sx={{ fontWeight: 700, color: '#92400E', mb: 0.5 }}>Important context</Typography>
            <Typography sx={{ color: '#78350F', fontSize: '0.9rem', lineHeight: 1.6 }}>
              MeticleCare is a software tool, not a regulator, legal adviser or substitute for your organisation's policies and professional judgement. Requirements differ by nation and service type. The responsibility for compliance remains with the provider.
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* CTA */}
      <Box sx={{ py: { xs: 10, md: 14 }, background: `linear-gradient(160deg, ${M.navy} 0%, #162032 50%, #1A2744 100%)`, textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing, color: M.card, mb: 2 }}>
            Ready to see your evidence more clearly?
          </Typography>
          <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.teal, color: M.navy, fontWeight: 700, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', '&:hover': { bgcolor: M.tealDark } }}>Book a demo</Button>
        </Container>
      </Box>
    </MarketingLayout>
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

      {/* Hero */}
      <Box sx={{ py: { xs: 10, md: 16 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: M.r.full, bgcolor: r.color }} />
            <Typography sx={{ color: r.color, fontSize: M.caption.fontSize, fontWeight: M.caption.fontWeight, letterSpacing: M.caption.letterSpacing, textTransform: 'uppercase' }}>{r.nation} · {r.code}</Typography>
          </Stack>
          <Typography sx={{ fontSize: M.display.fontSize, lineHeight: M.display.lineHeight, fontWeight: M.display.fontWeight, letterSpacing: M.display.letterSpacing, mb: 3 }}>
            {r.desc.split('.')[0]}.
          </Typography>
          <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, lineHeight: M.bodyLg.lineHeight, maxWidth: 640, mb: 4 }}>
            {r.desc}
          </Typography>
          <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: r.color, color: '#fff', fontWeight: 700, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none' }}>Talk to us</Button>
        </Container>
      </Box>

      {/* Nation-Specific Guidance */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.card }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="flex-start">
            <Grid item xs={12} md={5}>
              <Eyebrow color={r.color}>Key guidance for {r.nation}</Eyebrow>
              <Typography sx={{ fontSize: M.h2.fontSize, fontWeight: M.h2.fontWeight, letterSpacing: M.h2.letterSpacing, mb: 2 }}>
                What this regulatory context requires.
              </Typography>
              <Typography sx={{ color: M.slate, lineHeight: 1.7, mb: 3 }}>
                Understanding your regulatory framework is the first step to building evidence that supports inspection readiness. MeticleCare helps organise the information your team already creates.
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
                {r.evidenceFocus.map((ef) => (
                  <Box key={ef} sx={{ px: 1.5, py: 0.5, borderRadius: M.r.sm, bgcolor: `${r.color}12`, fontSize: '0.75rem', fontWeight: 600, color: r.color }}>
                    {ef}
                  </Box>
                ))}
              </Stack>
            </Grid>
            <Grid item xs={12} md={7}>
              <Stack spacing={2}>
                {r.guidance.map((g, i) => (
                  <Box key={i} sx={{ p: 2.5, borderRadius: M.r.md, border: `1px solid ${M.faint}`, borderLeft: `3px solid ${r.color}` }}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <CheckCircle sx={{ color: r.color, fontSize: 18, mt: 0.25, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: '0.92rem', lineHeight: 1.6, fontWeight: 500 }}>{g}</Typography>
                    </Stack>
                  </Box>
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
            <Eyebrow>Evidence categories</Eyebrow>
            <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing }}>
              How MeticleCare supports {r.code} evidence.
            </Typography>
          </Box>
          <Grid container spacing={2.5}>
            {evidenceAreas.map((e) => (
              <Grid item xs={12} sm={6} key={e.title}>
                <Box sx={{
                  p: 3.5, bgcolor: M.card, borderRadius: M.r.lg, border: `1px solid ${M.faint}`, height: '100%',
                  transition: 'all 0.25s', '&:hover': { borderColor: r.color, boxShadow: M.shadow.md },
                }}>
                  <Box sx={{ width: 48, height: 48, borderRadius: M.r.md, bgcolor: `${r.color}12`, display: 'grid', placeItems: 'center', mb: 2.5 }}>
                    <e.icon sx={{ color: r.color, fontSize: 24 }} />
                  </Box>
                  <Typography sx={{ fontWeight: 700, mb: 1 }}>{e.title}</Typography>
                  <Typography sx={{ color: M.slate, fontSize: '0.9rem', lineHeight: 1.6 }}>{e.desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
          <Box sx={{ mt: 5, p: 3, bgcolor: M.amberLight, borderRadius: M.r.md, borderLeft: `3px solid ${M.amber}` }}>
            <Typography sx={{ color: '#78350F', fontSize: '0.9rem', lineHeight: 1.6 }}>
              MeticleCare is a software tool, not a regulator. Requirements differ by nation and service type. The responsibility for compliance remains with the provider.
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* CTA */}
      <Box sx={{ py: { xs: 10, md: 14 }, background: `linear-gradient(160deg, ${M.navy} 0%, #162032 50%, #1A2744 100%)`, textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing, color: M.card, mb: 2 }}>
            Talk through your {r.nation} regulatory context.
          </Typography>
          <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.teal, color: M.navy, fontWeight: 700, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', '&:hover': { bgcolor: M.tealDark } }}>Book a demo</Button>
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
