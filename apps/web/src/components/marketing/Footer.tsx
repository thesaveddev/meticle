import { Box, Chip, Container, Grid, Stack, Typography, Link } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { M } from '../../styles/marketing-tokens'
import BrandWordmark from '../BrandWordmark'

/* Figma · MeticleCare Website Redesign · Footer/Desktop — dark navy footer with
 * brand column (tagline + trust badges), four link columns and a legal row. */

const cols: { title: string; links: { name: string; path: string }[] }[] = [
  {
    title: 'Platform',
    links: [
      { name: 'Platform overview', path: '/platform' },
      { name: 'Care management', path: '/features/care-management' },
      { name: 'Medication (eMAR)', path: '/features/medication' },
      { name: 'Workforce', path: '/features/workforce' },
      { name: 'Scheduling', path: '/features/scheduling' },
      { name: 'AI intelligence', path: '/features/ai' },
    ],
  },
  {
    title: 'Solutions',
    links: [
      { name: 'Domiciliary care', path: '/solutions/domiciliary-care' },
      { name: 'Supported living', path: '/solutions/supported-living' },
      { name: 'Mobile app', path: '/download' },
    ],
  },
  {
    title: 'Compliance',
    links: [
      { name: 'Compliance overview', path: '/compliance' },
      { name: 'CQC — England', path: '/compliance/cqc' },
      { name: 'Care Inspectorate — Scotland', path: '/compliance/care-inspectorate' },
      { name: 'CIW — Wales', path: '/compliance/ciw' },
      { name: 'RQIA — Northern Ireland', path: '/compliance/rqia' },
    ],
  },
  {
    title: 'Company',
    links: [
      { name: 'About', path: '/about' },
      { name: 'Security', path: '/security' },
      { name: 'Resources', path: '/blog' },
      { name: 'Contact', path: '/contact' },
    ],
  },
]

export default function Footer() {
  return (
    <Box component="footer" sx={{ bgcolor: M.ink, color: '#FFFFFF' }}>
      <Container maxWidth="lg">
        <Grid container spacing={{ xs: 5, md: 6 }} sx={{ py: { xs: 7, md: 9 } }}>
          <Grid item xs={12} md={4}>
            <BrandWordmark size={19} color="#FFFFFF" accent={M.teal} />
            <Typography sx={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.88rem', lineHeight: 1.6, mt: 2, maxWidth: 300 }}>
              Care operations for domiciliary and supported living providers across the UK.
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 2.5 }} flexWrap="wrap" useFlexGap>
              {['UK data hosting', 'GDPR-ready'].map((b) => (
                <Chip
                  key={b} label={b} size="small"
                  sx={{
                    bgcolor: 'transparent', color: 'rgba(255,255,255,0.85)',
                    border: '1px solid rgba(255,255,255,0.25)',
                    fontWeight: 600, fontSize: '0.72rem', borderRadius: M.r.full,
                  }}
                />
              ))}
            </Stack>
          </Grid>
          {cols.map((col) => (
            <Grid item xs={6} md={2} key={col.title}>
              <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.55)', mb: 2 }}>
                {col.title.toUpperCase()}
              </Typography>
              <Stack spacing={1.25}>
                {col.links.map((l) => (
                  <Link
                    key={l.path + l.name}
                    component={RouterLink}
                    to={l.path}
                    underline="none"
                    sx={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.86rem', width: 'fit-content', '&:hover': { color: '#FFFFFF', textDecoration: 'underline' } }}
                  >
                    {l.name}
                  </Link>
                ))}
              </Stack>
            </Grid>
          ))}
        </Grid>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={1.5} sx={{ borderTop: '1px solid rgba(255,255,255,0.14)', py: 2.5 }}
        >
          <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.76rem' }}>
            © 2026 34Orients Ltd. MeticleCare is a product of 34Orients Ltd.
          </Typography>
          <Stack direction="row" spacing={{ xs: 1.5, sm: 2.5 }} flexWrap="wrap" useFlexGap>
            {/* Slugs must match the routes: /privacy, /terms, /cookies. The
                earlier title-derived slugs (/privacy-policy etc.) hit the 404
                catch-all inside the AuthGuard route and bounced to /login. */}
            {[['Privacy Policy', '/privacy'], ['Terms of Use', '/terms'], ['Cookie Policy', '/cookies']].map(([t, to]) => (
              <Link key={t} component={RouterLink} to={to} underline="hover" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.76rem', whiteSpace: 'nowrap', '&:hover': { color: '#FFFFFF' } }}>{t}</Link>
            ))}
          </Stack>
        </Stack>
      </Container>
    </Box>
  )
}
