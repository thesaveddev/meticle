import { Box, Button, Container, Grid, Stack, Typography, Chip } from '@mui/material'
import {
  ArrowForward, Check, Groups, Medication, People, CalendarMonth,
  Warning, Insights, FamilyRestroom, Shield, AutoAwesome,
  CheckCircle, AccessTime, Person,
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

function CareDeliveryMockup() {
  return (
    <Box sx={{ p: 2.5, bgcolor: '#F8FAFC', borderRadius: 2, border: '1px solid #E2E8F0' }}>
      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#1E293B', mb: 1.5 }}>Care Records</Typography>
      {['Margaret Wilson — Support Plan Review', 'John Davies — Daily Note', 'Patricia Lewis — Health Observation', 'Robert Hughes — Body Map Update'].map((item, i) => (
        <Stack key={i} direction="row" alignItems="center" spacing={1.5} sx={{ py: 1, borderBottom: i < 3 ? '1px solid #E2E8F0' : 'none' }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: i === 0 ? '#6366F1' : '#CBD5E1', flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>{item}</Typography>
        </Stack>
      ))}
    </Box>
  )
}

function MedicationMockup() {
  const meds = [
    { name: 'Metformin 500mg', time: '08:00', status: 'given', color: '#22C55E' },
    { name: 'Amlodipine 5mg', time: '08:00', status: 'given', color: '#22C55E' },
    { name: 'Omeprazole 20mg', time: '12:00', status: 'due', color: '#F59E0B' },
    { name: 'Paracetamol 500mg', time: '14:00', status: 'pending', color: '#94A3B8' },
  ]
  return (
    <Box sx={{ p: 2.5, bgcolor: '#FFFBEB', borderRadius: 2, border: '1px solid #FEF3C7' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#92400E' }}>Medication Record</Typography>
        <Chip label="MAR" size="small" sx={{ bgcolor: '#FDE68A', color: '#92400E', fontWeight: 700, fontSize: '0.65rem', height: 20 }} />
      </Stack>
      {meds.map((m, i) => (
        <Stack key={i} direction="row" alignItems="center" spacing={1.5} sx={{ py: 1, borderBottom: i < meds.length - 1 ? '1px solid #FEF3C7' : 'none' }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: m.color, flexShrink: 0 }} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#78350F' }}>{m.name}</Typography>
            <Typography sx={{ fontSize: '0.6rem', color: '#A16207' }}>{m.time}</Typography>
          </Box>
          <Chip label={m.status} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: m.color + '20', color: m.color, fontWeight: 600 }} />
        </Stack>
      ))}
    </Box>
  )
}

function WorkforceMockup() {
  const staff = [
    { name: 'Sarah M.', role: 'Senior Carer', compliance: 98, color: '#22C55E' },
    { name: 'James K.', role: 'Care Worker', compliance: 85, color: '#F59E0B' },
    { name: 'Priya S.', role: 'Care Worker', compliance: 72, color: '#EF4444' },
  ]
  return (
    <Box sx={{ p: 2.5, bgcolor: '#FDF2F8', borderRadius: 2, border: '1px solid #FCE7F3' }}>
      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#9D174D', mb: 1.5 }}>Staff Compliance</Typography>
      {staff.map((s, i) => (
        <Stack key={i} direction="row" alignItems="center" spacing={1.5} sx={{ py: 1, borderBottom: i < staff.length - 1 ? '1px solid #FCE7F3' : 'none' }}>
          <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: s.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Person sx={{ fontSize: 14, color: s.color }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#831843' }}>{s.name}</Typography>
            <Typography sx={{ fontSize: '0.6rem', color: '#9D174D' }}>{s.role}</Typography>
          </Box>
          <Box sx={{ width: 50, height: 4, bgcolor: '#FCE7F3', borderRadius: 2, overflow: 'hidden' }}>
            <Box sx={{ width: `${s.compliance}%`, height: '100%', bgcolor: s.color, borderRadius: 2 }} />
          </Box>
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: s.color, minWidth: 30, textAlign: 'right' }}>{s.compliance}%</Typography>
        </Stack>
      ))}
    </Box>
  )
}

