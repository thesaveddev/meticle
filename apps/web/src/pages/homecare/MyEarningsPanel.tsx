import { useState } from 'react'
import {
  Box, Typography, Stack, Paper, Chip, CircularProgress, Alert
} from '@mui/material'
import {
  Download as DownloadIcon,
  AccessTime as ClockIcon,
  DirectionsCar as CarIcon,
  Receipt as ReceiptIcon,
  CalendarMonth as CalendarIcon,
  AttachMoney as MoneyIcon,
  PersonOff as NoProfileIcon,
} from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import AppButton from '../../components/design/AppButton'

function fmtPence(p: number | null | undefined) {
  return p == null ? '—' : `£${(Number(p) / 100).toFixed(2)}`
}

function fmtMins(m: number | null | undefined) {
  const mins = Number(m || 0)
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return hrs > 0 ? `${hrs}h ${rem}m` : `${rem}m`
}

// Local-date formatting: slicing ISO strings shifts the boundary a day for any
// timezone off UTC, which mislabelled the period and dropped its last day.
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function monthRange() {
  const now = new Date()
  return {
    from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  }
}

/* ── Stat card ── */
function StatCard({ icon, label, value, color, sub }: {
  icon: React.ReactNode; label: string; value: string; color: string; sub?: string
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2, flex: '1 1 150px', minWidth: 140,
        border: '1px solid', borderColor: 'grey.100',
        borderRadius: 2.5, display: 'flex', alignItems: 'center', gap: 1.5,
        transition: 'border-color 0.15s',
        '&:hover': { borderColor: color + '40' },
      }}
    >
      <Box sx={{
        width: 40, height: 40, borderRadius: 2,
        bgcolor: color + '10', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.2, display: 'block' }}>{label}</Typography>
        <Typography variant="subtitle1" sx={{ fontWeight: 800, color, lineHeight: 1.3 }}>{value}</Typography>
        {sub && <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>{sub}</Typography>}
      </Box>
    </Paper>
  )
}

/* ── Breakdown card ── */
function BreakdownCard({ label, detail, amount, color, icon }: {
  label: string; detail: string; amount: string; color: string; icon: React.ReactNode
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2, flex: '1 1 180px', minWidth: 170,
        border: '1px solid', borderColor: 'grey.100',
        borderRadius: 2.5, position: 'relative', overflow: 'hidden',
        transition: 'border-color 0.15s, transform 0.15s',
        '&:hover': { borderColor: color + '50', transform: 'translateY(-1px)' },
      }}
    >
      <Box sx={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        bgcolor: color, borderRadius: '3px 3px 0 0',
      }} />
      <Stack direction="row" alignItems="center" gap={1} mb={1}>
        <Box sx={{
          width: 32, height: 32, borderRadius: 1.5,
          bgcolor: color + '12', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>
          {label}
        </Typography>
      </Stack>
      <Typography variant="h6" sx={{ fontWeight: 800, color, lineHeight: 1.2 }}>{amount}</Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25, fontSize: '0.7rem' }}>{detail}</Typography>
    </Paper>
  )
}

/**
 * A carer's own pay: period totals, breakdown, year-to-date and the calls that
 * generated the money. Rendered on the Payroll & timesheets page for carers,
 * so there is one pay screen in the app, scoped by role. Pay is added at
 * clock-out; nothing here ever waits on an approval.
 */
