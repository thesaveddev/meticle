import { Box, Button, Container, Grid, Stack, Typography } from '@mui/material'
import {
  ArrowForward, Check, PriorityHigh, Info, Lock, VpnKey, Layers, FindInPage, Dns, VerifiedUser,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { M } from '../../styles/marketing-tokens'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'

/* ─── Colours pinned from Figma frame 1.4 (node 73:5803) ──────────────
 * Labels (Security controls / Practices):  #0164C8 (blue)
 * Titles / values:                         #0C1B2E (dark navy)
 * Control descs / practice descs / labels:  #51637A (slate)
 * Capability + glance text:                 M.bodyText (ink)
 * Practice top rules:                       M.rule · cell hairlines: M.hair
 * In-product tick: teal-tint circle + #004E45 tick · value ink
 * Limitation: amber-tint circle + M.amberText mark · value M.amberText
 * Control icons: ink 22px, no tiles, no card radii in the grid
 */

function Eyebrow({ children, color = M.navy }: { children: React.ReactNode; color?: string }) {
  return (
    <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.06em', color, mb: 1.5 }}>
      {children}
    </Typography>
  )
}

function Tick() {
  return (
    <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: '#D2FBF4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Check sx={{ fontSize: 12, color: '#004E45' }} />
    </Box>
  )
}

function LimitMark() {
  return (
    <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: M.amberBand, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <PriorityHigh sx={{ fontSize: 12, color: M.amberText }} />
    </Box>
  )
}

/* ─── At a glance (hero card, verbatim rows) ───────────────────────── */

const glanceRows = [
  { label: 'Authentication', value: 'MFA supported', ok: true },
  { label: 'Access control', value: 'RBAC + tenant isolation', ok: true },
  { label: 'Encryption in transit', value: 'TLS', ok: true },
  { label: 'Encryption at rest', value: 'Ask us — not handled by the application', ok: false },
  { label: 'Record storage', value: 'United Kingdom', ok: true },
  { label: 'AI processing', value: 'May leave the UK when AI is enabled', ok: false },
  { label: 'Audit trail', value: 'Full logging', ok: true },
  { label: 'Backups', value: 'Operated at the infrastructure layer — ask us for the schedule', ok: false },
  { label: 'AI safety', value: 'Logged + bounded', ok: true },
]

function GlanceCard() {
  return (
    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '16px', border: `1px solid ${M.faint}`, boxShadow: '0 24px 48px rgba(12,27,46,0.14)', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, px: 3, py: 2.25, bgcolor: M.paper, borderBottom: `1px solid ${M.faint}` }}>
        <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: M.dark }}>At a glance</Typography>
        <Stack direction="row" spacing={2}>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <Tick />
            <Typography sx={{ fontSize: '0.72rem', color: M.slate }}>In the product</Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <LimitMark />
            <Typography sx={{ fontSize: '0.72rem', color: M.slate }}>Ask us / limitation</Typography>
          </Stack>
        </Stack>
      </Box>
      {glanceRows.map((r) => (
        <Box
          key={r.label}
          sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2,
            px: 3, py: '15px', borderBottom: `1px solid ${M.faint}`, '&:last-child': { borderBottom: 'none' },
          }}
        >
          <Typography sx={{ fontSize: '0.82rem', color: M.slate, flexShrink: 0 }}>{r.label}</Typography>
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ textAlign: 'right' }}>
            {r.ok ? <Tick /> : <LimitMark />}
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: r.ok ? M.dark : M.amberText }}>{r.value}</Typography>
          </Stack>
        </Box>
      ))}
    </Box>
  )
}

/* ─── Controls (connected grid, no card radii) ─────────────────────── */

interface Control {
  icon: React.ReactNode
  title: string
  desc: string
  bullets: string[]
}

const controls: Control[] = [
  {
    icon: <Lock />, title: 'Secure authentication',
    desc: 'Password-based authentication with multi-factor authentication (MFA) support. Session management and secure password reset workflows.',
    bullets: ['MFA via authenticator apps', 'Secure session tokens', 'Password complexity requirements', 'Account lockout protection'],
  },
  {
    icon: <VpnKey />, title: 'Role-based access control',
    desc: 'Every user sees only what their role and organisation allow. Permissions are enforced at the API level — not just hidden in the UI.',
    bullets: ['Organisation-scoped access', 'Granular role permissions', 'Module-level access control', 'API-level enforcement'],
  },
  {
    icon: <Layers />, title: 'Tenant isolation',
    desc: 'Organisation data is strictly separated. One organisation cannot access another organisation\u2019s records under any circumstance.',
    bullets: ['Database-level tenant filtering', 'Cross-tenant access prevention', 'Isolated data paths', 'Organisation-scoped queries'],
  },
  {
    icon: <FindInPage />, title: 'Audit logging',
    desc: 'Important changes, AI actions and user activity are recorded with timestamps, user context and change details.',
    bullets: ['User activity tracking', 'AI action audit trail', 'Change history with before/after', 'Exportable audit logs'],
  },
  {
    icon: <Dns />, title: 'UK data hosting',
    desc: 'Records are stored in the United Kingdom. Where AI features are switched on, parts of a record are processed by our AI provider outside the UK.',
    bullets: ['UK-based servers for the record', 'Encrypted data in transit', 'AI processing can leave the UK when enabled'],
  },
  {
    icon: <VerifiedUser />, title: 'GDPR and privacy',
    desc: 'Data minimisation and pseudonymisation of personal data before it leaves the platform, and erasure of a person\u2019s account when they leave.',
    bullets: ['Data minimisation', 'Pseudonymisation at the AI boundary', 'Per-organisation control over free text sent', 'Account erasure on leaving'],
  },
]

