import React, { useState } from 'react'
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Stack, Autocomplete, Grid, Alert, TablePagination, LinearProgress, Collapse, IconButton, InputAdornment, Tooltip, Tabs, Tab } from '@mui/material'
import PageContainer from '../../components/design/PageContainer'
import { useTheme } from '@mui/material/styles'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { Description as DocIcon, Assessment as ReadinessIcon, Verified as ComplianceIcon, People as PeopleIcon, Warning as WarningIcon, School as TrainingIcon, History as AuditIcon, TrendingUp as TrendIcon, Favorite as FavoriteIcon, Group as EngagementIcon, Search as SearchIcon, ExpandMore as ExpandMoreIcon, CheckCircle, Error as ErrorIcon, Security as ShieldIcon, VerifiedUser as DbsIcon, Refresh as PollIcon, Send as SubmitIcon, Add as AddIcon, Edit as EditIcon, LocationOn as LocationIcon, ArrowForward as ArrowIcon, Download as DownloadIcon } from '@mui/icons-material'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'
import api from '../../services/api'
import { PremiumCard, StatusBadge as DesignStatusBadge } from '../../components/design/PremiumCard'
import { EmptyState } from '../../components/design/EmptyState'
import { IDENTITY_DOCUMENT_TYPES } from '../../data/identityDocuments'
import RegulatorRegistrationsPanel from '../../components/compliance/RegulatorRegistrationsPanel'
import { PortalAccessManager } from '../compliance-portal/CompliancePortalPage'
import { useSnackbar } from '../../context/SnackbarContext'
import { formatDateOnly, localToday } from '../../utils/dateFormat'
import { staffRecordPath } from '../../utils/staffRecordLink'
import {
  capitalise,
  DBS_LEVELS,
  DBS_WORKFORCE,
  duePhrase,
  UPDATE_SERVICE_CONSENT_METHODS,
  UPDATE_SERVICE_IDENTITY_METHODS,
  UPDATE_SERVICE_OUTCOMES,
  UPDATE_SERVICE_STATE_COLORS,
  UPDATE_SERVICE_STATE_LABELS,
  UPDATE_SERVICE_STATUS_COLORS,
} from '../../utils/updateService'
import { UpdateServiceRecordBody } from '../../components/UpdateServiceRecord'
import { P } from '../../styles/tokens'

const QUALITY_RATINGS = [
  { min: 81, label: 'Good', color: '#10B981' },
  { min: 61, label: 'Requires Improvement', color: '#F59E0B' },
  { min: 0, label: 'Inadequate', color: '#EF4444' },
]

function getRating(score: number) {
  return QUALITY_RATINGS.find(r => score >= r.min) || QUALITY_RATINGS[2]
}

