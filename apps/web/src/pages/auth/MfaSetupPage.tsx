import { usePageMeta } from '../../components/PageMeta'
import { useState, useEffect } from 'react'
import { Box, Typography, Container, TextField, Button, Alert, CircularProgress, Stack, Paper } from '@mui/material'
import { useNavigate, useLocation } from 'react-router-dom'
import api from '../../services/api'

export default function MfaSetupPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const setupToken = (location.state as any)?.mfaSetupToken
  const email = (location.state as any)?.email
  usePageMeta({ title: 'Set Up Two-Factor Authentication | MeticleCare', description: 'Configure two-factor authentication for your MeticleCare account.', noindex: true })

  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)

  useEffect(() => {
    if (!setupToken) {
      navigate('/login')
      return
    }
    const fetchQr = async () => {
      try {
        const res = await api.post('/mfa/setup', {}, { headers: { Authorization: `Bearer ${setupToken}` } })
        setQrCode(res.data.qrCode)
        setSecret(res.data.secret)
      } catch {
        setError('Failed to generate MFA setup. Please try logging in again.')
      }
    }
    fetchQr()
  }, [setupToken, navigate])

  if (!setupToken) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token.trim()) { setError('Enter the code from your authenticator app.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/auth/mfa/complete-setup', { setupToken, token: token.trim() })
      localStorage.setItem('accessToken', res.data.accessToken)
      localStorage.setItem('refreshToken', res.data.refreshToken)
      localStorage.setItem('user', JSON.stringify(res.data.user))
      setBackupCodes(res.data.backupCodes || [])
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error?.message || 'Invalid code. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (backupCodes) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#F8FAFC' }}>
        <Container maxWidth="sm">
          <Paper sx={{ p: 4, borderRadius: 2 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 2, color: '#0F4C81' }}>MFA Enabled Successfully</Typography>
            <Alert severity="warning" sx={{ mb: 3 }}>
              Save these 8 backup codes. Each can be used once to log in if you lose access to your authenticator app.
            </Alert>
            <Stack spacing={1} sx={{ mb: 3 }}>
              {backupCodes.map((code, i) => (
                <Paper key={i} variant="outlined" sx={{ p: 1.5, textAlign: 'center', bgcolor: '#F9FAFB' }}>
                  <Typography sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.1rem', letterSpacing: 2 }}>{code}</Typography>
                </Paper>
              ))}
            </Stack>
            <Button fullWidth variant="contained" onClick={() => {
              const raw = localStorage.getItem('user')
              let u: any = null
              try { u = raw ? JSON.parse(raw) : null } catch { u = null }
              navigate(u?.role === 'SUPER_ADMIN' ? '/platform-admin' : '/dashboard')
            }}
              sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' }, py: 1.5, fontWeight: 700 }}>
              Go to Dashboard
            </Button>
          </Paper>
        </Container>
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#F8FAFC' }}>
      <Container maxWidth="sm">
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 900, color: '#0F4C81', mb: 1 }}>Meticle</Typography>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#111827' }}>Set Up Multi-Factor Authentication</Typography>
          <Typography sx={{ color: '#6B7280', mt: 1 }}>
            Your organisation requires MFA. Scan the QR code with your authenticator app{email ? ` (${email})` : ''}.
          </Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        <Paper sx={{ p: 4, textAlign: 'center', mb: 3 }}>
          {qrCode ? (
            <Box sx={{ mb: 3 }}>
              <img src={qrCode} alt="MFA QR Code" style={{ width: 200, height: 200 }} />
              <Typography variant="body2" color="#6B7280" sx={{ mt: 1 }}>
                Scan with Google Authenticator, Microsoft Authenticator, or Authy
              </Typography>
              {secret && (
                <Typography variant="caption" sx={{ display: 'block', mt: 1, fontFamily: 'monospace', color: '#9CA3AF', wordBreak: 'break-all' }}>
                  Secret: {secret}
                </Typography>
              )}
            </Box>
          ) : (
            <CircularProgress size={32} sx={{ my: 4 }} />
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={3}>
              <TextField
                fullWidth
                label="Authentication Code"
                placeholder="000000"
                value={token}
                onChange={e => setToken(e.target.value)}
                autoFocus
                inputProps={{ maxLength: 6, style: { textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' } }}
              />
              <Button fullWidth type="submit" variant="contained" size="large" disabled={loading || !qrCode}
                sx={{ bgcolor: '#0F4C81', py: 1.8, fontWeight: 700, borderRadius: 2, textTransform: 'none' }}>
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Verify & Enable MFA'}
              </Button>
            </Stack>
          </Box>
        </Paper>

        <Button fullWidth variant="text" onClick={() => navigate('/login')} sx={{ textTransform: 'none' }}>
          Back to Login
        </Button>
      </Container>
    </Box>
  )
}
