import { useState, useEffect } from 'react'
import { Box, Typography, Paper, Stack, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Select, MenuItem, FormControl, InputLabel, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, IconButton, CircularProgress, Alert } from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material'
import api from '../../services/api'

interface Appointment {
  id: string
  title: string
  description?: string
  service_user_name?: string
  staff_name?: string
  location_name?: string
  start_time: string
  end_time: string
  status: string
  service_user_id?: string
  staff_id?: string
  location_id?: string
}

interface ServiceUser { id: string; first_name: string; last_name: string }
interface StaffMember { id: string; first_name: string; last_name: string }

const initialForm = { title: '', description: '', service_user_id: '', staff_id: '', location_id: '', start_time: '', end_time: '', status: 'scheduled' }

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [form, setForm] = useState(initialForm)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [serviceUsers, setServiceUsers] = useState<ServiceUser[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [saving, setSaving] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0])

  const fetchAppointments = async () => {
    setFetchError('')
    try {
      const res = await api.get(`/appointments?date=${dateFilter}`)
      setAppointments(res.data)
    } catch (e: any) {
      setAppointments([])
      setFetchError(e?.response?.data?.message || 'Failed to load appointments')
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchAppointments()
    api.get('/service-users?status=active').then(r => setServiceUsers(r.data)).catch(() => {})
    api.get('/staff/org-members').then(r => { const d = r.data; setStaff([...(d?.admins?.length ? d.admins : (d?.admin ? [d.admin] : [])), ...(d?.staff || [])]) }).catch(() => {})
  }, [dateFilter])

  const openCreate = () => { setEditing(null); setForm(initialForm); setDialogOpen(true) }
  const openEdit = (a: Appointment) => { setEditing(a); setForm({ title: a.title, description: a.description || '', service_user_id: a.service_user_id || '', staff_id: a.staff_id || '', location_id: a.location_id || '', start_time: a.start_time.slice(0, 16), end_time: a.end_time.slice(0, 16), status: a.status }); setDialogOpen(true) }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { ...form, start_time: new Date(form.start_time).toISOString(), end_time: new Date(form.end_time).toISOString(), service_user_id: form.service_user_id || null, staff_id: form.staff_id || null, location_id: form.location_id || null }
      if (editing) { await api.patch(`/appointments/${editing.id}`, payload) }
      else { await api.post('/appointments', payload) }
      setDialogOpen(false); fetchAppointments()
    } catch (e: any) {
      setFetchError(e?.response?.data?.message || 'Failed to save appointment')
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this appointment?')) return
    try {
      await api.delete(`/appointments/${id}`)
      fetchAppointments()
    } catch (e: any) {
      setFetchError(e?.response?.data?.message || 'Failed to delete appointment')
    }
  }

  const statusChip = (s: string) => {
    const m: Record<string, { color: string; bg: string }> = { scheduled: { color: '#0F4C81', bg: '#E7EEF4' }, completed: { color: '#16A34A', bg: '#DCFCE7' }, cancelled: { color: '#DC2626', bg: '#FEE2E2' }, no_show: { color: '#D97706', bg: '#FEF3C7' } }
    const c = m[s] || { color: '#6B7280', bg: '#F1F5F9' }
    return <Chip label={s} size="small" sx={{ bgcolor: c.bg, color: c.color, fontWeight: 700, fontSize: '0.7rem' }} />
  }

  if (loading) return <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress /></Box>

  return (
    <Box>
      {fetchError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFetchError('')}>{fetchError}</Alert>}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Appointments</Typography>
          <Typography color="#6B7280">Track appointments for people and staff.</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ bgcolor: '#0F4C81' }}>Add Appointment</Button>
      </Stack>

      <TextField type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} size="small" sx={{ mb: 3, width: 200 }} />

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
        <Table>
          <TableHead><TableRow sx={{ bgcolor: '#F8FAFC' }}>
            <TableCell sx={{ fontWeight: 800 }}>Title</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>Person</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>Staff</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>Time</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>Actions</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {appointments.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: '#9CA3AF' }}>No appointments for this date.</TableCell></TableRow>
            ) : appointments.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((a) => (
              <TableRow key={a.id} hover>
                <TableCell sx={{ fontWeight: 700 }}>{a.title}</TableCell>
                <TableCell>{a.service_user_name || '-'}</TableCell>
                <TableCell>{a.staff_name || '-'}</TableCell>
                <TableCell>{new Date(a.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(a.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
                <TableCell>{statusChip(a.status)}</TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => openEdit(a)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => handleDelete(a.id)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination component="div" count={appointments.length} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0) }} rowsPerPageOptions={[5, 10, 25]} />
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Appointment' : 'New Appointment'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Title" fullWidth value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <TextField label="Description" fullWidth multiline rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <FormControl fullWidth>
              <InputLabel>Person</InputLabel>
              <Select value={form.service_user_id} label="Person" onChange={e => setForm(f => ({ ...f, service_user_id: e.target.value }))}>
                <MenuItem value="">None</MenuItem>
                {serviceUsers.map(su => <MenuItem key={su.id} value={su.id}>{su.first_name} {su.last_name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Staff Member</InputLabel>
              <Select value={form.staff_id} label="Staff Member" onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}>
                <MenuItem value="">None</MenuItem>
                {staff.map((s: any) => <MenuItem key={s.staff_id || s.id} value={s.staff_id || s.id}>{s.first_name} {s.last_name}</MenuItem>)}
              </Select>
            </FormControl>
            <Stack direction="row" spacing={2}>
              <TextField label="Start" type="datetime-local" fullWidth InputLabelProps={{ shrink: true }} value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
              <TextField label="End" type="datetime-local" fullWidth InputLabelProps={{ shrink: true }} value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
            </Stack>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={form.status} label="Status" onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <MenuItem value="scheduled">Scheduled</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
                <MenuItem value="no_show">No Show</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.title || !form.start_time || !form.end_time}>{saving ? <CircularProgress size={20} /> : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
