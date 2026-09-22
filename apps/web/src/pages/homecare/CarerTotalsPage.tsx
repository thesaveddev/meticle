import { useEffect, useState, useCallback } from 'react'
import {
  Box, Button, Chip, CircularProgress, IconButton, Paper, Stack,
  TextField, Typography, Collapse,
} from '@mui/material'
import {
  Receipt as ReceiptIcon, TrendingUp as TrendingIcon, Download as DownloadIcon,
  Warning as WarningIcon, ArrowBack as BackIcon, CheckCircle as CheckIcon,
  Person as PersonIcon, DirectionsCar as CarIcon,
  AttachMoney as MoneyIcon, CheckCircleOutline as PendingCheckIcon,
  ExpandMore as ExpandIcon, ExpandLess as CollapseIcon,
  AccessTime as TimeIcon, MapOutlined as MileageIcon,
} from '@mui/icons-material'
import PageContainer from '../../components/design/PageContainer'
import api from '../../services/api'

/* ── Types ── */
interface CarerTotal {
  staff_id: string; staff_name: string; visit_count: number
  total_work_minutes: number; total_travel_minutes: number; total_paid_travel_minutes: number
  total_mileage_miles: number; total_gross_pay_pence: number; approved_gross_pence: number
  pending_count: number; approved_count: number; rejected_count: number; exception_count: number
}

interface VisitDetail {
  id: string; label: string; visit_type: string; scheduled_start: string; scheduled_end: string
  status: string; check_in_at: string | null; check_out_at: string | null
  check_in_latitude: number | null; check_in_longitude: number | null; check_in_accuracy_meters: number | null
  check_out_latitude: number | null; check_out_longitude: number | null
  actual_travel_minutes: number | null; actual_mileage_miles: number | null
  visit_notes: string | null; progress_notes: string | null; care_plan_notes: string | null
  client_mood: string | null; wellbeing_notes: string | null; personal_care: string | null
  fluid_intake_ml: number | null; exception_type: string | null; late_reason: string | null
  person_name: string; person_address: string | null
  timesheet_id: string | null; work_minutes: number | null; travel_minutes: number | null
  paid_travel_minutes: number | null; mileage_miles: number | null
  mileage_rate_pence: number | null; hourly_rate_pence: number | null; gross_pay_pence: number | null
  timesheet_status: string | null; submitted_at: string | null; approved_at: string | null
  rejection_reason: string | null; tasks_total: number | null; tasks_completed: number | null
}

interface PendingTimesheet {
  timesheet_id: string; work_minutes: number; travel_minutes: number; paid_travel_minutes: number
  mileage_miles: number; gross_pay_pence: number; timesheet_status: string; submitted_at: string
  staff_name: string; staff_id: string; visit_label: string; scheduled_start: string
  scheduled_end: string; person_name: string
}

/* ── Helpers ── */
const fmtP = (p: number) => `£${(Number(p || 0) / 100).toFixed(2)}`
const fmtH = (m: number) => { const mins = Number(m || 0); const h = Math.floor(mins / 60); const min = mins % 60; return h > 0 ? `${h}h ${min}m` : `${min}m` }
const fmtM = (m: number) => `${Number(m || 0).toFixed(1)} mi`
const fmtD = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const fmtT = (d: string) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const displayText = (value: unknown, fallback = '—') => {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return fallback
}
const normaliseCarerTotal = (row: any): CarerTotal => ({
  ...row,
  staff_id: displayText(row?.staff_id, ''),
  staff_name: displayText(row?.staff_name, 'Unnamed carer'),
  visit_count: Number(row?.visit_count || 0),
  total_work_minutes: Number(row?.total_work_minutes || 0),
  total_travel_minutes: Number(row?.total_travel_minutes || 0),
  total_paid_travel_minutes: Number(row?.total_paid_travel_minutes || 0),
  total_mileage_miles: Number(row?.total_mileage_miles || 0),
  total_gross_pay_pence: Number(row?.total_gross_pay_pence || 0),
  approved_gross_pence: Number(row?.approved_gross_pence || 0),
  pending_count: Number(row?.pending_count || 0),
  approved_count: Number(row?.approved_count || 0),
  rejected_count: Number(row?.rejected_count || 0),
  exception_count: Number(row?.exception_count || 0),
})

