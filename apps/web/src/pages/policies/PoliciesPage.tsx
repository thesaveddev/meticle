import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
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
  ArchiveOutlined as ArchiveIcon,
  ArticleOutlined as ArticleIcon,
  CheckCircleOutline as PublishedIcon,
  Close as CloseIcon,
  DeleteOutline as DeleteIcon,
  EditOutlined as EditIcon,
  EventOutlined as ReviewIcon,
  GridView as GridViewIcon,
  KeyboardArrowRight as ArrowRightIcon,
  PictureAsPdf as PdfIcon,
  Search as SearchIcon,
  Share as ShareIcon,
  ViewList as ViewListIcon,
  WarningAmberOutlined as WarningIcon,
} from '@mui/icons-material'
import api from '../../services/api'

interface Policy {
  id: string
  title: string
  category: string
  content: string
  version: string
  status: string
  updated_by?: string
  updated_by_name?: string
  review_due_at?: string
  created_at: string
  updated_at?: string
}

interface Channel {
  id: string
  name: string
  type: string
}

const CATEGORIES = [
  'Risk Management',
  'Human Resources',
  'Health & Safety',
  'GDPR & Data Protection',
  'Infection Control',
  'Equality & Diversity',
  'Mental Health',
  'Fire Safety',
  'Medication',
  'Safeguarding',
]

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
]

const initialForm = {
  title: '',
  category: 'Health & Safety',
  content: '',
  version: '1.0',
  status: 'draft',
  review_due_at: '',
}

const categoryColors: Record<string, string> = {
  'Risk Management': '#B42318',
  'Human Resources': '#0F4C81',
  'Health & Safety': '#B54708',
  'GDPR & Data Protection': '#6941C6',
  'Infection Control': '#027A8B',
  'Equality & Diversity': '#087443',
  'Mental Health': '#087E8B',
  'Fire Safety': '#C4320A',
  Medication: '#047857',
  Safeguarding: '#9F1239',
}

const INK = '#17212B'
const MUTED = '#607080'
const NAVY = '#0F4C81'
const EMERALD = '#047857'
const BONE = '#F7F4EE'
const HAIRLINE = '#E2E8F0'

function statusLabel(status: string) {
  return status === 'active' ? 'Published' : status.charAt(0).toUpperCase() + status.slice(1)
}

function statusColor(status: string) {
  if (status === 'published' || status === 'active') return EMERALD
  if (status === 'archived') return '#667085'
  return '#B54708'
}

