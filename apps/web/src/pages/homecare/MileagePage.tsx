import { useMemo, useState } from 'react'
import { Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { Download as DownloadIcon, Add as AddIcon } from '@mui/icons-material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'

const money = (pence: number | null | undefined) => pence == null ? '—' : `£${(Number(pence) / 100).toFixed(2)}`

export default function MileagePage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [policyDialog, setPolicyDialog] = useState(false)
  const [policyForm, setPolicyForm] = useState({ vehicle_type: 'car', fuel_type: 'petrol', rate_pence_per_mile: '', tax_year: '2024/25' })
  const user = useMemo(() => { try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} } }, [])
  const isManager = user.role === 'ORG_ADMIN' || user.role === 'MANAGER'
  const qc = useQueryClient()

  const from = `${month}-01`
  const to = new Date(new Date(from).getFullYear(), new Date(from).getMonth() + 1, 0).toISOString().slice(0, 10)

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ['homecare-visits-mileage', from, to],
    queryFn: () => api.get(isManager ? '/homecare/visits' : '/homecare/my-visits', { params: { from, to } }).then(r => Array.isArray(r.data) ? r.data : []),
  })

  const { data: policies = [] } = useQuery({
    queryKey: ['homecare-mileage-policies'],
    queryFn: () => api.get('/homecare/mileage-policies').then(r => Array.isArray(r.data) ? r.data : []),
    enabled: isManager,
  })

  const createPolicy = useMutation({
    mutationFn: (data: any) => api.post('/homecare/mileage-policies', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['homecare-mileage-policies'] }); setPolicyDialog(false); setPolicyForm({ vehicle_type: 'car', fuel_type: 'petrol', rate_pence_per_mile: '', tax_year: '2024/25' }) },
    onError: (e: any) => alert(e.response?.data?.message || 'Could not create mileage policy'),
  })

  const mileageVisits = visits.filter((v: any) => v.actual_mileage_miles != null && Number(v.actual_mileage_miles) > 0)
  const totalMiles = mileageVisits.reduce((sum: number, v: any) => sum + (Number(v.actual_mileage_miles) || 0), 0)
  const totalMileagePay = mileageVisits.reduce((sum: number, v: any) => sum + ((Number(v.actual_mileage_miles) || 0) * (Number(v.mileage_rate_pence) || 0)), 0)

  const exportCsv = () => {
    const headers = ['visit_id', 'carer', 'client', 'scheduled_start', 'miles', 'rate_pence', 'mileage_pay_pence']
    const escape = (value: unknown) => {
      const text = value == null ? '' : String(value)
      return /[",\\n\\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
    }
    const csv = [headers.join(','), ...mileageVisits.map((visit: any) => [
      visit.id, visit.assigned_staff_name, visit.person_name, visit.scheduled_start,
      visit.actual_mileage_miles, visit.mileage_rate_pence || 0,
      (Number(visit.actual_mileage_miles) || 0) * (Number(visit.mileage_rate_pence) || 0),
    ].map(escape).join(','))].join('\n') + '\n'
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `homecare-mileage-${month}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Mileage & Travel</Typography>
          <Typography variant="body2" sx={{ color: '#6B7280', mt: 0.5 }}>Track carer travel between client visits</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {isManager && (
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setPolicyDialog(true)} sx={{ textTransform: 'none', borderColor: '#E5E7EB', color: '#374151' }}>
              Add mileage policy
            </Button>
          )}
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv} disabled={!mileageVisits.length} sx={{ textTransform: 'none', borderColor: '#E5E7EB', color: '#374151' }}>
            Export CSV
          </Button>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <TextField
          type="month"
          size="small"
          value={month}
          onChange={e => setMonth(e.target.value)}
          sx={{ minWidth: 180 }}
        />
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <Paper elevation={0} sx={{ p: 3, flex: 1, textAlign: 'center', border: '1px solid #E5E7EB', borderRadius: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#0F4C81' }}>{totalMiles.toFixed(1)}</Typography>
          <Typography variant="body2" sx={{ color: '#6B7280' }}>Total miles</Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 3, flex: 1, textAlign: 'center', border: '1px solid #E5E7EB', borderRadius: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#10b981' }}>{money(totalMileagePay)}</Typography>
          <Typography variant="body2" sx={{ color: '#6B7280' }}>Total mileage pay</Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 3, flex: 1, textAlign: 'center', border: '1px solid #E5E7EB', borderRadius: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>{mileageVisits.length}</Typography>
          <Typography variant="body2" sx={{ color: '#6B7280' }}>Tracked visits</Typography>
        </Paper>
      </Stack>

      {isManager && policies.length > 0 && (
        <Paper elevation={0} sx={{ p: 2.5, mb: 3, border: '1px solid #E5E7EB', borderRadius: 2, borderLeft: '4px solid #0F4C81' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#0F4C81' }}>Active mileage policies</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {policies.map((p: any) => (
              <Chip key={p.id} label={`${p.vehicle_type} ${p.fuel_type} — ${money(p.rate_pence_per_mile)}/mi (${p.tax_year})`} size="small" sx={{ bgcolor: '#F8FAFC', fontWeight: 600 }} />
            ))}
          </Stack>
        </Paper>
      )}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Carer</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Client</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Miles</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Mileage Pay</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Vehicle</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mileageVisits.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: '#6B7280' }}>No mileage records for this period</TableCell></TableRow>
              ) : mileageVisits.map((v: any) => (
                <TableRow key={v.id} hover>
                  <TableCell>{v.assigned_staff_name || '—'}</TableCell>
                  <TableCell>{v.person_name || '—'}</TableCell>
                  <TableCell>{new Date(v.scheduled_start).toLocaleDateString('en-GB')}</TableCell>
                  <TableCell align="right">{Number(v.actual_mileage_miles).toFixed(1)}</TableCell>
                  <TableCell align="right">{money((Number(v.actual_mileage_miles) || 0) * (Number(v.mileage_rate_pence) || 0))}</TableCell>
                  <TableCell><Chip label={v.vehicle_type || 'car'} size="small" sx={{ bgcolor: '#F3F4F6' }} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={policyDialog} onClose={() => setPolicyDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add mileage policy</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField select label="Vehicle type" value={policyForm.vehicle_type} onChange={e => setPolicyForm(f => ({ ...f, vehicle_type: e.target.value }))}>
              <MenuItem value="car">Car</MenuItem>
              <MenuItem value="van">Van</MenuItem>
              <MenuItem value="motorcycle">Motorcycle</MenuItem>
              <MenuItem value="bicycle">Bicycle</MenuItem>
            </TextField>
            <TextField select label="Fuel type" value={policyForm.fuel_type} onChange={e => setPolicyForm(f => ({ ...f, fuel_type: e.target.value }))}>
              <MenuItem value="petrol">Petrol</MenuItem>
              <MenuItem value="diesel">Diesel</MenuItem>
              <MenuItem value="electric">Electric</MenuItem>
              <MenuItem value="hybrid">Hybrid</MenuItem>
            </TextField>
            <TextField label="Rate (pence per mile)" type="number" inputProps={{ min: 0 }} value={policyForm.rate_pence_per_mile} onChange={e => setPolicyForm(f => ({ ...f, rate_pence_per_mile: e.target.value }))} />
            <TextField label="Tax year" value={policyForm.tax_year} onChange={e => setPolicyForm(f => ({ ...f, tax_year: e.target.value }))} helperText="e.g. 2024/25" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPolicyDialog(false)}>Cancel</Button>
          <Button variant="contained" disabled={!policyForm.rate_pence_per_mile || createPolicy.isPending} onClick={() => createPolicy.mutate({ ...policyForm, rate_pence_per_mile: Number(policyForm.rate_pence_per_mile) })}>
            {createPolicy.isPending ? <CircularProgress size={18} /> : 'Add policy'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
