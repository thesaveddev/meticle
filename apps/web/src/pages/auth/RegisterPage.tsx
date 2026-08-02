import { useState, useEffect } from 'react'
import { TextField, Button, Box, Typography, Container, Stack, Link, Alert, CircularProgress, MenuItem, InputAdornment, IconButton, Checkbox, FormControlLabel } from '@mui/material'
import { useForm } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { UserRole } from '@meticle/shared'
import api from '../../services/api'
import posthog from '../../lib/posthog'
import { CheckCircle as CheckIcon, Security as SecurityIcon, Visibility, VisibilityOff, MarkEmailRead as VerifiedIcon } from '@mui/icons-material'

const REGISTER_ILLUSTRATION = '/signup-page.jpg';

const PASSWORD_RULES = [
  { key: 'min', label: 'At least 8 characters', test: (v: string) => v.length >= 8 },
  { key: 'upper', label: 'One uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { key: 'lower', label: 'One lowercase letter', test: (v: string) => /[a-z]/.test(v) },
  { key: 'number', label: 'One number', test: (v: string) => /[0-9]/.test(v) },
  { key: 'special', label: 'One special character', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
]

function apiErrorMsg(err: any, fallback: string): string {
  const data = err?.response?.data
  if (data?.errors?.length) return data.errors[0].message
  if (data?.message) return data.message
  if (err?.code === 'ERR_NETWORK') return 'Unable to connect to the server. Please check your internet connection and try again.'
  return fallback
}

export default function RegisterPage() {
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [invitation, setInvitation] = useState<{ email: string; role: string; organizationName: string } | null>(null)
  const [invitationLoading, setInvitationLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const password = watch('password', '')
  const confirmPassword = watch('confirmPassword', '')
  const email = watch('email', '')
  const termsAccepted = watch('termsAccepted', false)
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword

  // Email verification state
  const [emailVerified, setEmailVerified] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [sendingCode, setSendingCode] = useState(false)
  const [verifyingCode, setVerifyingCode] = useState(false)
  const [codeCooldown, setCodeCooldown] = useState(0)

  useEffect(() => {
    if (token) {
      setInvitationLoading(true)
      api.get(`/organizations/invitation/validate?token=${token}`)
        .then((res) => {
          setInvitation(res.data)
          setValue('email', res.data.email)
          setEmailVerified(true) // Invitations don't need email verification
        })
        .catch(() => setError('This invitation link is invalid or has expired.'))
        .finally(() => setInvitationLoading(false))
    }
  }, [token, setValue])

  // Cooldown timer for code resend
  useEffect(() => {
    if (codeCooldown <= 0) return
    const timer = setTimeout(() => setCodeCooldown(codeCooldown - 1), 1000)
    return () => clearTimeout(timer)
  }, [codeCooldown])

  // Reset verification when email changes
  useEffect(() => {
    if (emailVerified && !invitation) {
      setEmailVerified(false)
      setCodeSent(false)
      setVerificationCode('')
    }
  }, [email])

  const handleSendCode = async () => {
    if (!email || errors.email) return
    setSendingCode(true)
    setError('')
    try {
      await api.post('/auth/send-email-code', { email: email.trim() })
      setCodeSent(true)
      setCodeCooldown(60)
    } catch (err: any) {
      setError(apiErrorMsg(err, 'Failed to send verification code'))
    } finally {
      setSendingCode(false)
    }
  }

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) return
    setVerifyingCode(true)
    setError('')
    try {
      await api.post('/auth/verify-email-code', { email: email.trim(), code: verificationCode.trim() })
      setEmailVerified(true)
    } catch (err: any) {
      setError(apiErrorMsg(err, 'Invalid verification code'))
    } finally {
      setVerifyingCode(false)
    }
  }

  const onSubmit = async (data: any) => {
    setLoading(true)
    setError('')
    if (data.password !== data.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }
    if (!emailVerified && !invitation) {
      setError('Please verify your email address before continuing')
      setLoading(false)
      return
    }
    if (!data.termsAccepted) {
      setError('You must agree to the Terms and Conditions to create an account')
      setLoading(false)
      return
    }
    const fullName = `${data.firstName} ${data.lastName}`.trim()
    try {
      let res;

      if (token && invitation) {
        res = await api.post('/auth/register-with-invitation', {
          token,
          name: fullName,
          password: data.password,
        })
      } else {
        res = await api.post('/auth/register', {
          ...data,
          name: fullName,
          role: data.role || UserRole.ORG_ADMIN,
        })
      }

      const storedUser = res.data.user
      storedUser.first_name = data.firstName
      localStorage.setItem('accessToken', res.data.accessToken)
      localStorage.setItem('refreshToken', res.data.refreshToken)
      localStorage.setItem('user', JSON.stringify(storedUser))
      if (storedUser?.id) {
        posthog.identify(storedUser.id, {
          email: storedUser.email,
          name: storedUser.name ?? fullName,
          role: storedUser.role,
        })
      }

      if (token) {
        navigate('/dashboard')
      } else {
        navigate('/onboarding')
      }
    } catch (err: any) {
      setError(apiErrorMsg(err, 'Something went wrong. Please try again later.'))
    } finally {
      setLoading(false)
    }
  }

  if (invitationLoading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'white' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: 'white' }}>
       <Box sx={{ 
        flex: { xs: 0, md: 1 }, 
        display: { xs: 'none', md: 'flex' }, 
        flexDirection: 'column',
        bgcolor: '#F8FAFC', 
        p: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderRight: '1px solid #E5E7EB'
      }}>
        <Box sx={{ maxWidth: '500px' }}>
          <Typography variant="h3" sx={{ fontWeight: 800, color: '#111827', mb: 3 }}>
            {invitation ? `Join ${invitation.organizationName}` : 'Scale your care operations with confidence.'}
          </Typography>
          {invitation ? (
            <Typography sx={{ color: '#6B7280', mb: 4, fontSize: '1.1rem' }}>
              You've been invited to join <strong>{invitation.organizationName}</strong> as a{' '}
              {invitation.role === 'MANAGER' ? 'Manager' : 'Staff Member'}. Create your account to get started.
            </Typography>
          ) : (
            <Stack spacing={4} sx={{ mb: 6 }}>
              {[
                { t: 'Automated Compliance', d: 'Never miss a training or DBS renewal again.' },
                { t: 'Smart Scheduling', d: 'Reduce agency spend by up to 40%.' },
                { t: 'Real-time Visibility', d: 'Audit your entire workforce in one click.' }
              ].map((v, i) => (
                <Stack key={i} direction="row" spacing={2}>
                  <CheckIcon sx={{ color: '#16A34A', mt: 0.5 }} />
                  <Box>
                    <Typography sx={{ fontWeight: 700, color: '#111827' }}>{v.t}</Typography>
                    <Typography variant="body2" sx={{ color: '#6B7280' }}>{v.d}</Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          )}
          <img src={REGISTER_ILLUSTRATION} alt="Trust Illustration" style={{ width: '100%', opacity: 0.5 }} />
        </Box>
      </Box>

      <Box sx={{ flex: { xs: 1, md: 0.8 }, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
        <Container maxWidth="xs" sx={{ mx: 'auto' }}>
          <Box sx={{ mb: 6 }}>
            <Typography variant="h4" sx={{ fontWeight: 900, color: '#0F4C81', letterSpacing: '-1.5px', cursor: 'pointer', mb: 1 }} onClick={() => navigate('/')}>
              Meticle
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#111827', mb: 1 }}>
              {invitation ? 'Complete Your Registration' : 'Create Your Account'}
            </Typography>
            <Typography sx={{ color: '#6B7280' }}>
              {invitation
                ? 'Set your password to join your organization.'
                : 'Join modern care providers in 2 minutes. Start your free 14-day trial — no credit card required.'}
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 4, borderRadius: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit(onSubmit)}>
            <Stack spacing={2.5}>
              <Stack direction="row" spacing={1}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: '#374151' }}>First Name</Typography>
                  <TextField
                    fullWidth
                    placeholder="First name"
                    {...register('firstName', { required: 'First name is required' })}
                    error={!!errors.firstName}
                    helperText={errors.firstName?.message as string}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: '#374151' }}>Last Name</Typography>
                  <TextField
                    fullWidth
                    placeholder="Last name"
                    {...register('lastName', { required: 'Last name is required' })}
                    error={!!errors.lastName}
                    helperText={errors.lastName?.message as string}
                  />
                </Box>
              </Stack>

              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: '#374151' }}>Work Email</Typography>
                <TextField
                  fullWidth
                  placeholder="john@carehome.com"
                  disabled={!!invitation || emailVerified}
                  {...register('email', { 
                    required: 'Email is required',
                    pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' }
                  })}
                  error={!!errors.email}
                  helperText={errors.email?.message as string}
                  InputProps={{
                    endAdornment: emailVerified && !invitation ? (
                      <InputAdornment position="end">
                        <VerifiedIcon sx={{ color: '#16A34A' }} />
                      </InputAdornment>
                    ) : undefined
                  }}
                />
              </Box>

              {/* Email verification section */}
              {!invitation && !emailVerified && (
                <Box sx={{ bgcolor: '#F9FAFB', borderRadius: 2, p: 2, border: '1px solid #E5E7EB' }}>
                  {!codeSent ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={handleSendCode}
                        disabled={sendingCode || !email || !!errors.email}
                        sx={{ textTransform: 'none', borderColor: '#0F4C81', color: '#0F4C81', whiteSpace: 'nowrap' }}
                      >
                        {sendingCode ? <CircularProgress size={16} /> : 'Send Verification Code'}
                      </Button>
                      <Typography variant="caption" sx={{ color: '#6B7280' }}>
                        We'll send a 6-digit code to verify your email
                      </Typography>
                    </Stack>
                  ) : (
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <VerifiedIcon sx={{ color: '#0F4C81', fontSize: 18 }} />
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#374151' }}>
                          Enter the 6-digit code sent to {email}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        <TextField
                          size="small"
                          placeholder="000000"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          sx={{ fontFamily: 'monospace', '& input': { fontFamily: 'monospace', letterSpacing: 4, textAlign: 'center' } }}
                          inputProps={{ maxLength: 6 }}
                        />
                        <Button
                          variant="contained"
                          size="small"
                          onClick={handleVerifyCode}
                          disabled={verifyingCode || verificationCode.length !== 6}
                          sx={{ textTransform: 'none', bgcolor: '#0F4C81', whiteSpace: 'nowrap' }}
                        >
                          {verifyingCode ? <CircularProgress size={16} color="inherit" /> : 'Verify'}
                        </Button>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Button
                          size="small"
                          onClick={handleSendCode}
                          disabled={codeCooldown > 0 || sendingCode}
                          sx={{ textTransform: 'none', fontSize: '0.75rem', p: 0, minWidth: 0 }}
                        >
                          {codeCooldown > 0 ? `Resend in ${codeCooldown}s` : 'Resend code'}
                        </Button>
                      </Stack>
                    </Stack>
                  )}
                </Box>
              )}

              {emailVerified && !invitation && (
                <Alert severity="success" sx={{ borderRadius: 2, py: 0 }}>
                  Email verified successfully
                </Alert>
              )}

              {!invitation && (
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: '#374151' }}>Account Type</Typography>
                  <TextField
                    select
                    fullWidth
                    defaultValue={UserRole.ORG_ADMIN}
                    {...register('role')}
                  >
                    <MenuItem value={UserRole.ORG_ADMIN}>Care Organization / Manager</MenuItem>
                    <MenuItem value={UserRole.CARE_WORKER}>Independent Healthcare Professional</MenuItem>
                  </TextField>
                </Box>
              )}

              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: '#374151' }}>Create Password</Typography>
                <TextField
                  fullWidth
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  {...register('password', { 
                    required: 'Password is required',
                    minLength: { value: 8, message: 'Minimum 8 characters' },
                    validate: (v: string) => {
                      if (!/[A-Z]/.test(v)) return 'Must contain an uppercase letter'
                      if (!/[a-z]/.test(v)) return 'Must contain a lowercase letter'
                      if (!/[0-9]/.test(v)) return 'Must contain a number'
                      if (!/[^A-Za-z0-9]/.test(v)) return 'Must contain a special character'
                      return true
                    }
                  })}
                  error={!!errors.password}
                  helperText={errors.password?.message as string}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              </Box>

              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: '#374151' }}>Confirm Password</Typography>
                <TextField
                  fullWidth
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="••••••••"
                  {...register('confirmPassword', { 
                    required: 'Please confirm your password',
                  })}
                  error={!!errors.confirmPassword || passwordsMismatch}
                  helperText={errors.confirmPassword?.message as string || (passwordsMismatch ? 'Passwords do not match' : '')}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowConfirm(!showConfirm)} edge="end" size="small">
                          {showConfirm ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              </Box>

              {password && (
                <Box sx={{ bgcolor: '#F9FAFB', borderRadius: 2, p: 2 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#374151', mb: 1, display: 'block' }}>
                    Password requirements:
                  </Typography>
                  <Stack spacing={0.5}>
                    {PASSWORD_RULES.map((rule) => {
                      const passed = rule.test(password)
                      return (
                        <Stack key={rule.key} direction="row" spacing={1} alignItems="center">
                          <Typography sx={{ color: passed ? '#16A34A' : '#9CA3AF', fontSize: '0.75rem' }}>
                            {passed ? '✓' : '○'}
                          </Typography>
                          <Typography variant="caption" sx={{ color: passed ? '#16A34A' : '#9CA3AF', fontWeight: passed ? 600 : 400 }}>
                            {rule.label}
                          </Typography>
                        </Stack>
                      )
                    })}
                  </Stack>
                </Box>
              )}

              <FormControlLabel
                control={
                  <Checkbox
                    {...register('termsAccepted')}
                    sx={{ '&.Mui-checked': { color: '#0F4C81' } }}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ color: '#374151' }}>
                    I agree to the{' '}
                    <Link onClick={() => navigate('/terms')} sx={{ color: '#0F4C81', cursor: 'pointer', fontWeight: 700, textDecoration: 'none' }}>
                      Terms and Conditions
                    </Link>{' '}
                    and{' '}
                    <Link onClick={() => navigate('/privacy')} sx={{ color: '#0F4C81', cursor: 'pointer', fontWeight: 700, textDecoration: 'none' }}>
                      Privacy Policy
                    </Link>
                  </Typography>
                }
                sx={{ mt: 1 }}
              />

              <Button
                fullWidth
                type="submit"
                variant="contained"
                size="large"
                disabled={loading || (!emailVerified && !invitation) || !termsAccepted}
                sx={{ bgcolor: '#0F4C81', py: 1.8, fontWeight: 800, borderRadius: 2, fontSize: '1rem', textTransform: 'none', mt: 2 }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : (invitation ? 'Join Organization' : 'Start Free Trial')}
              </Button>

              <Box sx={{ mt: 4, pt: 4, borderTop: '1px solid #E5E7EB', textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: '#6B7280' }}>
                  Already have an account? <Link onClick={() => navigate('/login')} sx={{ color: '#0F4C81', cursor: 'pointer', fontWeight: 700, textDecoration: 'none' }}>Sign In</Link>
                </Typography>
              </Box>
            </Stack>
          </Box>
          
           <Box sx={{ mt: 6, display: 'flex', alignItems: 'center', gap: 1, color: '#9CA3AF', justifyContent: 'center' }}>
            <SecurityIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              By signing up, you agree to our{' '}
              <Link onClick={() => navigate('/terms')} sx={{ color: '#9CA3AF', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}>
                Terms
              </Link>{' '}
              and{' '}
              <Link onClick={() => navigate('/privacy')} sx={{ color: '#9CA3AF', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}>
                Privacy Policy
              </Link>.
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  )
}
