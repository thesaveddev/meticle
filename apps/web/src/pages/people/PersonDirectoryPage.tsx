import { useState, useEffect, type ReactNode } from 'react'
import {
  Box, Typography, TextField, Button, Stack, Alert,
  InputAdornment, Dialog, DialogTitle, DialogContent,
  DialogActions, MenuItem, Checkbox, AlertTitle,
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination,
} from '@mui/material'
import {
  Add as AddIcon, Search as SearchIcon,
  WarningAmber as WarningIcon, FavoriteBorder as HeartIcon,
  HomeOutlined as HomeIcon, Schedule as ClockIcon,
  PlaceOutlined as PlaceIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { formatDateOnly } from '../../utils/dateFormat'
import { useSnackbar } from '../../context/SnackbarContext'
import PersonAvatar from '../../components/PersonAvatar'
import FigDialogHeader from './dialogHeader'
import './people.css'

const STATUS_CHIP: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'pl-chip--ok' },
  discharged: { label: 'Discharged', className: 'pl-chip--neutral' },
  deceased: { label: 'Deceased', className: 'pl-chip--danger' },
}

/** Age in whole years, or null when there is no usable date of birth. */
function ageOf(dateOfBirth?: string): number | null {
  if (!dateOfBirth) return null
  const born = new Date(dateOfBirth)
  if (Number.isNaN(born.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - born.getFullYear()
  const monthDelta = today.getMonth() - born.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < born.getDate())) age -= 1
  return age
}

// Pill radio option (Figma 6.7): selected gets the accent border and a check.
function PillOption({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`pl-pill${selected ? ' pl-pill--on' : ''}`}
      onClick={onClick}
    >
      {selected ? '\u2713 ' : ''}{children}
    </button>
  )
}

