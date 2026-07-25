import React, { useState } from 'react'
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Stack, Autocomplete, Grid, Alert, TablePagination, CircularProgress, LinearProgress, Collapse, IconButton, InputAdornment, Tooltip } from '@mui/material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { Assignment as CompetencyIcon, Description as DocIcon, Assessment as ReadinessIcon, Verified as ComplianceIcon, People as PeopleIcon, Warning as WarningIcon, School as TrainingIcon, History as AuditIcon, TrendingUp as TrendIcon, Favorite as FavoriteIcon, Group as EngagementIcon, Search as SearchIcon, ExpandMore as ExpandMoreIcon, CheckCircle, Error as ErrorIcon, Security as ShieldIcon, VerifiedUser as DbsIcon, Refresh as PollIcon, Send as SubmitIcon, Add as AddIcon } from '@mui/icons-material'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'
import api from '../../services/api'

const QUALITY_RATINGS = [
  { min: 81, label: 'Good', color: '#16A34A' },
  { min: 61, label: 'Requires Improvement', color: '#F59E0B' },
  { min: 0, label: 'Inadequate', color: '#DC2626' },
]

function getRating(score: number) {
  return QUALITY_RATINGS.find(r => score >= r.min) || QUALITY_RATINGS[2]
}

export default function CompliancePage() {
  const navigate = useNavigate()
  const [auditOpen, setAuditOpen] = useState(false)
  const [expandedSection, setExpandedSection] = useState<string>('requirements')

  const { data: configs, isLoading: configsLoading, isError: configsError } = useQuery({
    queryKey: ['compliance-config'],
    queryFn: async () => {
      const res = await api.get('/settings/compliance-config')
      return res.data as any[]
    }
  })

  const { data: records, isLoading: recordsLoading, isError: recordsError } = useQuery({
    queryKey: ['compliance-records'],
    queryFn: async () => {
      const res = await api.get('/settings/compliance-records')
      return res.data as any[]
    },
    refetchInterval: 60_000,
  })

  const { data: membersData, isLoading: membersLoading, isError: membersError } = useQuery({
    queryKey: ['org-members'],
    queryFn: async () => {
      const res = await api.get('/staff/org-members')
      return res.data as any
    }
  })

  const { data: docsData, isLoading: docsLoading, isError: docsError } = useQuery({
    queryKey: ['documents-summary'],
    queryFn: async () => {
      const res = await api.get('/compliance/documents?limit=1000')
      return res.data as { data: any[], total: number }
    }
  })
  const docs = docsData?.data || []

  const isLoading = configsLoading || recordsLoading || membersLoading || docsLoading
  const isError = configsError || recordsError || membersError || docsError

  const allMembers: any[] = [
    ...(membersData?.admin ? [membersData.admin] : []),
    ...(membersData?.staff || [])
  ].filter((m: any) => m.status === 'active')

  const totalRequirements = configs?.length || 0
  const totalStaff = allMembers.length
  const completedRecords = records?.filter((r: any) => r.status === 'complete').length || 0
  const totalRecords = records?.length || 0
  const overallCompliance = totalRecords > 0 ? Math.round((completedRecords / totalRecords) * 1000) / 10 : 0
  const pendingDocs = docs.filter((d: any) => d.status === 'pending').length || 0

  const incompleteRequirements = (configs || []).filter(cfg => {
    const cfgRecords = (records || []).filter((r: any) => r.requirement_id === cfg.id)
    if (cfgRecords.length === 0) return true
    return cfgRecords.some((r: any) => r.status !== 'complete')
  }).length

  const staffWithGaps = new Set((records || []).filter((r: any) => r.status !== 'complete').map((r: any) => r.staff_id)).size

  const rating = getRating(overallCompliance)

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (isError) {
    return <Alert severity="error" sx={{ m: 2 }}>Failed to load compliance data. Please try again.</Alert>
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4">Compliance Dashboard</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<AuditIcon />} onClick={() => setAuditOpen(true)} size="small">Audit Trail</Button>
        </Stack>
      </Stack>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3, textAlign: 'center', border: `3px solid ${rating.color}`, borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1.5, mb: 1 }}>OVERALL COMPLIANCE</Typography>
            <Box sx={{ position: 'relative', display: 'inline-flex', my: 1 }}>
              <CircularProgress variant="determinate" value={100} size={140} thickness={5} sx={{ color: 'grey.200', position: 'absolute' }} />
              <CircularProgress variant="determinate" value={overallCompliance} size={140} thickness={5} sx={{ color: rating.color }} />
              <Box sx={{ position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="h5" fontWeight={800} sx={{ color: rating.color, lineHeight: 1 }}>{overallCompliance.toFixed(1)}%</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.25 }}>COMPLIANT</Typography>
              </Box>
            </Box>
            <Typography variant="h6" fontWeight={600} sx={{ color: rating.color }}>{rating.label}</Typography>
            <Typography variant="caption" color="text.secondary">
              {completedRecords} of {totalRecords} records completed
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={7}>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, borderLeft: '4px solid #0284C7', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }} onClick={() => navigate('/staff')}>
                <PeopleIcon sx={{ fontSize: 36, color: '#0284C7' }} />
                <Box>
                  <Typography variant="h5" fontWeight={700}>{totalStaff}</Typography>
                  <Typography variant="body2" color="text.secondary">Active Staff</Typography>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={6}>
              <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, borderLeft: `4px solid ${overallCompliance >= 80 ? '#16A34A' : '#F59E0B'}`, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }} onClick={() => { setExpandedSection('requirements'); navigate('/compliance/training') }}>
                <ComplianceIcon sx={{ fontSize: 36, color: overallCompliance >= 80 ? '#16A34A' : '#F59E0B' }} />
                <Box>
                  <Typography variant="h5" fontWeight={700}>{totalRequirements}</Typography>
                  <Typography variant="body2" color="text.secondary">Requirements</Typography>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={6}>
              <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, borderLeft: `4px solid ${pendingDocs > 0 ? '#EA580C' : '#16A34A'}`, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }} onClick={() => navigate('/compliance/identity')}>
                <DocIcon sx={{ fontSize: 36, color: pendingDocs > 0 ? '#EA580C' : '#16A34A' }} />
                <Box>
                  <Typography variant="h5" fontWeight={700}>{pendingDocs}</Typography>
                  <Typography variant="body2" color="text.secondary">Pending Documents</Typography>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={6}>
              <Paper onClick={() => navigate('/compliance/records')}
                sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, borderLeft: `4px solid ${staffWithGaps > 0 ? '#DC2626' : '#16A34A'}`, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}>
                <WarningIcon sx={{ fontSize: 36, color: staffWithGaps > 0 ? '#DC2626' : '#16A34A' }} />
                <Box>
                  <Typography variant="h5" fontWeight={700}>{staffWithGaps}</Typography>
                  <Typography variant="body2" color="text.secondary">Staff With Gaps</Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Grid>
      </Grid>

      {overallCompliance < 80 || pendingDocs > 0 || incompleteRequirements > 0 ? (
        <Paper sx={{ p: 2, mb: 3, bgcolor: '#FEF2F2', border: '1px solid #FECACA' }}>
          <Stack spacing={1.5}>
            {overallCompliance < 80 && (
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <ErrorIcon sx={{ color: '#DC2626', fontSize: 20 }} />
                  <Box>
                    <Typography variant="body2" fontWeight={600} color="error">Overall compliance is {overallCompliance}% — below 80% target</Typography>
                    <Typography variant="caption" color="text.secondary">Review the Readiness Score for detailed gap analysis</Typography>
                  </Box>
                </Stack>
                <Button size="small" variant="contained" color="error" onClick={() => navigate('/compliance/readiness')}>View Gaps</Button>
              </Stack>
            )}
            {pendingDocs > 0 && (
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <DocIcon sx={{ color: '#EA580C', fontSize: 20 }} />
                  <Box>
                    <Typography variant="body2" fontWeight={600} color="warning"> {pendingDocs} document{pendingDocs > 1 ? 's' : ''} pending review</Typography>
                    <Typography variant="caption" color="text.secondary">Review and approve or reject uploaded identity documents</Typography>
                  </Box>
                </Stack>
                <Button size="small" variant="outlined" color="warning" onClick={() => navigate('/compliance/identity')}>Review</Button>
              </Stack>
            )}
            {incompleteRequirements > 0 && (
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <WarningIcon sx={{ color: '#D97706', fontSize: 20 }} />
                  <Box>
                    <Typography variant="body2" fontWeight={600} color="warning"> {incompleteRequirements} requirement{incompleteRequirements > 1 ? 's' : ''} with gaps</Typography>
                    <Stack direction="row" spacing={1.5} flexWrap="wrap" alignItems="center">
                      <Typography variant="caption" color="text.secondary">Click a requirement below to see which staff are missing it.</Typography>
                      <Button size="small" sx={{ fontSize: '0.7rem', p: 0, minWidth: 0, textTransform: 'none', textDecoration: 'underline' }} color="warning" onClick={() => navigate('/compliance/training')}>Assign training</Button>
                      <Typography variant="caption" color="text.secondary">|</Typography>
                      <Button size="small" sx={{ fontSize: '0.7rem', p: 0, minWidth: 0, textTransform: 'none', textDecoration: 'underline' }} color="warning" onClick={() => navigate('/compliance/competency')}>Run assessments</Button>
                      <Typography variant="caption" color="text.secondary">|</Typography>
                      <Button size="small" sx={{ fontSize: '0.7rem', p: 0, minWidth: 0, textTransform: 'none', textDecoration: 'underline' }} color="warning" onClick={() => navigate('/compliance/identity')}>Upload docs</Button>
                    </Stack>
                  </Box>
                </Stack>
                <Button size="small" variant="outlined" color="warning" onClick={() => { setExpandedSection('requirements'); navigate('/compliance/records') }}>View All Records</Button>
              </Stack>
            )}
          </Stack>
        </Paper>
      ) : (
        <Paper sx={{ p: 2, mb: 3, bgcolor: '#F0FDF4', border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircle color="success" />
          <Typography fontWeight={600} color="success.main">All compliance areas are on track.</Typography>
        </Paper>
      )}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary' }}>COMPLIANCE MODULES</Typography>
        <Grid container spacing={1}>
          {[
            { label: 'Training Matrix', icon: <TrainingIcon />, path: '/compliance/training', color: '#0F4C81' },
            { label: 'Competency', icon: <CompetencyIcon />, path: '/compliance/competency', color: '#6366F1' },
            { label: 'DBS & Identity', icon: <ComplianceIcon />, path: '/compliance/identity', color: '#16A34A' },
            { label: 'Evidence Packs', icon: <DocIcon />, path: '/compliance/evidence', color: '#D946EF' },
            { label: 'Readiness Score', icon: <ReadinessIcon />, path: '/compliance/readiness', color: '#F59E0B' },
            { label: 'Satisfaction', icon: <FavoriteIcon sx={{ fontSize: 20 }} />, path: '/compliance/satisfaction', color: '#E11D48' },
            { label: 'Staff Engagement', icon: <EngagementIcon />, path: '/compliance/engagement', color: '#0EA5E9' },
            { label: 'NHS DSPT', icon: <ShieldIcon sx={{ fontSize: 20 }} />, path: '/compliance/dspt', color: '#005EB8' },
          ].map((a) => (
            <Grid item key={a.label}>
              <Paper
                variant="outlined"
                onClick={() => navigate(a.path)}
                sx={{
                  px: 2, py: 1.25, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1,
                  transition: 'all 0.15s', borderRadius: 2,
                  '&:hover': { borderColor: a.color, bgcolor: `${a.color}08`, boxShadow: 1 }
                }}
              >
                <Box sx={{ color: a.color, display: 'flex', fontSize: 20 }}>{a.icon}</Box>
                <Typography variant="body2" fontWeight={600} whiteSpace="nowrap">{a.label}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Collapsible Requirements Section */}
      <RequirementsSectionWithCollapse
        configs={configs || []}
        records={records || []}
        membersData={membersData}
        expanded={expandedSection === 'requirements'}
        onToggle={() => setExpandedSection(expandedSection === 'requirements' ? '' : 'requirements')}
      />

      {/* Collapsible Documents Section */}
      <DocumentsSectionWithCollapse
        expanded={expandedSection === 'documents'}
        onToggle={() => setExpandedSection(expandedSection === 'documents' ? '' : 'documents')}
      />

      {/* Collapsible DBS Checks Section */}
      <DbsSectionWithCollapse
        expanded={expandedSection === 'dbs'}
        onToggle={() => setExpandedSection(expandedSection === 'dbs' ? '' : 'dbs')}
      />

      {/* Collapsible Trend Section */}
      <TrendSectionWithCollapse
        expanded={expandedSection === 'trend'}
        onToggle={() => setExpandedSection(expandedSection === 'trend' ? '' : 'trend')}
      />

      <AuditTrailDialog open={auditOpen} onClose={() => setAuditOpen(false)} />
    </Box>
  )
}

function SectionHeader({ label, count, expanded, onToggle, icon }: { label: string; count?: number; expanded: boolean; onToggle: () => void; icon: React.ReactNode }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      onClick={onToggle}
      sx={{ cursor: 'pointer', py: 1.5, '&:hover': { opacity: 0.8 } }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={{ color: '#0F4C81', display: 'flex' }}>{icon}</Box>
        <Typography variant="h6">{label}</Typography>
        {count !== undefined && (
          <Chip label={count} size="small" sx={{ bgcolor: '#0F4C81', color: '#fff', fontWeight: 600, minWidth: 28 }} />
        )}
      </Stack>
      <IconButton size="small" sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }}>
        <ExpandMoreIcon />
      </IconButton>
    </Stack>
  )
}

