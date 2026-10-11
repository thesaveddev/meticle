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
      sx={{ bgcolor: c.bg, color: c.fg, fontWeight: 600, height: size === 'small' ? 22 : 28, fontSize: size === 'small' ? 11 : 13, textTransform: 'capitalize' }}
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

// ── Dashboard card primitives (design brief: Card / CardHeader / Skeleton) ──

interface CardProps {
  children: ReactNode
  /** Renders the standard CardHeader (title + optional subtitle + view-all action). */
  header?: { title: string; subtitle?: string; onViewAll?: () => void }
  onClick?: () => void
  sx?: object
}

/**
 * The dashboard surface. One radius (16px), one border, one shadow — the brief
 * pins these so every section reads as the same product. Composition through
 * the `header` prop keeps the CardHeader pattern from drifting per section.
 */
export function Card({ children, header, onClick, sx }: CardProps) {
  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        bgcolor: 'var(--mc-surface)',
        border: '1px solid var(--mc-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 2px 8px rgba(16,24,40,0.04)',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        cursor: onClick ? 'pointer' : 'default',
        ...sx,
      }}
    >
      {header && <CardHeader title={header.title} subtitle={header.subtitle} onViewAll={header.onViewAll} />}
      <Box sx={{ px: { xs: 2, md: 2.5 }, pb: { xs: 2, md: 2.5 }, pt: header ? 0 : { xs: 2, md: 2.5 }, flexGrow: 1, minHeight: 0 }}>
        {children}
      </Box>
    </Paper>
  )
}

interface CardHeaderProps {
  title: string
  subtitle?: string
  /** Renders the "View all →" link when provided. */
  onViewAll?: () => void
  action?: ReactNode
}

/** One header style for every dashboard section: title, optional subtitle, optional view-all. */
export function CardHeader({ title, subtitle, onViewAll, action }: CardHeaderProps) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} sx={{ px: { xs: 2, md: 2.5 }, pt: { xs: 2, md: 2.5 }, pb: 1.5 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, fontSize: 'var(--font-lg)', lineHeight: 1.3 }}>{title}</Typography>
        {subtitle && <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>{subtitle}</Typography>}
      </Box>
      {onViewAll ? (
        <Box
          component="button"
          type="button"
          onClick={onViewAll}
          sx={{
            border: 0, bgcolor: 'transparent', cursor: 'pointer', flexShrink: 0,
            color: 'var(--mc-primary)', fontSize: 'var(--font-sm)', fontWeight: 600, font: 'inherit',
            '&:hover': { textDecoration: 'underline' },
            '&:focus-visible': { outline: '2px solid var(--mc-primary)', outlineOffset: 2, borderRadius: 'var(--radius-sm)' },
          }}
        >
          View all →
        </Box>
      ) : action}
    </Stack>
  )
}

/** Section-level skeleton: header bar plus content rows, for card-sized loading. */
export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <Paper
      elevation={0}
      aria-label="Loading"
      role="status"
      sx={{
        bgcolor: 'var(--mc-surface)', border: '1px solid var(--mc-border)',
        borderRadius: 'var(--radius-lg)', p: { xs: 2, md: 2.5 },
      }}
    >
      <Skeleton width="42%" height={22} sx={{ mb: 2 }} />
      <Stack spacing={1.5}>
        {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} height={20} width={`${88 - i * 12}%`} />)}
      </Stack>
    </Paper>
  )
}

interface SectionErrorProps {
  message?: string
  onRetry?: () => void
}

/** Local failure inside one dashboard section — the rest of the page keeps working. */
export function SectionError({ message = 'Unable to load this section.', onRetry }: SectionErrorProps) {
  return (
    <Stack alignItems="center" spacing={1} sx={{ py: 3, textAlign: 'center' }}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>{message}</Typography>
      {onRetry && <Button size="small" onClick={onRetry} sx={{ textTransform: 'none', fontWeight: 600 }}>Try again</Button>}
    </Stack>
  )
}

interface MetricCardProps {
  icon?: ReactNode
  value: string | number
  label: string
  /** e.g. "+2%" — rendered with the trend colour, or neutral when absent. */
  trend?: string
  trendDirection?: 'up' | 'down' | 'flat'
  onClick?: () => void
}

/**
 * Dashboard KPI card. Compact by contract: icon, value, label, optional trend.
 * Composes the same surface as RecordCard (bordered Paper, no heavy shadow) so
 * the dashboard grid reads as the same product as every list page.
 */
export function MetricCard({ icon, value, label, trend, trendDirection = 'flat', onClick }: MetricCardProps) {
  const trendColor = trendDirection === 'up' ? 'var(--mc-success-text)' : trendDirection === 'down' ? 'var(--mc-danger-text)' : 'text.secondary'
  return (
    <Paper
      onClick={onClick}
      sx={{
        p: 2.5,
        borderRadius: 'var(--radius-lg)',
        border: '1px solid',
        borderColor: 'divider',
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow var(--motion-normal) ease, border-color var(--motion-normal) ease',
        '&:hover': onClick ? { boxShadow: 'var(--shadow-sm)', borderColor: 'primary.light' } : {},
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        {icon && (
          <Box sx={{ display: 'flex', color: 'primary.main', bgcolor: 'var(--mc-primary-subtle)', borderRadius: 'var(--radius-md)', p: 1, flexShrink: 0 }}>
            {icon}
          </Box>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" sx={{ fontWeight: 600, lineHeight: 1.1, fontSize: 'var(--font-2xl)' }}>{value}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }} noWrap>{label}</Typography>
          {trend && (
            <Typography variant="caption" sx={{ color: trendColor, fontWeight: 600, display: 'block', mt: 0.5 }}>
              {trend} vs last week
            </Typography>
          )}
        </Box>
      </Stack>
    </Paper>
  )
}