function MetricCard({ value, valueColor, title, subtitle, icon, iconColor, onClick, progress }: {
  value: string | number; valueColor?: string; title: string; subtitle: string;
  icon: React.ReactNode; iconColor: string; onClick?: () => void; progress?: number
}) {
  const theme = useTheme()
  return (
    <PremiumCard
      noBorder
      sx={{
        p: { xs: 2.25, sm: 2.5 }, height: '100%', display: 'flex', flexDirection: 'column',
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick ? { borderColor: theme.palette.mode === 'dark' ? '#354357' : '#C3D2E2' } : {},
        '&:focus-visible': onClick ? { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 } : {},
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick() } } : undefined}
    >
      {/* Figma 5.5: title left, icon tile right on the top row; value then subtitle below */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontWeight: 500, fontSize: '0.85rem' }}>
          {title}
        </Typography>
        {progress !== undefined ? (
          <Box sx={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
            <Box
              sx={{
                width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `conic-gradient(${iconColor} ${Math.max(0, Math.min(100, progress)) * 3.6}deg, ${theme.palette.mode === 'dark' ? '#2A3C54' : '#EDF1F6'} 0deg)`,
              }}
            >
              <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: theme.palette.background.paper, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {icon}
              </Box>
            </Box>
          </Box>
        ) : (
          <Box sx={{
            width: 32, height: 32, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(1,100,200,0.16)' : `${iconColor}14`, color: iconColor,
          }}>
            {icon}
          </Box>
        )}
      </Stack>
      <Typography variant="h4" sx={{ fontWeight: 700, color: valueColor || theme.palette.text.primary, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', fontSize: '1.75rem' }}>
        {value}
      </Typography>
      <Typography variant="caption" sx={{ color: theme.palette.text.secondary, mt: 0.5, fontSize: '0.78rem' }}>
        {subtitle}
      </Typography>
    </PremiumCard>
  )
}

const MODULE_COLORS: Record<string, string> = {
  training: '#0164C8',
  competency: '#6B8AFD',
  dbs: '#10B981',
  evidence: '#8B7CF6',
  readiness: '#F59E0B',
  satisfaction: '#EF4444',
  engagement: '#0187BA',
  dspt: '#0164C8',
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

  const [locationId, setLocationId] = useState<string>('all')

  const { data: locationsData } = useQuery({
    queryKey: ['settings-locations'],
    queryFn: async () => {
      const res = await api.get('/settings/locations')
      return res.data as any[]
    }
  })
  const locations: any[] = Array.isArray(locationsData) ? locationsData : []

  // Module badges share the same query keys as the sections below, so they
  // read from the same cache rather than firing duplicate requests.
  const { data: trainingDash } = useQuery({
    queryKey: ['training-dashboard'],
    queryFn: async () => (await api.get('/training/dashboard')).data,
  })
  const { data: competencyPending } = useQuery({
    queryKey: ['competency-pending'],
    queryFn: async () => (await api.get('/competency/pending')).data,
  })
  const { data: satisfactionAgg } = useQuery({
    queryKey: ['satisfaction-aggregate'],
    queryFn: async () => (await api.get('/surveys/satisfaction/aggregate')).data,
  })
  const { data: engagementAgg } = useQuery({
    queryKey: ['engagement-aggregate'],
    queryFn: async () => (await api.get('/surveys/engagement/aggregate')).data,
  })
  const { data: readinessData } = useQuery({
    queryKey: ['cqc-readiness'],
    queryFn: async () => (await api.get('/cqc/readiness')).data?.data,
  })
  const { data: dbsChecksTop } = useQuery({
    queryKey: ['dbs-checks'],
    queryFn: async () => (await api.get('/dbs/checks')).data as any[],
  })
  const { data: dbsStatsTop } = useQuery({
    queryKey: ['dbs-stats'],
    queryFn: async () => (await api.get('/dbs/checks/stats')).data as any,
  })
  const { data: updateServiceStats } = useQuery({
    queryKey: ['dbs-update-service-stats'],
    queryFn: async () => (await api.get('/dbs/update-service/stats')).data as any,
  })

  const isLoading = configsLoading || recordsLoading || membersLoading || docsLoading
  const isError = configsError || recordsError || membersError || docsError

  const allMembers: any[] = [
    ...(membersData?.admins?.length ? membersData.admins : (membersData?.admin ? [membersData.admin] : [])),
    ...(membersData?.staff || [])
  ].filter((m: any) => m.status === 'active')

  const totalRequirements = configs?.length || 0
  const pendingDocs = docs.filter((d: any) => d.status === 'pending').length || 0

  const nutritionPeople = (nutritionData || []).filter((n: any) => n.dietary_type)
  const totalNutritionPeople = nutritionPeople.length
  const nutritionConcerns = nutritionPeople.filter((n: any) => (n.nutrition_concerns_7d || 0) > 0 || (n.refused_today || 0) > 0).length
  const nutritionCompliant = totalNutritionPeople > 0 ? Math.round(((totalNutritionPeople - nutritionConcerns) / totalNutritionPeople) * 100) : 100
  const nutritionRating = nutritionCompliant >= 80 ? { color: '#10B981', label: 'Good' } : nutritionCompliant >= 60 ? { color: '#F59E0B', label: 'Watch' } : { color: '#EF4444', label: 'Concern' }

  // ── Figma 5.1 header scope: the location filter narrows staff-derived
  // numbers (staff, records, requirements). Documents carry no location, so
  // document counts stay global rather than pretending to filter.
  const visibleMembers = locationId === 'all'
    ? allMembers
    : allMembers.filter((m: any) => m.location_id && String(m.location_id) === String(locationId))
  const visibleStaffIds = new Set(visibleMembers.map((m: any) => m.staff_id || m.id))
  const visibleRecords = (records || []).filter((r: any) => visibleStaffIds.has(r.staff_id))
  const totalStaffV = visibleMembers.length
  const completedRecordsV = visibleRecords.filter((r: any) => r.status === 'complete').length
  const totalRecordsV = visibleRecords.length
  const overallV = totalRecordsV > 0 ? Math.round((completedRecordsV / totalRecordsV) * 1000) / 10 : 0
  const overallVRounded = Math.round(overallV)
  const incompleteRequirementsV = (configs || []).filter(cfg => {
    const cfgRecords = visibleRecords.filter((r: any) => r.requirement_id === cfg.id)
    if (cfgRecords.length === 0) return true
    return cfgRecords.some((r: any) => r.status !== 'complete')
  }).length
  const staffWithGapsV = new Set(visibleRecords.filter((r: any) => r.status !== 'complete').map((r: any) => r.staff_id)).size
  const ratingV = getRating(overallV)

  // ── Module badges (live values, same shape as the Figma 5.1 frame) ──
  const trainingPct = typeof trainingDash?.overall?.percentage === 'number' ? trainingDash.overall.percentage : undefined
  const competencyPendingCount = Array.isArray(competencyPending) ? competencyPending.length : undefined
  const dbsTrackedIds = new Set((dbsChecksTop || []).map((c: any) => c.staff_id).filter(Boolean))
  const dbsMissing = visibleMembers.filter((m: any) => m.staff_id && !dbsTrackedIds.has(m.staff_id)).length
  const readinessPct = typeof readinessData?.overall === 'number' ? readinessData.overall : undefined
  const satisfactionTotal = typeof satisfactionAgg?.total === 'number' ? satisfactionAgg.total : undefined
  const engagementTotal = typeof engagementAgg?.total === 'number' ? engagementAgg.total : undefined

  // ── Documents at a glance (global: documents carry no location) ──
  const identityUploaded = docsData?.total ?? docs.length
  const dbsTracked = (dbsChecksTop || []).length || dbsStatsTop?.total || 0
  const updateChecked = updateServiceStats?.checks_last_30_days ?? 0
  const nowMs = Date.now()
  const expiringSoon = docs.filter((d: any) => {
    if (!d.expiry_date) return false
    const t = new Date(d.expiry_date).getTime()
    return t > nowMs && t <= nowMs + 30 * 24 * 60 * 60 * 1000
  }).length

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>Loading compliance data...</Typography>
      </Box>
    )
  }

  if (isError) {
    return <Alert severity="error" sx={{ m: 2, borderRadius: 2 }}>Failed to load compliance data. Please try again.</Alert>
  }

  return (
    <PageContainer>
      {/* ── Header (Figma 5.1: breadcrumb, title, actions, location filter) ── */}
      <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 700, letterSpacing: '0.08em' }}>
        COMPLIANCE & SAFETY / COMPLIANCE
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ mt: 0.5, mb: 2, gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>Compliance</Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.5 }}>
            Monitor staff compliance, training and inspection readiness.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
          <PortalAccessManager orgId="" />
          <Button variant="outlined" startIcon={<AuditIcon />} onClick={() => setAuditOpen(true)} size="small"
            sx={{ textTransform: 'none', fontWeight: 600, borderColor: theme.palette.divider, color: theme.palette.text.primary }}>
            Audit Trail
          </Button>
          <Button variant="contained" startIcon={<TrainingIcon />} onClick={() => navigate('/compliance/training')} size="small"
            sx={{ textTransform: 'none', fontWeight: 600 }}>
            Assign training
          </Button>
        </Stack>
      </Stack>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <LocationIcon sx={{ color: theme.palette.text.secondary, fontSize: 18 }} />
        <TextField
          select
          size="small"
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          aria-label="Filter by location"
          sx={{ minWidth: 180, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
        >
          <MenuItem value="all">All locations</MenuItem>
          {locations.map((l: any) => (
            <MenuItem key={l.id} value={String(l.id)}>{l.name}</MenuItem>
          ))}
        </TextField>
      </Stack>

      {/* ── Metric cards (Figma 5.5: title top-left, icon tile top-right, value, subtitle) ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={4} md>
          <MetricCard
            value={`${overallVRounded}%`}
            valueColor={ratingV.color}
            title="Overall compliance"
            subtitle={`${ratingV.label} - target 80%`}
            icon={<ErrorIcon sx={{ fontSize: 16 }} />}
            iconColor={ratingV.color}
            progress={overallVRounded}
            onClick={() => navigate('/compliance/readiness')}
          />
        </Grid>
        <Grid item xs={6} sm={4} md>
          <MetricCard
            value={totalStaffV}
            title="Active staff"
            subtitle={locations.length === 1 ? 'Across 1 location' : `Across ${locations.length} locations`}
            icon={<PeopleIcon sx={{ fontSize: 20 }} />}
            iconColor="#0164C8"
            onClick={() => navigate('/staff')}
          />
        </Grid>
        <Grid item xs={6} sm={4} md>
          <MetricCard
            value={totalRequirements}
            title="Requirements"
            subtitle="Mandatory for all staff"
            icon={<DocIcon sx={{ fontSize: 20 }} />}
            iconColor="#0164C8"
            onClick={() => { setExpandedSection('requirements'); navigate('/compliance/training') }}
          />
        </Grid>
        <Grid item xs={6} sm={4} md>
          <MetricCard
            value={pendingDocs}
            title="Pending documents"
            subtitle="Waiting for review"
            icon={<DocIcon sx={{ fontSize: 20 }} />}
            iconColor={pendingDocs > 0 ? '#F59E0B' : '#10B981'}
            onClick={() => navigate('/compliance/identity')}
          />
        </Grid>
        <Grid item xs={6} sm={4} md>
          <MetricCard
            value={`${nutritionCompliant}%`}
            title="Nutrition"
            subtitle="Meal records complete"
            icon={<FavoriteIcon sx={{ fontSize: 20 }} />}
            iconColor={nutritionRating.color}
            onClick={() => navigate('/nutrition')}
          />
        </Grid>
      </Grid>

      {/* ── Alert banner ── */}
      {overallV < 80 || pendingDocs > 0 || incompleteRequirementsV > 0 || nutritionConcerns > 0 ? (
        <PremiumCard noBorder sx={{ p: 2.5, mb: 3, bgcolor: 'notice.error.bg', border: 'none' }}>
          <Stack spacing={1.5}>
            {overallV < 80 && (
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ width: 32, height: 32, borderRadius: 2, bgcolor: 'notice.error.bg', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ErrorIcon sx={{ color: 'notice.error.fg', fontSize: 18 }} />
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'notice.error.fg' }}>Overall compliance is {overallVRounded}% — below your 80% target</Typography>
                    <Typography variant="caption" sx={{ color: 'notice.error.fg' }}>
                      {incompleteRequirementsV === totalRequirements && totalRequirements > 0
                        ? `None of the ${totalRequirements} requirements has been met by any of your ${totalStaffV} staff yet. The gaps list shows who is missing what.`
                        : `${incompleteRequirementsV} of ${totalRequirements} requirements have gaps across ${staffWithGapsV} staff. Select one below to see who is missing it.`}
                    </Typography>
                  </Box>
                </Stack>
                <Button size="small" variant="contained" onClick={() => { setExpandedSection('requirements'); requestAnimationFrame(() => document.getElementById('compliance-requirements')?.scrollIntoView({ behavior: 'smooth', block: 'start' })) }}
                  sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', flexShrink: 0, ml: 2 }}>View gaps</Button>
              </Stack>
            )}
            {pendingDocs > 0 && (
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ width: 32, height: 32, borderRadius: 2, bgcolor: 'notice.warning.bg', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <DocIcon sx={{ color: 'notice.warning.fg', fontSize: 18 }} />
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'notice.error.fg' }}>{pendingDocs} document{pendingDocs > 1 ? 's' : ''} pending review</Typography>
                    <Typography variant="caption" sx={{ color: 'notice.error.fg' }}>Review and approve or reject uploaded identity documents</Typography>
                  </Box>
                </Stack>
                <Button size="small" variant="outlined" onClick={() => navigate('/compliance/identity')}
                  sx={{ textTransform: 'none', borderColor: '#F59E0B', color: 'notice.error.fg', fontWeight: 600, fontSize: '0.75rem' }}>Review</Button>
              </Stack>
            )}
            {incompleteRequirementsV > 0 && (
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ width: 32, height: 32, borderRadius: 2, bgcolor: 'notice.warning.bg', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <WarningIcon sx={{ color: 'notice.warning.fg', fontSize: 18 }} />
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'notice.error.fg' }}>{incompleteRequirementsV} requirement{incompleteRequirementsV > 1 ? 's' : ''} with gaps</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                      <Typography variant="caption" sx={{ color: 'notice.error.fg' }}>Click a requirement below to see which staff are missing it.</Typography>
                      <Button size="small" sx={{ fontSize: '0.7rem', p: 0, minWidth: 0, textTransform: 'none', textDecoration: 'underline', color: 'notice.error.fg' }} onClick={() => navigate('/compliance/training')}>Assign training</Button>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>|</Typography>
                      <Button size="small" sx={{ fontSize: '0.7rem', p: 0, minWidth: 0, textTransform: 'none', textDecoration: 'underline', color: 'notice.error.fg' }} onClick={() => navigate('/compliance/competency')}>Run assessments</Button>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>|</Typography>
                      <Button size="small" sx={{ fontSize: '0.7rem', p: 0, minWidth: 0, textTransform: 'none', textDecoration: 'underline', color: 'notice.error.fg' }} onClick={() => navigate('/compliance/identity')}>Upload docs</Button>
                    </Stack>
                  </Box>
                </Stack>
                <Button size="small" variant="outlined" onClick={() => { setExpandedSection('requirements'); navigate('/compliance/records') }}
                  sx={{ textTransform: 'none', borderColor: '#F59E0B', color: 'notice.error.fg', fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>View All Records</Button>
              </Stack>
            )}
            {nutritionConcerns > 0 && (
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ width: 32, height: 32, borderRadius: 2, bgcolor: nutritionRating.color === '#EF4444' ? '#FEF0F0' : '#FFF7E6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FavoriteIcon sx={{ color: nutritionRating.color, fontSize: 18 }} />
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: nutritionRating.color === '#EF4444' ? '#B42318' : '#9A6700' }}>
                      {nutritionConcerns} person{nutritionConcerns > 1 ? 's' : ''} with nutrition concerns in the last 7 days
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                      <Typography variant="caption" sx={{ color: 'notice.error.fg' }}>
                        {nutritionPeople.filter((n: any) => (n.refused_today || 0) > 0).length > 0 &&
                          `${nutritionPeople.filter((n: any) => (n.refused_today || 0) > 0).length} refused meals today`}
                        {nutritionPeople.filter((n: any) => (n.refused_today || 0) > 0).length > 0 && nutritionPeople.filter((n: any) => (n.nutrition_concerns_7d || 0) > 0).length > 0 && ' · '}
                        {nutritionPeople.filter((n: any) => (n.nutrition_concerns_7d || 0) > 0).length > 0 &&
                          `${nutritionPeople.filter((n: any) => (n.nutrition_concerns_7d || 0) > 0).length} staff-flagged concerns`}
                      </Typography>
                      <Button size="small" sx={{ fontSize: '0.7rem', p: 0, minWidth: 0, textTransform: 'none', textDecoration: 'underline', color: 'notice.error.fg' }} onClick={() => navigate('/nutrition')}>View Nutrition</Button>
                    </Stack>
                  </Box>
                </Stack>
              </Stack>
            )}
          </Stack>
        </PremiumCard>
      ) : (
        <PremiumCard noBorder sx={{ p: 2.5, mb: 3, bgcolor: 'notice.success.bg', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 32, height: 32, borderRadius: 2, bgcolor: 'notice.success.bg', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle sx={{ color: 'notice.success.fg', fontSize: 18 }} />
          </Box>
          <Typography sx={{ fontWeight: 700, color: 'notice.success.fg' }}>All compliance areas are on track, including nutrition.</Typography>
        </PremiumCard>
      )}

      {/* ── Compliance modules (Figma 5.1) ── */}
      <PremiumCard noBorder sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.01em' }}>Compliance modules</Typography>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
          Open a module to see the detail behind each score
        </Typography>
        <Grid container spacing={2}>
          {([

            {
              key: 'training', title: 'Training matrix', desc: 'Who has completed each course and when it expires.',
              path: '/compliance/training', icon: <TrainingIcon sx={{ fontSize: 20 }} />,
              badge: trainingPct !== undefined ? `${Math.round(trainingPct)}%` : undefined, badgeTone: 'blue',
              progress: trainingPct !== undefined ? Math.round(trainingPct) : undefined,
            },
            {
              key: 'competency', title: 'Competency', desc: 'Observed assessments, templates and records.',
              path: '/compliance/competency', icon: <CheckCircle sx={{ fontSize: 20 }} />,
              badge: competencyPendingCount !== undefined ? `${competencyPendingCount} pending` : undefined, badgeTone: 'muted',
            },
            {
              key: 'dbs', title: 'DBS & identity', desc: 'DBS, passport, visa and right-to-work documents.',
              path: '/compliance/identity', icon: <DbsIcon sx={{ fontSize: 20 }} />,
              badge: dbsMissing > 0 ? `${dbsMissing} missing` : 'All tracked', badgeTone: dbsMissing > 0 ? 'red' : 'green',
            },
            {
              key: 'evidence', title: 'Evidence packs', desc: 'Inspection-ready bundles mapped to the key questions.',
              path: '/compliance/evidence', icon: <DocIcon sx={{ fontSize: 20 }} />,
              badge: undefined, badgeTone: 'muted',
            },
            {
              key: 'readiness', title: 'Readiness score', desc: 'How ready you are against the CQC framework.',
              path: '/compliance/readiness', icon: <ReadinessIcon sx={{ fontSize: 20 }} />,
              badge: readinessPct !== undefined ? `${Math.round(readinessPct)}%` : undefined, badgeTone: 'blue',
              progress: readinessPct !== undefined ? Math.round(readinessPct) : undefined,
            },
            {
              key: 'satisfaction', title: 'Satisfaction', desc: 'Feedback from people supported and families.',
              path: '/compliance/satisfaction', icon: <FavoriteIcon sx={{ fontSize: 20 }} />,
              badge: satisfactionTotal !== undefined ? (satisfactionTotal > 0 ? `${satisfactionTotal} responses` : 'No surveys') : undefined, badgeTone: 'muted',
            },
            {
              key: 'engagement', title: 'Staff engagement', desc: 'Team surveys and supervision.',
              path: '/compliance/engagement', icon: <EngagementIcon sx={{ fontSize: 20 }} />,
              badge: engagementTotal !== undefined ? (engagementTotal > 0 ? `${engagementTotal} responses` : 'No surveys') : undefined, badgeTone: 'muted',
            },
            {
              key: 'dspt', title: 'NHS DSPT', desc: 'Data Security and Protection Toolkit.',
              path: '/compliance/dspt', icon: <ShieldIcon sx={{ fontSize: 20 }} />,
              badge: undefined, badgeTone: 'muted',
            },
            {
              key: 'nutrition', title: 'Nutrition', desc: 'Meal plans and hydration records.',
              path: '/nutrition', icon: <FavoriteIcon sx={{ fontSize: 20 }} />,
              badge: `${nutritionCompliant}%`, badgeTone: 'green',
            },
          ] as { key: string; title: string; desc: string; path: string; icon: React.ReactNode; badge: string | undefined; badgeTone: 'blue' | 'muted' | 'red' | 'green'; progress?: number }[]).map((a) => {
            const color = MODULE_COLORS[a.key] || '#0164C8'
            const badgeStyles = {
              blue: { color: '#0164C8', bgcolor: '#EAF3FF' },
              muted: { color: '#51637A', bgcolor: '#F0F5FC' },
              red: { color: '#B42318', bgcolor: '#FEF0F0' },
              green: { color: '#087A55', bgcolor: '#EAFBF5' },
            }[a.badgeTone]
            return (
              <Grid item xs={12} sm={6} md={4} key={a.key}>
                <Box
                  onClick={() => navigate(a.path)}
                  sx={{
                    p: 2.5, height: '100%', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 1,
                    borderRadius: 2, border: `1px solid ${theme.palette.divider}`,
                    transition: 'all 0.15s',
                    '&:hover': {
                      borderColor: color,
                      bgcolor: theme.palette.mode === 'dark' ? `${color}15` : `${color}06`,
                      boxShadow: theme.palette.mode === 'dark' ? '0 2px 8px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.04)',
                    },
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                    <Box sx={{
                      width: 36, height: 36, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: theme.palette.mode === 'dark' ? `${color}22` : `${color}12`, color,
                    }}>
                      {a.icon}
                    </Box>
                    {a.badge ? (
                      <Chip label={a.badge} size="small" sx={{ ...badgeStyles, fontWeight: 700, fontSize: '0.7rem', height: 22, flexShrink: 0, borderRadius: '999px' }} />
                    ) : <Box sx={{ width: 22 }} />}
                  </Stack>
                  <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.5 }}>{a.title}</Typography>
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontSize: '0.85rem', flex: 1 }}>{a.desc}</Typography>
                  {a.progress !== undefined && (
                    <Box sx={{ height: 6, borderRadius: 3, bgcolor: theme.palette.mode === 'dark' ? '#2A3C54' : '#EDF1F6', overflow: 'hidden' }}>
                      <Box sx={{ width: `${a.progress}%`, height: 6, borderRadius: 3, bgcolor: color }} />
                    </Box>
                  )}
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: '#0164C8', fontWeight: 600, fontSize: '0.85rem' }}>
                    Open <ArrowIcon sx={{ fontSize: 16 }} />
                  </Stack>
                </Box>
              </Grid>
            )
          })}
        </Grid>
      </PremiumCard>

      {/* ── Requirements + Documents side-by-side (Figma 5.5) ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={8}>
          <Box id="compliance-requirements" sx={{ scrollMarginTop: 88 }}>
            <RequirementsSectionWithCollapse
              configs={configs || []}
              records={records || []}
              membersData={membersData}
              locationId={locationId}
              expanded={expandedSection === 'requirements'}
              onToggle={() => setExpandedSection(expandedSection === 'requirements' ? '' : 'requirements')}
            />
          </Box>
        </Grid>
        <Grid item xs={12} md={4}>
          <PremiumCard noBorder sx={{ p: 3, mb: { xs: 3, md: 0 }, height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.01em', mb: 2 }}>Documents at a glance</Typography>
            <Stack spacing={0}>
              {[
                { label: 'Identity documents', value: `${identityUploaded} uploaded` },
                { label: 'DBS tracking', value: `${dbsTracked} tracked` },
                { label: 'DBS Update Service', value: `${updateChecked} checked` },
                { label: 'Expiring in 30 days', value: expiringSoon > 0 ? `${expiringSoon} due soon` : 'None' },
              ].map((row, i, arr) => (
                <Stack
                  key={row.label}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ py: 1.5, borderBottom: i < arr.length - 1 ? `1px solid ${theme.palette.divider}` : 'none' }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.label}</Typography>
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>{row.value}</Typography>
                </Stack>
              ))}
            </Stack>
          </PremiumCard>
        </Grid>
      </Grid>

      <DocumentsSectionWithCollapse
        expanded={expandedSection === 'documents'}
        onToggle={() => setExpandedSection(expandedSection === 'documents' ? '' : 'documents')}
      />

      <DbsSectionWithCollapse
        expanded={expandedSection === 'dbs'}
        onToggle={() => setExpandedSection(expandedSection === 'dbs' ? '' : 'dbs')}
      />

      <UpdateServiceSectionWithCollapse
        expanded={expandedSection === 'update-service'}
        onToggle={() => setExpandedSection(expandedSection === 'update-service' ? '' : 'update-service')}
      />

      <TrendSectionWithCollapse
        expanded={expandedSection === 'trend'}
        onToggle={() => setExpandedSection(expandedSection === 'trend' ? '' : 'trend')}
      />

      {/* Regulator registration (Figma 5.1) sits below the trends: the one
          compliance thing an inspector asks for first. */}
      <Box sx={{ mt: 3 }} id="regulator-registration" >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.01em' }}>Regulator registration</Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              Your registration number with each regulator you are registered with
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            onClick={() => document.getElementById('regulator-registration')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            sx={{ textTransform: 'none', fontWeight: 600, flexShrink: 0 }}
          >
            Add a regulator
          </Button>
        </Stack>
        <RegulatorRegistrationsPanel />
        <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block', mt: 1.5 }}>
          Live data. All UK regulators are listed above with their recorded status.{trainingPct !== undefined ? ` Training matrix shows ${Math.round(trainingPct)}% because it counts completed courses; this page counts requirements met by every staff member.` : ''}
        </Typography>
      </Box>

      <AuditTrailDialog open={auditOpen} onClose={() => setAuditOpen(false)} />
    </PageContainer>
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
        <Box sx={{ color: 'text.primary', display: 'flex' }}>{icon}</Box>
        <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.01em' }}>{label}</Typography>
        {count !== undefined && (
          <Chip label={count} size="small" sx={{ bgcolor: 'notice.muted.bg', color: '#0164C8', fontWeight: 700, minWidth: 28, height: 22, fontSize: '0.7rem' }} />
        )}
      </Stack>
      <IconButton size="small" sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.2s', color: theme.palette.text.secondary }}>
        <ExpandMoreIcon />
      </IconButton>
    </Stack>
  )
}

