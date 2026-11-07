import { useState } from 'react'
import {
  Box, Typography, Paper, Stack, Chip, Button, Tabs, Tab, Grid,
  TextField, CircularProgress, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions, MenuItem, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton,
  Divider, Autocomplete, LinearProgress,
} from '@mui/material'
import PageContainer from '../../components/design/PageContainer'
import {
  Add as AddIcon, CheckCircle as CheckIcon,
  Delete as DeleteIcon, Edit as EditIcon,
  OpenInNew as OpenInNewIcon, UploadFile as UploadFileIcon,
  SmartToy as AIIcon, Schedule as OverdueIcon, Event as TimelineIcon,
  Person as PersonIcon, Assignment as ActionIcon, Schedule as VisitIcon,
  Group as GroupIcon, FavoriteBorder as HeartIcon, ChatBubbleOutline as ChatIcon,
  Flag as FlagIcon, Description as DocIcon, AccessTime as ClockIcon, Security as ShieldIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link as RouterLink, useParams, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { localToday } from '../../utils/dateFormat'
import { StatusBadge, ConfirmDialog, EmptyRow, NAVY } from '../../components/ui'
import IncidentWorkflowBoard from './IncidentWorkflowBoard'
import IncidentLifecycleBoard from './IncidentLifecycleBoard'
import IncidentCloseoutBoard from './IncidentCloseoutBoard'
import IncidentSuggestedActions from './IncidentSuggestedActions'
import { useSnackbar } from '../../context/SnackbarContext'

const SEVERITY_TONE: Record<string, 'success' | 'warning' | 'error' | 'purple'> = {
  low: 'success', medium: 'warning', high: 'error', critical: 'purple',
}
const STATUS_TONE: Record<string, 'warning' | 'info' | 'success' | 'neutral'> = {
  draft: 'neutral', reported: 'warning', submitted: 'info', triaging: 'info',
  investigating: 'info', actioning: 'info', verifying: 'info',
  resolved: 'success', closed: 'neutral', reopened: 'warning',
}
const ACTION_STATUS_TONE: Record<string, 'warning' | 'info' | 'success' | 'neutral'> = {
  pending: 'warning', in_progress: 'info', completed: 'success', cancelled: 'neutral',
}
function localDateParam(value: string) {
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function openFileInNewTab(url: string) {
  // Same-origin request: the session cookie authenticates it.
  fetch(url).then(r => r.blob()).then(b => {
    window.open(URL.createObjectURL(b), '_blank', 'noopener')
  }).catch(() => {})
}

function NextStepCard({ onSubmit, submitting, variant = 'submit', onAssign }: { onSubmit: () => void; submitting?: boolean; variant?: 'submit' | 'assign'; onAssign?: () => void }) {
  const isAssign = variant === 'assign'
  return (
    <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: '#D4E6FF', bgcolor: '#F0F5FC' }}>
      <Typography variant="caption" sx={{ color: '#0164C8', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Next step</Typography>
      <Typography variant="body2" fontWeight={700} sx={{ mt: 1 }}>
        {isAssign ? 'Confirm the severity and choose who will investigate.' : 'Submit for triage so an investigator can be assigned.'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {isAssign ? 'The person you choose is notified straight away, and the incident moves to Investigating.' : 'Triage confirms the severity, owner and whether the regulator needs to be told.'}
      </Typography>
      <Button fullWidth variant="contained" size="small" disabled={isAssign ? false : submitting} onClick={isAssign ? onAssign : onSubmit}
        sx={{ mt: 2, bgcolor: '#0164C8', textTransform: 'none', fontWeight: 600 }}>
        {!isAssign && submitting ? 'Submitting…' : isAssign ? 'Assign investigator →' : 'Submit for triage →'}
      </Button>
    </Paper>
  )
}

function DetailSummaryCard({ peopleCount, actionsDone, actionsTotal, regulator, reported }: { peopleCount: number; actionsDone: number; actionsTotal: number; regulator: string; reported: string }) {
  const rows: Array<[string, string]> = [
    ['People involved', `${peopleCount}`],
    ['Actions', `${actionsDone} of ${actionsTotal} done`],
    ['Regulator notification', regulator],
    ['Reported', reported],
  ]
  return (
    <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0' }}>
      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Summary</Typography>
      {rows.map(([k, v], i) => (
        <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', py: 1, ...(i < rows.length - 1 ? { borderBottom: '1px solid #E3E9F0' } : {}) }}>
          <Typography variant="body2" color="text.secondary">{k}</Typography>
          <Typography variant="body2" fontWeight={600} sx={{ color: v === 'Not set' ? 'text.secondary' : 'text.primary' }}>{v}</Typography>
        </Box>
      ))}
    </Paper>
  )
}

export default function IncidentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()
  const currentUser = (() => { const s = localStorage.getItem('user'); try { const p = s ? JSON.parse(s) : {}; return p && typeof p === 'object' ? p : {} } catch { return {} } })()
  const isOrgAdmin = currentUser.role === 'ORG_ADMIN'
  // Support workers can raise an incident and follow it, but triage and
  // investigation are a manager's job, so the edit affordance is hidden from
  // them rather than left to fail on save.
  const canTriage = currentUser.role === 'ORG_ADMIN' || currentUser.role === 'MANAGER'
  const [tab, setTab] = useState(0)
  const [addResidentOpen, setAddResidentOpen] = useState(false)
  const [addActionOpen, setAddActionOpen] = useState(false)
  const [editActionOpen, setEditActionOpen] = useState(false)
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [verifyActionId, setVerifyActionId] = useState<string | null>(null)
  const [verifyForm, setVerifyForm] = useState({ effectiveness: 'effective', notes: '' })
  const [updateOpen, setUpdateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [reopenOpen, setReopenOpen] = useState(false)
  const [reopenReason, setReopenReason] = useState('')
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
    // Figma 9: the toast is shown before leaving, so the confirmation is read
    // on the screen that follows rather than dying with this one.
    onSuccess: () => { showSnackbar('The incident record has been removed.', 'success', 'Incident deleted'); navigate('/incidents') },
  })

  const submitMutation = useMutation({
    mutationFn: () => api.post(`/incidents/${id}/submit`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incident', id] }); queryClient.invalidateQueries({ queryKey: ['incident-timeline', id] })
      // Figma 9: submitting confirms with a toast — what happened, then what happens next.
      showSnackbar('The incident is with the triage team. Confirm the severity and choose who will investigate.', 'success', 'Submitted for triage')
    },
  })

  const reopenMutation = useMutation({
    mutationFn: (reason: string) => api.post(`/incidents/${id}/reopen`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incident', id] })
      queryClient.invalidateQueries({ queryKey: ['incident-timeline', id] })
      setReopenOpen(false); setReopenReason('')
    },
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

  const verifyActionMutation = useMutation({
    mutationFn: ({ actionId, data }: { actionId: string; data: any }) => api.post(`/incidents/${id}/actions/${actionId}/verify`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['incident', id] }); setVerifyOpen(false); setVerifyActionId(null) },
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

  if (isLoading) return <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0' }}><CircularProgress size={28} sx={{ color: NAVY }} /><Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Loading incident...</Typography></Paper>
  if (!incident) return <Alert severity="error">Incident not found</Alert>

  const involvedPeople = Array.isArray(incident.involved) ? incident.involved : []
  const incidentActions = Array.isArray(incident.actions) ? incident.actions : []
  const incidentAttachments = Array.isArray(incident.attachments) ? incident.attachments : []
  const completedActions = incidentActions.filter((a: any) => a.completed_at).length || 0
  const totalActions = incidentActions.length || 0
  const actionProgress = totalActions > 0 ? (completedActions / totalActions) * 100 : 0
  const todayKey = localToday()
  const daysOpen = Math.max(0, Math.floor((new Date(`${todayKey}T12:00:00`).getTime() - new Date(`${String(incident.incident_date).slice(0, 10)}T12:00:00`).getTime()) / 86400000))
  const reportedLabel = new Date(incident.incident_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const categoryLabel = incident.category_name || 'No category'
  const notTriaged = ['draft', 'reported', 'submitted'].includes(incident.status)
  const severityLabel = incident.severity ? `${String(incident.severity)[0].toUpperCase()}${String(incident.severity).slice(1)} severity` : 'No severity'
  const stepIndex = ['draft', 'reported', 'reopened'].includes(incident.status) ? 0
    : ['submitted', 'triaging'].includes(incident.status) ? 1
    : incident.status === 'investigating' ? 2
    : ['actioning', 'verifying'].includes(incident.status) ? 3 : 4
  const inTriagePhase = ['submitted', 'triaging'].includes(incident.status)
  const needsInvestigator = ['submitted', 'triaging', 'investigating', 'actioning', 'verifying'].includes(incident.status) && !(incident as any).investigator_name
  const statusLabel = inTriagePhase ? 'Triage' : incident.status
  const steps = [
    { label: 'Reported', sub: 'reported' },
    { label: 'Triage', sub: 'Severity and owner confirmed' },
    { label: 'Investigating', sub: 'Root cause and notes' },
    { label: 'Actions agreed', sub: 'Follow-ups assigned' },
    { label: 'Closed', sub: 'Lessons learned recorded' },
  ]
  const overdueActions = incidentActions.filter((a: any) => !a.completed_at && a.status !== 'cancelled' && a.due_date && new Date(a.due_date) < new Date())
  const linkedVisit = incident.linked_visit_id ? {
    id: incident.linked_visit_id,
    label: incident.linked_visit_label,
    type: incident.linked_visit_type,
    status: incident.linked_visit_status,
    startsAt: incident.linked_visit_scheduled_start,
    endsAt: incident.linked_visit_scheduled_end,
    personName: incident.linked_visit_person_name,
  } : null
  const linkedVisitDate = linkedVisit?.startsAt
    ? new Date(linkedVisit.startsAt).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : null
  const linkedVisitTime = linkedVisit?.startsAt && linkedVisit?.endsAt
    ? `${new Date(linkedVisit.startsAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}–${new Date(linkedVisit.endsAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
    : null

  return (
    <PageContainer>

      {/* Header — Figma 3.3/3.4: back link, breadcrumb, title + actions, meta, badges */}
      <Button component={RouterLink} to="/incidents" size="small"
        sx={{ textTransform: 'none', color: '#0164C8', fontWeight: 600, px: 0, minWidth: 0, mb: 0.5, justifyContent: 'flex-start', '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' } }}>
        ‹ All incidents
      </Button>
      <Typography variant="caption" sx={{ color: '#0164C8', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        Incidents / {incident.title}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.5} sx={{ mt: 0.5 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>{incident.title}</Typography>
        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
          {canTriage && (
            <Button variant="outlined" size="small" startIcon={<EditIcon />}
              onClick={() => { setUpdateForm({ ...incident }); setUpdateOpen(true) }}
              sx={{ textTransform: 'none' }}>Edit</Button>
          )}
          {isOrgAdmin && (
            <Button variant="outlined" color="error" size="small"
              onClick={() => setDeleteOpen(true)} sx={{ textTransform: 'none' }}>Delete</Button>
          )}
          {(incident.status === 'draft' || incident.status === 'reported') && (
            <Button variant="contained" size="small" disabled={submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
              sx={{ bgcolor: '#0164C8', textTransform: 'none', fontWeight: 600 }}>
              {submitMutation.isPending ? 'Submitting…' : 'Submit for triage →'}
            </Button>
          )}
          {canTriage && inTriagePhase && (
            <Button variant="contained" size="small"
              onClick={() => { setUpdateForm({ ...incident }); setUpdateOpen(true) }}
              sx={{ bgcolor: '#0164C8', textTransform: 'none', fontWeight: 600 }}>
              Assign investigator →
            </Button>
          )}
          {canTriage && (incident.status === 'closed' || incident.status === 'resolved') && (
            <Button variant="outlined" size="small"
              onClick={() => { setReopenReason(''); setReopenOpen(true) }}
              sx={{ textTransform: 'none' }}>Reopen</Button>
          )}
        </Stack>
      </Stack>
      {submitMutation.isError && <Alert severity="error" sx={{ mt: 1, mb: 0 }}>Submit failed — the incident may already have moved; refresh and retry.</Alert>}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {categoryLabel} · Reported {reportedLabel} · Open for {daysOpen} day{daysOpen === 1 ? '' : 's'}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mt: 1.5, mb: 2, flexWrap: 'wrap', gap: 0.5 }}>
        <StatusBadge label={severityLabel} tone="neutral" />
        <StatusBadge label={statusLabel} tone={inTriagePhase ? 'info' : STATUS_TONE[incident.status] || 'neutral'} />
        {needsInvestigator && <StatusBadge label="Needs an investigator" tone="neutral" />}
        {notTriaged && <StatusBadge label="Not triaged" tone="error" />}
        {incident.is_cqc_reportable && <StatusBadge label="CQC Reportable" tone="error" />}
        {incident.is_near_miss && <StatusBadge label="Near Miss" tone="purple" />}
        {incident.is_confidential && <StatusBadge label="Confidential" tone="neutral" />}
      </Stack>

      {/* Submitted banner — Figma 3.4 */}
      {incident.status === 'submitted' && (
        <Paper sx={{ mb: 2, p: 2, borderRadius: 2, border: '1px solid', borderColor: '#D2FBF4', bgcolor: '#E9FDF9', display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
          <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: '#03C6B1', color: '#FFFFFF', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <CheckIcon fontSize="small" />
          </Box>
          <Box>
            <Typography variant="body2" fontWeight={700}>Submitted for triage</Typography>
            <Typography variant="body2" color="text.secondary">We&apos;ve let the team know. Next, confirm the severity and choose who will investigate.</Typography>
          </Box>
        </Paper>
      )}

      {/* Progress stepper */}
      <Paper sx={{ p: 2.5, mb: 0, borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0', overflowX: 'auto' }}>
        <Stack direction="row" alignItems="flex-start" sx={{ minWidth: 640 }}>
          {steps.map((s, i) => (
            <Box key={s.label} sx={{ flex: 1, display: 'flex', alignItems: 'flex-start' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 88 }}>
                <Box sx={{
                  width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center',
                  fontSize: 13, fontWeight: 700,
                  ...(i < stepIndex
                    ? { bgcolor: '#0164C8', color: '#FFFFFF' }
                    : i === stepIndex
                    ? { bgcolor: '#0164C8', color: '#FFFFFF' }
                    : { border: '2px solid #C3D2E2', color: '#B0BFD2', bgcolor: '#FFFFFF' }),
                }}>{i < stepIndex ? '✓' : i + 1}</Box>
                <Typography variant="body2" fontWeight={600} sx={{ mt: 1, color: i <= stepIndex ? '#0164C8' : 'text.secondary', textAlign: 'center' }}>{s.label}</Typography>
                <Typography variant="caption" sx={{ color: i === stepIndex && stepIndex === 0 && daysOpen > 0 ? '#EF4444' : 'text.secondary', textAlign: 'center' }}>
                  {i < stepIndex ? (i === 0 ? `Done · ${reportedLabel}` : 'Done')
                    : i === stepIndex
                    ? (stepIndex === 0 ? `${daysOpen} day${daysOpen === 1 ? '' : 's'} at this step` : 'In progress')
                    : s.sub}
                </Typography>
              </Box>
              {i < steps.length - 1 && (
                <Box sx={{ flex: 1, height: 2, mt: '13px', mx: 1, bgcolor: i < stepIndex ? '#0164C8' : '#E3E9F0' }} />
              )}
            </Box>
          ))}
        </Stack>
      </Paper>

      {/* Metadata strip */}
      <Paper sx={{ p: 2.5, mb: 3, borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0' }}>
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
        {incident.witnesses && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>Witnesses</Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{incident.witnesses}</Typography>
          </Stack>
        )}
      </Paper>

      {linkedVisit && (
        <Paper
          component={RouterLink}
          to={`/call-scheduling/day?date=${localDateParam(linkedVisit.startsAt)}&visit=${encodeURIComponent(linkedVisit.id)}`}
          aria-label={`Open linked care visit: ${linkedVisit.label || linkedVisit.type || 'Care visit'}`}
          sx={{
            display: 'block', p: 2.5, mb: 3, borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0',
            color: 'inherit', textDecoration: 'none', cursor: 'pointer',
            transition: 'border-color 150ms ease, box-shadow 150ms ease',
            '&:hover': { borderColor: NAVY, boxShadow: '0 4px 14px rgba(15, 76, 129, 0.12)' },
            '&:focus-visible': { outline: `3px solid ${NAVY}`, outlineOffset: 2 },
          }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
            <VisitIcon sx={{ color: NAVY, fontSize: 20 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'none', letterSpacing: '0.05em' }}>Linked care visit</Typography>
              <Typography variant="body2" fontWeight={600}>{linkedVisit.label || linkedVisit.type?.replace(/_/g, ' ') || 'Care visit'}</Typography>
              <Typography variant="caption" color="text.secondary">
                {[linkedVisit.personName, linkedVisitDate, linkedVisitTime].filter(Boolean).join(' · ')}
              </Typography>
            </Box>
            {linkedVisit.status && <StatusBadge label={linkedVisit.status.replace(/_/g, ' ')} tone={linkedVisit.status === 'completed' ? 'success' : linkedVisit.status === 'missed' ? 'error' : 'neutral'} />}
          </Stack>
        </Paper>
      )}

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: '#E3E9F0', mb: 3 }}>
        <Tab label="Overview" sx={{ textTransform: 'none', fontWeight: 600 }} />
        <Tab label={`People ${involvedPeople.length}`} sx={{ textTransform: 'none', fontWeight: 600 }} />
        <Tab label={`Actions ${totalActions}`} sx={{ textTransform: 'none', fontWeight: 600 }} />
        <Tab label={`Evidence${incidentAttachments.length ? ` ${incidentAttachments.length}` : ''}`} sx={{ textTransform: 'none', fontWeight: 600 }} />
        <Tab label="Workflow" sx={{ textTransform: 'none', fontWeight: 600 }} />
        <Tab label="Timeline" sx={{ textTransform: 'none', fontWeight: 600 }} />
        <Tab label="Related" sx={{ textTransform: 'none', fontWeight: 600 }} />
      </Tabs>

      {/* Tab: Overview */}
      {tab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Stack spacing={3}>
            <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0' }}>
              <Typography variant="subtitle2" fontWeight={600}>What happened</Typography>
              <Typography variant="body2" color={incident.description ? 'text.primary' : 'text.secondary'} sx={{ mt: 1, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {incident.description || 'No description recorded.'}
              </Typography>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                {[
                  ['Date', reportedLabel],
                  ['Category', categoryLabel],
                  ['Severity', incident.severity ? `${String(incident.severity)[0].toUpperCase()}${String(incident.severity).slice(1)}` : 'Not set'],
                  ['Location', incident.location || 'Not set'],
                ].map(([k, v]) => (
                  <Grid item xs={6} sm={3} key={k}>
                    <Typography variant="caption" color="text.secondary">{k}</Typography>
                    <Typography variant="body2" fontWeight={600} sx={{ color: v === 'Not set' ? 'text.secondary' : 'text.primary' }}>{v}</Typography>
                  </Grid>
                ))}
              </Grid>
            </Paper>
            <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0' }}>
              <Typography variant="subtitle2" fontWeight={600}>Investigation details</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>Filled in once the incident has been triaged.</Typography>
              <Stack spacing={2}>
                {[
                  { label: 'Root Cause', value: incident.root_cause },
                  { label: 'Investigation Notes', value: incident.investigation_notes },
                  { label: 'Lessons Learned', value: incident.lessons_learned },
                  { label: 'Outcomes', value: incident.outcomes },
                ].map((r, i) => (
                  <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start' }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'none', letterSpacing: '0.05em' }}>{r.label}</Typography>
                      <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap', color: r.value ? 'text.primary' : 'text.secondary' }}>
                        {r.value || 'Not recorded'}
                      </Typography>
                    </Box>
                    {!r.value && canTriage && (
                      <Button size="small" onClick={() => { setUpdateForm({ ...incident }); setUpdateOpen(true) }}
                        sx={{ textTransform: 'none', color: '#0164C8', fontWeight: 600, flexShrink: 0 }}>Add</Button>
                    )}
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
            </Stack>
          </Grid>
          <Grid item xs={12} md={4}>
            <Stack spacing={3}>
              {(incident.status === 'draft' || incident.status === 'reported') && (
                <NextStepCard onSubmit={() => submitMutation.mutate()} submitting={submitMutation.isPending} />
              )}
              {inTriagePhase && (
                <NextStepCard variant="assign" onSubmit={() => submitMutation.mutate()} onAssign={() => { setUpdateForm({ ...incident }); setUpdateOpen(true) }} />
              )}
              {/* Summary card */}
              <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0' }}>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>Summary</Typography>
                <Stack spacing={2}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <PersonIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      <Typography variant="body2">People Involved</Typography>
                    </Stack>
                    <Typography variant="body2" fontWeight={600}>{involvedPeople.length || 0}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <ActionIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      <Typography variant="body2">Actions</Typography>
                    </Stack>
                    <Typography variant="body2" fontWeight={600}>{completedActions} / {totalActions}</Typography>
                  </Stack>
                  {totalActions > 0 && (
                    <Box>
                      <LinearProgress variant="determinate" value={actionProgress}
                        sx={{ height: 6, borderRadius: 3, bgcolor: 'notice.muted.bg', '& .MuiLinearProgress-bar': { bgcolor: actionProgress === 100 ? '#10B981' : NAVY } }} />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        {actionProgress === 100 ? 'All actions completed' : `${Math.round(actionProgress)}% complete`}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Paper>

              {/* Overdue actions alert */}
              {overdueActions.length > 0 && (
                <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid #FEF0F0', bgcolor: 'notice.error.bg' }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <OverdueIcon sx={{ fontSize: 18, color: 'notice.error.fg' }} />
                    <Typography variant="subtitle2" fontWeight={600} color='notice.error.fg'>Overdue Actions</Typography>
                  </Stack>
                  <Typography variant="body2" color='notice.error.fg'>{overdueActions.length} action{overdueActions.length > 1 ? 's' : ''} past due date</Typography>
                </Paper>
              )}

              {/* AI Triage */}
              {incident.ai_triage && (
                <Paper sx={{ p: 3, borderRadius: 2, border: `1px solid ${NAVY}20`, bgcolor: `${NAVY}04` }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                    <AIIcon sx={{ color: NAVY, fontSize: 20 }} />
                    <Typography variant="subtitle2" fontWeight={600}>AI Triage</Typography>
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
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>Recommended actions</Typography>
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

      {/* Tab: Involved People — extended view */}
      {tab === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Stack spacing={3}>
              <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600}>People involved</Typography>
                    <Typography variant="caption" color="text.secondary">{involvedPeople.length} {involvedPeople.length === 1 ? 'person' : 'people'}</Typography>
                  </Box>
                  {canTriage && involvedPeople.length > 0 && (
                    <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setAddResidentOpen(true)}
                      sx={{ bgcolor: '#0164C8', textTransform: 'none', fontWeight: 600 }}>Add person</Button>
                  )}
                </Stack>
          {(!incident.involved || incident.involved.length === 0) ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: '#EAF3FF', color: '#0164C8', display: 'inline-grid', placeItems: 'center', mb: 1.5 }}>
                  <GroupIcon />
                </Box>
                <Typography variant="body2" fontWeight={700}>No one has been added yet</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 420, mx: 'auto' }}>
                  Add the person supported, the staff on shift and any witnesses, so whoever investigates has the full picture.
                </Typography>
                {canTriage && (
                  <Button size="small" variant="contained" onClick={() => setAddResidentOpen(true)}
                    sx={{ mt: 2, bgcolor: '#0164C8', textTransform: 'none', fontWeight: 600 }}>Add person</Button>
                )}
              </Box>
          ) : (
            <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'none', letterSpacing: '0.05em' }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'none', letterSpacing: '0.05em' }}>Room</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'none', letterSpacing: '0.05em' }}>Involvement</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'none', letterSpacing: '0.05em' }}>Notes</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'none', letterSpacing: '0.05em' }} align="right">Actions</TableCell>
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
              </Paper>
              <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0' }}>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>Who to add</Typography>
                {[
                  { icon: <HeartIcon sx={{ fontSize: 18 }} />, title: 'Person supported', sub: 'Who the incident happened to' },
                  { icon: <GroupIcon sx={{ fontSize: 18 }} />, title: 'Staff on shift', sub: 'Who was there and who reported it' },
                  { icon: <ChatIcon sx={{ fontSize: 18 }} />, title: 'Witnesses and family', sub: 'Anyone who saw it or needs to be told' },
                ].map((r, i, arr) => (
                  <Box key={r.title} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', py: 1.5, ...(i < arr.length - 1 ? { borderBottom: '1px solid #E3E9F0' } : {}) }}>
                    <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: '#F0F5FC', color: '#0164C8', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{r.icon}</Box>
                    <Box>
                      <Typography variant="body2" fontWeight={700}>{r.title}</Typography>
                      <Typography variant="caption" color="text.secondary">{r.sub}</Typography>
                    </Box>
                  </Box>
                ))}
              </Paper>
            </Stack>
          </Grid>
          <Grid item xs={12} md={4}>
            <Stack spacing={3}>
              {(incident.status === 'draft' || incident.status === 'reported') && (
                <NextStepCard onSubmit={() => submitMutation.mutate()} submitting={submitMutation.isPending} />
              )}
              {inTriagePhase && (
                <NextStepCard variant="assign" onSubmit={() => submitMutation.mutate()} onAssign={() => { setUpdateForm({ ...incident }); setUpdateOpen(true) }} />
              )}
              <DetailSummaryCard peopleCount={involvedPeople.length} actionsDone={completedActions} actionsTotal={totalActions} regulator={incident.reported_to_cqc_at ? 'Notified' : 'Not set'} reported={reportedLabel} />
            </Stack>
          </Grid>
        </Grid>
      )}

      {/* Tab: Actions — extended view */}
      {tab === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Stack spacing={3}>
          {id && <IncidentSuggestedActions incidentId={id} canTriage={canTriage} />}
              <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600}>Actions</Typography>
                    <Typography variant="caption" color="text.secondary">{completedActions} of {totalActions} done</Typography>
                  </Box>
                  {canTriage && totalActions > 0 && (
                    <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setAddActionOpen(true)}
                      sx={{ bgcolor: '#0164C8', textTransform: 'none', fontWeight: 600 }}>Add action</Button>
                  )}
                </Stack>
          {(!incident.actions || incident.actions.length === 0) ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: '#EAF3FF', color: '#0164C8', display: 'inline-grid', placeItems: 'center', mb: 1.5 }}>
                  <CheckIcon />
                </Box>
                <Typography variant="body2" fontWeight={700}>No actions agreed yet</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 440, mx: 'auto' }}>
                  Actions are agreed after triage — for example a medication review or a refresher course. Each one gets an owner and a due date.
                </Typography>
                {canTriage && (
                  <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setAddActionOpen(true)}
                    sx={{ mt: 2, textTransform: 'none', fontWeight: 600 }}>Add action</Button>
                )}
              </Box>
          ) : (
            <Stack spacing={1.5}>
              {incidentActions.map((a: any) => {
                const overdue = !a.completed_at && a.status !== 'cancelled' && a.due_date && new Date(a.due_date) < new Date()
                return (
                  <Paper key={a.id} sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0' }}>
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
                              <Typography variant="caption" color={overdue ? '#EF4444' : 'text.secondary'}>
                                Due: {new Date(a.due_date).toLocaleDateString('en-GB')}
                              </Typography>
                              {overdue && <Chip icon={<OverdueIcon sx={{ fontSize: 12 }} />} label="Overdue" size="small"
                                sx={{ bgcolor: 'notice.error.bg', color: 'notice.error.fg', fontWeight: 600, fontSize: 10, height: 20 }} />}
                            </Stack>
                          )}
                          <StatusBadge label={a.status?.replace(/_/g, ' ') || 'pending'} tone={ACTION_STATUS_TONE[a.status] || 'neutral'} />
                          {a.completed_at && (
                            <Typography variant="caption" color="#10B981">
                              Completed {new Date(a.completed_at).toLocaleDateString('en-GB')}
                            </Typography>
                          )}
                          {a.verified_at ? (
                            <StatusBadge label={`Verified: ${String(a.effectiveness || '').replace(/_/g, ' ') || 'checked'}`} tone={a.effectiveness === 'effective' ? 'success' : a.effectiveness === 'partial' ? 'warning' : 'error'} />
                          ) : a.completed_at ? (
                            <StatusBadge label="Unverified" tone="warning" />
                          ) : null}
                        </Stack>
                      </Box>
                      <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0, ml: 1 }}>
                        {canTriage && <IconButton size="small" title="Edit" onClick={() => { setEditActionForm({ ...a, assigned_to: a.assigned_to || '' }); setEditActionOpen(true) }}>
                          <EditIcon fontSize="small" />
                        </IconButton>}
                        {canTriage && !a.completed_at && a.status !== 'cancelled' && (
                          <IconButton size="small" title="Complete" color="success" onClick={() => completeActionMutation.mutate(a.id)}>
                            <CheckIcon fontSize="small" />
                          </IconButton>
                        )}
                        {canTriage && a.completed_at && !a.verified_at && (
                          <IconButton size="small" title="Verify effectiveness" color="primary"
                            onClick={() => { setVerifyActionId(a.id); setVerifyForm({ effectiveness: 'effective', notes: '' }); setVerifyOpen(true) }}>
                            <CheckIcon fontSize="small" />
                          </IconButton>
                        )}
                        {canTriage && (
                          <IconButton size="small" title="Delete" onClick={() => deleteActionMutation.mutate(a.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Stack>
                    </Stack>
                  </Paper>
                )
              })}
                </Stack>
              )}
              </Paper>
            </Stack>
          </Grid>
          <Grid item xs={12} md={4}>
            <Stack spacing={3}>
              {(incident.status === 'draft' || incident.status === 'reported') && (
                <NextStepCard onSubmit={() => submitMutation.mutate()} submitting={submitMutation.isPending} />
              )}
              {inTriagePhase && (
                <NextStepCard variant="assign" onSubmit={() => submitMutation.mutate()} onAssign={() => { setUpdateForm({ ...incident }); setUpdateOpen(true) }} />
              )}
              <DetailSummaryCard peopleCount={involvedPeople.length} actionsDone={completedActions} actionsTotal={totalActions} regulator={incident.reported_to_cqc_at ? 'Notified' : 'Not set'} reported={reportedLabel} />
            </Stack>
          </Grid>
        </Grid>
      )}

      {/* Tab: Evidence — extended view */}
      {tab === 3 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Stack spacing={3}>
              <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600}>Evidence</Typography>
                    <Typography variant="caption" color="text.secondary">{incidentAttachments.length} {incidentAttachments.length === 1 ? 'file' : 'files'}</Typography>
                  </Box>
                  <Button size="small" variant="contained" component="label" startIcon={<UploadFileIcon />}
                    sx={{ bgcolor: '#0164C8', textTransform: 'none', fontWeight: 600 }}>
                    {uploading ? <CircularProgress size={18} color="inherit" /> : 'Upload evidence'}
                    <input type="file" hidden onChange={e => handleUpload(e.target.files?.[0] || null)} />
                  </Button>
                </Stack>
                {uploadError && <Alert severity="error" sx={{ mt: 2 }}>{uploadError}</Alert>}
          {(!incident.attachments || incident.attachments.length === 0) ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: '#EAF3FF', color: '#0164C8', display: 'inline-grid', placeItems: 'center', mb: 1.5 }}>
                    <DocIcon />
                  </Box>
                  <Typography variant="body2" fontWeight={700}>No evidence uploaded</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 440, mx: 'auto' }}>
                    Upload photos, MAR chart extracts, body maps or written statements. Files stay with this incident record.
                  </Typography>
                  <Button size="small" variant="contained" component="label"
                    sx={{ mt: 2, bgcolor: '#0164C8', textTransform: 'none', fontWeight: 600 }}>
                    Upload evidence
                    <input type="file" hidden onChange={e => handleUpload(e.target.files?.[0] || null)} />
                  </Button>
                </Box>
          ) : (
            <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'none', letterSpacing: '0.05em' }}>File</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'none', letterSpacing: '0.05em' }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'none', letterSpacing: '0.05em' }}>Size</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'none', letterSpacing: '0.05em' }}>Uploaded By</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'none', letterSpacing: '0.05em' }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'none', letterSpacing: '0.05em' }} align="right">Actions</TableCell>
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
              </Paper>
              <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0' }}>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>Good to know</Typography>
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', py: 1 }}>
                  <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: '#F0F5FC', color: '#0164C8', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <DocIcon sx={{ fontSize: 18 }} />
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight={700}>Photos, PDFs and documents</Typography>
                    <Typography variant="caption" color="text.secondary">Up to 25 MB each · only people with access to this incident can see them.</Typography>
                  </Box>
                </Box>
              </Paper>
            </Stack>
          </Grid>
          <Grid item xs={12} md={4}>
            <Stack spacing={3}>
              {(incident.status === 'draft' || incident.status === 'reported') && (
                <NextStepCard onSubmit={() => submitMutation.mutate()} submitting={submitMutation.isPending} />
              )}
              {inTriagePhase && (
                <NextStepCard variant="assign" onSubmit={() => submitMutation.mutate()} onAssign={() => { setUpdateForm({ ...incident }); setUpdateOpen(true) }} />
              )}
              <DetailSummaryCard peopleCount={involvedPeople.length} actionsDone={completedActions} actionsTotal={totalActions} regulator={incident.reported_to_cqc_at ? 'Notified' : 'Not set'} reported={reportedLabel} />
            </Stack>
          </Grid>
        </Grid>
      )}

      {/* Tab: Workflow — extended view */}
      {tab === 4 && id && (
        <Stack spacing={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Stack spacing={3}>
                <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0' }}>
                  <Typography variant="subtitle1" fontWeight={600}>Workflow</Typography>
                  <Typography variant="caption" color="text.secondary">Where this incident is in the process</Typography>
                  <Stack sx={{ mt: 1 }}>
                    {[
                      { icon: <FlagIcon sx={{ fontSize: 18 }} />, title: 'Reported', sub: reportedLabel },
                      { icon: <ClockIcon sx={{ fontSize: 18 }} />, title: 'Triage', sub: 'Severity and owner not confirmed yet' },
                      { icon: <DocIcon sx={{ fontSize: 18 }} />, title: 'Investigating', sub: 'Root cause and notes' },
                      { icon: <CheckIcon sx={{ fontSize: 18 }} />, title: 'Actions agreed', sub: 'Follow-ups assigned' },
                      { icon: <ShieldIcon sx={{ fontSize: 18 }} />, title: 'Closed', sub: 'Lessons learned recorded' },
                    ].map((s, i, arr) => {
                      const state = i < stepIndex ? 'done' : i === stepIndex ? (i === 0 ? 'done' : 'waiting') : 'todo'
                      return (
                        <Box key={s.title} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', py: 1.5, ...(i < arr.length - 1 ? { borderBottom: '1px solid #E3E9F0' } : {}) }}>
                          <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: state === 'todo' ? '#F0F5FC' : '#EAF3FF', color: state === 'todo' ? '#B0BFD2' : '#0164C8', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{s.icon}</Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={700}>{i + 1} · {s.title}</Typography>
                            <Typography variant="caption" color="text.secondary">{s.sub}</Typography>
                          </Box>
                          {state === 'done' ? <StatusBadge label="Done" tone="success" />
                            : state === 'waiting' ? <StatusBadge label={stepIndex === 1 ? `Waiting ${daysOpen} days` : 'In progress'} tone={stepIndex === 1 ? 'error' : 'info'} />
                            : <StatusBadge label="Not started" tone="neutral" />}
                        </Box>
                      )
                    })}
                  </Stack>
                </Paper>
                <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0' }}>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>Responsibilities</Typography>
                  {[
                    ['Investigator', (incident as any).investigator_name || 'Not assigned'],
                    ['Reviewer', (incident as any).reviewer_name || 'Not assigned'],
                    ['Regulator notification', incident.reported_to_cqc_at ? 'Notified' : 'Not set'],
                    ['Target close date', (incident as any).target_close_date ? new Date((incident as any).target_close_date).toLocaleDateString('en-GB') : 'Not set'],
                  ].map(([k, v], i, arr) => (
                    <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', py: 1.2, ...(i < arr.length - 1 ? { borderBottom: '1px solid #E3E9F0' } : {}) }}>
                      <Typography variant="body2" color="text.secondary">{k}</Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: String(v).startsWith('Not ') ? 'text.secondary' : 'text.primary' }}>{v}</Typography>
                    </Box>
                  ))}
                </Paper>
              </Stack>
            </Grid>
            <Grid item xs={12} md={4}>
              <Stack spacing={3}>
                {(incident.status === 'draft' || incident.status === 'reported') && (
                  <NextStepCard onSubmit={() => submitMutation.mutate()} submitting={submitMutation.isPending} />
                )}
                <DetailSummaryCard peopleCount={involvedPeople.length} actionsDone={completedActions} actionsTotal={totalActions} regulator={incident.reported_to_cqc_at ? 'Notified' : 'Not set'} reported={reportedLabel} />
              </Stack>
            </Grid>
          </Grid>
          <IncidentWorkflowBoard incidentId={id} canTriage={canTriage} />
          <IncidentCloseoutBoard incidentId={id} status={incident.status} canTriage={canTriage} />
        </Stack>
      )}

      {/* Tab: Related — duplicate candidates and recorded links */}
      {tab === 6 && id && (
        <IncidentLifecycleBoard incidentId={id} canTriage={canTriage} />
      )}

      {/* Tab: Timeline */}
      {tab === 5 && (
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 3 }}>
            <TimelineIcon sx={{ color: NAVY, fontSize: 20 }} />
            <Typography variant="subtitle1" fontWeight={600}>Audit Timeline</Typography>
          </Stack>
          {(!timeline || timeline.length === 0) ? (
            <EmptyRow message="No timeline events" />
          ) : (
            <Box sx={{ position: 'relative', pl: 3 }}>
              {/* Vertical line */}
              <Box sx={{ position: 'absolute', left: 7, top: 0, bottom: 0, width: 2, bgcolor: '#E3E9F0' }} />
              <Stack spacing={0}>
                {timeline.map((t: any, i: number) => (
                  <Box key={i} sx={{ position: 'relative', pb: 2.5 }}>
                    {/* Dot */}
                    <Box sx={{ position: 'absolute', left: -25, top: 4, width: 12, height: 12, borderRadius: '50%', bgcolor: i === 0 ? NAVY : '#D6E2EE', border: `2px solid ${i === 0 ? NAVY : '#E3E9F0'}` }} />
                    <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0' }}>
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
          <DialogTitle sx={{ fontWeight: 600 }}>Edit Incident</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Title" fullWidth required value={updateForm.title || ''} onChange={e => setUpdateForm({ ...updateForm, title: e.target.value })} />
              <Stack direction="row" spacing={1}>
                <TextField select label="Status" fullWidth value={updateForm.status || 'reported'} onChange={e => setUpdateForm({ ...updateForm, status: e.target.value })}>
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="reported">Reported</MenuItem>
                  <MenuItem value="submitted">Submitted</MenuItem>
                  <MenuItem value="triaging">Triaging</MenuItem>
                  <MenuItem value="investigating">Investigating</MenuItem>
                  <MenuItem value="actioning">Actioning</MenuItem>
                  <MenuItem value="verifying">Verifying</MenuItem>
                  <MenuItem value="resolved">Resolved</MenuItem>
                  <MenuItem value="closed">Closed</MenuItem>
                  <MenuItem value="reopened">Reopened</MenuItem>
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
              sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 600 }}>
              {updateMutation.isPending ? <CircularProgress size={20} color="inherit" /> : 'Save Changes'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Add Resident Dialog */}
      <Dialog open={addResidentOpen} onClose={() => setAddResidentOpen(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); addResidentMutation.mutate(residentForm) }}>
          <DialogTitle sx={{ fontWeight: 600 }}>Add Involved Person</DialogTitle>
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
            <Button type="submit" variant="contained" sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 600 }}>Add Person</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Add Action Dialog */}
      <Dialog open={addActionOpen} onClose={() => setAddActionOpen(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); addActionMutation.mutate(actionForm) }}>
          <DialogTitle sx={{ fontWeight: 600 }}>Add Action</DialogTitle>
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
            <Button type="submit" variant="contained" sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 600 }}>Add Action</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Edit Action Dialog */}
      <Dialog open={editActionOpen} onClose={() => setEditActionOpen(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); updateActionMutation.mutate({ actionId: editActionForm.id, data: editActionForm }) }}>
          <DialogTitle sx={{ fontWeight: 600 }}>Edit Action</DialogTitle>
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
            <Button type="submit" variant="contained" sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 600 }}>Save Changes</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Reopen Dialog — a reopen without a reason is indistinguishable from a mistake */}
      <Dialog open={reopenOpen} onClose={() => setReopenOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Reopen incident</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Reopening restarts this investigation on the same record — history, actions and evidence stay intact.
            </Typography>
            <TextField label="Why is this being reopened? (required)" value={reopenReason}
              onChange={e => setReopenReason(e.target.value)} fullWidth multiline minRows={2}
              helperText="Recorded in the audit timeline with your name." />
            {reopenMutation.isError && <Alert severity="error">Reopen failed — the incident may already have moved; refresh and retry.</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setReopenOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" disabled={!reopenReason.trim() || reopenMutation.isPending}
            onClick={() => reopenMutation.mutate(reopenReason.trim())}
            sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 600 }}>
            {reopenMutation.isPending ? 'Reopening…' : 'Reopen incident'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Verify Action Dialog — the check after the doing */}
      <Dialog open={verifyOpen} onClose={() => setVerifyOpen(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (verifyActionId) verifyActionMutation.mutate({ actionId: verifyActionId, data: { effectiveness: verifyForm.effectiveness, ...(verifyForm.notes.trim() ? { notes: verifyForm.notes.trim() } : {}) } }) }}>
          <DialogTitle sx={{ fontWeight: 600 }}>Verify Action</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Did the fix work? A completed action without verification blocks closure.
              </Typography>
              <TextField select label="Effectiveness" fullWidth value={verifyForm.effectiveness}
                onChange={e => setVerifyForm({ ...verifyForm, effectiveness: e.target.value })}>
                <MenuItem value="effective">Effective — fix worked</MenuItem>
                <MenuItem value="partial">Partial — helped, more needed</MenuItem>
                <MenuItem value="ineffective">Ineffective — did not work</MenuItem>
              </TextField>
              <TextField label="Verification notes (optional)" fullWidth multiline rows={2} value={verifyForm.notes}
                onChange={e => setVerifyForm({ ...verifyForm, notes: e.target.value })} />
              {verifyActionMutation.isError && <Alert severity="error">Verification failed — only a completed action can be verified; refresh and retry.</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setVerifyOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={verifyActionMutation.isPending}
              sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 600 }}>
              {verifyActionMutation.isPending ? <CircularProgress size={20} color="inherit" /> : 'Record verification'}
            </Button>
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
    </PageContainer>
  )
}