function getMonthRange(monthsBack = 0) {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1)
  const to = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 0, 23, 59, 59)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

/* ── Stat Card ── */
function StatCard({ icon, label, value, color, onClick, accent }: {
  icon: React.ReactNode; label: string; value: string | number; color: string
  onClick?: () => void; accent?: boolean
}) {
  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        p: 2, flex: '1 1 120px', minWidth: 120, textAlign: 'center',
        border: accent ? `2px solid ${color}` : '1px solid #F1F5F9',
        borderRadius: 2.5, cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s',
        '&:hover': onClick ? { bgcolor: '#F8FAFC', transform: 'translateY(-1px)', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' } : {},
      }}
    >
      <Stack alignItems="center" spacing={0.5}>
        <Box sx={{ color, mb: 0.5 }}>{icon}</Box>
        <Typography sx={{ fontSize: '1.35rem', fontWeight: 800, color, letterSpacing: '-0.02em' }}>{value}</Typography>
        <Typography sx={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 500 }}>{label}</Typography>
      </Stack>
    </Paper>
  )
}

/* ── Carer Card ── */
function CarerCard({ carer, onClick }: { carer: CarerTotal; onClick: () => void }) {
  const hasIssues = carer.exception_count > 0 || carer.rejected_count > 0
  const initials = displayText(carer.staff_name, 'UC').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        p: 2.5, border: '1px solid #F1F5F9', borderRadius: 2.5,
        cursor: 'pointer', transition: 'all 0.15s',
        '&:hover': { borderColor: '#CBD5E1', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', transform: 'translateY(-1px)' },
      }}
    >
      <Stack direction="row" alignItems="center" gap={2} sx={{ mb: 2 }}>
        <Box sx={{
          width: 40, height: 40, borderRadius: '50%', bgcolor: '#EFF6FF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: '0.8rem', color: '#1D4ED8',
        }}>{initials}</Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{carer.staff_name}</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#94A3B8' }}>{carer.visit_count} visits</Typography>
        </Box>
        {hasIssues && (
          <Chip icon={<WarningIcon sx={{ fontSize: 14 }} />} label="Issues" size="small"
            sx={{ bgcolor: '#FEF2F2', color: '#B91C1C', fontWeight: 600, fontSize: '0.7rem' }} />
        )}
      </Stack>

      <Stack direction="row" gap={1.5} flexWrap="wrap">
        <Chip icon={<TimeIcon sx={{ fontSize: 13 }} />} label={fmtH(Number(carer.total_work_minutes || 0))} size="small"
          sx={{ bgcolor: '#F0FDF4', color: '#166534', fontWeight: 600, fontSize: '0.7rem' }} />
        <Chip icon={<CarIcon sx={{ fontSize: 13 }} />} label={fmtH(Number(carer.total_paid_travel_minutes || 0))} size="small"
          sx={{ bgcolor: '#EFF6FF', color: '#1E40AF', fontWeight: 600, fontSize: '0.7rem' }} />
        <Chip icon={<MileageIcon sx={{ fontSize: 13 }} />} label={fmtM(carer.total_mileage_miles)} size="small"
          sx={{ bgcolor: '#F5F3FF', color: '#5B21B6', fontWeight: 600, fontSize: '0.7rem' }} />
        <Chip icon={<MoneyIcon sx={{ fontSize: 13 }} />} label={fmtP(carer.total_gross_pay_pence)} size="small"
          sx={{ bgcolor: '#F0FDF4', color: '#047857', fontWeight: 700, fontSize: '0.7rem' }} />
      </Stack>

      <Stack direction="row" gap={1} sx={{ mt: 1.5 }} alignItems="center">
        <Box sx={{ flex: 1, display: 'flex', gap: 0.5 }}>
          {carer.approved_count > 0 && (
            <Chip label={`${carer.approved_count} approved`} size="small"
              sx={{ bgcolor: '#ECFDF5', color: '#047857', fontWeight: 600, fontSize: '0.65rem', height: 22 }} />
          )}
          {carer.pending_count > 0 && (
            <Chip label={`${carer.pending_count} pending`} size="small"
              sx={{ bgcolor: '#FFFBEB', color: '#D97706', fontWeight: 600, fontSize: '0.65rem', height: 22 }} />
          )}
          {carer.rejected_count > 0 && (
            <Chip label={`${carer.rejected_count} rejected`} size="small"
              sx={{ bgcolor: '#FEF2F2', color: '#B91C1C', fontWeight: 600, fontSize: '0.65rem', height: 22 }} />
          )}
        </Box>
        <Typography sx={{ fontSize: '0.7rem', color: '#94A3B8' }}>View details →</Typography>
      </Stack>
    </Paper>
  )
}

