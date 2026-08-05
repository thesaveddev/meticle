import { ReactNode } from 'react'
import {
  Box, Typography, Paper, Stack, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, CircularProgress, Alert, Chip,
} from '@mui/material'

export const NAVY = '#0F4C81'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  backAction?: ReactNode
}

export function PageHeader({ title, subtitle, actions, backAction }: PageHeaderProps) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={2} sx={{ mb: 3, gap: 2 }}>
      <Box sx={{ minWidth: 0 }}>
        {backAction}
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</Typography>
        {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{subtitle}</Typography>}
      </Box>
      {actions && (
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexWrap: 'wrap', flexShrink: 0 }}>
          {actions}
        </Stack>
      )}
    </Stack>
  )
}

interface SectionHeaderProps {
  title: string
  icon?: ReactNode
  subtitle?: string
  action?: ReactNode
  accent?: string
}

export function SectionHeader({ title, icon, subtitle, action, accent = NAVY }: SectionHeaderProps) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, minHeight: 40 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
        {icon && <Box sx={{ display: 'flex', color: accent, flexShrink: 0 }}>{icon}</Box>}
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.3 }}>{title}</Typography>
          {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
        </Box>
      </Stack>
      {action && <Box sx={{ flexShrink: 0, ml: 2 }}>{action}</Box>}
    </Stack>
  )
}

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', loading = false, danger = false, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={loading ? undefined : onCancel} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, color: 'text.primary' }}>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">{message}</Typography>
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
        <Button
          onClick={onConfirm}
          color={danger ? 'error' : 'primary'}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
          sx={{ bgcolor: danger ? undefined : NAVY, '&:hover': danger ? undefined : { bgcolor: '#0A3A5C' } }}
        >
          {loading ? 'Working...' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <Paper sx={{ p: 6, textAlign: 'center' }}>
      <CircularProgress size={28} sx={{ color: NAVY }} />
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>{label}</Typography>
    </Paper>
  )
}

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

export function ErrorState({ message = 'Something went wrong', onRetry }: ErrorStateProps) {
  return (
    <Alert severity="error" sx={{ borderRadius: 2 }} action={onRetry ? <Button color="inherit" size="small" onClick={onRetry}>Retry</Button> : undefined}>
      {message}
    </Alert>
  )
}

type BadgeTone = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary' | 'purple'

const TONE_COLORS: Record<BadgeTone, { bg: string; fg: string }> = {
  success: { bg: '#DCFCE7', fg: '#15803D' },
  warning: { bg: '#FEF3C7', fg: '#B45309' },
  error: { bg: '#FEE2E2', fg: '#B91C1C' },
  info: { bg: '#DBEAFE', fg: '#1D4ED8' },
  neutral: { bg: '#F3F4F6', fg: '#4B5563' },
  primary: { bg: '#E7EEF4', fg: '#0F4C81' },
  purple: { bg: '#F3E8FF', fg: '#7C3AED' },
}

interface StatusBadgeProps {
  label: string
  tone?: BadgeTone
  size?: 'small' | 'medium'
}

export function StatusBadge({ label, tone = 'neutral', size = 'small' }: StatusBadgeProps) {
  const c = TONE_COLORS[tone] || TONE_COLORS.neutral
  return (
    <Chip
      label={label}
      size={size}
      sx={{ bgcolor: c.bg, color: c.fg, fontWeight: 700, height: size === 'small' ? 22 : 28, fontSize: size === 'small' ? 11 : 13, textTransform: 'capitalize' }}
    />
  )
}

interface RecordCardProps {
  title?: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  footer?: ReactNode
  onClick?: () => void
  accent?: string
  children?: ReactNode
}

export function RecordCard({ title, meta, actions, footer, onClick, accent = NAVY, children }: RecordCardProps) {
  return (
    <Paper
      onClick={onClick}
      sx={{
        p: 2.5, borderRadius: 2, border: '1px solid #E5E7EB', borderLeft: 4,
        borderLeftColor: accent, cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        '&:hover': onClick ? { boxShadow: '0 2px 10px rgba(0,0,0,0.08)', borderColor: '#D1D5DB' } : {},
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          {title}
          {meta && <Box sx={{ mt: 0.75 }}>{meta}</Box>}
        </Box>
        {actions && <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>{actions}</Stack>}
      </Stack>
      {children && <Box sx={{ mt: 1.5 }}>{children}</Box>}
      {footer && <Box sx={{ mt: 1.5 }}>{footer}</Box>}
    </Paper>
  )
}

export function EmptyRow({ message = 'No records yet', action }: { message?: string; action?: ReactNode }) {
  return (
    <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB' }}>
      <Typography color="#9CA3AF">{message}</Typography>
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Paper>
  )
}
