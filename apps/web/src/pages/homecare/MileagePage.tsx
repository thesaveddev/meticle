import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Typography } from '@mui/material'
import { Download as DownloadIcon, Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, DirectionsCar as CarIcon, Policy as PolicyIcon, SettingsSuggest as SettingsIcon, AccessTime as TravelTimeIcon } from '@mui/icons-material'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import PageContainer from '../../components/design/PageContainer'
import AppButton from '../../components/design/AppButton'
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

  // Travel tab: search and pagination
  const [travelSearch, setTravelSearch] = useState('')
  const [travelPage, setTravelPage] = useState(0)
  const TRAVEL_PAGE_SIZE = 15

  const filteredMileage = useMemo(() => {
    if (!travelSearch.trim()) return mileageVisits
    const q = travelSearch.toLowerCase()
    return mileageVisits.filter((v: any) =>
      (v.assigned_staff_name || '').toLowerCase().includes(q) ||
      (v.person_name || '').toLowerCase().includes(q)
    )
  }, [mileageVisits, travelSearch])

  const travelTotalPages = Math.ceil(filteredMileage.length / TRAVEL_PAGE_SIZE)
  const paginatedMileage = filteredMileage.slice(travelPage * TRAVEL_PAGE_SIZE, (travelPage + 1) * TRAVEL_PAGE_SIZE)

  // Policy tab: search and pagination
  const [policySearch, setPolicySearch] = useState('')
  const [policyPage, setPolicyPage] = useState(0)
  const POLICY_PAGE_SIZE = 10

  const filteredPolicies = useMemo(() => {
    if (!policySearch.trim()) return policies
    const q = policySearch.toLowerCase()
    return policies.filter((p: MileagePolicy) =>
      p.tax_year.toLowerCase().includes(q) ||
      (VEHICLE_TYPES.find(v => v.value === p.vehicle_type)?.label || '').toLowerCase().includes(q) ||
      (FUEL_CATEGORIES.find(f => f.value === p.fuel_category)?.label || '').toLowerCase().includes(q)
    )
  }, [policies, policySearch])

  const policyTotalPages = Math.ceil(filteredPolicies.length / POLICY_PAGE_SIZE)
  const paginatedPolicies = filteredPolicies.slice(policyPage * POLICY_PAGE_SIZE, (policyPage + 1) * POLICY_PAGE_SIZE)

  const activePolicies = policies.filter((p: MileagePolicy) => p.is_active)

  /* ──────────── RENDER ──────────── */
  return (
    <PageContainer>
      {/* Header */}
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" gap={1.5}>
          <CarIcon sx={{ color: '#0F4C81', fontSize: 28 }} />
          <Box>
            <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 800, letterSpacing: 1.2 }}>Operations controls</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>Mileage, travel & rate rules</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>Keep travel records visible and apply one approved reimbursement policy across the service.</Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1}>
          {tab === 0 && <AppButton variant="secondary" startIcon={<DownloadIcon />} onClick={exportCsv} disabled={!mileageVisits.length}>Export travel register</AppButton>}
          {tab === 1 && isManager && <AppButton variant="primary" startIcon={<AddIcon />} onClick={openPolicyCreate}>Add policy</AppButton>}
        </Stack>
      </Stack>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid #E5E7EB' }}>
        <Tab label="Travel register" icon={<TravelTimeIcon />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 600, minHeight: 48 }} />
        <Tab label={`Policy register ${activePolicies.length > 0 ? `(${activePolicies.length})` : ''}`} icon={<SettingsIcon />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 600, minHeight: 48 }} />
        {isManager && <Tab label="Rate profiles" icon={<PolicyIcon />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 600, minHeight: 48 }} />}
      </Tabs>

      {policyError && <Alert severity="error" onClose={() => setPolicyError('')} sx={{ mb: 2 }}>{policyError}</Alert>}

      {/* ═══════ TAB 0: Travel & Mileage ═══════ */}
      {tab === 0 && (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
            <TextField type="month" size="small" value={month} onChange={e => setMonth(e.target.value)} sx={{ minWidth: 180 }} />
            <TextField size="small" placeholder="Search by carer or client..." value={travelSearch} onChange={e => { setTravelSearch(e.target.value); setTravelPage(0) }} sx={{ flex: 1, minWidth: 200 }} />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
            <Paper elevation={0} sx={{ p: 3, flex: 1, textAlign: 'center', border: '1px solid', borderColor: 'grey.200', borderRadius: 3 }}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#0F4C81' }}>{totalMiles.toFixed(1)}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Total miles</Typography>
            </Paper>
            <Paper elevation={0} sx={{ p: 3, flex: 1, textAlign: 'center', border: '1px solid', borderColor: 'grey.200', borderRadius: 3 }}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#10b981' }}>{fmtMoney(totalMileagePay)}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Total mileage pay</Typography>
            </Paper>
            <Paper elevation={0} sx={{ p: 3, flex: 1, textAlign: 'center', border: '1px solid', borderColor: 'grey.200', borderRadius: 3 }}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#3b82f6' }}>{`${Math.floor(totalTravelMinutes / 60)}h ${totalTravelMinutes % 60}m`}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Total travel time</Typography>
            </Paper>
            <Paper elevation={0} sx={{ p: 3, flex: 1, textAlign: 'center', border: '1px solid', borderColor: 'grey.200', borderRadius: 3 }}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{mileageVisits.length}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Tracked visits</Typography>
            </Paper>
          </Stack>

          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'grey.200', borderRadius: 3 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>Carer</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>Client</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>Date</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: 'text.primary' }}>Miles</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: 'text.primary' }}>Travel time</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: 'text.primary' }}>Rate</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: 'text.primary' }}>Mileage pay</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedMileage.length === 0 ? (
                    <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>{travelSearch ? 'No records match your search' : 'No mileage records for this period'}</TableCell></TableRow>
                  ) : paginatedMileage.map((v: any) => (
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
                      <TableCell align="right" sx={{ color: 'text.secondary' }}>{v.mileage_rate_pence ? fmtRate(v.mileage_rate_pence) : '—'}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#10b981' }}>
                        {fmtMoney((Number(v.actual_mileage_miles) || 0) * (Number(v.mileage_rate_pence) || 0))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Travel pagination */}
          {travelTotalPages > 1 && (
            <Stack direction="row" justifyContent="center" alignItems="center" spacing={1} sx={{ mt: 2 }}>
              <Button size="small" disabled={travelPage === 0} onClick={() => setTravelPage(p => p - 1)}>Previous</Button>
              <Typography variant="body2" color="text.secondary">Page {travelPage + 1} of {travelTotalPages}</Typography>
              <Button size="small" disabled={travelPage >= travelTotalPages - 1} onClick={() => setTravelPage(p => p + 1)}>Next</Button>
            </Stack>
          )}
        </>
      )}

      {/* ═══════ TAB 1: Policies ═══════ */}
      {tab === 1 && (
        <>
          {policiesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
          ) : policies.length === 0 ? (
            <Paper elevation={0} sx={{ p: 6, textAlign: 'center', border: '1px solid', borderColor: 'grey.200', borderRadius: 3 }}>
              <PolicyIcon sx={{ fontSize: 48, color: '#D1D5DB', mb: 1 }} />
              <Typography sx={{ color: 'text.secondary', mb: 1 }}>No mileage policies configured</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Add an approved policy to calculate mileage reimbursement consistently for carer travel.</Typography>
              {isManager && (
                <Box sx={{ mt: 2 }}>
                  <Button variant="outlined" startIcon={<AddIcon />} onClick={openPolicyCreate} sx={{ textTransform: 'none' }}>Add policy</Button>
                </Box>
              )}
            </Paper>
          ) : (
            <>
              <TextField size="small" placeholder="Search policies..." value={policySearch} onChange={e => { setPolicySearch(e.target.value); setPolicyPage(0) }} sx={{ mb: 2, minWidth: 250 }} />
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'grey.200', borderRadius: 3 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>Tax year</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>Vehicle</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>Fuel</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: 'text.primary' }}>Rate</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>Effective from</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>Effective to</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>Source</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>Status</TableCell>
                    {isManager && <TableCell align="right" sx={{ fontWeight: 700, color: 'text.primary' }}>Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedPolicies.map((p: MileagePolicy) => (
                    <TableRow key={p.id} hover sx={{ opacity: p.is_active ? 1 : 0.6 }}>
                      <TableCell><Typography sx={{ fontWeight: 600 }}>{p.tax_year}</Typography></TableCell>
                      <TableCell>
                        <Chip label={VEHICLE_TYPES.find(v => v.value === p.vehicle_type)?.label || p.vehicle_type} size="small" sx={{ bgcolor: 'grey.100' }} />
                      </TableCell>
                      <TableCell>
                        <Chip label={FUEL_CATEGORIES.find(f => f.value === p.fuel_category)?.label || p.fuel_category} size="small" sx={{ bgcolor: 'grey.100' }} />
                      </TableCell>
                      <TableCell align="right"><Typography sx={{ fontWeight: 700, color: '#0F4C81' }}>{fmtRate(p.rate_pence)}</Typography></TableCell>
                      <TableCell>{p.effective_from ? new Date(p.effective_from).toLocaleDateString('en-GB') : '—'}</TableCell>
                      <TableCell>{p.effective_to ? new Date(p.effective_to).toLocaleDateString('en-GB') : '—'}</TableCell>
                      <TableCell><Typography variant="body2" sx={{ color: 'text.secondary' }}>{p.source_label || '—'}</Typography></TableCell>
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

              {/* Policy pagination */}
              {policyTotalPages > 1 && (
                <Stack direction="row" justifyContent="center" alignItems="center" spacing={1} sx={{ mt: 2 }}>
                  <Button size="small" disabled={policyPage === 0} onClick={() => setPolicyPage(p => p - 1)}>Previous</Button>
                  <Typography variant="body2" color="text.secondary">Page {policyPage + 1} of {policyTotalPages}</Typography>
                  <Button size="small" disabled={policyPage >= policyTotalPages - 1} onClick={() => setPolicyPage(p => p + 1)}>Next</Button>
                </Stack>
              )}
            </>
          )}
        </>
      )}

      {tab === 2 && isManager && <RateProfilesTab />}

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
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            This will permanently remove this mileage policy. Visits that used this rate will retain their original mileage data.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deleteConfirm && removePolicy(deleteConfirm)} sx={{ textTransform: 'none' }}>Delete</Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  )
}

