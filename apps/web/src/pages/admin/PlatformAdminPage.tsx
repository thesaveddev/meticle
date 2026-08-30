import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Grid, Paper, Stack, Chip, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, MenuItem, CircularProgress,
  IconButton, Tooltip, Tabs, Tab, Divider, LinearProgress,
} from '@mui/material'
import {
  Business as BusinessIcon, People as PeopleIcon, TrendingUp as TrendingUpIcon,
  PersonAdd as PersonAddIcon, Refresh as RefreshIcon, Payments as PaymentsIcon,
  Warning as WarningIcon, HealthAndSafety as HealthIcon, History as HistoryIcon,
  AdminPanelSettings as AdminIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  active: 'success', trial: 'warning', past_due: 'error', canceled: 'error', expired: 'error', suspended: 'error',
}
const planLabels: Record<string, string> = { starter: 'Starter', professional: 'Professional' }

export default function PlatformAdminPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState(0)
  const [stats, setStats] = useState<any>(null)
  const [orgs, setOrgs] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [finance, setFinance] = useState<any>(null)
  const [auditLog, setAuditLog] = useState<any[]>([])
  const [health, setHealth] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [search, setSearch] = useState('')
  const [searchDebounce, setSearchDebounce] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [userSearchDebounce, setUserSearchDebounce] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState('')
  const [userStatusFilter, setUserStatusFilter] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchDebounce), 400)
    return () => clearTimeout(t)
  }, [searchDebounce])

  useEffect(() => {
    const t = setTimeout(() => setUserSearch(userSearchDebounce), 400)
    return () => clearTimeout(t)
  }, [userSearchDebounce])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, orgsRes] = await Promise.all([
        api.get('/platform-admin/stats'),
        api.get('/platform-admin/organizations', { params: { status: statusFilter || undefined, plan: planFilter || undefined, search: search || undefined } }),
      ])
      setStats(statsRes.data)
      setOrgs(orgsRes.data.organizations)
    } catch { /* silent */ }
    setLoading(false)
  }, [statusFilter, planFilter, search])

  const loadUsers = useCallback(async () => {
    try {
      const res = await api.get('/platform-admin/users', { params: { search: userSearch || undefined, role: userRoleFilter || undefined, status: userStatusFilter || undefined } })
      setUsers(res.data.users)
    } catch { /* silent */ }
  }, [userSearch, userRoleFilter, userStatusFilter])

  const loadFinance = useCallback(async () => {
    try { const res = await api.get('/platform-admin/finance'); setFinance(res.data) } catch { /* silent */ }
  }, [])

  const loadAuditLog = useCallback(async () => {
    try { const res = await api.get('/platform-admin/audit-log'); setAuditLog(res.data.logs) } catch { /* silent */ }
  }, [])

  const loadHealth = useCallback(async () => {
    try { const res = await api.get('/platform-admin/system-health'); setHealth(res.data) } catch { /* silent */ }
  }, [])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { if (tab === 2) loadUsers() }, [tab, loadUsers])
  useEffect(() => { if (tab === 3) loadFinance() }, [tab, loadFinance])
  useEffect(() => { if (tab === 4) loadAuditLog() }, [tab, loadAuditLog])
  useEffect(() => { if (tab === 5) loadHealth() }, [tab, loadHealth])

  const statCards = stats ? [
    { label: 'Organizations', value: stats.totalOrganizations, icon: <BusinessIcon />, color: '#0F4C81' },
    { label: 'Total Users', value: stats.totalUsers, icon: <PeopleIcon />, color: '#7C3AED' },
    { label: 'MRR', value: `£${Number(stats.mrr).toLocaleString()}`, icon: <TrendingUpIcon />, color: '#059669' },
    { label: 'Signups (30d)', value: stats.recentSignups, icon: <PersonAddIcon />, color: '#D97706' },
  ] : []

  const tabLabels = ['Overview', 'Organizations', 'Users', 'Finance', 'Audit Log', 'System Health']

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <AdminIcon sx={{ fontSize: 32, color: '#0F4C81' }} />
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Platform Admin</Typography>
        </Stack>
        <Tooltip title="Refresh">
          <IconButton onClick={() => { loadData(); if (tab === 2) loadUsers(); if (tab === 3) loadFinance(); if (tab === 4) loadAuditLog(); if (tab === 5) loadHealth(); }} sx={{ bgcolor: '#F8FAFC' }}><RefreshIcon /></IconButton>
        </Tooltip>
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        {tabLabels.map((label) => <Tab key={label} label={label} />)}
      </Tabs>

      {/* ─── Overview Tab ─── */}
      {tab === 0 && (
        <>
          {stats && (
            <Grid container spacing={3} sx={{ mb: 3 }}>
              {statCards.map(card => (
                <Grid item xs={12} sm={6} md={3} key={card.label}>
                  <Paper sx={{ p: 3, borderRadius: 2.5, borderLeft: 4, borderLeftColor: card.color }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="body2" color="#6B7280">{card.label}</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 800 }}>{card.value}</Typography>
                      </Box>
                      <Box sx={{ color: card.color }}>{card.icon}</Box>
                    </Stack>
                  </Paper>
                </Grid>
              ))}
              {stats.subscriptions && (
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 3, borderRadius: 2.5 }}>
                    <Typography variant="body2" color="#6B7280" sx={{ mb: 1 }}>Subscriptions</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip size="small" label={`Active: ${stats.subscriptions.active}`} color="success" variant="outlined" />
                      <Chip size="small" label={`Trial: ${stats.subscriptions.trial}`} color="warning" variant="outlined" />
                      <Chip size="small" label={`Past Due: ${stats.subscriptions.past_due}`} color="error" variant="outlined" />
                      <Chip size="small" label={`Canceled: ${stats.subscriptions.canceled}`} color="error" variant="outlined" />
                    </Stack>
                  </Paper>
                </Grid>
              )}
            </Grid>
          )}
          {loading && <LinearProgress />}

          {/* Recent orgs preview */}
          <Paper sx={{ p: 3, borderRadius: 2.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>Recent Organizations</Typography>
              <Button size="small" onClick={() => setTab(1)}>View all</Button>
            </Stack>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Organization</TableCell><TableCell>Plan</TableCell><TableCell>Status</TableCell><TableCell>Users</TableCell><TableCell>Created</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orgs.slice(0, 5).map((org) => (
                    <TableRow key={org.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/platform-admin/organizations/${org.id}`)}>
                      <TableCell><Typography variant="body2" fontWeight={600}>{org.name}</Typography></TableCell>
                      <TableCell><Chip size="small" label={planLabels[org.plan] || org.plan || '—'} variant="outlined" /></TableCell>
                      <TableCell><Chip size="small" label={org.subscription_status} color={statusColors[org.subscription_status] || 'default'} /></TableCell>
                      <TableCell>{org.user_count}</TableCell>
                      <TableCell>{new Date(org.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}

      {/* ─── Organizations Tab ─── */}
      {tab === 1 && (
        <Paper sx={{ p: 3, borderRadius: 2.5 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
            <TextField size="small" placeholder="Search orgs..." value={searchDebounce} onChange={e => setSearchDebounce(e.target.value)} sx={{ minWidth: 250 }} />
            <TextField size="small" select label="Status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} sx={{ minWidth: 140 }}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="active">Active</MenuItem><MenuItem value="trial">Trial</MenuItem>
              <MenuItem value="past_due">Past Due</MenuItem><MenuItem value="canceled">Canceled</MenuItem><MenuItem value="expired">Expired</MenuItem>
            </TextField>
            <TextField size="small" select label="Plan" value={planFilter} onChange={e => setPlanFilter(e.target.value)} sx={{ minWidth: 140 }}>
              <MenuItem value="">All</MenuItem><MenuItem value="starter">Starter</MenuItem><MenuItem value="professional">Professional</MenuItem>
            </TextField>
          </Stack>

          {loading ? <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box> : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Organization</TableCell><TableCell>Plan</TableCell><TableCell>Status</TableCell>
                    <TableCell>Users</TableCell><TableCell>Active Users</TableCell><TableCell>Created</TableCell><TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orgs.map((org) => (
                    <TableRow key={org.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/platform-admin/organizations/${org.id}`)}>
                      <TableCell><Typography variant="body2" fontWeight={600}>{org.name}</Typography><Typography variant="caption" color="#9CA3AF">{org.id.slice(0, 8)}...</Typography></TableCell>
                      <TableCell><Chip size="small" label={planLabels[org.plan] || org.plan || '—'} variant="outlined" /></TableCell>
                      <TableCell><Chip size="small" label={org.subscription_status} color={statusColors[org.subscription_status] || 'default'} /></TableCell>
                      <TableCell>{org.user_count}</TableCell><TableCell>{org.active_user_count}</TableCell>
                      <TableCell>{new Date(org.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</TableCell>
                      <TableCell align="right"><Button size="small" onClick={(e) => { e.stopPropagation(); navigate(`/platform-admin/organizations/${org.id}`) }}>View</Button></TableCell>
                    </TableRow>
                  ))}
                  {orgs.length === 0 && <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6, color: '#9CA3AF' }}>No organizations found</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* ─── Users Tab ─── */}
      {tab === 2 && (
        <Paper sx={{ p: 3, borderRadius: 2.5 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
            <TextField size="small" placeholder="Search users..." value={userSearchDebounce} onChange={e => setUserSearchDebounce(e.target.value)} sx={{ minWidth: 250 }} />
            <TextField size="small" select label="Role" value={userRoleFilter} onChange={e => setUserRoleFilter(e.target.value)} sx={{ minWidth: 160 }}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="ORG_ADMIN">Org Admin</MenuItem><MenuItem value="MANAGER">Manager</MenuItem>
              <MenuItem value="CARE_WORKER">Care Worker</MenuItem><MenuItem value="COMPLIANCE_OFFICER">Compliance Officer</MenuItem>
            </TextField>
            <TextField size="small" select label="Status" value={userStatusFilter} onChange={e => setUserStatusFilter(e.target.value)} sx={{ minWidth: 140 }}>
              <MenuItem value="">All</MenuItem><MenuItem value="active">Active</MenuItem><MenuItem value="deactivated">Deactivated</MenuItem>
            </TextField>
          </Stack>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Email</TableCell><TableCell>Role</TableCell><TableCell>Status</TableCell>
                  <TableCell>Organization</TableCell><TableCell>MFA</TableCell><TableCell>Last Login</TableCell><TableCell>Joined</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell><Typography variant="body2" fontWeight={600}>{user.email}</Typography></TableCell>
                    <TableCell><Chip size="small" label={(user.role || '').replace('_', ' ')} variant="outlined" /></TableCell>
                    <TableCell><Chip size="small" label={user.status} color={user.status === 'active' ? 'success' : 'default'} /></TableCell>
                    <TableCell>{user.organization_name || '—'}</TableCell>
                    <TableCell>{user.mfa_enabled ? '✓' : '—'}</TableCell>
                    <TableCell>{user.last_login_at ? new Date(user.last_login_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</TableCell>
                    <TableCell>{new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6, color: '#9CA3AF' }}>No users found</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* ─── Finance Tab ─── */}
      {tab === 3 && (
        <>
          {finance ? (
            <>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 3, borderRadius: 2.5, borderLeft: 4, borderLeftColor: '#059669' }}>
                    <Typography variant="body2" color="#6B7280">MRR</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#059669' }}>£{Number(finance.mrr).toLocaleString()}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 3, borderRadius: 2.5, borderLeft: 4, borderLeftColor: '#0F4C81' }}>
                    <Typography variant="body2" color="#6B7280">ARR</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800 }}>£{Number(finance.arr).toLocaleString()}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 3, borderRadius: 2.5, borderLeft: 4, borderLeftColor: '#D97706' }}>
                    <Typography variant="body2" color="#6B7280">Revenue (30d)</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#D97706' }}>£{Number(finance.revenue30d).toLocaleString()}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 3, borderRadius: 2.5, borderLeft: 4, borderLeftColor: '#DC2626' }}>
                    <Typography variant="body2" color="#6B7280">Churn Rate (30d)</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#DC2626' }}>{finance.churnRate}%</Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* Revenue by plan */}
              <Paper sx={{ p: 3, borderRadius: 2.5, mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Revenue by Plan</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead><TableRow><TableCell>Plan</TableCell><TableCell>Organizations</TableCell><TableCell>MRR</TableCell></TableRow></TableHead>
                    <TableBody>
                      {finance.revenueByPlan?.map((r: any) => (
                        <TableRow key={r.plan}>
                          <TableCell><Chip size="small" label={planLabels[r.plan] || r.plan || '—'} variant="outlined" /></TableCell>
                          <TableCell>{r.org_count}</TableCell>
                          <TableCell>£{Number(r.mrr).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>

              {/* Revenue trend */}
              {finance.revenueTrend?.length > 0 && (
                <Paper sx={{ p: 3, borderRadius: 2.5, mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Revenue Trend (6 months)</Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead><TableRow><TableCell>Month</TableCell><TableCell>Revenue</TableCell><TableCell>Invoices</TableCell></TableRow></TableHead>
                      <TableBody>
                        {finance.revenueTrend.map((r: any) => (
                          <TableRow key={r.month}>
                            <TableCell>{r.month}</TableCell>
                            <TableCell>£{Number(r.revenue).toLocaleString()}</TableCell>
                            <TableCell>{r.invoice_count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              )}

              {/* Failed payments */}
              <Paper sx={{ p: 3, borderRadius: 2.5, mb: 3, border: finance.failedPayments?.length > 0 ? '1px solid #FECACA' : 'none', bgcolor: finance.failedPayments?.length > 0 ? '#FEF2F2' : 'transparent' }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                  <WarningIcon sx={{ color: '#DC2626' }} />
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#991B1B' }}>Failed Payments</Typography>
                </Stack>
                {finance.failedPayments?.length > 0 ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead><TableRow><TableCell>Organization</TableCell><TableCell>Plan</TableCell><TableCell>Status</TableCell><TableCell>Failed Attempts</TableCell><TableCell>First Failed</TableCell></TableRow></TableHead>
                      <TableBody>
                        {finance.failedPayments.map((f: any) => (
                          <TableRow key={f.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/platform-admin/organizations/${f.id}`)}>
                            <TableCell><Typography variant="body2" fontWeight={600}>{f.name}</Typography></TableCell>
                            <TableCell><Chip size="small" label={planLabels[f.plan] || f.plan || '—'} variant="outlined" /></TableCell>
                            <TableCell><Chip size="small" label={f.subscription_status} color={statusColors[f.subscription_status] || 'default'} /></TableCell>
                            <TableCell>{f.failed_payment_count}</TableCell>
                            <TableCell>{f.first_payment_failed_at ? new Date(f.first_payment_failed_at).toLocaleDateString('en-GB') : '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : <Typography color="#6B7280" sx={{ py: 2 }}>No failed payments 🎉</Typography>}
              </Paper>

              {/* Open invoices */}
              <Paper sx={{ p: 3, borderRadius: 2.5 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                  <PaymentsIcon sx={{ color: '#0F4C81' }} />
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>Open Invoices</Typography>
                </Stack>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  {finance.openInvoices?.count || 0} invoices · £{Number(finance.openInvoices?.total || 0).toLocaleString()} outstanding
                </Typography>
              </Paper>
            </>
          ) : <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box>}
        </>
      )}

      {/* ─── Audit Log Tab ─── */}
      {tab === 4 && (
        <Paper sx={{ p: 3, borderRadius: 2.5 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <HistoryIcon sx={{ color: '#6B7280' }} />
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Recent Activity</Typography>
          </Stack>
          {auditLog.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Time</TableCell><TableCell>User</TableCell><TableCell>Org</TableCell>
                    <TableCell>Action</TableCell><TableCell>Entity</TableCell><TableCell>IP</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {auditLog.map((log) => (
                    <TableRow key={log.id} hover>
                      <TableCell><Typography variant="caption" color="#6B7280">{new Date(log.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Typography></TableCell>
                      <TableCell><Typography variant="body2" fontWeight={600}>{log.user_email || 'System'}</Typography></TableCell>
                      <TableCell>{log.org_name || '—'}</TableCell>
                      <TableCell><Chip size="small" label={log.action} variant="outlined" /></TableCell>
                      <TableCell><Typography variant="caption">{log.entity_type || '—'}</Typography></TableCell>
                      <TableCell><Typography variant="caption" color="#9CA3AF">{log.ip_address || '—'}</Typography></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : <Typography color="#9CA3AF" sx={{ textAlign: 'center', py: 4 }}>No audit entries</Typography>}
        </Paper>
      )}

      {/* ─── System Health Tab ─── */}
      {tab === 5 && (
        health ? (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, borderRadius: 2.5 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                  <HealthIcon sx={{ color: '#059669' }} />
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>Database</Typography>
                </Stack>
                <Stack spacing={1.5}>
                  <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="#6B7280">Version</Typography><Typography variant="body2" fontWeight={600}>{health.database?.version?.split(' ').slice(0, 2).join(' ') || '—'}</Typography></Stack>
                  <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="#6B7280">Size</Typography><Typography variant="body2" fontWeight={600}>{health.database?.size || '—'}</Typography></Stack>
                  <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="#6B7280">Uptime</Typography><Typography variant="body2" fontWeight={600}>{String(health.database?.uptime || '—').split('.')[0]}</Typography></Stack>
                </Stack>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, borderRadius: 2.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Email Queue</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {health.emailQueue?.map((q: any) => (
                    <Chip key={q.status} size="small" label={`${q.status}: ${q.count}`} color={q.status === 'sent' ? 'success' : q.status === 'failed' ? 'error' : 'warning'} variant="outlined" />
                  ))}
                </Stack>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body2" color="#6B7280" sx={{ mb: 1 }}>Stripe Webhooks (24h)</Typography>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>{health.webhookEvents?.last_24h || 0} <Typography component="span" variant="body2" color="#9CA3AF">/ {health.webhookEvents?.total || 0} total</Typography></Typography>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Paper sx={{ p: 3, borderRadius: 2.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Table Counts</Typography>
                <Grid container spacing={2}>
                  {health.tableCounts?.map((t: any) => (
                    <Grid item xs={6} sm={4} md={3} key={t.tbl}>
                      <Box sx={{ p: 2, bgcolor: '#F8FAFC', borderRadius: 1.5 }}>
                        <Typography variant="caption" color="#6B7280">{t.tbl}</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>{Number(t.cnt).toLocaleString()}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            </Grid>
          </Grid>
        ) : <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box>
      )}
    </Box>
  )
}
