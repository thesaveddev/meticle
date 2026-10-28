import { Box, Button, Container, Grid, Stack, Typography } from '@mui/material'
import {
  ArrowForward, Check, AccessTime, Groups, ChevronRight,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { M } from '../../styles/marketing-tokens'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'

/* ─── Colours pinned from Figma frame 1.3 (node 73:5797) ──────────────
 * Module tags + links + step 01:      #0164C8 (blue)
 * Section label (Connected arch):     #03C6B1 (teal)
 * Index numbers / step 02–04:         #51637A (slate)
 * Titles / step titles / values:      #0C1B2E (navy)
 * Capability text:                    M.bodyText (ink)
 * Hairlines:                          M.hair · top rules: M.rule
 * Muted arrows:                       M.arrowMuted
 * Reassurance icons:                  #004E45 (teal-deep)
 * Data-flow chips (on the blue band): bg rgba(12,27,46,.28), text white
 * Chips: MAR/England blue M.heroTint·#0164C8 · Given teal #D2FBF4·#004E45
 *   Due amber M.amberBand·M.amberText · Pending grey #F4F9FC·#51637A
 *   Unassigned red #FEF0F0·#B42318 · Scheduled grey · 3 active amber
 */

/* ─── Shared bits ─────────────────────────────────────────────────── */

function Eyebrow({ children, color = M.navy }: { children: React.ReactNode; color?: string }) {
  return (
    <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.06em', color, mb: 1.5 }}>
      {children}
    </Typography>
  )
}

function CtaButtons({ secondary, secondaryTo }: { secondary: string; secondaryTo: string }) {
  const nav = useNavigate()
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2.5 }}>
      <Button
        variant="contained"
        endIcon={<ArrowForward />}
        onClick={() => nav('/contact')}
        sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 4, py: 1.75, borderRadius: '14px', textTransform: 'none', fontSize: '0.95rem', boxShadow: '0 10px 24px rgba(1,99,199,0.28), 0 2px 4px rgba(1,99,199,0.20)', '&:hover': { bgcolor: M.navyHover } }}
      >
        Book a demo
      </Button>
      <Button
        variant="outlined"
        onClick={() => nav(secondaryTo)}
        sx={{ borderColor: M.rule, color: M.dark, fontWeight: 600, px: 3, py: 1.6, borderRadius: '14px', textTransform: 'none', fontSize: '0.95rem', bgcolor: '#FFFFFF', '&:hover': { borderColor: M.navy } }}
      >
        {secondary}
      </Button>
    </Stack>
  )
}

function Reassurance({ items }: { items: { icon: React.ReactNode; text: string }[] }) {
  return (
    <Stack direction="row" spacing={2.5} flexWrap="wrap" useFlexGap>
      {items.map((r) => (
        <Stack key={r.text} direction="row" alignItems="center" spacing={0.75}>
          {r.icon}
          <Typography sx={{ fontSize: '0.8rem', color: M.slate }}>{r.text}</Typography>
        </Stack>
      ))}
    </Stack>
  )
}

const reassuranceIcons = { clock: <AccessTime sx={{ fontSize: 16, color: M.navy }} />, check: <Check sx={{ fontSize: 16, color: M.navy }} /> }

/** White UI card used for every module visual (radius 14, hairline, soft shadow). */
function UiCard({ header, children, bodyless = false }: { header: React.ReactNode; children: React.ReactNode; bodyless?: boolean }) {
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '14px', border: `1px solid ${M.faint}`, boxShadow: '0 8px 24px rgba(12,27,46,0.06), 0 1px 2px rgba(12,27,46,0.04)', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 2, borderBottom: `1px solid ${M.faint}` }}>
        {header}
      </Box>
      <Box sx={bodyless ? undefined : { px: 2.5, py: 2.5 }}>{children}</Box>
    </Box>
  )
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: M.dark }}>{children}</Typography>
}

