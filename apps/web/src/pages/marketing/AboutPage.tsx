import { Box, Button, Container, Grid, Stack, Typography } from '@mui/material'
import {
  ArrowForward, Assignment, AutoAwesome, BarChart, Check, Close, Favorite,
  Home, Medication, People, VerifiedUser, Warning,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { M } from '../../styles/marketing-tokens'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'
import SplitText from '../../components/marketing/SplitText'
import { useScrollReveal } from '../../styles/useScrollReveal'

/* Figma · MeticleCare Website Redesign · 1.2 About (Desktop 1440 / Mobile 390).
 * Section order, copy, spacing, container rules and dividers follow the About
 * desktop frame exactly. Checklist for this file (and every page after it):
 *  1. Copy is verbatim from the frame — titles included ("Rota planning",
 *     "Summaries, detection and copilot"), never paraphrased or re-cased.
 *  2. Container vs card: a bordered box in the file stays ONE connected
 *     container here (radius + dividers); cells never get their own radii.
 *  3. Every icon in the file is rendered (arrows, crosses, checks, cell icons).
 *  4. Photo overlay tags are rendered; "Photo placeholder" annotations are not.
 *  5. Top-rule rows keep the file's stroke colour (blue first, grey the rest).
 *  6. Cover art and photos are exported Figma images, never CSS approximations.
 */

const HAIRLINE = M.hair
const GREY_RULE = M.rule

const heroChecks = ['30-minute scoping call', '14-day free trial', 'Named point of contact']

const operatingCells = [
  { icon: Favorite, label: 'Care delivery' },
  { icon: People, label: 'People' },
  { icon: Medication, label: 'Medication' },
  { icon: Warning, label: 'Risk' },
  { icon: Assignment, label: 'Incidents' },
  { icon: VerifiedUser, label: 'Compliance' },
  { icon: BarChart, label: 'Reporting' },
  { icon: Home, label: 'Families' },
  { icon: AutoAwesome, label: 'Intelligence' },
]

const facts = [
  { value: '4', label: 'UK nations supported' },
  { value: 'Web + mobile', label: 'For office teams and carers' },
  { value: 'UK', label: 'Record storage' },
]

const timeline = [
  {
    n: '01', phase: 'Foundation', title: 'Care operations are broken.',
    body: 'Providers were drowning in disconnected systems — spreadsheets for rotas, paper notes for care records, messaging apps for team communication. Nothing connected. Nothing was searchable. Inspections meant weeks of scrambling.',
  },
  {
    n: '02', phase: 'Vision', title: 'One connected platform.',
    body: 'MeticleCare was built to bring every part of care operations together — care delivery, scheduling, medication, risk, compliance, workforce and families — in one platform that works on web and mobile.',
  },
  {
    n: '03', phase: 'Growth', title: 'Built for the UK.',
    body: 'Designed for domiciliary and supported living providers across all four UK nations, with proper awareness of CQC, Care Inspectorate, CIW and RQIA contexts — not generic healthcare templates.',
  },
  {
    n: '04', phase: 'Intelligence', title: 'AI that works with records.',
    body: 'Intelligence that analyses the data teams already create — care summaries, record change summaries, compliance copilot, risk signals and manager briefings — with source traceability and human review at the centre.',
  },
]

const beforeRows = [
  'Spreadsheets for rotas',
  'Paper notes for care records',
  'Messaging apps for team updates',
  'Weeks of scrambling before inspection',
]

const afterRows = [
  'One schedule and a live call board',
  'Searchable digital care records',
  'Team chat and notifications in one place',
  'Evidence captured every day',
]

const principles = [
  {
    n: '01', title: 'Connected care',
    body: 'Care delivery, people, medication, risk and compliance should not live in separate systems. When information is connected, teams make better decisions faster.',
  },
  {
    n: '02', title: 'Trust by design',
    body: 'Security and privacy are core product concerns. Every feature is built with tenant isolation, role-based access and auditability from the start.',
  },
  {
    n: '03', title: 'Intelligent assistance',
    body: 'AI should reduce administration and surface patterns — not replace professional judgement. Every AI output is assistive, source-linked and auditable.',
  },
  {
    n: '04', title: 'Practical outcomes',
    body: 'The measure of good software is whether it helps people spend less time on administration and more time delivering care. That is what we design for.',
  },
]

const workValues = [
  'Trust and compliance',
  'People first',
  'Value driven',
  'Continuous improvement',
]

function EyebrowPill({ children }: { children: string }) {
  return (
    <Box
      data-reveal
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 1,
        bgcolor: M.card, border: `1px solid ${HAIRLINE}`, borderRadius: M.r.full,
        px: 1.5, py: 0.75, mb: 2.5, boxShadow: M.shadow.xs,
      }}
    >
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: M.navy }} />
      <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: M.ink }}>{children}</Typography>
    </Box>
  )
}

