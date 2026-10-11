import { Box, Chip, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material'
import { Delete as DeleteIcon, Edit as EditIcon, Warning as WarningIcon } from '@mui/icons-material'
import type { MouseEvent } from 'react'

export interface CarePlanCard {
  id: string
  title: string
  category?: string | null
  description?: string | null
  status?: string | null
  review_date?: string | null
}

function statusLabel(status?: string | null) {
  if (!status) return 'Unknown'
  return status.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

export function CarePlanCardView({
  plan,
  onView,
  onEdit,
  onDelete,
  now = new Date(),
}: {
  plan: CarePlanCard
  onView: (plan: CarePlanCard) => void
  onEdit: (plan: CarePlanCard) => void
  onDelete: (plan: CarePlanCard) => void
  now?: Date
}) {
  const reviewDate = plan.review_date ? new Date(plan.review_date) : null
  const validReviewDate = reviewDate && !Number.isNaN(reviewDate.getTime()) ? reviewDate : null
  const isOverdue = !!validReviewDate && validReviewDate < new Date(now.toDateString())
  const status = plan.status || undefined
  const handleAction = (callback: (plan: CarePlanCard) => void) => (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    callback(plan)
  }

  return (
    <Paper
      component="article"
      onClick={() => onView(plan)}
      sx={{
        p: 2.5,
        minHeight: 176,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        cursor: 'pointer',
        transition: 'border-color 150ms ease, box-shadow 150ms ease',
        '&:hover': { borderColor: 'primary.light', boxShadow: '0 2px 8px rgba(16,24,40,0.06)' },
        '&:focus-within': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.75 }}>
            <Typography
              component="button"
              type="button"
              onClick={handleAction(onView)}
              aria-label={`View care plan: ${plan.title}`}
              sx={{
                p: 0,
                border: 0,
                bgcolor: 'transparent',
                color: 'text.primary',
                font: 'inherit',
                fontSize: '1rem',
                fontWeight: 600,
                textAlign: 'left',
                cursor: 'pointer',
                '&:hover': { color: 'primary.main' },
              }}
            >{plan.title}</Typography>
            {plan.category && <Chip label={plan.category.replace(/_/g, ' ')} size="small" variant="outlined" sx={{ height: 22, fontSize: 11, textTransform: 'capitalize' }} />}
          </Stack>
          {plan.description && <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{plan.description}</Typography>}
        </Box>
        <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0, ml: 0.5 }} onClick={event => event.stopPropagation()}>
          <Tooltip title="Edit care plan"><IconButton size="small" aria-label={`Edit ${plan.title}`} onClick={handleAction(onEdit)}><EditIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Delete care plan"><IconButton size="small" aria-label={`Delete ${plan.title}`} color="error" onClick={handleAction(onDelete)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
        </Stack>
      </Stack>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mt: 'auto', pt: 2 }}>
        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: isOverdue ? 'warning.dark' : 'text.secondary' }}>
          {isOverdue && <WarningIcon sx={{ fontSize: 15 }} />}
          Review: {validReviewDate ? validReviewDate.toLocaleDateString('en-GB') : 'Not scheduled'}{isOverdue ? ' · Overdue' : ''}
        </Typography>
        <Chip
          label={statusLabel(status)}
          size="small"
          color={status === 'active' ? 'success' : status === 'under_review' ? 'warning' : 'default'}
          sx={{ height: 22, textTransform: 'capitalize', flexShrink: 0 }}
        />
      </Stack>
    </Paper>
  )
}
