import { useMemo } from 'react'
import {
  Box, Typography, Stack, Chip, IconButton, Tooltip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper,
} from '@mui/material'
import { Add as AddIcon, Warning as WarningIcon, Check as CheckIcon } from '@mui/icons-material'
import type { RotaViewProps } from './types'
import { rotaHelpers } from './helpers'

const { DAYS, toLocalDateStr, isDayPast, shiftMatchesDay, shiftDurationHours, shiftVisual } = rotaHelpers

const roleColor = (role?: string) => {
  switch (role) {
    case 'ORG_ADMIN': return { bg: '#DBEAFE', fg: '#1E40AF' }
    case 'MANAGER': return { bg: '#EDE9FE', fg: '#5B21B6' }
    default: return { bg: '#D1FAE5', fg: '#065F46' }
  }
}

export default function RosterView(props: RotaViewProps) {
  const { weekDates, shifts, staffList, weekDayStats, canEdit, isReadOnly } = props

  // shiftsByStaff: staff_id -> array of shifts where they are assigned
  const shiftsByStaff = useMemo(() => {
    const m = new Map<string, any[]>()
    for (const s of shifts) {
      for (const a of s.assignments || []) {
        const arr = m.get(a.staff_id)
        if (arr) arr.push(s)
        else m.set(a.staff_id, [s])
      }
    }
    for (const arr of m.values()) arr.sort((a, b) => (a._startDate + a._startTime).localeCompare(b._startDate + b._startTime))
    return m
  }, [shifts])

  // Only show staff with any shift this week (keeps roster scannable)
  const visibleStaff = useMemo(() => {
    return staffList.filter((s: any) => shiftsByStaff.has(s.staff_id))
  }, [staffList, shiftsByStaff])

  const weeklyHoursByStaff = useMemo(() => {
    const m = new Map<string, number>()
    for (const [staffId, list] of shiftsByStaff) {
      const total = list.reduce((acc, s) => acc + shiftDurationHours(s), 0)
      m.set(staffId, Math.round(total * 10) / 10)
    }
    return m
  }, [shiftsByStaff])

  const dayCell = (staff: any, d: Date) => {
    const dateStr = toLocalDateStr(d)
    return (shiftsByStaff.get(staff.staff_id) || []).filter(s => shiftMatchesDay(s, dateStr))
  }

  return (
    <TableContainer component={Paper} sx={{ overflowX: 'auto', maxHeight: 620 }}>
      <Table size="small" sx={{ minWidth: 900, borderCollapse: 'separate', borderSpacing: 0 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{
              fontWeight: 700, bgcolor: '#F8FAFC', position: 'sticky', left: 0, top: 0, zIndex: 3, minWidth: 170, fontSize: '0.7rem',
            }}>
              Staff
            </TableCell>
            {weekDates.map((d, i) => {
              const today = d.toDateString() === new Date().toDateString()
              const past = isDayPast(d)
              const stats = weekDayStats[i] || []
              const short = stats.filter(x => !x.ok)
              return (
                <TableCell key={i} sx={{
                  fontWeight: 700, bgcolor: today ? '#E7EEF4' : '#F8FAFC', textAlign: 'center',
                  position: 'sticky', top: 0, zIndex: 2, minWidth: 120, fontSize: '0.7rem',
                }}>
                  <Stack direction="row" spacing={0.4} alignItems="center" justifyContent="center">
                    <Box>
                      <Box sx={{ fontWeight: 800, color: today ? '#0F4C81' : '#1B2430', lineHeight: 1.1 }}>{DAYS[i]}</Box>
                      <Box sx={{ fontSize: '0.6rem', color: '#6B7280', fontWeight: 500 }}>{d.getDate()}</Box>
                    </Box>
                    {short.length > 0 ? (
                      <Tooltip title={short.map(x => `${x.loc.name}: ${x.cnt}/${x.need}`).join(', ')}>
                        <WarningIcon sx={{ fontSize: 13, color: '#D97706' }} />
                      </Tooltip>
                    ) : stats.length > 0 ? (
                      <CheckIcon sx={{ fontSize: 13, color: '#10B981' }} />
                    ) : null}
                    {canEdit && !isReadOnly && !past && (
                      <IconButton size="small" onClick={() => props.onOpenShiftDialog(d)} sx={{ p: 0.2 }}
                        aria-label={`Add shift for ${DAYS[i]}`}>
                        <AddIcon sx={{ fontSize: 13, color: '#0F4C81' }} />
                      </IconButton>
                    )}
                  </Stack>
                </TableCell>
              )
            })}
          </TableRow>
        </TableHead>
        <TableBody>
          {visibleStaff.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} align="center" sx={{ py: 4, color: '#6B7280', fontSize: '0.75rem' }}>
                No staff assigned to shifts this week
              </TableCell>
            </TableRow>
          )}
          {visibleStaff.map(staff => {
            const role = roleColor(staff.role)
            const weeklyHours = weeklyHoursByStaff.get(staff.staff_id) || 0
            return (
              <TableRow key={staff.staff_id} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                <TableCell sx={{
                  position: 'sticky', left: 0, bgcolor: '#fff', zIndex: 1, minWidth: 170, borderRight: '1px solid #F3F4F6',
                }}>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.72rem', lineHeight: 1.2 }}>
                        {staff.first_name} {staff.last_name}
                      </Typography>
                      <Typography variant="caption" sx={{ fontSize: '0.58rem', color: '#6B7280', display: 'block' }}>
                        {staff.location_name || '—'} · {weeklyHours}h
                      </Typography>
                    </Box>
                    <Chip label={staff.role?.replace(/_/g, ' ').toLowerCase()} size="small"
                      sx={{ height: 15, fontSize: '0.5rem', bgcolor: role.bg, color: role.fg, fontWeight: 700 }} />
                  </Stack>
                </TableCell>
                {weekDates.map((d, i) => {
                  const cellShifts = dayCell(staff, d)
                  const today = d.toDateString() === new Date().toDateString()
                  return (
                    <TableCell key={i} sx={{
                      textAlign: 'center', verticalAlign: 'top', minWidth: 120,
                      bgcolor: today ? '#F7FAFC' : 'inherit', p: 0.5,
                    }}>
                      {cellShifts.length === 0 ? (
                        <Typography variant="caption" sx={{ fontSize: '0.55rem', color: '#D1D5DB' }}>—</Typography>
                      ) : (
                        <Stack spacing={0.3}>
                          {cellShifts.map(s => {
                            const vis = shiftVisual(s)
                            return (
                              <Tooltip key={s.id} title={`${s.location_name} · ${s._startLabel}–${s._endLabel}${s.shift_type !== 'day' ? ` · ${s.shift_type === 'sleep' ? 'Sleep' : 'Wake Night'}` : ''}`}>
                                <Chip
                                  label={`${s._startLabel}-${s._endLabel}`}
                                  size="small"
                                  onClick={() => props.onOpenDetail(s)}
                                  sx={{
                                    cursor: 'pointer', height: 17, fontSize: '0.55rem', fontWeight: 700,
                                    bgcolor: vis.chipBg, color: vis.chipFg, width: '100%', '&:hover': { filter: 'brightness(0.97)', borderColor: '#0F4C81' },
                                  }}
                                />
                              </Tooltip>
                            )
                          })}
                        </Stack>
                      )}
                    </TableCell>
                  )
                })}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
