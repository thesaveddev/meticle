import { useState, useRef, useEffect } from 'react'
import {
  Box, Typography, Paper, Stack, Chip, Button, Tabs, Tab, Avatar,
  Grid, TextField, CircularProgress, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, MenuItem, Divider,
  Menu, ListItemIcon, ListItemText, Tooltip,
} from '@mui/material'
import {
  ArrowBack, Add as AddIcon, Edit as EditIcon,
  Phone as PhoneIcon, Warning as WarningIcon,
  Delete as DeleteIcon, CameraAlt as CameraIcon, MoreVert as MoreVertIcon,
  Block as BlockIcon,
  Event as EventIcon, Note as NoteIcon, Assignment as AssignmentIcon,
  HealthAndSafety as HealthIcon, Person as PersonIcon, Upload as UploadIcon,
  CheckCircle as CheckCircleIcon, RadioButtonUnchecked as UncheckedIcon,
  People as PeopleIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useSnackbar } from '../../context/SnackbarContext'
import HealthTab from './HealthTab'
import BodyMapTab from './BodyMapTab'
import MemoryBookTab from './MemoryBookTab'
import { LinearProgress, Rating } from '@mui/material'

const RISK_COLORS: Record<string, string> = { low: '#16A34A', medium: '#D97706', high: '#DC2626', critical: '#7C3AED' }
const CATEGORY_OPTIONS = ['personal_care', 'medication', 'mobility', 'nutrition', 'mental_health', 'behaviour', 'social', 'other']
const NOTE_CATEGORIES = ['wellbeing', 'nutrition', 'hydration', 'mobility', 'mood', 'medication', 'personal_care', 'other']
const RISK_TYPES = ['falls', 'pressure_sore', 'nutrition', 'behaviour', 'mobility', 'medication', 'other']

const SUPPORT_LEVELS = [
  { value: '', label: 'None specified' },
  { value: 'independent', label: 'Independent' },
  { value: 'minimal', label: 'Minimal support' },
  { value: 'one_to_one', label: '1:1' },
  { value: 'two_to_one', label: '2:1' },
  { value: 'three_to_one', label: '3:1' },
  { value: 'complex', label: 'Complex / high dependency' },
]

const SUPPORT_LEVEL_LABELS: Record<string, string> = {
  independent: 'Independent',
  minimal: 'Minimal',
  one_to_one: '1:1',
  two_to_one: '2:1',
  three_to_one: '3:1',
  complex: 'Complex',
}

const SUPPORT_LEVEL_COLORS: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'> = {
  independent: 'success',
  minimal: 'info',
  one_to_one: 'primary',
  two_to_one: 'warning',
  three_to_one: 'error',
  complex: 'error',
}

