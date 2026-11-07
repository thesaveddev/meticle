import { useMemo, useRef, useState } from 'react'
import {
  AccessTime as CallsIcon,
  AssignmentLate as CarePlanIcon,
  AccessTime as LeaveIcon,
  AssignmentTurnedIn as AttentionActionIcon,
  BarChart as ChartIcon,
  CalendarMonth as CalendarIcon,
  CheckCircle as CompletedIcon,
  Description as DocumentIcon,
  ErrorOutline as IncidentIcon,
  Group as StaffIcon,
  Layers as MarketplaceIcon,
  LocationOn as LocationIcon,
  Medication as MedicationIcon,
  PersonOff as UnassignedIcon,
  School as TrainingIcon,
  Shield as ComplianceIcon,
  Flag as FlagIcon,
  ChevronRight as NextIcon,
  Event as AppointmentIcon,
  RestaurantMenu as MealIcon,
  Search as SearchIcon,
  Today as TodayIcon,
} from '@mui/icons-material'
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, InputAdornment, LinearProgress, Paper,
  Skeleton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Card, SectionError, StatusBadge } from '../../components/ui'
import { categoryLabel } from './alertLabels'
import api from '../../services/api'
import { METICLE_COLORS } from '../../context/ThemeContext'
import { P } from '../../styles/tokens'
import {
  formatDate, formatTime, statusTitle, useMissionControlContext,
  type HomecareData, type PulseData, type SupportedLivingData,
} from './MissionControlWorkspace'

type CallStatus = 'all' | 'scheduled' | 'in_progress' | 'completed'

function Metric({ label, value, detail, icon, href, tone = 'default' }: {
  label: string; value: string | number; detail?: string; icon: React.ReactNode; href?: string; tone?: 'default' | 'warning' | 'danger'
}) {
  const navigate = useNavigate()
  const content = (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
      <Box sx={{ width: 32, height: 32, display: 'grid', placeItems: 'center', flexShrink: 0, borderRadius: 2, color: tone === 'danger' ? 'error.dark' : tone === 'warning' ? 'warning.dark' : 'primary.main', bgcolor: tone === 'danger' ? 'error.lighter' : tone === 'warning' ? 'warning.lighter' : 'primary.50' }}>{icon}</Box>
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

function ActionRow({ icon, title, description, count, href, tone = 'warning', actionLabel, zeroLabel }: {
  icon: React.ReactNode; title: string; description: string; count?: number; href: string; tone?: 'warning' | 'danger' | 'info';
  /** Renders a solid action button instead of the chevron (the row itself stops navigating). */
  actionLabel?: string;
  /** Green pill shown next to the zero count instead of the chevron. */
  zeroLabel?: string;
}) {
  const navigate = useNavigate()
  const color = tone === 'danger' ? '#B42318' : tone === 'info' ? '#004085' : '#9A6700'
  const soft = tone === 'danger' ? METICLE_COLORS.dangerSoft : tone === 'info' ? METICLE_COLORS.infoSoft : METICLE_COLORS.warningSoft
  const end = (
    <>
      {count !== undefined && (
        <Typography sx={{ color, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{count}</Typography>
      )}
      {count === 0 && zeroLabel ? (
        <Chip label={zeroLabel} size="small" sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: '#EAFBF5', color: '#087A55' }} />
      ) : actionLabel ? (
        <Button size="small" variant="contained" onClick={() => navigate(href)} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, bgcolor: '#0164C8', '&:hover': { bgcolor: '#0157AD' } }}>{actionLabel}</Button>
      ) : (
        <NextIcon fontSize="small" sx={{ color: 'text.disabled' }} />
      )}
    </>
  )
  const body = (
    <>
      <Box sx={{ width: 32, height: 32, flexShrink: 0, display: 'grid', placeItems: 'center', color, bgcolor: soft, borderRadius: 2 }}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{title}</Typography>
        <Typography variant="caption" color="text.secondary">{description}</Typography>
      </Box>
      {end}
    </>
  )
  // With its own button the row is not a link: nesting a button inside the
  // row button would be invalid, so the row stands still and the button moves.
  if (actionLabel) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', p: 1.25 }}>{body}</Box>
    )
  }
  return (
    <Box
      component="button" type="button" onClick={() => navigate(href)}
      sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', p: 1.25, textAlign: 'left', border: 0, borderRadius: 1.5, bgcolor: 'transparent', cursor: 'pointer', color: 'inherit', '&:hover': { bgcolor: 'action.hover' }, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 1 } }}
    >{body}</Box>
  )
}

function MissedResidentRows({ rows, caption }: {
  rows: Array<{ resident_id: string; person_name: string; administration_id: string; scheduled_time: string; administration_status: string; record_id: string }>;
  caption: 'Due' | 'Missed';
}) {
  const navigate = useNavigate()
  if (rows.length === 0) return null
  return (
    <Stack spacing={0} sx={{ ml: 6, mb: 0.5 }}>
      {rows.map(row => (
        <Box
          key={row.resident_id}
          component="button" type="button"
          onClick={() => navigate(`/emedication?personId=${row.resident_id}`)}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', py: 0.75, px: 1, border: 0, borderRadius: 1, bgcolor: 'transparent', cursor: 'pointer', color: 'inherit', textAlign: 'left', '&:hover': { bgcolor: 'action.hover' }, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 1 } }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.person_name}</Typography>
          <Typography variant="caption" color="text.secondary">{caption} {formatTime(row.scheduled_time)}</Typography>
          <NextIcon fontSize="small" sx={{ color: 'text.disabled' }} />
        </Box>
      ))}
    </Stack>
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
  const hasPermissions = Object.keys(permissions).length > 0
  const visible = hasPermissions ? actions.filter(action => permissions[action.module] && permissions[action.module] !== 'none') : actions
  return (
    <Card header={{ title: 'Quick actions' }}>
      <Stack spacing={0} sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
        {visible.map((action, index) => (
          <Box
            key={action.path}
            component="button"
            type="button"
            onClick={() => navigate(action.path)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', p: 1.5,
              border: 0, borderTop: index === 0 ? 0 : '1px solid', borderColor: 'divider',
              bgcolor: 'transparent', cursor: 'pointer', textAlign: 'left', color: 'inherit',
              '&:hover': { bgcolor: 'action.hover' },
              '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
            }}
          >
            <Box sx={{ width: 32, height: 32, display: 'grid', placeItems: 'center', flexShrink: 0, borderRadius: 2, bgcolor: '#EAF3FF', color: '#0164C8' }}>{action.icon}</Box>
            <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}>{action.label}</Typography>
            <NextIcon fontSize="small" sx={{ color: 'text.disabled' }} />
          </Box>
        ))}
      </Stack>
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
type TodayAlert = {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  alert_type: string
  title: string
  message: string
  link: string
}

const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

function severityTone(severity: string): 'error' | 'info' | 'neutral' {
  if (severity === 'critical') return 'error'
  if (severity === 'high') return 'info'
  return 'neutral'
}

function attentionTarget(alertType: string): { icon: React.ReactNode; actionLabel: string; tile: { bg: string; fg: string } } {
  const type = (alertType ?? '').toLowerCase()
  if (type.includes('medicat')) return { icon: <MedicationIcon fontSize="small" />, actionLabel: 'Review MAR', tile: { bg: '#FEF0F0', fg: '#B42318' } }
  if (type.includes('training') || type.includes('expir') || type.includes('dbs')) return { icon: <TrainingIcon fontSize="small" />, actionLabel: 'Assign training', tile: { bg: '#EAF3FF', fg: '#0164C8' } }
  if (type.includes('incident')) return { icon: <IncidentIcon fontSize="small" />, actionLabel: 'Triage', tile: { bg: '#FEF0F0', fg: '#B42318' } }
  if (type.includes('task')) return { icon: <AttentionActionIcon fontSize="small" />, actionLabel: 'View', tile: { bg: '#F0F5FC', fg: '#51637A' } }
  if (type.includes('manager') || type.includes('location') || type.includes('escalat')) return { icon: <LocationIcon fontSize="small" />, actionLabel: 'Assign manager', tile: { bg: '#F0F5FC', fg: '#51637A' } }
  if (type.includes(' rota') || type.includes('rota') || type.includes('shift') || type.includes('staff') || type.includes('call') || type.includes('visit'))
    return { icon: <CalendarIcon fontSize="small" />, actionLabel: 'Open rota', tile: { bg: '#EAF3FF', fg: '#0164C8' } }
  if (type.includes('compliance')) return { icon: <ComplianceIcon fontSize="small" />, actionLabel: 'Review', tile: { bg: '#EAF3FF', fg: '#0164C8' } }
  return { icon: <AttentionActionIcon fontSize="small" />, actionLabel: 'Review', tile: { bg: '#EAF3FF', fg: '#0164C8' } }
}

function TodayHero({ critical, high, other, total, attentionRef }: {
  critical: number; high: number; other: number; total: number; attentionRef: React.RefObject<HTMLDivElement | null>;
}) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const headline = total === 0
    ? 'Nothing needs your attention'
    : `${total} thing${total === 1 ? '' : 's'} need your attention today`
  return (
    <Box
      sx={{
        position: 'relative', overflow: 'hidden', borderRadius: 4, px: { xs: 2.5, md: 4 }, py: { xs: 2.5, md: 3.5 },
        background: `linear-gradient(135deg, ${P.primaryHover} 0%, ${P.primary} 55%, ${P.primaryGradientDeep} 100%)`,
        color: '#FFFFFF',
      }}
    >
      {/* Decorative rings — hidden on small screens so the heading stays visible. */}
      <Box aria-hidden sx={{ display: { xs: 'none', md: 'block' } }}>
        <Box sx={{ position: 'absolute', width: 420, height: 420, right: -110, top: -160, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.22)' }} />
        <Box sx={{ position: 'absolute', width: 420, height: 420, right: -40, top: -110, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.14)' }} />
        <Box sx={{ position: 'absolute', width: 200, height: 200, right: 130, bottom: -140, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.12)' }} />
      </Box>
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2.5} alignItems={{ xs: 'flex-start', lg: 'center' }} justifyContent="space-between" sx={{ position: 'relative' }}>
        <Box sx={{ maxWidth: 560, minWidth: 0 }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>{greeting}</Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, fontSize: { xs: 22, md: 28 }, lineHeight: 1.2 }}>{headline}</Typography>
          <Typography sx={{ mt: 0.5, color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>Ranked by risk to people first</Typography>
          {total > 0 ? (
            <Button
              variant="contained"
              onClick={() => attentionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              endIcon={<NextIcon fontSize="small" />}
              sx={{ mt: 2, bgcolor: '#FFFFFF', color: P.primaryGradientDeep, fontWeight: 700, borderRadius: 999, textTransform: 'none', px: 2.5, py: 1, '&:hover': { bgcolor: 'rgba(255,255,255,0.92)' } }}
            >
              Review now
            </Button>
          ) : null}
        </Box>
        <Stack direction="row" spacing={1.25} sx={{ flexShrink: 0, width: { xs: '100%', lg: 'auto' } }}>
          {[{ label: 'Critical', value: critical }, { label: 'High', value: high }, { label: 'Other', value: other }].map(stat => (
            <Box key={stat.label} sx={{ flex: 1, minWidth: 88, bgcolor: 'rgba(3,20,45,0.45)', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 2, px: 2, py: 1.5, textAlign: 'left' }}>
              <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>• {stat.label}</Typography>
              <Typography sx={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{stat.value}</Typography>
            </Box>
          ))}
        </Stack>
      </Stack>
    </Box>
  )
}

/** Figma Today metric card: label + icon tile, large value, subtitle/trend, optional CTA. */
function TodayMetricCard({ label, value, valueColor, subtitle, subtitleColor, trend, icon, iconBg, iconFg, actionLabel, onAction }: {
  label: string; value: string; valueColor?: string; subtitle: string; subtitleColor?: string; trend?: { label: string; tone: 'neutral' | 'success' | 'danger' }; icon: React.ReactNode; iconBg: string; iconFg: string; actionLabel?: string; onAction?: () => void;
}) {
  const trendColors = { neutral: { bg: '#F0F5FC', fg: '#51637A' }, success: { bg: '#EAFBF5', fg: '#087A55' }, danger: { bg: '#FEF0F0', fg: '#B42318' } } as const
  const trendStyle = trend ? trendColors[trend.tone] : null
  return (
    <Paper elevation={0} sx={{ p: 2.25, height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>{label}</Typography>
        <Box sx={{ width: 32, height: 32, display: 'grid', placeItems: 'center', flexShrink: 0, borderRadius: '50%', bgcolor: iconBg, color: iconFg }}>{icon}</Box>
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', rowGap: 0.75 }}>
        <Typography sx={{ fontSize: 26, fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', color: valueColor ?? 'text.primary' }}>{value}</Typography>
        {trend && trendStyle ? (
          <Chip label={trend.label} size="small" sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: trendStyle.bg, color: trendStyle.fg }} />
        ) : null}
      </Stack>
      <Typography variant="body2" sx={{ fontSize: 13, color: subtitleColor ?? 'text.secondary' }}>{subtitle}</Typography>
      {actionLabel ? (
        <Box sx={{ mt: 'auto', pt: 1.5 }}>
          <Button size="small" variant="contained" onClick={onAction} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, bgcolor: '#0164C8', '&:hover': { bgcolor: '#0157AD' } }}>{actionLabel}</Button>
        </Box>
      ) : null}
    </Paper>
  )
}

function NeedsAttention({ alerts, loading, error, onRetry, viewAllHref }: {
  alerts: TodayAlert[]; loading: boolean; error: boolean; onRetry: () => void; viewAllHref: string;
}) {
  const navigate = useNavigate()
  const sorted = useMemo(
    () => [...alerts].sort((a, b) => (SEVERITY_RANK[a.severity] ?? 4) - (SEVERITY_RANK[b.severity] ?? 4)),
    [alerts],
  )
  const total = sorted.length
  const visible = sorted.slice(0, 7)
  return (
    <Card header={{ title: `Needs attention`, subtitle: total > 0 ? `${total} ranked by risk` : undefined, onViewAll: total > 0 ? () => navigate(viewAllHref) : undefined }}>
      {loading ? (
        <Stack spacing={1.5}>
          <Skeleton variant="rounded" height={64} />
          <Skeleton variant="rounded" height={64} />
          <Skeleton variant="rounded" height={64} />
        </Stack>
      ) : error ? (
        <SectionError message="Attention items could not be loaded." onRetry={onRetry} />
      ) : total === 0 ? (
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 1 }}>
          <CompletedIcon color="success" />
          <Typography variant="body2" color="text.secondary">Nothing needs attention right now.</Typography>
        </Stack>
      ) : (
        <Stack spacing={0} sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
          {visible.map((alert, index) => {
            const target = attentionTarget(alert.alert_type)
            return (
              <Box
                key={alert.id}
                component="button"
                type="button"
                onClick={() => navigate(alert.link)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', textAlign: 'left',
                  p: 1.75, border: 0, borderTop: index === 0 ? 0 : '1px solid', borderColor: 'divider',
                  bgcolor: 'background.paper', cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
                }}
              >
                <Box sx={{ width: 32, height: 32, display: 'grid', placeItems: 'center', flexShrink: 0, borderRadius: 2, bgcolor: target.tile.bg, color: target.tile.fg }}>{target.icon}</Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.35 }}>{alert.title}</Typography>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5, flexWrap: 'wrap', rowGap: 0.5 }}>
                    <StatusBadge label={alert.severity} tone={severityTone(alert.severity)} />
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: '100%' }}>
                      {categoryLabel(alert.alert_type)} · {alert.message}
                    </Typography>
                  </Stack>
                </Box>
                <Button size="small" variant="contained" disableElevation sx={{ flexShrink: 0, textTransform: 'none', fontWeight: 700, borderRadius: 2, bgcolor: '#0164C8', '&:hover': { bgcolor: '#0157AD' } }} onClick={(e) => { e.stopPropagation(); navigate(alert.link) }}>
                  {target.actionLabel}
                </Button>
              </Box>
            )
          })}
        </Stack>
      )}
    </Card>
  )
}

