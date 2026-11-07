import { useState, useRef, useEffect, Fragment } from 'react'
import { useTheme } from '@mui/material/styles'
import {
  Box, Typography, Paper, Stack, Chip, Button, Tabs, Tab, Avatar,
  Grid, TextField, CircularProgress, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, MenuItem, Divider,
  Menu, ListItemIcon, ListItemText,  Tooltip, Rating, InputAdornment,
} from '@mui/material'
import {
  Add as AddIcon, Edit as EditIcon,
  Phone as PhoneIcon, Warning as WarningIcon, Email as EmailIcon, Videocam as VideoCallIcon, Home as HomeIcon,
  Delete as DeleteIcon, CameraAlt as CameraIcon, MoreVert as MoreVertIcon,
  Block as BlockIcon,
  Event as EventIcon, Note as NoteIcon, Assignment as AssignmentIcon,
  HealthAndSafety as HealthIcon, Person as PersonIcon, Upload as UploadIcon,
  CheckCircle as CheckCircleIcon, RadioButtonUnchecked as UncheckedIcon,
  People as PeopleIcon, AutoAwesome as AiIcon, Mic as MicIcon, Stop as StopIcon,
  Psychology as PsychologyIcon, Flag as FlagIcon, TrendingUp as TrendIcon,
  Lightbulb as LightbulbIcon,
  Description as FileIcon, Download as DownloadIcon, Close as CloseIcon, Print as PrintIcon,
  OpenInNew as OpenInNewIcon, Luggage as LuggageIcon, Place as PlaceIcon,
  CalendarMonth as CalendarMonthIcon, Chat as ChatIcon, Shield as ShieldIcon,
  Search as SearchIcon, Login as LoginIcon, Logout as LogoutIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import { MICA_RECORD_PARAMS } from '@meticle/shared'
import { useSnackbar } from '../../context/SnackbarContext'
import { ConfirmDialog, SectionHeader, EmptyRow } from '../../components/ui'
import { EmptyState } from '../../components/design/EmptyState'
import { formatDateOnly, localDate } from '../../utils/dateFormat'
import ContextualLearnLink from '../../components/ContextualLearnLink'
import HealthTab from './HealthTab'
import NutritionTab from './NutritionTab'
import BodyMapTab from './BodyMapTab'
import MemoryBookTab from './MemoryBookTab'
import GoalsPage from '../goals/GoalsPage'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer as RechartsResponsiveContainer, Pie, PieChart, Tooltip as RechartsTooltip, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import PageContainer from '../../components/design/PageContainer'
import { METICLE_COLORS } from '../../context/ThemeContext'
import { PremiumCard } from '../../components/design/PremiumCard'
import AppButton from '../../components/design/AppButton'
import { CarePlanCardView } from './carePlanCardView'
import FigDialogHeader, { PillOptions, nameFromEyebrow, usePersonEyebrow } from './dialogHeader'

const RISK_COLORS: Record<string, string> = { low: METICLE_COLORS.success, medium: METICLE_COLORS.warning, high: METICLE_COLORS.danger, critical: '#8B7CF6' }

// Figma 6.8 dialog eyebrow: "DANIEL PRICE / CARE". Dialogs inside inline tab
// components (no person in scope) use usePersonEyebrow from ./dialogHeader.
const eyebrowFor = (u: any, area: string) =>
  `${(`${u?.first_name || ''} ${u?.last_name || ''}`.trim() || 'Resident').toUpperCase()} / ${area}`

// Shift values the profile note form accepts. The server normalises these to
// day/night, but the client keeps the richer labels the brief wants so the UI
// can show "afternoon" etc. while Mica maps them to the stored enum.
const NOTE_SHIFT_OPTIONS = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
  { value: 'night', label: 'Night' },
] as const
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

const TAB_SLUGS: Record<number, string> = {
  0: 'overview', 1: 'timeline', 2: 'care-plans', 3: 'daily-notes', 4: 'risk-assessments',
  5: 'family-contacts', 6: 'health', 7: 'body-map', 8: 'memory-book', 9: 'goals',
  10: 'care-assessments', 11: 'room-checks', 12: 'clinical-scores', 13: 'documents',
  14: 'wellbeing', 15: 'communication', 16: 'capacity', 17: 'care-pathways',
  18: 'time-away', 19: 'mood-chart', 20: 'audit-trail', 21: 'nutrition',
}
const SLUG_TO_TAB: Record<string, number> = { ...Object.fromEntries(Object.entries(TAB_SLUGS).map(([k, v]) => [v, Number(k)])), discharge: 18 }

