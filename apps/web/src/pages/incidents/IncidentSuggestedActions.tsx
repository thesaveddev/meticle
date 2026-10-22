import { useState } from 'react'
import { Box, Typography, Paper, Stack, Button, Alert, CircularProgress, TextField } from '@mui/material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { StatusBadge, EmptyRow, NAVY } from '../../components/ui'

const SOURCE_TONE: Record<string, 'info' | 'warning' | 'neutral'> = {
  rules: 'info', ai: 'warning', manager: 'neutral',
}

/**
 * Draft corrective actions (§13.5 step 7): rules propose from the incident's
 * facts, the AI triage's recommendations join with provenance, and a manager
 * approves each draft into real work — or rejects it with a recorded reason.
 * Nothing here assigns work by itself.
 */
export default function IncidentSuggestedActions({ incidentId, canTriage }: { incidentId: string; canTriage: boolean }) {
  const queryClient = useQueryClient()
  const [rejectTarget, setRejectTarget] = useState<any>(null)
  const [rejectReason, setRejectReason] = useState('')

  const suggestionsQuery = useQuery({
    queryKey: ['incident-suggestions', incidentId],
    queryFn: () => api.get(`/incidents/${incidentId}/actions/suggestions`).then(r => r.data),
    retry: false,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['incident-suggestions', incidentId] })
    queryClient.invalidateQueries({ queryKey: ['incident', incidentId] })
  }

  const suggestMutation = useMutation({
    mutationFn: () => api.post(`/incidents/${incidentId}/actions/suggest`, {}),
    onSuccess: invalidate,
  })
  const decideMutation = useMutation({
    mutationFn: ({ suggestionId, decision, reason }: { suggestionId: string; decision: string; reason?: string }) =>
      api.post(`/incidents/${incidentId}/actions/suggestions/${suggestionId}/decide`, reason ? { decision, reason } : { decision }),
    onSuccess: () => { invalidate(); setRejectTarget(null); setRejectReason('') },
  })

  const suggestions: any[] = Array.isArray(suggestionsQuery.data) ? suggestionsQuery.data : []
  const proposed = suggestions.filter(s => s.status === 'proposed')
  const decided = suggestions.filter(s => s.status !== 'proposed')

  if (suggestionsQuery.isLoading) {
    return <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress size={22} sx={{ color: NAVY }} /></Box>
  }

  return (
    <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0', mb: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="subtitle2" fontWeight={600}>Suggested actions</Typography>
        {canTriage && (
          <Button size="small" variant="outlined" disabled={suggestMutation.isPending}
            onClick={() => suggestMutation.mutate()} sx={{ textTransform: 'none' }}>
            {suggestMutation.isPending ? 'Suggesting…' : suggestions.length ? 'Refresh suggestions' : 'Suggest actions'}
          </Button>
        )}
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        Drafts from the incident's facts{proposed.length > 0 || decided.length > 0 ? '' : ' — nothing proposed yet'}. Approving creates the action; rejecting records why.
      </Typography>
      {suggestionsQuery.isError ? (
        <Alert severity="error">Could not load suggestions — refresh and retry.</Alert>
      ) : suggestions.length === 0 ? (
        <EmptyRow message="No suggested actions yet" />
      ) : (
        <Stack spacing={1}>
          {proposed.map((s: any) => (
            <Paper key={s.id} variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600}>{s.action}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Due {s.due_date ? new Date(s.due_date).toLocaleDateString('en-GB') : '—'}
                  </Typography>
                </Box>
                <StatusBadge label={s.source === 'ai' ? 'AI suggestion' : 'rule suggestion'} tone={SOURCE_TONE[s.source] || 'neutral'} />
                {canTriage && (
                  <Stack direction="row" spacing={1}>
                    <Button size="small" variant="contained" disabled={decideMutation.isPending}
                      onClick={() => decideMutation.mutate({ suggestionId: s.id, decision: 'approved' })}
                      sx={{ bgcolor: NAVY, textTransform: 'none' }}>Approve</Button>
                    <Button size="small" variant="text" color="inherit" disabled={decideMutation.isPending}
                      onClick={() => { setRejectTarget(s); setRejectReason('') }} sx={{ textTransform: 'none' }}>
                      Reject
                    </Button>
                  </Stack>
                )}
              </Stack>
            </Paper>
          ))}
          {decided.map((s: any) => (
            <Stack key={s.id} direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <StatusBadge label={s.status} tone={s.status === 'approved' ? 'success' : 'neutral'} />
              <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 120 }}>
                {s.action}{s.decision_reason ? ` — ${s.decision_reason}` : ''}
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
      {(suggestMutation.isError || decideMutation.isError) && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {(decideMutation.error as any)?.response?.data?.message || 'Suggestion update failed — refresh and retry.'}
        </Alert>
      )}
      {rejectTarget && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
          <TextField size="small" label={`Why reject: ${rejectTarget.action.slice(0, 40)}…`} value={rejectReason}
            onChange={e => setRejectReason(e.target.value)} fullWidth
            helperText="Recorded, not deleted." />
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            <Button size="small" onClick={() => setRejectTarget(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Button size="small" variant="outlined" color="inherit" disabled={decideMutation.isPending}
              onClick={() => decideMutation.mutate({
                suggestionId: rejectTarget.id, decision: 'rejected',
                ...(rejectReason.trim() ? { reason: rejectReason.trim() } : {}),
              })} sx={{ textTransform: 'none' }}>
              Confirm reject
            </Button>
          </Stack>
        </Stack>
      )}
    </Paper>
  )
}
