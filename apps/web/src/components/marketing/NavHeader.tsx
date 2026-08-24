import { useState, useEffect } from 'react'
import { Box, AppBar, Toolbar, Typography, Container, Stack, Button, IconButton, Drawer, List, ListItem, ListItemText, Collapse, Divider } from '@mui/material'
import { useNavigate, useLocation } from 'react-router-dom'
import { Menu as MenuIcon, ExpandLess, ExpandMore as ExpandMoreIcon } from '@mui/icons-material'

const INK = '#1B2430'
const NAVY = '#0F4C81'
const NAVY_DEEP = '#0A3A63'
const EMERALD = '#10B981'
const EMERALD_INK = '#047857'
const MIST = '#5B6672'
const HAIRLINE = '#E7E1D6'
const BONE = '#F7F4EE'

const featureGroups = [
  {
    cat: 'Care records',
    items: [
      { name: 'eMAR & Medication Management', path: '/features#emar' },
      { name: 'Daily Care Notes', path: '/features#care-notes' },
      { name: 'Person-Centred Support Plans', path: '/features#support-plans' },
      { name: 'Body Mapping', path: '/features#body-mapping' },
      { name: 'Appointments & Health Checks', path: '/features#appointments' },
      { name: 'Goals & Progress Tracking', path: '/features#goals' },
    ],
  },
  {
    cat: 'Staff & Operations',
    items: [
      { name: 'Staff Rostering & Scheduling', path: '/features#rota' },
      { name: 'Staff Holiday & Absence', path: '/features#leave' },
      { name: 'Incident & Safeguarding', path: '/features#incidents' },
      { name: 'Task Management', path: '/features#tasks' },
      { name: 'Secure Staff Messaging', path: '/features#chat' },
      { name: 'Expense Tracking', path: '/features#expenses' },
      { name: 'Right to Work & DBS Reminders', path: '/features#dbs' },
      { name: 'PBS Plans', path: '/features#pbs' },
    ],
  },
  {
    cat: 'Compliance & Reporting',
    items: [
      { name: 'Inspection Readiness Dashboard', path: '/features#compliance' },
      { name: 'Compliance Reminders', path: '/features#reminders' },
      { name: 'Audit Reports', path: '/features#audit' },
      { name: 'Training Compliance Matrix', path: '/features#training' },
      { name: 'Satisfaction & Engagement Surveys', path: '/features#surveys' },
      { name: 'Room Checks', path: '/features#room-checks' },
      { name: 'Data Backup & Restore', path: '/features#backup' },
      { name: 'Policy & Procedure Management', path: '/features#policies' },
    ],
  },
]

const navItems = [
  { name: 'Features', path: '/features', mega: true },
  { name: 'How It Works', path: '/how-it-works' },
  { name: 'Pricing', path: '/pricing' },
  { name: 'Learn', path: '/learn' },
  { name: 'Blog', path: '/blog' },
  {
    name: 'About', path: '#',
    children: [
      { name: 'Our Story', path: '/about' },
      { name: 'Case Studies', path: '/case-studies' },
      { name: 'Contact', path: '/contact' },
    ]
  },
]

