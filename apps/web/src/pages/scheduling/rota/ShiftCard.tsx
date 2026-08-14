import { memo } from 'react'
import {
  Box, Typography, Stack, Chip, IconButton, Tooltip, Card, CardContent,
  ToggleButtonGroup, ToggleButton,
} from '@mui/material'
import {
  PersonAdd as AssignIcon,
  Delete as DeleteIcon,
  SwapHoriz as SwapHorizIcon,
  HowToReg as ClaimIcon,
  Close as CloseIcon,
} from '@mui/icons-material'
import { rotaHelpers } from './helpers'

interface ShiftCardProps {
  shift: any
  canEdit: boolean
  isReadOnly: boolean
  canClaim: boolean
  currentStaffId: string | null
  canEditLocation: (locationId: string) => boolean
  assignedStaffIdsByDate: Map<string, Set<string>>
  onOpenDetail: (shift: any) => void
  onAssign: (shiftId: string) => void
  onDeleteShift: (shiftId: string) => void
  onToggleCoverage: (shiftId: string, currentlyCovered: boolean) => void
  onClaimShift: (shiftId: string) => void
  onUnassign: (shiftId: string, staffId: string) => void
  onSwap: (shiftId: string, startTime?: string) => void
  compact?: boolean
}

const { isShiftPast, shiftVisual, shiftDurationHours } = rotaHelpers

export const ShiftCard = memo(function ShiftCard({
  shift, canEdit, isReadOnly, canClaim, currentStaffId, canEditLocation,
  assignedStaffIdsByDate, onOpenDetail, onAssign, onDeleteShift, onToggleCoverage,
  onClaimShift, onUnassign, onSwap, compact,
}: ShiftCardProps) {
  const isPast = isShiftPast(shift)
  const canEditShift = canEditLocation(shift.location_id) && !isPast
  const canAssignDate = assignedStaffIdsByDate.get(shift.start_time?.split('T')[0] || '')?.has(currentStaffId || '')
  const isOpen = (shift.assignments?.length || 0) === 0
  const vis = shiftVisual(shift)
  const durationH = Math.round(shiftDurationHours(shift))

  return (
    <Card
      variant="outlined"
      onClick={() => onOpenDetail(shift)}
      sx={{
        cursor: 'pointer',
        borderRadius: '10px',
        border: '1px solid #E4E4DD',
        bgcolor: isOpen ? '#FFFDF5' : '#FFFFFF',
        boxShadow: 'none',
        transition: 'box-shadow .15s ease, border-color .15s ease, transform .15s ease',
        '&:hover': {
          borderColor: '#0F4C81',
          boxShadow: '0 6px 16px -6px rgba(15,76,129,0.25)',
          transform: 'translateY(-1px)',
        },
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDetail(shift) } }}
    >
      <CardContent sx={{
        display: 'flex', gap: 0.75, p: compact ? 0.75 : 1, '&:last-child': { pb: compact ? 0.75 : 1 },
      }}>
        {/* Semantic rail: matches the shift bar color used in Timeline/Roster views */}
        <Box sx={{ width: 4, borderRadius: 999, bgcolor: vis.bar, alignSelf: 'stretch', flexShrink: 0 }} />

        <Box sx={{ minWidth: 0, flex: 1 }}>
          {/* Header: location + type + actions */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.4, gap: 0.5 }}>
            <Typography variant="caption" sx={{
              fontSize: compact ? '0.62rem' : '0.68rem', fontWeight: 800, color: '#0F4C81',
              textTransform: 'uppercase', letterSpacing: '0.04em',
              textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', minWidth: 0,
            }}>
              {shift.location_name || '—'}
            </Typography>
            <Stack direction="row" spacing={0.25} alignItems="center" sx={{ flexShrink: 0 }}>
              {shift.shift_type && shift.shift_type !== 'day' && (
                <Chip label={shift.shift_type === 'sleep' ? 'Sleep' : 'Wake Night'}
                  size="small" sx={{ height: 15, fontSize: '0.55rem', bgcolor: vis.chipBg, color: vis.chipFg, fontWeight: 700 }} />
              )}
              {!compact && (
                <Stack direction="row" spacing={0.1} onClick={(e) => e.stopPropagation()}>
                  {canEdit && !isReadOnly && canEditShift && (
                    <Tooltip title="Assign Staff">
                      <IconButton size="small" sx={{ p: 0.4 }} onClick={() => onAssign(shift.id)} aria-label="Assign staff">
                        <AssignIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {canEdit && !isReadOnly && canEditShift && (
                    <Tooltip title="Delete">
                      <IconButton size="small" sx={{ p: 0.4 }} onClick={() => onDeleteShift(shift.id)} aria-label="Delete shift">
                        <DeleteIcon sx={{ fontSize: 13, color: '#DC2626' }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              )}
            </Stack>
          </Stack>

          {/* Time + duration + open state */}
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.35 }}>
            <Typography variant="caption" sx={{
              fontSize: compact ? '0.72rem' : '0.76rem', fontWeight: 800, color: '#1B2430',
              fontVariantNumeric: 'tabular-nums', lineHeight: 1.2,
            }}>
              {shift._startLabel} – {shift._endLabel}
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '0.55rem', color: '#9CA3AF', fontWeight: 600 }}>
              {durationH}h
            </Typography>
            {isOpen && (
              <Chip label="Open" size="small"
                sx={{ height: 15, fontSize: '0.55rem', fontWeight: 800, bgcolor: '#FEF3C7', color: '#92400E', '& .MuiChip-label': { px: 0.6 } }} />
            )}
          </Stack>

          {shift.su_first_name && (
            <Typography variant="caption" sx={{
              fontSize: compact ? '0.58rem' : '0.64rem', color: '#6B7280', display: 'block', mb: 0.4,
              textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap',
            }}>
              {shift.su_first_name} {shift.su_last_name || ''}
            </Typography>
          )}

          {/* Assignments */}
          {shift.assignments?.length > 0 && (
            <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.3, mb: 0.25 }}>
              {shift.assignments.map((a: any) => (
                <StaffPill key={a.id} a={a} compact={compact}
                  isCurrent={currentStaffId === a.staff_id} isPast={isPast}
                  canDelete={canEdit && !isReadOnly && canEditShift}
                  onSwap={(e) => { e.stopPropagation(); onSwap(shift.id, shift.start_time) }}
                  onDelete={(e) => { e.stopPropagation(); onUnassign(shift.id, a.staff_id) }} />
              ))}
            </Stack>
          )}

          {/* Agency */}
          {shift.agency_id && (
            <Stack direction="row" spacing={0.4} alignItems="center" onClick={(e) => e.stopPropagation()} sx={{ mt: 0.3 }}>
              <Chip label="Agency" size="small" sx={{ height: 15, fontSize: '0.55rem', bgcolor: '#DBEAFE', color: '#1E40AF', fontWeight: 700 }} />
              {canEdit && !isReadOnly && canEditShift ? (
                <ToggleButtonGroup size="small" value={shift.agency_covered ? 'covered' : 'uncovered'} exclusive
                  onChange={() => onToggleCoverage(shift.id, shift.agency_covered)}
                  sx={{ height: 17, '& .MuiToggleButton-root': { px: 0.4, py: 0, fontSize: '0.52rem', lineHeight: 1, border: '1px solid #D1D5DB', textTransform: 'none', fontWeight: 700 } }}>
                  <ToggleButton value="covered" sx={{ bgcolor: shift.agency_covered ? '#D1FAE5' : 'transparent', color: shift.agency_covered ? '#065F46' : '#9CA3AF', '&:hover': { bgcolor: '#A7F3D0' } }}>
                    Yes
                  </ToggleButton>
                  <ToggleButton value="uncovered" sx={{ bgcolor: !shift.agency_covered ? '#FEF3C7' : 'transparent', color: !shift.agency_covered ? '#92400E' : '#9CA3AF', '&:hover': { bgcolor: '#FDE68A' } }}>
                    No
                  </ToggleButton>
                </ToggleButtonGroup>
              ) : (
                <Chip label={shift.agency_covered ? 'Covered' : 'Uncovered'} size="small"
                  sx={{ height: 15, fontSize: '0.55rem', bgcolor: shift.agency_covered ? '#D1FAE5' : '#FEF3C7', color: shift.agency_covered ? '#065F46' : '#92400E', fontWeight: 700 }} />
              )}
            </Stack>
          )}

          {/* Claim OT */}
          {isOpen && canClaim && currentStaffId && !isPast && !canAssignDate && (
            <ButtonBlock onClick={(e) => { e.stopPropagation(); onClaimShift(shift.id) }} />
          )}
          {!canEdit && isOpen && (
            <Typography variant="caption" sx={{ fontSize: '0.6rem', color: '#6B7280', display: 'block', mt: 0.3 }}>
              Open shift — contact manager to claim
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  )
})

