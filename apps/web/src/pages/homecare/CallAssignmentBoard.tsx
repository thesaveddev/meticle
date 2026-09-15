import { useState } from 'react'
import { Box, Button, Checkbox, Chip, CircularProgress, IconButton, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Add as AddIcon, Delete as DeleteIcon, Assignment as TaskIcon } from '@mui/icons-material'
import api from '../../services/api'

const time = (d: string) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const dateStr = (d: string) => new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: 'Done', color: '#047857', bg: '#E9F7F0' },
  checked_in: { label: 'At client', color: '#0F4C81', bg: '#E0F2FE' },
  en_route: { label: 'En route', color: '#7C3AED', bg: '#EDE9FE' },
  scheduled: { label: 'Scheduled', color: 'text.secondary', bg: '#F3F4F6' },
  missed: { label: 'Missed', color: '#DC2626', bg: '#FDECEC' },
}

interface Visit {
  id: string
  label: string
  person_name: string
  person_address: string | null
  assigned_staff_id: string | null
  carer_name: string | null
  status: string
  scheduled_start: string
  scheduled_end: string
  package_name: string | null
}

interface Staff {
  id: string
  first_name: string
  last_name: string
}

interface VisitTask {
  id: string
  visit_id: string
  label: string
  sort_order: number
  done: boolean
}

function useAvailableStaff(visit: Visit, enabled: boolean) {
  return useQuery({
    queryKey: ['available-staff', visit.id, visit.scheduled_start, visit.scheduled_end],
    queryFn: () => api.get('/homecare/available-staff', { params: { start: visit.scheduled_start, end: visit.scheduled_end, excludeVisitId: visit.id } }).then(r => Array.isArray(r.data) ? r.data : []),
    enabled: enabled && !!visit.id,
  })
}

function useVisitTasks(visitId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['visit-tasks', visitId],
    queryFn: () => api.get(`/homecare/visits/${visitId}/tasks`).then(r => Array.isArray(r.data) ? r.data : []),
    enabled: enabled && !!visitId,
  })
}

