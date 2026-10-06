import { useState, useEffect, useCallback } from 'react'
import { Box, AppBar, Toolbar, Container, Stack, Button, Typography, Drawer, IconButton, Collapse } from '@mui/material'
import { useNavigate, useLocation } from 'react-router-dom'
import { Menu as MenuIcon, Close, ExpandMore, ArrowForward } from '@mui/icons-material'
import { M } from '../../styles/marketing-tokens'

/* ─── Navigation Data ─────────────────────────────── */

type NavChild = { name: string; path: string; desc?: string }
type NavGroup = { name: string; path: string; children?: NavChild[] }

/* N1b · five top-level links, two grouped menus; compliance remains under Platform. */
const navGroups: NavGroup[] = [
  {
    name: 'Platform', path: '/platform',
    children: [
      { name: 'Care Management', path: '/features/care-management', desc: 'Plans, notes, reviews and observations' },
      { name: 'Medication (eMAR)', path: '/features/medication', desc: 'Administration records and audit trails' },
      { name: 'Workforce', path: '/features/workforce', desc: 'Staff, training and competency' },
      { name: 'Scheduling', path: '/features/scheduling', desc: 'Rota planning and open calls' },
      { name: 'Risk & Incidents', path: '/features/risk-management', desc: 'Assessments, recording and follow-up' },
      { name: 'Reporting', path: '/features/reporting', desc: 'Dashboards and evidence' },
      { name: 'Family Portal', path: '/features/family-portal', desc: 'Authorised family access' },
      { name: 'AI Intelligence', path: '/features/ai', desc: 'Summaries, detection and copilot' },
      { name: 'Compliance overview', path: '/compliance' },
      { name: 'CQC — England', path: '/compliance/cqc' },
      { name: 'Care Inspectorate — Scotland', path: '/compliance/care-inspectorate' },
      { name: 'CIW — Wales', path: '/compliance/ciw' },
      { name: 'RQIA — Northern Ireland', path: '/compliance/rqia' },
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
  { name: 'Resources', path: '/blog' },
  { name: 'Security', path: '/security' },
  { name: 'About', path: '/about' },
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
          bgcolor: scrolled ? 'rgba(255,255,255,0.94)' : 'rgba(255,255,255,0.98)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: `1px solid ${scrolled ? 'rgba(0,0,0,0.06)' : 'transparent'}`,
          transition: `all ${M.transition.base}`,
        }}
      >
        <Container maxWidth="lg">
          <Toolbar sx={{ justifyContent: 'space-between', px: '0 !important', minHeight: { xs: 56, md: 68 } }}>
            {/* Logo */}
            <Box
              component="button"
              type="button"
              onClick={() => go('/')}
              aria-label="MeticleCare home"
              sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.75, userSelect: 'none', border: 0, bgcolor: 'transparent', p: 0, '&:focus-visible': { outline: `2px solid ${M.navy}`, outlineOffset: 4, borderRadius: M.r.sm } }}
            >
              <Box
                component="img"
                src="/logo.svg"
                alt="MeticleCare"
                sx={{ height: { xs: 26, md: 30 }, width: 'auto' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <Typography sx={{
                fontSize: { xs: '1.1rem', md: '1.2rem' },
                fontWeight: 800,
                color: M.navy,
                letterSpacing: '-0.04em',
                display: { xs: 'none', sm: 'block' },
              }}>
                Meticle<span style={{ color: M.tealDeep }}>Care</span>
              </Typography>
            </Box>
            {/* Desktop nav */}
            <Stack direction="row" spacing={0} alignItems="center" sx={{ display: { xs: 'none', lg: 'flex' } }}>
              {navGroups.map((group) => (
                <Box
                  key={group.name}
                  sx={{
                    position: 'relative',
                    '&:hover > .dropdown, &:focus-within > .dropdown': { opacity: 1, visibility: 'visible', transform: 'translateX(-50%) translateY(0)' },
                  }}
                >
                  <Typography
                    component="button"
                    type="button"
                    onClick={() => go(group.path)}
                    sx={{
                      border: 0, bgcolor: 'transparent', fontFamily: 'inherit', textTransform: 'none', minWidth: 0,
                      ...M.label,
                      py: 2, px: 1.5, cursor: 'pointer',
                      color: isActive(group.path) ? M.navy : M.slate,
                      display: 'flex', alignItems: 'center', gap: 0.5,
                      transition: `color ${M.transition.fast}`,
                      '&:hover': { color: M.navy },
                      '&:focus-visible': { outline: `2px solid ${M.navy}`, outlineOffset: 4, borderRadius: M.r.sm },
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
                        maxHeight: 'calc(100vh - 88px)', overflowY: 'auto',
                        bgcolor: M.card, borderRadius: M.r.lg, boxShadow: M.shadow.xl,
                        border: `1px solid rgba(0,0,0,0.06)`, p: 1.5, zIndex: 200,
                        opacity: 0, visibility: 'hidden',
                        transition: `opacity ${M.transition.fast}, visibility ${M.transition.fast}, transform ${M.transition.smooth}`,
                      }}
                    >
                      {group.children.length > 4 ? (
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 0.5 }}>
                          {group.children.map((child) => (
                            <Box
                              key={child.path}
                              component="button"
                              type="button"
                              onClick={() => go(child.path)}
                              sx={{
                                border: 0, width: '100%', textAlign: 'left', bgcolor: 'transparent', color: 'inherit',
                                p: 1.5, borderRadius: M.r.sm, cursor: 'pointer',
                                transition: `background ${M.transition.fast}`,
                                '&:focus-visible': { outline: `2px solid ${M.navy}`, outlineOffset: 2 },
                                '&:hover': { bgcolor: M.faint },
                              }}
                            >
                              <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: M.navy, overflowWrap: 'anywhere' }}>{child.name}</Typography>
                              {child.desc && <Typography sx={{ fontSize: '0.75rem', color: M.slate, mt: 0.25 }}>{child.desc}</Typography>}
                            </Box>
                          ))}
                        </Box>
                      ) : (
                        group.children.map((child) => (
                          <Box
                            key={child.path}
                            component="button"
                            type="button"
                            onClick={() => go(child.path)}
                            sx={{
                              border: 0, width: '100%', textAlign: 'left', bgcolor: 'transparent', color: 'inherit',
                              p: 1.5, borderRadius: M.r.sm, cursor: 'pointer',
                              transition: `background ${M.transition.fast}`,
                              '&:focus-visible': { outline: `2px solid ${M.navy}`, outlineOffset: 2 },
                              '&:hover': { bgcolor: M.faint },
                            }}
                          >
                            <Typography sx={{ fontWeight: 500, fontSize: '0.875rem', color: M.slate }}>{child.name}</Typography>
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
              <Button onClick={() => go('/login')} sx={{ fontWeight: 600, color: M.slate, textTransform: 'none', fontSize: '0.85rem', '&:hover': { color: M.navy } }}>Login</Button>
              <Button
                variant="contained"
                endIcon={<ArrowForward />}
                onClick={() => go('/contact')}
                sx={{
                  bgcolor: M.navy, color: '#FFFFFF', fontWeight: 700,
                  px: 2.5, py: 1, borderRadius: M.r.md, textTransform: 'none', whiteSpace: 'nowrap',
                  fontSize: '0.85rem', boxShadow: 'none',
                  '&:hover': { bgcolor: M.navyMid, boxShadow: 'none' },
                }}
              >Book a demo</Button>
            </Stack>
            {/* Mobile menu button */}
            <IconButton
              onClick={() => setMobileOpen(true)}
              sx={{ display: { lg: 'none' }, color: M.navy, minWidth: 44, minHeight: 44 }}
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
        PaperProps={{ sx: { width: '85vw', maxWidth: 360, bgcolor: M.card } }}
      >
        <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: M.navy, letterSpacing: '-0.03em' }}>
            Meticle<span style={{ color: M.tealDeep }}>Care</span>
          </Typography>
          <IconButton onClick={() => setMobileOpen(false)} aria-label="Close menu" size="small">
            <Close sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>

        <Box sx={{ px: 2, pb: 3 }}>
          {navGroups.map((group) => (
            <Box key={group.name} sx={{ mb: 0.25 }}>
              {group.children ? (
                <>
                  <Box
                    component="button"
                    type="button"
                    aria-expanded={Boolean(mobileExpanded[group.name])}
                    onClick={() => setMobileExpanded((p) => ({ ...p, [group.name]: !p[group.name] }))}
                    sx={{
                      border: 0, width: '100%', textAlign: 'left', bgcolor: 'transparent', color: 'inherit',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      p: 1.5, borderRadius: M.r.sm, cursor: 'pointer',
                      '&:hover': { bgcolor: M.faint },
                      '&:focus-visible': { outline: `2px solid ${M.navy}`, outlineOffset: 2 },
                    }}
                  >
                    <Typography sx={{ fontWeight: 600, color: M.navy, fontSize: '0.95rem' }}>{group.name}</Typography>
                    <ExpandMore sx={{
                      fontSize: 18, color: M.muted,
                      transition: `transform ${M.transition.fast}`,
                      transform: mobileExpanded[group.name] ? 'rotate(180deg)' : 'none',
                    }} />
                  </Box>
                  <Collapse in={mobileExpanded[group.name]}>
                    <Box sx={{ pl: 1.5, pb: 1 }}>
                      {group.children.map((child) => (
                        <Box
                          key={child.path}
                          component="button"
                          type="button"
                          onClick={() => go(child.path)}
                          sx={{
                            border: 0, width: '100%', textAlign: 'left', bgcolor: 'transparent', color: 'inherit',
                            p: 1.25, borderRadius: M.r.sm, cursor: 'pointer',
                            '&:hover': { bgcolor: M.faint },
                            '&:focus-visible': { outline: `2px solid ${M.navy}`, outlineOffset: 2 },
                          }}
                        >
                          <Typography sx={{ fontSize: '0.875rem', color: M.slate }}>{child.name}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Collapse>
                </>
              ) : (
                <Box
                  component="button"
                  type="button"
                  onClick={() => go(group.path)}
                  sx={{ p: 1.5, borderRadius: M.r.sm, cursor: 'pointer', border: 0, width: '100%', textAlign: 'left', bgcolor: 'transparent', color: 'inherit', whiteSpace: 'nowrap', '&:hover': { bgcolor: M.faint }, '&:focus-visible': { outline: `2px solid ${M.navy}`, outlineOffset: 2 } }}
                >
                  <Typography sx={{ fontWeight: 600, color: M.navy, fontSize: '0.95rem' }}>{group.name}</Typography>
                </Box>
              )}
            </Box>
          ))}

          <Box sx={{ mt: 3, borderTop: `1px solid ${M.faint}`, pt: 3 }}>
            <Button
              fullWidth variant="contained"
              endIcon={<ArrowForward />}
              onClick={() => go('/contact')}
              sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 700, py: 1.4, borderRadius: M.r.md, textTransform: 'none', mb: 1.5, fontSize: '0.9rem', '&:hover': { bgcolor: M.navyMid } }}
            >Book a demo</Button>
            <Button
              fullWidth variant="outlined"
              onClick={() => go('/login')}
              sx={{ borderColor: M.subtle, color: M.navy, fontWeight: 600, py: 1.4, borderRadius: M.r.md, textTransform: 'none', fontSize: '0.9rem' }}
            >Login</Button>
          </Box>
        </Box>
      </Drawer>
    </>
  )
}
