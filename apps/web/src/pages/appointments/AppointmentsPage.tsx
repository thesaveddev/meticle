import { useState, useEffect, useMemo, useRef } from 'react'
import { Box, Typography, Paper, Stack, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Select, MenuItem, FormControl, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, IconButton, CircularProgress, Alert, Divider, Avatar, Card, CardContent } from '@mui/material'
import { useSearchParams } from 'react-router-dom'
import PageContainer from '../../components/design/PageContainer'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, CheckCircle as CheckCircleIcon, CalendarMonth as CalendarIcon, Cancel as CancelIcon, EventBusy as NoShowIcon, People as PeopleIcon, ChevronLeft as PrevIcon, ChevronRight as NextIcon, WarningAmber as AlertIcon } from '@mui/icons-material'
import { MICA_RECORD_PARAMS } from '@meticle/shared'
import api from '../../services/api'
import { localDate, toLocalDateTimeInput } from '../../utils/dateFormat'
import { STATUS_PILL } from './components/statusPill'
import AppointmentDetailDialog from './components/AppointmentDetailDialog'
import AppointmentFormDialog, { type AppointmentFormValues } from './components/AppointmentFormDialog'
import CancelAppointmentDialog from './components/CancelAppointmentDialog'
import DeleteAppointmentDialog from './components/DeleteAppointmentDialog'
import AssignStaffDialog from './components/AssignStaffDialog'
import AppointmentToast, { type AppointmentToastData } from './components/AppointmentToast'

const NAVY = '#0164C8'
const RECURRENCE_LABELS: Record<string, string> = { once: 'Once', daily: 'Daily', monthly: 'Monthly', yearly: 'Yearly' }
const EMPTY_FORM: AppointmentFormValues = { title: '', description: '', notes: '', person_id: '', staff_id: '', location_id: '', where_text: '', recurrence: 'once', start_time: '', end_time: '', status: 'scheduled' }

function asArray(value: any, keys: string[] = []) {
  if (Array.isArray(value)) return value
  for (const key of keys) if (Array.isArray(value?.[key])) return value[key]
  return Array.isArray(value?.data) ? value.data : []
}
// A `datetime-local` field is read back as the user's own wall clock, so it has to
// be filled from local fields: the UTC slice showed a BST appointment an hour
// early and then saved that hour back on every open-and-save.
const inputDateTime = toLocalDateTimeInput

