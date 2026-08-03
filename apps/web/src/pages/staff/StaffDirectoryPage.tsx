import { useState, useRef, useEffect } from 'react'
import {
  Box, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Button,
  Chip, Stack, IconButton, Alert, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Menu, MenuItem, ListItemIcon, ListItemText,
  FormControl, InputLabel, Select, InputAdornment,
  TablePagination, TableFooter
} from '@mui/material'
import {
  Add as AddIcon, MoreVert as MoreVertIcon,
  Refresh as RefreshIcon, Delete as DeleteIcon,
  Edit as EditIcon, PersonAdd as PersonAddIcon,
  Block as BlockIcon, CheckCircle as CheckCircleIcon,
  CloudUpload as UploadIcon, LockReset as ResetPwdIcon,
  Security as SecurityIcon
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { UserRole } from '@meticle/shared'
import * as XLSX from 'xlsx'
import api from '../../services/api'
import posthog from '../../lib/posthog'

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
  COMPLIANCE_OFFICER: 'Compliance',
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

const EMPLOYMENT_TYPE_COLOR: Record<string, 'default' | 'primary' | 'secondary' | 'info' | 'warning'> = {
  full_time: 'default',
  part_time: 'primary',
  agency: 'secondary',
  bank: 'info',
  relief: 'warning',
}

const STATUS_CONFIG: Record<string, { label: string; color: 'success' | 'default' | 'error' | 'warning'; variant?: 'outlined' | 'filled' }> = {
  active: { label: 'Active', color: 'success' },
  inactive: { label: 'Inactive', color: 'default' },
  deactivated: { label: 'Deactivated', color: 'error' },
  pending: { label: 'Pending', color: 'warning', variant: 'outlined' },
}

const isValidEmail = (e: string) => /^\S+@\S+\.\S+$/.test(e.trim())

function ConfirmDialog({ open, title, message, onConfirm, onCancel }: {
  open: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent><Typography>{message}</Typography></DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button onClick={onConfirm} color="error" variant="contained">Confirm</Button>
      </DialogActions>
    </Dialog>
  )
}

export default function StaffDirectoryPage() {
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
      // file parse error - silently ignored
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSendInvitations = async () => {
    let successfulInvitations = 0
    for (const entry of inviteEntries) {
      try {
        await inviteMutation.mutateAsync(entry)
        successfulInvitations += 1
      } catch {
        // continue with remaining
      }
    }
    if (successfulInvitations > 0) {
      posthog.capture('staff_invitations_sent', {
        invitation_count: successfulInvitations,
      })
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
    setConfirmTitle('Remove Staff Member')
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
    setConfirmTitle('Cancel Invitation')
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

  const roleChip = (role: string, isInvitation: boolean) => {
    const label = ROLE_LABEL[role] || role || '—'
    return (
      <Chip
        label={label}
        size="small"
        color={isInvitation ? 'warning' : 'default'}
        variant={isInvitation ? 'outlined' : 'filled'}
      />
    )
  }

  const statusChip = (status: string, isInvitation: boolean) => {
    const key = isInvitation ? 'pending' : status
    const cfg = STATUS_CONFIG[key] || STATUS_CONFIG.inactive
    return (
      <Chip
        label={cfg.label}
        color={cfg.color}
        size="small"
        variant={isInvitation ? 'outlined' : cfg.variant || 'filled'}
      />
    )
  }

  const isAdminOrManager = currentUserRole === UserRole.ORG_ADMIN || currentUserRole === UserRole.MANAGER

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h4">Staff Directory</Typography>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <Select
              value={employmentFilter}
              onChange={(e) => setEmploymentFilter(e.target.value)}
              displayEmpty
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
            sx={{ width: 250 }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><RefreshIcon fontSize="small" sx={{ opacity: 0.4 }} /></InputAdornment>,
            }}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddDialogOpen(true)}
          >
            Add Staff Member
          </Button>
        </Stack>
      </Stack>

      {successAlert && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessAlert('')}>{successAlert}</Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Employment Type</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Compliance</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>No members found.</TableCell>
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
                      bgcolor: isAdmin ? 'rgba(15,76,129,0.04)' : 'inherit',
                      cursor: !isInvitation ? 'pointer' : 'default',
                      '&:hover': !isInvitation ? { bgcolor: 'rgba(15,76,129,0.02)' } : {},
                    }}
                    onClick={() => {
                      if (!isInvitation) navigate(`/staff/${m.id}`)
                    }}
                  >
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography variant="body2">
                          {isInvitation ? '—' : `${m.first_name || ''} ${m.last_name || ''}`}
                        </Typography>
                        {isAdmin && (
                          <Chip
                            label="Admin"
                            size="small"
                            sx={{ bgcolor: '#0F4C81', color: 'white', fontSize: '0.65rem', height: 20 }}
                          />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>{m.email || '—'}</TableCell>
                    <TableCell>
                      {isInvitation || !m.employment_type ? (
                        <Typography variant="caption" color="#9CA3AF">—</Typography>
                      ) : (
                        <Chip
                          label={EMPLOYMENT_TYPE_LABEL[m.employment_type] || m.employment_type}
                          size="small"
                          color={EMPLOYMENT_TYPE_COLOR[m.employment_type] || 'default'}
                          variant="outlined"
                        />
                      )}
                    </TableCell>
                    <TableCell>{roleChip(m.role, isInvitation)}</TableCell>
                    <TableCell>
                      {isInvitation ? (
                        '—'
                      ) : staffHasCompliance ? (
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Box sx={{
                            width: 40, height: 4, borderRadius: 2,
                            bgcolor: m.compliance_rate >= 80 ? '#16A34A' : m.compliance_rate >= 50 ? '#D97706' : '#DC2626',
                          }} />
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#6B7280' }}>
                            {m.compliance_rate}%
                          </Typography>
                        </Stack>
                      ) : (
                        <Typography variant="caption" color="#9CA3AF">—</Typography>
                      )}
                    </TableCell>
                    <TableCell>{statusChip(m.status, isInvitation)}</TableCell>
                    <TableCell align="right">
                      {isAdmin && currentUserRole !== UserRole.ORG_ADMIN ? null : (
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleMenuOpen(e, m) }}>
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
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
      </TableContainer>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {activeMenuUser?._type === 'invitation' ? (
          [
            <MenuItem key="resend" onClick={handleResendInvitation}>
              <ListItemIcon><RefreshIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Send Reminder</ListItemText>
            </MenuItem>,
            <MenuItem key="cancel" onClick={handleCancelInvitation}>
              <ListItemIcon><DeleteIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Cancel Invitation</ListItemText>
            </MenuItem>,
          ]
        ) : activeMenuUser?._type === 'staff' || activeMenuUser?._type === 'admin' ? (
          [
            <MenuItem key="edit" onClick={handleEditProfile}>
              <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Edit Profile</ListItemText>
            </MenuItem>,
            currentUserRole === UserRole.ORG_ADMIN && activeMenuUser?.id !== currentUserId && (
              <MenuItem key="role" onClick={handleChangeRoleOpen}>
                <ListItemIcon><PersonAddIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Change Role</ListItemText>
              </MenuItem>
            ),
            activeMenuUser?.id !== currentUserId && (
              <MenuItem key="toggle" onClick={handleToggleStatus}>
                <ListItemIcon>
                  {activeMenuUser?.status === 'active' ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                </ListItemIcon>
                <ListItemText>
                  {activeMenuUser?.status === 'active' ? 'Deactivate' : 'Activate'}
                </ListItemText>
              </MenuItem>
            ),
            currentUserRole === UserRole.ORG_ADMIN && activeMenuUser?.id !== currentUserId && activeMenuUser?.status !== 'deactivated' && (
              <MenuItem key="remove" onClick={handleRemoveStaff}>
                <ListItemIcon><DeleteIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Remove from Org</ListItemText>
              </MenuItem>
            ),
            activeMenuUser?.id !== currentUserId && isAdminOrManager && (
              <MenuItem key="resetpwd" onClick={handleForcePasswordReset}>
                <ListItemIcon><ResetPwdIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Reset Password</ListItemText>
              </MenuItem>
            ),
            activeMenuUser?.id !== currentUserId && isAdminOrManager && (
              <MenuItem key="resetmfa" onClick={handleResetMfa}>
                <ListItemIcon><SecurityIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Reset MFA</ListItemText>
              </MenuItem>
            ),
          ].filter(Boolean)
        ) : null}
      </Menu>

      <Dialog open={addDialogOpen} onClose={() => { setAddDialogOpen(false); setAddDialogError(''); }} maxWidth="sm" fullWidth>
        <DialogTitle>Add Team Members</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {addDialogError && <Alert severity="warning" onClose={() => setAddDialogError('')}>{addDialogError}</Alert>}
            <Stack direction="row" spacing={1} alignItems="flex-end">
              <TextField
                label="Email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                size="small"
                sx={{ flex: 1 }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddEntry() }}
              />
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Role</InputLabel>
                <Select
                  value={inviteRole}
                  label="Role"
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Location</InputLabel>
                <Select value={inviteLocationId} label="Location" onChange={(e) => setInviteLocationId(e.target.value)}>
                  <MenuItem value=""><em>None</em></MenuItem>
                  {locationList.map((l: any) => (<MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>))}
                </Select>
              </FormControl>
              <Button variant="outlined" onClick={handleAddEntry}>Add</Button>
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
            >
              {uploading ? 'Parsing...' : 'Upload Excel / CSV'}
            </Button>
            <Button
              variant="text"
              size="small"
              href="/templates/staff-invite-template.csv"
              target="_blank"
              sx={{ textTransform: 'none', color: '#0F4C81' }}
            >
              Download Template
            </Button>

            {inviteEntries.length > 0 && (
              <Paper variant="outlined" sx={{ p: 1.5, maxHeight: 200, overflow: 'auto' }}>
                <Stack spacing={0.5}>
                  {inviteEntries.map((entry) => (
                    <Stack key={entry.email} direction="row" alignItems="center" justifyContent="space-between">
                      <Typography variant="body2">{entry.email}</Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          label={ROLE_BADGE[entry.role] || entry.role}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                        {entry.location_id && (() => {
                          const loc = locationList.find((l: any) => l.id === entry.location_id)
                          return loc ? <Chip label={loc.name} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem', color: '#6B7280' }} /> : null
                        })()}
                        <IconButton size="small" onClick={() => handleRemoveEntry(entry.email)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAddDialogOpen(false); setInviteEntries([]) }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSendInvitations}
            disabled={inviteEntries.length === 0 || inviteMutation.isPending}
          >
            {inviteMutation.isPending ? 'Sending...' : `Send Invitations (${inviteEntries.length})`}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={changeRoleOpen} onClose={() => setChangeRoleOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Change Role</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel>Role</InputLabel>
              <Select
                  value={changeRoleValue}
                  label="Role"
                  onChange={(e) => setChangeRoleValue(e.target.value)}
                >
                  {ROLE_OPTIONS.filter(o => !o.adminOnly || currentUserRole === 'ORG_ADMIN').map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChangeRoleOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveRole} disabled={changeRoleMutation.isPending}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

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
