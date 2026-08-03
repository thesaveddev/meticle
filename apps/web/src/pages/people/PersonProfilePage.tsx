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
  People as PeopleIcon, AutoAwesome as AiIcon, Mic as MicIcon, Stop as StopIcon,
  Psychology as PsychologyIcon, Flag as FlagIcon, TrendingUp as TrendIcon,
  Lightbulb as LightbulbIcon, Save as SaveIcon, Visibility as VisibilityIcon,
  Description as FileIcon, Download as DownloadIcon, Close as CloseIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useSnackbar } from '../../context/SnackbarContext'
import HealthTab from './HealthTab'
import BodyMapTab from './BodyMapTab'
import MemoryBookTab from './MemoryBookTab'
import GoalsPage from '../goals/GoalsPage'
import { LinearProgress, Rating } from '@mui/material'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer as RechartsResponsiveContainer, BarChart, Bar, XAxis as RechartsXAxis, YAxis as RechartsYAxis, CartesianGrid as RechartsCartesianGrid, Tooltip as RechartsTooltip, Cell } from 'recharts'

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

const EMPTY_PLAN_FORM = {
  title: '', category: '', description: '', risk_assessment: '', review_date: '',
  mobility_level: '', mobility_aids: '', communication_needs: '', capacity_status: '',
  sleep_pattern: '', emergency_info: '', personal_goals: '', likes_dislikes: '',
  cultural_needs: '', file_url: '', file_name: '',
  sections: { contributors: [] as Contributor[], what_tried: '', what_learned: '', what_pleased: '', what_concerned: '', next_steps: '' } as { contributors: Contributor[]; what_tried: string; what_learned: string; what_pleased: string; what_concerned: string; next_steps: string },
}

interface Contributor { name: string; role: string }

const SUPPORT_LEVEL_COLORS: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'> = {
  independent: 'success',
  minimal: 'info',
  one_to_one: 'primary',
  two_to_one: 'warning',
  three_to_one: 'error',
  complex: 'error',
}

