import { Paper, Typography, Box } from '@mui/material'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface DataPoint {
  name: string
  value: number
  color?: string
  [key: string]: any
}

interface Props {
  title: string
  data: DataPoint[]
  height?: number
  showLegend?: boolean
  color?: string
  maxValue?: number
}

export default function ReportRadarChart({ title, data, height = 350, showLegend = false, color = '#0F4C81', maxValue }: Props) {
  const domain: [number, number] = [0, maxValue || Math.max(...data.map(d => d.value), 10)]

  return (
    <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', height: '100%' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>{title}</Typography>
      {data.length === 0 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: height - 80, color: 'text.secondary' }}>
          <Typography variant="body2">No data available</Typography>
        </Box>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="#E5E7EB" />
            <PolarAngleAxis dataKey="name" tick={{ fontSize: 11 }} />
            <PolarRadiusAxis angle={30} domain={domain} tick={{ fontSize: 10 }} />
            <Radar name="Score" dataKey="value" stroke={color} fill={color} fillOpacity={0.25} strokeWidth={2} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            />
            {showLegend && <Legend />}
          </RadarChart>
        </ResponsiveContainer>
      )}
    </Paper>
  )
}
