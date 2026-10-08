import { usePageMeta } from '../../components/PageMeta'
import { useEffect, useState } from 'react'
import { Box, Typography, Link } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { MarkEmailRead as MailIcon } from '@mui/icons-material'
import api, { withRateLimitRetry, rateLimitMessage } from '../../services/api'
import AuthLayout from '../../components/auth/AuthLayout'
import {
  AuthHeader, AuthField, AuthInput, AuthButton, AuthError, AuthBackLink,
} from '../../components/auth/AuthPrimitives'

const FORGOT_FEATURES = [
  { icon: 'notes' as const, title: 'Single-use links', description: 'Each reset link works once.' },
  { icon: 'person' as const, title: 'Verified addresses', description: 'Sent only to registered emails.' },
  { icon: 'medication' as const, title: 'One hour', description: 'Links expire for your security.' },
  { icon: 'schedule' as const, title: 'UK hosted', description: 'Encrypted, GDPR focused.' },
]

/**
 * Forgot password. The response is deliberately neutral — the API returns the
 * same message whether or not the address exists, and so does this page. The
 * "If an account exists…" wording is an anti-enumeration requirement, not a
 * turn of phrase, and must stay conditional.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendIn, setResendIn] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn(resendIn - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  const requestReset = async () => {
    setError('')
    setLoading(true)
    try {
      // withRateLimitRetry: a per-IP limit returns `Retry-After`, and a shared
      // office on one IP should wait a few seconds out rather than see an
      // error. silentError because this page reports its own failures inline.
      await withRateLimitRetry(() => api.post('/auth/forgot-password', { email }, { silentError: true }))
      setSubmitted(true)
      setResendIn(60)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await requestReset()
  }

  usePageMeta({ title: 'Reset Password | Meticle Care', description: 'Reset your Meticle Care account password.', noindex: true })

  return (
    <AuthLayout
      heading={<>Better care<br />starts here.</>}
      supporting="A simpler, smarter way to manage daily care, keep people safe, and stay compliant."
      features={FORGOT_FEATURES}
    >
      {submitted ? (
        <>
          <Box
            aria-hidden
            sx={{ width: 48, height: 48, borderRadius: '14px', bgcolor: 'var(--mc-info-soft, var(--mc-info-soft))', color: 'var(--mc-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2.5 }}
          >
            <MailIcon sx={{ fontSize: 24 }} />
          </Box>
          <AuthHeader
            title="Check your email"
            supporting={`If an account exists for ${email.trim() || 'that address'}, we've sent you a secure password reset link.`}
          />
          <AuthButton type="button" onClick={() => navigate('/login')}>
            Back to sign in
          </AuthButton>
          <Typography sx={{ textAlign: 'center', fontSize: 14, color: 'var(--mc-text-secondary)', mt: 3 }}>
            Didn't receive the email?{' '}
            {resendIn > 0 ? (
              <Typography component="span" sx={{ color: 'var(--mc-text-muted)' }}>
                Resend available in 00:{String(resendIn).padStart(2, '0')}
              </Typography>
            ) : (
              <Link
                component="button"
                type="button"
                onClick={requestReset}
                underline="hover"
                sx={{ color: 'var(--mc-primary)', fontWeight: 600, fontSize: 'inherit' }}
              >
                Resend email
              </Link>
            )}
          </Typography>
        </>
      ) : (
        <>
          <AuthHeader
            title="Forgot your password?"
            supporting="Enter your email address and we'll send you a secure link to reset your password."
          />
          {error && <AuthError message={error} onClose={() => setError('')} />}
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Box sx={{ display: 'grid', gap: 3 }}>
              <AuthField label="Email address" htmlFor="forgot-email">
                <AuthInput
                  id="forgot-email"
                  value={email}
                  onChange={setEmail}
                  type="email"
                  placeholder="name@organization.com"
                  autoComplete="email"
                  autoFocus
                />
              </AuthField>
              <AuthButton loading={loading} loadingLabel="Sending reset link…">
                Send reset link →
              </AuthButton>
            </Box>
          </Box>
          <AuthBackLink label="Back to sign in" to="/login" />
        </>
      )}
    </AuthLayout>
  )
}
