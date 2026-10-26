import { usePageMeta } from '../../components/PageMeta'
import { useEffect, useState } from 'react'
import { Box, Typography, Link, Checkbox, FormControlLabel, CircularProgress } from '@mui/material'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { UserRole } from '@meticle/shared'
import api, { withRateLimitRetry, rateLimitMessage } from '../../services/api'
import AuthLayout from '../../components/auth/AuthLayout'
import {
  AuthHeader, AuthField, AuthInput, AuthPasswordInput,
  AuthButton, AuthError, AuthFooterLine,
} from '../../components/auth/AuthPrimitives'
import PasswordRequirements, { RESET_PASSWORD_RULES } from '../../components/auth/PasswordRequirements'

// Identical brand panel to /signup and /login: same four features, same shell,
// so every auth entry point reads as one page.
const REGISTER_FEATURES = [
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
 * /register on the shared auth shell (AuthLayout + AuthPrimitives), matching
 * /login and /signup pixel-for-pixel: same card, same inputs, same buttons.
 * Keeps its one job the other pages don't have — accepting an organisation
 * invitation (?token): the email is prefilled and pre-verified, the heading
 * names the organisation, and submit calls register-with-invitation.
 */
export default function RegisterPage() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [invitation, setInvitation] = useState<{ email: string; role: string; organizationName: string } | null>(null)
  const [invitationLoading, setInvitationLoading] = useState(false)

  const [codeSent, setCodeSent] = useState(false)
  const [emailVerified, setEmailVerified] = useState(false)
  const [code, setCode] = useState('')
  const [sendingCode, setSendingCode] = useState(false)
  const [verifyingCode, setVerifyingCode] = useState(false)
  const [resendIn, setResendIn] = useState(0)

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) return
    setInvitationLoading(true)
    api.get(`/organizations/invitation/validate?token=${token}`)
      .then((res) => {
        setInvitation(res.data)
        setEmail(res.data.email)
        setEmailVerified(true) // Invitations don't need email verification
      })
      .catch(() => setError('This invitation link is invalid or has expired.'))
      .finally(() => setInvitationLoading(false))
  }, [token])

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn(resendIn - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  // Email changed → verification must be redone against the new address
  // (invited emails are fixed, so this only applies to self-registration).
  useEffect(() => {
    if (invitation) return
    setEmailVerified(false)
    setCodeSent(false)
    setCode('')
  }, [email, invitation])

  const passwordValid = RESET_PASSWORD_RULES.every(r => r.test(password))
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const confirmTouched = confirm.length > 0
  const passwordsMatch = password === confirm
  const canCreate = passwordValid && confirmTouched && passwordsMatch
    && (emailVerified || !!invitation) && firstName.trim() && emailValid && termsAccepted && !loading

  const handleSendCode = async () => {
    if (!emailValid || invitation) return
    setSendingCode(true)
    setError('')
    try {
      // Waits out a per-IP rate limit rather than failing. A care home is one
      // office on one IP address, so a whole team pressing this button at once
      // is the normal case during onboarding, not an edge case. Per-recipient
      // limits still surface immediately, because no amount of waiting helps
      // those.
      await withRateLimitRetry(() => api.post('/auth/send-email-code', { email: email.trim() }))
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
    if (!canCreate) {
      if (password !== confirm) setError('Passwords do not match')
      else if (!emailVerified && !invitation) setError('Please verify your email address before continuing')
      else if (!termsAccepted) setError('You must agree to the Terms and Conditions to create an account')
      return
    }
    setLoading(true)
    setError('')
    try {
      const name = `${firstName.trim()} ${lastName.trim()}`.trim()
      // Both branches sit behind the same per-IP registration limit, and an
      // invited staff member is the *most* likely person to hit it: they are
      // one of a dozen colleagues registering from the same office connection
      // in the same few minutes. Waits the limit out rather than failing.
      let res
      if (token && invitation) {
        res = await withRateLimitRetry(() => api.post('/auth/register-with-invitation', {
          token,
          name,
          password,
        }))
      } else {
        res = await withRateLimitRetry(() => api.post('/auth/register', {
          email: email.trim(),
          password,
          role: UserRole.ORG_ADMIN,
          name,
        }))
      }

      const storedUser = res.data.user
      storedUser.first_name = firstName.trim()
      // Registration is a sign-in: the API set the session cookies on the
      // response, so the browser is already authenticated for the onboarding
      // step this navigates to. No token is kept.
      localStorage.setItem('user', JSON.stringify(storedUser))

      if (token) {
        navigate('/dashboard')
      } else {
        navigate('/onboarding')
      }
    } catch (err: any) {
      setError(err?.response?.status === 429
        ? rateLimitMessage(err, 'Too many people are registering at once. Please try again shortly.')
        : apiErrorMsg(err, 'Something went wrong. Please try again later.'))
    } finally {
      setLoading(false)
    }
  }

  usePageMeta({ title: 'Create Account | Meticle Care', description: 'Create a MeticleCare account after your organisation has been invited or approved for access.', noindex: true })

  const heading = invitation ? <>Join {invitation.organizationName}.</> : <>Care management,<br />without the complexity.</>
  const supporting = invitation
    ? `You've been invited to join ${invitation.organizationName} as ${invitation.role === 'MANAGER' ? 'a Manager' : 'a Staff Member'}. Set your password to get started.`
    : 'Bring care records, people, medication, staffing and compliance together in one secure platform.'

  if (invitationLoading) {
    return (
      <AuthLayout heading={heading} supporting={supporting} features={REGISTER_FEATURES}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }} role="status" aria-live="polite">
          <CircularProgress />
        </Box>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout heading={heading} supporting={supporting} features={REGISTER_FEATURES}>
      <AuthHeader
        title={invitation ? 'Complete your registration' : 'Create your account'}
        supporting={invitation ? 'Set your password to join your organization.' : 'Start managing care with MeticleCare.'}
      />

      {error && <AuthError message={error} onClose={() => setError('')} />}

      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Box sx={{ display: 'grid', gap: 3 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <AuthField label="First name" htmlFor="register-first">
              <AuthInput id="register-first" value={firstName} onChange={setFirstName} autoComplete="given-name" placeholder="Jane" />
            </AuthField>
            <AuthField label="Last name" htmlFor="register-last">
              <AuthInput id="register-last" value={lastName} onChange={setLastName} autoComplete="family-name" placeholder="Mason" required={false} />
            </AuthField>
          </Box>

          <AuthField label="Work email" htmlFor="register-email">
            <AuthInput
              id="register-email"
              value={email}
              onChange={setEmail}
              type="email"
              placeholder="name@organization.com"
              autoComplete="email"
              disabled={!!invitation || emailVerified}
              error={email.length > 3 && !emailValid}
            />
          </AuthField>

          {/* Email verification — the backend refuses registration until the
              address is verified, so this step sits in the form, not after it.
              Invited emails arrive pre-verified via the token. */}
          {!invitation && !emailVerified ? (
            <Box
              sx={{
                border: '1px solid var(--mc-border)',
                borderRadius: '12px',
                p: 2,
                bgcolor: 'var(--mc-surface-hover)',
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
                      id="register-code"
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
            <Box role="status" sx={{ bgcolor: 'var(--mc-success-soft)', border: '1px solid var(--mc-success-border)', borderRadius: '12px', px: 2, py: 1.5 }}>
              <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: 'var(--mc-success-text)' }}>Email verified ✓</Typography>
            </Box>
          )}

          <AuthField label="Password" htmlFor="register-password">
            <AuthPasswordInput id="register-password" value={password} onChange={setPassword} autoComplete="new-password" />
            <PasswordRequirements password={password} />
          </AuthField>

          <AuthField label="Confirm password" htmlFor="register-confirm">
            <AuthPasswordInput
              id="register-confirm"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              error={confirmTouched && !passwordsMatch}
              aria-describedby={confirmTouched && !passwordsMatch ? 'register-confirm-error' : undefined}
            />
            {confirmTouched && !passwordsMatch && (
              <Typography id="register-confirm-error" role="alert" sx={{ fontSize: 12.5, color: 'var(--mc-danger, var(--mc-danger))', mt: 0.75 }}>
                Passwords don't match.
              </Typography>
            )}
          </AuthField>

          <FormControlLabel
            control={
              <Checkbox
                checked={termsAccepted}
                onChange={e => setTermsAccepted(e.target.checked)}
                sx={{ color: 'var(--mc-border)', '&.Mui-checked': { color: 'var(--mc-primary)' } }}
              />
            }
            label={
              <Typography sx={{ fontSize: 13, color: 'var(--mc-text-secondary)' }}>
                I agree to the{' '}
                <Link href="/terms" underline="hover" sx={{ color: 'var(--mc-primary)', fontWeight: 500 }}>Terms of Service</Link>
                {' '}and{' '}
                <Link href="/privacy" underline="hover" sx={{ color: 'var(--mc-primary)', fontWeight: 500 }}>Privacy Policy</Link>.
              </Typography>
            }
            sx={{ m: 0 }}
          />

          <AuthButton loading={loading} loadingLabel={invitation ? 'Joining…' : 'Creating account…'} disabled={!canCreate}>
            {invitation ? 'Join organization →' : 'Create account →'}
          </AuthButton>
        </Box>
      </Box>

      <AuthFooterLine prompt="Already have an account?" action="Sign in" onAction={() => navigate('/login')} />
    </AuthLayout>
  )
}
