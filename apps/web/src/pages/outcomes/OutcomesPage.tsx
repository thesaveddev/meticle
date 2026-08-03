import { useState, useEffect } from 'react'
import { Box, Typography, Paper, Stack, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Chip, CircularProgress, Alert, Tooltip, Tabs, Tab, Autocomplete, Slider } from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material'
import api from '../../services/api'

interface Scale { id: string; name: string; shortcode: string; description?: string; min_score: number; max_score: number; score_bands: Array<{ min: number; max: number; label: string; color: string }>; is_active: boolean; total_assessments?: number }
interface Person { id: string; first_name: string; last_name: string }
interface Assessment { id: string; scale_name: string; scale_code: string; person_name: string; total_score: number; band_label?: string; assessed_at: string; assessor_name?: string; notes?: string }

const defaultBands = [
  { min: 0, max: 33, label: 'Low', color: '#DC2626' },
  { min: 34, max: 66, label: 'Medium', color: '#D97706' },
  { min: 67, max: 100, label: 'High', color: '#16A34A' },
]

function getBand(score: number, bands: Array<{ min: number; max: number; label: string; color: string }>) {
  return bands.find(b => score >= b.min && score <= b.max) || { label: '-', color: '#6B7280' }
}

export default function OutcomesPage() {
  const [tab, setTab] = useState(0)
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>Outcomes</Typography>
      <Typography color="#6B7280" sx={{ mb: 3 }}>Standardised outcome scales, assessments, and person progress tracking.</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, '& .MuiTab-root': { fontWeight: 700, textTransform: 'none' } }}>
        <Tab label="Scales" />
        <Tab label="Assessments" />
      </Tabs>
      {tab === 0 && <ScalesTab />}
      {tab === 1 && <AssessmentsTab />}
    </Box>
  )
}

function ScalesTab() {
  const [scales, setScales] = useState<Scale[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Scale | null>(null)
  const [saving, setSaving] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [form, setForm] = useState({ name: '', shortcode: '', description: '', min_score: 0, max_score: 100, bands: [...defaultBands] })

  const fetchData = async () => {
    try { const r = await api.get('/outcomes/scales'); setScales(r.data) }
    catch (e: any) { setFetchError(e?.response?.data?.message || 'Failed to load scales') }
    setLoading(false)
  }
  useEffect(() => { fetchData() }, [])

  const openCreate = () => { setEditing(null); setForm({ name: '', shortcode: '', description: '', min_score: 0, max_score: 100, bands: [...defaultBands] }); setDialogOpen(true) }
  const openEdit = (s: Scale) => { setEditing(s); setForm({ name: s.name, shortcode: s.shortcode, description: s.description || '', min_score: s.min_score, max_score: s.max_score, bands: s.score_bands.length ? s.score_bands : [...defaultBands] }); setDialogOpen(true) }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { name: form.name, shortcode: form.shortcode, description: form.description || null, min_score: form.min_score, max_score: form.max_score, score_bands: form.bands.filter(b => b.label) }
      if (editing) { await api.patch(`/outcomes/scales/${editing.id}`, payload) }
      else { await api.post('/outcomes/scales', payload) }
      setDialogOpen(false); fetchData()
    } catch (e: any) { setFetchError(e?.response?.data?.message || 'Failed to save scale') }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this scale?')) return
    try { await api.delete(`/outcomes/scales/${id}`); fetchData() }
    catch (e: any) { setFetchError(e?.response?.data?.message || 'Failed to delete') }
  }

  const updateBand = (idx: number, field: string, val: any) => { setForm(f => { const bands = [...f.bands]; bands[idx] = { ...bands[idx], [field]: val }; return { ...f, bands } }) }

  if (loading) return <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress /></Box>

  return (
    <Box>
      {fetchError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFetchError('')}>{fetchError}</Alert>}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{scales.length} Scale{scales.length !== 1 ? 's' : ''}</Typography>
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
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: '#9CA3AF' }}>No scales configured. Standard scales will be auto-created on server restart.</TableCell></TableRow>
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
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
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

