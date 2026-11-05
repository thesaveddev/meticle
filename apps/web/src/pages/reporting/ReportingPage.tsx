import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Grid, Card, CardContent, Stack, TextField, InputAdornment, Chip,
  CircularProgress, Alert, Avatar, Paper, Button, MenuItem, IconButton, Tooltip,
} from '@mui/material'
import PageContainer from '../../components/design/PageContainer'
import {
  Search as SearchIcon,
  People as PeopleIcon, Group as GroupIcon, CalendarMonth as CalendarIcon,
  BeachAccess as LeaveIcon, WarningAmber as WarningIcon, Assessment as AssessIcon,
  School as SchoolIcon, Medication as MedIcon, Psychology as PsychIcon,
  Event as EventIcon, MeetingRoom as MeetingRoomIcon, Star as StarIcon,
  MonitorHeart as MonitorHeartIcon, Task as TaskIcon, Payments as PaymentsIcon,
  ArrowForward as ArrowForwardIcon, TrendingUp as TrendingUpIcon,
  BookmarkBorder as BookmarkIcon, Bookmark as BookmarkFullIcon,
  FavoriteBorder as HeartIcon,
} from '@mui/icons-material'
import api from '../../services/api'
import { getPinnedReports, togglePin, getReportViewedAt, viewedLabel, getReportsLocation, setReportsLocation } from './reportPins'
import ReportFiltersDialog, { reportFiltersToBuilderInitial, type ReportFilterValues } from './dialogs/ReportFiltersDialog'
import SelectReportsDialog from './dialogs/SelectReportsDialog'

const ICON_MAP: Record<string, React.ReactNode> = {
  People: <PeopleIcon />, Group: <GroupIcon />, CalendarMonth: <CalendarIcon />,
  BeachAccess: <LeaveIcon />, WarningAmber: <WarningIcon />, Assessment: <AssessIcon />,
  School: <SchoolIcon />, Medication: <MedIcon />, Psychology: <PsychIcon />,
  LocationOn: <AssessIcon />, Badge: <PeopleIcon />, Description: <AssessIcon />,
  Star: <StarIcon />, Assignment: <AssessIcon />, Note: <AssessIcon />,
  FactCheck: <AssessIcon />, Schedule: <CalendarIcon />, Business: <AssessIcon />,
  Balance: <LeaveIcon />, AccountTree: <AssessIcon />, ShowChart: <AssessIcon />,
  Timer: <LeaveIcon />, Person: <PeopleIcon />, MenuBook: <SchoolIcon />,
  ReportProblem: <WarningIcon />, EmojiEvents: <SchoolIcon />, Science: <MedIcon />,
  Favorite: <PsychIcon />, TrendingUp: <AssessIcon />,
  Event: <EventIcon />, MeetingRoom: <MeetingRoomIcon />,
  MonitorHeart: <MonitorHeartIcon />, Task: <TaskIcon />, Payments: <PaymentsIcon />,
}

const FILTER_LABELS: Record<string, string> = {
  dateRange: 'Date', location: 'Location', department: 'Department', role: 'Role',
  status: 'Status', severity: 'Severity', category: 'Category',
}

interface ReportDef {
  id: string; title: string; description: string; category: string; icon: string; color: string; filters: string[]
}
interface Category { id: string; label: string; color: string; icon: string }
interface OverviewCard { label: string; value: string | number; subtitle: string; color: string }
interface OverviewData { cards: OverviewCard[]; attention: { label: string; value: number; action: string; target: string }[]; generatedAt: string }

const METRIC_ICONS: Record<string, React.ReactNode> = {
  'Active staff': <GroupIcon sx={{ fontSize: 20 }} />,
  'People supported': <HeartIcon sx={{ fontSize: 20 }} />,
  'Training completion': <SchoolIcon sx={{ fontSize: 20 }} />,
  'Missed medication': <WarningIcon sx={{ fontSize: 20 }} />,
}

/** The four Figma 10.1 headline figures, in Figma order. */
const METRIC_LABELS = ['Active staff', 'People supported', 'Training completion', 'Missed medication']

