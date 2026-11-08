import { useMemo, useState } from 'react'
import { Dialog, DialogTitle, DialogContent, Avatar, Box, Stack, Typography, List, ListItemButton, ListItemAvatar, ListItemText, Button, Checkbox, TextField, InputAdornment, Menu, MenuItem, IconButton, Tooltip } from '@mui/material'
import { ChevronRight as ChevronRightIcon, Search as SearchIcon, Forum as ForumIcon, Close as CloseIcon } from '@mui/icons-material'
import { type ChannelMember, type OrgMember } from '../hooks/useChat'
import { NAVY, NAVY_DEEP, INK, MIST, BONE, HAIRLINE, WHITE, DANGER } from '../utils'

// Figma 7.4 paints the member count and "And more" amber; the theme's
// warning foreground is the compliant equivalent (dark-mode safe).
const AMBER = 'notice.warning.fg'

const ROLE_LABELS: Record<string, string> = {
  ORG_ADMIN: 'Admin', MANAGER: 'Manager', CARE_WORKER: 'Care Worker', COMPLIANCE_OFFICER: 'Compliance',
}

interface Props {
  open: boolean
  onClose: () => void
  channelName: string
  members: ChannelMember[]
  orgMembers: OrgMember[]
  currentUserId: string
  channelType: string
  onlineUsers: Set<string>
  onStartDM: (userId: string) => void
  onRemoveMember: (userId: string) => void
  onAddMembers: (userIds: string[]) => Promise<number>
  onLeaveGroup: () => void
}