export default function AboutPage() {
  const nav = useNavigate()
  const revealRoot = useScrollReveal<HTMLDivElement>()

  return (
    <MarketingLayout>
      <Box ref={revealRoot} sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <PageMeta
          title="About MeticleCare"
          description="MeticleCare exists because care operations deserve better. This is where care operations come together."
          canonicalPath="/about"
        />

        {/* Mobile-only breadcrumb (About — Mobile 390) */}
        <Box sx={{ display: { xs: 'block', md: 'none' }, px: 2.5, pt: 2, bgcolor: '#FFFFFF' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography
              component="button" type="button" onClick={() => nav('/')}
              sx={{ border: 0, bgcolor: 'transparent', color: M.slate, fontSize: '0.8rem', cursor: 'pointer', p: 0 }}
            >
              Home
            </Typography>
            <Typography sx={{ color: M.slate, fontSize: '0.8rem' }}>›</Typography>
            <Typography sx={{ bgcolor: M.heroTint, color: M.ink, fontSize: '0.8rem', fontWeight: 600, borderRadius: M.r.full, px: 1.25, py: 0.5 }}>
              About
            </Typography>
          </Stack>
        </Box>

        {/* ═══ HERO ═══ */}
        <Box
          data-reveal-group
          sx={{
            position: 'relative', overflow: 'clip',
            background: `linear-gradient(180deg, ${M.heroTint} 0%, ${M.paper} 55%, ${M.card} 100%)`,
            pt: { xs: 8, md: '128px' }, pb: { xs: 7, md: '96px' },
          }}
        >
          <Box aria-hidden sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <Box sx={{ position: 'absolute', width: 560, height: 560, right: '-4%', top: '-12%', borderRadius: '50%', bgcolor: 'rgba(1,100,200,0.12)', filter: 'blur(140px)' }} />
            <Box sx={{ position: 'absolute', width: 420, height: 420, right: '6%', top: '30%', borderRadius: '50%', bgcolor: 'rgba(3,198,177,0.12)', filter: 'blur(140px)' }} />
          </Box>

          <Container maxWidth="lg" sx={{ position: 'relative' }}>
            <Grid container spacing={{ xs: 4, md: 10 }} sx={{ mb: { xs: 5, md: 8 } }}>
              <Grid item xs={12} md={7}>
                <EyebrowPill>About MeticleCare</EyebrowPill>
                <SplitText
                  text="This is where care operations come together."
                  style={{ ...M.display, color: M.ink }}
                />
              </Grid>
              <Grid item xs={12} md={5} sx={{ display: 'flex', alignItems: 'flex-end' }}>
                <Box>
                  <Typography data-reveal sx={{ ...M.body, color: M.slate, mb: 2 }}>
                    Care teams should not have to search across paperwork, spreadsheets, messages and disconnected systems to understand what happened and what needs attention.
                  </Typography>
                  <Typography data-reveal data-reveal-delay="0.1" sx={{ ...M.body, color: M.ink, fontWeight: 600 }}>
                    MeticleCare exists because care operations deserve better.
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            <Box
              data-reveal
              component="img"
              src="/figma/about-team.png"
              alt="MeticleCare team"
              sx={{ display: 'block', width: '100%', height: 'auto', borderRadius: '24px', boxShadow: M.shadow.lg, mb: { xs: 4, md: 6 } }}
            />

            {/* Operating layer: one connected box, header + 3×3 icon cells */}
            <Box
              data-reveal
              sx={{ borderRadius: '16px', border: `1px solid ${HAIRLINE}`, bgcolor: M.card, overflow: 'hidden', mb: { xs: 4, md: 5 } }}
            >
              <Box sx={{
                px: 3.5, py: 2.25, bgcolor: M.paper, display: 'flex',
                alignItems: 'center', justifyContent: 'space-between', gap: 3, flexWrap: 'wrap',
              }}>
                <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: M.ink }}>
                  The operating layer for modern care providers
                </Typography>
                <Typography sx={{ fontSize: '0.85rem', color: M.slate }}>
                  One platform, connecting:
                </Typography>
              </Box>
              <Grid container spacing={0}>
                {operatingCells.map((c, i) => (
                  <Grid item xs={6} sm={4} key={c.label}>
                    <Box sx={{
                      px: 3.5, py: 2.25, display: 'flex', alignItems: 'center', gap: 1.5,
                      borderTop: `1px solid ${HAIRLINE}`,
                      borderRight: { xs: i % 2 === 0 ? `1px solid ${HAIRLINE}` : 'none', sm: i % 3 !== 2 ? `1px solid ${HAIRLINE}` : 'none' },
                    }}>
                      <c.icon sx={{ fontSize: 18, color: M.slate, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: '0.92rem', fontWeight: 500, color: M.ink }}>{c.label}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>

            {/* Facts */}
            <Grid data-reveal container spacing={{ xs: 3, md: 0 }}>
              {facts.map((f, i) => (
                <Grid item xs={12} sm={4} key={f.label}>
                  <Box sx={{ pl: { sm: i === 0 ? 0 : 4 } }}>
                    <Typography sx={{ fontSize: '2.5rem', fontWeight: 700, color: M.ink, lineHeight: 1.1 }}>
                      {f.value}
                    </Typography>
                    <Typography sx={{ fontSize: '0.9rem', color: M.slate, mt: 0.5 }}>
                      {f.label}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        {/* ═══ OUR STORY ═══ */}
        <Box data-reveal-group sx={{ py: { xs: 8, md: '104px' }, bgcolor: M.paper }}>
          <Container maxWidth="lg">
            <Grid container spacing={{ xs: 5, md: 12 }}>
              <Grid item xs={12} md={4}>
                <Typography data-reveal sx={{ color: M.navy, fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', mb: 2, display: 'block' }}>
                  Our story
                </Typography>
                <Typography data-reveal component="h2" sx={{ ...M.h1, color: M.ink, mb: 2 }}>
                  From a problem to a platform.
                </Typography>
                <Typography data-reveal data-reveal-delay="0.1" sx={{ ...M.body, color: M.slate }}>
                  MeticleCare started with a simple observation: the people delivering care were spending too much of their day fighting their tools.
                </Typography>
              </Grid>
              <Grid item xs={12} md={8}>
                {timeline.map((t, i) => (
                  <Box key={t.n} data-reveal data-reveal-delay={`${i * 0.06}`} sx={{ display: 'flex', gap: 2.5 }}>
                    {/* Rail: numbered circle + connecting line (blue on the last stop) */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <Box sx={{
                        width: 36, height: 36, borderRadius: '50%', bgcolor: M.card,
                        border: `1.5px solid ${i === timeline.length - 1 ? M.navy : GREY_RULE}`,
                        display: 'grid', placeItems: 'center',
                      }}>
                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: i === timeline.length - 1 ? M.navy : M.ink }}>
                          {t.n}
                        </Typography>
                      </Box>
                      {i < timeline.length - 1 && (
                        <Box sx={{ width: '1px', flex: 1, minHeight: 24, bgcolor: GREY_RULE }} />
                      )}
                    </Box>
                    <Box sx={{ pb: i === timeline.length - 1 ? 0 : 5, pt: 0.75 }}>
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: M.slate, mb: 0.75 }}>
                        {t.phase}
                      </Typography>
                      <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: M.ink, mb: 1 }}>
                        {t.title}
                      </Typography>
                      <Typography sx={{ color: M.slate, fontSize: '0.95rem', lineHeight: 1.65 }}>
                        {t.body}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Grid>
            </Grid>
          </Container>
        </Box>

        {/* ═══ BEFORE AND AFTER ═══ */}
        <Box data-reveal-group sx={{ py: { xs: 8, md: '104px' }, bgcolor: M.card }}>
          <Container maxWidth="lg">
            <Grid container spacing={{ xs: 4, md: 10 }} sx={{ mb: { xs: 5, md: 7 } }}>
              <Grid item xs={12} md={7}>
                <Typography data-reveal sx={{ color: M.navy, fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', mb: 2, display: 'block' }}>
                  Why it matters
                </Typography>
                <Typography data-reveal component="h2" sx={{ ...M.h1, color: M.ink }}>
                  What changes when operations connect.
                </Typography>
              </Grid>
              <Grid item xs={12} md={5} sx={{ display: 'flex', alignItems: 'flex-end' }}>
                <Typography data-reveal data-reveal-delay="0.1" sx={{ ...M.bodyLg, color: M.slate }}>
                  The same care, delivered with less chasing, less duplication and less scrambling before inspection.
                </Typography>
              </Grid>
            </Grid>
            <Grid container spacing={{ xs: 5, md: 8 }}>
              <Grid item xs={12} md={6}>
                <Typography data-reveal sx={{ fontSize: '1rem', fontWeight: 700, color: M.slate, pb: 2 }}>
                  Before
                </Typography>
                {beforeRows.map((row) => (
                  <Box
                    key={row} data-reveal
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5,
                      borderTop: `1px solid ${HAIRLINE}`, py: 1.75,
                    }}
                  >
                    <Close sx={{ fontSize: 16, color: M.slate, flexShrink: 0 }} />
                    <Typography sx={{ fontSize: '0.95rem', color: M.slate }}>{row}</Typography>
                  </Box>
                ))}
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography data-reveal sx={{ fontSize: '1rem', fontWeight: 700, color: M.ink, pb: 2 }}>
                  With MeticleCare
                </Typography>
                {afterRows.map((row) => (
                  <Box
                    key={row} data-reveal
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5,
                      borderTop: `1px solid ${M.navy}`, py: 1.75,
                    }}
                  >
                    <Check sx={{ fontSize: 16, color: M.navy, flexShrink: 0 }} />
                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 500, color: M.ink }}>{row}</Typography>
                  </Box>
                ))}
              </Grid>
            </Grid>
          </Container>
        </Box>

        {/* ═══ PRINCIPLES ═══ */}
        <Box data-reveal-group sx={{ py: { xs: 8, md: '104px' }, bgcolor: M.paper }}>
          <Container maxWidth="lg">
            <Grid container spacing={{ xs: 4, md: 10 }} sx={{ mb: { xs: 5, md: 7 } }}>
              <Grid item xs={12} md={7}>
                <Typography data-reveal sx={{ color: M.navy, fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', mb: 2, display: 'block' }}>
                  What we believe
                </Typography>
                <Typography data-reveal component="h2" sx={{ ...M.h1, color: M.ink }}>
                  Principles that guide the product.
                </Typography>
              </Grid>
              <Grid item xs={12} md={5} sx={{ display: 'flex', alignItems: 'flex-end' }}>
                <Typography data-reveal data-reveal-delay="0.1" sx={{ ...M.bodyLg, color: M.slate }}>
                  Four ideas shape every decision we make — from what we build next to how we handle a single record.
                </Typography>
              </Grid>
            </Grid>
            <Grid container spacing={{ xs: 4, md: 6 }}>
              {principles.map((p, i) => (
                <Grid item xs={12} md={6} key={p.n}>
                  {/* Top rule only — no card radius or border, per the frame */}
                  <Box data-reveal data-reveal-delay={`${(i % 2) * 0.07}`} sx={{ borderTop: `1px solid ${GREY_RULE}`, pt: 2.5 }}>
                    <Stack direction="row" spacing={1.5} alignItems="baseline" sx={{ mb: 1.25 }}>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: M.navy }}>{p.n}</Typography>
                      <Typography sx={{ fontSize: '1.15rem', fontWeight: 700, color: M.ink }}>{p.title}</Typography>
                    </Stack>
                    <Typography sx={{ color: M.slate, fontSize: '0.92rem', lineHeight: 1.65 }}>{p.body}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        {/* ═══ MISSION ═══ */}
        <Box data-reveal-group sx={{ py: { xs: 8, md: '120px' }, bgcolor: '#FFFFFF' }}>
          <Container maxWidth="lg">
            <Typography data-reveal sx={{ color: M.navy, fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', mb: 3, display: 'block' }}>
              Our mission
            </Typography>
            <Box data-reveal sx={{ display: 'flex', gap: 4 }}>
              <Box sx={{ width: 3, bgcolor: M.navy, flexShrink: 0, borderRadius: 2 }} />
              <Typography component="p" sx={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 600, lineHeight: 1.3, letterSpacing: '-0.02em', color: M.ink, maxWidth: 960 }}>
                Help care providers spend less time processing information and more time delivering care — while keeping the evidence, compliance and governance that inspection-ready services need.
              </Typography>
            </Box>
          </Container>
        </Box>

        {/* ═══ HOW WE WORK ═══ */}
        <Box data-reveal-group sx={{ py: { xs: 7, md: '64px' }, bgcolor: M.paper }}>
          <Container maxWidth="lg">
            <Grid container spacing={{ xs: 4, md: 12 }}>
              <Grid item xs={12} md={4}>
                <Typography data-reveal sx={{ fontSize: '1.875rem', fontWeight: 700, letterSpacing: '-0.02em', color: M.ink, mb: 1.5 }}>
                  How we work
                </Typography>
                <Typography data-reveal data-reveal-delay="0.1" sx={{ ...M.body, color: M.slate }}>
                  We ship every week and push updates at the weekend — so Monday is quieter than last Monday.
                </Typography>
              </Grid>
              <Grid item xs={12} md={8}>
                {workValues.map((v) => (
                  <Box
                    key={v} data-reveal
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5,
                      borderTop: `1px solid ${GREY_RULE}`, py: 1.625,
                    }}
                  >
                    <Check sx={{ fontSize: 16, color: M.navy, flexShrink: 0 }} />
                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 500, color: M.ink }}>{v}</Typography>
                  </Box>
                ))}
              </Grid>
            </Grid>
          </Container>
        </Box>

        {/* ═══ CTA ═══ */}
        <Box data-reveal-group sx={{ py: { xs: 8, md: '96px' }, bgcolor: '#FFFFFF' }}>
          <Container maxWidth="lg">
            <Grid container spacing={{ xs: 4, md: 6 }} alignItems="center" justifyContent="space-between">
              <Grid item xs={12} md={7}>
                <Typography data-reveal component="h2" sx={{ ...M.display, color: M.ink, mb: 2 }}>
                  Run your care operation with more clarity.
                </Typography>
                <Typography data-reveal data-reveal-delay="0.1" sx={{ ...M.bodyLg, color: M.slate, maxWidth: 600 }}>
                  Talk to the team about how MeticleCare can support your service.
                </Typography>
              </Grid>
              <Grid item xs={12} md={5}>
                <Stack data-reveal data-reveal-delay="0.18" direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2.5 }}>
                  <Button
                    variant="contained" endIcon={<ArrowForward />}
                    onClick={() => nav('/contact')}
                    sx={{ px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', fontWeight: 600, bgcolor: M.navy, boxShadow: 'none', '&:hover': { bgcolor: M.navyMid, boxShadow: 'none' } }}
                  >Book a demo</Button>
                  <Button
                    variant="outlined" endIcon={<ArrowForward />}
                    onClick={() => nav('/platform')}
                    sx={{ px: 3.5, py: 1.5, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.95rem', fontWeight: 600, color: M.ink, borderColor: M.subtle, '&:hover': { borderColor: M.navy, bgcolor: M.card } }}
                  >Explore the platform</Button>
                </Stack>
                <Stack data-reveal data-reveal-delay="0.24" direction="row" spacing={2.5} flexWrap="wrap" useFlexGap>
                  {heroChecks.map((c) => (
                    <Stack key={c} direction="row" spacing={0.75} alignItems="center">
                      <Check sx={{ fontSize: 16, color: M.green }} />
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 500, color: M.ink }}>{c}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Grid>
            </Grid>
          </Container>
        </Box>
      </Box>
    </MarketingLayout>
  )
}
