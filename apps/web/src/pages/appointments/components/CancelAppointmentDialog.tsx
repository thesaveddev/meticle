import { useEffect, useState } from 'react'
import { Box, Button, Chip, Dialog, DialogContent, Stack, TextField, Typography, useMediaQuery, useTheme } from '@mui/material'
import { Check as CheckIcon } from '@mui/icons-material'

interface Props {
  appointment: any | null
  confirming: boolean
  onClose: () => void
  onConfirm: (reason: string, message: string) => void
}

export const CANCELLATION_REASONS = ['Person declined', 'Clinic cancelled', 'Rearranged', 'Other']

// Figma 7.6 cancel: reason pills, an optional message for the team, and the
// reassurance that the row stays in the list as Cancelled.
export default function CancelAppointmentDialog({ appointment: a, confirming, onClose, onConfirm }: Props) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [reason, setReason] = useState('Clinic cancelled')
  const [message, setMessage] = useState('')

  useEffect(() => { if (a) { setReason('Clinic cancelled'); setMessage('') } }, [a])

  if (!a) return null
  const when = new Date(a.start_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <Dialog open={!!a} onClose={onClose} maxWidth="xs" fullWidth fullScreen={isMobile}>
      <DialogContent sx={{ p: 0 }}>
        <Stack spacing={2} sx={{ p: { xs: 2.5, sm: 3 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" sx={{ color: '#0164C8', fontWeight: 700, letterSpacing: '0.08em' }}>
              APPOINTMENTS
            </Typography>
            <Typography role="button" tabIndex={0} aria-label="Close cancellation" onClick={onClose}
              onKeyDown={e => { if (e.key === 'Enter') onClose() }}
              sx={{ fontSize: 13, fontWeight: 600, color: '#0164C8', cursor: 'pointer' }}>
              Close
            </Typography>
          </Stack>

          <Box>
            <Typography variant="h6" fontWeight={600}>Cancel this appointment?</Typography>
            <Typography variant="body2" color="text.secondary">
              {a.title} · {when}, {new Date(a.start_time).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, fontSize: 12 }}>Reason</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {CANCELLATION_REASONS.map(r => {
                const selected = reason === r
                return (
                  <Chip key={r} label={r} clickable onClick={() => setReason(r)}
                    icon={selected ? <CheckIcon sx={{ fontSize: '16px !important' }} /> : undefined}
                    sx={selected
                      ? { bgcolor: '#0164C8', color: '#FFFFFF', fontWeight: 700, '& .MuiChip-icon': { color: '#FFFFFF' } }
                      : { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }} />
                )
              })}
            </Stack>
          </Box>

          <Box>
            <TextField label="Message for the team" fullWidth multiline rows={3} value={message}
              placeholder="Surgery called to cancel. They'll offer a new date this week."
              onChange={e => setMessage(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'background.paper' } }}
              InputProps={{ endAdornment: <Typography variant="caption" color="text.secondary">Optional</Typography> }} />
          </Box>

          <Typography variant="caption" color="text.secondary">
            The appointment stays in the list as Cancelled, so there is a record.
          </Typography>

          <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1} justifyContent="flex-end">
            <Button onClick={onClose} sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 999 }} fullWidth={isMobile}>
              Keep it
            </Button>
            <Button variant="contained" disabled={confirming} fullWidth={isMobile}
              onClick={() => onConfirm(reason, message)}
              sx={{ bgcolor: '#0164C8', textTransform: 'none', fontWeight: 600, borderRadius: 999, px: 3 }}>
              {confirming ? 'Cancelling...' : 'Cancel appointment'}
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  )
}
