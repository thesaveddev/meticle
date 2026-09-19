import { useMemo, useState } from 'react'
import {
  Alert, Box, Button, Chip, CircularProgress, Collapse, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, Paper, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TablePagination, TableRow, Tab, Tabs, TextField, Typography,
} from '@mui/material'
import {
  CheckCircle as CheckCircleIcon,
  ReceiptLong as ReceiptLongIcon,
  Block as BlockIcon,
  PictureAsPdf as PdfIcon,
  Download as DownloadIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Person as PersonIcon,
  TrendingUp as TrendingIcon,
  Warning as WarningIcon,
  Receipt as ReceiptIcon,
  Groups as GroupsIcon,
} from '@mui/icons-material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { EmptyState } from '../../components/design/EmptyState'
import PageContainer from '../../components/design/PageContainer'

/* ── Helpers ── */
const money = (pence: number | null | undefined) => pence == null ? '—' : `£${(Number(pence) / 100).toFixed(2)}`
const dateLabel = (value: string) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtMins = (m: number) => { const h = Math.floor(Number(m || 0) / 60); const min = Number(m || 0) % 60; return h > 0 ? `${h}h ${min}m` : `${min}m` }

function getMonthRange(monthsBack = 0) {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1)
  const to = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 0)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

function getQuarterRange() {
  const now = new Date()
  const q = Math.floor(now.getMonth() / 3)
  const from = new Date(now.getFullYear(), q * 3, 1)
  const to = new Date(now.getFullYear(), q * 3 + 3, 0)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

const fundingColors: Record<string, { bg: string; color: string }> = {
  private: { bg: '#F3F4F6', color: '#374151' },
  local_authority: { bg: '#EFF6FF', color: '#1D4ED8' },
  nhs: { bg: '#ECFDF5', color: '#047857' },
  other: { bg: '#FFF5D9', color: '#D97706' },
}

function FundingChip({ type }: { type: string }) {
  const c = fundingColors[type] || fundingColors.other
  return <Chip size="small" label={String(type || 'private').replace(/_/g, ' ')} sx={{ bgcolor: c.bg, color: c.color, fontWeight: 600, fontSize: '0.7rem', height: 22 }} />
}

function StatusChip({ status }: { status: string }) {
  const config: Record<string, { bg: string; color: string; label: string }> = {
    billable: { bg: '#ECFDF5', color: '#047857', label: 'Billable' },
    review: { bg: '#FFF5D9', color: '#D97706', label: 'Review' },
    not_billable: { bg: '#F3F4F6', color: '#6B7280', label: 'Not billable' },
  }
  const c = config[status] || config.not_billable
  return <Chip size="small" label={c.label} sx={{ bgcolor: c.bg, color: c.color, fontWeight: 600, fontSize: '0.7rem', height: 22 }} />
}

/* ── Stat card ── */
function StatCard({ icon, label, value, color, sub }: {
  icon: React.ReactNode; label: string; value: string; color: string; sub?: string
}) {
  return (
    <Paper elevation={0} sx={{
      p: 2, flex: '1 1 140px', minWidth: 130,
      border: '1px solid', borderColor: 'grey.100', borderRadius: 2.5,
      display: 'flex', alignItems: 'center', gap: 1.5,
      transition: 'border-color 0.15s',
      '&:hover': { borderColor: color + '40' },
    }}>
      <Box sx={{
        width: 40, height: 40, borderRadius: 2, bgcolor: color + '10',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.2, display: 'block' }}>{label}</Typography>
        <Typography variant="subtitle1" sx={{ fontWeight: 800, color, lineHeight: 1.3 }}>{value}</Typography>
        {sub && <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>{sub}</Typography>}
      </Box>
    </Paper>
  )
}

/* ── Client group row ── */
function ClientGroup({ name, package_name, rows, rate }: { name: string; package_name: string; rows: any[]; rate: number | null }) {
  const [open, setOpen] = useState(false)
  const billable = rows.filter(r => r.billing_status === 'billable')
  const gross = billable.reduce((s, r) => s + Number(r.gross_amount_pence ?? r.amount_pence ?? 0), 0)
  const totalMins = rows.reduce((s, r) => s + Number(r.delivered_minutes || 0), 0)
  const reviewCount = rows.filter(r => r.billing_status === 'review').length

  return (
    <Paper elevation={0} sx={{
      border: '1px solid', borderColor: 'grey.100', borderRadius: 2.5, overflow: 'hidden',
      transition: 'border-color 0.15s',
      '&:hover': { borderColor: '#0F4C8130' },
    }}>
      <Box
        sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer', '&:hover': { bgcolor: 'grey.50' } }}
        onClick={() => setOpen(!open)}
      >
        <Box sx={{
          width: 36, height: 36, borderRadius: 2, bgcolor: '#0F4C8110',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <PersonIcon sx={{ fontSize: 18, color: '#0F4C81' }} />
        </Box>
        <Box flex={1} sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{name}</Typography>
            {package_name && <Typography variant="caption" sx={{ color: 'text.secondary' }}>· {package_name}</Typography>}
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            {rows.length} visit{rows.length !== 1 ? 's' : ''} · {fmtMins(totalMins)} delivered{rate != null ? ` · ${money(rate)}/hr` : ''}
          </Typography>
        </Box>
        <Stack direction="row" alignItems="center" gap={1.5} flexShrink={0}>
          {reviewCount > 0 && (
            <Chip icon={<WarningIcon sx={{ fontSize: 14 }} />} size="small" label={`${reviewCount} review`}
              sx={{ bgcolor: '#FFF5D9', color: '#D97706', fontWeight: 600, fontSize: '0.7rem', height: 22 }} />
          )}
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0F4C81' }}>{money(gross)}</Typography>
          <IconButton size="small" sx={{ color: 'text.secondary' }}>{open ? <CollapseIcon fontSize="small" /> : <ExpandIcon fontSize="small" />}</IconButton>
        </Stack>
      </Box>
      <Collapse in={open}>
        <Box sx={{ px: 2, pb: 2 }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>Funding</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>Delivered</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>Gross</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>Decision</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r: any) => (
                  <TableRow key={r.visit_id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{dateLabel(r.scheduled_start)}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>{r.scheduled_minutes} scheduled</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={r.visit_status.replace(/_/g, ' ')}
                        sx={{
                          fontSize: '0.7rem', height: 20,
                          bgcolor: r.visit_status === 'completed' ? '#ECFDF5' : r.visit_status === 'cancelled' ? '#FDECEC' : r.visit_status === 'missed' ? '#FDECEC' : '#F3F4F6',
                          color: r.visit_status === 'completed' ? '#047857' : r.visit_status === 'cancelled' || r.visit_status === 'missed' ? '#B42318' : '#374151',
                          fontWeight: 500,
                        }} />
                    </TableCell>
                    <TableCell><FundingChip type={r.funding_type} /></TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{fmtMins(r.delivered_minutes)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F4C81', fontSize: '0.85rem' }}>{money(r.gross_amount_pence ?? r.amount_pence)}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem' }}>
                        {money(r.net_amount_pence ?? r.amount_pence)} net{r.vat_amount_pence ? ` · ${money(r.vat_amount_pence)} VAT` : ''}
                      </Typography>
                    </TableCell>
                    <TableCell><StatusChip status={r.billing_status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Collapse>
    </Paper>
  )
}

/* ── Main Page ── */
export default function ClientBillingPage() {
  const user = useMemo(() => { try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} } }, [])
  const isManager = user.role === 'ORG_ADMIN' || user.role === 'MANAGER'
  const queryClient = useQueryClient()

  const [from, setFrom] = useState(() => getMonthRange().from)
  const [to, setTo] = useState(() => getMonthRange().to)
  const [message, setMessage] = useState('')
  const [selectedRun, setSelectedRun] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voidDialog, setVoidDialog] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(0)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [fundingFilter, setFundingFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grouped' | 'table'>('grouped')

  /* ── Queries ── */
  const utilisation = useQuery({
    queryKey: ['homecare-client-utilisation', from, to],
    queryFn: () => api.get('/homecare/client-billing/utilisation', { params: { from, to } }).then(r => Array.isArray(r.data) ? r.data : []),
    enabled: isManager && Boolean(from && to),
  })
  const runs = useQuery({
    queryKey: ['homecare-client-billing-runs'],
    queryFn: () => api.get('/homecare/client-billing/runs').then(r => Array.isArray(r.data) ? r.data : []),
    enabled: isManager,
  })
  const lines = useQuery({
    queryKey: ['homecare-client-billing-lines', selectedRun],
    queryFn: () => api.get(`/homecare/client-billing/runs/${selectedRun}/lines`).then(r => Array.isArray(r.data) ? r.data : []),
    enabled: Boolean(selectedRun),
  })

  /* ── Mutations ── */
  const createRun = useMutation({
    mutationFn: () => api.post('/homecare/client-billing/runs', { from, to }),
    onSuccess: (response) => {
      setSelectedRun(response.data.run.id)
      setMessage(`Draft billing run created with ${response.data.lines.length} visit line${response.data.lines.length === 1 ? '' : 's'}. VAT, funding and cancellation policy were snapshot at creation.`)
      setActiveTab(1)
      queryClient.invalidateQueries({ queryKey: ['homecare-client-billing-runs'] })
      queryClient.invalidateQueries({ queryKey: ['homecare-client-billing-lines'] })
    },
    onError: (error: any) => setMessage(error.response?.data?.message || 'Could not create billing run.'),
  })
  const approveRun = useMutation({
    mutationFn: (runId: string) => api.post(`/homecare/client-billing/runs/${runId}/approve`),
    onSuccess: (response) => {
      setMessage(`Billing run approved${response.data?.invoice_number ? ` as ${response.data.invoice_number}` : ''}. Approved runs are immutable; void with an audited reason if you need to correct them.`)
      queryClient.invalidateQueries({ queryKey: ['homecare-client-billing-runs'] })
    },
    onError: (error: any) => setMessage(error.response?.data?.message || 'Could not approve billing run.'),
  })
  const voidRun = useMutation({
    mutationFn: ({ runId, reason }: { runId: string; reason: string }) => api.post(`/homecare/client-billing/runs/${runId}/void`, { void_reason: reason }),
    onSuccess: () => {
      setMessage('Approved billing run voided with audited reversal.')
      setVoidDialog(null)
      setVoidReason('')
      queryClient.invalidateQueries({ queryKey: ['homecare-client-billing-runs'] })
    },
    onError: (error: any) => setMessage(error.response?.data?.message || 'Could not void billing run.'),
  })

  /* ── Derived data ── */
  const rows = utilisation.data || []
  const billable = rows.filter((r: any) => r.billing_status === 'billable')
  const review = rows.filter((r: any) => r.billing_status === 'review')
  const notBillable = rows.filter((r: any) => r.billing_status === 'not_billable')
  const netTotal = billable.reduce((s: number, r: any) => s + Number(r.net_amount_pence ?? r.amount_pence ?? 0), 0)
  const vatTotal = billable.reduce((s: number, r: any) => s + Number(r.vat_amount_pence ?? 0), 0)
  const grossTotal = billable.reduce((s: number, r: any) => s + Number(r.gross_amount_pence ?? r.amount_pence ?? 0), 0)
  const currentRun = (runs.data || []).find((run: any) => run.id === selectedRun)
  const fundingBreakdown = currentRun?.funding_breakdown || null

  /* ── Filtering ── */
  const filtered = useMemo(() => {
    let result = rows
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((r: any) =>
        (r.person_name || '').toLowerCase().includes(q) ||
        (r.package_name || '').toLowerCase().includes(q) ||
        (r.visit_status || '').toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'all') result = result.filter((r: any) => r.billing_status === statusFilter)
    if (fundingFilter !== 'all') result = result.filter((r: any) => r.funding_type === fundingFilter)
    return result
  }, [rows, search, statusFilter, fundingFilter])

  /* ── Client groups ── */
  const clientGroups = useMemo(() => {
    const map = new Map<string, { name: string; package_name: string; rows: any[]; rate: number | null }>()
    for (const r of filtered) {
      const key = `${r.person_name}__${r.package_name}`
      if (!map.has(key)) map.set(key, { name: r.person_name, package_name: r.package_name, rows: [], rate: r.client_rate_pence })
      map.get(key)!.rows.push(r)
    }
    return Array.from(map.values()).sort((a, b) => b.rows.length - a.rows.length)
  }, [filtered])

  /* ── Paginated rows for table view ── */
  const paginatedRows = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)

  /* ── Funding type options ── */
  const fundingTypes = useMemo(() => {
    const set = new Set(rows.map((r: any) => r.funding_type))
    return Array.from(set)
  }, [rows])

  /* ── Export CSV ── */
  const exportCsv = () => {
    const headers = ['client', 'package', 'date', 'status', 'funding', 'scheduled_min', 'delivered_min', 'rate_pence', 'net_pence', 'vat_pence', 'gross_pence', 'billing_status']
    const escape = (v: unknown) => String(v ?? '')
    const csv = [headers.join(','), ...filtered.map((r: any) => [
      r.person_name, r.package_name, r.scheduled_start, r.visit_status, r.funding_type,
      r.scheduled_minutes, r.delivered_minutes, r.client_rate_pence,
      r.net_amount_pence, r.vat_amount_pence, r.gross_amount_pence, r.billing_status,
    ].map(escape).join(','))].join('\n') + '\n'
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `billing-utilisation-${from}-${to}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  if (!isManager) return <PageContainer><Alert severity="info">Client billing is available to managers and organisation administrators.</Alert></PageContainer>

  return (
    <PageContainer>
      {/* Header */}
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 2.5 }}>
        <Stack direction="row" alignItems="center" gap={1.5}>
          <TrendingIcon sx={{ color: '#0F4C81', fontSize: 28 }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>Client billing</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Review delivered visits and prepare client invoices. VAT and funding are snapshot at creation.
            </Typography>
          </Box>
        </Stack>
        <Button variant="contained" startIcon={<ReceiptLongIcon />}
          onClick={() => createRun.mutate()} disabled={createRun.isPending || !from || !to || from > to}
          sx={{ textTransform: 'none', bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0D3D6B' } }}>
          {createRun.isPending ? <CircularProgress size={18} color="inherit" /> : 'Create draft run'}
        </Button>
      </Stack>

      {message && <Alert severity={message.startsWith('Could not') ? 'error' : 'success'} onClose={() => setMessage('')} sx={{ mb: 2.5 }}>{message}</Alert>}

      {/* Date range + quick presets */}
      <Paper elevation={0} sx={{ p: 2, mb: 2.5, border: '1px solid', borderColor: 'grey.100', borderRadius: 2.5 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} flexWrap="wrap">
          <TextField type="date" label="From" size="small" value={from} onChange={e => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }} />
          <TextField type="date" label="To" size="small" value={to} onChange={e => setTo(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }} />
          <Stack direction="row" gap={0.5} flexWrap="wrap">
            {[
              { label: 'This month', range: getMonthRange() },
              { label: 'Last month', range: getMonthRange(1) },
              { label: 'This quarter', range: getQuarterRange() },
            ].map(p => (
              <Button key={p.label} size="small" variant="text" onClick={() => { setFrom(p.range.from); setTo(p.range.to) }}
                sx={{ textTransform: 'none', fontSize: '0.75rem', color: '#0F4C81' }}>
                {p.label}
              </Button>
            ))}
          </Stack>
          <Box sx={{ flex: 1 }} />
          <Button size="small" variant="outlined" onClick={exportCsv} disabled={!filtered.length}
            sx={{ textTransform: 'none', borderColor: '#E5E7EB', color: 'text.primary', fontSize: '0.75rem' }}>
            Export CSV
          </Button>
        </Stack>
      </Paper>

      {/* Tabs */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'grey.100', borderRadius: 2.5, mb: 2.5 }}>
        <Tabs value={activeTab} onChange={(_, v) => { setActiveTab(v); setPage(0); setSearch(''); setStatusFilter('all'); setFundingFilter('all') }}
          sx={{ px: 2, borderBottom: '1px solid #E5E7EB', minHeight: 44, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minHeight: 44, fontSize: '0.85rem' } }}>
          <Tab label={`Utilisation (${rows.length})`} />
          <Tab label={`Billing runs (${(runs.data || []).length})`} />
        </Tabs>
      </Paper>

      {/* ═══ TAB 0: Utilisation ═══ */}
      {activeTab === 0 && (
        <>
          {/* Stat cards */}
          <Stack direction="row" gap={1.5} mb={2.5} flexWrap="wrap">
            <StatCard icon={<ReceiptIcon sx={{ fontSize: 20, color: '#0F4C81' }} />} label="Total visits" value={String(rows.length)} color="#0F4C81" sub={`in period`} />
            <StatCard icon={<CheckCircleIcon sx={{ fontSize: 20, color: '#10b981' }} />} label="Billable" value={String(billable.length)} color="#10b981" sub={money(grossTotal)} />
            <StatCard icon={<WarningIcon sx={{ fontSize: 20, color: '#D97706' }} />} label="Needs review" value={String(review.length)} color="#D97706" />
            <StatCard icon={<BlockIcon sx={{ fontSize: 20, color: '#6B7280' }} />} label="Not billable" value={String(notBillable.length)} color="#6B7280" sub="cancelled/missed" />
            <StatCard icon={<TrendingIcon sx={{ fontSize: 20, color: '#8b5cf6' }} />} label="Net total" value={money(netTotal)} color="#8b5cf6" />
            <StatCard icon={<TrendingIcon sx={{ fontSize: 20, color: '#3b82f6' }} />} label="VAT" value={money(vatTotal)} color="#3b82f6" />
          </Stack>

          {/* Search & filter bar */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} mb={2} alignItems={{ sm: 'center' }}>
            <TextField
              size="small" placeholder="Search client, package, or status…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
              InputProps={{ startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 0.5, fontSize: 18 }} /> }}
              sx={{ flex: 1, minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <TextField select size="small" value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(0) }}
              sx={{ minWidth: 130, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              SelectProps={{ native: true }}>
              <option value="all">All status</option>
              <option value="billable">Billable</option>
              <option value="review">Review</option>
              <option value="not_billable">Not billable</option>
            </TextField>
            <TextField select size="small" value={fundingFilter}
              onChange={e => { setFundingFilter(e.target.value); setPage(0) }}
              sx={{ minWidth: 140, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              SelectProps={{ native: true }}>
              <option value="all">All funding</option>
              {fundingTypes.map(ft => (
                <option key={ft} value={ft}>{String(ft).replace(/_/g, ' ')}</option>
              ))}
            </TextField>
            <Stack direction="row" gap={0.5}>
              <Button size="small" variant={viewMode === 'grouped' ? 'contained' : 'outlined'}
                onClick={() => setViewMode('grouped')}
                sx={{ textTransform: 'none', minWidth: 0, px: 1.5, bgcolor: viewMode === 'grouped' ? '#0F4C81' : undefined, '&:hover': { bgcolor: viewMode === 'grouped' ? '#0D3D6B' : undefined } }}>
                <GroupsIcon sx={{ fontSize: 18 }} />
              </Button>
              <Button size="small" variant={viewMode === 'table' ? 'contained' : 'outlined'}
                onClick={() => setViewMode('table')}
                sx={{ textTransform: 'none', minWidth: 0, px: 1.5, bgcolor: viewMode === 'table' ? '#0F4C81' : undefined, '&:hover': { bgcolor: viewMode === 'table' ? '#0D3D6B' : undefined } }}>
                <FilterIcon sx={{ fontSize: 18 }} />
              </Button>
            </Stack>
          </Stack>

          {/* Grouped view */}
          {viewMode === 'grouped' && (
            <Stack spacing={1}>
              {utilisation.isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
              ) : clientGroups.length === 0 ? (
                <EmptyState title="No visits in this period" description="Select a different date range or create a billing run" variant="default" />
              ) : (
                clientGroups.map(g => (
                  <ClientGroup key={`${g.name}__${g.package_name}`} name={g.name} package_name={g.package_name} rows={g.rows} rate={g.rate} />
                ))
              )}
            </Stack>
          )}

          {/* Table view */}
          {viewMode === 'table' && (
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'grey.100', borderRadius: 2.5 }}>
              {utilisation.isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
              ) : (
                <>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>Visit</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>Client / package</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>Funding</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>Status</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>Delivered</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>Net / VAT / gross</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>Decision</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {!paginatedRows.length ? (
                          <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                            {rows.length ? 'No visits match your filters' : 'No visits in this period'}
                          </TableCell></TableRow>
                        ) : paginatedRows.map((row: any) => (
                          <TableRow key={row.visit_id} hover>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{dateLabel(row.scheduled_start)}</Typography>
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                                {row.scheduled_minutes} scheduled min · {row.vat_inclusive ? 'VAT inclusive' : row.vat_rate ? `VAT ${row.vat_rate}%` : 'No VAT'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{row.person_name}</Typography>
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>{row.package_name} · {money(row.client_rate_pence)}/hr</Typography>
                            </TableCell>
                            <TableCell><FundingChip type={row.funding_type} /></TableCell>
                            <TableCell>
                              <Chip size="small" label={row.visit_status.replace(/_/g, ' ')}
                                sx={{
                                  fontSize: '0.7rem', height: 20,
                                  bgcolor: row.visit_status === 'completed' ? '#ECFDF5' : '#F3F4F6',
                                  color: row.visit_status === 'completed' ? '#047857' : '#374151',
                                  fontWeight: 500,
                                }} />
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{fmtMins(row.delivered_minutes)}</Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F4C81', fontSize: '0.85rem' }}>{money(row.gross_amount_pence ?? row.amount_pence)}</Typography>
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem' }}>
                                {money(row.net_amount_pence ?? row.amount_pence)} net · {money(row.vat_amount_pence)} VAT
                              </Typography>
                            </TableCell>
                            <TableCell><StatusChip status={row.billing_status} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <TablePagination
                    component="div" count={filtered.length} page={page}
                    onPageChange={(_, p) => setPage(p)}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0) }}
                    rowsPerPageOptions={[10, 25, 50, 100]}
                  />
                </>
              )}
            </Paper>
          )}
        </>
      )}

      {/* ═══ TAB 1: Billing runs ═══ */}
      {activeTab === 1 && (
        <Stack spacing={1.5}>
          {(runs.data || []).length === 0 ? (
            <EmptyState title="No billing runs yet" description="Create your first billing run to generate invoices" variant="default" />
          ) : (runs.data || []).map((run: any) => {
            const isExpanded = selectedRun === run.id
            return (
              <Paper key={run.id} elevation={0} sx={{
                border: '1px solid', borderColor: isExpanded ? '#0F4C8140' : 'grey.100',
                borderRadius: 2.5, overflow: 'hidden',
                transition: 'border-color 0.15s',
              }}>
                <Box sx={{ p: 2.5, display: 'flex', alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' }, cursor: 'pointer', '&:hover': { bgcolor: 'grey.50' } }}
                  onClick={() => setSelectedRun(isExpanded ? null : run.id)}>
                  <Stack direction="row" alignItems="center" gap={1.5}>
                    <Box sx={{
                      width: 40, height: 40, borderRadius: 2,
                      bgcolor: run.status === 'approved' ? '#ECFDF5' : run.status === 'void' ? '#FDECEC' : '#F3F4F6',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {run.status === 'approved' ? <CheckCircleIcon sx={{ fontSize: 20, color: '#047857' }} /> :
                       run.status === 'void' ? <BlockIcon sx={{ fontSize: 20, color: '#B42318' }} /> :
                       <ReceiptLongIcon sx={{ fontSize: 20, color: '#6B7280' }} />}
                    </Box>
                    <Box>
                      <Stack direction="row" alignItems="center" gap={1}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{run.invoice_number || 'Draft run'}</Typography>
                        <Chip size="small" label={run.status}
                          sx={{
                            fontSize: '0.65rem', height: 20, fontWeight: 600,
                            bgcolor: run.status === 'approved' ? '#ECFDF5' : run.status === 'void' ? '#FDECEC' : '#F3F4F6',
                            color: run.status === 'approved' ? '#047857' : run.status === 'void' ? '#B42318' : '#6B7280',
                          }} />
                      </Stack>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                        {dateLabel(run.period_from)} – {dateLabel(run.period_to)} · {run.row_count} lines · gross {money(run.gross_amount_pence ?? run.total_amount_pence)} · created {dateLabel(run.created_at)}
                      </Typography>
                      {run.voided_at && (
                        <Typography variant="caption" sx={{ color: '#B42318', display: 'block' }}>
                          Voided {dateLabel(run.voided_at)}{run.void_reason ? ` — ${run.void_reason}` : ''}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                    {run.status === 'draft' && (
                      <Button size="small" variant="contained" startIcon={<CheckCircleIcon />}
                        onClick={(e) => { e.stopPropagation(); approveRun.mutate(run.id) }}
                        disabled={approveRun.isPending}
                        sx={{ textTransform: 'none', bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}>
                        Approve
                      </Button>
                    )}
                    {run.status === 'approved' && (
                      <>
                        <Button size="small" variant="outlined" startIcon={<PdfIcon />}
                          onClick={(e) => { e.stopPropagation(); window.open(`/api/homecare/client-billing/runs/${run.id}/invoice.pdf`, '_blank') }}
                          sx={{ textTransform: 'none', borderColor: '#E5E7EB' }}>
                          Invoice
                        </Button>
                        <Button size="small" variant="outlined" startIcon={<DownloadIcon />}
                          onClick={(e) => { e.stopPropagation(); window.open(`/api/homecare/client-billing/runs/${run.id}/mtd-export`, '_blank') }}
                          sx={{ textTransform: 'none', borderColor: '#E5E7EB' }}>
                          MTD
                        </Button>
                        <Button size="small" color="error" variant="outlined" startIcon={<BlockIcon />}
                          onClick={(e) => { e.stopPropagation(); setVoidDialog(run.id) }}
                          sx={{ textTransform: 'none' }}>
                          Void
                        </Button>
                      </>
                    )}
                    <IconButton size="small" sx={{ color: 'text.secondary' }}>
                      {isExpanded ? <CollapseIcon fontSize="small" /> : <ExpandIcon fontSize="small" />}
                    </IconButton>
                  </Stack>
                </Box>

                {/* Expanded detail */}
                <Collapse in={isExpanded}>
                  <Box sx={{ px: 2.5, pb: 2.5 }}>
                    {lines.isLoading ? <CircularProgress size={22} /> : (
                      <Stack spacing={2}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {lines.data?.length || 0} snapshot lines. The run is immutable operational output and does not create a payment.
                        </Typography>
                        {fundingBreakdown && (
                          <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem', display: 'block', mb: 1 }}>
                              Funding breakdown
                            </Typography>
                            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem' }}>Funding</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.7rem' }}>Lines</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.7rem' }}>Billable</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.7rem' }}>Net</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.7rem' }}>VAT</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.7rem' }}>Gross</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {Object.entries(fundingBreakdown as Record<string, any>).map(([key, value]: any) => (
                                    <TableRow key={key}>
                                      <TableCell><FundingChip type={key} /></TableCell>
                                      <TableCell align="right">{value.count}</TableCell>
                                      <TableCell align="right">{value.billable_count}</TableCell>
                                      <TableCell align="right">{money(value.net_pence)}</TableCell>
                                      <TableCell align="right">{money(value.vat_pence)}</TableCell>
                                      <TableCell align="right" sx={{ fontWeight: 700 }}>{money(value.gross_pence)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          </Box>
                        )}
                      </Stack>
                    )}
                  </Box>
                </Collapse>
              </Paper>
            )
          })}

          {currentRun && (
            <Alert severity={currentRun.status === 'void' ? 'warning' : 'info'} sx={{ mt: 1 }}>
              This run is <strong>{currentRun.status}</strong>{currentRun.invoice_number ? ` · ${currentRun.invoice_number}` : ''}.
              Approved runs are immutable; only a void with a recorded reason can reverse them.
            </Alert>
          )}
        </Stack>
      )}

      {/* Void dialog */}
      <Dialog open={Boolean(voidDialog)} onClose={() => setVoidDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Void approved run</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This does not delete evidence. The original approved run is retained and marked as void with your reason in the audit trail.
          </Typography>
          <TextField fullWidth multiline minRows={3} label="Reason for voiding" value={voidReason}
            onChange={e => setVoidReason(e.target.value)} placeholder="e.g. Funding code was incorrect — reissued as ..." />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVoidDialog(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" color="error"
            onClick={() => voidDialog && voidRun.mutate({ runId: voidDialog, reason: voidReason || 'Voided by manager' })}
            disabled={voidRun.isPending || !voidReason.trim()}
            sx={{ textTransform: 'none' }}>
            {voidRun.isPending ? <CircularProgress size={18} color="inherit" /> : 'Confirm void'}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  )
}
