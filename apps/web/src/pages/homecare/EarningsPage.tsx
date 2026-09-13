import { useState, useEffect } from 'react'
import {
  Box, Typography, Stack, Paper, Chip, CircularProgress
} from '@mui/material'
import api from '../../services/api'

function fmtPence(p: number | null | undefined) {
  return p == null ? '—' : `£${(Number(p) / 100).toFixed(2)}`
}

function fmtMins(m: number | null | undefined) {
  const mins = Number(m || 0)
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return hrs > 0 ? `${hrs}h ${rem}m` : `${rem}m`
}

function monthRange() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  return { from, to }
}

export default function EarningsPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(monthRange())

  useEffect(() => {
    setLoading(true)
    api.get(`/homecare/my-earnings?from=${period.from}&to=${period.to}`)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [period.from, period.to])

  if (loading) {
    return <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
  }

  const s = data?.summary || {}
  const completed = (data?.visits || []).filter((v: any) => v.status === 'completed')
    .sort((a: any, b: any) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime())
  const workPay = Math.round(((s.total_work_minutes || 0) / 60) * Number(s.hourly_rate_pence || 0))
  const travelPay = Math.round(((s.total_paid_travel_minutes || 0) / 60) * Number(s.hourly_rate_pence || 0))
  const mileagePay = Math.round((Number(s.total_mileage_miles) || 0) * Number(s.mileage_rate_pence || 0))

  return (
    <Stack spacing={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h5" fontWeight={700}>Earnings</Typography>
          <Typography variant="body2" color="text.secondary">
            {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          <input type="date" value={period.from} onChange={e => setPeriod(p => ({ ...p, from: e.target.value }))} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 13 }} />
          <input type="date" value={period.to} onChange={e => setPeriod(p => ({ ...p, to: e.target.value }))} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 13 }} />
        </Box>
      </Box>

      {/* Hero card */}
      <Paper sx={{ p: 3, background: 'linear-gradient(135deg, #1A2332 0%, #2D3A5C 100%)', color: '#fff', borderRadius: 3 }}>
        <Typography variant="body2" sx={{ opacity: 0.7 }}>Estimated gross pay</Typography>
        <Typography variant="h3" fontWeight={800} sx={{ letterSpacing: -1, my: 1 }}>
          {fmtPence(s.total_gross_pay_pence)}
        </Typography>
        <Box display="flex" gap={4} mt={2}>
          <Box textAlign="center">
            <Typography variant="h6" fontWeight={700}>{s.visit_count || 0}</Typography>
            <Typography variant="caption" sx={{ opacity: 0.6 }}>calls completed</Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="h6" fontWeight={700}>{fmtMins(s.total_work_minutes)}</Typography>
            <Typography variant="caption" sx={{ opacity: 0.6 }}>worked</Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="h6" fontWeight={700}>{Number(s.total_mileage_miles || 0).toFixed(1)}mi</Typography>
            <Typography variant="caption" sx={{ opacity: 0.6 }}>driven</Typography>
          </Box>
        </Box>
      </Paper>

      {/* Breakdown */}
      <Typography variant="overline" fontWeight={700} color="text.secondary" letterSpacing={1}>Breakdown</Typography>
      <Stack spacing={1.5}>
        {[
          { label: 'Work hours', detail: `${fmtMins(s.total_work_minutes)} at ${fmtPence(s.hourly_rate_pence)}/hr`, amount: workPay, color: 'primary.main' },
          ...(Number(s.total_paid_travel_minutes || 0) > 0 ? [{ label: 'Travel time (paid)', detail: `${fmtMins(s.total_paid_travel_minutes)} at ${fmtPence(s.hourly_rate_pence)}/hr`, amount: travelPay, color: 'warning.main' }] : []),
          { label: 'Mileage', detail: `${Number(s.total_mileage_miles || 0).toFixed(1)} miles at ${fmtPence(s.mileage_rate_pence)}/mi`, amount: mileagePay, color: 'success.main' },
        ].map((item: any) => (
          <Paper key={item.label} variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: 1, bgcolor: item.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: item.color }} />
            </Box>
            <Box flex={1}>
              <Typography variant="body2" fontWeight={600}>{item.label}</Typography>
              <Typography variant="caption" color="text.secondary">{item.detail}</Typography>
            </Box>
            <Typography variant="subtitle1" fontWeight={700} color={item.color}>{fmtPence(item.amount)}</Typography>
          </Paper>
        ))}
      </Stack>

      {/* Rates */}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Your rates</Typography>
        <Box display="flex" gap={4}>
          <Box><Typography variant="caption" color="text.secondary">Hourly</Typography><Typography variant="body2" fontWeight={700}>{fmtPence(s.hourly_rate_pence)}</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">Mileage</Typography><Typography variant="body2" fontWeight={700}>{fmtPence(s.mileage_rate_pence)}/mi</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">Travel paid</Typography><Typography variant="body2" fontWeight={700}>{s.total_paid_travel_minutes > 0 ? 'Yes' : 'No'}</Typography></Box>
        </Box>
      </Paper>

      {/* Completed visits */}
      <Typography variant="overline" fontWeight={700} color="text.secondary" letterSpacing={1}>Completed calls</Typography>
      {completed.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">No completed calls in this period</Typography>
        </Paper>
      ) : (
        <Stack spacing={1}>
          {completed.map((v: any) => (
            <Paper key={v.id} variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box flex={1}>
                <Typography variant="body2" fontWeight={600}>{v.person_name || 'Client'}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {v.label} · {new Date(v.scheduled_start).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                </Typography>
              </Box>
              <Box display="flex" gap={1}>
                {v.work_minutes != null && <Chip size="small" label={`${fmtMins(v.work_minutes)} work`} />}
                {Number(v.mileage_miles) > 0 && <Chip size="small" label={`${Number(v.mileage_miles).toFixed(1)} mi`} color="success" variant="outlined" />}
              </Box>
              <Typography variant="subtitle2" fontWeight={700}>{fmtPence(v.gross_pay_pence)}</Typography>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
