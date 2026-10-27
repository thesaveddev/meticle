import { useState, useEffect, useCallback } from 'react'
import { Box, Toolbar, Container, Stack, Button, Typography, Drawer, IconButton } from '@mui/material'
import { useNavigate, useLocation } from 'react-router-dom'
import { Menu as MenuIcon, ArrowForward } from '@mui/icons-material'
import { M } from '../../styles/marketing-tokens'
import BrandWordmark from '../BrandWordmark'
import { FIcon, type MarketingIconName } from './icons'

/* ─── Navigation data (Figma 02 · Navigation states) ───────────────
 * Desktop dropdowns: Menu/Platform 20:60 (Modules grid + Compliance column
 * + linked footer) and Menu/Solutions 20:178 (By service / For carers +
 * aside). Mobile: full-screen menu 21:631 with Platform/Solutions expanders.
 * The floating bar itself is untouched — only the panels were redesigned.
 */

type ModuleChild = { name: string; path: string; desc: string; icon: MarketingIconName }

const platformModules: ModuleChild[] = [
  { name: 'Care Management', path: '/features/care-management', desc: 'Plans, notes, reviews and observations', icon: 'heart' },
  { name: 'Medication (eMAR)', path: '/features/medication', desc: 'Administration records and audit trails', icon: 'pill' },
  { name: 'Workforce', path: '/features/workforce', desc: 'Staff, training and competency', icon: 'users' },
  { name: 'Scheduling', path: '/features/scheduling', desc: 'Rota planning and open calls', icon: 'calendar' },
  { name: 'Risk & Incidents', path: '/features/risk-management', desc: 'Assessments, recording and follow-up', icon: 'alert' },
  { name: 'Reporting', path: '/features/reporting', desc: 'Dashboards and evidence', icon: 'chart' },
  { name: 'Family Portal', path: '/features/family-portal', desc: 'Authorised family access', icon: 'home' },
  { name: 'AI Intelligence', path: '/features/ai', desc: 'Summaries, detection and copilot', icon: 'sparkles' },
]

const complianceOverview = { name: 'Compliance overview', path: '/compliance', desc: 'One view across all four nations' }

const regulators = [
  { name: 'CQC', nation: 'England', path: '/compliance/cqc' },
  { name: 'Care Inspectorate', nation: 'Scotland', path: '/compliance/care-inspectorate' },
  { name: 'CIW', nation: 'Wales', path: '/compliance/ciw' },
  { name: 'RQIA', nation: 'Northern Ireland', path: '/compliance/rqia' },
]

const solutionServices: ModuleChild[] = [
  { name: 'Domiciliary Care', path: '/solutions/domiciliary-care', desc: 'From the office to the doorstep', icon: 'home' },
  { name: 'Supported Living', path: '/solutions/supported-living', desc: 'Connected around the person', icon: 'heart' },
]

const solutionCarers: ModuleChild[] = [
  { name: 'Mobile App', path: '/download', desc: 'Check-in, care notes and rota on the go', icon: 'phone' },
]

/* N1b · five top-level links; Platform and Solutions open mega panels. */
const plainLinks = [
  { name: 'Resources', path: '/blog' },
  { name: 'Security', path: '/security' },
  { name: 'About', path: '/about' },
]

/* ─── Shared bits ───────────────────────────────────────────────── */

const panelShadow = '0 32px 12px rgba(12,27,46,0.08), 0 6px 2px rgba(12,27,46,0.05)'

function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, color: M.slate, pl: '12px', pb: '4px' }}>
      {children}
    </Typography>
  )
}

function ModuleItem({ item, go, selected }: { item: ModuleChild; go: (path: string) => void; selected?: boolean }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={() => go(item.path)}
      aria-current={selected ? 'true' : undefined}
      sx={{
        border: `1px solid ${selected ? '#D9E6F5' : 'transparent'}`,
        width: '100%', textAlign: 'left',
        bgcolor: selected ? M.paper : 'transparent', cursor: 'pointer',
        display: 'flex', alignItems: 'flex-start', gap: '12px',
        p: '10px 12px', borderRadius: '10px',
        transition: `background ${M.transition.fast}, border-color ${M.transition.fast}`,
        '&:hover': { bgcolor: M.paper, borderColor: '#D9E6F5' },
        '&:hover .mi-title': { color: M.navy },
        '&:focus-visible': { outline: `2px solid ${M.navy}`, outlineOffset: 2 },
      }}
    >
      <Box sx={{ color: M.navy, pt: '1px', display: 'flex', flexShrink: 0 }}>
        <FIcon name={item.icon} size={18} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography className="mi-title" sx={{ fontWeight: 600, fontSize: '0.9375rem', lineHeight: 1.25, color: selected ? M.navy : M.dark }}>
          {item.name}
        </Typography>
        <Typography sx={{ fontSize: '0.8125rem', lineHeight: 1.4, color: M.slate, mt: '2px' }}>
          {item.desc}
        </Typography>
      </Box>
    </Box>
  )
}

