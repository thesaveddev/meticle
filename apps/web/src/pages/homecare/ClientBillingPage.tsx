import { useMemo, useState } from 'react'
import {
  Alert, Box, Chip, Collapse, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, MenuItem, Paper, Select, Stack, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TablePagination, TableRow, Tabs, TextField, Typography,
} from '@mui/material'
import {
  ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckCircleIcon,
  Download as DownloadIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  FactCheck as FactCheckIcon,
  Groups as GroupsIcon,
  ReceiptLong as ReceiptLongIcon,
  Search as SearchIcon,
  WarningAmber as WarningAmberIcon,
} from '@mui/icons-material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { EmptyState } from '../../components/design/EmptyState'
import AppButton from '../../components/design/AppButton'
import PageContainer from '../../components/design/PageContainer'

const money = (pence: unknown) => pence == null ? '—' : `£${(Number(pence) / 100).toFixed(2)}`
const dateLabel = (value: string) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const timeLabel = (value: string) => new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const minutesLabel = (value: unknown) => { const mins = Number(value || 0); return `${Math.floor(mins / 60)}h ${mins % 60}m` }

function monthRange(offset = 0) {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() - offset, 1)
  const to = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

function quarterRange() {
  const now = new Date(); const quarter = Math.floor(now.getMonth() / 3)
  return {
    from: new Date(now.getFullYear(), quarter * 3, 1).toISOString().slice(0, 10),
    to: new Date(now.getFullYear(), quarter * 3 + 3, 0).toISOString().slice(0, 10),
  }
}

function statusTone(status: string) {
  if (status === 'billable' || status === 'completed') return { bg: 'success.50', color: 'success.dark', label: status === 'billable' ? 'Ready' : 'Completed' }
  if (status === 'review') return { bg: 'warning.50', color: 'warning.dark', label: 'Needs review' }
  if (status === 'not_billable' || status === 'cancelled' || status === 'missed') return { bg: 'grey.100', color: 'text.secondary', label: status === 'not_billable' ? 'Excluded' : status.replace(/_/g, ' ') }
  return { bg: 'grey.100', color: 'text.secondary', label: status.replace(/_/g, ' ') }
}

function StatusChip({ status }: { status: string }) {
  const tone = statusTone(status)
  return <Chip size="small" label={tone.label} sx={{ bgcolor: tone.bg, color: tone.color, fontWeight: 700, height: 24, textTransform: 'capitalize' }} />
}

function SummaryCard({ label, value, detail, tone = 'primary', icon }: { label: string; value: string; detail?: string; tone?: 'primary' | 'success' | 'warning' | 'neutral'; icon: React.ReactNode }) {
  const colors = { primary: 'primary.main', success: 'success.main', warning: 'warning.main', neutral: 'text.secondary' }
  return (
    <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2, flex: '1 1 155px', minWidth: 145 }}>
      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <Box sx={{ width: 34, height: 34, borderRadius: 1.5, bgcolor: `${colors[tone]}15`, color: colors[tone], display: 'grid', placeItems: 'center' }}>{icon}</Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
          <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.3 }}>{value}</Typography>
          {detail && <Typography variant="caption" color="text.secondary">{detail}</Typography>}
        </Box>
      </Stack>
    </Paper>
  )
}

