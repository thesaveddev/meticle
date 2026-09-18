import { useState, useEffect, useCallback } from 'react'
import { Box, AppBar, Toolbar, Container, Stack, Button, Typography, Drawer, IconButton, Collapse } from '@mui/material'
import { useNavigate, useLocation } from 'react-router-dom'
import { Menu as MenuIcon, Close, ExpandMore, ArrowForward } from '@mui/icons-material'
import { P, T, R, S, X } from '../../styles/tokens'

/* ─── Data ─────────────────────────────────────────── */

type NavChild = { name: string; path: string; desc?: string }
type NavGroup = { name: string; path: string; children?: NavChild[] }

const navGroups: NavGroup[] = [
  {
    name: 'Platform', path: '/platform',
    children: [
      { name: 'Care Management', path: '/features/care-management', desc: 'Plans, notes, reviews and observations' },
      { name: 'Medication', path: '/features/medication', desc: 'eMAR and administration records' },
      { name: 'Workforce', path: '/features/workforce', desc: 'Staff, training and competency' },
      { name: 'Scheduling', path: '/features/scheduling', desc: 'Rota planning and open calls' },
      { name: 'Risk & Incidents', path: '/features/risk-management', desc: 'Assessments, recording and follow-up' },
      { name: 'Reporting', path: '/features/reporting', desc: 'Dashboards and evidence' },
      { name: 'Family Portal', path: '/features/family-portal', desc: 'Authorised family access' },
      { name: 'AI Intelligence', path: '/features/ai', desc: 'Summaries, detection and copilot' },
    ],
  },
  {
    name: 'Solutions', path: '#',
    children: [
      { name: 'Domiciliary Care', path: '/solutions/domiciliary-care', desc: 'Home care scheduling and delivery' },
      { name: 'Supported Living', path: '/solutions/supported-living', desc: 'Person-centred support' },
      { name: 'Mobile App', path: '/download', desc: 'iOS and Android' },
    ],
  },
  {
    name: 'Compliance', path: '/compliance',
    children: [
      { name: 'Overview', path: '/compliance' },
      { name: 'CQC · England', path: '/compliance/cqc' },
      { name: 'Care Inspectorate · Scotland', path: '/compliance/care-inspectorate' },
      { name: 'CIW · Wales', path: '/compliance/ciw' },
      { name: 'RQIA · Northern Ireland', path: '/compliance/rqia' },
    ],
  },
  { name: 'Resources', path: '/blog' },
  { name: 'Security', path: '/security' },
]

/* ─── Component ────────────────────────────────────── */

