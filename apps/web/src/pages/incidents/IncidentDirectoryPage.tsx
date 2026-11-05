import { useState, useEffect } from 'react'
import {
  Box, Typography, Paper, Stack, Chip, Button, TextField, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions, InputAdornment, Select, FormControl, InputLabel,
  Divider,
} from '@mui/material'
import PageContainer from '../../components/design/PageContainer'
import {
  Add as AddIcon, Search as SearchIcon,
  Lock as LockIcon, LockOpen as LockOpenIcon,
  ReportProblem as AlertIcon, Security as ShieldIcon, CheckCircleOutline as CheckIcon,
  Flag as FlagIcon, Description as DocIcon, ChevronRight as CaretIcon,
  AccessTime as ClockIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { PageHeader, StatusBadge, EmptyRow, NAVY } from '../../components/ui'
import { localToday } from '../../utils/dateFormat'
import { useSnackbar } from '../../context/SnackbarContext'

const SEVERITY_TONE: Record<string, 'success' | 'warning' | 'error' | 'purple' | 'info' | 'neutral'> = {
  low: 'neutral', medium: 'info', high: 'error', critical: 'error',
}
const STATUS_TONE: Record<string, 'warning' | 'info' | 'success' | 'neutral' | 'error'> = {
  draft: 'neutral', reported: 'error', submitted: 'info', triaging: 'info',
  investigating: 'info', actioning: 'info', verifying: 'info',
  resolved: 'success', closed: 'neutral', reopened: 'warning',
}

export default function IncidentDirectoryPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()
  const currentUser = (() => { const s = localStorage.getItem('user'); try { const p = s ? JSON.parse(s) : {}; return p && typeof p === 'object' ? p : {} } catch { return {} } })()
  const isOrgAdmin = currentUser.role === 'ORG_ADMIN'
  const [search, setSearch] = useState('')
  const [statusGroup, setStatusGroup] = useState<'all' | 'open' | 'submitted' | 'resolved'>('all')
  const [severityFilter, setSeverityFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [nearMissFilter, setNearMissFilter] = useState('')
  const [datePreset, setDatePreset] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [error, setError] = useState('')
  const [formAnswers, setFormAnswers] = useState<Record<string, any>>({})
  const [answersError, setAnswersError] = useState('')
  const [form, setForm] = useState({ title: '', description: '', category_id: '', incident_date: localToday(), incident_time: '', location: '', severity: 'medium', is_cqc_reportable: false, is_near_miss: false, is_confidential: false })
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  // Single date preset maps onto the server's from/to range; empty = any date.
  const todayKey = localToday()
  const dateRange = (() => {
    if (datePreset === 'today') return { from: todayKey, to: todayKey }
    if (datePreset === 'week') {
      const d = new Date(`${todayKey}T12:00:00`)
      d.setDate(d.getDate() - 6)
      return { from: d.toISOString().slice(0, 10), to: todayKey }
    }
    if (datePreset === 'month') return { from: todayKey.slice(0, 7) + '-01', to: todayKey }
    return { from: '', to: '' }
  })()

  const { data: incidents, isLoading } = useQuery({
    queryKey: ['incidents', severityFilter, categoryFilter, nearMissFilter, dateRange.from, dateRange.to],
    queryFn: () => api.get('/incidents', { params: {
      severity: severityFilter || undefined,
      category_id: categoryFilter || undefined, is_near_miss: nearMissFilter || undefined,
      date_from: dateRange.from || undefined, date_to: dateRange.to || undefined,
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

  // Published reporting form: the server re-validates everything on submit,
  // so this renders the current fields flat and lets the engine decide the
  // triage. If the form is unreachable the core report still files.
  const { data: reportFormDef } = useQuery({
    queryKey: ['incident-form-general'],
    queryFn: () => api.get('/incident-forms/general').then(r => r.data),
    enabled: addOpen,
    retry: false,
  })
  const reportFields: any[] = Array.isArray(reportFormDef?.fields) ? reportFormDef.fields : []
  const setAnswer = (key: string, value: any) => setFormAnswers(prev => ({ ...prev, [key]: value }))
  const renderReportField = (f: any) => {
    const value = formAnswers[f.field_key]
    const label = `${f.label}${f.required ? ' *' : ''}`
    const onText = (e: any) => setAnswer(f.field_key, e.target.value)
    switch (f.type) {
      case 'textarea':
        return <TextField fullWidth label={label} helperText={f.help || undefined} multiline rows={3} value={value ?? ''} onChange={onText} />
      case 'number':
        return <TextField fullWidth label={label} helperText={f.help || undefined} type="number" value={value ?? ''} onChange={e => setAnswer(f.field_key, e.target.value === '' ? '' : Number(e.target.value))} />
      case 'date':
        return <TextField fullWidth label={label} helperText={f.help || undefined} type="date" InputLabelProps={{ shrink: true }} value={value ?? ''} onChange={onText} />
      case 'datetime':
        return <TextField fullWidth label={label} helperText={f.help || undefined} type="datetime-local" InputLabelProps={{ shrink: true }} value={value ?? ''} onChange={onText} />
      case 'select':
      case 'radio':
        return (
          <TextField fullWidth select label={label} helperText={f.help || undefined} value={value ?? ''} onChange={onText}>
            {((Array.isArray(f.options) ? f.options : []) as any[]).map((o: any) => (
              <MenuItem key={String(o)} value={o}>{String(o)}</MenuItem>
            ))}
          </TextField>
        )
      case 'boolean':
        return (
          <TextField fullWidth select label={label} helperText={f.help || undefined}
            value={value === undefined || value === '' ? '' : value ? 'yes' : 'no'}
            onChange={e => setAnswer(f.field_key, e.target.value === 'yes')}>
            <MenuItem value="yes">Yes</MenuItem>
            <MenuItem value="no">No</MenuItem>
          </TextField>
        )
      default:
        return <TextField fullWidth label={label} helperText={f.help || undefined} value={value ?? ''} onChange={onText} />
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/incidents', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
      queryClient.invalidateQueries({ queryKey: ['incident-stats'] })
      setAddOpen(false)
      setForm({ title: '', description: '', category_id: '', incident_date: localToday(), incident_time: '', location: '', severity: 'medium', is_cqc_reportable: false, is_near_miss: false, is_confidential: false })
      setFormAnswers({})
      setAnswersError('')
      // Figma 9: reporting confirms with a toast — what happened, then what happens next.
      showSnackbar('Thank you — the incident has been logged.', 'success', 'Incident reported')
    },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to create incident'),
  })

  const incidentRows = Array.isArray(incidents) ? incidents : incidents?.incidents || incidents?.data || []
  const categoryRows = Array.isArray(categories) ? categories : categories?.categories || categories?.data || []
  // Status groups: Submitted is its own lane — it does not count as open
  // (and a submitted high-severity incident does not light up Critical & High).
  const groupOf = (status: string) =>
    status === 'submitted' ? 'submitted'
    : (status === 'resolved' || status === 'closed') ? 'resolved' : 'open'
  const locationOptions = Array.from(new Set(incidentRows.map((i: any) => i.location).filter(Boolean))).sort()
  const inGroup = incidentRows.filter((i: any) =>
    !locationFilter || i.location === locationFilter
  )
  const groupCounts = {
    all: inGroup.length,
    open: inGroup.filter((i: any) => groupOf(i.status) === 'open').length,
    submitted: inGroup.filter((i: any) => groupOf(i.status) === 'submitted').length,
    resolved: inGroup.filter((i: any) => groupOf(i.status) === 'resolved').length,
  }
  const filtered = inGroup.filter((i: any) =>
    (statusGroup === 'all' || groupOf(i.status) === statusGroup) &&
    (!search || i.title?.toLowerCase().includes(search.toLowerCase()) || i.location?.toLowerCase().includes(search.toLowerCase()))
  )
  // Oldest reported incident still waiting for triage drives the banner.
  const awaitingTriage = [...inGroup]
    .filter((i: any) => i.status === 'reported')
    .sort((a: any, b: any) => String(a.incident_date).localeCompare(String(b.incident_date)))[0]
  const triageWaitDays = awaitingTriage
    ? Math.max(0, Math.floor((new Date(`${todayKey}T12:00:00`).getTime() - new Date(`${String(awaitingTriage.incident_date).slice(0, 10)}T12:00:00`).getTime()) / 86400000))
    : 0
  const paginated = filtered?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage) || []
  useEffect(() => { setPage(0) }, [search, statusGroup, severityFilter, categoryFilter, nearMissFilter, datePreset, locationFilter])

  const activeFilterCount = [severityFilter, categoryFilter, nearMissFilter, datePreset, locationFilter].filter(Boolean).length

  return (
    <PageContainer>

      <Typography variant="caption" sx={{ color: '#0164C8', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Compliance & Safety</Typography>
      <PageHeader
        title="Incidents"
        subtitle={`${stats?.total ?? 0} total · ${stats?.open_actions ?? 0} open actions`}
        actions={
          <>
            <TextField select size="small" value={locationFilter}
              onChange={e => setLocationFilter(e.target.value)} aria-label="Filter by location"
              sx={{ minWidth: 140, bgcolor: '#fff', '& .MuiOutlinedInput-root': { borderRadius: 6 } }}>
              <MenuItem value="">All locations</MenuItem>
              {(locationOptions as string[]).map((l: string) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
            </TextField>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}
              sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 600 }}>Report Incident</Button>
          </>
        }
      />

      {/* Triage banner — oldest reported incident nobody has picked up yet */}
      {awaitingTriage && (
        <Paper sx={{ mb: 3, p: 2, borderRadius: 2, bgcolor: '#FDEDED', borderLeft: '4px solid #EF4444' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: '#EF4444', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <ClockIcon fontSize="small" />
              </Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  1 incident has been waiting {triageWaitDays} day{triageWaitDays === 1 ? '' : 's'} for triage
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {awaitingTriage.title} · {awaitingTriage.category_name || 'No category'} · reported {new Date(awaitingTriage.incident_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}. Nobody has been assigned to investigate it yet.
                </Typography>
              </Box>
            </Stack>
            <Button size="small" variant="contained" onClick={() => navigate(`/incidents/${awaitingTriage.id}`)}
              sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2, flexShrink: 0 }}>
              Submit for triage →
            </Button>
          </Stack>
        </Paper>
      )}

      {/* Stats — 5 focused cards */}
      {stats && (() => {
        const openCount = (stats.reported || 0) + (stats.investigating || 0)
        const critHigh = stats.open_critical_high ?? 0
        const cards = [
          { label: 'Open', value: openCount, detail: `${stats.reported || 0} reported · ${stats.investigating || 0} investigating`, icon: <AlertIcon fontSize="small" />, tint: openCount > 0 ? 'notice.error.bg' : '#F0F5FC', color: openCount > 0 ? '#EF4444' : '#51637A', accent: openCount > 0 ? '4px solid #EF4444' : undefined },
          { label: 'Critical & high', value: critHigh, detail: 'Open at critical or high', icon: <ShieldIcon fontSize="small" />, tint: '#F0F5FC', color: '#51637A' },
          { label: 'Open actions', value: stats.open_actions || 0, detail: 'Follow-ups not done', icon: <CheckIcon fontSize="small" />, tint: '#F0F5FC', color: '#51637A' },
          { label: 'Near misses', value: stats.near_misses || 0, detail: 'Logged this period', icon: <FlagIcon fontSize="small" />, tint: '#F0F5FC', color: '#51637A' },
          { label: 'Total', value: stats.total || 0, detail: 'All incidents', icon: <DocIcon fontSize="small" />, tint: '#F0F5FC', color: '#51637A' },
        ]
        return (
          <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap', gap: 2 }}>
            {cards.map(card => (
              <Paper key={card.label} sx={{ flex: '1 1 160px', p: 2, borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0', ...(card.accent ? { borderLeft: card.accent } : {}) }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>{card.label}</Typography>
                  <Box sx={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: '50%', bgcolor: card.tint, color: card.color }}>{card.icon}</Box>
                </Stack>
                <Typography variant="h4" sx={{ mt: 0.5, fontWeight: 600, lineHeight: 1.1, color: card.label === 'Open' && openCount > 0 ? '#EF4444' : 'text.primary' }}>{card.value}</Typography>
                <Typography variant="caption" color="text.secondary">{card.detail}</Typography>
                {card.label === 'Open actions' && stats.overdue_actions > 0 && (
                  <Chip label={`${stats.overdue_actions} overdue`} size="small"
                    sx={{ mt: 1, bgcolor: 'notice.error.bg', color: 'notice.error.fg', fontWeight: 600, fontSize: 11, height: 22 }} />
                )}
                {card.label === 'Near misses' && stats.pending_cqc > 0 && (
                  <Chip label={`${stats.pending_cqc} pending CQC`} size="small"
                    sx={{ mt: 1, bgcolor: 'notice.muted.bg', color: NAVY, fontWeight: 600, fontSize: 11, height: 22 }} />
                )}
              </Paper>
            ))}
          </Stack>
        )
      })()}

      {/* Status pills + filters */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0' }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
          {([
            { key: 'all', label: `All ${groupCounts.all}` },
            { key: 'open', label: `Open ${groupCounts.open}` },
            { key: 'submitted', label: `Submitted ${groupCounts.submitted}` },
            { key: 'resolved', label: `Resolved ${groupCounts.resolved}` },
          ] as const).map(pill => (
            <Chip key={pill.key} label={pill.label} size="small" onClick={() => setStatusGroup(pill.key)}
              sx={statusGroup === pill.key
                ? { bgcolor: 'text.primary', color: '#fff', fontWeight: 600 }
                : { bgcolor: '#F0F5FC', color: 'text.secondary', fontWeight: 600, '&:hover': { bgcolor: '#E3E9F0' } }} />
          ))}
        </Stack>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
          <TextField size="small" placeholder="Search incidents..." value={search} onChange={e => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            sx={{ minWidth: 200 }} />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Severity</InputLabel>
            <Select value={severityFilter} label="Severity" onChange={e => setSeverityFilter(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="critical">Critical</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Category</InputLabel>
            <Select value={categoryFilter} label="Category" onChange={e => setCategoryFilter(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {categoryRows.map((c: any) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 110 }}>
            <InputLabel>Type</InputLabel>
            <Select value={nearMissFilter} label="Type" onChange={e => setNearMissFilter(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="false">Incidents</MenuItem>
              <MenuItem value="true">Near Misses</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Any date</InputLabel>
            <Select value={datePreset} label="Any date" onChange={e => setDatePreset(e.target.value)}>
              <MenuItem value="">Any date</MenuItem>
              <MenuItem value="today">Today</MenuItem>
              <MenuItem value="week">This week</MenuItem>
              <MenuItem value="month">This month</MenuItem>
            </Select>
          </FormControl>
          {activeFilterCount > 0 && (
            <Button size="small" onClick={() => { setSeverityFilter(''); setCategoryFilter(''); setNearMissFilter(''); setDatePreset(''); setLocationFilter('') }}
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
        <>
        <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0', display: { xs: 'none', md: 'block' } }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'none', letterSpacing: '0.05em' }}>Incident</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'none', letterSpacing: '0.05em' }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'none', letterSpacing: '0.05em' }}>Severity</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'none', letterSpacing: '0.05em' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'none', letterSpacing: '0.05em' }}>Location</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'none', letterSpacing: '0.05em' }} align="right">Actions</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'none', letterSpacing: '0.05em' }}>CQC</TableCell>
                <TableCell sx={{ width: 32 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8}><EmptyRow message="No incidents match your search" /></TableCell></TableRow>
              ) : paginated.map((i: any) => {
                const ageDays = Math.max(0, Math.floor((new Date(`${todayKey}T12:00:00`).getTime() - new Date(`${String(i.incident_date).slice(0, 10)}T12:00:00`).getTime()) / 86400000))
                const isOpen = groupOf(i.status) === 'open'
                return (
                <TableRow key={i.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/incidents/${i.id}`)}>
                  <TableCell sx={i.status === 'reported' ? { borderLeft: '3px solid #EF4444' } : undefined}>
                    <Typography variant="body2" fontWeight={600}>{i.title}</Typography>
                    <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                      {i.category_name && <Typography variant="caption" color="text.secondary">{i.category_name}</Typography>}
                      {i.is_near_miss && <Chip label="Near Miss" size="small" sx={{ bgcolor: 'notice.subtle.bg', color: '#8B7CF6', fontWeight: 600, fontSize: 10, height: 20 }} />}
                      {i.is_confidential && <Chip icon={<LockIcon sx={{ fontSize: 12 }} />} label="Confidential" size="small" sx={{ bgcolor: 'notice.muted.bg', color: 'text.primary', fontWeight: 600, fontSize: 10, height: 20 }} />}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{new Date(i.incident_date).toLocaleDateString('en-GB')}</Typography>
                    {isOpen && ageDays > 0 && (
                      <Typography variant="caption" sx={{ color: ageDays > 30 ? '#EF4444' : 'text.secondary' }}>
                        {ageDays} day{ageDays === 1 ? '' : 's'} open
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge label={i.severity} tone={SEVERITY_TONE[i.severity] || 'neutral'} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge label={i.status} tone={STATUS_TONE[i.status] || 'neutral'} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">{i.location || 'Not set'}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" color="text.secondary">{i.open_actions || 0}</Typography>
                  </TableCell>
                  <TableCell>
                    {i.is_cqc_reportable ? (
                      <StatusBadge label="CQC" tone="error" />
                    ) : (
                      <Typography variant="caption" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ pr: 1 }}><CaretIcon fontSize="small" sx={{ color: 'text.disabled', verticalAlign: 'middle' }} /></TableCell>
                </TableRow>
              )})}
            </TableBody>
          </Table>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5, borderTop: '1px solid #E3E9F0' }}>
            <Typography variant="caption" color="text.secondary">
              Showing {filtered.length === 0 ? 0 : page * rowsPerPage + 1}–{Math.min(filtered.length, (page + 1) * rowsPerPage)} of {filtered.length} · {statusGroup === 'all' ? 'All' : statusGroup[0].toUpperCase() + statusGroup.slice(1)}
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="caption" color="text.secondary">Rows per page:</Typography>
              <Select size="small" variant="standard" value={rowsPerPage}
                onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(0) }}
                sx={{ fontSize: '0.75rem' }}>
                {[5, 10, 25, 50].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
              </Select>
              <Button size="small" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))} sx={{ minWidth: 0, textTransform: 'none' }}>‹</Button>
              <Button size="small" disabled={(page + 1) * rowsPerPage >= filtered.length} onClick={() => setPage(p => p + 1)} sx={{ minWidth: 0, textTransform: 'none' }}>›</Button>
            </Stack>
          </Box>
        </TableContainer>
        <Paper sx={{ display: { xs: 'block', md: 'none' }, borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0', overflow: 'hidden' }}>
          {paginated.map((i: any, idx: number) => {
            const ageDays = Math.max(0, Math.floor((new Date(`${todayKey}T12:00:00`).getTime() - new Date(`${String(i.incident_date).slice(0, 10)}T12:00:00`).getTime()) / 86400000))
            const isOpen = groupOf(i.status) === 'open'
            return (
              <Box key={i.id} onClick={() => navigate(`/incidents/${i.id}`)}
                sx={{ p: 2, cursor: 'pointer', ...(i.status === 'reported' ? { borderLeft: '3px solid #EF4444' } : {}), ...(idx < paginated.length - 1 ? { borderBottom: '1px solid #E3E9F0' } : {}) }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{i.title}</Typography>
                    <Typography variant="caption" color="text.secondary">{i.category_name || 'No category'}</Typography>
                  </Box>
                  <CaretIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                </Stack>
                <Typography variant="caption" sx={{ color: isOpen && ageDays > 0 ? '#EF4444' : 'text.secondary', display: 'block', mt: 0.5 }}>
                  {new Date(i.incident_date).toLocaleDateString('en-GB')}{isOpen && ageDays > 0 ? ` · ${ageDays} day${ageDays === 1 ? '' : 's'} open` : ''}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <StatusBadge label={i.severity} tone={SEVERITY_TONE[i.severity] || 'neutral'} />
                  <StatusBadge label={i.status} tone={STATUS_TONE[i.status] || 'neutral'} />
                </Stack>
              </Box>
            )
          })}
        </Paper>
        </>
      )}

      {/* Report Incident Dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => {
          e.preventDefault()
          const missing = reportFields.filter((f: any) => f.required && (formAnswers[f.field_key] === undefined || formAnswers[f.field_key] === '' || formAnswers[f.field_key] === null))
          if (missing.length > 0) { setAnswersError(`Please complete: ${missing.map((f: any) => f.label).join(', ')}`); return }
          setAnswersError('')
          createMutation.mutate({ ...form, form_key: 'general', form_answers: formAnswers })
        }}>
          <DialogTitle sx={{ fontWeight: 600 }}>Report Incident</DialogTitle>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {answersError && <Alert severity="error" sx={{ mb: 2 }}>{answersError}</Alert>}
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
              {reportFields.length > 0 && (
                <>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle2" fontWeight={600}>Report details</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    From the current reporting form — drives the severity assessment.
                  </Typography>
                  {(() => {
                    let lastSection = ''
                    return reportFields.map((f: any) => {
                      const showSection = f.section && f.section !== lastSection
                      if (f.section) lastSection = f.section
                      return (
                        <Box key={f.field_key} sx={{ mt: 1 }}>
                          {showSection && (
                            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'none', letterSpacing: '0.05em' }}>{f.section}</Typography>
                          )}
                          <Box sx={{ mt: 0.5 }}>{renderReportField(f)}</Box>
                        </Box>
                      )
                    })
                  })()}
                </>
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setAddOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={createMutation.isPending}
              sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 600 }}>
              {createMutation.isPending ? <CircularProgress size={20} /> : 'Report Incident'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </PageContainer>
  )
}

function LoadingState() {
  return (
    <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0' }}>
      <CircularProgress size={28} sx={{ color: NAVY }} />
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Loading incidents...</Typography>
    </Paper>
  )
}