function AssessmentsTab() {
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [scales, setScales] = useState<Scale[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [form, setForm] = useState({ scale_id: '', person_id: '', score: 5, notes: '' })

  const fetchData = async () => {
    try {
      const [aRes, sRes, suRes] = await Promise.all([api.get('/outcomes/results'), api.get('/outcomes/scales'), api.get('/people?status=active')])
      setAssessments(aRes.data); setScales(sRes.data); setPeople(suRes.data)
    } catch (e: any) { setFetchError(e?.response?.data?.message || 'Failed to load data') }
    setLoading(false)
  }
  useEffect(() => { fetchData() }, [])

  const selectedScale = scales.find(s => s.id === form.scale_id)
  const currentBand = selectedScale ? getBand(form.score, selectedScale.score_bands) : null

  const handleSave = async () => {
    if (!form.scale_id || !form.person_id) return
    setSaving(true)
    try {
      const band = selectedScale ? getBand(form.score, selectedScale.score_bands) : null
      await api.post('/outcomes/results', { scale_id: form.scale_id, person_id: form.person_id, score: form.score, band_label: band?.label || null, notes: form.notes || undefined })
      setDialogOpen(false); fetchData()
    } catch (e: any) { setFetchError(e?.response?.data?.message || 'Failed to record assessment') }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this assessment?')) return
    try { await api.delete(`/outcomes/results/${id}`); fetchData() }
    catch (e: any) { setFetchError(e?.response?.data?.message || 'Failed to delete') }
  }

  if (loading) return <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress /></Box>

  return (
    <Box>
      {fetchError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFetchError('')}>{fetchError}</Alert>}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{assessments.length} Assessment{assessments.length !== 1 ? 's' : ''}</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setForm({ scale_id: '', person_id: '', score: 5, notes: '' }); setDialogOpen(true) }} sx={{ bgcolor: '#0F4C81' }}>Record Assessment</Button>
      </Stack>

      {scales.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <Typography color="#9CA3AF">No scales available. Create a scale in the Scales tab first.</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
          <Table>
            <TableHead><TableRow sx={{ bgcolor: '#F8FAFC' }}>
              <TableCell sx={{ fontWeight: 800 }}>Scale</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Person</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Score</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Band</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Assessor</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Actions</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {assessments.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6, color: '#9CA3AF' }}>No assessments recorded yet.</TableCell></TableRow>
              ) : assessments.map(a => (
                <TableRow key={a.id} hover>
                  <TableCell>
                    <Stack>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>{a.scale_name}</Typography>
                      <Typography variant="caption" color="#6B7280">{a.scale_code}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{a.person_name}</TableCell>
                  <TableCell><Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>{a.total_score}</Typography></TableCell>
                  <TableCell>
                    {a.band_label ? <Chip label={a.band_label} size="small" sx={{ bgcolor: '#EEF2FF', color: '#3730A3', fontWeight: 700, fontSize: '0.7rem' }} /> : '-'}
                  </TableCell>
                  <TableCell>{new Date(a.assessed_at).toLocaleDateString()}</TableCell>
                  <TableCell>{a.assessor_name || '-'}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => handleDelete(a.id)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Record Assessment</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <Autocomplete
              options={scales}
              getOptionLabel={o => `${o.name} (${o.shortcode}) — ${o.min_score} to ${o.max_score}`}
              value={scales.find(s => s.id === form.scale_id) || null}
              onChange={(_, v) => setForm(f => ({ ...f, scale_id: v?.id || '', score: v ? Math.round((v.min_score + v.max_score) / 2) : 5 }))}
              renderInput={p => <TextField {...p} label="Select Scale" fullWidth required />}
            />
            <Autocomplete
              options={people}
              getOptionLabel={o => `${o.first_name} ${o.last_name}`}
              value={people.find(su => su.id === form.person_id) || null}
              onChange={(_, v) => setForm(f => ({ ...f, person_id: v?.id || '' }))}
              renderInput={p => <TextField {...p} label="Select Person" fullWidth required />}
            />
            {selectedScale ? (
              <Box>
                <Typography variant="body2" color="#6B7280" sx={{ mb: 0.5 }}>
                  Score: <strong>{form.score}</strong> / {selectedScale.max_score}
                </Typography>
                <Slider
                  value={form.score}
                  min={selectedScale.min_score}
                  max={selectedScale.max_score}
                  step={1}
                  onChange={(_, v) => setForm(f => ({ ...f, score: v as number }))}
                  valueLabelDisplay="auto"
                  sx={{ color: currentBand?.color || '#0F4C81' }}
                />
                {currentBand && <Chip label={currentBand.label} size="small" sx={{ mt: 1, bgcolor: currentBand.color, color: '#fff', fontWeight: 700 }} />}
              </Box>
            ) : (
              <Typography variant="body2" color="#9CA3AF" sx={{ fontStyle: 'italic' }}>Select a scale to enter a score</Typography>
            )}
            <TextField label="Notes (optional)" fullWidth multiline rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Clinical observations, context..." />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.scale_id || !form.person_id}>{saving ? <CircularProgress size={20} /> : 'Record Assessment'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
