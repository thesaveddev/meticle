import { Box, Container, Grid, Stack, Typography, Link } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { P, T } from '../../styles/tokens'

const cols = {
  Platform: [
    { name: 'Overview', path: '/platform' },
    { name: 'Care Management', path: '/features/care-management' },
    { name: 'Medication', path: '/features/medication' },
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
    { name: 'CQC · England', path: '/compliance/cqc' },
    { name: 'Care Inspectorate · Scotland', path: '/compliance/care-inspectorate' },
    { name: 'CIW · Wales', path: '/compliance/ciw' },
    { name: 'RQIA · Northern Ireland', path: '/compliance/rqia' },
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
    <Box component="footer" sx={{ bgcolor: P.dark, color: '#fff' }}>
      <Container maxWidth="lg">
        <Grid container spacing={{ xs: 4, md: 6 }} sx={{ pt: { xs: 8, md: 10 }, pb: { xs: 5, md: 7 } }}>
          {/* Brand */}
          <Grid item xs={12} md={3.5}>
            <Typography sx={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.03em', mb: 2 }}>
              Meticle<span style={{ color: P.teal }}>Care</span>
            </Typography>
            <Typography sx={{ color: P.muted, fontSize: '0.875rem', lineHeight: 1.65, mb: 3, maxWidth: 280 }}>
              Care operations software for domiciliary and supported living providers across the UK.
            </Typography>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              {['England', 'Scotland', 'Wales', 'Northern Ireland'].map((n) => (
                <Typography key={n} sx={{ fontSize: '0.7rem', fontWeight: 600, color: P.slateLight, letterSpacing: '0.04em' }}>{n}</Typography>
              ))}
            </Stack>
          </Grid>

          {/* Link columns */}
          {Object.entries(cols).map(([title, links]) => (
            <Grid item key={title} xs={6} sm={4} md={2.75 / (Object.keys(cols).length > 3 ? 1 : 1)}>
              <Typography sx={{ ...T.overline, color: '#94A3B8', mb: 2.5, display: 'block' }}>{title}</Typography>
              <Stack spacing={1.25}>
                {links.map((link) => (
                  <Link
                    key={link.name}
                    component={RouterLink}
                    to={link.path}
                    underline="hover"
                    sx={{
                      color: P.slateLight, fontSize: '0.82rem',
                      transition: `color ${150}ms`,
                      '&:hover': { color: '#fff' },
                    }}
                  >{link.name}</Link>
                ))}
              </Stack>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Bottom bar */}
      <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', py: { xs: 2.5, md: 3 }, bgcolor: P.darkMid }}>
        <Container maxWidth="lg">
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            spacing={2}
          >
            <Typography sx={{ color: P.slateLight, fontSize: '0.78rem' }}>
              © {new Date().getFullYear()} Meticle Care Technologies. All rights reserved.
            </Typography>
            <Stack direction="row" spacing={2.5}>
              {['Privacy Policy', 'Terms of Use', 'Cookie Policy'].map((t) => (
                <Link
                  key={t}
                  component={RouterLink}
                  to={`/${t.toLowerCase().replace(/ /g, '-')}`}
                  underline="hover"
                  sx={{ color: P.slateLight, fontSize: '0.75rem', '&:hover': { color: '#fff' } }}
                >{t}</Link>
              ))}
            </Stack>
          </Stack>
        </Container>
      </Box>
    </Box>
  )
}
