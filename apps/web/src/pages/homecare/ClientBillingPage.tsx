import { useMemo, useState } from 'react'
import { Alert, Box, Button, Chip, CircularProgress, Container, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { CheckCircle as CheckCircleIcon, ReceiptLong as ReceiptLongIcon } from '@mui/icons-material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'

const money = (pence: number | null | undefined) => pence == null ? '—' : `£${(Number(pence) / 100).toFixed(2)}`
const dateLabel = (value: string) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export default function ClientBillingPage() {
  const user = useMemo(() => { try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} } }, [])
  const isManager = user.role === 'ORG_ADMIN' || user.role === 'MANAGER'
  const queryClient = useQueryClient()
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [message, setMessage] = useState('')
  const [selectedRun, setSelectedRun] = useState<string | null>(null)

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
  const createRun = useMutation({
    mutationFn: () => api.post('/homecare/client-billing/runs', { from, to }),
    onSuccess: (response) => {
      setSelectedRun(response.data.run.id)
      setMessage(`Draft billing run created with ${response.data.lines.length} visit line${response.data.lines.length === 1 ? '' : 's'}.`)
      queryClient.invalidateQueries({ queryKey: ['homecare-client-billing-runs'] })
      queryClient.invalidateQueries({ queryKey: ['homecare-client-billing-lines'] })
    },
    onError: (error: any) => setMessage(error.response?.data?.message || 'Could not create billing run.'),
  })
  const approveRun = useMutation({
    mutationFn: (runId: string) => api.post(`/homecare/client-billing/runs/${runId}/approve`),
    onSuccess: () => {
      setMessage('Billing run approved. It remains invoice-ready output; no client or Stripe charge was created.')
      queryClient.invalidateQueries({ queryKey: ['homecare-client-billing-runs'] })
    },
    onError: (error: any) => setMessage(error.response?.data?.message || 'Could not approve billing run.'),
  })

  const rows = utilisation.data || []
  const billable = rows.filter((row: any) => row.billing_status === 'billable')
  const review = rows.filter((row: any) => row.billing_status === 'review')
  const total = billable.reduce((sum: number, row: any) => sum + Number(row.amount_pence || 0), 0)
  const currentRun = (runs.data || []).find((run: any) => run.id === selectedRun)

  if (!isManager) return <Container maxWidth="lg" sx={{ py: 4 }}><Alert severity="info">Client billing is available to managers and organisation administrators.</Alert></Container>

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Client billing</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Review delivered domiciliary visits and prepare an invoice-ready utilisation run.</Typography>
        </Box>
        <Button variant="contained" startIcon={<ReceiptLongIcon />} onClick={() => createRun.mutate()} disabled={createRun.isPending || !from || !to || from > to} sx={{ textTransform: 'none' }}>
          {createRun.isPending ? <CircularProgress size={18} color="inherit" /> : 'Create draft run'}
        </Button>
      </Stack>

      {message && <Alert severity={message.startsWith('Could not') ? 'error' : 'success'} onClose={() => setMessage('')} sx={{ mb: 3 }}>{message}</Alert>}

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <TextField type="date" label="From" size="small" value={from} onChange={e => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField type="date" label="To" size="small" value={to} onChange={e => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Typography variant="body2" color="text.secondary">Completed visits are billable only when a client rate is configured on the package. Missed, cancelled, incomplete and unrated visits are not silently billed.</Typography>
        </Stack>
      </Paper>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <Paper variant="outlined" sx={{ p: 2.5, flex: 1 }}><Typography variant="h4" fontWeight={800}>{rows.length}</Typography><Typography variant="body2" color="text.secondary">Visits in period</Typography></Paper>
        <Paper variant="outlined" sx={{ p: 2.5, flex: 1 }}><Typography variant="h4" fontWeight={800} color="success.main">{billable.length}</Typography><Typography variant="body2" color="text.secondary">Billable visits</Typography></Paper>
        <Paper variant="outlined" sx={{ p: 2.5, flex: 1 }}><Typography variant="h4" fontWeight={800}>{money(total)}</Typography><Typography variant="body2" color="text.secondary">Billable total</Typography></Paper>
        <Paper variant="outlined" sx={{ p: 2.5, flex: 1 }}><Typography variant="h4" fontWeight={800} color={review.length ? 'warning.main' : 'text.primary'}>{review.length}</Typography><Typography variant="body2" color="text.secondary">Needs review</Typography></Paper>
      </Stack>

      {utilisation.isLoading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box> : (
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
          <Table>
            <TableHead><TableRow><TableCell>Visit</TableCell><TableCell>Client / package</TableCell><TableCell>Status</TableCell><TableCell align="right">Delivered</TableCell><TableCell align="right">Rate</TableCell><TableCell align="right">Amount</TableCell><TableCell>Decision</TableCell></TableRow></TableHead>
            <TableBody>
              {!rows.length ? <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>No visits in this period</TableCell></TableRow> : rows.map((row: any) => (
                <TableRow key={row.visit_id}>
                  <TableCell><Typography variant="body2" fontWeight={700}>{dateLabel(row.scheduled_start)}</Typography><Typography variant="caption" color="text.secondary">{row.scheduled_minutes} scheduled min</Typography></TableCell>
                  <TableCell><Typography variant="body2">{row.person_name}</Typography><Typography variant="caption" color="text.secondary">{row.package_name}</Typography></TableCell>
                  <TableCell><Chip size="small" label={row.visit_status.replace(/_/g, ' ')} /></TableCell>
                  <TableCell align="right">{row.delivered_minutes} min</TableCell>
                  <TableCell align="right">{money(row.client_rate_pence)} / hr</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{money(row.amount_pence)}</TableCell>
                  <TableCell><Chip size="small" color={row.billing_status === 'billable' ? 'success' : row.billing_status === 'review' ? 'warning' : 'default'} label={row.billing_status === 'billable' ? 'Billable' : row.exclusion_reason || 'Not billable'} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Typography variant="h6" fontWeight={800} sx={{ mb: 1.5 }}>Previous runs</Typography>
      <Stack spacing={1.5} sx={{ mb: 4 }}>
        {(runs.data || []).length === 0 ? <Typography variant="body2" color="text.secondary">No billing runs created yet.</Typography> : (runs.data || []).map((run: any) => (
          <Paper key={run.id} variant="outlined" sx={{ p: 2, display: 'flex', alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
            <Box><Typography fontWeight={700}>{dateLabel(run.period_from)} – {dateLabel(run.period_to)}</Typography><Typography variant="body2" color="text.secondary">{run.row_count} lines · {money(run.total_amount_pence)} · created {dateLabel(run.created_at)}</Typography></Box>
            <Stack direction="row" spacing={1} alignItems="center"><Chip size="small" label={run.status} color={run.status === 'approved' ? 'success' : 'default'} /><Button size="small" onClick={() => setSelectedRun(run.id)} sx={{ textTransform: 'none' }}>View lines</Button>{run.status === 'draft' && <Button size="small" variant="contained" startIcon={<CheckCircleIcon />} onClick={() => approveRun.mutate(run.id)} disabled={approveRun.isPending} sx={{ textTransform: 'none' }}>Approve</Button>}</Stack>
          </Paper>
        ))}
      </Stack>

      {selectedRun && <Paper variant="outlined" sx={{ p: 2, mb: 4 }}><Typography variant="h6" fontWeight={800} sx={{ mb: 1.5 }}>Run detail</Typography>{lines.isLoading ? <CircularProgress size={22} /> : <Typography variant="body2" color="text.secondary">{lines.data?.length || 0} snapshot lines loaded. The run is immutable operational output for your invoice process and does not create a payment.</Typography>}</Paper>}
      {currentRun && <Alert severity="info">This run is <strong>{currentRun.status}</strong>. Use your approved funding, cancellation and VAT policy before issuing an external invoice.</Alert>}
    </Container>
  )
}