/* ─── Practices (top-ruled rows, no cards) ─────────────────────────── */

const practices = [
  { no: '01', title: 'AI safety', desc: 'AI features operate within the same RBAC and tenant boundaries as the rest of the platform. AI cannot create, update or publish care records. Every AI action is logged with source references.' },
  { no: '02', title: 'Data minimisation', desc: 'What leaves the platform for AI is controlled per organisation: narrative free text can be withheld, keeping coded facts. The default sends the narrative, so this is a setting to decide on rather than a property you inherit.' },
  { no: '03', title: 'Encryption', desc: 'Data is encrypted in transit. We do not claim encryption at rest at the application layer — the database extension that would provide it is installed but unused, and anything below the application is a question for whoever runs the infrastructure.' },
  { no: '04', title: 'Human review', desc: 'AI-generated outputs are clearly marked as assistive. They require human review before any action is taken. AI never makes autonomous decisions about care.' },
]

/* ─── Page ─────────────────────────────────────────────────────────── */

export default function SecurityPage() {
  const nav = useNavigate()

  return (
    <MarketingLayout>
      <PageMeta
        title="Security & data protection"
        description="MeticleCare security controls include authentication, MFA, role-based access, tenant isolation, audit logs, UK data hosting and GDPR-ready practices."
        canonicalPath="/security"
        keywords={['care software security', 'GDPR care records', 'UK data hosting care', 'care platform compliance']}
        breadcrumbs={[{ name: 'Home', path: '/' }, { name: 'Security', path: '/security' }]}
      />

      {/* Hero — gradient + decor glows, per Figma frame 1.4 (node 26:79) */}
      <Box sx={{ position: 'relative', overflow: 'clip', background: `linear-gradient(180deg, ${M.heroTint} 0%, ${M.paper} 55%, ${M.card} 100%)` }}>
        <Box aria-hidden sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <Box sx={{ position: 'absolute', width: 560, height: 560, right: '-4%', top: '-12%', borderRadius: '50%', bgcolor: 'rgba(1,100,200,0.12)', filter: 'blur(140px)' }} />
          <Box sx={{ position: 'absolute', width: 420, height: 420, right: '6%', top: '30%', borderRadius: '50%', bgcolor: 'rgba(3,198,177,0.12)', filter: 'blur(140px)' }} />
        </Box>
        <Container maxWidth="lg" sx={{ position: 'relative', pt: { xs: 8, md: 14 }, pb: { xs: 6, md: 10 } }}>
          <Grid container spacing={{ xs: 5, md: 8 }} alignItems="center">
            <Grid item xs={12} md={5}>
              <Box
                sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 1, bgcolor: '#FFFFFF',
                  border: `1px solid ${M.faint}`, borderRadius: '999px', px: 2, py: 0.75, mb: 3,
                }}
              >
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: M.navy }} />
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: M.bodyText }}>Security &amp; data protection</Typography>
              </Box>
              <Typography sx={{ fontSize: M.display.fontSize, lineHeight: M.display.lineHeight, fontWeight: M.display.fontWeight, letterSpacing: M.display.letterSpacing, color: M.dark, mb: 3 }}>
                Built around trust.
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, lineHeight: 1.7, mb: 3.5 }}>
                Care information deserves careful handling. Security is a core product concern — not an afterthought or a compliance checkbox. Every design decision considers data protection, access control and auditability.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button
                  variant="contained"
                  endIcon={<ArrowForward />}
                  onClick={() => nav('/contact')}
                  sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 4, py: 1.75, borderRadius: '14px', textTransform: 'none', fontSize: '0.95rem', boxShadow: '0 10px 24px rgba(1,99,199,0.28), 0 2px 4px rgba(1,99,199,0.20)', '&:hover': { bgcolor: M.navyHover } }}
                >
                  Ask about security
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => nav('/compliance')}
                  sx={{ borderColor: M.rule, color: M.dark, fontWeight: 600, px: 3, py: 1.6, borderRadius: '14px', textTransform: 'none', fontSize: '0.95rem', bgcolor: '#FFFFFF', '&:hover': { borderColor: M.navy } }}
                >
                  See compliance
                </Button>
              </Stack>
            </Grid>
            <Grid item xs={12} md={7}>
              <GlanceCard />
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Security controls — top rule, per the frame (node 27:82) */}
      <Box sx={{ bgcolor: '#FFFFFF', borderTop: `1px solid ${M.hair}`, py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={4} sx={{ mb: { xs: 5, md: 7 } }}>
            <Grid item xs={12} md={7}>
              <Eyebrow>Security controls</Eyebrow>
              <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing, color: M.dark }}>
                Defence in depth.
              </Typography>
            </Grid>
            <Grid item xs={12} md={5}>
              <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, lineHeight: 1.7, pt: { md: 4 } }}>
                Multiple layers of protection work together to keep data secure, access controlled and activity auditable.
              </Typography>
            </Grid>
          </Grid>

          <Box sx={{ border: `1px solid ${M.faint}`, borderRadius: '16px', overflow: 'hidden' }}>
            {[0, 1].map((row) => (
              <Grid container key={row} sx={row === 1 ? { borderTop: `1px solid ${M.faint}` } : undefined}>
                {controls.slice(row * 3, row * 3 + 3).map((c, i) => (
                  <Grid
                    item xs={12} md={4} key={c.title}
                    sx={{
                      p: 4,
                      ...(i < 2 ? { borderRight: { md: `1px solid ${M.faint}` }, borderBottom: { xs: `1px solid ${M.faint}`, md: 'none' } } : {}),
                      ...(row === 1 && i === 2 ? { borderBottom: { xs: 'none', md: 'none' } } : {}),
                    }}
                  >
                    <Box sx={{ color: M.bodyText, mb: 2, '& svg': { fontSize: 22 } }}>{c.icon}</Box>
                    <Typography sx={{ fontSize: '1.05rem', fontWeight: 600, color: M.dark, mb: 1 }}>{c.title}</Typography>
                    <Typography sx={{ fontSize: '0.9rem', color: M.slate, lineHeight: 1.65, mb: 2 }}>{c.desc}</Typography>
                    <Box sx={{ borderTop: `1px solid ${M.faint}`, pt: '14px', display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {c.bullets.map((b) => (
                        <Stack key={b} direction="row" alignItems="center" spacing={1.25}>
                          <Check sx={{ fontSize: 14, color: M.navy, flexShrink: 0 }} />
                          <Typography sx={{ fontSize: '0.85rem', color: M.bodyText }}>{b}</Typography>
                        </Stack>
                      ))}
                    </Box>
                  </Grid>
                ))}
              </Grid>
            ))}
          </Box>
        </Container>
      </Box>

      {/* Practices */}
      <Box sx={{ bgcolor: M.paper, py: { xs: 8, md: 13 } }}>
        <Container maxWidth="lg">
          <Box sx={{ mb: { xs: 5, md: 7 } }}>
            <Eyebrow>Practices</Eyebrow>
            <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing, color: M.dark }}>
              How we think about data.
            </Typography>
          </Box>
          <Grid container spacing={{ xs: 4, md: 7 }}>
            {practices.map((p) => (
              <Grid item xs={12} md={6} key={p.no}>
                <Box sx={{ borderTop: `1px solid ${M.rule}`, pt: '20px' }}>
                  <Stack direction="row" alignItems="baseline" spacing={1.5} sx={{ mb: 1 }}>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: M.navy }}>{p.no}</Typography>
                    <Typography sx={{ fontSize: '1.05rem', fontWeight: 600, color: M.dark }}>{p.title}</Typography>
                  </Stack>
                  <Typography sx={{ fontSize: '0.9rem', color: M.slate, lineHeight: 1.65 }}>{p.desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
          <Box sx={{ mt: { xs: 5, md: 7 }, bgcolor: '#FFFFFF', border: `1px solid ${M.faint}`, borderRadius: '14px', px: 3, py: 2.5, display: 'flex', gap: 1.75, alignItems: 'flex-start' }}>
            <Info sx={{ fontSize: 20, color: M.slate, flexShrink: 0, mt: 0.25 }} />
            <Typography sx={{ fontSize: '0.9rem', color: M.bodyText, lineHeight: 1.65 }}>
              We do not claim certifications or regulatory approvals that have not been independently verified. If you have specific security requirements, ask the team about the controls and processing arrangements relevant to your service.
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* CTA */}
      <Box sx={{ bgcolor: '#FFFFFF', borderTop: `1px solid ${M.faint}`, py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 4, md: 6 }} alignItems="center">
            <Grid item xs={12} md={8}>
              <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing, color: M.dark, mb: 1.5 }}>
                Ask us about your data requirements.
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, lineHeight: 1.7 }}>
                Tell us how your service handles data today and we’ll walk through the controls and processing arrangements that apply.
              </Typography>
            </Grid>
            <Grid item xs={12} md={4} sx={{ display: 'flex', justifyContent: { md: 'flex-end' } }}>
              <Button
                variant="contained"
                endIcon={<ArrowForward />}
                onClick={() => nav('/contact')}
                sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 4, py: 1.75, borderRadius: '14px', textTransform: 'none', fontSize: '0.95rem', boxShadow: '0 10px 24px rgba(1,99,199,0.28), 0 2px 4px rgba(1,99,199,0.20)', '&:hover': { bgcolor: M.navyHover } }}
              >
                Ask about security
              </Button>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
