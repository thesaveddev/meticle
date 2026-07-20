import { useEffect, useState } from 'react'
import { Box, Typography, Container, CircularProgress, Button } from '@mui/material'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle as CheckCircleIcon, Error as ErrorIcon } from '@mui/icons-material'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Missing verification token.')
      return
    }

    const verify = async () => {
      try {
        const res = await fetch(`/api/auth/verify-email?token=${token}`, { method: 'POST' })
        const data = await res.json()
        if (res.ok) {
          setStatus('success')
        } else {
          setStatus('error')
          setMessage(data.message || 'Verification failed.')
        }
      } catch (err) {
        setStatus('error')
        setMessage('Network error occurred.')
      }
    }

    verify()
  }, [token])

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', bgcolor: '#020617' }}>
      <Container maxWidth="sm">
        <Box className="glass-morphism" sx={{ p: 6, textAlign: 'center' }}>
          {status === 'loading' && (
            <>
              <CircularProgress sx={{ mb: 3, color: '#10b981' }} />
              <Typography variant="h5" color="white">Verifying your account...</Typography>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircleIcon sx={{ fontSize: 80, color: '#10b981', mb: 3 }} />
              <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', mb: 2 }}>Account Verified!</Typography>
              <Typography sx={{ color: '#94a3b8', mb: 4 }}>
                Your email has been successfully verified. You can now log in to your CareDesk dashboard.
              </Typography>
              <Button variant="contained" fullWidth sx={{ bgcolor: '#10b981', py: 1.5, fontWeight: 700 }} onClick={() => navigate('/login')}>
                Go to Login
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <ErrorIcon sx={{ fontSize: 80, color: '#ef4444', mb: 3 }} />
              <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', mb: 2 }}>Verification Error</Typography>
              <Typography sx={{ color: '#94a3b8', mb: 4 }}>{message}</Typography>
              <Button variant="outlined" fullWidth sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.2)' }} onClick={() => navigate('/')}>
                Back to Home
              </Button>
            </>
          )}
        </Box>
      </Container>
    </Box>
  )
}
