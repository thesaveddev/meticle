import { Box } from '@mui/material'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Nav from './Nav'
import Footer from './Footer'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [pathname])

  return (
    <Box sx={{ bgcolor: '#FAFBFC', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Nav />
      <Box component="main" sx={{ pt: { xs: '56px', md: '68px' }, flex: 1 }}>
        {children}
      </Box>
      <Footer />
    </Box>
  )
}
