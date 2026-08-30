import { useState } from 'react'
import { Box, Typography, Paper, Stack, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Chip, IconButton, CircularProgress, Rating, FormControlLabel, Switch } from '@mui/material'
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, Close as CloseIcon, Bedtime as BedtimeIcon, LightMode as WakeIcon } from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { SectionHeader, ConfirmDialog, EmptyRow } from '../../components/ui'

const today = () => new Date().toISOString().split('T')[0]

const QUALITY_LABELS: Record<number, string> = {
  1: 'Very poor',
  2: 'Poor',
  3: 'Fair',
  4: 'Good',
  5: 'Excellent',
}

const QUALITY_COLORS: Record<number, string> = {
  1: '#DC2626',
  2: '#EA580C',
  3: '#D97706',
  4: '#16A34A',
  5: '#059669',
}

function formatDuration(bedtime: string, wakeTime: string): string {
  if (!bedtime || !wakeTime) return ''
  const [bh, bm] = bedtime.split(':').map(Number)
  const [wh, wm] = wakeTime.split(':').map(Number)
  let bedMin = bh * 60 + bm
  let wakeMin = wh * 60 + wm
  if (wakeMin <= bedMin) wakeMin += 24 * 60
  const diff = wakeMin - bedMin
  const h = Math.floor(diff / 60)
  const m = diff % 60
  return `${h}h ${m}m`
}

function useDeleteConfirm() {
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null)
  return { deleteTarget, setDeleteTarget }
}

