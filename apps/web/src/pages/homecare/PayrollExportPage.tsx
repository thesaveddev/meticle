import { useMemo, useState } from 'react'
import { Alert, Box, Chip, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { CheckCircleOutline as ApprovedIcon, Download as DownloadIcon, ReceiptLong as PayrollIcon, Rule as ReviewIcon } from '@mui/icons-material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import PageContainer from '../../components/design/PageContainer'
import AppButton from '../../components/design/AppButton'
import api from '../../services/api'

const money = (pence: number | null | undefined) => pence == null ? '—' : `£${(Number(pence) / 100).toFixed(2)}`
const dateOnly = (value: unknown) => {
  const date = new Date(String(value || ''))
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
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
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [provider, setProvider] = useState('generic_csv')
  const [statusFilter, setStatusFilter] = useState('all')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const qc = useQueryClient()
  const user = useMemo(() => { try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} } }, [])
  const isManager = user.role === 'ORG_ADMIN' || user.role === 'MANAGER'

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
  const pendingCount = rawTimesheets.filter((row: any) => {
    const timestamp = new Date(row.scheduled_start).getTime()
    return row.status === 'submitted' && timestamp >= new Date(`${from}T00:00:00`).getTime() && timestamp < new Date(`${to}T23:59:59`).getTime()
  }).length
  const totalMinutes = approved.reduce((sum: number, t: any) => sum + Number(t.work_minutes || 0) + Number(t.paid_travel_minutes || 0), 0)
  const totalPay = approved.reduce((sum: number, t: any) => sum + Number(t.gross_pay_pence || 0), 0)
  const totalMileage = approved.reduce((sum: number, t: any) => sum + Number(t.mileage_miles || 0), 0)

  const approve = useMutation({
    mutationFn: (id: string) => api.patch(`/homecare/timesheets/${id}`, { status: 'approved' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['homecare-payroll-timesheets'] }); setMessage('Timesheet approved for payroll.'); setError('') },
    onError: (e: any) => setError(e.response?.data?.message || 'Could not approve this timesheet.'),
  })

  const exportPayroll = async () => {
    setError(''); setMessage('')
    try {
      const response = await api.get('/homecare/payroll/export.csv', { params: { from, to, provider }, responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `homecare-payroll-${from}-${to}.csv`
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url)
      setMessage('Approved payroll inputs downloaded.')
    } catch (e: any) { setError(e.response?.data?.message || 'Could not export payroll inputs.') }
  }

  if (!isManager) return <PageContainer><Alert severity="info">Only managers can review timesheets and export payroll inputs.</Alert></PageContainer>

  return (
    <PageContainer>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="overline" color="primary" sx={{ fontWeight: 800, letterSpacing: 1.2 }}>Payroll workspace</Typography>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Timesheets & payroll</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Review completed visit inputs, approve pay and prepare a provider-ready export.</Typography>
        </Box>
        <AppButton variant="primary" startIcon={<DownloadIcon />} onClick={exportPayroll} disabled={!from || !to || from > to || approved.length === 0}>
          Export approved inputs
        </AppButton>
      </Stack>

      {(message || error || isError) && <Alert severity={error || isError ? 'error' : 'success'} onClose={() => { setMessage(''); setError('') }} sx={{ mb: 2 }}>{error || (isError ? 'Could not load payroll inputs.' : message)}</Alert>}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField type="date" label="From" size="small" value={from} onChange={e => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField type="date" label="To" size="small" value={to} onChange={e => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField select label="Review status" size="small" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="all">All statuses</MenuItem><MenuItem value="submitted">Needs review</MenuItem><MenuItem value="approved">Approved</MenuItem><MenuItem value="rejected">Rejected</MenuItem>
        </TextField>
        <TextField select label="Provider" size="small" value={provider} onChange={e => setProvider(e.target.value)} sx={{ minWidth: 180 }}>
          {PAYROLL_PROVIDERS.map(item => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
        </TextField>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
        <SummaryCard icon={<ReviewIcon />} label="Needs review" value={pendingCount} />
        <SummaryCard icon={<ApprovedIcon />} label="Approved hours" value={`${(totalMinutes / 60).toFixed(1)}h`} />
        <SummaryCard icon={<PayrollIcon />} label="Approved pay" value={money(totalPay)} />
        <SummaryCard icon={<PayrollIcon />} label="Approved mileage" value={`${totalMileage.toFixed(1)} mi`} />
      </Stack>

      {isLoading ? <Box sx={{ py: 8, textAlign: 'center' }}><Typography color="text.secondary">Loading payroll inputs…</Typography></Box> : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Table size="small">
            <TableHead><TableRow>{['Carer', 'Client', 'Date', 'Hours', 'Travel', 'Pay', 'Status', 'Action'].map(label => <TableCell key={label} sx={{ fontWeight: 700 }}>{label}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {timesheets.length === 0 ? <TableRow><TableCell colSpan={8} align="center" sx={{ py: 6 }}><Typography color="text.secondary">No timesheet inputs match this view.</Typography>{isError && <AppButton variant="secondary" size="small" onClick={() => refetch()} sx={{ mt: 1 }}>Try again</AppButton>}</TableCell></TableRow> : timesheets.map((row: any) => {
                const status = String(row.status || 'draft')
                return <TableRow key={row.id} hover>
                  <TableCell>{String(row.staff_name || 'Unassigned')}</TableCell><TableCell>{String(row.person_name || '—')}</TableCell><TableCell>{dateOnly(row.scheduled_start)}</TableCell>
                  <TableCell>{((Number(row.work_minutes || 0) + Number(row.paid_travel_minutes || 0)) / 60).toFixed(1)}</TableCell><TableCell>{Number(row.paid_travel_minutes || 0)}m</TableCell><TableCell>{money(row.gross_pay_pence)}</TableCell>
                  <TableCell><Chip size="small" label={status.replace(/_/g, ' ')} color={status === 'approved' ? 'success' : status === 'submitted' ? 'warning' : status === 'rejected' ? 'error' : 'default'} /></TableCell>
                  <TableCell>{status === 'submitted' && <AppButton size="small" variant="primary" loading={approve.isPending} onClick={() => approve.mutate(row.id)}>Approve</AppButton>}</TableCell>
                </TableRow>
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </PageContainer>
  )
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return <Paper elevation={0} sx={{ p: 2, flex: 1, minWidth: 150, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}><Stack direction="row" spacing={1.25} alignItems="center"><Box color="primary.main">{icon}</Box><Box><Typography variant="h6" sx={{ fontWeight: 800 }}>{value}</Typography><Typography variant="caption" color="text.secondary">{label}</Typography></Box></Stack></Paper>
}
