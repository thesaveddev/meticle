import { useState, useEffect } from 'react'
import { Box, Typography, Paper, Grid, Stack, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Select, MenuItem, FormControl, InputLabel, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, IconButton, LinearProgress, CircularProgress, Autocomplete, Alert, Collapse, Divider, Tooltip, Checkbox, FormControlLabel } from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, ExpandMore as ExpandIcon, Warning as WarningIcon, CheckCircle as CheckIcon } from '@mui/icons-material'
import { useSearchParams } from 'react-router-dom'
import api from '../../services/api'

interface Milestone { id: string; title: string; description?: string; is_completed: boolean; completed_at?: string; sort_order: number }
interface ProgressEntry { id: string; progress: number; note?: string; recorded_at: string; recorded_by_name?: string }

interface Goal {
  id: string; title: string; description?: string; person_name?: string
  person_id: string; target_date?: string; review_date?: string
  status: string; progress: number; cqc_domain?: string
  frequency: string; goal_category?: string
  care_plan_id?: string; care_plan_title?: string
  baseline_value?: number; target_value?: number; value_unit?: string
  provider_clarification?: string; assigned_to?: string; assigned_to_name?: string
  status_reason?: string; is_private?: boolean; started_at?: string
  milestones_count?: number; completed_milestones?: number
  overdue_review?: boolean
}

interface Person { id: string; first_name: string; last_name: string }

const CQC_DOMAINS = ['Safe', 'Effective', 'Caring', 'Responsive', 'Well-led']
const STATUS_OPTIONS = ['active', 'completed', 'cancelled', 'on_hold']
const FREQUENCIES = ['one_time', 'daily', 'weekly', 'monthly', 'quarterly']
const GOAL_CATEGORIES = ['Wellbeing', 'Health', 'Social', 'Education', 'Employment', 'Independence', 'Behavioural', 'Communication', 'Mobility', 'Other']

const CLARIFICATION_OPTIONS = [
  { value: '', label: '— Not specified —' },
  { value: 'person_centred_review', label: 'Person-centred review' },
  { value: 'la_review', label: 'LA review' },
  { value: 'persons_request', label: "Person's request" },
  { value: 'family_request', label: 'Family request' },
  { value: 'safeguarding', label: 'Safeguarding alert/outcome' },
  { value: 'organisational_priority', label: 'Organisational priority' },
  { value: 'other', label: 'Other' },
]

const initialForm = {
  title: '', description: '', person_id: '', target_date: '', review_date: '',
  status: 'active', progress: 0, cqc_domain: '', frequency: 'one_time', goal_category: '',
  care_plan_id: '', baseline_value: '', target_value: '', value_unit: '',
  provider_clarification: '', assigned_to: '', status_reason: '', is_private: false, started_at: '',
}

