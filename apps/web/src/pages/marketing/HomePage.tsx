import { useNavigate } from 'react-router-dom'
import { Box, Button, Container, Grid, Stack, Typography } from '@mui/material'
import {
  ArrowForward,
  Description,
  FamilyRestroom,
  Medication,
  People,
  Security,
  Shield,
} from '@mui/icons-material'
import type { ReactNode } from 'react'
import { M } from '../../styles/marketing-tokens'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'

function ActionLink({ label, to, light = false }: { label: string; to: string; light?: boolean }) {
  const navigate = useNavigate()

  return (
    <Button
      onClick={() => navigate(to)}
      endIcon={<ArrowForward />}
      sx={{
        minHeight: 48,
        px: 2.5,
        borderRadius: M.r.sm,
        textTransform: 'none',
        fontWeight: 800,
        color: light ? M.navy : M.card,
        bgcolor: light ? M.card : M.navy,
        border: light ? 'none' : `1px solid ${M.navy}`,
        '&:hover': { bgcolor: light ? M.warm : M.navyLight },
      }}
    >
      {label}
    </Button>
  )
}

function TextLink({ label, to, light = false }: { label: string; to: string; light?: boolean }) {
  const navigate = useNavigate()

  return (
    <Button
      onClick={() => navigate(to)}
      endIcon={<ArrowForward />}
      sx={{
        px: 0,
        minHeight: 40,
        borderRadius: 0,
        textTransform: 'none',
        fontWeight: 800,
        color: light ? M.card : M.navy,
        '&:hover': { bgcolor: 'transparent', color: light ? M.teal : M.tealDeep },
        '& .MuiButton-endIcon': { transition: 'transform 180ms ease' },
        '&:hover .MuiButton-endIcon': { transform: 'translateX(4px)' },
      }}
    >
      {label}
    </Button>
  )
}

function SectionIntro({
  eyebrow,
  title,
  children,
  light = false,
}: {
  eyebrow: string
  title: string
  children?: ReactNode
  light?: boolean
}) {
  return (
    <Box sx={{ maxWidth: 720, mb: { xs: 5, md: 8 } }}>
      <Typography sx={{
        ...M.caption,
        display: 'inline-block',
        color: light ? M.tealMuted : M.tealDeep,
        borderBottom: `2px solid ${light ? M.teal : M.tealDeep}`,
        pb: 0.75,
        mb: 2.5,
      }}>
        {eyebrow}
      </Typography>
      <Typography component="h2" sx={{ ...M.h1, color: light ? M.card : M.ink, mb: 2 }}>
        {title}
      </Typography>
      {children && (
        <Typography sx={{ ...M.bodyLg, color: light ? 'rgba(255,255,255,0.72)' : M.slate }}>
          {children}
        </Typography>
      )}
    </Box>
  )
}

