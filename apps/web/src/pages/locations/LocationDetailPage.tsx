import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Typography, Paper, Stack, Chip, CircularProgress,
  Button, Grid, Alert, Tabs, Tab, Divider, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, FormControl, InputLabel,
  Select, MenuItem, IconButton, TablePagination,
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon, Business as BuildingIcon,
  WarningAmber as WarningAmberIcon, Add as AddIcon, Edit as EditIcon,
  Delete as DeleteIcon, Badge as BadgeIcon, Verified as VerifiedIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { LoadingState, StatusBadge, NAVY } from '../../components/ui'

type BadgeTone = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary' | 'purple'

const ROLE_LABEL: Record<string, string> = {
  ORG_ADMIN: 'Org Admin',
  MANAGER: 'Manager',
  CARE_WORKER: 'Care Worker',
  COMPLIANCE_OFFICER: 'Compliance Officer',
}

const ROLE_TONE: Record<string, BadgeTone> = {
  ORG_ADMIN: 'primary',
  MANAGER: 'info',
  CARE_WORKER: 'neutral',
  COMPLIANCE_OFFICER: 'purple',
}

const EMPLOYMENT_LABEL: Record<string, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  agency: 'Agency',
  bank: 'Bank',
  relief: 'Relief',
}

const TAB_OVERVIEW = 'overview'
const TAB_STAFF = 'staff'
const TAB_CERTIFICATES = 'certificates'

const EMPTY_CERT_FORM = { name: '', certificate_type: 'gas_safety', issuing_body: '', certificate_number: '', issue_date: '', expiry_date: '', status: 'valid', notes: '' }

