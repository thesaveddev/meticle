import { useState, useEffect, useMemo } from 'react'
import { Box, Typography, Paper, Stack, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Select, MenuItem, FormControl, InputLabel, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, IconButton, CircularProgress, Alert, Divider } from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, CheckCircle as CheckCircleIcon, Visibility as VisibilityIcon } from '@mui/icons-material'
import api from '../../services/api'

const NAVY = '#0F4C81'
const RECURRENCE_LABELS: Record<string, string> = { once: 'Once', daily: 'Daily', monthly: 'Monthly', yearly: 'Yearly' }
const STATUS_COLORS: Record<string, 'success' | 'warning' | 'error' | 'default'> = { scheduled: 'warning', completed: 'success', cancelled: 'error', no_show: 'default' }
const EMPTY_FORM = { title: '', description: '', notes: '', person_id: '', staff_id: '', location_id: '', recurrence: 'once', start_time: '', end_time: '', status: 'scheduled' }

function asArray(value: any, keys: string[] = []) {
  if (Array.isArray(value)) return value
  for (const key of keys) if (Array.isArray(value?.[key])) return value[key]
  return Array.isArray(value?.data) ? value.data : []
}
function inputDateTime(value?: string) { return value ? new Date(value).toISOString().slice(0, 16) : '' }

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [viewing, setViewing] = useState<any>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [people, setPeople] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0])
  const [completionOpen, setCompletionOpen] = useState(false)
  const [completionNotes, setCompletionNotes] = useState('')
  const [followUp, setFollowUp] = useState('')

  const fetchAppointments = async () => {
    setFetchError(''); setLoading(true)
    try { const res = await api.get(`/appointments?date=${dateFilter}`); setAppointments(asArray(res.data, ['appointments'])) }
    catch (e: any) { setAppointments([]); setFetchError(e?.response?.data?.message || 'Failed to load appointments') }
    finally { setLoading(false) }
  }
  useEffect(() => {
    fetchAppointments()
    api.get('/people?status=active').then(r => setPeople(asArray(r.data, ['people']))).catch(() => {})
    api.get('/staff/org-members').then(r => { const d = r.data; const members = Array.isArray(d) ? d : [...(Array.isArray(d?.admins) ? d.admins : []), ...(Array.isArray(d?.staff) ? d.staff : [])]; setStaff(members.filter((s: any) => s.status === 'active')) }).catch(() => {})
  }, [dateFilter])

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY_FORM, start_time: `${dateFilter}T09:00`, end_time: `${dateFilter}T10:00` }); setDialogOpen(true) }
  const openEdit = (a: any) => { setEditing(a); setForm({ title: a.title || '', description: a.description || '', notes: a.notes || '', person_id: a.person_id || '', staff_id: a.staff_id || '', location_id: a.location_id || '', recurrence: a.recurrence || 'once', start_time: inputDateTime(a.start_time), end_time: inputDateTime(a.end_time), status: a.status || 'scheduled' }); setDialogOpen(true) }
  const openView = (a: any) => { setViewing(a); setViewOpen(true) }
  const handleSave = async () => {
    setSaving(true); setFetchError('')
    try {
      const payload = { ...form, start_time: new Date(form.start_time).toISOString(), end_time: new Date(form.end_time).toISOString(), person_id: form.person_id || null, staff_id: form.staff_id || null, location_id: form.location_id || null }
      if (editing) await api.patch(`/appointments/${editing.id}`, payload); else await api.post('/appointments', payload)
      setDialogOpen(false); await fetchAppointments()
    } catch (e: any) { setFetchError(e?.response?.data?.message || 'Failed to save appointment') }
    finally { setSaving(false) }
  }
  const updateStatus = async (a: any, status: string, details?: { notes?: string; follow_up?: string }) => {
    try { await api.patch(`/appointments/${a.id}`, { status, notes: details?.notes || a.notes || '', follow_up: details?.follow_up || undefined }); setViewing((v: any) => v ? { ...v, status, notes: details?.notes || v.notes } : v); fetchAppointments() }
    catch (e: any) { setFetchError(e?.response?.data?.message || 'Failed to update appointment') }
  }
  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this appointment?')) return
    try { await api.delete(`/appointments/${id}`); fetchAppointments() } catch (e: any) { setFetchError(e?.response?.data?.message || 'Failed to delete appointment') }
  }
  const counts = useMemo(() => ({ scheduled: appointments.filter(a => a.status === 'scheduled').length, completed: appointments.filter(a => a.status === 'completed').length, cancelled: appointments.filter(a => a.status === 'cancelled').length }), [appointments])

  if (loading) return <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: NAVY }} /></Box>

  return (
    <Box>
      {fetchError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFetchError('')}>{fetchError}</Alert>}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={2} sx={{ mb: 3 }}><Box><Typography variant="h5" fontWeight={800}>Appointments</Typography><Typography variant="body2" color="text.secondary">Coordinate reviews, visits, and follow-ups for people and staff.</Typography></Box><Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 700 }}>Add appointment</Button></Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>{[['Scheduled', counts.scheduled, 'warning'], ['Completed', counts.completed, 'success'], ['Cancelled', counts.cancelled, 'error']].map(([label, value]) => <Paper key={String(label)} sx={{ flex: 1, p: 1.5, border: '1px solid #E5E7EB', borderRadius: 2 }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="h6" fontWeight={800}>{value}</Typography></Paper>)}</Stack>
      <Paper sx={{ p: 1.5, mb: 2, border: '1px solid #E5E7EB', borderRadius: 2 }}><TextField type="date" label="Showing date" InputLabelProps={{ shrink: true }} value={dateFilter} onChange={e => { setDateFilter(e.target.value); setPage(0) }} size="small" /></Paper>
      <TableContainer component={Paper} sx={{ border: '1px solid #E5E7EB', borderRadius: 2 }}><Table size="small"><TableHead><TableRow>{['Appointment', 'Person', 'Staff', 'Time', 'Cadence', 'Status', ''].map(h => <TableCell key={h} sx={{ fontWeight: 800, color: 'text.secondary' }}>{h}</TableCell>)}</TableRow></TableHead><TableBody>{appointments.length === 0 ? <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6, color: '#9CA3AF' }}>No appointments for this date.</TableCell></TableRow> : appointments.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(a => <TableRow key={a.id} hover onClick={() => openView(a)} sx={{ cursor: 'pointer' }}><TableCell><Typography fontWeight={700}>{a.title}</Typography>{a.notes && <Typography variant="caption" color="text.secondary" noWrap>{a.notes}</Typography>}</TableCell><TableCell>{a.person_name || 'Team / general'}</TableCell><TableCell>{a.staff_name || 'Unassigned'}</TableCell><TableCell>{new Date(a.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(a.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell><TableCell><Chip size="small" label={RECURRENCE_LABELS[a.recurrence] || 'Once'} variant="outlined" /></TableCell><TableCell><Chip size="small" label={(a.status || '').replace(/_/g, ' ')} color={STATUS_COLORS[a.status] || 'default'} sx={{ textTransform: 'capitalize' }} /></TableCell><TableCell align="right" onClick={e => e.stopPropagation()}><IconButton size="small" onClick={() => openView(a)} title="View"><VisibilityIcon fontSize="small" /></IconButton><IconButton size="small" onClick={() => openEdit(a)} title="Edit"><EditIcon fontSize="small" /></IconButton><IconButton size="small" color="error" onClick={() => handleDelete(a.id)} title="Delete"><DeleteIcon fontSize="small" /></IconButton></TableCell></TableRow>)}</TableBody></Table><TablePagination component="div" count={appointments.length} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0) }} rowsPerPageOptions={[5, 10, 25]} /></TableContainer>

      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="sm" fullWidth><DialogTitle sx={{ fontWeight: 800 }}>{viewing?.title}</DialogTitle><DialogContent>{viewing && <Stack spacing={2} sx={{ mt: 1 }}><Stack direction="row" spacing={1} flexWrap="wrap"><Chip label={(viewing.status || '').replace(/_/g, ' ')} color={STATUS_COLORS[viewing.status] || 'default'} sx={{ textTransform: 'capitalize' }} /><Chip label={RECURRENCE_LABELS[viewing.recurrence] || 'Once'} variant="outlined" /></Stack><Divider /><Typography variant="body2"><strong>For:</strong> {viewing.person_name || 'Team / general'}</Typography><Typography variant="body2"><strong>Assigned:</strong> {viewing.staff_name || 'Unassigned'}</Typography><Typography variant="body2"><strong>When:</strong> {new Date(viewing.start_time).toLocaleString('en-GB')} to {new Date(viewing.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Typography><Stack spacing={0.5}><Typography variant="caption" color="text.secondary">Description</Typography><Typography sx={{ whiteSpace: 'pre-wrap' }}>{viewing.description || 'No description recorded.'}</Typography></Stack><Stack spacing={0.5}><Typography variant="caption" color="text.secondary">Notes</Typography><Typography sx={{ whiteSpace: 'pre-wrap' }}>{viewing.notes || 'No notes recorded.'}</Typography></Stack></Stack>}</DialogContent><DialogActions sx={{ p: 2.5 }}><Button onClick={() => setViewOpen(false)}>Close</Button>{viewing?.status === 'scheduled' && <Button variant="contained" startIcon={<CheckCircleIcon />} onClick={() => { setCompletionNotes(''); setFollowUp(''); setCompletionOpen(true) }} sx={{ bgcolor: '#15803D', textTransform: 'none' }}>Mark complete</Button>}<Button onClick={() => { setViewOpen(false); openEdit(viewing) }} sx={{ textTransform: 'none' }}>Edit</Button></DialogActions></Dialog>

      <Dialog open={completionOpen} onClose={() => setCompletionOpen(false)} maxWidth="xs" fullWidth><DialogTitle sx={{ fontWeight: 800 }}>Complete appointment</DialogTitle><DialogContent><Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Capture the outcome while it is fresh.</Typography><Stack spacing={2}><TextField label="Completion notes" multiline rows={4} fullWidth required placeholder="What happened and what should the team know?" value={completionNotes} onChange={e => setCompletionNotes(e.target.value)} /><TextField label="Follow-up appointment or action" multiline rows={2} fullWidth placeholder="Optional: next appointment, referral, or action" value={followUp} onChange={e => setFollowUp(e.target.value)} /></Stack></DialogContent><DialogActions><Button onClick={() => setCompletionOpen(false)}>Cancel</Button><Button variant="contained" disabled={!completionNotes.trim()} onClick={() => { updateStatus(viewing, 'completed', { notes: completionNotes, follow_up: followUp }); setCompletionOpen(false); setViewOpen(false) }} sx={{ bgcolor: '#15803D' }}>Save completion</Button></DialogActions></Dialog>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth><DialogTitle sx={{ fontWeight: 800 }}>{editing ? 'Edit appointment' : 'New appointment'}</DialogTitle><DialogContent><Stack spacing={2} sx={{ mt: 1 }}><TextField label="Title" required fullWidth value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /><TextField label="Description" fullWidth multiline rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /><TextField label="Notes" fullWidth multiline rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><FormControl fullWidth><InputLabel>Person</InputLabel><Select value={form.person_id} label="Person" onChange={e => setForm(f => ({ ...f, person_id: e.target.value }))}><MenuItem value="">Team / general</MenuItem>{people.map(p => <MenuItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</MenuItem>)}</Select></FormControl><FormControl fullWidth><InputLabel>Staff member</InputLabel><Select value={form.staff_id} label="Staff member" onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}><MenuItem value="">Unassigned</MenuItem>{staff.map(s => <MenuItem key={s.staff_id || s.id} value={s.staff_id || s.id}>{s.first_name} {s.last_name}</MenuItem>)}</Select></FormControl></Stack><TextField select label="Cadence" fullWidth value={form.recurrence} onChange={e => setForm(f => ({ ...f, recurrence: e.target.value }))}>{Object.entries(RECURRENCE_LABELS).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}</TextField><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField label="Start" type="datetime-local" fullWidth InputLabelProps={{ shrink: true }} value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} /><TextField label="End" type="datetime-local" fullWidth InputLabelProps={{ shrink: true }} value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} /></Stack><FormControl fullWidth><InputLabel>Status</InputLabel><Select value={form.status} label="Status" onChange={e => setForm(f => ({ ...f, status: e.target.value }))}><MenuItem value="scheduled">Scheduled</MenuItem><MenuItem value="completed">Completed</MenuItem><MenuItem value="cancelled">Cancelled</MenuItem><MenuItem value="no_show">No show</MenuItem></Select></FormControl></Stack></DialogContent><DialogActions><Button onClick={() => setDialogOpen(false)}>Cancel</Button><Button variant="contained" onClick={handleSave} disabled={saving || !form.title || !form.start_time || !form.end_time} sx={{ bgcolor: NAVY }}>{saving ? <CircularProgress size={20} /> : 'Save appointment'}</Button></DialogActions></Dialog>
    </Box>
  )
}
