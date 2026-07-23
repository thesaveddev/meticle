import { useState } from 'react'
import { Box, Typography, Tabs, Tab, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Stack, TablePagination, Tooltip, IconButton, CircularProgress, Alert, Card, CardContent, Grid } from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, ArrowBack as ArrowBackIcon, TrendingUp as TrendingUpIcon, AutoFixHigh as AutoAssignIcon } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import EmptyState from '../../components/EmptyState'
import { BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'

const CATEGORIES = ['Mandatory', 'Clinical', 'Safeguarding', 'Health & Safety', 'Fire Safety', 'Infection Control', 'Manual Handling', 'Food Hygiene', 'Medication', 'First Aid', 'Dementia', 'Autism', 'Mental Health', 'Other']

export default function TrainingMatrixPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState(0)
  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/compliance')} sx={{ mb: 2, color: '#0F4C81', fontWeight: 600 }}>
        Back to Compliance Dashboard
      </Button>
      <Typography variant="h4" sx={{ mb: 4 }}>Training Compliance Matrix</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Dashboard" icon={<TrendingUpIcon />} iconPosition="start" />
        <Tab label="Compliance Grid" />
        <Tab label="Modules" />
        <Tab label="Expiring Soon" />
      </Tabs>
      {tab === 0 && <DashboardView />}
      {tab === 1 && <GridView />}
      {tab === 2 && <ModulesView />}
      {tab === 3 && <ExpiringView />}
    </Box>
  )
}

