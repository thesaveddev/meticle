import { useMemo } from 'react'
import { Paper, Typography, Box } from '@mui/material'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface DataPoint {
  name: string
  value: number
  color?: string
}

interface Props {
  title: string
  data: DataPoint[]
  height?: number
  donut?: boolean
  innerRadius?: number
  outerRadius?: number
  showLegend?: boolean
  colors?: string[]
  centerLabel?: string
}

const DEFAULT_COLORS = ['#0F4C81', '#6366F1', '#16A34A', '#D97706', '#DC2626', '#EC4899', '#8B5CF6', '#0EA5E9', '#F59E0B', '#10B981']

const RADIAN = Math.PI / 180
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.05) return null
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export default function ReportPieChart({ title, data, height = 350, donut = true, innerRadius = 60, outerRadius = 110, showLegend = true, colors, centerLabel }: Props) {
  const palette = colors || DEFAULT_COLORS

  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data])

  return (
    <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', height: '100%' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>{title}</Typography>
      {data.length === 0 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: height - 80, color: 'text.secondary' }}>
          <Typography variant="body2">No data available</Typography>
        </Box>
      ) : (
        <Box sx={{ position: 'relative' }}>
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={donut ? renderCustomizedLabel : false}
                innerRadius={donut ? innerRadius : 0}
                outerRadius={outerRadius}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color || palette[i % palette.length]} stroke="white" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: any, name: any) => [typeof value === 'number' ? value.toLocaleString() : value, name]}
                contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              {showLegend && <Legend />}
            </PieChart>
          </ResponsiveContainer>
          {donut && centerLabel && (
            <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main' }}>{total}</Typography>
              <Typography variant="caption" color="text.secondary">{centerLabel}</Typography>
            </Box>
          )}
        </Box>
      )}
    </Paper>
  )
}
