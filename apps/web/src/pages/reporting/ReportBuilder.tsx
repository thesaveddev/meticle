import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Typography, Paper, Stack, Button, TextField, MenuItem, Select, FormControl, InputLabel,
  Chip, IconButton, Tooltip, CircularProgress, Alert, Drawer, Divider,
  ToggleButton, ToggleButtonGroup, Snackbar,
} from '@mui/material'
import {
  FilterList as FilterIcon, TableChart as CsvIcon, BarChart as BarIcon, PieChart as PieIcon,
  ShowChart as LineIcon, Timeline as AreaIcon, Radar as RadarIcon,
  TableRows as TableIcon, Close as CloseIcon, ArrowBack as BackIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import api from '../../services/api'
import { StatCard, BarChart, PieChart, LineChart, AreaChart, RadarChart, ReportTable } from '../../components/charts'

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

const ROLE_OPTIONS = [
  { value: 'ORG_ADMIN', label: 'Admin' }, { value: 'MANAGER', label: 'Manager' },
  { value: 'CARE_WORKER', label: 'Care Worker' }, { value: 'COMPLIANCE_OFFICER', label: 'Compliance' },
]

const STATUS_OPTIONS = ['active', 'inactive', 'on_leave', 'completed', 'expired', 'pending', 'approved', 'rejected', 'open', 'investigating', 'resolved']

const CHART_ICONS: Record<string, React.ReactNode> = {
  bar: <BarIcon />, pie: <PieIcon />, line: <LineIcon />, area: <AreaIcon />, radar: <RadarIcon />, table: <TableIcon />,
}

const SEVERITY_COLORS: Record<string, string> = { critical: '#DC2626', high: '#F59E0B', medium: '#EAB308', low: '#3B82F6' }

export default function ReportBuilder() {
  const { reportId } = useParams<{ reportId: string }>()
  const navigate = useNavigate()

  const [meta, setMeta] = useState<ReportMeta | null>(null)
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')
  const [chartType, setChartType] = useState('bar')
  const [filterOpen, setFilterOpen] = useState(false)
  const [snackbar, setSnackbar] = useState('')

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
      setLocations(optionsResponse.data.locations || [])
      setDepartments(optionsResponse.data.departments || [])
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
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to load report data')
    } finally {
      setFetching(false)
    }
  }, [reportId, dateFrom, dateTo, locationId, departmentId, role, status, severity])

  useEffect(() => { fetchData() }, [fetchData])

  const activeFilterCount = [dateFrom, dateTo, locationId, departmentId, role, status, severity].filter(Boolean).length

  const clearFilters = () => { setDateFrom(''); setDateTo(''); setLocationId(''); setDepartmentId(''); setRole(''); setStatus(''); setSeverity('') }

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
      a.href = url; a.download = `${reportId}-${new Date().toISOString().split('T')[0]}.${ext}`
      a.click(); URL.revokeObjectURL(url)
      setSnackbar(`Report exported as ${ext.toUpperCase()}`)
    } catch { setSnackbar('Export failed') }
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
      const sevColors = newSeriesKeys.map(s => SEVERITY_COLORS[s] || '#6B7280')
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
  if (!meta) return <Box><Alert severity="error" sx={{ mb: 2 }}>{error || 'Report not found'}</Alert><Button startIcon={<BackIcon />} onClick={() => navigate('/reports')}>Back to reports</Button></Box>

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <IconButton onClick={() => navigate('/reports')} size="small"><BackIcon /></IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>{meta.title}</Typography>
          <Typography variant="body2" color="text.secondary">{meta.description}</Typography>
        </Box>
        <Tooltip title="Refresh"><IconButton onClick={fetchData} disabled={fetching}><RefreshIcon /></IconButton></Tooltip>
        <Button variant="outlined" size="small" startIcon={<FilterIcon />} onClick={() => setFilterOpen(true)}
          sx={{ textTransform: 'none', borderRadius: 2 }}>
          Filters {activeFilterCount > 0 && <Chip label={activeFilterCount} size="small" color="primary" sx={{ ml: 1, height: 20, fontSize: '0.7rem' }} />}
        </Button>
        <Button variant="outlined" size="small" startIcon={<CsvIcon />} onClick={() => handleExport('csv')}
          sx={{ textTransform: 'none', borderRadius: 2 }}>
          CSV
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

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
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Filters</Typography>
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
              <TextField label="Date From" type="date" size="small" fullWidth value={dateFrom}
                onChange={e => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
              <TextField label="Date To" type="date" size="small" fullWidth value={dateTo}
                onChange={e => setDateTo(e.target.value)} InputLabelProps={{ shrink: true }} />
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
            sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600 }}>
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

      <Snackbar open={!!snackbar} autoHideDuration={3000} message={snackbar} onClose={() => setSnackbar('')} />
    </Box>
  )
}
