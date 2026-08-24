import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton,
  Stack, Alert, CircularProgress, Tooltip, Chip, Tabs, Tab, Paper, Select, MenuItem, FormControl, InputLabel, Grid, Card, CardContent,
  ToggleButton, ToggleButtonGroup
} from '@mui/material'
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Business as BusinessIcon,
  People as PeopleIcon, AttachMoney as MoneyIcon, History as HistoryIcon,
  Analytics as AnalyticsIcon, CheckCircle, Cancel,
  Star as StarIcon
} from '@mui/icons-material'
import api from '../../services/api'

const rowsPerPage = 10

export default function AgenciesPage() {
  const [tab, setTab] = useState(0)

  // ── Shared ──
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [page, setPage] = useState(0)

  // ── Agencies ──
  const [agencies, setAgencies] = useState<any[]>([])
  const [agenciesLoading, setAgenciesLoading] = useState(true)
  const [agencyDialog, setAgencyDialog] = useState(false)
  const [editAgency, setEditAgency] = useState<any>({ name: '', contact_name: '', contact_phone: '', contact_email: '', address: '', notes: '', status: 'active', contract_start_date: '', contract_end_date: '' })
  const [agencySaving, setAgencySaving] = useState(false)
  const [agencyActionLoading, setAgencyActionLoading] = useState('')
  const [selectedAgency, setSelectedAgency] = useState<any>(null)
  const [agencyView, setAgencyView] = useState<'overview' | 'workers' | 'rates'>('overview')

  // ── Workers ──
  const [workers, setWorkers] = useState<any[]>([])
  const [workersLoading, setWorkersLoading] = useState(true)
  const [workerDialog, setWorkerDialog] = useState(false)
  const [editWorker, setEditWorker] = useState<any>({ agency_id: '', first_name: '', last_name: '', role: '', phone: '', email: '', dbs_check_date: '', dbs_expiry_date: '', mandatory_training_completed: false, status: 'active', rating: '', notes: '' })
  const [workerSaving, setWorkerSaving] = useState(false)
  const [workerActionLoading, setWorkerActionLoading] = useState('')

  // ── Rates ──
  const [rates, setRates] = useState<any[]>([])
  const [ratesLoading, setRatesLoading] = useState(true)
  const [rateDialog, setRateDialog] = useState(false)
  const [editRate, setEditRate] = useState<any>({ agency_id: '', shift_type: 'day', rate_per_hour: '', effective_from: '', effective_to: '' })
  const [rateSaving, setRateSaving] = useState(false)
  const [rateActionLoading, setRateActionLoading] = useState('')

  // ── Shift History ──
  const [history, setHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyFilters, setHistoryFilters] = useState({ agency_id: '', status: '', date_from: '', date_to: '' })
  const [updatingCoverage, setUpdatingCoverage] = useState<string | null>(null)

  // ── Analytics ──
  const [savings, setSavings] = useState<any>(null)
  const [savingsByMonth, setSavingsByMonth] = useState<any[]>([])
  const [savingsByAgency, setSavingsByAgency] = useState<any[]>([])
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const selectedAgencyWorkers = workers.filter(w => w.agency_id === selectedAgency?.id)
  const selectedAgencyRates = rates.filter(r => r.agency_id === selectedAgency?.id)

  const openAgency = async (agency: any) => {
    setSelectedAgency(agency)
    setAgencyView('overview')
    try {
      const [detail, agencyWorkers, agencyRates] = await Promise.all([api.get(`/agencies/${agency.id}`), api.get(`/agencies/${agency.id}/workers`), api.get(`/agencies/${agency.id}/rates`)])
      setSelectedAgency({ ...agency, ...detail.data })
      setWorkers(prev => [...prev.filter(w => w.agency_id !== agency.id), ...agencyWorkers.data])
      setRates(prev => [...prev.filter(r => r.agency_id !== agency.id), ...agencyRates.data])
    } catch { setError('Could not load the agency workspace') }
  }

  const fetchAgencies = useCallback(async () => {
    try { setAgenciesLoading(true); const r = await api.get('/agencies'); setAgencies(r.data) } catch { } finally { setAgenciesLoading(false) }
  }, [])

  const fetchWorkers = useCallback(async () => {
    try { setWorkersLoading(true); const r = await api.get('/agencies/all-workers'); setWorkers(r.data) } catch { } finally { setWorkersLoading(false) }
  }, [])

  const fetchRates = useCallback(async () => {
    try { setRatesLoading(true); const r = await api.get('/agencies/rates'); setRates(r.data) } catch { } finally { setRatesLoading(false) }
  }, [])

  const fetchHistory = useCallback(async () => {
    try {
      setHistoryLoading(true)
      const params = new URLSearchParams()
      if (historyFilters.agency_id) params.set('agency_id', historyFilters.agency_id)
      if (historyFilters.status) params.set('status', historyFilters.status)
      if (historyFilters.date_from) params.set('date_from', historyFilters.date_from)
      if (historyFilters.date_to) params.set('date_to', historyFilters.date_to)
      const r = await api.get(`/agencies/shift-history?${params}`)
      setHistory(r.data)
    } catch { } finally { setHistoryLoading(false) }
  }, [historyFilters])

  const handleToggleCoverage = async (shiftId: string, currentlyCovered: boolean) => {
    try {
      setUpdatingCoverage(shiftId)
      await api.patch(`/shifts/${shiftId}/agency-coverage`, { covered: !currentlyCovered })
      fetchHistory()
    } catch { } finally { setUpdatingCoverage(null) }
  }

  const fetchAnalytics = useCallback(async () => {
    try {
      setAnalyticsLoading(true)
      const [s, m, a] = await Promise.all([
        api.get('/agencies/savings'),
        api.get('/agencies/savings-by-month?months=6'),
        api.get('/agencies/savings-by-agency'),
      ])
      setSavings(s.data)
      setSavingsByMonth(m.data)
      setSavingsByAgency(a.data)
    } catch { } finally { setAnalyticsLoading(false) }
  }, [])

  useEffect(() => { fetchAgencies() }, [fetchAgencies])
  useEffect(() => { if (tab === 1) fetchWorkers() }, [tab, fetchWorkers])
  useEffect(() => { if (tab === 2) fetchRates() }, [tab, fetchRates])
  useEffect(() => { if (tab === 3) fetchHistory() }, [tab, fetchHistory])
  useEffect(() => { if (tab === 4) fetchAnalytics() }, [tab, fetchAnalytics])

  // ── Agency CRUD ──
  const handleSaveAgency = async () => {
    if (!editAgency.name?.trim()) { setError('Agency name is required'); return }
    try {
      setAgencySaving(true)
      if (editAgency.id) { await api.patch(`/agencies/${editAgency.id}`, editAgency) } else { await api.post('/agencies', editAgency) }
      setAgencyDialog(false); setEditAgency({ name: '', contact_name: '', contact_phone: '', contact_email: '', address: '', notes: '', status: 'active', contract_start_date: '', contract_end_date: '' })
      setSuccess(editAgency.id ? 'Agency updated' : 'Agency created'); await fetchAgencies()
    } catch (err: any) { setError(err.response?.data?.message || 'Failed to save agency') } finally { setAgencySaving(false) }
  }

  const handleDeleteAgency = async (id: string) => {
    try { setAgencyActionLoading(id); await api.delete(`/agencies/${id}`); setAgencies(prev => prev.filter(a => a.id !== id)); setSuccess('Agency deleted') }
    catch (err: any) { setError(err.response?.data?.message || 'Failed to delete') } finally { setAgencyActionLoading('') }
  }

  // ── Worker CRUD ──
  const handleSaveWorker = async () => {
    if (!editWorker.agency_id || !editWorker.first_name?.trim() || !editWorker.last_name?.trim()) { setError('Agency, first name, and last name are required'); return }
    try {
      setWorkerSaving(true)
      if (editWorker.id) { await api.patch(`/agencies/workers/${editWorker.id}`, editWorker) } else { await api.post('/agencies/workers', editWorker) }
      setWorkerDialog(false); setEditWorker({ agency_id: '', first_name: '', last_name: '', role: '', phone: '', email: '', dbs_check_date: '', dbs_expiry_date: '', mandatory_training_completed: false, status: 'active', rating: '', notes: '' })
      setSuccess(editWorker.id ? 'Worker updated' : 'Worker created'); await fetchWorkers()
    } catch (err: any) { setError(err.response?.data?.message || 'Failed to save worker') } finally { setWorkerSaving(false) }
  }

  const handleDeleteWorker = async (id: string) => {
    try { setWorkerActionLoading(id); await api.delete(`/agencies/workers/${id}`); setWorkers(prev => prev.filter(w => w.id !== id)); setSuccess('Worker deleted') }
    catch (err: any) { setError(err.response?.data?.message || 'Failed to delete') } finally { setWorkerActionLoading('') }
  }

  // ── Rate CRUD ──
  const handleSaveRate = async () => {
    if (!editRate.agency_id || !editRate.shift_type || !editRate.rate_per_hour) { setError('All fields required'); return }
    try {
      setRateSaving(true); await api.post('/agencies/rates', editRate)
      setRateDialog(false); setEditRate({ agency_id: '', shift_type: 'day', rate_per_hour: '', effective_from: '', effective_to: '' })
      setSuccess('Rate created'); await fetchRates()
    } catch (err: any) { setError(err.response?.data?.message || 'Failed to save') } finally { setRateSaving(false) }
  }

  const handleDeleteRate = async (id: string) => {
    try { setRateActionLoading(id); await api.delete(`/agencies/rates/${id}`); setRates(prev => prev.filter(r => r.id !== id)); setSuccess('Rate deleted') }
    catch (err: any) { setError(err.response?.data?.message || 'Failed to delete') } finally { setRateActionLoading('') }
  }

  // ── Helpers ──
  const statusChip = (s: string) => {
    if (s === 'active') return <Chip label="Active" size="small" color="success" sx={{ height: 20, fontSize: '0.7rem' }} />
    return <Chip label="Inactive" size="small" color="default" sx={{ height: 20, fontSize: '0.7rem' }} />
  }


  const formatCurrency = (v: any) => `£${Number(v || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <BusinessIcon sx={{ color: '#0F4C81', fontSize: 28 }} />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Agency Management</Typography>
        {savings && (
          <Chip label={`Net ${Number(savings.net_savings) >= 0 ? 'Saved' : 'Cost'}: ${formatCurrency(Math.abs(savings.net_savings))}`}
            color={Number(savings.net_savings) >= 0 ? 'success' : 'error'} size="small" sx={{ ml: 1, fontWeight: 700 }} />
        )}
      </Stack>

      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>{success}</Alert>}

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => { setTab(v); setPage(0) }}>
          <Tab label="Agencies" icon={<BusinessIcon />} iconPosition="start" />
          <Tab label="Workers" icon={<PeopleIcon />} iconPosition="start" />
          <Tab label="Rates" icon={<MoneyIcon />} iconPosition="start" />
          <Tab label="Shift History" icon={<HistoryIcon />} iconPosition="start" />
          <Tab label="Analytics" icon={<AnalyticsIcon />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* ══════ Tab 0: Agencies ══════ */}
      {tab === 0 && (
        <>
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditAgency({ name: '', contact_name: '', contact_phone: '', contact_email: '', address: '', notes: '', status: 'active', contract_start_date: '', contract_end_date: '' }); setAgencyDialog(true) }}
              sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>Add Agency</Button>
          </Stack>
          {agenciesLoading ? <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box> : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Contact</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Phone</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Active Workers</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Total Shifts</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Contract</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {agencies.length === 0 ? (
                    <TableRow><TableCell colSpan={8} align="center" sx={{ py: 3, color: '#9CA3AF' }}>No agencies added yet</TableCell></TableRow>
                  ) : agencies.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(a => (
                    <TableRow key={a.id} hover onClick={() => openAgency(a)} sx={{ cursor: 'pointer' }}>
                      <TableCell sx={{ fontWeight: 500 }}>{a.name}</TableCell>
                      <TableCell>{statusChip(a.status)}</TableCell>
                      <TableCell>{a.contact_name || '-'}</TableCell>
                      <TableCell>{a.contact_phone || '-'}</TableCell>
                      <TableCell>{a.active_workers || 0}</TableCell>
                      <TableCell>{a.total_shifts || 0}</TableCell>
                      <TableCell sx={{ fontSize: '0.75rem' }}>
                        {a.contract_start_date ? `${formatDate(a.contract_start_date)} — ${a.contract_end_date ? formatDate(a.contract_end_date) : 'Open'}` : '—'}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="Edit"><IconButton size="small" onClick={e => { e.stopPropagation(); setEditAgency(a); setAgencyDialog(true) }}><EditIcon fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={e => { e.stopPropagation(); handleDeleteAgency(a.id) }} disabled={agencyActionLoading === a.id}>
                            {agencyActionLoading === a.id ? <CircularProgress size={16} /> : <DeleteIcon fontSize="small" />}
                          </IconButton></Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {agencies.length > rowsPerPage && <TablePagination component="div" count={agencies.length} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} rowsPerPageOptions={[rowsPerPage]} />}
            </TableContainer>
          )}
          {selectedAgency && <Paper sx={{ mt: 3, p: 3, border: '1px solid #DBEAFE', borderRadius: 2, bgcolor: '#F8FAFC' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2} sx={{ mb: 2 }}><Box><Typography variant="overline" color="primary">Agency workspace</Typography><Typography variant="h5" fontWeight={800}>{selectedAgency.name}</Typography><Typography variant="body2" color="text.secondary">{selectedAgency.address || 'No address recorded'} · {selectedAgency.contact_name || 'No contact person'}</Typography></Box><Button onClick={() => setSelectedAgency(null)}>Close workspace</Button></Stack>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}><Chip label={selectedAgency.status || 'Active'} color="success" /><Chip icon={<StarIcon />} label={`${selectedAgency.rating || '—'} agency rating`} variant="outlined" /><Chip label={`${selectedAgency.active_workers || selectedAgencyWorkers.length} workers`} variant="outlined" /></Stack>
            <Tabs value={agencyView} onChange={(_, v) => setAgencyView(v)}><Tab value="overview" label="Details" /><Tab value="workers" label={`Workers (${selectedAgencyWorkers.length})`} /><Tab value="rates" label={`Rates (${selectedAgencyRates.length})`} /></Tabs>
            {agencyView === 'overview' && <Grid container spacing={2} sx={{ mt: 1 }}><Grid item xs={12} md={6}><Typography variant="caption" color="text.secondary">Contact</Typography><Typography>{selectedAgency.contact_name || '—'} · {selectedAgency.contact_phone || '—'} · {selectedAgency.contact_email || '—'}</Typography></Grid><Grid item xs={12} md={6}><Typography variant="caption" color="text.secondary">Contract</Typography><Typography>{selectedAgency.contract_start_date || '—'} to {selectedAgency.contract_end_date || 'Open'}</Typography></Grid><Grid item xs={12}><Typography variant="caption" color="text.secondary">Notes</Typography><Typography sx={{ whiteSpace: 'pre-wrap' }}>{selectedAgency.notes || 'No notes recorded.'}</Typography></Grid></Grid>}
            {agencyView === 'workers' && <Stack spacing={1} sx={{ mt: 2 }}>{selectedAgencyWorkers.map(w => <Paper key={w.id} variant="outlined" sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between' }}><Box><Typography fontWeight={700}>{w.first_name} {w.last_name}</Typography><Typography variant="caption" color="text.secondary">{w.role || 'Worker'} · {w.phone || 'No phone'}</Typography></Box><Typography><StarIcon sx={{ fontSize: 16, color: '#F59E0B', verticalAlign: 'middle' }} /> {w.rating || '—'}</Typography></Paper>)}</Stack>}
            {agencyView === 'rates' && <Table size="small" sx={{ mt: 2 }}><TableHead><TableRow><TableCell>Shift type</TableCell><TableCell>Rate/hour</TableCell><TableCell>Effective from</TableCell><TableCell>Effective to</TableCell></TableRow></TableHead><TableBody>{selectedAgencyRates.map(r => <TableRow key={r.id}><TableCell>{r.shift_type}</TableCell><TableCell>{formatCurrency(r.rate_per_hour)}</TableCell><TableCell>{formatDate(r.effective_from)}</TableCell><TableCell>{formatDate(r.effective_to)}</TableCell></TableRow>)}</TableBody></Table>}
          </Paper>}
          <Dialog open={agencyDialog} onClose={() => setAgencyDialog(false)} maxWidth="sm" fullWidth>
            <DialogTitle>{editAgency.id ? 'Edit Agency' : 'Add Agency'}</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField label="Agency Name" value={editAgency.name || ''} onChange={e => setEditAgency({ ...editAgency, name: e.target.value })} required fullWidth />
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select value={editAgency.status || 'active'} label="Status" onChange={e => setEditAgency({ ...editAgency, status: e.target.value })}>
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                  </Select>
                </FormControl>
                <TextField label="Contact Name" value={editAgency.contact_name || ''} onChange={e => setEditAgency({ ...editAgency, contact_name: e.target.value })} fullWidth />
                <TextField label="Contact Phone" value={editAgency.contact_phone || ''} onChange={e => setEditAgency({ ...editAgency, contact_phone: e.target.value })} fullWidth />
                <TextField label="Contact Email" value={editAgency.contact_email || ''} onChange={e => setEditAgency({ ...editAgency, contact_email: e.target.value })} fullWidth />
                <TextField label="Address" value={editAgency.address || ''} onChange={e => setEditAgency({ ...editAgency, address: e.target.value })} multiline rows={2} fullWidth />
                <Stack direction="row" spacing={2}>
                  <TextField label="Contract Start" type="date" value={editAgency.contract_start_date || ''} onChange={e => setEditAgency({ ...editAgency, contract_start_date: e.target.value })} fullWidth InputLabelProps={{ shrink: true }} />
                  <TextField label="Contract End" type="date" value={editAgency.contract_end_date || ''} onChange={e => setEditAgency({ ...editAgency, contract_end_date: e.target.value })} fullWidth InputLabelProps={{ shrink: true }} />
                </Stack>
                <TextField label="Notes" value={editAgency.notes || ''} onChange={e => setEditAgency({ ...editAgency, notes: e.target.value })} multiline rows={2} fullWidth />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 3 }}>
              <Button onClick={() => setAgencyDialog(false)}>Cancel</Button>
              <Button variant="contained" onClick={handleSaveAgency} disabled={agencySaving} sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>
                {agencySaving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Save'}
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}

      {/* ══════ Tab 1: Workers ══════ */}
      {tab === 1 && (
        <>
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditWorker({ agency_id: agencies[0]?.id || '', first_name: '', last_name: '', role: '', phone: '', email: '', dbs_check_date: '', dbs_expiry_date: '', mandatory_training_completed: false, status: 'active', rating: '', notes: '' }); setWorkerDialog(true) }}
              sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>Add Worker</Button>
          </Stack>
          {workersLoading ? <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box> : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Agency</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Phone</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>DBS Expiry</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Training</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Rating</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {workers.length === 0 ? (
                    <TableRow><TableCell colSpan={9} align="center" sx={{ py: 3, color: '#9CA3AF' }}>No workers added yet</TableCell></TableRow>
                  ) : workers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(w => (
                    <TableRow key={w.id} hover>
                      <TableCell sx={{ fontWeight: 500 }}>{w.first_name} {w.last_name}</TableCell>
                      <TableCell>{w.agency_name}</TableCell>
                      <TableCell>{w.role || '—'}</TableCell>
                      <TableCell>{w.phone || '—'}</TableCell>
                      <TableCell sx={{ fontSize: '0.75rem' }}>{w.dbs_expiry_date ? formatDate(w.dbs_expiry_date) : '—'}</TableCell>
                      <TableCell>{w.mandatory_training_completed ? <CheckCircle sx={{ color: '#16A34A', fontSize: 18 }} /> : <Cancel sx={{ color: '#DC2626', fontSize: 18 }} />}</TableCell>
                      <TableCell>{w.rating ? <><StarIcon sx={{ fontSize: 14, color: '#F59E0B', verticalAlign: 'middle' }} /> {w.rating}</> : '—'}</TableCell>
                      <TableCell>{statusChip(w.status)}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="Edit"><IconButton size="small" onClick={() => { setEditWorker(w); setWorkerDialog(true) }}><EditIcon fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDeleteWorker(w.id)} disabled={workerActionLoading === w.id}>
                            {workerActionLoading === w.id ? <CircularProgress size={16} /> : <DeleteIcon fontSize="small" />}
                          </IconButton></Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {workers.length > rowsPerPage && <TablePagination component="div" count={workers.length} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} rowsPerPageOptions={[rowsPerPage]} />}
            </TableContainer>
          )}
          <Dialog open={workerDialog} onClose={() => setWorkerDialog(false)} maxWidth="sm" fullWidth>
            <DialogTitle>{editWorker.id ? 'Edit Worker' : 'Add Worker'}</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Agency *</InputLabel>
                  <Select value={editWorker.agency_id || ''} label="Agency *" onChange={e => setEditWorker({ ...editWorker, agency_id: e.target.value })}>
                    {agencies.filter(a => a.status === 'active').map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <Stack direction="row" spacing={2}>
                  <TextField label="First Name *" value={editWorker.first_name || ''} onChange={e => setEditWorker({ ...editWorker, first_name: e.target.value })} fullWidth />
                  <TextField label="Last Name *" value={editWorker.last_name || ''} onChange={e => setEditWorker({ ...editWorker, last_name: e.target.value })} fullWidth />
                </Stack>
                <TextField label="Role" value={editWorker.role || ''} onChange={e => setEditWorker({ ...editWorker, role: e.target.value })} fullWidth />
                <Stack direction="row" spacing={2}>
                  <TextField label="Phone" value={editWorker.phone || ''} onChange={e => setEditWorker({ ...editWorker, phone: e.target.value })} fullWidth />
                  <TextField label="Email" value={editWorker.email || ''} onChange={e => setEditWorker({ ...editWorker, email: e.target.value })} fullWidth />
                </Stack>
                <Stack direction="row" spacing={2}>
                  <TextField label="DBS Check Date" type="date" value={editWorker.dbs_check_date || ''} onChange={e => setEditWorker({ ...editWorker, dbs_check_date: e.target.value })} fullWidth InputLabelProps={{ shrink: true }} />
                  <TextField label="DBS Expiry Date" type="date" value={editWorker.dbs_expiry_date || ''} onChange={e => setEditWorker({ ...editWorker, dbs_expiry_date: e.target.value })} fullWidth InputLabelProps={{ shrink: true }} />
                </Stack>
                <FormControl fullWidth size="small">
                  <InputLabel>Mandatory Training</InputLabel>
                  <Select value={editWorker.mandatory_training_completed ? 'yes' : 'no'} label="Mandatory Training" onChange={e => setEditWorker({ ...editWorker, mandatory_training_completed: e.target.value === 'yes' })}>
                    <MenuItem value="yes">Completed</MenuItem>
                    <MenuItem value="no">Not Completed</MenuItem>
                  </Select>
                </FormControl>
                <Stack direction="row" spacing={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Status</InputLabel>
                    <Select value={editWorker.status || 'active'} label="Status" onChange={e => setEditWorker({ ...editWorker, status: e.target.value })}>
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="inactive">Inactive</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField label="Rating (1-5)" type="number" value={editWorker.rating || ''} onChange={e => setEditWorker({ ...editWorker, rating: e.target.value })} fullWidth inputProps={{ min: 1, max: 5, step: 0.5 }} />
                </Stack>
                <TextField label="Notes" value={editWorker.notes || ''} onChange={e => setEditWorker({ ...editWorker, notes: e.target.value })} multiline rows={2} fullWidth />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 3 }}>
              <Button onClick={() => setWorkerDialog(false)}>Cancel</Button>
              <Button variant="contained" onClick={handleSaveWorker} disabled={workerSaving} sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>
                {workerSaving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Save'}
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}

      {/* ══════ Tab 2: Rates ══════ */}
      {tab === 2 && (
        <>
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditRate({ agency_id: agencies[0]?.id || '', shift_type: 'day', rate_per_hour: '', effective_from: new Date().toISOString().split('T')[0], effective_to: '' }); setRateDialog(true) }}
              sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>Add Rate</Button>
          </Stack>
          {ratesLoading ? <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box> : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Agency</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Shift Type</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Rate / Hour</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Effective From</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Effective To</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rates.length === 0 ? (
                    <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3, color: '#9CA3AF' }}>No rates configured yet</TableCell></TableRow>
                  ) : rates.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(r => (
                    <TableRow key={r.id} hover>
                      <TableCell sx={{ fontWeight: 500 }}>{r.agency_name}</TableCell>
                      <TableCell><Chip label={r.shift_type} size="small" variant="outlined" sx={{ textTransform: 'capitalize' }} /></TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{formatCurrency(r.rate_per_hour)}</TableCell>
                      <TableCell sx={{ fontSize: '0.75rem' }}>{formatDate(r.effective_from)}</TableCell>
                      <TableCell sx={{ fontSize: '0.75rem' }}>{r.effective_to ? formatDate(r.effective_to) : 'Current'}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDeleteRate(r.id)} disabled={rateActionLoading === r.id}>
                            {rateActionLoading === r.id ? <CircularProgress size={16} /> : <DeleteIcon fontSize="small" />}
                          </IconButton></Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rates.length > rowsPerPage && <TablePagination component="div" count={rates.length} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} rowsPerPageOptions={[rowsPerPage]} />}
            </TableContainer>
          )}
          <Dialog open={rateDialog} onClose={() => setRateDialog(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Add Rate</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Agency *</InputLabel>
                  <Select value={editRate.agency_id || ''} label="Agency *" onChange={e => setEditRate({ ...editRate, agency_id: e.target.value })}>
                    {agencies.filter(a => a.status === 'active').map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small">
                  <InputLabel>Shift Type *</InputLabel>
                  <Select value={editRate.shift_type || 'day'} label="Shift Type *" onChange={e => setEditRate({ ...editRate, shift_type: e.target.value })}>
                    <MenuItem value="day">Day</MenuItem>
                    <MenuItem value="sleep">Sleep</MenuItem>
                    <MenuItem value="wake_night">Wake Night</MenuItem>
                  </Select>
                </FormControl>
                <TextField label="Rate per Hour (£) *" type="number" value={editRate.rate_per_hour || ''} onChange={e => setEditRate({ ...editRate, rate_per_hour: e.target.value })} fullWidth inputProps={{ min: 0, step: 0.5 }} />
                <Stack direction="row" spacing={2}>
                  <TextField label="Effective From" type="date" value={editRate.effective_from || ''} onChange={e => setEditRate({ ...editRate, effective_from: e.target.value })} fullWidth InputLabelProps={{ shrink: true }} />
                  <TextField label="Effective To (optional)" type="date" value={editRate.effective_to || ''} onChange={e => setEditRate({ ...editRate, effective_to: e.target.value })} fullWidth InputLabelProps={{ shrink: true }} />
                </Stack>
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 3 }}>
              <Button onClick={() => setRateDialog(false)}>Cancel</Button>
              <Button variant="contained" onClick={handleSaveRate} disabled={rateSaving} sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>
                {rateSaving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Save'}
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}

      {/* ══════ Tab 3: Shift History ══════ */}
      {tab === 3 && (
        <>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Agency</InputLabel>
                <Select value={historyFilters.agency_id} label="Agency" onChange={e => setHistoryFilters(f => ({ ...f, agency_id: e.target.value }))}>
                  <MenuItem value="">All Agencies</MenuItem>
                  {agencies.map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Status</InputLabel>
                <Select value={historyFilters.status} label="Status" onChange={e => setHistoryFilters(f => ({ ...f, status: e.target.value }))}>
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="sent">Sent</MenuItem>
                  <MenuItem value="accepted">Accepted</MenuItem>
                  <MenuItem value="declined">Declined</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                </Select>
              </FormControl>
              <TextField label="From" type="date" size="small" value={historyFilters.date_from} onChange={e => setHistoryFilters(f => ({ ...f, date_from: e.target.value }))} InputLabelProps={{ shrink: true }} sx={{ '& .MuiInputBase-root': { fontSize: '0.875rem' } }} />
              <TextField label="To" type="date" size="small" value={historyFilters.date_to} onChange={e => setHistoryFilters(f => ({ ...f, date_to: e.target.value }))} InputLabelProps={{ shrink: true }} sx={{ '& .MuiInputBase-root': { fontSize: '0.875rem' } }} />
              <Button size="small" variant="outlined" onClick={() => { setHistoryFilters({ agency_id: '', status: '', date_from: '', date_to: '' }) }}>Clear</Button>
            </Stack>
          </Paper>
          {historyLoading ? <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box> : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Time</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Agency</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Worker</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Hours</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Cost</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Coverage</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                  {history.length === 0 ? (
                    <TableRow><TableCell colSpan={8} align="center" sx={{ py: 3, color: '#9CA3AF' }}>No agency shifts yet</TableCell></TableRow>
                  ) : history.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(h => (
                    <TableRow key={h.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{formatDate(h.start_time)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                        {new Date(h.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} — {new Date(h.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell>{h.location_name}</TableCell>
                      <TableCell>{h.agency_name || '—'}</TableCell>
                      <TableCell>{h.worker_first_name ? `${h.worker_first_name} ${h.worker_last_name}` : '—'}</TableCell>
                      <TableCell>{Math.round(Number(h.hours) * 10) / 10}h</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{h.agency_cost ? formatCurrency(h.agency_cost) : '—'}</TableCell>
                      <TableCell>
                        <ToggleButtonGroup size="small" value={h.agency_covered ? 'covered' : 'uncovered'} exclusive
                          onChange={() => handleToggleCoverage(h.id, h.agency_covered)}
                          disabled={updatingCoverage === h.id}
                          sx={{ '& .MuiToggleButton-root': { px: 1, py: 0.2, fontSize: '0.7rem', lineHeight: 1, textTransform: 'none', fontWeight: 700, border: '1px solid #D1D5DB' } }}>
                          <ToggleButton value="covered" sx={{ bgcolor: h.agency_covered ? '#D1FAE5' : 'transparent', color: h.agency_covered ? '#065F46' : '#9CA3AF', '&:hover': { bgcolor: '#A7F3D0' } }}>
                            Covered
                          </ToggleButton>
                          <ToggleButton value="uncovered" sx={{ bgcolor: !h.agency_covered ? '#FEF3C7' : 'transparent', color: !h.agency_covered ? '#92400E' : '#9CA3AF', '&:hover': { bgcolor: '#FDE68A' } }}>
                            Uncovered
                          </ToggleButton>
                        </ToggleButtonGroup>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {history.length > rowsPerPage && <TablePagination component="div" count={history.length} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} rowsPerPageOptions={[rowsPerPage]} />}
            </TableContainer>
          )}
        </>
      )}

      {/* ══════ Tab 4: Analytics ══════ */}
      {tab === 4 && (
        <>
          {analyticsLoading ? <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box> : (
            <>
              {savings && (
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  {[
                    { label: 'Total Agency Shifts', value: savings.total_shifts, color: '#0F4C81' },
                    { label: 'Completed Shifts', value: savings.completed_shifts, color: '#16A34A' },
                    { label: 'Total Agency Spend', value: formatCurrency(savings.total_agency_cost), color: '#DC2626' },
                    { label: 'Avg Agency Rate/hr', value: formatCurrency(savings.avg_agency_hourly_rate), color: '#D97706' },
                    { label: 'Internal Rate/hr', value: formatCurrency(savings.internal_hourly_rate), color: '#0F4C81' },
                    { label: 'Net Savings', value: formatCurrency(savings.net_savings), color: Number(savings.net_savings) >= 0 ? '#16A34A' : '#DC2626' },
                  ].map(card => (
                    <Grid item xs={12} sm={6} md={4} key={card.label}>
                      <Card variant="outlined" sx={{ borderLeft: `4px solid ${card.color}`, borderRadius: 1 }}>
                        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                          <Typography variant="caption" color="#6B7280" sx={{ fontWeight: 600 }}>{card.label}</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>{card.value}</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}

              {/* Monthly breakdown */}
              {savingsByMonth.length > 0 && (
                <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Monthly Agency Savings</Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Month</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">Shifts</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">Total Cost</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">Net Savings</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {savingsByMonth.map((m: any) => (
                        <TableRow key={m.month} hover>
                          <TableCell>{new Date(m.month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</TableCell>
                          <TableCell align="right">{m.shifts}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>{formatCurrency(m.total_cost)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: Number(m.net_savings) >= 0 ? '#16A34A' : '#DC2626' }}>{formatCurrency(m.net_savings)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              )}

              {/* Per-agency breakdown */}
              {savingsByAgency.length > 0 && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Agency Breakdown</Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Agency</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">Shifts</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">Total Cost</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">Avg Rate/hr</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">Internal Rate</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {savingsByAgency.map((a: any) => (
                        <TableRow key={a.id} hover onClick={() => openAgency(a)} sx={{ cursor: 'pointer' }}>
                          <TableCell sx={{ fontWeight: 500 }}>{a.name}</TableCell>
                          <TableCell align="right">{a.shifts}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>{formatCurrency(a.total_cost)}</TableCell>
                          <TableCell align="right">{formatCurrency(a.avg_rate)}</TableCell>
                          <TableCell align="right">{formatCurrency(a.internal_rate)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              )}

              {!savings && savingsByMonth.length === 0 && savingsByAgency.length === 0 && (
                <Paper sx={{ p: 6, textAlign: 'center' }}>
                  <Typography color="#9CA3AF">No agency shift data yet. Send shifts to agencies to see analytics.</Typography>
                </Paper>
              )}
            </>
          )}
        </>
      )}
    </Box>
  )
}
