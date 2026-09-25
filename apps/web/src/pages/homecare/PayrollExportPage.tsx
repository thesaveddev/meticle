import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tab, Tabs, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { CheckCircleOutline as ApprovedIcon, Download as DownloadIcon, ReceiptLong as PayrollIcon, Rule as ReviewIcon, FactCheck as ReconcileIcon, VisibilityOutlined as AuditIcon, Person as PersonIcon, ArrowBack as BackIcon } from '@mui/icons-material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import PageContainer from '../../components/design/PageContainer'
import AppButton from '../../components/design/AppButton'
import MyEarningsPanel from './MyEarningsPanel'
import CarerTotalsPanel from './CarerTotalsPanel'
import api from '../../services/api'

const money = (pence: number | null | undefined) => pence == null ? '—' : `£${(Number(pence) / 100).toFixed(2)}`
const dateOnly = (value: unknown) => {
  const date = new Date(String(value || ''))
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
const when = (value: unknown) => value ? new Date(String(value)).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
const fmtDuration = (minutes: unknown) => { const m = Number(minutes || 0); return `${Math.floor(m / 60)}h ${m % 60}m` }
const rateLabel = (row: any, labelKey: string, sourceKey: string) => String(row[labelKey] || (row[sourceKey] === 'unknown' ? 'Historical source not captured' : 'Source not recorded'))
const rate = (pence: number | null | undefined, unit: 'hour' | 'mile') => pence == null ? 'Not recorded' : `${money(pence)} / ${unit}`
// Pay is added automatically at clock-out; a timesheet status is a record state, not an approval queue.
const statusChip = (status: unknown): { label: string; color: 'success' | 'default' | 'error' } => {
  const s = String(status || 'draft')
  if (s === 'approved') return { label: 'Pay added', color: 'success' }
  if (s === 'submitted') return { label: 'Not yet paid', color: 'default' }
  if (s === 'rejected') return { label: 'Rejected', color: 'error' }
  return { label: s.replace(/_/g, ' '), color: 'default' }
}

const PAYROLL_PROVIDERS = [
  { value: 'sage', label: 'Sage Payroll' },
  { value: 'xero', label: 'Xero Payroll' },
  { value: 'quickbooks', label: 'QuickBooks Payroll' },
  { value: 'brightpay', label: 'BrightPay' },
  { value: 'staffology', label: 'Staffology' },
  { value: 'generic_csv', label: 'Generic CSV' },
]

export default function PayrollExportPage() {
  // Local-date defaults: toISOString() slices shift the day for any timezone
  // off UTC, so the window opened on the previous month's last day.
  const [from, setFrom] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` })
  const [to, setTo] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })
  const [provider, setProvider] = useState('generic_csv')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchParams] = useSearchParams()
  const [timesheetView, setTimesheetView] = useState<'review' | 'carer-totals' | 'audit'>(() => (searchParams.get('view') === 'carer-totals' ? 'carer-totals' : 'review'))
  const [payView, setPayView] = useState<'calls' | 'carer'>('calls')
  const [selectedCarer, setSelectedCarer] = useState<string | null>(null)
  const [detailRow, setDetailRow] = useState<any>(null)
  const [page, setPage] = useState(0)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [selectedExportId, setSelectedExportId] = useState('')
  const [reconcileTarget, setReconcileTarget] = useState<any>(null)
  const [reconciledAmount, setReconciledAmount] = useState('')
  const [reconciliationNote, setReconciliationNote] = useState('')
  const qc = useQueryClient()
  const user = useMemo(() => { try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} } }, [])
  const isManager = user.role === 'ORG_ADMIN' || user.role === 'MANAGER'

  const { data: payrollExports = [], refetch: refetchExports } = useQuery({
    queryKey: ['homecare-payroll-exports'],
    queryFn: () => api.get('/homecare/payroll/exports').then(r => Array.isArray(r.data) ? r.data : []),
    enabled: isManager,
  })
  useEffect(() => {
    if (!selectedExportId && payrollExports.length) setSelectedExportId(payrollExports[0].id)
  }, [payrollExports, selectedExportId])
  const { data: reconciliationRows = [], isLoading: reconciliationLoading, refetch: refetchReconciliation } = useQuery({
    queryKey: ['homecare-payroll-reconciliations', selectedExportId],
    queryFn: () => api.get('/homecare/payroll/reconciliations', { params: { exportId: selectedExportId } }).then(r => Array.isArray(r.data) ? r.data : []),
    enabled: isManager && Boolean(selectedExportId),
  })

  const { data: rawTimesheets = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['homecare-payroll-timesheets', from, to],
    queryFn: () => api.get('/homecare/timesheets').then(r => Array.isArray(r.data) ? r.data : []),
    enabled: isManager,
  })

  const timesheets = useMemo(() => rawTimesheets.filter((row: any) => {
    const timestamp = new Date(row.scheduled_start).getTime()
    const inRange = timestamp >= new Date(`${from}T00:00:00`).getTime() && timestamp < new Date(`${to}T23:59:59`).getTime()
    return inRange && (statusFilter === 'all' || row.status === statusFilter)
  }), [rawTimesheets, from, to, statusFilter])

  const approved = rawTimesheets.filter((row: any) => row.status === 'approved' && (() => {
    const timestamp = new Date(row.scheduled_start).getTime()
    return timestamp >= new Date(`${from}T00:00:00`).getTime() && timestamp < new Date(`${to}T23:59:59`).getTime()
  })())
  const approvedAuditRows = approved
  const carerRows = useMemo(() => {
    const map = new Map<string, any>()
    for (const row of timesheets) {
      const key = row.staff_id || 'unassigned'
      const entry = map.get(key) || { staff_id: row.staff_id, name: row.staff_name || 'Unassigned', calls: 0, hours: 0, travel: 0, mileage: 0, pay: 0 }
      entry.calls += 1
      entry.hours += Number(row.work_minutes || 0) + Number(row.paid_travel_minutes || 0)
      entry.travel += Number(row.paid_travel_minutes || 0)
      entry.mileage += Number(row.mileage_miles || 0)
      entry.pay += Number(row.gross_pay_pence || 0)
      map.set(key, entry)
    }
    return [...map.values()].sort((a, b) => b.pay - a.pay)
  }, [timesheets])
  const viewRows = payView === 'carer' && selectedCarer ? timesheets.filter((row: any) => (row.staff_id || 'unassigned') === selectedCarer) : timesheets
  const PAGE_SIZE = 15
  const viewPages = Math.max(1, Math.ceil(viewRows.length / PAGE_SIZE))
  const pageSafe = Math.min(page, viewPages - 1)
  const pagedRows = viewRows.slice(pageSafe * PAGE_SIZE, (pageSafe + 1) * PAGE_SIZE)
  const totalMinutes = approved.reduce((sum: number, t: any) => sum + Number(t.work_minutes || 0) + Number(t.paid_travel_minutes || 0), 0)
  const totalPay = approved.reduce((sum: number, t: any) => sum + Number(t.gross_pay_pence || 0), 0)
  const totalMileage = approved.reduce((sum: number, t: any) => sum + Number(t.mileage_miles || 0), 0)

  const exportPayroll = async () => {
    setError(''); setMessage('')
    try {
      const response = await api.get('/homecare/payroll/export.csv', { params: { from, to, provider }, responseType: 'blob' })
      const exportId = response.headers['x-payroll-export-id']
      const url = URL.createObjectURL(response.data)
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `homecare-payroll-${from}-${to}.csv`
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url)
      if (exportId) setSelectedExportId(exportId)
      await qc.invalidateQueries({ queryKey: ['homecare-payroll-exports'] })
      setMessage('Payroll export created and downloaded. Confirm it was imported by the payroll provider, then reconcile the returned amounts below.')
    } catch (e: any) { setError(e.response?.data?.message || 'Could not export payroll inputs.') }
  }

  const acknowledgeExport = useMutation({
    mutationFn: (exportId: string) => api.post(`/homecare/payroll/exports/${exportId}/acknowledge`),
    onSuccess: async result => {
      setMessage(`${result.data.acknowledged_count} export rows marked as acknowledged by payroll.`)
      await Promise.all([refetchExports(), refetchReconciliation()])
    },
    onError: (e: any) => setError(e.response?.data?.message || 'Could not acknowledge this export.'),
  })
  const updateReconciliation = useMutation({
    mutationFn: (payload: { id: string; action: 'acknowledge' | 'reconcile' | 'exception' | 'ignore'; external_reference?: string; reconciled_gross_pay_pence?: number; note?: string }) => {
      const { id, ...body } = payload
      return api.patch(`/homecare/payroll/reconciliations/${id}`, body)
    },
    onSuccess: async () => {
      setReconcileTarget(null); setReconciliationNote(''); setReconciledAmount('')
      await Promise.all([refetchExports(), refetchReconciliation()])
      setMessage('Payroll row updated.')
    },
    onError: (e: any) => setError(e.response?.data?.message || 'Could not update this payroll row.'),
  })

  // Role-based access: carers see only their own pay on this page; managers
  // and admins get the organisation-wide payroll workspace above.
  if (!isManager) return (
    <PageContainer>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="overline" color="primary" sx={{ fontWeight: 800, letterSpacing: 1.2 }}>Payroll workspace</Typography>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>My pay & timesheets</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Pay is added automatically when you clock in and out of a call — no approval needed. Download a payslip for any completed period.</Typography>
        </Box>
      </Stack>
      <MyEarningsPanel />
    </PageContainer>
  )

  return (
    <PageContainer>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="overline" color="primary" sx={{ fontWeight: 800, letterSpacing: 1.2 }}>Payroll workspace</Typography>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Timesheets & payroll</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Pay is added automatically when a carer clocks in and out of a call — no approval needed. Export provider-ready payroll inputs and reconcile what payroll actually pays.</Typography>
        </Box>
        <AppButton variant="primary" startIcon={<DownloadIcon />} onClick={exportPayroll} disabled={!from || !to || from > to || approved.length === 0}>
          Export payroll inputs
        </AppButton>
      </Stack>

      {(message || error || isError) && <Alert severity={error || isError ? 'error' : 'success'} onClose={() => { setMessage(''); setError('') }} sx={{ mb: 2 }}>{error || (isError ? 'Could not load payroll inputs.' : message)}</Alert>}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField type="date" label="From" size="small" value={from} onChange={e => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField type="date" label="To" size="small" value={to} onChange={e => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField select label="Review status" size="small" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="all">All statuses</MenuItem><MenuItem value="submitted">Not yet paid</MenuItem><MenuItem value="approved">Pay added</MenuItem><MenuItem value="rejected">Rejected</MenuItem>
        </TextField>
        <TextField select label="Provider" size="small" value={provider} onChange={e => setProvider(e.target.value)} sx={{ minWidth: 180 }}>
          {PAYROLL_PROVIDERS.map(item => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
        </TextField>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
        <SummaryCard icon={<ApprovedIcon />} label="Paid calls" value={approved.length} />
        <SummaryCard icon={<ReviewIcon />} label="Paid hours" value={`${(totalMinutes / 60).toFixed(1)}h`} />
        <SummaryCard icon={<PayrollIcon />} label="Pay added" value={money(totalPay)} />
        <SummaryCard icon={<PayrollIcon />} label="Paid mileage" value={`${totalMileage.toFixed(1)} mi`} />
      </Stack>

      <Tabs value={timesheetView} onChange={(_, value) => setTimesheetView(value)} sx={{ mb: 2 }} aria-label="Timesheet views">
        <Tab value="review" label="Calls & pay" />
        <Tab value="carer-totals" label="Carer totals" />
        <Tab value="audit" label="Rate audit" />
      </Tabs>

      {timesheetView === 'carer-totals' ? <CarerTotalsPanel /> : isLoading ? <Box sx={{ py: 8, textAlign: 'center' }}><Typography color="text.secondary">Loading payroll inputs…</Typography></Box> : timesheetView === 'review' ? (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
            <ToggleButtonGroup size="small" exclusive value={payView} onChange={(_, v: 'calls' | 'carer' | null) => { if (v) { setPayView(v); setSelectedCarer(null); setPage(0) } }} aria-label="Payroll view mode">
              <ToggleButton value="calls" sx={{ textTransform: 'none', fontWeight: 600 }}>By calls</ToggleButton>
              <ToggleButton value="carer" sx={{ textTransform: 'none', fontWeight: 600 }}>By carer</ToggleButton>
            </ToggleButtonGroup>
            {payView === 'carer' && selectedCarer && <AppButton variant="quiet" size="small" startIcon={<BackIcon />} onClick={() => { setSelectedCarer(null); setPage(0) }}>All carers</AppButton>}
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
              {payView === 'carer' && !selectedCarer ? 'Select a carer to see their calls and pay.' : 'Click any row to see the call that generated the pay entry.'}
            </Typography>
          </Stack>
          <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <Table size="small">
              <TableHead><TableRow>
                {(payView === 'carer' && !selectedCarer
                  ? ['Carer', 'Calls', 'Hours', 'Travel', 'Mileage', 'Pay']
                  : [...(payView === 'carer' ? [] : ['Carer']), 'Client', 'Date', 'Hours', 'Travel', 'Pay', 'Status']
                ).map(label => <TableCell key={label} sx={{ fontWeight: 700 }}>{label}</TableCell>)}
              </TableRow></TableHead>
              <TableBody>
                {payView === 'carer' && !selectedCarer ? (
                  carerRows.length === 0 ? <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6 }}><Typography color="text.secondary">No paid calls match this view.</Typography></TableCell></TableRow> : carerRows.map((row: any) => (
                    <TableRow key={row.staff_id || 'unassigned'} hover sx={{ cursor: 'pointer' }} onClick={() => { setSelectedCarer(row.staff_id || 'unassigned'); setPage(0) }}>
                      <TableCell><Stack direction="row" alignItems="center" spacing={1}><PersonIcon fontSize="small" sx={{ color: 'text.secondary' }} /><Typography sx={{ fontWeight: 600 }}>{row.name}</Typography></Stack></TableCell>
                      <TableCell>{row.calls}</TableCell><TableCell>{(row.hours / 60).toFixed(1)}</TableCell><TableCell>{row.travel}m</TableCell><TableCell>{Number(row.mileage).toFixed(1)} mi</TableCell><TableCell>{money(row.pay)}</TableCell>
                    </TableRow>
                  ))
                ) : pagedRows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6 }}><Typography color="text.secondary">No timesheet inputs match this view.</Typography>{isError && <AppButton variant="secondary" size="small" onClick={() => refetch()} sx={{ mt: 1 }}>Try again</AppButton>}</TableCell></TableRow>
                ) : pagedRows.map((row: any) => {
                  const chip = statusChip(row.status)
                  return <TableRow key={row.id} hover sx={{ cursor: 'pointer' }} onClick={() => setDetailRow(row)}>
                    {payView !== 'carer' && <TableCell>{String(row.staff_name || 'Unassigned')}</TableCell>}
                    <TableCell>{String(row.person_name || '—')}</TableCell><TableCell>{dateOnly(row.scheduled_start)}</TableCell>
                    <TableCell>{((Number(row.work_minutes || 0) + Number(row.paid_travel_minutes || 0)) / 60).toFixed(1)}</TableCell><TableCell>{Number(row.paid_travel_minutes || 0)}m</TableCell><TableCell>{money(row.gross_pay_pence)}</TableCell>
                    <TableCell><Chip size="small" label={chip.label} color={chip.color} /></TableCell>
                  </TableRow>
                })}
              </TableBody>
            </Table>
          </TableContainer>
          {viewRows.length > PAGE_SIZE && <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">Showing {pageSafe * PAGE_SIZE + 1}–{Math.min((pageSafe + 1) * PAGE_SIZE, viewRows.length)} of {viewRows.length}</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <AppButton variant="quiet" size="small" disabled={pageSafe === 0} onClick={() => setPage(pageSafe - 1)}>Previous</AppButton>
              <Typography variant="body2">Page {pageSafe + 1} of {viewPages}</Typography>
              <AppButton variant="quiet" size="small" disabled={pageSafe >= viewPages - 1} onClick={() => setPage(pageSafe + 1)}>Next</AppButton>
            </Stack>
          </Stack>}
        </>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflowX: 'auto' }}>
          <Table size="small" aria-label="Timesheet rate audit">
            <TableHead><TableRow>{['Carer / client', 'Date', 'Hourly rate source', 'Mileage source', 'Travel policy', 'Gross pay', 'Audit'].map(label => <TableCell key={label} sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {!approvedAuditRows.length ? <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6 }}><Typography color="text.secondary">No paid calls in this date range.</Typography></TableCell></TableRow> : approvedAuditRows.map((row: any) => (
                <TableRow key={row.id} hover>
                  <TableCell><Typography variant="body2" fontWeight={700}>{String(row.staff_name || 'Unassigned')}</Typography><Typography variant="caption" color="text.secondary">{String(row.person_name || '—')}</Typography></TableCell>
                  <TableCell>{dateOnly(row.scheduled_start)}</TableCell>
                  <TableCell><Typography variant="body2">{rateLabel(row, 'hourly_rate_source_label', 'hourly_rate_source')}</Typography><Typography variant="caption" color="text.secondary">{rate(row.hourly_rate_pence, 'hour')}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{rateLabel(row, 'mileage_rate_source_label', 'mileage_rate_source')}</Typography><Typography variant="caption" color="text.secondary">{rate(row.mileage_rate_pence, 'mile')}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{rateLabel(row, 'paid_travel_policy_label', 'paid_travel_policy_source')}</Typography><Typography variant="caption" color="text.secondary">{Number(row.paid_travel_minutes || 0)} paid minutes</Typography></TableCell>
                  <TableCell>{money(row.gross_pay_pence)}</TableCell>
                  <TableCell><AppButton size="small" variant="secondary" startIcon={<AuditIcon />} onClick={() => setDetailRow(row)}>View breakdown</AppButton></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Which call generated this pay entry */}
      <PayEntryDialog row={detailRow} onClose={() => setDetailRow(null)} />

      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={1.5} sx={{ mt: 5, mb: 1.5 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Export & reconciliation</Typography>
          <Typography variant="body2" color="text.secondary">Track what was exported, confirm payroll import, then match each provider amount to the approved timesheet.</Typography>
        </Box>
        <TextField select size="small" label="Payroll export" value={selectedExportId} onChange={e => setSelectedExportId(e.target.value)} sx={{ minWidth: { xs: '100%', md: 340 } }}>
          {payrollExports.map((item: any) => <MenuItem key={item.id} value={item.id}>{PAYROLL_PROVIDERS.find(p => p.value === item.provider)?.label || item.provider} · {dateOnly(item.period_from)}–{dateOnly(item.period_to)} · {String(item.status).replace(/_/g, ' ')}</MenuItem>)}
        </TextField>
      </Stack>

      {!payrollExports.length ? <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}><Typography fontWeight={700}>No payroll exports yet</Typography><Typography variant="body2" color="text.secondary">Once calls are clocked out and paid, create an export above. Each exported timesheet will appear here for acknowledgement and reconciliation.</Typography></Paper> : <>
        {(() => {
          const selected = payrollExports.find((item: any) => item.id === selectedExportId)
          if (!selected) return null
          return <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ mb: 1.5 }}>
            <Chip label={`${selected.exported_count || 0} exported`} />
            <Chip color="info" label={`${selected.acknowledged_count || 0} acknowledged`} />
            <Chip color="success" label={`${selected.reconciled_count || 0} reconciled`} />
            <Chip color={selected.exception_count ? 'error' : 'default'} label={`${selected.exception_count || 0} exceptions`} />
            {selected.status !== 'reconciled' && Number(selected.exported_count) > 0 && <AppButton size="small" variant="secondary" onClick={() => acknowledgeExport.mutate(selected.id)} loading={acknowledgeExport.isPending}>
              Acknowledge all exported rows
            </AppButton>}
          </Stack>
        })()}
        {reconciliationLoading ? <Box sx={{ py: 5, textAlign: 'center' }}><Typography color="text.secondary">Loading reconciliation rows…</Typography></Box> : <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Table size="small">
            <TableHead><TableRow>{['Carer', 'Client / call', 'Date', 'Exported', 'Payroll amount', 'Variance', 'Stage', 'Action'].map(label => <TableCell key={label} sx={{ fontWeight: 700 }}>{label}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {!reconciliationRows.length ? <TableRow><TableCell colSpan={8} align="center" sx={{ py: 5 }}><Typography color="text.secondary">This export has no rows to reconcile.</Typography></TableCell></TableRow> : reconciliationRows.map((row: any) => {
                const isVariance = row.reconciled_gross_pay_pence != null && Number(row.reconciled_gross_pay_pence) !== Number(row.exported_gross_pay_pence)
                const stage = row.status === 'matched' ? 'Reconciled' : row.status === 'exported' ? 'Exported' : String(row.status).replace(/_/g, ' ')
                return <TableRow key={row.id} hover>
                  <TableCell>{String(row.staff_name || 'Unassigned')}</TableCell>
                  <TableCell><Typography variant="body2" fontWeight={600}>{String(row.client_name || 'Client')}</Typography><Typography variant="caption" color="text.secondary">{String(row.visit_label || '')}</Typography></TableCell>
                  <TableCell>{dateOnly(row.scheduled_start)}</TableCell>
                  <TableCell>{money(row.exported_gross_pay_pence)}</TableCell>
                  <TableCell>{row.reconciled_gross_pay_pence == null ? '—' : money(row.reconciled_gross_pay_pence)}</TableCell>
                  <TableCell sx={{ color: isVariance ? 'error.main' : 'text.secondary', fontWeight: isVariance ? 700 : 400 }}>{row.variance_pence == null ? '—' : money(row.variance_pence)}</TableCell>
                  <TableCell><Chip size="small" label={stage} color={row.status === 'matched' ? 'success' : row.status === 'exception' ? 'error' : row.status === 'acknowledged' ? 'info' : 'default'} /></TableCell>
                  <TableCell>
                    {row.status === 'exported' && <AppButton size="small" variant="secondary" onClick={() => updateReconciliation.mutate({ id: row.id, action: 'acknowledge' })} loading={updateReconciliation.isPending}>Acknowledge</AppButton>}
                    {['acknowledged', 'exception'].includes(row.status) && <AppButton size="small" variant="primary" startIcon={<ReconcileIcon />} onClick={() => { setReconcileTarget(row); setReconciledAmount(String(row.reconciled_gross_pay_pence ?? row.exported_gross_pay_pence ?? '')); setReconciliationNote(row.note || '') }}>Reconcile</AppButton>}
                    {row.status === 'ignored' && <Typography variant="caption" color="text.secondary">Ignored with reason</Typography>}
                  </TableCell>
                </TableRow>
              })}
            </TableBody>
          </Table>
        </TableContainer>}
      </>}

      <Dialog open={Boolean(reconcileTarget)} onClose={() => !updateReconciliation.isPending && setReconcileTarget(null)} fullWidth maxWidth="sm">
        <DialogTitle>Reconcile payroll row</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">Exported amount: <strong>{money(reconcileTarget?.exported_gross_pay_pence)}</strong>. Enter the amount confirmed in the payroll provider. Any difference will be saved as an exception for review.</Alert>
          <TextField label="Provider reference" value={reconcileTarget?.external_reference || ''} onChange={e => setReconcileTarget((row: any) => ({ ...row, external_reference: e.target.value }))} />
          <TextField label="Amount confirmed by payroll (pence)" type="number" inputProps={{ min: 0, step: 1 }} value={reconciledAmount} onChange={e => setReconciledAmount(e.target.value)} required />
          <TextField label="Reconciliation note" value={reconciliationNote} onChange={e => setReconciliationNote(e.target.value)} multiline minRows={2} helperText="Required if the payroll amount differs from the exported amount." />
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setReconcileTarget(null)} disabled={updateReconciliation.isPending}>Cancel</Button><AppButton variant="primary" onClick={() => reconcileTarget && updateReconciliation.mutate({ id: reconcileTarget.id, action: 'reconcile', external_reference: reconcileTarget.external_reference || undefined, reconciled_gross_pay_pence: Number(reconciledAmount), note: reconciliationNote || undefined })} loading={updateReconciliation.isPending} disabled={!reconciledAmount || Number(reconciledAmount) < 0 || (Number(reconciledAmount) !== Number(reconcileTarget?.exported_gross_pay_pence) && !reconciliationNote.trim())}>Save reconciliation</AppButton></DialogActions>
      </Dialog>
    </PageContainer>
  )
}

function PayEntryDialog({ row, onClose }: { row: any; onClose: () => void }) {
  const line = (label: string, value: React.ReactNode) => (
    <Stack direction="row" justifyContent="space-between" gap={2} sx={{ py: 0.6, borderBottom: '1px solid #F3F4F6' }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>{value}</Typography>
    </Stack>
  )
  return <Dialog open={Boolean(row)} onClose={onClose} fullWidth maxWidth="sm">
    <DialogTitle>Call &amp; pay entry</DialogTitle>
    <DialogContent>
      {row && <Stack spacing={0.5} sx={{ pt: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{row.label || row.visit_type || 'Care call'}</Typography>
        <Alert severity="info" sx={{ mb: 1 }}>Pay is added automatically when the carer clocks in and out of this call — no approval needed.</Alert>
        {line('Client', row.person_name || '—')}
        {line('Carer', row.staff_name || 'Unassigned')}
        {line('Scheduled', `${when(row.scheduled_start)} → ${when(row.scheduled_end)}`)}
        {line('Call status', String(row.visit_status || '—').replace(/_/g, ' '))}
        {line('Checked in', when(row.check_in_at))}
        {line('Checked out', when(row.check_out_at))}
        {line('Work time', fmtDuration(row.work_minutes))}
        {line('Paid travel', `${Number(row.paid_travel_minutes || 0)} of ${Number(row.travel_minutes || 0)} travel minutes · ${rateLabel(row, 'paid_travel_policy_label', 'paid_travel_policy_source')}`)}
        {line('Mileage', `${Number(row.mileage_miles || 0).toFixed(2)} mi · ${rate(row.mileage_rate_pence, 'mile')} · ${rateLabel(row, 'mileage_rate_source_label', 'mileage_rate_source')}`)}
        {line('Hourly rate', `${rate(row.hourly_rate_pence, 'hour')} · ${rateLabel(row, 'hourly_rate_source_label', 'hourly_rate_source')}`)}
        {line('Gross pay', money(row.gross_pay_pence))}
        {line('Pay state', statusChip(row.status).label)}
        {row.rejection_reason ? line('Rejection reason', row.rejection_reason) : null}
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>Rate sources are snapshots recorded when the pay was calculated{row.rate_calculated_at ? ` on ${when(row.rate_calculated_at)}` : ''}; later profile changes do not rewrite this entry.</Typography>
      </Stack>}
    </DialogContent>
    <DialogActions><AppButton variant="secondary" onClick={onClose}>Close</AppButton></DialogActions>
  </Dialog>
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return <Paper elevation={0} sx={{ p: 2, flex: 1, minWidth: 150, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}><Stack direction="row" spacing={1.25} alignItems="center"><Box color="primary.main">{icon}</Box><Box><Typography variant="h6" sx={{ fontWeight: 800 }}>{value}</Typography><Typography variant="caption" color="text.secondary">{label}</Typography></Box></Stack></Paper>
}