export default function PersonProfilePage() {
  const theme = useTheme()
  const { id } = useParams()
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<number>(() => {
    const slug = searchParams.get('tab')
    return slug ? (SLUG_TO_TAB[slug] ?? 0) : 0
  })

  const handleTabChange = (v: number) => {
    setTab(v)
    const slug = TAB_SLUGS[v]
    setSearchParams(slug && slug !== 'overview' ? { tab: slug } : {}, { replace: true })
  }

  useEffect(() => {
    const slug = searchParams.get('tab')
    const v = slug ? SLUG_TO_TAB[slug] : 0
    if (v !== undefined && v !== tab) setTab(v)
  }, [searchParams, tab])

  const [editOpen, setEditOpen] = useState(false)
  const [editTab, setEditTab] = useState(0)
  const [dischargeOpen, setDischargeOpen] = useState(false)
  const [roomMoveOpen, setRoomMoveOpen] = useState(false)
  const [profileMenuAnchor, setProfileMenuAnchor] = useState<null | HTMLElement>(null)
  const [dischargeForm, setDischargeForm] = useState({ discharge_date: localDate(), discharge_destination: '', discharge_reason: '', discharge_summary: '' })
  const [moveForm, setMoveForm] = useState({ location_id: '', room_number: '' })
  const [addPlanOpen, setAddPlanOpen] = useState(false)
  const [viewPlan, setViewPlan] = useState<any>(null)
  const [addNoteOpen, setAddNoteOpen] = useState(false)
  const [addRiskOpen, setAddRiskOpen] = useState(false)
  const [addContactOpen, setAddContactOpen] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [planForm, setPlanForm] = useState({ ...EMPTY_PLAN_FORM })
  const [planTab, setPlanTab] = useState(0)
  const [noteForm, setNoteForm] = useState({ note_date: localDate(), shift: 'morning', category: '', content: '', support_level: '' })
  const [editNoteId, setEditNoteId] = useState<string | null>(null)
  const [viewNote, setViewNote] = useState<any>(null)
  const [riskForm, setRiskForm] = useState({ type: '', risk_level: 'medium', details: '', mitigation_actions: '', review_date: '', file_url: '', file_name: '' })
  const [riskFileUploading, setRiskFileUploading] = useState(false)
  const riskFileInputRef = useRef<HTMLInputElement>(null)
  const [contactForm, setContactForm] = useState({ name: '', relationship: '', phone: '', email: '', is_emergency_contact: false })
  const [contactEditId, setContactEditId] = useState<string | null>(null)
  const [contactMenuAnchor, setContactMenuAnchor] = useState<null | { el: HTMLElement; contact: any }>(null)
  const [invitePortalOpen, setInvitePortalOpen] = useState(false)
  const [invitePortalForm, setInvitePortalForm] = useState({ name: '', email: '', relationship: '', phone: '' })
  const [invitePortalError, setInvitePortalError] = useState('')
  const [planStatusFilter, setPlanStatusFilter] = useState<string>('all')
  const [editPlanId, setEditPlanId] = useState<string | null>(null)
  const [editRiskId, setEditRiskId] = useState<string | null>(null)
  const [viewRisk, setViewRisk] = useState<any>(null)
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

  const { data: user, isLoading, isError, refetch } = useQuery({
    queryKey: ['person', id],
    queryFn: () => api.get(`/people/${id}`).then(r => r.data),
    enabled: !!id,
  })

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => api.get('/settings/locations').then(r => r.data),
  })

  const { data: organisationSettings } = useQuery({
    queryKey: ['organisation-settings'],
    queryFn: () => api.get('/settings/org').then(r => r.data),
  })
  const effectiveServiceTypes = organisationSettings?.primary_service_type
    ? [organisationSettings.primary_service_type]
    : (organisationSettings?.service_types || [])
  const isDomiciliary = effectiveServiceTypes.some((type: string) => ['domiciliary', 'live_in'].includes(type))

  const { data: portalMembers = [] } = useQuery({
    queryKey: ['family-members', id],
    queryFn: () => api.get('/family-portal/members', { params: { person_id: id } }).then(r => r.data),
    enabled: !!id,
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.patch(`/people/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person', id] }); setEditOpen(false); setError(''); showSnackbar(`${user.first_name} ${user.last_name}'s profile is up to date.`, 'success', 'Profile saved') },
    onError: (err: any) => setError(err.response?.data?.message || 'Update failed'),
  })

  const dischargeMutation = useMutation({
    mutationFn: (data: any) => api.patch(`/people/${id}`, { ...data, status: 'discharged' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person', id] }); setDischargeOpen(false); setError(''); showSnackbar(`${user.first_name} ${user.last_name} is discharged. Their record is kept under Discharged.`, 'success', 'Person discharged') },
    onError: (err: any) => setError(err.response?.data?.message || 'Discharge failed'),
  })

  const moveMutation = useMutation({
    mutationFn: (data: any) => api.patch(`/people/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person', id] }); setRoomMoveOpen(false); setError(''); showSnackbar(`${user.first_name} ${user.last_name} is moved. The rota and room board show the new room.`, 'success', 'Room updated') },
    onError: (err: any) => setError(err.response?.data?.message || 'Move failed'),
  })

  const downloadProfile = () => {
    const loc = locations.find((l: any) => l.id === user.location_id)?.name || 'Not set'
    const lines = [
      `${user.first_name} ${user.last_name} — profile summary`,
      `Status: ${user.status || 'active'}`,
      `Date of birth: ${user.date_of_birth ? formatDateOnly(user.date_of_birth) : 'Not recorded'}`,
      `NHS number: ${user.nhs_number || 'Not recorded'}`,
      `Room: ${user.room_number || 'Not set'} · Location: ${loc}`,
      `GP: ${[user.gp_name, user.gp_surgery, user.gp_phone].filter(Boolean).join(' · ') || 'Not recorded'}`,
      `Pharmacy: ${[user.pharmacy_name, user.pharmacy_phone].filter(Boolean).join(' · ') || 'Not recorded'}`,
      `Allergies: ${user.allergies?.length ? user.allergies.join(', ') : 'None recorded'}`,
      `Dietary requirements: ${user.dietary_requirements || 'None recorded'}`,
      `Support level: ${user.support_level ? SUPPORT_LEVEL_LABELS[user.support_level] || user.support_level : 'Not recorded'}`,
      `Funding: ${(user.funding_type || 'Not recorded').replace(/_/g, ' ')}`,
      `Admission: ${user.admission_date ? formatDateOnly(user.admission_date) : 'Not recorded'}${user.admission_source ? ` from ${user.admission_source}` : ''}`,
      `Social worker: ${[user.social_worker_name, user.social_worker_phone].filter(Boolean).join(' · ') || 'Not recorded'}`,
      `DNACPR: ${user.dnacpr_status === 'in_place' ? 'In place' : user.dnacpr_status === 'not_in_place' ? 'Not in place' : 'Not recorded'}`,
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${user.first_name}-${user.last_name}-profile.txt`
    a.click()
    URL.revokeObjectURL(url)
    showSnackbar('The summary is downloaded as a text file.', 'success', 'Profile downloaded')
  }

  const addPlanMutation = useMutation({
    mutationFn: (data: any) => api.post(`/people/${id}/care-plans`, data),
    onSuccess: (_d, variables: any) => { queryClient.invalidateQueries({ queryKey: ['person', id] }); setAddPlanOpen(false); setPlanForm({ ...EMPTY_PLAN_FORM }); setError(''); showSnackbar(`${variables?.title || 'Care plan'} is saved.`, 'success', 'Care plan added') },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to add care plan'),
  })

  const addNoteMutation = useMutation({
    mutationFn: (data: any) => api.post(`/people/${id}/daily-notes`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person', id] }); setAddNoteOpen(false); setNoteForm({ note_date: localDate(), shift: 'day', category: '', content: '', support_level: '' }) },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to add note'),
  })

  const addRiskMutation = useMutation({
    mutationFn: (data: any) => api.post(`/people/${id}/risk-assessments`, data),
    onSuccess: (_d, variables: any) => { queryClient.invalidateQueries({ queryKey: ['person', id] }); setAddRiskOpen(false); setRiskForm({ type: '', risk_level: 'medium', details: '', mitigation_actions: '', review_date: '', file_url: '', file_name: '' }); showSnackbar(`${variables?.details || (variables?.type || 'risk').replace(/_/g, ' ')} is saved.`, 'success', 'Risk assessment saved') },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to add risk assessment'),
  })

  const addContactMutation = useMutation({
    mutationFn: (data: any) => api.post(`/people/${id}/family-contacts`, data),
    onSuccess: (_d, variables: any) => { queryClient.invalidateQueries({ queryKey: ['person', id] }); setAddContactOpen(false); setContactForm({ name: '', relationship: '', phone: '', email: '', is_emergency_contact: false }); showSnackbar(`${variables?.name || 'Contact'} is saved as a ${variables?.relationship || 'contact'}.`, 'success', 'Contact added') },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to add contact'),
  })

  const deleteContactMutation = useMutation({
    mutationFn: (contactId: string) => api.delete(`/people/family-contacts/${contactId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person', id] }); showSnackbar('Contact removed') },
    onError: (err: any) => showSnackbar(err.response?.data?.message || 'Failed to delete contact', 'error'),
  })

  const updatePlanMutation = useMutation({
    mutationFn: ({ planId, data }: { planId: string; data: any }) => api.patch(`/people/care-plans/${planId}`, data),
    onSuccess: (_d, variables: any) => { queryClient.invalidateQueries({ queryKey: ['person', id] }); setAddPlanOpen(false); setEditPlanId(null); setPlanForm({ ...EMPTY_PLAN_FORM }); setError(''); showSnackbar(`${variables?.data?.title || 'Care plan'} is saved.`, 'success', 'Care plan updated') },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to update care plan'),
  })

  const deletePlanMutation = useMutation({
    mutationFn: (planId: string) => api.delete(`/people/care-plans/${planId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person', id] }); setDeleteConfirm(null); setError(''); showSnackbar('Care plan deleted') },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to delete care plan'),
  })

  const updateNoteMutation = useMutation({
    mutationFn: ({ noteId, data }: { noteId: string; data: any }) => api.patch(`/people/daily-notes/${noteId}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person', id] }); setEditNoteId(null); setNoteForm({ note_date: localDate(), shift: 'day', category: '', content: '', support_level: '' }) },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to update note'),
  })

  const updateRiskMutation = useMutation({
    mutationFn: ({ riskId, data }: { riskId: string; data: any }) => api.patch(`/people/risk-assessments/${riskId}`, data),
    onSuccess: (_d, variables: any) => { queryClient.invalidateQueries({ queryKey: ['person', id] }); setEditRiskId(null); setAddRiskOpen(false); setRiskForm({ type: '', risk_level: 'medium', details: '', mitigation_actions: '', review_date: '', file_url: '', file_name: '' }); const reviewed = !!(variables?.data?.review_date && !variables?.data?.details && !variables?.data?.mitigation_actions); showSnackbar(reviewed ? 'The risk assessment is reviewed today.' : 'Risk assessment saved.', 'success', reviewed ? 'Marked as reviewed' : 'Risk assessment saved') },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to update risk assessment'),
  })

  const deleteRiskMutation = useMutation({
    mutationFn: (riskId: string) => api.delete(`/people/risk-assessments/${riskId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['person', id] }),
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to delete risk assessment'),
  })

  const updateContactMutation = useMutation({
    mutationFn: ({ contactId, data }: { contactId: string; data: any }) => api.patch(`/people/family-contacts/${contactId}`, data),
    onSuccess: (_d, variables: any) => { queryClient.invalidateQueries({ queryKey: ['person', id] }); setContactEditId(null); setContactForm({ name: '', relationship: '', phone: '', email: '', is_emergency_contact: false }); showSnackbar(`${variables?.data?.name || 'Contact'} is up to date.`, 'success', 'Contact updated') },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to update contact'),
  })

  const inviteFromContactMutation = useMutation({
    mutationFn: (data: any) => api.post('/family-portal/members', data),
    onSuccess: (_d, variables: any) => { queryClient.invalidateQueries({ queryKey: ['family-members', id] }); setInvitePortalOpen(false); setInvitePortalForm({ name: '', email: '', relationship: '', phone: '' }); showSnackbar(`${variables?.name || 'They'} will get an email to set up their portal.`, 'success', 'Invite sent') },
    onError: (err: any) => setInvitePortalError(err?.response?.data?.error?.message || 'Failed to send invite'),
  })

  const inlineInvitePortalMutation = useMutation({
    mutationFn: (data: any) => api.post('/family-portal/members', data),
    onSuccess: (_d, variables: any) => { queryClient.invalidateQueries({ queryKey: ['family-members', id] }); showSnackbar(`${variables?.name || 'They'} will get an email to set up their portal.`, 'success', 'Invite sent') },
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

  // Mica voice care-note flow. This is the first production voice action from the
  // product plan: the client starts microphone capture, posts the intent + name +
  // transcription to /ai/voice/notes, and reuses the existing approval path once
  // the user confirms the structured draft.
  const voiceNoteIntentMutation = useMutation({
    mutationFn: (data: any) => api.post('/ai/voice/notes', data),
    onSuccess: (res) => {
      setAiError('')
      if (res.data?.needClarification) {
        setAiVoiceClarification(res.data)
        return
      }
      // Voice path reuses the same generateDailyNote response shape: result,
      // person, and noteContext. We render the review card from that draft.
      setAiResult(res.data.result)
      setAiEditedContent(res.data.result?.daily_note?.content || '')
      setAiVoiceDraftContext(res.data.noteContext || res.data)
      setAiShowResults(true)
    },
    onError: (e: any) => setAiError(e.response?.data?.error?.message || 'Mica could not prepare the note'),
  })

  const aiVoiceApproveMutation = useMutation({
    mutationFn: (data: any) => api.post('/ai/daily-notes/approve', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['person', id] })
      setAddNoteOpen(false)
      setAiMode(false)
      setAiResult(null)
      setAiTranscript('')
      setAiEditedContent('')
      setAiShowResults(false)
      setAiVoiceDraftContext(null)
      setAiVoiceClarification(null)
      showSnackbar('Care note saved successfully')
      // Mica's write ends where its read flows do. The reply carries the note it
      // just saved and the page that note lives on (`offer`, the same link the
      // profile reads from `?source=`), so the carer is shown the note rather than
      // the top of the notes list — and the notes tab, because that is the tab the
      // note is on.
      const savedNote = (res as any)?.data?.dailyNote
      if (savedNote) {
        setTab(3)
        setViewNote(savedNote)
      }
    },
    onError: (e: any) => setAiError(e.response?.data?.error?.message || 'Failed to save care note'),
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
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to load photo')
      const blob = await res.blob()
      const oldUrl = photoUrl
      setPhotoUrl(URL.createObjectURL(blob))
      if (oldUrl) URL.revokeObjectURL(oldUrl)
    } catch { /* silently fall back to initials */ }
  }

  const viewFileInNewTab = async (url: string) => {
    try {
      const res = await fetch(url)
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

  // The note a link names. A saved care note ends on itself: the API answers
  // /ai/daily-notes/approve with the link to the note it just wrote, and the same
  // link is what another device, a notification or a colleague arrives on — so the
  // id in the URL opens the note rather than leaving it to be found in the list.
  // Guarded by a ref because the person query refreshes under this page: one id
  // opens one dialog, once.
  const openedLinkedNoteRef = useRef<string | null>(null)
  const linkedNoteId = searchParams.get(MICA_RECORD_PARAMS['care-note'])
  useEffect(() => {
    if (!linkedNoteId || openedLinkedNoteRef.current === linkedNoteId) return
    const notes = Array.isArray(user?.recent_notes) ? user.recent_notes : []
    const note = notes.find((n: any) => n.id === linkedNoteId)
    if (!note) return
    openedLinkedNoteRef.current = linkedNoteId
    // The tab is part of the link, and the URL stays the single source of truth for
    // it (the tab effect above re-derives `tab` from `?tab=`) — so a link that named
    // only the note has the slug added rather than fighting that effect.
    if (searchParams.get('tab') !== TAB_SLUGS[3]) {
      setSearchParams({ tab: TAB_SLUGS[3], [MICA_RECORD_PARAMS['care-note']]: linkedNoteId }, { replace: true })
    }
    setTab(3)
    setViewNote(note)
  }, [linkedNoteId, user, searchParams, setSearchParams])

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

  // Mica voice care-note helpers. The brief wants the entrypoint to be a natural
  // conversation, so the first client action is an intent pass: it posts what was
  // heard and lets the server return either a clarification or a draft.
  const startMicaVoiceNote = () => {
    setAiError('')
    setAiVoiceClarification(null)
    setAiVoiceDraftContext(null)
    setAiVoiceTranscript('')
    setAiVoiceListening(true)
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) { setAiError('Voice input is not supported on this browser. Try Chrome.'); setAiVoiceListening(false); return }
    const rec = new SpeechRecognition()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-GB'
    let full = ''
    rec.onresult = (e: any) => {
      full = ''
      for (let i = e.resultIndex; i < e.results.length; i++) full += e.results[i][0].transcript
      setAiVoiceTranscript(full)
    }
    rec.onerror = (e: any) => { setAiError(`Voice error: ${e.error}`); setAiVoiceListening(false) }
    rec.onend = () => setAiVoiceListening(false)
    aiVoiceRecognitionRef.current = rec
    rec.start()
  }

  const stopMicaVoiceNote = () => {
    aiVoiceRecognitionRef.current?.stop()
    setAiVoiceListening(false)
  }

  const submitMicaVoiceNote = () => {
    if (!aiVoiceTranscript.trim() || !id) { setAiError('Mica needs something to listen to.'); return }
    setAiError('')
    voiceNoteIntentMutation.mutate({
      intent: 'CREATE_CARE_NOTE',
      personId: aiVoiceDraftContext?.personId || id,
      personName: aiVoiceDraftContext?.personName,
      staffInput: aiVoiceTranscript.trim(),
      transcription: aiVoiceTranscript.trim(),
      shift: aiVoiceDraftContext?.shift || noteForm.shift,
      noteDate: aiVoiceDraftContext?.noteDate || noteForm.note_date,
      source: 'voice',
    })
  }

  const handleMicaVoiceApprove = () => {
    if (!aiResult || !id) return
    aiVoiceApproveMutation.mutate({
      personId: id,
      dailyNote: {
        content: aiEditedContent || aiResult.daily_note?.content || '',
        shift: aiResult.daily_note?.shift || aiVoiceDraftContext?.shift || noteForm.shift,
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
      source: 'voice',
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

  // Mica voice care-note state. These mirror the server clarification/draft
  // shapes so the UI can render the disambiguation card and the review card.
  const [aiVoiceDraftContext, setAiVoiceDraftContext] = useState<any>(null)
  const [aiVoiceClarification, setAiVoiceClarification] = useState<any>(null)
  const [aiVoiceListening, setAiVoiceListening] = useState(false)
  const [aiVoiceTranscript, setAiVoiceTranscript] = useState('')
  const aiVoiceRecognitionRef = useRef<any>(null)

  const resetAiMode = () => {
    setAiMode(false)
    setAiTranscript('')
    setAiResult(null)
    setAiEditedContent('')
    setAiShowResults(false)
    setAiError('')
    setAiRecording(false)
    setAiVoiceDraftContext(null)
    setAiVoiceClarification(null)
    setAiVoiceListening(false)
    setAiVoiceTranscript('')
    aiRecognitionRef.current?.stop()
    aiVoiceRecognitionRef.current?.stop()
  }

  useEffect(() => {
    if (isDomiciliary && ![0, 1, 2, 4, 5, 7, 8, 9, 13, 15, 17, 18, 20].includes(tab)) handleTabChange(0)
  }, [isDomiciliary, tab])

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /></Box>
  if (!user) return <Alert severity="error">Person not found</Alert>

  const CATEGORIES = isDomiciliary ? [
    { label: 'Overview', tabs: [0] },
    { label: 'Care', tabs: [2, 4, 9, 17] },
    { label: 'People', tabs: [5, 15] },
    { label: 'Safety', tabs: [7] },
    { label: 'Records', tabs: [13, 8, 1, 18, 20] },
  ] : [
    { label: 'Overview', tabs: [0] },
    { label: 'Care', tabs: [2, 3, 4, 9, 10, 17] },
    { label: 'Clinical', tabs: [6, 12, 14, 19, 21] },
    { label: 'People', tabs: [5, 15] },
    { label: 'Safety', tabs: [7, 16, 11] },
    { label: 'Records', tabs: [13, 8, 1, 18, 20, 22] },
  ]
  const activeCategory = Math.max(0, CATEGORIES.findIndex(cat => cat.tabs.includes(tab)))
  // Header strip + At a glance (Figma 6.2): all counted from the person row in hand.
  const highRisks = (user.risk_assessments || []).filter((r: any) => r.risk_level === 'high' || r.risk_level === 'critical').length
  const medRisks = (user.risk_assessments || []).filter((r: any) => r.risk_level === 'medium').length
  const nextPlanReview: string | null = (() => {
    const dates = (user.care_plans || []).map((p: any) => p.review_date).filter(Boolean).sort()
    return dates.length ? dates[0] : null
  })()
  const TAB_LABELS: Record<number, string> = {
    0: 'Overview', 1: 'Timeline', 2: 'Care Plans', 3: 'Daily Notes', 4: 'Risk Assessments',
    5: 'Family & Contacts', 6: 'Health', 7: 'Body Map', 8: 'Memory Book', 9: 'Goals',
    10: 'Care Assessments', 11: 'Room Checks', 12: 'Clinical Scores', 13: 'Documents',
    14: 'Wellbeing', 15: 'Communication', 16: 'MCA/Capacity', 17: 'Care Pathways',
    18: 'Time Away', 19: 'Mood Chart', 20: 'Audit Trail', 21: 'Nutrition',
    22: 'Billing & Rates',
  }

  const handleReadmit = async () => {
    try {
      await api.patch(`/people/${id}`, { status: 'active' })
      queryClient.invalidateQueries({ queryKey: ['person', id] })
      showSnackbar(`${user.first_name} ${user.last_name} is active again.`, 'success', 'Person readmitted')
    } catch (e: any) {
      showSnackbar(e.response?.data?.message || 'Failed to readmit', 'error', 'Request failed')
    }
  }

  return (
    <PageContainer>

      {/* Breadcrumb (Figma 6.2) */}
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        Care / {isDomiciliary ? 'Clients' : 'People'} / {user.first_name} {user.last_name}
      </Typography>
      {/* Discharged banner (Figma 6.8): read-only record + Readmit */}
      {user.status === 'discharged' && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}
          action={<Button size="small" variant="contained" onClick={handleReadmit} sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}>Readmit</Button>}>
          <Typography variant="subtitle2" fontWeight={600}>This record is discharged and read-only.</Typography>
          <Typography variant="body2">
            {user.discharge_date ? `Discharged ${new Date(user.discharge_date).toLocaleDateString('en-GB')}` : 'Discharged'}
            {user.discharge_destination ? ` to ${String(user.discharge_destination).replace(/_/g, ' ')}` : ''}
            {' '}— readmit to make {user.first_name} active again.
          </Typography>
        </Alert>
      )}
      {/* Profile Header */}
      <PremiumCard noBorder sx={{ p: 3, mb: 3, mt: 0.5 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'flex-start' }} spacing={2}>
          <Stack direction="row" spacing={2.5} alignItems="center">
            {/* Photo */}
            <Box sx={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }} onClick={() => fileInputRef.current?.click()}>
              <Avatar src={photoUrl || undefined}
                sx={{ width: 72, height: 72, bgcolor: METICLE_COLORS.primary, fontSize: 28, fontWeight: 600, border: '3px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
                {!photoUrl && `${user.first_name?.[0]}${user.last_name?.[0]}`}
              </Avatar>
              {uploadPhotoMutation.isPending && (
                <CircularProgress size={72} sx={{ position: 'absolute', top: 0, left: 0, color: METICLE_COLORS.primary, opacity: 0.5 }} />
              )}
              <Box sx={{ position: 'absolute', bottom: 0, right: 0, bgcolor: METICLE_COLORS.primary, borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>
                <CameraIcon sx={{ fontSize: 13, color: 'white' }} />
              </Box>
            </Box>
            <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhotoMutation.mutate(f); e.target.value = '' }} />
            {photoError && <Alert severity="error" sx={{ mt: 0.5, borderRadius: 1, position: 'absolute', top: 0, right: 0 }}>{photoError}</Alert>}

            {/* Name & Info */}
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <Typography variant="h5" sx={{ fontWeight: 600, lineHeight: 1.2 }}>{user.first_name} {user.last_name}</Typography>
                <Chip label={user.status} size="small" color={user.status === 'active' ? 'success' : user.status === 'discharged' ? 'default' : 'error'} sx={{ height: 22, fontWeight: 600 }} />
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
              {user.date_of_birth ? (
                <Typography variant="caption" color="text.secondary">
                  Born {formatDateOnly(user.date_of_birth)} · {Math.floor((Date.now() - new Date(user.date_of_birth).getTime()) / 31557600000)} years
                </Typography>
              ) : (
                <Typography variant="caption" color="text.secondary">Date of birth not recorded</Typography>
              )}
            </Box>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1}>
            {isDomiciliary && <ContextualLearnLink topic="dom-carer-web" label="Learn about client files" />}
            <Button startIcon={<MicIcon />} variant="outlined" size="small" onClick={() => {
              setAddNoteOpen(true)
              setAiMode(true)
              setAiShowResults(false)
              setAiResult(null)
              setAiTranscript('')
              setAiEditedContent('')
              setAiError('')
              setAiRecording(false)
              setAiVoiceClarification(null)
              setAiVoiceDraftContext({ personId: id, shift: noteForm.shift, noteDate: noteForm.note_date })
              setAiVoiceListening(true)
              setAiVoiceTranscript('')
              startMicaVoiceNote()
            }} sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}>
              Ask Mica to record a note
            </Button>
          <Button startIcon={<EditIcon />} variant="outlined" size="small" onClick={() => {
            const f: any = { ...user }
            for (const k of EDIT_DATE_FIELDS) f[k] = toDateInput(f[k])
            setEditForm(f); setEditTab(0); setEditOpen(true)
          }}
            sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}>
            Edit Profile
          </Button>
            <Button variant="contained" startIcon={<AddIcon />} size="small" onClick={() => { resetAiMode(); setNoteForm({ note_date: localDate(), shift: 'morning', category: '', content: '', support_level: '' }); setEditNoteId(null); setAddNoteOpen(true) }}
              sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}>
              Add a note
            </Button>
            <IconButton size="small" aria-label="More actions" onClick={(e) => setProfileMenuAnchor(e.currentTarget)}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
              <MoreVertIcon fontSize="small" />
            </IconButton>
            <Menu anchorEl={profileMenuAnchor} open={Boolean(profileMenuAnchor)} onClose={() => setProfileMenuAnchor(null)}>
              <MenuItem onClick={() => { setProfileMenuAnchor(null); downloadProfile() }}>
                <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Download profile</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => { setProfileMenuAnchor(null); window.print() }}>
                <ListItemIcon><PrintIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Print</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => { setProfileMenuAnchor(null); setMoveForm({ location_id: user.location_id || '', room_number: user.room_number || '' }); setRoomMoveOpen(true) }}>
                <ListItemIcon><HomeIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Move to another home</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => { setProfileMenuAnchor(null); setDischargeForm({ discharge_date: localDate(), discharge_destination: user.discharge_destination || '', discharge_reason: user.discharge_reason || '', discharge_summary: user.discharge_summary || '' }); setDischargeOpen(true) }}>
                <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Discharge</ListItemText>
              </MenuItem>
            </Menu>
          </Stack>
        </Stack>
        {/* At-a-glance strip (Figma 6.2): the frame's key-worker line has no data source, so it is omitted. */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mt: 2.5, pt: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>
          {[{
            icon: <WarningIcon sx={{ fontSize: 16, color: user.allergies?.length ? 'notice.error.fg' : 'text.secondary' }} />,
            label: 'Allergy', value: user.allergies?.length ? user.allergies.join(', ') : 'None recorded',
          }, {
            icon: <HealthIcon sx={{ fontSize: 16, color: user.dnacpr_status === 'in_place' ? 'notice.warning.fg' : 'text.secondary' }} />,
            label: 'DNACPR', value: user.dnacpr_status === 'in_place' ? 'In place' : user.dnacpr_status === 'not_in_place' ? 'Not in place' : user.dnacpr_status === 'discussed' ? 'Discussed' : 'Not recorded',
          }, {
            icon: <ChatIcon sx={{ fontSize: 16, color: 'text.secondary' }} />,
            label: 'Communication', value: [user.communication_method ? user.communication_method.charAt(0).toUpperCase() + user.communication_method.slice(1).replace(/_/g, ' ') : '', user.communication_language || ''].filter(Boolean).join(' - ') || 'Not recorded',
          }, {
            icon: <ShieldIcon sx={{ fontSize: 16, color: highRisks > 0 ? 'notice.error.fg' : 'text.secondary' }} />,
            label: 'Open risks', value: highRisks + medRisks > 0 ? `${highRisks} high - ${medRisks} medium` : 'None recorded',
          }].map((s) => (
            <Stack key={s.label} direction="row" spacing={1} alignItems="flex-start" sx={{ minWidth: 0 }}>
              <Box sx={{ mt: 0.25 }}>{s.icon}</Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                <Typography variant="body2" fontWeight={600} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.value}</Typography>
              </Box>
            </Stack>
          ))}
        </Box>
      </PremiumCard>

      {/* Flags / Alerts Banner (visible on every tab) */}
      {user.flags && user.flags.length > 0 && (
        <PremiumCard noBorder sx={{ p: 2, mb: 2, bgcolor: 'notice.error.bg' }}>
          <Typography variant="subtitle2" fontWeight={600} color='notice.error.fg' sx={{ mb: 1 }}>
            ⚠ Clinical Alerts
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {user.flags.map((f: string) => (
              <Chip key={f} label={f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} size="small"
                color="error" variant="filled" sx={{ fontWeight: 600 }} />
            ))}
          </Stack>
        </PremiumCard>
      )}

      {/* DNACPR Banner */}
      {user.dnacpr_status === 'in_place' && (
        <PremiumCard noBorder sx={{ p: 2, mb: 2, bgcolor: 'notice.warning.bg' }}>
          <Typography variant="subtitle2" fontWeight={600} color='notice.warning.fg' sx={{ mb: 0.5 }}>
            DNACPR in place
          </Typography>
          {user.dnacpr_date && <Typography variant="caption" color='notice.warning.fg'>Recorded: {new Date(user.dnacpr_date).toLocaleDateString('en-GB')}</Typography>}
          {user.dnacpr_review_date && <Typography variant="caption" color='notice.warning.fg' sx={{ ml: 2 }}>Next review: {new Date(user.dnacpr_review_date).toLocaleDateString('en-GB')}</Typography>}
        </PremiumCard>
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
      <PremiumCard noBorder sx={{ mb: 2 }}>
        <Stack direction="row" sx={{ bgcolor: 'action.hover', px: 1, py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          {CATEGORIES.map((cat, i) => (
            <Box key={cat.label}
              onClick={() => handleTabChange(cat.tabs[0])}
              sx={{
                px: 1.5, py: 0.75, cursor: 'pointer', borderRadius: 1.5,
                bgcolor: activeCategory === i ? METICLE_COLORS.primary : 'transparent',
                color: activeCategory === i ? '#FFFFFF' : theme.palette.text.primary,
                fontWeight: 600, fontSize: 12, textTransform: 'none',
                transition: 'all 0.15s',
                '&:hover': { bgcolor: activeCategory === i ? METICLE_COLORS.primary : 'action.selected' },
              }}>
              {cat.label}
            </Box>
          ))}
        </Stack>
        <Tabs value={tab} onChange={(_, v) => handleTabChange(v)} sx={{ minHeight: 40, '& .MuiTabs-indicator': { bgcolor: METICLE_COLORS.primary, height: 3 } }}>
          {CATEGORIES[activeCategory].tabs.map(idx => (
            <Tab key={idx} value={idx} label={TAB_LABELS[idx]}
              sx={{ textTransform: 'none', fontWeight: 600, fontSize: 13, minHeight: 40, py: 1, px: 2 }} />
          ))}
        </Tabs>
      </PremiumCard>

      {/* Tab: Overview (Figma 6.2): fact tables left, summary cards right. */}
      {tab === 0 && (
        <Box>
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={7}>
            <Stack spacing={2.5}>
          {/* Personal Details */}
            <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <PersonIcon sx={{ fontSize: 18, color: METICLE_COLORS.primary }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Personal Details</Typography>
              </Stack>
              <Stack spacing={1}>
                {[{ label: 'DOB', value: user.date_of_birth ? `${formatDateOnly(user.date_of_birth)} (${Math.floor((Date.now() - new Date(user.date_of_birth).getTime()) / 31557600000)} yrs)` : 'Not recorded' },
                  { label: 'Gender', value: user.gender || 'Not recorded' },
                  { label: 'Pronouns', value: user.pronouns || 'Not recorded' },
                  { label: 'Marital Status', value: user.marital_status ? user.marital_status.replace(/_/g, ' ') : 'Not recorded' },
                  { label: 'Religion / Faith', value: user.religion || 'Not recorded' },
                  { label: 'NHS Number', value: user.nhs_number || 'Not recorded' },
                  { label: 'Room', value: user.room_number || 'Not recorded' },
                ].map((r, i) => (
                  <Stack key={r.label} direction="row" justifyContent="space-between" sx={{ borderBottom: i < 6 ? '1px solid divider' : 'none', pb: i < 6 ? 0.75 : 0 }}>
                    <Typography variant="body2" color="text.secondary">{r.label}</Typography>
                    <Typography variant="body2" fontWeight={600}>{r.value}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          {/* Medical & GP (Figma 6.2): allergies ride in this card, in red. GP address stays — live data the frame omits. */}
            <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <HealthIcon sx={{ fontSize: 18, color: METICLE_COLORS.success }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Medical &amp; GP</Typography>
              </Stack>
              <Stack spacing={1}>
                {[{ label: 'GP name', value: user.gp_name || 'Not recorded' },
                  { label: 'GP surgery', value: user.gp_surgery || 'Not recorded' },
                  { label: 'GP phone', value: user.gp_phone || 'Not recorded' },
                  { label: 'GP email', value: user.gp_email || 'Not recorded', isLong: true },
                  { label: 'Allergies', value: user.allergies?.length ? user.allergies.join(', ') : 'None recorded', alert: !!user.allergies?.length },
                  { label: 'Dietary needs', value: user.dietary_requirements || 'Not recorded' },
                  { label: 'GP address', value: user.gp_address || 'Not recorded', isLong: true },
                ].map((r: any, i, arr) => (
                  <Stack key={r.label} direction="row" justifyContent="space-between" sx={{ borderBottom: i < arr.length - 1 ? '1px solid divider' : 'none', pb: i < arr.length - 1 ? 0.75 : 0 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0, mr: 1 }}>{r.label}</Typography>
                    <Typography variant="body2" fontWeight={600} textAlign="right" color={r.alert ? 'notice.error.fg' : 'text.primary'} sx={r.isLong ? { maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : {}}>{r.value}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          {/* Pharmacy (Figma 6.2 labels). */}
            <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <AssignmentIcon sx={{ fontSize: 18, color: '#8B7CF6' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Pharmacy</Typography>
              </Stack>
              <Stack spacing={1}>
                {[{ label: 'Pharmacy', value: user.pharmacy_name || 'Not recorded' },
                  { label: 'Phone', value: user.pharmacy_phone || 'Not recorded' },
                  { label: 'Address', value: user.pharmacy_address || 'Not recorded', isLong: true },
                ].map((r: any, i) => (
                  <Stack key={r.label} direction="row" justifyContent="space-between" sx={{ borderBottom: i < 2 ? '1px solid divider' : 'none', pb: i < 2 ? 0.75 : 0 }}>
                    <Typography variant="body2" color="text.secondary">{r.label}</Typography>
                    <Typography variant="body2" fontWeight={600} sx={r.isLong ? { maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : {}}>{r.value}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Paper>
            </Stack>
          </Grid>
          {/* ── Right column: summary cards (Figma 6.2) ── */}
          <Grid item xs={12} md={5}>
            <Stack spacing={2.5}>
            {/* At a glance (Figma 6.2): the frame's key-worker and medicines rows have no data source on this page, so they are omitted. */}
            <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <PersonIcon sx={{ fontSize: 18, color: METICLE_COLORS.primary }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>At a glance</Typography>
              </Stack>
              <Stack spacing={1}>
                {[{ label: 'Location', value: user.location_id && locations.find((l: any) => l.id === user.location_id) ? locations.find((l: any) => l.id === user.location_id).name : '—' },
                  { label: 'Support level', value: (user.support_level && SUPPORT_LEVEL_LABELS[user.support_level]) || '—' },
                  { label: 'Care plan review', value: nextPlanReview ? `${nextPlanReview < localDate() ? 'Overdue' : 'Due'} ${formatDateOnly(nextPlanReview)}` : 'None scheduled' },
                ].map((r, i) => (
                  <Stack key={r.label} direction="row" justifyContent="space-between" sx={{ borderBottom: i < 2 ? '1px solid divider' : 'none', pb: i < 2 ? 0.75 : 0 }}>
                    <Typography variant="body2" color="text.secondary">{r.label}</Typography>
                    <Typography variant="body2" fontWeight={600}>{r.value}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          {/* Communication */}
            <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <NoteIcon sx={{ fontSize: 18, color: METICLE_COLORS.primary }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Communication</Typography>
              </Stack>
              <Stack spacing={1}>
                {[{ label: 'Language', value: user.communication_language || 'English' },
                  { label: 'Interpreter', value: user.communication_interpreter ? 'Required' : 'Not needed' },
                  { label: 'Preferred Method', value: user.communication_method ? user.communication_method.replace(/_/g, ' ') : '—' },
                ].map((r, i) => (
                  <Stack key={r.label} direction="row" justifyContent="space-between" sx={{ borderBottom: i < 2 ? '1px solid divider' : 'none', pb: i < 2 ? 0.75 : 0 }}>
                    <Typography variant="body2" color="text.secondary">{r.label}</Typography>
                    <Typography variant="body2" fontWeight={600}>{r.value}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          {/* Admission & Funding */}
            <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <EventIcon sx={{ fontSize: 18, color: METICLE_COLORS.success }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Admission &amp; Funding</Typography>
              </Stack>
              <Stack spacing={1}>
                {[{ label: 'Admission Date', value: user.admission_date ? new Date(user.admission_date).toLocaleDateString('en-GB') : '—' },
                  { label: 'Admitted From', value: user.admission_source || '—' },
                  { label: 'Funding Type', value: user.funding_type ? user.funding_type.replace(/_/g, ' ') : '—' },
                  ...(user.funding_details ? [{ label: 'Funding Details', value: user.funding_details }] : []),
                ].map((r: any) => (
                  <Stack key={r.label} direction="row" justifyContent="space-between" sx={{ borderBottom: '1px solid divider', pb: 0.75 }}>
                    <Typography variant="body2" color="text.secondary">{r.label}</Typography>
                    <Typography variant="body2" fontWeight={600}>{r.value}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Paper>
            {/* Social Worker */}
            <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <PersonIcon sx={{ fontSize: 18, color: METICLE_COLORS.warning }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Social Worker</Typography>
              </Stack>
              <Stack spacing={1}>
                {[{ label: 'Name', value: user.social_worker_name || 'Not assigned' },
                  { label: 'Phone', value: user.social_worker_phone || '—' },
                  { label: 'Email', value: user.social_worker_email || '—', isLong: true },
                ].map((r: any, i) => (
                  <Stack key={r.label} direction="row" justifyContent="space-between" sx={{ borderBottom: i < 2 ? '1px solid divider' : 'none', pb: i < 2 ? 0.75 : 0 }}>
                    <Typography variant="body2" color="text.secondary">{r.label}</Typography>
                    <Typography variant="body2" fontWeight={600} sx={r.isLong ? { maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : {}}>{r.value}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Paper>
            {/* DNACPR & advance decisions (Figma 6.2): one always-visible summary; the in-place warning banner above stays. */}
            <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: user.dnacpr_status === 'in_place' ? 'notice.warning.bg' : 'background.paper' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <WarningIcon sx={{ fontSize: 18, color: user.dnacpr_status === 'in_place' ? 'notice.warning.fg' : 'text.secondary' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>DNACPR &amp; advance decisions</Typography>
              </Stack>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">DNACPR</Typography>
                  <Typography variant="body2" fontWeight={600}>{user.dnacpr_status === 'in_place' ? 'In place' : user.dnacpr_status === 'not_in_place' ? 'Not in place' : user.dnacpr_status === 'discussed' ? 'Discussed' : 'Not recorded'}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Advance decision</Typography>
                  <Typography variant="body2" fontWeight={600}>{user.advance_decision ? 'Recorded' : 'None recorded'}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Next review</Typography>
                  <Typography variant="body2" fontWeight={600}>{user.dnacpr_review_date ? new Date(user.dnacpr_review_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set'}</Typography>
                </Stack>
                {user.advance_decision && (
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary' }}>{user.advance_decision}</Typography>
                )}
                {user.dnacpr_details && (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>{user.dnacpr_details}</Typography>
                )}
              </Stack>
            </Paper>
            </Stack>
          </Grid>

          {/* Allergies */}
          {user.allergies?.length > 0 && (
            <Grid item xs={12}>
              <PremiumCard noBorder sx={{ p: 2.5, bgcolor: 'notice.error.bg' }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                  <WarningIcon sx={{ fontSize: 18, color: 'notice.error.fg' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'notice.error.fg' }}>Allergies</Typography>
                </Stack>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {user.allergies.map((a: string, i: number) => <Chip key={i} label={a} size="small" color="error" variant="filled" sx={{ fontWeight: 600 }} />)}
                </Stack>
              </PremiumCard>
            </Grid>
          )}

          {/* Discharge Summary */}
          {user.discharge_date && (
            <Grid item xs={12}>
              <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'notice.subtle.bg' }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                  <NoteIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary' }}>Discharge Summary</Typography>
                </Stack>
                <Stack spacing={0.5}>
                  <Stack direction="row" spacing={2}>
                    <Typography variant="caption" color="text.secondary">Discharged: {new Date(user.discharge_date).toLocaleDateString('en-GB')}</Typography>
                    {user.discharge_destination && <Typography variant="caption" color="text.secondary">To: {user.discharge_destination.replace(/_/g, ' ')}</Typography>}
                    {user.discharge_reason && <Typography variant="caption" color="text.secondary">Reason: {user.discharge_reason}</Typography>}
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
        <Box sx={{ pb: { xs: 10, sm: 5 } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.5} sx={{ mb: 2 }}>
            <Box>
              <Typography variant="h6" component="h2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>Care plans</Typography>
              <Typography variant="body2" color="text.secondary">Agreed support and care needs for this person.</Typography>
            </Box>
            <AppButton variant="primary" startIcon={<AddIcon />} onClick={() => { setPlanForm({ ...EMPTY_PLAN_FORM }); setEditPlanId(null); setError(''); setAddPlanOpen(true) }} sx={{ textTransform: 'none', alignSelf: { xs: 'flex-start', sm: 'center' } }}>
              New care plan
            </AppButton>
          </Stack>
          {(user.care_plans?.length > 0) && (
            <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
              {(['all', 'active', 'under_review', 'archived'] as const).map(status => {
                const count = status === 'all'
                  ? user.care_plans.length
                  : user.care_plans.filter((cp: any) => (cp.status || 'active') === status).length
                const label = status === 'all' ? 'All' : status === 'under_review' ? 'Under review' : status.charAt(0).toUpperCase() + status.slice(1)
                return (
                  <Chip
                    key={status}
                    label={`${label} (${count})`}
                    size="small"
                    onClick={() => setPlanStatusFilter(status)}
                    color={planStatusFilter === status ? 'primary' : 'default'}
                    variant={planStatusFilter === status ? 'filled' : 'outlined'}
                    sx={{ fontWeight: 600 }}
                  />
                )
              })}
            </Stack>
          )}
          {isLoading ? (
            <Grid container spacing={2} aria-label="Loading care plans">
              {[0, 1].map(index => <Grid item xs={12} md={6} key={index}>
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, height: 176 }}>
                  <Stack spacing={1.5}><Box sx={{ display: 'flex', gap: 1 }}><Box sx={{ width: '48%', height: 24, bgcolor: 'action.hover', borderRadius: 1 }} /><Box sx={{ width: 92, height: 22, bgcolor: 'action.hover', borderRadius: 1 }} /></Box><Box sx={{ width: '82%', height: 18, bgcolor: 'action.hover', borderRadius: 1 }} /><Box sx={{ width: '38%', height: 18, bgcolor: 'action.hover', borderRadius: 1, mt: 'auto' }} /></Stack>
                </Paper>
              </Grid>)}
            </Grid>
          ) : isError ? (
            <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => refetch()}>Try again</Button>}>
              Unable to load this person's care plans. Please try again.
            </Alert>
          ) : !user.care_plans?.length ? (
            <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3 }, borderRadius: 2, textAlign: 'center', bgcolor: 'background.paper' }}>
              <Box sx={{ width: 40, height: 40, mx: 'auto', mb: 1.25, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'action.hover', color: 'text.secondary' }}><AssignmentIcon fontSize="small" /></Box>
              <Typography variant="subtitle1" component="h3" fontWeight={600}>No care plans yet</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420, mx: 'auto', my: 1 }}>Create a care plan to document this person's agreed support and care needs.</Typography>
              <AppButton variant="primary" startIcon={<AddIcon />} onClick={() => { setPlanForm({ ...EMPTY_PLAN_FORM }); setEditPlanId(null); setError(''); setAddPlanOpen(true) }} sx={{ textTransform: 'none', mt: 0.5 }}>New care plan</AppButton>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {(planStatusFilter === 'all' ? user.care_plans : user.care_plans.filter((cp: any) => (cp.status || 'active') === planStatusFilter)).map((cp: any) => {
                const editPlanForCard = (plan: any) => {
                  setPlanForm({ title: plan.title, category: plan.category, description: plan.description || '', risk_assessment: plan.risk_assessment || '', review_date: plan.review_date ? toDateInput(plan.review_date) : '', mobility_level: plan.mobility_level || '', mobility_aids: plan.mobility_aids || '', communication_needs: plan.communication_needs || '', capacity_status: plan.capacity_status || '', sleep_pattern: plan.sleep_pattern || '', emergency_info: plan.emergency_info || '', personal_goals: plan.personal_goals || '', likes_dislikes: plan.likes_dislikes || '', cultural_needs: plan.cultural_needs || '', file_url: plan.file_url || '', file_name: plan.file_name || '', sections: plan.sections || { ...EMPTY_PLAN_FORM.sections } })
                  setEditPlanId(plan.id); setPlanTab(0); setError(''); setAddPlanOpen(true)
                }
                return (
                  <Grid item xs={12} md={6} key={cp.id}>
                    <CarePlanCardView
                      plan={cp}
                      onView={viewCarePlan}
                      onEdit={plan => editPlanForCard(plan)}
                      onDelete={plan => setDeleteConfirm({ type: 'plan', id: plan.id })}
                    />
                  </Grid>
                )
              })}
            </Grid>
          )}
          {planStatusFilter !== 'all' && (user.care_plans || []).filter((cp: any) => (cp.status || 'active') === planStatusFilter).length === 0 && user.care_plans?.length > 0 && (
            <EmptyRow message={`No ${planStatusFilter === 'under_review' ? 'under review' : planStatusFilter} care plans`} />
          )}
        </Box>
      )}

      {/* Tab: Daily Notes */}
      {tab === 3 && (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Daily Notes</Typography>
            <Stack direction="row" spacing={1}>
              <Tooltip title="Write with AI">
                <IconButton size="small" onClick={() => { resetAiMode(); setAiMode(true); setNoteForm({ note_date: localDate(), shift: 'morning', category: '', content: '', support_level: '' }); setEditNoteId(null); setAddNoteOpen(true) }}
                  sx={{ bgcolor: '#8B7CF6', color: '#FFFFFF', borderRadius: 1.5, width: 32, height: 32, '&:hover': { bgcolor: '#8B7CF6' } }}>
                  <AiIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => { resetAiMode(); setNoteForm({ note_date: localDate(), shift: 'morning', category: '', content: '', support_level: '' }); setEditNoteId(null); setAddNoteOpen(true) }}
                sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none', px: 2 }}>Add Note</Button>
            </Stack>
          </Stack>
          {(!user.recent_notes || user.recent_notes.length === 0) ? (
            <EmptyState
              icon={<NoteIcon />}
              title="No daily notes yet"
              description="Record observations, activities, and wellbeing notes for this person."
              action={{ label: 'Add Note', onClick: () => { setNoteForm({ note_date: localDate(), shift: 'morning', category: '', content: '', support_level: '' }); setAddNoteOpen(true) } }}
            />
          ) : (
            <Stack spacing={1.5}>
              {user.recent_notes.map((n: any) => (
                <Paper key={n.id} sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', cursor: 'pointer', transition: 'all 0.15s', '&:hover': { boxShadow: '0 2px 10px rgba(0,0,0,0.08)', borderColor: '#D6E2EE' } }} onClick={() => setViewNote(n)}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 0.75 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip label={n.shift} size="small" color={n.shift === 'day' ? 'primary' : 'default'}
                        sx={{ textTransform: 'capitalize', fontWeight: 600, height: 22, fontSize: 11 }} />
                      <Chip label={n.category?.replace(/_/g, ' ')} size="small" variant="outlined"
                        sx={{ textTransform: 'capitalize', height: 22, fontSize: 11 }} />
                      {n.support_level && SUPPORT_LEVEL_LABELS[n.support_level] && (
                        <Chip label={SUPPORT_LEVEL_LABELS[n.support_level]} size="small" color={SUPPORT_LEVEL_COLORS[n.support_level] || 'default'}
                          sx={{ height: 20, fontSize: 10 }} />
                      )}
                      {n.generated_by_ai && (
                        <Chip icon={<AiIcon sx={{ fontSize: 12 }} />} label="AI" size="small"
                          sx={{ height: 20, fontSize: 10, bgcolor: 'notice.subtle.bg', color: '#8B7CF6', fontWeight: 600, '& .MuiChip-icon': { color: '#8B7CF6' } }} />
                      )}
                      <Typography variant="caption" color="text.secondary">{n.note_date ? new Date(n.note_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</Typography>
                    </Stack>
                    <Typography variant="caption" color="text.muted" sx={{ fontWeight: 500 }}>{n.author_name || ''}</Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.primary', lineHeight: 1.6 }}>{n.content}</Typography>
                  {n.generated_by_ai && n.ai_risk_level && (
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.75 }}>
                      {n.ai_mood_analysis && <Typography variant="caption" color="#8B7CF6">{getMoodEmoji(n.ai_mood_analysis.mood_score)} Mood {n.ai_mood_analysis.mood_score}/10</Typography>}
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
          <Stack direction="row" justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mb: 2 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Risk assessments</Typography>
              {(user.risk_assessments?.length > 0) && (
                <Typography variant="body2" color="text.secondary">
                  {user.risk_assessments.length} assessment{user.risk_assessments.length === 1 ? '' : 's'} · {' '}
                  {user.risk_assessments.filter((ra: any) => ra.review_date && new Date(ra.review_date) < new Date(new Date().toDateString())).length} overdue review
                </Typography>
              )}
            </Box>
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setAddRiskOpen(true)}
              sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none', px: 2, alignSelf: 'center' }}>New risk assessment</Button>
          </Stack>
          {(!user.risk_assessments || user.risk_assessments.length === 0) ? (
            <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <WarningIcon sx={{ fontSize: 40, color: '#D6E2EE', mb: 1 }} />
              <Typography color="text.muted">No risk assessments</Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'notice.subtle.bg' }}>
                    <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Risk Level</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Details</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Review Date</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {user.risk_assessments.map((ra: any) => (
                    <TableRow key={ra.id} onClick={() => setViewRisk(ra)} sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'notice.subtle.bg' } }}>
                      <TableCell sx={{ textTransform: 'capitalize', fontWeight: 600 }}>{ra.type?.replace(/_/g, ' ')}</TableCell>
                      <TableCell>
                        <Chip icon={<WarningIcon sx={{ fontSize: 14 }} />} label={ra.risk_level} size="small"
                          sx={{ bgcolor: `${RISK_COLORS[ra.risk_level] || '#51637A'}18`, color: RISK_COLORS[ra.risk_level] || '#51637A', fontWeight: 600, textTransform: 'capitalize' }} />
                      </TableCell>
                      <TableCell><Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>{ra.details || '—'}</Typography></TableCell>
                      <TableCell>{ra.review_date ? new Date(ra.review_date).toLocaleDateString('en-GB') : '—'}</TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setRiskForm({ type: ra.type, risk_level: ra.risk_level, details: ra.details || '', mitigation_actions: ra.mitigation_actions || '', review_date: ra.review_date ? ra.review_date.slice(0, 10) : '', file_url: ra.file_url || '', file_name: ra.file_name || '' }); setEditRiskId(ra.id); setAddRiskOpen(true) }} title="Edit">
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: 'risk', id: ra.id }) }} title="Delete">
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
          <Stack direction="row" justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mb: 1 }}>
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>Family & contacts</Typography>
              <Typography variant="body2" color="text.secondary">Invite family to the Family Portal so they can see care notes and plans securely.</Typography>
            </Box>
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => { setContactForm({ name: '', relationship: '', phone: '', email: '', is_emergency_contact: false }); setAddContactOpen(true) }}
              sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none', alignSelf: 'center', flexShrink: 0 }}>Add contact</Button>
          </Stack>

          {(!user.family_contacts || user.family_contacts.length === 0) ? (
            <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 3 }}>
              <Typography color="text.muted">No family contacts added</Typography>
            </Paper>
          ) : (
            <Paper sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 3, overflow: 'hidden' }}>
              <Stack divider={<Divider />} spacing={0}>
                {user.family_contacts.map((fc: any) => {
                  const portalMember = portalMembers.find((pm: any) => pm.email?.toLowerCase() === fc.email?.toLowerCase())
                  const initials = String(fc.name || '?').split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()
                  const detailLine = [fc.phone, fc.email].filter(Boolean).join(' · ')
                  return (
                    <Box key={fc.id} sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: 'notice.muted.bg', color: METICLE_COLORS.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.8rem', flexShrink: 0 }}>
                        {initials}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <Typography variant="body2" fontWeight={600}>{fc.name}{fc.relationship ? ` · ${fc.relationship}` : ''}</Typography>
                          {fc.is_emergency_contact && <Chip label="Emergency contact" size="small" color="error" sx={{ height: 20, fontSize: '0.7rem' }} />}
                        </Stack>
                        <Typography variant="caption" color="text.secondary" noWrap>{detailLine || 'No contact details'}</Typography>
                      </Box>
                      {portalMember?.status === 'active' ? (
                        <Chip label="Portal: active" size="small" color="success" sx={{ flexShrink: 0 }} />
                      ) : portalMember?.status === 'invited' ? (
                        <Chip label="Invited" size="small" color="warning" sx={{ flexShrink: 0 }} />
                      ) : (fc.email ? (
                        <Button size="small" variant="outlined"
                          onClick={() => inlineInvitePortalMutation.mutate({ name: fc.name, email: fc.email, relationship: fc.relationship || '', phone: fc.phone || '', person_id: id })}
                          disabled={inlineInvitePortalMutation.isPending} sx={{ textTransform: 'none', flexShrink: 0 }}>
                          Invite to portal
                        </Button>
                      ) : null)}
                      <IconButton size="small" onClick={e => setContactMenuAnchor({ el: e.currentTarget, contact: fc })}>
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  )
                })}
              </Stack>
            </Paper>
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
                    <ListItemIcon><PeopleIcon fontSize="small" sx={{ color: METICLE_COLORS.primary }} /></ListItemIcon><ListItemText>Invite to Family Portal</ListItemText>
                  </MenuItem>
                )
              }
              if (pm.status === 'active' || pm.status === 'invited') {
                return (
                  <Fragment key="portal-actions">
                    {pm.access_token && (
                      <>
                        <MenuItem onClick={() => { const url = `${window.location.origin}/family-portal/${pm.access_token}`; navigator.clipboard?.writeText(url).then(() => showSnackbar('Portal link copied to clipboard'), () => showSnackbar(url, 'info')); setContactMenuAnchor(null) }}>
                          <ListItemIcon><FileIcon fontSize="small" sx={{ color: METICLE_COLORS.primary }} /></ListItemIcon>
                          <ListItemText>
                            <Typography variant="body2" fontWeight={600}>Copy Portal Link</Typography>
                            <Typography variant="caption" color="text.muted" sx={{ fontFamily: 'monospace' }}>{window.location.origin}/…{pm.access_token.slice(-8)}</Typography>
                          </ListItemText>
                        </MenuItem>
                        <MenuItem onClick={() => { inlineCancelInviteMutation.mutate(pm.id); setContactMenuAnchor(null) }} disabled={inlineCancelInviteMutation.isPending}>
                          <ListItemIcon><BlockIcon fontSize="small" color="warning" /></ListItemIcon><ListItemText sx={{ color: METICLE_COLORS.warning }}>Revoke Portal Access</ListItemText>
                        </MenuItem>
                      </>
                    )}
                    {!pm.access_token && pm.status === 'invited' && (
                      <MenuItem onClick={() => { inlineCancelInviteMutation.mutate(pm.id); setContactMenuAnchor(null) }} disabled={inlineCancelInviteMutation.isPending}>
                        <ListItemIcon><BlockIcon fontSize="small" color="warning" /></ListItemIcon><ListItemText sx={{ color: METICLE_COLORS.warning }}>Cancel Invitation</ListItemText>
                      </MenuItem>
                    )}
                  </Fragment>
                )
              }
              return null
            })()}
            <MenuItem onClick={() => { const c = contactMenuAnchor?.contact; if (c) deleteContactMutation.mutate(c.id); setContactMenuAnchor(null) }}>
              <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon><ListItemText sx={{ color: METICLE_COLORS.danger }}>Delete</ListItemText>
            </MenuItem>
          </Menu>
        </Box>
      )}

      {/* Tab: Health */}
      {tab === 6 && <HealthTab personId={id!} fluidTarget={user?.fluid_daily_target} />}

      {/* Tab: Nutrition */}
      {tab === 21 && <NutritionTab personId={id!} personName={user ? `${user.first_name} ${user.last_name}` : undefined} />}

      {/* Tab: Body Map */}
      {tab === 7 && <BodyMapTab personId={id!} />}

      {/* Tab: Memory Book */}
      {tab === 8 && <MemoryBookTab personId={id!} />}

      {/* Tab: Goals */}
      {tab === 9 && <GoalsPage personId={id!} personName={user ? `${user.first_name} ${user.last_name}` : ''} carePlans={user?.care_plans} />}

      {/* Tab: Care Assessments */}
      {tab === 10 && <CareAssessmentsTabInline personId={id!} />}

      {/* Tab: Room Checks */}
      {tab === 11 && <RoomChecksTab roomNumber={user.room_number} locationId={user.location_id || null} />}

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

      {/* Tab: Time Away */}
      {tab === 18 && <TimeAwayTabInline personId={id!} />}

      {/* Tab: Mood Chart */}
      {tab === 19 && <MoodChartTabInline personId={id!} />}

      {/* Tab: Audit Trail */}
      {tab === 20 && <AuditTrailTabInline personId={id!} />}

      {/* Tab: Billing & Rates */}
      {tab === 22 && (
        <BillingRatesTabInline personId={id!} personName={user ? `${user.first_name} ${user.last_name}` : ''} />
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="md" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); updateMutation.mutate(editForm) }}>
          <DialogTitle sx={{ pb: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>Edit {user.first_name}'s profile</Typography>
                <Typography variant="body2" color="text.secondary">Changes are saved to their record and shown in the audit trail.</Typography>
              </Box>
              <Button onClick={() => setEditOpen(false)} sx={{ textTransform: 'none', fontWeight: 600 }}>Close</Button>
            </Stack>
          </DialogTitle>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} md={4}>
                <Tabs orientation="vertical" value={editTab} onChange={(_e, v) => setEditTab(v)}
                  sx={{ borderRight: 1, borderColor: 'divider', '& .MuiTab-root': { alignItems: 'flex-start', textAlign: 'left', textTransform: 'none', fontWeight: 600, pr: 2 }, '& .Mui-selected': { color: 'primary.main' } }}>
                  {['Personal details', 'Health & GP', 'Pharmacy', 'Communication', 'Admission & funding', 'Social worker', 'DNACPR & advance decisions', 'Discharge'].map(t => (
                    <Tab key={t} label={t} sx={{ maxWidth: 'none' }} />
                  ))}
                </Tabs>
              </Grid>
              <Grid item xs={12} md={8}>
            {editTab === 0 && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1}>
                <TextField label="First Name" fullWidth value={editForm.first_name || ''} onChange={e => setEditForm({ ...editForm, first_name: e.target.value })} />
                <TextField label="Last Name" fullWidth value={editForm.last_name || ''} onChange={e => setEditForm({ ...editForm, last_name: e.target.value })} />
              </Stack>
              <TextField label="Date of Birth" type="date" fullWidth InputLabelProps={{ shrink: true }} value={editForm.date_of_birth || ''} onChange={e => setEditForm({ ...editForm, date_of_birth: e.target.value })} />
              <Stack direction="row" spacing={1}>
                <TextField label="NHS Number" fullWidth value={editForm.nhs_number || ''} onChange={e => setEditForm({ ...editForm, nhs_number: e.target.value })} />
                <TextField label="Room" fullWidth value={editForm.room_number || ''} onChange={e => setEditForm({ ...editForm, room_number: e.target.value })} />
              </Stack>
              <TextField select label="Location" fullWidth value={editForm.location_id || ''} onChange={e => setEditForm({ ...editForm, location_id: e.target.value })}>
                <MenuItem value="">None specified</MenuItem>
                {locations.map((l: any) => (
                  <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
                ))}
              </TextField>
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
              <Typography variant="subtitle2" fontWeight={600}>Tags / Labels</Typography>
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
            </Stack>
            )}
            {editTab === 1 && (
            <Stack spacing={2}>
              <TextField label="GP Name" fullWidth value={editForm.gp_name || ''} onChange={e => setEditForm({ ...editForm, gp_name: e.target.value })} />
              <TextField label="GP Surgery" fullWidth value={editForm.gp_surgery || ''} onChange={e => setEditForm({ ...editForm, gp_surgery: e.target.value })} />
              <TextField label="GP Phone" fullWidth value={editForm.gp_phone || ''} onChange={e => setEditForm({ ...editForm, gp_phone: e.target.value })} />
              <TextField label="GP Email" fullWidth value={editForm.gp_email || ''} onChange={e => setEditForm({ ...editForm, gp_email: e.target.value })} />
              <TextField label="GP Address" fullWidth multiline rows={2} value={editForm.gp_address || ''} onChange={e => setEditForm({ ...editForm, gp_address: e.target.value })} />
              <TextField label="Dietary Requirements" fullWidth multiline rows={2} value={editForm.dietary_requirements || ''} onChange={e => setEditForm({ ...editForm, dietary_requirements: e.target.value })} />
              <TextField label="Allergies (comma-separated)" fullWidth value={Array.isArray(editForm.allergies) ? editForm.allergies.join(', ') : editForm.allergies || ''} onChange={e => setEditForm({ ...editForm, allergies: e.target.value.split(',').map((a: string) => a.trim()).filter(Boolean) })} />
              <Typography variant="subtitle2" fontWeight={600}>Clinical Flags</Typography>
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
            </Stack>
            )}
            {editTab === 2 && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1}>
                <TextField label="Pharmacy Name" fullWidth value={editForm.pharmacy_name || ''} onChange={e => setEditForm({ ...editForm, pharmacy_name: e.target.value })} />
                <TextField label="Pharmacy Phone" fullWidth value={editForm.pharmacy_phone || ''} onChange={e => setEditForm({ ...editForm, pharmacy_phone: e.target.value })} />
              </Stack>
              <TextField label="Pharmacy Address" fullWidth multiline rows={2} value={editForm.pharmacy_address || ''} onChange={e => setEditForm({ ...editForm, pharmacy_address: e.target.value })} />
            </Stack>
            )}
            {editTab === 3 && (
            <Stack spacing={2}>
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
                sx={{ textTransform: 'none', alignSelf: 'flex-start' }}>
                {editForm.communication_interpreter ? '✓ Interpreter Required' : 'Interpreter Needed'}
              </Button>
            </Stack>
            )}
            {editTab === 4 && (
            <Stack spacing={2}>
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
            </Stack>
            )}
            {editTab === 5 && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1}>
                <TextField label="Name" fullWidth value={editForm.social_worker_name || ''} onChange={e => setEditForm({ ...editForm, social_worker_name: e.target.value })} />
                <TextField label="Phone" fullWidth value={editForm.social_worker_phone || ''} onChange={e => setEditForm({ ...editForm, social_worker_phone: e.target.value })} />
              </Stack>
              <TextField label="Email" fullWidth value={editForm.social_worker_email || ''} onChange={e => setEditForm({ ...editForm, social_worker_email: e.target.value })} />
            </Stack>
            )}
            {editTab === 6 && (
            <Stack spacing={2}>
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
            </Stack>
            )}
            {editTab === 7 && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Use this when {user.first_name} moves on. Their record is kept safe under Discharged.
              </Typography>
              <Button variant="outlined" color="error" onClick={() => { setEditOpen(false); setDischargeOpen(true) }}
                sx={{ textTransform: 'none', alignSelf: 'flex-start' }}>
                Discharge {user.first_name}…
              </Button>
            </Stack>
            )}
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={updateMutation.isPending} sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}>
              {updateMutation.isPending ? <CircularProgress size={20} /> : 'Save'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Move to another home Dialog */}
      <Dialog open={roomMoveOpen} onClose={() => setRoomMoveOpen(false)} maxWidth="xs" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); moveMutation.mutate({ location_id: moveForm.location_id || null, room_number: moveForm.room_number || null }) }}>
          <DialogTitle sx={{ fontWeight: 600 }}>Move {user.first_name} to another home</DialogTitle>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Choose where {user.first_name} is moving to. The rota and room board update straight away.
              </Typography>
              <TextField select label="Location" fullWidth value={moveForm.location_id} onChange={e => setMoveForm({ ...moveForm, location_id: e.target.value })}>
                <MenuItem value="">None specified</MenuItem>
                {locations.map((l: any) => (
                  <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
                ))}
              </TextField>
              <TextField label="Room" fullWidth value={moveForm.room_number} onChange={e => setMoveForm({ ...moveForm, room_number: e.target.value })} />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRoomMoveOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={moveMutation.isPending} sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}>
              {moveMutation.isPending ? <CircularProgress size={20} /> : 'Move'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Discharge Dialog */}
      <Dialog open={dischargeOpen} onClose={() => setDischargeOpen(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); dischargeMutation.mutate(dischargeForm) }}>
          <DialogTitle sx={{ fontWeight: 600 }}>Discharge {user.first_name} {user.last_name}</DialogTitle>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Their record is kept safe under Discharged, including notes, care plans and documents.
              </Typography>
              <Stack direction="row" spacing={1}>
                <TextField label="Discharge Date" type="date" fullWidth required InputLabelProps={{ shrink: true }} value={dischargeForm.discharge_date} onChange={e => setDischargeForm({ ...dischargeForm, discharge_date: e.target.value })} />
                <TextField select label="Destination" fullWidth value={dischargeForm.discharge_destination} onChange={e => setDischargeForm({ ...dischargeForm, discharge_destination: e.target.value })}>
                  <MenuItem value="">— Not specified —</MenuItem>
                  <MenuItem value="home">Home</MenuItem>
                  <MenuItem value="family">Family member's home</MenuItem>
                  <MenuItem value="care_home">Care home</MenuItem>
                  <MenuItem value="nursing_home">Nursing home</MenuItem>
                  <MenuItem value="hospital">Hospital</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </TextField>
              </Stack>
              <TextField label="Discharge Reason" fullWidth value={dischargeForm.discharge_reason} onChange={e => setDischargeForm({ ...dischargeForm, discharge_reason: e.target.value })} />
              <TextField label="Discharge Summary" fullWidth multiline rows={3} value={dischargeForm.discharge_summary} onChange={e => setDischargeForm({ ...dischargeForm, discharge_summary: e.target.value })} />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDischargeOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" color="error" disabled={dischargeMutation.isPending} sx={{ textTransform: 'none' }}>
              {dischargeMutation.isPending ? <CircularProgress size={20} /> : 'Discharge'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Add / Edit Care Plan Dialog */}
       <Dialog open={addPlanOpen} onClose={() => { if (!addPlanMutation.isPending && !updatePlanMutation.isPending) { setAddPlanOpen(false); setEditPlanId(null); setError('') } }} maxWidth="md" fullWidth key={editPlanId || 'new'}>
        <Box component="form" onSubmit={(e: React.FormEvent) => {
          e.preventDefault()
          if (editPlanId) {
            updatePlanMutation.mutate({ planId: editPlanId, data: planForm })
          } else {
            addPlanMutation.mutate(planForm)
          }
        }}>
          <FigDialogHeader eyebrow={eyebrowFor(user, 'CARE')} title={editPlanId ? 'Edit care plan' : 'New care plan'} subtitle="Enter care plan details where you can." onClose={() => { setAddPlanOpen(false); setEditPlanId(null); setError('') }} />
          <Tabs value={planTab} onChange={(_, v) => setPlanTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', px: 3, mb: 1 }}>
            <Tab label="Details" />
            <Tab label="Person-Centred Plan" />
          </Tabs>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

            {planTab === 0 ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Title" fullWidth required value={planForm.title} onChange={e => setPlanForm({ ...planForm, title: e.target.value })} />
              <Box>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Care area</Typography>
                <PillOptions options={CATEGORY_OPTIONS.map(c => ({ value: c, label: c.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase()) }))} value={planForm.category} onChange={v => setPlanForm({ ...planForm, category: v })} />
              </Box>
              <TextField label={`What matters to ${user.first_name}`} fullWidth multiline rows={3} value={planForm.description} onChange={e => setPlanForm({ ...planForm, description: e.target.value })} placeholder="Routines, preferences, the small things that matter." />
              <TextField label={`How we support ${user.first_name}`} fullWidth multiline rows={2} value={planForm.risk_assessment} onChange={e => setPlanForm({ ...planForm, risk_assessment: e.target.value })} placeholder="What good support looks like, step by step." />
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
              <Typography variant="subtitle2" fontWeight={600}>Attachments</Typography>
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
                  sx={{ textTransform: 'none',}}>
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
              <Typography variant="subtitle1" fontWeight={600}>Who Contributed</Typography>
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
              <Typography variant="subtitle1" fontWeight={600}>What have we tried?</Typography>
              <TextField fullWidth multiline rows={3} placeholder="Describe strategies, approaches, and interventions that have been attempted..."
                value={planForm.sections.what_tried || ''}
                onChange={e => setPlanForm({ ...planForm, sections: { ...planForm.sections, what_tried: e.target.value } })} />

              <Typography variant="subtitle1" fontWeight={600}>What have we learned?</Typography>
              <TextField fullWidth multiline rows={3} placeholder="What has worked, what hasn't worked, key insights..."
                value={planForm.sections.what_learned || ''}
                onChange={e => setPlanForm({ ...planForm, sections: { ...planForm.sections, what_learned: e.target.value } })} />

              <Divider />
              <Typography variant="subtitle1" fontWeight={600}>What are we pleased about?</Typography>
              <TextField fullWidth multiline rows={3} placeholder="Progress made, strengths, positive outcomes..."
                value={planForm.sections.what_pleased || ''}
                onChange={e => setPlanForm({ ...planForm, sections: { ...planForm.sections, what_pleased: e.target.value } })} />

              <Typography variant="subtitle1" fontWeight={600}>What are we concerned about?</Typography>
              <TextField fullWidth multiline rows={3} placeholder="Risks, challenges, areas needing attention..."
                value={planForm.sections.what_concerned || ''}
                onChange={e => setPlanForm({ ...planForm, sections: { ...planForm.sections, what_concerned: e.target.value } })} />

              <Divider />
              <Typography variant="subtitle1" fontWeight={600}>What do we need to do next?</Typography>
              <TextField fullWidth multiline rows={4} placeholder="Actionable next steps, responsible person, timeline..."
                value={planForm.sections.next_steps || ''}
                onChange={e => setPlanForm({ ...planForm, sections: { ...planForm.sections, next_steps: e.target.value } })} />
            </Stack>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => { setAddPlanOpen(false); setEditPlanId(null); setError('') }} disabled={addPlanMutation.isPending || updatePlanMutation.isPending}>Cancel</Button>
            <AppButton type="submit" variant="primary" loading={addPlanMutation.isPending || updatePlanMutation.isPending} disabled={planUploading || !planForm.title.trim() || !planForm.category}>
              {editPlanId ? 'Save changes' : 'Add care plan'}
            </AppButton>
          </DialogActions>
        </Box>
      </Dialog>

      {/* View Care Plan Dialog */}
      <Dialog open={!!viewPlan} onClose={closeCarePlanView} maxWidth="md" fullWidth>
        {viewPlan && (
          <>
            <DialogTitle sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              <AssignmentIcon sx={{ color: METICLE_COLORS.primary }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1" fontWeight={600} noWrap>{viewPlan.title}</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label={viewPlan.category?.replace(/_/g, ' ')} size="small" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                  <Chip label={viewPlan.status === 'active' ? 'Active' : viewPlan.status === 'archived' ? 'Archived' : 'Draft'} size="small"
                    color={viewPlan.status === 'active' ? 'success' : 'default'} sx={{ height: 20, fontSize: 11 }} />
                  {viewPlan.review_date && <Typography variant="caption" color="text.muted">Review: {new Date(viewPlan.review_date).toLocaleDateString('en-GB')}</Typography>}
                </Stack>
              </Box>
              <IconButton sx={{ ml: 'auto' }} onClick={closeCarePlanView}><CloseIcon fontSize="small" /></IconButton>
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2}>
                {viewPlan.description && (
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: 'notice.subtle.bg', borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>WHAT MATTERS TO {user.first_name.toUpperCase()}</Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>{viewPlan.description}</Typography>
                  </Paper>
                )}
                {viewPlan.risk_assessment && (
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: 'notice.warning.bg', borderColor: '#FFF7E6', borderRadius: 2 }}>
                    <Typography variant="caption" color='notice.warning.fg' fontWeight={600}>HOW WE SUPPORT {user.first_name.toUpperCase()}</Typography>
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
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>{String(k).toUpperCase()}</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{String(v).replace(/_/g, ' ')}</Typography>
                    </Grid>
                  ))}
                </Grid>

                {viewPlan.sections && (viewPlan.sections.contributors?.length > 0 || viewPlan.sections.what_tried || viewPlan.sections.what_learned || viewPlan.sections.what_pleased || viewPlan.sections.what_concerned || viewPlan.sections.next_steps) && (
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: METICLE_COLORS.primary, bgcolor: 'notice.subtle.bg' }}>
                    <Typography variant="subtitle2" fontWeight={600} color={METICLE_COLORS.primary} sx={{ mb: 1.5 }}>PERSON-CENTRED PLAN</Typography>
                    <Stack spacing={2}>
                      {(viewPlan.sections.contributors || []).length > 0 && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" fontWeight={600}>WHO CONTRIBUTED</Typography>
                          {viewPlan.sections.contributors.map((c: Contributor, i: number) => (
                            <Typography key={i} variant="body2" sx={{ mt: 0.25 }}>
                              {c.name}{c.role ? ` (${c.role})` : ''}
                            </Typography>
                          ))}
                        </Box>
                      )}
                      {viewPlan.sections.what_tried && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" fontWeight={600}>WHAT HAVE WE TRIED</Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.25 }}>{viewPlan.sections.what_tried}</Typography>
                        </Box>
                      )}
                      {viewPlan.sections.what_learned && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" fontWeight={600}>WHAT HAVE WE LEARNED</Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.25 }}>{viewPlan.sections.what_learned}</Typography>
                        </Box>
                      )}
                      {viewPlan.sections.what_pleased && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" fontWeight={600}>WHAT ARE WE PLEASED ABOUT</Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.25 }}>{viewPlan.sections.what_pleased}</Typography>
                        </Box>
                      )}
                      {viewPlan.sections.what_concerned && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" fontWeight={600}>WHAT ARE WE CONCERNED ABOUT</Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.25 }}>{viewPlan.sections.what_concerned}</Typography>
                        </Box>
                      )}
                      {viewPlan.sections.next_steps && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" fontWeight={600}>WHAT DO WE NEED TO DO NEXT</Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.25 }}>{viewPlan.sections.next_steps}</Typography>
                        </Box>
                      )}
                    </Stack>
                  </Paper>
                )}

                {viewPlan.file_url && (
                  <Paper variant="outlined" sx={{ borderRadius: 2, p: 1.5 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <FileIcon sx={{ fontSize: 20, color: METICLE_COLORS.primary }} />
                      <Typography variant="body2" fontWeight={600} sx={{ flex: 1, minWidth: 0 }} noWrap>
                        {viewPlan.file_name || viewPlan.file_url.split('/').pop() || 'Attached document'}
                      </Typography>
                      <Button size="small" variant="outlined" startIcon={<DownloadIcon fontSize="small" />}
                        onClick={() => viewFileInNewTab(viewPlan.file_url)}
                        sx={{ textTransform: 'none' }}>
                        View file
                      </Button>
                    </Stack>
                  </Paper>
                )}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 2.5 }}>
              <Button variant="outlined" sx={{ textTransform: 'none' }}
                onClick={() => { updatePlanMutation.mutate({ planId: viewPlan.id, data: { review_date: localDate() } }); closeCarePlanView() }}>
                Mark as reviewed
              </Button>
              <Button startIcon={<EditIcon />} variant="contained" sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}
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
        <DialogTitle sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          {aiMode ? <><AiIcon sx={{ color: '#03C6B1' }} /> Write with Mica</> : (editNoteId ? 'Edit Daily Note' : 'Add Daily Note')}
          {!editNoteId && !aiShowResults && (
            <Tooltip title={aiMode ? 'Switch to manual typing' : 'Write with Mica'}>
              <IconButton size="small" onClick={() => setAiMode(!aiMode)}
                sx={{ ml: 'auto', bgcolor: aiMode ? '#03C6B1' : 'divider', color: aiMode ? '#FFFFFF' : 'text.secondary', '&:hover': { bgcolor: aiMode ? '#02A995' : '#D6E2EE' } }}>
                <AiIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {/* AI Error */}
            {aiError && <Alert severity="error" onClose={() => setAiError('')}>{aiError}</Alert>}

            {/* Mica voice clarification card */}
            {aiMode && aiVoiceClarification && !aiShowResults && (
              <Paper variant="outlined" sx={{ p: 2, borderColor: METICLE_COLORS.primary, bgcolor: 'notice.subtle.bg' }}>
                <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ mb: 1 }}>
                  <MicIcon sx={{ color: METICLE_COLORS.primary, fontSize: 20 }} />
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: METICLE_COLORS.primary, fontWeight: 600 }}>Mica needs a bit more from you</Typography>
                    <Typography variant="body2" sx={{ mt: 0.25 }}>{aiVoiceClarification.prompt}</Typography>
                  </Box>
                </Stack>
                {aiVoiceClarification.type === 'choosePerson' && (
                  <Stack spacing={1}>
                    {aiVoiceClarification.candidates?.map((c: any) => (
                      <Button key={c.id} variant="outlined" fullWidth onClick={() => {
                        setAiVoiceDraftContext({ personId: c.id, personName: c.name, shift: noteForm.shift, noteDate: noteForm.note_date })
                        setAiVoiceClarification(null)
                      }} sx={{ textTransform: 'none' }}>
                        {c.name}
                        {c.room_number && <Typography variant="body2" color="text.secondary" component="span"> &nbsp;— Room {c.room_number}</Typography>}
                      </Button>
                    ))}
                  </Stack>
                )}
                {aiVoiceClarification.type === 'chooseShift' && (
                  <Stack direction="row" flexWrap="wrap" spacing={1}>
                    {aiVoiceClarification.options?.map((opt: string) => (
                      <Button key={opt} variant="outlined" onClick={() => {
                        setNoteForm(f => ({ ...f, shift: opt }))
                        setAiVoiceDraftContext((ctx: any) => ctx ? { ...ctx, shift: opt } : { shift: opt, noteDate: noteForm.note_date })
                        setAiVoiceClarification(null)
                      }} sx={{ textTransform: 'capitalize', borderColor: METICLE_COLORS.primary, color: METICLE_COLORS.primary }}>
                        {opt}
                      </Button>
                    ))}
                  </Stack>
                )}
              </Paper>
            )}

            {/* Mica voice listening card */}
            {aiMode && aiVoiceListening && !aiShowResults && (
              <Paper variant="outlined" sx={{ p: 2, borderColor: METICLE_COLORS.primary, bgcolor: 'notice.subtle.bg', textAlign: 'center' }}>
                <Stack direction="row" justifyContent="center" spacing={1} sx={{ mb: 1 }}>
                  <MicIcon sx={{ color: METICLE_COLORS.primary, fontSize: 28 }} />
                  <Box>
                    <Typography variant="h6" sx={{ color: METICLE_COLORS.primary, fontWeight: 600 }}>Mica</Typography>
                    <Typography variant="body2" color="text.secondary">Listening...</Typography>
                  </Box>
                </Stack>
                <Typography variant="body2" sx={{ color: '#3A4551', mb: 1 }}>{aiVoiceTranscript || 'Speak now.'}</Typography>
                <Stack direction="row" justifyContent="center" spacing={1}>
                  <Button size="small" variant="outlined" onClick={() => stopMicaVoiceNote()} sx={{ borderColor: METICLE_COLORS.primary, color: METICLE_COLORS.primary }}>Cancel</Button>
                  <Button size="small" variant="contained" onClick={() => { stopMicaVoiceNote(); submitMicaVoiceNote() }} disabled={!aiVoiceTranscript.trim() || voiceNoteIntentMutation.isPending} sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}>
                    {voiceNoteIntentMutation.isPending ? 'Sending...' : 'Done'}
                  </Button>
                </Stack>
              </Paper>
            )}

            {/* Manual mode form */}
            {!aiMode && (
              <>
                <Stack direction="row" spacing={1}>
                  <TextField label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={noteForm.note_date} onChange={e => setNoteForm({ ...noteForm, note_date: e.target.value })} />
                  <TextField select label="Shift" fullWidth value={noteForm.shift} onChange={e => setNoteForm({ ...noteForm, shift: e.target.value })}>
                    {NOTE_SHIFT_OPTIONS.map(opt => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
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
                    sx={{ '& .MuiOutlinedInput-root': aiRecording ? { bgcolor: 'notice.subtle.bg', borderColor: '#8B7CF6' } : {} }} />
                  <Stack spacing={0.5} sx={{ flexShrink: 0 }}>
                    <Tooltip title={aiRecording ? 'Stop dictation' : 'Dictate note with voice'}>
                      <IconButton size="small" onClick={aiRecording ? stopAiRecording : startNoteDictation}
                        sx={{ bgcolor: aiRecording ? METICLE_COLORS.danger : 'divider', color: aiRecording ? '#FFFFFF' : 'text.secondary', borderRadius: 1.5, width: 34, height: 34, '&:hover': { bgcolor: aiRecording ? '#B42318' : '#D6E2EE' } }}>
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
                    {NOTE_SHIFT_OPTIONS.map(opt => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </TextField>
                </Stack>
                <TextField select label="Level of Support" fullWidth value={noteForm.support_level} onChange={e => setNoteForm({ ...noteForm, support_level: e.target.value })}>
                  <MenuItem value="">Not specified</MenuItem>
                  {SUPPORT_LEVELS.map(sl => (
                    <MenuItem key={sl.value} value={sl.value}>{sl.label}</MenuItem>
                  ))}
                </TextField>

                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'notice.subtle.bg', borderColor: METICLE_COLORS.primary }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <MicIcon sx={{ color: METICLE_COLORS.primary }} />
                    <Typography variant="subtitle2" sx={{ color: METICLE_COLORS.primary, fontWeight: 600 }}>Mica Voice</Typography>
                    <Typography variant="caption" color="text.secondary">Speak naturally — Mica will structure it and you can review it before saving.</Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                    {!aiRecording ? (
                      <Button size="small" variant="contained" startIcon={<MicIcon />} onClick={startAiRecording}
                        sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none', '&:hover': { bgcolor: '#0251B3' } }}>Start Recording</Button>
                    ) : (
                      <Button size="small" variant="contained" color="error" startIcon={<StopIcon />} onClick={stopAiRecording}
                        sx={{ textTransform: 'none', animation: 'pulse 1.5s infinite' }}>Stop Recording</Button>
                    )}
                    {aiRecording && <Chip label="Listening..." size="small" color="error" variant="outlined" sx={{ animation: 'blink 1s infinite' }} />}
                  </Stack>
                  <TextField placeholder="Speak now, or type your observations here..." fullWidth multiline rows={3} value={aiTranscript} onChange={e => setAiTranscript(e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' } }} />
                </Paper>

                <Button variant="contained" fullWidth onClick={handleAiGenerate} disabled={!aiTranscript.trim() || aiGenerateMutation.isPending}
                  startIcon={aiGenerateMutation.isPending ? <CircularProgress size={18} color="inherit" /> : <PsychologyIcon />}
                  sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none', py: 1.5, fontWeight: 600, '&:hover': { bgcolor: '#0251B3' } }}>
                  {aiGenerateMutation.isPending ? 'Structuring...' : 'Generate Note'}
                </Button>
              </>
            )}

            {/* AI Results */}
            {aiMode && aiShowResults && aiResult && (
              <>
                <Alert severity={aiResult.risk_level === 'high' || aiResult.risk_level === 'critical' ? 'error' : aiResult.risk_level === 'medium' ? 'warning' : 'success'} icon={<CheckCircleIcon />}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {aiResult.risk_level?.toUpperCase()} Risk Level {getMoodEmoji(aiResult.mood_analysis?.mood_score)}
                    {aiVoiceDraftContext?.source === 'voice' && (
                    <Box component="span" sx={{ ml: 1, color: METICLE_COLORS.primary, display: { xs: 'inline', sm: 'inline' } }}>
                      <MicIcon sx={{ fontSize: 12, verticalAlign: 'middle', mr: 0.5 }} /> Mica-assisted, awaiting your approval.
                    </Box>
                  )}
                  {aiResult.follow_up_required && <Typography variant="caption" color="error">Follow-up required: {aiResult.follow_up_details}</Typography>}
                  </Typography>
                </Alert>

                {aiResult.safeguarding_flags?.length > 0 && (
                  <Paper variant="outlined" sx={{ p: 2, borderColor: METICLE_COLORS.danger, bgcolor: 'notice.error.bg' }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <FlagIcon sx={{ color: 'notice.error.fg', fontSize: 20 }} />
                      <Typography variant="subtitle2" sx={{ color: 'notice.error.fg', fontWeight: 600 }}>Safeguarding Alerts ({aiResult.safeguarding_flags.length})</Typography>
                    </Stack>
                    {aiResult.safeguarding_flags.map((flag: any, i: number) => (
                      <Box key={i} sx={{ mb: 0.5 }}>
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.25 }}>
                          <Chip label={flag.severity} size="small" color={flag.severity === 'high' ? 'error' : 'warning'} sx={{ height: 18, fontSize: 10 }} />
                          <Typography variant="caption" sx={{ fontWeight: 600, color: 'notice.error.fg' }}>{flag.concern_type}</Typography>
                        </Stack>
                        <Typography variant="caption" display="block" color='notice.error.fg'>{flag.description}</Typography>
                        {flag.action_required && <Typography variant="caption" display="block" color='notice.error.fg'>Action: {flag.action_required}</Typography>}
                      </Box>
                    ))}
                  </Paper>
                )}

                <TextField label="Generated Daily Note" fullWidth multiline rows={4} value={aiEditedContent} onChange={e => setAiEditedContent(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'notice.success.bg' } }} />

                {aiResult.care_plan_updates?.length > 0 && (
                  <Paper variant="outlined" sx={{ p: 2, borderColor: METICLE_COLORS.primary }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <LightbulbIcon sx={{ color: METICLE_COLORS.primary, fontSize: 20 }} />
                      <Typography variant="subtitle2" sx={{ color: METICLE_COLORS.primary, fontWeight: 600 }}>Care Plan Suggestions</Typography>
                    </Stack>
                    {aiResult.care_plan_updates.map((u: any, i: number) => (
                      <Box key={i} sx={{ mb: 0.5 }}>
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.25 }}>
                          <Chip label={u.priority || 'medium'} size="small" color={u.priority === 'high' ? 'error' : u.priority === 'medium' ? 'warning' : 'info'} sx={{ height: 18, fontSize: 10 }} />
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>{u.goal_area || 'Care Plan'}</Typography>
                        </Stack>
                        <Typography variant="caption" display="block" color="#3A4551">{u.suggested_update}</Typography>
                        {u.evidence && <Typography variant="caption" display="block" color="text.secondary" fontStyle="italic">Evidence: {u.evidence}</Typography>}
                      </Box>
                    ))}
                  </Paper>
                )}

                {aiResult.interventions_suggested?.length > 0 && (
                  <Paper variant="outlined" sx={{ p: 2, borderColor: METICLE_COLORS.successText }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <TrendIcon sx={{ color: METICLE_COLORS.successText, fontSize: 20 }} />
                      <Typography variant="subtitle2" sx={{ color: METICLE_COLORS.successText, fontWeight: 600 }}>Suggested Interventions</Typography>
                    </Stack>
                    {aiResult.interventions_suggested.map((s: any, i: number) => (
                      <Box key={i} sx={{ mb: 0.5 }}>
                        <Typography variant="caption" display="block" color="#3A4551" sx={{ fontWeight: 600 }}>• {s.intervention || s}</Typography>
                        {s.reason && <Typography variant="caption" display="block" color="text.secondary">Reason: {s.reason}</Typography>}
                        {s.expected_outcome && <Typography variant="caption" display="block" color="#087A55">Expected: {s.expected_outcome}</Typography>}
                      </Box>
                    ))}
                  </Paper>
                )}

                <Button variant="outlined" fullWidth onClick={() => { setAiShowResults(false); setAiResult(null); setAiEditedContent('') }} sx={{ textTransform: 'none', borderColor: METICLE_COLORS.primary, color: METICLE_COLORS.primary }}>Back</Button>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => { setAddNoteOpen(false); setEditNoteId(null); resetAiMode() }}>Cancel</Button>          {aiMode && aiShowResults && (
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={() => { stopMicaVoiceNote(); resetAiMode(); setAiVoiceDraftContext({ personId: id, shift: noteForm.shift, noteDate: noteForm.note_date }); setAiVoiceTranscript(''); startMicaVoiceNote(); }} sx={{ textTransform: 'none', borderColor: METICLE_COLORS.primary, color: METICLE_COLORS.primary }}>
                Record again
              </Button>
              <Button variant="outlined" onClick={() => { setAddNoteOpen(false); setViewNote(null); setAiShowResults(true); setAiEditedContent(aiResult.daily_note?.content || ''); }} sx={{ textTransform: 'none' }}>
                Edit
              </Button>
              <Button variant="contained" onClick={handleMicaVoiceApprove} disabled={aiVoiceApproveMutation.isPending} sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none', fontWeight: 600, '&:hover': { bgcolor: '#0251B3' } }}>
                {(aiVoiceApproveMutation.isPending) ? 'Saving...' : 'Save care note'}
                {aiVoiceApproveMutation.isPending ? <CircularProgress size={18} color="inherit" /> : null}
              </Button>
            </Stack>
          )}
          {!aiMode && (
            <Button type="submit" variant="contained" disabled={addNoteMutation.isPending || updateNoteMutation.isPending} sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}>
              {(addNoteMutation.isPending || updateNoteMutation.isPending) ? <CircularProgress size={20} /> : (editNoteId ? 'Save' : 'Add Note')}
            </Button>
          )}
        </DialogActions>
        </Box>
      </Dialog>
      <Dialog open={!!viewNote} onClose={() => { setViewNote(null); setAiError('') }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Daily Note</DialogTitle>
        <DialogContent>
          {aiError && <Alert severity="error" onClose={() => setAiError('')} sx={{ mb: 2 }}>{aiError}</Alert>}
          {viewNote && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Chip label={NOTE_SHIFT_OPTIONS.find(o => o.value === viewNote.shift)?.label || viewNote.shift?.replace('_', ' ') || 'Day'} size="small" color={viewNote.shift === 'night' ? 'default' : 'primary'} sx={{ textTransform: 'capitalize' }} />
                <Chip label={viewNote.category?.replace(/_/g, ' ')} size="small" variant="outlined" sx={{ textTransform: 'capitalize' }} />
                {viewNote.support_level && SUPPORT_LEVEL_LABELS[viewNote.support_level] && (
                  <Chip label={SUPPORT_LEVEL_LABELS[viewNote.support_level]} size="small" color={SUPPORT_LEVEL_COLORS[viewNote.support_level] || 'default'} />
                )}
                {viewNote.generated_by_ai && (
                  <Chip icon={<AiIcon sx={{ fontSize: 14 }} />} label="AI Generated" size="small"
                    sx={{ bgcolor: 'notice.subtle.bg', color: '#8B7CF6', fontWeight: 600, '& .MuiChip-icon': { color: '#8B7CF6' } }} />
                )}
                <Typography variant="caption" color="text.secondary">{new Date(viewNote.note_date).toLocaleDateString('en-GB')}</Typography>
                <Typography variant="caption" color="text.muted">{viewNote.author_name ? `by ${viewNote.author_name}` : ''}</Typography>
              </Stack>
              <Divider />
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{viewNote.content}</Typography>

              {/* Saved AI Analysis */}
              {viewNote.ai_risk_level && (
                <>
                  <Divider />
                  <Paper variant="outlined" sx={{ p: 2, borderColor: '#8B7CF6', bgcolor: 'notice.subtle.bg' }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                      <AiIcon sx={{ color: '#8B7CF6', fontSize: 20 }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#8B7CF6' }}>AI Analysis</Typography>
                      <Chip label={`${viewNote.ai_risk_level} risk`} size="small" color={viewNote.ai_risk_level === 'high' || viewNote.ai_risk_level === 'critical' ? 'error' : viewNote.ai_risk_level === 'medium' ? 'warning' : 'success'} sx={{ height: 20, fontSize: 10 }} />
                      {viewNote.ai_follow_up_required && <Chip label="Follow-up needed" size="small" color="warning" sx={{ height: 20, fontSize: 10 }} />}
                    </Stack>

                    {viewNote.ai_follow_up_details && (
                      <Alert severity="warning" sx={{ mb: 1.5, py: 0 }}>
                        <Typography variant="caption" fontWeight={600}>Follow-up:</Typography> {viewNote.ai_follow_up_details}
                      </Alert>
                    )}

                    {viewNote.ai_mood_analysis && (
                      <Box sx={{ mb: 1.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary' }}>Mood: {getMoodEmoji(viewNote.ai_mood_analysis.mood_score)} {viewNote.ai_mood_analysis.mood_label} ({viewNote.ai_mood_analysis.mood_score}/10)</Typography>
                        {viewNote.ai_mood_analysis.indicators?.length > 0 && (
                          <Typography variant="caption" display="block" color="text.secondary">{viewNote.ai_mood_analysis.indicators.join(', ')}</Typography>
                        )}
                      </Box>
                    )}

                    {Array.isArray(viewNote.ai_safeguarding_flags) && viewNote.ai_safeguarding_flags.length > 0 && (
                      <Box sx={{ mb: 1.5 }}>
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
                          <FlagIcon sx={{ fontSize: 14, color: METICLE_COLORS.danger }} />
                          <Typography variant="caption" sx={{ fontWeight: 600, color: METICLE_COLORS.danger }}>Safeguarding ({viewNote.ai_safeguarding_flags.length})</Typography>
                        </Stack>
                        {viewNote.ai_safeguarding_flags.map((f: any, i: number) => (
                          <Paper key={i} variant="outlined" sx={{ p: 1, mb: 0.5, borderColor: '#FCA5A5', bgcolor: 'notice.error.bg' }}>
                            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.25 }}>
                              <Chip label={f.severity} size="small" color={f.severity === 'high' ? 'error' : 'warning'} sx={{ height: 16, fontSize: 9 }} />
                              <Typography variant="caption" fontWeight={600}>{f.concern_type}</Typography>
                            </Stack>
                            <Typography variant="caption" display="block" color='notice.error.fg'>{f.description}</Typography>
                            {f.action_required && <Typography variant="caption" display="block" color='notice.error.fg' fontStyle="italic">Action: {f.action_required}</Typography>}
                          </Paper>
                        ))}
                      </Box>
                    )}

                    {Array.isArray(viewNote.ai_care_plan_updates) && viewNote.ai_care_plan_updates.length > 0 && (
                      <Box sx={{ mb: 1.5 }}>
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
                          <LightbulbIcon sx={{ fontSize: 14, color: METICLE_COLORS.primary }} />
                          <Typography variant="caption" sx={{ fontWeight: 600, color: METICLE_COLORS.primary }}>Care Plan Suggestions</Typography>
                        </Stack>
                        {viewNote.ai_care_plan_updates.map((u: any, i: number) => (
                          <Paper key={i} variant="outlined" sx={{ p: 1, mb: 0.5, borderColor: '#6B8AFD' }}>
                            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.25 }}>
                              <Chip label={u.priority || 'medium'} size="small" color={u.priority === 'high' ? 'error' : u.priority === 'medium' ? 'warning' : 'info'} sx={{ height: 16, fontSize: 9 }} />
                              <Typography variant="caption" fontWeight={600}>{u.goal_area}</Typography>
                            </Stack>
                            <Typography variant="caption" display="block" color="#3A4551">{u.suggested_update}</Typography>
                            {u.evidence && <Typography variant="caption" display="block" color="text.secondary" fontStyle="italic">Evidence: {u.evidence}</Typography>}
                          </Paper>
                        ))}
                      </Box>
                    )}

                    {Array.isArray(viewNote.ai_interventions) && viewNote.ai_interventions.length > 0 && (
                      <Box>
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
                          <TrendIcon sx={{ fontSize: 14, color: METICLE_COLORS.successText }} />
                          <Typography variant="caption" sx={{ fontWeight: 600, color: METICLE_COLORS.successText }}>Suggested Interventions</Typography>
                        </Stack>
                        {viewNote.ai_interventions.map((s: any, i: number) => (
                          <Paper key={i} variant="outlined" sx={{ p: 1, mb: 0.5, borderColor: METICLE_COLORS.success }}>
                            <Typography variant="caption" display="block" fontWeight={600} color="#3A4551">• {s.intervention}</Typography>
                            {s.reason && <Typography variant="caption" display="block" color="text.secondary">Reason: {s.reason}</Typography>}
                            {s.expected_outcome && <Typography variant="caption" display="block" color="#087A55">Expected: {s.expected_outcome}</Typography>}
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
              sx={{ textTransform: 'none', color: '#8B7CF6', borderColor: '#8B7CF6', '&:hover': { borderColor: '#8B7CF6', bgcolor: 'notice.subtle.bg' } }}
              variant="outlined">
              {aiAnalyzeNoteMutation.isPending ? 'Analyzing...' : 'Analyze with AI'}
            </Button>
          )}
          <Button onClick={() => setViewNote(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Add / Edit Risk Assessment Dialog */}
      <Dialog open={addRiskOpen} onClose={() => { setAddRiskOpen(false); setEditRiskId(null); setError('') }} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => {
          e.preventDefault()
          setError('')
          if (editRiskId) {
            updateRiskMutation.mutate({ riskId: editRiskId, data: riskForm })
          } else {
            addRiskMutation.mutate(riskForm)
          }
        }}>
          <FigDialogHeader eyebrow={eyebrowFor(user, 'CARE')} title={editRiskId ? 'Edit risk assessment' : 'New risk assessment'} subtitle="Enter risk assessment details where you can." onClose={() => { setAddRiskOpen(false); setEditRiskId(null); setError('') }} />
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField select label="Type" fullWidth required value={riskForm.type} onChange={e => setRiskForm({ ...riskForm, type: e.target.value })}>
                {RISK_TYPES.map(t => <MenuItem key={t} value={t} sx={{ textTransform: 'capitalize' }}>{t.replace(/_/g, ' ')}</MenuItem>)}
              </TextField>
              <Box>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Risk level</Typography>
                <PillOptions options={Object.keys(RISK_COLORS).map(k => ({ value: k, label: k.charAt(0).toUpperCase() + k.slice(1) }))} value={riskForm.risk_level} onChange={v => setRiskForm({ ...riskForm, risk_level: v })} />
              </Box>
              <TextField label="What could happen" fullWidth multiline rows={3} value={riskForm.details} onChange={e => setRiskForm({ ...riskForm, details: e.target.value })} placeholder="Falls when getting out of bed at night..." />
              <TextField label="What we do to reduce it" fullWidth multiline rows={3} value={riskForm.mitigation_actions} onChange={e => setRiskForm({ ...riskForm, mitigation_actions: e.target.value })} placeholder="Sensor mat by the bed, night light on..." />
              <TextField label="Review Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={riskForm.review_date} onChange={e => setRiskForm({ ...riskForm, review_date: e.target.value })} />
              <Box>
                <input type="file" ref={riskFileInputRef} hidden accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={async e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setRiskFileUploading(true)
                  try {
                    const fd = new FormData()
                    fd.append('file', file)
                    const res = await api.post('/settings/upload', fd)
                    setRiskForm(f => ({ ...f, file_url: res.data.url, file_name: res.data.originalName || file.name }))
                  } catch { setError('Failed to upload file') }
                  finally { setRiskFileUploading(false); e.target.value = '' }
                }} />
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button variant="outlined" size="small" onClick={() => riskFileInputRef.current?.click()}
                    disabled={riskFileUploading} startIcon={riskFileUploading ? <CircularProgress size={16} /> : <UploadIcon />}
                    sx={{ textTransform: 'none' }}>
                    {riskForm.file_url ? 'Change File' : 'Attach File'}
                  </Button>
                  {riskForm.file_url && (
                    <Chip label={riskForm.file_name || 'File attached'} size="small" onDelete={() => setRiskForm(f => ({ ...f, file_url: '', file_name: '' }))}
                      icon={<FileIcon />} variant="outlined" sx={{ maxWidth: 240 }} />
                  )}
                </Stack>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => { setAddRiskOpen(false); setEditRiskId(null); setError('') }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addRiskMutation.isPending || updateRiskMutation.isPending || riskFileUploading}
              sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}>
              {(addRiskMutation.isPending || updateRiskMutation.isPending) ? <CircularProgress size={20} /> : (editRiskId ? 'Save changes' : 'Save risk assessment')}
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
          <FigDialogHeader eyebrow={eyebrowFor(user, 'PEOPLE')} title={contactEditId ? 'Edit contact' : 'Add a contact'} subtitle={`Family, friends and professionals who take part in ${user.first_name}'s life.`} onClose={() => { setAddContactOpen(false); setContactEditId(null) }} />
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Name" fullWidth required value={contactForm.name} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} placeholder="Helen Price" />
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
            <Button type="submit" variant="contained" disabled={addContactMutation.isPending || updateContactMutation.isPending}
              sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}>
              {(addContactMutation.isPending || updateContactMutation.isPending) ? <CircularProgress size={20} /> : (contactEditId ? 'Save changes' : 'Save contact')}
            </Button>
            <Button onClick={() => { setAddContactOpen(false); setContactEditId(null) }} sx={{ textTransform: 'none' }}>Cancel</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Invite to Portal Dialog */}
      <Dialog open={invitePortalOpen} onClose={() => { setInvitePortalOpen(false); setInvitePortalError('') }} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => {
          e.preventDefault()
          inviteFromContactMutation.mutate({ ...invitePortalForm, person_id: id })
        }}>
          <FigDialogHeader eyebrow={eyebrowFor(user, 'PEOPLE')} title="Invite to the family portal" subtitle={`${invitePortalForm.name?.split(' ')[0] || 'They'} can use the website and app to share. ${user.first_name} has agreed to this.`} onClose={() => { setInvitePortalOpen(false); setInvitePortalError('') }} />
          <DialogContent>
            {invitePortalError && <Alert severity="error" sx={{ mb: 2 }}>{invitePortalError}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">They'll receive an email with a secure link to set up their portal.</Typography>
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
              sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}>
              {inviteFromContactMutation.isPending ? <CircularProgress size={20} /> : 'Send Invite'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* View Risk Assessment Dialog */}
      <Dialog open={!!viewRisk} onClose={() => setViewRisk(null)} maxWidth="sm" fullWidth>
        <FigDialogHeader eyebrow={`RISK ASSESSMENT - ${`${user.first_name} ${user.last_name}`.toUpperCase()}`} title={viewRisk?.type?.replace(/_/g, ' ') || 'Risk assessment'} subtitle={viewRisk?.review_date ? `Review date ${new Date(viewRisk.review_date).toLocaleDateString('en-GB')}` : 'No review date set'} onClose={() => setViewRisk(null)} />
        <DialogContent>
          {viewRisk && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Type</Typography>
                <Typography sx={{ textTransform: 'capitalize', fontWeight: 600 }}>{viewRisk.type?.replace(/_/g, ' ')}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Risk Level</Typography>
                <Chip icon={<WarningIcon sx={{ fontSize: 14 }} />} label={viewRisk.risk_level} size="small"
                  sx={{ bgcolor: `${RISK_COLORS[viewRisk.risk_level] || '#51637A'}18`, color: RISK_COLORS[viewRisk.risk_level] || '#51637A', fontWeight: 600, textTransform: 'capitalize', mt: 0.5 }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Details</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>{viewRisk.details || '—'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Mitigation Actions</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>{viewRisk.mitigation_actions || '—'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Review Date</Typography>
                <Typography>{viewRisk.review_date ? new Date(viewRisk.review_date).toLocaleDateString('en-GB') : '—'}</Typography>
              </Box>
              {viewRisk.file_url && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Attached File</Typography>
                  <Paper variant="outlined" sx={{ borderRadius: 2, p: 1.5, mt: 0.5 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <FileIcon color="action" />
                      <Typography noWrap sx={{ flex: 1 }}>{viewRisk.file_name || viewRisk.file_url.split('/').pop()}</Typography>
                      <Button variant="outlined" size="small" startIcon={<OpenInNewIcon />} onClick={() => { viewFileInNewTab(viewRisk.file_url); setViewRisk(null) }}
                        sx={{ textTransform: 'none' }}>View</Button>
                    </Stack>
                  </Paper>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button startIcon={<EditIcon />} variant="contained" sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}
            onClick={() => { const r = viewRisk; setViewRisk(null); setTimeout(() => { setRiskForm({ type: r.type, risk_level: r.risk_level, details: r.details || '', mitigation_actions: r.mitigation_actions || '', review_date: r.review_date ? r.review_date.slice(0, 10) : '', file_url: r.file_url || '', file_name: r.file_name || '' }); setEditRiskId(r.id); setAddRiskOpen(true) }, 100) }}>
            Edit
          </Button>
          <Button variant="contained" sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }} onClick={() => { if (viewRisk) updateRiskMutation.mutate({ riskId: viewRisk.id, data: { review_date: localDate() } }); setViewRisk(null) }}>Mark as reviewed</Button>
          <Button onClick={() => setViewRisk(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, color: 'error.main' }}>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this {deleteConfirm?.type}? This action cannot be undone.</Typography>
          {deleteConfirm?.type === 'plan' && error && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError('')}>{error}</Alert>}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => { setDeleteConfirm(null); setError('') }} disabled={deletePlanMutation.isPending || deleteRiskMutation.isPending}>Cancel</Button>
          <Button variant="contained" color="error" disabled={deletePlanMutation.isPending || deleteRiskMutation.isPending} startIcon={(deletePlanMutation.isPending || deleteRiskMutation.isPending) ? <CircularProgress size={16} color="inherit" /> : undefined} onClick={() => {
            if (!deleteConfirm) return
            const { type, id: delId } = deleteConfirm
            if (type === 'plan') deletePlanMutation.mutate(delId)
            else if (type === 'risk') deleteRiskMutation.mutate(delId)
            else setDeleteConfirm(null)
          }}>{(deletePlanMutation.isPending || deleteRiskMutation.isPending) ? 'Deleting…' : 'Delete'}</Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  )
}

const ASSESSMENT_TYPES = ['Initial', 'Annual Review', 'MCA', 'DoLS', 'Best Interest', 'Capacity', 'Other']
const ASSESSMENT_STATUS_COLORS: Record<string, string> = { draft: METICLE_COLORS.warning, completed: METICLE_COLORS.success, reviewed: METICLE_COLORS.primary }

function CareAssessmentsTabInline({ personId }: { personId: string }) {
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()
  const eyebrow = usePersonEyebrow(personId, 'CARE')
  const [open, setOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [editAssessment, setEditAssessment] = useState<any>(null)
  const [deleteAssessmentId, setDeleteAssessmentId] = useState<string | null>(null)
  const [form, setForm] = useState({ assessment_type: '', assessment_date: localDate(), assessor_name: '', findings: '', recommendations: '', status: 'draft', next_review_date: '', file_url: '', file_name: '' })
  const [error, setError] = useState('')
  const assessmentFileInputRef = useRef<HTMLInputElement>(null)
  const [assessmentFileUploading, setAssessmentFileUploading] = useState(false)
  const { data: assessments, isLoading, isError } = useQuery({
    queryKey: ['assessments', personId],
    queryFn: () => api.get(`/people/${personId}/assessments`).then(r => r.data),
  })
  const resetForm = () => setForm({ assessment_type: '', assessment_date: localDate(), assessor_name: '', findings: '', recommendations: '', status: 'draft', next_review_date: '', file_url: '', file_name: '' })
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form }
      if (editAssessment) return api.patch(`/people/assessments/${editAssessment.id}`, payload)
      return api.post(`/people/${personId}/assessments`, payload)
    },
    onSuccess: () => {
      const started = !editAssessment
      const label = form.assessment_type || 'Assessment'
      queryClient.invalidateQueries({ queryKey: ['assessments', personId] })
      queryClient.invalidateQueries({ queryKey: ['timeline', personId] })
      setOpen(false)
      setEditAssessment(null)
      resetForm()
      setError('')
      showSnackbar(started ? `${label} assessment is in progress. It's saved.` : `${label} assessment is updated.`, 'success', started ? 'Assessment started' : 'Assessment updated')
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
      file_url: a.file_url || '',
      file_name: a.file_name || '',
    })
    setOpen(true)
  }
  if (isLoading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
  const downloadAssessment = () => {
    if (!selected) return
    const lines = [
      `${selected.assessment_type || 'Assessment'}`,
      `Date: ${selected.assessment_date ? new Date(selected.assessment_date).toLocaleDateString('en-GB') : '—'}`,
      `Assessor: ${selected.assessor_name || '—'}`,
      `Status: ${selected.status || '—'}`,
      `Next review: ${selected.next_review_date ? new Date(selected.next_review_date).toLocaleDateString('en-GB') : '—'}`,
      '',
      'Findings:',
      selected.findings || '—',
      '',
      'Recommendations:',
      selected.recommendations || '—',
    ]
    const fname = `${(selected.assessment_type || 'assessment').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
    showSnackbar(`${fname} is downloaded.`, 'success', 'Download started')
  }
  if (isError) return <Alert severity="error">Failed to load assessments</Alert>
  return (
    <Box>
      <SectionHeader title="Care assessments"
        subtitle={assessments?.length > 0 ? `${assessments.length} assessment${assessments.length === 1 ? '' : 's'} · ${assessments.filter((a: any) => a.next_review_date && new Date(a.next_review_date).getFullYear() === new Date().getFullYear() && new Date(a.next_review_date).getMonth() === new Date().getMonth()).length} due this month` : undefined}
        action={<Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => { setEditAssessment(null); resetForm(); setOpen(true) }}
        sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}>Start assessment</Button>} />
      {(!assessments || assessments.length === 0) ? (
        <EmptyRow message="No assessments yet" />
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Assessment</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Completed</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Next due</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Attachment</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {assessments.map((a: any) => (
                <TableRow key={a.id} hover sx={{ cursor: 'pointer' }} onClick={() => { setSelected(a); setViewOpen(true) }}>
                  <TableCell sx={{ fontWeight: 600 }}>{a.assessment_type?.replace(/_/g, ' ')}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{a.assessment_date ? new Date(a.assessment_date).toLocaleDateString('en-GB') : '—'}</Typography>
                    {a.assessor_name && <Typography variant="caption" color="text.secondary">{a.assessor_name}</Typography>}
                  </TableCell>
                  <TableCell><Chip label={a.status} size="small" sx={{ bgcolor: `${ASSESSMENT_STATUS_COLORS[a.status] || '#51637A'}20`, color: ASSESSMENT_STATUS_COLORS[a.status] || '#51637A', fontWeight: 600, textTransform: 'capitalize' }} /></TableCell>
                  <TableCell>{a.next_review_date ? new Date(a.next_review_date).toLocaleDateString('en-GB') : '—'}</TableCell>
                  <TableCell>
                    {a.file_url ? (
                      <Stack direction="row" spacing={0.5} alignItems="center" onClick={e => e.stopPropagation()}>
                        <IconButton size="small" title={a.file_name || 'Open file'} onClick={() => openFileInNewTab(a.file_url)}><FileIcon fontSize="small" /></IconButton>
                        <Typography variant="caption" sx={{ maxWidth: 120 }} noWrap>{a.file_name || a.file_url.split('/').pop()}</Typography>
                      </Stack>
                    ) : '—'}
                  </TableCell>
                  <TableCell align="right" onClick={e => e.stopPropagation()}>
                    <IconButton size="small" onClick={() => openEdit(a)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => setDeleteAssessmentId(a.id)}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* View Dialog */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="md" fullWidth>
        <FigDialogHeader eyebrow={`ASSESSMENT - ${eyebrow.split(' / ')[0]}`} title={selected?.assessment_type || 'Assessment'} subtitle={selected?.assessment_date ? `Completed ${new Date(selected.assessment_date).toLocaleDateString('en-GB')}${selected.assessor_name ? ` by ${selected.assessor_name}` : ''}` : undefined} onClose={() => setViewOpen(false)} />
        <DialogContent>
          {selected && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={4}>
                <Box><Typography variant="caption" color="text.secondary">Date</Typography><Typography fontWeight={600}>{new Date(selected.assessment_date).toLocaleDateString('en-GB')}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Assessor</Typography><Typography fontWeight={600}>{selected.assessor_name || '—'}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Status</Typography><Chip label={selected.status} size="small" sx={{ bgcolor: `${ASSESSMENT_STATUS_COLORS[selected.status] || '#51637A'}20`, color: ASSESSMENT_STATUS_COLORS[selected.status] || '#51637A', fontWeight: 600 }} /></Box>
                <Box><Typography variant="caption" color="text.secondary">Next Review</Typography><Typography fontWeight={600}>{selected.next_review_date ? new Date(selected.next_review_date).toLocaleDateString('en-GB') : '—'}</Typography></Box>
              </Stack>
              <Box><Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>Findings</Typography><Paper variant="outlined" sx={{ p: 2, bgcolor: 'notice.subtle.bg', whiteSpace: 'pre-wrap' }}>{selected.findings || 'No findings recorded'}</Paper></Box>
              <Box><Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>Recommendations</Typography><Paper variant="outlined" sx={{ p: 2, bgcolor: 'notice.subtle.bg', whiteSpace: 'pre-wrap' }}>{selected.recommendations || 'No recommendations recorded'}</Paper></Box>
              {selected.file_url && (
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>Attachment</Typography>
                  <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'notice.subtle.bg', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FileIcon sx={{ color: METICLE_COLORS.primary }} />
                    <Typography noWrap sx={{ flex: 1 }}>{selected.file_name || selected.file_url.split('/').pop()}</Typography>
                    <Button size="small" variant="outlined" startIcon={<OpenInNewIcon />} onClick={() => openFileInNewTab(selected.file_url)} sx={{ textTransform: 'none' }}>Open</Button>
                  </Paper>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button startIcon={<EditIcon />} variant="contained" sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}
            onClick={() => { const a = selected; setViewOpen(false); setTimeout(() => openEdit(a), 100) }}>
            Edit
          </Button>
          <Button variant="contained" sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }} onClick={downloadAssessment}>Download PDF</Button>
          <Button onClick={() => setViewOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={open} onClose={() => { setOpen(false); setError('') }} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); saveMutation.mutate() }}>
          <FigDialogHeader eyebrow={eyebrow} title={editAssessment ? 'Edit assessment' : 'Start an assessment'} subtitle="Choose the assessment you can start and click start to begin." onClose={() => { setOpen(false); setError('') }} />
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
              <Box>
                <input type="file" ref={assessmentFileInputRef} hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt,.csv" onChange={async e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setAssessmentFileUploading(true)
                  try {
                    const fd = new FormData()
                    fd.append('file', file)
                    const res = await api.post('/settings/upload', fd)
                    setForm(p => ({ ...p, file_url: res.data.url, file_name: res.data.originalName || file.name }))
                  } catch { setError('Failed to upload file') }
                  finally { setAssessmentFileUploading(false); e.target.value = '' }
                }} />
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button variant="outlined" size="small" onClick={() => assessmentFileInputRef.current?.click()}
                    disabled={assessmentFileUploading} startIcon={assessmentFileUploading ? <CircularProgress size={16} /> : <UploadIcon />}
                    sx={{ textTransform: 'none' }}>
                    {form.file_url ? 'Change File' : 'Attach File'}
                  </Button>
                  {form.file_url && (
                    <Chip label={form.file_name || form.file_url.split('/').pop() || 'File attached'} size="small"
                      onDelete={() => setForm(p => ({ ...p, file_url: '', file_name: '' }))}
                      icon={<FileIcon />} variant="outlined" sx={{ maxWidth: 240 }} />
                  )}
                </Stack>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => { setOpen(false); setError('') }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={!form.assessment_type.trim() || saveMutation.isPending} sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}>
              {saveMutation.isPending ? <CircularProgress size={20} /> : editAssessment ? 'Save changes' : 'Start assessment'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteAssessmentId} onClose={() => setDeleteAssessmentId(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, color: 'error.main' }}>Delete Assessment</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this assessment? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDeleteAssessmentId(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => {
            if (deleteAssessmentId) deleteMutation.mutate(deleteAssessmentId)
            setDeleteAssessmentId(null)
          }}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

const TIMELINE_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  note: { label: 'Note', color: 'notice.info.fg', bg: 'notice.info.bg' },
  medication: { label: 'Medication', color: '#8B7CF6', bg: '#EAF3FF' },
  care_plan: { label: 'Care plan', color: 'notice.success.fg', bg: 'notice.success.bg' },
  safety: { label: 'Safety', color: 'notice.warning.fg', bg: 'notice.warning.bg' },
}

const timelineBadgeFor = (t: string) => {
  if (['daily_note', 'communication', 'memory_book', 'wellbeing'].includes(t)) return TIMELINE_BADGES.note
  if (['health_observation', 'bowel_movement', 'dental', 'fluid_intake', 'meal', 'clinical_score'].includes(t)) return TIMELINE_BADGES.medication
  if (['risk_assessment', 'body_map', 'incident', 'capacity'].includes(t)) return TIMELINE_BADGES.safety
  return TIMELINE_BADGES.care_plan
}

function TimelineTab({ personId }: { personId: string }) {
  const [typeFilter, setTypeFilter] = useState('all')
  const [rangeFilter, setRangeFilter] = useState('all')
  const { data: timeline = [], isLoading } = useQuery({
    queryKey: ['timeline', personId],
    queryFn: () => api.get(`/people/${personId}/timeline`).then(r => r.data),
  })
  if (isLoading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>

  const EVENT_ICONS: Record<string, any> = {
    admission: <HomeIcon sx={{ color: METICLE_COLORS.primary }} />,
    care_plan: <AssignmentIcon sx={{ color: METICLE_COLORS.success }} />,
    assessment: <PersonIcon sx={{ color: '#046E86' }} />,
    care_pathway: <AssignmentIcon sx={{ color: METICLE_COLORS.success }} />,
    goal: <FlagIcon sx={{ color: METICLE_COLORS.success }} />,
    daily_note: <NoteIcon sx={{ color: METICLE_COLORS.warning }} />,
    communication: <ChatIcon sx={{ color: METICLE_COLORS.primary }} />,
    memory_book: <NoteIcon sx={{ color: METICLE_COLORS.warning }} />,
    wellbeing: <HealthIcon sx={{ color: '#8B7CF6' }} />,
    health_observation: <HealthIcon sx={{ color: '#8B7CF6' }} />,
    bowel_movement: <HealthIcon sx={{ color: '#8B7CF6' }} />,
    dental: <HealthIcon sx={{ color: '#8B7CF6' }} />,
    fluid_intake: <HealthIcon sx={{ color: '#8B7CF6' }} />,
    meal: <HealthIcon sx={{ color: '#8B7CF6' }} />,
    clinical_score: <HealthIcon sx={{ color: '#8B7CF6' }} />,
    risk_assessment: <WarningIcon sx={{ color: METICLE_COLORS.danger }} />,
    body_map: <HealthIcon sx={{ color: METICLE_COLORS.danger }} />,
    incident: <WarningIcon sx={{ color: METICLE_COLORS.danger }} />,
    capacity: <ShieldIcon sx={{ color: METICLE_COLORS.primary }} />,
    time_away: <LuggageIcon sx={{ color: METICLE_COLORS.warning }} />,
    discharge_checklist: <LuggageIcon sx={{ color: '#046E86' }} />,
  }

  const eventTypes: string[] = Array.from(new Set(timeline.map((e: any) => e.event_type).filter(Boolean)))
  const rangeDays = rangeFilter === 'all' ? null : Number(rangeFilter)
  const cutoff = rangeDays != null ? Date.now() - rangeDays * 24 * 60 * 60 * 1000 : null
  const visible = timeline.filter((event: any) =>
    (typeFilter === 'all' || event.event_type === typeFilter) &&
    (cutoff == null || (event.created_at && new Date(event.created_at).getTime() >= cutoff)),
  )

  return (
    <Box>
      <SectionHeader title="Timeline" subtitle="Everything recorded, newest first" />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
        <TextField select size="small" label="Type" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} sx={{ minWidth: 200 }}>
          <MenuItem value="all">Everything</MenuItem>
          {eventTypes.map(t => <MenuItem key={t} value={t} sx={{ textTransform: 'capitalize' }}>{t.replace(/_/g, ' ')}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Period" value={rangeFilter} onChange={e => setRangeFilter(e.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="all">Everything</MenuItem>
          <MenuItem value="7">Last 7 days</MenuItem>
          <MenuItem value="30">Last 30 days</MenuItem>
        </TextField>
      </Stack>
      {visible.length === 0 ? (
        <EmptyRow message={timeline.length === 0 ? 'No timeline events yet' : 'No events match these filters'} />
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Time</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Title</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((event: any, i: number) => {
                const badge = timelineBadgeFor(event.event_type)
                const sub = [event.description, event.performed_by ? `by ${event.performed_by}` : ''].filter(Boolean).join(' · ')
                return (
                  <TableRow key={event.id || i} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2" fontWeight={600}>
                        {event.created_at ? new Date(event.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </Typography>
                      <Typography variant="caption" color="text.muted">
                        {event.created_at ? new Date(event.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: 'notice.subtle.bg', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {EVENT_ICONS[event.event_type] || <EventIcon />}
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>{event.event_label || event.event_type?.replace(/_/g, ' ')}</Typography>
                          {sub && <Typography variant="caption" color="text.muted" noWrap sx={{ display: 'block', maxWidth: 420 }}>{sub}</Typography>}
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell><Chip size="small" label={badge.label} sx={{ bgcolor: badge.bg, color: badge.color, fontWeight: 600 }} /></TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}

/**
 * The room checks recorded for one resident's room.
 *
 * `locationId` is the resident's own location and travels with each check. Without
 * it the row has no placement at all, and the overdue sweep — which compares the
 * rooms people sleep in against the checks recorded for today — cannot tell a check
 * recorded from this profile apart from no check at all.
 */
function RoomChecksTab({ roomNumber, locationId }: { roomNumber: string | null; locationId: string | null }) {
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()
  const [addOpen, setAddOpen] = useState(false)
  const [rcEditId, setRcEditId] = useState<string | null>(null)
  const [rcView, setRcView] = useState<any>(null)
  const [rcDeleteTarget, setRcDeleteTarget] = useState<string | null>(null)
  const [rcPhotoBlob, setRcPhotoBlob] = useState<string | null>(null)
  const [rcForm, setRcForm] = useState({ status: 'pass', cleanliness_rating: 5, safety_rating: 5, notes: '', check_date: localDate() })
  const [rcError, setRcError] = useState('')

  const { data: checks = [], isLoading, isError } = useQuery({
    queryKey: ['room-checks', roomNumber],
    queryFn: () => api.get('/room-checks', { params: { room_number: roomNumber || undefined } }).then(r => r.data),
    enabled: !!roomNumber,
  })

  const addCheckMutation = useMutation({
    mutationFn: (data: any) => api.post('/room-checks', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['room-checks', roomNumber] }); setAddOpen(false); setRcEditId(null); showSnackbar(`Room ${roomNumber} check is saved.`, 'success', 'Room check saved') },
    onError: (err: any) => setRcError(err.response?.data?.message || 'Failed to save'),
  })

  const updateCheckMutation = useMutation({
    mutationFn: (data: any) => api.patch(`/room-checks/${rcEditId}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['room-checks', roomNumber] }); setAddOpen(false); setRcEditId(null); showSnackbar(`Room ${roomNumber} check is updated.`, 'success', 'Room check saved') },
    onError: (err: any) => setRcError(err.response?.data?.message || 'Failed to update'),
  })

  const deleteCheckMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/room-checks/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['room-checks', roomNumber] }); setRcDeleteTarget(null); showSnackbar('Room check deleted') },
    onError: (err: any) => { showSnackbar(err.response?.data?.message || 'Failed to delete', 'error'); setRcDeleteTarget(null) },
  })

  useEffect(() => {
    if (!rcView?.photo_url) { setRcPhotoBlob(null); return }
    let active = true
    let blobUrl = ''
    fetch(rcView.photo_url).then(r => r.blob()).then(b => {
      if (active) { blobUrl = URL.createObjectURL(b); setRcPhotoBlob(blobUrl) }
    }).catch(() => { if (active) setRcPhotoBlob(rcView.photo_url) })
    return () => { active = false; if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [rcView])

  const rcResetForm = () => setRcForm({ status: 'pass', cleanliness_rating: 5, safety_rating: 5, notes: '', check_date: localDate() })

  const rcOpenEdit = (c: any) => {
    setRcEditId(c.id)
    setRcForm({ status: c.status || 'pass', cleanliness_rating: c.cleanliness_rating || 5, safety_rating: c.safety_rating || 5, notes: c.notes || '', check_date: c.check_date?.slice(0, 10) || localDate() })
    setRcError('')
    setRcView(null)
    setAddOpen(true)
  }

  if (!roomNumber) return (
    <EmptyRow message="No room number assigned to this person. Room checks cannot be displayed." />
  )

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
  if (isError) return <Alert severity="error">Failed to load room checks</Alert>

  return (
    <Box>
      <SectionHeader title="Room checks" subtitle={`Room ${roomNumber}`} action={<Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => { rcResetForm(); setRcEditId(null); setRcError(''); setAddOpen(true) }}
        sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none', px: 2 }}>Record a check</Button>} />
      {checks.length === 0 ? (
        <EmptyRow message="No room checks recorded for this room" />
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Location</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Cleanliness</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Safety</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Checked By</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Notes</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {checks.map((c: any) => (
                <TableRow key={c.id} hover onClick={() => setRcView(c)} sx={{ cursor: 'pointer' }}>
                  <TableCell>{new Date(c.check_date).toLocaleDateString('en-GB')}</TableCell>
                  <TableCell>{c.location_name || '—'}</TableCell>
                  <TableCell><Rating value={c.cleanliness_rating || 0} readOnly size="small" max={5} /></TableCell>
                  <TableCell><Rating value={c.safety_rating || 0} readOnly size="small" max={5} /></TableCell>
                  <TableCell><Chip label={c.status === 'pass' ? 'Pass' : c.status === 'fail' ? 'Fail' : 'Needs Attention'} size="small"
                    color={c.status === 'pass' ? 'success' : c.status === 'fail' ? 'error' : 'warning'} /></TableCell>
                  <TableCell>{c.checked_by_name || '—'}</TableCell>
                  <TableCell sx={{ maxWidth: 200 }}>{c.notes || '—'}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end" onClick={e => e.stopPropagation()}>
                      <IconButton size="small" onClick={() => rcOpenEdit(c)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => setRcDeleteTarget(c.id)}><DeleteIcon fontSize="small" /></IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!rcView} onClose={() => setRcView(null)} maxWidth="sm" fullWidth>
        {rcView && (
          <>
            <DialogTitle sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                Room Check — {rcView.room_number || roomNumber}
                <Typography variant="caption" color="text.muted" sx={{ display: 'block', fontWeight: 500 }}>
                  {rcView.location_name ? `${rcView.location_name} · ` : ''}{new Date(rcView.check_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => setRcView(null)}><CloseIcon fontSize="small" /></IconButton>
            </DialogTitle>
            <DialogContent>
              <Stack spacing={2.5}>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip label={rcView.status === 'pass' ? 'Pass' : rcView.status === 'fail' ? 'Fail' : 'Needs Attention'} size="small"
                    color={rcView.status === 'pass' ? 'success' : rcView.status === 'fail' ? 'error' : 'warning'} sx={{ fontWeight: 600 }} />
                  {rcView.created_at && <Chip label={`Recorded ${new Date(rcView.created_at).toLocaleString('en-GB')}`} size="small" variant="outlined" />}
                </Stack>
                <Stack direction="row" spacing={3} flexWrap="wrap">
                  <Box>
                    <Typography variant="caption" color="text.muted" sx={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0.5 }}>Cleanliness</Typography>
                    <Rating value={rcView.cleanliness_rating || 0} readOnly max={5} sx={{ display: 'block', mt: 0.25 }} />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.muted" sx={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0.5 }}>Safety</Typography>
                    <Rating value={rcView.safety_rating || 0} readOnly max={5} sx={{ display: 'block', mt: 0.25 }} />
                  </Box>
                </Stack>
                <Box>
                  <Typography variant="caption" color="text.muted" sx={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0.5 }}>Notes</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.25 }}>{rcView.notes || '—'}</Typography>
                </Box>
                {rcView.checked_by_name && (
                  <Box>
                    <Typography variant="caption" color="text.muted" sx={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0.5 }}>Checked by</Typography>
                    <Typography variant="body2" sx={{ mt: 0.25 }}>{rcView.checked_by_name}</Typography>
                  </Box>
                )}
                {rcView.photo_url && rcPhotoBlob && (
                  <Box>
                    <Typography variant="caption" color="text.muted" sx={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0.5, mb: 0.5, display: 'block' }}>Photo</Typography>
                    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
                      <Box component="img" src={rcPhotoBlob} alt="Room check" sx={{ width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block', bgcolor: 'notice.muted.bg' }} />
                      <IconButton size="small" onClick={() => { const url = rcView.photo_url; fetch(url).then(r => r.blob()).then(b => window.open(URL.createObjectURL(b), '_blank', 'noopener')).catch(() => {}) }}
                        sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(255,255,255,0.9)', '&:hover': { bgcolor: 'background.paper' } }}>
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Paper>
                  </Box>
                )}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 3 }}>
              <Button variant="outlined" startIcon={<EditIcon />} onClick={() => rcOpenEdit(rcView)} sx={{ textTransform: 'none' }}>Edit</Button>
              <Button onClick={() => setRcView(null)} variant="contained" sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Add / Edit Room Check Dialog */}
      <Dialog open={addOpen} onClose={() => { setAddOpen(false); setRcEditId(null) }} maxWidth="xs" fullWidth>
        <Box component="form" onSubmit={e => { e.preventDefault(); setRcError(''); const data = { ...rcForm, room_number: roomNumber, location_id: locationId || undefined }; if (rcEditId) updateCheckMutation.mutate(data); else addCheckMutation.mutate(data) }}>
          <FigDialogHeader eyebrow={`ROOM ${roomNumber || ''} / RECORDS`} title={rcEditId ? 'Edit room check' : 'Record a room check'} subtitle={`Room ${roomNumber || ''} — record each check before saving.`} onClose={() => { setAddOpen(false); setRcEditId(null) }} />
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
            <Button onClick={() => { setAddOpen(false); setRcEditId(null) }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addCheckMutation.isPending || updateCheckMutation.isPending}
              sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}>
              {(addCheckMutation.isPending || updateCheckMutation.isPending) ? <CircularProgress size={20} /> : rcEditId ? 'Save changes' : 'Save check'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog open={!!rcDeleteTarget} title="Delete room check" message="This will permanently remove this room check record." confirmLabel="Delete" danger
        onCancel={() => setRcDeleteTarget(null)}
        onConfirm={() => { if (rcDeleteTarget) deleteCheckMutation.mutate(rcDeleteTarget) }} />
    </Box>
  )
}

const SCORE_TYPE_META: Record<string, { label: string; description?: string }> = {
  waterlow: { label: 'Waterlow', description: 'Pressure ulcer risk.' },
  must: { label: 'MUST', description: 'Malnutrition screening.' },
  bmi: { label: 'BMI', description: 'Body mass index.' },
}

function ClinicalScoresTab({ personId }: { personId: string }) {
  const [addOpen, setAddOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [viewScore, setViewScore] = useState<any>(null)
  const [form, setForm] = useState({ score_type: 'waterlow', score: '', risk_level: '', notes: '', recorded_date: localDate() })
  const [formError, setFormError] = useState('')
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()

  const { data: scores = [], isLoading } = useQuery({
    queryKey: ['clinical-scores', personId],
    queryFn: () => api.get(`/people/${personId}/clinical-scores`).then(r => r.data),
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post(`/people/${personId}/clinical-scores`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clinical-scores', personId] }); setAddOpen(false); setEditId(null); setForm({ score_type: 'waterlow', score: '', risk_level: '', notes: '', recorded_date: localDate() }) },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to add score'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/people/${personId}/clinical-scores/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clinical-scores', personId] }); setAddOpen(false); setEditId(null); setForm({ score_type: 'waterlow', score: '', risk_level: '', notes: '', recorded_date: localDate() }) },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to update score'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/people/clinical-scores/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clinical-scores', personId] }); setDeleteTarget(null) },
    onError: (err: any) => { showSnackbar(err.response?.data?.message || 'Failed to delete', 'error'); setDeleteTarget(null) },
  })
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>

  const latestByType: Record<string, any> = {}
  scores.forEach((s: any) => {
    const prev = latestByType[s.score_type]
    if (!prev || new Date(s.recorded_date) > new Date(prev.recorded_date)) latestByType[s.score_type] = s
  })
  const latestScores = Object.values(latestByType)

  return (
    <Box>
      <SectionHeader title="Clinical scores" subtitle={scores.length > 0 ? 'Latest result for each score' : undefined} action={<Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => { setEditId(null); setForm({ score_type: 'waterlow', score: '', risk_level: '', notes: '', recorded_date: localDate() }); setFormError(''); setAddOpen(true) }}
        sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}>Record Score</Button>} />
      {scores.length === 0 ? (
        <EmptyRow message="No clinical scores recorded" />
      ) : (
        <Stack spacing={3}>
          <Grid container spacing={2}>
            {latestScores.map((s: any) => {
              const meta = SCORE_TYPE_META[s.score_type] || { label: s.score_type.replace(/_/g, ' ') }
              return (
                <Grid item xs={12} sm={6} md={3} key={s.score_type}>
                  <Paper onClick={() => setViewScore(s)}
                    sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', height: '100%', cursor: 'pointer',
                    '&:hover': { borderColor: METICLE_COLORS.primary, boxShadow: 1 } }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
                      {s.score != null && <Chip label={`${s.score}`} size="small" variant="outlined" sx={{ fontWeight: 700 }} />}
                      {s.risk_level && <Chip label={s.risk_level.replace(/_/g, ' ')} size="small"
                        color={s.risk_level === 'high' || s.risk_level === 'severe' ? 'error' : s.risk_level === 'medium' || s.risk_level === 'at_risk' ? 'warning' : 'success'}
                        sx={{ textTransform: 'capitalize', fontWeight: 600 }} />}
                    </Stack>
                    <Typography variant="subtitle1" fontWeight={600}>{meta.label}</Typography>
                    {meta.description && <Typography variant="body2" color="text.secondary">{meta.description}</Typography>}
                    <Typography variant="caption" color="text.muted" sx={{ mt: 1, display: 'block' }}>
                      {new Date(s.recorded_date).toLocaleDateString('en-GB')}{s.recorded_by_name ? ` · ${s.recorded_by_name}` : ''}
                    </Typography>
                  </Paper>
                </Grid>
              )
            })}
          </Grid>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Score history</Typography>
            <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'notice.subtle.bg' }}>
                    <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Assessment</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Score</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Taken by</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Notes</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[...scores].sort((a: any, b: any) => new Date(b.recorded_date).getTime() - new Date(a.recorded_date).getTime()).map((s: any) => (
                    <TableRow key={s.id} hover onClick={() => setViewScore(s)} sx={{ cursor: 'pointer' }}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(s.recorded_date).toLocaleDateString('en-GB')}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{(SCORE_TYPE_META[s.score_type]?.label || s.score_type.replace(/_/g, ' '))}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {s.score != null && <Chip label={`${s.score}`} size="small" variant="outlined" sx={{ fontWeight: 700 }} />}
                          {s.risk_level && <Chip label={s.risk_level.replace(/_/g, ' ')} size="small"
                            color={s.risk_level === 'high' || s.risk_level === 'severe' ? 'error' : s.risk_level === 'medium' || s.risk_level === 'at_risk' ? 'warning' : 'success'}
                            sx={{ textTransform: 'capitalize' }} />}
                        </Stack>
                      </TableCell>
                      <TableCell>{s.recorded_by_name || '—'}</TableCell>
                      <TableCell><Typography variant="body2" noWrap sx={{ maxWidth: 260 }}>{s.notes || '—'}</Typography></TableCell>
                      <TableCell align="right" onClick={(e: React.MouseEvent) => e.stopPropagation()} sx={{ whiteSpace: 'nowrap' }}>
                        <IconButton size="small" onClick={() => { setEditId(s.id); setForm({ score_type: s.score_type, score: s.score != null ? String(s.score) : '', risk_level: s.risk_level || '', notes: s.notes || '', recorded_date: s.recorded_date?.split('T')[0] || s.recorded_date }); setFormError(''); setAddOpen(true) }}><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => setDeleteTarget(s.id)}><DeleteIcon fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Stack>
      )}

      <Dialog open={addOpen} onClose={() => { setAddOpen(false); setEditId(null) }} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => {
          e.preventDefault(); setFormError('')
          const payload = { ...form, score: form.score ? parseFloat(form.score) : undefined }
          if (editId) updateMutation.mutate({ id: editId, data: payload })
          else addMutation.mutate(payload)
        }}>
          <DialogTitle sx={{ fontWeight: 600 }}>{editId ? 'Edit Clinical Score' : 'Record Clinical Score'}</DialogTitle>
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
            <Button onClick={() => { setAddOpen(false); setEditId(null) }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addMutation.isPending || updateMutation.isPending} sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}>
              {(addMutation.isPending || updateMutation.isPending) ? <CircularProgress size={20} /> : (editId ? 'Save Changes' : 'Save')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete clinical score?"
        message="This will permanently delete this clinical score. This action cannot be undone."
        confirmLabel="Delete"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
      <Dialog open={!!viewScore} onClose={() => setViewScore(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, textTransform: 'capitalize' }}>{viewScore?.score_type} Clinical Score</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {viewScore?.score != null && <Chip label={`Score: ${viewScore.score}`} size="small" variant="outlined" />}
              {viewScore?.risk_level && <Chip label={viewScore.risk_level.replace(/_/g, ' ')} size="small"
                color={viewScore.risk_level === 'high' || viewScore.risk_level === 'severe' ? 'error' : viewScore.risk_level === 'medium' || viewScore.risk_level === 'at_risk' ? 'warning' : 'success'} />}
              <Chip label={new Date(viewScore?.recorded_date).toLocaleDateString('en-GB')} size="small" variant="outlined" />
            </Stack>
            <Box>
              <Typography variant="caption" color="text.secondary">Notes</Typography>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{viewScore?.notes || '—'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Recorded by</Typography>
              <Typography variant="body1">{viewScore ? `${viewScore.recorded_by_name || '—'}${viewScore.created_at ? ` on ${new Date(viewScore.created_at).toLocaleString('en-GB')}` : ''}` : ''}</Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setViewScore(null)} sx={{ textTransform: 'none' }}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function DocumentsTab({ personId }: { personId: string }) {
  const eyebrow = usePersonEyebrow(personId, 'RECORDS')
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ title: '', document_type: 'care_plan', description: '', file_url: '', upload_date: localDate() })
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
    onSuccess: (_d, variables: any) => { queryClient.invalidateQueries({ queryKey: ['documents', personId] }); setAddOpen(false); setForm({ title: '', document_type: 'care_plan', description: '', file_url: '', upload_date: localDate() }); showSnackbar(`${variables?.title || 'Document'} is saved in ${nameFromEyebrow(eyebrow)}'s documents.`, 'success', 'Document uploaded') },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to upload'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/people/documents/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['documents', personId] }); setDeleteTarget(null) },
    onError: (err: any) => { showSnackbar(err.response?.data?.message || 'Failed to delete', 'error'); setDeleteTarget(null) },
  })
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const q = search.trim().toLowerCase()
  const filtered = q
    ? docs.filter((d: any) => [d.title, d.description, d.document_type?.replace(/_/g, ' ')].filter(Boolean).join(' ').toLowerCase().includes(q))
    : docs

  const viewDocument = async (fileUrl: string) => {
    try {
      const res = await fetch(fileUrl)
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
      <SectionHeader title="Documents" subtitle="Care files and important paperwork" action={
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField size="small" placeholder="Search" value={search} onChange={e => setSearch(e.target.value)}
            InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }}
            sx={{ width: 180 }} />
          <Button size="small" variant="contained" startIcon={<UploadIcon />} onClick={() => setAddOpen(true)}
            sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}>Upload</Button>
        </Stack>
      } />
      {filtered.length === 0 ? (
        <EmptyRow message={docs.length === 0 ? 'No documents uploaded yet' : 'No documents match your search'} />
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Document</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Added</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((d: any) => (
                <TableRow key={d.id} hover sx={{ cursor: 'pointer' }} onClick={() => viewDocument(d.file_url)}>
                  <TableCell>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: 'notice.error.bg', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileIcon sx={{ color: 'notice.error.fg', fontSize: 20 }} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>{d.title}</Typography>
                        <Typography variant="caption" color="text.muted" noWrap sx={{ display: 'block' }}>
                          {d.description || d.document_type?.replace(/_/g, ' ')}
                        </Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell><Chip label={d.document_type?.replace(/_/g, ' ')} size="small" variant="outlined" /></TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Typography variant="body2">{d.upload_date ? new Date(d.upload_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</Typography>
                    {d.uploaded_by_name && <Typography variant="caption" color="text.muted">by {d.uploaded_by_name}</Typography>}
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                    <IconButton size="small" onClick={() => viewDocument(d.file_url)} aria-label="Open document"><OpenInNewIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => setDeleteTarget(d.id)} aria-label="Delete document"><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); setFormError(''); if (!form.file_url) { setFormError('Please upload a file first'); return } addMutation.mutate(form) }}>
          <FigDialogHeader eyebrow={eyebrow} title="Upload a document" subtitle="Choose a file or drop it here — PDF, Word or images, up to 10 MB." onClose={() => setAddOpen(false)} />
          <DialogContent>
            {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Title" fullWidth required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              <Box>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Type</Typography>
                <PillOptions options={[{ value: 'care_plan', label: 'Care plan' }, { value: 'assessment', label: 'Assessment' }, { value: 'hospital_letter', label: 'Hospital letter' }, { value: 'referral', label: 'Referral' }, { value: 'mental_health', label: 'Mental Health Act' }, { value: 'legal', label: 'Legal' }, { value: 'correspondence', label: 'Correspondence' }, { value: 'other', label: 'Other' }]} value={form.document_type} onChange={v => setForm({ ...form, document_type: v })} />
              </Box>
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
              <Paper variant="outlined" onClick={() => { if (!uploading) fileInputRef.current?.click() }}
                sx={{ p: 2.5, textAlign: 'center', borderStyle: 'dashed', cursor: uploading ? 'default' : 'pointer', bgcolor: 'notice.subtle.bg', '&:hover': { borderColor: METICLE_COLORS.primary } }}>
                {uploading ? <CircularProgress size={24} /> : (
                  <Stack spacing={0.5} alignItems="center">
                    <UploadIcon sx={{ color: METICLE_COLORS.primary }} />
                    <Typography variant="body2" fontWeight={600}>{form.file_url ? 'Replace the file' : 'Choose a file or drop it here'}</Typography>
                    <Typography variant="caption" color="text.secondary">PDF, Word or images · up to 10 MB</Typography>
                  </Stack>
                )}
              </Paper>
              {form.file_url && <Chip label={form.file_url.split('/').pop()} size="small" color="primary" variant="outlined" onDelete={() => setForm({ ...form, file_url: '' })} />}
              <TextField label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.upload_date} onChange={e => setForm({ ...form, upload_date: e.target.value })} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addMutation.isPending || uploading} sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}>
              {addMutation.isPending ? <CircularProgress size={20} /> : 'Upload'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete document?"
        message="This will permanently delete this document. This action cannot be undone."
        confirmLabel="Delete"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </Box>
  )
}

