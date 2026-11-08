import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
  Typography,
} from '@mui/material'
import {
  Add as AddIcon,
  ArticleOutlined as ArticleIcon,
  AccessTime as SoonIcon,
  CheckCircleOutline as ReadIcon,
  Search as SearchIcon,
  WarningAmberOutlined as WarningIcon,
} from '@mui/icons-material'
import api from '../../services/api'
import PageContainer from '../../components/design/PageContainer'
import PolicyFormDialog from './PolicyFormDialog'
import {
  HAIRLINE,
  INK,
  MUTED,
  NAVY,
  formatDate,
  isReviewDue,
  isReviewSoon,
  reviewState,
  type Policy,
  type ReviewState,
} from './policyShared'

const REVIEW_CHIP: Record<ReviewState, { label: string; color: string; bgcolor: string }> = {
  overdue: { label: 'Review overdue', color: 'notice.error.fg', bgcolor: 'notice.error.bg' },
  soon: { label: 'Review soon', color: 'notice.info.fg', bgcolor: 'notice.info.bg' },
  current: { label: 'Current', color: 'notice.success.fg', bgcolor: 'notice.success.bg' },
}

function updatedMonthYear(date?: string) {
  if (!date) return 'Updated —'
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return 'Updated —'
  return `Updated ${parsed.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`
}

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [reviewFilter, setReviewFilter] = useState('')
  // Figma 5.9: Library tabs, card/list view, and a "missing review date" focus
  // from the alert banner. Statuses are org-wide — policies carry no location,
  // so there is no location filter (nothing to filter by).
  const [tab, setTab] = useState<'all' | 'published' | 'drafts' | 'review-due' | 'archived'>('all')
  const [cardView, setCardView] = useState(true)
  const [missingDateOnly, setMissingDateOnly] = useState(false)
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

  // Shared with the compliance pages under the same key: one request serves all.
  const { data: membersData } = useQuery({
    queryKey: ['org-members'],
    queryFn: async () => (await api.get('/staff/org-members')).data,
    staleTime: 60_000,
  })
  const staffTotal: number | null = useMemo(() => {
    if (!membersData) return null
    const admins = membersData?.admins?.length ? membersData.admins : (membersData?.admin ? [membersData.admin] : [])
    return admins.length + (membersData?.staff?.length || 0)
  }, [membersData])

  const fetchPolicies = async () => {
    setError('')
    try {
      const response = await api.get('/policies')
      setPolicies(response.data)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'We could not load the policy library.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPolicies()
  }, [])

  const categories = useMemo(
    () => Array.from(new Set(policies.map((policy) => policy.category).filter(Boolean))).sort(),
    [policies],
  )

  const tabCounts = useMemo(() => ({
    all: policies.length,
    published: policies.filter((p) => p.status === 'published' || p.status === 'active').length,
    drafts: policies.filter((p) => p.status === 'draft').length,
    'review-due': policies.filter((p) => isReviewDue(p.review_due_at)).length,
    archived: policies.filter((p) => p.status === 'archived').length,
  }), [policies])
  const visiblePolicies = useMemo(() => {
    const term = search.trim().toLowerCase()
    return policies
      .filter((policy) => !categoryFilter || policy.category === categoryFilter)
      .filter((policy) => !reviewFilter || reviewState(policy.review_due_at) === reviewFilter)
      .filter((policy) => !missingDateOnly || !policy.review_due_at)
      .filter((policy) => {
        if (tab === 'published') return policy.status === 'published' || policy.status === 'active'
        if (tab === 'drafts') return policy.status === 'draft'
        if (tab === 'review-due') return isReviewDue(policy.review_due_at)
        if (tab === 'archived') return policy.status === 'archived'
        return true
      })
      .filter((policy) => !term || policy.title.toLowerCase().includes(term) || policy.content.toLowerCase().includes(term))
      .slice()
      .sort((a, b) => {
        if (!a.review_due_at && !b.review_due_at) return a.title.localeCompare(b.title)
        if (!a.review_due_at) return 1
        if (!b.review_due_at) return -1
        return new Date(a.review_due_at).getTime() - new Date(b.review_due_at).getTime() || a.title.localeCompare(b.title)
      })
  }, [policies, categoryFilter, reviewFilter, missingDateOnly, search, tab])

  const stats = useMemo(() => {
    const published = policies.filter((policy) => policy.status === 'published' || policy.status === 'active')
    const totalReads = published.reduce((sum, p) => sum + (p.acknowledged_count || 0), 0)
    const readPct = published.length && staffTotal
      ? Math.round((totalReads / (published.length * staffTotal)) * 100)
      : 0
    return {
      total: policies.length,
      published: published.length,
      dueSoon: policies.filter((policy) => isReviewSoon(policy.review_due_at)).length,
      overdue: policies.filter((policy) => isReviewDue(policy.review_due_at)).length,
      noReviewDate: policies.filter((policy) => !policy.review_due_at).length,
      drafts: policies.filter((policy) => policy.status === 'draft').length,
      readPct,
      totalReads,
      readByEveryone: staffTotal
        ? policies.filter((policy) => (policy.acknowledged_count || 0) >= staffTotal).length
        : null,
    }
  }, [policies, staffTotal])

  const readBy = (policy: Policy) => {
    const count = policy.acknowledged_count || 0
    return staffTotal === null ? `${count}` : `${count} of ${staffTotal}`
  }

  if (loading) {
    return <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}><CircularProgress sx={{ color: NAVY }} /></Box>
  }

  return (
    <PageContainer>
      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}

      <Box sx={{ mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} gap={2}>
          <Box>
            <Typography sx={{ color: NAVY, fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.13em', textTransform: 'uppercase', mb: 1 }}>
              Compliance &amp; safety / Policies
            </Typography>
            <Typography variant="h4" sx={{ color: INK, fontWeight: 600, letterSpacing: '-0.03em', mb: 0.75 }}>
              Policies &amp; procedures
            </Typography>
            <Typography sx={{ color: MUTED, maxWidth: 660 }}>
              Keep the team aligned on the policies that protect people, staff and your service.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Button variant={cardView ? 'outlined' : 'text'} size="small" onClick={() => setCardView(false)} sx={{ textTransform: 'none', fontWeight: 600 }}>List view</Button>
            <Button variant={cardView ? 'text' : 'outlined'} size="small" onClick={() => setCardView(true)} sx={{ textTransform: 'none', fontWeight: 600 }}>Card view</Button>
            {canManagePolicies && <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormOpen(true)} sx={{ bgcolor: NAVY, px: 2.5, py: 1.25, fontWeight: 600, flexShrink: 0, textTransform: 'none' }}>
              Add policy
            </Button>}
          </Stack>
        </Stack>
      </Box>

      {stats.noReviewDate > 0 && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }} action={<Button size="small" onClick={() => { setMissingDateOnly(true); setTab('all') }} sx={{ textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}>Set review dates</Button>}>
          {stats.noReviewDate} {stats.noReviewDate === 1 ? 'policy has' : 'policies have'} no review date. Inspections look for a review date on every policy. Setting one now means we can remind you before it&apos;s due.
        </Alert>
      )}
      {missingDateOnly && (
        <Box sx={{ mb: 2 }}><Chip label="Missing review date" onDelete={() => setMissingDateOnly(false)} color="warning" size="small" sx={{ fontWeight: 600 }} /></Box>
      )}

      <Box sx={{ display: 'flex', gap: 2.5, borderBottom: `1px solid ${HAIRLINE}`, mb: 3, overflowX: 'auto' }}>
        {([
          { key: 'all', label: 'All policies', count: tabCounts.all },
          { key: 'published', label: 'Published', count: tabCounts.published },
          { key: 'drafts', label: 'Drafts', count: tabCounts.drafts },
          { key: 'review-due', label: 'Review due', count: tabCounts['review-due'] },
          { key: 'archived', label: 'Archived', count: tabCounts.archived },
        ] as { key: typeof tab; label: string; count: number }[]).map((t) => (
          <Button
            key={t.key}
            onClick={() => { setTab(t.key); setMissingDateOnly(false) }}
            sx={{
              textTransform: 'none', fontWeight: 600, borderRadius: 0, px: 0.5, py: 1.25,
              color: tab === t.key ? NAVY : MUTED,
              borderBottom: tab === t.key ? `2px solid ${NAVY}` : '2px solid transparent',
              mb: '-1px', whiteSpace: 'nowrap',
            }}
          >
            {t.label} ({t.count})
          </Button>
        ))}
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Published', value: stats.published, sub: stats.published === policies.filter((p) => p.version === '1.0').length && stats.published > 0 ? 'All on version 1.0' : `Of ${stats.total} policies`, icon: <ArticleIcon />, iconBg: 'notice.info.bg', iconColor: NAVY, valueColor: INK, bar: undefined as number | undefined, action: undefined as { label: string; onClick: () => void } | undefined },
          { label: 'Read by staff', value: `${stats.readPct}%`, sub: staffTotal ? `${stats.totalReads} of ${stats.published * staffTotal} reads` : 'No staff yet', icon: <ReadIcon />, iconBg: 'notice.info.bg', iconColor: NAVY, valueColor: INK, bar: stats.readPct, action: undefined },
          { label: 'Review date not set', value: stats.noReviewDate, sub: 'Set a review date', icon: <SoonIcon />, iconBg: 'notice.info.bg', iconColor: NAVY, valueColor: INK, bar: undefined, action: stats.noReviewDate > 0 ? { label: 'Set review dates', onClick: () => { setMissingDateOnly(true); setTab('all') } } : undefined },
          { label: 'Drafts', value: stats.drafts, sub: stats.drafts === 1 ? '1 in drafts' : `${stats.drafts} in drafts`, icon: <WarningIcon />, iconBg: 'notice.info.bg', iconColor: NAVY, valueColor: INK, bar: undefined, action: stats.drafts > 0 ? { label: 'View drafts', onClick: () => { setTab('drafts'); setMissingDateOnly(false) } } : undefined },
        ].map((stat) => (
          <Grid item xs={6} md={3} key={stat.label}>
            <Paper variant="outlined" sx={{ p: 2, borderColor: HAIRLINE, borderRadius: 2, position: 'relative', height: '100%' }}>
              <Box sx={{ position: 'absolute', top: 12, right: 12, width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', color: stat.iconColor, bgcolor: stat.iconBg }}>
                {stat.icon}
              </Box>
              <Typography sx={{ color: MUTED, fontSize: '0.78rem', fontWeight: 600 }}>{stat.label}</Typography>
              <Typography sx={{ color: stat.valueColor, fontSize: '1.7rem', lineHeight: 1.2, fontWeight: 700 }}>{stat.value}</Typography>
              {stat.bar !== undefined && (
                <Box sx={{ height: 6, borderRadius: 3, bgcolor: '#EDF1F6', overflow: 'hidden', my: 1 }}>
                  <Box sx={{ width: `${stat.bar}%`, height: 6, borderRadius: 3, bgcolor: NAVY }} />
                </Box>
              )}
              {stat.action ? (
                <Button size="small" onClick={stat.action.onClick} sx={{ color: NAVY, textTransform: 'none', fontWeight: 700, p: 0, minWidth: 0, fontSize: '0.78rem' }}>{stat.action.label}</Button>
              ) : (
                <Typography sx={{ color: MUTED, fontSize: '0.78rem' }}>{stat.sub}</Typography>
              )}
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper variant="outlined" sx={{ borderColor: HAIRLINE, borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ p: { xs: 2, md: 2.5 }, pb: { xs: 2, md: 2 } }}>
          <Typography sx={{ color: INK, fontWeight: 700, fontSize: '1.05rem' }}>{tab === 'all' ? 'All policies' : tab === 'published' ? 'Published' : tab === 'drafts' ? 'Drafts' : tab === 'review-due' ? 'Review due' : 'Archived'}</Typography>
          <Typography sx={{ color: MUTED, fontSize: '0.82rem', mb: 2 }}>{tab === 'drafts' ? 'Still being written — nothing here is visible to staff' : tab === 'review-due' ? 'Overdue reviews first' : 'Sorted by next review date'}</Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
            <TextField
              size="small"
              placeholder="Search policies"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              sx={{ flex: 1, minWidth: 200 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: MUTED }} /></InputAdornment> }}
            />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Category</InputLabel>
              <Select value={categoryFilter} label="Category" onChange={(event) => setCategoryFilter(event.target.value)}>
                <MenuItem value="">All categories</MenuItem>
                {categories.map((category) => <MenuItem key={category} value={category}>{category}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Status</InputLabel>
              <Select value={reviewFilter} label="Status" onChange={(event) => setReviewFilter(event.target.value)}>
                <MenuItem value="">Any status</MenuItem>
                <MenuItem value="current">Current</MenuItem>
                <MenuItem value="soon">Review soon</MenuItem>
                <MenuItem value="overdue">Review overdue</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Box>

        {visiblePolicies.length === 0 ? (
          <Box sx={{ p: { xs: 5, md: 8 }, textAlign: 'center', borderTop: `1px solid ${HAIRLINE}` }}>
            <ArticleIcon sx={{ fontSize: 44, color: '#C3D2E2', mb: 1 }} />
            <Typography sx={{ color: INK, fontWeight: 600, mb: 0.75 }}>{tab === 'drafts' && !search && !categoryFilter && !reviewFilter && !missingDateOnly ? 'No drafts yet' : 'No policies match those filters'}</Typography>
            <Typography sx={{ color: MUTED, mb: 2 }}>{tab === 'drafts' && !search && !categoryFilter && !reviewFilter && !missingDateOnly ? 'Unpublished edits and new policies land here — invisible to staff until you publish them.' : 'Try a different search or clear one of the filters.'}</Typography>
            {tab === 'drafts' && !search && !categoryFilter && !reviewFilter && !missingDateOnly
              ? (canManagePolicies && <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormOpen(true)} sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 600 }}>Create a draft</Button>)
              : <Button variant="outlined" onClick={() => { setSearch(''); setCategoryFilter(''); setReviewFilter(''); setMissingDateOnly(false) }} sx={{ borderColor: NAVY, color: NAVY }}>Clear filters</Button>}
          </Box>
        ) : cardView ? (
            <Box sx={{ borderTop: `1px solid ${HAIRLINE}`, px: { xs: 2, md: 2.5 }, py: 2 }}>                    <Grid container spacing={2}>
                      {visiblePolicies.map((policy) => {
                        const state = reviewState(policy.review_due_at)
                        const chip = REVIEW_CHIP[state]
                        return (
                          <Grid item xs={12} sm={6} lg={4} key={policy.id}>
                            <Paper
                              variant="outlined"
                              role="button"
                              tabIndex={0}
                              onClick={() => navigate(`/policies/${policy.id}`)}
                              onKeyDown={(event) => { if (event.key === 'Enter') navigate(`/policies/${policy.id}`) }}
                              sx={{
                                borderColor: HAIRLINE, borderRadius: 2, p: 2, height: '100%', cursor: 'pointer',
                                '&:hover': { borderColor: NAVY, boxShadow: '0 4px 16px rgba(15,76,129,0.10)' },
                              }}
                            >
                              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                                <Typography sx={{ color: INK, fontWeight: 700 }}>{policy.title}</Typography>
                                <Chip label={chip.label} size="small" sx={{ color: chip.color, bgcolor: chip.bgcolor, fontWeight: 600, fontSize: '0.7rem', flexShrink: 0 }} />
                              </Stack>
                              <Typography sx={{ color: MUTED, fontSize: '0.78rem', mt: 0.5 }}>{policy.category} · v{policy.version} · {updatedMonthYear(policy.updated_at || policy.created_at)}</Typography>
                              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5 }}>
                                <Typography sx={{ color: state === 'overdue' ? 'notice.error.fg' : MUTED, fontSize: '0.8rem', fontWeight: state === 'overdue' ? 700 : 400 }}>
                                  Review: {formatDate(policy.review_due_at)}
                                </Typography>
                                <Typography sx={{ color: MUTED, fontSize: '0.8rem' }}>{readBy(policy)} read</Typography>
                              </Stack>
                            </Paper>
                          </Grid>
                        )
                      })}
                    </Grid>
                  </Box>
        ) : (
          <>
            <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
              <Table>
                <TableHead>
                  <TableRow>
                    {['Policy', 'Category', 'Version', 'Next review', 'Read by', 'Status'].map((heading) => (
                      <TableCell key={heading} sx={{ color: MUTED, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${HAIRLINE}` }}>
                        {heading}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visiblePolicies.map((policy) => {
                    const state = reviewState(policy.review_due_at)
                    const chip = REVIEW_CHIP[state]
                    return (
                      <TableRow
                        key={policy.id}
                        hover
                        onClick={() => navigate(`/policies/${policy.id}`)}
                        sx={{ cursor: 'pointer', '&:last-child td': { borderBottom: 0 } }}
                      >
                        <TableCell sx={{ borderBottom: `1px solid ${HAIRLINE}` }}>
                          <Typography sx={{ color: INK, fontWeight: 700 }}>{policy.title}</Typography>
                          <Typography sx={{ color: MUTED, fontSize: '0.78rem' }}>{updatedMonthYear(policy.updated_at || policy.created_at)}</Typography>
                        </TableCell>
                        <TableCell sx={{ color: INK, borderBottom: `1px solid ${HAIRLINE}` }}>{policy.category}</TableCell>
                        <TableCell sx={{ color: INK, borderBottom: `1px solid ${HAIRLINE}` }}>v{policy.version}</TableCell>
                        <TableCell sx={{ color: state === 'overdue' ? 'notice.error.fg' : INK, fontWeight: state === 'overdue' ? 700 : 400, borderBottom: `1px solid ${HAIRLINE}` }}>
                          {formatDate(policy.review_due_at)}
                        </TableCell>
                        <TableCell sx={{ color: INK, borderBottom: `1px solid ${HAIRLINE}`, whiteSpace: 'nowrap' }}>{readBy(policy)}</TableCell>
                        <TableCell sx={{ borderBottom: `1px solid ${HAIRLINE}` }}>
                          <Chip label={chip.label} size="small" sx={{ color: chip.color, bgcolor: chip.bgcolor, fontWeight: 600, fontSize: '0.72rem' }} />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ display: { xs: 'block', md: 'none' } }}>
              {visiblePolicies.map((policy) => {
                const state = reviewState(policy.review_due_at)
                const chip = REVIEW_CHIP[state]
                return (
                  <Box
                    key={policy.id}
                    component="button"
                    type="button"
                    onClick={() => navigate(`/policies/${policy.id}`)}
                    sx={{
                      width: '100%', border: 0, borderTop: `1px solid ${HAIRLINE}`, bgcolor: 'background.paper',
                      p: 2, textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 1.5,
                      alignItems: 'flex-start', justifyContent: 'space-between',
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ color: INK, fontWeight: 700 }}>{policy.title}</Typography>
                      <Typography sx={{ color: MUTED, fontSize: '0.78rem', mt: 0.25 }}>
                        {updatedMonthYear(policy.updated_at || policy.created_at)} · {formatDate(policy.review_due_at)} · {readBy(policy)} read
                      </Typography>
                    </Box>
                    <Chip label={chip.label} size="small" sx={{ color: chip.color, bgcolor: chip.bgcolor, fontWeight: 600, fontSize: '0.7rem', flexShrink: 0, mt: 0.25 }} />
                  </Box>
                )
              })}
              <Box sx={{ borderTop: `1px solid ${HAIRLINE}` }} />
            </Box>

            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: { xs: 2, md: 2.5 }, py: 1.5, borderTop: `1px solid ${HAIRLINE}` }}>
              <Typography sx={{ color: MUTED, fontSize: '0.8rem' }}>Showing {visiblePolicies.length} of {policies.length}</Typography>
              <Typography sx={{ color: MUTED, fontSize: '0.8rem' }}>Live data</Typography>
            </Stack>
          </>
        )}
      </Paper>

      <PolicyFormDialog
        open={formOpen}
        editing={null}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); fetchPolicies() }}
      />
    </PageContainer>
  )
}
