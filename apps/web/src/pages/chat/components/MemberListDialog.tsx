import { useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, List, ListItemButton, ListItemAvatar, ListItemText, Avatar, Badge, Box, Stack, Typography, IconButton, Tooltip, Menu, MenuItem, Button, Chip } from '@mui/material'
import { Groups as GroupsIcon, Forum as ForumIcon, Close as CloseIcon } from '@mui/icons-material'
import { type ChannelMember } from '../hooks/useChat'
import { NAVY, NAVY_DEEP, EMERALD, INK, MIST, BONE, HAIRLINE, WHITE, DANGER } from '../utils'

interface Props {
  open: boolean
  onClose: () => void
  channelName: string
  members: ChannelMember[]
  currentUserId: string
  channelType: string
  onlineUsers: Set<string>
  onStartDM: (userId: string) => void
  onRemoveMember: (userId: string) => void
  onLeaveGroup: () => void
}

export default function MemberListDialog({
  open, onClose, channelName, members, currentUserId, channelType,
  onlineUsers, onStartDM, onRemoveMember, onLeaveGroup,
}: Props) {
  const [contextMenu, setContextMenu] = useState<{ anchor: HTMLElement; member: ChannelMember } | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  const handleRemove = async () => {
    if (confirmRemove) { onRemoveMember(confirmRemove); setConfirmRemove(null) }
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, bgcolor: WHITE, borderBottom: `1px solid ${HAIRLINE}` }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <GroupsIcon sx={{ color: NAVY, fontSize: 20 }} />
            <Typography variant="h6" fontWeight={800} sx={{ fontSize: 15, color: INK }}>{channelName}</Typography>
            <Chip label={`${members.length} members`} size="small"
              sx={{ height: 20, fontSize: 11, bgcolor: 'rgba(15,76,129,0.08)', color: NAVY, fontWeight: 700 }} />
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <List sx={{ py: 0 }}>
            {members.map(m => (
              <ListItemButton key={m.user_id}
                sx={{ px: 3, py: 1.25, borderBottom: `1px solid ${HAIRLINE}`, '&:hover': { bgcolor: BONE } }}
                onContextMenu={e => { e.preventDefault(); setContextMenu({ anchor: e.currentTarget, member: m }) }}>
                <ListItemAvatar>
                  <Badge overlap="circular" anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    badgeContent={onlineUsers.has(m.user_id) ? <Box sx={{ width: 10, height: 10, bgcolor: EMERALD, borderRadius: '50%', border: `2px solid ${WHITE}` }} /> : null}>
                    <Avatar sx={{
                      width: 36, height: 36, fontSize: 13,
                      bgcolor: m.user_id === currentUserId ? NAVY : BONE,
                      color: m.user_id === currentUserId ? WHITE : NAVY,
                      border: `1px solid ${m.user_id === currentUserId ? NAVY_DEEP : HAIRLINE}`,
                    }}>
                      {(m.first_name?.[0] || m.email?.[0] || '?').toUpperCase()}
                    </Avatar>
                  </Badge>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Typography fontWeight={700} sx={{ fontSize: 13.5, color: INK }}>
                        {`${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email}
                      </Typography>
                      {onlineUsers.has(m.user_id) && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: EMERALD }} />}
                    </Stack>
                  }
                  secondary={m.user_id === currentUserId ? `You · ${m.role}` : m.role}
                  secondaryTypographyProps={{ fontSize: 12, sx: { color: MIST } }}
                />
                {m.user_id !== currentUserId && (
                  <Tooltip title="Message">
                    <IconButton size="small" onClick={e => { e.stopPropagation(); onStartDM(m.user_id); onClose() }}
                      sx={{ color: NAVY, width: 28, height: 28, border: `1px solid ${HAIRLINE}`, '&:hover': { bgcolor: BONE } }}>
                      <ForumIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </ListItemButton>
            ))}
          </List>
        </DialogContent>
        <DialogActions sx={{ p: 1.5 }}>
          {channelType === 'group' && (
            <Button onClick={() => { onClose(); onLeaveGroup() }} size="small" sx={{ color: DANGER, fontWeight: 700 }}>
              Leave group
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button onClick={onClose} sx={{ color: MIST, fontWeight: 700 }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Context menu */}
      <Menu anchorEl={contextMenu?.anchor} open={!!contextMenu} onClose={() => setContextMenu(null)}>
        <MenuItem onClick={() => { if (contextMenu) { onStartDM(contextMenu.member.user_id); onClose(); setContextMenu(null) } }}>
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
        <DialogTitle sx={{ fontWeight: 800, fontSize: 15, color: INK }}>Remove member?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: MIST }}>They will no longer see messages in this group.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRemove(null)} sx={{ color: MIST, fontWeight: 700 }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleRemove}>Remove</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
