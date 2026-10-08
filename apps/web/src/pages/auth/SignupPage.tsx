import { usePageMeta } from '../../components/PageMeta'
import { useEffect, useState } from 'react'
import { Box, Typography, Link } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import api, { withRateLimitRetry, rateLimitMessage } from '../../services/api'
import AuthLayout from '../../components/auth/AuthLayout'
import {
  AuthHeader, AuthField, AuthInput, AuthPasswordInput,
  AuthButton, AuthError, AuthFooterLine,
} from '../../components/auth/AuthPrimitives'
import PasswordRequirements, { RESET_PASSWORD_RULES } from '../../components/auth/PasswordRequirements'

const SIGNUP_FEATURES = [
  { icon: 'notes' as const, title: 'Care records', description: 'Person-centred support.' },
  { icon: 'medication' as const, title: 'Medication management', description: 'Safe, audited eMAR.' },
  { icon: 'person' as const, title: 'People you support', description: 'One record per person.' },
  { icon: 'schedule' as const, title: 'Staff scheduling', description: 'Right people, at the right time.' },
]

function apiErrorMsg(err: any, fallback: string): string {
  const data = err?.response?.data
  if (data?.errors?.length) return data.errors[0].message
  if (data?.message) return data.message
  if (err?.code === 'ERR_NETWORK') return 'Unable to connect to the server. Please check your internet connection and try again.'
  return fallback
}

/**
 * Lightweight signup: the registration backend requires a verified email
 * before the account can be created, so the form sends a 6-digit code to the
 * work email first — the same flow /register uses, in the new web shell.
 * The password rules mirror the server's registerSchema exactly.
 */
