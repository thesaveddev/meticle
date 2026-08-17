import { useState } from 'react'
import { Box, Typography, Avatar, Paper, IconButton, Tooltip, Stack, Chip } from '@mui/material'
import {
  Mood as MoodIcon, Delete as DeleteIcon, Edit as EditIcon,
  Check as CheckIcon, DoneAll as DoneAllIcon, OpenInNew as OpenInNewIcon,
  Description as FileIcon, AttachFile as AttachFileIcon,
  Reply as ReplyIcon,
} from '@mui/icons-material'
import { type ChatMessage } from '../hooks/useChat'
import { renderMessageText, formatTime, getMemberName, getMemberInitial, FILE_PREVIEW_TYPES, NAVY, NAVY_DEEP, EMERALD, INK, MIST, BONE, HAIRLINE, WHITE, DANGER } from '../utils'
import SecureImg from './SecureImg'
import LinkPreview from './LinkPreview'

interface Props {
  msg: ChatMessage
  isMine: boolean
  showAvatar: boolean
  seen: boolean
  seenBy: string
  editingId: string | null
  editText: string
  onEditTextChange: (t: string) => void
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onDelete: () => void
  onReact: (emoji: string) => void
  onOpenReactionPicker: (e: React.MouseEvent, msgId: string) => void
  onOpenFile: (url: string, name: string) => void
  onReply: (msg: ChatMessage) => void
  user: { first_name?: string; email?: string }
  channelType: string
  otherLastRead: string | null
  memberReads: any[]
}