function ScheduleRow({ time, title, subtitle, tag, tagTone, onOpen, urgent }: {
  time: string; title: string; subtitle: string; tag: string; tagTone?: 'neutral' | 'danger' | 'info'; onOpen: () => void; urgent?: boolean;
}) {
  const tagColors = {
    neutral: { bg: '#F0F5FC', fg: '#51637A' },
    danger: { bg: '#FEF0F0', fg: '#B42318' },
    info: { bg: '#EAF3FF', fg: '#0164C8' },
  } as const
  const colors = tagColors[tagTone ?? 'neutral']
  return (
    <Box
      component="button"
      type="button"
      onClick={onOpen}
      sx={{
        display: 'flex', alignItems: 'center', gap: 2, width: '100%', textAlign: 'left',
        px: 1, py: 1.5, border: 0, bgcolor: 'transparent', cursor: 'pointer', color: 'inherit',
        '&:hover': { bgcolor: 'action.hover' },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
      }}
    >
      <Typography sx={{ width: 52, flexShrink: 0, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 14 }}>{time}</Typography>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>{title}</Typography>
        <Typography variant="caption" color={urgent ? 'error.main' : 'text.secondary'} noWrap sx={{ display: 'block', fontWeight: urgent ? 600 : 400 }}>{subtitle}</Typography>
      </Box>
      <Chip label={tag} size="small" sx={{ flexShrink: 0, height: 24, fontSize: 11, fontWeight: 700, bgcolor: colors.bg, color: colors.fg }} />
    </Box>
  )
}

function SupportedTodaySchedule({ rota, date }: { rota: SupportedLivingData['rota']; date: string }) {
  const navigate = useNavigate()
  const items = [...rota].sort((a, b) => String(a.start_time).localeCompare(String(b.start_time))).slice(0, 5)
  const openRota = () => navigate('/scheduling')
  return (
    <Card header={{ title: "Today's schedule", subtitle: `${rota.length} scheduled shifts · ${formatDate(date)}`, onViewAll: openRota }}>
      {items.length === 0 ? (
        <Stack spacing={0} divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }} />}>
          <ScheduleRow time="08:00" title="Morning medication round" subtitle="Due across locations" tag="Medication" onOpen={openRota} />
          <ScheduleRow time="09:00" title="Rota cut-off for today" subtitle="Check cover before the day starts" tag="Rota" tagTone="danger" urgent onOpen={openRota} />
          <ScheduleRow time="12:00" title="Lunchtime medication round" subtitle="Due across locations" tag="Medication" onOpen={openRota} />
        </Stack>
      ) : (
        <Stack spacing={0} divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }} />}>
          {items.map((shift) => (
            <ScheduleRow
              key={shift.id}
              time={formatTime(shift.start_time)}
              title={shift.location_name || 'Shift'}
              subtitle={shift.assigned_staff || 'Unassigned staff'}
              tag={statusTitle(shift.status)}
              tagTone="info"
              onOpen={openRota}
            />
          ))}
        </Stack>
      )}
    </Card>
  )
}

function DomiciliaryTodaySchedule({ date }: { date: string }) {
  const navigate = useNavigate()
  const { data } = useDayVisits(date)
  const visits = useMemo(() => {
    const list = ((data ?? []) as DayVisit[]).filter(visit => visit.status !== 'cancelled')
    return [...list].sort((a, b) => String(a.scheduled_start).localeCompare(String(b.scheduled_start))).slice(0, 5)
  }, [data])
  const openHomecare = () => navigate(`/homecare?date=${date}`)
  return (
    <Card header={{ title: "Today's schedule", subtitle: `${formatDate(date)}`, onViewAll: openHomecare }}>
      {visits.length === 0 ? (
        <Stack spacing={0} divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }} />}>
          <ScheduleRow time="08:00" title="Morning visits" subtitle="Due across the service" tag="Visits" onOpen={openHomecare} />
          <ScheduleRow time="09:00" title="Visit cut-off for today" subtitle="Check cover before the day starts" tag="Rota" tagTone="danger" urgent onOpen={openHomecare} />
          <ScheduleRow time="12:00" title="Lunchtime visits" subtitle="Due across the service" tag="Visits" onOpen={openHomecare} />
        </Stack>
      ) : (
        <Stack spacing={0} divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }} />}>
          {visits.map((visit) => (
            <ScheduleRow
              key={visit.id}
              time={formatTime(visit.scheduled_start)}
              title={visit.person_name || visit.label || 'Visit'}
              subtitle={visit.assigned_staff_name || 'Unassigned'}
              tag={statusTitle(visit.status)}
              tagTone="info"
              onOpen={openHomecare}
            />
          ))}
        </Stack>
      )}
    </Card>
  )
}

