import { useState } from 'react'
import {
  Box, Typography, TextField, IconButton, Avatar, Badge, Stack, Paper,
  List, ListItemButton, ListItemAvatar, ListItemText, CircularProgress,
} from '@mui/material'
import {
  Close as CloseIcon, Person as PersonIcon, Add as AddIcon,
  Tag as TagIcon, Groups as GroupsIcon, Forum as ForumIcon,
  ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon,
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ general: true, groups: true, dms: true })

  const general = channels.filter(c => c.type === 'general')
  const groups = channels.filter(c => c.type === 'group')
  const dms = channels.filter(c => c.type === 'dm')

  const toggle = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

  const getOnlineCount = (ch: ChatChannel) => ch.members ? ch.members.filter(m => onlineUsers.has(m.user_id)).length : 0

  const isSearching = searchQuery.trim().length > 0

  const ChannelItem = ({ ch }: { ch: ChatChannel }) => {
    const { initials, avatar } = getChannelAvatar(ch, currentUserId)
    const isDM = ch.type === 'dm'
    const otherUserId = isDM && ch.members ? ch.members.find(m => m.user_id !== currentUserId)?.user_id : undefined
    const isOnline = otherUserId ? onlineUsers.has(otherUserId) : false
    const onlineCount = !isDM ? getOnlineCount(ch) : 0
    const isActive = activeChannel === ch.id
    const unread = (ch.unread_count || 0) > 0 && !isActive

    return (
      <ListItemButton
        selected={isActive}
        onClick={() => onSelectChannel(ch.id)}
        sx={{
          borderRadius: 2, mx: 1, my: 0.25, py: 0.75, px: 1.25,
          borderLeft: isActive ? `3px solid ${NAVY}` : '3px solid transparent',
          '&.Mui-selected': { bgcolor: '#EDEAE4', '&:hover': { bgcolor: '#EDEAE4' } },
          '&:hover': { bgcolor: '#F5F3EF' },
        }}
      >
        <ListItemAvatar sx={{ minWidth: 40 }}>
          <Badge
            overlap="circular"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            badgeContent={isDM && isOnline ? <Box sx={{ width: 10, height: 10, bgcolor: EMERALD, borderRadius: '50%', border: `2px solid ${WHITE}` }} /> : null}
          >
            <Avatar
              src={avatar || undefined}
              sx={{
                width: 34, height: 34, fontSize: 13,
                bgcolor: ch.type === 'general' ? NAVY : BONE,
                color: ch.type === 'general' ? WHITE : NAVY,
                border: `1px solid ${ch.type === 'general' ? NAVY_DEEP : HAIRLINE}`,
              }}
            >
              {initials}
            </Avatar>
          </Badge>
        </ListItemAvatar>
        <ListItemText
          primary={
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="body2" fontWeight={isActive ? 800 : unread ? 700 : 500} noWrap sx={{ fontSize: 13, color: isActive ? NAVY : INK }}>
                {getChannelName(ch, currentUserId)}
              </Typography>
              {!isDM && onlineCount > 0 && (
                <Typography variant="caption" sx={{ fontSize: 10, color: MIST, fontWeight: 500, flexShrink: 0 }}>
                  {onlineCount} online
                </Typography>
              )}
            </Stack>
          }
          secondary={ch.last_message ? ch.last_message.substring(0, 30) + (ch.last_message.length > 30 ? '…' : '') : ''}
          secondaryTypographyProps={{ fontSize: 11.5, noWrap: true, color: unread ? INK : MIST, fontWeight: unread ? 600 : 400 }}
        />
        <Stack alignItems="flex-end" spacing={0.5} sx={{ ml: 0.5, flexShrink: 0 }}>
          {ch.last_message_at && (
            <Typography variant="caption" sx={{ fontSize: 10, color: MIST, whiteSpace: 'nowrap' }}>
              {timeAgo(ch.last_message_at)}
            </Typography>
          )}
          {unread && (
            <Box sx={{ minWidth: 18, height: 18, borderRadius: '50%', bgcolor: EMERALD, color: WHITE, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 0.5 }}>
              <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 800, lineHeight: 1 }}>{ch.unread_count! > 99 ? '99+' : ch.unread_count}</Typography>
            </Box>
          )}
        </Stack>
      </ListItemButton>
    )
  }

  const SectionHeader = ({ label, icon, sectionKey, count }: { label: string; icon: React.ReactNode; sectionKey: string; count: number }) => (
    <ListItemButton dense sx={{ px: 2, py: 0.5 }} onClick={() => toggle(sectionKey)}>
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ width: '100%' }}>
        {icon}
        <Typography variant="caption" fontWeight={800} sx={{ flex: 1, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: MIST }}>
          {label}
        </Typography>
        {count > 0 && <Typography variant="caption" sx={{ fontSize: 10, color: MIST }}>{count}</Typography>}
        {expanded[sectionKey] ? <ExpandLessIcon sx={{ fontSize: 16, color: MIST }} /> : <ExpandMoreIcon sx={{ fontSize: 16, color: MIST }} />}
      </Stack>
    </ListItemButton>
  )

  return (
    <Paper sx={{ width: 280, minWidth: 280, display: 'flex', flexDirection: 'column', borderRadius: 0, border: 'none', borderRight: `1px solid ${HAIRLINE}`, bgcolor: WHITE }} elevation={0}>
      <Box sx={{ px: 2.5, pt: 2, pb: 1.5, borderBottom: `1px solid ${HAIRLINE}` }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" fontWeight={900} sx={{ fontSize: 17, color: INK, letterSpacing: '-0.02em' }}>Chat</Typography>
            {totalUnread > 0 && (
              <Box sx={{ minWidth: 20, height: 20, borderRadius: '50%', bgcolor: EMERALD, color: WHITE, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 0.5 }}>
                <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 800, lineHeight: 1 }}>{totalUnread > 99 ? '99+' : totalUnread}</Typography>
              </Box>
            )}
          </Stack>
          <Stack direction="row" spacing={0.25}>
            <IconButton size="small" aria-label="New message" onClick={onNewDM} sx={{ color: NAVY, '&:hover': { bgcolor: BONE } }}>
              <PersonIcon sx={{ fontSize: 18 }} />
            </IconButton>
            <IconButton size="small" aria-label="New group" onClick={onNewGroup} sx={{ color: NAVY, '&:hover': { bgcolor: BONE } }}>
              <AddIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Stack>
        </Stack>
        <TextField
          size="small" placeholder="Search" fullWidth
          value={searchQuery} onChange={e => onSearchChange(e.target.value)}
          InputProps={{
            sx: { borderRadius: 2, bgcolor: '#F5F3EF', fontSize: 13, height: 36, '& fieldset': { borderColor: HAIRLINE }, '&:hover fieldset': { borderColor: OUTLINE }, '&.Mui-focused fieldset': { borderColor: NAVY } },
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
            {general.length > 0 && (
              <>
                <SectionHeader label="General" icon={<TagIcon sx={{ fontSize: 15, color: NAVY }} />} sectionKey="general" count={general.length} />
                {expanded.general && general.map(ch => <ChannelItem key={ch.id} ch={ch} />)}
              </>
            )}
            {groups.length > 0 && (
              <>
                <Box sx={{ mx: 2, borderTop: `1px solid ${HAIRLINE}`, my: 0.5 }} />
                <SectionHeader label="Groups" icon={<GroupsIcon sx={{ fontSize: 15, color: NAVY }} />} sectionKey="groups" count={groups.length} />
                {expanded.groups && groups.map(ch => <ChannelItem key={ch.id} ch={ch} />)}
              </>
            )}
            {dms.length > 0 && (
              <>
                <Box sx={{ mx: 2, borderTop: `1px solid ${HAIRLINE}`, my: 0.5 }} />
                <SectionHeader label="Direct messages" icon={<ForumIcon sx={{ fontSize: 15, color: NAVY }} />} sectionKey="dms" count={dms.length} />
                {expanded.dms && dms.map(ch => <ChannelItem key={ch.id} ch={ch} />)}
              </>
            )}
            {channels.length === 0 && (
              <Box sx={{ px: 3, py: 5, textAlign: 'center' }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: INK }}>No conversations yet</Typography>
                <Typography sx={{ fontSize: 12, color: MIST, mt: 0.5 }}>Start a message or create a group.</Typography>
              </Box>
            )}
          </>
        )}
      </List>
    </Paper>
  )
}