function ReviewRow({ row }: { row: any }) {
  const [expanded, setExpanded] = useState(false)
  const tone = statusTone(row.billing_status)
  return (
    <>
      <TableRow hover sx={{ '& > td': { borderBottom: expanded ? 0 : undefined } }}>
        <TableCell sx={{ minWidth: 150 }}>
          <Typography variant="body2" fontWeight={700}>{dateLabel(row.scheduled_start)}</Typography>
          <Typography variant="caption" color="text.secondary">{timeLabel(row.scheduled_start)} · {minutesLabel(row.scheduled_minutes)} planned</Typography>
        </TableCell>
        <TableCell sx={{ minWidth: 190 }}>
          <Typography variant="body2" fontWeight={700}>{row.person_name || 'Unnamed client'}</Typography>
          <Typography variant="caption" color="text.secondary">{row.package_name || 'No package name'}</Typography>
        </TableCell>
        <TableCell><Chip size="small" label={String(row.funding_type || 'private').replace(/_/g, ' ')} sx={{ textTransform: 'capitalize', height: 23 }} /></TableCell>
        <TableCell><StatusChip status={row.billing_status} /></TableCell>
        <TableCell align="right"><Typography variant="body2" fontWeight={700}>{minutesLabel(row.delivered_minutes)}</Typography></TableCell>
        <TableCell align="right"><Typography variant="body2" fontWeight={800} color="primary.main">{money(row.gross_amount_pence)}</Typography></TableCell>
        <TableCell align="right">
          {row.billing_status === 'review' ? <Typography variant="caption" color="warning.dark" sx={{ maxWidth: 150, display: 'inline-block' }}>{row.exclusion_reason || 'Check visit record'}</Typography> : null}
          <AppButton variant="quiet" size="small" aria-label="Show billing line details" onClick={() => setExpanded(v => !v)} endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}>Details</AppButton>
        </TableCell>
      </TableRow>
      <TableRow sx={{ '& > td': { py: 0, borderBottom: expanded ? undefined : 0 } }}>
        <TableCell colSpan={7} sx={{ px: 2 }}>
          <Collapse in={expanded} unmountOnExit>
            <Box sx={{ py: 1.5, px: 1.5, bgcolor: tone.bg, borderRadius: 1.5, mb: 1.5 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} divider={<Divider orientation="vertical" flexItem />}>
                <Typography variant="caption"><strong>Visit:</strong> {row.visit_status?.replace(/_/g, ' ')}</Typography>
                <Typography variant="caption"><strong>Rate:</strong> {money(row.client_rate_pence)} / hour</Typography>
                <Typography variant="caption"><strong>Net:</strong> {money(row.net_amount_pence)}</Typography>
                <Typography variant="caption"><strong>VAT:</strong> {money(row.vat_amount_pence)}</Typography>
                {row.exclusion_reason && <Typography variant="caption"><strong>Why:</strong> {row.exclusion_reason}</Typography>}
              </Stack>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}

function RunCard({ run, selected, onSelect, onApprove, onVoid, approving }: { run: any; selected: boolean; onSelect: () => void; onApprove: () => void; onVoid: () => void; approving: boolean }) {
  const approved = run.status === 'approved'; const voided = run.status === 'void'
  return (
    <Paper elevation={0} sx={{ border: 1, borderColor: selected ? 'primary.main' : 'divider', borderRadius: 2, overflow: 'hidden' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} sx={{ p: 2 }}>
        <Box sx={{ width: 38, height: 38, flexShrink: 0, borderRadius: 1.5, bgcolor: approved ? 'success.50' : voided ? 'error.50' : 'grey.100', color: approved ? 'success.main' : voided ? 'error.main' : 'text.secondary', display: 'grid', placeItems: 'center' }}>
          {approved ? <CheckCircleIcon /> : <ReceiptLongIcon />}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={onSelect}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography fontWeight={800}>{run.invoice_number || 'Draft billing run'}</Typography>
            <StatusChip status={run.status} />
          </Stack>
          <Typography variant="body2" color="text.secondary">{dateLabel(run.period_from)} – {dateLabel(run.period_to)} · {run.row_count || 0} lines · created {dateLabel(run.created_at)}</Typography>
        </Box>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ flexShrink: 0 }}>
          <Box sx={{ textAlign: { xs: 'left', md: 'right' } }}><Typography variant="caption" color="text.secondary">Gross</Typography><Typography fontWeight={800}>{money(run.gross_amount_pence ?? run.total_amount_pence)}</Typography></Box>
          {run.status === 'draft' && <AppButton size="small" loading={approving} startIcon={<CheckCircleIcon />} onClick={e => { e.stopPropagation(); onApprove() }}>Approve</AppButton>}
          {approved && <>
            <AppButton size="small" variant="secondary" startIcon={<DownloadIcon />} onClick={e => { e.stopPropagation(); window.open(`/api/homecare/client-billing/runs/${run.id}/invoice.pdf`, '_blank') }}>Invoice</AppButton>
            <AppButton size="small" variant="danger" onClick={e => { e.stopPropagation(); onVoid() }}>Void</AppButton>
          </>}
          <AppButton variant="quiet" size="small" onClick={onSelect} aria-label="Show run details">{selected ? <ExpandLessIcon /> : <ExpandMoreIcon />}</AppButton>
        </Stack>
      </Stack>
      <Collapse in={selected} unmountOnExit><Box sx={{ px: 2, pb: 2 }}><RunDetail run={run} /></Box></Collapse>
    </Paper>
  )
}

