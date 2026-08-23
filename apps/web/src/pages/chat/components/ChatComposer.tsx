import { useRef, useState } from 'react'
import { Box, TextField, Button, IconButton, Stack, Typography, CircularProgress, Paper, Tooltip } from '@mui/material'
import { Send as SendIcon, AttachFile as AttachFileIcon, Mood as MoodIcon, Close as CloseIcon } from '@mui/icons-material'
import { EMOJIS, NAVY, NAVY_DEEP, INK, MIST, BONE, OUTLINE, WHITE } from '../utils'
import { type ChatMessage } from '../hooks/useChat'

interface Props {
  messageText: string
  onTextChange: (t: string) => void
  onSend: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onTyping: () => void
  sending: boolean
  sendError: string
  activeChannel: string | null
  onFileSelect: (file: File) => void
  inputLinkPreview: { title: string; description: string; image: string; url: string } | null
  inputLinkLoading: boolean
  replyTo: ChatMessage | null
  onCancelReply: () => void
  pendingFile: File | null
  onCancelFile: () => void
  currentUserId: string
}

export default function ChatComposer({
  messageText, onTextChange, onSend, onKeyDown, onTyping,
  sending, sendError, activeChannel, onFileSelect,
  inputLinkPreview, inputLinkLoading,
  replyTo, onCancelReply, pendingFile, onCancelFile, currentUserId,
}: Props) {
  const [showEmoji, setShowEmoji] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const emojiRef = useRef<HTMLDivElement>(null)

  const insertEmoji = (emoji: string) => {
    onTextChange(messageText + emoji)
    setShowEmoji(false)
    onTyping()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      onFileSelect(e.target.files[0])
      e.target.value = ''
    }
  }

  return (
    <Box sx={{ borderTop: `1px solid ${OUTLINE}`, bgcolor: WHITE }}>
      {/* Reply context */}
      {replyTo && (
        <Box sx={{ px: 2.5, pt: 1.5, pb: 0.5 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{
            px: 1.25, py: 0.75, borderRadius: 2,
            bgcolor: BONE, borderLeft: `3px solid ${NAVY}`,
          }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 11, color: NAVY, display: 'block' }}>
                Replying to {replyTo.sender_id === currentUserId ? 'yourself' : (replyTo.first_name ? `${replyTo.first_name} ${replyTo.last_name || ''}`.trim() : replyTo.email?.split('@')[0] || 'Unknown')}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: 11, color: MIST, display: 'block' }} noWrap>
                {replyTo.content || (replyTo.file_name ? `📎 ${replyTo.file_name}` : '')}
              </Typography>
            </Box>
            <IconButton size="small" onClick={onCancelReply} sx={{ width: 24, height: 24, '&:hover': { bgcolor: OUTLINE } }}>
              <CloseIcon sx={{ fontSize: 15, color: MIST }} />
            </IconButton>
          </Stack>
        </Box>
      )}

      {pendingFile && (
        <Box sx={{ px: 2.5, pt: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1.25, py: 0.75, borderRadius: 2, bgcolor: BONE, borderLeft: `3px solid ${NAVY}` }}>
            <AttachFileIcon sx={{ fontSize: 18, color: NAVY }} />
            <Typography variant="caption" sx={{ flex: 1, color: INK, fontWeight: 700 }} noWrap>{pendingFile.name}</Typography>
            <Typography variant="caption" sx={{ color: MIST }}>{Math.ceil(pendingFile.size / 1024)} KB</Typography>
            <IconButton size="small" onClick={onCancelFile} sx={{ width: 24, height: 24 }}><CloseIcon sx={{ fontSize: 15, color: MIST }} /></IconButton>
          </Stack>
        </Box>
      )}

      {/* Link preview */}
      {inputLinkPreview && (
        <Box sx={{ px: 2.5, pt: 1.5 }}>
          <Box component="a" href={inputLinkPreview.url} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            sx={{ display: 'flex', borderRadius: 2, overflow: 'hidden', border: `1px solid ${OUTLINE}`, textDecoration: 'none', color: 'inherit', maxWidth: 340, '&:hover': { opacity: 0.9 } }}>
            {inputLinkPreview.image && (
              <Box sx={{ width: 80, minHeight: 60, bgcolor: BONE, flexShrink: 0, overflow: 'hidden' }}>
                <Box component="img" src={inputLinkPreview.image} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e: any) => { e.target.style.display = 'none' }} />
              </Box>
            )}
            <Box sx={{ p: 0.75, flex: 1, minWidth: 0 }}>
              <Typography variant="caption" fontWeight={700} sx={{ display: 'block', fontSize: 11, color: INK }} noWrap>{inputLinkPreview.title}</Typography>
              {inputLinkPreview.description && (
                <Typography variant="caption" sx={{ display: 'block', fontSize: 10, color: MIST, mt: 0.25 }} noWrap>{inputLinkPreview.description}</Typography>
              )}
            </Box>
          </Box>
        </Box>
      )}
      {inputLinkLoading && (
        <Typography variant="caption" sx={{ display: 'block', px: 2.5, pt: 1, fontSize: 11, color: MIST }}>Loading preview…</Typography>
      )}

      {/* Error */}
      {sendError && (
        <Box sx={{ px: 2.5, pt: 1 }}>
          <Typography variant="caption" sx={{ fontSize: 11, color: '#DC2626', fontWeight: 600 }}>{sendError}</Typography>
        </Box>
      )}

      {/* Input row */}
      <Box sx={{ px: 2, py: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="flex-end">
          <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange}
            accept=".jpg,.jpeg,.png,.gif,.webp,.svg,.bmp,.tiff,.tif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.html,.md,.zip,.json,.xml,.rtf" />

          <Tooltip title="Attach file">
            <span>
              <IconButton size="small" aria-label="Attach file" onClick={() => fileInputRef.current?.click()}
                disabled={!activeChannel}
                sx={{ color: MIST, width: 36, height: 36, border: `1px solid ${OUTLINE}`, borderRadius: 2, '&:hover': { bgcolor: BONE, color: NAVY, borderColor: NAVY } }}>
                <AttachFileIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>

          <Box sx={{ position: 'relative', flex: 1 }}>
            <TextField
              fullWidth size="small" multiline maxRows={4} autoFocus
              placeholder={activeChannel ? 'Write a message…' : 'Select a conversation'}
              value={messageText}
              onChange={e => { onTextChange(e.target.value); onTyping() }}
              onKeyDown={onKeyDown}
              disabled={!activeChannel}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2, bgcolor: '#F9F7F3', fontSize: 14, lineHeight: 1.5,
                  '& fieldset': { borderColor: OUTLINE },
                  '&:hover fieldset': { borderColor: NAVY },
                  '&.Mui-focused fieldset': { borderColor: NAVY, borderWidth: 1.5 },
                },
              }}
            />
            {activeChannel && (
              <Box sx={{ position: 'absolute', right: 6, bottom: 4 }}>
                <IconButton size="small" aria-label="Emoji" onClick={() => setShowEmoji(!showEmoji)}
                  sx={{ width: 28, height: 28, color: showEmoji ? NAVY : MIST, '&:hover': { color: NAVY } }}>
                  <MoodIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Box>
            )}
            {showEmoji && (
              <Paper ref={emojiRef} elevation={3}
                sx={{ position: 'absolute', bottom: '100%', right: 0, mb: 1, p: 1, maxWidth: 300, maxHeight: 180, overflow: 'auto', borderRadius: 2, zIndex: 10 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
                  {EMOJIS.map(e => (
                    <Box key={e} component="span" role="button" tabIndex={0} aria-label={`Insert ${e}`}
                      sx={{ cursor: 'pointer', fontSize: 20, lineHeight: 1.5, px: 0.25, '&:hover': { transform: 'scale(1.25)', transition: '0.1s' } }}
                      onClick={() => insertEmoji(e)}
                      onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); insertEmoji(e) } }}>
                      {e}
                    </Box>
                  ))}
                </Box>
              </Paper>
            )}
          </Box>

          <Button
            variant="contained" onClick={onSend}
            disabled={sending || (!messageText.trim() && !replyTo && !pendingFile) || !activeChannel}
            startIcon={sending ? <CircularProgress size={16} sx={{ color: WHITE }} /> : <SendIcon sx={{ fontSize: 18 }} />}
            sx={{
              bgcolor: NAVY, '&:hover': { bgcolor: NAVY_DEEP }, '&:disabled': { bgcolor: OUTLINE },
              minWidth: 44, px: 2, height: 36, borderRadius: 2,
              textTransform: 'none', fontWeight: 700, fontSize: 13,
              boxShadow: '0 1px 3px rgba(15,76,129,0.2)',
            }}>
            Send
          </Button>
        </Stack>
      </Box>
    </Box>
  )
}
