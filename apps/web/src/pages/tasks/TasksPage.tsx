import { useMemo, useState } from 'react'
import {
  Alert, Autocomplete, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, MenuItem, Paper, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography,
} from '@mui/material'
import { Add as AddIcon, CheckCircle as CheckCircleIcon, Visibility as VisibilityIcon } from '@mui/icons-material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'

const NAVY = '#0F4C81'
const PRIORITY_COLORS: Record<string, 'error' | 'warning' | 'info' | 'default'> = { urgent: 'error', high: 'warning', medium: 'info', low: 'default' }
const STATUS_COLORS: Record<string, 'error' | 'warning' | 'success' | 'default'> = { pending: 'default', in_progress: 'warning', completed: 'success', cancelled: 'error' }
const RECURRENCE_LABELS: Record<string, string> = { once: 'Once', daily: 'Daily', monthly: 'Monthly', yearly: 'Yearly' }

const EMPTY_FORM = { title: '', description: '', notes: '', assigned_to: '', person_id: '', recurrence: 'once', priority: 'medium', status: 'pending', due_date: '' }

function asArray(value: any, keys: string[] = []) {
  if (Array.isArray(value)) return value
  for (const key of keys) if (Array.isArray(value?.[key])) return value[key]
  return Array.isArray(value?.data) ? value.data : []
}

