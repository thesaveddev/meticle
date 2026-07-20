import { useState } from 'react'
import { Box, AppBar, Toolbar, Typography, Container, Stack, Button, IconButton, Drawer, List, ListItem, ListItemText, Collapse, Divider } from '@mui/material'
import { useNavigate, useLocation } from 'react-router-dom'
import { Menu as MenuIcon, ExpandLess, ExpandMore as ExpandMoreIcon } from '@mui/icons-material'

const featureGroups = [
  {
    cat: 'Care Management',
    color: '#0F4C81',
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
    color: '#16A34A',
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
    color: '#7C3AED',
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

  const toggleExpand = (name: string) => {
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }))
  }

  const isActive = (path: string) => {
    if (path === '#') return false
    return location.pathname === path || location.pathname.startsWith(path)
  }

  return (
    <>
      <AppBar position="fixed" elevation={0} sx={{ bgcolor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #E5E7EB' }}>
        <Container maxWidth="lg">
          <Toolbar sx={{ justifyContent: 'space-between', px: '0 !important' }}>
            <Typography variant="h5" sx={{ fontWeight: 900, color: '#0F4C81', letterSpacing: '-1.5px', cursor: 'pointer' }} onClick={() => navigate('/')}>
              CareDesk
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
                      color: isActive(item.path) ? '#0F4C81' : '#4B5563',
                      '&:hover': { color: '#0F4C81' },
                      display: 'flex', alignItems: 'center', gap: 0.5
                    }}
                    onClick={() => { if (item.path !== '#') navigate(item.path) }}
                  >
                    {item.name}
                    {(item.mega || item.children) && <ExpandMoreIcon sx={{ fontSize: 16 }} />}
                  </Typography>

                  {/* MEGA MENU: Features */}
                  {item.mega && (
                    <Box className="dropdown" sx={{
                      position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%) translateY(-4px)',
                      width: 760,
                      bgcolor: 'white', borderRadius: 2, boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
                      border: '1px solid #E5E7EB', p: 3, zIndex: 100,
                      opacity: 0, visibility: 'hidden',
                      transition: 'all 0.2s ease',
                    }}>
                      <Grid3 featureGroups={featureGroups} onNavigate={(p) => { navigate(p); }} />
                    </Box>
                  )}

                  {/* SIMPLE DROPDOWN: About */}
                  {item.children && (
                    <Box className="dropdown" sx={{
                      position: 'absolute', top: '100%', left: 0, minWidth: 220,
                      bgcolor: 'white', borderRadius: 2, boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                      border: '1px solid #E5E7EB', p: 1, zIndex: 100,
                      opacity: 0, visibility: 'hidden', transform: 'translateY(-4px)',
                      transition: 'all 0.2s ease'
                    }}>
                      {item.children.map(child => (
                        <Typography
                          key={child.name} variant="body2"
                          sx={{
                            p: 1.5, borderRadius: 1, cursor: 'pointer', fontWeight: 500,
                            color: '#4B5563', '&:hover': { bgcolor: '#F8FAFC', color: '#0F4C81' }
                          }}
                          onClick={() => { navigate(child.path); setMobileOpen(false) }}
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
              <Button onClick={() => navigate('/login')} sx={{ fontWeight: 600, color: '#111827', display: { xs: 'none', md: 'inline-flex' } }}>Login</Button>
              <Button variant="contained" sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A63' }, fontWeight: 700, display: { xs: 'none', md: 'inline-flex' } }} onClick={() => navigate('/register')}>
                Sign Up Now
              </Button>
              <IconButton sx={{ display: { xs: 'flex', md: 'none' } }} onClick={() => setMobileOpen(true)}>
                <MenuIcon />
              </IconButton>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer anchor="right" open={mobileOpen} onClose={() => setMobileOpen(false)}>
        <Box sx={{ width: 300, pt: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 900, color: '#0F4C81', letterSpacing: '-1.5px', px: 2, mb: 2 }} onClick={() => { navigate('/'); setMobileOpen(false) }}>
            CareDesk
          </Typography>
          <Divider />
          <List>
            {navItems.map((item) => (
              <Box key={item.name}>
                <ListItem
                  onClick={() => {
                    if (item.mega || item.children) {
                      toggleExpand(item.name)
                    } else {
                      navigate(item.path); setMobileOpen(false)
                    }
                  }}
                  sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#F8FAFC' } }}
                >
                  <ListItemText primary={item.name} primaryTypographyProps={{ fontWeight: 700 }} />
                  {(item.mega || item.children) && (expanded[item.name] ? <ExpandLess /> : <ExpandMoreIcon />)}
                </ListItem>
                {item.mega && (
                  <Collapse in={expanded[item.name]}>
                    {featureGroups.map((g) => (
                      <Box key={g.cat} sx={{ pl: 2, pr: 2 }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: g.color, textTransform: 'uppercase', letterSpacing: 1, pl: 2, display: 'block', mt: 1 }}>
                          {g.cat}
                        </Typography>
                        <List disablePadding>
                          {g.items.map(child => (
                            <ListItem key={child.name} sx={{ pl: 4, cursor: 'pointer', '&:hover': { bgcolor: '#F8FAFC' } }} onClick={() => { navigate(child.path); setMobileOpen(false) }}>
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
                        <ListItem key={child.name} sx={{ pl: 4, cursor: 'pointer', '&:hover': { bgcolor: '#F8FAFC' } }} onClick={() => { navigate(child.path); setMobileOpen(false) }}>
                          <ListItemText primary={child.name} primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
                        </ListItem>
                      ))}
                    </List>
                  </Collapse>
                )}
              </Box>
            ))}
            <Divider sx={{ my: 1 }} />
            <ListItem sx={{ cursor: 'pointer' }} onClick={() => { navigate('/login'); setMobileOpen(false) }}>
              <ListItemText primary="Login" primaryTypographyProps={{ fontWeight: 700 }} />
            </ListItem>
            <ListItem sx={{ cursor: 'pointer' }} onClick={() => { navigate('/register'); setMobileOpen(false) }}>
              <ListItemText primary="Sign Up Now" primaryTypographyProps={{ fontWeight: 700, color: '#0F4C81' }} />
            </ListItem>
          </List>
        </Box>
      </Drawer>
    </>
  )
}

function Grid3({ featureGroups, onNavigate }: { featureGroups: { cat: string; color: string; items: { name: string; path: string }[] }[]; onNavigate: (p: string) => void }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2.5 }}>
      {featureGroups.map((g) => (
        <Box key={g.cat}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
            <Box sx={{ width: 4, height: 16, bgcolor: g.color, borderRadius: 1 }} />
            <Typography variant="overline" sx={{ fontWeight: 800, color: g.color, letterSpacing: 1, fontSize: '0.65rem' }}>
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
                  color: '#4B5563', '&:hover': { bgcolor: '#F8FAFC', color: g.color }
                }}
                onClick={() => onNavigate(item.path)}
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

