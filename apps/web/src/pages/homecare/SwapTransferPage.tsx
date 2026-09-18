import { useState, useEffect } from 'react'
import {
  Box, Typography, Paper, Chip, Button, Stack, Dialog, DialogTitle, DialogContent,
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
import PageContainer from '../../components/design/PageContainer'
import api from '../../services/api'

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

  const load = async () => {
    try {
      setLoading(true)
      const [reqsRes, visitsRes, teamRes] = await Promise.all([
        api.get('/homecare/swap-requests'),
        api.get('/homecare/my-visits'),
        api.get('/staff'),
      ])
      setRequests(Array.isArray(reqsRes.data) ? reqsRes.data : [])
      setMyVisits(Array.isArray(visitsRes.data) ? visitsRes.data : [])
      setTeam(Array.isArray(teamRes.data) ? teamRes.data : [])
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to load')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

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
          <Typography variant="h4" fontWeight={700} mb={0.5}>Swap & Transfer</Typography>
          <Typography variant="body2" color="text.secondary">{pending.length} pending request{pending.length !== 1 ? 's' : ''}</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)} sx={{ bgcolor: '#2D3A8C' }}>
          New request
        </Button>
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
            <Paper key={req.id} variant="outlined" sx={{ p: 2.5, borderRadius: 2, '&:hover': { bgcolor: 'action.hover' } }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  {req.request_type === 'swap' ? (
                    <Avatar sx={{ width: 32, height: 32, bgcolor: '#E3F2FD', color: '#1565C0' }}>
                      <SwapIcon sx={{ fontSize: 18 }} />
                    </Avatar>
                  ) : (
                    <Avatar sx={{ width: 32, height: 32, bgcolor: '#E8F5E9', color: '#2E7D32' }}>
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
                  <Button variant="contained" size="small" color="success" startIcon={<AcceptIcon />} onClick={() => handleRespond(req.id, 'accepted')}>Accept</Button>
                  <Button variant="outlined" size="small" color="error" startIcon={<DeclineIcon />} onClick={() => handleRespond(req.id, 'rejected')}>Decline</Button>
                </Stack>
              )}
            </Paper>
          ))}
        </Stack>
      )}

      {/* New request dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>New request</DialogTitle>
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
              <Select value={selectedVisit?.id || ''} label="Select a call" onChange={e => setSelectedVisit(myVisits.find((v: any) => v.id === e.target.value) || null)}>
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
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={submitting || !selectedVisit || (requestType === 'transfer' && !targetStaff)} sx={{ bgcolor: '#2D3A8C' }}>
            {submitting ? 'Submitting...' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  )
}
