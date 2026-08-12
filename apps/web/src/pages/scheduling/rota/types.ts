export interface RotaViewProps {
  weekDates: Date[]
  shifts: any[]
  staffList: any[]
  locations: any[]
  weekDayStats: any[][]
  selectedLocationId: string
  canEdit: boolean
  isReadOnly: boolean
  canClaim: boolean
  currentStaffId: string | null
  canEditLocation: (locationId: string) => boolean
  assignedStaffIdsByDate: Map<string, Set<string>>
  onOpenShiftDialog: (date?: Date) => void
  onOpenShiftDialogAt: (date: Date, hour: number) => void
  onAssign: (shiftId: string) => void
  onDeleteShift: (shiftId: string) => void
  onToggleCoverage: (shiftId: string, currentlyCovered: boolean) => void
  onClaimShift: (shiftId: string) => void
  onUnassign: (shiftId: string, staffId: string) => void
  onSwap: (shiftId: string, startTime?: string) => void
  onOpenDetail: (shift: any) => void
}

export type RotaViewMode = 'board' | 'timeline' | 'roster'

export const ROTA_VIEW_OPTIONS: { value: RotaViewMode; label: string }[] = [
  { value: 'board', label: 'Board' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'roster', label: 'Roster' },
]
