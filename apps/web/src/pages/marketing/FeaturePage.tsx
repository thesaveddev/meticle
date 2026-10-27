import { Box, Button, Container, Grid, Stack, Typography, Chip } from '@mui/material'
import {
  ArrowForward, Check, Groups, Medication, People, CalendarMonth,
  Warning, Insights, FamilyRestroom, Shield,
  CheckCircle, AccessTime, Person,
} from '@mui/icons-material'
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

/* ─── Feature data ──────────────────────────────────── */

type FeatureData = {
  title: string
  intro: string
  audience: string
  color: string
  icon: typeof Shield
  capabilities: string[]
  detailSections: { heading: string; body: string }[]
  mockup: React.ReactNode
}

/* ─── Mockup components ─────────────────────────────── */

/* ─── Figma 3.1 shared bits ───────────────────────────── */

function EyebrowPill({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, bgcolor: '#FFFFFF', border: `1px solid ${M.faint}`, borderRadius: 999, px: 1.5, py: 0.625, boxShadow: M.shadow.sm, mb: 3 }}>
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: M.navy, flexShrink: 0 }} />
      <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: M.dark }}>{children}</Typography>
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

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <Box component="span" sx={{ fontSize: '0.6875rem', fontWeight: 600, bgcolor: bg, color, borderRadius: 999, px: 1.25, py: 0.375, whiteSpace: 'nowrap' }}>
      {label}
    </Box>
  )
}

function Avatar({ initials, bg, color }: { initials: string; bg: string; color: string }) {
  return (
    <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>
      {initials}
    </Box>
  )
}

function StepNo({ n }: { n: string }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
      <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: M.navy }}>{n}</Typography>
      <Box sx={{ width: 40, height: 2, bgcolor: M.navy, borderRadius: 1 }} />
    </Stack>
  )
}

/* Hero card: Care records (Figma 32:44 hero right) */
function CareRecordsCard() {
  const rows = [
    { initials: 'MW', name: 'Margaret Wilson', badge: 'Support plan review', bg: '#EAF3FF', badgeBg: '#EAF3FF', badgeColor: M.navy, avBg: '#DCE9F7', avColor: M.navy },
    { initials: 'JD', name: 'John Davies', badge: 'Daily note', bg: '#EAFBF5', badgeBg: '#EAFBF5', badgeColor: '#087A55', avBg: '#D2F3E3', avColor: '#087A55' },
    { initials: 'PL', name: 'Patricia Lewis', badge: 'Health observation', bg: '#FFF7E6', badgeBg: '#FFF7E6', badgeColor: '#9A6700', avBg: '#FCEFC7', avColor: '#9A6700' },
    { initials: 'RH', name: 'Robert Hughes', badge: 'Body map update', bg: '#F4F9FC', badgeBg: '#EDF1F6', badgeColor: M.slate, avBg: '#E3E9F0', avColor: M.slate },
  ]
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.lg, p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>Care records</Typography>
        <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>Linked to person record</Typography>
      </Stack>
      {rows.map((r, i) => (
        <Stack key={r.initials} direction="row" spacing={1.5} alignItems="center" sx={{ py: 1.75, borderBottom: i < rows.length - 1 ? `1px solid ${M.faint}` : 'none' }}>
          <Avatar initials={r.initials} bg={r.avBg} color={r.avColor} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: M.dark }}>{r.name}</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>Person record · care plan linked</Typography>
          </Box>
          <Badge label={r.badge} bg={r.badgeBg} color={r.badgeColor} />
        </Stack>
      ))}
    </Box>
  )
}

/* Step 01 card: Person record */
function PersonRecordCard() {
  const rows = [
    { title: 'Support plan', sub: 'Reviewed 3 Oct', badge: 'Current', bg: '#EAFBF5', color: '#087A55' },
    { title: 'Daily notes', sub: '14 this week', badge: 'Linked', bg: '#EAF3FF', color: M.navy },
    { title: 'Risk assessments', sub: '2 active', badge: 'Review due', bg: '#FFF7E6', color: '#9A6700' },
    { title: 'Medication', sub: 'MAR linked', badge: 'Linked', bg: '#EAF3FF', color: M.navy },
  ]
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.md, p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>Person record</Typography>
        <Badge label="Linked" bg="#EAFBF5" color="#087A55" />
      </Stack>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 1.5, borderBottom: `1px solid ${M.faint}` }}>
        <Avatar initials="MW" bg="#DCE9F7" color={M.navy} />
        <Box>
          <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: M.dark }}>Margaret Wilson</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>Supported living · Riverside</Typography>
        </Box>
      </Stack>
      {rows.map((r) => (
        <Stack key={r.title} direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ py: 1.5, borderBottom: `1px solid ${M.faint}`, '&:last-child': { borderBottom: 0 } }}>
          <Box>
            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: M.dark }}>{r.title}</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>{r.sub}</Typography>
          </Box>
          <Badge label={r.badge} bg={r.bg} color={r.color} />
        </Stack>
      ))}
    </Box>
  )
}

/* Step 02 card: Daily note */
function DailyNoteCard() {
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.md, p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>Daily note · Margaret W.</Typography>
        <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>Mobile</Typography>
      </Stack>
      <Typography sx={{ fontSize: '0.75rem', color: M.slate, mb: 1.5 }}>Recorded at 08:42 · during visit</Typography>
      <Typography sx={{ fontSize: '0.875rem', color: M.dark, lineHeight: 1.6, mb: 1.5 }}>
        Assisted with breakfast and personal care. Mood positive, walked to the garden with support.
      </Typography>
      <Box sx={{ mb: 1.5 }}><Badge label="At point of care" bg="#D2FBF4" color={M.tealDeep} /></Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1.25, borderTop: `1px solid ${M.faint}` }}>
        <Box>
          <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: M.dark }}>Fall risk — high</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>From risk assessment</Typography>
        </Box>
        <Badge label="Alert" bg="#FFF7E6" color="#9A6700" />
      </Stack>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1.25, borderTop: `1px solid ${M.faint}` }}>
        <Box>
          <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: M.dark }}>Omeprazole 20mg</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>Due 12:00</Typography>
        </Box>
        <Badge label="Reference" bg="#EAF3FF" color={M.navy} />
      </Stack>
    </Box>
  )
}

/* Step 03 card: Observations */
function ObservationsCard() {
  const rows = [
    { title: 'Weight', sub: '64.2 kg', badge: 'Stable', bg: '#EAFBF5', color: '#087A55' },
    { title: 'Blood pressure', sub: '128/82', badge: 'Normal', bg: '#D2FBF4', color: M.tealDeep },
    { title: 'Mobility goal', sub: 'Walk to garden daily', badge: 'On track', bg: '#EAF3FF', color: M.navy },
    { title: 'Body map', sub: 'Left forearm', badge: '1 new mark', bg: '#FFF7E6', color: '#9A6700' },
  ]
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.md, p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>Observations</Typography>
        <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>Last 30 days</Typography>
      </Stack>
      {rows.map((r) => (
        <Stack key={r.title} direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ py: 1.5, borderBottom: `1px solid ${M.faint}`, '&:last-child': { borderBottom: 0 } }}>
          <Box>
            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: M.dark }}>{r.title}</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>{r.sub}</Typography>
          </Box>
          <Badge label={r.badge} bg={r.bg} color={r.color} />
        </Stack>
      ))}
    </Box>
  )
}

function CareDeliveryMockup() {
  return <CareRecordsCard />
}

function ComplianceMockup() {
  const items = [
    { label: 'DBS Tracking', pct: 100, color: '#10B981' },
    { label: 'Mandatory Training', pct: 87, color: '#F59E0B' },
    { label: 'Right to Work', pct: 95, color: '#10B981' },
    { label: 'Competency', pct: 68, color: '#EF4444' },
  ]
  return (
    <Box sx={{ p: 2.5, bgcolor: M.tealSoft, borderRadius: 2, border: '1px solid ' + M.tealMuted }}>
      <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: M.tealDeep, mb: 1.5 }}>Compliance Dashboard</Typography>
      {items.map((item, i) => (
        <Box key={i} sx={{ py: 1, borderBottom: i < items.length - 1 ? '1px solid #EAF3FF' : 'none' }}>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: M.tealDeep }}>{item.label}</Typography>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: item.color }}>{item.pct}%</Typography>
          </Stack>
          <Box sx={{ height: 4, bgcolor: '#EAF3FF', borderRadius: 2, overflow: 'hidden' }}>
            <Box sx={{ width: `${item.pct}%`, height: '100%', bgcolor: item.color, borderRadius: 2 }} />
          </Box>
        </Box>
      ))}
    </Box>
  )
}

const mockupsBySlug: Record<string, React.ReactNode> = {
  'care-management': <CareDeliveryMockup />,
  'medication': <MedicationRecordCard />,
  'workforce': <StaffComplianceCard />,
  'scheduling': <CallScheduleCard />,
  'risk-management': <RiskHeroCard />,
  'incident-management': <RiskHeroCard />,
  'compliance': <ComplianceMockup />,
  'reporting': <InsightsHeroCard />,
  'family-portal': <FamilyHeroCard />,
  'ai': <AIHeroCard />,
}

/* ─── Feature definitions ────────────────────────────── */

const features: Record<string, FeatureData> = {
  'care-management': {
    title: 'Care management that follows the person',
    intro: 'Keep care plans, notes, reviews, observations and appointments in one accessible record — always linked to the person.',
    audience: 'Registered managers, coordinators and care workers',
    color: 'M.navy',
    icon: Groups,
    capabilities: ['Person-centred support plans', 'Daily care notes and handover context', 'Reviews, goals and health observations', 'Body mapping and linked records', 'Mobile access at the point of care'],
    detailSections: [
      { heading: 'Connected care records', body: 'Every care note, review and observation links back to the person and their care plan. When a new staff member starts, they can understand the individual — not just their last shift.' },
      { heading: 'Mobile-first recording', body: 'Carers record care notes at the point of care — not from memory at the end of the day. The mobile app gives access to care plans, risk alerts and medication references before and during visits.' },
      { heading: 'Reviews and health observations', body: 'Track goals, health checks and reviews over time. Body mapping provides a visual record of changes. Everything connects to the person record and creates an auditable trail.' },
    ],
    mockup: mockupsBySlug['care-management'],
  },
  'medication': {
    title: 'Medication records your team can trust',
    intro: 'Use eMAR and medication workflows where your service provides medication support, with clear permissions and an audit trail.',
    audience: 'Managers, medication leads and authorised care workers',
    color: '#F59E0B',
    icon: Medication,
    capabilities: ['31-day medication administration records', 'Administration history and exceptions', 'Stock and controlled-drug workflows', 'Role-based access and audit history', 'Mobile reference and recording for field teams'],
    detailSections: [
      { heading: 'Administration records', body: 'Every medication administration is recorded with the person, the medication, the dose, the time, the carer and any observations. The 31-day MAR provides a clear view of adherence.' },
      { heading: 'Exception handling', body: 'When medication is refused, omitted or an exception occurs, the system captures the reason and links it to the follow-up action. Managers see exceptions alongside the broader care picture.' },
      { heading: 'Role-based access', body: 'Only authorised staff can administer or view medication data. Stock control, PRN tracking and controlled-drug workflows are handled within the same system — not in a separate spreadsheet.' },
    ],
    mockup: mockupsBySlug['medication'],
  },
  'workforce': {
    title: 'Manage the people who deliver care',
    intro: 'Connect staff information, training, competency, availability and work allocation.',
    audience: 'Registered managers, operations leads and HR teams',
    color: 'M.teal',
    icon: People,
    capabilities: ['Staff directory and profiles', 'Training and competency tracking', 'Availability, leave and approvals', 'Right-to-work and DBS reminders', 'Connected workforce reporting'],
    detailSections: [
      { heading: 'Staff profiles and compliance', body: 'Every staff member has a profile with training records, competency assessments, right-to-work documents and DBS records. Non-compliance is flagged before staff are assigned to shifts.' },
      { heading: 'Training and competency', body: 'Track mandatory training, specialist courses and competency assessments. Expiry dates generate alerts. The compliance dashboard shows the organisation-wide position at a glance.' },
      { heading: 'Availability and leave', body: 'Staff submit availability up to 4 months ahead. Managers approve leave, see coverage impact and use the shift marketplace to fill gaps. Everything connects to the rota.' },
    ],
    mockup: mockupsBySlug['workforce'],
  },
  'scheduling': {
    title: 'Build rotas around real constraints',
    intro: 'Plan visits and shifts using the availability, staffing and operational information your team actually works with.',
    audience: 'Care coordinators and registered managers',
    color: '#10B981',
    icon: CalendarMonth,
    capabilities: ['Rota and visit planning', 'Availability and leave awareness', 'Open-call marketplace workflows', 'Conflict and coverage visibility', 'Human review before publishing'],
    detailSections: [
      { heading: 'Intelligent scheduling', body: 'Build the rota around carer availability, contractual hours, skills and geographic areas. The system detects conflicts and flags tight turnarounds before they become problems.' },
      { heading: 'Open-call marketplace', body: 'When shifts cannot be filled through normal assignment, they go to the marketplace. Carers can pick up open calls based on their availability and proximity — managers approve before publishing.' },
      { heading: 'Manager approval', body: 'No rota change is published without manager review. The system presents the proposed changes, highlights conflicts and coverage gaps, and waits for explicit approval.' },
    ],
    mockup: mockupsBySlug['scheduling'],
  },
  'risk-management': {
    title: 'Identify, record, review and act',
    intro: 'Keep risk information visible and connected to the plans and records that make it meaningful.',
    audience: 'Managers, safeguarding leads and care teams',
    color: '#EF4444',
    icon: Warning,
    capabilities: ['Risk assessment records', 'Review dates and ownership', 'Linked care-plan context', 'Escalation and follow-up actions', 'Auditable changes'],
    detailSections: [
      { heading: 'Risk assessments', body: 'Record risk assessments linked to the person and their care plan. Assign owners, set review dates and track the history of changes. Risks are visible alongside care records.' },
      { heading: 'Linked to care plans', body: 'Risk assessments do not exist in isolation. They connect to care plans, daily notes and incidents — giving managers the full picture when reviewing someone\'s care.' },
      { heading: 'Review and follow-up', body: 'Overdue risk reviews are surfaced in compliance dashboards. Actions have owners and due dates. The escalation history shows what was done and when.' },
    ],
    mockup: mockupsBySlug['risk-management'],
  },
  'incident-management': {
    title: 'Incident management with follow-through',
    intro: 'Record what happened, assign the next action and keep the review history visible.',
    audience: 'Managers, safeguarding leads and responsible individuals',
    color: '#EF4444',
    icon: Warning,
    capabilities: ['Incident recording', 'Severity and category context', 'Actions, owners and due dates', 'Review and escalation history', 'Reporting for governance conversations'],
    detailSections: [
      { heading: 'Incident recording', body: 'Record what happened with the person involved, the severity, the category and the immediate actions taken. Incidents link to care plans and risk assessments.' },
      { heading: 'Follow-up actions', body: 'Every incident generates actions with owners and due dates. Managers track completion and review the follow-up history. Nothing falls through the cracks.' },
      { heading: 'Governance reporting', body: 'Incident data feeds into compliance dashboards and operational reports. Trends surface over time — helping teams identify patterns and improve practice.' },
    ],
    mockup: mockupsBySlug['risk-management'],
  },
  'compliance': {
    title: 'Make inspection readiness part of everyday work',
    intro: 'MeticleCare helps providers organise records, evidence and governance across everyday operations. It does not guarantee compliance or an inspection outcome.',
    audience: 'Registered managers, compliance leads and care directors',
    color: 'M.tealDeep',
    icon: Shield,
    capabilities: ['Compliance and evidence views', 'Training and competency visibility', 'Audit logs and review history', 'Reports and evidence packs', 'Support for CQC, Care Inspectorate, CIW and RQIA'],
    detailSections: [
      { heading: 'Continuous evidence', body: 'When care plans, notes, medication, risks, incidents, training and competency are connected, evidence is created continuously — not assembled under pressure before an inspection.' },
      { heading: 'Compliance dashboards', body: 'Managers see overdue reviews, open actions, training gaps and compliance status at any time. The dashboard reflects real data from the organisation\'s records.' },
      { heading: 'Four-nation support', body: 'Requirements differ across England, Scotland, Wales and Northern Ireland. The platform supports evidence and governance work across all four regulatory frameworks.' },
    ],
    mockup: mockupsBySlug['compliance'],
  },
  'reporting': {
    title: 'See what needs attention',
    intro: 'Bring operational activity into reports that help managers decide what to investigate, improve or follow up.',
    audience: 'Managers, owners and operations teams',
    color: '#0187BA',
    icon: Insights,
    capabilities: ['Operational reporting', 'Care and workforce oversight', 'Compliance reporting', 'Homecare call reporting', 'Exportable evidence workflows'],
    detailSections: [
      { heading: 'Operational dashboards', body: 'See call completion rates, missed visits, training compliance and staffing levels across the organisation. Drill down from organisation-wide views to individual carers or people. Figures refresh when you open the view; the call assignment board is the screen that updates by itself as carers check in.' },
      { heading: 'Care and workforce reporting', body: 'Reports connect care data with workforce information. Understand the relationship between staffing, care quality and outcomes.' },
      { heading: 'Evidence workflows', body: 'Export reports and evidence packs for inspections, governance reviews and board meetings. The data is already organised — you just need to present it.' },
    ],
    mockup: mockupsBySlug['reporting'],
  },
  'family-portal': {
    title: 'Keep families connected to care',
    intro: 'Give authorised relatives a respectful, focused view of the information your service chooses to share.',
    audience: 'Families, relatives and care teams',
    color: '#03C6B1',
    icon: FamilyRestroom,
    capabilities: ['Authorised portal access', 'Relevant care information', 'Updates and communication', 'Appointment and visit context', 'Access controlled by the service'],
    detailSections: [
      { heading: 'Authorised access', body: 'Family members access the portal through secure links. The service controls exactly what information is shared — nothing is published without explicit permission.' },
      { heading: 'Care information', body: 'Families see relevant care updates, visit summaries, appointment context and communication from the care team. The information is respectful, accurate and timely.' },
      { heading: 'Feedback and communication', body: 'Families can provide feedback and communicate with the care team through the portal. This creates a two-way channel that supports person-centred care.' },
    ],
    mockup: mockupsBySlug['family-portal'],
  },
  'ai': {
    title: 'MeticleCare Intelligence',
    intro: 'AI assistance designed to reduce administration and surface patterns while keeping human judgement, permissions and auditability at the centre.',
    audience: 'Authorised managers and care professionals',
    color: 'M.tealDeep',
    icon: Insights,
    capabilities: ['AI-assisted care summaries', 'Record change summaries', 'Risk signals with source traceability', 'Compliance copilot and operational activity review', 'Natural-language data assistant'],
    detailSections: [
      { heading: 'Care summaries', body: 'AI analyses authorised information over 7, 14 or 30-day periods and produces summaries linked to source records. Every statement is traceable to the underlying data.' },
      { heading: 'Record change summaries', body: 'Compare two halves of a period you select and see which records fell in each. It is a query with date bounds, not a learned model of what normal looks like for your service — so it will not notice a slow drift that is inside every period you have chosen.' },
      { heading: 'Compliance copilot', body: 'Ask questions about your organisation\'s compliance position. The AI surfaces training gaps, overdue reviews, open actions and evidence that may need attention.' },
      { heading: 'What this does and does not do', body: 'There is no statistical model, no learned baseline and no time-series comparison behind any of these. Records are selected with date and status filters, then summarised in writing by a language model. Every item shown is one that met those filters, and every output is a prompt for a person to review rather than a decision.' },
    ],
    mockup: mockupsBySlug['ai'],
  },
}