const WELLBEING_DOMAINS = ['mood', 'engagement', 'sleep', 'appetite', 'pain', 'mobility', 'social', 'overall']

const DOMAIN_COLORS: Record<string, string> = {
  mood: '#8B7CF6', engagement: '#046E86', sleep: '#6B8AFD', appetite: METICLE_COLORS.success,
  pain: METICLE_COLORS.danger, mobility: METICLE_COLORS.warning, social: METICLE_COLORS.primary, overall: 'text.secondary',
}

function WellbeingTabInline({ personId }: { personId: string }) {
  const eyebrow = usePersonEyebrow(personId, 'CLINICAL')
  const [addOpen, setAddOpen] = useState(false)
  const [viewEntry, setViewEntry] = useState<any>(null)
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wellbeing', personId] }); setAddOpen(false); setForm({ domain: 'mood', score: 5, notes: '' }); showSnackbar('The check-in is added to the record.', 'success', 'Check-in saved') },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to add entry'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/people/wellbeing/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wellbeing', personId] }); setDeleteTarget(null); showSnackbar('Entry deleted') },
    onError: (err: any) => { showSnackbar(err.response?.data?.message || 'Failed to delete', 'error'); setDeleteTarget(null) },
  })
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>

  const grouped: Record<string, any[]> = {}
  entries.forEach((e: any) => { if (!grouped[e.domain]) grouped[e.domain] = []; grouped[e.domain].push(e) })

  const latestByDomain: Record<string, number> = {}
  entries.forEach((e: any) => { if (!latestByDomain[e.domain] || new Date(e.recorded_date) > new Date(latestByDomain[e.domain + '_date'])) { latestByDomain[e.domain] = e.score; latestByDomain[e.domain + '_date'] = e.recorded_date } })
  const radarData = WELLBEING_DOMAINS.filter(d => latestByDomain[d] != null).map(d => ({ domain: d.charAt(0).toUpperCase() + d.slice(1), score: latestByDomain[d], fullMark: 10 }))
  const wellbeingWeekStart = new Date()
  wellbeingWeekStart.setDate(wellbeingWeekStart.getDate() - ((wellbeingWeekStart.getDay() + 6) % 7))
  wellbeingWeekStart.setHours(0, 0, 0, 0)
  const wellbeingThisWeek = entries.filter((e: any) => new Date(e.recorded_date) >= wellbeingWeekStart).length

  return (
    <Box>
      <SectionHeader title="Wellbeing" subtitle={entries.length > 0 ? `${entries.length} check-ins · ${wellbeingThisWeek} this week` : undefined} action={<Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}
        sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}>Add a check-in</Button>} />
      {radarData.length >= 3 && (
        <Paper sx={{ p: 3, mb: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 1, display: 'block' }}>Latest Wellbeing Snapshot</Typography>
          <RechartsResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
              <PolarGrid stroke="#D6E2EE" />
              <PolarAngleAxis dataKey="domain" tick={{ fontSize: 11, fill: 'text.secondary' }} />
              <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fontSize: 10, fill: 'text.muted' }} />
              <Radar name="Score" dataKey="score" stroke={METICLE_COLORS.primary} fill={METICLE_COLORS.primary} fillOpacity={0.25} strokeWidth={2} />
            </RadarChart>
          </RechartsResponsiveContainer>
        </Paper>
      )}
      {entries.length === 0 ? (
        <EmptyRow message="No wellbeing entries recorded" />
      ) : (
        <Stack spacing={2}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Wellbeing check-ins</Typography>
          {Object.entries(grouped).map(([domain, items]) => {
            const domainColor = DOMAIN_COLORS[domain] || 'text.secondary'
            const latest = items.reduce((a: any, b: any) => new Date(a.recorded_date) > new Date(b.recorded_date) ? a : b)
            return (
              <Paper key={domain} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center"
                  sx={{ px: 2, py: 1.25, borderBottom: '1px solid divider', bgcolor: `${domainColor}0D` }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: domainColor }} />
                    <Typography variant="subtitle2" fontWeight={600} sx={{ textTransform: 'capitalize' }}>{domain}</Typography>
                  </Stack>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Typography variant="caption" color="text.muted">{items.length} {items.length === 1 ? 'entry' : 'entries'}</Typography>
                    <Chip label={`Latest ${latest.score}/10`} size="small" sx={{ bgcolor: `${domainColor}18`, color: domainColor, fontWeight: 600, fontSize: '0.7rem' }} />
                  </Stack>
                </Stack>
                <Stack divider={<Divider />} spacing={0}>
                  {items.map((e: any) => {
                    const sc = (e.score || 0) >= 8 ? METICLE_COLORS.success : (e.score || 0) >= 5 ? METICLE_COLORS.warning : METICLE_COLORS.danger
                    return (
                      <Box key={e.id} onClick={() => setViewEntry(e)}
                        sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer', '&:hover': { bgcolor: 'notice.subtle.bg' } }}>
                        <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: `${sc}18`, color: sc, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Typography variant="subtitle2" fontWeight={600}>{e.score}</Typography>
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          {e.notes && <Typography variant="body2" color="#3A4551" noWrap sx={{ maxWidth: '100%' }}>{e.notes}</Typography>}
                          <Stack direction="row" spacing={2}>
                            <Typography variant="caption" color="text.muted">{e.recorded_date ? new Date(e.recorded_date).toLocaleDateString('en-GB') : ''}</Typography>
                            {e.recorded_by_name && <Typography variant="caption" color="text.muted">by {e.recorded_by_name}</Typography>}
                          </Stack>
                        </Box>
                        <IconButton size="small" color="error" onClick={(ev: React.MouseEvent) => { ev.stopPropagation(); setDeleteTarget(e.id) }}><DeleteIcon fontSize="small" /></IconButton>
                      </Box>
                    )
                  })}
                </Stack>
              </Paper>
            )
          })}
        </Stack>
      )}

      <Dialog open={!!viewEntry} onClose={() => setViewEntry(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, textTransform: 'capitalize' }}>{viewEntry?.domain} Entry</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip label={`${viewEntry?.score}/10`} size="small" sx={{ bgcolor: 'notice.muted.bg', color: METICLE_COLORS.primary, fontWeight: 600 }} />
              {viewEntry?.recorded_date && <Chip label={new Date(viewEntry.recorded_date).toLocaleDateString('en-GB')} size="small" variant="outlined" />}
            </Stack>
            <Box>
              <Typography variant="caption" color="text.secondary">Notes</Typography>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{viewEntry?.notes || '—'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Recorded by</Typography>
              <Typography variant="body1">{viewEntry ? `${viewEntry.recorded_by_name || '—'}${viewEntry.created_at ? ` on ${new Date(viewEntry.created_at).toLocaleString('en-GB')}` : ''}` : ''}</Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setViewEntry(null)} sx={{ textTransform: 'none' }}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); setFormError(''); addMutation.mutate(form) }}>
          <FigDialogHeader eyebrow={eyebrow} title="Wellbeing check-in" subtitle={`Ask ${nameFromEyebrow(eyebrow)} how they're feeling today.`} onClose={() => setAddOpen(false)} />
          <DialogContent>
            {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField select label="Domain" fullWidth required value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })}>
                {WELLBEING_DOMAINS.map(d => <MenuItem key={d} value={d} sx={{ textTransform: 'capitalize' }}>{d}</MenuItem>)}
              </TextField>
              <Box>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Score: {form.score}/10</Typography>
                <input type="range" min={1} max={10} value={form.score}
                  onChange={e => setForm({ ...form, score: parseInt(e.target.value) })}
                  style={{ width: '100%' }} />
              </Box>
              <TextField label="Notes" fullWidth multiline rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addMutation.isPending} sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}>
              {addMutation.isPending ? <CircularProgress size={20} /> : 'Save check-in'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete wellbeing entry?"
        message="This will permanently delete this wellbeing entry. This action cannot be undone."
        confirmLabel="Delete"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </Box>
  )
}

