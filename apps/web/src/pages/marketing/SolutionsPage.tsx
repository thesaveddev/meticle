import { Box, Button, Chip, Container, Grid, Stack, Typography } from '@mui/material'
import { ArrowForward, Check, AccessTime, Person } from '@mui/icons-material'
import { useNavigate, useParams } from 'react-router-dom'
import { M } from '../../styles/marketing-tokens'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'

function SectionLabel({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <Box sx={{ mb: 1, textAlign: center ? "center" : "left" }}>
      <Typography component="span" sx={{ fontSize: "0.75rem", lineHeight: 1.3, fontWeight: 600, letterSpacing: "0.08em", color: M.tealDeep, borderBottom: "2px solid " + M.teal, pb: 0.5, textTransform: "uppercase" }}>{children}</Typography>
    </Box>
  )
}

function Breadcrumb({ trail }: { trail: { label: string; to?: string }[] }) {
  const nav = useNavigate()
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 4 }}>
      {trail.map((t, i) => (
        <Stack key={t.label} direction="row" spacing={1} alignItems="center">
          {i > 0 && <Typography sx={{ color: M.subtle, fontSize: '0.8rem' }}>/</Typography>}
          {t.to ? (
            <Typography
              component="button"
              type="button"
              onClick={() => nav(t.to!)}
              sx={{ border: 0, bgcolor: 'transparent', cursor: 'pointer', color: M.slate, fontSize: '0.8rem', p: 0, fontFamily: M.font, '&:hover': { textDecoration: 'underline' } }}
            >
              {t.label}
            </Typography>
          ) : (
            <Typography sx={{ color: M.ink, fontSize: '0.8rem', fontWeight: 600 }}>{t.label}</Typography>
          )}
        </Stack>
      ))}
    </Stack>
  )
}

function TrustChecks() {
  const items = [
    { icon: AccessTime, label: '30-minute scoping call' },
    { icon: Check, label: '14-day free trial' },
    { icon: Person, label: 'Named point of contact' },
  ]
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1, sm: 3 }} sx={{ mt: 3 }}>
      {items.map((t) => (
        <Stack key={t.label} direction="row" spacing={1} alignItems="center">
          <t.icon sx={{ color: M.navy, fontSize: 16 }} />
          <Typography sx={{ color: M.slate, fontSize: '0.82rem', fontWeight: 500 }}>{t.label}</Typography>
        </Stack>
      ))}
    </Stack>
  )
}

/* ─── Mockup cards (static product illustrations) ─────────── */