function StaffPill({ a, compact, isCurrent, isPast, canDelete, onSwap, onDelete }: {
  a: any
  compact?: boolean
  isCurrent: boolean
  isPast: boolean
  canDelete: boolean
  onSwap: (e: any) => void
  onDelete: (e: any) => void
}) {
  const initials = `${(a.first_name || '?')[0]}${(a.last_name || '')?.[0] || ''}`.toUpperCase()

  return (
    <Box component="span" sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.35,
      height: compact ? 17 : 19, px: 0.5,
      borderRadius: '999px',
      border: '1px solid #E4E4DD',
      bgcolor: '#FAF9F5',
    }}>
      <Box sx={{
        width: 11, height: 11, borderRadius: '50%', flexShrink: 0,
        display: 'grid', placeItems: 'center',
        bgcolor: '#E0E7F1', color: '#0F4C81',
        fontSize: '0.42rem', fontWeight: 800, lineHeight: 1,
      }}>
        {initials}
      </Box>
      <Box component="span" sx={{
        fontSize: compact ? '0.56rem' : '0.6rem', fontWeight: 600, color: '#374151',
        whiteSpace: 'nowrap', lineHeight: 1,
      }}>
        {a.first_name} {a.last_name?.[0] || ''}
      </Box>
      {a.is_overtime && (
        <Box component="span" sx={{
          height: 11, lineHeight: '11px', px: 0.35, borderRadius: '4px',
          bgcolor: '#FEF3C7', color: '#92400E', fontSize: '0.5rem', fontWeight: 800,
        }}>
          OT
        </Box>
      )}
      {isCurrent && !isPast && (
        <SwapHorizIcon sx={{ fontSize: 11, cursor: 'pointer', color: '#0F4C81', ml: 0.1 }} onClick={onSwap} />
      )}
      {canDelete && (
        <CloseIcon sx={{ fontSize: 10, cursor: 'pointer', color: '#9CA3AF', ml: 0.1, '&:hover': { color: '#DC2626' } }} onClick={onDelete} />
      )}
    </Box>
  )
}

function ButtonBlock({ onClick }: { onClick: (e: any) => void }) {
  return (
    <Box component="span">
      <Tooltip title="Claim as overtime">
        <Chip label="Claim OT" icon={<ClaimIcon sx={{ fontSize: 11 }} />} size="small" variant="outlined"
          onClick={onClick} sx={{ height: 19, fontSize: '0.58rem', fontWeight: 700, mt: 0.3, cursor: 'pointer', color: '#B45309', borderColor: '#F59E0B' }} />
      </Tooltip>
    </Box>
  )
}
