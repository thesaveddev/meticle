import { useState, useEffect, useMemo, type ReactNode } from 'react'
import { Box, Typography, Paper, Button, Stack, Chip, Alert, Tabs, Tab, CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, FormControl, InputLabel, Select, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Autocomplete, Divider } from '@mui/material'
import PageContainer from '../../components/design/PageContainer'
import { HowToReg as ClaimIcon, Schedule as ScheduleIcon, LocationOn as LocationIcon, CheckCircle, Cancel, Send as SendIcon, AccessTime as AccessTimeIcon, Person as PersonIcon, SwapHoriz as SwapHorizIcon, Flag as FlagIcon, Group as GroupIcon, Place as PlaceIcon, CalendarMonth as CalendarIcon } from '@mui/icons-material'
import api from '../../services/api'
import AppButton from '../../components/design/AppButton'

const shiftTypeLabel = (t?: string) =>
  ({ day: 'Day', sleep: 'Sleep-in', wake_night: 'Wake Night' } as Record<string, string>)[t || 'day'] || t || 'Day'

const claimLabel = (status: string) =>
  ({ assigned: 'Approved', pending: 'Pending', rejected: 'Rejected' } as Record<string, string>)[status] || status

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const fmtLongDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const shiftHours = (s: any) => Math.round((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 3600000)
/** Shift pattern beside the time, as Figma shows (`07:00 – 15:00 · Early`). */
const shiftPattern = (s: any) => {
  if (s.shift_type === 'sleep') return 'Sleep-in'
  if (s.shift_type === 'wake_night') return 'Waking night'
  const h = new Date(s.start_time).getHours()
  if (h >= 5 && h < 12) return 'Early'
  if (h >= 12 && h < 18) return 'Late'
  if (h >= 18 || h < 5) return 'Waking night'
  return 'Day'
}
const initialsOf = (first?: string, last?: string) =>
  `${(first || '').trim().charAt(0)}${(last || '').trim().charAt(0)}`.toUpperCase() || '—'
const fmtDayMonth = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

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
    {icon && <Box sx={{ color: '#0164C8', display: 'flex', width: 20 }}>{icon}</Box>}
    <Typography variant="body2" color="#51637A" sx={{ width: 108 }}>{label}</Typography>
    <Typography variant="body2" sx={{ fontWeight: 600 }}>{value}</Typography>
  </Stack>
)

