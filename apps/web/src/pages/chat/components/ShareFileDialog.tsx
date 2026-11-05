import { useRef, useState } from 'react'
import { Dialog, DialogTitle, DialogContent, Avatar, Box, Stack, Typography, TextField, Button, IconButton } from '@mui/material'
import { InsertDriveFile as FileIcon, Close as CloseIcon, CloudUpload as UploadIcon } from '@mui/icons-material'
import { NAVY, NAVY_DEEP, INK, MIST, BONE, OUTLINE, HAIRLINE, WHITE } from '../utils'

interface Props {
  open: boolean
  onClose: () => void
  channelName: string
  onSendFile: (file: File, caption: string) => Promise<boolean>
  onSent?: () => void
  onFailed?: () => void
}

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.ceil(bytes / 1024))} KB`
}

export default function ShareFileDialog({ open, onClose, channelName, onSendFile, onSent, onFailed }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const close = () => { onClose(); setFile(null); setCaption(''); setDragOver(false) }

  const send = async () => {
    if (!file || sending) return
    setSending(true)
    try {
      const ok = await onSendFile(file, caption)
      if (ok) { close(); onSent?.() } else { onFailed?.() }
    } catch {
      onFailed?.()
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onClose={close} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, fontSize: 16, color: INK, px: 3, py: 2 }}>
        Share file{channelName ? ` · ${channelName}` : ''}
      </DialogTitle>
      <DialogContent sx={{ px: 3, pb: 2 }}>
        <Stack spacing={1.5}>
          <input type="file" ref={inputRef} style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.length) setFile(e.target.files[0]); e.target.value = '' }}
            accept=".jpg,.jpeg,.png,.gif,.webp,.svg,.bmp,.tiff,.tif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.html,.md,.zip,.json,.xml,.rtf" />
          {!file ? (
            <Box
              role="button" tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={e => { if (e.key === 'Enter') inputRef.current?.click() }}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) setFile(e.dataTransfer.files[0]) }}
              sx={{
                border: `1.5px dashed ${dragOver ? NAVY : OUTLINE}`, borderRadius: 3,
                bgcolor: dragOver ? BONE : WHITE,
                px: 2, py: 3.5, textAlign: 'center', cursor: 'pointer',
                '&:hover': { borderColor: NAVY, bgcolor: BONE },
              }}>
              <UploadIcon sx={{ fontSize: 28, color: dragOver ? NAVY : MIST }} />
              <Typography variant="body2" fontWeight={600} sx={{ color: INK, mt: 1 }}>
                Drop a file here or click to browse
              </Typography>
              <Typography variant="caption" sx={{ color: MIST, display: 'block', mt: 0.5 }}>
                Up to 25MB — documents, images, spreadsheets
              </Typography>
            </Box>
          ) : (
            <Stack direction="row" spacing={1.5} alignItems="center"
              sx={{ px: 1.5, py: 1.25, borderRadius: 2, bgcolor: BONE, border: `1px solid ${HAIRLINE}` }}>
              <Avatar variant="rounded" sx={{ width: 40, height: 40, bgcolor: WHITE, border: `1px solid ${HAIRLINE}` }}>
                <FileIcon sx={{ color: NAVY, fontSize: 22 }} />
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} sx={{ color: INK }} noWrap>{file.name}</Typography>
                <Typography variant="caption" sx={{ color: MIST }}>{formatSize(file.size)}</Typography>
              </Box>
              <IconButton size="small" aria-label="Remove file" onClick={() => setFile(null)} sx={{ width: 28, height: 28 }}>
                <CloseIcon sx={{ fontSize: 16, color: MIST }} />
              </IconButton>
            </Stack>
          )}

          <TextField
            fullWidth size="small" multiline maxRows={3}
            placeholder="Add a message (optional)"
            value={caption}
            onChange={e => setCaption(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2, bgcolor: WHITE, fontSize: 13,
                '& fieldset': { borderColor: HAIRLINE },
                '&:hover fieldset': { borderColor: NAVY },
                '&.Mui-focused fieldset': { borderColor: NAVY, borderWidth: 1.5 },
              },
            }}
          />

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={close} sx={{ color: MIST, fontWeight: 600, textTransform: 'none' }}>Cancel</Button>
            <Button variant="contained" onClick={send} disabled={!file || sending}
              sx={{ bgcolor: NAVY, '&:hover': { bgcolor: NAVY_DEEP }, textTransform: 'none', fontWeight: 600, borderRadius: 999, px: 3 }}>
              {sending ? 'Sending…' : 'Send file'}
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  )
}