export default function CallAssignmentBoard() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [assigningVisit, setAssigningVisit] = useState<string | null>(null)
  const [selectedCarer, setSelectedCarer] = useState('')
  const [expandedVisit, setExpandedVisit] = useState<string | null>(null)
  const [newTaskLabel, setNewTaskLabel] = useState('')
  const qc = useQueryClient()

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
      setAssigningVisit(null)
      setSelectedCarer('')
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
    onError: (e: any) => alert(e.response?.data?.message || 'Could not add task'),
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

  const unassigned = visits.filter((v: any) => !v.assigned_staff_id && v.status === 'scheduled')
  const assigned = visits.filter((v: any) => v.assigned_staff_id && ['scheduled', 'en_route', 'checked_in'].includes(v.status))

  // Group assigned visits by carer
  const carerMap = new Map<string, { name: string; visits: Visit[] }>()
  for (const v of assigned) {
    const key = v.assigned_staff_id!
    const name = v.carer_name || 'Unknown'
    if (!carerMap.has(key)) carerMap.set(key, { name, visits: [] })
    carerMap.get(key)!.visits.push(v)
  }
  const carers = Array.from(carerMap.entries()).sort((a, b) => b[1].visits.length - a[1].visits.length)

  // Carers with no calls today
  const assignedIds = new Set(assigned.map((v: any) => v.assigned_staff_id))
  const idleCarers = staff.filter((s: Staff) => !assignedIds.has(s.id))

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Call Assignment Board</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>Assign carers to today's calls and manage tasks</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button size="small" onClick={() => { const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d.toISOString().slice(0, 10)) }} sx={{ minWidth: 'auto' }}>←</Button>
          <Chip label={`${dateStr(date)} — ${visits.length} calls`} sx={{ fontWeight: 700, bgcolor: '#0F4C81', color: 'white' }} onClick={() => setDate(new Date().toISOString().slice(0, 10))} />
          <Button size="small" onClick={() => { const d = new Date(date); d.setDate(d.getDate() + 1); setDate(d.toISOString().slice(0, 10)) }} sx={{ minWidth: 'auto' }}>→</Button>
        </Stack>
      </Stack>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3}>
          {/* Unassigned calls column */}
          <Paper elevation={0} sx={{ p: 3, flex: '0 0 320px', border: '1px solid', borderColor: 'grey.200', borderRadius: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#D97706' }}>Unassigned calls</Typography>
              <Chip label={unassigned.length} size="small" sx={{ bgcolor: unassigned.length > 0 ? '#FFF5D9' : '#F3F4F6', color: unassigned.length > 0 ? '#D97706' : '#9CA3AF', fontWeight: 700 }} />
            </Stack>
            {unassigned.length === 0 ? (
              <Typography variant="body2" sx={{ color: 'text.secondary', py: 3, textAlign: 'center' }}>All calls are assigned</Typography>
            ) : (
              <Stack spacing={1}>
                {unassigned.map((v: any) => (
                  <VisitCard
                    key={v.id}
                    visit={v}
                    isAssigning={assigningVisit === v.id}
                    selectedCarer={selectedCarer}
                    staff={staff}
                    expanded={expandedVisit === v.id}
                    onAssign={() => { setAssigningVisit(v.id); setSelectedCarer('') }}
                    onAssignSubmit={() => assignVisit.mutate({ visitId: v.id, staffId: selectedCarer })}
                    onAssignCancel={() => setAssigningVisit(null)}
                    onCarerChange={setSelectedCarer}
                    assignVisit={assignVisit}
                  />
                ))}
              </Stack>
            )}

            {idleCarers.length > 0 && (
              <>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary', mt: 3, mb: 1 }}>Available carers</Typography>
                <Stack spacing={0.5}>
                  {idleCarers.map((s: Staff) => (
                    <Box key={s.id} sx={{ py: 0.5, px: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.first_name} {s.last_name}</Typography>
                      <Typography variant="caption" sx={{ color: '#10b981' }}>No calls today</Typography>
                    </Box>
                  ))}
                </Stack>
              </>
            )}
          </Paper>

          {/* Carer workload columns */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Carer workload</Typography>
            {carers.length === 0 ? (
              <Paper elevation={0} sx={{ p: 6, textAlign: 'center', border: '1px solid', borderColor: 'grey.200', borderRadius: 2 }}>
                <Typography sx={{ color: 'text.secondary' }}>No assigned calls for this day</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Click an unassigned call to assign a carer</Typography>
              </Paper>
            ) : (
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                {carers.map(([carerId, { name, visits: carerVisits }]) => (
                  <Paper key={carerId} elevation={0} sx={{ p: 2, flex: '1 1 280px', minWidth: 280, border: '1px solid', borderColor: 'grey.200', borderRadius: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{name}</Typography>
                      <Chip label={`${carerVisits.length} calls`} size="small" sx={{ bgcolor: 'info.light', color: '#0F4C81', fontWeight: 600, height: 20, fontSize: '0.65rem' }} />
                    </Stack>
                    <Stack spacing={0.5}>
                      {carerVisits.sort((a: any, b: any) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()).map((v: any) => {
                        const cfg = statusConfig[v.status] || statusConfig.scheduled
                        return (
                          <CarerVisitRow key={v.id} visit={v} cfg={cfg} expanded={expandedVisit === v.id} onExpand={() => setExpandedVisit(expandedVisit === v.id ? null : v.id)}
                            newTaskLabel={newTaskLabel} onNewTaskLabelChange={setNewTaskLabel}
                            onAddTask={(label: string) => addTask.mutate({ visitId: v.id, label })}
                            onToggleTask={(taskId: string, done: boolean) => toggleTask.mutate({ visitId: v.id, taskId, done })}
                            onDeleteTask={(taskId: string) => deleteTask.mutate({ visitId: v.id, taskId })}
                            isAddingTask={addTask.isPending}
                          />
                        )
                      })}
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Box>
        </Stack>
      )}
    </Box>
  )
}

/* ─── Visit Card (unassigned column) ───────────────────────── */

function VisitCard({ visit, isAssigning, selectedCarer, staff, expanded, onAssign, onAssignSubmit, onAssignCancel, onCarerChange, assignVisit }: any) {
  const { data: tasks = [] } = useVisitTasks(visit.id, expanded)
  const { data: availableStaff = [], isLoading: loadingSuggestions } = useAvailableStaff(visit, isAssigning)
  const doneCount = tasks.filter((t: VisitTask) => t.done).length
  const suggestedIds = new Set(availableStaff.filter((member: any) => member.available_in_window).map((member: any) => member.id))
  const orderedStaff = [...staff].sort((a: Staff, b: Staff) => Number(suggestedIds.has(b.id)) - Number(suggestedIds.has(a.id)))

  return (
    <Paper elevation={0} sx={{ p: 1.5, border: '1px solid', borderColor: 'grey.200', borderRadius: 1.5, cursor: 'pointer', '&:hover': { borderColor: '#0F4C81' } }} onClick={() => { if (!isAssigning) { onAssign() } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{visit.person_name}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{time(visit.scheduled_start)} - {time(visit.scheduled_end)}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{visit.label}</Typography>
          {tasks.length > 0 && (
            <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 0.5 }}>
              <TaskIcon sx={{ fontSize: 12, color: doneCount === tasks.length ? '#10B981' : '#D97706' }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: doneCount === tasks.length ? '#047857' : '#92400E', fontSize: '0.7rem' }}>
                {doneCount}/{tasks.length} tasks
              </Typography>
            </Stack>
          )}
        </Box>
      </Stack>
      {isAssigning && (
        <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="center">
          <TextField select size="small" value={selectedCarer} onChange={e => onCarerChange(e.target.value)} sx={{ flex: 1, minWidth: 0 }} helperText={loadingSuggestions ? 'Checking availability and travel time…' : 'Suggested carers appear first'}>
            <MenuItem value="">Select carer</MenuItem>
            {orderedStaff.map((s: Staff) => <MenuItem key={s.id} value={s.id}>{s.first_name} {s.last_name}{suggestedIds.has(s.id) ? ' — available' : ''}</MenuItem>)}
          </TextField>
          <Button size="small" variant="contained" disabled={!selectedCarer} onClick={onAssignSubmit} sx={{ textTransform: 'none', bgcolor: '#0F4C81' }}>
            {assignVisit.isPending ? <CircularProgress size={16} color="inherit" /> : 'Assign'}
          </Button>
          <Button size="small" onClick={onAssignCancel} sx={{ minWidth: 'auto' }}>×</Button>
        </Stack>
      )}
    </Paper>
  )
}

/* ─── Carer Visit Row (workload column) ────────────────────── */

function CarerVisitRow({ visit, cfg, expanded, onExpand, newTaskLabel, onNewTaskLabelChange, onAddTask, onToggleTask, onDeleteTask, isAddingTask }: any) {
  const { data: tasks = [] } = useVisitTasks(visit.id, expanded)
  const doneCount = tasks.filter((t: VisitTask) => t.done).length

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.75, px: 1, bgcolor: 'grey.50', borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: 'grey.100' } }} onClick={onExpand}>
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: '#0F4C81' }}>{time(visit.scheduled_start)}</Typography>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>{visit.person_name}</Typography>
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{visit.label}</Typography>
          {tasks.length > 0 && (
            <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 0.25 }}>
              <TaskIcon sx={{ fontSize: 10, color: doneCount === tasks.length ? '#10B981' : '#D97706' }} />
              <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 600, color: doneCount === tasks.length ? '#047857' : '#92400E' }}>
                {doneCount}/{tasks.length}
              </Typography>
            </Stack>
          )}
        </Box>
        <Chip label={cfg.label} size="small" sx={{ bgcolor: cfg.bg, color: cfg.color, height: 18, fontSize: '0.6rem', fontWeight: 600 }} />
      </Stack>

      {/* Expanded task list */}
      {expanded && (
        <Box sx={{ ml: 2, mt: 0.5, mb: 1, pl: 1, borderLeft: '2px solid #E5E7EB' }}>
          {tasks.map((task: VisitTask) => (
            <Stack key={task.id} direction="row" alignItems="center" gap={0.5} sx={{ py: 0.25 }}>
              <Checkbox
                checked={task.done}
                onChange={() => onToggleTask(task.id, !task.done)}
                size="small"
                sx={{ p: 0, color: '#D97706', '&.Mui-checked': { color: '#10B981' } }}
              />
              <Typography variant="caption" sx={{ flex: 1, textDecoration: task.done ? 'line-through' : 'none', color: task.done ? '#9CA3AF' : '#374151' }}>
                {task.label}
              </Typography>
              <IconButton size="small" onClick={() => onDeleteTask(task.id)} sx={{ p: 0, '&:hover': { color: '#DC2626' } }}>
                <DeleteIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </Stack>
          ))}
          {/* Add task input */}
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 0.5 }}>
            <TextField
              size="small"
              placeholder="Add a task..."
              value={newTaskLabel}
              onChange={e => onNewTaskLabelChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newTaskLabel.trim()) { onAddTask(newTaskLabel.trim()) } }}
              sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: '0.75rem', py: 0.5 } }}
              onClick={e => e.stopPropagation()}
            />
            <IconButton size="small" disabled={!newTaskLabel.trim() || isAddingTask} onClick={() => { if (newTaskLabel.trim()) onAddTask(newTaskLabel.trim()) }} sx={{ p: 0.5 }}>
              <AddIcon sx={{ fontSize: 16, color: '#0F4C81' }} />
            </IconButton>
          </Stack>
        </Box>
      )}
    </Box>
  )
}
