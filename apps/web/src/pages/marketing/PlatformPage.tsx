import { Box, Button, Container, Grid, Stack, Typography } from '@mui/material'
import {
  ArrowForward, Check, Groups, Medication, People, CalendarMonth,
  Warning, Insights, FamilyRestroom, Shield, AutoAwesome,
  Description, LocationOn,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { M } from '../../styles/marketing-tokens'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'

function Eyebrow({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
      <Box sx={{ width: 8, height: 8, borderRadius: M.r.full, bgcolor: M.teal }} />
      <Typography sx={{ color: light ? 'rgba(255,255,255,0.6)' : M.tealDeep, fontSize: M.caption.size, fontWeight: M.caption.weight, letterSpacing: M.caption.tracking, textTransform: 'uppercase' }}>{children}</Typography>
    </Stack>
  )
}

const modules = [
  {
    icon: Groups, title: 'Care Delivery', color: '#6366F1',
    desc: 'Keep care plans, daily notes, reviews, body maps, appointments and health observations in one accessible record — always linked to the person.',
    features: ['Person-centred support plans', 'Daily care notes and handover context', 'Body mapping and linked observations', 'Reviews, goals and health checks', 'Mobile access at the point of care'],
  },
  {
    icon: Medication, title: 'Medication (eMAR)', color: '#F59E0B',
    desc: 'Manage medication workflows where your service provides medication support — with clear permissions, administration records and an audit trail.',
    features: ['31-day medication administration records', 'Stock control and controlled-drug workflows', 'Exception recording and follow-up', 'Role-based access to medication data', 'Mobile reference and recording for field teams'],
  },
  {
    icon: People, title: 'Workforce Management', color: '#EC4899',
    desc: 'Connect staff information, training, competency, availability and work allocation into one operational view.',
    features: ['Staff directory and detailed profiles', 'Training and competency tracking', 'Availability, leave and approval workflows', 'Right-to-work and DBS reminders', 'Connected workforce reporting'],
  },
  {
    icon: CalendarMonth, title: 'Scheduling & Rota', color: '#22C55E',
    desc: 'Plan visits and shifts using availability, staffing and operational constraints — with human review before anything is published.',
    features: ['Rota and visit planning', 'Availability and leave awareness', 'Open-call marketplace for unfilled shifts', 'Conflict and coverage detection', 'Manager approval before publishing'],
  },
  {
    icon: Warning, title: 'Risk & Incidents', color: '#F97066',
    desc: 'Keep risk information visible, record incidents with follow-through and maintain the review history your governance requires.',
    features: ['Risk assessment records and review dates', 'Incident recording with severity context', 'Actions, owners and due dates', 'Escalation and follow-up history', 'Linked care-plan context'],
  },
  {
    icon: Shield, title: 'Compliance & Evidence', color: '#8B5CF6',
    desc: 'Make inspection readiness part of everyday work — not a once-a-year scramble for evidence.',
    features: ['Training and competency matrices', 'Evidence packs and audit logs', 'Compliance dashboards by nation', 'Identity and right-to-work monitoring', 'Policy and procedure management'],
  },
  {
    icon: Insights, title: 'Reporting & Intelligence', color: '#0EA5E9',
    desc: 'Turn the records your team already keeps into operational reports, evidence and AI-assisted insight.',
    features: ['Operational dashboards and drill-downs', 'Care and workforce reporting', 'Homecare call and visit analytics', 'AI-assisted briefings and summaries', 'Exportable evidence workflows'],
  },
  {
    icon: FamilyRestroom, title: 'Family Portal', color: '#14B8A6',
    desc: 'Give authorised relatives a respectful, focused view of the information your service chooses to share.',
    features: ['Authorised portal access with secure links', 'Relevant care information and updates', 'Communication and feedback channels', 'Appointment and visit context', 'Access controlled entirely by the service'],
  },
  {
    icon: AutoAwesome, title: 'AI Intelligence', color: '#A855F7',
    desc: 'AI assistance designed to reduce administration and surface patterns — with human judgement, permissions and auditability at the centre.',
    features: ['AI-assisted care summaries', 'Change detection across records', 'Risk signals with source traceability', 'Compliance copilot and anomaly detection', 'Natural-language data assistant'],
  },
]

const workflows = [
  {
    step: '01',
    title: 'Record',
    desc: 'Care notes, medication records, risk assessments and incidents are captured at the point of care — on web or mobile.',
  },
  {
    step: '02',
    title: 'Connect',
    desc: 'Every record links back to the person, the care plan, the staff member and the visit — creating an auditable chain.',
  },
  {
    step: '03',
    title: 'Review',
    desc: 'Managers see the operational picture: missed calls, overdue training, open incidents, compliance gaps — all in one view.',
  },
  {
    step: '04',
    title: 'Act',
    desc: 'Assign follow-up actions, approve changes, generate reports and prepare evidence — with full change history.',
  },
]

export default function PlatformPage() {
  const nav = useNavigate()

  return (
    <MarketingLayout>
      <PageMeta title="The MeticleCare platform" description="Care operations, workforce, medication, safety, compliance, families and intelligence — connected in one platform for domiciliary and supported living providers." canonicalPath="/platform" />

      {/* Hero */}
      <Box sx={{ py: { xs: 10, md: 16 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <Eyebrow>MeticleCare Platform</Eyebrow>
              <Typography sx={{ fontSize: M.display.size, lineHeight: M.display.height, fontWeight: M.display.weight, letterSpacing: M.display.tracking, mb: 3 }}>
                One platform. Every part of care operations.
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: M.bodyLg.size, lineHeight: M.bodyLg.height, maxWidth: 520, mb: 4 }}>
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
            <Eyebrow>How it works</Eyebrow>
            <Typography sx={{ fontSize: M.h1.size, lineHeight: M.h1.height, fontWeight: M.h1.weight, letterSpacing: M.h1.tracking, mb: 2 }}>
              From recording to insight in four steps.
            </Typography>
            <Typography sx={{ color: M.slate, fontSize: M.bodyLg.size, maxWidth: 560, mx: 'auto' }}>
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

      {/* Modules */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Eyebrow>Platform modules</Eyebrow>
            <Typography sx={{ fontSize: M.h1.size, lineHeight: M.h1.height, fontWeight: M.h1.weight, letterSpacing: M.h1.tracking, mb: 2 }}>
              Nine connected capabilities.
            </Typography>
            <Typography sx={{ color: M.slate, fontSize: M.bodyLg.size, maxWidth: 580, mx: 'auto' }}>
              Each module links to the person record and to the other modules — creating an auditable, connected operational view.
            </Typography>
          </Box>
          <Stack spacing={3}>
            {modules.map((m, i) => (
              <Box key={m.title} sx={{
                p: { xs: 3, md: 4 }, bgcolor: M.card, borderRadius: M.r.lg,
                border: `1px solid ${M.faint}`,
                transition: 'all 0.25s',
                '&:hover': { borderColor: m.color, boxShadow: M.shadow.md },
              }}>
                <Grid container spacing={{ xs: 3, md: 6 }} alignItems="flex-start">
                  <Grid item xs={12} md={3}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box sx={{ width: 48, height: 48, borderRadius: M.r.md, bgcolor: `${m.color}12`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <m.icon sx={{ color: m.color, fontSize: 24 }} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: m.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Module {String(i + 1).padStart(2, '0')}</Typography>
                        <Typography sx={{ fontWeight: 700, fontSize: '1.15rem' }}>{m.title}</Typography>
                      </Box>
                    </Stack>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography sx={{ color: M.slate, lineHeight: 1.65, fontSize: '0.92rem' }}>{m.desc}</Typography>
                  </Grid>
                  <Grid item xs={12} md={5}>
                    <Stack spacing={1}>
                      {m.features.map((f) => (
                        <Stack key={f} direction="row" spacing={1.5} alignItems="center">
                          <Check sx={{ color: m.color, fontSize: 16 }} />
                          <Typography sx={{ fontWeight: 500, fontSize: '0.88rem' }}>{f}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Grid>
                </Grid>
              </Box>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* Architecture */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.card }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={5}>
              <Eyebrow>Connected architecture</Eyebrow>
              <Typography sx={{ fontSize: M.h2.size, fontWeight: M.h2.weight, letterSpacing: M.h2.tracking, mb: 2 }}>
                Not a collection of modules. One connected system.
              </Typography>
              <Typography sx={{ color: M.slate, lineHeight: 1.7, mb: 3 }}>
                When a care note is written, it links to the person, the care plan, the visit and the staff member. When an incident is recorded, it connects to the care plan, the risk assessment and any follow-up actions. When training expires, it surfaces alongside competency gaps and compliance status.
              </Typography>
              <Typography sx={{ color: M.slate, lineHeight: 1.7 }}>
                This means managers never have to cross-reference multiple systems. The information they need is already connected.
              </Typography>
            </Grid>
            <Grid item xs={12} md={7}>
              <Box sx={{ p: 4, bgcolor: M.paper, borderRadius: M.r.xl, border: `1px solid ${M.faint}` }}>
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
      <Box sx={{ py: { xs: 10, md: 14 }, background: `linear-gradient(160deg, ${M.navy} 0%, #162032 50%, #1A2744 100%)`, textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography sx={{ fontSize: M.h1.size, lineHeight: M.h1.height, fontWeight: M.h1.weight, letterSpacing: M.h1.tracking, color: M.card, mb: 2 }}>
            See how the pieces connect.
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: M.bodyLg.size, mb: 4, maxWidth: 500, mx: 'auto' }}>
            The product is built around the person, the service and the working day.
          </Typography>
          <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.teal, color: M.navy, fontWeight: 700, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', '&:hover': { bgcolor: M.tealDark } }}>Book a demo</Button>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
