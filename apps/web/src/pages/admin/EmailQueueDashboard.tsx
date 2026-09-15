import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Grid, Paper, Stack, Chip, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Tooltip, CircularProgress,
  Alert, LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material'
import {
  Email as EmailIcon, Error as ErrorIcon, CheckCircle as CheckIcon,
  PendingActions as PendingIcon, Refresh as RefreshIcon, DeleteSweep as PurgeIcon,
  Replay as RetryIcon,  People as PeopleIcon,

} from '@mui/icons-material'
import PageContainer from '../../components/design/PageContainer'
import api from '../../services/api'

interface EmailStats {
  counts: Record<string, number>
  total: number
  recentFailures: Array<{
    id: string; to_email: string; subject: string; error_message: string | null
    retry_count: number; max_retries: number; created_at: string; sent_at: string | null
  }>
  hourlyTrend: Array<{ hour: string; status: string; count: number }>
  topRecipients: Array<{ to_email: string; total: number; failed: number; sent: number }>
}

function StatCard({ title, value, icon, color, subtitle }: {
  title: string; value: number | string; icon: React.ReactNode; color: string; subtitle?: string
}) {
  return (
    <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 800, mt: 0.5, color: 'text.primary' }}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </Typography>
          {subtitle && (
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>{subtitle}</Typography>
          )}
        </Box>
        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: `${color}15`, color: `${color}.main` }}>
          {icon}
        </Box>
      </Stack>
    </Paper>
  )
}

function TimeAgo({ date }: { date: string }) {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return <span>Just now</span>
  if (mins < 60) return <span>{mins}m ago</span>
  const hours = Math.floor(mins / 60)
  if (hours < 24) return <span>{hours}h ago</span>
  const days = Math.floor(hours / 24)
  return <span>{days}d ago</span>
}

