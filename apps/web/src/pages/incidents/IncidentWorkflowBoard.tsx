import { useState } from 'react'
import { Box, Typography, Paper, Stack, Button, Chip, Alert, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem } from '@mui/material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { StatusBadge, EmptyRow, NAVY } from '../../components/ui'

const TASK_TONE: Record<string, 'warning' | 'info' | 'success' | 'error' | 'neutral'> = {
  pending: 'warning', acknowledged: 'info', completed: 'success', overdue: 'error', escalated: 'error',
}

/** Manager workflow board: severity history, tasks with ack/complete/extend, overrides. */
export default function IncidentWorkflowBoard({ incidentId, canTriage }: { incidentId: string; canTriage: boolean }) {
  const queryClient = useQueryClient()
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [overrideForm, setOverrideForm] = useState({ level: 'high', reason: '' })
  const [extendNote] = useState('')

  const assessmentsQuery = useQuery({
    queryKey: ['incident-assessments', incidentId],
    queryFn: () => api.get(`/incidents/${incidentId}/assessments`).then(r => r.data),
  })
  const workflowQuery = useQuery({
    queryKey: ['incident-workflow', incidentId],
    queryFn: () => api.get(`/incidents/${incidentId}/workflow`).then(r => r.data),
    retry: false,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['incident-workflow', incidentId] })
    queryClient.invalidateQueries({ queryKey: ['incident-assessments', incidentId] })
    queryClient.invalidateQueries({ queryKey: ['incident', incidentId] })
  }

  const taskMutation = useMutation({
    mutationFn: ({ taskId, action, reason }: { taskId: string; action: string; reason?: string }) =>
      api.post(`/incident-workflow/tasks/${taskId}/${action}`, reason ? { reason } : {}),
    onSuccess: invalidate,
  })
  const overrideMutation = useMutation({
    mutationFn: (data: { assessment_id: string; level: string; reason: string }) => api.post('/incident-severity/override', data),
    onSuccess: () => { invalidate(); setOverrideOpen(false); setOverrideForm({ level: 'high', reason: '' }) },
  })

  const assessments: any[] = Array.isArray(assessmentsQuery.data) ? assessmentsQuery.data : []
  const latest = assessments.length ? assessments[assessments.length - 1] : null
  const workflow = workflowQuery.data
  const tasks: any[] = Array.isArray(workflow?.tasks) ? workflow.tasks : []
  const events: any[] = Array.isArray(workflow?.events) ? workflow.events : []

  if (assessmentsQuery.isLoading || workflowQuery.isLoading) {
    return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress size={24} sx={{ color: NAVY }} /></Box>
  }

  return (
    <Stack spacing={3}>
      {/* Severity head */ }
      <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography variant="subtitle2" fontWeight={600}>Severity assessment</Typography>
          {canTriage && latest && (
            <Button size="small" variant="outlined" onClick={() => { setOverrideForm({ level: latest.level, reason: '' }); setOverrideOpen(true) }} sx={{ textTransform: 'none' }}>
              Override
            </Button>
          )}
        </Stack>
        {!latest ? (
          <EmptyRow message="No severity assessment yet — it is computed when the incident is filed" />
        ) : (
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <StatusBadge label={latest.level} tone={latest.level === 'low' ? 'success' : latest.level === 'medium' ? 'warning' : 'error'} />
              {latest.provisional && <Chip size="small" label="Provisional — needs review" color="warning" variant="outlined" />}
              {latest.override_reason && <Chip size="small" label={`Override: ${latest.override_reason}`} variant="outlined" />}
            </Stack>
            {Array.isArray(latest.explanation) && latest.explanation.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Why this level</Typography>
                {latest.explanation.map((e: any, i: number) => (
                  <Typography key={i} variant="body2" color="text.secondary" sx={{ pl: 1.5 }}>• {e.detail || e.rule}</Typography>
                ))}
              </Box>
            )}
            {Array.isArray(latest.missing) && latest.missing.length > 0 && (
              <Typography variant="caption" color="warning.main">Missing: {latest.missing.join(', ')}</Typography>
            )}
          </Stack>
        )}
        {assessments.length > 1 && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {assessments.length} assessments — every reassessment is appended, never overwritten.
          </Typography>
        )}
      </Paper>

      {/* Tasks */ }
      <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0' }}>
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>Workflow tasks</Typography>
        {!workflow ? (
          <EmptyRow message="No workflow started for this incident yet" />
        ) : tasks.length === 0 ? (
          <EmptyRow message="Workflow open — no tasks outstanding" />
        ) : (
          <Stack spacing={1.5}>
            {tasks.map((t: any) => (
              <Paper key={t.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={600}>{t.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t.kind} · owner {t.owner_role}{t.owner_id ? '' : ''} · due {t.due_at ? new Date(t.due_at).toLocaleString('en-GB') : '—'}
                      {t.status === 'escalated' && t.fallback_to ? ` · escalated to ${t.fallback_to}` : ''}
                    </Typography>
                  </Box>
                  <StatusBadge label={t.status.replace(/_/g, ' ')} tone={TASK_TONE[t.status] || 'neutral'} />
                  {canTriage && t.status !== 'completed' && (
                    <Stack direction="row" spacing={1}>
                      {(t.status === 'pending' || t.status === 'overdue') && (
                        <Button size="small" variant="outlined" disabled={taskMutation.isPending}
                          onClick={() => taskMutation.mutate({ taskId: t.id, action: 'ack' })} sx={{ textTransform: 'none' }}>
                          Acknowledge
                        </Button>
                      )}
                      <Button size="small" variant="contained" disabled={taskMutation.isPending}
                        onClick={() => taskMutation.mutate({ taskId: t.id, action: 'complete' })}
                        sx={{ bgcolor: NAVY, textTransform: 'none' }}>
                          Complete
                        </Button>
                      <Button size="small" variant="text" disabled={taskMutation.isPending}
                        onClick={() => taskMutation.mutate({ taskId: t.id, action: 'extend', reason: extendNote || 'Manager extension' })} sx={{ textTransform: 'none' }}>
                        +24h
                      </Button>
                    </Stack>
                  )}
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
        {taskMutation.isError && <Alert severity="error" sx={{ mt: 2 }}>Task update failed — retry; failures stay visible rather than silent.</Alert>}
      </Paper>

      {/* History */ }
      {events.length > 0 && (
        <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0' }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>Workflow history</Typography>
          <Stack spacing={0.5}>
            {events.slice(-8).reverse().map((e: any) => (
              <Typography key={e.id} variant="caption" color="text.secondary">
                {new Date(e.created_at).toLocaleString('en-GB')} — {String(e.event).replace(/_/g, ' ')}
                {e.from_state && e.to_state ? ` (${e.from_state} → ${e.to_state})` : ''}{e.reason ? ` — ${e.reason}` : ''}
              </Typography>
            ))}
          </Stack>
        </Paper>
      )}

      <Dialog open={overrideOpen} onClose={() => setOverrideOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Override severity</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField select label="Level" value={overrideForm.level} onChange={e => setOverrideForm(f => ({ ...f, level: e.target.value }))} fullWidth>
              {['low', 'medium', 'high', 'critical'].map(l => <MenuItem key={l} value={l}>{l}</MenuItem>)}
            </TextField>
            <TextField label="Clinical reason (required, recorded)" value={overrideForm.reason}
              onChange={e => setOverrideForm(f => ({ ...f, reason: e.target.value }))} fullWidth multiline minRows={2}
              helperText="Overrides are appended as rows with your name — never silent edits." />
            {overrideMutation.isError && <Alert severity="error">Override failed — a reason is required and the level must be valid.</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOverrideOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" disabled={!overrideForm.reason.trim() || overrideMutation.isPending}
            onClick={() => latest && overrideMutation.mutate({ assessment_id: latest.id, level: overrideForm.level, reason: overrideForm.reason.trim() })}
            sx={{ bgcolor: NAVY, textTransform: 'none' }}>
            {overrideMutation.isPending ? 'Saving…' : 'Record override'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
