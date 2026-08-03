import { usePageMeta } from '../../components/PageMeta'
import { useState } from 'react'
import { Box, Button, TextField, Typography, Paper, Container, Link, Alert, CircularProgress, Stack } from '@mui/material'
import { useNavigate } from 'react-router-dom'

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
    } catch (err) {
      setError('Failed to connect to the server.')
    } finally {
      setLoading(false)
    }
  }

  usePageMeta({ title: 'Forgot Password | MeticleCare', description: 'Reset your MeticleCare account password.', noindex: true })

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', bgcolor: '#020617' }}>
      <Container maxWidth="xs">
        <Paper className="glass-morphism" sx={{ p: 4 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, color: 'white' }}>
            Recovery
          </Typography>
          <Typography variant="body2" color="#94a3b8" sx={{ mb: 4 }}>
            Enter your email to receive a password reset link.
          </Typography>

          {submitted ? (
            <Alert severity="success" sx={{ bgcolor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              If an account exists for {email}, you will receive a reset link shortly.
              <Button sx={{ mt: 2, color: '#10b981' }} onClick={() => navigate('/login')}>Back to Login</Button>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit}>
              <Stack spacing={3}>
                <TextField
                  fullWidth
                  label="Email Address"
                  variant="outlined"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                {error && <Typography color="error" variant="caption">{error}</Typography>}
                <Button fullWidth variant="contained" type="submit" disabled={loading} sx={{ py: 1.5, bgcolor: '#10b981', fontWeight: 700 }}>
                  {loading ? <CircularProgress size={24} color="inherit" /> : 'Send Reset Link'}
                </Button>
                <Link 
                  component="button" 
                  variant="body2" 
                  onClick={() => navigate('/login')}
                  sx={{ color: '#94a3b8', textDecoration: 'none', '&:hover': { color: 'white' } }}
                >
                  Return to Login
                </Link>
              </Stack>
            </form>
          )}
        </Paper>
      </Container>
    </Box>
  )
}
