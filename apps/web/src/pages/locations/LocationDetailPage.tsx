import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Typography, Paper, Stack, Chip, CircularProgress,
  Button, Grid, Alert, Tabs, Tab, Divider, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, FormControl, InputLabel,
  Select, MenuItem, IconButton, TablePagination,
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon, Business as BuildingIcon,
  WarningAmber as WarningAmberIcon, Add as AddIcon, Edit as EditIcon,
  Delete as DeleteIcon, Badge as BadgeIcon, Verified as VerifiedIcon,
  UploadFile as UploadFileIcon, OpenInNew as OpenInNewIcon,
  Download as DownloadIcon, Close as CloseIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { LoadingState, StatusBadge, NAVY } from '../../components/ui'

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

const EMPLOYMENT_LABEL: Record<string, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  agency: 'Agency',
  bank: 'Bank',
  relief: 'Relief',
}

const TAB_OVERVIEW = 'overview'
const TAB_HEALTH_SAFETY = 'health-safety'
const TAB_STAFF = 'staff'
const TAB_CERTIFICATES = 'certificates'

const SERVICE_TYPE_LABEL: Record<string, string> = {
  supported_living: 'Supported Living',
  residential: 'Residential',
  domiciliary: 'Domiciliary',
}

const CQC_LABEL: Record<string, string> = {
  outstanding: 'Outstanding',
  good: 'Good',
  requires_improvement: 'Requires Improvement',
  inadequate: 'Inadequate',
}

const CQC_TONE: Record<string, BadgeTone> = {
  outstanding: 'success',
  good: 'info',
  requires_improvement: 'warning',
  inadequate: 'error',
}

const HEALTH_SAFETY_CERT_TYPES = [
  { value: 'gas_safety', label: 'Gas Safety Certificate' },
  { value: 'electrical_safety', label: 'Electrical Safety (EICR)' },
  { value: 'fire_risk_assessment', label: 'Fire Risk Assessment' },
  { value: 'fire_alarm_system', label: 'Fire Alarm System Maintenance' },
  { value: 'fire_extinguisher', label: 'Fire Extinguisher Service' },
  { value: 'emergency_lighting', label: 'Emergency Lighting Test' },
  { value: 'food_hygiene', label: 'Food Hygiene Rating' },
  { value: 'legionella', label: 'Legionella Risk Assessment' },
  { value: 'water_safety', label: 'Water Hygiene / Safety' },
  { value: 'lifting_equipment', label: 'LOLER (Lifting Equipment)' },
  { value: 'pat_testing', label: 'Portable Appliance Testing' },
  { value: 'asbestos', label: 'Asbestos Management Survey' },
  { value: 'building_safety', label: 'Building Safety Case' },
  { value: 'health_safety_policy', label: 'Health & Safety Policy' },
  { value: 'risk_assessment', label: 'General Risk Assessment' },
]

const CERT_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  HEALTH_SAFETY_CERT_TYPES.map(t => [t.value, t.label])
)

const EMPTY_CERT_FORM = { name: '', certificate_type: 'gas_safety', issuing_body: '', certificate_number: '', issue_date: '', expiry_date: '', status: 'valid', notes: '', file_url: '', file_name: '' }

