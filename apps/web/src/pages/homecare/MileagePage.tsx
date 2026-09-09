import { useMemo, useState } from 'react'
import { Box, Button, Chip, CircularProgress, Container, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { Download as DownloadIcon } from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'

const money = (pence: number | null | undefined) => pence == null ? '—' : `£${(Number(pence) / 100).toFixed(2)}`

export default function MileagePage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const user = useMemo(() => { try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} } }, [])
  const isManager = user.role === 'ORG_ADMIN' || user.role === 'MANAGER'

  const from = `${month}-01`
  const to = new Date(new Date(from).getFullYear(), new Date(from).getMonth() + 1, 0).toISOString().slice(0, 10)

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ['homecare-visits-mileage', from, to],
    queryFn: () => api.get(isManager ? '/homecare/visits' : '/homecare/my-visits', { params: { from, to } }).then(r => Array.isArray(r.data) ? r.data : []),
  })

  const mileageVisits = visits.filter((v: any) => v.miles != null && Number(v.miles) > 0)
  const totalMiles = mileageVisits.reduce((sum: number, v: any) => sum + (Number(v.miles) || 0), 0)
  const totalMileagePay = mileageVisits.reduce((sum: number, v: any) => sum + (Number(v.mileage_pay_pence) || 0), 0)

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Mileage & Travel</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>Track carer travel between client visits</Typography>
        </Box>
        <Button variant="outlined" startIcon={<DownloadIcon />} sx={{ textTransform: 'none' }}>Export CSV</Button>
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
        <Paper variant="outlined" sx={{ p: 3, flex: 1, textAlign: 'center' }}>
          <Typography variant="h3" sx={{ fontWeight: 800, color: 'primary.main' }}>{totalMiles.toFixed(1)}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>Total miles</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 3, flex: 1, textAlign: 'center' }}>
          <Typography variant="h3" sx={{ fontWeight: 800, color: 'success.main' }}>{money(totalMileagePay)}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>Total mileage pay</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 3, flex: 1, textAlign: 'center' }}>
          <Typography variant="h3" sx={{ fontWeight: 800 }}>{mileageVisits.length}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>Tracked visits</Typography>
        </Paper>
      </Stack>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Carer</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Miles</TableCell>
                <TableCell align="right">Mileage Pay</TableCell>
                <TableCell>Vehicle</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mileageVisits.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: 'text.secondary' }}>No mileage records for this period</TableCell></TableRow>
              ) : mileageVisits.map((v: any) => (
                <TableRow key={v.id}>
                  <TableCell>{v.carer_name || '—'}</TableCell>
                  <TableCell>{v.person_name || '—'}</TableCell>
                  <TableCell>{new Date(v.visit_date || v.scheduled_date).toLocaleDateString('en-GB')}</TableCell>
                  <TableCell align="right">{Number(v.miles).toFixed(1)}</TableCell>
                  <TableCell align="right">{money(v.mileage_pay_pence)}</TableCell>
                  <TableCell><Chip label={v.vehicle_type || 'car'} size="small" variant="outlined" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  )
}
