import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material'
import { type ChatMessage } from '../hooks/useChat'
import { formatDate, NAVY, EMERALD, EMERALD_DEEP, INK, MIST, BONE, HAIRLINE, OUTLINE } from '../utils'
import MessageBubble from './MessageBubble'

interface Props {
  messages: ChatMessage[]
  loading: boolean
  hasOlder: boolean
  olderLoading: boolean
  onLoadOlder: () => void
  currentUserId: string
  user: { first_name?: string; email?: string; profile_picture_url?: string }
  channelType: string
  otherLastRead: string | null
  memberReads: any[]
  editingId: string | null
  editText: string
  onEditTextChange: (t: string) => void
  onStartEdit: (msg: ChatMessage) => void
  onSaveEdit: (msg: ChatMessage) => void
  onCancelEdit: () => void
  onDelete: (msg: ChatMessage) => void
  onReact: (msg: ChatMessage, emoji: string) => void
  onOpenReactionPicker: (e: React.MouseEvent, msgId: string) => void
  onOpenFile: (url: string, name: string) => void
  onReply: (msg: ChatMessage) => void
  typingText: string
  messagesEndRef: React.Ref<HTMLDivElement>
  containerRef: React.Ref<HTMLDivElement>
  isMessageSeen: (msg: ChatMessage) => boolean
  getSeenByNames: (msg: ChatMessage) => string
}

export default function MessageList({
  messages, loading, hasOlder, olderLoading, onLoadOlder,
  currentUserId, user, channelType, otherLastRead, memberReads,
  editingId, editText, onEditTextChange, onStartEdit, onSaveEdit,
  onCancelEdit, onDelete, onReact, onOpenReactionPicker, onOpenFile, onReply,
  typingText, messagesEndRef, containerRef, isMessageSeen, getSeenByNames,
}: Props) {
  if (loading) {
    return (
      <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', bgcolor: BONE }}>
        <CircularProgress size={22} sx={{ color: NAVY }} />
      </Box>
    )
  }

  if (messages.length === 0) {
    return (
      <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 1, bgcolor: BONE, px: 3 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700, color: INK }}>No messages yet</Typography>
        <Typography sx={{ fontSize: 13, color: MIST, textAlign: 'center', lineHeight: 1.5 }}>Send the first message to start the conversation.</Typography>
      </Box>
    )
  }

  const unreadIdx = otherLastRead
    ? messages.findIndex(msg => new Date(msg.created_at) > new Date(otherLastRead))
    : -1

  return (
    <Box ref={containerRef} sx={{ flex: 1, overflow: 'auto', px: { xs: 1.5, md: 2.5 }, py: 1.5, bgcolor: '#F3F0EA', display: 'flex', flexDirection: 'column' }}>
      {hasOlder && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Button size="small" variant="outlined" onClick={onLoadOlder} disabled={olderLoading}
            startIcon={olderLoading ? <CircularProgress size={14} /> : <ExpandMoreIcon sx={{ transform: 'rotate(180deg)' }} />}
            sx={{ borderRadius: 2, fontSize: 12, textTransform: 'none', color: INK, borderColor: OUTLINE, '&:hover': { borderColor: NAVY, color: NAVY } }}>
            {olderLoading ? 'Loading...' : 'Load earlier messages'}
          </Button>
        </Box>
      )}

      {messages.map((msg, i) => {
        const isUnreadStart = i === unreadIdx
        const isMine = msg.sender_id === currentUserId
        const showAvatar = i === 0 || messages[i - 1]?.sender_id !== msg.sender_id
        const msgDate = new Date(msg.created_at)
        const prevDate = i > 0 ? new Date(messages[i - 1].created_at) : null
        const showDateDivider = !prevDate || msgDate.toDateString() !== prevDate.toDateString()
        const nextMsg = messages[i + 1]
        const sameSenderAfter = nextMsg && nextMsg.sender_id === msg.sender_id && !showDateDivider && i + 1 !== unreadIdx
        const sameSenderBefore = i > 0 && messages[i - 1]?.sender_id === msg.sender_id && !showDateDivider

        const mt = sameSenderBefore ? 0.25 : showDateDivider || isUnreadStart ? 1.5 : 0.75
        const mb = sameSenderAfter ? 0 : 0.5

        return (
          <Box key={msg.id} sx={{ mt: showDateDivider || isUnreadStart ? 0 : mt, mb }}>
            {isUnreadStart && (
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 1.5, mb: 1.5 }}>
                <Box sx={{ flex: 1, borderTop: `1px solid ${EMERALD}` }} />
                <Typography variant="caption" sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: EMERALD_DEEP }}>
                  New messages
                </Typography>
                <Box sx={{ flex: 1, borderTop: `1px solid ${EMERALD}` }} />
              </Stack>
            )}

            {showDateDivider && (
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 1.5, mb: 1 }}>
                <Box sx={{ flex: 1, borderTop: `1px solid ${HAIRLINE}` }} />
                <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600, color: MIST }}>{formatDate(msg.created_at)}</Typography>
                <Box sx={{ flex: 1, borderTop: `1px solid ${HAIRLINE}` }} />
              </Stack>
            )}

            <MessageBubble
              msg={msg} isMine={isMine} showAvatar={showAvatar}
              seen={isMessageSeen(msg)} seenBy={getSeenByNames(msg)}
              editingId={editingId} editText={editText} onEditTextChange={onEditTextChange}
              onStartEdit={() => onStartEdit(msg)} onSaveEdit={() => onSaveEdit(msg)} onCancelEdit={onCancelEdit}
              onDelete={() => onDelete(msg)} onReact={emoji => onReact(msg, emoji)}
              onOpenReactionPicker={onOpenReactionPicker} onOpenFile={onOpenFile} onReply={onReply}
              user={user} channelType={channelType}
              otherLastRead={otherLastRead} memberReads={memberReads}
            />
          </Box>
        )
      })}

      {typingText && (
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5, ml: 1 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: EMERALD, animation: 'pulse 1.2s ease-in-out infinite', '@keyframes pulse': { '0%, 100%': { opacity: 0.4 }, '50%': { opacity: 1 } } }} />
          <Typography variant="caption" sx={{ fontSize: 12, color: MIST, fontStyle: 'italic' }}>{typingText}</Typography>
        </Stack>
      )}

      <div ref={messagesEndRef} />
    </Box>
  )
}
