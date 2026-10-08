import { usePageMeta } from '../../components/PageMeta'
import { Box } from '@mui/material'
import { Link as LinkIcon } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import AuthLayout from '../../components/auth/AuthLayout'
import { AuthHeader, AuthButton, AuthBackLink } from '../../components/auth/AuthPrimitives'

const FEATURES = [
  { icon: 'notes' as const, title: 'One hour', description: 'That is the safe window.' },
  { icon: 'person' as const, title: 'Single-use', description: 'Each link works once.' },
  { icon: 'medication' as const, title: 'Encrypted', description: 'Your data stays protected.' },
  { icon: 'schedule' as const, title: 'UK hosted', description: 'Secure by design.' },
]

/** Expired reset link. No technical token information, ever. */
export default function ResetExpiredPage() {
  const navigate = useNavigate()
  usePageMeta({ title: 'Reset Link Expired | Meticle Care', description: 'This password reset link has expired.', noindex: true })

  return (
    <AuthLayout
      heading={<>Better care<br />starts here.</>}
      supporting="A simpler, smarter way to manage daily care, keep people safe, and stay compliant."
      features={FEATURES}
    >
      <Box
        aria-hidden
        sx={{ width: 48, height: 48, borderRadius: '14px', bgcolor: 'var(--mc-warning-soft, var(--mc-warning-soft))', color: 'var(--mc-warning, var(--mc-warning))', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2.5 }}
      >
        <LinkIcon sx={{ fontSize: 24 }} />
      </Box>
      <AuthHeader
        title="This reset link has expired"
        supporting="For your security, password reset links are only valid for a limited time."
      />
      <AuthButton type="button" onClick={() => navigate('/forgot-password')}>
        Request a new reset link →
      </AuthButton>
      <AuthBackLink label="Back to sign in" to="/login" />
    </AuthLayout>
  )
}