/* ─── Desktop panels ────────────────────────────────────────────── */

function PlatformPanel({ go, activePath }: { go: (path: string) => void; activePath: string }) {
  return (
    <Box sx={{ bgcolor: '#fff', borderRadius: '16px', border: `1px solid ${M.faint}`, boxShadow: panelShadow, overflow: 'hidden' }}>
      <Box sx={{ display: 'flex' }}>
        {/* Modules */}
        <Box sx={{ flex: '1 1 0', minWidth: 0, p: '20px 16px 16px' }}>
          <MenuLabel>Modules</MenuLabel>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '2px 4px' }}>
            {platformModules.map((m) => <ModuleItem key={m.path} item={m} go={go} selected={m.path !== '#' && (activePath === m.path || activePath.startsWith(m.path + '/'))} />)}
          </Box>
        </Box>
        {/* Compliance */}
        <Box sx={{ width: 320, flexShrink: 0, bgcolor: M.paper, p: '20px 16px 16px' }}>
          <MenuLabel>Compliance</MenuLabel>
          <Box
            component="button"
            type="button"
            onClick={() => go(complianceOverview.path)}
            sx={{
              border: `1px solid ${M.faint}`, width: '100%', textAlign: 'left', bgcolor: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
              p: '10px 12px', borderRadius: '10px', mb: '4px',
              transition: `background ${M.transition.fast}`,
              '&:hover': { bgcolor: M.paper },
              '&:focus-visible': { outline: `2px solid ${M.navy}`, outlineOffset: 2 },
            }}
          >
            <Box>
              <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem', color: M.dark }}>{complianceOverview.name}</Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: M.slate }}>{complianceOverview.desc}</Typography>
            </Box>
            <Box sx={{ color: M.navy, display: 'flex', flexShrink: 0 }}>
              <FIcon name="arrowRight" size={16} />
            </Box>
          </Box>
          {regulators.map((r, i) => (
            <Box
              key={r.path}
              component="button"
              type="button"
              onClick={() => go(r.path)}
              sx={{
                border: 0, borderBottom: i < regulators.length - 1 ? `1px solid ${M.faint}` : 'none',
                width: '100%', bgcolor: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                p: '9px 12px', borderRadius: i === regulators.length - 1 ? '0 0 10px 10px' : 0,
                transition: `background ${M.transition.fast}`,
                '&:hover': { bgcolor: '#fff' },
                '&:focus-visible': { outline: `2px solid ${M.navy}`, outlineOffset: -2 },
              }}
            >
              <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem', color: M.dark }}>{r.name}</Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: M.slate }}>{r.nation}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
      {/* Footer */}
      <Box sx={{ bgcolor: M.paper, borderTop: `1px solid ${M.faint}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, p: '14px 28px' }}>
        <Typography sx={{ fontSize: '0.8125rem', color: M.slate }}>
          Every module shares one record — the person, the visit and the staff member stay linked.
        </Typography>
        <Box
          component="button"
          type="button"
          onClick={() => go('/platform')}
          sx={{
            border: 0, bgcolor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            color: M.navy, fontWeight: 600, fontSize: '0.8125rem', whiteSpace: 'nowrap', fontFamily: 'inherit',
            '&:hover': { textDecoration: 'underline' },
            '&:focus-visible': { outline: `2px solid ${M.navy}`, outlineOffset: 2, borderRadius: 4 },
          }}
        >
          Explore the platform
          <FIcon name="arrowRight" size={14} />
        </Box>
      </Box>
    </Box>
  )
}

function SolutionsPanel({ go, activePath }: { go: (path: string) => void; activePath: string }) {
  return (
    <Box sx={{ bgcolor: '#fff', borderRadius: '16px', border: `1px solid ${M.faint}`, boxShadow: panelShadow, overflow: 'hidden', display: 'flex' }}>
      <Box sx={{ flex: '1 1 0', minWidth: 0, p: '20px 16px 16px' }}>
        <MenuLabel>By service</MenuLabel>
        {solutionServices.map((s) => <ModuleItem key={s.path} item={s} go={go} selected={s.path !== '#' && (activePath === s.path || activePath.startsWith(s.path + '/'))} />)}
        <Box sx={{ borderBottom: `1px solid ${M.faint}`, mx: '12px', my: '8px' }} />
        <MenuLabel>For carers</MenuLabel>
        {solutionCarers.map((s) => <ModuleItem key={s.path} item={s} go={go} />)}
      </Box>
      <Box sx={{ width: 248, flexShrink: 0, bgcolor: M.paper, p: '24px' }}>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, color: M.slate, mb: 1.5 }}>
          Not sure which fits?
        </Typography>
        <Typography sx={{ fontSize: '0.875rem', lineHeight: 1.6, color: '#2A3A50', mb: 2 }}>
          Most providers run a mix of both. MeticleCare shapes the workflows around your organisation type.
        </Typography>
        <Box
          component="button"
          type="button"
          onClick={() => go('/contact')}
          sx={{
            border: 0, bgcolor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            color: M.navy, fontWeight: 600, fontSize: '0.875rem', fontFamily: 'inherit', p: 0,
            '&:hover': { textDecoration: 'underline' },
            '&:focus-visible': { outline: `2px solid ${M.navy}`, outlineOffset: 2, borderRadius: 4 },
          }}
        >
          Talk to the team
          <FIcon name="arrowRight" size={14} />
        </Box>
      </Box>
    </Box>
  )
}

/* ─── Component ─────────────────────────────────────────────────── */

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

  const pillSx = {
    border: 0, bgcolor: 'transparent', fontFamily: 'inherit', textTransform: 'none', minWidth: 0,
    ...M.label,
    py: 2, px: 1.5, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 0.5,
    transition: `color ${M.transition.fast}`,
    '&:focus-visible': { outline: `2px solid ${M.navy}`, outlineOffset: 4, borderRadius: M.r.sm },
  } as const

  const renderDropdown = (name: 'Platform' | 'Solutions') => (
    <Box
      className="dropdown"
      sx={{
        position: 'fixed', top: 96, left: '50%',
        transform: 'translateX(-50%) translateY(-4px)',
        width: name === 'Platform' ? 'min(1008px, calc(100vw - 48px))' : 'min(640px, calc(100vw - 48px))',
        maxHeight: 'calc(100vh - 120px)', overflowY: 'auto',
        zIndex: 200, opacity: 0, visibility: 'hidden',
        transition: `opacity ${M.transition.fast}, visibility ${M.transition.fast}, transform ${M.transition.smooth}`,
      }}
    >
      {name === 'Platform' ? <PlatformPanel go={go} activePath={loc.pathname} /> : <SolutionsPanel go={go} activePath={loc.pathname} />}
    </Box>
  )

  const topLink = (name: string, path: string, active: boolean, hasMenu?: 'Platform' | 'Solutions') => (
    <Box
      key={name}
      sx={{
        position: 'static',
        '&:hover > .dropdown, &:focus-within > .dropdown': { opacity: 1, visibility: 'visible', transform: 'translateX(-50%) translateY(0)' },
      }}
    >
      <Typography
        component="button"
        type="button"
        onClick={() => go(path)}
        aria-haspopup={hasMenu ? 'true' : undefined}
        sx={{ ...pillSx, color: active ? M.navy : M.slate, '&:hover': { color: M.navy } }}
      >
        {name}
        {hasMenu && <FIcon name="chevronDown" size={14} sx={{ opacity: 0.5 }} />}
      </Typography>
      {hasMenu && renderDropdown(hasMenu)}
    </Box>
  )

  return (
    <>
      {/* Floating pill bar (unchanged — only the dropdown panels were redesigned). */}
      <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1200, px: { xs: 1.5, md: 3 }, pt: { xs: 1.5, md: 2.5 }, pointerEvents: 'none' }}>
        <Container
          maxWidth="lg"
          sx={{
            pointerEvents: 'auto',
            bgcolor: scrolled ? 'rgba(255,255,255,0.94)' : 'rgba(255,255,255,0.72)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            borderRadius: '20px',
            border: '1px solid rgba(12,27,46,0.08)',
            boxShadow: '0 12px 32px rgba(1,52,107,0.10), 0 1px 2px rgba(11,27,45,0.04)',
            transition: `all ${M.transition.base}`,
          }}
        >
          <Toolbar sx={{ justifyContent: 'space-between', px: { xs: '8px !important', md: '16px !important' }, minHeight: { xs: 56, md: 68 } }}>
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
              <BrandWordmark size={{ xs: 18, md: 19 } as any} color={M.navy} accent={M.tealDeep} />
            </Box>
            {/* Desktop nav (links sit in their own pill, per Figma) */}
            <Stack direction="row" spacing={0} alignItems="center" sx={{ display: { xs: 'none', lg: 'flex' }, bgcolor: 'rgba(244,248,251,0.70)', borderRadius: 999, px: 0.5, border: '1px solid rgba(255,255,255,0.6)' }}>
              {topLink('Platform', '/platform', isActive('/platform'), 'Platform')}
              {topLink('Solutions', '#', loc.pathname.startsWith('/solutions') || loc.pathname.startsWith('/download'), 'Solutions')}
              {plainLinks.map((l) => (
                <Box key={l.name}>
                  <Typography
                    component="button"
                    type="button"
                    onClick={() => go(l.path)}
                    sx={{ ...pillSx, color: isActive(l.path) ? M.navy : M.slate, '&:hover': { color: M.navy } }}
                  >
                    {l.name}
                  </Typography>
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
                  bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600,
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
      </Box>

      {/* Mobile full-screen menu (Figma 21:631) */}
      <Drawer
        anchor="top"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        sx={{ zIndex: 1300 }}
        PaperProps={{ sx: { height: '100dvh', maxHeight: '100dvh', borderRadius: 0, bgcolor: '#fff' } }}
      >
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: '26px', pt: '24px', pb: '24px', pl: '26px', pr: '22px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box component="img" src="/logo.svg" alt="MeticleCare" sx={{ height: 30, width: 'auto' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              <BrandWordmark size={18} color={M.navy} accent={M.tealDeep} />
            </Box>
            <IconButton
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              sx={{ width: 44, height: 44, borderRadius: '12px', bgcolor: '#F4F8FB', border: `1px solid ${M.faint}`, color: M.dark }}
            >
              <FIcon name="close" size={24} />
            </IconButton>
          </Box>

          {/* Rows */}
          <Box sx={{ px: '20px', flex: 1 }}>
            <MobileRow
              label="Platform"
              expanded={Boolean(mobileExpanded.Platform)}
              onToggle={() => setMobileExpanded((p) => ({ ...p, Platform: !p.Platform }))}
              onNavigate={() => go('/platform')}
            />
            {mobileExpanded.Platform && <MobilePlatformPanel go={go} />}
            <MobileRow
              label="Solutions"
              expanded={Boolean(mobileExpanded.Solutions)}
              onToggle={() => setMobileExpanded((p) => ({ ...p, Solutions: !p.Solutions }))}
            />
            {mobileExpanded.Solutions && <MobileSolutionsPanel go={go} />}
            {plainLinks.map((l) => (
              <MobileRow key={l.name} label={l.name} onNavigate={() => go(l.path)} />
            ))}
            <Typography sx={{ color: M.slate, fontSize: '0.8125rem', pt: '24px' }}>
              Built for CQC, Care Inspectorate, CIW and RQIA.
            </Typography>
          </Box>

          {/* Actions */}
          <Box sx={{ p: '16px 20px 28px', borderTop: `1px solid ${M.faint}`, bgcolor: '#fff' }}>
            <Button
              fullWidth variant="contained"
              endIcon={<ArrowForward />}
              onClick={() => go('/contact')}
              sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, py: 1.4, borderRadius: '14px', textTransform: 'none', mb: 1.5, fontSize: '0.9rem', justifyContent: 'center', '&:hover': { bgcolor: M.navyMid } }}
            >Book a demo</Button>
            <Button
              fullWidth variant="outlined"
              onClick={() => go('/login')}
              sx={{ borderColor: '#C9D5E2', color: M.dark, fontWeight: 600, py: 1.4, borderRadius: '14px', textTransform: 'none', fontSize: '0.9rem' }}
            >Login</Button>
          </Box>
        </Box>
      </Drawer>
    </>
  )
}

/* ─── Mobile rows + panels ──────────────────────────────────────── */

function MobileRow({ label, expanded, onToggle, onNavigate }: { label: string; expanded?: boolean; onToggle?: () => void; onNavigate?: () => void }) {
  const active = expanded === true
  return (
    <Box
      component="button"
      type="button"
      aria-expanded={onToggle ? active : undefined}
      onClick={onToggle ?? onNavigate}
      sx={{
        border: 0, borderBottom: active ? 'none' : `1px solid ${M.faint}`,
        width: '100%', bgcolor: 'transparent', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        py: '18px', textAlign: 'left', fontFamily: 'inherit',
        '&:focus-visible': { outline: `2px solid ${M.navy}`, outlineOffset: -2 },
      }}
    >
      <Typography sx={{ fontWeight: 600, fontSize: '1.0625rem', color: active ? M.navy : M.dark }}>{label}</Typography>
      {onToggle && (
        <FIcon
          name="chevronDown"
          size={22}
          sx={{ color: active ? M.navy : M.slate, transform: active ? 'rotate(180deg)' : 'none', transition: `transform ${M.transition.fast}` }}
        />
      )}
    </Box>
  )
}

function MobileModuleLink({ item, go }: { item: ModuleChild; go: (path: string) => void }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={() => go(item.path)}
      sx={{
        border: 0, bgcolor: 'transparent', cursor: 'pointer', minWidth: 0, flex: 1,
        display: 'flex', alignItems: 'center', gap: '10px', py: '11px', textAlign: 'left', fontFamily: 'inherit',
        '&:focus-visible': { outline: `2px solid ${M.navy}`, outlineOffset: 2, borderRadius: 4 },
      }}
    >
      <Box sx={{ color: M.navy, display: 'flex', flexShrink: 0 }}>
        <FIcon name={item.icon} size={18} />
      </Box>
      <Typography sx={{ fontSize: '0.9375rem', fontWeight: 500, color: M.dark, lineHeight: 1.3 }}>{item.name}</Typography>
    </Box>
  )
}

function MobilePlatformPanel({ go }: { go: (path: string) => void }) {
  const rows: ModuleChild[][] = [
    [platformModules[0], platformModules[1]],
    [platformModules[2], platformModules[3]],
    [platformModules[4], platformModules[5]],
    [platformModules[6], platformModules[7]],
  ]
  return (
    <Box sx={{ border: `1px solid ${M.faint}`, pt: 0, pb: '16px' }}>
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, color: M.slate, pt: '4px', pb: '6px' }}>Modules</Typography>
      {rows.map((pair, i) => (
        <Box key={i} sx={{ display: 'flex', gap: '8px' }}>
          {pair.map((m) => <MobileModuleLink key={m.path} item={m} go={go} />)}
        </Box>
      ))}
      <Box sx={{ pt: '12px' }}>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, color: M.slate, pb: '6px' }}>Compliance</Typography>
        <Box
          component="button"
          type="button"
          onClick={() => go(complianceOverview.path)}
          sx={{
            border: 0, width: '100%', bgcolor: M.paper, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            p: '12px 14px', borderRadius: '12px', textAlign: 'left', fontFamily: 'inherit',
            '&:focus-visible': { outline: `2px solid ${M.navy}`, outlineOffset: 2 },
          }}
        >
          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 500, color: M.dark }}>{complianceOverview.name}</Typography>
          <Box sx={{ color: M.navy, display: 'flex' }}>
            <FIcon name="arrowRight" size={16} />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '8px', pt: '10px' }}>
          {regulators.map((r) => (
            <Box
              key={r.path}
              component="button"
              type="button"
              onClick={() => go(r.path)}
              sx={{
                border: `1px solid ${M.faint}`, bgcolor: 'transparent', cursor: 'pointer',
                borderRadius: '999px', px: '12px', py: '7px', fontFamily: 'inherit',
                fontSize: '0.8125rem', color: '#2A3A50',
                transition: `background ${M.transition.fast}`,
                '&:hover': { bgcolor: M.paper },
                '&:focus-visible': { outline: `2px solid ${M.navy}`, outlineOffset: 2 },
              }}
            >
              {r.name} · {r.nation}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}

function MobileSolutionsPanel({ go }: { go: (path: string) => void }) {
  return (
    <Box sx={{ border: `1px solid ${M.faint}`, pt: 0, pb: '16px' }}>
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, color: M.slate, pt: '4px', pb: '6px' }}>By service</Typography>
      {solutionServices.map((s) => <MobileModuleLink key={s.path} item={s} go={go} />)}
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, color: M.slate, pt: '10px', pb: '6px' }}>For carers</Typography>
      {solutionCarers.map((s) => <MobileModuleLink key={s.path} item={s} go={go} />)}
      <Box
        component="button"
        type="button"
        onClick={() => go('/contact')}
        sx={{
          border: 0, width: '100%', bgcolor: M.paper, cursor: 'pointer', mt: '10px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
          p: '12px 14px', borderRadius: '12px', textAlign: 'left', fontFamily: 'inherit',
          fontSize: '0.875rem', fontWeight: 500, color: M.dark,
          '&:focus-visible': { outline: `2px solid ${M.navy}`, outlineOffset: 2 },
        }}
      >
        <span>Not sure which fits? Talk to the team</span>
        <Box sx={{ color: M.navy, display: 'flex', flexShrink: 0 }}>
          <FIcon name="arrowRight" size={16} />
        </Box>
      </Box>
    </Box>
  )
}