function CardMeta({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>{children}</Typography>
}

function Chip({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <Box component="span" sx={{ display: 'inline-block', px: 1, py: '3px', borderRadius: '6px', bgcolor: bg, color, fontSize: '0.68rem', fontWeight: 600, lineHeight: 1.4, whiteSpace: 'nowrap' }}>
      {label}
    </Box>
  )
}

/* ─── Module UI cards (sample data verbatim from the Figma frames) ─── */

function CoverageCard() {
  const stats = [
    { label: 'Completed', value: '12', dot: '#03C6B1' },
    { label: 'In progress', value: '3', dot: '#0164C8' },
    { label: 'Upcoming', value: '5', dot: M.rule },
    { label: 'Missed', value: '1', dot: '#B42318' },
  ]
  return (
    <UiCard header={<><CardTitle>Today&apos;s coverage</CardTitle><CardMeta>Tue 14 Oct</CardMeta></>}>
      <Stack direction="row" alignItems="baseline" spacing={1.5} sx={{ px: 2.5, pt: 2.5 }}>
        <Typography sx={{ fontSize: '1.9rem', fontWeight: 600, color: M.dark, lineHeight: 1 }}>92%</Typography>
        <Typography sx={{ fontSize: '0.8rem', color: M.slate }}>of visits on track</Typography>
      </Stack>
      <Box sx={{ display: 'flex', height: 8, borderRadius: 1, overflow: 'hidden', mx: 2.5, mt: 1.5, mb: 2.5 }}>
        <Box sx={{ flex: 263, bgcolor: '#03C6B1' }} />
        <Box sx={{ flex: 66, bgcolor: '#0164C8' }} />
        <Box sx={{ flex: 110, bgcolor: M.rule }} />
        <Box sx={{ flex: 22, bgcolor: '#B42318' }} />
      </Box>
      <Grid container sx={{ px: 2.5, pb: 2.5 }}>
        {stats.map((s, i) => (
          <Grid item xs={3} key={s.label} sx={i > 0 ? { borderLeft: `1px solid ${M.faint}`, pl: 2 } : undefined}>
            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.dot, flexShrink: 0 }} />
              <Typography sx={{ fontSize: '0.68rem', color: M.slate }}>{s.label}</Typography>
            </Stack>
            <Typography sx={{ fontSize: '1.15rem', fontWeight: 600, color: M.dark }}>{s.value}</Typography>
          </Grid>
        ))}
      </Grid>
    </UiCard>
  )
}

function MedicationCard() {
  const rows = [
    { name: 'Metformin', dose: '500mg', time: '08:00', chip: <Chip label="Given" bg="#D2FBF4" color="#004E45" /> },
    { name: 'Amlodipine', dose: '5mg', time: '08:00', chip: <Chip label="Given" bg="#D2FBF4" color="#004E45" /> },
    { name: 'Omeprazole', dose: '20mg', time: '12:00', chip: <Chip label="Due" bg={M.amberBand} color={M.amberText} /> },
    { name: 'Paracetamol', dose: '500mg', time: '14:00', chip: <Chip label="Pending" bg="#F4F9FC" color="#51637A" /> },
  ]
  return (
    <UiCard
      header={<><CardTitle>Medication record</CardTitle><Chip label="MAR" bg={M.heroTint} color="#0164C8" /></>}
      bodyless
    >
      {rows.map((r) => (
        <Stack key={r.name} direction="row" alignItems="center" spacing={1.5} sx={{ px: 2.5, py: 1.75, borderBottom: `1px solid ${M.faint}`, '&:last-child': { borderBottom: 'none' } }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: M.dark }}>{r.name}</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: M.slate }}>{r.dose}</Typography>
          </Box>
          <Typography sx={{ fontSize: '0.78rem', color: M.slate }}>{r.time}</Typography>
          {r.chip}
        </Stack>
      ))}
    </UiCard>
  )
}

function StaffCard() {
  const rows = [
    { name: 'Sarah M.', initials: 'SM', role: 'Senior Carer', pct: 98, color: '#03C6B1' },
    { name: 'James K.', initials: 'JK', role: 'Care Worker', pct: 85, color: '#0164C8' },
    { name: 'Priya S.', initials: 'PS', role: 'Care Worker', pct: 72, color: M.amberText },
  ]
  return (
    <UiCard header={<><CardTitle>Staff compliance</CardTitle><CardMeta>3 of 42 shown</CardMeta></>} bodyless>
      {rows.map((r) => (
        <Stack key={r.name} direction="row" alignItems="center" spacing={1.5} sx={{ px: 2.5, py: 1.75, borderBottom: `1px solid ${M.faint}`, '&:last-child': { borderBottom: 'none' } }}>
          <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: M.inset, color: M.slate, fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {r.initials}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: M.dark }}>{r.name}</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: M.slate }}>{r.role}</Typography>
          </Box>
          <Box sx={{ width: 120 }}>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: M.dark, textAlign: 'right', mb: 0.5 }}>{r.pct}%</Typography>
            <Box sx={{ height: 6, borderRadius: 1, bgcolor: 'notice.muted.bg', overflow: 'hidden' }}>
              <Box sx={{ width: `${(r.pct / 100) * 120}px`, maxWidth: '100%', height: '100%', borderRadius: 1, bgcolor: r.color }} />
            </Box>
          </Box>
        </Stack>
      ))}
    </UiCard>
  )
}