export default function SignupPage() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [codeSent, setCodeSent] = useState(false)
  const [emailVerified, setEmailVerified] = useState(false)
  const [code, setCode] = useState('')
  const [sendingCode, setSendingCode] = useState(false)
  const [verifyingCode, setVerifyingCode] = useState(false)
  const [resendIn, setResendIn] = useState(0)

  const navigate = useNavigate()

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn(resendIn - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  // Email changed → verification must be redone against the new address.
  useEffect(() => {
    setEmailVerified(false)
    setCodeSent(false)
    setCode('')
  }, [email])

  const passwordValid = RESET_PASSWORD_RULES.every(r => r.test(password))
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const confirmTouched = confirm.length > 0
  const passwordsMatch = password === confirm
  const canCreate = passwordValid && confirmTouched && passwordsMatch && emailVerified && firstName.trim() && emailValid

  const handleSendCode = async () => {
    if (!emailValid) return
    setSendingCode(true)
    setError('')
    try {
      await withRateLimitRetry(() => api.post('/auth/send-email-code', { email: email.trim() }, { silentError: true }))
      setCodeSent(true)
      setResendIn(60)
    } catch (err: any) {
      setError(err?.response?.status === 429
        ? rateLimitMessage(err, 'Too many verification codes requested. Please wait a few minutes and try again.')
        : apiErrorMsg(err, 'Failed to send the verification code.'))
    } finally {
      setSendingCode(false)
    }
  }

  const handleVerifyCode = async () => {
    if (code.trim().length !== 6) return
    setVerifyingCode(true)
    setError('')
    try {
      await api.post('/auth/verify-email-code', { email: email.trim(), code: code.trim() })
      setEmailVerified(true)
    } catch (err: any) {
      setError(apiErrorMsg(err, 'That code did not match. Check the email and try again.'))
    } finally {
      setVerifyingCode(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canCreate) return
    setLoading(true)
    setError('')
    try {
      const name = `${firstName.trim()} ${lastName.trim()}`.trim()
      await api.post('/auth/register', {
        email: email.trim(),
        password,
        role: 'ORG_ADMIN',
        name,
      })
      navigate('/login?registered=true')
    } catch (err: any) {
      setError(apiErrorMsg(err, 'Account creation failed. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  usePageMeta({ title: 'Sign Up | Meticle Care', description: 'Create your Meticle Care account.', noindex: true })

  return (
    <AuthLayout
      heading={<>Care management,<br />without the complexity.</>}
      supporting="Bring care records, people, medication, staffing and compliance together in one secure platform."
      features={SIGNUP_FEATURES}
    >
      <AuthHeader title="Create your account" supporting="Start managing care with MeticleCare." />

      {error && <AuthError message={error} onClose={() => setError('')} />}

      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Box sx={{ display: 'grid', gap: 3 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <AuthField label="First name" htmlFor="signup-first">
              <AuthInput id="signup-first" value={firstName} onChange={setFirstName} autoComplete="given-name" placeholder="Jane" />
            </AuthField>
            <AuthField label="Last name" htmlFor="signup-last">
              <AuthInput id="signup-last" value={lastName} onChange={setLastName} autoComplete="family-name" placeholder="Mason" required={false} />
            </AuthField>
          </Box>

          <AuthField label="Work email" htmlFor="signup-email">
            <AuthInput
              id="signup-email"
              value={email}
              onChange={setEmail}
              type="email"
              placeholder="name@organization.com"
              autoComplete="email"
              error={email.length > 3 && !emailValid}
            />
          </AuthField>

          {/* Email verification — the backend refuses registration until the
              address is verified, so this step sits in the form, not after it. */}
          {!emailVerified ? (
            <Box
              sx={{
                border: '1px solid var(--mc-border)',
                borderRadius: '12px',
                p: 2.5,
                bgcolor: 'var(--mc-surface-soft, var(--mc-surface-hover))',
              }}
            >
              {!codeSent ? (
                <>
                  <Typography sx={{ fontSize: 13.5, color: 'var(--mc-text-secondary)', mb: 1.5 }}>
                    Verify your work email to finish creating your account.
                  </Typography>
                  <AuthButton
                    type="button"
                    loading={sendingCode}
                    loadingLabel="Sending code…"
                    disabled={!emailValid}
                    onClick={handleSendCode}
                  >
                    Send verification code
                  </AuthButton>
                </>
              ) : (
                <>
                  <Typography sx={{ fontSize: 13.5, color: 'var(--mc-text-secondary)', mb: 1.5 }}>
                    Enter the 6-digit code we sent to <strong>{email.trim()}</strong>.
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 1.5, alignItems: 'start' }}>
                    <AuthInput
                      id="signup-code"
                      value={code}
                      onChange={v => setCode(v.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      autoComplete="one-time-code"
                      inputMode="numeric"
                    />
                    <AuthButton type="button" loading={verifyingCode} loadingLabel="Verifying…" disabled={code.length !== 6} onClick={handleVerifyCode}>
                      Verify
                    </AuthButton>
                  </Box>
                  <Typography sx={{ fontSize: 12.5, color: 'var(--mc-text-muted)', mt: 1.5 }}>
                    {resendIn > 0
                      ? `Resend available in 00:${String(resendIn).padStart(2, '0')}`
                      : (
                        <Link component="button" type="button" onClick={handleSendCode} underline="hover" sx={{ color: 'var(--mc-primary)', fontWeight: 600 }}>
                          Resend email
                        </Link>
                      )}
                  </Typography>
                </>
              )}
            </Box>
          ) : (
            <Box role="status" sx={{ bgcolor: 'var(--mc-success-soft, var(--mc-success-soft))', border: '1px solid var(--mc-success-border)', borderRadius: '12px', px: 2, py: 1.5 }}>
              <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: 'var(--mc-success-text)' }}>Email verified ✓</Typography>
            </Box>
          )}

          <AuthField label="Password" htmlFor="signup-password">
            <AuthPasswordInput id="signup-password" value={password} onChange={setPassword} autoComplete="new-password" />
            <PasswordRequirements password={password} />
          </AuthField>

          <AuthField label="Confirm password" htmlFor="signup-confirm">
            <AuthPasswordInput
              id="signup-confirm"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              error={confirmTouched && !passwordsMatch}
              aria-describedby={confirmTouched && !passwordsMatch ? 'signup-confirm-error' : undefined}
            />
            {confirmTouched && !passwordsMatch && (
              <Typography id="signup-confirm-error" role="alert" sx={{ fontSize: 12.5, color: 'var(--mc-danger, var(--mc-danger))', mt: 0.75 }}>
                Passwords don't match.
              </Typography>
            )}
          </AuthField>

          <Typography sx={{ fontSize: 13, color: 'var(--mc-text-secondary)' }}>
            By creating an account you agree to our{' '}
            <Link href="/terms" underline="hover" sx={{ color: 'var(--mc-primary)', fontWeight: 500 }}>Terms of Service</Link>
            {' '}and{' '}
            <Link href="/privacy" underline="hover" sx={{ color: 'var(--mc-primary)', fontWeight: 500 }}>Privacy Policy</Link>.
          </Typography>

          <AuthButton loading={loading} loadingLabel="Creating account…" disabled={!canCreate}>
            Create account →
          </AuthButton>
        </Box>
      </Box>

      <AuthFooterLine prompt="Already have an account?" action="Sign in" onAction={() => navigate('/login')} />
    </AuthLayout>
  )
}