/* ─── Figma 3.2 · Medication cards ─────────────────────── */

function MedicationRecordCard() {
  const rows = [
    { time: '08:00', name: 'Metformin', dose: '500mg', badge: 'Given', bg: '#EAFBF5', color: '#087A55' },
    { time: '08:00', name: 'Amlodipine', dose: '5mg', badge: 'Given', bg: '#EAFBF5', color: '#087A55' },
    { time: '12:00', name: 'Omeprazole', dose: '20mg', badge: 'Due', bg: '#FFF7E6', color: '#9A6700' },
    { time: '14:00', name: 'Paracetamol', dose: '500mg', badge: 'Pending', bg: '#EDF1F6', color: M.slate },
  ]
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.lg, p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>Medication record</Typography>
        <Badge label="MAR" bg="#EAF3FF" color={M.navy} />
      </Stack>
      {rows.map((r, i) => (
        <Stack key={`${r.name}-${i}`} direction="row" spacing={1.5} alignItems="center" sx={{ py: 1.75, borderBottom: i < rows.length - 1 ? `1px solid ${M.faint}` : 'none' }}>
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: M.dark, minWidth: 44 }}>{r.time}</Typography>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: M.dark }}>{r.name} <Typography component="span" sx={{ fontWeight: 400, color: M.slate, fontSize: '0.8125rem' }}>{r.dose}</Typography></Typography>
          </Box>
          <Badge label={r.badge} bg={r.bg} color={r.color} />
        </Stack>
      ))}
    </Box>
  )
}

function MarChartCard() {
  const days = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
  const rows: { name: string; time: string; cells: ('given' | 'missed')[] }[] = [
    { name: 'Metformin', time: '08:00', cells: ['given', 'given', 'given', 'given', 'given', 'given', 'given', 'given', 'given', 'given'] },
    { name: 'Amlodipine', time: '08:00', cells: ['given', 'given', 'given', 'given', 'given', 'given', 'given', 'given', 'given', 'given'] },
    { name: 'Omeprazole', time: '12:00', cells: ['given', 'given', 'missed', 'given', 'given', 'given', 'given', 'given', 'missed', 'given'] },
  ]
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.md, p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 2 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>MAR · Margaret W.</Typography>
        <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>Oct 1–10</Typography>
      </Stack>
      <Box sx={{ overflowX: 'auto' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1.4fr) repeat(10, 1fr)', alignItems: 'center', rowGap: 1.25, minWidth: 420 }}>
          <Box />
          {days.map((d) => (
            <Typography key={d} sx={{ fontSize: '0.75rem', fontWeight: 600, color: M.slate, textAlign: 'center' }}>{d}</Typography>
          ))}
          {rows.map((r) => [
            <Box key={`${r.name}-label`}>
              <Typography sx={{ fontWeight: 600, fontSize: '0.8125rem', color: M.dark }}>{r.name}</Typography>
              <Typography sx={{ fontSize: '0.6875rem', color: M.slate }}>{r.time}</Typography>
            </Box>,
            ...r.cells.map((c, i) => (
              <Box key={`${r.name}-${i}`} sx={{ display: 'flex', justifyContent: 'center' }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: c === 'given' ? '#10B981' : '#EF4444' }} />
              </Box>
            )),
          ])}
        </Box>
      </Box>
      <Typography sx={{ fontSize: '0.8125rem', color: M.slate, mt: 2 }}>
        <Typography component="span" sx={{ color: M.navy, fontWeight: 600 }}>• 2 exceptions this period · all followed up</Typography>
      </Typography>
    </Box>
  )
}

function ExceptionCard() {
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.md, p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>Exception · Omeprazole 20mg</Typography>
        <Badge label="Refused" bg="#FEF0F0" color="#B42318" />
      </Stack>
      <Stack spacing={1.75}>
        <Box>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: M.slate, mb: 0.25 }}>Reason</Typography>
          <Typography sx={{ fontSize: '0.9375rem', color: M.dark }}>Felt nauseous after breakfast</Typography>
        </Box>
        <Box>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: M.slate, mb: 0.25 }}>Recorded by</Typography>
          <Typography sx={{ fontSize: '0.9375rem', color: M.dark }}>Sarah M. · 12:08</Typography>
        </Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: M.slate, mb: 0.25 }}>Follow-up</Typography>
            <Typography sx={{ fontSize: '0.9375rem', color: M.dark }}>GP informed · owner Sarah M.</Typography>
          </Box>
          <Badge label="Done" bg="#EAFBF5" color="#087A55" />
        </Stack>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: M.slate, mb: 0.25 }}>Linked to</Typography>
            <Typography sx={{ fontSize: '0.9375rem', color: M.dark }}>Daily note · health observation</Typography>
          </Box>
          <Badge label="Linked" bg="#EAF3FF" color={M.navy} />
        </Stack>
      </Stack>
    </Box>
  )
}

function PermissionsCard() {
  const rows = [
    { role: 'Medication lead', scope: 'Administer · stock · audit', badge: 'Full', bg: '#EAFBF5', color: '#087A55' },
    { role: 'Care worker (trained)', scope: 'Administer and record', badge: 'Administer', bg: '#EAF3FF', color: M.navy },
    { role: 'Care worker (not trained)', scope: 'No medication access', badge: 'None', bg: '#EDF1F6', color: M.slate },
    { role: 'Family portal', scope: 'Not shared by default', badge: 'Hidden', bg: '#EDF1F6', color: M.slate },
  ]
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.md, p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>Medication permissions</Typography>
        <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>By role</Typography>
      </Stack>
      {rows.map((r) => (
        <Stack key={r.role} direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ py: 1.5, borderBottom: `1px solid ${M.faint}`, '&:last-child': { borderBottom: 0 } }}>
          <Box>
            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: M.dark }}>{r.role}</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>{r.scope}</Typography>
          </Box>
          <Badge label={r.badge} bg={r.bg} color={r.color} />
        </Stack>
      ))}
    </Box>
  )
}

/* ─── Figma 3.6 · Reporting cards ──────────────────────── */

function InsightsHeroCard() {
  const metrics = [
    { label: 'Calls completed', value: '47', trend: '+12%', bg: '#EAFBF5', color: '#087A55' },
    { label: 'Average response', value: '23 min', trend: '-8%', bg: '#EAFBF5', color: '#087A55' },
    { label: 'Satisfaction', value: '4.6/5', trend: '+0.2', bg: '#EAFBF5', color: '#087A55' },
  ]
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.lg, p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 2 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>Operational insights</Typography>
        <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>Today</Typography>
      </Stack>
      <Grid container spacing={1.5}>
        {metrics.map((m) => (
          <Grid item xs={4} key={m.label}>
            <Box sx={{ p: 1.75, bgcolor: '#FFFFFF', borderRadius: '12px', border: `1px solid ${M.faint}` }}>
              <Typography sx={{ fontSize: '2rem', fontWeight: 700, color: M.dark, lineHeight: 1.1 }}>{m.value}</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: M.slate, mt: 0.5 }}>{m.label}</Typography>
              <Box sx={{ display: 'inline-block', mt: 1 }}><Badge label={m.trend} bg={m.bg} color={m.color} /></Box>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}

function AreaBarsCard() {
  const areas = [
    { name: 'North', pct: 96, bar: '#10B981' },
    { name: 'South', pct: 91, bar: M.navy },
    { name: 'East', pct: 88, bar: M.navy },
    { name: 'West', pct: 79, bar: '#D9A441' },
  ]
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.md, p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 2 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>Call completion by area</Typography>
        <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>This week</Typography>
      </Stack>
      {areas.map((a) => (
        <Box key={a.name} sx={{ mb: 1.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.5 }}>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: M.dark }}>{a.name}</Typography>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: M.dark }}>{a.pct}%</Typography>
          </Stack>
          <Box sx={{ height: 8, bgcolor: '#EDF1F6', borderRadius: 999, overflow: 'hidden' }}>
            <Box sx={{ width: `${a.pct}%`, height: '100%', bgcolor: a.bar, borderRadius: 999 }} />
          </Box>
        </Box>
      ))}
      <Box sx={{ mt: 2, bgcolor: '#FFF7E6', borderRadius: '10px', px: 1.75, py: 1.25 }}>
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#9A6700' }}>● West: 4 missed visits — drill down</Typography>
      </Box>
    </Box>
  )
}

function StaffingQualityCard() {
  const rows = [
    { area: 'North', staffing: '98%', missed: '1', missedHot: false },
    { area: 'South', staffing: '94%', missed: '2', missedHot: false },
    { area: 'West', staffing: '82%', missed: '4', missedHot: true },
  ]
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.md, p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 2 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>Staffing vs care quality</Typography>
        <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>By area</Typography>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center', rowGap: 1.5 }}>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: M.slate }}>Area</Typography>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: M.slate }}>Staffing</Typography>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: M.slate, textAlign: 'right' }}>Missed calls</Typography>
        {rows.map((r) => [
          <Typography key={`${r.area}-a`} sx={{ fontSize: '0.875rem', fontWeight: 600, color: M.dark }}>{r.area}</Typography>,
          <Typography key={`${r.area}-s`} sx={{ fontSize: '0.875rem', color: M.dark }}>{r.staffing}</Typography>,
          <Typography key={`${r.area}-m`} sx={{ fontSize: '0.875rem', fontWeight: 700, color: r.missedHot ? '#9A6700' : M.dark, textAlign: 'right' }}>{r.missed}</Typography>,
        ])}
      </Box>
    </Box>
  )
}

function ExportsCard() {
  const rows = [
    { title: 'Inspection evidence pack', sub: 'CQC · England · PDF', badge: 'Ready', bg: '#EAFBF5', color: '#087A55' },
    { title: 'Governance review', sub: 'Q3 · PDF + CSV', badge: 'Ready', bg: '#EAFBF5', color: '#087A55' },
    { title: 'Board report', sub: 'October', badge: 'Generating', bg: '#EAF3FF', color: M.navy },
  ]
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.md, p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>Exports</Typography>
        <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>Evidence</Typography>
      </Stack>
      {rows.map((r) => (
        <Stack key={r.title} direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ py: 1.5, borderBottom: `1px solid ${M.faint}` }}>
          <Box>
            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: M.dark }}>{r.title}</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>{r.sub}</Typography>
          </Box>
          <Badge label={r.badge} bg={r.bg} color={r.color} />
        </Stack>
      ))}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2 }}>
        <Button variant="contained" sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 3, py: 1, borderRadius: M.r.md, textTransform: 'none', boxShadow: 'none', '&:hover': { bgcolor: M.navyMid, boxShadow: 'none' } }}>Export</Button>
        <Button variant="outlined" sx={{ borderColor: '#C9D5E2', color: M.dark, fontWeight: 600, px: 3, py: 1, borderRadius: M.r.md, textTransform: 'none', bgcolor: '#FFFFFF', '&:hover': { borderColor: M.navy } }}>Schedule</Button>
      </Stack>
    </Box>
  )
}

/* ─── Figma 3.5 · Risk & Incidents cards ───────────────── */

function RiskHeroCard() {
  const rows = [
    { title: 'Fall risk — high', sub: 'Linked to care plan', badge: 'Assessed', bg: '#FFF7E6', color: '#9A6700', bar: '#F59E0B' },
    { title: 'Medication allergy — penicillin', sub: 'Linked to MAR', badge: 'Recorded', bg: '#EAF3FF', color: M.navy, bar: M.navy },
    { title: 'Safeguarding — resolved', sub: 'Follow-up complete', badge: 'Closed', bg: '#EAFBF5', color: '#087A55', bar: '#10B981' },
  ]
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.lg, p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>Risk assessments</Typography>
        <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>Margaret W.</Typography>
      </Stack>
      {rows.map((r) => (
        <Stack key={r.title} direction="row" spacing={1.5} alignItems="center" sx={{ py: 1.5, borderBottom: `1px solid ${M.faint}`, '&:last-child': { borderBottom: 0 } }}>
          <Box sx={{ width: 4, alignSelf: 'stretch', minHeight: 44, bgcolor: r.bar, borderRadius: 2, flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: M.dark }}>{r.title}</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>{r.sub}</Typography>
          </Box>
          <Badge label={r.badge} bg={r.bg} color={r.color} />
        </Stack>
      ))}
    </Box>
  )
}

