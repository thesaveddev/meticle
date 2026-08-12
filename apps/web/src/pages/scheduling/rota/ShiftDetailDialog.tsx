import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Stack,
  Chip, Divider, Box,
} from '@mui/material'
import { Schedule as ScheduleIcon, LocationOn as LocationIcon, Person as PersonIcon, Warning as WarningIcon } from '@mui/icons-material'
import { rotaHelpers } from './helpers'

const { shiftVisual } = rotaHelpers

interface ShiftDetailDialogProps {
  shift: any
  open: boolean
  onClose: () => void
}

const fmtDate = (iso: string) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

const fmtTime = (iso: string) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export default function ShiftDetailDialog({ shift, open, onClose }: ShiftDetailDialogProps) {
  if (!shift) return null
  const isOpen = (shift.assignments?.length || 0) === 0

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
        Shift Detail
        {isOpen && <Chip label="Open shift" size="small" sx={{ ml: 1, height: 18, fontSize: '0.6rem', bgcolor: '#FEF3C7', color: '#92400E' }} />}
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={1.5}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <LocationIcon sx={{ fontSize: 16, color: '#0F4C81' }} />
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{shift.location_name || '—'}</Typography>
              {shift.shift_type && shift.shift_type !== 'day' && (
                <Chip label={shift.shift_type === 'sleep' ? 'Sleep' : 'Wake Night'} size="small"
                  sx={{ height: 17, fontSize: '0.58rem', bgcolor: shiftVisual(shift).chipBg, color: shiftVisual(shift).chipFg, fontWeight: 700 }} />
              )}
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <ScheduleIcon sx={{ fontSize: 16, color: '#6B7280' }} />
              <Typography variant="body2" color="text.secondary">
                {fmtDate(shift.start_time)} · {fmtTime(shift.start_time)} – {fmtTime(shift.end_time)}
              </Typography>
            </Stack>
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>Assigned Staff</Typography>
            {shift.assignments?.length > 0 ? (
              <Stack spacing={0.5}>
                {shift.assignments.map((a: any) => (
                  <Stack key={a.id} direction="row" spacing={1} alignItems="center">
                    <PersonIcon sx={{ fontSize: 15, color: '#6B7280' }} />
                    <Typography variant="body2">{a.first_name} {a.last_name}</Typography>
                    {a.is_overtime && <Chip label="OT" size="small" sx={{ height: 15, fontSize: '0.55rem', bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 700 }} />}
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Stack direction="row" spacing={1} alignItems="center">
                <WarningIcon sx={{ fontSize: 15, color: '#F59E0B' }} />
                <Typography variant="body2" color="text.secondary">No staff assigned — open shift</Typography>
              </Stack>
            )}
          </Box>

          {shift.su_first_name && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>Service User</Typography>
                <Typography variant="body2">{shift.su_first_name} {shift.su_last_name || ''}</Typography>
              </Box>
            </>
          )}

          {shift.agency_id && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>Agency</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label="Agency shift" size="small" sx={{ height: 17, fontSize: '0.58rem', bgcolor: '#DBEAFE', color: '#1E40AF' }} />
                  <Chip label={shift.agency_covered ? 'Covered' : 'Uncovered'} size="small"
                    sx={{ height: 17, fontSize: '0.58rem', bgcolor: shift.agency_covered ? '#D1FAE5' : '#FEF3C7', color: shift.agency_covered ? '#065F46' : '#92400E' }} />
                </Stack>
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} sx={{ bgcolor: '#0F4C81', color: '#fff', '&:hover': { bgcolor: '#0A3A61' } }}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
