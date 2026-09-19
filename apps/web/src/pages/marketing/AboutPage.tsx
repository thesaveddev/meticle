import { Box, Button, Container, Grid, Stack, Typography } from '@mui/material'
import { ArrowForward, Groups, TrendingUp, Shield, AutoAwesome } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { M } from '../../styles/marketing-tokens'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
      <Box sx={{ width: 8, height: 8, borderRadius: M.r.full, bgcolor: M.teal }} />
      <Typography sx={{ color: M.tealDeep, fontSize: M.caption.fontSize, fontWeight: M.caption.fontWeight, letterSpacing: M.caption.letterSpacing, textTransform: 'uppercase' }}>{children}</Typography>
    </Stack>
  )
}

const values = [
  { icon: Groups, title: 'Connected care', desc: 'Care delivery, people, medication, risk and compliance should not live in separate systems. When information is connected, teams make better decisions faster.' },
  { icon: Shield, title: 'Trust by design', desc: 'Security and privacy are core product concerns. Every feature is built with tenant isolation, role-based access and auditability from the start.' },
  { icon: AutoAwesome, title: 'Intelligent assistance', desc: 'AI should reduce administration and surface patterns — not replace professional judgement. Every AI output is assistive, source-linked and auditable.' },
  { icon: TrendingUp, title: 'Practical outcomes', desc: 'The measure of good software is whether it helps people spend less time on administration and more time delivering care. That is what we design for.' },
]

const timeline = [
  { year: 'Foundation', title: 'Care operations are broken.', desc: 'Care providers were drowning in disconnected systems — spreadsheets for rotas, paper notes for care records, messaging apps for team communication. Nothing connected. Nothing was searchable. Inspections meant weeks of scrambling.' },
  { year: 'Vision', title: 'One connected platform.', desc: 'MeticleCare was built to bring every part of care operations together — care delivery, scheduling, medication, risk, compliance, workforce and families — in one platform that works on both web and mobile.' },
  { year: 'Growth', title: 'Built for the UK.', desc: 'Designed for domiciliary and supported living providers across all four UK nations. Supporting CQC, Care Inspectorate, CIW and RQIA contexts with proper regulatory awareness — not generic healthcare templates.' },
  { year: 'Intelligence', title: 'AI that works with records.', desc: 'Adding intelligence that analyses the data teams already create — care summaries, change detection, compliance copilot, risk signals and manager briefings — with source traceability and human review at the centre.' },
]

export default function AboutPage() {
  const nav = useNavigate()

  return (
    <MarketingLayout>
      <PageMeta title="About MeticleCare" description="Why MeticleCare exists: to help care providers bring delivery, people, operations and evidence into one connected platform." canonicalPath="/about" />

      {/* Hero */}
      <Box sx={{ py: { xs: 10, md: 16 }, bgcolor: M.paper }}>
        <Container maxWidth="md">
          <Eyebrow>About MeticleCare</Eyebrow>
          <Typography sx={{ fontSize: M.display.fontSize, lineHeight: M.display.lineHeight, fontWeight: M.display.fontWeight, letterSpacing: M.display.letterSpacing, mb: 3 }}>
            This is where care operations come together.
          </Typography>
          <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, lineHeight: 1.8, mb: 4 }}>
            Care teams should not have to search across paperwork, spreadsheets, messages and disconnected systems to understand what happened and what needs attention. MeticleCare exists because care operations deserve better.
          </Typography>
          <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, lineHeight: 1.8 }}>
            We are building the operating layer for modern care providers — connecting care delivery, people, medication, risk, incidents, compliance, reporting, families and intelligence in one platform.
          </Typography>
        </Container>
      </Box>

      {/* Story */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.card }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Eyebrow>Our story</Eyebrow>
            <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing }}>
              From a problem to a platform.
            </Typography>
          </Box>
          <Grid container spacing={3}>
            {timeline.map((t, i) => (
              <Grid item xs={12} md={3} key={t.year}>
                <Box sx={{
                  p: 3, bgcolor: i === 3 ? M.tealSoft : M.paper, borderRadius: M.r.lg,
                  border: `1px solid ${i === 3 ? M.teal : M.faint}`, height: '100%',
                }}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: M.teal, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>{t.year}</Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', mb: 1 }}>{t.title}</Typography>
                  <Typography sx={{ color: M.slate, fontSize: '0.88rem', lineHeight: 1.6 }}>{t.desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Values */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Eyebrow>What we believe</Eyebrow>
            <Typography sx={{ fontSize: M.h2.fontSize, fontWeight: M.h2.fontWeight, letterSpacing: M.h2.letterSpacing }}>
              Principles that guide the product.
            </Typography>
          </Box>
          <Grid container spacing={2.5}>
            {values.map((v) => (
              <Grid item xs={12} sm={6} key={v.title}>
                <Box sx={{
                  p: 3.5, bgcolor: M.card, borderRadius: M.r.lg, border: `1px solid ${M.faint}`, height: '100%',
                  transition: 'all 0.25s', '&:hover': { borderColor: M.teal, boxShadow: M.shadow.md },
                }}>
                  <Box sx={{ width: 48, height: 48, borderRadius: M.r.md, bgcolor: M.tealSoft, display: 'grid', placeItems: 'center', mb: 2.5 }}>
                    <v.icon sx={{ color: M.tealDeep, fontSize: 24 }} />
                  </Box>
                  <Typography sx={{ fontWeight: 700, mb: 1, fontSize: '1.05rem' }}>{v.title}</Typography>
                  <Typography sx={{ color: M.slate, fontSize: '0.9rem', lineHeight: 1.65 }}>{v.desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Mission */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.card }}>
        <Container maxWidth="md">
          <Box sx={{ textAlign: 'center', p: { xs: 4, md: 6 }, bgcolor: M.paper, borderRadius: M.r.xl, border: `1px solid ${M.faint}` }}>
            <Typography sx={{ fontSize: M.h2.fontSize, fontWeight: M.h2.fontWeight, letterSpacing: M.h2.letterSpacing, mb: 2 }}>
              Our mission.
            </Typography>
            <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, lineHeight: 1.8 }}>
              Help care providers spend less time processing information and more time delivering care — while keeping the evidence, compliance and governance that inspection-ready services need.
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* CTA */}
      <Box sx={{ py: { xs: 10, md: 14 }, background: `linear-gradient(160deg, ${M.navy} 0%, #162032 50%, #1A2744 100%)`, textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing, color: M.card, mb: 2 }}>
            Run your care operation with more clarity.
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: M.bodyLg.fontSize, mb: 4 }}>
            Talk to the team about how MeticleCare can support your service.
          </Typography>
          <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.teal, color: M.navy, fontWeight: 700, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', '&:hover': { bgcolor: M.tealDark } }}>Book a demo</Button>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
