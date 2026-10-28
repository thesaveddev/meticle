import { Box } from '@mui/material'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Nav from './Nav'
import Footer from './Footer'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [pathname])

  return (
    <Box sx={{ bgcolor: '#FFFFFF', color: '#0C1B2E', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Nav />
      {/* No top offset here: Nav is a floating pill over the page. Heroes carry
          their own top padding so their backgrounds run under the pill instead
          of leaving a scrolling white strip. */}
      <Box component="main" sx={{ pt: 0, flex: 1, minWidth: 0, overflowX: 'clip' }}>
        {children}
      </Box>
      <Footer />
    </Box>
  )
}
