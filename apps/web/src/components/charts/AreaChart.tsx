import { Paper, Typography, Box } from '@mui/material'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

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
  showGrid?: boolean
  seriesKeys?: string[]
  colors?: string[]
  stacked?: boolean
}

const DEFAULT_COLORS = ['#2F80ED', '#10BFA5', '#10B981', '#F59E0B', '#EF4444', '#8B7CF6', '#6B8AFD', '#94A3B8']

export default function ReportAreaChart({ title, data, height = 350, showLegend = true, showGrid = true, seriesKeys, colors, stacked = false }: Props) {
  const palette = colors || DEFAULT_COLORS
  const hasMultipleSeries = seriesKeys && seriesKeys.length > 0

  return (
    <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', height: '100%' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>{title}</Typography>
      {data.length === 0 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: height - 80, color: 'text.secondary' }}>
          <Typography variant="body2">No data available</Typography>
        </Box>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 20 }}>
            <defs>
              {palette.map((color, i) => (
                <linearGradient key={i} id={`gradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.05} />
                </linearGradient>
              ))}
            </defs>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#E6EAF0" />}
            <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={data.length > 8 ? -45 : 0} textAnchor={data.length > 8 ? 'end' : 'middle'} height={data.length > 8 ? 60 : 40} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #E6EAF0', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              formatter={(value: any, name: any) => [typeof value === 'number' ? value.toLocaleString() : value, name === 'value' ? title : name]}
            />
            {showLegend && hasMultipleSeries && <Legend />}
            {hasMultipleSeries ? (
              seriesKeys!.map((key, i) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stackId={stacked ? 'stack' : undefined}
                  stroke={palette[i % palette.length]}
                  fill={`url(#gradient-${i % palette.length})`}
                  strokeWidth={2}
                />
              ))
            ) : (
              <Area
                type="monotone"
                dataKey="value"
                stroke={palette[0]}
                fill="url(#gradient-0)"
                strokeWidth={2.5}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Paper>
  )
}
