import { useState } from 'react'
import {
  Box, Typography, Grid, Stack, Chip, Button, Paper,
  CircularProgress, Card, CardContent, Divider, IconButton, Collapse,
} from '@mui/material'
import {
  ExpandMore as ExpandIcon, Refresh as RefreshIcon,
  Shield, Assignment, EventBusy, School, Badge,
  Assessment, LocalHospital, RateReview, ChevronRight,
} from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import PageContainer from '../../components/design/PageContainer'


/* ─── Types ──────────────────────────────────────────── */

interface ComplianceData {
  visitCompletion: { total: number; completed: number; missed: number; rate: number }
  carePlans: { total: number; overdue: number; dueSoon: number }
  incidents: { total: number; serious: number; open: number }
  staffTraining: { total: number; nonCompliant: number; rate: number }
  dbs: { total: number; compliant: number; rate: number }
  missedVisits7d: number
  riskAssessments: { total: number; overdue: number }
  supervision: { total: number; done: number; rate: number }
  kloeScores: Array<{ key: string; label: string; score: number; color: string; statements: any[] }>
  overallScore: number
}

/* ─── Helpers ──────────────────────────────────────────── */

function ScoreRing({ value, size = 80, strokeWidth = 6, color }: { value: number; size?: number; strokeWidth?: number; color: string }) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (value / 100) * circumference
  return (
    <Box sx={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E5E7EB" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <Typography sx={{ fontSize: size * 0.22, fontWeight: 800, color }}>{value}%</Typography>
      </Box>
    </Box>
  )
}

function getScoreColor(score: number) {
  if (score >= 80) return '#16A34A'
  if (score >= 60) return '#F59E0B'
  return '#DC2626'
}

function getScoreLabel(score: number) {
  if (score >= 81) return 'Outstanding'
  if (score >= 61) return 'Good'
  if (score >= 31) return 'Requires Improvement'
  return 'Inadequate'
}

/* ─── Stat Card ──────────────────────────────────────────── */

function StatCard({ icon, label, value, sub, color, onClick }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string; onClick?: () => void
}) {
  return (
    <Card
      onClick={onClick}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s',
        '&:hover': onClick ? { boxShadow: 3, transform: 'translateY(-2px)' } : {},
        border: '1px solid', borderColor: 'divider', borderRadius: 3,
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: `${color}15`, display: 'grid', placeItems: 'center', color, flexShrink: 0 }}>
            {icon}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.25, lineHeight: 1.2 }}>{value}</Typography>
            {sub && <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>{sub}</Typography>}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}

/* ─── KLOE Section ──────────────────────────────────────── */

