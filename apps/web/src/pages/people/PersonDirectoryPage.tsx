import { useState } from 'react'
import {
  Box, Typography, TextField, Button, Stack, Alert,
  InputAdornment, Dialog, DialogTitle, DialogContent,
  DialogActions, MenuItem, Checkbox,
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import {
  Add as AddIcon, Search as SearchIcon,
  Warning as WarningIcon, Group as GroupIcon,
  Person as PersonIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useSnackbar } from '../../context/SnackbarContext'
import PersonAvatar from '../../components/PersonAvatar'
import { PremiumCard, StatusBadge } from '../../components/design/PremiumCard'
import { EmptyState } from '../../components/design/EmptyState'

const SUPPORT_LEVELS = [
  { value: '', label: 'None specified' },
  { value: 'independent', label: 'Independent' },
  { value: 'minimal', label: 'Minimal support' },
  { value: 'one_to_one', label: '1:1' },
  { value: 'two_to_one', label: '2:1' },
  { value: 'three_to_one', label: '3:1' },
  { value: 'complex', label: 'Complex / high dependency' },
]

const STATUS_VARIANT: Record<string, 'completed' | 'scheduled' | 'missed' | 'in-progress' | 'pending'> = {
  active: 'completed',
  discharged: 'pending',
  deceased: 'missed',
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  discharged: 'Discharged',
  deceased: 'Deceased',
}

export default function PersonDirectoryPage() {
  const theme = useTheme()
  const navigate = useNavigate()
  const { showSnackbar } = useSnackbar()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [inlineForm, setInlineForm] = useState(false)
  const [form, setForm] = useState({ first_name: '', last_name: '', date_of_birth: '', nhs_number: '', room_number: '', status: 'active', allergies: '', support_level: '', location_id: '', min_staff_required: '' })
  const [formError, setFormError] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkOpen, setBulkOpen] = useState<'status' | 'discharge' | null>(null)
  const [bulkStatus, setBulkStatus] = useState('active')
  const queryClient = useQueryClient()

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => api.get('/settings/locations').then(r => r.data),
  })

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['people', statusFilter, search],
    queryFn: () => api.get('/people', { params: { status: statusFilter || undefined, search: search || undefined } }).then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/people', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] })
      setAddOpen(false)
      setForm({ first_name: '', last_name: '', date_of_birth: '', nhs_number: '', room_number: '', status: 'active', allergies: '', support_level: '', location_id: '', min_staff_required: '' })
      showSnackbar('Person added successfully')
    },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to create'),
  })

  const bulkStatusMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: string }) => api.post('/people/bulk/status', { ids, status }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['people'] }); setSelected(new Set()); setBulkOpen(null); showSnackbar('Status updated') },
    onError: (err: any) => showSnackbar(err.response?.data?.message || 'Bulk update failed', 'error'),
  })

  const bulkDischargeMutation = useMutation({
    mutationFn: (ids: string[]) => api.post('/people/bulk/discharge', { ids }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['people'] }); setSelected(new Set()); setBulkOpen(null); showSnackbar('People discharged') },
    onError: (err: any) => showSnackbar(err.response?.data?.message || 'Bulk discharge failed', 'error'),
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!form.first_name.trim() || !form.last_name.trim()) { setFormError('Name is required'); return }
    if (!form.location_id) { setFormError('Location is required'); return }
    const payload: any = { first_name: form.first_name, last_name: form.last_name }
    if (form.date_of_birth) payload.date_of_birth = form.date_of_birth
    if (form.nhs_number) payload.nhs_number = form.nhs_number
    if (form.room_number) payload.room_number = form.room_number
    if (form.status) payload.status = form.status
    if (form.allergies.trim()) payload.allergies = form.allergies.split(',').map((a: string) => a.trim()).filter(Boolean)
    if (form.support_level) payload.support_level = form.support_level
    payload.location_id = form.location_id
    if (form.support_level === 'complex' && form.min_staff_required) payload.min_staff_required = parseInt(form.min_staff_required, 10)
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

  const activeCount = users.filter((u: any) => u.status === 'active').length
  const dischargedCount = users.filter((u: any) => u.status === 'discharged').length
  const riskCount = users.filter((u: any) => (u.open_risks || 0) > 0).length

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
      {/* ── Header ── */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ mb: 3, gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>People</Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.5 }}>
            Manage clients, care plans and support levels
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {selected.size > 0 && (
            <>
              <Button variant="outlined" size="small" onClick={() => { setBulkOpen('status'); setBulkStatus('active') }}
                sx={{ textTransform: 'none', borderRadius: '12px', fontWeight: 600, borderColor: theme.palette.divider, color: theme.palette.text.primary }}>
                Change Status ({selected.size})
              </Button>
              <Button variant="outlined" size="small" color="error" onClick={() => setBulkOpen('discharge')}
                sx={{ textTransform: 'none', borderRadius: '12px', fontWeight: 600 }}>
                Discharge ({selected.size})
              </Button>
            </>
          )}
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setInlineForm(!inlineForm); setAddOpen(false) }}
            sx={{ textTransform: 'none', borderRadius: '12px', fontWeight: 600, px: 2.5, py: 1, bgcolor: '#1A2332', '&:hover': { bgcolor: '#263347' } }}>
            {inlineForm ? 'Close' : 'Add client'}
          </Button>
        </Stack>
      </Stack>

      {/* ── Stats row ── */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <PremiumCard noBorder sx={{ p: 2.5, flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: '#E9F7F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PersonIcon sx={{ fontSize: 20, color: '#047857' }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>{activeCount}</Typography>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>Active clients</Typography>
          </Box>
        </PremiumCard>
        <PremiumCard noBorder sx={{ p: 2.5, flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GroupIcon sx={{ fontSize: 20, color: '#6B7280' }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>{dischargedCount}</Typography>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>Discharged</Typography>
          </Box>
        </PremiumCard>
        <PremiumCard noBorder sx={{ p: 2.5, flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: riskCount > 0 ? '#FDECEC' : '#E9F7F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <WarningIcon sx={{ fontSize: 20, color: riskCount > 0 ? '#DC2626' : '#047857' }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>{riskCount}</Typography>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>Open risks</Typography>
          </Box>
        </PremiumCard>
      </Stack>

      {/* ── Inline add client form ── */}
      {inlineForm && (
        <PremiumCard noBorder sx={{ p: 3, mb: 3, borderLeft: '4px solid #0F4C81' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Add a new client</Typography>
            <Button size="small" onClick={() => setInlineForm(false)} sx={{ textTransform: 'none', color: theme.palette.text.secondary, borderRadius: '10px' }}>Close</Button>
          </Stack>
          {formError && <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>{formError}</Alert>}
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="First name" size="small" required value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} sx={{ flex: 1 }} />
              <TextField label="Last name" size="small" required value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} sx={{ flex: 1 }} />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField type="date" label="Date of birth" size="small" InputLabelProps={{ shrink: true }} value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} sx={{ flex: 1 }} />
              <TextField label="NHS number" size="small" value={form.nhs_number} onChange={e => setForm(f => ({ ...f, nhs_number: e.target.value }))} sx={{ flex: 1 }} />
              <TextField label="Room / address" size="small" value={form.room_number} onChange={e => setForm(f => ({ ...f, room_number: e.target.value }))} sx={{ flex: 1 }} />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField select label="Location" size="small" required value={form.location_id} onChange={e => setForm(f => ({ ...f, location_id: e.target.value }))} sx={{ flex: 1 }}>
                <MenuItem value="">Select location</MenuItem>
                {locations.map((l: any) => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
              </TextField>
              <TextField select label="Support level" size="small" value={form.support_level} onChange={e => setForm(f => ({ ...f, support_level: e.target.value }))} sx={{ flex: 1 }}>
                {SUPPORT_LEVELS.map(sl => <MenuItem key={sl.value} value={sl.value}>{sl.label}</MenuItem>)}
              </TextField>
              <TextField select label="Status" size="small" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} sx={{ flex: 1 }}>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="discharged">Discharged</MenuItem>
              </TextField>
            </Stack>
            <TextField label="Allergies (comma-separated)" size="small" placeholder="e.g. Penicillin, Latex" value={form.allergies} onChange={e => setForm(f => ({ ...f, allergies: e.target.value }))} />
            <Stack direction="row" justifyContent="flex-end" spacing={1}>
              <Button size="small" onClick={() => setInlineForm(false)} sx={{ textTransform: 'none', borderRadius: '10px', color: theme.palette.text.secondary }}>Cancel</Button>
              <Button size="small" variant="contained" disabled={createMutation.isPending || !form.first_name.trim() || !form.last_name.trim() || !form.location_id}
                onClick={(e) => { e.preventDefault(); handleCreate(e as any) }}
                sx={{ textTransform: 'none', borderRadius: '10px', bgcolor: '#1A2332', '&:hover': { bgcolor: '#263347' } }}>
                {createMutation.isPending ? 'Adding...' : 'Add client'}
              </Button>
            </Stack>
          </Stack>
        </PremiumCard>
      )}

      {/* ── Search & Filter ── */}
      <PremiumCard noBorder sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <TextField size="small" placeholder="Search by name or room..." value={search} onChange={e => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} /></InputAdornment> }}
            sx={{ flex: 1, minWidth: 250, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
          <TextField select size="small" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} label="Status"
            sx={{ minWidth: 140, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="discharged">Discharged</MenuItem>
            <MenuItem value="deceased">Deceased</MenuItem>
          </TextField>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {users.length} {users.length === 1 ? 'person' : 'people'}
          </Typography>
        </Stack>
      </PremiumCard>

      {/* ── Error state ── */}
      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>
          {(error as any).response?.data?.message || 'Failed to load people'}
        </Alert>
      )}

      {/* ── Table ── */}
      {!isLoading && (
        <PremiumCard noBorder>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                    <Checkbox checked={selected.size === users.length && users.length > 0} indeterminate={selected.size > 0 && selected.size < users.length} onChange={toggleAll}
                      sx={{ color: theme.palette.text.secondary, '&.Mui-checked': { color: '#1A2332' } }} />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>Room</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>NHS Number</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>DOB</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }} align="right">Plans</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }} align="right">Risks</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} sx={{ borderBottom: 'none' }}>
                      <EmptyState
                        title={search || statusFilter ? 'No matches found' : 'No people yet'}
                        description={search || statusFilter ? 'Try adjusting your search or filters' : 'Add your first client to get started'}
                        variant={search || statusFilter ? 'search' : 'default'}
                        action={!search && !statusFilter ? { label: 'Add client', onClick: () => setInlineForm(true) } : undefined}
                      />
                    </TableCell>
                  </TableRow>
                ) : paginated.map((u: any) => (
                  <TableRow key={u.id} hover selected={selected.has(u.id)} sx={{ cursor: 'pointer', '&:last-child td': { borderBottom: 'none' } }}>
                    <TableCell padding="checkbox" onClick={e => e.stopPropagation()}>
                      <Checkbox checked={selected.has(u.id)} onChange={() => toggleSelect(u.id)}
                        sx={{ color: theme.palette.text.secondary, '&.Mui-checked': { color: '#1A2332' } }} />
                    </TableCell>
                    <TableCell onClick={() => navigate(`/people/${u.id}`)} sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <PersonAvatar photoUrl={u.photo_url} name={`${u.first_name} ${u.last_name}`}
                          sx={{ width: 36, height: 36, bgcolor: '#1A2332', fontSize: 14 }} />
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {u.first_name} {u.last_name}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell onClick={() => navigate(`/people/${u.id}`)} sx={{ borderBottom: `1px solid ${theme.palette.divider}`, color: u.room_number ? theme.palette.text.primary : theme.palette.text.secondary }}>
                      {u.room_number || '—'}
                    </TableCell>
                    <TableCell onClick={() => navigate(`/people/${u.id}`)} sx={{ borderBottom: `1px solid ${theme.palette.divider}`, color: u.nhs_number ? theme.palette.text.primary : theme.palette.text.secondary, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                      {u.nhs_number || '—'}
                    </TableCell>
                    <TableCell onClick={() => navigate(`/people/${u.id}`)} sx={{ borderBottom: `1px solid ${theme.palette.divider}`, color: theme.palette.text.secondary, fontSize: '0.85rem' }}>
                      {u.date_of_birth ? new Date(u.date_of_birth).toLocaleDateString('en-GB') : '—'}
                    </TableCell>
                    <TableCell onClick={() => navigate(`/people/${u.id}`)} sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                      <StatusBadge variant={STATUS_VARIANT[u.status] || 'pending'} label={STATUS_LABEL[u.status] || u.status} />
                    </TableCell>
                    <TableCell align="right" onClick={() => navigate(`/people/${u.id}`)} sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                      <StatusBadge variant="scheduled" label={String(u.active_care_plans || 0)} />
                    </TableCell>
                    <TableCell align="right" onClick={() => navigate(`/people/${u.id}`)} sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                      {(u.open_risks || 0) > 0
                        ? <StatusBadge variant="missed" label={String(u.open_risks)} sx={{ px: 1 }} />
                        : <StatusBadge variant="completed" label="0" />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {users.length > 0 && (
            <TablePagination component="div" count={users.length} page={page}
              onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
              onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0) }}
              rowsPerPageOptions={[5, 10, 25, 50]} />
          )}
        </PremiumCard>
      )}

      {/* ── Add Resident Dialog ── */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '18px' } }}>
        <Box component="form" onSubmit={handleCreate}>
          <DialogTitle sx={{ fontWeight: 800, fontSize: '1.2rem' }}>Add New Person</DialogTitle>
          <DialogContent>
            {formError && <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>{formError}</Alert>}
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
              <TextField select label="Location" fullWidth required value={form.location_id} error={!!formError && !form.location_id}
                helperText={formError && !form.location_id ? 'Please select a location' : 'Which location does this person live at?'}
                onChange={e => setForm({ ...form, location_id: e.target.value })}>
                {locations.map((l: any) => (
                  <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
                ))}
              </TextField>
              <TextField select label="Level of Support" fullWidth value={form.support_level} onChange={e => setForm({ ...form, support_level: e.target.value })}>
                {SUPPORT_LEVELS.map(sl => (
                  <MenuItem key={sl.value} value={sl.value}>{sl.label}</MenuItem>
                ))}
              </TextField>
              {form.support_level === 'complex' && (
                <TextField label="Minimum Staff Required" type="number" inputProps={{ min: 1, max: 6 }}
                  fullWidth required helperText="How many staff are required to support this person safely at all times?"
                  value={form.min_staff_required} onChange={e => setForm({ ...form, min_staff_required: e.target.value })} />
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 0 }}>
            <Button onClick={() => setAddOpen(false)} sx={{ textTransform: 'none', borderRadius: '10px', color: theme.palette.text.secondary }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={createMutation.isPending}
              sx={{ textTransform: 'none', borderRadius: '10px', bgcolor: '#1A2332', '&:hover': { bgcolor: '#263347' } }}>
              {createMutation.isPending ? 'Creating...' : 'Create Person'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* ── Bulk Status Dialog ── */}
      <Dialog open={bulkOpen === 'status'} onClose={() => setBulkOpen(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '18px' } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Change Status ({selected.size} people)</DialogTitle>
        <DialogContent>
          <TextField select label="New Status" fullWidth value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} sx={{ mt: 1 }}>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="discharged">Discharged</MenuItem>
            <MenuItem value="deceased">Deceased</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setBulkOpen(null)} sx={{ textTransform: 'none', borderRadius: '10px', color: theme.palette.text.secondary }}>Cancel</Button>
          <Button variant="contained" onClick={() => bulkStatusMutation.mutate({ ids: Array.from(selected), status: bulkStatus })}
            disabled={bulkStatusMutation.isPending} sx={{ textTransform: 'none', borderRadius: '10px', bgcolor: '#1A2332', '&:hover': { bgcolor: '#263347' } }}>
            {bulkStatusMutation.isPending ? 'Updating...' : 'Apply'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Bulk Discharge Dialog ── */}
      <Dialog open={bulkOpen === 'discharge'} onClose={() => setBulkOpen(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '18px' } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Discharge {selected.size} People?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: theme.palette.text.secondary }}>
            This will mark the selected people as discharged. The action can be reversed later.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setBulkOpen(null)} sx={{ textTransform: 'none', borderRadius: '10px', color: theme.palette.text.secondary }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => bulkDischargeMutation.mutate(Array.from(selected))}
            disabled={bulkDischargeMutation.isPending} sx={{ textTransform: 'none', borderRadius: '10px' }}>
            {bulkDischargeMutation.isPending ? 'Discharging...' : 'Confirm Discharge'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
