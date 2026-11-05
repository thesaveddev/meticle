import {
  Box, Typography, TextField, IconButton, Avatar, Badge, Stack, Paper,
  List, ListItemButton, ListItemAvatar, ListItemText, CircularProgress,
} from '@mui/material'
import {
  Close as CloseIcon, ChatBubbleOutline as NewDmIcon, GroupAdd as NewGroupIcon,
} from '@mui/icons-material'
import { type ChatChannel, type OrgMember } from '../hooks/useChat'
import { getChannelName, getChannelAvatar, timeAgo, NAVY, NAVY_DEEP, EMERALD, INK, MIST, BONE, HAIRLINE, OUTLINE, WHITE } from '../utils'

interface Props {
  channels: ChatChannel[]
  activeChannel: string | null
  onSelectChannel: (id: string) => void
  orgMembers: OrgMember[]
  onlineUsers: Set<string>
  totalUnread: number
  searchQuery: string
  onSearchChange: (q: string) => void
  searchResults: any[]
  searching: boolean
  currentUserId: string
  onNewDM: () => void
  onNewGroup: () => void
}

export default function ChannelSidebar({
  channels, activeChannel, onSelectChannel, onlineUsers,
  totalUnread, searchQuery, onSearchChange, searchResults, searching,
  currentUserId, onNewDM, onNewGroup,
}: Props) {
  const general = channels.filter(c => c.type === 'general')
  const groups = channels.filter(c => c.type === 'group')
  const dms = channels.filter(c => c.type === 'dm')
  const groupChannels = [...general, ...groups]

  const isSearching = searchQuery.trim().length > 0

  const ChannelItem = ({ ch }: { ch: ChatChannel }) => {
    const { initials, avatar } = getChannelAvatar(ch, currentUserId)
    const isDM = ch.type === 'dm'
    const otherUserId = isDM && ch.members ? ch.members.find(m => m.user_id !== currentUserId)?.user_id : undefined
    const isOnline = otherUserId ? onlineUsers.has(otherUserId) : false
    const isActive = activeChannel === ch.id
    const unread = (ch.unread_count || 0) > 0 && !isActive
    const memberCount = ch.members?.length || 0
    const subtitle = ch.type === 'general'
      ? `${memberCount} ${memberCount === 1 ? 'person' : 'people'}`
      : ch.last_message
        ? ch.last_message.substring(0, 34) + (ch.last_message.length > 34 ? '…' : '')
        : `${memberCount} ${memberCount === 1 ? 'member' : 'members'}`

    return (
      <ListItemButton
        selected={isActive}
        onClick={() => onSelectChannel(ch.id)}
        sx={{
          borderRadius: 2, mx: 1, my: 0.25, py: 0.75, px: 1.25,
          '&.Mui-selected': { bgcolor: '#EAF2FB', '&:hover': { bgcolor: '#EAF2FB' } },
          '&:hover': { bgcolor: '#EAF2FB' },
        }}
      >
        <ListItemAvatar sx={{ minWidth: 42 }}>
          <Badge
            overlap="circular"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            badgeContent={isDM && isOnline ? <Box sx={{ width: 10, height: 10, bgcolor: EMERALD, borderRadius: '50%', border: `2px solid ${WHITE}` }} /> : null}
          >
            <Avatar
              src={isDM ? avatar || undefined : undefined}
              sx={{
                width: 34, height: 34, fontSize: 13,
                borderRadius: isDM ? '50%' : 1.5,
                bgcolor: isDM ? BONE : NAVY,
                color: isDM ? NAVY : WHITE,
                border: `1px solid ${isDM ? HAIRLINE : NAVY_DEEP}`,
              }}
            >
              {isDM ? initials : '#'}
            </Avatar>
          </Badge>
        </ListItemAvatar>
        <ListItemText
          primary={
            <Typography variant="body2" fontWeight={isActive ? 800 : unread ? 700 : 500} noWrap sx={{ fontSize: 13, color: isActive ? NAVY : INK }}>
              {getChannelName(ch, currentUserId)}
            </Typography>
          }
          secondary={subtitle}
          secondaryTypographyProps={{ fontSize: 11.5, noWrap: true, color: unread ? INK : MIST, fontWeight: unread ? 600 : 400 }}
        />
        {unread && (
          <Box sx={{ minWidth: 18, height: 18, borderRadius: '50%', bgcolor: NAVY, color: WHITE, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 0.5, ml: 0.5, flexShrink: 0 }}>
            <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 600, lineHeight: 1 }}>{ch.unread_count! > 99 ? '99+' : ch.unread_count}</Typography>
          </Box>
        )}
      </ListItemButton>
    )
  }

  const SectionLabel = ({ label }: { label: string }) => (
    <Typography variant="caption" fontWeight={700} sx={{ display: 'block', px: 2.5, pt: 1.5, pb: 0.5, fontSize: 11, letterSpacing: '0.06em', color: MIST }}>
      {label}
    </Typography>
  )

  return (
    <Paper sx={{ width: 300, minWidth: 300, display: 'flex', flexDirection: 'column', borderRadius: 3, border: `1px solid ${HAIRLINE}`, bgcolor: WHITE }} elevation={0}>
      <Box sx={{ px: 2.5, pt: 2, pb: 1.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" fontWeight={600} sx={{ fontSize: 17, color: INK, letterSpacing: '-0.02em' }}>Chat</Typography>
            {totalUnread > 0 && (
              <Box sx={{ minWidth: 20, height: 20, borderRadius: '50%', bgcolor: NAVY, color: WHITE, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 0.5 }}>
                <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600, lineHeight: 1 }}>{totalUnread > 99 ? '99+' : totalUnread}</Typography>
              </Box>
            )}
          </Stack>
          <Stack direction="row" spacing={0.25}>
            <IconButton size="small" aria-label="New message" onClick={onNewDM} sx={{ color: NAVY, '&:hover': { bgcolor: BONE } }}>
              <NewDmIcon sx={{ fontSize: 18 }} />
            </IconButton>
            <IconButton size="small" aria-label="New group" onClick={onNewGroup} sx={{ color: NAVY, '&:hover': { bgcolor: BONE } }}>
              <NewGroupIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Stack>
        </Stack>
        <TextField
          size="small" placeholder="Search people and groups" fullWidth
          value={searchQuery} onChange={e => onSearchChange(e.target.value)}
          InputProps={{
            sx: { borderRadius: 2, bgcolor: 'notice.subtle.bg', fontSize: 13, height: 36, '& fieldset': { borderColor: HAIRLINE }, '&:hover fieldset': { borderColor: OUTLINE }, '&.Mui-focused fieldset': { borderColor: NAVY } },
            endAdornment: searchQuery ? (
              <IconButton size="small" aria-label="Clear" onClick={() => onSearchChange('')} sx={{ mr: -0.5 }}>
                <CloseIcon sx={{ fontSize: 16, color: MIST }} />
              </IconButton>
            ) : undefined,
          }}
        />
      </Box>

      <List sx={{ flex: 1, overflow: 'auto', py: 0.5 }}>
        {isSearching ? (
          searching ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size={20} sx={{ color: NAVY }} /></Box>
          ) : searchResults.length > 0 ? (
            searchResults.map((r: any) => {
              const rName = r.sender_id === currentUserId ? 'You' : `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.email?.split('@')[0] || 'Unknown'
              return (
                <ListItemButton key={r.id} dense onClick={() => { onSelectChannel(r.channel_id); onSearchChange('') }} sx={{ borderRadius: 1, mx: 1, my: 0.25, py: 0.5 }}>
                  <ListItemText
                    primary={<Typography variant="body2" fontWeight={600} noWrap sx={{ fontSize: 12.5, color: INK }}>{rName}</Typography>}
                    secondary={<Typography variant="caption" sx={{ fontSize: 11, color: MIST }} noWrap>{r.content?.substring(0, 50) || (r.file_name ? `📎 ${r.file_name}` : '')}</Typography>}
                    secondaryTypographyProps={{ component: 'div' }}
                  />
                  <Typography variant="caption" sx={{ fontSize: 10, color: MIST, whiteSpace: 'nowrap' }}>{timeAgo(r.created_at)}</Typography>
                </ListItemButton>
              )
            })
          ) : (
            <Typography sx={{ p: 2, textAlign: 'center', fontSize: 13, color: MIST }}>No results</Typography>
          )
        ) : (
          <>
            {groupChannels.length > 0 && (
              <>
                <SectionLabel label="GROUPS" />
                {groupChannels.map(ch => <ChannelItem key={ch.id} ch={ch} />)}
              </>
            )}
            {dms.length > 0 && (
              <>
                <SectionLabel label="DIRECT MESSAGES" />
                {dms.map(ch => <ChannelItem key={ch.id} ch={ch} />)}
              </>
            )}
            {channels.length === 0 && (
              <Box sx={{ px: 3, py: 5, textAlign: 'center' }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: INK }}>No conversations yet</Typography>
                <Typography sx={{ fontSize: 12, color: MIST, mt: 0.5 }}>Start a message or create a group.</Typography>
              </Box>
            )}
          </>
        )}
      </List>
    </Paper>
  )
}
