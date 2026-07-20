import { useState } from 'react'
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, Chip, Stack, TablePagination, CircularProgress, Alert } from '@mui/material'
import { ArrowBack as BackIcon } from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useSnackbar } from '../../context/SnackbarContext'

export default function ComplianceRecordsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { showSnackbar } = useSnackbar()
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState(10)
  const [error, setError] = useState('')

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['compliance-records'],
    queryFn: () => api.get('/compliance/records').then(r => r.data).catch(() => []),
  })

  const seedMutation = useMutation({
    mutationFn: () => api.post('/compliance/seed-records'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['compliance-records'] }); showSnackbar('Records seeded.', 'success') },
    onError: (e: any) => setError(e.response?.data?.message || 'Failed'),
  })

  const updateMutation = useMutation({
    mutationFn: (d: { id: string; status: string }) => api.patch(`/compliance/records/${d.id}`, { status: d.status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['compliance-records'] }); showSnackbar('Record updated.', 'success') },
  })

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /></Box>

  return (
    <Box>
      <Button startIcon={<BackIcon />} onClick={() => navigate('/compliance')} sx={{ mb: 2, color: '#0F4C81', fontWeight: 600 }}>
        Back to Compliance
      </Button>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={800}>Compliance Records</Typography>
        <Button variant="outlined" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}
          sx={{ textTransform: 'none' }}>
          {seedMutation.isPending ? 'Seeding...' : 'Seed Records'}
        </Button>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #E5E7EB' }}>
        <Table size="small">
          <TableHead><TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Staff</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Requirement</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Last Checked</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">Action</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {records.slice(page * rows, page * rows + rows).map((r: any) => (
              <TableRow key={r.id} hover>
                <TableCell sx={{ fontWeight: 600 }}>{r.staff_name || '—'}</TableCell>
                <TableCell>{r.requirement_name || '—'}</TableCell>
                <TableCell>
                  <Chip label={r.status} size="small" color={r.status === 'complete' ? 'success' : r.status === 'expiring' ? 'warning' : 'error'} />
                </TableCell>
                <TableCell>{r.last_checked_at ? new Date(r.last_checked_at).toLocaleDateString('en-GB') : '—'}</TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => updateMutation.mutate({ id: r.id, status: r.status === 'complete' ? 'incomplete' : 'complete' })}
                    sx={{ textTransform: 'none', fontSize: '0.7rem' }}>
                    {r.status === 'complete' ? 'Mark Incomplete' : 'Mark Complete'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {records.length === 0 && <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: '#9CA3AF' }}>No records. Click "Seed Records" to auto-assign profiles.</TableCell></TableRow>}
          </TableBody>
        </Table>
        <TablePagination component="div" count={records.length} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rows} onRowsPerPageChange={e => { setRows(parseInt(e.target.value, 10)); setPage(0) }} rowsPerPageOptions={[5, 10, 25]} />
      </TableContainer>
    </Box>
  )
}
