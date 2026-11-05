import { useState, useEffect, type ReactNode } from 'react'
import {
  Box, Typography, TextField, Button, Stack, Alert,
  InputAdornment, Dialog, DialogTitle, DialogContent,
  DialogActions, MenuItem, Checkbox, Tabs, Tab, Chip, AlertTitle,
  Grid, Card, CardContent,
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import {
  Add as AddIcon, Search as SearchIcon,
  Warning as WarningIcon, Group as GroupIcon,
  Person as PersonIcon, TaskAlt as TaskIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { formatDateOnly } from '../../utils/dateFormat'
import { useSnackbar } from '../../context/SnackbarContext'
import PersonAvatar from '../../components/PersonAvatar'
import { PremiumCard, StatusBadge } from '../../components/design/PremiumCard'
import { EmptyState } from '../../components/design/EmptyState'

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

// Pill radio option (Figma 6.7): selected gets the brand border + check + tint.
function PillOption({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Button variant="outlined" onClick={onClick}
      sx={{
        textTransform: 'none', borderRadius: '20px', fontWeight: selected ? 700 : 400,
        px: 2, py: 0.75,
        ...(selected
          ? { borderColor: 'primary.main', color: 'primary.main', bgcolor: 'notice.info.bg' }
          : { borderColor: 'divider', color: 'text.primary' }),
      }}>
      {selected ? '\u2713 ' : ''}{children}
    </Button>
  )
}

export default function PersonDirectoryPage() {
  const theme = useTheme()
  const navigate = useNavigate()
  const { showSnackbar } = useSnackbar()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [locationFilter, setLocationFilter] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const emptyForm = { first_name: '', last_name: '', date_of_birth: '', nhs_number: '', room_number: '', status: 'active', allergies: '', support_level: '', location_id: '', min_staff_required: '', gender: '', pronouns: '', admission_date: '', admission_source: '', funding_type: '', gp_surgery: '', dietary_requirements: '', communication_language: '', communication_interpreter: false as boolean }
  const [form, setForm] = useState(emptyForm)
  // Add-person wizard (Figma 6.7): three steps, only the first is required.
  const [wizardStep, setWizardStep] = useState(0)
  const [attention, setAttention] = useState<string[]>([])
  const openWizard = () => { setForm(emptyForm); setWizardStep(0); setAttention([]); setFormError(''); setAddOpen(true) }
  const [formError, setFormError] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkOpen, setBulkOpen] = useState<'status' | 'discharge' | null>(null)
  const [bulkStatus, setBulkStatus] = useState('active')
  const [isDom, setIsDom] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    api.get('/settings/org').then(res => {
      const types = res.data?.service_types
      if (Array.isArray(types)) setIsDom(types.some((t: string) => ['domiciliary', 'live_in'].includes(t)))
    }).catch(() => {})
  }, [])

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => api.get('/settings/locations').then(r => r.data),
  })

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['people', statusFilter, search],
    queryFn: () => api.get('/people', { params: { status: statusFilter || undefined, search: search || undefined } }).then(r => r.data),
  })

  // Org-wide stats stay live even when the table is tabbed or filtered (Figma 6.1).
  const { data: allPeople = [] } = useQuery({
    queryKey: ['people', 'all'],
    queryFn: () => api.get('/people').then(r => r.data),
  })

  // Open-tasks card (Figma 6.1): tasks still open and due today or overdue.
  const { data: tasks = [], isLoading: tasksLoading, isError: tasksError } = useQuery({
    queryKey: ['tasks', 'open-count'],
    queryFn: () => api.get('/tasks').then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/people', data),
    onSuccess: (_res, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ['people'] })
      setAddOpen(false)
      setForm(emptyForm)
      setWizardStep(0)
      setAttention([])
      showSnackbar(`${variables.first_name} ${variables.last_name} has been added. You can fill in the rest from their profile.`, 'success', 'Person added')
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

  const step1Missing = () => {
    const missing: string[] = []
    if (!form.first_name.trim()) missing.push('a first name')
    if (!form.last_name.trim()) missing.push('a last name')
    if (!form.date_of_birth) missing.push('a date of birth')
    return missing
  }

  const goNext = () => {
    setFormError('')
    if (wizardStep === 0) {
      const missing = step1Missing()
      if (missing.length > 0) { setAttention(missing); return }
      setAttention([])
      setWizardStep(1)
    } else if (wizardStep === 1) {
      if (!form.location_id) { setAttention(['a location']); return }
      setAttention([])
      setWizardStep(2)
    }
  }

  const buildPayload = () => {
    const payload: any = { first_name: form.first_name.trim(), last_name: form.last_name.trim(), date_of_birth: form.date_of_birth }
    if (form.nhs_number.trim()) payload.nhs_number = form.nhs_number.trim()
    if (form.room_number.trim()) payload.room_number = form.room_number.trim()
    payload.status = 'active'
    if (form.allergies.trim()) payload.allergies = form.allergies.split(',').map((a: string) => a.trim()).filter(Boolean)
    if (form.gender) payload.gender = form.gender
    if (form.pronouns.trim()) payload.pronouns = form.pronouns.trim()
    payload.location_id = form.location_id
    if (form.admission_date) payload.admission_date = form.admission_date
    if (form.admission_source.trim()) payload.admission_source = form.admission_source.trim()
    if (form.funding_type) payload.funding_type = form.funding_type
    if (form.support_level) payload.support_level = form.support_level
    if (form.support_level === 'complex' && form.min_staff_required) payload.min_staff_required = parseInt(form.min_staff_required, 10)
    if (form.gp_surgery.trim()) payload.gp_surgery = form.gp_surgery.trim()
    if (form.dietary_requirements.trim()) payload.dietary_requirements = form.dietary_requirements.trim()
    if (form.communication_language.trim()) payload.communication_language = form.communication_language.trim()
    payload.communication_interpreter = form.communication_interpreter
    return payload
  }

  const handleFinish = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    const missing = step1Missing()
    if (missing.length > 0) { setAttention(missing); setWizardStep(0); return }
    if (!form.location_id) { setAttention(['a location']); setWizardStep(1); return }
    createMutation.mutate(buildPayload())
  }

  const joinList = (items: string[]) => items.length > 1
    ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
    : items[0] || ''

  const toggleSelect = (id: string) => {
    setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  const toggleAll = () => {
    if (selected.size === visible.length) setSelected(new Set())
    else setSelected(new Set(visible.map((u: any) => u.id)))
  }

  const visible = users.filter((u: any) => !locationFilter || u.location_id === locationFilter)
  const paginated = visible.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)

  const activeCount = allPeople.filter((u: any) => u.status === 'active').length
  const dischargedCount = allPeople.filter((u: any) => u.status === 'discharged').length
  const riskCount = allPeople.filter((u: any) => (u.open_risks || 0) > 0).length
  // Figma 6.1 "Open tasks": still open and due today or overdue. The directory
  // has no task data of its own, so this is counted from the tasks list.
  const todayStr = new Date().toISOString().slice(0, 10)
  // A non-array tasks payload must not white-screen the whole directory.
  const taskList: any[] = Array.isArray(tasks) ? tasks : []
  const openTaskCount = taskList.filter((t: any) => t.status !== 'completed' && t.due_date && String(t.due_date).slice(0, 10) <= todayStr).length

  const filtersSet = search !== '' || locationFilter !== ''
  const clearFilters = () => { setSearch(''); setLocationFilter(''); setPage(0) }

  return (
    <Box>
      {/* ── Breadcrumb + header (Figma 6.1) ── */}
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: '0.08em' }}>
        CARE / {isDom ? 'CLIENTS' : 'PEOPLE'}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ mt: 0.5, mb: 3, gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>{isDom ? 'Clients' : 'People'}</Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.5 }}>
            {isDom ? 'Manage clients, care plans and visit records' : 'Manage the people you support, their care plans and support levels.'}
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
          <Button variant="contained" startIcon={<AddIcon />} onClick={openWizard}
            sx={{ textTransform: 'none', fontWeight: 600, px: 2.5, py: 1, bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}>
            Add person
          </Button>
        </Stack>
      </Stack>

      {/* ── Status tabs (Figma 6.1): the frame draws Active / Discharged only,
          so there is no longer a directory filter for deceased people — they stay
          reachable through profiles, bulk actions and the API. ── */}
      <Tabs value={statusFilter} onChange={(_, v) => { setStatusFilter(v); setPage(0) }} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="active" sx={{ textTransform: 'none', fontWeight: 600 }}
          label={<Stack direction="row" alignItems="center" spacing={1}><span>Active</span><Chip size="small" label={activeCount} color={statusFilter === 'active' ? 'primary' : 'default'} /></Stack>} />
        <Tab value="discharged" sx={{ textTransform: 'none', fontWeight: 600 }}
          label={<Stack direction="row" alignItems="center" spacing={1}><span>Discharged</span><Chip size="small" label={dischargedCount} color={statusFilter === 'discharged' ? 'primary' : 'default'} /></Stack>} />
      </Tabs>

      {/* ── Stats row (Figma 6.1): always visible, live values. The frame's
          "Key worker" column has no data source yet, and its evidence-style
          sample strings name nothing verifiable, so the cards below show only
          what the API returns: the open-tasks count is counted from the tasks
          list, the discharged total is all-time (bulk discharge records no
          discharge date, so a 12-month window would silently undercount). ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[{
          label: isDom ? 'Active clients' : 'Active', value: activeCount,
          sub: isDom ? 'Clients supported now' : 'People supported now',
          icon: <PersonIcon sx={{ fontSize: 18, color: 'notice.success.fg' }} />, bg: 'notice.success.bg',
        }, {
          label: 'Discharged', value: dischargedCount, sub: 'Total to date',
          icon: <GroupIcon sx={{ fontSize: 18, color: 'text.secondary' }} />, bg: 'notice.muted.bg',
        }, {
          label: 'Open tasks', value: tasksError ? '—' : tasksLoading ? '…' : openTaskCount,
          sub: 'Tasks past due or due today',
          icon: <TaskIcon sx={{ fontSize: 18, color: 'notice.warning.fg' }} />, bg: 'notice.warning.bg',
        }, {
          label: 'Open risks', value: riskCount, sub: 'People with high or critical risks',
          icon: <WarningIcon sx={{ fontSize: 18, color: riskCount > 0 ? 'notice.error.fg' : 'notice.success.fg' }} />,
          bg: riskCount > 0 ? 'notice.error.bg' : 'notice.success.bg',
        }].map((c) => (
          <Grid item xs={12} sm={6} md={3} key={c.label}>
            <Card sx={{ border: '1px solid #E3E9F0' }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">{c.label}</Typography>
                  <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {c.icon}
                  </Box>
                </Stack>
                <Typography variant="h4" fontWeight={600}>{c.value}</Typography>
                <Typography variant="caption" color="text.secondary">{c.sub}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ── Search & Filter (Figma 6.1): the frame's "Any worker" filter has no
          data source (people rows carry no key worker), and its save-filters
          button has no backend, so the bar is search + location + clear. The
          old Status dropdown is gone — the tabs above replace it. ── */}
      <PremiumCard noBorder sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <TextField size="small" placeholder="Search by name or room..." value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} /></InputAdornment> }}
            sx={{ flex: 1, minWidth: 250, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
          <TextField select size="small" value={locationFilter} onChange={e => { setLocationFilter(e.target.value); setPage(0) }} label="Location"
            sx={{ minWidth: 160, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}>
            <MenuItem value="">All locations</MenuItem>
            {locations.map((l: any) => (
              <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
            ))}
          </TextField>
          {filtersSet && (
            <Button size="small" onClick={clearFilters} sx={{ textTransform: 'none', fontWeight: 600, color: theme.palette.text.secondary }}>
              Clear
            </Button>
          )}
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
                    <Checkbox checked={selected.size === visible.length && visible.length > 0} indeterminate={selected.size > 0 && selected.size < visible.length} onChange={toggleAll}
                      sx={{ color: theme.palette.text.secondary, '&.Mui-checked': { color: 'text.primary' } }} />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>Room</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>NHS Number</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>DOB</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }} align="right">Care plans</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }} align="right">Risks</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} sx={{ borderBottom: 'none' }}>
                      <EmptyState
                        title={filtersSet ? 'No matches found' : statusFilter === 'discharged' ? 'No one has been discharged' : 'No people yet'}
                        description={filtersSet ? 'Try adjusting your search or filters' : statusFilter === 'discharged' ? 'People you discharge will appear here.' : 'Add your first client to get started'}
                        variant={filtersSet ? 'search' : 'default'}
                        action={filtersSet ? { label: 'Clear search & filters', onClick: clearFilters } : statusFilter === 'active' ? { label: 'Add person', onClick: openWizard } : undefined}
                      />
                    </TableCell>
                  </TableRow>
                ) : paginated.map((u: any) => (
                  <TableRow key={u.id} hover selected={selected.has(u.id)} sx={{ cursor: 'pointer', '&:last-child td': { borderBottom: 'none' } }}>
                    <TableCell padding="checkbox" onClick={e => e.stopPropagation()}>
                      <Checkbox checked={selected.has(u.id)} onChange={() => toggleSelect(u.id)}
                        sx={{ color: theme.palette.text.secondary, '&.Mui-checked': { color: 'text.primary' } }} />
                    </TableCell>
                    <TableCell onClick={() => navigate(`/people/${u.id}`)} sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <PersonAvatar photoUrl={u.photo_url} name={`${u.first_name} ${u.last_name}`}
                          sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: 14 }} />
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
                      {formatDateOnly(u.date_of_birth)}
                    </TableCell>
                    <TableCell align="right" onClick={() => navigate(`/people/${u.id}`)} sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                      <StatusBadge variant="scheduled" label={String(u.active_care_plans || 0)} />
                    </TableCell>
                    <TableCell align="right" onClick={() => navigate(`/people/${u.id}`)} sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                      {(u.open_risks || 0) > 0
                        ? <StatusBadge variant="missed" label={String(u.open_risks)} sx={{ px: 1 }} />
                        : <StatusBadge variant="completed" label="0" />}
                    </TableCell>
                    <TableCell onClick={() => navigate(`/people/${u.id}`)} sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                      <StatusBadge variant={STATUS_VARIANT[u.status] || 'pending'} label={STATUS_LABEL[u.status] || u.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {visible.length > 0 && (
            <TablePagination component="div" count={visible.length} page={page}
              onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
              onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0) }}
              rowsPerPageOptions={[5, 10, 25, 50]} />
          )}
        </PremiumCard>
      )}

      {/* ── Add Person Wizard (Figma 6.7): three steps, only the first is required. ── */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '18px' } }}>
        <Box component="form" onSubmit={handleFinish}>
          <DialogTitle sx={{ pb: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6" sx={{ fontWeight: 800 }}>Add a person</Typography>
              <Button onClick={() => setAddOpen(false)} sx={{ textTransform: 'none', fontWeight: 600 }}>Close</Button>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Only the first step is needed now. You can fill in the rest later.</Typography>
          </DialogTitle>
          <DialogContent>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              {['About them', "Where they'll live", 'Health & contacts'].map((label, i) => (
                <Box key={label} sx={{ flex: 1, cursor: 'pointer' }} onClick={() => { if (i < wizardStep) { setAttention([]); setWizardStep(i) } }}>
                  <Box sx={{ height: 4, borderRadius: 2, bgcolor: i <= wizardStep ? 'primary.main' : 'divider' }} />
                  <Typography variant="caption" sx={{ fontWeight: i === wizardStep ? 700 : 400, color: i <= wizardStep ? 'primary.main' : 'text.secondary' }}>
                    {i + 1} · {label}
                  </Typography>
                </Box>
              ))}
            </Stack>
            {attention.length > 0 && (
              <Alert severity="warning" sx={{ mb: 2, borderRadius: '12px' }}>
                <AlertTitle>{attention.length} thing{attention.length === 1 ? ' needs' : 's need'} your attention</AlertTitle>
                Add {joinList(attention)}, then continue.
              </Alert>
            )}
            {formError && <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>{formError}</Alert>}
            {wizardStep === 0 && (
              <Stack spacing={2} sx={{ mt: 1 }}>
                <Stack direction="row" spacing={1}>
                  <TextField label="First name" fullWidth required value={form.first_name}
                    error={attention.includes('a first name')} helperText={attention.includes('a first name') ? 'Add their first name' : ''}
                    onChange={e => setForm({ ...form, first_name: e.target.value })} />
                  <TextField label="Last name" fullWidth required value={form.last_name}
                    error={attention.includes('a last name')} helperText={attention.includes('a last name') ? 'Add their last name' : ''}
                    onChange={e => setForm({ ...form, last_name: e.target.value })} />
                </Stack>
                <Stack direction="row" spacing={1}>
                  <TextField label="Date of birth" type="date" fullWidth required InputLabelProps={{ shrink: true }}
                    value={form.date_of_birth} error={attention.includes('a date of birth')}
                    helperText={attention.includes('a date of birth') ? 'Add a date of birth, e.g. 3 Mar 1986' : ''}
                    onChange={e => setForm({ ...form, date_of_birth: e.target.value })} />
                  <TextField label="NHS number" fullWidth value={form.nhs_number}
                    helperText="10 digits. Leave it blank if you don't have it yet."
                    onChange={e => setForm({ ...form, nhs_number: e.target.value })} />
                </Stack>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Gender</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {['Male', 'Female', 'Non-binary', 'Prefer not to say'].map(g => (
                      <PillOption key={g} selected={form.gender === g} onClick={() => setForm({ ...form, gender: form.gender === g ? '' : g })}>{g}</PillOption>
                    ))}
                  </Stack>
                </Box>
                <TextField label="Pronouns" fullWidth value={form.pronouns} placeholder="For example he / him"
                  helperText="Optional" FormHelperTextProps={{ sx: { color: 'text.secondary' } }}
                  onChange={e => setForm({ ...form, pronouns: e.target.value })} />
              </Stack>
            )}
            {wizardStep === 1 && (
              <Stack spacing={2} sx={{ mt: 1 }}>
                <Stack direction="row" spacing={1}>
                  <TextField select label="Location" fullWidth required value={form.location_id}
                    error={attention.includes('a location')} helperText={attention.includes('a location') ? "Choose where they'll live" : ''}
                    onChange={e => setForm({ ...form, location_id: e.target.value })}>
                    {locations.map((l: any) => (
                      <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
                    ))}
                  </TextField>
                  <TextField label="Room" fullWidth value={form.room_number} onChange={e => setForm({ ...form, room_number: e.target.value })} />
                </Stack>
                <Stack direction="row" spacing={1}>
                  <TextField label="Moving in on" type="date" fullWidth InputLabelProps={{ shrink: true }}
                    value={form.admission_date} onChange={e => setForm({ ...form, admission_date: e.target.value })} />
                  <TextField label="Coming from" fullWidth value={form.admission_source} placeholder="For example family home"
                    helperText="Optional" onChange={e => setForm({ ...form, admission_source: e.target.value })} />
                </Stack>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Funding</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {[['la_funded', 'Local authority'], ['nhs_chc', 'NHS / CHC'], ['self_funded', 'Self-funded'], ['mixed', 'Mixed']].map(([v, label]) => (
                      <PillOption key={v} selected={form.funding_type === v} onClick={() => setForm({ ...form, funding_type: form.funding_type === v ? '' : v })}>{label}</PillOption>
                    ))}
                  </Stack>
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Level of support</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {[['minimal', 'Minimal'], ['moderate', 'Moderate'], ['high', 'High'], ['complex', 'Complex']].map(([v, label]) => (
                      <PillOption key={v} selected={form.support_level === v} onClick={() => setForm({ ...form, support_level: form.support_level === v ? '' : v })}>{label}</PillOption>
                    ))}
                  </Stack>
                </Box>
                {form.support_level === 'complex' && (
                  <TextField label="Minimum Staff Required" type="number" inputProps={{ min: 1, max: 6 }}
                    fullWidth required helperText="How many staff are required to support this person safely at all times?"
                    value={form.min_staff_required} onChange={e => setForm({ ...form, min_staff_required: e.target.value })} />
                )}
              </Stack>
            )}
            {wizardStep === 2 && (
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField label="GP surgery" fullWidth value={form.gp_surgery} placeholder="Search for a GP surgery"
                  helperText="Optional" onChange={e => setForm({ ...form, gp_surgery: e.target.value })} />
                <Stack direction="row" spacing={1}>
                  <TextField label="Allergies" fullWidth value={form.allergies} placeholder="e.g. Penicillin"
                    helperText="Optional — separate each allergy with a comma."
                    onChange={e => setForm({ ...form, allergies: e.target.value })} />
                  <TextField label="Dietary needs" fullWidth value={form.dietary_requirements} placeholder="For example diabetic diet"
                    helperText="Optional" onChange={e => setForm({ ...form, dietary_requirements: e.target.value })} />
                </Stack>
                <Stack direction="row" spacing={1}>
                  <TextField label="First language" fullWidth value={form.communication_language} placeholder="e.g. English"
                    helperText="Optional" onChange={e => setForm({ ...form, communication_language: e.target.value })} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Interpreter needed <Typography component="span" variant="caption" color="text.secondary">Optional</Typography></Typography>
                    <Stack direction="row" spacing={1}>
                      <PillOption selected={form.communication_interpreter === false} onClick={() => setForm({ ...form, communication_interpreter: false })}>No</PillOption>
                      <PillOption selected={form.communication_interpreter === true} onClick={() => setForm({ ...form, communication_interpreter: true })}>Yes</PillOption>
                    </Stack>
                  </Box>
                </Stack>
              </Stack>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 1, justifyContent: 'space-between' }}>
            {wizardStep === 0 ? (
              <Button onClick={() => setAddOpen(false)} sx={{ textTransform: 'none', color: theme.palette.text.secondary }}>Cancel</Button>
            ) : (
              <Button onClick={() => { setAttention([]); setWizardStep(s => s - 1) }} sx={{ textTransform: 'none', color: theme.palette.text.secondary }}>Back</Button>
            )}
            {wizardStep < 2 ? (
              <Button variant="contained" onClick={goNext}
                sx={{ textTransform: 'none', bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}>
                Continue
              </Button>
            ) : (
              <Stack direction="row" spacing={1}>
                <Button onClick={handleFinish} disabled={createMutation.isPending} sx={{ textTransform: 'none', color: theme.palette.text.secondary }}>
                  Skip and add person
                </Button>
                <Button type="submit" variant="contained" disabled={createMutation.isPending}
                  sx={{ textTransform: 'none', bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}>
                  {createMutation.isPending ? 'Adding...' : 'Add person'}
                </Button>
              </Stack>
            )}
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
            disabled={bulkStatusMutation.isPending} sx={{ textTransform: 'none', bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}>
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
