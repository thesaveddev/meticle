import { useState } from 'react'
import {
  Box, Typography, Paper, Stack, Chip, Button, Tabs, Tab, Grid,
  TextField, CircularProgress, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions, MenuItem, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton,
  Divider, Autocomplete,
} from '@mui/material'
import {
  ArrowBack, Add as AddIcon, CheckCircle as CheckIcon,
  Delete as DeleteIcon, Edit as EditIcon, Warning as WarningIcon,
  OpenInNew as OpenInNewIcon, UploadFile as UploadFileIcon,
  SmartToy as AIIcon, Schedule as OverdueIcon, Event as TimelineIcon,
  Lock as LockIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../services/api'

const SEVERITY_COLORS: Record<string, string> = { low: '#16A34A', medium: '#D97706', high: '#DC2626', critical: '#7C3AED' }
const STATUS_COLORS: Record<string, string> = { reported: '#D97706', investigating: '#0F4C81', resolved: '#16A34A', closed: '#6B7280' }

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

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /></Box>
  if (!incident) return <Alert severity="error">Incident not found</Alert>

  const tabs = ['Overview', 'Involved People', 'Actions', 'Evidence', 'Timeline']

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/incidents')} sx={{ mb: 2, color: '#6B7280', textTransform: 'none' }}>
        Back to Incidents
      </Button>

      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 2, border: '1px solid #E5E7EB' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>{incident.title}</Typography>
              <Chip icon={<WarningIcon />} label={incident.severity} size="small"
                sx={{ bgcolor: `${SEVERITY_COLORS[incident.severity]}20`, color: SEVERITY_COLORS[incident.severity], fontWeight: 700, textTransform: 'capitalize' }} />
              <Chip label={incident.status} size="small"
                sx={{ bgcolor: `${STATUS_COLORS[incident.status]}20`, color: STATUS_COLORS[incident.status], fontWeight: 700, textTransform: 'capitalize' }} />
              {incident.is_cqc_reportable ? <Chip label="CQC Reportable" size="small" color="error" /> : <Chip label="Not CQC Reportable" size="small" sx={{ bgcolor: '#0F4C8120', color: '#0F4C81', fontWeight: 600 }} />}
              {incident.is_near_miss && <Chip label="Near Miss" size="small" sx={{ bgcolor: '#8B5CF620', color: '#8B5CF6', fontWeight: 700 }} />}
              {incident.is_confidential && <Chip icon={<LockIcon />} label="Confidential" size="small" sx={{ bgcolor: '#37415120', color: '#374151', fontWeight: 700 }} />}
            </Stack>
            <Stack direction="row" spacing={2} divider={<Divider orientation="vertical" flexItem />}>
              <Typography variant="body2" color="#6B7280">Date: {new Date(incident.incident_date).toLocaleDateString('en-GB')}</Typography>
              {incident.incident_time && <Typography variant="body2" color="#6B7280">Time: {incident.incident_time}</Typography>}
              {incident.category_name && <Typography variant="body2" color="#6B7280">Category: {incident.category_name}</Typography>}
              {incident.location && <Typography variant="body2" color="#6B7280">Location: {incident.location}</Typography>}
            </Stack>
          </Box>
          <Stack direction="row" spacing={1}>
            {isOrgAdmin && (
              <Button variant="outlined" color="error" size="small" startIcon={<DeleteIcon />} onClick={() => setDeleteOpen(true)}
                sx={{ textTransform: 'none' }}>Delete</Button>
            )}
            <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => { setUpdateForm({ ...incident }); setUpdateOpen(true) }}
              sx={{ textTransform: 'none' }}>Update</Button>
          </Stack>
        </Stack>
        {incident.description && (
          <Typography variant="body2" color="#374151" sx={{ mt: 2, whiteSpace: 'pre-wrap' }}>{incident.description}</Typography>
        )}
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          {incident.reported_by_first && (
            <Typography variant="caption" color="#9CA3AF">Reported by: {incident.reported_by_first} {incident.reported_by_last}</Typography>
          )}
        </Stack>
      </Paper>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: '#E5E7EB', mb: 3 }}>
        {tabs.map(t => <Tab key={t} label={t} sx={{ textTransform: 'none', fontWeight: 700 }} />)}
      </Tabs>

      {/* Tab: Overview */}
      {tab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid #E5E7EB' }}>
              <Typography variant="subtitle2" fontWeight={800} mb={2}>Incident Details</Typography>
              <Stack spacing={1.5}>
                {[
                  { label: 'Root Cause', value: incident.root_cause || 'Not specified' },
                  { label: 'Investigation Notes', value: incident.investigation_notes || 'Not recorded' },
                  { label: 'Lessons Learned', value: incident.lessons_learned || 'Not recorded' },
                  { label: 'Outcomes', value: incident.outcomes || 'Not recorded' },
                  { label: 'CQC Reference', value: incident.cqc_reference || '—' },
                  { label: 'Reported to CQC', value: incident.reported_to_cqc_at ? new Date(incident.reported_to_cqc_at).toLocaleDateString('en-GB') : '—' },
                ].map((r, i) => (
                  <Stack key={i} direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="#6B7280">{r.label}</Typography>
                    <Typography variant="body2" fontWeight={600}>{r.value}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid #E5E7EB' }}>
              <Typography variant="subtitle2" fontWeight={800} mb={2}>Summary</Typography>
              <Stack spacing={1.5}>
                {[
                  { label: 'Involved People', value: incident.involved?.length || 0 },
                  { label: 'Actions', value: incident.actions?.length || 0 },
                  { label: 'Completed Actions', value: incident.actions?.filter((a: any) => a.completed_at).length || 0 },
                ].map((s, i) => (
                  <Stack key={i} direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="#6B7280">{s.label}</Typography>
                    <Typography variant="body2" fontWeight={600}>{s.value}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          </Grid>
          {incident.ai_triage && (
            <Grid item xs={12}>
              <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid #E5E7EB', borderLeft: 4, borderLeftColor: '#0F4C81', bgcolor: '#0F4C8108' }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <AIIcon sx={{ color: '#0F4C81' }} />
                  <Typography variant="subtitle2" fontWeight={800}>AI Triage</Typography>
                </Stack>
                {incident.ai_triage.summary && <Typography variant="body2" sx={{ mb: 1, whiteSpace: 'pre-wrap' }}>{incident.ai_triage.summary}</Typography>}
                {incident.ai_triage.severity_suggestion && (
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="caption" color="#6B7280">Severity suggestion:</Typography>
                    <Chip label={incident.ai_triage.severity_suggestion} size="small"
                      sx={{ bgcolor: `${SEVERITY_COLORS[incident.ai_triage.severity_suggestion]}20`, color: SEVERITY_COLORS[incident.ai_triage.severity_suggestion], fontWeight: 700, textTransform: 'capitalize' }} />
                  </Stack>
                )}
                {incident.ai_triage.actions_recommended && incident.ai_triage.actions_recommended.length > 0 && (
                  <Stack spacing={0.5} sx={{ mt: 1 }}>
                    <Typography variant="caption" color="#6B7280" fontWeight={700}>Recommended actions:</Typography>
                    {incident.ai_triage.actions_recommended.map((a: string, i: number) => (
                      <Typography key={i} variant="body2" sx={{ pl: 1 }}>• {a}</Typography>
                    ))}
                  </Stack>
                )}
              </Paper>
            </Grid>
          )}
        </Grid>
      )}

      {/* Tab: Involved People */}
      {tab === 1 && (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={800}>Involved People</Typography>
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setAddResidentOpen(true)}
              sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>Add Person</Button>
          </Stack>
          <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #E5E7EB' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Room</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Involvement</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Notes</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(!incident.involved || incident.involved.length === 0) ? (
                  <TableRow><TableCell colSpan={5}><Typography textAlign="center" py={4} color="#9CA3AF">No people linked</Typography></TableCell></TableRow>
                ) : incident.involved.map((ir: any) => (
                  <TableRow key={ir.id}>
                    <TableCell><Typography fontWeight={600}>{ir.first_name} {ir.last_name}</Typography></TableCell>
                    <TableCell>{ir.room_number || '—'}</TableCell>
                    <TableCell><Chip label={ir.involvement_type?.replace(/_/g, ' ')} size="small" variant="outlined" sx={{ textTransform: 'capitalize' }} /></TableCell>
                    <TableCell><Typography variant="body2" color="#6B7280">{ir.notes || '—'}</Typography></TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => removeResidentMutation.mutate(ir.id)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Tab: Actions */}
      {tab === 2 && (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={800}>Actions</Typography>
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setAddActionOpen(true)}
              sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>Add Action</Button>
          </Stack>
          <Stack spacing={1.5}>
            {(!incident.actions || incident.actions.length === 0) ? (
              <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB' }}>
                <Typography color="#9CA3AF">No actions recorded</Typography>
              </Paper>
            ) : incident.actions.map((a: any) => {
              const statusColor: Record<string, string> = { pending: '#D97706', in_progress: '#0F4C81', completed: '#16A34A', cancelled: '#6B7280' };
              const overdue = !a.completed_at && a.status !== 'cancelled' && a.due_date && new Date(a.due_date) < new Date()
              return (
              <Paper key={a.id} sx={{ p: 2, borderRadius: 2, border: '1px solid #E5E7EB', borderLeft: 4, borderLeftColor: a.completed_at ? '#16A34A' : '#D97706' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={600}>{a.action}</Typography>
                    <Stack direction="row" spacing={2} sx={{ mt: 0.5 }} alignItems="center">
                      {a.assigned_first && <Typography variant="caption" color="#6B7280">Assigned: {a.assigned_first} {a.assigned_last}</Typography>}
                      {a.due_date && (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Typography variant="caption" color={overdue ? '#DC2626' : '#6B7280'}>Due: {new Date(a.due_date).toLocaleDateString('en-GB')}</Typography>
                          {overdue && <Chip icon={<OverdueIcon />} label="Overdue" size="small" sx={{ bgcolor: '#DC262620', color: '#DC2626', fontWeight: 700 }} />}
                        </Stack>
                      )}
                      {a.status && <Chip label={a.status.replace(/_/g, ' ')} size="small" sx={{ bgcolor: `${statusColor[a.status] || '#6B7280'}20`, color: statusColor[a.status] || '#6B7280', fontWeight: 600, textTransform: 'capitalize' }} />}
                      {a.completed_at && <Typography variant="caption" color="#16A34A">Completed: {new Date(a.completed_at).toLocaleDateString('en-GB')}</Typography>}
                    </Stack>
                  </Box>
                  <Stack direction="row" spacing={0.5}>
                    <IconButton size="small" onClick={() => { setEditActionForm({ ...a, assigned_to: a.assigned_to || '' }); setEditActionOpen(true) }}><EditIcon fontSize="small" /></IconButton>
                    {!a.completed_at && (
                      <IconButton size="small" color="success" onClick={() => completeActionMutation.mutate(a.id)}><CheckIcon fontSize="small" /></IconButton>
                    )}
                    <IconButton size="small" onClick={() => deleteActionMutation.mutate(a.id)}><DeleteIcon fontSize="small" /></IconButton>
                  </Stack>
                </Stack>
              </Paper>
              );
            })}
          </Stack>
        </Box>
      )}

      {/* Tab: Evidence */}
      {tab === 3 && (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={800}>Evidence Attachments</Typography>
            <Button size="small" variant="contained" component="label" startIcon={<UploadFileIcon />}
              sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
              {uploading ? <CircularProgress size={18} /> : 'Upload Evidence'}
              <input type="file" hidden onChange={e => handleUpload(e.target.files?.[0] || null)} />
            </Button>
          </Stack>
          {uploadError && <Alert severity="error" sx={{ mb: 2 }}>{uploadError}</Alert>}
          {(!incident.attachments || incident.attachments.length === 0) ? (
            <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB' }}>
              <Typography color="#9CA3AF">No evidence attached</Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #E5E7EB' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>File</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Size</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Uploaded By</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Uploaded At</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {incident.attachments.map((att: any) => (
                    <TableRow key={att.id}>
                      <TableCell><Typography fontWeight={600}>{att.file_name}</Typography></TableCell>
                      <TableCell><Typography variant="caption">{att.file_type || '—'}</Typography></TableCell>
                      <TableCell>{att.file_size ? `${(att.file_size / 1024).toFixed(1)} KB` : '—'}</TableCell>
                      <TableCell>{att.uploaded_first ? `${att.uploaded_first} ${att.uploaded_last}` : '—'}</TableCell>
                      <TableCell>{new Date(att.created_at).toLocaleString('en-GB')}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" title="Open file" onClick={() => openFileInNewTab(att.file_url)}><OpenInNewIcon fontSize="small" /></IconButton>
                        <IconButton size="small" onClick={() => deleteAttachmentMutation.mutate(att.id)}><DeleteIcon fontSize="small" /></IconButton>
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
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <TimelineIcon sx={{ color: '#0F4C81' }} />
            <Typography variant="subtitle1" fontWeight={800}>Audit Timeline</Typography>
          </Stack>
          {!timeline || timeline.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB' }}>
              <Typography color="#9CA3AF">No timeline events</Typography>
            </Paper>
          ) : (
            <Stack spacing={1}>
              {timeline.map((t: any, i: number) => (
                <Paper key={i} sx={{ p: 2, borderRadius: 2, border: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{t.title}</Typography>
                    <Typography variant="caption" color="#6B7280">{t.detail}</Typography>
                  </Box>
                  <Typography variant="caption" color="#9CA3AF">{new Date(t.created_at).toLocaleString('en-GB')}</Typography>
                </Paper>
              ))}
            </Stack>
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
          <DialogTitle sx={{ fontWeight: 800 }}>Update Incident</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Title" fullWidth required value={updateForm.title || ''} onChange={e => setUpdateForm({ ...updateForm, title: e.target.value })} />
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
              <Stack direction="row" spacing={1}>
                <TextField label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={updateForm.incident_date || ''} onChange={e => setUpdateForm({ ...updateForm, incident_date: e.target.value })} />
                <TextField label="Time" type="time" fullWidth InputLabelProps={{ shrink: true }} value={updateForm.incident_time || ''} onChange={e => setUpdateForm({ ...updateForm, incident_time: e.target.value })} />
              </Stack>
              <TextField label="Location" fullWidth value={updateForm.location || ''} onChange={e => setUpdateForm({ ...updateForm, location: e.target.value })} />
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Button variant={updateForm.is_cqc_reportable ? 'contained' : 'outlined'} color="error" size="small"
                  onClick={() => setUpdateForm({ ...updateForm, is_cqc_reportable: !updateForm.is_cqc_reportable })} sx={{ textTransform: 'none' }}>
                  {updateForm.is_cqc_reportable ? '✓ CQC Reportable' : 'Mark CQC Reportable'}
                </Button>
                <Button variant={updateForm.is_near_miss ? 'contained' : 'outlined'} color="secondary" size="small"
                  onClick={() => setUpdateForm({ ...updateForm, is_near_miss: !updateForm.is_near_miss })} sx={{ textTransform: 'none' }}>
                  {updateForm.is_near_miss ? '✓ Near Miss' : 'Mark Near Miss'}
                </Button>
                {isOrgAdmin && (
                  <Button variant={updateForm.is_confidential ? 'contained' : 'outlined'} color="inherit" size="small"
                    onClick={() => setUpdateForm({ ...updateForm, is_confidential: !updateForm.is_confidential })} sx={{ textTransform: 'none' }}>
                    {updateForm.is_confidential ? '✓ Confidential' : 'Mark Confidential'}
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
            <Button onClick={() => setUpdateOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={updateMutation.isPending} sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
              {updateMutation.isPending ? <CircularProgress size={20} /> : 'Save'}
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
                {(residents || []).map((r: any) => (
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
            <Button onClick={() => setAddResidentOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>Add</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Add Action Dialog */}
      <Dialog open={addActionOpen} onClose={() => setAddActionOpen(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); addActionMutation.mutate(actionForm) }}>
          <DialogTitle sx={{ fontWeight: 800 }}>Add Action</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Action" fullWidth required multiline rows={2} value={actionForm.action} onChange={e => setActionForm({ ...actionForm, action: e.target.value })} />
              <Autocomplete
                options={orgMembers || []}
                getOptionLabel={(m: any) => m.first_name ? `${m.first_name} ${m.last_name}` : m.email}
                value={(orgMembers || []).find((m: any) => m.id === actionForm.assigned_to) || null}
                onChange={(_, v: any) => setActionForm({ ...actionForm, assigned_to: v?.id || '' })}
                renderInput={(params) => <TextField {...params} label="Assigned To" fullWidth />}
              />
              <TextField label="Due Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={actionForm.due_date} onChange={e => setActionForm({ ...actionForm, due_date: e.target.value })} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setAddActionOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>Add</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Edit Action Dialog */}
      <Dialog open={editActionOpen} onClose={() => setEditActionOpen(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); updateActionMutation.mutate({ actionId: editActionForm.id, data: editActionForm }) }}>
          <DialogTitle sx={{ fontWeight: 800 }}>Edit Action</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Action" fullWidth required multiline rows={2} value={editActionForm.action || ''} onChange={e => setEditActionForm({ ...editActionForm, action: e.target.value })} />
              <Autocomplete
                options={orgMembers || []}
                getOptionLabel={(m: any) => m.first_name ? `${m.first_name} ${m.last_name}` : m.email}
                value={(orgMembers || []).find((m: any) => m.id === editActionForm.assigned_to) || null}
                onChange={(_, v: any) => setEditActionForm({ ...editActionForm, assigned_to: v?.id || '' })}
                renderInput={(params) => <TextField {...params} label="Assigned To" fullWidth />}
              />
              <TextField label="Due Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={editActionForm.due_date || ''} onChange={e => setEditActionForm({ ...editActionForm, due_date: e.target.value })} />
              <TextField select label="Status" fullWidth value={editActionForm.status || 'pending'} onChange={e => setEditActionForm({ ...editActionForm, status: e.target.value })}>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setEditActionOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>Save</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Delete Incident</DialogTitle>
        <DialogContent>
          <Alert severity="warning">This permanently deletes "{incident.title}" and all linked people, actions, and evidence. This action cannot be undone.</Alert>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
            {deleteMutation.isPending ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
