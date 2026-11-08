import { useMemo, useState } from 'react'
import { Dialog, DialogTitle, DialogContent, Avatar, Box, Stack, Typography, TextField, List, ListItemButton, ListItemAvatar, ListItemText, Checkbox, Button, Chip } from '@mui/material'
import { Group as GroupIcon } from '@mui/icons-material'
import { type OrgMember } from '../hooks/useChat'
import { NAVY, NAVY_DEEP, INK, MIST, BONE, OUTLINE, HAIRLINE, WHITE, DANGER } from '../utils'

interface Props {
  open: boolean
  onClose: () => void
  orgMembers: OrgMember[]
  currentUserId: string
  onCreate: (name: string, memberIds: string[]) => Promise<any>
  onCreated?: () => void
  onFailed?: () => void
}

export default function CreateGroupDialog({ open, onClose, orgMembers, currentUserId, onCreate, onCreated, onFailed }: Props) {
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [touched, setTouched] = useState(false)
  const [creating, setCreating] = useState(false)

  const people = useMemo(() => orgMembers.filter(m => m.id !== currentUserId), [orgMembers, currentUserId])
  const nameError = touched && !name.trim() ? 'Group name is required' : ''

  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])

  const close = () => { onClose(); setName(''); setSelected([]); setTouched(false) }

  const create = async () => {
    setTouched(true)
    if (!name.trim() || creating) return
    setCreating(true)
    try {
      await onCreate(name.trim(), selected)
      close()
      onCreated?.()
    } catch {
      onFailed?.()
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onClose={close} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, fontSize: 16, color: INK, px: 3, py: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <GroupIcon sx={{ color: NAVY, fontSize: 20 }} />
          <span>Create group</span>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ px: 3, pb: 2 }}>
        <Stack spacing={1.5}>
          <Box>
            <TextField
              fullWidth size="small" autoFocus
              placeholder="Group name"
              value={name}
              onChange={e => setName(e.target.value)}
              error={!!nameError}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2, bgcolor: WHITE, fontSize: 13,
                  '& fieldset': { borderColor: nameError ? DANGER : HAIRLINE },
                  '&:hover fieldset': { borderColor: nameError ? DANGER : NAVY },
                  '&.Mui-focused fieldset': { borderColor: nameError ? DANGER : NAVY, borderWidth: 1.5 },
                },
              }}
            />
            {nameError ? (
              <Box sx={{ mt: 1, px: 1.5, py: 1, borderRadius: 2, bgcolor: 'notice.error.bg', border: `1px solid ${DANGER}` }}>
                <Typography variant="caption" sx={{ fontSize: 12, color: DANGER, fontWeight: 600 }}>{nameError}</Typography>
              </Box>
            ) : (
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, fontSize: 11, color: MIST }}>
                e.g. Night shift, Edgbaston team
              </Typography>
            )}
          </Box>

          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
              <Typography variant="caption" sx={{ fontSize: 12, fontWeight: 600, color: MIST }}>Add members</Typography>
              {selected.length > 0 && (
                <Chip label={`${selected.length} selected`} size="small"
                  sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(15,76,129,0.08)', color: NAVY, fontWeight: 700 }} />
              )}
            </Stack>
            <List sx={{ py: 0, maxHeight: 240, overflow: 'auto', border: `1px solid ${HAIRLINE}`, borderRadius: 2 }}>
              {people.map(m => {
                const checked = selected.includes(m.id)
                return (
                  <ListItemButton key={m.id} onClick={() => toggle(m.id)}
                    sx={{ px: 1.5, py: 0.75, borderBottom: `1px solid ${HAIRLINE}`, '&:hover': { bgcolor: BONE } }}>
                    <Checkbox checked={checked} size="small" sx={{ color: OUTLINE, '&.Mui-checked': { color: NAVY }, p: 0.5, mr: 1 }} />
                    <ListItemAvatar sx={{ minWidth: 40 }}>
                      <Avatar sx={{ width: 32, height: 32, fontSize: 12, bgcolor: BONE, color: NAVY, border: `1px solid ${HAIRLINE}` }}>
                        {(m.first_name?.[0] || m.email?.[0] || '?').toUpperCase()}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Typography fontWeight={600} sx={{ fontSize: 13, color: INK }}>
                          {`${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email}
                        </Typography>
                      }
                      secondary={[m.role, m.location_name].filter(Boolean).join(' · ') || m.email || ''}
                      secondaryTypographyProps={{ fontSize: 11, sx: { color: MIST } }}
                    />
                  </ListItemButton>
                )
              })}
              {people.length === 0 && (
                <Box sx={{ py: 2, textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ color: MIST }}>No colleagues to add yet.</Typography>
                </Box>
              )}
            </List>
          </Box>

          <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ pt: 0.5 }}>
            <Button onClick={close} sx={{ color: MIST, fontWeight: 600, textTransform: 'none' }}>Cancel</Button>
            <Button variant="contained" onClick={create} disabled={creating}
              sx={{ bgcolor: NAVY, '&:hover': { bgcolor: NAVY_DEEP }, textTransform: 'none', fontWeight: 600, borderRadius: 999, px: 3 }}>
              {creating ? 'Creating…' : 'Create group'}
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  )
}
