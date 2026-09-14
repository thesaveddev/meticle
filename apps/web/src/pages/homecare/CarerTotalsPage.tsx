import { useEffect, useState, useCallback } from 'react'
import { Box, Button, Chip, CircularProgress, IconButton, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { Receipt as ReceiptIcon, TrendingUp as TrendingIcon, Download as DownloadIcon, Warning as WarningIcon, ArrowBack as BackIcon, CheckCircle as CheckIcon, Schedule as ClockIcon, Person as PersonIcon, DirectionsCar as CarIcon, AttachMoney as MoneyIcon, CheckCircleOutline as PendingCheckIcon } from '@mui/icons-material'
import api from '../../services/api'

/* ── Types ── */
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

interface VisitDetail {
  id: string
  label: string
  visit_type: string
  scheduled_start: string
  scheduled_end: string
  status: string
  check_in_at: string | null
  check_out_at: string | null
  check_in_latitude: number | null
  check_in_longitude: number | null
  check_in_accuracy_meters: number | null
  check_out_latitude: number | null
  check_out_longitude: number | null
  actual_travel_minutes: number | null
  actual_mileage_miles: number | null
  visit_notes: string | null
  progress_notes: string | null
  care_plan_notes: string | null
  client_mood: string | null
  wellbeing_notes: string | null
  personal_care: string | null
  fluid_intake_ml: number | null
  exception_type: string | null
  late_reason: string | null
  person_name: string
  person_address: string | null
  timesheet_id: string | null
  work_minutes: number | null
  travel_minutes: number | null
  paid_travel_minutes: number | null
  mileage_miles: number | null
  mileage_rate_pence: number | null
  hourly_rate_pence: number | null
  gross_pay_pence: number | null
  timesheet_status: string | null
  submitted_at: string | null
  approved_at: string | null
  rejection_reason: string | null
  tasks_total: number | null
  tasks_completed: number | null
}

interface PendingTimesheet {
  timesheet_id: string
  work_minutes: number
  travel_minutes: number
  paid_travel_minutes: number
  mileage_miles: number
  gross_pay_pence: number
  timesheet_status: string
  submitted_at: string
  staff_name: string
  staff_id: string
  visit_label: string
  scheduled_start: string
  scheduled_end: string
  person_name: string
}

/* ── Helpers ── */
function fmtPence(p: number) { return `£${(Number(p || 0) / 100).toFixed(2)}` }
function fmtHours(m: number) { const mins = Number(m || 0); const h = Math.floor(mins / 60); const min = mins % 60; return h > 0 ? `${h}h ${min}m` : `${min}m` }
function fmtMiles(m: number) { return `${Number(m || 0).toFixed(1)} mi` }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }
function fmtTime(d: string) { return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }
function fmtDateTime(d: string) { return `${fmtDate(d)} ${fmtTime(d)}` }

function statusColor(status: string) {
  switch (status) {
    case 'completed': return { bg: '#E9F7F0', color: '#047857', label: 'Completed' }
    case 'checked_in': return { bg: '#EFF6FF', color: '#1D4ED8', label: 'Checked in' }
    case 'scheduled': return { bg: '#F3F4F6', color: '#374151', label: 'Scheduled' }
    case 'en_route': return { bg: '#FFF5D9', color: '#D97706', label: 'En route' }
    case 'missed': return { bg: '#FDECEC', color: '#B42318', label: 'Missed' }
    case 'cancelled': return { bg: '#F3F4F6', color: '#9CA3AF', label: 'Cancelled' }
    default: return { bg: '#F3F4F6', color: '#6B7280', label: status }
  }
}

function tsStatusColor(status: string) {
  switch (status) {
    case 'approved': return { bg: '#E9F7F0', color: '#047857', label: 'Approved' }
    case 'submitted': return { bg: '#FFF5D9', color: '#D97706', label: 'Submitted' }
    case 'rejected': return { bg: '#FDECEC', color: '#B42318', label: 'Rejected' }
    case 'draft': return { bg: '#F3F4F6', color: '#6B7280', label: 'Draft' }
    default: return { bg: '#F3F4F6', color: '#6B7280', label: status }
  }
}

