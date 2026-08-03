import { Box, Container, Typography, Stack, Grid, Link } from '@mui/material'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import NavHeader from './NavHeader'

const INK_DARK = '#141C24'
const INK_DEEP = '#1D2733'
const EMERALD = '#10B981'
const FOOT_MUTED = '#8E98A3'
const FOOT_HAIRLINE = 'rgba(255,255,255,0.12)'

const footerLinks = {
  Product: [
    { name: 'Features', path: '/features' },
    { name: 'How It Works', path: '/how-it-works' },
    { name: 'Pricing', path: '/pricing' },
    { name: 'Compliance', path: '/features#compliance' },
    { name: 'Blog', path: '/blog' },
  ],
  Solutions: [
    { name: 'Supported Living', path: '/features' },
    { name: 'CQC Compliance', path: '/features#compliance' },
    { name: 'Care Home Software', path: '/features' },
    { name: 'Domiciliary Care', path: '/features' },
  ],
  Company: [
    { name: 'Our Story', path: '/about' },
    { name: 'Case Studies', path: '/case-studies' },
    { name: 'Contact', path: '/contact' },
  ],
  Resources: [
    { name: 'Learning Center', path: '/learn' },
    { name: 'Blog & Guides', path: '/blog' },
  ],
  Legal: [
    { name: 'Privacy Policy', path: '/privacy' },
    { name: 'Terms of Use', path: '/terms' },
    { name: 'Cookie Policy', path: '/cookies' },
  ],
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()

  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  return (
    <Box sx={{ bgcolor: 'white', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <NavHeader />
      <Box component="main" sx={{ pt: { xs: '64px', md: '72px' }, flex: 1 }}>
        {children}
      </Box>

      {/* Footer */}
      <Box component="footer" sx={{ bgcolor: INK_DARK, color: '#FFFFFF' }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 4, md: 6 }} sx={{ pt: { xs: 8, md: 10 }, pb: { xs: 5, md: 8 } }}>
            <Grid item xs={12} md={3}>
              <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '-1.5px', mb: 2.5, fontSize: '1.35rem' }} component={RouterLink} to="/" style={{ textDecoration: 'none', color: '#FFFFFF' }}>
                Meticle<span style={{ color: EMERALD }}>Care</span>
              </Typography>
              <Typography variant="body2" sx={{ color: FOOT_MUTED, mb: 4, maxWidth: 280, lineHeight: 1.7 }}>
                A connected care management platform for UK supported living and domiciliary care providers.
              </Typography>
              <Typography variant="caption" sx={{ color: FOOT_MUTED, fontWeight: 600, letterSpacing: '0.04em' }}>
                CQC · CIW · Care Inspectorate · RQIA
              </Typography>
            </Grid>
            {Object.entries(footerLinks).map(([category, links]) => (
              <Grid item key={category} sx={{ width: { xs: '50%', sm: '33.33%', md: 'auto' }, flexGrow: { md: 1 }, flexBasis: { md: 0 } }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#E8EBEE', textTransform: 'uppercase', letterSpacing: 1, mb: 2.5, display: 'block' }}>
                  {category}
                </Typography>
                <Stack spacing={1.5}>
                  {links.map(link => (
                    <Link
                      key={link.name}
                      component={RouterLink}
                      to={link.path}
                      underline="hover"
                      sx={{ color: FOOT_MUTED, fontSize: '0.9rem', transition: 'color 0.15s ease', '&:hover': { color: '#FFFFFF' } }}
                    >
                      {link.name}
                    </Link>
                  ))}
                </Stack>
              </Grid>
            ))}
          </Grid>
        </Container>
        <Box sx={{ borderTop: `1px solid ${FOOT_HAIRLINE}`, py: { xs: 2.5, md: 3 }, bgcolor: INK_DEEP }}>
          <Container maxWidth="lg">
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              <Typography variant="body2" sx={{ color: FOOT_MUTED, fontSize: '0.85rem' }}>© 2026 MeticleCare Technologies. All rights reserved.</Typography>
              <Stack direction="row" spacing={3}>
                <Link component={RouterLink} to="/privacy" underline="hover" sx={{ color: FOOT_MUTED, fontSize: '0.75rem', transition: 'color 0.15s ease', '&:hover': { color: '#FFFFFF' } }}>Privacy Policy</Link>
                <Link component={RouterLink} to="/terms" underline="hover" sx={{ color: FOOT_MUTED, fontSize: '0.75rem', transition: 'color 0.15s ease', '&:hover': { color: '#FFFFFF' } }}>Terms of Use</Link>
                <Link component={RouterLink} to="/cookies" underline="hover" sx={{ color: FOOT_MUTED, fontSize: '0.75rem', transition: 'color 0.15s ease', '&:hover': { color: '#FFFFFF' } }}>Cookie Policy</Link>
              </Stack>
            </Box>
          </Container>
        </Box>
      </Box>
    </Box>
  )
}