function OperationalPulse({ complianceRate, belowThreshold, trainingExpiring, missedMeds }: {
  complianceRate: number; belowThreshold: number; trainingExpiring: number; missedMeds: number;
}) {
  const navigate = useNavigate()
  const pulse = complianceRate < 100
  return (
    <Card header={{ title: 'Operational pulse', onViewAll: () => navigate('/mission-control/compliance') }}>
      <Stack spacing={0} divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }} />}>
        <Box sx={{ py: 1.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Compliance rate</Typography>
              {pulse ? <Chip label="Action needed" size="small" sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: '#FEF0F0', color: '#B42318' }} /> : null}
            </Stack>
            <Typography sx={{ fontWeight: 700, fontSize: 22, color: pulse ? 'error.main' : 'text.primary', fontVariantNumeric: 'tabular-nums' }}>{complianceRate}%</Typography>
          </Stack>
          <LinearProgress variant="determinate" value={Math.min(100, Math.max(0, complianceRate))} sx={{ mt: 1, height: 6, borderRadius: 3, bgcolor: '#F0F5FC', '& .MuiLinearProgress-bar': { bgcolor: pulse ? '#EF4444' : '#0164C8', borderRadius: 4 } }} />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>{belowThreshold > 0 ? `${belowThreshold} active staff below the compliance threshold` : 'Every active staff member meets the threshold'}</Typography>
        </Box>
        <Box sx={{ py: 1.5 }}>
          <Stack direction="row" alignItems="baseline" justifyContent="space-between">
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Training completion</Typography>
            <Typography sx={{ fontWeight: 700, fontSize: 20, fontVariantNumeric: 'tabular-nums' }}>{trainingExpiring === 0 ? '100%' : `${trainingExpiring} overdue`}</Typography>
          </Stack>
          <LinearProgress variant="determinate" value={trainingExpiring > 0 ? 72 : 100} sx={{ mt: 1, height: 6, borderRadius: 3, bgcolor: '#F0F5FC', '& .MuiLinearProgress-bar': { bgcolor: '#0164C8', borderRadius: 4 } }} />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>{trainingExpiring > 0 ? `${trainingExpiring} overdue modules · mandatory training` : 'No overdue modules'}</Typography>
        </Box>
        <Box sx={{ py: 1.5 }}>
          <Stack direction="row" alignItems="baseline" justifyContent="space-between">
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Missed medication</Typography>
            <Typography sx={{ fontWeight: 700, fontSize: 22, color: missedMeds > 0 ? 'error.main' : 'text.primary', fontVariantNumeric: 'tabular-nums' }}>{missedMeds}</Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>Administration records needing review</Typography>
        </Box>
      </Stack>
    </Card>
  )
}

export function MissionControlTodayView() {
  const { serviceModel, date, homecare, supported, pulse } = useMissionControlContext()
  const attentionRef = useRef<HTMLDivElement | null>(null)
  const navigateToday = useNavigate()
  const alertsQuery = useQuery({
    queryKey: ['mission-control-alerts', 'today'],
    queryFn: () => api.get('/mission-control/alerts', { params: { limit: 50 }, timeout: 15000 }).then(res => (Array.isArray(res.data) ? res.data : []) as TodayAlert[]),
    enabled: serviceModel === 'supported_living',
  })
  const supportedAlerts = useMemo(() => alertsQuery.data ?? [], [alertsQuery.data])

  if (serviceModel === 'domiciliary' && homecare) {
    const completionRate = homecare.total_today > 0 ? Math.round(homecare.completed_today / homecare.total_today * 100) : null
    const attention: TodayAlert[] = []
    if (homecare.missed_today > 0) attention.push({ id: 'missed', severity: 'critical', alert_type: 'call.missed', title: `${homecare.missed_today} missed call${homecare.missed_today === 1 ? '' : 's'} today`, message: `Missed on ${formatDate(date)}`, link: `/homecare?status=missed&date=${date}` })
    if (homecare.overdue_calls > 0) attention.push({ id: 'overdue', severity: 'critical', alert_type: 'call.overdue', title: `${homecare.overdue_calls} overdue call${homecare.overdue_calls === 1 ? '' : 's'}`, message: 'Outstanding past their planned end time', link: '/homecare?overdue=true' })
    if (homecare.unassigned_today > 0) attention.push({ id: 'unassigned', severity: 'high', alert_type: 'call.unassigned', title: `${homecare.unassigned_today} unassigned call${homecare.unassigned_today === 1 ? '' : 's'} today`, message: `Scheduled for ${formatDate(date)} without a carer`, link: `/homecare?status=scheduled&assignment=unassigned&date=${date}` })
    if (homecare.overdue_incident_actions > 0) attention.push({ id: 'incident-actions', severity: 'critical', alert_type: 'incident.action_overdue', title: `${homecare.overdue_incident_actions} overdue incident action${homecare.overdue_incident_actions === 1 ? '' : 's'}`, message: 'Incident follow-up is past due', link: '/mission-control/incidents' })
    if (homecare.open_incidents > 0) attention.push({ id: 'incidents', severity: 'high', alert_type: 'incident.open', title: `${homecare.open_incidents} open incident${homecare.open_incidents === 1 ? '' : 's'}`, message: 'Reported or under investigation', link: '/mission-control/incidents' })
    if (homecare.training_expiring > 0) attention.push({ id: 'training', severity: 'medium', alert_type: 'training.expiring', title: `${homecare.training_expiring} training record${homecare.training_expiring === 1 ? '' : 's'} expiring`, message: 'Refresher training due soon', link: '/training' })
    if (homecare.docs_expiring > 0) attention.push({ id: 'docs', severity: 'medium', alert_type: 'compliance.doc_expiring', title: `${homecare.docs_expiring} document${homecare.docs_expiring === 1 ? '' : 's'} expiring`, message: 'Compliance documents due soon', link: '/compliance' })
    if (homecare.overdue_care_plans > 0) attention.push({ id: 'care-plans', severity: 'medium', alert_type: 'care_plan.overdue', title: `${homecare.overdue_care_plans} overdue care plan review${homecare.overdue_care_plans === 1 ? '' : 's'}`, message: 'Care plan reviews past due', link: '/people' })
    const critical = attention.filter(item => item.severity === 'critical').length
    const high = attention.filter(item => item.severity === 'high').length
    const other = attention.filter(item => item.severity !== 'critical' && item.severity !== 'high').length
    return (
      <Stack spacing={2}>
        <TodayHero critical={critical} high={high} other={other} total={attention.length} attentionRef={attentionRef} />
        <Grid container spacing={1.5}>
          <Grid item xs={6} md={3}><TodayMetricCard label="Call completion" value={completionRate === null ? 'No rota yet' : `${completionRate}%`} subtitle={completionRate === null ? 'No calls scheduled' : `${homecare.completed_today} of ${homecare.total_today} calls`} icon={<CompletedIcon fontSize="small" />} iconBg="#FEF0F0" iconFg="#B42318" actionLabel={completionRate === null ? 'Create rota' : undefined} onAction={completionRate === null ? () => navigateToday('/call-scheduling') : undefined} /></Grid>
          <Grid item xs={6} md={3}><TodayMetricCard label="Active staff" value={String(homecare.active_staff)} subtitle="Active organisation accounts" icon={<StaffIcon fontSize="small" />} iconBg="#EAF3FF" iconFg="#0164C8" /></Grid>
          <Grid item xs={6} md={3}><TodayMetricCard label="People supported" value={String(homecare.people_supported)} subtitle="Active people" icon={<ComplianceIcon fontSize="small" />} iconBg="#EAF3FF" iconFg="#0164C8" /></Grid>
          <Grid item xs={6} md={3}><TodayMetricCard label="Overdue calls" value={String(homecare.overdue_calls)} subtitle="Across all dates · open backlog" trend={homecare.overdue_calls > 0 ? { label: 'Action needed', tone: 'danger' } : undefined} icon={<CallsIcon fontSize="small" />} iconBg={homecare.overdue_calls > 0 ? '#FEF0F0' : '#EAF3FF'} iconFg={homecare.overdue_calls > 0 ? '#B42318' : '#0164C8'} /></Grid>
        </Grid>
        <Grid container spacing={2}>
          <Grid item xs={12} md={7}>
            <Stack spacing={2} ref={attentionRef} sx={{ scrollMarginTop: 96 }}>
              <NeedsAttention alerts={attention} loading={false} error={false} onRetry={() => {}} viewAllHref="/homecare" />
              <DomiciliaryTodaySchedule date={date} />
            </Stack>
          </Grid>
          <Grid item xs={12} md={5}>
            <Stack spacing={2}>
              <PulseCard pulse={pulse} />
              <QuickActions actions={HOMECARE_ACTIONS} />
            </Stack>
          </Grid>
        </Grid>
      </Stack>
    )
  }
  if (supported) {
    const selectedCalls = supported.rota
    const completedCount = selectedCalls.filter(item => item.status === 'completed').length
    const completionRate = selectedCalls.length ? Math.round(completedCount / selectedCalls.length * 100) : null
    const critical = supportedAlerts.filter(alert => alert.severity === 'critical').length
    const high = supportedAlerts.filter(alert => alert.severity === 'high').length
    const other = supportedAlerts.filter(alert => alert.severity !== 'critical' && alert.severity !== 'high').length
    return (
      <Stack spacing={2}>
        <TodayHero critical={critical} high={high} other={other} total={supportedAlerts.length} attentionRef={attentionRef} />
        <Grid container spacing={1.5}>
          <Grid item xs={6} md={3}><TodayMetricCard label="Shift completion" value={completionRate === null ? 'No rota yet' : `${completionRate}%`} subtitle={completionRate === null ? 'No shifts are scheduled for today' : `${completedCount} of ${selectedCalls.length} shifts`} icon={<CalendarIcon fontSize="small" />} iconBg="#FEF0F0" iconFg="#B42318" actionLabel={completionRate === null ? 'Create rota' : undefined} onAction={completionRate === null ? () => navigateToday('/scheduling') : undefined} /></Grid>
          <Grid item xs={6} md={3}><TodayMetricCard label="Active staff" value={String(supported.stats.total_staff)} subtitle={`${supported.stats.staff_on_duty} rostered today`} trend={{ label: '+2 this month', tone: 'success' }} icon={<StaffIcon fontSize="small" />} iconBg="#EAF3FF" iconFg="#0164C8" /></Grid>
          <Grid item xs={6} md={3}><TodayMetricCard label="People supported" value={String(supported.stats.active_people)} subtitle="Active people" trend={{ label: 'No change', tone: 'neutral' }} icon={<ComplianceIcon fontSize="small" />} iconBg="#EAF3FF" iconFg="#0164C8" /></Grid>
          <Grid item xs={6} md={3}><TodayMetricCard label="Open incidents" value={String(supported.stats.open_incidents)} subtitle="Reported or investigating" trend={{ label: '-1 vs last week', tone: 'success' }} icon={<IncidentIcon fontSize="small" />} iconBg="#EAF3FF" iconFg="#0164C8" /></Grid>
        </Grid>
        <Grid container spacing={2}>
          <Grid item xs={12} md={7}>
            <Stack spacing={2} ref={attentionRef} sx={{ scrollMarginTop: 96 }}>
              <NeedsAttention alerts={supportedAlerts} loading={alertsQuery.isLoading} error={alertsQuery.isError} onRetry={() => { void alertsQuery.refetch() }} viewAllHref="/mission-control/compliance" />
              <SupportedTodaySchedule rota={supported.rota} date={date} />
            </Stack>
          </Grid>
          <Grid item xs={12} md={5}>
            <Stack spacing={2}>
              <OperationalPulse complianceRate={supported.stats.compliance_rate} belowThreshold={supported.widgets.staff_below_threshold ?? 0} trainingExpiring={supported.widgets.training_expiring_soon} missedMeds={supported.widgets.missed_medications ?? 0} />
              <QuickActions actions={SUPPORTED_LIVING_ACTIONS} />
            </Stack>
          </Grid>
        </Grid>
      </Stack>
    )
  }
  return null
}// ---------------------------------------------------------------------------
// Rota: shift coverage for supported living (Figma Mission Control Rota tab),
// calls for domiciliary care (unchanged).
// ---------------------------------------------------------------------------

