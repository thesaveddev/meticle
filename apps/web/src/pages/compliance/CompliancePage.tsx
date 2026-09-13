import React, { useState } from 'react'
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Stack, Autocomplete, Grid, Alert, TablePagination, LinearProgress, Collapse, IconButton, InputAdornment, Tooltip } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { Assignment as CompetencyIcon, Description as DocIcon, Assessment as ReadinessIcon, Verified as ComplianceIcon, People as PeopleIcon, Warning as WarningIcon, School as TrainingIcon, History as AuditIcon, TrendingUp as TrendIcon, Favorite as FavoriteIcon, Group as EngagementIcon, Search as SearchIcon, ExpandMore as ExpandMoreIcon, CheckCircle, Error as ErrorIcon, Security as ShieldIcon, VerifiedUser as DbsIcon, Refresh as PollIcon, Send as SubmitIcon, Add as AddIcon } from '@mui/icons-material'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'
import api from '../../services/api'
import { PremiumCard, StatCard, StatusBadge as DesignStatusBadge } from '../../components/design/PremiumCard'
import { EmptyState } from '../../components/design/EmptyState'
import { PortalAccessManager } from '../compliance-portal/CompliancePortalPage'

const QUALITY_RATINGS = [
  { min: 81, label: 'Good', color: '#10B981' },
  { min: 61, label: 'Requires Improvement', color: '#F59E0B' },
  { min: 0, label: 'Inadequate', color: '#DC2626' },
]

function getRating(score: number) {
  return QUALITY_RATINGS.find(r => score >= r.min) || QUALITY_RATINGS[2]
}

const MODULE_COLORS: Record<string, string> = {
  training: '#0F4C81',
  competency: '#6366F1',
  dbs: '#10B981',
  evidence: '#D946EF',
  readiness: '#F59E0B',
  satisfaction: '#E11D48',
  engagement: '#0EA5E9',
  dspt: '#005EB8',
  nutrition: '#10B981',
}

