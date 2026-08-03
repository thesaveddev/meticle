import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Box, Typography, Paper, Stack, Button, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Grid,
  IconButton, Card, CardMedia, CardContent, CardActions, Chip, MenuItem,
} from '@mui/material'
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, CameraAlt, Image as ImageIcon, ChevronLeft, ChevronRight, Close as CloseIcon } from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'

const SUPPORT_LEVELS = [
  { value: '', label: 'None specified' },
  { value: 'independent', label: 'Independent' },
  { value: 'minimal', label: 'Minimal support' },
  { value: 'one_to_one', label: '1:1' },
  { value: 'two_to_one', label: '2:1' },
  { value: 'three_to_one', label: '3:1' },
  { value: 'complex', label: 'Complex / high dependency' },
]

const SUPPORT_LEVEL_COLORS: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'> = {
  independent: 'success',
  minimal: 'info',
  one_to_one: 'primary',
  two_to_one: 'warning',
  three_to_one: 'error',
  complex: 'error',
}

const SUPPORT_LEVEL_LABELS: Record<string, string> = {
  independent: 'Independent',
  minimal: 'Minimal',
  one_to_one: '1:1',
  two_to_one: '2:1',
  three_to_one: '3:1',
  complex: 'Complex',
}

interface MemoryEntry {
  id: string; title: string; description: string | null; image_url: string | null;
  image_urls: string[] | null; support_level: string | null;
  recorded_date: string; created_by_name: string | null; created_at: string;
}

