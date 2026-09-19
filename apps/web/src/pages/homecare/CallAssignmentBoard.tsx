import { useState, useCallback, useRef, useMemo } from 'react'
import {
  Box, Button, Chip, CircularProgress, IconButton, Paper, Stack,
  TextField, Typography, Alert, Tooltip, Collapse,
} from '@mui/material'
import {
  useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query'
import {
  Add as AddIcon, Delete as DeleteIcon, Assignment as TaskIcon,
  CheckCircle as CheckIcon, AutoAwesome,
  Person as PersonIcon, AccessTime as TimeIcon, DragIndicator as DragIcon,
  Undo as UndoIcon, WarningAmber, Lightbulb,
} from '@mui/icons-material'
import api from '../../services/api'
import ContextualLearnLink from '../../components/ContextualLearnLink'
import PageContainer from '../../components/design/PageContainer'

/* ─── Helpers ──────────────────────────────────────────────── */
const time = (d: string) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const dateStr = (d: string) => new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

function minsBetween(a: string, b: string) {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 60000
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

interface Visit {
  id: string; label: string; person_name: string; person_address: string | null
  assigned_staff_id: string | null; carer_name: string | null; status: string
  scheduled_start: string; scheduled_end: string; package_name: string | null
  latitude: number | null; longitude: number | null
}



interface Staff {
  id: string; first_name: string; last_name: string
}

interface VisitTask {
  id: string; visit_id: string; label: string; sort_order: number; done: boolean
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: 'Done', color: '#047857', bg: '#E9F7F0' },
  checked_in: { label: 'At client', color: '#0F4C81', bg: '#E0F2FE' },
  en_route: { label: 'En route', color: '#7C3AED', bg: '#EDE9FE' },
  scheduled: { label: 'Scheduled', color: '#6B7280', bg: '#F3F4F6' },
  missed: { label: 'Missed', color: '#DC2626', bg: '#FDECEC' },
}

/* ─── Conflict checker ─────────────────────────────────────── */
function checkConflicts(
  visit: Visit,
  carerId: string,
  allVisits: Visit[],
): { conflict: boolean; message: string; severity: 'error' | 'warning' } {
  const carerVisits = allVisits.filter(
    v => v.assigned_staff_id === carerId && v.id !== visit.id && v.status !== 'cancelled' && v.status !== 'missed',
  )

  // Check for overlapping calls (30-min buffer like the backend)
  for (const cv of carerVisits) {
    const vStart = new Date(visit.scheduled_start).getTime()
    const vEnd = new Date(visit.scheduled_end).getTime()
    const cStart = new Date(cv.scheduled_start).getTime()
    const cEnd = new Date(cv.scheduled_end).getTime()
    const buffer = 30 * 60 * 1000

    if (vStart < cEnd + buffer && vEnd > cStart - buffer) {
      return {
        conflict: true,
        message: `Overlaps with ${cv.person_name} (${time(cv.scheduled_start)}–${time(cv.scheduled_end)})`,
        severity: 'error',
      }
    }
  }

  // Check proximity for back-to-back calls
  for (const cv of carerVisits) {
    const vStart = new Date(visit.scheduled_start).getTime()
    const cEnd = new Date(cv.scheduled_end).getTime()
    const gapMins = (vStart - cEnd) / 60000

    // If gap is between 0 and 90 minutes, check proximity
    if (gapMins >= 0 && gapMins <= 90 && visit.latitude && visit.longitude && cv.latitude && cv.longitude) {
      const distKm = haversineKm(visit.latitude, visit.longitude, cv.latitude, cv.longitude)
      const travelNeeded = distKm * 3 // rough 20km/h avg in UK urban
      if (travelNeeded > gapMins + 15) {
        return {
          conflict: false,
          message: `${Math.round(distKm)}km from ${cv.person_name} — only ${Math.round(gapMins)}min gap (need ~${Math.round(travelNeeded)}min travel)`,
          severity: 'warning',
        }
      }
    }
  }

  return { conflict: false, message: '', severity: 'warning' }
}

/* ─── Main Component ───────────────────────────────────────── */
export default function CallAssignmentBoard() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [draggedVisitId, setDraggedVisitId] = useState<string | null>(null)
  const [dropTargetCarer, setDropTargetCarer] = useState<string | null>(null)
  const [expandedVisit, setExpandedVisit] = useState<string | null>(null)
  const [newTaskLabel, setNewTaskLabel] = useState('')
  const [conflictInfo, setConflictInfo] = useState<{ visitId: string; carerId: string; msg: string; severity: 'error' | 'warning' } | null>(null)
  const qc = useQueryClient()
  const dropRef = useRef<HTMLDivElement>(null)

  const nextDate = new Date(new Date(date).getTime() + 86400000).toISOString().slice(0, 10)

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ['homecare-visits-assign', date],
    queryFn: () => api.get('/homecare/visits', { params: { from: date, to: nextDate } }).then(r => Array.isArray(r.data) ? r.data : []),
  })

  const { data: staff = [] } = useQuery({
    queryKey: ['homecare-staff'],
    queryFn: () => api.get('/homecare/staff').then(r => Array.isArray(r.data) ? r.data : []),
  })

  const assignVisit = useMutation({
    mutationFn: ({ visitId, staffId }: { visitId: string; staffId: string | null }) =>
      api.patch(`/homecare/visits/${visitId}`, { assigned_staff_id: staffId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['homecare-visits-assign'] })
      qc.invalidateQueries({ queryKey: ['homecare-live-map'] })
      setConflictInfo(null)
    },
    onError: (e: any) => alert(e.response?.data?.message || 'Could not assign call'),
  })

  const addTask = useMutation({
    mutationFn: ({ visitId, label }: { visitId: string; label: string }) =>
      api.post(`/homecare/visits/${visitId}/tasks`, { label }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['visit-tasks', vars.visitId] })
      setNewTaskLabel('')
    },
  })

  const toggleTask = useMutation({
    mutationFn: ({ visitId, taskId, done }: { visitId: string; taskId: string; done: boolean }) =>
      api.patch(`/homecare/visits/${visitId}/tasks/${taskId}`, { done }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['visit-tasks', vars.visitId] })
      qc.invalidateQueries({ queryKey: ['homecare-visits-assign'] })
    },
  })

  const deleteTask = useMutation({
    mutationFn: ({ visitId, taskId }: { visitId: string; taskId: string }) =>
      api.delete(`/homecare/visits/${visitId}/tasks/${taskId}`),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['visit-tasks', vars.visitId] })
    },
  })

  const unassigned = useMemo(() =>
    visits.filter((v: any) => !v.assigned_staff_id && v.status === 'scheduled')
      .sort((a: any, b: any) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()),
    [visits],
  )

  const assigned = useMemo(() =>
    visits.filter((v: any) => v.assigned_staff_id && v.status !== 'cancelled' && v.status !== 'missed'),
    [visits],
  )

  // Build carer map from ALL staff (including those with no calls)
  const carerMap = useMemo(() => {
    const map = new Map<string, { name: string; visits: any[] }>()
    // First add all assigned visits
    for (const v of assigned) {
      const key = v.assigned_staff_id!
      const name = v.carer_name || staff.find((s: Staff) => s.id === key)
        ? `${staff.find((s: Staff) => s.id === key)?.first_name || ''} ${staff.find((s: Staff) => s.id === key)?.last_name || ''}`.trim()
        : 'Unknown'
      if (!map.has(key)) map.set(key, { name: name || 'Unknown', visits: [] })
      map.get(key)!.visits.push(v)
    }
    // Then add idle staff
    for (const s of staff) {
      if (!map.has(s.id)) {
        map.set(s.id, { name: `${s.first_name} ${s.last_name}`, visits: [] })
      }
    }
    return map
  }, [assigned, staff])

  const carerEntries = useMemo(() =>
    Array.from(carerMap.entries()).sort((a, b) => {
      // Sort by: has visits first, then by earliest visit time
      if (a[1].visits.length !== b[1].visits.length) return b[1].visits.length - a[1].visits.length
      const aEarliest = a[1].visits[0]?.scheduled_start || ''
      const bEarliest = b[1].visits[0]?.scheduled_start || ''
      return aEarliest.localeCompare(bEarliest)
    }),
    [carerMap],
  )

  /* ─── Drag & Drop handlers ────────────────────────────── */
  const handleDragStart = useCallback((visitId: string) => {
    setDraggedVisitId(visitId)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggedVisitId(null)
    setDropTargetCarer(null)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, carerId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTargetCarer(carerId)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDropTargetCarer(null)
  }, [])

  const handleDrop = useCallback((carerId: string) => {
    if (!draggedVisitId) return
    const visit = visits.find((v: any) => v.id === draggedVisitId)
    if (!visit) return

    const check = checkConflicts(visit, carerId, visits)
    if (check.conflict) {
      setConflictInfo({ visitId: draggedVisitId, carerId, msg: check.message, severity: check.severity })
      setDraggedVisitId(null)
      setDropTargetCarer(null)
      return
    }

    assignVisit.mutate({ visitId: draggedVisitId, staffId: carerId })
    setDraggedVisitId(null)
    setDropTargetCarer(null)
  }, [draggedVisitId, visits, assignVisit])

  // Click fallback for touch devices / quick assign
  const [selectedForAssign, setSelectedForAssign] = useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = useState<string | null>(null)

  // AI carer suggestion query
  const { data: suggestions = [], isLoading: suggestionsLoading } = useQuery({
    queryKey: ['carer-suggestions', showSuggestions],
    queryFn: () => api.get(`/homecare/visits/${showSuggestions}/suggest-carers`).then(r => Array.isArray(r.data) ? r.data : []),
    enabled: !!showSuggestions,
  })

  const handleVisitClick = useCallback((visitId: string) => {
    if (selectedForAssign === visitId) {
      setSelectedForAssign(null)
    } else {
      setSelectedForAssign(visitId)
    }
  }, [selectedForAssign])

  const handleCarerClick = useCallback((carerId: string) => {
    if (!selectedForAssign) return
    const visit = visits.find((v: any) => v.id === selectedForAssign)
    if (!visit) return

    const check = checkConflicts(visit, carerId, visits)
    if (check.conflict) {
      setConflictInfo({ visitId: selectedForAssign, carerId, msg: check.message, severity: check.severity })
      return
    }

    assignVisit.mutate({ visitId: selectedForAssign, staffId: carerId })
    setSelectedForAssign(null)
  }, [selectedForAssign, visits, assignVisit])

  return (
    <PageContainer>
      {/* Header */}
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Call Assignment</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Drag calls to carers or click to assign. Conflicts are checked automatically.
          </Typography>
          <ContextualLearnLink topic="dom-manager-web" />
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button size="small" onClick={() => { const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d.toISOString().slice(0, 10)) }} sx={{ minWidth: 'auto' }}>←</Button>
          <Chip label={`${dateStr(date)} — ${visits.length} calls`} sx={{ fontWeight: 700, bgcolor: '#0F4C81', color: 'white' }} onClick={() => setDate(new Date().toISOString().slice(0, 10))} />
          <Button size="small" onClick={() => { const d = new Date(date); d.setDate(d.getDate() + 1); setDate(d.toISOString().slice(0, 10)) }} sx={{ minWidth: 'auto' }}>→</Button>
        </Stack>
      </Stack>

      {/* Conflict alert */}
      <Collapse in={!!conflictInfo}>
        <Alert
          severity={conflictInfo?.severity || 'warning'}
          sx={{ mb: 2 }}
          action={<Button size="small" color="inherit" onClick={() => setConflictInfo(null)}>Dismiss</Button>}
          icon={conflictInfo?.severity === 'error' ? <WarningAmber /> : undefined}
        >
          {conflictInfo?.msg}
        </Alert>
      </Collapse>

      {/* Click-to-assign hint */}
      {selectedForAssign && (
        <Alert severity="info" sx={{ mb: 2 }} action={<Button size="small" color="inherit" onClick={() => setSelectedForAssign(null)}>Cancel</Button>}>
          Click a carer on the right to assign this call, or drag it.
        </Alert>
      )}

      {/* AI Suggestion panel */}
      {showSuggestions && (
        <Paper elevation={0} sx={{ p: 2.5, mb: 2, border: '1px solid', borderColor: '#E0E7FF', borderRadius: 2, bgcolor: '#F8FAFF' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <AutoAwesome sx={{ fontSize: 18, color: '#6366F1' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#4338CA' }}>AI suggested carers</Typography>
            </Stack>
            <Button size="small" onClick={() => setShowSuggestions(null)} sx={{ textTransform: 'none' }}>Close</Button>
          </Stack>
          {suggestionsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={20} /></Box>
          ) : (
            <Stack spacing={0.75}>
              {suggestions.slice(0, 5).map((s: any) => (
                <Stack key={s.staff_id} direction="row" alignItems="center" spacing={1.5}
                  sx={{ p: 1, borderRadius: 1.5, bgcolor: s.has_conflict || s.on_leave ? '#FEF2F2' : s.available ? '#F0FDF4' : '#FFFBEB', cursor: s.has_conflict || s.on_leave ? 'not-allowed' : 'pointer', '&:hover': s.has_conflict || s.on_leave ? {} : { bgcolor: '#EFF6FF' }, transition: 'background 0.15s' }}
                  onClick={() => {
                    if (s.has_conflict || s.on_leave) return
                    const visit = unassigned.find((v: any) => v.id === showSuggestions)
                    if (visit) assignVisit.mutate({ visitId: visit.id, staffId: s.staff_id })
                    setShowSuggestions(null)
                  }}
                >
                  <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: s.score >= 70 ? '#DCFCE7' : s.score >= 40 ? '#FEF9C3' : '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.7rem', color: s.score >= 70 ? '#166534' : s.score >= 70 ? '#166534' : '#92400E', flexShrink: 0 }}>{s.score}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.first_name} {s.last_name}</Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {s.reasons.map((r: string, i: number) => (
                        <Chip key={i} label={r} size="small" sx={{ height: 16, fontSize: '0.55rem', bgcolor: 'white', border: '1px solid #E5E7EB', fontWeight: 500 }} />
                      ))}
                    </Stack>
                  </Box>
                  {s.has_conflict && <Chip label="Conflict" size="small" sx={{ bgcolor: '#FEE2E2', color: '#991B1B', fontWeight: 700, height: 20, fontSize: '0.6rem' }} />}
                  {s.on_leave && !s.has_conflict && <Chip label="On leave" size="small" sx={{ bgcolor: '#FEE2E2', color: '#991B1B', fontWeight: 700, height: 20, fontSize: '0.6rem' }} />}
                  {!s.has_conflict && !s.on_leave && s.available && <Chip label="Assign" size="small" sx={{ bgcolor: '#0F4C81', color: 'white', fontWeight: 700, height: 20, fontSize: '0.6rem' }} />}
                </Stack>
              ))}
            </Stack>
          )}
        </Paper>
      )}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} sx={{ alignItems: 'stretch' }}>
          {/* ─── LEFT: Unassigned Calls ─────────────────── */}
          <Paper
            elevation={0}
            sx={{
              flex: '0 0 380px', p: 2.5, border: '2px solid', borderColor: draggedVisitId ? '#0F4C81' : 'grey.200',
              borderRadius: 2, transition: 'border-color 0.2s', overflow: 'auto', maxHeight: 'calc(100vh - 160px)',
            }}
            ref={dropRef}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#D97706' }}>
                Unassigned calls
              </Typography>
              <Chip
                label={unassigned.length}
                size="small"
                sx={{ bgcolor: unassigned.length > 0 ? '#FFF5D9' : '#F3F4F6', color: unassigned.length > 0 ? '#D97706' : '#9CA3AF', fontWeight: 700 }}
              />
            </Stack>

            {unassigned.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <CheckIcon sx={{ fontSize: 36, color: '#10B981', mb: 1 }} />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>All calls are assigned</Typography>
              </Box>
            ) : (
              <Stack spacing={1}>
                {unassigned.map((v: any) => (
                  <DraggableVisitCard
                    key={v.id}
                    visit={v}
                    isSelected={selectedForAssign === v.id}
                    isDragging={draggedVisitId === v.id}
                    expanded={expandedVisit === v.id}
                    newTaskLabel={newTaskLabel}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onClick={handleVisitClick}
                    onExpand={(id: string) => setExpandedVisit(expandedVisit === id ? null : id)}
                    onNewTaskLabelChange={setNewTaskLabel}
                    onAddTask={(label: string) => addTask.mutate({ visitId: v.id, label })}
                    onToggleTask={(taskId: string, done: boolean) => toggleTask.mutate({ visitId: v.id, taskId, done })}
                    onDeleteTask={(taskId: string) => deleteTask.mutate({ visitId: v.id, taskId })}
                    isAddingTask={addTask.isPending}
                    onUnassign={() => assignVisit.mutate({ visitId: v.id, staffId: null })}
                    onSuggest={(id: string) => setShowSuggestions(id)}
                  />
                ))}
              </Stack>
            )}
          </Paper>

          {/* ─── RIGHT: Carer Workload ─────────────────── */}
          <Box sx={{ flex: 1, minWidth: 0, overflow: 'auto', maxHeight: 'calc(100vh - 160px)' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
              Carers ({carerEntries.filter(([, c]) => c.visits.length > 0).length} active / {carerEntries.length} total)
            </Typography>

            <Stack spacing={1.5}>
              {carerEntries.map(([carerId, { name, visits: carerVisits }]) => (
                <CarerDropZone
                  key={carerId}
                  carerId={carerId}
                  name={name}
                  visits={carerVisits}
                  isDropTarget={dropTargetCarer === carerId}
                  isClickable={!!selectedForAssign}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => handleCarerClick(carerId)}
                  expandedVisit={expandedVisit}
                  onExpand={(id: string) => setExpandedVisit(expandedVisit === id ? null : id)}
                  newTaskLabel={newTaskLabel}
                  onNewTaskLabelChange={setNewTaskLabel}
                  onAddTask={(visitId: string, label: string) => addTask.mutate({ visitId, label })}
                  onToggleTask={(visitId: string, taskId: string, done: boolean) => toggleTask.mutate({ visitId, taskId, done })}
                  onDeleteTask={(visitId: string, taskId: string) => deleteTask.mutate({ visitId, taskId })}
                  isAddingTask={addTask.isPending}
                  onUnassign={(visitId: string) => assignVisit.mutate({ visitId, staffId: null })}
                />
              ))}
            </Stack>
          </Box>
        </Stack>
      )}
    </PageContainer>
  )
}

