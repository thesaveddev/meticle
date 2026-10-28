import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Typography, Paper, Stack, Button, TextField, MenuItem, Select, FormControl, InputLabel,
  Chip, IconButton, Tooltip, CircularProgress, Alert, Drawer, Divider, Dialog, DialogTitle,
  DialogContent, DialogActions,  Checkbox, FormControlLabel, Grid, ToggleButton, ToggleButtonGroup, Snackbar, Switch,
} from '@mui/material'
import PageContainer from '../../components/design/PageContainer'
import {
  FilterList as FilterIcon, TableChart as CsvIcon, BarChart as BarIcon, PieChart as PieIcon,
  ShowChart as LineIcon, TableRows as TableIcon, Close as CloseIcon, ArrowBack as BackIcon,
  Refresh as RefreshIcon, Add as AddIcon, Delete as DeleteIcon, Save as SaveIcon,
  FolderOpen as LibraryIcon, Schedule as ScheduleIcon, Send as SendIcon,
} from '@mui/icons-material'
import api from '../../services/api'
import { StatCard, BarChart, PieChart, LineChart, ReportTable } from '../../components/charts'
import { localDate } from '../../utils/dateFormat'

interface DatasetColumn { key: string; label: string; type: 'text' | 'number' | 'date' | 'boolean'; aggregatable: boolean }
interface Dataset { id: string; label: string; description: string; columns: DatasetColumn[] }
interface FilterCond { field: string; op: string; value: string }
interface Aggregation { func: string; field: string }

interface ReportRow { [key: string]: any }
interface RunResult {
  report: { id: string; title: string; category: string; generatedAt: string }
  summary: { cards: { label: string; value: string | number; color?: string }[] }
  series: { name: string; value: number }[]
  table: { columns: { key: string; label: string; type?: 'text' | 'number' | 'badge' | 'percent' | 'date' | 'currency' | 'progress' }[]; rows: ReportRow[] }
}

interface SavedReport {
  id: string; name: string; description: string; dataset: string; columns: string[]
  filters: { field: string; op: string; value?: any }[]; group_by: string | null
  aggregations: { func: string; field?: string }[]; sort_by: string | null
  sort_dir: 'asc' | 'desc'; row_limit: number; chart_type: string; updated_at?: string
}

interface ReportSchedule {
  id: string; frequency: 'daily' | 'weekly' | 'monthly'
  day_of_week: number | null; day_of_month: number | null; send_time: string
  recipient_ids: string[]; enabled: boolean
  last_run_at: string | null; next_run_at: string | null; last_error: string | null
}

interface ScheduleRecipient { id: string; name: string; email: string; role: string }

interface ReportDelivery {
  id: string; status: 'sent' | 'failed'
  recipient_count: number; row_count: number; error: string | null; ran_at: string
}

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const describeSchedule = (s: ReportSchedule) => {
  if (s.frequency === 'daily') return `Daily at ${s.send_time}`
  if (s.frequency === 'weekly') return `Weekly on ${WEEK_DAYS[s.day_of_week ?? 0]} at ${s.send_time}`
  return `Monthly on day ${s.day_of_month} at ${s.send_time}`
}

const OP_OPTIONS = [
  { value: 'eq', label: 'equals' },
  { value: 'ne', label: 'not equals' },
  { value: 'in', label: 'is one of (comma separated)' },
  { value: 'like', label: 'contains' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'is_null', label: 'is empty' },
  { value: 'is_not_null', label: 'is not empty' },
]

const NO_VALUE_OPS = new Set(['is_null', 'is_not_null'])

