import { Box, Typography, Paper, Grid, Button } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { useState } from 'react'

export default function ShiftCalendar() {
  const [viewDate, setViewDate] = useState(new Date())

  const { data: shifts, isLoading } = useQuery({
    queryKey: ['shifts', viewDate.toISOString()],
    queryFn: async () => {
      const start = new Date(viewDate)
      start.setDate(1)
      const end = new Date(viewDate)
      end.setMonth(end.getMonth() + 1)
      end.setDate(0)
      const response = await api.get(`/shifts?startDate=${start.toISOString()}&endDate=${end.toISOString()}`)
      return response.data
    }
  })

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </Typography>
        <Box>
          <Button onClick={() => {
            const d = new Date(viewDate)
            d.setMonth(d.getMonth() - 1)
            setViewDate(d)
          }}>Previous</Button>
          <Button onClick={() => {
            const d = new Date(viewDate)
            d.setMonth(d.getMonth() + 1)
            setViewDate(d)
          }}>Next</Button>
        </Box>
      </Box>
      <Paper sx={{ p: 2 }}>
        {isLoading ? (
          <Typography>Loading shifts...</Typography>
        ) : (
          <Grid container spacing={2}>
            {/* Very basic calendar grid for MVP */}
            {[...Array(31)].map((_, i) => {
              const dayShifts = shifts?.filter((s: any) => new Date(s.start_time).getDate() === i + 1)
              return (
                <Grid item xs={1.7} key={i} sx={{ border: '1px solid #eee', minHeight: 100, p: 1 }}>
                  <Typography variant="caption">{i + 1}</Typography>
                  {dayShifts?.map((s: any) => (
                    <Box key={s.id} sx={{ bgcolor: 'primary.main', color: 'white', p: 0.5, borderRadius: 1, mb: 0.5, fontSize: '0.7rem' }}>
                      {s.location_name}
                    </Box>
                  ))}
                </Grid>
              )
            })}
          </Grid>
        )}
      </Paper>
    </Box>
  )
}