export default function ServiceUserProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()
  const [tab, setTab] = useState(0)
  const [activeCategory, setActiveCategory] = useState(0)
  const [editOpen, setEditOpen] = useState(false)
  const [addPlanOpen, setAddPlanOpen] = useState(false)
  const [addNoteOpen, setAddNoteOpen] = useState(false)
  const [addRiskOpen, setAddRiskOpen] = useState(false)
  const [addContactOpen, setAddContactOpen] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [planForm, setPlanForm] = useState({ title: '', category: '', description: '', risk_assessment: '', review_date: '', mobility_level: '', mobility_aids: '', communication_needs: '', capacity_status: '', sleep_pattern: '', emergency_info: '', personal_goals: '', likes_dislikes: '', cultural_needs: '', file_url: '' })
  const [noteForm, setNoteForm] = useState({ note_date: new Date().toISOString().split('T')[0], shift: 'day', category: '', content: '', support_level: '' })
  const [editNoteId, setEditNoteId] = useState<string | null>(null)
  const [viewNote, setViewNote] = useState<any>(null)
  const [riskForm, setRiskForm] = useState({ type: '', risk_level: 'medium', details: '', mitigation_actions: '', review_date: '' })
  const [contactForm, setContactForm] = useState({ name: '', relationship: '', phone: '', email: '', is_emergency_contact: false })
  const [contactEditId, setContactEditId] = useState<string | null>(null)
  const [contactMenuAnchor, setContactMenuAnchor] = useState<null | { el: HTMLElement; contact: any }>(null)
  const [invitePortalOpen, setInvitePortalOpen] = useState(false)
  const [invitePortalForm, setInvitePortalForm] = useState({ name: '', email: '', relationship: '', phone: '' })
  const [invitePortalError, setInvitePortalError] = useState('')
  const [editPlanId, setEditPlanId] = useState<string | null>(null)
  const [editRiskId, setEditRiskId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: string } | null>(null)
  const [error, setError] = useState('')
  const planFileInputRef = useRef<HTMLInputElement>(null)
  const [planUploading, setPlanUploading] = useState(false)

  const CATEGORY_FIELDS: Record<string, string[]> = {
    mobility: ['mobility_level', 'mobility_aids', 'communication_needs'],
    personal_care: ['mobility_level', 'mobility_aids', 'emergency_info', 'communication_needs'],
    medication: ['emergency_info', 'communication_needs'],
    mental_health: ['capacity_status', 'communication_needs'],
    behaviour: ['capacity_status', 'communication_needs'],
    nutrition: ['communication_needs'],
    social: ['personal_goals', 'likes_dislikes', 'communication_needs'],
    other: ['mobility_level', 'mobility_aids', 'capacity_status', 'sleep_pattern', 'emergency_info', 'personal_goals', 'likes_dislikes', 'communication_needs', 'cultural_needs'],
  }

  const { data: user, isLoading } = useQuery({
    queryKey: ['service-user', id],
    queryFn: () => api.get(`/service-users/${id}`).then(r => r.data),
    enabled: !!id,
  })

  const { data: portalMembers = [] } = useQuery({
    queryKey: ['family-members', id],
    queryFn: () => api.get('/family-portal/members', { params: { service_user_id: id } }).then(r => r.data),
    enabled: !!id,
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.patch(`/service-users/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['service-user', id] }); setEditOpen(false) },
    onError: (err: any) => setError(err.response?.data?.message || 'Update failed'),
  })

  const addPlanMutation = useMutation({
    mutationFn: (data: any) => api.post(`/service-users/${id}/care-plans`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['service-user', id] }); setAddPlanOpen(false); setPlanForm({ title: '', category: '', description: '', risk_assessment: '', review_date: '', mobility_level: '', mobility_aids: '', communication_needs: '', capacity_status: '', sleep_pattern: '', emergency_info: '', personal_goals: '', likes_dislikes: '', cultural_needs: '', file_url: '' }) },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to add care plan'),
  })

  const addNoteMutation = useMutation({
    mutationFn: (data: any) => api.post(`/service-users/${id}/daily-notes`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['service-user', id] }); setAddNoteOpen(false); setNoteForm({ note_date: new Date().toISOString().split('T')[0], shift: 'day', category: '', content: '', support_level: '' }) },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to add note'),
  })

  const addRiskMutation = useMutation({
    mutationFn: (data: any) => api.post(`/service-users/${id}/risk-assessments`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['service-user', id] }); setAddRiskOpen(false); setRiskForm({ type: '', risk_level: 'medium', details: '', mitigation_actions: '', review_date: '' }) },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to add risk assessment'),
  })

  const addContactMutation = useMutation({
    mutationFn: (data: any) => api.post(`/service-users/${id}/family-contacts`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['service-user', id] }); setAddContactOpen(false); setContactForm({ name: '', relationship: '', phone: '', email: '', is_emergency_contact: false }) },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to add contact'),
  })

  const deleteContactMutation = useMutation({
    mutationFn: (contactId: string) => api.delete(`/service-users/family-contacts/${contactId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['service-user', id] }); showSnackbar('Contact removed') },
    onError: (err: any) => showSnackbar(err.response?.data?.message || 'Failed to delete contact', 'error'),
  })

  const updatePlanMutation = useMutation({
    mutationFn: ({ planId, data }: { planId: string; data: any }) => api.patch(`/service-users/care-plans/${planId}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['service-user', id] }); setEditPlanId(null); setPlanForm({ title: '', category: '', description: '', risk_assessment: '', review_date: '', mobility_level: '', mobility_aids: '', communication_needs: '', capacity_status: '', sleep_pattern: '', emergency_info: '', personal_goals: '', likes_dislikes: '', cultural_needs: '', file_url: '' }) },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to update care plan'),
  })

  const deletePlanMutation = useMutation({
    mutationFn: (planId: string) => api.delete(`/service-users/care-plans/${planId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['service-user', id] }),
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to delete care plan'),
  })

  const updateNoteMutation = useMutation({
    mutationFn: ({ noteId, data }: { noteId: string; data: any }) => api.patch(`/service-users/daily-notes/${noteId}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['service-user', id] }); setEditNoteId(null); setNoteForm({ note_date: new Date().toISOString().split('T')[0], shift: 'day', category: '', content: '', support_level: '' }) },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to update note'),
  })

  const updateRiskMutation = useMutation({
    mutationFn: ({ riskId, data }: { riskId: string; data: any }) => api.patch(`/service-users/risk-assessments/${riskId}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['service-user', id] }); setEditRiskId(null); setRiskForm({ type: '', risk_level: 'medium', details: '', mitigation_actions: '', review_date: '' }) },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to update risk assessment'),
  })

  const deleteRiskMutation = useMutation({
    mutationFn: (riskId: string) => api.delete(`/service-users/risk-assessments/${riskId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['service-user', id] }),
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to delete risk assessment'),
  })

  const updateContactMutation = useMutation({
    mutationFn: ({ contactId, data }: { contactId: string; data: any }) => api.patch(`/service-users/family-contacts/${contactId}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['service-user', id] }); setContactEditId(null); setContactForm({ name: '', relationship: '', phone: '', email: '', is_emergency_contact: false }) },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to update contact'),
  })

  const inviteFromContactMutation = useMutation({
    mutationFn: (data: any) => api.post('/family-portal/members', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['family-members', id] }); setInvitePortalOpen(false); setInvitePortalForm({ name: '', email: '', relationship: '', phone: '' }); showSnackbar('Portal invitation sent successfully') },
    onError: (err: any) => setInvitePortalError(err?.response?.data?.error?.message || 'Failed to send invite'),
  })

  const inlineInvitePortalMutation = useMutation({
    mutationFn: (data: any) => api.post('/family-portal/members', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['family-members', id] }); showSnackbar('Portal invitation sent successfully') },
    onError: (err: any) => setError(err?.response?.data?.error?.message || 'Failed to send invite'),
  })

  const inlineCancelInviteMutation = useMutation({
    mutationFn: (memberId: string) => api.post(`/family-portal/members/${memberId}/revoke`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['family-members', id] }); showSnackbar('Invitation cancelled') },
    onError: (err: any) => setError(err?.response?.data?.error?.message || 'Failed to cancel invite'),
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState('')

  const uploadPhotoMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('photo', file)
      return api.post(`/service-users/${id}/photo`, fd)
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['service-user', id] })
      setPhotoError('')
      if (res.data?.url) {
        loadPhotoToBlob(res.data.url)
      }
    },
    onError: (err: any) => setPhotoError(err.response?.data?.message || err.message || 'Upload failed'),
  })

  const loadPhotoToBlob = async (url: string) => {
    try {
      const token = localStorage.getItem('accessToken')
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Failed to load photo')
      const blob = await res.blob()
      const oldUrl = photoUrl
      setPhotoUrl(URL.createObjectURL(blob))
      if (oldUrl) URL.revokeObjectURL(oldUrl)
    } catch { /* silently fall back to initials */ }
  }

  useEffect(() => {
    if (user?.photo_url) {
      loadPhotoToBlob(user.photo_url)
    }
    return () => { if (photoUrl) URL.revokeObjectURL(photoUrl) }
  }, [user?.photo_url])

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /></Box>
  if (!user) return <Alert severity="error">Resident not found</Alert>

  const CATEGORIES = [
    { label: 'Overview', tabs: [0] },
    { label: 'Care', tabs: [2, 3, 4, 9, 10, 17] },
    { label: 'Clinical', tabs: [6, 12, 14, 19] },
    { label: 'People', tabs: [5, 15] },
    { label: 'Safety', tabs: [7, 16, 11] },
    { label: 'Records', tabs: [13, 8, 1, 18, 20] },
  ]
  const TAB_LABELS: Record<number, string> = {
    0: 'Overview', 1: 'Timeline', 2: 'Care Plans', 3: 'Daily Notes', 4: 'Risk Assessments',
    5: 'Family & Contacts', 6: 'Health', 7: 'Body Map', 8: 'Memory Book', 9: 'Goals',
    10: 'Care Assessments', 11: 'Room Checks', 12: 'Clinical Scores', 13: 'Documents',
    14: 'Wellbeing', 15: 'Communication', 16: 'MCA/Capacity', 17: 'Care Pathways',
    18: 'Discharge', 19: 'Mood Chart', 20: 'Audit Trail',
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/service-users')} sx={{ color: '#6B7280', textTransform: 'none', fontWeight: 600 }}>
          Back to Residents
        </Button>
      </Stack>

      {/* Profile Header */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 2.5, border: '1px solid #E5E7EB', background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'flex-start' }} spacing={2}>
          <Stack direction="row" spacing={2.5} alignItems="center">
            {/* Photo */}
            <Box sx={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }} onClick={() => fileInputRef.current?.click()}>
              <Avatar src={photoUrl || undefined}
                sx={{ width: 72, height: 72, bgcolor: '#0F4C81', fontSize: 28, fontWeight: 700, border: '3px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
                {!photoUrl && `${user.first_name?.[0]}${user.last_name?.[0]}`}
              </Avatar>
              {uploadPhotoMutation.isPending && (
                <CircularProgress size={72} sx={{ position: 'absolute', top: 0, left: 0, color: '#0F4C81', opacity: 0.5 }} />
              )}
              <Box sx={{ position: 'absolute', bottom: 0, right: 0, bgcolor: '#0F4C81', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>
                <CameraIcon sx={{ fontSize: 13, color: 'white' }} />
              </Box>
            </Box>
            <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhotoMutation.mutate(f); e.target.value = '' }} />
            {photoError && <Alert severity="error" sx={{ mt: 0.5, borderRadius: 1, position: 'absolute', top: 0, right: 0 }}>{photoError}</Alert>}

            {/* Name & Info */}
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2 }}>{user.first_name} {user.last_name}</Typography>
                <Chip label={user.status} size="small" color={user.status === 'active' ? 'success' : user.status === 'discharged' ? 'default' : 'error'} sx={{ height: 22, fontWeight: 700 }} />
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.75 }}>
                {user.room_number && <Chip icon={<EventIcon sx={{ fontSize: 13 }} />} label={`Room ${user.room_number}`} size="small" variant="outlined" sx={{ borderRadius: 1 }} />}
                {user.nhs_number && <Chip label={`NHS: ${user.nhs_number}`} size="small" variant="outlined" sx={{ borderRadius: 1 }} />}
                {user.gender && <Chip label={user.gender} size="small" variant="outlined" sx={{ borderRadius: 1 }} />}
                {user.pronouns && <Chip label={user.pronouns} size="small" variant="outlined" sx={{ borderRadius: 1, borderStyle: 'dashed' }} />}
                {user.funding_type && <Chip label={user.funding_type.replace(/_/g, ' ')} size="small" color="info" variant="outlined" sx={{ borderRadius: 1 }} />}
                {user.support_level && SUPPORT_LEVEL_LABELS[user.support_level] && (
                  <Chip label={SUPPORT_LEVEL_LABELS[user.support_level]} size="small" color={SUPPORT_LEVEL_COLORS[user.support_level] || 'default'} sx={{ borderRadius: 1 }} />
                )}
              </Stack>
              {user.date_of_birth && (
                <Typography variant="caption" color="#6B7280">
                  DOB: {new Date(user.date_of_birth).toLocaleDateString('en-GB')}
                  {user.date_of_birth && ` (${Math.floor((Date.now() - new Date(user.date_of_birth).getTime()) / 31557600000)} yrs)`}
                </Typography>
              )}
            </Box>
          </Stack>
          <Button startIcon={<EditIcon />} variant="outlined" size="small" onClick={() => { setEditForm({ ...user }); setEditOpen(true) }}
            sx={{ textTransform: 'none', borderRadius: 1.5, whiteSpace: 'nowrap' }}>
            Edit Profile
          </Button>
        </Stack>
      </Paper>

      {/* Flags / Alerts Banner (visible on every tab) */}
      {user.flags && user.flags.length > 0 && (
        <Paper sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: '#FEF2F2', border: '1px solid #FECACA' }}>
          <Typography variant="subtitle2" fontWeight={800} color="#DC2626" sx={{ mb: 1 }}>
            ⚠ Clinical Alerts
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {user.flags.map((f: string) => (
              <Chip key={f} label={f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} size="small"
                color="error" variant="filled" sx={{ fontWeight: 700 }} />
            ))}
          </Stack>
        </Paper>
      )}

      {/* DNACPR Banner */}
      {user.dnacpr_status === 'in_place' && (
        <Paper sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: '#FFF7ED', border: '1px solid #FED7AA' }}>
          <Typography variant="subtitle2" fontWeight={800} color="#EA580C" sx={{ mb: 0.5 }}>
            DNACPR in place
          </Typography>
          {user.dnacpr_date && <Typography variant="caption" color="#9A3412">Recorded: {new Date(user.dnacpr_date).toLocaleDateString('en-GB')}</Typography>}
          {user.dnacpr_review_date && <Typography variant="caption" color="#9A3412" sx={{ ml: 2 }}>Next review: {new Date(user.dnacpr_review_date).toLocaleDateString('en-GB')}</Typography>}
        </Paper>
      )}

      {/* Tags */}
      {user.tags && user.tags.length > 0 && (
        <Stack direction="row" spacing={0.5} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
          {user.tags.map((t: string) => (
            <Chip key={t} label={t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} size="small"
              variant="outlined" color="primary" />
          ))}
        </Stack>
      )}

      {/* Category Navigation */}
      <Paper sx={{ mb: 2, borderRadius: 2, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <Stack direction="row" sx={{ bgcolor: '#F9FAFB', px: 1, py: 0.5, borderBottom: '1px solid #E5E7EB' }}>
          {CATEGORIES.map((cat, i) => (
            <Box key={cat.label}
              onClick={() => { setActiveCategory(i); setTab(cat.tabs[0]) }}
              sx={{
                px: 1.5, py: 0.75, cursor: 'pointer', borderRadius: 1.5,
                bgcolor: activeCategory === i ? '#0F4C81' : 'transparent',
                color: activeCategory === i ? 'white' : '#374151',
                fontWeight: 700, fontSize: 12, textTransform: 'none',
                transition: 'all 0.15s',
                '&:hover': { bgcolor: activeCategory === i ? '#0F4C81' : '#E5E7EB' },
              }}>
              {cat.label}
            </Box>
          ))}
        </Stack>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 40, '& .MuiTabs-indicator': { bgcolor: '#0F4C81', height: 3 } }}>
          {CATEGORIES[activeCategory].tabs.map(idx => (
            <Tab key={idx} value={idx} label={TAB_LABELS[idx]}
              sx={{ textTransform: 'none', fontWeight: 700, fontSize: 13, minHeight: 40, py: 1, px: 2 }} />
          ))}
        </Tabs>
      </Paper>

      {/* Tab: Overview */}
      {tab === 0 && (
        <Box>
        <Grid container spacing={2.5}>
          {/* Personal Details */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid #E5E7EB', '&:hover': { boxShadow: '0 1px 6px rgba(0,0,0,0.06)' } }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <PersonIcon sx={{ fontSize: 18, color: '#0F4C81' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Personal Details</Typography>
              </Stack>
              <Stack spacing={1}>
                {[{ label: 'DOB', value: user.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString('en-GB') + ' (' + Math.floor((Date.now() - new Date(user.date_of_birth).getTime()) / 31557600000) + ' yrs)' : '—' },
                  { label: 'Gender', value: user.gender || '—' },
                  { label: 'Pronouns', value: user.pronouns || '—' },
                  { label: 'Marital Status', value: user.marital_status ? user.marital_status.replace(/_/g, ' ') : '—' },
                  { label: 'Religion / Faith', value: user.religion || '—' },
                  { label: 'NHS Number', value: user.nhs_number || '—' },
                  { label: 'Room', value: user.room_number || '—' },
                ].map((r, i) => (
                  <Stack key={r.label} direction="row" justifyContent="space-between" sx={{ borderBottom: i < 6 ? '1px solid #F3F4F6' : 'none', pb: i < 6 ? 0.75 : 0 }}>
                    <Typography variant="body2" color="#6B7280">{r.label}</Typography>
                    <Typography variant="body2" fontWeight={600}>{r.value}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          </Grid>

          {/* Medical & GP */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid #E5E7EB', '&:hover': { boxShadow: '0 1px 6px rgba(0,0,0,0.06)' } }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <HealthIcon sx={{ fontSize: 18, color: '#16A34A' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Medical &amp; GP</Typography>
              </Stack>
              <Stack spacing={1}>
                {[{ label: 'GP Name', value: user.gp_name || '—' },
                  { label: 'GP Surgery', value: user.gp_surgery || '—' },
                  { label: 'GP Phone', value: user.gp_phone || '—' },
                  { label: 'GP Email', value: user.gp_email || '—', isLong: true },
                  { label: 'GP Address', value: user.gp_address || '—', isLong: true },
                  { label: 'Dietary', value: user.dietary_requirements || 'None specified' },
                ].map((r: any, i) => (
                  <Stack key={r.label} direction="row" justifyContent="space-between" sx={{ borderBottom: i < 5 ? '1px solid #F3F4F6' : 'none', pb: i < 5 ? 0.75 : 0 }}>
                    <Typography variant="body2" color="#6B7280" sx={{ flexShrink: 0, mr: 1 }}>{r.label}</Typography>
                    <Typography variant="body2" fontWeight={600} textAlign="right" sx={r.isLong ? { maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : {}}>{r.value}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          </Grid>

          {/* Pharmacy */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid #E5E7EB', '&:hover': { boxShadow: '0 1px 6px rgba(0,0,0,0.06)' } }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <AssignmentIcon sx={{ fontSize: 18, color: '#7C3AED' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Pharmacy</Typography>
              </Stack>
              <Stack spacing={1}>
                {[{ label: 'Pharmacy Name', value: user.pharmacy_name || '—' },
                  { label: 'Phone', value: user.pharmacy_phone || '—' },
                  { label: 'Address', value: user.pharmacy_address || '—', isLong: true },
                ].map((r: any, i) => (
                  <Stack key={r.label} direction="row" justifyContent="space-between" sx={{ borderBottom: i < 2 ? '1px solid #F3F4F6' : 'none', pb: i < 2 ? 0.75 : 0 }}>
                    <Typography variant="body2" color="#6B7280">{r.label}</Typography>
                    <Typography variant="body2" fontWeight={600} sx={r.isLong ? { maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : {}}>{r.value}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          </Grid>

          {/* Social Worker */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid #E5E7EB', '&:hover': { boxShadow: '0 1px 6px rgba(0,0,0,0.06)' } }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <PersonIcon sx={{ fontSize: 18, color: '#D97706' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Social Worker</Typography>
              </Stack>
              <Stack spacing={1}>
                {[{ label: 'Name', value: user.social_worker_name || '—' },
                  { label: 'Phone', value: user.social_worker_phone || '—' },
                  { label: 'Email', value: user.social_worker_email || '—', isLong: true },
                ].map((r: any, i) => (
                  <Stack key={r.label} direction="row" justifyContent="space-between" sx={{ borderBottom: i < 2 ? '1px solid #F3F4F6' : 'none', pb: i < 2 ? 0.75 : 0 }}>
                    <Typography variant="body2" color="#6B7280">{r.label}</Typography>
                    <Typography variant="body2" fontWeight={600} sx={r.isLong ? { maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : {}}>{r.value}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          </Grid>

          {/* Communication */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid #E5E7EB', '&:hover': { boxShadow: '0 1px 6px rgba(0,0,0,0.06)' } }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <NoteIcon sx={{ fontSize: 18, color: '#0F4C81' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Communication</Typography>
              </Stack>
              <Stack spacing={1}>
                {[{ label: 'Language', value: user.communication_language || 'English' },
                  { label: 'Interpreter', value: user.communication_interpreter ? 'Required' : 'Not required' },
                  { label: 'Preferred Method', value: user.communication_method ? user.communication_method.replace(/_/g, ' ') : '—' },
                ].map((r, i) => (
                  <Stack key={r.label} direction="row" justifyContent="space-between" sx={{ borderBottom: i < 2 ? '1px solid #F3F4F6' : 'none', pb: i < 2 ? 0.75 : 0 }}>
                    <Typography variant="body2" color="#6B7280">{r.label}</Typography>
                    <Typography variant="body2" fontWeight={600}>{r.value}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          </Grid>

          {/* Admission & Funding */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid #E5E7EB', '&:hover': { boxShadow: '0 1px 6px rgba(0,0,0,0.06)' } }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <EventIcon sx={{ fontSize: 18, color: '#16A34A' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Admission &amp; Funding</Typography>
              </Stack>
              <Stack spacing={1}>
                {[{ label: 'Admission Date', value: user.admission_date ? new Date(user.admission_date).toLocaleDateString('en-GB') : '—' },
                  { label: 'Admitted From', value: user.admission_source || '—' },
                  { label: 'Funding Type', value: user.funding_type ? user.funding_type.replace(/_/g, ' ') : '—' },
                  ...(user.funding_details ? [{ label: 'Funding Details', value: user.funding_details }] : []),
                ].map((r: any) => (
                  <Stack key={r.label} direction="row" justifyContent="space-between" sx={{ borderBottom: '1px solid #F3F4F6', pb: 0.75 }}>
                    <Typography variant="body2" color="#6B7280">{r.label}</Typography>
                    <Typography variant="body2" fontWeight={600}>{r.value}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          </Grid>

          {/* Allergies */}
          {user.allergies?.length > 0 && (
            <Grid item xs={12}>
              <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid #FECACA', bgcolor: '#FEF2F2' }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                  <WarningIcon sx={{ fontSize: 18, color: '#DC2626' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#DC2626' }}>Allergies</Typography>
                </Stack>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {user.allergies.map((a: string, i: number) => <Chip key={i} label={a} size="small" color="error" variant="filled" sx={{ fontWeight: 700 }} />)}
                </Stack>
              </Paper>
            </Grid>
          )}

          {/* DNACPR & Advance Decision */}
          {(user.dnacpr_status || user.advance_decision) && (
            <>
              {user.dnacpr_status && (
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid #FED7AA', bgcolor: user.dnacpr_status === 'in_place' ? '#FFF7ED' : '#F9FAFB' }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <WarningIcon sx={{ fontSize: 18, color: user.dnacpr_status === 'in_place' ? '#EA580C' : '#6B7280' }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: user.dnacpr_status === 'in_place' ? '#EA580C' : '#6B7280' }}>
                        DNACPR — {user.dnacpr_status === 'in_place' ? 'In Place' : user.dnacpr_status === 'not_in_place' ? 'Not in Place' : 'Discussed'}
                      </Typography>
                    </Stack>
                    {user.dnacpr_date && <Typography variant="caption" color="#6B7280">Recorded: {new Date(user.dnacpr_date).toLocaleDateString('en-GB')}</Typography>}
                    {user.dnacpr_review_date && <Typography variant="caption" color="#6B7280" sx={{ ml: 2 }}>Review: {new Date(user.dnacpr_review_date).toLocaleDateString('en-GB')}</Typography>}
                    {user.dnacpr_details && <Typography variant="body2" sx={{ mt: 1, color: '#6B7280' }}>{user.dnacpr_details}</Typography>}
                  </Paper>
                </Grid>
              )}
              {user.advance_decision && (
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid #E9D5FF', bgcolor: '#FAF5FF' }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <NoteIcon sx={{ fontSize: 18, color: '#7C3AED' }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#7C3AED' }}>Advance Decision / Living Will</Typography>
                    </Stack>
                    {user.advance_decision_date && <Typography variant="caption" color="#6B7280">Signed: {new Date(user.advance_decision_date).toLocaleDateString('en-GB')}</Typography>}
                    <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>{user.advance_decision}</Typography>
                  </Paper>
                </Grid>
              )}
            </>
          )}

          {/* Discharge Summary */}
          {user.discharge_date && (
            <Grid item xs={12}>
              <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid #E5E7EB', bgcolor: '#F9FAFB' }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                  <NoteIcon sx={{ fontSize: 18, color: '#6B7280' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#6B7280' }}>Discharge Summary</Typography>
                </Stack>
                <Stack spacing={0.5}>
                  <Stack direction="row" spacing={2}>
                    <Typography variant="caption" color="#6B7280">Discharged: {new Date(user.discharge_date).toLocaleDateString('en-GB')}</Typography>
                    {user.discharge_destination && <Typography variant="caption" color="#6B7280">To: {user.discharge_destination.replace(/_/g, ' ')}</Typography>}
                    {user.discharge_reason && <Typography variant="caption" color="#6B7280">Reason: {user.discharge_reason}</Typography>}
                  </Stack>
                  {user.discharge_summary && <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>{user.discharge_summary}</Typography>}
                </Stack>
              </Paper>
            </Grid>
          )}
          </Grid>
        </Box>
      )}

      {/* Tab: Timeline */}
      {tab === 1 && <TimelineTab serviceUserId={id!} />}

      {/* Tab: Care Plans */}
      {tab === 2 && (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Care Plans</Typography>
            <Button size="small" variant="contained" startIcon={<AddIcon />}
              onClick={() => { setPlanForm({ title: '', category: '', description: '', risk_assessment: '', review_date: '', mobility_level: '', mobility_aids: '', communication_needs: '', capacity_status: '', sleep_pattern: '', emergency_info: '', personal_goals: '', likes_dislikes: '', cultural_needs: '', file_url: '' }); setEditPlanId(null); setAddPlanOpen(true) }}
              sx={{ bgcolor: '#0F4C81', textTransform: 'none', borderRadius: 1.5, px: 2 }}>Add Care Plan</Button>
          </Stack>
          {(!user.care_plans || user.care_plans.length === 0) ? (
            <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB' }}>
              <AssignmentIcon sx={{ fontSize: 40, color: '#D1D5DB', mb: 1 }} />
              <Typography color="#9CA3AF">No care plans yet</Typography>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {user.care_plans.map((cp: any) => {
                const isOverdue = cp.review_date && new Date(cp.review_date) < new Date()
                return (
                <Grid item xs={12} md={6} key={cp.id}>
                  <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid #E5E7EB', borderLeft: 4, borderLeftColor: cp.status === 'active' ? '#0F4C81' : '#9CA3AF', transition: 'box-shadow 0.15s', '&:hover': { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                          <Typography variant="subtitle2" fontWeight={700}>{cp.title}</Typography>
                          <Chip label={cp.category?.replace(/_/g, ' ')} size="small" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                        </Stack>
                        {cp.description && <Typography variant="body2" color="#6B7280" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{cp.description}</Typography>}
                      </Box>
                      <Stack direction="row" spacing={0.5} sx={{ ml: 1, flexShrink: 0 }}>
                        <IconButton size="small" onClick={() => { setPlanForm({ title: cp.title, category: cp.category, description: cp.description || '', risk_assessment: cp.risk_assessment || '', review_date: cp.review_date || '', mobility_level: cp.mobility_level || '', mobility_aids: cp.mobility_aids || '', communication_needs: cp.communication_needs || '', capacity_status: cp.capacity_status || '', sleep_pattern: cp.sleep_pattern || '', emergency_info: cp.emergency_info || '', personal_goals: cp.personal_goals || '', likes_dislikes: cp.likes_dislikes || '', cultural_needs: cp.cultural_needs || '', file_url: cp.file_url || '' }); setEditPlanId(cp.id); setAddPlanOpen(true) }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => setDeleteConfirm({ type: 'plan', id: cp.id })}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Stack>
                    <Stack direction="row" flexWrap="wrap" spacing={0.5} useFlexGap sx={{ mt: 1.5 }}>
                      {cp.mobility_level && <Chip label={`Mobility: ${cp.mobility_level.replace(/_/g, ' ')}`} size="small" variant="outlined" sx={{ height: 22, fontSize: 11 }} />}
                      {cp.capacity_status && <Chip label={`Capacity: ${cp.capacity_status.replace(/_/g, ' ')}`} size="small" variant="outlined" sx={{ height: 22, fontSize: 11 }} />}
                      {cp.personal_goals && <Chip label="Goals set" size="small" color="primary" variant="outlined" sx={{ height: 22, fontSize: 11 }} />}
                      {cp.cultural_needs && <Chip label="Cultural needs" size="small" color="secondary" variant="outlined" sx={{ height: 22, fontSize: 11 }} />}
                      {cp.file_url && <Chip label="File uploaded" size="small" color="info" variant="outlined" sx={{ height: 22, fontSize: 11 }} />}
                    </Stack>
                    {cp.review_date && (
                      <Typography variant="caption" sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 0.5, color: isOverdue ? '#DC2626' : '#9CA3AF' }}>
                        {isOverdue ? <WarningIcon sx={{ fontSize: 13 }} /> : null}
                        Review: {new Date(cp.review_date).toLocaleDateString('en-GB')} {isOverdue ? '(overdue)' : ''}
                      </Typography>
                    )}
                  </Paper>
                </Grid>
              )})}
            </Grid>
          )}
        </Box>
      )}

      {/* Tab: Daily Notes */}
      {tab === 3 && (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Daily Notes</Typography>
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => { setNoteForm({ note_date: new Date().toISOString().split('T')[0], shift: 'day', category: '', content: '', support_level: '' }); setEditNoteId(null); setAddNoteOpen(true) }}
              sx={{ bgcolor: '#0F4C81', textTransform: 'none', borderRadius: 1.5, px: 2 }}>Add Note</Button>
          </Stack>
          {(!user.recent_notes || user.recent_notes.length === 0) ? (
            <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB' }}>
              <NoteIcon sx={{ fontSize: 40, color: '#D1D5DB', mb: 1 }} />
              <Typography color="#9CA3AF">No daily notes yet</Typography>
            </Paper>
          ) : (
            <Stack spacing={1.5}>
              {user.recent_notes.map((n: any) => (
                <Paper key={n.id} sx={{ p: 2.5, borderRadius: 2, border: '1px solid #E5E7EB', borderLeft: 4, borderLeftColor: n.shift === 'night' ? '#1E293B' : n.shift === 'evening' ? '#D97706' : '#0F4C81', cursor: 'pointer', transition: 'all 0.15s', '&:hover': { boxShadow: '0 2px 10px rgba(0,0,0,0.08)', borderColor: '#D1D5DB' } }} onClick={() => setViewNote(n)}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 0.75 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip label={n.shift} size="small" color={n.shift === 'day' ? 'primary' : 'default'}
                        sx={{ textTransform: 'capitalize', fontWeight: 700, height: 22, fontSize: 11 }} />
                      <Chip label={n.category?.replace(/_/g, ' ')} size="small" variant="outlined"
                        sx={{ textTransform: 'capitalize', height: 22, fontSize: 11 }} />
                      {n.support_level && SUPPORT_LEVEL_LABELS[n.support_level] && (
                        <Chip label={SUPPORT_LEVEL_LABELS[n.support_level]} size="small" color={SUPPORT_LEVEL_COLORS[n.support_level] || 'default'}
                          sx={{ height: 20, fontSize: 10 }} />
                      )}
                      <Typography variant="caption" color="#6B7280">{n.note_date ? new Date(n.note_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</Typography>
                    </Stack>
                    <Typography variant="caption" color="#9CA3AF" sx={{ fontWeight: 500 }}>{n.author_name || ''}</Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: '#374151', lineHeight: 1.6 }}>{n.content}</Typography>
                </Paper>
              ))}
            </Stack>
          )}
        </Box>
      )}

      {/* Tab: Risk Assessments */}
      {tab === 4 && (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Risk Assessments</Typography>
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setAddRiskOpen(true)}
              sx={{ bgcolor: '#0F4C81', textTransform: 'none', borderRadius: 1.5, px: 2 }}>Add Assessment</Button>
          </Stack>
          {(!user.risk_assessments || user.risk_assessments.length === 0) ? (
            <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB' }}>
              <WarningIcon sx={{ fontSize: 40, color: '#D1D5DB', mb: 1 }} />
              <Typography color="#9CA3AF">No risk assessments</Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #E5E7EB' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#F9FAFB' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Risk Level</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Details</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Review Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {user.risk_assessments.map((ra: any) => (
                    <TableRow key={ra.id} sx={{ '&:hover': { bgcolor: '#F9FAFB' } }}>
                      <TableCell sx={{ textTransform: 'capitalize', fontWeight: 600 }}>{ra.type?.replace(/_/g, ' ')}</TableCell>
                      <TableCell>
                        <Chip icon={<WarningIcon sx={{ fontSize: 14 }} />} label={ra.risk_level} size="small"
                          sx={{ bgcolor: `${RISK_COLORS[ra.risk_level] || '#6B7280'}18`, color: RISK_COLORS[ra.risk_level] || '#6B7280', fontWeight: 700, textTransform: 'capitalize' }} />
                      </TableCell>
                      <TableCell><Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>{ra.details || '—'}</Typography></TableCell>
                      <TableCell>{ra.review_date ? new Date(ra.review_date).toLocaleDateString('en-GB') : '—'}</TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => { setRiskForm({ type: ra.type, risk_level: ra.risk_level, details: ra.details || '', mitigation_actions: ra.mitigation_actions || '', review_date: ra.review_date || '' }); setEditRiskId(ra.id); setAddRiskOpen(true) }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => setDeleteConfirm({ type: 'risk', id: ra.id })}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* Tab: Family & Contacts (with portal access status) */}
      {tab === 5 && (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={800}>Family & Contacts</Typography>
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => { setContactForm({ name: '', relationship: '', phone: '', email: '', is_emergency_contact: false }); setAddContactOpen(true) }}
              sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>Add Contact</Button>
          </Stack>

          {(!user.family_contacts || user.family_contacts.length === 0) ? (
            <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB', mb: 3 }}>
              <Typography color="#9CA3AF">No family contacts added</Typography>
            </Paper>
          ) : (
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {user.family_contacts.map((fc: any) => {
                const portalMember = portalMembers.find((pm: any) => pm.email?.toLowerCase() === fc.email?.toLowerCase())
                return (
                  <Grid item xs={12} md={6} key={fc.id}>
                    <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid #E5E7EB', borderLeft: 4, borderLeftColor: fc.is_emergency_contact ? '#DC2626' : '#0F4C81' }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Typography variant="subtitle2" fontWeight={700}>{fc.name}</Typography>
                          <Stack direction="row" spacing={1} alignItems="center">
                            {fc.relationship && <Typography variant="caption" color="#6B7280">{fc.relationship}</Typography>}
                            {fc.is_emergency_contact && <Chip label="Emergency" size="small" color="error" />}
                            {fc.email && <Typography variant="caption" color="#9CA3AF" sx={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fc.email}</Typography>}
                          </Stack>
                        </Box>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          {(() => {
                            const tooltip = !portalMember ? 'Not invited to Family Portal'
                              : portalMember.status === 'active' ? 'Portal access active'
                              : portalMember.status === 'invited' ? 'Portal invite pending'
                              : portalMember.status === 'revoked' ? 'Portal access revoked'
                              : 'Portal access inactive'
                            const iconColor = portalMember?.status === 'active' ? '#16A34A'
                              : portalMember?.status === 'invited' ? '#D97706'
                              : portalMember?.status === 'revoked' ? '#DC2626'
                              : portalMember?.status === 'inactive' ? '#6B7280'
                              : '#9CA3AF'
                            return (
                              <Tooltip title={tooltip}>
                                <PeopleIcon fontSize="small" sx={{ color: iconColor }} />
                              </Tooltip>
                            )
                          })()}
                          <IconButton size="small" onClick={e => setContactMenuAnchor({ el: e.currentTarget, contact: fc })}>
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Stack>
                      <Stack spacing={0.5} sx={{ mt: 1 }}>
                        {fc.phone && <Stack direction="row" spacing={1} alignItems="center"><PhoneIcon sx={{ fontSize: 14, color: '#6B7280' }} /><Typography variant="body2">{fc.phone}</Typography></Stack>}
                      </Stack>
                    </Paper>
                  </Grid>
                )
              })}
            </Grid>
          )}

          {/* Contact context menu */}
          <Menu anchorEl={contactMenuAnchor?.el} open={!!contactMenuAnchor} onClose={() => setContactMenuAnchor(null)}>
            <MenuItem onClick={() => { const c = contactMenuAnchor?.contact; if (c) { setContactForm({ name: c.name, relationship: c.relationship || '', phone: c.phone || '', email: c.email || '', is_emergency_contact: c.is_emergency_contact }); setContactEditId(c.id); setAddContactOpen(true) } setContactMenuAnchor(null) }}>
              <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon><ListItemText>Edit</ListItemText>
            </MenuItem>
            {(() => {
              const c = contactMenuAnchor?.contact
              if (!c || !c.email) return null
              const pm = portalMembers.find((p: any) => p.email?.toLowerCase() === c.email?.toLowerCase())
              if (!pm || pm.status === 'revoked') {
                return (
                  <MenuItem onClick={() => {
                    inlineInvitePortalMutation.mutate({ name: c.name, email: c.email, relationship: c.relationship || '', phone: c.phone || '', service_user_id: id })
                    setContactMenuAnchor(null)
                  }} disabled={inlineInvitePortalMutation.isPending}>
                    <ListItemIcon><PeopleIcon fontSize="small" sx={{ color: '#0F4C81' }} /></ListItemIcon><ListItemText>Invite to Family Portal</ListItemText>
                  </MenuItem>
                )
              }
              if (pm.status === 'active' || pm.status === 'invited') {
                return (
                  <MenuItem onClick={() => { inlineCancelInviteMutation.mutate(pm.id); setContactMenuAnchor(null) }} disabled={inlineCancelInviteMutation.isPending}>
                    <ListItemIcon><BlockIcon fontSize="small" color="warning" /></ListItemIcon><ListItemText sx={{ color: '#D97706' }}>Revoke Portal Access</ListItemText>
                  </MenuItem>
                )
              }
              return null
            })()}
            <MenuItem onClick={() => { const c = contactMenuAnchor?.contact; if (c) deleteContactMutation.mutate(c.id); setContactMenuAnchor(null) }}>
              <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon><ListItemText sx={{ color: '#DC2626' }}>Delete</ListItemText>
            </MenuItem>
          </Menu>
        </Box>
      )}

      {/* Tab: Health */}
      {tab === 6 && <HealthTab serviceUserId={id!} />}

      {/* Tab: Body Map */}
      {tab === 7 && <BodyMapTab serviceUserId={id!} />}

      {/* Tab: Memory Book */}
      {tab === 8 && <MemoryBookTab serviceUserId={id!} />}

      {/* Tab: Goals */}
      {tab === 9 && <GoalsTabInline serviceUserId={id!} />}

      {/* Tab: Care Assessments */}
      {tab === 10 && <CareAssessmentsTabInline serviceUserId={id!} />}

      {/* Tab: Room Checks */}
      {tab === 11 && <RoomChecksTab roomNumber={user.room_number} />}

      {/* Tab: Clinical Scores */}
      {tab === 12 && <ClinicalScoresTab serviceUserId={id!} />}

      {/* Tab: Documents */}
      {tab === 13 && <DocumentsTab serviceUserId={id!} />}

      {/* Tab: Wellbeing */}
      {tab === 14 && <WellbeingTabInline serviceUserId={id!} />}

      {/* Tab: Communication Log */}
      {tab === 15 && <CommunicationLogTabInline serviceUserId={id!} />}

      {/* Tab: MCA / Capacity */}
      {tab === 16 && <CapacityMcaTabInline serviceUserId={id!} />}

      {/* Tab: Care Pathways */}
      {tab === 17 && <CarePathwaysTabInline serviceUserId={id!} />}

      {/* Tab: Discharge Checklist */}
      {tab === 18 && <DischargeChecklistTabInline serviceUserId={id!} />}

      {/* Tab: Mood Chart */}
      {tab === 19 && <MoodChartTabInline serviceUserId={id!} />}

      {/* Tab: Audit Trail */}
      {tab === 20 && <AuditTrailTabInline serviceUserId={id!} />}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); updateMutation.mutate(editForm) }}>
          <DialogTitle sx={{ fontWeight: 800 }}>Edit Resident</DialogTitle>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack direction="row" spacing={1}>
                <TextField label="First Name" fullWidth value={editForm.first_name || ''} onChange={e => setEditForm({ ...editForm, first_name: e.target.value })} />
                <TextField label="Last Name" fullWidth value={editForm.last_name || ''} onChange={e => setEditForm({ ...editForm, last_name: e.target.value })} />
              </Stack>
              <TextField label="Date of Birth" type="date" fullWidth InputLabelProps={{ shrink: true }} value={editForm.date_of_birth || ''} onChange={e => setEditForm({ ...editForm, date_of_birth: e.target.value })} />
              <Stack direction="row" spacing={1}>
                <TextField label="NHS Number" fullWidth value={editForm.nhs_number || ''} onChange={e => setEditForm({ ...editForm, nhs_number: e.target.value })} />
                <TextField label="Room" fullWidth value={editForm.room_number || ''} onChange={e => setEditForm({ ...editForm, room_number: e.target.value })} />
              </Stack>
              <TextField select label="Status" fullWidth value={editForm.status || 'active'} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="discharged">Discharged</MenuItem>
                <MenuItem value="deceased">Deceased</MenuItem>
              </TextField>
              <Divider />
              <Typography variant="subtitle2" fontWeight={700}>GP Details</Typography>
              <TextField label="GP Name" fullWidth value={editForm.gp_name || ''} onChange={e => setEditForm({ ...editForm, gp_name: e.target.value })} />
              <TextField label="GP Surgery" fullWidth value={editForm.gp_surgery || ''} onChange={e => setEditForm({ ...editForm, gp_surgery: e.target.value })} />
              <TextField label="GP Phone" fullWidth value={editForm.gp_phone || ''} onChange={e => setEditForm({ ...editForm, gp_phone: e.target.value })} />
              <TextField label="GP Email" fullWidth value={editForm.gp_email || ''} onChange={e => setEditForm({ ...editForm, gp_email: e.target.value })} />
              <TextField label="GP Address" fullWidth multiline rows={2} value={editForm.gp_address || ''} onChange={e => setEditForm({ ...editForm, gp_address: e.target.value })} />
              <TextField label="Dietary Requirements" fullWidth multiline rows={2} value={editForm.dietary_requirements || ''} onChange={e => setEditForm({ ...editForm, dietary_requirements: e.target.value })} />
              <TextField label="Allergies (comma-separated)" fullWidth value={Array.isArray(editForm.allergies) ? editForm.allergies.join(', ') : editForm.allergies || ''} onChange={e => setEditForm({ ...editForm, allergies: e.target.value.split(',').map((a: string) => a.trim()).filter(Boolean) })} />
              <Divider />
              <Typography variant="subtitle2" fontWeight={700}>Personal Details</Typography>
              <Stack direction="row" spacing={1}>
                <TextField select label="Gender" fullWidth value={editForm.gender || ''} onChange={e => setEditForm({ ...editForm, gender: e.target.value })}>
                  <MenuItem value="">— Not specified —</MenuItem>
                  <MenuItem value="Male">Male</MenuItem>
                  <MenuItem value="Female">Female</MenuItem>
                  <MenuItem value="Non-binary">Non-binary</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                  <MenuItem value="Prefer not to say">Prefer not to say</MenuItem>
                </TextField>
                <TextField label="Pronouns" fullWidth placeholder="e.g. she/her, he/him, they/them" value={editForm.pronouns || ''} onChange={e => setEditForm({ ...editForm, pronouns: e.target.value })} />
              </Stack>
              <Stack direction="row" spacing={1}>
                <TextField select label="Marital Status" fullWidth value={editForm.marital_status || ''} onChange={e => setEditForm({ ...editForm, marital_status: e.target.value })}>
                  <MenuItem value="">— Not specified —</MenuItem>
                  <MenuItem value="single">Single</MenuItem>
                  <MenuItem value="married">Married</MenuItem>
                  <MenuItem value="civil_partnership">Civil Partnership</MenuItem>
                  <MenuItem value="divorced">Divorced</MenuItem>
                  <MenuItem value="widowed">Widowed</MenuItem>
                  <MenuItem value="separated">Separated</MenuItem>
                </TextField>
                <TextField label="Religion / Faith" fullWidth placeholder="e.g. Christian, Muslim, Hindu, None" value={editForm.religion || ''} onChange={e => setEditForm({ ...editForm, religion: e.target.value })} />
              </Stack>
              <Divider />
              <Typography variant="subtitle2" fontWeight={700}>Communication</Typography>
              <Stack direction="row" spacing={1}>
                <TextField label="Primary Language" fullWidth placeholder="e.g. English, Polish, Urdu" value={editForm.communication_language || ''} onChange={e => setEditForm({ ...editForm, communication_language: e.target.value })} />
                <TextField select label="Preferred Method" fullWidth value={editForm.communication_method || ''} onChange={e => setEditForm({ ...editForm, communication_method: e.target.value })}>
                  <MenuItem value="">— Not specified —</MenuItem>
                  <MenuItem value="verbal">Verbal</MenuItem>
                  <MenuItem value="written">Written</MenuItem>
                  <MenuItem value="makaton">Makaton</MenuItem>
                  <MenuItem value="bsl">BSL (British Sign Language)</MenuItem>
                  <MenuItem value="pictures">Picture cards / PECS</MenuItem>
                  <MenuItem value="aac">AAC device</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </TextField>
              </Stack>
              <Button variant={editForm.communication_interpreter ? 'contained' : 'outlined'} color="info"
                onClick={() => setEditForm({ ...editForm, communication_interpreter: !editForm.communication_interpreter })}
                sx={{ textTransform: 'none' }}>
                {editForm.communication_interpreter ? '✓ Interpreter Required' : 'Interpreter Needed'}
              </Button>
              <Divider />
              <Typography variant="subtitle2" fontWeight={700}>Admission & Funding</Typography>
              <Stack direction="row" spacing={1}>
                <TextField label="Admission Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={editForm.admission_date || ''} onChange={e => setEditForm({ ...editForm, admission_date: e.target.value })} />
                <TextField label="Admitted From" fullWidth placeholder="e.g. Home, Hospital, Other care home" value={editForm.admission_source || ''} onChange={e => setEditForm({ ...editForm, admission_source: e.target.value })} />
              </Stack>
              <Stack direction="row" spacing={1}>
                <TextField select label="Funding Type" fullWidth value={editForm.funding_type || ''} onChange={e => setEditForm({ ...editForm, funding_type: e.target.value })}>
                  <MenuItem value="">— Not specified —</MenuItem>
                  <MenuItem value="self_funded">Self-Funded</MenuItem>
                  <MenuItem value="la_funded">Local Authority Funded</MenuItem>
                  <MenuItem value="ccg">CCG / NHS Funded</MenuItem>
                  <MenuItem value="nhs_chc">NHS Continuing Healthcare (CHC)</MenuItem>
                  <MenuItem value="mixed">Mixed Funding</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </TextField>
                <TextField label="Funding Details" fullWidth placeholder="Reference numbers, notes..." value={editForm.funding_details || ''} onChange={e => setEditForm({ ...editForm, funding_details: e.target.value })} />
              </Stack>
              <TextField select label="Level of Support" fullWidth value={editForm.support_level || ''} onChange={e => setEditForm({ ...editForm, support_level: e.target.value })}>
                {SUPPORT_LEVELS.map(sl => (
                  <MenuItem key={sl.value} value={sl.value}>{sl.label}</MenuItem>
                ))}
              </TextField>
              <Divider />
              <Typography variant="subtitle2" fontWeight={700}>Pharmacy</Typography>
              <Stack direction="row" spacing={1}>
                <TextField label="Pharmacy Name" fullWidth value={editForm.pharmacy_name || ''} onChange={e => setEditForm({ ...editForm, pharmacy_name: e.target.value })} />
                <TextField label="Pharmacy Phone" fullWidth value={editForm.pharmacy_phone || ''} onChange={e => setEditForm({ ...editForm, pharmacy_phone: e.target.value })} />
              </Stack>
              <TextField label="Pharmacy Address" fullWidth multiline rows={2} value={editForm.pharmacy_address || ''} onChange={e => setEditForm({ ...editForm, pharmacy_address: e.target.value })} />
              <Divider />
              <Typography variant="subtitle2" fontWeight={700}>Social Worker</Typography>
              <Stack direction="row" spacing={1}>
                <TextField label="Name" fullWidth value={editForm.social_worker_name || ''} onChange={e => setEditForm({ ...editForm, social_worker_name: e.target.value })} />
                <TextField label="Phone" fullWidth value={editForm.social_worker_phone || ''} onChange={e => setEditForm({ ...editForm, social_worker_phone: e.target.value })} />
              </Stack>
              <TextField label="Email" fullWidth value={editForm.social_worker_email || ''} onChange={e => setEditForm({ ...editForm, social_worker_email: e.target.value })} />
              <Divider />
              <Typography variant="subtitle2" fontWeight={700}>Clinical Flags</Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {['allergies', 'dnr', 'behaviour', 'falls_risk', 'mca_dols', 'choking', 'diabetic', 'epilepsy'].map(f => (
                  <Chip key={f} label={f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    variant={(editForm.flags || []).includes(f) ? 'filled' : 'outlined'}
                    color={(editForm.flags || []).includes(f) ? 'error' : 'default'}
                    size="small" onClick={() => {
                      const flags = editForm.flags || []
                      setEditForm({ ...editForm, flags: flags.includes(f) ? flags.filter((x: string) => x !== f) : [...flags, f] })
                    }} />
                ))}
              </Stack>
              <Divider />
              <Typography variant="subtitle2" fontWeight={700}>Tags / Labels</Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {['dementia', 'palliative', 'end_of_life', 'learning_disability', 'mental_health', 'autism', 'physical_disability', 'acquired_brain_injury'].map(t => (
                  <Chip key={t} label={t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    variant={(editForm.tags || []).includes(t) ? 'filled' : 'outlined'}
                    color={(editForm.tags || []).includes(t) ? 'primary' : 'default'}
                    size="small" onClick={() => {
                      const tags = editForm.tags || []
                      setEditForm({ ...editForm, tags: tags.includes(t) ? tags.filter((x: string) => x !== t) : [...tags, t] })
                    }} />
                ))}
              </Stack>
              <Divider />
              <Typography variant="subtitle2" fontWeight={700}>DNACPR & Advance Decisions</Typography>
              <TextField select label="DNACPR Status" fullWidth value={editForm.dnacpr_status || ''} onChange={e => setEditForm({ ...editForm, dnacpr_status: e.target.value })}>
                <MenuItem value="">— Not specified —</MenuItem>
                <MenuItem value="in_place">In place</MenuItem>
                <MenuItem value="not_in_place">Not in place</MenuItem>
                <MenuItem value="discussed">Discussed but not formalised</MenuItem>
              </TextField>
              <Stack direction="row" spacing={1}>
                <TextField label="DNACPR Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={editForm.dnacpr_date || ''} onChange={e => setEditForm({ ...editForm, dnacpr_date: e.target.value })} />
                <TextField label="Review Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={editForm.dnacpr_review_date || ''} onChange={e => setEditForm({ ...editForm, dnacpr_review_date: e.target.value })} />
              </Stack>
              <TextField label="DNACPR Details" fullWidth multiline rows={2} value={editForm.dnacpr_details || ''} onChange={e => setEditForm({ ...editForm, dnacpr_details: e.target.value })} />
              <TextField label="Advance Decision / Living Will" fullWidth multiline rows={3} value={editForm.advance_decision || ''} onChange={e => setEditForm({ ...editForm, advance_decision: e.target.value })} />
              <TextField label="Advance Decision Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={editForm.advance_decision_date || ''} onChange={e => setEditForm({ ...editForm, advance_decision_date: e.target.value })} />
              <Divider />
              <Typography variant="subtitle2" fontWeight={700}>Discharge</Typography>
              <Stack direction="row" spacing={1}>
                <TextField label="Discharge Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={editForm.discharge_date || ''} onChange={e => setEditForm({ ...editForm, discharge_date: e.target.value })} />
                <TextField select label="Destination" fullWidth value={editForm.discharge_destination || ''} onChange={e => setEditForm({ ...editForm, discharge_destination: e.target.value })}>
                  <MenuItem value="">— Not specified —</MenuItem>
                  <MenuItem value="home">Home</MenuItem>
                  <MenuItem value="family">Family member's home</MenuItem>
                  <MenuItem value="care_home">Care home</MenuItem>
                  <MenuItem value="nursing_home">Nursing home</MenuItem>
                  <MenuItem value="hospital">Hospital</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </TextField>
              </Stack>
              <TextField label="Discharge Reason" fullWidth value={editForm.discharge_reason || ''} onChange={e => setEditForm({ ...editForm, discharge_reason: e.target.value })} />
              <TextField label="Discharge Summary" fullWidth multiline rows={3} value={editForm.discharge_summary || ''} onChange={e => setEditForm({ ...editForm, discharge_summary: e.target.value })} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={updateMutation.isPending} sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
              {updateMutation.isPending ? <CircularProgress size={20} /> : 'Save'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Add / Edit Care Plan Dialog */}
      <Dialog open={addPlanOpen} onClose={() => { setAddPlanOpen(false); setEditPlanId(null) }} maxWidth="md" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => {
          e.preventDefault()
          if (editPlanId) {
            updatePlanMutation.mutate({ planId: editPlanId, data: planForm })
          } else {
            addPlanMutation.mutate(planForm)
          }
        }}>
          <DialogTitle sx={{ fontWeight: 800 }}>{editPlanId ? 'Edit Care Plan' : 'Add Care Plan'}</DialogTitle>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Title" fullWidth required value={planForm.title} onChange={e => setPlanForm({ ...planForm, title: e.target.value })} />
              <TextField select label="Category" fullWidth required value={planForm.category} onChange={e => setPlanForm({ ...planForm, category: e.target.value })}>
                {CATEGORY_OPTIONS.map(c => <MenuItem key={c} value={c} sx={{ textTransform: 'capitalize' }}>{c.replace(/_/g, ' ')}</MenuItem>)}
              </TextField>
              <TextField label="Description" fullWidth multiline rows={3} value={planForm.description} onChange={e => setPlanForm({ ...planForm, description: e.target.value })} />
              <TextField label="Risk Assessment" fullWidth multiline rows={2} value={planForm.risk_assessment} onChange={e => setPlanForm({ ...planForm, risk_assessment: e.target.value })} />
              <TextField label="Review Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={planForm.review_date} onChange={e => setPlanForm({ ...planForm, review_date: e.target.value })} />

              {planForm.category && CATEGORY_FIELDS[planForm.category]?.includes('mobility_level') && (
                <TextField select label="Mobility Level" fullWidth value={planForm.mobility_level} onChange={e => setPlanForm({ ...planForm, mobility_level: e.target.value })}>
                  <MenuItem value="">— Not specified —</MenuItem>
                  <MenuItem value="independent">Independent</MenuItem>
                  <MenuItem value="aided">Requires aids (frame/stick)</MenuItem>
                  <MenuItem value="assisted_1">Requires 1 carer assistance</MenuItem>
                  <MenuItem value="assisted_2">Requires 2 carers</MenuItem>
                  <MenuItem value="hoist">Requires hoist</MenuItem>
                  <MenuItem value="wheelchair">Wheelchair user</MenuItem>
                  <MenuItem value="bedbound">Bedbound</MenuItem>
                </TextField>
              )}
              {planForm.category && CATEGORY_FIELDS[planForm.category]?.includes('mobility_aids') && (
                <TextField label="Mobility Aids" fullWidth placeholder="Walking frame, wheelchair, grab rails..." value={planForm.mobility_aids} onChange={e => setPlanForm({ ...planForm, mobility_aids: e.target.value })} />
              )}
              {planForm.category && CATEGORY_FIELDS[planForm.category]?.includes('communication_needs') && (
                <TextField label="Communication Needs" fullWidth multiline rows={2} placeholder="Hearing impairment, preferred language, communication aids..." value={planForm.communication_needs} onChange={e => setPlanForm({ ...planForm, communication_needs: e.target.value })} />
              )}
              {planForm.category && CATEGORY_FIELDS[planForm.category]?.includes('capacity_status') && (
                <TextField select label="Mental Capacity" fullWidth value={planForm.capacity_status} onChange={e => setPlanForm({ ...planForm, capacity_status: e.target.value })}>
                  <MenuItem value="">— Not assessed —</MenuItem>
                  <MenuItem value="full">Full capacity</MenuItem>
                  <MenuItem value="partial">Partial capacity — some decisions need support</MenuItem>
                  <MenuItem value="fluctuating">Fluctuating capacity</MenuItem>
                  <MenuItem value="lacks">Lacks capacity — Best Interest decisions in place</MenuItem>
                </TextField>
              )}
              {planForm.category && CATEGORY_FIELDS[planForm.category]?.includes('sleep_pattern') && (
                <TextField label="Sleep Pattern" fullWidth placeholder="Bedtime routine, night support needed..." value={planForm.sleep_pattern} onChange={e => setPlanForm({ ...planForm, sleep_pattern: e.target.value })} />
              )}
              {planForm.category && CATEGORY_FIELDS[planForm.category]?.includes('emergency_info') && (
                <TextField label="Emergency Information" fullWidth multiline rows={2} placeholder="DNACPR status, escalation procedure, hospital preference..." value={planForm.emergency_info} onChange={e => setPlanForm({ ...planForm, emergency_info: e.target.value })} />
              )}
              {planForm.category && CATEGORY_FIELDS[planForm.category]?.includes('personal_goals') && (
                <TextField label="Personal Goals" fullWidth multiline rows={2} placeholder="What is important to the person? What outcomes are they working towards?" value={planForm.personal_goals} onChange={e => setPlanForm({ ...planForm, personal_goals: e.target.value })} />
              )}
              {planForm.category && CATEGORY_FIELDS[planForm.category]?.includes('likes_dislikes') && (
                <TextField label="Likes & Dislikes" fullWidth multiline rows={2} placeholder="Preferences, hobbies, interests, things to avoid..." value={planForm.likes_dislikes} onChange={e => setPlanForm({ ...planForm, likes_dislikes: e.target.value })} />
              )}
              {planForm.category && CATEGORY_FIELDS[planForm.category]?.includes('cultural_needs') && (
                <TextField label="Cultural & Religious Needs" fullWidth placeholder="Dietary, religious observance, language preferences..." value={planForm.cultural_needs} onChange={e => setPlanForm({ ...planForm, cultural_needs: e.target.value })} />
              )}

              <Divider />
              <Typography variant="subtitle2" fontWeight={700}>Attachments</Typography>
              <input type="file" ref={planFileInputRef} hidden accept=".pdf,.doc,.docx" onChange={async e => {
                const file = e.target.files?.[0]
                if (!file) return
                setPlanUploading(true)
                try {
                  const fd = new FormData()
                  fd.append('file', file)
                  const res = await api.post('/settings/upload', fd)
                  setPlanForm({ ...planForm, file_url: res.data.url })
                } catch { setError('Failed to upload file') }
                finally { setPlanUploading(false); e.target.value = '' }
              }} />
              <Stack direction="row" spacing={1} alignItems="center">
                <Button variant="outlined" size="small" onClick={() => planFileInputRef.current?.click()} disabled={planUploading}
                  sx={{ textTransform: 'none', borderRadius: 2 }}>
                  {planUploading ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                  {planForm.file_url ? 'Replace File' : 'Upload PDF / Document'}
                </Button>
                {planForm.file_url && (
                  <>
                    <Chip label={planForm.file_url.split('/').pop() || 'Attached'} size="small" color="primary" variant="outlined" />
                    <IconButton size="small" onClick={() => setPlanForm({ ...planForm, file_url: '' })}><DeleteIcon fontSize="small" /></IconButton>
                  </>
                )}
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => { setAddPlanOpen(false); setEditPlanId(null) }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addPlanMutation.isPending || updatePlanMutation.isPending}
              sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
              {(addPlanMutation.isPending || updatePlanMutation.isPending) ? <CircularProgress size={20} /> : (editPlanId ? 'Save' : 'Add Plan')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Add Daily Note Dialog */}
      <Dialog open={addNoteOpen} onClose={() => { setAddNoteOpen(false); setEditNoteId(null) }} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (editNoteId) updateNoteMutation.mutate({ noteId: editNoteId, data: noteForm }); else addNoteMutation.mutate(noteForm) }}>
          <DialogTitle sx={{ fontWeight: 800 }}>{editNoteId ? 'Edit Daily Note' : 'Add Daily Note'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack direction="row" spacing={1}>
                <TextField label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={noteForm.note_date} onChange={e => setNoteForm({ ...noteForm, note_date: e.target.value })} />
                <TextField select label="Shift" fullWidth value={noteForm.shift} onChange={e => setNoteForm({ ...noteForm, shift: e.target.value })}>
                  <MenuItem value="day">Day</MenuItem>
                  <MenuItem value="night">Night</MenuItem>
                </TextField>
              </Stack>
              <TextField select label="Category" fullWidth required value={noteForm.category} onChange={e => setNoteForm({ ...noteForm, category: e.target.value })}>
                {NOTE_CATEGORIES.map(c => <MenuItem key={c} value={c} sx={{ textTransform: 'capitalize' }}>{c.replace(/_/g, ' ')}</MenuItem>)}
              </TextField>
              <TextField select label="Level of Support" fullWidth value={noteForm.support_level} onChange={e => setNoteForm({ ...noteForm, support_level: e.target.value })}>
                {SUPPORT_LEVELS.map(sl => (
                  <MenuItem key={sl.value} value={sl.value}>{sl.label}</MenuItem>
                ))}
              </TextField>
              <TextField label="Notes" fullWidth multiline rows={4} required value={noteForm.content} onChange={e => setNoteForm({ ...noteForm, content: e.target.value })} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => { setAddNoteOpen(false); setEditNoteId(null) }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addNoteMutation.isPending || updateNoteMutation.isPending} sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>{(addNoteMutation.isPending || updateNoteMutation.isPending) ? <CircularProgress size={20} /> : (editNoteId ? 'Save' : 'Add Note')}</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* View Note Dialog */}
      <Dialog open={!!viewNote} onClose={() => setViewNote(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Daily Note</DialogTitle>
        <DialogContent>
          {viewNote && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Chip label={viewNote.shift} size="small" color={viewNote.shift === 'day' ? 'primary' : 'default'} sx={{ textTransform: 'capitalize' }} />
                <Chip label={viewNote.category?.replace(/_/g, ' ')} size="small" variant="outlined" sx={{ textTransform: 'capitalize' }} />
                {viewNote.support_level && SUPPORT_LEVEL_LABELS[viewNote.support_level] && (
                  <Chip label={SUPPORT_LEVEL_LABELS[viewNote.support_level]} size="small" color={SUPPORT_LEVEL_COLORS[viewNote.support_level] || 'default'} />
                )}
                <Typography variant="caption" color="#6B7280">{new Date(viewNote.note_date).toLocaleDateString('en-GB')}</Typography>
                <Typography variant="caption" color="#9CA3AF">{viewNote.author_name ? `by ${viewNote.author_name}` : ''}</Typography>
              </Stack>
              <Divider />
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{viewNote.content}</Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setViewNote(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Add / Edit Risk Assessment Dialog */}
      <Dialog open={addRiskOpen} onClose={() => { setAddRiskOpen(false); setEditRiskId(null) }} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => {
          e.preventDefault()
          if (editRiskId) {
            updateRiskMutation.mutate({ riskId: editRiskId, data: riskForm })
          } else {
            addRiskMutation.mutate(riskForm)
          }
        }}>
          <DialogTitle sx={{ fontWeight: 800 }}>{editRiskId ? 'Edit Risk Assessment' : 'Add Risk Assessment'}</DialogTitle>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField select label="Type" fullWidth required value={riskForm.type} onChange={e => setRiskForm({ ...riskForm, type: e.target.value })}>
                {RISK_TYPES.map(t => <MenuItem key={t} value={t} sx={{ textTransform: 'capitalize' }}>{t.replace(/_/g, ' ')}</MenuItem>)}
              </TextField>
              <TextField select label="Risk Level" fullWidth required value={riskForm.risk_level} onChange={e => setRiskForm({ ...riskForm, risk_level: e.target.value })}>
                {Object.keys(RISK_COLORS).map(k => <MenuItem key={k} value={k} sx={{ textTransform: 'capitalize' }}>{k}</MenuItem>)}
              </TextField>
              <TextField label="Details" fullWidth multiline rows={3} value={riskForm.details} onChange={e => setRiskForm({ ...riskForm, details: e.target.value })} />
              <TextField label="Mitigation Actions" fullWidth multiline rows={3} value={riskForm.mitigation_actions} onChange={e => setRiskForm({ ...riskForm, mitigation_actions: e.target.value })} />
              <TextField label="Review Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={riskForm.review_date} onChange={e => setRiskForm({ ...riskForm, review_date: e.target.value })} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => { setAddRiskOpen(false); setEditRiskId(null) }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addRiskMutation.isPending || updateRiskMutation.isPending}
              sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
              {(addRiskMutation.isPending || updateRiskMutation.isPending) ? <CircularProgress size={20} /> : (editRiskId ? 'Save' : 'Add Assessment')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Add / Edit Family Contact Dialog */}
      <Dialog open={addContactOpen} onClose={() => { setAddContactOpen(false); setContactEditId(null) }} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => {
          e.preventDefault()
          if (contactEditId) {
            updateContactMutation.mutate({ contactId: contactEditId, data: contactForm })
          } else {
            addContactMutation.mutate(contactForm)
          }
        }}>
          <DialogTitle sx={{ fontWeight: 800 }}>{contactEditId ? 'Edit Contact' : 'Add Family Contact'}</DialogTitle>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Full Name" fullWidth required value={contactForm.name} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} />
              <TextField label="Relationship" fullWidth value={contactForm.relationship} onChange={e => setContactForm({ ...contactForm, relationship: e.target.value })} />
              <Stack direction="row" spacing={1}>
                <TextField label="Phone" fullWidth value={contactForm.phone} onChange={e => setContactForm({ ...contactForm, phone: e.target.value })} />
                <TextField label="Email" fullWidth value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} />
              </Stack>
              <Button variant={contactForm.is_emergency_contact ? 'contained' : 'outlined'} color="error"
                onClick={() => setContactForm({ ...contactForm, is_emergency_contact: !contactForm.is_emergency_contact })}
                sx={{ textTransform: 'none' }}>
                {contactForm.is_emergency_contact ? '✓ Emergency Contact' : 'Mark as Emergency Contact'}
              </Button>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => { setAddContactOpen(false); setContactEditId(null) }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addContactMutation.isPending || updateContactMutation.isPending}
              sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
              {(addContactMutation.isPending || updateContactMutation.isPending) ? <CircularProgress size={20} /> : (contactEditId ? 'Save' : 'Add Contact')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Invite to Portal Dialog */}
      <Dialog open={invitePortalOpen} onClose={() => { setInvitePortalOpen(false); setInvitePortalError('') }} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => {
          e.preventDefault()
          inviteFromContactMutation.mutate({ ...invitePortalForm, service_user_id: id })
        }}>
          <DialogTitle sx={{ fontWeight: 800 }}>Invite to Family Portal</DialogTitle>
          <DialogContent>
            {invitePortalError && <Alert severity="error" sx={{ mb: 2 }}>{invitePortalError}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2" color="#6B7280">Send portal access invitation to this family member. They'll receive an email with a secure link.</Typography>
              <TextField label="Full Name" fullWidth required value={invitePortalForm.name} onChange={e => setInvitePortalForm({ ...invitePortalForm, name: e.target.value })} />
              <TextField label="Email" fullWidth required type="email" value={invitePortalForm.email} onChange={e => setInvitePortalForm({ ...invitePortalForm, email: e.target.value })} />
              <Stack direction="row" spacing={1}>
                <TextField label="Relationship" fullWidth value={invitePortalForm.relationship} onChange={e => setInvitePortalForm({ ...invitePortalForm, relationship: e.target.value })} />
                <TextField label="Phone" fullWidth value={invitePortalForm.phone} onChange={e => setInvitePortalForm({ ...invitePortalForm, phone: e.target.value })} />
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => { setInvitePortalOpen(false); setInvitePortalError('') }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={inviteFromContactMutation.isPending}
              sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
              {inviteFromContactMutation.isPending ? <CircularProgress size={20} /> : 'Send Invite'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this {deleteConfirm?.type}? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => {
            if (!deleteConfirm) return
            const { type, id: delId } = deleteConfirm
            if (type === 'plan') deletePlanMutation.mutate(delId)
            else if (type === 'risk') deleteRiskMutation.mutate(delId)
            setDeleteConfirm(null)
          }}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function GoalsTabInline({ serviceUserId }: { serviceUserId: string }) {
  const navigate = useNavigate()
  const { data: goals, isLoading, isError } = useQuery({
    queryKey: ['goals', serviceUserId],
    queryFn: () => api.get('/goals', { params: { service_user_id: serviceUserId } }).then(r => r.data),
  })
  if (isLoading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
  if (isError) return <Alert severity="error">Failed to load goals</Alert>
  const stats = {
    total: goals?.length || 0,
    active: goals?.filter((g: any) => g.status === 'active').length || 0,
    completed: goals?.filter((g: any) => g.status === 'completed').length || 0,
    avgProgress: Math.round((goals?.reduce((s: number, g: any) => s + (g.progress || 0), 0) || 0) / (goals?.length || 1)),
  }
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={800}>Service User Goals</Typography>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => navigate(`/goals?su=${serviceUserId}`)}
          sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>Manage Goals</Button>
      </Stack>
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Paper sx={{ p: 2, flex: 1, textAlign: 'center', borderRadius: 2 }}><Typography variant="h6" fontWeight={800}>{stats.total}</Typography><Typography variant="caption">Total</Typography></Paper>
        <Paper sx={{ p: 2, flex: 1, textAlign: 'center', borderRadius: 2 }}><Typography variant="h6" fontWeight={800} color="#0F4C81">{stats.active}</Typography><Typography variant="caption">Active</Typography></Paper>
        <Paper sx={{ p: 2, flex: 1, textAlign: 'center', borderRadius: 2 }}><Typography variant="h6" fontWeight={800} color="#16A34A">{stats.completed}</Typography><Typography variant="caption">Completed</Typography></Paper>
        <Paper sx={{ p: 2, flex: 1, textAlign: 'center', borderRadius: 2 }}><Typography variant="h6" fontWeight={800} color="#D97706">{stats.avgProgress}%</Typography><Typography variant="caption">Avg Progress</Typography></Paper>
      </Stack>
      {(!goals || goals.length === 0) ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <Typography color="#9CA3AF">No goals set yet</Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {goals.slice(0, 10).map((g: any) => (
            <Paper key={g.id} sx={{ p: 2, borderRadius: 2, border: '1px solid #E5E7EB' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="body2" fontWeight={700}>{g.title}</Typography>
                <Chip label={g.status} size="small" color={g.status === 'completed' ? 'success' : g.status === 'active' ? 'primary' : 'default'} />
              </Stack>
              <LinearProgress variant="determinate" value={g.progress || 0}
                sx={{ height: 6, borderRadius: 3, bgcolor: '#E5E7EB', '& .MuiLinearProgress-bar': { bgcolor: g.progress >= 100 ? '#16A34A' : '#0F4C81' } }} />
              <Typography variant="caption" color="#6B7280" sx={{ mt: 0.5, display: 'block' }}>{g.progress || 0}% complete</Typography>
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  )
}

function CareAssessmentsTabInline({ serviceUserId }: { serviceUserId: string }) {
  const navigate = useNavigate()
  const { data: assessments, isLoading, isError } = useQuery({
    queryKey: ['assessments', serviceUserId],
    queryFn: () => api.get(`/service-users/${serviceUserId}/assessments`).then(r => r.data),
  })
  if (isLoading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
  if (isError) return <Alert severity="error">Failed to load assessments</Alert>
  const stats = {
    total: assessments?.length || 0,
    completed: assessments?.filter((a: any) => a.status === 'completed').length || 0,
    draft: assessments?.filter((a: any) => a.status === 'draft').length || 0,
  }
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={800}>Care Assessments</Typography>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => navigate(`/care-assessments?su=${serviceUserId}`)}
          sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>Manage Assessments</Button>
      </Stack>
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Paper sx={{ p: 2, flex: 1, textAlign: 'center', borderRadius: 2 }}><Typography variant="h6" fontWeight={800}>{stats.total}</Typography><Typography variant="caption">Total</Typography></Paper>
        <Paper sx={{ p: 2, flex: 1, textAlign: 'center', borderRadius: 2 }}><Typography variant="h6" fontWeight={800} color="#16A34A">{stats.completed}</Typography><Typography variant="caption">Completed</Typography></Paper>
        <Paper sx={{ p: 2, flex: 1, textAlign: 'center', borderRadius: 2 }}><Typography variant="h6" fontWeight={800} color="#D97706">{stats.draft}</Typography><Typography variant="caption">Draft</Typography></Paper>
      </Stack>
      {(!assessments || assessments.length === 0) ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <Typography color="#9CA3AF">No assessments yet</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Assessor</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Next Review</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {assessments.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell sx={{ textTransform: 'capitalize' }}>{a.assessment_type?.replace(/_/g, ' ')}</TableCell>
                  <TableCell>{a.assessment_date ? new Date(a.assessment_date).toLocaleDateString('en-GB') : '—'}</TableCell>
                  <TableCell>{a.assessor_name || '—'}</TableCell>
                  <TableCell><Chip label={a.status} size="small" color={a.status === 'completed' ? 'success' : a.status === 'reviewed' ? 'primary' : 'default'} /></TableCell>
                  <TableCell>{a.next_review_date ? new Date(a.next_review_date).toLocaleDateString('en-GB') : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}

function TimelineTab({ serviceUserId }: { serviceUserId: string }) {
  const { data: timeline = [], isLoading } = useQuery({
    queryKey: ['timeline', serviceUserId],
    queryFn: () => api.get(`/service-users/${serviceUserId}/timeline`).then(r => r.data),
  })
  if (isLoading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>

  const EVENT_ICONS: Record<string, any> = {
    admission: <EventIcon sx={{ color: '#0F4C81' }} />,
    care_plan: <AssignmentIcon sx={{ color: '#16A34A' }} />,
    daily_note: <NoteIcon sx={{ color: '#D97706' }} />,
    risk_assessment: <WarningIcon sx={{ color: '#DC2626' }} />,
    health: <HealthIcon sx={{ color: '#7C3AED' }} />,
    assessment: <PersonIcon sx={{ color: '#0891B2' }} />,
    incident: <WarningIcon sx={{ color: '#DC2626' }} />,
  }

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 3 }}>Service User Timeline</Typography>
      {timeline.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <Typography color="#9CA3AF">No timeline events yet</Typography>
        </Paper>
      ) : (
        <Box sx={{ position: 'relative' }}>
          <Box sx={{ position: 'absolute', left: 19, top: 0, bottom: 0, width: 2, bgcolor: '#E5E7EB' }} />
          <Stack spacing={2}>
            {timeline.map((event: any, i: number) => (
              <Box key={event.id || i} sx={{ position: 'relative', pl: 6 }}>
                <Box sx={{ position: 'absolute', left: 12, top: 4, width: 16, height: 16, borderRadius: '50%', bgcolor: 'white', border: '2px solid', borderColor: '#0F4C81', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#0F4C81' }} />
                </Box>
                <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid #E5E7EB' }}>
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <Box sx={{ mt: 0.3 }}>{EVENT_ICONS[event.event_type] || <EventIcon />}</Box>
                    <Box sx={{ flex: 1 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" fontWeight={700} sx={{ textTransform: 'capitalize' }}>
                          {event.event_label || event.event_type?.replace(/_/g, ' ')}
                        </Typography>
                        <Typography variant="caption" color="#9CA3AF">
                          {event.created_at ? new Date(event.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                        </Typography>
                      </Stack>
                      {event.description && <Typography variant="body2" color="#6B7280" sx={{ mt: 0.5 }}>{event.description}</Typography>}
                      {event.details && <Typography variant="body2" color="#374151" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>{event.details}</Typography>}
                      {event.performed_by && <Typography variant="caption" color="#9CA3AF" sx={{ mt: 0.5, display: 'block' }}>by {event.performed_by}</Typography>}
                    </Box>
                  </Stack>
                </Paper>
              </Box>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  )
}

function RoomChecksTab({ roomNumber }: { roomNumber: string | null }) {
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()
  const [addOpen, setAddOpen] = useState(false)
  const [rcForm, setRcForm] = useState({ status: 'pass', cleanliness_rating: 5, safety_rating: 5, notes: '', check_date: new Date().toISOString().split('T')[0] })
  const [rcError, setRcError] = useState('')

  const { data: checks = [], isLoading, isError } = useQuery({
    queryKey: ['room-checks', roomNumber],
    queryFn: () => api.get('/room-checks', { params: { room_number: roomNumber || undefined } }).then(r => r.data),
    enabled: !!roomNumber,
  })

  const addCheckMutation = useMutation({
    mutationFn: (data: any) => api.post('/room-checks', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['room-checks', roomNumber] }); setAddOpen(false); showSnackbar('Room check recorded') },
    onError: (err: any) => setRcError(err.response?.data?.message || 'Failed to save'),
  })

  if (!roomNumber) return (
    <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB' }}>
      <Typography color="#9CA3AF">No room number assigned to this resident. Room checks cannot be displayed.</Typography>
    </Paper>
  )

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
  if (isError) return <Alert severity="error">Failed to load room checks</Alert>

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={800}>Room Checks for Room {roomNumber}</Typography>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => { setRcForm({ status: 'pass', cleanliness_rating: 5, safety_rating: 5, notes: '', check_date: new Date().toISOString().split('T')[0] }); setRcError(''); setAddOpen(true) }}
          sx={{ bgcolor: '#0F4C81', textTransform: 'none', borderRadius: 1.5, px: 2 }}>Record Check</Button>
      </Stack>
      {checks.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <Typography color="#9CA3AF">No room checks recorded for this room</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Cleanliness</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Safety</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Checked By</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Notes</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {checks.map((c: any) => (
                <TableRow key={c.id} hover>
                  <TableCell>{new Date(c.check_date).toLocaleDateString('en-GB')}</TableCell>
                  <TableCell>{c.location_name || '—'}</TableCell>
                  <TableCell><Rating value={c.cleanliness_rating || 0} readOnly size="small" max={5} /></TableCell>
                  <TableCell><Rating value={c.safety_rating || 0} readOnly size="small" max={5} /></TableCell>
                  <TableCell><Chip label={c.status === 'pass' ? 'Pass' : c.status === 'fail' ? 'Fail' : 'Needs Attention'} size="small"
                    color={c.status === 'pass' ? 'success' : c.status === 'fail' ? 'error' : 'warning'} /></TableCell>
                  <TableCell>{c.checked_by_name || '—'}</TableCell>
                  <TableCell sx={{ maxWidth: 200 }}>{c.notes || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add Room Check Dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <Box component="form" onSubmit={e => { e.preventDefault(); addCheckMutation.mutate({ ...rcForm, room_number: roomNumber }) }}>
          <DialogTitle sx={{ fontWeight: 800 }}>Record Room Check</DialogTitle>
          <DialogContent>
            {rcError && <Alert severity="error" sx={{ mb: 2, borderRadius: 1 }}>{rcError}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }}
                value={rcForm.check_date} onChange={e => setRcForm({ ...rcForm, check_date: e.target.value })} />
              <TextField select label="Status" fullWidth value={rcForm.status}
                onChange={e => setRcForm({ ...rcForm, status: e.target.value })}>
                <MenuItem value="pass">Pass</MenuItem>
                <MenuItem value="needs_attention">Needs Attention</MenuItem>
                <MenuItem value="fail">Fail</MenuItem>
              </TextField>
              <TextField select label="Cleanliness Rating" fullWidth value={rcForm.cleanliness_rating}
                onChange={e => setRcForm({ ...rcForm, cleanliness_rating: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5].map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </TextField>
              <TextField select label="Safety Rating" fullWidth value={rcForm.safety_rating}
                onChange={e => setRcForm({ ...rcForm, safety_rating: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5].map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </TextField>
              <TextField label="Notes" fullWidth multiline rows={3} value={rcForm.notes}
                onChange={e => setRcForm({ ...rcForm, notes: e.target.value })} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addCheckMutation.isPending}
              sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
              {addCheckMutation.isPending ? <CircularProgress size={20} /> : 'Save Check'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  )
}

function ClinicalScoresTab({ serviceUserId }: { serviceUserId: string }) {
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ score_type: 'waterlow', score: '', risk_level: '', notes: '', recorded_date: new Date().toISOString().split('T')[0] })
  const [formError, setFormError] = useState('')
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()

  const { data: scores = [], isLoading } = useQuery({
    queryKey: ['clinical-scores', serviceUserId],
    queryFn: () => api.get(`/service-users/${serviceUserId}/clinical-scores`).then(r => r.data),
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post(`/service-users/${serviceUserId}/clinical-scores`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clinical-scores', serviceUserId] }); setAddOpen(false); setForm({ score_type: 'waterlow', score: '', risk_level: '', notes: '', recorded_date: new Date().toISOString().split('T')[0] }) },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to add score'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/service-users/clinical-scores/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clinical-scores', serviceUserId] }),
    onError: (err: any) => showSnackbar(err.response?.data?.message || 'Failed to delete', 'error'),
  })

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={800}>Clinical Scores</Typography>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}
          sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>Record Score</Button>
      </Stack>
      {scores.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <Typography color="#9CA3AF">No clinical scores recorded</Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {scores.map((s: any) => (
            <Paper key={s.id} sx={{ p: 2, borderRadius: 2, border: '1px solid #E5E7EB', borderLeft: 4,
              borderLeftColor: s.risk_level === 'high' || s.risk_level === 'severe' ? '#DC2626' : s.risk_level === 'medium' || s.risk_level === 'at_risk' ? '#D97706' : '#16A34A' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle2" fontWeight={700} sx={{ textTransform: 'capitalize' }}>{s.score_type}</Typography>
                    {s.score != null && <Chip label={`Score: ${s.score}`} size="small" variant="outlined" />}
                    {s.risk_level && <Chip label={s.risk_level.replace(/_/g, ' ')} size="small"
                      color={s.risk_level === 'high' || s.risk_level === 'severe' ? 'error' : s.risk_level === 'medium' || s.risk_level === 'at_risk' ? 'warning' : 'success'} />}
                  </Stack>
                  {s.notes && <Typography variant="body2" color="#6B7280" sx={{ mt: 0.5 }}>{s.notes}</Typography>}
                  <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                    <Typography variant="caption" color="#9CA3AF">{new Date(s.recorded_date).toLocaleDateString('en-GB')}</Typography>
                    {s.recorded_by_name && <Typography variant="caption" color="#9CA3AF">by {s.recorded_by_name}</Typography>}
                  </Stack>
                </Box>
                <IconButton size="small" onClick={() => deleteMutation.mutate(s.id)}><DeleteIcon fontSize="small" /></IconButton>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); setFormError(''); addMutation.mutate({ ...form, score: form.score ? parseFloat(form.score) : undefined }) }}>
          <DialogTitle sx={{ fontWeight: 800 }}>Record Clinical Score</DialogTitle>
          <DialogContent>
            {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField select label="Score Type" fullWidth required value={form.score_type} onChange={e => setForm({ ...form, score_type: e.target.value })}>
                <MenuItem value="waterlow">Waterlow (Pressure Sore Risk)</MenuItem>
                <MenuItem value="must">MUST (Malnutrition)</MenuItem>
                <MenuItem value="bmi">BMI</MenuItem>
              </TextField>
              {form.score_type === 'waterlow' && (
                <TextField label="Waterlow Score" type="number" fullWidth placeholder="1-35"
                  value={form.score} onChange={e => setForm({ ...form, score: e.target.value, risk_level: parseFloat(e.target.value) >= 20 ? 'high' : parseFloat(e.target.value) >= 15 ? 'medium' : parseFloat(e.target.value) >= 10 ? 'at_risk' : 'low' })} />
              )}
              {form.score_type === 'must' && (
                <TextField label="MUST Score" type="number" fullWidth placeholder="0-6"
                  value={form.score} onChange={e => setForm({ ...form, score: e.target.value, risk_level: parseFloat(e.target.value) >= 2 ? 'high' : parseFloat(e.target.value) >= 1 ? 'medium' : 'low' })} />
              )}
              {form.score_type === 'bmi' && (
                <TextField label="BMI" type="number" fullWidth inputProps={{ step: 0.1 }}
                  value={form.score} onChange={e => setForm({ ...form, score: e.target.value, risk_level: parseFloat(e.target.value) < 18.5 ? 'underweight' : parseFloat(e.target.value) >= 30 ? 'obese' : parseFloat(e.target.value) >= 25 ? 'overweight' : 'healthy' })} />
              )}
              <TextField label="Risk Level" fullWidth value={form.risk_level} onChange={e => setForm({ ...form, risk_level: e.target.value })} />
              <TextField label="Notes" fullWidth multiline rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              <TextField label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.recorded_date} onChange={e => setForm({ ...form, recorded_date: e.target.value })} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addMutation.isPending} sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
              {addMutation.isPending ? <CircularProgress size={20} /> : 'Save Score'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  )
}

function DocumentsTab({ serviceUserId }: { serviceUserId: string }) {
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ title: '', document_type: 'care_plan', description: '', file_url: '', upload_date: new Date().toISOString().split('T')[0] })
  const [formError, setFormError] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['documents', serviceUserId],
    queryFn: () => api.get(`/service-users/${serviceUserId}/documents`).then(r => r.data),
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post(`/service-users/${serviceUserId}/documents`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['documents', serviceUserId] }); setAddOpen(false); setForm({ title: '', document_type: 'care_plan', description: '', file_url: '', upload_date: new Date().toISOString().split('T')[0] }) },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to upload'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/service-users/documents/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents', serviceUserId] }),
    onError: (err: any) => showSnackbar(err.response?.data?.message || 'Failed to delete', 'error'),
  })

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={800}>Documents</Typography>
        <Button size="small" variant="contained" startIcon={<UploadIcon />} onClick={() => setAddOpen(true)}
          sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>Upload Document</Button>
      </Stack>
      {docs.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <Typography color="#9CA3AF">No documents uploaded yet</Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {docs.map((d: any) => (
            <Paper key={d.id} sx={{ p: 2, borderRadius: 2, border: '1px solid #E5E7EB' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle2" fontWeight={700}>{d.title}</Typography>
                    <Chip label={d.document_type?.replace(/_/g, ' ')} size="small" variant="outlined" />
                  </Stack>
                  {d.description && <Typography variant="body2" color="#6B7280" sx={{ mt: 0.5 }}>{d.description}</Typography>}
                  <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                    <Typography variant="caption" color="#9CA3AF">{new Date(d.upload_date).toLocaleDateString('en-GB')}</Typography>
                    {d.uploaded_by_name && <Typography variant="caption" color="#9CA3AF">by {d.uploaded_by_name}</Typography>}
                  </Stack>
                </Box>
                <Stack direction="row" spacing={0.5}>
                  <Button size="small" variant="outlined" component="a" href={d.file_url} target="_blank"
                    sx={{ textTransform: 'none', borderRadius: 2, fontSize: 12 }}>
                    View
                  </Button>
                  <IconButton size="small" onClick={() => deleteMutation.mutate(d.id)}><DeleteIcon fontSize="small" /></IconButton>
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); setFormError(''); if (!form.file_url) { setFormError('Please upload a file first'); return } addMutation.mutate(form) }}>
          <DialogTitle sx={{ fontWeight: 800 }}>Upload Document</DialogTitle>
          <DialogContent>
            {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Title" fullWidth required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              <TextField select label="Document Type" fullWidth required value={form.document_type} onChange={e => setForm({ ...form, document_type: e.target.value })}>
                <MenuItem value="care_plan">Care Plan</MenuItem>
                <MenuItem value="assessment">Assessment</MenuItem>
                <MenuItem value="hospital_letter">Hospital Letter</MenuItem>
                <MenuItem value="referral">Referral</MenuItem>
                <MenuItem value="mental_health">Mental Health Act / Section</MenuItem>
                <MenuItem value="legal">Legal Document</MenuItem>
                <MenuItem value="correspondence">Correspondence</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </TextField>
              <TextField label="Description" fullWidth multiline rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              <input type="file" ref={fileInputRef} hidden onChange={async e => {
                const file = e.target.files?.[0]
                if (!file) return
                setUploading(true)
                try {
                  const fd = new FormData()
                  fd.append('file', file)
                  const res = await api.post('/settings/upload', fd)
                  setForm({ ...form, file_url: res.data.url })
                } catch { setFormError('Upload failed') }
                finally { setUploading(false); e.target.value = '' }
              }} />
              <Button variant="outlined" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                sx={{ textTransform: 'none', borderRadius: 2 }}>
                {uploading ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                {form.file_url ? 'Replace File' : 'Choose File'}
              </Button>
              {form.file_url && <Chip label={form.file_url.split('/').pop()} size="small" color="primary" variant="outlined" onDelete={() => setForm({ ...form, file_url: '' })} />}
              <TextField label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.upload_date} onChange={e => setForm({ ...form, upload_date: e.target.value })} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addMutation.isPending || uploading} sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
              {addMutation.isPending ? <CircularProgress size={20} /> : 'Upload'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  )
}

const WELLBEING_DOMAINS = ['mood', 'engagement', 'sleep', 'appetite', 'pain', 'mobility', 'social', 'overall']

const DOMAIN_COLORS: Record<string, string> = {
  mood: '#7C3AED', engagement: '#0891B2', sleep: '#6366F1', appetite: '#16A34A',
  pain: '#DC2626', mobility: '#D97706', social: '#0F4C81', overall: '#6B7280',
}

function WellbeingTabInline({ serviceUserId }: { serviceUserId: string }) {
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ domain: 'mood', score: 5, notes: '' })
  const [formError, setFormError] = useState('')
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['wellbeing', serviceUserId],
    queryFn: () => api.get(`/service-users/${serviceUserId}/wellbeing`).then(r => r.data),
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post(`/service-users/${serviceUserId}/wellbeing`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wellbeing', serviceUserId] }); setAddOpen(false); setForm({ domain: 'mood', score: 5, notes: '' }) },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to add entry'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/service-users/wellbeing/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wellbeing', serviceUserId] }); showSnackbar('Entry deleted') },
    onError: (err: any) => showSnackbar(err.response?.data?.message || 'Failed to delete', 'error'),
  })

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>

  const grouped: Record<string, any[]> = {}
  entries.forEach((e: any) => { if (!grouped[e.domain]) grouped[e.domain] = []; grouped[e.domain].push(e) })

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={800}>Wellbeing</Typography>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}
          sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>Record Entry</Button>
      </Stack>
      {entries.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <Typography color="#9CA3AF">No wellbeing entries recorded</Typography>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {Object.entries(grouped).map(([domain, items]) => (
            <Paper key={domain} sx={{ p: 2, borderRadius: 2, border: '1px solid #E5E7EB' }}>
              <Chip label={domain} size="small" sx={{ bgcolor: DOMAIN_COLORS[domain] || '#6B7280', color: 'white', mb: 1 }} />
              <Stack spacing={1.5}>
                {items.map((e: any) => (
                  <Box key={e.id} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <Typography variant="subtitle2" fontWeight={700}>{e.score}/10</Typography>
                        <LinearProgress variant="determinate" value={(e.score || 0) * 10}
                          sx={{ flex: 1, height: 8, borderRadius: 4, bgcolor: '#E5E7EB', '& .MuiLinearProgress-bar': { bgcolor: (e.score || 0) >= 8 ? '#16A34A' : (e.score || 0) >= 5 ? '#D97706' : '#DC2626' } }} />
                      </Stack>
                      {e.notes && <Typography variant="body2" color="#6B7280">{e.notes}</Typography>}
                      <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                        <Typography variant="caption" color="#9CA3AF">{e.recorded_date ? new Date(e.recorded_date).toLocaleDateString('en-GB') : ''}</Typography>
                        {e.recorded_by_name && <Typography variant="caption" color="#9CA3AF">by {e.recorded_by_name}</Typography>}
                      </Stack>
                    </Box>
                    <IconButton size="small" onClick={() => deleteMutation.mutate(e.id)}><DeleteIcon fontSize="small" /></IconButton>
                  </Box>
                ))}
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); setFormError(''); addMutation.mutate(form) }}>
          <DialogTitle sx={{ fontWeight: 800 }}>Record Wellbeing Entry</DialogTitle>
          <DialogContent>
            {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField select label="Domain" fullWidth required value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })}>
                {WELLBEING_DOMAINS.map(d => <MenuItem key={d} value={d} sx={{ textTransform: 'capitalize' }}>{d}</MenuItem>)}
              </TextField>
              <Box>
                <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>Score: {form.score}/10</Typography>
                <input type="range" min={1} max={10} value={form.score}
                  onChange={e => setForm({ ...form, score: parseInt(e.target.value) })}
                  style={{ width: '100%' }} />
              </Box>
              <TextField label="Notes" fullWidth multiline rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addMutation.isPending} sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
              {addMutation.isPending ? <CircularProgress size={20} /> : 'Save'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  )
}

const CONTACT_METHODS = ['phone', 'email', 'letter', 'visit', 'video_call', 'other']
const DIRECTION_OPTIONS = ['inbound', 'outbound']

function CommunicationLogTabInline({ serviceUserId }: { serviceUserId: string }) {
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ contact_name: '', relationship: '', contact_method: 'phone', direction: 'inbound', summary: '', follow_up_actions: '', recorded_date: new Date().toISOString().split('T')[0] })
  const [formError, setFormError] = useState('')
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['communication-log', serviceUserId],
    queryFn: () => api.get(`/service-users/${serviceUserId}/communication-log`).then(r => r.data),
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post(`/service-users/${serviceUserId}/communication-log`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['communication-log', serviceUserId] }); setAddOpen(false); setForm({ contact_name: '', relationship: '', contact_method: 'phone', direction: 'inbound', summary: '', follow_up_actions: '', recorded_date: new Date().toISOString().split('T')[0] }) },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to add entry'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/service-users/communication-log/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['communication-log', serviceUserId] }); showSnackbar('Entry deleted') },
    onError: (err: any) => showSnackbar(err.response?.data?.message || 'Failed to delete', 'error'),
  })

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={800}>Communication Log</Typography>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}
          sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>Add Entry</Button>
      </Stack>
      {entries.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <Typography color="#9CA3AF">No communication entries recorded</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Contact</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Method</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Direction</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Summary</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Recorded By</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{e.contact_name}</Typography>
                    {e.relationship && <Typography variant="caption" color="#6B7280">{e.relationship}</Typography>}
                  </TableCell>
                  <TableCell><Chip label={e.contact_method?.replace(/_/g, ' ')} size="small" variant="outlined" /></TableCell>
                  <TableCell>
                    <Chip label={e.direction} size="small"
                      color={e.direction === 'inbound' ? 'info' : 'primary'}
                      variant="outlined" />
                  </TableCell>
                  <TableCell><Typography variant="body2" noWrap sx={{ maxWidth: 250 }}>{e.summary || '—'}</Typography></TableCell>
                  <TableCell>{e.recorded_date ? new Date(e.recorded_date).toLocaleDateString('en-GB') : '—'}</TableCell>
                  <TableCell>{e.recorded_by_name || '—'}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => deleteMutation.mutate(e.id)}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); setFormError(''); addMutation.mutate(form) }}>
          <DialogTitle sx={{ fontWeight: 800 }}>Add Communication Entry</DialogTitle>
          <DialogContent>
            {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack direction="row" spacing={1}>
                <TextField label="Contact Name" fullWidth required value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} />
                <TextField label="Relationship" fullWidth value={form.relationship} onChange={e => setForm({ ...form, relationship: e.target.value })} />
              </Stack>
              <Stack direction="row" spacing={1}>
                <TextField select label="Contact Method" fullWidth required value={form.contact_method} onChange={e => setForm({ ...form, contact_method: e.target.value })}>
                  {CONTACT_METHODS.map(m => <MenuItem key={m} value={m} sx={{ textTransform: 'capitalize' }}>{m.replace(/_/g, ' ')}</MenuItem>)}
                </TextField>
                <TextField select label="Direction" fullWidth required value={form.direction} onChange={e => setForm({ ...form, direction: e.target.value })}>
                  {DIRECTION_OPTIONS.map(d => <MenuItem key={d} value={d} sx={{ textTransform: 'capitalize' }}>{d}</MenuItem>)}
                </TextField>
              </Stack>
              <TextField label="Summary" fullWidth multiline rows={3} required value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} />
              <TextField label="Follow-up Actions" fullWidth multiline rows={2} value={form.follow_up_actions} onChange={e => setForm({ ...form, follow_up_actions: e.target.value })} />
              <TextField label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.recorded_date} onChange={e => setForm({ ...form, recorded_date: e.target.value })} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addMutation.isPending} sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
              {addMutation.isPending ? <CircularProgress size={20} /> : 'Save'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  )
}

const CAPACITY_STATUSES = ['has_capacity', 'lacks_capacity', 'fluctuating', 'not_assessed']

const CAPACITY_STATUS_COLORS: Record<string, string> = {
  has_capacity: '#16A34A', lacks_capacity: '#DC2626', fluctuating: '#D97706', not_assessed: '#6B7280',
}

function CapacityMcaTabInline({ serviceUserId }: { serviceUserId: string }) {
  const [addOpen, setAddOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ assessment_date: new Date().toISOString().split('T')[0], decision_to_be_made: '', capacity_found: null as boolean | null, capacity_status: 'not_assessed', best_interest_decision: '', best_interest_meeting_date: '', independent_advocate: '', relevant_people_informed: '', review_date: '' })
  const [formError, setFormError] = useState('')
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()

  const { data: assessments = [], isLoading } = useQuery({
    queryKey: ['capacity', serviceUserId],
    queryFn: () => api.get(`/service-users/${serviceUserId}/capacity`).then(r => r.data),
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post(`/service-users/${serviceUserId}/capacity`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['capacity', serviceUserId] }); setAddOpen(false); resetForm() },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to add assessment'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/service-users/capacity/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['capacity', serviceUserId] }); setAddOpen(false); setEditId(null); resetForm() },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to update assessment'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/service-users/capacity/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['capacity', serviceUserId] }); showSnackbar('Assessment deleted') },
    onError: (err: any) => showSnackbar(err.response?.data?.message || 'Failed to delete', 'error'),
  })

  function resetForm() {
    setForm({ assessment_date: new Date().toISOString().split('T')[0], decision_to_be_made: '', capacity_found: null, capacity_status: 'not_assessed', best_interest_decision: '', best_interest_meeting_date: '', independent_advocate: '', relevant_people_informed: '', review_date: '' })
  }

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={800}>MCA / Capacity Assessments</Typography>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => { resetForm(); setEditId(null); setAddOpen(true) }}
          sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>New Assessment</Button>
      </Stack>
      {assessments.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <Typography color="#9CA3AF">No capacity assessments recorded</Typography>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {assessments.map((a: any) => (
            <Paper key={a.id} sx={{ p: 2, borderRadius: 2, border: '1px solid #E5E7EB' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="subtitle2" fontWeight={700}>{a.assessment_date ? new Date(a.assessment_date).toLocaleDateString('en-GB') : '—'}</Typography>
                    <Chip label={a.capacity_found === true ? 'Has Capacity' : a.capacity_found === false ? 'Lacks Capacity' : 'Not Assessed'} size="small"
                      sx={{ bgcolor: a.capacity_found === true ? '#16A34A20' : a.capacity_found === false ? '#DC262620' : '#6B728020', color: a.capacity_found === true ? '#16A34A' : a.capacity_found === false ? '#DC2626' : '#6B7280', fontWeight: 700 }} />
                    <Chip label={a.capacity_status?.replace(/_/g, ' ')} size="small"
                      sx={{ bgcolor: `${CAPACITY_STATUS_COLORS[a.capacity_status] || '#6B7280'}20`, color: CAPACITY_STATUS_COLORS[a.capacity_status] || '#6B7280', fontWeight: 700 }} />
                  </Stack>
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>Decision: {a.decision_to_be_made}</Typography>
                  {a.best_interest_decision && <Typography variant="body2" color="#6B7280">Best Interest Decision: {a.best_interest_decision}</Typography>}
                  {a.independent_advocate && <Typography variant="body2" color="#6B7280">Advocate: {a.independent_advocate}</Typography>}
                  {a.review_date && <Typography variant="caption" color="#9CA3AF" sx={{ mt: 0.5, display: 'block' }}>Review: {new Date(a.review_date).toLocaleDateString('en-GB')}</Typography>}
                </Box>
                <Stack direction="row" spacing={0.5}>
                  <IconButton size="small" onClick={() => {
                    setForm({
                      assessment_date: a.assessment_date?.split('T')[0] || new Date().toISOString().split('T')[0],
                      decision_to_be_made: a.decision_to_be_made || '',
                      capacity_found: a.capacity_found,
                      capacity_status: a.capacity_status || 'not_assessed',
                      best_interest_decision: a.best_interest_decision || '',
                      best_interest_meeting_date: a.best_interest_meeting_date?.split('T')[0] || '',
                      independent_advocate: a.independent_advocate || '',
                      relevant_people_informed: a.relevant_people_informed || '',
                      review_date: a.review_date?.split('T')[0] || '',
                    }); setEditId(a.id); setAddOpen(true)
                  }}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => deleteMutation.mutate(a.id)}><DeleteIcon fontSize="small" /></IconButton>
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      <Dialog open={addOpen} onClose={() => { setAddOpen(false); setEditId(null) }} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => {
          e.preventDefault(); setFormError('')
          if (editId) updateMutation.mutate({ id: editId, data: form })
          else addMutation.mutate(form)
        }}>
          <DialogTitle sx={{ fontWeight: 800 }}>{editId ? 'Edit Assessment' : 'New Capacity Assessment'}</DialogTitle>
          <DialogContent>
            {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Assessment Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.assessment_date} onChange={e => setForm({ ...form, assessment_date: e.target.value })} />
              <TextField label="Decision to be Made" fullWidth multiline rows={2} required value={form.decision_to_be_made} onChange={e => setForm({ ...form, decision_to_be_made: e.target.value })} />
              <Box>
                <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>Capacity Found</Typography>
                <Stack direction="row" spacing={1}>
                  <Button variant={form.capacity_found === true ? 'contained' : 'outlined'} color="success" size="small" onClick={() => setForm({ ...form, capacity_found: true })} sx={{ textTransform: 'none' }}>Yes</Button>
                  <Button variant={form.capacity_found === false ? 'contained' : 'outlined'} color="error" size="small" onClick={() => setForm({ ...form, capacity_found: false })} sx={{ textTransform: 'none' }}>No</Button>
                  <Button variant={form.capacity_found === null ? 'contained' : 'outlined'} color="warning" size="small" onClick={() => setForm({ ...form, capacity_found: null })} sx={{ textTransform: 'none' }}>Not Assessed</Button>
                </Stack>
              </Box>
              <TextField select label="Capacity Status" fullWidth value={form.capacity_status} onChange={e => setForm({ ...form, capacity_status: e.target.value })}>
                {CAPACITY_STATUSES.map(s => <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s.replace(/_/g, ' ')}</MenuItem>)}
              </TextField>
              <TextField label="Best Interest Decision" fullWidth multiline rows={2} value={form.best_interest_decision} onChange={e => setForm({ ...form, best_interest_decision: e.target.value })} />
              <TextField label="Best Interest Meeting Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.best_interest_meeting_date} onChange={e => setForm({ ...form, best_interest_meeting_date: e.target.value })} />
              <TextField label="Independent Advocate" fullWidth value={form.independent_advocate} onChange={e => setForm({ ...form, independent_advocate: e.target.value })} />
              <TextField label="Relevant People Informed" fullWidth multiline rows={2} value={form.relevant_people_informed} onChange={e => setForm({ ...form, relevant_people_informed: e.target.value })} />
              <TextField label="Review Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.review_date} onChange={e => setForm({ ...form, review_date: e.target.value })} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => { setAddOpen(false); setEditId(null) }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addMutation.isPending || updateMutation.isPending} sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
              {(addMutation.isPending || updateMutation.isPending) ? <CircularProgress size={20} /> : (editId ? 'Save' : 'Add Assessment')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  )
}

const PATHWAY_TYPES = ['hospital_admission', 'hospital_discharge', 'short_break', 'assessment_unit', 'transition', 'other']
const PATHWAY_STATUS_OPTIONS = ['active', 'completed', 'cancelled']

const PATHWAY_TYPE_COLORS: Record<string, string> = {
  hospital_admission: '#DC2626', hospital_discharge: '#0891B2', short_break: '#D97706',
  assessment_unit: '#7C3AED', transition: '#16A34A', other: '#6B7280',
}

function CarePathwaysTabInline({ serviceUserId }: { serviceUserId: string }) {
  const [addOpen, setAddOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ pathway_type: 'hospital_admission', title: '', start_date: new Date().toISOString().split('T')[0], end_date: '', location_name: '', referral_reason: '', discharge_notes: '', status: 'active' })
  const [formError, setFormError] = useState('')
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()

  const { data: pathways = [], isLoading } = useQuery({
    queryKey: ['care-pathways', serviceUserId],
    queryFn: () => api.get(`/service-users/${serviceUserId}/care-pathways`).then(r => r.data),
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post(`/service-users/${serviceUserId}/care-pathways`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['care-pathways', serviceUserId] }); setAddOpen(false); resetForm() },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to add pathway'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/service-users/care-pathways/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['care-pathways', serviceUserId] }); setAddOpen(false); setEditId(null); resetForm() },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to update pathway'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/service-users/care-pathways/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['care-pathways', serviceUserId] }); showSnackbar('Pathway deleted') },
    onError: (err: any) => showSnackbar(err.response?.data?.message || 'Failed to delete', 'error'),
  })

  function resetForm() {
    setForm({ pathway_type: 'hospital_admission', title: '', start_date: new Date().toISOString().split('T')[0], end_date: '', location_name: '', referral_reason: '', discharge_notes: '', status: 'active' })
  }

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>

  const active = pathways.filter((p: any) => p.status === 'active')
  const completed = pathways.filter((p: any) => p.status === 'completed' || p.status === 'cancelled')

  const renderCard = (p: any) => (
    <Paper key={p.id} sx={{ p: 2, borderRadius: 2, border: '1px solid #E5E7EB' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <Typography variant="subtitle2" fontWeight={700}>{p.title}</Typography>
            <Chip label={p.pathway_type?.replace(/_/g, ' ')} size="small" sx={{ bgcolor: `${PATHWAY_TYPE_COLORS[p.pathway_type] || '#6B7280'}20`, color: PATHWAY_TYPE_COLORS[p.pathway_type] || '#6B7280', fontWeight: 700 }} />
            <Chip label={p.status} size="small" color={p.status === 'active' ? 'success' : p.status === 'completed' ? 'info' : 'error'} />
          </Stack>
          <Stack direction="row" spacing={2} sx={{ mb: 0.5 }}>
            <Typography variant="caption" color="#6B7280">{p.start_date ? new Date(p.start_date).toLocaleDateString('en-GB') : '—'}{p.end_date ? ` → ${new Date(p.end_date).toLocaleDateString('en-GB')}` : ''}</Typography>
            {p.location_name && <Typography variant="caption" color="#6B7280">{p.location_name}</Typography>}
          </Stack>
          {p.referral_reason && <Typography variant="body2" color="#6B7280">{p.referral_reason}</Typography>}
          {p.discharge_notes && <Typography variant="body2" color="#6B7280" sx={{ mt: 0.5 }}>{p.discharge_notes}</Typography>}
        </Box>
        <Stack direction="row" spacing={0.5}>
          <IconButton size="small" onClick={() => {
            setForm({
              pathway_type: p.pathway_type || 'hospital_admission', title: p.title || '',
              start_date: p.start_date?.split('T')[0] || '', end_date: p.end_date?.split('T')[0] || '',
              location_name: p.location_name || '', referral_reason: p.referral_reason || '',
              discharge_notes: p.discharge_notes || '', status: p.status || 'active',
            }); setEditId(p.id); setAddOpen(true)
          }}><EditIcon fontSize="small" /></IconButton>
          <IconButton size="small" onClick={() => deleteMutation.mutate(p.id)}><DeleteIcon fontSize="small" /></IconButton>
        </Stack>
      </Stack>
    </Paper>
  )

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={800}>Care Pathways</Typography>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => { resetForm(); setEditId(null); setAddOpen(true) }}
          sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>Add Pathway</Button>
      </Stack>
      {pathways.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <Typography color="#9CA3AF">No care pathways recorded</Typography>
        </Paper>
      ) : (
        <Stack spacing={3}>
          {active.length > 0 && (
            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Active</Typography>
              <Stack spacing={1.5}>{active.map(renderCard)}</Stack>
            </Box>
          )}
          {completed.length > 0 && (
            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: '#6B7280' }}>Completed / Cancelled</Typography>
              <Stack spacing={1.5}>{completed.map(renderCard)}</Stack>
            </Box>
          )}
        </Stack>
      )}

      <Dialog open={addOpen} onClose={() => { setAddOpen(false); setEditId(null) }} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => {
          e.preventDefault(); setFormError('')
          if (editId) updateMutation.mutate({ id: editId, data: form })
          else addMutation.mutate(form)
        }}>
          <DialogTitle sx={{ fontWeight: 800 }}>{editId ? 'Edit Pathway' : 'Add Care Pathway'}</DialogTitle>
          <DialogContent>
            {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField select label="Pathway Type" fullWidth required value={form.pathway_type} onChange={e => setForm({ ...form, pathway_type: e.target.value })}>
                {PATHWAY_TYPES.map(t => <MenuItem key={t} value={t} sx={{ textTransform: 'capitalize' }}>{t.replace(/_/g, ' ')}</MenuItem>)}
              </TextField>
              <TextField label="Title" fullWidth required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              <Stack direction="row" spacing={1}>
                <TextField label="Start Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
                <TextField label="End Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
              </Stack>
              <TextField label="Location" fullWidth value={form.location_name} onChange={e => setForm({ ...form, location_name: e.target.value })} />
              <TextField label="Referral Reason" fullWidth multiline rows={2} value={form.referral_reason} onChange={e => setForm({ ...form, referral_reason: e.target.value })} />
              <TextField label="Discharge Notes" fullWidth multiline rows={2} value={form.discharge_notes} onChange={e => setForm({ ...form, discharge_notes: e.target.value })} />
              <TextField select label="Status" fullWidth value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {PATHWAY_STATUS_OPTIONS.map(s => <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s}</MenuItem>)}
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => { setAddOpen(false); setEditId(null) }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addMutation.isPending || updateMutation.isPending} sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
              {(addMutation.isPending || updateMutation.isPending) ? <CircularProgress size={20} /> : (editId ? 'Save' : 'Add Pathway')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  )
}

