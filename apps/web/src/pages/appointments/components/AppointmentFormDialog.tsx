import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Chip, Dialog, DialogContent, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography, useMediaQuery, useTheme } from '@mui/material'
import { WarningAmber as AlertIcon, Check as CheckIcon } from '@mui/icons-material'
import { staffAvailabilityFor, staffShiftHelper } from './availability'

export interface AppointmentFormValues {
  title: string
  description: string
  notes: string
  person_id: string
  staff_id: string
  location_id: string
  where_text: string
  recurrence: string
  start_time: string
  end_time: string
  status: string
}

interface Props {
  open: boolean
  mode: 'new' | 'edit'
  initial: AppointmentFormValues
  people: any[]
  staff: any[]
  locations: any[]
  dayShifts: any[]
  saving: boolean
  onClose: () => void
  onSave: (values: AppointmentFormValues) => void
}

const RECURRENCE = ['once', 'daily', 'monthly', 'yearly'] as const
const RECURRENCE_LABELS: Record<string, string> = { once: 'Once', daily: 'Daily', monthly: 'Monthly', yearly: 'Yearly' }

// Figma 7.6 form: header with subtitle, inline helpers under every field,
// Repeats as pills, a "needs attention" banner that counts problems and keeps
// every typed value, and a Saving state that asks the carer to keep the window
// open. The native datetime inputs stand in for the designed formatted fields.
export default function AppointmentFormDialog({ open, mode, initial, people, staff, locations, dayShifts, saving, onClose, onSave }: Props) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [form, setForm] = useState<AppointmentFormValues>(initial)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => { if (open) { setForm(initial); setSubmitted(false) } }, [open, initial])

  const set = (patch: Partial<AppointmentFormValues>) => setForm(f => ({ ...f, ...patch }))

  const errors = useMemo(() => {
    const list: { field: string; message: string }[] = []
    if (!form.title.trim()) list.push({ field: 'title', message: 'Give the appointment a short title.' })
    if (form.start_time && form.end_time && new Date(form.end_time) <= new Date(form.start_time)) {
      list.push({ field: 'end_time', message: `The end is before the start. Choose a time after ${form.start_time.slice(11, 16)}.` })
    }
    if (!form.start_time) list.push({ field: 'start_time', message: 'Choose when the appointment starts.' })
    if (!form.end_time) list.push({ field: 'end_time', message: 'Choose when the appointment ends.' })
    return list
  }, [form])

  const titleError = submitted ? errors.find(e => e.field === 'title')?.message : undefined
  const endError = submitted ? errors.find(e => e.field === 'end_time')?.message : undefined

  const availability = useMemo(() => {
    if (!form.start_time || !form.end_time) return []
    try {
      return staffAvailabilityFor(staff, dayShifts, new Date(form.start_time).toISOString(), new Date(form.end_time).toISOString())
    } catch { return [] }
  }, [staff, dayShifts, form.start_time, form.end_time])
  const selectedStaff = staff.find((s: any) => (s.staff_id || s.id) === form.staff_id)
  const staffHelper = staffShiftHelper(availability, form.staff_id, selectedStaff?.first_name) || 'Assigned staff see it on their day.'

  const save = () => {
    setSubmitted(true)
    if (errors.length > 0) return
    onSave(form)
  }

  const fieldSx = (invalid?: boolean) => ({
    '& .MuiOutlinedInput-root': {
      borderRadius: 2, bgcolor: 'background.paper',
      ...(!invalid ? {} : { '& fieldset': { borderColor: 'notice.error.fg' } }),
    },
  })

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={isMobile}>
      <DialogContent sx={{ p: 0 }}>
        <Stack spacing={2} sx={{ p: { xs: 2.5, sm: 3 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" sx={{ color: '#0164C8', fontWeight: 700, letterSpacing: '0.08em' }}>
              APPOINTMENTS
            </Typography>
            <Typography role="button" tabIndex={0} onClick={onClose}
              onKeyDown={e => { if (e.key === 'Enter') onClose() }}
              sx={{ fontSize: 13, fontWeight: 600, color: '#0164C8', cursor: 'pointer' }}>
              Close
            </Typography>
          </Stack>

          <Box>
            <Typography variant="h6" fontWeight={600}>{mode === 'new' ? 'New appointment' : 'Edit appointment'}</Typography>
            <Typography variant="body2" color="text.secondary">
              Staff and the person's keyworker will see it on their day.
            </Typography>
          </Box>

          {submitted && errors.length > 0 && (
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'notice.error.bg', border: '1px solid', borderColor: 'notice.error.fg', display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
              <AlertIcon sx={{ color: 'notice.error.fg', mt: 0.25 }} />
              <Box>
                <Typography variant="body2" fontWeight={700}>
                  {errors.length} thing{errors.length === 1 ? '' : 's'} need{errors.length === 1 ? 's' : ''} your attention
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {errors[0].message} Everything else is still here.
                </Typography>
              </Box>
            </Box>
          )}

          <Box>
            <TextField label="Title" fullWidth required value={form.title} placeholder="For example, GP review"
              error={!!titleError} helperText={titleError || ''}
              onChange={e => set({ title: e.target.value })} sx={fieldSx(!!titleError)} />
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Box sx={{ flex: 1 }}>
              <FormControl fullWidth>
                <InputLabel>Person</InputLabel>
                <Select value={form.person_id} label="Person" onChange={e => set({ person_id: e.target.value })} sx={{ borderRadius: 2, bgcolor: 'background.paper' }}>
                  <MenuItem value="">Team / general</MenuItem>
                  {people.map(p => <MenuItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</MenuItem>)}
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Choose "Team / general" for staff appointments.
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <FormControl fullWidth>
                <InputLabel>Staff member</InputLabel>
                <Select value={form.staff_id} label="Staff member" onChange={e => set({ staff_id: e.target.value })} sx={{ borderRadius: 2, bgcolor: 'background.paper' }}>
                  <MenuItem value="">Unassigned</MenuItem>
                  {staff.map(s => <MenuItem key={s.staff_id || s.id} value={s.staff_id || s.id}>{s.first_name} {s.last_name}</MenuItem>)}
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {staffHelper}
              </Typography>
            </Box>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Box sx={{ flex: 1 }}>
              <TextField label="Start" type="datetime-local" fullWidth InputLabelProps={{ shrink: true }}
                value={form.start_time} onChange={e => set({ start_time: e.target.value })} sx={fieldSx()} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <TextField label="End" type="datetime-local" fullWidth InputLabelProps={{ shrink: true }}
                value={form.end_time} error={!!endError} helperText={endError || ''}
                onChange={e => set({ end_time: e.target.value })} sx={fieldSx(!!endError)} />
            </Box>
          </Stack>

          <Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Box sx={{ flex: 1 }}>
                <TextField label="Where" fullWidth value={form.where_text} placeholder="Specsavers, Five Ways"
                  onChange={e => set({ where_text: e.target.value })} sx={fieldSx()} />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  Shown to staff on their day, with a map link on mobile.
                </Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <FormControl fullWidth>
                  <InputLabel>Home / location</InputLabel>
                  <Select value={form.location_id} label="Home / location" onChange={e => set({ location_id: e.target.value })} sx={{ borderRadius: 2, bgcolor: 'background.paper' }}>
                    <MenuItem value="">No home</MenuItem>
                    {locations.map(l => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  Used to filter the rota and the week view.
                </Typography>
              </Box>
            </Stack>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, fontSize: 12 }}>Repeats</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {RECURRENCE.map(r => {
                const selected = form.recurrence === r
                return (
                  <Chip key={r} label={RECURRENCE_LABELS[r]} clickable
                    icon={selected ? <CheckIcon sx={{ fontSize: '16px !important' }} /> : undefined}
                    onClick={() => set({ recurrence: r })}
                    sx={selected
                      ? { bgcolor: '#0164C8', color: '#fff', fontWeight: 700, '& .MuiChip-icon': { color: '#fff' } }
                      : { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }} />
                )
              })}
            </Stack>
          </Box>

          <Box>
            <TextField label="Description" fullWidth multiline rows={2} value={form.description}
              placeholder="What is this appointment for?"
              onChange={e => set({ description: e.target.value })} sx={fieldSx()}
              InputProps={{ endAdornment: <Typography variant="caption" color="text.secondary">Optional</Typography> }} />
          </Box>

          <Box>
            <TextField label="Notes" fullWidth multiline rows={2} value={form.notes}
              onChange={e => set({ notes: e.target.value })} sx={fieldSx()}
              InputProps={{ endAdornment: <Typography variant="caption" color="text.secondary">Optional</Typography> }} />
          </Box>

          <Box>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={form.status} label="Status" onChange={e => set({ status: e.target.value })} sx={{ borderRadius: 2, bgcolor: 'background.paper' }}>
                <MenuItem value="scheduled">Scheduled</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
                <MenuItem value="no_show">No show</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1} justifyContent="flex-end" alignItems="center">
            {saving && (
              <Typography variant="caption" color="text.secondary" sx={{ mr: { sm: 'auto' } }}>
                Please keep this window open
              </Typography>
            )}
            <Button onClick={onClose} sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 600 }}
              fullWidth={isMobile}>
              Cancel
            </Button>
            <Button variant="contained" onClick={save} disabled={saving} fullWidth={isMobile}
              sx={{ bgcolor: '#0164C8', textTransform: 'none', fontWeight: 600, borderRadius: 999, px: 3 }}>
              {saving ? 'Saving...' : mode === 'new' ? 'Save appointment' : 'Save changes'}
            </Button>
          </Stack>

        </Stack>
      </DialogContent>
    </Dialog>
  )
}
