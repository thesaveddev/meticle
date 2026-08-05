import { useState } from 'react'
import { Box, Typography, Paper, Stack, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Select, MenuItem, FormControl, InputLabel, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, CircularProgress } from '@mui/material'
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, MonitorHeart as MonitorHeartIcon, Waves as BowelIcon, Medication as DentalIcon, WaterDrop as FluidIcon } from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { SectionHeader, ConfirmDialog, EmptyRow } from '../../components/ui'

const BRISTOL_LABELS: Record<number, string> = { 1: 'Type 1: Separate hard lumps', 2: 'Type 2: Sausage-shaped but lumpy', 3: 'Type 3: Sausage-shaped with cracks', 4: 'Type 4: Smooth, soft sausage', 5: 'Type 5: Soft blobs with clear edges', 6: 'Type 6: Fluffy, mushy pieces', 7: 'Type 7: Watery, no solid pieces' }
const BRISTOL_COLORS: Record<number, string> = { 1: '#6B4226', 2: '#8B5E3C', 3: '#A0785A', 4: '#8FBC8F', 5: '#D4A76A', 6: '#D2B48C', 7: '#C4A882' }
const SEVERITY_COLORS: Record<string, string> = { normal: '#16A34A', mild: '#D97706', moderate: '#DC2626', severe: '#7C3AED' }

const today = () => new Date().toISOString().split('T')[0]

function useDeleteConfirm() {
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null)
  return { deleteTarget, setDeleteTarget }
}

