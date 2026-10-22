import { useState } from 'react'
import { Box, Typography, Paper, Stack, Button, Alert, CircularProgress, TextField, MenuItem, Chip } from '@mui/material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { StatusBadge, EmptyRow, NAVY } from '../../components/ui'

/**
 * Closeout board: investigation, external-reporting decisions, and the
 * guarded close. Close is a gate, not a status edit — the 409 names every
 * blocker, so this surfaces the server's answer rather than guessing it.
 */
export default function IncidentCloseoutBoard({ incidentId, status, canTriage }: { incidentId: string; status: string; canTriage: boolean }) {
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const [completeSummary, setCompleteSummary] = useState('')
  const [reportForm, setReportForm] = useState({ reportable: 'yes', channel: 'CQC', reference: '', reported_at: '' })
  const [closeSummary, setCloseSummary] = useState('')

  const investigationQuery = useQuery({
    queryKey: ['incident-investigation', incidentId],
    queryFn: () => api.get(`/incidents/${incidentId}/investigation`).then(r => r.data),
    retry: false,
  })
  const reportingQuery = useQuery({
    queryKey: ['incident-reporting', incidentId],
    queryFn: () => api.get(`/incidents/${incidentId}/reporting`).then(r => r.data),
    retry: false,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['incident-investigation', incidentId] })
    queryClient.invalidateQueries({ queryKey: ['incident-reporting', incidentId] })
    queryClient.invalidateQueries({ queryKey: ['incident', incidentId] })
    queryClient.invalidateQueries({ queryKey: ['incident-timeline', incidentId] })
  }

  const startMutation = useMutation({
    mutationFn: () => api.post(`/incidents/${incidentId}/investigation`, {}),
    onSuccess: invalidate,
  })
  const noteMutation = useMutation({
    mutationFn: (text: string) => api.post(`/incidents/${incidentId}/investigation/notes`, { note: text }),
    onSuccess: () => { invalidate(); setNote('') },
  })
  const completeMutation = useMutation({
    mutationFn: () => api.post(`/incidents/${incidentId}/investigation/complete`, completeSummary.trim() ? { summary: completeSummary.trim() } : {}),
    onSuccess: () => { invalidate(); setCompleteSummary('') },
  })
  const assessMutation = useMutation({
    mutationFn: () => api.post(`/incidents/${incidentId}/reporting`, {
      reportable: reportForm.reportable === 'yes',
      channel: reportForm.channel.trim() || 'CQC',
      ...(reportForm.reference.trim() ? { reference: reportForm.reference.trim() } : {}),
      ...(reportForm.reported_at ? { reported_at: reportForm.reported_at } : {}),
    }),
    onSuccess: () => { invalidate(); setReportForm({ reportable: 'yes', channel: 'CQC', reference: '', reported_at: '' }) },
  })
  const closeMutation = useMutation({
    mutationFn: () => api.post(`/incidents/${incidentId}/close`, closeSummary.trim() ? { summary: closeSummary.trim() } : {}),
    onSuccess: invalidate,
  })

  const investigation = investigationQuery.data?.status ? investigationQuery.data : null
  const investigationMissing = investigationQuery.isError
  const notes: any[] = Array.isArray(investigation?.notes) ? investigation.notes : []
  const assessments: any[] = Array.isArray(reportingQuery.data) ? reportingQuery.data : []
  const isClosed = status === 'closed'

  if (investigationQuery.isLoading || reportingQuery.isLoading) {
    return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress size={24} sx={{ color: NAVY }} /></Box>
  }

  return (
    <Stack spacing={3}>
      {/* Investigation */}
      <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography variant="subtitle2" fontWeight={600}>Investigation</Typography>
          {investigation && <StatusBadge label={investigation.status === 'complete' ? 'complete' : 'open'} tone={investigation.status === 'complete' ? 'success' : 'warning'} />}
        </Stack>
        {!investigation ? (
          <EmptyRow message={investigationMissing ? 'No investigation opened yet' : 'No investigation opened yet'} action={
            canTriage && !isClosed && <Button size="small" variant="outlined" disabled={startMutation.isPending}
              onClick={() => startMutation.mutate()} sx={{ textTransform: 'none' }}>Open investigation</Button>
          } />
        ) : (
          <Stack spacing={1.5}>
            {investigation.summary && <Typography variant="body2" color="text.secondary">{investigation.summary}</Typography>}
            {notes.length > 0 && (
              <Stack spacing={1}>
                {notes.map((n: any) => (
                  <Paper key={n.id} variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
                    <Typography variant="body2">{n.note}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {n.author || 'Staff'} · {new Date(n.created_at).toLocaleString('en-GB')}
                    </Typography>
                  </Paper>
                ))}
              </Stack>
            )}
            {canTriage && investigation.status === 'open' && (
              <Stack spacing={1.5}>
                <TextField label="Add a finding" value={note} onChange={e => setNote(e.target.value)}
                  fullWidth multiline minRows={2} helperText="Findings append — they are never edited." />
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="outlined" disabled={!note.trim() || noteMutation.isPending}
                    onClick={() => noteMutation.mutate(note.trim())} sx={{ textTransform: 'none' }}>
                    {noteMutation.isPending ? 'Adding…' : 'Add finding'}
                  </Button>
                </Stack>
                <TextField label="Closing summary (optional)" value={completeSummary}
                  onChange={e => setCompleteSummary(e.target.value)} fullWidth multiline minRows={2} />
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="contained" disabled={completeMutation.isPending}
                    onClick={() => completeMutation.mutate()}
                    sx={{ bgcolor: NAVY, textTransform: 'none' }}>
                    {completeMutation.isPending ? 'Completing…' : 'Complete investigation'}
                  </Button>
                </Stack>
              </Stack>
            )}
            {(noteMutation.isError || completeMutation.isError || startMutation.isError) && (
              <Alert severity="error">Investigation update failed — a completed investigation is immutable; refresh and retry.</Alert>
            )}
          </Stack>
        )}
      </Paper>

      {/* External reporting */}
      <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0' }}>
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>External reporting</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          Each decision is recorded — a CQC-reportable incident cannot close without one.
        </Typography>
        {canTriage && !isClosed && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
            <TextField select label="Reportable" size="small" value={reportForm.reportable}
              onChange={e => setReportForm(f => ({ ...f, reportable: e.target.value }))} sx={{ minWidth: 140 }}>
              <MenuItem value="yes">Reportable</MenuItem>
              <MenuItem value="no">Not reportable</MenuItem>
            </TextField>
            <TextField label="Channel" size="small" value={reportForm.channel}
              onChange={e => setReportForm(f => ({ ...f, channel: e.target.value }))} sx={{ minWidth: 120 }} />
            <TextField label="Reference" size="small" value={reportForm.reference}
              onChange={e => setReportForm(f => ({ ...f, reference: e.target.value }))} sx={{ flex: 1 }} />
            <TextField label="Reported at" type="date" size="small" InputLabelProps={{ shrink: true }} value={reportForm.reported_at}
              onChange={e => setReportForm(f => ({ ...f, reported_at: e.target.value }))} />
            <Button size="small" variant="outlined" disabled={assessMutation.isPending}
              onClick={() => assessMutation.mutate()} sx={{ textTransform: 'none', flexShrink: 0 }}>
              {assessMutation.isPending ? 'Saving…' : 'Record'}
            </Button>
          </Stack>
        )}
        {reportingQuery.isError ? (
          <Alert severity="error">Could not load reporting decisions — refresh and retry.</Alert>
        ) : assessments.length === 0 ? (
          <EmptyRow message="No reporting decisions recorded" />
        ) : (
          <Stack spacing={1}>
            {assessments.map((a: any) => (
              <Stack key={a.id} direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <StatusBadge label={a.reportable ? 'reportable' : 'not reportable'} tone={a.reportable ? 'error' : 'neutral'} />
                <Typography variant="caption" color="text.secondary">
                  {[a.channel, a.reference, a.reported_at ? new Date(a.reported_at).toLocaleDateString('en-GB') : '', a.decided_by_name ? `decided by ${a.decided_by_name}` : ''].filter(Boolean).join(' · ')}
                </Typography>
                <Typography variant="caption" color="text.secondary">{new Date(a.created_at).toLocaleString('en-GB')}</Typography>
              </Stack>
            ))}
          </Stack>
        )}
        {assessMutation.isError && <Alert severity="error" sx={{ mt: 2 }}>Decision failed to save — refresh and retry.</Alert>}
      </Paper>

      {/* Guarded close */}
      {!isClosed && (
        <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0' }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>Close incident</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Closure is checked: an open investigation, unverified completed actions, or a missing
            reporting decision on a CQC-reportable incident blocks it. Open actions carry over.
          </Typography>
          {canTriage ? (
            <Stack spacing={1.5}>
              <TextField label="Closing summary (optional)" value={closeSummary}
                onChange={e => setCloseSummary(e.target.value)} fullWidth multiline minRows={2} />
              <Stack direction="row" spacing={1} alignItems="center">
                <Button size="small" variant="contained" disabled={closeMutation.isPending}
                  onClick={() => closeMutation.mutate()} sx={{ bgcolor: NAVY, textTransform: 'none' }}>
                  {closeMutation.isPending ? 'Closing…' : 'Close incident'}
                </Button>
                {closeMutation.isError && (
                  <Chip size="small" label="Blocked — see message" color="warning" variant="outlined" />
                )}
              </Stack>
              {closeMutation.isError && (
                <Alert severity="warning">
                  {(closeMutation.error as any)?.response?.data?.message || 'Close was blocked — refresh to see the current blockers and retry.'}
                </Alert>
              )}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">Only a manager can close an incident.</Typography>
          )}
        </Paper>
      )}
    </Stack>
  )
}
