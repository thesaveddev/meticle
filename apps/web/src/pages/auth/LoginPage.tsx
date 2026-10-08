import { usePageMeta } from '../../components/PageMeta'
import { useState } from 'react'
import { Box, Typography } from '@mui/material'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import AuthLayout from '../../components/auth/AuthLayout'
import {
  AuthHeader, AuthField, AuthInput, AuthPasswordInput,
  AuthButton, AuthError, AuthFooterLine,
} from '../../components/auth/AuthPrimitives'

const LOGIN_FEATURES = [
  { icon: 'notes' as const, title: 'Daily care notes', description: 'Capture and share care in real time.' },
  { icon: 'person' as const, title: 'Support plans', description: 'Keep support up to date.' },
  { icon: 'medication' as const, title: 'Medication', description: 'eMAR with audit trails.' },
  { icon: 'schedule' as const, title: 'Staff scheduling', description: 'Right people, at the right time.' },
]

export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
      if (role === 'SUPER_ADMIN') {
        navigate('/platform-admin')
      } else if (response.data.organization && response.data.organization.onboarding_completed === false) {
        navigate('/onboarding')
      } else {
        navigate('/dashboard')
      }
    } catch (err: any) {
      const msg = err.response?.data?.message
      if (msg) {
        setError(msg)
      } else if (err.code === 'ERR_NETWORK') {
        setError('Unable to connect to the server. Please check your internet connection and try again.')
      } else {
        setError('Unable to sign in. Your email or password may be incorrect.')
      }
    } finally {
      setLoading(false)
    }
  }

  usePageMeta({ title: 'Login | Meticle Care', description: 'Log in to your Meticle Care care management account.', noindex: true })

  return (
    <AuthLayout
      heading={<>Better care<br />starts here.</>}
      supporting="A simpler, smarter way to manage daily care, keep people safe, and stay compliant."
      features={LOGIN_FEATURES}
    >
      <AuthHeader title="Sign in" supporting="Access your MeticleCare account." />

      {justRegistered && (
        <Box
          role="status"
          sx={{ bgcolor: 'var(--mc-success-soft, var(--mc-success-soft))', border: '1px solid var(--mc-success-border)', borderRadius: '12px', px: 2, py: 1.5, mb: 3 }}
        >
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'var(--mc-success-text)' }}>Account created. You can sign in now.</Typography>
        </Box>
      )}
      {error && <AuthError message={error} onClose={() => setError('')} />}

      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Box sx={{ display: 'grid', gap: 3 }}>
          <AuthField label="Email address" htmlFor="login-email">
            <AuthInput
              id="login-email"
              value={email}
              onChange={setEmail}
              type="email"
              placeholder="name@organization.com"
              autoComplete="email"
              autoFocus
            />
          </AuthField>

          <AuthField label="Password" htmlFor="login-password">
            <AuthPasswordInput
              id="login-password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
          </AuthField>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Typography
              component="button"
              type="button"
              onClick={() => navigate('/forgot-password')}
              sx={{
                background: 'none', border: 'none', p: 0, cursor: 'pointer', font: 'inherit',
                fontSize: 13.5, fontWeight: 600, color: 'var(--mc-primary)',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              Forgot password?
            </Typography>
          </Box>

          <AuthButton loading={loading} loadingLabel="Signing in…">
            Sign in →
          </AuthButton>
        </Box>
      </Box>

      <AuthFooterLine prompt="Don't have an account?" action="Get in touch" onAction={() => navigate('/register')} />
    </AuthLayout>
  )
}
