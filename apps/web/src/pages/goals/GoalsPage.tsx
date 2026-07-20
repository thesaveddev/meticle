import { useState, useEffect } from 'react'
import { Box, Typography, Paper, Grid, Stack, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Select, MenuItem, FormControl, InputLabel, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, IconButton, LinearProgress, CircularProgress, Autocomplete, Alert } from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { useSearchParams } from 'react-router-dom'
import api from '../../services/api'

interface Goal {
  id: string; title: string; description?: string; service_user_name?: string
  service_user_id: string; target_date?: string; review_date?: string
  status: string; progress: number; cqc_domain?: string
  frequency: string; goal_category?: string
}

interface ServiceUser { id: string; first_name: string; last_name: string }

const CQC_DOMAINS = ['Safe', 'Effective', 'Caring', 'Responsive', 'Well-led']
const STATUS_OPTIONS = ['active', 'completed', 'cancelled', 'on_hold']
const FREQUENCIES = ['one_time', 'daily', 'weekly', 'monthly', 'quarterly']
const GOAL_CATEGORIES = ['Wellbeing', 'Health', 'Social', 'Education', 'Employment', 'Independence', 'Behavioural', 'Communication', 'Mobility', 'Other']

const initialForm = { title: '', description: '', service_user_id: '', target_date: '', review_date: '', status: 'active', progress: 0, cqc_domain: '', frequency: 'one_time', goal_category: '' }

