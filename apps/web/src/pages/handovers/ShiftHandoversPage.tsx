import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tabs,
  Tab,
  TextField,
  Typography,
} from '@mui/material'
import {
  AccessTime as WaitingIcon,
  Add as AddIcon,
  AssignmentTurnedIn as CheckedIcon,
  DescriptionOutlined as HandoverIcon,
  FavoriteBorder as HeartIcon,
  MedicationOutlined as MedicationIcon,
  WarningAmberOutlined as WarningIcon,
} from '@mui/icons-material'
import api from '../../services/api'
import PageContainer from '../../components/design/PageContainer'
import { P } from '../../styles/tokens'

const NAVY = P.primary
const INK = P.navy
const MUTED = P.slate
const HAIRLINE = P.hairline

const GAPS_DAYS = 7

function formatShiftDate(iso?: string) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(iso?: string) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export default function ShiftHandoversPage() {
  const [tab, setTab] = useState(0)
  const [locationId, setLocationId] = useState('all')
  const [writeOpen, setWriteOpen] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}')
    } catch {
      return {}
    }
  }, [])
  const canVerify = currentUser.role === 'ORG_ADMIN' || currentUser.role === 'MANAGER'

  const { data: locationsData } = useQuery({
    queryKey: ['settings-locations'],
    queryFn: async () => (await api.get('/settings/locations')).data as any[],
  })
  const locations: any[] = Array.isArray(locationsData) ? locationsData : []

  const { data: handoversData, isLoading: handoversLoading } = useQuery({
    queryKey: ['shift-handovers', locationId],
    queryFn: async () => (await api.get(`/shifts/handovers?days=${GAPS_DAYS}${locationId !== 'all' ? `&locationId=${locationId}` : ''}`)).data as any[],
  })
  const handovers: any[] = Array.isArray(handoversData) ? handoversData : []

  const { data: gapsData } = useQuery({
    queryKey: ['mission-control-handover-gaps'],
    queryFn: async () => (await api.get(`/mission-control/handover-gaps?days=${GAPS_DAYS}`)).data as any,
  })
  const gaps: any[] = useMemo(() => {
    const shifts = Array.isArray(gapsData?.shifts) ? gapsData.shifts : []
    return locationId === 'all' ? shifts : shifts.filter((s: any) => s.location_id === locationId)
  }, [gapsData, locationId])

  const toCheck = useMemo(() => handovers.filter((h: any) => !h.checked_at), [handovers])
  const checked = useMemo(
    () => handovers.filter((h: any) => h.checked_at).sort((a: any, b: any) => +new Date(b.checked_at) - +new Date(a.checked_at)),
    [handovers],
  )
  const waiting24h = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    return toCheck.filter((h: any) => new Date(h.recorded_at).getTime() >= cutoff).length
  }, [toCheck])

  const checkMutation = useMutation({
    mutationFn: (shiftId: string) => api.post(`/shifts/${shiftId}/handover/check`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-handovers'] })
    },
    onError: (err: any) => setError(err.response?.data?.message || 'Could not mark the handover as checked.'),
  })

  const openOnRota = (handover: any) => {
    const week = (handover.shift_start_time || '').slice(0, 10)
    navigate(`/scheduling?week=${week}&shift=${handover.shift_id}`)
  }

  const rows = tab === 0 ? toCheck : tab === 1 ? checked : handovers

  return (
    <PageContainer>
      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}

      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} gap={2} sx={{ mb: 3 }}>
        <Box>
          <Typography sx={{ color: NAVY, fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.13em', textTransform: 'uppercase', mb: 1 }}>
            Compliance &amp; safety / Shift handovers
          </Typography>
          <Typography variant="h4" sx={{ color: INK, fontWeight: 600, letterSpacing: '-0.03em', mb: 0.75 }}>
            Shift handovers
          </Typography>
          <Typography sx={{ color: MUTED, maxWidth: 660 }}>
            What each shift passes on to the next — checked by a senior before it&rsquo;s closed.
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ width: { xs: '100%', md: 'auto' } }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Location</InputLabel>
            <Select value={locationId} label="Location" onChange={(event) => setLocationId(event.target.value)}>
              <MenuItem value="all">All locations</MenuItem>
              {locations.map((location: any) => <MenuItem key={location.id} value={location.id}>{location.name}</MenuItem>)}
            </Select>
          </FormControl>
          {canVerify && <Button variant="contained" startIcon={<AddIcon />} onClick={() => setWriteOpen(true)} sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>
            Write a handover
          </Button>}
        </Stack>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={4} md={4}>
          <Paper variant="outlined" sx={{ p: 2, borderColor: HAIRLINE, borderRadius: 2, position: 'relative' }}>
            <Box sx={{ position: 'absolute', top: 12, right: 12, width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', color: NAVY, bgcolor: 'notice.info.bg' }}>
              <WaitingIcon />
            </Box>
            <Typography sx={{ color: MUTED, fontSize: '0.78rem', fontWeight: 600 }}>Waiting to be checked</Typography>
            <Typography sx={{ color: INK, fontSize: '1.7rem', lineHeight: 1.2, fontWeight: 700 }}>{waiting24h}</Typography>
            <Typography sx={{ color: MUTED, fontSize: '0.78rem' }}>From the last 24 hours</Typography>
          </Paper>
        </Grid>
        <Grid item xs={4} md={4}>
          <Paper variant="outlined" sx={{ p: 2, borderColor: HAIRLINE, borderRadius: 2, position: 'relative' }}>
            <Box sx={{ position: 'absolute', top: 12, right: 12, width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', color: NAVY, bgcolor: 'notice.info.bg' }}>
              <CheckedIcon />
            </Box>
            <Typography sx={{ color: MUTED, fontSize: '0.78rem', fontWeight: 600 }}>Checked this week</Typography>
            <Typography sx={{ color: INK, fontSize: '1.7rem', lineHeight: 1.2, fontWeight: 700 }}>{checked.length}</Typography>
            <Typography sx={{ color: MUTED, fontSize: '0.78rem' }}>By a senior</Typography>
          </Paper>
        </Grid>
        <Grid item xs={4} md={4}>
          <Paper variant="outlined" sx={{ p: 2, borderColor: HAIRLINE, borderRadius: 2, position: 'relative' }}>
            <Box sx={{ position: 'absolute', top: 12, right: 12, width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', color: gaps.length ? 'notice.warning.fg' : NAVY, bgcolor: gaps.length ? 'notice.warning.bg' : 'notice.info.bg' }}>
              <WarningIcon />
            </Box>
            <Typography sx={{ color: MUTED, fontSize: '0.78rem', fontWeight: 600 }}>Shifts without a handover</Typography>
            <Typography sx={{ color: gaps.length ? 'notice.warning.fg' : INK, fontSize: '1.7rem', lineHeight: 1.2, fontWeight: 700 }}>{gaps.length}</Typography>
            <Typography sx={{ color: MUTED, fontSize: '0.78rem' }}>{gaps.length === 0 ? 'Every shift recorded one' : `Ended in the last ${GAPS_DAYS} days`}</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Paper variant="outlined" sx={{ borderColor: HAIRLINE, borderRadius: 2, overflow: 'hidden', mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 1, borderBottom: `1px solid ${HAIRLINE}` }}>
          {[
            { label: 'To check', count: toCheck.length },
            { label: 'Checked', count: checked.length },
            { label: 'All', count: handovers.length },
          ].map((item, index) => (
            <Tab
              key={item.label}
              label={<Stack direction="row" spacing={1} alignItems="center"><span>{item.label}</span><Chip label={item.count} size="small" sx={{ bgcolor: tab === index ? 'notice.info.bg' : 'notice.muted.bg', color: tab === index ? 'notice.info.fg' : MUTED, fontWeight: 700, height: 22 }} /></Stack>}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            />
          ))}
        </Tabs>

        {handoversLoading ? (
          <Box sx={{ p: 6, display: 'grid', placeItems: 'center' }}><CircularProgress sx={{ color: NAVY }} /></Box>
        ) : rows.length === 0 ? (
          <Box sx={{ p: { xs: 5, md: 7 }, textAlign: 'center' }}>
            <Box sx={{ width: 56, height: 56, borderRadius: '50%', display: 'inline-grid', placeItems: 'center', color: NAVY, bgcolor: 'notice.info.bg', mb: 2 }}>
              <HandoverIcon fontSize="large" />
            </Box>
            <Typography sx={{ color: INK, fontWeight: 700, fontSize: '1.02rem', mb: 1 }}>
              {tab === 0 ? 'No handovers to check yet' : tab === 1 ? 'Nothing checked yet' : 'No handovers recorded yet'}
            </Typography>
            <Typography sx={{ color: MUTED, mb: 2.5, maxWidth: 460, mx: 'auto' }}>
              When a shift ends, the team writes a short handover here. A senior checks it before the next shift starts.
            </Typography>
            {canVerify && <Button variant="contained" onClick={() => setWriteOpen(true)} sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 600 }}>
              Write a handover
            </Button>}
          </Box>
        ) : (
          <Box>
            {rows.map((handover: any, index: number) => (
              <Box
                key={handover.id}
                onClick={() => openOnRota(handover)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openOnRota(handover) } }}
                role="button"
                tabIndex={0}
                sx={{
                  width: '100%', border: 0, borderBottom: index < rows.length - 1 ? `1px solid ${HAIRLINE}` : 0,
                  bgcolor: 'background.paper', p: 2, textAlign: 'left', cursor: 'pointer',
                  display: 'flex', gap: 1.5, alignItems: 'flex-start', justifyContent: 'space-between',
                  '&:hover': { bgcolor: 'notice.subtle.bg' },
                }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
                    <Typography sx={{ color: INK, fontWeight: 700 }}>
                      {formatShiftDate(handover.shift_start_time)}{handover.shift_end_time ? ` · ${formatTime(handover.shift_start_time)}–${formatTime(handover.shift_end_time)}` : ''}
                    </Typography>
                    <Chip
                      label={handover.checked_at ? 'Checked' : 'To check'}
                      size="small"
                      sx={handover.checked_at
                        ? { color: 'notice.success.fg', bgcolor: 'notice.success.bg', fontWeight: 600, fontSize: '0.7rem' }
                        : { color: 'notice.warning.fg', bgcolor: 'notice.warning.bg', fontWeight: 600, fontSize: '0.7rem' }}
                    />
                  </Stack>
                  <Typography sx={{ color: MUTED, fontSize: '0.8rem', mt: 0.5 }}>
                    {handover.location_name} · by {handover.author_name}
                    {handover.checked_at ? ` · checked by ${handover.checked_by_name || 'a senior'} ${formatShiftDate(handover.checked_at)}` : ''}
                    {handover.acknowledgement_count > 0 ? ` · read by ${handover.acknowledgement_count}` : ''}
                  </Typography>
                  <Typography sx={{ color: INK, fontSize: '0.86rem', mt: 0.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {handover.what_happened}
                  </Typography>
                </Box>
                {canVerify && !handover.checked_at && (
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={checkMutation.isPending}
                    onClick={(e) => { e.stopPropagation(); checkMutation.mutate(handover.shift_id) }}
                    sx={{ borderColor: NAVY, color: NAVY, textTransform: 'none', fontWeight: 600, flexShrink: 0, mt: 0.25 }}
                  >
                    Mark checked
                  </Button>
                )}
              </Box>
            ))}
          </Box>
        )}
      </Paper>

      {gaps.length > 0 && (
        <Paper variant="outlined" sx={{ borderColor: HAIRLINE, borderRadius: 2, overflow: 'hidden', mb: 3 }}>
          <Box sx={{ p: { xs: 2, md: 2.5 }, pb: 1 }}>
            <Typography sx={{ color: INK, fontWeight: 700, fontSize: '1.05rem' }}>Shifts without a handover</Typography>
            <Typography sx={{ color: MUTED, fontSize: '0.82rem' }}>Ended shifts with staff on them and nothing recorded — write the handover or open the shift on the rota</Typography>
          </Box>
          {gaps.map((gap: any) => (
            <Box
              key={gap.shift_id}
              onClick={() => navigate(`/scheduling?week=${(gap.start_time || '').slice(0, 10)}&shift=${gap.shift_id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/scheduling?week=${(gap.start_time || '').slice(0, 10)}&shift=${gap.shift_id}`) }}
              sx={{
                width: '100%', border: 0, borderTop: `1px solid ${HAIRLINE}`, bgcolor: 'background.paper',
                p: 2, textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 1.5, alignItems: 'center',
                justifyContent: 'space-between', '&:hover': { bgcolor: 'notice.subtle.bg' },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ color: INK, fontWeight: 700 }}>
                  {formatShiftDate(gap.start_time)}{gap.end_time ? ` · ${formatTime(gap.start_time)}–${formatTime(gap.end_time)}` : ''}
                </Typography>
                <Typography sx={{ color: MUTED, fontSize: '0.8rem' }}>
                  {gap.location_name} · {(gap.rostered || []).map((r: any) => r.name).filter(Boolean).join(', ') || 'Staff were rostered'}
                </Typography>
              </Box>
              <Chip label={gap.staff_notified ? 'Team nudged' : 'No handover'} size="small" sx={{ color: 'notice.warning.fg', bgcolor: 'notice.warning.bg', fontWeight: 600, fontSize: '0.7rem', flexShrink: 0 }} />
            </Box>
          ))}
        </Paper>
      )}

      <Paper variant="outlined" sx={{ borderColor: HAIRLINE, borderRadius: 2, p: { xs: 2, md: 2.5 } }}>
        <Typography sx={{ color: INK, fontWeight: 700, fontSize: '1.05rem', mb: 1.5 }}>What a good handover covers</Typography>
        {[
          { icon: <HeartIcon />, title: 'How each person’s day went', text: 'Mood, meals, activities and anything unusual.' },
          { icon: <MedicationIcon />, title: 'Medication given or missed', text: 'With the reason for anything not given.' },
          { icon: <WarningIcon />, title: 'Incidents and follow-ups', text: 'Anything the next shift needs to act on.' },
        ].map((item, index) => (
          <Stack key={item.title} direction="row" spacing={1.5} alignItems="flex-start" sx={{ py: 1.5, borderTop: index === 0 ? 0 : `1px solid ${HAIRLINE}` }}>
            <Box sx={{ width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', color: NAVY, bgcolor: 'notice.info.bg', flexShrink: 0 }}>
              {item.icon}
            </Box>
            <Box>
              <Typography sx={{ color: INK, fontWeight: 700 }}>{item.title}</Typography>
              <Typography sx={{ color: MUTED, fontSize: '0.84rem' }}>{item.text}</Typography>
            </Box>
          </Stack>
        ))}
      </Paper>

      {canVerify && (
        <WriteHandoverDialog
          open={writeOpen}
          gaps={gaps}
          onClose={() => setWriteOpen(false)}
          onWritten={() => {
            setWriteOpen(false)
            queryClient.invalidateQueries({ queryKey: ['shift-handovers'] })
            queryClient.invalidateQueries({ queryKey: ['mission-control-handover-gaps'] })
          }}
          onError={(message: string) => setError(message)}
        />
      )}
    </PageContainer>
  )
}

function WriteHandoverDialog({ open, gaps, onClose, onWritten, onError }: {
  open: boolean; gaps: any[]; onClose: () => void; onWritten: () => void; onError: (message: string) => void;
}) {
  const [shiftId, setShiftId] = useState('')
  const [whatHappened, setWhatHappened] = useState('')
  const [outstanding, setOutstanding] = useState('')
  const [whoIsAware, setWhoIsAware] = useState('')

  const reset = () => { setShiftId(''); setWhatHappened(''); setOutstanding(''); setWhoIsAware('') }

  const saveMutation = useMutation({
    mutationFn: () => api.post(`/shifts/${shiftId}/handover`, {
      what_happened: whatHappened.trim(),
      outstanding: outstanding.trim() || null,
      who_is_aware: whoIsAware.trim() || null,
    }),
    onSuccess: () => { reset(); onWritten() },
    onError: (err: any) => onError(err.response?.data?.message || 'Could not save the handover.'),
  })

  return (
    <Dialog open={open} onClose={() => { reset(); onClose() }} maxWidth="sm" fullWidth>
      <DialogTitle>Write a handover</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Shift</InputLabel>
            <Select value={shiftId} label="Shift" onChange={(e) => setShiftId(e.target.value)}>
              {gaps.length === 0 && <MenuItem value="" disabled>No ended shifts are waiting for a handover</MenuItem>}
              {gaps.map((gap: any) => (
                <MenuItem key={gap.shift_id} value={gap.shift_id}>
                  {formatShiftDate(gap.start_time)}{gap.end_time ? ` · ${formatTime(gap.start_time)}–${formatTime(gap.end_time)}` : ''} · {gap.location_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="What happened during the shift" multiline minRows={3} required value={whatHappened} onChange={(e) => setWhatHappened(e.target.value)} helperText="How each person's day went — mood, meals, activities, anything unusual." />
          <TextField label="Outstanding and follow-ups" multiline minRows={2} value={outstanding} onChange={(e) => setOutstanding(e.target.value)} helperText="Anything the next shift needs to act on." />
          <TextField label="Who is aware" value={whoIsAware} onChange={(e) => setWhoIsAware(e.target.value)} helperText="Medication given or missed, with the reason for anything not given." />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => { reset(); onClose() }} sx={{ textTransform: 'none' }}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!shiftId || !whatHappened.trim() || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          sx={{ bgcolor: NAVY, textTransform: 'none' }}
        >
          {saveMutation.isPending ? <CircularProgress size={20} /> : 'Save handover'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