export default function NavHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const onScroll = () => setScrolled(window.scrollY > 10)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const toggleExpand = (name: string) => {
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }))
  }

  const activate = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      fn()
    }
  }

  const isActive = (path: string) => {
    if (path === '#') return false
    return location.pathname === path || location.pathname.startsWith(path)
  }

  return (
    <>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          bgcolor: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${HAIRLINE}`,
          boxShadow: scrolled ? '0 1px 12px rgba(20, 32, 45, 0.08)' : 'none',
          transition: 'box-shadow 0.3s ease',
        }}
      >
        <Container maxWidth="lg">
          <Toolbar
            sx={{
              justifyContent: 'space-between',
              px: '0 !important',
              minHeight: { xs: scrolled ? 56 : 64, md: scrolled ? 64 : 72 },
              transition: 'min-height 0.3s ease',
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 900, color: NAVY, letterSpacing: '-1.5px', cursor: 'pointer', fontSize: '1.35rem' }} onClick={() => navigate('/')}>
              Meticle<span style={{ color: EMERALD_INK }}>Care</span>
            </Typography>

            {/* Desktop Nav */}
            <Stack direction="row" spacing={3.5} alignItems="center" sx={{ display: { xs: 'none', md: 'flex' } }}>
              {navItems.map((item) => (
                <Box
                  key={item.name}
                  sx={{ position: 'relative', '&:hover .dropdown': { opacity: 1, visibility: 'visible', transform: 'translateY(0)' } }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600, cursor: 'pointer', py: 2,
                      color: isActive(item.path) ? NAVY : MIST,
                      '&:hover': { color: NAVY },
                      display: 'flex', alignItems: 'center', gap: 0.5,
                      '&:focus-visible': { outline: `2px solid ${EMERALD}`, outlineOffset: 4, borderRadius: 2 },
                    }}
                    tabIndex={0}
                    onClick={() => { if (item.path !== '#') navigate(item.path) }}
                    onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && item.path !== '#') { e.preventDefault(); navigate(item.path) } }}
                  >
                    {item.name}
                    {(item.mega || item.children) && <ExpandMoreIcon sx={{ fontSize: 16 }} />}
                  </Typography>

                  {/* MEGA MENU: Features */}
                  {item.mega && (
                      <Box className="dropdown" sx={{
                        position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%) translateY(-4px)',
                        width: 'min(760px, calc(100vw - 48px))',
                        bgcolor: 'white', borderRadius: 2, boxShadow: '0 24px 56px -20px rgba(20, 32, 45, 0.22)',
                        border: `1px solid ${HAIRLINE}`, p: 3, zIndex: 100,
                        opacity: 0, visibility: 'hidden',
                        transition: 'opacity 0.2s ease, visibility 0.2s, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      }}>
                      <Grid3 featureGroups={featureGroups} onNavigate={(p) => { navigate(p) }} />
                    </Box>
                  )}

                  {/* SIMPLE DROPDOWN: About */}
                  {item.children && (
                    <Box className="dropdown" sx={{
                      position: 'absolute', top: '100%', left: 0, minWidth: 220,
                      bgcolor: 'white', borderRadius: 2, boxShadow: '0 20px 44px -18px rgba(20, 32, 45, 0.2)',
                      border: `1px solid ${HAIRLINE}`, p: 1, zIndex: 100,
                      opacity: 0, visibility: 'hidden', transform: 'translateY(-4px)',
                      transition: 'opacity 0.2s ease, visibility 0.2s, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}>
                      {item.children.map(child => (
                        <Typography
                          key={child.name} variant="body2"
                          sx={{
                            p: 1.5, borderRadius: 1, cursor: 'pointer', fontWeight: 500,
                            color: MIST, '&:hover': { bgcolor: BONE, color: NAVY },
                            '&:focus-visible': { outline: `2px solid ${EMERALD}`, outlineOffset: -2 },
                          }}
                          tabIndex={0}
                          onClick={() => { navigate(child.path); setMobileOpen(false) }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(child.path); setMobileOpen(false) } }}
                        >
                          {child.name}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Box>
              ))}
            </Stack>

            <Stack direction="row" spacing={2} alignItems="center">
              <Button onClick={() => navigate('/login')} sx={{ fontWeight: 600, color: INK, display: { xs: 'none', md: 'inline-flex' } }}>Login</Button>
              <Button variant="contained" sx={{ bgcolor: NAVY, '&:hover': { bgcolor: NAVY_DEEP }, fontWeight: 700, display: { xs: 'none', md: 'inline-flex' } }} onClick={() => navigate('/register')}>
                Start free trial
              </Button>
              <IconButton sx={{ display: { xs: 'flex', md: 'none' }, '&:focus-visible': { outline: `2px solid ${EMERALD}`, outlineOffset: 2 } }} onClick={() => setMobileOpen(true)} aria-label="Open navigation menu">
                <MenuIcon />
              </IconButton>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer anchor="right" open={mobileOpen} onClose={() => setMobileOpen(false)}>
        <Box sx={{ width: 300, pt: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 900, color: NAVY, letterSpacing: '-1.5px', px: 2, mb: 2, cursor: 'pointer', fontSize: '1.35rem' }} onClick={() => { navigate('/'); setMobileOpen(false) }}>
            Meticle<span style={{ color: EMERALD_INK }}>Care</span>
          </Typography>
          <Divider />
          <List>
            {navItems.map((item) => (
              <Box key={item.name}>
                <ListItem
                  tabIndex={0}
                  role="button"
                  onClick={() => {
                    if (item.mega || item.children) {
                      toggleExpand(item.name)
                    } else {
                      navigate(item.path); setMobileOpen(false)
                    }
                  }}
                  onKeyDown={activate(() => {
                    if (item.mega || item.children) {
                      toggleExpand(item.name)
                    } else {
                      navigate(item.path); setMobileOpen(false)
                    }
                  })}
                  sx={{ cursor: 'pointer', '&:hover': { bgcolor: BONE }, '&:focus-visible': { outline: `2px solid ${EMERALD}`, outlineOffset: -2 } }}
                >
                  <ListItemText primary={item.name} primaryTypographyProps={{ fontWeight: 700, color: INK }} />
                  {(item.mega || item.children) && (expanded[item.name] ? <ExpandLess /> : <ExpandMoreIcon />)}
                </ListItem>
                {item.mega && (
                  <Collapse in={expanded[item.name]}>
                    {featureGroups.map((g) => (
                      <Box key={g.cat} sx={{ pl: 2, pr: 2 }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: NAVY, textTransform: 'uppercase', letterSpacing: 1, pl: 2, display: 'block', mt: 1 }}>
                          {g.cat}
                        </Typography>
                        <List disablePadding>
                          {g.items.map(child => (
                            <ListItem key={child.name} tabIndex={0} role="button" sx={{ pl: 4, cursor: 'pointer', '&:hover': { bgcolor: BONE }, '&:focus-visible': { outline: `2px solid ${EMERALD}`, outlineOffset: -2 } }} onClick={() => { navigate(child.path); setMobileOpen(false) }} onKeyDown={activate(() => { navigate(child.path); setMobileOpen(false) })}>
                              <ListItemText primary={child.name} primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    ))}
                  </Collapse>
                )}
                {item.children && (
                  <Collapse in={expanded[item.name]}>
                    <List disablePadding>
                      {item.children.map(child => (
                        <ListItem key={child.name} sx={{ pl: 4, cursor: 'pointer', '&:hover': { bgcolor: BONE } }} onClick={() => { navigate(child.path); setMobileOpen(false) }}>
                          <ListItemText primary={child.name} primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
                        </ListItem>
                      ))}
                    </List>
                  </Collapse>
                )}
              </Box>
            ))}
            <Divider sx={{ my: 1 }} />
            <ListItem tabIndex={0} role="button" sx={{ cursor: 'pointer', '&:focus-visible': { outline: `2px solid ${EMERALD}`, outlineOffset: -2 } }} onClick={() => { navigate('/login'); setMobileOpen(false) }} onKeyDown={activate(() => { navigate('/login'); setMobileOpen(false) })}>
              <ListItemText primary="Login" primaryTypographyProps={{ fontWeight: 700 }} />
            </ListItem>
            <ListItem tabIndex={0} role="button" sx={{ cursor: 'pointer', '&:focus-visible': { outline: `2px solid ${EMERALD}`, outlineOffset: -2 } }} onClick={() => { navigate('/register'); setMobileOpen(false) }} onKeyDown={activate(() => { navigate('/register'); setMobileOpen(false) })}>
              <ListItemText primary="Start free trial" primaryTypographyProps={{ fontWeight: 700, color: NAVY }} />
            </ListItem>
          </List>
        </Box>
      </Drawer>
    </>
  )
}

function Grid3({ featureGroups, onNavigate }: { featureGroups: { cat: string; items: { name: string; path: string }[] }[]; onNavigate: (p: string) => void }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2.5 }}>
      {featureGroups.map((g, i) => (
        <Box
          key={g.cat}
          sx={{
            opacity: 0, transform: 'translateY(6px)',
            animation: 'megafadein 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            animationDelay: `${i * 60}ms`,
            '@keyframes megafadein': {
              from: { opacity: 0, transform: 'translateY(6px)' },
              to: { opacity: 1, transform: 'translateY(0)' },
            },
            '@media (prefers-reduced-motion: reduce)': {
              animation: 'none',
              opacity: 1,
              transform: 'none',
            },
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: 1, bgcolor: EMERALD, flexShrink: 0 }} />
            <Typography variant="overline" sx={{ fontWeight: 800, color: NAVY, letterSpacing: 1, fontSize: '0.66rem' }}>
              {g.cat}
            </Typography>
          </Stack>
          <Stack spacing={0.5}>
            {g.items.map(item => (
              <Typography
                key={item.name}
                variant="body2"
                sx={{
                  py: 0.8, px: 1, borderRadius: 1, cursor: 'pointer', fontWeight: 500, fontSize: '0.82rem',
                  color: MIST, '&:hover': { bgcolor: BONE, color: NAVY },
                  '&:focus-visible': { outline: `2px solid ${EMERALD}`, outlineOffset: -2 },
                }}
                tabIndex={0}
                onClick={() => onNavigate(item.path)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate(item.path) } }}
              >
                {item.name}
              </Typography>
            ))}
          </Stack>
        </Box>
      ))}
    </Box>
  )
}
