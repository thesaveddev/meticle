import { usePageMeta } from '../../components/PageMeta'
import { useState } from 'react'
import {
  TextField, Button, Box, Typography, Container,
  Link, Stack, CircularProgress, InputAdornment, Alert,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { MarkEmailRead as MailIcon } from '@mui/icons-material'
import api, { withRateLimitRetry, rateLimitMessage } from '../../services/api'

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
      // Now uses the shared axios client rather than raw `fetch`, for one reason:
      // a per-IP rate limit returns `Retry-After`, and raw fetch threw that away.
      // A shared office where several staff forget their password on the same
      // morning used to get "Something went wrong" for what is really a few
      // seconds of congestion. It now waits the limit out, and if it cannot,
      // says how long to wait.
      // `silentError` because this page reports its own failures. The shared
      // client raises a global toast on 4xx unless the path is skipped, and
      // this path is not in that skip list — so without it a rejected request
      // shows both a toast and the inline message below.
      await withRateLimitRetry(() => api.post('/auth/forgot-password', { email }, { silentError: true }))
      setSubmitted(true)
    } catch (err: any) {
      if (err?.response?.status === 429) {
        setError(rateLimitMessage(err, 'Too many password reset requests. Please try again shortly.'))
      } else if (err?.code === 'ERR_NETWORK') {
        setError('Failed to connect to the server.')
      } else {
        setError(err?.response?.data?.message || 'Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  usePageMeta({ title: 'Reset Password | Meticle Care', description: 'Reset your Meticle Care account password.', noindex: true })

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: 'background.default', color: 'text.primary' }}>
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
              Meticle Care
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}>
              Reset your password
            </Typography>
            <Typography sx={{ color: 'text.secondary' }}>
              Enter your email and we'll send you a reset link.
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {submitted ? (
            <Box>
              {/* MUI Alert, not a hand-built coloured box.

                  This notice was a div with `bgcolor: 'success.light'` and a
                  hardcoded `#166534` label on top. `success.light` is a
                  mid-saturated green in MUI's *light* palette, but the palette
                  is theme-driven and this app persists a dark mode
                  (ThemeContext writes `mode` to localStorage). In dark mode
                  `success.light` is still that same green while `#166534` is
                  near-black forest green — the confirmation a carer is asked to
                  trust became the least legible thing on the page, and the
                  `#BBF7D0` border read as a glowing outline. Alert derives its
                  background, text and icon from the active palette, so it is
                  correct in both modes. */}
              <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }} icon={<MailIcon fontSize="inherit" />}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>Check your inbox</Typography>
                <Typography variant="caption" sx={{ display: 'block' }}>
                  If an account exists for {email}, you'll receive a reset link shortly.
                </Typography>
                {/* The wording above is deliberately conditional and must stay
                    that way: telling someone "we sent you an email" when no
                    account exists tells an attacker which addresses are
                    registered, which is why the API returns one identical
                    response either way.

                    The likeliest reason someone reaches this page and receives
                    nothing is simply that they have never signed up. Showing
                    that link to everyone, unconditionally, is safe — it
                    distinguishes nothing, because it appears whether or not
                    the address is registered. Without it the only available
                    action is to resubmit the form, which sends nothing. */}
                <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                  Never had an account?{' '}
                  <Link
                    component="button"
                    type="button"
                    onClick={() => navigate('/register')}
                    underline="hover"
                    sx={{ color: 'primary.main', fontWeight: 600, fontSize: 'inherit' }}
                  >
                    Create one
                  </Link>
                </Typography>
              </Alert>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => navigate('/login')}
                sx={{
                  borderColor: 'divider', color: 'text.primary', fontWeight: 600,
                  textTransform: 'none', borderRadius: 2, py: 1.5,
                  '&:hover': { borderColor: 'text.secondary', bgcolor: 'action.hover' },
                }}
              >
                Back to sign in
              </Button>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={3}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: 'text.primary' }}>Email address</Typography>
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
                          <MailIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
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

                <Box sx={{ mt: 4, pt: 4, borderTop: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
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
        flexDirection: 'column', bgcolor: 'background.paper', p: 8,
        alignItems: 'center', justifyContent: 'center',
        borderLeft: '1px solid', borderColor: 'divider',
      }}>
        <Box sx={{ maxWidth: '480px', textAlign: 'left' }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', mb: 1.5, lineHeight: 1.3 }}>
            Your data stays safe
          </Typography>
          <Typography sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
            Password resets are sent only to verified email addresses. The link expires in 1 hour and can only be used once.
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
