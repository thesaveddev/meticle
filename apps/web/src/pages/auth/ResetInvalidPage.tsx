import { usePageMeta } from '../../components/PageMeta'
import { Box } from '@mui/material'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import { useNavigate } from 'react-router-dom'
import AuthLayout from '../../components/auth/AuthLayout'
import { AuthHeader, AuthButton, AuthBackLink } from '../../components/auth/AuthPrimitives'

const FEATURES = [
  { icon: 'notes' as const, title: 'Single-use', description: 'Links stop after one use.' },
  { icon: 'person' as const, title: 'One hour', description: 'Then they stop working.' },
  { icon: 'medication' as const, title: 'Encrypted', description: 'Your data stays protected.' },
  { icon: 'schedule' as const, title: 'UK hosted', description: 'Secure by design.' },
]

/**
 * Invalid reset link. Deliberately vague about why — used tokens, mistyped
 * URLs and tampered tokens all land here, and none of that is the user's
 * business or an attacker's.
 */
export default function ResetInvalidPage() {
  const navigate = useNavigate()
  usePageMeta({ title: 'Reset Link Invalid | Meticle Care', description: 'This password reset link is not valid.', noindex: true })

  return (
    <AuthLayout
      heading={<>Better care<br />starts here.</>}
      supporting="A simpler, smarter way to manage daily care, keep people safe, and stay compliant."
      features={FEATURES}
    >
      <Box
        aria-hidden
        sx={{ width: 48, height: 48, borderRadius: '14px', bgcolor: 'var(--mc-danger-soft, var(--mc-danger-soft))', color: 'var(--mc-danger, var(--mc-danger))', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2.5 }}
      >
        <ErrorOutlineIcon sx={{ fontSize: 24 }} />
      </Box>
      <AuthHeader
        title="This reset link isn't valid"
        supporting="The password reset link may have already been used or may no longer be valid."
      />
      <AuthButton type="button" onClick={() => navigate('/forgot-password')}>
        Request a new reset link →
      </AuthButton>
      <AuthBackLink label="Back to sign in" to="/login" />
    </AuthLayout>
  )
}
