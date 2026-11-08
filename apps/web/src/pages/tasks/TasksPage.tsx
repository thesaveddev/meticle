import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert, Autocomplete, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, MenuItem, Paper, Stack, Tab, Table, TableBody,
  TableCell, TableContainer, TableHead, TablePagination, TableRow, Tabs, TextField, Typography,
} from '@mui/material'
import PageContainer from '../../components/design/PageContainer'
import {
  Add as AddIcon, AssignmentTurnedIn as AssignmentIcon, CheckCircle as CheckCircleIcon, Warning as WarningIcon,
  AccessTime as ClockIcon, TrendingUp as TrendIcon, CalendarMonth as CalendarIcon,
} from '@mui/icons-material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { MICA_RECORD_PARAMS } from '@meticle/shared'
import api from '../../services/api'
import { localDate } from '../../utils/dateFormat'
import { useSnackbar } from '../../context/SnackbarContext'
import { PillOptions } from '../people/dialogHeader'

const NAVY = '#0164C8'
const PRIORITY_COLORS: Record<string, 'error' | 'warning' | 'info' | 'default'> = { urgent: 'error', high: 'warning', medium: 'info', low: 'default' }
const STATUS_COLORS: Record<string, 'error' | 'warning' | 'success' | 'default'> = { pending: 'default', in_progress: 'warning', completed: 'success', cancelled: 'error' }
const RECURRENCE_LABELS: Record<string, string> = { once: 'Once', daily: 'Daily', monthly: 'Monthly', yearly: 'Yearly' }

const EMPTY_FORM = { title: '', description: '', notes: '', assigned_to: '', person_id: '', recurrence: 'once', priority: 'medium', status: 'pending', due_date: '' }

