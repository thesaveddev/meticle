import { Box, Container, Stack, Typography, Link } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { M } from '../../styles/marketing-tokens'

const cols = {
  Platform: [
    { name: 'Overview', path: '/platform' },
    { name: 'Care Management', path: '/features/care-management' },
    { name: 'Medication (eMAR)', path: '/features/medication' },
    { name: 'Workforce', path: '/features/workforce' },
    { name: 'Scheduling', path: '/features/scheduling' },
    { name: 'Risk & Incidents', path: '/features/risk-management' },
    { name: 'Reporting', path: '/features/reporting' },
    { name: 'Family Portal', path: '/features/family-portal' },
    { name: 'AI Intelligence', path: '/features/ai' },
  ],
  Solutions: [
    { name: 'Domiciliary Care', path: '/solutions/domiciliary-care' },
    { name: 'Supported Living', path: '/solutions/supported-living' },
    { name: 'Mobile App', path: '/download' },
  ],
  Compliance: [
    { name: 'Overview', path: '/compliance' },
    { name: 'CQC — England', path: '/compliance/cqc' },
    { name: 'Care Inspectorate — Scotland', path: '/compliance/care-inspectorate' },
    { name: 'CIW — Wales', path: '/compliance/ciw' },
    { name: 'RQIA — Northern Ireland', path: '/compliance/rqia' },
  ],
  Resources: [
    { name: 'Blog', path: '/blog' },
    { name: 'Security', path: '/security' },
    { name: 'About', path: '/about' },
    { name: 'Contact', path: '/contact' },
  ],
}

export default function Footer() {
  return (
    <Box component="footer" sx={{ bgcolor: M.card, color: M.ink, borderTop: `1px solid ${M.faint}` }}>
      <Container maxWidth="lg">
        <Box sx={{ py: { xs: 3, md: 3.5 }, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', gap: 3 }}>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.04em' }}>
              Meticle<span style={{ color: M.tealDeep }}>Care</span>
            </Typography>
            <Typography sx={{ color: M.slate, fontSize: '0.82rem', lineHeight: 1.5, mt: 0.5 }}>
              Care operations for domiciliary and supported living providers.
            </Typography>
          </Box>
          <Stack direction="row" spacing={{ xs: 1.5, sm: 2.5 }} flexWrap="wrap" useFlexGap>
            {Object.entries(cols).map(([title, links]) => (
              <Link key={title} component={RouterLink} to={links[0].path} underline="hover" sx={{ color: M.navy, fontSize: '0.84rem', fontWeight: 600, whiteSpace: 'nowrap', '&:hover': { color: M.tealDeep } }}>{title}</Link>
            ))}
          </Stack>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2} sx={{ borderTop: `1px solid ${M.faint}`, py: 2 }}>
          <Typography sx={{ color: M.slate, fontSize: '0.76rem' }}>
            © {new Date().getFullYear()} 34Orients Ltd. MeticleCare is a product of 34Orients Ltd. All rights reserved.
          </Typography>
          <Stack direction="row" spacing={{ xs: 1.5, sm: 2.5 }} flexWrap="wrap" useFlexGap>
            {['Privacy Policy', 'Terms of Use', 'Cookie Policy'].map((t) => (
              <Link key={t} component={RouterLink} to={`/${t.toLowerCase().replace(/ /g, '-')}`} underline="hover" sx={{ color: M.slate, fontSize: '0.76rem', whiteSpace: 'nowrap', '&:hover': { color: M.navy } }}>{t}</Link>
            ))}
          </Stack>
        </Stack>
      </Container>
    </Box>
  )
}