const CONTACT_METHODS = ['phone', 'email', 'letter', 'visit', 'video_call', 'other']
const METHOD_LABELS: Record<string, string> = { phone: 'Phone call', email: 'Email', letter: 'Letter', visit: 'Visit', video_call: 'Video call', other: 'Contact' }
const DIRECTION_OPTIONS = ['inbound', 'outbound']

function CommunicationLogTabInline({ personId }: { personId: string }) {
  const eyebrow = usePersonEyebrow(personId, 'PEOPLE')
  const [addOpen, setAddOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [viewEntry, setViewEntry] = useState<any>(null)
  const [form, setForm] = useState({ contact_name: '', relationship: '', contact_method: 'phone', direction: 'inbound', summary: '', follow_up_actions: '', recorded_date: localDate() })
  const [formError, setFormError] = useState('')
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['communication-log', personId],
    queryFn: () => api.get(`/people/${personId}/communication-log`).then(r => r.data),
  })

  const resetForm = () => setForm({ contact_name: '', relationship: '', contact_method: 'phone', direction: 'inbound', summary: '', follow_up_actions: '', recorded_date: localDate() })

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post(`/people/${personId}/communication-log`, data),
    onSuccess: (_d, variables: any) => { queryClient.invalidateQueries({ queryKey: ['communication-log', personId] }); setAddOpen(false); setEditId(null); resetForm(); showSnackbar(`The ${(variables?.contact_method || 'contact').replace(/_/g, ' ')} with ${variables?.contact_name || 'them'} is saved in the circle of care.`, 'success', 'Contact logged') },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to add entry'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/people/communication-log/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['communication-log', personId] }); setAddOpen(false); setEditId(null); resetForm(); showSnackbar('Entry updated') },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to update entry'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/people/communication-log/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['communication-log', personId] }); setDeleteTarget(null); showSnackbar('Entry deleted') },
    onError: (err: any) => { showSnackbar(err.response?.data?.message || 'Failed to delete', 'error'); setDeleteTarget(null) },
  })
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>

  return (
    <Box>
      <SectionHeader title="Messages and calls" subtitle="With family and professionals" action={<Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => { setEditId(null); resetForm(); setFormError(''); setAddOpen(true) }}
        sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}>Log a contact</Button>} />
      {entries.length === 0 ? (
        <EmptyRow message="No communication entries recorded" />
      ) : (
        <Paper sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
          <Stack divider={<Divider />} spacing={0}>
            {entries.map((e: any) => {
              const methodLabel = METHOD_LABELS[e.contact_method] || e.contact_method?.replace(/_/g, ' ') || 'Contact'
              const methodIcon = e.contact_method === 'email' ? <EmailIcon fontSize="small" />
                : e.contact_method === 'letter' ? <FileIcon fontSize="small" />
                : e.contact_method === 'video_call' ? <VideoCallIcon fontSize="small" />
                : e.contact_method === 'visit' ? <HomeIcon fontSize="small" />
                : <PhoneIcon fontSize="small" />
              return (
                <Box key={e.id} onClick={() => setViewEntry(e)} sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer', '&:hover': { bgcolor: 'notice.subtle.bg' } }}>
                  <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: 'notice.muted.bg', color: METICLE_COLORS.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {methodIcon}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600}>{methodLabel} with {e.contact_name}{e.relationship ? ` (${e.relationship})` : ''}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {e.recorded_date ? new Date(e.recorded_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}{e.recorded_by_name ? ` · ${e.recorded_by_name}` : ''}{e.summary ? ` — ${e.summary}` : ''}
                    </Typography>
                  </Box>
                  <Chip label={e.relationship || methodLabel} size="small" variant="outlined" sx={{ flexShrink: 0, textTransform: 'capitalize' }} />
                  <Stack direction="row" spacing={0} onClick={ev => ev.stopPropagation()} sx={{ flexShrink: 0 }}>
                    <IconButton size="small" onClick={() => { setEditId(e.id); setForm({ contact_name: e.contact_name || '', relationship: e.relationship || '', contact_method: e.contact_method || 'phone', direction: e.direction || 'inbound', summary: e.summary || '', follow_up_actions: e.follow_up_actions || '', recorded_date: e.recorded_date?.split('T')[0] || e.recorded_date }); setFormError(''); setAddOpen(true) }}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => setDeleteTarget(e.id)}><DeleteIcon fontSize="small" /></IconButton>
                  </Stack>
                </Box>
              )
            })}
          </Stack>
        </Paper>
      )}

      <Dialog open={addOpen} onClose={() => { setAddOpen(false); setEditId(null) }} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); setFormError(''); if (editId) updateMutation.mutate({ id: editId, data: form }); else addMutation.mutate(form) }}>
          <FigDialogHeader eyebrow={eyebrow} title={editId ? 'Edit contact log' : 'Log a contact'} subtitle={`Log calls, visits and messages about ${nameFromEyebrow(eyebrow)}.`} onClose={() => { setAddOpen(false); setEditId(null) }} />          <DialogContent>
            {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack direction="row" spacing={1}>
                <TextField label="Contact Name" fullWidth required value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} />
                <TextField label="Relationship" fullWidth value={form.relationship} onChange={e => setForm({ ...form, relationship: e.target.value })} />
              </Stack>
              <Stack direction="row" spacing={1}>
                <Box>
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>How</Typography>
                  <PillOptions options={CONTACT_METHODS.map(m => ({ value: m, label: METHOD_LABELS[m] || m.replace(/_/g, ' ') }))} value={form.contact_method} onChange={v => setForm({ ...form, contact_method: v })} />
                </Box>
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
            <Button onClick={() => setAddOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addMutation.isPending || updateMutation.isPending} sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}>
              {(addMutation.isPending || updateMutation.isPending) ? <CircularProgress size={20} /> : (editId ? 'Save changes' : 'Save contact log')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* View dialog */}
      <Dialog open={!!viewEntry} onClose={() => setViewEntry(null)} maxWidth="sm" fullWidth>
        {viewEntry && (
          <>
            <DialogTitle sx={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}>
              Communication Entry
              <Box sx={{ flex: 1 }} />
              <IconButton size="small" onClick={() => setViewEntry(null)}><CloseIcon fontSize="small" /></IconButton>
            </DialogTitle>
            <DialogContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip label={viewEntry.contact_method?.replace(/_/g, ' ')} size="small" variant="outlined" />
                  <Chip label={viewEntry.direction} size="small" color={viewEntry.direction === 'inbound' ? 'info' : 'primary'} variant="outlined" />
                  {viewEntry.recorded_date && <Chip label={new Date(viewEntry.recorded_date).toLocaleDateString('en-GB')} size="small" variant="outlined" />}
                </Stack>
                <Box>
                  <Typography variant="caption" color="text.secondary">Contact</Typography>
                  <Typography variant="body1" fontWeight={600}>{viewEntry.contact_name}{viewEntry.relationship ? ` — ${viewEntry.relationship}` : ''}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Summary</Typography>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{viewEntry.summary || '—'}</Typography>
                </Box>
                {viewEntry.follow_up_actions && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Follow-up Actions</Typography>
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{viewEntry.follow_up_actions}</Typography>
                  </Box>
                )}
                <Typography variant="caption" color="text.muted">Recorded by {viewEntry.recorded_by_name || '—'}{viewEntry.created_at ? ` on ${new Date(viewEntry.created_at).toLocaleString('en-GB')}` : ''}</Typography>
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 3 }}>
              <Button onClick={() => { setViewEntry(null); setEditId(viewEntry.id); setForm({ contact_name: viewEntry.contact_name || '', relationship: viewEntry.relationship || '', contact_method: viewEntry.contact_method || 'phone', direction: viewEntry.direction || 'inbound', summary: viewEntry.summary || '', follow_up_actions: viewEntry.follow_up_actions || '', recorded_date: viewEntry.recorded_date?.split('T')[0] || viewEntry.recorded_date }); setFormError(''); setAddOpen(true) }} sx={{ textTransform: 'none' }}>
                <EditIcon sx={{ fontSize: 16, mr: 0.5 }} />Edit
              </Button>
              <Button onClick={() => setViewEntry(null)} variant="contained" sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete communication entry?"
        message="This will permanently delete this communication entry. This action cannot be undone."
        confirmLabel="Delete"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </Box>
  )
}