function RunDetail({ run }: { run: any }) {
  const lines = useQuery({ queryKey: ['homecare-client-billing-lines', run.id], queryFn: () => api.get(`/homecare/client-billing/runs/${run.id}/lines`).then(r => Array.isArray(r.data) ? r.data : []) })
  const breakdown = run.funding_breakdown && typeof run.funding_breakdown === 'object' ? run.funding_breakdown : {}
  return (
    <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1.5 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} mb={2}>
        <Box><Typography variant="caption" color="text.secondary">Net</Typography><Typography fontWeight={800}>{money(run.subtotal_pence)}</Typography></Box>
        <Box><Typography variant="caption" color="text.secondary">VAT</Typography><Typography fontWeight={800}>{money(run.vat_amount_pence)}</Typography></Box>
        <Box><Typography variant="caption" color="text.secondary">Gross</Typography><Typography fontWeight={800} color="primary.main">{money(run.gross_amount_pence ?? run.total_amount_pence)}</Typography></Box>
        <Box><Typography variant="caption" color="text.secondary">Snapshot</Typography><Typography variant="body2">Immutable after approval</Typography></Box>
      </Stack>
      <Typography variant="caption" fontWeight={800} color="text.secondary" textTransform="uppercase">Funding mix</Typography>
      <Stack direction="row" gap={1} flexWrap="wrap" mt={0.75}>{Object.entries(breakdown).map(([key, value]: any) => <Chip key={key} size="small" label={`${key.replace(/_/g, ' ')} · ${value.billable_count || 0} ready · ${money(value.gross_pence)}`} />)}</Stack>
      {lines.isLoading ? <Typography variant="caption" color="text.secondary" mt={2} display="block">Loading snapshot lines…</Typography> : <Typography variant="caption" color="text.secondary" mt={2} display="block">{lines.data?.length || 0} snapshot lines retained for audit. Download the invoice after approval.</Typography>}
    </Box>
  )
}

