import { useMemo, useState } from 'react'
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, Chip, Stack, IconButton, Tooltip, TablePagination, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Autocomplete, Alert, CircularProgress, LinearProgress, Tabs, Tab, Grid } from '@mui/material'
import PageContainer from '../../components/design/PageContainer'
import { PremiumCard } from '../../components/design/PremiumCard'
import { useTheme } from '@mui/material/styles'
import { useNavigate } from 'react-router-dom'
import { NotificationsActive as RemindIcon, Download as DownloadIcon, Upload as UploadIcon, Warning as WarningIcon, CheckCircle as CheckCircleIcon, Schedule as ScheduleIcon, VerifiedUser as ShieldCheckIcon, Search as SearchIcon } from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import api from '../../services/api'
import { EmptyState } from '../../components/design/EmptyState'
import { identityTypeLabel, nationLabel, IDENTITY_DOCUMENT_TYPES } from '../../data/identityDocuments'
import { useSnackbar } from '../../context/SnackbarContext'

/**
 * The columns to show, derived from what the API says each person needs.
 *
 * Hardcoding DBS/Passport/Visa/Right to Work made this table wrong for every
 * provider outside England and Wales: a Scottish worker's PVG was invisible,
 * and a Northern Irish worker's AccessNI check was invisible. The API now
 * reports each person's own scheme, so the columns follow it — a single-nation
 * organisation looks exactly as it did, and a mixed one shows both.
 */
function useIdentityColumns(staff: any[] | undefined): string[] {
  return useMemo(() => {
    const keys = new Set<string>()
    for (const person of staff || []) {
      for (const key of Object.keys(person?.statuses || {})) keys.add(key)
    }
    if (keys.size === 0) return ['DBS', 'PASSPORT', 'VISA', 'RIGHT_TO_WORK']
    // The background check first, then right to work — the order a manager
    // reads the row in.
    return [...keys].sort((a, b) => (a === 'PASSPORT' || a === 'VISA' || a === 'RIGHT_TO_WORK' ? 1 : 0) - (b === 'PASSPORT' || b === 'VISA' || b === 'RIGHT_TO_WORK' ? 1 : 0))
  }, [staff])
}

