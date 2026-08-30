import { usePageMeta } from '../../components/PageMeta'
import { useState } from 'react'
import {
  TextField, Button, Box, Typography, Container,
  Link, Stack, CircularProgress, InputAdornment, IconButton,
} from '@mui/material'
import { Visibility, VisibilityOff, LockReset as LockIcon, CheckCircleOutline as CheckIcon } from '@mui/icons-material'
import { useNavigate, useSearchParams } from 'react-router-dom'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) {
      return setError('Passwords do not match')
    }
    if (newPassword.length < 8) {
      return setError('Password must be at least 8 characters')
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      })
      if (res.ok) {
        setSuccess(true)
        setTimeout(() => navigate('/login'), 3000)
      } else {
        const data = await res.json()
        setError(data.message || 'Reset failed')
      }
    } catch {
      setError('Failed to connect to the server')
    } finally {
      setLoading(false)
    }
  }

  usePageMeta({ title: 'Reset Password | MeticleCare', description: 'Set a new password for your MeticleCare account.', noindex: true })

  if (!token) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: 'white' }}>
        <Box sx={{ flex: { xs: 1, md: 0.8, lg: 0.6 }, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
          <Container maxWidth="xs" sx={{ mx: 'auto' }}>
            <Box sx={{ mb: 6 }}>
              <Typography variant="h4" sx={{ fontWeight: 900, color: '#0F4C81', letterSpacing: '-1.5px', cursor: 'pointer', mb: 1 }} onClick={() => navigate('/')}>
                Meticle
              </Typography>
            </Box>
            <Box sx={{ p: 3, borderRadius: 2, bgcolor: '#FEF2F2', border: '1px solid #FECACA' }}>
              <Typography variant="body2" sx={{ color: '#991B1B', fontWeight: 600, mb: 1 }}>Invalid reset link</Typography>
              <Typography variant="body2" sx={{ color: '#991B1B' }}>
                This link is invalid or has expired. Please request a new password reset.
              </Typography>
            </Box>
            <Button fullWidth variant="outlined" onClick={() => navigate('/forgot-password')}
              sx={{ mt: 3, borderColor: '#E5E7EB', color: '#374151', fontWeight: 600, textTransform: 'none', borderRadius: 2, py: 1.5, '&:hover': { borderColor: '#D1D5DB', bgcolor: '#F9FAFB' } }}>
              Request new reset link
            </Button>
          </Container>
        </Box>
        <Box sx={{ flex: { xs: 0, md: 1.2, lg: 1.6 }, display: { xs: 'none', md: 'flex' }, flexDirection: 'column', bgcolor: '#F8FAFC', p: 8, alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid #E5E7EB' }}>
          <Box sx={{ maxWidth: '480px', textAlign: 'left' }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#111827', mb: 1.5, lineHeight: 1.3 }}>Link expired?</Typography>
            <Typography sx={{ color: '#6B7280', lineHeight: 1.7 }}>
              Reset links expire after 1 hour for security. Request a new one and check your inbox.
            </Typography>
          </Box>
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: 'white' }}>
      <Box sx={{ flex: { xs: 1, md: 0.8, lg: 0.6 }, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
        <Container maxWidth="xs" sx={{ mx: 'auto' }}>
          <Box sx={{ mb: 6 }}>
            <Typography variant="h4" sx={{ fontWeight: 900, color: '#0F4C81', letterSpacing: '-1.5px', cursor: 'pointer', mb: 1 }} onClick={() => navigate('/')}>
              Meticle
            </Typography>
            <Box sx={{
              width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '50%', bgcolor: '#EAF2F8', color: '#0F4C81', mb: 3,
            }}>
              <LockIcon sx={{ fontSize: 22 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#111827', mb: 1 }}>Choose a new password</Typography>
            <Typography sx={{ color: '#6B7280', lineHeight: 1.6 }}>Use a password you do not use anywhere else.</Typography>
          </Box>

          {error && (
            <Box sx={{ mb: 3, p: 2, borderRadius: 2, bgcolor: '#FEF2F2', border: '1px solid #FECACA' }}>
              <Typography variant="body2" sx={{ color: '#991B1B', fontWeight: 500 }}>{error}</Typography>
            </Box>
          )}

          {success ? (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, p: 2.5, borderRadius: 2, bgcolor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <CheckIcon sx={{ color: '#16A34A', fontSize: 22 }} />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#166534' }}>Password updated</Typography>
                  <Typography variant="caption" sx={{ color: '#15803D' }}>Redirecting to sign in...</Typography>
                </Box>
              </Box>
              <Button fullWidth variant="outlined" onClick={() => navigate('/login')}
                sx={{ borderColor: '#E5E7EB', color: '#374151', fontWeight: 600, textTransform: 'none', borderRadius: 2, py: 1.5, '&:hover': { borderColor: '#D1D5DB', bgcolor: '#F9FAFB' } }}>
                Sign in now
              </Button>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={3}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: '#374151' }}>New password</Typography>
                  <TextField fullWidth type={showNewPassword ? 'text' : 'password'} placeholder="••••••••" variant="outlined"
                    value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required autoFocus autoComplete="new-password"
                    InputProps={{
                      startAdornment: (<InputAdornment position="start"><LockIcon sx={{ color: '#9CA3AF', fontSize: 20 }} /></InputAdornment>),
                      endAdornment: (<InputAdornment position="end"><IconButton onClick={() => setShowNewPassword(!showNewPassword)} edge="end" size="small">{showNewPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}</IconButton></InputAdornment>),
                    }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, '&.Mui-focused fieldset': { borderColor: '#0F4C81' } } }} />
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: '#374151' }}>Confirm password</Typography>
                  <TextField fullWidth type={showConfirmPassword ? 'text' : 'password'} placeholder="••••••••" variant="outlined"
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required autoComplete="new-password"
                    InputProps={{
                      startAdornment: (<InputAdornment position="start"><LockIcon sx={{ color: '#9CA3AF', fontSize: 20 }} /></InputAdornment>),
                      endAdornment: (<InputAdornment position="end"><IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end" size="small">{showConfirmPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}</IconButton></InputAdornment>),
                    }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, '&.Mui-focused fieldset': { borderColor: '#0F4C81' } } }} />
                </Box>
                <Button fullWidth type="submit" variant="contained" size="large" disabled={loading}
                  sx={{ bgcolor: '#0F4C81', py: 1.8, fontWeight: 700, borderRadius: 2, fontSize: '1rem', textTransform: 'none', '&:hover': { bgcolor: '#0D3F6E' } }}>
                  {loading ? <CircularProgress size={24} color="inherit" /> : 'Save new password'}
                </Button>
                <Box sx={{ mt: 4, pt: 4, borderTop: '1px solid #E5E7EB', textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ color: '#6B7280' }}>
                    Remember your password?{' '}
                    <Link onClick={() => navigate('/login')} sx={{ color: '#0F4C81', cursor: 'pointer', fontWeight: 700, textDecoration: 'none' }}>Sign in</Link>
                  </Typography>
                </Box>
              </Stack>
            </Box>
          )}
        </Container>
      </Box>
      <Box sx={{ flex: { xs: 0, md: 1.2, lg: 1.6 }, display: { xs: 'none', md: 'flex' }, flexDirection: 'column', bgcolor: '#F8FAFC', p: 8, alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid #E5E7EB' }}>
        <Box sx={{ maxWidth: '480px', textAlign: 'left' }}>
          <Typography variant="body2" sx={{ color: '#0F4C81', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 2 }}>
            Account security
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#111827', mb: 1.5, lineHeight: 1.3 }}>A private moment for your account</Typography>
          <Typography sx={{ color: '#6B7280', lineHeight: 1.7 }}>
            This reset link is single-use and expires after one hour. Your password is never shown to anyone at Meticle.
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