export default function TasksPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState(10)
  const [filter, setFilter] = useState('')
  const [dialog, setDialog] = useState(false)
  const [viewDialog, setViewDialog] = useState(false)
  const [calendarDate, setCalendarDate] = useState(new Date().toISOString().slice(0, 10))
  const [completionDialog, setCompletionDialog] = useState(false)
  const [completionNotes, setCompletionNotes] = useState('')
  const [editing, setEditing] = useState<any>(null)
  const [viewing, setViewing] = useState<any>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')

  const { data: taskData, isLoading } = useQuery({
    queryKey: ['tasks', filter],
    queryFn: () => api.get('/tasks', { params: { status: filter || undefined } }).then(r => r.data),
  })
  const tasks = asArray(taskData, ['tasks'])

  const { data: staffData } = useQuery({ queryKey: ['staff-task'], queryFn: () => api.get('/staff/org-members').then(r => r.data) })
  const members = useMemo(() => {
    const raw = Array.isArray(staffData)
      ? staffData
      : [...(Array.isArray(staffData?.admins) ? staffData.admins : []), ...(Array.isArray(staffData?.staff) ? staffData.staff : [])]
    return raw.filter((m: any) => m.status === 'active').map((m: any) => ({ ...m, profileId: m.staff_id || m.id }))
  }, [staffData])
  const { data: peopleData } = useQuery({ queryKey: ['people-task'], queryFn: () => api.get('/people?status=active').then(r => r.data) })
  const people = asArray(peopleData, ['people'])

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { ...form, due_date: form.due_date || undefined, assigned_to: form.assigned_to || undefined, person_id: form.person_id || undefined }
      return editing ? api.patch(`/tasks/${editing.id}`, payload) : api.post('/tasks', payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); closeDialog() },
    onError: (e: any) => setError(e.response?.data?.message || 'Could not save task'),
  })
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/tasks/${id}`, { status }),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['tasks'] }); if (viewing?.id === vars.id) setViewing((v: any) => ({ ...v, status: vars.status })) },
    onError: (e: any) => setError(e.response?.data?.message || 'Could not update task'),
  })
  const deleteMutation = useMutation({ mutationFn: (id: string) => api.delete(`/tasks/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); setViewDialog(false) } })

  function closeDialog() { setDialog(false); setEditing(null); setForm(EMPTY_FORM); setError('') }
  function openCreate() { setEditing(null); setForm(EMPTY_FORM); setError(''); setDialog(true) }
  function openEdit(task: any) {
    setEditing(task)
    setForm({ title: task.title || '', description: task.description || '', notes: task.notes || '', assigned_to: task.assigned_to || '', person_id: task.person_id || '', recurrence: task.recurrence || 'once', priority: task.priority || 'medium', status: task.status || 'pending', due_date: task.due_date?.split('T')[0] || '' })
    setError(''); setDialog(true)
  }
  function openView(task: any) { setViewing(task); setViewDialog(true) }
  function openCompletion(task: any) { setViewing(task); setCompletionNotes(''); setCompletionDialog(true) }
  const pending = tasks.filter((t: any) => t.status === 'pending').length
  const inProgress = tasks.filter((t: any) => t.status === 'in_progress').length
  const completed = tasks.filter((t: any) => t.status === 'completed').length
  const calendarTasks = tasks.filter((task: any) => (task.due_date || '').slice(0, 10) === calendarDate)

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress sx={{ color: NAVY }} /></Box>

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box><Typography variant="h5" fontWeight={800}>Tasks</Typography><Typography variant="body2" color="text.secondary">Keep recurring and one-off work visible, owned, and closed.</Typography></Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 700 }}>Add task</Button>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        {[['Pending', pending], ['In progress', inProgress], ['Completed', completed]].map(([label, value]) => (
          <Paper key={String(label)} sx={{ px: 2, py: 1.5, flex: 1, border: '1px solid #E5E7EB', borderRadius: 2 }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="h6" fontWeight={800}>{value}</Typography></Paper>
        ))}
      </Stack>

      <Paper sx={{ p: 1.5, mb: 2, border: '1px solid #E5E7EB', borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
          <TextField type="date" size="small" label="Calendar day" InputLabelProps={{ shrink: true }} value={calendarDate} onChange={e => setCalendarDate(e.target.value)} />
          <Typography variant="body2" color="text.secondary">{calendarTasks.length} task{calendarTasks.length === 1 ? '' : 's'} due on this day</Typography>
          <Box sx={{ flex: 1 }} />
          <TextField select size="small" label="Status" value={filter} onChange={e => { setFilter(e.target.value); setPage(0) }} sx={{ minWidth: 170 }}>
            <MenuItem value="">All tasks</MenuItem><MenuItem value="pending">Pending</MenuItem><MenuItem value="in_progress">In progress</MenuItem><MenuItem value="completed">Completed</MenuItem><MenuItem value="cancelled">Cancelled</MenuItem>
          </TextField>
        </Stack>
      </Paper>
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2, borderColor: '#E5E7EB' }}>
        <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>Daily task calendar</Typography>
        {calendarTasks.length === 0 ? <Typography variant="body2" color="text.secondary">Nothing is scheduled for this day.</Typography> : <Stack spacing={1}>{calendarTasks.map((task: any) => <Paper key={task.id} variant="outlined" onClick={() => openView(task)} sx={{ p: 1.25, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1, '&:hover': { borderColor: NAVY } }}><Box sx={{ flex: 1 }}><Typography fontWeight={700}>{task.title}</Typography><Typography variant="caption" color="text.secondary">{task.assigned_name || 'Unassigned'} · {RECURRENCE_LABELS[task.recurrence] || 'Once'}</Typography></Box><Chip size="small" label={task.status === 'completed' ? 'Completed' : 'Mark complete'} color={task.status === 'completed' ? 'success' : 'default'} onClick={e => { e.stopPropagation(); if (task.status !== 'completed') openCompletion(task) }} /></Paper>)}</Stack>}
      </Paper>

      <TableContainer component={Paper} sx={{ border: '1px solid #E5E7EB', borderRadius: 2 }}>
        <Table size="small">
          <TableHead><TableRow>{['Task', 'For', 'Owner', 'Cadence', 'Due', 'Status', ''].map(h => <TableCell key={h} sx={{ fontWeight: 800, color: 'text.secondary' }}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {tasks.slice(page * rows, page * rows + rows).map((task: any) => (
              <TableRow key={task.id} hover onClick={() => openView(task)} sx={{ cursor: 'pointer' }}>
                <TableCell><Typography fontWeight={700}>{task.title}</Typography>{task.description && <Typography variant="caption" color="text.secondary" noWrap>{task.description}</Typography>}</TableCell>
                <TableCell>{task.person_name || 'House / team'}</TableCell><TableCell>{task.assigned_name || 'Unassigned'}</TableCell>
                <TableCell><Chip size="small" label={RECURRENCE_LABELS[task.recurrence] || task.recurrence || 'Once'} variant="outlined" /></TableCell>
                <TableCell>{task.due_date ? new Date(task.due_date).toLocaleDateString('en-GB') : '—'}</TableCell>
                <TableCell><Chip size="small" label={(task.status || 'pending').replace(/_/g, ' ')} color={STATUS_COLORS[task.status] || 'default'} sx={{ textTransform: 'capitalize' }} /></TableCell>
                <TableCell align="right" onClick={e => e.stopPropagation()}><Button size="small" startIcon={<VisibilityIcon />} onClick={() => openView(task)} sx={{ textTransform: 'none' }}>View</Button></TableCell>
              </TableRow>
            ))}
            {tasks.length === 0 && <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6, color: '#9CA3AF' }}>No tasks match this view.</TableCell></TableRow>}
          </TableBody>
        </Table>
        <TablePagination component="div" count={tasks.length} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rows} onRowsPerPageChange={e => { setRows(parseInt(e.target.value, 10)); setPage(0) }} rowsPerPageOptions={[5, 10, 25]} />
      </TableContainer>

      <Dialog open={viewDialog} onClose={() => setViewDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>{viewing?.title}</DialogTitle>
        <DialogContent>
          {viewing && <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={1} flexWrap="wrap"><Chip label={viewing.status?.replace(/_/g, ' ')} color={STATUS_COLORS[viewing.status] || 'default'} sx={{ textTransform: 'capitalize' }} /><Chip label={viewing.priority} color={PRIORITY_COLORS[viewing.priority] || 'default'} /><Chip label={RECURRENCE_LABELS[viewing.recurrence] || 'Once'} variant="outlined" /></Stack>
            <Divider />
            <Stack spacing={1}><Typography variant="caption" color="text.secondary">Description</Typography><Typography sx={{ whiteSpace: 'pre-wrap' }}>{viewing.description || 'No description recorded.'}</Typography></Stack>
            <Stack spacing={1}><Typography variant="caption" color="text.secondary">Notes</Typography><Typography sx={{ whiteSpace: 'pre-wrap' }}>{viewing.notes || 'No notes recorded.'}</Typography></Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}><Typography variant="body2"><strong>For:</strong> {viewing.person_name || 'House / team'}</Typography><Typography variant="body2"><strong>Owner:</strong> {viewing.assigned_name || 'Unassigned'}</Typography><Typography variant="body2"><strong>Due:</strong> {viewing.due_date ? new Date(viewing.due_date).toLocaleDateString('en-GB') : 'No due date'}</Typography></Stack>
          </Stack>}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}><Button onClick={() => setViewDialog(false)}>Close</Button>{viewing && viewing.status !== 'completed' && viewing.status !== 'cancelled' && <Button variant="contained" startIcon={<CheckCircleIcon />} onClick={() => openCompletion(viewing)} sx={{ bgcolor: '#15803D', textTransform: 'none' }}>Mark complete</Button>}<Button onClick={() => { setViewDialog(false); openEdit(viewing) }} sx={{ textTransform: 'none' }}>Edit</Button>{viewing && <Button color="error" onClick={() => { if (window.confirm('Delete this task?')) deleteMutation.mutate(viewing.id) }} sx={{ textTransform: 'none' }}>Delete</Button>}</DialogActions>
      </Dialog>

      <Dialog open={completionDialog} onClose={() => setCompletionDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Complete task</DialogTitle>
        <DialogContent><Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Record what was done for {viewing?.title || 'this task'}.</Typography><TextField label="Completion details" multiline rows={4} fullWidth placeholder="What was completed, observed, or handed over?" value={completionNotes} onChange={e => setCompletionNotes(e.target.value)} /></DialogContent>
        <DialogActions><Button onClick={() => setCompletionDialog(false)}>Cancel</Button><Button variant="contained" disabled={statusMutation.isPending} onClick={() => { statusMutation.mutate({ id: viewing.id, status: 'completed' }); setCompletionDialog(false); setViewDialog(false) }} sx={{ bgcolor: '#15803D' }}>Save completion</Button></DialogActions>
      </Dialog>

      <Dialog open={dialog} onClose={closeDialog} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={e => { e.preventDefault(); saveMutation.mutate() }}><DialogTitle sx={{ fontWeight: 800 }}>{editing ? 'Edit task' : 'New task'}</DialogTitle><DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Title" required fullWidth value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <TextField label="Description" fullWidth multiline rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <TextField label="Notes" fullWidth multiline rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField select label="Cadence" fullWidth value={form.recurrence} onChange={e => setForm(f => ({ ...f, recurrence: e.target.value }))}>{Object.entries(RECURRENCE_LABELS).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}</TextField><TextField select label="Priority" fullWidth value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}><MenuItem value="low">Low</MenuItem><MenuItem value="medium">Medium</MenuItem><MenuItem value="high">High</MenuItem><MenuItem value="urgent">Urgent</MenuItem></TextField></Stack>
            {editing && <TextField select label="Status" fullWidth value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}><MenuItem value="pending">Pending</MenuItem><MenuItem value="in_progress">In progress</MenuItem><MenuItem value="completed">Completed</MenuItem><MenuItem value="cancelled">Cancelled</MenuItem></TextField>}
            <Autocomplete options={members} getOptionLabel={(m: any) => `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email} value={members.find((m: any) => m.profileId === form.assigned_to) || null} onChange={(_, v) => setForm(f => ({ ...f, assigned_to: v?.profileId || '' }))} renderInput={p => <TextField {...p} label="Owner" placeholder="Assign to a staff member" />} />
            <Autocomplete options={people} getOptionLabel={(p: any) => `${p.first_name || ''} ${p.last_name || ''}${p.room_number ? ` (Room ${p.room_number})` : ''}`} value={people.find((p: any) => p.id === form.person_id) || null} onChange={(_, v) => setForm(f => ({ ...f, person_id: v?.id || '' }))} renderInput={p => <TextField {...p} label="For person (optional)" />} />
            <TextField label="Due date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
          </Stack>
        </DialogContent><DialogActions sx={{ p: 2.5 }}><Button onClick={closeDialog}>Cancel</Button><Button type="submit" variant="contained" disabled={saveMutation.isPending} sx={{ bgcolor: NAVY, textTransform: 'none' }}>{saveMutation.isPending ? <CircularProgress size={20} /> : 'Save task'}</Button></DialogActions></Box>
      </Dialog>
    </Box>
  )
}
