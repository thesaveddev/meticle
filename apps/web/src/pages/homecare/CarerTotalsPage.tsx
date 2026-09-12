import { useEffect, useState } from 'react'
import { Box, Button, Chip, CircularProgress, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { Receipt as ReceiptIcon, TrendingUp as TrendingIcon, Download as DownloadIcon, Warning as WarningIcon } from '@mui/icons-material'
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

  const exportCsv = () => {
    const headers = ['carer', 'visits', 'paid_minutes', 'travel_minutes', 'miles', 'gross_pay_pence', 'approved', 'pending', 'rejected', 'exceptions']
    const escape = (v: unknown) => String(v ?? '')
    const csv = [headers.join(','), ...totals.map(t => [
      t.staff_name, t.visit_count, t.total_work_minutes, t.total_paid_travel_minutes,
      t.total_mileage_miles, t.total_gross_pay_pence, t.approved_count, t.pending_count, t.rejected_count, t.exception_count,
    ].map(escape).join(','))].join('\n') + '\n'
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `carer-totals-${from}-${to}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" gap={1.5}>
          <TrendingIcon sx={{ color: '#10b981', fontSize: 28 }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>Carer Monthly Totals</Typography>
            <Typography variant="body2" sx={{ color: '#6B7280' }}>Per-carer summary of paid minutes, travel, mileage and gross pay</Typography>
          </Box>
        </Stack>
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv} disabled={!totals.length} sx={{ textTransform: 'none', borderColor: '#E5E7EB', color: '#374151' }}>
          Export CSV
        </Button>
      </Stack>

      <Stack direction="row" gap={2} mb={3} alignItems="flex-end" flexWrap="wrap">
        <TextField label="From" type="date" size="small" value={from} onChange={e => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField label="To" type="date" size="small" value={to} onChange={e => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
        <Button variant="contained" onClick={load} disabled={loading} sx={{ textTransform: 'none', bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0D3D6B' } }}>Load</Button>
        <Button variant="text" onClick={() => { const r = getMonthRange(); setFrom(r.from); setTo(r.to) }} sx={{ textTransform: 'none', color: '#0F4C81' }}>This month</Button>
        <Button variant="text" onClick={() => { const r = getMonthRange(1); setFrom(r.from); setTo(r.to) }} sx={{ textTransform: 'none', color: '#0F4C81' }}>Last month</Button>
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
          { label: 'Exceptions', value: grandExceptions.toString(), color: grandExceptions > 0 ? '#DC2626' : '#10b981' },
          { label: 'Awaiting approval', value: grandPending.toString(), color: grandPending > 0 ? '#D97706' : '#10b981' },
        ].map(card => (
          <Paper key={card.label} elevation={0} sx={{ p: 2.5, flex: '1 1 140px', minWidth: 140, textAlign: 'center', border: '1px solid #E5E7EB', borderRadius: 2 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: card.color }}>{card.value}</Typography>
            <Typography variant="caption" sx={{ color: '#6B7280' }}>{card.label}</Typography>
          </Paper>
        ))}
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : totals.length === 0 ? (
        <Paper elevation={0} sx={{ p: 6, textAlign: 'center', border: '1px solid #E5E7EB', borderRadius: 2 }}>
          <ReceiptIcon sx={{ fontSize: 48, color: '#D1D5DB', mb: 1 }} />
          <Typography sx={{ color: '#6B7280' }}>No timesheet data for this period</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Carer</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Visits</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Paid time</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Travel</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Mileage</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Gross pay</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Approved</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Pending</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Rejected</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Exceptions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {totals.map(t => (
                <TableRow key={t.staff_id} hover>
                  <TableCell>
                    <Typography sx={{ fontWeight: 600 }}>{t.staff_name}</Typography>
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
                    <Chip label={t.pending_count} size="small" sx={{ bgcolor: t.pending_count > 0 ? '#FFF5D9' : '#F5F5F5', color: t.pending_count > 0 ? '#D97706' : '#9CA3AF' }} />
                  </TableCell>
                  <TableCell align="right">
                    <Chip label={t.rejected_count} size="small" sx={{ bgcolor: t.rejected_count > 0 ? '#FDECEC' : '#F5F5F5', color: t.rejected_count > 0 ? '#B42318' : '#9CA3AF' }} />
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
    </Box>
  )
}
