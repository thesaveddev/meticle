import { Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'

export default function ComplianceWidget() {
  const { data: expiringDocs, isLoading } = useQuery({
    queryKey: ['expiringDocuments'],
    queryFn: async () => {
      const response = await api.get('/compliance/expiring?days=30')
      return response.data
    }
  })

  if (isLoading) return <Typography>Loading compliance...</Typography>

  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Typography variant="h6" gutterBottom>
        Expiring Documents (Next 30 Days)
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Staff</TableCell>
              <TableCell>Document</TableCell>
              <TableCell>Expiry</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {expiringDocs?.length > 0 ? (
              expiringDocs.map((doc: any) => (
                <TableRow key={doc.id}>
                  <TableCell>{doc.staff_name || 'Staff'}</TableCell>
                  <TableCell>{doc.type}</TableCell>
                  <TableCell>{new Date(doc.expiry_date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Chip label="Expiring" color="warning" size="small" />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} align="center">No documents expiring soon</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  )
}