function getMonthRange(monthsBack = 0) {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1)
  const to = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 0, 23, 59, 59)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

/* ── Main Page ── */
export default function CarerTotalsPage() {
  const [totals, setTotals] = useState<CarerTotal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [from, setFrom] = useState(() => getMonthRange().from)
  const [to, setTo] = useState(() => getMonthRange().to)

  // Drill-down state
  const [view, setView] = useState<'overview' | 'carer-detail' | 'pending-approvals'>('overview')
  const [selectedCarer, setSelectedCarer] = useState<CarerTotal | null>(null)
  const [carerVisits, setCarerVisits] = useState<VisitDetail[]>([])
  const [carerLoading, setCarerLoading] = useState(false)
  const [pendingVisits, setPendingVisits] = useState<PendingTimesheet[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)

  // Pagination
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)

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

  /* ── Drill-down: Carer visits ── */
  const loadCarerDetail = useCallback(async (carer: CarerTotal) => {
    setSelectedCarer(carer)
    setCarerLoading(true)
    setView('carer-detail')
    try {
      const res = await api.get(`/homecare/timesheets/carer/${carer.staff_id}?from=${from}&to=${to}`)
      setCarerVisits(res.data)
    } catch {
      setCarerVisits([])
    } finally { setCarerLoading(false) }
  }, [from, to])

  /* ── Drill-down: Pending approvals ── */
  const loadPendingApprovals = useCallback(async () => {
    setPendingLoading(true)
    setView('pending-approvals')
    try {
      const res = await api.get(`/homecare/timesheets/pending?from=${from}&to=${to}`)
      setPendingVisits(res.data)
    } catch {
      setPendingVisits([])
    } finally { setPendingLoading(false) }
  }, [from, to])

  /* ── Approve/Reject timesheet ── */
  const handleTimesheetAction = async (timesheetId: string, action: 'approved' | 'rejected') => {
    try {
      await api.patch(`/homecare/timesheets/${timesheetId}`, { status: action })
      setPendingVisits(prev => prev.filter(v => v.timesheet_id !== timesheetId))
      load() // refresh totals
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update timesheet')
    }
  }

  /* ── Export CSV ── */
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

  const goBack = () => {
    setView('overview')
    setSelectedCarer(null)
    setCarerVisits([])
    setPendingVisits([])
  }

  /* ────────────── RENDER ────────────── */
  return (
    <Box sx={{ maxWidth: 'var(--container-standard)', mx: 'auto' }}>
      {/* Header */}
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" gap={1.5}>
          {view !== 'overview' && (
            <IconButton onClick={goBack} sx={{ color: '#0F4C81' }}><BackIcon /></IconButton>
          )}
          <TrendingIcon sx={{ color: '#10b981', fontSize: 28 }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              {view === 'carer-detail' ? selectedCarer?.staff_name || 'Carer Details' :
               view === 'pending-approvals' ? 'Pending Approvals' :
               'Carer Monthly Totals'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#6B7280' }}>
              {view === 'carer-detail' ? `${fmtDate(from)} — ${fmtDate(to)}` :
               view === 'pending-approvals' ? `${pendingVisits.length} timesheet${pendingVisits.length !== 1 ? 's' : ''} awaiting review` :
               'Per-carer summary of paid minutes, travel, mileage and gross pay'}
            </Typography>
          </Box>
        </Stack>
        {view === 'overview' && (
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv} disabled={!totals.length} sx={{ textTransform: 'none', borderColor: '#E5E7EB', color: '#374151' }}>
            Export CSV
          </Button>
        )}
      </Stack>

      {/* Date filters (overview only) */}
      {view === 'overview' && (
        <Stack direction="row" gap={2} mb={3} alignItems="flex-end" flexWrap="wrap">
          <TextField label="From" type="date" size="small" value={from} onChange={e => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="To" type="date" size="small" value={to} onChange={e => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Button variant="contained" onClick={load} disabled={loading} sx={{ textTransform: 'none', bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0D3D6B' } }}>Load</Button>
          <Button variant="text" onClick={() => { const r = getMonthRange(); setFrom(r.from); setTo(r.to) }} sx={{ textTransform: 'none', color: '#0F4C81' }}>This month</Button>
          <Button variant="text" onClick={() => { const r = getMonthRange(1); setFrom(r.from); setTo(r.to) }} sx={{ textTransform: 'none', color: '#0F4C81' }}>Last month</Button>
        </Stack>
      )}

      {error && <Typography color="error" mb={2}>{error}</Typography>}

      {/* ═══════════ OVERVIEW ═══════════ */}
      {view === 'overview' && (
        <>
          {/* Summary cards — clickable */}
          <Stack direction="row" gap={2} mb={3} flexWrap="wrap">
            <Paper
              elevation={0}
              sx={{ p: 2.5, flex: '1 1 140px', minWidth: 140, textAlign: 'center', border: '1px solid #E5E7EB', borderRadius: 3, cursor: 'default' }}
            >
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F4C81' }}>{totals.length}</Typography>
              <Typography variant="caption" sx={{ color: '#6B7280' }}>Carers</Typography>
            </Paper>
            <Paper elevation={0} sx={{ p: 2.5, flex: '1 1 140px', minWidth: 140, textAlign: 'center', border: '1px solid #E5E7EB', borderRadius: 3, cursor: 'default' }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#10b981' }}>{fmtHours(grandWork)}</Typography>
              <Typography variant="caption" sx={{ color: '#6B7280' }}>Total paid time</Typography>
            </Paper>
            <Paper elevation={0} sx={{ p: 2.5, flex: '1 1 140px', minWidth: 140, textAlign: 'center', border: '1px solid #E5E7EB', borderRadius: 3, cursor: 'default' }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#3b82f6' }}>{fmtHours(grandTravel)}</Typography>
              <Typography variant="caption" sx={{ color: '#6B7280' }}>Travel time</Typography>
            </Paper>
            <Paper elevation={0} sx={{ p: 2.5, flex: '1 1 140px', minWidth: 140, textAlign: 'center', border: '1px solid #E5E7EB', borderRadius: 3, cursor: 'default' }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#8b5cf6' }}>{fmtMiles(grandMileage)}</Typography>
              <Typography variant="caption" sx={{ color: '#6B7280' }}>Mileage</Typography>
            </Paper>
            <Paper elevation={0} sx={{ p: 2.5, flex: '1 1 140px', minWidth: 140, textAlign: 'center', border: '1px solid #E5E7EB', borderRadius: 3, cursor: 'default' }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F4C81' }}>{fmtPence(grandGross)}</Typography>
              <Typography variant="caption" sx={{ color: '#6B7280' }}>Gross pay</Typography>
            </Paper>
            <Paper elevation={0} sx={{ p: 2.5, flex: '1 1 140px', minWidth: 140, textAlign: 'center', border: '1px solid #E5E7EB', borderRadius: 3, cursor: 'default' }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: grandExceptions > 0 ? '#DC2626' : '#10b981' }}>{grandExceptions}</Typography>
              <Typography variant="caption" sx={{ color: '#6B7280' }}>Exceptions</Typography>
            </Paper>
            <Paper
              elevation={0}
              onClick={grandPending > 0 ? loadPendingApprovals : undefined}
              sx={{
                p: 2.5, flex: '1 1 140px', minWidth: 140, textAlign: 'center',
                border: grandPending > 0 ? '2px solid #D97706' : '1px solid #E5E7EB',
                borderRadius: 3,
                cursor: grandPending > 0 ? 'pointer' : 'default',
                transition: 'all 0.15s ease',
                '&:hover': grandPending > 0 ? { bgcolor: '#FFFBEB', transform: 'translateY(-1px)' } : {},
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="center" gap={0.5}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: grandPending > 0 ? '#D97706' : '#10b981' }}>{grandPending}</Typography>
                {grandPending > 0 && <PendingCheckIcon sx={{ color: '#D97706', fontSize: 18 }} />}
              </Stack>
              <Typography variant="caption" sx={{ color: '#6B7280' }}>
                {grandPending > 0 ? 'Click to review' : 'Awaiting approval'}
              </Typography>
            </Paper>
          </Stack>

          {/* Carer table */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
          ) : totals.length === 0 ? (
            <Paper elevation={0} sx={{ p: 6, textAlign: 'center', border: '1px solid #E5E7EB', borderRadius: 3 }}>
              <ReceiptIcon sx={{ fontSize: 48, color: '#D1D5DB', mb: 1 }} />
              <Typography sx={{ color: '#6B7280' }}>No timesheet data for this period</Typography>
            </Paper>
          ) : (
            <>
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 3 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, color: '#374151' }}>Carer</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#374151' }}>Visits</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#374151' }}>Paid time</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#374151' }}>Travel</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#374151' }}>Mileage</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#374151' }}>Gross pay</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#374151' }}>Approved</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#374151' }}>Pending</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#374151' }}>Rejected</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#374151' }}>Exceptions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {totals.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(t => (
                      <TableRow
                        key={t.staff_id}
                        hover
                        onClick={() => loadCarerDetail(t)}
                        sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#F8FAFC' } }}
                      >
                        <TableCell>
                          <Stack direction="row" alignItems="center" gap={1}>
                            <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <PersonIcon sx={{ color: '#0F4C81', fontSize: 20 }} />
                            </Box>
                            <Typography sx={{ fontWeight: 600 }}>{t.staff_name}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell align="right">{t.visit_count}</TableCell>
                        <TableCell align="right">{fmtHours(Number(t.total_work_minutes || 0))}</TableCell>
                        <TableCell align="right">{fmtHours(Number(t.total_paid_travel_minutes || 0))}</TableCell>
                        <TableCell align="right">{fmtMiles(t.total_mileage_miles)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtPence(t.total_gross_pay_pence)}</TableCell>
                        <TableCell align="right">
                          <Chip label={t.approved_count} size="small" sx={{ bgcolor: '#E9F7F0', color: '#047857', fontWeight: 600 }} />
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            label={t.pending_count}
                            size="small"
                            onClick={t.pending_count > 0 ? (e) => { e.stopPropagation(); loadPendingApprovals() } : undefined}
                            sx={{
                              bgcolor: t.pending_count > 0 ? '#FFF5D9' : '#F5F5F5',
                              color: t.pending_count > 0 ? '#D97706' : '#9CA3AF',
                              fontWeight: 600,
                              cursor: t.pending_count > 0 ? 'pointer' : 'default',
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Chip label={t.rejected_count} size="small" sx={{ bgcolor: t.rejected_count > 0 ? '#FDECEC' : '#F5F5F5', color: t.rejected_count > 0 ? '#B42318' : '#9CA3AF', fontWeight: 600 }} />
                        </TableCell>
                        <TableCell align="right">
                          {Number(t.exception_count) > 0 ? (
                            <Chip icon={<WarningIcon sx={{ fontSize: 16 }} />} label={t.exception_count} size="small" sx={{ bgcolor: '#FDECEC', color: '#B42318', fontWeight: 600 }} />
                          ) : (
                            <Chip label="0" size="small" sx={{ bgcolor: '#E9F7F0', color: '#047857' }} />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination */}
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2, px: 1 }}>
                <Typography variant="body2" sx={{ color: '#6B7280' }}>
                  Showing {page * rowsPerPage + 1}–{Math.min((page + 1) * rowsPerPage, totals.length)} of {totals.length} carers
                </Typography>
                <Stack direction="row" gap={1} alignItems="center">
                  <TextField
                    select
                    size="small"
                    value={rowsPerPage}
                    onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(0) }}
                    sx={{ width: 80 }}
                    SelectProps={{ native: true }}
                  >
                    {[5, 10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
                  </TextField>
                  <Button size="small" disabled={page === 0} onClick={() => setPage(p => p - 1)} sx={{ textTransform: 'none' }}>Previous</Button>
                  <Button size="small" disabled={(page + 1) * rowsPerPage >= totals.length} onClick={() => setPage(p => p + 1)} sx={{ textTransform: 'none' }}>Next</Button>
                </Stack>
              </Stack>
            </>
          )}
        </>
      )}

      {/* ═══════════ CARER DETAIL ═══════════ */}
      {view === 'carer-detail' && selectedCarer && (
        <>
          {/* Carer summary cards */}
          <Stack direction="row" gap={2} mb={3} flexWrap="wrap">
            <Paper elevation={0} sx={{ p: 2.5, flex: '1 1 160px', minWidth: 160, border: '1px solid #E5E7EB', borderRadius: 3 }}>
              <Stack direction="row" alignItems="center" gap={1}>
                <PersonIcon sx={{ color: '#0F4C81', fontSize: 20 }} />
                <Typography variant="caption" sx={{ color: '#6B7280' }}>Visits</Typography>
              </Stack>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F4C81', mt: 0.5 }}>{selectedCarer.visit_count}</Typography>
            </Paper>
            <Paper elevation={0} sx={{ p: 2.5, flex: '1 1 160px', minWidth: 160, border: '1px solid #E5E7EB', borderRadius: 3 }}>
              <Stack direction="row" alignItems="center" gap={1}>
                <ClockIcon sx={{ color: '#10b981', fontSize: 20 }} />
                <Typography variant="caption" sx={{ color: '#6B7280' }}>Paid time</Typography>
              </Stack>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#10b981', mt: 0.5 }}>{fmtHours(Number(selectedCarer.total_work_minutes || 0))}</Typography>
            </Paper>
            <Paper elevation={0} sx={{ p: 2.5, flex: '1 1 160px', minWidth: 160, border: '1px solid #E5E7EB', borderRadius: 3 }}>
              <Stack direction="row" alignItems="center" gap={1}>
                <CarIcon sx={{ color: '#3b82f6', fontSize: 20 }} />
                <Typography variant="caption" sx={{ color: '#6B7280' }}>Travel</Typography>
              </Stack>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#3b82f6', mt: 0.5 }}>{fmtHours(Number(selectedCarer.total_paid_travel_minutes || 0))}</Typography>
            </Paper>
            <Paper elevation={0} sx={{ p: 2.5, flex: '1 1 160px', minWidth: 160, border: '1px solid #E5E7EB', borderRadius: 3 }}>
              <Stack direction="row" alignItems="center" gap={1}>
                <MoneyIcon sx={{ color: '#8b5cf6', fontSize: 20 }} />
                <Typography variant="caption" sx={{ color: '#6B7280' }}>Gross pay</Typography>
              </Stack>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#8b5cf6', mt: 0.5 }}>{fmtPence(selectedCarer.total_gross_pay_pence)}</Typography>
            </Paper>
          </Stack>

          {carerLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
          ) : carerVisits.length === 0 ? (
            <Paper elevation={0} sx={{ p: 6, textAlign: 'center', border: '1px solid #E5E7EB', borderRadius: 3 }}>
              <ReceiptIcon sx={{ fontSize: 48, color: '#D1D5DB', mb: 1 }} />
              <Typography sx={{ color: '#6B7280' }}>No visits for this carer in this period</Typography>
            </Paper>
          ) : (
            <Stack gap={2}>
              {carerVisits.map(v => {
                const sc = statusColor(v.status)
                const tc = tsStatusColor(v.timesheet_status || 'draft')
                const breakMinutes = v.work_minutes != null && v.actual_travel_minutes != null
                  ? Math.max(0, (v.work_minutes || 0) + (v.paid_travel_minutes || 0) - (
                      v.scheduled_end && v.scheduled_start
                        ? Math.round((new Date(v.scheduled_end).getTime() - new Date(v.scheduled_start).getTime()) / 60000)
                        : 0
                    ))
                  : null
                const durationMinutes = v.scheduled_end && v.scheduled_start
                  ? Math.round((new Date(v.scheduled_end).getTime() - new Date(v.scheduled_start).getTime()) / 60000)
                  : null
                const actualDurationMinutes = v.check_in_at && v.check_out_at
                  ? Math.round((new Date(v.check_out_at).getTime() - new Date(v.check_in_at).getTime()) / 60000)
                  : null

                return (
                  <Paper key={v.id} elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                    {/* Header row */}
                    <Box sx={{ p: 2.5, display: 'flex', flexWrap: 'wrap', gap: 'var(--card-gap)', alignItems: 'center' }}>
                      <Box sx={{ flex: '1 1 200px' }}>
                        <Stack direction="row" alignItems="center" gap={1}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{v.label || v.visit_type}</Typography>
                          <Chip label={sc.label} size="small" sx={{ bgcolor: sc.bg, color: sc.color, fontWeight: 600 }} />
                          {v.exception_type && (
                            <Chip label={v.exception_type} size="small" sx={{ bgcolor: '#FDECEC', color: '#B42318', fontWeight: 600 }} />
                          )}
                        </Stack>
                        <Typography variant="body2" sx={{ color: '#6B7280', mt: 0.25 }}>{v.person_name}{v.person_address ? ` · ${v.person_address}` : ''}</Typography>
                      </Box>
                      <Stack direction="row" gap={2} flexWrap="wrap">
                        <Box sx={{ textAlign: 'center', minWidth: 80 }}>
                          <Typography variant="caption" sx={{ color: '#9CA3AF' }}>Date</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{fmtDate(v.scheduled_start)}</Typography>
                        </Box>
                        <Box sx={{ textAlign: 'center', minWidth: 80 }}>
                          <Typography variant="caption" sx={{ color: '#9CA3AF' }}>Scheduled</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{fmtTime(v.scheduled_start)} – {fmtTime(v.scheduled_end)}</Typography>
                        </Box>
                        <Box sx={{ textAlign: 'center', minWidth: 80 }}>
                          <Typography variant="caption" sx={{ color: '#9CA3AF' }}>Actual</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: v.check_in_at ? '#374151' : '#D1D5DB' }}>
                            {v.check_in_at ? `${fmtTime(v.check_in_at)} – ${v.check_out_at ? fmtTime(v.check_out_at) : 'ongoing'}` : '—'}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'center', minWidth: 80 }}>
                          <Typography variant="caption" sx={{ color: '#9CA3AF' }}>Pay</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F4C81' }}>{v.gross_pay_pence != null ? fmtPence(v.gross_pay_pence) : '—'}</Typography>
                        </Box>
                      </Stack>
                    </Box>

                    {/* Detail chips row */}
                    <Box sx={{ px: 2.5, pb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {v.work_minutes != null && (
                        <Chip size="small" label={`Work: ${fmtHours(v.work_minutes)}`} sx={{ bgcolor: '#F0FDF4', color: '#166534', fontWeight: 500 }} />
                      )}
                      {v.paid_travel_minutes != null && (
                        <Chip size="small" label={`Travel: ${fmtHours(v.paid_travel_minutes)}`} sx={{ bgcolor: '#EFF6FF', color: '#1E40AF', fontWeight: 500 }} />
                      )}
                      {v.mileage_miles != null && (
                        <Chip size="small" label={`Mileage: ${fmtMiles(v.mileage_miles)}`} sx={{ bgcolor: '#F5F3FF', color: '#5B21B6', fontWeight: 500 }} />
                      )}
                      {breakMinutes != null && breakMinutes > 0 && (
                        <Chip size="small" label={`Break: ${fmtHours(breakMinutes)}`} sx={{ bgcolor: '#FFF7ED', color: '#9A3412', fontWeight: 500 }} />
                      )}
                      {durationMinutes != null && (
                        <Chip size="small" label={`Duration: ${fmtHours(durationMinutes)}`} sx={{ bgcolor: '#F8FAFC', color: '#475569', fontWeight: 500 }} />
                      )}
                      {actualDurationMinutes != null && actualDurationMinutes !== durationMinutes && (
                        <Chip size="small" label={`Actual: ${fmtHours(actualDurationMinutes)}`} sx={{ bgcolor: actualDurationMinutes > (durationMinutes || 0) ? '#FEF2F2' : '#F0FDF4', color: actualDurationMinutes > (durationMinutes || 0) ? '#991B1B' : '#166534', fontWeight: 500 }} />
                      )}
                      {v.tasks_total != null && v.tasks_total > 0 && (
                        <Chip size="small" label={`Tasks: ${v.tasks_completed}/${v.tasks_total}`} sx={{ bgcolor: v.tasks_completed === v.tasks_total ? '#F0FDF4' : '#FFFBEB', color: v.tasks_completed === v.tasks_total ? '#166534' : '#92400E', fontWeight: 500 }} />
                      )}
                      <Chip label={tc.label} size="small" sx={{ bgcolor: tc.bg, color: tc.color, fontWeight: 600 }} />
                    </Box>

                    {/* Care notes section */}
                    {(v.visit_notes || v.progress_notes || v.care_plan_notes || v.wellbeing_notes || v.client_mood || v.personal_care || v.fluid_intake_ml) && (
                      <Box sx={{ px: 2.5, pb: 2 }}>
                        <Box sx={{ borderTop: '1px solid #F1F5F9', pt: 2 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#374151', mb: 1 }}>Care Notes</Typography>
                          <Stack gap={1.5}>
                            {v.visit_notes && (
                              <Box>
                                <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Visit Notes</Typography>
                                <Typography variant="body2" sx={{ color: '#374151', whiteSpace: 'pre-wrap', mt: 0.25 }}>{v.visit_notes}</Typography>
                              </Box>
                            )}
                            {v.progress_notes && (
                              <Box>
                                <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Progress Notes</Typography>
                                <Typography variant="body2" sx={{ color: '#374151', whiteSpace: 'pre-wrap', mt: 0.25 }}>{v.progress_notes}</Typography>
                              </Box>
                            )}
                            {v.care_plan_notes && (
                              <Box>
                                <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Care Plan Notes</Typography>
                                <Typography variant="body2" sx={{ color: '#374151', whiteSpace: 'pre-wrap', mt: 0.25 }}>{v.care_plan_notes}</Typography>
                              </Box>
                            )}
                            {v.wellbeing_notes && (
                              <Box>
                                <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Wellbeing</Typography>
                                <Typography variant="body2" sx={{ color: '#374151', whiteSpace: 'pre-wrap', mt: 0.25 }}>{v.wellbeing_notes}</Typography>
                              </Box>
                            )}
                            <Stack direction="row" gap={2} flexWrap="wrap">
                              {v.client_mood && (
                                <Box>
                                  <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Mood</Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#374151', mt: 0.25 }}>{v.client_mood}</Typography>
                                </Box>
                              )}
                              {v.personal_care && (
                                <Box>
                                  <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Personal Care</Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#374151', mt: 0.25 }}>{v.personal_care}</Typography>
                                </Box>
                              )}
                              {v.fluid_intake_ml != null && (
                                <Box>
                                  <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Fluid Intake</Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#374151', mt: 0.25 }}>{v.fluid_intake_ml} ml</Typography>
                                </Box>
                              )}
                            </Stack>
                          </Stack>
                        </Box>
                      </Box>
                    )}

                    {/* Location data */}
                    {(v.check_in_latitude || v.check_out_latitude) && (
                      <Box sx={{ px: 2.5, pb: 2 }}>
                        <Box sx={{ borderTop: '1px solid #F1F5F9', pt: 2 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#374151', mb: 1 }}>Location Data</Typography>
                          <Stack direction="row" gap={3} flexWrap="wrap">
                            {v.check_in_latitude && v.check_in_longitude && (
                              <Box>
                                <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Check-in GPS</Typography>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#374151', mt: 0.25 }}>{Number(v.check_in_latitude).toFixed(6)}, {Number(v.check_in_longitude).toFixed(6)}</Typography>
                                {v.check_in_accuracy_meters != null && (
                                  <Typography variant="caption" sx={{ color: '#9CA3AF' }}>Accuracy: ±{Math.round(v.check_in_accuracy_meters)}m</Typography>
                                )}
                              </Box>
                            )}
                            {v.check_out_latitude && v.check_out_longitude && (
                              <Box>
                                <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Check-out GPS</Typography>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#374151', mt: 0.25 }}>{Number(v.check_out_latitude).toFixed(6)}, {Number(v.check_out_longitude).toFixed(6)}</Typography>
                              </Box>
                            )}
                          </Stack>
                        </Box>
                      </Box>
                    )}

                    {/* Late reason / exception */}
                    {(v.late_reason || v.rejection_reason) && (
                      <Box sx={{ px: 2.5, pb: 2 }}>
                        <Box sx={{ borderTop: '1px solid #F1F5F9', pt: 2 }}>
                          {v.late_reason && (
                            <Box sx={{ mb: 1 }}>
                              <Typography variant="caption" sx={{ color: '#D97706', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Late Reason</Typography>
                              <Typography variant="body2" sx={{ color: '#374151', whiteSpace: 'pre-wrap', mt: 0.25 }}>{v.late_reason}</Typography>
                            </Box>
                          )}
                          {v.rejection_reason && (
                            <Box>
                              <Typography variant="caption" sx={{ color: '#DC2626', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Timesheet Rejected</Typography>
                              <Typography variant="body2" sx={{ color: '#374151', whiteSpace: 'pre-wrap', mt: 0.25 }}>{v.rejection_reason}</Typography>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    )}
                  </Paper>
                )
              })}
            </Stack>
          )}
        </>
      )}

      {/* ═══════════ PENDING APPROVALS ═══════════ */}
      {view === 'pending-approvals' && (
        <>
          {pendingLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
          ) : pendingVisits.length === 0 ? (
            <Paper elevation={0} sx={{ p: 6, textAlign: 'center', border: '1px solid #E5E7EB', borderRadius: 3 }}>
              <CheckIcon sx={{ fontSize: 48, color: '#10b981', mb: 1 }} />
              <Typography sx={{ color: '#6B7280' }}>All timesheets have been reviewed</Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 3 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: '#374151' }}>Carer</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#374151' }}>Visit</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#374151' }}>Client</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#374151' }}>Date</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#374151' }}>Work</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#374151' }}>Travel</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#374151' }}>Mileage</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#374151' }}>Pay</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, color: '#374151' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingVisits.map(v => (
                    <TableRow key={v.timesheet_id} hover>
                      <TableCell>
                        <Stack direction="row" alignItems="center" gap={1}>
                          <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <PersonIcon sx={{ color: '#0F4C81', fontSize: 18 }} />
                          </Box>
                          <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{v.staff_name}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: '0.875rem' }}>{v.visit_label}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: '0.875rem' }}>{v.person_name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: '0.875rem' }}>{fmtDateTime(v.scheduled_start)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography sx={{ fontSize: '0.875rem' }}>{fmtHours(v.work_minutes)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography sx={{ fontSize: '0.875rem' }}>{fmtHours(v.paid_travel_minutes)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography sx={{ fontSize: '0.875rem' }}>{fmtMiles(v.mileage_miles)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography sx={{ fontWeight: 700, fontSize: '0.875rem' }}>{fmtPence(v.gross_pay_pence)}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" gap={1} justifyContent="center">
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => handleTimesheetAction(v.timesheet_id, 'approved')}
                            sx={{ textTransform: 'none', bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' }, minWidth: 0, px: 1.5 }}
                          >
                            Approve
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleTimesheetAction(v.timesheet_id, 'rejected')}
                            sx={{ textTransform: 'none', borderColor: '#E5E7EB', color: '#DC2626', minWidth: 0, px: 1.5 }}
                          >
                            Reject
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}
    </Box>
  )
}
