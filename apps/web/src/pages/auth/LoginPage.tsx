import { useState } from 'react'
import {
  TextField, Button, Box, Typography, Container, FormControlLabel,
  Link, Stack, Alert, CircularProgress, Divider, InputAdornment, IconButton,
  Checkbox,
} from '@mui/material'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import { Security as SecurityIcon, Visibility, VisibilityOff } from '@mui/icons-material'

const LOGIN_ILLUSTRATION = '/login-page.jpg';

export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()

  const justRegistered = searchParams.get('registered') === 'true'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) { setError('Email and password are required.'); return }
    setLoading(true)
    setError('')
    try {
      const response = await api.post('/auth/login', { email: email.trim(), password })
      if (response.data.forcePasswordReset) {
        setError(response.data.message || 'A password reset has been requested. Check your email.')
        return
      }
      if (response.data.mfaRequired) {
        navigate('/mfa-challenge', { state: { mfaToken: response.data.mfaToken, email: email.trim() } })
        return
      }
      if (response.data.mfaSetupRequired) {
        navigate('/mfa-setup', { state: { mfaSetupToken: response.data.mfaSetupToken, email: email.trim() } })
        return
      }
      localStorage.setItem('accessToken', response.data.accessToken)
      localStorage.setItem('refreshToken', response.data.refreshToken)
      localStorage.setItem('user', JSON.stringify(response.data.user))
      const role = response.data.user?.role
      navigate(role === 'SUPER_ADMIN' ? '/platform-admin' : '/dashboard')
    } catch (err: any) {
      const msg = err.response?.data?.message
      if (msg) {
        setError(msg)
      } else if (err.code === 'ERR_NETWORK') {
        setError('Unable to connect to the server. Please check your internet connection and try again.')
      } else {
        setError('Something went wrong. Please try again later.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: 'white' }}>
      <Box sx={{ flex: { xs: 1, md: 0.8, lg: 0.6 }, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
        <Container maxWidth="xs" sx={{ mx: 'auto' }}>
          <Box sx={{ mb: 6 }}>
            <Typography variant="h4" sx={{ fontWeight: 900, color: '#0F4C81', letterSpacing: '-1.5px', cursor: 'pointer', mb: 1 }} onClick={() => navigate('/')}>
              Meticle
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#111827', mb: 1 }}>Welcome back</Typography>
            <Typography sx={{ color: '#6B7280' }}>Care operations, unified.</Typography>
          </Box>

          {justRegistered && (
            <Alert severity="success" sx={{ mb: 4, borderRadius: 2 }}>Registration successful! You can now sign in.</Alert>
          )}
          {error && (
            <Alert severity="error" sx={{ mb: 4, borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: '#374151' }}>Work Email</Typography>
                <TextField fullWidth placeholder="name@organization.com" variant="outlined"
                  value={email} onChange={e => setEmail(e.target.value)}
                  autoFocus autoComplete="email" />
              </Box>

              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#374151' }}>Password</Typography>
                  <Link onClick={() => navigate('/forgot-password')} sx={{ color: '#0F4C81', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}>
                    Forgot password?
                  </Link>
                </Stack>
                <TextField fullWidth type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••" variant="outlined"
                  value={password} onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }} />
              </Box>

              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <FormControlLabel
                  control={<Checkbox sx={{ color: '#E5E7EB', '&.Mui-checked': { color: '#0F4C81' } }} />}
                  label={<Typography variant="body2" sx={{ color: '#6B7280' }}>Remember me</Typography>}
                />
              </Stack>

              <Button fullWidth type="submit" variant="contained" size="large" disabled={loading}
                sx={{ bgcolor: '#0F4C81', py: 1.8, fontWeight: 700, borderRadius: 2, fontSize: '1rem', textTransform: 'none' }}>
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign in to dashboard'}
              </Button>

              <Box sx={{ mt: 4, pt: 4, borderTop: '1px solid #E5E7EB', textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: '#6B7280' }}>
                  Don't have an account?{' '}
                  <Link onClick={() => navigate('/register')} sx={{ color: '#0F4C81', cursor: 'pointer', fontWeight: 700, textDecoration: 'none' }}>
                    Sign Up Free
                  </Link>
                </Typography>
              </Box>
            </Stack>
          </Box>

          <Box sx={{ mt: 8, display: 'flex', alignItems: 'center', gap: 1, color: '#9CA3AF' }}>
            <SecurityIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption" sx={{ fontWeight: 600 }}>SSO Ready & Enterprise Secure</Typography>
          </Box>
        </Container>
      </Box>

      <Box sx={{
        flex: { xs: 0, md: 1.2, lg: 1.6 },
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column', bgcolor: '#F8FAFC', p: 8,
        alignItems: 'center', justifyContent: 'center',
        borderLeft: '1px solid #E5E7EB'
      }}>
        <Box sx={{ maxWidth: '600px', textAlign: 'center' }}>
          <img src={LOGIN_ILLUSTRATION} alt="Trust Illustration" style={{ width: '90%', marginBottom: '40px' }} />
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#111827', mb: 2 }}>"The gold standard for care operations."</Typography>
          <Typography color="#6B7280">Join 1,000+ care providers running on Meticle.</Typography>
          <Stack direction="row" spacing={3} sx={{ mt: 6, justifyContent: 'center' }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0F4C81' }}>100%</Typography>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#9CA3AF' }}>Audit Ready</Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0F4C81' }}>99.9%</Typography>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#9CA3AF' }}>Uptime SLA</Typography>
            </Box>
          </Stack>
        </Box>
      </Box>
    </Box>
  )
}