function RateProfilesTab() {
  const [billingProfiles, setBillingProfiles] = useState<any[]>([])
  const [payProfiles, setPayProfiles] = useState<any[]>([])
  const [billingName, setBillingName] = useState('')
  const [billingRate, setBillingRate] = useState('')
  const [payName, setPayName] = useState('')
  const [payRate, setPayRate] = useState('')
  const [error, setError] = useState('')
  const load = async () => {
    try {
      const [billing, pay] = await Promise.all([api.get('/homecare/billing-profiles'), api.get('/homecare/pay-profiles')])
      setBillingProfiles(billing.data || []); setPayProfiles(pay.data || [])
    } catch (e: any) { setError(e.response?.data?.message || 'Could not load rate profiles') }
  }
  useEffect(() => { void load() }, [])
  const addBilling = async () => { if (!billingName.trim() || !billingRate) return; await api.post('/homecare/billing-profiles', { name: billingName.trim(), client_rate_pence: Number(billingRate), funding_type: 'all' }); setBillingName(''); setBillingRate(''); await load() }
  const addPay = async () => { if (!payName.trim() || !payRate) return; await api.post('/homecare/pay-profiles', { name: payName.trim(), hourly_rate_pence: Number(payRate) }); setPayName(''); setPayRate(''); await load() }
  return <Stack spacing={2}>
    {error && <Alert severity="error">{error}</Alert>}
    <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'grey.200', borderRadius: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 800 }}>Client billing profiles</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Reusable hourly charges for client packages. A package can choose a profile and still override the charge when required.</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField size="small" label="Profile name" value={billingName} onChange={e => setBillingName(e.target.value)} sx={{ flex: 1 }} /><TextField size="small" label="Client rate (pence/hr)" type="number" value={billingRate} onChange={e => setBillingRate(e.target.value)} /><Button variant="contained" onClick={addBilling} disabled={!billingName.trim() || !billingRate}>Add profile</Button></Stack>
      <Stack spacing={1} sx={{ mt: 2 }}>{billingProfiles.map(profile => <Paper key={profile.id} variant="outlined" sx={{ p: 1.5 }}><Typography fontWeight={700}>{profile.name}</Typography><Typography variant="body2" color="text.secondary">£{(Number(profile.client_rate_pence) / 100).toFixed(2)}/hr · {profile.is_active ? 'Active' : 'Inactive'}</Typography></Paper>)}</Stack>
    </Paper>
    <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'grey.200', borderRadius: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 800 }}>Carer pay profiles</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Reusable hourly pay rates assigned to carer profiles. A call-level rate override takes precedence for that call.</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField size="small" label="Profile name" value={payName} onChange={e => setPayName(e.target.value)} sx={{ flex: 1 }} /><TextField size="small" label="Carer rate (pence/hr)" type="number" value={payRate} onChange={e => setPayRate(e.target.value)} /><Button variant="contained" onClick={addPay} disabled={!payName.trim() || !payRate}>Add profile</Button></Stack>
      <Stack spacing={1} sx={{ mt: 2 }}>{payProfiles.map(profile => <Paper key={profile.id} variant="outlined" sx={{ p: 1.5 }}><Typography fontWeight={700}>{profile.name}</Typography><Typography variant="body2" color="text.secondary">£{(Number(profile.hourly_rate_pence) / 100).toFixed(2)}/hr · {profile.is_active ? 'Active' : 'Inactive'}</Typography></Paper>)}</Stack>
    </Paper>
  </Stack>
}
