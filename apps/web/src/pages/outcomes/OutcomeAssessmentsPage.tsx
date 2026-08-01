import { useState, useEffect } from 'react'
import { Box, Typography, Paper, Stack, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Chip, CircularProgress, Alert, Autocomplete, Rating } from '@mui/material'
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import api from '../../services/api'

interface Scale { id: string; name: string; shortcode: string; min_score: number; max_score: number; score_bands: Array<{ min: number; max: number; label: string; color: string }> }
interface ServiceUser { id: string; first_name: string; last_name: string }
interface Assessment { id: string; scale_name: string; scale_code: string; service_user_name: string; total_score: number; band_label?: string; assessed_at: string; assessor_name?: string; notes?: string }

function getBand(score: number, bands: Array<{ min: number; max: number; label: string; color: string }>) {
  const band = bands.find(b => score >= b.min && score <= b.max)
  return band || { label: '-', color: '#6B7280' }
}

export default function OutcomeAssessmentsPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [scales, setScales] = useState<Scale[]>([])
  const [serviceUsers, setServiceUsers] = useState<ServiceUser[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [form, setForm] = useState({ scale_id: '', service_user_id: '', score: 5, notes: '' })

  const fetchData = async () => {
    try {
      const [aRes, sRes, suRes] = await Promise.all([
        api.get('/outcomes/results'),
        api.get('/outcomes/scales'),
        api.get('/service-users?status=active'),
      ])
      setAssessments(aRes.data); setScales(sRes.data); setServiceUsers(suRes.data)
    } catch (e: any) { setFetchError(e?.response?.data?.message || 'Failed to load data') }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const selectedScale = scales.find(s => s.id === form.scale_id)
  const currentBand = selectedScale ? getBand(form.score, selectedScale.score_bands) : null

  const handleSave = async () => {
    if (!form.scale_id || !form.service_user_id) return
    setSaving(true)
    try {
      const band = selectedScale ? getBand(form.score, selectedScale.score_bands) : null
      await api.post('/outcomes/results', {
        scale_id: form.scale_id,
        service_user_id: form.service_user_id,
        score: form.score,
        band_label: band?.label || null,
        notes: form.notes || undefined,
      })
      setDialogOpen(false); fetchData()
    } catch (e: any) { setFetchError(e?.response?.data?.message || 'Failed to record assessment') }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this assessment?')) return
    try { await api.delete(`/outcomes/results/${id}`); fetchData() }
    catch (e: any) { setFetchError(e?.response?.data?.message || 'Failed to delete') }
  }

  if (loading) return <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress /></Box>

  return (
    <Box>
      {fetchError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFetchError('')}>{fetchError}</Alert>}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Outcome Assessments</Typography>
          <Typography color="#6B7280">Record and review standardised scale assessments for people.</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setForm({ scale_id: '', service_user_id: '', score: 5, notes: '' }); setDialogOpen(true) }} sx={{ bgcolor: '#0F4C81' }}>Record Assessment</Button>
      </Stack>

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
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6, color: '#9CA3AF' }}>No assessments recorded yet. Create a scale first, then record an assessment.</TableCell></TableRow>
            ) : assessments.map(a => (
              <TableRow key={a.id} hover>
                <TableCell>
                  <Stack>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>{a.scale_name}</Typography>
                    <Typography variant="caption" color="#6B7280">{a.scale_code}</Typography>
                  </Stack>
                </TableCell>
                <TableCell>{a.service_user_name}</TableCell>
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
              options={serviceUsers}
              getOptionLabel={o => `${o.first_name} ${o.last_name}`}
              value={serviceUsers.find(su => su.id === form.service_user_id) || null}
              onChange={(_, v) => setForm(f => ({ ...f, service_user_id: v?.id || '' }))}
              renderInput={p => <TextField {...p} label="Select Person" fullWidth required />}
            />
            {selectedScale && (
              <Box>
                <Typography variant="body2" color="#6B7280" sx={{ mb: 1 }}>
                  Score: <strong>{form.score}</strong> / {selectedScale.max_score}
                </Typography>
                <Rating
                  value={form.score}
                  max={selectedScale.max_score}
                  onChange={(_, v) => setForm(f => ({ ...f, score: v || selectedScale.min_score }))}
                  sx={{ '& .MuiRating-icon': { fontSize: 28 } }}
                />
                {currentBand && (
                  <Chip label={currentBand.label} size="small" sx={{ mt: 1, bgcolor: currentBand.color, color: '#fff', fontWeight: 700 }} />
                )}
              </Box>
            )}
            {!selectedScale && (
              <Typography variant="body2" color="#9CA3AF" sx={{ fontStyle: 'italic' }}>Select a scale to enter a score</Typography>
            )}
            <TextField label="Notes (optional)" fullWidth multiline rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Clinical observations, context..." />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.scale_id || !form.service_user_id}>
            {saving ? <CircularProgress size={20} /> : 'Record Assessment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
