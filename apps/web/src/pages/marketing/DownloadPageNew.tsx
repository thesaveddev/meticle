import { Box, Button, Container, Grid, Stack, Typography, Chip } from '@mui/material'
import {
  ArrowForward, Download, Check, Groups, CalendarMonth, Warning,
  Medication, AccessTime, Person,
  ChatBubbleOutline, MapOutlined,
  NotificationsActiveOutlined, DescriptionOutlined,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { M } from '../../styles/marketing-tokens'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'

const appStoreUrl = import.meta.env.VITE_APP_STORE_URL || ''
const playStoreUrl = import.meta.env.VITE_GOOGLE_PLAY_URL || ''

function SectionLabel({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <Box sx={{ mb: 1, textAlign: center ? "center" : "left" }}>
      <Typography component="span" sx={{ fontSize: "0.75rem", lineHeight: 1.3, fontWeight: 700, letterSpacing: "0.08em", color: M.tealDeep, borderBottom: "2px solid " + M.teal, pb: 0.5, textTransform: "uppercase" }}>{children}</Typography>
    </Box>
  )
}

/* ─── Phone Frame Component ───────────────────────────── */

function PhoneFrame({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      {label && <Typography sx={{ fontWeight: 600, color: M.slate, fontSize: '0.85rem' }}>{label}</Typography>}
      <Box sx={{
        width: 240, height: 480, borderRadius: '28px',
        border: `3px solid ${M.subtle}`, bgcolor: M.card,
        boxShadow: M.shadow.xl, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Notch */}
        <Box sx={{ height: 32, bgcolor: M.faint, borderBottom: `1px solid ${M.faint}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ width: 64, height: 16, borderRadius: 8, bgcolor: M.subtle }} />
        </Box>
        {/* Screen content */}
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          {children}
        </Box>
        {/* Home bar */}
        <Box sx={{ height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: M.card }}>
          <Box sx={{ width: 80, height: 4, borderRadius: 2, bgcolor: M.subtle }} />
        </Box>
      </Box>
    </Box>
  )
}

/* ─── Mobile Screen Mockups ──────────────────────────── */

function ScheduleScreen() {
  const calls = [
    { time: '09:00', client: 'Margaret W.', task: 'Personal care', status: 'completed', color: '#22C55E' },
    { time: '10:30', client: 'John D.', task: 'Meal prep', status: 'in-progress', color: '#3B82F6' },
    { time: '13:00', client: 'Patricia L.', task: 'Medication', status: 'upcoming', color: '#94A3B8' },
    { time: '15:00', client: 'Robert H.', task: 'Companionship', status: 'upcoming', color: '#94A3B8' },
  ]
  return (
    <Box sx={{ p: 1.5 }}>
      <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: M.navy, mb: 1 }}>Today's Schedule</Typography>
      <Typography sx={{ fontSize: '0.6rem', color: M.muted, mb: 1.5 }}>4 visits · 2 completed</Typography>
      {calls.map((c, i) => (
        <Box key={i} sx={{ mb: 1, p: 1, borderRadius: M.r.sm, bgcolor: M.faint,  }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: M.navy }}>{c.time}</Typography>
            <Chip label={c.status} size="small" sx={{ height: 16, fontSize: '0.5rem', bgcolor: c.color + '20', color: c.color, fontWeight: 600 }} />
          </Stack>
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color: M.slate }}>{c.client}</Typography>
          <Typography sx={{ fontSize: '0.5rem', color: M.muted }}>{c.task}</Typography>
        </Box>
      ))}
    </Box>
  )
}

function ClientDetailScreen() {
  return (
    <Box sx={{ p: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: M.tealSoft, display: 'grid', placeItems: 'center' }}>
          <Person sx={{ fontSize: 16, color: M.tealDeep }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: M.navy }}>Margaret Wilson</Typography>
          <Typography sx={{ fontSize: '0.5rem', color: M.muted }}>DOB: 15/03/1942</Typography>
        </Box>
      </Stack>
      {['Care Plan', 'Medication', 'Risk Assessment', 'Daily Notes', 'Body Map'].map((item, i) => (
        <Box key={i} sx={{ mb: 0.75, p: 1, borderRadius: M.r.sm, bgcolor: i === 0 ? M.tealSoft : M.faint, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: i === 0 ? M.teal : M.subtle }} />
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 500, color: M.navy }}>{item}</Typography>
        </Box>
      ))}
    </Box>
  )
}

function ChatScreen() {
  return (
    <Box sx={{ p: 1.5 }}>
      <Typography sx={{ fontWeight: 700, fontSize: '0.7rem', color: M.navy, mb: 1.5 }}>Team Chat</Typography>
      {[
        { from: 'Sarah M.', msg: 'Just arrived at Margaret\'s. All good.', time: '09:12', me: false },
        { from: 'You', msg: 'Great, thanks for the update.', time: '09:13', me: true },
        { from: 'James K.', msg: 'Running 5 mins late to John D.', time: '10:25', me: false },
      ].map((m, i) => (
        <Box key={i} sx={{
          mb: 1, p: 1, borderRadius: M.r.sm,
          bgcolor: m.me ? M.teal : M.faint,
          maxWidth: '80%', ml: m.me ? 'auto' : 0,
        }}>
          {!m.me && <Typography sx={{ fontSize: '0.5rem', fontWeight: 600, color: M.tealDeep, mb: 0.25 }}>{m.from}</Typography>}
          <Typography sx={{ fontSize: '0.55rem', color: m.me ? M.navy : M.slate }}>{m.msg}</Typography>
          <Typography sx={{ fontSize: '0.45rem', color: m.me ? 'rgba(0,0,0,0.4)' : M.muted, mt: 0.25, textAlign: 'right' }}>{m.time}</Typography>
        </Box>
      ))}
    </Box>
  )
}

/* ─── Features Data ──────────────────────────────────── */

const features = [
  { icon: Groups, title: 'Client records', desc: 'View care plans, risk assessments, daily notes and body maps for each client — all from your phone.' },
  { icon: CalendarMonth, title: 'Schedule & availability', desc: 'See your weekly schedule, submit availability, request leave and pick up open calls from the marketplace.' },
  { icon: Medication, title: 'Medication reference', desc: 'Access medication records and MAR information where enabled — with clear permissions and audit trail.' },
  { icon: Warning, title: 'Incidents & safety', desc: 'Record incidents, report disruptions and access risk assessments while in the field.' },
  { icon: ChatBubbleOutline, title: 'Chat & communication', desc: 'Send messages, share images and stay connected with your team through secure in-app chat.' },
  { icon: AccessTime, title: 'Check-in & timesheets', desc: 'Check in and out of visits, track your hours and see your earnings — all in real time.' },
  { icon: MapOutlined, title: 'Live location', desc: 'Managers see where carers are in relation to their next visit. Travel time and route context.' },
  { icon: NotificationsActiveOutlined, title: 'Push notifications', desc: 'Instant alerts for schedule changes, new assignments, chat messages and urgent updates.' },
  { icon: DescriptionOutlined, title: 'Care notes in the field', desc: 'Record structured care notes at the point of care — not from memory at the end of the day.' },
]

const managerFeatures = [
  'View dashboard and key metrics from anywhere',
  'Approve leave and availability on the go',
  'Monitor call completion in real time',
  'Review and respond to incidents immediately',
  'Approve rota changes and open calls',
  'Receive instant push notifications for urgent events',
]

const carerFeatures = [
  'View daily schedule with client details',
  'Check in and out of visits with GPS',
  'Record care notes and observations',
  'Submit availability and request leave',
  'Pick up open calls from the marketplace',
  'Access care plans and medication records',
]

/* ─── Page Component ──────────────────────────────────── */

export default function DownloadPageNew() {
  const nav = useNavigate()

  return (
    <MarketingLayout>
      <PageMeta title="MeticleCare mobile app" description="MeticleCare's React Native mobile app gives care teams a field-ready experience alongside the web application. Store links will be published when the apps are available." canonicalPath="/download" />

      {/* ═══ HERO ═══ */}
      <Box sx={{ py: { xs: 10, md: 16 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <SectionLabel>Mobile app</SectionLabel>
              <Typography sx={{ fontSize: M.display.fontSize, lineHeight: M.display.lineHeight, fontWeight: M.display.fontWeight, letterSpacing: M.display.letterSpacing, mb: 3 }}>
                Care doesn't happen behind a desk. Neither should your software.
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, lineHeight: M.bodyLg.lineHeight, mb: 4 }}>
                Give care teams a focused mobile experience for the work in front of them — check in, record notes, report disruptions, view care plans and access client information. The app is built with React Native; App Store and Google Play links will be added once the releases are published.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                {appStoreUrl ? (
                  <Button component="a" href={appStoreUrl} target="_blank" rel="noreferrer" startIcon={<Download />} variant="contained" sx={{ bgcolor: M.ink, color: '#fff', fontWeight: 700, px: 3, py: 1.5, borderRadius: M.r.md, textTransform: 'none' }}>Download on the App Store</Button>
                ) : (
                  <Button disabled startIcon={<Download />} variant="outlined" sx={{ px: 3, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontWeight: 700 }}>App Store link pending</Button>
                )}
                {playStoreUrl ? (
                  <Button component="a" href={playStoreUrl} target="_blank" rel="noreferrer" startIcon={<Download />} variant="contained" sx={{ bgcolor: M.teal, color: M.navy, fontWeight: 700, px: 3, py: 1.5, borderRadius: M.r.md, textTransform: 'none' }}>Get it on Google Play</Button>
                ) : (
                  <Button disabled startIcon={<Download />} variant="outlined" sx={{ px: 3, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontWeight: 700 }}>Google Play link pending</Button>
                )}
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3 }}>
                <PhoneFrame label="Schedule">
                  <ScheduleScreen />
                </PhoneFrame>
                <PhoneFrame label="Client detail">
                  <ClientDetailScreen />
                </PhoneFrame>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ═══ FEATURES GRID ═══ */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.card }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <SectionLabel>What you can do</SectionLabel>
            <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing, mb: 2 }}>
              The full field experience.
            </Typography>
            <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, maxWidth: 560, mx: 'auto' }}>
              Everything care teams need for the work in front of them — without carrying a laptop or calling the office.
            </Typography>
          </Box>
          <Grid container spacing={2.5}>
            {features.map((f) => (
              <Grid item xs={12} sm={6} md={4} key={f.title}>
                <Box sx={{
                  p: 3.5, bgcolor: M.paper, borderRadius: M.r.lg, border: `1px solid ${M.faint}`, height: '100%',
                  transition: `all 0.25s`, '&:hover': { borderColor: M.teal, boxShadow: M.shadow.md },
                }}>
                  <Box sx={{ width: 48, height: 48, borderRadius: M.r.md, bgcolor: M.tealSoft, display: 'grid', placeItems: 'center', mb: 2.5 }}>
                    <f.icon sx={{ color: M.tealDeep, fontSize: 24 }} />
                  </Box>
                  <Typography sx={{ fontWeight: 700, mb: 1 }}>{f.title}</Typography>
                  <Typography sx={{ color: M.slate, fontSize: '0.9rem', lineHeight: 1.6 }}>{f.desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ═══ CHAT SCREEN + TWO AUDIENCES ═══ */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={4} sx={{ display: 'flex', justifyContent: 'center' }}>
              <PhoneFrame label="Team chat">
                <ChatScreen />
              </PhoneFrame>
            </Grid>
            <Grid item xs={12} md={8}>
              <Grid container spacing={4}>
                <Grid item xs={12} sm={6}>
                  <SectionLabel>For managers</SectionLabel>
                  <Typography sx={{ fontSize: M.h3.fontSize, fontWeight: M.h3.fontWeight, letterSpacing: M.h3.letterSpacing, mb: 2 }}>
                    Oversight from anywhere.
                  </Typography>
                  <Typography sx={{ color: M.slate, lineHeight: 1.7, mb: 3 }}>
                    Managers can view the dashboard, approve leave, check call statuses, review incidents and monitor team performance — all from their phone.
                  </Typography>
                  <Stack spacing={1.5}>
                    {managerFeatures.map((item) => (
                      <Stack key={item} direction="row" spacing={1.5} alignItems="center">
                        <Check sx={{ color: M.teal, fontSize: 18 }} />
                        <Typography sx={{ fontWeight: 500, fontSize: '0.9rem' }}>{item}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <SectionLabel>For carers</SectionLabel>
                  <Typography sx={{ fontSize: M.h3.fontSize, fontWeight: M.h3.fontWeight, letterSpacing: M.h3.letterSpacing, mb: 2 }}>
                    Everything you need in the field.
                  </Typography>
                  <Typography sx={{ color: M.slate, lineHeight: 1.7, mb: 3 }}>
                    Carers see their schedule, access client information, record care notes, check in and out of visits, report disruptions and communicate with the team.
                  </Typography>
                  <Stack spacing={1.5}>
                    {carerFeatures.map((item) => (
                      <Stack key={item} direction="row" spacing={1.5} alignItems="center">
                        <Check sx={{ color: M.teal, fontSize: 18 }} />
                        <Typography sx={{ fontWeight: 500, fontSize: '0.9rem' }}>{item}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ═══ CTA ═══ */}
      <Box sx={{ py: { xs: 10, md: 14 }, bgcolor: M.navy, textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing, color: M.card, mb: 2 }}>
            Ready to get started?
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: M.bodyLg.fontSize, mb: 4 }}>
            Download the app or talk to the team about your care operation.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.teal, color: M.navy, fontWeight: 700, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', '&:hover': { bgcolor: M.tealDark } }}>Book a demo</Button>
            {appStoreUrl && <Button component="a" href={appStoreUrl} target="_blank" rel="noreferrer" variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.25)', color: '#fff', fontWeight: 700, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none' }}>App Store</Button>}
            {playStoreUrl && <Button component="a" href={playStoreUrl} target="_blank" rel="noreferrer" variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.25)', color: '#fff', fontWeight: 700, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none' }}>Google Play</Button>}
          </Stack>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