/* ═══════ Main Page ═══════ */
export default function CarerTotalsPage() {
  const [totals, setTotals] = useState<CarerTotal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [from, setFrom] = useState(() => getMonthRange().from)
  const [to, setTo] = useState(() => getMonthRange().to)

  const [view, setView] = useState<'overview' | 'carer-detail' | 'pending-approvals'>('overview')
  const [selectedCarer, setSelectedCarer] = useState<CarerTotal | null>(null)
  const [carerVisits, setCarerVisits] = useState<VisitDetail[]>([])
  const [carerLoading, setCarerLoading] = useState(false)
  const [pendingVisits, setPendingVisits] = useState<PendingTimesheet[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const [payslipBusy, setPayslipBusy] = useState(false)
  const [expandedVisit, setExpandedVisit] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 10

  const load = async () => {
    setLoading(true); setError('')
    try {
      const res = await api.get(`/homecare/timesheets/monthly-totals?from=${from}&to=${to}`)
      const rows = Array.isArray(res.data) ? res.data : []
      setTotals(rows.map(normaliseCarerTotal))
    } catch (err: any) { setError(err.response?.data?.message || 'Failed to load carer totals') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [from, to])

  const grandWork = totals.reduce((s, t) => s + Number(t.total_work_minutes || 0), 0)
  const grandTravel = totals.reduce((s, t) => s + Number(t.total_paid_travel_minutes || 0), 0)
  const grandMileage = totals.reduce((s, t) => s + Number(t.total_mileage_miles || 0), 0)
  const grandGross = totals.reduce((s, t) => s + Number(t.total_gross_pay_pence || 0), 0)
  const grandExceptions = totals.reduce((s, t) => s + Number(t.exception_count || 0), 0)
  const grandPending = totals.reduce((s, t) => s + Number(t.pending_count || 0), 0)

  const loadCarerDetail = useCallback(async (carer: CarerTotal) => {
    setSelectedCarer(carer); setCarerLoading(true); setView('carer-detail')
    try {
      const res = await api.get(`/homecare/timesheets/carer/${carer.staff_id}?from=${from}&to=${to}`)
      setCarerVisits(res.data || [])
    } catch (err: any) { setError(err.response?.data?.message || 'Failed to load carer details'); setCarerVisits([]) }
    finally { setCarerLoading(false) }
  }, [from, to])

  const loadPendingApprovals = useCallback(async () => {
    setPendingLoading(true); setView('pending-approvals')
    try {
      const res = await api.get(`/homecare/timesheets/pending?from=${from}&to=${to}`)
      setPendingVisits(res.data || [])
    } catch (err: any) { setError(err.response?.data?.message || 'Failed to load pending timesheets'); setPendingVisits([]) }
    finally { setPendingLoading(false) }
  }, [from, to])

  const handleTimesheetAction = async (timesheetId: string, action: 'approved' | 'rejected') => {
    try {
      await api.patch(`/homecare/timesheets/${timesheetId}`, { status: action })
      setPendingVisits(prev => prev.filter(v => v.timesheet_id !== timesheetId))
      load()
    } catch (err: any) { alert(err.response?.data?.message || 'Failed to update timesheet') }
  }

  const downloadCarerPayslip = async () => {
    if (!selectedCarer) return
    setPayslipBusy(true); setError('')
    try {
      const res = await api.get('/homecare/my-payslip', {
        params: { from, to, staffId: selectedCarer.staff_id }, responseType: 'blob',
      })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const link = document.createElement('a'); link.href = url
      link.download = `payslip-${displayText(selectedCarer.staff_name, 'carer').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()}-${from.slice(0, 7)}.pdf`
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err.response?.data instanceof Blob ? 'Could not create this payslip' : err.response?.data?.message || 'Could not create this payslip')
    } finally { setPayslipBusy(false) }
  }

  const exportCsv = () => {
    const headers = ['carer', 'visits', 'paid_minutes', 'travel_minutes', 'miles', 'gross_pay_pence', 'approved', 'pending', 'rejected', 'exceptions']
    const csv = [headers.join(','), ...totals.map(t => [
      t.staff_name, t.visit_count, t.total_work_minutes, t.total_paid_travel_minutes,
      t.total_mileage_miles, t.total_gross_pay_pence, t.approved_count, t.pending_count, t.rejected_count, t.exception_count,
    ].join(','))].join('\n') + '\n'
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `carer-totals-${from}-${to}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  const goBack = () => { setView('overview'); setSelectedCarer(null); setCarerVisits([]); setPendingVisits([]); setExpandedVisit(null) }

  return (
    <PageContainer>
      {/* Header */}
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" gap={1.5}>
          {view !== 'overview' && <IconButton onClick={goBack} sx={{ color: '#0F4C81' }}><BackIcon /></IconButton>}
          <TrendingIcon sx={{ color: '#10b981', fontSize: 28 }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>               {view === 'carer-detail' ? displayText(selectedCarer?.staff_name, 'Carer Details') :

               view === 'pending-approvals' ? 'Pending Approvals' : 'Carer Totals'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#94A3B8' }}>
              {view === 'carer-detail' ? `${fmtD(from)} — ${fmtD(to)}` :
               view === 'pending-approvals' ? `${pendingVisits.length} timesheet${pendingVisits.length !== 1 ? 's' : ''} awaiting review` :
               'Per-carer summary of work, travel, mileage and pay'}
            </Typography>
          </Box>
        </Stack>
        {view === 'overview' && (
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv} disabled={!totals.length}
            sx={{ textTransform: 'none', borderColor: '#E5E7EB', color: '#374151', borderRadius: 2 }}>Export CSV</Button>
        )}
        {view === 'carer-detail' && selectedCarer && (
          <Button variant="outlined" startIcon={payslipBusy ? <CircularProgress size={16} /> : <DownloadIcon />}
            onClick={downloadCarerPayslip} disabled={payslipBusy || !selectedCarer.visit_count}
            sx={{ textTransform: 'none', borderColor: '#E5E7EB', color: '#374151', borderRadius: 2 }}>
            {payslipBusy ? 'Preparing…' : 'Download payslip'}
          </Button>
        )}
      </Stack>

      {/* Date filters */}
      {view === 'overview' && (
        <Stack direction="row" gap={1.5} mb={3} alignItems="flex-end" flexWrap="wrap">
          <TextField label="From" type="date" size="small" value={from} onChange={e => setFrom(e.target.value)}
            InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }} />
          <TextField label="To" type="date" size="small" value={to} onChange={e => setTo(e.target.value)}
            InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }} />
          <Button variant="contained" onClick={load} disabled={loading}
            sx={{ textTransform: 'none', bgcolor: '#0F4C81', borderRadius: 2, '&:hover': { bgcolor: '#0D3D6B' } }}>Load</Button>
          <Button variant="text" onClick={() => { const r = getMonthRange(); setFrom(r.from); setTo(r.to) }}
            sx={{ textTransform: 'none', color: '#0F4C81' }}>This month</Button>
          <Button variant="text" onClick={() => { const r = getMonthRange(1); setFrom(r.from); setTo(r.to) }}
            sx={{ textTransform: 'none', color: '#0F4C81' }}>Last month</Button>
        </Stack>
      )}

      {error && <Typography color="error" mb={2} sx={{ fontSize: '0.85rem' }}>{error}</Typography>}

      {/* ═══ OVERVIEW ═══ */}
      {view === 'overview' && (
        <>
          {/* Summary stats */}
          <Stack direction="row" gap={1.5} mb={3} flexWrap="wrap">
            <StatCard icon={<PersonIcon sx={{ fontSize: 22 }} />} label="Carers" value={totals.length} color="#0F4C81" />
            <StatCard icon={<TimeIcon sx={{ fontSize: 22 }} />} label="Paid time" value={fmtH(grandWork)} color="#10b981" />
            <StatCard icon={<CarIcon sx={{ fontSize: 22 }} />} label="Travel" value={fmtH(grandTravel)} color="#3b82f6" />
            <StatCard icon={<MileageIcon sx={{ fontSize: 22 }} />} label="Mileage" value={fmtM(grandMileage)} color="#8b5cf6" />
            <StatCard icon={<MoneyIcon sx={{ fontSize: 22 }} />} label="Gross pay" value={fmtP(grandGross)} color="#0F4C81" />
            <StatCard icon={<WarningIcon sx={{ fontSize: 22 }} />} label="Exceptions" value={grandExceptions}
              color={grandExceptions > 0 ? '#DC2626' : '#10b981'} />
            <StatCard icon={<PendingCheckIcon sx={{ fontSize: 22 }} />} label="Pending" value={grandPending}
              color={grandPending > 0 ? '#D97706' : '#10b981'}
              onClick={grandPending > 0 ? loadPendingApprovals : undefined}
              accent={grandPending > 0} />
          </Stack>

          {/* Search and carer cards */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
          ) : totals.length === 0 ? (
            <Paper elevation={0} sx={{ p: 6, textAlign: 'center', border: '1px solid #F1F5F9', borderRadius: 3 }}>
              <ReceiptIcon sx={{ fontSize: 48, color: '#D1D5DB', mb: 1 }} />
              <Typography sx={{ color: '#94A3B8' }}>No timesheet data for this period</Typography>
            </Paper>
          ) : (
            <>
              <TextField
                placeholder="Search by carer name…"
                size="small"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0) }}
                sx={{ mb: 2, maxWidth: 360, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
              {(() => {
                const filtered = totals.filter(t =>
                  t.staff_name.toLowerCase().includes(search.toLowerCase())
                )
                const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
                const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
                return (
                  <>
                    <Stack gap={1.5}>
                      {paged.map(t => (
                        <CarerCard key={t.staff_id} carer={t} onClick={() => loadCarerDetail(t)} />
                      ))}
                    </Stack>
                    {totalPages > 1 && (
                      <Stack direction="row" justifyContent="center" alignItems="center" gap={1} sx={{ mt: 3 }}>
                        <Button size="small" disabled={page === 0} onClick={() => setPage(p => p - 1)}
                          sx={{ textTransform: 'none', minWidth: 0, px: 1.5 }}>← Prev</Button>
                        <Typography sx={{ fontSize: '0.8rem', color: '#64748B' }}>
                          Page {page + 1} of {totalPages}
                        </Typography>
                        <Button size="small" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                          sx={{ textTransform: 'none', minWidth: 0, px: 1.5 }}>Next →</Button>
                      </Stack>
                    )}
                    {filtered.length === 0 && search && (
                      <Paper elevation={0} sx={{ p: 4, textAlign: 'center', border: '1px solid #F1F5F9', borderRadius: 3 }}>
                        <Typography sx={{ color: '#94A3B8' }}>No carers match "{search}"</Typography>
                      </Paper>
                    )}
                  </>
                )
              })()}
            </>
          )}
        </>
      )}

      {/* ═══ CARER DETAIL ═══ */}
      {view === 'carer-detail' && selectedCarer && (
        <>
          {/* Carer summary */}
          <Stack direction="row" gap={1.5} mb={3} flexWrap="wrap">
            <StatCard icon={<PersonIcon sx={{ fontSize: 22 }} />} label="Visits" value={selectedCarer.visit_count} color="#0F4C81" />
            <StatCard icon={<TimeIcon sx={{ fontSize: 22 }} />} label="Paid time" value={fmtH(Number(selectedCarer.total_work_minutes || 0))} color="#10b981" />
            <StatCard icon={<CarIcon sx={{ fontSize: 22 }} />} label="Travel" value={fmtH(Number(selectedCarer.total_paid_travel_minutes || 0))} color="#3b82f6" />
            <StatCard icon={<MoneyIcon sx={{ fontSize: 22 }} />} label="Gross pay" value={fmtP(selectedCarer.total_gross_pay_pence)} color="#8b5cf6" />
          </Stack>

          {carerLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
          ) : carerVisits.length === 0 ? (
            <Paper elevation={0} sx={{ p: 6, textAlign: 'center', border: '1px solid #F1F5F9', borderRadius: 3 }}>
              <ReceiptIcon sx={{ fontSize: 48, color: '#D1D5DB', mb: 1 }} />
              <Typography sx={{ color: '#94A3B8' }}>No visits for this carer in this period</Typography>
            </Paper>
          ) : (
            <Stack gap={1.5}>
              {carerVisits.map(v => {
                const isExpanded = expandedVisit === v.id
                const hasNotes = v.visit_notes || v.progress_notes || v.care_plan_notes || v.wellbeing_notes || v.client_mood || v.personal_care || v.fluid_intake_ml
                const statusColors: Record<string, { bg: string; fg: string }> = {
                  completed: { bg: '#ECFDF5', fg: '#047857' }, checked_in: { bg: '#EFF6FF', fg: '#1D4ED8' },
                  scheduled: { bg: '#F3F4F6', fg: '#6B7280' }, en_route: { bg: '#FFFBEB', fg: '#D97706' },
                  missed: { bg: '#FEF2F2', fg: '#B91C1C' }, cancelled: { bg: '#F3F4F6', fg: '#9CA3AF' },
                }
                const sc = statusColors[v.status] || statusColors.scheduled
                const tsColors: Record<string, { bg: string; fg: string }> = {
                  approved: { bg: '#ECFDF5', fg: '#047857' }, submitted: { bg: '#FFFBEB', fg: '#D97706' },
                  rejected: { bg: '#FEF2F2', fg: '#B91C1C' }, draft: { bg: '#F3F4F6', fg: '#9CA3AF' },
                }
                const tc = tsColors[v.timesheet_status || 'draft'] || tsColors.draft

                return (
                  <Paper key={v.id} elevation={0} sx={{
                    border: '1px solid #F1F5F9', borderRadius: 2.5, overflow: 'hidden',
                    transition: 'border-color 0.15s',
                    '&:hover': { borderColor: '#CBD5E1' },
                  }}>
                    {/* Visit header — always visible */}
                    <Box sx={{ p: 2, cursor: hasNotes ? 'pointer' : 'default' }}
                      onClick={hasNotes ? () => setExpandedVisit(isExpanded ? null : v.id) : undefined}>
                      <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 1 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>{v.label || v.visit_type}</Typography>
                        <Chip label={v.status} size="small" sx={{ bgcolor: sc.bg, color: sc.fg, fontWeight: 600, fontSize: '0.65rem', height: 20 }} />
                        <Chip label={tc.fg === '#D97706' ? 'submitted' : tc.fg === '#047857' ? 'approved' : tc.fg === '#B91C1C' ? 'rejected' : 'draft'}
                          size="small" sx={{ bgcolor: tc.bg, color: tc.fg, fontWeight: 600, fontSize: '0.65rem', height: 20 }} />
                        {v.exception_type && (
                          <Chip label={v.exception_type} size="small"
                            sx={{ bgcolor: '#FEF2F2', color: '#B91C1C', fontWeight: 600, fontSize: '0.65rem', height: 20 }} />
                        )}
                        {hasNotes && (
                          <Box sx={{ ml: 'auto' }}>{isExpanded ? <CollapseIcon sx={{ fontSize: 18, color: '#94A3B8' }} /> : <ExpandIcon sx={{ fontSize: 18, color: '#94A3B8' }} />}</Box>
                        )}
                      </Stack>
                      <Typography sx={{ fontSize: '0.8rem', color: '#64748B' }}>
                        {v.person_name}{v.person_address ? ` · ${v.person_address}` : ''}
                      </Typography>
                      <Stack direction="row" gap={2} sx={{ mt: 1 }} flexWrap="wrap">
                        <Typography sx={{ fontSize: '0.75rem', color: '#64748B' }}>{fmtD(v.scheduled_start)}</Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: '#64748B' }}>{fmtT(v.scheduled_start)} – {fmtT(v.scheduled_end)}</Typography>
                        {v.check_in_at && (
                          <Typography sx={{ fontSize: '0.75rem', color: '#64748B' }}>Actual: {fmtT(v.check_in_at)} – {v.check_out_at ? fmtT(v.check_out_at) : 'ongoing'}</Typography>
                        )}
                        {v.gross_pay_pence != null && (
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#0F4C81' }}>{fmtP(v.gross_pay_pence)}</Typography>
                        )}
                      </Stack>
                      {/* Quick chips */}
                      <Stack direction="row" gap={0.75} sx={{ mt: 1 }} flexWrap="wrap">
                        {v.work_minutes != null && <Chip size="small" label={`Work: ${fmtH(v.work_minutes)}`} sx={{ bgcolor: '#F0FDF4', color: '#166534', fontWeight: 500, fontSize: '0.65rem', height: 20 }} />}
                        {v.paid_travel_minutes != null && <Chip size="small" label={`Travel: ${fmtH(v.paid_travel_minutes)}`} sx={{ bgcolor: '#EFF6FF', color: '#1E40AF', fontWeight: 500, fontSize: '0.65rem', height: 20 }} />}
                        {v.mileage_miles != null && <Chip size="small" label={`Mileage: ${fmtM(v.mileage_miles)}`} sx={{ bgcolor: '#F5F3FF', color: '#5B21B6', fontWeight: 500, fontSize: '0.65rem', height: 20 }} />}
                        {v.tasks_total != null && v.tasks_total > 0 && (
                          <Chip size="small" label={`Tasks: ${v.tasks_completed}/${v.tasks_total}`}
                            sx={{ bgcolor: v.tasks_completed === v.tasks_total ? '#F0FDF4' : '#FFFBEB', color: v.tasks_completed === v.tasks_total ? '#166534' : '#92400E', fontWeight: 500, fontSize: '0.65rem', height: 20 }} />
                        )}
                      </Stack>
                    </Box>

                    {/* Expanded care notes */}
                    <Collapse in={isExpanded} timeout="auto">
                      <Box sx={{ px: 2, pb: 2, borderTop: '1px solid #F1F5F9', pt: 1.5 }}>
                        <Stack gap={1.5}>
                          {v.visit_notes && <NoteBlock label="Visit Notes" text={v.visit_notes} />}
                          {v.progress_notes && <NoteBlock label="Progress Notes" text={v.progress_notes} />}
                          {v.care_plan_notes && <NoteBlock label="Care Plan Notes" text={v.care_plan_notes} />}
                          {v.wellbeing_notes && <NoteBlock label="Wellbeing" text={v.wellbeing_notes} />}
                          <Stack direction="row" gap={2} flexWrap="wrap">
                            {v.client_mood && <MiniField label="Mood" value={v.client_mood} />}
                            {v.personal_care && <MiniField label="Personal Care" value={v.personal_care} />}
                            {v.fluid_intake_ml != null && <MiniField label="Fluid Intake" value={`${v.fluid_intake_ml} ml`} />}
                          </Stack>
                          {v.late_reason && <NoteBlock label="Late Reason" text={v.late_reason} color="#D97706" />}
                          {v.rejection_reason && <NoteBlock label="Rejection Reason" text={v.rejection_reason} color="#DC2626" />}
                        </Stack>
                      </Box>
                    </Collapse>
                  </Paper>
                )
              })}
            </Stack>
          )}
        </>
      )}

      {/* ═══ PENDING APPROVALS ═══ */}
      {view === 'pending-approvals' && (
        <>
          {pendingLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
          ) : pendingVisits.length === 0 ? (
            <Paper elevation={0} sx={{ p: 6, textAlign: 'center', border: '1px solid #F1F5F9', borderRadius: 3 }}>
              <CheckIcon sx={{ fontSize: 48, color: '#10b981', mb: 1 }} />
              <Typography sx={{ color: '#94A3B8' }}>All timesheets have been reviewed</Typography>
            </Paper>
          ) : (
            <Stack gap={1.5}>
              {pendingVisits.map(v => (
                <Paper key={v.timesheet_id} elevation={0} sx={{
                  p: 2.5, border: '1px solid #F1F5F9', borderRadius: 2.5,
                }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={2}>
                    <Box>
                      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 0.5 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>{v.visit_label}</Typography>
                        <Chip label={v.timesheet_status} size="small"
                          sx={{ bgcolor: '#FFFBEB', color: '#D97706', fontWeight: 600, fontSize: '0.65rem', height: 20 }} />
                      </Stack>
                      <Typography sx={{ fontSize: '0.8rem', color: '#64748B' }}>
                        {v.staff_name} · {v.person_name} · {fmtD(v.scheduled_start)} {fmtT(v.scheduled_start)} – {fmtT(v.scheduled_end)}
                      </Typography>
                      <Stack direction="row" gap={1} sx={{ mt: 1 }} flexWrap="wrap">
                        <Chip size="small" label={`Work: ${fmtH(v.work_minutes)}`} sx={{ bgcolor: '#F0FDF4', color: '#166534', fontWeight: 500, fontSize: '0.65rem', height: 20 }} />
                        <Chip size="small" label={`Travel: ${fmtH(v.paid_travel_minutes)}`} sx={{ bgcolor: '#EFF6FF', color: '#1E40AF', fontWeight: 500, fontSize: '0.65rem', height: 20 }} />
                        <Chip size="small" label={fmtP(v.gross_pay_pence)} sx={{ bgcolor: '#F0FDF4', color: '#047857', fontWeight: 700, fontSize: '0.65rem', height: 20 }} />
                      </Stack>
                    </Box>
                    <Stack direction="row" gap={1}>
                      <Button variant="contained" size="small"
                        onClick={() => handleTimesheetAction(v.timesheet_id, 'approved')}
                        sx={{ textTransform: 'none', bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' }, borderRadius: 1.5, fontWeight: 600 }}>
                        Approve
                      </Button>
                      <Button variant="outlined" size="small"
                        onClick={() => handleTimesheetAction(v.timesheet_id, 'rejected')}
                        sx={{ textTransform: 'none', borderColor: '#E5E7EB', color: '#B91C1C', borderRadius: 1.5, fontWeight: 600 }}>
                        Reject
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </>
      )}
    </PageContainer>
  )
}

/* ── Small helpers ── */
function NoteBlock({ label, text, color }: { label: string; text: string; color?: string }) {
  return (
    <Box>
      <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: color || '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.85rem', color: '#374151', whiteSpace: 'pre-wrap', mt: 0.25, lineHeight: 1.5 }}>{text}</Typography>
    </Box>
  )
}

function MiniField({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', mt: 0.25 }}>{value}</Typography>
    </Box>
  )
}