function RequirementsSectionWithCollapse({ configs, records, membersData, expanded, onToggle }: { configs: any[]; records: any[]; membersData: any; expanded: boolean; onToggle: () => void }) {
  const navigate = useNavigate()
  const [selectedReq, setSelectedReq] = useState<any>(null)
  const [search, setSearch] = useState('')

  const allMembers: any[] = [
    ...(membersData?.admin ? [membersData.admin] : []),
    ...(membersData?.staff || [])
  ].filter((m: any) => m.status === 'active')

  const staffToUserMap = new Map(allMembers.map((m: any) => [m.staff_id || m.id, m.id]))
  const staffNameMap = new Map(allMembers.map((m: any) => [m.staff_id || m.id, `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email]))
  interface StaffEntry { name: string; userId: string }
  const recordMap: Record<string, { complete: number; total: number; completeStaff: StaffEntry[]; incompleteStaff: StaffEntry[] }> = {}

  if (records) {
    for (const r of records) {
      if (!recordMap[r.requirement_id]) {
        recordMap[r.requirement_id] = { complete: 0, total: 0, completeStaff: [], incompleteStaff: [] }
      }
      recordMap[r.requirement_id].total++
      const name = staffNameMap.get(r.staff_id) || `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.staff_id
      const userId = staffToUserMap.get(r.staff_id) || r.staff_id
      if (r.status === 'complete') {
        recordMap[r.requirement_id].complete++
        recordMap[r.requirement_id].completeStaff.push({ name, userId })
      } else {
        recordMap[r.requirement_id].incompleteStaff.push({ name, userId })
      }
    }
  }

  const totalStaff = allMembers.length
  const items = (configs || [])
    .map((cfg) => {
      const stats = recordMap[cfg.id] || { complete: 0, total: totalStaff, completeStaff: [], incompleteStaff: [] }
      if (!recordMap[cfg.id]) {
        stats.incompleteStaff = allMembers.map((m: any) => ({ name: `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email, userId: m.id }))
      }
      const pct = Math.round((stats.complete / (stats.total || 1)) * 100)
      return { ...cfg, ...stats, pct }
    })
    .filter(item => !search || item.name.toLowerCase().includes(search.toLowerCase()))

  const selectedStats = selectedReq && recordMap[selectedReq.id] ? recordMap[selectedReq.id] : null

  return (
    <Paper sx={{ mb: 2, overflow: 'hidden' }}>
      <Box sx={{ px: 3 }}>
        <SectionHeader label="Compliance Requirements" count={configs?.length} expanded={expanded} onToggle={onToggle} icon={<ComplianceIcon />} />
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ px: 3, pb: 3 }}>
          {configs.length === 0 && (
            <Typography sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>No compliance requirements found</Typography>
          )}
          {configs.length > 0 && items.length === 0 && search && (
            <Typography sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>No requirements matching your search</Typography>
          )}
          {items.length > 0 && (
            <>
              <TextField
                size="small"
                placeholder="Search requirements..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{ mb: 2, minWidth: 280 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                }}
              />
              <Stack spacing={1}>
                {items.map((r) => (
                  <Paper key={r.id} variant="outlined" sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }} onClick={() => setSelectedReq(r)}>
                    <Box sx={{ flex: 1, mr: 2 }}>
                      <Typography fontWeight={600} variant="body2">{r.name}</Typography>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                        <Box sx={{ flex: 1, maxWidth: 200 }}>
                          <LinearProgress variant="determinate" value={r.pct} sx={{ height: 6, borderRadius: 3, bgcolor: '#E2E8F0', '& .MuiLinearProgress-bar': { bgcolor: r.pct === 100 ? '#16A34A' : r.pct >= 80 ? '#F59E0B' : '#DC2626' } }} />
                        </Box>
                        <Typography variant="caption" color="text.secondary">{r.complete}/{r.total} staff &middot; {r.pct}%</Typography>
                      </Stack>
                    </Box>
                    <Chip label={`${r.pct}%`} size="small" color={r.pct === 100 ? 'success' : r.pct >= 80 ? 'warning' : 'error'} sx={{ fontWeight: 600, minWidth: 48 }} />
                  </Paper>
                ))}
              </Stack>
            </>
          )}
        </Box>
      </Collapse>

      <Dialog open={!!selectedReq} onClose={() => setSelectedReq(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedReq?.name} — Staff Details</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Box>
              <Typography variant="subtitle2" color="success.main" sx={{ mb: 1 }}>Completed ({selectedStats?.completeStaff.length || 0})</Typography>
              {selectedStats?.completeStaff.length ? selectedStats.completeStaff.map((s: any, i: number) => (
                <Chip key={i} label={s.name} size="small" color="success" variant="outlined" onClick={() => navigate(`/staff/${s.userId}`)} sx={{ mr: 0.5, mb: 0.5, cursor: 'pointer', '&:hover': { opacity: 0.8 } }} />
              )) : <Typography variant="body2" color="text.secondary">None</Typography>}
            </Box>
            <Box>
              <Typography variant="subtitle2" color="warning.main" sx={{ mb: 1 }}>Incomplete / Pending ({selectedStats?.incompleteStaff.length || 0})</Typography>
              {selectedStats?.incompleteStaff.length ? selectedStats.incompleteStaff.map((s: any, i: number) => (
                <Chip key={i} label={s.name} size="small" color="warning" variant="outlined" onClick={() => navigate(`/staff/${s.userId}`)} sx={{ mr: 0.5, mb: 0.5, cursor: 'pointer', '&:hover': { opacity: 0.8 } }} />
              )) : <Typography variant="body2" color="text.secondary">None</Typography>}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedReq(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}

function DocumentsSectionWithCollapse({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(0)
  const [rowsPerPage] = useState(10)
  const { register, handleSubmit, reset, setValue } = useForm()
  const [selectedStaff, setSelectedStaff] = useState<any>(null)

  const { data: docsRes, isLoading } = useQuery({
    queryKey: ['documents', page, rowsPerPage],
    queryFn: async () => {
      const response = await api.get(`/compliance/documents?page=${page}&limit=${rowsPerPage}`)
      return response.data as { data: any[], total: number }
    }
  })
  const docs = docsRes?.data || []
  const totalDocs = docsRes?.total || 0

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
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      setPage(0)
      setOpen(false)
      reset()
      setSelectedStaff(null)
    }
  })

  const handleFormSubmit = handleSubmit((data) => {
    if (!selectedStaff) return
    uploadMutation.mutate({ ...data, staffId: selectedStaff.staff_id || selectedStaff.id })
  })

  const docStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/compliance/documents/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] })
  })

  return (
    <Paper sx={{ mb: 2, overflow: 'hidden' }}>
      <Box sx={{ px: 3 }}>
        <SectionHeader label="Identity Documents" count={totalDocs} expanded={expanded} onToggle={onToggle} icon={<DocIcon />} />
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ px: 3, pb: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Alert severity="info" sx={{ flex: 1, mr: 2 }}>
              Uploaded documents start as <strong>Pending</strong> until reviewed. Enable <strong>Auto-approve</strong> in Settings &gt; Organization to skip manual review.
            </Alert>
            <Button variant="contained" size="small" onClick={() => setOpen(true)}>Upload</Button>
          </Stack>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Staff</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Expiry</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} sx={{ textAlign: 'center', py: 4 }}><CircularProgress size={24} /></TableCell></TableRow>
                ) : docs.length === 0 ? (
                  <TableRow><TableCell colSpan={4}>No documents found.</TableCell></TableRow>
                ) : (
                    docs.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell>{d.first_name && d.last_name ? `${d.first_name} ${d.last_name}` : '—'}</TableCell>
                      <TableCell>{d.type}</TableCell>
                      <TableCell>{d.expiry_date ? new Date(d.expiry_date).toLocaleDateString() : '—'}</TableCell>
                      <TableCell>
                        <Chip label={d.status} size="small" color={d.status === 'approved' ? 'success' : d.status === 'rejected' ? 'error' : 'warning'} />
                      </TableCell>
                      <TableCell>
                        {d.status === 'pending' && (
                          <Stack direction="row" spacing={0.5}>
                            <Button size="small" variant="contained" color="success" sx={{ fontSize: '0.65rem', minWidth: 60, height: 26 }}
                              disabled={docStatusMutation.isPending}
                              onClick={() => docStatusMutation.mutate({ id: d.id, status: 'approved' })}>Approve</Button>
                            <Button size="small" variant="contained" color="error" sx={{ fontSize: '0.65rem', minWidth: 60, height: 26 }}
                              disabled={docStatusMutation.isPending}
                              onClick={() => docStatusMutation.mutate({ id: d.id, status: 'rejected' })}>Reject</Button>
                          </Stack>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={totalDocs} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} rowsPerPageOptions={[10, 25, 50]} />

          <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogContent>
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
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleFormSubmit} variant="contained" disabled={uploadMutation.isPending}>{uploadMutation.isPending ? 'Uploading...' : 'Upload'}</Button>
            </DialogActions>
          </Dialog>
        </Box>
      </Collapse>
    </Paper>
  )
}

const DBS_LEVELS = ['standard', 'enhanced', 'enhanced_with_barred']
const DBS_WORKFORCE = ['adult', 'child', 'both']
const DBS_STATUS_COLORS: Record<string, string> = {
  draft: '#9CA3AF',
  submitted: '#3B82F6',
  in_progress: '#F59E0B',
  awaiting_identity: '#F97316',
  clear: '#16A34A',
  disclosure: '#8B5CF6',
  cancelled: '#6B7280',
  error: '#DC2626',
}

function DbsSectionWithCollapse({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ staffId: '', level: 'enhanced', workforce: 'adult', costPence: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const { data: checks, isLoading } = useQuery({
    queryKey: ['dbs-checks'],
    queryFn: async () => { const res = await api.get('/dbs/checks'); return res.data as any[] },
  })

  const { data: stats } = useQuery({
    queryKey: ['dbs-stats'],
    queryFn: async () => { const res = await api.get('/dbs/checks/stats'); return res.data as any },
  })

  const { data: membersData } = useQuery({
    queryKey: ['org-members'],
    queryFn: async () => { const res = await api.get('/staff/org-members'); return res.data as any },
  })
  const members: any[] = [
    ...(membersData?.admin ? [membersData.admin] : []),
    ...(membersData?.staff || [])
  ].filter((m: any) => m.staff_id && m.status === 'active')

  const invalidate = () => { queryClient.invalidateQueries({ queryKey: ['dbs-checks'] }); queryClient.invalidateQueries({ queryKey: ['dbs-stats'] }) }

  const createMutation = useMutation({
    mutationFn: async (data: any) => api.post('/dbs/checks', data),
    onSuccess: () => { invalidate(); setOpen(false); setForm({ staffId: '', level: 'enhanced', workforce: 'adult', costPence: '' }); setSuccess('DBS check created') },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to create check'),
  })

  const submitMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/dbs/checks/${id}/submit`),
    onSuccess: () => { invalidate(); setSuccess('DBS check submitted to provider') },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to submit'),
  })

  const pollMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/dbs/checks/${id}/poll`),
    onSuccess: (data) => { invalidate(); setSuccess(`Status updated: ${data.data.status}`) },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to poll'),
  })

  const handleCreate = () => {
    if (!form.staffId) { setError('Please select a staff member'); return }
    createMutation.mutate({ staffId: form.staffId, level: form.level, workforce: form.workforce, costPence: form.costPence ? parseInt(form.costPence) : undefined })
  }

  return (
    <Paper sx={{ mb: 2, overflow: 'hidden' }}>
      <Box sx={{ px: 3 }}>
        <SectionHeader label="DBS Checks" count={stats?.total} expanded={expanded} onToggle={onToggle} icon={<DbsIcon />} />
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ px: 3, pb: 3 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

          <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
            {[
              { label: 'Clear', value: stats?.clear || 0, color: '#16A34A' },
              { label: 'In Progress', value: stats?.in_progress || 0, color: '#F59E0B' },
              { label: 'Awaiting ID', value: stats?.awaiting_identity || 0, color: '#F97316' },
              { label: 'Expiring Soon', value: stats?.expiring_soon || 0, color: '#DC2626' },
            ].map(s => (
              <Chip key={s.label} label={`${s.label}: ${s.value}`} size="small" sx={{ bgcolor: `${s.color}18`, color: s.color, fontWeight: 700 }} />
            ))}
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setOpen(true)} sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' }, textTransform: 'none' }}>
              New DBS Check
            </Button>
          </Stack>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Staff</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Level</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Workforce</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Reference</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Certificate</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Requested</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} sx={{ textAlign: 'center', py: 4 }}><CircularProgress size={24} /></TableCell></TableRow>
                ) : !checks?.length ? (
                  <TableRow><TableCell colSpan={8} sx={{ textAlign: 'center', py: 4, color: '#9CA3AF' }}>No DBS checks yet. Click "New DBS Check" to start one.</TableCell></TableRow>
                ) : checks.map((c: any) => (
                  <TableRow key={c.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{c.staff_name}</TableCell>
                    <TableCell>{c.level.replace(/_/g, ' ')}</TableCell>
                    <TableCell>{c.workforce}</TableCell>
                    <TableCell>
                      <Chip label={c.status.replace(/_/g, ' ')} size="small" sx={{ bgcolor: `${DBS_STATUS_COLORS[c.status]}20`, color: DBS_STATUS_COLORS[c.status], fontWeight: 700, fontSize: '0.7rem' }} />
                    </TableCell>
                    <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{c.application_reference || c.provider_reference || '—'}</Typography></TableCell>
                    <TableCell>{c.certificate_number || '—'}</TableCell>
                    <TableCell><Typography variant="caption">{new Date(c.created_at).toLocaleDateString()}</Typography></TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        {c.status === 'draft' && (
                          <Tooltip title="Submit to DBS provider">
                            <IconButton size="small" color="primary" onClick={() => submitMutation.mutate(c.id)} disabled={submitMutation.isPending}>
                              {submitMutation.isPending ? <CircularProgress size={16} /> : <SubmitIcon fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                        )}
                        {['submitted', 'in_progress', 'awaiting_identity'].includes(c.status) && (
                          <Tooltip title="Poll provider for status update">
                            <IconButton size="small" onClick={() => pollMutation.mutate(c.id)} disabled={pollMutation.isPending}>
                              {pollMutation.isPending ? <CircularProgress size={16} /> : <PollIcon fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>New DBS Check</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField select label="Staff Member" value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })} fullWidth required>
                  {members.map((m: any) => (
                    <MenuItem key={m.staff_id} value={m.staff_id}>{`${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email}</MenuItem>
                  ))}
                </TextField>
                <TextField select label="DBS Level" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} fullWidth>
                  {DBS_LEVELS.map(l => <MenuItem key={l} value={l}>{l.replace(/_/g, ' ')}</MenuItem>)}
                </TextField>
                <TextField select label="Workforce" value={form.workforce} onChange={(e) => setForm({ ...form, workforce: e.target.value })} fullWidth>
                  {DBS_WORKFORCE.map(w => <MenuItem key={w} value={w}>{w.charAt(0).toUpperCase() + w.slice(1)}</MenuItem>)}
                </TextField>
                <TextField label="Cost (pence, optional)" type="number" value={form.costPence} onChange={(e) => setForm({ ...form, costPence: e.target.value })} fullWidth helperText="Leave blank if unknown" />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
              <Button variant="contained" onClick={handleCreate} disabled={createMutation.isPending} sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' }, textTransform: 'none' }}>
                {createMutation.isPending ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Create Check'}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </Collapse>
    </Paper>
  )
}