function RequirementsSectionWithCollapse({ configs, records, membersData, locationId, expanded, onToggle }: { configs: any[]; records: any[]; membersData: any; locationId?: string; expanded: boolean; onToggle: () => void }) {
  const theme = useTheme()
  const navigate = useNavigate()
  const { showSnackbar } = useSnackbar()
  const [selectedReq, setSelectedReq] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [gapsTab, setGapsTab] = useState<'requirement' | 'person'>('requirement')
  const [personPage, setPersonPage] = useState(0)

  const allMembers: any[] = [
    ...(membersData?.admins?.length ? membersData.admins : (membersData?.admin ? [membersData.admin] : [])),
    ...(membersData?.staff || [])
  ]
    .filter((m: any) => m.status === 'active')
    .filter((m: any) => !locationId || locationId === 'all' || (m.location_id && String(m.location_id) === String(locationId)))
    .filter((m: any) => roleFilter === 'all' || m.role === roleFilter)
  const roleOptions: string[] = Array.from(new Set([
    ...(membersData?.admins?.length ? membersData.admins : (membersData?.admin ? [membersData.admin] : [])),
    ...(membersData?.staff || [])
  ].map((m: any) => m.role).filter(Boolean)))

  const staffToUserMap = new Map(allMembers.map((m: any) => [m.staff_id || m.id, m.id]))
  const staffNameMap = new Map(allMembers.map((m: any) => [m.staff_id || m.id, `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email]))
  interface StaffEntry { name: string; userId: string }
  const recordMap: Record<string, { complete: number; total: number; completeStaff: StaffEntry[]; incompleteStaff: StaffEntry[] }> = {}
  const visibleStaffIds = new Set(allMembers.map((m: any) => m.staff_id || m.id))

  if (records) {
    for (const r of records) {
      // Scope counts to staff in the current location/role filter. Records for
      // staff outside the filter (or no longer active) do not move the numbers.
      if (!visibleStaffIds.has(r.staff_id)) continue
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

  // Figma 5.11 — By person: invert the requirement map so each staff member
  // reads as done/missing across the same live requirements. Staff with no
  // records at all are missing everything, mirroring the By requirement
  // fallback above.
  const staffUserId = (m: any) => staffToUserMap.get(m.staff_id || m.id) || m.staff_id || m.id
  const staffGaps = allMembers.map((m: any) => {
    const userId = staffUserId(m)
    const name = staffNameMap.get(m.staff_id || m.id) || `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email
    const missing: string[] = []
    let done = 0
    for (const cfg of configs) {
      const stats = recordMap[cfg.id]
      if (stats && stats.completeStaff.some((s: StaffEntry) => s.userId === userId)) done += 1
      else missing.push(cfg.name)
    }
    return { member: m, userId, name, done, total: configs.length, missing }
  }).filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()))

  const exportGapsCsv = () => {
    const rows = [['Staff member', 'Done', 'Missing']]
    for (const s of staffGaps) rows.push([s.name, `${s.done} of ${s.total}`, s.missing.join('; ')])
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'compliance-gaps-by-person.csv'
    a.click()
    URL.revokeObjectURL(url)
    // Figma 5.12: every download announces itself the same way — what started, and which file.
    showSnackbar('compliance-gaps-by-person.csv is downloading.', 'success', 'Download started')
  }

  const gapsCount = (configs || []).length
  return (
    <PremiumCard noBorder sx={{ mb: { xs: 3, md: 0 }, overflow: 'hidden', height: '100%' }}>
      <Box sx={{ px: 3 }}>
        <SectionHeader label="Requirements" count={configs?.length} expanded={expanded} onToggle={onToggle} icon={<ComplianceIcon />} />
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ px: 3, pb: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              {gapsCount} requirements with gaps - select one to see who is missing it
            </Typography>
            <Button size="small" onClick={() => navigate('/compliance/records')}
              sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.8rem', color: theme.palette.primary.main }}
              endIcon={<ArrowIcon sx={{ fontSize: 16 }} />}>
              View all records
            </Button>
          </Stack>
          {/* Figma 5.11: the same live gaps read two ways — by requirement, or
              by person with an export. The requirement list below is unchanged. */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
            <Tabs value={gapsTab} onChange={(_, v) => { setGapsTab(v); setPersonPage(0) }}>
              <Tab value="requirement" label="By requirement" sx={{ textTransform: 'none', fontWeight: 600 }} />
              <Tab value="person" label="By person" sx={{ textTransform: 'none', fontWeight: 600 }} />
            </Tabs>
            {gapsTab === 'person' && (
              <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={exportGapsCsv}
                sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.8rem' }}>
                Export list
              </Button>
            )}
          </Stack>
          {gapsTab === 'requirement' ? (<>
          {configs.length === 0 && (
            <EmptyState title="No compliance requirements" description="Set up requirements to track staff compliance" variant="default" />
          )}
          {configs.length > 0 && items.length === 0 && search && (
            <EmptyState title="No matches found" description="Try a different search term" variant="search" />
          )}
          {items.length > 0 && (
            <>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
                <TextField
                  size="small"
                  placeholder="Search requirements..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  sx={{ minWidth: 220, flex: 1, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} /></InputAdornment>,
                  }}
                />
                <TextField
                  select
                  size="small"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  aria-label="Filter by role"
                  sx={{ minWidth: 140, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                >
                  <MenuItem value="all">All roles</MenuItem>
                  {roleOptions.map((role: string) => (
                    <MenuItem key={role} value={role}>{capitalise(role.replace(/_/g, ' '))}</MenuItem>
                  ))}
                </TextField>
              </Stack>
              <Stack spacing={1}>
                {items.map((r) => (
                  <Box key={r.id} onClick={() => setSelectedReq(r)}
                    sx={{
                      p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
                      borderRadius: '14px', border: `1px solid ${theme.palette.divider}`,
                      transition: 'all 0.15s',
                      '&:hover': { bgcolor: theme.palette.mode === 'dark' ? '#112539' : '#F7FAFE', borderColor: P.navy },
                    }}>
                    <Box sx={{ flex: 1, mr: 2 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.875rem' }}>{r.name}</Typography>
                      <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                        {r.is_mandatory !== false ? 'Mandatory - all staff' : 'Optional'}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75 }} flexWrap="wrap" useFlexGap>
                        <Box sx={{ flex: 1, maxWidth: 200, minWidth: 120 }}>
                          <LinearProgress variant="determinate" value={r.pct} sx={{
                            height: 6, borderRadius: 3,
                            bgcolor: theme.palette.mode === 'dark' ? '#2A3C54' : '#F7FAFE',
                            '& .MuiLinearProgress-bar': { bgcolor: r.pct === 100 ? '#10B981' : r.pct >= 80 ? '#F59E0B' : '#EF4444', borderRadius: 3 }
                          }} />
                        </Box>
                        <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>{r.complete}/{r.total} staff · {r.pct}%</Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={(e) => { e.stopPropagation(); navigate('/compliance/training') }}
                          sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.72rem', borderRadius: '8px', py: 0.25 }}
                        >
                          Assign
                        </Button>
                      </Stack>
                    </Box>
                    <DesignStatusBadge variant={r.pct === 100 ? 'completed' : r.pct >= 80 ? 'in-progress' : 'missed'} label={`${r.pct}%`} />
                  </Box>
                ))}
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>
                  {configs.length} requirement{configs.length === 1 ? '' : 's'} - {configs.length > 0 ? Math.round(items.reduce((sum, r) => sum + r.pct, 0) / items.length) : 0}% complete
                </Typography>
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>Live data</Typography>
              </Stack>
            </>
          )}
          </>
          ) : (
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                {staffGaps.length} staff · {configs.length} requirement{configs.length === 1 ? '' : 's'} each
              </Typography>
            </Stack>
            {staffGaps.length === 0 ? (
              <EmptyState title="No staff found" description="Try a different search term" variant="search" />
            ) : (
              <>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'notice.muted.bg' }}>
                        {['Staff member', 'Done', 'Missing'].map((heading) => (
                          <TableCell key={heading} sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary }}>
                            {heading}
                          </TableCell>
                        ))}
                        <TableCell />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {staffGaps.slice(personPage * 8, personPage * 8 + 8).map((s) => (
                        <TableRow key={s.userId} hover>
                          <TableCell>
                            <Stack direction="row" spacing={1.25} alignItems="center">
                              <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: '#0164C8', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>
                                {s.name.split(' ').map((part: string) => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'}
                              </Box>
                              <Box>
                                <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', lineHeight: 1.2 }}>{s.name}</Typography>
                                {s.member.role && <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>{String(s.member.role).replace(/_/g, ' ')}</Typography>}
                              </Box>
                            </Stack>
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {s.done} of {s.total}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                              {s.missing.length > 0 ? s.missing.join(', ') : '—'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Button size="small" variant="outlined" onClick={() => navigate(`/staff/${s.userId}`)}
                              sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '10px' }}>
                              Open
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination component="div" count={staffGaps.length} page={personPage} onPageChange={(_, p) => setPersonPage(p)} rowsPerPage={8} rowsPerPageOptions={[8]} />
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
                  <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>
                    {staffGaps.length} staff · {configs.length} requirement{configs.length === 1 ? '' : 's'} each
                  </Typography>
                  <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>Live data</Typography>
                </Stack>
              </>
            )}
          </Box>
          )}
        </Box>
      </Collapse>

      <Dialog open={!!selectedReq} onClose={() => setSelectedReq(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '18px' } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>{selectedReq?.name} — Staff Details</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ color: '#087A55', fontWeight: 700, mb: 1 }}>Completed ({selectedStats?.completeStaff.length || 0})</Typography>
              {selectedStats?.completeStaff.length ? selectedStats.completeStaff.map((s: any, i: number) => (
                <Chip key={i} label={s.name} size="small" onClick={() => navigate(`/staff/${s.userId}`)}
                  sx={{ mr: 0.5, mb: 0.5, cursor: 'pointer', bgcolor: 'notice.success.bg', color: 'notice.success.fg', fontWeight: 600, '&:hover': { bgcolor: 'notice.success.bg' } }} />
              )) : <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>None</Typography>}
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ color: '#F59E0B', fontWeight: 700, mb: 1 }}>Incomplete / Pending ({selectedStats?.incompleteStaff.length || 0})</Typography>
              {selectedStats?.incompleteStaff.length ? selectedStats.incompleteStaff.map((s: any, i: number) => (
                <Chip key={i} label={s.name} size="small" onClick={() => navigate(`/staff/${s.userId}`)}
                  sx={{ mr: 0.5, mb: 0.5, cursor: 'pointer', bgcolor: 'notice.warning.bg', color: 'notice.warning.fg', fontWeight: 600, '&:hover': { bgcolor: 'notice.warning.bg' } }} />
              )) : <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>None</Typography>}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setSelectedReq(null)} sx={{ textTransform: 'none', color: theme.palette.text.secondary }}>Close</Button>
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
  const { showSnackbar } = useSnackbar()
  // Figma 5.8: the file-too-large state lives inside the dialog so the
  // uploader learns the 10 MB limit before the request fails.
  const [fileTooLarge, setFileTooLarge] = useState(false)

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
    onSuccess: (_res, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      setPage(0)
      setOpen(false)
      reset()
      setSelectedStaff(null)
      setFileTooLarge(false)
      const staffName = selectedStaff ? `${selectedStaff.first_name || ''} ${selectedStaff.last_name || ''}`.trim() : ''
      showSnackbar(
        staffName ? `${staffName}'s ${variables?.type || 'document'} is saved.` : 'The document is saved and pending review.',
        'success',
        'Document uploaded',
      )
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
            <Alert severity="info" sx={{ flex: 1, mr: 2, borderRadius: 2 }}>
              Uploaded documents start as <strong>Pending</strong> until reviewed. Enable <strong>Auto-approve</strong> in Settings &gt; Organization to skip manual review.
            </Alert>
            <Button variant="contained" size="small" onClick={() => setOpen(true)}
              sx={{ textTransform: 'none', bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' }, fontWeight: 600, whiteSpace: 'nowrap' }}>Upload</Button>
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
                              sx={{ textTransform: 'none', bgcolor: '#087A55', '&:hover': { bgcolor: 'success.dark' }, fontSize: '0.7rem', minWidth: 60, py: 0.5 }}>Approve</Button>
                            <Button size="small" variant="contained"
                              disabled={docStatusMutation.isPending}
                              onClick={() => docStatusMutation.mutate({ id: d.id, status: 'rejected' })}
                              sx={{ textTransform: 'none', bgcolor: '#EF4444', '&:hover': { bgcolor: 'error.dark' }, fontSize: '0.7rem', minWidth: 60, py: 0.5 }}>Reject</Button>
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
            <DialogTitle sx={{ fontWeight: 800 }}>Upload a document</DialogTitle>
            <DialogContent>
              {(fileTooLarge || (uploadMutation.error as any)?.response?.status === 413) && (
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
              <Stack spacing={3} sx={{ mt: 1 }}>
                <TextField select label="Document Type" fullWidth {...register('type', { required: true })}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}>
                  {IDENTITY_DOCUMENT_TYPES.map(t => (
                    <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                  ))}
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
              <Button onClick={() => setOpen(false)} sx={{ textTransform: 'none', color: theme.palette.text.secondary }}>Cancel</Button>
              <Button onClick={handleFormSubmit} variant="contained" disabled={uploadMutation.isPending}
                sx={{ textTransform: 'none', bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}>
                {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </Collapse>
    </PremiumCard>
  )
}

/**
 * The recruitment decision taken on a disclosure.
 *
 * A closed list, and one that outlives the certificate detail: six months after
 * the decision the reference, its issue date and the note are deleted by the
 * retention purge, and this chip is what remains — which is why it is asked for
 * at the same time as the reference rather than later.
 */
const DBS_DECISIONS = [
  { value: 'pending', label: 'Pending — still being considered', color: '#0164C8' },
  { value: 'proceed', label: 'Proceed', color: '#10B981' },
  { value: 'proceed_with_conditions', label: 'Proceed with conditions', color: '#F59E0B' },
  { value: 'not_proceed', label: 'Not proceed', color: '#EF4444' },
  { value: 'withdrawn', label: 'Application withdrawn', color: '#51637A' },
]
const DBS_DECISION_COLORS: Record<string, string> = Object.fromEntries(DBS_DECISIONS.map(d => [d.value, d.color]))
const DBS_DECISION_LABELS: Record<string, string> = Object.fromEntries(DBS_DECISIONS.map(d => [d.value, d.label]))
const DBS_STATUS_COLORS: Record<string, string> = {
  draft: '#5D6E85',
  submitted: '#0164C8',
  in_progress: '#F59E0B',
  awaiting_identity: '#F59E0B',
  clear: '#10B981',
  disclosure: '#8B7CF6',
  cancelled: '#51637A',
  error: '#EF4444',
}

/**
 * Exported for its own test.
 *
 * The certificate-metadata field set and the wording of the "we do not submit"
 * notice are claims about this screen, and they are the part of the compliance
 * page most likely to drift from the API that answers them. Rendering the whole
 * page to check them would drag every other section's queries into the test.
 */
export function DbsSectionWithCollapse({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
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

  /**
   * Why submission is closed, in the API's own words — empty when it is open.
   *
   * `stats.submission` is what the refusal reads out, so the notice, the disabled
   * buttons' tooltips and the 503 a request would return all say the same thing.
   * It is deliberately not a hard-coded sentence here: when a vetting partner is
   * signed, the notice disappears on its own because the API stops saying it.
   */
  const submissionClosed = stats?.submission && !stats.submission.available ? String(stats.submission.message) : ''

  const createMutation = useMutation({
    mutationFn: async (data: any) => api.post('/dbs/checks', data),
    onSuccess: () => { invalidate(); setOpen(false); setForm({ staffId: '', level: 'enhanced', workforce: 'adult', costPence: '' }); setSuccess('DBS record saved') },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to create check'),
  })

  const submitMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/dbs/checks/${id}/submit`),
    onSuccess: () => { invalidate(); setSuccess('DBS application submitted to the provider') },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to submit'),
  })

  const pollMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/dbs/checks/${id}/poll`),
    onSuccess: (data) => { invalidate(); setSuccess(`Status updated: ${data.data.status}`) },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to poll'),
  })

  // ── Certificate metadata (docs/DBS_INTEGRATION_PLAN.md phase 0 items 4–5) ──
  //
  // What a certificate may contribute to a record is a reference, its issue date,
  // the recruitment decision taken on it, a renewal date and a note — and nothing
  // else. No upload, no photo, no scan: the DBS handling rules forbid keeping a
  // copy of a certificate, and the API refuses to hold the reference for longer
  // than six months after the decision, so the dialog says so before a manager
  // fills it in rather than after the request is refused.
  const [certOpen, setCertOpen] = useState(false)
  const [certTarget, setCertTarget] = useState<any>(null)
  const [certError, setCertError] = useState('')
  const blankCertForm = { certificateNumber: '', certificateIssuedOn: '', recruitmentDecision: '', recruitmentDecisionOn: '', renewalDueOn: '', notes: '' }
  const [certForm, setCertForm] = useState(blankCertForm)

  const openCertificate = (check: any) => {
    setCertTarget(check)
    setCertError('')
    setCertForm({
      certificateNumber: check.certificate_number || '',
      certificateIssuedOn: check.disclosure_date || '',
      recruitmentDecision: check.recruitment_decision || '',
      recruitmentDecisionOn: check.recruitment_decision_on || '',
      renewalDueOn: check.renewal_due_on || '',
      notes: check.notes || '',
    })
    setCertOpen(true)
  }

  const certificateMutation = useMutation({
    mutationFn: async (data: any) => api.patch(`/dbs/checks/${certTarget?.id}/certificate`, data),
    onSuccess: () => { invalidate(); setCertOpen(false); setSuccess('Certificate metadata saved') },
    // Inside the dialog, where the person who typed it is looking — not behind it.
    onError: (err: any) => setCertError(err.response?.data?.message || 'Failed to save the certificate metadata'),
  })

  const handleCertificateSave = () => {
    setCertError('')
    certificateMutation.mutate({
      certificateNumber: certForm.certificateNumber.trim() || null,
      certificateIssuedOn: certForm.certificateIssuedOn || null,
      recruitmentDecision: certForm.recruitmentDecision || null,
      // A decision recorded without a date is dated today rather than left blank:
      // the six-month retention period runs from it, and the API will not hold
      // certificate information without one.
      recruitmentDecisionOn: certForm.recruitmentDecision && certForm.recruitmentDecision !== 'pending'
        ? (certForm.recruitmentDecisionOn || localToday())
        : null,
      renewalDueOn: certForm.renewalDueOn || null,
      notes: certForm.notes.trim() || null,
    })
  }

  const handleCreate = () => {
    if (!form.staffId) { setError('Please select a staff member'); return }
    createMutation.mutate({ staffId: form.staffId, level: form.level, workforce: form.workforce, costPence: form.costPence ? parseInt(form.costPence) : undefined })
  }

  return (
    <PremiumCard noBorder sx={{ mb: 3, overflow: 'hidden' }}>
      <Box sx={{ px: 3 }}>
        <SectionHeader label="DBS Tracking" count={stats?.total} expanded={expanded} onToggle={onToggle} icon={<DbsIcon />} />
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ px: 3, pb: 3 }}>
          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

          {/*
            * Submission is closed, and the screen says so before the button is
            * pressed rather than letting it refuse afterwards.
            */}
          {submissionClosed && (
            <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                MeticleCare does not submit DBS checks yet
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>{submissionClosed}</Typography>
              <Typography variant="caption" sx={{ display: 'block' }}>
                Record what the certificate says on the staff member's DBS record instead — the reference, the date it was
                issued, the recruitment decision taken on it and when it should be reconsidered. Metadata only: never a
                copy, a photo or a scan of the certificate, and the reference is deleted{' '}
                {stats?.certificate_retention_months ?? 6} months after the decision.
              </Typography>
            </Alert>
          )}

          <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap alignItems="center">
            {[
              { label: 'Clear', value: stats?.clear || 0, color: '#10B981' },
              { label: 'In Progress', value: stats?.in_progress || 0, color: '#F59E0B' },
              { label: 'Awaiting ID', value: stats?.awaiting_identity || 0, color: '#F59E0B' },
              { label: 'Expiring Soon', value: stats?.expiring_soon || 0, color: '#EF4444' },
            ].map(s => (
              <Chip key={s.label} label={`${s.label}: ${s.value}`} size="small"
                sx={{ bgcolor: theme.palette.mode === 'dark' ? `${s.color}25` : `${s.color}12`, color: s.color, fontWeight: 700, height: 26, borderRadius: '13px', fontSize: '0.75rem' }} />
            ))}
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setOpen(true)}
              sx={{ textTransform: 'none', bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' }, fontWeight: 600 }}>
              Add DBS record
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
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>Certificate / decision</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>Requested</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} sx={{ textAlign: 'center', py: 6, borderBottom: 'none' }}><Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>Loading...</Typography></TableCell></TableRow>
                ) : !checks?.length ? (
                  <TableRow><TableCell colSpan={8} sx={{ borderBottom: 'none' }}><EmptyState title="No DBS records yet" description="Add a record to start tracking a DBS certificate." variant="default" /></TableCell></TableRow>
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
                    {/*
                      * Both halves of the retention rule, on one line: what is held
                      * now (the reference) and what will happen to it. The decision
                      * sits underneath because it is what survives — six months
                      * after it, the reference above is gone and this chip is the
                      * whole of what the record still says about the certificate.
                      */}
                    <TableCell sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                      <Stack spacing={0.25}>
                        <Typography variant="body2" sx={{ fontFamily: c.certificate_number ? 'monospace' : 'inherit' }}>
                          {c.certificate_number || '—'}
                        </Typography>
                        {c.recruitment_decision ? (
                          <Chip label={DBS_DECISION_LABELS[c.recruitment_decision] || c.recruitment_decision} size="small"
                            sx={{ alignSelf: 'flex-start', bgcolor: theme.palette.mode === 'dark' ? `${DBS_DECISION_COLORS[c.recruitment_decision]}25` : `${DBS_DECISION_COLORS[c.recruitment_decision]}18`, color: DBS_DECISION_COLORS[c.recruitment_decision], fontWeight: 700, fontSize: '0.7rem', height: 20, borderRadius: '10px' }} />
                        ) : null}
                        {c.certificate_purged_on ? (
                          <Tooltip title={`Certificate information may be kept for six months after the recruitment decision, so the reference and issue date were deleted on ${formatDateOnly(c.certificate_purged_on)}. The decision and any renewal date stay.`}>
                            <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                              Details deleted {formatDateOnly(c.certificate_purged_on)}
                            </Typography>
                          </Tooltip>
                        ) : c.purge_after_on ? (
                          <Typography variant="caption" sx={{ color: c.days_until_purge <= 0 ? 'notice.error.fg' : theme.palette.text.secondary }}>
                            {c.days_until_purge <= 0 ? 'Details due for deletion' : `Automatically deleted ${formatDateOnly(c.purge_after_on)}`}
                          </Typography>
                        ) : null}
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ borderBottom: `1px solid ${theme.palette.divider}`, color: theme.palette.text.secondary, fontSize: '0.85rem' }}>{new Date(c.created_at).toLocaleDateString()}</TableCell>
                    <TableCell align="right" sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="Record what the certificate says — metadata only">
                          <IconButton size="small" onClick={() => openCertificate(c)} aria-label={`Record certificate metadata for ${c.staff_name}`}
                            sx={{ color: 'notice.info.fg', '&:hover': { bgcolor: 'notice.info.bg' } }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {/*
                          * Shown but disabled while submission is closed, so the
                          * workflow is visible and the reason is on the button
                          * rather than discovered by pressing it. A tooltip on a
                          * disabled control needs the span, or the hover never
                          * reaches it — the button swallows pointer events.
                          */}
                        {c.status === 'draft' && (
                          <Tooltip title={submissionClosed || 'Submit a DBS application to the provider'}>
                            <span>
                              <IconButton size="small" color="primary" aria-label={submissionClosed ? 'Submit to the provider (unavailable)' : 'Submit to the provider'} onClick={() => submitMutation.mutate(c.id)} disabled={submitMutation.isPending || !!submissionClosed}
                                sx={{ color: 'notice.info.fg', '&:hover': { bgcolor: 'notice.info.bg' } }}>
                                {submitMutation.isPending ? <Typography variant="caption">...</Typography> : <SubmitIcon fontSize="small" />}
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                        {['submitted', 'in_progress', 'awaiting_identity'].includes(c.status) && (
                          <Tooltip title={submissionClosed || 'Poll provider for status update'}>
                            <span>
                              <IconButton size="small" aria-label={submissionClosed ? 'Poll the provider (unavailable)' : 'Poll the provider for a result'} onClick={() => pollMutation.mutate(c.id)} disabled={pollMutation.isPending || !!submissionClosed}
                                sx={{ color: theme.palette.text.secondary, '&:hover': { bgcolor: theme.palette.mode === 'dark' ? '#2A3C54' : '#F7FAFE' } }}>
                                {pollMutation.isPending ? <Typography variant="caption">...</Typography> : <PollIcon fontSize="small" />}
                              </IconButton>
                            </span>
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
            <DialogTitle sx={{ fontWeight: 800 }}>Add DBS record</DialogTitle>
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
              <Button onClick={() => setOpen(false)} sx={{ textTransform: 'none', color: theme.palette.text.secondary }}>Cancel</Button>
              <Button variant="contained" onClick={handleCreate} disabled={createMutation.isPending}
                sx={{ textTransform: 'none', bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}>
                {createMutation.isPending ? 'Saving...' : 'Save record'}
              </Button>
            </DialogActions>
          </Dialog>

          {/*
            * The permitted certificate metadata, and the rule stated in the dialog
            * rather than in a policy PDF: this is all that may be kept, it is kept
            * for six months after the recruitment decision, and a copy or an image
            * of the certificate is never kept at all.
            */}
          <Dialog open={certOpen} onClose={() => setCertOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '18px' } }}>
            <DialogTitle sx={{ fontWeight: 800 }}>Certificate metadata</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  {certTarget?.staff_name} — record what the certificate itself says. Metadata only: never a copy, a photo or a
                  scan of the certificate.
                </Typography>
                {certTarget?.certificate_purged_on && (
                  <Alert severity="info" sx={{ borderRadius: 2 }}>
                    The previous certificate information was deleted on {formatDateOnly(certTarget.certificate_purged_on)} under
                    the six-month rule. Anything recorded now starts its own six months.
                  </Alert>
                )}
                {certError && <Alert severity="error" sx={{ borderRadius: 2 }}>{certError}</Alert>}
                <TextField label="Certificate reference" value={certForm.certificateNumber} fullWidth
                  onChange={(e) => setCertForm({ ...certForm, certificateNumber: e.target.value })}
                  helperText="The reference on the certificate — cleared automatically six months after the decision"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
                <TextField label="Certificate issued" type="date" fullWidth InputLabelProps={{ shrink: true }}
                  value={certForm.certificateIssuedOn} onChange={(e) => setCertForm({ ...certForm, certificateIssuedOn: e.target.value })}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
                <TextField select label="Recruitment decision" fullWidth
                  value={certForm.recruitmentDecision} onChange={(e) => setCertForm({ ...certForm, recruitmentDecision: e.target.value })}
                  helperText="The decision taken on the disclosure. It is kept after the certificate detail is deleted."
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}>
                  <MenuItem value="">Not recorded</MenuItem>
                  {DBS_DECISIONS.map(d => <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>)}
                </TextField>
                <TextField label="Decision taken on" type="date" fullWidth InputLabelProps={{ shrink: true }}
                  value={certForm.recruitmentDecisionOn} onChange={(e) => setCertForm({ ...certForm, recruitmentDecisionOn: e.target.value })}
                  disabled={!certForm.recruitmentDecision || certForm.recruitmentDecision === 'pending'}
                  helperText="The six-month retention period runs from this date"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
                <TextField label="Reconsider on (optional)" type="date" fullWidth InputLabelProps={{ shrink: true }}
                  value={certForm.renewalDueOn} onChange={(e) => setCertForm({ ...certForm, renewalDueOn: e.target.value })}
                  helperText="A renewal marker. Kept after the certificate details are deleted — it holds none of them."
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
                <TextField label="Note (optional)" value={certForm.notes} fullWidth multiline minRows={2}
                  onChange={(e) => setCertForm({ ...certForm, notes: e.target.value })}
                  helperText="Cleared with the certificate details, because free text is where a certificate number gets pasted"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
                {certTarget?.purge_after_on && !certTarget?.certificate_purged_on && (
                  <Typography variant="caption" sx={{ color: certTarget.days_until_purge <= 0 ? 'notice.error.fg' : theme.palette.text.secondary }}>
                    {certTarget.days_until_purge <= 0
                      ? `${formatDateOnly(certTarget.purge_after_on)} has passed, so this certificate's details are due to be deleted. Recording a decision dated today starts a fresh six months.`
                      : `Currently held until ${formatDateOnly(certTarget.purge_after_on)} (${certTarget.days_until_purge} days).`}
                  </Typography>
                )}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 3, pt: 0 }}>
              <Button onClick={() => setCertOpen(false)} sx={{ textTransform: 'none', color: theme.palette.text.secondary }}>Cancel</Button>
              <Button variant="contained" onClick={handleCertificateSave} disabled={certificateMutation.isPending}
                sx={{ textTransform: 'none', bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}>
                {certificateMutation.isPending ? 'Saving...' : 'Save metadata'}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </Collapse>
    </PremiumCard>
  )
}

