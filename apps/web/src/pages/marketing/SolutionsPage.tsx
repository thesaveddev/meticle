import { Box, Button, Container, Grid, Stack, Typography, Divider } from '@mui/material'
import {
  ArrowForward, Check, Groups, CalendarMonth, Warning, PhoneIphone,
  People, Shield,
  Medication, FamilyRestroom, AutoAwesome, AssignmentTurnedIn, Map,
  AccessTime,
} from '@mui/icons-material'
import { useNavigate, useParams } from 'react-router-dom'
import { M } from '../../styles/marketing-tokens'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
      <Box sx={{ width: 8, height: 8, borderRadius: M.r.full, bgcolor: M.teal }} />
      <Typography sx={{ color: M.tealDeep, fontSize: M.caption.size, fontWeight: M.caption.weight, letterSpacing: M.caption.tracking, textTransform: 'uppercase' }}>{children}</Typography>
    </Stack>
  )
}

/* ─── Domiciliary Care content ─────────────────────────────── */

const domCare = {
  title: 'Domiciliary Care',
  tagline: 'From the office to the doorstep.',
  desc: 'Plan packages and calls, assign carers, capture visit records, manage travel and exceptions, and keep managers close to what is happening today.',
  accent: M.teal,
}

const domWhy = [
  {
    title: 'You cannot manage domiciliary care on spreadsheets.',
    body: 'When visits span multiple areas, carers travel between clients, and call statuses change by the minute, a spreadsheet breaks down within hours. MeticleCare gives coordinators a live operational picture: who is where, which calls are covered, which are at risk, and what happened during each visit.',
  },
  {
    title: 'Every missed call has a person behind it.',
    body: 'When a scheduled visit does not happen, the system flags it immediately. Managers see the reason, the client affected, and the escalation path. Follow-ups are tracked — not forgotten in an inbox.',
  },
  {
    title: 'Carers need information at the door, not at the office.',
    body: 'The mobile app gives carers care plans, medication references, risk alerts and visit tasks before they arrive. They check in, record what happened, and move to the next call — all without returning to base.',
  },
]

const domModules = [
  { icon: CalendarMonth, title: 'Call scheduling', desc: 'Build the day around client needs, carer availability and geographic areas. Drag calls to carers, detect conflicts and see the full schedule at a glance.' },
  { icon: PhoneIphone, title: 'Mobile check-in and recording', desc: 'Carers check in at the door, record care notes, report disruptions (traffic, client unavailable, unsafe conditions) and check out — creating a timed, geo-tagged record of every visit.' },
  { icon: People, title: 'Carer assignment and workload', desc: 'See each carer\'s calls for the day, their total hours, and gaps between visits. Assign based on area proximity, skills and availability. The drag-and-drop board prevents double-booking and flags tight turnarounds.' },
  { icon: Map, title: 'Area-based coverage', desc: 'Organise your service into geographic areas. See how many carers cover each zone, how many clients are served, and where coverage is thin — before it becomes a problem.' },
  { icon: Warning, title: 'Missed call management', desc: 'Overdue calls escalate automatically. Managers see what happened, who was affected, whether a follow-up communication was made, and whether an incident was raised.' },
  { icon: AssignmentTurnedIn, title: 'Timesheets and payroll', desc: 'Approved visit records, travel time and mileage flow into timesheets. Export for payroll processing. Carers can view their earnings on mobile.' },
  { icon: AccessTime, title: 'Availability and leave', desc: 'Carers submit availability up to 4 months ahead. Managers approve leave, see coverage impact, and use the shift marketplace to fill open calls.' },
  { icon: FamilyRestroom, title: 'Family communication', desc: 'Families receive visit summaries and relevant updates through a secure portal. Communication is controlled by the service — not automated without oversight.' },
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
  accent: '#6366F1',
}

const slWhy = [
  {
    title: 'Inspection readiness is built into daily work, not added afterwards.',
    body: 'When care plans, daily notes, medication records, risk assessments, incidents, training and competency are all connected, the evidence your inspector needs already exists — linked, timestamped and traceable to the source.',
  },
  {
    title: 'Medication errors are one of the most common incident types in care.',
    body: 'MeticleCare\'s eMAR tracks every administration, flags exceptions, and maintains a clear audit trail. Stock control, PRN tracking and controlled-drug workflows are handled within the same system — not in a separate spreadsheet.',
  },
  {
    title: 'The person\'s story should be in one place.',
    body: 'Support plans, daily notes, health observations, body maps, incidents and reviews all connect to the person record. When a new staff member starts, they can understand the individual — not just their last shift.',
  },
]

