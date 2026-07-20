import { useState, useEffect } from 'react'
import { Box, Typography, Paper, Stack, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Select, MenuItem, FormControl, InputLabel, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, IconButton, CircularProgress, Grid, Alert, List, ListItemButton, ListItemAvatar, Avatar, ListItemText } from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, ViewList as ViewListIcon, GridView as GridViewIcon, PictureAsPdf as PdfIcon, Share as ShareIcon } from '@mui/icons-material'
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
  created_at: string
  updated_at?: string
}

interface Channel {
  id: string
  name: string
  type: string
}

const CATEGORIES = ['Risk Management', 'Human Resources', 'Health & Safety', 'GDPR & Data Protection', 'Infection Control', 'Equality & Diversity', 'Mental Health', 'Fire Safety', 'Medication', 'Safeguarding']

const initialForm = { title: '', category: 'Health & Safety', content: '', version: '1.0', status: 'active' }

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewPolicy, setViewPolicy] = useState<Policy | null>(null)
  const [editing, setEditing] = useState<Policy | null>(null)
  const [form, setForm] = useState(initialForm)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [seeding, setSeeding] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [shareDialog, setShareDialog] = useState<Policy | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [loadingChannels, setLoadingChannels] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shareResult, setShareResult] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState('')

  const fetchPolicies = async () => {
    setFetchError('')
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (categoryFilter) params.set('category', categoryFilter)
      const res = await api.get(`/policies?${params}`)
      setPolicies(res.data)
    } catch (e: any) {
      setPolicies([])
      setFetchError(e?.response?.data?.message || 'Failed to load policies')
    }
    setLoading(false)
  }

  useEffect(() => { fetchPolicies() }, [search, categoryFilter])

  const handleSeed = async () => {
    setSeeding(true)
    try {
      await api.post('/policies/seed')
      fetchPolicies()
    } catch (e: any) {
      setFetchError(e?.response?.data?.message || 'Failed to seed policies')
    }
    setSeeding(false)
  }

  const openCreate = () => { setEditing(null); setForm(initialForm); setDialogOpen(true) }
  const openEdit = (p: Policy) => { setEditing(p); setForm({ title: p.title, category: p.category, content: p.content, version: p.version, status: p.status }); setDialogOpen(true) }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editing) { await api.patch(`/policies/${editing.id}`, form) }
      else { await api.post('/policies', form) }
      setDialogOpen(false); fetchPolicies()
    } catch (e: any) {
      setFetchError(e?.response?.data?.message || 'Failed to save policy')
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this policy?')) return
    try {
      await api.delete(`/policies/${id}`)
      fetchPolicies()
    } catch (e: any) {
      setFetchError(e?.response?.data?.message || 'Failed to delete policy')
    }
  }

  const downloadPdf = (p: Policy) => {
    const content = [
      `Policy: ${p.title}`,
      `Version: ${p.version}`,
      `Category: ${p.category}`,
      `Status: ${p.status}`,
      `Last Updated: ${new Date(p.updated_at || p.created_at).toLocaleDateString()}`,
      '',
      p.content,
    ].join('\n')

    const blob = new Blob([content], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `policy-${p.title.replace(/\s+/g, '-').toLowerCase()}-${p.version}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const openShare = async (p: Policy) => {
    setShareDialog(p)
    setShareResult(null)
    setLoadingChannels(true)
    try {
      const res = await api.get('/chat/channels')
      setChannels(res.data)
    } catch { setChannels([]) }
    setLoadingChannels(false)
  }

  const handleShare = async (channelId: string) => {
    if (!shareDialog) return
    setSharing(true)
    setShareResult(null)
    try {
      const msg = `📋 Policy: ${shareDialog.title} (v${shareDialog.version})\n\n${shareDialog.content.substring(0, 500)}${shareDialog.content.length > 500 ? '...' : ''}`
      await api.post(`/chat/channels/${channelId}/messages`, { content: msg })
      setShareResult('success')
    } catch {
      setShareResult('error')
    }
    setSharing(false)
  }

  const categoryColor: Record<string, string> = {
    'Risk Management': '#DC2626', 'Human Resources': '#0F4C81', 'Health & Safety': '#D97706',
    'GDPR & Data Protection': '#7C3AED', 'Infection Control': '#0284C7', 'Equality & Diversity': '#16A34A',
    'Mental Health': '#0891B2', 'Fire Safety': '#EA580C', 'Medication': '#059669', 'Safeguarding': '#BE123C',
  }

  const formatUpdatedBy = (p: Policy) => {
    if (p.updated_by_name) return `by ${p.updated_by_name}`
    return ''
  }

  if (loading) return <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress /></Box>

  return (
    <Box>
      {fetchError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFetchError('')}>{fetchError}</Alert>}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Policies</Typography>
          <Typography color="#6B7280">{policies.length > 0 ? `${policies.length} policies` : 'Manage your organisation policies and procedures.'}</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {policies.length === 0 && (
            <Button variant="outlined" onClick={handleSeed} disabled={seeding} sx={{ color: '#0F4C81', borderColor: '#0F4C81' }}>
              {seeding ? <CircularProgress size={18} /> : 'Load Standard Policies'}
            </Button>
          )}
          <IconButton onClick={() => setViewMode('grid')} color={viewMode === 'grid' ? 'primary' : 'default'}><GridViewIcon /></IconButton>
          <IconButton onClick={() => setViewMode('list')} color={viewMode === 'list' ? 'primary' : 'default'}><ViewListIcon /></IconButton>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ bgcolor: '#0F4C81' }}>Add Policy</Button>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <TextField placeholder="Search policies..." size="small" value={search} onChange={e => setSearch(e.target.value)} sx={{ width: 300 }} />
        <FormControl size="small" sx={{ width: 200 }}>
          <InputLabel>Category</InputLabel>
          <Select value={categoryFilter} label="Category" onChange={e => setCategoryFilter(e.target.value)}>
            <MenuItem value="">All Categories</MenuItem>
            {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>
      </Stack>

      {viewMode === 'grid' ? (
        policies.length === 0 ? (
          <Paper variant="outlined" sx={{ borderRadius: 3, p: 6, textAlign: 'center' }}>
            <Typography color="#9CA3AF" sx={{ mb: 1 }}>No policies yet.</Typography>
            <Button size="small" variant="outlined" onClick={handleSeed} sx={{ color: '#0F4C81', borderColor: '#0F4C81' }}>Load 12 Standard Policies</Button>
          </Paper>
        ) : (
          <Grid container spacing={2}>
            {policies.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((p) => (
              <Grid key={p.id} item xs={12} sm={6} md={6} lg={4}>
                <Paper
                  variant="outlined"
                  sx={{
                    borderRadius: 3,
                    borderLeft: `4px solid ${categoryColor[p.category] || '#6B7280'}`,
                    p: 2.5,
                    cursor: 'pointer',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                  onClick={() => setViewPolicy(p)}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                    <Chip label={p.category} size="small" sx={{ bgcolor: `${categoryColor[p.category] || '#6B7280'}15`, color: categoryColor[p.category] || '#6B7280', fontWeight: 700, fontSize: '0.7rem' }} />
                    <Chip label={`v${p.version}`} size="small" sx={{ fontWeight: 700 }} />
                  </Stack>
                  <Typography sx={{ fontWeight: 700, mb: 1 }}>{p.title}</Typography>
                  <Typography variant="body2" color="#6B7280" sx={{ mb: 1, flexGrow: 1 }}>
                    {p.content.substring(0, 150)}{p.content.length > 150 ? '...' : ''}
                  </Typography>
                  <Stack spacing={0.5} sx={{ mb: 1.5 }}>
                    <Typography variant="caption" color="#9CA3AF">{new Date(p.updated_at || p.created_at).toLocaleDateString()}</Typography>
                    {formatUpdatedBy(p) && <Typography variant="caption" color="#9CA3AF">{formatUpdatedBy(p)}</Typography>}
                  </Stack>
                  <Stack direction="row" spacing={0.5} onClick={e => e.stopPropagation()}>
                    <IconButton size="small" onClick={() => downloadPdf(p)} title="Download PDF"><PdfIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => openShare(p)} title="Share to Chat"><ShareIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => openEdit(p)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => handleDelete(p.id)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                  </Stack>
                </Paper>
              </Grid>
            ))}
          </Grid>
        )
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
          <Table>
            <TableHead><TableRow sx={{ bgcolor: '#F8FAFC' }}>
              <TableCell sx={{ fontWeight: 800 }}>Title</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Category</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Version</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Updated</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Last Updated By</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Actions</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {policies.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <Typography color="#9CA3AF" sx={{ mb: 1 }}>No policies yet.</Typography>
                  <Button size="small" variant="outlined" onClick={handleSeed} sx={{ color: '#0F4C81', borderColor: '#0F4C81' }}>Load 12 Standard Policies</Button>
                </TableCell></TableRow>
              ) : policies.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((p) => (
                <TableRow key={p.id} hover sx={{ cursor: 'pointer' }} onClick={() => setViewPolicy(p)}>
                  <TableCell><Typography sx={{ fontWeight: 700 }}>{p.title}</Typography></TableCell>
                  <TableCell><Chip label={p.category} size="small" sx={{ bgcolor: `${categoryColor[p.category] || '#6B7280'}15`, color: categoryColor[p.category] || '#6B7280', fontWeight: 700, fontSize: '0.7rem' }} /></TableCell>
                  <TableCell>v{p.version}</TableCell>
                  <TableCell>{new Date(p.updated_at || p.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>{formatUpdatedBy(p) || '—'}</TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <IconButton size="small" onClick={() => downloadPdf(p)} title="Download PDF"><PdfIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => openShare(p)} title="Share to Chat"><ShareIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => openEdit(p)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => handleDelete(p.id)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination component="div" count={policies.length} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0) }} rowsPerPageOptions={[5, 10, 25]} />
        </TableContainer>
      )}

      {policies.length > 10 && viewMode === 'grid' && (
        <TablePagination
          component="div"
          count={policies.length}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0) }}
          rowsPerPageOptions={[5, 10, 25]}
          sx={{ mt: 2 }}
        />
      )}

      {/* View Policy Dialog */}
      <Dialog open={!!viewPolicy} onClose={() => setViewPolicy(null)} maxWidth="md" fullWidth>
        {viewPolicy && <><DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Stack><Typography variant="h6">{viewPolicy.title}</Typography><Chip label={viewPolicy.category} size="small" sx={{ bgcolor: `${categoryColor[viewPolicy.category] || '#6B7280'}15`, color: categoryColor[viewPolicy.category] || '#6B7280', fontWeight: 700, mt: 0.5, width: 'fit-content' }} /></Stack>
          <Stack direction="row" spacing={1}><Chip label={`v${viewPolicy.version}`} size="small" sx={{ fontWeight: 700 }} /><Chip label={viewPolicy.status} size="small" color={viewPolicy.status === 'active' ? 'success' : 'default'} /></Stack>
        </DialogTitle><DialogContent dividers>
          <Typography variant="caption" color="#9CA3AF" sx={{ mb: 2, display: 'block' }}>
            Updated {new Date(viewPolicy.updated_at || viewPolicy.created_at).toLocaleDateString()}
            {formatUpdatedBy(viewPolicy) ? ` ${formatUpdatedBy(viewPolicy)}` : ''}
          </Typography>
          <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{viewPolicy.content}</Typography>
        </DialogContent><DialogActions>
          <Button onClick={() => setViewPolicy(null)}>Close</Button>
        </DialogActions></>}
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? 'Edit Policy' : 'New Policy'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Title" fullWidth value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select value={form.category} label="Category" onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Content" fullWidth multiline rows={10} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
            <Stack direction="row" spacing={2}>
              <TextField label="Version" fullWidth value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} />
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select value={form.status} label="Status" onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="archived">Archived</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.title || !form.content}>{saving ? <CircularProgress size={20} /> : 'Save'}</Button>
        </DialogActions>
      </Dialog>

      {/* Share to Chat Dialog */}
      <Dialog open={!!shareDialog} onClose={() => setShareDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Share Policy to Chat</DialogTitle>
        <DialogContent>
          {shareResult === 'success' && <Alert severity="success" sx={{ mb: 2 }}>Policy shared successfully!</Alert>}
          {shareResult === 'error' && <Alert severity="error" sx={{ mb: 2 }}>Failed to share policy. Please try again.</Alert>}
          {loadingChannels ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
          ) : channels.length === 0 ? (
            <Typography color="#9CA3AF" sx={{ py: 4, textAlign: 'center' }}>No chat channels available.</Typography>
          ) : (
            <List>
              {channels.map((ch) => (
                <ListItemButton key={ch.id} onClick={() => handleShare(ch.id)} disabled={sharing}>
                  <ListItemAvatar><Avatar sx={{ width: 32, height: 32, fontSize: '0.85rem', bgcolor: '#0F4C81' }}>#</Avatar></ListItemAvatar>
                  <ListItemText primary={ch.name} secondary={ch.type === 'dm' ? 'Direct Message' : 'Group'} />
                  {sharing && <CircularProgress size={20} />}
                </ListItemButton>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialog(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
