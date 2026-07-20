import { useState, useMemo } from 'react'
import { Box, Typography, Paper, Chip, Button, Stack, LinearProgress, Alert, CircularProgress, Card, CardContent, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Link } from '@mui/material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Security as ShieldIcon, CheckCircle, Refresh as RefreshIcon, ArrowBack as ArrowBackIcon, OpenInNew as ExternalIcon, Verified as VerifiedIcon, PlaylistAddCheck as AssessmentIcon } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

const STATUS_META: Record<string, { label: string; color: string }> = {
  not_started: { label: 'Not Started', color: '#9CA3AF' },
  in_progress: { label: 'In Progress', color: '#F59E0B' },
  submitted: { label: 'Submitted', color: '#6366F1' },
  standards_met: { label: 'Standards Met', color: '#16A34A' },
  standards_exceeded: { label: 'Standards Exceeded', color: '#7C3AED' },
}

const STD_STATUS = [
  { value: 'not_assessed', label: 'Not Assessed', color: '#9CA3AF' },
  { value: 'partially', label: 'Partially Met', color: '#F59E0B' },
  { value: 'met', label: 'Met', color: '#16A34A' },
  { value: 'exceeded', label: 'Exceeded', color: '#6366F1' },
]

const DSPT_THEMES = [
  { key: 'Managing Data Protection', color: '#0F4C81' },
  { key: 'Confidentiality & Data Security', color: '#16A34A' },
  { key: 'Protecting & Sharing Information', color: '#6366F1' },
  { key: 'Minimising Impact', color: '#D946EF' },
]

