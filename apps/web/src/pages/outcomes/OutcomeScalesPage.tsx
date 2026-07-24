import { useState, useEffect } from 'react'
import { Box, Typography, Paper, Stack, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Chip, CircularProgress, Alert, Tooltip } from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material'
import api from '../../services/api'

interface OutcomeScale {
  id: string; name: string; shortcode: string; description?: string
  min_score: number; max_score: number
  score_bands: Array<{ min: number; max: number; label: string; color: string }>
  is_active: boolean; total_assessments?: number
}

const defaultBands = [
  { min: 0, max: 33, label: 'Low', color: '#DC2626' },
  { min: 34, max: 66, label: 'Medium', color: '#D97706' },
  { min: 67, max: 100, label: 'High', color: '#16A34A' },
]

export default function OutcomeScalesPage() {
  const [scales, setScales] = useState<OutcomeScale[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<OutcomeScale | null>(null)
  const [saving, setSaving] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [form, setForm] = useState({
    name: '', shortcode: '', description: '',
    min_score: 0, max_score: 100,
    bands: [...defaultBands],
  })

  const fetchScales = async () => {
    try { const r = await api.get('/outcomes/scales'); setScales(r.data) }
    catch (e: any) { setFetchError(e?.response?.data?.message || 'Failed to load scales') }
    setLoading(false)
  }

  useEffect(() => { fetchScales() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', shortcode: '', description: '', min_score: 0, max_score: 100, bands: [...defaultBands] })
    setDialogOpen(true)
  }

  const openEdit = (s: OutcomeScale) => {
    setEditing(s)
    setForm({
      name: s.name, shortcode: s.shortcode, description: s.description || '',
      min_score: s.min_score, max_score: s.max_score,
      bands: s.score_bands.length ? s.score_bands : [...defaultBands],
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        shortcode: form.shortcode,
        description: form.description || null,
        min_score: form.min_score,
        max_score: form.max_score,
        score_bands: form.bands.filter(b => b.label),
      }
      if (editing) { await api.patch(`/outcomes/scales/${editing.id}`, payload) }
      else { await api.post('/outcomes/scales', payload) }
      setDialogOpen(false); fetchScales()
    } catch (e: any) { setFetchError(e?.response?.data?.message || 'Failed to save scale') }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this scale?')) return
    try { await api.delete(`/outcomes/scales/${id}`); fetchScales() }
    catch (e: any) { setFetchError(e?.response?.data?.message || 'Failed to delete') }
  }

  const updateBand = (idx: number, field: string, val: any) => {
    setForm(f => {
      const bands = [...f.bands]; bands[idx] = { ...bands[idx], [field]: val }; return { ...f, bands }
    })
  }

  if (loading) return <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress /></Box>

  return (
    <Box>
      {fetchError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFetchError('')}>{fetchError}</Alert>}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Outcome Scales</Typography>
          <Typography color="#6B7280">Configure standardised assessment scales (WEMWBS, PHQ-9, GAD-7, EQ-5D, Outcome Star).</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ bgcolor: '#0F4C81' }}>New Scale</Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
        <Table>
          <TableHead><TableRow sx={{ bgcolor: '#F8FAFC' }}>
            <TableCell sx={{ fontWeight: 800 }}>Scale</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>Code</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>Range</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>Bands</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>Actions</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {scales.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: '#9CA3AF' }}>No scales configured. Add your first scale.</TableCell></TableRow>
            ) : scales.map(s => (
              <TableRow key={s.id} hover>
                <TableCell>
                  <Stack>
                    <Typography sx={{ fontWeight: 700 }}>{s.name}</Typography>
                    {s.description && <Typography variant="caption" color="#6B7280" noWrap sx={{ maxWidth: 250 }}>{s.description}</Typography>}
                  </Stack>
                </TableCell>
                <TableCell><Chip label={s.shortcode} size="small" sx={{ bgcolor: '#EEF2FF', color: '#3730A3', fontWeight: 700 }} /></TableCell>
                <TableCell>{s.min_score} — {s.max_score}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    {(s.score_bands || []).map((b, i) => (
                      <Tooltip key={i} title={`${b.label} (${b.min}–${b.max})`}>
                        <Chip label={b.label} size="small" sx={{ bgcolor: b.color || '#6B7280', color: '#fff', fontWeight: 700, fontSize: '0.7rem' }} />
                      </Tooltip>
                    ))}
                  </Stack>
                </TableCell>
                <TableCell><Chip label={s.is_active ? 'Active' : 'Inactive'} size="small" sx={{ bgcolor: s.is_active ? '#DCFCE7' : '#F1F5F9', color: s.is_active ? '#16A34A' : '#6B7280', fontWeight: 700, fontSize: '0.7rem' }} /></TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => openEdit(s)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => handleDelete(s.id)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Scale' : 'New Outcome Scale'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Scale Name" fullWidth required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. PHQ-9, GAD-7, WEMWBS" />
            <TextField label="Short Code" fullWidth required value={form.shortcode} onChange={e => setForm(f => ({ ...f, shortcode: e.target.value }))} placeholder="e.g. PHQ9, GAD7" />
            <TextField label="Description" fullWidth multiline rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What this scale measures" />
            <Stack direction="row" spacing={2}>
              <TextField label="Min Score" type="number" fullWidth value={form.min_score} onChange={e => setForm(f => ({ ...f, min_score: parseInt(e.target.value) || 0 }))} />
              <TextField label="Max Score" type="number" fullWidth value={form.max_score} onChange={e => setForm(f => ({ ...f, max_score: parseInt(e.target.value) || 100 }))} />
            </Stack>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Score Bands</Typography>
            {form.bands.map((b, i) => (
              <Stack key={i} direction="row" spacing={1} alignItems="center">
                <TextField label="Min" type="number" size="small" sx={{ width: 70 }} value={b.min} onChange={e => updateBand(i, 'min', parseInt(e.target.value) || 0)} />
                <TextField label="Max" type="number" size="small" sx={{ width: 70 }} value={b.max} onChange={e => updateBand(i, 'max', parseInt(e.target.value) || 0)} />
                <TextField label="Label" size="small" sx={{ flex: 1 }} value={b.label} onChange={e => updateBand(i, 'label', e.target.value)} placeholder="e.g. Minimal, Mild, Moderate" />
                <input type="color" value={b.color || '#6B7280'} onChange={e => updateBand(i, 'color', e.target.value)} style={{ width: 32, height: 32, border: 'none', cursor: 'pointer' }} />
              </Stack>
            ))}
            <Button size="small" onClick={() => setForm(f => ({ ...f, bands: [...f.bands, { min: 0, max: 0, label: '', color: '#6B7280' }] }))}>Add Band</Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name || !form.shortcode}>{saving ? <CircularProgress size={20} /> : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
