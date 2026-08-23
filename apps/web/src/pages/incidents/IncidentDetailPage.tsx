import { useState } from 'react'
import {
  Box, Typography, Paper, Stack, Chip, Button, Tabs, Tab, Grid,
  TextField, CircularProgress, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions, MenuItem, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton,
  Divider, Autocomplete, LinearProgress,
} from '@mui/material'
import {
  ArrowBack, Add as AddIcon, CheckCircle as CheckIcon,
  Delete as DeleteIcon, Edit as EditIcon,
  OpenInNew as OpenInNewIcon, UploadFile as UploadFileIcon,
  SmartToy as AIIcon, Schedule as OverdueIcon, Event as TimelineIcon,
  Person as PersonIcon, Assignment as ActionIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { PageHeader, StatusBadge, ConfirmDialog, EmptyRow, NAVY } from '../../components/ui'

const SEVERITY_TONE: Record<string, 'success' | 'warning' | 'error' | 'purple'> = {
  low: 'success', medium: 'warning', high: 'error', critical: 'purple',
}
const STATUS_TONE: Record<string, 'warning' | 'info' | 'success' | 'neutral'> = {
  reported: 'warning', investigating: 'info', resolved: 'success', closed: 'neutral',
}
const ACTION_STATUS_TONE: Record<string, 'warning' | 'info' | 'success' | 'neutral'> = {
  pending: 'warning', in_progress: 'info', completed: 'success', cancelled: 'neutral',
}
const ACTION_ACCENT: Record<string, string> = {
  pending: '#D97706', in_progress: NAVY, completed: '#16A34A', cancelled: '#6B7280',
}

function openFileInNewTab(url: string) {
  const token = localStorage.getItem('accessToken')
  fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.blob()).then(b => {
    window.open(URL.createObjectURL(b), '_blank', 'noopener')
  }).catch(() => {})
}

