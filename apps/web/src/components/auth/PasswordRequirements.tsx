import { Box, Typography } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'

export interface PasswordRule {
  key: string
  label: string
  test: (v: string) => boolean
}

/**
 * The reset-password rules the API actually enforces (12+ chars, upper, lower,
 * number, special — see apps/api/src/shared/validation/schemas.ts
 * resetPasswordSchema). Keep the labels in sync with that schema.
 */
export const RESET_PASSWORD_RULES: PasswordRule[] = [
  { key: 'min', label: 'At least 12 characters', test: v => v.length >= 12 },
  { key: 'upper', label: 'One uppercase letter', test: v => /[A-Z]/.test(v) },
  { key: 'lower', label: 'One lowercase letter', test: v => /[a-z]/.test(v) },
  { key: 'number', label: 'One number', test: v => /[0-9]/.test(v) },
  { key: 'special', label: 'One special character', test: v => /[^A-Za-z0-9]/.test(v) },
]

/**
 * Strength is the share of rules met. Deliberately subtle: a single thin bar
 * and one word, not a security dashboard.
 */
export function passwordStrength(password: string, rules: PasswordRule[]): 'empty' | 'weak' | 'fair' | 'good' | 'strong' {
  if (!password) return 'empty'
  const met = rules.filter(r => r.test(password)).length
  const ratio = met / rules.length
  if (ratio <= 0.4) return 'weak'
  if (ratio <= 0.6) return 'fair'
  if (ratio <= 0.8) return 'good'
  return 'strong'
}

const STRENGTH_META = {
  empty: { label: '', color: 'var(--mc-border)' },
  weak: { label: 'Weak', color: 'var(--mc-danger, var(--mc-danger))' },
  fair: { label: 'Fair', color: 'var(--mc-warning, var(--mc-warning))' },
  good: { label: 'Good', color: 'var(--mc-info, var(--mc-info))' },
  strong: { label: 'Strong', color: 'var(--mc-success, var(--mc-success))' },
} as const

export default function PasswordRequirements({
  password,
  rules = RESET_PASSWORD_RULES,
  showStrength = true,
}: {
  password: string
  rules?: PasswordRule[]
  showStrength?: boolean
}) {
  const strength = passwordStrength(password, rules)
  const meta = STRENGTH_META[strength]
  const metCount = rules.filter(r => r.test(password)).length

  return (
    <Box sx={{ mt: 1.5 }} aria-live="polite">
      {showStrength && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <Box sx={{ flex: 1, height: 4, borderRadius: 4, bgcolor: 'var(--mc-border-soft, var(--mc-border))', overflow: 'hidden' }}>
            <Box
              sx={{
                height: '100%',
                width: `${(metCount / rules.length) * 100}%`,
                bgcolor: meta.color,
                borderRadius: 4,
                transition: 'width 200ms ease, background-color 200ms ease',
              }}
            />
          </Box>
          {strength !== 'empty' && (
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: meta.color, minWidth: 38, textAlign: 'right' }}>
              {meta.label}
            </Typography>
          )}
        </Box>
      )}
      <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: 'var(--mc-text-secondary)', mb: 0.75 }}>
        Your password should contain:
      </Typography>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
        {rules.map(rule => {
          const met = rule.test(password)
          const color = met ? 'var(--mc-success-text)' : 'var(--mc-text-muted)'
          return (
            <Box component="li" key={rule.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              {met ? (
                <CheckIcon sx={{ fontSize: 13, color }} aria-hidden />
              ) : (
                <CloseIcon sx={{ fontSize: 13, color }} aria-hidden />
              )}
              <Typography sx={{ fontSize: 12.5, color }}>{rule.label}</Typography>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