function ScheduleCard() {
  const rows = [
    { time: '09:00', client: 'Margaret W.', carer: 'Sarah M.', chip: <Chip label="Completed" bg="#D2FBF4" color="#004E45" /> },
    { time: '10:30', client: 'John D.', carer: 'James K.', chip: <Chip label="En route" bg={M.heroTint} color="#0164C8" /> },
    { time: '11:00', client: 'Patricia L.', carer: null, chip: <Chip label="Unassigned" bg="#FEF0F0" color="#B42318" /> },
    { time: '13:00', client: 'Robert H.', carer: 'Priya S.', chip: <Chip label="Scheduled" bg="#F4F9FC" color="#51637A" /> },
  ]
  return (
    <UiCard header={<><CardTitle>Call schedule</CardTitle><Chip label="1 unassigned" bg="#FEF0F0" color="#B42318" /></>} bodyless>
      {rows.map((r) => (
        <Stack key={r.time} direction="row" alignItems="center" spacing={1.5} sx={{ px: 2.5, py: 1.75, borderBottom: `1px solid ${M.faint}`, '&:last-child': { borderBottom: 'none' } }}>
          <Typography sx={{ fontSize: '0.78rem', color: M.slate, minWidth: 44 }}>{r.time}</Typography>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: M.dark }}>{r.client}</Typography>
            {r.carer ? (
              <Typography sx={{ fontSize: '0.72rem', color: M.slate }}>{r.carer}</Typography>
            ) : (
              <Typography sx={{ fontSize: '0.72rem', color: '#B42318' }}>No carer assigned</Typography>
            )}
          </Box>
          {r.chip}
        </Stack>
      ))}
    </UiCard>
  )
}

function RiskCard() {
  const rows = [
    { title: 'Fall risk assessment overdue', sub: 'High severity · Open', bar: M.amberText },
    { title: 'Medication error reported', sub: 'Critical severity · Investigating', bar: '#B42318' },
    { title: 'Safeguarding concern logged', sub: 'High severity · Escalated', bar: M.amberText },
  ]
  return (
    <UiCard header={<><CardTitle>Open incidents</CardTitle><Chip label="3 active" bg={M.amberBand} color={M.amberText} /></>} bodyless>
      {rows.map((r) => (
        <Stack key={r.title} direction="row" alignItems="center" spacing={1.5} sx={{ px: 2.5, py: 1.75, borderBottom: `1px solid ${M.faint}`, '&:last-child': { borderBottom: 'none' } }}>
          <Box sx={{ width: 3, height: 36, borderRadius: 1, bgcolor: r.bar, flexShrink: 0 }} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: M.dark }}>{r.title}</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: M.slate }}>{r.sub}</Typography>
          </Box>
          <ChevronRight sx={{ fontSize: 16, color: M.arrowMuted }} />
        </Stack>
      ))}
    </UiCard>
  )
}

function ComplianceCard() {
  const rows = [
    { label: 'DBS tracking', pct: 100, color: '#004E45' },
    { label: 'Mandatory training', pct: 87, color: '#0164C8' },
    { label: 'Right to work', pct: 95, color: '#004E45' },
    { label: 'Competency assessments', pct: 68, color: M.amberText },
  ]
  return (
    <UiCard header={<><CardTitle>Compliance dashboard</CardTitle><Chip label="England · CQC" bg={M.heroTint} color="#0164C8" /></>}>
      {rows.map((r) => (
        <Box key={r.label} sx={{ mb: 2, '&:last-child': { mb: 0 } }}>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
            <Typography sx={{ fontSize: '0.78rem', color: M.dark }}>{r.label}</Typography>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: r.color }}>{r.pct}%</Typography>
          </Stack>
          <Box sx={{ height: 6, borderRadius: 1, bgcolor: 'notice.muted.bg', overflow: 'hidden' }}>
            <Box sx={{ width: `${r.pct}%`, height: '100%', borderRadius: 1, bgcolor: r.color }} />
          </Box>
        </Box>
      ))}
    </UiCard>
  )
}

