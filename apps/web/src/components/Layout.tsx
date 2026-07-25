import { useState, useEffect, useCallback } from 'react'
import { Box, Drawer, AppBar, Toolbar, List, Typography, Divider, IconButton, ListItem, ListItemButton, ListItemIcon, ListItemText, Avatar, Menu, MenuItem, Badge, Stack, Paper, Button } from '@mui/material'
import { 
  Dashboard as DashboardIcon, 
  People as PeopleIcon, 
  Description as ComplianceIcon, 
  CalendarMonth as ScheduleIcon, 
  Settings as SettingsIcon,
  Menu as MenuIcon,
  Notifications as NotificationsIcon,
  Logout as LogoutIcon,
  School as SchoolIcon,
  AccountCircle as ProfileIcon,
  Check as CheckIcon,
  CreditCard as BillingIcon,
  BeachAccess as LeaveIcon,
  Warning as WarningIcon,
  Chat as ChatIcon,
  Event as EventIcon,
  Article as PolicyIcon,
  Flag as FlagIcon,
  Medication as MedicationIcon,
  Storefront as MarketplaceIcon,
  Business as BusinessIcon,
  Checklist as TaskIcon,
  BarChart as ReportsIcon,
  Receipt as ReceiptIcon,
  AdminPanelSettings as AdminIcon,
  Psychology as OutcomeIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { UserRole } from '@meticle/shared'
import api from '../services/api'
import { connectSocket, disconnectSocket } from '../services/socket'
import OfflineBanner from './OfflineBanner'
import RouteLoadingIndicator from './RouteLoadingIndicator'
import { useSubscriptionStatus } from './SubscriptionGuard'

const drawerWidth = 260

export default function Layout({ children }: { children?: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [chatUnreadCount, setChatUnreadCount] = useState(0)
  const { isActive, loading: subLoading, status: subStatus } = useSubscriptionStatus()

  const [rawUser, setRawUser] = useState<any>(() => {
    const s = localStorage.getItem('user'); try { return s ? JSON.parse(s) : {} } catch { return {} }
  })
  const [orgName, setOrgName] = useState(() => {
    const s = localStorage.getItem('organization'); try { return s ? JSON.parse(s).name : null } catch { return null }
  })
  const [locationName, setLocationName] = useState('')
  const [modulePermissions, setModulePermissions] = useState<Record<string, string>>({})
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const userName = rawUser.first_name || rawUser.email?.split('@')[0] || 'Admin'
  const userRole = rawUser.role || UserRole.ORG_ADMIN
  const profilePic = rawUser.profile_picture_url || ''
  const userInitial = rawUser.first_name?.[0] || rawUser.email?.[0] || '?'

  interface NavItem { text: string; icon: JSX.Element; path: string; module: string; roles: UserRole[] }
  interface NavGroup { label: string; items: NavItem[] }

  const menuGroups: NavGroup[] = [
    {
      label: 'Overview',
      items: [
        { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard', module: 'dashboard', roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER] },
      ],
    },
    {
      label: 'Care Management',
      items: [
        { text: 'Service Users', icon: <PeopleIcon />, path: '/service-users', module: 'staff_directory', roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER] },
        { text: 'Goals', icon: <FlagIcon />, path: '/goals', module: 'dashboard', roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER] },
        { text: 'Care Assessments', icon: <EventIcon />, path: '/care-assessments', module: 'staff_directory', roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER] },
        { text: 'Medications', icon: <MedicationIcon />, path: '/emedication', module: 'dashboard', roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER] },
      ],
    },
    {
      label: 'Scheduling',
      items: [
        { text: 'Rota Planner', icon: <ScheduleIcon />, path: '/scheduling', module: 'scheduling', roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER] },
        { text: 'Shift Marketplace', icon: <MarketplaceIcon />, path: '/shift-marketplace', module: 'marketplace', roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER] },
        { text: 'Agencies', icon: <BusinessIcon />, path: '/agencies', module: 'marketplace', roles: [UserRole.ORG_ADMIN, UserRole.MANAGER] },
        { text: 'Leave Manager', icon: <LeaveIcon />, path: '/leave', module: 'leave', roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER] },
      ],
    },
    {
      label: 'Compliance & Safety',
      items: [
        { text: 'Compliance', icon: <ComplianceIcon />, path: '/compliance', module: 'compliance', roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER] },
        { text: 'Policies', icon: <PolicyIcon />, path: '/policies', module: 'dashboard', roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER] },
        { text: 'Incidents', icon: <WarningIcon />, path: '/incidents', module: 'staff_directory', roles: [UserRole.ORG_ADMIN, UserRole.MANAGER] },
      ],
    },
    {
      label: 'Staff',
      items: [
        { text: 'Staff Directory', icon: <PeopleIcon />, path: '/staff', module: 'staff_directory', roles: [UserRole.ORG_ADMIN, UserRole.MANAGER] },
      ],
    },
    {
      label: 'Analytics',
      items: [
        { text: 'Reports', icon: <ReportsIcon />, path: '/reporting', module: 'reporting', roles: [UserRole.ORG_ADMIN, UserRole.MANAGER] },
        { text: 'Outcomes', icon: <OutcomeIcon />, path: '/outcomes', module: 'dashboard', roles: [UserRole.ORG_ADMIN, UserRole.MANAGER] },
      ],
    },
    {
      label: 'Communication',
      items: [
        { text: 'Communication', icon: <ChatIcon />, path: '/chat', module: 'dashboard', roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER] },
        { text: 'Tasks', icon: <TaskIcon />, path: '/tasks', module: 'dashboard', roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER] },
        { text: 'Appointments', icon: <EventIcon />, path: '/appointments', module: 'dashboard', roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER] },
        { text: 'Expenses', icon: <ReceiptIcon />, path: '/expenses', module: 'dashboard', roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER] },
      ],
    },
  ]

  const bottomItems = [
    { text: 'Billing', icon: <BillingIcon />, path: '/billing', module: 'settings', roles: [UserRole.ORG_ADMIN] },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings', module: 'settings', roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER] },
    { text: 'Learn', icon: <SchoolIcon />, path: '/learn', module: 'dashboard', roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER] },
  ]

  const sidebarDisabled = !subLoading && !isActive
  const filteredGroups = menuGroups.map(group => ({
    ...group,
    items: group.items.filter(item =>
      item.roles.includes(userRole) &&
      (modulePermissions[item.module] || 'view') !== 'none'
    ),
  })).filter(group => group.items.length > 0)
  const filteredBottomItems = bottomItems.filter(item =>
    item.roles.includes(userRole) &&
    (modulePermissions[item.module] || 'view') !== 'none'
  )

  useEffect(() => {
    if (!rawUser.id) return
    const token = localStorage.getItem('accessToken')
    if (!token) return

    const fetchUnreadCount = async () => {
      try {
        const res = await api.get('/notifications/unread-count')
        setUnreadCount(res.data.count)
      } catch { /* silent */ }
    }
    fetchUnreadCount()

    const fetchPermissions = async () => {
      try {
        const res = await api.get(`/permissions/${rawUser.id}`)
        const perms: Record<string, string> = {}
        res.data.permissions.forEach((p: any) => { perms[p.module] = p.permission_level })
        setModulePermissions(perms)
      } catch { /* silent */ }
    }
    fetchPermissions()

    // Request browser notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    const socket = connectSocket(token)
    socket.on('notification', (notif: any) => {
      setNotifications(prev => [notif, ...prev])
      setUnreadCount(c => c + 1)
      // Show browser notification when tab is not focused
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        try {
          new Notification(notif.title || 'Meticle', {
            body: notif.message || '',
            icon: '/favicon.ico',
          })
        } catch { /* fallback */ }
      }
    })
    socket.on('unread_count', (data: { count: number }) => {
      setUnreadCount(data.count)
    })
    socket.on('chat:unread_total', (data: { count: number }) => {
      setChatUnreadCount(data.count)
    })

    const handleChatUnread = (e: CustomEvent) => {
      setChatUnreadCount(e.detail.count)
    }
    window.addEventListener('chatUnreadUpdate', handleChatUnread as EventListener)

    return () => {
      socket.off('notification')
      socket.off('unread_count')
      disconnectSocket()
      window.removeEventListener('chatUnreadUpdate', handleChatUnread as EventListener)
    }
  }, [rawUser.id])

  const handleOpenNotif = () => {
    setNotifOpen(true)
    setUnreadCount(0)
    api.patch('/notifications/read-all').catch(() => {})
  }

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    api.patch(`/notifications/${id}/read`).catch(() => {})
  }

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me')
      const u = res.data.user
      const org = res.data.organization
      localStorage.setItem('user', JSON.stringify(u))
      localStorage.setItem('organization', JSON.stringify(org))
      setRawUser(u)
      setOrgName(org?.name || null)
      setLocationName(u?.location_name || '')
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    refreshUser()
    const interval = setInterval(refreshUser, 60000)
    window.addEventListener('focus', refreshUser)
    return () => { clearInterval(interval); window.removeEventListener('focus', refreshUser) }
  }, [refreshUser])

  // Redirect away from restricted pages when subscription is inactive
  useEffect(() => {
    if (subLoading || isActive) return
    if (userRole === UserRole.SUPER_ADMIN) return
    const path = location.pathname
    if (path === '/billing' || path === '/learn' || path.startsWith('/platform-admin')) return
    const target = userRole === UserRole.ORG_ADMIN ? '/billing' : '/learn'
    navigate(target, { replace: true })
  }, [subLoading, isActive, location.pathname, navigate, userRole])

  const navigateAndClose = (path: string) => {
    setAnchorEl(null)
    navigate(path)
  }

  const handleLogout = () => {
    localStorage.clear()
    navigate('/')
  }

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'white' }}>
      <Toolbar sx={{ px: 3, flexDirection: 'column', alignItems: 'flex-start', pt: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 900, color: '#0F4C81', letterSpacing: '-1.5px' }}>
          Meticle
        </Typography>
        {orgName && (
          <Typography variant="caption" sx={{ color: '#6B7280', fontWeight: 600, mt: 0.5 }}>
            {orgName}{locationName ? ` - ${locationName}` : ''}
          </Typography>
        )}
      </Toolbar>
      <Divider sx={{ mb: 2 }} />
      <List sx={{ px: 2, flexGrow: 1 }}>
        {userRole === UserRole.SUPER_ADMIN && (
          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => navigate('/platform-admin')}
              selected={location.pathname === '/platform-admin'}
              disabled={sidebarDisabled}
              sx={{
                borderRadius: 2,
                bgcolor: '#FEF3C7',
                border: '1px solid #FCD34D',
                mb: 1,
                '&.Mui-selected': { bgcolor: '#FDE68A', '& .MuiListItemIcon-root': { color: '#92400E' } },
                '&:hover': { bgcolor: '#FDE68A' },
                '&.Mui-disabled': { opacity: 0.45 },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: '#92400E' }}><AdminIcon /></ListItemIcon>
              <ListItemText primary="Platform Admin" primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 700, color: '#92400E' }} />
            </ListItemButton>
          </ListItem>
        )}
        {filteredGroups.map((group) => {
          const isCollapsed = collapsedGroups.has(group.label)
          const hasActiveChild = group.items.some(item => location.pathname === item.path)
          const toggleGroup = () => setCollapsedGroups(prev => {
            const next = new Set(prev)
            if (next.has(group.label)) next.delete(group.label)
            else next.add(group.label)
            return next
          })
          return (
          <Box key={group.label} sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={toggleGroup}
              sx={{
                borderRadius: 1.5, py: 0.5, px: 1.5, mb: 0.25, minHeight: 32,
                '&:hover': { bgcolor: '#F1F5F9' },
              }}
            >
              <ListItemText
                primary={group.label}
                primaryTypographyProps={{ fontSize: '0.65rem', fontWeight: 700, color: hasActiveChild ? '#0F4C81' : '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1 }}
              />
              {isCollapsed ? <ExpandMoreIcon sx={{ fontSize: 16, color: '#9CA3AF' }} /> : <ExpandLessIcon sx={{ fontSize: 16, color: '#9CA3AF' }} />}
            </ListItemButton>
            {!isCollapsed && group.items.map((item) => {
              const disabled = sidebarDisabled && item.text !== 'Learn'
              return (
              <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton 
                  onClick={disabled ? undefined : () => navigate(item.path)}
                  selected={!disabled && location.pathname === item.path}
                  disabled={disabled}
                  sx={{ 
                    borderRadius: 2,
                    '&.Mui-selected': {
                      bgcolor: '#E7EEF4',
                      color: '#0F4C81',
                      '& .MuiListItemIcon-root': { color: '#0F4C81' },
                      '&:hover': { bgcolor: '#E7EEF4' }
                    },
                    '&:hover': { bgcolor: '#F8FAFC' },
                    '&.Mui-disabled': { opacity: 0.45 },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40, color: '#6B7280' }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 600 }} />
                  {item.text === 'Communication' && chatUnreadCount > 0 && (
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#EF4444', mr: 1, flexShrink: 0 }} />
                  )}
                </ListItemButton>
              </ListItem>
              )
            })}
          </Box>
          )
        })}
      </List>
      <Divider />
      <List sx={{ p: 2 }}>
        {userRole === UserRole.SUPER_ADMIN && (
          <ListItem disablePadding>
            <ListItemButton sx={{ borderRadius: 2 }}
              onClick={() => navigate('/learn')} selected={location.pathname === '/learn'}>
              <ListItemIcon sx={{ minWidth: 40, color: location.pathname === '/learn' ? '#0F4C81' : '#6B7280' }}><SchoolIcon /></ListItemIcon>
              <ListItemText primary="Learn" primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 600 }} />
            </ListItemButton>
          </ListItem>
        )}
        {filteredBottomItems.map((item) => {
          const disabled = sidebarDisabled && item.text !== 'Billing' && item.text !== 'Learn'
          return (
          <ListItem key={item.text} disablePadding>
            <ListItemButton disabled={disabled} sx={{ borderRadius: 2, '&.Mui-disabled': { opacity: 0.45 } }}
              onClick={disabled ? undefined : () => navigate(item.path)} selected={!disabled && location.pathname === item.path}>
              <ListItemIcon sx={{ minWidth: 40, color: !disabled && location.pathname === item.path ? '#0F4C81' : '#6B7280' }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 600 }} />
            </ListItemButton>
          </ListItem>
          )
        })}
      </List>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', bgcolor: '#F8FAFC', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          bgcolor: 'white',
          borderBottom: '1px solid #E5E7EB',
          color: '#111827'
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: 3 }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(!mobileOpen)}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="subtitle1" sx={{ fontWeight: 700, display: { xs: 'none', sm: 'block' } }}>
            {userRole === UserRole.SUPER_ADMIN ? 'Platform Admin' : filteredGroups.flatMap(g => g.items).find(m => m.path === location.pathname)?.text || 'Overview'}
          </Typography>

          <Stack direction="row" spacing={2} alignItems="center">
            <IconButton size="small" sx={{ bgcolor: '#F8FAFC' }} onClick={handleOpenNotif}>
              <Badge badgeContent={unreadCount} color="error" max={99}>
                <NotificationsIcon fontSize="small" />
              </Badge>
            </IconButton>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer', p: 0.5, borderRadius: 2, '&:hover': { bgcolor: '#F8FAFC' } }} onClick={(e) => setAnchorEl(e.currentTarget)}>
              <Avatar src={profilePic || undefined} sx={{ width: 32, height: 32, bgcolor: '#0F4C81', fontSize: '0.8rem' }}>
                {profilePic ? '' : userInitial.toUpperCase()}
              </Avatar>
              <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
                <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1 }}>{userName}</Typography>
                <Typography variant="caption" sx={{ color: '#6B7280' }}>{userRole === UserRole.SUPER_ADMIN ? 'Platform Admin' : userRole === UserRole.ORG_ADMIN ? 'Admin' : userRole === UserRole.MANAGER ? 'Manager' : 'Staff'}</Typography>
              </Box>
            </Box>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, borderRight: '1px solid #E5E7EB' },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, borderRight: '1px solid #E5E7EB' },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{ flexGrow: 1, p: 4, width: { sm: `calc(100% - ${drawerWidth}px)` }, pt: 12 }}
      >
        <RouteLoadingIndicator />
        <OfflineBanner />
        {!subLoading && !isActive && rawUser.role !== UserRole.SUPER_ADMIN && (
          <Paper
            elevation={0}
            sx={{
              bgcolor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderLeft: 4,
              borderLeftColor: '#DC2626',
              p: 2,
              mb: 3,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#991B1B' }}>
                Subscription {subStatus === 'past_due' ? 'Past Due' : subStatus === 'canceled' ? 'Canceled' : subStatus === 'expired' ? 'Expired' : 'Inactive'}
              </Typography>
              <Typography variant="body2" sx={{ color: '#B91C1C', mt: 0.5 }}>
                Your subscription is {subStatus === 'past_due' ? 'past due' : subStatus === 'canceled' ? 'has been canceled' : subStatus === 'expired' ? 'has expired' : 'inactive'}. 
                {rawUser.role === UserRole.ORG_ADMIN ? ' Please update your billing information to restore access.' : ' Please contact your organization admin to restore access.'}
              </Typography>
            </Box>
            {rawUser.role === UserRole.ORG_ADMIN && (
              <Button
                variant="contained"
                size="small"
                sx={{ bgcolor: '#DC2626', '&:hover': { bgcolor: '#B91C1C' }, whiteSpace: 'nowrap', flexShrink: 0 }}
                onClick={() => navigate('/billing')}
              >
                Update Billing
              </Button>
            )}
          </Paper>
        )}
        {children || <Outlet />}
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{ sx: { width: 200, mt: 1, border: '1px solid #E5E7EB', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' } }}
      >
        <MenuItem onClick={() => navigateAndClose('/settings')}>
          <ListItemIcon><ProfileIcon fontSize="small" /></ListItemIcon>
          Profile Settings
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout} sx={{ color: '#DC2626' }}>
          <ListItemIcon><LogoutIcon fontSize="small" sx={{ color: '#DC2626' }} /></ListItemIcon>
          Sign Out
        </MenuItem>
      </Menu>

      <Drawer
        anchor="right"
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        PaperProps={{ sx: { width: 360, borderLeft: '1px solid #E5E7EB' } }}
      >
        <Box sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Notifications</Typography>
            {notifications.length > 0 && (
              <Button size="small" onClick={() => { api.patch('/notifications/read-all').catch(() => {}); setNotifications(prev => prev.map(n => ({ ...n, read: true }))) }}>
                Mark all read
              </Button>
            )}
          </Stack>
          {notifications.length === 0 ? (
            <Typography variant="body2" color="#9CA3AF" sx={{ textAlign: 'center', py: 4 }}>No notifications yet.</Typography>
          ) : (
            <Stack spacing={2}>
              {notifications.map((n: any) => (
                <Paper
                  key={n.id}
                  variant="outlined"
                  sx={{
                    p: 2, borderRadius: 2,
                    borderLeft: 4,
                    borderLeftColor: n.type === 'warning' ? '#D97706' : n.type === 'success' ? '#16A34A' : '#0F4C81',
                    bgcolor: n.read ? 'white' : '#F8FAFC',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: '#F1F5F9' },
                  }}
                  onClick={() => handleMarkAsRead(n.id)}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: n.read ? 600 : 800, mb: 0.5 }}>{n.title}</Typography>
                      <Typography variant="caption" color="#6B7280" sx={{ display: 'block', mb: 0.5 }}>{n.message}</Typography>
                      <Typography variant="caption" color="#9CA3AF">{timeAgo(n.created_at)}</Typography>
                    </Box>
                    {!n.read && <CheckIcon sx={{ fontSize: 16, color: '#0F4C81', mt: 0.5 }} />}
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Box>
      </Drawer>
    </Box>
  )
}
