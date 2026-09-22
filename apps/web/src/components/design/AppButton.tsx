import { Button, type ButtonProps, CircularProgress } from '@mui/material'

export type AppButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'

interface AppButtonProps extends Omit<ButtonProps, 'variant' | 'color'> {
  variant?: AppButtonVariant
  loading?: boolean
}

const variantProps: Record<AppButtonVariant, Partial<ButtonProps>> = {
  primary: { variant: 'contained', color: 'primary' },
  secondary: { variant: 'outlined', color: 'primary' },
  quiet: { variant: 'text', color: 'inherit' },
  danger: { variant: 'contained', color: 'error' },
}

/** The single button entry point for product UI. Theme defaults keep every variant consistent. */
export function AppButton({ variant = 'primary', loading = false, disabled, children, startIcon, endIcon, ...props }: AppButtonProps) {
  return (
    <Button
      {...variantProps[variant]}
      {...props}
      disabled={disabled || loading}
      startIcon={loading ? <CircularProgress size={16} color="inherit" /> : startIcon}
      endIcon={loading ? undefined : endIcon}
    >
      {loading ? 'Working…' : children}
    </Button>
  )
}

export default AppButton
