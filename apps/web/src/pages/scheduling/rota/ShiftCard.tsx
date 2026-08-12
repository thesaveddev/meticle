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

const { isShiftPast, shiftVisual } = rotaHelpers

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

  return (
    <Card
      variant="outlined"
      onClick={() => onOpenDetail(shift)}
      sx={{
        cursor: 'pointer',
        borderRadius: 1.5,
        border: '1px solid #E5E7EB',
        borderTopWidth: 3,
        borderTopColor: isOpen ? '#F59E0B' : '#10B981',
        bgcolor: isOpen ? '#FFFBEB' : '#FFFFFF',
        '&:hover': { borderColor: '#0F4C81', borderTopColor: isOpen ? '#F59E0B' : '#10B981', boxShadow: '0 4px 12px -4px rgba(15,76,129,0.2)' },
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDetail(shift) } }}
    >
      <CardContent sx={{ p: compact ? 0.75 : 1, '&:last-child': { pb: compact ? 0.75 : 1 } }}>
        {/* Header: location + type + actions */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
            <Typography variant="caption" sx={{ fontSize: compact ? '0.62rem' : '0.68rem', fontWeight: 700, color: '#0F4C81', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {shift.location_name || '—'}
            </Typography>
            {shift.shift_type && shift.shift_type !== 'day' && (
              <Chip label={shift.shift_type === 'sleep' ? 'Sleep' : 'Wake Night'}
                size="small" sx={{ height: 15, fontSize: '0.55rem', bgcolor: vis.chipBg, color: vis.chipFg, fontWeight: 700 }} />
            )}
          </Stack>
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

        {/* Time + service user */}
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
          <Typography variant="caption" sx={{ fontSize: compact ? '0.6rem' : '0.66rem', fontWeight: 600, color: '#374151' }}>
            {shift._startLabel} – {shift._endLabel}
          </Typography>
          {isOpen && <Chip label="Open" size="small" sx={{ height: 15, fontSize: '0.55rem', bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 700 }} />}
        </Stack>
        {shift.su_first_name && (
          <Typography variant="caption" sx={{ fontSize: compact ? '0.58rem' : '0.64rem', color: '#6B7280', display: 'block', mb: 0.5 }}>
            {shift.su_first_name} {shift.su_last_name || ''}
          </Typography>
        )}

        {/* Assignments */}
        {shift.assignments?.map((a: any) => (
          <Chip key={a.id} size="small"
            label={
              <Stack direction="row" spacing={0.3} alignItems="center">
                <span>{a.first_name} {a.last_name?.[0] || ''}</span>
                {a.is_overtime && (
                  <Box component="span" sx={{
                    height: 13, lineHeight: '13px', px: 0.4, borderRadius: '4px',
                    bgcolor: '#FEF3C7', color: '#92400E', fontSize: '0.5rem', fontWeight: 700,
                  }}>
                    OT
                  </Box>
                )}
                {currentStaffId === a.staff_id && !isPast && (
                  <SwapHorizIcon sx={{ fontSize: 11, ml: 0.1, cursor: 'pointer', color: '#0F4C81' }}
                    onClick={(e) => { e.stopPropagation(); onSwap(shift.id, shift.start_time) }} />
                )}
              </Stack>
            }
            onDelete={canEdit && !isReadOnly && canEditShift ? (() => onUnassign(shift.id, a.staff_id)) : undefined}
            sx={{ height: compact ? 17 : 19, fontSize: compact ? '0.56rem' : '0.6rem', mr: 0.3, mb: 0.3, '& .MuiChip-deleteIcon': { fontSize: 11 } }} />
        ))}

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
      </CardContent>
    </Card>
  )
})

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
