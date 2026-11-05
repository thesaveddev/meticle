import { Box, Button, Chip, Dialog, DialogContent, Divider, Stack, Typography, useMediaQuery, useTheme } from '@mui/material'
import { STATUS_PILL } from './statusPill'

interface Props {
  appointment: any | null
  onClose: () => void
  onEdit: (a: any) => void
  onDelete: (a: any) => void
  onAssign: (a: any) => void
  onComplete: (a: any) => void
  canManage: boolean
}

const fmtT = (iso: string) => {
  const d = new Date(iso)
  const h = d.getHours() % 12 || 12
  return `${h}:${String(d.getMinutes()).padStart(2, '0')}`
}
const ampm = (iso: string) => (new Date(iso).getHours() < 12 ? 'am' : 'pm')
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

// Figma 7.6 detail: APPOINTMENTS label + Close, title, status pills, a
// Person / Staff / When / Where grid, Description, and Delete | Edit |
// Assign staff. Mobile stacks the buttons with a red Delete link.
export default function AppointmentDetailDialog({ appointment: a, onClose, onEdit, onDelete, onAssign, onComplete, canManage }: Props) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  if (!a) return null

  const unstaffed = a.status === 'scheduled' && !a.staff_id
  const pill = STATUS_PILL[a.status] || STATUS_PILL.scheduled
  const where = a.where_text || a.location_name || ''
  const when = `${fmtDay(a.start_time)}, ${fmtT(a.start_time)} - ${fmtT(a.end_time)} ${ampm(a.end_time)}`

  const field = (label: string, value: React.ReactNode, red?: boolean) => (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 12 }}>{label}</Typography>
      <Typography variant="body2" fontWeight={400} sx={red ? { color: 'notice.error.fg' } : undefined}>{value}</Typography>
    </Box>
  )

  return (
    <Dialog open={!!a} onClose={onClose} maxWidth="sm" fullWidth fullScreen={isMobile}>
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
            <Typography variant="h6" fontWeight={600}>{a.title}</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
              <Chip size="small" label={(a.status || '').replace(/_/g, ' ')}
                sx={{ bgcolor: pill.bg, color: pill.fg, fontWeight: 600, textTransform: 'capitalize', fontSize: 12 }} />
              {unstaffed && (
                <Chip size="small" label="Needs staff"
                  sx={{ bgcolor: 'notice.error.bg', color: 'notice.error.fg', fontWeight: 600, fontSize: 12 }} />
              )}
            </Stack>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            {field('Person', a.person_name || 'Team / general')}
            {field('Staff member', a.staff_name || 'Not assigned yet', !a.staff_name)}
            {field('When', when)}
            {where ? field('Where',
              a.where_text ? (
                <a href={`https://www.google.com/maps/search/${encodeURIComponent(a.where_text)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ color: '#0164C8', textDecoration: 'none' }}>{where}</a>
              ) : where,
            ) : field('Where', '—')}
          </Box>

          {field('Description', a.description || 'No description recorded.')}
          {(a.notes || a.cancellation_reason || a.cancellation_note) && (
            <Box>
              {a.status === 'cancelled' && (a.cancellation_reason || a.cancellation_note) ? (
                <>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 12 }}>Cancellation</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {[a.cancellation_reason, a.cancellation_note].filter(Boolean).join(' — ')}
                  </Typography>
                </>
              ) : (
                field('Notes', a.notes || 'No notes recorded.')
              )}
            </Box>
          )}

          <Divider />

          {canManage ? (
            isMobile ? (
              <Stack spacing={1}>
                {a.status === 'scheduled' && (a.staff_id
                  ? <Button variant="contained" fullWidth onClick={() => onComplete(a)} sx={{ bgcolor: '#087A55', textTransform: 'none', fontWeight: 600, borderRadius: 999 }}>Mark complete</Button>
                  : <Button variant="contained" fullWidth onClick={() => onAssign(a)} sx={{ bgcolor: '#0164C8', textTransform: 'none', fontWeight: 600, borderRadius: 999 }}>Assign staff</Button>)}
                <Button variant="outlined" fullWidth onClick={() => onEdit(a)} sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 999 }}>Edit</Button>
                <Typography role="button" tabIndex={0} onClick={() => onDelete(a)}
                  onKeyDown={e => { if (e.key === 'Enter') onDelete(a) }}
                  sx={{ fontSize: 13, fontWeight: 600, color: 'notice.error.fg', cursor: 'pointer', textAlign: 'center', py: 0.5 }}>
                  Delete appointment
                </Typography>
              </Stack>
            ) : (
              <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                <Button onClick={() => onDelete(a)} sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 600 }}>
                  Delete
                </Button>
                <Stack direction="row" spacing={1}>
                  <Button variant="outlined" onClick={() => onEdit(a)} sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 999 }}>
                    Edit
                  </Button>
                  {a.status === 'scheduled' && (a.staff_id
                    ? <Button variant="contained" onClick={() => onComplete(a)} sx={{ bgcolor: '#087A55', textTransform: 'none', fontWeight: 600, borderRadius: 999 }}>Mark complete</Button>
                    : <Button variant="contained" onClick={() => onAssign(a)} sx={{ bgcolor: '#0164C8', textTransform: 'none', fontWeight: 600, borderRadius: 999 }}>Assign staff</Button>)}
                </Stack>
              </Stack>
            )
          ) : (
            <Stack direction="row" justifyContent="flex-end">
              <Button onClick={onClose} sx={{ textTransform: 'none', fontWeight: 600 }}>Close</Button>
            </Stack>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  )
}
