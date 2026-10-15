import { useState, useEffect, useRef } from 'react'
import {
  Box, Typography, Paper, Chip, Stack, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, FormControl, InputLabel, Select, MenuItem, Alert,
  CircularProgress, Autocomplete, Avatar,
} from '@mui/material'
import {
  SwapHoriz as SwapIcon,
  ArrowForward as TransferIcon,
  CheckCircle as AcceptIcon,
  Cancel as DeclineIcon,
  Add as AddIcon,
  Person as PersonIcon,
  AccessTime as TimeIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material'
import { useSearchParams } from 'react-router-dom'
import { MICA_RECORD_PARAMS } from '@meticle/shared'
import PageContainer from '../../components/design/PageContainer'
import { NOTICE_COLORS } from '../../theme/noticeTokens'
import api from '../../services/api'
import AppButton from '../../components/design/AppButton'

interface SwapRequest {
  id: string
  request_type: string
  status: string
  visit_label: string
  client_name: string
  scheduled_start: string
  scheduled_end: string
  requested_by_name: string
  target_name?: string
  message?: string
  is_requested_by_me?: boolean
  is_target_for_me?: boolean
  created_at?: string
}

function time(v: string) {
  return new Date(v).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export default function SwapTransferPage() {
  const [requests, setRequests] = useState<SwapRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [filter, setFilter] = useState<'all' | 'sent' | 'received'>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [requestType, setRequestType] = useState<'swap' | 'transfer'>('swap')
  const [selectedVisit, setSelectedVisit] = useState<any>(null)
  const [targetStaff, setTargetStaff] = useState<any>(null)
  const [reqMessage, setReqMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [myVisits, setMyVisits] = useState<any[]>([])
  const [team, setTeam] = useState<any[]>([])
  // The one request a swap email or a notification can name: `?swap=<id>`, the
  // request it is about. Held in the same read-only dialog a row click opens, so
  // there is one way to look at a request rather than two.
  const [viewing, setViewing] = useState<SwapRequest | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const linkedSwapId = searchParams.get(MICA_RECORD_PARAMS['swap-request'])
  const openedLinkedSwapRef = useRef<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      const [reqsRes, visitsRes, teamRes] = await Promise.all([
        api.get('/homecare/swap-requests'),
        api.get('/homecare/my-visits'),
        api.get('/homecare/colleagues'),
      ])
      setRequests(Array.isArray(reqsRes.data) ? reqsRes.data : [])
      setMyVisits(Array.isArray(visitsRes.data) ? visitsRes.data : [])
      setTeam(Array.isArray(teamRes.data) ? teamRes.data : [])
    } catch (e: any) {
      setError(e.response?.data?.message || e.message || 'Failed to load')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // Opens the request a link names. Followed by id rather than by looking for the
  // row, because the sent/received filter is applied on the client and the request
  // a colleague is being told about can be in the other half of it — the row is
  // not on screen to be clicked. Guarded by the id, so a refetch cannot re-open a
  // dialog the carer has closed.
  //
  // The search is against the requests this caller can see, which is the whole set
  // the page loads (`listSwapRequests` returns every request visible to them, and
  // nothing here paginates). There is deliberately no fetch-one fallback: the API
  // has no single-request read to ask, so a link to a request outside this set is a
  // link to a request this caller was never given, and a call to a route that does
  // not exist would only hide that.
  useEffect(() => {
    if (!linkedSwapId || openedLinkedSwapRef.current === linkedSwapId) return
    if (loading) return
    openedLinkedSwapRef.current = linkedSwapId
    const loaded = requests.find(r => r.id === linkedSwapId)
    if (loaded) setViewing(loaded)
  }, [linkedSwapId, requests, loading])

  // Closing the record also drops its link, so a reload or a later render cannot
  // put the carer back into a dialog they just closed. Only `swap` is dropped: any
  // other parameter belongs to whatever sent them here.
  const closeView = () => {
    setViewing(null)
    if (!linkedSwapId) return
    const next = new URLSearchParams(searchParams)
    next.delete(MICA_RECORD_PARAMS['swap-request'])
    setSearchParams(next, { replace: true })
  }

  // The decisions a pending request waits on, from the detail dialog: the record
  // closes once the answer has been sent and the list has been reloaded.
  const respondAndClose = async (swapId: string, status: 'accepted' | 'rejected') => {
    await handleRespond(swapId, status)
    closeView()
  }

  const handleSubmit = async () => {
    if (!selectedVisit) return
    try {
      setSubmitting(true)
      await api.post('/homecare/swap-requests', {
        visit_id: selectedVisit.id,
        request_type: requestType,
        target_staff_id: targetStaff?.id || null,
        message: reqMessage || null,
      })
      setMessage('Request submitted')
      setDialogOpen(false)
      setSelectedVisit(null)
      setTargetStaff(null)
      setReqMessage('')
      await load()
    } catch (e: any) {
      setError(e.response?.data?.message || 'Could not submit')
    } finally { setSubmitting(false) }
  }

  const handleRespond = async (swapId: string, status: 'accepted' | 'rejected') => {
    try {
      await api.patch(`/homecare/swap-requests/${swapId}/respond`, { status })
      await load()
    } catch (e: any) {
      setError(e.response?.data?.message || 'Could not respond')
    }
  }

  const filtered = requests.filter(r => {
    if (filter === 'sent') return r.is_requested_by_me === true
    if (filter === 'received') return r.is_target_for_me === true
    return true
  })

  const pending = requests.filter(r => r.status === 'pending')

  if (loading) return <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>

  return (
    <PageContainer>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={600} mb={0.5}>Swap & Transfer</Typography>
          <Typography variant="body2" color="text.secondary">{pending.length} pending request{pending.length !== 1 ? 's' : ''}</Typography>
        </Box>
        <AppButton startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          New request
        </AppButton>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage('')}>{message}</Alert>}

      {/* Filter */}
      <Stack direction="row" alignItems="center" gap={1.5} mb={3}>
        <FilterIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
        {(['all', 'sent', 'received'] as const).map(f => (
          <Chip key={f} label={f.charAt(0).toUpperCase() + f.slice(1)} onClick={() => setFilter(f)} variant={filter === f ? 'filled' : 'outlined'} color={filter === f ? 'primary' : 'default'} />
        ))}
      </Stack>

      {/* Requests */}
      {filtered.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }} variant="outlined">
          <SwapIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" mb={1}>No requests</Typography>
          <Typography color="text.secondary">Swap and transfer requests will appear here.</Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {filtered.map((req: any) => (
            <Paper key={req.id} variant="outlined" onClick={() => setViewing(req)} sx={{ p: 2.5, borderRadius: 2, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' } }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  {req.request_type === 'swap' ? (
                    <Avatar sx={{ width: 32, height: 32, bgcolor: '#EAF3FF', color: '#004085' }}>
                      <SwapIcon sx={{ fontSize: 18 }} />
                    </Avatar>
                  ) : (
                    <Avatar sx={{ width: 32, height: 32, bgcolor: '#EAFBF5', color: NOTICE_COLORS.success.fg }}>
                      <TransferIcon sx={{ fontSize: 18 }} />
                    </Avatar>
                  )}
                  <Chip
                    label={req.request_type === 'swap' ? 'Swap' : 'Transfer'}
                    size="small"
                    color={req.request_type === 'swap' ? 'primary' : 'info'}
                    sx={{ fontWeight: 600 }}
                  />
                  <Chip
                    label={req.status}
                    size="small"
                    color={req.status === 'pending' ? 'warning' : req.status === 'accepted' ? 'success' : 'error'}
                    sx={{ fontWeight: 600 }}
                  />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </Typography>
              </Box>

              <Typography fontWeight={600} mb={0.5}>{req.visit_label}</Typography>
              <Stack direction="row" alignItems="center" gap={0.5} mb={0.5}>
                <PersonIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">{req.client_name}</Typography>
                <TimeIcon sx={{ fontSize: 14, color: 'text.secondary', ml: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  {new Date(req.scheduled_start).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} {time(req.scheduled_start)}–{time(req.scheduled_end)}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                By {req.requested_by_name}{req.target_name ? ` → ${req.target_name}` : ''}
              </Typography>
              {req.message && <Typography variant="body2" fontStyle="italic" mt={0.5} color="text.secondary">"{req.message}"</Typography>}

              {req.status === 'pending' && req.is_target_for_me === true && (
                <Stack direction="row" spacing={1} mt={1.5}>
                  <AppButton size="small" startIcon={<AcceptIcon />} onClick={e => { e.stopPropagation(); handleRespond(req.id, 'accepted') }}>Accept</AppButton>
                  <AppButton variant="danger" size="small" startIcon={<DeclineIcon />} onClick={e => { e.stopPropagation(); handleRespond(req.id, 'rejected') }}>Decline</AppButton>
                </Stack>
              )}
            </Paper>
          ))}
        </Stack>
      )}

      {/* The one request a link or a row names — read-only, with the two answers a
          request of your own is waiting on. Nothing here edits the request: it is
          what somebody else asked for, and the only moves are to accept or decline
          it. */}
      <Dialog open={Boolean(viewing)} onClose={closeView} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={600}>
          {viewing?.request_type === 'transfer' ? 'Transfer request' : 'Swap request'}
        </DialogTitle>
        <DialogContent>
          {viewing && (
            <Stack spacing={2} mt={1}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Chip
                  label={viewing.status}
                  size="small"
                  color={viewing.status === 'pending' ? 'warning' : viewing.status === 'accepted' ? 'success' : 'error'}
                  sx={{ fontWeight: 600 }}
                />
                {viewing.created_at && (
                  <Typography variant="caption" color="text.secondary">
                    {new Date(viewing.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
                  </Typography>
                )}
              </Stack>

              <Stack spacing={0.5}>
                <Typography variant="caption" color="text.secondary">Call</Typography>
                <Typography fontWeight={600}>{viewing.visit_label}</Typography>
                <Stack direction="row" alignItems="center" gap={0.5}>
                  <PersonIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">{viewing.client_name}</Typography>
                  <TimeIcon sx={{ fontSize: 14, color: 'text.secondary', ml: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    {new Date(viewing.scheduled_start).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} {time(viewing.scheduled_start)}–{time(viewing.scheduled_end)}
                  </Typography>
                </Stack>
              </Stack>

              <Stack spacing={0.5}>
                <Typography variant="caption" color="text.secondary">Requested by</Typography>
                <Typography variant="body2">
                  {viewing.requested_by_name}{viewing.target_name ? ` → ${viewing.target_name}` : ''}
                </Typography>
              </Stack>

              {viewing.message && (
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">Message</Typography>
                  <Typography variant="body2" fontStyle="italic">{viewing.message}</Typography>
                </Stack>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <AppButton variant="quiet" onClick={closeView}>Close</AppButton>
          {viewing?.status === 'pending' && viewing?.is_target_for_me === true && (
            <>
              <AppButton variant="danger" startIcon={<DeclineIcon />} onClick={() => respondAndClose(viewing.id, 'rejected')}>Decline</AppButton>
              <AppButton startIcon={<AcceptIcon />} onClick={() => respondAndClose(viewing.id, 'accepted')}>Accept</AppButton>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* New request dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={600}>New request</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} mt={1}>
            <FormControl fullWidth>
              <InputLabel>Request type</InputLabel>
              <Select value={requestType} label="Request type" onChange={e => setRequestType(e.target.value as any)}>
                <MenuItem value="swap"><Stack direction="row" alignItems="center" gap={1}><SwapIcon sx={{ fontSize: 18, color: 'primary.main' }} />Swap</Stack></MenuItem>
                <MenuItem value="transfer"><Stack direction="row" alignItems="center" gap={1}><TransferIcon sx={{ fontSize: 18, color: 'info.main' }} />Transfer</Stack></MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Select a call</InputLabel>
              <Select
                value={selectedVisit?.id || ''}
                label="Select a call"
                displayEmpty
                renderValue={(value) => {
                  if (value) {
                    const visit: any = myVisits.find((v: any) => v.id === value)
                    return <Typography variant="body2">{visit ? `${visit.label} — ${visit.person_name} · ${new Date(visit.scheduled_start).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}` : ''}</Typography>
                  }
                  return (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      {myVisits.length === 0 ? `No calls available to ${requestType}` : 'Select a call'}
                    </Typography>
                  )
                }}
                onChange={e => setSelectedVisit(myVisits.find((v: any) => v.id === e.target.value) || null)}
              >
                {myVisits.length === 0 && (
                  <MenuItem disabled value=""><em>No calls available to {requestType}</em></MenuItem>
                )}
                {myVisits.map((v: any) => (
                  <MenuItem key={v.id} value={v.id}>
                    {v.label} — {v.person_name} · {new Date(v.scheduled_start).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Autocomplete
              options={team}
              getOptionLabel={(o: any) => `${o.first_name || ''} ${o.last_name || ''}`}
              value={targetStaff}
              onChange={(_, v) => setTargetStaff(v)}
              renderInput={params => <TextField {...params} label={requestType === 'swap' ? 'Swap with (optional)' : 'Transfer to *'} />}
            />

            <TextField label="Message (optional)" multiline rows={2} value={reqMessage} onChange={e => setReqMessage(e.target.value)} placeholder="Why are you requesting this?" />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <AppButton variant="quiet" onClick={() => setDialogOpen(false)}>Cancel</AppButton>
          <AppButton loading={submitting} onClick={handleSubmit} disabled={!selectedVisit || (requestType === 'transfer' && !targetStaff)}>
            Submit
          </AppButton>
        </DialogActions>
      </Dialog>
    </PageContainer>
  )
}