export default function ReportingPage() {
  const navigate = useNavigate()
  const [reports, setReports] = useState<ReportDef[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isDomiciliary, setIsDomiciliary] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [savedOnly, setSavedOnly] = useState(false)
  const [locationFilter, setLocationFilter] = useState(() => getReportsLocation())
  const [pins, setPins] = useState<string[]>(() => getPinnedReports())
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectOpen, setSelectOpen] = useState(false)
  const [customReports, setCustomReports] = useState<Array<{ id: string; name: string; description: string }>>([])

  useEffect(() => {
    Promise.all([api.get('/reporting/reports'), api.get('/reporting/overview'), api.get('/settings/org'), api.get('/reporting/filter-options'), api.get('/reporting/custom').catch(() => ({ data: { reports: [] } }))])
      .then(([reportsResponse, overviewResponse, orgResponse, optionsResponse, customResponse]) => {
        const serviceTypes = orgResponse.data?.service_types || []
        const dom = serviceTypes.some((type: string) => ['domiciliary', 'live_in'].includes(type))
        setIsDomiciliary(dom)
        setReports(reportsResponse.data.reports)
        setCategories(reportsResponse.data.categories)
        setOverview(overviewResponse.data)
        setLocations(optionsResponse.data.locations || [])
        setDepartments(optionsResponse.data.departments || [])
        setCustomReports(customResponse.data.reports || [])
      })
      .catch(e => setError(e.response?.data?.message || 'Failed to load reports'))
      .finally(() => setLoading(false))
  }, [])

  const domiciliaryReportIds = useMemo(() => new Set([
    'staff-directory', 'staff-by-location', 'staff-compliance', 'staff-documents',
    'su-directory', 'su-by-location', 'su-care-plans', 'satisfaction-surveys',
    'leave-by-type', 'leave-by-month', 'leave-balances', 'incident-summary',
    'incident-trends', 'compliance-overall', 'compliance-by-staff',
    'compliance-expiring', 'training-completion', 'training-overdue',
  ]), [])

  const reportForOrganisation = (report: ReportDef): ReportDef => {
    if (!isDomiciliary) return report
    const labels: Record<string, [string, string]> = {
      'staff-by-location': ['Carers by area', 'See active carer coverage across geographic care areas.'],
      'su-by-location': ['Clients by area', 'Understand where clients are served across your care areas.'],
      'su-care-plans': ['Care plan review status', 'Find care plans that need review or follow-up.'],
      'satisfaction-surveys': ['Client and family feedback', 'Track feedback from clients, families and visitors.'],
      'staff-compliance': ['Carer compliance readiness', 'Monitor checks and training that protect safe visits.'],
    }
    const override = labels[report.id]
    return override ? { ...report, title: override[0], description: override[1] } : report
  }

  const availableReports = useMemo(() => {
    const source = isDomiciliary ? reports.filter(r => domiciliaryReportIds.has(r.id)) : reports
    return source.map(reportForOrganisation)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, isDomiciliary])

  const metricCards = useMemo(() => {
    if (!overview) return []
    const byLabel = new Map(overview.cards.map(c => [c.label, c]))
    return METRIC_LABELS.map(label => byLabel.get(label)).filter((c): c is OverviewCard => !!c)
  }, [overview])

  const pinnedCustomReports: ReportDef[] = useMemo(
    () => customReports
      .filter(r => pins.includes(`custom:${r.id}`))
      .map(r => ({
        id: `custom:${r.id}`, title: r.name, description: r.description || 'A saved custom report.',
        category: 'custom', icon: 'table', color: '#0164C8', filters: ['dateRange'],
        chartTypes: ['table'], defaultChartType: 'table', groupByOptions: [],
      })),
    [customReports, pins],
  )

  const pinnedReports = useMemo(
    () => [...availableReports.filter(r => pins.includes(r.id)), ...pinnedCustomReports],
    [availableReports, pins, pinnedCustomReports],
  )

  const visibleCategories = useMemo(
    () => categories.filter(c => availableReports.some(r => r.category === c.id)),
    [categories, availableReports],
  )

  useEffect(() => {
    if (selectedCategory === null && visibleCategories.length > 0) {
      setSelectedCategory(visibleCategories[0].id)
    }
  }, [visibleCategories, selectedCategory])

  const categoryReports = useMemo(() => {
    const inCategory = availableReports.filter(r => r.category === selectedCategory)
    if (!search) return inCategory
    const q = search.toLowerCase()
    return inCategory.filter(r => r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q))
  }, [availableReports, selectedCategory, search])

  const savedReports = useMemo(() => {
    if (!search) return pinnedReports
    const q = search.toLowerCase()
    return pinnedReports.filter(r => r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q))
  }, [pinnedReports, search])

  const openReport = (reportId: string) => {
    if (reportId.startsWith('custom:')) {
      navigate(`/reports/custom/${reportId.slice('custom:'.length)}`)
      return
    }
    navigate(`/reports/${reportId}`, locationFilter ? { state: { locationId: locationFilter } } : undefined)
  }

  const onTogglePin = (reportId: string) => setPins(togglePin(reportId))

  const handleCreateReport = (values: ReportFilterValues) => {
    setFiltersOpen(false)
    navigate('/reports/builder', { state: { initial: reportFiltersToBuilderInitial(values, locations, departments) } })
  }

  const changeLocation = (value: string) => {
    setLocationFilter(value)
    setReportsLocation(value)
  }

  const filtersLine = (report: ReportDef) => {
    const labels = report.filters.map(f => FILTER_LABELS[f] || f)
    return labels.length <= 4 ? `Filters: ${labels.join(', ')}` : `Filters: ${labels.length} filters`
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>

  const shownReports = savedOnly ? savedReports : categoryReports

  return (
    <PageContainer>
      <Typography variant="caption" sx={{ color: '#0164C8', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        Analytics / Reports
      </Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2} sx={{ mt: 0.5, mb: 3 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>{isDomiciliary ? 'Domiciliary operations reporting' : 'Reports'}</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
            {isDomiciliary
              ? 'A practical view of visit delivery, area coverage, client safety and workforce readiness.'
              : 'Explore your data with charts, filters and exports.'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <TextField select size="small" value={locationFilter} onChange={e => changeLocation(e.target.value)}
            aria-label="Location" sx={{ minWidth: 150, bgcolor: '#fff', '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
            <MenuItem value="">All locations</MenuItem>
            {locations.map(l => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
          </TextField>
          <Button variant={savedOnly ? 'contained' : 'outlined'} size="small" startIcon={<BookmarkIcon />}
            onClick={() => setSavedOnly(v => !v)} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Saved reports{pins.length > 0 ? ` (${pins.length})` : ''}
          </Button>
          <Button variant="outlined" size="small" onClick={() => setSelectOpen(true)}
            sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>
            Open saved
          </Button>
          <Button variant="contained" size="small" startIcon={<TrendingUpIcon />} onClick={() => setFiltersOpen(true)}
            sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>
            Build a custom report
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}

      {metricCards.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {metricCards.map(card => (
            <Grid item xs={6} md={3} key={card.label}>
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', height: '100%' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Typography variant="body2" color="text.secondary">{card.label}</Typography>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: 'notice.info.bg', color: 'notice.info.fg' }}>
                    {METRIC_ICONS[card.label] || <AssessIcon sx={{ fontSize: 20 }} />}
                  </Avatar>
                </Stack>
                <Typography variant="h4" sx={{ fontWeight: 600, mt: 1, color: card.color }}>{card.value}</Typography>
                <Typography variant="caption" color="text.secondary">{card.subtitle}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {overview && overview.attention.length > 0 && (
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mb: 4, borderRadius: 2, borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>What needs attention today</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Live snapshot generated {new Date(overview.generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap" useFlexGap>
            {overview.attention.map(item => (
              <Button key={item.label} size="small" endIcon={<ArrowForwardIcon />}
                onClick={() => navigate(item.target === 'locations' ? '/locations' : `/${item.target}`)}
                sx={{ justifyContent: 'space-between', textTransform: 'none', color: item.value > 0 && item.target !== 'locations' ? 'error.main' : 'text.primary' }}>
                <span>{item.label}: <strong>{item.value}</strong></span>
              </Button>
            ))}
          </Stack>
        </Paper>
      )}

      {pinnedReports.length > 0 && !savedOnly && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>Pinned reports</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Your most used reports, one click away</Typography>
          <Grid container spacing={2.5}>
            {pinnedReports.slice(0, 3).map(report => (
              <Grid item xs={12} sm={6} md={4} key={report.id}>
                <ReportCard
                  report={report} pinned
                  viewed={viewedLabel(getReportViewedAt(report.id))}
                  onOpen={() => openReport(report.id)} onTogglePin={() => onTogglePin(report.id)}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={3}>
          <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
            <Box sx={{ px: 2, pt: 2, pb: 1, display: { xs: 'none', md: 'block' } }}>
              <Stack direction="row" alignItems="baseline" spacing={1}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Categories</Typography>
                <Typography variant="caption" color="text.secondary">{availableReports.length} reports</Typography>
              </Stack>
            </Box>
            <Stack
              direction={{ xs: 'row', md: 'column' }}
              spacing={0.5}
              sx={{ p: { xs: 1.5, md: 1.5 }, overflowX: { xs: 'auto', md: 'visible' } }}
            >
              {visibleCategories.map(cat => {
                const count = availableReports.filter(r => r.category === cat.id).length
                const selected = selectedCategory === cat.id && !savedOnly
                return (
                  <Box
                    key={cat.id}
                    onClick={() => { setSelectedCategory(cat.id); setSavedOnly(false) }}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 1.1,
                      borderRadius: 1.5, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                      bgcolor: selected ? 'notice.info.bg' : 'transparent',
                      '&:hover': { bgcolor: selected ? 'notice.info.bg' : 'var(--mc-surface-hover)' },
                    }}
                  >
                    <Avatar sx={{ width: 28, height: 28, bgcolor: selected ? '#fff' : `${cat.color}15`, color: selected ? 'notice.info.fg' : cat.color, fontSize: 16 }}>
                      {ICON_MAP[cat.icon] || <AssessIcon />}
                    </Avatar>
                    <Typography variant="body2" sx={{ fontWeight: selected ? 700 : 500, flex: 1 }}>{cat.label}</Typography>
                    <Chip label={count} size="small" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600, bgcolor: selected ? '#fff' : 'notice.subtle.bg' }} />
                  </Box>
                )
              })}
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={9}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {savedOnly ? 'Saved reports' : visibleCategories.find(c => c.id === selectedCategory)?.label || 'Reports'}
            </Typography>
            <Typography variant="caption" color="text.secondary">{shownReports.length} reports</Typography>
            <Box sx={{ flexGrow: 1 }} />
            <TextField
              size="small" placeholder="Search reports..." value={search} onChange={e => setSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment> }}
              sx={{ width: { xs: '100%', sm: 220 }, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#fff' } }}
            />
          </Stack>

          <Grid container spacing={2.5}>
            {shownReports.map(report => (
              <Grid item xs={12} sm={6} key={report.id}>
                <ReportCard
                  report={report} pinned={pins.includes(report.id)}
                  viewed={viewedLabel(getReportViewedAt(report.id))}
                  onOpen={() => openReport(report.id)} onTogglePin={() => onTogglePin(report.id)}
                  filters={filtersLine(report)}
                />
              </Grid>
            ))}
          </Grid>

          {shownReports.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" color="text.secondary">
                {savedOnly ? 'No saved reports yet' : 'No reports found'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {savedOnly
                  ? 'Pin a report to keep it one click away.'
                  : 'Try a different search term'}
              </Typography>
            </Box>
          )}
        </Grid>
      </Grid>

      <ReportFiltersDialog open={filtersOpen} onClose={() => setFiltersOpen(false)}
        onCreate={handleCreateReport} locations={locations} departments={departments} />
      <SelectReportsDialog open={selectOpen} onClose={() => setSelectOpen(false)}
        reports={customReports.map(r => ({ id: r.id, name: r.name, description: r.description }))}
        onSelect={id => { setSelectOpen(false); navigate(`/reports/custom/${id}`) }} />
    </PageContainer>
  )
}

function ReportCard({ report, pinned, viewed, onOpen, onTogglePin, filters }: {
  report: ReportDef; pinned: boolean; viewed: string | null
  onOpen: () => void; onTogglePin: () => void; filters?: string
}) {
  return (
    <Card
      elevation={0}
      onClick={onOpen}
      sx={{
        border: '1px solid', borderColor: 'divider', borderRadius: 2, cursor: 'pointer',
        transition: 'border-color 120ms ease, box-shadow 120ms ease', height: '100%',
        '&:hover': { borderColor: report.color, boxShadow: `0 2px 8px ${report.color}20` },
      }}
    >
      <CardContent sx={{ pb: '16px !important' }}>
        <Stack spacing={1.25}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: `${report.color}15`, color: report.color, fontSize: 18 }}>
              {ICON_MAP[report.icon] || <AssessIcon />}
            </Avatar>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.3, flex: 1 }}>
              {report.title}
            </Typography>
            <Tooltip title={pinned ? 'Remove from pinned' : 'Pin this report'}>
              <IconButton
                size="small" aria-label={pinned ? `Unpin ${report.title}` : `Pin ${report.title}`}
                onClick={e => { e.stopPropagation(); onTogglePin() }}
                sx={{ color: pinned ? report.color : 'text.disabled' }}
              >
                {pinned ? <BookmarkFullIcon fontSize="small" /> : <BookmarkIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
            {report.description}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {filters || '\u00A0'}
          </Typography>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography
              role="link" tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter') onOpen() }}
              sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#0164C8', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
            >
              Open report →
            </Typography>
            {viewed && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>{viewed}</Typography>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}
