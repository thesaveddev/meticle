import { useState } from 'react'
import { Box, Button, TextField, Typography, Paper, Container, Stack, Alert, IconButton, InputAdornment } from '@mui/material'
import { Visibility, VisibilityOff } from '@mui/icons-material'
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
    } catch (err) {
      setError('Failed to connect to the server')
    }
  }

  if (!token) {
    return (
      <Container maxWidth="xs" sx={{ mt: 10 }}>
        <Alert severity="error">Invalid reset link. Please request a new one.</Alert>
      </Container>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', bgcolor: '#020617' }}>
      <Container maxWidth="xs">
        <Paper className="glass-morphism" sx={{ p: 4 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, color: 'white' }}>
            New Password
          </Typography>
          <Typography variant="body2" color="#94a3b8" sx={{ mb: 4 }}>
            Set a strong, 8+ character password.
          </Typography>

          {success ? (
            <Alert severity="success" sx={{ bgcolor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              Password reset successful. Redirecting to login...
            </Alert>
          ) : (
            <form onSubmit={handleSubmit}>
              <Stack spacing={3}>
                <TextField
                  fullWidth
                  label="New Password"
                  type={showNewPassword ? 'text' : 'password'}
                  variant="outlined"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowNewPassword(!showNewPassword)} edge="end" size="small">
                          {showNewPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  fullWidth
                  label="Confirm New Password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  variant="outlined"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end" size="small">
                          {showConfirmPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                {error && <Typography color="error" variant="caption">{error}</Typography>}
                <Box sx={{ textAlign: 'center' }}>
                  <Button variant="contained" type="submit" sx={{ px: 6, py: 1.5, bgcolor: '#10b981', fontWeight: 700 }}>
                    Reset Password
                  </Button>
                </Box>
              </Stack>
            </form>
          )}
        </Paper>
      </Container>
    </Box>
  )
}