/* ─── Draggable Visit Card (left column) ──────────────────── */
function DraggableVisitCard({
  visit, isSelected, isDragging, expanded, newTaskLabel,
  onDragStart, onDragEnd, onClick, onNewTaskLabelChange,
  onAddTask, onToggleTask, onDeleteTask, isAddingTask, onSuggest,
}: any) {
  const { data: tasks = [] } = useVisitTasks(visit.id, expanded)
  const doneCount = tasks.filter((t: VisitTask) => t.done).length

  return (
    <Paper
      elevation={0}
      draggable
      onDragStart={(e: any) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', visit.id)
        onDragStart(visit.id)
      }}
      onDragEnd={onDragEnd}
      onClick={() => onClick(visit.id)}
      sx={{
        p: 1.5, border: '1.5px solid',
        borderColor: isSelected ? '#0F4C81' : isDragging ? '#93C5FD' : 'grey.200',
        borderRadius: 1.5,
        cursor: 'grab',
        opacity: isDragging ? 0.5 : 1,
        bgcolor: isSelected ? '#EFF6FF' : 'white',
        transition: 'all 0.15s',
        '&:hover': { borderColor: '#0F4C81', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
        '&:active': { cursor: 'grabbing' },
      }}
    >
      <Stack direction="row" alignItems="flex-start" spacing={1}>
        <DragIcon sx={{ fontSize: 16, color: '#9CA3AF', mt: 0.25, flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.85rem' }} noWrap>
              {visit.person_name}
            </Typography>
            <Chip
              label={`${time(visit.scheduled_start)}–${time(visit.scheduled_end)}`}
              size="small"
              sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600, bgcolor: '#F3F4F6', flexShrink: 0 }}
            />
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap>
            {visit.label}
          </Typography>
          {visit.person_address && (
            <Typography variant="caption" sx={{ color: '#9CA3AF', display: 'block' }} noWrap>
              📍 {visit.person_address}
            </Typography>
          )}
          {tasks.length > 0 && (
            <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 0.5 }}>
              <TaskIcon sx={{ fontSize: 11, color: doneCount === tasks.length ? '#10B981' : '#D97706' }} />
              <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 600, color: doneCount === tasks.length ? '#047857' : '#92400E' }}>
                {doneCount}/{tasks.length} tasks
              </Typography>
            </Stack>
          )}
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 0.5 }}>
            <Tooltip title="AI suggest best carer">
              <Button size="small" variant="outlined" startIcon={<Lightbulb sx={{ fontSize: 13 }} />} onClick={(e) => { e.stopPropagation(); onSuggest(visit.id) }} sx={{ textTransform: 'none', fontSize: '0.65rem', py: 0, borderColor: '#E0E7FF', color: '#6366F1', '&:hover': { borderColor: '#6366F1', bgcolor: '#F5F3FF' } }}>
                Suggest
              </Button>
            </Tooltip>
          </Stack>
        </Box>
      </Stack>

      {/* Expanded task list */}
      {expanded && (
        <Box sx={{ ml: 3, mt: 1, pl: 1, borderLeft: '2px solid #E5E7EB' }}>
          {tasks.map((task: VisitTask) => (
            <Stack key={task.id} direction="row" alignItems="center" gap={0.5} sx={{ py: 0.25 }}>
              <Box
                onClick={(e) => { e.stopPropagation(); onToggleTask(task.id, !task.done) }}
                sx={{
                  width: 14, height: 14, borderRadius: 1, border: '1.5px solid', cursor: 'pointer',
                  borderColor: task.done ? '#10B981' : '#D1D5DB', bgcolor: task.done ? '#10B981' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                {task.done && <CheckIcon sx={{ fontSize: 10, color: 'white' }} />}
              </Box>
              <Typography variant="caption" sx={{ flex: 1, textDecoration: task.done ? 'line-through' : 'none', color: task.done ? '#9CA3AF' : '#374151' }}>
                {task.label}
              </Typography>
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id) }} sx={{ p: 0, '&:hover': { color: '#DC2626' } }}>
                <DeleteIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </Stack>
          ))}
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 0.5 }}>
            <TextField
              size="small" placeholder="Add task..." value={newTaskLabel}
              onChange={e => onNewTaskLabelChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newTaskLabel.trim()) onAddTask(newTaskLabel.trim()) }}
              sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: '0.75rem', py: 0.5 } }}
              onClick={e => e.stopPropagation()}
            />
            <IconButton size="small" disabled={!newTaskLabel.trim() || isAddingTask}
              onClick={(e) => { e.stopPropagation(); if (newTaskLabel.trim()) onAddTask(newTaskLabel.trim()) }}
              sx={{ p: 0.5 }}>
              <AddIcon sx={{ fontSize: 16, color: '#0F4C81' }} />
            </IconButton>
          </Stack>
        </Box>
      )}
    </Paper>
  )
}