export default function CompliancePage() {
  const theme = useTheme()
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

  const { data: nutritionData } = useQuery({
    queryKey: ['nutrition-overview'],
    queryFn: async () => {
      const res = await api.get('/nutrition/overview')
      return res.data as any[]
    }
  })

  const isLoading = configsLoading || recordsLoading || membersLoading || docsLoading
  const isError = configsError || recordsError || membersError || docsError

  const allMembers: any[] = [
    ...(membersData?.admins?.length ? membersData.admins : (membersData?.admin ? [membersData.admin] : [])),
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

  const nutritionPeople = (nutritionData || []).filter((n: any) => n.dietary_type)
  const totalNutritionPeople = nutritionPeople.length
  const nutritionConcerns = nutritionPeople.filter((n: any) => (n.nutrition_concerns_7d || 0) > 0 || (n.refused_today || 0) > 0).length
  const nutritionCompliant = totalNutritionPeople > 0 ? Math.round(((totalNutritionPeople - nutritionConcerns) / totalNutritionPeople) * 100) : 100
  const nutritionRating = nutritionCompliant >= 80 ? { color: '#10B981', label: 'Good' } : nutritionCompliant >= 60 ? { color: '#F59E0B', label: 'Watch' } : { color: '#DC2626', label: 'Concern' }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>Loading compliance data...</Typography>
      </Box>
    )
  }

  if (isError) {
    return <Alert severity="error" sx={{ m: 2, borderRadius: '12px' }}>Failed to load compliance data. Please try again.</Alert>
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
      {/* ── Header ── */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ mb: 3, gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>Compliance Dashboard</Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.5 }}>
            Monitor staff compliance, training and regulatory readiness
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <PortalAccessManager orgId="" />
          <Button variant="outlined" startIcon={<AuditIcon />} onClick={() => setAuditOpen(true)} size="small"
            sx={{ textTransform: 'none', borderRadius: '12px', fontWeight: 600, borderColor: theme.palette.divider, color: theme.palette.text.primary }}>
            Audit Trail
          </Button>
        </Stack>
      </Stack>

      {/* ── Top section: Compliance ring + stats ── */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={5}>
          <PremiumCard noBorder sx={{ p: 4, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="overline" sx={{ letterSpacing: 1.5, mb: 1, color: theme.palette.text.secondary, fontWeight: 700, fontSize: '0.65rem' }}>
              OVERALL COMPLIANCE
            </Typography>
            <Box sx={{ position: 'relative', display: 'inline-flex', my: 1 }}>
              <Box sx={{
                width: 140, height: 140, borderRadius: '50%',
                border: `5px solid ${theme.palette.mode === 'dark' ? '#334155' : '#F1F5F9'}`,
                position: 'absolute',
              }} />
              <Box sx={{
                width: 140, height: 140, borderRadius: '50%',
                border: `5px solid ${rating.color}`,
                position: 'absolute',
                clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%)`,
                opacity: 0.15,
                bgcolor: rating.color,
              }} />
              <Box sx={{
                position: 'absolute', top: 0, left: 0, bottom: 0, right: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <Typography variant="h4" sx={{ fontWeight: 800, color: rating.color, lineHeight: 1, letterSpacing: '-0.02em' }}>
                  {overallCompliance.toFixed(1)}%
                </Typography>
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary, mt: 0.25, fontWeight: 600 }}>
                  COMPLIANT
                </Typography>
              </Box>
            </Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: rating.color, mt: 1 }}>{rating.label}</Typography>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
              {completedRecords} of {totalRecords} records completed
            </Typography>
          </PremiumCard>
        </Grid>
        <Grid item xs={12} md={7}>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <StatCard
                label="Active Staff"
                value={totalStaff}
                icon={<PeopleIcon sx={{ fontSize: 22 }} />}
                color="#0369A1"
                onClick={() => navigate('/staff')}
              />
            </Grid>
            <Grid item xs={6}>
              <StatCard
                label="Requirements"
                value={totalRequirements}
                icon={<ComplianceIcon sx={{ fontSize: 22 }} />}
                color={overallCompliance >= 80 ? '#10B981' : '#F59E0B'}
                onClick={() => { setExpandedSection('requirements'); navigate('/compliance/training') }}
              />
            </Grid>
            <Grid item xs={6}>
              <StatCard
                label="Pending Documents"
                value={pendingDocs}
                icon={<DocIcon sx={{ fontSize: 22 }} />}
                color={pendingDocs > 0 ? '#EA580C' : '#10B981'}
                onClick={() => navigate('/compliance/identity')}
              />
            </Grid>
            <Grid item xs={6}>
              <StatCard
                label="Staff With Gaps"
                value={staffWithGaps}
                icon={<WarningIcon sx={{ fontSize: 22 }} />}
                color={staffWithGaps > 0 ? '#DC2626' : '#10B981'}
                onClick={() => navigate('/compliance/records')}
              />
            </Grid>
            <Grid item xs={6}>
              <StatCard
                label="Nutrition"
                value={`${nutritionCompliant}%`}
                icon={<FavoriteIcon sx={{ fontSize: 22 }} />}
                color={nutritionRating.color}
                onClick={() => navigate('/nutrition')}
              />
            </Grid>
          </Grid>
        </Grid>
      </Grid>

      {/* ── Alert banner ── */}
      {overallCompliance < 80 || pendingDocs > 0 || incompleteRequirements > 0 || nutritionConcerns > 0 ? (
        <PremiumCard noBorder sx={{ p: 2.5, mb: 3, bgcolor: '#FEF2F2', border: 'none' }}>
          <Stack spacing={1.5}>
            {overallCompliance < 80 && (
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ErrorIcon sx={{ color: '#DC2626', fontSize: 18 }} />
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#DC2626' }}>Overall compliance is {overallCompliance}% — below 80% target</Typography>
                    <Typography variant="caption" sx={{ color: '#7F1D1D' }}>Review the Readiness Score for detailed gap analysis</Typography>
                  </Box>
                </Stack>
                <Button size="small" variant="contained" onClick={() => navigate('/compliance/readiness')}
                  sx={{ textTransform: 'none', borderRadius: '10px', bgcolor: '#DC2626', '&:hover': { bgcolor: '#B91C1C' }, fontWeight: 600, fontSize: '0.75rem' }}>View Gaps</Button>
              </Stack>
            )}
            {pendingDocs > 0 && (
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: '#FFF5D9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <DocIcon sx={{ color: '#D97706', fontSize: 18 }} />
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#92400E' }}>{pendingDocs} document{pendingDocs > 1 ? 's' : ''} pending review</Typography>
                    <Typography variant="caption" sx={{ color: '#78350F' }}>Review and approve or reject uploaded identity documents</Typography>
                  </Box>
                </Stack>
                <Button size="small" variant="outlined" onClick={() => navigate('/compliance/identity')}
                  sx={{ textTransform: 'none', borderRadius: '10px', borderColor: '#FCD34D', color: '#92400E', fontWeight: 600, fontSize: '0.75rem' }}>Review</Button>
              </Stack>
            )}
            {incompleteRequirements > 0 && (
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: '#FFF5D9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <WarningIcon sx={{ color: '#D97706', fontSize: 18 }} />
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#92400E' }}>{incompleteRequirements} requirement{incompleteRequirements > 1 ? 's' : ''} with gaps</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                      <Typography variant="caption" sx={{ color: '#78350F' }}>Click a requirement below to see which staff are missing it.</Typography>
                      <Button size="small" sx={{ fontSize: '0.7rem', p: 0, minWidth: 0, textTransform: 'none', textDecoration: 'underline', color: '#D97706' }} onClick={() => navigate('/compliance/training')}>Assign training</Button>
                      <Typography variant="caption" sx={{ color: '#9CA3AF' }}>|</Typography>
                      <Button size="small" sx={{ fontSize: '0.7rem', p: 0, minWidth: 0, textTransform: 'none', textDecoration: 'underline', color: '#D97706' }} onClick={() => navigate('/compliance/competency')}>Run assessments</Button>
                      <Typography variant="caption" sx={{ color: '#9CA3AF' }}>|</Typography>
                      <Button size="small" sx={{ fontSize: '0.7rem', p: 0, minWidth: 0, textTransform: 'none', textDecoration: 'underline', color: '#D97706' }} onClick={() => navigate('/compliance/identity')}>Upload docs</Button>
                    </Stack>
                  </Box>
                </Stack>
                <Button size="small" variant="outlined" onClick={() => { setExpandedSection('requirements'); navigate('/compliance/records') }}
                  sx={{ textTransform: 'none', borderRadius: '10px', borderColor: '#FCD34D', color: '#92400E', fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>View All Records</Button>
              </Stack>
            )}
            {nutritionConcerns > 0 && (
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: nutritionRating.color === '#DC2626' ? '#FEE2E2' : '#FFF5D9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FavoriteIcon sx={{ color: nutritionRating.color, fontSize: 18 }} />
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: nutritionRating.color === '#DC2626' ? '#991B1B' : '#92400E' }}>
                      {nutritionConcerns} person{nutritionConcerns > 1 ? 's' : ''} with nutrition concerns in the last 7 days
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                      <Typography variant="caption" sx={{ color: '#78350F' }}>
                        {nutritionPeople.filter((n: any) => (n.refused_today || 0) > 0).length > 0 &&
                          `${nutritionPeople.filter((n: any) => (n.refused_today || 0) > 0).length} refused meals today`}
                        {nutritionPeople.filter((n: any) => (n.refused_today || 0) > 0).length > 0 && nutritionPeople.filter((n: any) => (n.nutrition_concerns_7d || 0) > 0).length > 0 && ' · '}
                        {nutritionPeople.filter((n: any) => (n.nutrition_concerns_7d || 0) > 0).length > 0 &&
                          `${nutritionPeople.filter((n: any) => (n.nutrition_concerns_7d || 0) > 0).length} staff-flagged concerns`}
                      </Typography>
                      <Button size="small" sx={{ fontSize: '0.7rem', p: 0, minWidth: 0, textTransform: 'none', textDecoration: 'underline', color: '#D97706' }} onClick={() => navigate('/nutrition')}>View Nutrition</Button>
                    </Stack>
                  </Box>
                </Stack>
              </Stack>
            )}
          </Stack>
        </PremiumCard>
      ) : (
        <PremiumCard noBorder sx={{ p: 2.5, mb: 3, bgcolor: '#ECFDF5', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle sx={{ color: '#047857', fontSize: 18 }} />
          </Box>
          <Typography sx={{ fontWeight: 700, color: '#047857' }}>All compliance areas are on track, including nutrition.</Typography>
        </PremiumCard>
      )}

      {/* ── Module grid ── */}
      <PremiumCard noBorder sx={{ p: 3, mb: 3 }}>
        <Typography variant="overline" sx={{ mb: 2, color: theme.palette.text.secondary, fontWeight: 700, fontSize: '0.65rem', letterSpacing: 1.5, display: 'block' }}>COMPLIANCE MODULES</Typography>
        <Grid container spacing={1.5}>
          {[
            { label: 'Training Matrix', icon: <TrainingIcon sx={{ fontSize: 20 }} />, path: '/compliance/training', key: 'training' },
            { label: 'Competency', icon: <CompetencyIcon sx={{ fontSize: 20 }} />, path: '/compliance/competency', key: 'competency' },
            { label: 'DBS & Identity', icon: <ComplianceIcon sx={{ fontSize: 20 }} />, path: '/compliance/identity', key: 'dbs' },
            { label: 'Evidence Packs', icon: <DocIcon sx={{ fontSize: 20 }} />, path: '/compliance/evidence', key: 'evidence' },
            { label: 'Readiness Score', icon: <ReadinessIcon sx={{ fontSize: 20 }} />, path: '/compliance/readiness', key: 'readiness' },
            { label: 'Satisfaction', icon: <FavoriteIcon sx={{ fontSize: 20 }} />, path: '/compliance/satisfaction', key: 'satisfaction' },
            { label: 'Staff Engagement', icon: <EngagementIcon sx={{ fontSize: 20 }} />, path: '/compliance/engagement', key: 'engagement' },
            { label: 'NHS DSPT', icon: <ShieldIcon sx={{ fontSize: 20 }} />, path: '/compliance/dspt', key: 'dspt' },
            { label: 'Nutrition', icon: <FavoriteIcon sx={{ fontSize: 20 }} />, path: '/nutrition', key: 'nutrition' },
          ].map((a) => {
            const color = MODULE_COLORS[a.key] || '#0F4C81'
            return (
              <Grid item key={a.label}>
                <Box
                  onClick={() => navigate(a.path)}
                  sx={{
                    px: 2.5, py: 1.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.25,
                    borderRadius: '12px',
                    border: `1px solid ${theme.palette.divider}`,
                    transition: 'all 0.15s',
                    '&:hover': {
                      borderColor: color,
                      bgcolor: theme.palette.mode === 'dark' ? `${color}15` : `${color}06`,
                      boxShadow: theme.palette.mode === 'dark' ? '0 2px 8px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.04)',
                    },
                  }}
                >
                  <Box sx={{ color, display: 'flex' }}>{a.icon}</Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{a.label}</Typography>
                </Box>
              </Grid>
            )
          })}
        </Grid>
      </PremiumCard>

      {/* ── Collapsible Sections ── */}
      <RequirementsSectionWithCollapse
        configs={configs || []}
        records={records || []}
        membersData={membersData}
        expanded={expandedSection === 'requirements'}
        onToggle={() => setExpandedSection(expandedSection === 'requirements' ? '' : 'requirements')}
      />

      <DocumentsSectionWithCollapse
        expanded={expandedSection === 'documents'}
        onToggle={() => setExpandedSection(expandedSection === 'documents' ? '' : 'documents')}
      />

      <DbsSectionWithCollapse
        expanded={expandedSection === 'dbs'}
        onToggle={() => setExpandedSection(expandedSection === 'dbs' ? '' : 'dbs')}
      />

      <TrendSectionWithCollapse
        expanded={expandedSection === 'trend'}
        onToggle={() => setExpandedSection(expandedSection === 'trend' ? '' : 'trend')}
      />

      <AuditTrailDialog open={auditOpen} onClose={() => setAuditOpen(false)} />
    </Box>
  )
}

function SectionHeader({ label, count, expanded, onToggle, icon }: { label: string; count?: number; expanded: boolean; onToggle: () => void; icon: React.ReactNode }) {
  const theme = useTheme()
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      onClick={onToggle}
      sx={{ cursor: 'pointer', py: 1.5, '&:hover': { opacity: 0.8 } }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={{ color: '#1A2332', display: 'flex' }}>{icon}</Box>
        <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.01em' }}>{label}</Typography>
        {count !== undefined && (
          <Chip label={count} size="small" sx={{ bgcolor: '#E7EEF4', color: '#0F4C81', fontWeight: 700, minWidth: 28, height: 22, fontSize: '0.7rem' }} />
        )}
      </Stack>
      <IconButton size="small" sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.2s', color: theme.palette.text.secondary }}>
        <ExpandMoreIcon />
      </IconButton>
    </Stack>
  )
}

function RequirementsSectionWithCollapse({ configs, records, membersData, expanded, onToggle }: { configs: any[]; records: any[]; membersData: any; expanded: boolean; onToggle: () => void }) {
  const theme = useTheme()
  const navigate = useNavigate()
  const [selectedReq, setSelectedReq] = useState<any>(null)
  const [search, setSearch] = useState('')

  const allMembers: any[] = [
    ...(membersData?.admins?.length ? membersData.admins : (membersData?.admin ? [membersData.admin] : [])),
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
    <PremiumCard noBorder sx={{ mb: 3, overflow: 'hidden' }}>
      <Box sx={{ px: 3 }}>
        <SectionHeader label="Compliance Requirements" count={configs?.length} expanded={expanded} onToggle={onToggle} icon={<ComplianceIcon />} />
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ px: 3, pb: 3 }}>
          {configs.length === 0 && (
            <EmptyState title="No compliance requirements" description="Set up requirements to track staff compliance" variant="default" />
          )}
          {configs.length > 0 && items.length === 0 && search && (
            <EmptyState title="No matches found" description="Try a different search term" variant="search" />
          )}
          {items.length > 0 && (
            <>
              <TextField
                size="small"
                placeholder="Search requirements..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{ mb: 2, minWidth: 280, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} /></InputAdornment>,
                }}
              />
              <Stack spacing={1}>
                {items.map((r) => (
                  <Box key={r.id} onClick={() => setSelectedReq(r)}
                    sx={{
                      p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
                      borderRadius: '14px', border: `1px solid ${theme.palette.divider}`,
                      transition: 'all 0.15s',
                      '&:hover': { bgcolor: theme.palette.mode === 'dark' ? '#1E293B' : '#F8FAFC', borderColor: '#1A2332' },
                    }}>
                    <Box sx={{ flex: 1, mr: 2 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.875rem' }}>{r.name}</Typography>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75 }}>
                        <Box sx={{ flex: 1, maxWidth: 200 }}>
                          <LinearProgress variant="determinate" value={r.pct} sx={{
                            height: 6, borderRadius: 3,
                            bgcolor: theme.palette.mode === 'dark' ? '#334155' : '#F1F5F9',
                            '& .MuiLinearProgress-bar': { bgcolor: r.pct === 100 ? '#10B981' : r.pct >= 80 ? '#F59E0B' : '#DC2626', borderRadius: 3 }
                          }} />
                        </Box>
                        <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>{r.complete}/{r.total} staff · {r.pct}%</Typography>
                      </Stack>
                    </Box>
                    <DesignStatusBadge variant={r.pct === 100 ? 'completed' : r.pct >= 80 ? 'in-progress' : 'missed'} label={`${r.pct}%`} />
                  </Box>
                ))}
              </Stack>
            </>
          )}
        </Box>
      </Collapse>

      <Dialog open={!!selectedReq} onClose={() => setSelectedReq(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '18px' } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>{selectedReq?.name} — Staff Details</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ color: '#047857', fontWeight: 700, mb: 1 }}>Completed ({selectedStats?.completeStaff.length || 0})</Typography>
              {selectedStats?.completeStaff.length ? selectedStats.completeStaff.map((s: any, i: number) => (
                <Chip key={i} label={s.name} size="small" onClick={() => navigate(`/staff/${s.userId}`)}
                  sx={{ mr: 0.5, mb: 0.5, cursor: 'pointer', bgcolor: '#D1FAE5', color: '#047857', fontWeight: 600, '&:hover': { bgcolor: '#A7F3D0' } }} />
              )) : <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>None</Typography>}
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ color: '#D97706', fontWeight: 700, mb: 1 }}>Incomplete / Pending ({selectedStats?.incompleteStaff.length || 0})</Typography>
              {selectedStats?.incompleteStaff.length ? selectedStats.incompleteStaff.map((s: any, i: number) => (
                <Chip key={i} label={s.name} size="small" onClick={() => navigate(`/staff/${s.userId}`)}
                  sx={{ mr: 0.5, mb: 0.5, cursor: 'pointer', bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 600, '&:hover': { bgcolor: '#FDE68A' } }} />
              )) : <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>None</Typography>}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setSelectedReq(null)} sx={{ textTransform: 'none', borderRadius: '10px', color: theme.palette.text.secondary }}>Close</Button>
        </DialogActions>
      </Dialog>
    </PremiumCard>
  )
}

function DocumentsSectionWithCollapse({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const theme = useTheme()
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
    ...(membersData?.admins?.length ? membersData.admins : (membersData?.admin ? [membersData.admin] : [])),
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
    <PremiumCard noBorder sx={{ mb: 3, overflow: 'hidden' }}>
      <Box sx={{ px: 3 }}>
        <SectionHeader label="Identity Documents" count={totalDocs} expanded={expanded} onToggle={onToggle} icon={<DocIcon />} />
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ px: 3, pb: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Alert severity="info" sx={{ flex: 1, mr: 2, borderRadius: '12px' }}>
              Uploaded documents start as <strong>Pending</strong> until reviewed. Enable <strong>Auto-approve</strong> in Settings &gt; Organization to skip manual review.
            </Alert>
            <Button variant="contained" size="small" onClick={() => setOpen(true)}
              sx={{ textTransform: 'none', borderRadius: '10px', bgcolor: '#1A2332', '&:hover': { bgcolor: '#263347' }, fontWeight: 600, whiteSpace: 'nowrap' }}>Upload</Button>
          </Stack>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>Staff</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>Expiry</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', py: 6, borderBottom: 'none' }}><Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>Loading documents...</Typography></TableCell></TableRow>
                ) : docs.length === 0 ? (
                  <TableRow><TableCell colSpan={5} sx={{ borderBottom: 'none' }}><EmptyState title="No documents yet" description="Upload identity documents for staff compliance" variant="default" action={{ label: 'Upload document', onClick: () => setOpen(true) }} /></TableCell></TableRow>
                ) : (
                  docs.map((d: any) => (
                    <TableRow key={d.id} sx={{ '&:last-child td': { borderBottom: 'none' } }}>
                      <TableCell sx={{ borderBottom: `1px solid ${theme.palette.divider}`, fontWeight: 600 }}>{d.first_name && d.last_name ? `${d.first_name} ${d.last_name}` : '—'}</TableCell>
                      <TableCell sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>{d.type}</TableCell>
                      <TableCell sx={{ borderBottom: `1px solid ${theme.palette.divider}`, color: theme.palette.text.secondary, fontSize: '0.85rem' }}>{d.expiry_date ? new Date(d.expiry_date).toLocaleDateString() : '—'}</TableCell>
                      <TableCell sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                        <DesignStatusBadge variant={d.status === 'approved' ? 'completed' : d.status === 'rejected' ? 'missed' : 'in-progress'} label={d.status} />
                      </TableCell>
                      <TableCell sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                        {d.status === 'pending' && (
                          <Stack direction="row" spacing={0.5}>
                            <Button size="small" variant="contained"
                              disabled={docStatusMutation.isPending}
                              onClick={() => docStatusMutation.mutate({ id: d.id, status: 'approved' })}
                              sx={{ textTransform: 'none', borderRadius: '8px', bgcolor: '#047857', '&:hover': { bgcolor: '#065F46' }, fontSize: '0.7rem', minWidth: 60, py: 0.5 }}>Approve</Button>
                            <Button size="small" variant="contained"
                              disabled={docStatusMutation.isPending}
                              onClick={() => docStatusMutation.mutate({ id: d.id, status: 'rejected' })}
                              sx={{ textTransform: 'none', borderRadius: '8px', bgcolor: '#DC2626', '&:hover': { bgcolor: '#B91C1C' }, fontSize: '0.7rem', minWidth: 60, py: 0.5 }}>Reject</Button>
                          </Stack>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {totalDocs > 0 && (
            <TablePagination component="div" count={totalDocs} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} rowsPerPageOptions={[10, 25, 50]} />
          )}

          <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '18px' } }}>
            <DialogTitle sx={{ fontWeight: 800 }}>Upload Document</DialogTitle>
            <DialogContent>
              <Stack spacing={3} sx={{ mt: 1 }}>
                <TextField select label="Document Type" fullWidth {...register('type', { required: true })}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}>
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
                  renderInput={(params) => <TextField {...params} label="Search Staff" required sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />}
                />
                <TextField type="date" label="Expiry Date" fullWidth InputLabelProps={{ shrink: true }} {...register('expiryDate')}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
                <input type="file" {...register('document', { required: true })} />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 3, pt: 0 }}>
              <Button onClick={() => setOpen(false)} sx={{ textTransform: 'none', borderRadius: '10px', color: theme.palette.text.secondary }}>Cancel</Button>
              <Button onClick={handleFormSubmit} variant="contained" disabled={uploadMutation.isPending}
                sx={{ textTransform: 'none', borderRadius: '10px', bgcolor: '#1A2332', '&:hover': { bgcolor: '#263347' } }}>
                {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </Collapse>
    </PremiumCard>
  )
}

const DBS_LEVELS = ['standard', 'enhanced', 'enhanced_with_barred']
const DBS_WORKFORCE = ['adult', 'child', 'both']
const DBS_STATUS_COLORS: Record<string, string> = {
  draft: '#9CA3AF',
  submitted: '#3B82F6',
  in_progress: '#F59E0B',
  awaiting_identity: '#F97316',
  clear: '#10B981',
  disclosure: '#8B5CF6',
  cancelled: '#6B7280',
  error: '#DC2626',
}

function DbsSectionWithCollapse({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const theme = useTheme()
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
    ...(membersData?.admins?.length ? membersData.admins : (membersData?.admin ? [membersData.admin] : [])),
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
    <PremiumCard noBorder sx={{ mb: 3, overflow: 'hidden' }}>
      <Box sx={{ px: 3 }}>
        <SectionHeader label="DBS Checks" count={stats?.total} expanded={expanded} onToggle={onToggle} icon={<DbsIcon />} />
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ px: 3, pb: 3 }}>
          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }} onClose={() => setError('')}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2, borderRadius: '12px' }} onClose={() => setSuccess('')}>{success}</Alert>}

          <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap alignItems="center">
            {[
              { label: 'Clear', value: stats?.clear || 0, color: '#10B981' },
              { label: 'In Progress', value: stats?.in_progress || 0, color: '#F59E0B' },
              { label: 'Awaiting ID', value: stats?.awaiting_identity || 0, color: '#F97316' },
              { label: 'Expiring Soon', value: stats?.expiring_soon || 0, color: '#DC2626' },
            ].map(s => (
              <Chip key={s.label} label={`${s.label}: ${s.value}`} size="small"
                sx={{ bgcolor: theme.palette.mode === 'dark' ? `${s.color}25` : `${s.color}12`, color: s.color, fontWeight: 700, height: 26, borderRadius: '13px', fontSize: '0.75rem' }} />
            ))}
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setOpen(true)}
              sx={{ textTransform: 'none', borderRadius: '10px', bgcolor: '#1A2332', '&:hover': { bgcolor: '#263347' }, fontWeight: 600 }}>
              New DBS Check
            </Button>
          </Stack>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>Staff</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>Level</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>Workforce</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>Reference</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>Certificate</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>Requested</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} sx={{ textAlign: 'center', py: 6, borderBottom: 'none' }}><Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>Loading...</Typography></TableCell></TableRow>
                ) : !checks?.length ? (
                  <TableRow><TableCell colSpan={8} sx={{ borderBottom: 'none' }}><EmptyState title="No DBS checks yet" description="Click 'New DBS Check' to start one" variant="default" /></TableCell></TableRow>
                ) : checks.map((c: any) => (
                  <TableRow key={c.id} hover sx={{ '&:last-child td': { borderBottom: 'none' } }}>
                    <TableCell sx={{ fontWeight: 700, borderBottom: `1px solid ${theme.palette.divider}` }}>{c.staff_name}</TableCell>
                    <TableCell sx={{ borderBottom: `1px solid ${theme.palette.divider}`, textTransform: 'capitalize' }}>{c.level.replace(/_/g, ' ')}</TableCell>
                    <TableCell sx={{ borderBottom: `1px solid ${theme.palette.divider}`, textTransform: 'capitalize' }}>{c.workforce}</TableCell>
                    <TableCell sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                      <Chip label={c.status.replace(/_/g, ' ')} size="small"
                        sx={{ bgcolor: theme.palette.mode === 'dark' ? `${DBS_STATUS_COLORS[c.status]}25` : `${DBS_STATUS_COLORS[c.status]}18`, color: DBS_STATUS_COLORS[c.status], fontWeight: 700, fontSize: '0.7rem', height: 22, borderRadius: '11px' }} />
                    </TableCell>
                    <TableCell sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}><Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{c.application_reference || c.provider_reference || '—'}</Typography></TableCell>
                    <TableCell sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>{c.certificate_number || '—'}</TableCell>
                    <TableCell sx={{ borderBottom: `1px solid ${theme.palette.divider}`, color: theme.palette.text.secondary, fontSize: '0.85rem' }}>{new Date(c.created_at).toLocaleDateString()}</TableCell>
                    <TableCell align="right" sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        {c.status === 'draft' && (
                          <Tooltip title="Submit to DBS provider">
                            <IconButton size="small" color="primary" onClick={() => submitMutation.mutate(c.id)} disabled={submitMutation.isPending}
                              sx={{ color: '#0369A1', '&:hover': { bgcolor: '#DBEAFE' } }}>
                              {submitMutation.isPending ? <Typography variant="caption">...</Typography> : <SubmitIcon fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                        )}
                        {['submitted', 'in_progress', 'awaiting_identity'].includes(c.status) && (
                          <Tooltip title="Poll provider for status update">
                            <IconButton size="small" onClick={() => pollMutation.mutate(c.id)} disabled={pollMutation.isPending}
                              sx={{ color: theme.palette.text.secondary, '&:hover': { bgcolor: theme.palette.mode === 'dark' ? '#334155' : '#F1F5F9' } }}>
                              {pollMutation.isPending ? <Typography variant="caption">...</Typography> : <PollIcon fontSize="small" />}
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

          <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '18px' } }}>
            <DialogTitle sx={{ fontWeight: 800 }}>New DBS Check</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField select label="Staff Member" value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })} fullWidth required
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}>
                  {members.map((m: any) => (
                    <MenuItem key={m.staff_id} value={m.staff_id}>{`${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email}</MenuItem>
                  ))}
                </TextField>
                <TextField select label="DBS Level" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} fullWidth
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}>
                  {DBS_LEVELS.map(l => <MenuItem key={l} value={l}>{l.replace(/_/g, ' ')}</MenuItem>)}
                </TextField>
                <TextField select label="Workforce" value={form.workforce} onChange={(e) => setForm({ ...form, workforce: e.target.value })} fullWidth
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}>
                  {DBS_WORKFORCE.map(w => <MenuItem key={w} value={w}>{w.charAt(0).toUpperCase() + w.slice(1)}</MenuItem>)}
                </TextField>
                <TextField label="Cost (pence, optional)" type="number" value={form.costPence} onChange={(e) => setForm({ ...form, costPence: e.target.value })} fullWidth helperText="Leave blank if unknown"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 3, pt: 0 }}>
              <Button onClick={() => setOpen(false)} sx={{ textTransform: 'none', borderRadius: '10px', color: theme.palette.text.secondary }}>Cancel</Button>
              <Button variant="contained" onClick={handleCreate} disabled={createMutation.isPending}
                sx={{ textTransform: 'none', borderRadius: '10px', bgcolor: '#1A2332', '&:hover': { bgcolor: '#263347' } }}>
                {createMutation.isPending ? 'Creating...' : 'Create Check'}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </Collapse>
    </PremiumCard>
  )
}

