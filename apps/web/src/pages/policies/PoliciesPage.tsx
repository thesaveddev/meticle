import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  Add as AddIcon,
  ArticleOutlined as ArticleIcon,
  CheckCircleOutline as PublishedIcon,
  EditOutlined as EditIcon,
  EventOutlined as ReviewIcon,
  GridView as GridViewIcon,
  KeyboardArrowRight as ArrowRightIcon,
  Search as SearchIcon,
  ViewList as ViewListIcon,
  WarningAmberOutlined as WarningIcon,
} from '@mui/icons-material'
import api from '../../services/api'
import PageContainer from '../../components/design/PageContainer'
import PolicyFormDialog from './PolicyFormDialog'
import {
  CATEGORIES,
  EMERALD,
  HAIRLINE,
  INK,
  MUTED,
  NAVY,
  STATUS_OPTIONS,
  categoryColors,
  formatDate,
  isReviewDue,
  statusLabel,
  type Policy,
} from './policyShared'



export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [formOpen, setFormOpen] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const currentUser = useMemo(() => {
    try {
      const stored = localStorage.getItem('user')
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  }, [])
  const canManagePolicies = currentUser.role === 'ORG_ADMIN' || currentUser.role === 'MANAGER'

  const fetchPolicies = async () => {
    setError('')
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (categoryFilter) params.set('category', categoryFilter)
      const response = await api.get(`/policies?${params}`)
      setPolicies(response.data)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'We could not load the policy library.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(fetchPolicies, 250)
    return () => window.clearTimeout(timer)
  }, [search, categoryFilter])

  const visiblePolicies = useMemo(
    () => statusFilter ? policies.filter((policy) => (policy.status === 'active' ? 'published' : policy.status) === statusFilter) : policies,
    [policies, statusFilter],
  )

  const stats = useMemo(() => ({
    total: policies.length,
    published: policies.filter((policy) => policy.status === 'published' || policy.status === 'active').length,
    drafts: policies.filter((policy) => policy.status === 'draft').length,
    due: policies.filter((policy) => isReviewDue(policy.review_due_at)).length,
  }), [policies])

  const openCreate = () => setFormOpen(true)

  if (loading) {
    return <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}><CircularProgress sx={{ color: NAVY }} /></Box>
  }

  return (
    <PageContainer>
      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}

      <Box sx={{ mb: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} gap={2}>
          <Box>
            <Typography sx={{ color: NAVY, fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.13em', textTransform: 'uppercase', mb: 1 }}>
              Compliance library
            </Typography>
            <Typography variant="h4" sx={{ color: INK, fontWeight: 900, letterSpacing: '-0.03em', mb: 0.75 }}>
              Policies & procedures
            </Typography>
            <Typography sx={{ color: MUTED, maxWidth: 660 }}>
              Keep the team aligned on the policies that protect people, staff, and your service. Open any policy to read the full guidance and its review history.
            </Typography>
          </Box>
          {canManagePolicies && <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ bgcolor: NAVY, '&:hover': { bgcolor: '#0B3A63' }, borderRadius: 1.5, px: 2.5, py: 1.25, fontWeight: 800, flexShrink: 0 }}>
            Add policy
          </Button>}
        </Stack>
      </Box>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        {[
          { label: 'All policies', value: stats.total, icon: <ArticleIcon />, color: NAVY },
          { label: 'Published', value: stats.published, icon: <PublishedIcon />, color: EMERALD },
          { label: 'Drafts', value: stats.drafts, icon: <EditIcon />, color: '#B54708' },
          { label: 'Review due', value: stats.due, icon: <WarningIcon />, color: stats.due ? '#B42318' : '#667085' },
        ].map((stat) => (
          <Grid item xs={6} md={3} key={stat.label}>
            <Paper variant="outlined" sx={{ p: 2, borderColor: HAIRLINE, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 38, height: 38, borderRadius: 1.5, display: 'grid', placeItems: 'center', color: stat.color, bgcolor: `${stat.color}12` }}>{stat.icon}</Box>
              <Box>
                <Typography sx={{ color: MUTED, fontSize: '0.75rem', fontWeight: 700 }}>{stat.label}</Typography>
                <Typography sx={{ color: INK, fontSize: '1.45rem', lineHeight: 1.15, fontWeight: 900 }}>{stat.value}</Typography>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, mb: 3, borderColor: HAIRLINE, borderRadius: 2, bgcolor: 'background.paper' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
          <TextField
            size="small"
            placeholder="Search titles and policy content"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={{ flex: 1, minWidth: 220 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: MUTED }} /></InputAdornment> }}
          />
          <FormControl size="small" sx={{ minWidth: 190 }}>
            <InputLabel>Category</InputLabel>
            <Select value={categoryFilter} label="Category" onChange={(event) => setCategoryFilter(event.target.value)}>
              <MenuItem value="">All categories</MenuItem>
              {CATEGORIES.map((category) => <MenuItem key={category} value={category}>{category}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} label="Status" onChange={(event) => setStatusFilter(event.target.value)}>
              {STATUS_OPTIONS.map((status) => <MenuItem key={status.value} value={status.value}>{status.label}</MenuItem>)}
            </Select>
          </FormControl>
          <Stack direction="row" sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: 1.5, p: 0.25, alignSelf: { xs: 'flex-start', md: 'auto' } }}>
            <Tooltip title="Card view"><IconButton size="small" color={viewMode === 'grid' ? 'primary' : 'default'} onClick={() => setViewMode('grid')}><GridViewIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="List view"><IconButton size="small" color={viewMode === 'list' ? 'primary' : 'default'} onClick={() => setViewMode('list')}><ViewListIcon fontSize="small" /></IconButton></Tooltip>
          </Stack>
        </Stack>
      </Paper>

      {visiblePolicies.length === 0 ? (
        <Paper variant="outlined" sx={{ p: { xs: 5, md: 8 }, borderRadius: 2, borderColor: HAIRLINE, textAlign: 'center' }}>
          <ArticleIcon sx={{ fontSize: 44, color: '#CBD5E1', mb: 1 }} />
          <Typography sx={{ color: INK, fontWeight: 800, mb: 0.75 }}>No policies match those filters</Typography>
          <Typography sx={{ color: MUTED, mb: 2 }}>Try a different search or clear one of the filters.</Typography>
          <Button variant="outlined" onClick={() => { setSearch(''); setCategoryFilter(''); setStatusFilter('') }} sx={{ borderColor: NAVY, color: NAVY }}>Clear filters</Button>
        </Paper>
      ) : viewMode === 'grid' ? (
        <Grid container spacing={2}>
          {visiblePolicies.map((policy) => {
            const color = categoryColors[policy.category] || NAVY
            const due = isReviewDue(policy.review_due_at)
            return (
              <Grid item xs={12} sm={6} lg={4} key={policy.id}>
                <Paper
                  component="button"
                  type="button"
                  variant="outlined"
                  onClick={() => navigate(`/policies/${policy.id}`)}
                  sx={{ width: '100%', textAlign: 'left', p: 0, overflow: 'hidden', borderColor: HAIRLINE, borderRadius: 2, bgcolor: 'background.paper', cursor: 'pointer', transition: 'border-color 0.15s ease', '&:hover': { borderColor: NAVY } }}
                >
                  <Box sx={{ p: 2.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1} sx={{ mb: 2 }}>
                      <Chip label={policy.category} size="small" sx={{ color, bgcolor: `${color}14`, fontWeight: 800, fontSize: '0.68rem', maxWidth: '80%' }} />
                      <Chip label={`v${policy.version}`} size="small" sx={{ color: MUTED, bgcolor: 'grey.100', fontWeight: 800, fontSize: '0.68rem' }} />
                    </Stack>
                    <Typography sx={{ color: INK, fontWeight: 850, fontSize: '1.05rem', lineHeight: 1.3, minHeight: 54, mb: 1.25 }}>{policy.title}</Typography>
                    <Typography sx={{ color: MUTED, fontSize: '0.86rem', lineHeight: 1.6, minHeight: 66, mb: 2 }}>{policy.content.slice(0, 160)}{policy.content.length > 160 ? '…' : ''}</Typography>
                    <Divider sx={{ mb: 1.5 }} />
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        {due ? <WarningIcon sx={{ fontSize: 16, color: '#B42318' }} /> : <ReviewIcon sx={{ fontSize: 16, color: MUTED }} />}
                        <Typography sx={{ color: due ? '#B42318' : MUTED, fontSize: '0.75rem', fontWeight: 700 }}>{due ? 'Review overdue' : `Review ${formatDate(policy.review_due_at)}`}</Typography>
                      </Stack>
                      <ArrowRightIcon sx={{ color: NAVY }} />
                    </Stack>
                  </Box>
                </Paper>
              </Grid>
            )
          })}
        </Grid>
      ) : (
        <Paper variant="outlined" sx={{ borderColor: HAIRLINE, borderRadius: 2, overflow: 'hidden' }}>
          {visiblePolicies.map((policy, index) => {
            const color = categoryColors[policy.category] || NAVY
            const due = isReviewDue(policy.review_due_at)
            return (
              <Box key={policy.id} component="button" type="button" onClick={() => navigate(`/policies/${policy.id}`)} sx={{ width: '100%', border: 0, borderBottom: index < visiblePolicies.length - 1 ? `1px solid ${HAIRLINE}` : 0, bgcolor: 'background.paper', p: 2, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--card-gap)', '&:hover': { bgcolor: 'grey.50' } }}>
                <Box sx={{ width: 8, alignSelf: 'stretch', minHeight: 42, borderRadius: 1, bgcolor: color, flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ sm: 1 }} alignItems={{ sm: 'center' }}>
                    <Typography sx={{ color: INK, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{policy.title}</Typography>
                    <Chip label={policy.category} size="small" sx={{ width: 'fit-content', color, bgcolor: `${color}14`, fontWeight: 700, fontSize: '0.66rem' }} />
                  </Stack>
                  <Typography sx={{ color: MUTED, fontSize: '0.8rem', mt: 0.5 }}>{statusLabel(policy.status)} · v{policy.version} · Updated {formatDate(policy.updated_at || policy.created_at)}</Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ display: { xs: 'none', sm: 'flex' } }}>
                  <Typography sx={{ color: due ? '#B42318' : MUTED, fontSize: '0.78rem', fontWeight: 700 }}>{due ? 'Review overdue' : `Review ${formatDate(policy.review_due_at)}`}</Typography>
                  <ArrowRightIcon sx={{ color: NAVY }} />
                </Stack>
              </Box>
            )
          })}
        </Paper>
      )}

      <PolicyFormDialog
        open={formOpen}
        editing={null}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); fetchPolicies() }}
      />
    </PageContainer>
  )
}
