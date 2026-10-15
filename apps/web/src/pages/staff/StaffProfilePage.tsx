import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Box, Typography, Paper, Stack, Chip, CircularProgress,
  Button, LinearProgress, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow,
  TextField, Grid, Avatar, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions, TablePagination, Autocomplete,
  FormControl, Select, MenuItem, InputLabel, IconButton,
  Tabs, Tab, Divider, ToggleButton, ToggleButtonGroup,
} from '@mui/material'
import {
  Edit as EditIcon, Save as SaveIcon,
  UploadFile as UploadFileIcon, Link as LinkIcon, Close as CloseIcon,
  Add as AddIcon, Person as PersonIcon, Verified as VerifiedIcon,
  AssignmentTurnedIn as AssignmentTurnedInIcon, Security as SecurityIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { fetchUserPermissions, updateUserPermissions, formatPermissionLabel, LEVEL_LABELS, type PermissionLevel, type RolePermissionDefaults } from '../../utils/permissions'
import { formatDateOnly } from '../../utils/dateFormat'
import { LoadingState, StatusBadge, EmptyRow, NAVY } from '../../components/ui'
import { EmptyState } from '../../components/design/EmptyState'
// The record-link contract: the parameter this page reads and the tab slug a
// compliance email links to. Both come from `@meticle/shared` so the sender and this
// reader cannot disagree about either.
import { MICA_RECORD_PARAMS, MICA_STAFF_COMPLIANCE_TAB } from '@meticle/shared'

type BadgeTone = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary' | 'purple'

const ROLE_LABEL: Record<string, string> = {
  ORG_ADMIN: 'Org Admin',
  MANAGER: 'Manager',
  CARE_WORKER: 'Care Worker',
  COMPLIANCE_OFFICER: 'Compliance Officer',
}

const ROLE_TONE: Record<string, BadgeTone> = {
  ORG_ADMIN: 'primary',
  MANAGER: 'info',
  CARE_WORKER: 'neutral',
  COMPLIANCE_OFFICER: 'purple',
}

const ROLE_OPTIONS = [
  { value: 'MANAGER', label: 'Manager' },
  { value: 'CARE_WORKER', label: 'Care Worker' },
  { value: 'COMPLIANCE_OFFICER', label: 'Compliance Officer' },
  { value: 'ORG_ADMIN', label: 'Org Admin', adminOnly: true },
]

const EMPLOYMENT_TYPES = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'agency', label: 'Agency' },
  { value: 'bank', label: 'Bank' },
  { value: 'relief', label: 'Relief' },
]

const STATUS_TONE: Record<string, BadgeTone> = {
  active: 'success',
  pending: 'warning',
  inactive: 'neutral',
  deactivated: 'error',
}

const REQ_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  complete: { label: 'Complete', tone: 'success' },
  pending_review: { label: 'Pending review', tone: 'warning' },
  incomplete: { label: 'Incomplete', tone: 'neutral' },
  expired: { label: 'Expired', tone: 'error' },
}

const REQ_GROUP_ORDER = ['complete', 'pending_review', 'incomplete', 'expired']

const TAB_OVERVIEW = 'overview'
// The compliance tab's slug *is* the contract's own (`MICA_STAFF_COMPLIANCE_TAB`):
// a document-expiry or training-expiry email links to
// `/staff/<id>?tab=compliance&record=<recordId>`, so the slug the sender writes and
// the slug this page answers to have to be one string.
const TAB_COMPLIANCE = MICA_STAFF_COMPLIANCE_TAB
const TAB_COMPETENCY = 'competency'
const TAB_ACCESS = 'access'

/** Every tab this page will answer a `?tab=` link with. */
const TAB_IDS: string[] = [TAB_OVERVIEW, TAB_COMPLIANCE, TAB_COMPETENCY, TAB_ACCESS]