export default function Nav() {
  const nav = useNavigate()
  const loc = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileExpanded, setMobileExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { setMobileOpen(false) }, [loc.pathname])

  const go = useCallback((path: string) => {
    if (path !== '#') nav(path)
    setMobileOpen(false)
  }, [nav])

  const isActive = (path: string) => path !== '#' && (loc.pathname === path || loc.pathname.startsWith(path + '/'))

  return (
    <>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          bgcolor: scrolled ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.98)',
          backdropFilter: 'blur(16px)',
          borderBottom: `1px solid ${scrolled ? P.subtle : 'transparent'}`,
          boxShadow: scrolled ? S.sm : 'none',
          transition: `border-color ${X.base}, box-shadow ${X.base}`,
        }}
      >
        <Container maxWidth="lg">
          <Toolbar sx={{ justifyContent: 'space-between', px: '0 !important', minHeight: { xs: 56, md: 68 } }}>
            {/* Logo */}
            <Box
              onClick={() => go('/')}
              sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5, userSelect: 'none' }}
            >
              <Box
                component="img"
                src="/logo.svg"
                alt="MeticleCare"
                sx={{ height: { xs: 28, md: 32 }, width: 'auto' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <Typography sx={{
                fontSize: { xs: '1.15rem', md: '1.3rem' },
                fontWeight: 800,
                color: P.navy,
                letterSpacing: '-0.03em',
                display: { xs: 'none', sm: 'block' },
              }}>
                Meticle<span style={{ color: P.teal }}>Care</span>
              </Typography>
            </Box>

            {/* Desktop nav */}
            <Stack direction="row" spacing={1} alignItems="center" sx={{ display: { xs: 'none', lg: 'flex' } }}>
              {navGroups.map((group) => (
                <Box
                  key={group.name}
                  sx={{
                    position: 'relative',
                    '&:hover > .dropdown': { opacity: 1, visibility: 'visible', transform: 'translateY(0)' },
                  }}
                >
                  <Typography
                    onClick={() => go(group.path)}
                    onKeyDown={(e) => { if (e.key === 'Enter') go(group.path) }}
                    tabIndex={0}
                    sx={{
                      ...T.label,
                      py: 2, px: 1.5, cursor: 'pointer',
                      color: isActive(group.path) ? P.navy : P.slateLight,
                      display: 'flex', alignItems: 'center', gap: 0.5,
                      '&:hover': { color: P.navy },
                      '&:focus-visible': { outline: `2px solid ${P.teal}`, outlineOffset: 4, borderRadius: R.sm },
                    }}
                  >
                    {group.name}
                    {group.children && <ExpandMore sx={{ fontSize: 14, opacity: 0.5 }} />}
                  </Typography>

                  {group.children && (
                    <Box
                      className="dropdown"
                      sx={{
                        position: 'absolute', top: '100%', left: '50%',
                        transform: 'translateX(-50%) translateY(-4px)',
                        width: group.children.length > 4 ? 'min(520px, calc(100vw - 48px))' : 'min(280px, calc(100vw - 48px))',
                        bgcolor: P.card, borderRadius: Lg, boxShadow: S.xl,
                        border: `1px solid ${P.faint}`, p: 1.5, zIndex: 200,
                        opacity: 0, visibility: 'hidden',
                        transition: `opacity ${X.fast}, visibility ${X.fast}, transform ${X.smooth}`,
                      }}
                    >
                      {group.children.length > 4 ? (
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
                          {group.children.map((child) => (
                            <Box
                              key={child.path}
                              onClick={() => go(child.path)}
                              sx={{
                                p: 1.5, borderRadius: R.sm, cursor: 'pointer',
                                transition: `background ${X.fast}`,
                                '&:hover': { bgcolor: P.faint },
                              }}
                            >
                              <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: P.navy }}>{child.name}</Typography>
                              {child.desc && <Typography sx={{ fontSize: '0.75rem', color: P.muted, mt: 0.25 }}>{child.desc}</Typography>}
                            </Box>
                          ))}
                        </Box>
                      ) : (
                        group.children.map((child) => (
                          <Box
                            key={child.path}
                            onClick={() => go(child.path)}
                            sx={{
                              p: 1.5, borderRadius: R.sm, cursor: 'pointer',
                              transition: `background ${X.fast}`,
                              '&:hover': { bgcolor: P.faint },
                            }}
                          >
                            <Typography sx={{ fontWeight: 500, fontSize: '0.875rem', color: P.slate }}>{child.name}</Typography>
                          </Box>
                        ))
                      )}
                    </Box>
                  )}
                </Box>
              ))}
            </Stack>

            {/* Desktop CTAs */}
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ display: { xs: 'none', lg: 'flex' } }}>
              <Button onClick={() => go('/login')} sx={{ fontWeight: 600, color: P.slate, textTransform: 'none', fontSize: '0.875rem' }}>Login</Button>
              <Button
                variant="contained"
                onClick={() => go('/contact')}
                sx={{
                  bgcolor: P.teal, color: P.navy, fontWeight: 700,
                  px: 2.5, py: 1, borderRadius: R.md, textTransform: 'none',
                  fontSize: '0.875rem', boxShadow: 'none',
                  '&:hover': { bgcolor: P.tealDark, boxShadow: 'none' },
                }}
              >Book a demo</Button>
            </Stack>

            {/* Mobile menu button */}
            <IconButton
              onClick={() => setMobileOpen(true)}
              sx={{ display: { lg: 'none' }, color: P.navy }}
              aria-label="Open menu"
            >
              <MenuIcon />
            </IconButton>
          </Toolbar>
        </Container>
      </AppBar>

      {/* Mobile drawer */}
      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        PaperProps={{ sx: { width: '85vw', maxWidth: 360, bgcolor: P.card } }}
      >
        <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: P.navy }}>
            Meticle<span style={{ color: P.teal }}>Care</span>
          </Typography>
          <IconButton onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <Close />
          </IconButton>
        </Box>

        <Box sx={{ px: 2, pb: 3 }}>
          {navGroups.map((group) => (
            <Box key={group.name} sx={{ mb: 0.5 }}>
              {group.children ? (
                <>
                  <Box
                    onClick={() => setMobileExpanded((p) => ({ ...p, [group.name]: !p[group.name] }))}
                    sx={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      p: 1.5, borderRadius: R.sm, cursor: 'pointer',
                      '&:hover': { bgcolor: P.faint },
                    }}
                  >
                    <Typography sx={{ fontWeight: 600, color: P.navy }}>{group.name}</Typography>
                    <ExpandMore sx={{
                      fontSize: 18, color: P.muted,
                      transition: `transform ${X.fast}`,
                      transform: mobileExpanded[group.name] ? 'rotate(180deg)' : 'none',
                    }} />
                  </Box>
                  <Collapse in={mobileExpanded[group.name]}>
                    <Box sx={{ pl: 1.5, pb: 1 }}>
                      {group.children.map((child) => (
                        <Box
                          key={child.path}
                          onClick={() => go(child.path)}
                          sx={{ p: 1.25, borderRadius: R.sm, cursor: 'pointer', '&:hover': { bgcolor: P.faint } }}
                        >
                          <Typography sx={{ fontSize: '0.9rem', color: P.slate }}>{child.name}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Collapse>
                </>
              ) : (
                <Box
                  onClick={() => go(group.path)}
                  sx={{ p: 1.5, borderRadius: R.sm, cursor: 'pointer', '&:hover': { bgcolor: P.faint } }}
                >
                  <Typography sx={{ fontWeight: 600, color: P.navy }}>{group.name}</Typography>
                </Box>
              )}
            </Box>
          ))}

          <Box sx={{ mt: 3, borderTop: `1px solid ${P.faint}`, pt: 3 }}>
            <Button
              fullWidth variant="contained"
              endIcon={<ArrowForward />}
              onClick={() => go('/contact')}
              sx={{ bgcolor: P.teal, color: P.navy, fontWeight: 700, py: 1.4, borderRadius: R.md, textTransform: 'none', mb: 1.5 }}
            >Book a demo</Button>
            <Button
              fullWidth variant="outlined"
              onClick={() => go('/login')}
              sx={{ borderColor: P.subtle, color: P.navy, fontWeight: 600, py: 1.4, borderRadius: R.md, textTransform: 'none' }}
            >Login</Button>
          </Box>
        </Box>
      </Drawer>
    </>
  )
}

/* Helper for the dropdown width */
const Lg = R.lg
