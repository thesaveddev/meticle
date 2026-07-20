import { useState } from 'react'
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Stack, TablePagination, CircularProgress, Alert, IconButton } from '@mui/material'
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../services/api'

const ASSESSMENT_TYPES = ['Initial', 'Annual Review', 'MCA', 'DoLS', 'Best Interest', 'Capacity', 'Other']
const STATUS_COLORS: Record<string, string> = { draft: '#D97706', completed: '#16A34A', reviewed: '#0F4C81' }

export default function CareAssessmentsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const suFilter = searchParams.get('su')
  const queryClient = useQueryClient()
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage] = useState(10)
  const [open, setOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [editAssessment, setEditAssessment] = useState<any>(null)
  const [form, setForm] = useState({ assessment_type: '', assessment_date: new Date().toISOString().split('T')[0], assessor_name: '', findings: '', recommendations: '', status: 'draft', next_review_date: '' })
  const [error, setError] = useState('')

  const { data: assessments, isLoading } = useQuery({
    queryKey: ['care-assessments', suFilter],
    queryFn: async () => {
      if (suFilter) {
        const res = await api.get(`/service-users/${suFilter}/assessments`)
        return res.data
      }
      return []
    },
    enabled: !!suFilter,
  })

  const { data: serviceUsers } = useQuery({
    queryKey: ['service-users-list'],
    queryFn: () => api.get('/service-users').then(r => r.data),
  })

  const filtered = (assessments || []).filter((a: any) =>
    !typeFilter || a.assessment_type === typeFilter
  )

  const total = filtered.length
  const completed = filtered.filter((a: any) => a.status === 'completed').length
  const reviewed = filtered.filter((a: any) => a.status === 'reviewed').length

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form }
      if (editAssessment) return api.patch(`/service-users/assessments/${editAssessment.id}`, payload)
      return api.post(`/service-users/${suFilter}/assessments`, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['care-assessments', suFilter] })
      setOpen(false)
      setEditAssessment(null)
      setForm({ assessment_type: '', assessment_date: new Date().toISOString().split('T')[0], assessor_name: '', findings: '', recommendations: '', status: 'draft', next_review_date: '' })
      setError('')
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || err.message || 'Failed to save assessment')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/service-users/assessments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['care-assessments', suFilter] }),
  })

  const openEdit = (a: any) => {
    setEditAssessment(a)
    setForm({
      assessment_type: a.assessment_type,
      assessment_date: a.assessment_date?.split('T')[0] || '',
      assessor_name: a.assessor_name || '',
      findings: a.findings || '',
      recommendations: a.recommendations || '',
      status: a.status || 'draft',
      next_review_date: a.next_review_date?.split('T')[0] || '',
    })
    setOpen(true)
  }

  if (!suFilter) {
    return (
      <Box>
        <Typography variant="h4" sx={{ mb: 4 }}>Care Assessments</Typography>
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <Typography color="#6B7280" sx={{ mb: 2 }}>Select a service user to view their assessments</Typography>
          <Stack spacing={2} sx={{ maxWidth: 400, mx: 'auto' }}>
            {(serviceUsers || []).slice(0, 20).map((su: any) => (
              <Button key={su.id} variant="outlined" fullWidth onClick={() => navigate(`/care-assessments?su=${su.id}`)}
                sx={{ textTransform: 'none', justifyContent: 'flex-start', color: '#0F4C81', borderColor: '#E5E7EB', '&:hover': { borderColor: '#0F4C81' } }}>
                {su.first_name} {su.last_name} {su.room_number ? `— Room ${su.room_number}` : ''}
              </Button>
            ))}
          </Stack>
        </Paper>
      </Box>
    )
  }

  const selectedSu = (serviceUsers || []).find((su: any) => su.id === suFilter)

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/care-assessments')} sx={{ mb: 2, color: '#0F4C81', fontWeight: 600 }}>
        Back to Service Users
      </Button>

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4">Care Assessments</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditAssessment(null); setForm({ assessment_type: '', assessment_date: new Date().toISOString().split('T')[0], assessor_name: '', findings: '', recommendations: '', status: 'draft', next_review_date: '' }); setOpen(true) }}
          sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
          New Assessment
        </Button>
      </Stack>

      {selectedSu && (
        <Typography variant="subtitle1" sx={{ mb: 2, color: '#6B7280' }}>
          Resident: <strong>{selectedSu.first_name} {selectedSu.last_name}</strong>
        </Typography>
      )}

      {/* Summary Cards */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Paper sx={{ p: 2, flex: 1, borderRadius: 2, border: '1px solid #E5E7EB', textAlign: 'center' }}>
          <Typography variant="h5" fontWeight={800}>{total}</Typography>
          <Typography variant="body2" color="#6B7280">Total Assessments</Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: 1, borderRadius: 2, border: '1px solid #E5E7EB', textAlign: 'center' }}>
          <Typography variant="h5" fontWeight={800} color="#16A34A">{completed}</Typography>
          <Typography variant="body2" color="#6B7280">Completed</Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: 1, borderRadius: 2, border: '1px solid #E5E7EB', textAlign: 'center' }}>
          <Typography variant="h5" fontWeight={800} color="#0F4C81">{reviewed}</Typography>
          <Typography variant="body2" color="#6B7280">Pending Review</Typography>
        </Paper>
      </Stack>

      {/* Filter */}
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
        <TextField select label="Filter by Type" size="small" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(0) }} sx={{ width: 220 }}>
          <MenuItem value="">All Types</MenuItem>
          {ASSESSMENT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </TextField>
      </Stack>

      {/* Table */}
      <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #E5E7EB' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Assessor</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Next Review</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6}><Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6}><Typography sx={{ textAlign: 'center', py: 4, color: '#9CA3AF' }}>No assessments found</Typography></TableCell></TableRow>
            ) : filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((a: any) => (
              <TableRow key={a.id} hover sx={{ cursor: 'pointer' }} onClick={() => { setSelected(a); setViewOpen(true) }}>
                <TableCell sx={{ fontWeight: 600 }}>{a.assessment_type}</TableCell>
                <TableCell>{new Date(a.assessment_date).toLocaleDateString('en-GB')}</TableCell>
                <TableCell>{a.assessor_name || '—'}</TableCell>
                <TableCell>
                  <Chip label={a.status} size="small"
                    sx={{ bgcolor: `${STATUS_COLORS[a.status] || '#6B7280'}20`, color: STATUS_COLORS[a.status] || '#6B7280', fontWeight: 700, textTransform: 'capitalize' }} />
                </TableCell>
                <TableCell>{a.next_review_date ? new Date(a.next_review_date).toLocaleDateString('en-GB') : '—'}</TableCell>
                <TableCell align="right" onClick={e => e.stopPropagation()}>
                  <IconButton size="small" onClick={() => openEdit(a)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => { if (confirm('Delete this assessment?')) deleteMutation.mutate(a.id) }}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination component="div" count={filtered.length} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} rowsPerPageOptions={[10]} />
      </TableContainer>

      {/* View Dialog */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>{selected?.assessment_type}</DialogTitle>
        <DialogContent>
          {selected && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={4}>
                <Box><Typography variant="caption" color="#6B7280">Date</Typography><Typography fontWeight={600}>{new Date(selected.assessment_date).toLocaleDateString('en-GB')}</Typography></Box>
                <Box><Typography variant="caption" color="#6B7280">Assessor</Typography><Typography fontWeight={600}>{selected.assessor_name || '—'}</Typography></Box>
                <Box><Typography variant="caption" color="#6B7280">Status</Typography><Chip label={selected.status} size="small" sx={{ bgcolor: `${STATUS_COLORS[selected.status] || '#6B7280'}20`, color: STATUS_COLORS[selected.status] || '#6B7280', fontWeight: 700 }} /></Box>
                <Box><Typography variant="caption" color="#6B7280">Next Review</Typography><Typography fontWeight={600}>{selected.next_review_date ? new Date(selected.next_review_date).toLocaleDateString('en-GB') : '—'}</Typography></Box>
              </Stack>
              <Box><Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>Findings</Typography><Paper variant="outlined" sx={{ p: 2, bgcolor: '#F9FAFB', whiteSpace: 'pre-wrap' }}>{selected.findings || 'No findings recorded'}</Paper></Box>
              <Box><Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>Recommendations</Typography><Paper variant="outlined" sx={{ p: 2, bgcolor: '#F9FAFB', whiteSpace: 'pre-wrap' }}>{selected.recommendations || 'No recommendations recorded'}</Paper></Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setViewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={open} onClose={() => { setOpen(false); setError('') }} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); saveMutation.mutate() }}>
          <DialogTitle sx={{ fontWeight: 800 }}>{editAssessment ? 'Edit Assessment' : 'New Assessment'}</DialogTitle>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField select label="Assessment Type" required fullWidth value={form.assessment_type} onChange={e => setForm(p => ({ ...p, assessment_type: e.target.value }))}>
                {ASSESSMENT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
              <TextField label="Assessment Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.assessment_date} onChange={e => setForm(p => ({ ...p, assessment_date: e.target.value }))} />
              <TextField label="Assessor Name" fullWidth value={form.assessor_name} onChange={e => setForm(p => ({ ...p, assessor_name: e.target.value }))} />
              <TextField label="Findings" multiline rows={4} fullWidth value={form.findings} onChange={e => setForm(p => ({ ...p, findings: e.target.value }))} />
              <TextField label="Recommendations" multiline rows={4} fullWidth value={form.recommendations} onChange={e => setForm(p => ({ ...p, recommendations: e.target.value }))} />
              <TextField select label="Status" fullWidth value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="reviewed">Reviewed</MenuItem>
              </TextField>
              <TextField label="Next Review Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.next_review_date} onChange={e => setForm(p => ({ ...p, next_review_date: e.target.value }))} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => { setOpen(false); setError('') }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={!form.assessment_type.trim() || saveMutation.isPending} sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
              {saveMutation.isPending ? <CircularProgress size={20} /> : editAssessment ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  )
}
