import { useState } from 'react'
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, Chip, Stack, TextField, MenuItem, TablePagination, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, Alert, Autocomplete } from '@mui/material'
import { Add as AddIcon } from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'

const PRIORITY_COLORS: Record<string, 'error' | 'warning' | 'info' | 'default'> = { urgent: 'error', high: 'warning', medium: 'info', low: 'default' }
const STATUS_COLORS: Record<string, 'error' | 'warning' | 'success' | 'default'> = { pending: 'default', in_progress: 'warning', completed: 'success', cancelled: 'error' }

export default function TasksPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(0); const [rows, setRows] = useState(10)
  const [filter, setFilter] = useState('')
  const [dialog, setDialog] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ title: '', description: '', assigned_to: '', person_id: '', priority: 'medium', status: 'pending', due_date: '' })
  const [error, setError] = useState('')

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', filter],
    queryFn: () => api.get('/tasks', { params: { status: filter || undefined } }).then(r => r.data),
  })

  const { data: staffList } = useQuery({
    queryKey: ['staff-task'],
    queryFn: () => api.get('/staff/org-members').then(r => r.data),
  })
  const members = [...(staffList?.admins?.length ? staffList.admins : (staffList?.admin ? [staffList.admin] : [])), ...(staffList?.staff || [])].filter((m: any) => m.status === 'active')

  const { data: people } = useQuery({
    queryKey: ['su-task'],
    queryFn: () => api.get('/people?status=active').then(r => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { ...form, due_date: form.due_date || undefined, assigned_to: form.assigned_to || undefined, person_id: form.person_id || undefined }
      return editing ? api.patch(`/tasks/${editing.id}`, payload) : api.post('/tasks', payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); close() },
    onError: (e: any) => setError(e.response?.data?.message || 'Save failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const close = () => { setDialog(false); setEditing(null); setForm({ title: '', description: '', assigned_to: '', person_id: '', priority: 'medium', status: 'pending', due_date: '' }); setError('') }
  const openEdit = (t: any) => { setEditing(t); setForm({ title: t.title, description: t.description || '', assigned_to: t.assigned_to || '', person_id: t.person_id || '', priority: t.priority, status: t.status, due_date: t.due_date || '' }); setDialog(true) }
  const toggleStatus = async (t: any) => {
    const next = t.status === 'pending' ? 'in_progress' : t.status === 'in_progress' ? 'completed' : 'pending'
    await api.patch(`/tasks/${t.id}`, { status: next })
    qc.invalidateQueries({ queryKey: ['tasks'] })
  }

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /></Box>

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={800}>Task Management</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { close(); setDialog(true) }} sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
          Add Task
        </Button>
      </Stack>

      <Paper sx={{ p: 2, mb: 3, borderRadius: 2, border: '1px solid #E5E7EB' }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField select size="small" value={filter} onChange={e => { setFilter(e.target.value); setPage(0) }} label="Status" sx={{ minWidth: 160 }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="in_progress">In Progress</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
          </TextField>
          <Chip label={`${tasks.filter((t: any) => t.status === 'pending').length} pending`} size="small" color="default" />
          <Chip label={`${tasks.filter((t: any) => t.status === 'in_progress').length} in progress`} size="small" color="warning" />
          <Chip label={`${tasks.filter((t: any) => t.status === 'completed').length} done`} size="small" color="success" />
        </Stack>
      </Paper>

      <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #E5E7EB' }}>
        <Table size="small">
          <TableHead><TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Title</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Assigned To</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Person</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Priority</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Due</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {tasks.slice(page * rows, page * rows + rows).map((t: any) => (
              <TableRow key={t.id} hover>
                <TableCell sx={{ fontWeight: 600 }}>{t.title}</TableCell>
                <TableCell>{t.assigned_name || '—'}</TableCell>
                <TableCell>{t.person_name || '—'}</TableCell>
                <TableCell><Chip label={t.priority} size="small" color={PRIORITY_COLORS[t.priority] || 'default'} /></TableCell>
                <TableCell>{t.due_date ? new Date(t.due_date).toLocaleDateString('en-GB') : '—'}</TableCell>
                <TableCell>
                  <Chip label={t.status.replace(/_/g, ' ')} size="small" color={STATUS_COLORS[t.status] || 'default'}
                    onClick={() => toggleStatus(t)} sx={{ cursor: 'pointer', textTransform: 'capitalize' }} />
                </TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => openEdit(t)} sx={{ textTransform: 'none', fontSize: '0.75rem' }}>Edit</Button>
                  <Button size="small" color="error" onClick={() => { if (window.confirm('Delete task?')) deleteMutation.mutate(t.id) }} sx={{ textTransform: 'none', fontSize: '0.75rem' }}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
            {tasks.length === 0 && <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: '#9CA3AF' }}>No tasks found</TableCell></TableRow>}
          </TableBody>
        </Table>
        <TablePagination component="div" count={tasks.length} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rows} onRowsPerPageChange={e => { setRows(parseInt(e.target.value, 10)); setPage(0) }} rowsPerPageOptions={[5, 10, 25]} />
      </TableContainer>

      <Dialog open={dialog} onClose={close} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={e => { e.preventDefault(); saveMutation.mutate() }}>
          <DialogTitle sx={{ fontWeight: 800 }}>{editing ? 'Edit Task' : 'New Task'}</DialogTitle>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Title" required fullWidth value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              <TextField label="Description" multiline rows={2} fullWidth value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              <Stack direction="row" spacing={1}>
                <TextField select label="Priority" fullWidth value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  <MenuItem value="low">Low</MenuItem><MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem><MenuItem value="urgent">Urgent</MenuItem>
                </TextField>
                {editing && (
                  <TextField select label="Status" fullWidth value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    <MenuItem value="pending">Pending</MenuItem><MenuItem value="in_progress">In Progress</MenuItem>
                    <MenuItem value="completed">Completed</MenuItem><MenuItem value="cancelled">Cancelled</MenuItem>
                  </TextField>
                )}
              </Stack>
              <Autocomplete options={members} getOptionLabel={(o: any) => `${o.first_name || ''} ${o.last_name || ''}`.trim() || o.email}
                value={members.find((m: any) => m.id === form.assigned_to) || null}
                onChange={(_, v) => setForm(f => ({ ...f, assigned_to: v?.id || '' }))}
                renderInput={p => <TextField {...p} label="Assign To" />} />
              <Autocomplete options={people} getOptionLabel={(o: any) => `${o.first_name} ${o.last_name}${o.room_number ? ` (Room ${o.room_number})` : ''}`}
                value={people?.find((s: any) => s.id === form.person_id) || null}
                onChange={(_, v) => setForm(f => ({ ...f, person_id: v?.id || '' }))}
                renderInput={p => <TextField {...p} label="Related Person (optional)" />} />
              <TextField label="Due Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={close}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saveMutation.isPending} sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
              {saveMutation.isPending ? <CircularProgress size={20} /> : 'Save'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  )
}
