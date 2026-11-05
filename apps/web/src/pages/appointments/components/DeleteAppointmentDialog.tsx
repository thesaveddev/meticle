import { Box, Button, Dialog, DialogContent, Stack, Typography, useMediaQuery, useTheme } from '@mui/material'
import { Description as DocIcon } from '@mui/icons-material'

interface Props {
  appointment: any | null
  deleting: boolean
  onClose: () => void
  onDelete: () => void
  onCancelInstead: () => void
}

// Figma 7.6 delete: spell out that removal is for everyone and permanent,
// offer the Cancel-instead path that keeps the record, then the red action.
export default function DeleteAppointmentDialog({ appointment: a, deleting, onClose, onDelete, onCancelInstead }: Props) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
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
            <Typography role="button" tabIndex={0} onClick={onClose}
              onKeyDown={e => { if (e.key === 'Enter') onClose() }}
              sx={{ fontSize: 13, fontWeight: 600, color: '#0164C8', cursor: 'pointer' }}>
              Close
            </Typography>
          </Stack>

          <Typography variant="h6" fontWeight={600}>Delete this appointment?</Typography>
          <Typography variant="body2" color="text.secondary">
            {a.title} on {when} at {new Date(a.start_time).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })} will be
            removed for everyone, along with its notes. This can't be undone.
          </Typography>

          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'notice.info.bg', display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
            <DocIcon sx={{ color: '#0164C8', mt: 0.25 }} />
            <Box>
              <Typography variant="body2" fontWeight={700}>Want to keep a record?</Typography>
              <Typography variant="body2" color="text.secondary">
                Cancel it instead. It stays in the list as Cancelled, with the reason.
              </Typography>
            </Box>
          </Box>

          <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1} justifyContent="flex-end">
            <Button onClick={onClose} sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 999 }} fullWidth={isMobile}>
              Keep it
            </Button>
            <Button variant="outlined" onClick={onCancelInstead} sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 999 }} fullWidth={isMobile}>
              Cancel it instead
            </Button>
            <Button variant="contained" color="error" disabled={deleting} onClick={onDelete}
              sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 999 }} fullWidth={isMobile}>
              {deleting ? 'Deleting...' : 'Delete appointment'}
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  )
}
