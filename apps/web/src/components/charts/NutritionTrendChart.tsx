import { useQuery } from '@tanstack/react-query'
import { Box, Typography, Paper, Stack, Chip } from '@mui/material'
import { Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, ComposedChart, Bar, ReferenceLine } from 'recharts'
import api from '../../services/api'

interface TrendDay {
  date: string
  meals: number
  refused: number
  avg_consumed: number
  total_fluid: number
  people_fed: number
  total_people: number
  avg_fluid_target: number
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <Box sx={{ bgcolor: '#fff', border: '1px solid #E5E7EB', borderRadius: 1.5, p: 1.5, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <Typography variant="caption" fontWeight={700} sx={{ mb: 0.5, display: 'block' }}>{label}</Typography>
      {payload.map((entry: any, i: number) => (
        <Stack key={i} direction="row" spacing={1} alignItems="center">
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: entry.color, flexShrink: 0 }} />
          <Typography variant="caption" color="text.secondary">{entry.name}: {entry.value}{entry.name.includes('Fluid') ? 'ml' : entry.name === 'Avg Consumed' ? '%' : ''}</Typography>
        </Stack>
      ))}
    </Box>
  )
}

export default function NutritionTrendChart() {
  const { data, isLoading } = useQuery({
    queryKey: ['nutrition-trend-7d'],
    queryFn: () => api.get('/nutrition/trend').then((r: any) => r.data as TrendDay[]),
  })

  if (isLoading) return <Box sx={{ py: 4, textAlign: 'center' }}>Loading trend data...</Box>
  if (!data?.length) return <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>No nutrition data available for the last 7 days.</Typography>

  const chartData = data.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }),
    Meals: d.meals,
    Refused: d.refused,
    'Avg Consumed %': d.avg_consumed,
    Fluid: d.total_fluid,
    'Fluid Target': d.avg_fluid_target * (d.total_people || 1),
    Fed: d.people_fed,
  }))

  const totalMeals = data.reduce((s, d) => s + d.meals, 0)
  const totalRefused = data.reduce((s, d) => s + d.refused, 0)
  const avgConsumed = Math.round(data.reduce((s, d) => s + d.avg_consumed, 0) / data.length)
  const totalFluid = data.reduce((s, d) => s + d.total_fluid, 0)
  const avgFluidPerDay = Math.round(totalFluid / data.length)

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>7-Day Nutrition Trend</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
        Meal intake, consumption rates, and fluid tracking across all people
      </Typography>

      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
        <Chip label={`${totalMeals} meals`} size="small" sx={{ bgcolor: '#EFF6FF', color: '#2563EB', fontWeight: 600 }} />
        <Chip label={`${totalRefused} refused`} size="small" sx={{ bgcolor: totalRefused > 0 ? '#FEF2F2' : '#F0FDF4', color: totalRefused > 0 ? '#DC2626' : '#16A34A', fontWeight: 600 }} />
        <Chip label={`${avgConsumed}% avg consumed`} size="small" sx={{ bgcolor: avgConsumed >= 75 ? '#F0FDF4' : avgConsumed >= 50 ? '#FFFBEB' : '#FEF2F2', color: avgConsumed >= 75 ? '#16A34A' : avgConsumed >= 50 ? '#D97706' : '#DC2626', fontWeight: 600 }} />
        <Chip label={`${(totalFluid / 1000).toFixed(1)}L total fluid`} size="small" sx={{ bgcolor: '#F0F9FF', color: '#0369A1', fontWeight: 600 }} />
        <Chip label={`~${avgFluidPerDay}ml/day avg`} size="small" sx={{ bgcolor: '#F0F9FF', color: '#0369A1', fontWeight: 600 }} />
      </Stack>

      <Box sx={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
            <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke="#9CA3AF" label={{ value: 'Meals / Refused', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#9CA3AF' }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} stroke="#9CA3AF" label={{ value: 'Fluid (ml)', angle: 90, position: 'insideRight', fontSize: 11, fill: '#9CA3AF' }} />
            <RechartsTooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Bar yAxisId="left" dataKey="Meals" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={20} />
            <Bar yAxisId="left" dataKey="Refused" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={20} />
            <Line yAxisId="left" type="monotone" dataKey="Avg Consumed %" stroke="#10B981" strokeWidth={2.5} dot={{ r: 4, fill: '#10B981' }} name="Avg Consumed %" />
            <Line yAxisId="right" type="monotone" dataKey="Fluid" stroke="#0EA5E9" strokeWidth={2.5} dot={{ r: 4, fill: '#0EA5E9' }} />
            <ReferenceLine yAxisId="right" y={chartData[0]?.['Fluid Target'] || 2000} stroke="#94A3B8" strokeDasharray="5 5" label={{ value: 'Target', fontSize: 10, fill: '#94A3B8' }} />
          </ComposedChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  )
}
