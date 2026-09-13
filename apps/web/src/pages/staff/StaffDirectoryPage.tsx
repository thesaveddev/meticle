import { useState, useRef, useEffect } from 'react'
import {
  Box, Typography, TextField, Button, Stack, Alert,
  InputAdornment, Dialog, DialogTitle, DialogContent,
  DialogActions, MenuItem, IconButton, Avatar,
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, TableFooter,
  Menu, ListItemIcon, ListItemText,
  FormControl, InputLabel, Select, Chip,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import {
  Add as AddIcon, MoreVert as MoreVertIcon,
  Refresh as RefreshIcon, Delete as DeleteIcon,
  Edit as EditIcon, PersonAdd as PersonAddIcon,
  Block as BlockIcon, CheckCircle as CheckCircleIcon,
  CloudUpload as UploadIcon, LockReset as ResetPwdIcon,
  Security as SecurityIcon, Search as SearchIcon,
  Group as GroupIcon, People as PeopleIcon,
  Person as PersonIcon, Mail as MailIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { UserRole } from '@meticle/shared'
import * as XLSX from 'xlsx'
import api from '../../services/api'
import { PremiumCard, StatusBadge as DesignStatusBadge } from '../../components/design/PremiumCard'
import { EmptyState } from '../../components/design/EmptyState'
import { PageHeader } from '../../components/ui'

const ROLE_OPTIONS = [
  { value: 'MANAGER', label: 'Manager' },
  { value: 'CARE_WORKER', label: 'Care Worker' },
  { value: 'COMPLIANCE_OFFICER', label: 'Compliance Officer' },
  { value: 'ORG_ADMIN', label: 'Org Admin', adminOnly: true },
]

const ROLE_BADGE: Record<string, string> = {
  MANAGER: 'Mgr',
  CARE_WORKER: 'CW',
  COMPLIANCE_OFFICER: 'Comp',
}

const ROLE_LABEL: Record<string, string> = {
  ORG_ADMIN: 'Org Admin',
  MANAGER: 'Manager',
  CARE_WORKER: 'Care Worker',
  COMPLIANCE_OFFICER: 'Compliance Officer',
}

const STATUS_VARIANT: Record<string, 'completed' | 'scheduled' | 'missed' | 'in-progress' | 'pending'> = {
  active: 'completed',
  pending: 'in-progress',
  inactive: 'pending',
  deactivated: 'missed',
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  pending: 'Pending',
  inactive: 'Inactive',
  deactivated: 'Deactivated',
}

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  agency: 'Agency',
  bank: 'Bank',
  relief: 'Relief',
}

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'agency', label: 'Agency' },
  { value: 'bank', label: 'Bank' },
  { value: 'relief', label: 'Relief' },
]

const ROLE_ICON_COLOR: Record<string, string> = {
  ORG_ADMIN: '#1A2332',
  MANAGER: '#0369A1',
  CARE_WORKER: '#047857',
  COMPLIANCE_OFFICER: '#7C3AED',
}

const ROLE_BG_COLOR: Record<string, string> = {
  ORG_ADMIN: '#E7EEF4',
  MANAGER: '#DBEAFE',
  CARE_WORKER: '#E9F7F0',
  COMPLIANCE_OFFICER: '#F3E8FF',
}

const isValidEmail = (e: string) => /^\S+@\S+\.\S+$/.test(e.trim())

function ConfirmDialog({ open, title, message, onConfirm, onCancel }: {
  open: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void
}) {
  const theme = useTheme()
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '18px' } }}>
      <DialogTitle sx={{ color: 'error.main', fontWeight: 800, fontSize: '1.1rem' }}>{title}</DialogTitle>
      <DialogContent><Typography sx={{ color: theme.palette.text.secondary }}>{message}</Typography></DialogContent>
      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button onClick={onCancel} sx={{ textTransform: 'none', borderRadius: '10px', color: theme.palette.text.secondary }}>Cancel</Button>
        <Button onClick={onConfirm} color="error" variant="contained" sx={{ textTransform: 'none', borderRadius: '10px' }}>Confirm</Button>
      </DialogActions>
    </Dialog>
  )
}