function freqLabel(f: string) {
  const m: Record<string, string> = { one_time: 'One-Time', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly' }
  return m[f] || f
}

export default function GoalsPage() {
  const [searchParams] = useSearchParams()
  const preselectedSu = searchParams.get('su') || ''
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)
  const [form, setForm] = useState({ ...initialForm, service_user_id: preselectedSu })
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [saving, setSaving] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [serviceUsers, setServiceUsers] = useState<ServiceUser[]>([])
  const [statusFilter, setStatusFilter] = useState('')

  const fetchGoals = async () => {
    setFetchError('')
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (preselectedSu) params.set('service_user_id', preselectedSu)
      const res = await api.get(`/goals?${params}`)
      setGoals(res.data)
    } catch (e: any) {
      setGoals([])
      setFetchError(e?.response?.data?.message || 'Failed to load goals')
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchGoals()
    api.get('/service-users?status=active').then(r => setServiceUsers(r.data)).catch(() => {})
  }, [statusFilter, preselectedSu])

  const openCreate = () => { setEditing(null); setForm({ ...initialForm }); setDialogOpen(true) }
  const openEdit = (g: Goal) => {
    setEditing(g)
    setForm({
      title: g.title, description: g.description || '', service_user_id: g.service_user_id,
      target_date: g.target_date?.slice(0, 10) || '', review_date: g.review_date?.slice(0, 10) || '',
      status: g.status, progress: g.progress, cqc_domain: g.cqc_domain || '',
      frequency: g.frequency || 'one_time', goal_category: g.goal_category || ''
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { ...form, cqc_domain: form.cqc_domain || null, target_date: form.target_date || null, review_date: form.review_date || null, goal_category: form.goal_category || null }
      if (editing) { await api.patch(`/goals/${editing.id}`, payload) }
      else { await api.post('/goals', payload) }
      setDialogOpen(false); fetchGoals()
    } catch (e: any) {
      setFetchError(e?.response?.data?.message || 'Failed to save goal')
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this goal?')) return
    try {
      await api.delete(`/goals/${id}`)
      fetchGoals()
    } catch (e: any) {
      setFetchError(e?.response?.data?.message || 'Failed to delete goal')
    }
  }

  const progressColor = (p: number) => p >= 80 ? '#16A34A' : p >= 40 ? '#D97706' : '#DC2626'

  const statusChip = (s: string) => {
    const m: Record<string, { color: string; bg: string }> = { active: { color: '#0F4C81', bg: '#E7EEF4' }, completed: { color: '#16A34A', bg: '#DCFCE7' }, cancelled: { color: '#DC2626', bg: '#FEE2E2' }, on_hold: { color: '#D97706', bg: '#FEF3C7' } }
    const c = m[s] || { color: '#6B7280', bg: '#F1F5F9' }
    return <Chip label={s.replace('_', ' ')} size="small" sx={{ bgcolor: c.bg, color: c.color, fontWeight: 700, fontSize: '0.7rem' }} />
  }

  if (loading) return <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress /></Box>

  const activeGoals = goals.filter(g => g.status === 'active')
  const completedGoals = goals.filter(g => g.status === 'completed')

  return (
    <Box>
      {fetchError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFetchError('')}>{fetchError}</Alert>}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Service User Goals</Typography>
          <Typography color="#6B7280">{preselectedSu ? 'Filtered by service user' : 'Track goals and progress per service user.'}</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ bgcolor: '#0F4C81' }}>Add Goal</Button>
      </Stack>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          { label: 'Total Goals', value: goals.length, color: '#0F4C81' },
          { label: 'Active', value: activeGoals.length, color: '#D97706' },
          { label: 'Completed', value: completedGoals.length, color: '#16A34A' },
          { label: 'Avg Progress', value: goals.length > 0 ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / goals.length) + '%' : '0%', color: '#7C3AED' },
        ].map((s, i) => (
          <Grid item xs={6} md={3} key={i}>
            <Paper elevation={0} sx={{ p: 3, border: '1px solid #E5E7EB', borderRadius: 3 }}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: s.color }}>{s.value}</Typography>
              <Typography variant="caption" sx={{ color: '#6B7280', fontWeight: 600 }}>{s.label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <FormControl size="small" sx={{ mb: 3, width: 200 }}>
        <InputLabel>Status Filter</InputLabel>
        <Select value={statusFilter} label="Status Filter" onChange={e => setStatusFilter(e.target.value)}>
          <MenuItem value="">All</MenuItem>
          {STATUS_OPTIONS.map(s => <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>)}
        </Select>
      </FormControl>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
        <Table>
          <TableHead><TableRow sx={{ bgcolor: '#F8FAFC' }}>
            <TableCell sx={{ fontWeight: 800 }}>Title</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>Service User</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>Frequency</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>Category</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>Progress</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>CQC Domain</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>Target Date</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>Actions</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {goals.length === 0 ? (
              <TableRow><TableCell colSpan={9} align="center" sx={{ py: 6, color: '#9CA3AF' }}>No goals yet. Create your first goal.</TableCell></TableRow>
            ) : goals.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((g) => (
              <TableRow key={g.id} hover>
                <TableCell sx={{ fontWeight: 700 }}>{g.title}</TableCell>
                <TableCell>{g.service_user_name || '-'}</TableCell>
                <TableCell>
                  <Chip label={freqLabel(g.frequency)} size="small"
                    color={g.frequency === 'daily' ? 'error' : g.frequency === 'weekly' ? 'warning' : g.frequency === 'monthly' ? 'info' : g.frequency === 'quarterly' ? 'success' : 'default'} />
                </TableCell>
                <TableCell>{g.goal_category ? <Chip label={g.goal_category} size="small" variant="outlined" /> : '-'}</TableCell>
                <TableCell sx={{ minWidth: 150 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <LinearProgress variant="determinate" value={g.progress} sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: '#F1F5F9', '& .MuiLinearProgress-bar': { bgcolor: progressColor(g.progress) } }} />
                    <Typography variant="caption" sx={{ fontWeight: 800, color: progressColor(g.progress), minWidth: 35 }}>{g.progress}%</Typography>
                  </Stack>
                </TableCell>
                <TableCell>{statusChip(g.status)}</TableCell>
                <TableCell>{g.cqc_domain ? <Chip label={g.cqc_domain} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} /> : '-'}</TableCell>
                <TableCell>{g.target_date ? new Date(g.target_date).toLocaleDateString() : '-'}</TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => openEdit(g)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => handleDelete(g.id)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination component="div" count={goals.length} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0) }} rowsPerPageOptions={[5, 10, 25]} />
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Goal' : 'New Goal'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Title" fullWidth value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <TextField label="Description" fullWidth multiline rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <Autocomplete
              options={serviceUsers} getOptionLabel={o => `${o.first_name} ${o.last_name}`}
              value={serviceUsers.find(su => su.id === form.service_user_id) || null}
              onChange={(_, v) => setForm(f => ({ ...f, service_user_id: v?.id || '' }))}
              renderInput={p => <TextField {...p} label="Service User" fullWidth />}
            />
            <Stack direction="row" spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Frequency</InputLabel>
                <Select value={form.frequency} label="Frequency" onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                  {FREQUENCIES.map(f => <MenuItem key={f} value={f}>{freqLabel(f)}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select value={form.goal_category} label="Category" onChange={e => setForm(f => ({ ...f, goal_category: e.target.value }))}>
                  <MenuItem value="">None</MenuItem>
                  {GOAL_CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField label="Target Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.target_date} onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))} />
              <TextField label="Review Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.review_date} onChange={e => setForm(f => ({ ...f, review_date: e.target.value }))} />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField label="Progress (%)" type="number" fullWidth inputProps={{ min: 0, max: 100 }} value={form.progress} onChange={e => setForm(f => ({ ...f, progress: parseInt(e.target.value) || 0 }))} />
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select value={form.status} label="Status" onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {STATUS_OPTIONS.map(s => <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>
            <FormControl fullWidth>
              <InputLabel>CQC Domain</InputLabel>
              <Select value={form.cqc_domain} label="CQC Domain" onChange={e => setForm(f => ({ ...f, cqc_domain: e.target.value }))}>
                <MenuItem value="">None</MenuItem>
                {CQC_DOMAINS.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.title || !form.service_user_id}>{saving ? <CircularProgress size={20} /> : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
