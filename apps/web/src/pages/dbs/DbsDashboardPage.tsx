import { useState } from 'react'
import { Box, Typography, Grid, Card, Button, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Stack, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, CircularProgress, Alert, IconButton, Tooltip } from '@mui/material'
import { Verified as DbsIcon, Refresh as PollIcon, Send as SubmitIcon, Add as AddIcon } from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'

const LEVELS = ['standard', 'enhanced', 'enhanced_with_barred']
const WORKFORCE = ['adult', 'child', 'both']

const STATUS_COLORS: Record<string, string> = {
  draft: '#9CA3AF',
  submitted: '#3B82F6',
  in_progress: '#F59E0B',
  awaiting_identity: '#F97316',
  clear: '#16A34A',
  disclosure: '#8B5CF6',
  cancelled: '#6B7280',
  error: '#DC2626',
}

function statusChip(status: string) {
  return <Chip label={status.replace(/_/g, ' ')} size="small" sx={{ bgcolor: `${STATUS_COLORS[status]}20`, color: STATUS_COLORS[status], fontWeight: 700, fontSize: '0.7rem' }} />
}

export default function DbsDashboardPage() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ staffId: '', level: 'enhanced', workforce: 'adult', costPence: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const { data: checks, isLoading } = useQuery({
    queryKey: ['dbs-checks'],
    queryFn: async () => { const res = await api.get('/dbs/checks'); return res.data },
  })

  const { data: stats } = useQuery({
    queryKey: ['dbs-stats'],
    queryFn: async () => { const res = await api.get('/dbs/checks/stats'); return res.data },
  })

  const { data: staffList } = useQuery({
    queryKey: ['org-members'],
    queryFn: async () => { const res = await api.get('/staff/org-members'); return res.data },
  })

  const createMutation = useMutation({
    mutationFn: async (data: any) => api.post('/dbs/checks', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['dbs-checks'] }); queryClient.invalidateQueries({ queryKey: ['dbs-stats'] }); setOpen(false); setForm({ staffId: '', level: 'enhanced', workforce: 'adult', costPence: '' }); setSuccess('DBS check created') },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to create check'),
  })

  const submitMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/dbs/checks/${id}/submit`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['dbs-checks'] }); queryClient.invalidateQueries({ queryKey: ['dbs-stats'] }); setSuccess('DBS check submitted to provider') },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to submit'),
  })

  const pollMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/dbs/checks/${id}/poll`),
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ['dbs-checks'] }); queryClient.invalidateQueries({ queryKey: ['dbs-stats'] }); setSuccess(`Status updated: ${data.data.status}`) },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to poll'),
  })

  const handleCreate = () => {
    if (!form.staffId) { setError('Please select a staff member'); return }
    createMutation.mutate({ staffId: form.staffId, level: form.level, workforce: form.workforce, costPence: form.costPence ? parseInt(form.costPence) : undefined })
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <DbsIcon sx={{ color: '#0F4C81', fontSize: 28 }} />
          <Typography variant="h5" sx={{ fontWeight: 800 }}>DBS Check Management</Typography>
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)} sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' }, textTransform: 'none' }}>
          New DBS Check
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={4} md={2}>
          <Card sx={{ textAlign: 'center', py: 2, bgcolor: '#F8FAFC' }}>
            <Typography variant="h4" fontWeight={800}>{stats?.total || 0}</Typography>
            <Typography variant="caption" color="text.secondary">Total Checks</Typography>
          </Card>
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <Card sx={{ textAlign: 'center', py: 2, bgcolor: '#F0FDF4' }}>
            <Typography variant="h4" fontWeight={800} color="#16A34A">{stats?.clear || 0}</Typography>
            <Typography variant="caption" color="text.secondary">Clear</Typography>
          </Card>
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <Card sx={{ textAlign: 'center', py: 2, bgcolor: '#FEF3C7' }}>
            <Typography variant="h4" fontWeight={800} color="#F59E0B">{stats?.in_progress || 0}</Typography>
            <Typography variant="caption" color="text.secondary">In Progress</Typography>
          </Card>
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <Card sx={{ textAlign: 'center', py: 2, bgcolor: '#FFF7ED' }}>
            <Typography variant="h4" fontWeight={800} color="#F97316">{stats?.awaiting_identity || 0}</Typography>
            <Typography variant="caption" color="text.secondary">Awaiting ID</Typography>
          </Card>
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <Card sx={{ textAlign: 'center', py: 2, bgcolor: '#FEE2E2' }}>
            <Typography variant="h4" fontWeight={800} color="#DC2626">{stats?.expiring_soon || 0}</Typography>
            <Typography variant="caption" color="text.secondary">Expiring Soon</Typography>
          </Card>
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <Card sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h4" fontWeight={800}>£{stats?.cost_total_pounds || 0}</Typography>
            <Typography variant="caption" color="text.secondary">Total Cost</Typography>
          </Card>
        </Grid>
      </Grid>

      <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Staff</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Level</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Workforce</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Reference</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Certificate</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Requested</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></TableCell></TableRow>
            ) : !checks?.length ? (
              <TableRow><TableCell colSpan={8} sx={{ textAlign: 'center', py: 4, color: '#9CA3AF' }}>No DBS checks yet. Click "New DBS Check" to start one.</TableCell></TableRow>
            ) : checks.map((c: any) => (
              <TableRow key={c.id} hover>
                <TableCell sx={{ fontWeight: 600 }}>{c.staff_name}</TableCell>
                <TableCell>{c.level.replace(/_/g, ' ')}</TableCell>
                <TableCell>{c.workforce}</TableCell>
                <TableCell>{statusChip(c.status)}</TableCell>
                <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{c.application_reference || c.provider_reference || '—'}</Typography></TableCell>
                <TableCell>{c.certificate_number || '—'}</TableCell>
                <TableCell><Typography variant="caption">{new Date(c.created_at).toLocaleDateString()}</Typography></TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    {c.status === 'draft' && (
                      <Tooltip title="Submit to DBS provider">
                        <IconButton size="small" color="primary" onClick={() => submitMutation.mutate(c.id)} disabled={submitMutation.isPending}>
                          {submitMutation.isPending ? <CircularProgress size={16} /> : <SubmitIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    )}
                    {['submitted', 'in_progress', 'awaiting_identity'].includes(c.status) && (
                      <Tooltip title="Poll provider for status update">
                        <IconButton size="small" color="default" onClick={() => pollMutation.mutate(c.id)} disabled={pollMutation.isPending}>
                          {pollMutation.isPending ? <CircularProgress size={16} /> : <PollIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New DBS Check</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField select label="Staff Member" value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })} fullWidth required>
              {(staffList || []).filter((s: any) => s.user_id).map((s: any) => (
                <MenuItem key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.email || ''})</MenuItem>
              ))}
            </TextField>
            <TextField select label="DBS Level" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} fullWidth>
              {LEVELS.map(l => <MenuItem key={l} value={l}>{l.replace(/_/g, ' ')}</MenuItem>)}
            </TextField>
            <TextField select label="Workforce" value={form.workforce} onChange={(e) => setForm({ ...form, workforce: e.target.value })} fullWidth>
              {WORKFORCE.map(w => <MenuItem key={w} value={w}>{w.charAt(0).toUpperCase() + w.slice(1)}</MenuItem>)}
            </TextField>
            <TextField label="Cost (pence, optional)" type="number" value={form.costPence} onChange={(e) => setForm({ ...form, costPence: e.target.value })} fullWidth helperText="Leave blank if unknown" />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={createMutation.isPending} sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' }, textTransform: 'none' }}>
            {createMutation.isPending ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Create Check'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
