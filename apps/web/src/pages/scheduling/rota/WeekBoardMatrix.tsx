import { Typography, Stack, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material'
import { rotaHelpers } from './helpers'

const { DAYS, toLocalDateStr, isDayPast } = rotaHelpers

const fmtTime = (iso: string) => {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

interface WeekBoardMatrixProps {
  weekDates: Date[]
  /** Location rows to render (already scoped by the page filter). */
  locations: any[]
  /** Shifts to display (already scoped + filtered by the page). */
  shifts: any[]
  weekDayStats: any[][]
  canAdd: boolean
  onAddDay: (date: Date) => void
  onOpenDetail: (shift: any) => void
}

/**
 * Figma 4.1 week board: locations down the side, days across the top.
 * Each cell names its gap (`N short`) and lists the shifts that cover it;
 * selecting an empty part of a cell starts a shift there, selecting a shift
 * opens its detail dialog where assign/claim/edit all still live.
 */
export default function WeekBoardMatrix({
  weekDates, locations, shifts, weekDayStats, canAdd, onAddDay, onOpenDetail,
}: WeekBoardMatrixProps) {
  const shiftsByLocDay = (() => {
    const m = new Map<string, any[]>()
    for (const s of shifts) {
      const key = `${s.location_id}|${s._startDate}`
      const arr = m.get(key)
      if (arr) arr.push(s)
      else m.set(key, [s])
    }
    for (const arr of m.values()) arr.sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))
    return m
  })()

  const statFor = (dayIdx: number, locId: string) =>
    (weekDayStats[dayIdx] || []).find((x: any) => x.loc.id === locId)

  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size="small" sx={{ minWidth: 760 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', minWidth: 170 }}>Location</TableCell>
            {weekDates.map((d, i) => (
              <TableCell key={i} sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', minWidth: 120 }}>
                {DAYS[i].slice(0, 3)} {d.getDate()}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {locations.map((loc: any) => {
            const dayStats = weekDates.map((_, i) => statFor(i, loc.id))
            const shortDays = dayStats.filter(x => x && !x.ok).length
            const need = dayStats.find(x => x)?.need ?? 1
            return (
              <TableRow key={loc.id} hover>
                <TableCell sx={{ verticalAlign: 'top' }}>
                  <Typography variant="body2" fontWeight={700}>{loc.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {shortDays === 0 ? `Covered · needs ${need} a day` : `${shortDays} day${shortDays === 1 ? '' : 's'} short · needs ${need} a day`}
                  </Typography>
                </TableCell>
                {weekDates.map((d, i) => {
                  const dateStr = toLocalDateStr(d)
                  const cellShifts = shiftsByLocDay.get(`${loc.id}|${dateStr}`) || []
                  const stat = dayStats[i]
                  const shortBy = stat ? Math.max(0, stat.need - stat.cnt) : 0
                  const past = isDayPast(d)
                  return (
                    <TableCell
                      key={i}
                      onClick={() => { if (canAdd && !past) onAddDay(d) }}
                      sx={{
                        verticalAlign: 'top',
                        ...(canAdd && !past ? { cursor: 'pointer', '&:hover': { bgcolor: '#F0F5FC' } } : {}),
                      }}
                    >
                      <Stack spacing={0.5} alignItems="flex-start">
                        {shortBy > 0 && (
                          <Chip label={`${shortBy} short`} size="small"
                            sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: '#FEF0F0', color: '#B42318' }} />
                        )}
                        {cellShifts.length === 0 ? (
                          <Typography variant="caption" color="text.secondary">No shifts</Typography>
                        ) : (
                          cellShifts.map((s: any) => {
                            const names = (s.assignments || [])
                              .map((a: any) => a.first_name || a.staff_name || '')
                              .filter(Boolean)
                            return (
                              <Chip
                                key={s.id}
                                size="small"
                                label={`${fmtTime(s.start_time)}–${fmtTime(s.end_time)}${names.length ? ` · ${names.slice(0, 2).join(', ')}${names.length > 2 ? ` +${names.length - 2}` : ''}` : ' · Open'}`}
                                onClick={(e) => { e.stopPropagation(); onOpenDetail(s) }}
                                sx={{
                                  maxWidth: '100%', height: 'auto', minHeight: 22, py: 0.25,
                                  fontSize: 11, fontWeight: 600,
                                  bgcolor: names.length ? '#EAF3FF' : '#FFF7E6',
                                  color: names.length ? '#004085' : '#9A6700',
                                  '& .MuiChip-label': { whiteSpace: 'normal', lineHeight: 1.3 },
                                }}
                              />
                            )
                          })
                        )}
                      </Stack>
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
