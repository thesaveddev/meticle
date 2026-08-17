import { useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Stack, Typography, Avatar, Autocomplete, Box } from '@mui/material'
import { type OrgMember } from '../hooks/useChat'
import { NAVY, NAVY_DEEP, INK, MIST, BONE, HAIRLINE, WHITE } from '../utils'

interface Props {
  open: boolean
  onClose: () => void
  orgMembers: OrgMember[]
  currentUserId: string
  onCreate: (name: string, memberIds: string[]) => Promise<any>
}

export default function CreateGroupDialog({ open, onClose, orgMembers, currentUserId, onCreate }: Props) {
  const [name, setName] = useState('')
  const [members, setMembers] = useState<OrgMember[]>([])
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return
    setCreating(true)
    try {
      await onCreate(name.trim(), members.map(m => m.id))
      setName(''); setMembers([]); onClose()
    } finally { setCreating(false) }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, bgcolor: WHITE, borderBottom: `1px solid ${HAIRLINE}`, fontSize: 16, color: INK }}>
        Create group
      </DialogTitle>
      <DialogContent sx={{ pt: 2.5 }}>
        <Stack spacing={2.5}>
          <TextField label="Group name" fullWidth size="small" value={name} onChange={e => setName(e.target.value)}
            helperText="Give your group a descriptive name" />
          <Autocomplete multiple options={orgMembers.filter(m => m.id !== currentUserId)}
            getOptionLabel={o => `${o.first_name || ''} ${o.last_name || ''}`.trim() || o.email || ''}
            value={members} onChange={(_, v) => setMembers(v)}
            renderInput={params => <TextField {...params} label="Add members" size="small" />}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: BONE, color: NAVY, border: `1px solid ${HAIRLINE}` }}>
                    {(option.first_name?.[0] || option.email?.[0] || '?').toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="body2" fontWeight={600} sx={{ color: INK }}>
                      {`${option.first_name || ''} ${option.last_name || ''}`.trim() || option.email}
                    </Typography>
                    <Typography variant="caption" sx={{ color: MIST }}>{option.role}</Typography>
                  </Box>
                </Stack>
              </li>
            )}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose} sx={{ color: MIST, fontWeight: 700 }}>Cancel</Button>
        <Button variant="contained" disabled={creating || !name.trim()} onClick={handleCreate}
          sx={{ bgcolor: NAVY, '&:hover': { bgcolor: NAVY_DEEP }, fontWeight: 700 }}>
          {creating ? 'Creating…' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