function MockShell({ header, badge, badgeTone, children }: { header: string; badge: string; badgeTone: 'live' | 'link' | 'warn' | 'muted'; children: React.ReactNode }) {
  const tones = {
    live: { color: M.green, bgcolor: M.greenLight },
    link: { color: M.navy, bgcolor: '#E8F1FD' },
    warn: { color: '#B42318', bgcolor: M.coralLight },
    muted: { color: M.slate, bgcolor: M.faint },
  }[badgeTone]
  return (
    <Box sx={{ bgcolor: M.card, borderRadius: M.r.lg, border: `1px solid ${M.faint}`, boxShadow: M.shadow.lg, overflow: 'hidden' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${M.faint}` }}>
        <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: M.ink }}>{header}</Typography>
        <Chip label={badge} size="small" sx={{ height: 22, fontSize: '0.68rem', fontWeight: 600, ...tones }} />
      </Stack>
      <Box sx={{ p: 2.5 }}>{children}</Box>
    </Box>
  )
}

function CallRow({ time, name, status, tone }: { time: string; name: string; status: string; tone: 'live' | 'link' | 'warn' | 'muted' }) {
  const tones = {
    live: { color: M.green, bgcolor: M.greenLight },
    link: { color: M.navy, bgcolor: '#E8F1FD' },
    warn: { color: '#B42318', bgcolor: M.coralLight },
    muted: { color: M.slate, bgcolor: M.faint },
  }[tone]
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1.25, borderBottom: `1px solid ${M.faint}`, '&:last-child': { borderBottom: 'none' } }}>
      <Stack direction="row" spacing={1.5} alignItems="baseline">
        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: M.slate, minWidth: 44 }}>{time}</Typography>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 500, color: M.ink }}>{name}</Typography>
      </Stack>
      <Chip label={status} size="small" sx={{ height: 22, fontSize: '0.68rem', fontWeight: 600, ...tones }} />
    </Stack>
  )
}

function KVRow({ k, v, chip, chipTone }: { k: string; v: string; chip?: string; chipTone?: 'live' | 'link' | 'warn' | 'muted' }) {
  const tones = chipTone ? {
    live: { color: M.green, bgcolor: M.greenLight },
    link: { color: M.navy, bgcolor: '#E8F1FD' },
    warn: { color: '#B42318', bgcolor: M.coralLight },
    muted: { color: M.slate, bgcolor: M.faint },
  }[chipTone] : null
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ py: 1, borderBottom: `1px solid ${M.faint}`, '&:last-child': { borderBottom: 'none' } }}>
      <Box>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: M.ink }}>{k}</Typography>
        <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>{v}</Typography>
      </Box>
      {chip && <Chip label={chip} size="small" sx={{ height: 22, fontSize: '0.68rem', fontWeight: 600, flexShrink: 0, ...tones }} />}
    </Stack>
  )
}

/* ─── Domiciliary Care content ─────────────────────────────── */

const domCare = {
  title: 'Domiciliary Care',
  tagline: 'From the office to the doorstep.',
  desc: 'Plan packages and calls, assign carers, capture visit records, manage travel and exceptions, and keep managers close to what is happening today.',
}

const domWhy = [
  {
    title: 'You cannot manage domiciliary care on spreadsheets.',
    body: 'When visits span multiple areas, carers travel between clients, and call statuses change by the minute, a spreadsheet breaks down within hours. MeticleCare gives coordinators an operational picture that updates as carers check in: which calls are covered, which are at risk, and what happened during each visit.',
    check: 'Real-time visibility replaces end-of-day guesswork',
  },
  {
    title: 'Every missed call has a person behind it.',
    body: 'When a scheduled visit does not happen, the system flags it immediately. Managers see the reason, the client affected, and the escalation path. Follow-ups are tracked — not forgotten in an inbox.',
    check: 'Every visit creates an auditable record',
  },
  {
    title: 'Carers need information at the door, not at the office.',
    body: 'The mobile app gives carers care plans, medication references, risk alerts and visit tasks before they arrive. They check in, record what happened, and move to the next call — all without returning to base.',
    check: 'Carers carry the information they need, not just a schedule',
  },
]

const domModules = [
  { title: 'Call scheduling', desc: 'Build the day around client needs, carer availability and geographic areas. Drag calls to carers, detect conflicts and see the full schedule at a glance.' },
  { title: 'Mobile check-in and recording', desc: 'Carers check in at the door, record care notes, report disruptions (traffic, client unavailable, unsafe conditions) and check out — creating a timed, geo-tagged record of every visit.' },
  { title: 'Carer assignment and workload', desc: 'See each carer\'s calls for the day, their total hours, and gaps between visits. Assign based on area proximity, skills and availability. The drag-and-drop board prevents double-booking and flags tight turnarounds.' },
  { title: 'Area-based coverage', desc: 'Organise your service into geographic areas. See how many carers cover each zone, how many clients are served, and where coverage is thin — before it becomes a problem.' },
  { title: 'Missed call management', desc: 'Overdue calls escalate automatically. Managers see what happened, who was affected, whether a follow-up communication was made, and whether an incident was raised.' },
  { title: 'Timesheets and payroll', desc: 'Approved visit records, travel time and mileage flow into timesheets. Export for payroll processing. Carers can view their earnings on mobile.' },
  { title: 'Availability and leave', desc: 'Carers submit availability up to 4 months ahead. Managers approve leave, see coverage impact, and use the shift marketplace to fill open calls.' },
  { title: 'Family communication', desc: 'Families receive visit summaries and relevant updates through a secure portal. Communication is controlled by the service — not automated without oversight.' },
]

const domWorkflow = [
  { step: '01', title: 'Plan', desc: 'Coordinators review client packages, carer availability and area coverage. Calls are allocated based on proximity, skills and contractual hours. Open calls go to the shift marketplace.' },
  { step: '02', title: 'Dispatch', desc: 'Carers receive their schedule on mobile. Each call shows the client, address, time window, tasks and any alerts. Travel time and route are visible.' },
  { step: '03', title: 'Deliver', desc: 'Carers check in at the door (GPS-verified), record care notes, complete tasks, report disruptions and check out. Medication references, care plans and risk alerts are available before and during the visit.' },
  { step: '04', title: 'Review', desc: 'Managers see call completion rates, missed visits, late arrivals and disruption reports. End-of-day summaries show what was delivered, what needs follow-up and where gaps occurred.' },
]

/* ─── Supported Living content ─────────────────────────────── */

const slCare = {
  title: 'Supported Living',
  tagline: 'Connected around the person.',
  desc: 'Keep person-centred support, daily records, medication, risks, incidents, reviews and workforce governance connected across your service.',
}

const slWhy = [
  {
    title: 'Inspection readiness is built into daily work, not added afterwards.',
    body: 'When care plans, daily notes, medication records, risk assessments, incidents, training and competency are all connected, the evidence your inspector needs already exists — linked, timestamped and traceable to the source.',
    check: 'Evidence is generated by doing the work, not writing reports',
  },
  {
    title: 'Medication errors are one of the most common incident types in care.',
    body: 'MeticleCare\'s eMAR tracks every administration, flags exceptions, and maintains a clear audit trail. Stock control, PRN tracking and controlled-drug workflows are handled within the same system — not in a separate spreadsheet.',
    check: 'Medication governance is built into daily workflows',
  },
  {
    title: 'The person\'s story should be in one place.',
    body: 'Support plans, daily notes, health observations, body maps, incidents and reviews all connect to the person record. When a new staff member starts, they can understand the individual — not just their last shift.',
    check: 'Every record connects to the person and their care plan',
  },
]

const slModules = [
  { title: 'Person-centred care records', desc: 'Support plans, goals, preferences and daily notes are connected to the person. Every interaction — medication, notes, observations — builds the picture over time.' },
  { title: 'Medication management (eMAR)', desc: '31-day administration records, stock control, PRN tracking, exception recording and controlled-drug workflows. Role-based access ensures only authorised staff administer or view medication data.' },
  { title: 'Risk and incident management', desc: 'Risk assessments linked to care plans with review dates. Incident recording with severity, involved persons, root cause, actions, follow-up and escalation history.' },
  { title: 'Workforce and competency', desc: 'Staff profiles, training matrices, competency assessments, availability, leave and right-to-work monitoring. Non-compliant staff are flagged before they are assigned to shifts.' },
  { title: 'Scheduling and rota', desc: 'Shift planning with staff availability, competency matching and manager approval. Connected to timesheets and payroll. The shift marketplace fills hard-to-cover shifts.' },
  { title: 'Compliance evidence', desc: 'Evidence packs, audit logs, training compliance, identity monitoring and inspection-readiness dashboards. Compliance data is generated by normal operations — not assembled at the last minute.' },
  { title: 'Family portal', desc: 'Authorised relatives access relevant care information, updates and communication — with access controlled entirely by the service. No information is shared without explicit permission.' },
  { title: 'AI intelligence', desc: 'Care summaries, record change summaries, risk signals with source traceability, compliance copilot and manager briefings. AI assists; a person remains responsible for every decision.' },
]

const slWorkflow = [
  { step: '01', title: 'Understand', desc: 'Care plans, preferences, goals, health information and risk assessments create a complete picture of each person. This is the foundation for every decision.' },
  { step: '02', title: 'Deliver', desc: 'Staff record daily notes, administer medication, capture observations and manage incidents — all linked to the person record and care plan.' },
  { step: '03', title: 'Manage', desc: 'Managers oversee training, competency, staffing, leave and compliance. Risk assessments stay current. Incidents are investigated and followed up.' },
  { step: '04', title: 'Prove', desc: 'Evidence is generated continuously through normal operations. Audit logs, training records, incident investigations and care-plan reviews are always available for inspection.' },
]

/* ─── Page Component ──────────────────────────────────────── */

export default function SolutionsPage() {
  const { slug } = useParams<{ slug: string }>()
  const nav = useNavigate()
  const isHomecare = slug === 'domiciliary-care'
  const data = isHomecare ? domCare : slCare
  const why = isHomecare ? domWhy : slWhy
  const modules = isHomecare ? domModules : slModules
  const workflow = isHomecare ? domWorkflow : slWorkflow

  return (
    <MarketingLayout>
      <PageMeta
        title={`${data.title} software`}
        description={data.desc}
        canonicalPath={`/solutions/${slug}`}
        keywords={[`${data.title.toLowerCase()} software`, 'care management software', 'MeticleCare platform', 'UK care software']}
        breadcrumbs={[{ name: 'Home', path: '/' }, { name: data.title, path: `/solutions/${slug}` }]}
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: `MeticleCare for ${data.title}`,
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web and mobile',
          description: data.desc,
        }}
      />

      {/* ═══ HERO ═══ */}
      <Box sx={{ pt: { xs: 6, md: 10 }, pb: { xs: 10, md: 16 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Breadcrumb trail={[{ label: 'Solutions', to: '/platform' }, { label: data.title }]} />
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <SectionLabel>{data.title}</SectionLabel>
              <Typography sx={{ fontSize: M.display.fontSize, lineHeight: M.display.lineHeight, fontWeight: M.display.fontWeight, letterSpacing: M.display.letterSpacing, mb: 3 }}>
                {data.tagline}
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, lineHeight: M.bodyLg.lineHeight, maxWidth: 520, mb: 4 }}>
                {data.desc}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', '&:hover': { bgcolor: M.navyMid } }}>Book a demo</Button>
                <Button variant="outlined" onClick={() => nav('/platform')} sx={{ borderColor: M.subtle, color: M.ink, fontWeight: 600, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none' }}>Explore the platform</Button>
              </Stack>
              <TrustChecks />
            </Grid>
            <Grid item xs={12} md={6}>
              {isHomecare ? (
                <MockShell header="Today's calls · North area" badge="Live" badgeTone="live">
                  <CallRow time="09:00" name="Margaret W." status="Checked in" tone="live" />
                  <CallRow time="10:30" name="John D." status="En route" tone="link" />
                  <CallRow time="11:00" name="Patricia L." status="At risk" tone="warn" />
                  <CallRow time="13:00" name="Robert H." status="Scheduled" tone="muted" />
                </MockShell>
              ) : (
                <MockShell header="Person record · Riverside" badge="Linked" badgeTone="link">
                  <Box sx={{ mb: 1 }}>
                    <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: M.ink }}>Margaret Wilson</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>Supported living · Riverside</Typography>
                  </Box>
                  <KVRow k="Support plan" v="Goals and preferences · reviewed 3 Oct" chip="Current" chipTone="live" />
                  <KVRow k="Daily notes" v="14 this week" chip="Linked" chipTone="link" />
                  <KVRow k="Medication" v="MAR · 2 exceptions followed up" chip="Linked" chipTone="link" />
                  <KVRow k="Risk assessments" v="Fall risk review due" chip="Review due" chipTone="warn" />
                </MockShell>
              )}
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ═══ WHAT'S INCLUDED ═══ */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.card }}>
        <Container maxWidth="lg">
          <Box sx={{ bgcolor: M.paper, borderRadius: M.r.lg, border: `1px solid ${M.faint}`, p: { xs: 3, md: 5 } }}>
            <Typography sx={{ fontWeight: 600, fontSize: '1.15rem', color: M.ink, mb: 3 }}>
              What's included for {isHomecare ? 'domiciliary care' : 'supported living'}
            </Typography>
            <Grid container spacing={{ xs: 1, md: 4 }}>
              {[
                (isHomecare ? domCareModules : slCareModules).slice(0, 4),
                (isHomecare ? domCareModules : slCareModules).slice(4),
              ].map((col, ci) => (
                <Grid item xs={12} md={6} key={ci}>
                  <Stack spacing={2}>
                    {col.map((item) => (
                      <Stack key={item} direction="row" spacing={1.5} alignItems="flex-start">
                        <Check sx={{ color: M.navy, fontSize: 18, mt: 0.2, flexShrink: 0 }} />
                        <Typography sx={{ fontSize: '0.92rem', color: M.ink, lineHeight: 1.55 }}>{item}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Container>
      </Box>

      {/* ═══ WHY THIS MATTERS ═══ */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.card }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 3, md: 10 }} sx={{ mb: { xs: 5, md: 7 } }}>
            <Grid item xs={12} md={6}>
              <SectionLabel>Why it matters</SectionLabel>
              <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing }}>
                {isHomecare ? 'Domiciliary care has its own operational challenges.' : 'Supported living demands continuous, connected records.'}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'flex-end' }}>
              <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, lineHeight: M.bodyLg.lineHeight }}>
                {isHomecare
                  ? 'Visits happen across multiple locations. Carers travel between clients. Status changes by the minute. The software needs to work the way the service actually operates.'
                  : 'People live in their own homes with ongoing support. Records must reflect the continuity of that support — not just individual shifts or visits.'}
              </Typography>
            </Grid>
          </Grid>

          <Stack spacing={{ xs: 6, md: 8 }}>
            {why.map((item, i) => (
              <Grid container spacing={{ xs: 4, md: 8 }} alignItems="center" key={item.title}>
                <Grid item xs={12} md={6} order={{ xs: 1, md: i % 2 === 0 ? 1 : 2 }}>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: M.navy, letterSpacing: '0.08em', mb: 1.5 }}>
                    {String(i + 1).padStart(2, '0')} —
                  </Typography>
                  <Typography sx={{ fontSize: M.h2.fontSize, fontWeight: M.h2.fontWeight, lineHeight: M.h2.lineHeight, letterSpacing: M.h2.letterSpacing, mb: 2 }}>
                    {item.title}
                  </Typography>
                  <Typography sx={{ color: M.slate, lineHeight: 1.75, fontSize: '1rem', mb: 2 }}>
                    {item.body}
                  </Typography>
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <Check sx={{ color: M.navy, fontSize: 18, mt: 0.2, flexShrink: 0 }} />
                    <Typography sx={{ fontWeight: 500, fontSize: '0.92rem', color: M.ink }}>{item.check}</Typography>
                  </Stack>
                </Grid>
                <Grid item xs={12} md={6} order={{ xs: 2, md: i % 2 === 0 ? 2 : 1 }}>
                  {isHomecare ? <DomWhyCard index={i} /> : <SlWhyCard index={i} />}
                </Grid>
              </Grid>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* ═══ WORKFLOW (dark) ═══ */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.dark }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 3, md: 10 }} sx={{ mb: { xs: 5, md: 7 } }}>
            <Grid item xs={12} md={6}>
              <SectionLabel>Workflow</SectionLabel>
              <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing, color: M.card }}>
                {isHomecare ? 'The working day, connected.' : 'From person to proof.'}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'flex-end' }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.65)', fontSize: M.bodyLg.fontSize, lineHeight: M.bodyLg.lineHeight }}>
                {isHomecare
                  ? 'Every step — from planning the morning calls to reviewing the evening\'s completions — flows through one connected system.'
                  : 'Care is delivered, recorded, reviewed and evidenced in one continuous cycle — not assembled from separate systems.'}
              </Typography>
            </Grid>
          </Grid>
          <Grid container spacing={2.5}>
            {workflow.map((w) => (
              <Grid item xs={12} sm={6} md={3} key={w.step}>
                <Box sx={{ p: 3, borderRadius: M.r.lg, height: '100%', border: '1px solid rgba(255,255,255,0.14)' }}>
                  <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: M.teal, display: 'grid', placeItems: 'center', mb: 2 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: M.ink }}>{w.step}</Typography>
                  </Box>
                  <Typography sx={{ fontWeight: 600, fontSize: '1.05rem', mb: 1, color: M.card }}>{w.title}</Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.88rem', lineHeight: 1.65 }}>{w.desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ═══ CAPABILITIES ═══ */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.card }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 3, md: 10 }} sx={{ mb: { xs: 5, md: 6 } }}>
            <Grid item xs={12} md={6}>
              <SectionLabel>Capabilities</SectionLabel>
              <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing }}>
                What your team can do.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'flex-end' }}>
              <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, lineHeight: M.bodyLg.lineHeight }}>
                Each capability links to the person record and to other modules — so information is never isolated.
              </Typography>
            </Grid>
          </Grid>
          <Grid container spacing={2.5}>
            {modules.map((m, i) => (
              <Grid item xs={12} sm={6} md={3} key={m.title}>
                <Box sx={{ p: 3, bgcolor: M.card, borderRadius: M.r.lg, border: `1px solid ${M.faint}`, height: '100%' }}>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: M.tealDeep, letterSpacing: '0.06em', mb: 1.5 }}>
                    {String(i + 1).padStart(2, '0')}
                  </Typography>
                  <Typography sx={{ fontWeight: 600, fontSize: '1rem', color: M.ink, mb: 1 }}>{m.title}</Typography>
                  <Typography sx={{ color: M.slate, lineHeight: 1.65, fontSize: '0.87rem' }}>{m.desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ═══ COMPLIANCE ═══ */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={5}>
              <SectionLabel>Regulatory coverage</SectionLabel>
              <Typography sx={{ fontSize: M.h2.fontSize, fontWeight: M.h2.fontWeight, letterSpacing: M.h2.letterSpacing, mb: 2 }}>
                Built for regulated care across the UK.
              </Typography>
              <Typography sx={{ color: M.slate, lineHeight: 1.75, mb: 3 }}>
                {isHomecare
                  ? 'Domiciliary care is inspected by CQC in England, the Care Inspectorate in Scotland, CIW in Wales and RQIA in Northern Ireland. MeticleCare supports the evidence and governance work your service needs — without claiming to guarantee any regulatory outcome.'
                  : 'Supported living services operate under the same four UK regulatory frameworks. The platform helps your team maintain the continuous, evidence-rich record that inspection-ready services require.'}
              </Typography>
              <Button
                endIcon={<ArrowForward />}
                onClick={() => nav('/compliance')}
                sx={{ color: M.navy, fontWeight: 600, px: 0, textTransform: 'none', fontSize: '0.95rem', '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' } }}
              >
                Explore compliance
              </Button>
            </Grid>
            <Grid item xs={12} md={7}>
              <Stack spacing={0} sx={{ borderTop: `1px solid ${M.faint}` }}>
                {[
                  { code: 'CQC', nation: 'England', path: '/compliance/cqc' },
                  { code: 'Care Inspectorate', nation: 'Scotland', path: '/compliance/care-inspectorate' },
                  { code: 'CIW', nation: 'Wales', path: '/compliance/ciw' },
                  { code: 'RQIA', nation: 'Northern Ireland', path: '/compliance/rqia' },
                ].map((r) => (
                  <Box
                    key={r.code}
                    component="button"
                    type="button"
                    onClick={() => nav(r.path)}
                    sx={{
                      border: 0, borderBottom: `1px solid ${M.faint}`, width: '100%', textAlign: 'left',
                      bgcolor: 'transparent', color: 'inherit', cursor: 'pointer',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      py: 2.5, px: 1,
                      '&:hover': { bgcolor: M.card },
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontSize: '0.72rem', fontWeight: 500, color: M.slate }}>{r.nation}</Typography>
                      <Typography sx={{ fontWeight: 600, fontSize: '1.05rem', color: M.ink }}>{r.code}</Typography>
                    </Box>
                    <ArrowForward sx={{ color: M.navy, fontSize: 20 }} />
                  </Box>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ═══ CTA ═══ */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.card }}>
        <Container maxWidth="lg">
          <Box sx={{ bgcolor: M.paper, borderRadius: M.r.xl, border: `1px solid ${M.faint}`, px: { xs: 3, md: 6 }, py: { xs: 6, md: 8 }, textAlign: 'center' }}>
            <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing, color: M.ink, mb: 2 }}>
              {isHomecare ? 'Ready to see how domiciliary care operations should work?' : 'Ready to connect your supported living service?'}
            </Typography>
            <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, mb: 4, maxWidth: 520, mx: 'auto' }}>
              Talk to the team about how MeticleCare works for {isHomecare ? 'domiciliary' : 'supported living'} providers.
            </Typography>
            <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', '&:hover': { bgcolor: M.navyMid } }}>Book a demo</Button>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1, sm: 3 }} justifyContent="center" sx={{ mt: 3 }}>
              {[
                { icon: AccessTime, label: '30-minute scoping call' },
                { icon: Check, label: '14-day free trial' },
                { icon: Person, label: 'Named point of contact' },
              ].map((t) => (
                <Stack key={t.label} direction="row" spacing={1} alignItems="center" justifyContent="center">
                  <t.icon sx={{ color: M.navy, fontSize: 16 }} />
                  <Typography sx={{ color: M.slate, fontSize: '0.82rem', fontWeight: 500 }}>{t.label}</Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        </Container>
      </Box>
    </MarketingLayout>
  )
}

function DomWhyCard({ index }: { index: number }) {
  if (index === 0) {
    return (
      <MockShell header="Coverage by area" badge="Today" badgeTone="muted">
        <KVRow k="North" v="14 calls · 4 carers" chip="All covered" chipTone="live" />
        <KVRow k="South" v="11 calls · 3 carers" chip="1 at risk" chipTone="warn" />
        <KVRow k="East" v="9 calls · 2 carers" chip="All covered" chipTone="live" />
        <KVRow k="West" v="12 calls · 3 carers" chip="2 at risk" chipTone="warn" />
      </MockShell>
    )
  }
  if (index === 1) {
    return (
      <MockShell header="Missed call · 11:00" badge="Escalated" badgeTone="warn">
        <Box sx={{ mb: 1 }}>
          <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: M.ink }}>Patricia L.</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>Medication visit · South area</Typography>
        </Box>
        <KVRow k="Reason" v="Carer delayed · traffic" />
        <KVRow k="Escalated to" v="Coordinator · 11:20" />
        <KVRow k="Family informed" v="Phone call · 11:32" chip="Done" chipTone="live" />
        <KVRow k="Incident raised" v="Not required" chip="Reviewed" chipTone="muted" />
      </MockShell>
    )
  }
  return (
    <MockShell header="Next visit · 09:00" badge="Mobile" badgeTone="link">
      <Box sx={{ mb: 1 }}>
        <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: M.ink }}>Margaret W.</Typography>
        <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>12 Elm Court · personal care</Typography>
      </Box>
      <KVRow k="Tasks" v="Personal care, breakfast" />
      <KVRow k="Metformin 500mg" v="Dosage and timing" chip="Reference" chipTone="link" />
      <KVRow k="Fall risk · high" v="From risk assessment" chip="Alert" chipTone="warn" />
      <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
        <Button variant="contained" size="small" sx={{ bgcolor: M.navy, textTransform: 'none', fontWeight: 600, borderRadius: M.r.sm, boxShadow: 'none', '&:hover': { bgcolor: M.navyMid, boxShadow: 'none' } }}>Check in</Button>
        <Button variant="outlined" size="small" sx={{ borderColor: M.subtle, color: M.ink, textTransform: 'none', fontWeight: 600, borderRadius: M.r.sm }}>Report disruption</Button>
      </Stack>
    </MockShell>
  )
}

function SlWhyCard({ index }: { index: number }) {
  if (index === 0) {
    return (
      <MockShell header="Evidence for inspection" badge="Riverside" badgeTone="muted">
        <KVRow k="Care plan reviews" v="All people · last 90 days" chip="Current" chipTone="live" />
        <KVRow k="Training" v="2 renewals due" chip="Due soon" chipTone="warn" />
        <KVRow k="Incidents" v="All followed up" chip="Closed" chipTone="link" />
        <KVRow k="Audit log" v="Changes and AI actions" chip="Complete" chipTone="live" />
      </MockShell>
    )
  }
  if (index === 1) {
    return (
      <MockShell header="Medication · this week" badge="eMAR" badgeTone="link">
        <KVRow k="Omeprazole 20mg" v="Refused · GP informed" chip="Followed up" chipTone="live" />
        <KVRow k="Paracetamol (PRN)" v="Given 14:10 · reason recorded" chip="Recorded" chipTone="link" />
        <KVRow k="Metformin stock" v="6 days remaining" chip="Reorder" chipTone="warn" />
        <KVRow k="Controlled drugs" v="Balance checked by 2 staff" chip="Verified" chipTone="live" />
      </MockShell>
    )
  }
  return (
    <MockShell header="Margaret Wilson" badge="Timeline" badgeTone="muted">
      <KVRow k="Daily note" v="Walked to the garden with support" chip="Today" chipTone="link" />
      <KVRow k="Health observation" v="Recorded at visit" chip="Yesterday" chipTone="muted" />
      <KVRow k="Support plan" v="Goals reviewed with key worker" chip="Current" chipTone="live" />
    </MockShell>
  )
}

/* ─── Hero feature lists ──────────────────────────────────── */

const domCareModules = [
  'Visit scheduling with real-time call status and conflict detection',
  'Mobile check-in with GPS verification, care notes and disruption reporting',
  'Drag-and-drop carer assignment with proximity and workload balancing',
  'Area-based coverage view with carer-to-client ratios',
  'Missed call escalation with follow-up tracking',
  'Timesheet and payroll export from approved visit records',
  'Shift marketplace for open-call pickup',
  'End-of-day completion summaries for managers',
]

const slCareModules = [
  'Person-centred support plans with goals, preferences and reviews',
  'Medication management with MAR, stock control and exception tracking',
  'Body mapping and health observations linked to care plans',
  'Risk assessments, incident recording and safeguarding workflows',
  'Rota, staff training, competency and availability management',
  'Compliance evidence, audit logs and inspection-readiness dashboards',
  'Family Portal with service-controlled access and communication',
  'AI care summaries, record change summaries and compliance copilot',
]
