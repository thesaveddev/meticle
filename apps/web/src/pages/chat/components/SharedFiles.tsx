import { useRef, useState } from 'react'
import { Box, Typography, Button, IconButton, Stack, Paper, Table, TableHead, TableBody, TableRow, TableCell, TableContainer, CircularProgress } from '@mui/material'
import { AttachFile as AttachFileIcon, Download as DownloadIcon, Delete as DeleteIcon, GridView as GridViewIcon, ViewList as ViewListIcon, Description as FileIcon } from '@mui/icons-material'
import { type SharedFile } from '../hooks/useChat'
import { formatFileSize, formatDate, NAVY, INK, MIST, BONE, HAIRLINE, OUTLINE, WINDOW_BORDER, WHITE } from '../utils'
import SecureImg from './SecureImg'

interface Props {
  files: SharedFile[]
  loading: boolean
  onUpload: (file: File) => Promise<any>
  onDelete: (fileId: string) => void
  onOpenFile: (url: string, name: string) => void
  onDownload: (url: string, name: string) => void
}

export default function SharedFiles({ files, loading, onUpload, onDelete, onOpenFile, onDownload }: Props) {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try { await onUpload(file) }
    finally { setUploading(false); if (e.target) e.target.value = '' }
  }

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
        <FileIcon sx={{ fontSize: 40, color: HAIRLINE }} />
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: INK }}>No shared files</Typography>
        <Typography sx={{ fontSize: 12, color: MIST, maxWidth: 320, textAlign: 'center', lineHeight: 1.5 }}>
          Upload documents, plans, and minutes for the team.
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${HAIRLINE}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: 13, color: INK }}>Files</Typography>
          <Typography variant="caption" sx={{ fontSize: 11, color: MIST }}>{files.length}</Typography>
          <IconButton size="small" onClick={() => setViewMode('list')} sx={{ color: viewMode === 'list' ? NAVY : MIST, width: 28, height: 28 }}>
            <ViewListIcon sx={{ fontSize: 16 }} />
          </IconButton>
          <IconButton size="small" onClick={() => setViewMode('grid')} sx={{ color: viewMode === 'grid' ? NAVY : MIST, width: 28, height: 28 }}>
            <GridViewIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Stack>
        <Button variant="outlined" size="small" component="label" startIcon={<AttachFileIcon sx={{ fontSize: 16 }} />}
          disabled={uploading}
          sx={{ color: NAVY, borderColor: OUTLINE, textTransform: 'none', fontWeight: 600, fontSize: 12, '&:hover': { borderColor: NAVY } }}>
          {uploading ? 'Uploading…' : 'Upload'}
          <input type="file" ref={fileInputRef} hidden onChange={handleUpload} />
        </Button>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {viewMode === 'grid' ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 1.5 }}>
            {files.map(f => {
              const isImage = f.file_url?.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i)
              return (
                <Paper key={f.id} variant="outlined" sx={{
                  borderRadius: 2, overflow: 'hidden', cursor: 'pointer', position: 'relative',
                  borderColor: WINDOW_BORDER, '&:hover': { borderColor: NAVY, '& .dl-btn': { opacity: 1 } },
                }} onClick={() => onOpenFile(f.file_url, f.file_name)}>
                  <Box sx={{ height: 120, bgcolor: BONE, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {isImage ? <SecureImg src={f.file_url} alt={f.file_name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <FileIcon sx={{ fontSize: 36, color: MIST }} />}
                  </Box>
                  <IconButton className="dl-btn" size="small"
                    onClick={e => { e.stopPropagation(); onDownload(f.file_url, f.file_name) }}
                    sx={{ position: 'absolute', top: 4, right: 4, bgcolor: WHITE, opacity: 0, transition: 'opacity 0.15s', '&:hover': { bgcolor: BONE } }}>
                    <DownloadIcon sx={{ fontSize: 16, color: NAVY }} />
                  </IconButton>
                  <Box sx={{ p: 1 }}>
                    <Typography variant="body2" fontWeight={600} noWrap sx={{ fontSize: 12.5, color: INK }}>{f.file_name}</Typography>
                    <Typography variant="caption" sx={{ fontSize: 10.5, color: MIST }}>
                      {f.file_size ? formatFileSize(f.file_size) : ''}{f.file_size && f.created_at ? ' · ' : ''}{f.created_at ? formatDate(f.created_at) : ''}
                    </Typography>
                  </Box>
                </Paper>
              )
            })}
          </Box>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ borderColor: WINDOW_BORDER }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: BONE }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, color: INK }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, color: INK }}>Size</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, color: INK }}>Date</TableCell>
                  <TableCell sx={{ width: 80, fontWeight: 700, fontSize: 12, color: INK }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {files.map(f => (
                  <TableRow key={f.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <FileIcon sx={{ fontSize: 18, color: NAVY }} />
                        <Typography variant="body2" onClick={() => onOpenFile(f.file_url, f.file_name)}
                          sx={{ color: NAVY, fontWeight: 600, cursor: 'pointer', '&:hover': { textDecoration: 'underline' }, fontSize: 13 }}>
                          {f.file_name}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ color: MIST, fontSize: 12 }}>{f.file_size ? formatFileSize(f.file_size) : '—'}</TableCell>
                    <TableCell sx={{ color: MIST, fontSize: 12 }}>{formatDate(f.created_at)}</TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => onDownload(f.file_url, f.file_name)} sx={{ width: 28, height: 28 }}>
                        <DownloadIcon sx={{ fontSize: 16, color: NAVY }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => onDelete(f.id)} sx={{ width: 28, height: 28 }}>
                        <DeleteIcon sx={{ fontSize: 16, color: '#DC2626' }} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Box>
  )
}
