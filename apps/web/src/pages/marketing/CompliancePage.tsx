import { Box, Button, Container, Grid, Stack, Typography } from '@mui/material'
import { ArrowForward, Shield, AssignmentTurnedIn, People, TrendingUp, Description, Security } from '@mui/icons-material'
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

const regulators = [
  { slug: 'cqc', code: 'CQC', name: 'Care Quality Commission', nation: 'England', color: '#2563EB', desc: 'CQC uses its own assessment approach and quality statements. MeticleCare helps providers organise care records, workforce evidence, incidents, reviews and governance information for their own inspection-readiness work.' },
  { slug: 'care-inspectorate', code: 'Care Inspectorate', name: 'Care Inspectorate', nation: 'Scotland', color: '#DC2626', desc: 'The Care Inspectorate operates within Scotland\'s health and social care context. MeticleCare helps teams keep evidence, reviews, actions and operational records organised.' },
  { slug: 'ciw', code: 'CIW', name: 'Care Inspectorate Wales', nation: 'Wales', color: '#059669', desc: 'Care Inspectorate Wales has its own regulatory and inspection context. MeticleCare helps Welsh providers connect everyday records, governance and follow-up actions.' },
  { slug: 'rqia', code: 'RQIA', name: 'Regulation and Quality Improvement Authority', nation: 'Northern Ireland', color: '#7C3AED', desc: 'RQIA regulates health and social care services in Northern Ireland. MeticleCare supports structured records, workforce information, incidents and actions.' },
]

const evidenceAreas = [
  { icon: Description, title: 'Care records & plans', desc: 'Person-centred support plans, daily notes, reviews and health observations — connected and current.' },
  { icon: People, title: 'Workforce & competency', desc: 'Training matrices, competency assessments, identity monitoring and right-to-work evidence.' },
  { icon: Shield, title: 'Risk, incidents & actions', desc: 'Risk assessments, incident records, follow-up actions and escalation history with full audit trail.' },
  { icon: TrendingUp, title: 'Reports & audit logs', desc: 'Operational reports, AI-assisted insights, compliance dashboards and exportable evidence packs.' },
  { icon: AssignmentTurnedIn, title: 'Governance & policies', desc: 'Policy management, satisfaction surveys, staff engagement and compliance portal access.' },
  { icon: Security, title: 'Data protection', desc: 'DSPT compliance, MFA, RBAC, encryption and audit logging for governance evidence.' },
]

