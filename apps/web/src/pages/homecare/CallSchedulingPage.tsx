import { useMemo, useState } from 'react'
import {
  Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Typography, IconButton, Tooltip,
} from '@mui/material'
import {
  Today as TodayIcon, ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon,
  PersonAdd as AssignIcon, PlayArrow as CheckInIcon,
  Stop as CheckOutIcon, Search as SearchIcon,
} from '@mui/icons-material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import PageContainer from '../../components/design/PageContainer'
import api from '../../services/api'

const timeLabel = (d: string) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const dateLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const localDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const statusColor = (s: string) => {
  if (s === 'completed') return { bg: '#E9F7F0', color: '#047857' }
  if (s === 'missed' || s === 'cancelled') return { bg: '#FDECEC', color: '#B42318' }
  if (s === 'checked_in') return { bg: '#E0F2FE', color: '#0F4C81' }
  if (s === 'en_route') return { bg: '#EDE9FE', color: '#7C3AED' }
  return { bg: '#F3F4F6', color: 'text.secondary' }
}

const PAGE_SIZE = 15

export default function CallSchedulingPage() {
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [carerFilter, setCarerFilter] = useState('')
  const [assignDialog, setAssignDialog] = useState<any>(null)
  const [assignStaffId, setAssignStaffId] = useState('')
  const [detailVisit, setDetailVisit] = useState<any>(null)
  const [page, setPage] = useState(0)
  const user = useMemo(() => { try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} } }, [])
  const isManager = user.role === 'ORG_ADMIN' || user.role === 'MANAGER'
  const qc = useQueryClient()

  const today = new Date()
  today.setDate(today.getDate() + offset)
  const dayStr = localDate(today)
  const nextDay = new Date(today)
  nextDay.setDate(nextDay.getDate() + 1)
  const nextDayStr = localDate(nextDay)

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ['homecare-visits-schedule', dayStr, isManager],
    queryFn: () => api.get(isManager ? '/homecare/visits' : '/homecare/my-visits', {
      params: { from: dayStr, to: nextDayStr }
    }).then(r => Array.isArray(r.data) ? r.data : []),
  })

  const { data: staff = [] } = useQuery({
    queryKey: ['homecare-staff-for-schedule'],
    queryFn: () => api.get('/homecare/staff').then(r => Array.isArray(r.data) ? r.data : []),
    enabled: isManager,
  })

  const assignVisit = useMutation({
    mutationFn: ({ visitId, staffId }: { visitId: string; staffId: string | null }) =>
      api.patch(`/homecare/visits/${visitId}`, { assigned_staff_id: staffId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['homecare-visits-schedule'] })
      setAssignDialog(null)
      setAssignStaffId('')
    },
  })

  const updateStatus = useMutation({
    mutationFn: ({ visitId, status }: { visitId: string; status: string }) =>
      api.patch(`/homecare/visits/${visitId}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['homecare-visits-schedule'] }),
  })

  const sorted = [...visits].sort((a: any, b: any) => new Date(a.scheduled_start || a.visit_date).getTime() - new Date(b.scheduled_start || b.visit_date).getTime())

  // Unique carers for filter
  const carers = useMemo(() => {
    const map = new Map<string, string>()
    sorted.forEach((v: any) => { if (v.carer_name && v.assigned_staff_id) map.set(v.assigned_staff_id, v.carer_name) })
    return Array.from(map.entries())
  }, [sorted])

  // Apply filters
  const filtered = useMemo(() => {
    let result = sorted
    if (statusFilter) result = result.filter((v: any) => v.status === statusFilter)
    if (carerFilter) result = result.filter((v: any) => v.assigned_staff_id === carerFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((v: any) =>
        (v.person_name || '').toLowerCase().includes(q) ||
        (v.carer_name || '').toLowerCase().includes(q) ||
        (v.label || '').toLowerCase().includes(q) ||
        (v.package_name || '').toLowerCase().includes(q)
      )
    }
    return result
  }, [sorted, statusFilter, carerFilter, search])

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    sorted.forEach((v: any) => { const s = v.status || 'scheduled'; counts[s] = (counts[s] || 0) + 1 })
    return counts
  }, [sorted])

  return (
    <PageContainer>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Call Schedule</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>Today's visit schedule — manage, assign, and track calls</Typography>
        </Box>
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <Button size="small" onClick={() => setOffset(o => o - 1)} sx={{ minWidth: 'auto' }}><ChevronLeftIcon /></Button>
        <Chip
          icon={<TodayIcon />}
          label={`${dateLabel(dayStr)} — ${sorted.length} calls`}
          color={offset === 0 ? 'primary' : 'default'}
          onClick={() => setOffset(0)}
          sx={{ fontWeight: 700, bgcolor: offset === 0 ? '#0F4C81' : undefined, color: offset === 0 ? 'white' : undefined }}
        />
        <Button size="small" onClick={() => setOffset(o => o + 1)} sx={{ minWidth: 'auto' }}><ChevronRightIcon /></Button>
      </Stack>

      {/* Status summary chips */}
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        {Object.entries(statusCounts).map(([status, count]) => (
          <Chip
            key={status}
            label={`${status.replace(/_/g, ' ')} (${count})`}
            size="small"
            onClick={() => setStatusFilter(statusFilter === status ? '' : status)}
            sx={{
              fontWeight: 600, cursor: 'pointer',
              bgcolor: statusFilter === status ? statusColor(status).bg : 'transparent',
              border: `1px solid ${statusFilter === status ? statusColor(status).color : '#E5E7EB'}`,
              color: statusFilter === status ? statusColor(status).color : 'text.secondary',
            }}
          />
        ))}
      </Stack>

      {/* Search and filters */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          size="small" placeholder="Search client, carer, or label..."
          value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
          InputProps={{ startAdornment: <SearchIcon sx={{ mr: 0.5, color: 'text.secondary', fontSize: 18 }} /> }}
          sx={{ flex: 1, minWidth: 200 }}
        />
        {carers.length > 0 && (
          <TextField
            select size="small" label="Filter by carer" value={carerFilter}
            onChange={e => { setCarerFilter(e.target.value); setPage(0) }}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">All carers</MenuItem>
            {carers.map(([id, name]) => <MenuItem key={id} value={id}>{name}</MenuItem>)}
          </TextField>
        )}
      </Stack>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <>
          <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'grey.200', borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Time</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Client</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Carer</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Package</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Duration</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  {isManager && <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow><TableCell colSpan={isManager ? 7 : 6} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    {search || statusFilter || carerFilter ? 'No calls match your filters' : 'No calls scheduled for this day'}
                  </TableCell></TableRow>
                ) : paginated.map((v: any) => {
                  const start = v.scheduled_start || v.visit_date
                  const end = v.scheduled_end
                  const dur = start && end ? Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000) : null
                  const cfg = statusColor(v.status || 'scheduled')
                  const isOpen = ['scheduled', 'en_route', 'checked_in'].includes(v.status)
                  return (
                    <TableRow key={v.id} hover sx={{ cursor: 'pointer' }} onClick={() => setDetailVisit(v)}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {timeLabel(start)}{end && ` – ${timeLabel(end)}`}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{v.person_name || '—'}</Typography>
                        {v.person_address && <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: 200 }}>{v.person_address}</Typography>}
                      </TableCell>
                      <TableCell>
                        {v.carer_name || <Typography sx={{ color: '#D97706', fontWeight: 600, fontSize: '0.85rem' }}>Unassigned</Typography>}
                      </TableCell>
                      <TableCell><Typography variant="body2" color="text.secondary">{v.package_name || '—'}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{dur != null ? `${dur} min` : '—'}</Typography></TableCell>
                      <TableCell>
                        <Chip label={v.status?.replace(/_/g, ' ') || 'scheduled'} size="small" sx={{ bgcolor: cfg.bg, color: cfg.color, fontWeight: 600 }} />
                      </TableCell>
                      {isManager && (
                        <TableCell align="right" onClick={e => e.stopPropagation()}>
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            {!v.assigned_staff_id && (
                              <Tooltip title="Assign carer">
                                <IconButton size="small" onClick={() => { setAssignDialog(v); setAssignStaffId('') }} sx={{ color: '#0F4C81' }}>
                                  <AssignIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {isOpen && v.status === 'scheduled' && (
                              <Tooltip title="Mark as en route">
                                <IconButton size="small" onClick={() => updateStatus.mutate({ visitId: v.id, status: 'en_route' })} sx={{ color: '#7C3AED' }}>
                                  <CheckInIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {isOpen && v.status === 'en_route' && (
                              <Tooltip title="Check in">
                                <IconButton size="small" onClick={() => updateStatus.mutate({ visitId: v.id, status: 'checked_in' })} sx={{ color: '#0F4C81' }}>
                                  <CheckInIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {isOpen && v.status === 'checked_in' && (
                              <Tooltip title="Check out">
                                <IconButton size="small" onClick={() => updateStatus.mutate({ visitId: v.id, status: 'completed' })} sx={{ color: '#047857' }}>
                                  <CheckOutIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          {totalPages > 1 && (
            <Stack direction="row" justifyContent="center" alignItems="center" spacing={1} sx={{ mt: 2 }}>
              <Button size="small" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Typography variant="body2" color="text.secondary">Page {page + 1} of {totalPages}</Typography>
              <Button size="small" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
            </Stack>
          )}
        </>
      )}

      {/* Assign carer dialog */}
      <Dialog open={!!assignDialog} onClose={() => setAssignDialog(null)} fullWidth maxWidth="xs">
        <DialogTitle>Assign carer</DialogTitle>
        <DialogContent>
          <TextField
            select fullWidth label="Select carer" value={assignStaffId}
            onChange={e => setAssignStaffId(e.target.value)} sx={{ mt: 1 }}
          >
            <MenuItem value="">Unassigned</MenuItem>
            {staff.map((s: any) => <MenuItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</MenuItem>)}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialog(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" disabled={!assignStaffId || assignVisit.isPending}
            onClick={() => { if (assignDialog) assignVisit.mutate({ visitId: assignDialog.id, staffId: assignStaffId }) }}
            sx={{ textTransform: 'none', bgcolor: '#0F4C81' }}>
            {assignVisit.isPending ? <CircularProgress size={18} color="inherit" /> : 'Assign'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!detailVisit} onClose={() => setDetailVisit(null)} fullWidth maxWidth="sm">
        <DialogTitle>Call details</DialogTitle>
        <DialogContent>
          {detailVisit && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={2}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">Client</Typography>
                  <Typography variant="body1" fontWeight={600}>{detailVisit.person_name}</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">Carer</Typography>
                  <Typography variant="body1" fontWeight={600}>{detailVisit.carer_name || 'Unassigned'}</Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={2}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">Time</Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {timeLabel(detailVisit.scheduled_start)} – {timeLabel(detailVisit.scheduled_end)}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <Chip label={detailVisit.status?.replace(/_/g, ' ') || 'scheduled'} size="small"
                    sx={{ bgcolor: statusColor(detailVisit.status).bg, color: statusColor(detailVisit.status).color, fontWeight: 600 }} />
                </Box>
              </Stack>
              {detailVisit.person_address && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Address</Typography>
                  <Typography variant="body2">{detailVisit.person_address}</Typography>
                </Box>
              )}
              {detailVisit.label && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Label</Typography>
                  <Typography variant="body2">{detailVisit.label}</Typography>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailVisit(null)} sx={{ textTransform: 'none' }}>Close</Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  )
}