function formatDate(raw: string): string {
  if (!raw) return ''
  const d = new Date(raw)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getAllImageUrls(entry: MemoryEntry): string[] {
  if (entry.image_urls && Array.isArray(entry.image_urls) && entry.image_urls.length > 0) {
    return entry.image_urls
  }
  if (entry.image_url) return [entry.image_url]
  return []
}

export default function MemoryBookTab({ personId }: { personId: string }) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewEntry, setViewEntry] = useState<MemoryEntry | null>(null)
  const [viewImageIdx, setViewImageIdx] = useState(0)
  const [editingEntry, setEditingEntry] = useState<MemoryEntry | null>(null)
  const [form, setForm] = useState({ title: '', description: '', recorded_date: new Date().toISOString().split('T')[0], support_level: '' })
  const [files, setFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [error, setError] = useState('')
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({})
  const [loadingThumbs, setLoadingThumbs] = useState<Record<string, boolean>>({})

  const { data: entries = [], isLoading } = useQuery<MemoryEntry[]>({
    queryKey: ['memory-book', personId],
    queryFn: () => api.get(`/people/${personId}/memory-book`).then(r => r.data),
    enabled: !!personId,
  })

  const createMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('title', form.title)
      if (form.description) fd.append('description', form.description)
      fd.append('recorded_date', form.recorded_date)
      if (form.support_level) fd.append('support_level', form.support_level)
      files.forEach(f => fd.append('images', f))
      return api.post(`/people/${personId}/memory-book`, fd)
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['memory-book', personId] }); closeDialog() },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to save'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.patch(`/people/memory-book/${editingEntry?.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['memory-book', personId] }); closeDialog() },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to update'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/people/memory-book/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['memory-book', personId] }),
  })

  const closeDialog = useCallback(() => {
    setDialogOpen(false); setEditingEntry(null)
    setForm({ title: '', description: '', recorded_date: new Date().toISOString().split('T')[0], support_level: '' })
    setFiles([]); previewUrls.forEach(u => URL.revokeObjectURL(u)); setPreviewUrls([]); setError('')
  }, [previewUrls])

  const openCreate = () => { closeDialog(); setDialogOpen(true) }
  const openEdit = (e: MemoryEntry) => {
    setEditingEntry(e)
    setForm({ title: e.title, description: e.description || '', recorded_date: e.recorded_date || new Date().toISOString().split('T')[0], support_level: e.support_level || '' })
    setFiles([]); previewUrls.forEach(u => URL.revokeObjectURL(u)); setPreviewUrls([]); setError('')
    setDialogOpen(true)
  }

  const handleFilesChange = (newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) return
    const arr = Array.from(newFiles)
    setFiles(prev => [...prev, ...arr])
    const newUrls = arr.map(f => URL.createObjectURL(f))
    setPreviewUrls(prev => [...prev, ...newUrls])
  }

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx))
    setPreviewUrls(prev => {
      URL.revokeObjectURL(prev[idx])
      return prev.filter((_, i) => i !== idx)
    })
  }

  const loadThumbnail = useCallback(async (imageUrl: string) => {
    if (thumbnails[imageUrl] || loadingThumbs[imageUrl]) return
    setLoadingThumbs(prev => ({ ...prev, [imageUrl]: true }))
    try {
      const token = localStorage.getItem('accessToken')
      const res = await fetch(`/api${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) { setLoadingThumbs(prev => ({ ...prev, [imageUrl]: false })); return }
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      setThumbnails(prev => ({ ...prev, [imageUrl]: blobUrl }))
      setLoadingThumbs(prev => ({ ...prev, [imageUrl]: false }))
    } catch {
      setLoadingThumbs(prev => ({ ...prev, [imageUrl]: false }))
    }
  }, [thumbnails, loadingThumbs])

  useEffect(() => {
    entries.forEach(e => {
      const urls = getAllImageUrls(e)
      urls.forEach(u => loadThumbnail(u))
    })
  }, [entries, loadThumbnail])

  useEffect(() => {
    return () => {
      Object.values(thumbnails).forEach(url => URL.revokeObjectURL(url))
      previewUrls.forEach(u => URL.revokeObjectURL(u))
    }
  }, [])

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Memory Book</Typography>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreate}
          sx={{ bgcolor: '#0F4C81', textTransform: 'none', borderRadius: 2, px: 2 }}>Add Memory</Button>
      </Stack>

      {entries.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <ImageIcon sx={{ fontSize: 48, color: '#D1D5DB', mb: 1 }} />
          <Typography color="#9CA3AF" sx={{ mb: 1 }}>No memories recorded yet</Typography>
          <Typography variant="caption" color="#6B7280">
            Add photos and notes of adventures, outings, and special moments to share with family.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {entries.map(e => {
            const dateStr = formatDate(e.recorded_date)
            const urls = getAllImageUrls(e)
            return (
              <Grid item xs={12} sm={6} md={4} key={e.id}>
                <Card sx={{ borderRadius: 2, border: '1px solid #E5E7EB', transition: 'box-shadow 0.2s', cursor: 'pointer', '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.1)' } }} onClick={() => { setViewEntry(e); setViewImageIdx(0) }}>
                  {urls.length > 0 && thumbnails[urls[0]] ? (
                    <CardMedia component="img" height="200" image={thumbnails[urls[0]]} alt={e.title}
                      sx={{ objectFit: 'cover' }} />
                  ) : urls.length > 0 && loadingThumbs[urls[0]] ? (
                    <Box sx={{ height: 200, bgcolor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CircularProgress size={24} sx={{ color: '#D1D5DB' }} />
                    </Box>
                  ) : urls.length > 0 ? (
                    <Box sx={{ height: 200, bgcolor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ImageIcon sx={{ fontSize: 48, color: '#D1D5DB' }} />
                    </Box>
                  ) : (
                    <Box sx={{ height: 200, bgcolor: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                      <ImageIcon sx={{ fontSize: 40, color: '#FDBA74', mb: 0.5 }} />
                      <Typography variant="caption" color="#9A3412">No photo</Typography>
                    </Box>
                  )}
                  <CardContent sx={{ pb: 1 }}>
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
                      <Typography variant="subtitle2" fontWeight={700} noWrap sx={{ flex: 1 }}>{e.title}</Typography>
                      {e.support_level && SUPPORT_LEVEL_LABELS[e.support_level] && (
                        <Chip label={SUPPORT_LEVEL_LABELS[e.support_level]} size="small"
                          color={SUPPORT_LEVEL_COLORS[e.support_level] || 'default'} sx={{ height: 20, fontSize: 10 }} />
                      )}
                    </Stack>
                    {e.description && (
                      <Typography variant="body2" color="#6B7280" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {e.description}
                      </Typography>
                    )}
                    {urls.length > 1 && (
                      <Typography variant="caption" color="#9CA3AF" sx={{ display: 'flex', alignItems: 'center', gap: 0.3, mt: 0.5 }}>
                        <ImageIcon sx={{ fontSize: 14 }} /> {urls.length} photos
                      </Typography>
                    )}
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
                      <Typography variant="caption" color="#9CA3AF">{dateStr}</Typography>
                      {e.created_by_name && <Typography variant="caption" color="#9CA3AF">by {e.created_by_name}</Typography>}
                    </Stack>
                  </CardContent>
                  <CardActions sx={{ pt: 0, justifyContent: 'flex-end' }}>
                    <IconButton size="small" onClick={(ev) => { ev.stopPropagation(); openEdit(e) }}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={(ev) => { ev.stopPropagation(); if (window.confirm('Delete this memory?')) deleteMutation.mutate(e.id) }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            )
          })}
        </Grid>
      )}

      {/* View Dialog */}
      <Dialog open={!!viewEntry} onClose={() => setViewEntry(null)} maxWidth="md" fullWidth>
        {viewEntry && (
          <>
            <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              {viewEntry.title}
              {viewEntry.support_level && SUPPORT_LEVEL_LABELS[viewEntry.support_level] && (
                <Chip label={SUPPORT_LEVEL_LABELS[viewEntry.support_level]} size="small"
                  color={SUPPORT_LEVEL_COLORS[viewEntry.support_level] || 'default'} />
              )}
              <Box sx={{ flex: 1 }} />
              <IconButton size="small" onClick={() => setViewEntry(null)}><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent>
              {(() => {
                const urls = getAllImageUrls(viewEntry)
                return (
                  <Stack spacing={2}>
                    {urls.length > 0 && (
                      <Box sx={{ position: 'relative', borderRadius: 1, overflow: 'hidden', bgcolor: '#F9FAFB' }}>
                        {thumbnails[urls[viewImageIdx]] ? (
                          <img src={thumbnails[urls[viewImageIdx]]} alt={viewEntry.title}
                            style={{ width: '100%', maxHeight: 400, objectFit: 'contain', display: 'block' }} />
                        ) : (
                          <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CircularProgress />
                          </Box>
                        )}
                        {urls.length > 1 && (
                          <>
                            <IconButton size="small" sx={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', bgcolor: 'rgba(0,0,0,0.4)', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' } }}
                              onClick={() => setViewImageIdx(prev => (prev - 1 + urls.length) % urls.length)}>
                              <ChevronLeft />
                            </IconButton>
                            <IconButton size="small" sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', bgcolor: 'rgba(0,0,0,0.4)', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' } }}
                              onClick={() => setViewImageIdx(prev => (prev + 1) % urls.length)}>
                              <ChevronRight />
                            </IconButton>
                            <Stack direction="row" spacing={0.5} justifyContent="center" sx={{ mt: 1 }}>
                              {urls.map((_, i) => (
                                <Box key={i} sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: i === viewImageIdx ? '#0F4C81' : '#D1D5DB', cursor: 'pointer' }} onClick={() => setViewImageIdx(i)} />
                              ))}
                            </Stack>
                          </>
                        )}
                      </Box>
                    )}
                    {viewEntry.description && (
                      <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{viewEntry.description}</Typography>
                    )}
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Typography variant="caption" color="#9CA3AF">Date: {formatDate(viewEntry.recorded_date)}</Typography>
                      {viewEntry.created_by_name && <Typography variant="caption" color="#9CA3AF">Recorded by: {viewEntry.created_by_name}</Typography>}
                    </Stack>
                  </Stack>
                )
              })()}
            </DialogContent>
          </>
        )}
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={e => { e.preventDefault(); (editingEntry ? updateMutation : createMutation).mutate() }}>
          <DialogTitle sx={{ fontWeight: 800 }}>{editingEntry ? 'Edit Memory' : 'Add Memory'}</DialogTitle>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 1 }}>{error}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Title" fullWidth required value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Day at the park, Birthday party..." />
              <TextField label="Description" fullWidth multiline rows={3} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What happened, who was there..." />
              <TextField label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }}
                value={form.recorded_date} onChange={e => setForm(f => ({ ...f, recorded_date: e.target.value }))} />
              <TextField select label="Level of Support" fullWidth value={form.support_level}
                onChange={e => setForm(f => ({ ...f, support_level: e.target.value }))}>
                {SUPPORT_LEVELS.map(sl => (
                  <MenuItem key={sl.value} value={sl.value}>{sl.label}</MenuItem>
                ))}
              </TextField>
              <Box>
                <input type="file" ref={fileInputRef} hidden multiple accept="image/*"
                  onChange={e => { handleFilesChange(e.target.files); e.target.value = '' }} />
                <Stack spacing={1}>
                  {previewUrls.length > 0 && (
                    <Grid container spacing={1}>
                      {previewUrls.map((pu, i) => (
                        <Grid item xs={4} key={i}>
                          <Box sx={{ position: 'relative', borderRadius: 1, overflow: 'hidden' }}>
                            <img src={pu} alt={`Preview ${i + 1}`} style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} />
                            <IconButton size="small" sx={{ position: 'absolute', top: 2, right: 2, bgcolor: 'rgba(0,0,0,0.5)', color: 'white', width: 24, height: 24 }}
                              onClick={() => removeFile(i)}>
                              <DeleteIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                  {!editingEntry && (
                    <Button variant="outlined" startIcon={<CameraAlt />} onClick={() => fileInputRef.current?.click()}
                      sx={{ textTransform: 'none', width: '100%', py: 1.5, borderStyle: 'dashed', borderRadius: 1 }}>
                      {previewUrls.length > 0 ? 'Add More Photos' : 'Add Photos'}
                    </Button>
                  )}
                  {editingEntry && getAllImageUrls(editingEntry).length > 0 && (
                    <Typography variant="caption" color="#6B7280">
                      Existing images: {getAllImageUrls(editingEntry).length} photo(s). Upload new images via Edit only.
                    </Typography>
                  )}
                </Stack>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={closeDialog} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={createMutation.isPending || updateMutation.isPending}
              sx={{ bgcolor: '#0F4C81', textTransform: 'none', borderRadius: 1.5 }}>
              {createMutation.isPending || updateMutation.isPending ? <CircularProgress size={20} /> : (editingEntry ? 'Update' : 'Save Memory')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  )
}