const CAPACITY_STATUSES = ['has_capacity', 'lacks_capacity', 'fluctuating', 'not_assessed']

const CAPACITY_STATUS_COLORS: Record<string, string> = {
  has_capacity: METICLE_COLORS.success, lacks_capacity: METICLE_COLORS.danger, fluctuating: METICLE_COLORS.warning, not_assessed: 'text.secondary',
}

function CapacityMcaTabInline({ personId }: { personId: string }) {
  const eyebrow = usePersonEyebrow(personId, 'PEOPLE')
  const [addOpen, setAddOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ assessment_date: localDate(), decision_to_be_made: '', capacity_found: null as boolean | null, capacity_status: 'not_assessed', best_interest_decision: '', best_interest_meeting_date: '', independent_advocate: '', relevant_people_informed: '', review_date: '' })
  const [formError, setFormError] = useState('')
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()

  const { data: assessments = [], isLoading } = useQuery({
    queryKey: ['capacity', personId],
    queryFn: () => api.get(`/people/${personId}/capacity`).then(r => r.data),
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post(`/people/${personId}/capacity`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['capacity', personId] }); setAddOpen(false); resetForm(); showSnackbar('The capacity assessment for this decision is saved.', 'success', 'Assessment saved') },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to add assessment'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/people/capacity/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['capacity', personId] }); setAddOpen(false); setEditId(null); resetForm(); showSnackbar('The capacity assessment is up to date.', 'success', 'Assessment saved') },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to update assessment'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/people/capacity/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['capacity', personId] }); setDeleteTarget(null); showSnackbar('Assessment deleted') },
    onError: (err: any) => { showSnackbar(err.response?.data?.message || 'Failed to delete', 'error'); setDeleteTarget(null) },
  })
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [viewEntry, setViewEntry] = useState<any>(null)

  function resetForm() {
    setForm({ assessment_date: localDate(), decision_to_be_made: '', capacity_found: null, capacity_status: 'not_assessed', best_interest_decision: '', best_interest_meeting_date: '', independent_advocate: '', relevant_people_informed: '', review_date: '' })
  }

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>

  return (
    <Box>
      <SectionHeader title="Mental capacity decisions" subtitle="Each decision is assessed on its own" action={<Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => { resetForm(); setEditId(null); setAddOpen(true) }}
        sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}>New assessment</Button>} />
      {assessments.length === 0 ? (
        <EmptyRow message="No capacity assessments recorded" />
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'notice.subtle.bg' }}>
                <TableCell sx={{ fontWeight: 600 }}>Decision</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Outcome</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Assessed</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Review</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {assessments.map((a: any) => {
                const outcome = a.capacity_found === true ? 'Has capacity'
                  : a.capacity_found === false ? (a.best_interest_decision ? 'Best-interest decision' : 'Lacks capacity')
                  : (a.capacity_status && a.capacity_status !== 'not_assessed' ? a.capacity_status.replace(/_/g, ' ') : 'Not assessed')
                const outcomeColor = outcome === 'Has capacity' ? 'success' : outcome === 'Best-interest decision' ? 'info' : outcome === 'Lacks capacity' ? 'error' : 'default'
                const reviewOverdue = a.review_date && new Date(a.review_date) < new Date(new Date().toDateString())
                return (
                  <TableRow key={a.id} hover onClick={() => setViewEntry(a)} sx={{ cursor: 'pointer' }}>
                    <TableCell sx={{ fontWeight: 600 }}>{a.decision_to_be_made || '—'}</TableCell>
                    <TableCell><Chip label={outcome} size="small" color={outcomeColor} sx={{ textTransform: 'capitalize', fontWeight: 600 }} /></TableCell>
                    <TableCell>
                      <Typography variant="body2">{a.assessment_date ? new Date(a.assessment_date).toLocaleDateString('en-GB') : '—'}</Typography>
                      {a.independent_advocate && <Typography variant="caption" color="text.secondary">{a.independent_advocate}</Typography>}
                    </TableCell>
                    <TableCell>
                      {a.review_date ? (
                        reviewOverdue
                          ? <><Typography variant="body2" fontWeight={600} color="error">Overdue</Typography><Typography variant="caption" color="text.secondary">{new Date(a.review_date).toLocaleDateString('en-GB')}</Typography></>
                          : <Typography variant="body2">{new Date(a.review_date).toLocaleDateString('en-GB')}</Typography>
                      ) : '—'}
                    </TableCell>
                    <TableCell align="right" onClick={e => e.stopPropagation()} sx={{ whiteSpace: 'nowrap' }}>
                      <IconButton size="small" onClick={() => {
                    setForm({
                      assessment_date: a.assessment_date?.split('T')[0] || localDate(),
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
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(a.id)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={addOpen} onClose={() => { setAddOpen(false); setEditId(null) }} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => {
          e.preventDefault(); setFormError('')
          if (form.capacity_found === null) { setFormError('Please record whether capacity was found (Yes / No) before saving.'); return }
          if (editId) updateMutation.mutate({ id: editId, data: form })
          else addMutation.mutate(form)
        }}>
          <FigDialogHeader eyebrow={eyebrow} title="Mental Capacity assessment" subtitle={`Record the decision ${nameFromEyebrow(eyebrow)} is making and the outcome.`} onClose={() => { setAddOpen(false); setEditId(null) }} />
          <DialogContent>
            {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Assessment Date" type="date" fullWidth required InputLabelProps={{ shrink: true }} value={form.assessment_date} onChange={e => setForm({ ...form, assessment_date: e.target.value })} />
              <TextField label="Decision to be Made" fullWidth multiline rows={2} required value={form.decision_to_be_made} onChange={e => setForm({ ...form, decision_to_be_made: e.target.value })} />
              <Box>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>Capacity Found</Typography>
                <Stack direction="row" spacing={1}>
                  <Button variant={form.capacity_found === true ? 'contained' : 'outlined'} color="success" size="small" onClick={() => setForm({ ...form, capacity_found: true })} sx={{ textTransform: 'none' }}>Yes</Button>
                  <Button variant={form.capacity_found === false ? 'contained' : 'outlined'} color="error" size="small" onClick={() => setForm({ ...form, capacity_found: false })} sx={{ textTransform: 'none' }}>No</Button>
                  <Button variant={form.capacity_found === null ? 'contained' : 'outlined'} color="warning" size="small" onClick={() => setForm({ ...form, capacity_found: null })} sx={{ textTransform: 'none' }}>Not Assessed</Button>
                </Stack>
              </Box>
              <TextField select label="Capacity Status" fullWidth required value={form.capacity_status} onChange={e => setForm({ ...form, capacity_status: e.target.value })}>
                {CAPACITY_STATUSES.map(s => <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s.replace(/_/g, ' ')}</MenuItem>)}
              </TextField>
              <TextField label="Best Interest Decision" fullWidth multiline rows={2} required value={form.best_interest_decision} onChange={e => setForm({ ...form, best_interest_decision: e.target.value })} />
              <TextField label="Best Interest Meeting Date" type="date" fullWidth required InputLabelProps={{ shrink: true }} value={form.best_interest_meeting_date} onChange={e => setForm({ ...form, best_interest_meeting_date: e.target.value })} />
              <TextField label="Independent Advocate" fullWidth required value={form.independent_advocate} onChange={e => setForm({ ...form, independent_advocate: e.target.value })} />
              <TextField label="Relevant People Informed" fullWidth multiline rows={2} required value={form.relevant_people_informed} onChange={e => setForm({ ...form, relevant_people_informed: e.target.value })} />
              <TextField label="Review Date" type="date" fullWidth required InputLabelProps={{ shrink: true }} value={form.review_date} onChange={e => setForm({ ...form, review_date: e.target.value })} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => { setAddOpen(false); setEditId(null) }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addMutation.isPending || updateMutation.isPending} sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}>
              {(addMutation.isPending || updateMutation.isPending) ? <CircularProgress size={20} /> : (editId ? 'Save changes' : 'Save assessment')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      <Dialog open={!!viewEntry} onClose={() => setViewEntry(null)} maxWidth="sm" fullWidth>
        {viewEntry && (
          <>
            <DialogTitle sx={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}>
              Capacity Assessment
              <Box sx={{ flex: 1 }} />
              <IconButton size="small" onClick={() => setViewEntry(null)}><CloseIcon fontSize="small" /></IconButton>
            </DialogTitle>
            <DialogContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip label={viewEntry.assessment_date ? new Date(viewEntry.assessment_date).toLocaleDateString('en-GB') : '—'} size="small" variant="outlined" />
                  <Chip label={viewEntry.capacity_found === true ? 'Has Capacity' : viewEntry.capacity_found === false ? 'Lacks Capacity' : 'Not Assessed'} size="small"
                    sx={{ bgcolor: viewEntry.capacity_found === true ? 'METICLE_COLORS.success20' : viewEntry.capacity_found === false ? 'METICLE_COLORS.danger20' : 'text.secondary20', color: viewEntry.capacity_found === true ? METICLE_COLORS.success : viewEntry.capacity_found === false ? METICLE_COLORS.danger : 'text.secondary', fontWeight: 600 }} />
                  <Chip label={viewEntry.capacity_status?.replace(/_/g, ' ')} size="small"
                    sx={{ bgcolor: `${CAPACITY_STATUS_COLORS[viewEntry.capacity_status] || '#51637A'}20`, color: CAPACITY_STATUS_COLORS[viewEntry.capacity_status] || '#51637A', fontWeight: 600 }} />
                </Stack>
                <Box>
                  <Typography variant="caption" color="text.secondary">Decision to be Made</Typography>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{viewEntry.decision_to_be_made || '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Best Interest Decision</Typography>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{viewEntry.best_interest_decision || '—'}</Typography>
                </Box>
                {viewEntry.best_interest_meeting_date && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Best Interest Meeting Date</Typography>
                    <Typography variant="body1">{new Date(viewEntry.best_interest_meeting_date).toLocaleDateString('en-GB')}</Typography>
                  </Box>
                )}
                <Box>
                  <Typography variant="caption" color="text.secondary">Independent Advocate</Typography>
                  <Typography variant="body1">{viewEntry.independent_advocate || '—'}</Typography>
                </Box>
                {viewEntry.relevant_people_informed && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Relevant People Informed</Typography>
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{viewEntry.relevant_people_informed}</Typography>
                  </Box>
                )}
                {viewEntry.review_date && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Review Date</Typography>
                    <Typography variant="body1">{new Date(viewEntry.review_date).toLocaleDateString('en-GB')}</Typography>
                  </Box>
                )}
                <Typography variant="caption" color="text.muted">Recorded by {viewEntry.recorded_by_name || '—'}{viewEntry.created_at ? ` on ${new Date(viewEntry.created_at).toLocaleString('en-GB')}` : ''}</Typography>
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 3 }}>
              <Button onClick={() => {
                const a = viewEntry
                setViewEntry(null)
                setForm({
                  assessment_date: a.assessment_date?.split('T')[0] || localDate(),
                  decision_to_be_made: a.decision_to_be_made || '',
                  capacity_found: a.capacity_found,
                  capacity_status: a.capacity_status || 'not_assessed',
                  best_interest_decision: a.best_interest_decision || '',
                  best_interest_meeting_date: a.best_interest_meeting_date?.split('T')[0] || '',
                  independent_advocate: a.independent_advocate || '',
                  relevant_people_informed: a.relevant_people_informed || '',
                  review_date: a.review_date?.split('T')[0] || '',
                }); setEditId(a.id); setFormError(''); setAddOpen(true)
              }} sx={{ textTransform: 'none' }}>
                <EditIcon sx={{ fontSize: 16, mr: 0.5 }} />Edit
              </Button>
              <Button onClick={() => setViewEntry(null)} variant="contained" sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
      <ConfirmDialog open={!!deleteTarget} title="Delete assessment" message="This will permanently remove this capacity assessment." onCancel={() => setDeleteTarget(null)} onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget) }} />
    </Box>
  )
}

