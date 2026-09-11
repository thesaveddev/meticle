import { useMemo, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Container, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { Download as DownloadIcon } from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'

const money = (pence: number | null | undefined) => pence == null ? '—' : `£${(Number(pence) / 100).toFixed(2)}`

const PAYROLL_PROVIDERS = [
  { value: 'sage', label: 'Sage Payroll' },
  { value: 'xero', label: 'Xero Payroll' },
  { value: 'quickbooks', label: 'QuickBooks Payroll' },
  { value: 'brightpay', label: 'BrightPay' },
  { value: 'staffology', label: 'Staffology' },
  { value: 'generic_csv', label: 'Generic CSV' },
]

export default function PayrollExportPage() {
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10)
  })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [provider, setProvider] = useState('generic_csv')
  const user = useMemo(() => { try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} } }, [])
  const isManager = user.role === 'ORG_ADMIN' || user.role === 'MANAGER'

  const { data: timesheets = [], isLoading } = useQuery({
    queryKey: ['homecare-timesheets', from, to],
    queryFn: () => api.get('/homecare/timesheets', { params: { status: 'approved' } }).then(r => Array.isArray(r.data) ? r.data.filter((row: any) => {
      const date = new Date(row.scheduled_start).getTime()
      return date >= new Date(`${from}T00:00:00`).getTime() && date < new Date(`${to}T23:59:59`).getTime()
    }) : []),
    enabled: isManager,
  })

  const totalMinutes = timesheets.reduce((sum: number, t: any) => sum + Number(t.work_minutes || 0) + Number(t.paid_travel_minutes || 0), 0)
  const totalHours = totalMinutes / 60
  const totalPay = timesheets.reduce((sum: number, t: any) => sum + (Number(t.gross_pay_pence) || 0), 0)
  const totalMileage = timesheets.reduce((sum: number, t: any) => sum + ((Number(t.mileage_miles) || 0) * (Number(t.mileage_rate_pence) || 0)), 0)

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Payroll Export</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>Export carer timesheets to your payroll provider</Typography>
        </Box>
        <Button variant="contained" startIcon={<DownloadIcon />} onClick={async () => {
          try {
            const response = await api.get('/homecare/payroll/export.csv', { params: { from, to, provider }, responseType: 'blob' })
            const url = URL.createObjectURL(response.data)
            const anchor = document.createElement('a')
            anchor.href = url
            anchor.download = `homecare-payroll-${from}-${to}.csv`
            anchor.click()
            URL.revokeObjectURL(url)
          } catch { /* the API response is surfaced by the page-level error boundary */ }
        }} disabled={!isManager || !from || !to || from > to} sx={{ textTransform: 'none' }}>
          Export for {PAYROLL_PROVIDERS.find(p => p.value === provider)?.label}
        </Button>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <TextField
          type="date"
          label="From"
          size="small"
          value={from}
          onChange={e => setFrom(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 160 }}
        />
        <TextField
          type="date"
          label="To"
          size="small"
          value={to}
          onChange={e => setTo(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 160 }}
        />
        <TextField
          select
          label="Payroll Provider"
          size="small"
          value={provider}
          onChange={e => setProvider(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          {PAYROLL_PROVIDERS.map(p => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
        </TextField>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <Paper variant="outlined" sx={{ p: 3, flex: 1, textAlign: 'center' }}>
          <Typography variant="h3" sx={{ fontWeight: 800, color: 'primary.main' }}>{totalHours.toFixed(1)}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>Total hours</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 3, flex: 1, textAlign: 'center' }}>
          <Typography variant="h3" sx={{ fontWeight: 800, color: 'success.main' }}>{money(totalPay)}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>Total pay</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 3, flex: 1, textAlign: 'center' }}>
          <Typography variant="h3" sx={{ fontWeight: 800 }}>{money(totalMileage)}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>Total mileage</Typography>
        </Paper>
      </Stack>

      {!isManager && (
        <Alert severity="info" sx={{ mb: 3 }}>Only managers can export payroll data.</Alert>
      )}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Carer</TableCell>
                <TableCell align="right">Visits</TableCell>
                <TableCell align="right">Hours</TableCell>
                <TableCell align="right">Pay</TableCell>
                <TableCell align="right">Mileage Pay</TableCell>
                <TableCell align="right">Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {timesheets.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: 'text.secondary' }}>No timesheets for this period</TableCell></TableRow>
              ) : timesheets.map((t: any) => (
                <TableRow key={t.carer_id || t.id}>
                  <TableCell>{t.staff_name || '—'}</TableCell>
                  <TableCell align="right">1</TableCell>
                  <TableCell align="right">{((Number(t.work_minutes || 0) + Number(t.paid_travel_minutes || 0)) / 60).toFixed(1)}</TableCell>
                  <TableCell align="right">{money(t.gross_pay_pence)}</TableCell>
                  <TableCell align="right">{money((Number(t.mileage_miles) || 0) * (Number(t.mileage_rate_pence) || 0))}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{money((Number(t.gross_pay_pence) || 0) + ((Number(t.mileage_miles) || 0) * (Number(t.mileage_rate_pence) || 0)))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  )
}