function ObservationsSection({ personId }: { personId: string }) {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const { deleteTarget, setDeleteTarget } = useDeleteConfirm()
  const [form, setForm] = useState({ observation_date: today(), category: 'general', notes: '', severity: 'normal' })
  const { data, isLoading } = useQuery({ queryKey: ['health-obs', personId], queryFn: () => api.get(`/health/${personId}/observations`).then(r => r.data) })
  const addMut = useMutation({ mutationFn: (d: any) => api.post(`/health/${personId}/observations`, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['health-obs', personId] }); setAddOpen(false); setEditId(null); setForm({ observation_date: today(), category: 'general', notes: '', severity: 'normal' }) } })
  const updMut = useMutation({ mutationFn: ({ id, d }: { id: string; d: any }) => api.patch(`/health/${personId}/observations/${id}`, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['health-obs', personId] }); setAddOpen(false); setEditId(null); setForm({ observation_date: today(), category: 'general', notes: '', severity: 'normal' }) } })
  const delMut = useMutation({ mutationFn: (id: string) => api.delete(`/health/${personId}/observations/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['health-obs', personId] }); setDeleteTarget(null) } })

  if (isLoading) return <Box sx={{ py: 3 }}><CircularProgress size={24} /></Box>
  return (
    <Box>
      <SectionHeader
        title="Health Observations"
        icon={<MonitorHeartIcon sx={{ fontSize: 20 }} />}
        action={
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)} sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
            Add Observation
          </Button>
        }
      />
      {(!data || data.length === 0) ? (
        <EmptyRow message="No observations recorded" />
      ) : (
        <Stack spacing={1.5}>
          {data.map((o: any) => (
            <Paper key={o.id} sx={{ p: 2, borderRadius: 2, border: '1px solid #E5E7EB', borderLeft: 4, borderLeftColor: SEVERITY_COLORS[o.severity] || '#16A34A' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Chip label={o.category} size="small" sx={{ bgcolor: '#E7EEF4', color: '#0F4C81', fontWeight: 700, textTransform: 'capitalize' }} />
                  <Chip label={o.severity} size="small" sx={{ bgcolor: `${SEVERITY_COLORS[o.severity] || '#16A34A'}20`, color: SEVERITY_COLORS[o.severity] || '#16A34A', fontWeight: 700 }} />
                  <Typography variant="caption" color="#6B7280">{new Date(o.observation_date).toLocaleDateString('en-GB')}</Typography>
                  {o.recorded_by_name && <Typography variant="caption" color="#9CA3AF">by {o.recorded_by_name}</Typography>}
                </Stack>
                <Stack direction="row" spacing={0}>
                  <IconButton size="small" onClick={() => { setForm({ observation_date: o.observation_date?.split('T')[0] || o.observation_date, category: o.category, notes: o.notes || '', severity: o.severity }); setEditId(o.id); setAddOpen(true) }}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => setDeleteTarget({ id: o.id, label: 'this observation' })} color="error"><DeleteIcon fontSize="small" /></IconButton>
                </Stack>
              </Stack>
              {o.notes && <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>{o.notes}</Typography>}
            </Paper>
          ))}
        </Stack>
      )}
      <Dialog open={addOpen} onClose={() => { setAddOpen(false); setEditId(null) }} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (editId) updMut.mutate({ id: editId, d: form }); else addMut.mutate(form) }}>
          <DialogTitle sx={{ fontWeight: 800 }}>{editId ? 'Edit Observation' : 'Add Observation'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.observation_date} onChange={e => setForm(f => ({ ...f, observation_date: e.target.value }))} />
              <FormControl fullWidth><InputLabel>Category</InputLabel>
                <Select value={form.category} label="Category" onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {['general', 'skin', 'medication', 'sleep', 'pain', 'weight', 'other'].map(c => <MenuItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl fullWidth><InputLabel>Severity</InputLabel>
                <Select value={form.severity} label="Severity" onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
                  {['normal', 'mild', 'moderate', 'severe'].map(s => <MenuItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField label="Notes" fullWidth multiline rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}><Button onClick={() => { setAddOpen(false); setEditId(null) }}>Cancel</Button><Button type="submit" variant="contained" disabled={addMut.isPending || updMut.isPending} sx={{ bgcolor: '#0F4C81' }}>{(addMut.isPending || updMut.isPending) ? <CircularProgress size={20} /> : 'Save'}</Button></DialogActions>
        </Box>
      </Dialog>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete observation?"
        message={<>This will permanently delete {deleteTarget?.label}. This action cannot be undone.</>}
        confirmLabel="Delete"
        danger
        loading={delMut.isPending}
        onConfirm={() => deleteTarget && delMut.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </Box>
  )
}

function BowelSection({ personId }: { personId: string }) {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const { deleteTarget, setDeleteTarget } = useDeleteConfirm()
  const [form, setForm] = useState({ recorded_date: today(), recorded_time: '', bristol_type: 4, consistency: '', color: '', notes: '' })
  const { data, isLoading } = useQuery({ queryKey: ['health-bowel', personId], queryFn: () => api.get(`/health/${personId}/bowel`).then(r => r.data) })
  const addMut = useMutation({ mutationFn: (d: any) => api.post(`/health/${personId}/bowel`, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['health-bowel', personId] }); setAddOpen(false); setEditId(null); setForm({ recorded_date: today(), recorded_time: '', bristol_type: 4, consistency: '', color: '', notes: '' }) } })
  const updMut = useMutation({ mutationFn: ({ id, d }: { id: string; d: any }) => api.patch(`/health/${personId}/bowel/${id}`, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['health-bowel', personId] }); setAddOpen(false); setEditId(null); setForm({ recorded_date: today(), recorded_time: '', bristol_type: 4, consistency: '', color: '', notes: '' }) } })
  const delMut = useMutation({ mutationFn: (id: string) => api.delete(`/health/${personId}/bowel/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['health-bowel', personId] }); setDeleteTarget(null) } })

  if (isLoading) return <Box sx={{ py: 3 }}><CircularProgress size={24} /></Box>
  return (
    <Box>
      <SectionHeader
        title="Bowel Movements"
        icon={<BowelIcon sx={{ fontSize: 20 }} />}
        action={
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)} sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
            Record Movement
          </Button>
        }
      />
      {(!data || data.length === 0) ? (
        <EmptyRow message="No bowel movements recorded" />
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <Table size="small">
            <TableHead><TableRow><TableCell sx={{ fontWeight: 700 }}>Date/Time</TableCell><TableCell sx={{ fontWeight: 700 }}>Type</TableCell><TableCell sx={{ fontWeight: 700 }}>Consistency</TableCell><TableCell sx={{ fontWeight: 700 }}>Notes</TableCell><TableCell sx={{ fontWeight: 700 }} width={60}></TableCell></TableRow></TableHead>
            <TableBody>
              {data.map((b: any) => (
                <TableRow key={b.id}>
                  <TableCell>{new Date(b.recorded_date).toLocaleDateString('en-GB')}{b.recorded_time ? ` ${b.recorded_time.slice(0, 5)}` : ''}</TableCell>
                  <TableCell>
                    {b.bristol_type ? (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: BRISTOL_COLORS[b.bristol_type] || '#6B7280', display: 'inline-block', mr: 0.5 }} />
                        <Typography variant="caption">{BRISTOL_LABELS[b.bristol_type]?.split(':')[0] || `Type ${b.bristol_type}`}</Typography>
                      </Stack>
                    ) : '-'}
                  </TableCell>
                  <TableCell>{b.consistency || '-'}</TableCell>
                  <TableCell><Typography variant="body2" noWrap sx={{ maxWidth: 250 }}>{b.notes || '-'}</Typography></TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => { setForm({ recorded_date: b.recorded_date?.split('T')[0] || b.recorded_date, recorded_time: b.recorded_time || '', bristol_type: b.bristol_type || 4, consistency: b.consistency || '', color: b.color || '', notes: b.notes || '' }); setEditId(b.id); setAddOpen(true) }}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => setDeleteTarget({ id: b.id, label: 'this bowel movement' })} color="error"><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Dialog open={addOpen} onClose={() => { setAddOpen(false); setEditId(null) }} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (editId) updMut.mutate({ id: editId, d: form }); else addMut.mutate(form) }}>
          <DialogTitle sx={{ fontWeight: 800 }}>{editId ? 'Edit Bowel Movement' : 'Record Bowel Movement'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.recorded_date} onChange={e => setForm(f => ({ ...f, recorded_date: e.target.value }))} />
              <TextField label="Time" type="time" fullWidth InputLabelProps={{ shrink: true }} value={form.recorded_time} onChange={e => setForm(f => ({ ...f, recorded_time: e.target.value }))} />
              <FormControl fullWidth><InputLabel>Bristol Stool Type</InputLabel>
                <Select value={form.bristol_type} label="Bristol Stool Type" onChange={e => setForm(f => ({ ...f, bristol_type: Number(e.target.value) }))}>
                  {[1, 2, 3, 4, 5, 6, 7].map(t => (
                    <MenuItem key={t} value={t}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: BRISTOL_COLORS[t] }} />
                        <Typography variant="body2">{BRISTOL_LABELS[t]}</Typography>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField label="Consistency" fullWidth value={form.consistency} onChange={e => setForm(f => ({ ...f, consistency: e.target.value }))} placeholder="e.g., firm, soft, watery" />
              <TextField label="Color" fullWidth value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} placeholder="e.g., brown, green, black" />
              <TextField label="Notes" fullWidth multiline rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}><Button onClick={() => { setAddOpen(false); setEditId(null) }}>Cancel</Button><Button type="submit" variant="contained" disabled={addMut.isPending || updMut.isPending} sx={{ bgcolor: '#0F4C81' }}>{(addMut.isPending || updMut.isPending) ? <CircularProgress size={20} /> : (editId ? 'Save' : 'Record')}</Button></DialogActions>
        </Box>
      </Dialog>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete bowel movement?"
        message={<>This will permanently delete {deleteTarget?.label}. This action cannot be undone.</>}
        confirmLabel="Delete"
        danger
        loading={delMut.isPending}
        onConfirm={() => deleteTarget && delMut.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </Box>
  )
}