export default function PersonDirectoryPage() {
  const navigate = useNavigate()
  const { showSnackbar } = useSnackbar()
  const [search, setSearch] = useState('')
  // '' is the "All" tab: the API applies no status filter when it is absent.
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'discharged'>('active')
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

  const visible = users.filter((u: any) => !locationFilter || u.location_id === locationFilter)
  const paginated = visible.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)

  const toggleAll = () => {
    if (selected.size === visible.length) setSelected(new Set())
    else setSelected(new Set(visible.map((u: any) => u.id)))
  }

  const activeCount = allPeople.filter((u: any) => u.status === 'active').length
  const dischargedCount = allPeople.filter((u: any) => u.status === 'discharged').length
  const riskCount = allPeople.filter((u: any) => (u.open_risks || 0) > 0).length
  const carePlanCount = allPeople.reduce((total: number, u: any) => total + (Number(u.active_care_plans) || 0), 0)

  const filtersSet = search !== '' || locationFilter !== ''
  const clearFilters = () => { setSearch(''); setLocationFilter(''); setPage(0) }

  const noun = isDom ? 'clients' : 'people'
  const locationName = (id?: string) => (locations as any[]).find((l: any) => l.id === id)?.name || ''
  const locationCount = new Set(visible.map((u: any) => u.location_id).filter(Boolean)).size

  const tabs: { value: '' | 'active' | 'discharged'; label: string; count: number }[] = [
    { value: 'active', label: 'Active', count: activeCount },
    { value: 'discharged', label: 'Discharged', count: dischargedCount },
    { value: '', label: 'All', count: allPeople.length },
  ]

  const cardTitle = filtersSet
    ? 'Search results'
    : statusFilter === 'active' ? (isDom ? 'Active clients' : 'Active people')
    : statusFilter === 'discharged' ? 'Discharged'
    : 'Everyone'
  const cardCopy = statusFilter === 'active'
    ? `${visible.length} ${noun}${locationCount > 0 ? ` · ${locationCount} ${locationCount === 1 ? 'location' : 'locations'}` : ''}`
    : statusFilter === 'discharged'
      ? `${visible.length} ${noun}`
      : `${visible.length} ${noun} · active and discharged, by name`

  const metrics = [
    {
      label: isDom ? 'Active clients' : 'Active',
      value: activeCount,
      detail: isDom ? 'Clients supported now' : 'People supported now',
      icon: <HeartIcon fontSize="small" />,
      danger: false,
    },
    {
      label: 'Discharged',
      value: dischargedCount,
      detail: 'In the last 12 months',
      icon: <HomeIcon fontSize="small" />,
      danger: false,
    },
    {
      label: 'Open risks',
      value: riskCount,
      detail: riskCount > 0 ? `Across ${riskCount} ${riskCount === 1 ? 'person' : 'people'}` : 'No one has a high or critical risk',
      icon: <WarningIcon fontSize="small" />,
      danger: riskCount > 0,
    },
    {
      label: 'Care plans',
      value: carePlanCount,
      detail: 'Active plans across everyone',
      icon: <ClockIcon fontSize="small" />,
      danger: false,
    },
  ]

  const renderEmpty = () => {
    if (filtersSet) {
      return (
        <div className="pl-empty">
          <span className="pl-empty__icon"><SearchIcon /></span>
          <Typography className="pl-empty__title">
            No one matches {search ? `\u201c${search}\u201d` : 'these filters'}
          </Typography>
          <Typography className="pl-empty__copy">
            Check the spelling, or search by room number instead. You can also clear the search to see everyone.
          </Typography>
          <Button variant="outlined" className="pl-button pl-button--quiet pl-empty__action" onClick={clearFilters}>
            Clear search
          </Button>
        </div>
      )
    }
    if (statusFilter === 'discharged') {
      return (
        <div className="pl-empty">
          <span className="pl-empty__icon"><HomeIcon /></span>
          <Typography className="pl-empty__title">No one has been discharged</Typography>
          <Typography className="pl-empty__copy">
            When someone moves on, their record is kept here — read-only, with their discharge summary.
          </Typography>
        </div>
      )
    }
    return (
      <div className="pl-empty">
        <span className="pl-empty__icon"><HeartIcon /></span>
        <Typography className="pl-empty__title">No people yet</Typography>
        <Typography className="pl-empty__copy">
          {isDom ? 'Add your first client to get started.' : 'Add the first person you support to get started.'}
        </Typography>
        <Button variant="contained" className="pl-button pl-button--primary pl-empty__action" startIcon={<AddIcon />} onClick={openWizard}>
          Add person
        </Button>
      </div>
    )
  }

  return (
    <Box className="people-page">
      <Typography className="pl-crumbs">{isDom ? 'Care / Clients' : 'Care / People'}</Typography>

      <header className="pl-header">
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h1" className="pl-header__title">{isDom ? 'Clients' : 'People'}</Typography>
          <Typography className="pl-header__copy">
            {isDom ? 'Manage clients, care plans and visit records' : 'Manage the people you support, their care plans and support levels.'}
          </Typography>
        </Box>
        <Box className="pl-header__actions">
          {selected.size > 0 && (
            <>
              <Button variant="outlined" className="pl-button pl-button--quiet" onClick={() => { setBulkOpen('status'); setBulkStatus('active') }}>
                Change status ({selected.size})
              </Button>
              <Button variant="outlined" color="error" className="pl-button" onClick={() => setBulkOpen('discharge')}>
                Discharge ({selected.size})
              </Button>
            </>
          )}
          <TextField
            select
            size="small"
            className="pl-select"
            value={locationFilter}
            onChange={e => { setLocationFilter(e.target.value); setPage(0) }}
            inputProps={{ 'aria-label': 'Filter by location' }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><PlaceIcon /></InputAdornment>,
            }}
          >
            <MenuItem value="">All locations</MenuItem>
            {(locations as any[]).map((l: any) => (
              <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
            ))}
          </TextField>
          <Button variant="contained" className="pl-button pl-button--primary" startIcon={<AddIcon />} onClick={openWizard}>
            Add person
          </Button>
        </Box>
      </header>

      <nav className="pl-tabs" aria-label="Filter by status">
        {tabs.map(tab => (
          <button
            key={tab.value || 'all'}
            type="button"
            className={`pl-tab${statusFilter === tab.value ? ' pl-tab--active' : ''}`}
            aria-pressed={statusFilter === tab.value}
            onClick={() => { setStatusFilter(tab.value); setSelected(new Set()); setPage(0) }}
          >
            {tab.label}
            <span className="pl-tab__count" aria-hidden="true">{tab.count}</span>
          </button>
        ))}
      </nav>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
          {(error as any).response?.data?.message || 'Failed to load people'}
        </Alert>
      )}

      <section className="pl-metrics" aria-label="Summary">
        {metrics.map(metric => (
          <div className="pl-metric" key={metric.label}>
            <div className="pl-metric__top">
              <Typography className="pl-metric__label">{metric.label}</Typography>
              <span className={`pl-metric__icon${metric.danger ? ' pl-metric__icon--danger' : ''}`}>{metric.icon}</span>
            </div>
            <Typography className={`pl-metric__value${metric.danger ? ' pl-metric__value--danger' : ''}`}>{metric.value}</Typography>
            <Typography className="pl-metric__detail">{metric.detail}</Typography>
          </div>
        ))}
      </section>

      <section className="pl-card">
        <div className="pl-card__head">
          <Typography component="h2" className="pl-card__title">{cardTitle}</Typography>
          <Typography className="pl-card__copy">
            {filtersSet && search ? `Searching names and rooms · ${cardCopy}` : cardCopy}
          </Typography>
        </div>

        <div className="pl-filters">
          <TextField
            size="small"
            className="pl-search"
            placeholder="Search by name or room..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            inputProps={{ 'aria-label': 'Search by name or room' }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment>,
            }}
          />
          <TextField
            select
            size="small"
            className="pl-select"
            value={locationFilter}
            onChange={e => { setLocationFilter(e.target.value); setPage(0) }}
            inputProps={{ 'aria-label': 'Filter by location' }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><PlaceIcon /></InputAdornment>,
            }}
          >
            <MenuItem value="">All locations</MenuItem>
            {(locations as any[]).map((l: any) => (
              <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
            ))}
          </TextField>
          {filtersSet && (
            <Button className="pl-clear" onClick={clearFilters}>Clear</Button>
          )}
        </div>

        {!isLoading && (
          <div className="pl-tablewrap">
            {visible.length === 0 ? (
              renderEmpty()
            ) : (
              <>
                <TableContainer>
                  <Table className="pl-table">
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox" className="pl-col-check">
                          <Checkbox
                            checked={selected.size === visible.length && visible.length > 0}
                            indeterminate={selected.size > 0 && selected.size < visible.length}
                            onChange={toggleAll}
                            inputProps={{ 'aria-label': 'Select everyone on this page' }}
                          />
                        </TableCell>
                        <TableCell className="pl-col-person">Person</TableCell>
                        <TableCell className="pl-col-dob">Date of birth · age</TableCell>
                        <TableCell className="pl-col-nhs">NHS number</TableCell>
                        <TableCell align="right" className="pl-col-plans">Care plans</TableCell>
                        <TableCell className="pl-col-risks">Risks</TableCell>
                        <TableCell className="pl-col-status">Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginated.map((u: any) => {
                        const chip = STATUS_CHIP[u.status] || { label: u.status || 'Unknown', className: 'pl-chip--neutral' }
                        const age = ageOf(u.date_of_birth)
                        const dob = u.date_of_birth ? `${formatDateOnly(u.date_of_birth)}${age !== null ? ` · ${age}` : ''}` : ''
                        const risks = Number(u.open_risks) || 0
                        const place = [u.room_number ? `Room ${u.room_number}` : '', locationName(u.location_id)].filter(Boolean).join(' · ')
                        return (
                          <TableRow
                            key={u.id}
                            hover
                            className="pl-row"
                            selected={selected.has(u.id)}
                            tabIndex={0}
                            onClick={() => navigate(`/people/${u.id}`)}
                            onKeyDown={event => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                navigate(`/people/${u.id}`)
                              }
                            }}
                          >
                            <TableCell padding="checkbox" className="pl-col-check" onClick={e => e.stopPropagation()}>
                              <Checkbox
                                checked={selected.has(u.id)}
                                onChange={() => toggleSelect(u.id)}
                                inputProps={{ 'aria-label': `Select ${u.first_name} ${u.last_name}` }}
                              />
                            </TableCell>
                            <TableCell className="pl-col-person">
                              <div className="pl-person">
                                <PersonAvatar
                                  photoUrl={u.photo_url}
                                  name={`${u.first_name} ${u.last_name}`}
                                  className="pl-person__avatar"
                                />
                                <div style={{ minWidth: 0 }}>
                                  <div className="pl-person__name">{u.first_name} {u.last_name}</div>
                                  <div className="pl-person__meta">{place || 'No room recorded'}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className={`pl-col-dob${dob ? '' : ' pl-muted'}`}>{dob || 'Not recorded'}</TableCell>
                            <TableCell className={`pl-col-nhs pl-nhs${u.nhs_number ? '' : ' pl-muted'}`}>
                              {u.nhs_number || 'Not recorded'}
                            </TableCell>
                            <TableCell align="right" className="pl-col-plans pl-num">
                              {Number(u.active_care_plans) || 0}
                            </TableCell>
                            <TableCell className="pl-col-risks">
                              <span className={`pl-chip ${risks > 0 ? 'pl-chip--danger' : 'pl-chip--neutral'}`}>
                                {risks > 0 ? `${risks} open` : 'None'}
                              </span>
                            </TableCell>
                            <TableCell className="pl-col-status">
                              <span className="pl-statusstack">
                                <span className={`pl-chip ${chip.className}`}>{chip.label}</span>
                                {u.status === 'discharged' && u.discharge_date && (
                                  <span className="pl-statusstack__date">{formatDateOnly(u.discharge_date)}</span>
                                )}
                              </span>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  component="div"
                  className="pl-pagination"
                  count={visible.length}
                  page={page}
                  onPageChange={(_, next) => setPage(next)}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0) }}
                  rowsPerPageOptions={[5, 10, 25, 50]}
                  labelRowsPerPage="Rows per page"
                  labelDisplayedRows={({ from, to, count }) => `Showing ${from}–${to} of ${count !== -1 ? count : `more than ${to}`}`}
                />
              </>
            )}
          </div>
        )}
      </section>

      {/* ── Add person wizard (Figma 6.7): three steps, only the first is required. ── */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth className="pl-dialog">
        <Box component="form" onSubmit={handleFinish}>
          <FigDialogHeader
            eyebrow={isDom ? 'CARE / CLIENTS' : 'CARE / PEOPLE'}
            title="Add a person"
            subtitle="Only the first step is needed now. You can fill in the rest later."
            onClose={() => setAddOpen(false)}
          />
          <DialogContent>
            <div className="pl-steps">
              {['About them', "Where they'll live", 'Health & contacts'].map((label, i) => (
                <div
                  key={label}
                  className="pl-step"
                  onClick={() => { if (i < wizardStep) { setAttention([]); setWizardStep(i) } }}
                >
                  <span className={`pl-step__bar${i <= wizardStep ? ' pl-step__bar--on' : ''}`} />
                  <Typography className={`pl-step__label${i === wizardStep ? ' pl-step__label--on' : ''}`}>
                    {i + 1} · {label}
                  </Typography>
                </div>
              ))}
            </div>
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
                  <Typography className="pl-field-label">Gender</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {['Male', 'Female', 'Non-binary', 'Prefer not to say'].map(g => (
                      <PillOption key={g} selected={form.gender === g} onClick={() => setForm({ ...form, gender: form.gender === g ? '' : g })}>{g}</PillOption>
                    ))}
                  </Stack>
                </Box>
                <TextField label="Pronouns" fullWidth value={form.pronouns} placeholder="For example he / him"
                  helperText="Optional"
                  onChange={e => setForm({ ...form, pronouns: e.target.value })} />
              </Stack>
            )}
            {wizardStep === 1 && (
              <Stack spacing={2} sx={{ mt: 1 }}>
                <Stack direction="row" spacing={1}>
                  <TextField select label="Location" fullWidth required value={form.location_id}
                    error={attention.includes('a location')} helperText={attention.includes('a location') ? "Choose where they'll live" : ''}
                    onChange={e => setForm({ ...form, location_id: e.target.value })}>
                    {(locations as any[]).map((l: any) => (
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
                  <Typography className="pl-field-label">Funding</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {[['la_funded', 'Local authority'], ['nhs_chc', 'NHS / CHC'], ['self_funded', 'Self-funded'], ['mixed', 'Mixed']].map(([v, label]) => (
                      <PillOption key={v} selected={form.funding_type === v} onClick={() => setForm({ ...form, funding_type: form.funding_type === v ? '' : v })}>{label}</PillOption>
                    ))}
                  </Stack>
                </Box>
                <Box>
                  <Typography className="pl-field-label">Level of support</Typography>
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
                    <Typography className="pl-field-label">Interpreter needed <Typography component="span" className="pl-field-hint">Optional</Typography></Typography>
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
              <Button onClick={() => setAddOpen(false)} className="pl-dialog__cancel">Cancel</Button>
            ) : (
              <Button onClick={() => { setAttention([]); setWizardStep(s => s - 1) }} className="pl-dialog__cancel">Back</Button>
            )}
            {wizardStep < 2 ? (
              <Button variant="contained" onClick={goNext} className="pl-button pl-button--primary">Continue</Button>
            ) : (
              <Stack direction="row" spacing={1}>
                <Button onClick={handleFinish} disabled={createMutation.isPending} className="pl-dialog__cancel">
                  Skip and add person
                </Button>
                <Button type="submit" variant="contained" disabled={createMutation.isPending} className="pl-button pl-button--primary">
                  {createMutation.isPending ? 'Adding...' : 'Add person'}
                </Button>
              </Stack>
            )}
          </DialogActions>
        </Box>
      </Dialog>

      {/* ── Bulk status ── */}
      <Dialog open={bulkOpen === 'status'} onClose={() => setBulkOpen(null)} maxWidth="xs" fullWidth className="pl-dialog">
        <DialogTitle sx={{ fontWeight: 700 }}>Change status ({selected.size} people)</DialogTitle>
        <DialogContent>
          <TextField select label="New status" fullWidth value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} sx={{ mt: 1 }}>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="discharged">Discharged</MenuItem>
            <MenuItem value="deceased">Deceased</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setBulkOpen(null)} className="pl-dialog__cancel">Cancel</Button>
          <Button variant="contained" onClick={() => bulkStatusMutation.mutate({ ids: Array.from(selected), status: bulkStatus })}
            disabled={bulkStatusMutation.isPending} className="pl-button pl-button--primary">
            {bulkStatusMutation.isPending ? 'Updating...' : 'Apply'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Bulk discharge ── */}
      <Dialog open={bulkOpen === 'discharge'} onClose={() => setBulkOpen(null)} maxWidth="xs" fullWidth className="pl-dialog">
        <DialogTitle sx={{ fontWeight: 700 }}>Discharge {selected.size} people?</DialogTitle>
        <DialogContent>
          <Typography className="pl-dialog__note">
            This will mark the selected people as discharged. The action can be reversed later.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setBulkOpen(null)} className="pl-dialog__cancel">Cancel</Button>
          <Button variant="contained" color="error" onClick={() => bulkDischargeMutation.mutate(Array.from(selected))}
            disabled={bulkDischargeMutation.isPending} className="pl-button">
            {bulkDischargeMutation.isPending ? 'Discharging...' : 'Confirm discharge'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