const toDateInput = (v: any) => {
  if (!v) return ''
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const d = new Date(v)
  if (isNaN(d.getTime())) return String(v)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const EDIT_DATE_FIELDS = ['date_of_birth', 'admission_date', 'dnacpr_date', 'dnacpr_review_date', 'advance_decision_date', 'discharge_date']

export default function PersonProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()
  const [tab, setTab] = useState(0)
  const [activeCategory, setActiveCategory] = useState(0)
  const [editOpen, setEditOpen] = useState(false)
  const [addPlanOpen, setAddPlanOpen] = useState(false)
  const [viewPlan, setViewPlan] = useState<any>(null)
  const [addNoteOpen, setAddNoteOpen] = useState(false)
  const [addRiskOpen, setAddRiskOpen] = useState(false)
  const [addContactOpen, setAddContactOpen] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [planForm, setPlanForm] = useState({ ...EMPTY_PLAN_FORM })
  const [planTab, setPlanTab] = useState(0)
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

  // AI Daily Notes state
  const [aiMode, setAiMode] = useState(false)
  const [aiTranscript, setAiTranscript] = useState('')
  const [aiRecording, setAiRecording] = useState(false)
  const [aiResult, setAiResult] = useState<any>(null)
  const [aiEditedContent, setAiEditedContent] = useState('')
  const [aiShowResults, setAiShowResults] = useState(false)
  const [aiError, setAiError] = useState('')
  const aiRecognitionRef = useRef<any>(null)

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
    queryKey: ['person', id],
    queryFn: () => api.get(`/people/${id}`).then(r => r.data),
    enabled: !!id,
  })

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => api.get('/settings/locations').then(r => r.data),
  })

  const { data: portalMembers = [] } = useQuery({
    queryKey: ['family-members', id],
    queryFn: () => api.get('/family-portal/members', { params: { person_id: id } }).then(r => r.data),
    enabled: !!id,
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.patch(`/people/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person', id] }); setEditOpen(false) },
    onError: (err: any) => setError(err.response?.data?.message || 'Update failed'),
  })

  const addPlanMutation = useMutation({
    mutationFn: (data: any) => api.post(`/people/${id}/care-plans`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person', id] }); setAddPlanOpen(false); setPlanForm({ ...EMPTY_PLAN_FORM }) },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to add care plan'),
  })

  const addNoteMutation = useMutation({
    mutationFn: (data: any) => api.post(`/people/${id}/daily-notes`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person', id] }); setAddNoteOpen(false); setNoteForm({ note_date: new Date().toISOString().split('T')[0], shift: 'day', category: '', content: '', support_level: '' }) },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to add note'),
  })

  const addRiskMutation = useMutation({
    mutationFn: (data: any) => api.post(`/people/${id}/risk-assessments`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person', id] }); setAddRiskOpen(false); setRiskForm({ type: '', risk_level: 'medium', details: '', mitigation_actions: '', review_date: '' }) },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to add risk assessment'),
  })

  const addContactMutation = useMutation({
    mutationFn: (data: any) => api.post(`/people/${id}/family-contacts`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person', id] }); setAddContactOpen(false); setContactForm({ name: '', relationship: '', phone: '', email: '', is_emergency_contact: false }) },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to add contact'),
  })

  const deleteContactMutation = useMutation({
    mutationFn: (contactId: string) => api.delete(`/people/family-contacts/${contactId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person', id] }); showSnackbar('Contact removed') },
    onError: (err: any) => showSnackbar(err.response?.data?.message || 'Failed to delete contact', 'error'),
  })

  const updatePlanMutation = useMutation({
    mutationFn: ({ planId, data }: { planId: string; data: any }) => api.patch(`/people/care-plans/${planId}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person', id] }); setAddPlanOpen(false); setEditPlanId(null); setPlanForm({ ...EMPTY_PLAN_FORM }) },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to update care plan'),
  })

  const deletePlanMutation = useMutation({
    mutationFn: (planId: string) => api.delete(`/people/care-plans/${planId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['person', id] }),
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to delete care plan'),
  })

  const updateNoteMutation = useMutation({
    mutationFn: ({ noteId, data }: { noteId: string; data: any }) => api.patch(`/people/daily-notes/${noteId}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person', id] }); setEditNoteId(null); setNoteForm({ note_date: new Date().toISOString().split('T')[0], shift: 'day', category: '', content: '', support_level: '' }) },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to update note'),
  })

  const updateRiskMutation = useMutation({
    mutationFn: ({ riskId, data }: { riskId: string; data: any }) => api.patch(`/people/risk-assessments/${riskId}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person', id] }); setEditRiskId(null); setRiskForm({ type: '', risk_level: 'medium', details: '', mitigation_actions: '', review_date: '' }) },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to update risk assessment'),
  })

  const deleteRiskMutation = useMutation({
    mutationFn: (riskId: string) => api.delete(`/people/risk-assessments/${riskId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['person', id] }),
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to delete risk assessment'),
  })

  const updateContactMutation = useMutation({
    mutationFn: ({ contactId, data }: { contactId: string; data: any }) => api.patch(`/people/family-contacts/${contactId}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person', id] }); setContactEditId(null); setContactForm({ name: '', relationship: '', phone: '', email: '', is_emergency_contact: false }) },
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

  // AI Daily Notes mutations
  const aiGenerateMutation = useMutation({
    mutationFn: (data: any) => api.post('/ai/daily-notes/generate', data),
    onSuccess: (res) => {
      setAiResult(res.data.result)
      setAiEditedContent(res.data.result?.daily_note?.content || '')
      setAiShowResults(true)
    },
    onError: (e: any) => setAiError(e.response?.data?.error?.message || 'AI generation failed'),
  })

  const aiApproveMutation = useMutation({
    mutationFn: (data: any) => api.post('/ai/daily-notes/approve', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['person', id] })
      setAddNoteOpen(false)
      setAiMode(false)
      setAiResult(null)
      setAiTranscript('')
      setAiEditedContent('')
      setAiShowResults(false)
      showSnackbar('Daily note saved successfully')
    },
    onError: (e: any) => setAiError(e.response?.data?.error?.message || 'Failed to save'),
  })

  const aiAnalyzeNoteMutation = useMutation({
    mutationFn: (noteId: string) => api.post(`/ai/daily-notes/${noteId}/analyze`),
    onSuccess: (res) => {
      const r = res.data.result
      setViewNote((prev: any) => prev ? { ...prev,
        generated_by_ai: true,
        ai_risk_level: r.risk_level,
        ai_mood_analysis: r.mood_analysis,
        ai_safeguarding_flags: r.safeguarding_flags,
        ai_care_plan_updates: r.care_plan_updates,
        ai_interventions: r.interventions_suggested,
        ai_follow_up_required: r.follow_up_required,
        ai_follow_up_details: r.follow_up_details,
      } : null)
      queryClient.invalidateQueries({ queryKey: ['person', id] })
      showSnackbar('AI analysis complete')
    },
    onError: (e: any) => setAiError(e.response?.data?.error?.message || 'Analysis failed'),
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState('')

  const uploadPhotoMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('photo', file)
      return api.post(`/people/${id}/photo`, fd)
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['person', id] })
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

  const viewFileInNewTab = async (url: string) => {
    try {
      const token = localStorage.getItem('accessToken')
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const w = window.open(blobUrl, '_blank', 'noopener,noreferrer')
      if (!w) {
        const a = document.createElement('a')
        a.href = blobUrl
        a.target = '_blank'
        a.rel = 'noopener noreferrer'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
    } catch {
      const w = window.open(url, '_blank', 'noopener,noreferrer')
      if (!w) {
        const a = document.createElement('a')
        a.href = url
        a.target = '_blank'
        a.rel = 'noopener noreferrer'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
    }
  }

  const viewCarePlan = (cp: any) => {
    setViewPlan(cp)
  }

  const closeCarePlanView = () => {
    setViewPlan(null)
  }

  useEffect(() => {
    if (user?.photo_url) {
      loadPhotoToBlob(user.photo_url)
    }
    return () => { if (photoUrl) URL.revokeObjectURL(photoUrl) }
  }, [user?.photo_url])

  // AI Daily Notes helper functions
  const startRecordingFor = (onTranscript: (t: string) => void) => {
    setAiError('')
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) { setAiError('Voice input not supported on this browser. Try Chrome.'); return }
    const rec = new SpeechRecognition()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-GB'
    rec.onresult = (e: any) => {
      let full = ''
      for (let i = e.resultIndex; i < e.results.length; i++) full += e.results[i][0].transcript
      onTranscript(full)
    }
    rec.onerror = (e: any) => { setAiError(`Voice error: ${e.error}`); setAiRecording(false) }
    rec.onend = () => setAiRecording(false)
    aiRecognitionRef.current = rec
    rec.start()
    setAiRecording(true)
  }

  const startAiRecording = () => startRecordingFor(setAiTranscript)
  const startNoteDictation = () => startRecordingFor(t => setNoteForm(f => ({ ...f, content: t })))

  const stopAiRecording = () => {
    aiRecognitionRef.current?.stop()
    setAiRecording(false)
  }

  const handleAiGenerate = () => {
    if (!aiTranscript.trim() || !id) { setAiError('Please enter your observations'); return }
    setAiError('')
    setAiResult(null)
    aiGenerateMutation.mutate({
      personId: id,
      staffInput: aiTranscript.trim(),
      shift: noteForm.shift,
      noteDate: noteForm.note_date,
    })
  }

  const handleAiApprove = () => {
    if (!aiResult || !id) return
    aiApproveMutation.mutate({
      personId: id,
      dailyNote: {
        content: aiEditedContent || aiResult.daily_note?.content || '',
        shift: aiResult.daily_note?.shift || noteForm.shift,
        category: aiResult.daily_note?.category || noteForm.category || 'wellbeing',
        support_level: noteForm.support_level || '',
      },
      moodAnalysis: aiResult.mood_analysis,
      safeguardingFlags: aiResult.safeguarding_flags,
      carePlanUpdates: aiResult.care_plan_updates,
      interventionsSuggested: aiResult.interventions_suggested,
      riskLevel: aiResult.risk_level,
      followUpRequired: aiResult.follow_up_required,
      followUpDetails: aiResult.follow_up_details,
      noteDate: noteForm.note_date,
    })
  }

  const getMoodEmoji = (score?: number) => {
    if (!score) return '😐'
    if (score >= 8) return '😊'
    if (score >= 6) return '🙂'
    if (score >= 4) return '😐'
    if (score >= 2) return '😟'
    return '😢'
  }

  const resetAiMode = () => {
    setAiMode(false)
    setAiTranscript('')
    setAiResult(null)
    setAiEditedContent('')
    setAiShowResults(false)
    setAiError('')
    setAiRecording(false)
    aiRecognitionRef.current?.stop()
  }

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /></Box>
  if (!user) return <Alert severity="error">Person not found</Alert>

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
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/people')} sx={{ color: '#6B7280', textTransform: 'none', fontWeight: 600 }}>
          Back to People
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
                {user.location_id && locations.find((l: any) => l.id === user.location_id) && <Chip label={locations.find((l: any) => l.id === user.location_id).name} size="small" variant="outlined" sx={{ borderRadius: 1 }} />}
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
          <Button startIcon={<EditIcon />} variant="outlined" size="small" onClick={() => {
            const f: any = { ...user }
            for (const k of EDIT_DATE_FIELDS) f[k] = toDateInput(f[k])
            setEditForm(f); setEditOpen(true)
          }}
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
      {tab === 1 && <TimelineTab personId={id!} />}

      {/* Tab: Care Plans */}
      {tab === 2 && (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Care Plans</Typography>
            <Button size="small" variant="contained" startIcon={<AddIcon />}
              onClick={() => { setPlanForm({ ...EMPTY_PLAN_FORM }); setEditPlanId(null); setAddPlanOpen(true) }}
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
                        <Tooltip title="View care plan">
                          <IconButton size="small" onClick={() => viewCarePlan(cp)}>
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <IconButton size="small" onClick={() => { setPlanForm({ title: cp.title, category: cp.category, description: cp.description || '', risk_assessment: cp.risk_assessment || '', review_date: cp.review_date || '', mobility_level: cp.mobility_level || '', mobility_aids: cp.mobility_aids || '', communication_needs: cp.communication_needs || '', capacity_status: cp.capacity_status || '', sleep_pattern: cp.sleep_pattern || '', emergency_info: cp.emergency_info || '', personal_goals: cp.personal_goals || '', likes_dislikes: cp.likes_dislikes || '', cultural_needs: cp.cultural_needs || '', file_url: cp.file_url || '', file_name: cp.file_name || '', sections: cp.sections || { ...EMPTY_PLAN_FORM.sections } }); setEditPlanId(cp.id); setPlanTab(0); setAddPlanOpen(true) }}>
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
            <Stack direction="row" spacing={1}>
              <Tooltip title="Write with AI">
                <IconButton size="small" onClick={() => { resetAiMode(); setAiMode(true); setNoteForm({ note_date: new Date().toISOString().split('T')[0], shift: 'day', category: '', content: '', support_level: '' }); setEditNoteId(null); setAddNoteOpen(true) }}
                  sx={{ bgcolor: '#7C3AED', color: '#fff', borderRadius: 1.5, width: 32, height: 32, '&:hover': { bgcolor: '#6D28D9' } }}>
                  <AiIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => { resetAiMode(); setNoteForm({ note_date: new Date().toISOString().split('T')[0], shift: 'day', category: '', content: '', support_level: '' }); setEditNoteId(null); setAddNoteOpen(true) }}
                sx={{ bgcolor: '#0F4C81', textTransform: 'none', borderRadius: 1.5, px: 2 }}>Add Note</Button>
            </Stack>
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
                      {n.generated_by_ai && (
                        <Chip icon={<AiIcon sx={{ fontSize: 12 }} />} label="AI" size="small"
                          sx={{ height: 20, fontSize: 10, bgcolor: '#F3E8FF', color: '#7C3AED', fontWeight: 700, '& .MuiChip-icon': { color: '#7C3AED' } }} />
                      )}
                      <Typography variant="caption" color="#6B7280">{n.note_date ? new Date(n.note_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</Typography>
                    </Stack>
                    <Typography variant="caption" color="#9CA3AF" sx={{ fontWeight: 500 }}>{n.author_name || ''}</Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: '#374151', lineHeight: 1.6 }}>{n.content}</Typography>
                  {n.generated_by_ai && n.ai_risk_level && (
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.75 }}>
                      {n.ai_mood_analysis && <Typography variant="caption" color="#7C3AED">{getMoodEmoji(n.ai_mood_analysis.mood_score)} Mood {n.ai_mood_analysis.mood_score}/10</Typography>}
                      <Chip label={`${n.ai_risk_level} risk`} size="small" color={n.ai_risk_level === 'high' || n.ai_risk_level === 'critical' ? 'error' : n.ai_risk_level === 'medium' ? 'warning' : 'success'}
                        sx={{ height: 18, fontSize: 10 }} />
                      {n.ai_safeguarding_flags?.length > 0 && <Chip label={`${n.ai_safeguarding_flags.length} safeguarding`} size="small" color="error" variant="outlined" sx={{ height: 18, fontSize: 10 }} />}
                      {n.ai_follow_up_required && <Chip label="follow-up" size="small" color="warning" variant="outlined" sx={{ height: 18, fontSize: 10 }} />}
                    </Stack>
                  )}
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
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle1" fontWeight={800}>Family & Contacts</Typography>
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => { setContactForm({ name: '', relationship: '', phone: '', email: '', is_emergency_contact: false }); setAddContactOpen(true) }}
              sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>Add Contact</Button>
          </Stack>
          <Typography variant="body2" color="#6B7280" sx={{ mb: 2 }}>Add family members and their contact details, then invite them to the Family Portal so they can view care notes and plans securely.</Typography>

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
                    inlineInvitePortalMutation.mutate({ name: c.name, email: c.email, relationship: c.relationship || '', phone: c.phone || '', person_id: id })
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
      {tab === 6 && <HealthTab personId={id!} />}

      {/* Tab: Body Map */}
      {tab === 7 && <BodyMapTab personId={id!} />}

      {/* Tab: Memory Book */}
      {tab === 8 && <MemoryBookTab personId={id!} />}

      {/* Tab: Goals */}
      {tab === 9 && <GoalsPage personId={id!} />}

      {/* Tab: Care Assessments */}
      {tab === 10 && <CareAssessmentsTabInline personId={id!} />}

      {/* Tab: Room Checks */}
      {tab === 11 && <RoomChecksTab roomNumber={user.room_number} />}

      {/* Tab: Clinical Scores */}
      {tab === 12 && <ClinicalScoresTab personId={id!} />}

      {/* Tab: Documents */}
      {tab === 13 && <DocumentsTab personId={id!} />}

      {/* Tab: Wellbeing */}
      {tab === 14 && <WellbeingTabInline personId={id!} />}

      {/* Tab: Communication Log */}
      {tab === 15 && <CommunicationLogTabInline personId={id!} />}

      {/* Tab: MCA / Capacity */}
      {tab === 16 && <CapacityMcaTabInline personId={id!} />}

      {/* Tab: Care Pathways */}
      {tab === 17 && <CarePathwaysTabInline personId={id!} />}

      {/* Tab: Discharge Checklist */}
      {tab === 18 && <DischargeChecklistTabInline personId={id!} />}

      {/* Tab: Mood Chart */}
      {tab === 19 && <MoodChartTabInline personId={id!} />}

      {/* Tab: Audit Trail */}
      {tab === 20 && <AuditTrailTabInline personId={id!} />}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); updateMutation.mutate(editForm) }}>
          <DialogTitle sx={{ fontWeight: 800 }}>Edit Person</DialogTitle>
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
              <TextField select label="Location" fullWidth value={editForm.location_id || ''} onChange={e => setEditForm({ ...editForm, location_id: e.target.value })}>
                <MenuItem value="">None specified</MenuItem>
                {locations.map((l: any) => (
                  <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
                ))}
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
              {editForm.support_level === 'complex' && (
                <TextField label="Minimum Staff Required" type="number" inputProps={{ min: 1, max: 6 }}
                  fullWidth required helperText="How many staff are required to support this person safely at all times?"
                  value={editForm.min_staff_required || ''} onChange={e => setEditForm({ ...editForm, min_staff_required: e.target.value })} />
              )}
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
       <Dialog open={addPlanOpen} onClose={() => { setAddPlanOpen(false); setEditPlanId(null) }} maxWidth="md" fullWidth key={editPlanId || 'new'}>
        <Box component="form" onSubmit={(e: React.FormEvent) => {
          e.preventDefault()
          if (editPlanId) {
            updatePlanMutation.mutate({ planId: editPlanId, data: planForm })
          } else {
            addPlanMutation.mutate(planForm)
          }
        }}>
          <DialogTitle sx={{ fontWeight: 800, pb: 0 }}>{editPlanId ? 'Edit Care Plan' : 'Add Care Plan'}</DialogTitle>
          <Tabs value={planTab} onChange={(_, v) => setPlanTab(v)} sx={{ borderBottom: 1, borderColor: '#E5E7EB', px: 3, mb: 1 }}>
            <Tab label="Details" />
            <Tab label="Person-Centred Plan" />
          </Tabs>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {planTab === 0 ? (
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
                  setPlanForm({ ...planForm, file_url: res.data.url, file_name: res.data.originalName || file.name })
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
                    <Chip label={planForm.file_name || planForm.file_url.split('/').pop() || 'Attached'} size="small" color="primary" variant="outlined" />
                    <IconButton size="small" onClick={() => setPlanForm({ ...planForm, file_url: '' })}><DeleteIcon fontSize="small" /></IconButton>
                  </>
                )}
              </Stack>
            </Stack>
            ) : (
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <Typography variant="subtitle1" fontWeight={700}>Who Contributed</Typography>
              {(planForm.sections.contributors || []).map((c: Contributor, i: number) => (
                <Stack key={i} direction="row" spacing={1}>
                  <TextField size="small" label="Name" fullWidth value={c.name}
                    onChange={e => {
                      const next = [...(planForm.sections.contributors || [])]
                      next[i] = { ...next[i], name: e.target.value }
                      setPlanForm({ ...planForm, sections: { ...planForm.sections, contributors: next } })
                    }} />
                  <TextField size="small" label="Role" fullWidth value={c.role}
                    onChange={e => {
                      const next = [...(planForm.sections.contributors || [])]
                      next[i] = { ...next[i], role: e.target.value }
                      setPlanForm({ ...planForm, sections: { ...planForm.sections, contributors: next } })
                    }} />
                  <IconButton size="small" color="error" onClick={() => {
                    const next = (planForm.sections.contributors || []).filter((_: any, j: number) => j !== i)
                    setPlanForm({ ...planForm, sections: { ...planForm.sections, contributors: next } })
                  }}><DeleteIcon fontSize="small" /></IconButton>
                </Stack>
              ))}
              <Button size="small" startIcon={<AddIcon />} variant="outlined"
                onClick={() => setPlanForm({ ...planForm, sections: { ...planForm.sections, contributors: [...(planForm.sections.contributors || []), { name: '', role: '' }] } })}
                sx={{ textTransform: 'none', alignSelf: 'flex-start' }}>
                Add contributor
              </Button>

              <Divider />
              <Typography variant="subtitle1" fontWeight={700}>What have we tried?</Typography>
              <TextField fullWidth multiline rows={3} placeholder="Describe strategies, approaches, and interventions that have been attempted..."
                value={planForm.sections.what_tried || ''}
                onChange={e => setPlanForm({ ...planForm, sections: { ...planForm.sections, what_tried: e.target.value } })} />

              <Typography variant="subtitle1" fontWeight={700}>What have we learned?</Typography>
              <TextField fullWidth multiline rows={3} placeholder="What has worked, what hasn't worked, key insights..."
                value={planForm.sections.what_learned || ''}
                onChange={e => setPlanForm({ ...planForm, sections: { ...planForm.sections, what_learned: e.target.value } })} />

              <Divider />
              <Typography variant="subtitle1" fontWeight={700}>What are we pleased about?</Typography>
              <TextField fullWidth multiline rows={3} placeholder="Progress made, strengths, positive outcomes..."
                value={planForm.sections.what_pleased || ''}
                onChange={e => setPlanForm({ ...planForm, sections: { ...planForm.sections, what_pleased: e.target.value } })} />

              <Typography variant="subtitle1" fontWeight={700}>What are we concerned about?</Typography>
              <TextField fullWidth multiline rows={3} placeholder="Risks, challenges, areas needing attention..."
                value={planForm.sections.what_concerned || ''}
                onChange={e => setPlanForm({ ...planForm, sections: { ...planForm.sections, what_concerned: e.target.value } })} />

              <Divider />
              <Typography variant="subtitle1" fontWeight={700}>What do we need to do next?</Typography>
              <TextField fullWidth multiline rows={4} placeholder="Actionable next steps, responsible person, timeline..."
                value={planForm.sections.next_steps || ''}
                onChange={e => setPlanForm({ ...planForm, sections: { ...planForm.sections, next_steps: e.target.value } })} />
            </Stack>
            )}
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

      {/* View Care Plan Dialog */}
      <Dialog open={!!viewPlan} onClose={closeCarePlanView} maxWidth="md" fullWidth>
        {viewPlan && (
          <>
            <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <AssignmentIcon sx={{ color: '#0F4C81' }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1" fontWeight={800} noWrap>{viewPlan.title}</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label={viewPlan.category?.replace(/_/g, ' ')} size="small" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                  <Chip label={viewPlan.status === 'active' ? 'Active' : viewPlan.status === 'archived' ? 'Archived' : 'Draft'} size="small"
                    color={viewPlan.status === 'active' ? 'success' : 'default'} sx={{ height: 20, fontSize: 11 }} />
                  {viewPlan.review_date && <Typography variant="caption" color="#9CA3AF">Review: {new Date(viewPlan.review_date).toLocaleDateString('en-GB')}</Typography>}
                </Stack>
              </Box>
              <IconButton sx={{ ml: 'auto' }} onClick={closeCarePlanView}><CloseIcon fontSize="small" /></IconButton>
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2}>
                {viewPlan.description && (
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: '#F8FAFC', borderRadius: 2 }}>
                    <Typography variant="caption" color="#6B7280" fontWeight={700}>DESCRIPTION</Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>{viewPlan.description}</Typography>
                  </Paper>
                )}
                {viewPlan.risk_assessment && (
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: '#FFF7ED', borderColor: '#FED7AA', borderRadius: 2 }}>
                    <Typography variant="caption" color="#C2410C" fontWeight={700}>RISK ASSESSMENT</Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>{viewPlan.risk_assessment}</Typography>
                  </Paper>
                )}
                <Grid container spacing={2}>
                  {[
                    ['Mobility Level', viewPlan.mobility_level],
                    ['Mobility Aids', viewPlan.mobility_aids],
                    ['Communication Needs', viewPlan.communication_needs],
                    ['Mental Capacity', viewPlan.capacity_status],
                    ['Sleep Pattern', viewPlan.sleep_pattern],
                    ['Personal Goals', viewPlan.personal_goals],
                    ['Likes & Dislikes', viewPlan.likes_dislikes],
                    ['Cultural & Religious Needs', viewPlan.cultural_needs],
                    ['Emergency Information', viewPlan.emergency_info],
                  ].filter(([, v]) => v).map(([k, v]) => (
                    <Grid item xs={12} md={6} key={k as string}>
                      <Typography variant="caption" color="#6B7280" fontWeight={700}>{String(k).toUpperCase()}</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{String(v).replace(/_/g, ' ')}</Typography>
                    </Grid>
                  ))}
                </Grid>

                {viewPlan.sections && (viewPlan.sections.contributors?.length > 0 || viewPlan.sections.what_tried || viewPlan.sections.what_learned || viewPlan.sections.what_pleased || viewPlan.sections.what_concerned || viewPlan.sections.next_steps) && (
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: '#0F4C81', bgcolor: '#F8FAFC' }}>
                    <Typography variant="subtitle2" fontWeight={800} color="#0F4C81" sx={{ mb: 1.5 }}>PERSON-CENTRED PLAN</Typography>
                    <Stack spacing={2}>
                      {(viewPlan.sections.contributors || []).length > 0 && (
                        <Box>
                          <Typography variant="caption" color="#6B7280" fontWeight={700}>WHO CONTRIBUTED</Typography>
                          {viewPlan.sections.contributors.map((c: Contributor, i: number) => (
                            <Typography key={i} variant="body2" sx={{ mt: 0.25 }}>
                              {c.name}{c.role ? ` (${c.role})` : ''}
                            </Typography>
                          ))}
                        </Box>
                      )}
                      {viewPlan.sections.what_tried && (
                        <Box>
                          <Typography variant="caption" color="#6B7280" fontWeight={700}>WHAT HAVE WE TRIED</Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.25 }}>{viewPlan.sections.what_tried}</Typography>
                        </Box>
                      )}
                      {viewPlan.sections.what_learned && (
                        <Box>
                          <Typography variant="caption" color="#6B7280" fontWeight={700}>WHAT HAVE WE LEARNED</Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.25 }}>{viewPlan.sections.what_learned}</Typography>
                        </Box>
                      )}
                      {viewPlan.sections.what_pleased && (
                        <Box>
                          <Typography variant="caption" color="#6B7280" fontWeight={700}>WHAT ARE WE PLEASED ABOUT</Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.25 }}>{viewPlan.sections.what_pleased}</Typography>
                        </Box>
                      )}
                      {viewPlan.sections.what_concerned && (
                        <Box>
                          <Typography variant="caption" color="#6B7280" fontWeight={700}>WHAT ARE WE CONCERNED ABOUT</Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.25 }}>{viewPlan.sections.what_concerned}</Typography>
                        </Box>
                      )}
                      {viewPlan.sections.next_steps && (
                        <Box>
                          <Typography variant="caption" color="#6B7280" fontWeight={700}>WHAT DO WE NEED TO DO NEXT</Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.25 }}>{viewPlan.sections.next_steps}</Typography>
                        </Box>
                      )}
                    </Stack>
                  </Paper>
                )}

                {viewPlan.file_url && (
                  <Paper variant="outlined" sx={{ borderRadius: 2, p: 1.5 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <FileIcon sx={{ fontSize: 20, color: '#0F4C81' }} />
                      <Typography variant="body2" fontWeight={600} sx={{ flex: 1, minWidth: 0 }} noWrap>
                        {viewPlan.file_name || viewPlan.file_url.split('/').pop() || 'Attached document'}
                      </Typography>
                      <Button size="small" variant="outlined" startIcon={<DownloadIcon fontSize="small" />}
                        onClick={() => viewFileInNewTab(viewPlan.file_url)}
                        sx={{ textTransform: 'none', borderRadius: 1.5 }}>
                        View file
                      </Button>
                    </Stack>
                  </Paper>
                )}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 2.5 }}>
              <Button startIcon={<EditIcon />} variant="contained" sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}
                onClick={() => { closeCarePlanView(); const p = viewPlan; setTimeout(() => { setPlanForm({ title: p.title, category: p.category, description: p.description || '', risk_assessment: p.risk_assessment || '', review_date: p.review_date || '', mobility_level: p.mobility_level || '', mobility_aids: p.mobility_aids || '', communication_needs: p.communication_needs || '', capacity_status: p.capacity_status || '', sleep_pattern: p.sleep_pattern || '', emergency_info: p.emergency_info || '', personal_goals: p.personal_goals || '', likes_dislikes: p.likes_dislikes || '', cultural_needs: p.cultural_needs || '', file_url: p.file_url || '', file_name: p.file_name || '', sections: p.sections || { ...EMPTY_PLAN_FORM.sections } }); setEditPlanId(p.id); setPlanTab(0); setAddPlanOpen(true) }, 100) }}>
                Edit Plan
              </Button>
              <Button onClick={closeCarePlanView} sx={{ textTransform: 'none' }}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Add Daily Note Dialog */}
      <Dialog open={addNoteOpen} onClose={() => { setAddNoteOpen(false); setEditNoteId(null); resetAiMode() }} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (!aiMode) { if (editNoteId) updateNoteMutation.mutate({ noteId: editNoteId, data: noteForm }); else addNoteMutation.mutate(noteForm) } }}>
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          {aiMode ? <><AiIcon sx={{ color: '#7C3AED' }} /> Write with AI</> : (editNoteId ? 'Edit Daily Note' : 'Add Daily Note')}
          {!editNoteId && !aiShowResults && (
            <Tooltip title={aiMode ? 'Switch to manual typing' : 'Write with AI'}>
              <IconButton size="small" onClick={() => setAiMode(!aiMode)}
                sx={{ ml: 'auto', bgcolor: aiMode ? '#7C3AED' : '#E5E7EB', color: aiMode ? '#fff' : '#6B7280', '&:hover': { bgcolor: aiMode ? '#6D28D9' : '#D1D5DB' } }}>
                <AiIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {/* AI Error */}
            {aiError && <Alert severity="error" onClose={() => setAiError('')}>{aiError}</Alert>}

            {/* Manual mode form */}
            {!aiMode && (
              <>
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
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <TextField label="Notes" fullWidth multiline rows={4} required value={noteForm.content} onChange={e => setNoteForm({ ...noteForm, content: e.target.value })}
                    sx={{ '& .MuiOutlinedInput-root': aiRecording ? { bgcolor: '#FAF5FF', borderColor: '#7C3AED' } : {} }} />
                  <Stack spacing={0.5} sx={{ flexShrink: 0 }}>
                    <Tooltip title={aiRecording ? 'Stop dictation' : 'Dictate note with voice'}>
                      <IconButton size="small" onClick={aiRecording ? stopAiRecording : startNoteDictation}
                        sx={{ bgcolor: aiRecording ? '#DC2626' : '#E5E7EB', color: aiRecording ? '#fff' : '#6B7280', borderRadius: 1.5, width: 34, height: 34, '&:hover': { bgcolor: aiRecording ? '#B91C1C' : '#D1D5DB' } }}>
                        {aiRecording ? <StopIcon sx={{ fontSize: 18 }} /> : <MicIcon sx={{ fontSize: 18 }} />}
                      </IconButton>
                    </Tooltip>
                    {aiRecording && <Chip label="Recording..." size="small" color="error" variant="outlined" sx={{ animation: 'blink 1s infinite', height: 20, fontSize: 10 }} />}
                  </Stack>
                </Stack>
              </>
            )}

            {/* AI mode form */}
            {aiMode && !aiShowResults && (
              <>
                <Stack direction="row" spacing={1}>
                  <TextField label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={noteForm.note_date} onChange={e => setNoteForm({ ...noteForm, note_date: e.target.value })} />
                  <TextField select label="Shift" fullWidth value={noteForm.shift} onChange={e => setNoteForm({ ...noteForm, shift: e.target.value })}>
                    <MenuItem value="day">Day</MenuItem>
                    <MenuItem value="night">Night</MenuItem>
                  </TextField>
                </Stack>
                <TextField select label="Level of Support" fullWidth value={noteForm.support_level} onChange={e => setNoteForm({ ...noteForm, support_level: e.target.value })}>
                  <MenuItem value="">Not specified</MenuItem>
                  {SUPPORT_LEVELS.map(sl => (
                    <MenuItem key={sl.value} value={sl.value}>{sl.label}</MenuItem>
                  ))}
                </TextField>

                <Paper variant="outlined" sx={{ p: 2, bgcolor: '#FAF5FF', borderColor: '#C4B5FD' }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <MicIcon sx={{ color: '#7C3AED' }} />
                    <Typography variant="subtitle2" sx={{ color: '#7C3AED' }}>Voice Input</Typography>
                    <Typography variant="caption" color="#6B7280">Speak or type your observations</Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                    {!aiRecording ? (
                      <Button size="small" variant="contained" startIcon={<MicIcon />} onClick={startAiRecording}
                        sx={{ bgcolor: '#7C3AED', textTransform: 'none', '&:hover': { bgcolor: '#6D28D9' } }}>Start Recording</Button>
                    ) : (
                      <Button size="small" variant="contained" color="error" startIcon={<StopIcon />} onClick={stopAiRecording}
                        sx={{ textTransform: 'none', animation: 'pulse 1.5s infinite' }}>Stop Recording</Button>
                    )}
                    {aiRecording && <Chip label="Recording..." size="small" color="error" variant="outlined" sx={{ animation: 'blink 1s infinite' }} />}
                  </Stack>
                  <TextField placeholder="Type your observations here, or use voice input above..." fullWidth multiline rows={3} value={aiTranscript} onChange={e => setAiTranscript(e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#fff' } }} />
                </Paper>

                <Button variant="contained" fullWidth onClick={handleAiGenerate} disabled={!aiTranscript.trim() || aiGenerateMutation.isPending}
                  startIcon={aiGenerateMutation.isPending ? <CircularProgress size={18} color="inherit" /> : <PsychologyIcon />}
                  sx={{ bgcolor: '#7C3AED', textTransform: 'none', py: 1.5, fontWeight: 700, '&:hover': { bgcolor: '#6D28D9' } }}>
                  {aiGenerateMutation.isPending ? 'Analyzing...' : 'Analyze & Generate Note'}
                </Button>
              </>
            )}

            {/* AI Results */}
            {aiMode && aiShowResults && aiResult && (
              <>
                <Alert severity={aiResult.risk_level === 'high' || aiResult.risk_level === 'critical' ? 'error' : aiResult.risk_level === 'medium' ? 'warning' : 'success'} icon={<CheckCircleIcon />}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {aiResult.risk_level?.toUpperCase()} Risk Level {getMoodEmoji(aiResult.mood_analysis?.mood_score)}
                  </Typography>
                  {aiResult.follow_up_required && <Typography variant="caption" color="error">Follow-up required: {aiResult.follow_up_details}</Typography>}
                </Alert>

                {aiResult.safeguarding_flags?.length > 0 && (
                  <Paper variant="outlined" sx={{ p: 2, borderColor: '#EF4444', bgcolor: '#FEF2F2' }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <FlagIcon sx={{ color: '#EF4444', fontSize: 20 }} />
                      <Typography variant="subtitle2" sx={{ color: '#EF4444', fontWeight: 700 }}>Safeguarding Alerts ({aiResult.safeguarding_flags.length})</Typography>
                    </Stack>
                    {aiResult.safeguarding_flags.map((flag: any, i: number) => (
                      <Box key={i} sx={{ mb: 0.5 }}>
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.25 }}>
                          <Chip label={flag.severity} size="small" color={flag.severity === 'high' ? 'error' : 'warning'} sx={{ height: 18, fontSize: 10 }} />
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#EF4444' }}>{flag.concern_type}</Typography>
                        </Stack>
                        <Typography variant="caption" display="block" color="#374151">{flag.description}</Typography>
                        {flag.action_required && <Typography variant="caption" display="block" color="#6B7280">Action: {flag.action_required}</Typography>}
                      </Box>
                    ))}
                  </Paper>
                )}

                <TextField label="Generated Daily Note" fullWidth multiline rows={4} value={aiEditedContent} onChange={e => setAiEditedContent(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#F0FDF4' } }} />

                {aiResult.care_plan_updates?.length > 0 && (
                  <Paper variant="outlined" sx={{ p: 2, borderColor: '#0F4C81' }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <LightbulbIcon sx={{ color: '#0F4C81', fontSize: 20 }} />
                      <Typography variant="subtitle2" sx={{ color: '#0F4C81', fontWeight: 700 }}>Care Plan Suggestions</Typography>
                    </Stack>
                    {aiResult.care_plan_updates.map((u: any, i: number) => (
                      <Box key={i} sx={{ mb: 0.5 }}>
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.25 }}>
                          <Chip label={u.priority || 'medium'} size="small" color={u.priority === 'high' ? 'error' : u.priority === 'medium' ? 'warning' : 'info'} sx={{ height: 18, fontSize: 10 }} />
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>{u.goal_area || 'Care Plan'}</Typography>
                        </Stack>
                        <Typography variant="caption" display="block" color="#374151">{u.suggested_update}</Typography>
                        {u.evidence && <Typography variant="caption" display="block" color="#6B7280" fontStyle="italic">Evidence: {u.evidence}</Typography>}
                      </Box>
                    ))}
                  </Paper>
                )}

                {aiResult.interventions_suggested?.length > 0 && (
                  <Paper variant="outlined" sx={{ p: 2, borderColor: '#059669' }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <TrendIcon sx={{ color: '#059669', fontSize: 20 }} />
                      <Typography variant="subtitle2" sx={{ color: '#059669', fontWeight: 700 }}>Suggested Interventions</Typography>
                    </Stack>
                    {aiResult.interventions_suggested.map((s: any, i: number) => (
                      <Box key={i} sx={{ mb: 0.5 }}>
                        <Typography variant="caption" display="block" color="#374151" sx={{ fontWeight: 700 }}>• {s.intervention || s}</Typography>
                        {s.reason && <Typography variant="caption" display="block" color="#6B7280">Reason: {s.reason}</Typography>}
                        {s.expected_outcome && <Typography variant="caption" display="block" color="#059669">Expected: {s.expected_outcome}</Typography>}
                      </Box>
                    ))}
                  </Paper>
                )}

                <Button variant="outlined" fullWidth onClick={() => { setAiShowResults(false); setAiResult(null); setAiEditedContent('') }} sx={{ textTransform: 'none', borderColor: '#7C3AED', color: '#7C3AED' }}>Back</Button>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => { setAddNoteOpen(false); setEditNoteId(null); resetAiMode() }}>Cancel</Button>
          {aiMode && aiShowResults && (
            <Button variant="contained" onClick={handleAiApprove} disabled={aiApproveMutation.isPending}
              startIcon={aiApproveMutation.isPending ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
              sx={{ bgcolor: '#7C3AED', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#6D28D9' } }}>
              {aiApproveMutation.isPending ? 'Saving...' : 'Approve & Save Note'}
            </Button>
          )}
          {!aiMode && (
            <Button type="submit" variant="contained" disabled={addNoteMutation.isPending || updateNoteMutation.isPending} sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
              {(addNoteMutation.isPending || updateNoteMutation.isPending) ? <CircularProgress size={20} /> : (editNoteId ? 'Save' : 'Add Note')}
            </Button>
          )}
        </DialogActions>
        </Box>
      </Dialog>
      <Dialog open={!!viewNote} onClose={() => { setViewNote(null); setAiError('') }} maxWidth="sm" fullWidth>
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
                {viewNote.generated_by_ai && (
                  <Chip icon={<AiIcon sx={{ fontSize: 14 }} />} label="AI Generated" size="small"
                    sx={{ bgcolor: '#F3E8FF', color: '#7C3AED', fontWeight: 700, '& .MuiChip-icon': { color: '#7C3AED' } }} />
                )}
                <Typography variant="caption" color="#6B7280">{new Date(viewNote.note_date).toLocaleDateString('en-GB')}</Typography>
                <Typography variant="caption" color="#9CA3AF">{viewNote.author_name ? `by ${viewNote.author_name}` : ''}</Typography>
              </Stack>
              <Divider />
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{viewNote.content}</Typography>

              {/* Saved AI Analysis */}
              {viewNote.ai_risk_level && (
                <>
                  <Divider />
                  <Paper variant="outlined" sx={{ p: 2, borderColor: '#C4B5FD', bgcolor: '#FAF5FF' }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                      <AiIcon sx={{ color: '#7C3AED', fontSize: 20 }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#7C3AED' }}>AI Analysis</Typography>
                      <Chip label={`${viewNote.ai_risk_level} risk`} size="small" color={viewNote.ai_risk_level === 'high' || viewNote.ai_risk_level === 'critical' ? 'error' : viewNote.ai_risk_level === 'medium' ? 'warning' : 'success'} sx={{ height: 20, fontSize: 10 }} />
                      {viewNote.ai_follow_up_required && <Chip label="Follow-up needed" size="small" color="warning" sx={{ height: 20, fontSize: 10 }} />}
                    </Stack>

                    {viewNote.ai_follow_up_details && (
                      <Alert severity="warning" sx={{ mb: 1.5, py: 0 }}>
                        <Typography variant="caption" fontWeight={700}>Follow-up:</Typography> {viewNote.ai_follow_up_details}
                      </Alert>
                    )}

                    {viewNote.ai_mood_analysis && (
                      <Box sx={{ mb: 1.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#374151' }}>Mood: {getMoodEmoji(viewNote.ai_mood_analysis.mood_score)} {viewNote.ai_mood_analysis.mood_label} ({viewNote.ai_mood_analysis.mood_score}/10)</Typography>
                        {viewNote.ai_mood_analysis.indicators?.length > 0 && (
                          <Typography variant="caption" display="block" color="#6B7280">{viewNote.ai_mood_analysis.indicators.join(', ')}</Typography>
                        )}
                      </Box>
                    )}

                    {Array.isArray(viewNote.ai_safeguarding_flags) && viewNote.ai_safeguarding_flags.length > 0 && (
                      <Box sx={{ mb: 1.5 }}>
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
                          <FlagIcon sx={{ fontSize: 14, color: '#EF4444' }} />
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#EF4444' }}>Safeguarding ({viewNote.ai_safeguarding_flags.length})</Typography>
                        </Stack>
                        {viewNote.ai_safeguarding_flags.map((f: any, i: number) => (
                          <Paper key={i} variant="outlined" sx={{ p: 1, mb: 0.5, borderColor: '#FCA5A5', bgcolor: '#FEF2F2' }}>
                            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.25 }}>
                              <Chip label={f.severity} size="small" color={f.severity === 'high' ? 'error' : 'warning'} sx={{ height: 16, fontSize: 9 }} />
                              <Typography variant="caption" fontWeight={700}>{f.concern_type}</Typography>
                            </Stack>
                            <Typography variant="caption" display="block" color="#374151">{f.description}</Typography>
                            {f.action_required && <Typography variant="caption" display="block" color="#6B7280" fontStyle="italic">Action: {f.action_required}</Typography>}
                          </Paper>
                        ))}
                      </Box>
                    )}

                    {Array.isArray(viewNote.ai_care_plan_updates) && viewNote.ai_care_plan_updates.length > 0 && (
                      <Box sx={{ mb: 1.5 }}>
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
                          <LightbulbIcon sx={{ fontSize: 14, color: '#0F4C81' }} />
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#0F4C81' }}>Care Plan Suggestions</Typography>
                        </Stack>
                        {viewNote.ai_care_plan_updates.map((u: any, i: number) => (
                          <Paper key={i} variant="outlined" sx={{ p: 1, mb: 0.5, borderColor: '#93C5FD' }}>
                            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.25 }}>
                              <Chip label={u.priority || 'medium'} size="small" color={u.priority === 'high' ? 'error' : u.priority === 'medium' ? 'warning' : 'info'} sx={{ height: 16, fontSize: 9 }} />
                              <Typography variant="caption" fontWeight={700}>{u.goal_area}</Typography>
                            </Stack>
                            <Typography variant="caption" display="block" color="#374151">{u.suggested_update}</Typography>
                            {u.evidence && <Typography variant="caption" display="block" color="#6B7280" fontStyle="italic">Evidence: {u.evidence}</Typography>}
                          </Paper>
                        ))}
                      </Box>
                    )}

                    {Array.isArray(viewNote.ai_interventions) && viewNote.ai_interventions.length > 0 && (
                      <Box>
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
                          <TrendIcon sx={{ fontSize: 14, color: '#059669' }} />
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#059669' }}>Suggested Interventions</Typography>
                        </Stack>
                        {viewNote.ai_interventions.map((s: any, i: number) => (
                          <Paper key={i} variant="outlined" sx={{ p: 1, mb: 0.5, borderColor: '#A7F3D0' }}>
                            <Typography variant="caption" display="block" fontWeight={700} color="#374151">• {s.intervention}</Typography>
                            {s.reason && <Typography variant="caption" display="block" color="#6B7280">Reason: {s.reason}</Typography>}
                            {s.expected_outcome && <Typography variant="caption" display="block" color="#059669">Expected: {s.expected_outcome}</Typography>}
                          </Paper>
                        ))}
                      </Box>
                    )}
                  </Paper>
                </>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          {viewNote && !viewNote.ai_risk_level && (
            <Button startIcon={aiAnalyzeNoteMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <AiIcon />}
              onClick={() => aiAnalyzeNoteMutation.mutate(viewNote.id)}
              disabled={aiAnalyzeNoteMutation.isPending}
              sx={{ textTransform: 'none', color: '#7C3AED', borderColor: '#C4B5FD', '&:hover': { borderColor: '#7C3AED', bgcolor: '#FAF5FF' } }}
              variant="outlined">
              {aiAnalyzeNoteMutation.isPending ? 'Analyzing...' : 'Analyze with AI'}
            </Button>
          )}
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
          inviteFromContactMutation.mutate({ ...invitePortalForm, person_id: id })
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

const ASSESSMENT_TYPES = ['Initial', 'Annual Review', 'MCA', 'DoLS', 'Best Interest', 'Capacity', 'Other']
const ASSESSMENT_STATUS_COLORS: Record<string, string> = { draft: '#D97706', completed: '#16A34A', reviewed: '#0F4C81' }

function CareAssessmentsTabInline({ personId }: { personId: string }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [editAssessment, setEditAssessment] = useState<any>(null)
  const [form, setForm] = useState({ assessment_type: '', assessment_date: new Date().toISOString().split('T')[0], assessor_name: '', findings: '', recommendations: '', status: 'draft', next_review_date: '' })
  const [error, setError] = useState('')
  const { data: assessments, isLoading, isError } = useQuery({
    queryKey: ['assessments', personId],
    queryFn: () => api.get(`/people/${personId}/assessments`).then(r => r.data),
  })
  const resetForm = () => setForm({ assessment_type: '', assessment_date: new Date().toISOString().split('T')[0], assessor_name: '', findings: '', recommendations: '', status: 'draft', next_review_date: '' })
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form }
      if (editAssessment) return api.patch(`/people/assessments/${editAssessment.id}`, payload)
      return api.post(`/people/${personId}/assessments`, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments', personId] })
      queryClient.invalidateQueries({ queryKey: ['timeline', personId] })
      setOpen(false)
      setEditAssessment(null)
      resetForm()
      setError('')
    },
    onError: (err: any) => setError(err.response?.data?.message || err.message || 'Failed to save assessment'),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/people/assessments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assessments', personId] }),
  })
  const openEdit = (a: any) => {
    setEditAssessment(a)
    setForm({
      assessment_type: a.assessment_type,
      assessment_date: a.assessment_date?.split('T')[0] || '',
      assessor_name: a.assessor_name || '',
      findings: a.findings || '',
      recommendations: a.recommendations || '',
      status: a.status || 'draft',
      next_review_date: a.next_review_date?.split('T')[0] || '',
    })
    setOpen(true)
  }
  if (isLoading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
  if (isError) return <Alert severity="error">Failed to load assessments</Alert>
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={800}>Care Assessments</Typography>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => { setEditAssessment(null); resetForm(); setOpen(true) }}
          sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>New Assessment</Button>
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
                <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {assessments.map((a: any) => (
                <TableRow key={a.id} hover sx={{ cursor: 'pointer' }} onClick={() => { setSelected(a); setViewOpen(true) }}>
                  <TableCell sx={{ fontWeight: 600 }}>{a.assessment_type?.replace(/_/g, ' ')}</TableCell>
                  <TableCell>{a.assessment_date ? new Date(a.assessment_date).toLocaleDateString('en-GB') : '—'}</TableCell>
                  <TableCell>{a.assessor_name || '—'}</TableCell>
                  <TableCell><Chip label={a.status} size="small" sx={{ bgcolor: `${ASSESSMENT_STATUS_COLORS[a.status] || '#6B7280'}20`, color: ASSESSMENT_STATUS_COLORS[a.status] || '#6B7280', fontWeight: 700, textTransform: 'capitalize' }} /></TableCell>
                  <TableCell>{a.next_review_date ? new Date(a.next_review_date).toLocaleDateString('en-GB') : '—'}</TableCell>
                  <TableCell align="right" onClick={e => e.stopPropagation()}>
                    <IconButton size="small" onClick={() => openEdit(a)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => { if (confirm('Delete this assessment?')) deleteMutation.mutate(a.id) }}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* View Dialog */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>{selected?.assessment_type}</DialogTitle>
        <DialogContent>
          {selected && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={4}>
                <Box><Typography variant="caption" color="#6B7280">Date</Typography><Typography fontWeight={600}>{new Date(selected.assessment_date).toLocaleDateString('en-GB')}</Typography></Box>
                <Box><Typography variant="caption" color="#6B7280">Assessor</Typography><Typography fontWeight={600}>{selected.assessor_name || '—'}</Typography></Box>
                <Box><Typography variant="caption" color="#6B7280">Status</Typography><Chip label={selected.status} size="small" sx={{ bgcolor: `${ASSESSMENT_STATUS_COLORS[selected.status] || '#6B7280'}20`, color: ASSESSMENT_STATUS_COLORS[selected.status] || '#6B7280', fontWeight: 700 }} /></Box>
                <Box><Typography variant="caption" color="#6B7280">Next Review</Typography><Typography fontWeight={600}>{selected.next_review_date ? new Date(selected.next_review_date).toLocaleDateString('en-GB') : '—'}</Typography></Box>
              </Stack>
              <Box><Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>Findings</Typography><Paper variant="outlined" sx={{ p: 2, bgcolor: '#F9FAFB', whiteSpace: 'pre-wrap' }}>{selected.findings || 'No findings recorded'}</Paper></Box>
              <Box><Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>Recommendations</Typography><Paper variant="outlined" sx={{ p: 2, bgcolor: '#F9FAFB', whiteSpace: 'pre-wrap' }}>{selected.recommendations || 'No recommendations recorded'}</Paper></Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setViewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={open} onClose={() => { setOpen(false); setError('') }} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); saveMutation.mutate() }}>
          <DialogTitle sx={{ fontWeight: 800 }}>{editAssessment ? 'Edit Assessment' : 'New Assessment'}</DialogTitle>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField select label="Assessment Type" required fullWidth value={form.assessment_type} onChange={e => setForm(p => ({ ...p, assessment_type: e.target.value }))}>
                {ASSESSMENT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
              <TextField label="Assessment Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.assessment_date} onChange={e => setForm(p => ({ ...p, assessment_date: e.target.value }))} />
              <TextField label="Assessor Name" fullWidth value={form.assessor_name} onChange={e => setForm(p => ({ ...p, assessor_name: e.target.value }))} />
              <TextField label="Findings" multiline rows={4} fullWidth value={form.findings} onChange={e => setForm(p => ({ ...p, findings: e.target.value }))} />
              <TextField label="Recommendations" multiline rows={4} fullWidth value={form.recommendations} onChange={e => setForm(p => ({ ...p, recommendations: e.target.value }))} />
              <TextField select label="Status" fullWidth value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="reviewed">Reviewed</MenuItem>
              </TextField>
              <TextField label="Next Review Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.next_review_date} onChange={e => setForm(p => ({ ...p, next_review_date: e.target.value }))} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => { setOpen(false); setError('') }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={!form.assessment_type.trim() || saveMutation.isPending} sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
              {saveMutation.isPending ? <CircularProgress size={20} /> : editAssessment ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  )
}

function TimelineTab({ personId }: { personId: string }) {
  const { data: timeline = [], isLoading } = useQuery({
    queryKey: ['timeline', personId],
    queryFn: () => api.get(`/people/${personId}/timeline`).then(r => r.data),
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
      <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 3 }}>Person Timeline</Typography>
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
      <Typography color="#9CA3AF">No room number assigned to this person. Room checks cannot be displayed.</Typography>
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

function ClinicalScoresTab({ personId }: { personId: string }) {
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ score_type: 'waterlow', score: '', risk_level: '', notes: '', recorded_date: new Date().toISOString().split('T')[0] })
  const [formError, setFormError] = useState('')
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()

  const { data: scores = [], isLoading } = useQuery({
    queryKey: ['clinical-scores', personId],
    queryFn: () => api.get(`/people/${personId}/clinical-scores`).then(r => r.data),
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post(`/people/${personId}/clinical-scores`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clinical-scores', personId] }); setAddOpen(false); setForm({ score_type: 'waterlow', score: '', risk_level: '', notes: '', recorded_date: new Date().toISOString().split('T')[0] }) },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to add score'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/people/clinical-scores/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clinical-scores', personId] }),
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

function DocumentsTab({ personId }: { personId: string }) {
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ title: '', document_type: 'care_plan', description: '', file_url: '', upload_date: new Date().toISOString().split('T')[0] })
  const [formError, setFormError] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['documents', personId],
    queryFn: () => api.get(`/people/${personId}/documents`).then(r => r.data),
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post(`/people/${personId}/documents`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['documents', personId] }); setAddOpen(false); setForm({ title: '', document_type: 'care_plan', description: '', file_url: '', upload_date: new Date().toISOString().split('T')[0] }) },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to upload'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/people/documents/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents', personId] }),
    onError: (err: any) => showSnackbar(err.response?.data?.message || 'Failed to delete', 'error'),
  })

  const viewDocument = async (fileUrl: string) => {
    try {
      const token = localStorage.getItem('accessToken')
      const res = await fetch(fileUrl, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const w = window.open(blobUrl, '_blank', 'noopener,noreferrer')
      if (!w) {
        const a = document.createElement('a')
        a.href = blobUrl
        a.target = '_blank'
        a.rel = 'noopener noreferrer'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
    } catch {
      const w = window.open(fileUrl, '_blank', 'noopener,noreferrer')
      if (!w) {
        const a = document.createElement('a')
        a.href = fileUrl
        a.target = '_blank'
        a.rel = 'noopener noreferrer'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
    }
  }

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
                  <Button size="small" variant="outlined" onClick={() => viewDocument(d.file_url)}
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

function WellbeingTabInline({ personId }: { personId: string }) {
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ domain: 'mood', score: 5, notes: '' })
  const [formError, setFormError] = useState('')
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['wellbeing', personId],
    queryFn: () => api.get(`/people/${personId}/wellbeing`).then(r => r.data),
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post(`/people/${personId}/wellbeing`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wellbeing', personId] }); setAddOpen(false); setForm({ domain: 'mood', score: 5, notes: '' }) },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to add entry'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/people/wellbeing/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wellbeing', personId] }); showSnackbar('Entry deleted') },
    onError: (err: any) => showSnackbar(err.response?.data?.message || 'Failed to delete', 'error'),
  })

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>

  const grouped: Record<string, any[]> = {}
  entries.forEach((e: any) => { if (!grouped[e.domain]) grouped[e.domain] = []; grouped[e.domain].push(e) })

  const latestByDomain: Record<string, number> = {}
  entries.forEach((e: any) => { if (!latestByDomain[e.domain] || new Date(e.recorded_date) > new Date(latestByDomain[e.domain + '_date'])) { latestByDomain[e.domain] = e.score; latestByDomain[e.domain + '_date'] = e.recorded_date } })
  const radarData = WELLBEING_DOMAINS.filter(d => latestByDomain[d] != null).map(d => ({ domain: d.charAt(0).toUpperCase() + d.slice(1), score: latestByDomain[d], fullMark: 10 }))

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={800}>Wellbeing</Typography>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}
          sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>Record Entry</Button>
      </Stack>
      {radarData.length >= 3 && (
        <Paper sx={{ p: 3, mb: 2, borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#6B7280', mb: 1, display: 'block' }}>Latest Wellbeing Snapshot</Typography>
          <RechartsResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
              <PolarGrid stroke="#E5E7EB" />
              <PolarAngleAxis dataKey="domain" tick={{ fontSize: 11, fill: '#6B7280' }} />
              <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
              <Radar name="Score" dataKey="score" stroke="#0F4C81" fill="#0F4C81" fillOpacity={0.25} strokeWidth={2} />
            </RadarChart>
          </RechartsResponsiveContainer>
        </Paper>
      )}
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

function CommunicationLogTabInline({ personId }: { personId: string }) {
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ contact_name: '', relationship: '', contact_method: 'phone', direction: 'inbound', summary: '', follow_up_actions: '', recorded_date: new Date().toISOString().split('T')[0] })
  const [formError, setFormError] = useState('')
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['communication-log', personId],
    queryFn: () => api.get(`/people/${personId}/communication-log`).then(r => r.data),
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post(`/people/${personId}/communication-log`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['communication-log', personId] }); setAddOpen(false); setForm({ contact_name: '', relationship: '', contact_method: 'phone', direction: 'inbound', summary: '', follow_up_actions: '', recorded_date: new Date().toISOString().split('T')[0] }) },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to add entry'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/people/communication-log/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['communication-log', personId] }); showSnackbar('Entry deleted') },
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

function CapacityMcaTabInline({ personId }: { personId: string }) {
  const [addOpen, setAddOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ assessment_date: new Date().toISOString().split('T')[0], decision_to_be_made: '', capacity_found: null as boolean | null, capacity_status: 'not_assessed', best_interest_decision: '', best_interest_meeting_date: '', independent_advocate: '', relevant_people_informed: '', review_date: '' })
  const [formError, setFormError] = useState('')
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()

  const { data: assessments = [], isLoading } = useQuery({
    queryKey: ['capacity', personId],
    queryFn: () => api.get(`/people/${personId}/capacity`).then(r => r.data),
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post(`/people/${personId}/capacity`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['capacity', personId] }); setAddOpen(false); resetForm() },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to add assessment'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/people/capacity/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['capacity', personId] }); setAddOpen(false); setEditId(null); resetForm() },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to update assessment'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/people/capacity/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['capacity', personId] }); showSnackbar('Assessment deleted') },
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

function CarePathwaysTabInline({ personId }: { personId: string }) {
  const [addOpen, setAddOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ pathway_type: 'hospital_admission', title: '', start_date: new Date().toISOString().split('T')[0], end_date: '', location_name: '', referral_reason: '', discharge_notes: '', status: 'active' })
  const [formError, setFormError] = useState('')
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()

  const { data: pathways = [], isLoading } = useQuery({
    queryKey: ['care-pathways', personId],
    queryFn: () => api.get(`/people/${personId}/care-pathways`).then(r => r.data),
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post(`/people/${personId}/care-pathways`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['care-pathways', personId] }); setAddOpen(false); resetForm() },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to add pathway'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/people/care-pathways/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['care-pathways', personId] }); setAddOpen(false); setEditId(null); resetForm() },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to update pathway'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/people/care-pathways/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['care-pathways', personId] }); showSnackbar('Pathway deleted') },
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