function ScheduleMockup() {
  const calls = [
    { time: '09:00', client: 'Margaret W.', carer: 'Sarah M.', status: 'completed', color: '#22C55E' },
    { time: '10:30', client: 'John D.', carer: 'James K.', status: 'en route', color: '#7C3AED' },
    { time: '11:00', client: 'Patricia L.', carer: null, status: 'unassigned', color: '#F59E0B' },
    { time: '13:00', client: 'Robert H.', carer: 'Priya S.', status: 'scheduled', color: '#94A3B8' },
  ]
  return (
    <Box sx={{ p: 2.5, bgcolor: '#F0FDF4', borderRadius: 2, border: '1px solid #DCFCE7' }}>
      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#166534', mb: 1.5 }}>Call Schedule</Typography>
      {calls.map((c, i) => (
        <Stack key={i} direction="row" alignItems="center" spacing={1.5} sx={{ py: 1, borderBottom: i < calls.length - 1 ? '1px solid #DCFCE7' : 'none' }}>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#166534', minWidth: 40 }}>{c.time}</Typography>
          <Box sx={{ width: 3, height: 24, bgcolor: c.color, borderRadius: 1, flexShrink: 0 }} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#14532D' }}>{c.client}</Typography>
            <Typography sx={{ fontSize: '0.6rem', color: '#166534' }}>{c.carer || 'No carer assigned'}</Typography>
          </Box>
          <Chip label={c.status} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: c.color + '20', color: c.color, fontWeight: 600 }} />
        </Stack>
      ))}
    </Box>
  )
}

function RiskMockup() {
  const items = [
    { title: 'Fall risk — high', status: 'assessed', color: '#EF4444' },
    { title: 'Medication allergy — penicillin', status: 'recorded', color: '#F59E0B' },
    { title: 'Safeguarding — resolved', status: 'closed', color: '#22C55E' },
  ]
  return (
    <Box sx={{ p: 2.5, bgcolor: '#FEF2F2', borderRadius: 2, border: '1px solid #FECACA' }}>
      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#991B1B', mb: 1.5 }}>Risk Assessments</Typography>
      {items.map((inc, i) => (
        <Stack key={i} direction="row" alignItems="center" spacing={1.5} sx={{ py: 1, borderBottom: i < items.length - 1 ? '1px solid #FECACA' : 'none' }}>
          <Warning sx={{ fontSize: 14, color: inc.color, flexShrink: 0 }} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#7F1D1D' }}>{inc.title}</Typography>
            <Typography sx={{ fontSize: '0.55rem', color: '#991B1B' }}>{inc.status}</Typography>
          </Box>
        </Stack>
      ))}
    </Box>
  )
}

function ComplianceMockup() {
  const items = [
    { label: 'DBS Checks', pct: 100, color: '#22C55E' },
    { label: 'Mandatory Training', pct: 87, color: '#F59E0B' },
    { label: 'Right to Work', pct: 95, color: '#22C55E' },
    { label: 'Competency', pct: 68, color: '#EF4444' },
  ]
  return (
    <Box sx={{ p: 2.5, bgcolor: '#F5F3FF', borderRadius: 2, border: '1px solid #EDE9FE' }}>
      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#5B21B6', mb: 1.5 }}>Compliance Dashboard</Typography>
      {items.map((item, i) => (
        <Box key={i} sx={{ py: 1, borderBottom: i < items.length - 1 ? '1px solid #EDE9FE' : 'none' }}>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#5B21B6' }}>{item.label}</Typography>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: item.color }}>{item.pct}%</Typography>
          </Stack>
          <Box sx={{ height: 4, bgcolor: '#EDE9FE', borderRadius: 2, overflow: 'hidden' }}>
            <Box sx={{ width: `${item.pct}%`, height: '100%', bgcolor: item.color, borderRadius: 2 }} />
          </Box>
        </Box>
      ))}
    </Box>
  )
}