export default function IncidentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentUser = (() => { const s = localStorage.getItem('user'); try { const p = s ? JSON.parse(s) : {}; return p && typeof p === 'object' ? p : {} } catch { return {} } })()
  const isOrgAdmin = currentUser.role === 'ORG_ADMIN'
  const [tab, setTab] = useState(0)
  const [addResidentOpen, setAddResidentOpen] = useState(false)
  const [addActionOpen, setAddActionOpen] = useState(false)
  const [editActionOpen, setEditActionOpen] = useState(false)
  const [updateOpen, setUpdateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [residentForm, setResidentForm] = useState({ person_id: '', involvement_type: 'affected', notes: '' })
  const [actionForm, setActionForm] = useState({ action: '', assigned_to: '', due_date: '' })
  const [editActionForm, setEditActionForm] = useState<any>({})
  const [updateForm, setUpdateForm] = useState<any>({})
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const { data: incident, isLoading } = useQuery({
    queryKey: ['incident', id],
    queryFn: () => api.get(`/incidents/${id}`).then(r => r.data),
    enabled: !!id,
  })

  const { data: timeline } = useQuery({
    queryKey: ['incident-timeline', id],
    queryFn: () => api.get(`/incidents/${id}/timeline`).then(r => r.data),
    enabled: !!id,
  })

  const { data: residents } = useQuery({
    queryKey: ['people-mini'],
    queryFn: () => api.get('/people').then(r => r.data),
  })

  const { data: orgMembers } = useQuery({
    queryKey: ['org-members'],
    queryFn: () => api.get('/staff/org-members').then(r => r.data),
  })

  const residentOptions = Array.isArray(residents) ? residents : residents?.people || residents?.data || []
  const memberOptions = Array.isArray(orgMembers)
    ? orgMembers
    : [...(orgMembers?.admins || []), ...(orgMembers?.staff || [])]

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.patch(`/incidents/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['incident', id] }); queryClient.invalidateQueries({ queryKey: ['incident-stats'] }); setUpdateOpen(false) },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/incidents/${id}`),
    onSuccess: () => navigate('/incidents'),
  })

  const addResidentMutation = useMutation({
    mutationFn: (data: any) => api.post(`/incidents/${id}/involved`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['incident', id] }); setAddResidentOpen(false); setResidentForm({ person_id: '', involvement_type: 'affected', notes: '' }) },
  })

  const removeResidentMutation = useMutation({
    mutationFn: (rId: string) => api.delete(`/incidents/${id}/involved/${rId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['incident', id] }),
  })

  const addActionMutation = useMutation({
    mutationFn: (data: any) => api.post(`/incidents/${id}/actions`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['incident', id] }); setAddActionOpen(false); setActionForm({ action: '', assigned_to: '', due_date: '' }) },
  })

  const completeActionMutation = useMutation({
    mutationFn: (aId: string) => api.patch(`/incidents/${id}/actions/${aId}/complete`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['incident', id] }),
  })

  const deleteActionMutation = useMutation({
    mutationFn: (aId: string) => api.delete(`/incidents/${id}/actions/${aId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['incident', id] }),
  })

  const updateActionMutation = useMutation({
    mutationFn: ({ actionId, data }: { actionId: string; data: any }) => api.patch(`/incidents/${id}/actions/${actionId}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['incident', id] }); setEditActionOpen(false) },
  })

  const deleteAttachmentMutation = useMutation({
    mutationFn: (attId: string) => api.delete(`/incidents/${id}/attachments/${attId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['incident', id] }),
  })

  const handleUpload = async (file: File | null) => {
    if (!file) return
    setUploading(true); setUploadError('')
    const fd = new FormData(); fd.append('file', file)
    try {
      await api.post(`/incidents/${id}/attachments`, fd)
      queryClient.invalidateQueries({ queryKey: ['incident', id] })
    } catch (err: any) {
      setUploadError(err.response?.data?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  if (isLoading) return <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB' }}><CircularProgress size={28} sx={{ color: NAVY }} /><Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Loading incident...</Typography></Paper>
  if (!incident) return <Alert severity="error">Incident not found</Alert>

  const involvedPeople = Array.isArray(incident.involved) ? incident.involved : []
  const incidentActions = Array.isArray(incident.actions) ? incident.actions : []
  const incidentAttachments = Array.isArray(incident.attachments) ? incident.attachments : []
  const completedActions = incidentActions.filter((a: any) => a.completed_at).length || 0
  const totalActions = incidentActions.length || 0
  const actionProgress = totalActions > 0 ? (completedActions / totalActions) * 100 : 0
  const overdueActions = incidentActions.filter((a: any) => !a.completed_at && a.status !== 'cancelled' && a.due_date && new Date(a.due_date) < new Date())

  return (
    <Box>
      {/* Header */}
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/incidents')}
        sx={{ mb: 1, color: 'text.secondary', textTransform: 'none', fontWeight: 600 }}>
        Back to Incidents
      </Button>

      <PageHeader
        title={incident.title}
        actions={
          <Stack direction="row" spacing={1}>
            {isOrgAdmin && (
              <Button variant="outlined" color="error" size="small" startIcon={<DeleteIcon />}
                onClick={() => setDeleteOpen(true)} sx={{ textTransform: 'none' }}>Delete</Button>
            )}
            <Button variant="outlined" size="small" startIcon={<EditIcon />}
              onClick={() => { setUpdateForm({ ...incident }); setUpdateOpen(true) }}
              sx={{ textTransform: 'none' }}>Edit</Button>
          </Stack>
        }
      />

      {/* Status chips */}
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 0.5 }}>
        <StatusBadge label={incident.severity} tone={SEVERITY_TONE[incident.severity] || 'neutral'} />
        <StatusBadge label={incident.status} tone={STATUS_TONE[incident.status] || 'neutral'} />
        {incident.is_cqc_reportable && <StatusBadge label="CQC Reportable" tone="error" />}
        {incident.is_near_miss && <StatusBadge label="Near Miss" tone="purple" />}
        {incident.is_confidential && <StatusBadge label="Confidential" tone="neutral" />}
      </Stack>

      {/* Metadata strip */}
      <Paper sx={{ p: 2.5, mb: 3, borderRadius: 2, border: '1px solid #E5E7EB' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} divider={<Divider orientation="vertical" flexItem />}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" color="text.secondary" fontWeight={600}>Date</Typography>
            <Typography variant="body2" fontWeight={600}>{new Date(incident.incident_date).toLocaleDateString('en-GB')}</Typography>
          </Stack>
          {incident.incident_time && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" color="text.secondary" fontWeight={600}>Time</Typography>
              <Typography variant="body2" fontWeight={600}>{incident.incident_time}</Typography>
            </Stack>
          )}
          {incident.category_name && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" color="text.secondary" fontWeight={600}>Category</Typography>
              <Typography variant="body2" fontWeight={600}>{incident.category_name}</Typography>
            </Stack>
          )}
          {incident.location && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" color="text.secondary" fontWeight={600}>Location</Typography>
              <Typography variant="body2" fontWeight={600}>{incident.location}</Typography>
            </Stack>
          )}
          {incident.reported_by_first && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" color="text.secondary" fontWeight={600}>Reported by</Typography>
              <Typography variant="body2" fontWeight={600}>{incident.reported_by_first} {incident.reported_by_last}</Typography>
            </Stack>
          )}
        </Stack>
        {incident.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{incident.description}</Typography>
        )}
      </Paper>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: '#E5E7EB', mb: 3 }}>
        <Tab label="Overview" sx={{ textTransform: 'none', fontWeight: 700 }} />
        <Tab label={`People${involvedPeople.length ? ` (${incident.involved.length})` : ''}`} sx={{ textTransform: 'none', fontWeight: 700 }} />
        <Tab label={`Actions${totalActions ? ` (${totalActions})` : ''}`} sx={{ textTransform: 'none', fontWeight: 700 }} />
        <Tab label={`Evidence${incidentAttachments.length ? ` (${incident.attachments.length})` : ''}`} sx={{ textTransform: 'none', fontWeight: 700 }} />
        <Tab label="Timeline" sx={{ textTransform: 'none', fontWeight: 700 }} />
      </Tabs>

      {/* Tab: Overview */}
      {tab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid #E5E7EB' }}>
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 2 }}>Investigation Details</Typography>
              <Stack spacing={2}>
                {[
                  { label: 'Root Cause', value: incident.root_cause },
                  { label: 'Investigation Notes', value: incident.investigation_notes },
                  { label: 'Lessons Learned', value: incident.lessons_learned },
                  { label: 'Outcomes', value: incident.outcomes },
                ].map((r, i) => (
                  <Box key={i}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>{r.label}</Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap', color: r.value ? 'text.primary' : 'text.secondary' }}>
                      {r.value || 'Not recorded'}
                    </Typography>
                  </Box>
                ))}
              </Stack>
              {incident.is_cqc_reportable && (
                <Divider sx={{ my: 2 }} />
              )}
              {incident.is_cqc_reportable && (
                <Stack spacing={1.5}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">CQC Reference</Typography>
                    <Typography variant="body2" fontWeight={600}>{incident.cqc_reference || '—'}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Reported to CQC</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {incident.reported_to_cqc_at ? new Date(incident.reported_to_cqc_at).toLocaleDateString('en-GB') : '—'}
                    </Typography>
                  </Stack>
                </Stack>
              )}
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Stack spacing={3}>
              {/* Summary card */}
              <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid #E5E7EB' }}>
                <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 2 }}>Summary</Typography>
                <Stack spacing={2}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <PersonIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      <Typography variant="body2">People Involved</Typography>
                    </Stack>
                    <Typography variant="body2" fontWeight={700}>{involvedPeople.length || 0}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <ActionIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      <Typography variant="body2">Actions</Typography>
                    </Stack>
                    <Typography variant="body2" fontWeight={700}>{completedActions} / {totalActions}</Typography>
                  </Stack>
                  {totalActions > 0 && (
                    <Box>
                      <LinearProgress variant="determinate" value={actionProgress}
                        sx={{ height: 6, borderRadius: 3, bgcolor: '#F3F4F6', '& .MuiLinearProgress-bar': { bgcolor: actionProgress === 100 ? '#16A34A' : NAVY } }} />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        {actionProgress === 100 ? 'All actions completed' : `${Math.round(actionProgress)}% complete`}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Paper>

              {/* Overdue actions alert */}
              {overdueActions.length > 0 && (
                <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid #FEE2E2', borderLeft: 4, borderLeftColor: '#DC2626', bgcolor: '#FFFBFB' }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <OverdueIcon sx={{ fontSize: 18, color: '#DC2626' }} />
                    <Typography variant="subtitle2" fontWeight={800} color="#B91C1C">Overdue Actions</Typography>
                  </Stack>
                  <Typography variant="body2" color="#991B1B">{overdueActions.length} action{overdueActions.length > 1 ? 's' : ''} past due date</Typography>
                </Paper>
              )}

              {/* AI Triage */}
              {incident.ai_triage && (
                <Paper sx={{ p: 3, borderRadius: 2, border: `1px solid ${NAVY}20`, bgcolor: `${NAVY}04` }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                    <AIIcon sx={{ color: NAVY, fontSize: 20 }} />
                    <Typography variant="subtitle2" fontWeight={800}>AI Triage</Typography>
                  </Stack>
                  {incident.ai_triage.summary && (
                    <Typography variant="body2" sx={{ mb: 1.5, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{incident.ai_triage.summary}</Typography>
                  )}
                  {incident.ai_triage.severity_suggestion && (
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <Typography variant="caption" color="text.secondary">Suggested severity:</Typography>
                      <StatusBadge label={incident.ai_triage.severity_suggestion} tone={SEVERITY_TONE[incident.ai_triage.severity_suggestion] || 'neutral'} />
                    </Stack>
                  )}
                  {incident.ai_triage.actions_recommended?.length > 0 && (
                    <Stack spacing={0.5} sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>Recommended actions</Typography>
                      {incident.ai_triage.actions_recommended.map((a: string, i: number) => (
                        <Typography key={i} variant="body2" sx={{ pl: 1.5, color: 'text.secondary' }}>• {a}</Typography>
                      ))}
                    </Stack>
                  )}
                </Paper>
              )}
            </Stack>
          </Grid>
        </Grid>
      )}

      {/* Tab: Involved People */}
      {tab === 1 && (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={800}>Involved People</Typography>
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setAddResidentOpen(true)}
              sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 700 }}>Add Person</Button>
          </Stack>
          {(!incident.involved || incident.involved.length === 0) ? (
            <EmptyRow message="No people linked to this incident" action={
              <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setAddResidentOpen(true)} sx={{ textTransform: 'none' }}>Add Person</Button>
            } />
          ) : (
            <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #E5E7EB' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Room</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Involvement</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {involvedPeople.map((ir: any) => (
                    <TableRow key={ir.id}>
                      <TableCell><Typography fontWeight={600}>{ir.first_name} {ir.last_name}</Typography></TableCell>
                      <TableCell>{ir.room_number || '—'}</TableCell>
                      <TableCell>
                        <StatusBadge
                          label={ir.involvement_type?.replace(/_/g, ' ') || 'affected'}
                          tone={ir.involvement_type === 'affected' ? 'error' : ir.involvement_type === 'witness' ? 'info' : 'warning'}
                        />
                      </TableCell>
                      <TableCell><Typography variant="body2" color="text.secondary">{ir.notes || '—'}</Typography></TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => removeResidentMutation.mutate(ir.id)} title="Remove"><DeleteIcon fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* Tab: Actions */}
      {tab === 2 && (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={800}>Action Items</Typography>
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setAddActionOpen(true)}
              sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 700 }}>Add Action</Button>
          </Stack>
          {(!incident.actions || incident.actions.length === 0) ? (
            <EmptyRow message="No actions recorded" action={
              <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setAddActionOpen(true)} sx={{ textTransform: 'none' }}>Add Action</Button>
            } />
          ) : (
            <Stack spacing={1.5}>
              {incidentActions.map((a: any) => {
                const overdue = !a.completed_at && a.status !== 'cancelled' && a.due_date && new Date(a.due_date) < new Date()
                return (
                  <Paper key={a.id} sx={{ p: 2.5, borderRadius: 2, border: '1px solid #E5E7EB', borderLeft: 4, borderLeftColor: ACTION_ACCENT[a.status] || '#6B7280' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600}>{a.action}</Typography>
                        <Stack direction="row" spacing={2} sx={{ mt: 1 }} alignItems="center" flexWrap="wrap">
                          {a.assigned_first && (
                            <Typography variant="caption" color="text.secondary">
                              Assigned: {a.assigned_first} {a.assigned_last}
                            </Typography>
                          )}
                          {a.due_date && (
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <Typography variant="caption" color={overdue ? '#DC2626' : 'text.secondary'}>
                                Due: {new Date(a.due_date).toLocaleDateString('en-GB')}
                              </Typography>
                              {overdue && <Chip icon={<OverdueIcon sx={{ fontSize: 12 }} />} label="Overdue" size="small"
                                sx={{ bgcolor: '#FEE2E2', color: '#B91C1C', fontWeight: 700, fontSize: 10, height: 20 }} />}
                            </Stack>
                          )}
                          <StatusBadge label={a.status?.replace(/_/g, ' ') || 'pending'} tone={ACTION_STATUS_TONE[a.status] || 'neutral'} />
                          {a.completed_at && (
                            <Typography variant="caption" color="#16A34A">
                              Completed {new Date(a.completed_at).toLocaleDateString('en-GB')}
                            </Typography>
                          )}
                        </Stack>
                      </Box>
                      <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0, ml: 1 }}>
                        <IconButton size="small" title="Edit" onClick={() => { setEditActionForm({ ...a, assigned_to: a.assigned_to || '' }); setEditActionOpen(true) }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        {!a.completed_at && a.status !== 'cancelled' && (
                          <IconButton size="small" title="Complete" color="success" onClick={() => completeActionMutation.mutate(a.id)}>
                            <CheckIcon fontSize="small" />
                          </IconButton>
                        )}
                        <IconButton size="small" title="Delete" onClick={() => deleteActionMutation.mutate(a.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Stack>
                  </Paper>
                )
              })}
            </Stack>
          )}
        </Box>
      )}

      {/* Tab: Evidence */}
      {tab === 3 && (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={800}>Evidence Attachments</Typography>
            <Button size="small" variant="contained" component="label" startIcon={<UploadFileIcon />}
              sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 700 }}>
              {uploading ? <CircularProgress size={18} color="inherit" /> : 'Upload Evidence'}
              <input type="file" hidden onChange={e => handleUpload(e.target.files?.[0] || null)} />
            </Button>
          </Stack>
          {uploadError && <Alert severity="error" sx={{ mb: 2 }}>{uploadError}</Alert>}
          {(!incident.attachments || incident.attachments.length === 0) ? (
            <EmptyRow message="No evidence attached" action={
              <Button size="small" variant="outlined" component="label" startIcon={<UploadFileIcon />} sx={{ textTransform: 'none' }}>
                Upload Evidence
                <input type="file" hidden onChange={e => handleUpload(e.target.files?.[0] || null)} />
              </Button>
            } />
          ) : (
            <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #E5E7EB' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>File</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Size</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Uploaded By</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {incidentAttachments.map((att: any) => (
                    <TableRow key={att.id}>
                      <TableCell><Typography fontWeight={600}>{att.file_name}</Typography></TableCell>
                      <TableCell><Typography variant="caption" color="text.secondary">{att.file_type || '—'}</Typography></TableCell>
                      <TableCell><Typography variant="body2" color="text.secondary">{att.file_size ? `${(att.file_size / 1024).toFixed(1)} KB` : '—'}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{att.uploaded_first ? `${att.uploaded_first} ${att.uploaded_last}` : '—'}</Typography></TableCell>
                      <TableCell><Typography variant="body2" color="text.secondary">{new Date(att.created_at).toLocaleDateString('en-GB')}</Typography></TableCell>
                      <TableCell align="right">
                        <IconButton size="small" title="Open file" onClick={() => openFileInNewTab(att.file_url)}><OpenInNewIcon fontSize="small" /></IconButton>
                        <IconButton size="small" title="Delete" onClick={() => deleteAttachmentMutation.mutate(att.id)}><DeleteIcon fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* Tab: Timeline */}
      {tab === 4 && (
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 3 }}>
            <TimelineIcon sx={{ color: NAVY, fontSize: 20 }} />
            <Typography variant="subtitle1" fontWeight={800}>Audit Timeline</Typography>
          </Stack>
          {(!timeline || timeline.length === 0) ? (
            <EmptyRow message="No timeline events" />
          ) : (
            <Box sx={{ position: 'relative', pl: 3 }}>
              {/* Vertical line */}
              <Box sx={{ position: 'absolute', left: 7, top: 0, bottom: 0, width: 2, bgcolor: '#E5E7EB' }} />
              <Stack spacing={0}>
                {timeline.map((t: any, i: number) => (
                  <Box key={i} sx={{ position: 'relative', pb: 2.5 }}>
                    {/* Dot */}
                    <Box sx={{ position: 'absolute', left: -25, top: 4, width: 12, height: 12, borderRadius: '50%', bgcolor: i === 0 ? NAVY : '#D1D5DB', border: `2px solid ${i === 0 ? NAVY : '#E5E7EB'}` }} />
                    <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid #E5E7EB' }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Typography variant="body2" fontWeight={600}>{t.title}</Typography>
                          <Typography variant="caption" color="text.secondary">{t.detail}</Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, ml: 2 }}>
                          {new Date(t.created_at).toLocaleString('en-GB')}
                        </Typography>
                      </Stack>
                    </Paper>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}
        </Box>
      )}

      {/* Update Dialog */}
      <Dialog open={updateOpen} onClose={() => setUpdateOpen(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => {
          e.preventDefault()
          const payload: any = {
            status: updateForm.status, title: updateForm.title, category_id: updateForm.category_id,
            location: updateForm.location, incident_date: updateForm.incident_date, incident_time: updateForm.incident_time,
            severity: updateForm.severity, is_cqc_reportable: updateForm.is_cqc_reportable, is_near_miss: updateForm.is_near_miss,
            root_cause: updateForm.root_cause, investigation_notes: updateForm.investigation_notes,
            outcomes: updateForm.outcomes, lessons_learned: updateForm.lessons_learned,
            cqc_reference: updateForm.cqc_reference, reported_to_cqc_at: updateForm.reported_to_cqc_at,
          }
          if (isOrgAdmin) payload.is_confidential = updateForm.is_confidential
          updateMutation.mutate(payload)
        }}>
          <DialogTitle sx={{ fontWeight: 800 }}>Edit Incident</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Title" fullWidth required value={updateForm.title || ''} onChange={e => setUpdateForm({ ...updateForm, title: e.target.value })} />
              <Stack direction="row" spacing={1}>
                <TextField select label="Status" fullWidth value={updateForm.status || 'reported'} onChange={e => setUpdateForm({ ...updateForm, status: e.target.value })}>
                  <MenuItem value="reported">Reported</MenuItem>
                  <MenuItem value="investigating">Investigating</MenuItem>
                  <MenuItem value="resolved">Resolved</MenuItem>
                  <MenuItem value="closed">Closed</MenuItem>
                </TextField>
                <TextField select label="Severity" fullWidth value={updateForm.severity || 'medium'} onChange={e => setUpdateForm({ ...updateForm, severity: e.target.value })}>
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                </TextField>
              </Stack>
              <Stack direction="row" spacing={1}>
                <TextField label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={updateForm.incident_date || ''} onChange={e => setUpdateForm({ ...updateForm, incident_date: e.target.value })} />
                <TextField label="Time" type="time" fullWidth InputLabelProps={{ shrink: true }} value={updateForm.incident_time || ''} onChange={e => setUpdateForm({ ...updateForm, incident_time: e.target.value })} />
              </Stack>
              <TextField label="Location" fullWidth value={updateForm.location || ''} onChange={e => setUpdateForm({ ...updateForm, location: e.target.value })} />
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Button variant={updateForm.is_cqc_reportable ? 'contained' : 'outlined'} color="error" size="small"
                  onClick={() => setUpdateForm({ ...updateForm, is_cqc_reportable: !updateForm.is_cqc_reportable })} sx={{ textTransform: 'none' }}>
                  {updateForm.is_cqc_reportable ? '✓ CQC Reportable' : 'CQC Reportable'}
                </Button>
                <Button variant={updateForm.is_near_miss ? 'contained' : 'outlined'} color="secondary" size="small"
                  onClick={() => setUpdateForm({ ...updateForm, is_near_miss: !updateForm.is_near_miss })} sx={{ textTransform: 'none' }}>
                  {updateForm.is_near_miss ? '✓ Near Miss' : 'Near Miss'}
                </Button>
                {isOrgAdmin && (
                  <Button variant={updateForm.is_confidential ? 'contained' : 'outlined'} color="inherit" size="small"
                    onClick={() => setUpdateForm({ ...updateForm, is_confidential: !updateForm.is_confidential })} sx={{ textTransform: 'none' }}>
                    {updateForm.is_confidential ? '✓ Confidential' : 'Confidential'}
                  </Button>
                )}
              </Stack>
              <TextField label="Root Cause" fullWidth multiline rows={2} value={updateForm.root_cause || ''} onChange={e => setUpdateForm({ ...updateForm, root_cause: e.target.value })} />
              <TextField label="Investigation Notes" fullWidth multiline rows={3} value={updateForm.investigation_notes || ''} onChange={e => setUpdateForm({ ...updateForm, investigation_notes: e.target.value })} />
              <TextField label="Lessons Learned" fullWidth multiline rows={2} value={updateForm.lessons_learned || ''} onChange={e => setUpdateForm({ ...updateForm, lessons_learned: e.target.value })} />
              <TextField label="Outcomes" fullWidth multiline rows={2} value={updateForm.outcomes || ''} onChange={e => setUpdateForm({ ...updateForm, outcomes: e.target.value })} />
              {updateForm.is_cqc_reportable && (
                <>
                  <TextField label="CQC Reference" fullWidth value={updateForm.cqc_reference || ''} onChange={e => setUpdateForm({ ...updateForm, cqc_reference: e.target.value })} />
                  <TextField label="Reported to CQC at" type="date" fullWidth InputLabelProps={{ shrink: true }} value={updateForm.reported_to_cqc_at ? updateForm.reported_to_cqc_at.split('T')[0] : ''} onChange={e => setUpdateForm({ ...updateForm, reported_to_cqc_at: e.target.value })} />
                </>
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setUpdateOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={updateMutation.isPending}
              sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 700 }}>
              {updateMutation.isPending ? <CircularProgress size={20} color="inherit" /> : 'Save Changes'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Add Resident Dialog */}
      <Dialog open={addResidentOpen} onClose={() => setAddResidentOpen(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); addResidentMutation.mutate(residentForm) }}>
          <DialogTitle sx={{ fontWeight: 800 }}>Add Involved Person</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField select label="Person" fullWidth required value={residentForm.person_id} onChange={e => setResidentForm({ ...residentForm, person_id: e.target.value })}>
                {residentOptions.map((r: any) => (
                  <MenuItem key={r.id} value={r.id}>{r.first_name} {r.last_name}{r.room_number ? ` (Room ${r.room_number})` : ''}</MenuItem>
                ))}
              </TextField>
              <TextField select label="Involvement Type" fullWidth value={residentForm.involvement_type} onChange={e => setResidentForm({ ...residentForm, involvement_type: e.target.value })}>
                <MenuItem value="affected">Affected</MenuItem>
                <MenuItem value="witness">Witness</MenuItem>
                <MenuItem value="involved">Involved</MenuItem>
              </TextField>
              <TextField label="Notes" fullWidth multiline rows={2} value={residentForm.notes} onChange={e => setResidentForm({ ...residentForm, notes: e.target.value })} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setAddResidentOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Button type="submit" variant="contained" sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 700 }}>Add Person</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Add Action Dialog */}
      <Dialog open={addActionOpen} onClose={() => setAddActionOpen(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); addActionMutation.mutate(actionForm) }}>
          <DialogTitle sx={{ fontWeight: 800 }}>Add Action</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Action" fullWidth required multiline rows={2} value={actionForm.action}
                onChange={e => setActionForm({ ...actionForm, action: e.target.value })}
                placeholder="What needs to be done?" />
              <Autocomplete
                options={memberOptions}
                getOptionLabel={(m: any) => m.first_name ? `${m.first_name} ${m.last_name}` : m.email}
                value={memberOptions.find((m: any) => m.id === actionForm.assigned_to) || null}
                onChange={(_, v: any) => setActionForm({ ...actionForm, assigned_to: v?.id || '' })}
                renderInput={(params) => <TextField {...params} label="Assigned To" fullWidth />}
              />
              <TextField label="Due Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={actionForm.due_date}
                onChange={e => setActionForm({ ...actionForm, due_date: e.target.value })} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setAddActionOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Button type="submit" variant="contained" sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 700 }}>Add Action</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Edit Action Dialog */}
      <Dialog open={editActionOpen} onClose={() => setEditActionOpen(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); updateActionMutation.mutate({ actionId: editActionForm.id, data: editActionForm }) }}>
          <DialogTitle sx={{ fontWeight: 800 }}>Edit Action</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Action" fullWidth required multiline rows={2} value={editActionForm.action || ''}
                onChange={e => setEditActionForm({ ...editActionForm, action: e.target.value })} />
              <Autocomplete
                options={memberOptions}
                getOptionLabel={(m: any) => m.first_name ? `${m.first_name} ${m.last_name}` : m.email}
                value={memberOptions.find((m: any) => m.id === editActionForm.assigned_to) || null}
                onChange={(_, v: any) => setEditActionForm({ ...editActionForm, assigned_to: v?.id || '' })}
                renderInput={(params) => <TextField {...params} label="Assigned To" fullWidth />}
              />
              <TextField label="Due Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={editActionForm.due_date || ''}
                onChange={e => setEditActionForm({ ...editActionForm, due_date: e.target.value })} />
              <TextField select label="Status" fullWidth value={editActionForm.status || 'pending'}
                onChange={e => setEditActionForm({ ...editActionForm, status: e.target.value })}>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setEditActionOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Button type="submit" variant="contained" sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 700 }}>Save Changes</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteOpen}
        title="Delete Incident"
        message={`This permanently deletes "${incident.title}" and all linked people, actions, and evidence. This action cannot be undone.`}
        confirmLabel="Delete Incident"
        loading={deleteMutation.isPending}
        danger
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setDeleteOpen(false)}
      />
    </Box>
  )
}