function DischargeChecklistTabInline({ personId }: { personId: string }) {
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ item_text: '', category: 'documentation' })
  const [formError, setFormError] = useState('')
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['discharge-checklist', personId],
    queryFn: () => api.get(`/people/${personId}/discharge-checklist`).then(r => r.data),
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post(`/people/${personId}/discharge-checklist`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['discharge-checklist', personId] }); setAddOpen(false); setForm({ item_text: '', category: 'documentation' }) },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to add item'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) => api.patch(`/people/discharge-checklist/${id}`, { completed }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['discharge-checklist', personId] }),
    onError: (err: any) => showSnackbar(err.response?.data?.message || 'Failed to update', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/people/discharge-checklist/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['discharge-checklist', personId] }); showSnackbar('Item deleted') },
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

function MoodChartTabInline({ personId }: { personId: string }) {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ domain: 'mood', score: 7, recorded_date: new Date().toISOString().split('T')[0], notes: '' })
  const [formError, setFormError] = useState('')

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['wellbeing', personId],
    queryFn: () => api.get(`/people/${personId}/wellbeing`).then(r => r.data),
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post(`/people/${personId}/wellbeing`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wellbeing', personId] }); setAddOpen(false); setForm({ domain: 'mood', score: 7, recorded_date: new Date().toISOString().split('T')[0], notes: '' }) },
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
        <Stack spacing={3}>
          {Object.entries(grouped).map(([domain, items]) => {
            const chartData = items
              .sort((a: any, b: any) => new Date(a.recorded_date).getTime() - new Date(b.recorded_date).getTime())
              .map((e: any) => ({
                date: new Date(e.recorded_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
                score: e.score,
                notes: e.notes || '',
              }))
            return (
              <Paper key={domain} sx={{ p: 2.5, borderRadius: 2, border: '1px solid #E5E7EB' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Chip label={domain} size="small" sx={{ bgcolor: DOMAIN_COLORS[domain] || '#6B7280', color: 'white', fontWeight: 700 }} />
                  <Typography variant="caption" color="#6B7280">{items.length} entries</Typography>
                </Stack>
                <RechartsResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <RechartsCartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <RechartsXAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                    <RechartsYAxis domain={[0, 10]} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                    <RechartsTooltip
                      contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
                      formatter={(value: any) => [`${value}/10`, 'Score']}
                    />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={32}>
                      {chartData.map((entry: any, idx: number) => (
                        <Cell key={idx} fill={scoreColor(entry.score)} />
                      ))}
                    </Bar>
                  </BarChart>
                </RechartsResponsiveContainer>
              </Paper>
            )
          })}
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

function AuditTrailTabInline({ personId }: { personId: string }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-trail', personId],
    queryFn: () => api.get('/audit/logs', { params: { person_id: personId } }).then(r => r.data),
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
