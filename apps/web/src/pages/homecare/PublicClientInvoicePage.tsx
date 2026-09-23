import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Alert, Box, Button, Chip, CircularProgress, Divider, Paper, Stack, Typography } from '@mui/material'
import { Download as DownloadIcon } from '@mui/icons-material'
import api from '../../services/api'
import PageMeta from '../../components/PageMeta'

const money = (value: unknown) => `£${(Number(value || 0) / 100).toFixed(2)}`
const dateLabel = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

export default function PublicClientInvoicePage() {
  const { token = '' } = useParams()
  const invoiceQuery = useQuery({
    queryKey: ['public-client-invoice', token],
    queryFn: () => api.get(`/client-invoices/${token}`).then(response => response.data),
    enabled: /^[a-f0-9]{64}$/.test(token),
    retry: false,
  })

  if (invoiceQuery.isLoading) return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>
  if (invoiceQuery.isError || !invoiceQuery.data) return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}><Alert severity="error">This invoice link is invalid or has expired. Please contact the care provider.</Alert></Box>

  const { invoice, supplier, lines } = invoiceQuery.data
  return <>
    <PageMeta title={`Invoice ${invoice.invoice_number}`} description="Secure invoice from your care provider" />
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: { xs: 3, md: 7 }, px: 2 }}>
      <Paper elevation={0} sx={{ maxWidth: 880, mx: 'auto', p: { xs: 2.5, md: 5 }, border: 1, borderColor: 'divider', borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2} alignItems={{ sm: 'flex-start' }}>
          <Box><Typography variant="overline" color="text.secondary">{supplier?.name || 'Care provider'}</Typography><Typography variant="h4" fontWeight={800}>Invoice</Typography><Typography color="text.secondary">{invoice.invoice_number}</Typography></Box>
          <Stack direction="row" gap={1} alignItems="center"><Chip label={invoice.status} color={invoice.status === 'paid' ? 'success' : 'primary'} variant="outlined" /><Button variant="outlined" startIcon={<DownloadIcon />} href={`/api/client-invoices/${token}/pdf`} target="_blank" rel="noreferrer">Download PDF</Button></Stack>
        </Stack>
        <Divider sx={{ my: 3 }} />
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={3}>
          <Box><Typography variant="caption" color="text.secondary">Billed to</Typography><Typography fontWeight={700}>{invoice.recipient_name || invoice.payer_name}</Typography>{invoice.recipient_address && <Typography sx={{ whiteSpace: 'pre-line' }} color="text.secondary">{invoice.recipient_address}</Typography>}</Box>
          <Box><Typography variant="caption" color="text.secondary">Service period</Typography><Typography fontWeight={700}>{dateLabel(invoice.period_from)} – {dateLabel(invoice.period_to)}</Typography><Typography variant="caption" color="text.secondary">Issued {dateLabel(invoice.approved_at || invoice.sent_at)}</Typography></Box>
        </Stack>
        <Box sx={{ mt: 4, overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}><thead><tr>{['Client / service','Date','Delivered','Gross'].map(label => <th key={label} style={{ padding: 12, borderBottom: '1px solid #ddd' }}>{label}</th>)}</tr></thead><tbody>{lines.map((line: any, index: number) => <tr key={`${line.scheduled_start}-${index}`}><td style={{ padding: 12, borderBottom: '1px solid #eee' }}><strong>{line.person_name}</strong><br />{line.package_name} · {line.visit_label}</td><td style={{ padding: 12, borderBottom: '1px solid #eee' }}>{dateLabel(line.scheduled_start)}</td><td style={{ padding: 12, borderBottom: '1px solid #eee' }}>{line.delivered_minutes} min</td><td style={{ padding: 12, borderBottom: '1px solid #eee' }}>{money(line.gross_amount_pence)}</td></tr>)}</tbody></table></Box>
        <Stack spacing={1} sx={{ maxWidth: 320, ml: 'auto', mt: 3 }}><Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Net</Typography><Typography>{money(invoice.subtotal_pence)}</Typography></Stack><Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">VAT</Typography><Typography>{money(invoice.vat_amount_pence)}</Typography></Stack><Divider /><Stack direction="row" justifyContent="space-between"><Typography variant="h6" fontWeight={800}>Total due</Typography><Typography variant="h6" fontWeight={800}>{money(invoice.gross_amount_pence)}</Typography></Stack></Stack>
        {invoice.status === 'paid' && <Alert severity="success" sx={{ mt: 3 }}>Payment recorded{invoice.payment_reference ? ` · reference ${invoice.payment_reference}` : ''}.</Alert>}
      </Paper>
    </Box>
  </>
}