function asArray(value: any, keys: string[] = []) {
  if (Array.isArray(value)) return value
  for (const key of keys) if (Array.isArray(value?.[key])) return value[key]
  return Array.isArray(value?.data) ? value.data : []
}

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function dueLabel(task: any, todayStr: string): { text: string; overdueDays: number } {
  const due = (task.due_date || '').slice(0, 10)
  if (!due) return { text: 'No due date', overdueDays: 0 }
  if (due === todayStr) return { text: 'Today', overdueDays: 0 }
  const t = new Date(`${todayStr}T00:00:00`).getTime()
  const d = new Date(`${due}T00:00:00`).getTime()
  const diff = Math.round((t - d) / 86400000)
  if (diff === -1) return { text: 'Tomorrow', overdueDays: 0 }
  if (diff < 0) return { text: new Date(`${due}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), overdueDays: 0 }
  return {
    text: diff === 1 ? '1 day overdue' : `${diff} days overdue`,
    overdueDays: diff,
  }
}

/** Figma 7.2 task dialog header: blue TASKS eyebrow, title, optional subtitle, blue Close text. */
function TaskDialogHeader({ title, subtitle, onClose }: { title: string; subtitle?: string; onClose: () => void }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, px: 3, pt: 2.5, pb: 1 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: NAVY, fontWeight: 700, letterSpacing: '0.08em' }}>TASKS</Typography>
        <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.25 }}>{title}</Typography>
        {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{subtitle}</Typography>}
      </Box>
      <Button onClick={onClose} sx={{ color: NAVY, textTransform: 'none' }}>Close</Button>
    </Box>
  )
}

/** "Monthly · next on 3 Dec" — the next occurrence after the due date, for repeating tasks. */
function nextDueLabel(due: string, recurrence: string): string | null {
  if (!due || !recurrence || recurrence === 'once') return null
  const d = new Date(`${due.slice(0, 10)}T00:00:00`)
  if (recurrence === 'daily') d.setDate(d.getDate() + 1)
  else if (recurrence === 'monthly') d.setMonth(d.getMonth() + 1)
  else if (recurrence === 'yearly') d.setFullYear(d.getFullYear() + 1)
  else return null
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function TasksPage() {
  const qc = useQueryClient()
  const { showSnackbar } = useSnackbar()
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState(10)
  const [tab, setTab] = useState('all')
  const [view, setView] = useState<'list' | 'day'>('list')
  const [locationFilter, setLocationFilter] = useState('')
  const [dialog, setDialog] = useState(false)
  const [viewDialog, setViewDialog] = useState(false)
  const [calendarDate, setCalendarDate] = useState(localDate())
  const [completionDialog, setCompletionDialog] = useState(false)
  const [completionNotes, setCompletionNotes] = useState('')
  const [editing, setEditing] = useState<any>(null)
  const [viewing, setViewing] = useState<any>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [formErrors, setFormErrors] = useState<{ title?: string; owner?: string }>({})
  const [origDue, setOrigDue] = useState('')
  const [deleteDialog, setDeleteDialog] = useState(false)
  // The deep link a Mica write ends on: `?task=<id>`, the task it just created.
  const [searchParams, setSearchParams] = useSearchParams()
  const linkedTaskId = searchParams.get(MICA_RECORD_PARAMS.task)
  const openedLinkedTaskRef = useRef<string | null>(null)

  const todayStr = useMemo(() => localDate(), [])

  const { data: taskData, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.get('/tasks').then(r => r.data),
  })
  const allTasks = asArray(taskData, ['tasks'])

  // Opens the one task a deep link names, through the same read-only dialog the
  // table rows open — the row is not on screen to be clicked when the link
  // arrives, and the list on screen is filtered, so the link is followed by id
  // rather than by looking for the row in it. Guarded by the id, so a refetch
  // (or a second render) cannot re-open a dialog the carer has closed.
  useEffect(() => {
    if (!linkedTaskId || openedLinkedTaskRef.current === linkedTaskId) return
    const loaded = allTasks.find((t: any) => t.id === linkedTaskId)
    if (loaded) { openedLinkedTaskRef.current = linkedTaskId; openView(loaded); return }
    if (isLoading) return
    openedLinkedTaskRef.current = linkedTaskId
    api.get(`/tasks/${linkedTaskId}`)
      .then(r => { const task = r.data?.task || r.data; if (task?.id) openView(task) })
      .catch(() => { /* the link named a task this caller cannot read: nothing to open */ })
  }, [linkedTaskId, allTasks, isLoading])

  const { data: staffData } = useQuery({ queryKey: ['staff-task'], queryFn: () => api.get('/staff/org-members').then(r => r.data) })
  const members = useMemo(() => {
    const raw = Array.isArray(staffData)
      ? staffData
      : [...(Array.isArray(staffData?.admins) ? staffData.admins : []), ...(Array.isArray(staffData?.staff) ? staffData.staff : [])]
    return raw.filter((m: any) => m.status === 'active').map((m: any) => ({ ...m, profileId: m.staff_id || m.id }))
  }, [staffData])
  const { data: peopleData } = useQuery({ queryKey: ['people-task'], queryFn: () => api.get('/people?status=active').then(r => r.data) })
  const people = asArray(peopleData, ['people'])
  const { data: locationsData } = useQuery({ queryKey: ['task-locations'], queryFn: () => api.get('/settings/locations').then(r => r.data) })
  const locations = asArray(locationsData, ['locations'])

  const personLocation = useMemo(() => {
    const map: Record<string, string> = {}
    people.forEach((p: any) => { if (p.id && p.location_id) map[p.id] = p.location_id })
    return map
  }, [people])

  const inLocation = (t: any) => !locationFilter || !t.person_id || personLocation[t.person_id] === locationFilter
  const scoped = useMemo(() => allTasks.filter(inLocation), [allTasks, locationFilter, personLocation])

  const isOpen = (t: any) => t.status !== 'completed' && t.status !== 'cancelled'
  const overdue = useMemo(() => scoped.filter((t: any) => isOpen(t) && (t.due_date || '').slice(0, 10) && (t.due_date || '').slice(0, 10) < todayStr)
    .sort((a: any, b: any) => (a.due_date || '').localeCompare(b.due_date || '')), [scoped, todayStr])
  const pending = scoped.filter((t: any) => t.status === 'pending').length
  const inProgressCount = scoped.filter((t: any) => t.status === 'in_progress').length
  const completedCount = scoped.filter((t: any) => t.status === 'completed').length
  const cancelledCount = scoped.filter((t: any) => t.status === 'cancelled').length
  const dueToday = scoped.filter((t: any) => isOpen(t) && (t.due_date || '').slice(0, 10) === todayStr)
  const weekAgo = useMemo(() => { const d = new Date(`${todayStr}T00:00:00`); d.setDate(d.getDate() - 7); return dayKey(d) }, [todayStr])
  const completedThisWeek = scoped.filter((t: any) => t.status === 'completed' && (t.completed_at || '').slice(0, 10) >= weekAgo)
  const oldestOverdue = overdue[0]
  const oldestDays = oldestOverdue ? dueLabel(oldestOverdue, todayStr).overdueDays : 0

  const sorted = useMemo(() => [...scoped].sort((a: any, b: any) => {
    const ad = (a.due_date || '').slice(0, 10) || '9999'
    const bd = (b.due_date || '').slice(0, 10) || '9999'
    return ad.localeCompare(bd)
  }), [scoped])

  const tabTasks = useMemo(() => {
    if (tab === 'overdue') return overdue
    if (tab === 'all') return sorted
    return sorted.filter((t: any) => t.status === tab)
  }, [tab, overdue, sorted])

  const dayTasks = useMemo(() => {
    const due = sorted.filter((t: any) => (t.due_date || '').slice(0, 10) === calendarDate)
    const carried = calendarDate === todayStr ? overdue.filter((t: any) => (t.due_date || '').slice(0, 10) !== calendarDate) : []
    return [...carried, ...due]
  }, [sorted, overdue, calendarDate, todayStr])
  const doneToday = useMemo(() => scoped.filter((t: any) => (t.completed_at || '').slice(0, 10) === todayStr), [scoped, todayStr])

  const weekDays = useMemo(() => {
    const base = new Date(`${calendarDate}T00:00:00`)
    const monday = new Date(base)
    monday.setDate(base.getDate() - ((base.getDay() + 6) % 7))
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const key = dayKey(d)
      const due = scoped.filter((t: any) => isOpen(t) && (t.due_date || '').slice(0, 10) === key)
      return { key, date: d, due }
    })
  }, [calendarDate, scoped])

  const viewingOverdue = !!viewing && viewing.status !== 'completed' && viewing.status !== 'cancelled' && dueLabel(viewing, todayStr).overdueDays > 0
  const viewingNext = viewing ? nextDueLabel(viewing.due_date || '', viewing.recurrence) : null

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { ...form, due_date: form.due_date || undefined, assigned_to: form.assigned_to || undefined, person_id: form.person_id || undefined }
      return editing ? api.patch(`/tasks/${editing.id}`, payload) : api.post('/tasks', payload)
    },
    onSuccess: () => {
      const wasEdit = !!editing
      qc.invalidateQueries({ queryKey: ['tasks'] }); closeDialog()
      showSnackbar('', 'success', wasEdit ? 'Task updated' : 'Task added')
    },
    onError: (e: any) => setError(e.response?.data?.message || 'Could not save task'),
  })
  const statusMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) => api.patch(`/tasks/${id}`, notes ? { status, notes } : { status }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      if (viewing?.id === vars.id) setViewing((v: any) => ({ ...v, status: vars.status }))
      const toast = vars.status === 'completed' ? 'Task completed'
        : vars.status === 'in_progress' ? 'Task started'
        : vars.status === 'cancelled' ? 'Task cancelled'
        : vars.status === 'pending' ? 'Task reopened' : null
      if (toast) showSnackbar('', 'success', toast)
    },
    onError: (e: any) => setError(e.response?.data?.message || 'Could not update task'),
  })
  const deleteMutation = useMutation({ mutationFn: (id: string) => api.delete(`/tasks/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); setDeleteDialog(false); closeViewDialog(); showSnackbar('', 'success', 'Task deleted') } })

  function closeDialog() { setDialog(false); setEditing(null); setForm(EMPTY_FORM); setError(''); setFormErrors({}); setOrigDue('') }
  function openCreate(presetDue?: string) { setEditing(null); setForm({ ...EMPTY_FORM, due_date: presetDue || '' }); setError(''); setFormErrors({}); setOrigDue(''); setDialog(true) }
  function openEdit(task: any) {
    setEditing(task)
    setForm({ title: task.title || '', description: task.description || '', notes: task.notes || '', assigned_to: task.assigned_to || '', person_id: task.person_id || '', recurrence: task.recurrence || 'once', priority: task.priority || 'medium', status: task.status || 'pending', due_date: task.due_date?.split('T')[0] || '' })
    setError(''); setFormErrors({}); setOrigDue(task.due_date?.split('T')[0] || ''); setDialog(true)
  }
  function openView(task: any) { setViewing(task); setViewDialog(true) }
  // Closing the record also drops its link, so a reload or a later render cannot
  // put the carer back in a dialog they just closed.
  function closeViewDialog() { setViewDialog(false); if (linkedTaskId) setSearchParams({}, { replace: true }) }
  function openCompletion(task: any) { setViewing(task); setCompletionNotes(''); setCompletionDialog(true) }
  const ownerFirstName = (members.find((m: any) => m.profileId === form.assigned_to)?.first_name || '').trim()
  // Figma 7.2: a title and an owner are required — otherwise a banner names what is
  // missing, the fields say what they need, and everything entered stays put.
  function trySave() {
    const errs: { title?: string; owner?: string } = {}
    if (!form.title.trim()) errs.title = 'Give the task a short title, like "Check fire extinguishers".'
    if (!form.assigned_to) errs.owner = 'Choose who will do this.'
    setFormErrors(errs)
    if (Object.keys(errs).length > 0) return
    saveMutation.mutate()
  }

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress sx={{ color: NAVY }} /></Box>

  const tabs: { value: string; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: scoped.length },
    { value: 'overdue', label: 'Overdue', count: overdue.length },
    { value: 'pending', label: 'Pending', count: pending },
    { value: 'in_progress', label: 'In progress', count: inProgressCount },
    { value: 'completed', label: 'Completed', count: completedCount },
    { value: 'cancelled', label: 'Cancelled', count: cancelledCount },
  ]

  const metricCards = [
    { label: 'Overdue', value: overdue.length, sub: overdue.length > 0 ? `Oldest is ${oldestDays} day${oldestDays === 1 ? '' : 's'} late` : 'Nothing past due', icon: <WarningIcon fontSize="small" />, color: '#B42318', bg: '#FEF0F0' },
    { label: 'Due today', value: dueToday.length, sub: dueToday[0]?.title || 'Nothing due today', icon: <ClockIcon fontSize="small" />, color: NAVY, bg: '#EAF3FF' },
    { label: 'In progress', value: inProgressCount, sub: sorted.find((t: any) => t.status === 'in_progress')?.title || 'Nothing underway', icon: <TrendIcon fontSize="small" />, color: '#9A6700', bg: '#FFF7E6' },
    { label: 'Completed this week', value: completedThisWeek.length, sub: 'Nice steady progress', icon: <CheckCircleIcon fontSize="small" />, color: '#087A55', bg: '#EAFBF5' },
  ]

  return (
    <PageContainer>

      <Typography variant="caption" sx={{ color: NAVY, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        Communication / Tasks{view === 'day' ? ' / Day view' : ''}
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={2} sx={{ mb: 2, mt: 0.5 }}>
        <Box><Typography variant="h5" fontWeight={600}>{view === 'day' ? 'Day view' : 'Tasks'}</Typography><Typography variant="body2" color="text.secondary">{view === 'day' ? 'Everything due on one day, so the shift lead can plan the handover.' : 'Keep recurring and one-off work visible, owned and closed.'}</Typography></Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          {locations.length > 0 && (
            <TextField select size="small" value={locationFilter} onChange={e => { setLocationFilter(e.target.value); setPage(0) }} sx={{ minWidth: 140 }} aria-label="Location">
              <MenuItem value="">All locations</MenuItem>
              {locations.map((l: any) => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
            </TextField>
          )}
          <Stack direction="row" spacing={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
            {(['list', 'day'] as const).map(v => (
              <Button key={v} size="small" onClick={() => setView(v)} variant={view === v ? 'contained' : 'text'}
                sx={{ borderRadius: 0, textTransform: 'none', bgcolor: view === v ? NAVY : 'transparent' }}>
                {v === 'list' ? 'List view' : 'Day view'}
              </Button>
            ))}
          </Stack>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openCreate()} sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 600 }}>Add task</Button>
        </Stack>
      </Stack>

      {view === 'list' && (<>
        {overdue.length > 0 && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2, bgcolor: '#FEF0F0', border: '1px solid', borderColor: 'error.light' }}
            action={<Button size="small" variant="outlined" color="error" onClick={() => { setTab('overdue'); setPage(0) }} sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}>Show overdue</Button>}>
            <Typography variant="subtitle2" fontWeight={700}>{overdue.length} task{overdue.length === 1 ? ' is' : 's are'} overdue</Typography>
            <Typography variant="body2">{oldestOverdue.title} has been waiting {oldestDays} day{oldestDays === 1 ? '' : 's'}. A quick reassign or a new due date keeps everyone clear on what&apos;s next.</Typography>
          </Alert>
        )}

        <Tabs value={tab} onChange={(_, v) => { setTab(v); setPage(0) }} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          {tabs.map(t => <Tab key={t.value} value={t.value} label={`${t.label} ${t.count}`} sx={{ textTransform: 'none', fontWeight: tab === t.value ? 700 : 500 }} />)}
        </Tabs>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
          {metricCards.map(c => (
            <Paper key={c.label} sx={{ px: 2, py: 1.5, flex: 1, border: '1px solid', borderColor: '#E3E9F0', borderRadius: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: c.bg, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{c.icon}</Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                  <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1 }}>{c.value}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: '100%' }}>{c.sub}</Typography>
                </Box>
              </Stack>
            </Paper>
          ))}
        </Stack>

        {(tab === 'cancelled' && tabTasks.length === 0) ? (
          <Paper sx={{ py: 8, px: 3, textAlign: 'center', border: '1px solid', borderColor: '#E3E9F0', borderRadius: 2 }}>
            <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: '#EAF3FF', color: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
              <CheckCircleIcon />
            </Box>
            <Typography variant="h6" fontWeight={700}>No cancelled tasks</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Tasks you cancel will appear here, so there&apos;s always a record of what was stopped and why.</Typography>
            <Button variant="outlined" onClick={() => setTab('all')} sx={{ textTransform: 'none' }}>View all tasks</Button>
          </Paper>
        ) : (<>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700} sx={{ textTransform: 'capitalize' }}>{tab === 'all' ? 'All tasks' : tab.replace(/_/g, ' ')}</Typography>
              <Typography variant="caption" color="text.secondary">{tab === 'overdue' ? 'Past due date and not finished' : `${tabTasks.length} task${tabTasks.length === 1 ? '' : 's'} · sorted by due date`}</Typography>
            </Box>
          </Stack>

          <TableContainer component={Paper} sx={{ border: '1px solid', borderColor: '#E3E9F0', borderRadius: 2 }}>
            <Table size="small">
              <TableHead><TableRow>{['Task', 'For', 'Owner', 'Repeats', 'Priority', 'Due', 'Status'].map(h => <TableCell key={h} sx={{ fontWeight: 600, color: 'text.secondary' }}>{h}</TableCell>)}</TableRow></TableHead>
              <TableBody>
                {tabTasks.slice(page * rows, page * rows + rows).map((task: any) => {
                  const dl = dueLabel(task, todayStr)
                  const isOverdue = dl.overdueDays > 0
                  return (
                    <TableRow key={task.id} hover onClick={() => openView(task)} sx={{ cursor: 'pointer' }}>
                      <TableCell><Typography fontWeight={600}>{task.title}</Typography>{task.description && <Typography variant="caption" color="text.secondary" noWrap>{task.description}</Typography>}</TableCell>
                      <TableCell>{task.person_name || 'House / team'}</TableCell>
                      <TableCell>{task.assigned_name || 'Unassigned'}</TableCell>
                      <TableCell><Chip size="small" label={RECURRENCE_LABELS[task.recurrence] || task.recurrence || 'Once'} variant="outlined" /></TableCell>
                      <TableCell><Chip size="small" label={(task.priority || 'medium').replace(/_/g, ' ')} color={PRIORITY_COLORS[task.priority] || 'default'} sx={{ textTransform: 'capitalize' }} /></TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={isOverdue ? 700 : 400} color={isOverdue ? 'error' : 'inherit'}>{dl.text}</Typography>
                        {!isOverdue && task.due_date && <Typography variant="caption" color="text.secondary">{new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Typography>}
                      </TableCell>
                      <TableCell><Chip size="small" label={(task.status || 'pending').replace(/_/g, ' ')} color={isOverdue ? 'error' : STATUS_COLORS[task.status] || 'default'} sx={{ textTransform: 'capitalize' }} /></TableCell>
                    </TableRow>
                  )
                })}
                {tabTasks.length === 0 && <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>No tasks match this view.</TableCell></TableRow>}
              </TableBody>
            </Table>
            <TablePagination component="div" count={tabTasks.length} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rows} onRowsPerPageChange={e => { setRows(parseInt(e.target.value, 10)); setPage(0) }} rowsPerPageOptions={[5, 10, 25]} />
          </TableContainer>

          {tab === 'overdue' && overdue.length > 0 && (
            <Paper sx={{ p: 2.5, mt: 2, border: '1px solid', borderColor: '#E3E9F0', borderRadius: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>What helps</Typography>
              <Typography variant="body2" color="text.secondary">Open a task to change its due date, give it to someone else, or mark it complete. Owners get a gentle reminder each morning while a task is overdue.</Typography>
            </Paper>
          )}
        </>)}
      </>)}

      {view === 'day' && (
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="flex-start">
          <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
              <Paper sx={{ px: 2, py: 1.5, flex: 1, border: '1px solid', borderColor: '#E3E9F0', borderRadius: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: '#EAF3FF', color: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ClockIcon fontSize="small" /></Box>
                  <Box><Typography variant="caption" color="text.secondary">Due today</Typography><Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1 }}>{dueToday.length}</Typography></Box>
                </Stack>
              </Paper>
              <Paper sx={{ px: 2, py: 1.5, flex: 1, border: '1px solid', borderColor: '#E3E9F0', borderRadius: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: '#FEF0F0', color: '#B42318', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><WarningIcon fontSize="small" /></Box>
                  <Box><Typography variant="caption" color="text.secondary">Overdue</Typography><Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1 }}>{overdue.length}</Typography></Box>
                </Stack>
              </Paper>
              <Paper sx={{ px: 2, py: 1.5, flex: 1, border: '1px solid', borderColor: '#E3E9F0', borderRadius: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: '#EAFBF5', color: '#087A55', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircleIcon fontSize="small" /></Box>
                  <Box><Typography variant="caption" color="text.secondary">Done today</Typography><Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1 }}>{doneToday.length}</Typography></Box>
                </Stack>
              </Paper>
              <TextField type="date" size="small" label="Day" InputLabelProps={{ shrink: true }} value={calendarDate} onChange={e => setCalendarDate(e.target.value)} sx={{ minWidth: 170 }} />
            </Stack>

            <Typography variant="subtitle1" fontWeight={700}>
              Due on {new Date(`${calendarDate}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              {calendarDate === todayStr && overdue.length > 0 ? `Including ${overdue.length} overdue task${overdue.length === 1 ? '' : 's'} carried over` : `${dayTasks.length} task${dayTasks.length === 1 ? '' : 's'} on this day`}
            </Typography>

            {dayTasks.length === 0 ? (
              <Paper sx={{ py: 6, px: 3, textAlign: 'center', border: '1px solid', borderColor: '#E3E9F0', borderRadius: 2 }}>
                <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: '#EAF3FF', color: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                  <CalendarIcon />
                </Box>
                <Typography variant="h6" fontWeight={700}>Nothing is due on this day</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>A quiet day for tasks. You can add one, or pick another day from the week.</Typography>
                <Button variant="contained" onClick={() => openCreate(calendarDate)} sx={{ bgcolor: NAVY, textTransform: 'none' }}>Add task for this day</Button>
              </Paper>
            ) : (
              <Stack spacing={1.5}>
                {dayTasks.map((task: any) => {
                  const dl = dueLabel(task, todayStr)
                  const isOverdue = dl.overdueDays > 0
                  const done = task.status === 'completed'
                  return (
                    <Paper key={task.id} onClick={() => openView(task)}
                      sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: isOverdue ? 'error.light' : '#E3E9F0', cursor: 'pointer', '&:hover': { borderColor: NAVY } }}>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                            <Typography fontWeight={600}>{task.title}</Typography>
                            {done
                              ? <CheckCircleIcon fontSize="small" sx={{ color: '#087A55' }} />
                              : <Chip size="small" label={isOverdue ? 'Overdue' : (task.status || 'pending').replace(/_/g, ' ')} color={isOverdue ? 'error' : 'default'} sx={{ textTransform: 'capitalize' }} />}
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {task.assigned_name || 'Unassigned'} · {isOverdue ? `was due ${new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : done && task.completed_at ? `done at ${new Date(task.completed_at).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}` : task.due_date ? `by ${new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'no due date'}
                          </Typography>
                        </Box>
                        <Button size="small" variant="outlined" onClick={e => { e.stopPropagation(); openView(task) }} sx={{ textTransform: 'none' }}>Open</Button>
                      </Stack>
                    </Paper>
                  )
                })}
              </Stack>
            )}
          </Box>

          <Paper sx={{ p: 2, width: { xs: '100%', lg: 300 }, flexShrink: 0, border: '1px solid', borderColor: '#E3E9F0', borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>This week</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>Tap a day to see what&apos;s due</Typography>
            <Stack spacing={0.5}>
              {weekDays.map(d => (
                <Box key={d.key} onClick={() => setCalendarDate(d.key)}
                  sx={{ p: 1, borderRadius: 1.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1, bgcolor: d.key === calendarDate ? '#EAF3FF' : 'transparent', '&:hover': { bgcolor: '#EAF2FB' } }}>
                  <CalendarIcon fontSize="small" sx={{ color: NAVY }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={600}>{d.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {d.due.length === 0 ? 'Nothing scheduled' : `${d.due.length} due${d.key === todayStr && overdue.length > 0 ? ` · ${overdue.length} overdue carried over` : ''}`}
                    </Typography>
                  </Box>
                  {d.key === calendarDate
                    ? <Chip size="small" label="Viewing" color="primary" />
                    : d.due.length > 0 ? <Chip size="small" label={d.due.length} variant="outlined" /> : <Chip size="small" label="0" variant="outlined" />}
                </Box>
              ))}
            </Stack>
          </Paper>
        </Stack>
      )}

      <Dialog open={viewDialog} onClose={closeViewDialog} maxWidth="sm" fullWidth>
        {viewing && (<>
          <TaskDialogHeader title={viewing.title} onClose={closeViewDialog} />
          <DialogContent>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={(viewing.status || 'pending').replace(/_/g, ' ')} color={viewingOverdue ? 'error' : STATUS_COLORS[viewing.status] || 'default'} sx={{ textTransform: 'capitalize', fontWeight: 600 }} />
                {viewingOverdue && <Chip size="small" label={dueLabel(viewing, todayStr).text} color="error" sx={{ fontWeight: 600 }} />}
                <Chip size="small" label={(viewing.priority || 'medium').replace(/_/g, ' ')} color={PRIORITY_COLORS[viewing.priority] || 'default'} sx={{ textTransform: 'capitalize' }} />
                <Chip size="small" label={RECURRENCE_LABELS[viewing.recurrence] || 'Once'} variant="outlined" />
              </Stack>
              {viewing.status === 'completed' && viewing.completed_at && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CheckCircleIcon fontSize="small" sx={{ color: '#087A55' }} />
                  <Typography variant="body2" sx={{ color: '#087A55', fontWeight: 600 }}>
                    Completed / {new Date(viewing.completed_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(viewing.completed_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} by {viewing.assigned_name || 'the team'}
                  </Typography>
                </Stack>
              )}
              <Stack direction="row" spacing={2}>
                <Box sx={{ flex: 1, minWidth: 0 }}><Typography variant="caption" color="text.secondary">For</Typography><Typography variant="body2" fontWeight={600}>{viewing.person_name || 'House / team'}</Typography></Box>
                <Box sx={{ flex: 1, minWidth: 0 }}><Typography variant="caption" color="text.secondary">Owner</Typography><Typography variant="body2" fontWeight={600}>{viewing.assigned_name || 'Unassigned'}</Typography></Box>
              </Stack>
              <Stack direction="row" spacing={2}>
                <Box sx={{ flex: 1, minWidth: 0 }}><Typography variant="caption" color="text.secondary">Due</Typography><Typography variant="body2" fontWeight={600}>{viewing.due_date ? new Date(viewing.due_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'No due date'}</Typography></Box>
                <Box sx={{ flex: 1, minWidth: 0 }}><Typography variant="caption" color="text.secondary">Repeats</Typography><Typography variant="body2" fontWeight={600}>{RECURRENCE_LABELS[viewing.recurrence] || 'Once'}{viewingNext ? ` · next on ${viewingNext}` : ''}</Typography></Box>
              </Stack>
              <Divider />
              <Stack spacing={1}><Typography variant="caption" color="text.secondary">Description</Typography><Typography sx={{ whiteSpace: 'pre-wrap' }}>{viewing.description || 'No description recorded.'}</Typography></Stack>
              <Stack spacing={1}><Typography variant="caption" color="text.secondary">Notes</Typography><Typography sx={{ whiteSpace: 'pre-wrap', color: viewing.notes ? 'inherit' : 'text.secondary' }}>{viewing.notes || 'No notes yet.'}</Typography></Stack>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2.5, justifyContent: 'space-between' }}>
            <Button variant="outlined" onClick={() => setDeleteDialog(true)} sx={{ textTransform: 'none' }}>Delete</Button>
            <Stack direction="row" spacing={1}>
              {viewing.status === 'completed' ? (
                <Button variant="contained" onClick={() => statusMutation.mutate({ id: viewing.id, status: 'pending' })} sx={{ bgcolor: NAVY, textTransform: 'none' }}>Reopen</Button>
              ) : (<>
                <Button variant="outlined" onClick={() => { closeViewDialog(); openEdit(viewing) }} sx={{ textTransform: 'none' }}>Edit</Button>
                {viewing.status === 'pending' && <Button variant="contained" onClick={() => statusMutation.mutate({ id: viewing.id, status: 'in_progress' })} sx={{ bgcolor: NAVY, textTransform: 'none' }}>Start</Button>}
                {viewing.status !== 'cancelled' && <Button variant="contained" onClick={() => openCompletion(viewing)} sx={{ bgcolor: NAVY, textTransform: 'none' }}>Mark complete</Button>}
              </>)}
            </Stack>
          </DialogActions>
        </>)}
      </Dialog>

      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)} maxWidth="xs" fullWidth>
        {viewing && (<>
          <TaskDialogHeader title="Delete this task?" onClose={() => setDeleteDialog(false)} />
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{viewing.title} will be removed for everyone, along with its notes.</Typography>
            <Paper sx={{ display: 'flex', gap: 1.5, p: 2, bgcolor: '#EAF2FB', borderRadius: 2 }}>
              <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: '#FFFFFF', color: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><AssignmentIcon fontSize="small" /></Box>
              <Box>
                <Typography variant="body2" fontWeight={700}>Might it be needed again?</Typography>
                <Typography variant="body2" color="text.secondary">Cancel it instead. It moves to the Cancelled tab and keeps a record of what was stopped.</Typography>
              </Box>
            </Paper>
          </DialogContent>
          <DialogActions sx={{ p: 2.5 }}>
            <Button onClick={() => setDeleteDialog(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Button variant="outlined" onClick={() => { setDeleteDialog(false); statusMutation.mutate({ id: viewing.id, status: 'cancelled' }) }} sx={{ textTransform: 'none' }}>Cancel task instead</Button>
            <Button variant="contained" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(viewing.id)} sx={{ bgcolor: NAVY, textTransform: 'none' }}>Delete task</Button>
          </DialogActions>
        </>)}
      </Dialog>

      <Dialog open={completionDialog} onClose={() => setCompletionDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Complete task</DialogTitle>
        <DialogContent><Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Record what was done for {viewing?.title || 'this task'}.</Typography><TextField label="Completion details" multiline rows={4} fullWidth placeholder="What was completed, observed, or handed over?" value={completionNotes} onChange={e => setCompletionNotes(e.target.value)} /></DialogContent>
        <DialogActions><Button onClick={() => setCompletionDialog(false)}>Cancel</Button><Button variant="contained" disabled={statusMutation.isPending} onClick={() => { statusMutation.mutate({ id: viewing.id, status: 'completed', notes: completionNotes || undefined }); setCompletionDialog(false); closeViewDialog() }} sx={{ bgcolor: '#087A55' }}>Save completion</Button></DialogActions>
      </Dialog>

      <Dialog open={dialog} onClose={closeDialog} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={e => { e.preventDefault(); trySave() }}>
          <TaskDialogHeader title={editing ? 'Edit task' : 'New task'} subtitle={editing ? 'Changes are shared with the owner straight away.' : 'Give it an owner and a due date so it stays visible.'} onClose={closeDialog} />
          <DialogContent>
          {Object.keys(formErrors).length > 0 && (
            <Paper role="alert" sx={{ display: 'flex', gap: 1.5, p: 2, mb: 2, border: '1px solid', borderColor: '#E3E9F0', borderRadius: 2 }}>
              <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: '#FEF0F0', color: '#B42318', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><WarningIcon fontSize="small" /></Box>
              <Box>
                <Typography fontWeight={700}>{Object.keys(formErrors).length === 1 ? '1 thing needs your attention' : `${Object.keys(formErrors).length} things need your attention`}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {[!form.title.trim() && 'Add a title', !form.assigned_to && 'choose who owns this task'].filter(Boolean).join(' and ').replace(/^./, c => c.toUpperCase())}. Everything you entered is still here.
                </Typography>
              </Box>
            </Paper>
          )}
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Title" required fullWidth placeholder="e.g. Check the fire extinguishers" value={form.title} error={!!formErrors.title} helperText={formErrors.title} onChange={e => { setForm(f => ({ ...f, title: e.target.value })); if (formErrors.title) setFormErrors(p => ({ ...p, title: undefined })) }} />
            <TextField label="Description" fullWidth multiline rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <Box><Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>Repeats</Typography><PillOptions showCheck value={form.recurrence} onChange={v => setForm(f => ({ ...f, recurrence: v }))} options={[{ value: 'once', label: 'Once' }, { value: 'daily', label: 'Daily' }, { value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }]} /></Box>
            <Box><Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>Priority</Typography><PillOptions showCheck value={form.priority} onChange={v => setForm(f => ({ ...f, priority: v }))} options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }]} /></Box>
            {editing && <TextField select label="Status" fullWidth value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}><MenuItem value="pending">Pending</MenuItem><MenuItem value="in_progress">In progress</MenuItem><MenuItem value="completed">Completed</MenuItem><MenuItem value="cancelled">Cancelled</MenuItem></TextField>}
            <Autocomplete options={members} getOptionLabel={(m: any) => `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email} value={members.find((m: any) => m.profileId === form.assigned_to) || null} onChange={(_, v) => { setForm(f => ({ ...f, assigned_to: v?.profileId || '' })); if (formErrors.owner) setFormErrors(p => ({ ...p, owner: undefined })) }} renderInput={p => <TextField {...p} label="Owner" placeholder="Assign to a staff member" required error={!!formErrors.owner} helperText={formErrors.owner} />} />
            <Autocomplete options={people} getOptionLabel={(p: any) => `${p.first_name || ''} ${p.last_name || ''}${p.room_number ? ` (Room ${p.room_number})` : ''}`} value={people.find((p: any) => p.id === form.person_id) || null} onChange={(_, v) => setForm(f => ({ ...f, person_id: v?.id || '' }))} renderInput={p => <TextField {...p} label="For person (optional)" />} />
            <Box>
              <TextField label="Due date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              {editing && origDue && form.due_date && form.due_date !== origDue && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  Was {new Date(`${origDue}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}. {ownerFirstName || 'The owner'} will be told about the change.
                </Typography>
              )}
            </Box>
            <TextField label="Notes (optional)" fullWidth multiline rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, justifyContent: 'space-between' }}>
          <Box sx={{ flex: 1 }}>{saveMutation.isPending && <Typography variant="body2" color="text.secondary">Please keep this window open.</Typography>}</Box>
          <Stack direction="row" spacing={1}><Button onClick={closeDialog}>Cancel</Button><Button type="submit" variant="contained" disabled={saveMutation.isPending} sx={{ bgcolor: NAVY, textTransform: 'none' }}>{saveMutation.isPending ? 'Saving…' : editing ? 'Save changes' : 'Save task'}</Button></Stack>
        </DialogActions></Box>
      </Dialog>
    </PageContainer>
  )
}
