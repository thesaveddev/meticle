import { useState, useEffect, useMemo } from 'react'
import { Box, Typography, Paper, Button, Stack, Chip, Alert, Card, CardContent, Grid, Tabs, Tab, CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, FormControl, InputLabel, Select, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Autocomplete } from '@mui/material'
import { HowToReg as ClaimIcon, Schedule as ScheduleIcon, LocationOn as LocationIcon, CheckCircle, Cancel, History, Warning as WarningIcon, Send as SendIcon } from '@mui/icons-material'
import api from '../../services/api'
import posthog from '../../lib/posthog'

export default function ShiftMarketplacePage() {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
  const isAdminOrManager = currentUser.role === 'ORG_ADMIN' || currentUser.role === 'MANAGER'

  const [tab, setTab] = useState(0)
  const [shifts, setShifts] = useState<any[]>([])
  const [myClaims, setMyClaims] = useState<any[]>([])
  const [pendingClaims, setPendingClaims] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [agencies, setAgencies] = useState<any[]>([])
  const [selectedLocation, setSelectedLocation] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [agencyDialog, setAgencyDialog] = useState({ open: false, shiftId: '', start_time: '', end_time: '', shift_type: 'day' })
  const [agencyData, setAgencyData] = useState({ agency_id: '', agency_cost: '', agency_contact_name: '', agency_contact_phone: '' })
  const [sendingToAgency, setSendingToAgency] = useState(false)

  const fetchOpenShifts = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedLocation) params.set('location_id', selectedLocation)
      const res = await api.get(`/shifts/open?${params}`)
      setShifts(res.data)
    } catch {}
  }

  const fetchMyClaims = async () => {
    try {
      const res = await api.get('/shifts/my-claims')
      setMyClaims(res.data)
    } catch {}
  }

  const fetchPendingClaims = async () => {
    try {
      const res = await api.get('/shifts/pending-claims')
      setPendingClaims(res.data)
    } catch {}
  }

  const fetchLocations = async () => {
    try {
      const res = await api.get('/leave/locations')
      setLocations(res.data)
    } catch {}
  }

  const fetchAgencies = async () => {
    try {
      const res = await api.get('/agencies')
      setAgencies(res.data)
    } catch {}
  }

  const refresh = async () => {
    setLoading(true)
    const calls = [fetchOpenShifts(), fetchLocations()]
    if (isAdminOrManager) calls.push(fetchAgencies())
    await Promise.all(calls)
    if (tab === 1) await fetchMyClaims()
    if (tab === 2 && isAdminOrManager) await fetchPendingClaims()
    setLoading(false)
  }

  useEffect(() => { refresh() }, [selectedLocation, tab])
  useEffect(() => { const t = setInterval(fetchOpenShifts, 60000); return () => clearInterval(t) }, [selectedLocation])

  const handleClaim = async (shiftId: string) => {
    setError(''); setSuccess(''); setClaimingId(shiftId)
    try {
      await api.post(`/shifts/${shiftId}/claim`)
      posthog.capture('shift_claimed')
      setSuccess('Shift claimed!')
      setShifts(prev => prev.filter(s => s.id !== shiftId))
      fetchMyClaims()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to claim shift')
    } finally { setClaimingId(null) }
  }

  const handleApprove = async (shiftId: string, staffId: string) => {
    setError(''); setSuccess(''); setApprovingId(`${shiftId}-${staffId}`)
    try {
      await api.patch(`/shifts/${shiftId}/approve-claim/${staffId}`)
      posthog.capture('shift_claim_approved')
      setSuccess('Claim approved')
      fetchPendingClaims(); fetchOpenShifts()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to approve')
    } finally { setApprovingId(null) }
  }

  const handleReject = async (shiftId: string, staffId: string) => {
    setError(''); setSuccess(''); setApprovingId(`${shiftId}-${staffId}`)
    try {
      await api.patch(`/shifts/${shiftId}/reject-claim/${staffId}`)
      setSuccess('Claim rejected')
      fetchPendingClaims(); fetchOpenShifts()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reject')
    } finally { setApprovingId(null) }
  }

  const openAgencyDialog = (shift: any) => {
    setAgencyData({ agency_id: '', agency_cost: '', agency_contact_name: '', agency_contact_phone: '' })
    setAgencyDialog({ open: true, shiftId: shift.id, start_time: shift.start_time, end_time: shift.end_time, shift_type: shift.shift_type || 'day' })
  }

  const handleAgencySelect = async (agencyId: string) => {
    setAgencyData(d => ({ ...d, agency_id: agencyId, agency_cost: '' }))
    if (!agencyId || !agencyDialog.start_time) return
    try {
      const rateRes = await api.get(`/agencies/${agencyId}/rates`)
      const rates = rateRes.data
      const rate = rates.find((r: any) => r.shift_type === agencyDialog.shift_type)
      if (rate) {
        const hours = (new Date(agencyDialog.end_time).getTime() - new Date(agencyDialog.start_time).getTime()) / 3600000
        setAgencyData(d => ({ ...d, agency_id: agencyId, agency_cost: (parseFloat(rate.rate_per_hour) * hours).toFixed(2) }))
      }
    } catch {}
  }

  const handleSendToAgency = async () => {
    if (!agencyData.agency_id) { setError('Select an agency'); return }
    try {
      setSendingToAgency(true)
      await api.patch(`/shifts/${agencyDialog.shiftId}/send-to-agency`, agencyData)
      posthog.capture('shift_sent_to_agency', {
        has_cost: Boolean(agencyData.agency_cost),
      })
      setSuccess('Shift sent to agency')
      setAgencyDialog({ open: false, shiftId: '', start_time: '', end_time: '', shift_type: 'day' })
      fetchOpenShifts()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send to agency')
    } finally { setSendingToAgency(false) }
  }

  const groupedByDate = useMemo(() => {
    const grouped: Record<string, any[]> = {}
    for (const s of shifts) {
      const date = new Date(s.start_time).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
      if (!grouped[date]) grouped[date] = []
      grouped[date].push(s)
    }
    return grouped
  }, [shifts])

  const claimStatusChip = (status: string) => {
    const m: Record<string, { label: string; color: any }> = {
      assigned: { label: 'Approved', color: 'success' },
      pending: { label: 'Pending', color: 'warning' },
      rejected: { label: 'Rejected', color: 'error' },
    }
    const c = m[status] || { label: status, color: 'default' }
    return <Chip label={c.label} size="small" color={c.color} />
  }

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 3 }}>
        <ScheduleIcon sx={{ color: '#0F4C81', fontSize: 28 }} />
        <Typography variant="h5" sx={{ fontWeight: 800 }}>Shift Marketplace</Typography>
        {tab === 0 && <Chip label={`${shifts.length} available`} size="small" color="warning" sx={{ ml: 1, fontWeight: 700 }} />}
        {tab === 2 && isAdminOrManager && (
          <Chip label={`${pendingClaims.length} pending`} size="small" color="warning" sx={{ ml: 1, fontWeight: 700 }} />
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Paper sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab label="Available Shifts" icon={<ScheduleIcon />} iconPosition="start" />
            <Tab label="My Claims" icon={<History />} iconPosition="start" />
            {isAdminOrManager && <Tab label="Pending Approval" icon={<WarningIcon />} iconPosition="start" />}
          </Tabs>
          <FormControl size="small" sx={{ mr: 2, minWidth: 180 }}>
            <InputLabel>Location</InputLabel>
            <Select value={selectedLocation} label="Location" onChange={e => setSelectedLocation(e.target.value)}>
              <MenuItem value="">All Locations</MenuItem>
              {locations.map((l: any) => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* ── Tab 0: Available Shifts ── */}
      {tab === 0 && (
        <>
          {loading && shifts.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress size={28} /></Box>
          ) : shifts.length === 0 ? (
            <Paper sx={{ p: 6, textAlign: 'center' }}>
              <Typography variant="h6" color="#9CA3AF" sx={{ mb: 1 }}>No open shifts available</Typography>
              <Typography variant="body2" color="#9CA3AF">Check back later for overtime opportunities.</Typography>
            </Paper>
          ) : (
            Object.entries(groupedByDate).map(([date, dayShifts]) => (
              <Box key={date} sx={{ mb: 4 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: '#0F4C81' }}>{date}</Typography>
                <Grid container spacing={2}>
                  {dayShifts.map((s: any) => (
                    <Grid item xs={12} sm={6} md={4} key={s.id}>
                      <Card variant="outlined" sx={{
                        borderRadius: 2, border: '1px solid #FDE68A', bgcolor: '#FFFBEB',
                        transition: 'box-shadow 0.2s', '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
                      }}>
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
                            <LocationIcon sx={{ fontSize: 14, color: '#D97706' }} />
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>{s.location_name || '—'}</Typography>
                          </Stack>
                          {s.department_name && (
                            <Typography variant="caption" color="#6B7280" sx={{ display: 'block', mb: 0.5 }}>
                              {s.department_name}
                            </Typography>
                          )}
                          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                            <Typography variant="caption" color="#6B7280" sx={{ fontWeight: 500 }}>
                              {new Date(s.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                              {' — '}
                              {new Date(s.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            </Typography>
                          </Stack>
                          <Stack direction="row" spacing={0.5} sx={{ mb: 1.5 }}>
                            <Chip label={`${Math.round((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 3600000)}h`} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
                            <Chip label={`${s.staff_count || 0} assigned`} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
                            {new Date(s.end_time) < new Date() ? (
                              <Chip label="Open - Unclaimed" size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#FEE2E2', color: '#991B1B', fontWeight: 700 }} />
                            ) : (
                              <Chip label="Open" size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 700 }} />
                            )}
                          </Stack>
                          <Stack spacing={1}>
                            <Button fullWidth variant="contained" color="warning"
                              startIcon={claimingId === s.id ? <CircularProgress size={16} color="inherit" /> : <ClaimIcon />}
                              onClick={() => handleClaim(s.id)}
                              disabled={claimingId === s.id}
                              sx={{ fontWeight: 700, textTransform: 'none' }}>
                              {claimingId === s.id ? 'Claiming...' : 'Claim as Overtime'}
                            </Button>
                            {isAdminOrManager && (
                              <Button fullWidth variant="outlined" size="small"
                                startIcon={<SendIcon />}
                                onClick={() => openAgencyDialog(s)}
                                sx={{ textTransform: 'none', fontSize: '0.75rem', borderColor: '#D97706', color: '#D97706', '&:hover': { borderColor: '#B45309', bgcolor: '#FFFBEB' } }}>
                                Send to Agency
                              </Button>
                            )}
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            ))
          )}
        </>
      )}

      {/* ── Tab 1: My Claims ── */}
      {tab === 1 && (
        <>
          {loading && myClaims.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress size={28} /></Box>
          ) : myClaims.length === 0 ? (
            <Paper sx={{ p: 6, textAlign: 'center' }}>
              <Typography color="#9CA3AF">You haven't claimed any shifts yet.</Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Time</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Department</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {myClaims.map((c: any) => (
                    <TableRow key={c.assignment_id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {new Date(c.start_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {new Date(c.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        {' — '}
                        {new Date(c.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell>{c.location_name}</TableCell>
                      <TableCell>{c.department_name || '—'}</TableCell>
                      <TableCell>{claimStatusChip(c.assignment_status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {/* ── Tab 2: Pending Approval (manager) ── */}
      {tab === 2 && isAdminOrManager && (
        <>
          {loading && pendingClaims.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress size={28} /></Box>
          ) : pendingClaims.length === 0 ? (
            <Paper sx={{ p: 6, textAlign: 'center' }}>
              <Typography color="#9CA3AF">No pending claims to review.</Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Staff</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Time</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Claimed</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingClaims.map((c: any) => {
                    const actionKey = `${c.shift_id}-${c.staff_id}`
                    const isProcessing = approvingId === actionKey
                    return (
                      <TableRow key={actionKey} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{c.first_name} {c.last_name}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {new Date(c.start_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {new Date(c.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          {' — '}
                          {new Date(c.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                        <TableCell>{c.location_name}</TableCell>
                        <TableCell>
                          {new Date(c.claimed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5}>
                            <Button size="small" variant="contained" color="success"
                              startIcon={isProcessing ? <CircularProgress size={14} color="inherit" /> : <CheckCircle />}
                              onClick={() => handleApprove(c.shift_id, c.staff_id)}
                              disabled={isProcessing}
                              sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
                              Approve
                            </Button>
                            <Button size="small" variant="outlined" color="error"
                              startIcon={isProcessing ? <CircularProgress size={14} /> : <Cancel />}
                              onClick={() => handleReject(c.shift_id, c.staff_id)}
                              disabled={isProcessing}
                              sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
                              Reject
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      <Dialog open={agencyDialog.open} onClose={() => setAgencyDialog({ open: false, shiftId: '', start_time: '', end_time: '', shift_type: 'day' })} maxWidth="sm" fullWidth>
        <DialogTitle>Send to Agency</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Autocomplete
              options={agencies}
              getOptionLabel={(o: any) => o.name}
              value={agencies.find(a => a.id === agencyData.agency_id) || null}
              onChange={(_, v) => handleAgencySelect(v?.id || '')}
              renderInput={(params) => <TextField {...params} label="Agency *" required />}
            />
            <TextField label="Cost (£)" type="number" value={agencyData.agency_cost}
              onChange={e => setAgencyData({ ...agencyData, agency_cost: e.target.value })}
              helperText={agencyData.agency_cost ? `Auto-calculated from agency rate` : ''}
              fullWidth />
            <TextField label="Contact Name" value={agencyData.agency_contact_name}
              onChange={e => setAgencyData({ ...agencyData, agency_contact_name: e.target.value })} fullWidth />
            <TextField label="Contact Phone" value={agencyData.agency_contact_phone}
              onChange={e => setAgencyData({ ...agencyData, agency_contact_phone: e.target.value })} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setAgencyDialog({ open: false, shiftId: '', start_time: '', end_time: '', shift_type: 'day' })}>Cancel</Button>
          <Button variant="contained" onClick={handleSendToAgency} disabled={sendingToAgency}
            sx={{ bgcolor: '#D97706', '&:hover': { bgcolor: '#B45309' } }}>
            {sendingToAgency ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Send'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
