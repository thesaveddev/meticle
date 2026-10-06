import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import {
  Box, Button, Chip, CircularProgress, IconButton, Paper, Stack,
  TextField, Typography, Alert, Tooltip, Collapse,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material'
import {
  useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query'
import {
  Add as AddIcon, Delete as DeleteIcon, Assignment as TaskIcon,
  CheckCircle as CheckIcon, AutoAwesome, ViewTimeline as TimelineIcon,
  Person as PersonIcon, AccessTime as TimeIcon, DragIndicator as DragIcon,
  Undo as UndoIcon, WarningAmber, Lightbulb, ViewModule as BoardIcon,
} from '@mui/icons-material'
import api from '../../services/api'
import { getSocket } from '../../services/socket'
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
  completed: { label: 'Done', color: '#087A55', bg: '#EAFBF5' },
  checked_in: { label: 'At client', color: '#2F80ED', bg: '#EAF3FF' },
  en_route: { label: 'En route', color: '#8B7CF6', bg: '#F4F8FF' },
  scheduled: { label: 'Scheduled', color: '#667085', bg: '#F7F9FC' },
  missed: { label: 'Missed', color: '#EF4444', bg: '#FEF0F0' },
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

  // Real-time socket listener for visit updates from other managers
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    const handleVisitUpdate = (data: any) => {
      // Skip if this update was made by the current user (already handled by mutation onSuccess)
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      if (data.updatedBy === user.id) return
      qc.invalidateQueries({ queryKey: ['homecare-visits-assign'] })
      qc.invalidateQueries({ queryKey: ['homecare-live-map'] })
    }
    socket.on('homecare:visit-updated', handleVisitUpdate)
    return () => { socket.off('homecare:visit-updated', handleVisitUpdate) }
  }, [qc])

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

  const handleBulkAutoAssign = useCallback(async () => {
    setAutoAssigning(true)
    setAutoAssignError('')
    setAutoAssignDialog(false)
    try {
      // The endpoint treats `to` as an inclusive date, so from=to covers the selected day only.
      const res = await api.post(`/homecare/visits/bulk-auto-assign?from=${date}&to=${date}`)
      setAutoAssignResult(res.data)
      qc.invalidateQueries({ queryKey: ['homecare-visits-assign'] })
      qc.invalidateQueries({ queryKey: ['homecare-live-map'] })
    } catch (e: any) {
      setAutoAssignError(e.response?.data?.message || 'We could not auto-assign these calls. Please try again.')
    } finally {
      setAutoAssigning(false)
    }
  }, [date, qc])

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

  const handleDropUnassigned = useCallback(() => {
    if (!draggedVisitId) return
    assignVisit.mutate({ visitId: draggedVisitId, staffId: null })
    setDraggedVisitId(null)
    setDropTargetCarer(null)
  }, [draggedVisitId, assignVisit])

  // Click fallback for touch devices / quick assign
  const [selectedForAssign, setSelectedForAssign] = useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = useState<string | null>(null)
  const [autoAssigning, setAutoAssigning] = useState(false)
  const [autoAssignResult, setAutoAssignResult] = useState<any>(null)
  const [autoAssignError, setAutoAssignError] = useState('')
  const [autoAssignDialog, setAutoAssignDialog] = useState(false)
  const [viewMode, setViewMode] = useState<'board' | 'timeline'>('board')

  // AI carer suggestion query
  const { data: suggestions = [], isLoading: suggestionsLoading, isError: suggestionsError } = useQuery({
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
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Board view">
            <IconButton size="small" onClick={() => setViewMode('board')} sx={{ bgcolor: viewMode === 'board' ? '#2F80ED' : 'transparent', color: viewMode === 'board' ? 'white' : 'text.secondary', '&:hover': { bgcolor: viewMode === 'board' ? '#1F68C7' : 'notice.muted.bg' } }}>
              <BoardIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Timeline view">
            <IconButton size="small" onClick={() => setViewMode('timeline')} sx={{ bgcolor: viewMode === 'timeline' ? '#2F80ED' : 'transparent', color: viewMode === 'timeline' ? 'white' : 'text.secondary', '&:hover': { bgcolor: viewMode === 'timeline' ? '#1F68C7' : 'notice.muted.bg' } }}>
              <TimelineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button size="small" onClick={() => { const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d.toISOString().slice(0, 10)) }} sx={{ minWidth: 'auto' }}>←</Button>
          <Chip label={`${dateStr(date)} — ${visits.length} calls`} sx={{ fontWeight: 700, bgcolor: '#2F80ED', color: 'white' }} onClick={() => setDate(new Date().toISOString().slice(0, 10))} />
          <Button size="small" onClick={() => { const d = new Date(date); d.setDate(d.getDate() + 1); setDate(d.toISOString().slice(0, 10)) }} sx={{ minWidth: 'auto' }}>→</Button>
          {unassigned.length > 0 && (
            <Button
              size="small"
              variant="contained"
              startIcon={autoAssigning ? <CircularProgress size={13} color="inherit" /> : <AutoAwesome sx={{ fontSize: 14 }} />}
              onClick={() => { setAutoAssignError(''); setAutoAssignDialog(true) }}
              disabled={autoAssigning}
              sx={{ minHeight: 30, px: 1.25, py: 0.5, textTransform: 'none', bgcolor: '#2F80ED', '&:hover': { bgcolor: '#2674D9' }, fontSize: '0.72rem' }}
            >
              {autoAssigning ? 'Assigning…' : 'Auto-assign'}
            </Button>
          )}
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

      {/* Auto-assign error */}
      {autoAssignError && (
        <Alert severity="error" sx={{ mb: 2, py: 0.25 }} onClose={() => setAutoAssignError('')}>
          {autoAssignError}
        </Alert>
      )}

      {/* Auto-assign result */}
      {autoAssignResult && (
        <Paper elevation={0} sx={{ p: 2.5, mb: 2, border: '1px solid', borderColor: autoAssignResult.assigned_count > 0 ? '#EAFBF5' : '#FEF0F0', borderRadius: 2, bgcolor: autoAssignResult.assigned_count > 0 ? '#EAFBF5' : '#FEF0F0' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <AutoAwesome sx={{ fontSize: 18, color: autoAssignResult.assigned_count > 0 ? '#087A55' : '#EF4444' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Auto-assign complete</Typography>
            </Stack>
            <Button size="small" onClick={() => setAutoAssignResult(null)} sx={{ textTransform: 'none' }}>Dismiss</Button>
          </Stack>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {autoAssignResult.assigned_count} of {autoAssignResult.total_unassigned} unassigned calls were distributed to carers.
            {autoAssignResult.unassigned_count > 0 && ` ${autoAssignResult.unassigned_count} could not be assigned (no suitable carer available).`}
          </Typography>
          {Array.isArray(autoAssignResult.assignments) && autoAssignResult.assignments.length > 0 && (
            <Stack spacing={0.5}>
              {autoAssignResult.assignments.map((a: any) => (
                <Stack key={a.visit_id} direction="row" alignItems="center" spacing={1} sx={{ py: 0.5 }}>
                  <CheckIcon sx={{ fontSize: 14, color: '#087A55' }} />
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>{a.person_name}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>→ {a.carer_name}</Typography>
                  <Chip label={`score ${a.score}`} size="small" sx={{ height: 16, fontSize: '0.55rem', bgcolor: a.score >= 70 ? '#EAFBF5' : '#FFF7E6', fontWeight: 600 }} />
                </Stack>
              ))}
            </Stack>
          )}
        </Paper>
      )}

      {/* AI Suggestion panel */}
      {showSuggestions && (
        <Paper elevation={0} sx={{ p: 2.5, mb: 2, border: '1px solid', borderColor: '#F4F8FF', borderRadius: 2, bgcolor: '#F4F8FF' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <AutoAwesome sx={{ fontSize: 18, color: '#10BFA5' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#4338CA' }}>AI suggested carers</Typography>
            </Stack>
            <Button size="small" onClick={() => setShowSuggestions(null)} sx={{ textTransform: 'none' }}>Close</Button>
          </Stack>
          {suggestionsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={20} /></Box>
          ) : suggestionsError ? (
            <Typography variant="body2" sx={{ color: '#B42318', py: 1 }}>Could not load suggestions. Close this panel and try again.</Typography>
          ) : suggestions.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', py: 1 }}>No carers available to suggest for this call.</Typography>
          ) : (
            <Stack spacing={0.75}>
              {suggestions.slice(0, 5).map((s: any) => (
                <Stack key={s.staff_id} direction="row" alignItems="center" spacing={1.5}
                  sx={{ p: 1, borderRadius: 1.5, bgcolor: s.has_conflict || s.on_leave ? '#FEF0F0' : s.available ? '#EAFBF5' : '#FFF7E6', cursor: s.has_conflict || s.on_leave ? 'not-allowed' : 'pointer', '&:hover': s.has_conflict || s.on_leave ? {} : { bgcolor: '#F4F8FF' }, transition: 'background 0.15s' }}
                  onClick={() => {
                    if (s.has_conflict || s.on_leave) return
                    const visit = unassigned.find((v: any) => v.id === showSuggestions)
                    if (visit) assignVisit.mutate({ visitId: visit.id, staffId: s.staff_id })
                    setShowSuggestions(null)
                  }}
                >
                  <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: s.score >= 70 ? '#EAFBF5' : s.score >= 40 ? '#FFF7E6' : '#FEF0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.7rem', color: s.score >= 70 ? '#087A55' : s.score >= 70 ? '#087A55' : '#9A6700', flexShrink: 0 }}>{s.score}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.first_name} {s.last_name}</Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {s.reasons.map((r: string, i: number) => (
                        <Chip key={i} label={r} size="small" sx={{ height: 16, fontSize: '0.55rem', bgcolor: 'white', border: '1px solid #E6EAF0', fontWeight: 500 }} />
                      ))}
                    </Stack>
                  </Box>
                  {s.has_conflict && <Chip label="Conflict" size="small" sx={{ bgcolor: '#FEF0F0', color: '#B42318', fontWeight: 700, height: 20, fontSize: '0.6rem' }} />}
                  {s.on_leave && !s.has_conflict && <Chip label="On leave" size="small" sx={{ bgcolor: '#FEF0F0', color: '#B42318', fontWeight: 700, height: 20, fontSize: '0.6rem' }} />}
                  {!s.has_conflict && !s.on_leave && s.available && <Chip label="Assign" size="small" sx={{ bgcolor: '#2F80ED', color: 'white', fontWeight: 700, height: 20, fontSize: '0.6rem' }} />}
                </Stack>
              ))}
            </Stack>
          )}
        </Paper>
      )}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : viewMode === 'timeline' ? (
        <GanttTimeline
          unassigned={unassigned}
          carerEntries={carerEntries}
          selectedForAssign={selectedForAssign}
          onSelectVisit={handleVisitClick}
          onAssignVisit={(visitId, staffId) => {
            const visit = visits.find((v: any) => v.id === visitId)
            if (!visit) return
            const check = checkConflicts(visit, staffId, visits)
            if (check.conflict) {
              setConflictInfo({ visitId, carerId: staffId, msg: check.message, severity: check.severity })
              return
            }
            assignVisit.mutate({ visitId, staffId })
            setSelectedForAssign(null)
          }}
          onUnassignVisit={(visitId) => assignVisit.mutate({ visitId, staffId: null })}
        />
      ) : (
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} sx={{ alignItems: 'stretch' }}>
          {/* ─── LEFT: Unassigned Calls ─────────────────── */}
          <Paper
            elevation={0}
            sx={{
              flex: '0 0 380px', p: 2.5, border: '2px solid', borderColor: draggedVisitId ? '#2F80ED' : 'divider',
              borderRadius: 2, transition: 'border-color 0.2s', overflow: 'auto', maxHeight: 'calc(100vh - 160px)',
            }}
            ref={dropRef}
            data-testid="unassigned-drop-zone"
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTargetCarer('__unassigned') }}
            onDragLeave={() => setDropTargetCarer(null)}
            onDrop={handleDropUnassigned}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#F59E0B' }}>
                Unassigned calls · drop here to unassign
              </Typography>
              <Chip
                label={unassigned.length}
                size="small"
                sx={{ bgcolor: unassigned.length > 0 ? '#FFF7E6' : '#F7F9FC', color: unassigned.length > 0 ? '#F59E0B' : '#98A2B3', fontWeight: 700 }}
              />
            </Stack>

            {unassigned.length === 0 ? (                <Box sx={{ py: 6, textAlign: 'center', bgcolor: dropTargetCarer === '__unassigned' ? 'action.hover' : 'transparent', borderRadius: 2 }}>
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
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
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
      {/* Auto-assign confirmation dialog */}
      <Dialog open={autoAssignDialog} onClose={() => setAutoAssignDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Auto-assign {unassigned.length} unassigned calls</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            This will distribute unassigned calls to the most suitable carers based on their availability, proximity to clients, and current workload. Calls are assigned in chronological order.
          </Typography>
          <Alert severity="info" sx={{ bgcolor: '#F4F8FF' }}>
            Carers on leave or with overlapping calls will be skipped. You can always unassign calls after auto-assign.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAutoAssignDialog(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button size="small" variant="contained" onClick={handleBulkAutoAssign} disabled={autoAssigning} startIcon={autoAssigning ? <CircularProgress size={15} color="inherit" /> : <AutoAwesome sx={{ fontSize: 16 }} />} sx={{ minHeight: 34, textTransform: 'none', bgcolor: '#2F80ED', '&:hover': { bgcolor: '#2674D9' } }}>
            {autoAssigning ? 'Assigning…' : `Assign ${unassigned.length} calls`}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  )
}

/* ─── Gantt Timeline View ─────────────────────────────────── */
function GanttTimeline({ unassigned, carerEntries, selectedForAssign, onSelectVisit, onAssignVisit, onUnassignVisit }: {
  unassigned: any[]; carerEntries: [string, { name: string; visits: any[] }][]
  selectedForAssign: string | null; onSelectVisit: (id: string) => void
  onAssignVisit: (visitId: string, staffId: string) => void
  onUnassignVisit: (visitId: string) => void
}) {
  const START_HOUR = 6
  const END_HOUR = 22
  const TOTAL_HOURS = END_HOUR - START_HOUR
  const LABEL_WIDTH = 160 // px for carer name column

  // Current time indicator
  const now = new Date()
  const currentHour = now.getHours() + now.getMinutes() / 60
  const showNowLine = currentHour >= START_HOUR && currentHour <= END_HOUR
  const [draggedTimelineVisit, setDraggedTimelineVisit] = useState<string | null>(null)
  const [timelineDropRow, setTimelineDropRow] = useState<string | null>(null)
  const rows: { id: string; name: string; visits: any[]; isUnassigned?: boolean }[] = [
    { id: '__unassigned', name: 'Unassigned', visits: unassigned, isUnassigned: true },
    ...carerEntries.map(([id, data]) => ({ id, name: data.name, visits: data.visits })),
  ]

  const ROW_HEIGHT = 70

  return (
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: '#E6EAF0', borderRadius: 2, overflow: 'hidden' }}>
      <Box sx={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 160px)' }}>
        <Box sx={{ display: 'flex', minWidth: LABEL_WIDTH + TOTAL_HOURS * 60 + 20 }}>
          {/* Time header */}
          <Box sx={{ width: LABEL_WIDTH, flexShrink: 0, borderRight: '1px solid #E6EAF0', position: 'sticky', left: 0, zIndex: 2, bgcolor: 'white' }} />
          <Box sx={{ flex: 1, position: 'relative' }}>
            <Stack direction="row" sx={{ borderBottom: '1px solid #E6EAF0', bgcolor: '#F9FAFB' }}>
              {Array.from({ length: TOTAL_HOURS }, (_, i) => {
                const h = START_HOUR + i
                return (
                  <Box key={h} sx={{ width: 60, flexShrink: 0, textAlign: 'center', py: 1, borderRight: '1px solid #F7F9FC' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.65rem' }}>
                      {String(h).padStart(2, '0')}:00
                    </Typography>
                  </Box>
                )
              })}
            </Stack>
          </Box>
        </Box>

        {/* Rows */}
        {rows.map((row) => (
          <Box
            key={row.id}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setTimelineDropRow(row.id) }}
            onDragLeave={() => setTimelineDropRow(null)}
            onDrop={(e) => {
              e.preventDefault()
              const visitId = draggedTimelineVisit || e.dataTransfer.getData('text/plain') || selectedForAssign
              if (!visitId) return
              if (row.isUnassigned) onUnassignVisit(visitId)
              else onAssignVisit(visitId, row.id)
              setDraggedTimelineVisit(null)
              setTimelineDropRow(null)
            }}
            sx={{ display: 'flex', borderBottom: '1px solid', borderColor: 'divider', minHeight: ROW_HEIGHT, bgcolor: timelineDropRow === row.id ? 'action.hover' : 'transparent', transition: 'background-color 140ms ease' }}
          >
            {/* Carer name */}
            <Box sx={{
              width: LABEL_WIDTH, flexShrink: 0, borderRight: '1px solid #E6EAF0',
              position: 'sticky', left: 0, zIndex: 1, bgcolor: row.isUnassigned ? '#FFF7E6' : 'white',
              px: 1.5, py: 1, display: 'flex', alignItems: 'center',
              cursor: selectedForAssign && row.isUnassigned ? 'default' : selectedForAssign ? 'pointer' : 'default',
              '&:hover': selectedForAssign && !row.isUnassigned ? { bgcolor: '#F4F8FF' } : {},
              transition: 'background 0.15s',
            }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setTimelineDropRow(row.id) }}
              onDrop={(e) => {
                e.preventDefault()
                const visitId = draggedTimelineVisit || e.dataTransfer.getData('text/plain') || selectedForAssign
                if (!visitId) return
                if (row.isUnassigned) onUnassignVisit(visitId)
                else onAssignVisit(visitId, row.id)
                setDraggedTimelineVisit(null)
                setTimelineDropRow(null)
              }}
              onClick={() => {
                if (selectedForAssign && !row.isUnassigned) onAssignVisit(selectedForAssign, row.id)
              }}
            >
              <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: row.isUnassigned ? '#FFF7E6' : '#EAF3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 1, flexShrink: 0 }}>
                {row.isUnassigned ? (
                  <WarningAmber sx={{ fontSize: 14, color: '#F59E0B' }} />
                ) : (
                  <PersonIcon sx={{ fontSize: 14, color: '#2F80ED' }} />
                )}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem' }}>{row.visits.length} call{row.visits.length !== 1 ? 's' : ''}</Typography>
              </Box>
            </Box>

            {/* Timeline area */}
            <Box sx={{ flex: 1, position: 'relative', minHeight: ROW_HEIGHT }}>
              {/* Hour grid lines */}
              {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                <Box key={i} sx={{ position: 'absolute', left: i * 60, top: 0, bottom: 0, width: 1, bgcolor: 'notice.muted.bg' }} />
              ))}

              {/* Current time line */}
              {showNowLine && (
                <Box sx={{ position: 'absolute', left: (currentHour - START_HOUR) * 60, top: 0, bottom: 0, width: 2, bgcolor: '#EF4444', zIndex: 3, '&::before': { content: '""', position: 'absolute', top: -4, left: -3, width: 8, height: 8, borderRadius: '50%', bgcolor: '#EF4444' } }} />
              )}

              {/* Visit bars */}
              {row.visits.map((v: any) => {
                const durationWidth = Math.max(44, ((new Date(v.scheduled_end).getTime() - new Date(v.scheduled_start).getTime()) / 3600000) * 60)
                const cfg = statusConfig[v.status] || statusConfig.scheduled
                const isSelected = selectedForAssign === v.id
                const startLeft = (() => {
                  const d = new Date(v.scheduled_start)
                  const h = d.getHours() + d.getMinutes() / 60
                  return (h - START_HOUR) * 60
                })()

                return (
                  <Tooltip key={v.id} title={`${v.person_name} · ${time(v.scheduled_start)}–${time(v.scheduled_end)} · ${v.label}${row.isUnassigned ? ' (drag to a carer)' : ' (drag to another carer or Unassigned)'}`} arrow placement="top">
                    <Box
                      draggable
                      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', v.id); setDraggedTimelineVisit(v.id) }}
                      onDragEnd={() => setDraggedTimelineVisit(null)}
                      onClick={() => row.isUnassigned ? onSelectVisit(v.id) : undefined}
                      sx={{
                        position: 'absolute',
                        left: startLeft,
                        top: 10,
                        height: ROW_HEIGHT - 20,
                        width: durationWidth,
                        minWidth: durationWidth,
                        bgcolor: isSelected ? '#EAF3FF' : cfg.bg,
                        border: `1.5px solid ${isSelected ? '#2F80ED' : cfg.color}40`,
                        borderLeft: `3px solid ${cfg.color}`,
                        borderRadius: 1,
                        px: 0.75,
                        py: 0.25,
                        cursor: 'grab',
                        overflow: 'hidden',
                        zIndex: 1,
                        transition: 'all 0.15s',
                        '&:hover': {
                          zIndex: 5,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                          transform: 'scale(1.02)',
                        },
                      }}
                    >
                      <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.6rem', color: cfg.color, display: 'block', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {time(v.scheduled_start)}
                      </Typography>
                      <Typography variant="caption" sx={{ fontSize: '0.55rem', display: 'block', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'text.secondary' }}>
                        {v.person_name}
                      </Typography>
                    </Box>
                  </Tooltip>
                )
              })}
            </Box>
          </Box>
        ))}
      </Box>
    </Paper>
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
        borderColor: isSelected ? '#2F80ED' : isDragging ? '#2F80ED' : '#E6EAF0',
        borderRadius: 1.5,
        cursor: 'grab',
        opacity: isDragging ? 0.5 : 1,
        bgcolor: isSelected ? '#F4F8FF' : 'white',
        transition: 'all 0.15s',
        '&:hover': { borderColor: '#2F80ED', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
        '&:active': { cursor: 'grabbing' },
      }}
    >
      <Stack direction="row" alignItems="flex-start" spacing={1}>
        <DragIcon sx={{ fontSize: 16, color: '#98A2B3', mt: 0.25, flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.85rem' }} noWrap>
              {visit.person_name}
            </Typography>
            <Chip
              label={`${time(visit.scheduled_start)}–${time(visit.scheduled_end)}`}
              size="small"
              sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600, bgcolor: 'notice.muted.bg', flexShrink: 0 }}
            />
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap>
            {visit.label}
          </Typography>
          {visit.person_address && (
            <Typography variant="caption" sx={{ color: '#98A2B3', display: 'block' }} noWrap>
              📍 {visit.person_address}
            </Typography>
          )}
          {tasks.length > 0 && (
            <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 0.5 }}>
              <TaskIcon sx={{ fontSize: 11, color: doneCount === tasks.length ? '#10B981' : '#F59E0B' }} />
              <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 600, color: doneCount === tasks.length ? '#087A55' : '#9A6700' }}>
                {doneCount}/{tasks.length} tasks
              </Typography>
            </Stack>
          )}
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 0.5 }}>
            <Tooltip title="AI suggest best carer">
              <Button size="small" variant="outlined" startIcon={<Lightbulb sx={{ fontSize: 13 }} />} onClick={(e) => { e.stopPropagation(); onSuggest(visit.id) }} sx={{ textTransform: 'none', fontSize: '0.65rem', py: 0, borderColor: '#D8DEE7', color: '#2F80ED', '&:hover': { borderColor: '#2F80ED', bgcolor: '#F4F8FF' } }}>
                Suggest
              </Button>
            </Tooltip>
          </Stack>
        </Box>
      </Stack>

      {/* Expanded task list */}
      {expanded && (
        <Box sx={{ ml: 3, mt: 1, pl: 1, borderLeft: '2px solid #E6EAF0' }}>
          {tasks.map((task: VisitTask) => (
            <Stack key={task.id} direction="row" alignItems="center" gap={0.5} sx={{ py: 0.25 }}>
              <Box
                onClick={(e) => { e.stopPropagation(); onToggleTask(task.id, !task.done) }}
                sx={{
                  width: 14, height: 14, borderRadius: 1, border: '1.5px solid', cursor: 'pointer',
                  borderColor: task.done ? '#10B981' : '#D8DEE7', bgcolor: task.done ? '#10B981' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                {task.done && <CheckIcon sx={{ fontSize: 10, color: 'white' }} />}
              </Box>
              <Typography variant="caption" sx={{ flex: 1, textDecoration: task.done ? 'line-through' : 'none', color: task.done ? '#98A2B3' : '#344054' }}>
                {task.label}
              </Typography>
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id) }} sx={{ p: 0, '&:hover': { color: '#EF4444' } }}>
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
              <AddIcon sx={{ fontSize: 16, color: '#2F80ED' }} />
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
  onDragOver, onDragLeave, onDrop, onClick, onDragStart, onDragEnd,
  expandedVisit, onExpand, newTaskLabel, onNewTaskLabelChange,
  onAddTask, onToggleTask, onDeleteTask, isAddingTask, onUnassign,
}: any) {
  const sorted = useMemo(() => [...visits].sort((a: any, b: any) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()), [visits])
  const [travelTimes, setTravelTimes] = useState<Record<string, { duration_minutes: number; distance_km: number }>>({})

  // Fetch travel times between consecutive visits
  useEffect(() => {
    if (sorted.length < 2) return
    const pairs: Array<{ origin: string; destination: string; key: string }> = []
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]
      const curr = sorted[i]
      if (prev.latitude && prev.longitude && curr.latitude && curr.longitude) {
        pairs.push({
          origin: `${prev.latitude},${prev.longitude}`,
          destination: `${curr.latitude},${curr.longitude}`,
          key: `${prev.id}:${curr.id}`,
        })
      }
    }
    if (pairs.length === 0) return

    // Fetch travel times (batch via bulk endpoint)
    api.post('/homecare/visits/bulk-travel-time', { pairs: pairs.map(p => ({ origin: p.origin, destination: p.destination })) })
      .then(res => {
        const map: Record<string, { duration_minutes: number; distance_km: number }> = {}
        res.data.results.forEach((r: any, i: number) => {
          map[pairs[i].key] = { duration_minutes: r.duration_minutes, distance_km: r.distance_km }
        })
        setTravelTimes(map)
      })
      .catch(() => {})
  }, [sorted])

  // Calculate workload summary
  const totalMins = visits.reduce((sum: number, v: any) => {
    return sum + (new Date(v.scheduled_end).getTime() - new Date(v.scheduled_start).getTime()) / 60000
  }, 0)
  const hours = Math.floor(totalMins / 60)
  const mins = Math.round(totalMins % 60)

  return (
    <Paper
      elevation={0}
      data-testid={`carer-drop-zone-${carerId}`}
      onDragOver={(e: any) => onDragOver(e, carerId)}
      onDragLeave={onDragLeave}
      onDrop={() => onDrop(carerId)}
      onClick={isClickable ? onClick : undefined}
      sx={{
        p: 2, border: '2px solid',
        // `grey.200` and `grey.100` were both near-white hairlines that only
        // read as a border in light mode; `divider` is the mode-aware token.
        borderColor: isDropTarget ? '#2F80ED' : 'divider',
        borderRadius: 2,
        transition: 'all 0.2s',
        bgcolor: isDropTarget ? '#F4F8FF' : visits.length === 0 ? '#F9FAFB' : 'white',
        cursor: isClickable ? 'pointer' : 'default',
        boxShadow: isDropTarget ? '0 0 0 3px rgba(15,76,129,0.1)' : 'none',
        '&:hover': isClickable ? { borderColor: '#2F80ED', boxShadow: '0 0 0 2px rgba(15,76,129,0.08)' } : {},
      }}
    >
      {/* Carer header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <PersonIcon sx={{ fontSize: 18, color: '#2F80ED' }} />
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{name}</Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center">
          {visits.length > 0 && (
            <Chip
              label={`${visits.length} call${visits.length !== 1 ? 's' : ''} · ${hours}h${mins > 0 ? `${mins}m` : ''}`}
              size="small"
              sx={{ bgcolor: '#EAF3FF', color: '#2F80ED', fontWeight: 600, height: 20, fontSize: '0.65rem' }}
            />
          )}
          {visits.length === 0 && (
            <Chip label="No calls" size="small" sx={{ bgcolor: 'notice.muted.bg', color: '#98A2B3', fontWeight: 500, height: 20, fontSize: '0.65rem' }} />
          )}
        </Stack>
      </Stack>

      {/* Drop hint */}
      {isDropTarget && (
        <Box sx={{ py: 2, textAlign: 'center', border: '2px dashed #2F80ED', borderRadius: 1.5, bgcolor: '#F4F8FF', mb: 1 }}>
          <Typography variant="body2" sx={{ color: '#2F80ED', fontWeight: 600 }}>Drop here to assign</Typography>
        </Box>
      )}

      {/* Visit timeline */}
      {sorted.length > 0 ? (
        <Stack spacing={0.5}>
          {sorted.map((v: any, idx: number) => {
            const cfg = statusConfig[v.status] || statusConfig.scheduled
            // Show gap indicator between visits with travel time
            const gap = idx > 0 ? minsBetween(v.scheduled_start, sorted[idx - 1].scheduled_end) : null
            const travelKey = idx > 0 ? `${sorted[idx - 1].id}:${v.id}` : null
            const travel = travelKey ? travelTimes[travelKey] : null
            return (
              <Box key={v.id}>
                {gap !== null && gap > 0 && (
                  <Box sx={{ pl: 3, py: 0.25 }}>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      {travel ? (
                        <>
                          <Typography variant="caption" sx={{ color: travel.duration_minutes > gap ? '#EF4444' : '#98A2B3', fontSize: '0.6rem', fontWeight: 600 }}>
                            {travel.duration_minutes > gap
                              ? `⚠ ${travel.duration_minutes}min travel (only ${Math.round(gap)}min gap)`
                              : `${travel.distance_km}km · ~${travel.duration_minutes}min travel`}
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="caption" sx={{ color: gap < 15 ? '#EF4444' : '#98A2B3', fontSize: '0.6rem', fontWeight: 600 }}>
                          {gap < 15 ? `⚠ ${Math.round(gap)}min gap` : `${Math.round(gap)}min gap`}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                )}
                <Stack
                  draggable
                  onDragStart={(e: any) => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', v.id); onDragStart(v.id) }}
                  onDragEnd={onDragEnd}
                  direction="row" alignItems="center" spacing={1}
                  sx={{
                    py: 0.75, px: 1, bgcolor: 'notice.subtle.bg', borderRadius: 1, cursor: 'pointer',
                    '&:hover': { bgcolor: 'notice.muted.bg' },
                  }}
                  onClick={() => onExpand(v.id === expandedVisit ? null : v.id)}
                >
                  <TimeIcon sx={{ fontSize: 13, color: '#2F80ED', flexShrink: 0 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" gap={0.5}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#2F80ED' }}>
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
                        sx={{ p: 0, '&:hover': { color: '#EF4444' } }}
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
        <Typography variant="caption" sx={{ color: '#98A2B3', textAlign: 'center', display: 'block', py: 2 }}>
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
    <Box sx={{ ml: 3.5, mt: 0.5, pl: 1, borderLeft: '2px solid #E6EAF0', mb: 1 }}>
      {tasks.map((task: VisitTask) => (
        <Stack key={task.id} direction="row" alignItems="center" gap={0.5} sx={{ py: 0.25 }}>
          <Box
            onClick={() => onToggleTask(task.id, !task.done)}
            sx={{
              width: 14, height: 14, borderRadius: 1, border: '1.5px solid', cursor: 'pointer',
              borderColor: task.done ? '#10B981' : '#D8DEE7', bgcolor: task.done ? '#10B981' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            {task.done && <CheckIcon sx={{ fontSize: 10, color: 'white' }} />}
          </Box>
          <Typography variant="caption" sx={{ flex: 1, textDecoration: task.done ? 'line-through' : 'none', color: task.done ? '#98A2B3' : '#344054' }}>
            {task.label}
          </Typography>
          <IconButton size="small" onClick={() => onDeleteTask(task.id)} sx={{ p: 0, '&:hover': { color: '#EF4444' } }}>
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
          <AddIcon sx={{ fontSize: 16, color: '#2F80ED' }} />
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
