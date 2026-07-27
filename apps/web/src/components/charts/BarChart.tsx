import { useMemo } from 'react'
import { Paper, Typography, Box } from '@mui/material'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'

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
  horizontal?: boolean
  showLegend?: boolean
  showGrid?: boolean
  stacked?: boolean
  seriesKeys?: string[]
  colors?: string[]
}

const DEFAULT_COLORS = ['#0F4C81', '#6366F1', '#16A34A', '#D97706', '#DC2626', '#EC4899', '#8B5CF6', '#0EA5E9']

export default function ReportBarChart({ title, data, height = 350, horizontal = false, showLegend = true, showGrid = true, stacked = false, seriesKeys, colors }: Props) {
  const palette = colors || DEFAULT_COLORS

  const hasMultipleSeries = seriesKeys && seriesKeys.length > 0

  const maxValue = useMemo(() => {
    if (!data.length) return 0
    if (hasMultipleSeries) {
      return Math.max(...data.map(d => seriesKeys!.reduce((sum, k) => sum + (d[k] || 0), 0)))
    }
    return Math.max(...data.map(d => d.value || 0))
  }, [data, seriesKeys, hasMultipleSeries])

  return (
    <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', height: '100%' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>{title}</Typography>
      {data.length === 0 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: height - 80, color: 'text.secondary' }}>
          <Typography variant="body2">No data available</Typography>
        </Box>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={data}
            layout={horizontal ? 'vertical' : 'horizontal'}
            margin={{ top: 5, right: 20, left: horizontal ? 80 : 20, bottom: horizontal ? 5 : 20 }}
          >
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />}
            {horizontal ? (
              <>
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
              </>
            ) : (
              <>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={data.length > 6 ? -45 : 0} textAnchor={data.length > 6 ? 'end' : 'middle'} height={data.length > 6 ? 60 : 40} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, maxValue * 1.1]} />
              </>
            )}
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              formatter={(value: any, name: any) => [typeof value === 'number' ? value.toLocaleString() : value, name === 'value' ? title : name]}
            />
            {showLegend && hasMultipleSeries && <Legend />}
            {hasMultipleSeries ? (
              seriesKeys!.map((key, i) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={palette[i % palette.length]}
                  stackId={stacked ? 'stack' : undefined}
                  radius={stacked ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                />
              ))
            ) : (
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={60}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color || palette[i % palette.length]} />
                ))}
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      )}
    </Paper>
  )
}
