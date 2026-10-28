import { Box, Button, Container, Grid, Stack, Typography } from '@mui/material'
import {
  ArrowForward, Check, Groups, CalendarMonth, Medication, Warning,
  AccessTime, Person, PlayArrow, PhoneIphone, WarningAmber,
  SignalCellularAlt, Wifi, BatteryFull, ChevronRight,
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
    <Box sx={{ mb: 1.5, textAlign: center ? "center" : "left" }}>
      <Typography component="span" sx={{ fontSize: "0.75rem", lineHeight: 1.3, fontWeight: 700, letterSpacing: "0.1em", color: M.navy, textTransform: "uppercase" }}>{children}</Typography>
    </Box>
  )
}

/* White hero pill with blue dot — Figma 5.3 hero badge. */
function HeroPill({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, bgcolor: M.card, border: `1px solid ${M.hair}`, borderRadius: M.r.full, px: 2, py: 0.75, mb: 2.5, boxShadow: M.shadow.xs }}>
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: M.navy, flexShrink: 0 }} />
      <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: M.ink, lineHeight: 1.3 }}>{children}</Typography>
    </Box>
  )
}

/* Dark placeholder tag pinned to imagery — Figma photo notes. */
function PhotoTag({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{
      position: 'absolute', top: 16, left: 16, zIndex: 1,
      bgcolor: 'rgba(12,27,46,0.72)', color: '#FFFFFF',
      borderRadius: M.r.full, px: 1.75, py: 0.625,
      fontSize: '0.72rem', fontWeight: 600,
    }}>
      {children}
    </Box>
  )
}

/* ─── Phone Frame Component (black device frame, status bar) ─── */

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ width: 250, flexShrink: 0, borderRadius: '38px', bgcolor: '#0C1B2E', p: '10px', boxShadow: M.shadow.xl }}>
      <Box sx={{ borderRadius: '30px', bgcolor: M.card, overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, pt: 1.25, pb: 0.75 }}>
          <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: M.ink }}>9:41</Typography>
          <Box sx={{ width: 64, height: 15, borderRadius: 8, bgcolor: '#0C1B2E' }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
            <SignalCellularAlt sx={{ fontSize: 11, color: M.ink }} />
            <Wifi sx={{ fontSize: 11, color: M.ink }} />
            <BatteryFull sx={{ fontSize: 13, color: M.ink }} />
          </Box>
        </Box>
        {children}
      </Box>
    </Box>
  )
}

function PhoneTabBar({ active }: { active: number }) {
  const icons = [CalendarMonth, Groups, ChatBubbleOutline, AccessTime]
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: `1px solid ${M.faint}`, mt: 1.5, py: 1.25 }}>
      {icons.map((Icon, i) => (
        <Icon key={i} sx={{ fontSize: 17, color: i === active ? M.navy : M.subtle }} />
      ))}
    </Box>
  )
}

/* ─── Mobile Screen Mockups (Figma 5.3 hero) ─────────────────── */

