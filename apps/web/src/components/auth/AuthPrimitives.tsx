import { useState, type ReactNode } from 'react'
import {
  Box, Button, Typography, TextField, InputAdornment, IconButton,
  CircularProgress, Link,
} from '@mui/material'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import { useNavigate } from 'react-router-dom'

/** Card heading + supporting line. Every auth card opens with this. */
export function AuthHeader({ title, supporting }: { title: string; supporting: string }) {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography component="h2" sx={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--mc-text-primary)' }}>
        {title}
      </Typography>
      <Typography sx={{ mt: 0.5, fontSize: 15, color: 'var(--mc-text-secondary)' }}>{supporting}</Typography>
    </Box>
  )
}

/** Label + control, matching the app's input language. */
export function AuthField({
  label,
  children,
  htmlFor,
}: {
  label: string
  children: ReactNode
  htmlFor: string
}) {
  return (
    <Box>
      <Typography component="label" htmlFor={htmlFor} sx={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--mc-text-primary)', mb: 0.75 }}>
        {label}
      </Typography>
      {children}
    </Box>
  )
}

const INPUT_SX = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    bgcolor: 'var(--mc-surface)',
    fontSize: 15,
    '& fieldset': { borderColor: 'var(--mc-border)' },
    '&:hover fieldset': { borderColor: 'var(--mc-border-dark, var(--mc-border-hover))' },
    '&.Mui-focused fieldset': { borderColor: 'var(--mc-primary)', borderWidth: 1.5 },
  },
} as const

export function AuthInput({
  id,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
  autoFocus,
  required = true,
  disabled,
  error,
  inputMode,
  'aria-describedby': describedBy,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  autoComplete?: string
  autoFocus?: boolean
  required?: boolean
  disabled?: boolean
  error?: boolean
  inputMode?: 'text' | 'numeric' | 'tel' | 'email' | 'url'
  'aria-describedby'?: string
}) {
  return (
    <TextField
      id={id}
      fullWidth
      size="medium"
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      autoComplete={autoComplete}
      autoFocus={autoFocus}
      required={required}
      disabled={disabled}
      error={error}
      inputProps={inputMode ? { inputMode } : undefined}
      aria-describedby={describedBy}
      variant="outlined"
      sx={INPUT_SX}
    />
  )
}

/**
 * Password input with an accessible show/hide toggle. This is one of the two
 * permitted uses of the visibility icons per repo law (auth password toggles).
 */
export function AuthPasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  autoFocus,
  disabled,
  error,
  'aria-describedby': describedBy,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  autoComplete: 'current-password' | 'new-password'
  autoFocus?: boolean
  disabled?: boolean
  error?: boolean
  'aria-describedby'?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <TextField
      id={id}
      fullWidth
      type={show ? 'text' : 'password'}
      placeholder="••••••••"
      value={value}
      onChange={e => onChange(e.target.value)}
      autoComplete={autoComplete}
      autoFocus={autoFocus}
      disabled={disabled}
      error={error}
      aria-describedby={describedBy}
      variant="outlined"
      sx={INPUT_SX}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              onClick={() => setShow(s => !s)}
              edge="end"
              size="small"
              aria-label={show ? 'Hide password' : 'Show password'}
              aria-pressed={show}
            >
              {show ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  )
}

/** Primary auth action: 52px tall, radius 12, loading state, no double submits. */
export function AuthButton({
  children,
  loading = false,
  loadingLabel,
  disabled,
  fullWidth = true,
  onClick,
  type = 'submit',
}: {
  children: ReactNode
  loading?: boolean
  loadingLabel?: string
  disabled?: boolean
  fullWidth?: boolean
  onClick?: () => void
  type?: 'submit' | 'button'
}) {
  return (
    <Button
      type={type}
      fullWidth={fullWidth}
      disabled={disabled || loading}
      onClick={onClick}
      aria-busy={loading}
      sx={{
        height: 52,
        borderRadius: '12px',
        bgcolor: 'var(--mc-primary)',
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: 600,
        textTransform: 'none',
        boxShadow: 'none',
        '&:hover': { bgcolor: 'var(--mc-primary-deep, var(--mc-primary-active))', boxShadow: 'none' },
        '&:disabled': { bgcolor: 'var(--mc-primary)', opacity: 0.55, color: '#FFFFFF' },
      }}
    >
      {loading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <CircularProgress size={20} color="inherit" />
          {loadingLabel ?? 'Working…'}
        </Box>
      ) : (
        children
      )}
    </Button>
  )
}

/** Inline form error — in the card, never a browser alert. */
export function AuthError({ message, onClose }: { message: string; onClose?: () => void }) {
  return (
    <Box
      role="alert"
      sx={{
        display: 'flex',
        gap: 1.25,
        alignItems: 'flex-start',
        bgcolor: 'var(--mc-danger-soft, var(--mc-danger-soft))',
        border: '1px solid var(--mc-danger-border)',
        borderRadius: '12px',
        px: 2,
        py: 1.5,
        mb: 3,
      }}
    >
      <ErrorOutlineIcon sx={{ fontSize: 18, color: 'var(--mc-danger, var(--mc-danger))', mt: '2px' }} />
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'var(--mc-danger-text)' }}>{message}</Typography>
      </Box>
      {onClose && (
        <Link component="button" type="button" onClick={onClose} sx={{ fontSize: 12, color: 'var(--mc-danger-text)', fontWeight: 600, textDecoration: 'none' }}>
          Dismiss
        </Link>
      )}
    </Box>
  )
}

/** Inline success banner, same card language. */
export function AuthSuccess({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Box
      role="status"
      sx={{
        bgcolor: 'var(--mc-success-soft, var(--mc-success-soft))',
        border: '1px solid var(--mc-success-border)',
        borderRadius: '12px',
        px: 2,
        py: 1.75,
        mb: 3,
      }}
    >
      <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'var(--mc-success-text)' }}>{title}</Typography>
      {children && (
        <Typography sx={{ fontSize: 13.5, color: 'var(--mc-success-text)', mt: 0.5, lineHeight: 1.55 }}>{children}</Typography>
      )}
    </Box>
  )
}

/** "or continue with" rule — used above social buttons. */
export function AuthDivider({ label }: { label: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, my: 3 }}>
      <Box sx={{ flex: 1, height: 1, bgcolor: 'var(--mc-border)' }} />
      <Typography sx={{ fontSize: 12.5, color: 'var(--mc-text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>{label}</Typography>
      <Box sx={{ flex: 1, height: 1, bgcolor: 'var(--mc-border)' }} />
    </Box>
  )
}

/** Bottom-of-card account navigation line. */
export function AuthFooterLine({ prompt, action, onAction }: { prompt: string; action: string; onAction: () => void }) {
  return (
    <Typography sx={{ textAlign: 'center', fontSize: 14, color: 'var(--mc-text-secondary)', mt: 4 }}>
      {prompt}{' '}
      <Link
        component="button"
        type="button"
        onClick={onAction}
        underline="hover"
        sx={{ color: 'var(--mc-primary)', fontWeight: 600, fontSize: 'inherit' }}
      >
        {action}
      </Link>
    </Typography>
  )
}

/** Quiet back-link used by state pages (reset expired/invalid/success). */
export function AuthBackLink({ label, to }: { label: string; to: string }) {
  const navigate = useNavigate()
  return (
    <Link
      component="button"
      type="button"
      onClick={() => navigate(to)}
      underline="hover"
      sx={{ display: 'block', textAlign: 'center', width: '100%', mt: 3, fontSize: 14, color: 'var(--mc-text-secondary)', fontWeight: 500 }}
    >
      {label}
    </Link>
  )
}