export default function DSPTPage() {
  const navigate = useNavigate()
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
  const pct = totalCount > 0 ? Math.round((metCount / totalCount) * 100) : 0

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

  const status = statusData?.status || 'not_started'
  const si = STATUS_META[status] || STATUS_META.not_started
  const deadline = statusData?.deadline || '2026-06-30'
  const daysLeft = Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000))

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/compliance')} sx={{ mb: 2, color: '#0F4C81', fontWeight: 600 }}>
        Back to Compliance Dashboard
      </Button>

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <ShieldIcon sx={{ fontSize: 32, color: '#005EB8' }} />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>NHS DSPT Certification</Typography>
            <Typography variant="body2" color="text.secondary">Your organisation's Data Security & Protection Toolkit self-assessment — 2025/26</Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" startIcon={<AssessmentIcon />} onClick={() => setAssessOpen(true)}
            disabled={!!active || createAssessment.isPending}
            sx={{ bgcolor: '#005EB8', '&:hover': { bgcolor: '#004B93' } }}>
            {createAssessment.isPending ? <CircularProgress size={18} /> : 'New Assessment'}
          </Button>
          <Button startIcon={<RefreshIcon />} onClick={() => qc.invalidateQueries({ queryKey: ['dspt-status'] })} />
        </Stack>
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 4 }}>
        <Card sx={{ flex: '1 1 200px', borderTop: `4px solid ${si.color}` }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Overall Status</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <VerifiedIcon sx={{ color: si.color, fontSize: 20 }} />
              <Typography variant="h6" fontWeight={700} sx={{ color: si.color }}>{si.label}</Typography>
            </Stack>
          </CardContent>
        </Card>
        <Card sx={{ flex: '1 1 200px', borderTop: `4px solid ${daysLeft < 60 ? '#DC2626' : '#005EB8'}` }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Submission Deadline</Typography>
            <Typography variant="h6" fontWeight={700}>{new Date(deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</Typography>
            <Typography variant="caption" color={daysLeft < 60 ? 'error' : 'text.secondary'}>{daysLeft} days remaining</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: '1 1 200px', borderTop: `4px solid ${pct >= 80 ? '#16A34A' : pct >= 40 ? '#F59E0B' : '#DC2626'}` }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Standards Met</Typography>
            <Typography variant="h6" fontWeight={700}>{metCount} / {totalCount}</Typography>
            {mergedStds.length > 0 && <LinearProgress variant="determinate" value={pct} sx={{ mt: 1, height: 6, borderRadius: 3 }} />}
          </CardContent>
        </Card>
      </Box>

      <Paper sx={{ p: 2.5, mb: 3, bgcolor: '#F0F7FF', border: '1px solid #B3D4FC', borderRadius: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <ExternalIcon sx={{ color: '#005EB8' }} />
          <Typography variant="body2" sx={{ flex: 1 }}>
            Track your organisation's progress against the 10 Data Security Standards here. When ready, complete your official submission on the NHS DSPT portal.
          </Typography>
          <Button variant="outlined" size="small" endIcon={<ExternalIcon />} href="https://www.dsptoolkit.nhs.uk/" target="_blank"
            sx={{ borderColor: '#005EB8', color: '#005EB8', whiteSpace: 'nowrap' }}>
            Open DSPT Portal
          </Button>
        </Stack>
      </Paper>

      {active && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6" fontWeight={700}>10 Data Security Standards</Typography>
            <Button size="small" variant="contained"
              onClick={() => submitAssessment.mutate()}
              disabled={submitAssessment.isPending || active.status !== 'draft'}
              sx={{ bgcolor: '#005EB8' }}>
              {submitAssessment.isPending ? <CircularProgress size={16} /> : 'Mark as Submitted to Portal'}
            </Button>
          </Stack>

          {detailLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
          ) : (
            <>
              {DSPT_THEMES.map(theme => {
                const themeStds = mergedStds.filter(s => s.theme === theme.key)
                if (themeStds.length === 0) return null
                return (
                  <Box key={theme.key} sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, color: theme.color, fontWeight: 700, fontSize: 13 }}>
                      {theme.key}
                    </Typography>
                    {themeStds.map(std => {
                      const ss = STD_STATUS.find(s => s.value === (std.status || 'not_assessed'))
                      return (
                        <Paper key={std.standard_key} variant="outlined" sx={{
                          p: 1.75, mb: 0.75, cursor: 'pointer', transition: 'all 0.1s',
                          borderLeft: `3px solid ${theme.color}`,
                          '&:hover': { bgcolor: '#F8FAFC', borderColor: '#B3D4FC' }
                        }} onClick={() => setEditing({
                          key: std.standard_key,
                          label: `${std.standard_key}: ${std.label}`,
                          status: std.status || 'not_assessed',
                          evidence_notes: std.evidence_notes || '',
                        })}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Box>
                              <Typography variant="body2" fontWeight={600}>{std.standard_key}: {std.label}</Typography>
                              {std.evidence_notes && <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: 'block' }}>
                                {std.evidence_notes.length > 100 ? std.evidence_notes.slice(0, 100) + '...' : std.evidence_notes}
                              </Typography>}
                            </Box>
                            <Chip label={ss?.label || 'Not Assessed'} size="small" sx={{
                              color: ss?.color || '#9CA3AF',
                              bgcolor: `${ss?.color || '#9CA3AF'}15`,
                              fontWeight: 600,
                              minWidth: 90,
                            }} />
                          </Stack>
                        </Paper>
                      )
                    })}
                  </Box>
                )
              })}
              <Box sx={{ mt: 2, p: 1.5, bgcolor: '#FAFAFA', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Click any standard to update its status and add evidence notes. Once submitted on the official DSPT portal, mark this assessment as "Submitted".
                </Typography>
              </Box>
            </>
          )}
        </Paper>
      )}

      {!active && (
        <Paper sx={{ p: 6, textAlign: 'center', bgcolor: '#FAFAFA', border: '2px dashed #D1D5DB' }}>
          <ShieldIcon sx={{ fontSize: 48, color: '#D1D5DB', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>No Active Assessment</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Start your organisation's 2025/26 NHS DSPT self-assessment to track progress against the 10 Data Security Standards.
          </Typography>
          <Button variant="contained" startIcon={<AssessmentIcon />} onClick={() => setAssessOpen(true)}
            sx={{ bgcolor: '#005EB8', '&:hover': { bgcolor: '#004B93' } }}>
            Start Assessment
          </Button>
        </Paper>
      )}

      {active && active.status === 'submitted' && (
        <Paper sx={{ p: 3, mt: 3, bgcolor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 2 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CheckCircle sx={{ color: '#16A34A' }} />
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>Assessment Submitted</Typography>
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
            sx={{ bgcolor: '#005EB8' }}>
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
            sx={{ bgcolor: '#005EB8' }}>
            {updateStd.isPending ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}