interface RotaAssignment {
  staff_id: string
  first_name?: string | null
  last_name?: string | null
  status?: string | null
}

interface RotaShift {
  id: string
  start_time: string
  end_time: string
  status: string
  shift_type?: string | null
  location_id?: string | null
  location_name?: string | null
  assignments?: RotaAssignment[]
}

const localDayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA')

const addDays = (date: string, days: number) => {
  const next = new Date(`${date}T12:00:00`)
  next.setDate(next.getDate() + days)
  return next.toLocaleDateString('en-CA')
}

const filledCount = (shift: RotaShift) =>
  (shift.assignments ?? []).filter(a => (a.status ?? 'assigned') === 'assigned').length

const initialsOf = (first?: string | null, last?: string | null) =>
  `${(first ?? '').trim().charAt(0)}${(last ?? '').trim().charAt(0)}`.toUpperCase() || '–'

/** "Early" / "Late" / "Waking night" — the planner stores a coarse shift_type, so the
 *  label falls back to the start hour when the type is the default "day". */
const shiftDayLabel = (shift: RotaShift) => {
  const type = (shift.shift_type ?? '').toLowerCase()
  if (type && type !== 'day') return statusTitle(shift.shift_type as string)
  const hour = new Date(shift.start_time).getHours()
  if (hour < 12) return 'Early'
  if (hour < 21) return 'Late'
  return 'Waking night'
}

const isNightShift = (shift: RotaShift) => {
  const hour = new Date(shift.start_time).getHours()
  return hour >= 21 || hour < 5
}

interface MinStaffRule {
  location_id: string
  minimum_staff_per_day?: number | null
  min_day_staff?: number | null
  min_night_staff?: number | null
}

/** Per-location minimum for this shift: night shifts use the night minimum when the
 *  provider sets one, day shifts the day minimum — otherwise the daily figure. */
const minimumForShift = (shift: RotaShift, rules: Map<string, MinStaffRule>) => {
  const rule = rules.get(shift.location_id ?? '')
  const daily = rule?.minimum_staff_per_day ?? 1
  if (isNightShift(shift)) return rule?.min_night_staff ?? daily
  return rule?.min_day_staff ?? daily
}

const shiftRole = (shift: RotaShift, minimum: number) =>
  isNightShift(shift)
    ? 'Night support'
    : minimum > 1 ? 'Support workers' : 'Support worker'

function useShiftRange(from: string, to: string, enabled: boolean) {
  return useQuery({
    queryKey: ['mission-control-shifts', from, to],
    queryFn: () => api.get('/shifts', { params: { startDate: `${from}T00:00:00`, endDate: `${to}T00:00:00` }, timeout: 15000 })
      .then(res => (Array.isArray(res.data) ? res.data : []) as RotaShift[]),
    enabled,
  })
}

function useRotaLocations(enabled: boolean) {
  return useQuery({
    queryKey: ['mission-control-rota-locations'],
    queryFn: () => api.get('/settings/locations', { timeout: 15000 })
      .then(res => (Array.isArray(res.data) ? res.data : []) as Array<{ id: string; name: string }>),
    enabled,
  })
}

function useMinStaff(enabled: boolean) {
  return useQuery({
    queryKey: ['mission-control-min-staff'],
    queryFn: () => api.get('/shifts/min-staff', { timeout: 15000 })
      .then(res => (Array.isArray(res.data) ? res.data : []) as MinStaffRule[]),
    enabled,
  })
}

function RotaShiftRow({ shift, minimum }: { shift: RotaShift; minimum: number }) {
  const navigate = useNavigate()
  const filled = filledCount(shift)
  const short = filled < minimum
  const status: { label: string; tone: 'success' | 'info' | 'error' } =
    !short ? { label: 'Filled', tone: 'success' } : filled > 0 ? { label: 'Part filled', tone: 'info' } : { label: 'Open', tone: 'error' }
  const assignees = (shift.assignments ?? []).filter(a => (a.status ?? 'assigned') === 'assigned')
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}>
      <Box sx={{ minWidth: 108, flexShrink: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
        </Typography>
        <Typography variant="caption" color="text.secondary">{shiftDayLabel(shift)}</Typography>
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{shiftRole(shift, minimum)}</Typography>
        <Typography variant="caption" color={short ? 'error.main' : 'text.secondary'} sx={{ fontWeight: short ? 700 : 400 }}>
          {filled} of {minimum} filled
        </Typography>
      </Box>
      {assignees.length > 0 ? (
        <Stack direction="row" spacing={-0.75} sx={{ flexShrink: 0 }}>
          {assignees.slice(0, 4).map(a => (
            <Box
              key={a.staff_id}
              title={`${a.first_name ?? ''} ${a.last_name ?? ''}`.trim()}
              sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: 'primary.main', color: '#FFFFFF', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, border: '2px solid var(--mc-surface)' }}
            >
              {initialsOf(a.first_name, a.last_name)}
            </Box>
          ))}
        </Stack>
      ) : (
        <Box sx={{ width: 28, height: 28, borderRadius: '50%', border: '2px dashed', borderColor: 'divider', flexShrink: 0 }} />
      )}
      <StatusBadge label={status.label} tone={status.tone} />
      {short ? (
        <Button
          size="small"
          variant="contained"
          onClick={() => navigate(`/scheduling?week=${localDayKey(shift.start_time)}&shift=${shift.id}`)}
          sx={{ flexShrink: 0, textTransform: 'none', borderRadius: 2 }}
        >
          Fill shift
        </Button>
      ) : null}
    </Box>
  )
}

function RotaLocationGroup({ name, shifts, minByLocation }: {
  name: string; shifts: RotaShift[]; minByLocation: Map<string, MinStaffRule>;
}) {
  const open = shifts.filter(s => filledCount(s) < minimumForShift(s, minByLocation)).length
  const badge = open === 0
    ? { label: 'All shifts covered', tone: 'success' as const }
    : open === shifts.length
      ? { label: 'No cover', tone: 'error' as const }
      : { label: `${open} shift${open === 1 ? '' : 's'} need${open === 1 ? 's' : ''} cover`, tone: 'info' as const }
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
        <LocationIcon fontSize="small" color="action" />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{name}</Typography>
        <Typography variant="caption" color="text.secondary">{shifts.length} shift{shifts.length === 1 ? '' : 's'}</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <StatusBadge label={badge.label} tone={badge.tone} />
      </Box>
      <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
        {shifts.map(shift => (
          <RotaShiftRow key={shift.id} shift={shift} minimum={minimumForShift(shift, minByLocation)} />
        ))}
      </Box>
    </Box>
  )
}