/* ─── Carer Drop Zone (right column) ──────────────────────── */
function CarerDropZone({
  carerId, name, visits, isDropTarget, isClickable,
  onDragOver, onDragLeave, onDrop, onClick,
  expandedVisit, onExpand, newTaskLabel, onNewTaskLabelChange,
  onAddTask, onToggleTask, onDeleteTask, isAddingTask, onUnassign,
}: any) {
  const sorted = [...visits].sort((a: any, b: any) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())

  // Calculate workload summary
  const totalMins = visits.reduce((sum: number, v: any) => {
    return sum + (new Date(v.scheduled_end).getTime() - new Date(v.scheduled_start).getTime()) / 60000
  }, 0)
  const hours = Math.floor(totalMins / 60)
  const mins = Math.round(totalMins % 60)

  return (
    <Paper
      elevation={0}
      onDragOver={(e: any) => onDragOver(e, carerId)}
      onDragLeave={onDragLeave}
      onDrop={() => onDrop(carerId)}
      onClick={isClickable ? onClick : undefined}
      sx={{
        p: 2, border: '2px solid',
        borderColor: isDropTarget ? '#0F4C81' : visits.length > 0 ? 'grey.200' : 'grey.100',
        borderRadius: 2,
        transition: 'all 0.2s',
        bgcolor: isDropTarget ? '#EFF6FF' : visits.length === 0 ? '#FAFAFA' : 'white',
        cursor: isClickable ? 'pointer' : 'default',
        boxShadow: isDropTarget ? '0 0 0 3px rgba(15,76,129,0.1)' : 'none',
        '&:hover': isClickable ? { borderColor: '#0F4C81', boxShadow: '0 0 0 2px rgba(15,76,129,0.08)' } : {},
      }}
    >
      {/* Carer header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <PersonIcon sx={{ fontSize: 18, color: '#0F4C81' }} />
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{name}</Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center">
          {visits.length > 0 && (
            <Chip
              label={`${visits.length} call${visits.length !== 1 ? 's' : ''} · ${hours}h${mins > 0 ? `${mins}m` : ''}`}
              size="small"
              sx={{ bgcolor: '#E0F2FE', color: '#0F4C81', fontWeight: 600, height: 20, fontSize: '0.65rem' }}
            />
          )}
          {visits.length === 0 && (
            <Chip label="No calls" size="small" sx={{ bgcolor: '#F3F4F6', color: '#9CA3AF', fontWeight: 500, height: 20, fontSize: '0.65rem' }} />
          )}
        </Stack>
      </Stack>

      {/* Drop hint */}
      {isDropTarget && (
        <Box sx={{ py: 2, textAlign: 'center', border: '2px dashed #0F4C81', borderRadius: 1.5, bgcolor: '#EFF6FF', mb: 1 }}>
          <Typography variant="body2" sx={{ color: '#0F4C81', fontWeight: 600 }}>Drop here to assign</Typography>
        </Box>
      )}

      {/* Visit timeline */}
      {sorted.length > 0 ? (
        <Stack spacing={0.5}>
          {sorted.map((v: any, idx: number) => {
            const cfg = statusConfig[v.status] || statusConfig.scheduled
            // Show gap indicator between visits
            const gap = idx > 0 ? minsBetween(v.scheduled_start, sorted[idx - 1].scheduled_end) : null
            return (
              <Box key={v.id}>
                {gap !== null && gap > 0 && (
                  <Box sx={{ pl: 3, py: 0.25 }}>
                    <Typography variant="caption" sx={{ color: gap < 15 ? '#DC2626' : '#9CA3AF', fontSize: '0.6rem', fontWeight: 600 }}>
                      {gap < 15 ? `⚠ ${Math.round(gap)}min gap` : `${Math.round(gap)}min gap`}
                    </Typography>
                  </Box>
                )}
                <Stack
                  direction="row" alignItems="center" spacing={1}
                  sx={{
                    py: 0.75, px: 1, bgcolor: 'grey.50', borderRadius: 1, cursor: 'pointer',
                    '&:hover': { bgcolor: 'grey.100' },
                  }}
                  onClick={() => onExpand(v.id === expandedVisit ? null : v.id)}
                >
                  <TimeIcon sx={{ fontSize: 13, color: '#0F4C81', flexShrink: 0 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" gap={0.5}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#0F4C81' }}>
                        {time(v.scheduled_start)}
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 600 }} noWrap>
                        {v.person_name}
                      </Typography>
                    </Stack>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap>
                      {v.label}
                    </Typography>
                  </Box>
                  <Chip label={cfg.label} size="small" sx={{ bgcolor: cfg.bg, color: cfg.color, height: 18, fontSize: '0.6rem', fontWeight: 600 }} />
                  {v.status === 'scheduled' && (
                    <Tooltip title="Unassign">
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); onUnassign(v.id) }}
                        sx={{ p: 0, '&:hover': { color: '#DC2626' } }}
                      >
                        <UndoIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>

                {/* Expanded task list */}
                {expandedVisit === v.id && (
                  <CarerVisitTasks
                    visit={v} newTaskLabel={newTaskLabel} onNewTaskLabelChange={onNewTaskLabelChange}
                    onAddTask={(label: string) => onAddTask(v.id, label)}
                    onToggleTask={(taskId: string, done: boolean) => onToggleTask(v.id, taskId, done)}
                    onDeleteTask={(taskId: string) => onDeleteTask(v.id, taskId)}
                    isAddingTask={isAddingTask}
                  />
                )}
              </Box>
            )
          })}
        </Stack>
      ) : !isDropTarget ? (
        <Typography variant="caption" sx={{ color: '#9CA3AF', textAlign: 'center', display: 'block', py: 2 }}>
          Drag a call here or click to assign
        </Typography>
      ) : null}
    </Paper>
  )
}