function GridView() {
  const queryClient = useQueryClient()
  const [gridPage, setGridPage] = useState(0)
  const [gridRowsPerPage] = useState(10)

  const { data, isLoading } = useQuery({
    queryKey: ['training-matrix'],
    queryFn: async () => {
      const res = await api.get('/training/matrix')
      return res.data
    }
  })

  const getRecord = (staffId: string, moduleId: string) =>
    data?.records?.find((r: any) => r.staff_id === staffId && r.module_id === moduleId)

  const completeMutation = useMutation({
    mutationFn: async ({ module_id, staff_id }: { module_id: string; staff_id: string }) =>
      api.post('/training/records', { module_id, staff_id, status: 'completed', completed_at: new Date().toISOString().split('T')[0] }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['training-matrix'] })
  })

  const statusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success'
      case 'expired': return 'error'
      default: return 'warning'
    }
  }

  if (isLoading) return <Typography>Loading...</Typography>

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {data?.staff?.length || 0} staff × {data?.modules?.length || 0} training modules
        </Typography>
      </Stack>
      <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 2 }}>Staff</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Profile</TableCell>
              {data?.modules?.map((m: any) => (
                <TableCell key={m.id} sx={{ fontWeight: 700, minWidth: 100, writingMode: 'vertical-lr', textAlign: 'center', p: 1 }}>
                  <Tooltip title={`${m.name}${m.cqc_mandated ? ' (CQC Mandated)' : ''}`}>
                    <span>{m.cqc_mandated ? '⚑ ' : ''}{m.name}</span>
                  </Tooltip>
                </TableCell>
              ))}
              <TableCell sx={{ fontWeight: 700 }}>%</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!data?.staff?.length ? (
              <TableRow><TableCell colSpan={data?.modules?.length ? data.modules.length + 2 : 3}><EmptyState message="No staff data" description="Assign staff profiles to view the compliance grid." /></TableCell></TableRow>
            ) : data?.staff?.slice(gridPage * gridRowsPerPage, gridPage * gridRowsPerPage + gridRowsPerPage).map((s: any) => {
              const total = data.modules.length
              const done = data.modules.filter((m: any) => {
                const r = getRecord(s.id, m.id)
                return r?.status === 'completed'
              }).length
              return (
                <TableRow key={s.id} hover>
                  <TableCell sx={{ fontWeight: 600, position: 'sticky', left: 0, bgcolor: 'background.paper' }}>
                    {s.first_name} {s.last_name}
                  </TableCell>
                  <TableCell>
                    <Chip label={s.profile_name || 'None'} size="small" variant="outlined" />
                  </TableCell>
                  {data?.modules?.map((m: any) => {
                    const r = getRecord(s.id, m.id)
                    return (
                      <TableCell key={m.id} sx={{ textAlign: 'center', p: 0.5 }}>
                        <Tooltip title={r ? `${r.status}${r.expires_at ? ` - Expires: ${r.expires_at}` : ''}` : 'Not assigned'}>
                          <Chip
                            size="small"
                            label={r?.status === 'completed' ? '✓' : r?.status === 'expired' ? '!' : '—'}
                            color={r ? statusColor(r.status) as any : 'default'}
                            variant={r ? 'filled' : 'outlined'}
                            sx={{ minWidth: 28, cursor: 'pointer' }}
                            onClick={() => {
                              if (r?.status !== 'completed') {
                                completeMutation.mutate({ module_id: m.id, staff_id: s.id })
                              }
                            }}
                          />
                        </Tooltip>
                      </TableCell>
                    )
                  })}
                  <TableCell>
                    <Chip label={`${total > 0 ? Math.round(done / total * 100) : 0}%`} size="small" color={done === total ? 'success' : 'warning'} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination component="div" count={data?.staff?.length || 0} page={gridPage} onPageChange={(_, p) => setGridPage(p)} rowsPerPage={gridRowsPerPage} rowsPerPageOptions={[10]} sx={{ bgcolor: 'background.paper' }} />
    </Box>
  )
}

function ModulesView() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editModule, setEditModule] = useState<any>(null)
  const [form, setForm] = useState({ name: '', category: '', description: '', frequency_days: '', is_mandatory: true, requires_competency: false, cqc_mandated: false, cqc_mandated_for_roles: [] as string[] })
  const ROLE_OPTIONS = ['CARE_WORKER', 'MANAGER', 'COMPLIANCE_OFFICER', 'NURSE', 'SUPPORT_WORKER']
  const [page, setPage] = useState(0)
  const [rowsPerPage] = useState(10)

  const { data: modules, isLoading } = useQuery({
    queryKey: ['training-modules'],
    queryFn: async () => {
      const res = await api.get('/training/modules')
      return res.data
    }
  })

  const autoAssignMutation = useMutation({
    mutationFn: () => api.post('/training/auto-assign'),
    onSuccess: (res) => {
      alert(res.data.message)
      queryClient.invalidateQueries({ queryKey: ['training-records'] })
      queryClient.invalidateQueries({ queryKey: ['training-matrix'] })
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, frequency_days: form.frequency_days ? parseInt(form.frequency_days) : undefined }
      if (editModule) {
        return api.put(`/training/modules/${editModule.id}`, payload)
      }
      return api.post('/training/modules', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-modules'] })
      setOpen(false)
      setEditModule(null)
      setForm({ name: '', category: '', description: '', frequency_days: '', is_mandatory: true, requires_competency: false, cqc_mandated: false, cqc_mandated_for_roles: [] })
    }
  })

  const [deleteError, setDeleteError] = useState('')

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/training/modules/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['training-modules'] }),
    onError: (err: any) => {
      setDeleteError(err.response?.data?.message || err.message || 'Failed to delete module')
    }
  })

  const openEdit = (m: any) => {
    setEditModule(m)
    setForm({ name: m.name, category: m.category || '', description: m.description || '', frequency_days: m.frequency_days?.toString() || '', is_mandatory: m.is_mandatory, requires_competency: m.requires_competency, cqc_mandated: m.cqc_mandated, cqc_mandated_for_roles: m.cqc_mandated_for_roles || [] })
    setOpen(true)
  }

  return (
    <Box>
      {deleteError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDeleteError('')}>{deleteError}</Alert>}
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 3 }}>
        <Typography variant="h6">Training Modules ({modules?.length || 0})</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<AutoAssignIcon />} onClick={() => autoAssignMutation.mutate()}
            disabled={autoAssignMutation.isPending} sx={{ textTransform: 'none' }}>
            {autoAssignMutation.isPending ? 'Assigning...' : 'Auto-Assign by Role'}
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditModule(null); setForm({ name: '', category: '', description: '', frequency_days: '', is_mandatory: true, requires_competency: false, cqc_mandated: false, cqc_mandated_for_roles: [] }); setOpen(true) }}>
            Add Module
          </Button>
        </Stack>
      </Stack>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Frequency</TableCell>
              <TableCell>Mandatory</TableCell>
              <TableCell>Competency</TableCell>
              <TableCell>Completed/Total</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7}>Loading...</TableCell></TableRow>
            ) : !modules?.length ? (
              <TableRow><TableCell colSpan={7}><EmptyState message="No training modules" description="Create your first training module to get started." /></TableCell></TableRow>
            ) : modules?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((m: any) => (
              <TableRow key={m.id} hover>
                <TableCell sx={{ fontWeight: 600 }}>{m.name}</TableCell>
                <TableCell><Chip label={m.category || '—'} size="small" variant="outlined" /></TableCell>
                <TableCell>{m.frequency_days ? `Every ${m.frequency_days} days` : '—'}</TableCell>
                <TableCell>{m.is_mandatory ? <Chip label="Yes" size="small" color="primary" /> : 'No'}</TableCell>
                <TableCell>{m.requires_competency ? <Chip label="Yes" size="small" color="secondary" /> : 'No'}</TableCell>
                <TableCell>{m.completed_count || 0}/{m.total_count || 0}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openEdit(m)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => { if (confirm('Delete this module?')) deleteMutation.mutate(m.id) }}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={modules?.length || 0}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[10]}
        />
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editModule ? 'Edit Module' : 'Add Training Module'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Module Name" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            <TextField label="Category" select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
              <MenuItem value="">None</MenuItem>
              {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
            <TextField label="Description" multiline rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            <TextField label="Renewal Frequency (days)" type="number" value={form.frequency_days} onChange={e => setForm(p => ({ ...p, frequency_days: e.target.value }))} helperText="How often this training needs renewal (e.g., 365 for annual)" />
            <TextField label="Mandatory" select value={form.is_mandatory ? 'yes' : 'no'} onChange={e => setForm(p => ({ ...p, is_mandatory: e.target.value === 'yes' }))}>
              <MenuItem value="yes">Yes</MenuItem>
              <MenuItem value="no">No</MenuItem>
            </TextField>
            <TextField label="Requires Competency Assessment" select value={form.requires_competency ? 'yes' : 'no'} onChange={e => setForm(p => ({ ...p, requires_competency: e.target.value === 'yes' }))}>
              <MenuItem value="yes">Yes</MenuItem>
              <MenuItem value="no">No</MenuItem>
            </TextField>
            <TextField label="CQC Mandated" select value={form.cqc_mandated ? 'yes' : 'no'} onChange={e => setForm(p => ({ ...p, cqc_mandated: e.target.value === 'yes' }))}>
              <MenuItem value="yes">Yes</MenuItem>
              <MenuItem value="no">No</MenuItem>
            </TextField>
            {form.cqc_mandated && (
              <TextField label="Required For Roles" select value={form.cqc_mandated_for_roles} onChange={e => setForm(p => ({ ...p, cqc_mandated_for_roles: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value }))} SelectProps={{ multiple: true }} fullWidth>
                {ROLE_OPTIONS.map(r => <MenuItem key={r} value={r}>{r.replace(/_/g, ' ')}</MenuItem>)}
              </TextField>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => saveMutation.mutate()} disabled={!form.name.trim() || saveMutation.isPending}>
            {saveMutation.isPending ? <CircularProgress size={20} /> : editModule ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function ExpiringView() {
  const [days, setDays] = useState(30)
  const [page, setPage] = useState(0)
  const [rowsPerPage] = useState(10)

  const { data, isLoading } = useQuery({
    queryKey: ['training-expiring', days],
    queryFn: async () => {
      const res = await api.get(`/training/expiring?days=${days}`)
      return res.data
    }
  })

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h6">Expiring & Expired Training</Typography>
        <TextField label="Look ahead (days)" type="number" size="small" value={days}
          onChange={e => setDays(parseInt(e.target.value) || 30)} sx={{ width: 150 }} />
      </Stack>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Staff</TableCell>
              <TableCell>Module</TableCell>
              <TableCell>Completed</TableCell>
              <TableCell>Expires</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5}>Loading...</TableCell></TableRow>
            ) : data?.length === 0 ? (
              <TableRow><TableCell colSpan={5}>No expiring training found.</TableCell></TableRow>
            ) : data?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((r: any) => {
              const daysLeft = r.expires_at ? Math.ceil((new Date(r.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
              return (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{r.first_name} {r.last_name}</TableCell>
                  <TableCell>{r.module_name}</TableCell>
                  <TableCell>{r.completed_at ? new Date(r.completed_at).toLocaleDateString() : '—'}</TableCell>
                  <TableCell>{r.expires_at ? new Date(r.expires_at).toLocaleDateString() : '—'}</TableCell>
                  <TableCell>
                    {daysLeft !== null ? (
                      <Chip
                        label={daysLeft <= 0 ? 'Expired' : `${daysLeft} days left`}
                        color={daysLeft <= 0 ? 'error' : daysLeft <= 7 ? 'warning' : 'success'}
                        size="small"
                      />
                    ) : '—'}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={data?.length || 0}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[10]}
        />
      </TableContainer>
    </Box>
  )
}

function DashboardView() {
  const { data, isLoading } = useQuery({
    queryKey: ['training-dashboard'],
    queryFn: async () => {
      const res = await api.get('/training/dashboard')
      return res.data
    }
  })

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>

  const chartColors = ['#0F4C81', '#6366F1', '#D946EF', '#16A34A', '#F59E0B', '#DC2626', '#6B7280', '#8B5CF6']

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Card><CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h4" fontWeight={700} color="primary">{data.overall?.percentage || 0}%</Typography>
            <Typography variant="caption" color="text.secondary">Overall Completion</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card><CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h4" fontWeight={700} color="primary">{data.totalStaff || 0}</Typography>
            <Typography variant="caption" color="text.secondary">Active Staff</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card><CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h4" fontWeight={700} color="primary">{data.totalModules || 0}</Typography>
            <Typography variant="caption" color="text.secondary">Training Modules</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card><CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h4" fontWeight={700} color={data.overall?.completed === data.overall?.total ? 'success.main' : 'warning.main'}>
              {data.overall?.completed || 0}/{data.overall?.total || 0}
            </Typography>
            <Typography variant="caption" color="text.secondary">Completed Records</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Completion by Role</Typography>
            {data.byRole?.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.byRole} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <XAxis dataKey="role" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <ReTooltip formatter={(v: any) => `${v}%`} />
                  <Bar dataKey="percentage" radius={[4, 4, 0, 0]} maxBarSize={60}>
                    {data.byRole.map((_: any, i: number) => (
                      <Cell key={i} fill={chartColors[i % chartColors.length]} />
                    ))}
                    <LabelList dataKey="percentage" position="top" formatter={(v: any) => `${v}%`} style={{ fontSize: 11, fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No training records found by role.</Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Completion by Module</Typography>
            {data.byModule?.length > 0 ? (
              <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Module</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                      <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Completed</TableCell>
                      <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Rate</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.byModule.map((m: any) => (
                      <TableRow key={m.id} hover>
                        <TableCell sx={{ fontSize: 13 }}>{m.name}</TableCell>
                        <TableCell><Chip label={m.category || 'General'} size="small" variant="outlined" /></TableCell>
                        <TableCell sx={{ textAlign: 'right' }}>{m.completed}/{m.total}</TableCell>
                        <TableCell sx={{ textAlign: 'right' }}>
                          <Chip
                            label={`${m.percentage}%`}
                            size="small"
                            color={m.percentage >= 80 ? 'success' : m.percentage >= 50 ? 'warning' : 'error'}
                            sx={{ fontWeight: 600 }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No training modules configured.</Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}