export default function EmailQueueDashboard() {
  const [stats, setStats] = useState<EmailStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [confirmDialog, setConfirmDialog] = useState<'retry' | 'purge' | null>(null)
  const [expandedError, setExpandedError] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get('/platform-admin/email-queue')
      setStats(res.data)
    } catch {
      setError('Failed to load email queue stats')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  const handleRetryFailed = async () => {
    setConfirmDialog(null)
    setActionLoading('retry')
    try {
      const res = await api.post('/platform-admin/email-queue/retry-failed')
      setSuccess(`${res.data.retried} emails queued for retry`)
      await loadStats()
    } catch { setError('Failed to retry emails') }
    finally { setActionLoading(null) }
  }

  const handlePurgeFailed = async () => {
    setConfirmDialog(null)
    setActionLoading('purge')
    try {
      const res = await api.post('/platform-admin/email-queue/purge-failed')
      setSuccess(`${res.data.deleted} failed emails deleted`)
      await loadStats()
    } catch { setError('Failed to purge emails') }
    finally { setActionLoading(null) }
  }

  const sent = stats?.counts?.sent || 0
  const failed = stats?.counts?.failed || 0
  const pending = stats?.counts?.pending || 0
  const sending = stats?.counts?.sending || 0
  const total = stats?.total || 0
  const successRate = total > 0 ? ((sent / total) * 100).toFixed(1) : '0'

  return (
    <PageContainer>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Email Queue</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Delivery stats, failure tracking, and queue management
          </Typography>
        </Box>
        <Stack direction="row" gap={1}>
          <Button
            variant="outlined"
            startIcon={actionLoading === 'retry' ? <CircularProgress size={16} /> : <RetryIcon />}
            onClick={() => setConfirmDialog('retry')}
            disabled={!!actionLoading || failed === 0}
          >
            Retry Failed
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={actionLoading === 'purge' ? <CircularProgress size={16} /> : <PurgeIcon />}
            onClick={() => setConfirmDialog('purge')}
            disabled={!!actionLoading || failed === 0}
          >
            Purge Failed
          </Button>
          <Tooltip title="Refresh">
            <IconButton onClick={loadStats} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Alerts */}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Loading */}
      {loading && !stats && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Stats Cards */}
      {stats && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard title="Total Emails" value={total} icon={<EmailIcon />} color="primary" subtitle="All time in queue" />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard title="Sent" value={sent} icon={<CheckIcon />} color="success" subtitle={`${successRate}% success rate`} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard title="Failed" value={failed} icon={<ErrorIcon />} color="error" subtitle={failed > 0 ? 'Needs attention' : 'All clear'} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard title="Pending" value={pending + sending} icon={<PendingIcon />} color="warning" subtitle={sending > 0 ? `${sending} sending now` : 'Queued for delivery'} />
            </Grid>
          </Grid>

          {/* Success rate bar */}
          {total > 0 && (
            <Paper sx={{ p: 2, mb: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
              <Stack direction="row" alignItems="center" gap={2}>
                <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 100 }}>Delivery Rate</Typography>
                <Box sx={{ flex: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={Number(successRate)}
                    color={Number(successRate) > 90 ? 'success' : Number(successRate) > 50 ? 'warning' : 'error'}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 50, textAlign: 'right' }}>
                  {successRate}%
                </Typography>
              </Stack>
            </Paper>
          )}

          {/* Failure trend */}
          <Paper sx={{ p: 3, mb: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
              <ErrorIcon sx={{ color: failed > 0 ? 'error.main' : 'text.secondary' }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Failure Trend (7d)</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', ml: 'auto' }}>Hourly failed deliveries</Typography>
            </Stack>
            {(() => {
              const failures = stats.hourlyTrend.filter(point => point.status === 'failed').slice(0, 24).reverse()
              const max = Math.max(1, ...failures.map(point => point.count))
              return failures.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>No failed deliveries in the last seven days.</Typography>
              ) : (
                <Stack direction="row" alignItems="flex-end" spacing={0.5} sx={{ height: 96, overflow: 'hidden' }}>
                  {failures.map(point => (
                    <Tooltip key={`${point.hour}-${point.status}`} title={`${new Date(point.hour).toLocaleString()}: ${point.count} failed`}>
                      <Box sx={{ flex: 1, minWidth: 6, maxWidth: 28, height: `${Math.max(8, (point.count / max) * 80)}px`, bgcolor: 'error.main', borderRadius: '4px 4px 0 0', opacity: 0.8 }} />
                    </Tooltip>
                  ))}
                </Stack>
              )
            })()}
          </Paper>

          {/* Top recipients + Recent failures */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {/* Top recipients */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
                <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
                  <PeopleIcon sx={{ color: 'primary.main' }} />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Top Recipients (7d)</Typography>
                </Stack>
                {stats.topRecipients.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'text.secondary', py: 2, textAlign: 'center' }}>No recent email activity</Typography>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Sent</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Failed</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Rate</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {stats.topRecipients.map((r) => (
                          <TableRow key={r.to_email} hover>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: 13 }}>{r.to_email}</TableCell>
                            <TableCell align="right">
                              <Chip label={r.sent} size="small" color="success" variant="outlined" />
                            </TableCell>
                            <TableCell align="right">
                              <Chip label={r.failed} size="small" color={r.failed > 0 ? 'error' : 'default'} variant="outlined" />
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{ fontWeight: 600, color: r.total > 0 && r.failed / r.total > 0.1 ? 'error.main' : 'text.secondary' }}>
                                {r.total > 0 ? ((r.sent / r.total) * 100).toFixed(0) : 0}%
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Paper>
            </Grid>

            {/* Recent failures */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
                <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
                  <ErrorIcon sx={{ color: 'error.main' }} />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Recent Failures</Typography>
                  {failed > 0 && (
                    <Chip label={failed} size="small" color="error" sx={{ ml: 'auto' }} />
                  )}
                </Stack>
                {stats.recentFailures.length === 0 ? (
                  <Alert severity="success" sx={{ mt: 1 }}>
                    <Typography variant="body2">No failed emails. All deliveries successful.</Typography>
                  </Alert>
                ) : (
                  <TableContainer sx={{ maxHeight: 400 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Recipient</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Subject</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Error</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Time</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {stats.recentFailures.map((f) => (
                          <TableRow key={f.id} hover sx={{ '&:hover': { bgcolor: 'error.50' } }}>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                                {f.to_email}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Tooltip title={f.subject}>
                                <Typography variant="body2" sx={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {f.subject}
                                </Typography>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              {f.error_message ? (
                                <Tooltip title={expandedError === f.id ? 'Click to collapse' : f.error_message}>
                                  <Chip
                                    label={expandedError === f.id ? f.error_message : f.error_message.slice(0, 40) + (f.error_message.length > 40 ? '...' : '')}
                                    size="small"
                                    color="error"
                                    variant="outlined"
                                    onClick={() => setExpandedError(expandedError === f.id ? null : f.id)}
                                    sx={{ maxWidth: 250, cursor: 'pointer', fontSize: 11 }}
                                  />
                                </Tooltip>
                              ) : (
                                <Chip label="Unknown error" size="small" color="default" variant="outlined" />
                              )}
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                <TimeAgo date={f.created_at} />
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Paper>
            </Grid>
          </Grid>
        </>
      )}

      {/* Confirm Dialog */}
      <Dialog open={!!confirmDialog} onClose={() => setConfirmDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {confirmDialog === 'retry' ? 'Retry Failed Emails' : 'Purge Failed Emails'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {confirmDialog === 'retry'
              ? `This will re-queue all ${failed} failed emails for delivery. Emails that have exhausted their retry limit will not be re-queued.`
              : `This will permanently delete all ${failed} failed emails from the queue. This action cannot be undone.`
            }
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(null)}>Cancel</Button>
          <Button
            variant="contained"
            color={confirmDialog === 'purge' ? 'error' : 'primary'}
            onClick={confirmDialog === 'retry' ? handleRetryFailed : handlePurgeFailed}
            disabled={!!actionLoading}
            startIcon={actionLoading ? <CircularProgress size={16} /> : null}
          >
            {confirmDialog === 'retry' ? 'Retry All' : 'Delete All'}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  )
}