function TrendSectionWithCollapse({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const { data } = useQuery({
    queryKey: ['compliance-trends'],
    queryFn: async () => {
      const res = await api.get('/compliance/trends?days=30')
      return res.data as any[]
    }
  })

  return (
    <Paper sx={{ mb: 2, overflow: 'hidden' }}>
      <Box sx={{ px: 3 }}>
        <SectionHeader label="Compliance Score Trend (30 days)" expanded={expanded} onToggle={onToggle} icon={<TrendIcon />} />
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ px: 3, pb: 3 }}>
          {!data || data.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>No trend data available yet. Data is collected daily from compliance snapshots.</Typography>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.map((d: any) => ({ date: new Date(d.snapshot_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), score: parseFloat(d.average_score || d.overall_score) }))} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#9CA3AF" unit="%" />
                <RechartsTooltip contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #E5E7EB' }} />
                <Line type="monotone" dataKey="score" stroke="#0F4C81" strokeWidth={2} dot={{ r: 3, fill: '#0F4C81' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Box>
      </Collapse>
    </Paper>
  )
}

function AuditTrailDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [page, setPage] = useState(0)
  const [rowsPerPage] = useState(10)

  const { data: logs, isError: auditError } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: async () => {
      const response = await api.get('/audit/logs')
      return response.data
    },
    enabled: open,
  })

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Audit Trail</DialogTitle>
      <DialogContent>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Action</TableCell>
                <TableCell>Entity</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {auditError ? (
                <TableRow><TableCell colSpan={4}><Alert severity="warning" sx={{ m: 1 }}>Audit trail requires ORG_ADMIN or SUPER_ADMIN access.</Alert></TableCell></TableRow>
              ) : logs?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell>{log.action}</TableCell>
                  <TableCell>{log.entity_type}</TableCell>
                  <TableCell>{log.user_name || log.user_email || log.user_id || '—'}</TableCell>
                  <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {!auditError && (!logs || logs.length === 0) && (
                <TableRow><TableCell colSpan={4}>No audit logs recorded yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={logs?.length || 0}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[10]}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