function ScheduleScreen() {
  const calls = [
    { time: '09:00', client: 'Margaret W.', task: 'Personal care', status: 'Completed', tone: 'live' as const },
    { time: '10:30', client: 'John D.', task: 'Meal prep', status: 'In progress', tone: 'link' as const },
    { time: '13:00', client: 'Patricia L.', task: 'Medication', status: 'Upcoming', tone: 'outline' as const },
    { time: '15:00', client: 'Robert H.', task: 'Companionship', status: 'Upcoming', tone: 'outline' as const },
  ]
  const badge: Record<string, { color: string; bgcolor: string; border?: string }> = {
    live: { color: '#FFFFFF', bgcolor: M.green },
    link: { color: '#FFFFFF', bgcolor: M.navy },
    outline: { color: M.slate, bgcolor: 'transparent', border: `1px solid ${M.rule}` },
  }
  return (
    <Box sx={{ px: 1.75, pt: 0.5 }}>
      <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: M.ink }}>Today's schedule</Typography>
      <Typography sx={{ fontSize: '0.62rem', color: M.slate, mb: 1 }}>4 visits · 2 completed</Typography>
      {calls.map((c) => (
        <Box key={c.time} sx={{ mb: 0.75, p: 1, borderRadius: M.r.sm, bgcolor: M.paper }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: M.navy }}>{c.time}</Typography>
            <Box sx={{ borderRadius: M.r.full, px: 1, py: 0.25, fontSize: '0.52rem', fontWeight: 700, ...badge[c.tone], border: badge[c.tone].border ?? 'none' }}>
              {c.status}
            </Box>
          </Stack>
          <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: M.ink, mt: 0.25 }}>{c.client}</Typography>
          <Typography sx={{ fontSize: '0.55rem', color: M.slate }}>{c.task}</Typography>
        </Box>
      ))}
      <Button fullWidth size="small" sx={{ bgcolor: M.navy, color: '#FFFFFF', textTransform: 'none', fontWeight: 600, fontSize: '0.62rem', borderRadius: M.r.sm, py: 0.75, mt: 0.5, '&:hover': { bgcolor: M.navyMid } }}>
        Check in to John D.
      </Button>
      <PhoneTabBar active={0} />
    </Box>
  )
}

function ClientDetailScreen() {
  const items = ['Care plan', 'Medication', 'Risk assessment', 'Daily notes', 'Body map']
  return (
    <Box sx={{ px: 1.75, pt: 0.5 }}>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1.5 }}>
        <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: M.ink, color: '#FFFFFF', fontSize: '0.72rem', fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          MW
        </Box>
        <Box>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: M.ink }}>Margaret Wilson</Typography>
          <Typography sx={{ fontSize: '0.58rem', color: M.slate }}>Client detail</Typography>
        </Box>
      </Stack>
      {items.map((item, i) => (
        <Box key={item} sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          py: 0.9, borderBottom: i < items.length - 1 ? `1px solid ${M.faint}` : 'none',
        }}>
          <Typography sx={{ fontSize: '0.62rem', fontWeight: 500, color: M.ink }}>{item}</Typography>
          <ChevronRight sx={{ fontSize: 14, color: M.subtle }} />
        </Box>
      ))}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1, mt: 1.25,
        bgcolor: M.amberBand, borderRadius: M.r.sm, px: 1.25, py: 1,
      }}>
        <WarningAmber sx={{ fontSize: 15, color: M.amberText, flexShrink: 0 }} />
        <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: M.amberText }}>Fall risk — high</Typography>
      </Box>
      <PhoneTabBar active={1} />
    </Box>
  )
}

