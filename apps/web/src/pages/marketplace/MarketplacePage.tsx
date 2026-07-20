import { Box, Typography, Paper, Grid, Button, Card, CardContent, CardActions, Chip } from '@mui/material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'

export default function MarketplacePage() {
  const queryClient = useQueryClient()

  const { data: shifts, isLoading } = useQuery({
    queryKey: ['marketplaceShifts'],
    queryFn: async () => {
      const response = await api.get('/marketplace/shifts')
      return response.data
    }
  })

  const applyMutation = useMutation({
    mutationFn: async (shiftId: string) => {
      // Mocking staffId for now
      return api.post(`/marketplace/apply/${shiftId}`, { staffId: 'mock-id' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplaceShifts'] })
    }
  })

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Workforce Marketplace
      </Typography>
      <Typography variant="body1" sx={{ mb: 4 }}>
        Browse and apply for available open shifts.
      </Typography>

      {isLoading ? (
        <Typography>Loading available shifts...</Typography>
      ) : (
        <Grid container spacing={3}>
          {shifts?.map((shift: any) => (
            <Grid item xs={12} md={6} lg={4} key={shift.id}>
              <Card raised>
                <CardContent>
                  <Typography variant="h6">{shift.location_name}</Typography>
                  <Typography color="text.secondary">
                    {new Date(shift.start_time).toLocaleString()} - {new Date(shift.end_time).toLocaleTimeString()}
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Chip label={shift.status} color="primary" size="small" />
                  </Box>
                </CardContent>
                <CardActions>
                  <Button 
                    size="small" 
                    variant="contained" 
                    fullWidth 
                    onClick={() => applyMutation.mutate(shift.id)}
                    disabled={applyMutation.isPending}
                  >
                    Apply for Shift
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
          {shifts?.length === 0 && (
            <Grid item xs={12}>
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography>No open shifts available in the marketplace right now.</Typography>
              </Paper>
            </Grid>
          )}
        </Grid>
      )}
    </Box>
  )
}