function ReportingCard() {
  const cols = [
    { label: 'Calls completed', value: '47', delta: '+12%' },
    { label: 'Average response time', value: '23 min', delta: '−8%' },
    { label: 'Client satisfaction', value: '4.6/5', delta: '+0.2' },
  ]
  return (
    <UiCard header={<><CardTitle>Operational insights</CardTitle><CardMeta>Today</CardMeta></>} bodyless>
      <Grid container sx={{ py: 2.5 }}>
        {cols.map((c, i) => (
          <Grid item xs={4} key={c.label} sx={{ px: 2.5, ...(i > 0 ? { borderLeft: `1px solid ${M.faint}` } : {}) }}>
            <Typography sx={{ fontSize: '0.72rem', color: M.slate, mb: 1 }}>{c.label}</Typography>
            <Stack direction="row" alignItems="baseline" spacing={0.75}>
              <Typography sx={{ fontSize: '1.4rem', fontWeight: 600, color: M.dark }}>{c.value}</Typography>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#004E45' }}>{c.delta}</Typography>
            </Stack>
          </Grid>
        ))}
      </Grid>
    </UiCard>
  )
}

function FamilyCard() {
  return (
    <UiCard
      header={<><CardTitle>Family view</CardTitle><CardMeta>Margaret W.</CardMeta></>}
      bodyless
    >
      <Box sx={{ px: 2.5, py: 2.25, borderBottom: `1px solid ${M.faint}` }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#03C6B1', flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: M.dark }}>Visit completed today</Typography>
        </Stack>
        <Typography sx={{ fontSize: '0.8rem', color: M.bodyText, lineHeight: 1.6 }}>
          Margaret had a good morning. All tasks completed. Mood was positive.
        </Typography>
      </Box>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2.5, py: 2 }}>
        <Box sx={{ px: 1.5, py: 1, borderRadius: 2, bgcolor: 'notice.muted.bg', textAlign: 'center', flexShrink: 0 }}>
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color: M.slate, letterSpacing: '0.04em' }}>WED</Typography>
          <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: M.dark }}>10:00</Typography>
        </Box>
        <Box>
          <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: M.dark }}>Next visit tomorrow</Typography>
          <Typography sx={{ fontSize: '0.72rem', color: M.slate }}>Scheduled for 10:00 AM with Sarah M.</Typography>
        </Box>
      </Stack>
    </UiCard>
  )
}

function AiCard() {
  return (
    <UiCard
      header={<><CardTitle>AI intelligence</CardTitle><Chip label="Assistive · review required" bg="#F4F9FC" color="#51637A" /></>}
      bodyless
    >
      <Box sx={{ px: 2.5, pt: 2.25, pb: 2 }}>
        <Typography sx={{ fontSize: '0.72rem', color: M.slate, mb: 1 }}>Care summary · last 7 days</Typography>
        <Typography sx={{ fontSize: '0.8rem', color: M.dark, lineHeight: 1.6, mb: 1.5 }}>
          Margaret&apos;s care needs have increased over the past week. Consider reviewing her support plan and increasing visit frequency.
        </Typography>
        <Stack direction="row" spacing={1}>
          {['6 care notes', '2 incidents', 'MAR'].map((t) => (
            <Box key={t} component="span" sx={{ px: 1.25, py: 0.5, borderRadius: '6px', bgcolor: M.inset, color: M.slate, fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {t}
            </Box>
          ))}
        </Stack>
      </Box>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2.5, py: 2, bgcolor: M.navy }}>
        <Box sx={{ width: 3, height: 32, borderRadius: 1, bgcolor: M.coral, flexShrink: 0 }} />
        <Box>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#FFFFFF' }}>Risk signal</Typography>
          <Typography sx={{ fontSize: '0.78rem', color: '#FFFFFF' }}>3 missed calls this week — pattern detected</Typography>
        </Box>
      </Stack>
    </UiCard>
  )
}

/* ─── Page data (copy verbatim from Figma 1.3) ─────────────────────── */

