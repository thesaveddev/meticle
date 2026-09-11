import { useEffect, useState } from 'react'
import { Box, Button, Card, CardContent, Chip, CircularProgress, Container, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { Receipt as ReceiptIcon, TrendingUp as TrendingIcon, Warning as WarningIcon } from '@mui/icons-material'
import api from '../../services/api'

interface CarerTotal {
  staff_id: string
  staff_name: string
  visit_count: number
  total_work_minutes: number
  total_travel_minutes: number
  total_paid_travel_minutes: number
  total_mileage_miles: number
  total_gross_pay_pence: number
  approved_gross_pence: number
  pending_count: number
  approved_count: number
  rejected_count: number
  exception_count: number
}

function fmtPence(p: number) { return `£${(p / 100).toFixed(2)}` }
function fmtHours(m: number) { const h = Math.floor(m / 60); const min = m % 60; return h > 0 ? `${h}h ${min}m` : `${min}m` }
function fmtMiles(m: number) { return `${Number(m || 0).toFixed(1)} mi` }

function getMonthRange(monthsBack = 0) {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1)
  const to = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 0, 23, 59, 59)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

export default function CarerTotalsPage() {
  const [totals, setTotals] = useState<CarerTotal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [from, setFrom] = useState(() => getMonthRange().from)
  const [to, setTo] = useState(() => getMonthRange().to)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const res = await api.get(`/homecare/timesheets/monthly-totals?from=${from}&to=${to}`)
      setTotals(res.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load carer totals')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const grandWork = totals.reduce((s, t) => s + Number(t.total_work_minutes || 0), 0)
  const grandTravel = totals.reduce((s, t) => s + Number(t.total_paid_travel_minutes || 0), 0)
  const grandMileage = totals.reduce((s, t) => s + Number(t.total_mileage_miles || 0), 0)
  const grandGross = totals.reduce((s, t) => s + Number(t.total_gross_pay_pence || 0), 0)
  const grandExceptions = totals.reduce((s, t) => s + Number(t.exception_count || 0), 0)
  const grandPending = totals.reduce((s, t) => s + Number(t.pending_count || 0), 0)

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" alignItems="center" gap={2} mb={3}>
        <TrendingIcon sx={{ color: '#10b981', fontSize: 32 }} />
        <Box>
          <Typography variant="h4" fontWeight={800}>Carer Monthly Totals</Typography>
          <Typography color="text.secondary">Per-carer summary of paid minutes, travel, mileage and gross pay</Typography>
        </Box>
      </Stack>

      <Stack direction="row" gap={2} mb={3} alignItems="flex-end">
        <TextField label="From" type="date" size="small" value={from} onChange={e => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField label="To" type="date" size="small" value={to} onChange={e => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
        <Button variant="contained" onClick={load} disabled={loading} sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#047857' } }}>Load</Button>
        <Button variant="text" onClick={() => { const r = getMonthRange(); setFrom(r.from); setTo(r.to) }}>This month</Button>
        <Button variant="text" onClick={() => { const r = getMonthRange(1); setFrom(r.from); setTo(r.to) }}>Last month</Button>
      </Stack>

      {error && <Typography color="error" mb={2}>{error}</Typography>}

      {/* Summary cards */}
      <Stack direction="row" gap={2} mb={3} flexWrap="wrap">
        {[
          { label: 'Carers', value: totals.length.toString(), color: '#0F4C81' },
          { label: 'Total paid time', value: fmtHours(grandWork), color: '#10b981' },
          { label: 'Travel time', value: fmtHours(grandTravel), color: '#3b82f6' },
          { label: 'Mileage', value: fmtMiles(grandMileage), color: '#8b5cf6' },
          { label: 'Gross pay', value: fmtPence(grandGross), color: '#0F4C81' },
          { label: 'Exceptions', value: grandExceptions.toString(), color: grandExceptions > 0 ? '#B42318' : '#10b981' },
          { label: 'Awaiting approval', value: grandPending.toString(), color: grandPending > 0 ? '#D97706' : '#10b981' },
        ].map(card => (
          <Card key={card.label} sx={{ minWidth: 140, flex: '1 1 140px' }}>
            <CardContent sx={{ textAlign: 'center', py: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="h5" fontWeight={800} color={card.color}>{card.value}</Typography>
              <Typography variant="caption" color="text.secondary">{card.label}</Typography>
            </CardContent>
          </Card>
        ))}
      </Stack>

      {loading ? (
        <Box textAlign="center" py={6}><CircularProgress /></Box>
      ) : totals.length === 0 ? (
        <Box textAlign="center" py={6}>
          <ReceiptIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">No timesheet data for this period</Typography>
        </Box>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Carer</TableCell>
                <TableCell align="right">Visits</TableCell>
                <TableCell align="right">Paid time</TableCell>
                <TableCell align="right">Travel</TableCell>
                <TableCell align="right">Mileage</TableCell>
                <TableCell align="right">Gross pay</TableCell>
                <TableCell align="right">Approved</TableCell>
                <TableCell align="right">Pending</TableCell>
                <TableCell align="right">Rejected</TableCell>
                <TableCell align="right">Exceptions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {totals.map(t => (
                <TableRow key={t.staff_id} hover>
                  <TableCell>
                    <Typography fontWeight={600}>{t.staff_name}</Typography>
                  </TableCell>
                  <TableCell align="right">{t.visit_count}</TableCell>
                  <TableCell align="right">{fmtHours(Number(t.total_work_minutes || 0))}</TableCell>
                  <TableCell align="right">{fmtHours(Number(t.total_paid_travel_minutes || 0))}</TableCell>
                  <TableCell align="right">{fmtMiles(t.total_mileage_miles)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtPence(t.total_gross_pay_pence)}</TableCell>
                  <TableCell align="right">
                    <Chip label={t.approved_count} size="small" sx={{ bgcolor: '#E9F7F0', color: '#047857' }} />
                  </TableCell>
                  <TableCell align="right">
                    <Chip label={t.pending_count} size="small" sx={{ bgcolor: t.pending_count > 0 ? '#FFF5D9' : '#F5F5F5', color: t.pending_count > 0 ? '#D97706' : '#999' }} />
                  </TableCell>
                  <TableCell align="right">
                    <Chip label={t.rejected_count} size="small" sx={{ bgcolor: t.rejected_count > 0 ? '#FDECEC' : '#F5F5F5', color: t.rejected_count > 0 ? '#B42318' : '#999' }} />
                  </TableCell>
                  <TableCell align="right">
                    {Number(t.exception_count) > 0 ? (
                      <Chip icon={<WarningIcon />} label={t.exception_count} size="small" sx={{ bgcolor: '#FDECEC', color: '#B42318' }} />
                    ) : (
                      <Chip label="0" size="small" sx={{ bgcolor: '#E9F7F0', color: '#047857' }} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  )
}