function ChatScreen() {
  return (
    <Box sx={{ p: 1.5 }}>
      <Typography sx={{ fontWeight: 600, fontSize: '0.7rem', color: M.navy, mb: 1.5 }}>Team Chat</Typography>
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

/* ─── Store buttons (Figma: white, grey border, pending-release note) ─── */

function StoreButton({ icon: Icon, store, href }: { icon: React.ElementType; store: string; href?: string }) {
  return (
    <Box
      component={href ? 'a' : 'div'}
      {...(href ? { href, target: '_blank', rel: 'noreferrer' } : {})}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, textDecoration: 'none',
        bgcolor: M.card, border: `1px solid ${M.rule}`, borderRadius: M.r.md,
        px: 2.5, py: 1.5, minWidth: 215,
        ...(href ? { cursor: 'pointer', '&:hover': { borderColor: M.navy } } : {}),
      }}
    >
      <Icon sx={{ fontSize: 28, color: M.ink, flexShrink: 0 }} />
      <Box>
        <Typography sx={{ fontWeight: 700, color: M.ink, fontSize: '0.92rem', lineHeight: 1.3 }}>{store}</Typography>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <AccessTime sx={{ fontSize: 12, color: M.slate }} />
          <Typography sx={{ fontSize: '0.72rem', color: M.slate }}>Link pending release</Typography>
        </Stack>
      </Box>
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
  { icon: AccessTime, title: 'Check-in & timesheets', desc: 'Check in and out of visits, track your hours and see your earnings, updated whenever you open the app or come back online.' },
  { icon: MapOutlined, title: 'Visit check-in map', desc: 'Managers see the position each carer recorded when they checked in or out, against the visit. It is a check-in record, not live tracking of where someone is now.' },
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
      <Box sx={{ pt: { xs: 8, md: 10 }, pb: { xs: 10, md: 16 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 4 }}>
            <Typography component="button" type="button" onClick={() => nav('/platform')} sx={{ border: 0, bgcolor: 'transparent', cursor: 'pointer', color: M.slate, fontSize: '0.8rem', p: 0, fontFamily: M.font, '&:hover': { textDecoration: 'underline' } }}>
              Solutions
            </Typography>
            <Typography sx={{ color: M.subtle, fontSize: '0.8rem' }}>/</Typography>
            <Typography sx={{ color: M.navy, fontSize: '0.8rem', fontWeight: 600 }}>Mobile App</Typography>
          </Stack>
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <HeroPill>Mobile app</HeroPill>
              <Typography sx={{ fontSize: M.display.fontSize, lineHeight: M.display.lineHeight, fontWeight: M.display.fontWeight, letterSpacing: M.display.letterSpacing, color: M.ink, mb: 3 }}>
                Care doesn't happen behind a desk. Neither should your software.
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, lineHeight: M.bodyLg.lineHeight, mb: 4 }}>
                Give care teams a focused mobile experience for the work in front of them — check in, record notes, report disruptions, view care plans and access client information.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <StoreButton icon={PhoneIphone} store="App Store" href={appStoreUrl || undefined} />
                <StoreButton icon={PlayArrow} store="Google Play" href={playStoreUrl || undefined} />
              </Stack>
              <Typography sx={{ color: M.muted, fontSize: '0.8rem' }}>
                Built with React Native. Store links will be added once the releases are published.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ bgcolor: M.card, border: `1px solid ${M.faint}`, borderRadius: '20px', p: { xs: 3, md: 4 }, display: 'flex', justifyContent: 'center', gap: 3, flexWrap: 'wrap' }}>
                <PhoneFrame>
                  <ScheduleScreen />
                </PhoneFrame>
                <PhoneFrame>
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
          <Grid container spacing={{ xs: 3, md: 10 }} sx={{ mb: { xs: 5, md: 6 } }}>
            <Grid item xs={12} md={6}>
              <SectionLabel>What you can do</SectionLabel>
              <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing, color: M.ink }}>
                The full field experience.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'flex-end' }}>
              <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, lineHeight: M.bodyLg.lineHeight }}>
                Everything care teams need for the work in front of them — without carrying a laptop or calling the office.
              </Typography>
            </Grid>
          </Grid>
          <Grid container spacing={2.5}>
            {features.map((f) => (
              <Grid item xs={12} sm={6} md={4} key={f.title}>
                <Box sx={{
                  p: 3.5, bgcolor: M.card, borderRadius: M.r.lg, border: `1px solid ${M.faint}`, height: '100%',
                  transition: `all 0.25s`, '&:hover': { borderColor: M.navy, boxShadow: M.shadow.md },
                }}>
                  <f.icon sx={{ color: M.ink, fontSize: 24, mb: 2 }} />
                  <Typography sx={{ fontWeight: 700, color: M.ink, mb: 1 }}>{f.title}</Typography>
                  <Typography sx={{ color: M.slate, fontSize: '0.9rem', lineHeight: 1.6 }}>{f.desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ═══ PHOTO BANNER ═══ */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.card }}>
        <Container maxWidth="lg">
          <Box sx={{ position: 'relative', borderRadius: '16px', bgcolor: M.paper, minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', p: 4 }}>
            <PhotoTag>Photo placeholder · shot 7</PhotoTag>
            <Stack alignItems="center" spacing={1.5}>
              <PhoneIphone sx={{ fontSize: 32, color: M.subtle }} />
              <Typography sx={{ color: M.slate, fontSize: '0.9rem' }}>
                Care team using the mobile app in the field.
              </Typography>
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* ═══ CHAT SCREEN + TWO AUDIENCES ═══ */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 8 }} alignItems="center">
            <Grid item xs={12} md={4}>
              <SectionLabel>For managers</SectionLabel>
              <Typography sx={{ fontSize: M.h3.fontSize, fontWeight: M.h3.fontWeight, letterSpacing: M.h3.letterSpacing, color: M.ink, mb: 2 }}>
                Oversight from anywhere.
              </Typography>
              <Typography sx={{ color: M.slate, lineHeight: 1.7, mb: 3 }}>
                Managers can view the dashboard, approve leave, check call statuses, review incidents and monitor team performance — all from their phone.
              </Typography>
              <Stack spacing={1.5}>
                {managerFeatures.map((item) => (
                  <Stack key={item} direction="row" spacing={1.5} alignItems="center">
                    <Check sx={{ color: M.navy, fontSize: 18 }} />
                    <Typography sx={{ fontWeight: 500, fontSize: '0.9rem', color: M.ink }}>{item}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Grid>
            <Grid item xs={12} md={4} sx={{ display: 'flex', justifyContent: 'center' }}>
              <PhoneFrame>
                <ChatScreen />
              </PhoneFrame>
            </Grid>
            <Grid item xs={12} md={4}>
              <SectionLabel>For carers</SectionLabel>
              <Typography sx={{ fontSize: M.h3.fontSize, fontWeight: M.h3.fontWeight, letterSpacing: M.h3.letterSpacing, color: M.ink, mb: 2 }}>
                Everything you need in the field.
              </Typography>
              <Typography sx={{ color: M.slate, lineHeight: 1.7, mb: 3 }}>
                Carers see their schedule, access client information, record care notes, check in and out of visits, report disruptions and communicate with the team.
              </Typography>
              <Stack spacing={1.5}>
                {carerFeatures.map((item) => (
                  <Stack key={item} direction="row" spacing={1.5} alignItems="center">
                    <Check sx={{ color: M.navy, fontSize: 18 }} />
                    <Typography sx={{ fontWeight: 500, fontSize: '0.9rem', color: M.ink }}>{item}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ═══ CTA — white-split, matches the rest of the marketing site ═══ */}
      <Box sx={{ py: { xs: 10, md: 14 }, bgcolor: M.card, borderTop: `1px solid ${M.faint}` }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 4, md: 6 }} alignItems="center">
            <Grid item xs={12} md={7}>
              <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing, color: M.ink, mb: 2 }}>
                Ready to get started?
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, lineHeight: M.bodyLg.lineHeight }}>
                Download the app or talk to the team about your care operation.
              </Typography>
            </Grid>
            <Grid item xs={12} md={5}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent={{ md: 'flex-end' }} sx={{ mb: 2.5 }}>
                <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', '&:hover': { bgcolor: M.navyHover } }}>Book a demo</Button>
                <Button variant="outlined" onClick={() => nav('/contact')} sx={{ borderColor: M.navy, color: M.navy, fontWeight: 600, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', '&:hover': { borderColor: M.navy, bgcolor: 'rgba(1,100,200,0.06)' } }}>Ask us a question</Button>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1, sm: 3 }}>
                {[
                  { icon: AccessTime, label: '30-minute scoping call' },
                  { icon: Check, label: '14-day free trial' },
                  { icon: Person, label: 'Named point of contact' },
                ].map((t) => (
                  <Stack key={t.label} direction="row" spacing={1} alignItems="center">
                    <t.icon sx={{ color: M.slate, fontSize: 16 }} />
                    <Typography sx={{ color: M.slate, fontSize: '0.82rem', fontWeight: 500 }}>{t.label}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
