import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Paper, Stack, Button, Alert, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControl, InputLabel, Select, MenuItem, TablePagination,
  CircularProgress, Chip,
} from '@mui/material'
import {
  Business as BuildingIcon, Add as AddIcon, Edit as EditIcon,
  Delete as DeleteIcon, Warning as WarningIcon,
} from '@mui/icons-material'
import api from '../../services/api'
import { NAVY, ConfirmDialog } from '../../components/ui'

const SERVICE_TYPE_LABEL: Record<string, string> = {
  supported_living: 'Supported Living',
  residential: 'Residential',
  domiciliary: 'Domiciliary',
}

const EMPTY_LOC = {
  name: '', address: '', manager_id: '', minimum_staff_per_day: 1,
  min_day_staff: '', min_night_staff: '', min_sleep_staff: '',
  service_type: '', service_capacity: '', phone: '', email: '',
  food_hygiene_rating: '', cqc_rating: '', last_cqc_inspection: '',
}

export default function LocationsPage() {
  const navigate = useNavigate()
  const [locations, setLocations] = useState<any[]>([])
  const [staffList, setStaffList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [locDialog, setLocDialog] = useState(false)
  const [editLoc, setEditLoc] = useState<any>(EMPTY_LOC)
  const [upgradeDialog, setUpgradeDialog] = useState<{ open: boolean; userId: string; name: string }>({ open: false, userId: '', name: '' })
  const [locPage, setLocPage] = useState(0)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  const rowsPerPage = 10

  const userStr = localStorage.getItem('user')
  let currentUser: any = {}
  try { currentUser = userStr ? JSON.parse(userStr) : {} } catch { currentUser = {} }
  const isOrgAdmin = currentUser.role === 'ORG_ADMIN'

  const load = async () => {
    setLoading(true)
    try {
      const [locRes, staffRes] = await Promise.all([api.get('/settings/locations'), api.get('/settings/staff')])
      setLocations(locRes.data)
      setStaffList(staffRes.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load locations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setEditLoc({ ...EMPTY_LOC })
    setError('')
    setLocDialog(true)
  }

  const openEdit = (loc: any) => {
    setEditLoc({
      ...EMPTY_LOC,
      id: loc.id, name: loc.name, address: loc.address || '',
      manager_id: loc.manager_id || '', minimum_staff_per_day: loc.minimum_staff_per_day ?? 1,
      min_day_staff: loc.min_day_staff ?? '', min_night_staff: loc.min_night_staff ?? '', min_sleep_staff: loc.min_sleep_staff ?? '',
      service_type: loc.service_type || '', service_capacity: loc.service_capacity ?? '',
      phone: loc.phone || '', email: loc.email || '', food_hygiene_rating: loc.food_hygiene_rating ?? '',
      cqc_rating: loc.cqc_rating || '', last_cqc_inspection: loc.last_cqc_inspection || '',
    })
    setError('')
    setLocDialog(true)
  }

  const saveLocation = async () => {
    setSaving(true)
    try {
      const payload: any = { ...editLoc }
      const nullify = (v: any) => (v === '' || v === null || v === undefined ? null : v)
      payload.manager_id = nullify(payload.manager_id)
      payload.min_day_staff = nullify(payload.min_day_staff)
      payload.min_night_staff = nullify(payload.min_night_staff)
      payload.min_sleep_staff = nullify(payload.min_sleep_staff)
      payload.service_type = nullify(payload.service_type)
      payload.service_capacity = payload.service_capacity === '' ? null : Number(payload.service_capacity)
      payload.phone = nullify(payload.phone)
      payload.email = nullify(payload.email)
      payload.food_hygiene_rating = payload.food_hygiene_rating === '' ? null : Number(payload.food_hygiene_rating)
      payload.cqc_rating = nullify(payload.cqc_rating)
      payload.last_cqc_inspection = nullify(payload.last_cqc_inspection)
      delete payload.id
      if (editLoc.id) {
        await api.put(`/settings/locations/${editLoc.id}`, payload)
      } else {
        await api.post('/settings/locations', payload)
      }
      setLocDialog(false)
      setEditLoc(EMPTY_LOC)
      const res = await api.get('/settings/locations')
      setLocations(res.data)
    } catch (err: any) {
      if (err.response?.status === 400 && err.response?.data?.message?.includes('manager')) {
        setUpgradeDialog({ open: true, userId: editLoc.manager_id, name: staffList.find(s => s.id === editLoc.manager_id)?.first_name || '' })
      }
      setError(err.response?.data?.message || 'Failed to save location')
    } finally {
      setSaving(false)
    }
  }

  const upgradeToManager = async () => {
    try {
      await api.patch(`/staff/${upgradeDialog.userId}/role`, { role: 'MANAGER' })
      setUpgradeDialog({ open: false, userId: '', name: '' })
      saveLocation()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upgrade role')
    }
  }

  const deleteLocation = async (id: string) => {
    setDeleting(true)
    try {
      await api.delete(`/settings/locations/${id}`)
      setLocations(prev => prev.filter(l => l.id !== id))
      setDeleteTarget(null)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete location')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const noManagerCount = locations.filter(l => !l.manager_id).length

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}><BuildingIcon sx={{ mr: 1, verticalAlign: 'middle', color: NAVY }} />Locations</Typography>
        {isOrgAdmin && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}
            sx={{ bgcolor: NAVY, '&:hover': { bgcolor: '#0A3A5C' } }}>Add Location</Button>
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {noManagerCount > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }} icon={<WarningIcon />}>
          {noManagerCount} location{noManagerCount !== 1 ? 's' : ''} {noManagerCount !== 1 ? 'have' : 'has'} no manager assigned. Every location should have a MANAGER so cover, leave approvals and medication escalations are reviewed. Org admins are notified automatically.
        </Alert>
      )}

      <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ p: 8, textAlign: 'center' }}><CircularProgress /></Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Address</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Service Type</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Capacity</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Min Staff/Day</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Manager</TableCell>
                  {isOrgAdmin && <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {locations.length === 0 ? (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 3, color: '#9CA3AF' }}>No locations created yet</TableCell></TableRow>
                ) : locations.slice(locPage * rowsPerPage, locPage * rowsPerPage + rowsPerPage).map(loc => (
                  <TableRow key={loc.id} hover sx={{
                    cursor: 'pointer',
                    bgcolor: !loc.manager_id ? 'rgba(217, 119, 6, 0.06)' : 'inherit',
                    '&:hover': { bgcolor: !loc.manager_id ? 'rgba(217, 119, 6, 0.12)' : 'action.hover' },
                  }} onClick={() => navigate(`/locations/${loc.id}`)}>
                    <TableCell sx={{ fontWeight: 600 }}>{loc.name}</TableCell>
                    <TableCell>{loc.address || '—'}</TableCell>
                    <TableCell>{loc.service_type ? SERVICE_TYPE_LABEL[loc.service_type] || loc.service_type : '—'}</TableCell>
                    <TableCell>{loc.service_capacity ?? '—'}</TableCell>
                    <TableCell>{loc.minimum_staff_per_day ?? 1}</TableCell>
                    <TableCell>
                      {loc.manager_first_name ? `${loc.manager_first_name} ${loc.manager_last_name}` : (
                        <Chip label="No manager" size="small" sx={{ bgcolor: '#FEF3C7', color: '#B45309', fontWeight: 700, fontSize: 12, height: 22 }} />
                      )}
                    </TableCell>
                    {isOrgAdmin && (
                      <TableCell>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEdit(loc) }}><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); setDeleteTarget(loc) }}><DeleteIcon fontSize="small" /></IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {locations.length > rowsPerPage && (
          <TablePagination component="div" count={locations.length} page={locPage} onPageChange={(_, p) => setLocPage(p)}
            rowsPerPage={rowsPerPage} rowsPerPageOptions={[rowsPerPage]} />
        )}
      </Paper>

      <Dialog open={locDialog} onClose={() => setLocDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{editLoc.id ? 'Edit Location' : 'Add Location'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Name" fullWidth size="small" value={editLoc.name} onChange={e => setEditLoc((p: any) => ({ ...p, name: e.target.value }))} />
            <TextField label="Address" fullWidth size="small" value={editLoc.address || ''} onChange={e => setEditLoc((p: any) => ({ ...p, address: e.target.value }))} />
            <Stack direction="row" spacing={2}>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Service Type</InputLabel>
                <Select label="Service Type" value={editLoc.service_type || ''} onChange={e => setEditLoc((p: any) => ({ ...p, service_type: e.target.value }))}>
                  <MenuItem value=""><em>None</em></MenuItem>
                  <MenuItem value="supported_living">Supported Living</MenuItem>
                  <MenuItem value="residential">Residential</MenuItem>
                  <MenuItem value="domiciliary">Domiciliary</MenuItem>
                </Select>
              </FormControl>
              <TextField label="Service Capacity" type="number" fullWidth size="small" value={editLoc.service_capacity ?? ''}
                onChange={e => setEditLoc((p: any) => ({ ...p, service_capacity: e.target.value }))} />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField label="Phone" fullWidth size="small" value={editLoc.phone || ''} onChange={e => setEditLoc((p: any) => ({ ...p, phone: e.target.value }))} />
              <TextField label="Email" fullWidth size="small" value={editLoc.email || ''} onChange={e => setEditLoc((p: any) => ({ ...p, email: e.target.value }))} />
            </Stack>
            <TextField label="Minimum Staff Required Per Day" type="number" fullWidth size="small"
              value={editLoc.minimum_staff_per_day ?? 1}
              onChange={e => setEditLoc((p: any) => ({ ...p, minimum_staff_per_day: Number(e.target.value) }))}
              helperText="Minimum safe staffing level for this location each day" />
            <Stack direction="row" spacing={2}>
              <TextField label="Min Day Staff" type="number" fullWidth size="small" value={editLoc.min_day_staff ?? ''} onChange={e => setEditLoc((p: any) => ({ ...p, min_day_staff: e.target.value }))} />
              <TextField label="Min Night Staff" type="number" fullWidth size="small" value={editLoc.min_night_staff ?? ''} onChange={e => setEditLoc((p: any) => ({ ...p, min_night_staff: e.target.value }))} />
              <TextField label="Min Sleep Staff" type="number" fullWidth size="small" value={editLoc.min_sleep_staff ?? ''} onChange={e => setEditLoc((p: any) => ({ ...p, min_sleep_staff: e.target.value }))} />
            </Stack>
            <FormControl size="small" fullWidth>
              <InputLabel>Manager</InputLabel>
              <Select label="Manager" value={editLoc.manager_id || ''} onChange={e => setEditLoc((p: any) => ({ ...p, manager_id: e.target.value }))}>
                <MenuItem value=""><em>None</em></MenuItem>
                {staffList.map(s => (
                  <MenuItem key={s.id} value={s.id}>{s.first_name} {s.last_name}{s.role ? ` (${s.role})` : ''}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack direction="row" spacing={2}>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>CQC Rating</InputLabel>
                <Select label="CQC Rating" value={editLoc.cqc_rating || ''} onChange={e => setEditLoc((p: any) => ({ ...p, cqc_rating: e.target.value }))}>
                  <MenuItem value=""><em>None</em></MenuItem>
                  <MenuItem value="outstanding">Outstanding</MenuItem>
                  <MenuItem value="good">Good</MenuItem>
                  <MenuItem value="requires_improvement">Requires Improvement</MenuItem>
                  <MenuItem value="inadequate">Inadequate</MenuItem>
                </Select>
              </FormControl>
              <TextField label="Food Hygiene Rating (0-5)" type="number" inputProps={{ min: 0, max: 5 }} fullWidth size="small"
                value={editLoc.food_hygiene_rating ?? ''} onChange={e => setEditLoc((p: any) => ({ ...p, food_hygiene_rating: e.target.value }))} />
            </Stack>
            <TextField label="Last CQC Inspection" type="date" size="small" fullWidth value={editLoc.last_cqc_inspection || ''}
              onChange={e => setEditLoc((p: any) => ({ ...p, last_cqc_inspection: e.target.value }))} InputLabelProps={{ shrink: true }} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setLocDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveLocation} disabled={!editLoc.name || saving}
            sx={{ bgcolor: NAVY, '&:hover': { bgcolor: '#0A3A5C' } }}>{saving ? <CircularProgress size={20} /> : 'Save'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={upgradeDialog.open} onClose={() => setUpgradeDialog({ open: false, userId: '', name: '' })} maxWidth="xs" fullWidth>
        <DialogTitle>Upgrade to Manager?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="#6B7280">
            {upgradeDialog.name} needs to be a MANAGER to be a location manager. Upgrade their role now?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUpgradeDialog({ open: false, userId: '', name: '' })}>Cancel</Button>
          <Button variant="contained" onClick={upgradeToManager} sx={{ bgcolor: NAVY }}>Upgrade to Manager</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete location?"
        message={`Delete "${deleteTarget?.name}"? This removes the location and its certificates permanently. This cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
        onCancel={() => { if (!deleting) setDeleteTarget(null) }}
        onConfirm={() => deleteTarget && deleteLocation(deleteTarget.id)}
      />
    </Box>
  )
}
