import { useState } from 'react'
import { Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import { ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon, Add as AddIcon } from '@mui/icons-material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'

const time = (d: string) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const dayName = (d: string) => new Date(d).toLocaleDateString('en-GB', { weekday: 'short' })
const dayNum = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7) // 7am - 8pm

interface Visit {
  id: string
  label: string
  person_name: string
  assigned_staff_id: string | null
  carer_name: string | null
  status: string
  scheduled_start: string
  scheduled_end: string
}

export default function WeeklyCallPlanner() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [createDialog, setCreateDialog] = useState(false)
  const [createForm, setCreateForm] = useState({
    person_id: '', label: 'Routine call', visit_type: 'routine',
    day: new Date().toISOString().slice(0, 10),
    start_time: '09:00', duration_minutes: 30,
  })
  const qc = useQueryClient()

  // Calculate week range
  const today = new Date()
  today.setDate(today.getDate() + weekOffset * 7)
  const monday = new Date(today)
  monday.setDate(monday.getDate() - monday.getDay() + 1)
  if (monday.getDay() === 0) monday.setDate(monday.getDate() - 6)
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })

  const weekFrom = monday.toISOString().slice(0, 10)
  const weekTo = new Date(sunday.getTime() + 86400000).toISOString().slice(0, 10)

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ['homecare-visits-week', weekFrom, weekTo],
    queryFn: () => api.get('/homecare/visits', { params: { from: weekFrom, to: weekTo } }).then(r => Array.isArray(r.data) ? r.data : []),
  })

  const { data: people = [] } = useQuery({
    queryKey: ['homecare-people'],
    queryFn: () => api.get('/people?status=active').then(r => Array.isArray(r.data) ? r.data : (r.data?.people || [])),
  })

  const createVisit = useMutation({
    mutationFn: (data: any) => api.post('/homecare/visits', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['homecare-visits-week'] })
      setCreateDialog(false)
      setCreateForm({ person_id: '', label: 'Routine call', visit_type: 'routine', day: new Date().toISOString().slice(0, 10), start_time: '09:00', duration_minutes: 30 })
    },
    onError: (e: any) => alert(e.response?.data?.message || 'Could not create call'),
  })

  // Group visits by day
  const dayMap = new Map<string, Visit[]>()
  for (const d of weekDays) dayMap.set(d, [])
  for (const v of visits) {
    const day = new Date(v.scheduled_start).toISOString().slice(0, 10)
    if (dayMap.has(day)) dayMap.get(day)!.push(v)
  }

  const totalCalls = visits.length
  const assignedCalls = visits.filter((v: any) => v.assigned_staff_id).length
  const unassignedCalls = totalCalls - assignedCalls

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Weekly Call Planner</Typography>
          <Typography variant="body2" sx={{ color: '#6B7280', mt: 0.5 }}>
            {dayName(weekFrom)} {dayNum(weekFrom)} - {dayName(weekTo)} {dayNum(weekTo)} · {totalCalls} calls · {assignedCalls} assigned · {unassignedCalls} unassigned
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setCreateDialog(true)} sx={{ textTransform: 'none', borderColor: '#0F4C81', color: '#0F4C81', fontWeight: 600 }}>
            Add call
          </Button>
          <Button size="small" onClick={() => setWeekOffset(w => w - 1)} sx={{ minWidth: 'auto' }}><ChevronLeftIcon /></Button>
          <Button size="small" variant="outlined" onClick={() => setWeekOffset(0)} sx={{ textTransform: 'none' }}>Today</Button>
          <Button size="small" onClick={() => setWeekOffset(w => w + 1)} sx={{ minWidth: 'auto' }}><ChevronRightIcon /></Button>
        </Stack>
      </Stack>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Box sx={{ minWidth: 900 }}>
            {/* Day headers */}
            <Stack direction="row" sx={{ mb: 1 }}>
              <Box sx={{ width: 60, flexShrink: 0 }} />
              {weekDays.map(d => {
                const isToday = d === new Date().toISOString().slice(0, 10)
                const dayVisits = dayMap.get(d) || []
                return (
                  <Box key={d} sx={{ flex: 1, textAlign: 'center', px: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: isToday ? '#0F4C81' : '#374151' }}>{dayName(d)}</Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: isToday ? '#0F4C81' : '#6B7280' }}>{dayNum(d)}</Typography>
                    <Chip label={dayVisits.length} size="small" sx={{ mt: 0.5, height: 18, fontSize: '0.6rem', bgcolor: dayVisits.length > 0 ? '#E0F2FE' : '#F3F4F6', color: dayVisits.length > 0 ? '#0F4C81' : '#9CA3AF', fontWeight: 600 }} />
                  </Box>
                )
              })}
            </Stack>

            {/* Time grid */}
            {HOURS.map(hour => (
              <Stack key={hour} direction="row" sx={{ borderTop: '1px solid #F3F4F6' }}>
                <Box sx={{ width: 60, flexShrink: 0, py: 1, px: 1, textAlign: 'right' }}>
                  <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 600 }}>{String(hour).padStart(2, '0')}:00</Typography>
                </Box>
                {weekDays.map(d => {
                  const dayVisits = (dayMap.get(d) || []).filter((v: any) => {
                    const h = new Date(v.scheduled_start).getHours()
                    return h === hour
                  })
                  return (
                    <Box key={d} sx={{ flex: 1, py: 0.5, px: 0.25, minHeight: 32 }}>
                      {dayVisits.map((v: any) => (
                        <Paper
                          key={v.id}
                          elevation={0}
                          sx={{
                            p: 0.5, mb: 0.25,
                            bgcolor: v.assigned_staff_id ? (v.status === 'completed' ? '#E9F7F0' : '#E0F2FE') : '#FFF5D9',
                            border: `1px solid ${v.assigned_staff_id ? (v.status === 'completed' ? '#BBF7D0' : '#BAE6FD') : '#FDE68A'}`,
                            borderRadius: 1,
                            cursor: 'pointer',
                            '&:hover': { borderColor: '#0F4C81' },
                          }}
                          title={`${v.person_name} - ${v.label}${v.carer_name ? ` (${v.carer_name})` : ' (Unassigned)'}`}
                        >
                          <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.65rem', display: 'block', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {time(v.scheduled_start)} {v.person_name}
                          </Typography>
                          <Typography variant="caption" sx={{ fontSize: '0.55rem', color: v.assigned_staff_id ? '#6B7280' : '#D97706', display: 'block', lineHeight: 1.2 }}>
                            {v.carer_name || 'Unassigned'}
                          </Typography>
                        </Paper>
                      ))}
                    </Box>
                  )
                })}
              </Stack>
            ))}
          </Box>
        </Box>
      )}

      {/* Create call dialog */}
      <Dialog open={createDialog} onClose={() => setCreateDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add a call</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField select required label="Client" value={createForm.person_id} onChange={e => setCreateForm(f => ({ ...f, person_id: e.target.value }))}>
              <MenuItem value="">Select client</MenuItem>
              {people.map((p: any) => <MenuItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</MenuItem>)}
            </TextField>
            <TextField label="Call label" value={createForm.label} onChange={e => setCreateForm(f => ({ ...f, label: e.target.value }))} />
            <TextField select label="Call type" value={createForm.visit_type} onChange={e => setCreateForm(f => ({ ...f, visit_type: e.target.value }))}>
              {['morning', 'breakfast', 'lunch', 'tea', 'evening', 'night', 'routine', 'medication', 'custom'].map(t => (
                <MenuItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</MenuItem>
              ))}
            </TextField>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField type="date" label="Date" value={createForm.day} onChange={e => setCreateForm(f => ({ ...f, day: e.target.value }))} InputLabelProps={{ shrink: true }} sx={{ flex: 1 }} />
              <TextField type="time" label="Start time" value={createForm.start_time} onChange={e => setCreateForm(f => ({ ...f, start_time: e.target.value }))} InputLabelProps={{ shrink: true }} sx={{ flex: 1 }} />
              <TextField type="number" label="Duration (min)" value={createForm.duration_minutes} onChange={e => setCreateForm(f => ({ ...f, duration_minutes: Number(e.target.value) }))} sx={{ flex: 1 }} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialog(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" disabled={!createForm.person_id || !createForm.label.trim() || createVisit.isPending} onClick={() => {
            const start = new Date(`${createForm.day}T${createForm.start_time}:00`)
            const end = new Date(start.getTime() + createForm.duration_minutes * 60000)
            // Find a package for this person (use first active one)
            api.get('/homecare/packages').then(r => {
              const pkg = (Array.isArray(r.data) ? r.data : []).find((p: any) => p.person_id === createForm.person_id && p.status === 'active')
              if (!pkg) throw new Error('No active care package for this client. Create a package first.')
              createVisit.mutate({
                package_id: pkg.id,
                person_id: createForm.person_id,
                visit_type: createForm.visit_type,
                label: createForm.label,
                scheduled_start: start.toISOString(),
                scheduled_end: end.toISOString(),
              })
            }).catch((e: any) => alert(e.message || 'Could not create call'))
          }} sx={{ textTransform: 'none', bgcolor: '#0F4C81' }}>
            {createVisit.isPending ? <CircularProgress size={18} color="inherit" /> : 'Add call'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