export default function MemberListDialog({
  open, onClose, channelName, members, orgMembers, currentUserId, channelType,
  onStartDM, onRemoveMember, onAddMembers, onLeaveGroup,
}: Props) {
  const [contextMenu, setContextMenu] = useState<{ anchor: HTMLElement; member: ChannelMember } | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [addQuery, setAddQuery] = useState('')
  const [addSelected, setAddSelected] = useState<string[]>([])
  const [addingBusy, setAddingBusy] = useState(false)

  const memberIds = useMemo(() => new Set(members.map(m => m.user_id)), [members])
  const candidates = useMemo(() => {
    const q = addQuery.trim().toLowerCase()
    return orgMembers
      .filter(m => m.id !== currentUserId && !memberIds.has(m.id))
      .filter(m => !q || (`${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email || '').toLowerCase().includes(q))
  }, [orgMembers, currentUserId, memberIds, addQuery])

  const roleOf = (role?: string) => (role ? ROLE_LABELS[role] || role.replace(/_/g, ' ') : '')

  const doAdd = async () => {
    if (!addSelected.length || addingBusy) return
    setAddingBusy(true)
    try {
      await onAddMembers(addSelected)
      setAddSelected([])
      setAdding(false)
    } finally {
      setAddingBusy(false)
    }
  }

  const close = () => { onClose(); setAdding(false); setAddSelected([]); setAddQuery('') }

  return (
    <>
      <Dialog open={open} onClose={close} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ px: 3, py: 2, borderBottom: `1px solid ${HAIRLINE}` }}>
          <Typography fontWeight={400} sx={{ fontSize: 16, color: INK }}>
            {channelName} — <Box component="span" sx={{ color: AMBER, fontWeight: 400 }}>{members.length} members</Box>
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 1.5, py: 1 }}>
          {!adding ? (
            <>
              <List sx={{ py: 0 }}>
                {members.map(m => (
                  <ListItemButton key={m.user_id}
                    onContextMenu={e => { e.preventDefault(); setContextMenu({ anchor: e.currentTarget, member: m }) }}
                    sx={{ px: 1.5, py: 1, borderRadius: 2, '&:hover': { bgcolor: BONE } }}> 
                    <ListItemAvatar sx={{ minWidth: 44 }}>
                      <Avatar sx={{
                        width: 36, height: 36, fontSize: 13,
                        bgcolor: BONE, color: NAVY, border: `1px solid ${HAIRLINE}`,
                      }}>
                        {(m.first_name?.[0] || m.email?.[0] || '?').toUpperCase()}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Typography fontWeight={400} sx={{ fontSize: 14, color: INK }}>
                          {`${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email}
                        </Typography>
                      }
                      secondary={m.user_id === currentUserId ? `You · ${roleOf(m.role)}` : (roleOf(m.role) || m.location_name || '')}
                      secondaryTypographyProps={{ fontSize: 12, sx: { color: MIST } }}
                    />
                    {m.user_id !== currentUserId && (
                      <Tooltip title="Message">
                        <IconButton edge="end" size="small"
                          onClick={e => { e.stopPropagation(); onStartDM(m.user_id); close() }}
                          sx={{ color: MIST, '&:hover': { color: NAVY } }}>
                          <ChevronRightIcon sx={{ fontSize: 20 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </ListItemButton>
                ))}
              </List>
              <Box
                role="button" tabIndex={0}
                onClick={() => setAdding(true)}
                onKeyDown={e => { if (e.key === 'Enter') setAdding(true) }}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1.25, mt: 0.5,
                  borderTop: `1px solid ${HAIRLINE}`, cursor: 'pointer', borderRadius: 2,
                  '&:hover': { bgcolor: BONE },
                }}>
                <Avatar sx={{ width: 36, height: 36, bgcolor: 'transparent', color: AMBER, border: '1px dashed', borderColor: AMBER, fontSize: 18 }}>+</Avatar>
                <Typography sx={{ fontSize: 14, color: AMBER }}>And more</Typography>
              </Box>
            </>
          ) : (
            <Box sx={{ px: 1, py: 0.5 }}>
              <Typography fontWeight={600} sx={{ fontSize: 13, color: INK, mb: 1 }}>Add people</Typography>
              <TextField
                fullWidth size="small" autoFocus
                placeholder="Search staff…"
                value={addQuery}
                onChange={e => setAddQuery(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: MIST }} /></InputAdornment>,
                }}
                sx={{
                  mb: 1,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 999, bgcolor: WHITE, fontSize: 13,
                    '& fieldset': { borderColor: HAIRLINE },
                    '&.Mui-focused fieldset': { borderColor: NAVY, borderWidth: 1.5 },
                  },
                }}
              />
              <List sx={{ py: 0, maxHeight: 220, overflow: 'auto' }}>
                {candidates.map(m => {
                  const checked = addSelected.includes(m.id)
                  return (
                    <ListItemButton key={m.id}
                      onClick={() => setAddSelected(prev => checked ? prev.filter(s => s !== m.id) : [...prev, m.id])}
                      sx={{ px: 1, py: 0.75, borderRadius: 2, '&:hover': { bgcolor: BONE } }}>
                      <Checkbox checked={checked} size="small" sx={{ color: MIST, '&.Mui-checked': { color: NAVY }, p: 0.5, mr: 1 }} />
                      <ListItemAvatar sx={{ minWidth: 40 }}>
                        <Avatar sx={{ width: 32, height: 32, fontSize: 12, bgcolor: BONE, color: NAVY, border: `1px solid ${HAIRLINE}` }}>
                          {(m.first_name?.[0] || m.email?.[0] || '?').toUpperCase()}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={<Typography fontWeight={600} sx={{ fontSize: 13, color: INK }}>{`${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email}</Typography>}
                        secondary={[roleOf(m.role), m.location_name].filter(Boolean).join(' · ') || ''}
                        secondaryTypographyProps={{ fontSize: 11, sx: { color: MIST } }}
                      />
                    </ListItemButton>
                  )
                })}
                {candidates.length === 0 && (
                  <Box sx={{ py: 2, textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ color: MIST }}>Everyone is already in this group.</Typography>
                  </Box>
                )}
              </List>
              <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ pt: 1 }}>
                <Button onClick={() => { setAdding(false); setAddSelected([]) }} sx={{ color: MIST, fontWeight: 600, textTransform: 'none' }}>
                  Back
                </Button>
                <Button variant="contained" onClick={doAdd} disabled={!addSelected.length || addingBusy}
                  sx={{ bgcolor: NAVY, '&:hover': { bgcolor: NAVY_DEEP }, textTransform: 'none', fontWeight: 600, borderRadius: 999, px: 3 }}>
                  {addingBusy ? 'Adding…' : `Add${addSelected.length ? ` (${addSelected.length})` : ''}`}
                </Button>
              </Stack>
            </Box>
          )}
        </DialogContent>
        {!adding && (
          <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.5, borderTop: `1px solid ${HAIRLINE}` }}>
            {channelType === 'group' ? (
              <Typography role="button" tabIndex={0}
                onClick={() => { close(); onLeaveGroup() }}
                onKeyDown={e => { if (e.key === 'Enter') { close(); onLeaveGroup() } }}
                sx={{ fontSize: 13, fontWeight: 600, color: DANGER, cursor: 'pointer' }}>
                Leave group
              </Typography>
            ) : <Box />}
            <Box sx={{ flex: 1 }} />
            <Button onClick={close} sx={{ color: MIST, fontWeight: 600, textTransform: 'none' }}>Close</Button>
            <Button variant="contained" onClick={() => setAdding(true)}
              sx={{ ml: 1, bgcolor: NAVY, '&:hover': { bgcolor: NAVY_DEEP }, textTransform: 'none', fontWeight: 600, borderRadius: 999, px: 3 }}>
              Add people
            </Button>
          </Box>
        )}
      </Dialog>
      {/* Context menu: message / remove (right-click) */}
      <Menu anchorEl={contextMenu?.anchor} open={!!contextMenu} onClose={() => setContextMenu(null)}>
        <MenuItem onClick={() => { if (contextMenu) { onStartDM(contextMenu.member.user_id); close(); setContextMenu(null) } }}>
          <ForumIcon sx={{ mr: 1, fontSize: 18, color: NAVY }} /> Message
        </MenuItem>
        {contextMenu?.member.user_id !== currentUserId && channelType !== 'dm' && (
          <MenuItem onClick={() => { setConfirmRemove(contextMenu!.member.user_id); setContextMenu(null) }} sx={{ color: DANGER }}>
            <CloseIcon sx={{ mr: 1, fontSize: 18 }} /> Remove
          </MenuItem>
        )}
      </Menu>

      {/* Remove confirm */}
      <Dialog open={!!confirmRemove} onClose={() => setConfirmRemove(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, fontSize: 15, color: INK }}>Remove member?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: MIST }}>They will no longer see messages in this group.</Typography>
        </DialogContent>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, p: 2, pt: 0 }}>
          <Button onClick={() => setConfirmRemove(null)} sx={{ color: MIST, fontWeight: 600 }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => { if (confirmRemove) onRemoveMember(confirmRemove); setConfirmRemove(null) }}>Remove</Button>
        </Box>
      </Dialog>
    </>
  )
}