export function ComplianceOverviewPage() {
  const nav = useNavigate()

  return (
    <MarketingLayout>
      <PageMeta title="Compliance & inspection readiness" description="Organise care evidence and governance across CQC, Care Inspectorate, CIW and RQIA contexts. Stay ready for inspection every day." canonicalPath="/compliance" />

      {/* Hero */}
      <Box sx={{ py: { xs: 10, md: 16 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <Eyebrow>Compliance & inspection readiness</Eyebrow>
              <Typography sx={{ fontSize: M.display.size, lineHeight: M.display.height, fontWeight: M.display.weight, letterSpacing: M.display.tracking, mb: 3 }}>
                Compliance isn't a once-a-year exercise.
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: M.bodyLg.size, lineHeight: M.bodyLg.height, mb: 3 }}>
                Build evidence and governance into everyday care work. MeticleCare supports inspection readiness — it does not guarantee compliance, a rating or an inspection outcome.
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

      {/* Continuous record */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.card }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={5}>
              <Eyebrow>A continuous record</Eyebrow>
              <Typography sx={{ fontSize: M.h2.size, fontWeight: M.h2.weight, letterSpacing: M.h2.tracking, mb: 2 }}>
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

      {/* Evidence areas */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Eyebrow>Evidence categories</Eyebrow>
            <Typography sx={{ fontSize: M.h1.size, lineHeight: M.h1.height, fontWeight: M.h1.weight, letterSpacing: M.h1.tracking }}>
              What inspectors look for. What you can show.
            </Typography>
          </Box>
          <Grid container spacing={2.5}>
            {evidenceAreas.map((e) => (
              <Grid item xs={12} sm={6} md={4} key={e.title}>
                <Box sx={{
                  p: 3.5, bgcolor: M.card, borderRadius: M.r.lg, border: `1px solid ${M.faint}`, height: '100%',
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
          <Box sx={{ mt: 5, p: 3, bgcolor: '#FEF9C3', borderRadius: M.r.md, borderLeft: `3px solid ${M.amber}` }}>
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
          <Typography sx={{ fontSize: M.h1.size, lineHeight: M.h1.height, fontWeight: M.h1.weight, letterSpacing: M.h1.tracking, color: M.card, mb: 2 }}>
            Ready to see your evidence more clearly?
          </Typography>
          <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.teal, color: M.navy, fontWeight: 700, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', '&:hover': { bgcolor: M.tealDark } }}>Book a demo</Button>
        </Container>
      </Box>
    </MarketingLayout>
  )
}

export function RegulatorPage() {
  const { slug } = useParams<{ slug: string }>()
  const nav = useNavigate()
  const r = regulators.find((x) => x.slug === slug) || regulators[0]

  return (
    <MarketingLayout>
      <PageMeta title={`${r.code} compliance support`} description={r.desc} canonicalPath={`/compliance/${r.slug}`} />

      <Box sx={{ py: { xs: 10, md: 16 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: M.r.full, bgcolor: r.color }} />
            <Typography sx={{ color: r.color, fontSize: M.caption.size, fontWeight: M.caption.weight, letterSpacing: M.caption.tracking, textTransform: 'uppercase' }}>{r.nation} · {r.code}</Typography>
          </Stack>
          <Typography sx={{ fontSize: M.display.size, lineHeight: M.display.height, fontWeight: M.display.weight, letterSpacing: M.display.tracking, mb: 3 }}>
            {r.desc.split('.')[0]}.
          </Typography>
          <Typography sx={{ color: M.slate, fontSize: M.bodyLg.size, lineHeight: M.bodyLg.height, maxWidth: 640, mb: 4 }}>
            {r.desc}
          </Typography>
          <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: r.color, color: '#fff', fontWeight: 700, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none' }}>Talk to us</Button>
        </Container>
      </Box>

      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.card }}>
        <Container maxWidth="lg">
          <Grid container spacing={2.5}>
            {evidenceAreas.map((e) => (
              <Grid item xs={12} sm={6} key={e.title}>
                <Box sx={{ p: 3, border: `1px solid ${M.faint}`, borderRadius: M.r.md, height: '100%' }}>
                  <e.icon sx={{ color: r.color, mb: 1.5, fontSize: 28 }} />
                  <Typography sx={{ fontWeight: 700, mb: 0.75 }}>{e.title}</Typography>
                  <Typography sx={{ color: M.slate, fontSize: '0.9rem', lineHeight: 1.6 }}>{e.desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
          <Box sx={{ mt: 5, p: 3, bgcolor: '#FEF9C3', borderRadius: M.r.md, borderLeft: `3px solid ${M.amber}` }}>
            <Typography sx={{ color: '#78350F', fontSize: '0.9rem', lineHeight: 1.6 }}>
              MeticleCare is a software tool, not a regulator. Requirements differ by nation and service type. The responsibility for compliance remains with the provider.
            </Typography>
          </Box>
        </Container>
      </Box>

      <Box sx={{ py: { xs: 10, md: 14 }, background: `linear-gradient(160deg, ${M.navy} 0%, #162032 50%, #1A2744 100%)`, textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography sx={{ fontSize: M.h1.size, lineHeight: M.h1.height, fontWeight: M.h1.weight, letterSpacing: M.h1.tracking, color: M.card, mb: 2 }}>
            Talk through your regulatory context.
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
