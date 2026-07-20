import { useState } from 'react'
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, Chip, Stack, IconButton, Tooltip, Card, CardContent, TablePagination, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Autocomplete, Alert, CircularProgress } from '@mui/material'
import { Refresh as RefreshIcon, NotificationsActive as RemindIcon, Download as DownloadIcon, Upload as UploadIcon, ArrowBack as ArrowBackIcon, Autorenew as RenewIcon, CheckCircle as RenewDoneIcon } from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

const IDENTITY_TYPES = ['DBS', 'PASSPORT', 'VISA', 'RIGHT_TO_WORK']

const typeLabels: Record<string, string> = {
  DBS: 'DBS Check',
  PASSPORT: 'Passport',
  VISA: 'Visa',
  RIGHT_TO_WORK: 'Right to Work'
}

export default function IdentityMonitoringPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
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
    ...(membersData?.admin ? [membersData.admin] : []),
    ...(membersData?.staff || [])
  ].filter((m: any) => m.status === 'active')

  const remindMutation = useMutation({
    mutationFn: (id: string) => api.post(`/compliance/documents/${id}/renewal-reminder`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['identity-dashboard'] })
  })

  const requestRenewalMutation = useMutation({
    mutationFn: (id: string) => api.post(`/compliance/documents/${id}/request-renewal`),
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
  const [downloadError, setDownloadError] = useState<string | null>(null)
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identity-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      setUploadOpen(false)
      setUploadError('')
      reset()
      setSelectedStaff(null)
    },
    onError: (err: any) => {
      setUploadError(err.response?.data?.message || err.message || 'Upload failed')
    }
  })

  const handleFormSubmit = handleSubmit((data) => {
    if (!selectedStaff) return
    uploadMutation.mutate({ ...data, staffId: selectedStaff.staff_id || selectedStaff.id })
  })

  const statusColor = (overall: string) => {
    switch (overall) {
      case 'compliant': return 'success'
      case 'incomplete': return 'warning'
      case 'expiring': return 'warning'
      case 'expired': return 'error'
      default: return 'default'
    }
  }

  const docStatusColor = (status: string) => {
    switch (status) {
      case 'valid': return 'success'
      case 'expiring': return 'warning'
      case 'expired': return 'error'
      case 'missing': return 'default'
      default: return 'default'
    }
  }

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

  const needsRenewal = (status: string) => ['expired', 'expiring'].includes(status)
  const isRenewing = (doc: any) => doc?.renewal_status === 'requested' || doc?.renewal_status === 'submitted'
  const isRenewed = (doc: any) => doc?.renewal_status === 'renewed'

  const counts = data?.counts || { compliant: 0, incomplete: 0, expiring: 0, expired: 0 }

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/compliance')} sx={{ mb: 2, color: '#0F4C81', fontWeight: 600 }}>
        Back to Compliance Dashboard
      </Button>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4">DBS & Identity Monitoring</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" startIcon={<UploadIcon />} onClick={() => setUploadOpen(true)}>Upload Document</Button>
          <Button startIcon={<RefreshIcon />} onClick={() => queryClient.invalidateQueries({ queryKey: ['identity-dashboard'] })}>
            Refresh
          </Button>
        </Stack>
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 4 }}>
        <Box sx={{ flex: '1 1 180px', minWidth: 140 }}>
          <Card sx={{ bgcolor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 3 }}>
            <CardContent sx={{ textAlign: 'center', py: 3, '&:last-child': { pb: 3 } }}>
              <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1 }}>
                <Typography variant="h5" color="white" fontWeight={800}>{counts.compliant}</Typography>
              </Box>
              <Typography variant="body2" fontWeight={700} color="#166534">Compliant</Typography>
              <Typography variant="caption" color="#6B7280">All documents valid</Typography>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flex: '1 1 180px', minWidth: 140 }}>
          <Card sx={{ bgcolor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 3 }}>
            <CardContent sx={{ textAlign: 'center', py: 3, '&:last-child': { pb: 3 } }}>
              <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1 }}>
                <Typography variant="h5" color="white" fontWeight={800}>{counts.incomplete}</Typography>
              </Box>
              <Typography variant="body2" fontWeight={700} color="#92400E">Missing Docs</Typography>
              <Typography variant="caption" color="#6B7280">Not uploaded yet</Typography>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flex: '1 1 180px', minWidth: 140 }}>
          <Card sx={{ bgcolor: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 3 }}>
            <CardContent sx={{ textAlign: 'center', py: 3, '&:last-child': { pb: 3 } }}>
              <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: '#EA580C', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1 }}>
                <Typography variant="h5" color="white" fontWeight={800}>{counts.expiring}</Typography>
              </Box>
              <Typography variant="body2" fontWeight={700} color="#9A3412">Expiring Soon</Typography>
              <Typography variant="caption" color="#6B7280">Due within 30 days</Typography>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flex: '1 1 180px', minWidth: 140 }}>
          <Card sx={{ bgcolor: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: 3 }}>
            <CardContent sx={{ textAlign: 'center', py: 3, '&:last-child': { pb: 3 } }}>
              <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: '#E11D48', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1 }}>
                <Typography variant="h5" color="white" fontWeight={800}>{counts.expired}</Typography>
              </Box>
              <Typography variant="body2" fontWeight={700} color="#BE123C">Expired</Typography>
              <Typography variant="caption" color="#6B7280">Needs renewal</Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Staff</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
              {IDENTITY_TYPES.map(t => (
                <TableCell key={t} sx={{ fontWeight: 700, textAlign: 'center' }}>{typeLabels[t]}</TableCell>
              ))}
              <TableCell sx={{ fontWeight: 700 }}>Overall</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          {downloadError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDownloadError(null)}>{downloadError}</Alert>}
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8}><CircularProgress size={24} sx={{ display: 'block', mx: 'auto', my: 2 }} /></TableCell></TableRow>
            ) : !data?.staff?.length ? (
              <TableRow><TableCell colSpan={8} sx={{ textAlign: 'center', py: 4, color: '#9CA3AF' }}>No staff identity records found. Upload documents to get started.</TableCell></TableRow>
            ) : data?.staff?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((s: any) => (
              <TableRow key={s.id} hover>
                <TableCell sx={{ fontWeight: 600 }}>{s.first_name} {s.last_name}</TableCell>
                <TableCell>{s.email}</TableCell>
                {IDENTITY_TYPES.map(t => {
                  const info = s.statuses?.[t]
                  const doc = s.documents?.find((d: any) => d.type === t)
                  const renewalLabel = doc?.renewal_status === 'renewed' ? 'Renewed' : doc?.renewal_status === 'requested' ? 'Renewal Req' : doc?.renewal_status === 'submitted' ? 'Pending Review' : ''
                  return (
                    <TableCell key={t} sx={{ textAlign: 'center' }}>
                      <Stack direction="column" alignItems="center" spacing={0.3}>
                        <Tooltip title={info?.doc?.expiry_date ? `Expires: ${new Date(info.doc.expiry_date).toLocaleDateString()}` : info?.status === 'missing' ? 'Not uploaded' : 'Document valid'}>
                          <Chip
                            label={info?.status === 'valid' ? '✓' : info?.status === 'expiring' ? '⚠' : info?.status === 'expired' ? '✗' : '—'}
                            color={docStatusColor(info?.status || 'missing') as any}
                            size="small"
                            sx={{ minWidth: 28 }}
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
                  <Chip label={s.overall} color={statusColor(s.overall) as any} size="small" />
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    {IDENTITY_TYPES.map(t => {
                      const doc = s.documents?.find((d: any) => d.type === t)
                      if (!doc) return null
                      return (
                        <Tooltip key={t} title={`${typeLabels[t]} - ${doc.status}`}>
                          <IconButton size="small" onClick={() => handleDownload(doc)} aria-label={`Download ${typeLabels[t]}`}>
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )
                    })}
                    {IDENTITY_TYPES.map(t => {
                      const doc = s.documents?.find((d: any) => d.type === t)
                      if (!doc || !needsRenewal(s.statuses?.[t]?.status) || isRenewed(doc)) return null
                      if (isRenewing(doc)) {
                        return (
                          <Tooltip key={`submit-${t}`} title="Submit renewed document">
                            <IconButton size="small" color="info" onClick={() => setRenewalOpen({ doc })} aria-label="Submit renewal">
                              <RenewDoneIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )
                      }
                      return (
                        <Tooltip key={`request-${t}`} title="Request renewal">
                          <IconButton size="small" color="warning" onClick={() => requestRenewalMutation.mutate(doc.id)} aria-label="Request renewal">
                            <RenewIcon fontSize="small" />
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
          count={data?.staff?.length || 0}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[10]}
        />
      </TableContainer>

      <Dialog open={uploadOpen} onClose={() => { setUploadOpen(false); setUploadError('') }} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Identity Document</DialogTitle>
        <DialogContent>
          {uploadError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setUploadError('')}>{uploadError}</Alert>}
          <Alert severity="info" sx={{ mb: 2 }}>
            Uploaded documents are marked <strong>Pending</strong> until reviewed by an Org Admin or Manager.
            Enable <strong>Auto-approve documents</strong> in Settings &gt; Organization to skip review.
          </Alert>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField select label="Document Type" fullWidth {...register('type', { required: true })}>
              <MenuItem value="DBS">DBS Check</MenuItem>
              <MenuItem value="PASSPORT">Passport</MenuItem>
              <MenuItem value="VISA">Visa</MenuItem>
              <MenuItem value="RIGHT_TO_WORK">Right to Work</MenuItem>
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
        <DialogTitle>Submit Renewal — {typeLabels[renewalOpen?.doc?.type || ''] || renewalOpen?.doc?.type}</DialogTitle>
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
    </Box>
  )
}