export default function ClientBillingPage() {
  const user = useMemo(() => { try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} } }, [])
  const isManager = user.role === 'ORG_ADMIN' || user.role === 'MANAGER'
  const queryClient = useQueryClient()
  const initial = monthRange()
  const [from, setFrom] = useState(initial.from); const [to, setTo] = useState(initial.to)
  const [tab, setTab] = useState(0); const [queue, setQueue] = useState<'all' | 'review' | 'ready' | 'excluded'>('all')
  const [search, setSearch] = useState(''); const [funding, setFunding] = useState('all'); const [page, setPage] = useState(0); const [rowsPerPage, setRowsPerPage] = useState(25)
  const [selectedRun, setSelectedRun] = useState<string | null>(null); const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [voidId, setVoidId] = useState<string | null>(null); const [voidReason, setVoidReason] = useState('')

  const utilisation = useQuery({ queryKey: ['homecare-client-utilisation', from, to], queryFn: () => api.get('/homecare/client-billing/utilisation', { params: { from, to } }).then(r => Array.isArray(r.data) ? r.data : []), enabled: isManager && Boolean(from && to) })
  const runs = useQuery({ queryKey: ['homecare-client-billing-runs'], queryFn: () => api.get('/homecare/client-billing/runs').then(r => Array.isArray(r.data) ? r.data : []), enabled: isManager })
  const createRun = useMutation({ mutationFn: () => api.post('/homecare/client-billing/runs', { from, to }), onSuccess: (r) => { setSelectedRun(r.data.run.id); setTab(1); setNotice({ type: 'success', text: `Draft created with ${r.data.lines.length} visit lines. Review exceptions before approval.` }); queryClient.invalidateQueries({ queryKey: ['homecare-client-billing-runs'] }) }, onError: (e: any) => setNotice({ type: 'error', text: e.response?.data?.message || 'Could not create the billing run.' }) })
  const approveRun = useMutation({ mutationFn: (id: string) => api.post(`/homecare/client-billing/runs/${id}/approve`), onSuccess: (r) => { setNotice({ type: 'success', text: `Run approved${r.data?.invoice_number ? ` as ${r.data.invoice_number}` : ''}.` }); queryClient.invalidateQueries({ queryKey: ['homecare-client-billing-runs'] }) }, onError: (e: any) => setNotice({ type: 'error', text: e.response?.data?.message || 'Could not approve the run.' }) })
  const voidRun = useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => api.post(`/homecare/client-billing/runs/${id}/void`, { void_reason: reason }), onSuccess: () => { setVoidId(null); setVoidReason(''); setNotice({ type: 'success', text: 'Run voided. The original evidence has been retained.' }); queryClient.invalidateQueries({ queryKey: ['homecare-client-billing-runs'] }) }, onError: (e: any) => setNotice({ type: 'error', text: e.response?.data?.message || 'Could not void the run.' }) })

  const rows = utilisation.data || []
  const ready = rows.filter((r: any) => r.billing_status === 'billable'); const review = rows.filter((r: any) => r.billing_status === 'review'); const excluded = rows.filter((r: any) => r.billing_status === 'not_billable')
  const totals = ready.reduce((a: any, r: any) => ({ net: a.net + Number(r.net_amount_pence || 0), vat: a.vat + Number(r.vat_amount_pence || 0), gross: a.gross + Number(r.gross_amount_pence || 0) }), { net: 0, vat: 0, gross: 0 })
  const fundingTypes = Array.from(new Set(rows.map((r: any) => r.funding_type).filter(Boolean))) as string[]
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r: any) => {
      const matchesQueue = queue === 'all' || (queue === 'ready' && r.billing_status === 'billable') || (queue === 'review' && r.billing_status === 'review') || (queue === 'excluded' && r.billing_status === 'not_billable')
      const matchesSearch = !q || `${r.person_name} ${r.package_name} ${r.visit_status}`.toLowerCase().includes(q)
      return matchesQueue && matchesSearch && (funding === 'all' || r.funding_type === funding)
    })
  }, [rows, queue, search, funding])
  const paged = filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage)

  if (!isManager) return <PageContainer><Alert severity="info">Client billing is available to managers and organisation administrators.</Alert></PageContainer>

  const exportCsv = () => {
    const headers = ['client', 'package', 'date', 'visit_status', 'funding', 'scheduled_minutes', 'delivered_minutes', 'net_pence', 'vat_pence', 'gross_pence', 'billing_status']
    const csv = [headers.join(','), ...filtered.map((r: any) => [r.person_name, r.package_name, r.scheduled_start, r.visit_status, r.funding_type, r.scheduled_minutes, r.delivered_minutes, r.net_amount_pence, r.vat_amount_pence, r.gross_amount_pence, r.billing_status].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))].join('\n') + '\n'
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `client-billing-${from}-${to}.csv`; a.click()
  }

  return (
    <PageContainer>
      <Box className="homecare-page">
        <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ lg: 'flex-end' }} spacing={2} mb={3}>
          <Box><Typography className="homecare-title" variant="h4">Client billing</Typography><Typography className="homecare-intro">Turn completed visits into a reviewable, auditable billing run — without billing incomplete or cancelled care by accident.</Typography></Box>
          <AppButton loading={createRun.isPending} startIcon={<ReceiptLongIcon />} onClick={() => createRun.mutate()} disabled={!from || !to || from > to}>Create draft run <ArrowForwardIcon sx={{ ml: 0.5, fontSize: 17 }} /></AppButton>
        </Stack>
        {notice && <Alert severity={notice.type} onClose={() => setNotice(null)} sx={{ mb: 2 }}>{notice.text}</Alert>}

        <Paper elevation={0} sx={{ p: 2, mb: 2.5, border: 1, borderColor: 'divider', borderRadius: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
            <Typography variant="body2" fontWeight={800} sx={{ mr: 1 }}>Billing period</Typography>
            <TextField type="date" size="small" label="From" value={from} onChange={e => { setFrom(e.target.value); setPage(0) }} InputLabelProps={{ shrink: true }} />
            <TextField type="date" size="small" label="To" value={to} onChange={e => { setTo(e.target.value); setPage(0) }} InputLabelProps={{ shrink: true }} />
            <Stack direction="row" flexWrap="wrap" gap={0.5}><AppButton variant="quiet" size="small" onClick={() => { const r = monthRange(); setFrom(r.from); setTo(r.to) }}>This month</AppButton><AppButton variant="quiet" size="small" onClick={() => { const r = monthRange(1); setFrom(r.from); setTo(r.to) }}>Last month</AppButton><AppButton variant="quiet" size="small" onClick={() => { const r = quarterRange(); setFrom(r.from); setTo(r.to) }}>This quarter</AppButton></Stack>
            <Box sx={{ flex: 1 }} /><AppButton variant="secondary" size="small" startIcon={<DownloadIcon />} onClick={exportCsv} disabled={!filtered.length}>Export CSV</AppButton>
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ p: 2.25, mb: 2.5, border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'action.hover' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}><Box sx={{ flex: 1 }}><Typography fontWeight={800}>A controlled billing cycle</Typography><Typography variant="body2" color="text.secondary">Review the work queue first, create a snapshot, then approve only when exceptions are understood. Approval makes the run immutable.</Typography></Box><Stack direction="row" spacing={1} alignItems="center"><Chip label="1 · Review" color={tab === 0 ? 'primary' : 'default'} /><ArrowForwardIcon fontSize="small" color="disabled" /><Chip label="2 · Draft" color={tab === 1 && !selectedRun ? 'primary' : 'default'} /><ArrowForwardIcon fontSize="small" color="disabled" /><Chip label="3 · Approve" color="success" variant="outlined" /></Stack></Stack>
        </Paper>

        <Tabs value={tab} onChange={(_, value) => setTab(value)} className="homecare-tabs" sx={{ mb: 2 }}><Tab icon={<FactCheckIcon fontSize="small" />} iconPosition="start" label={`Review work (${rows.length})`} /><Tab icon={<ReceiptLongIcon fontSize="small" />} iconPosition="start" label={`Billing runs (${runs.data?.length || 0})`} /></Tabs>

        {tab === 0 && <>
          <Stack direction="row" gap={1.5} flexWrap="wrap" mb={2.5}><SummaryCard label="Visits in period" value={String(rows.length)} detail="All statuses" icon={<GroupsIcon fontSize="small" />} /><SummaryCard label="Ready to bill" value={String(ready.length)} detail={money(totals.gross)} tone="success" icon={<CheckCircleIcon fontSize="small" />} /><SummaryCard label="Needs review" value={String(review.length)} detail="Resolve before approval" tone="warning" icon={<WarningAmberIcon fontSize="small" />} /><SummaryCard label="Excluded" value={String(excluded.length)} detail="Cancelled or missed" tone="neutral" icon={<ReceiptLongIcon fontSize="small" />} /></Stack>
          <Paper elevation={0} sx={{ p: 1.5, mb: 1.5, border: 1, borderColor: 'divider', borderRadius: 2 }}><Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}><TextField size="small" placeholder="Search client, package or status" value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} InputProps={{ startAdornment: <SearchIcon sx={{ mr: 0.75, color: 'text.secondary', fontSize: 19 }} /> }} sx={{ flex: 1 }} /><Select size="small" value={funding} onChange={e => { setFunding(e.target.value); setPage(0) }} displayEmpty sx={{ minWidth: 150 }}><MenuItem value="all">All funding</MenuItem>{fundingTypes.map(type => <MenuItem key={type} value={type}>{type.replace(/_/g, ' ')}</MenuItem>)}</Select><Stack direction="row" gap={0.5} flexWrap="wrap"><AppButton size="small" variant={queue === 'all' ? 'primary' : 'secondary'} onClick={() => { setQueue('all'); setPage(0) }}>All</AppButton><AppButton size="small" variant={queue === 'review' ? 'primary' : 'secondary'} onClick={() => { setQueue('review'); setPage(0) }} startIcon={<WarningAmberIcon />}>Review {review.length}</AppButton><AppButton size="small" variant={queue === 'ready' ? 'primary' : 'secondary'} onClick={() => { setQueue('ready'); setPage(0) }}>Ready</AppButton><AppButton size="small" variant={queue === 'excluded' ? 'primary' : 'secondary'} onClick={() => { setQueue('excluded'); setPage(0) }}>Excluded</AppButton></Stack></Stack></Paper>
          <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>{utilisation.isLoading ? <Box className="homecare-loading"><Typography>Loading billing work queue…</Typography></Box> : !paged.length ? <EmptyState title="No billing lines match" description={rows.length ? 'Try another filter or date range.' : 'Completed visits will appear here when they fall inside the selected period.'} variant="default" /> : <><TableContainer sx={{ overflowX: 'auto' }}><Table size="small"><TableHead><TableRow sx={{ bgcolor: 'action.hover' }}><TableCell>Date</TableCell><TableCell>Client / package</TableCell><TableCell>Funding</TableCell><TableCell>Decision</TableCell><TableCell align="right">Delivered</TableCell><TableCell align="right">Gross</TableCell><TableCell align="right"> </TableCell></TableRow></TableHead><TableBody>{paged.map((row: any) => <ReviewRow key={row.visit_id} row={row} />)}</TableBody></Table></TableContainer><TablePagination component="div" count={filtered.length} page={page} rowsPerPage={rowsPerPage} rowsPerPageOptions={[10, 25, 50, 100]} onPageChange={(_, value) => setPage(value)} onRowsPerPageChange={e => { setRowsPerPage(Number(e.target.value)); setPage(0) }} /></>}</Paper>
        </>}

        {tab === 1 && <Stack spacing={1.5}>{!runs.data?.length ? <EmptyState title="No billing runs yet" description="Create a draft from the review work queue once the period is ready." variant="default" /> : runs.data.map((run: any) => <RunCard key={run.id} run={run} selected={selectedRun === run.id} onSelect={() => setSelectedRun(selectedRun === run.id ? null : run.id)} onApprove={() => approveRun.mutate(run.id)} approving={approveRun.isPending} onVoid={() => setVoidId(run.id)} />)}</Stack>}

        <Dialog open={Boolean(voidId)} onClose={() => setVoidId(null)} maxWidth="sm" fullWidth><DialogTitle>Void approved billing run</DialogTitle><DialogContent><Typography variant="body2" color="text.secondary" mb={2}>Voiding keeps the original run and audit evidence. Use this when an approved run needs to be reversed and reissued.</Typography><TextField fullWidth multiline minRows={3} label="Reason" value={voidReason} onChange={e => setVoidReason(e.target.value)} placeholder="Explain what needs correcting" /></DialogContent><DialogActions><AppButton variant="quiet" onClick={() => setVoidId(null)}>Cancel</AppButton><AppButton variant="danger" loading={voidRun.isPending} disabled={!voidReason.trim()} onClick={() => voidId && voidRun.mutate({ id: voidId, reason: voidReason })}>Confirm void</AppButton></DialogActions></Dialog>
      </Box>
    </PageContainer>
  )
}
