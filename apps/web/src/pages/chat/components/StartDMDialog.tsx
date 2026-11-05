import { useMemo, useState } from 'react'
import { Dialog, DialogTitle, DialogContent, Avatar, Box, Stack, Typography, TextField, InputAdornment, List, ListItemButton, ListItemAvatar, ListItemText } from '@mui/material'
import { Search as SearchIcon, ChevronRight as ChevronRightIcon } from '@mui/icons-material'
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

export default function StartDMDialog({ open, onClose, orgMembers, currentUserId, onStartDM }: Props) {
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const people = orgMembers.filter(m => m.id !== currentUserId)
    if (!q) return people
    return people.filter(m =>
      (`${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email || '').toLowerCase().includes(q) ||
      (m.email || '').toLowerCase().includes(q),
    )
  }, [orgMembers, currentUserId, query])

  const subtitle = (m: OrgMember) => [m.role, m.location_name].filter(Boolean).join(' · ') || m.email || ''

  return (
    <Dialog open={open} onClose={() => { onClose(); setQuery('') }} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, fontSize: 16, color: INK, px: 3, py: 2 }}>
        New message
      </DialogTitle>
      <DialogContent sx={{ px: 3, pb: 2 }}>
        <TextField
          fullWidth size="small" autoFocus
          placeholder="Search staff…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: MIST }} /></InputAdornment>,
          }}
          sx={{
            mb: 1,
            '& .MuiOutlinedInput-root': {
              borderRadius: 999, bgcolor: WHITE, fontSize: 13,
              '& fieldset': { borderColor: HAIRLINE },
              '&:hover fieldset': { borderColor: NAVY },
              '&.Mui-focused fieldset': { borderColor: NAVY, borderWidth: 1.5 },
            },
          }}
        />
        <List sx={{ py: 0, maxHeight: 320, overflow: 'auto' }}>
          {results.map(m => (
            <ListItemButton key={m.id}
              onClick={() => { onClose(); setQuery(''); onStartDM(m.id) }}
              sx={{ px: 1, py: 1, borderRadius: 2, '&:hover': { bgcolor: BONE } }}>
              <ListItemAvatar sx={{ minWidth: 44 }}>
                <Avatar sx={{ width: 36, height: 36, fontSize: 13, bgcolor: BONE, color: NAVY, border: `1px solid ${HAIRLINE}` }}>
                  {(m.first_name?.[0] || m.email?.[0] || '?').toUpperCase()}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Typography fontWeight={600} sx={{ fontSize: 13.5, color: INK }}>
                    {`${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email}
                  </Typography>
                }
                secondary={subtitle(m)}
                secondaryTypographyProps={{ fontSize: 12, sx: { color: MIST } }}
              />
              <ChevronRightIcon sx={{ fontSize: 20, color: MIST }} />
            </ListItemButton>
          ))}
          {results.length === 0 && (
            <Box sx={{ py: 3, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: MIST }}>No staff match “{query.trim()}”.</Typography>
            </Box>
          )}
        </List>
        <Stack direction="row" justifyContent="flex-end" sx={{ pt: 1 }}>
          <Typography
            role="button" tabIndex={0}
            onClick={() => { onClose(); setQuery('') }}
            onKeyDown={e => { if (e.key === 'Enter') { onClose(); setQuery('') } }}
            sx={{ fontSize: 13, fontWeight: 600, color: MIST, cursor: 'pointer', '&:hover': { color: INK } }}>
            Cancel
          </Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  )
}