function TrendSectionWithCollapse({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const theme = useTheme()
  const { data } = useQuery({
    queryKey: ['compliance-trends'],
    queryFn: async () => {
      const res = await api.get('/compliance/trends?days=30')
      return res.data as any[]
    }
  })

  return (
    <PremiumCard noBorder sx={{ mb: 3, overflow: 'hidden' }}>
      <Box sx={{ px: 3 }}>
        <SectionHeader label="Compliance Score Trend (30 days)" expanded={expanded} onToggle={onToggle} icon={<TrendIcon />} />
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ px: 3, pb: 3 }}>
          {!data || data.length === 0 ? (
            <EmptyState title="No trend data yet" description="Data is collected daily from compliance snapshots" variant="default" />
          ) : (
            <Box sx={{ mt: 1 }}>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data.map((d: any) => ({ date: new Date(d.snapshot_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), score: parseFloat(d.average_score || d.overall_score) }))} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: theme.palette.text.secondary }} stroke={theme.palette.divider} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: theme.palette.text.secondary }} stroke={theme.palette.divider} unit="%" />
                  <RechartsTooltip contentStyle={{ fontSize: 13, borderRadius: 12, border: `1px solid ${theme.palette.divider}`, backgroundColor: theme.palette.background.paper }} />
                  <Line type="monotone" dataKey="score" stroke="#1A2332" strokeWidth={2.5} dot={{ r: 4, fill: '#1A2332', stroke: theme.palette.background.paper, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          )}
        </Box>
      </Collapse>
    </PremiumCard>
  )
}

function AuditTrailDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const theme = useTheme()
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
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: '18px' } }}>
      <DialogTitle sx={{ fontWeight: 800 }}>Audit Trail</DialogTitle>
      <DialogContent>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>Action</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>Entity</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>User</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {auditError ? (
                <TableRow><TableCell colSpan={4} sx={{ borderBottom: 'none' }}><Alert severity="warning" sx={{ borderRadius: '12px', m: 1 }}>Audit trail requires ORG_ADMIN or SUPER_ADMIN access.</Alert></TableCell></TableRow>
              ) : logs?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((log: any) => (
                <TableRow key={log.id} sx={{ '&:last-child td': { borderBottom: 'none' } }}>
                  <TableCell sx={{ borderBottom: `1px solid ${theme.palette.divider}`, fontWeight: 600 }}>{log.action}</TableCell>
                  <TableCell sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>{log.entity_type}</TableCell>
                  <TableCell sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>{log.user_name || log.user_email || log.user_id || '—'}</TableCell>
                  <TableCell sx={{ borderBottom: `1px solid ${theme.palette.divider}`, color: theme.palette.text.secondary, fontSize: '0.85rem' }}>{new Date(log.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {!auditError && (!logs || logs.length === 0) && (
                <TableRow><TableCell colSpan={4} sx={{ borderBottom: 'none' }}><EmptyState title="No audit logs" description="Audit logs will appear here as actions are recorded" variant="default" /></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={logs?.length || 0}
          page={page}
          onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[10]}
        />
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', borderRadius: '10px', color: theme.palette.text.secondary }}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
