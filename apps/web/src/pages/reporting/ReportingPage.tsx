import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Grid, Card, CardContent, Stack, TextField, InputAdornment, Chip,
  CircularProgress, Alert, Avatar, Paper, Divider, Button,
} from '@mui/material'
import {
  Search as SearchIcon,
  People as PeopleIcon, Group as GroupIcon, CalendarMonth as CalendarIcon,
  BeachAccess as LeaveIcon, WarningAmber as WarningIcon, Assessment as AssessIcon,
  School as SchoolIcon, Medication as MedIcon, Psychology as PsychIcon,
  Event as EventIcon, MeetingRoom as MeetingRoomIcon, Star as StarIcon,
  MonitorHeart as MonitorHeartIcon, Task as TaskIcon, Payments as PaymentsIcon,
  ArrowForward as ArrowForwardIcon, TrendingUp as TrendingUpIcon,
} from '@mui/icons-material'
import api from '../../services/api'

const ICON_MAP: Record<string, React.ReactNode> = {
  People: <PeopleIcon />, Group: <GroupIcon />, CalendarMonth: <CalendarIcon />,
  BeachAccess: <LeaveIcon />, WarningAmber: <WarningIcon />, Assessment: <AssessIcon />,
  School: <SchoolIcon />, Medication: <MedIcon />, Psychology: <PsychIcon />,
  LocationOn: <AssessIcon />, Badge: <PeopleIcon />, Description: <AssessIcon />,
  Star: <StarIcon />, Assignment: <AssessIcon />, Note: <AssessIcon />,
  FactCheck: <AssessIcon />, Schedule: <CalendarIcon />, Business: <AssessIcon />,
  Balance: <LeaveIcon />, AccountTree: <AssessIcon />, ShowChart: <AssessIcon />,
  Timer: <AssessIcon />, Person: <PeopleIcon />, MenuBook: <SchoolIcon />,
  ReportProblem: <WarningIcon />, EmojiEvents: <SchoolIcon />, Science: <MedIcon />,
  Favorite: <PsychIcon />, TrendingUp: <AssessIcon />,
  Event: <EventIcon />, MeetingRoom: <MeetingRoomIcon />,
  MonitorHeart: <MonitorHeartIcon />, Task: <TaskIcon />, Payments: <PaymentsIcon />,
}

interface ReportDef {
  id: string; title: string; description: string; category: string; icon: string; color: string; filters: string[]
}
interface Category { id: string; label: string; color: string; icon: string }
interface OverviewCard { label: string; value: string | number; subtitle: string; color: string }
interface OverviewData { cards: OverviewCard[]; attention: { label: string; value: number; action: string; target: string }[]; generatedAt: string }

export default function ReportingPage() {
  const navigate = useNavigate()
  const [reports, setReports] = useState<ReportDef[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.get('/reporting/reports'), api.get('/reporting/overview')])
      .then(([reportsResponse, overviewResponse]) => {
        setReports(reportsResponse.data.reports)
        setCategories(reportsResponse.data.categories)
        setOverview(overviewResponse.data)
      })
      .catch(e => setError(e.response?.data?.message || 'Failed to load reports'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!search) return reports
    const q = search.toLowerCase()
    return reports.filter(r => r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.category.includes(q))
  }, [reports, search])

  const grouped = useMemo(() => {
    const map: Record<string, ReportDef[]> = {}
    filtered.forEach(r => { (map[r.category] = map[r.category] || []).push(r) })
    return map
  }, [filtered])

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Reporting Suite</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
          Explore your data with interactive charts, filters, and exports
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}

      {overview && <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mb: 4, borderRadius: 2, borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="overline" color="primary" sx={{ fontWeight: 800, letterSpacing: '0.12em' }}>Organisation overview</Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>What needs attention today</Typography>
            <Grid container spacing={1.5}>
              {overview.cards.map(card => <Grid item xs={6} sm={4} key={card.label}>
                <Box sx={{ borderLeft: `4px solid ${card.color}`, pl: 1.5 }}>
                  <Typography variant="h5" sx={{ fontWeight: 900, color: card.color }}>{card.value}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{card.label}</Typography>
                  <Typography variant="caption" color="text.secondary">{card.subtitle}</Typography>
                </Box>
              </Grid>)}
            </Grid>
          </Box>
          <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', lg: 'block' } }} />
          <Box sx={{ width: { xs: '100%', lg: 300 } }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Quick actions</Typography>
            <Stack spacing={0.5}>
              {overview.attention.map(item => <Button key={item.label} size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate(item.target === 'locations' ? '/locations' : `/${item.target}`)} sx={{ justifyContent: 'space-between', textTransform: 'none', color: item.value > 0 && item.target !== 'locations' ? 'error.main' : 'text.primary' }}>
                <span>{item.label}: <strong>{item.value}</strong></span>
              </Button>)}
            </Stack>
          </Box>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 2, color: 'text.secondary' }}><TrendingUpIcon sx={{ fontSize: 16 }} /><Typography variant="caption">Live snapshot generated {new Date(overview.generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</Typography></Stack>
      </Paper>}

      <TextField
        fullWidth size="small" placeholder="Search reports..."
        value={search} onChange={e => setSearch(e.target.value)}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment> }}
        sx={{ mb: 4, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'grey.50' } }}
      />

      {categories.map(cat => {
        const catReports = grouped[cat.id]
        if (!catReports || catReports.length === 0) return null
        return (
          <Box key={cat.id} sx={{ mb: 4 }}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: `${cat.color}18`, color: cat.color, fontSize: 18 }}>
                {ICON_MAP[cat.icon] || <AssessIcon />}
              </Avatar>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{cat.label}</Typography>
              <Chip label={catReports.length} size="small" sx={{ fontWeight: 700, bgcolor: `${cat.color}15`, color: cat.color }} />
            </Stack>

            <Grid container spacing={2.5}>
              {catReports.map(report => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={report.id}>
                  <Card
                    elevation={0}
                    onClick={() => navigate(`/reports/${report.id}`)}
                    sx={{
                      border: '1px solid', borderColor: 'divider', borderRadius: 2, cursor: 'pointer',
                      transition: 'all 0.2s', height: '100%',
                      '&:hover': { borderColor: report.color, boxShadow: `0 4px 16px ${report.color}20`, transform: 'translateY(-2px)' },
                    }}
                  >
                    <CardContent sx={{ pb: '16px !important' }}>
                      <Stack spacing={1.5}>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <Avatar sx={{ width: 36, height: 36, bgcolor: `${report.color}15`, color: report.color, fontSize: 18 }}>
                            {ICON_MAP[report.icon] || <AssessIcon />}
                          </Avatar>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3, flex: 1 }}>
                            {report.title}
                          </Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                          {report.description}
                        </Typography>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                          {report.filters.length <= 4 && report.filters.map(f => (
                            <Chip key={f} label={f} size="small" variant="outlined"
                              sx={{ fontSize: '0.6rem', height: 18, fontWeight: 500, textTransform: 'capitalize' }} />
                          ))}
                          {report.filters.length > 4 && (
                            <Chip label={`${report.filters.length} filters`} size="small" variant="outlined"
                              sx={{ fontSize: '0.6rem', height: 18, fontWeight: 500 }} />
                          )}
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )
      })}

      {filtered.length === 0 && !loading && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">No reports found</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Try a different search term</Typography>
        </Box>
      )}
    </Box>
  )
}