async function openFileInNewTab(url: string) {
  try {
    const res = await fetch(url)
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

const PATHWAY_TYPES = ['hospital_admission', 'hospital_discharge', 'short_break', 'assessment_unit', 'transition', 'other']
const PATHWAY_STATUS_OPTIONS = ['active', 'completed', 'cancelled']

const PATHWAY_TYPE_COLORS: Record<string, string> = {
  hospital_admission: METICLE_COLORS.danger, hospital_discharge: '#046E86', short_break: METICLE_COLORS.warning,
  assessment_unit: '#8B7CF6', transition: METICLE_COLORS.success, other: 'text.secondary',
}

function CarePathwaysTabInline({ personId }: { personId: string }) {
  const eyebrow = usePersonEyebrow(personId, 'CLINICAL')
  const [addOpen, setAddOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [viewId, setViewId] = useState<string | null>(null)
  const [form, setForm] = useState({ pathway_type: 'hospital_admission', title: '', start_date: localDate(), end_date: '', location_name: '', referral_reason: '', discharge_notes: '', status: 'active', file_url: '', file_name: '' })
  const [formError, setFormError] = useState('')
  const pathwayFileInputRef = useRef<HTMLInputElement>(null)
  const [pathwayFileUploading, setPathwayFileUploading] = useState(false)
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()

  const { data: pathways = [], isLoading } = useQuery({
    queryKey: ['care-pathways', personId],
    queryFn: () => api.get(`/people/${personId}/care-pathways`).then(r => r.data),
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post(`/people/${personId}/care-pathways`, data),
    onSuccess: (_d, variables: any) => { queryClient.invalidateQueries({ queryKey: ['care-pathways', personId] }); setAddOpen(false); resetForm(); const l = String(variables?.pathway_type || 'pathway').replace(/_/g, ' '); showSnackbar(`${l.charAt(0).toUpperCase() + l.slice(1)} pathway is started.`, 'success', 'Pathway started') },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Failed to add pathway'
      const fieldErrors = err.response?.data?.errors
      setFormError(fieldErrors ? `${msg}: ${fieldErrors.map((f: any) => f.field + ' ' + f.message).join(', ')}` : msg)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/people/care-pathways/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['care-pathways', personId] }); setAddOpen(false); setEditId(null); resetForm(); showSnackbar('The pathway is up to date.', 'success', 'Pathway updated') },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Failed to update pathway'
      const fieldErrors = err.response?.data?.errors
      setFormError(fieldErrors ? `${msg}: ${fieldErrors.map((f: any) => f.field + ' ' + f.message).join(', ')}` : msg)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/people/care-pathways/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['care-pathways', personId] }); setDeleteTarget(null); showSnackbar('Pathway deleted') },
    onError: (err: any) => { showSnackbar(err.response?.data?.message || 'Failed to delete', 'error'); setDeleteTarget(null) },
  })
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  function resetForm() {
    setForm({ pathway_type: 'hospital_admission', title: '', start_date: localDate(), end_date: '', location_name: '', referral_reason: '', discharge_notes: '', status: 'active', file_url: '', file_name: '' })
  }

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>

  const active = pathways.filter((p: any) => p.status === 'active')
  const completed = pathways.filter((p: any) => p.status === 'completed' || p.status === 'cancelled')
  const viewPathway = pathways.find((p: any) => p.id === viewId)

  const renderCard = (p: any) => (
    <Paper key={p.id} onClick={() => setViewId(p.id)}
      sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', cursor: 'pointer', '&:hover': { borderColor: METICLE_COLORS.primary, boxShadow: '0 2px 8px rgba(15,76,129,0.12)' } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <Typography variant="subtitle2" fontWeight={600}>{p.title}</Typography>
            <Chip label={p.pathway_type?.replace(/_/g, ' ')} size="small" sx={{ bgcolor: `${PATHWAY_TYPE_COLORS[p.pathway_type] || '#51637A'}20`, color: PATHWAY_TYPE_COLORS[p.pathway_type] || '#51637A', fontWeight: 600 }} />
            <Chip label={p.status} size="small" color={p.status === 'active' ? 'success' : p.status === 'completed' ? 'info' : 'error'} />
          </Stack>
          <Stack direction="row" spacing={2} sx={{ mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">{p.start_date ? new Date(p.start_date).toLocaleDateString('en-GB') : '—'}{p.end_date ? ` → ${new Date(p.end_date).toLocaleDateString('en-GB')}` : ''}</Typography>
            {p.location_name && <Typography variant="caption" color="text.secondary">{p.location_name}</Typography>}
          </Stack>
          {p.referral_reason && <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.referral_reason}</Typography>}
          {p.discharge_notes && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.discharge_notes}</Typography>}
          {p.file_url && (
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.75 }} onClick={e => e.stopPropagation()}>
              <IconButton size="small" title={p.file_name || 'Open file'} onClick={() => openFileInNewTab(p.file_url)} sx={{ p: 0.25 }}>
                <FileIcon sx={{ fontSize: 15, color: METICLE_COLORS.primary }} />
              </IconButton>
              <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 240 }} noWrap>{p.file_name || p.file_url.split('/').pop()}</Typography>
            </Stack>
          )}
        </Box>
        <Stack direction="row" spacing={0.5} onClick={(e) => e.stopPropagation()}>
          <IconButton size="small" onClick={() => {
            setForm({
              pathway_type: p.pathway_type || 'hospital_admission', title: p.title || '',
              start_date: p.start_date?.split('T')[0] || '', end_date: p.end_date?.split('T')[0] || '',
              location_name: p.location_name || '', referral_reason: p.referral_reason || '',
              discharge_notes: p.discharge_notes || '', status: p.status || 'active',
              file_url: p.file_url || '', file_name: p.file_name || '',
            }); setEditId(p.id); setAddOpen(true)
          }}><EditIcon fontSize="small" /></IconButton>
          <IconButton size="small" color="error" onClick={() => setDeleteTarget(p.id)}><DeleteIcon fontSize="small" /></IconButton>
        </Stack>
      </Stack>
    </Paper>
  )

  return (
    <Box>
      <SectionHeader title="Care pathways"
        subtitle={pathways?.length > 0 ? `${pathways.filter((p: any) => p.status === 'active').length} active · ${pathways.filter((p: any) => p.status !== 'active').length} completed` : undefined}
        action={<Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => { resetForm(); setEditId(null); setAddOpen(true) }}
        sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}>New pathway</Button>} />
      {pathways.length === 0 ? (
        <EmptyRow message="No care pathways recorded" />
      ) : (
        <Stack spacing={3}>
          {active.length > 0 && (
            <Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Active</Typography>
              <Stack spacing={1.5}>{active.map(renderCard)}</Stack>
            </Box>
          )}
          {completed.length > 0 && (
            <Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, color: 'text.secondary' }}>Completed / Cancelled</Typography>
              <Stack spacing={1.5}>{completed.map(renderCard)}</Stack>
            </Box>
          )}
        </Stack>
      )}

      <Dialog open={addOpen} onClose={() => { setAddOpen(false); setEditId(null) }} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => {
          e.preventDefault(); setFormError('')
          const payload = {
            ...form,
            end_date: form.end_date || null,
            location_name: form.location_name || null,
            referral_reason: form.referral_reason || null,
            discharge_notes: form.discharge_notes || null,
          }
          if (editId) updateMutation.mutate({ id: editId, data: payload })
          else addMutation.mutate(payload)
        }}>
          <FigDialogHeader eyebrow={eyebrow} title={editId ? 'Edit pathway' : 'Start a care pathway'} subtitle="Pathways group free-text notes for a big change in care." onClose={() => { setAddOpen(false); setEditId(null) }} />
          <DialogContent>
            {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Box>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Pathway</Typography>
                <PillOptions options={PATHWAY_TYPES.map(t => ({ value: t, label: t.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) }))} value={form.pathway_type} onChange={v => setForm({ ...form, pathway_type: v })} />
              </Box>
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
              <Box>
                <input type="file" ref={pathwayFileInputRef} hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt,.csv" onChange={async e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setPathwayFileUploading(true)
                  try {
                    const fd = new FormData()
                    fd.append('file', file)
                    const res = await api.post('/settings/upload', fd)
                    setForm(f => ({ ...f, file_url: res.data.url, file_name: res.data.originalName || file.name }))
                  } catch { setFormError('Failed to upload file') }
                  finally { setPathwayFileUploading(false); e.target.value = '' }
                }} />
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button variant="outlined" size="small" onClick={() => pathwayFileInputRef.current?.click()}
                    disabled={pathwayFileUploading} startIcon={pathwayFileUploading ? <CircularProgress size={16} /> : <UploadIcon />}
                    sx={{ textTransform: 'none' }}>
                    {form.file_url ? 'Change File' : 'Attach File'}
                  </Button>
                  {form.file_url && (
                    <Chip label={form.file_name || form.file_url.split('/').pop() || 'File attached'} size="small"
                      onDelete={() => setForm(f => ({ ...f, file_url: '', file_name: '' }))}
                      icon={<FileIcon />} variant="outlined" sx={{ maxWidth: 240 }} />
                  )}
                </Stack>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => { setAddOpen(false); setEditId(null) }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addMutation.isPending || updateMutation.isPending || !form.title} sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}>
              {(addMutation.isPending || updateMutation.isPending) ? <CircularProgress size={20} /> : (editId ? 'Save changes' : 'Start pathway')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={!!viewId} onClose={() => setViewId(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
            <span>{viewPathway?.title}</span>
            {viewPathway && <Chip label={viewPathway.pathway_type?.replace(/_/g, ' ')} size="small" sx={{ bgcolor: `${PATHWAY_TYPE_COLORS[viewPathway.pathway_type] || '#51637A'}20`, color: PATHWAY_TYPE_COLORS[viewPathway.pathway_type] || '#51637A', fontWeight: 600 }} />}
            {viewPathway && <Chip label={viewPathway.status} size="small" color={viewPathway.status === 'active' ? 'success' : viewPathway.status === 'completed' ? 'info' : 'error'} />}
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={4}>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>START DATE</Typography>
                <Typography variant="body1" fontWeight={600}>{viewPathway?.start_date ? new Date(viewPathway.start_date).toLocaleDateString('en-GB') : '—'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>END DATE</Typography>
                <Typography variant="body1" fontWeight={600}>{viewPathway?.end_date ? new Date(viewPathway.end_date).toLocaleDateString('en-GB') : '—'}</Typography>
              </Box>
            </Stack>
            <Divider />
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>LOCATION</Typography>
              <Typography variant="body1">{viewPathway?.location_name || '—'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>REFERRAL REASON</Typography>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{viewPathway?.referral_reason || '—'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>DISCHARGE NOTES</Typography>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{viewPathway?.discharge_notes || '—'}</Typography>
            </Box>
            <Divider />
            {viewPathway?.file_url && (
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>ATTACHMENT</Typography>
                <Paper variant="outlined" sx={{ mt: 0.5, p: 1.5, bgcolor: 'notice.subtle.bg', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FileIcon sx={{ color: METICLE_COLORS.primary }} />
                  <Typography noWrap sx={{ flex: 1 }}>{viewPathway.file_name || viewPathway.file_url.split('/').pop()}</Typography>
                  <Button size="small" variant="outlined" startIcon={<OpenInNewIcon />} onClick={() => openFileInNewTab(viewPathway.file_url)} sx={{ textTransform: 'none' }}>Open</Button>
                </Paper>
              </Box>
            )}
            <Stack direction="row" spacing={4}>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>RECORDED BY</Typography>
                <Typography variant="body1" fontWeight={600}>{viewPathway?.recorded_by_name || '—'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>CREATED</Typography>
                <Typography variant="body1" fontWeight={600}>{viewPathway?.created_at ? new Date(viewPathway.created_at).toLocaleString('en-GB') : '—'}</Typography>
              </Box>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          {viewPathway && (
            <Button startIcon={<EditIcon />} variant="contained" sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }} onClick={() => {
              setViewId(null)
              setForm({
                pathway_type: viewPathway.pathway_type || 'hospital_admission', title: viewPathway.title || '',
                start_date: viewPathway.start_date?.split('T')[0] || '', end_date: viewPathway.end_date?.split('T')[0] || '',
                location_name: viewPathway.location_name || '', referral_reason: viewPathway.referral_reason || '',
                discharge_notes: viewPathway.discharge_notes || '', status: viewPathway.status || 'active',
                file_url: viewPathway.file_url || '', file_name: viewPathway.file_name || '',
              }); setEditId(viewPathway.id); setAddOpen(true)
            }}>Edit</Button>
          )}
          <Button onClick={() => setViewId(null)}>Close</Button>
          </DialogActions>
      </Dialog>
      <ConfirmDialog open={!!deleteTarget} title="Delete pathway" message="This will permanently remove this care pathway. This action cannot be undone." confirmLabel="Delete" danger onCancel={() => setDeleteTarget(null)} onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget) }} />
    </Box>
  )
}

const TIME_AWAY_CATEGORIES = ['documentation', 'medication', 'equipment', 'notification', 'property', 'financial', 'other']
const TIME_AWAY_TYPES: { value: string; label: string; color: string }[] = [
  { value: 'family_visit', label: 'Family Visit', color: '#046E86' },
  { value: 'short_break', label: 'Short Break', color: METICLE_COLORS.warning },
  { value: 'hospital_admission', label: 'Hospital Admission', color: METICLE_COLORS.danger },
  { value: 'hospital_discharge', label: 'Hospital Discharge', color: '#8B7CF6' },
  { value: 'trial_leave', label: 'Trial Leave', color: METICLE_COLORS.success },
  { value: 'discharge', label: 'Permanent Discharge', color: 'text.secondary' },
  { value: 'other', label: 'Other', color: METICLE_COLORS.primary },
]

function TimeAwayTabInline({ personId }: { personId: string }) {
  const eyebrow = usePersonEyebrow(personId, 'RECORDS')
  const [addOpen, setAddOpen] = useState(false)
  const [itemTarget, setItemTarget] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', time_away_type: 'family_visit', destination: '', start_date: '', end_date: '', notes: '' })
  const [itemForm, setItemForm] = useState({ item_text: '', category: 'documentation', quantity: '', unit: '' })
  const [formError, setFormError] = useState('')
  const [deleteRecordTarget, setDeleteRecordTarget] = useState<any | null>(null)
  const [deleteItemTarget, setDeleteItemTarget] = useState<string | null>(null)
  const [viewRecord, setViewRecord] = useState<any | null>(null)
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['time-away', personId],
    queryFn: () => api.get(`/people/${personId}/time-away`).then(r => r.data),
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post(`/people/${personId}/time-away`, data),
    onSuccess: (_d, variables: any) => { queryClient.invalidateQueries({ queryKey: ['time-away', personId] }); setAddOpen(false); setForm({ title: '', time_away_type: 'family_visit', destination: '', start_date: '', end_date: '', notes: '' }); showSnackbar(`${variables?.destination || variables?.title || 'Time away'} is recorded.`, 'success', 'Time away saved') },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to add time away'),
  })

  const deleteRecordMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/people/time-away/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['time-away', personId] }); setDeleteRecordTarget(null); showSnackbar('Time away deleted') },
    onError: (err: any) => { showSnackbar(err.response?.data?.message || 'Failed to delete', 'error'); setDeleteRecordTarget(null) },
  })

  const addItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.post(`/people/time-away/${id}/checklist`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['time-away', personId] }); setItemTarget(null); setItemForm({ item_text: '', category: 'documentation', quantity: '', unit: '' }) },
    onError: (err: any) => setFormError(err.response?.data?.message || 'Failed to add item'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) => api.patch(`/people/discharge-checklist/${id}`, { is_complete: completed }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['time-away', personId] }),
    onError: (err: any) => showSnackbar(err.response?.data?.message || 'Failed to update', 'error'),
  })

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/people/discharge-checklist/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['time-away', personId] }); setDeleteItemTarget(null); showSnackbar('Item deleted') },
    onError: (err: any) => { showSnackbar(err.response?.data?.message || 'Failed to delete', 'error'); setDeleteItemTarget(null) },
  })

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>

  return (
    <Box>
      <SectionHeader title="Time away" subtitle="Hospital stays, holidays and visits" action={<Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => { setForm({ title: '', time_away_type: 'family_visit', destination: '', start_date: '', end_date: '', notes: '' }); setFormError(''); setAddOpen(true) }}
        sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}>Record time away</Button>} />
      {records.length === 0 ? (
        <EmptyRow message="No time away planned yet. Add a weekend visit, hospital stay or short break." />
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Where</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Dates</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Reason</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records.map((record: any) => {
                const type = TIME_AWAY_TYPES.find(t => t.value === record.time_away_type) || TIME_AWAY_TYPES[TIME_AWAY_TYPES.length - 1]
                const items: any[] = record.items || []
                const done = items.filter((i: any) => i.is_complete).length
                const endDay = record.end_date ? String(record.end_date).slice(0, 10) : ''
                const backHome = endDay !== '' && endDay < localDate()
                const fmtDay = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''
                return (
                  <TableRow key={record.id} hover sx={{ cursor: 'pointer' }} onClick={() => setViewRecord(record)}>
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: 'notice.subtle.bg', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <LuggageIcon sx={{ color: type.color, fontSize: 20 }} />
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>{record.destination || record.title}</Typography>
                          <Typography variant="caption" color="text.muted" noWrap sx={{ display: 'block' }}>
                            {record.destination ? record.title : type.label}{items.length > 0 ? ` · Checklist ${done}/${items.length}` : ''}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2">{[fmtDay(record.start_date), fmtDay(record.end_date)].filter(Boolean).join(' – ') || '—'}</Typography>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 220 }}>
                      <Typography variant="body2" noWrap>{record.notes || type.label}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={backHome ? 'Back home' : 'Planned'} color={backHome ? 'success' : 'info'} />
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                      <IconButton size="small" onClick={() => setViewRecord(record)} aria-label="View time away"><OpenInNewIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => setDeleteRecordTarget(record)} aria-label="Delete time away"><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); setFormError(''); addMutation.mutate({ title: form.title, time_away_type: form.time_away_type, destination: form.destination, start_date: form.start_date, end_date: form.end_date, notes: form.notes }) }}>
          <FigDialogHeader eyebrow={eyebrow} title="Record time away" subtitle={`Record ${nameFromEyebrow(eyebrow)}'s time away from home and when they'll be back.`} onClose={() => setAddOpen(false)} />
          <DialogContent>
            {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Title" fullWidth required placeholder="e.g. Going to mum's house for the weekend" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              <Box>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Reason</Typography>
                <PillOptions options={TIME_AWAY_TYPES.map(t => ({ value: t.value, label: t.label }))} value={form.time_away_type} onChange={v => setForm({ ...form, time_away_type: v })} />
              </Box>
              <TextField label="Destination" fullWidth placeholder="e.g. Mum's house, Croydon" value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField label="Start Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
                <TextField label="End Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
              </Stack>
              <TextField label="Notes" fullWidth multiline rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addMutation.isPending} sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}>
              {addMutation.isPending ? <CircularProgress size={20} /> : 'Save time away'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={!!itemTarget} onClose={() => setItemTarget(null)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); setFormError(''); if (!itemTarget) return; addItemMutation.mutate({ id: itemTarget, data: { item: itemForm.item_text, category: itemForm.category, quantity: itemForm.quantity !== '' ? Number(itemForm.quantity) : null, unit: itemForm.unit } }) }}>
          <DialogTitle sx={{ fontWeight: 600 }}>Add Checklist Item</DialogTitle>
          <DialogContent>
            {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Item" fullWidth required value={itemForm.item_text} onChange={e => setItemForm({ ...itemForm, item_text: e.target.value })} />
              <TextField select label="Category" fullWidth required value={itemForm.category} onChange={e => setItemForm({ ...itemForm, category: e.target.value })}>
                {TIME_AWAY_CATEGORIES.map(c => <MenuItem key={c} value={c} sx={{ textTransform: 'capitalize' }}>{c.replace(/_/g, ' ')}</MenuItem>)}
              </TextField>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField label="Quantity (optional)" type="number" fullWidth placeholder="e.g. 30" value={itemForm.quantity} onChange={e => setItemForm({ ...itemForm, quantity: e.target.value })} />
                <TextField label="Unit (optional)" fullWidth placeholder="e.g. pads, days, bags" value={itemForm.unit} onChange={e => setItemForm({ ...itemForm, unit: e.target.value })} />
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setItemTarget(null)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addItemMutation.isPending} sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}>
              {addItemMutation.isPending ? <CircularProgress size={20} /> : 'Add Item'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={!!viewRecord} onClose={() => setViewRecord(null)} maxWidth="sm" fullWidth>
        {viewRecord && (() => {
          const rec = records.find((r: any) => r.id === viewRecord.id) || viewRecord
          const type = TIME_AWAY_TYPES.find(t => t.value === rec.time_away_type) || TIME_AWAY_TYPES[TIME_AWAY_TYPES.length - 1]
          const items: any[] = rec.items || []
          const grouped: Record<string, any[]> = {}
          items.forEach((i: any) => { const cat = i.category || 'other'; if (!grouped[cat]) grouped[cat] = []; grouped[cat].push(i) })
          return (
            <>
              <DialogTitle sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                <LuggageIcon sx={{ color: type.color }} /> {rec.title}
              </DialogTitle>
              <DialogContent>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip size="small" label={type.label} sx={{ bgcolor: `${type.color}18`, color: type.color, fontWeight: 600 }} />
                    {rec.destination && (
                      <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PlaceIcon sx={{ fontSize: 16, color: type.color }} /> {rec.destination}
                      </Typography>
                    )}
                  </Stack>
                  {(rec.start_date || rec.end_date) && (
                    <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CalendarMonthIcon sx={{ fontSize: 16, color: type.color }} />
                      {rec.start_date ? new Date(rec.start_date).toLocaleDateString('en-GB') : ''}{rec.start_date && rec.end_date ? ' to ' : ''}{rec.end_date ? new Date(rec.end_date).toLocaleDateString('en-GB') : ''}
                    </Typography>
                  )}
                  {rec.created_by_name && <Typography variant="caption" color="text.muted">Planned by {rec.created_by_name}</Typography>}
                  {rec.notes && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">Notes</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{rec.notes}</Typography>
                    </Box>
                  )}
                  <Divider />
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2" fontWeight={600}>Checklist ({items.filter((i: any) => i.is_complete).length}/{items.length})</Typography>
                    <Button size="small" startIcon={<AddIcon />} onClick={() => { setItemTarget(rec.id); setItemForm({ item_text: '', category: 'documentation', quantity: '', unit: '' }); setFormError('') }} sx={{ textTransform: 'none' }}>Add item</Button>
                  </Stack>
                  {items.length === 0 ? (
                    <Typography variant="body2" color="text.muted">No checklist items added yet.</Typography>
                  ) : (
                    <Stack spacing={1}>
                      {Object.entries(grouped).map(([category, catItems]) => (
                        <Box key={category}>
                          <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 600 }}>{category.replace(/_/g, ' ')}</Typography>
                          <Stack spacing={0.5}>
                            {catItems.map((item: any) => (
                              <Stack key={item.id} direction="row" alignItems="center" spacing={1} sx={{ bgcolor: 'notice.subtle.bg', borderRadius: 1, px: 1, py: 0.5 }}>
                                <IconButton size="small" onClick={() => toggleMutation.mutate({ id: item.id, completed: !item.is_complete })} disabled={toggleMutation.isPending}>
                                  {item.is_complete ? <CheckCircleIcon sx={{ color: METICLE_COLORS.success }} /> : <UncheckedIcon sx={{ color: 'text.secondary' }} />}
                                </IconButton>
                                <Box sx={{ flex: 1 }}>
                                  <Stack direction="row" spacing={0.5} alignItems="center">
                                    <Typography variant="body2" sx={{ textDecoration: item.is_complete ? 'line-through' : 'none', color: item.is_complete ? 'text.muted' : 'inherit' }}>
                                      {item.item}
                                    </Typography>
                                    {item.quantity != null && item.quantity !== '' && (
                                      <Chip size="small" label={`${item.quantity}${item.unit ? ' ' + item.unit : ''}`} sx={{ height: 18, fontSize: 11, bgcolor: 'notice.info.bg', color: 'notice.info.fg', fontWeight: 600 }} />
                                    )}
                                  </Stack>
                                  {item.is_complete && item.completed_by_name && (
                                    <Typography variant="caption" color="text.muted">Completed by {item.completed_by_name}{item.completed_at ? ` on ${new Date(item.completed_at).toLocaleDateString('en-GB')}` : ''}</Typography>
                                  )}
                                </Box>
                                <IconButton size="small" color="error" onClick={() => setDeleteItemTarget(item.id)}><DeleteIcon fontSize="small" /></IconButton>
                              </Stack>
                            ))}
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Stack>
              </DialogContent>
              <DialogActions sx={{ p: 3 }}>
                <Button onClick={() => setViewRecord(null)}>Close</Button>
              </DialogActions>
            </>
          )
        })()}
      </Dialog>

      <ConfirmDialog open={!!deleteRecordTarget} title="Delete time away" message={`This will permanently remove "${deleteRecordTarget?.title}" and all its checklist items.`} confirmLabel="Delete" danger loading={deleteRecordMutation.isPending} onCancel={() => setDeleteRecordTarget(null)} onConfirm={() => { if (deleteRecordTarget) deleteRecordMutation.mutate(deleteRecordTarget.id) }} />
      <ConfirmDialog open={!!deleteItemTarget} title="Delete checklist item" message="This will permanently remove this checklist item." confirmLabel="Delete" danger loading={deleteItemMutation.isPending} onCancel={() => setDeleteItemTarget(null)} onConfirm={() => { if (deleteItemTarget) deleteItemMutation.mutate(deleteItemTarget) }} />
    </Box>
  )
}

function MoodChartTabInline({ personId }: { personId: string }) {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [viewEntry, setViewEntry] = useState<any>(null)
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const [form, setForm] = useState({ domain: 'mood', score: 7, recorded_date: localDate(), notes: '' })
  const [formError, setFormError] = useState('')

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['wellbeing', personId],
    queryFn: () => api.get(`/people/${personId}/wellbeing`).then(r => r.data),
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post(`/people/${personId}/wellbeing`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wellbeing', personId] }); setAddOpen(false); setForm({ domain: 'mood', score: 7, recorded_date: localDate(), notes: '' }) },
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

  const scoreColor = (score: number) => score >= 8 ? METICLE_COLORS.success : score >= 5 ? METICLE_COLORS.warning : METICLE_COLORS.danger

  const band = (score: number) => score >= 8 ? 'High' : score >= 5 ? 'Moderate' : 'Low'
  const BAND_COLORS: Record<string, string> = { High: METICLE_COLORS.success, Moderate: METICLE_COLORS.warning, Low: METICLE_COLORS.danger }
  const bandCounts: Record<string, number> = { High: 0, Moderate: 0, Low: 0 }
  recentEntries.forEach((e: any) => { bandCounts[band(e.score)] += 1 })
  const pieData = Object.entries(bandCounts).filter(([, c]) => c > 0).map(([name, value]) => ({ name, value, fill: BAND_COLORS[name] }))

  const moodWeekStart = new Date()
  moodWeekStart.setDate(moodWeekStart.getDate() - ((moodWeekStart.getDay() + 6) % 7))
  moodWeekStart.setHours(0, 0, 0, 0)
  const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const moodThisWeek = entries.filter((e: any) => e.domain === 'mood' && new Date(e.recorded_date) >= moodWeekStart)
  const moodByDay = WEEK_DAYS.map((day, i) => {
    const dayEntries = moodThisWeek.filter((e: any) => (new Date(e.recorded_date).getDay() + 6) % 7 === i)
    const latest = dayEntries.sort((a: any, b: any) => new Date(b.recorded_date).getTime() - new Date(a.recorded_date).getTime())[0]
    return { day, score: latest ? latest.score : null }
  })
  const lowDayEntry = moodThisWeek.length > 0
    ? [...moodThisWeek].sort((a: any, b: any) => a.score - b.score || new Date(b.recorded_date).getTime() - new Date(a.recorded_date).getTime())[0]
    : null

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Mood chart</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Stack direction="row" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
            <Button size="small" onClick={() => setView('chart')}
              sx={{ textTransform: 'none', px: 1.5, fontWeight: 600, color: view === 'chart' ? METICLE_COLORS.primary : 'text.muted', bgcolor: view === 'chart' ? 'divider' : 'transparent' }}>
              Charts
            </Button>
            <Button size="small" onClick={() => setView('table')}
              sx={{ textTransform: 'none', px: 1.5, fontWeight: 600, color: view === 'table' ? METICLE_COLORS.primary : 'text.muted', bgcolor: view === 'table' ? 'divider' : 'transparent' }}>
              Table
            </Button>
          </Stack>
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => { setForm({ domain: 'mood', score: 7, recorded_date: localDate(), notes: '' }); setFormError(''); setAddOpen(true) }}
            sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none', px: 2 }}>Add entry</Button>
        </Stack>
      </Stack>

      {moodThisWeek.length > 0 && view !== 'table' && (
        <Stack spacing={2} sx={{ mb: 3 }}>
          <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle1" fontWeight={600}>Mood this week</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Evening check-ins · scored out of 10</Typography>
            <RechartsResponsiveContainer width="100%" height={220}>
              <BarChart data={moodByDay} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E3E9F0" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#5D6E85' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 12, fill: '#5D6E85' }} axisLine={false} tickLine={false} />
                <RechartsTooltip />
                <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={44}>
                  {moodByDay.map((d: any) => <Cell key={d.day} fill={d.score == null ? 'transparent' : scoreColor(d.score)} />)}
                </Bar>
              </BarChart>
            </RechartsResponsiveContainer>
          </Paper>
          {lowDayEntry?.notes && (
            <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>Notes behind the low day</Typography>
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: METICLE_COLORS.primary, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.8rem', flexShrink: 0 }}>
                  {(lowDayEntry.recorded_by_name || '?').split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{new Date(lowDayEntry.recorded_date).toLocaleDateString('en-GB', { weekday: 'long' })}: {lowDayEntry.notes.split('\n')[0].slice(0, 80)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {lowDayEntry.recorded_by_name ? `${lowDayEntry.recorded_by_name} · ` : ''}{new Date(lowDayEntry.recorded_date).toLocaleDateString('en-GB')}
                  </Typography>
                </Box>
                <Chip label={`${lowDayEntry.score}/10 · ${band(lowDayEntry.score)}`} size="small"
                  sx={{ bgcolor: `${scoreColor(lowDayEntry.score)}18`, color: scoreColor(lowDayEntry.score), fontWeight: 600, flexShrink: 0 }} />
              </Stack>
            </Paper>
          )}
        </Stack>
      )}
      {view !== 'table' && moodThisWeek.length > 0 && (
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Last 30 days</Typography>
      )}
      {view === 'table' ? (
        <Paper sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'notice.subtle.bg' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Domain</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Score</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentEntries.length === 0 ? (
                  <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>No entries in the last 30 days</TableCell></TableRow>
                ) : recentEntries.map((e: any) => (
                  <TableRow key={e.id} hover onClick={() => setViewEntry(e)} sx={{ cursor: 'pointer' }}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(e.recorded_date).toLocaleDateString('en-GB')}</TableCell>
                    <TableCell>
                      <Chip label={e.domain} size="small" sx={{ bgcolor: DOMAIN_COLORS[e.domain] || 'text.secondary', color: 'white', fontWeight: 600 }} />
                    </TableCell>
                    <TableCell>
                      <Chip label={`${e.score}/10`} size="small" sx={{ bgcolor: `${scoreColor(e.score)}20`, color: scoreColor(e.score), fontWeight: 600 }} />
                    </TableCell>
                    <TableCell><Typography variant="body2">{e.notes || '-'}</Typography></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      ) : entries.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Typography color="text.muted">No wellbeing data yet</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>Record mood, engagement, sleep and other wellbeing scores to see trends here.</Typography>
        </Paper>
      ) : Object.keys(grouped).length === 0 ? (
        <EmptyRow message="No entries in the last 30 days" />
      ) : (
        <Stack spacing={3}>
          <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', gap: 3 }}>
            <Box sx={{ position: 'relative', width: 220, height: 220, flexShrink: 0 }}>
              <RechartsResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={62} outerRadius={92} paddingAngle={3} strokeWidth={0}>
                    {pieData.map((s: any) => <Cell key={s.name} fill={s.fill} />)}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid', borderColor: 'divider', fontSize: 12 }}
                    formatter={(value: any, name: any) => [`${value} entries`, name]}
                  />
                </PieChart>
              </RechartsResponsiveContainer>
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <Typography sx={{ fontSize: 28, fontWeight: 600, color: METICLE_COLORS.primary, lineHeight: 1 }}>{recentEntries.length}</Typography>
                <Typography variant="caption" color="text.muted">entries · 30d</Typography>
              </Box>
            </Box>
            <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
                {Object.entries(BAND_COLORS).map(([name, color]) => (
                  <Box key={name} sx={{ px: 1.5, py: 1, borderRadius: 2, bgcolor: 'notice.subtle.bg', border: '1px solid', borderColor: 'divider', minWidth: 96 }}>
                    <Typography sx={{ fontWeight: 600, color, fontSize: 20, lineHeight: 1.2 }}>{bandCounts[name]}</Typography>
                    <Typography variant="caption" color="text.secondary">{name}</Typography>
                  </Box>
                ))}
              </Stack>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {pieData.map((s: any) => (
                  <Box key={s.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: 3, bgcolor: s.fill }} />
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{s.name}</Typography>
                  </Box>
                ))}
              </Box>
            </Stack>
          </Paper>

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>Recent entries</Typography>
            <Stack spacing={1}>
              {recentEntries.slice(0, 12).map((e: any) => (
                <Paper
                  key={e.id}
                  onClick={() => setViewEntry(e)}
                  sx={{
                    p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5,
                    '&:hover': { borderColor: METICLE_COLORS.primary, boxShadow: '0 2px 8px rgba(15,76,129,0.12)' },
                  }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${scoreColor(e.score)}18`, color: scoreColor(e.score), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 14, flexShrink: 0 }}>
                    {e.score}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>{e.domain}</Typography>
                      <Box sx={{ width: 8, height: 8, borderRadius: 4, bgcolor: scoreColor(e.score) }} />
                      <Typography variant="caption" color="text.muted">{band(e.score)}</Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: '100%' }}>{e.notes || 'No notes'}</Typography>
                  </Box>
                  <Typography variant="caption" color="text.muted" sx={{ flexShrink: 0 }}>{new Date(e.recorded_date).toLocaleDateString('en-GB')}</Typography>
                </Paper>
              ))}
            </Stack>
          </Box>
        </Stack>
      )}

      <Dialog open={!!viewEntry} onClose={() => setViewEntry(null)} maxWidth="sm" fullWidth>
        {viewEntry && (
          <>
            <DialogTitle sx={{ fontWeight: 600 }}>Wellbeing Entry</DialogTitle>
            <DialogContent>
              <Stack spacing={2.5}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Chip label={viewEntry.domain} size="small" sx={{ bgcolor: DOMAIN_COLORS[viewEntry.domain] || 'text.secondary', color: 'white', fontWeight: 600, textTransform: 'capitalize' }} />
                  <Chip label={`${viewEntry.score}/10`} size="small" sx={{ bgcolor: `${scoreColor(viewEntry.score)}20`, color: scoreColor(viewEntry.score), fontWeight: 600 }} />
                  <Chip label={band(viewEntry.score)} size="small" sx={{ bgcolor: `${BAND_COLORS[band(viewEntry.score)]}18`, color: BAND_COLORS[band(viewEntry.score)], fontWeight: 600 }} />
                </Stack>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.muted" sx={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0.5 }}>Recorded</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {new Date(viewEntry.recorded_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    {viewEntry.created_at && <Typography component="span" variant="caption" color="text.muted"> · {new Date(viewEntry.created_at).toLocaleString('en-GB')}</Typography>}
                  </Typography>
                </Stack>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.muted" sx={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0.5 }}>Notes</Typography>
                  <Typography variant="body2">{viewEntry.notes || 'No notes recorded.'}</Typography>
                </Stack>
                {viewEntry.created_by_name && (
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.muted" sx={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0.5 }}>Recorded by</Typography>
                    <Typography variant="body2">{viewEntry.created_by_name}</Typography>
                  </Stack>
                )}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 3 }}>
              <Button onClick={() => setViewEntry(null)} sx={{ textTransform: 'none' }}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={e => { e.preventDefault(); addMutation.mutate(form) }}>
          <DialogTitle sx={{ fontWeight: 600 }}>Add Wellbeing Entry</DialogTitle>
          <DialogContent>
            {formError && <Alert severity="error" sx={{ mb: 2, borderRadius: 1 }}>{formError}</Alert>}
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <TextField select label="Domain" fullWidth required value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}>
                {['mood', 'engagement', 'sleep', 'appetite', 'pain', 'mobility', 'social', 'overall'].map(d => (
                  <MenuItem key={d} value={d} sx={{ textTransform: 'capitalize' }}>{d}</MenuItem>
                ))}
              </TextField>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Score: <strong>{form.score}</strong>/10</Typography>
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
              sx={{ bgcolor: METICLE_COLORS.primary, textTransform: 'none' }}>
              {addMutation.isPending ? <CircularProgress size={20} /> : 'Save Entry'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  )
}

function summarizeAuditData(data: any): string {
  if (!data) return ''
  if (typeof data === 'string') return data
  let obj = data
  if (typeof obj === 'string') { try { obj = JSON.parse(obj) } catch { return data } }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return String(obj)
  const parts: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || v === '') continue
    let sv = typeof v === 'object' ? JSON.stringify(v) : String(v)
    if (sv.length > 40) sv = `${sv.slice(0, 40)}…`
    parts.push(`${k}: ${sv}`)
  }
  return parts.join(' · ')
}

const timeAgo = (iso: string): string => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (Number.isNaN(s) || s < 0) return ''
  if (s < 60) return 'Just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const auditIconFor = (action: string) => {
  if (action === 'login') return <LoginIcon sx={{ color: METICLE_COLORS.primary, fontSize: 20 }} />
  if (action === 'logout') return <LogoutIcon sx={{ color: METICLE_COLORS.primary, fontSize: 20 }} />
  if (action === 'create') return <AddIcon sx={{ color: METICLE_COLORS.success, fontSize: 20 }} />
  if (action === 'update') return <EditIcon sx={{ color: METICLE_COLORS.primary, fontSize: 20 }} />
  if (action === 'delete') return <DeleteIcon sx={{ color: METICLE_COLORS.danger, fontSize: 20 }} />
  if (action === 'download' || action === 'export') return <DownloadIcon sx={{ color: METICLE_COLORS.primary, fontSize: 20 }} />
  return <FileIcon sx={{ color: METICLE_COLORS.primary, fontSize: 20 }} />
}

function AuditTrailTabInline({ personId }: { personId: string }) {
  const [range, setRange] = useState('all')
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-trail', personId],
    queryFn: () => api.get('/audit/logs', { params: { person_id: personId } }).then(r => r.data),
  })
  if (isLoading) return <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', mt: 4 }} />
  if (!logs.length) return <EmptyRow message="No audit trail entries" />
  const cutoff = range === 'all' ? null : Date.now() - Number(range) * 24 * 60 * 60 * 1000
  const visible = cutoff == null ? logs : logs.filter((log: any) => log.created_at && new Date(log.created_at).getTime() >= cutoff)
  return (
    <Box>
      <SectionHeader title="Audit trail" subtitle="Who changed what, and when" action={
        <TextField select size="small" label="Period" value={range} onChange={e => setRange(e.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="all">Everything</MenuItem>
          <MenuItem value="7">Last 7 days</MenuItem>
          <MenuItem value="30">Last 30 days</MenuItem>
        </TextField>
      } />
      {visible.length === 0 ? (
        <EmptyRow message="No entries in this period" />
      ) : (
        <Stack spacing={1.5}>
          {visible.map((log: any) => {
            const newData = summarizeAuditData(log.new_data)
            const full = newData ? `${log.entity_type} — ${newData}` : `${log.entity_type} ${log.action}d`
            const verb = log.action === 'login' ? 'logged in' : log.action === 'logout' ? 'logged out' : `${log.action}d`
            return (
              <Paper key={log.id} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: 'notice.subtle.bg', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {auditIconFor(log.action)}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>{log.user_name || log.user_id} {verb}</Typography>
                    <Tooltip title={full}>
                      <Typography variant="caption" color="text.muted" noWrap sx={{ display: 'block' }}>
                        {timeAgo(log.created_at)}{full ? ` · ${full}` : ''}
                      </Typography>
                    </Tooltip>
                  </Box>
                </Stack>
              </Paper>
            )
          })}
        </Stack>
      )}
    </Box>
  )
}

/* ════════════════════════════════════════════════════════════════
   Billing & Rates Tab — view and edit client billing rates
   ════════════════════════════════════════════════════════════════ */
function BillingRatesTabInline({ personId, personName }: { personId: string; personName: string }) {
  const [packages, setPackages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [rateValue, setRateValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/homecare/packages')
      const all = Array.isArray(res.data) ? res.data : []
      setPackages(all.filter((p: any) => p.person_id === personId))
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [personId])

  const handleSave = async (packageId: string) => {
    setSaving(true); setError(''); setSuccess('')
    try {
      await api.patch(`/homecare/packages/${packageId}`, { client_rate_pence: Number(rateValue) || null })
      setSuccess('Client rate updated')
      setEditing(null)
      await load()
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to update rate')
    } finally { setSaving(false) }
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>

  return (
    <Box>
      <SectionHeader title="Billing & rates" subtitle={`Client billing rates for ${personName}`} />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {packages.length === 0 ? (
        <Paper elevation={0} sx={{ p: 6, textAlign: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Typography sx={{ color: 'text.secondary', mb: 1 }}>No care packages found</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Create a homecare package for this client first</Typography>
        </Paper>
      ) : (
        <Stack gap={2}>
          {packages.map((pkg: any) => (
            <Paper key={pkg.id} elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={2}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{pkg.name}</Typography>
                  <Stack direction="row" gap={1} sx={{ mt: 0.5 }}>
                    <Chip label={pkg.status} size="small" sx={{ bgcolor: pkg.status === 'active' ? '#EAFBF5' : '#F4F9FC', color: pkg.status === 'active' ? METICLE_COLORS.successText : 'text.secondary', fontWeight: 600 }} />
                    <Chip label={pkg.funding_type || 'private'} size="small" sx={{ bgcolor: 'notice.info.bg', color: 'notice.info.fg', fontWeight: 600 }} />
                  </Stack>
                </Box>

                <Stack direction="row" gap={3} alignItems="center" flexWrap="wrap">
                  {/* Carer rate */}
                  <Box sx={{ textAlign: 'center', minWidth: 100 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>Carer rate</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: METICLE_COLORS.primary }}>
                      {pkg.hourly_rate_pence != null ? `£${(Number(pkg.hourly_rate_pence) / 100).toFixed(2)}/hr` : '—'}
                    </Typography>
                  </Box>

                  {/* Client rate — editable */}
                  <Box sx={{ textAlign: 'center', minWidth: 120 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>Client rate (billable)</Typography>
                    {editing === pkg.id ? (
                      <Stack direction="row" alignItems="center" gap={1}>
                        <TextField
                          size="small"
                          type="number"
                          placeholder="pence/hr"
                          value={rateValue}
                          onChange={e => setRateValue(e.target.value)}
                          InputProps={{ startAdornment: <InputAdornment position="start">£</InputAdornment>, endAdornment: <InputAdornment position="end">/hr</InputAdornment> }}
                          sx={{ width: 140 }}
                        />
                        <Button size="small" variant="contained" onClick={() => handleSave(pkg.id)} disabled={saving} sx={{ textTransform: 'none', minWidth: 0 }}>
                          {saving ? <CircularProgress size={16} /> : 'Save'}
                        </Button>
                        <Button size="small" onClick={() => setEditing(null)} sx={{ textTransform: 'none', minWidth: 0 }}>Cancel</Button>
                      </Stack>
                    ) : (
                      <Stack direction="row" alignItems="center" gap={0.5}>
                        <Typography variant="body1" sx={{ fontWeight: 600, color: pkg.client_rate_pence != null ? METICLE_COLORS.success : METICLE_COLORS.warning }}>
                          {pkg.client_rate_pence != null ? `£${(Number(pkg.client_rate_pence) / 100).toFixed(2)}/hr` : 'Not set'}
                        </Typography>
                        <IconButton size="small" onClick={() => { setEditing(pkg.id); setRateValue(pkg.client_rate_pence != null ? String(Number(pkg.client_rate_pence) / 100) : '') }} sx={{ color: METICLE_COLORS.primary }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    )}
                  </Box>

                  {/* Mileage rate */}
                  <Box sx={{ textAlign: 'center', minWidth: 100 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>Mileage</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: '#8B7CF6' }}>
                      {pkg.mileage_rate_pence != null ? `${Number(pkg.mileage_rate_pence).toFixed(1)}p/mi` : 'Org default'}
                    </Typography>
                  </Box>
                </Stack>
              </Stack>

              {pkg.client_rate_pence == null && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Client rate not configured. Set it above to enable client billing for this package.
                </Alert>
              )}
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  )
}
