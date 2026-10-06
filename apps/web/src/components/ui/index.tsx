import { ReactNode } from 'react'
import Skeleton from '@mui/material/Skeleton'
import { METICLE_COLORS } from '../../context/ThemeContext'
import {
  Box, Typography, Paper, Stack, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, CircularProgress, Alert, Chip,
} from '@mui/material'

export const NAVY = METICLE_COLORS.primary

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  backAction?: ReactNode
}

export function PageHeader({ title, subtitle, actions, backAction }: PageHeaderProps) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'flex-end' }} spacing={2} sx={{ mb: 4, gap: 2 }}>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        {backAction && <Box sx={{ mb: 1 }}>{backAction}</Box>}
        <Typography variant="h4" sx={{ fontWeight: 600 }}>{title}</Typography>
        {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 680 }}>{subtitle}</Typography>}
      </Box>
      {actions && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', flexShrink: 0, rowGap: 1 }}>
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
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1} sx={{ mb: 2, minHeight: 36 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
        {icon && <Box sx={{ display: 'flex', color: accent, flexShrink: 0 }}>{icon}</Box>}
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.35 }}>{title}</Typography>
          {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
        </Box>
      </Stack>
      {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
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
      <DialogTitle sx={{ color: danger ? 'error.main' : 'text.primary' }}>{title}</DialogTitle>
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
          sx={{ bgcolor: danger ? undefined : 'primary.main' }}
        >
          {loading ? 'Working...' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <Box role="status" aria-label={label} sx={{ width: '100%', py: 2 }}>
      <Stack spacing={1.5}>
        {[0, 1, 2].map((row) => (
          <Stack key={row} direction="row" spacing={2} alignItems="center" sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Skeleton variant="circular" width={36} height={36} />
            <Box sx={{ flex: 1 }}><Skeleton width="32%" /><Skeleton width="54%" /></Box>
            <Skeleton width={72} height={28} />
          </Stack>
        ))}
      </Stack>
    </Box>
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
  success: { bg: '#EAFBF5', fg: '#087A55' },
  warning: { bg: '#FFF7E6', fg: '#9A6700' },
  error: { bg: '#FEF0F0', fg: '#B42318' },
  info: { bg: '#EAF3FF', fg: '#175CD3' },
  neutral: { bg: '#F2F4F7', fg: '#475467' },
  primary: { bg: '#EAF3FF', fg: '#175CD3' },
  purple: { bg: '#EAF3FF', fg: '#175CD3' },
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
  children?: ReactNode
}

export function RecordCard({ title, meta, actions, footer, onClick, children }: RecordCardProps) {
  return (
    <Paper
      onClick={onClick}
      sx={{
        p: 2.5, borderRadius: 'var(--radius-lg)', border: '1px solid', borderColor: 'divider',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 160ms ease, border-color 160ms ease',
        '&:hover': onClick ? { boxShadow: 'var(--shadow-sm)', borderColor: 'primary.light' } : {},
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
    <Box sx={{ py: 6, px: 4, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>{message}</Typography>
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  )
}
