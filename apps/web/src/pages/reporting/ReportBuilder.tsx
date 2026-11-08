import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation as useRouterLocation } from 'react-router-dom'
import {
  Box, Typography, Paper, Stack, Button, TextField, MenuItem, Select, FormControl, InputLabel,
  Chip, IconButton, Tooltip, CircularProgress, Alert, Drawer, Divider,
  ToggleButton, ToggleButtonGroup,
} from '@mui/material'
import PageContainer from '../../components/design/PageContainer'
import {
  FilterList as FilterIcon, TableChart as CsvIcon, BarChart as BarIcon, PieChart as PieIcon,
  ShowChart as LineIcon, Timeline as AreaIcon, Radar as RadarIcon,
  TableRows as TableIcon, Close as CloseIcon, ArrowBack as BackIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import api from '../../services/api'
import { StatCard, BarChart, PieChart, LineChart, AreaChart, RadarChart, ReportTable } from '../../components/charts'
import { localDate } from '../../utils/dateFormat'
import { useSnackbar } from '../../context/SnackbarContext'
import { isPinned, togglePin, recordReportViewed, getReportsLocation } from './reportPins'

interface ReportData {
  report: { id: string; title: string; category: string; generatedAt: string }
  summary: { cards: { label: string; value: string | number; color?: string; trend?: { value: number; direction: 'up' | 'down' | 'flat' } }[] }
  series: any[]
  table: { columns: { key: string; label: string; type?: 'text' | 'number' | 'percent' | 'currency' | 'date' | 'badge' | 'progress' }[]; rows: Record<string, any>[] }
}

interface ReportMeta {
  id: string; title: string; description: string; category: string; icon: string; color: string
  filters: string[]; chartTypes: string[]; defaultChartType: string; groupByOptions: string[]
}

interface Location { id: string; name: string }
interface Department { id: string; name: string }
interface Category { id: string; label: string }

const DATE_PRESETS = [
  { value: '', label: 'All time' },
  { value: '30d', label: 'Last 30 days' },
  { value: '3m', label: 'Last 3 months' },
  { value: '6m', label: 'Last 6 months' },
  { value: '12m', label: 'Last 12 months' },
]

/** Figma 10.1 date shortcut → concrete range ending today. */
function presetRange(value: string): { from: string; to: string } {
  const to = localDate()
  if (!value) return { from: '', to: '' }
  const days = value === '30d' ? 30 : value === '3m' ? 91 : value === '6m' ? 182 : 365
  const d = new Date()
  d.setDate(d.getDate() - (days - 1))
  const pad = (n: number) => String(n).padStart(2, '0')
  return { from: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, to }
}

const ROLE_OPTIONS = [
  { value: 'ORG_ADMIN', label: 'Admin' }, { value: 'MANAGER', label: 'Manager' },
  { value: 'CARE_WORKER', label: 'Care Worker' }, { value: 'COMPLIANCE_OFFICER', label: 'Compliance' },
]

const STATUS_OPTIONS = ['active', 'inactive', 'on_leave', 'completed', 'expired', 'pending', 'approved', 'rejected', 'open', 'investigating', 'resolved']

const CHART_ICONS: Record<string, React.ReactNode> = {
  bar: <BarIcon />, pie: <PieIcon />, line: <LineIcon />, area: <AreaIcon />, radar: <RadarIcon />, table: <TableIcon />,
}

const SEVERITY_COLORS: Record<string, string> = { critical: '#EF4444', high: '#F59E0B', medium: '#F59E0B', low: '#0164C8' }

export default function ReportBuilder() {
  const { reportId } = useParams<{ reportId: string }>()
  const navigate = useNavigate()
  const routerLocation = useRouterLocation() as { state?: { locationId?: string } }
  const { showSnackbar } = useSnackbar()

  const [meta, setMeta] = useState<ReportMeta | null>(null)
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')
  const [chartType, setChartType] = useState('bar')
  const [filterOpen, setFilterOpen] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [pinned, setPinned] = useState(false)
  const [datePreset, setDatePreset] = useState('')
  const [staffTotal, setStaffTotal] = useState<number | null>(null)

  const [locations, setLocations] = useState<Location[]>([])
  const [departments, setDepartments] = useState<Department[]>([])

  // Filters
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [locationId, setLocationId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [severity, setSeverity] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    Promise.all([
      api.get('/reporting/reports'),
      api.get('/reporting/filter-options'),
    ]).then(([reportsResponse, optionsResponse]) => {
      if (!active) return
      const found = reportsResponse.data.reports.find((rp: ReportMeta) => rp.id === reportId)
      if (!found) {
        setError('This report is not available. Return to the reports overview and choose another report.')
        return
      }
      setMeta(found)
      setChartType(found.defaultChartType)
      setCategories(reportsResponse.data.categories || [])
      setLocations(optionsResponse.data.locations || [])
      setDepartments(optionsResponse.data.departments || [])
      setPinned(isPinned(found.id))
      // Deep link from the overview (e.g. a location's report) carries its filter.
      const incoming = routerLocation.state?.locationId
        ?? (reportId === 'staff-directory' || reportId === 'staff-by-location' ? getReportsLocation() : '')
      if (incoming) setLocationId(incoming)
    }).catch((e: any) => {
      if (active) setError(e.response?.data?.message || 'We could not load this report.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [reportId])

  const fetchData = useCallback(async () => {
    if (!reportId) return
    setFetching(true)
    setError('')
    try {
      const params: Record<string, string> = {}
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      if (locationId) params.location_id = locationId
      if (departmentId) params.department_id = departmentId
      if (role) params.role = role
      if (status) params.status = status
      if (severity) params.severity = severity

      const res = await api.get(`/reporting/data/${reportId}`, { params })
      setData(res.data)
      recordReportViewed(reportId)
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to load report data')
    } finally {
      setFetching(false)
    }
  }, [reportId, dateFrom, dateTo, locationId, departmentId, role, status, severity])

  useEffect(() => { fetchData() }, [fetchData])

  const activeFilterCount = [dateFrom, dateTo, locationId, departmentId, role, status, severity].filter(Boolean).length

  const clearFilters = () => { setDateFrom(''); setDateTo(''); setDatePreset(''); setLocationId(''); setDepartmentId(''); setRole(''); setStatus(''); setSeverity('') }

  const handleExport = async (format: string) => {
    try {
      const params: Record<string, string> = { format }
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      if (locationId) params.location_id = locationId
      if (departmentId) params.department_id = departmentId
      if (role) params.role = role
      if (status) params.status = status
      if (severity) params.severity = severity

      const res = await api.get(`/reporting/export/${reportId}`, { params, responseType: 'blob' })
      const ext = format === 'csv' ? 'csv' : format
      const blob = new Blob([res.data])
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      // The name carries the day the operator made the export, in their own
      // timezone: the UTC slice this used to use put yesterday's date on an
      // export taken in the first hour of a BST day.
      a.href = url; a.download = `${reportId}-${localDate()}.${ext}`
      a.click(); URL.revokeObjectURL(url)
      showSnackbar(`Report exported as ${ext.toUpperCase()}`, 'success')
    } catch { showSnackbar('Export failed', 'error') }
  }

  // Total active staff, fetched lazily so the staff-by-location report can say
  // who is missing from it (Figma 10.1 missing-location callout).
  useEffect(() => {
    if (reportId !== 'staff-by-location' || staffTotal !== null) return
    api.get('/reporting/overview').then((res) => {
      const card = res.data.cards?.find((c: any) => c.label === 'Active staff')
      if (typeof card?.value === 'number') setStaffTotal(card.value)
    }).catch(() => { /* the report still renders without the callout */ })
  }, [reportId, staffTotal])

  const handleTogglePin = () => {
    if (!reportId) return
    const pins = togglePin(reportId)
    const next = pins.includes(reportId)
    setPinned(next)
    showSnackbar(next ? 'Saved to your reports' : 'Removed from your reports', 'success')
  }

  const handlePreset = (value: string) => {
    setDatePreset(value)
    const { from, to } = presetRange(value)
    // Typing in either date field after a shortcut switches back to Custom.
    setDateFrom(from); setDateTo(to)
  }

  const renderChart = () => {
    if (!data) return null
    const { series, table } = data
    if (!series.length && !table.rows.length) return null

    const seriesKeys = series.length > 0 && series[0] && typeof series[0] === 'object'
      ? Object.keys(series[0]).filter(k => k !== 'name' && k !== 'color' && k !== 'value' && !k.startsWith('__'))
      : undefined

    const hasMultiSeries = seriesKeys && seriesKeys.length > 0

    const severityGrouped = data.table.rows.some((r: any) => r.severity)
    const statusGrouped = data.table.rows.some((r: any) => r.status)

    let chartData = series
    if (severityGrouped && !hasMultiSeries) {
      const byName: Record<string, Record<string, number>> = {}
      const allSeverities = new Set<string>()
      data.table.rows.forEach((r: any) => {
        const name = r.name || r.location_name || 'Unknown'
        if (!byName[name]) byName[name] = {}
        byName[name][r.severity] = (byName[name][r.severity] || 0) + (r.value || 0)
        allSeverities.add(r.severity)
      })
      chartData = Object.entries(byName).map(([name, vals]) => ({ name, ...vals }))
      const newSeriesKeys = Array.from(allSeverities)
      const sevColors = newSeriesKeys.map(s => SEVERITY_COLORS[s] || '#51637A')
      return <BarChart title={data.report.title} data={chartData as any} seriesKeys={newSeriesKeys} colors={sevColors}
        stacked={chartType === 'bar'} horizontal={chartData.length <= 8} />
    }

    if (statusGrouped && !hasMultiSeries) {
      const byName: Record<string, Record<string, number>> = {}
      const allStatuses = new Set<string>()
      data.table.rows.forEach((r: any) => {
        const name = r.name || r.month || r.location_name || 'Unknown'
        if (!byName[name]) byName[name] = {}
        byName[name][r.status] = (byName[name][r.status] || 0) + (r.value || 0)
        allStatuses.add(r.status)
      })
      chartData = Object.entries(byName).map(([name, vals]) => ({ name, ...vals }))
      const newSeriesKeys = Array.from(allStatuses)
      return <BarChart title={data.report.title} data={chartData as any} seriesKeys={newSeriesKeys}
        stacked={chartType === 'bar'} horizontal={chartData.length <= 8} />
    }

    switch (chartType) {
      case 'pie':
        return <PieChart title={data.report.title} data={series} donut centerLabel="Total" />
      case 'line':
        return hasMultiSeries
          ? <LineChart title={data.report.title} data={chartData} seriesKeys={seriesKeys} />
          : <LineChart title={data.report.title} data={chartData} />
      case 'area':
        return hasMultiSeries
          ? <AreaChart title={data.report.title} data={chartData} seriesKeys={seriesKeys} stacked />
          : <AreaChart title={data.report.title} data={chartData} />
      case 'radar':
        return <RadarChart title={data.report.title} data={series} />
      case 'table':
        return null
      default:
        return hasMultiSeries
          ? <BarChart title={data.report.title} data={chartData} seriesKeys={seriesKeys}
              stacked horizontal={chartData.length <= 8} />
          : <BarChart title={data.report.title} data={chartData} horizontal={chartData.length <= 8} />
    }
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
  if (!meta) return <Box><Alert severity="error" sx={{ mb: 2 }}>{error || 'Report not found'}</Alert></Box>

  const categoryLabel = categories.find(c => c.id === meta.category)?.label ?? meta.category
  const counted = data?.series.reduce((sum: number, s: any) => sum + (Number(s.value) || 0), 0) ?? 0
  const unlocated = staffTotal !== null && reportId === 'staff-by-location' && !locationId
    ? Math.max(staffTotal - counted, 0)
    : 0

  return (
    <PageContainer>

      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <IconButton onClick={() => navigate('/reports')} size="small"><BackIcon /></IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 1 }}>
            ANALYTICS / REPORTS / {categoryLabel.toUpperCase()}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>{meta.title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {meta.description}
            {data && <> · live data, updated {new Date(data.report.generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</>}
          </Typography>
        </Box>
        <Tooltip title="Refresh"><IconButton onClick={fetchData} disabled={fetching}><RefreshIcon /></IconButton></Tooltip>
        <Button variant={pinned ? 'contained' : 'outlined'} size="small" onClick={handleTogglePin}
          sx={{ textTransform: 'none', }}>
          {pinned ? 'Saved ✓' : 'Save report'}
        </Button>
        <Button variant="outlined" size="small" startIcon={<FilterIcon />} onClick={() => setFilterOpen(true)}
          sx={{ textTransform: 'none',}}>
          Filters {activeFilterCount > 0 && <Chip label={activeFilterCount} size="small" color="primary" sx={{ ml: 1, height: 20, fontSize: '0.7rem' }} />}
        </Button>
        <Button variant="outlined" size="small" startIcon={<CsvIcon />} onClick={() => handleExport('csv')}
          sx={{ textTransform: 'none',}}>
          Export CSV
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {unlocated > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}
          action={<Button size="small" sx={{ textTransform: 'none' }} onClick={() => navigate('/staff')}>Show those staff</Button>}>
          {unlocated} active staff have no location. This report counts {counted} of your {staffTotal} active staff.
          Add a location to the others so they show up here and in the rota.
        </Alert>
      )}

      {/* Summary Cards */}
      {data && data.summary.cards.length > 0 && (
        <Stack direction="row" spacing={2} sx={{ mb: 3, overflowX: 'auto', pb: 1 }}>
          {data.summary.cards.map((card, i) => (
            <Box key={i} sx={{ minWidth: 160, flex: '1 1 160px' }}>
              <StatCard {...card} />
            </Box>
          ))}
        </Stack>
      )}

      {/* Chart Type Toggle */}
      {data && meta.chartTypes.length > 1 && (
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>VIEW:</Typography>
          <ToggleButtonGroup value={chartType} exclusive size="small" onChange={(_, v) => v && setChartType(v)}>
            {meta.chartTypes.map(ct => (
              <ToggleButton key={ct} value={ct} sx={{ textTransform: 'none', px: 1.5 }}>
                <Tooltip title={ct.charAt(0).toUpperCase() + ct.slice(1)}>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    {CHART_ICONS[ct]}
                    <Typography variant="caption" sx={{ display: { xs: 'none', sm: 'block' } }}>{ct.charAt(0).toUpperCase() + ct.slice(1)}</Typography>
                  </Stack>
                </Tooltip>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>
      )}

      {/* Chart */}
      {fetching ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <Box sx={{ mb: 3 }}>
          {chartType !== 'table' ? renderChart() : null}
        </Box>
      )}

      {/* Data Table */}
      {data && data.table.rows.length > 0 && (
        <ReportTable
          title={`${meta.title} — Data`}
          columns={data.table.columns}
          rows={data.table.rows}
          pageSize={20}
        />
      )}

      {data && data.table.rows.length === 0 && !fetching && (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" color="text.secondary">No data available</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Try adjusting your filters or date range</Typography>
        </Paper>
      )}

      {/* Filter Drawer */}
      <Drawer anchor="right" open={filterOpen} onClose={() => setFilterOpen(false)} PaperProps={{ sx: { width: 320, p: 3 } }}>
        <Stack spacing={3}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Filters</Typography>
            <Stack direction="row" spacing={1}>
              {activeFilterCount > 0 && (
                <Button size="small" onClick={clearFilters} sx={{ textTransform: 'none' }}>Clear All</Button>
              )}
              <IconButton size="small" onClick={() => setFilterOpen(false)}><CloseIcon /></IconButton>
            </Stack>
          </Stack>

          <Divider />

          {meta.filters.includes('dateRange') && (
            <>
              <FormControl size="small" fullWidth>
                <InputLabel>Range</InputLabel>
                <Select value={datePreset} label="Range"
                  onChange={e => handlePreset(e.target.value)}>
                  <MenuItem value="">Custom</MenuItem>
                  {DATE_PRESETS.filter(p => p.value).map(p => (
                    <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField label="Date From" type="date" size="small" fullWidth value={dateFrom}
                onChange={e => { setDatePreset(''); setDateFrom(e.target.value) }} InputLabelProps={{ shrink: true }} />
              <TextField label="Date To" type="date" size="small" fullWidth value={dateTo}
                onChange={e => { setDatePreset(''); setDateTo(e.target.value) }} InputLabelProps={{ shrink: true }} />
            </>
          )}

          {meta.filters.includes('location') && (
            <FormControl size="small" fullWidth>
              <InputLabel>Location</InputLabel>
              <Select value={locationId} label="Location" onChange={e => setLocationId(e.target.value)}>
                <MenuItem value="">All Locations</MenuItem>
                {locations.map(l => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
              </Select>
            </FormControl>
          )}

          {meta.filters.includes('department') && (
            <FormControl size="small" fullWidth>
              <InputLabel>Department</InputLabel>
              <Select value={departmentId} label="Department" onChange={e => setDepartmentId(e.target.value)}>
                <MenuItem value="">All Departments</MenuItem>
                {departments.map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
              </Select>
            </FormControl>
          )}

          {meta.filters.includes('role') && (
            <FormControl size="small" fullWidth>
              <InputLabel>Role</InputLabel>
              <Select value={role} label="Role" onChange={e => setRole(e.target.value)}>
                <MenuItem value="">All Roles</MenuItem>
                {ROLE_OPTIONS.map(r => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
              </Select>
            </FormControl>
          )}

          {meta.filters.includes('status') && (
            <FormControl size="small" fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={status} label="Status" onChange={e => setStatus(e.target.value)}>
                <MenuItem value="">All Statuses</MenuItem>
                {STATUS_OPTIONS.map(s => <MenuItem key={s} value={s}>{s.replace(/_/g, ' ')}</MenuItem>)}
              </Select>
            </FormControl>
          )}

          {meta.filters.includes('severity') && (
            <FormControl size="small" fullWidth>
              <InputLabel>Severity</InputLabel>
              <Select value={severity} label="Severity" onChange={e => setSeverity(e.target.value)}>
                <MenuItem value="">All Severities</MenuItem>
                {['critical', 'high', 'medium', 'low'].map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          )}

          <Divider />

          <Button variant="contained" fullWidth onClick={() => { setFilterOpen(false) }}
            sx={{ textTransform: 'none', fontWeight: 600 }}>
            Apply Filters
          </Button>

          {activeFilterCount > 0 && (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
              {dateFrom && <Chip label={`From: ${dateFrom}`} size="small" onDelete={() => setDateFrom('')} />}
              {dateTo && <Chip label={`To: ${dateTo}`} size="small" onDelete={() => setDateTo('')} />}
              {locationId && <Chip label={`Location`} size="small" onDelete={() => setLocationId('')} />}
              {departmentId && <Chip label={`Department`} size="small" onDelete={() => setDepartmentId('')} />}
              {role && <Chip label={`Role: ${role}`} size="small" onDelete={() => setRole('')} />}
              {status && <Chip label={`Status: ${status}`} size="small" onDelete={() => setStatus('')} />}
              {severity && <Chip label={`Severity: ${severity}`} size="small" onDelete={() => setSeverity('')} />}
            </Stack>
          )}
        </Stack>
      </Drawer>
    </PageContainer>
  )
}
