import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, Chip, CircularProgress, Divider, MenuItem, Paper, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
import { Add as AddIcon, CheckCircleOutline, DeleteOutline, Schedule as ScheduleIcon } from '@mui/icons-material'
import { UserRole } from '@meticle/shared'
import api from '../../services/api'
import ContextualLearnLink from '../../components/ContextualLearnLink'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface AvailabilityRecord {
  id: string
  staff_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_available: boolean
  availability_date?: string | null
  staff_name?: string
}

interface StaffMember { id: string; first_name: string; last_name: string }
interface LeavePeriod { id: string; staff_id: string; start_date: string; end_date: string; status: string; leave_type_name: string; leave_type_color?: string; first_name?: string; last_name?: string }

function formatTime(value: string | null | undefined): string {
  if (!value) return '—'
  const raw = String(value).trim()
  const clock = raw.match(/^(\d{1,2}):(\d{2})/)
  if (clock) return `${clock[1].padStart(2, '0')}:${clock[2]}`
  const date = new Date(raw)
  return Number.isNaN(date.getTime())
    ? raw.replace(/\.\d+Z?$/i, '').slice(0, 5)
    : date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function durationHours(start: string, end: string): number {
  const toMinutes = (value: string) => {
    const match = String(value).match(/(\d{1,2}):(\d{2})/)
    return match ? Number(match[1]) * 60 + Number(match[2]) : 0
  }
  const minutes = Math.max(0, toMinutes(end) - toMinutes(start))
  return minutes / 60
}

export default function AvailabilityPage() {
  const userStr = localStorage.getItem('user')
  let rawUser: any = {}
  try { rawUser = userStr ? JSON.parse(userStr) : {} } catch { rawUser = {} }
  const isCarer = rawUser.role === UserRole.CARE_WORKER
  const canEdit = isCarer || rawUser.role === UserRole.ORG_ADMIN || rawUser.role === UserRole.MANAGER

  const [loading, setLoading] = useState(true)
  const [availability, setAvailability] = useState<AvailabilityRecord[]>([])
  const [leavePeriods, setLeavePeriods] = useState<LeavePeriod[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [selectedStaff, setSelectedStaff] = useState('')
  const [tab, setTab] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [day, setDay] = useState('1')
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('17:00')

  const load = async () => {
    setLoading(true)
    try {
      if (isCarer) {
        const [res, leaveRes] = await Promise.all([api.get('/homecare/my-availability'), api.get('/leave/my-requests').catch(() => ({ data: [] }))])
        setAvailability(res.data || [])
        setLeavePeriods((leaveRes.data || []).filter((leave: LeavePeriod) => ['approved', 'pending'].includes(leave.status)))
      } else {
        const [availRes, staffRes, leaveRes] = await Promise.all([api.get('/homecare/availability'), api.get('/homecare/staff'), api.get('/leave/requests').catch(() => ({ data: [] }))])
        setAvailability(availRes.data || [])
        setStaff(staffRes.data || [])
        setLeavePeriods((leaveRes.data || []).filter((leave: LeavePeriod) => ['approved', 'pending'].includes(leave.status)))
      }
    } catch { setError('Could not load availability. Please try again.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const addAvailability = async () => {
    if (end <= start) { setError('The end time must be after the start time.'); return }
    setSaving(true)
    setError('')
    try {
      await api.post('/homecare/availability', {
        staff_id: isCarer ? undefined : selectedStaff,
        day_of_week: Number(day),
        start_time: start,
        end_time: end,
      })
      setTab(0)
      await load()
    } catch (e: any) {
      setError(e.response?.data?.message || 'Could not save availability. Please try again.')
    } finally { setSaving(false) }
  }

  const deleteAvailability = async (id: string) => {
    setError('')
    try {
      await api.delete(`/homecare/availability/${id}`)
      await load()
    } catch (e: any) {
      setError(e.response?.data?.message || 'Could not remove availability. Please try again.')
    }
  }

  const visibleRecords = useMemo(() => availability.filter(record => !selectedStaff || record.staff_id === selectedStaff), [availability, selectedStaff])
  const visibleLeave = useMemo(() => leavePeriods.filter(leave => !selectedStaff || leave.staff_id === selectedStaff), [leavePeriods, selectedStaff])
  const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const parseDateKey = (value: string) => String(value).slice(0, 10)
  const leaveForDate = (date: Date) => {
    const key = dateKey(date)
    return visibleLeave.filter(leave => parseDateKey(leave.start_date) <= key && parseDateKey(leave.end_date) >= key)
  }
  const recordsForDate = (date: Date) => {
    const dated = visibleRecords.filter(record => record.availability_date && parseDateKey(record.availability_date) === dateKey(date))
    return dated.length > 0 ? dated : visibleRecords.filter(record => !record.availability_date && record.day_of_week === date.getDay())
  }
  const byDay = useMemo(() => {
    const result: Record<number, AvailabilityRecord[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
    visibleRecords.forEach(record => { (result[record.day_of_week] ||= []).push(record) })
    return result
  }, [visibleRecords])
  const totalHours = visibleRecords.reduce((sum, record) => sum + durationHours(record.start_time, record.end_time), 0)
  const activeDays = Object.values(byDay).filter(records => records.length > 0).length

  if (loading) return <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress /></Box>

  return (
    <Box sx={{ maxWidth: 1120, mx: 'auto', pb: 4 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={2} sx={{ mb: 2.5 }}>
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Box sx={{ width: 44, height: 44, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: '#E8F6F0', color: '#047857' }}><ScheduleIcon /></Box>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.03em' }}>{isCarer ? 'My Availability' : 'Carer Availability'}</Typography>
            <Typography variant="body2" color="text.secondary">A clear weekly pattern for planning care visits.</Typography>
            <ContextualLearnLink topic="dom-availability-areas" />
          </Box>
        </Stack>
        {canEdit && <Button variant="contained" startIcon={<AddIcon />} onClick={() => setTab(2)} sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>Add availability</Button>}
      </Stack>

      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5, mb: 2.5 }}>
        {[
          { value: visibleRecords.length, label: 'Time windows', color: '#0F4C81' },
          { value: activeDays, label: 'Days covered', color: '#047857' },
          { value: `${totalHours.toFixed(1)}h`, label: 'Planned each week', color: '#B45309' },
        ].map(item => (
          <Paper key={item.label} variant="outlined" sx={{ p: 1.75, borderRadius: 2.5, borderColor: '#E5E7EB' }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: item.color }}>{item.value}</Typography>
            <Typography variant="caption" color="text.secondary">{item.label}</Typography>
          </Paper>
        ))}
      </Box>

      {!isCarer && staff.length > 0 && (
        <TextField select size="small" label="Viewing carer" value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)} sx={{ minWidth: 220, mb: 2 }}>
          <MenuItem value="">All carers</MenuItem>
          {staff.map(s => <MenuItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</MenuItem>)}
        </TextField>
      )}

      <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden', borderColor: '#E5E7EB' }}>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ px: 1, borderBottom: '1px solid #E5E7EB', '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 50 } }}>
          <Tab label="Weekly pattern" />
          <Tab label="Schedule" />
          {canEdit && <Tab label="Add a time window" />}
        </Tabs>

        {tab === 0 && (
          <Box>
            <Box sx={{ px: 2, py: 1.25, bgcolor: '#F8FAFC', borderBottom: '1px solid #E5E7EB' }}>
              <Typography variant="caption" color="text.secondary">Compact view · select a time window to remove it</Typography>
            </Box>
            {DAYS.map((dayName, dayIndex) => {
              const records = byDay[dayIndex] || []
              return (
                <Box key={dayName} sx={{ display: 'grid', gridTemplateColumns: { xs: '78px minmax(0, 1fr)', sm: '120px minmax(0, 1fr)' }, alignItems: 'center', gap: 1.5, minHeight: 52, px: 2, py: 0.75, borderBottom: '1px solid #F1F5F9' }}>
                  <Stack direction="row" alignItems="center" gap={0.75}>
                    {records.length > 0 ? <CheckCircleOutline sx={{ fontSize: 15, color: '#10B981' }} /> : <Box sx={{ width: 15 }} />}
                    <Typography variant="body2" sx={{ fontWeight: 700, color: records.length ? '#1F2937' : '#9CA3AF' }}>{dayName.slice(0, 3)}</Typography>
                  </Stack>
                  <Stack direction="row" flexWrap="wrap" gap={0.75} useFlexGap>
                    {records.length === 0 ? <Typography variant="caption" color="text.secondary">Not set</Typography> : records.map(record => (
                      <Chip key={record.id} label={`${formatTime(record.start_time)} – ${formatTime(record.end_time)}${record.staff_name ? ` · ${record.staff_name}` : ''}`} size="small" onDelete={canEdit ? () => deleteAvailability(record.id) : undefined} deleteIcon={<DeleteOutline />} sx={{ bgcolor: '#E8F6F0', color: '#047857', fontWeight: 600, '& .MuiChip-deleteIcon': { color: '#047857' } }} />
                    ))}
                  </Stack>
                </Box>
              )
            })}
          </Box>
        )}

        {tab === 1 && (
          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>Next 7 days</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Availability and booked leave are shown together so the schedule reflects real capacity.</Typography>
            <Stack spacing={1}>
              {Array.from({ length: 7 }, (_, index) => {
                const date = new Date()
                date.setHours(12, 0, 0, 0)
                date.setDate(date.getDate() + index)
                const records = recordsForDate(date)
                const leave = leaveForDate(date)
                return (
                  <Box key={dateKey(date)} sx={{ display: 'grid', gridTemplateColumns: { xs: '82px minmax(0, 1fr)', sm: '150px minmax(0, 1fr)' }, gap: 1.5, alignItems: 'center', p: 1.25, borderRadius: 2, bgcolor: leave.length ? '#FFF7ED' : '#F8FAFC', border: '1px solid', borderColor: leave.length ? '#FED7AA' : '#E5E7EB' }}>
                    <Box><Typography variant="body2" sx={{ fontWeight: 800 }}>{date.toLocaleDateString('en-GB', { weekday: 'short' })}</Typography><Typography variant="caption" color="text.secondary">{date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Typography></Box>
                    <Stack direction="row" flexWrap="wrap" gap={0.75} useFlexGap>
                      {leave.map(item => <Chip key={`leave-${item.id}`} label={`${item.leave_type_name} · ${item.status}`} size="small" sx={{ bgcolor: item.status === 'approved' ? '#FEE2E2' : '#FEF3C7', color: item.status === 'approved' ? '#991B1B' : '#92400E', fontWeight: 700 }} />)}
                      {!leave.length && records.map(record => <Chip key={record.id} label={`${formatTime(record.start_time)} – ${formatTime(record.end_time)}`} size="small" sx={{ bgcolor: '#E8F6F0', color: '#047857', fontWeight: 600 }} />)}
                      {!leave.length && !records.length && <Typography variant="caption" color="text.secondary">No availability recorded</Typography>}
                      {leave.length > 0 && <Typography variant="caption" sx={{ alignSelf: 'center', color: '#9A3412', fontWeight: 600 }}>Unavailable for visits</Typography>}
                    </Stack>
                  </Box>
                )
              })}
            </Stack>
          </Box>
        )}

        {tab === 2 && canEdit && (
          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>Add one availability window</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>Choose a day and time. You can add more windows without leaving this page.</Typography>
            <Stack spacing={2}>
              {!isCarer && <TextField select label="Carer" value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)} fullWidth>
                {staff.map(s => <MenuItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</MenuItem>)}
              </TextField>}
              <TextField select label="Day" value={day} onChange={e => setDay(e.target.value)} fullWidth>
                {DAYS.map((label, index) => <MenuItem key={label} value={String(index)}>{label}</MenuItem>)}
              </TextField>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField label="Available from" type="time" value={start} onChange={e => setStart(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
                <TextField label="Available until" type="time" value={end} onChange={e => setEnd(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
              </Stack>
              <Divider />
              <Stack direction="row" justifyContent="flex-end" gap={1}>
                <Button onClick={() => setTab(0)}>Back to schedule</Button>
                <Button variant="contained" onClick={addAvailability} disabled={saving || (!isCarer && !selectedStaff)} sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>
                  {saving ? <CircularProgress size={18} color="inherit" /> : 'Save time window'}
                </Button>
              </Stack>
            </Stack>
          </Box>
        )}
      </Paper>
    </Box>
  )
}
