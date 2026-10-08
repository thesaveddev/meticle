import { usePageMeta } from '../../components/PageMeta'
import { Box, Typography } from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import AuthLayout from '../../components/auth/AuthLayout'
import { AuthHeader, AuthButton } from '../../components/auth/AuthPrimitives'

const FEATURES = [
  { icon: 'notes' as const, title: 'Single-use link', description: 'Now spent.' },
  { icon: 'person' as const, title: 'Re-sign in', description: 'Devices ask once more.' },
  { icon: 'medication' as const, title: 'Encrypted', description: 'Your new password is hashed.' },
  { icon: 'schedule' as const, title: 'UK hosted', description: 'Secure by design.' },
]

/** Password updated. The user stays in control — no auto-redirect. */
export default function ResetSuccessPage() {
  usePageMeta({ title: 'Password Updated | Meticle Care', description: 'Your Meticle Care password has been updated.', noindex: true })

  return (
    <AuthLayout
      heading={<>Better care<br />starts here.</>}
      supporting="A simpler, smarter way to manage daily care, keep people safe, and stay compliant."
      features={FEATURES}
    >
      <Box
        aria-hidden
        sx={{ width: 48, height: 48, borderRadius: '14px', bgcolor: 'var(--mc-success-soft, var(--mc-success-soft))', color: 'var(--mc-success, var(--mc-success))', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2.5 }}
      >
        <CheckCircleOutlineIcon sx={{ fontSize: 26 }} />
      </Box>
      <AuthHeader
        title="Password updated"
        supporting="Your password has been successfully changed. You can now sign in using your new password."
      />
      <AuthButton type="button" onClick={() => { window.location.href = '/login' }}>
        Sign in →
      </AuthButton>
      <Typography sx={{ fontSize: 13, color: 'var(--mc-text-muted)', mt: 3, textAlign: 'center' }}>
        For your security, you'll need to sign in again on your devices.
      </Typography>
    </AuthLayout>
  )
}
