import { useState, useEffect } from 'react'
import {
  Box, Typography, Paper, Stack, Chip, Button, TextField, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Alert, Dialog, DialogTitle, DialogContent, DialogActions,
  InputAdornment, Select, FormControl, InputLabel,
  TablePagination, TableFooter,
} from '@mui/material'
import {
  Add as AddIcon, Search as SearchIcon, Warning as WarningIcon,
  CheckCircle as CheckIcon, Autorenew as AutorenewIcon,
  Flag as FlagIcon, Lock as LockIcon, LockOpen as LockOpenIcon,
  ListAlt as TaskIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

const SEVERITY_COLORS: Record<string, string> = { low: '#16A34A', medium: '#D97706', high: '#DC2626', critical: '#7C3AED' }
const STATUS_COLORS: Record<string, string> = { reported: '#D97706', investigating: '#0F4C81', resolved: '#16A34A', closed: '#6B7280' }

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
      status: statusFilter || undefined,
      severity: severityFilter || undefined,
      category_id: categoryFilter || undefined,
      is_near_miss: nearMissFilter || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['incidents'] }); queryClient.invalidateQueries({ queryKey: ['incident-stats'] }); setAddOpen(false); setForm({ title: '', description: '', category_id: '', incident_date: new Date().toISOString().split('T')[0], incident_time: '', location: '', severity: 'medium', is_cqc_reportable: false, is_near_miss: false, is_confidential: false }) },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to create incident'),
  })

  const filtered = incidents?.filter((i: any) =>
    !search || i.title?.toLowerCase().includes(search.toLowerCase()) || i.location?.toLowerCase().includes(search.toLowerCase())
  )
  const paginated = filtered?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage) || []
  useEffect(() => { setPage(0) }, [search, statusFilter, severityFilter, categoryFilter, nearMissFilter, dateFrom, dateTo])

  const statCards = stats ? [
    { label: 'Total', value: stats.total, color: '#0F4C81' },
    { label: 'Reported', value: stats.reported, color: '#D97706' },
    { label: 'Investigating', value: stats.investigating, color: '#0F4C81' },
    { label: 'Critical', value: stats.critical, color: '#DC2626' },
    { label: 'Near Misses', value: stats.near_misses, color: '#8B5CF6' },
    { label: 'Open Actions', value: stats.open_actions, color: '#0891B2' },
    { label: 'Overdue Actions', value: stats.overdue_actions, color: '#DC2626' },
    { label: 'Pending CQC', value: stats.pending_cqc, color: '#7C3AED' },
  ] : []

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>Incident Management</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}
          sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>Report Incident</Button>
      </Stack>

      {/* Stats Cards */}
      <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap', gap: 1 }}>
        {statCards.map((s, i) => (
          <Paper key={i} sx={{ px: 2.5, py: 1.5, borderRadius: 2, border: '1px solid #E5E7EB', borderLeft: 4, borderLeftColor: s.color, minWidth: 120 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>{s.value}</Typography>
            <Typography variant="caption" color="#6B7280" fontWeight={600}>{s.label}</Typography>
          </Paper>
        ))}
      </Stack>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2, border: '1px solid #E5E7EB' }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
          <TextField size="small" placeholder="Search by title or location..." value={search} onChange={e => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            sx={{ minWidth: 260 }} />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} label="Status" onChange={e => setStatusFilter(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="reported">Reported</MenuItem>
              <MenuItem value="investigating">Investigating</MenuItem>
              <MenuItem value="resolved">Resolved</MenuItem>
              <MenuItem value="closed">Closed</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Severity</InputLabel>
            <Select value={severityFilter} label="Severity" onChange={e => setSeverityFilter(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="critical">Critical</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Category</InputLabel>
            <Select value={categoryFilter} label="Category" onChange={e => setCategoryFilter(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {(categories || []).map((c: any) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Type</InputLabel>
            <Select value={nearMissFilter} label="Type" onChange={e => setNearMissFilter(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="false">Incidents</MenuItem>
              <MenuItem value="true">Near Misses</MenuItem>
            </Select>
          </FormControl>
          <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </Stack>
      </Paper>

      {isLoading && <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>}

      {!isLoading && incidents?.length === 0 && (
        <Typography sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>No incidents found</Typography>
      )}

      {!isLoading && incidents && incidents.length > 0 && (
        <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Title</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Severity</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>CQC</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered?.length === 0 ? (
                <TableRow><TableCell colSpan={8}><Typography sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>No incidents match your search</Typography></TableCell></TableRow>
              ) : paginated.map((i: any) => (
              <TableRow key={i.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/incidents/${i.id}`)}>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>{i.title}</Typography>
                  <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                    {i.is_near_miss && <Chip label="Near Miss" size="small" sx={{ bgcolor: '#8B5CF620', color: '#8B5CF6', fontWeight: 700 }} />}
                    {i.is_confidential && <Chip label="Confidential" size="small" sx={{ bgcolor: '#37415120', color: '#374151', fontWeight: 700 }} />}
                  </Stack>
                </TableCell>
                <TableCell>{new Date(i.incident_date).toLocaleDateString('en-GB')}</TableCell>
                <TableCell><Typography variant="caption">{i.category_name || '—'}</Typography></TableCell>
                <TableCell>
                  <Chip icon={<WarningIcon />} label={i.severity} size="small"
                    sx={{ bgcolor: `${SEVERITY_COLORS[i.severity] || '#6B7280'}20`, color: SEVERITY_COLORS[i.severity] || '#6B7280', fontWeight: 700, textTransform: 'capitalize' }} />
                </TableCell>
                <TableCell>
                  <Chip icon={i.status === 'closed' ? <CheckIcon /> : i.status === 'investigating' ? <AutorenewIcon /> : <FlagIcon />}
                    label={i.status} size="small"
                    sx={{ bgcolor: `${STATUS_COLORS[i.status] || '#6B7280'}20`, color: STATUS_COLORS[i.status] || '#6B7280', fontWeight: 700, textTransform: 'capitalize' }} />
                </TableCell>
                <TableCell><Typography variant="body2">{i.location || '—'}</Typography></TableCell>
                <TableCell>
                  <Chip icon={<TaskIcon />} label={i.open_actions || 0} size="small"
                    sx={{ bgcolor: '#0891B220', color: i.open_actions > 0 ? '#0891B2' : '#6B7280', fontWeight: 700 }} />
                </TableCell>
                <TableCell>{i.is_cqc_reportable ? <Chip label="CQC Reportable" size="small" color="error" /> : <Chip label="Not Required" size="small" sx={{ bgcolor: '#0F4C8120', color: '#0F4C81', fontWeight: 600 }} />}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TableFooter>
          <TableRow>
            <TablePagination
              count={filtered?.length || 0}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={(_, p) => setPage(p)}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0) }}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </TableRow>
        </TableFooter>
        </TableContainer>
      )}

      {/* Add Dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); createMutation.mutate(form) }}>
          <DialogTitle sx={{ fontWeight: 800 }}>Report Incident</DialogTitle>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Title" fullWidth required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              <TextField select label="Category" fullWidth value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
                {(categories || []).map((c: any) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </TextField>
              <TextField label="Description" fullWidth multiline rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              <Stack direction="row" spacing={1}>
                <TextField label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.incident_date} onChange={e => setForm({ ...form, incident_date: e.target.value })} />
                <TextField label="Time" type="time" fullWidth InputLabelProps={{ shrink: true }} value={form.incident_time} onChange={e => setForm({ ...form, incident_time: e.target.value })} />
              </Stack>
              <TextField label="Location" fullWidth value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
              <TextField select label="Severity" fullWidth value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}>
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
              </TextField>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Button variant={form.is_cqc_reportable ? 'contained' : 'outlined'} color="error"
                  onClick={() => setForm({ ...form, is_cqc_reportable: !form.is_cqc_reportable })}
                  sx={{ textTransform: 'none' }}>
                  {form.is_cqc_reportable ? '✓ CQC Reportable' : 'Mark as CQC Reportable'}
                </Button>
                <Button variant={form.is_near_miss ? 'contained' : 'outlined'} color="secondary"
                  onClick={() => setForm({ ...form, is_near_miss: !form.is_near_miss })}
                  sx={{ textTransform: 'none' }}>
                  {form.is_near_miss ? '✓ Near Miss' : 'Mark as Near Miss'}
                </Button>
                {isOrgAdmin && (
                  <Button variant={form.is_confidential ? 'contained' : 'outlined'} color="inherit"
                    onClick={() => setForm({ ...form, is_confidential: !form.is_confidential })}
                    sx={{ textTransform: 'none' }}>
                    {form.is_confidential ? <><LockIcon fontSize="small" /> Confidential</> : <><LockOpenIcon fontSize="small" /> Confidential</>}
                  </Button>
                )}
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={createMutation.isPending} sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
              {createMutation.isPending ? <CircularProgress size={20} /> : 'Report'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  )
}
