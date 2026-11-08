import { Box, Typography, Button, IconButton, Paper, CircularProgress } from '@mui/material'
import { Download as DownloadIcon, Delete as DeleteIcon, Description as FileIcon } from '@mui/icons-material'
import { type SharedFile } from '../hooks/useChat'
import { formatFileSize, formatDate, formatChatTime, NAVY, INK, MIST } from '../utils'

interface Props {
  files: SharedFile[]
  loading: boolean
  onUpload: (file: File) => Promise<any>
  onDelete: (fileId: string) => void
  onOpenFile: (url: string, name: string) => void
  onDownload: (url: string, name: string) => void
}

export default function SharedFiles({ files, loading, onDelete, onDownload }: Props) {
  if (loading) {
    return (
      <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <CircularProgress size={22} sx={{ color: NAVY }} />
      </Box>
    )
  }

  if (files.length === 0) {
    return (
      <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 1, py: 6 }}>
        <FileIcon sx={{ fontSize: 40, color: MIST }} />
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: INK }}>No shared files</Typography>
        <Typography sx={{ fontSize: 12, color: MIST, maxWidth: 320, textAlign: 'center', lineHeight: 1.5 }}>
          Upload documents, plans, and minutes for the team.
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {files.map(f => {
        const sharer = `${f.first_name || ''} ${f.last_name || ''}`.trim() || f.email?.split('@')[0] || 'Someone'
        const when = formatDate(f.created_at) === 'Today'
          ? `Today ${formatChatTime(f.created_at)}`
          : formatDate(f.created_at)
        return (
          <Paper key={f.id} variant="outlined" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: 2, borderColor: '#E3E9F0' }}>
            <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: '#EAF2FB', color: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FileIcon />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700} noWrap sx={{ color: INK }}>{f.file_name}</Typography>
              <Typography variant="caption" sx={{ color: MIST }}>Shared by {sharer} · {when}{f.file_size ? ` · ${formatFileSize(f.file_size)}` : ''}</Typography>
            </Box>
            <Button variant="outlined" size="small" startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
              onClick={() => onDownload(f.file_url, f.file_name)}
              sx={{ textTransform: 'none', fontWeight: 600, flexShrink: 0, borderRadius: 2 }}>
              Download
            </Button>
            <IconButton size="small" aria-label={`Delete ${f.file_name}`} onClick={() => onDelete(f.id)} sx={{ width: 32, height: 32, flexShrink: 0 }}>
              <DeleteIcon sx={{ fontSize: 16, color: '#EF4444' }} />
            </IconButton>
          </Paper>
        )
      })}
    </Box>
  )
}
