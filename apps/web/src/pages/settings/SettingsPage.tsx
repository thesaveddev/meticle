import { useState, useEffect, useRef } from 'react'
import {
  Box, Typography, Paper, TextField, Button, Stack, Alert,
  Avatar, Grid, Dialog, DialogTitle, DialogContent, DialogActions,
  Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow,   IconButton, FormControl, InputLabel, Select, MenuItem,
  Chip, Switch, FormControlLabel, Card, CardContent,
  TablePagination, CircularProgress,
} from '@mui/material'
import {
  PhotoCamera as CameraIcon, Add as AddIcon, Edit as EditIcon,
  Delete as DeleteIcon, Check as CheckIcon, Close as CloseIcon,
  PersonAdd as DelegateIcon, Calculate as CalculateIcon,
  Settings as SettingsIcon,
  AccountCircle as ProfileIcon, Assignment as ComplianceIcon,
  BeachAccess as LeaveIcon, Group as GroupIcon,
  Save as SaveIcon,
  Schedule as ScheduleIcon, Notifications as NotificationsIcon,
  Medication as MedicationIcon,
  Lock as SecurityIcon, Palette as PaletteIcon,
  SmartToy as SmartToyIcon, History as HistoryIcon,
  Warning as WarningIcon, DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  TextFields as TextFieldsIcon,
  CalendarMonth as CalendarIcon,
} from '@mui/icons-material'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useSnackbar } from '../../context/SnackbarContext'
import { useThemeMode, ZOOM_OPTIONS } from '../../context/ThemeContext'

