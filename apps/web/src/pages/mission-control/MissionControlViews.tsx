import { useMemo, useState } from 'react'
import {
  AccessTime as CallsIcon,
  AssignmentLate as CarePlanIcon,
  CalendarMonth as CalendarIcon,
  CheckCircle as CompletedIcon,
  Description as DocumentIcon,
  ErrorOutline as IncidentIcon,
  Group as StaffIcon,
  Medication as MedicationIcon,
  PersonOff as UnassignedIcon,
  School as TrainingIcon,
  Shield as ComplianceIcon,
  ChevronRight as NextIcon,
  Search as SearchIcon,
  Today as TodayIcon,
} from '@mui/icons-material'
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, InputAdornment, LinearProgress, Paper,
  Skeleton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Card, SectionError } from '../../components/ui'
import api from '../../services/api'
import { METICLE_COLORS } from '../../context/ThemeContext'
import {
  formatDate, formatTime, statusTitle, useMissionControlContext,
  type HomecareData, type PulseData,
} from './MissionControlWorkspace'

type CallStatus = 'all' | 'scheduled' | 'in_progress' | 'completed'

function Metric({ label, value, detail, icon, href, tone = 'default' }: {
  label: string; value: string | number; detail?: string; icon: React.ReactNode; href?: string; tone?: 'default' | 'warning' | 'danger'
}) {
  const navigate = useNavigate()
  const content = (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
      <Box sx={{ width: 38, height: 38, display: 'grid', placeItems: 'center', flexShrink: 0, borderRadius: 1.5, color: tone === 'danger' ? 'error.dark' : tone === 'warning' ? 'warning.dark' : 'primary.main', bgcolor: tone === 'danger' ? 'error.lighter' : tone === 'warning' ? 'warning.lighter' : 'primary.50' }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.15 }}>{value}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>
        {detail && <Typography variant="caption" color="text.secondary">{detail}</Typography>}
      </Box>
    </Stack>
  )
  return (
    <Paper
      component={href ? 'button' : 'div'}
      type={href ? 'button' : undefined}
      onClick={href ? () => navigate(href) : undefined}
      sx={{ p: 1.75, width: '100%', height: '100%', textAlign: 'left', border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper', cursor: href ? 'pointer' : 'default', transition: 'border-color 120ms ease, box-shadow 120ms ease', '&:hover': href ? { borderColor: 'primary.light', boxShadow: '0 2px 8px rgba(12,27,46,0.06)' } : {}, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 } }}
    >{content}</Paper>
  )
}

function ActionRow({ icon, title, description, count, href, tone = 'warning' }: {
  icon: React.ReactNode; title: string; description: string; count: number; href: string; tone?: 'warning' | 'danger' | 'info'
}) {
  const navigate = useNavigate()
  const color = tone === 'danger' ? '#B42318' : tone === 'info' ? '#004085' : '#9A6700'
  const soft = tone === 'danger' ? METICLE_COLORS.dangerSoft : tone === 'info' ? METICLE_COLORS.infoSoft : METICLE_COLORS.warningSoft
  return (
    <Box
      component="button" type="button" onClick={() => navigate(href)}
      sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', p: 1.25, textAlign: 'left', border: 0, borderRadius: 1.5, bgcolor: 'transparent', cursor: 'pointer', color: 'inherit', '&:hover': { bgcolor: 'action.hover' }, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 1 } }}
    >
      <Box sx={{ width: 34, height: 34, flexShrink: 0, display: 'grid', placeItems: 'center', color, bgcolor: soft, borderRadius: 1.25 }}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{title}</Typography>
        <Typography variant="caption" color="text.secondary">{description}</Typography>
      </Box>
      <Typography sx={{ color, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{count}</Typography>
      <NextIcon fontSize="small" sx={{ color: 'text.disabled' }} />
    </Box>
  )
}

function PulseCard({ pulse }: { pulse: PulseData | null }) {
  return (
    <Card header={{ title: 'Operational pulse', subtitle: 'Service-wide reporting measures' }}>
      {pulse?.cards?.length ? <Grid container spacing={1.5}>{pulse.cards.filter(card => !['Active staff', 'People supported', 'Open incidents'].includes(card.label)).map(card => <Grid item xs={6} key={card.label}><Box sx={{ p: 1.25, bgcolor: 'background.default', borderRadius: 1.5 }}><Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{card.value}</Typography><Typography variant="body2" sx={{ fontWeight: 600 }}>{card.label}</Typography><Typography variant="caption" color="text.secondary">{card.subtitle}</Typography></Box></Grid>)}</Grid> : <Typography variant="body2" color="text.secondary">Pulse metrics are currently unavailable.</Typography>}
    </Card>
  )
}

function QuickActions({ actions }: { actions: Array<{ label: string; path: string; icon: React.ReactNode; module: string }> }) {
  const navigate = useNavigate()
  const permissions = (() => { try { return JSON.parse(localStorage.getItem('mc_module_permissions') || '{}') } catch { return {} } })()
  const visible = actions.filter(action => permissions[action.module] && permissions[action.module] !== 'none')
  return (
    <Card header={{ title: 'Quick actions' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))', lg: 'repeat(7, minmax(0, 1fr))' }, gap: 1 }}>
        {visible.map(action => <Button key={action.path} startIcon={action.icon} endIcon={<NextIcon fontSize="small" />} onClick={() => navigate(action.path)} sx={{ justifyContent: 'space-between', textTransform: 'none', color: 'text.primary', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, px: 1.25, py: 1.1, '&:hover': { borderColor: 'primary.light', bgcolor: 'action.hover' } }}>{action.label}</Button>)}
      </Box>
    </Card>
  )
}

const HOMECARE_ACTIONS = [
  { label: 'All calls', path: '/homecare', icon: <CallsIcon fontSize="small" />, module: 'homecare' },
  { label: 'Schedule', path: '/call-scheduling', icon: <CalendarIcon fontSize="small" />, module: 'call_scheduling' },
  { label: 'Availability', path: '/availability', icon: <StaffIcon fontSize="small" />, module: 'homecare' },
  { label: 'Mileage', path: '/mileage', icon: <TodayIcon fontSize="small" />, module: 'mileage_travel' },
  { label: 'Carer totals', path: '/carer-totals', icon: <StaffIcon fontSize="small" />, module: 'payroll_export' },
  { label: 'Payroll', path: '/payroll-export', icon: <CalendarIcon fontSize="small" />, module: 'payroll_export' },
  { label: 'Billing', path: '/client-billing', icon: <ComplianceIcon fontSize="small" />, module: 'client_billing' },
]

const SUPPORTED_LIVING_ACTIONS = [
  { label: 'People', path: '/people', icon: <StaffIcon fontSize="small" />, module: 'people' },
  { label: 'Medication', path: '/emedication', icon: <MedicationIcon fontSize="small" />, module: 'emedication' },
  { label: 'Tasks', path: '/tasks', icon: <CarePlanIcon fontSize="small" />, module: 'tasks' },
  { label: 'Staff', path: '/staff', icon: <StaffIcon fontSize="small" />, module: 'staff_directory' },
  { label: 'Leave manager', path: '/leave', icon: <CalendarIcon fontSize="small" />, module: 'leave' },
  { label: 'Billing', path: '/billing', icon: <ComplianceIcon fontSize="small" />, module: 'billing' },
  { label: 'Settings', path: '/settings', icon: <TodayIcon fontSize="small" />, module: 'settings' },
]

/** Selected-day window in local wall time; the API filters visit timestamps against these bounds. */
function dayWindow(date: string) {
  const from = `${date}T00:00:00`
  const toDate = new Date(`${date}T12:00:00`)
  toDate.setDate(toDate.getDate() + 1)
  const to = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, '0')}-${String(toDate.getDate()).padStart(2, '0')}T00:00:00`
  return { from, to }
}

/** All visits for the selected day. Shares its cache entry with the Calls tab's unfiltered list. */
function useDayVisits(date: string) {
  return useQuery({
    queryKey: ['mission-control-calls', date, 'all'],
    queryFn: () => {
      const { from, to } = dayWindow(date)
      return api.get('/homecare/visits', { params: new URLSearchParams({ from, to }), timeout: 15000 }).then(res => Array.isArray(res.data) ? res.data : [])
    },
  })
}

interface DayVisit {
  id: string
  status: string
  scheduled_start: string
  scheduled_end: string
  assigned_staff_id: string | null
  assigned_staff_name: string | null
  person_name?: string | null
  label?: string | null
  visit_type?: string | null
  package_name?: string | null
  check_in_at?: string | null
  check_out_at?: string | null
}

interface CarerAllocationRow {
  id: string
  name: string
  total: number
  completed: number
  firstStart: string
  lastEnd: string
}

const CARER_PAGE_SIZE = 10

/**
 * Carers allocated to the selected day's calls, derived from the same visit list the Calls tab uses.
 * Cancelled visits are excluded; unassigned visits are counted separately.
 */
function CarerAllocation({ date }: { date: string }) {
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const { data: visits, isLoading, isError, refetch } = useDayVisits(date)

  const allocation = useMemo(() => {
    const carers = new Map<string, CarerAllocationRow>()
    let unassigned = 0
    for (const visit of (visits ?? []) as DayVisit[]) {
      if (visit.status === 'cancelled') continue
      if (!visit.assigned_staff_id) { unassigned += 1; continue }
      const row = carers.get(visit.assigned_staff_id) ?? {
        id: visit.assigned_staff_id,
        name: visit.assigned_staff_name || 'Unnamed carer',
        total: 0,
        completed: 0,
        firstStart: visit.scheduled_start,
        lastEnd: visit.scheduled_end,
      }
      row.total += 1
      if (visit.status === 'completed') row.completed += 1
      if (visit.scheduled_start < row.firstStart) row.firstStart = visit.scheduled_start
      if (visit.scheduled_end > row.lastEnd) row.lastEnd = visit.scheduled_end
      carers.set(row.id, row)
    }
    return { carers: [...carers.values()].sort((a, b) => a.name.localeCompare(b.name)), unassigned }
  }, [visits])

  if (isLoading) return <Stack spacing={1}><Skeleton height={40} /><Skeleton height={40} /><Skeleton height={40} /></Stack>
  if (isError) return <SectionError message="Could not load carer allocations." onRetry={() => { void refetch() }} />

  const term = search.trim().toLowerCase()
  const matching = term ? allocation.carers.filter(carer => carer.name.toLowerCase().includes(term)) : allocation.carers
  const visible = showAll || term ? matching : matching.slice(0, CARER_PAGE_SIZE)
  const carerCount = allocation.carers.length

  return (
    <Stack spacing={1.25}>
      <TextField
        size="small"
        fullWidth
        placeholder="Search carers by name"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        inputProps={{ 'aria-label': 'Search carers' }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
      />
      <Typography variant="caption" color="text.secondary">
        {carerCount} carer{carerCount === 1 ? '' : 's'} allocated · {allocation.unassigned} unassigned call{allocation.unassigned === 1 ? '' : 's'}
      </Typography>
      {carerCount === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>No carers are allocated to calls on {formatDate(date)}.</Typography>
      ) : matching.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>No carers match &ldquo;{search.trim()}&rdquo;.</Typography>
      ) : (
        <>
          <Box component="ul" aria-label="Carer allocations" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {visible.map(carer => (
              <Box component="li" key={carer.id} sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 1, alignItems: 'center', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{carer.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{formatTime(carer.firstStart)} – {formatTime(carer.lastEnd)}</Typography>
                </Box>
                <Chip size="small" variant="outlined" label={`${carer.total} call${carer.total === 1 ? '' : 's'} · ${carer.completed} completed`} />
              </Box>
            ))}
          </Box>
          {!term && !showAll && matching.length > CARER_PAGE_SIZE && (
            <Button size="small" sx={{ alignSelf: 'flex-start', textTransform: 'none' }} onClick={() => setShowAll(true)}>Show all {matching.length} carers</Button>
          )}
        </>
      )}
    </Stack>
  )
}

type StatusCounts = Record<CallStatus, number>
type AssignmentFilter = 'all' | 'assigned' | 'unassigned'

const VISIT_PAGE_SIZE = 10

function matchesStatusFilter(status: string, filter: CallStatus) {
  if (filter === 'all') return true
  if (filter === 'in_progress') return status === 'en_route' || status === 'checked_in'
  return status === filter
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>{value}</Typography>
    </Stack>
  )
}

/** Read-only view of one visit, opened by clicking its row. */
function VisitDetailDialog({ visit, onClose }: { visit: DayVisit | null; onClose: () => void }) {
  return (
    <Dialog open={Boolean(visit)} onClose={onClose} maxWidth="xs" fullWidth aria-labelledby="visit-detail-title">
      {visit && (
        <>
          <DialogTitle id="visit-detail-title">{visit.person_name || 'Visit details'}</DialogTitle>
          <DialogContent>
            <Stack spacing={1.25}>
              <DetailLine label="Time" value={`${formatTime(visit.scheduled_start)} – ${formatTime(visit.scheduled_end)}`} />
              <DetailLine label="Carer" value={visit.assigned_staff_name || 'Unassigned'} />
              <DetailLine label="Visit" value={visit.label || visit.visit_type || 'Care visit'} />
              <DetailLine label="Package" value={visit.package_name || 'Not recorded'} />
              <DetailLine label="Status" value={statusTitle(visit.status)} />
              <DetailLine label="Checked in" value={visit.check_in_at ? formatTime(visit.check_in_at) : 'Not recorded'} />
              <DetailLine label="Checked out" value={visit.check_out_at ? formatTime(visit.check_out_at) : 'Not recorded'} />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} sx={{ textTransform: 'none' }}>Close</Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  )
}

/**
 * Searchable, filterable table of the selected day's visits. Filters apply to the one day's list
 * that the Calls tab already fetches, so counts and rows always agree.
 */
function CallVisitsPanel({ date, status, statusCounts, onStatusChange }: {
  date: string; status: CallStatus; statusCounts: StatusCounts; onStatusChange: (status: CallStatus) => void
}) {
  const [search, setSearch] = useState('')
  const [assignment, setAssignment] = useState<AssignmentFilter>('all')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<DayVisit | null>(null)
  const { data: visits, isLoading, isError, refetch } = useDayVisits(date)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return ((visits ?? []) as DayVisit[])
      .filter(visit => matchesStatusFilter(visit.status, status))
      .filter(visit => assignment === 'all' || (assignment === 'assigned') === Boolean(visit.assigned_staff_id))
      .filter(visit => !term || [visit.person_name, visit.assigned_staff_name, visit.label, visit.visit_type]
        .some(field => (field ?? '').toLowerCase().includes(term)))
      .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start))
  }, [visits, status, assignment, search])

  // Clamp so a filter change that shortens the list never leaves the table on an empty page.
  const lastPage = Math.max(0, Math.ceil(filtered.length / VISIT_PAGE_SIZE) - 1)
  const currentPage = Math.min(page, lastPage)
  const pageRows = filtered.slice(currentPage * VISIT_PAGE_SIZE, (currentPage + 1) * VISIT_PAGE_SIZE)
  const filtersActive = status !== 'all' || assignment !== 'all' || search.trim() !== ''

  const changeStatus = (next: CallStatus) => { onStatusChange(next); setPage(0) }
  const changeAssignment = (next: AssignmentFilter) => { setAssignment(next); setPage(0) }
  const clearFilters = () => { setSearch(''); setAssignment('all'); onStatusChange('all'); setPage(0) }

  return (
    <Stack spacing={1.5}>
      <TextField
        size="small"
        fullWidth
        placeholder="Search by person, carer or visit"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0) }}
        inputProps={{ 'aria-label': 'Search visits' }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
      />
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap role="group" aria-label="Filter visits by status">
        {(['all', 'scheduled', 'in_progress', 'completed'] as CallStatus[]).map(option => (
          <Chip
            key={option}
            size="small"
            clickable
            aria-pressed={status === option}
            color={status === option ? 'primary' : 'default'}
            variant={status === option ? 'filled' : 'outlined'}
            label={`${option === 'in_progress' ? 'In progress' : statusTitle(option)} ${statusCounts[option]}`}
            onClick={() => changeStatus(option)}
          />
        ))}
      </Stack>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap role="group" aria-label="Filter visits by carer assignment">
        {(['all', 'assigned', 'unassigned'] as AssignmentFilter[]).map(option => (
          <Chip
            key={option}
            size="small"
            clickable
            aria-pressed={assignment === option}
            color={assignment === option ? 'primary' : 'default'}
            variant={assignment === option ? 'filled' : 'outlined'}
            label={option === 'all' ? 'All carers' : option === 'assigned' ? 'Assigned' : 'Unassigned'}
            onClick={() => changeAssignment(option)}
          />
        ))}
      </Stack>

      {isLoading ? (
        <Stack spacing={1}><Skeleton height={46} /><Skeleton height={46} /><Skeleton height={46} /></Stack>
      ) : isError ? (
        <SectionError message="Could not load the visits." onRetry={() => { void refetch() }} />
      ) : filtered.length === 0 ? (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">No visits match these filters.</Typography>
          {filtersActive && <Button sx={{ mt: 1, textTransform: 'none' }} onClick={clearFilters}>Clear filters</Button>}
        </Box>
      ) : (
        <>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small" aria-label="Visits for the selected day">
              <TableHead>
                <TableRow>
                  <TableCell>Time</TableCell>
                  <TableCell>Person</TableCell>
                  <TableCell>Carer</TableCell>
                  <TableCell>Visit</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pageRows.map(visit => (
                  <TableRow
                    key={visit.id}
                    hover
                    tabIndex={0}
                    onClick={() => setSelected(visit)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(visit) } }}
                    sx={{ cursor: 'pointer', '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 } }}
                  >
                    <TableCell sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatTime(visit.scheduled_start)} – {formatTime(visit.scheduled_end)}</TableCell>
                    <TableCell sx={{ maxWidth: 220 }}><Typography variant="body2" fontWeight={600} noWrap>{visit.person_name || 'Unknown person'}</Typography></TableCell>
                    <TableCell>{visit.assigned_staff_name
                      ? <Typography variant="body2" noWrap>{visit.assigned_staff_name}</Typography>
                      : <Chip size="small" color="warning" variant="outlined" label="Unassigned" />}</TableCell>
                    <TableCell sx={{ maxWidth: 220 }}><Typography variant="body2" noWrap>{visit.label || visit.visit_type || 'Care visit'}</Typography></TableCell>
                    <TableCell><Chip size="small" variant="outlined" label={statusTitle(visit.status)} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filtered.length}
            page={currentPage}
            onPageChange={(_, next) => setPage(next)}
            rowsPerPage={VISIT_PAGE_SIZE}
            rowsPerPageOptions={[]}
          />
        </>
      )}

      <VisitDetailDialog visit={selected} onClose={() => setSelected(null)} />
    </Stack>
  )
}

function countsByStatus(homecare: HomecareData) {
  const counts = Object.fromEntries(homecare.calls_by_status.map(row => [row.status, row.count])) as Record<string, number>
  return {
    all: homecare.calls_by_status.reduce((sum, row) => sum + row.count, 0),
    scheduled: counts.scheduled ?? 0,
    in_progress: (counts.en_route ?? 0) + (counts.checked_in ?? 0),
    completed: counts.completed ?? 0,
  }
}

interface HandoverGap {
  shift_id: string
  shift_type: string | null
  start_time: string
  end_time: string
  location_id: string
  location_name: string
  staff_notified: boolean
  hours_since_end: number
  rostered: Array<{ user_id: string; name: string }>
}

interface HandoverGaps {
  window_days: number
  grace_minutes: number
  total: number
  shifts: HandoverGap[]
}

const HANDOVER_GAP_PAGE_SIZE = 5
const HANDOVER_GAPS_TABLE = 'Shifts that ended without a handover'

const shortDate = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

/**
 * Shifts that ended with nobody's handover recorded, read from the shifts themselves
 * rather than from the alerts: an alert can be dismissed, and the sweep that raises it
 * stops looking after 24 hours. A manager asking about last week needs the state, not
 * the notification. Selecting a row opens that shift on the rota, where the handover
 * can be read or recorded.
 */
function HandoverGapsPanel() {
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['mission-control-handover-gaps'],
    queryFn: () => api.get('/mission-control/handover-gaps', { timeout: 15000 }).then(res => res.data as HandoverGaps),
  })

  const gaps = data?.shifts ?? []
  const total = data?.total ?? gaps.length
  const windowDays = data?.window_days ?? 7
  const graceMinutes = data?.grace_minutes ?? 30
  const lastPage = Math.max(0, Math.ceil(gaps.length / HANDOVER_GAP_PAGE_SIZE) - 1)
  const currentPage = Math.min(page, lastPage)
  const pageRows = gaps.slice(currentPage * HANDOVER_GAP_PAGE_SIZE, (currentPage + 1) * HANDOVER_GAP_PAGE_SIZE)

  if (isLoading) return <Stack spacing={1}><Skeleton height={38} /><Skeleton height={38} /><Skeleton height={38} /></Stack>
  if (isError) return <SectionError message="Could not load the handover gaps." onRetry={() => { void refetch() }} />

  if (total === 0) {
    return (
      <Stack spacing={0.5}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>Every shift in the last {windowDays} days has a handover recorded.</Typography>
        <Typography variant="caption" color="text.secondary">A shift is counted here once it ended more than {graceMinutes} minutes ago with no handover.</Typography>
      </Stack>
    )
  }

  return (
    <Stack spacing={1.25}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {total} shift{total === 1 ? '' : 's'} ended without a handover in the last {windowDays} day{windowDays === 1 ? '' : 's'}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Select a shift to open it on the rota and read or record its handover. Shifts that ended in the last {graceMinutes} minutes are left out while the worker finishes writing one.
      </Typography>
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small" aria-label={HANDOVER_GAPS_TABLE}>
          <TableHead>
            <TableRow>
              <TableCell>Shift</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>On shift</TableCell>
              <TableCell>Nudge</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pageRows.map(gap => (
              <TableRow
                key={gap.shift_id}
                hover
                tabIndex={0}
                onClick={() => navigate(`/scheduling?week=${gap.start_time.slice(0, 10)}&shift=${gap.shift_id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/scheduling?week=${gap.start_time.slice(0, 10)}&shift=${gap.shift_id}`) } }}
                sx={{ cursor: 'pointer', '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 } }}
              >
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{shortDate(gap.start_time)}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>{formatTime(gap.start_time)} – {formatTime(gap.end_time)}</Typography>
                </TableCell>
                <TableCell sx={{ maxWidth: 180 }}><Typography variant="body2" noWrap>{gap.location_name}</Typography></TableCell>
                <TableCell sx={{ maxWidth: 220 }}>
                  <Typography variant="body2" noWrap>
                    {gap.rostered.map(person => person.name).join(', ')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {gap.rostered.length} staff on the shift
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    variant="outlined"
                    color={gap.staff_notified ? 'default' : 'warning'}
                    label={gap.staff_notified ? 'Staff notified' : 'Not yet notified'}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {gaps.length > HANDOVER_GAP_PAGE_SIZE && (
        <TablePagination
          component="div"
          count={gaps.length}
          page={currentPage}
          onPageChange={(_, next) => setPage(next)}
          rowsPerPage={HANDOVER_GAP_PAGE_SIZE}
          rowsPerPageOptions={[]}
        />
      )}
    </Stack>
  )
}

// ---------------------------------------------------------------------------
// Today: concise overview with links into the other workspaces.
// ---------------------------------------------------------------------------
export function MissionControlTodayView() {
  const { serviceModel, date, homecare, supported, pulse } = useMissionControlContext()
  if (serviceModel === 'domiciliary' && homecare) {
    const completionRate = homecare.total_today > 0 ? Math.round(homecare.completed_today / homecare.total_today * 100) : null
    return (
      <>
        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          <Grid item xs={6} md={3}><Metric label="Call completion" value={completionRate === null ? '—' : `${completionRate}%`} detail={completionRate === null ? 'No calls scheduled' : `${homecare.completed_today} of ${homecare.total_today} calls`} icon={<CompletedIcon fontSize="small" />} href={`/homecare?date=${date}&status=completed`} />{completionRate !== null && <LinearProgress aria-label={`${completionRate}% of calls completed`} variant="determinate" value={completionRate} sx={{ mx: 1.75, mt: -1, mb: 1.25, width: 'calc(100% - 28px)', height: 5, borderRadius: 3 }} />}</Grid>
          <Grid item xs={6} md={3}><Metric label="Active staff" value={homecare.active_staff} detail="Active organisation accounts" icon={<StaffIcon fontSize="small" />} href="/staff" /></Grid>
          <Grid item xs={6} md={3}><Metric label="People supported" value={homecare.people_supported} detail="Active people" icon={<ComplianceIcon fontSize="small" />} href="/people" /></Grid>
          <Grid item xs={6} md={3}><Metric label="Overdue calls" value={homecare.overdue_calls} detail="Across all dates · open backlog" icon={<CallsIcon fontSize="small" />} href="/homecare?overdue=true" tone={homecare.overdue_calls ? 'danger' : 'default'} /></Grid>
        </Grid>
        <Stack spacing={2}>
          <PulseCard pulse={pulse} />
          <QuickActions actions={HOMECARE_ACTIONS} />
        </Stack>
      </>
    )
  }
  if (supported) {
    const selectedCalls = supported.rota
    const completionRate = selectedCalls.length ? Math.round(selectedCalls.filter(call => call.status === 'completed').length / selectedCalls.length * 100) : null
    return (
      <>
        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          <Grid item xs={6} md={3}><Metric label="Shift completion" value={completionRate === null ? '—' : `${completionRate}%`} detail={completionRate === null ? 'No shifts scheduled' : `${selectedCalls.filter(item => item.status === 'completed').length} of ${selectedCalls.length} shifts`} icon={<CompletedIcon fontSize="small" />} href="/scheduling" /></Grid>
          <Grid item xs={6} md={3}><Metric label="Active staff" value={supported.stats.total_staff} detail={`${supported.stats.staff_on_duty} rostered today`} icon={<StaffIcon fontSize="small" />} href="/staff" /></Grid>
          <Grid item xs={6} md={3}><Metric label="People supported" value={supported.stats.active_people} detail="Active people" icon={<ComplianceIcon fontSize="small" />} href="/people" /></Grid>
          <Grid item xs={6} md={3}><Metric label="Open incidents" value={supported.stats.open_incidents} detail="Reported or investigating" icon={<IncidentIcon fontSize="small" />} href="/incidents?status=reported" tone={supported.stats.open_incidents ? 'danger' : 'default'} /></Grid>
        </Grid>
        <Stack spacing={2}>
          <PulseCard pulse={pulse} />
          <QuickActions actions={SUPPORTED_LIVING_ACTIONS} />
        </Stack>
      </>
    )
  }
  return null
}

// ---------------------------------------------------------------------------
// Calls: visits for domiciliary care, the rota for supported living.
// ---------------------------------------------------------------------------
export function MissionControlCallsView() {
  const { serviceModel, date, homecare, supported } = useMissionControlContext()
  const [callStatus, setCallStatus] = useState<CallStatus>('all')
  const navigate = useNavigate()

  if (serviceModel === 'domiciliary' && homecare) {
    const statusCounts = countsByStatus(homecare)
    const rows = [
      { title: 'Overdue calls', description: 'Outstanding scheduled or en-route calls past their planned end time', count: homecare.overdue_calls, href: '/homecare?overdue=true', tone: 'danger' as const, icon: <CallsIcon fontSize="small" /> },
      { title: 'Missed calls today', description: `Missed on ${formatDate(date)}`, count: homecare.missed_today, href: `/homecare?status=missed&date=${date}`, tone: 'danger' as const, icon: <CallsIcon fontSize="small" /> },
      { title: 'Unassigned calls today', description: `Scheduled for ${formatDate(date)} without a carer`, count: homecare.unassigned_today, href: `/homecare?status=scheduled&assignment=unassigned&date=${date}`, tone: 'warning' as const, icon: <UnassignedIcon fontSize="small" /> },
    ]
    return (
      <>
        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          <Grid item xs={6} md={2}><Metric label="Scheduled" value={statusCounts.scheduled} detail={formatDate(date)} icon={<CalendarIcon fontSize="small" />} href={`/homecare?date=${date}&status=scheduled`} /></Grid>
          <Grid item xs={6} md={2}><Metric label="In progress" value={statusCounts.in_progress} icon={<CallsIcon fontSize="small" />} href={`/homecare?date=${date}`} /></Grid>
          <Grid item xs={6} md={2}><Metric label="Completed" value={statusCounts.completed} icon={<CompletedIcon fontSize="small" />} href={`/homecare?date=${date}&status=completed`} /></Grid>
          <Grid item xs={6} md={2}><Metric label="Missed" value={homecare.missed_today} icon={<CallsIcon fontSize="small" />} href={`/homecare?status=missed&date=${date}`} tone={homecare.missed_today ? 'danger' : 'default'} /></Grid>
          <Grid item xs={6} md={2}><Metric label="Overdue" value={homecare.overdue_calls} detail="Across all dates" icon={<CallsIcon fontSize="small" />} href="/homecare?overdue=true" tone={homecare.overdue_calls ? 'danger' : 'default'} /></Grid>
          <Grid item xs={6} md={2}><Metric label="Unassigned" value={homecare.unassigned_today} icon={<UnassignedIcon fontSize="small" />} href={`/homecare?status=scheduled&assignment=unassigned&date=${date}`} tone={homecare.unassigned_today ? 'warning' : 'default'} /></Grid>
        </Grid>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>Overdue calls are scheduled or en-route visits whose planned end time has passed. Missed calls use the separate recorded “missed” status; unassigned calls are not overdue unless they also meet the overdue rule.</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} lg={5}>
            <Card header={{ title: 'Call exceptions', subtitle: 'Ordered by urgency' }}>
              <Stack spacing={0.25}>{rows.map(row => <ActionRow key={row.title} {...row} />)}</Stack>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card header={{ title: "Today's call schedule", subtitle: `${statusCounts.all} calls · ${formatDate(date)}`, onViewAll: () => navigate(`/homecare?date=${date}`) }}>
              {statusCounts.all === 0
                ? <Box sx={{ py: 4, textAlign: 'center' }}><Typography variant="subtitle2" sx={{ fontWeight: 600 }}>No calls today</Typography><Typography variant="body2" color="text.secondary">There are no calls scheduled for {formatDate(date)}.</Typography><Button sx={{ mt: 1, textTransform: 'none' }} onClick={() => navigate(`/homecare?date=${date}`)}>View all calls</Button></Box>
                : <CallVisitsPanel date={date} status={callStatus} statusCounts={statusCounts} onStatusChange={setCallStatus} />}
            </Card>
          </Grid>
        </Grid>
      </>
    )
  }

  if (supported) {
    return (
      <Card header={{ title: "Today's rota", subtitle: `${supported.rota.length} scheduled shifts · ${formatDate(date)}`, onViewAll: () => navigate('/scheduling') }}>
        {supported.rota.length
          ? <Stack>{supported.rota.slice(0, 12).map(shift => <Box key={shift.id} sx={{ display: 'grid', gridTemplateColumns: '58px minmax(0, 1fr) auto', alignItems: 'center', gap: 1.25, py: 1.1, borderBottom: '1px solid', borderColor: 'divider' }}><Typography variant="body2" sx={{ fontWeight: 700 }}>{formatTime(shift.start_time)}</Typography><Box sx={{ minWidth: 0 }}><Typography variant="body2" sx={{ fontWeight: 600 }}>{shift.location_name}</Typography><Typography variant="caption" color="text.secondary" noWrap>{shift.assigned_staff || 'Unassigned staff'}</Typography></Box><Chip label={statusTitle(shift.status)} size="small" variant="outlined" /></Box>)}</Stack>
          : <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>No shifts are scheduled for {formatDate(date)}.</Typography>}
      </Card>
    )
  }
  return null
}

// ---------------------------------------------------------------------------
// Staffing: carer allocation for domiciliary care, coverage for supported living.
// ---------------------------------------------------------------------------
export function MissionControlStaffingView() {
  const { serviceModel, date, homecare, supported } = useMissionControlContext()
  const navigate = useNavigate()

  if (serviceModel === 'domiciliary' && homecare) {
    return (
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}><Metric label="Active staff" value={homecare.active_staff} detail="Active organisation accounts" icon={<StaffIcon fontSize="small" />} href="/staff" /></Grid>
        <Grid item xs={12} md={8}>
          <Card header={{ title: 'Carer coverage', subtitle: `Calls on ${formatDate(date)}`, onViewAll: () => navigate('/call-assignment') }}>
            <Stack spacing={1.5}>
              <Typography variant="body2">{homecare.carers_working_today} carer{homecare.carers_working_today === 1 ? '' : 's'} assigned to calls · {homecare.unassigned_today} unassigned calls</Typography>
              <Typography variant="caption" color="text.secondary">Available-carer headcount and minimum required coverage are not included: the existing summary does not calculate those measures.</Typography>
              {homecare.carers_working_today === 0 && <Alert severity="info">No carers assigned. There are no carers assigned to calls for {formatDate(date)}.</Alert>}
              <CarerAllocation date={date} />
              <Button sx={{ alignSelf: 'flex-start', textTransform: 'none' }} onClick={() => navigate('/call-assignment')}>Manage staffing</Button>
            </Stack>
          </Card>
        </Grid>
      </Grid>
    )
  }

  if (supported) {
    const coverage = supported.staffing_coverage
    return (
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}><Metric label="Staff on duty" value={supported.stats.staff_on_duty} detail={formatDate(date)} icon={<StaffIcon fontSize="small" />} href="/scheduling" /></Grid>
        <Grid item xs={12} md={8}>
          <Card header={{ title: 'Staffing', subtitle: `${supported.stats.staff_on_duty} staff rostered for ${formatDate(date)}`, onViewAll: () => navigate('/scheduling') }}>
            <Stack spacing={1.25}>
              {coverage && <>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline"><Typography variant="body2" fontWeight={600}>7-day minimum staffing coverage</Typography><Typography variant="h6" fontWeight={700}>{coverage.coverage_percent}%</Typography></Stack>
                <LinearProgress aria-label={`${coverage.coverage_percent}% staffing coverage`} variant="determinate" value={coverage.coverage_percent} color={coverage.coverage_percent < coverage.required_coverage_percent ? 'warning' : 'success'} />
                <Typography variant="caption" color="text.secondary">Target {coverage.required_coverage_percent}% · {coverage.below_minimum_shifts} of {coverage.shifts_with_target} shifts below minimum · {coverage.staffing_shortfall} staff needed</Typography>
                {coverage.coverage_percent < coverage.required_coverage_percent && <Alert severity={coverage.unstaffed_shifts ? 'error' : 'warning'}>Coverage is below the configured target. {coverage.unstaffed_shifts} shift{coverage.unstaffed_shifts === 1 ? ' is' : 's are'} currently unstaffed.</Alert>}
                {coverage.affected_shifts.slice(0, 3).map(shift => <Typography key={shift.shift_id} variant="caption" color="text.secondary">{shift.location_name}: {shift.assigned_staff}/{shift.minimum_staff} staff on {formatDate(shift.start_time.slice(0, 10))} (short {shift.shortfall})</Typography>)}
              </>}
              <Typography variant="body2">Rota data shows who is scheduled; live availability is managed separately.</Typography>
              <Button sx={{ alignSelf: 'flex-start', textTransform: 'none' }} onClick={() => navigate('/scheduling')}>Manage rota</Button>
            </Stack>
          </Card>
        </Grid>
      </Grid>
    )
  }
  return null
}

// ---------------------------------------------------------------------------
// Compliance: training, documents, vetting and staff thresholds.
// ---------------------------------------------------------------------------
export function MissionControlComplianceView() {
  const { serviceModel, homecare, supported } = useMissionControlContext()

  if (serviceModel === 'domiciliary' && homecare) {
    return (
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}><Metric label="Training expiring" value={homecare.training_expiring} detail="Completed training due within 14 days" icon={<TrainingIcon fontSize="small" />} href="/compliance/training?expiry=14" tone={homecare.training_expiring ? 'warning' : 'default'} /></Grid>
        <Grid item xs={12} md={6}><Metric label="Documents expiring" value={homecare.docs_expiring} detail="DBS and right-to-work due within 30 days" icon={<DocumentIcon fontSize="small" />} href="/compliance/identity?expiry=30" tone={homecare.docs_expiring ? 'warning' : 'default'} /></Grid>
        <Grid item xs={12}>
          <Card header={{ title: 'Compliance records', subtitle: 'Items needing renewal' }}>
            <Stack spacing={0.25}>
              <ActionRow icon={<TrainingIcon fontSize="small" />} title="Training expiring" description="Completed training due within 14 days" count={homecare.training_expiring} href="/compliance/training?expiry=14" />
              <ActionRow icon={<DocumentIcon fontSize="small" />} title="Documents expiring" description="DBS and right-to-work documents due within 30 days" count={homecare.docs_expiring} href="/compliance/identity?expiry=30" />
            </Stack>
          </Card>
        </Grid>
      </Grid>
    )
  }

  if (supported) {
    return (
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}><Metric label="Compliance rate" value={`${supported.stats.compliance_rate ?? 0}%`} detail="Active staff records" icon={<ComplianceIcon fontSize="small" />} href="/compliance" /></Grid>
        <Grid item xs={12} md={8}>
          <Card header={{ title: 'Compliance records', subtitle: 'Items needing attention' }}>
            <Stack spacing={0.25}>
              <ActionRow icon={<ComplianceIcon fontSize="small" />} title="Staff below compliance threshold" description="Review active staff compliance records" count={supported.widgets.staff_below_threshold ?? 0} href="/compliance" />
              <ActionRow icon={<TrainingIcon fontSize="small" />} title="Training expiring" description="Training records due within 30 days" count={supported.widgets.training_expiring_soon} href="/compliance/training?expiry=30" />
              <ActionRow icon={<DocumentIcon fontSize="small" />} title="Background checks expiring" description="Vetting checks due within 30 days" count={supported.widgets.dbs_expiring_soon} href="/compliance/identity?expiry=30" />
              <ActionRow icon={<ComplianceIcon fontSize="small" />} title="Competency assessments due" description="Staff competencies due for review" count={supported.widgets.competency_due ?? 0} href="/compliance/competency" />
            </Stack>
          </Card>
        </Grid>
        <Grid item xs={12}>
          <Card header={{ title: 'Shift handovers', subtitle: 'Shifts that ended without one, and who was on them' }}>
            <HandoverGapsPanel />
          </Card>
        </Grid>
      </Grid>
    )
  }
  return null
}

// ---------------------------------------------------------------------------
// Care: care-plan reviews and medication exceptions.
// ---------------------------------------------------------------------------
export function MissionControlCareView() {
  const { serviceModel, date, homecare, supported } = useMissionControlContext()

  if (serviceModel === 'domiciliary' && homecare) {
    return (
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}><Metric label="People supported" value={homecare.people_supported} detail="Active people" icon={<ComplianceIcon fontSize="small" />} href="/people" /></Grid>
        <Grid item xs={12} md={8}>
          <Card header={{ title: 'Care plans', subtitle: 'Reviews and follow-up' }}>
            <Stack spacing={0.25}>
              <ActionRow icon={<CarePlanIcon fontSize="small" />} title="Care plans overdue" description="Active plans past their review date" count={homecare.overdue_care_plans} href="/people?tab=care-plans&review=overdue" />
            </Stack>
          </Card>
        </Grid>
      </Grid>
    )
  }

  if (supported) {
    const carePlanCount = supported.reviews.filter(review => review.entity_type === 'care_plan' && review.status === 'active' && review.due_date.slice(0, 10) < date).length
    return (
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}><Metric label="People supported" value={supported.stats.active_people} detail="Active people" icon={<ComplianceIcon fontSize="small" />} href="/people" /></Grid>
        <Grid item xs={12} md={8}>
          <Card header={{ title: 'Care actions', subtitle: 'Reviews and medication exceptions' }}>
            <Stack spacing={0.25}>
              <ActionRow icon={<MedicationIcon fontSize="small" />} title="Medication overdue" description="Pending administrations more than 30 minutes late" count={supported.widgets.overdue_medications} href="/emedication?status=overdue" tone="danger" />
              <ActionRow icon={<CarePlanIcon fontSize="small" />} title="Care plans overdue" description="Active plans past their review date" count={carePlanCount} href="/people?tab=care-plans&review=overdue" />
            </Stack>
          </Card>
        </Grid>
      </Grid>
    )
  }
  return null
}

// ---------------------------------------------------------------------------
// Incidents: open and overdue incident work.
// ---------------------------------------------------------------------------
export function MissionControlIncidentsView() {
  const { serviceModel, homecare, supported } = useMissionControlContext()

  if (serviceModel === 'domiciliary' && homecare) {
    return (
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}><Metric label="Open incidents" value={homecare.open_incidents} detail="Reported or investigating" icon={<IncidentIcon fontSize="small" />} href="/incidents?status=open" tone={homecare.open_incidents ? 'danger' : 'default'} /></Grid>
        <Grid item xs={12} md={8}>
          <Card header={{ title: 'Incident follow-up', subtitle: 'Open work and overdue actions' }}>
            <Stack spacing={0.25}>
              <ActionRow icon={<IncidentIcon fontSize="small" />} title="Open incidents" description="Reported or investigating incidents" count={homecare.open_incidents} href="/incidents?status=open" tone="danger" />
              <ActionRow icon={<IncidentIcon fontSize="small" />} title="Overdue incident actions" description="Follow-up actions past their due date" count={homecare.overdue_incident_actions} href="/incidents" tone="danger" />
            </Stack>
          </Card>
        </Grid>
      </Grid>
    )
  }

  if (supported) {
    return (
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}><Metric label="Open incidents" value={supported.stats.open_incidents} detail="Reported or investigating" icon={<IncidentIcon fontSize="small" />} href="/incidents?status=reported" tone={supported.stats.open_incidents ? 'danger' : 'default'} /></Grid>
        <Grid item xs={12} md={8}>
          <Card header={{ title: 'Incident follow-up', subtitle: 'Severe and open incidents' }}>
            <Stack spacing={0.25}>
              <ActionRow icon={<IncidentIcon fontSize="small" />} title="Open severe incidents" description="High-severity incidents still open" count={supported.widgets.open_severe_incidents} href="/incidents?status=reported" tone="danger" />
            </Stack>
          </Card>
        </Grid>
      </Grid>
    )
  }
  return null
}
