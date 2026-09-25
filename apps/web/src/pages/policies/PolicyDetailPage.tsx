import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  DeleteOutline as DeleteIcon,
  EditOutlined as EditIcon,
  EmailOutlined as EmailIcon,
  PictureAsPdf as PdfIcon,
  Share as ShareIcon,
} from '@mui/icons-material'
import api from '../../services/api'
import PageContainer from '../../components/design/PageContainer'
import PolicyFormDialog from './PolicyFormDialog'
import {
  BONE, HAIRLINE, INK, MUTED, NAVY, categoryColors, formatDate, isReviewDue, statusColor, statusLabel,
  type Channel, type Policy,
} from './policyShared'

export default function PolicyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [channels, setChannels] = useState<Channel[]>([])
  const [loadingChannels, setLoadingChannels] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shareResult, setShareResult] = useState<'success' | 'error' | null>(null)

  const currentUser = useMemo(() => {
    try {
      const stored = localStorage.getItem('user')
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  }, [])
  const canManagePolicies = currentUser.role === 'ORG_ADMIN' || currentUser.role === 'MANAGER'

  const fetchPolicy = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const response = await api.get(`/policies/${id}`)
      setPolicy(response.data)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'We could not load this policy.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchPolicy() }, [fetchPolicy])

  const shareUrl = policy ? `${window.location.origin}/policies/${policy.id}` : ''
  const sharePreview = policy ? (policy.content.length > 500 ? `${policy.content.slice(0, 500)}...` : policy.content) : ''
  const shareSubject = policy ? `Policy: ${policy.title} (v${policy.version})` : ''

  const shareByEmail = () => {
    if (!policy) return
    const body = `${sharePreview}\n\nRead the full policy: ${shareUrl}`
    window.location.href = `mailto:?subject=${encodeURIComponent(shareSubject)}&body=${encodeURIComponent(body)}`
  }

  const openShare = async () => {
    setShareOpen(true)
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
    if (!policy) return
    setSharing(true)
    try {
      await api.post(`/chat/channels/${channelId}/messages`, {
        content: `${shareSubject}\n\n${sharePreview}\n\nRead the full policy: ${shareUrl}`,
      })
      setShareResult('success')
    } catch {
      setShareResult('error')
    } finally {
      setSharing(false)
    }
  }

  const downloadPolicy = () => {
    if (!policy) return
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

  const handleDelete = async () => {
    if (!policy) return
    setDeleting(true)
    try {
      await api.delete(`/policies/${policy.id}`)
      navigate('/policies')
    } catch (err: any) {
      setError(err?.response?.data?.message || 'We could not delete this policy.')
      setDeleteOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}><CircularProgress sx={{ color: NAVY }} /></Box>
  }

  const color = policy ? (categoryColors[policy.category] || NAVY) : NAVY
  const due = policy ? isReviewDue(policy.review_due_at) : false

  return (
    <PageContainer>
      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}

      {!policy ? (
        <Paper variant="outlined" sx={{ p: { xs: 4, md: 6 }, borderRadius: 2, borderColor: HAIRLINE, textAlign: 'center' }}>
          <Typography sx={{ color: INK, fontWeight: 800, mb: 1 }}>This policy is unavailable</Typography>
          <Typography sx={{ color: MUTED, mb: 2 }}>It may have been deleted, or the link may be wrong.</Typography>
          <Button variant="outlined" startIcon={<BackIcon />} onClick={() => navigate('/policies')} sx={{ borderColor: NAVY, color: NAVY, textTransform: 'none', fontWeight: 700 }}>Back to policy library</Button>
        </Paper>
      ) : (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={2} sx={{ mb: 3 }}>
            <Button startIcon={<BackIcon />} onClick={() => navigate('/policies')} sx={{ color: MUTED, textTransform: 'none', fontWeight: 700 }}>
              Policy library
            </Button>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button variant="outlined" startIcon={<EmailIcon />} onClick={shareByEmail} sx={{ borderColor: NAVY, color: NAVY, textTransform: 'none', fontWeight: 700 }}>
                Share by email
              </Button>
              <Button variant="contained" startIcon={<ShareIcon />} onClick={openShare} sx={{ bgcolor: NAVY, '&:hover': { bgcolor: '#0B3A63' }, textTransform: 'none', fontWeight: 700 }}>
                Share to org chat
              </Button>
              <Button variant="outlined" startIcon={<PdfIcon />} onClick={downloadPolicy} sx={{ borderColor: HAIRLINE, color: INK, textTransform: 'none', fontWeight: 700 }}>
                Download
              </Button>
              {canManagePolicies && (
                <>
                  <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setEditOpen(true)} sx={{ borderColor: HAIRLINE, color: INK, textTransform: 'none', fontWeight: 700 }}>
                    Edit
                  </Button>
                  <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => setDeleteOpen(true)} sx={{ textTransform: 'none', fontWeight: 700 }}>
                    Delete
                  </Button>
                </>
              )}
            </Stack>
          </Stack>

          <Paper variant="outlined" sx={{ borderRadius: 2, borderColor: HAIRLINE, bgcolor: 'background.paper' }}>
            <Box sx={{ p: { xs: 2.5, md: 4 }, bgcolor: BONE, borderBottom: `1px solid ${HAIRLINE}` }}>
              <Chip label={policy.category} size="small" sx={{ color, bgcolor: `${color}14`, fontWeight: 800, fontSize: '0.68rem', mb: 1.5 }} />
              <Typography variant="h4" sx={{ color: INK, fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.03em' }}>{policy.title}</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
                <Chip label={statusLabel(policy.status)} size="small" sx={{ color: statusColor(policy.status), bgcolor: `${statusColor(policy.status)}14`, fontWeight: 800 }} />
                <Chip label={`Version ${policy.version}`} size="small" sx={{ fontWeight: 800 }} />
                {due && <Chip label="Review overdue" size="small" sx={{ color: '#B42318', bgcolor: '#B4231814', fontWeight: 800 }} />}
              </Stack>
            </Box>

            <Box sx={{ p: { xs: 2.5, md: 4 } }}>
              <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
                <Box>
                  <Typography sx={{ color: MUTED, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase' }}>Last updated</Typography>
                  <Typography sx={{ color: INK, fontWeight: 700 }}>{formatDate(policy.updated_at || policy.created_at)}</Typography>
                </Box>
                <Box>
                  <Typography sx={{ color: MUTED, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase' }}>Review due</Typography>
                  <Typography sx={{ color: due ? '#B42318' : INK, fontWeight: 700 }}>{formatDate(policy.review_due_at)}</Typography>
                </Box>
                {policy.updated_by_name && (
                  <Box>
                    <Typography sx={{ color: MUTED, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase' }}>Updated by</Typography>
                    <Typography sx={{ color: INK, fontWeight: 700 }}>{policy.updated_by_name}</Typography>
                  </Box>
                )}
              </Stack>
              <Divider sx={{ mb: 3 }} />
              <Typography sx={{ color: INK, whiteSpace: 'pre-wrap', lineHeight: 1.85, fontSize: '0.98rem' }}>{policy.content}</Typography>
            </Box>
          </Paper>
        </>
      )}

      {/* Share to org chat */}
      <Dialog open={shareOpen} onClose={() => setShareOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>Share policy to org chat</DialogTitle>
        <DialogContent>
          {shareResult === 'success' && <Alert severity="success" sx={{ mb: 2 }}>Policy shared successfully.</Alert>}
          {shareResult === 'error' && <Alert severity="error" sx={{ mb: 2 }}>The policy could not be shared. Try again.</Alert>}
          {loadingChannels ? <Box sx={{ display: 'grid', placeItems: 'center', py: 5 }}><CircularProgress /></Box> : channels.length === 0 ? <Typography sx={{ color: MUTED, textAlign: 'center', py: 5 }}>No chat channels are available.</Typography> : <Stack>{channels.map((channel) => <Button key={channel.id} variant="text" onClick={() => handleShare(channel.id)} disabled={sharing} sx={{ justifyContent: 'flex-start', py: 1.5, color: INK }}># {channel.name}{channel.type === 'dm' ? ' · Direct message' : ''}</Button>)}</Stack>}
        </DialogContent>
        <DialogActions><Button onClick={() => setShareOpen(false)}>Close</Button></DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>Delete this policy?</DialogTitle>
        <DialogContent><Typography sx={{ color: MUTED }}>“{policy?.title}” will be removed from your library. This cannot be undone.</Typography></DialogContent>
        <DialogActions><Button onClick={() => setDeleteOpen(false)}>Keep policy</Button><Button color="error" variant="contained" onClick={handleDelete} disabled={deleting}>{deleting ? <CircularProgress size={20} /> : 'Delete policy'}</Button></DialogActions>
      </Dialog>

      {/* Edit */}
      <PolicyFormDialog
        open={editOpen}
        editing={policy}
        onClose={() => setEditOpen(false)}
        onSaved={() => { setEditOpen(false); fetchPolicy() }}
      />
    </PageContainer>
  )
}