function WorkingDayBoard() {
  const stages = [
    { time: '08:00', title: 'Plan', text: 'Calls, people and priorities in one view.' },
    { time: '09:15', title: 'Deliver', text: 'A carer checks in at the point of care.' },
    { time: '10:05', title: 'Record', text: 'The visit note becomes part of the record.' },
    { time: '10:30', title: 'Review', text: 'Exceptions stay visible until resolved.' },
  ]

  return (
    <Box sx={{
      position: 'relative',
      bgcolor: M.warm,
      border: `1px solid ${M.subtle}`,
      borderRadius: M.r.lg,
      p: { xs: 2.5, md: 4 },
      boxShadow: M.shadow.navy,
      overflow: 'hidden',
      '@keyframes workingDaySignal': {
        '0%': { transform: 'translateX(0)', opacity: 0.45 },
        '10%': { opacity: 1 },
        '90%': { opacity: 1 },
        '100%': { transform: 'translateX(calc(100% - 12px))', opacity: 0.45 },
      },
      '@keyframes workingDayPulse': {
        '0%, 100%': { opacity: 0.45, transform: 'scale(0.9)' },
        '50%': { opacity: 1, transform: 'scale(1)' },
      },
      '@media (prefers-reduced-motion: reduce)': {
        '& .working-day-signal, & .working-day-pulse': { animation: 'none' },
      },
    }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 4 }}>
        <Box>
          <Typography sx={{ ...M.caption, color: M.navy, display: 'block', mb: 0.75 }}>THE WORKING DAY</Typography>
          <Typography sx={{ ...M.h3, color: M.ink }}>From plan to proof.</Typography>
        </Box>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: M.tealDeep }}>
          <Box className="working-day-pulse" sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: M.teal, animation: 'workingDayPulse 1.8s ease-in-out infinite' }} />
          <Typography sx={{ ...M.caption, color: M.tealDeep }}>LIVE</Typography>
        </Stack>
      </Stack>

      <Box sx={{ position: 'relative', height: 4, bgcolor: M.subtle, borderRadius: 4, mb: 4 }}>
        <Box sx={{ position: 'absolute', inset: 0, bgcolor: M.teal, borderRadius: 4, transformOrigin: 'left' }} />
        <Box className="working-day-signal" sx={{
          position: 'absolute',
          top: -4,
          left: 0,
          width: 12,
          height: 12,
          borderRadius: '50%',
          bgcolor: M.teal,
          border: `3px solid ${M.warm}`,
          boxShadow: `0 0 0 1px ${M.teal}`,
          animation: 'workingDaySignal 4.8s cubic-bezier(0.16, 1, 0.3, 1) infinite',
        }} />
      </Box>

      <Grid container spacing={{ xs: 2, md: 2.5 }}>
        {stages.map((stage, index) => (
          <Grid item xs={6} sm={3} key={stage.title}>
            <Box sx={{ borderTop: `2px solid ${index === 0 ? M.teal : M.subtle}`, pt: 1.5, minHeight: 120 }}>
              <Typography sx={{ ...M.caption, color: M.muted, display: 'block', mb: 0.75 }}>{stage.time}</Typography>
              <Typography sx={{ fontWeight: 800, color: M.navy, mb: 0.5 }}>{stage.title}</Typography>
              <Typography sx={{ color: M.slate, fontSize: '0.76rem', lineHeight: 1.5 }}>{stage.text}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}

const operatingAreas = [
  { icon: Description, title: 'Care', text: 'Plans, notes, reviews and observations stay connected to the person.' },
  { icon: People, title: 'Workforce', text: 'Staff, training, competency, availability and rota work from the same context.' },
  { icon: Shield, title: 'Oversight', text: 'Risks, incidents, actions, evidence and reporting remain visible to managers.' },
]

const roles = [
  { role: 'Registered managers', text: 'See what needs attention before it becomes a surprise.' },
  { role: 'Care workers', text: 'Get a focused view of the work in front of you.' },
  { role: 'Families', text: 'Stay connected through controlled, authorised communication.' },
  { role: 'Operations leads', text: 'Understand how the service is performing from the records it creates.' },
]

const evidenceSteps = ['Deliver care', 'Record care', 'Track risks', 'Review people', 'Maintain evidence']

export default function HomePage() {
  return (
    <MarketingLayout>
      <PageMeta
        title="Care operations, unified"
        description="MeticleCare connects care delivery, workforce management, compliance, medication and reporting for UK domiciliary and supported living providers."
        canonicalPath="/"
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'MeticleCare',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web and mobile',
          description: 'Care operations software for UK domiciliary and supported living providers.',
        }}
      />

      <Box component="section" sx={{ bgcolor: M.navy, color: M.card, borderBottom: `1px solid ${M.navyLight}`, py: { xs: 9, md: 15 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography sx={{ ...M.caption, color: M.teal, display: 'block', mb: 2 }}>CARE OPERATIONS SOFTWARE</Typography>
              <Typography component="h1" sx={{ ...M.display, color: M.card, maxWidth: 620, mb: 3 }}>
                Run your care operation with confidence.
              </Typography>
              <Typography sx={{ ...M.bodyLg, color: 'rgba(255,255,255,0.72)', maxWidth: 560, mb: 4 }}>
                Connect care delivery, workforce, compliance, medication and reporting in one place built for the real working day.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <ActionLink label="Book a demo" to="/contact" />
                <TextLink label="Explore the platform" to="/platform" light />
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <WorkingDayBoard />
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Box component="section" sx={{ bgcolor: M.card, borderBottom: `1px solid ${M.faint}`, py: { xs: 3, md: 4 } }}>
        <Container maxWidth="lg">
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1.5, sm: 4 }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
            {['UK care operations', 'Web and mobile', 'Role-based access', 'Traceable records'].map((item) => (
              <Typography key={item} sx={{ ...M.label, color: M.slate }}>{item}</Typography>
            ))}
          </Stack>
        </Container>
      </Box>

      <Box component="section" sx={{ bgcolor: M.paper, py: { xs: 9, md: 15 } }}>
        <Container maxWidth="lg">
          <SectionIntro eyebrow="One working set" title="Everything is connected to the work, not just the menu." />
          <Grid container spacing={0} sx={{ borderTop: `1px solid ${M.faint}` }}>
            {operatingAreas.map((area) => (
              <Grid item xs={12} md={4} key={area.title}>
                <Box sx={{ p: { xs: 2.5, md: 3.5 }, minHeight: 220, borderBottom: `1px solid ${M.faint}`, borderRight: { md: `1px solid ${M.faint}` } }}>
                  <area.icon sx={{ color: M.navy, fontSize: 28, mb: 3 }} />
                  <Typography component="h3" sx={{ ...M.h3, color: M.ink, mb: 1 }}>{area.title}</Typography>
                  <Typography sx={{ ...M.body, color: M.slate }}>{area.text}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
          <Box sx={{ mt: 0, borderBottom: `1px solid ${M.faint}`, py: 3 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
              <Typography sx={{ fontWeight: 800, color: M.navy }}>Operational intelligence sits on top of the records your team already creates.</Typography>
              <TextLink label="See the platform" to="/platform" />
            </Stack>
          </Box>
        </Container>
      </Box>

      <Box component="section" sx={{ bgcolor: M.card, py: { xs: 9, md: 15 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 12 }} alignItems="start">
            <Grid item xs={12} md={5}>
              <SectionIntro eyebrow="Inspection readiness" title="Stay ready for inspection. Every day.">
                Good governance is easier to demonstrate when it is created through normal work rather than assembled at the last minute.
              </SectionIntro>
              <TextLink label="Explore compliance" to="/compliance" />
            </Grid>
            <Grid item xs={12} md={7}>
              <Box sx={{ borderTop: `2px solid ${M.teal}`, borderBottom: `1px solid ${M.faint}` }}>
                {evidenceSteps.map((step, index) => (
                  <Stack key={step} direction="row" spacing={2} alignItems="center" sx={{ py: 2.25, borderBottom: index < evidenceSteps.length - 1 ? `1px solid ${M.faint}` : 'none' }}>
                    <Typography sx={{ color: M.tealDeep, fontWeight: 900, width: 28 }}>{String(index + 1).padStart(2, '0')}</Typography>
                    <Typography sx={{ color: M.ink, fontWeight: 700 }}>{step}</Typography>
                    {index < evidenceSteps.length - 1 && <ArrowForward sx={{ ml: 'auto', color: M.muted, fontSize: 18 }} />}
                  </Stack>
                ))}
              </Box>
              <Typography sx={{ ...M.small, color: M.muted, mt: 2 }}>MeticleCare supports evidence gathering; it does not guarantee a regulatory outcome.</Typography>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Box component="section" sx={{ bgcolor: M.navy, color: M.card, py: { xs: 9, md: 15 } }}>
        <Container maxWidth="lg">
          <SectionIntro eyebrow="For the whole care team" title="A clearer day for every role." light />
          <Box sx={{ borderTop: `1px solid rgba(255,255,255,0.22)` }}>
            {roles.map((item) => (
              <Grid container key={item.role} sx={{ borderBottom: `1px solid rgba(255,255,255,0.22)`, py: 2.5 }}>
                <Grid item xs={12} md={4}>
                  <Typography sx={{ color: M.card, fontWeight: 800 }}>{item.role}</Typography>
                </Grid>
                <Grid item xs={12} md={8}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>{item.text}</Typography>
                </Grid>
              </Grid>
            ))}
          </Box>
        </Container>
      </Box>

      <Box component="section" sx={{ bgcolor: M.paper, py: { xs: 9, md: 15 } }}>
        <Container maxWidth="lg">
          <SectionIntro eyebrow="Built for care" title="The parts of the service that must stay in view." />
          <Grid container spacing={0} sx={{ borderTop: `1px solid ${M.faint}` }}>
            {[
              { icon: Medication, title: 'Medication support', text: 'Administration records, exceptions and audit trails where the service provides medication support.' },
              { icon: FamilyRestroom, title: 'Family communication', text: 'Controlled access and feedback routes that keep families connected without weakening privacy.' },
              { icon: Security, title: 'Safety and oversight', text: 'Risks, incidents, actions, training and evidence gathered into a working picture.' },
            ].map((item) => (
              <Grid item xs={12} md={4} key={item.title}>
                <Box sx={{ p: { xs: 2.5, md: 3.5 }, minHeight: 240, borderBottom: `1px solid ${M.faint}`, borderRight: { md: `1px solid ${M.faint}` } }}>
                  <item.icon sx={{ color: M.tealDeep, fontSize: 28, mb: 3 }} />
                  <Typography component="h3" sx={{ ...M.h3, mb: 1 }}>{item.title}</Typography>
                  <Typography sx={{ ...M.body, color: M.slate }}>{item.text}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <Box component="section" sx={{ bgcolor: M.warm, borderTop: `1px solid ${M.faint}`, py: { xs: 8, md: 12 } }}>
        <Container maxWidth="md" sx={{ textAlign: 'center' }}>
          <Typography sx={{ ...M.h2, color: M.navy, mb: 2 }}>See how the working day comes together.</Typography>
          <Typography sx={{ ...M.bodyLg, color: M.slate, maxWidth: 600, mx: 'auto', mb: 4 }}>
            Explore the platform, compare domiciliary and supported living workflows, and talk to the team about your service.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <ActionLink label="Book a demo" to="/contact" />
            <TextLink label="Explore solutions" to="/solutions/domiciliary-care" />
          </Stack>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