function RiskListCard() {
  const rows = [
    { title: 'Fall risk — high', sub: 'Owner Sarah M. · review 18 Nov', badge: 'Review due', bg: '#FFF7E6', color: '#9A6700' },
    { title: 'Medication allergy — penicillin', sub: 'Owner James K. · review Jan', badge: 'Current', bg: '#EAFBF5', color: '#087A55' },
    { title: 'Choking — low', sub: 'Owner Sarah M. · review Feb', badge: 'Current', bg: '#EAFBF5', color: '#087A55' },
  ]
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.md, p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>Risk assessments · Margaret W.</Typography>
        <Badge label="3 active" bg="#EDF1F6" color={M.slate} />
      </Stack>
      {rows.map((r) => (
        <Stack key={r.title} direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ py: 1.5, borderBottom: `1px solid ${M.faint}`, '&:last-child': { borderBottom: 0 } }}>
          <Box>
            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: M.dark }}>{r.title}</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>{r.sub}</Typography>
          </Box>
          <Badge label={r.badge} bg={r.bg} color={r.color} />
        </Stack>
      ))}
    </Box>
  )
}

function LinkedRecordsCard() {
  const rows = [
    { title: 'Fall risk — high', sub: '', badge: 'Linked records', bg: '#EAF3FF', color: M.navy },
    { title: 'Care plan', sub: 'Mobility support · section 4', badge: 'Linked', bg: '#EAF3FF', color: M.navy },
    { title: 'Daily notes', sub: '3 mentions this week', badge: 'Linked', bg: '#EAF3FF', color: M.navy },
    { title: 'Incident', sub: 'Fall reported 2 Nov', badge: 'Linked', bg: '#FFF7E6', color: '#9A6700' },
    { title: 'Body map', sub: 'Left forearm bruise', badge: 'Linked', bg: '#EAF3FF', color: M.navy },
  ]
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.md, p: { xs: 2.5, md: 3 } }}>
      {rows.map((r) => (
        <Stack key={r.title} direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ py: 1.5, borderBottom: `1px solid ${M.faint}`, '&:last-child': { borderBottom: 0 } }}>
          <Box>
            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: M.dark }}>{r.title}</Typography>
            {r.sub ? <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>{r.sub}</Typography> : null}
          </Box>
          <Badge label={r.badge} bg={r.bg} color={r.color} />
        </Stack>
      ))}
    </Box>
  )
}

function FollowUpCard() {
  const rows = [
    { title: 'Update mobility plan', sub: 'Owner Sarah M. · due 12 Nov', badge: 'Overdue', bg: '#FEF0F0', color: '#B42318' },
    { title: 'Physiotherapy referral', sub: 'Owner James K. · done 8 Nov', badge: 'Done', bg: '#EAFBF5', color: '#087A55' },
    { title: 'Escalated to manager', sub: '8 Nov · reviewed', badge: 'History', bg: '#EDF1F6', color: M.slate },
  ]
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.md, p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>Follow-up actions</Typography>
        <Badge label="1 overdue" bg="#FEF0F0" color="#B42318" />
      </Stack>
      {rows.map((r) => (
        <Stack key={r.title} direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ py: 1.5, borderBottom: `1px solid ${M.faint}`, '&:last-child': { borderBottom: 0 } }}>
          <Box>
            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: M.dark }}>{r.title}</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>{r.sub}</Typography>
          </Box>
          <Badge label={r.badge} bg={r.bg} color={r.color} />
        </Stack>
      ))}
    </Box>
  )
}

/* ─── Figma 3.4 · Scheduling cards ─────────────────────── */

function CallScheduleCard() {
  const rows = [
    { time: '09:00', client: 'Margaret W.', carer: 'Sarah M.', carerRed: false, badge: 'Completed', bg: '#EAFBF5', color: '#087A55' },
    { time: '10:30', client: 'John D.', carer: 'James K.', carerRed: false, badge: 'En route', bg: '#EAF3FF', color: M.navy },
    { time: '11:00', client: 'Patricia L.', carer: 'No carer assigned', carerRed: true, badge: 'Unassigned', bg: '#FEF0F0', color: '#B42318' },
    { time: '13:00', client: 'Robert H.', carer: 'Priya S.', carerRed: false, badge: 'Scheduled', bg: '#EDF1F6', color: M.slate },
  ]
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.lg, p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>Call schedule</Typography>
        <Badge label="1 unassigned" bg="#FEF0F0" color="#B42318" />
      </Stack>
      {rows.map((r, i) => (
        <Stack key={`${r.time}-${r.client}`} direction="row" spacing={1.5} alignItems="center" sx={{ py: 1.75, borderBottom: i < rows.length - 1 ? `1px solid ${M.faint}` : 'none' }}>
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: M.dark, minWidth: 44 }}>{r.time}</Typography>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: M.dark }}>{r.client}</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: r.carerRed ? '#B42318' : M.slate }}>{r.carer}</Typography>
          </Box>
          <Badge label={r.badge} bg={r.bg} color={r.color} />
        </Stack>
      ))}
    </Box>
  )
}

function RotaGridCard() {
  const cols = ['08:00', '11:00', '14:00', '17:00']
  const shifts: { name: string; blocks: { from: number; to: number; color: string }[] }[] = [
    { name: 'Sarah M.', blocks: [{ from: 0, to: 2, color: '#BFD9F5' }] },
    { name: 'James K.', blocks: [{ from: 1, to: 2, color: '#BFD9F5' }, { from: 2, to: 4, color: '#F5C97B' }] },
    { name: 'Priya S.', blocks: [{ from: 0, to: 1, color: '#BFD9F5' }, { from: 3, to: 4, color: '#BFD9F5' }] },
  ]
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.md, p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 2 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>Rota — Tue 14 Oct</Typography>
        <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>North area</Typography>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: '90px repeat(4, 1fr)', alignItems: 'center', gap: 0.75 }}>
        <Box />
        {cols.map((c) => (
          <Typography key={c} sx={{ fontSize: '0.6875rem', fontWeight: 600, color: M.slate, textAlign: 'center' }}>{c}</Typography>
        ))}
        {shifts.map((s) => [
          <Typography key={`${s.name}-label`} sx={{ fontSize: '0.8125rem', fontWeight: 600, color: M.dark }}>{s.name}</Typography>,
          ...[0, 1, 2, 3].map((col) => {
            const b = s.blocks.find((x) => col >= x.from && col < x.to)
            return (
              <Box key={`${s.name}-${col}`} sx={{ height: 26, borderRadius: '6px', bgcolor: b ? b.color : '#F1F4F8' }} />
            )
          }),
        ])}
      </Box>
      <Box sx={{ mt: 2, bgcolor: '#FFF7E6', borderRadius: '10px', px: 1.75, py: 1.25 }}>
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#9A6700' }}>● Tight turnaround: 10 min between visits for James K.</Typography>
      </Box>
    </Box>
  )
}

function OpenCallsCard() {
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.md, p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>Open calls</Typography>
        <Badge label="2 open" bg="#EAF3FF" color={M.navy} />
      </Stack>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1.5, borderBottom: `1px solid ${M.faint}` }}>
        <Box>
          <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: M.dark }}>11:00 — Patricia L.</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>45 min · 0.8 mi from Priya S.</Typography>
        </Box>
        <Badge label="2 interested" bg="#EAF3FF" color={M.navy} />
      </Stack>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1.5 }}>
        <Box>
          <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: M.dark }}>15:30 — Robert H.</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>30 min · North area</Typography>
        </Box>
        <Badge label="Open" bg="#EDF1F6" color={M.slate} />
      </Stack>
      <Box sx={{ mt: 1, bgcolor: '#EAF3FF', borderRadius: '10px', px: 1.75, py: 1.25 }}>
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: M.navy }}>● Manager approval required before publishing</Typography>
      </Box>
    </Box>
  )
}

function ProposedChangesCard() {
  const rows = [
    { title: 'Patricia L. 11:00', sub: 'Assign Priya S.', badge: 'New', bg: '#EAFBF5', color: '#087A55' },
    { title: 'Robert H. 13:00', sub: 'Move to 13:30', badge: 'Changed', bg: '#EAF3FF', color: M.navy },
    { title: 'Saturday morning', sub: '1 visit uncovered', badge: 'Gap', bg: '#FFF7E6', color: '#9A6700' },
  ]
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.md, p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>Proposed changes</Typography>
        <Badge label="3 changes" bg="#FFF7E6" color="#9A6700" />
      </Stack>
      {rows.map((r) => (
        <Stack key={r.title} direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ py: 1.5, borderBottom: `1px solid ${M.faint}` }}>
          <Box>
            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: M.dark }}>{r.title}</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>{r.sub}</Typography>
          </Box>
          <Badge label={r.badge} bg={r.bg} color={r.color} />
        </Stack>
      ))}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2 }}>
        <Button variant="contained" sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 3, py: 1, borderRadius: M.r.md, textTransform: 'none', boxShadow: 'none', '&:hover': { bgcolor: M.navyMid, boxShadow: 'none' } }}>Approve &amp; publish</Button>
        <Button variant="outlined" sx={{ borderColor: '#C9D5E2', color: M.dark, fontWeight: 600, px: 3, py: 1, borderRadius: M.r.md, textTransform: 'none', bgcolor: '#FFFFFF', '&:hover': { borderColor: M.navy } }}>Review</Button>
      </Stack>
    </Box>
  )
}

/* ─── Figma 3.3 · Workforce cards ──────────────────────── */

function StaffComplianceCard() {
  const rows = [
    { initials: 'SM', name: 'Sarah M.', role: 'Senior Carer', badge: '98% compliant', bg: '#D2FBF4', badgeBg: '#D2FBF4', color: M.tealDeep, avBg: '#D2FBF4', avColor: M.tealDeep },
    { initials: 'JK', name: 'James K.', role: 'Care Worker', badge: '85% compliant', bg: '#EAF3FF', badgeBg: '#EAF3FF', color: M.navy, avBg: '#DCE9F7', avColor: M.navy },
    { initials: 'PS', name: 'Priya S.', role: 'Care Worker', badge: '72% compliant', bg: '#FFF7E6', badgeBg: '#FFF7E6', color: '#9A6700', avBg: '#FCEFC7', avColor: '#9A6700' },
  ]
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.lg, p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>Staff compliance</Typography>
        <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>3 of 42 shown</Typography>
      </Stack>
      {rows.map((r, i) => (
        <Stack key={r.initials} direction="row" spacing={1.5} alignItems="center" sx={{ py: 1.75, borderBottom: i < rows.length - 1 ? `1px solid ${M.faint}` : 'none' }}>
          <Avatar initials={r.initials} bg={r.avBg} color={r.avColor} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: M.dark }}>{r.name}</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>{r.role}</Typography>
          </Box>
          <Badge label={r.badge} bg={r.badgeBg} color={r.color} />
        </Stack>
      ))}
    </Box>
  )
}

function StaffProfileCard() {
  const rows = [
    { title: 'DBS check', badge: 'Valid', bg: '#EAFBF5', color: '#087A55' },
    { title: 'Right to work', badge: 'Verified', bg: '#D2FBF4', color: M.tealDeep },
    { title: 'Moving & handling', badge: 'Expired', bg: '#FEF0F0', color: '#B42318' },
    { title: 'Medication competency', badge: 'Signed off', bg: '#EAFBF5', color: '#087A55' },
  ]
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.md, p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
        <Avatar initials="PS" bg="#DCE9F7" color={M.navy} />
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>Priya S.</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>Care Worker · Staff profile</Typography>
        </Box>
      </Stack>
      {rows.map((r) => (
        <Stack key={r.title} direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ py: 1.25, borderBottom: `1px solid ${M.faint}` }}>
          <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: M.dark }}>{r.title}</Typography>
          <Badge label={r.badge} bg={r.bg} color={r.color} />
        </Stack>
      ))}
      <Box sx={{ mt: 1.5, bgcolor: '#FEF0F0', borderRadius: '10px', px: 1.75, py: 1.25 }}>
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#B42318' }}>● Not assignable to shifts until resolved</Typography>
      </Box>
    </Box>
  )
}

function TrainingMatrixCard() {
  const staff = ['SM', 'JK', 'PS']
  const rows: { course: string; cells: ('current' | 'expiring' | 'expired')[] }[] = [
    { course: 'Safeguarding', cells: ['current', 'current', 'current'] },
    { course: 'Medication', cells: ['current', 'expiring', 'current'] },
    { course: 'Moving & handling', cells: ['current', 'expired', 'current'] },
    { course: 'First aid', cells: ['current', 'expiring', 'current'] },
  ]
  const dot = (s: string) => (s === 'current' ? '#10B981' : s === 'expiring' ? '#F59E0B' : '#EF4444')
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.md, p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>Training matrix</Typography>
        <Badge label="3 expiring in 30 days" bg="#FFF7E6" color="#9A6700" />
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1.6fr repeat(3, 1fr)', alignItems: 'center', rowGap: 1.25 }}>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: M.slate }}>Course</Typography>
        {staff.map((s) => (
          <Typography key={s} sx={{ fontSize: '0.75rem', fontWeight: 600, color: M.slate, textAlign: 'center' }}>{s}</Typography>
        ))}
        {rows.map((r) => [
          <Typography key={`${r.course}-label`} sx={{ fontSize: '0.875rem', fontWeight: 500, color: M.dark }}>{r.course}</Typography>,
          ...r.cells.map((c, i) => (
            <Box key={`${r.course}-${i}`} sx={{ display: 'flex', justifyContent: 'center' }}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: dot(c) }} />
            </Box>
          )),
        ])}
      </Box>
      <Stack direction="row" spacing={2} sx={{ mt: 2, pt: 1.5, borderTop: `1px solid ${M.faint}` }}>
        {[['Current', '#10B981'], ['Expiring', '#F59E0B'], ['Expired', '#EF4444']].map(([label, c]) => (
          <Stack key={label} direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c }} />
            <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>{label}</Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  )
}

function AvailabilityCard() {
  const days = [
    { d: 'Mon', state: 'on' },
    { d: 'Tue', state: 'on' },
    { d: 'Wed', state: 'leave' },
    { d: 'Thu', state: 'leave' },
    { d: 'Fri', state: 'leave' },
    { d: 'Sat', state: 'off' },
    { d: 'Sun', state: 'on' },
  ] as const
  const cellSx = (state: string) =>
    state === 'on'
      ? { bgcolor: '#D2FBF4', border: '1px solid transparent', color: M.tealDeep }
      : state === 'leave'
        ? { bgcolor: '#FFF7E6', border: '1px dashed #F59E0B', color: '#9A6700' }
        : { bgcolor: '#EDF1F6', border: '1px solid transparent', color: M.slate }
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.md, p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 2 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>Availability · w/c 10 Nov</Typography>
        <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>Sarah M.</Typography>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.75, mb: 2 }}>
        {days.map((x) => (
          <Box key={x.d} sx={{ ...cellSx(x.state), borderRadius: '8px', py: 1, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600 }}>{x.d}</Typography>
          </Box>
        ))}
      </Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1.25, borderTop: `1px solid ${M.faint}` }}>
        <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: M.dark }}>Annual leave · Wed–Fri</Typography>
        <Badge label="Pending" bg="#FFF7E6" color="#9A6700" />
      </Stack>
      <Typography sx={{ fontSize: '0.8125rem', color: M.slate, mb: 1.5 }}>Coverage impact: 2 shifts to fill</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <Button variant="contained" sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 3, py: 1, borderRadius: M.r.md, textTransform: 'none', boxShadow: 'none', '&:hover': { bgcolor: M.navyMid, boxShadow: 'none' } }}>Approve</Button>
        <Button variant="outlined" sx={{ borderColor: '#C9D5E2', color: M.dark, fontWeight: 600, px: 3, py: 1, borderRadius: M.r.md, textTransform: 'none', bgcolor: '#FFFFFF', '&:hover': { borderColor: M.navy } }}>Send shifts to marketplace</Button>
      </Stack>
    </Box>
  )
}

/* ─── Figma 3.2 · Medication (eMAR) page ────────────────── */

