import { Component, ErrorInfo, ReactNode } from 'react'
import { Box, Typography, Button, Paper } from '@mui/material'
import posthog from '../lib/posthog'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
    posthog.captureException(error, {
      componentStack: info.componentStack,
    })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', p: 4 }}>
          <Paper sx={{ p: 4, maxWidth: 500, textAlign: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Something went wrong</Typography>
            <Typography variant="body2" color="#6B7280" sx={{ mb: 3 }}>
              {this.state.error?.message || 'An unexpected error occurred.'}
            </Typography>
            <Button variant="contained" onClick={() => window.location.reload()}>
              Reload Page
            </Button>
          </Paper>
        </Box>
      )
    }
    return this.props.children
  }
}
