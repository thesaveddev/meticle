import { useState, useEffect } from 'react'
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, Chip, Stack, TextField, MenuItem, TablePagination, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, Alert, Rating, Autocomplete, IconButton } from '@mui/material'
import { Add as AddIcon, CameraAlt, Edit as EditIcon, Delete as DeleteIcon, Close as CloseIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { ConfirmDialog } from '../../components/ui'

const STATUS_CONFIG: Record<string, { label: string; color: 'success' | 'error' | 'warning' }> = {
  pass: { label: 'Pass', color: 'success' },
  fail: { label: 'Fail', color: 'error' },
  needs_attention: { label: 'Needs Attention', color: 'warning' },
}

const EMPTY_FORM = () => ({ location_id: '', room_number: '', check_date: new Date().toISOString().split('T')[0], status: 'pass', cleanliness_rating: 3, safety_rating: 3, notes: '' })

function openFileInNewTab(url: string) {
  const token = localStorage.getItem('accessToken')
  fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.blob()).then(b => {
    window.open(URL.createObjectURL(b), '_blank', 'noopener')
  }).catch(() => {})
}

export default function RoomChecksPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(0); const [rows, setRows] = useState(10)
  const [filter, setFilter] = useState(''); const [locFilter, setLocFilter] = useState('')
  const [dialog, setDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [view, setView] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM())
  const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [photoBlob, setPhotoBlob] = useState<string | null>(null)

  useEffect(() => {
    if (!view?.photo_url) { setPhotoBlob(null); return }
    const token = localStorage.getItem('accessToken')
    let active = true
    let blobUrl = ''
    fetch(view.photo_url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.blob()).then(b => {
      if (active) { blobUrl = URL.createObjectURL(b); setPhotoBlob(blobUrl) }
    }).catch(() => { if (active) setPhotoBlob(view.photo_url) })
    return () => { active = false; if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [view])

  const { data: checks = [], isLoading } = useQuery({
    queryKey: ['room-checks', filter, locFilter],
    queryFn: () => api.get('/room-checks', { params: { status: filter || undefined, location_id: locFilter || undefined } }).then(r => r.data),
  })

  const { data: locations } = useQuery({
    queryKey: ['locations-rc'],
    queryFn: () => api.get('/settings/locations').then(r => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form, location_id: form.location_id || undefined, check_date: form.check_date || undefined }
      if (file) {
        const fd = new FormData(); fd.append('photo', file)
        const up = await api.post('/settings/upload', fd)
        payload.photo_url = up.data.url
      }
      return editingId ? api.patch(`/room-checks/${editingId}`, payload) : api.post('/room-checks', payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['room-checks'] }); close() },
    onError: (e: any) => setError(e.response?.data?.message || 'Save failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/room-checks/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['room-checks'] }); setDeleteTarget(null) },
  })

  const close = () => { setDialog(false); setEditingId(null); setForm(EMPTY_FORM()); setFile(null); setPreview(null); setError('') }

  const openEdit = (c: any) => {
    setEditingId(c.id)
    setForm({ location_id: c.location_id || '', room_number: c.room_number || '', check_date: c.check_date?.slice(0, 10) || new Date().toISOString().split('T')[0], status: c.status || 'pass', cleanliness_rating: c.cleanliness_rating || 3, safety_rating: c.safety_rating || 3, notes: c.notes || '' })
    setFile(null); setPreview(null); setError('')
    setView(null)
    setDialog(true)
  }

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /></Box>

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={800}>Room Checks</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { close(); setDialog(true) }} sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
          New Room Check
        </Button>
      </Stack>

      <Paper sx={{ p: 2, mb: 3, borderRadius: 2, border: '1px solid #E5E7EB' }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField select size="small" value={filter} onChange={e => { setFilter(e.target.value); setPage(0) }} label="Status" sx={{ minWidth: 160 }}>
            <MenuItem value="">All</MenuItem><MenuItem value="pass">Pass</MenuItem><MenuItem value="fail">Fail</MenuItem><MenuItem value="needs_attention">Needs Attention</MenuItem>
          </TextField>
          <TextField select size="small" value={locFilter} onChange={e => { setLocFilter(e.target.value); setPage(0) }} label="Location" sx={{ minWidth: 200 }}>
            <MenuItem value="">All Locations</MenuItem>
            {(locations || []).map((l: any) => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
          </TextField>
        </Stack>
      </Paper>

      <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #E5E7EB' }}>
        <Table size="small">
          <TableHead><TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Room</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Cleanliness</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Safety</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Checked By</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {checks.slice(page * rows, page * rows + rows).map((c: any) => (
              <TableRow key={c.id} hover onClick={() => setView(c)} sx={{ cursor: 'pointer' }}>
                <TableCell sx={{ fontWeight: 600 }}>{c.room_number}</TableCell>
                <TableCell>{c.location_name || '—'}</TableCell>
                <TableCell>{new Date(c.check_date).toLocaleDateString('en-GB')}</TableCell>
                <TableCell><Rating value={c.cleanliness_rating || 0} readOnly size="small" max={5} /></TableCell>
                <TableCell><Rating value={c.safety_rating || 0} readOnly size="small" max={5} /></TableCell>
                <TableCell><Chip label={STATUS_CONFIG[c.status]?.label || c.status} size="small" color={STATUS_CONFIG[c.status]?.color || 'default'} /></TableCell>
                <TableCell>{c.checked_by_name || '—'}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end" onClick={e => e.stopPropagation()}>
                    <IconButton size="small" onClick={() => openEdit(c)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => setDeleteTarget(c.id)}><DeleteIcon fontSize="small" /></IconButton>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {checks.length === 0 && <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: '#9CA3AF' }}>No room checks recorded</TableCell></TableRow>}
          </TableBody>
        </Table>
        <TablePagination component="div" count={checks.length} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rows} onRowsPerPageChange={e => { setRows(parseInt(e.target.value, 10)); setPage(0) }} rowsPerPageOptions={[5, 10, 25]} />
      </TableContainer>

      <Dialog open={!!view} onClose={() => setView(null)} maxWidth="sm" fullWidth>
        {view && (
          <>
            <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                Room Check — {view.room_number}
                <Typography variant="caption" color="#9CA3AF" sx={{ display: 'block', fontWeight: 500 }}>
                  {view.location_name ? `${view.location_name} · ` : ''}{new Date(view.check_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => setView(null)}><CloseIcon fontSize="small" /></IconButton>
            </DialogTitle>
            <DialogContent>
              <Stack spacing={2.5}>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip label={STATUS_CONFIG[view.status]?.label || view.status} size="small" color={STATUS_CONFIG[view.status]?.color || 'default'} sx={{ fontWeight: 700 }} />
                  {view.created_at && <Chip label={`Recorded ${new Date(view.created_at).toLocaleString('en-GB')}`} size="small" variant="outlined" />}
                </Stack>
                <Stack direction="row" spacing={3} flexWrap="wrap">
                  <Box>
                    <Typography variant="caption" color="#9CA3AF" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Cleanliness</Typography>
                    <Rating value={view.cleanliness_rating || 0} readOnly max={5} sx={{ display: 'block', mt: 0.25 }} />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="#9CA3AF" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Safety</Typography>
                    <Rating value={view.safety_rating || 0} readOnly max={5} sx={{ display: 'block', mt: 0.25 }} />
                  </Box>
                </Stack>
                <Box>
                  <Typography variant="caption" color="#9CA3AF" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Notes</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.25 }}>{view.notes || '—'}</Typography>
                </Box>
                {view.checked_by_name && (
                  <Box>
                    <Typography variant="caption" color="#9CA3AF" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Checked by</Typography>
                    <Typography variant="body2" sx={{ mt: 0.25 }}>{view.checked_by_name}</Typography>
                  </Box>
                )}
                {view.photo_url && photoBlob && (
                  <Box>
                    <Typography variant="caption" color="#9CA3AF" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5, display: 'block' }}>Photo</Typography>
                    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
                      <Box component="img" src={photoBlob} alt="Room check" sx={{ width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block', bgcolor: '#F3F4F6' }} />
                      <IconButton size="small" onClick={() => openFileInNewTab(view.photo_url)}
                        sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(255,255,255,0.9)', '&:hover': { bgcolor: '#fff' } }}>
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Paper>
                  </Box>
                )}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 3 }}>
              <Button variant="outlined" startIcon={<EditIcon />} onClick={() => openEdit(view)} sx={{ textTransform: 'none' }}>Edit</Button>
              <Button onClick={() => setView(null)} variant="contained" sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Dialog open={dialog} onClose={close} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={e => { e.preventDefault(); saveMutation.mutate() }}>
          <DialogTitle sx={{ fontWeight: 800 }}>{editingId ? 'Edit Room Check' : 'New Room Check'}</DialogTitle>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Autocomplete options={locations || []} getOptionLabel={(o: any) => o.name}
                value={locations?.find((l: any) => l.id === form.location_id) || null}
                onChange={(_, v) => setForm(f => ({ ...f, location_id: v?.id || '' }))}
                renderInput={p => <TextField {...p} label="Location (optional)" />} />
              <Stack direction="row" spacing={1}>
                <TextField label="Room Number" required fullWidth value={form.room_number} onChange={e => setForm(f => ({ ...f, room_number: e.target.value }))} />
                <TextField label="Check Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.check_date} onChange={e => setForm(f => ({ ...f, check_date: e.target.value }))} />
              </Stack>
              <TextField select label="Status" fullWidth value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <MenuItem value="pass">Pass</MenuItem><MenuItem value="fail">Fail</MenuItem><MenuItem value="needs_attention">Needs Attention</MenuItem>
              </TextField>
              <Box>
                <Typography variant="body2" sx={{ mb: 0.5 }}>Cleanliness</Typography>
                <Rating value={form.cleanliness_rating} onChange={(_, v) => setForm(f => ({ ...f, cleanliness_rating: v || 3 }))} max={5} />
              </Box>
              <Box>
                <Typography variant="body2" sx={{ mb: 0.5 }}>Safety</Typography>
                <Rating value={form.safety_rating} onChange={(_, v) => setForm(f => ({ ...f, safety_rating: v || 3 }))} max={5} />
              </Box>
              <TextField label="Notes" multiline rows={2} fullWidth value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              <input type="file" hidden id="rc-photo" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setPreview(URL.createObjectURL(f)) } e.target.value = '' }} />
              <Button variant="outlined" component="label" htmlFor="rc-photo" startIcon={<CameraAlt />} fullWidth sx={{ textTransform: 'none', py: 1.5, borderStyle: 'dashed' }}>
                {file ? file.name : editingId ? 'Replace Photo (optional)' : 'Take Photo (optional)'}
              </Button>
              {preview && <Box component="img" src={preview} alt="Preview" sx={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 1 }} />}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={close}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saveMutation.isPending} sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
              {saveMutation.isPending ? <CircularProgress size={20} /> : editingId ? 'Save Changes' : 'Save Check'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete room check"
        message="This will permanently remove this room check record."
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget) }}
      />
    </Box>
  )
}