export default function StaffProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState(TAB_OVERVIEW)
  const [editOpen, setEditOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  // The compliance record a row — or a link — has opened, and the row it came from
  // (kept highlighted after the dialog closes, so the reader can see which record the
  // email was about).
  const [detailRequirement, setDetailRequirement] = useState<any>(null)
  const [highlightedRecordId, setHighlightedRecordId] = useState<string | null>(null)

  const userStr = localStorage.getItem('user')
  let currentUser: any = {}
  try { currentUser = userStr ? JSON.parse(userStr) : {} } catch { currentUser = {} }
  const canEdit = currentUser.role === 'ORG_ADMIN' || currentUser.role === 'MANAGER'
  const isOrgAdmin = currentUser.role === 'ORG_ADMIN'
  const isSelf = currentUser.id === userId

  const { data: memberData, isLoading: memberLoading } = useQuery({
    queryKey: ['org-member', userId],
    queryFn: async () => {
      const res = await api.get('/staff/org-members')
      const admins = res.data.admins?.length ? res.data.admins : (res.data.admin ? [res.data.admin] : [])
      const all = [...admins, ...(res.data.staff || [])].filter(Boolean)
      return all.find((m: any) => m.id === userId)
    },
  })

  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useQuery({
    queryKey: ['staff-profile', userId],
    queryFn: async () => {
      const res = await api.get(`/staff/${userId}`)
      return res.data
    },
    enabled: !!userId,
  })

  const { data: complianceData, isLoading: complianceLoading } = useQuery({
    queryKey: ['staff-compliance', userId],
    queryFn: async () => {
      const res = await api.get(`/staff/${userId}/compliance`)
      return res.data
    },
    enabled: !!userId,
  })

  const { data: competencyRecords } = useQuery({
    queryKey: ['competency-staff', userId, memberData?.staff_id],
    queryFn: async () => {
      const staffId = memberData?.staff_id || userId
      const res = await api.get(`/competency/assessments?staffId=${staffId}`)
      return res.data
    },
    enabled: !!userId && !!memberData,
  })

  // The tab and the record a link names.
  //
  // `/staff/<id>?tab=compliance&record=<recordId>` is what a compliance email hands
  // the manager it is about — the document that is expiring, the training that has
  // lapsed — and it is the same link a notification or a colleague passes on. Both
  // halves are read here and nowhere else.
  //
  // Read into state rather than derived from the URL, because this page's tabs *are*
  // state: a click does not rewrite the URL, so both effects are keyed on the
  // parameter and a later click is never fought by it.
  const requestedTab = searchParams.get('tab')
  useEffect(() => {
    if (!requestedTab || !TAB_IDS.includes(requestedTab)) return
    // A tab the reader may not see is a tab this page does not have.
    if (requestedTab === TAB_ACCESS && !canEdit) return
    setTab(requestedTab)
  }, [requestedTab, canEdit])


  const { data: competencyTemplates } = useQuery({
    queryKey: ['competency-templates'],
    queryFn: async () => {
      const res = await api.get('/competency/templates')
      return res.data
    }
  })

  const { data: orgMembers } = useQuery({
    queryKey: ['org-members-full'],
    queryFn: async () => {
      const res = await api.get('/staff/org-members')
      return res.data as any
    }
  })
  const members: any[] = [
    ...(orgMembers?.admins?.length ? orgMembers.admins : (orgMembers?.admin ? [orgMembers.admin] : [])),
    ...(orgMembers?.staff || [])
  ].filter((m: any) => m.status === 'active')

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const res = await api.get('/leave/locations')
      return res.data
    },
  })

  const { data: organizationSettings } = useQuery({
    queryKey: ['organisation-settings'],
    queryFn: () => api.get('/settings/org').then(res => res.data),
  })
  const effectiveServiceTypes: string[] = organizationSettings?.primary_service_type
    ? [organizationSettings.primary_service_type]
    : (Array.isArray(organizationSettings?.service_types) ? organizationSettings.service_types : [])
  const isDomiciliaryOrganisation = effectiveServiceTypes.some(type => ['domiciliary', 'live_in'].includes(type))
  const { data: payProfiles = [], isLoading: payProfilesLoading, error: payProfilesError } = useQuery({
    queryKey: ['homecare-pay-profiles'],
    queryFn: () => api.get('/homecare/pay-profiles').then(res => Array.isArray(res.data) ? res.data : []),
    enabled: canEdit && isDomiciliaryOrganisation,
  })
  const activePayProfiles = payProfiles.filter((pay: any) => pay.is_active !== false)
  const [payProfileId, setPayProfileId] = useState('')
  useEffect(() => { if (profile) setPayProfileId(profile.pay_profile_id || '') }, [profile])
  const payProfileMutation = useMutation({
    mutationFn: (pay_profile_id: string | null) => api.patch(`/staff/${userId}/pay-profile`, { pay_profile_id }),
    onSuccess: () => { refetchProfile(); setSaved(true); setTimeout(() => setSaved(false), 3000) },
  })

  const [compPage, setCompPage] = useState(0)
  const [compRowsPerPage] = useState(10)

  // The record a link names — below the competency page state on purpose, because the
  // effect's own dependency list reads `compRowsPerPage`, and a dependency list is
  // evaluated during render rather than after it.
  //
  // One id opens one record, once: the queries behind this page refresh as the role
  // and compliance profile change, and a re-render must not re-open a dialog the
  // reader has closed.
  const linkedRecordId = searchParams.get(MICA_RECORD_PARAMS['staff-compliance'])
  const openedLinkedRecordRef = useRef<string | null>(null)
  useEffect(() => {
    if (!linkedRecordId || openedLinkedRecordRef.current === linkedRecordId) return

    const requirements = Array.isArray(complianceData?.requirements) ? complianceData.requirements : []
    const requirement = requirements.find((r: any) => r.id === linkedRecordId)
    if (requirement) {
      openedLinkedRecordRef.current = linkedRecordId
      setTab(TAB_COMPLIANCE)
      setDetailRequirement(requirement)
      setHighlightedRecordId(linkedRecordId)
      return
    }

    // A competency assessment is the other record this page shows, and the
    // competency-due email names one. It opens on its own tab, because a record opened
    // on a tab that does not list it would be a link to nothing — and on the page of
    // the table that holds it, since that table is paginated.
    const assessments = Array.isArray(competencyRecords) ? competencyRecords : []
    const index = assessments.findIndex((a: any) => a.id === linkedRecordId)
    if (index === -1) return
    openedLinkedRecordRef.current = linkedRecordId
    setTab(TAB_COMPETENCY)
    setHighlightedRecordId(linkedRecordId)
    setCompPage(Math.floor(index / compRowsPerPage))
  }, [linkedRecordId, complianceData, competencyRecords, compRowsPerPage])
  const [assessOpen, setAssessOpen] = useState(false)
  const [assessForm, setAssessForm] = useState({ template_id: '', passed: true, assessed_at: new Date().toISOString().split('T')[0], reassessment_date: '', assessor_id: '', involved_parties: '', notes: '' })
  const [assessError, setAssessError] = useState('')

  const assessMutation = useMutation({
    mutationFn: async () => {
      const staffId = memberData?.staff_id || userId
      await api.post('/competency/assessments', {
        template_id: assessForm.template_id,
        staff_id: staffId,
        passed: assessForm.passed,
        assessed_at: assessForm.assessed_at,
        reassessment_date: assessForm.reassessment_date || undefined,
        assessor_id: assessForm.assessor_id || undefined,
        involved_parties: assessForm.involved_parties || undefined,
        notes: assessForm.notes
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competency-staff'] })
      queryClient.invalidateQueries({ queryKey: ['competency-pending'] })
      setAssessOpen(false)
      setAssessForm({ template_id: '', passed: true, assessed_at: new Date().toISOString().split('T')[0], reassessment_date: '', assessor_id: '', involved_parties: '', notes: '' })
      setAssessError('')
    },
    onError: (err: any) => {
      setAssessError(err.response?.data?.message || err.message || 'Failed to save assessment')
    }
  })

  const [editFields, setEditFields] = useState<any>({})
  const [editError, setEditError] = useState('')

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.patch(`/staff/${userId}/profile`, data),
    onSuccess: () => {
      refetchProfile()
      setSaved(true)
      setEditError('')
      setEditOpen(false)
      setTimeout(() => setSaved(false), 3000)
      queryClient.invalidateQueries({ queryKey: ['org-members'] })
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to save profile.'
      setEditError(msg)
    },
  })

  const startEditing = () => {
    setEditFields({
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      phone: profile?.phone || '',
      address: profile?.address || '',
      city: profile?.city || '',
      country: profile?.country || '',
      postal_code: profile?.postal_code || '',
      birth_date: profile?.birth_date || '',
      location_id: profile?.location_id || '',
      employment_type: profile?.employment_type || 'full_time',
      contracted_hours_weekly: profile?.contracted_hours_weekly || 37.5,
      max_hours_weekly: profile?.max_hours_weekly || '',
    })
    setEditError('')
    setEditOpen(true)
  }

  const handleSave = () => {
    updateMutation.mutate(editFields)
  }

  const [editReqOpen, setEditReqOpen] = useState(false)
  const [editingRequirement, setEditingRequirement] = useState<any>(null)

  const handleEditRequirement = (req: any) => {
    setEditingRequirement(req)
    setEditReqOpen(true)
  }

  /**
   * The record behind a row: read-only.
   *
   * The update form is the only thing on this page that may change a compliance
   * record, and it stays behind its own button — so opening a record, by click or by
   * link, can never change one.
   */
  const openRequirementDetail = (req: any) => {
    setHighlightedRecordId(req.id)
    setDetailRequirement(req)
  }

  /**
   * Closing drops the `record` parameter and keeps `tab`.
   *
   * The link has been followed by then: leaving the id in the URL would re-open the
   * dialog on a reload, and would make Back from the next page arrive somewhere the
   * reader had already left. The tab is where the reader is, so it stays.
   */
  const closeRequirementDetail = () => {
    setDetailRequirement(null)
    if (!searchParams.get(MICA_RECORD_PARAMS['staff-compliance'])) return
    const next = new URLSearchParams(searchParams)
    next.delete(MICA_RECORD_PARAMS['staff-compliance'])
    setSearchParams(next, { replace: true })
  }

  const [permData, setPermData] = useState<Array<{ module: string; permission_level: PermissionLevel }>>([])
  const [rolePermissionDefaults, setRolePermissionDefaults] = useState<RolePermissionDefaults>({})
  const permDataRef = useRef(permData)
  useEffect(() => { permDataRef.current = permData }, [permData])
  const [permDirty, setPermDirty] = useState(false)
  const [permSaved, setPermSaved] = useState(false)

  const { data: permissionsData, isLoading: permLoading } = useQuery({
    queryKey: ['user-permissions', userId],
    queryFn: () => fetchUserPermissions(userId!),
    enabled: !!userId && canEdit,
  })

  useEffect(() => {
    if (permissionsData) {
      setPermData(permissionsData.permissions)
      setRolePermissionDefaults(permissionsData.role_defaults || {})
    }
  }, [permissionsData])

  const permSaveMutation = useMutation({
    mutationFn: () => updateUserPermissions(userId!, permDataRef.current),
    onSuccess: () => {
      setPermDirty(false)
      setPermSaved(true)
      setTimeout(() => setPermSaved(false), 3000)
    },
  })

  const [changeRoleValue, setChangeRoleValue] = useState('')
  const [roleSaved, setRoleSaved] = useState(false)

  const changeRoleMutation = useMutation({
    mutationFn: (role: string) => api.patch(`/staff/${userId}/role`, { role }),
    onSuccess: (_result, newRole) => {
      setRoleSaved(true)
      setChangeRoleValue(newRole)
      setTimeout(() => setRoleSaved(false), 3000)
      queryClient.invalidateQueries({ queryKey: ['org-members'] })
      queryClient.invalidateQueries({ queryKey: ['org-member', userId] })
      queryClient.invalidateQueries({ queryKey: ['user-permissions', userId] })
      queryClient.invalidateQueries({ queryKey: ['staff-compliance', userId] })
    },
  })

  const loading = memberLoading || complianceLoading || profileLoading

  if (loading) {
    return <LoadingState label="Loading staff profile..." />
  }

  if (!memberData && !complianceData) {
    return (
      <Box>

        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 2 }}>
          <Typography color="#5D6E85">Staff member not found.</Typography>
        </Paper>
      </Box>
    )
  }

  const m = memberData || {}
  const c = complianceData || { compliance_rate: 0, total_requirements: 0, completed: 0, requirements: [] }
  const complianceColor = c.compliance_rate >= 80 ? '#10B981' : c.compliance_rate >= 50 ? '#F59E0B' : '#EF4444'
  const locationName = (locations || []).find((l: any) => l.id === (profile?.location_id || m.location_id))?.name || '—'
  const employmentLabel = EMPLOYMENT_TYPES.find(et => et.value === (profile?.employment_type || m.employment_type))?.label || (profile?.employment_type || '—')

  const passedCount = (competencyRecords || []).filter((a: any) => a.passed).length
  const totalAssessments = competencyRecords?.length || 0

  const statusTone: BadgeTone = STATUS_TONE[m.status] || 'neutral'
  const effectiveRole = permissionsData?.role || m.role || ''
  const roleTone: BadgeTone = ROLE_TONE[effectiveRole] || 'neutral'
  // The record the detail dialog has open, and the label its status carries.
  const detailStatus = detailRequirement ? REQ_STATUS[detailRequirement.status] : undefined

  const tabs = [
    { id: TAB_OVERVIEW, label: 'Overview', icon: <PersonIcon /> },
    { id: TAB_COMPLIANCE, label: 'Compliance', icon: <VerifiedIcon /> },
    { id: TAB_COMPETENCY, label: 'Competency', icon: <AssignmentTurnedInIcon /> },
    ...(canEdit ? [{ id: TAB_ACCESS, label: 'Access', icon: <SecurityIcon /> }] : []),
  ]

  return (
    <Box>
      {saved && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaved(false)}>Profile updated successfully.</Alert>}

      <Paper sx={{ borderRadius: 2, overflow: 'hidden', mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ p: 3.5, alignItems: { xs: 'flex-start', sm: 'center' } }}>
          <Avatar
            src={profile?.profile_picture_url || ''}
            sx={{ width: 72, height: 72, bgcolor: NAVY, fontSize: '1.75rem', fontWeight: 600 }}
          >
            {(profile?.first_name?.[0] || m.first_name?.[0] || m.email?.[0] || '?').toUpperCase()}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', color: NAVY, textTransform: 'none', mb: 0.5 }}>
              Staff profile
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }} sx={{ mb: 0.5 }}>
              <Typography variant="h5" sx={{ fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                {profile?.first_name || m.first_name || ''} {profile?.last_name || m.last_name || ''}
              </Typography>
              <Stack direction="row" spacing={1}>
                <StatusBadge label={ROLE_LABEL[effectiveRole] || effectiveRole || '—'} tone={roleTone} />
                {m.status && m.status !== 'active' && <StatusBadge label={m.status} tone={statusTone} />}
              </Stack>
            </Stack>
            <Typography variant="body2" color="text.secondary">{m.email}</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
              {employmentLabel !== '—' && (
                <Chip label={employmentLabel} size="small" variant="outlined" sx={{ height: 22, fontSize: 12 }} />
              )}
              {locationName !== '—' && (
                <Chip label={locationName} size="small" variant="outlined" sx={{ height: 22, fontSize: 12 }} />
              )}
            </Stack>
          </Box>
          {canEdit && (
            <Box sx={{ flexShrink: 0 }}>
              <Button variant="outlined" startIcon={<EditIcon />} onClick={startEditing}>
                Edit profile
              </Button>
            </Box>
          )}
        </Stack>
        <Divider sx={{ borderColor: '#F7FAFE' }} />
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ p: 2 }}>
          <Box sx={{ flex: 1, px: { sm: 2 }, py: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 600, color: complianceColor, lineHeight: 1.1 }}>{c.compliance_rate}%</Typography>
            <Typography variant="caption" color="text.secondary">Compliance</Typography>
            <Box sx={{ mt: 0.75, maxWidth: 180 }}>
              <LinearProgress
                variant="determinate"
                value={c.compliance_rate}
                sx={{ height: 6, borderRadius: 3, bgcolor: 'notice.muted.bg', '& .MuiLinearProgress-bar': { bgcolor: complianceColor } }}
              />
            </Box>
          </Box>
          <Box sx={{ flex: 1, px: { sm: 2 }, py: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 600, color: NAVY, lineHeight: 1.1 }}>{c.completed}<Box component="span" sx={{ color: 'text.secondary', fontSize: '1rem', fontWeight: 600 }}>/{c.total_requirements}</Box></Typography>
            <Typography variant="caption" color="text.secondary">Requirements met</Typography>
          </Box>
          <Box sx={{ flex: 1, px: { sm: 2 }, py: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 600, color: NAVY, lineHeight: 1.1 }}>{passedCount}<Box component="span" sx={{ color: 'text.secondary', fontSize: '1rem', fontWeight: 600 }}>/{totalAssessments}</Box></Typography>
            <Typography variant="caption" color="text.secondary">Competency passed</Typography>
          </Box>
        </Stack>
      </Paper>

      <Paper sx={{ borderRadius: 2, overflow: 'hidden', mb: 3 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          TabIndicatorProps={{ sx: { bgcolor: NAVY, height: 3 } }}
        >
          {tabs.map(t => (
            <Tab key={t.id} value={t.id} label={t.label} icon={t.icon} iconPosition="start" sx={{ fontWeight: 600, textTransform: 'none', color: 'text.secondary', '&.Mui-selected': { color: NAVY } }} />
          ))}
        </Tabs>
      </Paper>

      {tab === TAB_OVERVIEW && (
        profile ? (
          <Paper sx={{ p: 3.5, borderRadius: 2 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', color: NAVY, textTransform: 'none', mb: 2.5 }}>
              Profile details
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Phone</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{profile.phone || '—'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Date of birth</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatDateOnly(profile.birth_date)}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Address</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{[profile.address, profile.city, profile.country, profile.postal_code].filter(Boolean).join(', ') || '—'}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary">Work location</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{locationName}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary">Employment type</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{employmentLabel}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary">Contracted hours / week</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{profile.contracted_hours_weekly ? `${profile.contracted_hours_weekly}h` : '—'}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary">Weekly max hours</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{profile.max_hours_weekly ? `${profile.max_hours_weekly}h` : '—'}</Typography>
              </Grid>
              {canEdit && isDomiciliaryOrganisation && <Grid item xs={12} sm={6}>
                {payProfilesError && <Alert severity="error" sx={{ mb: 1 }}>Could not load carer pay profiles. Please retry or check your access.</Alert>}
                <TextField select fullWidth size="small" label="Carer pay profile" value={payProfileId} onChange={e => setPayProfileId(e.target.value)} disabled={payProfilesLoading || Boolean(payProfilesError)} helperText={payProfilesLoading ? 'Loading available pay profiles…' : activePayProfiles.length === 0 ? 'No active pay profiles are available. Create or reactivate one to assign a rate.' : 'Used when a call does not have its own pay override.'}>
                  <MenuItem value="">No profile assigned</MenuItem>
                  {activePayProfiles.map((pay: any) => <MenuItem key={pay.id} value={pay.id}>{pay.name} · £{(Number(pay.hourly_rate_pence) / 100).toFixed(2)}/hr</MenuItem>)}
                </TextField>
                {activePayProfiles.length === 0 && !payProfilesLoading && !payProfilesError && <Button size="small" variant="text" sx={{ mt: 0.5 }} onClick={() => navigate('/mileage?tab=profiles')}>Manage pay profiles</Button>}
                <Button size="small" variant="outlined" sx={{ mt: 1, ml: activePayProfiles.length === 0 ? 1 : 0 }} disabled={payProfilesLoading || Boolean(payProfilesError) || payProfileMutation.isPending} onClick={() => payProfileMutation.mutate(payProfileId || null)}>Save pay profile</Button>
              </Grid>}
            </Grid>
          </Paper>
        ) : (
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: '18px' }}>
            <EmptyState title="No profile details" description="Profile information will appear here once recorded" variant="default" />
          </Paper>
        )
      )}

      {tab === TAB_COMPLIANCE && (
        <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ px: 3.5, py: 2.5, borderBottom: '1px solid #F7FAFE' }}>
            <Typography sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', color: NAVY, textTransform: 'none', mb: 0.5 }}>
              Compliance
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {c.completed} of {c.total_requirements} requirements met · {c.compliance_rate}% complete
            </Typography>
          </Box>
          {c.requirements?.length === 0 ? (
            <Box sx={{ p: 3.5 }}>
              <EmptyRow message="No compliance requirements configured yet." />
            </Box>
          ) : (
            <Box sx={{ px: 3.5, py: 1 }}>
              {REQ_GROUP_ORDER.map(key => {
                const items = (c.requirements || []).filter((r: any) => r.status === key)
                if (items.length === 0) return null
                const meta = REQ_STATUS[key]
                return (
                  <Box key={key}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ pt: 2, pb: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                        {meta.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">({items.length})</Typography>
                    </Stack>
                    {items.map((req: any) => (
                      <Box
                        key={req.id}
                        onClick={() => openRequirementDetail(req)}
                        sx={{
                          py: 1.75,
                          borderTop: '1px solid #F4F9FC',
                          cursor: 'pointer',
                          bgcolor: highlightedRecordId === req.id ? 'notice.subtle.bg' : 'transparent',
                          '&:hover': { bgcolor: 'notice.subtle.bg' },
                        }}
                      >
                        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.5}>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{req.name}</Typography>
                            {req.description && (
                              <Typography variant="caption" color="text.secondary">{req.description}</Typography>
                            )}
                          </Box>
                          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flexShrink: 0 }}>
                            <Box sx={{ textAlign: 'right' }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                {req.last_checked_at ? `Checked ${new Date(req.last_checked_at).toLocaleDateString()}` : 'Never checked'}
                              </Typography>
                              {req.expires_at && (
                                <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, color: req.status === 'expired' || (req.status !== 'complete' && isExpiringSoon(req.expires_at)) ? '#EF4444' : 'text.secondary' }}>
                                  {req.status === 'expired' ? `Expired ${formatDate(req.expires_at)}` : `Expires ${formatDate(req.expires_at)}`}
                                </Typography>
                              )}
                            </Box>
                            <StatusBadge label={meta.label} tone={meta.tone} />
                            {canEdit && (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={(e) => { e.stopPropagation(); handleEditRequirement(req) }}
                              >
                                Update
                              </Button>
                            )}
                          </Stack>
                        </Stack>
                      </Box>
                    ))}
                  </Box>
                )
              })}
            </Box>
          )}
        </Paper>
      )}

      {tab === TAB_COMPETENCY && (
        <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ px: 3.5, py: 2.5, borderBottom: '1px solid #F7FAFE' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', color: NAVY, textTransform: 'none', mb: 0.5 }}>
                  Competency
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {totalAssessments === 0 ? 'No assessments recorded yet.' : `${passedCount} of ${totalAssessments} assessments passed.`}
                </Typography>
              </Box>
              {canEdit && (
                <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setAssessOpen(true)} sx={{ bgcolor: NAVY, '&:hover': { bgcolor: '#014FB5' } }}>
                  New assessment
                </Button>
              )}
            </Stack>
          </Box>
          {(!competencyRecords || competencyRecords.length === 0) ? (
            <Box sx={{ p: 3.5 }}>
              <EmptyRow
                message="No competency assessments found."
                action={canEdit ? <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setAssessOpen(true)}>Record the first assessment</Button> : undefined}
              />
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ '& th': { bgcolor: 'notice.subtle.bg', fontWeight: 600, color: 'text.secondary', fontSize: 12, textTransform: 'none', letterSpacing: '0.04em' } }}>
                      <TableCell>Assessment</TableCell>
                      <TableCell>Assessor</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Result</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {competencyRecords.slice(compPage * compRowsPerPage, compPage * compRowsPerPage + compRowsPerPage).map((a: any) => (
                      <TableRow
                        key={a.id}
                        sx={{
                          bgcolor: highlightedRecordId === a.id ? 'notice.subtle.bg' : undefined,
                          '&:hover': { bgcolor: 'notice.subtle.bg' },
                        }}
                      >
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.template_name}</Typography>
                          {a.template_category && <Typography variant="caption" color="text.secondary">{a.template_category}</Typography>}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{[a.assessor_first_name, a.assessor_last_name].filter(Boolean).join(' ') || '—'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">{a.assessed_at ? new Date(a.assessed_at).toLocaleDateString() : '—'}</Typography>
                        </TableCell>
                        <TableCell>
                          <StatusBadge label={a.passed ? 'Passed' : 'Failed'} tone={a.passed ? 'success' : 'error'} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={totalAssessments}
                page={compPage}
                onPageChange={(_, p) => setCompPage(p)}
                rowsPerPage={compRowsPerPage}
                rowsPerPageOptions={[10]}
              />
            </>
          )}
        </Paper>
      )}

      {tab === TAB_ACCESS && canEdit && (
        <Box>
          <Paper sx={{ borderRadius: 2, mb: 3 }}>
            <Box sx={{ px: 3.5, py: 2.5, borderBottom: '1px solid #F7FAFE' }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', color: NAVY, textTransform: 'none', mb: 0.5 }}>
                Role
              </Typography>
              <Typography variant="body2" color="text.secondary">Role changes update default permissions and the compliance profile automatically.</Typography>
            </Box>
            <Box sx={{ px: 3.5, py: 2.5 }}>
              {roleSaved && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setRoleSaved(false)}>Role updated.</Alert>}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'flex-end' }}>
                <FormControl size="small" sx={{ minWidth: 220, flex: 1 }}>
                  <InputLabel>Role</InputLabel>
                  <Select
                    value={changeRoleValue || effectiveRole || 'CARE_WORKER'}
                    label="Role"
                    disabled={!isOrgAdmin || isSelf}
                    onChange={(e) => {
                      const nextRole = e.target.value
                      setChangeRoleValue(nextRole)
                      const roleDefaults = rolePermissionDefaults[nextRole]
                      if (roleDefaults) {
                        setPermData(current => current.map(permission => ({
                          ...permission,
                          permission_level: roleDefaults[permission.module] || 'none',
                        })))
                        // The role endpoint persists these defaults when Save role is pressed.
                        setPermDirty(false)
                      }
                    }}
                  >
                    {ROLE_OPTIONS.filter(o => !o.adminOnly || isOrgAdmin).map(opt => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  disabled={!isOrgAdmin || isSelf || changeRoleMutation.isPending || !changeRoleValue || changeRoleValue === effectiveRole}
                  onClick={() => changeRoleMutation.mutate(changeRoleValue || effectiveRole)}
                  sx={{ bgcolor: NAVY, '&:hover': { bgcolor: '#014FB5' } }}
                >
                  {changeRoleMutation.isPending ? 'Saving...' : 'Save role'}
                </Button>
              </Stack>
              {isOrgAdmin && !isSelf && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                  Choose a role to preview its organisation-specific module access, then save the role to apply those defaults.
                </Typography>
              )}
              {!isOrgAdmin && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                  Only organization admins can change roles.
                </Typography>
              )}
              {isSelf && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                  Role changes are disabled for your own account.
                </Typography>
              )}
            </Box>
          </Paper>

          <Paper sx={{ borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
            <Box sx={{ px: 3.5, py: 2.5, borderBottom: '1px solid #F7FAFE' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', color: NAVY, textTransform: 'none', mb: 0.5 }}>
                    Module permissions
                  </Typography>
                  <Typography variant="body2" color="text.secondary">Choose what this member can access in each module.</Typography>
                </Box>
                {permSaved && <Alert severity="success" sx={{ py: 0, px: 1.5 }} onClose={() => setPermSaved(false)}>Permissions updated.</Alert>}
              </Stack>
            </Box>
            {permLoading ? (
              <Box sx={{ textAlign: 'center', py: 5 }}><CircularProgress size={24} sx={{ color: NAVY }} /></Box>
            ) : (
              <Box sx={{ px: 3.5, py: 1.5 }}>
                {Array.from(new Map(permData.map(p => [p.module, p])).values()).map((p) => (
                  <Stack key={p.module} direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ py: 1.25, borderBottom: '1px solid #F4F9FC' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatPermissionLabel(p.module)}</Typography>
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={p.permission_level}
                      onChange={(_, v) => {
                        if (v) {
                          setPermData(prev => prev.map(x => x.module === p.module ? { ...x, permission_level: v } : x))
                          setPermDirty(true)
                        }
                      }}
                    >
                      {Object.entries(LEVEL_LABELS).map(([key, label]) => (
                        <ToggleButton key={key} value={key} disabled={changeRoleMutation.isPending} sx={{ textTransform: 'none', fontSize: 12, py: 0.5 }}>
                          {label}
                        </ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  </Stack>
                ))}
              </Box>
            )}
            {permDirty && (
              <Box sx={{ position: 'sticky', bottom: 0, bgcolor: 'white', p: 2, borderTop: '1px solid #F7FAFE' }}>
                <Button variant="contained" startIcon={<SaveIcon />} onClick={() => permSaveMutation.mutate()} disabled={permSaveMutation.isPending} fullWidth
                  sx={{ bgcolor: NAVY, '&:hover': { bgcolor: '#014FB5' } }}>
                  {permSaveMutation.isPending ? 'Saving...' : 'Save permissions'}
                </Button>
              </Box>
            )}
          </Paper>
        </Box>
      )}

      <Dialog open={editOpen} onClose={() => { setEditOpen(false); setEditError('') }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Edit profile</DialogTitle>
        <DialogContent>
          {editError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setEditError('')}>{editError}</Alert>}
          <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField label="First name" fullWidth size="small" value={editFields.first_name} onChange={(e) => setEditFields((p: any) => ({ ...p, first_name: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Last name" fullWidth size="small" value={editFields.last_name} onChange={(e) => setEditFields((p: any) => ({ ...p, last_name: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Phone" fullWidth size="small" value={editFields.phone} onChange={(e) => setEditFields((p: any) => ({ ...p, phone: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Date of birth" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }} value={editFields.birth_date || ''} onChange={(e) => setEditFields((p: any) => ({ ...p, birth_date: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Address" fullWidth size="small" value={editFields.address} onChange={(e) => setEditFields((p: any) => ({ ...p, address: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="City" fullWidth size="small" value={editFields.city} onChange={(e) => setEditFields((p: any) => ({ ...p, city: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Country" fullWidth size="small" value={editFields.country} onChange={(e) => setEditFields((p: any) => ({ ...p, country: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Postal code" fullWidth size="small" value={editFields.postal_code} onChange={(e) => setEditFields((p: any) => ({ ...p, postal_code: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Work location</InputLabel>
                <Select value={editFields.location_id || ''} label="Work location" onChange={(e) => setEditFields((p: any) => ({ ...p, location_id: e.target.value }))}>
                  <MenuItem value=""><em>None</em></MenuItem>
                  {(locations || []).map((loc: any) => (
                    <MenuItem key={loc.id} value={loc.id}>{loc.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Employment type</InputLabel>
                <Select value={editFields.employment_type || 'full_time'} label="Employment type" onChange={(e) => setEditFields((p: any) => ({ ...p, employment_type: e.target.value }))}>
                  {EMPLOYMENT_TYPES.map(et => (
                    <MenuItem key={et.value} value={et.value}>{et.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Weekly contracted hours" type="number" fullWidth size="small" value={editFields.contracted_hours_weekly} onChange={(e) => setEditFields((p: any) => ({ ...p, contracted_hours_weekly: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Weekly max hours (visa restriction)" type="number" fullWidth size="small" value={editFields.max_hours_weekly} onChange={(e) => setEditFields((p: any) => ({ ...p, max_hours_weekly: e.target.value }))} helperText="Leave blank to use contracted hours" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => { setEditOpen(false); setEditError('') }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={updateMutation.isPending} sx={{ bgcolor: NAVY, '&:hover': { bgcolor: '#014FB5' } }}>
            {updateMutation.isPending ? 'Saving...' : 'Save changes'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={assessOpen} onClose={() => { setAssessOpen(false); setAssessError('') }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>New competency assessment</DialogTitle>
        <DialogContent>
          {assessError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setAssessError('')}>{assessError}</Alert>}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2">
              <strong>Staff:</strong> {profile?.first_name || memberData?.first_name || ''} {profile?.last_name || memberData?.last_name || ''}
            </Typography>
            <TextField label="Assessment template" select required value={assessForm.template_id}
              onChange={e => setAssessForm(p => ({ ...p, template_id: e.target.value }))}>
              <MenuItem value="">Select template...</MenuItem>
              {(competencyTemplates || []).map((t: any) => (
                <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
              ))}
            </TextField>
            <TextField label="Result" select value={assessForm.passed ? 'pass' : 'fail'}
              onChange={e => setAssessForm(p => ({ ...p, passed: e.target.value === 'pass' }))}>
              <MenuItem value="pass">Pass</MenuItem>
              <MenuItem value="fail">Fail</MenuItem>
            </TextField>
            <TextField label="Assessment date" type="date" required value={assessForm.assessed_at}
              InputLabelProps={{ shrink: true }}
              onChange={e => setAssessForm(p => ({ ...p, assessed_at: e.target.value }))} />
            <Autocomplete
              options={members}
              getOptionLabel={(o: any) => `${o.first_name || ''} ${o.last_name || ''}`.trim() || o.email}
              value={members.find((m: any) => m.id === assessForm.assessor_id || m.staff_id === assessForm.assessor_id) || null}
              onChange={(_, v) => setAssessForm(p => ({ ...p, assessor_id: v?.id || '' }))}
              renderInput={(params) => <TextField {...params} label="Assessor (who carried out assessment)" />}
            />
            <TextField label="Others involved" placeholder="Names of other staff/assessors present"
              value={assessForm.involved_parties}
              onChange={e => setAssessForm(p => ({ ...p, involved_parties: e.target.value }))} />
            <TextField label="Reassessment date" type="date" value={assessForm.reassessment_date}
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: new Date().toISOString().split('T')[0] }}
              onChange={e => setAssessForm(p => ({ ...p, reassessment_date: e.target.value }))} />
            <TextField label="Notes" multiline rows={3} value={assessForm.notes}
              onChange={e => setAssessForm(p => ({ ...p, notes: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAssessOpen(false); setAssessError('') }}>Cancel</Button>
          <Button variant="contained" onClick={() => assessMutation.mutate()} disabled={assessMutation.isPending || !assessForm.template_id || !assessForm.assessed_at} sx={{ bgcolor: NAVY, '&:hover': { bgcolor: '#014FB5' } }}>
            {assessMutation.isPending ? <CircularProgress size={20} color="inherit" /> : 'Save assessment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* The record behind a row, and behind a link: `?record=<id>` opens this same
          dialog, which is what makes the link in a document-expiry or training-expiry
          email a link to the record rather than to the staff member's page. */}
      <Dialog open={Boolean(detailRequirement)} onClose={closeRequirementDetail} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>
          {detailRequirement?.name || 'Compliance record'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {detailRequirement?.description && (
              <Typography variant="body2" color="text.secondary">{detailRequirement.description}</Typography>
            )}
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
              {detailStatus && <StatusBadge label={detailStatus.label} tone={detailStatus.tone} />}
              <Typography variant="caption" color="text.secondary">
                {detailRequirement?.last_checked_at
                  ? `Checked ${new Date(detailRequirement.last_checked_at).toLocaleDateString()}`
                  : 'Never checked'}
              </Typography>
            </Stack>
            {detailRequirement?.expires_at && (
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  color: detailRequirement.status === 'expired' ? '#EF4444' : 'text.primary',
                }}
              >
                {detailRequirement.status === 'expired'
                  ? `Expired ${formatDate(detailRequirement.expires_at)}`
                  : `Expires ${formatDate(detailRequirement.expires_at)}`}
              </Typography>
            )}
            {detailRequirement?.notes && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Notes</Typography>
                <Typography variant="body2">{detailRequirement.notes}</Typography>
              </Box>
            )}
            {detailRequirement?.file_url && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Uploaded document
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<OpenInNewIcon />}
                  href={detailRequirement.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open document
                </Button>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          {canEdit && (
            <Button
              onClick={() => {
                const requirement = detailRequirement
                closeRequirementDetail()
                if (requirement) handleEditRequirement(requirement)
              }}
            >
              Update
            </Button>
          )}
          <Button
            variant="contained"
            onClick={closeRequirementDetail}
            sx={{ bgcolor: NAVY, '&:hover': { bgcolor: '#014FB5' } }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <EditRequirementDialog
        open={editReqOpen}
        requirement={editingRequirement}
        onClose={() => { setEditReqOpen(false); setEditingRequirement(null) }}
        onSaved={() => { refetchProfile(); queryClient.invalidateQueries({ queryKey: ['staff-compliance', userId] }) }}
      />
    </Box>
  )
}

function isExpiringSoon(expiresAt: string): boolean {
  const days = (new Date(expiresAt).getTime() - Date.now()) / 86400000
  return days >= 0 && days <= 30
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString()
  } catch {
    return value
  }
}

function EditRequirementDialog({ open, requirement, onClose, onSaved }: {
  open: boolean; requirement: any; onClose: () => void; onSaved: () => void
}) {
  const [status, setStatus] = useState('incomplete')
  const [notes, setNotes] = useState('')
  const [issuedAt, setIssuedAt] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [error, setError] = useState('')
  const fileUploadRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (requirement) {
      setStatus(requirement.status || 'incomplete')
      setNotes(requirement.notes || '')
      setFileUrl(requirement.file_url || '')
      setIssuedAt(requirement.issued_at ? new Date(requirement.issued_at).toISOString().split('T')[0] : '')
      setExpiresAt(requirement.expires_at ? new Date(requirement.expires_at).toISOString().split('T')[0] : '')
      setError('')
    }
  }, [requirement])

  const handleSave = async () => {
    if (!requirement) return
    setSaving(true)
    setError('')
    try {
      await api.patch(`/settings/compliance-records/${requirement.id}`, {
        status,
        notes,
        issued_at: issuedAt || null,
        expires_at: expiresAt || null,
      })
      onSaved()
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update requirement')
    } finally {
      setSaving(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !requirement) return
    setUploadingFile(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post(`/settings/compliance-records/${requirement.id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setFileUrl(res.data.file_url)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload file')
    } finally {
      setUploadingFile(false)
      if (fileUploadRef.current) fileUploadRef.current.value = ''
    }
  }

  const handleRemoveFile = async () => {
    if (!requirement) return
    setSaving(true)
    try {
      await api.patch(`/settings/compliance-records/${requirement.id}`, { file_url: null })
      setFileUrl('')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to remove file')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>Update compliance requirement</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>{requirement?.name}</Typography>
        {requirement?.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{requirement.description}</Typography>
        )}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select value={status} label="Status" onChange={(e) => setStatus(e.target.value)}>
              <MenuItem value="incomplete">Incomplete</MenuItem>
              <MenuItem value="complete">Complete</MenuItem>
              <MenuItem value="expired">Expired</MenuItem>
              <MenuItem value="pending_review">Pending Review</MenuItem>
            </Select>
          </FormControl>
          <TextField label="Issued date" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }}
            value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
          <TextField label="Expiry date" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }}
            inputProps={{ min: new Date().toISOString().split('T')[0] }}
            value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          <TextField label="Notes" multiline rows={3} fullWidth size="small" value={notes}
            onChange={(e) => setNotes(e.target.value)} />
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Uploaded document</Typography>
            {fileUrl ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <LinkIcon fontSize="small" />
                <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: NAVY, fontWeight: 600 }}>
                  {fileUrl.split('/').pop()}
                </a>
                <IconButton size="small" color="error" onClick={handleRemoveFile} disabled={saving}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>
            ) : (
              <Typography variant="body2" color="#5D6E85">No file uploaded</Typography>
            )}
            <Button component="label" variant="outlined" size="small" startIcon={<UploadFileIcon />} sx={{ mt: 1 }} disabled={uploadingFile}>
              {uploadingFile ? 'Uploading...' : 'Upload file'}
              <input type="file" hidden ref={fileUploadRef} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleFileUpload} />
            </Button>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}
          sx={{ bgcolor: NAVY, '&:hover': { bgcolor: '#014FB5' } }}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