function ReportingMockup() {
  const metrics = [
    { label: 'Calls completed', value: '47', trend: '+12%', color: '#22C55E' },
    { label: 'Avg response', value: '23min', trend: '-8%', color: '#3B82F6' },
    { label: 'Satisfaction', value: '4.6/5', trend: '+0.2', color: '#8B5CF6' },
  ]
  return (
    <Box sx={{ p: 2.5, bgcolor: '#EFF6FF', borderRadius: 2, border: '1px solid #DBEAFE' }}>
      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#1E40AF', mb: 1.5 }}>Operational Insights</Typography>
      <Grid container spacing={1.5}>
        {metrics.map((m, i) => (
          <Grid item xs={4} key={i}>
            <Box sx={{ p: 1.5, bgcolor: 'white', borderRadius: 1.5, border: '1px solid #DBEAFE' }}>
              <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: m.color }}>{m.value}</Typography>
              <Typography sx={{ fontSize: '0.55rem', color: '#1E40AF' }}>{m.label}</Typography>
              <Typography sx={{ fontSize: '0.6rem', color: '#22C55E', fontWeight: 600, mt: 0.5 }}>{m.trend}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}

function FamilyMockup() {
  return (
    <Box sx={{ p: 2.5, bgcolor: '#F0FDFA', borderRadius: 2, border: '1px solid #99F6E4' }}>
      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#134E4A', mb: 1.5 }}>Family View</Typography>
      <Box sx={{ p: 1.5, bgcolor: 'white', borderRadius: 1.5, border: '1px solid #99F6E4', mb: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <CheckCircle sx={{ fontSize: 14, color: '#22C55E' }} />
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#134E4A' }}>Visit completed today</Typography>
        </Stack>
        <Typography sx={{ fontSize: '0.6rem', color: '#5F7A7A', mt: 0.5 }}>Margaret had a good morning. All tasks completed.</Typography>
      </Box>
      <Box sx={{ p: 1.5, bgcolor: 'white', borderRadius: 1.5, border: '1px solid #99F6E4' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <AccessTime sx={{ fontSize: 14, color: '#F59E0B' }} />
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#134E4A' }}>Next visit tomorrow</Typography>
        </Stack>
      </Box>
    </Box>
  )
}

function AIMockup() {
  return (
    <Box sx={{ p: 2.5, bgcolor: '#FAF5FF', borderRadius: 2, border: '1px solid #E9D5FF' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <AutoAwesome sx={{ fontSize: 14, color: '#9333EA' }} />
        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#6B21A8' }}>AI Intelligence</Typography>
      </Stack>
      <Box sx={{ p: 1.5, bgcolor: 'white', borderRadius: 1.5, border: '1px solid #E9D5FF', mb: 1 }}>
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: '#6B21A8', mb: 0.5 }}>Care Summary</Typography>
        <Typography sx={{ fontSize: '0.6rem', color: '#581C87', lineHeight: 1.5 }}>Margaret's care needs have increased. Consider reviewing her support plan.</Typography>
      </Box>
      <Box sx={{ p: 1.5, bgcolor: 'white', borderRadius: 1.5, border: '1px solid #E9D5FF' }}>
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: '#6B21A8', mb: 0.5 }}>Risk Signal</Typography>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Warning sx={{ fontSize: 12, color: '#F59E0B' }} />
          <Typography sx={{ fontSize: '0.6rem', color: '#581C87' }}>3 missed calls — pattern detected</Typography>
        </Stack>
      </Box>
    </Box>
  )
}

const mockupsBySlug: Record<string, React.ReactNode> = {
  'care-management': <CareDeliveryMockup />,
  'medication': <MedicationMockup />,
  'workforce': <WorkforceMockup />,
  'scheduling': <ScheduleMockup />,
  'risk-management': <RiskMockup />,
  'incident-management': <RiskMockup />,
  'compliance': <ComplianceMockup />,
  'reporting': <ReportingMockup />,
  'family-portal': <FamilyMockup />,
  'ai': <AIMockup />,
}

/* ─── Feature definitions ────────────────────────────── */

const features: Record<string, FeatureData> = {
  'care-management': {
    title: 'Care management that follows the person',
    intro: 'Keep care plans, notes, reviews, observations and appointments in one accessible record — always linked to the person.',
    audience: 'Registered managers, coordinators and care workers',
    color: '#6366F1',
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
    color: '#EC4899',
    icon: People,
    capabilities: ['Staff directory and profiles', 'Training and competency tracking', 'Availability, leave and approvals', 'Right-to-work and DBS reminders', 'Connected workforce reporting'],
    detailSections: [
      { heading: 'Staff profiles and compliance', body: 'Every staff member has a profile with training records, competency assessments, right-to-work documents and DBS checks. Non-compliance is flagged before staff are assigned to shifts.' },
      { heading: 'Training and competency', body: 'Track mandatory training, specialist courses and competency assessments. Expiry dates generate alerts. The compliance dashboard shows the organisation-wide position at a glance.' },
      { heading: 'Availability and leave', body: 'Staff submit availability up to 4 months ahead. Managers approve leave, see coverage impact and use the shift marketplace to fill gaps. Everything connects to the rota.' },
    ],
    mockup: mockupsBySlug['workforce'],
  },
  'scheduling': {
    title: 'Build rotas around real constraints',
    intro: 'Plan visits and shifts using the availability, staffing and operational information your team actually works with.',
    audience: 'Care coordinators and registered managers',
    color: '#22C55E',
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
    color: '#F97066',
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
    color: '#F97066',
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
    color: '#8B5CF6',
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
    color: '#0EA5E9',
    icon: Insights,
    capabilities: ['Operational reporting', 'Care and workforce oversight', 'Compliance reporting', 'Homecare call reporting', 'Exportable evidence workflows'],
    detailSections: [
      { heading: 'Operational dashboards', body: 'See call completion rates, missed visits, training compliance and staffing levels in real time. Drill down from organisation-wide views to individual carers or people.' },
      { heading: 'Care and workforce reporting', body: 'Reports connect care data with workforce information. Understand the relationship between staffing, care quality and outcomes.' },
      { heading: 'Evidence workflows', body: 'Export reports and evidence packs for inspections, governance reviews and board meetings. The data is already organised — you just need to present it.' },
    ],
    mockup: mockupsBySlug['reporting'],
  },
  'family-portal': {
    title: 'Keep families connected to care',
    intro: 'Give authorised relatives a respectful, focused view of the information your service chooses to share.',
    audience: 'Families, relatives and care teams',
    color: '#14B8A6',
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
    color: '#A855F7',
    icon: AutoAwesome,
    capabilities: ['AI-assisted care summaries', 'Change detection across records', 'Risk signals with source traceability', 'Compliance copilot and anomaly detection', 'Natural-language data assistant'],
    detailSections: [
      { heading: 'Care summaries', body: 'AI analyses authorised information over 7, 14 or 30-day periods and produces summaries linked to source records. Every statement is traceable to the underlying data.' },
      { heading: 'Change detection', body: 'Compare recent records with historical patterns. Surface meaningful changes — repeated incidents, shifts in observations, increased concerns, medication exceptions.' },
      { heading: 'Compliance copilot', body: 'Ask questions about your organisation\'s compliance position. The AI surfaces training gaps, overdue reviews, open actions and evidence that may need attention.' },
    ],
    mockup: mockupsBySlug['ai'],
  },
}

/* ─── Page Component ──────────────────────────────────── */

export default function FeaturePage() {
  const { slug } = useParams<{ slug: string }>()
  const nav = useNavigate()
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
              <Eyebrow color={d.color}>Platform capability</Eyebrow>
              <Typography sx={{ fontSize: M.display.fontSize, lineHeight: M.display.lineHeight, fontWeight: M.display.fontWeight, letterSpacing: M.display.letterSpacing, mb: 3 }}>
                {d.title}
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, lineHeight: M.bodyLg.lineHeight, mb: 3 }}>
                {d.intro}
              </Typography>
              <Chip label={`For: ${d.audience}`} sx={{ bgcolor: `${d.color}12`, color: d.color, fontWeight: 700, fontSize: '0.78rem' }} />
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
              <Eyebrow color={d.color}>What your team can do</Eyebrow>
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
                  <Box key={cap} sx={{ p: 2.5, borderRadius: M.r.md, border: `1px solid ${M.faint}`, borderLeft: `3px solid ${d.color}` }}>
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
                    <Typography sx={{ fontSize: '3rem', fontWeight: 800, color: d.color, opacity: 0.15, mb: 1 }}>{String(i + 1).padStart(2, '0')}</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', mb: 1 }}>{section.heading}</Typography>
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
      <Box sx={{ py: { xs: 10, md: 14 }, background: `linear-gradient(160deg, ${M.navy} 0%, #162032 50%, #1A2744 100%)`, textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing, color: M.card, mb: 2 }}>
            See {d.title.toLowerCase()} in your operation.
          </Typography>
          <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.teal, color: M.navy, fontWeight: 700, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', '&:hover': { bgcolor: M.tealDark } }}>Book a demo</Button>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
