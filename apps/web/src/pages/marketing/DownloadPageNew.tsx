import { Box, Button, Container, Grid, Stack, Typography } from '@mui/material'
import { ArrowForward, Download, Check, Groups, CalendarMonth, Warning, Medication, FamilyRestroom, AccessTime } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { M } from '../../styles/marketing-tokens'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'

const appStoreUrl = import.meta.env.VITE_APP_STORE_URL || ''
const playStoreUrl = import.meta.env.VITE_GOOGLE_PLAY_URL || ''

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
      <Box sx={{ width: 8, height: 8, borderRadius: M.r.full, bgcolor: M.teal }} />
      <Typography sx={{ color: M.tealDeep, fontSize: M.caption.size, fontWeight: M.caption.weight, letterSpacing: M.caption.tracking, textTransform: 'uppercase' }}>{children}</Typography>
    </Stack>
  )
}

const features = [
  { icon: Groups, title: 'Client records', desc: 'View care plans, risk assessments, daily notes and body maps for each client — all from your phone.' },
  { icon: CalendarMonth, title: 'Schedule & availability', desc: 'See your weekly schedule, submit availability, request leave and pick up open calls from the marketplace.' },
  { icon: Medication, title: 'Medication reference', desc: 'Access medication records and MAR information where enabled — with clear permissions and audit trail.' },
  { icon: Warning, title: 'Incidents & safety', desc: 'Record incidents, report disruptions and access risk assessments while in the field.' },
  { icon: FamilyRestroom, title: 'Chat & communication', desc: 'Send messages, share images and stay connected with your team through secure in-app chat.' },
  { icon: AccessTime, title: 'Check-in & timesheets', desc: 'Check in and out of visits, track your hours and see your earnings — all in real time.' },
]

