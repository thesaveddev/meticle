import { Box, Button, Container, Grid, Stack, Typography, Chip } from '@mui/material'
import {
  ArrowForward, Check, Groups, Medication, People, CalendarMonth,
  Warning, Insights, FamilyRestroom, Shield,
  Description, LocationOn, AccessTime, Person, CheckCircle,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { M } from '../../styles/marketing-tokens'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'

/* ─── Shared ─────────────────────────────────────────── */

function SectionLabel({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <Box sx={{ mb: 1, textAlign: center ? "center" : "left" }}>
      <Typography component="span" sx={{ fontSize: "0.75rem", lineHeight: 1.3, fontWeight: 700, letterSpacing: "0.08em", color: M.tealDeep, borderBottom: "2px solid " + M.teal, pb: 0.5, textTransform: "uppercase" }}>{children}</Typography>
    </Box>
  )
}

/* ─── Module Mockup Components ──────────────────────────── */

function DashboardMockup() {
  return (
    <Box sx={{ p: 2.5, bgcolor: '#F8FAFC', borderRadius: 2, border: '1px solid #E2E8F0' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#1E293B' }}>Today's Coverage</Typography>
        <Chip label="92%" size="small" sx={{ bgcolor: '#DCFCE7', color: '#166534', fontWeight: 700, fontSize: '0.7rem', height: 22 }} />
      </Stack>
      <Box sx={{ height: 6, bgcolor: '#E2E8F0', borderRadius: 3, mb: 2, overflow: 'hidden' }}>
        <Box sx={{ width: '92%', height: '100%', bgcolor: '#22C55E', borderRadius: 3 }} />
      </Box>
      <Grid container spacing={1.5}>
        {[
          { label: 'Completed', value: '12', color: '#22C55E' },
          { label: 'In Progress', value: '3', color: '#3B82F6' },
          { label: 'Upcoming', value: '5', color: '#6B7280' },
          { label: 'Missed', value: '1', color: '#EF4444' },
        ].map(s => (
          <Grid item xs={6} key={s.label}>
            <Box sx={{ p: 1.5, bgcolor: 'white', borderRadius: 1.5, border: '1px solid #F1F5F9' }}>
              <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: s.color }}>{s.value}</Typography>
              <Typography sx={{ fontSize: '0.65rem', color: '#94A3B8' }}>{s.label}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}

function EMARMockup() {
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
    <Box sx={{ p: 2.5, bgcolor: M.tealSoft, borderRadius: 2, border: '1px solid ' + M.tealMuted }}>
      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: M.tealDeep, mb: 1.5 }}>Staff Compliance</Typography>
      {staff.map((s, i) => (
        <Stack key={i} direction="row" alignItems="center" spacing={1.5} sx={{ py: 1, borderBottom: i < staff.length - 1 ? '1px solid #FCE7F3' : 'none' }}>
          <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: s.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Person sx={{ fontSize: 14, color: s.color }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: M.tealDeep }}>{s.name}</Typography>
            <Typography sx={{ fontSize: '0.6rem', color: M.tealDeep }}>{s.role}</Typography>
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

function IncidentMockup() {
  const incidents = [
    { title: 'Fall risk assessment overdue', severity: 'high', status: 'open', color: '#EF4444' },
    { title: 'Medication error reported', severity: 'critical', status: 'investigating', color: '#DC2626' },
    { title: 'Safeguarding concern logged', severity: 'high', status: 'escalated', color: '#F59E0B' },
  ]
  return (
    <Box sx={{ p: 2.5, bgcolor: '#FEF2F2', borderRadius: 2, border: '1px solid #FECACA' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#991B1B' }}>Open Incidents</Typography>
        <Chip label="3 active" size="small" sx={{ bgcolor: '#FEE2E2', color: '#991B1B', fontWeight: 700, fontSize: '0.65rem', height: 20 }} />
      </Stack>
      {incidents.map((inc, i) => (
        <Stack key={i} direction="row" alignItems="center" spacing={1.5} sx={{ py: 1, borderBottom: i < incidents.length - 1 ? '1px solid #FECACA' : 'none' }}>
          <Warning sx={{ fontSize: 14, color: inc.color, flexShrink: 0 }} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#7F1D1D' }}>{inc.title}</Typography>
            <Typography sx={{ fontSize: '0.55rem', color: '#991B1B' }}>{inc.severity} · {inc.status}</Typography>
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
    { label: 'Competency Assessments', pct: 68, color: '#EF4444' },
  ]
  return (
    <Box sx={{ p: 2.5, bgcolor: M.tealSoft, borderRadius: 2, border: '1px solid ' + M.tealMuted }}>
      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: M.tealDeep, mb: 1.5 }}>Compliance Dashboard</Typography>
      {items.map((item, i) => (
        <Box key={i} sx={{ py: 1, borderBottom: i < items.length - 1 ? '1px solid #EDE9FE' : 'none' }}>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: M.tealDeep }}>{item.label}</Typography>
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
    { label: 'Calls completed today', value: '47', trend: '+12%', color: '#22C55E' },
    { label: 'Average response time', value: '23min', trend: '-8%', color: '#3B82F6' },
    { label: 'Client satisfaction', value: '4.6/5', trend: '+0.2', color: 'M.tealDeep' },
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

function FamilyPortalMockup() {
  return (
    <Box sx={{ p: 2.5, bgcolor: '#F0FDFA', borderRadius: 2, border: '1px solid #99F6E4' }}>
      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#134E4A', mb: 1.5 }}>Family View</Typography>
      <Box sx={{ p: 1.5, bgcolor: 'white', borderRadius: 1.5, border: '1px solid #99F6E4', mb: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <CheckCircle sx={{ fontSize: 14, color: '#22C55E' }} />
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#134E4A' }}>Visit completed today</Typography>
        </Stack>
        <Typography sx={{ fontSize: '0.6rem', color: '#5F7A7A', mt: 0.5 }}>Margaret had a good morning. All tasks completed. Mood was positive.</Typography>
      </Box>
      <Box sx={{ p: 1.5, bgcolor: 'white', borderRadius: 1.5, border: '1px solid #99F6E4' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <AccessTime sx={{ fontSize: 14, color: '#F59E0B' }} />
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#134E4A' }}>Next visit tomorrow</Typography>
        </Stack>
        <Typography sx={{ fontSize: '0.6rem', color: '#5F7A7A', mt: 0.5 }}>Scheduled for 10:00 AM with Sarah M.</Typography>
      </Box>
    </Box>
  )
}

function AIMockup() {
  return (
    <Box sx={{ p: 2.5, bgcolor: M.tealSoft, borderRadius: 2, border: '1px solid ' + M.tealMuted }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Insights sx={{ fontSize: 14, color: 'M.tealDeep' }} />
        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: M.tealDeep }}>AI Intelligence</Typography>
      </Stack>
      <Box sx={{ p: 1.5, bgcolor: 'white', borderRadius: 1.5, border: '1px solid ' + M.tealMuted, mb: 1 }}>
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: M.tealDeep, mb: 0.5 }}>Care Summary</Typography>
        <Typography sx={{ fontSize: '0.6rem', color: M.slate, lineHeight: 1.5 }}>Margaret's care needs have increased over the past week. Consider reviewing her support plan and increasing visit frequency.</Typography>
      </Box>
      <Box sx={{ p: 1.5, bgcolor: 'white', borderRadius: 1.5, border: '1px solid ' + M.tealMuted }}>
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: M.tealDeep, mb: 0.5 }}>Risk Signal</Typography>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Warning sx={{ fontSize: 12, color: '#F59E0B' }} />
          <Typography sx={{ fontSize: '0.6rem', color: M.slate }}>3 missed calls this week — pattern detected</Typography>
        </Stack>
      </Box>
    </Box>
  )
}

const mockups: Record<string, React.ReactNode> = {
  'Care Delivery': <DashboardMockup />,
  'Medication (eMAR)': <EMARMockup />,
  'Workforce Management': <WorkforceMockup />,
  'Scheduling & Rota': <ScheduleMockup />,
  'Risk & Incidents': <IncidentMockup />,
  'Compliance & Evidence': <ComplianceMockup />,
  'Reporting & Intelligence': <ReportingMockup />,
  'Family Portal': <FamilyPortalMockup />,
  'AI Intelligence': <AIMockup />,
}

/* ─── Full-width immersive modules ──────────────────── */

const modules = [
  {
    icon: Groups, title: 'Care Delivery', color: 'M.navy',
    desc: 'Keep care plans, daily notes, reviews, body maps, appointments and health observations in one accessible record — always linked to the person.',
    features: ['Person-centred support plans', 'Daily care notes and handover context', 'Body mapping and linked observations', 'Reviews, goals and health checks', 'Mobile access at the point of care'],
    tone: 'light' as const,
    link: '/features/care-management',
  },
  {
    icon: Medication, title: 'Medication (eMAR)', color: '#F59E0B',
    desc: 'Manage medication workflows where your service provides medication support — with clear permissions, administration records and an audit trail.',
    features: ['31-day medication administration records', 'Stock control and controlled-drug workflows', 'Exception recording and follow-up', 'Role-based access to medication data', 'Mobile reference and recording for field teams'],
    tone: 'warm' as const,
    link: '/features/medication',
  },
  {
    icon: People, title: 'Workforce Management', color: 'M.teal',
    desc: 'Connect staff information, training, competency, availability and work allocation into one operational view.',
    features: ['Staff directory and detailed profiles', 'Training and competency tracking', 'Availability, leave and approval workflows', 'Right-to-work and DBS reminders', 'Connected workforce reporting'],
    tone: 'light' as const,
    link: '/features/workforce',
  },
  {
    icon: CalendarMonth, title: 'Scheduling & Rota', color: '#22C55E',
    desc: 'Plan visits and shifts using availability, staffing and operational constraints — with human review before anything is published.',
    features: ['Rota and visit planning', 'Availability and leave awareness', 'Open-call marketplace for unfilled shifts', 'Conflict and coverage detection', 'Manager approval before publishing'],
    tone: 'warm' as const,
    link: '/features/scheduling',
  },
  {
    icon: Warning, title: 'Risk & Incidents', color: '#F97066',
    desc: 'Keep risk information visible, record incidents with follow-through and maintain the review history your governance requires.',
    features: ['Risk assessment records and review dates', 'Incident recording with severity context', 'Actions, owners and due dates', 'Escalation and follow-up history', 'Linked care-plan context'],
    tone: 'light' as const,
    link: '/features/risk-management',
  },
  {
    icon: Shield, title: 'Compliance & Evidence', color: 'M.tealDeep',
    desc: 'Make inspection readiness part of everyday work — not a once-a-year scramble for evidence.',
    features: ['Training and competency matrices', 'Evidence packs and audit logs', 'Compliance dashboards by nation', 'Identity and right-to-work monitoring', 'Policy and procedure management'],
    tone: 'warm' as const,
    link: '/compliance',
  },
  {
    icon: Insights, title: 'Reporting & Intelligence', color: '#0EA5E9',
    desc: 'Turn the records your team already keeps into operational reports, evidence and AI-assisted insight.',
    features: ['Operational dashboards and drill-downs', 'Care and workforce reporting', 'Homecare call and visit analytics', 'AI-assisted briefings and summaries', 'Exportable evidence workflows'],
    tone: 'light' as const,
    link: '/features/reporting',
  },
  {
    icon: FamilyRestroom, title: 'Family Portal', color: '#14B8A6',
    desc: 'Give authorised relatives a respectful, focused view of the information your service chooses to share.',
    features: ['Authorised portal access with secure links', 'Relevant care information and updates', 'Communication and feedback channels', 'Appointment and visit context', 'Access controlled entirely by the service'],
    tone: 'warm' as const,
    link: '/features/family-portal',
  },
  {
    icon: Insights, title: 'AI Intelligence', color: 'M.tealDeep',
    desc: 'AI assistance designed to reduce administration and surface patterns — with human judgement, permissions and auditability at the centre.',
    features: ['AI-assisted care summaries', 'Change detection across records', 'Risk signals with source traceability', 'Compliance copilot and anomaly detection', 'Natural-language data assistant'],
    tone: 'light' as const,
    link: '/features/ai',
  },
]

const workflows = [
  { step: '01', title: 'Record', desc: 'Care notes, medication records, risk assessments and incidents are captured at the point of care — on web or mobile.' },
  { step: '02', title: 'Connect', desc: 'Every record links back to the person, the care plan, the staff member and the visit — creating an auditable chain.' },
  { step: '03', title: 'Review', desc: 'Managers see the operational picture: missed calls, overdue training, open incidents, compliance gaps — all in one view.' },
  { step: '04', title: 'Act', desc: 'Assign follow-up actions, approve changes, generate reports and prepare evidence — with full change history.' },
]

/* ─── Page ──────────────────────────────────────────── */

export default function PlatformPage() {
  const nav = useNavigate()

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

      {/* Hero */}
      <Box sx={{ py: { xs: 10, md: 16 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <SectionLabel>MeticleCare Platform</SectionLabel>
              <Typography sx={{ fontSize: M.display.fontSize, lineHeight: M.display.lineHeight, fontWeight: M.display.fontWeight, letterSpacing: M.display.letterSpacing, mb: 3 }}>
                One platform. Every part of care operations.
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, lineHeight: M.bodyLg.lineHeight, maxWidth: 520, mb: 4 }}>
                A shared operational layer for domiciliary and supported living teams. Capabilities are shaped by organisation type and enabled workflows — so every team sees what matters to them.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.teal, color: M.navy, fontWeight: 700, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', '&:hover': { bgcolor: M.tealDark } }}>Book a demo</Button>
                <Button variant="outlined" onClick={() => nav('/solutions/domiciliary-care')} sx={{ borderColor: M.subtle, color: M.ink, fontWeight: 700, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none' }}>Domiciliary care</Button>
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ borderRadius: M.r.lg, overflow: 'hidden', border: `1px solid ${M.subtle}`, boxShadow: M.shadow.xl, bgcolor: M.card }}>
                <Box sx={{ px: 2, py: 1, borderBottom: `1px solid ${M.faint}`, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#F97066' }} />
                    <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#F59E0B' }} />
                    <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#22C55E' }} />
                  </Box>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: M.muted, ml: 1 }}>MeticleCare</Typography>
                </Box>
                <Box component="img" src="/meticle_dashboard_hero.jpg" alt="MeticleCare platform dashboard" sx={{ display: 'block', width: '100%', height: 'auto' }} />
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* How it works */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.card }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <SectionLabel>How it works</SectionLabel>
            <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing, mb: 2 }}>
              From recording to insight in four steps.
            </Typography>
            <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, maxWidth: 560, mx: 'auto' }}>
              Information flows from the point of care through to management oversight and compliance evidence.
            </Typography>
          </Box>
          <Grid container spacing={3}>
            {workflows.map((w) => (
              <Grid item xs={12} sm={6} md={3} key={w.step}>
                <Box sx={{ p: 3, bgcolor: M.paper, borderRadius: M.r.lg, height: '100%', border: `1px solid ${M.faint}` }}>
                  <Typography sx={{ fontSize: '2.5rem', fontWeight: 800, color: M.teal, opacity: 0.3, mb: 1 }}>{w.step}</Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', mb: 1 }}>{w.title}</Typography>
                  <Typography sx={{ color: M.slate, fontSize: '0.9rem', lineHeight: 1.6 }}>{w.desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Full-width immersive modules */}
      {modules.map((m, i) => {
        const bg = m.tone === 'warm' ? M.paper : M.card
        const isReversed = i % 2 !== 0
        return (
          <Box key={m.title} sx={{ py: { xs: 8, md: 12 }, bgcolor: bg, borderBottom: `1px solid ${M.faint}` }}>
            <Container maxWidth="lg">
              <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center" direction={isReversed ? 'row-reverse' : 'row'}>
                <Grid item xs={12} md={5}>
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                    <Box sx={{ width: 48, height: 48, borderRadius: M.r.md, bgcolor: `${m.color}12`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <m.icon sx={{ color: m.color, fontSize: 24 }} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: m.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Module {String(i + 1).padStart(2, '0')}</Typography>
                      <Typography sx={{ fontWeight: 700, fontSize: '1.2rem' }}>{m.title}</Typography>
                    </Box>
                  </Stack>
                  <Typography sx={{ color: M.slate, lineHeight: 1.65, fontSize: '0.95rem', mb: 3 }}>{m.desc}</Typography>
                  <Stack spacing={1} sx={{ mb: 3 }}>
                    {m.features.map((f) => (
                      <Stack key={f} direction="row" spacing={1.5} alignItems="center">
                        <Check sx={{ color: m.color, fontSize: 16 }} />
                        <Typography sx={{ fontWeight: 500, fontSize: '0.88rem' }}>{f}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                  <Button component="a" href={m.link} endIcon={<ArrowForward />} sx={{ color: m.color, fontWeight: 700, px: 0, textTransform: 'none', fontSize: '0.88rem' }}>
                    Learn more
                  </Button>
                </Grid>
                <Grid item xs={12} md={7}>
                  <Box sx={{
                    transform: 'perspective(1000px) rotateY(-2deg) rotateX(1deg)',
                    transition: 'transform 0.3s',
                    '&:hover': { transform: 'perspective(1000px) rotateY(0deg) rotateX(0deg)' },
                  }}>
                    {mockups[m.title]}
                  </Box>
                </Grid>
              </Grid>
            </Container>
          </Box>
        )
      })}

      {/* Architecture */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={5}>
              <SectionLabel>Connected architecture</SectionLabel>
              <Typography sx={{ fontSize: M.h2.fontSize, fontWeight: M.h2.fontWeight, letterSpacing: M.h2.letterSpacing, mb: 2 }}>
                Not a collection of modules. One connected system.
              </Typography>
              <Typography sx={{ color: M.slate, lineHeight: 1.7, mb: 3 }}>
                When a care note is written, it links to the person, the care plan, the visit and the staff member. When an incident is recorded, it connects to the care plan, the risk assessment and any follow-up actions.
              </Typography>
              <Typography sx={{ color: M.slate, lineHeight: 1.7 }}>
                Managers never have to cross-reference multiple systems. The information they need is already connected.
              </Typography>
            </Grid>
            <Grid item xs={12} md={7}>
              <Box sx={{ p: 4, bgcolor: M.card, borderRadius: M.r.xl, border: `1px solid ${M.faint}` }}>
                <Typography sx={{ fontWeight: 700, mb: 2 }}>Data flow</Typography>
                {[
                  { from: 'Care note', to: 'Person record + Care plan + Visit + Staff member', icon: Description },
                  { from: 'Incident', to: 'Care plan + Risk assessment + Actions + Follow-up', icon: Warning },
                  { from: 'Medication', to: 'Person record + MAR + Exceptions + Audit log', icon: Medication },
                  { from: 'Training', to: 'Staff profile + Competency + Compliance status', icon: People },
                  { from: 'Visit', to: 'Schedule + Carer + Client + Area + Timesheet', icon: LocationOn },
                ].map((row, i) => (
                  <Stack key={row.from} direction="row" spacing={2} alignItems="center" sx={{ py: 1.5, borderBottom: i < 4 ? `1px solid ${M.faint}` : 'none' }}>
                    <row.icon sx={{ color: M.teal, fontSize: 18 }} />
                    <Typography sx={{ fontWeight: 700, minWidth: 100, fontSize: '0.88rem' }}>{row.from}</Typography>
                    <ArrowForward sx={{ color: M.subtle, fontSize: 16 }} />
                    <Typography sx={{ color: M.slate, fontSize: '0.85rem' }}>{row.to}</Typography>
                  </Stack>
                ))}
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* CTA */}
      <Box sx={{ py: { xs: 10, md: 14 }, bgcolor: M.navy, textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing, color: M.card, mb: 2 }}>
            See how the pieces connect.
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: M.bodyLg.fontSize, mb: 4, maxWidth: 500, mx: 'auto' }}>
            The product is built around the person, the service and the working day.
          </Typography>
          <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.teal, color: M.navy, fontWeight: 700, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', '&:hover': { bgcolor: M.tealDark } }}>Book a demo</Button>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