// ── DBS Update Service re-checks ──────────────────────────────────────────────
//
// The staged completion of a DBS record: a subscription the individual holds, a
// periodic status check the provider performs with their consent, and a renewal
// marker when the status has changed. Nothing here is submitted to anybody —
// there is no application, and a status check is not a certificate.
//
// The labels, the urgency colours and the due-date phrasing live in
// `utils/updateService.ts`, and the record itself is rendered by
// `components/UpdateServiceRecord.tsx`, because a staff member's own compliance
// tab shows the same subscription read-only: one record, one set of words.

export function UpdateServiceSectionWithCollapse({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()

  // Every failure in this section happens inside a dialog, so the error lives
  // there and not here — a message behind the dialog that caused it is a message
  // nobody reads.
  const [dialogError, setDialogError] = useState('')
  const [success, setSuccess] = useState('')
  const [stateFilter, setStateFilter] = useState('all')

  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState('')
  const [checkOpen, setCheckOpen] = useState(false)
  const [renewalOpen, setRenewalOpen] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)

  const [form, setForm] = useState({
    staffId: '', level: 'enhanced', workforce: 'adult', updateServiceId: '',
    certificateReference: '', certificateIssuedOn: '', consentGivenOn: localToday(),
    consentMethod: 'written', paperCertificateSeenOn: localToday(), identityVerifiedOn: localToday(),
    identityMethod: 'manual_document_check', checkIntervalMonths: '12', nextCheckDueOn: '',
  })
  const [checkForm, setCheckForm] = useState({ checkedOn: localToday(), outcome: 'no_change', level: 'enhanced', workforce: 'adult', notes: '' })
  const [renewalForm, setRenewalForm] = useState({ renewalDueOn: localToday(), note: '' })
  const [completeForm, setCompleteForm] = useState({ certificateReference: '', certificateIssuedOn: localToday(), nextCheckDueOn: '' })
  const [withdrawReason, setWithdrawReason] = useState('')

  const listParams = stateFilter === 'withdrawn'
    ? { status: 'withdrawn' }
    : stateFilter === 'all' ? {} : { dueState: stateFilter }

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ['dbs-update-service', stateFilter],
    queryFn: async () => {
      const res = await api.get('/dbs/update-service', { params: listParams })
      return res.data as any[]
    },
  })

  const { data: stats } = useQuery({
    queryKey: ['dbs-update-service-stats'],
    queryFn: async () => { const res = await api.get('/dbs/update-service/stats'); return res.data as any },
  })

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['dbs-update-service-detail', detailId],
    queryFn: async () => { const res = await api.get(`/dbs/update-service/${detailId}`); return res.data as any },
    enabled: !!detailId,
  })

  const { data: membersData } = useQuery({
    queryKey: ['org-members'],
    queryFn: async () => { const res = await api.get('/staff/org-members'); return res.data as any },
  })
  const members: any[] = [
    ...(membersData?.admins?.length ? membersData.admins : (membersData?.admin ? [membersData.admin] : [])),
    ...(membersData?.staff || [])
  ].filter((m: any) => m.staff_id && m.status === 'active')

  /**
   * Every mutation is followed by the same three invalidations: the list, its
   * stats and the open detail. A status check moves the due date, so a section
   * that refreshed only the list would leave the detail dialog showing the date
   * it had a moment ago.
   */
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['dbs-update-service'] })
    queryClient.invalidateQueries({ queryKey: ['dbs-update-service-stats'] })
    if (detailId) queryClient.invalidateQueries({ queryKey: ['dbs-update-service-detail', detailId] })
  }

  /** A dialog opens clean: whatever went wrong with the last one is not about this one. */
  const openDialog = (setter: (open: boolean) => void) => {
    setDialogError('')
    setSuccess('')
    setter(true)
  }

  const createMutation = useMutation({
    mutationFn: async (data: any) => api.post('/dbs/update-service', data),
    onSuccess: () => {
      invalidate(); setCreateOpen(false)
      setForm({ staffId: '', level: 'enhanced', workforce: 'adult', updateServiceId: '', certificateReference: '', certificateIssuedOn: '', consentGivenOn: localToday(), consentMethod: 'written', paperCertificateSeenOn: localToday(), identityVerifiedOn: localToday(), identityMethod: 'manual_document_check', checkIntervalMonths: '12', nextCheckDueOn: '' })
      setSuccess('Update Service subscription recorded against the staff record')
    },
    onError: (err: any) => setDialogError(err.response?.data?.message || 'Failed to record the subscription'),
  })

  const checkMutation = useMutation({
    mutationFn: async (payload: any) => api.post(`/dbs/update-service/${detailId}/checks`, payload),
    // Figma 5.12: the check completes with a toast, not an alert behind the
    // closed dialog — the frame's copy names the outcome, so a "no change"
    // result says so instead of the generic "recorded".
    onSuccess: (_data, variables: any) => {
      invalidate(); setCheckOpen(false)
      const message = variables?.outcome === 'no_change'
        ? 'No new information since the certificate was issued.'
        : variables?.outcome === 'changed'
          ? 'The certificate has changed — a renewal is now needed.'
          : 'The check could not be completed — the attempt is recorded.'
      showSnackbar(message, 'success', 'Check complete')
    },
    onError: (err: any) => setDialogError(err.response?.data?.message || 'Failed to record the check'),
  })

  const renewalMutation = useMutation({
    mutationFn: async (payload: any) => api.patch(`/dbs/update-service/${detailId}/renewal`, payload),
    onSuccess: (_data, variables: any) => {
      invalidate(); setRenewalOpen(false)
      setSuccess(variables.renewalDueOn ? 'Renewal date recorded' : 'Renewal date cleared')
    },
    onError: (err: any) => setDialogError(err.response?.data?.message || 'Failed to change the renewal date'),
  })

  const completeMutation = useMutation({
    mutationFn: async (payload: any) => api.post(`/dbs/update-service/${detailId}/renewal/complete`, payload),
    onSuccess: () => {
      invalidate(); setCompleteOpen(false)
      setCompleteForm({ certificateReference: '', certificateIssuedOn: localToday(), nextCheckDueOn: '' })
      setSuccess('New certificate recorded and the renewal marked complete')
    },
    onError: (err: any) => setDialogError(err.response?.data?.message || 'Failed to record the certificate'),
  })

  const withdrawMutation = useMutation({
    mutationFn: async (reason: string) => api.post(`/dbs/update-service/${detailId}/withdraw`, { reason }),
    onSuccess: () => { invalidate(); setWithdrawOpen(false); setWithdrawReason(''); setSuccess('Consent withdrawn — no further checks will be recorded') },
    onError: (err: any) => setDialogError(err.response?.data?.message || 'Failed to withdraw consent'),
  })

  const handleCreate = () => {
    setDialogError('')
    if (!form.staffId) { setDialogError('Select the member of staff this subscription belongs to'); return }
    if (!form.updateServiceId.trim()) { setDialogError('The Update Service reference is required — it is the individual\'s own subscription number'); return }
    if (!form.paperCertificateSeenOn || !form.identityVerifiedOn) {
      setDialogError('Record the date the paper certificate was seen and the date identity was verified — a check cannot be made without both')
      return
    }
    const interval = form.checkIntervalMonths ? parseInt(form.checkIntervalMonths, 10) : undefined
    if (interval !== undefined && (Number.isNaN(interval) || interval < 1 || interval > 36)) {
      setDialogError('The check interval must be between 1 and 36 months')
      return
    }
    createMutation.mutate({
      staffId: form.staffId,
      level: form.level,
      workforce: form.workforce,
      updateServiceId: form.updateServiceId.trim(),
      certificateReference: form.certificateReference.trim() || undefined,
      certificateIssuedOn: form.certificateIssuedOn || undefined,
      consentGivenOn: form.consentGivenOn || undefined,
      consentMethod: form.consentMethod,
      paperCertificateSeenOn: form.paperCertificateSeenOn,
      identityVerifiedOn: form.identityVerifiedOn,
      identityMethod: form.identityMethod,
      checkIntervalMonths: interval,
      nextCheckDueOn: form.nextCheckDueOn || undefined,
    })
  }

  const handleRecordCheck = () => {
    setDialogError('')
    checkMutation.mutate({
      checkedOn: checkForm.checkedOn || undefined,
      outcome: checkForm.outcome,
      level: checkForm.level,
      workforce: checkForm.workforce,
      notes: checkForm.notes.trim() || undefined,
    })
  }

  const handleCompleteRenewal = () => {
    setDialogError('')
    if (!completeForm.certificateReference.trim()) { setDialogError('The new certificate reference is required'); return }
    completeMutation.mutate({
      certificateReference: completeForm.certificateReference.trim(),
      certificateIssuedOn: completeForm.certificateIssuedOn || localToday(),
      nextCheckDueOn: completeForm.nextCheckDueOn || undefined,
    })
  }

  const handleWithdraw = () => {
    setDialogError('')
    if (withdrawReason.trim().length < 3) { setDialogError('Record why consent was withdrawn — it stays on the record'); return }
    withdrawMutation.mutate(withdrawReason.trim())
  }

  const openCheckDialog = (subscription: any) => {
    setCheckForm({
      checkedOn: localToday(),
      outcome: 'no_change',
      // The API refuses a level or workforce the certificate does not cover, so
      // the form starts from what was consented to rather than from a default.
      level: subscription?.level || 'enhanced',
      workforce: subscription?.workforce || 'adult',
      notes: '',
    })
    openDialog(setCheckOpen)
  }

  const tableHeaderSx = { fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }
  const tableCellSx = { borderBottom: `1px solid ${theme.palette.divider}` }
  const chipSx = (color: string) => ({
    bgcolor: theme.palette.mode === 'dark' ? `${color}25` : `${color}18`,
    color,
    fontWeight: 700,
    fontSize: '0.7rem',
    height: 22,
    borderRadius: '11px',
  })

  const withdrawBlocked = !!detail?.consent_withdrawn_on || detail?.status !== 'active'

  return (
    <PremiumCard noBorder sx={{ mb: 3, overflow: 'hidden' }}>
      <Box sx={{ px: 3 }}>
        <SectionHeader label="DBS Update Service" count={stats?.total} expanded={expanded} onToggle={onToggle} icon={<DbsIcon />} />
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ px: 3, pb: 3 }}>
          {success && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
            The Update Service is the one DBS facility a provider can use without a vetting partner: a free status
            check against the individual&apos;s own subscription. It needs their consent, the same level and workforce
            as the certificate, the paper certificate seen and their identity verified — then a check is recorded here.
            Nothing is submitted and no certificate is created.
          </Typography>

          <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap alignItems="center">
            {[
              { label: 'Active', value: stats?.active || 0, color: '#10B981' },
              { label: 'Due soon', value: stats?.due_soon || 0, color: '#F59E0B' },
              { label: 'Overdue', value: stats?.overdue || 0, color: '#EF4444' },
              { label: 'Renewal outstanding', value: stats?.renewals_due || 0, color: '#EF4444' },
              { label: 'Checks (30 days)', value: stats?.checks_last_30_days || 0, color: '#0164C8' },
            ].map(s => (
              <Chip key={s.label} label={`${s.label}: ${s.value}`} size="small"
                sx={{ bgcolor: theme.palette.mode === 'dark' ? `${s.color}25` : `${s.color}12`, color: s.color, fontWeight: 700, height: 26, borderRadius: '13px', fontSize: '0.75rem' }} />
            ))}
            <Box sx={{ flex: 1 }} />
            <TextField select size="small" label="Show" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}
              sx={{ minWidth: 160, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}>
              <MenuItem value="all">All subscriptions</MenuItem>
              <MenuItem value="due_soon">Due soon</MenuItem>
              <MenuItem value="overdue">Overdue</MenuItem>
              <MenuItem value="current">Current</MenuItem>
              <MenuItem value="withdrawn">Consent withdrawn</MenuItem>
            </TextField>
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => openDialog(setCreateOpen)}
              sx={{ textTransform: 'none', bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' }, fontWeight: 600 }}>
              Record subscription
            </Button>
          </Stack>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={tableHeaderSx}>Staff</TableCell>
                  <TableCell sx={tableHeaderSx}>Level</TableCell>
                  <TableCell sx={tableHeaderSx}>Update Service reference</TableCell>
                  <TableCell sx={tableHeaderSx}>Next check</TableCell>
                  <TableCell sx={tableHeaderSx}>Last checked</TableCell>
                  <TableCell sx={tableHeaderSx}>Renewal</TableCell>
                  <TableCell sx={tableHeaderSx}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 6, borderBottom: 'none' }}><Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>Loading...</Typography></TableCell></TableRow>
                ) : !subscriptions?.length ? (
                  <TableRow><TableCell colSpan={7} sx={{ borderBottom: 'none' }}>
                    <EmptyState title="No Update Service subscriptions yet" description="Record one when a member of staff consents to periodic status checks" variant="default" />
                  </TableCell></TableRow>
                ) : subscriptions.map((s: any) => (
                  <TableRow key={s.id} hover onClick={() => { setDialogError(''); setDetailId(s.id) }}
                    sx={{ cursor: 'pointer', '&:last-child td': { borderBottom: 'none' } }}>
                    <TableCell sx={{ fontWeight: 700, ...tableCellSx }}>
                      {/* The record this row is about lives on the staff member's own
                          compliance tab, which is where a check is recorded or a new
                          certificate filed — the same target the Update Service
                          reminder links to, built by the same helper. The link stops
                          the click so the row still opens the read-only record here;
                          the reader chooses between the record and the person. */}
                      <Typography
                        component={s.staff_user_id ? RouterLink : 'span'}
                        {...(s.staff_user_id ? {
                          to: staffRecordPath(s.staff_user_id, s.id),
                          // The fallback is text, not a link with a guessed id: a
                          // `staff_profiles` id in this URL answers 404, and a link
                          // that goes nowhere reads exactly like one that worked.
                          onClick: (event: React.MouseEvent) => event.stopPropagation(),
                        } : {})}
                        variant="body2"
                        sx={{ fontWeight: 700, color: 'inherit', textDecoration: 'none', '&:hover': { textDecoration: s.staff_user_id ? 'underline' : 'none' } }}
                      >
                        {s.staff_name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>{s.staff_email}</Typography>
                    </TableCell>
                    <TableCell sx={{ ...tableCellSx, textTransform: 'capitalize' }}>{`${String(s.level || '').replace(/_/g, ' ')} · ${capitalise(s.workforce)}`}</TableCell>
                    <TableCell sx={tableCellSx}><Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{s.update_service_id}</Typography></TableCell>
                    <TableCell sx={tableCellSx}>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <Typography variant="body2">{s.status === 'active' ? formatDateOnly(s.next_check_due_on) : '—'}</Typography>
                        {/* A withdrawn subscription has no due date to be late for, so it
                            reads as not active rather than overdue. */}
                        <Chip label={s.status === 'active' ? duePhrase(s.days_until_check) : UPDATE_SERVICE_STATE_LABELS[s.due_state]}
                          size="small" sx={chipSx(UPDATE_SERVICE_STATE_COLORS[s.due_state] || '#51637A')} />
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ ...tableCellSx, color: theme.palette.text.secondary, fontSize: '0.85rem' }}>{s.last_checked_on ? formatDateOnly(s.last_checked_on) : 'Never'}</TableCell>
                    <TableCell sx={tableCellSx}>
                      {s.renewal_due_on ? (
                        <Chip label={`Needed by ${formatDateOnly(s.renewal_due_on)}`} size="small" sx={chipSx('#EF4444')} />
                      ) : s.renewal_completed_on ? (
                        <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>{`Renewed ${formatDateOnly(s.renewal_completed_on)}`}</Typography>
                      ) : (
                        <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>—</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={tableCellSx}>
                      <Chip label={capitalise(s.status)} size="small" sx={chipSx(UPDATE_SERVICE_STATUS_COLORS[s.status] || '#51637A')} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* — Record a subscription — */}
          <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '18px' } }}>
            <DialogTitle sx={{ fontWeight: 800 }}>Record an Update Service subscription</DialogTitle>
            <DialogContent>
              {dialogError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setDialogError('')}>{dialogError}</Alert>}
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block', mb: 2 }}>
                The subscription is the individual&apos;s own and is free. Recording it here is a record of their consent to
                periodic status checks, and of the two things DBS requires before one: that the paper certificate has been
                seen and that identity has been verified. No application is made and nothing is sent to anybody.
              </Typography>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField select label="Staff member" value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })} fullWidth required
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}>
                  {members.map((m: any) => (
                    <MenuItem key={m.staff_id} value={m.staff_id}>{`${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email}</MenuItem>
                  ))}
                </TextField>
                <Stack direction="row" spacing={2}>
                  <TextField select label="Level" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} fullWidth
                    helperText="Basic certificates are not eligible for the Update Service"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}>
                    {DBS_LEVELS.map(l => <MenuItem key={l} value={l}>{capitalise(l)}</MenuItem>)}
                  </TextField>
                  <TextField select label="Workforce" value={form.workforce} onChange={(e) => setForm({ ...form, workforce: e.target.value })} fullWidth
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}>
                    {DBS_WORKFORCE.map(w => <MenuItem key={w} value={w}>{capitalise(w)}</MenuItem>)}
                  </TextField>
                </Stack>
                <TextField label="Update Service reference" value={form.updateServiceId} onChange={(e) => setForm({ ...form, updateServiceId: e.target.value })} fullWidth required
                  helperText="The individual's own Update Service number" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
                <Stack direction="row" spacing={2}>
                  <TextField label="Certificate reference (optional)" value={form.certificateReference} onChange={(e) => setForm({ ...form, certificateReference: e.target.value })} fullWidth
                    helperText="Metadata only — never a copy of the certificate" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
                  <TextField label="Certificate issued" type="date" value={form.certificateIssuedOn} onChange={(e) => setForm({ ...form, certificateIssuedOn: e.target.value })} fullWidth
                    InputLabelProps={{ shrink: true }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
                </Stack>
                <Stack direction="row" spacing={2}>
                  <TextField label="Consent given" type="date" value={form.consentGivenOn} onChange={(e) => setForm({ ...form, consentGivenOn: e.target.value })} fullWidth
                    InputLabelProps={{ shrink: true }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
                  <TextField select label="Consent recorded as" value={form.consentMethod} onChange={(e) => setForm({ ...form, consentMethod: e.target.value })} fullWidth
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}>
                    {UPDATE_SERVICE_CONSENT_METHODS.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                  </TextField>
                </Stack>
                <Stack direction="row" spacing={2}>
                  <TextField label="Paper certificate seen" type="date" value={form.paperCertificateSeenOn} onChange={(e) => setForm({ ...form, paperCertificateSeenOn: e.target.value })} fullWidth required
                    InputLabelProps={{ shrink: true }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
                  <TextField label="Identity verified" type="date" value={form.identityVerifiedOn} onChange={(e) => setForm({ ...form, identityVerifiedOn: e.target.value })} fullWidth required
                    InputLabelProps={{ shrink: true }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
                </Stack>
                <TextField select label="Identity verified by" value={form.identityMethod} onChange={(e) => setForm({ ...form, identityMethod: e.target.value })} fullWidth
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}>
                  {UPDATE_SERVICE_IDENTITY_METHODS.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                </TextField>
                <Stack direction="row" spacing={2}>
                  <TextField label="Check every (months)" type="number" value={form.checkIntervalMonths} onChange={(e) => setForm({ ...form, checkIntervalMonths: e.target.value })} fullWidth
                    helperText="Between 1 and 36" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
                  <TextField label="First check due (optional)" type="date" value={form.nextCheckDueOn} onChange={(e) => setForm({ ...form, nextCheckDueOn: e.target.value })} fullWidth
                    helperText="Defaults to one interval from today" InputLabelProps={{ shrink: true }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
                </Stack>
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 3, pt: 0 }}>
              <Button onClick={() => setCreateOpen(false)} sx={{ textTransform: 'none', color: theme.palette.text.secondary }}>Cancel</Button>
              <Button variant="contained" onClick={handleCreate} disabled={createMutation.isPending}
                sx={{ textTransform: 'none', bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}>
                {createMutation.isPending ? 'Recording...' : 'Record subscription'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* — One subscription in full — */}
          <Dialog open={!!detailId} onClose={() => setDetailId('')} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: '18px' } }}>
            <DialogTitle sx={{ fontWeight: 800 }}>
              {detail?.staff_name || 'Update Service subscription'}
              {detail && (
                <Typography variant="caption" sx={{ display: 'block', color: theme.palette.text.secondary, fontWeight: 600 }}>
                  {`${capitalise(detail.level)} certificate · ${capitalise(detail.workforce)} workforce · ${detail.update_service_id}`}
                </Typography>
              )}
            </DialogTitle>
            <DialogContent dividers>
              {dialogError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setDialogError('')}>{dialogError}</Alert>}
              {detailLoading || !detail ? (
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary, py: 4, textAlign: 'center' }}>Loading...</Typography>
              ) : (
                <UpdateServiceRecordBody subscription={detail} />
              )}
            </DialogContent>
            <DialogActions sx={{ p: 3, flexWrap: 'wrap', gap: 1 }}>
              <Tooltip title={withdrawBlocked ? 'Consent has been withdrawn or the subscription is not active' : 'Record what the Update Service said'}>
                <span>
                  <Button variant="contained" size="small" disabled={withdrawBlocked} onClick={() => openCheckDialog(detail)}
                    sx={{ textTransform: 'none', bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' }, fontWeight: 600 }}>
                    Record status check
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title={withdrawBlocked ? 'Consent has been withdrawn or the subscription is not active' : 'Set or clear the renewal marker' }>
                <span>
                  <Button size="small" variant="outlined" disabled={withdrawBlocked} onClick={() => { setRenewalForm({ renewalDueOn: detail?.renewal_due_on || localToday(), note: '' }); openDialog(setRenewalOpen) }}
                    sx={{ textTransform: 'none', fontWeight: 600 }}>
                    {detail?.renewal_due_on ? 'Change renewal date' : 'Set renewal date'}
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title={withdrawBlocked ? 'Consent has been withdrawn or the subscription is not active' : 'Record the new certificate' }>
                <span>
                  <Button size="small" variant="outlined" disabled={withdrawBlocked} onClick={() => openDialog(setCompleteOpen)}
                    sx={{ textTransform: 'none', fontWeight: 600 }}>
                    Complete renewal
                  </Button>
                </span>
              </Tooltip>
              <Box sx={{ flex: 1 }} />
              {!withdrawBlocked && (
                <Button size="small" onClick={() => { setWithdrawReason(''); openDialog(setWithdrawOpen) }}
                  sx={{ textTransform: 'none', color: 'notice.error.fg', fontWeight: 600 }}>
                  Withdraw consent
                </Button>
              )}
              <Button onClick={() => setDetailId('')} sx={{ textTransform: 'none', color: theme.palette.text.secondary }}>Close</Button>
            </DialogActions>
          </Dialog>

          {/* — Figma 5.12 "Check the Update Service": one check for one
              certificate — the number is kept, never the result. The dialog
              keeps the live fields (outcome, level, workforce, notes) the
              frame's single-button version does not have. — */}
          <Dialog open={checkOpen} onClose={() => setCheckOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '18px' } }}>
            <DialogTitle sx={{ fontWeight: 800 }}>Check the Update Service</DialogTitle>
            <DialogContent>
              {dialogError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setDialogError('')}>{dialogError}</Alert>}
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block', mb: 2 }}>
                {`Record what the Update Service told you about ${detail?.staff_name || 'this person'}'s certificate. `}
                A change means the certificate on file is no longer the whole picture and a new one has to be obtained — it
                raises the renewal marker. This is not a new application and no certificate is issued.
              </Typography>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField label="Checked on" type="date" value={checkForm.checkedOn} onChange={(e) => setCheckForm({ ...checkForm, checkedOn: e.target.value })} fullWidth
                  InputLabelProps={{ shrink: true }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
                <TextField select label="Result" value={checkForm.outcome} onChange={(e) => setCheckForm({ ...checkForm, outcome: e.target.value })} fullWidth
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}>
                  {UPDATE_SERVICE_OUTCOMES.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                </TextField>
                <Stack direction="row" spacing={2}>
                  <TextField select label="Level checked" value={checkForm.level} onChange={(e) => setCheckForm({ ...checkForm, level: e.target.value })} fullWidth
                    helperText="Must match the certificate" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}>
                    {DBS_LEVELS.map(l => <MenuItem key={l} value={l}>{capitalise(l)}</MenuItem>)}
                  </TextField>
                  <TextField select label="Workforce checked" value={checkForm.workforce} onChange={(e) => setCheckForm({ ...checkForm, workforce: e.target.value })} fullWidth
                    helperText="Must match the certificate" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}>
                    {DBS_WORKFORCE.map(w => <MenuItem key={w} value={w}>{capitalise(w)}</MenuItem>)}
                  </TextField>
                </Stack>
                <TextField label="Notes (optional)" value={checkForm.notes} onChange={(e) => setCheckForm({ ...checkForm, notes: e.target.value })} fullWidth multiline minRows={2}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 3, pt: 0 }}>
              <Button onClick={() => setCheckOpen(false)} sx={{ textTransform: 'none', color: theme.palette.text.secondary }}>Cancel</Button>
              <Button variant="contained" onClick={handleRecordCheck} disabled={checkMutation.isPending}
                sx={{ textTransform: 'none', bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}>
                {checkMutation.isPending ? 'Checking...' : 'Check now'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* — The renewal marker — */}
          <Dialog open={renewalOpen} onClose={() => setRenewalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '18px' } }}>
            <DialogTitle sx={{ fontWeight: 800 }}>Renewal date</DialogTitle>
            <DialogContent>
              {dialogError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setDialogError('')}>{dialogError}</Alert>}
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block', mb: 2 }}>
                When a new certificate is needed by. A check that comes back changed raises this by itself; set it here when
                a role change or a policy review means a new certificate is required.
              </Typography>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField label="New certificate needed by" type="date" value={renewalForm.renewalDueOn} onChange={(e) => setRenewalForm({ ...renewalForm, renewalDueOn: e.target.value })} fullWidth
                  InputLabelProps={{ shrink: true }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
                <TextField label="Note (optional)" value={renewalForm.note} onChange={(e) => setRenewalForm({ ...renewalForm, note: e.target.value })} fullWidth
                  helperText="For example: moved to regulated activity" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 3, pt: 0 }}>
              {detail?.renewal_due_on && (
                <Button onClick={() => renewalMutation.mutate({ renewalDueOn: null })} disabled={renewalMutation.isPending}
                  sx={{ textTransform: 'none', color: 'notice.error.fg' }}>
                  Clear the marker
                </Button>
              )}
              <Box sx={{ flex: 1 }} />
              <Button onClick={() => setRenewalOpen(false)} sx={{ textTransform: 'none', color: theme.palette.text.secondary }}>Cancel</Button>
              <Button variant="contained" onClick={() => renewalMutation.mutate({ renewalDueOn: renewalForm.renewalDueOn || null, note: renewalForm.note.trim() || undefined })}
                disabled={renewalMutation.isPending || !renewalForm.renewalDueOn}
                sx={{ textTransform: 'none', bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}>
                {renewalMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* — Recording the new certificate — */}
          <Dialog open={completeOpen} onClose={() => setCompleteOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '18px' } }}>
            <DialogTitle sx={{ fontWeight: 800 }}>Record the new certificate</DialogTitle>
            <DialogContent>
              {dialogError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setDialogError('')}>{dialogError}</Alert>}
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block', mb: 2 }}>
                The reference and the issue date are the only things DBS permits a provider to keep — never a copy or an
                image of the certificate. Recording them completes the renewal and restarts the check cadence.
              </Typography>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField label="New certificate reference" value={completeForm.certificateReference} onChange={(e) => setCompleteForm({ ...completeForm, certificateReference: e.target.value })} fullWidth required
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
                <TextField label="Issued" type="date" value={completeForm.certificateIssuedOn} onChange={(e) => setCompleteForm({ ...completeForm, certificateIssuedOn: e.target.value })} fullWidth
                  InputLabelProps={{ shrink: true }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
                <TextField label="Next check due (optional)" type="date" value={completeForm.nextCheckDueOn} onChange={(e) => setCompleteForm({ ...completeForm, nextCheckDueOn: e.target.value })} fullWidth
                  helperText="Defaults to one interval from today" InputLabelProps={{ shrink: true }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 3, pt: 0 }}>
              <Button onClick={() => setCompleteOpen(false)} sx={{ textTransform: 'none', color: theme.palette.text.secondary }}>Cancel</Button>
              <Button variant="contained" onClick={handleCompleteRenewal} disabled={completeMutation.isPending}
                sx={{ textTransform: 'none', bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}>
                {completeMutation.isPending ? 'Saving...' : 'Complete renewal'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* — Withdrawing consent — */}
          <Dialog open={withdrawOpen} onClose={() => setWithdrawOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '18px' } }}>
            <DialogTitle sx={{ fontWeight: 800 }}>Withdraw consent</DialogTitle>
            <DialogContent>
              {dialogError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setDialogError('')}>{dialogError}</Alert>}
              <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                Status checks stop immediately and reminders stop with them. The withdrawal and its reason stay on the record,
                so it is clear when consent ended and that no check was made after it. This cannot be undone — consenting again
                creates a new subscription.
              </Alert>
              <TextField label="Reason" value={withdrawReason} onChange={(e) => setWithdrawReason(e.target.value)} fullWidth required multiline minRows={2}
                helperText="For example: the individual withdrew consent in writing" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
            </DialogContent>
            <DialogActions sx={{ p: 3, pt: 0 }}>
              <Button onClick={() => setWithdrawOpen(false)} sx={{ textTransform: 'none', color: theme.palette.text.secondary }}>Cancel</Button>
              <Button variant="contained" onClick={handleWithdraw} disabled={withdrawMutation.isPending}
                sx={{ textTransform: 'none', bgcolor: '#EF4444', '&:hover': { bgcolor: 'error.dark' }, fontWeight: 600 }}>
                {withdrawMutation.isPending ? 'Withdrawing...' : 'Withdraw consent'}
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
                  <Line type="monotone" dataKey="score" stroke={P.navy} strokeWidth={2.5} dot={{ r: 4, fill: P.navy, stroke: theme.palette.background.paper, strokeWidth: 2 }} activeDot={{ r: 6 }} />
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
  const { showSnackbar } = useSnackbar()
  const [page, setPage] = useState(0)
  const [rowsPerPage] = useState(10)
  // Figma 5.12: the audit trail exports what it shows — a date window and an
  // Export CSV that downloads exactly the filtered rows.
  const [range, setRange] = useState<'all' | '7' | '30'>('all')

  const { data: logs, isError: auditError } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: async () => {
      const response = await api.get('/audit/logs')
      return response.data
    },
    enabled: open,
  })

  const now = Date.now()
  const rangeMs = range === '7' ? 7 * 86400000 : range === '30' ? 30 * 86400000 : 0
  const filteredLogs = (logs || []).filter((log: any) => !rangeMs || (new Date(log.created_at).getTime() >= now - rangeMs))

  const exportAuditCsv = () => {
    const rows = [['Action', 'Entity', 'User', 'Date']]
    for (const log of filteredLogs) rows.push([log.action, log.entity_type, log.user_name || log.user_email || log.user_id || '', new Date(log.created_at).toLocaleString()])
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'compliance-audit-trail.csv'
    a.click()
    URL.revokeObjectURL(url)
    showSnackbar('compliance-audit-trail.csv is downloading.', 'success', 'Download started')
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: '18px' } }}>
      <DialogTitle sx={{ fontWeight: 800 }}>Audit Trail</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
          Every action on this page, with who did it and when.
        </Typography>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
          <Tabs value={range} onChange={(_, v) => { setRange(v); setPage(0) }}>
            <Tab value="all" label="All time" sx={{ textTransform: 'none', fontWeight: 600 }} />
            <Tab value="7" label="Last 7 days" sx={{ textTransform: 'none', fontWeight: 600 }} />
            <Tab value="30" label="Last 30 days" sx={{ textTransform: 'none', fontWeight: 600 }} />
          </Tabs>
          <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={exportAuditCsv} disabled={!filteredLogs.length}
            sx={{ textTransform: 'none', fontWeight: 600 }}>
            Export CSV
          </Button>
        </Stack>
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
                <TableRow><TableCell colSpan={4} sx={{ borderBottom: 'none' }}><Alert severity="warning" sx={{ borderRadius: 2, m: 1 }}>Audit trail requires ORG_ADMIN or SUPER_ADMIN access.</Alert></TableCell></TableRow>
              ) : filteredLogs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((log: any) => (
                <TableRow key={log.id} sx={{ '&:last-child td': { borderBottom: 'none' } }}>
                  <TableCell sx={{ borderBottom: `1px solid ${theme.palette.divider}`, fontWeight: 600 }}>{log.action}</TableCell>
                  <TableCell sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>{log.entity_type}</TableCell>
                  <TableCell sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>{log.user_name || log.user_email || log.user_id || '—'}</TableCell>
                  <TableCell sx={{ borderBottom: `1px solid ${theme.palette.divider}`, color: theme.palette.text.secondary, fontSize: '0.85rem' }}>{new Date(log.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {!auditError && filteredLogs.length === 0 && (
                <TableRow><TableCell colSpan={4} sx={{ borderBottom: 'none' }}><EmptyState title="No audit logs" description="Audit logs will appear here as actions are recorded" variant="default" /></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={filteredLogs.length}
          page={page}
          onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[10]}
        />
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', color: theme.palette.text.secondary }}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
