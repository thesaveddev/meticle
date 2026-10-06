import { useMemo } from 'react'
import {
  Box, Typography, Stack, Paper, IconButton, Tooltip, Chip,
} from '@mui/material'
import { Add as AddIcon, Warning as WarningIcon, Check as CheckIcon } from '@mui/icons-material'
import type { RotaViewProps } from './types'
import { rotaHelpers } from './helpers'
import { ShiftCard } from './ShiftCard'

const { DAYS, toLocalDateStr, isDayPast, sortShiftsByStart, shiftMatchesDay } = rotaHelpers

export default function DayBoardView(props: RotaViewProps) {
  const {
    weekDates, shifts, weekDayStats, canEdit, isReadOnly, selectedLocationId,
  } = props

  const shiftsByDate = useMemo(() => {
    const m = new Map<string, any[]>()
    for (const s of shifts) {
      const arr = m.get(s._startDate)
      if (arr) arr.push(s)
      else m.set(s._startDate, [s])
    }
    return m
  }, [shifts])

  return (
    <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 1 }}>
      {weekDates.map((d, i) => {
        const dateStr = toLocalDateStr(d)
        const dayShifts = (shiftsByDate.get(dateStr) || []).filter(s => shiftMatchesDay(s, dateStr)).sort(sortShiftsByStart)
        const stats = weekDayStats[i] || []
        const shortLocs = stats.filter(x => !x.ok)
        const today = d.toDateString() === new Date().toDateString()
        const past = isDayPast(d)

        return (
          <Paper key={i} variant="outlined" sx={{
            flex: '1 1 0', minWidth: 165, maxWidth: 240, p: 1, display: 'flex', flexDirection: 'column',
            bgcolor: today ? '#E6EAF0' : '#FFFFFF', borderColor: today ? '#EAF3FF' : undefined,
          }}>
            {/* Column header */}
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 0.75 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1.1, color: today ? '#2F80ED' : '#17202A' }}>
                  {DAYS[i]}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                  {d.getDate()} {d.toLocaleDateString('en-GB', { month: 'short' })}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.25} alignItems="center">
                {shortLocs.length > 0 && (
                  <Tooltip title={shortLocs.map(x => `${x.loc.name}: ${x.cnt}/${x.need}`).join(', ')}>
                    <Chip icon={<WarningIcon sx={{ fontSize: 11 }} />} label={`${shortLocs.length} short`} size="small"
                      sx={{ height: 18, fontSize: '0.55rem', bgcolor: 'notice.warning.bg', color: 'notice.warning.fg', '& .MuiChip-icon': { color: 'notice.warning.fg' } }} />
                  </Tooltip>
                )}
                {shortLocs.length === 0 && stats.length > 0 && (
                  <Chip icon={<CheckIcon sx={{ fontSize: 11 }} />} label="Covered" size="small"
                    sx={{ height: 18, fontSize: '0.55rem', bgcolor: 'notice.success.bg', color: 'notice.success.fg', '& .MuiChip-icon': { color: 'notice.success.fg' } }} />
                )}
                {canEdit && !isReadOnly && !past && (
                  <IconButton size="small" onClick={() => props.onOpenShiftDialog(d)}
                    sx={{ bgcolor: '#2F80ED', color: '#FFFFFF', width: 22, height: 22, '&:hover': { bgcolor: '#2674D9' } }}
                    aria-label={`Add shift for ${DAYS[i]}`}>
                    <AddIcon sx={{ fontSize: 13 }} />
                  </IconButton>
                )}
              </Stack>
            </Stack>

            {/* Coverage strip */}
            {stats.length > 0 && (
              <Stack direction="row" spacing={0.4} sx={{ mb: 0.75, flexWrap: 'wrap', gap: 0.4 }} useFlexGap>
                {stats.map(x => (
                  <Tooltip key={x.loc.id} title={`${x.loc.name}: ${x.cnt}/${x.need}${x.care > x.min ? ` (${x.care} care-needs)` : ''}`}>
                    <Chip label={selectedLocationId ? `${x.cnt}/${x.need}` : x.loc.name.split(' ')[0]}
                      size="small"
                      sx={{
                        height: 16, fontSize: '0.52rem', fontWeight: 700, cursor: 'help',
                        bgcolor: x.ok ? '#EAFBF5' : '#FFF7E6',
                        color: x.ok ? '#087A55' : '#9A6700',
                        '& .MuiChip-icon': { color: x.ok ? '#10B981' : '#F59E0B' },
                      }} />
                  </Tooltip>
                ))}
              </Stack>
            )}

            {/* Shift cards */}
            <Stack spacing={0.75} sx={{ flex: 1, overflowY: 'auto', maxHeight: 560, pr: 0.25 }}>
              {dayShifts.length === 0 ? (
                <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', textAlign: 'center', py: 2 }}>
                  No shifts
                </Typography>
              ) : dayShifts.map(s => (
                <ShiftCard key={s.id} shift={s} compact
                  canEdit={props.canEdit} isReadOnly={props.isReadOnly} canClaim={props.canClaim}
                  currentStaffId={props.currentStaffId} canEditLocation={props.canEditLocation}
                  assignedStaffIdsByDate={props.assignedStaffIdsByDate}
                  onOpenDetail={props.onOpenDetail} onAssign={props.onAssign}
                  onDeleteShift={props.onDeleteShift} onToggleCoverage={props.onToggleCoverage}
                  onClaimShift={props.onClaimShift} onUnassign={props.onUnassign} onSwap={props.onSwap} />
              ))}
            </Stack>
          </Paper>
        )
      })}
    </Box>
  )
}
