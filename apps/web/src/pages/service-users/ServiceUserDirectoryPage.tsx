import { useState } from 'react'
import {
  Box, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Button,
  Chip, Stack, Alert, CircularProgress, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogActions, MenuItem,
  TablePagination, Avatar, Checkbox,
} from '@mui/material'
import {
  Add as AddIcon, Search as SearchIcon,
  Warning as WarningIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useSnackbar } from '../../context/SnackbarContext'

const SUPPORT_LEVELS = [
  { value: '', label: 'None specified' },
  { value: 'independent', label: 'Independent' },
  { value: 'minimal', label: 'Minimal support' },
  { value: 'one_to_one', label: '1:1' },
  { value: 'two_to_one', label: '2:1' },
  { value: 'three_to_one', label: '3:1' },
  { value: 'complex', label: 'Complex / high dependency' },
]

const STATUS_CONFIG: Record<string, { label: string; color: 'success' | 'error' | 'default' | 'warning' }> = {
  active: { label: 'Active', color: 'success' },
  discharged: { label: 'Discharged', color: 'default' },
  deceased: { label: 'Deceased', color: 'error' },
}

export default function ServiceUserDirectoryPage() {
  const navigate = useNavigate()
  const { showSnackbar } = useSnackbar()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ first_name: '', last_name: '', date_of_birth: '', nhs_number: '', room_number: '', status: 'active', allergies: '', support_level: '' })
  const [formError, setFormError] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkOpen, setBulkOpen] = useState<'status' | 'discharge' | null>(null)
  const [bulkStatus, setBulkStatus] = useState('active')
  const queryClient = useQueryClient()

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['service-users', statusFilter, search],
    queryFn: () => api.get('/service-users', { params: { status: statusFilter || undefined, search: search || undefined } }).then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/service-users', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['service-users'] }); setAddOpen(false); setForm({ first_name: '', last_name: '', date_of_birth: '', nhs_number: '', room_number: '', status: 'active', allergies: '', support_level: '' }) },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to create'),
  })

  const bulkStatusMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: string }) => api.post('/service-users/bulk/status', { ids, status }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['service-users'] }); setSelected(new Set()); setBulkOpen(null); showSnackbar('Status updated') },
    onError: (err: any) => showSnackbar(err.response?.data?.message || 'Bulk update failed', 'error'),
  })

  const bulkDischargeMutation = useMutation({
    mutationFn: (ids: string[]) => api.post('/service-users/bulk/discharge', { ids }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['service-users'] }); setSelected(new Set()); setBulkOpen(null); showSnackbar('People discharged') },
    onError: (err: any) => showSnackbar(err.response?.data?.message || 'Bulk discharge failed', 'error'),
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!form.first_name.trim() || !form.last_name.trim()) { setFormError('Name is required'); return }
    const payload: any = { first_name: form.first_name, last_name: form.last_name }
    if (form.date_of_birth) payload.date_of_birth = form.date_of_birth
    if (form.nhs_number) payload.nhs_number = form.nhs_number
    if (form.room_number) payload.room_number = form.room_number
    if (form.status) payload.status = form.status
    if (form.allergies.trim()) payload.allergies = form.allergies.split(',').map((a: string) => a.trim()).filter(Boolean)
    if (form.support_level) payload.support_level = form.support_level
    createMutation.mutate(payload)
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  const toggleAll = () => {
    if (selected.size === users.length) setSelected(new Set())
    else setSelected(new Set(users.map((u: any) => u.id)))
  }

  const paginated = users.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>Service Users</Typography>
        <Stack direction="row" spacing={1}>
          {selected.size > 0 && (
            <>
              <Button variant="outlined" size="small" onClick={() => { setBulkOpen('status'); setBulkStatus('active') }}
                sx={{ textTransform: 'none' }}>
                Change Status ({selected.size})
              </Button>
              <Button variant="outlined" size="small" color="error" onClick={() => setBulkOpen('discharge')}
                sx={{ textTransform: 'none' }}>
                Discharge ({selected.size})
              </Button>
            </>
          )}
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}
            sx={{ bgcolor: '#0F4C81', textTransform: 'none', fontWeight: 700 }}>
            Add Person
          </Button>
        </Stack>
      </Stack>

      <Paper sx={{ p: 2, mb: 3, borderRadius: 2, border: '1px solid #E5E7EB' }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField size="small" placeholder="Search by name or room..." value={search} onChange={e => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            sx={{ minWidth: 300 }} />
          <TextField select size="small" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} label="Status" sx={{ minWidth: 140 }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="discharged">Discharged</MenuItem>
            <MenuItem value="deceased">Deceased</MenuItem>
          </TextField>
        </Stack>
      </Paper>

      {isLoading && <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>}
      {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{(error as any).response?.data?.message || 'Failed to load'}</Alert>}

      {!isLoading && (
        <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox"><Checkbox checked={selected.size === users.length && users.length > 0} indeterminate={selected.size > 0 && selected.size < users.length} onChange={toggleAll} /></TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Photo</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Room</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>NHS Number</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>DOB</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Care Plans</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Open Risks</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4, color: '#9CA3AF' }}>No people found</TableCell></TableRow>
              ) : paginated.map((u: any) => (
                <TableRow key={u.id} hover selected={selected.has(u.id)} sx={{ cursor: 'pointer' }}>
                  <TableCell padding="checkbox" onClick={e => e.stopPropagation()}>
                    <Checkbox checked={selected.has(u.id)} onChange={() => toggleSelect(u.id)} />
                  </TableCell>
                  <TableCell onClick={() => navigate(`/service-users/${u.id}`)}>
                    <Avatar src={u.photo_url || undefined}
                      sx={{ width: 40, height: 40, bgcolor: '#0F4C81', fontSize: 16 }}>
                      {!u.photo_url && `${u.first_name?.[0]}${u.last_name?.[0]}`}
                    </Avatar>
                  </TableCell>
                  <TableCell onClick={() => navigate(`/service-users/${u.id}`)}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" fontWeight={700}>{u.first_name} {u.last_name}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell onClick={() => navigate(`/service-users/${u.id}`)}>{u.room_number || '—'}</TableCell>
                  <TableCell onClick={() => navigate(`/service-users/${u.id}`)}>{u.nhs_number || '—'}</TableCell>
                  <TableCell onClick={() => navigate(`/service-users/${u.id}`)}>{u.date_of_birth ? new Date(u.date_of_birth).toLocaleDateString('en-GB') : '—'}</TableCell>
                  <TableCell onClick={() => navigate(`/service-users/${u.id}`)}>
                    <Chip label={STATUS_CONFIG[u.status]?.label || u.status} size="small" color={STATUS_CONFIG[u.status]?.color || 'default'} />
                  </TableCell>
                  <TableCell align="right" onClick={() => navigate(`/service-users/${u.id}`)}>
                    <Chip label={u.active_care_plans || 0} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell align="right" onClick={() => navigate(`/service-users/${u.id}`)}>
                    {(u.open_risks || 0) > 0
                      ? <Chip icon={<WarningIcon />} label={u.open_risks} size="small" color="error" />
                      : <Chip label="0" size="small" variant="outlined" />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div" count={users.length} page={page}
            onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
            onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0) }}
            rowsPerPageOptions={[5, 10, 25, 50]} />
        </TableContainer>
      )}

      {/* Add Resident Dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={handleCreate}>
          <DialogTitle sx={{ fontWeight: 800 }}>Add New Person</DialogTitle>
          <DialogContent>
            {formError && <Alert severity="error" sx={{ mb: 2, borderRadius: 1 }}>{formError}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack direction="row" spacing={1}>
                <TextField label="First Name" fullWidth required value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
                <TextField label="Last Name" fullWidth required value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
              </Stack>
              <Stack direction="row" spacing={1}>
                <TextField label="Date of Birth" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} />
                <TextField select label="Status" fullWidth value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="discharged">Discharged</MenuItem>
                  <MenuItem value="deceased">Deceased</MenuItem>
                </TextField>
              </Stack>
              <Stack direction="row" spacing={1}>
                <TextField label="NHS Number" fullWidth value={form.nhs_number} onChange={e => setForm({ ...form, nhs_number: e.target.value })} />
                <TextField label="Room / Bed" fullWidth value={form.room_number} onChange={e => setForm({ ...form, room_number: e.target.value })} />
              </Stack>
              <TextField label="Allergies (comma-separated)" fullWidth placeholder="e.g. Penicillin, Latex, Peanuts" value={form.allergies} onChange={e => setForm({ ...form, allergies: e.target.value })} />
              <TextField select label="Level of Support" fullWidth value={form.support_level} onChange={e => setForm({ ...form, support_level: e.target.value })}>
                {SUPPORT_LEVELS.map(sl => (
                  <MenuItem key={sl.value} value={sl.value}>{sl.label}</MenuItem>
                ))}
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={createMutation.isPending}
              sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
              {createMutation.isPending ? <CircularProgress size={20} /> : 'Create Person'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Bulk Status Dialog */}
      <Dialog open={bulkOpen === 'status'} onClose={() => setBulkOpen(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Change Status ({selected.size} people)</DialogTitle>
        <DialogContent>
          <TextField select label="New Status" fullWidth value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} sx={{ mt: 1 }}>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="discharged">Discharged</MenuItem>
            <MenuItem value="deceased">Deceased</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setBulkOpen(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => bulkStatusMutation.mutate({ ids: Array.from(selected), status: bulkStatus })}
            disabled={bulkStatusMutation.isPending} sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
            {bulkStatusMutation.isPending ? <CircularProgress size={20} /> : 'Apply'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Discharge Dialog */}
      <Dialog open={bulkOpen === 'discharge'} onClose={() => setBulkOpen(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Discharge {selected.size} People?</DialogTitle>
        <DialogContent>
          <Typography>This will mark the selected people as discharged. The action can be reversed later.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setBulkOpen(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => bulkDischargeMutation.mutate(Array.from(selected))}
            disabled={bulkDischargeMutation.isPending} sx={{ textTransform: 'none' }}>
            {bulkDischargeMutation.isPending ? <CircularProgress size={20} /> : 'Confirm Discharge'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}