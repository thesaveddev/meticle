import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Stack, Typography, Avatar, Autocomplete, Chip, Box } from '@mui/material'
import { type OrgMember } from '../hooks/useChat'
import { NAVY, INK, MIST, BONE, HAIRLINE, WHITE } from '../utils'

interface Props {
  open: boolean
  onClose: () => void
  orgMembers: OrgMember[]
  currentUserId: string
  onlineUsers: Set<string>
  onStartDM: (userId: string) => Promise<any>
}

export default function StartDMDialog({ open, onClose, orgMembers, currentUserId, onlineUsers, onStartDM }: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, bgcolor: WHITE, borderBottom: `1px solid ${HAIRLINE}`, fontSize: 16, color: INK }}>
        New message
      </DialogTitle>
      <DialogContent sx={{ pt: 2.5 }}>
        <Stack spacing={2}>
          <Typography variant="body2" sx={{ color: MIST }}>Select a colleague to message</Typography>
          <Autocomplete
            options={orgMembers.filter(m => m.id !== currentUserId)}
            getOptionLabel={o => `${o.first_name || ''} ${o.last_name || ''}`.trim() || o.email || ''}
            onChange={(_, v) => { if (v) { onStartDM(v.id); onClose() } }}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: BONE, color: NAVY, border: `1px solid ${HAIRLINE}` }}>
                    {(option.first_name?.[0] || option.email?.[0] || '?').toUpperCase()}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={600} sx={{ color: INK }}>
                      {`${option.first_name || ''} ${option.last_name || ''}`.trim() || option.email}
                    </Typography>
                    <Typography variant="caption" sx={{ color: MIST }}>{option.role}</Typography>
                  </Box>
                  {onlineUsers.has(option.id) && (
                    <Chip label="Online" size="small"
                      sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(16,185,129,0.1)', color: '#047857', fontWeight: 700 }} />
                  )}
                </Stack>
              </li>
            )}
            renderInput={params => <TextField {...params} label="Search staff" size="small" autoFocus />}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose} sx={{ color: MIST, fontWeight: 700 }}>Cancel</Button>
      </DialogActions>
    </Dialog>
  )
}
