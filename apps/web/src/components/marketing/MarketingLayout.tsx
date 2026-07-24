import { Box, Container, Typography, Stack, Divider, Grid } from '@mui/material'
import { useNavigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import NavHeader from './NavHeader'

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
    { name: 'FAQ', path: '/faq' },
  ],
  Legal: [
    { name: 'Privacy Policy', path: '/privacy' },
    { name: 'Terms of Use', path: '/terms' },
    { name: 'Cookie Policy', path: '/cookies' },
  ],
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  return (
    <Box sx={{ bgcolor: 'white', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <NavHeader />
      <Box sx={{ pt: { xs: '64px', md: '72px' }, flex: 1 }}>
        {children}
      </Box>

      {/* Footer */}
      <Box sx={{ py: 10, bgcolor: '#F8FAFC', borderTop: '1px solid #E5E7EB' }}>
        <Container maxWidth="lg">
          <Grid container spacing={6}>
            <Grid item xs={12} md={4}>
              <Typography variant="h5" sx={{ fontWeight: 900, color: '#111827', mb: 2, cursor: 'pointer' }} onClick={() => navigate('/')}>
                Meticle
              </Typography>
              <Typography variant="body2" sx={{ color: '#6B7280', mb: 3, maxWidth: 300 }}>
                The compliance-first platform for UK care providers. Built for CQC, CIW, Care Inspectorate, and RQIA.
              </Typography>
              <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 600 }}>
                ✓ All Four UK Regulators Supported
              </Typography>
            </Grid>
            {Object.entries(footerLinks).map(([category, links]) => (
              <Grid item xs={6} md={2} key={category}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#111827', textTransform: 'uppercase', mb: 2, display: 'block' }}>
                  {category}
                </Typography>
                <Stack spacing={1.5}>
                  {links.map(link => (
                    <Typography
                      key={link.name} variant="body2" color="#6B7280"
                      sx={{ cursor: 'pointer', '&:hover': { color: '#0F4C81' } }}
                      onClick={() => navigate(link.path)}
                    >
                      {link.name}
                    </Typography>
                  ))}
                </Stack>
              </Grid>
            ))}
          </Grid>
          <Divider sx={{ my: 6 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="body2" color="#9CA3AF">© 2026 Meticle Technologies. All rights reserved.</Typography>
            <Stack direction="row" spacing={3}>
              <Typography variant="caption" color="#9CA3AF" sx={{ cursor: 'pointer', '&:hover': { color: '#0F4C81' } }} onClick={() => navigate('/privacy')}>Privacy Policy</Typography>
              <Typography variant="caption" color="#9CA3AF" sx={{ cursor: 'pointer', '&:hover': { color: '#0F4C81' } }} onClick={() => navigate('/terms')}>Terms of Use</Typography>
              <Typography variant="caption" color="#9CA3AF" sx={{ cursor: 'pointer', '&:hover': { color: '#0F4C81' } }} onClick={() => navigate('/cookies')}>Cookie Policy</Typography>
            </Stack>
          </Box>
        </Container>
      </Box>
    </Box>
  )
}
