import { ReactNode } from 'react'
import { Box, Typography, Paper } from '@mui/material'

interface EmptyStateProps {
  message?: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
}

export default function EmptyState({ message = 'No data found', description, icon, action }: EmptyStateProps) {
  return (
    <Paper sx={{ p: 6, textAlign: 'center' }}>
      {icon && <Box sx={{ mb: 2, '& > *': { fontSize: 48, color: '#D1D5DB' } }}>{icon}</Box>}
      <Typography variant="h6" color="#9CA3AF" sx={{ mb: 1 }}>{message}</Typography>
      {description && <Typography variant="body2" color="#9CA3AF" sx={{ mb: 2 }}>{description}</Typography>}
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Paper>
  )
}
