import { useEffect, useState } from 'react'
import { Box, Typography, CircularProgress } from '@mui/material'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import api from '../services/api'

interface TrendDataPoint { week: string; avg_progress: number; updates: number }

interface Props {
  personId?: string
  title?: string
  height?: number
}

export default function OutcomeTrendChart({ personId, title = 'Goal Progress Trend', height = 300 }: Props) {
  const [data, setData] = useState<TrendDataPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTrend = async () => {
      try {
        if (personId) {
          const res = await api.get(`/outcomes/results/trend?person_id=${personId}`)
          setData(res.data)
        } else {
          const res = await api.get('/insights/outcomes')
          setData(res.data.goal_progress_trend || [])
        }
      } catch { setData([]) }
      setLoading(false)
    }
    fetchTrend()
  }, [personId])

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
  if (!data.length) return <Typography variant="body2" color="#9CA3AF" sx={{ textAlign: 'center', py: 4 }}>No trend data available</Typography>

  const chartData = data.map(d => ({
    ...d,
    week: new Date(d.week).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
  }))

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2 }}>{title}</Typography>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="week" tick={{ fontSize: 12, fill: '#6B7280' }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#6B7280' }} />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
            formatter={(value: any, name: any) => [name === 'avg_progress' ? `${value}%` : value, name === 'avg_progress' ? 'Avg Progress' : 'Updates']}
          />
          <Legend />
          <ReferenceLine y={50} stroke="#D97706" strokeDasharray="3 3" label={{ value: '50%', position: 'right', fontSize: 10, fill: '#D97706' }} />
          <Line type="monotone" dataKey="avg_progress" stroke="#0F4C81" strokeWidth={2.5} dot={{ r: 4, fill: '#0F4C81' }} activeDot={{ r: 6 }} name="Avg Progress" />
          <Line type="monotone" dataKey="updates" stroke="#16A34A" strokeWidth={1.5} dot={{ r: 3, fill: '#16A34A' }} name="Updates" yAxisId={0} />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  )
}