export default function MyEarningsPanel() {
  const [period, setPeriod] = useState(monthRange())
  const [downloading, setDownloading] = useState(false)
  const [payslipError, setPayslipError] = useState<string | null>(null)

  const earnings = useQuery({
    queryKey: ['homecare-my-earnings', period.from, period.to],
    queryFn: () => api.get('/homecare/my-earnings', { params: { from: period.from, to: period.to } }).then(r => r.data),
    enabled: Boolean(period.from && period.to && period.from <= period.to),
    retry: 1,
  })

  async function downloadPayslip() {
    setDownloading(true)
    setPayslipError(null)
    try {
      const res = await api.get('/homecare/my-payslip', {
        params: { from: period.from, to: period.to },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `payslip-${period.from.slice(0, 7)}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      setPayslipError('Could not create your payslip. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  const data = earnings.data
  const s = data?.summary || {}
  const linked = data?.staff_profile_linked !== false
  const visits: any[] = Array.isArray(data?.visits) ? data.visits : []
  // A checked-in call is still accruing pay; show it rather than hiding it
  // while its totals already count.
  const paidCalls = visits
    .filter((v: any) => v.status === 'completed' || v.status === 'checked_in')
    .sort((a: any, b: any) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime())
  const workPay = Math.round(((s.total_work_minutes || 0) / 60) * Number(s.hourly_rate_pence || 0))
  const travelPay = Math.round(((s.total_paid_travel_minutes || 0) / 60) * Number(s.hourly_rate_pence || 0))
  const mileagePay = Math.round((Number(s.total_mileage_miles) || 0) * Number(s.mileage_rate_pence || 0))
  const hasData = s?.visit_count > 0

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {new Date(`${period.from}T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} · completed calls and the pay they generated
        </Typography>
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
          <input
            type="date" value={period.from} aria-label="From"
            onChange={e => setPeriod(p => ({ ...p, from: e.target.value }))}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13 }}
          />
          <input
            type="date" value={period.to} aria-label="To"
            onChange={e => setPeriod(p => ({ ...p, to: e.target.value }))}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13 }}
          />
          <AppButton
            variant="secondary"
            startIcon={downloading ? <CircularProgress size={14} /> : <DownloadIcon />}
            onClick={downloadPayslip}
            loading={downloading}
            disabled={!linked || !hasData}
          >
            Payslip
          </AppButton>
        </Stack>
      </Stack>
      {payslipError && (
        <Alert severity="error" onClose={() => setPayslipError(null)}>{payslipError}</Alert>
      )}

      {earnings.isLoading && (
        <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>
      )}

      {earnings.isError && (
        <Alert
          severity="error"
          action={<AppButton variant="secondary" size="small" onClick={() => earnings.refetch()}>Try again</AppButton>}
        >
          Could not load your earnings. {String((earnings.error as any)?.response?.data?.message || '')}
        </Alert>
      )}

      {!earnings.isLoading && !earnings.isError && !linked && (
        <Alert severity="info" icon={<NoProfileIcon />}>
          This login is not linked to a staff profile yet, so there is no personal pay to show. Ask an
          administrator to link your staff profile to your account — every call you complete will then
          appear here automatically.
        </Alert>
      )}

      {!earnings.isLoading && !earnings.isError && linked && (
        <>
          {/* Summary stat cards */}
          <Stack direction="row" gap={1.5} flexWrap="wrap">
            <StatCard
              icon={<MoneyIcon sx={{ fontSize: 20, color: '#0F4C81' }} />}
              label="Gross pay"
              value={fmtPence(s.total_gross_pay_pence)}
              color="#0F4C81"
            />
            <StatCard
              icon={<ReceiptIcon sx={{ fontSize: 20, color: '#10b981' }} />}
              label="Calls"
              value={String(s.visit_count || 0)}
              color="#10b981"
              sub="paid"
            />
            <StatCard
              icon={<ClockIcon sx={{ fontSize: 20, color: '#8b5cf6' }} />}
              label="Worked"
              value={fmtMins(s.total_work_minutes)}
              color="#8b5cf6"
            />
            <StatCard
              icon={<CarIcon sx={{ fontSize: 20, color: '#3b82f6' }} />}
              label="Mileage"
              value={`${Number(s.total_mileage_miles || 0).toFixed(1)} mi`}
              color="#3b82f6"
            />
          </Stack>

          {!hasData && (
            <Paper elevation={0} sx={{ p: 4, textAlign: 'center', border: '1px solid', borderColor: 'grey.100', borderRadius: 2.5 }}>
              <ReceiptIcon sx={{ fontSize: 40, color: '#D1D5DB', mb: 1 }} />
              <Typography sx={{ color: 'text.secondary' }}>
                No completed calls in this period. Pay appears here as soon as you clock in and out of a call.
              </Typography>
            </Paper>
          )}

          {/* Breakdown cards */}
          {hasData && (
            <>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.65rem' }}>
                  Earnings breakdown
                </Typography>
              </Box>
              <Stack direction="row" gap={1.5} flexWrap="wrap">
                <BreakdownCard
                  label="Work hours"
                  detail={`${fmtMins(s.total_work_minutes)} at ${fmtPence(s.hourly_rate_pence)}/hr`}
                  amount={fmtPence(workPay)}
                  color="#0F4C81"
                  icon={<ClockIcon sx={{ fontSize: 16, color: '#0F4C81' }} />}
                />
                {Number(s.total_paid_travel_minutes || 0) > 0 && (
                  <BreakdownCard
                    label="Travel (paid)"
                    detail={`${fmtMins(s.total_paid_travel_minutes)} at ${fmtPence(s.hourly_rate_pence)}/hr`}
                    amount={fmtPence(travelPay)}
                    color="#D97706"
                    icon={<CarIcon sx={{ fontSize: 16, color: '#D97706' }} />}
                  />
                )}
                <BreakdownCard
                  label="Mileage"
                  detail={`${Number(s.total_mileage_miles || 0).toFixed(1)} mi at ${fmtPence(s.mileage_rate_pence)}/mi`}
                  amount={fmtPence(mileagePay)}
                  color="#10b981"
                  icon={<CarIcon sx={{ fontSize: 16, color: '#10b981' }} />}
                />
              </Stack>
            </>
          )}

          {/* Rates */}
          {hasData && (
            <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'grey.100', borderRadius: 2.5 }}>
              <Stack direction="row" gap={3} flexWrap="wrap" alignItems="center">
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>
                  Your rates
                </Typography>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.65rem' }}>Hourly</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{fmtPence(s.hourly_rate_pence)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.65rem' }}>Mileage</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{fmtPence(s.mileage_rate_pence)}/mi</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.65rem' }}>Travel paid</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{s.total_paid_travel_minutes > 0 ? 'Yes' : 'No'}</Typography>
                </Box>
              </Stack>
            </Paper>
          )}

          {/* Year to date */}
          {data?.ytd && (
            <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'grey.100', borderRadius: 2.5 }}>
              <Stack direction="row" alignItems="center" gap={1} mb={2}>
                <CalendarIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>
                  Year to date · {data.ytd.year}
                </Typography>
              </Stack>
              <Stack direction="row" gap={2} flexWrap="wrap" mb={(data.ytd.months || []).length ? 2 : 0}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>Gross pay</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#0F4C81' }}>{fmtPence(data.ytd.total_gross_pay_pence)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>Calls</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{data.ytd.visit_count || 0}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>Work</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{fmtMins(data.ytd.total_work_minutes)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>Mileage</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{Number(data.ytd.total_mileage_miles || 0).toFixed(1)} mi</Typography>
                </Box>
              </Stack>
              {(data.ytd.months || []).map((m: any) => (
                <Box key={m.month} display="flex" justifyContent="space-between" alignItems="center" sx={{ py: 0.75, borderTop: '1px solid', borderColor: 'grey.100' }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {new Date(`${m.month}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                  </Typography>
                  <Stack direction="row" gap={2} alignItems="center">
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {m.visit_count} calls · {fmtMins(m.work_minutes)}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{fmtPence(m.gross_pay_pence)}</Typography>
                  </Stack>
                </Box>
              ))}
            </Paper>
          )}

          {/* Paid calls */}
          {hasData && (
            <>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.65rem' }}>
                  Calls in this period
                </Typography>
              </Box>
              {paidCalls.length === 0 ? (
                <Paper elevation={0} sx={{ p: 4, textAlign: 'center', border: '1px solid', borderColor: 'grey.100', borderRadius: 2.5 }}>
                  <Typography sx={{ color: 'text.secondary' }}>No completed calls in this period</Typography>
                </Paper>
              ) : (
                <Stack spacing={1}>
                  {paidCalls.map((v: any) => (
                    <Paper
                      key={v.id}
                      elevation={0}
                      sx={{
                        p: 2, display: 'flex', alignItems: 'center', gap: 2,
                        border: '1px solid', borderColor: 'grey.100', borderRadius: 2,
                        transition: 'border-color 0.15s',
                        '&:hover': { borderColor: '#0F4C8130' },
                      }}
                    >
                      <Box sx={{
                        width: 8, height: 8, borderRadius: '50%',
                        bgcolor: v.tasks_completed === v.tasks_total && v.tasks_total > 0 ? '#10B981' : '#E5E7EB',
                        flexShrink: 0,
                      }} />
                      <Box flex={1} sx={{ minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" gap={1}>
                          <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>{v.person_name || 'Client'}</Typography>
                          {v.status === 'checked_in' && <Chip size="small" label="In progress" sx={{ height: 20, fontSize: '0.65rem' }} />}
                        </Stack>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                          {v.label} · {new Date(v.scheduled_start).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </Typography>
                        {v.tasks_total > 0 && (
                          <Typography variant="caption" sx={{
                            color: v.tasks_completed === v.tasks_total ? '#047857' : '#92400E',
                            fontWeight: 500, fontSize: '0.65rem',
                          }}>
                            {v.tasks_completed}/{v.tasks_total} tasks
                          </Typography>
                        )}
                      </Box>
                      <Stack direction="row" gap={0.75} sx={{ flexShrink: 0 }}>
                        {v.work_minutes != null && (
                          <Chip size="small" label={fmtMins(v.work_minutes)} sx={{ height: 22, fontSize: '0.7rem', bgcolor: '#F3F4F6' }} />
                        )}
                        {Number(v.mileage_miles) > 0 && (
                          <Chip size="small" label={`${Number(v.mileage_miles).toFixed(1)} mi`} sx={{ height: 22, fontSize: '0.7rem', bgcolor: '#ECFDF5', color: '#047857' }} />
                        )}
                      </Stack>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0F4C81', flexShrink: 0 }}>{fmtPence(v.gross_pay_pence)}</Typography>
                    </Paper>
                  ))}
                </Stack>
              )}
            </>
          )}
        </>
      )}
    </Stack>
  )
}
