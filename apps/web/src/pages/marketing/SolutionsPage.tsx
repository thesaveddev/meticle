import { Box, Button, Container, Grid, Stack, Typography } from '@mui/material'
import {
  ArrowForward, Check, Groups, CalendarMonth, Warning, PhoneIphone,
  People, Shield, Insights,
  Medication, FamilyRestroom, AutoAwesome, AssignmentTurnedIn, Map,
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

const solutions: Record<string, {
  title: string; tagline: string; desc: string; accent: string;
  heroFeatures: string[]; modules: Array<{ icon: typeof Groups; title: string; desc: string }>;
  stats: Array<{ value: string; label: string }>; workflow: Array<{ title: string; desc: string }>;
}> = {
  'domiciliary-care': {
    title: 'Domiciliary Care', tagline: 'From the office to the doorstep.',
    desc: 'Plan packages and calls, assign carers, capture visit records, manage travel and exceptions, and keep managers close to what is happening today. MeticleCare gives domiciliary providers the operational control they need — without the paperwork.',
    accent: M.teal,
    heroFeatures: [
      'Visit scheduling with real-time call status',
      'Mobile check-in, notes, travel and disruptions',
      'Carer availability, assignments and open calls',
      'Missed-call follow-up and escalation',
      'Timesheet and payroll export',
      'Area-based coverage with carer-to-client ratios',
      'Shift marketplace for open-call pickup',
      'End-of-day call completion summaries',
    ],
    modules: [
      { icon: CalendarMonth, title: 'Visit Scheduling', desc: 'Plan calls around client needs, carer availability and geographic areas. See the schedule at a glance and react to disruptions in real time.' },
      { icon: PhoneIphone, title: 'Mobile Check-in', desc: 'Carers check in and out of visits, record care notes, report disruptions and access client information — all from their phone.' },
      { icon: People, title: 'Carer Management', desc: 'Track availability, leave, training and competency. Assign carers to visits based on skills, area and availability.' },
      { icon: Map, title: 'Area Coverage', desc: 'See how many carers are covering each area, how many clients are in each zone, and identify coverage gaps before they become problems.' },
      { icon: Warning, title: 'Missed Calls', desc: 'When a call is missed or overdue, it escalates automatically. Managers see the full picture: what happened, who was affected and what action was taken.' },
      { icon: AssignmentTurnedIn, title: 'Timesheets & Payroll', desc: 'Approved visit records flow into timesheets. Export for payroll processing without re-entering data.' },
      { icon: FamilyRestroom, title: 'Family Communication', desc: 'Keep families informed through the portal. Share relevant updates, visit summaries and communication — controlled by the service.' },
      { icon: Insights, title: 'Operational Reporting', desc: 'Dashboards showing call completion rates, carer utilisation, missed calls, area coverage and workforce metrics.' },
    ],
    stats: [
      { value: 'Real-time', label: 'Call status visibility' },
      { value: '100%', label: 'Audit-tracked visits' },
      { value: 'Mobile', label: 'Field-ready for carers' },
      { value: 'Same-day', label: 'Missed call escalation' },
    ],
    workflow: [
      { title: 'Plan the day', desc: 'Coordinators see available carers, client needs and area coverage. The rota is built around real constraints.' },
      { title: 'Assign and dispatch', desc: 'Carers receive their schedule on mobile. Open calls go to the shift marketplace if needed.' },
      { title: 'Deliver and record', desc: 'Carers check in, record notes and report disruptions. Everything links back to the client and care plan.' },
      { title: 'Review and follow up', desc: 'Managers see completion rates, missed calls and exceptions. Actions are assigned and tracked to resolution.' },
    ],
  },
  'supported-living': {
    title: 'Supported Living', tagline: 'Connected around the person.',
    desc: 'Keep person-centred support, daily records, medication, risks, incidents, reviews and workforce governance connected across your service. MeticleCare helps supported living providers maintain the continuous, evidence-rich record that inspection-ready services need.',
    accent: '#6366F1',
    heroFeatures: [
      'Person-centred support plans and daily notes',
      'Medication management and MAR workflows',
      'Body mapping and health observations',
      'Risk assessments, incidents and safeguarding',
      'Rota, staff, training and competency tracking',
      'Reviews, reporting and compliance evidence',
      'Family Portal with authorised access',
      'AI-assisted summaries and compliance copilot',
    ],
    modules: [
      { icon: Groups, title: 'Person-Centred Care', desc: 'Support plans, goals, preferences and daily notes are all connected to the person record. Every interaction builds the picture.' },
      { icon: Medication, title: 'Medication (eMAR)', desc: 'Full medication management with administration records, stock control, PRN tracking and exception handling. Audit-ready at all times.' },
      { icon: Warning, title: 'Risk & Incidents', desc: 'Risk assessments linked to care plans. Incident recording with severity, actions, follow-up and escalation history.' },
      { icon: People, title: 'Workforce', desc: 'Staff profiles, training matrices, competency assessments, availability and leave — all in one place with compliance visibility.' },
      { icon: CalendarMonth, title: 'Scheduling', desc: 'Shift planning with staff availability, competency matching and manager approval. Connected to timesheets and payroll.' },
      { icon: Shield, title: 'Compliance', desc: 'Evidence packs, audit logs, training compliance, identity monitoring and inspection-readiness dashboards.' },
      { icon: FamilyRestroom, title: 'Family Portal', desc: 'Authorised relatives access relevant care information, updates and communication — with service-controlled access.' },
      { icon: AutoAwesome, title: 'AI Intelligence', desc: 'Care summaries, change detection, risk signals, compliance copilot and manager briefings — with source traceability.' },
    ],
    stats: [
      { value: 'Person', label: 'Centred at every level' },
      { value: '24/7', label: 'Mobile access for staff' },
      { value: '4 nations', label: 'Regulatory coverage' },
      { value: 'Full', label: 'Audit trail and evidence' },
    ],
    workflow: [
      { title: 'Understand the person', desc: 'Care plans, preferences, goals and health information create a complete picture of each individual.' },
      { title: 'Deliver and support', desc: 'Staff record daily notes, administer medication and capture observations — all linked to the person record.' },
      { title: 'Manage risk', desc: 'Risk assessments stay current. Incidents are recorded, investigated and followed up with full history.' },
      { title: 'Prove compliance', desc: 'Training, competency, evidence and governance are always visible. Inspection readiness is continuous.' },
    ],
  },
}

export default function SolutionsPage() {
  const { slug } = useParams<{ slug: string }>()
  const nav = useNavigate()
  const sol = solutions[slug || 'domiciliary-care'] || solutions['domiciliary-care']
  const isHomecare = slug === 'domiciliary-care'

  return (
    <MarketingLayout>
      <PageMeta title={`${sol.title} software`} description={sol.desc} canonicalPath={`/solutions/${slug}`} />

      {/* Hero */}
      <Box sx={{ py: { xs: 10, md: 16 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <Eyebrow>{sol.title}</Eyebrow>
              <Typography sx={{ fontSize: M.display.size, lineHeight: M.display.height, fontWeight: M.display.weight, letterSpacing: M.display.tracking, mb: 3 }}>
                {sol.tagline}
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: M.bodyLg.size, lineHeight: M.bodyLg.height, mb: 4, maxWidth: 500 }}>
                {sol.desc}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: sol.accent, color: sol.accent === M.teal ? M.navy : '#fff', fontWeight: 700, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', '&:hover': { bgcolor: sol.accent, opacity: 0.9 } }}>Book a demo</Button>
                <Button variant="outlined" onClick={() => nav('/platform')} sx={{ borderColor: M.subtle, color: M.ink, fontWeight: 700, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none' }}>See the platform</Button>
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
                <Box component="img" src={isHomecare ? '/hero-care.jpg' : '/meticle_dashboard_hero.jpg'} alt={`${sol.title} in MeticleCare`} sx={{ display: 'block', width: '100%', height: 'auto' }} />
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Stats */}
      <Box sx={{ py: 4, bgcolor: M.card, borderTop: `1px solid ${M.faint}`, borderBottom: `1px solid ${M.faint}` }}>
        <Container maxWidth="lg">
          <Grid container spacing={3} justifyContent="center">
            {sol.stats.map((s) => (
              <Grid item xs={6} sm={3} key={s.label}>
                <Stack alignItems="center" spacing={0.5}>
                  <Typography sx={{ fontSize: { xs: '1.5rem', md: '2rem' }, fontWeight: 800, color: sol.accent, letterSpacing: '-0.03em' }}>{s.value}</Typography>
                  <Typography sx={{ fontSize: '0.82rem', color: M.muted, textAlign: 'center' }}>{s.label}</Typography>
                </Stack>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* How it works */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.card }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Eyebrow>How it works</Eyebrow>
            <Typography sx={{ fontSize: M.h1.size, lineHeight: M.h1.height, fontWeight: M.h1.weight, letterSpacing: M.h1.tracking }}>
              {isHomecare ? 'The working day, connected.' : 'Care built around each person.'}
            </Typography>
          </Box>
          <Grid container spacing={3}>
            {sol.workflow.map((w, i) => (
              <Grid item xs={12} sm={6} md={3} key={w.title}>
                <Box sx={{ p: 3, bgcolor: M.paper, borderRadius: M.r.lg, height: '100%', border: `1px solid ${M.faint}` }}>
                  <Typography sx={{ fontSize: '2.5rem', fontWeight: 800, color: sol.accent, opacity: 0.25, mb: 1 }}>{String(i + 1).padStart(2, '0')}</Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', mb: 1 }}>{w.title}</Typography>
                  <Typography sx={{ color: M.slate, fontSize: '0.88rem', lineHeight: 1.6 }}>{w.desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Feature checklist */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="flex-start">
            <Grid item xs={12} md={5}>
              <Eyebrow>What you get</Eyebrow>
              <Typography sx={{ fontSize: M.h2.size, fontWeight: M.h2.weight, letterSpacing: M.h2.tracking, mb: 2 }}>
                Built around the work your team does.
              </Typography>
              <Typography sx={{ color: M.slate, lineHeight: 1.7, mb: 4 }}>
                {isHomecare
                  ? 'Every feature is designed for the realities of domiciliary care — where the work happens at client homes, across multiple areas, throughout the day.'
                  : 'Every feature is designed for supported living — where continuity, person-centred records and continuous compliance are essential.'}
              </Typography>
              <Stack spacing={1.5}>
                {sol.heroFeatures.map((f) => (
                  <Stack key={f} direction="row" spacing={1.5} alignItems="flex-start">
                    <Check sx={{ color: sol.accent, fontSize: 18, mt: 0.3 }} />
                    <Typography sx={{ fontWeight: 500, lineHeight: 1.5 }}>{f}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Grid>
            <Grid item xs={12} md={7}>
              <Stack spacing={2.5}>
                {sol.modules.map((m) => (
                  <Box key={m.title} sx={{
                    p: 3, bgcolor: M.card, borderRadius: M.r.lg,
                    border: `1px solid ${M.faint}`,
                    transition: 'all 0.2s',
                    '&:hover': { borderColor: sol.accent, boxShadow: M.shadow.md },
                  }}>
                    <Stack direction="row" spacing={2} alignItems="flex-start">
                      <Box sx={{ width: 44, height: 44, borderRadius: M.r.md, bgcolor: `${sol.accent}12`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <m.icon sx={{ color: sol.accent, fontSize: 22 }} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{m.title}</Typography>
                        <Typography sx={{ color: M.slate, fontSize: '0.88rem', lineHeight: 1.55 }}>{m.desc}</Typography>
                      </Box>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* CTA */}
      <Box sx={{ py: { xs: 10, md: 14 }, background: `linear-gradient(160deg, ${M.navy} 0%, #162032 50%, #1A2744 100%)`, textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography sx={{ fontSize: M.h1.size, lineHeight: M.h1.height, fontWeight: M.h1.weight, letterSpacing: M.h1.tracking, color: M.card, mb: 2 }}>
            See how it fits your service.
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: M.bodyLg.size, mb: 4 }}>
            Talk to the team about your {isHomecare ? 'domiciliary care' : 'supported living'} operation.
          </Typography>
          <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.teal, color: M.navy, fontWeight: 700, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', '&:hover': { bgcolor: M.tealDark } }}>Book a demo</Button>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
