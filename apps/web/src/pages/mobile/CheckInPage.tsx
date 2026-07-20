import { useState } from 'react'
import { Box, Typography, Paper, Button, Stack, CircularProgress, Alert, Chip } from '@mui/material'
import { GpsFixed as GpsIcon, CheckCircle as CheckIcon } from '@mui/icons-material'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../../services/api'

export default function CheckInPage() {
  const [status, setStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [error, setError] = useState('')

  const checkInMutation = useMutation({
    mutationFn: (data: any) => api.post('/mobile/check-in', data),
    onSuccess: () => { setStatus('success') },
    onError: (e: any) => { setError(e.response?.data?.message || 'Check-in failed'); setStatus('error') },
  })

  const doCheckIn = () => {
    setStatus('checking'); setError('')
    if (!navigator.geolocation) { setError('Geolocation not supported on this device'); setStatus('error'); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setCoords({ lat: latitude, lng: longitude })
        checkInMutation.mutate({ latitude, longitude, accuracy: pos.coords.accuracy })
      },
      (err) => { setError(`Location access denied: ${err.message}`); setStatus('error') },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    )
  }

  const { data: recentCheckins } = useQuery({
    queryKey: ['mobile-checkins'],
    queryFn: () => api.get('/mobile/check-ins').then(r => r.data),
  })

  return (
    <Box sx={{ p: 2.5 }}>
      <Typography variant="h6" fontWeight={800} sx={{ mb: 3, color: '#0F4C81' }}>
        <GpsIcon sx={{ mr: 1, verticalAlign: 'middle' }} /> SecureVisit Check-In
      </Typography>

      {status === 'idle' && (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3, border: '1px solid #E5E7EB' }}>
          <GpsIcon sx={{ fontSize: 64, color: '#0F4C81', mb: 2, opacity: 0.3 }} />
          <Typography variant="body1" fontWeight={600} sx={{ mb: 1 }}>Ready to check in</Typography>
          <Typography variant="body2" color="#6B7280" sx={{ mb: 3 }}>
            Your GPS location will be recorded to verify you are at the service location.
          </Typography>
          <Button variant="contained" size="large" startIcon={<GpsIcon />} onClick={doCheckIn}
            sx={{ bgcolor: '#16A34A', textTransform: 'none', borderRadius: 3, px: 4, py: 1.5 }}>
            Check In Now
          </Button>
        </Paper>
      )}

      {status === 'checking' && (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
          <CircularProgress size={60} sx={{ mb: 2, color: '#0F4C81' }} />
          <Typography>Getting your location...</Typography>
        </Paper>
      )}

      {status === 'success' && (
        <Paper sx={{ p: 3, textAlign: 'center', borderRadius: 3, bgcolor: '#DCFCE7', border: '1px solid #BBF7D0' }}>
          <CheckIcon sx={{ fontSize: 64, color: '#16A34A', mb: 1 }} />
          <Typography variant="h6" fontWeight={800} color="#16A34A">Checked In!</Typography>
          {coords && (
            <Typography variant="caption" color="#6B7280" sx={{ mt: 1, display: 'block' }}>
              GPS: {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
            </Typography>
          )}
          <Button size="small" sx={{ mt: 2, textTransform: 'none' }} onClick={() => { setStatus('idle'); setCoords(null) }}>
            Check In Again
          </Button>
        </Paper>
      )}

      {status === 'error' && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} action={
          <Button size="small" onClick={() => setStatus('idle')}>Retry</Button>
        }>{error}</Alert>
      )}

      <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 4, mb: 1.5 }}>Recent Check-Ins</Typography>
      <Stack spacing={1}>
        {(recentCheckins || []).slice(0, 10).map((c: any) => (
          <Paper key={c.id} sx={{ p: 1.5, borderRadius: 2, border: '1px solid #E5E7EB' }}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" fontWeight={600}>{c.location_name || 'Check-in'}</Typography>
              <Chip label="Verified" size="small" color="success" />
            </Stack>
            <Typography variant="caption" color="#6B7280">
              {new Date(c.checked_in_at).toLocaleString('en-GB')}
            </Typography>
          </Paper>
        ))}
        {(!recentCheckins || recentCheckins.length === 0) && (
          <Typography variant="body2" color="#9CA3AF" sx={{ textAlign: 'center', py: 2 }}>No recent check-ins</Typography>
        )}
      </Stack>
    </Box>
  )
}
