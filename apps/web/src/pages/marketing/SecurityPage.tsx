import { Box, Button, Container, Grid, Stack, Typography } from '@mui/material'
import { ArrowForward, Lock, Shield, Insights, Check, VerifiedUser, Storage, Policy } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { M } from '../../styles/marketing-tokens'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'

function SectionLabel({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <Box sx={{ mb: 1, textAlign: center ? "center" : "left" }}>
      <Typography component="span" sx={{ fontSize: "0.75rem", lineHeight: 1.3, fontWeight: 700, letterSpacing: "0.08em", color: M.tealDeep, borderBottom: "2px solid " + M.teal, pb: 0.5, textTransform: "uppercase" }}>{children}</Typography>
    </Box>
  )
}

const controls = [
  { icon: Lock, title: 'Secure authentication', desc: 'Password-based authentication with multi-factor authentication (MFA) support. Session management and secure password reset workflows.', details: ['MFA via authenticator apps', 'Secure session tokens', 'Password complexity requirements', 'Account lockout protection'] },
  { icon: Shield, title: 'Role-based access control', desc: 'Every user sees only what their role and organisation allow. Permissions are enforced at the API level — not just hidden in the UI.', details: ['Organisation-scoped access', 'Granular role permissions', 'Module-level access control', 'API-level enforcement'] },
  { icon: VerifiedUser, title: 'Tenant isolation', desc: 'Organisation data is strictly separated. One organisation cannot access another organisation\'s records under any circumstance.', details: ['Database-level tenant filtering', 'Cross-tenant access prevention', 'Isolated data paths', 'Organisation-scoped queries'] },
  { icon: Insights, title: 'Audit logging', desc: 'Important changes, AI actions and user activity are recorded with timestamps, user context and change details.', details: ['User activity tracking', 'AI action audit trail', 'Change history with before/after', 'Exportable audit logs'] },
  { icon: Storage, title: 'UK data hosting', desc: 'Data is processed and stored in the United Kingdom. Infrastructure is designed to meet UK data residency expectations.', details: ['UK-based servers', 'Encrypted data at rest', 'Encrypted data in transit', 'Regular backup schedules'] },
  { icon: Policy, title: 'GDPR and privacy', desc: 'Data protection by design and default. Data minimisation, purpose limitation and subject access request support.', details: ['Data minimisation', 'Purpose limitation', 'Right to access', 'Right to erasure support'] },
]

const practices = [
  { title: 'AI safety', desc: 'AI features operate within the same RBAC and tenant boundaries as the rest of the platform. AI cannot create, edit or publish care records. Every AI action is logged with source references.' },
  { title: 'Data minimisation', desc: 'The platform collects only the information needed for care operations. Unnecessary data is not requested and not stored.' },
  { title: 'Encryption', desc: 'Data is encrypted in transit (TLS) and at rest. Authentication tokens are securely managed. Sensitive fields are handled with additional protection.' },
  { title: 'Human review', desc: 'AI-generated outputs are clearly marked as assistive. They require human review before any action is taken. AI never makes autonomous decisions about care.' },
]

