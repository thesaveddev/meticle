import { useState } from 'react'
import { Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, TableSortLabel, Chip, Box, Stack, LinearProgress } from '@mui/material'

interface Column {
  key: string
  label: string
  type?: 'text' | 'number' | 'badge' | 'percent' | 'date' | 'currency' | 'progress'
}

interface Props {
  title: string
  columns: Column[]
  rows: Record<string, any>[]
  pageSize?: number
  dense?: boolean
}

const BADGE_COLORS: Record<string, string> = {
  approved: '#087A55', completed: '#087A55', valid: '#087A55', active: '#087A55', resolved: '#087A55', filled: '#087A55', administered: '#087A55',
  expired: '#B42318', overdue: '#B42318', missed: '#B42318', rejected: '#B42318', critical: '#B42318', high: '#9A6700',
  pending: '#9A6700', investigating: '#175CD3', in_progress: '#0C9E89', open: '#9A6700',
  expiring_30: '#B42318', expiring_90: '#9A6700',
  ORG_ADMIN: '#175CD3', MANAGER: '#0C9E89', CARE_WORKER: '#087A55', COMPLIANCE_OFFICER: '#9A6700',
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: '#B42318', high: '#9A6700', medium: '#9A6700', low: '#175CD3',
}

function CellValue({ value, type }: { value: any; type?: string }) {
  if (value === null || value === undefined) return <Typography variant="body2" color="text.secondary">-</Typography>

  if (type === 'badge') {
    const strVal = String(value)
    const color = SEVERITY_BADGE[strVal] || BADGE_COLORS[strVal] || '#667085'
    return <Chip label={strVal.replace(/_/g, ' ')} size="small" sx={{ fontWeight: 600, bgcolor: `${color}15`, color, fontSize: '0.7rem', height: 22 }} />
  }

  if (type === 'percent') {
    const num = Number(value)
    const barColor = num >= 80 ? '#10B981' : num >= 50 ? '#F59E0B' : '#EF4444'
    return (
      <Stack direction="row" alignItems="center" spacing={1}>
        <LinearProgress variant="determinate" value={num} sx={{ width: 50, height: 5, borderRadius: 3, bgcolor: '#F5F7FA', '& .MuiLinearProgress-bar': { bgcolor: barColor } }} />
        <Typography variant="body2" fontWeight={700} color={barColor}>{num}%</Typography>
      </Stack>
    )
  }

  if (type === 'number') {
    return <Typography variant="body2" fontWeight={600}>{Number(value).toLocaleString()}</Typography>
  }

  if (type === 'currency') {
    return <Typography variant="body2" fontWeight={600}>£{Number(value).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>
  }

  if (type === 'date') {
    const d = new Date(value)
    if (isNaN(d.getTime())) return <Typography variant="body2">-</Typography>
    return <Typography variant="body2">{d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Typography>
  }

  return <Typography variant="body2">{String(value)}</Typography>
}

export default function ReportTableComponent({ title, columns, rows, pageSize = 15, dense = false }: Props) {
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(pageSize)
  const [orderBy, setOrderBy] = useState<string>('')
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')

  const handleSort = (key: string) => {
    if (orderBy === key) {
      setOrder(order === 'asc' ? 'desc' : 'asc')
    } else {
      setOrderBy(key)
      setOrder('asc')
    }
  }

  const sortedRows = [...rows].sort((a, b) => {
    if (!orderBy) return 0
    const aVal = a[orderBy]
    const bVal = b[orderBy]
    if (aVal === bVal) return 0
    if (aVal === null || aVal === undefined) return 1
    if (bVal === null || bVal === undefined) return -1
    const cmp = typeof aVal === 'number' ? aVal - bVal : String(aVal).localeCompare(String(bVal))
    return order === 'asc' ? cmp : -cmp
  })

  const pagedRows = sortedRows.slice(page * rowsPerPage, (page + 1) * rowsPerPage)

  return (
    <Paper sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
      <Box sx={{ p: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
          <Chip label={`${rows.length} records`} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
        </Stack>
      </Box>

      {rows.length === 0 ? (
        <Box sx={{ p: 6, textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="body2">No data available for the selected filters</Typography>
        </Box>
      ) : (
        <>
          <TableContainer sx={{ maxHeight: 600 }}>
            <Table size={dense ? 'small' : 'medium'} stickyHeader>
              <TableHead>
                <TableRow>
                  {columns.filter(c => c.label).map(col => (
                    <TableCell key={col.key} sx={{ fontWeight: 700, bgcolor: 'notice.subtle.bg', whiteSpace: 'nowrap' }}>
                      <TableSortLabel
                        active={orderBy === col.key}
                        direction={orderBy === col.key ? order : 'asc'}
                        onClick={() => handleSort(col.key)}
                      >
                        {col.label}
                      </TableSortLabel>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {pagedRows.map((row, i) => (
                  <TableRow key={i} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                    {columns.filter(c => c.label).map(col => (
                      <TableCell key={col.key}>
                        <CellValue value={row[col.key]} type={col.type} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {rows.length > rowsPerPage && (
            <TablePagination
              component="div"
              count={rows.length}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0) }}
              rowsPerPageOptions={[10, 15, 25, 50]}
            />
          )}
        </>
      )}
    </Paper>
  )
}
