import { useEffect, useState } from 'react'
import { Box, Button, Chip, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { Add as AddIcon, Schedule as ScheduleIcon } from '@mui/icons-material'
import { UserRole } from '@meticle/shared'
import api from '../../services/api'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface AvailabilityRecord {
  id: string
  staff_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_available: boolean
  staff_name?: string
}

interface StaffMember {
  id: string
  first_name: string
  last_name: string
}

export default function AvailabilityPage() {
  const userStr = localStorage.getItem('user')
  let rawUser: any = {}
  try { rawUser = userStr ? JSON.parse(userStr) : {} } catch { rawUser = {} }
  const isCarer = rawUser.role === UserRole.CARE_WORKER

  const [loading, setLoading] = useState(true)
  const [availability, setAvailability] = useState<AvailabilityRecord[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [selectedStaff, setSelectedStaff] = useState(isCarer ? '' : '')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [day, setDay] = useState('1')
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('17:00')

  const load = async () => {
    setLoading(true)
    try {
      if (isCarer) {
        const res = await api.get('/homecare/my-availability')
        setAvailability(res.data)
      } else {
        const [availRes, staffRes] = await Promise.all([
          api.get('/homecare/availability'),
          api.get('/homecare/staff'),
        ])
        setAvailability(availRes.data)
        setStaff(staffRes.data)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const addAvailability = async () => {
    setSaving(true)
    try {
      const staffId = isCarer ? undefined : selectedStaff
      await api.post('/homecare/availability', {
        staff_id: staffId,
        day_of_week: Number(day),
        start_time: start,
        end_time: end,
      })
      setDialogOpen(false)
      await load()
    } finally { setSaving(false) }
  }

  const deleteAvailability = async (id: string) => {
    await api.delete(`/homecare/availability/${id}`)
    await load()
  }

  // Group availability by day
  const byDay: Record<number, AvailabilityRecord[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
  for (const rec of availability) {
    byDay[rec.day_of_week] = byDay[rec.day_of_week] || []
    byDay[rec.day_of_week].push(rec)
  }

  const totalHours = availability.reduce((sum, rec) => {
    const [sh, sm] = rec.start_time.split(':').map(Number)
    const [eh, em] = rec.end_time.split(':').map(Number)
    return sum + ((eh * 60 + em) - (sh * 60 + sm)) / 60
  }, 0)

  if (loading) return <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress /></Box>

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 1 }}>
        <ScheduleIcon sx={{ color: '#10b981', fontSize: 28 }} />
        <Typography variant="h4" sx={{ fontWeight: 800 }}>{isCarer ? 'My Availability' : 'Carer Availability'}</Typography>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {isCarer
          ? 'Set the days and times you are available for care calls. Your manager will use this to assign visits.'
          : 'Manage availability for your carers. Carers can also set their own availability from the mobile app or web.'
        }
      </Typography>

      {/* Summary */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
        <Chip label={`${availability.length} entries`} size="small" sx={{ bgcolor: '#E9F7F0', color: '#047857' }} />
        <Chip label={`~${totalHours.toFixed(0)} hours/week`} size="small" sx={{ bgcolor: '#E0F2FE', color: '#0F4C81' }} />
      </Stack>

      {/* Manager: carer filter */}
      {!isCarer && staff.length > 0 && (
        <TextField select size="small" label="Filter by carer" value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)} sx={{ mb: 3, minWidth: 200 }}>
          <MenuItem value="">All carers</MenuItem>
          {staff.map(s => <MenuItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</MenuItem>)}
        </TextField>
      )}

      {/* Weekly grid */}
      <Stack spacing={1.5}>
        {DAYS.map((dayName, dayIndex) => {
          const dayRecords = (byDay[dayIndex] || []).filter(r => !selectedStaff || r.staff_id === selectedStaff)
          return (
            <Box key={dayIndex} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', py: 1.5, borderBottom: '1px solid #F3F4F6' }}>
              <Box sx={{ width: 100, flexShrink: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, color: dayRecords.length > 0 ? '#10b981' : '#9CA3AF' }}>{dayName}</Typography>
              </Box>
              <Box sx={{ flex: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {dayRecords.length === 0 ? (
                  <Typography variant="caption" color="text.secondary" sx={{ py: 1 }}>No availability set</Typography>
                ) : (
                  dayRecords.map(rec => (
                    <Chip
                      key={rec.id}
                      label={`${rec.start_time} - ${rec.end_time}${rec.staff_name ? ` (${rec.staff_name})` : ''}`}
                      size="small"
                      onDelete={isCarer || rawUser.role === UserRole.ORG_ADMIN || rawUser.role === UserRole.MANAGER ? () => deleteAvailability(rec.id) : undefined}
                      sx={{ bgcolor: '#E9F7F0', color: '#047857', '& .MuiChip-deleteIcon': { color: '#DC2626' } }}
                    />
                  ))
                )}
              </Box>
            </Box>
          )
        })}
      </Stack>

      {/* Add button */}
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}
        sx={{ mt: 3, bgcolor: '#10b981', '&:hover': { bgcolor: '#047857' } }}>
        Add availability
      </Button>

      {/* Add dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add availability</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {!isCarer && staff.length > 0 && (
              <TextField select label="Carer" value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)} fullWidth>
                {staff.map(s => <MenuItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</MenuItem>)}
              </TextField>
            )}
            <TextField select label="Day" value={day} onChange={e => setDay(e.target.value)} fullWidth>
              {DAYS.map((label, index) => <MenuItem key={label} value={String(index)}>{label}</MenuItem>)}
            </TextField>
            <Stack direction="row" spacing={2}>
              <TextField label="From" type="time" value={start} onChange={e => setStart(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
              <TextField label="To" type="time" value={end} onChange={e => setEnd(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={addAvailability} disabled={saving || (!isCarer && !selectedStaff)}
            sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#047857' } }}>
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}
