import { useState } from 'react'
import { Box, Typography, Paper, Stack, Button, Alert, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { StatusBadge, EmptyRow, NAVY } from '../../components/ui'

const LINK_TONE: Record<string, 'error' | 'warning' | 'info' | 'neutral'> = {
  duplicate: 'error', parent: 'warning', related: 'info',
}

/**
 * Related-reports board: duplicate candidates the manager converges, and the
 * manual links (duplicate / parent / related) recorded against this incident.
 * Candidates are a heuristic (same category, same week) — linking is the
 * decision, and unlinking it is always one press away.
 */
export default function IncidentLifecycleBoard({ incidentId, canTriage }: { incidentId: string; canTriage: boolean }) {
  const queryClient = useQueryClient()
  const [linkTarget, setLinkTarget] = useState<any>(null)
  const [linkForm, setLinkForm] = useState({ link_type: 'duplicate', reason: '' })

  const duplicatesQuery = useQuery({
    queryKey: ['incident-duplicates', incidentId],
    queryFn: () => api.get(`/incidents/${incidentId}/duplicates`).then(r => r.data),
    retry: false,
  })
  const linksQuery = useQuery({
    queryKey: ['incident-links', incidentId],
    queryFn: () => api.get(`/incidents/${incidentId}/links`).then(r => r.data),
    retry: false,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['incident-duplicates', incidentId] })
    queryClient.invalidateQueries({ queryKey: ['incident-links', incidentId] })
    queryClient.invalidateQueries({ queryKey: ['incident', incidentId] })
  }

  const linkMutation = useMutation({
    mutationFn: (data: { linked_incident_id: string; link_type: string; reason?: string }) =>
      api.post(`/incidents/${incidentId}/links`, data),
    onSuccess: () => { invalidate(); setLinkTarget(null); setLinkForm({ link_type: 'duplicate', reason: '' }) },
  })
  const unlinkMutation = useMutation({
    mutationFn: (linkId: string) => api.delete(`/incidents/${incidentId}/links/${linkId}`),
    onSuccess: invalidate,
  })

  const duplicates: any[] = Array.isArray(duplicatesQuery.data) ? duplicatesQuery.data : []
  const links: any[] = Array.isArray(linksQuery.data) ? linksQuery.data : []
  const linkedIds = new Set(links.map(l => l.linked_incident_id))
  const openCandidates = duplicates.filter(d => !linkedIds.has(d.id))

  if (duplicatesQuery.isLoading || linksQuery.isLoading) {
    return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress size={24} sx={{ color: NAVY }} /></Box>
  }

  if (duplicatesQuery.isError || linksQuery.isError) {
    return <Alert severity="error">Could not load related reports — refresh and retry.</Alert>
  }

  return (
    <Stack spacing={3}>
      {/* Duplicate candidates */}
      <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0' }}>
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>Possible duplicates</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          Same category, filed within a week — candidates only. Linking is the decision.
        </Typography>
        {openCandidates.length === 0 ? (
          <EmptyRow message={duplicates.length ? 'Every candidate is already linked' : 'No similar reports this week'} />
        ) : (
          <Stack spacing={1.5}>
            {openCandidates.map((d: any) => (
              <Paper key={d.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      component={RouterLink}
                      to={`/incidents/${d.id}`}
                      variant="body2"
                      fontWeight={600}
                      sx={{ color: NAVY, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                    >
                      {d.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {[d.category_name, d.location, d.incident_date ? new Date(d.incident_date).toLocaleDateString('en-GB') : ''].filter(Boolean).join(' · ')}
                    </Typography>
                  </Box>
                  <StatusBadge label={String(d.status || '').replace(/_/g, ' ')} tone="neutral" />
                  {canTriage && (
                    <Button size="small" variant="outlined" disabled={linkMutation.isPending}
                      onClick={() => { setLinkForm({ link_type: 'duplicate', reason: '' }); setLinkTarget(d) }}
                      sx={{ textTransform: 'none' }}>
                      Link…
                    </Button>
                  )}
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
        {linkMutation.isError && <Alert severity="error" sx={{ mt: 2 }}>Link failed — it may already exist; refresh and retry.</Alert>}
      </Paper>

      {/* Recorded links */}
      <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0' }}>
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>Linked incidents ({links.length})</Typography>
        {links.length === 0 ? (
          <EmptyRow message="Nothing linked — duplicates, parents and related reports land here" />
        ) : (
          <Stack spacing={1.5}>
            {links.map((l: any) => (
              <Paper key={l.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      component={RouterLink}
                      to={`/incidents/${l.linked_incident_id}`}
                      variant="body2"
                      fontWeight={600}
                      sx={{ color: NAVY, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                    >
                      {l.linked_title || 'Linked incident'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {[l.linked_status ? String(l.linked_status).replace(/_/g, ' ') : '', l.linked_severity, l.reason].filter(Boolean).join(' · ')}
                    </Typography>
                  </Box>
                  <StatusBadge label={String(l.link_type || '').replace(/_/g, ' ')} tone={LINK_TONE[l.link_type] || 'neutral'} />
                  {canTriage && (
                    <Button size="small" variant="text" color="inherit" disabled={unlinkMutation.isPending}
                      onClick={() => unlinkMutation.mutate(l.id)} sx={{ textTransform: 'none' }}>
                      Unlink
                    </Button>
                  )}
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
        {unlinkMutation.isError && <Alert severity="error" sx={{ mt: 2 }}>Unlink failed — refresh and retry.</Alert>}
      </Paper>

      <Dialog open={!!linkTarget} onClose={() => setLinkTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Link incidents</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {linkTarget?.title} — recorded as a {linkForm.link_type} of this incident. Links are append-only history; unlinking removes the row.
            </Typography>
            <TextField select label="Link type" value={linkForm.link_type}
              onChange={e => setLinkForm(f => ({ ...f, link_type: e.target.value }))} fullWidth>
              <MenuItem value="duplicate">Duplicate — same event, reported twice</MenuItem>
              <MenuItem value="parent">Parent — this continues that incident</MenuItem>
              <MenuItem value="related">Related — worth reading together</MenuItem>
            </TextField>
            <TextField label="Reason (optional)" value={linkForm.reason}
              onChange={e => setLinkForm(f => ({ ...f, reason: e.target.value }))} fullWidth multiline minRows={2} />
            {linkMutation.isError && <Alert severity="error">Link failed — these incidents may already be linked this way.</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkTarget(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" disabled={linkMutation.isPending}
            onClick={() => linkTarget && linkMutation.mutate({
              linked_incident_id: linkTarget.id,
              link_type: linkForm.link_type,
              ...(linkForm.reason.trim() ? { reason: linkForm.reason.trim() } : {}),
            })}
            sx={{ bgcolor: NAVY, textTransform: 'none' }}>
            {linkMutation.isPending ? 'Linking…' : 'Record link'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
