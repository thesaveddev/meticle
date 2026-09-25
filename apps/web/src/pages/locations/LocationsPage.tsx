import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Paper, Stack, Button, Alert, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControl, InputLabel, Select, MenuItem, TablePagination,
  CircularProgress, Chip,
} from '@mui/material'
import PageContainer from '../../components/design/PageContainer'
import {
  Business as BuildingIcon, Add as AddIcon, Edit as EditIcon,
  Delete as DeleteIcon, Warning as WarningIcon,
} from '@mui/icons-material'
import api from '../../services/api'
import { NAVY, ConfirmDialog } from '../../components/ui'
import { EmptyState } from '../../components/design/EmptyState'

const SERVICE_TYPE_LABEL: Record<string, string> = {
  supported_living: 'Supported Living',
  residential: 'Residential',
  domiciliary: 'Domiciliary',
}

const money = (pence: unknown) => pence == null || pence === '' ? '—' : `£${(Number(pence) / 100).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const EMPTY_LOC = {
  name: '', address: '', latitude: '', longitude: '', manager_id: '', minimum_staff_per_day: 1,
  min_day_staff: '', min_night_staff: '', min_sleep_staff: '', max_staff_on_leave: '',
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
  const [orgServiceTypes, setOrgServiceTypes] = useState<string[]>([])
  const [areaComparison, setAreaComparison] = useState<any[]>([])
  const [comparisonLoading, setComparisonLoading] = useState(false)
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
      setError(err.response?.data?.message || (isDomiciliary ? 'Failed to load areas' : 'Failed to load locations'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    api.get('/settings/org').then(res => {
      const types = Array.isArray(res.data?.service_types) ? res.data.service_types : []
      const primary = res.data?.primary_service_type
      setOrgServiceTypes(primary ? [primary] : types)
    }).catch(() => {})
  }, [])

  const isDomiciliary = orgServiceTypes.some(type => ['domiciliary', 'live_in'].includes(type))

  useEffect(() => {
    if (!isDomiciliary) return
    setComparisonLoading(true)
    api.get('/settings/locations/area-comparison')
      .then(res => setAreaComparison(Array.isArray(res.data) ? res.data : []))
      .catch(() => setAreaComparison([]))
      .finally(() => setComparisonLoading(false))
  }, [isDomiciliary])

  const openAdd = () => {
    setEditLoc({ ...EMPTY_LOC, ...(isDomiciliary ? { service_type: 'domiciliary' } : {}) })
    setError('')
    setLocDialog(true)
  }

  const openEdit = (loc: any) => {
    setEditLoc({
      ...EMPTY_LOC,
      id: loc.id, name: loc.name, address: loc.address || '', latitude: loc.latitude ?? '', longitude: loc.longitude ?? '',
      manager_id: loc.manager_id || '', minimum_staff_per_day: loc.minimum_staff_per_day ?? 1,
      min_day_staff: loc.min_day_staff ?? '', min_night_staff: loc.min_night_staff ?? '', min_sleep_staff: loc.min_sleep_staff ?? '',
      max_staff_on_leave: loc.max_staff_on_leave ?? '',
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
      payload.max_staff_on_leave = payload.max_staff_on_leave === '' ? null : Number(payload.max_staff_on_leave)
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
      setError(err.response?.data?.message || (isDomiciliary ? 'Failed to save area' : 'Failed to save location'))
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
      setError(err.response?.data?.message || (isDomiciliary ? 'Failed to delete area' : 'Failed to delete location'))
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const noManagerCount = locations.filter(l => !l.manager_id).length

  return (
    <PageContainer>

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}><BuildingIcon sx={{ mr: 1, verticalAlign: 'middle', color: NAVY }} />{isDomiciliary ? 'Areas' : 'Locations'}</Typography>
        {isOrgAdmin && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}
            sx={{ bgcolor: NAVY, '&:hover': { bgcolor: '#0A3A5C' } }}>{isDomiciliary ? 'Add area' : 'Add location'}</Button>
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {noManagerCount > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }} icon={<WarningIcon />}>
          {noManagerCount} {isDomiciliary ? `area${noManagerCount !== 1 ? 's' : ''}` : `location${noManagerCount !== 1 ? 's' : ''}`} {noManagerCount !== 1 ? 'have' : 'has'} no {isDomiciliary ? 'area manager' : 'manager'} assigned. Every {isDomiciliary ? 'area' : 'location'} should have a MANAGER so cover, leave approvals and escalations are reviewed. Org admins are notified automatically.
        </Alert>
      )}

      {isDomiciliary && <Paper sx={{ p: { xs: 2, md: 3 }, mb: 2, borderRadius: 2, border: '1px solid', borderColor: 'grey.200' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1} sx={{ mb: 2 }}>
          <Box><Typography variant="h6" sx={{ fontWeight: 800 }}>Area comparison</Typography><Typography variant="body2" color="text.secondary">Compare demand, cover and indicative margin across Cardiff, Cathays and every other service area.</Typography></Box>
          <Chip size="small" label="Manager view · live aggregates" variant="outlined" />
        </Stack>
        {comparisonLoading ? <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress size={24} /></Box> : areaComparison.length === 0 ? <Typography variant="body2" color="text.secondary">No domiciliary areas have been configured yet.</Typography> : <TableContainer sx={{ overflowX: 'auto' }}><Table size="small" sx={{ minWidth: 980 }}>
          <TableHead><TableRow>{['Area','Clients','Carers','Capacity','7-day workload','Missed · 30d','Open calls','Coverage','Est. margin'].map(label => <TableCell key={label} sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>{label}</TableCell>)}</TableRow></TableHead>
          <TableBody>{areaComparison.map(area => <TableRow key={area.area_id} hover>
            <TableCell><Typography variant="body2" sx={{ fontWeight: 800 }}>{area.area_name}</Typography><Typography variant="caption" color="text.secondary">{area.visits_today ?? 0} visits today</Typography></TableCell>
            <TableCell>{area.active_clients}</TableCell><TableCell>{area.active_carers}</TableCell><TableCell><Typography sx={{ fontWeight: 700 }}>{area.available_carers}</Typography><Typography variant="caption" color="text.secondary">available today</Typography></TableCell>
            <TableCell>{area.workload_hours_next_7_days}h</TableCell><TableCell>{area.missed_visits_30_days}</TableCell><TableCell>{area.open_calls}</TableCell>
            <TableCell>{area.open_call_coverage_percent == null ? '—' : `${area.open_call_coverage_percent}%`}</TableCell>
            <TableCell><Typography sx={{ fontWeight: 800, color: Number(area.estimated_margin_pence) >= 0 ? 'success.main' : 'error.main' }}>{money(area.estimated_margin_pence)}</Typography><Typography variant="caption" color="text.secondary">indicative this month</Typography></TableCell>
          </TableRow>)}</TableBody>
        </Table></TableContainer>}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>Capacity is active carers minus carers with a scheduled visit today. Margin is an indicative scheduled-care estimate using configured package rates; confirm against approved billing and payroll before relying on it.</Typography>
      </Paper>}

      <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ p: 8, textAlign: 'center' }}><CircularProgress /></Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>{isDomiciliary ? 'Area' : 'Name'}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{isDomiciliary ? 'Active carers' : 'Address'}</TableCell>
                  {isDomiciliary ? <TableCell sx={{ fontWeight: 700 }}>Active clients</TableCell> : <>
                    <TableCell sx={{ fontWeight: 700 }}>Service Type</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Capacity</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Min Staff/Day</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Max Off/Leave</TableCell>
                  </>}
                  {!isDomiciliary && <TableCell sx={{ fontWeight: 700 }}>Manager</TableCell>}
                  {isDomiciliary && <TableCell sx={{ fontWeight: 700 }}>Area manager</TableCell>}
                  {isOrgAdmin && <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {locations.length === 0 ? (
                  <TableRow><TableCell colSpan={isDomiciliary ? (isOrgAdmin ? 5 : 4) : (isOrgAdmin ? 8 : 7)} sx={{ borderBottom: 'none' }}><EmptyState title={isDomiciliary ? 'No areas yet' : 'No locations yet'} description={isDomiciliary ? 'Create your first service area — for example Cardiff or Cathays' : 'Create your first location to get started'} variant="default" action={{ label: isDomiciliary ? 'Add area' : 'Add location', onClick: openAdd }} /></TableCell></TableRow>
                ) : locations.slice(locPage * rowsPerPage, locPage * rowsPerPage + rowsPerPage).map(loc => (
                  <TableRow key={loc.id} hover sx={{
                    cursor: 'pointer',
                    bgcolor: !loc.manager_id ? 'rgba(217, 119, 6, 0.06)' : 'inherit',
                    '&:hover': { bgcolor: !loc.manager_id ? 'rgba(217, 119, 6, 0.12)' : 'action.hover' },
                  }} onClick={() => navigate(`/locations/${loc.id}`)}>
                    <TableCell sx={{ fontWeight: 600 }}>{loc.name}</TableCell>
                    {isDomiciliary ? <>
                      <TableCell>{loc.carer_count ?? 0}</TableCell>
                      <TableCell>{loc.client_count ?? 0}</TableCell>
                    </> : <>
                      <TableCell>{loc.address || '—'}</TableCell>
                      <TableCell>{loc.service_type ? SERVICE_TYPE_LABEL[loc.service_type] || loc.service_type : '—'}</TableCell>
                      <TableCell>{loc.service_capacity ?? '—'}</TableCell>
                      <TableCell>{loc.minimum_staff_per_day ?? 1}</TableCell>
                      <TableCell>{loc.max_staff_on_leave ?? '—'}</TableCell>
                    </>}
                    <TableCell>
                      {loc.manager_first_name ? `${loc.manager_first_name} ${loc.manager_last_name}` : (
                        <Chip label={isDomiciliary ? 'No area manager' : 'No manager'} size="small" sx={{ bgcolor: 'warning.light', color: '#B45309', fontWeight: 700, fontSize: 12, height: 22 }} />
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
        <DialogTitle sx={{ fontWeight: 700 }}>{isDomiciliary ? (editLoc.id ? 'Edit area' : 'Add area') : (editLoc.id ? 'Edit Location' : 'Add Location')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Name" fullWidth size="small" value={editLoc.name} onChange={e => setEditLoc((p: any) => ({ ...p, name: e.target.value }))} />
            <TextField label="Address" fullWidth size="small" value={editLoc.address || ''} onChange={e => setEditLoc((p: any) => ({ ...p, address: e.target.value }))} />
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField label="Latitude" type="number" size="small" sx={{ flex: 1 }} value={editLoc.latitude ?? ''}
                onChange={e => setEditLoc((p: any) => ({ ...p, latitude: e.target.value }))} />
              <TextField label="Longitude" type="number" size="small" sx={{ flex: 1 }} value={editLoc.longitude ?? ''}
                onChange={e => setEditLoc((p: any) => ({ ...p, longitude: e.target.value }))} />
              <Button variant="outlined" size="small" onClick={async () => {
                if (!editLoc.address) return
                try {
                  const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(editLoc.address)}&format=json&limit=1&countrycodes=gb`, { headers: { 'User-Agent': 'MeticleCare/1.0' } })
                  const data = await res.json()
                  if (data.length > 0) {
                    setEditLoc((p: any) => ({ ...p, latitude: data[0].lat, longitude: data[0].lon }))
                  }
                } catch {}
              }} sx={{ whiteSpace: 'nowrap', textTransform: 'none' }}>Auto-locate</Button>
            </Stack>
            {isDomiciliary ? (
              <Alert severity="info">This organisation uses areas rather than residential locations. Carers and clients are counted against each area.</Alert>
            ) : (
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
            )}
            <Stack direction="row" spacing={2}>
              <TextField label="Phone" fullWidth size="small" value={editLoc.phone || ''} onChange={e => setEditLoc((p: any) => ({ ...p, phone: e.target.value }))} />
              <TextField label="Email" fullWidth size="small" value={editLoc.email || ''} onChange={e => setEditLoc((p: any) => ({ ...p, email: e.target.value }))} />
            </Stack>
            {!isDomiciliary && <>
              <TextField label="Minimum Staff Required Per Day" type="number" fullWidth size="small"
                value={editLoc.minimum_staff_per_day ?? 1}
                onChange={e => setEditLoc((p: any) => ({ ...p, minimum_staff_per_day: Number(e.target.value) }))}
                helperText="Minimum safe staffing level for this location each day" />
              <TextField label="Max Staff On Leave At Once" type="number" inputProps={{ min: 0 }} fullWidth size="small"
                value={editLoc.max_staff_on_leave ?? ''}
                onChange={e => setEditLoc((p: any) => ({ ...p, max_staff_on_leave: e.target.value }))}
                helperText="Maximum number of staff from this location allowed on leave at the same time. Leave blank for no limit." />
              <Stack direction="row" spacing={2}>
                <TextField label="Min Day Staff" type="number" fullWidth size="small" value={editLoc.min_day_staff ?? ''} onChange={e => setEditLoc((p: any) => ({ ...p, min_day_staff: e.target.value }))} />
                <TextField label="Min Night Staff" type="number" fullWidth size="small" value={editLoc.min_night_staff ?? ''} onChange={e => setEditLoc((p: any) => ({ ...p, min_night_staff: e.target.value }))} />
                <TextField label="Min Sleep Staff" type="number" fullWidth size="small" value={editLoc.min_sleep_staff ?? ''} onChange={e => setEditLoc((p: any) => ({ ...p, min_sleep_staff: e.target.value }))} />
              </Stack>
            </>}
            <FormControl size="small" fullWidth>
              <InputLabel>{isDomiciliary ? 'Area manager' : 'Manager'}</InputLabel>
              <Select label={isDomiciliary ? 'Area manager' : 'Manager'} value={editLoc.manager_id || ''} onChange={e => setEditLoc((p: any) => ({ ...p, manager_id: e.target.value }))}>
                <MenuItem value=""><em>None</em></MenuItem>
                {staffList.map(s => (
                  <MenuItem key={s.id} value={s.id}>{s.first_name} {s.last_name}{s.role ? ` (${s.role})` : ''}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {!isDomiciliary && <>
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
            </>}
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
            {upgradeDialog.name} needs to be a MANAGER to be {isDomiciliary ? 'an area manager' : 'a location manager'}. Upgrade their role now?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUpgradeDialog({ open: false, userId: '', name: '' })}>Cancel</Button>
          <Button variant="contained" onClick={upgradeToManager} sx={{ bgcolor: NAVY }}>Upgrade to Manager</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title={isDomiciliary ? 'Delete area?' : 'Delete location?'}
        message={isDomiciliary
          ? `Delete "${deleteTarget?.name}"? This removes the area permanently. This cannot be undone.`
          : `Delete "${deleteTarget?.name}"? This removes the location and its certificates permanently. This cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
        onCancel={() => { if (!deleting) setDeleteTarget(null) }}
        onConfirm={() => deleteTarget && deleteLocation(deleteTarget.id)}
      />
    </PageContainer>
  )
}
