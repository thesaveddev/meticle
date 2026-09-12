import { useState, useEffect } from 'react'
import {
  Box, Typography, Paper, Button, Chip, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, CircularProgress, Stack, MenuItem, Select, FormControl, InputLabel, Autocomplete,
} from '@mui/material'
import { Add as AddIcon, SwapHoriz as SwapIcon } from '@mui/icons-material'
import api from '../../services/api'

export default function SwapTransferPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [myVisits, setMyVisits] = useState<any[]>([])
  const [team, setTeam] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | 'sent' | 'received'>('all')

  // Form state
  const [selectedVisit, setSelectedVisit] = useState<any>(null)
  const [targetStaff, setTargetStaff] = useState<any>(null)
  const [requestType, setRequestType] = useState<'swap' | 'transfer'>('swap')
  const [reqMessage, setReqMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    try {
      const [reqRes, visitsRes, teamRes] = await Promise.all([
        api.get('/homecare/swap-requests').then(r => r.data),
        api.get('/homecare/my-visits', { params: { from: new Date().toISOString(), to: new Date(Date.now() + 7 * 86400000).toISOString() } }).then(r => r.data),
        api.get('/homecare/staff').then(r => r.data).catch(() => []),
      ])
      setRequests(reqRes)
      setMyVisits(visitsRes.filter((v: any) => v.status === 'scheduled'))
      setTeam(teamRes)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleSubmit = async () => {
    if (!selectedVisit) return
    setSubmitting(true); setError('')
    try {
      await api.post('/homecare/swap-requests', {
        visit_id: selectedVisit.id,
        target_staff_id: targetStaff?.id || undefined,
        request_type: requestType,
        message: reqMessage.trim() || undefined,
      })
      setDialogOpen(false)
      setSelectedVisit(null); setTargetStaff(null); setReqMessage('')
      setMessage('Request submitted')
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
    if (filter === 'sent') return r.requested_by_name !== 'You'
    if (filter === 'received') return r.target_name !== 'You'
    return true
  })

  const pending = requests.filter(r => r.status === 'pending')

  if (loading) return <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>

  return (
    <Box maxWidth={900} mx="auto" py={4} px={2}>
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
      <Box display="flex" gap={1} mb={3}>
        {(['all', 'sent', 'received'] as const).map(f => (
          <Chip key={f} label={f.charAt(0).toUpperCase() + f.slice(1)} onClick={() => setFilter(f)} variant={filter === f ? 'filled' : 'outlined'} color={filter === f ? 'primary' : 'default'} />
        ))}
      </Box>

      {/* Requests */}
      {filtered.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <SwapIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" mb={1}>No requests</Typography>
          <Typography color="text.secondary">Swap and transfer requests will appear here.</Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {filtered.map((req: any) => (
            <Paper key={req.id} variant="outlined" sx={{ p: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Box display="flex" gap={1}>
                  <Chip label={req.request_type === 'swap' ? '🔄 Swap' : '➡️ Transfer'} size="small" color={req.request_type === 'swap' ? 'primary' : 'info'} />
                  <Chip label={req.status} size="small" color={req.status === 'pending' ? 'warning' : req.status === 'accepted' ? 'success' : 'error'} />
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </Typography>
              </Box>
              <Typography fontWeight={600}>{req.visit_label}</Typography>
              <Typography variant="body2" color="text.secondary">
                {req.client_name} · {new Date(req.scheduled_start).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} {time(req.scheduled_start)}–{time(req.scheduled_end)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                By {req.requested_by_name}{req.target_name ? ` → ${req.target_name}` : ''}
              </Typography>
              {req.message && <Typography variant="body2" fontStyle="italic" mt={0.5}>{req.message}</Typography>}

              {req.status === 'pending' && req.target_name === 'You' && (
                <Box display="flex" gap={1} mt={1.5}>
                  <Button variant="contained" size="small" color="success" onClick={() => handleRespond(req.id, 'accepted')}>Accept</Button>
                  <Button variant="outlined" size="small" color="error" onClick={() => handleRespond(req.id, 'rejected')}>Decline</Button>
                </Box>
              )}
            </Paper>
          ))}
        </Stack>
      )}

      {/* New request dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New request</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <FormControl fullWidth>
              <InputLabel>Request type</InputLabel>
              <Select value={requestType} label="Request type" onChange={e => setRequestType(e.target.value as any)}>
                <MenuItem value="swap">🔄 Swap</MenuItem>
                <MenuItem value="transfer">➡️ Transfer</MenuItem>
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
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={submitting || !selectedVisit || (requestType === 'transfer' && !targetStaff)} sx={{ bgcolor: '#2D3A8C' }}>
            {submitting ? 'Submitting...' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function time(v: string) {
  return new Date(v).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