function DentalSection({ personId }: { personId: string }) {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const { deleteTarget, setDeleteTarget } = useDeleteConfirm()
  const [form, setForm] = useState({ checkup_date: today(), dentist_name: '', findings: '', actions_taken: '', next_checkup_date: '', notes: '' })
  const { data, isLoading } = useQuery({ queryKey: ['health-dental', personId], queryFn: () => api.get(`/health/${personId}/dental`).then(r => r.data) })
  const addMut = useMutation({ mutationFn: (d: any) => api.post(`/health/${personId}/dental`, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['health-dental', personId] }); setAddOpen(false); setEditId(null); setForm({ checkup_date: today(), dentist_name: '', findings: '', actions_taken: '', next_checkup_date: '', notes: '' }) } })
  const updMut = useMutation({ mutationFn: ({ id, d }: { id: string; d: any }) => api.patch(`/health/${personId}/dental/${id}`, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['health-dental', personId] }); setAddOpen(false); setEditId(null); setForm({ checkup_date: today(), dentist_name: '', findings: '', actions_taken: '', next_checkup_date: '', notes: '' }) } })
  const delMut = useMutation({ mutationFn: (id: string) => api.delete(`/health/${personId}/dental/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['health-dental', personId] }); setDeleteTarget(null) } })

  if (isLoading) return <Box sx={{ py: 3 }}><CircularProgress size={24} /></Box>
  return (
    <Box>
      <SectionHeader
        title="Dental Records"
        icon={<DentalIcon sx={{ fontSize: 20 }} />}
        action={
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)} sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
            Add Record
          </Button>
        }
      />
      {(!data || data.length === 0) ? (
        <EmptyRow message="No dental records" />
      ) : (
        <Stack spacing={1.5}>
          {data.map((r: any) => (
            <Paper key={r.id} sx={{ p: 2, borderRadius: 2, border: '1px solid #E5E7EB', borderLeft: 4, borderLeftColor: r.next_checkup_date && new Date(r.next_checkup_date) <= new Date(Date.now() + 30*86400000) ? '#D97706' : '#0F4C81' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="subtitle2" fontWeight={700}>{r.dentist_name || 'Dental Checkup'}</Typography>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                    <Chip label={new Date(r.checkup_date).toLocaleDateString('en-GB')} size="small" variant="outlined" />
                    {r.next_checkup_date && <Chip label={`Next: ${new Date(r.next_checkup_date).toLocaleDateString('en-GB')}`} size="small" color={new Date(r.next_checkup_date) <= new Date(Date.now() + 30*86400000) ? 'warning' : 'default'} variant="outlined" />}
                  </Stack>
                </Box>
                <Stack direction="row" spacing={0}>
                  <IconButton size="small" onClick={() => { setForm({ checkup_date: r.checkup_date?.split('T')[0] || r.checkup_date, dentist_name: r.dentist_name || '', findings: r.findings || '', actions_taken: r.actions_taken || '', next_checkup_date: r.next_checkup_date?.split('T')[0] || r.next_checkup_date || '', notes: r.notes || '' }); setEditId(r.id); setAddOpen(true) }}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => setDeleteTarget({ id: r.id, label: 'this dental record' })} color="error"><DeleteIcon fontSize="small" /></IconButton>
                </Stack>
              </Stack>
              {r.findings && <Typography variant="body2" sx={{ mt: 1, color: '#6B7280' }}><strong>Findings:</strong> {r.findings}</Typography>}
              {r.actions_taken && <Typography variant="body2" sx={{ color: '#6B7280' }}><strong>Actions:</strong> {r.actions_taken}</Typography>}
            </Paper>
          ))}
        </Stack>
      )}
      <Dialog open={addOpen} onClose={() => { setAddOpen(false); setEditId(null) }} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (editId) updMut.mutate({ id: editId, d: form }); else addMut.mutate(form) }}>
          <DialogTitle sx={{ fontWeight: 800 }}>{editId ? 'Edit Dental Record' : 'Add Dental Record'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Checkup Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.checkup_date} onChange={e => setForm(f => ({ ...f, checkup_date: e.target.value }))} />
              <TextField label="Dentist Name" fullWidth value={form.dentist_name} onChange={e => setForm(f => ({ ...f, dentist_name: e.target.value }))} />
              <TextField label="Findings" fullWidth multiline rows={2} value={form.findings} onChange={e => setForm(f => ({ ...f, findings: e.target.value }))} />
              <TextField label="Actions Taken" fullWidth multiline rows={2} value={form.actions_taken} onChange={e => setForm(f => ({ ...f, actions_taken: e.target.value }))} />
              <TextField label="Next Checkup Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.next_checkup_date} onChange={e => setForm(f => ({ ...f, next_checkup_date: e.target.value }))} />
              <TextField label="Notes" fullWidth multiline rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}><Button onClick={() => { setAddOpen(false); setEditId(null) }}>Cancel</Button><Button type="submit" variant="contained" disabled={addMut.isPending || updMut.isPending} sx={{ bgcolor: '#0F4C81' }}>{(addMut.isPending || updMut.isPending) ? <CircularProgress size={20} /> : 'Save'}</Button></DialogActions>
        </Box>
      </Dialog>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete dental record?"
        message={<>This will permanently delete {deleteTarget?.label}. This action cannot be undone.</>}
        confirmLabel="Delete"
        danger
        loading={delMut.isPending}
        onConfirm={() => deleteTarget && delMut.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </Box>
  )
}

function FluidSection({ personId }: { personId: string }) {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const { deleteTarget, setDeleteTarget } = useDeleteConfirm()
  const [date, setDate] = useState(today())
  const [form, setForm] = useState({ recorded_date: today(), recorded_time: '', amount_ml: 200, fluid_type: 'Water', notes: '' })
  const { data, isLoading } = useQuery({ queryKey: ['health-fluid', personId, date], queryFn: () => api.get(`/health/${personId}/fluid?date=${date}`).then(r => r.data) })
  const { data: total } = useQuery({ queryKey: ['health-fluid-total', personId, date], queryFn: () => api.get(`/health/${personId}/fluid/total?date=${date}`).then(r => r.data) })
  const addMut = useMutation({ mutationFn: (d: any) => api.post(`/health/${personId}/fluid`, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['health-fluid', personId] }); qc.invalidateQueries({ queryKey: ['health-fluid-total', personId] }); setAddOpen(false); setEditId(null); setForm({ recorded_date: today(), recorded_time: '', amount_ml: 200, fluid_type: 'Water', notes: '' }) } })
  const updMut = useMutation({ mutationFn: ({ id, d }: { id: string; d: any }) => api.patch(`/health/${personId}/fluid/${id}`, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['health-fluid', personId] }); qc.invalidateQueries({ queryKey: ['health-fluid-total', personId] }); setAddOpen(false); setEditId(null); setForm({ recorded_date: today(), recorded_time: '', amount_ml: 200, fluid_type: 'Water', notes: '' }) } })
  const delMut = useMutation({ mutationFn: (id: string) => api.delete(`/health/${personId}/fluid/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['health-fluid', personId] }); qc.invalidateQueries({ queryKey: ['health-fluid-total', personId] }); setDeleteTarget(null) } })

  if (isLoading) return <Box sx={{ py: 3 }}><CircularProgress size={24} /></Box>
  const totalMl = total?.total_ml || 0
  return (
    <Box>
      <SectionHeader
        title="Fluid Intake"
        icon={<FluidIcon sx={{ fontSize: 20 }} />}
        action={
          <Stack direction="row" spacing={1}>
            <TextField type="date" size="small" value={date} onChange={e => setDate(e.target.value)} sx={{ width: 160 }} />
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)} sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>Add Intake</Button>
          </Stack>
        }
      />
      <Paper sx={{ p: 2, mb: 2, borderRadius: 2, border: '1px solid #E5E7EB', bgcolor: '#F0F9FF' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" fontWeight={700}>Daily Total: <strong style={{ fontSize: '1.1rem', color: '#0F4C81' }}>{totalMl} ml</strong></Typography>
          <Box sx={{ width: 200, bgcolor: '#E5E7EB', borderRadius: 1, height: 8, overflow: 'hidden' }}>
            <Box sx={{ width: `${Math.min((totalMl / 2000) * 100, 100)}%`, bgcolor: totalMl >= 1500 ? '#16A34A' : totalMl >= 1000 ? '#D97706' : '#DC2626', height: 8, borderRadius: 1, transition: 'width 0.3s' }} />
          </Box>
          <Typography variant="caption" color="#6B7280">Target: 2000 ml</Typography>
        </Stack>
      </Paper>
      {(!data || data.length === 0) ? (
        <EmptyRow message="No fluid intake recorded for this date" />
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <Table size="small">
            <TableHead><TableRow><TableCell sx={{ fontWeight: 700 }}>Time</TableCell><TableCell sx={{ fontWeight: 700 }}>Type</TableCell><TableCell sx={{ fontWeight: 700 }}>Amount</TableCell><TableCell sx={{ fontWeight: 700 }}>Notes</TableCell><TableCell sx={{ fontWeight: 700 }} width={60}></TableCell></TableRow></TableHead>
            <TableBody>
              {data.map((f: any) => (
                <TableRow key={f.id}>
                  <TableCell>{f.recorded_time ? f.recorded_time.slice(0, 5) : '-'}</TableCell>
                  <TableCell><Chip label={f.fluid_type} size="small" sx={{ bgcolor: '#E7EEF4', color: '#0F4C81' }} /></TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{f.amount_ml} ml</TableCell>
                  <TableCell><Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>{f.notes || '-'}</Typography></TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => { setForm({ recorded_date: f.recorded_date?.split('T')[0] || f.recorded_date, recorded_time: f.recorded_time || '', amount_ml: f.amount_ml, fluid_type: f.fluid_type, notes: f.notes || '' }); setEditId(f.id); setAddOpen(true) }}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => setDeleteTarget({ id: f.id, label: 'this fluid intake entry' })} color="error"><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Dialog open={addOpen} onClose={() => { setAddOpen(false); setEditId(null) }} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (editId) updMut.mutate({ id: editId, d: form }); else addMut.mutate(form) }}>
          <DialogTitle sx={{ fontWeight: 800 }}>{editId ? 'Edit Fluid Intake' : 'Add Fluid Intake'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.recorded_date} onChange={e => setForm(f => ({ ...f, recorded_date: e.target.value }))} />
              <TextField label="Time" type="time" fullWidth InputLabelProps={{ shrink: true }} value={form.recorded_time} onChange={e => setForm(f => ({ ...f, recorded_time: e.target.value }))} />
              <TextField label="Amount (ml)" type="number" fullWidth value={form.amount_ml} onChange={e => setForm(f => ({ ...f, amount_ml: Number(e.target.value) }))} inputProps={{ min: 1 }} />
              <TextField label="Fluid Type" fullWidth value={form.fluid_type} onChange={e => setForm(f => ({ ...f, fluid_type: e.target.value }))} placeholder="e.g., Water, Juice, Tea" />
              <TextField label="Notes" fullWidth multiline rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}><Button onClick={() => { setAddOpen(false); setEditId(null) }}>Cancel</Button><Button type="submit" variant="contained" disabled={addMut.isPending || updMut.isPending || !form.amount_ml} sx={{ bgcolor: '#0F4C81' }}>{(addMut.isPending || updMut.isPending) ? <CircularProgress size={20} /> : 'Save'}</Button></DialogActions>
        </Box>
      </Dialog>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete fluid intake entry?"
        message={<>This will permanently delete {deleteTarget?.label}. This action cannot be undone.</>}
        confirmLabel="Delete"
        danger
        loading={delMut.isPending}
        onConfirm={() => deleteTarget && delMut.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </Box>
  )
}

export default function HealthTab({ personId }: { personId: string }) {
  return (
    <Stack spacing={4}>
      <Box>
        <ObservationsSection personId={personId} />
      </Box>
      <DividerLine />
      <Box>
        <BowelSection personId={personId} />
      </Box>
      <DividerLine />
      <Box>
        <DentalSection personId={personId} />
      </Box>
      <DividerLine />
      <Box>
        <FluidSection personId={personId} />
      </Box>
    </Stack>
  )
}

function DividerLine() {
  return <Box sx={{ borderBottom: '1px solid #E5E7EB' }} />
}
