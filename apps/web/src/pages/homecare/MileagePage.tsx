import { useMemo, useState } from 'react'
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Typography } from '@mui/material'
import { Download as DownloadIcon, Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, DirectionsCar as CarIcon, Policy as PolicyIcon } from '@mui/icons-material'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'

/* ── Helpers ── */
const fmtMoney = (pence: number | null | undefined) => pence == null ? '—' : `£${(Number(pence) / 100).toFixed(2)}`
const fmtRate = (pence: number | null | undefined) => pence == null ? '—' : `${Number(pence).toFixed(1)}p/mi`
const fmtMiles = (m: number | null | undefined) => m == null ? '—' : `${Number(m).toFixed(1)} mi`

/* ── Policy types ── */
const VEHICLE_TYPES = [
  { value: 'car', label: 'Car' },
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'bicycle', label: 'Bicycle' },
  { value: 'public_transport', label: 'Public transport' },
  { value: 'van', label: 'Van' },
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

const emptyPolicyForm = { tax_year: '2024/25', vehicle_type: 'car', fuel_category: 'petrol', rate_pence: '', effective_from: '', effective_to: '', source_label: '', is_active: true }

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════ */
export default function MileagePage() {
  const [tab, setTab] = useState(0)
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const user = useMemo(() => { try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} } }, [])
  const isManager = user.role === 'ORG_ADMIN' || user.role === 'MANAGER'
  const qc = useQueryClient()

  const from = `${month}-01`
  const to = new Date(new Date(from).getFullYear(), new Date(from).getMonth() + 1, 0).toISOString().slice(0, 10)

  /* ── Travel & Mileage data ── */
  const { data: visits = [], isLoading } = useQuery({
    queryKey: ['homecare-visits-mileage', from, to],
    queryFn: () => api.get(isManager ? '/homecare/visits' : '/homecare/my-visits', { params: { from, to } }).then(r => Array.isArray(r.data) ? r.data : []),
  })

  const mileageVisits = useMemo(() =>
    visits.filter((v: any) => v.actual_mileage_miles != null && Number(v.actual_mileage_miles) > 0),
    [visits]
  )

  const totalMiles = mileageVisits.reduce((sum: number, v: any) => sum + (Number(v.actual_mileage_miles) || 0), 0)
  const totalMileagePay = mileageVisits.reduce((sum: number, v: any) => sum + ((Number(v.actual_mileage_miles) || 0) * (Number(v.mileage_rate_pence) || 0)), 0)
  const totalTravelMinutes = mileageVisits.reduce((sum: number, v: any) => sum + (Number(v.actual_travel_minutes) || 0), 0)

  const exportCsv = () => {
    const headers = ['visit_id', 'carer', 'client', 'scheduled_start', 'miles', 'rate_pence', 'mileage_pay_pence', 'travel_minutes']
    const escape = (value: unknown) => {
      const text = value == null ? '' : String(value)
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
    }
    const csv = [headers.join(','), ...mileageVisits.map((v: any) => [
      v.id, v.assigned_staff_name || '', v.person_name || '', v.scheduled_start,
      v.actual_mileage_miles || 0, v.mileage_rate_pence || 0,
      (Number(v.actual_mileage_miles) || 0) * (Number(v.mileage_rate_pence) || 0),
      v.actual_travel_minutes || 0,
    ].map(escape).join(','))].join('\n') + '\n'
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `homecare-mileage-${month}.csv`; anchor.click(); URL.revokeObjectURL(url)
  }

  /* ── Mileage policies ── */
  const [policyDialog, setPolicyDialog] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [policyForm, setPolicyForm] = useState(emptyPolicyForm)
  const [policySaving, setPolicySaving] = useState(false)
  const [policyError, setPolicyError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const { data: policies = [], isLoading: policiesLoading } = useQuery({
    queryKey: ['homecare-mileage-policies'],
    queryFn: () => api.get('/homecare/mileage-policies').then(r => Array.isArray(r.data) ? r.data : []),
    enabled: isManager,
  })

  const openPolicyCreate = () => { setEditId(null); setPolicyForm(emptyPolicyForm); setPolicyDialog(true) }

  const openPolicyEdit = (p: MileagePolicy) => {
    setEditId(p.id)
    setPolicyForm({
      tax_year: p.tax_year, vehicle_type: p.vehicle_type, fuel_category: p.fuel_category,
      rate_pence: String(p.rate_pence), effective_from: p.effective_from?.slice(0, 10) || '',
      effective_to: p.effective_to?.slice(0, 10) || '', source_label: p.source_label || '', is_active: p.is_active,
    })
    setPolicyDialog(true)
  }

  const savePolicy = async () => {
    setPolicySaving(true); setPolicyError('')
    try {
      const payload = {
        tax_year: policyForm.tax_year, vehicle_type: policyForm.vehicle_type, fuel_category: policyForm.fuel_category,
        rate_pence: Number(policyForm.rate_pence), effective_from: policyForm.effective_from || null,
        effective_to: policyForm.effective_to || null, source_label: policyForm.source_label || null, is_active: policyForm.is_active,
      }
      if (editId) { await api.patch(`/homecare/mileage-policies/${editId}`, payload) }
      else { await api.post('/homecare/mileage-policies', payload) }
      setPolicyDialog(false); await qc.invalidateQueries({ queryKey: ['homecare-mileage-policies'] })
    } catch (e: any) { setPolicyError(e.response?.data?.message || 'Could not save mileage policy') }
    finally { setPolicySaving(false) }
  }

  const removePolicy = async (id: string) => {
    try { await api.delete(`/homecare/mileage-policies/${id}`); setDeleteConfirm(null); await qc.invalidateQueries({ queryKey: ['homecare-mileage-policies'] }) }
    catch (e: any) { setPolicyError(e.response?.data?.message || 'Could not delete mileage policy') }
  }

  const activePolicies = policies.filter((p: MileagePolicy) => p.is_active)

  /* ──────────── RENDER ──────────── */
  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto' }}>
      {/* Header */}
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" gap={1.5}>
          <CarIcon sx={{ color: '#0F4C81', fontSize: 28 }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>Mileage & Travel</Typography>
            <Typography variant="body2" sx={{ color: '#6B7280', mt: 0.5 }}>Track carer travel and manage mileage policies</Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1}>
          {tab === 0 && (
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv} disabled={!mileageVisits.length} sx={{ textTransform: 'none', borderColor: '#E5E7EB', color: '#374151' }}>
              Export CSV
            </Button>
          )}
          {tab === 1 && isManager && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openPolicyCreate} sx={{ textTransform: 'none', bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0D3D6B' } }}>
              Add policy
            </Button>
          )}
        </Stack>
      </Stack>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid #E5E7EB' }}>
        <Tab label="Travel & Mileage" icon={<CarIcon />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 600, minHeight: 48 }} />
        <Tab label={`Policies ${activePolicies.length > 0 ? `(${activePolicies.length})` : ''}`} icon={<PolicyIcon />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 600, minHeight: 48 }} />
      </Tabs>

      {policyError && <Alert severity="error" onClose={() => setPolicyError('')} sx={{ mb: 2 }}>{policyError}</Alert>}

      {/* ═══════ TAB 0: Travel & Mileage ═══════ */}
      {tab === 0 && (
        <>
          <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
            <TextField type="month" size="small" value={month} onChange={e => setMonth(e.target.value)} sx={{ minWidth: 180 }} />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
            <Paper elevation={0} sx={{ p: 3, flex: 1, textAlign: 'center', border: '1px solid #E5E7EB', borderRadius: 3 }}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#0F4C81' }}>{totalMiles.toFixed(1)}</Typography>
              <Typography variant="body2" sx={{ color: '#6B7280' }}>Total miles</Typography>
            </Paper>
            <Paper elevation={0} sx={{ p: 3, flex: 1, textAlign: 'center', border: '1px solid #E5E7EB', borderRadius: 3 }}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#10b981' }}>{fmtMoney(totalMileagePay)}</Typography>
              <Typography variant="body2" sx={{ color: '#6B7280' }}>Total mileage pay</Typography>
            </Paper>
            <Paper elevation={0} sx={{ p: 3, flex: 1, textAlign: 'center', border: '1px solid #E5E7EB', borderRadius: 3 }}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#3b82f6' }}>{`${Math.floor(totalTravelMinutes / 60)}h ${totalTravelMinutes % 60}m`}</Typography>
              <Typography variant="body2" sx={{ color: '#6B7280' }}>Total travel time</Typography>
            </Paper>
            <Paper elevation={0} sx={{ p: 3, flex: 1, textAlign: 'center', border: '1px solid #E5E7EB', borderRadius: 3 }}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{mileageVisits.length}</Typography>
              <Typography variant="body2" sx={{ color: '#6B7280' }}>Tracked visits</Typography>
            </Paper>
          </Stack>

          {/* Active policies bar */}
          {isManager && activePolicies.length > 0 && (
            <Paper elevation={0} sx={{ p: 2.5, mb: 3, border: '1px solid #E5E7EB', borderRadius: 3, borderLeft: '4px solid #0F4C81' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F4C81' }}>Active mileage policies</Typography>
                <Button size="small" onClick={() => setTab(1)} sx={{ textTransform: 'none', color: '#0F4C81' }}>Manage</Button>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {activePolicies.map((p: MileagePolicy) => (
                  <Chip key={p.id} label={`${VEHICLE_TYPES.find(v => v.value === p.vehicle_type)?.label || p.vehicle_type} · ${FUEL_CATEGORIES.find(f => f.value === p.fuel_category)?.label || p.fuel_category} — ${fmtRate(p.rate_pence)} (${p.tax_year})`} size="small" sx={{ bgcolor: '#F0F7FF', fontWeight: 600, color: '#0F4C81' }} />
                ))}
              </Stack>
            </Paper>
          )}

          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 3 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: '#374151' }}>Carer</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#374151' }}>Client</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#374151' }}>Date</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#374151' }}>Miles</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#374151' }}>Travel time</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#374151' }}>Rate</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#374151' }}>Mileage pay</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mileageVisits.length === 0 ? (
                    <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6, color: '#6B7280' }}>No mileage records for this period</TableCell></TableRow>
                  ) : mileageVisits.map((v: any) => (
                    <TableRow key={v.id} hover>
                      <TableCell>
                        <Typography sx={{ fontWeight: 600 }}>{v.assigned_staff_name || 'Unassigned'}</Typography>
                      </TableCell>
                      <TableCell>{v.person_name || '—'}</TableCell>
                      <TableCell>{new Date(v.scheduled_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>{fmtMiles(v.actual_mileage_miles)}</TableCell>
                      <TableCell align="right">
                        {v.actual_travel_minutes != null ? `${Math.floor(v.actual_travel_minutes / 60)}h ${v.actual_travel_minutes % 60}m` : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ color: '#6B7280' }}>{v.mileage_rate_pence ? fmtRate(v.mileage_rate_pence) : '—'}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#10b981' }}>
                        {fmtMoney((Number(v.actual_mileage_miles) || 0) * (Number(v.mileage_rate_pence) || 0))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {/* ═══════ TAB 1: Policies ═══════ */}
      {tab === 1 && (
        <>
          {policiesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
          ) : policies.length === 0 ? (
            <Paper elevation={0} sx={{ p: 6, textAlign: 'center', border: '1px solid #E5E7EB', borderRadius: 3 }}>
              <PolicyIcon sx={{ fontSize: 48, color: '#D1D5DB', mb: 1 }} />
              <Typography sx={{ color: '#6B7280', mb: 1 }}>No mileage policies configured</Typography>
              <Typography variant="caption" sx={{ color: '#9CA3AF' }}>Add your first policy to set mileage rates for carer travel</Typography>
              {isManager && (
                <Box sx={{ mt: 2 }}>
                  <Button variant="outlined" startIcon={<AddIcon />} onClick={openPolicyCreate} sx={{ textTransform: 'none' }}>Add policy</Button>
                </Box>
              )}
            </Paper>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 3 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: '#374151' }}>Tax year</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#374151' }}>Vehicle</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#374151' }}>Fuel</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#374151' }}>Rate</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#374151' }}>Effective from</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#374151' }}>Effective to</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#374151' }}>Source</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#374151' }}>Status</TableCell>
                    {isManager && <TableCell align="right" sx={{ fontWeight: 700, color: '#374151' }}>Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {policies.map((p: MileagePolicy) => (
                    <TableRow key={p.id} hover sx={{ opacity: p.is_active ? 1 : 0.6 }}>
                      <TableCell><Typography sx={{ fontWeight: 600 }}>{p.tax_year}</Typography></TableCell>
                      <TableCell>
                        <Chip label={VEHICLE_TYPES.find(v => v.value === p.vehicle_type)?.label || p.vehicle_type} size="small" sx={{ bgcolor: '#F3F4F6' }} />
                      </TableCell>
                      <TableCell>
                        <Chip label={FUEL_CATEGORIES.find(f => f.value === p.fuel_category)?.label || p.fuel_category} size="small" sx={{ bgcolor: '#F3F4F6' }} />
                      </TableCell>
                      <TableCell align="right"><Typography sx={{ fontWeight: 700, color: '#0F4C81' }}>{fmtRate(p.rate_pence)}</Typography></TableCell>
                      <TableCell>{p.effective_from ? new Date(p.effective_from).toLocaleDateString('en-GB') : '—'}</TableCell>
                      <TableCell>{p.effective_to ? new Date(p.effective_to).toLocaleDateString('en-GB') : '—'}</TableCell>
                      <TableCell><Typography variant="body2" sx={{ color: '#6B7280' }}>{p.source_label || '—'}</Typography></TableCell>
                      <TableCell>
                        <Chip label={p.is_active ? 'Active' : 'Inactive'} size="small" sx={{ bgcolor: p.is_active ? '#E9F7F0' : '#F3F4F6', color: p.is_active ? '#047857' : '#9CA3AF', fontWeight: 600 }} />
                      </TableCell>
                      {isManager && (
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Button size="small" startIcon={<EditIcon />} onClick={() => openPolicyEdit(p)} sx={{ textTransform: 'none', color: '#0F4C81' }}>Edit</Button>
                            <Button size="small" startIcon={<DeleteIcon />} onClick={() => setDeleteConfirm(p.id)} sx={{ textTransform: 'none', color: '#DC2626' }}>Delete</Button>
                          </Stack>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {/* ═══════ Policy Create/Edit Dialog ═══════ */}
      <Dialog open={policyDialog} onClose={() => setPolicyDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editId ? 'Edit mileage policy' : 'Add mileage policy'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Tax year" value={policyForm.tax_year} onChange={e => setPolicyForm(f => ({ ...f, tax_year: e.target.value }))} helperText="e.g. 2024/25" fullWidth />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField select label="Vehicle type" value={policyForm.vehicle_type} onChange={e => setPolicyForm(f => ({ ...f, vehicle_type: e.target.value }))} fullWidth>
                {VEHICLE_TYPES.map(v => <MenuItem key={v.value} value={v.value}>{v.label}</MenuItem>)}
              </TextField>
              <TextField select label="Fuel category" value={policyForm.fuel_category} onChange={e => setPolicyForm(f => ({ ...f, fuel_category: e.target.value }))} fullWidth>
                {FUEL_CATEGORIES.map(f => <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>)}
              </TextField>
            </Stack>
            <TextField label="Rate (pence per mile)" type="number" inputProps={{ min: 0 }} value={policyForm.rate_pence} onChange={e => setPolicyForm(f => ({ ...f, rate_pence: e.target.value }))} fullWidth required />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField type="date" label="Effective from" value={policyForm.effective_from} onChange={e => setPolicyForm(f => ({ ...f, effective_from: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
              <TextField type="date" label="Effective to" value={policyForm.effective_to} onChange={e => setPolicyForm(f => ({ ...f, effective_to: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
            </Stack>
            <TextField label="Source reference" value={policyForm.source_label} onChange={e => setPolicyForm(f => ({ ...f, source_label: e.target.value }))} placeholder="e.g. HMRC 2024/25 advisory rate" fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPolicyDialog(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={savePolicy} disabled={policySaving || !policyForm.tax_year || !policyForm.rate_pence} sx={{ textTransform: 'none', bgcolor: '#0F4C81' }}>
            {policySaving ? <CircularProgress size={18} color="inherit" /> : editId ? 'Save changes' : 'Add policy'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ═══════ Delete Confirmation Dialog ═══════ */}
      <Dialog open={Boolean(deleteConfirm)} onClose={() => setDeleteConfirm(null)} maxWidth="xs">
        <DialogTitle>Delete mileage policy</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#6B7280' }}>
            This will permanently remove this mileage policy. Visits that used this rate will retain their original mileage data.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deleteConfirm && removePolicy(deleteConfirm)} sx={{ textTransform: 'none' }}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
