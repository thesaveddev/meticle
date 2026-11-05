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
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  DeleteOutline as DeleteIcon,
  EditOutlined as EditIcon,
  GroupAdd as AskReadIcon,
  InfoOutlined as InfoIcon,
  PictureAsPdf as PdfIcon,
  Share as ShareIcon,
} from '@mui/icons-material'
import api from '../../services/api'
import PageContainer from '../../components/design/PageContainer'
import PolicyFormDialog from './PolicyFormDialog'
import PolicyShareDialog from './PolicyShareDialog'
import PolicyAskReadDialog from './PolicyAskReadDialog'
import PolicyReviewDateDialog from './PolicyReviewDateDialog'
import { useSnackbar } from '../../context/SnackbarContext'
import {
  BONE, HAIRLINE, INK, MUTED, NAVY, categoryColors, formatDate, isReviewDue, isReviewSoon, renderPolicyRichText, statusColor, statusLabel,
  type Policy, type PolicyVersion,
} from './policyShared'

interface Acknowledgement {
  user_id: string
  name: string
  email: string
  acknowledged_at: string
}

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
  const [askOpen, setAskOpen] = useState(false)
  const [reviewDateOpen, setReviewDateOpen] = useState(false)
  const [acks, setAcks] = useState<Acknowledgement[]>([])
  const [acksLoading, setAcksLoading] = useState(false)
  const [marking, setMarking] = useState(false)
  const [markResult, setMarkResult] = useState<'success' | 'error' | null>(null)
  const [reminding, setReminding] = useState(false)
  const [versions, setVersions] = useState<PolicyVersion[]>([])
  const { showSnackbar } = useSnackbar()

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

  const fetchAcks = useCallback(async () => {
    if (!id) return
    setAcksLoading(true)
    try {
      const response = await api.get(`/policies/${id}/acknowledgements`)
      setAcks(response.data)
    } catch {
      setAcks([])
    } finally {
      setAcksLoading(false)
    }
  }, [id])

  useEffect(() => { fetchAcks() }, [fetchAcks])

  const haveRead = useMemo(() => {
    const userId = currentUser?.id
    return Boolean(userId) && acks.some((ack) => ack.user_id === userId)
  }, [acks, currentUser])

  const handleMarkAsRead = async () => {
    if (!id) return
    setMarking(true)
    setMarkResult(null)
    try {
      await api.post(`/policies/${id}/acknowledge`)
      setMarkResult('success')
      await fetchAcks()
    } catch {
      setMarkResult('error')
    } finally {
      setMarking(false)
    }
  }

  const fetchVersions = useCallback(async () => {
    if (!id) return
    try {
      const response = await api.get(`/policies/${id}/versions`)
      setVersions(response.data)
    } catch {
      setVersions([])
    }
  }, [id])

  useEffect(() => { fetchVersions() }, [fetchVersions])

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
      showSnackbar(`${policy.title} has been removed.`, 'success', 'Policy deleted')
      navigate('/policies')
    } catch (err: any) {
      setError(err?.response?.data?.message || 'We could not delete this policy.')
      setDeleteOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  const handleArchive = async () => {
    if (!policy) return
    setDeleting(true)
    try {
      await api.patch(`/policies/${policy.id}`, { status: 'archived' })
      showSnackbar(`${policy.title} is in Archived, with its history kept.`, 'success', 'Policy archived')
      navigate('/policies')
    } catch (err: any) {
      setError(err?.response?.data?.message || 'We could not archive this policy.')
      setDeleteOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  const handleRemind = async () => {
    if (!policy) return
    setReminding(true)
    try {
      const response = await api.post(`/policies/${policy.id}/remind`)
      const count = response.data.reminded as number
      if (count === 0) {
        setMarkResult(null)
        showSnackbar('Everyone has signed — nothing to remind.', 'success', 'Reminders sent')
      } else {
        showSnackbar(
          `We've nudged the ${count} ${count === 1 ? 'person' : 'people'} who haven't signed it yet.`,
          'success',
          'Reminders sent',
        )
      }
    } catch {
      setError('We could not send those reminders.')
    } finally {
      setReminding(false)
    }
  }

  if (loading) {
    return <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}><CircularProgress sx={{ color: NAVY }} /></Box>
  }

  const color = policy ? (categoryColors[policy.category] || NAVY) : NAVY
  const due = policy ? isReviewDue(policy.review_due_at) : false
  const soon = policy ? isReviewSoon(policy.review_due_at) : false
  const noDate = policy ? !policy.review_due_at : false

  return (
    <PageContainer>
      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}

      {!policy ? (
        <Paper variant="outlined" sx={{ p: { xs: 4, md: 6 }, borderRadius: 2, borderColor: HAIRLINE, textAlign: 'center' }}>
          <Typography sx={{ color: INK, fontWeight: 600, mb: 1 }}>This policy is unavailable</Typography>
          <Typography sx={{ color: MUTED, mb: 2 }}>It may have been deleted, or the link may be wrong.</Typography>
          <Button variant="outlined" startIcon={<BackIcon />} onClick={() => navigate('/policies')} sx={{ borderColor: NAVY, color: NAVY, textTransform: 'none', fontWeight: 600 }}>Back to policy library</Button>
        </Paper>
      ) : (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={2} sx={{ mb: 3 }}>
            <Button startIcon={<BackIcon />} onClick={() => navigate('/policies')} sx={{ color: MUTED, textTransform: 'none', fontWeight: 600 }}>
              Policy library
            </Button>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button variant="contained" startIcon={<ShareIcon />} onClick={() => setShareOpen(true)} sx={{ bgcolor: NAVY, '&:hover': { bgcolor: '#014FB5' }, textTransform: 'none', fontWeight: 600 }}>
                Share
              </Button>
              <Button variant="outlined" startIcon={<PdfIcon />} onClick={downloadPolicy} sx={{ borderColor: HAIRLINE, color: INK, textTransform: 'none', fontWeight: 600 }}>
                Download
              </Button>
              {canManagePolicies && (
                <>
                  <Button variant="outlined" startIcon={<AskReadIcon />} onClick={() => setAskOpen(true)} sx={{ borderColor: HAIRLINE, color: INK, textTransform: 'none', fontWeight: 600 }}>
                    Ask staff to read
                  </Button>
                  <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setEditOpen(true)} sx={{ borderColor: HAIRLINE, color: INK, textTransform: 'none', fontWeight: 600 }}>
                    Edit
                  </Button>
                  <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => setDeleteOpen(true)} sx={{ textTransform: 'none', fontWeight: 600 }}>
                    Delete
                  </Button>
                </>
              )}
            </Stack>
          </Stack>

          {(due || soon || noDate) && (
            <Alert
              severity={due ? 'error' : 'warning'}
              sx={{ mb: 3, borderRadius: 2 }}
              action={canManagePolicies ? <Button size="small" onClick={() => setEditOpen(true)} sx={{ textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}>Review now</Button> : undefined}
            >
              {due && <>This policy&apos;s review is overdue (was due {formatDate(policy!.review_due_at)}). Check it still reflects practice, then set the next review date.</>}
              {!due && soon && <>This policy is due for review on {formatDate(policy!.review_due_at)} — read it through before the date passes.</>}
              {noDate && <>No review date is set. Inspections look for a review date on every policy — set one so we can remind you before it&apos;s due.</>}
            </Alert>
          )}

          <Paper variant="outlined" sx={{ borderRadius: 2, borderColor: HAIRLINE, bgcolor: 'background.paper' }}>
            <Box sx={{ p: { xs: 2.5, md: 4 }, bgcolor: BONE, borderBottom: `1px solid ${HAIRLINE}` }}>
              <Chip label={policy.category} size="small" sx={{ color, bgcolor: `${color}14`, fontWeight: 600, fontSize: '0.68rem', mb: 1.5 }} />
              <Typography variant="h4" sx={{ color: INK, fontWeight: 600, lineHeight: 1.15, letterSpacing: '-0.03em' }}>{policy.title}</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
                <Chip label={statusLabel(policy.status)} size="small" sx={{ color: statusColor(policy.status), bgcolor: `${statusColor(policy.status)}14`, fontWeight: 600 }} />
                <Chip label={`Version ${policy.version}`} size="small" sx={{ fontWeight: 600 }} />
                {due && <Chip label="Review overdue" size="small" sx={{ color: '#B42318', bgcolor: '#B4231814', fontWeight: 600 }} />}
              </Stack>
            </Box>

            <Box sx={{ p: { xs: 2.5, md: 4 } }}>
              <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: 2, p: 2, mb: 3, display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' } }}>
                <Box>
                  <Typography sx={{ color: MUTED, fontSize: '0.72rem', fontWeight: 600 }}>Last updated</Typography>
                  <Typography sx={{ color: INK, fontWeight: 600 }}>{formatDate(policy.updated_at || policy.created_at)}</Typography>
                </Box>
                <Box>
                  <Typography sx={{ color: MUTED, fontSize: '0.72rem', fontWeight: 600 }}>Review due</Typography>
                  <Typography sx={{ color: due ? '#B42318' : INK, fontWeight: 600 }}>{formatDate(policy.review_due_at)}</Typography>
                  {canManagePolicies && (
                    <Button size="small" onClick={() => setReviewDateOpen(true)} sx={{ color: NAVY, textTransform: 'none', fontWeight: 700, p: 0, minWidth: 0, fontSize: '0.78rem' }}>
                      Set date
                    </Button>
                  )}
                </Box>
                <Box>
                  <Typography sx={{ color: MUTED, fontSize: '0.72rem', fontWeight: 600 }}>Updated by</Typography>
                  <Typography sx={{ color: INK, fontWeight: 600 }}>{policy.updated_by_name || '—'}</Typography>
                </Box>
                <Box>
                  <Typography sx={{ color: MUTED, fontSize: '0.72rem', fontWeight: 600 }}>Read by staff</Typography>
                  <Typography sx={{ color: INK, fontWeight: 600 }}>{acksLoading ? '…' : `${acks.length} ${acks.length === 1 ? 'person' : 'people'}`}</Typography>
                </Box>
              </Box>
              <Divider sx={{ mb: 3 }} />
              <Box sx={{ color: INK, lineHeight: 1.85, fontSize: '0.98rem' }}>{renderPolicyRichText(policy.content)}</Box>
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ borderRadius: 2, borderColor: HAIRLINE, mt: 3, p: { xs: 2.5, md: 3 } }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1.5} sx={{ mb: 2 }}>
              <Box>
                <Typography sx={{ color: INK, fontWeight: 700, fontSize: '1.02rem' }}>Staff sign-off</Typography>
                <Typography sx={{ color: MUTED, fontSize: '0.82rem' }}>Who has read this version, so an inspection can see it.</Typography>
              </Box>
              <Stack direction="row" spacing={1} flexShrink={0}>
                {canManagePolicies && acks.length > 0 && (
                  <Button variant="outlined" onClick={handleRemind} disabled={reminding} sx={{ borderColor: HAIRLINE, color: INK, textTransform: 'none', fontWeight: 600 }}>
                    {reminding ? <CircularProgress size={20} /> : 'Send reminders'}
                  </Button>
                )}
                <Button variant="contained" onClick={handleMarkAsRead} disabled={marking} sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 600 }}>
                  {marking ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : haveRead ? 'Mark as read again' : 'Mark as read'}
                </Button>
              </Stack>
            </Stack>
            {markResult === 'success' && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMarkResult(null)}>Recorded — thank you for reading this policy.</Alert>}
            {markResult === 'error' && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setMarkResult(null)}>We could not record that. Try again.</Alert>}
            {acksLoading ? (
              <Box sx={{ display: 'grid', placeItems: 'center', py: 3 }}><CircularProgress size={24} sx={{ color: NAVY }} /></Box>
            ) : acks.length === 0 ? (
              <Typography sx={{ color: MUTED, fontSize: '0.85rem' }}>No one has marked this policy as read yet.</Typography>
            ) : (
              <Stack spacing={0} divider={<Divider />}>
                {acks.map((ack) => (
                  <Stack key={`${ack.user_id}-${ack.acknowledged_at}`} direction="row" justifyContent="space-between" alignItems="center" gap={1} sx={{ py: 1 }}>
                    <Typography sx={{ color: INK, fontWeight: 600, fontSize: '0.88rem' }}>{ack.name || ack.email}</Typography>
                    <Typography sx={{ color: MUTED, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{formatDate(ack.acknowledged_at)}</Typography>
                  </Stack>
                ))}
              </Stack>
            )}
          </Paper>
        </>
      )}

      {/* Share */}
      <PolicyShareDialog
        open={shareOpen}
        policy={policy}
        onClose={() => setShareOpen(false)}
      />

      {/* Ask staff to read */}
      <PolicyAskReadDialog
        open={askOpen}
        policy={policy}
        signedUserIds={acks.map((ack) => ack.user_id)}
        onClose={() => setAskOpen(false)}
      />

      {/* Set review date */}
      <PolicyReviewDateDialog
        open={reviewDateOpen}
        policy={policy}
        onClose={() => setReviewDateOpen(false)}
        onSaved={() => { setReviewDateOpen(false); fetchPolicy() }}
      />

      {/* Version history */}
      {versions.length > 0 && (
        <Paper variant="outlined" sx={{ borderRadius: 2, borderColor: HAIRLINE, mt: 3, p: { xs: 2.5, md: 3 } }}>
          <Typography sx={{ color: INK, fontWeight: 700, fontSize: '1.02rem' }}>Version history</Typography>
          <Typography sx={{ color: MUTED, fontSize: '0.82rem', mb: 1 }}>Every saved version and what changed.</Typography>
          <Stack spacing={0} divider={<Divider />}>
            {versions.map((version) => (
              <Box key={version.id} sx={{ py: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                  <Typography sx={{ color: INK, fontWeight: 700, fontSize: '0.88rem' }}>Version {version.version}</Typography>
                  <Typography sx={{ color: MUTED, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    {[formatDate(version.created_at), version.created_by_name].filter(Boolean).join(' · ')}
                  </Typography>
                </Stack>
                {version.what_changed && (
                  <Typography sx={{ color: MUTED, fontSize: '0.85rem', mt: 0.5 }}>{version.what_changed}</Typography>
                )}
              </Box>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Delete */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '28px', maxWidth: 640 } }}>
        <DialogContent sx={{ p: { xs: 3, md: 4 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
            <Box>
              <Typography sx={{ color: NAVY, fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.13em', textTransform: 'uppercase', mb: 1 }}>
                Policies
              </Typography>
              <Typography variant="h5" sx={{ color: INK, fontWeight: 600, letterSpacing: '-0.02em' }}>
                Delete {policy?.title}?
              </Typography>
              <Typography sx={{ color: MUTED, mt: 0.75 }}>
                The policy, its versions and {acks.length === 0 ? 'all its' : `all ${acks.length}`} staff sign-off{acks.length === 1 ? '' : 's'} will be removed. This can&apos;t be undone.
              </Typography>
            </Box>
            <Button onClick={() => setDeleteOpen(false)} sx={{ color: INK, textTransform: 'none', fontWeight: 600, flexShrink: 0 }}>
              Close
            </Button>
          </Stack>
          <Box sx={{ bgcolor: 'notice.info.bg', borderRadius: 2, p: 2, mt: 2.5, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <InfoIcon sx={{ color: NAVY, mt: 0.25 }} />
            <Box>
              <Typography sx={{ color: INK, fontWeight: 700, fontSize: '0.9rem' }}>Inspectors may ask for old policies</Typography>
              <Typography sx={{ color: MUTED, fontSize: '0.85rem' }}>Archive it instead. Staff won&apos;t see it, but you keep the history and sign-offs.</Typography>
            </Box>
          </Box>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: { xs: 3, md: 4 }, py: 2.5 }}>
          <Button variant="outlined" onClick={() => setDeleteOpen(false)} sx={{ borderColor: HAIRLINE, color: INK, textTransform: 'none', fontWeight: 600 }}>
            Keep it
          </Button>
          <Button variant="text" onClick={handleArchive} disabled={deleting} sx={{ color: INK, textTransform: 'none', fontWeight: 600 }}>
            Archive instead
          </Button>
          <Button variant="contained" onClick={handleDelete} disabled={deleting} sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 600 }}>
            {deleting ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Delete policy'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit */}
      <PolicyFormDialog
        open={editOpen}
        editing={policy}
        onClose={() => setEditOpen(false)}
        onSaved={() => { setEditOpen(false); fetchPolicy(); fetchVersions() }}
      />
    </PageContainer>
  )
}