const slModules = [
  { icon: Groups, title: 'Person-centred care records', desc: 'Support plans, goals, preferences and daily notes are connected to the person. Every interaction — medication, notes, observations — builds the picture over time.' },
  { icon: Medication, title: 'Medication management (eMAR)', desc: '31-day administration records, stock control, PRN tracking, exception recording and controlled-drug workflows. Role-based access ensures only authorised staff administer or view medication data.' },
  { icon: Warning, title: 'Risk and incident management', desc: 'Risk assessments linked to care plans with review dates. Incident recording with severity, involved persons, root cause, actions, follow-up and escalation history.' },
  { icon: People, title: 'Workforce and competency', desc: 'Staff profiles, training matrices, competency assessments, availability, leave and right-to-work monitoring. Non-compliant staff are flagged before they are assigned to shifts.' },
  { icon: CalendarMonth, title: 'Scheduling and rota', desc: 'Shift planning with staff availability, competency matching and manager approval. Connected to timesheets and payroll. The shift marketplace fills hard-to-cover shifts.' },
  { icon: Shield, title: 'Compliance evidence', desc: 'Evidence packs, audit logs, training compliance, identity monitoring and inspection-readiness dashboards. Compliance data is generated by normal operations — not assembled at the last minute.' },
  { icon: FamilyRestroom, title: 'Family portal', desc: 'Authorised relatives access relevant care information, updates and communication — with access controlled entirely by the service. No information is shared without explicit permission.' },
  { icon: AutoAwesome, title: 'AI intelligence', desc: 'Care summaries, change detection across records, risk signals with source traceability, compliance copilot and manager briefings. AI assists; a person remains responsible for every decision.' },
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
      <PageMeta title={`${data.title} software`} description={data.desc} canonicalPath={`/solutions/${slug}`} />

      {/* ═══ HERO ═══ */}
      <Box sx={{ py: { xs: 10, md: 16 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <Eyebrow>{data.title}</Eyebrow>
              <Typography sx={{ fontSize: M.display.size, lineHeight: M.display.height, fontWeight: M.display.weight, letterSpacing: M.display.tracking, mb: 3 }}>
                {data.tagline}
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: M.bodyLg.size, lineHeight: M.bodyLg.height, maxWidth: 520, mb: 4 }}>
                {data.desc}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: data.accent, color: data.accent === M.teal ? M.navy : '#fff', fontWeight: 700, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', '&:hover': { bgcolor: data.accent, opacity: 0.9 } }}>Book a demo</Button>
                <Button variant="outlined" onClick={() => nav('/platform')} sx={{ borderColor: M.subtle, color: M.ink, fontWeight: 700, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none' }}>See the platform</Button>
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Stack spacing={1.5}>
                {(isHomecare ? domCareModules : slCareModules).map((item) => (
                  <Stack key={item} direction="row" spacing={2} alignItems="flex-start" sx={{ p: 2, borderRadius: M.r.md, border: `1px solid ${M.faint}`, bgcolor: M.card }}>
                    <Check sx={{ color: data.accent, fontSize: 18, mt: 0.25 }} />
                    <Typography sx={{ fontWeight: 500, fontSize: '0.92rem', lineHeight: 1.5 }}>{item}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ═══ WHY THIS MATTERS ═══ */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.card }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Eyebrow>Why it matters</Eyebrow>
            <Typography sx={{ fontSize: M.h1.size, lineHeight: M.h1.height, fontWeight: M.h1.weight, letterSpacing: M.h1.tracking, mb: 2 }}>
              {isHomecare ? 'Domiciliary care has its own operational challenges.' : 'Supported living demands continuous, connected records.'}
            </Typography>
            <Typography sx={{ color: M.slate, fontSize: M.bodyLg.size, maxWidth: 580, mx: 'auto' }}>
              {isHomecare
                ? 'Visits happen across multiple locations. Carers travel between clients. Status changes by the minute. The software needs to work the way the service actually operates.'
                : 'People live in their own homes with ongoing support. Records must reflect the continuity of that support — not just individual shifts or visits.'}
            </Typography>
          </Box>

          <Stack spacing={6}>
            {why.map((item, i) => (
              <Grid container spacing={{ xs: 4, md: 8 }} alignItems="center" key={i}>
                <Grid item xs={12} md={i % 2 === 0 ? 5 : 7} order={{ xs: 1, md: i % 2 === 0 ? 1 : 2 }}>
                  <Typography sx={{ fontSize: M.h2.size, fontWeight: M.h2.weight, lineHeight: M.h2.height, letterSpacing: M.h2.tracking, mb: 2 }}>
                    {item.title}
                  </Typography>
                  <Typography sx={{ color: M.slate, lineHeight: 1.75, fontSize: '1rem' }}>
                    {item.body}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={i % 2 === 0 ? 7 : 5} order={{ xs: 2, md: i % 2 === 0 ? 2 : 1 }}>
                  <Box sx={{ p: 4, bgcolor: M.paper, borderRadius: M.r.xl, border: `1px solid ${M.faint}` }}>
                    <Typography sx={{ fontSize: '3rem', fontWeight: 800, color: data.accent, opacity: 0.15, mb: 1 }}>{String(i + 1).padStart(2, '0')}</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', mb: 1 }}>{item.title}</Typography>
                    <Divider sx={{ my: 1.5 }} />
                    <Typography sx={{ color: M.slate, fontSize: '0.9rem', lineHeight: 1.65 }}>
                      {isHomecare
                        ? ['Real-time visibility replaces end-of-day guesswork', 'Every visit creates an auditable record', 'Carers carry the information they need, not just a schedule', 'Managers see the full picture — not just what was reported verbally'][i]
                        : ['Evidence is generated by doing the work, not writing reports', 'Medication governance is built into daily workflows', 'Every record connects to the person and their care plan', 'Compliance is continuous, not seasonal'][i]}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* ═══ HOW IT WORKS ═══ */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Eyebrow>Workflow</Eyebrow>
            <Typography sx={{ fontSize: M.h1.size, lineHeight: M.h1.height, fontWeight: M.h1.weight, letterSpacing: M.h1.tracking, mb: 2 }}>
              {isHomecare ? 'The working day, connected.' : 'From person to proof.'}
            </Typography>
            <Typography sx={{ color: M.slate, fontSize: M.bodyLg.size, maxWidth: 560, mx: 'auto' }}>
              {isHomecare
                ? 'Every step — from planning the morning calls to reviewing the evening\'s completions — flows through one connected system.'
                : 'Care is delivered, recorded, reviewed and evidenced in one continuous cycle — not assembled from separate systems.'}
            </Typography>
          </Box>
          <Grid container spacing={3}>
            {workflow.map((w) => (
              <Grid item xs={12} sm={6} md={3} key={w.step}>
                <Box sx={{ p: 3, bgcolor: M.card, borderRadius: M.r.lg, height: '100%', border: `1px solid ${M.faint}`, borderTop: `3px solid ${data.accent}` }}>
                  <Typography sx={{ fontSize: '2.5rem', fontWeight: 800, color: data.accent, opacity: 0.3, mb: 1 }}>{w.step}</Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', mb: 1 }}>{w.title}</Typography>
                  <Typography sx={{ color: M.slate, fontSize: '0.9rem', lineHeight: 1.65 }}>{w.desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ═══ CAPABILITIES ═══ */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.card }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Eyebrow>Capabilities</Eyebrow>
            <Typography sx={{ fontSize: M.h1.size, lineHeight: M.h1.height, fontWeight: M.h1.weight, letterSpacing: M.h1.tracking, mb: 2 }}>
              What your team can do.
            </Typography>
            <Typography sx={{ color: M.slate, fontSize: M.bodyLg.size, maxWidth: 580, mx: 'auto' }}>
              Each capability links to the person record and to other modules — so information is never isolated.
            </Typography>
          </Box>
          <Stack spacing={2.5}>
            {modules.map((m, i) => (
              <Box key={m.title} sx={{
                p: { xs: 3, md: 3.5 }, bgcolor: M.card, borderRadius: M.r.lg,
                border: `1px solid ${M.faint}`,
                transition: 'all 0.25s',
                '&:hover': { borderColor: data.accent, boxShadow: M.shadow.md },
              }}>
                <Grid container spacing={{ xs: 3, md: 5 }} alignItems="flex-start">
                  <Grid item xs={12} md={3}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box sx={{ width: 44, height: 44, borderRadius: M.r.md, bgcolor: `${data.accent}12`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <m.icon sx={{ color: data.accent, fontSize: 22 }} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: data.accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Capability {String(i + 1).padStart(2, '0')}</Typography>
                        <Typography sx={{ fontWeight: 700, fontSize: '1.05rem' }}>{m.title}</Typography>
                      </Box>
                    </Stack>
                  </Grid>
                  <Grid item xs={12} md={9}>
                    <Typography sx={{ color: M.slate, lineHeight: 1.65, fontSize: '0.92rem' }}>{m.desc}</Typography>
                  </Grid>
                </Grid>
              </Box>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* ═══ COMPLIANCE ═══ */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={5}>
              <Eyebrow>Regulatory coverage</Eyebrow>
              <Typography sx={{ fontSize: M.h2.size, fontWeight: M.h2.weight, letterSpacing: M.h2.tracking, mb: 2 }}>
                Built for regulated care across the UK.
              </Typography>
              <Typography sx={{ color: M.slate, lineHeight: 1.75, mb: 3 }}>
                {isHomecare
                  ? 'Domiciliary care is inspected by CQC in England, the Care Inspectorate in Scotland, CIW in Wales and RQIA in Northern Ireland. MeticleCare supports the evidence and governance work your service needs — without claiming to guarantee any regulatory outcome.'
                  : 'Supported living services operate under the same four UK regulatory frameworks. The platform helps your team maintain the continuous, evidence-rich record that inspection-ready services require.'}
              </Typography>
              <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/compliance')} sx={{ bgcolor: M.teal, color: M.navy, fontWeight: 700, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', '&:hover': { bgcolor: M.tealDark } }}>Explore compliance</Button>
            </Grid>
            <Grid item xs={12} md={7}>
              <Grid container spacing={2}>
                {[
                  { code: 'CQC', nation: 'England', color: '#2563EB', path: '/compliance/cqc' },
                  { code: 'Care Inspectorate', nation: 'Scotland', color: '#DC2626', path: '/compliance/care-inspectorate' },
                  { code: 'CIW', nation: 'Wales', color: '#059669', path: '/compliance/ciw' },
                  { code: 'RQIA', nation: 'Northern Ireland', color: '#7C3AED', path: '/compliance/rqia' },
                ].map((r) => (
                  <Grid item xs={12} sm={6} key={r.code}>
                    <Box component="a" href={r.path} sx={{
                      display: 'block', textDecoration: 'none', color: 'inherit',
                      p: 2.5, borderRadius: M.r.lg, border: `1px solid ${M.faint}`, borderLeft: `3px solid ${r.color}`,
                      bgcolor: M.card, transition: 'all 0.25s',
                      '&:hover': { borderColor: r.color, boxShadow: M.shadow.md, transform: 'translateY(-2px)' },
                    }}>
                      <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: r.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{r.nation}</Typography>
                      <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', mt: 0.5 }}>{r.code}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ═══ CTA ═══ */}
      <Box sx={{ py: { xs: 10, md: 14 }, background: `linear-gradient(160deg, ${M.navy} 0%, #162032 50%, #1A2744 100%)`, textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography sx={{ fontSize: M.h1.size, lineHeight: M.h1.height, fontWeight: M.h1.weight, letterSpacing: M.h1.tracking, color: M.card, mb: 2 }}>
            {isHomecare ? 'Ready to see how domiciliary care operations should work?' : 'Ready to connect your supported living service?'}
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: M.bodyLg.size, mb: 4, maxWidth: 500, mx: 'auto' }}>
            Talk to the team about how MeticleCare works for {isHomecare ? 'domiciliary' : 'supported living'} providers.
          </Typography>
          <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.teal, color: M.navy, fontWeight: 700, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', '&:hover': { bgcolor: M.tealDark } }}>Book a demo</Button>
        </Container>
      </Box>
    </MarketingLayout>
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
  'AI care summaries, change detection and compliance copilot',
]