const AGG_FUNCS = [
  { value: 'count', label: 'Count rows' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
]

const CHART_ICONS: Record<string, React.ReactNode> = {
  table: <TableIcon />, bar: <BarIcon />, pie: <PieIcon />, line: <LineIcon />,
}

const aggAlias = (func: string, field: string) => (func === 'count' && !field ? 'records' : `${func}_${field}`)

export default function CustomReportBuilderPage() {
  const { id: savedId } = useParams<{ id?: string }>()
  const navigate = useNavigate()

  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Builder state
  const [name, setName] = useState('Untitled report')
  const [datasetId, setDatasetId] = useState('')
  const [columns, setColumns] = useState<string[]>([])
  const [filters, setFilters] = useState<FilterCond[]>([])
  const [groupBy, setGroupBy] = useState('')
  const [aggregations, setAggregations] = useState<Aggregation[]>([])
  const [sortBy, setSortBy] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [rowLimit, setRowLimit] = useState(500)
  const [chartType, setChartType] = useState('table')

  // Run state
  const [data, setData] = useState<RunResult | null>(null)
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState('')
  const [exporting, setExporting] = useState(false)

  // Library + save dialog
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [saved, setSaved] = useState<SavedReport[]>([])
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveDesc, setSaveDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [snackbar, setSnackbar] = useState('')

  // Delivery schedules (saved reports only)
  const [schedOpen, setSchedOpen] = useState(false)
  const [schedules, setSchedules] = useState<ReportSchedule[]>([])
  const [recipients, setRecipients] = useState<ScheduleRecipient[]>([])
  const [schedLoading, setSchedLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [schedFreq, setSchedFreq] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [schedDayW, setSchedDayW] = useState(1)
  const [schedDayM, setSchedDayM] = useState(1)
  const [schedTime, setSchedTime] = useState('08:00')
  const [schedRecipients, setSchedRecipients] = useState<string[]>([])
  const [schedEnabled, setSchedEnabled] = useState(true)
  const [schedSaving, setSchedSaving] = useState(false)
  const [sendingNow, setSendingNow] = useState(false)
  const [deliveries, setDeliveries] = useState<Record<string, ReportDelivery[]>>({})

  const dataset = useMemo(() => datasets.find(d => d.id === datasetId) || null, [datasets, datasetId])
  const grouped = Boolean(groupBy) || aggregations.length > 0

  const outputKeys = useMemo(() => {
    if (!grouped) return columns
    const keys = groupBy ? [groupBy] : []
    for (const a of aggregations) {
      if (a.func && (a.func === 'count' || a.field)) keys.push(aggAlias(a.func, a.field))
    }
    return keys
  }, [grouped, columns, groupBy, aggregations])

  const columnType = (key: string) => dataset?.columns.find(c => c.key === key)?.type || 'text'

  const groupingError = useMemo(() => {
    if (grouped && !groupBy) return 'Pick a group-by field to use aggregations.'
    if (grouped && columns.some(c => c !== groupBy)) return 'Grouped reports show the group-by field plus aggregations — untick the other columns.'
    return ''
  }, [grouped, groupBy, columns])

  // ─── Load datasets + optional saved report ───
  useEffect(() => {
    let active = true
    setLoading(true)
    api.get('/reporting/custom/datasets')
      .then(res => {
        if (!active) return
        setDatasets(res.data.datasets || [])
        if (!savedId && res.data.datasets?.length) {
          setDatasetId(res.data.datasets[0].id)
          setColumns(res.data.datasets[0].columns.slice(0, 6).map((c: DatasetColumn) => c.key))
        }
      })
      .catch((e: any) => { if (active) setError(e.response?.data?.message || 'Could not load the report builder.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [savedId])

  useEffect(() => {
    if (!savedId) return
    let active = true
    api.get(`/reporting/custom/${savedId}`)
      .then(res => {
        if (!active) return
        applySaved(res.data.report)
      })
      .catch((e: any) => { if (active) setError(e.response?.data?.message || 'Could not load this saved report.') })
    return () => { active = false }
  }, [savedId])

  const applySaved = (s: SavedReport) => {
    setName(s.name)
    setDatasetId(s.dataset)
    setColumns(s.columns || [])
    setFilters((s.filters || []).map(f => ({ field: f.field, op: f.op, value: f.value === undefined || f.value === null ? '' : Array.isArray(f.value) ? f.value.join(', ') : String(f.value) })))
    setGroupBy(s.group_by || '')
    setAggregations((s.aggregations || []).map(a => ({ func: a.func, field: a.field || '' })))
    setSortBy(s.sort_by || '')
    setSortDir(s.sort_dir || 'desc')
    setRowLimit(s.row_limit || 500)
    setChartType(s.chart_type || 'table')
    setData(null)
  }

  const buildPayload = () => ({
    name,
    dataset: datasetId,
    columns,
    filters: filters
      .filter(f => f.field && (NO_VALUE_OPS.has(f.op) || f.value !== ''))
      .map(f => (NO_VALUE_OPS.has(f.op) ? { field: f.field, op: f.op } : { field: f.field, op: f.op, value: f.value })),
    group_by: groupBy || null,
    aggregations: aggregations.filter(a => a.func).map(a => (a.func === 'count' && !a.field ? { func: a.func } : { func: a.func, field: a.field })),
    sort_by: sortBy || null,
    sort_dir: sortDir,
    row_limit: Math.min(Math.max(rowLimit || 500, 1), 5000),
    chart_type: chartType,
  })

  const runReport = async (payload?: ReturnType<typeof buildPayload>) => {
    if (!datasetId || columns.length === 0) {
      setRunError('Pick a dataset and at least one column first.')
      return
    }
    if (groupingError) {
      setRunError(groupingError)
      return
    }
    setRunning(true)
    setRunError('')
    try {
      const res = await api.post('/reporting/custom/run', { config: payload || buildPayload() })
      setData(res.data)
    } catch (e: any) {
      setRunError(e.response?.data?.message || 'Could not run this report.')
    } finally {
      setRunning(false)
    }
  }

  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const res = await api.post('/reporting/custom/export', { ...(savedId ? { saved_id: savedId } : { config: buildPayload() }), format: 'csv' }, { responseType: 'blob' })
      const blob = new Blob([res.data])
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(savedId ? name : 'custom-report').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${localDate()}.csv`
      a.click()
      URL.revokeObjectURL(url)
      setSnackbar('Report exported as CSV')
    } catch {
      setSnackbar('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const refreshLibrary = async () => {
    try {
      const res = await api.get('/reporting/custom')
      setSaved(res.data.reports || [])
    } catch { setSnackbar('Could not load saved reports') }
  }

  const openLibrary = () => {
    setConfirmDelete(null)
    refreshLibrary()
    setLibraryOpen(true)
  }

  const openSave = () => {
    setSaveName(savedId ? name : name === 'Untitled report' ? '' : name)
    setSaveDesc('')
    setSaveOpen(true)
  }

  const handleSave = async () => {
    if (!saveName.trim()) {
      setSnackbar('Give the report a name first')
      return
    }
    setSaving(true)
    try {
      const payload = { ...buildPayload(), name: saveName.trim(), description: saveDesc.trim() }
      if (savedId) {
        await api.put(`/reporting/custom/${savedId}`, payload)
        setName(saveName.trim())
        setSnackbar('Report updated')
      } else {
        const res = await api.post('/reporting/custom', payload)
        setSnackbar('Report saved')
        setSaveOpen(false)
        navigate(`/reports/custom/${res.data.report.id}`)
        return
      }
      setSaveOpen(false)
    } catch (e: any) {
      setSnackbar(e.response?.data?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/reporting/custom/${id}`)
      setSaved(prev => prev.filter(r => r.id !== id))
      setConfirmDelete(null)
      if (id === savedId) navigate('/reports/builder')
      else setSnackbar('Report deleted')
    } catch { setSnackbar('Delete failed') }
  }

  const refreshSchedules = async () => {
    if (!savedId) return
    setSchedLoading(true)
    try {
      const [schedRes, recipRes] = await Promise.all([
        api.get(`/reporting/custom/${savedId}/schedules`),
        api.get('/reporting/custom/recipients'),
      ])
      const list = schedRes.data.schedules || []
      setSchedules(list)
      setRecipients(recipRes.data.recipients || [])
      // Latest runs per schedule — a history fetch that fails leaves that
      // schedule without a list rather than failing the whole dialog.
      const histories = await Promise.all(list.map(async (s: ReportSchedule) => {
        try {
          const res = await api.get(`/reporting/custom/${savedId}/schedules/${s.id}/deliveries?limit=5`)
          return [s.id, res.data.deliveries || []] as const
        } catch {
          return [s.id, []] as const
        }
      }))
      setDeliveries(Object.fromEntries(histories))
    } catch { setSnackbar('Could not load delivery schedules') }
    finally { setSchedLoading(false) }
  }

  const openSchedules = () => {
    setEditingId(null)
    setSchedFreq('daily')
    setSchedTime('08:00')
    setSchedRecipients([])
    setSchedEnabled(true)
    refreshSchedules()
    setSchedOpen(true)
  }

  const startEditSchedule = (s: ReportSchedule) => {
    setEditingId(s.id)
    setSchedFreq(s.frequency)
    setSchedDayW(s.day_of_week ?? 1)
    setSchedDayM(s.day_of_month ?? 1)
    setSchedTime(s.send_time)
    setSchedRecipients(s.recipient_ids || [])
    setSchedEnabled(s.enabled)
  }

  const handleSaveSchedule = async () => {
    if (!savedId) return
    if (schedRecipients.length === 0) {
      setSnackbar('Pick at least one recipient')
      return
    }
    setSchedSaving(true)
    try {
      const payload = {
        frequency: schedFreq,
        day_of_week: schedFreq === 'weekly' ? schedDayW : null,
        day_of_month: schedFreq === 'monthly' ? schedDayM : null,
        send_time: schedTime,
        recipient_ids: schedRecipients,
        enabled: schedEnabled,
      }
      if (editingId) {
        await api.put(`/reporting/custom/${savedId}/schedules/${editingId}`, payload)
        setSnackbar('Schedule updated')
      } else {
        await api.post(`/reporting/custom/${savedId}/schedules`, payload)
        setSnackbar('Schedule created — the report will be emailed on cadence')
      }
      setEditingId(null)
      refreshSchedules()
    } catch (e: any) {
      setSnackbar(e.response?.data?.message || 'Save failed')
    } finally { setSchedSaving(false) }
  }

  const handleDeleteSchedule = async (id: string) => {
    if (!savedId) return
    try {
      await api.delete(`/reporting/custom/${savedId}/schedules/${id}`)
      setSchedules(prev => prev.filter(s => s.id !== id))
      setSnackbar('Schedule deleted')
    } catch { setSnackbar('Delete failed') }
  }

  const handleSendNow = async () => {
    if (!savedId || sendingNow) return
    setSendingNow(true)
    try {
      const res = await api.post(`/reporting/custom/${savedId}/send-now`)
      setSnackbar(`Report emailed to ${res.data.to} (${res.data.rows} rows)`)
    } catch (e: any) {
      setSnackbar(e.response?.data?.message || 'Send failed')
    } finally { setSendingNow(false) }
  }

  const toggleColumn = (key: string) => {
    setColumns(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]))
  }

  const updateFilter = (i: number, patch: Partial<FilterCond>) => {
    setFilters(prev => prev.map((f, j) => (j === i ? { ...f, ...patch } : f)))
  }

  const filterInput = (f: FilterCond, i: number) => {
    if (NO_VALUE_OPS.has(f.op)) return null
    const type = columnType(f.field)
    if (type === 'boolean') {
      return (
        <Select size="small" value={f.value} displayEmpty onChange={e => updateFilter(i, { value: e.target.value })} sx={{ minWidth: 110 }}>
          <MenuItem value="true">Yes</MenuItem>
          <MenuItem value="false">No</MenuItem>
        </Select>
      )
    }
    return (
      <TextField
        size="small" placeholder={f.op === 'in' ? 'a, b, c' : 'Value'}
        type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
        value={f.value} onChange={e => updateFilter(i, { value: e.target.value })}
        InputLabelProps={type === 'date' ? { shrink: true } : undefined}
        sx={{ minWidth: 140, flex: 1 }}
      />
    )
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
  if (error && !dataset) return <Box><Alert severity="error" sx={{ mb: 2 }}>{error}</Alert></Box>

  return (
    <PageContainer>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <IconButton onClick={() => navigate('/reports')} size="small"><BackIcon /></IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {savedId ? name : 'Report builder'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {savedId ? 'A saved configuration — change anything and run, update or export.' : 'Pick a dataset, choose columns, add filters, group and export.'}
          </Typography>
        </Box>
        <Tooltip title="Saved reports"><IconButton onClick={openLibrary}><LibraryIcon /></IconButton></Tooltip>
        <Tooltip title="Refresh"><span><IconButton onClick={() => runReport()} disabled={running}><RefreshIcon /></IconButton></span></Tooltip>
        <Button variant="outlined" size="small" startIcon={<SaveIcon />} onClick={openSave} sx={{ textTransform: 'none' }}>
          {savedId ? 'Update' : 'Save'}
        </Button>
        {savedId && (
          <Tooltip title="Email delivery schedule">
            <IconButton aria-label="Email delivery schedule" onClick={openSchedules}><ScheduleIcon /></IconButton>
          </Tooltip>
        )}
        <Button variant="outlined" size="small" startIcon={exporting ? <CircularProgress size={16} /> : <CsvIcon />} onClick={handleExport} disabled={exporting || !data} sx={{ textTransform: 'none' }}>
          CSV
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={3}>
        {/* ─── Configuration ─── */}
        <Grid item xs={12} md={4}>
          <Stack spacing={2.5}>
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>DATASET</Typography>
              <FormControl fullWidth size="small">
                <InputLabel id="builder-dataset-label">Dataset</InputLabel>
                <Select value={datasetId} label="Dataset" labelId="builder-dataset-label" onChange={e => {
                  const id = e.target.value
                  setDatasetId(id)
                  const ds = datasets.find(d => d.id === id)
                  setColumns(ds ? ds.columns.slice(0, 6).map(c => c.key) : [])
                  setFilters([])
                  setGroupBy('')
                  setAggregations([])
                  setSortBy('')
                  setData(null)
                }}>
                  {datasets.map(d => <MenuItem key={d.id} value={d.id}>{d.label}</MenuItem>)}
                </Select>
              </FormControl>
              {dataset && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>{dataset.description}</Typography>}
            </Paper>

            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>COLUMNS ({columns.length})</Typography>
              <Box sx={{ maxHeight: 260, overflowY: 'auto' }}>
                {dataset?.columns.map(c => (
                  <FormControlLabel
                    key={c.key}
                    control={<Checkbox size="small" checked={columns.includes(c.key)} onChange={() => toggleColumn(c.key)} />}
                    label={<Stack direction="row" spacing={1} alignItems="center"><Typography variant="body2">{c.label}</Typography><Chip label={c.type} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.62rem' }} /></Stack>}
                    sx={{ display: 'flex', m: 0 }}
                  />
                ))}
              </Box>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>FILTERS {filters.length > 0 && `(${filters.length})`}</Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={() => setFilters(prev => [...prev, { field: dataset?.columns[0]?.key || '', op: 'eq', value: '' }])} sx={{ textTransform: 'none' }}>
                  Add
                </Button>
              </Stack>
              {filters.length === 0 && <Typography variant="caption" color="text.secondary">No filters — the report pulls every row in the dataset.</Typography>}
              <Stack spacing={1.5}>
                {filters.map((f, i) => (
                  <Stack key={i} direction="row" spacing={1} alignItems="center">
                    <Select size="small" value={f.field} onChange={e => updateFilter(i, { field: e.target.value })} sx={{ minWidth: 120, maxWidth: 150 }}>
                      {dataset?.columns.map(c => <MenuItem key={c.key} value={c.key}>{c.label}</MenuItem>)}
                    </Select>
                    <Select size="small" value={f.op} onChange={e => updateFilter(i, { op: e.target.value })} sx={{ minWidth: 110 }}>
                      {OP_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                    </Select>
                    {filterInput(f, i)}
                    <IconButton size="small" onClick={() => setFilters(prev => prev.filter((_, j) => j !== i))}><DeleteIcon fontSize="small" /></IconButton>
                  </Stack>
                ))}
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>GROUP & AGGREGATE</Typography>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel id="builder-groupby-label">Group by</InputLabel>
              <Select value={groupBy} label="Group by" labelId="builder-groupby-label" onChange={e => { setGroupBy(e.target.value); setSortBy('') }}>
                  <MenuItem value="">No grouping</MenuItem>
                  {dataset?.columns.filter(c => c.type === 'text' || c.type === 'date').map(c => <MenuItem key={c.key} value={c.key}>{c.label}</MenuItem>)}
                </Select>
              </FormControl>
              {aggregations.map((a, i) => (
                <Stack key={i} direction="row" spacing={1} sx={{ mb: 1.5 }}>
                  <Select size="small" value={a.func} onChange={e => setAggregations(prev => prev.map((x, j) => (j === i ? { ...x, func: e.target.value, field: e.target.value === 'count' ? '' : x.field } : x)))} sx={{ minWidth: 130 }}>
                    {AGG_FUNCS.map(f => <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>)}
                  </Select>
                  {a.func !== 'count' && (
                    <Select size="small" value={a.field} displayEmpty onChange={e => setAggregations(prev => prev.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)))} sx={{ flex: 1 }}>
                      <MenuItem value="" disabled>Field</MenuItem>
                      {dataset?.columns.filter(c => c.aggregatable).map(c => <MenuItem key={c.key} value={c.key}>{c.label}</MenuItem>)}
                    </Select>
                  )}
                  <IconButton size="small" onClick={() => setAggregations(prev => prev.filter((_, j) => j !== i))}><DeleteIcon fontSize="small" /></IconButton>
                </Stack>
              ))}
              <Button size="small" startIcon={<AddIcon />} disabled={!groupBy} onClick={() => setAggregations(prev => [...prev, { func: 'count', field: '' }])} sx={{ textTransform: 'none' }}>
                Add aggregation
              </Button>
              {!groupBy && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Group by a field first, then aggregate.</Typography>}
            </Paper>

            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>SORT, LIMIT & VIEW</Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <FormControl size="small" sx={{ flex: 1 }}>
                  <InputLabel id="builder-sortby-label">Sort by</InputLabel>
                  <Select value={sortBy} label="Sort by" labelId="builder-sortby-label" onChange={e => setSortBy(e.target.value)}>
                    <MenuItem value="">Default</MenuItem>
                    {outputKeys.map(k => <MenuItem key={k} value={k}>{dataset?.columns.find(c => c.key === k)?.label || (k === 'records' ? 'Records' : k)}</MenuItem>)}
                  </Select>
                </FormControl>
                <ToggleButtonGroup value={sortDir} exclusive size="small" onChange={(_, v) => v && setSortDir(v)}>
                  <ToggleButton value="desc">↓</ToggleButton>
                  <ToggleButton value="asc">↑</ToggleButton>
                </ToggleButtonGroup>
              </Stack>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <TextField label="Row limit" type="number" size="small" value={rowLimit} onChange={e => setRowLimit(Number(e.target.value))} inputProps={{ min: 1, max: 5000 }} sx={{ width: 130 }} />
                <Typography variant="caption" color="text.secondary">Max 5,000 rows per run.</Typography>
              </Stack>
              <ToggleButtonGroup value={chartType} exclusive size="small" onChange={(_, v) => v && setChartType(v)}>
                {['table', 'bar', 'pie', 'line'].map(ct => (
                  <ToggleButton key={ct} value={ct} disabled={ct !== 'table' && !grouped} sx={{ textTransform: 'none', px: 1.5 }}>
                    <Stack direction="row" spacing={0.5} alignItems="center">{CHART_ICONS[ct]}<Typography variant="caption">{ct[0].toUpperCase() + ct.slice(1)}</Typography></Stack>
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              {chartType !== 'table' && !grouped && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Charts need a grouped report.</Typography>}
            </Paper>

            <Button variant="contained" size="large" startIcon={running ? <CircularProgress size={18} color="inherit" /> : <FilterIcon />} disabled={running} onClick={() => runReport()} sx={{ textTransform: 'none', fontWeight: 600 }}>
              {running ? 'Running…' : 'Run report'}
            </Button>
          </Stack>
        </Grid>

        {/* ─── Preview ─── */}
        <Grid item xs={12} md={8}>
          {runError && <Alert severity="error" sx={{ mb: 2 }}>{runError}</Alert>}
          {groupingError && <Alert severity="warning" sx={{ mb: 2 }}>{groupingError}</Alert>}

          {running ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
          ) : data ? (
            <Stack spacing={3}>
              {data.summary.cards.length > 0 && (
                <Stack direction="row" spacing={2} sx={{ overflowX: 'auto', pb: 1 }}>
                  {data.summary.cards.map((card, i) => (
                    <Box key={i} sx={{ minWidth: 160, flex: '1 1 160px' }}><StatCard {...card} /></Box>
                  ))}
                </Stack>
              )}
              {chartType !== 'table' && data.series.length > 0 && (
                <Box>
                  {chartType === 'bar' && <BarChart title={data.report.title} data={data.series} horizontal={data.series.length <= 8} />}
                  {chartType === 'pie' && <PieChart title={data.report.title} data={data.series} donut centerLabel="Total" />}
                  {chartType === 'line' && <LineChart title={data.report.title} data={data.series} />}
                </Box>
              )}
              {data.table.rows.length > 0 ? (
                <ReportTable title={`${data.report.title} — Data`} columns={data.table.columns} rows={data.table.rows} pageSize={20} />
              ) : (
                <Paper variant="outlined" sx={{ p: 6, textAlign: 'center', borderRadius: 2 }}>
                  <Typography variant="h6" color="text.secondary">No rows match</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Loosen a filter or widen the selection and run again.</Typography>
                </Paper>
              )}
            </Stack>
          ) : (
            <Paper variant="outlined" sx={{ p: 6, textAlign: 'center', borderRadius: 2 }}>
              <Typography variant="h6" color="text.secondary">Configure, then run</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>The preview lands here — charts for grouped reports, rows for everything.</Typography>
            </Paper>
          )}
        </Grid>
      </Grid>

      {/* ─── Saved library ─── */}
      <Drawer anchor="right" open={libraryOpen} onClose={() => setLibraryOpen(false)} PaperProps={{ sx: { width: 360, p: 3 } }}>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Saved reports</Typography>
            <IconButton size="small" onClick={() => setLibraryOpen(false)}><CloseIcon /></IconButton>
          </Stack>
          <Divider />
          {saved.length === 0 && <Typography variant="body2" color="text.secondary">Nothing saved yet — build a report and press Save.</Typography>}
          {saved.map(r => (
            <Paper key={r.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{r.name}</Typography>
              {r.description && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{r.description}</Typography>}
              <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                <Button size="small" variant="outlined" onClick={() => { setLibraryOpen(false); navigate(`/reports/custom/${r.id}`) }} sx={{ textTransform: 'none' }}>Open</Button>
                {confirmDelete === r.id ? (
                  <>
                    <Button size="small" color="error" variant="contained" onClick={() => handleDelete(r.id)} sx={{ textTransform: 'none' }}>Confirm</Button>
                    <Button size="small" onClick={() => setConfirmDelete(null)} sx={{ textTransform: 'none' }}>Keep</Button>
                  </>
                ) : (
                  <Button size="small" color="error" onClick={() => setConfirmDelete(r.id)} sx={{ textTransform: 'none' }}>Delete</Button>
                )}
              </Stack>
            </Paper>
          ))}
        </Stack>
      </Drawer>

      {/* ─── Save dialog ─── */}
      <Dialog open={saveOpen} onClose={() => setSaveOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{savedId ? 'Update saved report' : 'Save report'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" fullWidth size="small" value={saveName} onChange={e => setSaveName(e.target.value)} inputProps={{ maxLength: 120 }} />
            <TextField label="Description (optional)" fullWidth size="small" multiline rows={2} value={saveDesc} onChange={e => setSaveDesc(e.target.value)} inputProps={{ maxLength: 500 }} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving} sx={{ textTransform: 'none' }}>
            {saving ? <CircularProgress size={18} color="inherit" /> : savedId ? 'Update' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Delivery schedules ─── */}
      <Dialog open={schedOpen} onClose={() => setSchedOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Email delivery</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              The report re-runs against live data on cadence and emails the CSV. Times use your organisation's timezone.
            </Typography>
            {schedLoading ? <CircularProgress size={24} /> : schedules.map(s => (
              <Paper key={s.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{describeSchedule(s)}{s.enabled ? '' : ' (paused)'}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      To {s.recipient_ids.length} recipient{s.recipient_ids.length === 1 ? '' : 's'}
                      {s.next_run_at ? ` · next run ${new Date(s.next_run_at).toLocaleString()}` : ''}
                      {s.last_run_at ? ` · last run ${new Date(s.last_run_at).toLocaleString()}` : ''}
                    </Typography>
                    {s.last_error && <Typography variant="caption" color="error" sx={{ display: 'block' }}>{s.last_error}</Typography>}
                  </Box>
                  <Tooltip title="Edit"><IconButton size="small" onClick={() => startEditSchedule(s)}><ScheduleIcon fontSize="small" /></IconButton></Tooltip>
                  <IconButton size="small" color="error" onClick={() => handleDeleteSchedule(s.id)}><DeleteIcon fontSize="small" /></IconButton>
                </Stack>
                <Box sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.04em' }}>RECENT RUNS</Typography>
                  {(deliveries[s.id] || []).length === 0 ? (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      No deliveries recorded yet — the next sweep run will appear here.
                    </Typography>
                  ) : (
                    <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                      {(deliveries[s.id] || []).map(d => (
                        <Stack key={d.id} direction="row" spacing={1} alignItems="baseline">
                          <Box
                            aria-label={d.status === 'sent' ? 'sent' : 'failed'}
                            sx={{
                              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                              alignSelf: 'center',
                              bgcolor: d.status === 'sent' ? 'success.main' : 'error.main',
                            }}
                          />
                          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                            {new Date(d.ran_at).toLocaleString()}
                          </Typography>
                          <Typography variant="caption" sx={{ minWidth: 0 }}>
                            {d.status === 'sent'
                              ? `${d.recipient_count} recipient${d.recipient_count === 1 ? '' : 's'} · ${d.row_count} rows`
                              : `Failed — ${d.error || 'delivery failed'}`}
                          </Typography>
                        </Stack>
                      ))}                    </Stack>
                  )}
                </Box>
              </Paper>
            ))}
            {!schedLoading && schedules.length === 0 && (
              <Typography variant="body2" color="text.secondary">No schedules yet — add one below.</Typography>
            )}
            <Divider />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{editingId ? 'EDIT SCHEDULE' : 'NEW SCHEDULE'}</Typography>
            <Stack direction="row" spacing={1.5}>
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel id="sched-freq-label">Frequency</InputLabel>
                <Select value={schedFreq} label="Frequency" labelId="sched-freq-label" onChange={e => setSchedFreq(e.target.value as 'daily' | 'weekly' | 'monthly')}>
                  <MenuItem value="daily">Daily</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="monthly">Monthly</MenuItem>
                </Select>
              </FormControl>
              {schedFreq === 'weekly' && (
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel id="sched-dayw-label">Day</InputLabel>
                  <Select value={schedDayW} label="Day" labelId="sched-dayw-label" onChange={e => setSchedDayW(Number(e.target.value))}>
                    {WEEK_DAYS.map((d, i) => <MenuItem key={d} value={i}>{d}</MenuItem>)}
                  </Select>
                </FormControl>
              )}
              {schedFreq === 'monthly' && (
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel id="sched-daym-label">Day of month</InputLabel>
                  <Select value={schedDayM} label="Day of month" labelId="sched-daym-label" onChange={e => setSchedDayM(Number(e.target.value))}>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                  </Select>
                </FormControl>
              )}
              <TextField label="Time" type="time" size="small" value={schedTime} onChange={e => setSchedTime(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 130 }} />
            </Stack>
            <FormControl size="small" fullWidth>
              <InputLabel id="sched-recip-label">Recipients</InputLabel>
              <Select
                multiple value={schedRecipients} label="Recipients" labelId="sched-recip-label"
                onChange={e => setSchedRecipients(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                renderValue={ids => (ids as string[]).map(id => recipients.find(r => r.id === id)?.name || id).join(', ')}
              >
                {recipients.map(r => (
                  <MenuItem key={r.id} value={r.id}>
                    <Checkbox size="small" checked={schedRecipients.includes(r.id)} />
                    <Box>
                      <Typography variant="body2">{r.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{r.email} · {r.role}</Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={<Switch size="small" checked={schedEnabled} onChange={e => setSchedEnabled(e.target.checked)} />}
              label={<Typography variant="body2">Enabled</Typography>}
            />
            <Stack direction="row" spacing={1}>
              <Button variant="contained" size="small" onClick={handleSaveSchedule} disabled={schedSaving} sx={{ textTransform: 'none' }}>
                {schedSaving ? <CircularProgress size={16} color="inherit" /> : editingId ? 'Update schedule' : 'Add schedule'}
              </Button>
              {editingId && <Button size="small" onClick={() => setEditingId(null)} sx={{ textTransform: 'none' }}>Cancel</Button>}
              <Button
                size="small" variant="outlined" startIcon={sendingNow ? <CircularProgress size={14} /> : <SendIcon fontSize="small" />}
                onClick={handleSendNow} disabled={sendingNow} sx={{ textTransform: 'none' }}
              >
                Email me now
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSchedOpen(false)} sx={{ textTransform: 'none' }}>Done</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snackbar} autoHideDuration={3000} message={snackbar} onClose={() => setSnackbar('')} />
    </PageContainer>
  )
}
