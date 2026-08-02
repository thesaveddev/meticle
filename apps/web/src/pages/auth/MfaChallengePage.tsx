import { useState } from 'react'
import { Box, Typography, Container, TextField, Button, Alert, CircularProgress, Stack, Paper } from '@mui/material'
import { useNavigate, useLocation } from 'react-router-dom'
import api from '../../services/api'
import posthog from '../../lib/posthog'

export default function MfaChallengePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const mfaToken = (location.state as any)?.mfaToken
  const email = (location.state as any)?.email

  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showLostAccess, setShowLostAccess] = useState(false)

  if (!mfaToken) {
    navigate('/login')
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token.trim()) { setError('Please enter your authentication code.'); return }
    setLoading(true)
    setError('')
    try {
      const response = await api.post('/auth/mfa/verify-login', { mfaToken, token: token.trim() })
      localStorage.setItem('accessToken', response.data.accessToken)
      localStorage.setItem('refreshToken', response.data.refreshToken)
      localStorage.setItem('user', JSON.stringify(response.data.user))
      if (response.data.user?.id) {
        posthog.identify(response.data.user.id, {
          email: response.data.user.email,
          name: response.data.user.name,
          role: response.data.user.role,
        })
      }
      const role = response.data.user?.role
      navigate(role === 'SUPER_ADMIN' ? '/platform-admin' : '/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#F8FAFC' }}>
      <Container maxWidth="xs">
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 900, color: '#0F4C81', mb: 1 }}>Meticle</Typography>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#111827' }}>Two-Factor Authentication</Typography>
          <Typography sx={{ color: '#6B7280', mt: 1 }}>
            Enter the code from your authenticator app{email ? ` (${email})` : ''}.
          </Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={3}>
            <TextField
              fullWidth
              label="Authentication Code"
              placeholder="000000"
              value={token}
              onChange={e => setToken(e.target.value)}
              autoFocus
              inputProps={{
                style: { textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' }
              }}
            />
            <Button fullWidth type="submit" variant="contained" size="large" disabled={loading}
              sx={{ bgcolor: '#0F4C81', py: 1.8, fontWeight: 700, borderRadius: 2, textTransform: 'none' }}>
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Verify'}
            </Button>

            {!showLostAccess ? (
              <Typography
                onClick={() => setShowLostAccess(true)}
                sx={{ cursor: 'pointer', textAlign: 'center', color: '#6B7280', fontSize: '0.85rem', textDecoration: 'none', '&:hover': { color: '#0F4C81', textDecoration: 'underline' } }}>
                Lost access to your authenticator?
              </Typography>
            ) : (
              <Paper sx={{ p: 2, bgcolor: '#F9FAFB' }}>
                <Stack spacing={1.5}>
                  <Typography variant="body2" color="#6B7280" sx={{ textAlign: 'center' }}>
                    Contact your organization administrator to reset your MFA. They can reset it from the Staff Directory, allowing you to log in and set up a new authenticator.
                  </Typography>
                  <Button fullWidth variant="text" onClick={() => setShowLostAccess(false)} sx={{ textTransform: 'none', color: '#9CA3AF' }}>
                    Back
                  </Button>
                </Stack>
              </Paper>
            )}

            <Button fullWidth variant="text" onClick={() => navigate('/login')} sx={{ textTransform: 'none', color: '#9CA3AF' }}>
              Back to Login
            </Button>
          </Stack>
        </Box>
      </Container>
    </Box>
  )
}
