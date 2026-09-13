import { useMemo, useState } from 'react'
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { CheckCircle as CheckCircleIcon, ReceiptLong as ReceiptLongIcon, Block as BlockIcon, PictureAsPdf as PdfIcon, Download as DownloadIcon } from '@mui/icons-material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { EmptyState } from '../../components/design/EmptyState'

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
  const [voidReason, setVoidReason] = useState('')
  const [voidDialog, setVoidDialog] = useState<string | null>(null)

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
      setMessage(`Draft billing run created with ${response.data.lines.length} visit line${response.data.lines.length === 1 ? '' : 's'}. VAT, funding and cancellation policy were snapshot at creation.`)
      queryClient.invalidateQueries({ queryKey: ['homecare-client-billing-runs'] })
      queryClient.invalidateQueries({ queryKey: ['homecare-client-billing-lines'] })
    },
    onError: (error: any) => setMessage(error.response?.data?.message || 'Could not create billing run.'),
  })
  const approveRun = useMutation({
    mutationFn: (runId: string) => api.post(`/homecare/client-billing/runs/${runId}/approve`),
    onSuccess: (response) => {
      setMessage(`Billing run approved${response.data?.invoice_number ? ` as ${response.data.invoice_number}` : ''}. Approved runs are immutable; void with an audited reason if you need to correct them. No client or Stripe charge was created.`)
      queryClient.invalidateQueries({ queryKey: ['homecare-client-billing-runs'] })
    },
    onError: (error: any) => setMessage(error.response?.data?.message || 'Could not approve billing run.'),
  })
  const voidRun = useMutation({
    mutationFn: ({ runId, reason }: { runId: string; reason: string }) => api.post(`/homecare/client-billing/runs/${runId}/void`, { void_reason: reason }),
    onSuccess: () => {
      setMessage('Approved billing run voided. An audited reversal was created — the original record was not deleted.')
      setVoidDialog(null)
      setVoidReason('')
      queryClient.invalidateQueries({ queryKey: ['homecare-client-billing-runs'] })
    },
    onError: (error: any) => setMessage(error.response?.data?.message || 'Could not void billing run.'),
  })

  const rows = utilisation.data || []
  const billable = rows.filter((row: any) => row.billing_status === 'billable')
  const review = rows.filter((row: any) => row.billing_status === 'review')
  const netTotal = billable.reduce((sum: number, row: any) => sum + Number(row.net_amount_pence ?? row.amount_pence ?? 0), 0)
  const vatTotal = billable.reduce((sum: number, row: any) => sum + Number(row.vat_amount_pence ?? 0), 0)
  const grossTotal = billable.reduce((sum: number, row: any) => sum + Number(row.gross_amount_pence ?? row.amount_pence ?? 0), 0)
  const currentRun = (runs.data || []).find((run: any) => run.id === selectedRun)
  const fundingBreakdown = currentRun?.funding_breakdown || null

  if (!isManager) return <Box sx={{ maxWidth: 1180, mx: 'auto' }}><Alert severity="info">Client billing is available to managers and organisation administrators.</Alert></Box>

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Client billing</Typography>
          <Typography variant="body2" sx={{ color: '#6B7280', mt: 0.5 }}>Review delivered domiciliary visits and prepare an approved client invoice artefact. VAT and funder type are snapshot from your organisation billing settings.</Typography>
        </Box>
        <Button variant="contained" startIcon={<ReceiptLongIcon />} onClick={() => createRun.mutate()} disabled={createRun.isPending || !from || !to || from > to} sx={{ textTransform: 'none' }}>
          {createRun.isPending ? <CircularProgress size={18} color="inherit" /> : 'Create draft run'}
        </Button>
      </Stack>

      {message && <Alert severity={message.startsWith('Could not') ? 'error' : 'success'} onClose={() => setMessage('')} sx={{ mb: 3 }}>{message}</Alert>}

      <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid #E5E7EB', borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <TextField type="date" label="From" size="small" value={from} onChange={e => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField type="date" label="To" size="small" value={to} onChange={e => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Typography variant="body2" color="text.secondary">Completed visits are invoice-ready only when delivered minutes and a package client rate exist. Missed, cancelled and unrated visits are recorded as not billable with a reason. No payment is taken here.</Typography>
        </Stack>
      </Paper>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <Paper elevation={0} sx={{ p: 2.5, flex: 1, border: '1px solid #E5E7EB', borderRadius: 2 }}><Typography variant="h4" sx={{ fontWeight: 800 }}>{rows.length}</Typography><Typography variant="body2" sx={{ color: '#6B7280' }}>Visits in period</Typography></Paper>
        <Paper elevation={0} sx={{ p: 2.5, flex: 1, border: '1px solid #E5E7EB', borderRadius: 2 }}><Typography variant="h4" sx={{ fontWeight: 800, color: '#10b981' }}>{billable.length}</Typography><Typography variant="body2" sx={{ color: '#6B7280' }}>Billable visits</Typography></Paper>
        <Paper elevation={0} sx={{ p: 2.5, flex: 1, border: '1px solid #E5E7EB', borderRadius: 2 }}><Typography variant="h4" sx={{ fontWeight: 800 }}>{money(netTotal)}</Typography><Typography variant="body2" sx={{ color: '#6B7280' }}>Net total</Typography></Paper>
        <Paper elevation={0} sx={{ p: 2.5, flex: 1, border: '1px solid #E5E7EB', borderRadius: 2 }}><Typography variant="h4" sx={{ fontWeight: 800 }}>{money(vatTotal)}</Typography><Typography variant="body2" sx={{ color: '#6B7280' }}>VAT</Typography></Paper>
        <Paper elevation={0} sx={{ p: 2.5, flex: 1, border: '1px solid #E5E7EB', borderRadius: 2 }}><Typography variant="h4" sx={{ fontWeight: 800 }}>{money(grossTotal)}</Typography><Typography variant="body2" sx={{ color: '#6B7280' }}>Gross invoice-ready</Typography></Paper>
        <Paper elevation={0} sx={{ p: 2.5, flex: 1, border: '1px solid #E5E7EB', borderRadius: 2 }}><Typography variant="h4" sx={{ fontWeight: 800, color: review.length ? '#D97706' : '#111827' }}>{review.length}</Typography><Typography variant="body2" sx={{ color: '#6B7280' }}>Needs review</Typography></Paper>
      </Stack>

      {utilisation.isLoading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box> : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2, mb: 4 }}>
          <Table>
            <TableHead><TableRow><TableCell>Visit</TableCell><TableCell>Client / package</TableCell><TableCell>Funding</TableCell><TableCell>Status</TableCell><TableCell align="right">Delivered</TableCell><TableCell align="right">Net / VAT / gross</TableCell><TableCell>Decision</TableCell></TableRow></TableHead>
            <TableBody>
              {!rows.length ? <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>No visits in this period</TableCell></TableRow> : rows.map((row: any) => (
                <TableRow key={row.visit_id}>
                  <TableCell><Typography variant="body2" fontWeight={700}>{dateLabel(row.scheduled_start)}</Typography><Typography variant="caption" color="text.secondary">{row.scheduled_minutes} scheduled min · {row.vat_inclusive ? 'VAT inclusive' : row.vat_rate ? `VAT ${row.vat_rate}%` : 'No VAT'}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{row.person_name}</Typography><Typography variant="caption" color="text.secondary">{row.package_name} · {money(row.client_rate_pence)} / hr</Typography></TableCell>
                  <TableCell><Chip size="small" label={String(row.funding_type).replace(/_/g, ' ')} variant="outlined" /></TableCell>
                  <TableCell><Chip size="small" label={row.visit_status.replace(/_/g, ' ')} /></TableCell>
                  <TableCell align="right">{row.delivered_minutes} min</TableCell>
                  <TableCell align="right"><Typography variant="body2" sx={{ fontWeight: 700 }}>{money(row.gross_amount_pence ?? row.amount_pence)}</Typography><Typography variant="caption" color="text.secondary">{money(row.net_amount_pence ?? row.amount_pence)} net · {money(row.vat_amount_pence)} VAT</Typography></TableCell>
                  <TableCell><Chip size="small" color={row.billing_status === 'billable' ? 'success' : row.billing_status === 'review' ? 'warning' : 'default'} label={row.billing_status === 'billable' ? 'Billable' : row.exclusion_reason || row.cancellation_policy_applied || 'Not billable'} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>Previous runs</Typography>
      <Stack spacing={1.5} sx={{ mb: 4 }}>
        {(runs.data || []).length === 0 ? <EmptyState title="No billing runs yet" description="Create your first billing run to generate invoices" variant="default" /> : (runs.data || []).map((run: any) => (
          <Paper key={run.id} elevation={0} sx={{ p: 2, display: 'flex', alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 2, flexDirection: { xs: 'column', sm: 'row' }, border: '1px solid #E5E7EB', borderRadius: 2 }}>
            <Box>
              <Typography fontWeight={700}>{run.invoice_number || 'Draft run'} · {dateLabel(run.period_from)} – {dateLabel(run.period_to)}</Typography>
              <Typography variant="body2" color="text.secondary">{run.row_count} lines · gross {money(run.gross_amount_pence ?? run.total_amount_pence)} {run.vat_amount_pence ? `· VAT ${money(run.vat_amount_pence)}` : ''} · {run.funding_breakdown ? `${Object.keys(run.funding_breakdown).length} funder group${Object.keys(run.funding_breakdown).length === 1 ? '' : 's'}` : ''} · created {dateLabel(run.created_at)}</Typography>
              {run.voided_at && <Typography variant="caption" color="error">Voided {dateLabel(run.voided_at)}{run.void_reason ? ` — ${run.void_reason}` : ''}</Typography>}
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip size="small" label={run.status} color={run.status === 'approved' ? 'success' : run.status === 'void' ? 'error' : 'default'} />
              <Button size="small" onClick={() => setSelectedRun(run.id)} sx={{ textTransform: 'none' }}>View lines</Button>
              {run.status === 'draft' && <Button size="small" variant="contained" startIcon={<CheckCircleIcon />} onClick={() => approveRun.mutate(run.id)} disabled={approveRun.isPending} sx={{ textTransform: 'none' }}>Approve</Button>}
              {run.status === 'approved' && <><Button size="small" variant="outlined" startIcon={<PdfIcon />} onClick={() => window.open(`/api/homecare/client-billing/runs/${run.id}/invoice.pdf`, '_blank')} sx={{ textTransform: 'none' }}>Invoice PDF</Button><Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={() => window.open(`/api/homecare/client-billing/runs/${run.id}/mtd-export`, '_blank')} sx={{ textTransform: 'none' }}>MTD Export</Button><Button size="small" color="error" variant="outlined" startIcon={<BlockIcon />} onClick={() => setVoidDialog(run.id)} sx={{ textTransform: 'none' }}>Void</Button></>}
            </Stack>
          </Paper>
        ))}
      </Stack>

      {selectedRun && (
        <Paper elevation={0} sx={{ p: 2, mb: 4, border: '1px solid #E5E7EB', borderRadius: 2 }}>
          <Typography variant="h6" fontWeight={800} sx={{ mb: 1.5 }}>Run detail</Typography>
          {lines.isLoading ? <CircularProgress size={22} /> : (
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">{lines.data?.length || 0} snapshot lines. The run is immutable operational output for your invoice process and does not create a payment.</Typography>
              {fundingBreakdown && (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small"><TableHead><TableRow><TableCell>Funding</TableCell><TableCell align="right">Lines</TableCell><TableCell align="right">Billable</TableCell><TableCell align="right">Net</TableCell><TableCell align="right">VAT</TableCell><TableCell align="right">Gross</TableCell></TableRow></TableHead><TableBody>{Object.entries(fundingBreakdown as Record<string, any>).map(([key, value]: any) => <TableRow key={key}><TableCell sx={{ textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</TableCell><TableCell align="right">{value.count}</TableCell><TableCell align="right">{value.billable_count}</TableCell><TableCell align="right">{money(value.net_pence)}</TableCell><TableCell align="right">{money(value.vat_pence)}</TableCell><TableCell align="right" sx={{ fontWeight: 700 }}>{money(value.gross_pence)}</TableCell></TableRow>)}</TableBody></Table>
                </TableContainer>
              )}
            </Stack>
          )}
        </Paper>
      )}
      {currentRun && <Alert severity={currentRun.status === 'void' ? 'warning' : 'info'} sx={{ mt: 2 }}>This run is <strong>{currentRun.status}</strong>{currentRun.invoice_number ? ` · ${currentRun.invoice_number}` : ''}. Approved runs are immutable; only a void with a recorded reason can reverse them.</Alert>}

      <Dialog open={Boolean(voidDialog)} onClose={() => setVoidDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Void approved run</DialogTitle>
        <DialogContent><Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>This does not delete evidence. The original approved run is retained and marked as void with your reason in the audit trail.</Typography><TextField fullWidth multiline minRows={3} label="Reason for voiding" value={voidReason} onChange={e => setVoidReason(e.target.value)} placeholder="e.g. Funding code was incorrect — reissued as ..." /></DialogContent>
        <DialogActions><Button onClick={() => setVoidDialog(null)} sx={{ textTransform: 'none' }}>Cancel</Button><Button variant="contained" color="error" onClick={() => voidDialog && voidRun.mutate({ runId: voidDialog, reason: voidReason || 'Voided by manager' })} disabled={voidRun.isPending || !voidReason.trim()} sx={{ textTransform: 'none' }}>{voidRun.isPending ? <CircularProgress size={18} color="inherit" /> : 'Confirm void'}</Button></DialogActions>
      </Dialog>
    </Box>
  )
}
