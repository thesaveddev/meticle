import { useState, useEffect, useRef } from 'react'
import {
  Box, Typography, Button, Dialog, DialogContent, DialogActions, TextField,
  FormControl, InputLabel, Select, MenuItem, Alert, CircularProgress, Autocomplete,
} from '@mui/material'
import {
  SwapHoriz as SwapIcon,
  ArrowForward as TransferIcon,
  CheckCircle as AcceptIcon,
  Cancel as DeclineIcon,
  Add as AddIcon,
  Person as PersonIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material'
import { useSearchParams } from 'react-router-dom'
import { MICA_RECORD_PARAMS } from '@meticle/shared'
import FigDialogHeader from '../people/dialogHeader'
import api from '../../services/api'
import './myspace.css'

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

function initials(name?: string) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '—'
  return `${parts[0][0]}${parts.length > 1 ? parts[parts.length - 1][0] : ''}`.toUpperCase()
}

function statusChip(status: string, received: boolean) {
  if (status === 'pending') return { label: received ? 'Waiting for you' : 'Waiting', className: received ? 'ms-chip--accent' : 'ms-chip--warn' }
  if (status === 'accepted') return { label: 'Approved', className: 'ms-chip--ok' }
  return { label: status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Declined', className: 'ms-chip--neutral' }
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
  const [submitError, setSubmitError] = useState('')
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

  const respondAndClose = async (swapId: string, status: 'accepted' | 'rejected') => {
    await handleRespond(swapId, status)
    closeView()
  }

  const handleSubmit = async () => {
    if (!selectedVisit) return
    try {
      setSubmitting(true)
      setSubmitError('')
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
      setSubmitError(e.response?.data?.message || 'Could not submit')
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

  const counts = {
    all: requests.length,
    sent: requests.filter(r => r.is_requested_by_me === true).length,
    received: requests.filter(r => r.is_target_for_me === true).length,
  }
  const waitingForMe = requests.filter(r => r.status === 'pending' && r.is_target_for_me === true).length

  if (loading) return <Box className="myspace" sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>

  return (
    <Box className="myspace">
      <Typography className="ms-crumbs">My space / Swap &amp; Transfer</Typography>

      <header className="ms-header">
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h1" className="ms-header__title">Swap &amp; Transfer</Typography>
          <Typography className="ms-header__copy">Ask to swap a shift or visit, or hand it to a colleague.</Typography>
        </Box>
        <Box className="ms-header__actions">
          <Button
            variant="contained"
            className="ms-button ms-button--primary"
            startIcon={<AddIcon />}
            onClick={() => { setSubmitError(''); setMessage(''); setDialogOpen(true) }}
          >
            New request
          </Button>
        </Box>
      </header>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {message && <Alert severity="success" onClose={() => setMessage('')}>{message}</Alert>}

      <nav className="ms-tabs" aria-label="Request filters">
        {(['all', 'sent', 'received'] as const).map(value => (
          <button
            key={value}
            type="button"
            className={`ms-tab${filter === value ? ' ms-tab--active' : ''}`}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {value === 'all' ? 'All' : value === 'sent' ? 'Sent' : 'Received'}
            <span className="ms-tab__count" aria-hidden="true">{counts[value]}</span>
          </button>
        ))}
      </nav>

      <section className="ms-card">
        <div className="ms-card__head">
          <Typography component="h2" className="ms-card__title">Requests</Typography>
          <Typography className="ms-card__copy">
            {waitingForMe > 0 ? `${waitingForMe} waiting for you` : 'Nothing waiting for you'}
          </Typography>
        </div>

        {filtered.length === 0 ? (
          <div style={{ borderTop: '1px solid var(--ms-rule)' }}>
            <Box className="ms-empty-card" sx={{ border: 0, boxShadow: 'none' }}>
              <span className="ms-empty__icon"><SwapIcon /></span>
              <Typography className="ms-empty__title">No requests</Typography>
              <Typography className="ms-empty__copy">Swap and transfer requests will appear here.</Typography>
            </Box>
          </div>
        ) : (
          <>
            <div className="ms-request ms-request--head" aria-hidden="true">
              <span className="ms-request__col">Request</span>
              <span className="ms-request__col">With</span>
              <span className="ms-request__col">Status</span>
              <span />
            </div>
            {filtered.map(req => {
              const received = req.is_target_for_me === true
              const chip = statusChip(req.status, received)
              const otherParty = received ? req.requested_by_name : (req.target_name || 'Any colleague')
              return (
                <div
                  key={req.id}
                  className="ms-request"
                  role="button"
                  tabIndex={0}
                  onClick={() => setViewing(req)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setViewing(req)
                    }
                  }}
                >
                  <div>
                    <p className="ms-request__title">
                      <span className="ms-visit__time">{req.request_type === 'swap' ? 'Swap' : 'Transfer'} · </span>
                      <span>{req.visit_label}</span>
                    </p>
                    <p className="ms-request__meta">
                      {received ? 'Received' : 'Sent'} {req.created_at ? new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                      {' · '}
                      {new Date(req.scheduled_start).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                      {' '}
                      {time(req.scheduled_start)}–{time(req.scheduled_end)}
                      {req.client_name ? ` · ${req.client_name}` : ''}
                    </p>
                    <p className="ms-request__meta">
                      By {req.requested_by_name}{req.target_name ? ` → ${req.target_name}` : ''}
                    </p>
                  </div>
                  <div className="ms-request__person">
                    <span className="ms-avatar" aria-hidden="true">{initials(otherParty)}</span>
                    <span className="ms-request__name">{otherParty}</span>
                  </div>
                  <div className="ms-request__status">
                    <span className={`ms-chip ${chip.className}`}>{chip.label}</span>
                  </div>
                  <div className="ms-request__actions">
                    <Button
                      variant="outlined"
                      className="ms-row-button ms-button--quiet"
                      onClick={event => { event.stopPropagation(); setViewing(req) }}
                    >
                      Review
                    </Button>
                    {req.status === 'pending' && received && (
                      <Button
                        variant="contained"
                        className="ms-row-button ms-button--primary"
                        onClick={event => { event.stopPropagation(); handleRespond(req.id, 'accepted') }}
                      >
                        Accept
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </section>

      <Typography className="ms-footnote">Requests you sent and requests sent to you, from the live record.</Typography>

      {/* The one request a link or a row names — read-only, with the two answers a
          request of your own is waiting on. Nothing here edits the request. */}
      <Dialog className="ms-dialog" open={Boolean(viewing)} onClose={closeView} maxWidth="sm" fullWidth>
        {viewing && (
          <>
            <FigDialogHeader
              eyebrow="SWAP & TRANSFER"
              title={viewing.request_type === 'transfer' ? 'Transfer request' : 'Swap request'}
              subtitle={`From ${viewing.requested_by_name} · ${viewing.visit_label} · ${new Date(viewing.scheduled_start).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} ${time(viewing.scheduled_start)}–${time(viewing.scheduled_end)}`}
              onClose={closeView}
            />
            <DialogContent>
              <div className="ms-detail">
                <div className="ms-detail__row">
                  <span className={`ms-chip ${statusChip(viewing.status, viewing.is_target_for_me === true).className}`}>
                    {statusChip(viewing.status, viewing.is_target_for_me === true).label}
                  </span>
                  {viewing.created_at && (
                    <Typography component="span" className="ms-request__meta">
                      {new Date(viewing.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
                    </Typography>
                  )}
                </div>
                <div className="ms-detail__row">
                  <PersonIcon className="ms-detail__icon" />
                  <span>{viewing.client_name}</span>
                </div>
                <div className="ms-detail__row">
                  <TimeIcon className="ms-detail__icon" />
                  <span>
                    {new Date(viewing.scheduled_start).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} {time(viewing.scheduled_start)}–{time(viewing.scheduled_end)}
                  </span>
                </div>
                <div>
                  <Typography className="ms-detail__label">Requested by</Typography>
                  <Typography className="ms-detail__value">
                    {viewing.requested_by_name}{viewing.target_name ? ` → ${viewing.target_name}` : ''}
                  </Typography>
                </div>
                <Typography className="ms-dialog__note">Your manager can see this request.</Typography>
                {viewing.message && (
                  <Typography className="ms-dialog__note" sx={{ fontStyle: 'italic' }}>
                    “{viewing.message}”
                  </Typography>
                )}
              </div>
            </DialogContent>
            {viewing.status === 'pending' && viewing.is_target_for_me === true && (
              <DialogActions>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeclineIcon />}
                  onClick={() => respondAndClose(viewing.id, 'rejected')}
                >
                  Decline
                </Button>
                <Button
                  variant="contained"
                  className="ms-button ms-button--primary"
                  startIcon={<AcceptIcon />}
                  onClick={() => respondAndClose(viewing.id, 'accepted')}
                >
                  Accept
                </Button>
              </DialogActions>
            )}
          </>
        )}
      </Dialog>

      <Dialog className="ms-dialog" open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <FigDialogHeader
          eyebrow="SWAP & TRANSFER"
          title="New request"
          subtitle="Ask a colleague to take this call, or hand it over."
          onClose={() => setDialogOpen(false)}
        />
        <DialogContent>
          {submitError && <Alert severity="error">{submitError}</Alert>}
          <div className="ms-field-label">Request type</div>
          <div className="ms-seg" role="group" aria-label="Request type">
            <button
              type="button"
              className={`ms-seg__btn${requestType === 'swap' ? ' ms-seg__btn--on' : ''}`}
              aria-pressed={requestType === 'swap'}
              onClick={() => setRequestType('swap')}
            >
              <SwapIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'text-bottom' }} />Swap
            </button>
            <button
              type="button"
              className={`ms-seg__btn${requestType === 'transfer' ? ' ms-seg__btn--on' : ''}`}
              aria-pressed={requestType === 'transfer'}
              onClick={() => setRequestType('transfer')}
            >
              <TransferIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'text-bottom' }} />Transfer
            </button>
          </div>

          <FormControl fullWidth size="small" sx={{ mt: 2.5 }}>
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

          <Box sx={{ mt: 2 }}>
            <Autocomplete
              options={team}
              getOptionLabel={(o: any) => `${o.first_name || ''} ${o.last_name || ''}`}
              value={targetStaff}
              onChange={(_, v) => setTargetStaff(v)}
              renderInput={params => <TextField {...params} size="small" label={requestType === 'swap' ? 'Swap with (optional)' : 'Transfer to *'} />}
            />
          </Box>

          <TextField
            sx={{ mt: 2 }}
            label="Message (optional)"
            size="small"
            multiline
            rows={2}
            fullWidth
            value={reqMessage}
            onChange={e => setReqMessage(e.target.value)}
            placeholder="Why are you requesting this?"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            className="ms-button ms-button--primary"
            onClick={handleSubmit}
            disabled={submitting || !selectedVisit || (requestType === 'transfer' && !targetStaff)}
          >
            {submitting ? <CircularProgress size={18} color="inherit" /> : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