function freqLabel(f: string) {
  const m: Record<string, string> = { one_time: 'One-Time', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly' }
  return m[f] || f
}

export default function GoalsPage({ personId, personName, carePlans }: { personId?: string; personName?: string; carePlans?: any[] }) {
  const [searchParams] = useSearchParams()
  const preselectedSu = personId || searchParams.get('su') || ''
  const preselectedPersonName = personName || ''
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)
  const [form, setForm] = useState({ ...initialForm, person_id: preselectedSu })
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [saving, setSaving] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [people, setPeople] = useState<Person[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null)
  const [milestones, setMilestones] = useState<Record<string, Milestone[]>>({})
  const [progressHistory, setProgressHistory] = useState<Record<string, ProgressEntry[]>>({})
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false)
  const [milestoneGoalId, setMilestoneGoalId] = useState('')
  const [milestoneTitle, setMilestoneTitle] = useState('')
  const [progressDialogOpen, setProgressDialogOpen] = useState(false)
  const [progressGoalId, setProgressGoalId] = useState('')
  const [progressValue, setProgressValue] = useState(50)
  const [progressNote, setProgressNote] = useState('')
  const [deleteGoalId, setDeleteGoalId] = useState<string | null>(null)
  const carePlanList = carePlans || []

  const fetchGoals = async () => {
    setFetchError('')
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (preselectedSu) params.set('person_id', preselectedSu)
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
    api.get('/people?status=active').then(r => setPeople(r.data)).catch(() => {})
  }, [statusFilter, preselectedSu])

  const openCreate = () => { setEditing(null); setForm({ ...initialForm, person_id: preselectedSu }); setFetchError(''); setDialogOpen(true) }
  const openEdit = (g: Goal) => {
    setEditing(g)
    setForm({
      title: g.title, description: g.description || '', person_id: g.person_id,
      target_date: g.target_date?.slice(0, 10) || '', review_date: g.review_date?.slice(0, 10) || '',
      status: g.status, progress: g.progress, cqc_domain: g.cqc_domain || '',
      frequency: g.frequency || 'one_time', goal_category: g.goal_category || '',
      care_plan_id: g.care_plan_id || '',
      baseline_value: g.baseline_value != null ? String(g.baseline_value) : '',
      target_value: g.target_value != null ? String(g.target_value) : '',
      value_unit: g.value_unit || '',
      provider_clarification: g.provider_clarification || '',
      assigned_to: g.assigned_to || '',
      status_reason: g.status_reason || '',
      is_private: g.is_private || false,
      started_at: g.started_at?.slice(0, 10) || '',
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: any = {
        ...form,
        cqc_domain: form.cqc_domain ? form.cqc_domain.toLowerCase() : null,
        status: form.status?.replace('_', '-'),
        target_date: form.target_date || null,
        review_date: form.review_date || null,
        goal_category: form.goal_category || null,
        care_plan_id: form.care_plan_id || null,
        baseline_value: form.baseline_value ? Number(form.baseline_value) : null,
        target_value: form.target_value ? Number(form.target_value) : null,
        value_unit: form.value_unit || null,
        provider_clarification: form.provider_clarification || null,
        assigned_to: form.assigned_to || null,
        status_reason: form.status_reason || null,
        is_private: form.is_private || false,
        started_at: form.started_at || null,
      }
      if (editing) { await api.patch(`/goals/${editing.id}`, payload) }
      else { await api.post('/goals', payload) }
      setDialogOpen(false); fetchGoals()
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed to save goal'
      const fieldErrors = e?.response?.data?.errors
      setFetchError(fieldErrors ? `${msg}: ${fieldErrors.map((f: any) => `${f.field} ${f.message}`).join(', ')}` : msg)
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    try { await api.delete(`/goals/${id}`); fetchGoals(); setDeleteGoalId(null) }
    catch (e: any) { setFetchError(e?.response?.data?.message || 'Failed to delete goal') }
  }

  const toggleExpand = async (goalId: string) => {
    if (expandedGoalId === goalId) { setExpandedGoalId(null); return }
    setExpandedGoalId(goalId)
    if (!milestones[goalId]) {
      try {
        const [mRes, pRes] = await Promise.all([
          api.get(`/goals/${goalId}/milestones`),
          api.get(`/goals/${goalId}/progress-history`),
        ])
        setMilestones(prev => ({ ...prev, [goalId]: mRes.data }))
        setProgressHistory(prev => ({ ...prev, [goalId]: pRes.data }))
      } catch { /* silently fail */ }
    }
  }

  const handleAddMilestone = async () => {
    if (!milestoneTitle || !milestoneGoalId) return
    try {
      await api.post(`/goals/${milestoneGoalId}/milestones`, { title: milestoneTitle })
      const res = await api.get(`/goals/${milestoneGoalId}/milestones`)
      setMilestones(prev => ({ ...prev, [milestoneGoalId]: res.data }))
      setMilestoneDialogOpen(false); setMilestoneTitle(''); fetchGoals()
    } catch (e: any) { setFetchError(e?.response?.data?.message || 'Failed to add milestone') }
  }

  const handleToggleMilestone = async (goalId: string, milestone: Milestone) => {
    try {
      await api.patch(`/goals/milestones/${milestone.id}`, { is_completed: !milestone.is_completed })
      const res = await api.get(`/goals/${goalId}/milestones`)
      const updatedMilestones = res.data
      setMilestones(prev => ({ ...prev, [goalId]: updatedMilestones }))
      const total = updatedMilestones.length
      const completed = updatedMilestones.filter((m: Milestone) => m.is_completed).length
      const newProgress = total > 0 ? Math.round((completed / total) * 100) : 0
      await api.patch(`/goals/${goalId}`, { progress: newProgress })
      fetchGoals()
    } catch (e: any) { setFetchError(e?.response?.data?.message || 'Failed to update milestone') }
  }

  const handleRecordProgress = async () => {
    if (!progressGoalId) return
    try {
      await api.post(`/goals/${progressGoalId}/progress`, { progress: progressValue, note: progressNote || undefined })
      const [pRes, gRes] = await Promise.all([
        api.get(`/goals/${progressGoalId}/progress-history`),
        api.get(`/goals?${preselectedSu ? 'person_id=' + preselectedSu : ''}`),
      ])
      setProgressHistory(prev => ({ ...prev, [progressGoalId]: pRes.data }))
      setGoals(gRes.data)
      setProgressDialogOpen(false); setProgressNote('')
    } catch (e: any) { setFetchError(e?.response?.data?.message || 'Failed to record progress') }
  }

  const progressColor = (p: number) => p >= 80 ? '#16A34A' : p >= 40 ? '#D97706' : '#DC2626'

  const statusChip = (s: string) => {
    const m: Record<string, { color: string; bg: string }> = {
      active: { color: '#0F4C81', bg: '#E7EEF4' }, completed: { color: '#16A34A', bg: '#DCFCE7' },
      cancelled: { color: '#DC2626', bg: '#FEE2E2' }, on_hold: { color: '#D97706', bg: '#FEF3C7' },
    }
    const c = m[s] || { color: '#6B7280', bg: '#F1F5F9' }
    return <Chip label={s.replace('_', ' ')} size="small" sx={{ bgcolor: c.bg, color: c.color, fontWeight: 700, fontSize: '0.7rem' }} />
  }

  if (loading) return <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress /></Box>

  return (
    <Box>
      {fetchError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFetchError('')}>{fetchError}</Alert>}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ width: 180 }}>
          <InputLabel>Status Filter</InputLabel>
          <Select value={statusFilter} label="Status Filter" onChange={e => setStatusFilter(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            {STATUS_OPTIONS.map(s => <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>)}
          </Select>
        </FormControl>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ bgcolor: '#0F4C81' }}>Add Goal</Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
        <Table>
          <TableHead><TableRow sx={{ bgcolor: '#F8FAFC' }}>
            <TableCell sx={{ fontWeight: 800 }} width={40}></TableCell>
            <TableCell sx={{ fontWeight: 800 }}>Title</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>Frequency</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>Progress</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>CQC Domain</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>Care Plan</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>Target</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>Actions</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {goals.length === 0 ? (
              <TableRow><TableCell colSpan={9} align="center" sx={{ py: 6, color: '#9CA3AF' }}>No goals yet</TableCell></TableRow>
            ) : goals.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((g) => (
              <>
                <TableRow key={g.id} hover sx={{ bgcolor: g.overdue_review ? '#FFF7ED' : undefined }}>
                  <TableCell>
                    <IconButton size="small" onClick={() => toggleExpand(g.id)}>
                      <ExpandIcon fontSize="small" sx={{ transform: expandedGoalId === g.id ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                    </IconButton>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography sx={{ fontWeight: 700 }}>{g.title}</Typography>
                      {g.overdue_review && <Tooltip title="Review overdue"><WarningIcon sx={{ color: '#DC2626', fontSize: 16 }} /></Tooltip>}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip label={freqLabel(g.frequency)} size="small"
                      color={g.frequency === 'daily' ? 'error' : g.frequency === 'weekly' ? 'warning' : g.frequency === 'monthly' ? 'info' : g.frequency === 'quarterly' ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell sx={{ minWidth: 150 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <LinearProgress variant="determinate" value={g.progress} sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: '#F1F5F9', '& .MuiLinearProgress-bar': { bgcolor: progressColor(g.progress) } }} />
                      <Typography variant="caption" sx={{ fontWeight: 800, color: progressColor(g.progress), minWidth: 35 }}>{g.progress}%</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{statusChip(g.status)}</TableCell>
                  <TableCell>{g.cqc_domain ? <Chip label={g.cqc_domain} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} /> : '-'}</TableCell>
                  <TableCell>{g.care_plan_title ? <Chip label={g.care_plan_title} size="small" sx={{ bgcolor: '#EEF2FF', color: '#3730A3', fontSize: '0.7rem' }} /> : '-'}</TableCell>
                  <TableCell>{g.target_date ? new Date(g.target_date).toLocaleDateString() : '-'}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => { setProgressGoalId(g.id); setProgressValue(g.progress); setProgressDialogOpen(true) }}><CheckIcon fontSize="small" sx={{ color: '#0F4C81' }} /></IconButton>
                    <IconButton size="small" onClick={() => openEdit(g)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => setDeleteGoalId(g.id)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
                <TableRow key={`${g.id}-expand`}>
                  <TableCell style={{ padding: 0 }} colSpan={10}>
                    <Collapse in={expandedGoalId === g.id} timeout="auto" unmountOnExit>
                      <Box sx={{ p: 3, bgcolor: '#F8FAFC' }}>
                        <Grid container spacing={3}>
                          <Grid item xs={12} md={6}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Milestones ({milestones[g.id]?.length || 0})</Typography>
                              <Button size="small" startIcon={<AddIcon />} onClick={() => { setMilestoneGoalId(g.id); setFetchError(''); setMilestoneDialogOpen(true) }}>Add</Button>
                            </Stack>
                            {(milestones[g.id] || []).length === 0 ? (
                              <Typography variant="body2" color="#9CA3AF">No milestones yet</Typography>
                            ) : (
                              <Stack spacing={0.5}>
                                {(milestones[g.id] || []).map(m => (
                                  <Stack key={m.id} direction="row" alignItems="center" spacing={1} sx={{ py: 0.5 }}>
                                    <IconButton size="small" onClick={() => handleToggleMilestone(g.id, m)}>
                                      {m.is_completed ? <CheckIcon sx={{ color: '#16A34A', fontSize: 18 }} /> : <Box sx={{ width: 18, height: 18, border: '2px solid #D1D5DB', borderRadius: '50%' }} />}
                                    </IconButton>
                                    <Typography variant="body2" sx={{ textDecoration: m.is_completed ? 'line-through' : 'none', color: m.is_completed ? '#9CA3AF' : '#111827' }}>{m.title}</Typography>
                                  </Stack>
                                ))}
                              </Stack>
                            )}
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Progress History</Typography>
                            {(progressHistory[g.id] || []).length === 0 ? (
                              <Typography variant="body2" color="#9CA3AF">No progress entries yet</Typography>
                            ) : (
                              <Stack spacing={0.5}>
                                {(progressHistory[g.id] || []).slice(0, 10).map(p => (
                                  <Stack key={p.id} direction="row" alignItems="center" spacing={1} sx={{ py: 0.5 }}>
                                    <Chip label={`${p.progress}%`} size="small" sx={{ bgcolor: progressColor(p.progress), color: '#fff', fontWeight: 700, minWidth: 50 }} />
                                    <Typography variant="body2" sx={{ flex: 1 }}>{p.note || '-'}</Typography>
                                    <Typography variant="caption" color="#9CA3AF">{new Date(p.recorded_at).toLocaleDateString()}</Typography>
                                  </Stack>
                                ))}
                              </Stack>
                            )}
                          </Grid>
                          {(g.baseline_value != null || g.target_value != null) && (
                            <Grid item xs={12}>
                              <Divider sx={{ my: 1 }} />
                              <Stack direction="row" spacing={3} sx={{ mt: 1 }}>
                                {g.baseline_value != null && <Typography variant="body2"><strong>Baseline:</strong> {g.baseline_value} {g.value_unit || ''}</Typography>}
                                {g.target_value != null && <Typography variant="body2"><strong>Target:</strong> {g.target_value} {g.value_unit || ''}</Typography>}
                                {g.review_date && <Typography variant="body2"><strong>Review Due:</strong> {new Date(g.review_date).toLocaleDateString()}</Typography>}
                              </Stack>
                            </Grid>
                          )}
                        </Grid>
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </>
            ))}
          </TableBody>
        </Table>
        <TablePagination component="div" count={goals.length} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0) }} rowsPerPageOptions={[5, 10, 25]} />
      </TableContainer>

      {/* Goal Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Goal' : 'New Goal'}</DialogTitle>
        <DialogContent>
          {fetchError && <Alert severity="error" onClose={() => setFetchError('')} sx={{ mb: 2 }}>{fetchError}</Alert>}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Title" fullWidth value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <TextField label="Description" fullWidth multiline rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            {preselectedSu && preselectedPersonName ? (
              <TextField label="Person" fullWidth value={preselectedPersonName} disabled InputProps={{ readOnly: true }} />
            ) : (
              <Autocomplete
                options={people} getOptionLabel={o => `${o.first_name} ${o.last_name}`}
                value={people.find(su => su.id === form.person_id) || null}
                onChange={(_, v) => setForm(f => ({ ...f, person_id: v?.id || '' }))}
                renderInput={p => <TextField {...p} label="Person" fullWidth />}
              />
            )}
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
              <InputLabel>Provider Clarification</InputLabel>
              <Select value={form.provider_clarification || ''} label="Provider Clarification" onChange={e => setForm(f => ({ ...f, provider_clarification: e.target.value }))}>
                {CLARIFICATION_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Started" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.started_at || ''} onChange={e => setForm(f => ({ ...f, started_at: e.target.value }))} />
            {form.status !== 'active' && (
              <TextField label="Status Reason" fullWidth multiline rows={2} placeholder="Why is this outcome being marked as completed, cancelled, or on hold?" value={form.status_reason || ''} onChange={e => setForm(f => ({ ...f, status_reason: e.target.value }))} />
            )}
            {preselectedSu && carePlanList.length > 0 && (
              <FormControl size="small" fullWidth>
                <InputLabel>Linked Care Plan</InputLabel>
                <Select value={form.care_plan_id} label="Linked Care Plan" onChange={e => setForm(f => ({ ...f, care_plan_id: e.target.value }))}>
                  <MenuItem value="">None</MenuItem>
                  {carePlanList.map((cp: any) => <MenuItem key={cp.id} value={cp.id}>{cp.title}</MenuItem>)}
                </Select>
              </FormControl>
            )}
            <FormControl fullWidth>
              <InputLabel>CQC Domain</InputLabel>
              <Select value={form.cqc_domain} label="CQC Domain" onChange={e => setForm(f => ({ ...f, cqc_domain: e.target.value }))}>
                <MenuItem value="">None</MenuItem>
                {CQC_DOMAINS.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
              </Select>
            </FormControl>
            <Divider />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Outcome Tracking (optional)</Typography>
            <Stack direction="row" spacing={2}>
              <TextField label="Baseline Value" type="number" fullWidth value={form.baseline_value} onChange={e => setForm(f => ({ ...f, baseline_value: e.target.value }))} />
              <TextField label="Target Value" type="number" fullWidth value={form.target_value} onChange={e => setForm(f => ({ ...f, target_value: e.target.value }))} />
            </Stack>
            <TextField label="Unit (e.g. score, minutes, %)" fullWidth value={form.value_unit} onChange={e => setForm(f => ({ ...f, value_unit: e.target.value }))} />
            <Divider />
            <Stack direction="row" spacing={2} alignItems="center">
              <FormControlLabel control={<Checkbox checked={form.is_private || false} onChange={e => setForm(f => ({ ...f, is_private: e.target.checked }))} />} label="Private (only visible to assigned staff)" />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.title || !form.person_id}>{saving ? <CircularProgress size={20} /> : 'Save'}</Button>
        </DialogActions>
      </Dialog>

      {/* Milestone Add Dialog */}
      <Dialog open={milestoneDialogOpen} onClose={() => setMilestoneDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Milestone</DialogTitle>
        <DialogContent>
          {fetchError && <Alert severity="error" onClose={() => setFetchError('')} sx={{ mb: 1 }}>{fetchError}</Alert>}
          <TextField label="Milestone Title" fullWidth value={milestoneTitle} onChange={e => setMilestoneTitle(e.target.value)} sx={{ mt: fetchError ? 0 : 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMilestoneDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddMilestone} disabled={!milestoneTitle}>Add</Button>
        </DialogActions>
      </Dialog>

      {/* Progress Record Dialog */}
      <Dialog open={progressDialogOpen} onClose={() => setProgressDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Record Progress</DialogTitle>
        <DialogContent>
          {fetchError && <Alert severity="error" onClose={() => setFetchError('')} sx={{ mb: 1 }}>{fetchError}</Alert>}
          <Stack spacing={2} sx={{ mt: fetchError ? 0 : 1 }}>
            <TextField label="Progress (%)" type="number" fullWidth inputProps={{ min: 0, max: 100 }} value={progressValue} onChange={e => setProgressValue(parseInt(e.target.value) || 0)} />
            <TextField label="Note (optional)" fullWidth multiline rows={2} value={progressNote} onChange={e => setProgressNote(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProgressDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleRecordProgress}>Record</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Goal Confirmation */}
      <Dialog open={!!deleteGoalId} onClose={() => setDeleteGoalId(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Delete Goal</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this goal? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteGoalId(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deleteGoalId && handleDelete(deleteGoalId)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