const DISCHARGE_CATEGORIES = ['documentation', 'medication', 'equipment', 'notification', 'property', 'financial', 'other']

function DischargeChecklistTabInline({ serviceUserId }: { serviceUserId: string }) {
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ item_text: '', category: 'documentation' })
  const [formError, setFormError] = useState('')
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['discharge-checklist', serviceUserId],
    queryFn: () => api.get(`/service-users/${serviceUserId}/discharge-checklist`).then(r => r.data),
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post(`/service-users/${serviceUserId}/discharge-checklist`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['discharge-checklist', serviceUserId] }); setAddOpen(false); setForm({ item_text: '', category: 'documentation' }) },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to add item'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) => api.patch(`/service-users/discharge-checklist/${id}`, { completed }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['discharge-checklist', serviceUserId] }),
    onError: (err: any) => showSnackbar(err.response?.data?.message || 'Failed to update', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/service-users/discharge-checklist/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['discharge-checklist', serviceUserId] }); showSnackbar('Item deleted') },
    onError: (err: any) => showSnackbar(err.response?.data?.message || 'Failed to delete', 'error'),
  })

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>

  const total = items.length
  const completedCount = items.filter((i: any) => i.completed).length
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0

  const grouped: Record<string, any[]> = {}
  items.forEach((i: any) => { const cat = i.category || 'other'; if (!grouped[cat]) grouped[cat] = []; grouped[cat].push(i) })

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={800}>Discharge Checklist</Typography>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => { setForm({ item_text: '', category: 'documentation' }); setAddOpen(true) }}
          sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>Add Item</Button>
      </Stack>
      {total > 0 && (
        <Paper sx={{ p: 2, mb: 2, borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <LinearProgress variant="determinate" value={pct}
              sx={{ flex: 1, height: 10, borderRadius: 5, bgcolor: '#E5E7EB', '& .MuiLinearProgress-bar': { bgcolor: pct === 100 ? '#16A34A' : '#0F4C81' } }} />
            <Typography variant="body2" fontWeight={700}>{completedCount}/{total} ({pct}%)</Typography>
          </Stack>
        </Paper>
      )}
      {items.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <Typography color="#9CA3AF">No discharge checklist items</Typography>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {Object.entries(grouped).map(([category, catItems]) => (
            <Paper key={category} sx={{ p: 2, borderRadius: 2, border: '1px solid #E5E7EB' }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, textTransform: 'capitalize' }}>{category.replace(/_/g, ' ')}</Typography>
              <Stack spacing={1}>
                {catItems.map((item: any) => (
                  <Stack key={item.id} direction="row" alignItems="center" spacing={1}>
                    <IconButton size="small" onClick={() => toggleMutation.mutate({ id: item.id, completed: !item.completed })} disabled={toggleMutation.isPending}>
                      {item.completed ? <CheckCircleIcon sx={{ color: '#16A34A' }} /> : <UncheckedIcon sx={{ color: '#9CA3AF' }} />}
                    </IconButton>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ textDecoration: item.completed ? 'line-through' : 'none', color: item.completed ? '#9CA3AF' : 'inherit' }}>
                        {item.item_text}
                      </Typography>
                      {item.completed && item.completed_by_name && (
                        <Typography variant="caption" color="#9CA3AF">Completed by {item.completed_by_name}{item.completed_at ? ` on ${new Date(item.completed_at).toLocaleDateString('en-GB')}` : ''}</Typography>
                      )}
                    </Box>
                    <IconButton size="small" onClick={() => deleteMutation.mutate(item.id)}><DeleteIcon fontSize="small" /></IconButton>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); setFormError(''); addMutation.mutate(form) }}>
          <DialogTitle sx={{ fontWeight: 800 }}>Add Checklist Item</DialogTitle>
          <DialogContent>
            {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Item" fullWidth required value={form.item_text} onChange={e => setForm({ ...form, item_text: e.target.value })} />
              <TextField select label="Category" fullWidth required value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {DISCHARGE_CATEGORIES.map(c => <MenuItem key={c} value={c} sx={{ textTransform: 'capitalize' }}>{c.replace(/_/g, ' ')}</MenuItem>)}
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addMutation.isPending} sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
              {addMutation.isPending ? <CircularProgress size={20} /> : 'Add Item'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  )
}

function MoodChartTabInline({ serviceUserId }: { serviceUserId: string }) {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ domain: 'mood', score: 7, recorded_date: new Date().toISOString().split('T')[0], notes: '' })
  const [formError, setFormError] = useState('')

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['wellbeing', serviceUserId],
    queryFn: () => api.get(`/service-users/${serviceUserId}/wellbeing`).then(r => r.data),
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post(`/service-users/${serviceUserId}/wellbeing`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wellbeing', serviceUserId] }); setAddOpen(false); setForm({ domain: 'mood', score: 7, recorded_date: new Date().toISOString().split('T')[0], notes: '' }) },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to save'),
  })

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const recentEntries = entries.filter((e: any) => {
    const d = new Date(e.recorded_date)
    return d >= thirtyDaysAgo
  })

  const grouped: Record<string, any[]> = {}
  recentEntries.forEach((e: any) => {
    if (!grouped[e.domain]) grouped[e.domain] = []
    grouped[e.domain].push(e)
  })

  const scoreColor = (score: number) => score >= 8 ? '#16A34A' : score >= 5 ? '#D97706' : '#DC2626'

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Mood Chart — Last 30 Days</Typography>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => { setForm({ domain: 'mood', score: 7, recorded_date: new Date().toISOString().split('T')[0], notes: '' }); setFormError(''); setAddOpen(true) }}
          sx={{ bgcolor: '#0F4C81', textTransform: 'none', borderRadius: 1.5, px: 2 }}>Add Entry</Button>
      </Stack>

      {entries.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <Typography color="#9CA3AF">No wellbeing data yet</Typography>
          <Typography variant="caption" color="#6B7280" sx={{ mt: 0.5, display: 'block' }}>Record mood, engagement, sleep and other wellbeing scores to see trends here.</Typography>
        </Paper>
      ) : Object.keys(grouped).length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <Typography color="#9CA3AF">No entries in the last 30 days</Typography>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {Object.entries(grouped).map(([domain, items]) => (
            <Paper key={domain} sx={{ p: 2, borderRadius: 2, border: '1px solid #E5E7EB', transition: 'box-shadow 0.15s', '&:hover': { boxShadow: '0 1px 6px rgba(0,0,0,0.06)' } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Chip label={domain} size="small" sx={{ bgcolor: DOMAIN_COLORS[domain] || '#6B7280', color: 'white', fontWeight: 700 }} />
                <Typography variant="caption" color="#6B7280">{items.length} entries</Typography>
              </Stack>
              <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-end', height: 80 }}>
                {items.sort((a: any, b: any) => new Date(a.recorded_date).getTime() - new Date(b.recorded_date).getTime()).map((e: any) => (
                  <Tooltip key={e.id} title={`${e.score}/10 — ${new Date(e.recorded_date).toLocaleDateString('en-GB')}${e.notes ? `: ${e.notes}` : ''}`}>
                    <Box sx={{ width: 14, height: `${(e.score / 10) * 100}%`, minHeight: 4, bgcolor: scoreColor(e.score), borderRadius: 0.75, cursor: 'pointer', transition: 'opacity 0.15s', '&:hover': { opacity: 0.7 } }} />
                  </Tooltip>
                ))}
              </Box>
              <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
                <Typography variant="caption" color="#9CA3AF">
                  {items.length > 0 ? new Date(items[0].recorded_date).toLocaleDateString('en-GB') : ''}
                </Typography>
                <Typography variant="caption" color="#9CA3AF">
                  {items.length > 0 ? new Date(items[items.length - 1].recorded_date).toLocaleDateString('en-GB') : ''}
                </Typography>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={e => { e.preventDefault(); addMutation.mutate(form) }}>
          <DialogTitle sx={{ fontWeight: 800 }}>Add Wellbeing Entry</DialogTitle>
          <DialogContent>
            {formError && <Alert severity="error" sx={{ mb: 2, borderRadius: 1 }}>{formError}</Alert>}
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <TextField select label="Domain" fullWidth required value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}>
                {['mood', 'engagement', 'sleep', 'appetite', 'pain', 'mobility', 'social', 'overall'].map(d => (
                  <MenuItem key={d} value={d} sx={{ textTransform: 'capitalize' }}>{d}</MenuItem>
                ))}
              </TextField>
              <Box>
                <Typography variant="body2" color="#6B7280" sx={{ mb: 1 }}>Score: <strong>{form.score}</strong>/10</Typography>
                <Rating value={form.score} max={10}
                  onChange={(_, v) => setForm(f => ({ ...f, score: v || 5 }))}
                  sx={{ '& .MuiRatingIcon': { fontSize: 32 } }} />
              </Box>
              <TextField label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.recorded_date}
                onChange={e => setForm(f => ({ ...f, recorded_date: e.target.value }))} />
              <TextField label="Notes (optional)" fullWidth multiline rows={2} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="How are they today?" />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setAddOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addMutation.isPending}
              sx={{ bgcolor: '#0F4C81', textTransform: 'none', borderRadius: 1.5 }}>
              {addMutation.isPending ? <CircularProgress size={20} /> : 'Save Entry'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  )
}

function AuditTrailTabInline({ serviceUserId }: { serviceUserId: string }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-trail', serviceUserId],
    queryFn: () => api.get('/audit/logs', { params: { entity_type: 'service_user', entity_id: serviceUserId } }).then(r => r.data),
  })
  if (isLoading) return <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', mt: 4 }} />
  if (!logs.length) return <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB' }}><Typography color="#9CA3AF">No audit trail entries</Typography></Paper>
  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 2 }}>Audit Trail</Typography>
      <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #E5E7EB' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>User</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((log: any) => (
              <TableRow key={log.id}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString('en-GB')}</TableCell>
                <TableCell>{log.user_name || log.user_id}</TableCell>
                <TableCell>
                  <Chip label={log.action} size="small" color={log.action === 'create' ? 'success' : log.action === 'update' ? 'primary' : 'error'} variant="outlined" />
                </TableCell>
                <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {log.details?.summary || `${log.entity_type} ${log.action}d`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