export default function MessageBubble({
  msg, isMine, showAvatar, seen, seenBy, editingId, editText,
  onEditTextChange, onStartEdit, onSaveEdit, onCancelEdit, onDelete,
  onReact, onOpenReactionPicker, onOpenFile, onReply, user,
  channelType, otherLastRead, memberReads,
}: Props) {
  const [hovered, setHovered] = useState(false)
  const isEditing = editingId === msg.id

  const renderContent = () => {
    if (!msg.content) return null
    return (
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5, fontSize: 14 }}>
        {renderMessageText(msg.content).map((part, i) => {
          if (part.type === 'url') return (
            <Box key={i} component="a" href={part.value} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              sx={{ color: isMine ? WHITE : NAVY, textDecoration: 'underline', fontWeight: 500, '&:hover': { opacity: 0.8 } }}>
              {part.value}
            </Box>
          )
          if (part.type === 'mention') return (
            <Box key={i} component="span"
              sx={{ color: isMine ? WHITE : NAVY, bgcolor: isMine ? 'rgba(255,255,255,0.15)' : 'rgba(15,76,129,0.08)', borderRadius: 0.5, px: 0.25, fontWeight: 700 }}>
              {part.value}
            </Box>
          )
          return <span key={i}>{part.value}</span>
        })}
      </Typography>
    )
  }

  const renderFile = () => {
    if (!msg.file_url) return null
    const isPreviewable = FILE_PREVIEW_TYPES.has(msg.file_type || '') || msg.file_url.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|tif|pdf)$/i)
    const isImage = msg.file_url.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i)

    if (isPreviewable) {
      return (
        <Box sx={{ mt: msg.content ? 0.75 : 0, cursor: 'pointer' }} onClick={() => onOpenFile(msg.file_url!, msg.file_name || 'File')}>
          {isImage ? (
            <SecureImg src={msg.file_url} alt={msg.file_name || ''}
              sx={{ maxWidth: 240, maxHeight: 180, borderRadius: 1.5, objectFit: 'cover', display: 'block' }} />
          ) : (
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{
              bgcolor: isMine ? 'rgba(255,255,255,0.12)' : BONE,
              borderRadius: 1.5, p: 1, border: isMine ? 'none' : `1px solid ${HAIRLINE}`,
            }}>
              <FileIcon sx={{ fontSize: 22, color: isMine ? WHITE : NAVY }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', color: isMine ? WHITE : INK }} noWrap>{msg.file_name || 'File'}</Typography>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <OpenInNewIcon sx={{ fontSize: 11, color: isMine ? 'rgba(255,255,255,0.7)' : MIST }} />
                  <Typography variant="caption" sx={{ fontSize: 10, color: isMine ? 'rgba(255,255,255,0.7)' : MIST }}>Preview</Typography>
                </Stack>
              </Box>
            </Stack>
          )}
        </Box>
      )
    }

    return (
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: msg.content ? 0.5 : 0 }}>
        <AttachFileIcon sx={{ fontSize: 14, color: isMine ? 'rgba(255,255,255,0.6)' : MIST }} />
        <Typography variant="caption" component="a" href={msg.file_url} target="_blank" rel="noopener"
          sx={{ color: isMine ? WHITE : NAVY, textDecoration: 'underline', fontWeight: 500, fontSize: 12 }}>
          {msg.file_name || 'File'}
        </Typography>
      </Stack>
    )
  }

  return (
    <Box
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', mb: 0.5, position: 'relative' }}
    >
      <Stack direction={isMine ? 'row-reverse' : 'row'} spacing={1} alignItems="flex-end" sx={{ maxWidth: '72%' }}>
        {showAvatar ? (
          <Avatar
            src={isMine ? undefined : msg.profile_picture_url || undefined}
            sx={{
              width: 32, height: 32, fontSize: 12,
              bgcolor: isMine ? NAVY : BONE,
              color: isMine ? WHITE : NAVY,
              border: `1px solid ${isMine ? NAVY_DEEP : HAIRLINE}`,
            }}
          >
            {isMine ? (user?.first_name?.[0] || user?.email?.[0] || '?').toUpperCase() : getMemberInitial(msg)}
          </Avatar>
        ) : (
          <Box sx={{ width: 32 }} />
        )}

        <Box sx={{ maxWidth: '100%' }}>
          {showAvatar && (
            <Typography variant="caption" sx={{ display: 'block', mb: 0.25, textAlign: isMine ? 'right' : 'left', fontWeight: 700, fontSize: 11.5, color: isMine ? NAVY : INK }}>
              {isMine ? 'You' : getMemberName(msg)}
            </Typography>
          )}

          {isEditing ? (
            <Stack direction="row" spacing={0.5} alignItems="flex-start">
              <Box component="textarea" autoFocus value={editText} onChange={e => onEditTextChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSaveEdit() } if (e.key === 'Escape') onCancelEdit() }}
                sx={{ flex: 1, minHeight: 40, p: 1, border: `1px solid ${NAVY}`, borderRadius: 1, fontSize: 14, fontFamily: 'inherit', resize: 'none', outline: 'none', lineHeight: 1.5 }} />
              <Stack spacing={0.5}>
                <IconButton size="small" onClick={onSaveEdit} sx={{ bgcolor: NAVY, color: WHITE, '&:hover': { bgcolor: NAVY_DEEP }, width: 28, height: 28 }}>
                  <CheckIcon sx={{ fontSize: 16 }} />
                </IconButton>
                <IconButton size="small" onClick={onCancelEdit} sx={{ bgcolor: WHITE, border: `1px solid ${HAIRLINE}`, width: 28, height: 28 }}>
                  <Box component="span" sx={{ fontSize: 14, fontWeight: 700, color: MIST }}>×</Box>
                </IconButton>
              </Stack>
            </Stack>
          ) : (
            <Paper sx={{
              px: msg.content ? 1.5 : 0.75, py: msg.content ? 0.75 : 0.5,
              borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              bgcolor: isMine ? NAVY : WHITE,
              color: isMine ? WHITE : INK,
              border: isMine ? 'none' : `1px solid ${HAIRLINE}`,
              boxShadow: isMine ? 'none' : '0 1px 2px rgba(0,0,0,0.04)',
              position: 'relative',
            }} elevation={0}>
              {/* Reply preview */}
              {msg.parent_msg_id && (
                <Box sx={{
                  mb: msg.content ? 0.75 : 0.5, px: 1, py: 0.5,
                  borderLeft: `3px solid ${isMine ? 'rgba(255,255,255,0.4)' : NAVY}`,
                  borderRadius: '4px',
                  bgcolor: isMine ? 'rgba(255,255,255,0.08)' : 'rgba(15,76,129,0.04)',
                }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 11, display: 'block', opacity: 0.8 }}>
                    {msg.parent_sender_id === msg.sender_id ? 'You' : (msg.parent_first_name ? `${msg.parent_first_name} ${msg.parent_last_name || ''}`.trim() : msg.parent_email?.split('@')[0] || 'Unknown')}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: 11, opacity: 0.65, display: 'block' }} noWrap>
                    {msg.parent_content || (msg.parent_file_name ? `📎 ${msg.parent_file_name}` : '')}
                  </Typography>
                </Box>
              )}

              {/* Hover actions */}
              <Box sx={{
                position: 'absolute', top: -10, right: isMine ? 'auto' : 0, left: isMine ? 0 : 'auto',
                display: 'flex', gap: 0.25, opacity: hovered ? 1 : 0, transition: 'opacity 0.12s', zIndex: 2,
              }}>
                <IconButton size="small" onClick={e => onOpenReactionPicker(e, msg.id)}
                  sx={{ width: 24, height: 24, bgcolor: WHITE, border: `1px solid ${HAIRLINE}`, boxShadow: '0 1px 2px rgba(0,0,0,0.08)', '&:hover': { bgcolor: BONE } }}>
                  <MoodIcon sx={{ fontSize: 14, color: MIST }} />
                </IconButton>
                <IconButton size="small" onClick={e => { e.stopPropagation(); onReply(msg) }}
                  sx={{ width: 24, height: 24, bgcolor: WHITE, border: `1px solid ${HAIRLINE}`, boxShadow: '0 1px 2px rgba(0,0,0,0.08)', '&:hover': { bgcolor: BONE } }}>
                  <ReplyIcon sx={{ fontSize: 14, color: MIST }} />
                </IconButton>
                {isMine && (
                  <>
                    <IconButton size="small" onClick={e => { e.stopPropagation(); onStartEdit() }}
                      sx={{ width: 24, height: 24, bgcolor: WHITE, border: `1px solid ${HAIRLINE}`, boxShadow: '0 1px 2px rgba(0,0,0,0.08)', '&:hover': { bgcolor: BONE } }}>
                      <EditIcon sx={{ fontSize: 13, color: MIST }} />
                    </IconButton>
                    <IconButton size="small" onClick={e => { e.stopPropagation(); onDelete() }}
                      sx={{ width: 24, height: 24, bgcolor: WHITE, border: `1px solid ${HAIRLINE}`, boxShadow: '0 1px 2px rgba(0,0,0,0.08)', '&:hover': { bgcolor: '#FEE2E2' } }}>
                      <DeleteIcon sx={{ fontSize: 13, color: DANGER }} />
                    </IconButton>
                  </>
                )}
              </Box>

              {renderContent()}
              {msg.edited_at && <Typography variant="caption" sx={{ display: 'block', mt: 0.25, fontSize: 10, opacity: 0.5, fontStyle: 'italic' }}>edited</Typography>}
              {msg.content && renderMessageText(msg.content).filter(p => p.type === 'url').map((part, i) => (
                <LinkPreview key={`lp-${i}`} url={part.value} isMine={isMine} />
              ))}
              {renderFile()}
            </Paper>
          )}

          {/* Reactions */}
          {!isEditing && msg.reactions && msg.reactions.length > 0 && (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
              {msg.reactions.map((r, i) => (
                <Chip key={`${r.emoji}-${i}`} size="small" clickable onClick={() => onReact(r.emoji)}
                  label={`${r.emoji} ${r.count}`}
                  sx={{
                    height: 22, fontSize: 12, fontWeight: r.reacted_by_me ? 700 : 500,
                    bgcolor: r.reacted_by_me ? 'rgba(16,185,129,0.1)' : WHITE,
                    color: r.reacted_by_me ? EMERALD : INK,
                    border: `1px solid ${r.reacted_by_me ? 'rgba(16,185,129,0.3)' : HAIRLINE}`,
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              ))}
            </Stack>
          )}

          {/* Time + read receipts */}
          {!isEditing && (
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.25, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
              <Typography variant="caption" sx={{ fontSize: 10, color: MIST }}>{formatTime(msg.created_at)}</Typography>
              {isMine && seen && (
                <Tooltip title={seenBy}>
                  <DoneAllIcon sx={{ fontSize: 13, color: EMERALD }} />
                </Tooltip>
              )}
              {isMine && !seen && (channelType === 'dm' ? otherLastRead : memberReads.length > 0) && (
                <CheckIcon sx={{ fontSize: 13, color: MIST }} />
              )}
            </Stack>
          )}
        </Box>
      </Stack>
    </Box>
  )
}