const pad = (n: number) => String(n).padStart(2, '0')
const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (ymd: string, n: number) => { const d = new Date(ymd + 'T12:00:00'); d.setDate(d.getDate() + n); return toYMD(d) }
const mondayOf = (ymd: string) => { const d = new Date(ymd + 'T12:00:00'); const back = (d.getDay() + 6) % 7; d.setDate(d.getDate() - back); return toYMD(d) }
const fmtDayLong = (ymd: string) => new Date(ymd + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtDayShort = (ymd: string) => new Date(ymd + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const fmtT = (iso: string) => { const d = new Date(iso); const h = d.getHours() % 12 || 12; return `${h}:${pad(d.getMinutes())}` }
const ampm = (iso: string) => (new Date(iso).getHours() < 12 ? 'am' : 'pm')
const fmtRange = (a: any) => {
  const s = fmtT(a.start_time); const e = fmtT(a.end_time)
  const sa = ampm(a.start_time); const ea = ampm(a.end_time)
  return sa === ea ? `${s} – ${e} ${ea}` : `${s} ${sa} – ${e} ${ea}`
}
const initialsOf = (name?: string) => (name || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
const fmtDur = (mins: number) => {
  const m = Math.round(mins)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60); const r = m % 60
  return r ? `${h} h ${r} min` : `${h} h`
}
const minsOf = (a: any) => Math.max(0, (new Date(a.end_time).getTime() - new Date(a.start_time).getTime()) / 60000)

export default function AppointmentsPage() {
  const [view, setView] = useState<'day' | 'week'>('day')
  const [appointments, setAppointments] = useState<any[]>([])
  const [weekAppointments, setWeekAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [people, setPeople] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [locationFilter, setLocationFilter] = useState('all')
  const [saving, setSaving] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [dateFilter, setDateFilter] = useState(localDate())
  const [weekStart, setWeekStart] = useState(mondayOf(localDate()))
  const [searchParams, setSearchParams] = useSearchParams()

  // Figma 7.6 dialogs: detail, form, cancel, delete-confirm, assign picker,
  // completion notes, and the white toast that confirms each action.
  const [detailTarget, setDetailTarget] = useState<any>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'new' | 'edit'>('new')
  const [formInitial, setFormInitial] = useState<AppointmentFormValues>(EMPTY_FORM)
  const [formKey, setFormKey] = useState('')
  const [cancelTarget, setCancelTarget] = useState<any>(null)
  const [cancelling, setCancelling] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  const [assignTarget, setAssignTarget] = useState<any>(null)
  const [assigning, setAssigning] = useState(false)
  const [completionTarget, setCompletionTarget] = useState<any>(null)
  const [completionNotes, setCompletionNotes] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [dayShifts, setDayShifts] = useState<any[]>([])
  const [toast, setToast] = useState<AppointmentToastData | null>(null)

  const currentUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} }
  }, [])
  const canManage = currentUser.role === 'ORG_ADMIN' || currentUser.role === 'MANAGER'

  // A link to one appointment: what Mica sends back when a booking ends by
  // offering the page the new record is on, and what any other client (a
  // notification, a colleague's message) can arrive on. Read from the URL rather
  // than passed in state, because the URL is the only thing that survives a
  // reload.
  const linkedAppointmentId = searchParams.get(MICA_RECORD_PARAMS.appointment)
  // Held alongside the URL so the same link opens its record once: a re-render,
  // a refetch or a changed date filter must not re-open a dialog the carer has
  // already closed.
  const linkedRef = useRef<string | null>(null)

  const fetchDay = async (day: string) => {
    setFetchError(''); setLoading(true)
    try { const res = await api.get(`/appointments?date=${day}`); setAppointments(asArray(res.data, ['appointments'])) }
    catch (e: any) { setAppointments([]); setFetchError(e?.response?.data?.message || 'Failed to load appointments') }
    finally { setLoading(false) }
  }
  const fetchWeek = async (monday: string) => {
    setFetchError(''); setLoading(true)
    try {
      const res = await api.get(`/appointments?from=${monday}&to=${addDays(monday, 6)}`)
      setWeekAppointments(asArray(res.data, ['appointments']))
    } catch (e: any) { setWeekAppointments([]); setFetchError(e?.response?.data?.message || 'Failed to load appointments') }
    finally { setLoading(false) }
  }
  const refetch = () => { if (view === 'day') fetchDay(dateFilter); else fetchWeek(weekStart) }
  // Rota overlap for the assign picker and the form's staff helper: which
  // staff are on shift around the appointment's own day.
  const fetchDayShifts = async (day: string) => {
    try {
      const res = await api.get(`/shifts?startDate=${encodeURIComponent(day + 'T00:00:00')}&endDate=${encodeURIComponent(addDays(day, 1) + 'T00:00:00')}`)
      setDayShifts(asArray(res.data, ['shifts']))
    } catch { setDayShifts([]) }
  }
  useEffect(() => {
    if (view === 'day') fetchDay(dateFilter)
    else fetchWeek(weekStart)
  }, [view, dateFilter, weekStart])
  useEffect(() => {
    api.get('/people?status=active').then(r => setPeople(asArray(r.data, ['people']))).catch(() => {})
    api.get('/staff/org-members').then(r => { const d = r.data; const members = Array.isArray(d) ? d : [...(Array.isArray(d?.admins) ? d.admins : []), ...(Array.isArray(d?.staff) ? d.staff : [])]; setStaff(members.filter((s: any) => s.status === 'active')) }).catch(() => {})
    api.get('/appointments/locations').then(r => setLocations(asArray(r.data, ['locations']))).catch(() => {})
  }, [])

  const inLocation = (a: any) => locationFilter === 'all' || a.location_id === locationFilter
  const dayList = useMemo(() => appointments.filter(inLocation), [appointments, locationFilter])
  const weekList = useMemo(() => weekAppointments.filter(inLocation), [weekAppointments, locationFilter])

  // The linked record. The list on screen is one day's, and a newly booked
  // appointment is usually not on it, so a row that is present opens straight away
  // and anything else is read by id and its own day shown — which is what puts the
  // record in the table behind its dialog instead of only in the dialog.
  useEffect(() => {
    if (!linkedAppointmentId || linkedRef.current === linkedAppointmentId) return
    const inList = dayList.find((a: any) => a.id === linkedAppointmentId)
    if (inList) {
      linkedRef.current = linkedAppointmentId
      setDetailTarget(inList)
      return
    }
    if (loading) return
    // Once-only before the read, so a rejected request cannot be retried by every
    // later render.
    linkedRef.current = linkedAppointmentId
    api.get(`/appointments/${linkedAppointmentId}`).then(res => {
      const appointment = res.data?.appointment || res.data
      if (!appointment?.id) { setFetchError('That appointment could not be opened.'); return }
      // The day the appointment falls on where the carer is standing, not the
      // UTC day of its timestamp: a 00:30 BST booking is 23:30Z the day before.
      const day = appointment.start_time ? localDate(new Date(appointment.start_time)) : ''
      if (view !== 'day') setView('day')
      if (day && day !== dateFilter) setDateFilter(day)
      setDetailTarget(appointment)
    }).catch((e: any) => setFetchError(e?.response?.data?.message || 'That appointment could not be opened.'))
  }, [linkedAppointmentId, dayList, loading, dateFilter, view])

  function closeDetail() {
    setDetailTarget(null)
    // The URL is what re-opens this record, so closing the record has to clear
    // the link that opened it.
    if (linkedAppointmentId) setSearchParams({}, { replace: true })
  }

  const openCreate = () => {
    setFormMode('new')
    setFormInitial({ ...EMPTY_FORM, start_time: `${dateFilter}T09:00`, end_time: `${dateFilter}T10:00` })
    setFormKey(`new-${Date.now()}`)
    fetchDayShifts(dateFilter)
    setFormOpen(true)
  }
  const openEdit = (a: any) => {
    setFormMode('edit')
    setFormInitial({
      title: a.title || '', description: a.description || '', notes: a.notes || '',
      person_id: a.person_id || '', staff_id: a.staff_id || '', location_id: a.location_id || '',
      where_text: a.where_text || '', recurrence: a.recurrence || 'once',
      start_time: inputDateTime(a.start_time), end_time: inputDateTime(a.end_time),
      status: a.status || 'scheduled',
    })
    setFormKey(`edit-${a.id}`)
    fetchDayShifts(localDate(new Date(a.start_time)))
    setDetailTarget(null)
    setFormOpen(true)
  }
  const handleSave = async (values: AppointmentFormValues) => {
    setSaving(true); setFetchError('')
    try {
      const payload = {
        ...values,
        start_time: new Date(values.start_time).toISOString(),
        end_time: new Date(values.end_time).toISOString(),
        person_id: values.person_id || null, staff_id: values.staff_id || null,
        location_id: values.location_id || null, where_text: values.where_text?.trim() || null,
      }
      if (formMode === 'edit' && formKey.startsWith('edit-')) {
        const id = formKey.slice(5)
        await api.patch(`/appointments/${id}`, payload)
        setToast({ title: 'Appointment updated', sub: values.title })
        if (values.status === 'completed') setToast({ title: 'Appointment completed', sub: `${values.title} is marked as done.` })
        if (values.status === 'no_show') setToast({ title: 'Marked as no show', sub: `We've noted the appointment didn't happen.` })
      } else {
        await api.post('/appointments', payload)
        setToast({ title: 'Appointment booked', sub: `${values.title} is on ${fmtDayShort(values.start_time.slice(0, 10))}.` })
      }
      setFormOpen(false); refetch()
    } catch (e: any) { setFetchError(e?.response?.data?.message || 'Failed to save appointment') }
    finally { setSaving(false) }
  }
  const updateStatus = async (a: any, status: string, details?: { notes?: string; follow_up?: string }) => {
    try {
      await api.patch(`/appointments/${a.id}`, { status, notes: details?.notes || a.notes || '', follow_up: details?.follow_up || undefined })
      if (status === 'completed') setToast({ title: 'Appointment completed', sub: `${a.title} is marked as done.` })
      if (status === 'no_show') setToast({ title: 'Marked as no show', sub: `We've noted that ${a.person_name || 'they'} didn't attend.` })
      setCompletionTarget(null); refetch()
    } catch (e: any) { setFetchError(e?.response?.data?.message || 'Failed to update appointment') }
  }
  const confirmCancel = async (reason: string, message: string) => {
    if (!cancelTarget) return
    setCancelling(true)
    try {
      await api.patch(`/appointments/${cancelTarget.id}`, {
        status: 'cancelled', cancellation_reason: reason, cancellation_note: message?.trim() || null,
      })
      setToast({ title: 'Appointment cancelled', sub: `${cancelTarget.title} is cancelled and kept in the list.` })
      setCancelTarget(null); closeDetail(); refetch()
    } catch (e: any) { setFetchError(e?.response?.data?.message || 'Failed to cancel appointment') }
    finally { setCancelling(false) }
  }
  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/appointments/${deleteTarget.id}`)
      setToast({ title: 'Appointment deleted', sub: `${deleteTarget.title} has been removed.` })
      setDeleteTarget(null); closeDetail(); refetch()
    } catch (e: any) { setFetchError(e?.response?.data?.message || 'Failed to delete appointment') }
    finally { setDeleting(false) }
  }
  const confirmAssign = async (staffId: string) => {
    if (!assignTarget) return
    setAssigning(true)
    try {
      await api.patch(`/appointments/${assignTarget.id}`, { staff_id: staffId })
      const s = staff.find((m: any) => (m.staff_id || m.id) === staffId)
      const name = s ? `${s.first_name || ''} ${s.last_name || ''}`.trim() : 'Staff'
      setToast({ title: 'Staff assigned', sub: `${name} will support ${assignTarget.title}.` })
      setAssignTarget(null); closeDetail(); refetch()
    } catch (e: any) { setFetchError(e?.response?.data?.message || 'Failed to assign staff') }
    finally { setAssigning(false) }
  }

  const counts = useMemo(() => ({
    scheduled: dayList.filter(a => a.status === 'scheduled').length,
    completed: dayList.filter(a => a.status === 'completed').length,
    cancelled: dayList.filter(a => a.status === 'cancelled').length,
    no_show: dayList.filter(a => a.status === 'no_show').length,
  }), [dayList])
  const nextScheduled = useMemo(() => dayList.filter(a => a.status === 'scheduled').sort((x, y) => +new Date(x.start_time) - +new Date(y.start_time))[0], [dayList])
  const firstCompleted = useMemo(() => dayList.filter(a => a.status === 'completed').sort((x, y) => +new Date(x.start_time) - +new Date(y.start_time))[0], [dayList])
  const unstaffed = useMemo(() => dayList.filter(a => a.status === 'scheduled' && !a.staff_id), [dayList])

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const weekByDay = useMemo(() => {
    const map = new Map<string, any[]>()
    for (const d of weekDays) map.set(d, [])
    for (const a of weekList) {
      const day = localDate(new Date(a.start_time))
      if (map.has(day)) map.get(day)!.push(a)
    }
    return weekDays.map(d => ({ day: d, items: (map.get(d) || []).sort((x, y) => +new Date(x.start_time) - +new Date(y.start_time)) }))
  }, [weekDays, weekList])
  // Consecutive empty days collapse into one row ("Fri 6 Nov - Sun 8 Nov"),
  // the way the rota lead scans the week: what needs cover, and what is quiet.
  const weekRows = useMemo(() => {
    const rows: { days: string[]; items: any[] }[] = []
    for (const d of weekByDay) {
      const last = rows[rows.length - 1]
      if (d.items.length === 0 && last && last.items.length === 0) last.days.push(d.day)
      else rows.push({ days: [d.day], items: d.items })
    }
    return rows
  }, [weekByDay])
  const weekNeedStaff = useMemo(() => weekList.filter(a => a.status === 'scheduled' && !a.staff_id).length, [weekList])
  const weekCompleted = useMemo(() => weekList.filter(a => a.status === 'completed').length, [weekList])
  const whoGoing = useMemo(() => {
    const map = new Map<string, { name: string; count: number; mins: number }>()
    for (const a of weekList) {
      if (!a.staff_id) continue
      const name = a.staff_name || 'Unknown'
      const entry = map.get(a.staff_id) || { name, count: 0, mins: 0 }
      entry.count += 1; entry.mins += minsOf(a)
      map.set(a.staff_id, entry)
    }
    return [...map.values()].sort((x, y) => y.count - x.count)
  }, [weekList])
  const weekEnd = addDays(weekStart, 6)
  const weekLabel = `${new Date(weekStart + 'T12:00:00').getDate()} - ${fmtDayShort(weekEnd)}`

  const statusPill = (status: string) => {
    const s = STATUS_PILL[status] || STATUS_PILL.scheduled
    return <Chip size="small" label={(status || '').replace(/_/g, ' ')} sx={{ bgcolor: s.bg, color: s.fg, fontWeight: 600, textTransform: 'capitalize', fontSize: 12 }} />
  }
  const staffCell = (a: any) => a.staff_id || a.staff_name ? (
    <Stack direction="row" spacing={1} alignItems="center">
      <Avatar sx={{ width: 30, height: 30, fontSize: 11, fontWeight: 700, bgcolor: NAVY }}>{initialsOf(a.staff_name)}</Avatar>
      <Typography variant="body2">{a.staff_name || 'Assigned'}</Typography>
    </Stack>
  ) : (
    <Chip size="small" label="Needs staff" sx={{ bgcolor: 'notice.error.bg', color: 'notice.error.fg', fontWeight: 600, fontSize: 12 }} />
  )

  const dayCards: { label: string; value: number; sub?: string; icon: React.ReactNode }[] = [
    { label: 'Scheduled', value: counts.scheduled, sub: nextScheduled ? `Next: ${nextScheduled.title} at ${fmtT(nextScheduled.start_time)}` : undefined, icon: <CalendarIcon sx={{ color: NAVY, fontSize: 20 }} /> },
    { label: 'Completed', value: counts.completed, sub: firstCompleted ? firstCompleted.title : undefined, icon: <CheckCircleIcon sx={{ color: '#087A55', fontSize: 20 }} /> },
    { label: 'Cancelled', value: counts.cancelled, icon: <CancelIcon sx={{ color: 'text.disabled', fontSize: 20 }} /> },
    { label: 'No show', value: counts.no_show, icon: <NoShowIcon sx={{ color: 'text.disabled', fontSize: 20 }} /> },
  ]

  // The spinner is for a page with nothing to show yet. A refetch for another day
  // keeps the rows it already has — and never replaces a record's dialog, which is
  // where a link's carer is standing while the day behind them loads.
  if (loading && appointments.length === 0 && weekAppointments.length === 0 && !detailTarget) return <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: NAVY }} /></Box>

  return (
    <PageContainer>

      {fetchError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFetchError('')}>{fetchError}</Alert>}

      <Typography variant="caption" sx={{ color: NAVY, fontWeight: 700, letterSpacing: '0.08em' }}>
        COMMUNICATION / APPOINTMENTS{view === 'week' ? ' / WEEK' : ''}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={2} sx={{ mb: 2, mt: 0.5 }}>
        <Box>
          <Typography variant="h5" fontWeight={600}>Appointments</Typography>
          <Typography variant="body2" color="text.secondary">Coordinate reviews, visits and follow-ups for people and staff.</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => setView(view === 'day' ? 'week' : 'day')} sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 999 }}>
            {view === 'day' ? 'Week view' : 'Day view'}
          </Button>
          {canManage && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 600, borderRadius: 999 }}>
              Add appointment
            </Button>
          )}
        </Stack>
      </Stack>

      {/* Filter toolbar */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <Select value={locationFilter} onChange={e => setLocationFilter(e.target.value)} displayEmpty
            sx={{ borderRadius: 999, bgcolor: 'background.paper' }}>
            <MenuItem value="all">All locations</MenuItem>
            {locations.map(l => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
          </Select>
        </FormControl>
        {view === 'day' ? (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <IconButton size="small" onClick={() => { setDateFilter(addDays(dateFilter, -1)); setPage(0) }} title="Previous day">
              <PrevIcon fontSize="small" />
            </IconButton>
            <TextField type="date" size="small" value={dateFilter}
              onChange={e => { if (e.target.value) { setDateFilter(e.target.value); setPage(0) } }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 999, bgcolor: 'background.paper' } }} />
            <IconButton size="small" onClick={() => { setDateFilter(addDays(dateFilter, 1)); setPage(0) }} title="Next day">
              <NextIcon fontSize="small" />
            </IconButton>
          </Stack>
        ) : (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <IconButton size="small" onClick={() => setWeekStart(addDays(weekStart, -7))} title="Previous week">
              <PrevIcon fontSize="small" />
            </IconButton>
            <Button variant="outlined" size="small" onClick={() => setWeekStart(mondayOf(localDate()))}
              sx={{ borderRadius: 999, textTransform: 'none', fontWeight: 600, bgcolor: 'background.paper' }}>
              {weekLabel}
            </Button>
            <IconButton size="small" onClick={() => setWeekStart(addDays(weekStart, 7))} title="Next week">
              <NextIcon fontSize="small" />
            </IconButton>
          </Stack>
        )}
      </Stack>

      {view === 'day' ? (
        <>
          {unstaffed.length > 0 && (
            <Paper sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: 'notice.error.bg', border: '1px solid', borderColor: 'notice.error.fg', display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
              <AlertIcon sx={{ color: 'notice.error.fg' }} />
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Typography variant="body2" fontWeight={700}>
                  {unstaffed.length} appointment{unstaffed.length === 1 ? '' : 's'} has no staff member yet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {unstaffed[0].title} at {fmtT(unstaffed[0].start_time)} {ampm(unstaffed[0].start_time)} needs someone{unstaffed[0].notes ? ` — ${unstaffed[0].notes}` : ' assigned.'}
                </Typography>
              </Box>
              {canManage && (
                <Button variant="contained" size="small" onClick={() => setAssignTarget(unstaffed[0])}
                  sx={{ bgcolor: 'background.paper', color: 'text.primary', textTransform: 'none', fontWeight: 600, borderRadius: 999, boxShadow: 'none', border: '1px solid #E3E9F0' }}>
                  Assign staff
                </Button>
              )}
            </Paper>
          )}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
            {dayCards.map(c => (
              <Paper key={c.label} sx={{ flex: 1, p: 1.5, border: '1px solid', borderColor: '#E3E9F0', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                  <Typography variant="h6" fontWeight={600}>{c.value}</Typography>
                  {c.sub && <Typography variant="caption" color="text.secondary" noWrap>{c.sub}</Typography>}
                </Box>
                {c.icon}
              </Paper>
            ))}
          </Stack>

          <Typography variant="h6" fontWeight={600}>{fmtDayLong(dateFilter)}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {dayList.length} appointment{dayList.length === 1 ? '' : 's'} · in time order
          </Typography>

          {dayList.length === 0 ? (
            <Paper sx={{ py: 6, px: 3, textAlign: 'center', border: '1px solid', borderColor: '#E3E9F0', borderRadius: 2 }}>
              <CalendarIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
              <Typography variant="h6" fontWeight={600} sx={{ mt: 1 }}>No appointments on this day</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Book GP visits, reviews and family visits here, so staff know who to support and when.
              </Typography>
              {canManage && (
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 600, borderRadius: 999 }}>
                  Add appointment
                </Button>
              )}
            </Paper>
          ) : (
            <>
              {/* Desktop table */}
              <TableContainer component={Paper} sx={{ border: '1px solid', borderColor: '#E3E9F0', borderRadius: 2, display: { xs: 'none', sm: 'block' } }}>
                <Table size="small">
                  <TableHead><TableRow>{['Appointment', 'Person', 'Staff', 'Time', 'Repeats', 'Status', ''].map(h => <TableCell key={h} sx={{ fontWeight: 600, color: 'text.secondary' }}>{h}</TableCell>)}</TableRow></TableHead>
                  <TableBody>
                    {dayList.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(a => (
                      <TableRow key={a.id} hover onClick={() => setDetailTarget(a)} sx={{ cursor: 'pointer' }}>
                        <TableCell><Typography fontWeight={600}>{a.title}</Typography>{a.notes && <Typography variant="caption" color="text.secondary" noWrap>{a.notes}</Typography>}</TableCell>
                        <TableCell>{a.person_name || 'Team / general'}</TableCell>
                        <TableCell>{staffCell(a)}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{fmtRange(a)}</TableCell>
                        <TableCell><Chip size="small" label={RECURRENCE_LABELS[a.recurrence] || 'Once'} variant="outlined" /></TableCell>
                        <TableCell>{statusPill(a.status)}</TableCell>
                        <TableCell align="right" onClick={e => e.stopPropagation()}>
                          {canManage && (
                            <>
                              <IconButton size="small" onClick={() => openEdit(a)} title="Edit"><EditIcon fontSize="small" /></IconButton>
                              <IconButton size="small" color="error" onClick={() => setDeleteTarget(a)} title="Delete"><DeleteIcon fontSize="small" /></IconButton>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination component="div" count={dayList.length} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0) }} rowsPerPageOptions={[5, 10, 25]} />
              </TableContainer>
              {/* Mobile cards */}
              <Stack spacing={1.5} sx={{ display: { xs: 'flex', sm: 'none' } }}>
                {dayList.map(a => (
                  <Card key={a.id} onClick={() => setDetailTarget(a)} sx={{ borderRadius: 2, border: '1px solid #E3E9F0', cursor: 'pointer' }}>
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                        <Box>
                          <Typography fontWeight={600}>{a.title}</Typography>
                          {a.notes && <Typography variant="caption" color="text.secondary">{a.notes}</Typography>}
                        </Box>
                        {statusPill(a.status)}
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {[a.person_name || 'Team / general', fmtRange(a), RECURRENCE_LABELS[a.recurrence] || 'Once'].join(' · ')}
                      </Typography>
                      <Box sx={{ mt: 1 }}>{staffCell(a)}</Box>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </>
          )}
        </>
      ) : (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
            {[
              { label: 'This week', value: weekList.length, icon: <CalendarIcon sx={{ color: NAVY, fontSize: 20 }} /> },
              { label: 'Need staff', value: weekNeedStaff, red: true, icon: <PeopleIcon sx={{ color: 'notice.error.fg', fontSize: 20 }} /> },
              { label: 'Completed', value: weekCompleted, icon: <CheckCircleIcon sx={{ color: '#087A55', fontSize: 20 }} /> },
            ].map(c => (
              <Paper key={c.label} sx={{ flex: 1, p: 1.5, border: '1px solid', borderColor: '#E3E9F0', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                  <Typography variant="h6" fontWeight={600} sx={c.red ? { color: 'notice.error.fg' } : undefined}>{c.value}</Typography>
                </Box>
                {c.icon}
              </Paper>
            ))}
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
            <Paper sx={{ flex: 1, width: '100%', p: 2, border: '1px solid', borderColor: '#E3E9F0', borderRadius: 2 }}>
              <Typography variant="h6" fontWeight={600}>This week</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {fmtDayLong(weekStart)} to {fmtDayLong(weekEnd)}
              </Typography>
              <Stack divider={<Divider />}>
                {weekRows.map((row, i) => {
                  const needs = row.items.filter(a => a.status === 'scheduled' && !a.staff_id).length
                  const label = row.days.length === 1
                    ? `${new Date(row.days[0] + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · ${row.items.length} appointment${row.items.length === 1 ? '' : 's'}`
                    : `${new Date(row.days[0] + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} - ${new Date(row.days[row.days.length - 1] + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`
                  return (
                    <Box key={i} onClick={() => { if (row.items.length) { setDateFilter(row.days[0]); setView('day') } }}
                      sx={{ py: 1.5, display: 'flex', gap: 1.5, alignItems: 'center', cursor: row.items.length ? 'pointer' : 'default', '&:hover': row.items.length ? { bgcolor: 'notice.subtle.bg' } : undefined, borderRadius: 1, px: 0.5 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography fontWeight={600} variant="body2">{label}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {row.items.length ? row.items.map(a => a.title).join(', ') : 'Nothing booked yet'}
                        </Typography>
                      </Box>
                      {row.items.length === 0 ? (
                        <Chip size="small" label="0" variant="outlined" />
                      ) : needs > 0 ? (
                        <Chip size="small" label={`${needs} needs staff`} sx={{ bgcolor: 'notice.error.bg', color: 'notice.error.fg', fontWeight: 600 }} />
                      ) : (
                        <Chip size="small" label="Staffed" sx={{ bgcolor: 'notice.success.bg', color: 'notice.success.fg', fontWeight: 600 }} />
                      )}
                      {row.items.length > 0 && <NextIcon sx={{ color: 'text.secondary', fontSize: 18 }} />}
                    </Box>
                  )
                })}
              </Stack>
            </Paper>

            <Paper sx={{ width: { xs: '100%', md: 300 }, flexShrink: 0, p: 2, border: '1px solid', borderColor: '#E3E9F0', borderRadius: 2 }}>
              <Typography variant="h6" fontWeight={600} sx={{ fontSize: 16 }}>Who is going</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Staff time away from the home</Typography>
              {whoGoing.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No staff assigned this week.</Typography>
              ) : (
                <Stack spacing={1.25}>
                  {whoGoing.map(w => (
                    <Stack key={w.name} direction="row" spacing={1.25} alignItems="center">
                      <Avatar sx={{ width: 34, height: 34, fontSize: 12, fontWeight: 700, bgcolor: NAVY }}>{initialsOf(w.name)}</Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{w.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{w.count} appointment{w.count === 1 ? '' : 's'} · {fmtDur(w.mins)}</Typography>
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Paper>
          </Stack>
        </>
      )}

      <AppointmentDetailDialog
        appointment={detailTarget} onClose={closeDetail} canManage={canManage}
        onEdit={a => openEdit(a)}
        onDelete={a => setDeleteTarget(a)}
        onAssign={a => { fetchDayShifts(localDate(new Date(a.start_time))); setAssignTarget(a) }}
        onComplete={a => { setCompletionNotes(''); setFollowUp(''); setCompletionTarget(a) }} />

      {formOpen && (
        <AppointmentFormDialog
          key={formKey}
          open={formOpen} mode={formMode} initial={formInitial}
          people={people} staff={staff} locations={locations} dayShifts={dayShifts}
          saving={saving} onClose={() => setFormOpen(false)} onSave={handleSave} />
      )}

      <CancelAppointmentDialog
        appointment={cancelTarget} confirming={cancelling}
        onClose={() => setCancelTarget(null)} onConfirm={confirmCancel} />

      <DeleteAppointmentDialog
        appointment={deleteTarget} deleting={deleting}
        onClose={() => setDeleteTarget(null)}
        onDelete={confirmDelete}
        onCancelInstead={() => { if (deleteTarget) setCancelTarget(deleteTarget); setDeleteTarget(null) }} />

      <AssignStaffDialog
        appointment={assignTarget} staff={staff} dayShifts={dayShifts}
        assigning={assigning} onClose={() => setAssignTarget(null)} onAssign={confirmAssign} />

      <Dialog open={!!completionTarget} onClose={() => setCompletionTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Complete appointment</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Capture the outcome while it is fresh.</Typography>
          <Stack spacing={2}>
            <TextField label="Completion notes" multiline rows={4} fullWidth required placeholder="What happened and what should the team know?" value={completionNotes} onChange={e => setCompletionNotes(e.target.value)} />
            <TextField label="Follow-up appointment or action" multiline rows={2} fullWidth placeholder="Optional: next appointment, referral, or action" value={followUp} onChange={e => setFollowUp(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompletionTarget(null)}>Cancel</Button>
          <Button variant="contained" disabled={!completionNotes.trim()} onClick={() => { updateStatus(completionTarget, 'completed', { notes: completionNotes, follow_up: followUp }) }} sx={{ bgcolor: '#087A55' }}>Save completion</Button>
        </DialogActions>
      </Dialog>

      <AppointmentToast toast={toast} onClose={() => setToast(null)} />
    </PageContainer>
  )
}
