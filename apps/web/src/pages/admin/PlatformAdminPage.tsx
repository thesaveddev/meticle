import { useState, useEffect } from 'react'
import {
  Box, Typography, Grid, Paper, Stack, Chip, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, MenuItem, CircularProgress,
  IconButton, Tooltip,
} from '@mui/material'
import {
  Business as BusinessIcon, People as PeopleIcon, TrendingUp as TrendingUpIcon,
  PersonAdd as PersonAddIcon, Refresh as RefreshIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  active: 'success',
  trial: 'warning',
  past_due: 'error',
  canceled: 'error',
  expired: 'error',
}

const planLabels: Record<string, string> = {
  starter: 'Starter',
  professional: 'Professional',
}

export default function PlatformAdminPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<any>(null)
  const [orgs, setOrgs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [search, setSearch] = useState('')
  const [searchDebounce, setSearchDebounce] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchDebounce), 400)
    return () => clearTimeout(t)
  }, [searchDebounce])

  const loadData = async () => {
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
  }

  useEffect(() => { loadData() }, [statusFilter, planFilter, search])

  const statCards = stats ? [
    { label: 'Organizations', value: stats.totalOrganizations, icon: <BusinessIcon />, color: '#0F4C81' },
    { label: 'Total Users', value: stats.totalUsers, icon: <PeopleIcon />, color: '#7C3AED' },
    { label: 'MRR', value: `£${Number(stats.mrr).toLocaleString()}`, icon: <TrendingUpIcon />, color: '#059669' },
    { label: 'Signups (30d)', value: stats.recentSignups, icon: <PersonAddIcon />, color: '#D97706' },
  ] : []

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Platform Admin</Typography>
        <Tooltip title="Refresh">
          <IconButton onClick={loadData} sx={{ bgcolor: '#F8FAFC' }}><RefreshIcon /></IconButton>
        </Tooltip>
      </Stack>

      {stats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
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
                <Typography variant="body2" color="#6B7280" sx={{ mb: 1 }}>Subscription Breakdown</Typography>
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

      <Paper sx={{ p: 4, borderRadius: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Organizations</Typography>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
          <TextField size="small" placeholder="Search orgs..." value={searchDebounce}
            onChange={e => setSearchDebounce(e.target.value)} sx={{ minWidth: 250 }} />
          <TextField size="small" select label="Status" value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)} sx={{ minWidth: 140 }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="trial">Trial</MenuItem>
            <MenuItem value="past_due">Past Due</MenuItem>
            <MenuItem value="canceled">Canceled</MenuItem>
            <MenuItem value="expired">Expired</MenuItem>
          </TextField>
          <TextField size="small" select label="Plan" value={planFilter}
            onChange={e => setPlanFilter(e.target.value)} sx={{ minWidth: 140 }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="starter">Starter</MenuItem>
            <MenuItem value="professional">Professional</MenuItem>
          </TextField>
        </Stack>

        {loading ? (
          <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Organization</TableCell>
                  <TableCell>Plan</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Users</TableCell>
                  <TableCell>Active Users</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orgs.map((org: any) => (
                  <TableRow key={org.id} hover sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/platform-admin/organizations/${org.id}`)}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{org.name}</Typography>
                      <Typography variant="caption" color="#9CA3AF">{org.id.slice(0, 8)}...</Typography>
                    </TableCell>
                    <TableCell><Chip size="small" label={planLabels[org.plan] || org.plan || '—'} variant="outlined" /></TableCell>
                    <TableCell><Chip size="small" label={org.subscription_status} color={statusColors[org.subscription_status] || 'default'} /></TableCell>
                    <TableCell>{org.user_count}</TableCell>
                    <TableCell>{org.active_user_count}</TableCell>
                    <TableCell>
                      {new Date(org.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={(e) => { e.stopPropagation(); navigate(`/platform-admin/organizations/${org.id}`) }}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {orgs.length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6, color: '#9CA3AF' }}>No organizations found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  )
}