function KloeSection({ domain, expanded, onToggle }: { domain: any; expanded: boolean; onToggle: () => void }) {
  const scoreColor = getScoreColor(domain.score)
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, overflow: 'hidden' }}>
      <Box
        onClick={onToggle}
        sx={{ p: 2.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, '&:hover': { bgcolor: 'action.hover' } }}
      >
        <Box sx={{ width: 8, height: 32, borderRadius: 4, bgcolor: domain.color, flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700 }}>{domain.label}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>{domain.statements?.length || 0} Quality Statements</Typography>
        </Box>
        <ScoreRing value={domain.score} size={52} strokeWidth={4} color={scoreColor} />
        <Chip label={getScoreLabel(domain.score)} size="small" sx={{ bgcolor: `${scoreColor}15`, color: scoreColor, fontWeight: 700 }} />
        <IconButton size="small" sx={{ transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>
          <ExpandIcon fontSize="small" />
        </IconButton>
      </Box>
      <Collapse in={expanded}>
        <Divider />
        <Box sx={{ p: 2.5 }}>
          <Grid container spacing={1.5}>
            {(domain.statements || []).map((s: any) => (
              <Grid item xs={12} sm={6} md={4} key={s.id}>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="caption" sx={{ color: domain.color, fontWeight: 700 }}>{s.id}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500, mt: 0.25 }}>{s.label}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Collapse>
    </Box>
  )
}

/* ─── Main Page ──────────────────────────────────────────── */

export default function HomecareCompliancePage() {
  const navigate = useNavigate()
  const [expandedKloe, setExpandedKloe] = useState<string | null>(null)

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<ComplianceData>({
    queryKey: ['homecare-compliance'],
    queryFn: async () => {
      const res = await api.get('/cqc/homecare-compliance', { timeout: 20_000 })
      return res.data
    },
    refetchInterval: 120_000,
    retry: 1,
  })

  if (isLoading) {
    return (
      <PageContainer>
        <Box role="status" aria-live="polite" sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
          <Stack spacing={2} alignItems="center">
            <CircularProgress size={36} />
            <Typography color="text.secondary">Loading compliance overview…</Typography>
          </Stack>
        </Box>
      </PageContainer>
    )
  }

  if (isError || !data) {
    const status = (error as any)?.response?.status
    return (
      <PageContainer>
        <Box role="alert" sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center', textAlign: 'center', px: 2 }}>
          <Stack spacing={2} alignItems="center" sx={{ maxWidth: 520 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Compliance overview unavailable</Typography>
            <Typography color="text.secondary">
              {status === 403
                ? 'Your organisation does not have access to this compliance view.'
                : 'We could not retrieve the latest compliance data. Check your connection and try again.'}
            </Typography>
            {status !== 403 && <Button variant="contained" onClick={() => refetch()} disabled={isFetching}>Try again</Button>}
          </Stack>
        </Box>
      </PageContainer>
    )
  }

  const d = data
  const kloeColor = getScoreColor(d.overallScore)

  // Build priority actions from gaps
  const actions: Array<{ area: string; action: string; priority: 'high' | 'medium' | 'low'; detail: string; path: string }> = []
  if (d.carePlans.overdue > 0) actions.push({ area: 'Care Plans', action: 'Review overdue care plans', priority: 'high', detail: `${d.carePlans.overdue} care plans have no review date or are overdue`, path: '/people' })
  if (d.riskAssessments.overdue > 0) actions.push({ area: 'Risk Assessments', action: 'Review overdue risk assessments', priority: 'high', detail: `${d.riskAssessments.overdue} risk assessments need review`, path: '/people' })
  if (d.incidents.serious > 0) actions.push({ area: 'Incidents', action: 'Investigate serious incidents', priority: 'high', detail: `${d.incidents.serious} serious incidents in the last 30 days`, path: '/incidents' })
  if (d.incidents.open > 0) actions.push({ area: 'Incidents', action: 'Resolve open incidents', priority: 'medium', detail: `${d.incidents.open} incidents still open or investigating`, path: '/incidents' })
  if (d.missedVisits7d > 0) actions.push({ area: 'Visits', action: 'Follow up missed visits', priority: 'medium', detail: `${d.missedVisits7d} visits missed in the last 7 days`, path: '/homecare' })
  if (d.staffTraining.rate < 90) actions.push({ area: 'Training', action: 'Complete outstanding training', priority: 'medium', detail: `${d.staffTraining.nonCompliant} staff need training completion`, path: '/compliance/training' })
  if (d.dbs.rate < 100) actions.push({ area: 'DBS', action: 'Renew DBS checks', priority: 'high', detail: `${d.dbs.total - d.dbs.compliant} staff without valid DBS`, path: '/compliance/identity' })
  if (d.visitCompletion.rate < 95) actions.push({ area: 'Visits', action: 'Improve visit completion rate', priority: 'low', detail: `Current completion rate is ${d.visitCompletion.rate}%`, path: '/homecare' })
  if (d.supervision.total > 0 && d.supervision.rate < 100) actions.push({ area: 'Supervision', action: 'Record outstanding supervisions', priority: 'medium', detail: `${d.supervision.total - d.supervision.done} staff have no supervision recorded in the last 6 months`, path: '/compliance/supervisions' })

  const priorityOrder = { high: 0, medium: 1, low: 2 }
  actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return (
    <PageContainer>
      {/* Header */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ mb: 3, gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>Homecare Compliance</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            CQC-aligned compliance dashboard for domiciliary care operations
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={() => refetch()} disabled={isFetching}
            sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600 }}>Refresh</Button>
          <Button variant="contained" size="small" onClick={() => navigate('/compliance/readiness')}
            sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600 }}>CQC Readiness</Button>
        </Stack>
      </Stack>

      {/* Overall Score */}
      <Card sx={{ mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'grey.50' }}>
        <CardContent sx={{ p: 3 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={4} sx={{ textAlign: 'center' }}>
              <ScoreRing value={d.overallScore} size={120} strokeWidth={8} color={kloeColor} />
              <Typography sx={{ fontWeight: 700, mt: 1 }}>{getScoreLabel(d.overallScore)}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Overall compliance score</Typography>
            </Grid>
            <Grid item xs={12} md={8}>
              <Grid container spacing={2}>
                {d.kloeScores.map((k) => (
                  <Grid item xs={6} sm={4} key={k.key}>
                    <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                      <ScoreRing value={k.score} size={48} strokeWidth={3} color={k.color} />
                      <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>{k.label}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Stat Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<Assessment />} label="Visit Completion" value={`${d.visitCompletion.rate}%`}
            sub={`${d.visitCompletion.completed}/${d.visitCompletion.total} visits completed`}
            color={d.visitCompletion.rate >= 95 ? '#16A34A' : d.visitCompletion.rate >= 85 ? '#F59E0B' : '#DC2626'}
            onClick={() => navigate('/homecare')} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<Assignment />} label="Care Plans" value={d.carePlans.total}
            sub={d.carePlans.overdue > 0 ? `${d.carePlans.overdue} overdue` : `${d.carePlans.dueSoon} due soon`}
            color={d.carePlans.overdue > 0 ? '#DC2626' : '#16A34A'}
            onClick={() => navigate('/people')} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<School />} label="Staff Training" value={`${d.staffTraining.rate}%`}
            sub={`${d.staffTraining.nonCompliant} staff non-compliant`}
            color={d.staffTraining.rate >= 90 ? '#16A34A' : d.staffTraining.rate >= 75 ? '#F59E0B' : '#DC2626'}
            onClick={() => navigate('/compliance/training')} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<Badge />} label="DBS Compliance" value={`${d.dbs.rate}%`}
            sub={`${d.dbs.compliant}/${d.dbs.total} staff compliant`}
            color={d.dbs.rate >= 100 ? '#16A34A' : '#DC2626'}
            onClick={() => navigate('/compliance/identity')} />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<EventBusy />} label="Missed Visits (7d)" value={d.missedVisits7d}
            sub={d.missedVisits7d > 0 ? 'Requires follow-up' : 'No missed visits'}
            color={d.missedVisits7d > 0 ? '#DC2626' : '#16A34A'}
            onClick={() => navigate('/homecare')} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<LocalHospital />} label="Incidents (30d)" value={d.incidents.total}
            sub={d.incidents.serious > 0 ? `${d.incidents.serious} serious` : `${d.incidents.open} open`}
            color={d.incidents.serious > 0 ? '#DC2626' : d.incidents.open > 0 ? '#F59E0B' : '#16A34A'}
            onClick={() => navigate('/incidents')} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<Shield />} label="Risk Assessments" value={d.riskAssessments.total}
            sub={d.riskAssessments.overdue > 0 ? `${d.riskAssessments.overdue} overdue` : 'All current'}
            color={d.riskAssessments.overdue > 0 ? '#DC2626' : '#16A34A'}
            onClick={() => navigate('/people')} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<RateReview />} label="Supervisions" value={`${d.supervision.rate}%`}
            sub={d.supervision.total > 0
              ? `${d.supervision.done}/${d.supervision.total} staff supervised in 6 months`
              : 'No active staff to supervise yet'}
            color={d.supervision.rate >= 90 ? '#16A34A' : d.supervision.rate >= 70 ? '#F59E0B' : '#DC2626'}
            onClick={() => navigate('/compliance/supervisions')} />
        </Grid>
      </Grid>

      {/* Priority Actions */}
      {actions.length > 0 && (
        <Card sx={{ mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'baseline' }} sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Priority Actions</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Select an action to go straight to the area that needs attention</Typography>
            </Stack>
            <Stack spacing={1}>
              {actions.slice(0, 8).map((a, i) => {
                const accent = a.priority === 'high' ? 'error.main' : a.priority === 'medium' ? 'warning.main' : 'grey.500'
                return (
                  <Paper
                    key={i}
                    component="button"
                    type="button"
                    variant="outlined"
                    onClick={() => navigate(a.path)}
                    sx={{
                      width: '100%', p: 0, m: 0, textAlign: 'left', display: 'flex', alignItems: 'stretch',
                      borderRadius: 2, borderColor: 'divider', bgcolor: 'background.paper', cursor: 'pointer',
                      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                      '&:hover': { borderColor: accent, boxShadow: 2 },
                      '&:focus-visible': { outline: '2px solid', outlineColor: accent },
                    }}
                  >
                    <Box sx={{ width: 5, flexShrink: 0, bgcolor: accent }} />
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ flex: 1, minWidth: 0, px: 2, py: 1.5 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="overline" sx={{ color: accent, fontWeight: 800, letterSpacing: 1 }}>{a.priority}</Typography>
                        <Typography sx={{ fontWeight: 700 }}>{a.action}</Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>{a.detail}</Typography>
                      </Box>
                      <Chip label={a.area} size="small" variant="outlined" sx={{ fontWeight: 600, flexShrink: 0 }} />
                      <ChevronRight sx={{ color: 'text.secondary', flexShrink: 0 }} />
                    </Stack>
                  </Paper>
                )
              })}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* KLOE Domains */}
      <Card sx={{ mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>CQC Quality Statements by Domain</Typography>
          <Stack spacing={1.5}>
            {d.kloeScores.map((domain) => (
              <KloeSection
                key={domain.key}
                domain={domain}
                expanded={expandedKloe === domain.key}
                onToggle={() => setExpandedKloe(expandedKloe === domain.key ? null : domain.key)}
              />
            ))}
          </Stack>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Compliance Evidence</Typography>
          <Grid container spacing={2}>
            {[
              { label: 'Documents & Identity', path: '/compliance/identity', desc: 'DBS, right-to-work, identity documents' },
              { label: 'Evidence Packs', path: '/compliance/evidence', desc: 'Inspection-ready evidence bundles' },
              { label: 'Competency Assessments', path: '/compliance/competency', desc: 'Staff competency tracking' },
              { label: 'Satisfaction Surveys', path: '/compliance/satisfaction', desc: 'Service user feedback' },
              { label: 'Staff Engagement', path: '/compliance/engagement', desc: 'Team engagement surveys' },
              { label: 'Compliance Records', path: '/compliance/records', desc: 'Full audit trail' },
            ].map((link) => (
              <Grid item xs={12} sm={6} md={4} key={link.path}>
                <Box
                  onClick={() => navigate(link.path)}
                  sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', cursor: 'pointer', transition: 'border-color 0.15s ease, box-shadow 0.15s ease', '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover', boxShadow: 1 } }}
                >
                  <Typography sx={{ fontWeight: 600 }}>{link.label}</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>{link.desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    </PageContainer>
  )
}