export default function SecurityPage() {
  const nav = useNavigate()

  return (
    <MarketingLayout>
      <PageMeta title="Security & data protection" description="MeticleCare security controls include authentication, MFA, role-based access, tenant isolation, audit logs, UK data hosting and GDPR-ready practices." canonicalPath="/security" />

      {/* Hero */}
      <Box sx={{ py: { xs: 10, md: 16 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <SectionLabel>Security & data protection</SectionLabel>
              <Typography sx={{ fontSize: M.display.fontSize, lineHeight: M.display.lineHeight, fontWeight: M.display.fontWeight, letterSpacing: M.display.letterSpacing, mb: 3 }}>
                Built around trust.
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, lineHeight: M.bodyLg.lineHeight, mb: 4 }}>
                Care information deserves careful handling. Security is a core product concern — not an afterthought or a compliance checkbox. Every design decision considers data protection, access control and auditability.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.teal, color: M.navy, fontWeight: 700, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', '&:hover': { bgcolor: M.tealDark } }}>Ask about security</Button>
                <Button variant="outlined" onClick={() => nav('/compliance')} sx={{ borderColor: M.subtle, color: M.ink, fontWeight: 700, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none' }}>Compliance</Button>
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{
                p: 4, bgcolor: M.card, borderRadius: M.r.xl, border: `1px solid ${M.faint}`, boxShadow: M.shadow.md,
              }}>
                <Stack spacing={2.5}>
                  {[
                    { label: 'Authentication', status: 'MFA supported' },
                    { label: 'Access control', status: 'RBAC + tenant isolation' },
                    { label: 'Encryption', status: 'TLS + at rest' },
                    { label: 'Data hosting', status: 'United Kingdom' },
                    { label: 'Audit trail', status: 'Full logging' },
                    { label: 'Backups', status: 'Regular schedule' },
                    { label: 'AI safety', status: 'Logged + bounded' },
                    { label: 'GDPR', status: 'Privacy by design' },
                  ].map((item) => (
                    <Stack key={item.label} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1.5, borderBottom: `1px solid ${M.faint}` }}>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.92rem' }}>{item.label}</Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Check sx={{ color: M.teal, fontSize: 16 }} />
                        <Typography sx={{ color: M.tealDeep, fontWeight: 600, fontSize: '0.82rem' }}>{item.status}</Typography>
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Controls */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.card }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <SectionLabel>Security controls</SectionLabel>
            <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing, mb: 2 }}>
              Defence in depth.
            </Typography>
            <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, maxWidth: 560, mx: 'auto' }}>
              Multiple layers of protection work together to keep data secure, access controlled and activity auditable.
            </Typography>
          </Box>
          <Grid container spacing={2.5}>
            {controls.map((c) => (
              <Grid item xs={12} sm={6} md={4} key={c.title}>
                <Box sx={{
                  p: 3.5, bgcolor: M.paper, borderRadius: M.r.lg, border: `1px solid ${M.faint}`, height: '100%',
                  transition: 'all 0.25s', '&:hover': { borderColor: M.teal, boxShadow: M.shadow.md },
                }}>
                  <Box sx={{ width: 48, height: 48, borderRadius: M.r.md, bgcolor: M.tealSoft, display: 'grid', placeItems: 'center', mb: 2.5 }}>
                    <c.icon sx={{ color: M.tealDeep, fontSize: 24 }} />
                  </Box>
                  <Typography sx={{ fontWeight: 700, mb: 1 }}>{c.title}</Typography>
                  <Typography sx={{ color: M.slate, fontSize: '0.88rem', lineHeight: 1.6, mb: 2 }}>{c.desc}</Typography>
                  <Stack spacing={0.75}>
                    {c.details.map((d) => (
                      <Stack key={d} direction="row" spacing={1} alignItems="center">
                        <Check sx={{ color: M.teal, fontSize: 14 }} />
                        <Typography sx={{ fontSize: '0.82rem', color: M.slate }}>{d}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Practices */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <SectionLabel>Practices</SectionLabel>
            <Typography sx={{ fontSize: M.h2.fontSize, fontWeight: M.h2.fontWeight, letterSpacing: M.h2.letterSpacing }}>
              How we think about data.
            </Typography>
          </Box>
          <Grid container spacing={2.5}>
            {practices.map((p) => (
              <Grid item xs={12} sm={6} key={p.title}>
                <Box sx={{ p: 3.5, bgcolor: M.card, borderRadius: M.r.lg, border: `1px solid ${M.faint}`, height: '100%' }}>
                  <Typography sx={{ fontWeight: 700, mb: 1 }}>{p.title}</Typography>
                  <Typography sx={{ color: M.slate, fontSize: '0.9rem', lineHeight: 1.65 }}>{p.desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
          <Box sx={{ mt: 5, p: 3, bgcolor: '#FEF9C3', borderRadius: M.r.md,  }}>
            <Typography sx={{ color: '#78350F', fontSize: '0.9rem', lineHeight: 1.6 }}>
              We do not claim certifications or regulatory approvals that have not been independently verified. If you have specific security requirements, ask the team about the controls and processing arrangements relevant to your service.
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* CTA */}
      <Box sx={{ py: { xs: 10, md: 14 }, bgcolor: M.navy, textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing, color: M.card, mb: 2 }}>
            Ask us about your data requirements.
          </Typography>
          <Button variant="contained" endIcon={<ArrowForward />} onClick={() => nav('/contact')} sx={{ bgcolor: M.teal, color: M.navy, fontWeight: 700, px: 4, py: 1.5, borderRadius: M.r.md, textTransform: 'none', '&:hover': { bgcolor: M.tealDark } }}>Contact us</Button>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