export default function StaffDirectoryPage() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [employmentFilter, setEmploymentFilter] = useState('')
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [activeMenuUser, setActiveMenuUser] = useState<any>(null)

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('MANAGER')
  const [inviteLocationId, setInviteLocationId] = useState('')
  const [inviteEntries, setInviteEntries] = useState<Array<{ email: string; role: string; location_id?: string }>>([])
  const [uploading, setUploading] = useState(false)
  const [addDialogError, setAddDialogError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: locationList = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const res = await api.get('/leave/locations')
      return res.data
    }
  })

  const [changeRoleOpen, setChangeRoleOpen] = useState(false)
  const [changeRoleUser, setChangeRoleUser] = useState<any>(null)
  const [changeRoleValue, setChangeRoleValue] = useState('')

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmTitle, setConfirmTitle] = useState('')
  const [confirmMessage, setConfirmMessage] = useState('')
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {})

  const [successAlert, setSuccessAlert] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  const queryClient = useQueryClient()

  const userStr = localStorage.getItem('user')
  let currentUser: any = {}
  try { currentUser = userStr ? JSON.parse(userStr) : {} } catch { currentUser = {} }
  const currentUserId = currentUser.id
  const currentUserRole = currentUser.role

  const showSuccess = (msg: string) => {
    setSuccessAlert(msg)
    setTimeout(() => setSuccessAlert(''), 3000)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['org-members'],
    queryFn: async () => {
      const response = await api.get('/staff/org-members')
      return response.data
    }
  })

  const inviteMutation = useMutation({
    mutationFn: (payload: { email: string; role: string; location_id?: string }) =>
      api.post('/organizations/invitation/invite', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] })
    }
  })

  const resendMutation = useMutation({
    mutationFn: (id: string) => api.post(`/organizations/invitation/resend/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] })
      showSuccess('Reminder sent successfully!')
    },
    onError: () => {
      showSuccess('Failed to send reminder.')
    }
  })

  const cancelInviteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/organizations/invitation/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] })
      showSuccess('Invitation cancelled.')
    }
  })

  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.patch(`/staff/${userId}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] })
      showSuccess('Role updated.')
    }
  })

  const toggleStatusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: string }) =>
      api.patch(`/staff/${userId}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] })
      showSuccess('Status updated.')
    },
    onError: () => {
      showSuccess('Failed to update status.')
    }
  })

  const removeStaffMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/staff/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] })
      showSuccess('Staff member removed.')
    }
  })

  const forcePasswordResetMutation = useMutation({
    mutationFn: (userId: string) => api.post(`/staff/${userId}/force-password-reset`),
    onSuccess: () => {
      showSuccess('Password reset email sent to user.')
    },
    onError: () => {
      showSuccess('Failed to send password reset.')
    }
  })

  const resetMfaMutation = useMutation({
    mutationFn: (userId: string) => api.post(`/mfa/admin-disable/${userId}`),
    onSuccess: () => {
      showSuccess('MFA has been reset for the user.')
      queryClient.invalidateQueries({ queryKey: ['org-members'] })
    },
    onError: () => {
      showSuccess('Failed to reset MFA.')
    }
  })

  const admins = data?.admins?.length ? data.admins : (data?.admin ? [data.admin] : [])
  const staff = data?.staff || []
  const invitations = data?.invitations || []

  const existingEmails = new Set([
    ...admins.map((a: any) => a.email),
    ...staff.map((s: any) => s.email),
    ...invitations.map((i: any) => i.email),
  ])

  const allMembers = [
    ...admins.map((a: any) => ({ ...a, _type: 'admin' as const })),
    ...staff.map((s: any) => ({ ...s, _type: 'staff' as const })),
    ...invitations.map((i: any) => ({ ...i, _type: 'invitation' as const })),
  ]

  const filtered = allMembers.filter((m: any) => {
    if (employmentFilter && m.employment_type !== employmentFilter) return false
    if (!search) return true
    const q = search.toLowerCase()
    const name = `${m.first_name || ''} ${m.last_name || ''}`.toLowerCase()
    return m.email?.toLowerCase().includes(q) || name.includes(q)
  })

  useEffect(() => { setPage(0) }, [search, employmentFilter])

  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)

  const handleChangePage = (_: any, newPage: number) => setPage(newPage)
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const handleMenuOpen = (e: React.MouseEvent<HTMLButtonElement>, user: any) => {
    setAnchorEl(e.currentTarget)
    setActiveMenuUser(user)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
    setActiveMenuUser(null)
  }

  const handleAddEntry = () => {
    const email = inviteEmail.trim().toLowerCase()
    if (!email || !isValidEmail(email)) return
    if (inviteEntries.some(e => e.email === email)) return
    if (existingEmails.has(email)) {
      setAddDialogError(`${email} is already a member or has a pending invitation.`)
      return
    }
    setInviteEntries(prev => [...prev, { email, role: inviteRole, location_id: inviteLocationId || undefined }])
    setInviteEmail('')
    setAddDialogError('')
  }

  const handleRemoveEntry = (email: string) => {
    setInviteEntries(prev => prev.filter(e => e.email !== email))
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<any>(sheet)
      const VALID_ROLES = ['CARE_WORKER', 'MANAGER', 'ORG_ADMIN', 'COMPLIANCE_OFFICER']
      const locationMap = Object.fromEntries(locationList.map((l: any) => [l.name?.toLowerCase(), l.id]))
      const entries: Array<{ email: string; role: string; location_id?: string }> = []
      for (const row of rows) {
        const keys = Object.keys(row)
        const emailKey = keys.find(k => /email/i.test(k))
        const roleKey = keys.find(k => /role/i.test(k))
        const locationKey = keys.find(k => /location/i.test(k))
        if (!emailKey) continue
        const email = String(row[emailKey]).trim()
        if (!isValidEmail(email)) continue
        let role = inviteRole
        if (roleKey) {
          const rawRole = String(row[roleKey]).trim().toUpperCase()
          if (VALID_ROLES.includes(rawRole)) role = rawRole
        }
        let location_id: string | undefined
        if (locationKey && row[locationKey]) {
          const rawLoc = String(row[locationKey]).trim().toLowerCase()
          location_id = locationMap[rawLoc]
        }
        entries.push({ email, role, location_id })
      }
      const skipped = entries.filter(e => existingEmails.has(e.email))
      setInviteEntries(prev => {
        const existing = new Set(prev.map(e => e.email))
        const newEntries = entries.filter(e => !existing.has(e.email) && !existingEmails.has(e.email))
        if (skipped.length > 0) {
          setAddDialogError(`${skipped.length} email(s) skipped — already members or invited.`)
        }
        return [...prev, ...newEntries]
      })
    } catch {
      // file parse error
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSendInvitations = async () => {
    for (const entry of inviteEntries) {
      try {
        await inviteMutation.mutateAsync(entry)
      } catch {
        // continue with remaining
      }
    }
    setInviteEntries([])
    setAddDialogOpen(false)
    showSuccess('Invitations sent!')
  }

  const handleEditProfile = () => {
    if (!activeMenuUser) return
    handleMenuClose()
    navigate(`/staff/${activeMenuUser.id}`)
  }

  const handleChangeRoleOpen = () => {
    if (!activeMenuUser) return
    setChangeRoleUser(activeMenuUser)
    setChangeRoleValue(activeMenuUser.role || 'MANAGER')
    setChangeRoleOpen(true)
    handleMenuClose()
  }

  const handleSaveRole = () => {
    if (!changeRoleUser) return
    changeRoleMutation.mutate(
      { userId: changeRoleUser.id, role: changeRoleValue },
      { onSuccess: () => setChangeRoleOpen(false) }
    )
  }

  const handleToggleStatus = () => {
    if (!activeMenuUser) return
    const newStatus = activeMenuUser.status === 'active' ? 'deactivated' : 'active'
    toggleStatusMutation.mutate({ userId: activeMenuUser.id, status: newStatus })
    handleMenuClose()
  }

  const handleRemoveStaff = () => {
    if (!activeMenuUser) return
    setConfirmTitle('Remove staff member')
    setConfirmMessage(`Are you sure you want to remove ${activeMenuUser.first_name || activeMenuUser.email} from the organisation?`)
    setConfirmAction(() => () => {
      removeStaffMutation.mutate(activeMenuUser.id)
      setConfirmOpen(false)
    })
    setConfirmOpen(true)
    handleMenuClose()
  }

  const handleCancelInvitation = () => {
    if (!activeMenuUser) return
    setConfirmTitle('Cancel invitation')
    setConfirmMessage(`Are you sure you want to cancel the invitation for ${activeMenuUser.email}?`)
    setConfirmAction(() => () => {
      cancelInviteMutation.mutate(activeMenuUser.id)
      setConfirmOpen(false)
    })
    setConfirmOpen(true)
    handleMenuClose()
  }

  const handleResendInvitation = () => {
    if (!activeMenuUser) return
    resendMutation.mutate(activeMenuUser.id)
    handleMenuClose()
  }

  const handleForcePasswordReset = () => {
    if (!activeMenuUser) return
    forcePasswordResetMutation.mutate(activeMenuUser.id)
    handleMenuClose()
  }

  const handleResetMfa = () => {
    if (!activeMenuUser) return
    setConfirmTitle('Reset MFA')
    setConfirmMessage(`Are you sure you want to reset MFA for ${activeMenuUser.first_name || activeMenuUser.email}? They will need to set up MFA again on next login.`)
    setConfirmAction(() => () => {
      resetMfaMutation.mutate(activeMenuUser.id)
      setConfirmOpen(false)
    })
    setConfirmOpen(true)
    handleMenuClose()
  }

  const isAdminOrManager = currentUserRole === UserRole.ORG_ADMIN || currentUserRole === UserRole.MANAGER

  const totalStaff = admins.length + staff.length
  const activeCount = allMembers.filter((m: any) => m.status === 'active' && m._type !== 'invitation').length
  const pendingInvites = invitations.length
  const careWorkerCount = allMembers.filter((m: any) => m.role === 'CARE_WORKER' && m._type !== 'invitation').length

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
      {/* ── Header ── */}
      <PageHeader
        title="Staff directory"
        subtitle={`${totalStaff} team members${pendingInvites > 0 ? ` · ${pendingInvites} pending invitation${pendingInvites === 1 ? '' : 's'}` : ''}`}
        actions={
          <>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={employmentFilter}
                onChange={(e) => setEmploymentFilter(e.target.value)}
                displayEmpty
                sx={{ borderRadius: '12px' }}
              >
                {EMPLOYMENT_TYPE_OPTIONS.map(opt => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              variant="outlined"
              size="small"
              sx={{ width: 250, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} /></InputAdornment>,
              }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddDialogOpen(true)}
              sx={{ textTransform: 'none', borderRadius: '12px', fontWeight: 600, px: 2.5, py: 1, bgcolor: '#1A2332', '&:hover': { bgcolor: '#263347' } }}
            >
              Add staff member
            </Button>
          </>
        }
      />

      {successAlert && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: '12px' }} onClose={() => setSuccessAlert('')}>{successAlert}</Alert>
      )}

      {/* ── Stats row ── */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <PremiumCard noBorder sx={{ p: 2.5, flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: '#E7EEF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GroupIcon sx={{ fontSize: 20, color: '#0F4C81' }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>{totalStaff}</Typography>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>Team members</Typography>
          </Box>
        </PremiumCard>
        <PremiumCard noBorder sx={{ p: 2.5, flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: '#E9F7F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PersonIcon sx={{ fontSize: 20, color: '#047857' }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>{activeCount}</Typography>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>Active</Typography>
          </Box>
        </PremiumCard>
        <PremiumCard noBorder sx={{ p: 2.5, flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: '#E9F7F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PeopleIcon sx={{ fontSize: 20, color: '#047857' }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>{careWorkerCount}</Typography>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>Care workers</Typography>
          </Box>
        </PremiumCard>
        <PremiumCard noBorder sx={{ p: 2.5, flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: pendingInvites > 0 ? '#FFF5D9' : '#E9F7F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MailIcon sx={{ fontSize: 20, color: pendingInvites > 0 ? '#D97706' : '#047857' }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>{pendingInvites}</Typography>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>Pending invites</Typography>
          </Box>
        </PremiumCard>
      </Stack>

      {/* ── Table ── */}
      <PremiumCard noBorder>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>Member</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>Employment</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>Role</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>Compliance</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6, borderBottom: 'none' }}>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>Loading staff...</Typography>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ borderBottom: 'none' }}>
                    <EmptyState
                      title={search || employmentFilter ? 'No matches found' : 'No team members yet'}
                      description={search || employmentFilter ? 'Try adjusting your search or filters' : 'Invite your first team member to get started'}
                      variant={search || employmentFilter ? 'search' : 'default'}
                      action={!search && !employmentFilter ? { label: 'Invite staff member', onClick: () => setAddDialogOpen(true) } : undefined}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((m: any) => {
                  const isAdmin = m._type === 'admin'
                  const isInvitation = m._type === 'invitation'
                  const staffHasCompliance = typeof m.compliance_rate === 'number'
                  return (
                    <TableRow
                      key={`${m._type}-${m.id}`}
                      sx={{
                        cursor: !isInvitation ? 'pointer' : 'default',
                        '&:hover': !isInvitation ? { bgcolor: theme.palette.mode === 'dark' ? '#1E293B' : '#F8FAFC' } : {},
                        '&:last-child td': { borderBottom: 'none' },
                      }}
                      onClick={() => {
                        if (!isInvitation) navigate(`/staff/${m.id}`)
                      }}
                    >
                      <TableCell sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <Avatar sx={{
                            width: 36, height: 36,
                            bgcolor: isInvitation ? '#E5E7EB' : ROLE_BG_COLOR[m.role] || '#E7EEF4',
                            fontSize: 14, fontWeight: 800,
                            color: isInvitation ? '#9CA3AF' : ROLE_ICON_COLOR[m.role] || '#1A2332',
                          }}>
                            {isInvitation ? '—' : `${(m.first_name || '?')[0]}${(m.last_name || '') ? (m.last_name)[0] : ''}`.toUpperCase()}
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                              {isInvitation ? 'Pending invitation' : `${m.first_name || ''} ${m.last_name || ''}`.trim() || '—'}
                            </Typography>
                            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
                              {m.email}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                        {isInvitation || !m.employment_type ? (
                          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>—</Typography>
                        ) : (
                          <DesignStatusBadge variant="pending" label={EMPLOYMENT_TYPE_LABEL[m.employment_type] || m.employment_type} />
                        )}
                      </TableCell>
                      <TableCell sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                        <DesignStatusBadge
                          variant={m.role === 'MANAGER' ? 'scheduled' : m.role === 'CARE_WORKER' ? 'completed' : m.role === 'COMPLIANCE_OFFICER' ? 'in-progress' : 'pending'}
                          label={ROLE_LABEL[m.role] || m.role || '—'}
                        />
                      </TableCell>
                      <TableCell sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                        {isInvitation ? (
                          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>—</Typography>
                        ) : staffHasCompliance ? (
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Box sx={{
                              width: 40, height: 4, borderRadius: 2,
                              bgcolor: theme.palette.mode === 'dark' ? '#334155' : '#F1F5F9',
                              position: 'relative', overflow: 'hidden',
                            }}>
                              <Box sx={{
                                position: 'absolute', left: 0, top: 0, bottom: 0,
                                width: `${m.compliance_rate}%`,
                                borderRadius: 2,
                                bgcolor: m.compliance_rate >= 80 ? '#10B981' : m.compliance_rate >= 50 ? '#D97706' : '#DC2626',
                              }} />
                            </Box>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: theme.palette.text.secondary }}>
                              {m.compliance_rate}%
                            </Typography>
                          </Stack>
                        ) : (
                          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>—</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                        <DesignStatusBadge
                          variant={STATUS_VARIANT[m.status] || 'pending'}
                          label={isInvitation ? 'Pending' : (STATUS_LABEL[m.status] || m.status || '—')}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                        {isAdmin && currentUserRole !== UserRole.ORG_ADMIN ? null : (
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleMenuOpen(e, m) }}
                            sx={{ color: theme.palette.text.secondary, '&:hover': { bgcolor: theme.palette.mode === 'dark' ? '#334155' : '#F1F5F9' } }}>
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
            {filtered.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TablePagination
                    count={filtered.length}
                    page={page}
                    rowsPerPage={rowsPerPage}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    rowsPerPageOptions={[5, 10, 25, 50]}
                  />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </TableContainer>
      </PremiumCard>

      {/* ── Action menu ── */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{ sx: { borderRadius: '14px', boxShadow: theme.palette.mode === 'dark' ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(26,35,50,0.08)', mt: 1, minWidth: 180 } }}
      >
        {activeMenuUser?._type === 'invitation' ? (
          [
            <MenuItem key="resend" onClick={handleResendInvitation} sx={{ borderRadius: '8px', mx: 0.5, mb: 0.5 }}>
              <ListItemIcon><RefreshIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} /></ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}>Send Reminder</ListItemText>
            </MenuItem>,
            <MenuItem key="cancel" onClick={handleCancelInvitation} sx={{ borderRadius: '8px', mx: 0.5, mb: 0.5, color: '#DC2626' }}>
              <ListItemIcon><DeleteIcon fontSize="small" sx={{ color: '#DC2626' }} /></ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}>Cancel Invitation</ListItemText>
            </MenuItem>,
          ]
        ) : activeMenuUser?._type === 'staff' || activeMenuUser?._type === 'admin' ? (
          [
            <MenuItem key="edit" onClick={handleEditProfile} sx={{ borderRadius: '8px', mx: 0.5, mb: 0.5 }}>
              <ListItemIcon><EditIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} /></ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}>Edit Profile</ListItemText>
            </MenuItem>,
            currentUserRole === UserRole.ORG_ADMIN && activeMenuUser?.id !== currentUserId && (
              <MenuItem key="role" onClick={handleChangeRoleOpen} sx={{ borderRadius: '8px', mx: 0.5, mb: 0.5 }}>
                <ListItemIcon><PersonAddIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} /></ListItemIcon>
                <ListItemText primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}>Change Role</ListItemText>
              </MenuItem>
            ),
            activeMenuUser?.id !== currentUserId && (
              <MenuItem key="toggle" onClick={handleToggleStatus} sx={{ borderRadius: '8px', mx: 0.5, mb: 0.5 }}>
                <ListItemIcon>
                  {activeMenuUser?.status === 'active' ? <BlockIcon fontSize="small" sx={{ color: '#DC2626' }} /> : <CheckCircleIcon fontSize="small" sx={{ color: '#047857' }} />}
                </ListItemIcon>
                <ListItemText primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  {activeMenuUser?.status === 'active' ? 'Deactivate' : 'Activate'}
                </ListItemText>
              </MenuItem>
            ),
            currentUserRole === UserRole.ORG_ADMIN && activeMenuUser?.id !== currentUserId && activeMenuUser?.status !== 'deactivated' && (
              <MenuItem key="remove" onClick={handleRemoveStaff} sx={{ borderRadius: '8px', mx: 0.5, mb: 0.5, color: '#DC2626' }}>
                <ListItemIcon><DeleteIcon fontSize="small" sx={{ color: '#DC2626' }} /></ListItemIcon>
                <ListItemText primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}>Remove from Org</ListItemText>
              </MenuItem>
            ),
            activeMenuUser?.id !== currentUserId && isAdminOrManager && (
              <MenuItem key="resetpwd" onClick={handleForcePasswordReset} sx={{ borderRadius: '8px', mx: 0.5, mb: 0.5 }}>
                <ListItemIcon><ResetPwdIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} /></ListItemIcon>
                <ListItemText primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}>Reset Password</ListItemText>
              </MenuItem>
            ),
            activeMenuUser?.id !== currentUserId && isAdminOrManager && (
              <MenuItem key="resetmfa" onClick={handleResetMfa} sx={{ borderRadius: '8px', mx: 0.5, mb: 0.5 }}>
                <ListItemIcon><SecurityIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} /></ListItemIcon>
                <ListItemText primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}>Reset MFA</ListItemText>
              </MenuItem>
            ),
          ].filter(Boolean)
        ) : null}
      </Menu>

      {/* ── Add staff dialog ── */}
      <Dialog open={addDialogOpen} onClose={() => { setAddDialogOpen(false); setAddDialogError(''); }} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '18px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.2rem' }}>Add team members</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {addDialogError && <Alert severity="warning" onClose={() => setAddDialogError('')} sx={{ borderRadius: '12px' }}>{addDialogError}</Alert>}
            <Stack direction="row" spacing={1} alignItems="flex-end">
              <TextField
                label="Email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                size="small"
                sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddEntry() }}
              />
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Role</InputLabel>
                <Select
                  value={inviteRole}
                  label="Role"
                  onChange={(e) => setInviteRole(e.target.value)}
                  sx={{ borderRadius: '12px' }}
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Location</InputLabel>
                <Select value={inviteLocationId} label="Location" onChange={(e) => setInviteLocationId(e.target.value)} sx={{ borderRadius: '12px' }}>
                  <MenuItem value=""><em>None</em></MenuItem>
                  {locationList.map((l: any) => (<MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>))}
                </Select>
              </FormControl>
              <Button variant="contained" onClick={handleAddEntry} sx={{ textTransform: 'none', borderRadius: '10px', bgcolor: '#1A2332', '&:hover': { bgcolor: '#263347' }, minWidth: 64, py: 1.05 }}>Add</Button>
            </Stack>

            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              hidden
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              sx={{ textTransform: 'none', borderRadius: '12px', borderColor: theme.palette.divider, color: theme.palette.text.primary, fontWeight: 600, '&:hover': { borderColor: theme.palette.text.secondary } }}
            >
              {uploading ? 'Parsing...' : 'Upload Excel / CSV'}
            </Button>
            <Button
              variant="text"
              size="small"
              href="/templates/staff-invite-template.csv"
              target="_blank"
              sx={{ textTransform: 'none', color: '#0F4C81', fontWeight: 600, alignSelf: 'flex-start' }}
            >
              Download Template
            </Button>

            {inviteEntries.length > 0 && (
              <Box sx={{ p: 1.5, maxHeight: 200, overflow: 'auto', borderRadius: '12px', bgcolor: theme.palette.mode === 'dark' ? '#1E293B' : '#F8FAFC', border: `1px solid ${theme.palette.divider}` }}>
                <Stack spacing={0.5}>
                  {inviteEntries.map((entry) => (
                    <Stack key={entry.email} direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1, py: 0.5, borderRadius: '8px', '&:hover': { bgcolor: theme.palette.mode === 'dark' ? '#334155' : '#EFF6FF' } }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{entry.email}</Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          label={ROLE_BADGE[entry.role] || entry.role}
                          size="small"
                          sx={{ height: 20, fontSize: '0.7rem', bgcolor: '#E7EEF4', color: '#0F4C81', fontWeight: 700 }}
                        />
                        {entry.location_id && (() => {
                          const loc = locationList.find((l: any) => l.id === entry.location_id)
                          return loc ? <Chip label={loc.name} size="small" sx={{ height: 20, fontSize: '0.7rem', color: theme.palette.text.secondary, bgcolor: theme.palette.mode === 'dark' ? '#334155' : '#F3F4F6', fontWeight: 600 }} /> : null
                        })()}
                        <IconButton size="small" onClick={() => handleRemoveEntry(entry.email)} sx={{ color: theme.palette.text.secondary, '&:hover': { color: '#DC2626' } }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => { setAddDialogOpen(false); setInviteEntries([]) }} sx={{ textTransform: 'none', borderRadius: '10px', color: theme.palette.text.secondary }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSendInvitations}
            disabled={inviteEntries.length === 0 || inviteMutation.isPending}
            sx={{ textTransform: 'none', borderRadius: '10px', bgcolor: '#1A2332', '&:hover': { bgcolor: '#263347' } }}
          >
            {inviteMutation.isPending ? 'Sending...' : `Send Invitations (${inviteEntries.length})`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Change role dialog ── */}
      <Dialog open={changeRoleOpen} onClose={() => setChangeRoleOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '18px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.1rem' }}>Change role</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel>Role</InputLabel>
            <Select
              value={changeRoleValue}
              label="Role"
              onChange={(e) => setChangeRoleValue(e.target.value)}
              sx={{ borderRadius: '12px' }}
            >
              {ROLE_OPTIONS.filter(o => !o.adminOnly || currentUserRole === 'ORG_ADMIN').map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setChangeRoleOpen(false)} sx={{ textTransform: 'none', borderRadius: '10px', color: theme.palette.text.secondary }}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveRole} disabled={changeRoleMutation.isPending}
            sx={{ textTransform: 'none', borderRadius: '10px', bgcolor: '#1A2332', '&:hover': { bgcolor: '#263347' } }}>
            {changeRoleMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Confirm dialog ── */}
      <ConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        onConfirm={confirmAction}
        onCancel={() => setConfirmOpen(false)}
      />
    </Box>
  )
}