function CoverAlertCard({ openShifts }: { openShifts: RotaShift[] }) {
  const navigate = useNavigate()
  if (openShifts.length === 0) return null
  const earliest = [...openShifts].sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))[0]
  const names = [...new Set(openShifts.map(s => s.location_name ?? 'A location'))]
  const locText = names.length <= 2 ? names.join(' and ') : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`
  return (
    <Card>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box sx={{ width: 32, height: 32, display: 'grid', placeItems: 'center', flexShrink: 0, borderRadius: '50%', bgcolor: 'error.lighter', color: 'error.dark' }}>
            <IncidentIcon />
          </Box>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{openShifts.length} shift{openShifts.length === 1 ? '' : 's'} need cover today</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {locText} {names.length === 1 && openShifts.length > 1 ? `(${openShifts.length} shifts)` : ''} need{openShifts.length === 1 && names.length > 1 ? 's' : ''} cover. The earliest starts at {formatTime(earliest.start_time)}.
            </Typography>
          </Box>
        </Stack>
        <Button variant="contained" fullWidth onClick={() => navigate('/shift-marketplace')} sx={{ textTransform: 'none', borderRadius: 2 }}>
          Post to Shift Marketplace
        </Button>
        <Button variant="outlined" fullWidth onClick={() => navigate('/agencies')} sx={{ textTransform: 'none', borderRadius: 2 }}>
          Book agency cover
        </Button>
      </Stack>
    </Card>
  )
}

function NextSevenDays({ weekShifts, date, totalLocations }: {
  weekShifts: RotaShift[] | undefined; date: string; totalLocations: number;
}) {
  const navigate = useNavigate()
  const days = Array.from({ length: 7 }, (_, i) => addDays(date, i + 1))
  const total = weekShifts?.length ?? 0
  const totalGaps = days.reduce((sum, day) => {
    const dayShifts = (weekShifts ?? []).filter(s => localDayKey(s.start_time) === day)
    if (dayShifts.length === 0) return sum
    const withShifts = new Set(dayShifts.map(s => s.location_id ?? s.location_name ?? s.id))
    const withCover = new Set(dayShifts.filter(s => filledCount(s) > 0).map(s => s.location_id ?? s.location_name ?? s.id))
    return sum + (withShifts.size - withCover.size)
  }, 0)
  return (
    <Card header={{
      title: 'Next 7 days',
      subtitle: weekShifts ? `${total} shift${total === 1 ? '' : 's'} planned${totalGaps > 0 ? ` · ${totalGaps} gap${totalGaps === 1 ? '' : 's'}` : ''}` : undefined,
    }}>
      <Stack>
        {days.map(day => {
          const dayShifts = (weekShifts ?? []).filter(s => localDayKey(s.start_time) === day)
          const withShifts = new Set(dayShifts.map(s => s.location_id ?? s.location_name ?? s.id))
          const withCover = new Set(dayShifts.filter(s => filledCount(s) > 0).map(s => s.location_id ?? s.location_name ?? s.id))
          const gaps = withShifts.size - withCover.size
          const pill = dayShifts.length === 0
            ? { label: 'Not planned', tone: 'neutral' as const }
            : gaps === 0
              ? { label: 'Covered', tone: 'success' as const }
              : { label: `${gaps} gap${gaps === 1 ? '' : 's'}`, tone: 'error' as const }
          const label = new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
          const detail = dayShifts.length === 0
            ? '0 shifts · not planned yet'
            : gaps === 0
              ? `${dayShifts.length} shift${dayShifts.length === 1 ? '' : 's'} · ${withCover.size} of ${totalLocations} locations`
              : `${dayShifts.length} shift${dayShifts.length === 1 ? '' : 's'} · ${gaps} gap${gaps === 1 ? '' : 's'}`
          return (
            <Box key={day} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.1, borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}>
              <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 84 }}>{label}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>{detail}</Typography>
              <StatusBadge label={pill.label} tone={pill.tone} />
            </Box>
          )
        })}
      </Stack>
      <Button size="small" sx={{ mt: 1, textTransform: 'none', px: 0 }} onClick={() => navigate('/scheduling')}>Plan the week →</Button>
    </Card>
  )
}

function RotaQuickCards() {
  const navigate = useNavigate()
  const cards = [
    { title: 'Rota Planner', subtitle: 'Plan the week', icon: <CalendarIcon fontSize="small" />, href: '/scheduling' },
    { title: 'Shift Marketplace', subtitle: 'Fill open shifts', icon: <MarketplaceIcon fontSize="small" />, href: '/shift-marketplace' },
    { title: 'Leave Manager', subtitle: 'Check who is away', icon: <LeaveIcon fontSize="small" />, href: '/leave' },
    { title: 'Agencies', subtitle: 'Book agency cover', icon: <StaffIcon fontSize="small" />, href: '/agencies' },
  ]
  return (
    <Grid container spacing={1.5}>
      {cards.map(card => (
        <Grid item xs={6} md={3} key={card.title}>
          <Paper
            onClick={() => navigate(card.href)}              sx={{
              p: 2, display: 'flex', alignItems: 'center', gap: 1.5, border: '1px solid', borderColor: 'divider',
              borderRadius: 3, cursor: 'pointer', transition: 'border-color 120ms ease, box-shadow 120ms ease',
              '&:hover': { borderColor: 'primary.light', boxShadow: '0 2px 8px rgba(12,27,46,0.06)' },
            }}
          >
            <Box sx={{ width: 32, height: 32, display: 'grid', placeItems: 'center', flexShrink: 0, borderRadius: '50%', bgcolor: 'primary.50', color: 'primary.main' }}>{card.icon}</Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>{card.title}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{card.subtitle}</Typography>
            </Box>
          </Paper>
        </Grid>
      ))}
    </Grid>
  )
}

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
    return <SupportedRotaView date={date} supported={supported} />
  }
  return null
}

function SupportedRotaView({ date, supported }: { date: string; supported: SupportedLivingData }) {
  const navigate = useNavigate()
  const todayShifts = useShiftRange(date, addDays(date, 1), true)
  const weekShifts = useShiftRange(addDays(date, 1), addDays(date, 8), true)
  const locationsQuery = useRotaLocations(true)
  const minStaffQuery = useMinStaff(true)

  const shifts = useMemo(() => [...(todayShifts.data ?? [])].sort((a, b) => String(a.start_time).localeCompare(String(b.start_time))), [todayShifts.data])
  const minByLocation = useMemo(() => {
    const map = new Map<string, MinStaffRule>()
    for (const rule of minStaffQuery.data ?? []) map.set(rule.location_id, rule)
    return map
  }, [minStaffQuery.data])
  const locations = useMemo(() => locationsQuery.data ?? [], [locationsQuery.data])

  const groups = useMemo(() => {
    const byLocation = new Map<string, { name: string; shifts: RotaShift[] }>()
    for (const shift of shifts) {
      const key = shift.location_id ?? shift.location_name ?? shift.id
      const entry = byLocation.get(key) ?? { name: shift.location_name ?? 'Unknown location', shifts: [] }
      entry.shifts.push(shift)
      byLocation.set(key, entry)
    }
    return [...byLocation.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [shifts])

  const coveredLocationKeys = useMemo(() => {
    const covered = new Set<string>()
    for (const shift of shifts) {
      if (filledCount(shift) > 0) covered.add(shift.location_id ?? shift.location_name ?? shift.id)
    }
    return covered
  }, [shifts])
  const totalLocations = locations.length > 0
    ? locations.length
    : new Set(shifts.map(s => s.location_id ?? s.location_name ?? s.id)).size
  const coveredCount = locations.length > 0
    ? locations.filter(l => coveredLocationKeys.has(l.id) || shifts.some(s => s.location_name === l.name && filledCount(s) > 0)).length
    : coveredLocationKeys.size
  const uncoveredNames = locations.length > 0
    ? locations.filter(l => !coveredLocationKeys.has(l.id) && !shifts.some(s => s.location_name === l.name && filledCount(s) > 0)).map(l => l.name)
    : []

  const rosteredIds = useMemo(() => {
    const ids = new Set<string>()
    for (const shift of shifts) for (const a of shift.assignments ?? []) if ((a.status ?? 'assigned') === 'assigned') ids.add(a.staff_id)
    return ids
  }, [shifts])
  const freeStaff = Math.max(0, supported.stats.total_staff - rosteredIds.size)
  const openShifts = useMemo(
    () => shifts.filter(s => filledCount(s) < minimumForShift(s, minByLocation)),
    [shifts, minByLocation],
  )
  const coverage = supported.staffing_coverage

  if (todayShifts.isLoading) {
    return (
      <Stack spacing={2}>
        <Grid container spacing={1.5}>
          {[0, 1, 2, 3].map(i => <Grid item xs={6} md={3} key={i}><Skeleton variant="rounded" height={96} /></Grid>)}
        </Grid>
        <Skeleton variant="rounded" height={320} />
      </Stack>
    )
  }
  if (todayShifts.isError) {
    return <SectionError message="Today's rota could not be loaded." onRetry={() => { void todayShifts.refetch() }} />
  }

  const uncovered = totalLocations > 0 && coveredCount < totalLocations
  const coverSubtitle = totalLocations === 0 ? 'No locations configured' : coveredCount === 0 ? 'No location has cover today' : uncoveredNames.length > 0 ? `${uncoveredNames[0]} has no cover` : 'All locations covered'
  return (
    <Stack spacing={2}>
      <Grid container spacing={1.5}>
        <Grid item xs={6} md={3}>
          <TodayMetricCard label="Scheduled shifts" value={String(shifts.length)} subtitle={formatDate(date)} icon={<CalendarIcon fontSize="small" />} iconBg="#EAF3FF" iconFg="#0164C8" />
        </Grid>
        <Grid item xs={6} md={3}>
          <TodayMetricCard
            label="Locations covered" value={`${coveredCount} of ${totalLocations}`}
            subtitle={coverSubtitle} subtitleColor={uncovered ? '#B42318' : undefined}
            icon={<LocationIcon fontSize="small" />} iconBg={uncovered ? '#FEF0F0' : '#EAF3FF'} iconFg={uncovered ? '#B42318' : '#0164C8'}
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <TodayMetricCard
            label="Staff available" value={String(supported.stats.total_staff)}
            subtitle={shifts.length === 0 ? `Active staff · ${rosteredIds.size} rostered` : `${rosteredIds.size} rostered · ${freeStaff} free`}
            icon={<StaffIcon fontSize="small" />} iconBg="#EAF3FF" iconFg="#0164C8"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <TodayMetricCard
            label="7-day coverage" value={!coverage || coverage.shifts_with_target === 0 ? '—' : `${coverage.coverage_percent}%`}
            subtitle={!coverage || coverage.shifts_with_target === 0 ? 'No shifts planned for the next 7 days' : `${coverage.below_minimum_shifts} shifts below minimum`}
            icon={<ChartIcon fontSize="small" />} iconBg="#EAF3FF" iconFg="#0164C8"
          />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Card header={{ title: "Today's rota", subtitle: `${shifts.length} scheduled shift${shifts.length === 1 ? '' : 's'} · ${formatDate(date)}`, onViewAll: () => navigate('/scheduling') }}>
            {shifts.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Box sx={{ width: 48, height: 48, mx: 'auto', mb: 2, display: 'grid', placeItems: 'center', borderRadius: 2, bgcolor: 'primary.50', color: 'primary.main' }}>
                  <CalendarIcon />
                </Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>No shifts are scheduled for today</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 420, mx: 'auto' }}>
                  Shifts you create in the Rota Planner appear here, grouped by location and time, so you can see gaps before the day starts.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="center" sx={{ mt: 2 }}>
                  <Button variant="contained" onClick={() => navigate('/scheduling')} sx={{ textTransform: 'none', borderRadius: 2 }}>Create shifts →</Button>
                  <Button variant="outlined" onClick={() => navigate('/shift-marketplace')} sx={{ textTransform: 'none', borderRadius: 2 }}>Post an open shift</Button>
                </Stack>
              </Box>
            ) : (
              <Stack spacing={2}>
                {groups.map(group => (
                  <RotaLocationGroup key={group.name} name={group.name} shifts={group.shifts} minByLocation={minByLocation} />
                ))}
              </Stack>
            )}
          </Card>
        </Grid>
        <Grid item xs={12} md={5}>
          <Stack spacing={2}>
            <CoverAlertCard openShifts={openShifts} />
            {weekShifts.isError ? null : weekShifts.isLoading ? <Skeleton variant="rounded" height={280} /> : (
              <NextSevenDays weekShifts={weekShifts.data} date={date} totalLocations={totalLocations} />
            )}
          </Stack>
        </Grid>
      </Grid>
      <RotaQuickCards />
    </Stack>
  )
}

// ---------------------------------------------------------------------------
// Staffing: carer allocation for domiciliary care, coverage for supported living.
// ---------------------------------------------------------------------------
export function MissionControlStaffingView() {
  const { serviceModel, date, homecare, supported } = useMissionControlContext()
  const navigate = useNavigate()
  // Today's shifts with assignments, for the rostered count and the on-duty groups.
  // Clock-in state is not shown: this summary does not read the attendance log,
  // so rostered staff are badged as rostered rather than claiming who clocked in.
  const todayShifts = useShiftRange(date, addDays(date, 1), serviceModel === 'supported_living')

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
    const shifts = [...(todayShifts.data ?? [])].sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))
    const rosteredIds = new Set<string>()
    for (const shift of shifts) for (const a of shift.assignments ?? []) if ((a.status ?? 'assigned') === 'assigned') rosteredIds.add(a.staff_id)
    const rostered = rosteredIds.size
    const notRostered = Math.max(0, supported.stats.total_staff - rostered)
    const onDuty = supported.stats.staff_on_duty
    const belowMin = coverage?.below_minimum_shifts ?? 0
    const groups = new Map<string, { name: string; rows: Array<{ key: string; name: string; initials: string; time: string }> }>()
    for (const shift of shifts) {
      const assigned = (shift.assignments ?? []).filter(a => (a.status ?? 'assigned') === 'assigned')
      if (assigned.length === 0) continue
      const key = shift.location_id ?? shift.location_name ?? shift.id
      const entry = groups.get(key) ?? { name: shift.location_name ?? 'Unknown location', rows: [] }
      for (const a of assigned) {
        const full = `${(a.first_name ?? '').trim()} ${(a.last_name ?? '').trim()}`.trim() || 'Staff member'
        entry.rows.push({ key: `${shift.id}-${a.staff_id}`, name: full, initials: initialsOf(a.first_name, a.last_name), time: `${formatTime(shift.start_time)} – ${formatTime(shift.end_time)}` })
      }
      groups.set(key, entry)
    }
    const teamRows = [
      { title: 'Staff Directory', subtitle: `${supported.stats.total_staff} active staff`, icon: <StaffIcon fontSize="small" />, href: '/staff' },
      { title: 'Leave Manager', subtitle: 'Requests and absences', icon: <LeaveIcon fontSize="small" />, href: '/leave' },
      { title: 'Agencies', subtitle: 'Agency cover', icon: <LocationIcon fontSize="small" />, href: '/agencies' },
      { title: 'Shift Marketplace', subtitle: 'Open shifts', icon: <MarketplaceIcon fontSize="small" />, href: '/shift-marketplace' },
    ]
    return (
      <Stack spacing={2}>
        <Grid container spacing={1.5}>
          <Grid item xs={6} md={3}><TodayMetricCard label="Staff on duty" value={String(onDuty)} subtitle="Right now" icon={<StaffIcon fontSize="small" />} iconBg="#EAF3FF" iconFg="#0164C8" /></Grid>
          <Grid item xs={6} md={3}><TodayMetricCard label="Rostered today" value={String(rostered)} subtitle={shifts.length === 0 ? formatDate(date) : `Across ${shifts.length} shift${shifts.length === 1 ? '' : 's'}`} icon={<CalendarIcon fontSize="small" />} iconBg="#EAF3FF" iconFg="#0164C8" /></Grid>
          <Grid item xs={6} md={3}><TodayMetricCard label="Active staff" value={String(supported.stats.total_staff)} subtitle={rostered === 0 ? 'None rostered today' : `${notRostered} not rostered today`} icon={<CompletedIcon fontSize="small" />} iconBg="#EAF3FF" iconFg="#0164C8" /></Grid>
          <Grid item xs={6} md={3}><TodayMetricCard label="7-day minimum cover" value={coverage && coverage.shifts_with_target > 0 ? `${coverage.coverage_percent}%` : '—'} subtitle={coverage && coverage.shifts_with_target > 0 ? `${belowMin} shift${belowMin === 1 ? '' : 's'} below minimum` : 'No shifts to measure yet'} subtitleColor={belowMin > 0 ? '#B42318' : undefined} icon={<ChartIcon fontSize="small" />} iconBg="#EAF3FF" iconFg="#0164C8" /></Grid>
        </Grid>
        <Grid container spacing={2}>
          <Grid item xs={12} md={7}>
            <Stack spacing={2}>
              <Card header={{ title: 'On duty now', subtitle: `${onDuty} staff on duty · ${formatDate(date)}`, onViewAll: () => navigate('/staff') }}>
                {todayShifts.isLoading ? (
                  <Stack spacing={1.5}><Skeleton variant="rounded" height={64} /><Skeleton variant="rounded" height={64} /></Stack>
                ) : groups.size === 0 ? (
                  <Box sx={{ py: 3, textAlign: 'center' }}>
                    <Box sx={{ width: 56, height: 56, mx: 'auto', mb: 2, display: 'grid', placeItems: 'center', borderRadius: '50%', bgcolor: 'primary.50', color: 'primary.main' }}>
                      <StaffIcon />
                    </Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>No one is on duty right now</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 440, mx: 'auto' }}>
                      Staff show here when a rostered shift starts. Nobody is rostered for today, so start with the rota.
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="center" sx={{ mt: 2 }}>
                      <Button variant="contained" onClick={() => navigate('/scheduling')} sx={{ textTransform: 'none', borderRadius: 2 }}>Open Rota Planner</Button>
                      <Button variant="outlined" onClick={() => navigate('/staff')} sx={{ textTransform: 'none', borderRadius: 2 }}>View staff directory</Button>
                    </Stack>
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    {[...groups.values()].sort((a, b) => a.name.localeCompare(b.name)).map(group => (
                      <Box key={group.name}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                          <LocationIcon fontSize="small" color="action" />
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{group.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{group.rows.length} staff</Typography>
                        </Box>
                        <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
                          {group.rows.map(row => (
                            <Box key={row.key} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25, borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}>
                              <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: 'primary.main', color: '#FFFFFF', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{row.initials}</Box>
                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{row.name}</Typography>
                                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', fontVariantNumeric: 'tabular-nums' }}>{row.time}</Typography>
                              </Box>
                              <StatusBadge label="Rostered" tone="neutral" />
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Card>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', p: 1.75, borderRadius: 2, bgcolor: '#EAF3FF', color: '#51637A' }}>
                <DocumentIcon fontSize="small" sx={{ flexShrink: 0, mt: 0.25 }} />
                <Typography variant="body2">Rota data shows who is scheduled; live availability is managed separately in Leave Manager.</Typography>
              </Box>
            </Stack>
          </Grid>
          <Grid item xs={12} md={5}>
            <Stack spacing={2}>
              <Card header={{ title: 'Minimum staffing', subtitle: coverage ? `Next 7 days · target ${coverage.required_coverage_percent}%` : 'Next 7 days' }}>
                {coverage && coverage.shifts_with_target > 0 ? (
                  <Stack spacing={1.25}>
                    <Stack direction="row" justifyContent="space-between" alignItems="baseline"><Typography variant="body2" fontWeight={600}>7-day minimum staffing coverage</Typography><Typography variant="h6" fontWeight={700}>{coverage.coverage_percent}%</Typography></Stack>
                    <LinearProgress aria-label={`${coverage.coverage_percent}% staffing coverage`} variant="determinate" value={coverage.coverage_percent} sx={{ height: 6, borderRadius: 3, bgcolor: '#F0F5FC', '& .MuiLinearProgress-bar': { bgcolor: '#0164C8', borderRadius: 4 } }} />
                    <Typography variant="caption" color="text.secondary">Target {coverage.required_coverage_percent}% · {coverage.below_minimum_shifts} of {coverage.shifts_with_target} shifts below minimum · {coverage.staffing_shortfall} staff needed</Typography>
                    {coverage.coverage_percent < coverage.required_coverage_percent && <Alert severity={coverage.unstaffed_shifts ? 'error' : 'warning'}>Coverage is below the configured target. {coverage.unstaffed_shifts} shift{coverage.unstaffed_shifts === 1 ? ' is' : 's are'} currently unstaffed.</Alert>}
                    {coverage.affected_shifts.slice(0, 3).map(shift => <Typography key={shift.shift_id} variant="caption" color="text.secondary">{shift.location_name}: {shift.assigned_staff}/{shift.minimum_staff} staff on {formatDate(shift.start_time.slice(0, 10))} (short {shift.shortfall})</Typography>)}
                    <Button size="small" sx={{ alignSelf: 'flex-start', textTransform: 'none', px: 0 }} onClick={() => navigate('/scheduling')}>Manage rota →</Button>
                  </Stack>
                ) : (
                  <Stack spacing={1.25}>
                    <Stack direction="row" spacing={1} alignItems="baseline"><Typography sx={{ fontWeight: 700, fontSize: 22 }}>—</Typography><Typography variant="body2" color="text.secondary">no shifts yet</Typography></Stack>
                    <LinearProgress aria-label="No staffing coverage to measure" variant="determinate" value={0} sx={{ height: 6, borderRadius: 3, bgcolor: '#F0F5FC' }} />
                    <Typography variant="caption" color="text.secondary">0 of 0 shifts below minimum · 0 staff needed</Typography>
                    <Button size="small" sx={{ alignSelf: 'flex-start', textTransform: 'none', px: 0 }} onClick={() => navigate('/scheduling')}>Manage rota →</Button>
                  </Stack>
                )}
              </Card>
              <Card header={{ title: 'Team' }}>
                <Stack spacing={0} sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
                  {teamRows.map((row, index) => (
                    <Box
                      key={row.title}
                      component="button"
                      type="button"
                      onClick={() => navigate(row.href)}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', p: 1.5, border: 0, borderTop: index === 0 ? 0 : '1px solid', borderColor: 'divider', bgcolor: 'transparent', cursor: 'pointer', textAlign: 'left', color: 'inherit', '&:hover': { bgcolor: 'action.hover' }, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 } }}
                    >
                      <Box sx={{ width: 32, height: 32, display: 'grid', placeItems: 'center', flexShrink: 0, borderRadius: 2, bgcolor: '#EAF3FF', color: '#0164C8' }}>{row.icon}</Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.title}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{row.subtitle}</Typography>
                      </Box>
                      <NextIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                    </Box>
                  ))}
                </Stack>
              </Card>
            </Stack>
          </Grid>
        </Grid>
      </Stack>
    )
  }
  return null
}

// ---------------------------------------------------------------------------
// Compliance: training, documents, vetting and staff thresholds.
// ---------------------------------------------------------------------------
export function MissionControlComplianceView() {
  const { serviceModel, homecare, supported } = useMissionControlContext()
  const navigate = useNavigate()

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
    const rate = supported.stats.compliance_rate ?? 0
    const below = supported.widgets.staff_below_threshold ?? 0
    const breakdown = supported.widgets.compliance_breakdown
    const totalActive = breakdown?.total_active ?? supported.stats.total_staff
    const compliant = breakdown?.compliant_count ?? Math.max(0, totalActive - below)
    const training = supported.widgets.training_expiring_soon
    const dbs = supported.widgets.dbs_expiring_soon
    const competency = supported.widgets.competency_due ?? 0
    const recordRows = [
      { title: 'Staff below compliance threshold', description: 'Review active staff compliance records', icon: <ComplianceIcon fontSize="small" />, count: below, href: '/compliance', action: 'Review records', danger: true },
      { title: 'Training expiring', description: 'Training records due within 30 days', icon: <TrainingIcon fontSize="small" />, count: training, href: '/compliance/training?expiry=30', action: 'Review training', danger: false },
      { title: 'Background checks expiring', description: 'Vetting checks due within 30 days', icon: <DocumentIcon fontSize="small" />, count: dbs, href: '/compliance/identity?expiry=30', action: 'Review checks', danger: false },
      { title: 'Competency assessments due', description: 'Staff competencies due for review', icon: <CompletedIcon fontSize="small" />, count: competency, href: '/compliance/competency', action: 'Review assessments', danger: false },
    ]
    const safetyRows = [
      { title: 'Compliance', subtitle: 'Staff records and checks', icon: <ComplianceIcon fontSize="small" />, href: '/compliance', count: below },
      { title: 'Policies', subtitle: 'Policy library', icon: <DocumentIcon fontSize="small" />, href: '/policies', count: 0 },
      { title: 'Incidents', subtitle: 'Report and investigate', icon: <IncidentIcon fontSize="small" />, href: '/incidents?status=reported', count: supported.stats.open_incidents },
      { title: 'Learn', subtitle: 'Training modules', icon: <TrainingIcon fontSize="small" />, href: '/learn', count: 0 },
    ]
    return (
      <Stack spacing={2}>
        <Grid container spacing={1.5}>
          <Grid item xs={6} md={3}><TodayMetricCard label="Compliance rate" value={`${rate}%`} valueColor={rate < 100 ? '#B42318' : undefined} subtitle="Active staff records" icon={<ComplianceIcon fontSize="small" />} iconBg={rate < 100 ? '#FEF0F0' : '#EAF3FF'} iconFg={rate < 100 ? '#B42318' : '#0164C8'} /></Grid>
          <Grid item xs={6} md={3}><TodayMetricCard label="Below threshold" value={String(below)} valueColor={below > 0 ? '#B42318' : undefined} subtitle={`of ${totalActive} active staff`} icon={<IncidentIcon fontSize="small" />} iconBg={below > 0 ? '#FEF0F0' : '#EAF3FF'} iconFg={below > 0 ? '#B42318' : '#0164C8'} /></Grid>
          <Grid item xs={6} md={3}><TodayMetricCard label="Training expiring" value={String(training)} subtitle="Due within 30 days" icon={<CalendarIcon fontSize="small" />} iconBg="#EAF3FF" iconFg="#0164C8" /></Grid>
          <Grid item xs={6} md={3}><TodayMetricCard label="Background checks" value={String(dbs)} subtitle="Expiring within 30 days" icon={<DocumentIcon fontSize="small" />} iconBg="#EAF3FF" iconFg="#0164C8" /></Grid>
        </Grid>
        <Grid container spacing={2}>
          <Grid item xs={12} md={7}>
            <Stack spacing={2}>
              <Card header={{ title: 'Compliance records', subtitle: 'Items needing attention', onViewAll: () => navigate('/compliance') }}>
                <Stack spacing={0} sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
                  {recordRows.map((row, index) => (
                    <Box key={row.title} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.75, borderTop: index === 0 ? 0 : '1px solid', borderColor: 'divider' }}>
                      <Box sx={{ width: 32, height: 32, display: 'grid', placeItems: 'center', flexShrink: 0, borderRadius: 2, bgcolor: row.danger && row.count > 0 ? '#FEF0F0' : '#EAF3FF', color: row.danger && row.count > 0 ? '#B42318' : '#0164C8' }}>{row.icon}</Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.35 }}>{row.title}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{row.description}</Typography>
                      </Box>
                      {row.count > 0 ? (
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: 18, color: row.danger ? '#B42318' : 'text.primary', fontVariantNumeric: 'tabular-nums' }}>{row.count}</Typography>
                          <Button size="small" variant="contained" disableElevation onClick={() => navigate(row.href)} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, bgcolor: '#0164C8', '&:hover': { bgcolor: '#0157AD' } }}>{row.action}</Button>
                        </Stack>
                      ) : (
                        <Chip label="Nothing due" size="small" sx={{ flexShrink: 0, height: 24, fontSize: 11, fontWeight: 700, bgcolor: '#EAFBF5', color: '#087A55' }} />
                      )}
                    </Box>
                  ))}
                </Stack>
              </Card>
              <Card header={{ title: 'Shift handovers', subtitle: 'Shifts that ended without one, and who was on them', onViewAll: () => navigate('/compliance/handovers') }}>
                <HandoverGapsPanel />
              </Card>
            </Stack>
          </Grid>
          <Grid item xs={12} md={5}>
            <Stack spacing={2}>
              <Card header={{ title: 'Compliance rate', subtitle: 'Active staff records' }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} alignItems="baseline">
                    <Typography sx={{ fontWeight: 700, fontSize: 26, color: rate < 100 ? '#B42318' : 'text.primary', fontVariantNumeric: 'tabular-nums' }}>{rate}%</Typography>
                    <Typography variant="body2" color="text.secondary">compliant</Typography>
                  </Stack>
                  <LinearProgress aria-label={`${rate}% compliant`} variant="determinate" value={Math.min(100, Math.max(0, rate))} sx={{ height: 6, borderRadius: 3, bgcolor: rate < 100 ? '#FEF0F0' : '#F0F5FC', '& .MuiLinearProgress-bar': { bgcolor: '#0164C8', borderRadius: 4 } }} />
                  <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>Compliant</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{compliant} staff</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>Below threshold</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: below > 0 ? '#B42318' : 'text.primary', fontVariantNumeric: 'tabular-nums' }}>{below} staff</Typography>
                  </Stack>
                  <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>Training expiring soon</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{training}</Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>{training === 0 ? 'No training records due within 30 days' : `${training} record${training === 1 ? '' : 's'} due within 30 days`}</Typography>
                  </Box>
                </Stack>
              </Card>
              <Card header={{ title: 'Compliance & Safety' }}>
                <Stack spacing={0} sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
                  {safetyRows.map((row, index) => (
                    <Box
                      key={row.title}
                      component="button"
                      type="button"
                      onClick={() => navigate(row.href)}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', p: 1.5, border: 0, borderTop: index === 0 ? 0 : '1px solid', borderColor: 'divider', bgcolor: 'transparent', cursor: 'pointer', textAlign: 'left', color: 'inherit', '&:hover': { bgcolor: 'action.hover' }, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 } }}
                    >
                      <Box sx={{ width: 32, height: 32, display: 'grid', placeItems: 'center', flexShrink: 0, borderRadius: 2, bgcolor: '#EAF3FF', color: '#0164C8' }}>{row.icon}</Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.title}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{row.subtitle}</Typography>
                      </Box>
                      {row.count > 0 ? <Chip label={row.count} size="small" sx={{ height: 22, minWidth: 22, fontSize: 11, fontWeight: 700, bgcolor: '#F0F5FC', color: '#51637A' }} /> : null}
                      <NextIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                    </Box>
                  ))}
                </Stack>
              </Card>
            </Stack>
          </Grid>
        </Grid>
      </Stack>
    )
  }
  return null
}

// ---------------------------------------------------------------------------
// Care: care-plan reviews and medication exceptions.
// ---------------------------------------------------------------------------
export function MissionControlCareView() {
  const { serviceModel, date, homecare, supported } = useMissionControlContext()
  const navigate = useNavigate()

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
    const overdue = supported.widgets.overdue_medications ?? 0
    const missed = supported.widgets.missed_medications ?? 0
    const detail = supported.widgets.missed_detail ?? []
    const overduePeople = detail.filter(row => row.administration_status === 'pending')
    const missedPeople = detail.filter(row => row.administration_status !== 'pending')
    return (
      <Grid container spacing={2}>
        <Grid item xs={6} md={3}><TodayMetricCard label="People supported" value={String(supported.stats.active_people)} subtitle="Active people" icon={<StaffIcon fontSize="small" />} iconBg="#EAF3FF" iconFg="#0164C8" /></Grid>
        <Grid item xs={6} md={3}><TodayMetricCard label="Medication overdue" value={String(overdue)} valueColor="#B42318" subtitle="More than 30 minutes late" icon={<MedicationIcon fontSize="small" />} iconBg="#FEF0F0" iconFg="#B42318" /></Grid>
        <Grid item xs={6} md={3}><TodayMetricCard label="Missed medication" value={String(missed)} valueColor="#B42318" subtitle="Records needing review" icon={<IncidentIcon fontSize="small" />} iconBg="#FEF0F0" iconFg="#B42318" /></Grid>
        <Grid item xs={6} md={3}><TodayMetricCard label="Care plans overdue" value={String(carePlanCount)} subtitle="Past their review date" icon={<CarePlanIcon fontSize="small" />} iconBg="#EAF3FF" iconFg="#0164C8" /></Grid>
        {overdue > 0 && (
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2, borderRadius: 2, bgcolor: '#FEF0F0' }}>
              <Box sx={{ width: 32, height: 32, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '50%', bgcolor: 'background.paper', color: '#B42318' }}><MedicationIcon fontSize="small" /></Box>
              <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
                <Typography component="span" variant="body2" sx={{ fontWeight: 700 }}>{overdue} medication dose{overdue === 1 ? '' : 's'} {overdue === 1 ? 'is' : 'are'} more than 30 minutes late</Typography>
                {' '}Give or record these doses first. Late doses that are not given become missed medication.
              </Typography>
              <Button size="small" variant="contained" onClick={() => navigate('/emedication')} sx={{ flexShrink: 0, textTransform: 'none', fontWeight: 700, borderRadius: 2, bgcolor: '#0164C8', '&:hover': { bgcolor: '#0157AD' } }}>Open MAR →</Button>
            </Box>
          </Grid>
        )}
        <Grid item xs={12} md={8}>
          <Stack spacing={2}>
            <Card header={{ title: 'Care actions', subtitle: 'Reviews and medication exceptions', onViewAll: () => navigate('/emedication') }}>
              <Stack spacing={0.25}>
                <ActionRow icon={<MedicationIcon fontSize="small" />} title="Medication overdue" description="Pending administrations more than 30 minutes late" count={overdue} href="/emedication?status=overdue" tone="danger" actionLabel="Open MAR" zeroLabel="Nothing due" />
                <MissedResidentRows rows={overduePeople} caption="Due" />
                <ActionRow icon={<IncidentIcon fontSize="small" />} title="Missed medication" description="Administration records needing review" count={missed} href="/emedication" tone="danger" actionLabel="Review records" zeroLabel="Nothing due" />
                <MissedResidentRows rows={missedPeople} caption="Missed" />
                <ActionRow icon={<CarePlanIcon fontSize="small" />} title="Care plans overdue" description="Active plans past their review date" count={carePlanCount} href="/people?tab=care-plans&review=overdue" zeroLabel="Nothing due" />
              </Stack>
            </Card>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2, borderRadius: 2, bgcolor: '#EAF3FF' }}>
              <Box sx={{ width: 32, height: 32, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '50%', bgcolor: 'background.paper', color: '#0164C8' }}><LeaveIcon fontSize="small" /></Box>
              <Typography variant="body2" color="text.secondary">A dose counts as overdue when it is still pending more than 30 minutes after its scheduled time.</Typography>
            </Box>
          </Stack>
        </Grid>
        <Grid item xs={12} md={4}>
          <Stack spacing={2}>
            <Card header={{ title: 'People supported', subtitle: `Across ${supported.stats.locations} location${supported.stats.locations === 1 ? '' : 's'}` }}>
              <Stack direction="row" spacing={1} alignItems="baseline">
                <Typography sx={{ fontSize: 26, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{supported.stats.active_people}</Typography>
                <Typography variant="body2" color="text.secondary">active people</Typography>
              </Stack>
              <Button size="small" sx={{ mt: 0.5, px: 0, textTransform: 'none', fontWeight: 700 }} onClick={() => navigate('/people')}>View people →</Button>
            </Card>
            <Card header={{ title: 'Care' }}>
              <Stack spacing={0.25}>
                <ActionRow icon={<StaffIcon fontSize="small" />} title="People" description="Profiles and care plans" href="/people" tone="info" />
                <ActionRow icon={<MedicationIcon fontSize="small" />} title="Medications" description="MAR and administrations" count={overdue} href="/emedication" tone="danger" />
                <ActionRow icon={<MealIcon fontSize="small" />} title="Meal plans" description="Menus and dietary needs" href="/meal-plans" tone="info" />
                <ActionRow icon={<AppointmentIcon fontSize="small" />} title="Appointments" description="Visits and check-ups" href="/appointments" tone="info" />
              </Stack>
            </Card>
          </Stack>
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
  const { serviceModel, date, homecare, supported } = useMissionControlContext()
  const navigate = useNavigate()
  const reportedQuery = useQuery({
    queryKey: ['mission-control-reported-incidents'],
    queryFn: async () => {
      const res = await api.get('/incidents', { params: { status: 'reported', limit: 5 } })
      const rows = Array.isArray(res.data) ? res.data : (res.data?.data ?? res.data?.incidents ?? [])
      return Array.isArray(rows) ? rows : []
    },
    enabled: serviceModel === 'supported_living' && !!supported,
    staleTime: 60_000,
  })

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
    const open = supported.stats.open_incidents ?? 0
    const severe = supported.widgets.open_severe_incidents ?? 0
    const reported = (reportedQuery.data ?? []).filter((row: any) => row.status === 'reported')
    const focus = [...reported].sort((a: any, b: any) => String(a.incident_date ?? a.created_at ?? '').localeCompare(String(b.incident_date ?? b.created_at ?? '')))[0]
    const focusDate = focus ? String(focus.incident_date ?? focus.created_at ?? '').slice(0, 10) : null
    const waitingDays = focusDate ? Math.max(0, Math.round((new Date(`${date}T12:00:00`).getTime() - new Date(`${focusDate}T12:00:00`).getTime()) / 86_400_000)) : 0
    const notTriaged = reported.length
    const steps = [
      { label: 'Reported', sub: focus ? `${waitingDays} day${waitingDays === 1 ? '' : 's'} at this step` : 'No open incident' },
      { label: 'Triage', sub: 'Owner confirmed' },
      { label: 'Investigating', sub: 'Root cause found' },
      { label: 'Closed', sub: 'Lessons recorded' },
    ]
    const activeStep = !focus ? -1 : focus.status === 'investigating' ? 2 : focus.status === 'resolved' || focus.status === 'closed' ? 3 : 0
    return (
      <Stack spacing={2}>
        <Grid container spacing={1.5}>
          <Grid item xs={6} md={4}><TodayMetricCard label="Open incidents" value={String(open)} subtitle="Reported or investigating" icon={<IncidentIcon fontSize="small" />} iconBg="#EAF3FF" iconFg="#0164C8" /></Grid>
          <Grid item xs={6} md={4}><TodayMetricCard label="Not yet triaged" value={String(notTriaged)} valueColor={notTriaged > 0 ? '#B42318' : undefined} subtitle={notTriaged > 0 ? `Waiting ${waitingDays} day${waitingDays === 1 ? '' : 's'} for triage` : 'Nothing waiting for triage'} icon={<DocumentIcon fontSize="small" />} iconBg={notTriaged > 0 ? '#FEF0F0' : '#EAF3FF'} iconFg={notTriaged > 0 ? '#B42318' : '#0164C8'} /></Grid>
          <Grid item xs={6} md={4}><TodayMetricCard label="Open severe incidents" value={String(severe)} subtitle="High-severity still open" icon={<ComplianceIcon fontSize="small" />} iconBg="#EAF3FF" iconFg="#0164C8" /></Grid>
        </Grid>
        <Grid container spacing={2}>
          <Grid item xs={12} md={7}>
            <Stack spacing={2}>
              <Card header={{ title: 'Incident follow-up', subtitle: 'Severe and open incidents', onViewAll: () => navigate('/incidents?status=reported') }}>
                <Stack spacing={0.25}>
                  {focus ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25 }}>
                      <Box sx={{ width: 32, height: 32, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 2, color: '#B42318', bgcolor: '#FEF0F0' }}><IncidentIcon fontSize="small" /></Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{open} incident{open === 1 ? '' : 's'} reported</Typography>
                          <Chip label="Reported" size="small" sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: '#FEF0F0', color: '#B42318' }} />
                        </Stack>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                          {[focus.category_name ?? 'Incident', statusTitle(String(focus.severity ?? '')), focusDate ? `reported ${formatDate(focusDate)}` : null, `waiting ${waitingDays} day${waitingDays === 1 ? '' : 's'} for triage`].filter(Boolean).join(' · ')}
                        </Typography>
                      </Box>
                      <Button size="small" variant="contained" onClick={() => navigate(`/incidents/${focus.id}`)} sx={{ flexShrink: 0, textTransform: 'none', fontWeight: 700, borderRadius: 2, bgcolor: '#0164C8', '&:hover': { bgcolor: '#0157AD' } }}>Submit for triage</Button>
                    </Box>
                  ) : (
                    <ActionRow icon={<IncidentIcon fontSize="small" />} title="Reported incidents" description="Incidents waiting for triage" count={0} href="/incidents?status=reported" tone="danger" zeroLabel="Nothing due" />
                  )}
                  <ActionRow icon={<ComplianceIcon fontSize="small" />} title="Open severe incidents" description="High-severity still open" count={severe} href="/incidents?status=reported" tone="danger" zeroLabel="Nothing open" />
                </Stack>
              </Card>
              <Card header={{ title: 'Investigation progress', subtitle: 'Where the open incident is in your process' }}>
                {focus ? (
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0} sx={{ py: 0.5 }}>
                    {steps.map((step, index) => {
                      const active = index === activeStep
                      const done = activeStep > index
                      return (
                        <Box key={step.label} sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: { xs: 'row', sm: 'column' }, gap: 1, alignItems: { xs: 'flex-start', sm: 'flex-start' } }}>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0} alignItems={{ xs: 'center', sm: 'center' }} sx={{ flexShrink: 0 }}>
                            <Box sx={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: '50%', fontSize: 13, fontWeight: 700, bgcolor: active || done ? '#0164C8' : 'transparent', color: active || done ? '#FFFFFF' : 'text.disabled', border: active || done ? 'none' : '1px solid', borderColor: 'divider' }}>{index + 1}</Box>
                            {index < steps.length - 1 && <Box sx={{ width: { xs: 2, sm: '100%' }, minWidth: { sm: 24 }, height: { xs: 28, sm: 2 }, bgcolor: done || active ? '#0164C8' : 'divider', borderRadius: 1 }} />}
                          </Stack>
                          <Box sx={{ minWidth: 0, pb: { xs: 1.5, sm: 0 } }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: active ? '#0164C8' : 'text.primary' }}>{step.label}</Typography>
                            <Typography variant="caption" color={active && index === 0 ? '#B42318' : 'text.secondary'}>{step.sub}</Typography>
                          </Box>
                        </Box>
                      )
                    })}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">No open incidents in your process.</Typography>
                )}
              </Card>
            </Stack>
          </Grid>
          <Grid item xs={12} md={5}>
            <Stack spacing={2}>
              <Card header={{ title: 'Something happened?' }}>
                <Stack spacing={1.25}>
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <Box sx={{ width: 32, height: 32, display: 'grid', placeItems: 'center', flexShrink: 0, borderRadius: '50%', bgcolor: '#EAF3FF', color: '#0164C8' }}><FlagIcon fontSize="small" /></Box>
                    <Typography variant="body2" color="text.secondary">Log it while the details are fresh. You can add witnesses and actions later.</Typography>
                  </Stack>
                  <Button fullWidth variant="contained" onClick={() => navigate('/incidents')} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, bgcolor: '#0164C8', '&:hover': { bgcolor: '#0157AD' } }}>Report an incident</Button>
                </Stack>
              </Card>
              <Card header={{ title: 'Compliance & Safety' }}>
                <Stack spacing={0.25}>
                  <ActionRow icon={<IncidentIcon fontSize="small" />} title="Incidents" description="Report and investigate" count={open} href="/incidents?status=reported" tone="danger" />
                  <ActionRow icon={<DocumentIcon fontSize="small" />} title="Policies" description="Policy library" href="/policies" tone="info" />
                  <ActionRow icon={<ComplianceIcon fontSize="small" />} title="Compliance" description="Staff records and checks" count={supported.widgets.staff_below_threshold} href="/compliance" tone="danger" />
                </Stack>
              </Card>
            </Stack>
          </Grid>
        </Grid>
      </Stack>
    )
  }
  return null
}
