import { usePageMeta } from '../../components/PageMeta'
import { useState } from 'react'
import { Box, Typography, Link } from '@mui/material'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import AuthLayout from '../../components/auth/AuthLayout'
import {
  AuthHeader, AuthField, AuthPasswordInput,
  AuthButton, AuthError,
} from '../../components/auth/AuthPrimitives'
import PasswordRequirements, { RESET_PASSWORD_RULES } from '../../components/auth/PasswordRequirements'
import ResetSuccessPage from './ResetSuccessPage'
import ResetExpiredPage from './ResetExpiredPage'
import ResetInvalidPage from './ResetInvalidPage'

const RESET_FEATURES = [
  { icon: 'notes' as const, title: 'Single-use link', description: 'Expires once used.' },
  { icon: 'person' as const, title: 'One hour', description: 'Then it stops working.' },
  { icon: 'medication' as const, title: 'Encrypted', description: 'Password never shown to anyone.' },
  { icon: 'schedule' as const, title: 'UK hosted', description: 'Secure by design.' },
]

/**
 * Reset password entry route. Three kinds of arrival:
 *  - no token in the URL → invalid-link page
 *  - token + successful reset → success page
 *  - token rejected by the server → expired/invalid page (neutral wording;
 *    the API reports both conditions the same way, so we never show token
 *    details or distinguish what an attacker could use)
 */
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState<'form' | 'success' | 'expired' | 'invalid'>('form')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  usePageMeta({ title: 'Reset Password | Meticle Care', description: 'Set a new password for your Meticle Care account.', noindex: true })

  if (!token && status === 'form') {
    return <ResetInvalidPage />
  }

  if (status === 'success') return <ResetSuccessPage />
  if (status === 'expired') return <ResetExpiredPage />
  if (status === 'invalid') return <ResetInvalidPage />

  const passwordValid = RESET_PASSWORD_RULES.every(r => r.test(newPassword))
  const confirmTouched = confirmPassword.length > 0
  const passwordsMatch = newPassword === confirmPassword
  const canReset = passwordValid && confirmTouched && passwordsMatch

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!passwordsMatch) return setError("Passwords don't match.")
    if (!passwordValid) return setError('Your password does not meet all the requirements yet.')
    setLoading(true)
    try {
      // Uses the shared client (not raw fetch like the old page) so global
      // auth/error interceptors apply consistently.
      await api.post('/auth/reset-password', { token, newPassword }, { silentError: true })
      setStatus('success')
    } catch (err: any) {
      if (err?.response?.status === 400) {
        // Invalid OR expired — one neutral destination, no token details.
        setStatus('expired')
      } else if (err?.code === 'ERR_NETWORK') {
        setError('Failed to connect to the server. Please try again.')
      } else {
        setError(err?.response?.data?.message || 'Could not reset your password. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      heading={<>Better care<br />starts here.</>}
      supporting="A simpler, smarter way to manage daily care, keep people safe, and stay compliant."
      features={RESET_FEATURES}
    >
      <AuthHeader title="Create a new password" supporting="Choose a new password for your MeticleCare account." />
      {error && <AuthError message={error} onClose={() => setError('')} />}

      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Box sx={{ display: 'grid', gap: 3 }}>
          <AuthField label="New password" htmlFor="reset-password">
            <AuthPasswordInput
              id="reset-password"
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
              autoFocus
            />
            <PasswordRequirements password={newPassword} />
          </AuthField>

          <AuthField label="Confirm new password" htmlFor="reset-confirm">
            <AuthPasswordInput
              id="reset-confirm"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              error={confirmTouched && !passwordsMatch}
              aria-describedby={confirmTouched && !passwordsMatch ? 'reset-confirm-error' : undefined}
            />
            {confirmTouched && !passwordsMatch && (
              <Typography id="reset-confirm-error" role="alert" sx={{ fontSize: 12.5, color: 'var(--mc-danger, var(--mc-danger))', mt: 0.75 }}>
                Passwords don't match.
              </Typography>
            )}
          </AuthField>

          <AuthButton loading={loading} loadingLabel="Resetting password…" disabled={!canReset}>
            Reset password →
          </AuthButton>
        </Box>
      </Box>

      <Typography sx={{ textAlign: 'center', fontSize: 14, color: 'var(--mc-text-secondary)', mt: 4 }}>
        Remembered it?{' '}
        <Link component="button" type="button" onClick={() => navigate('/login')} underline="hover" sx={{ color: 'var(--mc-primary)', fontWeight: 600, fontSize: 'inherit' }}>
          Back to sign in
        </Link>
      </Typography>
    </AuthLayout>
  )
}
