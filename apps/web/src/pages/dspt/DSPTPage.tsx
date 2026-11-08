import { useState, useMemo } from 'react'
import { Box, Typography, Paper, Chip, Button, Stack, Alert, CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Link } from '@mui/material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Security as ShieldIcon, CheckCircle, OpenInNew as ExternalIcon, CalendarMonth as CalendarIcon, PlaylistAddCheck as AssessmentIcon } from '@mui/icons-material'
import api from '../../services/api'
import { P } from '../../styles/tokens'

const STD_STATUS = [
  { value: 'not_assessed', label: 'Not Assessed', color: 'text.secondary' },
  { value: 'partially', label: 'Partially Met', color: '#F59E0B' },
  { value: 'met', label: 'Met', color: '#10B981' },
  { value: 'exceeded', label: 'Exceeded', color: '#6B8AFD' },
]

export default function DSPTPage() {
  const qc = useQueryClient()
  const [assessOpen, setAssessOpen] = useState(false)
  const [editing, setEditing] = useState<{ key: string; label: string; status: string; evidence_notes: string } | null>(null)

  const { data: statusData, isLoading } = useQuery({
    queryKey: ['dspt-status'],
    queryFn: async () => {
      const r = await api.get('/dspt/status')
      return r.data
    },
    refetchInterval: 30_000,
  })

  const active = statusData?.activeAssessment
  const detailId = active?.id

  const { data: detail, isLoading: detailLoading, refetch: refetchDetail } = useQuery({
    queryKey: ['dspt-detail', detailId],
    queryFn: async () => {
      const r = await api.get(`/dspt/assessments/${detailId}`)
      return r.data
    },
    enabled: !!detailId,
  })

  const stdDefs = (statusData?.standards || []) as Array<{ key: string; theme: string; label: string; description: string }>

  const mergedStds = useMemo(() => {
    if (!detail?.standards) return []
    const defMap = new Map(stdDefs.map(d => [d.key, d]))
    return (detail.standards as Array<{ standard_key: string; status: string; evidence_notes: string }>).map(s => {
      const def = defMap.get(s.standard_key)
      return {
        ...s,
        theme: def?.theme || '',
        label: def?.label || s.standard_key,
        description: def?.description || '',
      }
    })
  }, [detail, stdDefs])

  const metCount = mergedStds.filter(s => s.status === 'met' || s.status === 'exceeded').length
  const totalCount = mergedStds.length || 11

  const createAssessment = useMutation({
    mutationFn: () => api.post('/dspt/assessments'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dspt-status'] }); setAssessOpen(false) },
  })

  const updateStd = useMutation({
    mutationFn: (args: { standard_key: string; status: string; evidence_notes: string }) =>
      api.patch(`/dspt/assessments/${detailId}/standards/${args.standard_key}`, {
        status: args.status,
        evidence_notes: args.evidence_notes,
      }),
    onSuccess: () => { refetchDetail(); setEditing(null) },
  })

  const submitAssessment = useMutation({
    mutationFn: () => api.post(`/dspt/assessments/${detailId}/submit`),
    onSuccess: () => {
      refetchDetail(); qc.invalidateQueries({ queryKey: ['dspt-status'] })
    },
  })

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}><CircularProgress /></Box>

  const deadline = statusData?.deadline || '2026-06-30'

  // Figma 5.11: the standards table carries three status pills. Live data has
  // a fourth state (exceeded), which keeps its existing purple rather than
  // being folded into Met — the frame's sample never shows it, but the API
  // can return it and the table must not mislabel it.
  // Pill colours are token references, never literals: the design lint
  // rejects any hex not declared in a token module. `P.*` values are the
  // declarations, and `notice.*` pairs stay readable in dark mode.
  const stdPill = (status: string) => {
    if (status === 'met') return { label: 'Met', color: P.action, bg: P.greenLight }
    if (status === 'exceeded') return { label: 'Exceeded', color: P.indigo, bg: P.indigoLight }
    if (status === 'partially') return { label: 'In progress', color: 'notice.info.fg', bg: 'notice.info.bg' }
    return { label: 'Not started', color: 'text.secondary', bg: 'notice.muted.bg' }
  }

  // Figma 5.11 header action: jump straight to the first standard still open.
  // With no assessment yet there is nothing to mark, so offer to start one.
  const openNextStandard = () => {
    if (!active) { setAssessOpen(true); return }
    const next = mergedStds.find(s => s.status !== 'met' && s.status !== 'exceeded') ?? mergedStds[0]
    if (!next) return
    setEditing({
      key: next.standard_key,
      label: `${next.standard_key}: ${next.label}`,
      status: next.status || 'not_assessed',
      evidence_notes: next.evidence_notes || '',
    })
  }

  return (
    <Box>
      {/* ── Breadcrumb + header (Figma 5.11) ── */}
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: '0.08em' }}>
        COMPLIANCE &amp; SAFETY / COMPLIANCE / NHS DSPT
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ mt: 0.5, mb: 3, gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>Data Security and Protection Toolkit</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            The yearly NHS self-assessment for keeping people&apos;s information safe.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" endIcon={<ExternalIcon />} href="https://www.dsptoolkit.nhs.uk/" target="_blank"
            sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>
            Open the DSPT website
          </Button>
          <Button variant="contained" onClick={openNextStandard}
            sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>
            Mark a standard as met
          </Button>
        </Stack>
      </Stack>

      {active && (
        <Paper sx={{ p: 2.5, mb: 3, bgcolor: 'notice.info.bg', border: '1px solid #EAF3FF', borderRadius: 2 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CalendarIcon sx={{ color: 'notice.info.fg' }} />
            <Box>
              <Typography variant="body2" fontWeight={700}>
                Submission due {new Date(deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                You&apos;ve met {metCount} of {totalCount} standards. Click a standard to review the evidence recorded for it.
              </Typography>
            </Box>
          </Stack>
        </Paper>
      )}

      {active && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Box>
              <Typography variant="h6" fontWeight={600}>Standards</Typography>
              <Typography variant="body2" color="text.secondary">{metCount} of {totalCount} met</Typography>
            </Box>
            <Button size="small" variant="contained"
              onClick={() => submitAssessment.mutate()}
              disabled={submitAssessment.isPending || active.status !== 'draft'}
              sx={{ bgcolor: '#0164C8', textTransform: 'none' }}>
              {submitAssessment.isPending ? <CircularProgress size={16} /> : 'Mark as Submitted to Portal'}
            </Button>
          </Stack>

          {detailLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Standard</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Evidence in MeticleCare</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mergedStds.map(std => {
                    const pill = stdPill(std.status || 'not_assessed')
                    // The evidence column is deliberately the manager's own
                    // recorded notes, not a generated summary: the frame's
                    // sample strings ("GDPR policy, staff training") name
                    // sources no endpoint verifies, so inventing them here
                    // would present guesses as held evidence.
                    const evidence = std.evidence_notes
                      ? (std.evidence_notes.length > 100 ? std.evidence_notes.slice(0, 100) + '…' : std.evidence_notes)
                      : '—'
                    return (
                      <TableRow key={std.standard_key} hover sx={{ cursor: 'pointer' }} onClick={() => setEditing({
                        key: std.standard_key,
                        label: `${std.standard_key}: ${std.label}`,
                        status: std.status || 'not_assessed',
                        evidence_notes: std.evidence_notes || '',
                      })}>
                        <TableCell><Typography variant="body2" fontWeight={600}>{std.standard_key}: {std.label}</Typography></TableCell>
                        <TableCell sx={{ maxWidth: 320 }}><Typography variant="body2" color={std.evidence_notes ? 'text.primary' : 'text.secondary'} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evidence}</Typography></TableCell>
                        <TableCell><Chip label={pill.label} size="small" sx={{ color: pill.color, bgcolor: pill.bg, fontWeight: 600, minWidth: 90 }} /></TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Click a standard to update its status and add evidence notes. Once submitted on the official DSPT portal, mark this assessment as &ldquo;Submitted&rdquo;.
            </Typography>
          </Box>
        </Paper>
      )}

      {!active && (
        <Paper sx={{ p: 6, textAlign: 'center', bgcolor: 'notice.subtle.bg', border: '2px dashed #D6E2EE' }}>
          <ShieldIcon sx={{ fontSize: 48, color: '#D6E2EE', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>No Active Assessment</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Start your organisation's 2025/26 NHS DSPT self-assessment to track progress against the 10 Data Security Standards.
          </Typography>
          <Button variant="contained" startIcon={<AssessmentIcon />} onClick={() => setAssessOpen(true)}
            sx={{ bgcolor: P.primary, '&:hover': { bgcolor: P.primaryHover } }}>
            Start Assessment
          </Button>
        </Paper>
      )}

      {active && active.status === 'submitted' && (
        <Paper sx={{ p: 3, mt: 3, bgcolor: 'notice.success.bg', border: '1px solid #86EFAC', borderRadius: 2 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CheckCircle sx={{ color: 'notice.success.fg' }} />
            <Box>
              <Typography variant="subtitle2" fontWeight={600}>Assessment Submitted</Typography>
              <Typography variant="body2" color="text.secondary">
                Your organisation's DSPT self-assessment has been submitted. The official NHS DSPT portal will process your submission.
              </Typography>
            </Box>
          </Stack>
        </Paper>
      )}

      <Dialog open={assessOpen} onClose={() => setAssessOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Start NHS DSPT Assessment</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            This creates a new 2025/26 DSPT self-assessment for your organisation with all 10 Data Security Standards ready for tracking.
          </Alert>
          <Typography variant="body2" color="text.secondary">
            After completing your assessment here, submit on the official{' '}
            <Link href="https://www.dsptoolkit.nhs.uk/" target="_blank">DSPT Portal</Link>.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssessOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => createAssessment.mutate()}
            disabled={createAssessment.isPending}
            sx={{ bgcolor: '#0164C8' }}>
            {createAssessment.isPending ? <CircularProgress size={20} /> : 'Create Assessment'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!editing} onClose={() => setEditing(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Update Standard</DialogTitle>
        <DialogContent>
          {editing && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">{editing.label}</Typography>
              <TextField select label="Status" value={editing.status}
                onChange={e => setEditing(p => p ? { ...p, status: e.target.value } : null)}>
                {STD_STATUS.map(s => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </TextField>
              <TextField label="Evidence Notes" multiline rows={4}
                placeholder="Describe what evidence supports this standard (policies, training records, audits, etc.)"
                value={editing.evidence_notes}
                onChange={e => setEditing(p => p ? { ...p, evidence_notes: e.target.value } : null)} />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => {
            if (!editing || !detailId) return
            updateStd.mutate({
              standard_key: editing.key,
              status: editing.status,
              evidence_notes: editing.evidence_notes,
            })
          }} disabled={updateStd.isPending}
            sx={{ bgcolor: '#0164C8' }}>
            {updateStd.isPending ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}