export default function DownloadPageNew() {
  const nav = useNavigate()

  return (
    <MarketingLayout>
      <PageMeta title="MeticleCare mobile app" description="MeticleCare gives care teams a field-ready mobile experience alongside the web application. Available for iOS and Android." canonicalPath="/download" />

      {/* Hero */}
      <Box sx={{ py: { xs: 10, md: 16 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <Eyebrow>Mobile app</Eyebrow>
              <Typography sx={{ fontSize: M.display.size, lineHeight: M.display.height, fontWeight: M.display.weight, letterSpacing: M.display.tracking, mb: 3 }}>
                MeticleCare wherever care happens.
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: M.bodyLg.size, lineHeight: M.bodyLg.height, mb: 4 }}>
                Give care teams access to the records and workflows they need in the field — while managers keep the wider operation in view. Available for iOS and Android.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                {appStoreUrl ? (
                  <Button component="a" href={appStoreUrl} target="_blank" rel="noreferrer" startIcon={<Download />} variant="contained" sx={{ bgcolor: M.ink, color: '#fff', fontWeight: 700, px: 3, py: 1.5, borderRadius: M.r.md, textTransform: 'none' }}>Download on the App Store</Button>
                ) : (
                  <Button disabled startIcon={<Download />} variant="outlined" sx={{ px: 3, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontWeight: 700 }}>App Store — coming soon</Button>
                )}
                {playStoreUrl ? (
                  <Button component="a" href={playStoreUrl} target="_blank" rel="noreferrer" startIcon={<Download />} variant="contained" sx={{ bgcolor: M.teal, color: M.navy, fontWeight: 700, px: 3, py: 1.5, borderRadius: M.r.md, textTransform: 'none' }}>Get it on Google Play</Button>
                ) : (
                  <Button disabled startIcon={<Download />} variant="outlined" sx={{ px: 3, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontWeight: 700 }}>Google Play — coming soon</Button>
                )}
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Box sx={{
                  width: 260, height: 520, borderRadius: '28px',
                  border: `3px solid ${M.subtle}`, bgcolor: M.card,
                  boxShadow: M.shadow.xl, display: 'flex', flexDirection: 'column', overflow: 'hidden',
                }}>
                  <Box sx={{ height: 40, bgcolor: M.faint, borderBottom: `1px solid ${M.subtle}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Box sx={{ width: 72, height: 20, borderRadius: 10, bgcolor: M.subtle }} />
                  </Box>
                  <Box sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box sx={{ height: 28, borderRadius: M.r.sm, bgcolor: M.tealSoft }} />
                    <Box sx={{ height: 16, width: '55%', borderRadius: M.r.sm, bgcolor: M.faint }} />
                    <Box sx={{ flex: 1, borderRadius: M.r.md, bgcolor: M.faint }} />
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Box sx={{ flex: 1, height: 70, borderRadius: M.r.sm, bgcolor: M.tealSoft }} />
                      <Box sx={{ flex: 1, height: 70, borderRadius: M.r.sm, bgcolor: M.faint }} />
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Features */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.card }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Eyebrow>What you can do</Eyebrow>
            <Typography sx={{ fontSize: M.h1.size, lineHeight: M.h1.height, fontWeight: M.h1.weight, letterSpacing: M.h1.tracking, mb: 2 }}>
              The full field experience.
            </Typography>
            <Typography sx={{ color: M.slate, fontSize: M.bodyLg.size, maxWidth: 560, mx: 'auto' }}>
              Everything care teams need for the work in front of them — without carrying a laptop or calling the office.
            </Typography>
          </Box>
          <Grid container spacing={2.5}>
            {features.map((f) => (
              <Grid item xs={12} sm={6} md={4} key={f.title}>
                <Box sx={{
                  p: 3.5, bgcolor: M.paper, borderRadius: M.r.lg, border: `1px solid ${M.faint}`, height: '100%',
                  transition: 'all 0.25s', '&:hover': { borderColor: M.teal, boxShadow: M.shadow.md },
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

      {/* For managers */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <Eyebrow>For managers</Eyebrow>
              <Typography sx={{ fontSize: M.h2.size, fontWeight: M.h2.weight, letterSpacing: M.h2.tracking, mb: 2 }}>
                Oversight from anywhere.
              </Typography>
              <Typography sx={{ color: M.slate, lineHeight: 1.7, mb: 3 }}>
                Managers can view the dashboard, approve leave, check call statuses, review incidents and monitor team performance — all from their phone. No need to be at a desk.
              </Typography>
              <Stack spacing={1.5}>
                {['View dashboard and key metrics', 'Approve leave and availability', 'Monitor call completion in real time', 'Review and respond to incidents', 'Approve rota changes and open calls'].map((item) => (
                  <Stack key={item} direction="row" spacing={1.5} alignItems="center">
                    <Check sx={{ color: M.teal, fontSize: 18 }} />
                    <Typography sx={{ fontWeight: 500 }}>{item}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Eyebrow>For carers</Eyebrow>
              <Typography sx={{ fontSize: M.h2.size, fontWeight: M.h2.weight, letterSpacing: M.h2.tracking, mb: 2 }}>
                Everything you need in the field.
              </Typography>
              <Typography sx={{ color: M.slate, lineHeight: 1.7, mb: 3 }}>
                Carers see their schedule, access client information, record care notes, check in and out of visits, report disruptions and communicate with the team — all from one focused mobile experience.
              </Typography>
              <Stack spacing={1.5}>
                {['View daily schedule and client details', 'Check in and out of visits', 'Record care notes and observations', 'Submit availability and leave', 'Pick up open calls from the marketplace'].map((item) => (
                  <Stack key={item} direction="row" spacing={1.5} alignItems="center">
                    <Check sx={{ color: M.teal, fontSize: 18 }} />
                    <Typography sx={{ fontWeight: 500 }}>{item}</Typography>
                  </Stack>
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
            Ready to get started?
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: M.bodyLg.size, mb: 4 }}>
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