function SleepViewDialog({ open, onClose, record }: { open: boolean; onClose: () => void; record: any }) {
  if (!record) return null
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center' }}>
        <BedtimeIcon sx={{ mr: 1, color: '#0F4C81' }} />
        Sleep Record
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={2}>
            <Chip label={new Date(record.record_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} size="small" variant="outlined" />
            <Chip label={QUALITY_LABELS[record.sleep_quality]} size="small" sx={{ bgcolor: `${QUALITY_COLORS[record.sleep_quality]}15`, color: QUALITY_COLORS[record.sleep_quality], fontWeight: 700 }} />
          </Stack>
          <Stack direction="row" spacing={3}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="#6B7280">Bedtime</Typography>
              <Typography variant="body1" fontWeight={700}>{record.bedtime?.slice(0, 5)}</Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="#6B7280">Wake time</Typography>
              <Typography variant="body1" fontWeight={700}>{record.wake_time?.slice(0, 5)}</Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="#6B7280">Duration</Typography>
              <Typography variant="body1" fontWeight={700}>{formatDuration(record.bedtime, record.wake_time)}</Typography>
            </Box>
          </Stack>
          {record.night_disturbances && (
            <Paper sx={{ p: 2, bgcolor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} color="#DC2626" sx={{ mb: 0.5 }}>Night disturbances: {record.disturbance_count || 0}</Typography>
              {record.disturbance_reasons && <Typography variant="body2" color="#991B1B">{record.disturbance_reasons}</Typography>}
            </Paper>
          )}
          {record.notes && (
            <Box>
              <Typography variant="caption" color="#6B7280">Notes</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{record.notes}</Typography>
            </Box>
          )}
          <Typography variant="caption" color="#9CA3AF">
            Recorded by {record.recorded_by_name || '—'}{record.created_at ? ` on ${new Date(record.created_at).toLocaleString('en-GB')}` : ''}
          </Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  )
}

export default function SleepTab({ personId }: { personId: string }) {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [viewRecord, setViewRecord] = useState<any>(null)
  const { deleteTarget, setDeleteTarget } = useDeleteConfirm()
  const [form, setForm] = useState({
    record_date: today(),
    bedtime: '22:00',
    wake_time: '07:00',
    sleep_quality: 3,
    night_disturbances: false,
    disturbance_count: 0,
    disturbance_reasons: '',
    notes: '',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['health-sleep', personId],
    queryFn: () => api.get(`/health/${personId}/sleep`).then(r => r.data),
  })

  const addMut = useMutation({
    mutationFn: (d: any) => api.post(`/health/${personId}/sleep`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['health-sleep', personId] })
      setAddOpen(false)
      setEditId(null)
      setForm({ record_date: today(), bedtime: '22:00', wake_time: '07:00', sleep_quality: 3, night_disturbances: false, disturbance_count: 0, disturbance_reasons: '', notes: '' })
    },
  })

  const updMut = useMutation({
    mutationFn: ({ id, d }: { id: string; d: any }) => api.patch(`/health/${personId}/sleep/${id}`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['health-sleep', personId] })
      setAddOpen(false)
      setEditId(null)
      setForm({ record_date: today(), bedtime: '22:00', wake_time: '07:00', sleep_quality: 3, night_disturbances: false, disturbance_count: 0, disturbance_reasons: '', notes: '' })
    },
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api.delete(`/health/${personId}/sleep/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['health-sleep', personId] })
      setDeleteTarget(null)
    },
  })

  if (isLoading) return <Box sx={{ py: 3 }}><CircularProgress size={24} /></Box>

  // Calculate average quality
  const records = data || []
  const avgQuality = records.length > 0 ? (records.reduce((s: number, r: any) => s + r.sleep_quality, 0) / records.length).toFixed(1) : null

  return (
    <Box>
      <SectionHeader
        title="Sleep Tracker"
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            {avgQuality && (
              <Chip label={`Avg quality: ${avgQuality}/5`} size="small" sx={{ bgcolor: '#E7EEF4', color: '#0F4C81', fontWeight: 700 }} />
            )}
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)} sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
              Log Sleep
            </Button>
          </Stack>
        }
      />

      {records.length === 0 ? (
        <EmptyRow message="No sleep records yet" />
      ) : (
        <Stack spacing={1.5}>
          {records.map((r: any) => (
            <Paper
              key={r.id}
              onClick={() => setViewRecord(r)}
              sx={{
                p: 2, borderRadius: 2, border: '1px solid #E5E7EB',
                borderLeft: 4, borderLeftColor: QUALITY_COLORS[r.sleep_quality] || '#D97706',
                cursor: 'pointer',
                '&:hover': { borderColor: '#0F4C81', boxShadow: 1 },
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                  <Chip
                    label={new Date(r.record_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                    size="small"
                    variant="outlined"
                    sx={{ fontWeight: 600 }}
                  />
                  <Stack direction="row" spacing={1} alignItems="center">
                    <BedtimeIcon sx={{ fontSize: 16, color: '#6366F1' }} />
                    <Typography variant="body2" fontWeight={700}>{r.bedtime?.slice(0, 5)}</Typography>
                  </Stack>
                  <Typography variant="body2" color="#9CA3AF">→</Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <WakeIcon sx={{ fontSize: 16, color: '#F59E0B' }} />
                    <Typography variant="body2" fontWeight={700}>{r.wake_time?.slice(0, 5)}</Typography>
                  </Stack>
                  <Chip
                    label={formatDuration(r.bedtime, r.wake_time)}
                    size="small"
                    sx={{ bgcolor: '#F3F4F6', fontWeight: 700 }}
                  />
                  <Chip
                    label={`${QUALITY_LABELS[r.sleep_quality]} (${r.sleep_quality}/5)`}
                    size="small"
                    sx={{ bgcolor: `${QUALITY_COLORS[r.sleep_quality]}15`, color: QUALITY_COLORS[r.sleep_quality], fontWeight: 700 }}
                  />
                  {r.night_disturbances && (
                    <Chip
                      label={`${r.disturbance_count || 1} disturbance${(r.disturbance_count || 1) > 1 ? 's' : ''}`}
                      size="small"
                      color="warning"
                      variant="outlined"
                    />
                  )}
                </Stack>
                <Stack direction="row" spacing={0} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                  <IconButton size="small" onClick={() => {
                    setForm({
                      record_date: r.record_date?.split('T')[0] || r.record_date,
                      bedtime: r.bedtime || '22:00',
                      wake_time: r.wake_time || '07:00',
                      sleep_quality: r.sleep_quality || 3,
                      night_disturbances: r.night_disturbances || false,
                      disturbance_count: r.disturbance_count || 0,
                      disturbance_reasons: r.disturbance_reasons || '',
                      notes: r.notes || '',
                    })
                    setEditId(r.id)
                    setAddOpen(true)
                  }}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => setDeleteTarget({ id: r.id, label: 'this sleep record' })} color="error"><DeleteIcon fontSize="small" /></IconButton>
                </Stack>
              </Stack>
              {r.notes && <Typography variant="body2" sx={{ mt: 1, color: '#6B7280' }} noWrap>{r.notes}</Typography>}
            </Paper>
          ))}
        </Stack>
      )}

      <Dialog open={addOpen} onClose={() => { setAddOpen(false); setEditId(null) }} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => {
          e.preventDefault()
          if (editId) updMut.mutate({ id: editId, d: form })
          else addMut.mutate(form)
        }}>
          <DialogTitle sx={{ fontWeight: 800 }}>{editId ? 'Edit Sleep Record' : 'Log Sleep'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <TextField label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.record_date} onChange={e => setForm(f => ({ ...f, record_date: e.target.value }))} />

              <Stack direction="row" spacing={2}>
                <TextField label="Bedtime" type="time" fullWidth InputLabelProps={{ shrink: true }} value={form.bedtime} onChange={e => setForm(f => ({ ...f, bedtime: e.target.value }))} />
                <TextField label="Wake time" type="time" fullWidth InputLabelProps={{ shrink: true }} value={form.wake_time} onChange={e => setForm(f => ({ ...f, wake_time: e.target.value }))} />
              </Stack>

              {form.bedtime && form.wake_time && (
                <Paper sx={{ p: 1.5, bgcolor: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 2, textAlign: 'center' }}>
                  <Typography variant="body2" fontWeight={700} color="#0369A1">
                    Estimated sleep duration: {formatDuration(form.bedtime, form.wake_time)}
                  </Typography>
                </Paper>
              )}

              <Box>
                <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>Sleep Quality</Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Rating
                    value={form.sleep_quality}
                    onChange={(_, v) => setForm(f => ({ ...f, sleep_quality: v || 3 }))}
                    max={5}
                    sx={{ '& .MuiRating-iconFilled': { color: QUALITY_COLORS[form.sleep_quality] } }}
                  />
                  <Chip label={QUALITY_LABELS[form.sleep_quality]} size="small" sx={{ bgcolor: `${QUALITY_COLORS[form.sleep_quality]}15`, color: QUALITY_COLORS[form.sleep_quality], fontWeight: 700 }} />
                </Stack>
              </Box>

              <FormControlLabel
                control={<Switch checked={form.night_disturbances} onChange={e => setForm(f => ({ ...f, night_disturbances: e.target.checked }))} />}
                label={<Typography variant="body2" fontWeight={600}>Night disturbances</Typography>}
              />

              {form.night_disturbances && (
                <Stack direction="row" spacing={2}>
                  <TextField
                    label="Number of disturbances"
                    type="number"
                    fullWidth
                    value={form.disturbance_count}
                    onChange={e => setForm(f => ({ ...f, disturbance_count: Number(e.target.value) }))}
                    inputProps={{ min: 1 }}
                  />
                  <TextField
                    label="Reason (optional)"
                    fullWidth
                    value={form.disturbance_reasons}
                    onChange={e => setForm(f => ({ ...f, disturbance_reasons: e.target.value }))}
                    placeholder="e.g., toileting, agitation, pain"
                  />
                </Stack>
              )}

              <TextField label="Notes" fullWidth multiline rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g., slept well, restless, needed repositioning" />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => { setAddOpen(false); setEditId(null) }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addMut.isPending || updMut.isPending} sx={{ bgcolor: '#0F4C81' }}>
              {(addMut.isPending || updMut.isPending) ? <CircularProgress size={20} /> : (editId ? 'Save' : 'Log Sleep')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete sleep record?"
        message={<>This will permanently delete {deleteTarget?.label}. This action cannot be undone.</>}
        confirmLabel="Delete"
        danger
        loading={delMut.isPending}
        onConfirm={() => deleteTarget && delMut.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <SleepViewDialog open={!!viewRecord} onClose={() => setViewRecord(null)} record={viewRecord} />
    </Box>
  )
}