export default function SettingsPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const { showSnackbar } = useSnackbar()
  const { mode, toggleTheme, updateBranding, zoomScale, setZoomScale } = useThemeMode()
  const [tab, setTab] = useState<number>(0)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [deactDialogOpen, setDeactDialogOpen] = useState(false)
  const [deactError, setDeactError] = useState('')
  const [error, setError] = useState('')

  const userStr = localStorage.getItem('user')
  let user: any = null
  try { user = userStr ? JSON.parse(userStr) : null } catch { user = null }
  const orgId = user?.organizationId || user?.organization_id || ''
  const isOrgAdmin = user?.role === 'ORG_ADMIN'

  // Org settings
  const [orgSettings, setOrgSettings] = useState<any>({})
  const [staffList, setStaffList] = useState<any[]>([])
  const [complianceConfigs, setComplianceConfigs] = useState<any[]>([])
  const [complianceProfiles, setComplianceProfiles] = useState<any[]>([])
  const [delegations, setDelegations] = useState<any[]>([])

  // Dialog states
  const [compDialog, setCompDialog] = useState(false)
  const [editComp, setEditComp] = useState<any>({ name: '', description: '', category: 'document', is_mandatory: true, days_warning: 30 })
  const [actionLoading, setActionLoading] = useState('')
  const [brandingSaving, setBrandingSaving] = useState(false)
  const [compProfileDialog, setCompProfileDialog] = useState(false)
  const [editCompProfile, setEditCompProfile] = useState<any>({ name: '', description: '', role_name: '', requirement_ids: [] })
  const [delDialog, setDelDialog] = useState(false)
  const [editDel, setEditDel] = useState<any>({ primary_manager_id: '', delegate_manager_id: '', ends_at: '' })
  const [delAuditDialog, setDelAuditDialog] = useState(false)
  const [delAuditLogs, setDelAuditLogs] = useState<any[]>([])
  const [delAuditLoading, setDelAuditLoading] = useState(false)

  // AI state
  const [aiConfig, setAIConfig] = useState<any>(null)
  const [aiSaving, setAISaving] = useState(false)
  const [aiUsageStats, setAIUsageStats] = useState<any>(null)
  const [aiAnalysisResult, setAIAnalysisResult] = useState<any>(null)
  const [aiAnalyzing, setAIAnalyzing] = useState(false)

  const AI_FEATURES = [
    { key: 'compliance_gap_analysis', label: 'Compliance Gap Analysis', desc: 'Analyze compliance data and generate prioritized recommendations' },
    { key: 'incident_severity_triage', label: 'Incident Severity Triage', desc: 'Classify incident reports by severity with recommended actions' },
    { key: 'rota_optimization', label: 'Rota Optimization', desc: 'AI-powered rota analysis with coverage warnings and staffing suggestions' },
    { key: 'daily_note_generation', label: 'AI Daily Notes', desc: 'Transform voice/text observations into structured, CQC-compliant care notes with mood analysis and safeguarding flags' },
    { key: 'meal_plan_generation', label: 'AI Meal Plans', desc: 'Generate person-centred meal plans based on dietary requirements, allergies, and texture modifications' },
    { key: 'care_plan_gap_analysis', label: 'Care Plan Gap Analysis', desc: 'Compare visit notes against care plans and nutrition records to identify gaps and contradictions' },
    { key: 'competency_assessment_assistant', label: 'Competency Assessment Generator', desc: 'Generate CQC-aligned assessment questions for staff competency evaluations' },
  ]

  // Pagination state
  const [compConfigPage, setCompConfigPage] = useState(0)
  const [compProfilePage, setCompProfilePage] = useState(0)
  const [delPage, setDelPage] = useState(0)
  const rowsPerPage = 10

  useEffect(() => {
    if (!user?.id) { setLoading(false); return }
    const load = async () => {
      try {
        const res = await api.get(`/staff/${user.id}`)
        setProfile(res.data)
      } catch {
        setProfile({ first_name: user.first_name || '', last_name: user.last_name || '', birth_date: '', phone: '', address: '', city: '', country: '', postal_code: '', profile_picture_url: user.profile_picture_url || '' })
      }
      if (isOrgAdmin) {
        const [orgRes, staffRes, compRes, delRes, compProfileRes, orgDetRes] = await Promise.allSettled([
          api.get('/settings/org'),
          api.get('/settings/staff'),
          api.get('/settings/compliance-config'),
          api.get('/settings/delegations'),
          api.get('/settings/compliance-profiles'),
          api.get(`/organizations/${orgId}`),
        ])
        if (orgRes.status === 'fulfilled') setOrgSettings(orgRes.value.data)
        if (staffRes.status === 'fulfilled') setStaffList(staffRes.value.data)
        if (compRes.status === 'fulfilled') setComplianceConfigs(compRes.value.data)
        if (delRes.status === 'fulfilled') setDelegations(delRes.value.data)
        if (compProfileRes.status === 'fulfilled') setComplianceProfiles(compProfileRes.value.data)
        if (orgDetRes.status === 'fulfilled') {
          setOrgDetails(orgDetRes.value.data)
          setBrandingColors({
            primary_color: orgDetRes.value.data.primary_color || '#0F4C81',
            secondary_color: orgDetRes.value.data.secondary_color || '#6B7280',
            accent_color: orgDetRes.value.data.accent_color || '#F8FAFC',
          })
          setBrandingLogo(orgDetRes.value.data.logo_url || '')
        }
        // Load AI config
        try {
          const aiRes = await api.get('/ai/config')
          setAIConfig(aiRes.data.config)
        } catch { /* ai not yet configured */ }
      }
      // Check MFA status
      try {
        const mfaRes = await api.get('/mfa/status')
        setMfaEnabled(mfaRes.data.mfaEnabled)
      } catch {}
      setLoading(false)
    }
    load()
  }, [user?.id, isOrgAdmin, user?.first_name, user?.last_name, user?.profile_picture_url])

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.patch(`/staff/${user.id}/profile`, data),
    onSuccess: (res) => {
      setProfile(res.data)
      let stored: any = {}
      try { stored = JSON.parse(localStorage.getItem('user') || '{}') } catch { stored = {} }
      stored.first_name = res.data.first_name || stored.first_name
      stored.last_name = res.data.last_name || stored.last_name
      stored.profile_picture_url = res.data.profile_picture_url || stored.profile_picture_url
      localStorage.setItem('user', JSON.stringify(stored))
      showSnackbar("Settings saved.", "success")
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to save profile.')
    },
  })

  const handleFieldChange = (field: string, value: string) => {
    setProfile((prev: any) => ({ ...prev, [field]: value }))
  }

  const handlePictureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setProfile((prev: any) => ({ ...prev, profile_picture_url: dataUrl }))
      updateMutation.mutate({ ...profile, profile_picture_url: dataUrl })
    }
    reader.readAsDataURL(file)
  }

  const handleSaveProfile = () => {
    setError('')
    updateMutation.mutate(profile)
  }

  const deactivateMutation = useMutation({
    mutationFn: () => api.post('/staff/self-deactivate'),
    onSuccess: () => { localStorage.clear(); navigate('/') },
    onError: (err: any) => { setDeactError(err.response?.data?.message || 'Failed to deactivate account.') },
  })

  // Org settings handlers.
  // Each section's Save button sends ONLY its own fields, so saving one section
  // can never clobber others with stale values (e.g. a stale force_mfa from an
  // old tab silently re-enabling org-wide MFA).
  const saveOrgSettings = async (fields?: Record<string, any>) => {
    try {
      const res = await api.patch('/settings/org', fields ?? orgSettings)
      setOrgSettings(res.data)
      showSnackbar("Settings saved.", "success")
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save settings')
    }
  }

  const saveComplianceConfig = async () => {
    setActionLoading('compliance-config')
    try {
      if (editComp.id) {
        await api.put(`/settings/compliance-config/${editComp.id}`, editComp)
      } else {
        await api.post('/settings/compliance-config', editComp)
      }
      setCompDialog(false)
      setEditComp({ name: '', description: '', category: 'document', is_mandatory: true, days_warning: 30 })
      const res = await api.get('/settings/compliance-config')
      setComplianceConfigs(res.data)
    } catch (err: any) { setError(err.response?.data?.message || 'Failed') }
    finally { setActionLoading('') }
  }

  const deleteComplianceConfig = async (id: string) => {
    setActionLoading('delete-config-' + id)
    try {
      await api.delete(`/settings/compliance-config/${id}`)
      setComplianceConfigs(prev => prev.filter(c => c.id !== id))
    } catch { }
    finally { setActionLoading('') }
  }

  const seedComplianceRecords = async () => {
    setActionLoading('seed-records')
    try {
      const res = await api.post('/settings/compliance-records/seed')
      showSnackbar(`Seeded ${res.data.records?.length ?? 0} compliance records for all staff.`, "success")
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to seed records')
    }
    finally { setActionLoading('') }
  }

  const saveComplianceProfile = async () => {
    setActionLoading('compliance-profile')
    try {
      if (editCompProfile.id) {
        const res = await api.put(`/settings/compliance-profiles/${editCompProfile.id}`, editCompProfile)
        setComplianceProfiles(prev => prev.map(p => p.id === res.data.id ? res.data : p))
      } else {
        const res = await api.post('/settings/compliance-profiles', editCompProfile)
        setComplianceProfiles(prev => [...prev, res.data])
      }
      setCompProfileDialog(false)
      setEditCompProfile({ name: '', description: '', role_name: '', requirement_ids: [] })
      const pres = await api.get('/settings/compliance-profiles')
      setComplianceProfiles(pres.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save profile')
    }
    finally { setActionLoading('') }
  }

  const deleteComplianceProfile = async (id: string) => {
    setActionLoading('delete-profile-' + id)
    try {
      await api.delete(`/settings/compliance-profiles/${id}`)
      setComplianceProfiles(prev => prev.filter(p => p.id !== id))
    } catch { }
    finally { setActionLoading('') }
  }

  const autoAssignProfiles = async () => {
    setActionLoading('auto-assign')
    try {
      await api.post('/settings/auto-assign-profiles')
      showSnackbar("Settings saved.", "success")
    } catch {}
    finally { setActionLoading('') }
  }

  const saveDelegation = async () => {
    setActionLoading('delegation')
    try {
      if (editDel.id) {
        await api.patch(`/settings/delegations/${editDel.id}`, editDel)
      } else {
        await api.post('/settings/delegations', editDel)
      }
      setDelDialog(false)
      setEditDel({ primary_manager_id: '', delegate_manager_id: '', ends_at: '' })
      const res = await api.get('/settings/delegations')
      setDelegations(res.data)
    }
    finally { setActionLoading('') }
  }

  const deleteDelegation = async (id: string) => {
    setActionLoading('delete-del-' + id)
    try {
      await api.delete(`/settings/delegations/${id}`)
      setDelegations(prev => prev.filter(d => d.id !== id))
    } catch {}
    finally { setActionLoading('') }
  }

  const loadDelAudit = async (delegationId: string) => {
    setDelAuditLoading(true)
    setDelAuditLogs([])
    setDelAuditDialog(true)
    try {
      const res = await api.get(`/delegations/delegation-audit/${delegationId}`)
      setDelAuditLogs(res.data.logs || [])
    } catch {}
    finally { setDelAuditLoading(false) }
  }

  // MFA state
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [mfaQrCode, setMfaQrCode] = useState('')
  const [mfaSetupSecret, setMfaSetupSecret] = useState('')
  const [mfaVerifyToken, setMfaVerifyToken] = useState('')
  const [mfaSetupDialog, setMfaSetupDialog] = useState(false)
  const [mfaDisableDialog, setMfaDisableDialog] = useState(false)
  const [mfaError, setMfaError] = useState('')
  const [mfaDisableError, setMfaDisableError] = useState('')
  const [mfaDisableToken, setMfaDisableToken] = useState('')
  const [mfaDisabling, setMfaDisabling] = useState(false)
  const [mfaVerifying, setMfaVerifying] = useState(false)
  const [mfaBackupCodes, setMfaBackupCodes] = useState<string[]>([])
  const [mfaBackupDialog, setMfaBackupDialog] = useState(false)

  const setupMfa = async () => {
    try {
      const res = await api.post('/mfa/setup')
      setMfaQrCode(res.data.qrCode)
      setMfaSetupSecret(res.data.secret)
      setMfaVerifyToken('')
      setMfaSetupDialog(true)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to setup MFA')
    }
  }

  const verifyMfaSetup = async () => {
    setMfaError('')
    setMfaVerifying(true)
    try {
      const res = await api.post('/mfa/verify', { token: mfaVerifyToken })
      setMfaEnabled(true)
      setMfaSetupDialog(false)
      if (res.data.backupCodes?.length) {
        setMfaBackupCodes(res.data.backupCodes)
        setMfaBackupDialog(true)
      } else {
        showSnackbar("Settings saved.", "success")
      }
    } catch (err: any) {
      setMfaError(err.response?.data?.error?.message || err.response?.data?.message || 'Invalid token. Try again.')
    }
    setMfaVerifying(false)
  }

  const disableMfa = async () => {
    setMfaDisableError('')
    setMfaDisabling(true)
    try {
      await api.post('/mfa/disable', { token: mfaDisableToken })
      setMfaEnabled(false)
      setMfaDisableDialog(false)
      setMfaDisableToken('')
      showSnackbar("Settings saved.", "success")
    } catch (err: any) {
      setMfaDisableError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to disable MFA')
    }
    setMfaDisabling(false)
  }

  // Org details editing state
  const [orgDetails, setOrgDetails] = useState<any>(null)
  const [logoUploading, setLogoUploading] = useState(false)

  // Branding state
  const [brandingColors, setBrandingColors] = useState({
    primary_color: '#0F4C81',
    secondary_color: '#6B7280',
    accent_color: '#F8FAFC',
  })
  const [brandingLogo, setBrandingLogo] = useState('')

  const saveOrgDetails = async () => {
    try {
      if (!orgId) return
      const res = await api.patch(`/organizations/${orgId}`, {
        name: orgDetails.name,
        status: orgDetails.status,
        plan: orgDetails.plan,
        regulator: orgDetails.regulator,
        auto_approve_documents: orgDetails.auto_approve_documents,
      })
      setOrgDetails(res.data)
      showSnackbar("Settings saved.", "success")
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save organization details')
    }
  }

  const saveBranding = async () => {
    try {
      if (!orgId) return
      setBrandingSaving(true)
      await api.patch(`/organizations/${orgId}/branding`, {
        logo_url: brandingLogo,
        ...brandingColors,
      })
      updateBranding(brandingColors, brandingLogo)
      showSnackbar("Settings saved.", "success")
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save branding')
    } finally {
      setBrandingSaving(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post('/settings/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setBrandingLogo(res.data.url)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload logo')
    }
    setLogoUploading(false)
  }

  if (loading) {
    return <Box><Typography variant="h4" sx={{ mb: 4 }}>Settings</Typography><Paper sx={{ p: 4 }}>Loading...</Paper></Box>
  }

  const renderProfileTab = () => (
    <Stack spacing={4}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}><ProfileIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Profile Picture</Typography>
        <Stack direction="row" alignItems="center" spacing={3}>
          <Avatar src={profile?.profile_picture_url || user?.profile_picture_url || ''} sx={{ width: 100, height: 100, bgcolor: '#0F4C81', fontSize: '2.5rem' }}>
            {(profile?.first_name?.[0] || user?.email?.[0] || '?').toUpperCase()}
          </Avatar>
          <input type="file" accept="image/*" hidden ref={fileInputRef} onChange={handlePictureUpload} />
          <Button variant="outlined" startIcon={<CameraIcon />} onClick={() => fileInputRef.current?.click()}>Upload Photo</Button>
        </Stack>
      </Paper>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>Personal Information</Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <TextField label="First Name" fullWidth size="small" autoFocus value={profile?.first_name || ''} onChange={(e) => handleFieldChange('first_name', e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Last Name" fullWidth size="small" value={profile?.last_name || ''} onChange={(e) => handleFieldChange('last_name', e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Email" fullWidth size="small" value={user?.email || ''} disabled helperText="Email cannot be changed." />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Date of Birth" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }}
              value={profile?.birth_date ? new Date(profile.birth_date).toISOString().split('T')[0] : ''}
              onChange={(e) => handleFieldChange('birth_date', e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Phone" fullWidth size="small" value={profile?.phone || ''} onChange={(e) => handleFieldChange('phone', e.target.value)} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Address" fullWidth size="small" value={profile?.address || ''} onChange={(e) => handleFieldChange('address', e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField label="City" fullWidth size="small" value={profile?.city || ''} onChange={(e) => handleFieldChange('city', e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField label="Country" fullWidth size="small" value={profile?.country || ''} onChange={(e) => handleFieldChange('country', e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField label="Postal Code" fullWidth size="small" value={profile?.postal_code || ''} onChange={(e) => handleFieldChange('postal_code', e.target.value)} />
          </Grid>
        </Grid>
        <Button variant="contained" onClick={handleSaveProfile} disabled={updateMutation.isPending}
          sx={{ mt: 3, bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </Paper>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}><ProfileIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Account</Typography>
        <Stack spacing={2}>
          <Box>
            <Typography variant="body2" fontWeight={700}>Role</Typography>
            <Typography variant="body2" color="text.secondary">{user?.role || 'â€”'}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" fontWeight={700}>Member Since</Typography>
            <Typography variant="body2" color="text.secondary">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'â€”'}</Typography>
          </Box>
        </Stack>
      </Paper>
      <NotificationPreferencesSection />
      <Paper sx={{ p: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, color: '#DC2626' }}>Danger Zone</Typography>
        <Typography variant="body2" color="#6B7280" sx={{ mb: 3 }}>Once you deactivate your account, you will not be able to log in again unless an administrator reactivates it.</Typography>
        <Button variant="outlined" color="error" onClick={() => setDeactDialogOpen(true)}>Deactivate Account</Button>
        {deactError && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setDeactError('')}>{deactError}</Alert>}
      </Paper>
      <Dialog open={deactDialogOpen} onClose={() => setDeactDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: '#DC2626' }}>Deactivate Account?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="#6B7280">This will immediately deactivate your account and log you out. You will need an administrator to reactivate it. Are you sure?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeactDialogOpen(false)}>Cancel</Button>
          <Button onClick={() => deactivateMutation.mutate()} color="error" variant="contained" disabled={deactivateMutation.isPending}>
            {deactivateMutation.isPending ? 'Deactivating...' : 'Yes, Deactivate'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )

  const renderSecurityTab = () => (
    <Stack spacing={4}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}><SecurityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Multi-Factor Authentication</Typography>
        <Typography variant="body2" color="#6B7280" sx={{ mb: 3 }}>
          {mfaEnabled
            ? 'MFA is currently enabled on your account. Each time you sign in, you will be prompted for an authentication code.'
            : 'Add an extra layer of security to your account by enabling multi-factor authentication (MFA).'}
        </Typography>
        {mfaEnabled ? (
          <Stack direction="row" spacing={2}>
            <Button variant="outlined" color="error" onClick={() => setMfaDisableDialog(true)}>Disable MFA</Button>
          </Stack>
        ) : (
          <Button variant="contained" onClick={setupMfa} sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>Enable MFA</Button>
        )}
      </Paper>
      <Dialog open={mfaSetupDialog} onClose={() => setMfaSetupDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Set Up MFA</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <Typography variant="body2" color="#6B7280">
              Scan this QR code with your authenticator app (e.g. Google Authenticator, Authy, or Microsoft Authenticator).
            </Typography>
            {mfaQrCode && (
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <img src={mfaQrCode} alt="MFA QR Code" style={{ width: 200, height: 200 }} />
              </Box>
            )}
            {mfaSetupSecret && (
              <TextField label="Secret Key" fullWidth size="small" value={mfaSetupSecret}
                InputProps={{ readOnly: true }}
                helperText="If you cannot scan the QR code, manually enter this key." />
            )}
            <TextField label="Authentication Code" fullWidth size="small" value={mfaVerifyToken}
              onChange={e => { setMfaVerifyToken(e.target.value); setMfaError('') }}
              placeholder="Enter the 6-digit code from your app" />
            {mfaError && <Alert severity="error" onClose={() => setMfaError('')}>{mfaError}</Alert>}
            <Button variant="contained" disabled={mfaVerifying || !mfaVerifyToken} onClick={verifyMfaSetup}
              sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>
              {mfaVerifying ? 'Verifying...' : 'Verify & Enable'}
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMfaSetupDialog(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={mfaDisableDialog} onClose={() => { setMfaDisableDialog(false); setMfaDisableToken('') }} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: '#DC2626', fontWeight: 700 }}>Disable MFA</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography variant="body2" color="#6B7280">Enter your authenticator code or a backup code to confirm.</Typography>
            <TextField label="Code" fullWidth size="small" value={mfaDisableToken}
              onChange={e => { setMfaDisableToken(e.target.value); setMfaDisableError('') }}
              placeholder="6-digit code or backup code" />
            {mfaDisableError && <Alert severity="error" onClose={() => setMfaDisableError('')}>{mfaDisableError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setMfaDisableDialog(false); setMfaDisableToken('') }}>Cancel</Button>
          <Button onClick={disableMfa} color="error" variant="contained" disabled={mfaDisabling || !mfaDisableToken}>
            {mfaDisabling ? 'Disabling...' : 'Disable'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={mfaBackupDialog} onClose={() => setMfaBackupDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Save Your Backup Codes</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Alert severity="warning" sx={{ fontWeight: 600 }}>
              Store these codes in a safe place. Each code can be used <strong>once</strong> to log in if you lose access to your authenticator app.
            </Alert>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: '#F8FAFC' }}>
              <Stack spacing={1}>
                {mfaBackupCodes.map((code, i) => (
                  <Typography key={i} variant="body2" sx={{ fontFamily: 'monospace', fontSize: '1rem', letterSpacing: '0.1rem', fontWeight: 700 }}>
                    {code}
                  </Typography>
                ))}
              </Stack>
            </Paper>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button variant="contained" onClick={() => { setMfaBackupDialog(false); showSnackbar("Settings saved.", "success") }}
            sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>I've Saved Them</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )

  const renderAppearanceTab = () => (
    <Stack spacing={4}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
          <PaletteIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Theme
        </Typography>
        <Stack direction="row" spacing={3} alignItems="center">
          <Typography variant="body2" sx={{ fontWeight: 600 }}>Color Scheme</Typography>
          <Button
            variant={mode === 'light' ? 'contained' : 'outlined'}
            startIcon={<LightModeIcon />}
            onClick={() => mode !== 'light' && toggleTheme()}
            sx={{ textTransform: 'none' }}
          >
            Light
          </Button>
          <Button
            variant={mode === 'dark' ? 'contained' : 'outlined'}
            startIcon={<DarkModeIcon />}
            onClick={() => mode !== 'dark' && toggleTheme()}
            sx={{ textTransform: 'none' }}
          >
            Dark
          </Button>
        </Stack>
      </Paper>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
          <TextFieldsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Text Size & Zoom
        </Typography>
        <Stack spacing={2} sx={{ maxWidth: 480 }}>
          <Typography variant="body2" color="#6B7280">
            Adjust the scale of the interface to make text and controls easier to read. Your preference is saved and applied on every device you use to sign in.
          </Typography>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Interface Scale</Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {ZOOM_OPTIONS.map(z => (
                <Button
                  key={z}
                  size="small"
                  variant={zoomScale === z ? 'contained' : 'outlined'}
                  onClick={() => setZoomScale(z)}
                  sx={{ minWidth: 64, textTransform: 'none' }}
                >
                  {z < 1 ? `${Math.round(z * 100)}%` : z === 1 ? '100%' : `${Math.round(z * 100)}%`}
                </Button>
              ))}
            </Stack>
            <Typography variant="caption" color="#9CA3AF" sx={{ display: 'block', mt: 1 }}>
              {zoomScale < 1 ? 'Compact' : zoomScale === 1 ? 'Default' : zoomScale >= 1.5 ? 'Largest' : 'Enlarged'}
            </Typography>
          </Box>
        </Stack>
      </Paper>
    </Stack>
  )

  const renderOrgSettingsTab = () => (
    <Stack spacing={4}>
      {/* Organization Details */}
      {orgDetails && (
        <Paper sx={{ p: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}><SettingsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Organization Details</Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField label="Organization Name" fullWidth size="small"
                value={orgDetails.name || ''}
                onChange={e => setOrgDetails((p: any) => ({ ...p, name: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select value={orgDetails.status || 'active'} label="Status"
                  onChange={e => setOrgDetails((p: any) => ({ ...p, status: e.target.value }))}>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="suspended">Suspended</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Plan</InputLabel>
                <Select value={orgDetails.plan || 'starter'} label="Plan"
                  onChange={e => setOrgDetails((p: any) => ({ ...p, plan: e.target.value }))}>
                  <MenuItem value="starter">Starter</MenuItem>
                  <MenuItem value="professional">Professional</MenuItem>
                  <MenuItem value="enterprise">Enterprise</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Regulatory Framework</InputLabel>
                <Select value={orgDetails.regulator || 'cqc'} label="Regulatory Framework"
                  onChange={e => setOrgDetails((p: any) => ({ ...p, regulator: e.target.value }))}>
                  <MenuItem value="cqc">CQC â€” England</MenuItem>
                  <MenuItem value="ciw">CIW â€” Wales</MenuItem>
                  <MenuItem value="care-inspectorate">Care Inspectorate â€” Scotland</MenuItem>
                  <MenuItem value="rqia">RQIA â€” Northern Ireland</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Created" fullWidth size="small"
                value={orgDetails.created_at ? new Date(orgDetails.created_at).toLocaleDateString() : ''}
                InputProps={{ readOnly: true }} helperText="Date organization was created" />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={<Switch checked={orgDetails.auto_approve_documents === true}
                  onChange={e => setOrgDetails((p: any) => ({ ...p, auto_approve_documents: e.target.checked }))} />}
                label="Auto-approve uploaded documents"
              />
              <Typography variant="caption" display="block" color="#6B7280" sx={{ ml: 4 }}>
                When enabled, documents uploaded by staff are automatically approved without manual review. Use with caution.
              </Typography>
            </Grid>
          </Grid>
          <Button variant="contained" onClick={saveOrgDetails} sx={{ mt: 3, bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>
            <SaveIcon sx={{ mr: 1 }} /> Save Organization Details
          </Button>
        </Paper>
      )}

      {/* Branding */}
      <Paper sx={{ p: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}><PaletteIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Branding</Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Logo</Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              {brandingLogo && (
                <Box component="img" src={brandingLogo} sx={{ width: 60, height: 60, objectFit: 'contain', border: '1px solid #E5E7EB', borderRadius: 1 }} />
              )}
              <input type="file" accept="image/*" hidden ref={logoInputRef} onChange={handleLogoUpload} />
              <Button variant="outlined" size="small" disabled={logoUploading} onClick={() => logoInputRef.current?.click()}>
                {logoUploading ? 'Uploading...' : 'Upload Logo'}
              </Button>
              <TextField label="Or enter logo URL" fullWidth size="small" value={brandingLogo}
                onChange={e => setBrandingLogo(e.target.value)} sx={{ maxWidth: 300 }} />
            </Stack>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Colors</Typography>
            <Stack spacing={2}>
              {(['primary_color', 'secondary_color', 'accent_color'] as const).map(field => (
                <Box key={field}>
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                    <Box sx={{ position: 'relative', width: 44, height: 44 }}>
                      <input type="color" value={brandingColors[field]}
                        onChange={e => setBrandingColors((p: any) => ({ ...p, [field]: e.target.value }))}
                        style={{ width: 44, height: 44, border: '1px solid #E5E7EB', borderRadius: 6, cursor: 'pointer', padding: 0, background: 'none' }} />
                    </Box>
                    <TextField size="small" value={brandingColors[field]}
                      onChange={e => setBrandingColors((p: any) => ({ ...p, [field]: e.target.value }))}
                      sx={{ width: 120 }}
                      InputProps={{ sx: { fontSize: '0.85rem', fontFamily: 'monospace' } }} />
                    <Typography variant="caption" sx={{ textTransform: 'capitalize', color: '#6B7280', minWidth: 80 }}>
                      {field.replace('_color', '')}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.5}>
                    {['#0F4C81', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0891B2', '#6B7280', '#F8FAFC', '#111827', '#FFFFFF'].map(c => (
                      <Box key={c} onClick={() => setBrandingColors((p: any) => ({ ...p, [field]: c }))}
                        sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: c, border: brandingColors[field] === c ? '2px solid #0F4C81' : '1px solid #E5E7EB', cursor: 'pointer', '&:hover': { transform: 'scale(1.2)' }, transition: 'transform 0.1s' }} />
                    ))}
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Grid>
        </Grid>
        <Button variant="contained" onClick={saveBranding} disabled={brandingSaving} sx={{ mt: 3, bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>
          <SaveIcon sx={{ mr: 1 }} /> {brandingSaving ? 'Saving...' : 'Save Branding'}
        </Button>
      </Paper>

      <Paper sx={{ p: 4, mt: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
          <SecurityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Security Policies
        </Typography>
        <Stack spacing={3}>
          <FormControlLabel
            control={<Switch checked={orgSettings.force_mfa === true}
              onChange={e => setOrgSettings((p: any) => ({ ...p, force_mfa: e.target.checked }))} />}
            label="Force all staff to set up MFA"
          />
          <Typography variant="caption" color="#6B7280">
            When enabled, staff who have not set up multi-factor authentication will be required to set it up before they can log in. Existing MFA users are unaffected.
          </Typography>
        </Stack>
        <Button variant="contained" onClick={() => saveOrgSettings({ force_mfa: orgSettings.force_mfa })} sx={{ mt: 3, bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>
          <SaveIcon sx={{ mr: 1 }} /> Save Security Settings
        </Button>
      </Paper>

      <Paper sx={{ p: 4, mt: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
          <ScheduleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Staffing Rules for Rota Planner
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <TextField label="Minimum Compliance % for Shifts" type="number" fullWidth size="small"
              value={orgSettings.minimum_compliance_percent ?? 100}
              onChange={e => setOrgSettings((p: any) => ({ ...p, minimum_compliance_percent: Math.min(100, Number(e.target.value)) }))}
              inputProps={{ min: 0, max: 100 }}
              helperText="Staff below this compliance % cannot be assigned to shifts in the rota planner (max 100)" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={<Switch checked={orgSettings.overtime_requires_approval !== false}
                onChange={e => setOrgSettings((p: any) => ({ ...p, overtime_requires_approval: e.target.checked }))} />}
              label="Overtime claims require manager approval"
            />
            <Typography variant="caption" color="#6B7280" sx={{ display: 'block', ml: 0 }}>
              When enabled, staff overtime claims need a manager to approve before the shift is assigned.
              When disabled, claims are auto-assigned immediately.
            </Typography>
          </Grid>
        </Grid>
        <Button variant="contained" onClick={() => saveOrgSettings({ minimum_compliance_percent: orgSettings.minimum_compliance_percent, overtime_requires_approval: orgSettings.overtime_requires_approval })} sx={{ mt: 3, bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>
          <SaveIcon sx={{ mr: 1 }} /> Save Staffing Rules
        </Button>
      </Paper>

      <Paper sx={{ p: 4, mt: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
          <ScheduleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Compliance Notifications
        </Typography>
        <FormControlLabel
          control={<Switch checked={orgSettings.compliance_digest_enabled === true}
            onChange={e => setOrgSettings((p: any) => ({ ...p, compliance_digest_enabled: e.target.checked }))} />}
          label="Daily compliance digest emails to location managers"
        />
        <Typography variant="caption" color="#6B7280" sx={{ display: 'block', ml: 0, mt: 0.5 }}>
          When enabled, location managers receive a daily email listing staff with incomplete compliance requirements and what they need to do.
        </Typography>
        <FormControlLabel
          control={<Switch checked={orgSettings.predictive_alerts_enabled !== false}
            onChange={e => setOrgSettings((p: any) => ({ ...p, predictive_alerts_enabled: e.target.checked }))} />}
          label="Predictive compliance alerts"
          sx={{ mt: 1 }}
        />
        <Typography variant="caption" color="#6B7280" sx={{ display: 'block', ml: 0, mt: 0.5 }}>
           When enabled, the system analyses compliance trends over 60 days and alerts administrators if scores are declining toward your alert threshold.
        </Typography>
        <FormControlLabel
          control={<Switch checked={orgSettings.auto_evidence_pack_enabled === true}
            onChange={e => setOrgSettings((p: any) => ({ ...p, auto_evidence_pack_enabled: e.target.checked }))} />}
          label="Auto-generate evidence packs"
          sx={{ mt: 1 }}
        />
        {orgSettings.auto_evidence_pack_enabled && (
          <FormControl size="small" sx={{ mt: 1, minWidth: 200 }}>
            <Select value={orgSettings.auto_evidence_pack_frequency || 'monthly'}
              onChange={e => setOrgSettings((p: any) => ({ ...p, auto_evidence_pack_frequency: e.target.value }))}>
              <MenuItem value="weekly">Weekly (Mondays)</MenuItem>
              <MenuItem value="monthly">Monthly (1st of month)</MenuItem>
            </Select>
          </FormControl>
        )}
        <Typography variant="caption" color="#6B7280" sx={{ display: 'block', ml: 0, mt: 0.5 }}>
          When enabled, evidence packs will be automatically generated and emailed to all org administrators on the selected schedule.
        </Typography>
        <Button variant="contained" onClick={() => saveOrgSettings({ compliance_digest_enabled: orgSettings.compliance_digest_enabled, predictive_alerts_enabled: orgSettings.predictive_alerts_enabled, auto_evidence_pack_enabled: orgSettings.auto_evidence_pack_enabled, auto_evidence_pack_frequency: orgSettings.auto_evidence_pack_frequency })} sx={{ mt: 3, bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>
          <SaveIcon sx={{ mr: 1 }} /> Save Compliance Notification Settings
        </Button>
      </Paper>

      <Paper sx={{ p: 4, mt: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
          <ScheduleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Daily Shift Audit
        </Typography>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
          <FormControlLabel
            control={<Switch checked={orgSettings.daily_shift_audit_enabled !== false}
              onChange={e => setOrgSettings((p: any) => ({ ...p, daily_shift_audit_enabled: e.target.checked }))} />}
            label="Send daily shift audit emails to location managers"
          />
          <TextField label="Send time" type="time" size="small" sx={{ width: 160 }}
            value={orgSettings.daily_shift_audit_time?.slice(0, 5) || '19:00'}
            onChange={e => setOrgSettings((p: any) => ({ ...p, daily_shift_audit_time: e.target.value }))}
            InputLabelProps={{ shrink: true }} />
        </Stack>
        <Typography variant="caption" color="#6B7280" sx={{ display: 'block', ml: 0, mt: 0.5 }}>
          When enabled, location managers receive a daily shift audit email at the configured time
          summarizing shift coverage, staffing levels, and medication administration for the day.
        </Typography>
        <Button variant="contained" onClick={() => saveOrgSettings({ daily_shift_audit_enabled: orgSettings.daily_shift_audit_enabled, daily_shift_audit_time: orgSettings.daily_shift_audit_time })} sx={{ mt: 3, bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>
          <SaveIcon sx={{ mr: 1 }} /> Save Shift Audit Settings
        </Button>
      </Paper>

      <Paper sx={{ p: 4, mt: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
          <NotificationsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Medication Alerts
        </Typography>
        <FormControlLabel
          control={<Switch checked={orgSettings.reorder_alert_enabled !== false}
            onChange={e => setOrgSettings((p: any) => ({ ...p, reorder_alert_enabled: e.target.checked }))} />}
          label="Email location managers when stock reaches reorder level"
          sx={{ mt: 1 }}
        />
        <Typography variant="caption" color="#6B7280" sx={{ display: 'block', ml: 0, mt: 0.5 }}>
          When enabled, the location manager is emailed the moment a medication's stock drops to or below its reorder level
          after an administration. Low-stock items are also included in the daily shift audit email.
        </Typography>
        <FormControlLabel
          control={<Switch checked={orgSettings.late_med_alert_enabled !== false}
            onChange={e => setOrgSettings((p: any) => ({ ...p, late_med_alert_enabled: e.target.checked }))} />}
          label="Email on-duty staff when medications are overdue"
          sx={{ mt: 2 }}
        />
        <Typography variant="caption" color="#6B7280" sx={{ display: 'block', ml: 0, mt: 0.5 }}>
          When enabled, staff currently on duty at the person's location are emailed if a scheduled administration
          remains unrecorded after the delay below. If no staff are on duty, the location manager is alerted instead.
        </Typography>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 2 }}>
          <TextField label="Overdue delay (minutes)" type="number" size="small" sx={{ width: 200 }}
            value={orgSettings.late_med_alert_delay_minutes ?? 30}
            onChange={e => setOrgSettings((p: any) => ({ ...p, late_med_alert_delay_minutes: Math.max(1, Math.min(1440, Number(e.target.value))) }))}
            InputProps={{ inputProps: { min: 1, max: 1440 } }} />
        </Stack>
        <Button variant="contained" onClick={() => saveOrgSettings({ reorder_alert_enabled: orgSettings.reorder_alert_enabled, late_med_alert_enabled: orgSettings.late_med_alert_enabled, late_med_alert_delay_minutes: orgSettings.late_med_alert_delay_minutes })} sx={{ mt: 3, bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>
          <SaveIcon sx={{ mr: 1 }} /> Save Medication Alert Settings
        </Button>
      </Paper>

      <Paper sx={{ p: 4, mt: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
          <MedicationIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Daily Medication Counts
        </Typography>
        <TextField
          select
          label="Count convention"
          size="small"
          sx={{ width: 320 }}
          value={orgSettings.emedication_count_convention || 'end_of_day'}
          onChange={e => setOrgSettings((p: any) => ({ ...p, emedication_count_convention: e.target.value }))}
        >
          <MenuItem value="end_of_day">Once a day â€” End of Day</MenuItem>
          <MenuItem value="am_pm">Twice a day â€” AM &amp; PM</MenuItem>
          <MenuItem value="after_each">After each administration</MenuItem>
        </TextField>
        <Typography variant="caption" color="#6B7280" sx={{ display: 'block', ml: 0, mt: 1 }}>
          Sets the default count type when logging daily medication counts on the eMAR page.
          Choose the frequency your home uses to reconcile physical stock against expected quantities.
        </Typography>
        <Button variant="contained" onClick={() => saveOrgSettings({ emedication_count_convention: orgSettings.emedication_count_convention })} sx={{ mt: 3, bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>
          <SaveIcon sx={{ mr: 1 }} /> Save Count Convention
        </Button>
      </Paper>
    </Stack>
  )

  const renderComplianceTab = () => (
    <Box>
      <Stack spacing={4}>
        <Paper sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}><ComplianceIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Compliance Configuration</Typography>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" startIcon={<HistoryIcon />} onClick={seedComplianceRecords}
                disabled={complianceConfigs.length === 0 || actionLoading === 'seed-records'}>
                {actionLoading === 'seed-records' ? 'Seeding...' : 'Seed Records from Config'}
              </Button>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditComp({ name: '', description: '', category: 'document', is_mandatory: true, days_warning: 30 }); setCompDialog(true) }}
                sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>Add Requirement</Button>
            </Stack>
          </Stack>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Mandatory</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Warning (days)</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {complianceConfigs.length === 0 ? (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3, color: '#9CA3AF' }}>No compliance requirements configured. Add requirements, then use "Seed Records from Config" to generate records for all staff.</TableCell></TableRow>
                ) : complianceConfigs.slice(compConfigPage * rowsPerPage, compConfigPage * rowsPerPage + rowsPerPage).map(c => (
                  <TableRow key={c.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{c.name}
                      {c.description && <Typography variant="caption" display="block" color="#6B7280">{c.description}</Typography>}
                    </TableCell>
                    <TableCell><Chip label={c.category} size="small" /></TableCell>
                    <TableCell>{c.is_mandatory ? <CheckIcon color="success" fontSize="small" /> : <CloseIcon color="disabled" fontSize="small" />}</TableCell>
                    <TableCell>{c.days_warning}d</TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => { setEditComp(c); setCompDialog(true) }}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" disabled={actionLoading === 'delete-config-' + c.id} onClick={() => deleteComplianceConfig(c.id)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {complianceConfigs.length > rowsPerPage && (
            <TablePagination component="div" count={complianceConfigs.length} page={compConfigPage} onPageChange={(_, p) => setCompConfigPage(p)}
              rowsPerPage={rowsPerPage} rowsPerPageOptions={[rowsPerPage]} />
          )}
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Compliance Profiles</Typography>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={() => { setEditCompProfile({ name: '', description: '', role_name: '', requirement_ids: [] }); setCompProfileDialog(true) }}>
                Add Profile
              </Button>
              <Button variant="outlined" size="small" disabled={actionLoading === 'auto-assign'} onClick={autoAssignProfiles}>{actionLoading === 'auto-assign' ? 'Assigning...' : 'Auto-Assign'}</Button>
            </Stack>
          </Stack>
          {complianceProfiles.length === 0 ? (
            <Typography variant="body2" color="#9CA3AF" sx={{ py: 2, textAlign: 'center' }}>No compliance profiles yet. Create profiles linked to roles (e.g., 'Carer Profile' for CARE_WORKER role).</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Requirements</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {complianceProfiles.slice(compProfilePage * rowsPerPage, compProfilePage * rowsPerPage + rowsPerPage).map(p => (
                    <TableRow key={p.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{p.name}{p.description ? <Typography variant="caption" display="block" color="#6B7280">{p.description}</Typography> : null}</TableCell>
                      <TableCell><Chip label={p.role_name} size="small" /></TableCell>
                      <TableCell>{p.requirements?.length || 0} requirements</TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => { setEditCompProfile(p); setCompProfileDialog(true) }}><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" disabled={actionLoading === 'delete-profile-' + p.id} onClick={() => deleteComplianceProfile(p.id)}><DeleteIcon fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {complianceProfiles.length > rowsPerPage && (
            <TablePagination component="div" count={complianceProfiles.length} page={compProfilePage} onPageChange={(_, p) => setCompProfilePage(p)}
              rowsPerPage={rowsPerPage} rowsPerPageOptions={[rowsPerPage]} />
          )}
        </Paper>
      </Stack>

      <Dialog open={compDialog} onClose={() => setCompDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{editComp.id ? 'Edit Requirement' : 'Add Compliance Requirement'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" fullWidth size="small" value={editComp.name} onChange={e => setEditComp((p: any) => ({ ...p, name: e.target.value }))} />
            <TextField label="Description" fullWidth size="small" multiline rows={2} value={editComp.description || ''} onChange={e => setEditComp((p: any) => ({ ...p, description: e.target.value }))} />
            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select value={editComp.category || 'document'} label="Category" onChange={e => setEditComp((p: any) => ({ ...p, category: e.target.value }))}>
                <MenuItem value="document">Document</MenuItem>
                <MenuItem value="training">Training</MenuItem>
                <MenuItem value="certification">Certification</MenuItem>
                <MenuItem value="health">Health & Safety</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel control={<Switch checked={editComp.is_mandatory !== false} onChange={e => setEditComp((p: any) => ({ ...p, is_mandatory: e.target.checked }))} />} label="Mandatory" />
            <TextField label="Warning Period (days before expiry)" type="number" fullWidth size="small" value={editComp.days_warning || 30} onChange={e => setEditComp((p: any) => ({ ...p, days_warning: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setCompDialog(false)}>Cancel</Button>
          <Button variant="contained" disabled={actionLoading === 'compliance-config'} onClick={saveComplianceConfig} sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>{actionLoading === 'compliance-config' ? 'Saving...' : 'Save'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={compProfileDialog} onClose={() => setCompProfileDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{editCompProfile.id ? 'Edit Profile' : 'Add Compliance Profile'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Profile Name" fullWidth size="small" value={editCompProfile.name}
              onChange={e => setEditCompProfile((p: any) => ({ ...p, name: e.target.value }))} />
            <TextField label="Description" fullWidth size="small" multiline rows={2} value={editCompProfile.description || ''}
              onChange={e => setEditCompProfile((p: any) => ({ ...p, description: e.target.value }))} />
            <FormControl fullWidth size="small">
              <InputLabel>Role</InputLabel>
              <Select value={editCompProfile.role_name} label="Role"
                onChange={e => setEditCompProfile((p: any) => ({ ...p, role_name: e.target.value }))}>
                <MenuItem value="CARE_WORKER">Care Worker</MenuItem>
                <MenuItem value="MANAGER">Manager</MenuItem>
                <MenuItem value="ORG_ADMIN">Org Admin</MenuItem>
                <MenuItem value="COMPLIANCE_OFFICER">Compliance Officer</MenuItem>
              </Select>
            </FormControl>
            <Typography variant="body2" sx={{ fontWeight: 700, mt: 1 }}>Requirements</Typography>
            {complianceConfigs.length === 0 ? (
              <Typography variant="body2" color="#9CA3AF">No compliance requirements configured yet.</Typography>
            ) : (
              complianceConfigs.map(c => {
                const checked = (editCompProfile.requirement_ids || []).includes(c.id)
                return (
                  <FormControlLabel key={c.id}
                    control={<Switch checked={checked}
                      onChange={() => setEditCompProfile((p: any) => ({
                        ...p,
                        requirement_ids: checked
                          ? (p.requirement_ids || []).filter((id: string) => id !== c.id)
                          : [...(p.requirement_ids || []), c.id]
                      }))} />}
                    label={`${c.name} (${c.category})`}
                  />
                )
              })
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setCompProfileDialog(false)}>Cancel</Button>
          <Button variant="contained" disabled={actionLoading === 'compliance-profile'} onClick={saveComplianceProfile} sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>{actionLoading === 'compliance-profile' ? 'Saving...' : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )

  const loadAIConfig = async () => {
    try {
      const [configRes, statsRes] = await Promise.all([
        api.get('/ai/config'),
        api.get('/ai/usage-stats'),
      ])
      setAIConfig(configRes.data.config)
      setAIUsageStats(statsRes.data.stats)
    } catch { /* ignore */ }
  }

  const saveAIConfig = async () => {
    if (!aiConfig) return
    setAISaving(true)
    try {
      const body: Record<string, any> = {}
      if (aiConfig.enabled !== undefined) body.enabled = aiConfig.enabled
      if (aiConfig.provider !== undefined) body.provider = aiConfig.provider
      if (aiConfig.apiKey !== undefined && !aiConfig.apiKey.startsWith('â€¢â€¢')) {
        body.apiKey = aiConfig.apiKey
      }
      if (aiConfig.model !== undefined) body.model = aiConfig.model
      if (aiConfig.enabledFeatures !== undefined) body.enabledFeatures = aiConfig.enabledFeatures
      if (aiConfig.monthlyBudgetCents !== undefined) body.monthlyBudgetCents = aiConfig.monthlyBudgetCents
      if (aiConfig.fallbackProvider !== undefined) body.fallbackProvider = aiConfig.fallbackProvider
      if (aiConfig.fallbackApiKey !== undefined && !aiConfig.fallbackApiKey.startsWith('••')) {
        body.fallbackApiKey = aiConfig.fallbackApiKey
      }
      const res = await api.put('/ai/config', body)
      setAIConfig(res.data.config)
      showSnackbar("Settings saved.", "success")
    } catch (e: any) {
      setError(e.response?.data?.error?.message || 'Failed to save AI config')
    } finally {
      setAISaving(false)
    }
  }

  const toggleAIFeature = async (featureKey: string) => {
    if (!aiConfig) return
    const current = aiConfig.enabledFeatures || []
    const next = current.includes(featureKey)
      ? current.filter((k: string) => k !== featureKey)
      : [...current, featureKey]
    setAIConfig((p: any) => ({ ...p, enabledFeatures: next }))
    try {
      const res = await api.put('/ai/config', { enabledFeatures: next })
      setAIConfig(res.data.config)
      showSnackbar('Feature updated', 'success')
    } catch (e: any) {
      setAIConfig((p: any) => ({ ...p, enabledFeatures: current }))
      setError(e.response?.data?.error?.message || 'Failed to save feature toggle')
    }
  }

  const runGapAnalysis = async () => {
    setAIAnalyzing(true)
    setAIAnalysisResult(null)
    try {
      const res = await api.post('/ai/analyze/compliance', {
        regulator: orgSettings?.regulator || 'CQC',
        overallRate: 65,
        domainScores: 'Safe: 70%, Effective: 60%, Caring: 75%, Responsive: 55%, Well-led: 65%',
        keyIssues: 'Training compliance below target, incident reporting incomplete',
      })
      setAIAnalysisResult(res.data.analysis)
      loadAIConfig()
    } catch (e: any) {
      console.error('AI analysis failed:', e)
      const msg = e.response?.data?.error?.message || e.response?.data?.message || e.message || 'Analysis failed'
      setError(msg)
    } finally {
      setAIAnalyzing(false)
    }
  }

  const renderAITab = () => (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}><SmartToyIcon sx={{ mr: 1, verticalAlign: 'middle' }} />AI Integration</Typography>
        <Button variant="contained" onClick={saveAIConfig} disabled={aiSaving}
          startIcon={aiSaving ? undefined : <SaveIcon />}
          sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>
          {aiSaving ? 'Saving...' : 'Save AI Settings'}
        </Button>
      </Stack>

      <Grid container spacing={3}>
        {/* Left: Configuration */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Provider Configuration</Typography>
            <Stack spacing={2.5}>
              <FormControlLabel control={<Switch checked={aiConfig?.enabled || false} onChange={e => setAIConfig((p: any) => ({ ...p, enabled: e.target.checked }))} />} label="Enable AI Features" />
              <FormControl fullWidth size="small">
                <InputLabel>AI Provider</InputLabel>
                <Select value={aiConfig?.provider || 'openai'} label="AI Provider" onChange={e => setAIConfig((p: any) => ({ ...p, provider: e.target.value }))}>
                  <MenuItem value="openai">OpenAI</MenuItem>
                  <MenuItem value="anthropic">Anthropic</MenuItem>
                </Select>
              </FormControl>
              <TextField label="API Key" type="password" fullWidth size="small"
                value={aiConfig?.apiKey || ''}
                onChange={e => setAIConfig((p: any) => ({ ...p, apiKey: e.target.value }))}
                helperText="Your API key is stored encrypted and never shared" />
              <TextField label="Model" fullWidth size="small"
                value={aiConfig?.model || ''}
                onChange={e => setAIConfig((p: any) => ({ ...p, model: e.target.value }))}
                helperText="e.g. gpt-4o-mini, claude-sonnet-4-20250514" />
            </Stack>
          </Paper>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Budget & Limits</Typography>
            <Stack spacing={2.5}>
              <TextField
                label="Monthly Budget Limit (GBP)"
                type="number"
                fullWidth
                size="small"
                value={aiConfig?.monthlyBudgetCents ? (aiConfig.monthlyBudgetCents / 100).toFixed(2) : ''}
                onChange={e => {
                  const pounds = parseFloat(e.target.value) || 0
                  setAIConfig((p: any) => ({ ...p, monthlyBudgetCents: Math.round(pounds * 100) }))
                }}
                InputProps={{ inputProps: { min: 0, step: 0.01 } }}
                helperText="Set to 0 for unlimited. AI features stop when budget is reached."
              />
              {aiUsageStats && aiConfig?.monthlyBudgetCents > 0 && (
                <Box sx={{ p: 1.5, bgcolor: '#F8FAFC', borderRadius: 1, border: '1px solid #E2E8F0' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">Budget used this month</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      £{((aiUsageStats.estimated_cost_cents || 0) / 100).toFixed(2)} / £{(aiConfig.monthlyBudgetCents / 100).toFixed(2)}
                    </Typography>
                  </Box>
                  <Box sx={{ height: 6, bgcolor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
                    <Box sx={{
                      height: '100%',
                      width: `${Math.min(100, ((aiUsageStats.estimated_cost_cents || 0) / aiConfig.monthlyBudgetCents) * 100)}%`,
                      bgcolor: ((aiUsageStats.estimated_cost_cents || 0) / aiConfig.monthlyBudgetCents) > 0.8 ? '#DC2626' : '#16A34A',
                      borderRadius: 3,
                      transition: 'width 0.3s',
                    }} />
                  </Box>
                </Box>
              )}
            </Stack>
          </Paper>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Fallback Provider</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              If the primary provider is unavailable, requests will automatically fall back to this provider.
            </Typography>
            <Stack spacing={2.5}>
              <FormControl fullWidth size="small">
                <InputLabel>Fallback Provider</InputLabel>
                <Select value={aiConfig?.fallbackProvider || ''} label="Fallback Provider"
                  onChange={e => setAIConfig((p: any) => ({ ...p, fallbackProvider: e.target.value || null }))}>
                  <MenuItem value=""><em>None</em></MenuItem>
                  <MenuItem value="openai">OpenAI</MenuItem>
                  <MenuItem value="anthropic">Anthropic</MenuItem>
                </Select>
              </FormControl>
              {aiConfig?.fallbackProvider && (
                <TextField label="Fallback API Key" type="password" fullWidth size="small"
                  value={aiConfig?.fallbackApiKey || ''}
                  onChange={e => setAIConfig((p: any) => ({ ...p, fallbackApiKey: e.target.value }))}
                  helperText="Stored encrypted. Only used when primary provider fails." />
              )}
            </Stack>
          </Paper>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Enabled Features</Typography>
            <Stack spacing={1.5}>
              {AI_FEATURES.map(f => (
                <Box key={f.key} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Switch
                    size="small"
                    checked={aiConfig?.enabledFeatures?.includes(f.key) || false}
                    onChange={() => toggleAIFeature(f.key)}
                  />
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{f.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{f.desc}</Typography>
                  </Box>
                </Box>
              ))}
            </Stack>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Compliance Gap Analysis</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Run an AI-powered analysis of your compliance data to identify gaps and get prioritized recommendations.
            </Typography>
            <Button variant="outlined" onClick={runGapAnalysis} disabled={aiAnalyzing || !aiConfig?.enabled}>
              {aiAnalyzing ? 'Analyzing...' : 'Run Analysis'}
            </Button>
            {aiAnalysisResult && (
              <Box sx={{ mt: 2, p: 2, bgcolor: '#F8FAFC', borderRadius: 1, border: '1px solid #E2E8F0' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Assessment</Typography>
                <Typography variant="body2" sx={{ mb: 1.5 }}>{aiAnalysisResult.overall_assessment}</Typography>
                {aiAnalysisResult.estimated_timeline && (
                  <Typography variant="caption" color="text.secondary">Estimated timeline: {aiAnalysisResult.estimated_timeline}</Typography>
                )}
                {aiAnalysisResult.critical_gaps?.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>Critical Gaps:</Typography>
                    {aiAnalysisResult.critical_gaps.slice(0, 3).map((g: any, i: number) => (
                      <Typography key={i} variant="caption" display="block" sx={{ color: g.priority === 'critical' ? '#DC2626' : '#D97706', mt: 0.5 }}>
                        â€¢ {g.area}: {g.recommended_action}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Right: Usage Stats & Audit Logs */}
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Usage</Typography>
            {aiUsageStats ? (
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Total Requests</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{aiUsageStats.total_requests || 0}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Successful</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#16A34A' }}>{aiUsageStats.successful_requests || 0}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Failed</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#DC2626' }}>{aiUsageStats.failed_requests || 0}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Total Tokens</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{(aiUsageStats.total_tokens || 0).toLocaleString()}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Features Used</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{aiUsageStats.features_used || 0}</Typography>
                </Box>
                {aiUsageStats.estimated_cost_cents !== undefined && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: '1px solid #E2E8F0', mt: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>Est. Cost</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F4C81' }}>£{((aiUsageStats.estimated_cost_cents || 0) / 100).toFixed(2)}</Typography>
                  </Box>
                )}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">Enable AI features to see usage data</Typography>
            )}
          </Paper>

          {aiConfig?.enabled && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>How It Works</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                1. Bring your own API key from <strong>OpenAI</strong> or <strong>Anthropic</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                2. Select the features you want to enable
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                3. AI runs on your data with minimum-necessary context
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                4. All actions are audited â€” full prompt + response logs
              </Typography>
              <Typography variant="body2" color="text.secondary">
                5. Results are decision support only â€” humans always decide
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Box>
  )

  const renderDelegationsTab = () => (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}><DelegateIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Manager Delegations</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditDel({ id: '', primary_manager_id: '', delegate_manager_id: '', ends_at: '' }); setDelDialog(true) }}
          sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>Add Delegation</Button>
      </Stack>
      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Primary Manager</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Delegate</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Expires</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {delegations.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3, color: '#9CA3AF' }}>No delegations set up</TableCell></TableRow>
              ) : delegations.slice(delPage * rowsPerPage, delPage * rowsPerPage + rowsPerPage).map(d => (
                <TableRow key={d.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{d.primary_first_name} {d.primary_last_name}</TableCell>
                  <TableCell>{d.delegate_first_name} {d.delegate_last_name}</TableCell>
                  <TableCell><Chip label={d.is_active ? 'Active' : 'Inactive'} size="small" color={d.is_active ? 'success' : 'default'} /></TableCell>
                  <TableCell>{d.ends_at ? new Date(d.ends_at).toLocaleDateString() : 'No expiry'}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => {
                      setEditDel({ id: d.id, primary_manager_id: d.primary_manager_id, delegate_manager_id: d.delegate_manager_id, ends_at: d.ends_at ? d.ends_at.split('T')[0] : '' })
                      setDelDialog(true)
                    }}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" disabled={actionLoading === 'delete-del-' + d.id} onClick={() => deleteDelegation(d.id)}><DeleteIcon fontSize="small" /></IconButton>
                    <IconButton size="small" title="View Audit" onClick={() => loadDelAudit(d.id)}><HistoryIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {delegations.length > rowsPerPage && (
          <TablePagination component="div" count={delegations.length} page={delPage} onPageChange={(_, p) => setDelPage(p)}
            rowsPerPage={rowsPerPage} rowsPerPageOptions={[rowsPerPage]} />
        )}
      </Paper>
      <Dialog open={delDialog} onClose={() => setDelDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{editDel.id ? 'Edit Delegation' : 'Add Delegation'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Primary Manager</InputLabel>
              <Select value={editDel.primary_manager_id} label="Primary Manager" onChange={e => setEditDel((p: any) => ({ ...p, primary_manager_id: e.target.value }))}>
                {staffList.filter(s => s.role === 'MANAGER' || s.role === 'ORG_ADMIN').map(s => (
                  <MenuItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Delegate Manager</InputLabel>
              <Select value={editDel.delegate_manager_id} label="Delegate Manager" onChange={e => setEditDel((p: any) => ({ ...p, delegate_manager_id: e.target.value }))}>
                {staffList.filter(s => (s.role === 'MANAGER' || s.role === 'ORG_ADMIN') && s.id !== editDel.primary_manager_id).map(s => (
                  <MenuItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="End Date (optional)" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }}
              value={editDel.ends_at || ''} onChange={e => setEditDel((p: any) => ({ ...p, ends_at: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDelDialog(false)}>Cancel</Button>
          <Button variant="contained" disabled={actionLoading === 'delegation'} onClick={saveDelegation} sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>{actionLoading === 'delegation' ? 'Saving...' : 'Save'}</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={delAuditDialog} onClose={() => setDelAuditDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Delegation Audit Log</DialogTitle>
        <DialogContent>
          {delAuditLoading ? (
            <Typography sx={{ py: 2 }}>Loading...</Typography>
          ) : delAuditLogs.length === 0 ? (
            <Typography sx={{ py: 2, color: '#9CA3AF' }}>No audit entries found.</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Date & Time</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Performed By</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {delAuditLogs.map((log: any) => (
                    <TableRow key={log.id} hover>
                      <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                      <TableCell><Chip label={log.action} size="small" color="primary" variant="outlined" /></TableCell>
                      <TableCell>{log.description}</TableCell>
                      <TableCell>{log.performed_by_name || log.performed_by}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDelAuditDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>Settings</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ '& .MuiTab-root': { fontWeight: 700, textTransform: 'none', minHeight: 48 } }}>
          <Tab icon={<ProfileIcon />} iconPosition="start" label="My Profile" />
          {user && <Tab icon={<SecurityIcon />} iconPosition="start" label="Security" />}
          <Tab icon={<PaletteIcon />} iconPosition="start" label="Appearance" />
          {isOrgAdmin && <Tab icon={<SettingsIcon />} iconPosition="start" label="Organization" />}
          {isOrgAdmin && <Tab icon={<ComplianceIcon />} iconPosition="start" label="Compliance" />}
          {isOrgAdmin && <Tab icon={<GroupIcon />} iconPosition="start" label="Delegations" />}
          {isOrgAdmin && <Tab icon={<SmartToyIcon />} iconPosition="start" label="AI" />}
          {isOrgAdmin && <Tab icon={<LeaveIcon />} iconPosition="start" label="Leave" />}
          {isOrgAdmin && <Tab icon={<WarningIcon />} iconPosition="start" label="Incident Categories" />}
        </Tabs>
      </Paper>
      {tab === 0 && renderProfileTab()}
      {user && tab === 1 && renderSecurityTab()}
      {tab === 2 && renderAppearanceTab()}
      {isOrgAdmin && tab === 3 && renderOrgSettingsTab()}
      {isOrgAdmin && tab === 4 && renderComplianceTab()}
      {isOrgAdmin && tab === 5 && renderDelegationsTab()}
      {isOrgAdmin && tab === 6 && renderAITab()}
      {isOrgAdmin && tab === 7 && <LeaveTypesSettings staffCount={staffList.length} />}
      {isOrgAdmin && tab === 8 && <IncidentCategoriesSettings />}
    </Box>
  )
}

function LeaveTypesSettings({ staffCount }: { staffCount: number }) {
  const { showSnackbar } = useSnackbar()
  const [types, setTypes] = useState<any[]>([])
  const [leaveOrg, setLeaveOrg] = useState<any>({})
  const [typeDialog, setTypeDialog] = useState(false)
  const [editingType, setEditingType] = useState<any>({ name: '', color: '#0F4C81', duration_type: 'days', days_allowed: 0, hours_allowed: 0, is_paid: true, requires_approval: true })
  const [typePage, setTypePage] = useState(0)
  const [tlLoading, setTlLoading] = useState('')
  const [ltError, setLtError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<any>(null)

  const hpd = Number(leaveOrg.default_hours_per_leave_day) || 7.5
  const base = Number(leaveOrg.base_leave_hours) || 240

  const toHours = (t: any) => (t?.duration_type === 'hours' ? Number(t.hours_allowed) || 0 : (Number(t.days_allowed) || 0) * hpd)
  const fmt = (n: number) => Math.round(n * 100) / 100
  const savedTotal = types.reduce((s: number, t: any) => s + toHours(t), 0)
  const projectedTotal = types.filter((x: any) => x.id !== editingType.id).reduce((s: number, t: any) => s + toHours(t), 0) + toHours(editingType)
  const mismatch = Math.abs(projectedTotal - base) > 0.01
  const savedMismatch = Math.abs(savedTotal - base) > 0.01

  const loadTypes = async () => {
    try { const r = await api.get('/leave/types'); setTypes(r.data) } catch { }
  }
  const loadLeaveOrg = async () => {
    try { const r = await api.get('/settings/org'); setLeaveOrg(r.data) } catch { }
  }
  useEffect(() => { loadTypes(); loadLeaveOrg() }, [])

  const saveLeaveOrg = async () => {
    setTlLoading('org')
    try {
      const r = await api.patch('/settings/org', {
        leave_start_month: leaveOrg.leave_start_month,
        default_hours_per_leave_day: leaveOrg.default_hours_per_leave_day,
        base_leave_hours: leaveOrg.base_leave_hours,
        base_contracted_hours: leaveOrg.base_contracted_hours,
      })
      setLeaveOrg(r.data)
      showSnackbar('Leave calendar settings saved.', 'success')
    } catch (e: any) { setLtError(e.response?.data?.message || 'Failed to save leave settings') }
    finally { setTlLoading('') }
  }

  const calculateEntitlements = async () => {
    setTlLoading('entitlements')
    try {
      const res = await api.post('/settings/calculate-entitlements')
      showSnackbar('Entitlements calculated: ' + (res.data?.message || `${staffCount} staff updated`), "success")
    } catch (e: any) { setLtError(e.response?.data?.message || 'Failed to calculate entitlements') }
    finally { setTlLoading('') }
  }

  const saveType = async () => {
    setSaveError('')
    if (mismatch) {
      setSaveError(`Leave type allowances must total the organisation leave allowance of ${fmt(base)}h exactly. Current total: ${fmt(projectedTotal)}h (${fmt(base - projectedTotal)}h ${base >= projectedTotal ? 'remaining' : 'over'}). Adjust a type's allowance so it fits.`)
      return
    }
    setTlLoading('save')
    try {
      const payload = {
        ...editingType,
        duration_type: 'hours',
        days_allowed: Math.round(((Number(editingType.hours_allowed) || 0) / hpd) * 10) / 10,
      }
      if (editingType.id) {
        await api.put(`/leave/types/${editingType.id}`, payload)
      } else {
        await api.post('/leave/types', payload)
      }
      setTypeDialog(false); setSaveError(''); setEditingType({ name: '', color: '#0F4C81', duration_type: 'hours', days_allowed: 0, hours_allowed: 0, is_paid: true, requires_approval: true }); loadTypes()
      showSnackbar('Leave type saved.', 'success')
    } catch (e: any) { setSaveError(e.response?.data?.message || 'Error saving leave type') }
    finally { setTlLoading('') }
  }

  const deleteType = async (id: string) => {
    setTlLoading('delete')
    try { await api.delete(`/leave/types/${id}`); loadTypes(); showSnackbar('Leave type deleted.', 'success') }
    catch (e: any) { setLtError(e.response?.data?.message || 'Error deleting leave type') }
    finally { setTlLoading(''); setConfirmDelete(null) }
  }

  return (
    <Box>
      {ltError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLtError('')}>{ltError}</Alert>}

      {/* Leave Calendar Settings */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}><CalendarIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Leave Calendar Settings</Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Leave Year Start Month</InputLabel>
              <Select value={leaveOrg.leave_start_month || 1} label="Leave Year Start Month"
                onChange={e => setLeaveOrg((p: any) => ({ ...p, leave_start_month: Number(e.target.value) }))}>
                {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((name, i) => (
                  <MenuItem key={i + 1} value={i + 1}>{name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Default Hours per Leave Day" type="number" fullWidth size="small"
              value={leaveOrg.default_hours_per_leave_day ?? 7.5}
              onChange={e => setLeaveOrg((p: any) => ({ ...p, default_hours_per_leave_day: Number(e.target.value) }))} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Base Leave Hours (full-time)" type="number" fullWidth size="small"
              value={leaveOrg.base_leave_hours ?? 240}
              onChange={e => setLeaveOrg((p: any) => ({ ...p, base_leave_hours: Number(e.target.value) }))}
              helperText="Total leave hours for a full-time (40h/week) staff member" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Base Contracted Hours/Week" type="number" fullWidth size="small"
              value={leaveOrg.base_contracted_hours ?? 40}
              onChange={e => setLeaveOrg((p: any) => ({ ...p, base_contracted_hours: Number(e.target.value) }))}
              helperText="Full-time weekly hours used as baseline for proportional calculation" />
          </Grid>
        </Grid>
        <Button variant="contained" onClick={saveLeaveOrg} disabled={tlLoading === 'org'}
          sx={{ mt: 3, bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>
          <SaveIcon sx={{ mr: 1 }} /> {tlLoading === 'org' ? 'Saving...' : 'Save Leave Settings'}
        </Button>
      </Paper>

      {/* Leave Entitlements Summary */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}><CalculateIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Leave Entitlements Summary</Typography>
        <Typography variant="body2" color="#6B7280" sx={{ mb: 3 }}>
          Staff leave entitlements are calculated proportionally based on their contracted weekly hours.
          For example, a staff member working 20h/week will receive half the leave of a 40h/week full-time employee.
          Configure the baseline values above, then run the calculation.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
          <Card variant="outlined" sx={{ flex: 1, minWidth: 200 }}>
            <CardContent>
              <Typography variant="caption" color="#6B7280">Base Leave Hours</Typography>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>{leaveOrg.base_leave_hours ?? 240}h</Typography>
              <Typography variant="caption" color="#9CA3AF">For {leaveOrg.base_contracted_hours ?? 40}h/week</Typography>
            </CardContent>
          </Card>
          <Card variant="outlined" sx={{ flex: 1, minWidth: 200 }}>
            <CardContent>
              <Typography variant="caption" color="#6B7280">Staff Count</Typography>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>{staffCount}</Typography>
              <Typography variant="caption" color="#9CA3AF">Active staff to calculate</Typography>
            </CardContent>
          </Card>
        </Box>
        <Button variant="contained" startIcon={<CalculateIcon />} onClick={calculateEntitlements} disabled={tlLoading === 'entitlements'}
          sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>
          {tlLoading === 'entitlements' ? 'Calculating...' : 'Calculate & Update All Entitlements'}
        </Button>
      </Paper>

      {/* Leave Types */}
      <Paper sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6" fontWeight={700}>Leave Types</Typography>
          <Button variant="contained" size="small" startIcon={<AddIcon />}
            onClick={() => { setEditingType({ name: '', color: '#0F4C81', duration_type: 'hours', days_allowed: 0, hours_allowed: 0, is_paid: true, requires_approval: true }); setSaveError(''); setTypeDialog(true) }}
            sx={{ bgcolor: '#0F4C81' }}>Add Leave Type</Button>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <Typography variant="body2" color="#6B7280">Type allowances total</Typography>
          <Typography variant="body2" fontWeight={700} color={savedMismatch ? 'error.main' : 'success.main'}>{fmt(savedTotal)}h</Typography>
          <Typography variant="body2" color="#6B7280">of {fmt(base)}h allowed</Typography>
          {savedMismatch && <Typography variant="body2" color="error.main" fontWeight={600}>
            ({fmt(base - savedTotal) >= 0 ? `${fmt(base - savedTotal)}h remaining` : `${fmt(savedTotal - base)}h over`})
          </Typography>}
        </Stack>
        {savedMismatch && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Leave type allowances total {fmt(savedTotal)}h but the organisation leave allowance is {fmt(base)}h. Edit the types so the total matches exactly before saving new changes.
          </Alert>
        )}
        <TableContainer>
          <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Color</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Allowance</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Paid</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Approval</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {types.slice(typePage * 10, typePage * 10 + 10).map(t => (
                    <TableRow key={t.id}>
                      <TableCell><Typography fontWeight={600}>{t.name}</Typography></TableCell>
                      <TableCell><Chip label={t.color} size="small" sx={{ bgcolor: t.color, color: '#fff', fontWeight: 700 }} /></TableCell>
                      <TableCell>{fmt(toHours(t))}h</TableCell>
                      <TableCell><Chip label={t.is_paid ? 'Paid' : 'Unpaid'} size="small" color={t.is_paid ? 'success' : 'default'} variant="outlined" /></TableCell>
                      <TableCell><Chip label={t.requires_approval ? 'Approval' : 'Auto'} size="small" color={t.requires_approval ? 'warning' : 'info'} variant="outlined" /></TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => { setEditingType(t); setSaveError(''); setTypeDialog(true) }}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => setConfirmDelete(t)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {types.length > 10 && <TablePagination component="div" count={types.length} page={typePage} onPageChange={(_ev: any, p: number) => setTypePage(p)} rowsPerPage={10} rowsPerPageOptions={[10]} />}
      </Paper>

      {/* Add/Edit Leave Type */}
      <Dialog open={typeDialog} onClose={() => { setTypeDialog(false); setSaveError('') }} maxWidth="sm" fullWidth>
        <DialogTitle>{editingType.id ? 'Edit Leave Type' : 'Add Leave Type'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" fullWidth value={editingType.name}
              onChange={e => setEditingType({ ...editingType, name: e.target.value })} />
            <TextField label="Color" fullWidth value={editingType.color}
              onChange={e => setEditingType({ ...editingType, color: e.target.value })}
              InputProps={{ startAdornment: <Box sx={{ width: 20, height: 20, bgcolor: editingType.color, borderRadius: 0.5, mr: 1 }} /> }} />
            <TextField label="Hours Allowed" type="number" fullWidth value={editingType.hours_allowed}
              onChange={e => setEditingType({ ...editingType, hours_allowed: parseFloat(e.target.value) || 0 })}
              helperText={`All leave is calculated in hours (e.g., ${fmt(28 * hpd)}h for 28 days at ${hpd}h/day)`} />
            <Stack direction="row" spacing={3}>
              <FormControlLabel
                control={<Switch checked={editingType.is_paid !== false}
                  onChange={e => setEditingType({ ...editingType, is_paid: e.target.checked })} />}
                label="Paid leave" />
              <FormControlLabel
                control={<Switch checked={editingType.requires_approval !== false}
                  onChange={e => setEditingType({ ...editingType, requires_approval: e.target.checked })} />}
                label="Requires approval" />
            </Stack>
            {editingType.requires_approval === false && (
              <Alert severity="info" sx={{ py: 0.5 }}>
                Requests for this type will be auto-approved when submitted.
              </Alert>
            )}
            <Box sx={{ p: 1.5, bgcolor: '#F7F4EE', borderRadius: 1 }}>
              <Typography variant="body2" color="#4B5563">
                Type allowances total <Typography component="span" fontWeight={700} color={mismatch ? 'error.main' : 'success.main'}>{fmt(projectedTotal)}h</Typography> of {fmt(base)}h allowed
                <Typography component="span" color="#6B7280"> ({fmt(base - projectedTotal) >= 0 ? `${fmt(base - projectedTotal)}h remaining` : `${fmt(projectedTotal - base)}h over`})</Typography>
              </Typography>
              {mismatch && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {saveError || `The organisation leave allowance is ${fmt(base)}h and the type allowances must match it exactly. Adjust the allowances above so the total equals ${fmt(base)}h.`}
                </Alert>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setTypeDialog(false); setSaveError('') }}>Cancel</Button>
          <Button variant="contained" onClick={saveType} disabled={tlLoading === 'save' || mismatch}
            sx={{ bgcolor: '#0F4C81' }}>{tlLoading === 'save' ? <CircularProgress size={20} /> : 'Save'}</Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete leave type?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="#4B5563">
            Are you sure you want to delete <Typography component="span" fontWeight={700}>{confirmDelete?.name}</Typography>? This will permanently remove the type and its staff balances.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => confirmDelete && deleteType(confirmDelete.id)}
            disabled={tlLoading === 'delete'}>
            {tlLoading === 'delete' ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function IncidentCategoriesSettings() {
  const [cats, setCats] = useState<any[]>([])
  const [catDialog, setCatDialog] = useState(false)
  const [editingCat, setEditingCat] = useState<any>({ name: '', severity: 'medium', is_cqc_reportable: false })
  const [catPage, setCatPage] = useState(0)
  const [catLoading, setCatLoading] = useState('')
  const [icError, setIcError] = useState('')

  const loadCats = async () => {
    try { const r = await api.get('/incidents/categories'); setCats(r.data) } catch { }
  }
  useEffect(() => { loadCats() }, [])

  const saveCat = async () => {
    setCatLoading('save')
    try {
      if (editingCat.id) {
        await api.put(`/incidents/categories/${editingCat.id}`, editingCat)
      } else {
        await api.post('/incidents/categories', editingCat)
      }
      setCatDialog(false); setEditingCat({ name: '', severity: 'medium', is_cqc_reportable: false }); loadCats()
    } catch (e: any) { setIcError(e.response?.data?.message || 'Error saving category') }
    finally { setCatLoading('') }
  }

  const deleteCat = async (id: string) => {
    setCatLoading(id)
    try { await api.delete(`/incidents/categories/${id}`); loadCats() }
    catch (e: any) { setIcError(e.response?.data?.message || 'Error deleting category') }
    finally { setCatLoading('') }
  }

  return (
    <Box>
      {icError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setIcError('')}>{icError}</Alert>}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6" fontWeight={700}>Incident Categories</Typography>
          <Button variant="contained" size="small" startIcon={<AddIcon />}
            onClick={() => { setEditingCat({ name: '', severity: 'medium', is_cqc_reportable: false }); setCatDialog(true) }}
            sx={{ bgcolor: '#0F4C81' }}>Add Category</Button>
        </Stack>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Severity</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>CQC Reportable</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cats.slice(catPage * 10, catPage * 10 + 10).map(c => (
                <TableRow key={c.id}>
                  <TableCell><Typography fontWeight={600}>{c.name}</Typography></TableCell>
                  <TableCell>
                    <Chip label={c.severity} size="small" color={c.severity === 'critical' ? 'error' : c.severity === 'high' ? 'warning' : c.severity === 'medium' ? 'info' : 'default'} />
                  </TableCell>
                  <TableCell>{c.is_cqc_reportable ? <Chip label="Reportable" size="small" color="error" /> : <Chip label="Not Reportable" size="small" variant="outlined" />}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => { setEditingCat(c); setCatDialog(true) }}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => deleteCat(c.id)} disabled={catLoading === c.id}>
                      {catLoading === c.id ? <CircularProgress size={16} /> : <DeleteIcon fontSize="small" />}
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {cats.length > 10 && <TablePagination component="div" count={cats.length} page={catPage} onPageChange={(_ev: any, p: number) => setCatPage(p)} rowsPerPage={10} rowsPerPageOptions={[10]} />}
      </Paper>

      <Dialog open={catDialog} onClose={() => setCatDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCat.id ? 'Edit Category' : 'Add Category'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" fullWidth value={editingCat.name}
              onChange={e => setEditingCat({ ...editingCat, name: e.target.value })} />
            <TextField select label="Default Severity" fullWidth value={editingCat.severity}
              onChange={e => setEditingCat({ ...editingCat, severity: e.target.value })}>
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="critical">Critical</MenuItem>
            </TextField>
            <FormControlLabel control={<Switch checked={editingCat.is_cqc_reportable}
              onChange={e => setEditingCat({ ...editingCat, is_cqc_reportable: e.target.checked })} />}
              label="CQC Reportable" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCatDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveCat} disabled={catLoading === 'save'}
            sx={{ bgcolor: '#0F4C81' }}>{catLoading === 'save' ? <CircularProgress size={20} /> : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function NotificationPreferencesSection() {
  const [prefs, setPrefs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [prefError, setPrefError] = useState('')

  useEffect(() => {
    let mounted = true
    api.get('/notifications/preferences')
      .then(r => { if (mounted) setPrefs(Array.isArray(r.data) ? r.data : []) })
      .catch(() => { if (mounted) setPrefError('Could not load your notification preferences. Please try again.') })
    return () => { mounted = false }
  }, [])

  const toggle = async (type: string, enabled: boolean) => {
    try {
      setLoading(true)
      setPrefError('')
      await api.patch('/notifications/preferences', { notification_type: type, enabled })
      setPrefs(p => p.map(pt => pt.notification_type === type ? { ...pt, enabled } : pt))
    } catch {
      setPrefError(`Could not update "${labels[type] || type}". Please try again.`)
    }
    finally { setLoading(false) }
  }

  const labels: Record<string, string> = {
    compliance: 'Compliance alerts', training: 'Training reminders', documents: 'Document expiry',
    leave: 'Leave requests', shift: 'Shift assignments', swap: 'Shift swaps',
    overtime: 'Overtime claims', survey: 'Surveys & feedback', delegation: 'Delegation changes',
    general: 'General announcements',
  }

  return (
    <Paper sx={{ p: 4 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        <NotificationsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />My Notification Preferences
      </Typography>
      <Typography variant="caption" color="#6B7280" sx={{ display: 'block', mb: 2 }}>
        Choose which notifications you want to receive. Disabled types will not generate push or in-app alerts.
      </Typography>
      {prefError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setPrefError('')}>{prefError}</Alert>}
      <Grid container spacing={1}>
        {prefs.length === 0 && !prefError ? (
          <Grid item xs={12}>
            <Typography variant="body2" color="#6B7280">Loading your notification preferences...</Typography>
          </Grid>
        ) : (
          prefs.map(p => (
            <Grid item xs={12} sm={6} key={p.notification_type}>
              <FormControlLabel
                control={<Switch checked={p.enabled} disabled={loading}
                  onChange={e => toggle(p.notification_type, e.target.checked)} />}
                label={labels[p.notification_type] || p.notification_type}
              />
            </Grid>
          ))
        )}
      </Grid>
    </Paper>
  )
}
