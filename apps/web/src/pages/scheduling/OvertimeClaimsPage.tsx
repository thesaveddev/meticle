import { useState, useEffect, useRef } from 'react'
import { Box, Typography, Paper, Button, Stack, Chip, Alert, Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, FormControl, InputLabel, Select, MenuItem, CircularProgress, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Divider } from '@mui/material'
import { useSearchParams } from 'react-router-dom'
import { MICA_RECORD_PARAMS } from '@meticle/shared'
import PageContainer from '../../components/design/PageContainer'
import { PageHeader } from '../../components/ui'
import { PremiumCard } from '../../components/design/PremiumCard'
import { EmptyState } from '../../components/design/EmptyState'
import { CheckCircle, Cancel, WarningAmber as WarningIcon, Person, Undo as UndoIcon, SwapHoriz as SwapHorizIcon } from '@mui/icons-material'
import api from '../../services/api'

export default function OvertimeClaimsPage() {
  const currentUser = (() => { const s = localStorage.getItem('user'); try { const p = s ? JSON.parse(s) : {}; return p && typeof p === 'object' ? p : {} } catch { return {} } })()
  const isAdminOrManager = currentUser.role === 'ORG_ADMIN' || currentUser.role === 'MANAGER'

  const [tab, setTab] = useState(0)
  const [myClaims, setMyClaims] = useState<any[]>([])
  const [allClaims, setAllClaims] = useState<any[]>([])
  const [approvedClaims, setApprovedClaims] = useState<any[]>([])
  const [unclaimedShifts, setUnclaimedShifts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [revokeDialog, setRevokeDialog] = useState<{ shiftId: string; staffId: string; staffName: string } | null>(null)
  const [swapOTDialog, setSwapOTDialog] = useState<{ shiftId: string; currentStaffId: string; currentStaffName: string } | null>(null)
  const [swapOTStaffList, setSwapOTStaffList] = useState<any[]>([])
  const [swapOTNewStaffId, setSwapOTNewStaffId] = useState('')
  // The one claim a row — or a link — opens, read from the URL rather than passed
  // in state, because the URL is the only thing that survives a reload. It is the
  // claim a notification or an email is about: `?claim=<id>`.
  const [detailClaim, setDetailClaim] = useState<any | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const linkedClaimId = searchParams.get(MICA_RECORD_PARAMS['overtime-claim'])
  // Held alongside the URL so the same link opens its claim once: a refetch, a
  // filter change or a re-render must not re-open a dialog the manager has closed.
  const linkedClaimRef = useRef<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const calls: any[] = [
        api.get('/shifts/my-claims'),
      ]
      if (isAdminOrManager) {
        calls.push(api.get('/shifts/pending-claims'))
        calls.push(api.get('/shifts/approved-claims'))
        calls.push(api.get('/shifts/unclaimed'))
      }
      const [myRes, pendingRes, approvedRes, unclaimedRes] = await Promise.all(calls)
      setMyClaims(myRes.data)
      if (pendingRes) setAllClaims(pendingRes.data)
      if (approvedRes) setApprovedClaims(approvedRes.data)
      if (unclaimedRes) setUnclaimedShifts(unclaimedRes.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load claims')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  // Opens the one claim a link names.
  //
  // The claim has to open whether or not it is on screen, so the search is over
  // every list this page has already fetched — its own claims, the pending queue,
  // the approved ones — rather than over the rows in front of the manager. The tab
  // and the status filter decide what the table holds, and a link arrives from
  // outside both: a claim hidden by a filter is exactly the claim a manager would
  // otherwise have to hunt for, which is what the link exists to stop.
  //
  // The id is the claim's own (`assignment_id`, the row's key). A link built from
  // the *shift* opens the one claim on that shift, because that is all an email
  // composed from a shift has to hand — and where two staff claim the same shift it
  // opens nothing rather than guessing which of them the mail meant.
  useEffect(() => {
    if (!linkedClaimId || linkedClaimRef.current === linkedClaimId) return
    if (loading) return
    const lists: Array<[number, any[]]> = isAdminOrManager
      ? [[0, myClaims], [1, allClaims], [2, approvedClaims]]
      : [[0, myClaims]]
    let claim: any | undefined
    let claimTab = 0
    for (const [tabIndex, list] of lists) {
      const found = list.find((c: any) => c.assignment_id === linkedClaimId)
      if (found) { claim = found; claimTab = tabIndex; break }
    }
    if (!claim) {
      const onShift = lists.flatMap(([, list]) => list).filter((c: any) => c.shift_id === linkedClaimId)
      if (onShift.length === 1) {
        claim = onShift[0]
        claimTab = lists.find(([, list]) => list.includes(onShift[0]))?.[0] ?? 0
      }
    }
    // Once-only before the decision, so a claim this caller cannot read is not
    // retried by every later render.
    linkedClaimRef.current = linkedClaimId
    if (!claim) {
      setError('That overtime claim could not be opened.')
      return
    }
    // The claim's own tab, unfiltered, so the row is on screen behind the dialog.
    setTab(claimTab)
    setStatusFilter('')
    setDetailClaim(claim)
  }, [linkedClaimId, loading, myClaims, allClaims, approvedClaims, isAdminOrManager])

  const handleApprove = async (shiftId: string, staffId: string) => {
    setError(''); setSuccess(''); setActionLoading(`approve-${shiftId}-${staffId}`)
    try {
      await api.patch(`/shifts/${shiftId}/approve-claim/${staffId}`)
      setSuccess('Claim approved')
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to approve')
    } finally { setActionLoading(null) }
  }

  const handleReject = async (shiftId: string, staffId: string) => {
    setError(''); setSuccess(''); setActionLoading(`reject-${shiftId}-${staffId}`)
    try {
      await api.patch(`/shifts/${shiftId}/reject-claim/${staffId}`)
      setSuccess('Claim rejected')
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reject')
    } finally { setActionLoading(null) }
  }

  const handleRevoke = async () => {
    if (!revokeDialog) return
    const { shiftId, staffId } = revokeDialog
    setError(''); setSuccess(''); setActionLoading(`revoke-${shiftId}-${staffId}`)
    try {
      await api.delete(`/shifts/${shiftId}/revoke-claim/${staffId}`)
      setSuccess('Overtime claim revoked — shift returned as open')
      setRevokeDialog(null)
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to revoke')
    } finally { setActionLoading(null) }
  }

  const openSwapOTDialog = async (shiftId: string, currentStaffId: string, currentStaffName: string) => {
    setSwapOTDialog({ shiftId, currentStaffId, currentStaffName })
    setSwapOTNewStaffId('')
    try {
      const res = await api.get('/shifts/staff')
      setSwapOTStaffList(res.data.filter((s: any) => s.staff_id !== currentStaffId))
    } catch { setSwapOTStaffList([]) }
  }

  const handleSwapOT = async () => {
    if (!swapOTDialog || !swapOTNewStaffId) return
    const { shiftId, currentStaffId } = swapOTDialog
    setError(''); setSuccess(''); setActionLoading(`swap-${shiftId}`)
    try {
      await api.post(`/shifts/${shiftId}/swap-claim/${currentStaffId}`, { newStaffId: swapOTNewStaffId })
      setSuccess('Overtime claim swapped')
      setSwapOTDialog(null)
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to swap overtime')
    } finally { setActionLoading(null) }
  }

  const statusChip = (status: string) => {
    const m: Record<string, { label: string; color: any }> = {
      assigned: { label: 'Approved', color: 'success' },
      pending: { label: 'Pending', color: 'warning' },
      rejected: { label: 'Rejected', color: 'error' },
    }
    const c = m[status] || { label: status, color: 'default' }
    return <Chip label={c.label} color={c.color} size="small" />
  }

  const shiftTypeChip = (t: string) => {
    if (t === 'sleep') return <Chip label="Sleep" size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'notice.subtle.bg', color: '#8B7CF6' }} />
    if (t === 'wake_night') return <Chip label="Wake Night" size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#8B7CF6', color: '#F7FAFE' }} />
    return <Chip label="Day" size="small" sx={{ height: 20, fontSize: '0.65rem' }} />
  }

  const formatDateShort = (dt: string) => {
    const d = new Date(dt)
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const formatTimeOnly = (dt: string) =>
    new Date(dt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  const calcDurationHours = (start: string, end: string) => {
    const ms = new Date(end).getTime() - new Date(start).getTime()
    return (ms / (1000 * 60 * 60)).toFixed(1)
  }

  const timeAgo = (dt: string) => {
    const mins = Math.floor((Date.now() - new Date(dt).getTime()) / (1000 * 60))
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ${mins % 60}m ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  const hoursUntilStart = (start: string) => {
    const hrs = (new Date(start).getTime() - Date.now()) / (1000 * 60 * 60)
    if (hrs <= 0) return <Chip label="Starting soon" size="small" color="error" sx={{ height: 18, fontSize: '0.6rem' }} />
    if (hrs < 12) return <Chip label={`${Math.round(hrs)}h until start`} size="small" color="warning" sx={{ height: 18, fontSize: '0.6rem' }} />
    return <Typography variant="caption" color="#51637A">{Math.round(hrs)}h until start</Typography>
  }

  // Closing the record also drops its link, so a reload or a later render cannot
  // put the manager back in a dialog they just closed.
  function closeDetail() {
    setDetailClaim(null)
    if (linkedClaimId) setSearchParams({}, { replace: true })
  }

  const myFiltered = statusFilter
    ? myClaims.filter((c: any) => c.assignment_status === statusFilter)
    : myClaims

  const allFiltered = statusFilter
    ? allClaims.filter((c: any) => c.assignment_status === statusFilter)
    : allClaims

  return (
    <PageContainer>

      <PageHeader title="Overtime Claims" subtitle="Review and approve overtime claims." />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`My Claims (${myFiltered.length})`} />
        {isAdminOrManager && <Tab label={`Pending (${allClaims.filter(c => c.assignment_status === 'pending').length})`} />}
        {isAdminOrManager && <Tab label={`Approved (${approvedClaims.length})`} />}
        {isAdminOrManager && <Tab label={`Unclaimed (${unclaimedShifts.length})`} />}
      </Tabs>

      <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
        <FormControl size="small" sx={{ width: 200 }}>
          <InputLabel>Status Filter</InputLabel>
          <Select value={statusFilter} label="Status Filter" onChange={e => setStatusFilter(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="assigned">Approved</MenuItem>
            <MenuItem value="rejected">Rejected</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : tab === 0 ? (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Date</strong></TableCell>
                <TableCell><strong>Time</strong></TableCell>
                <TableCell><strong>Duration</strong></TableCell>
                <TableCell><strong>Location</strong></TableCell>
                <TableCell><strong>Type</strong></TableCell>
                <TableCell><strong>Person</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell><strong>To Start</strong></TableCell>
                <TableCell align="right"><strong>Claimed</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {myFiltered.length === 0 ? (
                <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>No claims yet</TableCell></TableRow>
              ) : myFiltered.map((c: any) => (
                <TableRow key={c.assignment_id} hover onClick={() => setDetailClaim(c)} sx={{ cursor: 'pointer' }}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatDateShort(c.start_time)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{formatTimeOnly(c.start_time)} — {formatTimeOnly(c.end_time)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{calcDurationHours(c.start_time, c.end_time)}h</Typography>
                  </TableCell>
                  <TableCell>{c.location_name}</TableCell>
                  <TableCell>{shiftTypeChip(c.shift_type)}</TableCell>
                  <TableCell>
                    {c.su_first_name ? (
                      <Typography variant="body2">{c.su_first_name} {c.su_last_name}</Typography>
                    ) : (
                      <Typography variant="caption" color="#5D6E85">—</Typography>
                    )}
                  </TableCell>
                  <TableCell>{statusChip(c.assignment_status)}</TableCell>
                  <TableCell>{hoursUntilStart(c.start_time)}</TableCell>
                  <TableCell align="right">
                    <Typography variant="caption" color="#51637A">{timeAgo(c.claimed_at)}</Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : tab === 1 ? (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Staff</strong></TableCell>
                <TableCell><strong>Date</strong></TableCell>
                <TableCell><strong>Time</strong></TableCell>
                <TableCell><strong>Duration</strong></TableCell>
                <TableCell><strong>Location</strong></TableCell>
                <TableCell><strong>Type</strong></TableCell>
                <TableCell><strong>Person</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell align="right"><strong>Claimed</strong></TableCell>
                <TableCell align="center"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {allFiltered.length === 0 ? (
                <TableRow><TableCell colSpan={10} align="center" sx={{ py: 4, color: 'text.secondary' }}>No claims to review</TableCell></TableRow>
              ) : allFiltered.map((c: any) => (
                <TableRow key={c.assignment_id} hover onClick={() => setDetailClaim(c)} sx={{ cursor: 'pointer' }}>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Person sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{c.first_name} {c.last_name}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatDateShort(c.start_time)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{formatTimeOnly(c.start_time)} — {formatTimeOnly(c.end_time)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{calcDurationHours(c.start_time, c.end_time)}h</Typography>
                  </TableCell>
                  <TableCell>{c.location_name}</TableCell>
                  <TableCell>{shiftTypeChip(c.shift_type)}</TableCell>
                  <TableCell>
                    {c.su_first_name ? (
                      <Typography variant="body2">{c.su_first_name} {c.su_last_name}</Typography>
                    ) : (
                      <Typography variant="caption" color="#5D6E85">—</Typography>
                    )}
                  </TableCell>
                  <TableCell>{statusChip(c.assignment_status)}</TableCell>
                  <TableCell align="right">
                    <Typography variant="caption" color="#51637A">{timeAgo(c.claimed_at)}</Typography>
                  </TableCell>
                  <TableCell align="center" onClick={e => e.stopPropagation()}>
                    {c.assignment_status === 'pending' ? (
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        <Tooltip title="Approve">
                          <Button size="small" variant="contained" color="success"
                            sx={{ minWidth: 32, width: 32, height: 32, p: 0 }}
                            disabled={actionLoading !== null}
                            onClick={() => handleApprove(c.shift_id, c.staff_id)}>
                            {actionLoading === `approve-${c.shift_id}-${c.staff_id}` ? <CircularProgress size={14} /> : <CheckCircle fontSize="small" />}
                          </Button>
                        </Tooltip>
                        <Tooltip title="Reject">
                          <Button size="small" variant="contained" color="error"
                            sx={{ minWidth: 32, width: 32, height: 32, p: 0 }}
                            disabled={actionLoading !== null}
                            onClick={() => handleReject(c.shift_id, c.staff_id)}>
                            {actionLoading === `reject-${c.shift_id}-${c.staff_id}` ? <CircularProgress size={14} /> : <Cancel fontSize="small" />}
                          </Button>
                        </Tooltip>
                      </Stack>
                    ) : (
                      <Typography variant="caption" color="#51637A">—</Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : tab === 2 ? (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Staff</strong></TableCell>
                <TableCell><strong>Date</strong></TableCell>
                <TableCell><strong>Time</strong></TableCell>
                <TableCell><strong>Duration</strong></TableCell>
                <TableCell><strong>Location</strong></TableCell>
                <TableCell><strong>Type</strong></TableCell>
                <TableCell><strong>Person</strong></TableCell>
                <TableCell align="right"><strong>Approved</strong></TableCell>
                <TableCell align="center"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {approvedClaims.length === 0 ? (
                <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>No approved overtime claims</TableCell></TableRow>
              ) : approvedClaims.map((c: any) => (
                <TableRow key={c.assignment_id} hover onClick={() => setDetailClaim(c)} sx={{ cursor: 'pointer' }}>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Person sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{c.first_name} {c.last_name}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatDateShort(c.start_time)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{formatTimeOnly(c.start_time)} — {formatTimeOnly(c.end_time)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{calcDurationHours(c.start_time, c.end_time)}h</Typography>
                  </TableCell>
                  <TableCell>{c.location_name}</TableCell>
                  <TableCell>{shiftTypeChip(c.shift_type)}</TableCell>
                  <TableCell>
                    {c.su_first_name ? (
                      <Typography variant="body2">{c.su_first_name} {c.su_last_name}</Typography>
                    ) : (
                      <Typography variant="caption" color="#5D6E85">—</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="caption" color="#51637A">{timeAgo(c.claimed_at)}</Typography>
                  </TableCell>
                  <TableCell align="center" onClick={e => e.stopPropagation()}>
                    <Stack direction="row" spacing={0.5} justifyContent="center">
                      <Tooltip title="Swap to another staff">
                        <Button size="small" variant="outlined" color="primary"
                          sx={{ minWidth: 32, width: 32, height: 32, p: 0 }}
                          disabled={actionLoading !== null}
                          onClick={() => openSwapOTDialog(c.shift_id, c.staff_id, `${c.first_name} ${c.last_name}`)}>
                          <SwapHorizIcon fontSize="small" />
                        </Button>
                      </Tooltip>
                      <Tooltip title="Revoke this approved overtime">
                        <Button size="small" variant="outlined" color="error"
                          sx={{ minWidth: 32, width: 32, height: 32, p: 0 }}
                          disabled={actionLoading !== null}
                          onClick={() => setRevokeDialog({ shiftId: c.shift_id, staffId: c.staff_id, staffName: `${c.first_name} ${c.last_name}` })}>
                          {actionLoading === `revoke-${c.shift_id}-${c.staff_id}` ? <CircularProgress size={14} /> : <UndoIcon fontSize="small" />}
                        </Button>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Box>
          {unclaimedShifts.length === 0 ? (
            <EmptyState title="All open shifts have been claimed" description="There are no unclaimed shifts right now." />
          ) : (
            <Stack spacing={1.5}>
              {unclaimedShifts.map((s: any) => {
                const nearWindow = s.hours_until_start !== null && s.hours_until_start <= 12
                return (
                  <PremiumCard noBorder key={s.id} sx={{ p: 2, bgcolor: nearWindow ? '#FEF0F0' : 'background.paper' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Stack spacing={0.5}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{s.location_name}</Typography>
                          {shiftTypeChip(s.shift_type)}
                          {nearWindow && (
                            <Chip icon={<WarningIcon sx={{ fontSize: 12 }} />}
                              label="Starting within 12h — no claims"
                              size="small" color="error" sx={{ height: 20, fontSize: '0.6rem' }} />
                          )}
                        </Stack>
                        <Typography variant="body2" color="#51637A">
                          {formatDateShort(s.start_time)} — {formatTimeOnly(s.start_time)} to {formatTimeOnly(s.end_time)}
                          {' ('}{calcDurationHours(s.start_time, s.end_time)}h{')'}
                        </Typography>
                        {(s.su_first_name || s.department_name) && (
                          <Typography variant="caption" color="#51637A">
                            {s.su_first_name ? `Person: ${s.su_first_name} ${s.su_last_name || ''}` : ''}
                            {s.su_first_name && s.department_name ? ' | ' : ''}
                            {s.department_name ? `Dept: ${s.department_name}` : ''}
                          </Typography>
                        )}
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="caption" color="#51637A">
                          {s.hours_until_start !== null
                            ? `${Math.round(s.hours_until_start)}h until start`
                            : 'Starting'}
                        </Typography>
                      </Stack>
                    </Stack>
                  </PremiumCard>
                )
              })}
            </Stack>
          )}
        </Box>
      )}
      {/* The claim as it reads: what a row opens, and where a link from an email or a
          notification lands. Actions stay on the row behind it — this is the record,
          not a second place to approve it from. */}
      <Dialog open={!!detailClaim} onClose={closeDetail} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Overtime claim</DialogTitle>
        <DialogContent>
          {detailClaim && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                {statusChip(detailClaim.assignment_status)}
                {shiftTypeChip(detailClaim.shift_type)}
              </Stack>
              <Divider />
              {(detailClaim.first_name || detailClaim.last_name) && (
                <Typography variant="body2"><strong>Staff:</strong> {detailClaim.first_name} {detailClaim.last_name}</Typography>
              )}
              <Typography variant="body2">
                <strong>When:</strong> {formatDateShort(detailClaim.start_time)} — {formatTimeOnly(detailClaim.start_time)} to {formatTimeOnly(detailClaim.end_time)}
                {' ('}{calcDurationHours(detailClaim.start_time, detailClaim.end_time)}h{')'}
              </Typography>
              <Typography variant="body2"><strong>Location:</strong> {detailClaim.location_name}</Typography>
              <Typography variant="body2">
                <strong>Person:</strong>{' '}
                {detailClaim.su_first_name
                  ? `${detailClaim.su_first_name} ${detailClaim.su_last_name || ''}`.trim()
                  : 'Not recorded'}
              </Typography>
              <Stack spacing={0.5}>
                <Typography variant="caption" color="#51637A">Claimed at</Typography>
                <Typography variant="body2">
                  {detailClaim.claimed_at ? timeAgo(detailClaim.claimed_at) : 'Not recorded'}
                </Typography>
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={closeDetail}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Swap Overtime Dialog */}
      <Dialog open={!!swapOTDialog} onClose={() => !actionLoading && setSwapOTDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Swap Overtime</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="#51637A" sx={{ mb: 2 }}>
            Reassign the approved overtime from <strong>{swapOTDialog?.currentStaffName}</strong> to:
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel>New Staff Member</InputLabel>
            <Select value={swapOTNewStaffId} label="New Staff Member"
              onChange={e => setSwapOTNewStaffId(e.target.value)}>
              {swapOTStaffList.map((s: any) => (
                <MenuItem key={s.staff_id} value={s.staff_id}>{s.first_name} {s.last_name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setSwapOTDialog(null)} disabled={!!actionLoading}>Cancel</Button>
          <Button variant="contained" onClick={handleSwapOT} disabled={!swapOTNewStaffId || !!actionLoading}>
            {actionLoading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : 'Swap'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <Dialog open={!!revokeDialog} onClose={() => !actionLoading && setRevokeDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Revoke Overtime Claim</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="#51637A" sx={{ mt: 1 }}>
            This will revoke the approved overtime for <strong>{revokeDialog?.staffName}</strong> and return the shift to open/unclaimed status.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setRevokeDialog(null)} disabled={!!actionLoading}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleRevoke} disabled={!!actionLoading}>
            {actionLoading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : 'Revoke'}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  )
}
