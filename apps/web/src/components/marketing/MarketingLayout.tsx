import { Box } from '@mui/material'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Nav from './Nav'
import Footer from './Footer'
import { M } from '../../styles/marketing-tokens'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [pathname])

  return (
    <Box sx={{ bgcolor: M.paper, minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column', overflowX: 'clip' }}>
      <Nav />
      <Box component="main" sx={{ pt: { xs: '56px', md: '68px' }, flex: 1 }}>
        {children}
      </Box>
      <Footer />
    </Box>
  )
}
