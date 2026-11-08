import { useEffect, useMemo, useState } from 'react'
import { Avatar, Box, Button, Chip, Dialog, DialogContent, Stack, Typography, useMediaQuery, useTheme } from '@mui/material'
import { staffAvailabilityFor } from './availability'

interface Props {
  appointment: any | null
  staff: any[]
  dayShifts: any[]
  assigning: boolean
  onClose: () => void
  onAssign: (staffId: string) => void
}

// Figma 7.6 assign: "Who will support Sam?" with one row per staffer, the
// selected row ringed blue, Available only where the rota genuinely overlaps,
// and the footnote explaining the ordering. Footer assigns the chosen name.
export default function AssignStaffDialog({ appointment: a, staff, dayShifts, assigning, onClose, onAssign }: Props) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [selected, setSelected] = useState('')

  const rows = useMemo(() => {
    if (!a) return []
    try {
      return staffAvailabilityFor(staff, dayShifts, new Date(a.start_time).toISOString(), new Date(a.end_time).toISOString())
    } catch { return [] }
  }, [a, staff, dayShifts])

  useEffect(() => {
    if (a) setSelected(rows.find(r => r.available)?.staff_id || '')
  }, [a, rows])

  if (!a) return null
  const chosen = rows.find(r => r.staff_id === selected)
  const personFirst = (a.person_name || '').split(' ')[0] || 'them'
  const when = `${new Date(a.start_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}, ${new Date(a.start_time).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })} - ${new Date(a.end_time).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}`

  return (
    <Dialog open={!!a} onClose={onClose} maxWidth="xs" fullWidth fullScreen={isMobile}>
      <DialogContent sx={{ p: 0 }}>
        <Stack spacing={2} sx={{ p: { xs: 2.5, sm: 3 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" sx={{ color: '#0164C8', fontWeight: 700, letterSpacing: '0.08em' }}>
              APPOINTMENTS
            </Typography>
            <Typography role="button" tabIndex={0} aria-label="Close staff assignment" onClick={onClose}
              onKeyDown={e => { if (e.key === 'Enter') onClose() }}
              sx={{ fontSize: 13, fontWeight: 600, color: '#0164C8', cursor: 'pointer' }}>
              Close
            </Typography>
          </Stack>

          <Box>
            <Typography variant="h6" fontWeight={600}>Who will support {personFirst}?</Typography>
            <Typography variant="body2" color="text.secondary">
              {a.title} - {when}
            </Typography>
          </Box>

          <Stack spacing={1}>
            {rows.map(r => {
              const active = r.staff_id === selected
              return (
                <Box key={r.staff_id} onClick={() => setSelected(r.staff_id)}
                  role="button" tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter') setSelected(r.staff_id) }}
                  sx={{
                    display: 'flex', gap: 1.5, alignItems: 'center',
                    p: 1.25, borderRadius: 2, cursor: 'pointer',
                    border: '1px solid', borderColor: active ? '#0164C8' : '#E3E9F0',
                    bgcolor: 'background.paper',
                    '&:hover': { borderColor: '#0164C8' },
                  }}>
                  <Avatar sx={{ width: 36, height: 36, fontSize: 13, fontWeight: 700, bgcolor: '#EAF2FB', color: '#0164C8' }}>
                    {r.name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600}>{r.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{r.detail}</Typography>
                  </Box>
                  {r.available ? (
                    <Chip size="small" label="Available"
                      sx={{ bgcolor: 'notice.success.bg', color: 'notice.success.fg', fontWeight: 600 }} />
                  ) : (
                    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                      {r.detail.startsWith('On shift from') ? 'Starts later' : 'Not on shift'}
                    </Typography>
                  )}
                </Box>
              )
            })}
            {rows.length === 0 && (
              <Typography variant="body2" color="text.secondary">No staff found.</Typography>
            )}
          </Stack>

          <Typography variant="caption" color="text.secondary">
            Only staff on shift at that time are shown first.
          </Typography>

          <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1} justifyContent="flex-end">
            <Button onClick={onClose} sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 999 }} fullWidth={isMobile}>
              Cancel
            </Button>
            <Button variant="contained" disabled={!selected || assigning} fullWidth={isMobile}
              onClick={() => onAssign(selected)}
              sx={{ bgcolor: '#0164C8', textTransform: 'none', fontWeight: 600, borderRadius: 999, px: 3 }}>
              {assigning ? 'Assigning...' : chosen ? `Assign ${chosen.name.split(' ')[0]}` : 'Assign staff'}
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  )
}
