import { useState } from 'react'
import { Box, Button, Chip, CircularProgress, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'

const time = (d: string) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const dateStr = (d: string) => new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: 'Done', color: '#047857', bg: '#E9F7F0' },
  checked_in: { label: 'At client', color: '#0F4C81', bg: '#E0F2FE' },
  en_route: { label: 'En route', color: '#7C3AED', bg: '#EDE9FE' },
  scheduled: { label: 'Scheduled', color: '#6B7280', bg: '#F3F4F6' },
  missed: { label: 'Missed', color: '#DC2626', bg: '#FDECEC' },
}

interface Visit {
  id: string
  label: string
  person_name: string
  person_address: string | null
  assigned_staff_id: string | null
  carer_name: string | null
  status: string
  scheduled_start: string
  scheduled_end: string
  package_name: string | null
}

interface Staff {
  id: string
  first_name: string
  last_name: string
}

export default function CallAssignmentBoard() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [assigningVisit, setAssigningVisit] = useState<string | null>(null)
  const [selectedCarer, setSelectedCarer] = useState('')
  const qc = useQueryClient()

  const nextDate = new Date(new Date(date).getTime() + 86400000).toISOString().slice(0, 10)

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ['homecare-visits-assign', date],
    queryFn: () => api.get('/homecare/visits', { params: { from: date, to: nextDate } }).then(r => Array.isArray(r.data) ? r.data : []),
  })

  const { data: staff = [] } = useQuery({
    queryKey: ['homecare-staff'],
    queryFn: () => api.get('/homecare/staff').then(r => Array.isArray(r.data) ? r.data : []),
  })

  const assignVisit = useMutation({
    mutationFn: ({ visitId, staffId }: { visitId: string; staffId: string | null }) =>
      api.patch(`/homecare/visits/${visitId}`, { assigned_staff_id: staffId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['homecare-visits-assign'] })
      qc.invalidateQueries({ queryKey: ['homecare-live-map'] })
      setAssigningVisit(null)
      setSelectedCarer('')
    },
    onError: (e: any) => alert(e.response?.data?.message || 'Could not assign call'),
  })

  const unassigned = visits.filter((v: any) => !v.assigned_staff_id && v.status === 'scheduled')
  const assigned = visits.filter((v: any) => v.assigned_staff_id && ['scheduled', 'en_route', 'checked_in'].includes(v.status))

  // Group assigned visits by carer
  const carerMap = new Map<string, { name: string; visits: Visit[] }>()
  for (const v of assigned) {
    const key = v.assigned_staff_id!
    const name = v.carer_name || 'Unknown'
    if (!carerMap.has(key)) carerMap.set(key, { name, visits: [] })
    carerMap.get(key)!.visits.push(v)
  }
  const carers = Array.from(carerMap.entries()).sort((a, b) => b[1].visits.length - a[1].visits.length)

  // Carers with no calls today
  const assignedIds = new Set(assigned.map((v: any) => v.assigned_staff_id))
  const idleCarers = staff.filter((s: Staff) => !assignedIds.has(s.id))

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Call Assignment Board</Typography>
          <Typography variant="body2" sx={{ color: '#6B7280', mt: 0.5 }}>Assign carers to today's calls and see workload at a glance</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button size="small" onClick={() => { const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d.toISOString().slice(0, 10)) }} sx={{ minWidth: 'auto' }}>←</Button>
          <Chip label={`${dateStr(date)} — ${visits.length} calls`} sx={{ fontWeight: 700, bgcolor: '#0F4C81', color: 'white' }} onClick={() => setDate(new Date().toISOString().slice(0, 10))} />
          <Button size="small" onClick={() => { const d = new Date(date); d.setDate(d.getDate() + 1); setDate(d.toISOString().slice(0, 10)) }} sx={{ minWidth: 'auto' }}>→</Button>
        </Stack>
      </Stack>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3}>
          {/* Unassigned calls column */}
          <Paper elevation={0} sx={{ p: 3, flex: '0 0 320px', border: '1px solid #E5E7EB', borderRadius: 2, borderLeft: '4px solid #D97706' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#D97706' }}>Unassigned calls</Typography>
              <Chip label={unassigned.length} size="small" sx={{ bgcolor: unassigned.length > 0 ? '#FFF5D9' : '#F3F4F6', color: unassigned.length > 0 ? '#D97706' : '#9CA3AF', fontWeight: 700 }} />
            </Stack>
            {unassigned.length === 0 ? (
              <Typography variant="body2" sx={{ color: '#6B7280', py: 3, textAlign: 'center' }}>All calls are assigned</Typography>
            ) : (
              <Stack spacing={1}>
                {unassigned.map((v: any) => (
                  <Paper key={v.id} elevation={0} sx={{ p: 1.5, border: '1px solid #E5E7EB', borderRadius: 1.5, cursor: 'pointer', '&:hover': { borderColor: '#0F4C81' } }} onClick={() => { setAssigningVisit(v.id); setSelectedCarer('') }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{v.person_name}</Typography>
                        <Typography variant="caption" sx={{ color: '#6B7280' }}>{time(v.scheduled_start)} - {time(v.scheduled_end)}</Typography>
                        <Typography variant="caption" sx={{ color: '#9CA3AF', display: 'block' }}>{v.label}</Typography>
                      </Box>
                    </Stack>
                    {assigningVisit === v.id && (
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="center">
                        <TextField select size="small" value={selectedCarer} onChange={e => setSelectedCarer(e.target.value)} sx={{ flex: 1, minWidth: 0 }}>
                          <MenuItem value="">Select carer</MenuItem>
                          {staff.map((s: Staff) => <MenuItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</MenuItem>)}
                        </TextField>
                        <Button size="small" variant="contained" disabled={!selectedCarer} onClick={() => assignVisit.mutate({ visitId: v.id, staffId: selectedCarer })} sx={{ textTransform: 'none', bgcolor: '#0F4C81' }}>
                          {assignVisit.isPending ? <CircularProgress size={16} color="inherit" /> : 'Assign'}
                        </Button>
                        <Button size="small" onClick={() => setAssigningVisit(null)} sx={{ minWidth: 'auto' }}>×</Button>
                      </Stack>
                    )}
                  </Paper>
                ))}
              </Stack>
            )}

            {idleCarers.length > 0 && (
              <>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#6B7280', mt: 3, mb: 1 }}>Available carers</Typography>
                <Stack spacing={0.5}>
                  {idleCarers.map((s: Staff) => (
                    <Box key={s.id} sx={{ py: 0.5, px: 1, bgcolor: '#F8FAFC', borderRadius: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.first_name} {s.last_name}</Typography>
                      <Typography variant="caption" sx={{ color: '#10b981' }}>No calls today</Typography>
                    </Box>
                  ))}
                </Stack>
              </>
            )}
          </Paper>

          {/* Carer workload columns */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Carer workload</Typography>
            {carers.length === 0 ? (
              <Paper elevation={0} sx={{ p: 6, textAlign: 'center', border: '1px solid #E5E7EB', borderRadius: 2 }}>
                <Typography sx={{ color: '#6B7280' }}>No assigned calls for this day</Typography>
                <Typography variant="caption" sx={{ color: '#9CA3AF' }}>Click an unassigned call to assign a carer</Typography>
              </Paper>
            ) : (
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                {carers.map(([carerId, { name, visits: carerVisits }]) => (
                  <Paper key={carerId} elevation={0} sx={{ p: 2, flex: '1 1 280px', minWidth: 280, border: '1px solid #E5E7EB', borderRadius: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{name}</Typography>
                      <Chip label={`${carerVisits.length} calls`} size="small" sx={{ bgcolor: '#E0F2FE', color: '#0F4C81', fontWeight: 600, height: 20, fontSize: '0.65rem' }} />
                    </Stack>
                    <Stack spacing={0.5}>
                      {carerVisits.sort((a: any, b: any) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()).map((v: any) => {
                        const cfg = statusConfig[v.status] || statusConfig.scheduled
                        return (
                          <Stack key={v.id} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.75, px: 1, bgcolor: '#F8FAFC', borderRadius: 1 }}>
                            <Box>
                              <Stack direction="row" alignItems="center" gap={0.5}>
                                <Typography variant="caption" sx={{ fontWeight: 600, color: '#0F4C81' }}>{time(v.scheduled_start)}</Typography>
                                <Typography variant="caption" sx={{ fontWeight: 600 }}>{v.person_name}</Typography>
                              </Stack>
                              <Typography variant="caption" sx={{ color: '#6B7280', display: 'block' }}>{v.label}</Typography>
                            </Box>
                            <Chip label={cfg.label} size="small" sx={{ bgcolor: cfg.bg, color: cfg.color, height: 18, fontSize: '0.6rem', fontWeight: 600 }} />
                          </Stack>
                        )
                      })}
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Box>
        </Stack>
      )}
    </Box>
  )
}
