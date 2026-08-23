import { useState, useEffect } from 'react'
import {
  Box, Typography, Paper, Stack, Chip, Button, TextField, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Alert, Dialog, DialogTitle, DialogContent, DialogActions,
  InputAdornment, Select, FormControl, InputLabel,
  TablePagination, TableFooter, Divider,
} from '@mui/material'
import {
  Add as AddIcon, Search as SearchIcon,
  Lock as LockIcon, LockOpen as LockOpenIcon,
  ListAlt as TaskIcon, Circle as DotIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { PageHeader, StatusBadge, EmptyRow, NAVY } from '../../components/ui'

const SEVERITY_TONE: Record<string, 'success' | 'warning' | 'error' | 'purple'> = {
  low: 'success', medium: 'warning', high: 'error', critical: 'purple',
}
const STATUS_TONE: Record<string, 'warning' | 'info' | 'success' | 'neutral'> = {
  reported: 'warning', investigating: 'info', resolved: 'success', closed: 'neutral',
}

export default function IncidentDirectoryPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentUser = (() => { const s = localStorage.getItem('user'); try { const p = s ? JSON.parse(s) : {}; return p && typeof p === 'object' ? p : {} } catch { return {} } })()
  const isOrgAdmin = currentUser.role === 'ORG_ADMIN'
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [nearMissFilter, setNearMissFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ title: '', description: '', category_id: '', incident_date: new Date().toISOString().split('T')[0], incident_time: '', location: '', severity: 'medium', is_cqc_reportable: false, is_near_miss: false, is_confidential: false })
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  const { data: incidents, isLoading } = useQuery({
    queryKey: ['incidents', statusFilter, severityFilter, categoryFilter, nearMissFilter, dateFrom, dateTo],
    queryFn: () => api.get('/incidents', { params: {
      status: statusFilter || undefined, severity: severityFilter || undefined,
      category_id: categoryFilter || undefined, is_near_miss: nearMissFilter || undefined,
      date_from: dateFrom || undefined, date_to: dateTo || undefined,
    } }).then(r => r.data),
  })

  const { data: categories } = useQuery({
    queryKey: ['incident-categories'],
    queryFn: () => api.get('/incidents/categories').then(r => r.data),
  })

  const { data: stats } = useQuery({
    queryKey: ['incident-stats'],
    queryFn: () => api.get('/incidents/stats').then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/incidents', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
      queryClient.invalidateQueries({ queryKey: ['incident-stats'] })
      setAddOpen(false)
      setForm({ title: '', description: '', category_id: '', incident_date: new Date().toISOString().split('T')[0], incident_time: '', location: '', severity: 'medium', is_cqc_reportable: false, is_near_miss: false, is_confidential: false })
    },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to create incident'),
  })

  const incidentRows = Array.isArray(incidents) ? incidents : incidents?.incidents || incidents?.data || []
  const categoryRows = Array.isArray(categories) ? categories : categories?.categories || categories?.data || []
  const filtered = incidentRows.filter((i: any) =>
    !search || i.title?.toLowerCase().includes(search.toLowerCase()) || i.location?.toLowerCase().includes(search.toLowerCase())
  )
  const paginated = filtered?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage) || []
  useEffect(() => { setPage(0) }, [search, statusFilter, severityFilter, categoryFilter, nearMissFilter, dateFrom, dateTo])

  const activeFilterCount = [statusFilter, severityFilter, categoryFilter, nearMissFilter, dateFrom, dateTo].filter(Boolean).length

  return (
    <Box>
      <PageHeader
        title="Incidents"
        subtitle={`${stats?.total ?? 0} total · ${stats?.open_actions ?? 0} open actions`}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}
            sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 700 }}>Report Incident</Button>
        }
      />

      {/* Stats — 4 focused cards */}
      {stats && (
        <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Paper sx={{ flex: '1 1 200px', p: 2.5, borderRadius: 2, border: '1px solid #E5E7EB' }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Open</Typography>
            <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mt: 0.5 }}>
              <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1 }}>{(stats.reported || 0) + (stats.investigating || 0)}</Typography>
              <Typography variant="caption" color="text.secondary">{stats.total || 0} total</Typography>
            </Stack>
            <Stack direction="row" spacing={1.5} sx={{ mt: 1.5 }}>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <DotIcon sx={{ fontSize: 8, color: '#D97706' }} />
                <Typography variant="caption" color="text.secondary">{stats.reported || 0} reported</Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <DotIcon sx={{ fontSize: 8, color: NAVY }} />
                <Typography variant="caption" color="text.secondary">{stats.investigating || 0} investigating</Typography>
              </Stack>
            </Stack>
          </Paper>

          <Paper sx={{ flex: '1 1 200px', p: 2.5, borderRadius: 2, border: '1px solid #E5E7EB', borderLeft: 4, borderLeftColor: '#DC2626' }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Critical &amp; High</Typography>
            <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mt: 0.5 }}>
              <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1, color: '#DC2626' }}>{(stats.critical || 0)}</Typography>
              {stats.high > 0 && <Typography variant="caption" color="text.secondary">{stats.high} high</Typography>}
            </Stack>
          </Paper>

          <Paper sx={{ flex: '1 1 200px', p: 2.5, borderRadius: 2, border: '1px solid #E5E7EB', borderLeft: 4, borderLeftColor: stats.overdue_actions > 0 ? '#DC2626' : '#16A34A' }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</Typography>
            <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mt: 0.5 }}>
              <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1 }}>{stats.open_actions || 0}</Typography>
              <Typography variant="caption" color="text.secondary">open</Typography>
            </Stack>
            {stats.overdue_actions > 0 && (
              <Chip label={`${stats.overdue_actions} overdue`} size="small"
                sx={{ mt: 1, bgcolor: '#FEE2E2', color: '#B91C1C', fontWeight: 700, fontSize: 11, height: 22 }} />
            )}
          </Paper>

          <Paper sx={{ flex: '1 1 200px', p: 2.5, borderRadius: 2, border: '1px solid #E5E7EB' }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Near Misses</Typography>
            <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mt: 0.5 }}>
              <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1 }}>{stats.near_misses || 0}</Typography>
            </Stack>
            {stats.pending_cqc > 0 && (
              <Chip label={`${stats.pending_cqc} pending CQC`} size="small"
                sx={{ mt: 1, bgcolor: '#E7EEF4', color: NAVY, fontWeight: 700, fontSize: 11, height: 22 }} />
            )}
          </Paper>
        </Stack>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2, border: '1px solid #E5E7EB' }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
          <TextField size="small" placeholder="Search incidents..." value={search} onChange={e => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            sx={{ minWidth: 220 }} />
          <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} label="Status" onChange={e => setStatusFilter(e.target.value)}>
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="reported">Reported</MenuItem>
              <MenuItem value="investigating">Investigating</MenuItem>
              <MenuItem value="resolved">Resolved</MenuItem>
              <MenuItem value="closed">Closed</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Severity</InputLabel>
            <Select value={severityFilter} label="Severity" onChange={e => setSeverityFilter(e.target.value)}>
              <MenuItem value="">All Severities</MenuItem>
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="critical">Critical</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Category</InputLabel>
            <Select value={categoryFilter} label="Category" onChange={e => setCategoryFilter(e.target.value)}>
              <MenuItem value="">All Categories</MenuItem>
              {categoryRows.map((c: any) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Type</InputLabel>
            <Select value={nearMissFilter} label="Type" onChange={e => setNearMissFilter(e.target.value)}>
              <MenuItem value="">All Types</MenuItem>
              <MenuItem value="false">Incidents</MenuItem>
              <MenuItem value="true">Near Misses</MenuItem>
            </Select>
          </FormControl>
          <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
          <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} sx={{ minWidth: 140 }} />
          <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={dateTo} onChange={e => setDateTo(e.target.value)} sx={{ minWidth: 140 }} />
          {activeFilterCount > 0 && (
            <Button size="small" onClick={() => { setStatusFilter(''); setSeverityFilter(''); setCategoryFilter(''); setNearMissFilter(''); setDateFrom(''); setDateTo('') }}
              sx={{ textTransform: 'none', color: 'text.secondary' }}>Clear filters</Button>
          )}
        </Stack>
      </Paper>

      {isLoading && <LoadingState />}

      {!isLoading && filtered?.length === 0 && (
        <EmptyRow message={incidentRows.length === 0 ? 'No incidents reported yet' : 'No incidents match your filters'} action={
          incidentRows.length === 0 ? <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)} sx={{ bgcolor: NAVY, textTransform: 'none' }}>Report First Incident</Button> : undefined
        } />
      )}

      {!isLoading && filtered && filtered.length > 0 && (
        <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Incident</TableCell>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Severity</TableCell>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Location</TableCell>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }} align="right">Actions</TableCell>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CQC</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7}><EmptyRow message="No incidents match your search" /></TableCell></TableRow>
              ) : paginated.map((i: any) => (
                <TableRow key={i.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/incidents/${i.id}`)}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{i.title}</Typography>
                    <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                      {i.category_name && <Typography variant="caption" color="text.secondary">{i.category_name}</Typography>}
                      {i.is_near_miss && <Chip label="Near Miss" size="small" sx={{ bgcolor: '#F3E8FF', color: '#7C3AED', fontWeight: 700, fontSize: 10, height: 20 }} />}
                      {i.is_confidential && <Chip icon={<LockIcon sx={{ fontSize: 12 }} />} label="Confidential" size="small" sx={{ bgcolor: '#F3F4F6', color: '#374151', fontWeight: 700, fontSize: 10, height: 20 }} />}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{new Date(i.incident_date).toLocaleDateString('en-GB')}</Typography>
                  </TableCell>
                  <TableCell>
                    <StatusBadge label={i.severity} tone={SEVERITY_TONE[i.severity] || 'neutral'} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge label={i.status} tone={STATUS_TONE[i.status] || 'neutral'} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">{i.location || '—'}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    {(i.open_actions || 0) > 0 ? (
                      <Chip icon={<TaskIcon sx={{ fontSize: 14 }} />} label={i.open_actions} size="small"
                        sx={{ bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 700, fontSize: 11, height: 22 }} />
                    ) : (
                      <Typography variant="caption" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {i.is_cqc_reportable ? (
                      <StatusBadge label="CQC" tone="error" />
                    ) : (
                      <Typography variant="caption" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TableFooter>
            <TableRow>
              <TablePagination
                count={filtered.length}
                page={page}
                rowsPerPage={rowsPerPage}
                onPageChange={(_, p) => setPage(p)}
                onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0) }}
                rowsPerPageOptions={[5, 10, 25, 50]}
              />
            </TableRow>
          </TableFooter>
        </TableContainer>
      )}

      {/* Report Incident Dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); createMutation.mutate(form) }}>
          <DialogTitle sx={{ fontWeight: 800 }}>Report Incident</DialogTitle>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="What happened?" fullWidth required value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="Brief summary of the incident" />
              <TextField label="Description" fullWidth multiline rows={3} value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Detailed account of what occurred" />
              <Stack direction="row" spacing={1}>
                <TextField label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.incident_date}
                  onChange={e => setForm({ ...form, incident_date: e.target.value })} />
                <TextField label="Time" type="time" fullWidth InputLabelProps={{ shrink: true }} value={form.incident_time}
                  onChange={e => setForm({ ...form, incident_time: e.target.value })} />
              </Stack>
              <TextField label="Location" fullWidth value={form.location}
                onChange={e => setForm({ ...form, location: e.target.value })}
                placeholder="Where did this happen?" />
              <TextField select label="Category" fullWidth value={form.category_id}
                onChange={e => setForm({ ...form, category_id: e.target.value })}>
                <MenuItem value="">Select category...</MenuItem>
                {categoryRows.map((c: any) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </TextField>
              <TextField select label="Severity" fullWidth value={form.severity}
                onChange={e => setForm({ ...form, severity: e.target.value })}>
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
              </TextField>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Button variant={form.is_cqc_reportable ? 'contained' : 'outlined'} color="error" size="small"
                  onClick={() => setForm({ ...form, is_cqc_reportable: !form.is_cqc_reportable })}
                  sx={{ textTransform: 'none' }}>
                  {form.is_cqc_reportable ? '✓ CQC Reportable' : 'CQC Reportable'}
                </Button>
                <Button variant={form.is_near_miss ? 'contained' : 'outlined'} color="secondary" size="small"
                  onClick={() => setForm({ ...form, is_near_miss: !form.is_near_miss })}
                  sx={{ textTransform: 'none' }}>
                  {form.is_near_miss ? '✓ Near Miss' : 'Near Miss'}
                </Button>
                {isOrgAdmin && (
                  <Button variant={form.is_confidential ? 'contained' : 'outlined'} color="inherit" size="small"
                    onClick={() => setForm({ ...form, is_confidential: !form.is_confidential })}
                    sx={{ textTransform: 'none' }}>
                    {form.is_confidential ? <><LockIcon fontSize="small" /> Confidential</> : <><LockOpenIcon fontSize="small" /> Confidential</>}
                  </Button>
                )}
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setAddOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={createMutation.isPending}
              sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 700 }}>
              {createMutation.isPending ? <CircularProgress size={20} /> : 'Report Incident'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  )
}

function LoadingState() {
  return (
    <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB' }}>
      <CircularProgress size={28} sx={{ color: NAVY }} />
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Loading incidents...</Typography>
    </Paper>
  )
}
