import { Paper, Typography, Stack } from '@mui/material'
import { TrendingUp, TrendingDown } from '@mui/icons-material'

interface StatCardProps {
  label: string
  value: string | number
  color?: string
  subtitle?: string
  trend?: { value: number; direction: 'up' | 'down' | 'flat' }
}

export default function StatCard({ label, value, color = '#0F4C81', subtitle, trend }: StatCardProps) {
  return (
    <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', height: '100%' }}>
      <Stack spacing={1}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </Typography>
        <Stack direction="row" alignItems="baseline" spacing={1}>
          <Typography variant="h4" sx={{ fontWeight: 800, color, lineHeight: 1.1 }}>
            {value}
          </Typography>
          {trend && trend.direction !== 'flat' && (
            <Stack direction="row" alignItems="center" spacing={0.3} sx={{ color: trend.direction === 'up' ? '#16A34A' : '#DC2626' }}>
              {trend.direction === 'up' ? <TrendingUp sx={{ fontSize: 16 }} /> : <TrendingDown sx={{ fontSize: 16 }} />}
              <Typography variant="caption" sx={{ fontWeight: 700 }}>{Math.abs(trend.value)}%</Typography>
            </Stack>
          )}
        </Stack>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
        )}
      </Stack>
    </Paper>
  )
}
