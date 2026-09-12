import { useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material'
import api from '../../services/api'

const money = (pence: number | null | undefined) => pence == null ? '—' : `${(Number(pence)).toFixed(1)}p/mi`

const VEHICLE_TYPES = [
  { value: 'car', label: 'Car' },
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'bicycle', label: 'Bicycle' },
  { value: 'public_transport', label: 'Public transport' },
  { value: 'other', label: 'Other' },
]

const FUEL_CATEGORIES = [
  { value: 'petrol', label: 'Petrol' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'electric', label: 'Electric' },
  { value: 'lpg', label: 'LPG' },
  { value: 'not_applicable', label: 'Not applicable' },
  { value: 'other', label: 'Other' },
]

interface MileagePolicy {
  id: string
  tax_year: string
  vehicle_type: string
  fuel_category: string
  rate_pence: number
  effective_from: string | null
  effective_to: string | null
  source_label: string | null
  is_active: boolean
  created_at: string
}

const emptyForm = { tax_year: '2024/25', vehicle_type: 'car', fuel_category: 'petrol', rate_pence: '', effective_from: '', effective_to: '', source_label: '', is_active: true }

export default function MileagePolicyPage() {
  const [policies, setPolicies] = useState<MileagePolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const res = await api.get('/homecare/mileage-policies')
      setPolicies(res.data)
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to load mileage policies')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (p: MileagePolicy) => {
    setEditId(p.id)
    setForm({
      tax_year: p.tax_year,
      vehicle_type: p.vehicle_type,
      fuel_category: p.fuel_category,
      rate_pence: String(p.rate_pence),
      effective_from: p.effective_from ? p.effective_from.slice(0, 10) : '',
      effective_to: p.effective_to ? p.effective_to.slice(0, 10) : '',
      source_label: p.source_label || '',
      is_active: p.is_active,
    })
    setDialogOpen(true)
  }

  const save = async () => {
    setSaving(true); setError('')
    try {
      const payload = {
        tax_year: form.tax_year,
        vehicle_type: form.vehicle_type,
        fuel_category: form.fuel_category,
        rate_pence: Number(form.rate_pence),
        effective_from: form.effective_from || null,
        effective_to: form.effective_to || null,
        source_label: form.source_label || null,
        is_active: form.is_active,
      }
      if (editId) {
        await api.patch(`/homecare/mileage-policies/${editId}`, payload)
      } else {
        await api.post('/homecare/mileage-policies', payload)
      }
      setDialogOpen(false)
      await load()
    } catch (e: any) {
      setError(e.response?.data?.message || 'Could not save mileage policy')
    } finally { setSaving(false) }
  }

  const remove = async (id: string) => {
    try {
      await api.delete(`/homecare/mileage-policies/${id}`)
      setDeleteConfirm(null)
      await load()
    } catch (e: any) {
      setError(e.response?.data?.message || 'Could not delete mileage policy')
    }
  }

  const activePolicies = policies.filter(p => p.is_active)
  const inactivePolicies = policies.filter(p => !p.is_active)

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Mileage Policies</Typography>
          <Typography variant="body2" sx={{ color: '#6B7280', mt: 0.5 }}>Manage HMRC-approved mileage rates by vehicle type and fuel category</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ textTransform: 'none', bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0D3D6B' } }}>
          Add policy
        </Button>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 3 }}>{error}</Alert>}

      {/* Summary */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
        <Paper elevation={0} sx={{ p: 2.5, flex: '1 1 140px', border: '1px solid #E5E7EB', borderRadius: 2, textAlign: 'center' }}>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#0F4C81' }}>{policies.length}</Typography>
          <Typography variant="caption" sx={{ color: '#6B7280' }}>Total policies</Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 2.5, flex: '1 1 140px', border: '1px solid #E5E7EB', borderRadius: 2, textAlign: 'center' }}>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#10b981' }}>{activePolicies.length}</Typography>
          <Typography variant="caption" sx={{ color: '#6B7280' }}>Active</Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 2.5, flex: '1 1 140px', border: '1px solid #E5E7EB', borderRadius: 2, textAlign: 'center' }}>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#6B7280' }}>{inactivePolicies.length}</Typography>
          <Typography variant="caption" sx={{ color: '#6B7280' }}>Inactive</Typography>
        </Paper>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : policies.length === 0 ? (
        <Paper elevation={0} sx={{ p: 6, textAlign: 'center', border: '1px solid #E5E7EB', borderRadius: 2 }}>
          <Typography sx={{ color: '#6B7280', mb: 1 }}>No mileage policies configured</Typography>
          <Typography variant="caption" sx={{ color: '#9CA3AF' }}>Add your first policy to set mileage rates for carer travel</Typography>
          <Box sx={{ mt: 2 }}>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={openCreate} sx={{ textTransform: 'none' }}>Add policy</Button>
          </Box>
        </Paper>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Tax year</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Vehicle</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Fuel</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Rate</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Effective from</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Effective to</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Source</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {policies.map(p => (
                <TableRow key={p.id} hover sx={{ opacity: p.is_active ? 1 : 0.6 }}>
                  <TableCell><Typography sx={{ fontWeight: 600 }}>{p.tax_year}</Typography></TableCell>
                  <TableCell>
                    <Chip label={VEHICLE_TYPES.find(v => v.value === p.vehicle_type)?.label || p.vehicle_type} size="small" sx={{ bgcolor: '#F3F4F6' }} />
                  </TableCell>
                  <TableCell>
                    <Chip label={FUEL_CATEGORIES.find(f => f.value === p.fuel_category)?.label || p.fuel_category} size="small" sx={{ bgcolor: '#F3F4F6' }} />
                  </TableCell>
                  <TableCell align="right"><Typography sx={{ fontWeight: 700, color: '#0F4C81' }}>{money(p.rate_pence)}</Typography></TableCell>
                  <TableCell>{p.effective_from ? new Date(p.effective_from).toLocaleDateString('en-GB') : '—'}</TableCell>
                  <TableCell>{p.effective_to ? new Date(p.effective_to).toLocaleDateString('en-GB') : '—'}</TableCell>
                  <TableCell><Typography variant="body2" sx={{ color: '#6B7280' }}>{p.source_label || '—'}</Typography></TableCell>
                  <TableCell>
                    <Chip label={p.is_active ? 'Active' : 'Inactive'} size="small" sx={{ bgcolor: p.is_active ? '#E9F7F0' : '#F3F4F6', color: p.is_active ? '#047857' : '#9CA3AF', fontWeight: 600 }} />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(p)} sx={{ textTransform: 'none', color: '#0F4C81' }}>Edit</Button>
                      <Button size="small" startIcon={<DeleteIcon />} onClick={() => setDeleteConfirm(p.id)} sx={{ textTransform: 'none', color: '#DC2626' }}>Delete</Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editId ? 'Edit mileage policy' : 'Add mileage policy'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Tax year" value={form.tax_year} onChange={e => setForm(f => ({ ...f, tax_year: e.target.value }))} helperText="e.g. 2024/25" fullWidth />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField select label="Vehicle type" value={form.vehicle_type} onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))} fullWidth>
                {VEHICLE_TYPES.map(v => <MenuItem key={v.value} value={v.value}>{v.label}</MenuItem>)}
              </TextField>
              <TextField select label="Fuel category" value={form.fuel_category} onChange={e => setForm(f => ({ ...f, fuel_category: e.target.value }))} fullWidth>
                {FUEL_CATEGORIES.map(f => <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>)}
              </TextField>
            </Stack>
            <TextField label="Rate (pence per mile)" type="number" inputProps={{ min: 0 }} value={form.rate_pence} onChange={e => setForm(f => ({ ...f, rate_pence: e.target.value }))} fullWidth required />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField type="date" label="Effective from" value={form.effective_from} onChange={e => setForm(f => ({ ...f, effective_from: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
              <TextField type="date" label="Effective to" value={form.effective_to} onChange={e => setForm(f => ({ ...f, effective_to: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
            </Stack>
            <TextField label="Source reference" value={form.source_label} onChange={e => setForm(f => ({ ...f, source_label: e.target.value }))} placeholder="e.g. HMRC 2024/25 advisory rate" fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={saving || !form.tax_year || !form.rate_pence} sx={{ textTransform: 'none', bgcolor: '#0F4C81' }}>
            {saving ? <CircularProgress size={18} color="inherit" /> : editId ? 'Save changes' : 'Add policy'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={Boolean(deleteConfirm)} onClose={() => setDeleteConfirm(null)} maxWidth="xs">
        <DialogTitle>Delete mileage policy</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#6B7280' }}>
            This will permanently remove this mileage policy. Visits that used this rate will retain their original mileage data.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deleteConfirm && remove(deleteConfirm)} sx={{ textTransform: 'none' }}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