function formatDate(date?: string) {
  if (!date) return 'Not set'
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isReviewDue(date?: string) {
  return Boolean(date && new Date(`${date}T23:59:59`) < new Date())
}

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null)
  const [editing, setEditing] = useState<Policy | null>(null)
  const [form, setForm] = useState(initialForm)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Policy | null>(null)
  const [shareDialog, setShareDialog] = useState<Policy | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [loadingChannels, setLoadingChannels] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shareResult, setShareResult] = useState<'success' | 'error' | null>(null)
  const [error, setError] = useState('')
  const [hallmarkInstalled, setHallmarkInstalled] = useState(() => localStorage.getItem('meticle-hallmark-global') === 'true')
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

  const openCreate = () => {
    setEditing(null)
    setForm(initialForm)
    setDialogOpen(true)
  }

  const openEdit = (policy: Policy) => {
    setEditing(policy)
    setForm({
      title: policy.title,
      category: policy.category,
      content: policy.content,
      version: policy.version,
      status: policy.status === 'active' ? 'published' : policy.status,
      review_due_at: policy.review_due_at?.slice(0, 10) || '',
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const payload = { ...form, review_due_at: form.review_due_at || null }
      if (editing) {
        const response = await api.patch(`/policies/${editing.id}`, payload)
        setSelectedPolicy(response.data)
      } else {
        await api.post('/policies', payload)
      }
      setDialogOpen(false)
      await fetchPolicies()
    } catch (err: any) {
      setError(err?.response?.data?.message || 'We could not save this policy.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/policies/${deleteTarget.id}`)
      if (selectedPolicy?.id === deleteTarget.id) setSelectedPolicy(null)
      setDeleteTarget(null)
      await fetchPolicies()
    } catch (err: any) {
      setError(err?.response?.data?.message || 'We could not delete this policy.')
    } finally {
      setDeleting(false)
    }
  }

  const downloadPolicy = (policy: Policy) => {
    const content = [
      policy.title,
      `Category: ${policy.category}`,
      `Version: ${policy.version}`,
      `Status: ${statusLabel(policy.status)}`,
      `Review due: ${formatDate(policy.review_due_at)}`,
      '',
      policy.content,
    ].join('\n')
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${policy.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-v${policy.version}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  const openShare = async (policy: Policy) => {
    setShareDialog(policy)
    setShareResult(null)
    setLoadingChannels(true)
    try {
      const response = await api.get('/chat/channels')
      setChannels(response.data)
    } catch {
      setChannels([])
    } finally {
      setLoadingChannels(false)
    }
  }

  const handleShare = async (channelId: string) => {
    if (!shareDialog) return
    setSharing(true)
    try {
      const preview = shareDialog.content.length > 500 ? `${shareDialog.content.slice(0, 500)}...` : shareDialog.content
      await api.post(`/chat/channels/${channelId}/messages`, {
        content: `Policy: ${shareDialog.title} (v${shareDialog.version})\n\n${preview}`,
      })
      setShareResult('success')
    } catch {
      setShareResult('error')
    } finally {
      setSharing(false)
    }
  }

  if (loading) {
    return <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}><CircularProgress sx={{ color: NAVY }} /></Box>
  }

  return (
    <Box sx={{ maxWidth: 1440, mx: 'auto' }}>
      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}

      <Paper variant="outlined" sx={{ mb: 4, p: { xs: 2, md: 2.5 }, borderRadius: 2, borderColor: '#C7D7E8', bgcolor: '#F4F8FC' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} gap={2}>
          <Box>
            <Typography sx={{ color: NAVY, fontWeight: 900, mb: 0.5 }}>Hallmark skills for every team</Typography>
            <Typography variant="body2" sx={{ color: MUTED }}>Install the Hallmark policy skills globally so every service uses the same review, approval, and evidence standards.</Typography>
          </Box>
          <Button variant={hallmarkInstalled ? 'outlined' : 'contained'} onClick={() => { const next = !hallmarkInstalled; setHallmarkInstalled(next); localStorage.setItem('meticle-hallmark-global', String(next)) }} sx={{ color: hallmarkInstalled ? NAVY : '#fff', bgcolor: hallmarkInstalled ? 'transparent' : NAVY, borderColor: NAVY, textTransform: 'none', fontWeight: 800, flexShrink: 0 }}>{hallmarkInstalled ? 'Hallmark skills installed' : 'Install globally'}</Button>
        </Stack>
      </Paper>

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

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, mb: 3, borderColor: HAIRLINE, borderRadius: 2, bgcolor: '#FFFFFF' }}>
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
                  onClick={() => setSelectedPolicy(policy)}
                  sx={{ width: '100%', textAlign: 'left', p: 0, overflow: 'hidden', borderColor: HAIRLINE, borderRadius: 2, bgcolor: '#FFFFFF', cursor: 'pointer', transition: 'transform .15s ease, box-shadow .15s ease, border-color .15s ease', '&:hover': { transform: 'translateY(-2px)', borderColor: NAVY, boxShadow: '0 14px 32px -22px rgba(15,76,129,.5)' } }}
                >
                  <Box sx={{ height: 5, bgcolor: color }} />
                  <Box sx={{ p: 2.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1} sx={{ mb: 2 }}>
                      <Chip label={policy.category} size="small" sx={{ color, bgcolor: `${color}14`, fontWeight: 800, fontSize: '0.68rem', maxWidth: '80%' }} />
                      <Chip label={`v${policy.version}`} size="small" sx={{ color: MUTED, bgcolor: '#F1F5F9', fontWeight: 800, fontSize: '0.68rem' }} />
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
              <Box key={policy.id} component="button" type="button" onClick={() => setSelectedPolicy(policy)} sx={{ width: '100%', border: 0, borderBottom: index < visiblePolicies.length - 1 ? `1px solid ${HAIRLINE}` : 0, bgcolor: '#FFFFFF', p: 2, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, '&:hover': { bgcolor: '#F8FAFC' } }}>
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

      <Drawer anchor="right" open={Boolean(selectedPolicy)} onClose={() => setSelectedPolicy(null)} PaperProps={{ sx: { width: { xs: '100%', sm: 560 }, maxWidth: '100%' } }}>
        {selectedPolicy && (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 3, bgcolor: BONE, borderBottom: `1px solid ${HAIRLINE}` }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
                <Box>
                  <Chip label={selectedPolicy.category} size="small" sx={{ color: categoryColors[selectedPolicy.category] || NAVY, bgcolor: `${categoryColors[selectedPolicy.category] || NAVY}14`, fontWeight: 800, mb: 1.5 }} />
                  <Typography variant="h5" sx={{ color: INK, fontWeight: 900, lineHeight: 1.15 }}>{selectedPolicy.title}</Typography>
                </Box>
                <IconButton aria-label="Close policy" onClick={() => setSelectedPolicy(null)}><CloseIcon /></IconButton>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
                <Chip label={statusLabel(selectedPolicy.status)} size="small" icon={selectedPolicy.status === 'published' || selectedPolicy.status === 'active' ? <PublishedIcon /> : selectedPolicy.status === 'archived' ? <ArchiveIcon /> : <EditIcon />} sx={{ color: statusColor(selectedPolicy.status), bgcolor: `${statusColor(selectedPolicy.status)}14`, fontWeight: 800 }} />
                <Chip label={`Version ${selectedPolicy.version}`} size="small" sx={{ fontWeight: 800 }} />
              </Stack>
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
              <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
                <Box><Typography sx={{ color: MUTED, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase' }}>Last updated</Typography><Typography sx={{ color: INK, fontWeight: 700 }}>{formatDate(selectedPolicy.updated_at || selectedPolicy.created_at)}</Typography></Box>
                <Box><Typography sx={{ color: MUTED, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase' }}>Review due</Typography><Typography sx={{ color: isReviewDue(selectedPolicy.review_due_at) ? '#B42318' : INK, fontWeight: 700 }}>{formatDate(selectedPolicy.review_due_at)}</Typography></Box>
                {selectedPolicy.updated_by_name && <Box><Typography sx={{ color: MUTED, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase' }}>Updated by</Typography><Typography sx={{ color: INK, fontWeight: 700 }}>{selectedPolicy.updated_by_name}</Typography></Box>}
              </Stack>
              <Divider sx={{ mb: 3 }} />
              <Typography sx={{ color: INK, whiteSpace: 'pre-wrap', lineHeight: 1.85, fontSize: '0.98rem' }}>{selectedPolicy.content}</Typography>
            </Box>
            <Box sx={{ p: 2, borderTop: `1px solid ${HAIRLINE}` }}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {canManagePolicies && <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(selectedPolicy)}>Edit</Button>}
                <Button size="small" startIcon={<ShareIcon />} onClick={() => openShare(selectedPolicy)}>Share</Button>
                <Button size="small" startIcon={<PdfIcon />} onClick={() => downloadPolicy(selectedPolicy)}>Download</Button>
                {canManagePolicies && <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => setDeleteTarget(selectedPolicy)}>Delete</Button>}
              </Stack>
            </Box>
          </Box>
        )}
      </Drawer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ color: INK, fontWeight: 900 }}>{editing ? 'Edit policy' : 'Add policy'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Policy title" fullWidth value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl fullWidth><InputLabel>Category</InputLabel><Select value={form.category} label="Category" onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>{CATEGORIES.map((category) => <MenuItem key={category} value={category}>{category}</MenuItem>)}</Select></FormControl>
              <TextField label="Version" fullWidth value={form.version} onChange={(event) => setForm((current) => ({ ...current, version: event.target.value }))} />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl fullWidth><InputLabel>Status</InputLabel><Select value={form.status} label="Status" onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><MenuItem value="draft">Draft</MenuItem><MenuItem value="published">Published</MenuItem><MenuItem value="archived">Archived</MenuItem></Select></FormControl>
              <TextField label="Review due" type="date" fullWidth value={form.review_due_at} onChange={(event) => setForm((current) => ({ ...current, review_due_at: event.target.value }))} InputLabelProps={{ shrink: true }} />
            </Stack>
            <TextField label="Policy content" helperText="Use headings and clear responsibilities so the policy is easy to follow during an inspection." fullWidth multiline minRows={12} value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}><Button onClick={() => setDialogOpen(false)}>Cancel</Button><Button variant="contained" onClick={handleSave} disabled={saving || !form.title.trim() || !form.content.trim()} sx={{ bgcolor: NAVY }}>{saving ? <CircularProgress size={20} /> : 'Save policy'}</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>Delete this policy?</DialogTitle>
        <DialogContent><Typography sx={{ color: MUTED }}>“{deleteTarget?.title}” will be removed from your library. This cannot be undone.</Typography></DialogContent>
        <DialogActions><Button onClick={() => setDeleteTarget(null)}>Keep policy</Button><Button color="error" variant="contained" onClick={handleDelete} disabled={deleting}>{deleting ? <CircularProgress size={20} /> : 'Delete policy'}</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(shareDialog)} onClose={() => setShareDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>Share policy to chat</DialogTitle>
        <DialogContent>
          {shareResult === 'success' && <Alert severity="success" sx={{ mb: 2 }}>Policy shared successfully.</Alert>}
          {shareResult === 'error' && <Alert severity="error" sx={{ mb: 2 }}>The policy could not be shared. Try again.</Alert>}
          {loadingChannels ? <Box sx={{ display: 'grid', placeItems: 'center', py: 5 }}><CircularProgress /></Box> : channels.length === 0 ? <Typography sx={{ color: MUTED, textAlign: 'center', py: 5 }}>No chat channels are available.</Typography> : <Stack>{channels.map((channel) => <Button key={channel.id} variant="text" onClick={() => handleShare(channel.id)} disabled={sharing} sx={{ justifyContent: 'flex-start', py: 1.5, color: INK }}># {channel.name}{channel.type === 'dm' ? ' · Direct message' : ''}</Button>)}</Stack>}
        </DialogContent>
        <DialogActions><Button onClick={() => setShareDialog(null)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  )
}
