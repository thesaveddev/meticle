import { useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { Box, Typography, Stack, Tooltip, Chip } from '@mui/material'
import { Add as AddIcon, Warning as WarningIcon, Check as CheckIcon } from '@mui/icons-material'
import type { RotaViewProps } from './types'
import { rotaHelpers } from './helpers'

const { DAYS, toLocalDateStr, isDayPast, shiftStartMinutes, shiftEndMinutes, shiftMatchesDay, shiftDurationHours, shiftVisual } = rotaHelpers

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const PIXELS_PER_HOUR = 48
const LANE_HEIGHT = 46

// Stack overlapping shifts into sub-lanes within one location lane
function stackOverlaps(items: any[]): any[][] {
  const lanes: any[][] = []
  for (const item of items) {
    let placed = false
    for (const lane of lanes) {
      const last = lane[lane.length - 1]
      if (last._endMin <= item._startMin) {
        lane.push(item)
        placed = true
        break
      }
    }
    if (!placed) lanes.push([item])
  }
  return lanes
}

export default function TimelineView(props: RotaViewProps) {
  const {
    weekDates, shifts, locations, weekDayStats, selectedLocationId, canEdit, isReadOnly,
  } = props
  const [dayIndex, setDayIndex] = useState(0)
  const day = weekDates[Math.min(dayIndex, weekDates.length - 1)]
  const dateStr = toLocalDateStr(day)
  const past = isDayPast(day)

  const now = new Date()
  const isToday = day.toDateString() === now.toDateString()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const visibleLocations = selectedLocationId
    ? locations.filter(l => l.id === selectedLocationId)
    : locations

  const totalWidth = 24 * PIXELS_PER_HOUR

  const dayShifts = useMemo(() => {
    return shifts
      .filter(s => shiftMatchesDay(s, dateStr))
      .map(s => {
        const startsToday = s._startDate === dateStr
        const endsToday = s._endDate === dateStr
        const _startMin = startsToday ? shiftStartMinutes(s) : 0
        const _endMin = endsToday ? Math.max(shiftStartMinutes(s) + 30, shiftEndMinutes(s)) : 1440
        return { ...s, _startMin, _endMin }
      })
      .sort((a, b) => a._startMin - b._startMin || b._endMin - a._endMin)
  }, [shifts, dateStr])

  const locationLanes = visibleLocations.map(loc => {
    const locShifts = dayShifts.filter(s => s.location_id === loc.id)
    return { loc, lanes: stackOverlaps(locShifts) }
  })

  const maxSubLanes = Math.max(1, ...locationLanes.map(x => x.lanes.length))
  const laneContainerHeight = LANE_HEIGHT * maxSubLanes + 6

  const openShiftAt = (e: MouseEvent<HTMLElement>) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const hour = Math.max(0, Math.min(23, Math.floor((e.clientX - rect.left) / PIXELS_PER_HOUR)))
    props.onOpenShiftDialogAt(day, hour)
  }

  return (
    <Box>
      {/* Day selector */}
      <Stack direction="row" spacing={0.5} sx={{ mb: 1, overflowX: 'auto', pb: 0.5 }} useFlexGap>
        {weekDates.map((d, i) => {
          const isToday = d.toDateString() === new Date().toDateString()
          const stats = weekDayStats[i] || []
          const short = stats.filter(x => !x.ok).length
          return (
            <Tooltip key={i} title={short > 0 ? `${short} location${short > 1 ? 's' : ''} short` : 'All locations covered'}>
              <Chip
                label={`${DAYS[i]} ${d.getDate()}`}
                icon={short > 0 ? <WarningIcon sx={{ fontSize: 12, color: '#D97706' }} /> : undefined}
                size="small"
                onClick={() => setDayIndex(i)}
                sx={{
                  cursor: 'pointer', fontWeight: 700, fontSize: '0.65rem', minWidth: 58, textAlign: 'center',
                  '& .MuiChip-icon': { ml: '6px', mr: '-4px' },
                  bgcolor: i === dayIndex ? '#0F4C81' : isToday ? '#E7EEF4' : '#F3F4F6',
                  color: i === dayIndex ? '#fff' : isToday ? '#0F4C81' : '#4B5563',
                  '&:hover': { bgcolor: i === dayIndex ? '#0A3A61' : '#E5E7EB' },
                }}
              />
            </Tooltip>
          )
        })}
      </Stack>

      <Box sx={{ position: 'relative', pl: '140px' }}>
        {/* Hour axis */}
        <Box sx={{ position: 'relative', height: 22, mb: 0.5 }}>
          {HOURS.map(h => (
            <Box key={h} sx={{ position: 'absolute', left: h * PIXELS_PER_HOUR - 12, top: 0, width: 24, textAlign: 'center' }}>
              <Typography variant="caption" sx={{ fontSize: '0.55rem', color: '#6B7280' }}>{h}:00</Typography>
            </Box>
          ))}
        </Box>

        {/* Vertical gridlines + now cue */}
        <Box sx={{ position: 'absolute', left: 140, top: 22, width: totalWidth, height: locationLanes.length * (laneContainerHeight + 26), pointerEvents: 'none', zIndex: 0 }}>
          {HOURS.map(h => (
            <Box key={h} sx={{
              position: 'absolute', left: h * PIXELS_PER_HOUR, top: 0, bottom: 0,
              borderLeft: h % 4 === 0 ? '1px solid #E5E7EB' : '1px dashed #F1F5F9',
            }} />
          ))}
          <Box sx={{ position: 'absolute', left: totalWidth, top: 0, bottom: 0, borderLeft: '1px solid #E5E7EB' }} />
          {isToday && (
            <Box sx={{ position: 'absolute', left: nowMinutes / 60 * PIXELS_PER_HOUR, top: 0, bottom: 0 }}>
              <Box sx={{ position: 'absolute', top: -3, left: -3, width: 6, height: 6, borderRadius: '50%', bgcolor: '#10B981' }} />
              <Box sx={{ width: 2, height: '100%', bgcolor: '#10B981', opacity: 0.65 }} />
            </Box>
          )}
        </Box>

        {/* Location lanes */}
        {locationLanes.map(({ loc, lanes }) => {
          const stats = weekDayStats[Math.min(dayIndex, weekDates.length - 1)]?.find(x => x.loc.id === loc.id)
          return (
            <Box key={loc.id} sx={{ position: 'relative', height: laneContainerHeight, mt: 1, mb: 1.5 }}>
              {/* Location label */}
              <Box sx={{ position: 'absolute', left: -140, top: 2, width: 130, pr: 1 }}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#1B2430', lineHeight: 1.15 }}>
                    {loc.name}
                  </Typography>
                  {stats && (
                    stats.ok
                      ? <CheckIcon sx={{ fontSize: 13, color: '#10B981' }} />
                      : <Tooltip title={`${stats.cnt}/${stats.need}${stats.care > stats.min ? ` (${stats.care} care-needs)` : ''}`}>
                          <WarningIcon sx={{ fontSize: 13, color: '#D97706' }} />
                        </Tooltip>
                  )}
                </Stack>
                {stats && (
                  <Typography variant="caption" sx={{ fontSize: '0.55rem', color: stats.ok ? '#047857' : '#B45309', fontWeight: 600, display: 'block' }}>
                    {stats.ok ? 'Covered' : `${stats.cnt}/${stats.need} short`}
                  </Typography>
                )}
              </Box>

              {/* Lane background */}
              <Box sx={{
                position: 'absolute', top: 0, left: 0, right: 0, height: laneContainerHeight,
                bgcolor: '#FBFBFA', borderRadius: 1, border: '1px solid #EEF1F4',
              }} />

              {/* Shift bars (above the add zone so they stay clickable) */}
              {lanes.map((lane, subIdx) => (
                <Box key={subIdx} sx={{ position: 'absolute', top: subIdx * LANE_HEIGHT + 3, left: 0, right: 0, height: LANE_HEIGHT - 6, zIndex: 2 }}>
                  {lane.map(s => {
                    const w = Math.max(20, shiftDurationHours(s) * PIXELS_PER_HOUR)
                    const vis = shiftVisual(s)
                    const staffLabel = s.assignments?.length > 0
                      ? s.assignments.map((a: any) => `${a.first_name} ${a.last_name?.[0] || ''}`).join(', ')
                      : 'Open'
                    return (
                      <Tooltip key={s.id} title={`${s.location_name} · ${s._startLabel}–${s._endLabel} · ${staffLabel}`}>
                        <Box
                          role="button"
                          tabIndex={0}
                          aria-label={`${s.location_name}, ${s._startLabel} to ${s._endLabel}, ${staffLabel}`}
                          onClick={() => props.onOpenDetail(s)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); props.onOpenDetail(s) } }}
                          sx={{
                            position: 'absolute', top: 0, left: s._startMin / 60 * PIXELS_PER_HOUR, width: w, height: '100%',
                            bgcolor: vis.bar, color: vis.barText, borderRadius: '6px', cursor: 'pointer',
                            px: 0.5, display: 'flex', alignItems: 'center', overflow: 'hidden',
                            fontSize: '0.58rem', fontWeight: 700, whiteSpace: 'nowrap',
                            boxShadow: '0 1px 2px rgba(15,32,44,0.12)',
                            outlineOffset: -2,
                            '&:hover': { filter: 'brightness(0.97)', boxShadow: '0 2px 6px rgba(15,32,44,0.18)' },
                            '&:focus-visible': { outline: '2px solid #10B981' },
                          }}
                        >
                          <Typography component="span" sx={{ fontSize: '0.55rem', fontWeight: 700, textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            {s._startLabel}-{s._endLabel} · {staffLabel}
                          </Typography>
                        </Box>
                      </Tooltip>
                    )
                  })}
                </Box>
              ))}

              {/* Add shift zone — clickable empty lane area (behind bars) */}
              {canEdit && !isReadOnly && !past && (
                <Box
                  role="button"
                  tabIndex={0}
                  aria-label={`Add shift at ${loc.name}`}
                  onClick={openShiftAt}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); props.onOpenShiftDialogAt(day, Math.max(0, Math.min(23, Math.round(nowMinutes / 60)))) } }}
                  sx={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: laneContainerHeight, zIndex: 1,
                    cursor: 'copy', borderRadius: 1, outlineOffset: -2,
                    '&:hover': { bgcolor: 'rgba(15,76,129,0.05)' },
                    '&:focus-visible': { outline: '2px solid #10B981' },
                    '&:hover .rota-add-pill': { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
                  }}
                >
                  <Box className="rota-add-pill" sx={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) scale(0.96)',
                    display: 'flex', alignItems: 'center', gap: 0.4, px: 1.2, py: 0.35, borderRadius: '999px',
                    bgcolor: '#0F4C81', color: '#fff', fontSize: '0.6rem', fontWeight: 700, pointerEvents: 'none',
                    opacity: 0, transition: 'opacity 0.15s ease, transform 0.15s ease',
                  }}>
                    <AddIcon sx={{ fontSize: 12 }} />Add shift
                  </Box>
                </Box>
              )}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
