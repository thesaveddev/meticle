import { useState } from 'react'
import { Box, Typography, Container, TextField, Button, Alert, CircularProgress, Stack, Link, Paper } from '@mui/material'
import { useNavigate, useLocation } from 'react-router-dom'
import api from '../../services/api'

export default function MfaChallengePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const mfaToken = (location.state as any)?.mfaToken
  const email = (location.state as any)?.email

  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showOptions, setShowOptions] = useState(false)
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [sendingCodes, setSendingCodes] = useState(false)

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
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSendBackupCodes = async () => {
    setSendingCodes(true)
    setError('')
    try {
      await api.post('/auth/mfa/send-backup-codes', { mfaToken })
      setEmailSent(true)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send backup codes.')
    } finally {
      setSendingCodes(false)
    }
  }

  const handleBackToTotp = () => {
    setUseBackupCode(false)
    setEmailSent(false)
    setShowOptions(false)
    setError('')
  }

  if (emailSent) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#F8FAFC' }}>
        <Container maxWidth="xs">
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography variant="h4" sx={{ fontWeight: 900, color: '#0F4C81', mb: 1 }}>CareDesk</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#111827' }}>Backup Codes Sent</Typography>
          </Box>

          <Alert severity="success" sx={{ mb: 3 }}>
            Check your email{email ? ` (${email})` : ''} for your backup codes. Each code can be used once to log in.
          </Alert>

          <Stack spacing={2}>
            <Typography variant="body2" color="#6B7280" sx={{ textAlign: 'center' }}>
              Enter one of the backup codes from the email to complete sign-in.
            </Typography>

            <TextField
              fullWidth
              label="Backup Code"
              placeholder="XXXXXX-XXXXXX"
              value={token}
              onChange={e => setToken(e.target.value.toUpperCase())}
              autoFocus
              inputProps={{ style: { textAlign: 'center', fontSize: '1.2rem', letterSpacing: '0.2rem', fontFamily: 'monospace' } }}
            />
            <Button fullWidth variant="contained" size="large" disabled={loading || !token.trim()}
              onClick={handleSubmit}
              sx={{ bgcolor: '#0F4C81', py: 1.8, fontWeight: 700, borderRadius: 2, textTransform: 'none' }}>
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Verify Backup Code'}
            </Button>

            <Button fullWidth variant="text" onClick={handleBackToTotp} sx={{ textTransform: 'none' }}>
              Back to authenticator code
            </Button>
          </Stack>
        </Container>
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#F8FAFC' }}>
      <Container maxWidth="xs">
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 900, color: '#0F4C81', mb: 1 }}>CareDesk</Typography>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#111827' }}>Two-Factor Authentication</Typography>
          <Typography sx={{ color: '#6B7280', mt: 1 }}>
            {useBackupCode
              ? `Enter a backup code${email ? ` (${email})` : ''}.`
              : `Enter the code from your authenticator app${email ? ` (${email})` : ''}.`}
          </Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={3}>
            <TextField
              fullWidth
              label={useBackupCode ? 'Backup Code' : 'Authentication Code'}
              placeholder={useBackupCode ? 'XXXXXX-XXXXXX' : '000000'}
              value={token}
              onChange={e => setToken(useBackupCode ? e.target.value.toUpperCase() : e.target.value)}
              autoFocus
              inputProps={{
                style: useBackupCode
                  ? { textAlign: 'center', fontSize: '1.2rem', letterSpacing: '0.2rem', fontFamily: 'monospace' }
                  : { textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' }
              }}
            />
            <Button fullWidth type="submit" variant="contained" size="large" disabled={loading}
              sx={{ bgcolor: '#0F4C81', py: 1.8, fontWeight: 700, borderRadius: 2, textTransform: 'none' }}>
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Verify'}
            </Button>

            {!showOptions && !useBackupCode && (
              <Link
                onClick={() => setShowOptions(true)}
                sx={{ cursor: 'pointer', textAlign: 'center', color: '#6B7280', fontSize: '0.85rem', textDecoration: 'none', '&:hover': { color: '#0F4C81', textDecoration: 'underline' } }}>
                Lost access to your authenticator?
              </Link>
            )}

            {showOptions && !useBackupCode && (
              <Paper sx={{ p: 2, bgcolor: '#F9FAFB' }}>
                <Stack spacing={1.5}>
                  <Typography variant="body2" color="#6B7280" sx={{ textAlign: 'center' }}>
                    Choose a recovery method:
                  </Typography>
                  <Button fullWidth variant="outlined" onClick={() => { setUseBackupCode(true); setShowOptions(false); setError('') }}
                    sx={{ textTransform: 'none', color: '#0F4C81', borderColor: '#0F4C81' }}>
                    Use a backup code
                  </Button>
                  <Button fullWidth variant="outlined" disabled={sendingCodes} onClick={handleSendBackupCodes}
                    sx={{ textTransform: 'none' }}>
                    {sendingCodes ? <CircularProgress size={20} /> : 'Send backup codes to my email'}
                  </Button>
                  <Button fullWidth variant="text" onClick={() => setShowOptions(false)} sx={{ textTransform: 'none', color: '#9CA3AF' }}>
                    Cancel
                  </Button>
                </Stack>
              </Paper>
            )}

            {useBackupCode && (
              <Button fullWidth variant="text" onClick={handleBackToTotp} sx={{ textTransform: 'none' }}>
                Use authenticator code instead
              </Button>
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