export default function ShiftMarketplacePage() {
  const currentUser = (() => { const s = localStorage.getItem('user'); try { const p = s ? JSON.parse(s) : {}; return p && typeof p === 'object' ? p : {} } catch { return {} } })()
  const isAdminOrManager = currentUser.role === 'ORG_ADMIN' || currentUser.role === 'MANAGER'
  const storedOrg = (() => { try { const raw = localStorage.getItem('organization'); return raw ? JSON.parse(raw) : {} } catch { return {} } })()
  const isDomiciliary = storedOrg.primary_service_type
    ? ['domiciliary', 'live_in'].includes(storedOrg.primary_service_type)
    : (Array.isArray(storedOrg.service_types) && storedOrg.service_types.some((type: string) => ['domiciliary', 'live_in'].includes(type)))
  const marketplaceTitle = isDomiciliary ? 'Open Calls' : 'Shift Marketplace'
  const marketplaceDescription = isDomiciliary ? 'Find, claim and manage open calls for extra paid work' : 'Find, claim and manage unclaimed overtime'

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
  const [openCallDialog, setOpenCallDialog] = useState(false)
  const [openCallSaving, setOpenCallSaving] = useState(false)
  const [openCall, setOpenCall] = useState({ location_id: '', person_id: '', start_time: '', end_time: '', shift_type: 'day' })
  const [clients, setClients] = useState<any[]>([])
  const [clientsLoading, setClientsLoading] = useState(false)

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
      const res = await api.get('/leave/locations', { silentError: true })
      setLocations(res.data)
    } catch {}
  }

  // Agencies are supported-living-only. Never request them for a domiciliary
  // organisation — the API rejects the call and the rejection surfaces as a
  // global "This feature is not available for your organisation type" toast.
  // Agencies load lazily when a supported-living manager opens the dialog.
  const fetchAgencies = async () => {
    if (isDomiciliary || agencies.length > 0) return
    try {
      const res = await api.get('/agencies', { silentError: true })
      setAgencies(res.data)
    } catch {}
  }

  const fetchClients = async () => {
    if (clients.length > 0) return
    setClientsLoading(true)
    try {
      const res = await api.get('/people', { silentError: true })
      setClients(Array.isArray(res.data) ? res.data : [])
    } catch {}
    finally { setClientsLoading(false) }
  }

  useEffect(() => { fetchOpenShifts() }, [selectedLocation, openDateFrom, openDateTo])
  useEffect(() => { fetchLocations() }, [])
  useEffect(() => {
    if (tab !== 1) return
    setClaimsLoading(true)
    const calls: Promise<void>[] = [fetchMyClaims()]
    if (isAdminOrManager) calls.push(fetchAllClaims())
    Promise.all(calls).finally(() => setClaimsLoading(false))
  }, [tab])
  useEffect(() => { const t = setInterval(fetchOpenShifts, 60000); return () => clearInterval(t) }, [selectedLocation, openDateFrom, openDateTo])

  const openCreateOpenCall = () => {
    setOpenCall({ location_id: '', person_id: '', start_time: '', end_time: '', shift_type: 'day' })
    setError('')
    setOpenCallDialog(true)
    fetchClients()
  }

  const resetOpenCall = () => {
    setOpenCallDialog(false)
    setOpenCall({ location_id: '', person_id: '', start_time: '', end_time: '', shift_type: 'day' })
  }

  const handlePostOpenCall = async () => {
    if (!openCall.location_id || !openCall.start_time || !openCall.end_time) {
      setError('Choose an area and both start and end times')
      return
    }
    if (isDomiciliary && !openCall.person_id) {
      setError('Select the client this call is for')
      return
    }
    const start = new Date(openCall.start_time)
    const end = new Date(openCall.end_time)
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      setError('The end time must be after the start time')
      return
    }
    setError(''); setSuccess(''); setOpenCallSaving(true)
    try {
      await api.post('/shifts', {
        location_id: openCall.location_id,
        ...(openCall.person_id ? { person_id: openCall.person_id } : {}),
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        shift_type: openCall.shift_type,
        assigned_staff_ids: [],
      })
      setSuccess('Open call posted for carers to claim')
      resetOpenCall()
      setTab(0)
      fetchOpenShifts()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not post the open call')
    } finally { setOpenCallSaving(false) }
  }

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
      const res = await api.get('/shifts/staff', { silentError: true })
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
    fetchAgencies()
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
      const rateRes = await api.get(`/agencies/${agencyId}/rates`, { silentError: true })
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

  const clientOptions = useMemo(() => {
    const areaName = (id: string) => locations.find((l: any) => l.id === id)?.name || ''
    const list = (clients || []).map((c: any) => ({ ...c, _areaName: c.location_id ? areaName(c.location_id) : '' }))
    return list.sort((a: any, b: any) => {
      const aIn = a.location_id && a.location_id === openCall.location_id ? 0 : 1
      const bIn = b.location_id && b.location_id === openCall.location_id ? 0 : 1
      if (aIn !== bIn) return aIn - bIn
      return `${a.first_name || ''} ${a.last_name || ''}`.localeCompare(`${b.first_name || ''} ${b.last_name || ''}`)
    })
  }, [clients, locations, openCall.location_id])



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


  /** Pending claim per shift, so the table can show `Claimed — needs approval`. */
  const pendingByShift = useMemo(() => {
    const m = new Map<string, any>()
    for (const c of claimsWithMeta) {
      if (c.assignment_status === 'pending' && c.shift_id && !m.has(c.shift_id)) m.set(c.shift_id, c)
    }
    return m
  }, [claimsWithMeta])

  /** Approved claims starting this week (Mon–Sun) — the `Filled this week` card. */
  const filledThisWeek = useMemo(() => {
    const now = new Date()
    const monday = new Date(now)
    monday.setHours(0, 0, 0, 0)
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
    const sunday = new Date(monday)
    sunday.setDate(sunday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)
    return claimsWithMeta.filter((c: any) => {
      if (c.assignment_status !== 'assigned') return false
      const t = new Date(c.start_time).getTime()
      return Number.isFinite(t) && t >= monday.getTime() && t <= sunday.getTime()
    }).length
  }, [claimsWithMeta])

  const selectedLocName = selectedLocation === 'all'
    ? (isDomiciliary ? 'all areas' : 'all locations')
    : (locations.find((l: any) => l.id === selectedLocation)?.name || (isDomiciliary ? 'all areas' : 'all locations'))

  /** `29 Oct – 12 Nov · all locations`, from the shifts on screen (or the default window). */
  const dateRangeLabel = useMemo(() => {
    const times = shifts.map((s: any) => new Date(s.start_time).getTime()).filter(Number.isFinite).sort((a, b) => a - b)
    if (openDateFrom || openDateTo) {
      const from = openDateFrom ? fmtDayMonth(new Date(`${openDateFrom}T00:00:00`)) : fmtDayMonth(new Date())
      const to = openDateTo ? fmtDayMonth(new Date(`${openDateTo}T00:00:00`)) : fmtDayMonth(new Date(Date.now() + 14 * 86400000))
      return `${from} – ${to} · ${selectedLocName}`
    }
    if (times.length === 0) {
      const to = new Date(Date.now() + 14 * 86400000)
      return `${fmtDayMonth(new Date())} – ${fmtDayMonth(to)} · ${selectedLocName}`
    }
    return `${fmtDayMonth(new Date(times[0]))} – ${fmtDayMonth(new Date(times[times.length - 1]))} · ${selectedLocName}`
  }, [shifts, openDateFrom, openDateTo, selectedLocName])

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

  /** Status chips live in the table rows now (Open / Claimed — needs approval / Unclaimed). */

  return (
    <PageContainer>
      <Typography variant="caption" sx={{ color: '#0164C8', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        Staffing / {marketplaceTitle}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.5} sx={{ mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>{marketplaceTitle}</Typography>
          <Typography variant="body2" color="text.secondary">{marketplaceDescription}.</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, bgcolor: '#fff', border: '1px solid #E3E9F0', borderRadius: 6, pl: 1.25, pr: 0.5 }}>
          <PlaceIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Select size="small" variant="standard" disableUnderline value={selectedLocation}
            onChange={e => setSelectedLocation(e.target.value)}
            sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
            <MenuItem value="all">{isDomiciliary ? 'All areas' : 'All locations'}</MenuItem>
            {locations.map((l: any) => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
          </Select>
        </Box>
        {isAdminOrManager && <AppButton onClick={openCreateOpenCall}>Post open call</AppButton>}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Live banner — Figma 4.2: shown once calls are posted */}
      {shifts.length > 0 && (
        <Paper sx={{ mb: 2, p: 2, borderRadius: 2, border: '1px solid', borderColor: '#BBF7D0', bgcolor: '#F0FDF4' }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: '#fff', color: '#16A34A', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <CheckCircle sx={{ fontSize: 18 }} />
            </Box>
            <Box>
              <Typography variant="body2" fontWeight={700} sx={{ color: '#166534' }}>
                {shifts.length} open call{shifts.length === 1 ? ' is' : 's are'} live
              </Typography>
              <Typography variant="body2" sx={{ color: '#166534' }}>
                Staff with matching skills have been told. We’ll let you know as soon as someone claims a shift.
              </Typography>
            </Box>
          </Stack>
        </Paper>
      )}

      {/* Tabs — Figma 4.2 */}
      <Tabs value={tab} onChange={(_, v) => { if (v === 0 || v === 1) setTab(v) }}
        sx={{ borderBottom: 1, borderColor: '#E3E9F0', mb: 2, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minHeight: 40 } }}>
        <Tab value={0} icon={<FlagIcon sx={{ fontSize: 15 }} />} iconPosition="start"
          label={`Available shifts ${shifts.length}`} />
        <Tab value={1} icon={<CheckCircle sx={{ fontSize: 15 }} />} iconPosition="start"
          label={`Claims ${claimCounts.pending}`} />
      </Tabs>

      {/* Metric cards — Figma 4.2 */}
      {(() => {
        const cards = [
          {
            label: 'Open calls', value: `${shifts.length}`,
            detail: shifts.length === 0 ? 'Available to claim' : 'Posted today',
            icon: <FlagIcon fontSize="small" />,
          },
          {
            label: 'Claims waiting', value: `${claimCounts.pending}`,
            detail: 'Need your approval',
            icon: <CheckCircle fontSize="small" />,
          },
          {
            label: 'Filled this week', value: `${filledThisWeek}`,
            detail: 'Through the marketplace',
            icon: <GroupIcon fontSize="small" />,
          },
        ]
        return (
          <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap', gap: 2 }}>
            {cards.map(card => (
              <Paper key={card.label} sx={{ flex: '1 1 160px', p: 2, borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>{card.label}</Typography>
                  <Box sx={{
                    width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: '50%',
                    bgcolor: '#EAF3FF', color: '#0164C8',
                  }}>{card.icon}</Box>
                </Stack>
                <Typography variant="h4" sx={{ mt: 0.5, fontWeight: 600, lineHeight: 1.1 }}>{card.value}</Typography>
                <Typography variant="caption" color="text.secondary">{card.detail}</Typography>
              </Paper>
            ))}
          </Stack>
        )
      })()}



      {tab === 1 && (
        <Paper variant="outlined" sx={{ mb: 3, px: 2, py: 1.5 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} justifyContent="space-between">
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {statusFilterOptions.map(opt => (
                <Chip key={opt.key} label={`${opt.label} (${claimCounts[opt.key]})`}
                  color={statusFilter === opt.key ? 'primary' : 'default'}
                  variant={statusFilter === opt.key ? 'filled' : 'outlined'}
                  onClick={() => setStatusFilter(opt.key)}
                  sx={{ fontWeight: 600 }} />
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

      {/* ── Tab 0: Available shifts — Figma 4.2 extended view ── */}
      {tab === 0 && (
        <Paper sx={{ borderRadius: 2, border: '1px solid', borderColor: '#E3E9F0', overflow: 'hidden', mb: 2 }}>
          <Box sx={{ p: 2, pb: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>Available shifts</Typography>
            <Typography variant="caption" color="text.secondary">{dateRangeLabel}</Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 2, pb: 1.5, flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, bgcolor: '#fff', border: '1px solid #E3E9F0', borderRadius: 6, pl: 1.25, pr: 0.5 }}>
              <PlaceIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Select size="small" variant="standard" disableUnderline value={selectedLocation}
                onChange={e => setSelectedLocation(e.target.value)}
                sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
                <MenuItem value="all">{isDomiciliary ? 'All areas' : 'All locations'}</MenuItem>
                {locations.map((l: any) => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
              </Select>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: '#fff', border: '1px solid #E3E9F0', borderRadius: 6, pl: 1.25, pr: 1 }}>
              <CalendarIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <TextField variant="standard" type="date" value={openDateFrom}
                onChange={e => setOpenDateFrom(e.target.value)} InputProps={{ disableUnderline: true }}
                inputProps={{ 'aria-label': 'From date' }} sx={{ width: 128, '& input': { fontSize: '0.8rem', fontWeight: 600 } }} />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: '#fff', border: '1px solid #E3E9F0', borderRadius: 6, pl: 1.25, pr: 1 }}>
              <CalendarIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <TextField variant="standard" type="date" value={openDateTo}
                onChange={e => setOpenDateTo(e.target.value)} InputProps={{ disableUnderline: true }}
                inputProps={{ 'aria-label': 'To date' }} sx={{ width: 128, '& input': { fontSize: '0.8rem', fontWeight: 600 } }} />
            </Box>
            {(openDateFrom || openDateTo) && (
              <Button size="small" onClick={() => { setOpenDateFrom(''); setOpenDateTo('') }}>Reset</Button>
            )}
          </Stack>
          {shiftsLoading && shifts.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress size={28} /></Box>
          ) : shifts.length === 0 ? (
            <Box sx={{ px: 2, pb: 4, pt: 2, textAlign: 'center' }}>
              <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: '#EAF3FF', color: '#0164C8', display: 'grid', placeItems: 'center', mx: 'auto', mb: 1.5 }}>
                <FlagIcon />
              </Box>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>No open calls right now</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 440, mx: 'auto' }}>
                When a shift is posted, it appears here for staff with the right skills. Check back later, or post one yourself.
              </Typography>
              {isAdminOrManager && <AppButton onClick={openCreateOpenCall}>Post open call</AppButton>}
            </Box>
          ) : (
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 700 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>Shift</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>{isDomiciliary ? 'Area' : 'Location'}</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>Role</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>Status</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shifts.map((s: any) => {
                    const pending = pendingByShift.get(s.id)
                    const past = new Date(s.start_time) < new Date()
                    const actionKey = pending ? `${s.id}-${pending.staff_id}` : null
                    const isProcessing = !!actionKey && approvingId === actionKey
                    const claimant = pending
                      ? (pending.isOwn ? 'you' : `${pending.first_name || ''} ${pending.last_name || ''}`.trim() || initialsOf(pending.first_name, pending.last_name))
                      : ''
                    return (
                      <TableRow key={s.id} hover onClick={() => setDetail(pending || s)} sx={{ cursor: 'pointer' }}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: 'nowrap' }}>{fmtDate(s.start_time)}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                            {fmtTime(s.start_time)} – {fmtTime(s.end_time)} · {shiftPattern(s)}
                          </Typography>
                        </TableCell>
                        <TableCell><Typography variant="body2">{s.location_name || '—'}</Typography></TableCell>
                        <TableCell><Typography variant="body2">{s.department_name || shiftTypeLabel(s.shift_type)}</Typography></TableCell>
                        <TableCell>
                          {pending ? (
                            <>
                              <Chip label="Claimed — needs approval" size="small"
                                sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600, bgcolor: '#DCFCE7', color: '#166534' }} />
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, whiteSpace: 'nowrap' }}>
                                Claimed by {claimant}
                              </Typography>
                            </>
                          ) : past ? (
                            <Chip label="Unclaimed" size="small"
                              sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'notice.error.bg', color: 'notice.error.fg', fontWeight: 600 }} />
                          ) : (
                            <>
                              <Chip label="Open" size="small"
                                sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600, bgcolor: '#EAF3FF', color: '#0164C8' }} />
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, whiteSpace: 'nowrap' }}>
                                No claims yet
                              </Typography>
                            </>
                          )}
                        </TableCell>
                        <TableCell align="right" onClick={e => e.stopPropagation()}>
                          {pending && isAdminOrManager ? (
                            <Button size="small" variant="contained"
                              startIcon={isProcessing ? <CircularProgress size={14} color="inherit" /> : undefined}
                              onClick={() => handleApprove(s.id, pending.staff_id)}
                              disabled={isProcessing}
                              sx={{ textTransform: 'none', fontWeight: 600, bgcolor: '#0164C8' }}>
                              Approve claim
                            </Button>
                          ) : !pending && !past && !isAdminOrManager ? (
                            <AppButton
                              startIcon={claimingId === s.id ? undefined : <ClaimIcon sx={{ fontSize: 16 }} />}
                              loading={claimingId === s.id}
                              onClick={() => handleClaim(s.id)}
                              sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
                              Claim
                            </AppButton>
                          ) : !pending && !past && isAdminOrManager ? (
                            <Button size="small" variant="outlined"
                              onClick={() => { window.location.href = `/scheduling?week=${String(s.start_time).split('T')[0]}&shift=${s.id}` }}
                              sx={{ textTransform: 'none' }}>
                              Edit call
                            </Button>
                          ) : past && !pending ? (
                            <Typography variant="caption" color="text.secondary">Call started</Typography>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {shifts.length > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5, borderTop: '1px solid #E3E9F0' }}>
              <Typography variant="caption" color="text.secondary">
                {shifts.length} open call{shifts.length === 1 ? '' : 's'} · {claimCounts.pending} claim{claimCounts.pending === 1 ? '' : 's'} waiting
              </Typography>
              <Typography variant="caption" color="text.secondary">Live data</Typography>
            </Box>
          )}
        </Paper>
      )}

      {/* ── Tab 1: Claims (own history + all staff, in one place) ── */}
      {tab === 1 && (
        <>
          {claimsLoading && claimsWithMeta.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress size={28} /></Box>
          ) : claimsWithMeta.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
              <Typography variant="h6" color="#5D6E85" sx={{ mb: 1 }}>No claims yet</Typography>
              <Typography variant="body2" color="#5D6E85">Claim an open shift and track its status here.</Typography>
            </Paper>
          ) : filteredClaims.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
              <Typography variant="h6" color="#5D6E85" sx={{ mb: 1 }}>No claims match the current filters</Typography>
              <Button size="small" onClick={() => { setStatusFilter('all'); setClaimsDateFrom(''); setClaimsDateTo('') }}>Reset filters</Button>
            </Paper>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'notice.subtle.bg' }}>
                    {isAdminOrManager && <TableCell sx={{ fontWeight: 600 }}>Staff</TableCell>}
                    <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Time</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{isDomiciliary ? 'Area' : 'Location'}</TableCell>
                    {!isAdminOrManager && <TableCell sx={{ fontWeight: 600 }}>Department</TableCell>}
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    {isAdminOrManager && <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>}
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
                              {c.isOwn && <PersonIcon sx={{ fontSize: 14, color: '#0164C8' }} />}
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

      {/* ── Manager open-call dialog ── */}
      <Dialog open={openCallDialog} onClose={resetOpenCall} maxWidth="sm" fullWidth>
        <DialogTitle>Post an open call</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Publish an unassigned call to the marketplace so an eligible carer can pick it up. The call remains open until it is claimed or managed from Claims.
          </Typography>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel id="open-call-location-label">Area</InputLabel>
              <Select labelId="open-call-location-label" label="Area" value={openCall.location_id} onChange={e => setOpenCall(p => ({ ...p, location_id: e.target.value }))}>
                {locations.map((location: any) => <MenuItem key={location.id} value={location.id}>{location.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth required={isDomiciliary}>
              <InputLabel id="open-call-client-label">{isDomiciliary ? 'Client' : 'Person'}</InputLabel>
              <Select labelId="open-call-client-label" label={isDomiciliary ? 'Client' : 'Person'} value={openCall.person_id}
                onChange={e => setOpenCall(p => ({ ...p, person_id: e.target.value }))}>
                <MenuItem value=""><em>{isDomiciliary ? 'Select the client this call is for' : 'Not person-specific'}</em></MenuItem>
                {clientOptions.map((c: any) => (
                  <MenuItem key={c.id} value={c.id}>
                    {[c.first_name, c.last_name].filter(Boolean).join(' ')}
                    {c._areaName ? ` · ${c._areaName}` : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {clientsLoading && <Typography variant="caption" color="text.secondary">Loading {isDomiciliary ? 'clients' : 'people'}…</Typography>}
            <TextField label="Starts" type="datetime-local" required value={openCall.start_time} onChange={e => setOpenCall(p => ({ ...p, start_time: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
            <TextField label="Ends" type="datetime-local" required value={openCall.end_time} onChange={e => setOpenCall(p => ({ ...p, end_time: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
            <FormControl fullWidth>
              <InputLabel id="open-call-type-label">Call type</InputLabel>
              <Select labelId="open-call-type-label" label="Call type" value={openCall.shift_type} onChange={e => setOpenCall(p => ({ ...p, shift_type: e.target.value }))}>
                <MenuItem value="day">Day call</MenuItem>
                <MenuItem value="sleep">Sleep-in</MenuItem>
                <MenuItem value="wake_night">Wake night</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={resetOpenCall}>Cancel</Button>
          <AppButton onClick={handlePostOpenCall} loading={openCallSaving}>Post Open Call</AppButton>
        </DialogActions>
      </Dialog>

      {/* ── Shift detail dialog (read-only) ── */}
      <Dialog open={!!detail} onClose={() => setDetail(null)} maxWidth="sm" fullWidth>
        {detail && (
          <>
            <DialogTitle>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={1} alignItems="center">
                  <ScheduleIcon sx={{ color: '#0164C8' }} />
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {shiftTypeLabel(detail.shift_type)} {isDomiciliary ? 'call' : 'shift'}
                    </Typography>
                    <Typography variant="caption" color="#51637A">{fmtLongDate(detail.start_time)}</Typography>
                  </Box>
                </Stack>
                {detail.assignment_status && claimStatusChip(detail.assignment_status)}
              </Stack>
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={1.5}>
                <DetailRow icon={<LocationIcon />} label={isDomiciliary ? 'Area' : 'Location'} value={detail.location_name || '—'} />
                <DetailRow icon={<AccessTimeIcon />} label="Time" value={`${fmtTime(detail.start_time)} – ${fmtTime(detail.end_time)}`} />
                <DetailRow icon={<ScheduleIcon />} label="Duration" value={`${shiftHours(detail)} hours`} />
                {detail.department_name && <DetailRow label="Department" value={detail.department_name} />}
                {(detail.su_first_name || detail.su_last_name) && (
                  <DetailRow icon={<PersonIcon />} label={isDomiciliary ? 'Client' : 'Service user'} value={`${detail.su_first_name} ${detail.su_last_name}`} />
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
                      <Typography variant="overline" sx={{ fontWeight: 600, color: 'text.secondary' }}>Assigned staff</Typography>
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
                      sx={{ textTransform: 'none', fontWeight: 600 }}>
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
              {isAdminOrManager && !isDomiciliary && !detail.assignment_status && detail.id && (
                <Button variant="outlined"
                  startIcon={<SendIcon />}
                  onClick={() => { const s = detail; setDetail(null); openAgencyDialog(s) }}
                  sx={{ textTransform: 'none' }}>
                  Send to Agency
                </Button>
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
            <SendIcon sx={{ color: '#0164C8' }} />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Send to Agency</Typography>
              <Typography variant="caption" color="#51637A">{agencyDialog.date_label} · {agencyDialog.location_name}</Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'notice.subtle.bg' }}>
              <Stack direction="row" justifyContent="space-between" flexWrap="wrap" useFlexGap>
                <Typography variant="body2" color="#51637A">Shift</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
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
              <Typography variant="caption" color="#51637A" sx={{ mt: -1 }}>
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
            sx={{ bgcolor: '#0164C8', '&:hover': { bgcolor: '#014FB5' } }}>
            {sendingToAgency ? <CircularProgress size={20} sx={{ color: '#FFFFFF' }} /> : 'Send to Agency'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Reassign claim dialog ── */}
      <Dialog open={reassignDialog.open} onClose={() => setReassignDialog({ open: false, shiftId: '', staffId: '', staffName: '', start_time: '', end_time: '', location_name: '', date_label: '' })} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <SwapHorizIcon sx={{ color: '#0164C8' }} />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Reassign Shift</Typography>
              <Typography variant="caption" color="#51637A">{reassignDialog.date_label} · {reassignDialog.location_name}</Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'notice.subtle.bg' }}>
              <Stack direction="row" justifyContent="space-between" flexWrap="wrap" useFlexGap>
                <Typography variant="body2" color="#51637A">Currently claimed by</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{reassignDialog.staffName}</Typography>
              </Stack>
            </Paper>
            <Autocomplete
              options={staffList}
              getOptionLabel={(o: any) => `${o.first_name} ${o.last_name}`.trim()}
              value={staffList.find((s: any) => s.staff_id === reassignStaff) || null}
              onChange={(_, v) => setReassignStaff(v?.staff_id || '')}
              renderInput={(params) => <TextField {...params} label="Assign to staff *" required />}
            />
            {staffList.length === 0 && <Typography variant="caption" color="#51637A">Loading staff…</Typography>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setReassignDialog({ open: false, shiftId: '', staffId: '', staffName: '', start_time: '', end_time: '', location_name: '', date_label: '' })}>Cancel</Button>
          <Button variant="contained" onClick={handleReassign} disabled={reassigning || !reassignStaff}
            sx={{ bgcolor: '#0164C8', '&:hover': { bgcolor: '#014FB5' } }}>
            {reassigning ? <CircularProgress size={20} sx={{ color: '#FFFFFF' }} /> : 'Reassign'}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  )
}