/* ─── Carer Visit Tasks (inline) ──────────────────────────── */
function CarerVisitTasks({ visit, newTaskLabel, onNewTaskLabelChange, onAddTask, onToggleTask, onDeleteTask, isAddingTask }: any) {
  const { data: tasks = [] } = useVisitTasks(visit.id, true)

  return (
    <Box sx={{ ml: 3.5, mt: 0.5, pl: 1, borderLeft: '2px solid #E5E7EB', mb: 1 }}>
      {tasks.map((task: VisitTask) => (
        <Stack key={task.id} direction="row" alignItems="center" gap={0.5} sx={{ py: 0.25 }}>
          <Box
            onClick={() => onToggleTask(task.id, !task.done)}
            sx={{
              width: 14, height: 14, borderRadius: 1, border: '1.5px solid', cursor: 'pointer',
              borderColor: task.done ? '#10B981' : '#D1D5DB', bgcolor: task.done ? '#10B981' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            {task.done && <CheckIcon sx={{ fontSize: 10, color: 'white' }} />}
          </Box>
          <Typography variant="caption" sx={{ flex: 1, textDecoration: task.done ? 'line-through' : 'none', color: task.done ? '#9CA3AF' : '#374151' }}>
            {task.label}
          </Typography>
          <IconButton size="small" onClick={() => onDeleteTask(task.id)} sx={{ p: 0, '&:hover': { color: '#DC2626' } }}>
            <DeleteIcon sx={{ fontSize: 12 }} />
          </IconButton>
        </Stack>
      ))}
      <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 0.5 }}>
        <TextField
          size="small" placeholder="Add task..." value={newTaskLabel}
          onChange={e => onNewTaskLabelChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && newTaskLabel.trim()) onAddTask(newTaskLabel.trim()) }}
          sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: '0.75rem', py: 0.5 } }}
        />
        <IconButton size="small" disabled={!newTaskLabel.trim() || isAddingTask}
          onClick={() => { if (newTaskLabel.trim()) onAddTask(newTaskLabel.trim()) }}
          sx={{ p: 0.5 }}>
          <AddIcon sx={{ fontSize: 16, color: '#0F4C81' }} />
        </IconButton>
      </Stack>
    </Box>
  )
}

/* ─── Hooks ───────────────────────────────────────────────── */
function useVisitTasks(visitId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['visit-tasks', visitId],
    queryFn: () => api.get(`/homecare/visits/${visitId}/tasks`).then(r => Array.isArray(r.data) ? r.data : []),
    enabled: enabled && !!visitId,
  })
}
