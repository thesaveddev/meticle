import { usePageMeta } from '../../components/PageMeta'
import { useState } from 'react'
import {
  TextField, Button, Box, Typography, Container,
  Link, Stack, CircularProgress, InputAdornment,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { MarkEmailRead as MailIcon } from '@mui/icons-material'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setSubmitted(true)
      } else {
        setError('Something went wrong. Please try again.')
      }
    } catch {
      setError('Failed to connect to the server.')
    } finally {
      setLoading(false)
    }
  }

  usePageMeta({ title: 'Reset Password | MeticleCare', description: 'Reset your MeticleCare account password.', noindex: true })

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: 'white' }}>
      <Box sx={{
        flex: { xs: 1, md: 0.8, lg: 0.6 },
        display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4,
      }}>
        <Container maxWidth="xs" sx={{ mx: 'auto' }}>
          <Box sx={{ mb: 6 }}>
            <Typography
              variant="h4"
              sx={{ fontWeight: 900, color: '#0F4C81', letterSpacing: '-1.5px', cursor: 'pointer', mb: 1 }}
              onClick={() => navigate('/')}
            >
              Meticle
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#111827', mb: 1 }}>
              Reset your password
            </Typography>
            <Typography sx={{ color: '#6B7280' }}>
              Enter your email and we'll send you a reset link.
            </Typography>
          </Box>

          {error && (
            <Box sx={{
              mb: 3, p: 2, borderRadius: 2,
              bgcolor: '#FEF2F2', border: '1px solid #FECACA',
            }}>
              <Typography variant="body2" sx={{ color: '#991B1B', fontWeight: 500 }}>{error}</Typography>
            </Box>
          )}

          {submitted ? (
            <Box>
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 1.5, mb: 3,
                p: 2.5, borderRadius: 2, bgcolor: '#F0FDF4', border: '1px solid #BBF7D0',
              }}>
                <MailIcon sx={{ color: '#16A34A', fontSize: 22 }} />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#166534' }}>Check your inbox</Typography>
                  <Typography variant="caption" sx={{ color: '#15803D' }}>
                    If an account exists for {email}, you'll receive a reset link shortly.
                  </Typography>
                </Box>
              </Box>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => navigate('/login')}
                sx={{
                  borderColor: '#E5E7EB', color: '#374151', fontWeight: 600,
                  textTransform: 'none', borderRadius: 2, py: 1.5,
                  '&:hover': { borderColor: '#D1D5DB', bgcolor: '#F9FAFB' },
                }}
              >
                Back to sign in
              </Button>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={3}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: '#374151' }}>Email address</Typography>
                  <TextField
                    fullWidth
                    placeholder="name@organization.com"
                    variant="outlined"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    autoComplete="email"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <MailIcon sx={{ color: '#9CA3AF', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        '&.Mui-focused fieldset': { borderColor: '#0F4C81' },
                      },
                    }}
                  />
                </Box>

                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading}
                  sx={{
                    bgcolor: '#0F4C81', py: 1.8, fontWeight: 700,
                    borderRadius: 2, fontSize: '1rem', textTransform: 'none',
                    '&:hover': { bgcolor: '#0D3F6E' },
                  }}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : 'Send reset link'}
                </Button>

                <Box sx={{ mt: 4, pt: 4, borderTop: '1px solid #E5E7EB', textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ color: '#6B7280' }}>
                    Remember your password?{' '}
                    <Link
                      onClick={() => navigate('/login')}
                      sx={{ color: '#0F4C81', cursor: 'pointer', fontWeight: 700, textDecoration: 'none' }}
                    >
                      Sign in
                    </Link>
                  </Typography>
                </Box>
              </Stack>
            </Box>
          )}
        </Container>
      </Box>

      <Box sx={{
        flex: { xs: 0, md: 1.2, lg: 1.6 },
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column', bgcolor: '#F8FAFC', p: 8,
        alignItems: 'center', justifyContent: 'center',
        borderLeft: '1px solid #E5E7EB',
      }}>
        <Box sx={{ maxWidth: '480px', textAlign: 'left' }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#111827', mb: 1.5, lineHeight: 1.3 }}>
            Your data stays safe
          </Typography>
          <Typography sx={{ color: '#6B7280', lineHeight: 1.7 }}>
            Password resets are sent only to verified email addresses. The link expires in 1 hour and can only be used once.
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