export default function LocationDetailPage() {
  const { locationId } = useParams<{ locationId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState(TAB_OVERVIEW)
  const [certDialogOpen, setCertDialogOpen] = useState(false)
  const [editCert, setEditCert] = useState<any>(null)
  const [certForm, setCertForm] = useState<any>(EMPTY_CERT_FORM)
  const [certError, setCertError] = useState('')
  const [staffPage, setStaffPage] = useState(0)

  const userStr = localStorage.getItem('user')
  let currentUser: any = {}
  try { currentUser = userStr ? JSON.parse(userStr) : {} } catch { currentUser = {} }
  const isOrgAdmin = currentUser.role === 'ORG_ADMIN'
  const isManager = currentUser.role === 'MANAGER'
  const canEdit = isOrgAdmin || isManager

  const { data: locations, isLoading: locationsLoading } = useQuery({
    queryKey: ['settings-locations'],
    queryFn: async () => {
      const res = await api.get('/settings/locations')
      return res.data as any[]
    },
  })
  const location = locations?.find((l: any) => l.id === locationId)

  const { data: staff, isLoading: staffLoading } = useQuery({
    queryKey: ['settings-staff'],
    queryFn: async () => {
      const res = await api.get('/settings/staff')
      return res.data as any[]
    },
  })
  const locationStaff = (staff || []).filter((s: any) => s.location_id === locationId)

  const { data: certificates, isLoading: certsLoading } = useQuery({
    queryKey: ['location-certificates', locationId],
    queryFn: async () => {
      const res = await api.get(`/settings/locations/${locationId}/certificates`)
      return res.data as any[]
    },
    enabled: !!locationId,
  })

  const certMutation = useMutation({
    mutationFn: async () => {
      if (editCert) {
        await api.put(`/settings/locations/${locationId}/certificates/${editCert.id}`, certForm)
      } else {
        await api.post(`/settings/locations/${locationId}/certificates`, certForm)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-certificates'] })
      setCertDialogOpen(false)
      setCertError('')
    },
    onError: (err: any) => {
      setCertError(err.response?.data?.message || err.message || 'Failed to save certificate')
    },
  })

  const deleteCertMutation = useMutation({
    mutationFn: async (certId: string) => {
      await api.delete(`/settings/locations/${locationId}/certificates/${certId}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['location-certificates'] }),
  })

  const openAddCert = () => {
    setEditCert(null)
    setCertForm(EMPTY_CERT_FORM)
    setCertError('')
    setCertDialogOpen(true)
  }

  const openEditCert = (cert: any) => {
    setEditCert(cert)
    setCertForm({
      name: cert.name,
      certificate_type: cert.certificate_type,
      issuing_body: cert.issuing_body || '',
      certificate_number: cert.certificate_number || '',
      issue_date: cert.issue_date || '',
      expiry_date: cert.expiry_date || '',
      status: cert.status,
      notes: cert.notes || '',
    })
    setCertError('')
    setCertDialogOpen(true)
  }

  const loading = locationsLoading

  if (loading) {
    return <LoadingState label="Loading location..." />
  }

  if (!location) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/settings')} sx={{ mb: 2, color: NAVY, fontWeight: 700 }}>Back to Settings</Button>
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 2 }}>
          <Typography color="#9CA3AF">Location not found.</Typography>
        </Paper>
      </Box>
    )
  }

  const staffCount = locationStaff.length
  const noManager = !location.manager_id

  const staffingRows = [
    { label: 'Minimum staff / day', value: location.minimum_staff_per_day ?? '—' },
    { label: 'Min day staff', value: location.min_day_staff ?? '—' },
    { label: 'Min night staff', value: location.min_night_staff ?? '—' },
    { label: 'Min sleep staff', value: location.min_sleep_staff ?? '—' },
  ]

  const tabs = [
    { id: TAB_OVERVIEW, label: 'Overview', icon: <BuildingIcon /> },
    { id: TAB_STAFF, label: 'Staff', icon: <BadgeIcon /> },
    { id: TAB_CERTIFICATES, label: 'Certificates', icon: <VerifiedIcon /> },
  ]

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/settings')} sx={{ mb: 2.5, color: NAVY, fontWeight: 700 }}>
        Back to Settings
      </Button>

      <Paper sx={{ borderRadius: 2, overflow: 'hidden', mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ p: 3.5, alignItems: { xs: 'flex-start', sm: 'center' } }}>
          <Box sx={{ width: 72, height: 72, borderRadius: 2, bgcolor: '#0F4C8110', color: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BuildingIcon sx={{ fontSize: 36 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: NAVY, textTransform: 'uppercase', mb: 0.5 }}>
              Location
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }} sx={{ mb: 0.5 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                {location.name}
              </Typography>
              {noManager && <StatusBadge label="No manager" tone="warning" />}
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
              {location.manager_first_name ? (
                <Chip label={`Manager: ${location.manager_first_name} ${location.manager_last_name}`} size="small" variant="outlined" sx={{ height: 22, fontSize: 12 }} />
              ) : (
                <Chip label="No manager assigned" size="small" variant="outlined" sx={{ height: 22, fontSize: 12, color: '#B45309', borderColor: '#F59E0B' }} />
              )}
              <Chip label={`${staffCount} staff`} size="small" variant="outlined" sx={{ height: 22, fontSize: 12 }} />
            </Stack>
          </Box>
          {canEdit && (
            <Box sx={{ flexShrink: 0 }}>
                <Button variant="outlined" startIcon={<EditIcon />} onClick={() => navigate('/settings?tab=locations')}>
                Edit location
              </Button>
            </Box>
          )}
        </Stack>
        <Divider sx={{ borderColor: '#F1F5F9' }} />
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ p: 2 }}>
          <Box sx={{ flex: 1, px: { sm: 2 }, py: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 900, color: NAVY, lineHeight: 1.1 }}>{staffCount}</Typography>
            <Typography variant="caption" color="text.secondary">Staff assigned</Typography>
          </Box>
          <Box sx={{ flex: 1, px: { sm: 2 }, py: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 900, color: NAVY, lineHeight: 1.1 }}>{certificates?.length ?? 0}</Typography>
            <Typography variant="caption" color="text.secondary">Certificates</Typography>
          </Box>
          <Box sx={{ flex: 1, px: { sm: 2 }, py: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 900, color: noManager ? '#D97706' : '#16A34A', lineHeight: 1.1 }}>
              {noManager ? '—' : 'Assigned'}
            </Typography>
            <Typography variant="caption" color="text.secondary">Manager</Typography>
          </Box>
        </Stack>
      </Paper>

      <Paper sx={{ borderRadius: 2, overflow: 'hidden', mb: 3 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          TabIndicatorProps={{ sx: { bgcolor: NAVY, height: 3 } }}
        >
          {tabs.map(t => (
            <Tab key={t.id} value={t.id} label={t.label} icon={t.icon} iconPosition="start" sx={{ fontWeight: 700, textTransform: 'none', color: 'text.secondary', '&.Mui-selected': { color: NAVY } }} />
          ))}
        </Tabs>
      </Paper>

      {noManager && tab === TAB_OVERVIEW && (
        <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 3 }}>
          This location has no manager assigned. Every location should have a MANAGER so cover, leave approvals and medication escalations are reviewed. Org admins are notified automatically.
        </Alert>
      )}

      {tab === TAB_OVERVIEW && (
        <Paper sx={{ p: 3.5, borderRadius: 2 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: NAVY, textTransform: 'uppercase', mb: 2.5 }}>
            Location details
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">Address</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{location.address || '—'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">Manager</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, color: noManager ? '#B45309' : 'inherit' }}>
                {location.manager_first_name ? `${location.manager_first_name} ${location.manager_last_name}` : 'No manager assigned'}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">Manager email</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{location.manager_email || '—'}</Typography>
            </Grid>
            {staffingRows.map(row => (
              <Grid item xs={12} sm={6} md={3} key={row.label}>
                <Typography variant="caption" color="text.secondary">{row.label}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.value}</Typography>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {tab === TAB_STAFF && (
        <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
          {staffLoading ? (
            <Box sx={{ p: 6, textAlign: 'center' }}><CircularProgress /></Box>
          ) : locationStaff.length === 0 ? (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <Typography color="#9CA3AF">No staff assigned to this location yet.</Typography>
              <Button variant="outlined" sx={{ mt: 2, color: NAVY, borderColor: NAVY }} onClick={() => navigate('/staff')}>
                Go to Staff Directory
              </Button>
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Employment</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Contracted Hours</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {locationStaff.slice(staffPage * 10, staffPage * 10 + 10).map(s => (
                      <TableRow key={s.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/staff/${s.id}`)}>
                        <TableCell sx={{ fontWeight: 600 }}>{[s.first_name, s.last_name].filter(Boolean).join(' ') || s.email}</TableCell>
                        <TableCell>{s.email}</TableCell>
                        <TableCell><StatusBadge label={ROLE_LABEL[s.role] || s.role || '—'} tone={ROLE_TONE[s.role] || 'neutral'} /></TableCell>
                        <TableCell>{EMPLOYMENT_LABEL[s.employment_type] || s.employment_type || '—'}</TableCell>
                        <TableCell>{s.contracted_hours_weekly ? `${s.contracted_hours_weekly}h` : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {locationStaff.length > 10 && (
                <TablePagination component="div" count={locationStaff.length} page={staffPage} onPageChange={(_, p) => setStaffPage(p)}
                  rowsPerPage={10} rowsPerPageOptions={[10]} />
              )}
            </>
          )}
        </Paper>
      )}

      {tab === TAB_CERTIFICATES && (
        <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2.5, pb: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Location Certificates</Typography>
            {canEdit && (
              <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openAddCert} sx={{ bgcolor: NAVY, '&:hover': { bgcolor: '#0A3A5C' } }}>
                Add Certificate
              </Button>
            )}
          </Stack>
          {certsLoading ? (
            <Box sx={{ p: 6, textAlign: 'center' }}><CircularProgress /></Box>
          ) : !certificates || certificates.length === 0 ? (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <Typography color="#9CA3AF">No certificates for this location</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Issuing Body</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Certificate #</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Expiry Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    {canEdit && <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {certificates.map(cert => {
                    const expired = cert.expiry_date && new Date(cert.expiry_date) < new Date()
                    const expiringSoon = cert.expiry_date && new Date(cert.expiry_date) < new Date(Date.now() + 30 * 86400000)
                    return (
                      <TableRow key={cert.id} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{cert.name}</TableCell>
                        <TableCell>{cert.certificate_type}</TableCell>
                        <TableCell>{cert.issuing_body || '—'}</TableCell>
                        <TableCell>{cert.certificate_number || '—'}</TableCell>
                        <TableCell sx={{ color: expired ? '#DC2626' : expiringSoon ? '#D97706' : 'inherit', fontWeight: expired ? 700 : 400 }}>
                          {cert.expiry_date || '—'}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={cert.status.replace('_', ' ')}
                            size="small"
                            color={cert.status === 'valid' ? 'success' : cert.status === 'expiring_soon' ? 'warning' : cert.status === 'expired' ? 'error' : 'default'}
                          />
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <IconButton size="small" onClick={() => openEditCert(cert)}><EditIcon fontSize="small" /></IconButton>
                            <IconButton size="small" color="error" onClick={() => deleteCertMutation.mutate(cert.id)}><DeleteIcon fontSize="small" /></IconButton>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      <Dialog open={certDialogOpen} onClose={() => setCertDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{editCert ? 'Edit Certificate' : 'Add Certificate'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {certError && <Alert severity="error">{certError}</Alert>}
            <Stack direction="row" spacing={2}>
              <TextField label="Name" size="small" fullWidth value={certForm.name} onChange={e => setCertForm((p: any) => ({ ...p, name: e.target.value }))} />
              <TextField label="Type" size="small" fullWidth value={certForm.certificate_type} onChange={e => setCertForm((p: any) => ({ ...p, certificate_type: e.target.value }))} placeholder="e.g. gas_safety, food_hygiene" />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField label="Issuing Body" size="small" fullWidth value={certForm.issuing_body} onChange={e => setCertForm((p: any) => ({ ...p, issuing_body: e.target.value }))} />
              <TextField label="Certificate #" size="small" fullWidth value={certForm.certificate_number} onChange={e => setCertForm((p: any) => ({ ...p, certificate_number: e.target.value }))} />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField label="Issue Date" type="date" size="small" fullWidth value={certForm.issue_date} onChange={e => setCertForm((p: any) => ({ ...p, issue_date: e.target.value }))} InputLabelProps={{ shrink: true }} />
              <TextField label="Expiry Date" type="date" size="small" fullWidth value={certForm.expiry_date} onChange={e => setCertForm((p: any) => ({ ...p, expiry_date: e.target.value }))} InputLabelProps={{ shrink: true }} />
            </Stack>
            <Stack direction="row" spacing={2} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Status</InputLabel>
                <Select value={certForm.status} label="Status" onChange={e => setCertForm((p: any) => ({ ...p, status: e.target.value }))}>
                  <MenuItem value="valid">Valid</MenuItem>
                  <MenuItem value="expiring_soon">Expiring Soon</MenuItem>
                  <MenuItem value="expired">Expired</MenuItem>
                  <MenuItem value="pending_renewal">Pending Renewal</MenuItem>
                </Select>
              </FormControl>
              <TextField label="Notes" size="small" fullWidth value={certForm.notes} onChange={e => setCertForm((p: any) => ({ ...p, notes: e.target.value }))} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setCertDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => certMutation.mutate()} disabled={!certForm.name} sx={{ bgcolor: NAVY, '&:hover': { bgcolor: '#0A3A5C' } }}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
