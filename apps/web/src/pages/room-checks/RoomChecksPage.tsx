import { useState } from 'react'
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, Chip, Stack, TextField, MenuItem, TablePagination, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, Alert, Rating, Autocomplete } from '@mui/material'
import { Add as AddIcon, CameraAlt } from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'

export default function RoomChecksPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(0); const [rows, setRows] = useState(10)
  const [filter, setFilter] = useState(''); const [locFilter, setLocFilter] = useState('')
  const [dialog, setDialog] = useState(false)
  const [form, setForm] = useState({ location_id: '', room_number: '', check_date: new Date().toISOString().split('T')[0], status: 'pass', cleanliness_rating: 3, safety_rating: 3, notes: '' })
  const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState(''); const [viewPhoto, setViewPhoto] = useState<string | null>(null)

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
      if (file) {
        const fd = new FormData(); fd.append('photo', file)
        const up = await api.post('/settings/upload', fd)
        return api.post('/room-checks', { ...form, photo_url: up.data.url, check_date: form.check_date || undefined })
      }
      return api.post('/room-checks', form)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['room-checks'] }); close() },
    onError: (e: any) => setError(e.response?.data?.message || 'Save failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/room-checks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['room-checks'] }),
  })

  const close = () => { setDialog(false); setForm({ location_id: '', room_number: '', check_date: new Date().toISOString().split('T')[0], status: 'pass', cleanliness_rating: 3, safety_rating: 3, notes: '' }); setFile(null); setPreview(null); setError('') }

  const loadPhoto = (url: string) => {
    const token = localStorage.getItem('accessToken')
    fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.blob()).then(b => setViewPhoto(URL.createObjectURL(b))).catch(() => {})
  }

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /></Box>

  const STATUS_CONFIG: Record<string, { label: string; color: 'success' | 'error' | 'warning' }> = { pass: { label: 'Pass', color: 'success' }, fail: { label: 'Fail', color: 'error' }, needs_attention: { label: 'Needs Attention', color: 'warning' } }

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
              <TableRow key={c.id} hover>
                <TableCell sx={{ fontWeight: 600 }}>{c.room_number}</TableCell>
                <TableCell>{c.location_name || '—'}</TableCell>
                <TableCell>{new Date(c.check_date).toLocaleDateString('en-GB')}</TableCell>
                <TableCell><Rating value={c.cleanliness_rating || 0} readOnly size="small" max={5} /></TableCell>
                <TableCell><Rating value={c.safety_rating || 0} readOnly size="small" max={5} /></TableCell>
                <TableCell><Chip label={STATUS_CONFIG[c.status]?.label || c.status} size="small" color={STATUS_CONFIG[c.status]?.color || 'default'} /></TableCell>
                <TableCell>{c.checked_by_name || '—'}</TableCell>
                <TableCell align="right">
                  {c.photo_url && <Button size="small" onClick={() => loadPhoto(c.photo_url)} sx={{ textTransform: 'none', fontSize: '0.7rem' }}>Photo</Button>}
                  <Button size="small" color="error" onClick={() => { if (window.confirm('Delete?')) deleteMutation.mutate(c.id) }} sx={{ textTransform: 'none', fontSize: '0.7rem' }}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
            {checks.length === 0 && <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: '#9CA3AF' }}>No room checks recorded</TableCell></TableRow>}
          </TableBody>
        </Table>
        <TablePagination component="div" count={checks.length} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rows} onRowsPerPageChange={e => { setRows(parseInt(e.target.value, 10)); setPage(0) }} rowsPerPageOptions={[5, 10, 25]} />
      </TableContainer>

      <Dialog open={dialog} onClose={close} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={e => { e.preventDefault(); saveMutation.mutate() }}>
          <DialogTitle sx={{ fontWeight: 800 }}>New Room Check</DialogTitle>
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
                {file ? file.name : 'Take Photo (optional)'}
              </Button>
              {preview && <Box component="img" src={preview} alt="Preview" sx={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 1 }} />}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={close}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saveMutation.isPending} sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
              {saveMutation.isPending ? <CircularProgress size={20} /> : 'Save Check'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={!!viewPhoto} onClose={() => setViewPhoto(null)} maxWidth="md">
        {viewPhoto && <img src={viewPhoto} alt="Room check" style={{ maxWidth: '100%', maxHeight: '80vh' }} />}
      </Dialog>
    </Box>
  )
}
