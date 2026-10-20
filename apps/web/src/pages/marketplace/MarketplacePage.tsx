import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Typography,
} from '@mui/material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'

/**
 * Open shifts a worker can apply for.
 *
 * The apply call carries no staff id. It used to send `staffId: 'mock-id'`,
 * which the API's uuid validator rejected — every press was a 400 dressed up as
 * a working button. Who is applying is a fact about the session, so the API
 * resolves the caller's own staff profile and this page does not guess at it.
 */
export default function MarketplacePage() {
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState<{ severity: 'success' | 'error'; text: string } | null>(null)

  const { data: shifts, isLoading } = useQuery({
    queryKey: ['marketplaceShifts'],
    queryFn: async () => {
      const response = await api.get('/marketplace/shifts')
      return response.data
    }
  })

  const applyMutation = useMutation({
    mutationFn: async (shiftId: string) => {
      return api.post(`/marketplace/apply/${shiftId}`, {})
    },
    onSuccess: () => {
      setNotice({ severity: 'success', text: 'You have applied for this shift. A manager will confirm it.' })
      queryClient.invalidateQueries({ queryKey: ['marketplaceShifts'] })
    },
    onError: (error: any) => {
      setNotice({
        severity: 'error',
        text: error?.response?.data?.message || 'Could not apply for this shift. Please try again.',
      })
    },
  })

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Workforce Marketplace
      </Typography>
      <Typography variant="body1" sx={{ mb: 3 }}>
        Browse and apply for available open shifts.
      </Typography>

      {notice && (
        <Alert severity={notice.severity} onClose={() => setNotice(null)} sx={{ mb: 3 }}>
          {notice.text}
        </Alert>
      )}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress aria-label="Loading open shifts" />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {shifts?.map((shift: any) => {
            const applying = applyMutation.isPending && applyMutation.variables === shift.id
            return (
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
                      disabled={applyMutation.isPending}
                      onClick={() => {
                        setNotice(null)
                        applyMutation.mutate(shift.id)
                      }}
                      startIcon={applying ? <CircularProgress size={16} color="inherit" /> : undefined}
                    >
                      {applying ? 'Applying…' : 'Apply for Shift'}
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            )
          })}
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