export default function IdentityMonitoringPage() {
  const theme = useTheme()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
  const [locationId, setLocationId] = useState<string>('all')
  const [statusTab, setStatusTab] = useState<'all' | 'incomplete' | 'expiring' | 'expired'>('all')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [rowsPerPage] = useState(10)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [renewalOpen, setRenewalOpen] = useState<{ doc: any } | null>(null)
  const { register, handleSubmit, reset, setValue } = useForm()
  const [selectedStaff, setSelectedStaff] = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['identity-dashboard'],
    queryFn: async () => {
      const res = await api.get('/compliance/identity-dashboard')
      return res.data
    },
    refetchInterval: 30_000,
    refetchIntervalInBackground: false
  })

  const { data: membersData } = useQuery({
    queryKey: ['org-members'],
    queryFn: async () => {
      const res = await api.get('/staff/org-members')
      return res.data as any
    }
  })
  const members: any[] = [
    ...(membersData?.admins?.length ? membersData.admins : (membersData?.admin ? [membersData.admin] : [])),
    ...(membersData?.staff || [])
  ].filter((m: any) => m.status === 'active')

  const { data: locationsData } = useQuery({
    queryKey: ['settings-locations'],
    queryFn: async () => (await api.get('/settings/locations')).data,
  })
  const locations: any[] = Array.isArray(locationsData) ? locationsData : []
  const memberByEmail = useMemo(() => {
    const map = new Map<string, any>()
    for (const m of members) {
      if (m.email) map.set(String(m.email).toLowerCase(), m)
      if (m.staff_id) map.set(`staff:${m.staff_id}`, m)
    }
    return map
  }, [membersData])
  const staffWithLocation = useMemo(() => {
    const rows: any[] = Array.isArray(data?.staff) ? data.staff : []
    return rows.map((s: any) => {
      const member = (s.email && memberByEmail.get(String(s.email).toLowerCase())) || memberByEmail.get(`staff:${s.id}`)
      return { ...s, location_id: member?.location_id ? String(member.location_id) : undefined, role: s.role || member?.role || '' }
    })
  }, [data, memberByEmail])
  const roleOptions: string[] = useMemo(
    () => Array.from(new Set(staffWithLocation.map((s: any) => s.role).filter(Boolean))),
    [staffWithLocation]
  )
  const visibleStaff = staffWithLocation.filter((s: any) => {
    if (locationId !== 'all' && s.location_id && String(s.location_id) !== String(locationId)) return false
    if (statusTab !== 'all' && s.overall !== statusTab) return false
    if (roleFilter !== 'all' && s.role !== roleFilter) return false
    if (search && !`${s.first_name || ''} ${s.last_name || ''}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const remindMutation = useMutation({
    mutationFn: (id: string) => api.post(`/compliance/documents/${id}/renewal-reminder`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['identity-dashboard'] })
  })

  const submitRenewalMutation = useMutation({
    mutationFn: async ({ id, file, expiryDate }: { id: string; file: File; expiryDate?: string }) => {
      const formData = new FormData()
      formData.append('document', file)
      if (expiryDate) formData.append('expiryDate', expiryDate)
      return api.post(`/compliance/documents/${id}/submit-renewal`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identity-dashboard'] })
      setRenewalOpen(null)
      setRenewalFile(null)
    }
  })

  const [uploadError, setUploadError] = useState('')
  const [fileTooLarge, setFileTooLarge] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const { showSnackbar } = useSnackbar()
  const [renewalFile, setRenewalFile] = useState<File | null>(null)
  const [renewalExpiryDate, setRenewalExpiryDate] = useState('')

  const approveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/compliance/documents/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['identity-dashboard'] })
  })

  const uploadMutation = useMutation({
    mutationFn: async (data: any) => {
      const formData = new FormData()
      formData.append('document', data.document[0])
      formData.append('staffId', data.staffId)
      formData.append('type', data.type)
      formData.append('expiryDate', data.expiryDate)
      return api.post('/compliance/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
    },
    onSuccess: (_res, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ['identity-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      setUploadOpen(false)
      setUploadError('')
      setFileTooLarge(false)
      reset()
      const staffName = selectedStaff ? `${selectedStaff.first_name || ''} ${selectedStaff.last_name || ''}`.trim() : ''
      showSnackbar(
        staffName ? `${staffName}'s ${identityTypeLabel(variables?.type) || variables?.type || 'document'} is saved.` : 'The document is saved and pending review.',
        'success',
        'Document uploaded',
      )
      setSelectedStaff(null)
    },
    onError: (err: any) => {
      setUploadError(err.response?.data?.message || err.message || 'Upload failed')
    }
  })

  const handleFormSubmit = handleSubmit((data) => {
    if (!selectedStaff) return
    const file = data.document?.[0]
    // Figma 5.8: files must be under 10 MB — reject client-side with the
    // frame's copy instead of letting the request fail.
    if (file && file.size > 10 * 1024 * 1024) {
      setFileTooLarge(true)
      return
    }
    setFileTooLarge(false)
    uploadMutation.mutate({ ...data, staffId: selectedStaff.staff_id || selectedStaff.id })
  })

  const handleDownload = async (doc: any) => {
    try {
      setDownloadError(null)
      const res = await api.get(doc.url, { responseType: 'blob' })
      const blob = new Blob([res.data])
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const filename = doc.url.split('/').pop() || 'document'
      a.download = filename.includes('.') ? filename : `${filename}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setDownloadError(err?.response?.data?.message || err?.message || 'Download failed. Please try again.')
    }
  }

  const counts = data?.counts || { compliant: 0, incomplete: 0, expiring: 0, expired: 0 }

  // Only shown when the organisation is genuinely mixed. On a single-nation
  // provider it would be the same label repeated down every row.
  const nations = useMemo(
    () => new Set((data?.staff || []).map((s: any) => s.vetting_nation).filter(Boolean)),
    [data]
  )
  const columns = useIdentityColumns(data?.staff)
  const showNations = nations.size > 1
  const columnSpan = 3 + columns.length + (showNations ? 1 : 0)
  const totalStaff = staffWithLocation.length
  const completeStaff = staffWithLocation.filter((s: any) => s.overall === 'compliant').length
  const docPill = (status: string) => {
    switch (status) {
      case 'valid': return { label: 'Valid', color: '#087A55', bgcolor: '#EAFBF5' }
      case 'expiring': return { label: 'Expiring', color: '#9A6700', bgcolor: '#FFF7E6' }
      case 'expired': return { label: 'Expired', color: '#B42318', bgcolor: '#FEF0F0' }
      default: return { label: 'Missing', color: '#51637A', bgcolor: '#F0F5FC' }
    }
  }
  const initials = (s: any) => `${(s.first_name || '?').slice(0, 1)}${(s.last_name || '?').slice(0, 1)}`.toUpperCase()

  return (
    <PageContainer>
      {/* ── Breadcrumb + header (Figma 5.6) ── */}
      <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 700, letterSpacing: '0.08em' }}>
        COMPLIANCE &amp; SAFETY / COMPLIANCE / DBS &amp; IDENTITY
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ mt: 0.5, mb: 2, gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>DBS &amp; identity</Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.5 }}>
            DBS certificates, right-to-work documents and their expiry dates.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
          <TextField
            select
            size="small"
            value={locationId}
            onChange={(e) => { setLocationId(e.target.value); setPage(0) }}
            aria-label="Filter by location"
            sx={{ minWidth: 150, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
          >
            <MenuItem value="all">All locations</MenuItem>
            {locations.map((l: any) => (
              <MenuItem key={l.id} value={String(l.id)}>{l.name}</MenuItem>
            ))}
          </TextField>
          <Button variant="text" size="small" onClick={() => navigate('/compliance')}
            sx={{ textTransform: 'none', fontWeight: 600 }}>
            Check Update Service
          </Button>
          <Button variant="contained" size="small" startIcon={<UploadIcon />} onClick={() => setUploadOpen(true)}
            sx={{ textTransform: 'none', fontWeight: 600 }}>
            Upload document
          </Button>
        </Stack>
      </Stack>

      {/* ── Alert banner (Figma 5.6): only when staff are missing documents ── */}
      {counts.incomplete > 0 && (
        <PremiumCard noBorder sx={{ p: 2.5, mb: 3, bgcolor: 'notice.error.bg', border: 'none' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" spacing={2}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ width: 32, height: 32, borderRadius: 2, bgcolor: theme.palette.background.paper, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <WarningIcon sx={{ color: 'notice.error.fg', fontSize: 18 }} />
              </Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'notice.error.fg' }}>
                  {counts.incomplete === totalStaff && totalStaff > 0
                    ? `None of your ${totalStaff} staff have documents on file`
                    : `${counts.incomplete} staff missing documents`}
                </Typography>
                <Typography variant="caption" sx={{ color: 'notice.error.fg' }}>
                  Inspectors check DBS and right to work first. Upload them for each person — you can also check DBS through the Update Service.
                </Typography>
              </Box>
            </Stack>
            <Button size="small" variant="contained" onClick={() => setUploadOpen(true)}
              sx={{ textTransform: 'none', fontWeight: 600, flexShrink: 0 }}>
              Upload document
            </Button>
          </Stack>
        </PremiumCard>
      )}

      <Tabs
        value={statusTab}
        onChange={(_, v) => { setStatusTab(v); setPage(0) }}
        sx={{ mb: 3 }}
      >
        <Tab value="all" label={`All staff ${totalStaff}`} sx={{ textTransform: 'none', fontWeight: 600 }} />
        <Tab value="incomplete" label={`Missing ${counts.incomplete}`} sx={{ textTransform: 'none', fontWeight: 600 }} />
        <Tab value="expiring" label={`Expiring ${counts.expiring}`} sx={{ textTransform: 'none', fontWeight: 600 }} />
        <Tab value="expired" label={`Expired ${counts.expired}`} sx={{ textTransform: 'none', fontWeight: 600 }} />
      </Tabs>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {([
          { title: 'Compliant', value: counts.compliant, valueColor: undefined, subtitle: 'All documents valid', icon: <CheckCircleIcon sx={{ fontSize: 20 }} />, iconColor: '#0164C8' },
          { title: 'Missing documents', value: counts.incomplete, valueColor: counts.incomplete > 0 ? '#B42318' : undefined, subtitle: 'Not uploaded yet', icon: <WarningIcon sx={{ fontSize: 20 }} />, iconColor: '#B42318' },
          { title: 'Expiring soon', value: counts.expiring, valueColor: undefined, subtitle: 'Within 30 days', icon: <ScheduleIcon sx={{ fontSize: 20 }} />, iconColor: '#0164C8' },
          { title: 'Expired', value: counts.expired, valueColor: undefined, subtitle: 'Needs renewal', icon: <ShieldCheckIcon sx={{ fontSize: 20 }} />, iconColor: '#0164C8' },
        ] as { title: string; value: number; valueColor?: string; subtitle: string; icon: React.ReactNode; iconColor: string }[]).map((c) => (
          <Grid item xs={6} md={3} key={c.title}>
            <PremiumCard noBorder sx={{ p: 2.5, height: '100%' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontWeight: 500, fontSize: '0.85rem' }}>
                  {c.title}
                </Typography>
                <Box sx={{
                  width: 32, height: 32, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(1,100,200,0.16)' : `${c.iconColor}14`, color: c.iconColor,
                }}>
                  {c.icon}
                </Box>
              </Stack>
              <Typography variant="h4" sx={{ fontWeight: 700, color: c.valueColor || theme.palette.text.primary, letterSpacing: '-0.03em', fontSize: '1.75rem' }}>
                {c.value}
              </Typography>
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary, mt: 0.5, fontSize: '0.78rem' }}>
                {c.subtitle}
              </Typography>
            </PremiumCard>
          </Grid>
        ))}
      </Grid>

      <PremiumCard noBorder sx={{ p: 0, mb: 3, overflow: 'hidden' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ px: 3, pt: 2.5, pb: 2, gap: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.01em' }}>Staff documents</Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              {totalStaff} staff · {completeStaff} complete
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
            <TextField
              size="small"
              placeholder="Search staff"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              sx={{ minWidth: 180, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
              InputProps={{
                startAdornment: <SearchIcon fontSize="small" sx={{ color: theme.palette.text.secondary, mr: 0.5 }} />,
              }}
            />
            <TextField
              select
              size="small"
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(0) }}
              aria-label="Filter by role"
              sx={{ minWidth: 130, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
            >
              <MenuItem value="all">All roles</MenuItem>
              {roleOptions.map((role: string) => (
                <MenuItem key={role} value={role}>{role.replace(/_/g, ' ')}</MenuItem>
              ))}
            </TextField>
          </Stack>
        </Stack>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#F8FAFC' }}>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary }}>Staff</TableCell>
              {showNations && <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary }}>Nation</TableCell>}
              {columns.map(t => (
                <TableCell key={t} sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, textAlign: 'center' }}>{identityTypeLabel(t)}</TableCell>
              ))}
              <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary }}>Overall</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary }} align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          {downloadError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDownloadError(null)}>{downloadError}</Alert>}
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={columnSpan}><CircularProgress size={24} sx={{ display: 'block', mx: 'auto', my: 2 }} /></TableCell></TableRow>
            ) : !data?.staff?.length ? (
              <TableRow><TableCell colSpan={columnSpan} sx={{ borderBottom: 'none' }}><EmptyState title="No identity records" description="Upload documents to get started" variant="default" /></TableCell></TableRow>
            ) : visibleStaff.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((s: any) => (
              <TableRow key={s.id} hover>
                <TableCell>
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: '#0164C8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>
                      {initials(s)}
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', lineHeight: 1.2 }}>{s.first_name} {s.last_name}</Typography>
                      {s.role && <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>{String(s.role).replace(/_/g, ' ')}</Typography>}
                    </Box>
                  </Stack>
                </TableCell>
                {showNations && (
                  <TableCell>
                    <Tooltip title={s.vetting_check_name ? `Requires a valid ${s.vetting_check_name}` : ''}>
                      <Chip label={nationLabel(s.vetting_nation)} size="small" variant="outlined" />
                    </Tooltip>
                  </TableCell>
                )}
                {columns.map(t => {
                  const info = s.statuses?.[t]
                  // The API points the check column at the document that
                  // actually satisfied it, which for Scotland may be a
                  // Disclosure Scotland record rather than a PVG certificate.
                  const doc = s.documents?.find((d: any) => d.type === t) || info?.doc
                  const status = info?.status || 'missing'
                  const pill = docPill(status)
                  const renewalLabel = doc?.renewal_status === 'renewed' ? 'Renewed' : doc?.renewal_status === 'requested' ? 'Renewal Req' : doc?.renewal_status === 'submitted' ? 'Pending Review' : ''
                  return (
                    <TableCell key={t} sx={{ textAlign: 'center' }}>
                      <Stack direction="column" alignItems="center" spacing={0.3}>
                        <Tooltip title={info?.doc?.expiry_date ? `Expires: ${new Date(info.doc.expiry_date).toLocaleDateString()}` : status === 'missing' ? 'Not uploaded' : 'Document valid'}>
                          <Chip
                            label={pill.label}
                            size="small"
                            sx={{ bgcolor: pill.bgcolor, color: pill.color, fontWeight: 700, fontSize: '0.7rem', height: 22 }}
                          />
                        </Tooltip>
                        {renewalLabel && <Chip label={renewalLabel} size="small" variant="outlined" color={doc?.renewal_status === 'renewed' ? 'success' : 'info'} sx={{ fontSize: 10, height: 20 }} />}
                        {doc?.status === 'pending' && (
                          <Stack direction="row" spacing={0.3} sx={{ mt: 0.3 }}>
                            <Button size="small" variant="contained" color="success"
                              sx={{ fontSize: '0.55rem', minWidth: 42, height: 20, p: 0 }}
                              disabled={approveMutation.isPending}
                              onClick={() => approveMutation.mutate({ id: doc.id, status: 'approved' })}>✓</Button>
                            <Button size="small" variant="contained" color="error"
                              sx={{ fontSize: '0.55rem', minWidth: 42, height: 20, p: 0 }}
                              disabled={approveMutation.isPending}
                              onClick={() => approveMutation.mutate({ id: doc.id, status: 'rejected' })}>✗</Button>
                          </Stack>
                        )}
                      </Stack>
                    </TableCell>
                  )
                })}
                <TableCell>
                  <Chip
                    label={s.overall === 'compliant' ? 'Complete' : s.overall === 'incomplete' ? 'Incomplete' : s.overall}
                    size="small"
                    sx={s.overall === 'compliant'
                      ? { bgcolor: '#EAFBF5', color: '#087A55', fontWeight: 700 }
                      : { bgcolor: '#FEF0F0', color: '#B42318', fontWeight: 700 }}
                  />
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        const member = members.find((m: any) => (s.email && m.email === s.email) || (m.staff_id && m.staff_id === s.id))
                        setSelectedStaff(member || { id: s.id, first_name: s.first_name, last_name: s.last_name, email: s.email })
                        setUploadOpen(true)
                      }}
                      sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', borderRadius: '999px' }}
                    >
                      Upload
                    </Button>
                    {columns.map(t => {
                      const doc = s.documents?.find((d: any) => d.type === t) || s.statuses?.[t]?.doc
                      if (!doc) return null
                      return (
                        <Tooltip key={t} title={`${identityTypeLabel(t)} - ${doc.status}`}>
                          <IconButton size="small" onClick={() => handleDownload(doc)} aria-label={`Download ${identityTypeLabel(t)}`}>
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )
                    })}
                    {s.overall !== 'compliant' && (
                      <Tooltip title="Send renewal reminder">
                        <IconButton size="small" color="warning" onClick={() => {
                          const expiring = s.documents?.find((d: any) => d.expiry_date)
                          if (expiring) remindMutation.mutate(expiring.id)
                        }} aria-label="Send renewal reminder">
                          <RemindIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={visibleStaff.length || 0}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[10]}
        />
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 3, py: 1.5, borderTop: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
            Showing {visibleStaff.length === 0 ? 0 : page * rowsPerPage + 1}–{Math.min((page + 1) * rowsPerPage, visibleStaff.length)} of {visibleStaff.length}
          </Typography>
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>Live counts</Typography>
        </Stack>
      </TableContainer>
      </PremiumCard>
      <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block', mt: 1 }}>
        Live: {counts.compliant} compliant, {counts.incomplete} missing, {counts.expiring} expiring, {counts.expired} expired. Real staff names and emails are not copied; the email column is moved into the staff profile.
      </Typography>

      <Dialog open={uploadOpen} onClose={() => { setUploadOpen(false); setUploadError(''); setFileTooLarge(false) }} maxWidth="sm" fullWidth>
        <DialogTitle>Upload a document</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
            Add a DBS certificate, passport, visa or right to work check for a staff member.
          </Typography>
          {uploadError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setUploadError('')}>{uploadError}</Alert>}
          {fileTooLarge && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFileTooLarge(false)}>
              That file is too large. Files must be under 10 MB. Try a smaller or lower-res version.
            </Alert>
          )}
          {uploadMutation.isPending && (
            <Box sx={{ mb: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>Uploading...</Typography>
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>Sending</Typography>
              </Stack>
              <LinearProgress />
            </Box>
          )}
          <Alert severity="info" sx={{ mb: 2 }}>
            Uploaded documents are marked <strong>Pending</strong> until reviewed by an Org Admin or Manager.
            Enable <strong>Auto-approve documents</strong> in Settings &gt; Organization to skip review.
          </Alert>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField select label="Document Type" fullWidth {...register('type', { required: true })}>
              {IDENTITY_DOCUMENT_TYPES.map(t => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </TextField>
            <Autocomplete
              options={members?.filter((m: any) => m.status === 'active') || []}
              getOptionLabel={(o: any) => `${o.first_name || ''} ${o.last_name || ''}`.trim() || o.email}
              value={selectedStaff}
              onChange={(_, v) => { setSelectedStaff(v); setValue('staffId', v?.id || '') }}
              renderInput={(params) => <TextField {...params} label="Search Staff" required />}
            />
            <TextField type="date" label="Expiry Date" fullWidth InputLabelProps={{ shrink: true }} {...register('expiryDate')} />
            <input type="file" {...register('document', { required: true })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadOpen(false)}>Cancel</Button>
          <Button onClick={handleFormSubmit} variant="contained" disabled={uploadMutation.isPending}>
            {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!renewalOpen} onClose={() => { setRenewalOpen(null); setRenewalFile(null); setRenewalExpiryDate('') }} maxWidth="sm" fullWidth>
        <DialogTitle>Submit Renewal — {identityTypeLabel(renewalOpen?.doc?.type || '') || renewalOpen?.doc?.type}</DialogTitle>
        <DialogContent>
          {submitRenewalMutation.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {(submitRenewalMutation.error as any)?.response?.data?.message || (submitRenewalMutation.error as any)?.message || 'Submission failed'}
            </Alert>
          )}
          <Alert severity="info" sx={{ mb: 2 }}>
            Submit the renewed document for {renewalOpen?.doc?.first_name} {renewalOpen?.doc?.last_name}.
            The old document will be marked as <strong>Renewed</strong>.
          </Alert>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField type="date" label="New Expiry Date" fullWidth InputLabelProps={{ shrink: true }} value={renewalExpiryDate} onChange={e => setRenewalExpiryDate(e.target.value)} />
            <input type="file" onChange={e => setRenewalFile(e.target.files?.[0] || null)} required />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setRenewalOpen(null); setRenewalFile(null); setRenewalExpiryDate('') }}>Cancel</Button>
          <Button onClick={() => {
            if (!renewalOpen?.doc?.id || !renewalFile) return
            submitRenewalMutation.mutate({ id: renewalOpen.doc.id, file: renewalFile, expiryDate: renewalExpiryDate || undefined })
          }} variant="contained" disabled={!renewalFile || submitRenewalMutation.isPending}>
            {submitRenewalMutation.isPending ? 'Submitting...' : 'Submit Renewal'}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  )
}