const fmtDate = (v: any) => {
  if (!v) return '—'
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  const d = new Date(v)
  if (isNaN(d.getTime())) return v
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function LocationDetailPage() {
  const { locationId } = useParams<{ locationId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState(TAB_OVERVIEW)
  const [certDialogOpen, setCertDialogOpen] = useState(false)
  const [editCert, setEditCert] = useState<any>(null)
  const [certForm, setCertForm] = useState<any>(EMPTY_CERT_FORM)
  const [certError, setCertError] = useState('')
  const [staffPage, setStaffPage] = useState(0)
  const [locDialogOpen, setLocDialogOpen] = useState(false)
  const [locForm, setLocForm] = useState<any>({})
  const [locSaving, setLocSaving] = useState(false)
  const [locError, setLocError] = useState('')
  const [certUploading, setCertUploading] = useState(false)
  const certFileInputRef = useRef<HTMLInputElement>(null)
  const [filePreview, setFilePreview] = useState<{ url: string; name: string; type: string } | null>(null)
  const [fileError, setFileError] = useState('')

  const userStr = localStorage.getItem('user')
  let currentUser: any = {}
  try { currentUser = userStr ? JSON.parse(userStr) : {} } catch { currentUser = {} }
  const isOrgAdmin = currentUser.role === 'ORG_ADMIN'
  const isManager = currentUser.role === 'MANAGER'
  const canEdit = isOrgAdmin || isManager

  const { data: locations, isLoading: locationsLoading } = useQuery({
    queryKey: ['settings-locations'],
    queryFn: async () => {
      const res = await api.get('/settings/locations')
      return res.data as any[]
    },
  })
  const location = locations?.find((l: any) => l.id === locationId)

  const { data: staff, isLoading: staffLoading } = useQuery({
    queryKey: ['settings-staff'],
    queryFn: async () => {
      const res = await api.get('/settings/staff')
      return res.data as any[]
    },
  })
  const locationStaff = (staff || []).filter((s: any) => s.location_id === locationId)

  const { data: certificates, isLoading: certsLoading } = useQuery({
    queryKey: ['location-certificates', locationId],
    queryFn: async () => {
      const res = await api.get(`/settings/locations/${locationId}/certificates`)
      return res.data as any[]
    },
    enabled: !!locationId,
  })

  const certMutation = useMutation({
    mutationFn: async () => {
      if (editCert) {
        await api.put(`/settings/locations/${locationId}/certificates/${editCert.id}`, certForm)
      } else {
        await api.post(`/settings/locations/${locationId}/certificates`, certForm)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-certificates'] })
      setCertDialogOpen(false)
      setCertError('')
    },
    onError: (err: any) => {
      setCertError(err.response?.data?.message || err.message || 'Failed to save certificate')
    },
  })

  const deleteCertMutation = useMutation({
    mutationFn: async (certId: string) => {
      await api.delete(`/settings/locations/${locationId}/certificates/${certId}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['location-certificates'] }),
  })

  const openAddCert = () => {
    setEditCert(null)
    setCertForm(EMPTY_CERT_FORM)
    setCertError('')
    setCertDialogOpen(true)
  }

  const openEditCert = (cert: any) => {
    setEditCert(cert)
    setCertForm({
      name: cert.name,
      certificate_type: cert.certificate_type,
      issuing_body: cert.issuing_body || '',
      certificate_number: cert.certificate_number || '',
      issue_date: cert.issue_date || '',
      expiry_date: cert.expiry_date || '',
      status: cert.status,
      notes: cert.notes || '',
      file_url: cert.file_url || '',
      file_name: cert.file_name || '',
    })
    setCertError('')
    setCertDialogOpen(true)
  }

  const openEditLocation = () => {
    setLocForm({
      id: location.id, name: location.name, address: location.address || '',
      manager_id: location.manager_id || '', minimum_staff_per_day: location.minimum_staff_per_day ?? 1,
      min_day_staff: location.min_day_staff ?? '', min_night_staff: location.min_night_staff ?? '', min_sleep_staff: location.min_sleep_staff ?? '',
      service_type: location.service_type || '', service_capacity: location.service_capacity ?? '',
      phone: location.phone || '', email: location.email || '', food_hygiene_rating: location.food_hygiene_rating ?? '',
      cqc_rating: location.cqc_rating || '', last_cqc_inspection: location.last_cqc_inspection || '',
    })
    setLocError('')
    setLocDialogOpen(true)
  }

  const saveLocation = async () => {
    setLocSaving(true)
    try {
      const payload: any = { ...locForm }
      const nullify = (v: any) => (v === '' || v === null || v === undefined ? null : v)
      payload.manager_id = nullify(payload.manager_id)
      payload.min_day_staff = nullify(payload.min_day_staff)
      payload.min_night_staff = nullify(payload.min_night_staff)
      payload.min_sleep_staff = nullify(payload.min_sleep_staff)
      payload.service_type = nullify(payload.service_type)
      payload.service_capacity = payload.service_capacity === '' ? null : Number(payload.service_capacity)
      payload.phone = nullify(payload.phone)
      payload.email = nullify(payload.email)
      payload.food_hygiene_rating = payload.food_hygiene_rating === '' ? null : Number(payload.food_hygiene_rating)
      payload.cqc_rating = nullify(payload.cqc_rating)
      payload.last_cqc_inspection = nullify(payload.last_cqc_inspection)
      delete payload.id
      await api.put(`/settings/locations/${locationId}`, payload)
      queryClient.invalidateQueries({ queryKey: ['settings-locations'] })
      setLocDialogOpen(false)
    } catch (err: any) {
      setLocError(err.response?.data?.message || 'Failed to save location')
    } finally {
      setLocSaving(false)
    }
  }

  const uploadCertFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCertUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post('/settings/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setCertForm((p: any) => ({ ...p, file_url: res.data.url, file_name: res.data.originalName || file.name }))
    } catch (err: any) {
      setCertError(err.response?.data?.message || err.message || 'Failed to upload file')
    } finally {
      setCertUploading(false)
      e.target.value = ''
    }
  }

  const openCertFile = async (url: string, name?: string) => {
    setFileError('')
    try {
      const token = localStorage.getItem('accessToken')
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const contentType = res.headers.get('content-type') || ''
      const blob = await res.blob()
      setFilePreview({ url: URL.createObjectURL(blob), name: name || url.split('/').pop() || 'File', type: contentType })
    } catch {
      setFileError('Could not open this file — it may have been removed from the server.')
    }
  }

  const loading = locationsLoading

  if (loading) {
    return <LoadingState label="Loading location..." />
  }

  if (!location) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/locations')} sx={{ mb: 2, color: NAVY, fontWeight: 700 }}>Back to Locations</Button>
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 2 }}>
          <Typography color="#9CA3AF">Location not found.</Typography>
        </Paper>
      </Box>
    )
  }

  const staffCount = locationStaff.length
  const noManager = !location.manager_id

  const staffingRows = [
    { label: 'Minimum staff / day', value: location.minimum_staff_per_day ?? '—' },
    { label: 'Min day staff', value: location.min_day_staff ?? '—' },
    { label: 'Min night staff', value: location.min_night_staff ?? '—' },
    { label: 'Min sleep staff', value: location.min_sleep_staff ?? '—' },
  ]

  const tabs = [
    { id: TAB_OVERVIEW, label: 'Overview', icon: <BuildingIcon /> },
    { id: TAB_HEALTH_SAFETY, label: 'Health & Safety', icon: <WarningAmberIcon /> },
    { id: TAB_STAFF, label: 'Staff', icon: <BadgeIcon /> },
    { id: TAB_CERTIFICATES, label: 'Certificates', icon: <VerifiedIcon /> },
  ]

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/locations')} sx={{ mb: 2.5, color: NAVY, fontWeight: 700 }}>
        Back to Locations
      </Button>

      <Paper sx={{ borderRadius: 2, overflow: 'hidden', mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ p: 3.5, alignItems: { xs: 'flex-start', sm: 'center' } }}>
          <Box sx={{ width: 72, height: 72, borderRadius: 2, bgcolor: '#0F4C8110', color: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BuildingIcon sx={{ fontSize: 36 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: NAVY, textTransform: 'uppercase', mb: 0.5 }}>
              Location
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }} sx={{ mb: 0.5 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                {location.name}
              </Typography>
              {noManager && <StatusBadge label="No manager" tone="warning" />}
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
              {location.manager_first_name ? (
                <Chip label={`Manager: ${location.manager_first_name} ${location.manager_last_name}`} size="small" variant="outlined" sx={{ height: 22, fontSize: 12 }} />
              ) : (
                <Chip label="No manager assigned" size="small" variant="outlined" sx={{ height: 22, fontSize: 12, color: '#B45309', borderColor: '#F59E0B' }} />
              )}
              <Chip label={`${staffCount} staff`} size="small" variant="outlined" sx={{ height: 22, fontSize: 12 }} />
            </Stack>
          </Box>
          {isOrgAdmin && (
            <Box sx={{ flexShrink: 0 }}>
                <Button variant="outlined" startIcon={<EditIcon />} onClick={openEditLocation}>
                Edit location
              </Button>
            </Box>
          )}
        </Stack>
        <Divider sx={{ borderColor: '#F1F5F9' }} />
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ p: 2 }}>
          <Box sx={{ flex: 1, px: { sm: 2 }, py: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 900, color: NAVY, lineHeight: 1.1 }}>{staffCount}</Typography>
            <Typography variant="caption" color="text.secondary">Staff assigned</Typography>
          </Box>
          <Box sx={{ flex: 1, px: { sm: 2 }, py: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 900, color: NAVY, lineHeight: 1.1 }}>{certificates?.length ?? 0}</Typography>
            <Typography variant="caption" color="text.secondary">Certificates</Typography>
          </Box>
          <Box sx={{ flex: 1, px: { sm: 2 }, py: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 900, color: noManager ? '#D97706' : '#16A34A', lineHeight: 1.1 }}>
              {noManager ? '—' : 'Assigned'}
            </Typography>
            <Typography variant="caption" color="text.secondary">Manager</Typography>
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
            <Tab key={t.id} value={t.id} label={t.label} icon={t.icon} iconPosition="start" sx={{ fontWeight: 700, textTransform: 'none', color: 'text.secondary', '&.Mui-selected': { color: NAVY } }} />
          ))}
        </Tabs>
      </Paper>

      {noManager && tab === TAB_OVERVIEW && (
        <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 3 }}>
          This location has no manager assigned. Every location should have a MANAGER so cover, leave approvals and medication escalations are reviewed. Org admins are notified automatically.
        </Alert>
      )}

      {tab === TAB_OVERVIEW && (
        <Paper sx={{ p: 3.5, borderRadius: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: NAVY, textTransform: 'uppercase' }}>
              Location details
            </Typography>
            {isOrgAdmin && (
              <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={openEditLocation} sx={{ color: NAVY, borderColor: NAVY }}>
                Edit
              </Button>
            )}
          </Stack>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">Address</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{location.address || '—'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">Manager</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, color: noManager ? '#B45309' : 'inherit' }}>
                {location.manager_first_name ? `${location.manager_first_name} ${location.manager_last_name}` : 'No manager assigned'}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">Manager email</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{location.manager_email || '—'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="text.secondary">Service Type</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{location.service_type ? SERVICE_TYPE_LABEL[location.service_type] || location.service_type : '—'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="text.secondary">Service Capacity</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{location.service_capacity ?? '—'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="text.secondary">Phone</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{location.phone || '—'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="text.secondary">Email</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{location.email || '—'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="text.secondary">CQC Rating</Typography>
              <Box sx={{ mt: 0.25 }}>
                {location.cqc_rating ? (
                  <StatusBadge label={CQC_LABEL[location.cqc_rating] || location.cqc_rating} tone={CQC_TONE[location.cqc_rating] || 'neutral'} />
                ) : (
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>—</Typography>
                )}
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="text.secondary">Food Hygiene Rating</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, color: location.food_hygiene_rating === null || location.food_hygiene_rating === undefined ? 'inherit' : location.food_hygiene_rating >= 3 ? '#16A34A' : location.food_hygiene_rating === 2 ? '#D97706' : '#DC2626' }}>
                {location.food_hygiene_rating === null || location.food_hygiene_rating === undefined ? '—' : `${location.food_hygiene_rating} / 5`}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="text.secondary">Last CQC Inspection</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{fmtDate(location.last_cqc_inspection)}</Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">Certificates</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{certificates?.length ?? 0} on file</Typography>
            </Grid>
            {staffingRows.map(row => (
              <Grid item xs={12} sm={6} md={3} key={row.label}>
                <Typography variant="caption" color="text.secondary">{row.label}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.value}</Typography>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {tab === TAB_HEALTH_SAFETY && (() => {
        const certs = certificates || []
        const now = new Date()
        const expired = certs.filter(c => c.expiry_date && new Date(c.expiry_date) < now)
        const expiring = certs.filter(c => c.expiry_date && new Date(c.expiry_date) >= now && new Date(c.expiry_date) < new Date(Date.now() + 30 * 86400000))
        const food = location.food_hygiene_rating
        const issues: string[] = []
        if (location.cqc_rating === 'inadequate') issues.push('CQC rating is Inadequate')
        if (food !== null && food !== undefined && food < 2) issues.push(`Food hygiene rating is ${food} / 5`)
        if (expired.length > 0) issues.push(`${expired.length} certificate${expired.length > 1 ? 's' : ''} expired`)
        const noCqcOnFile = !location.cqc_rating && !food && certs.length === 0
        return (
          <Stack spacing={3}>
            {issues.length > 0 ? (
              <Alert severity="error" icon={<WarningAmberIcon />}>
                Health & Safety concerns: {issues.join('; ')}. Review the certificates tab and regulator ratings.
              </Alert>
            ) : noCqcOnFile ? (
              <Alert severity="info">
                No health & safety records on file yet. Add regulator ratings on the overview and certificates to track compliance.
              </Alert>
            ) : (
              <Alert severity="success">No health & safety concerns. All recorded ratings and certificates are within tolerance.</Alert>
            )}
            {fileError && <Alert severity="error" sx={{ mb: 0 }} onClose={() => setFileError('')}>{fileError}</Alert>}
            <Paper sx={{ p: 3.5, borderRadius: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: NAVY, textTransform: 'uppercase' }}>
                  Regulator & hygiene
                </Typography>
                {isOrgAdmin && (
                  <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={openEditLocation} sx={{ color: NAVY, borderColor: NAVY }}>
                    Edit
                  </Button>
                )}
              </Stack>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">CQC Rating</Typography>
                  <Box sx={{ mt: 0.25 }}>
                    {location.cqc_rating ? (
                      <StatusBadge label={CQC_LABEL[location.cqc_rating] || location.cqc_rating} tone={CQC_TONE[location.cqc_rating] || 'neutral'} />
                    ) : (
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>Not recorded</Typography>
                    )}
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Food Hygiene Rating</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: food === null || food === undefined ? 'inherit' : food >= 3 ? '#16A34A' : food === 2 ? '#D97706' : '#DC2626' }}>
                    {food === null || food === undefined ? 'Not recorded' : `${food} / 5`}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Last CQC Inspection</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{fmtDate(location.last_cqc_inspection)}</Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Certificates</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{certs.length} on file</Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Expired</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: expired.length > 0 ? '#DC2626' : '#16A34A' }}>{expired.length}</Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Expiring (30 days)</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: expiring.length > 0 ? '#D97706' : 'inherit' }}>{expiring.length}</Typography>
                </Grid>
              </Grid>
            </Paper>
            {certs.length > 0 && (
              <Button size="small" startIcon={<VerifiedIcon />} onClick={() => setTab(TAB_CERTIFICATES)} sx={{ color: NAVY, fontWeight: 700, alignSelf: 'flex-start', textTransform: 'none' }}>
                View all {certs.length} certificates
              </Button>
            )}
          </Stack>
        )
      })()}

      {tab === TAB_STAFF && (
        <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
          {staffLoading ? (
            <Box sx={{ p: 6, textAlign: 'center' }}><CircularProgress /></Box>
          ) : locationStaff.length === 0 ? (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <Typography color="#9CA3AF">No staff assigned to this location yet.</Typography>
              <Button variant="outlined" sx={{ mt: 2, color: NAVY, borderColor: NAVY }} onClick={() => navigate('/staff')}>
                Go to Staff Directory
              </Button>
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Employment</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Contracted Hours</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {locationStaff.slice(staffPage * 10, staffPage * 10 + 10).map(s => (
                      <TableRow key={s.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/staff/${s.id}`)}>
                        <TableCell sx={{ fontWeight: 600 }}>{[s.first_name, s.last_name].filter(Boolean).join(' ') || s.email}</TableCell>
                        <TableCell>{s.email}</TableCell>
                        <TableCell><StatusBadge label={ROLE_LABEL[s.role] || s.role || '—'} tone={ROLE_TONE[s.role] || 'neutral'} /></TableCell>
                        <TableCell>{EMPLOYMENT_LABEL[s.employment_type] || s.employment_type || '—'}</TableCell>
                        <TableCell>{s.contracted_hours_weekly ? `${s.contracted_hours_weekly}h` : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {locationStaff.length > 10 && (
                <TablePagination component="div" count={locationStaff.length} page={staffPage} onPageChange={(_, p) => setStaffPage(p)}
                  rowsPerPage={10} rowsPerPageOptions={[10]} />
              )}
            </>
          )}
        </Paper>
      )}

      {tab === TAB_CERTIFICATES && (
        <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2.5, pb: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Location Certificates</Typography>
            {canEdit && (
              <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openAddCert} sx={{ bgcolor: NAVY, '&:hover': { bgcolor: '#0A3A5C' } }}>
                Add Certificate
              </Button>
            )}
          </Stack>
          {fileError && <Alert severity="error" sx={{ mx: 2.5 }} onClose={() => setFileError('')}>{fileError}</Alert>}
          {certsLoading ? (
            <Box sx={{ p: 6, textAlign: 'center' }}><CircularProgress /></Box>
          ) : !certificates || certificates.length === 0 ? (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <Typography color="#9CA3AF">No certificates for this location</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Issuing Body</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Certificate #</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Expiry Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>File</TableCell>
                    {canEdit && <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {certificates.map(cert => {
                    const expired = cert.expiry_date && new Date(cert.expiry_date) < new Date()
                    const expiringSoon = cert.expiry_date && new Date(cert.expiry_date) < new Date(Date.now() + 30 * 86400000)
                    return (
                      <TableRow key={cert.id} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{cert.name}</TableCell>
                        <TableCell>{CERT_TYPE_LABEL[cert.certificate_type] || cert.certificate_type}</TableCell>
                        <TableCell>{cert.issuing_body || '—'}</TableCell>
                        <TableCell>{cert.certificate_number || '—'}</TableCell>
                        <TableCell sx={{ color: expired ? '#DC2626' : expiringSoon ? '#D97706' : 'inherit', fontWeight: expired ? 700 : 400 }}>
                          {fmtDate(cert.expiry_date)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={cert.status.replace('_', ' ')}
                            size="small"
                            color={cert.status === 'valid' ? 'success' : cert.status === 'expiring_soon' ? 'warning' : cert.status === 'expired' ? 'error' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          {cert.file_url ? (
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <Typography variant="caption" noWrap sx={{ maxWidth: 140 }}>{cert.file_name || cert.file_url.split('/').pop()}</Typography>
                              <IconButton size="small" title="Open file" onClick={() => openCertFile(cert.file_url, cert.file_name || cert.name)}><OpenInNewIcon fontSize="small" /></IconButton>
                            </Stack>
                          ) : (
                            <Typography variant="caption" color="#9CA3AF">—</Typography>
                          )}
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <IconButton size="small" onClick={() => openEditCert(cert)}><EditIcon fontSize="small" /></IconButton>
                            <IconButton size="small" color="error" onClick={() => deleteCertMutation.mutate(cert.id)}><DeleteIcon fontSize="small" /></IconButton>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      <Dialog open={certDialogOpen} onClose={() => setCertDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{editCert ? 'Edit Certificate' : 'Add Certificate'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {certError && <Alert severity="error">{certError}</Alert>}
            <Stack direction="row" spacing={2}>
              <TextField label="Name" size="small" fullWidth value={certForm.name} onChange={e => setCertForm((p: any) => ({ ...p, name: e.target.value }))} />
              <FormControl size="small" fullWidth>
                <InputLabel>Certificate Type</InputLabel>
                <Select label="Certificate Type" value={certForm.certificate_type || ''} onChange={e => setCertForm((p: any) => ({ ...p, certificate_type: e.target.value }))}>
                  {HEALTH_SAFETY_CERT_TYPES.map(t => (
                    <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField label="Issuing Body" size="small" fullWidth value={certForm.issuing_body} onChange={e => setCertForm((p: any) => ({ ...p, issuing_body: e.target.value }))} />
              <TextField label="Certificate #" size="small" fullWidth value={certForm.certificate_number} onChange={e => setCertForm((p: any) => ({ ...p, certificate_number: e.target.value }))} />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField label="Issue Date" type="date" size="small" fullWidth value={certForm.issue_date} onChange={e => setCertForm((p: any) => ({ ...p, issue_date: e.target.value }))} InputLabelProps={{ shrink: true }} />
              <TextField label="Expiry Date" type="date" size="small" fullWidth value={certForm.expiry_date} onChange={e => setCertForm((p: any) => ({ ...p, expiry_date: e.target.value }))} InputLabelProps={{ shrink: true }} />
            </Stack>
            <Stack direction="row" spacing={2} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Status</InputLabel>
                <Select value={certForm.status} label="Status" onChange={e => setCertForm((p: any) => ({ ...p, status: e.target.value }))}>
                  <MenuItem value="valid">Valid</MenuItem>
                  <MenuItem value="expiring_soon">Expiring Soon</MenuItem>
                  <MenuItem value="expired">Expired</MenuItem>
                  <MenuItem value="pending_renewal">Pending Renewal</MenuItem>
                </Select>
              </FormControl>
              <TextField label="Notes" size="small" fullWidth value={certForm.notes} onChange={e => setCertForm((p: any) => ({ ...p, notes: e.target.value }))} />
            </Stack>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <input type="file" ref={certFileInputRef} hidden accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx,.txt" onChange={uploadCertFile} />
              <Button variant="outlined" size="small" startIcon={certUploading ? <CircularProgress size={16} /> : <UploadFileIcon />}
                onClick={() => certFileInputRef.current?.click()} disabled={certUploading} sx={{ textTransform: 'none', borderRadius: 2 }}>
                {certUploading ? 'Uploading…' : certForm.file_url ? 'Replace Document' : 'Upload Document'}
              </Button>
              {certForm.file_url && (
                <>
                  <Chip label={certForm.file_name || certForm.file_url.split('/').pop() || 'Attached'} size="small" color="primary" variant="outlined"
                    onDelete={() => setCertForm((p: any) => ({ ...p, file_url: '', file_name: '' }))} />
                  <IconButton size="small" title="Open file" onClick={() => openCertFile(certForm.file_url, certForm.file_name)}><OpenInNewIcon fontSize="small" /></IconButton>
                </>
              )}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setCertDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => certMutation.mutate()} disabled={!certForm.name} sx={{ bgcolor: NAVY, '&:hover': { bgcolor: '#0A3A5C' } }}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={locDialogOpen} onClose={() => setLocDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Location</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {locError && <Alert severity="error">{locError}</Alert>}
            <TextField label="Name" fullWidth size="small" value={locForm.name || ''} onChange={e => setLocForm((p: any) => ({ ...p, name: e.target.value }))} />
            <TextField label="Address" fullWidth size="small" value={locForm.address || ''} onChange={e => setLocForm((p: any) => ({ ...p, address: e.target.value }))} />
            <Stack direction="row" spacing={2}>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Service Type</InputLabel>
                <Select label="Service Type" value={locForm.service_type || ''} onChange={e => setLocForm((p: any) => ({ ...p, service_type: e.target.value }))}>
                  <MenuItem value=""><em>None</em></MenuItem>
                  <MenuItem value="supported_living">Supported Living</MenuItem>
                  <MenuItem value="residential">Residential</MenuItem>
                  <MenuItem value="domiciliary">Domiciliary</MenuItem>
                </Select>
              </FormControl>
              <TextField label="Service Capacity" type="number" fullWidth size="small" value={locForm.service_capacity ?? ''}
                onChange={e => setLocForm((p: any) => ({ ...p, service_capacity: e.target.value }))} />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField label="Phone" fullWidth size="small" value={locForm.phone || ''} onChange={e => setLocForm((p: any) => ({ ...p, phone: e.target.value }))} />
              <TextField label="Email" fullWidth size="small" value={locForm.email || ''} onChange={e => setLocForm((p: any) => ({ ...p, email: e.target.value }))} />
            </Stack>
            <TextField label="Minimum Staff Required Per Day" type="number" fullWidth size="small"
              value={locForm.minimum_staff_per_day ?? 1}
              onChange={e => setLocForm((p: any) => ({ ...p, minimum_staff_per_day: Number(e.target.value) }))}
              helperText="Minimum safe staffing level for this location each day" />
            <Stack direction="row" spacing={2}>
              <TextField label="Min Day Staff" type="number" fullWidth size="small" value={locForm.min_day_staff ?? ''} onChange={e => setLocForm((p: any) => ({ ...p, min_day_staff: e.target.value }))} />
              <TextField label="Min Night Staff" type="number" fullWidth size="small" value={locForm.min_night_staff ?? ''} onChange={e => setLocForm((p: any) => ({ ...p, min_night_staff: e.target.value }))} />
              <TextField label="Min Sleep Staff" type="number" fullWidth size="small" value={locForm.min_sleep_staff ?? ''} onChange={e => setLocForm((p: any) => ({ ...p, min_sleep_staff: e.target.value }))} />
            </Stack>
            <FormControl size="small" fullWidth>
              <InputLabel>Manager</InputLabel>
              <Select label="Manager" value={locForm.manager_id || ''} onChange={e => setLocForm((p: any) => ({ ...p, manager_id: e.target.value }))}>
                <MenuItem value=""><em>None</em></MenuItem>
                {(staff || []).map(s => (
                  <MenuItem key={s.id} value={s.id}>{s.first_name} {s.last_name}{s.role ? ` (${s.role})` : ''}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack direction="row" spacing={2}>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>CQC Rating</InputLabel>
                <Select label="CQC Rating" value={locForm.cqc_rating || ''} onChange={e => setLocForm((p: any) => ({ ...p, cqc_rating: e.target.value }))}>
                  <MenuItem value=""><em>None</em></MenuItem>
                  <MenuItem value="outstanding">Outstanding</MenuItem>
                  <MenuItem value="good">Good</MenuItem>
                  <MenuItem value="requires_improvement">Requires Improvement</MenuItem>
                  <MenuItem value="inadequate">Inadequate</MenuItem>
                </Select>
              </FormControl>
              <TextField label="Food Hygiene Rating (0-5)" type="number" inputProps={{ min: 0, max: 5 }} fullWidth size="small"
                value={locForm.food_hygiene_rating ?? ''} onChange={e => setLocForm((p: any) => ({ ...p, food_hygiene_rating: e.target.value }))} />
            </Stack>
            <TextField label="Last CQC Inspection" type="date" size="small" fullWidth value={locForm.last_cqc_inspection || ''}
              onChange={e => setLocForm((p: any) => ({ ...p, last_cqc_inspection: e.target.value }))} InputLabelProps={{ shrink: true }} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setLocDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveLocation} disabled={!locForm.name || locSaving}
            sx={{ bgcolor: NAVY, '&:hover': { bgcolor: '#0A3A5C' } }}>{locSaving ? <CircularProgress size={20} /> : 'Save'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!filePreview}
        onClose={() => { if (filePreview?.url.startsWith('blob:')) URL.revokeObjectURL(filePreview.url); setFilePreview(null) }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {filePreview?.name || 'File Preview'}
          </Typography>
          <Stack direction="row" spacing={0.5}>
            {filePreview && (
              <IconButton component="a" href={filePreview.url} download={filePreview.name} aria-label="Download"><DownloadIcon sx={{ color: NAVY }} /></IconButton>
            )}
            <IconButton aria-label="Close preview" onClick={() => { if (filePreview?.url.startsWith('blob:')) URL.revokeObjectURL(filePreview.url); setFilePreview(null) }}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: '#F8FAFC', p: 0, height: '70vh' }}>
          {filePreview?.type === 'application/pdf' ? (
            <iframe src={filePreview.url} title={filePreview.name} width="100%" height="100%" style={{ border: 'none' }} />
          ) : filePreview?.type.startsWith('image/') ? (
            <Box component="img" src={filePreview.url} alt={filePreview.name} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : filePreview?.type.startsWith('text/') ? (
            <iframe src={filePreview.url} title={filePreview.name} width="100%" height="100%" style={{ border: 'none' }} />
          ) : (
            <Stack spacing={2} alignItems="center" justifyContent="center" sx={{ height: '100%', p: 4 }}>
              <Typography color="#9CA3AF">This file type can't be previewed in the browser.</Typography>
              {filePreview && (
                <Button variant="contained" component="a" href={filePreview.url} download={filePreview.name} startIcon={<DownloadIcon />} sx={{ bgcolor: NAVY, '&:hover': { bgcolor: '#0A3A5C' } }}>
                  Download {filePreview.name}
                </Button>
              )}
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  )
}
