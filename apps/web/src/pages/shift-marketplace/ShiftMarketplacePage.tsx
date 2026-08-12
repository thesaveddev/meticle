import { useState, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { Box, Typography, Paper, Button, Stack, Chip, Alert, Card, CardContent, Grid, Tabs, Tab, CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, FormControl, InputLabel, Select, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Autocomplete, Divider } from '@mui/material'
import { HowToReg as ClaimIcon, Schedule as ScheduleIcon, LocationOn as LocationIcon, CheckCircle, Cancel, History, Send as SendIcon, AccessTime as AccessTimeIcon, DateRange as DateRangeIcon, Person as PersonIcon, SwapHoriz as SwapHorizIcon } from '@mui/icons-material'
import api from '../../services/api'

const shiftTypeLabel = (t?: string) =>
  ({ day: 'Day', sleep: 'Sleep-in', wake_night: 'Wake Night' } as Record<string, string>)[t || 'day'] || t || 'Day'

const claimLabel = (status: string) =>
  ({ assigned: 'Approved', pending: 'Pending', rejected: 'Rejected' } as Record<string, string>)[status] || status

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const fmtLongDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const shiftHours = (s: any) => Math.round((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 3600000)

const claimStatusChip = (status: string) => {
  const m: Record<string, { label: string; color: any }> = {
    assigned: { label: 'Approved', color: 'success' },
    pending: { label: 'Pending', color: 'warning' },
    rejected: { label: 'Rejected', color: 'error' },
  }
  const c = m[status] || { label: status, color: 'default' }
  return <Chip label={c.label} size="small" color={c.color} />
}

const DetailRow = ({ icon, label, value }: { icon?: ReactNode; label: string; value: string }) => (
  <Stack direction="row" alignItems="center" spacing={1}>
    {icon && <Box sx={{ color: '#0F4C81', display: 'flex', width: 20 }}>{icon}</Box>}
    <Typography variant="body2" color="#6B7280" sx={{ width: 108 }}>{label}</Typography>
    <Typography variant="body2" sx={{ fontWeight: 700 }}>{value}</Typography>
  </Stack>
)

export default function ShiftMarketplacePage() {
  const currentUser = (() => { const s = localStorage.getItem('user'); try { const p = s ? JSON.parse(s) : {}; return p && typeof p === 'object' ? p : {} } catch { return {} } })()
  const isAdminOrManager = currentUser.role === 'ORG_ADMIN' || currentUser.role === 'MANAGER'

  const [tab, setTab] = useState(0)
  const [shifts, setShifts] = useState<any[]>([])
  const [myClaims, setMyClaims] = useState<any[]>([])
  const [allClaims, setAllClaims] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [agencies, setAgencies] = useState<any[]>([])
  const [selectedLocation, setSelectedLocation] = useState('all')
  const [openDateFrom, setOpenDateFrom] = useState('')
  const [openDateTo, setOpenDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [claimsDateFrom, setClaimsDateFrom] = useState('')
  const [claimsDateTo, setClaimsDateTo] = useState('')
  const [shiftsLoading, setShiftsLoading] = useState(true)
  const [claimsLoading, setClaimsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [detail, setDetail] = useState<any | null>(null)
  const [agencyDialog, setAgencyDialog] = useState({ open: false, shiftId: '', start_time: '', end_time: '', shift_type: 'day', location_name: '', date_label: '' })
  const [agencyData, setAgencyData] = useState({ agency_id: '', agency_cost: '', agency_contact_name: '', agency_contact_phone: '', agency_shift_reference: '', agency_notes: '' })
  const [agencyRate, setAgencyRate] = useState('')
  const [sendingToAgency, setSendingToAgency] = useState(false)
  const [staffList, setStaffList] = useState<any[]>([])
  const [actionLoading, setActionLoading] = useState(false)
  const [reassignDialog, setReassignDialog] = useState({ open: false, shiftId: '', staffId: '', staffName: '', start_time: '', end_time: '', location_name: '', date_label: '' })
  const [reassignStaff, setReassignStaff] = useState('')
  const [reassigning, setReassigning] = useState(false)

  const fetchOpenShifts = async () => {
    setShiftsLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedLocation && selectedLocation !== 'all') params.set('location_id', selectedLocation)
      if (openDateFrom) params.set('date_from', openDateFrom)
      if (openDateTo) params.set('date_to', openDateTo)
      const res = await api.get(`/shifts/open?${params}`)
      setShifts(res.data)
    } catch {}
    finally { setShiftsLoading(false) }
  }

  const fetchMyClaims = async () => {
    try {
      const res = await api.get('/shifts/my-claims')
      setMyClaims(res.data)
    } catch {}
  }

  const fetchAllClaims = async () => {
    try {
      const res = await api.get('/shifts/all-claims')
      setAllClaims(res.data)
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

  useEffect(() => { fetchOpenShifts() }, [selectedLocation, openDateFrom, openDateTo])
  useEffect(() => { fetchLocations(); if (isAdminOrManager) fetchAgencies() }, [])
  useEffect(() => {
    if (tab !== 1) return
    setClaimsLoading(true)
    const calls: Promise<void>[] = [fetchMyClaims()]
    if (isAdminOrManager) calls.push(fetchAllClaims())
    Promise.all(calls).finally(() => setClaimsLoading(false))
  }, [tab])
  useEffect(() => { const t = setInterval(fetchOpenShifts, 60000); return () => clearInterval(t) }, [selectedLocation, openDateFrom, openDateTo])

  const handleClaim = async (shiftId: string) => {
    setError(''); setSuccess(''); setClaimingId(shiftId)
    try {
      await api.post(`/shifts/${shiftId}/claim`)
      setSuccess('Shift claimed!')
      setShifts(prev => prev.filter(s => s.id !== shiftId))
      fetchMyClaims()
      if (isAdminOrManager) fetchAllClaims()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to claim shift')
    } finally { setClaimingId(null) }
  }

  const handleApprove = async (shiftId: string, staffId: string) => {
    setError(''); setSuccess(''); setApprovingId(`${shiftId}-${staffId}`)
    try {
      await api.patch(`/shifts/${shiftId}/approve-claim/${staffId}`)
      setSuccess('Claim approved')
      fetchAllClaims(); fetchOpenShifts()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to approve')
    } finally { setApprovingId(null) }
  }

  const handleReject = async (shiftId: string, staffId: string) => {
    setError(''); setSuccess(''); setApprovingId(`${shiftId}-${staffId}`)
    try {
      await api.patch(`/shifts/${shiftId}/reject-claim/${staffId}`)
      setSuccess('Claim rejected')
      fetchAllClaims(); fetchOpenShifts()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reject')
    } finally { setApprovingId(null) }
  }

  const fetchStaff = async () => {
    if (staffList.length > 0) return
    try {
      const res = await api.get('/shifts/staff')
      setStaffList(res.data)
    } catch {}
  }

  const handleApproveClaim = async () => {
    if (!detail?.staff_id) return
    setError(''); setSuccess(''); setActionLoading(true)
    try {
      await api.patch(`/shifts/${detail.shift_id}/approve-claim/${detail.staff_id}`)
      setSuccess('Claim approved')
      setDetail(null)
      fetchAllClaims(); fetchMyClaims(); fetchOpenShifts()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to approve')
    } finally { setActionLoading(false) }
  }

  const handleRejectClaim = async () => {
    if (!detail?.staff_id) return
    setError(''); setSuccess(''); setActionLoading(true)
    try {
      await api.patch(`/shifts/${detail.shift_id}/reject-claim/${detail.staff_id}`)
      setSuccess('Claim rejected')
      setDetail(null)
      fetchAllClaims(); fetchMyClaims(); fetchOpenShifts()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reject')
    } finally { setActionLoading(false) }
  }

  const handleCancelClaim = async () => {
    if (!detail?.staff_id) return
    setError(''); setSuccess(''); setActionLoading(true)
    try {
      await api.delete(`/shifts/${detail.shift_id}/cancel-claim/${detail.staff_id}`)
      setSuccess('Claim cancelled — shift returned to the pool')
      setDetail(null)
      fetchAllClaims(); fetchMyClaims(); fetchOpenShifts()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to cancel claim')
    } finally { setActionLoading(false) }
  }

  const handleConvertClaim = async () => {
    if (!detail?.staff_id) return
    setError(''); setSuccess(''); setActionLoading(true)
    try {
      await api.post(`/shifts/${detail.shift_id}/convert-claim/${detail.staff_id}`)
      setSuccess('Claim converted to a regular rostered shift')
      setDetail(null)
      fetchAllClaims(); fetchMyClaims(); fetchOpenShifts()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to convert claim')
    } finally { setActionLoading(false) }
  }

  const openReassignDialog = (c: any) => {
    fetchStaff()
    setReassignStaff('')
    setReassignDialog({
      open: true,
      shiftId: c.shift_id,
      staffId: c.staff_id,
      staffName: c.isOwn ? 'You' : `${c.first_name || ''} ${c.last_name || ''}`.trim() || '—',
      start_time: c.start_time,
      end_time: c.end_time,
      location_name: c.location_name || '—',
      date_label: fmtLongDate(c.start_time),
    })
  }

  const handleReassign = async () => {
    if (!reassignStaff) { setError('Select a staff member'); return }
    setError(''); setSuccess(''); setReassigning(true)
    try {
      await api.post(`/shifts/${reassignDialog.shiftId}/swap-claim/${reassignDialog.staffId}`, { newStaffId: reassignStaff })
      setSuccess('Shift reassigned to another staff member')
      setReassignDialog({ open: false, shiftId: '', staffId: '', staffName: '', start_time: '', end_time: '', location_name: '', date_label: '' })
      setDetail(null)
      fetchAllClaims(); fetchMyClaims(); fetchOpenShifts()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reassign shift')
    } finally { setReassigning(false) }
  }

  const openAgencyDialog = (shift: any) => {
    setAgencyData({ agency_id: '', agency_cost: '', agency_contact_name: '', agency_contact_phone: '', agency_shift_reference: '', agency_notes: '' })
    setAgencyRate('')
    setAgencyDialog({
      open: true,
      shiftId: shift.id,
      start_time: shift.start_time,
      end_time: shift.end_time,
      shift_type: shift.shift_type || 'day',
      location_name: shift.location_name || '—',
      date_label: fmtLongDate(shift.start_time),
    })
  }

  const handleAgencySelect = async (agencyId: string) => {
    setAgencyData(d => ({ ...d, agency_id: agencyId, agency_cost: '' }))
    setAgencyRate('')
    if (!agencyId || !agencyDialog.start_time) return
    try {
      const rateRes = await api.get(`/agencies/${agencyId}/rates`)
      const rates = rateRes.data
      const rate = rates.find((r: any) => r.shift_type === agencyDialog.shift_type)
      if (rate) {
        setAgencyRate(parseFloat(rate.rate_per_hour).toFixed(2))
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
      setSuccess('Shift sent to agency')
      setAgencyDialog({ open: false, shiftId: '', start_time: '', end_time: '', shift_type: 'day', location_name: '', date_label: '' })
      fetchOpenShifts()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send to agency')
    } finally { setSendingToAgency(false) }
  }

  const groupedByDate = useMemo(() => {
    const grouped: Record<string, any[]> = {}
    for (const s of shifts) {
      const date = fmtLongDate(s.start_time)
      if (!grouped[date]) grouped[date] = []
      grouped[date].push(s)
    }
    return grouped
  }, [shifts])

  const claimsWithMeta = useMemo(() => {
    if (!isAdminOrManager) return myClaims.map((c: any) => ({ ...c, isOwn: true }))
    const ownIds = new Set(myClaims.map((c: any) => c.assignment_id))
    const others = allClaims.filter((c: any) => !ownIds.has(c.assignment_id)).map((c: any) => ({ ...c, isOwn: false }))
    const mine = myClaims.map((c: any) => ({ ...c, isOwn: true }))
    return [...others, ...mine]
  }, [allClaims, myClaims, isAdminOrManager])

  const claimCounts = useMemo(() => ({
    all: claimsWithMeta.length,
    pending: claimsWithMeta.filter((c: any) => c.assignment_status === 'pending').length,
    approved: claimsWithMeta.filter((c: any) => c.assignment_status === 'assigned').length,
    rejected: claimsWithMeta.filter((c: any) => c.assignment_status === 'rejected').length,
  }), [claimsWithMeta])

  const reviewCount = useMemo(
    () => claimsWithMeta.filter((c: any) => !c.isOwn && c.assignment_status === 'pending').length,
    [claimsWithMeta]
  )

  const statusToAssignment: Record<string, string> = { pending: 'pending', approved: 'assigned', rejected: 'rejected' }

  const filteredClaims = useMemo(() => {
    let list = claimsWithMeta
    if (statusFilter !== 'all') list = list.filter((c: any) => c.assignment_status === statusToAssignment[statusFilter])
    if (claimsDateFrom) list = list.filter((c: any) => new Date(c.start_time) >= new Date(`${claimsDateFrom}T00:00:00`))
    if (claimsDateTo) list = list.filter((c: any) => new Date(c.start_time) <= new Date(`${claimsDateTo}T23:59:59`))
    return [...list].sort((a: any, b: any) => {
      const aReview = isAdminOrManager && !a.isOwn && a.assignment_status === 'pending' ? 0 : 1
      const bReview = isAdminOrManager && !b.isOwn && b.assignment_status === 'pending' ? 0 : 1
      if (aReview !== bReview) return aReview - bReview
      return new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
    })
  }, [claimsWithMeta, statusFilter, claimsDateFrom, claimsDateTo, isAdminOrManager])

  const statusFilterOptions: { key: typeof statusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ]

  const openStatusChip = (s: any) => {
    if (s.status === 'pending') {
      return <Chip label="Pending approval" size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 700 }} />
    }
    if (new Date(s.start_time) < new Date()) {
      return <Chip label="Unclaimed" size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#FEE2E2', color: '#991B1B', fontWeight: 700 }} />
    }
    return <Chip label="Open" size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#D1FAE5', color: '#065F46', fontWeight: 700 }} />
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1} sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <ScheduleIcon sx={{ color: '#0F4C81', fontSize: 28 }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>Shift Marketplace</Typography>
            <Typography variant="caption" color="#6B7280">Find, claim and manage unclaimed overtime</Typography>
          </Box>
        </Stack>
        <Box sx={{ flexGrow: 1 }} />
        {tab === 0 && <Chip label={`${shifts.length} available`} color="primary" variant="outlined" sx={{ fontWeight: 700 }} />}
        {tab === 1 && isAdminOrManager && reviewCount > 0 && <Chip label={`${reviewCount} to review`} color="warning" sx={{ fontWeight: 700 }} />}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Paper variant="outlined" sx={{ mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems="center" justifyContent="space-between" sx={{ px: 1, py: 0.5 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab label="Available Shifts" icon={<ScheduleIcon />} iconPosition="start" />
            <Tab label="Claims" icon={<History />} iconPosition="start" />
          </Tabs>
          <FormControl size="small" sx={{ m: 1, minWidth: 180 }}>
            <InputLabel>Location</InputLabel>
            <Select value={selectedLocation} label="Location" onChange={e => setSelectedLocation(e.target.value)}>
              <MenuItem value="all">All Locations</MenuItem>
              {locations.map((l: any) => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {tab === 0 && (
        <Paper variant="outlined" sx={{ mb: 3, px: 2, py: 1.5 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} flexWrap="wrap" useFlexGap>
            <Stack direction="row" spacing={1} alignItems="center">
              <DateRangeIcon sx={{ color: '#0F4C81', fontSize: 18 }} />
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#1B2430' }}>Unclaimed overtime</Typography>
            </Stack>
            <TextField label="From" type="date" size="small" value={openDateFrom}
              onChange={e => setOpenDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
            <TextField label="To" type="date" size="small" value={openDateTo}
              onChange={e => setOpenDateTo(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
            {(openDateFrom || openDateTo) && (
              <Button size="small" onClick={() => { setOpenDateFrom(''); setOpenDateTo('') }}>Reset</Button>
            )}
            <Box sx={{ flexGrow: 1 }} />
            <Typography variant="caption" color="#6B7280">Default: today – next 14 days</Typography>
          </Stack>
        </Paper>
      )}

      {tab === 1 && (
        <Paper variant="outlined" sx={{ mb: 3, px: 2, py: 1.5 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} justifyContent="space-between">
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {statusFilterOptions.map(opt => (
                <Chip key={opt.key} label={`${opt.label} (${claimCounts[opt.key]})`}
                  color={statusFilter === opt.key ? 'primary' : 'default'}
                  variant={statusFilter === opt.key ? 'filled' : 'outlined'}
                  onClick={() => setStatusFilter(opt.key)}
                  sx={{ fontWeight: 700 }} />
              ))}
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField label="From" type="date" size="small" value={claimsDateFrom}
                onChange={e => setClaimsDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 150 }} />
              <TextField label="To" type="date" size="small" value={claimsDateTo}
                onChange={e => setClaimsDateTo(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 150 }} />
              {(claimsDateFrom || claimsDateTo) && (
                <Button size="small" onClick={() => { setClaimsDateFrom(''); setClaimsDateTo('') }}>Reset</Button>
              )}
            </Stack>
          </Stack>
        </Paper>
      )}

      {/* ── Tab 0: Available Shifts ── */}
      {tab === 0 && (
        <>
          {shiftsLoading && shifts.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress size={28} /></Box>
          ) : shifts.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
              <Typography variant="h6" color="#9CA3AF" sx={{ mb: 1 }}>No open shifts available</Typography>
              <Typography variant="body2" color="#9CA3AF">Check back later for overtime opportunities.</Typography>
            </Paper>
          ) : (
            Object.entries(groupedByDate).map(([date, dayShifts]) => (
              <Box key={date} sx={{ mb: 4 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0F4C81' }}>{date}</Typography>
                  <Typography variant="caption" color="#6B7280">{dayShifts.length} shift{dayShifts.length === 1 ? '' : 's'}</Typography>
                  <Divider sx={{ flexGrow: 1, borderColor: '#E7E1D6' }} />
                </Stack>
                <Grid container spacing={2}>
                  {dayShifts.map((s: any) => (
                    <Grid item xs={12} sm={6} md={4} key={s.id}>
                      <Card variant="outlined" onClick={() => setDetail(s)} sx={{
                        borderRadius: 2, borderColor: '#E5E7EB', bgcolor: '#FFFFFF', cursor: 'pointer',
                        transition: 'box-shadow 0.2s, border-color 0.2s',
                        '&:hover': { boxShadow: '0 6px 18px rgba(15,76,129,0.12)', borderColor: '#0F4C81' },
                      }}>
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 1 }}>
                            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <LocationIcon sx={{ fontSize: 16, color: '#0F4C81' }} />
                                <Typography variant="subtitle2" sx={{ fontWeight: 800 }} noWrap>{s.location_name || '—'}</Typography>
                              </Stack>
                              {s.department_name && <Typography variant="caption" color="#6B7280">{s.department_name}</Typography>}
                              {s.su_first_name && (
                                <Typography variant="caption" color="#6B7280">For: {s.su_first_name} {s.su_last_name}</Typography>
                              )}
                            </Stack>
                            <Chip label={shiftTypeLabel(s.shift_type)} size="small" variant="outlined" sx={{ fontSize: '0.65rem', fontWeight: 700, height: 20, color: '#0F4C81', borderColor: '#BFDBFE' }} />
                          </Stack>
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
                            <AccessTimeIcon sx={{ fontSize: 15, color: '#6B7280' }} />
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {fmtTime(s.start_time)} – {fmtTime(s.end_time)}
                            </Typography>
                            <Typography variant="caption" color="#6B7280">({shiftHours(s)}h)</Typography>
                          </Stack>
                          <Stack direction="row" spacing={0.5} sx={{ mb: 1.5 }}>
                            <Chip label={`${shiftHours(s)}h`} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
                            <Chip label={`${s.staff_count || 0} assigned`} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
                            {openStatusChip(s)}
                          </Stack>
                          <Stack spacing={1}>
                            <Button fullWidth variant="contained" color="primary"
                              startIcon={claimingId === s.id ? <CircularProgress size={16} color="inherit" /> : <ClaimIcon />}
                              onClick={(e) => { e.stopPropagation(); handleClaim(s.id) }}
                              disabled={claimingId === s.id || new Date(s.start_time) < new Date()}
                              sx={{ fontWeight: 700, textTransform: 'none' }}>
                              {claimingId === s.id ? 'Claiming...' : new Date(s.start_time) < new Date() ? 'Shift started' : 'Claim as Overtime'}
                            </Button>
                            {isAdminOrManager && (
                              <Button fullWidth variant="outlined" size="small"
                                startIcon={<SendIcon />}
                                onClick={(e) => { e.stopPropagation(); openAgencyDialog(s) }}
                                disabled={new Date(s.start_time) < new Date()}
                                sx={{ textTransform: 'none', fontSize: '0.75rem', color: '#0F4C81', borderColor: '#93C5FD', '&:hover': { borderColor: '#0F4C81', bgcolor: '#EFF6FF' } }}>
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

      {/* ── Tab 1: Claims (own history + all staff, in one place) ── */}
      {tab === 1 && (
        <>
          {claimsLoading && claimsWithMeta.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress size={28} /></Box>
          ) : claimsWithMeta.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
              <Typography variant="h6" color="#9CA3AF" sx={{ mb: 1 }}>No claims yet</Typography>
              <Typography variant="body2" color="#9CA3AF">Claim an open shift and track its status here.</Typography>
            </Paper>
          ) : filteredClaims.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
              <Typography variant="h6" color="#9CA3AF" sx={{ mb: 1 }}>No claims match the current filters</Typography>
              <Button size="small" onClick={() => { setStatusFilter('all'); setClaimsDateFrom(''); setClaimsDateTo('') }}>Reset filters</Button>
            </Paper>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                    {isAdminOrManager && <TableCell sx={{ fontWeight: 700 }}>Staff</TableCell>}
                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Time</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
                    {!isAdminOrManager && <TableCell sx={{ fontWeight: 700 }}>Department</TableCell>}
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    {isAdminOrManager && <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredClaims.map((c: any) => {
                    const isOtherPending = isAdminOrManager && !c.isOwn && c.assignment_status === 'pending'
                    const actionKey = `${c.shift_id}-${c.staff_id}`
                    const isProcessing = isOtherPending && approvingId === actionKey
                    return (
                      <TableRow key={c.assignment_id} hover onClick={() => setDetail(c)} sx={{ cursor: 'pointer' }}>
                        {isAdminOrManager && (
                          <TableCell sx={{ fontWeight: isOtherPending ? 700 : 500 }}>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              {c.isOwn && <PersonIcon sx={{ fontSize: 14, color: '#0F4C81' }} />}
                              <Typography variant="body2" sx={{ fontWeight: 'inherit' }}>
                                {c.isOwn ? 'You' : `${c.first_name || ''} ${c.last_name || ''}`.trim() || '—'}
                              </Typography>
                            </Stack>
                          </TableCell>
                        )}
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{fmtDate(c.start_time)}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{fmtTime(c.start_time)} – {fmtTime(c.end_time)}</TableCell>
                        <TableCell>{c.location_name}</TableCell>
                        {!isAdminOrManager && <TableCell>{c.department_name || '—'}</TableCell>}
                        <TableCell>{claimStatusChip(c.assignment_status)}</TableCell>
                        {isAdminOrManager && (
                          <TableCell onClick={e => e.stopPropagation()}>
                            {isOtherPending ? (
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
                            ) : null}
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {/* ── Shift detail dialog (read-only) ── */}
      <Dialog open={!!detail} onClose={() => setDetail(null)} maxWidth="sm" fullWidth>
        {detail && (
          <>
            <DialogTitle>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={1} alignItems="center">
                  <ScheduleIcon sx={{ color: '#0F4C81' }} />
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                      {shiftTypeLabel(detail.shift_type)} shift
                    </Typography>
                    <Typography variant="caption" color="#6B7280">{fmtLongDate(detail.start_time)}</Typography>
                  </Box>
                </Stack>
                {detail.assignment_status && claimStatusChip(detail.assignment_status)}
              </Stack>
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={1.5}>
                <DetailRow icon={<LocationIcon />} label="Location" value={detail.location_name || '—'} />
                <DetailRow icon={<AccessTimeIcon />} label="Time" value={`${fmtTime(detail.start_time)} – ${fmtTime(detail.end_time)}`} />
                <DetailRow icon={<ScheduleIcon />} label="Duration" value={`${shiftHours(detail)} hours`} />
                {detail.department_name && <DetailRow label="Department" value={detail.department_name} />}
                {(detail.su_first_name || detail.su_last_name) && (
                  <DetailRow icon={<PersonIcon />} label="Service user" value={`${detail.su_first_name} ${detail.su_last_name}`} />
                )}
                {detail.isOwn !== undefined && (
                  <DetailRow icon={<PersonIcon />} label="Claimed by" value={detail.isOwn ? 'You' : `${detail.first_name || ''} ${detail.last_name || ''}`.trim() || '—'} />
                )}
                {detail.claimed_at && <DetailRow label="Claimed on" value={fmtDateTime(detail.claimed_at)} />}
                {detail.assignment_status && <DetailRow label="Status" value={claimLabel(detail.assignment_status)} />}
                {Array.isArray(detail.assignments) && detail.assignments.length > 0 && (
                  <>
                    <Divider />
                    <Box>
                      <Typography variant="overline" sx={{ fontWeight: 700, color: '#6B7280' }}>Assigned staff</Typography>
                      <Stack spacing={0.5}>
                        {detail.assignments.map((a: any) => (
                          <Stack key={a.id} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.first_name} {a.last_name}</Typography>
                            <Chip label={claimLabel(a.status)} size="small" color={a.status === 'assigned' ? 'success' : a.status === 'pending' ? 'warning' : 'default'} />
                          </Stack>
                        ))}
                      </Stack>
                    </Box>
                  </>
                )}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2, flexWrap: 'wrap', gap: 1 }}>
              {isAdminOrManager && detail.assignment_status && detail.assignment_status !== 'rejected' && detail.staff_id && (
                <>
                  {detail.assignment_status === 'pending' && !detail.isOwn && (
                    <Button variant="contained" color="success"
                      startIcon={actionLoading ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />}
                      onClick={handleApproveClaim}
                      disabled={actionLoading}
                      sx={{ textTransform: 'none', fontWeight: 700 }}>
                      Approve
                    </Button>
                  )}
                  {detail.assignment_status === 'pending' && !detail.isOwn && (
                    <Button variant="outlined" color="error"
                      startIcon={actionLoading ? <CircularProgress size={16} /> : <Cancel />}
                      onClick={handleRejectClaim}
                      disabled={actionLoading}
                      sx={{ textTransform: 'none' }}>
                      Reject
                    </Button>
                  )}
                  <Button variant="outlined"
                    startIcon={actionLoading ? <CircularProgress size={16} /> : <Cancel />}
                    onClick={handleCancelClaim}
                    disabled={actionLoading}
                    sx={{ textTransform: 'none' }}>
                    Cancel claim
                  </Button>
                  <Button variant="outlined"
                    startIcon={actionLoading ? <CircularProgress size={16} /> : <SwapHorizIcon />}
                    onClick={() => openReassignDialog(detail)}
                    disabled={actionLoading}
                    sx={{ textTransform: 'none' }}>
                    Reassign staff
                  </Button>
                  <Button variant="outlined"
                    startIcon={actionLoading ? <CircularProgress size={16} /> : <ScheduleIcon />}
                    onClick={handleConvertClaim}
                    disabled={actionLoading}
                    sx={{ textTransform: 'none' }}>
                    Convert to regular
                  </Button>
                </>
              )}
              <Box sx={{ flexGrow: 1 }} />
              <Button onClick={() => setDetail(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* ── Send to Agency dialog ── */}
      <Dialog open={agencyDialog.open} onClose={() => setAgencyDialog({ open: false, shiftId: '', start_time: '', end_time: '', shift_type: 'day', location_name: '', date_label: '' })} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <SendIcon sx={{ color: '#0F4C81' }} />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Send to Agency</Typography>
              <Typography variant="caption" color="#6B7280">{agencyDialog.date_label} · {agencyDialog.location_name}</Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#F8FAFC' }}>
              <Stack direction="row" justifyContent="space-between" flexWrap="wrap" useFlexGap>
                <Typography variant="body2" color="#6B7280">Shift</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {fmtTime(agencyDialog.start_time)} – {fmtTime(agencyDialog.end_time)} · {shiftTypeLabel(agencyDialog.shift_type)} · {shiftHours(agencyDialog)}h
                </Typography>
              </Stack>
            </Paper>
            <Autocomplete
              options={agencies}
              getOptionLabel={(o: any) => o.name}
              value={agencies.find(a => a.id === agencyData.agency_id) || null}
              onChange={(_, v) => handleAgencySelect(v?.id || '')}
              renderInput={(params) => <TextField {...params} label="Agency *" required />}
            />
            {agencyRate && (
              <Typography variant="caption" color="#6B7280" sx={{ mt: -1 }}>
                {agencies.find(a => a.id === agencyData.agency_id)?.name} charges £{agencyRate}/hr for {shiftTypeLabel(agencyDialog.shift_type)} shifts
              </Typography>
            )}
            <TextField label="Cost (£)" type="number" value={agencyData.agency_cost}
              onChange={e => setAgencyData({ ...agencyData, agency_cost: e.target.value })}
              helperText={agencyRate ? `Auto-calculated from agency rate (${shiftHours(agencyDialog)}h × £${agencyRate})` : 'Leave blank to auto-calculate from agency rate'}
              fullWidth />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Contact Name" value={agencyData.agency_contact_name}
                onChange={e => setAgencyData({ ...agencyData, agency_contact_name: e.target.value })} fullWidth />
              <TextField label="Contact Phone" value={agencyData.agency_contact_phone}
                onChange={e => setAgencyData({ ...agencyData, agency_contact_phone: e.target.value })} fullWidth />
            </Stack>
            <TextField label="Agency Shift Reference" value={agencyData.agency_shift_reference}
              onChange={e => setAgencyData({ ...agencyData, agency_shift_reference: e.target.value })}
              helperText="The agency's booking reference, if known" fullWidth />
            <TextField label="Notes" value={agencyData.agency_notes}
              onChange={e => setAgencyData({ ...agencyData, agency_notes: e.target.value })}
              helperText="Anything the agency needs to know — PPE, parking, handover instructions" multiline minRows={2} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setAgencyDialog({ open: false, shiftId: '', start_time: '', end_time: '', shift_type: 'day', location_name: '', date_label: '' })}>Cancel</Button>
          <Button variant="contained" onClick={handleSendToAgency} disabled={sendingToAgency}
            sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A63' } }}>
            {sendingToAgency ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Send to Agency'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Reassign claim dialog ── */}
      <Dialog open={reassignDialog.open} onClose={() => setReassignDialog({ open: false, shiftId: '', staffId: '', staffName: '', start_time: '', end_time: '', location_name: '', date_label: '' })} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <SwapHorizIcon sx={{ color: '#0F4C81' }} />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Reassign Shift</Typography>
              <Typography variant="caption" color="#6B7280">{reassignDialog.date_label} · {reassignDialog.location_name}</Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#F8FAFC' }}>
              <Stack direction="row" justifyContent="space-between" flexWrap="wrap" useFlexGap>
                <Typography variant="body2" color="#6B7280">Currently claimed by</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{reassignDialog.staffName}</Typography>
              </Stack>
            </Paper>
            <Autocomplete
              options={staffList}
              getOptionLabel={(o: any) => `${o.first_name} ${o.last_name}`.trim()}
              value={staffList.find((s: any) => s.staff_id === reassignStaff) || null}
              onChange={(_, v) => setReassignStaff(v?.staff_id || '')}
              renderInput={(params) => <TextField {...params} label="Assign to staff *" required />}
            />
            {staffList.length === 0 && <Typography variant="caption" color="#6B7280">Loading staff…</Typography>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setReassignDialog({ open: false, shiftId: '', staffId: '', staffName: '', start_time: '', end_time: '', location_name: '', date_label: '' })}>Cancel</Button>
          <Button variant="contained" onClick={handleReassign} disabled={reassigning || !reassignStaff}
            sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A63' } }}>
            {reassigning ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Reassign'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