function MedicationPage() {
  const nav = useNavigate()
  const d = features['medication']
  const steps = [
    { n: '01', heading: d.detailSections[0].heading, body: d.detailSections[0].body, card: <MarChartCard /> },
    { n: '02', heading: d.detailSections[1].heading, body: d.detailSections[1].body, card: <ExceptionCard /> },
    { n: '03', heading: d.detailSections[2].heading, body: d.detailSections[2].body, card: <PermissionsCard /> },
  ]
  const worksWith = [
    { name: 'Care Management', desc: 'Plans, notes, reviews and observations', path: '/features/care-management' },
    { name: 'Risk & Incidents', desc: 'Assessments, recording and follow-up', path: '/features/risk-management' },
    { name: 'Reporting', desc: 'Dashboards and evidence', path: '/features/reporting' },
  ]
  return (
    <MarketingLayout>
      <PageMeta
        title="Medication records your team can trust | MeticleCare"
        description="Use eMAR and medication workflows where your service provides medication support, with clear permissions and an audit trail."
        canonicalPath="/features/medication"
        breadcrumbs={[
          { name: 'Home', path: '/' },
          { name: 'Platform', path: '/platform' },
          { name: 'Medication (eMAR)', path: '/features/medication' },
        ]}
      />
      {/* Breadcrumb */}
      <Box sx={{ background: 'linear-gradient(180deg, #EAF3FC 0%, #EBF3FC 100%)', pt: { xs: 11, md: 15 }, pb: 0 }}>
        <Container maxWidth="lg">
          <Stack direction="row" alignItems="center" spacing={1} sx={{ fontSize: '0.8125rem' }}>
            <Typography component="button" type="button" onClick={() => nav('/platform')} sx={{ border: 0, bgcolor: 'transparent', cursor: 'pointer', color: M.slate, fontSize: 'inherit', fontFamily: 'inherit', p: 0, '&:hover': { color: M.navy } }}>Platform</Typography>
            <Typography sx={{ color: M.slate }}>›</Typography>
            <Box sx={{ bgcolor: '#FFFFFF', border: `1px solid ${M.faint}`, borderRadius: 999, px: 1.5, py: 0.375 }}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: M.navy }}>Medication (eMAR)</Typography>
            </Box>
          </Stack>
        </Container>
      </Box>
      {/* Hero */}
      <Box sx={{ background: 'radial-gradient(640px 520px at 82% 220px, #D2E3F6 0%, rgba(210,227,246,0) 70%), linear-gradient(180deg, #EAF3FC 0%, #FFFFFF 100%)', py: { xs: 5, md: 8 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 8 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <EyebrowPill>Platform capability</EyebrowPill>
              <Typography sx={{ fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', lineHeight: 1.05, fontWeight: 700, letterSpacing: '-0.03em', color: M.dark, mb: 2.5 }}>
                {d.title}
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: '1.125rem', lineHeight: 1.65, mb: 2 }}>
                {d.intro}
              </Typography>
              <Typography sx={{ fontSize: '0.875rem', mb: 3 }}>
                <Typography component="span" sx={{ fontWeight: 600, color: M.dark }}>For </Typography>
                <Typography component="span" sx={{ color: M.slate }}>{d.audience}</Typography>
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', boxShadow: 'none', '&:hover': { bgcolor: M.navyMid, boxShadow: 'none' } }}>Book a demo</Button>
                <Button variant="outlined" onClick={() => nav('/platform')} sx={{ borderColor: '#C9D5E2', color: M.dark, fontWeight: 600, px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', bgcolor: '#FFFFFF', '&:hover': { borderColor: M.navy } }}>Explore all modules</Button>
              </Stack>
              <AssureRow />
            </Grid>
            <Grid item xs={12} md={6}>
              <MedicationRecordCard />
            </Grid>
          </Grid>
        </Container>
      </Box>
      {/* Capabilities */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#FFFFFF' }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 4, md: 8 }} sx={{ mb: { xs: 4, md: 6 } }}>
            <Grid item xs={12} md={6}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: M.navy, mb: 1.5 }}>What your team can do</Typography>
              <Typography sx={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', lineHeight: 1.15, fontWeight: 700, letterSpacing: '-0.02em', color: M.dark }}>
                Every round recorded, every exception followed up.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'flex-end' }}>
              <Typography sx={{ color: M.slate, fontSize: '1.05rem', lineHeight: 1.65 }}>
                MAR charts, administration history and stock sit behind clear permissions, with an audit trail your managers can rely on.
              </Typography>
            </Grid>
          </Grid>
          <Grid container spacing={2}>
            {d.capabilities.map((cap) => (
              <Grid item xs={12} sm={6} md={2.4} key={cap}>
                <Box sx={{ height: '100%', p: 2.5, borderRadius: M.r.md, border: `1px solid ${M.faint}`, bgcolor: '#FFFFFF' }}>
                  <Check sx={{ color: M.navy, fontSize: 20, mb: 1.5 }} />
                  <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem', color: M.dark, lineHeight: 1.4 }}>{cap}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
      {/* Steps */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#FFFFFF' }}>
        <Container maxWidth="lg">
          <Stack spacing={{ xs: 8, md: 10 }}>
            {steps.map((s, i) => (
              <Grid container spacing={{ xs: 4, md: 8 }} alignItems="center" key={s.n}>
                <Grid item xs={12} md={6} order={{ xs: 1, md: i % 2 === 0 ? 1 : 2 }}>
                  <StepNo n={s.n} />
                  <Typography sx={{ fontSize: 'clamp(1.375rem, 2.5vw, 1.875rem)', fontWeight: 700, letterSpacing: '-0.02em', color: M.dark, mb: 2 }}>{s.heading}</Typography>
                  <Typography sx={{ color: M.slate, lineHeight: 1.75, fontSize: '1rem' }}>{s.body}</Typography>
                </Grid>
                <Grid item xs={12} md={6} order={{ xs: 2, md: i % 2 === 0 ? 2 : 1 }}>
                  <Box sx={{ bgcolor: M.paper, borderRadius: '20px', p: { xs: 3, md: 5 } }}>{s.card}</Box>
                </Grid>
              </Grid>
            ))}
          </Stack>
        </Container>
      </Box>
      {/* Works with */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
            <Typography sx={{ fontSize: 'clamp(1.375rem, 2.5vw, 1.875rem)', fontWeight: 700, letterSpacing: '-0.02em', color: M.dark }}>Works with</Typography>
            <Typography component="button" type="button" onClick={() => nav('/platform')} sx={{ border: 0, bgcolor: 'transparent', cursor: 'pointer', color: M.navy, fontWeight: 600, fontSize: '0.875rem', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 0.5, '&:hover': { textDecoration: 'underline' } }}>
              View all modules <ArrowForward sx={{ fontSize: 16 }} />
            </Typography>
          </Stack>
          <Grid container spacing={2}>
            {worksWith.map((w) => (
              <Grid item xs={12} md={4} key={w.path}>
                <Box component="button" type="button" onClick={() => nav(w.path)} sx={{ width: '100%', textAlign: 'left', bgcolor: '#FFFFFF', border: `1px solid ${M.faint}`, borderRadius: M.r.md, p: 2.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, transition: `border-color ${M.transition.fast}`, '&:hover': { borderColor: M.navy }, '&:focus-visible': { outline: `2px solid ${M.navy}`, outlineOffset: 2 } }}>
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: '1rem', color: M.dark, mb: 0.5 }}>{w.name}</Typography>
                    <Typography sx={{ fontSize: '0.875rem', color: M.slate }}>{w.desc}</Typography>
                  </Box>
                  <Box sx={{ color: M.navy, display: 'flex', flexShrink: 0 }}><ArrowForward sx={{ fontSize: 20 }} /></Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
      {/* CTA */}
      <Box sx={{ py: { xs: 10, md: 14 }, bgcolor: '#FFFFFF', textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography sx={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)', lineHeight: 1.15, fontWeight: 700, letterSpacing: '-0.025em', color: M.dark, mb: 3 }}>
            See medication records your team can trust in your operation.
          </Typography>
          <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', boxShadow: 'none', '&:hover': { bgcolor: M.navyMid, boxShadow: 'none' } }}>Book a demo</Button>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}><AssureRow /></Box>
        </Container>
      </Box>
    </MarketingLayout>
  )
}

/* ─── Figma 3.6 · Reporting page ───────────────────────── */

function ReportingPage() {
  const nav = useNavigate()
  const d = features['reporting']
  const steps = [
    { n: '01', heading: d.detailSections[0].heading, body: d.detailSections[0].body, card: <AreaBarsCard /> },
    { n: '02', heading: d.detailSections[1].heading, body: d.detailSections[1].body, card: <StaffingQualityCard /> },
    { n: '03', heading: d.detailSections[2].heading, body: d.detailSections[2].body, card: <ExportsCard /> },
  ]
  const worksWith = [
    { name: 'Workforce', desc: 'Staff, training and competency', path: '/features/workforce' },
    { name: 'Risk & Incidents', desc: 'Assessments, recording and follow-up', path: '/features/risk-management' },
    { name: 'AI Intelligence', desc: 'Summaries, detection and copilot', path: '/features/ai' },
  ]
  return (
    <MarketingLayout>
      <PageMeta
        title="See what needs attention | MeticleCare"
        description="Bring operational activity into reports that help managers decide what to investigate, improve or follow up."
        canonicalPath="/features/reporting"
        breadcrumbs={[
          { name: 'Home', path: '/' },
          { name: 'Platform', path: '/platform' },
          { name: 'Reporting', path: '/features/reporting' },
        ]}
      />
      <Box sx={{ background: 'linear-gradient(180deg, #EAF3FC 0%, #EBF3FC 100%)', pt: { xs: 11, md: 15 }, pb: 0 }}>
        <Container maxWidth="lg">
          <Stack direction="row" alignItems="center" spacing={1} sx={{ fontSize: '0.8125rem' }}>
            <Typography component="button" type="button" onClick={() => nav('/platform')} sx={{ border: 0, bgcolor: 'transparent', cursor: 'pointer', color: M.slate, fontSize: 'inherit', fontFamily: 'inherit', p: 0, '&:hover': { color: M.navy } }}>Platform</Typography>
            <Typography sx={{ color: M.slate }}>›</Typography>
            <Box sx={{ bgcolor: '#FFFFFF', border: `1px solid ${M.faint}`, borderRadius: 999, px: 1.5, py: 0.375 }}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: M.navy }}>Reporting</Typography>
            </Box>
          </Stack>
        </Container>
      </Box>
      <Box sx={{ background: 'radial-gradient(640px 520px at 82% 220px, #D2E3F6 0%, rgba(210,227,246,0) 70%), linear-gradient(180deg, #EAF3FC 0%, #FFFFFF 100%)', py: { xs: 5, md: 8 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 8 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <EyebrowPill>Platform capability</EyebrowPill>
              <Typography sx={{ fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', lineHeight: 1.05, fontWeight: 700, letterSpacing: '-0.03em', color: M.dark, mb: 2.5 }}>
                {d.title}
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: '1.125rem', lineHeight: 1.65, mb: 2 }}>
                {d.intro}
              </Typography>
              <Typography sx={{ fontSize: '0.875rem', mb: 3 }}>
                <Typography component="span" sx={{ fontWeight: 600, color: M.dark }}>For </Typography>
                <Typography component="span" sx={{ color: M.slate }}>{d.audience}</Typography>
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', boxShadow: 'none', '&:hover': { bgcolor: M.navyMid, boxShadow: 'none' } }}>Book a demo</Button>
                <Button variant="outlined" onClick={() => nav('/platform')} sx={{ borderColor: '#C9D5E2', color: M.dark, fontWeight: 600, px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', bgcolor: '#FFFFFF', '&:hover': { borderColor: M.navy } }}>Explore all modules</Button>
              </Stack>
              <AssureRow />
            </Grid>
            <Grid item xs={12} md={6}>
              <InsightsHeroCard />
            </Grid>
          </Grid>
        </Container>
      </Box>
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#FFFFFF' }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 4, md: 8 }} sx={{ mb: { xs: 4, md: 6 } }}>
            <Grid item xs={12} md={6}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: M.navy, mb: 1.5 }}>What your team can do</Typography>
              <Typography sx={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', lineHeight: 1.15, fontWeight: 700, letterSpacing: '-0.02em', color: M.dark }}>
                From day-to-day activity to clear next steps.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'flex-end' }}>
              <Typography sx={{ color: M.slate, fontSize: '1.05rem', lineHeight: 1.65 }}>
                Operational, workforce and compliance reports point managers to what needs following up, with evidence you can export.
              </Typography>
            </Grid>
          </Grid>
          <Grid container spacing={2}>
            {d.capabilities.map((cap) => (
              <Grid item xs={12} sm={6} md={2.4} key={cap}>
                <Box sx={{ height: '100%', p: 2.5, borderRadius: M.r.md, border: `1px solid ${M.faint}`, bgcolor: '#FFFFFF' }}>
                  <Check sx={{ color: M.navy, fontSize: 20, mb: 1.5 }} />
                  <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem', color: M.dark, lineHeight: 1.4 }}>{cap}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#FFFFFF' }}>
        <Container maxWidth="lg">
          <Stack spacing={{ xs: 8, md: 10 }}>
            {steps.map((s, i) => (
              <Grid container spacing={{ xs: 4, md: 8 }} alignItems="center" key={s.n}>
                <Grid item xs={12} md={6} order={{ xs: 1, md: i % 2 === 0 ? 1 : 2 }}>
                  <StepNo n={s.n} />
                  <Typography sx={{ fontSize: 'clamp(1.375rem, 2.5vw, 1.875rem)', fontWeight: 700, letterSpacing: '-0.02em', color: M.dark, mb: 2 }}>{s.heading}</Typography>
                  <Typography sx={{ color: M.slate, lineHeight: 1.75, fontSize: '1rem' }}>{s.body}</Typography>
                </Grid>
                <Grid item xs={12} md={6} order={{ xs: 2, md: i % 2 === 0 ? 2 : 1 }}>
                  <Box sx={{ bgcolor: M.paper, borderRadius: '20px', p: { xs: 3, md: 5 } }}>{s.card}</Box>
                </Grid>
              </Grid>
            ))}
          </Stack>
        </Container>
      </Box>
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
            <Typography sx={{ fontSize: 'clamp(1.375rem, 2.5vw, 1.875rem)', fontWeight: 700, letterSpacing: '-0.02em', color: M.dark }}>Works with</Typography>
            <Typography component="button" type="button" onClick={() => nav('/platform')} sx={{ border: 0, bgcolor: 'transparent', cursor: 'pointer', color: M.navy, fontWeight: 600, fontSize: '0.875rem', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 0.5, '&:hover': { textDecoration: 'underline' } }}>
              View all modules <ArrowForward sx={{ fontSize: 16 }} />
            </Typography>
          </Stack>
          <Grid container spacing={2}>
            {worksWith.map((w) => (
              <Grid item xs={12} md={4} key={w.path}>
                <Box component="button" type="button" onClick={() => nav(w.path)} sx={{ width: '100%', textAlign: 'left', bgcolor: '#FFFFFF', border: `1px solid ${M.faint}`, borderRadius: M.r.md, p: 2.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, transition: `border-color ${M.transition.fast}`, '&:hover': { borderColor: M.navy }, '&:focus-visible': { outline: `2px solid ${M.navy}`, outlineOffset: 2 } }}>
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: '1rem', color: M.dark, mb: 0.5 }}>{w.name}</Typography>
                    <Typography sx={{ fontSize: '0.875rem', color: M.slate }}>{w.desc}</Typography>
                  </Box>
                  <Box sx={{ color: M.navy, display: 'flex', flexShrink: 0 }}><ArrowForward sx={{ fontSize: 20 }} /></Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
      <Box sx={{ py: { xs: 10, md: 14 }, bgcolor: '#FFFFFF', textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography sx={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)', lineHeight: 1.15, fontWeight: 700, letterSpacing: '-0.025em', color: M.dark, mb: 3 }}>
            See what needs attention in your operation.
          </Typography>
          <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', boxShadow: 'none', '&:hover': { bgcolor: M.navyMid, boxShadow: 'none' } }}>Book a demo</Button>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}><AssureRow /></Box>
        </Container>
      </Box>
    </MarketingLayout>
  )
}

/* ─── Figma 3.5 · Risk & Incidents page ────────────────── */

function RiskPage() {
  const nav = useNavigate()
  const d = features['risk-management']
  const steps = [
    { n: '01', heading: d.detailSections[0].heading, body: d.detailSections[0].body, card: <RiskListCard /> },
    { n: '02', heading: d.detailSections[1].heading, body: d.detailSections[1].body, card: <LinkedRecordsCard /> },
    { n: '03', heading: d.detailSections[2].heading, body: d.detailSections[2].body, card: <FollowUpCard /> },
  ]
  const worksWith = [
    { name: 'Care Management', desc: 'Plans, notes, reviews and observations', path: '/features/care-management' },
    { name: 'Medication (eMAR)', desc: 'Administration records and audit trails', path: '/features/medication' },
    { name: 'Reporting', desc: 'Dashboards and evidence', path: '/features/reporting' },
  ]
  return (
    <MarketingLayout>
      <PageMeta
        title="Identify, record, review and act | MeticleCare"
        description="Keep risk information visible and connected to the plans and records that make it meaningful."
        canonicalPath="/features/risk-management"
        breadcrumbs={[
          { name: 'Home', path: '/' },
          { name: 'Platform', path: '/platform' },
          { name: 'Risk & Incidents', path: '/features/risk-management' },
        ]}
      />
      <Box sx={{ background: 'linear-gradient(180deg, #EAF3FC 0%, #EBF3FC 100%)', pt: { xs: 11, md: 15 }, pb: 0 }}>
        <Container maxWidth="lg">
          <Stack direction="row" alignItems="center" spacing={1} sx={{ fontSize: '0.8125rem' }}>
            <Typography component="button" type="button" onClick={() => nav('/platform')} sx={{ border: 0, bgcolor: 'transparent', cursor: 'pointer', color: M.slate, fontSize: 'inherit', fontFamily: 'inherit', p: 0, '&:hover': { color: M.navy } }}>Platform</Typography>
            <Typography sx={{ color: M.slate }}>›</Typography>
            <Box sx={{ bgcolor: '#FFFFFF', border: `1px solid ${M.faint}`, borderRadius: 999, px: 1.5, py: 0.375 }}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: M.navy }}>Risk &amp; Incidents</Typography>
            </Box>
          </Stack>
        </Container>
      </Box>
      <Box sx={{ background: 'radial-gradient(640px 520px at 82% 220px, #D2E3F6 0%, rgba(210,227,246,0) 70%), linear-gradient(180deg, #EAF3FC 0%, #FFFFFF 100%)', py: { xs: 5, md: 8 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 8 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <EyebrowPill>Platform capability</EyebrowPill>
              <Typography sx={{ fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', lineHeight: 1.05, fontWeight: 700, letterSpacing: '-0.03em', color: M.dark, mb: 2.5 }}>
                {d.title}
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: '1.125rem', lineHeight: 1.65, mb: 2 }}>
                {d.intro}
              </Typography>
              <Typography sx={{ fontSize: '0.875rem', mb: 3 }}>
                <Typography component="span" sx={{ fontWeight: 600, color: M.dark }}>For </Typography>
                <Typography component="span" sx={{ color: M.slate }}>{d.audience}</Typography>
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', boxShadow: 'none', '&:hover': { bgcolor: M.navyMid, boxShadow: 'none' } }}>Book a demo</Button>
                <Button variant="outlined" onClick={() => nav('/platform')} sx={{ borderColor: '#C9D5E2', color: M.dark, fontWeight: 600, px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', bgcolor: '#FFFFFF', '&:hover': { borderColor: M.navy } }}>Explore all modules</Button>
              </Stack>
              <AssureRow />
            </Grid>
            <Grid item xs={12} md={6}>
              <RiskHeroCard />
            </Grid>
          </Grid>
        </Container>
      </Box>
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#FFFFFF' }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 4, md: 8 }} sx={{ mb: { xs: 4, md: 6 } }}>
            <Grid item xs={12} md={6}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: M.navy, mb: 1.5 }}>What your team can do</Typography>
              <Typography sx={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', lineHeight: 1.15, fontWeight: 700, letterSpacing: '-0.02em', color: M.dark }}>
                Risk that stays in view, not in a folder.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'flex-end' }}>
              <Typography sx={{ color: M.slate, fontSize: '1.05rem', lineHeight: 1.65 }}>
                Assessments have owners and review dates, link to the care plan, and keep a record of every change.
              </Typography>
            </Grid>
          </Grid>
          <Grid container spacing={2}>
            {d.capabilities.map((cap) => (
              <Grid item xs={12} sm={6} md={2.4} key={cap}>
                <Box sx={{ height: '100%', p: 2.5, borderRadius: M.r.md, border: `1px solid ${M.faint}`, bgcolor: '#FFFFFF' }}>
                  <Check sx={{ color: M.navy, fontSize: 20, mb: 1.5 }} />
                  <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem', color: M.dark, lineHeight: 1.4 }}>{cap}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#FFFFFF' }}>
        <Container maxWidth="lg">
          <Stack spacing={{ xs: 8, md: 10 }}>
            {steps.map((s, i) => (
              <Grid container spacing={{ xs: 4, md: 8 }} alignItems="center" key={s.n}>
                <Grid item xs={12} md={6} order={{ xs: 1, md: i % 2 === 0 ? 1 : 2 }}>
                  <StepNo n={s.n} />
                  <Typography sx={{ fontSize: 'clamp(1.375rem, 2.5vw, 1.875rem)', fontWeight: 700, letterSpacing: '-0.02em', color: M.dark, mb: 2 }}>{s.heading}</Typography>
                  <Typography sx={{ color: M.slate, lineHeight: 1.75, fontSize: '1rem' }}>{s.body}</Typography>
                </Grid>
                <Grid item xs={12} md={6} order={{ xs: 2, md: i % 2 === 0 ? 2 : 1 }}>
                  <Box sx={{ bgcolor: M.paper, borderRadius: '20px', p: { xs: 3, md: 5 } }}>{s.card}</Box>
                </Grid>
              </Grid>
            ))}
          </Stack>
        </Container>
      </Box>
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
            <Typography sx={{ fontSize: 'clamp(1.375rem, 2.5vw, 1.875rem)', fontWeight: 700, letterSpacing: '-0.02em', color: M.dark }}>Works with</Typography>
            <Typography component="button" type="button" onClick={() => nav('/platform')} sx={{ border: 0, bgcolor: 'transparent', cursor: 'pointer', color: M.navy, fontWeight: 600, fontSize: '0.875rem', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 0.5, '&:hover': { textDecoration: 'underline' } }}>
              View all modules <ArrowForward sx={{ fontSize: 16 }} />
            </Typography>
          </Stack>
          <Grid container spacing={2}>
            {worksWith.map((w) => (
              <Grid item xs={12} md={4} key={w.path}>
                <Box component="button" type="button" onClick={() => nav(w.path)} sx={{ width: '100%', textAlign: 'left', bgcolor: '#FFFFFF', border: `1px solid ${M.faint}`, borderRadius: M.r.md, p: 2.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, transition: `border-color ${M.transition.fast}`, '&:hover': { borderColor: M.navy }, '&:focus-visible': { outline: `2px solid ${M.navy}`, outlineOffset: 2 } }}>
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: '1rem', color: M.dark, mb: 0.5 }}>{w.name}</Typography>
                    <Typography sx={{ fontSize: '0.875rem', color: M.slate }}>{w.desc}</Typography>
                  </Box>
                  <Box sx={{ color: M.navy, display: 'flex', flexShrink: 0 }}><ArrowForward sx={{ fontSize: 20 }} /></Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
      <Box sx={{ py: { xs: 10, md: 14 }, bgcolor: '#FFFFFF', textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography sx={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)', lineHeight: 1.15, fontWeight: 700, letterSpacing: '-0.025em', color: M.dark, mb: 3 }}>
            See how to identify, record, review and act in your operation.
          </Typography>
          <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', boxShadow: 'none', '&:hover': { bgcolor: M.navyMid, boxShadow: 'none' } }}>Book a demo</Button>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}><AssureRow /></Box>
        </Container>
      </Box>
    </MarketingLayout>
  )
}

/* ─── Figma 3.4 · Scheduling page ──────────────────────── */

function SchedulingPage() {
  const nav = useNavigate()
  const d = features['scheduling']
  const steps = [
    { n: '01', heading: d.detailSections[0].heading, body: d.detailSections[0].body, card: <RotaGridCard /> },
    { n: '02', heading: d.detailSections[1].heading, body: d.detailSections[1].body, card: <OpenCallsCard /> },
    { n: '03', heading: d.detailSections[2].heading, body: d.detailSections[2].body, card: <ProposedChangesCard /> },
  ]
  const worksWith = [
    { name: 'Workforce', desc: 'Staff, training and competency', path: '/features/workforce' },
    { name: 'Care Management', desc: 'Plans, notes, reviews and observations', path: '/features/care-management' },
    { name: 'Reporting', desc: 'Dashboards and evidence', path: '/features/reporting' },
  ]
  return (
    <MarketingLayout>
      <PageMeta
        title="Build rotas around real constraints | MeticleCare"
        description="Plan visits and shifts using the availability, staffing and operational information your team actually works with."
        canonicalPath="/features/scheduling"
        breadcrumbs={[
          { name: 'Home', path: '/' },
          { name: 'Platform', path: '/platform' },
          { name: 'Scheduling', path: '/features/scheduling' },
        ]}
      />
      <Box sx={{ background: 'linear-gradient(180deg, #EAF3FC 0%, #EBF3FC 100%)', pt: { xs: 11, md: 15 }, pb: 0 }}>
        <Container maxWidth="lg">
          <Stack direction="row" alignItems="center" spacing={1} sx={{ fontSize: '0.8125rem' }}>
            <Typography component="button" type="button" onClick={() => nav('/platform')} sx={{ border: 0, bgcolor: 'transparent', cursor: 'pointer', color: M.slate, fontSize: 'inherit', fontFamily: 'inherit', p: 0, '&:hover': { color: M.navy } }}>Platform</Typography>
            <Typography sx={{ color: M.slate }}>›</Typography>
            <Box sx={{ bgcolor: '#FFFFFF', border: `1px solid ${M.faint}`, borderRadius: 999, px: 1.5, py: 0.375 }}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: M.navy }}>Scheduling</Typography>
            </Box>
          </Stack>
        </Container>
      </Box>
      <Box sx={{ background: 'radial-gradient(640px 520px at 82% 220px, #D2E3F6 0%, rgba(210,227,246,0) 70%), linear-gradient(180deg, #EAF3FC 0%, #FFFFFF 100%)', py: { xs: 5, md: 8 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 8 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <EyebrowPill>Platform capability</EyebrowPill>
              <Typography sx={{ fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', lineHeight: 1.05, fontWeight: 700, letterSpacing: '-0.03em', color: M.dark, mb: 2.5 }}>
                {d.title}
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: '1.125rem', lineHeight: 1.65, mb: 2 }}>
                {d.intro}
              </Typography>
              <Typography sx={{ fontSize: '0.875rem', mb: 3 }}>
                <Typography component="span" sx={{ fontWeight: 600, color: M.dark }}>For </Typography>
                <Typography component="span" sx={{ color: M.slate }}>{d.audience}</Typography>
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', boxShadow: 'none', '&:hover': { bgcolor: M.navyMid, boxShadow: 'none' } }}>Book a demo</Button>
                <Button variant="outlined" onClick={() => nav('/platform')} sx={{ borderColor: '#C9D5E2', color: M.dark, fontWeight: 600, px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', bgcolor: '#FFFFFF', '&:hover': { borderColor: M.navy } }}>Explore all modules</Button>
              </Stack>
              <AssureRow />
            </Grid>
            <Grid item xs={12} md={6}>
              <CallScheduleCard />
            </Grid>
          </Grid>
        </Container>
      </Box>
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#FFFFFF' }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 4, md: 8 }} sx={{ mb: { xs: 4, md: 6 } }}>
            <Grid item xs={12} md={6}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: M.navy, mb: 1.5 }}>What your team can do</Typography>
              <Typography sx={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', lineHeight: 1.15, fontWeight: 700, letterSpacing: '-0.02em', color: M.dark }}>
                Rotas that reflect what&apos;s actually possible.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'flex-end' }}>
              <Typography sx={{ color: M.slate, fontSize: '1.05rem', lineHeight: 1.65 }}>
                Availability, leave and coverage gaps are visible while you plan — and a person reviews the rota before it&apos;s published.
              </Typography>
            </Grid>
          </Grid>
          <Grid container spacing={2}>
            {d.capabilities.map((cap) => (
              <Grid item xs={12} sm={6} md={2.4} key={cap}>
                <Box sx={{ height: '100%', p: 2.5, borderRadius: M.r.md, border: `1px solid ${M.faint}`, bgcolor: '#FFFFFF' }}>
                  <Check sx={{ color: M.navy, fontSize: 20, mb: 1.5 }} />
                  <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem', color: M.dark, lineHeight: 1.4 }}>{cap}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#FFFFFF' }}>
        <Container maxWidth="lg">
          <Stack spacing={{ xs: 8, md: 10 }}>
            {steps.map((s, i) => (
              <Grid container spacing={{ xs: 4, md: 8 }} alignItems="center" key={s.n}>
                <Grid item xs={12} md={6} order={{ xs: 1, md: i % 2 === 0 ? 1 : 2 }}>
                  <StepNo n={s.n} />
                  <Typography sx={{ fontSize: 'clamp(1.375rem, 2.5vw, 1.875rem)', fontWeight: 700, letterSpacing: '-0.02em', color: M.dark, mb: 2 }}>{s.heading}</Typography>
                  <Typography sx={{ color: M.slate, lineHeight: 1.75, fontSize: '1rem' }}>{s.body}</Typography>
                </Grid>
                <Grid item xs={12} md={6} order={{ xs: 2, md: i % 2 === 0 ? 2 : 1 }}>
                  <Box sx={{ bgcolor: M.paper, borderRadius: '20px', p: { xs: 3, md: 5 } }}>{s.card}</Box>
                </Grid>
              </Grid>
            ))}
          </Stack>
        </Container>
      </Box>
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
            <Typography sx={{ fontSize: 'clamp(1.375rem, 2.5vw, 1.875rem)', fontWeight: 700, letterSpacing: '-0.02em', color: M.dark }}>Works with</Typography>
            <Typography component="button" type="button" onClick={() => nav('/platform')} sx={{ border: 0, bgcolor: 'transparent', cursor: 'pointer', color: M.navy, fontWeight: 600, fontSize: '0.875rem', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 0.5, '&:hover': { textDecoration: 'underline' } }}>
              View all modules <ArrowForward sx={{ fontSize: 16 }} />
            </Typography>
          </Stack>
          <Grid container spacing={2}>
            {worksWith.map((w) => (
              <Grid item xs={12} md={4} key={w.path}>
                <Box component="button" type="button" onClick={() => nav(w.path)} sx={{ width: '100%', textAlign: 'left', bgcolor: '#FFFFFF', border: `1px solid ${M.faint}`, borderRadius: M.r.md, p: 2.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, transition: `border-color ${M.transition.fast}`, '&:hover': { borderColor: M.navy }, '&:focus-visible': { outline: `2px solid ${M.navy}`, outlineOffset: 2 } }}>
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: '1rem', color: M.dark, mb: 0.5 }}>{w.name}</Typography>
                    <Typography sx={{ fontSize: '0.875rem', color: M.slate }}>{w.desc}</Typography>
                  </Box>
                  <Box sx={{ color: M.navy, display: 'flex', flexShrink: 0 }}><ArrowForward sx={{ fontSize: 20 }} /></Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
      <Box sx={{ py: { xs: 10, md: 14 }, bgcolor: '#FFFFFF', textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography sx={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)', lineHeight: 1.15, fontWeight: 700, letterSpacing: '-0.025em', color: M.dark, mb: 3 }}>
            See how to build rotas around real constraints in your operation.
          </Typography>
          <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', boxShadow: 'none', '&:hover': { bgcolor: M.navyMid, boxShadow: 'none' } }}>Book a demo</Button>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}><AssureRow /></Box>
        </Container>
      </Box>
    </MarketingLayout>
  )
}

/* ─── Figma 3.3 · Workforce page ───────────────────────── */

function WorkforcePage() {
  const nav = useNavigate()
  const d = features['workforce']
  const steps = [
    { n: '01', heading: d.detailSections[0].heading, body: d.detailSections[0].body, card: <StaffProfileCard /> },
    { n: '02', heading: d.detailSections[1].heading, body: d.detailSections[1].body, card: <TrainingMatrixCard /> },
    { n: '03', heading: d.detailSections[2].heading, body: d.detailSections[2].body, card: <AvailabilityCard /> },
  ]
  const worksWith = [
    { name: 'Scheduling', desc: 'Rota planning and open calls', path: '/features/scheduling' },
    { name: 'Reporting', desc: 'Dashboards and evidence', path: '/features/reporting' },
    { name: 'Care Management', desc: 'Plans, notes, reviews and observations', path: '/features/care-management' },
  ]
  return (
    <MarketingLayout>
      <PageMeta
        title="Manage the people who deliver care | MeticleCare"
        description="Connect staff information, training, competency, availability and work allocation."
        canonicalPath="/features/workforce"
        breadcrumbs={[
          { name: 'Home', path: '/' },
          { name: 'Platform', path: '/platform' },
          { name: 'Workforce', path: '/features/workforce' },
        ]}
      />
      <Box sx={{ background: 'linear-gradient(180deg, #EAF3FC 0%, #EBF3FC 100%)', pt: { xs: 11, md: 15 }, pb: 0 }}>
        <Container maxWidth="lg">
          <Stack direction="row" alignItems="center" spacing={1} sx={{ fontSize: '0.8125rem' }}>
            <Typography component="button" type="button" onClick={() => nav('/platform')} sx={{ border: 0, bgcolor: 'transparent', cursor: 'pointer', color: M.slate, fontSize: 'inherit', fontFamily: 'inherit', p: 0, '&:hover': { color: M.navy } }}>Platform</Typography>
            <Typography sx={{ color: M.slate }}>›</Typography>
            <Box sx={{ bgcolor: '#FFFFFF', border: `1px solid ${M.faint}`, borderRadius: 999, px: 1.5, py: 0.375 }}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: M.navy }}>Workforce</Typography>
            </Box>
          </Stack>
        </Container>
      </Box>
      <Box sx={{ background: 'radial-gradient(640px 520px at 82% 220px, #D2E3F6 0%, rgba(210,227,246,0) 70%), linear-gradient(180deg, #EAF3FC 0%, #FFFFFF 100%)', py: { xs: 5, md: 8 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 8 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <EyebrowPill>Platform capability</EyebrowPill>
              <Typography sx={{ fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', lineHeight: 1.05, fontWeight: 700, letterSpacing: '-0.03em', color: M.dark, mb: 2.5 }}>
                {d.title}
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: '1.125rem', lineHeight: 1.65, mb: 2 }}>
                {d.intro}
              </Typography>
              <Typography sx={{ fontSize: '0.875rem', mb: 3 }}>
                <Typography component="span" sx={{ fontWeight: 600, color: M.dark }}>For </Typography>
                <Typography component="span" sx={{ color: M.slate }}>{d.audience}</Typography>
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', boxShadow: 'none', '&:hover': { bgcolor: M.navyMid, boxShadow: 'none' } }}>Book a demo</Button>
                <Button variant="outlined" onClick={() => nav('/platform')} sx={{ borderColor: '#C9D5E2', color: M.dark, fontWeight: 600, px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', bgcolor: '#FFFFFF', '&:hover': { borderColor: M.navy } }}>Explore all modules</Button>
              </Stack>
              <AssureRow />
            </Grid>
            <Grid item xs={12} md={6}>
              <StaffComplianceCard />
            </Grid>
          </Grid>
        </Container>
      </Box>
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#FFFFFF' }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 4, md: 8 }} sx={{ mb: { xs: 4, md: 6 } }}>
            <Grid item xs={12} md={6}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: M.navy, mb: 1.5 }}>What your team can do</Typography>
              <Typography sx={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', lineHeight: 1.15, fontWeight: 700, letterSpacing: '-0.02em', color: M.dark }}>
                Your team&apos;s skills, checks and availability together.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'flex-end' }}>
              <Typography sx={{ color: M.slate, fontSize: '1.05rem', lineHeight: 1.65 }}>
                Profiles, training, leave and reminders feed straight into work allocation, so planning starts from accurate information.
              </Typography>
            </Grid>
          </Grid>
          <Grid container spacing={2}>
            {d.capabilities.map((cap) => (
              <Grid item xs={12} sm={6} md={2.4} key={cap}>
                <Box sx={{ height: '100%', p: 2.5, borderRadius: M.r.md, border: `1px solid ${M.faint}`, bgcolor: '#FFFFFF' }}>
                  <Check sx={{ color: M.navy, fontSize: 20, mb: 1.5 }} />
                  <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem', color: M.dark, lineHeight: 1.4 }}>{cap}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#FFFFFF' }}>
        <Container maxWidth="lg">
          <Stack spacing={{ xs: 8, md: 10 }}>
            {steps.map((s, i) => (
              <Grid container spacing={{ xs: 4, md: 8 }} alignItems="center" key={s.n}>
                <Grid item xs={12} md={6} order={{ xs: 1, md: i % 2 === 0 ? 1 : 2 }}>
                  <StepNo n={s.n} />
                  <Typography sx={{ fontSize: 'clamp(1.375rem, 2.5vw, 1.875rem)', fontWeight: 700, letterSpacing: '-0.02em', color: M.dark, mb: 2 }}>{s.heading}</Typography>
                  <Typography sx={{ color: M.slate, lineHeight: 1.75, fontSize: '1rem' }}>{s.body}</Typography>
                </Grid>
                <Grid item xs={12} md={6} order={{ xs: 2, md: i % 2 === 0 ? 2 : 1 }}>
                  <Box sx={{ bgcolor: M.paper, borderRadius: '20px', p: { xs: 3, md: 5 } }}>{s.card}</Box>
                </Grid>
              </Grid>
            ))}
          </Stack>
        </Container>
      </Box>
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
            <Typography sx={{ fontSize: 'clamp(1.375rem, 2.5vw, 1.875rem)', fontWeight: 700, letterSpacing: '-0.02em', color: M.dark }}>Works with</Typography>
            <Typography component="button" type="button" onClick={() => nav('/platform')} sx={{ border: 0, bgcolor: 'transparent', cursor: 'pointer', color: M.navy, fontWeight: 600, fontSize: '0.875rem', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 0.5, '&:hover': { textDecoration: 'underline' } }}>
              View all modules <ArrowForward sx={{ fontSize: 16 }} />
            </Typography>
          </Stack>
          <Grid container spacing={2}>
            {worksWith.map((w) => (
              <Grid item xs={12} md={4} key={w.path}>
                <Box component="button" type="button" onClick={() => nav(w.path)} sx={{ width: '100%', textAlign: 'left', bgcolor: '#FFFFFF', border: `1px solid ${M.faint}`, borderRadius: M.r.md, p: 2.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, transition: `border-color ${M.transition.fast}`, '&:hover': { borderColor: M.navy }, '&:focus-visible': { outline: `2px solid ${M.navy}`, outlineOffset: 2 } }}>
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: '1rem', color: M.dark, mb: 0.5 }}>{w.name}</Typography>
                    <Typography sx={{ fontSize: '0.875rem', color: M.slate }}>{w.desc}</Typography>
                  </Box>
                  <Box sx={{ color: M.navy, display: 'flex', flexShrink: 0 }}><ArrowForward sx={{ fontSize: 20 }} /></Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
      <Box sx={{ py: { xs: 10, md: 14 }, bgcolor: '#FFFFFF', textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography sx={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)', lineHeight: 1.15, fontWeight: 700, letterSpacing: '-0.025em', color: M.dark, mb: 3 }}>
            See how to manage the people who deliver care in your operation.
          </Typography>
          <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', boxShadow: 'none', '&:hover': { bgcolor: M.navyMid, boxShadow: 'none' } }}>Book a demo</Button>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}><AssureRow /></Box>
        </Container>
      </Box>
    </MarketingLayout>
  )
}

/* ─── Figma 3.1 · Care Management page ─────────────────── */

function CareManagementPage() {
  const nav = useNavigate()
  const capabilities = features['care-management'].capabilities
  const steps = [
    { n: '01', heading: 'Connected care records', body: 'Every care note, review and observation links back to the person and their care plan. When a new staff member starts, they can understand the individual — not just their last shift.', card: <PersonRecordCard /> },
    { n: '02', heading: 'Mobile-first recording', body: 'Carers record care notes at the point of care — not from memory at the end of the day. The mobile app gives access to care plans, risk alerts and medication references before and during visits.', card: <DailyNoteCard /> },
    { n: '03', heading: 'Reviews and health observations', body: 'Track goals, health checks and reviews over time. Body mapping provides a visual record of changes. Everything connects to the person record and creates an auditable trail.', card: <ObservationsCard /> },
  ]
  const worksWith = [
    { name: 'Medication (eMAR)', desc: 'Administration records and audit trails', path: '/features/medication' },
    { name: 'Risk & Incidents', desc: 'Assessments, recording and follow-up', path: '/features/risk-management' },
    { name: 'Family Portal', desc: 'Authorised family access', path: '/features/family-portal' },
  ]
  return (
    <MarketingLayout>
      <PageMeta
        title="Care management that follows the person | MeticleCare"
        description="Keep care plans, notes, reviews, observations and appointments in one accessible record — always linked to the person."
        canonicalPath="/features/care-management"
        breadcrumbs={[
          { name: 'Home', path: '/' },
          { name: 'Platform', path: '/platform' },
          { name: 'Care Management', path: '/features/care-management' },
        ]}
      />
      {/* Breadcrumb */}
      <Box sx={{ background: 'linear-gradient(180deg, #EAF3FC 0%, #EBF3FC 100%)', pt: { xs: 11, md: 15 }, pb: 0 }}>
        <Container maxWidth="lg">
          <Stack direction="row" alignItems="center" spacing={1} sx={{ fontSize: '0.8125rem' }}>
            <Typography component="button" type="button" onClick={() => nav('/platform')} sx={{ border: 0, bgcolor: 'transparent', cursor: 'pointer', color: M.slate, fontSize: 'inherit', fontFamily: 'inherit', p: 0, '&:hover': { color: M.navy } }}>Platform</Typography>
            <Typography sx={{ color: M.slate }}>›</Typography>
            <Box sx={{ bgcolor: '#FFFFFF', border: `1px solid ${M.faint}`, borderRadius: 999, px: 1.5, py: 0.375 }}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: M.navy }}>Care Management</Typography>
            </Box>
          </Stack>
        </Container>
      </Box>
      {/* Hero */}
      <Box sx={{ background: 'radial-gradient(640px 520px at 82% 220px, #D2E3F6 0%, rgba(210,227,246,0) 70%), linear-gradient(180deg, #EAF3FC 0%, #FFFFFF 100%)', py: { xs: 5, md: 8 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 8 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <EyebrowPill>Platform capability</EyebrowPill>
              <Typography sx={{ fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', lineHeight: 1.05, fontWeight: 700, letterSpacing: '-0.03em', color: M.dark, mb: 2.5 }}>
                Care management that follows the person
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: '1.125rem', lineHeight: 1.65, mb: 2 }}>
                Keep care plans, notes, reviews, observations and appointments in one accessible record — always linked to the person.
              </Typography>
              <Typography sx={{ fontSize: '0.875rem', mb: 3 }}>
                <Typography component="span" sx={{ fontWeight: 600, color: M.dark }}>For </Typography>
                <Typography component="span" sx={{ color: M.slate }}>Registered managers, coordinators and care workers</Typography>
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', boxShadow: 'none', '&:hover': { bgcolor: M.navyMid, boxShadow: 'none' } }}>Book a demo</Button>
                <Button variant="outlined" onClick={() => nav('/platform')} sx={{ borderColor: '#C9D5E2', color: M.dark, fontWeight: 600, px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', bgcolor: '#FFFFFF', '&:hover': { borderColor: M.navy } }}>Explore all modules</Button>
              </Stack>
              <AssureRow />
            </Grid>
            <Grid item xs={12} md={6}>
              <CareRecordsCard />
            </Grid>
          </Grid>
        </Container>
      </Box>
      {/* Capabilities */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#FFFFFF' }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 4, md: 8 }} sx={{ mb: { xs: 4, md: 6 } }}>
            <Grid item xs={12} md={6}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: M.navy, mb: 1.5 }}>What your team can do</Typography>
              <Typography sx={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', lineHeight: 1.15, fontWeight: 700, letterSpacing: '-0.02em', color: M.dark }}>
                Everything about the person, in one record.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'flex-end' }}>
              <Typography sx={{ color: M.slate, fontSize: '1.05rem', lineHeight: 1.65 }}>
                Plans, notes, reviews and observations sit together, so whoever opens the record sees the full picture.
              </Typography>
            </Grid>
          </Grid>
          <Grid container spacing={2}>
            {capabilities.map((cap) => (
              <Grid item xs={12} sm={6} md={2.4} key={cap}>
                <Box sx={{ height: '100%', p: 2.5, borderRadius: M.r.md, border: `1px solid ${M.faint}`, bgcolor: '#FFFFFF' }}>
                  <Check sx={{ color: M.navy, fontSize: 20, mb: 1.5 }} />
                  <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem', color: M.dark, lineHeight: 1.4 }}>{cap}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
      {/* Steps */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#FFFFFF' }}>
        <Container maxWidth="lg">
          <Stack spacing={{ xs: 8, md: 10 }}>
            {steps.map((s, i) => (
              <Grid container spacing={{ xs: 4, md: 8 }} alignItems="center" key={s.n}>
                <Grid item xs={12} md={6} order={{ xs: 1, md: i % 2 === 0 ? 1 : 2 }}>
                  <StepNo n={s.n} />
                  <Typography sx={{ fontSize: 'clamp(1.375rem, 2.5vw, 1.875rem)', fontWeight: 700, letterSpacing: '-0.02em', color: M.dark, mb: 2 }}>{s.heading}</Typography>
                  <Typography sx={{ color: M.slate, lineHeight: 1.75, fontSize: '1rem' }}>{s.body}</Typography>
                </Grid>
                <Grid item xs={12} md={6} order={{ xs: 2, md: i % 2 === 0 ? 2 : 1 }}>
                  <Box sx={{ bgcolor: M.paper, borderRadius: '20px', p: { xs: 3, md: 5 } }}>{s.card}</Box>
                </Grid>
              </Grid>
            ))}
          </Stack>
        </Container>
      </Box>
      {/* Works with */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
            <Typography sx={{ fontSize: 'clamp(1.375rem, 2.5vw, 1.875rem)', fontWeight: 700, letterSpacing: '-0.02em', color: M.dark }}>Works with</Typography>
            <Typography component="button" type="button" onClick={() => nav('/platform')} sx={{ border: 0, bgcolor: 'transparent', cursor: 'pointer', color: M.navy, fontWeight: 600, fontSize: '0.875rem', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 0.5, '&:hover': { textDecoration: 'underline' } }}>
              View all modules <ArrowForward sx={{ fontSize: 16 }} />
            </Typography>
          </Stack>
          <Grid container spacing={2}>
            {worksWith.map((w) => (
              <Grid item xs={12} md={4} key={w.path}>
                <Box component="button" type="button" onClick={() => nav(w.path)} sx={{ width: '100%', textAlign: 'left', bgcolor: '#FFFFFF', border: `1px solid ${M.faint}`, borderRadius: M.r.md, p: 2.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, transition: `border-color ${M.transition.fast}`, '&:hover': { borderColor: M.navy }, '&:focus-visible': { outline: `2px solid ${M.navy}`, outlineOffset: 2 } }}>
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: '1rem', color: M.dark, mb: 0.5 }}>{w.name}</Typography>
                    <Typography sx={{ fontSize: '0.875rem', color: M.slate }}>{w.desc}</Typography>
                  </Box>
                  <Box sx={{ color: M.navy, display: 'flex', flexShrink: 0 }}><ArrowForward sx={{ fontSize: 20 }} /></Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
      {/* CTA */}
      <Box sx={{ py: { xs: 10, md: 14 }, bgcolor: '#FFFFFF', textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography sx={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)', lineHeight: 1.15, fontWeight: 700, letterSpacing: '-0.025em', color: M.dark, mb: 3 }}>
            See care management that follows the person in your operation.
          </Typography>
          <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', boxShadow: 'none', '&:hover': { bgcolor: M.navyMid, boxShadow: 'none' } }}>Book a demo</Button>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}><AssureRow /></Box>
        </Container>
      </Box>
    </MarketingLayout>
  )
}

/* ─── Figma 3.7 · Family Portal page ─────────────────── */

function FamilyHeroCard() {
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.lg, p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1.5 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>Family view</Typography>
        <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>Margaret W.</Typography>
      </Stack>
      <Box sx={{ bgcolor: '#EAFBF5', borderRadius: '12px', px: 1.75, py: 1.5, mb: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#03C6B1', flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: M.dark }}>Visit completed today</Typography>
        </Stack>
        <Typography sx={{ fontSize: '0.8125rem', color: M.dark, lineHeight: 1.6, mt: 0.75 }}>
          Margaret had a good morning. All tasks completed. Mood was positive.
        </Typography>
      </Box>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ py: 1 }}>
        <Box sx={{ px: 1.5, py: 1, borderRadius: 2, bgcolor: 'notice.muted.bg', textAlign: 'center', flexShrink: 0 }}>
          <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: M.slate, letterSpacing: '0.04em' }}>THU</Typography>
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: M.dark }}>10:00</Typography>
        </Box>
        <Box>
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: M.dark }}>Next visit tomorrow</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>Scheduled for 10:00 AM with Sarah M.</Typography>
        </Box>
      </Stack>
      <Typography sx={{ fontSize: '0.75rem', color: M.slate, mt: 1.5, pt: 1.5, borderTop: `1px solid ${M.faint}` }}>
        Shared by the service · read-only
      </Typography>
    </Box>
  )
}

function AccessControlCard() {
  const rows = [
    { name: 'Emma W.', sub: 'Daughter · secure link', badge: 'Active', bg: '#EAFBF5', color: '#087A55' },
    { name: 'David W.', sub: 'Son · secure link', badge: 'Active', bg: '#EAFBF5', color: '#087A55' },
    { name: 'Care updates', sub: 'Visit summaries and messages', badge: 'Shared', bg: '#EAF3FF', color: M.navy },
  ]
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.md, p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>Authorised access</Typography>
        <Badge label="Service-controlled" bg="#EDF1F6" color={M.slate} />
      </Stack>
      {rows.map((r) => (
        <Stack key={r.name} direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ py: 1.5, borderBottom: `1px solid ${M.faint}`, '&:last-child': { borderBottom: 0 } }}>
          <Box>
            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: M.dark }}>{r.name}</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>{r.sub}</Typography>
          </Box>
          <Badge label={r.badge} bg={r.bg} color={r.color} />
        </Stack>
      ))}
      <Typography sx={{ fontSize: '0.75rem', color: M.slate, mt: 1.5, pt: 1.5, borderTop: `1px solid ${M.faint}` }}>
        Nothing is published without the service&apos;s permission.
      </Typography>
    </Box>
  )
}

function FamilyUpdatesCard() {
  const rows = [
    { title: 'Visit summary', sub: 'Today 09:40 · morning visit completed', badge: 'Shared', bg: '#EAFBF5', color: '#087A55' },
    { title: 'Appointment', sub: 'Thu 14:00 · GP visit with Sarah M.', badge: 'Shared', bg: '#EAF3FF', color: M.navy },
    { title: 'Message from the care team', sub: 'Medication time moved to 12:30', badge: 'Shared', bg: '#EAF3FF', color: M.navy },
  ]
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.md, p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>Care information</Typography>
        <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>This week</Typography>
      </Stack>
      {rows.map((r) => (
        <Stack key={r.title} direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ py: 1.5, borderBottom: `1px solid ${M.faint}`, '&:last-child': { borderBottom: 0 } }}>
          <Box>
            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: M.dark }}>{r.title}</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>{r.sub}</Typography>
          </Box>
          <Badge label={r.badge} bg={r.bg} color={r.color} />
        </Stack>
      ))}
    </Box>
  )
}

function FeedbackChannelCard() {
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.md, p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>Feedback and communication</Typography>
        <Badge label="Two-way" bg="#D2FBF4" color={M.tealDeep} />
      </Stack>
      <Box sx={{ bgcolor: 'notice.muted.bg', borderRadius: '12px', px: 1.75, py: 1.5, mb: 1.5 }}>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: M.slate, mb: 0.5 }}>Emma W. · Yesterday</Typography>
        <Typography sx={{ fontSize: '0.875rem', color: M.dark, lineHeight: 1.6 }}>Thank you — the visit summaries really help us plan around Mum&apos;s week.</Typography>
      </Box>
      <Box sx={{ bgcolor: '#EAFBF5', borderRadius: '12px', px: 1.75, py: 1.5, mb: 1.5 }}>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: M.slate, mb: 0.5 }}>Care team · Today</Typography>
        <Typography sx={{ fontSize: '0.875rem', color: M.dark, lineHeight: 1.6 }}>You&apos;re welcome, Emma. We&apos;ll keep the summaries coming after each visit.</Typography>
      </Box>
      <Box sx={{ border: `1px solid ${M.faint}`, borderRadius: '12px', px: 1.75, py: 1.25 }}>
        <Typography sx={{ fontSize: '0.8125rem', color: M.slate }}>Write to the care team…</Typography>
      </Box>
    </Box>
  )
}

function FamilyPortalPage() {
  const nav = useNavigate()
  const d = features['family-portal']
  const steps = [
    { n: '01', heading: d.detailSections[0].heading, body: d.detailSections[0].body, card: <AccessControlCard /> },
    { n: '02', heading: d.detailSections[1].heading, body: d.detailSections[1].body, card: <FamilyUpdatesCard /> },
    { n: '03', heading: d.detailSections[2].heading, body: d.detailSections[2].body, card: <FeedbackChannelCard /> },
  ]
  const worksWith = [
    { name: 'Care Management', desc: 'Plans, notes, reviews and observations', path: '/features/care-management' },
    { name: 'Reporting', desc: 'Dashboards and evidence', path: '/features/reporting' },
    { name: 'AI Intelligence', desc: 'Summaries, detection and copilot', path: '/features/ai' },
  ]
  return (
    <MarketingLayout>
      <PageMeta
        title="Keep families connected to care | MeticleCare"
        description="Give authorised relatives a respectful, focused view of the information your service chooses to share."
        canonicalPath="/features/family-portal"
        breadcrumbs={[
          { name: 'Home', path: '/' },
          { name: 'Platform', path: '/platform' },
          { name: 'Family Portal', path: '/features/family-portal' },
        ]}
      />
      <Box sx={{ background: 'linear-gradient(180deg, #EAF3FC 0%, #EBF3FC 100%)', pt: { xs: 11, md: 15 }, pb: 0 }}>
        <Container maxWidth="lg">
          <Stack direction="row" alignItems="center" spacing={1} sx={{ fontSize: '0.8125rem' }}>
            <Typography component="button" type="button" onClick={() => nav('/platform')} sx={{ border: 0, bgcolor: 'transparent', cursor: 'pointer', color: M.slate, fontSize: 'inherit', fontFamily: 'inherit', p: 0, '&:hover': { color: M.navy } }}>Platform</Typography>
            <Typography sx={{ color: M.slate }}>›</Typography>
            <Box sx={{ bgcolor: '#FFFFFF', border: `1px solid ${M.faint}`, borderRadius: 999, px: 1.5, py: 0.375 }}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: M.navy }}>Family Portal</Typography>
            </Box>
          </Stack>
        </Container>
      </Box>
      <Box sx={{ background: 'radial-gradient(640px 520px at 82% 220px, #D2E3F6 0%, rgba(210,227,246,0) 70%), linear-gradient(180deg, #EAF3FC 0%, #FFFFFF 100%)', py: { xs: 5, md: 8 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 8 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <EyebrowPill>Platform capability</EyebrowPill>
              <Typography sx={{ fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', lineHeight: 1.05, fontWeight: 700, letterSpacing: '-0.03em', color: M.dark, mb: 2.5 }}>
                {d.title}
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: '1.125rem', lineHeight: 1.65, mb: 2 }}>
                {d.intro}
              </Typography>
              <Typography sx={{ fontSize: '0.875rem', mb: 3 }}>
                <Typography component="span" sx={{ fontWeight: 600, color: M.dark }}>For </Typography>
                <Typography component="span" sx={{ color: M.slate }}>{d.audience}</Typography>
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', boxShadow: 'none', '&:hover': { bgcolor: M.navyMid, boxShadow: 'none' } }}>Book a demo</Button>
                <Button variant="outlined" onClick={() => nav('/platform')} sx={{ borderColor: '#C9D5E2', color: M.dark, fontWeight: 600, px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', bgcolor: '#FFFFFF', '&:hover': { borderColor: M.navy } }}>Explore all modules</Button>
              </Stack>
              <AssureRow />
            </Grid>
            <Grid item xs={12} md={6}>
              <FamilyHeroCard />
            </Grid>
          </Grid>
        </Container>
      </Box>
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#FFFFFF' }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 4, md: 8 }} sx={{ mb: { xs: 4, md: 6 } }}>
            <Grid item xs={12} md={6}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: M.navy, mb: 1.5 }}>What your team can do</Typography>
              <Typography sx={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', lineHeight: 1.15, fontWeight: 700, letterSpacing: '-0.02em', color: M.dark }}>
                A respectful window into care, controlled by the service.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'flex-end' }}>
              <Typography sx={{ color: M.slate, fontSize: '1.05rem', lineHeight: 1.65 }}>
                Families see what the service chooses to share — visit summaries, appointment context and messages — and can reply through the same channel.
              </Typography>
            </Grid>
          </Grid>
          <Grid container spacing={2}>
            {d.capabilities.map((cap) => (
              <Grid item xs={12} sm={6} md={2.4} key={cap}>
                <Box sx={{ height: '100%', p: 2.5, borderRadius: M.r.md, border: `1px solid ${M.faint}`, bgcolor: '#FFFFFF' }}>
                  <Check sx={{ color: M.navy, fontSize: 20, mb: 1.5 }} />
                  <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem', color: M.dark, lineHeight: 1.4 }}>{cap}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#FFFFFF' }}>
        <Container maxWidth="lg">
          <Stack spacing={{ xs: 8, md: 10 }}>
            {steps.map((s, i) => (
              <Grid container spacing={{ xs: 4, md: 8 }} alignItems="center" key={s.n}>
                <Grid item xs={12} md={6} order={{ xs: 1, md: i % 2 === 0 ? 1 : 2 }}>
                  <StepNo n={s.n} />
                  <Typography sx={{ fontSize: 'clamp(1.375rem, 2.5vw, 1.875rem)', fontWeight: 700, letterSpacing: '-0.02em', color: M.dark, mb: 2 }}>{s.heading}</Typography>
                  <Typography sx={{ color: M.slate, lineHeight: 1.75, fontSize: '1rem' }}>{s.body}</Typography>
                </Grid>
                <Grid item xs={12} md={6} order={{ xs: 2, md: i % 2 === 0 ? 2 : 1 }}>
                  <Box sx={{ bgcolor: M.paper, borderRadius: '20px', p: { xs: 3, md: 5 } }}>{s.card}</Box>
                </Grid>
              </Grid>
            ))}
          </Stack>
        </Container>
      </Box>
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
            <Typography sx={{ fontSize: 'clamp(1.375rem, 2.5vw, 1.875rem)', fontWeight: 700, letterSpacing: '-0.02em', color: M.dark }}>Works with</Typography>
            <Typography component="button" type="button" onClick={() => nav('/platform')} sx={{ border: 0, bgcolor: 'transparent', cursor: 'pointer', color: M.navy, fontWeight: 600, fontSize: '0.875rem', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 0.5, '&:hover': { textDecoration: 'underline' } }}>
              View all modules <ArrowForward sx={{ fontSize: 16 }} />
            </Typography>
          </Stack>
          <Grid container spacing={2}>
            {worksWith.map((w) => (
              <Grid item xs={12} md={4} key={w.path}>
                <Box component="button" type="button" onClick={() => nav(w.path)} sx={{ width: '100%', textAlign: 'left', bgcolor: '#FFFFFF', border: `1px solid ${M.faint}`, borderRadius: M.r.md, p: 2.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, transition: `border-color ${M.transition.fast}`, '&:hover': { borderColor: M.navy }, '&:focus-visible': { outline: `2px solid ${M.navy}`, outlineOffset: 2 } }}>
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: '1rem', color: M.dark, mb: 0.5 }}>{w.name}</Typography>
                    <Typography sx={{ fontSize: '0.875rem', color: M.slate }}>{w.desc}</Typography>
                  </Box>
                  <Box sx={{ color: M.navy, display: 'flex', flexShrink: 0 }}><ArrowForward sx={{ fontSize: 20 }} /></Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
      <Box sx={{ py: { xs: 10, md: 14 }, bgcolor: '#FFFFFF', textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography sx={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)', lineHeight: 1.15, fontWeight: 700, letterSpacing: '-0.025em', color: M.dark, mb: 3 }}>
            Keep families connected to care in your operation.
          </Typography>
          <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', boxShadow: 'none', '&:hover': { bgcolor: M.navyMid, boxShadow: 'none' } }}>Book a demo</Button>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}><AssureRow /></Box>
        </Container>
      </Box>
    </MarketingLayout>
  )
}

/* ─── Figma 3.8 · AI Intelligence page ─────────────── */

function AIHeroCard() {
  const sources = [
    { label: 'Daily notes (12)', sub: 'linked' },
    { label: 'MAR exceptions (2)', sub: 'linked' },
    { label: 'Incident follow-ups (3)', sub: 'linked' },
  ]
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.lg, overflow: 'hidden' }}>
      <Box sx={{ p: { xs: 2.5, md: 3 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>Care summary · last 14 days</Typography>
          <Badge label="Assistive · review required" bg="#EDF1F6" color={M.slate} />
        </Stack>
        <Typography sx={{ fontSize: '0.875rem', color: M.dark, lineHeight: 1.65, mb: 2 }}>
          Margaret&apos;s mobility needs increased over the past two weeks. Consider reviewing her support plan and fall-risk assessment.
        </Typography>
        {sources.map((s) => (
          <Stack key={s.label} direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ py: 1.25, borderTop: `1px solid ${M.faint}` }}>
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: M.dark }}>{s.label}</Typography>
            <Badge label={s.sub} bg="#EAF3FF" color={M.navy} />
          </Stack>
        ))}
      </Box>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: { xs: 2.5, md: 3 }, py: 2, bgcolor: '#FFF7E6' }}>
        <Box sx={{ width: 3, height: 32, borderRadius: 1, bgcolor: '#9A6700', flexShrink: 0 }} />
        <Box>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#9A6700' }}>Risk signal</Typography>
          <Typography sx={{ fontSize: '0.8125rem', color: M.dark }}>3 missed calls this week — pattern detected</Typography>
        </Box>
      </Stack>
    </Box>
  )
}

function CareSummaryCard() {
  const points = [
    { text: 'Mobility declining — 4 fall-risk mentions in notes', sub: 'Daily notes · linked' },
    { text: 'Omeprazole refused twice — both followed up', sub: 'MAR exceptions · linked' },
    { text: '1 fall reported — action owner assigned', sub: 'Incidents · linked' },
  ]
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.md, p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>Care summary</Typography>
        <Stack direction="row" spacing={0.75}>
          {['7', '14', '30'].map((p) => (
            <Box key={p} sx={{ px: 1.25, py: 0.375, borderRadius: 999, bgcolor: p === '14' ? M.navy : '#EDF1F6' }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: p === '14' ? '#FFFFFF' : M.slate }}>{p}d</Typography>
            </Box>
          ))}
        </Stack>
      </Stack>
      {points.map((pt) => (
        <Stack key={pt.text} direction="row" spacing={1.5} alignItems="flex-start" sx={{ py: 1.5, borderBottom: `1px solid ${M.faint}`, '&:last-child': { borderBottom: 0 } }}>
          <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: '#EAFBF5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.25 }}>
            <Check sx={{ color: '#087A55', fontSize: 14 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.875rem', color: M.dark, lineHeight: 1.55 }}>{pt.text}</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: M.navy, fontWeight: 600, mt: 0.25 }}>{pt.sub}</Typography>
          </Box>
        </Stack>
      ))}
    </Box>
  )
}

function ChangeSummaryCard() {
  const rows = [
    { record: 'Care notes', first: '24', second: '31' },
    { record: 'Incidents', first: '1', second: '3' },
    { record: 'MAR exceptions', first: '0', second: '2' },
  ]
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.md, p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 2 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>Record changes · Oct</Typography>
        <Badge label="Date-bound query" bg="#EAF3FF" color={M.navy} />
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', alignItems: 'center', rowGap: 1.5 }}>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: M.slate }}>Record</Typography>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: M.slate, textAlign: 'right' }}>1–15 Oct</Typography>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: M.slate, textAlign: 'right' }}>16–30 Oct</Typography>
        {rows.map((r) => [
          <Typography key={`${r.record}-r`} sx={{ fontSize: '0.875rem', fontWeight: 600, color: M.dark }}>{r.record}</Typography>,
          <Typography key={`${r.record}-f`} sx={{ fontSize: '0.875rem', color: M.dark, textAlign: 'right' }}>{r.first}</Typography>,
          <Typography key={`${r.record}-s`} sx={{ fontSize: '0.875rem', fontWeight: 700, color: M.dark, textAlign: 'right' }}>{r.second}</Typography>,
        ])}
      </Box>
      <Typography sx={{ fontSize: '0.75rem', color: M.slate, mt: 2, pt: 1.5, borderTop: `1px solid ${M.faint}` }}>
        Not a learned baseline — a slow drift inside every period shown will not stand out.
      </Typography>
    </Box>
  )
}

function CopilotCard() {
  const answers = [
    { title: '4 supervisions overdue', sub: 'Workforce · due before month end' },
    { title: '2 training gaps', sub: 'Moving & handling refreshers' },
    { title: '3 open actions', sub: 'From incident follow-ups' },
  ]
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', border: `1px solid ${M.faint}`, boxShadow: M.shadow.md, p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark }}>Compliance copilot</Typography>
        <Badge label="Review required" bg="#EDF1F6" color={M.slate} />
      </Stack>
      <Box sx={{ bgcolor: 'notice.muted.bg', borderRadius: '12px', px: 1.75, py: 1.25, mb: 1.5 }}>
        <Typography sx={{ fontSize: '0.8125rem', color: M.dark }}>What needs attention before inspection?</Typography>
      </Box>
      {answers.map((a) => (
        <Stack key={a.title} direction="row" spacing={1.5} alignItems="center" sx={{ py: 1.25, borderBottom: `1px solid ${M.faint}` }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: M.navy, flexShrink: 0 }} />
          <Box>
            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: M.dark }}>{a.title}</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: M.slate }}>{a.sub}</Typography>
          </Box>
        </Stack>
      ))}
      <Box sx={{ border: `1px solid ${M.faint}`, borderRadius: '12px', px: 1.75, py: 1.25, mt: 1.5 }}>
        <Typography sx={{ fontSize: '0.8125rem', color: M.slate }}>Ask a follow-up…</Typography>
      </Box>
    </Box>
  )
}

function AIPage() {
  const nav = useNavigate()
  const d = features['ai']
  const steps = [
    { n: '01', heading: d.detailSections[0].heading, body: d.detailSections[0].body, card: <CareSummaryCard /> },
    { n: '02', heading: d.detailSections[1].heading, body: d.detailSections[1].body, card: <ChangeSummaryCard /> },
    { n: '03', heading: d.detailSections[2].heading, body: d.detailSections[2].body, card: <CopilotCard /> },
  ]
  const worksWith = [
    { name: 'Reporting', desc: 'Dashboards and evidence', path: '/features/reporting' },
    { name: 'Care Management', desc: 'Plans, notes, reviews and observations', path: '/features/care-management' },
    { name: 'Compliance', desc: 'Readiness, every day', path: '/compliance' },
  ]
  return (
    <MarketingLayout>
      <PageMeta
        title="MeticleCare Intelligence | MeticleCare"
        description="AI assistance designed to reduce administration and surface patterns while keeping human judgement, permissions and auditability at the centre."
        canonicalPath="/features/ai"
        breadcrumbs={[
          { name: 'Home', path: '/' },
          { name: 'Platform', path: '/platform' },
          { name: 'AI Intelligence', path: '/features/ai' },
        ]}
      />
      <Box sx={{ background: 'linear-gradient(180deg, #EAF3FC 0%, #EBF3FC 100%)', pt: { xs: 11, md: 15 }, pb: 0 }}>
        <Container maxWidth="lg">
          <Stack direction="row" alignItems="center" spacing={1} sx={{ fontSize: '0.8125rem' }}>
            <Typography component="button" type="button" onClick={() => nav('/platform')} sx={{ border: 0, bgcolor: 'transparent', cursor: 'pointer', color: M.slate, fontSize: 'inherit', fontFamily: 'inherit', p: 0, '&:hover': { color: M.navy } }}>Platform</Typography>
            <Typography sx={{ color: M.slate }}>›</Typography>
            <Box sx={{ bgcolor: '#FFFFFF', border: `1px solid ${M.faint}`, borderRadius: 999, px: 1.5, py: 0.375 }}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: M.navy }}>AI Intelligence</Typography>
            </Box>
          </Stack>
        </Container>
      </Box>
      <Box sx={{ background: 'radial-gradient(640px 520px at 82% 220px, #D2E3F6 0%, rgba(210,227,246,0) 70%), linear-gradient(180deg, #EAF3FC 0%, #FFFFFF 100%)', py: { xs: 5, md: 8 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 8 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <EyebrowPill>Platform capability</EyebrowPill>
              <Typography sx={{ fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', lineHeight: 1.05, fontWeight: 700, letterSpacing: '-0.03em', color: M.dark, mb: 2.5 }}>
                {d.title}
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: '1.125rem', lineHeight: 1.65, mb: 2 }}>
                {d.intro}
              </Typography>
              <Typography sx={{ fontSize: '0.875rem', mb: 3 }}>
                <Typography component="span" sx={{ fontWeight: 600, color: M.dark }}>For </Typography>
                <Typography component="span" sx={{ color: M.slate }}>{d.audience}</Typography>
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', boxShadow: 'none', '&:hover': { bgcolor: M.navyMid, boxShadow: 'none' } }}>Book a demo</Button>
                <Button variant="outlined" onClick={() => nav('/platform')} sx={{ borderColor: '#C9D5E2', color: M.dark, fontWeight: 600, px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', bgcolor: '#FFFFFF', '&:hover': { borderColor: M.navy } }}>Explore all modules</Button>
              </Stack>
              <AssureRow />
            </Grid>
            <Grid item xs={12} md={6}>
              <AIHeroCard />
            </Grid>
          </Grid>
        </Container>
      </Box>
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#FFFFFF' }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 4, md: 8 }} sx={{ mb: { xs: 4, md: 6 } }}>
            <Grid item xs={12} md={6}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: M.navy, mb: 1.5 }}>What your team can do</Typography>
              <Typography sx={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', lineHeight: 1.15, fontWeight: 700, letterSpacing: '-0.02em', color: M.dark }}>
                Less reading, same judgement.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'flex-end' }}>
              <Typography sx={{ color: M.slate, fontSize: '1.05rem', lineHeight: 1.65 }}>
                Summaries, change views and copilot answers reduce the reading load — every output links to source records and waits for a person to review.
              </Typography>
            </Grid>
          </Grid>
          <Grid container spacing={2}>
            {d.capabilities.map((cap) => (
              <Grid item xs={12} sm={6} md={2.4} key={cap}>
                <Box sx={{ height: '100%', p: 2.5, borderRadius: M.r.md, border: `1px solid ${M.faint}`, bgcolor: '#FFFFFF' }}>
                  <Check sx={{ color: M.navy, fontSize: 20, mb: 1.5 }} />
                  <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem', color: M.dark, lineHeight: 1.4 }}>{cap}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#FFFFFF' }}>
        <Container maxWidth="lg">
          <Stack spacing={{ xs: 8, md: 10 }}>
            {steps.map((s, i) => (
              <Grid container spacing={{ xs: 4, md: 8 }} alignItems="center" key={s.n}>
                <Grid item xs={12} md={6} order={{ xs: 1, md: i % 2 === 0 ? 1 : 2 }}>
                  <StepNo n={s.n} />
                  <Typography sx={{ fontSize: 'clamp(1.375rem, 2.5vw, 1.875rem)', fontWeight: 700, letterSpacing: '-0.02em', color: M.dark, mb: 2 }}>{s.heading}</Typography>
                  <Typography sx={{ color: M.slate, lineHeight: 1.75, fontSize: '1rem' }}>{s.body}</Typography>
                </Grid>
                <Grid item xs={12} md={6} order={{ xs: 2, md: i % 2 === 0 ? 2 : 1 }}>
                  <Box sx={{ bgcolor: M.paper, borderRadius: '20px', p: { xs: 3, md: 5 } }}>{s.card}</Box>
                </Grid>
              </Grid>
            ))}
          </Stack>
          <Box sx={{ mt: { xs: 6, md: 8 }, p: { xs: 2.5, md: 3 }, borderRadius: M.r.md, border: `1px solid ${M.faint}`, bgcolor: '#FFFFFF' }}>
            <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.dark, mb: 1 }}>{d.detailSections[3].heading}</Typography>
            <Typography sx={{ color: M.slate, lineHeight: 1.75, fontSize: '0.9375rem' }}>{d.detailSections[3].body}</Typography>
          </Box>
        </Container>
      </Box>
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
            <Typography sx={{ fontSize: 'clamp(1.375rem, 2.5vw, 1.875rem)', fontWeight: 700, letterSpacing: '-0.02em', color: M.dark }}>Works with</Typography>
            <Typography component="button" type="button" onClick={() => nav('/platform')} sx={{ border: 0, bgcolor: 'transparent', cursor: 'pointer', color: M.navy, fontWeight: 600, fontSize: '0.875rem', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 0.5, '&:hover': { textDecoration: 'underline' } }}>
              View all modules <ArrowForward sx={{ fontSize: 16 }} />
            </Typography>
          </Stack>
          <Grid container spacing={2}>
            {worksWith.map((w) => (
              <Grid item xs={12} md={4} key={w.path}>
                <Box component="button" type="button" onClick={() => nav(w.path)} sx={{ width: '100%', textAlign: 'left', bgcolor: '#FFFFFF', border: `1px solid ${M.faint}`, borderRadius: M.r.md, p: 2.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, transition: `border-color ${M.transition.fast}`, '&:hover': { borderColor: M.navy }, '&:focus-visible': { outline: `2px solid ${M.navy}`, outlineOffset: 2 } }}>
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: '1rem', color: M.dark, mb: 0.5 }}>{w.name}</Typography>
                    <Typography sx={{ fontSize: '0.875rem', color: M.slate }}>{w.desc}</Typography>
                  </Box>
                  <Box sx={{ color: M.navy, display: 'flex', flexShrink: 0 }}><ArrowForward sx={{ fontSize: 20 }} /></Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
      <Box sx={{ py: { xs: 10, md: 14 }, bgcolor: '#FFFFFF', textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography sx={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)', lineHeight: 1.15, fontWeight: 700, letterSpacing: '-0.025em', color: M.dark, mb: 3 }}>
            See assistive, auditable AI in your operation.
          </Typography>
          <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', boxShadow: 'none', '&:hover': { bgcolor: M.navyMid, boxShadow: 'none' } }}>Book a demo</Button>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}><AssureRow /></Box>
        </Container>
      </Box>
    </MarketingLayout>
  )
}

/* ─── Page Component ──────────────────────────────────── */

export default function FeaturePage() {
  const { slug } = useParams<{ slug: string }>()
  const nav = useNavigate()
  if ((slug || '') === 'care-management') return <CareManagementPage />
  if ((slug || '') === 'medication') return <MedicationPage />
  if ((slug || '') === 'workforce') return <WorkforcePage />
  if ((slug || '') === 'scheduling') return <SchedulingPage />
  if ((slug || '') === 'risk-management' || (slug || '') === 'incident-management') return <RiskPage />
  if ((slug || '') === 'reporting') return <ReportingPage />
  if ((slug || '') === 'family-portal') return <FamilyPortalPage />
  if ((slug || '') === 'ai') return <AIPage />
  const d = features[slug || ''] || features['care-management']

  return (
    <MarketingLayout>
      <PageMeta
        title={d.title}
        description={d.intro}
        canonicalPath={`/features/${slug}`}
        keywords={[`${slug} feature`, 'care management software', 'MeticleCare platform', 'UK care software']}
        breadcrumbs={[
          { name: 'Home', path: '/' },
          { name: 'Platform', path: '/platform' },
          { name: d.title.split(' ').slice(0, 3).join(' '), path: `/features/${slug}` },
        ]}
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: d.title,
          description: d.intro,
        }}
      />

      {/* Hero */}
      <Box sx={{ py: { xs: 10, md: 16 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <SectionLabel>Platform capability</SectionLabel>
              <Typography sx={{ fontSize: M.display.fontSize, lineHeight: M.display.lineHeight, fontWeight: M.display.fontWeight, letterSpacing: M.display.letterSpacing, mb: 3 }}>
                {d.title}
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, lineHeight: M.bodyLg.lineHeight, mb: 3 }}>
                {d.intro}
              </Typography>
              <Chip label={`For: ${d.audience}`} sx={{ bgcolor: `${d.color}12`, color: d.color, fontWeight: 600, fontSize: '0.78rem' }} />
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{
                transform: 'perspective(1000px) rotateY(-2deg) rotateX(1deg)',
                transition: 'transform 0.3s',
                '&:hover': { transform: 'perspective(1000px) rotateY(0deg) rotateX(0deg)' },
              }}>
                {d.mockup}
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Capabilities */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.card }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={5}>
              <SectionLabel>What your team can do</SectionLabel>
              <Typography sx={{ fontSize: M.h2.fontSize, fontWeight: M.h2.fontWeight, letterSpacing: M.h2.letterSpacing, mb: 2 }}>
                A clearer working view.
              </Typography>
              <Typography sx={{ color: M.slate, lineHeight: 1.7 }}>
                Each capability links to the person record and to other modules — so information is never isolated.
              </Typography>
            </Grid>
            <Grid item xs={12} md={7}>
              <Stack spacing={2}>
                {d.capabilities.map((cap) => (
                  <Box key={cap} sx={{ p: 2.5, borderRadius: M.r.md, border: `1px solid ${M.faint}`,  }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Check sx={{ color: d.color, fontSize: 18 }} />
                      <Typography sx={{ fontWeight: 600, fontSize: '0.95rem' }}>{cap}</Typography>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Detail sections */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Stack spacing={6}>
            {d.detailSections.map((section, i) => (
              <Grid container spacing={{ xs: 4, md: 8 }} alignItems="center" key={i}>
                <Grid item xs={12} md={i % 2 === 0 ? 5 : 7} order={{ xs: 1, md: i % 2 === 0 ? 1 : 2 }}>
                  <Typography sx={{ fontSize: M.h2.fontSize, fontWeight: M.h2.fontWeight, letterSpacing: M.h2.letterSpacing, mb: 2 }}>
                    {section.heading}
                  </Typography>
                  <Typography sx={{ color: M.slate, lineHeight: 1.75, fontSize: '1rem' }}>
                    {section.body}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={i % 2 === 0 ? 7 : 5} order={{ xs: 2, md: i % 2 === 0 ? 2 : 1 }}>
                  <Box sx={{ p: 4, bgcolor: M.card, borderRadius: M.r.xl, border: `1px solid ${M.faint}` }}>
                    <Typography sx={{ fontSize: '3rem', fontWeight: 600, color: d.color, opacity: 0.15, mb: 1 }}>{String(i + 1).padStart(2, '0')}</Typography>
                    <Typography sx={{ fontWeight: 600, fontSize: '1.05rem', mb: 1 }}>{section.heading}</Typography>
                    <Typography sx={{ color: M.slate, fontSize: '0.9rem', lineHeight: 1.65 }}>
                      {section.body}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* CTA */}
      <Box sx={{ py: { xs: 10, md: 14 }, bgcolor: M.navy, textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing, color: M.card, mb: 2 }}>
            See {d.title.toLowerCase()} in your operation.
          </Typography>
          <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.teal, color: M.ink, fontWeight: 600, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', '&:hover': { bgcolor: M.tealDark } }}>Book a demo</Button>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