const indexCells = [
  { no: '01', title: 'Care Delivery', sub: 'Plans, notes, reviews, body maps', anchor: 'care-delivery' },
  { no: '02', title: 'Medication (eMAR)', sub: 'MAR, stock and exceptions', anchor: 'medication' },
  { no: '03', title: 'Workforce', sub: 'Staff, training, competency', anchor: 'workforce' },
  { no: '04', title: 'Scheduling & Rota', sub: 'Visits, shifts, open calls', anchor: 'scheduling' },
  { no: '05', title: 'Risk & Incidents', sub: 'Assessments and follow-up', anchor: 'risk' },
  { no: '06', title: 'Compliance & Evidence', sub: 'Readiness, every day', anchor: 'compliance' },
  { no: '07', title: 'Reporting & Intelligence', sub: 'Dashboards and insight', anchor: 'reporting' },
  { no: '08', title: 'Family Portal', sub: 'Authorised family access', anchor: 'family-portal' },
  { no: '09', title: 'AI Intelligence', sub: 'Assistive, auditable AI', anchor: 'ai' },
]

const steps = [
  { no: '01', title: 'Record', desc: 'Care notes, medication records, risk assessments and incidents are captured at the point of care — on web or mobile.' },
  { no: '02', title: 'Connect', desc: 'Every record links back to the person, the care plan, the staff member and the visit — creating an auditable chain.' },
  { no: '03', title: 'Review', desc: 'Managers see the operational picture: missed calls, overdue training, open incidents, compliance gaps — in one view.' },
  { no: '04', title: 'Act', desc: 'Assign follow-up actions, approve changes, generate reports and prepare evidence — with full change history.' },
]

interface Module {
  anchor: string
  tag: string
  title: string
  desc: string
  features: string[]
  link: string
  linkLabel: string
  card: React.ReactNode
}

const modules: Module[] = [
  {
    anchor: 'care-delivery', tag: 'Module 01', title: 'Care Delivery',
    desc: 'Keep care plans, daily notes, reviews, body maps, appointments and health observations in one accessible record — always linked to the person.',
    features: ['Person-centred support plans', 'Daily care notes and handover context', 'Body mapping and linked observations', 'Reviews, goals and health checks', 'Mobile access at the point of care'],
    link: '/features/care-management', linkLabel: 'Learn more about care delivery', card: <CoverageCard />,
  },
  {
    anchor: 'medication', tag: 'Module 02', title: 'Medication (eMAR)',
    desc: 'Manage medication workflows where your service provides medication support — with clear permissions, administration records and an audit trail.',
    features: ['31-day medication administration records', 'Stock control and controlled-drug workflows', 'Exception recording and follow-up', 'Role-based access to medication data', 'Mobile reference and recording for field teams'],
    link: '/features/medication', linkLabel: 'Learn more about medication', card: <MedicationCard />,
  },
  {
    anchor: 'workforce', tag: 'Module 03', title: 'Workforce Management',
    desc: 'Connect staff information, training, competency, availability and work allocation into one operational view.',
    features: ['Staff directory and detailed profiles', 'Training and competency tracking', 'Availability, leave and approval workflows', 'Right-to-work and DBS reminders', 'Connected workforce reporting'],
    link: '/features/workforce', linkLabel: 'Learn more about workforce management', card: <StaffCard />,
  },
  {
    anchor: 'scheduling', tag: 'Module 04', title: 'Scheduling & Rota',
    desc: 'Plan visits and shifts using availability, staffing and operational constraints — with human review before anything is published.',
    features: ['Rota and visit planning', 'Availability and leave awareness', 'Open-call marketplace for unfilled shifts', 'Conflict and coverage detection', 'Manager approval before publishing'],
    link: '/features/scheduling', linkLabel: 'Learn more about scheduling & rota', card: <ScheduleCard />,
  },
  {
    anchor: 'risk', tag: 'Module 05', title: 'Risk & Incidents',
    desc: 'Keep risk information visible, record incidents with follow-through and maintain the review history your governance requires.',
    features: ['Risk assessment records and review dates', 'Incident recording with severity context', 'Actions, owners and due dates', 'Escalation and follow-up history', 'Linked care-plan context'],
    link: '/features/risk-management', linkLabel: 'Learn more about risk & incidents', card: <RiskCard />,
  },
  {
    anchor: 'compliance', tag: 'Module 06', title: 'Compliance & Evidence',
    desc: 'Make inspection readiness part of everyday work — not a once-a-year scramble for evidence.',
    features: ['Training and competency matrices', 'Evidence packs and audit logs', 'Compliance dashboards by nation', 'Identity and right-to-work monitoring', 'Policy and procedure management'],
    link: '/compliance', linkLabel: 'Learn more about compliance & evidence', card: <ComplianceCard />,
  },
  {
    anchor: 'reporting', tag: 'Module 07', title: 'Reporting & Intelligence',
    desc: 'Turn the records your team already keeps into operational reports, evidence and AI-assisted insight.',
    features: ['Operational dashboards and drill-downs', 'Care and workforce reporting', 'Homecare call and visit analytics', 'AI-assisted briefings and summaries', 'Exportable evidence workflows'],
    link: '/features/reporting', linkLabel: 'Learn more about reporting & intelligence', card: <ReportingCard />,
  },
  {
    anchor: 'family-portal', tag: 'Module 08', title: 'Family Portal',
    desc: 'Give authorised relatives a respectful, focused view of the information your service chooses to share.',
    features: ['Authorised portal access with secure links', 'Relevant care information and updates', 'Communication and feedback channels', 'Appointment and visit context', 'Access controlled entirely by the service'],
    link: '/features/family-portal', linkLabel: 'Learn more about family portal', card: <FamilyCard />,
  },
  {
    anchor: 'ai', tag: 'Module 09', title: 'AI Intelligence',
    desc: 'AI assistance designed to reduce administration and surface patterns — with human judgement, permissions and auditability at the centre.',
    features: ['AI-assisted care summaries', 'Record change summaries', 'Risk signals with source traceability', 'Compliance copilot and activity review', 'Natural-language data assistant'],
    link: '/features/ai', linkLabel: 'Learn more about ai intelligence', card: <AiCard />,
  },
]

const dataFlows = [
  { record: 'Care note', links: ['Person record', 'Care plan', 'Visit', 'Staff member'] },
  { record: 'Incident', links: ['Care plan', 'Risk assessment', 'Actions', 'Follow-up'] },
  { record: 'Medication', links: ['Person record', 'MAR', 'Exceptions', 'Audit log'] },
  { record: 'Training', links: ['Staff profile', 'Competency', 'Compliance status'] },
  { record: 'Visit', links: ['Schedule', 'Carer', 'Client', 'Area', 'Timesheet'] },
]

/* ─── Page ─────────────────────────────────────────────────────── */

export default function PlatformPage() {
  return (
    <MarketingLayout>
      <PageMeta
        title="The MeticleCare platform"
        description="Care operations, workforce, medication, safety, compliance, families and intelligence — connected in one platform for domiciliary and supported living providers."
        canonicalPath="/platform"
        keywords={['care management software', 'care operations platform', 'domiciliary care software', 'supported living software', 'UK care platform']}
        breadcrumbs={[{ name: 'Home', path: '/' }, { name: 'Platform', path: '/platform' }]}
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'MeticleCare Platform',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web and mobile',
          description: 'Care operations platform for UK domiciliary and supported living providers.',
        }}
      />

      {/* Hero — gradient + decor glows, per Figma frame 1.3 (node 22:79) */}
      <Box sx={{ position: 'relative', overflow: 'clip', background: `linear-gradient(180deg, ${M.heroTint} 0%, ${M.paper} 55%, ${M.card} 100%)` }}>
        <Box aria-hidden sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <Box sx={{ position: 'absolute', width: 560, height: 560, right: '-4%', top: '-12%', borderRadius: '50%', bgcolor: 'rgba(1,100,200,0.12)', filter: 'blur(140px)' }} />
          <Box sx={{ position: 'absolute', width: 420, height: 420, right: '6%', top: '30%', borderRadius: '50%', bgcolor: 'rgba(3,198,177,0.12)', filter: 'blur(140px)' }} />
        </Box>
        <Container maxWidth="lg" sx={{ position: 'relative', pt: { xs: 8, md: 14 }, pb: { xs: 6, md: 8 } }}>
          <Grid container spacing={{ xs: 4, md: 6 }}>
            <Grid item xs={12} md={7}>
              <Box
                sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 1, bgcolor: '#FFFFFF',
                  border: `1px solid ${M.faint}`, borderRadius: '999px', px: 2, py: 0.75, mb: 3,
                }}
              >
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: M.navy }} />
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: M.dark }}>MeticleCare platform</Typography>
              </Box>
              <Typography sx={{ fontSize: M.display.fontSize, lineHeight: M.display.lineHeight, fontWeight: M.display.fontWeight, letterSpacing: M.display.letterSpacing, color: M.dark }}>
                One platform. Every part of care operations.
              </Typography>
            </Grid>
            <Grid item xs={12} md={5}>
              <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, lineHeight: 1.7, mb: 3.5, pt: { md: 5 } }}>
                A shared operational layer for domiciliary and supported living teams. Capabilities are shaped by organisation type and enabled workflows — so every team sees what matters to them.
              </Typography>
              <CtaButtons secondary="See it for domiciliary care" secondaryTo="/solutions/domiciliary-care" />
              <Reassurance
                items={[
                  { icon: reassuranceIcons.clock, text: '30-minute scoping call' },
                  { icon: reassuranceIcons.check, text: '14-day free trial' },
                ]}
              />
            </Grid>
          </Grid>

          {/* Module index: one connected box, hairline dividers, no cell radii */}
          <Box
            sx={{
              mt: { xs: 5, md: 7 }, border: `1px solid ${M.faint}`, borderRadius: '16px',
              overflow: 'hidden', bgcolor: '#FFFFFF',
            }}
          >
            <Grid container>
              {indexCells.map((c, i) => {
                return (
                  <Grid item xs={12} sm={6} md={4} key={c.no}>
                    <Box
                      component="a"
                      href={`#${c.anchor}`}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 2, px: 3, py: '22px',
                        textDecoration: 'none', height: '100%',
                        borderBottom: i < 6 ? `1px solid ${M.faint}` : { xs: `1px solid ${M.faint}`, md: 'none' },
                        borderRight: { md: (i % 3 !== 2) ? `1px solid ${M.faint}` : 'none', xs: 'none' },
                        '&:hover': { bgcolor: M.paper },
                      }}
                    >
                      <Typography sx={{ fontSize: '0.8rem', color: M.slate, minWidth: 20 }}>{c.no}</Typography>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', color: M.dark }}>{c.title}</Typography>
                        <Typography sx={{ fontSize: '0.8rem', color: M.slate }}>{c.sub}</Typography>
                      </Box>
                      <ArrowForward sx={{ fontSize: 16, color: M.arrowMuted }} />
                    </Box>
                  </Grid>
                )
              })}
            </Grid>
          </Box>
        </Container>
      </Box>

      {/* How it works */}
      <Box sx={{ bgcolor: M.paper, py: { xs: 8, md: 13 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={4} sx={{ mb: { xs: 5, md: 7 } }}>
            <Grid item xs={12} md={7}>
              <Eyebrow>How it works</Eyebrow>
              <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing, color: M.dark }}>
                From recording to insight in four steps.
              </Typography>
            </Grid>
            <Grid item xs={12} md={5}>
              <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, lineHeight: 1.7, pt: { md: 4 } }}>
                Information flows from the point of care through to management oversight and compliance evidence.
              </Typography>
            </Grid>
          </Grid>
          <Grid container spacing={{ xs: 3, md: 4 }}>
            {steps.map((s, i) => (
              <Grid item xs={12} sm={6} md={3} key={s.no}>                  <Box sx={{ borderTop: `2px solid ${i === 0 ? M.navy : M.rule}`, pt: 3 }}>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: M.navy, mb: 1 }}>{s.no}</Typography>
                  <Typography sx={{ fontSize: '1.05rem', fontWeight: 600, color: M.dark, mb: 1 }}>{s.title}</Typography>
                  <Typography sx={{ fontSize: '0.88rem', color: M.slate, lineHeight: 1.65 }}>{s.desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Modules */}
      <Box sx={{ bgcolor: '#FFFFFF', py: { xs: 5, md: 5 } }}>
        <Container maxWidth="lg">
          {modules.map((m, i) => (
            <Box
              key={m.anchor}
              id={m.anchor}
              sx={{
                scrollMarginTop: 96, py: { xs: 5, md: 7 },
                borderTop: i > 0 ? `1px solid ${M.faint}` : 'none',
              }}
            >
              <Grid container spacing={{ xs: 4, md: 8 }} alignItems="center" direction={i % 2 === 1 ? 'row-reverse' : 'row'}>
                <Grid item xs={12} md={5}>
                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.06em', color: M.navy, mb: 1.5 }}>{m.tag}</Typography>
                  <Typography sx={{ fontSize: M.h2.fontSize, fontWeight: M.h2.fontWeight, letterSpacing: M.h2.letterSpacing, color: M.dark, mb: 2 }}>
                    {m.title}
                  </Typography>
                  <Typography sx={{ color: M.slate, fontSize: '0.95rem', lineHeight: 1.7, mb: 3 }}>
                    {m.desc}
                  </Typography>
                  <Box sx={{ mb: 3 }}>
                    {m.features.map((f) => (
                      <Stack key={f} direction="row" alignItems="center" spacing={1.5} sx={{ py: '11px', borderBottom: `1px solid ${M.faint}` }}>
                        <Check sx={{ fontSize: 16, color: M.navy, flexShrink: 0 }} />
                        <Typography sx={{ fontSize: '0.9rem', color: M.bodyText }}>{f}</Typography>
                      </Stack>
                    ))}
                  </Box>
                  <Box
                    component="a"
                    href={m.link}
                    sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, color: M.navy, fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                  >
                    {m.linkLabel}
                    <ArrowForward sx={{ fontSize: 16 }} />
                  </Box>
                </Grid>
                <Grid item xs={12} md={7}>
                  <Box sx={{ bgcolor: M.paper, borderRadius: '20px', p: { xs: 3, md: 6 } }}>
                    {m.card}
                  </Box>
                </Grid>
              </Grid>
            </Box>
          ))}
        </Container>
      </Box>

      {/* Connected architecture — solid brand-blue band, per Figma (node 24:295) */}
      <Box sx={{ bgcolor: M.navy, py: { xs: 8, md: 14 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 5, md: 10 }} alignItems="center">
            <Grid item xs={12} md={5}>
              <Eyebrow color={M.teal}>Connected architecture</Eyebrow>
              <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing, color: '#FFFFFF', mb: 2.5 }}>
                Not a collection of modules. One connected system.
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.95rem', lineHeight: 1.7, mb: 2 }}>
                When a care note is written, it links to the person, the care plan, the visit and the staff member. When an incident is recorded, it connects to the care plan, the risk assessment and any follow-up actions.
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.95rem', lineHeight: 1.7 }}>
                Managers never have to cross-reference multiple systems. The information they need is already connected.
              </Typography>
            </Grid>
            <Grid item xs={12} md={7}>
              <Box sx={{ border: '1px solid rgba(255,255,255,0.28)', borderRadius: '16px', overflow: 'hidden', bgcolor: 'rgba(12,27,46,0.20)' }}>
                <Box
                  sx={{
                    display: 'flex', justifyContent: 'space-between', px: 3, py: 1.75,
                    bgcolor: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.16)',
                  }}
                >
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>Record</Typography>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>Automatically linked to</Typography>
                </Box>
                {dataFlows.map((row) => (
                  <Box
                    key={row.record}
                    sx={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3,
                      px: 3, py: 2, borderBottom: '1px solid rgba(255,255,255,0.16)',
                      '&:last-child': { borderBottom: 'none' },
                    }}
                  >
                    <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#FFFFFF', flexShrink: 0 }}>{row.record}</Typography>                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap justifyContent="flex-end">
                      {row.links.map((l) => (
                        <Box key={l} component="span" sx={{ px: 1.25, py: 0.5, borderRadius: '8px', bgcolor: 'rgba(12,27,46,0.28)', color: '#FFFFFF', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {l}
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                ))}
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* CTA — white-split, matches the rest of the marketing site */}
      <Box sx={{ py: { xs: 10, md: 14 }, bgcolor: M.card, borderTop: `1px solid ${M.faint}` }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 4, md: 6 }} alignItems="center">
            <Grid item xs={12} md={7}>
              <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing, color: M.dark, mb: 1.5 }}>
                See how the pieces connect.
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, lineHeight: 1.7 }}>
                The product is built around the person, the service and the working day. We&apos;ll walk you through it with your own workflows in mind.
              </Typography>
            </Grid>
            <Grid item xs={12} md={5}>
              <CtaButtons secondary="Ask us a question" secondaryTo="/contact" />
              <Reassurance
                items={[
                  { icon: reassuranceIcons.clock, text: '30-minute scoping call' },
                  { icon: reassuranceIcons.check, text: '14-day free trial' },
                  { icon: <Groups sx={{ fontSize: 16, color: M.navy }} />, text: 'Named point of contact' },
                ]}
              />
            </Grid>
          </Grid>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
