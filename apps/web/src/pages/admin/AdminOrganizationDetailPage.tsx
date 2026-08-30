import { useState, useEffect } from 'react'
import {
  Box, Typography, Stack, Paper, Grid, Chip, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Alert, CircularProgress, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
} from '@mui/material'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowBack as BackIcon, Edit as EditIcon } from '@mui/icons-material'
import api from '../../services/api'

const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  active: 'success',
  trial: 'warning',
  past_due: 'error',
  canceled: 'error',
  expired: 'error',
  suspended: 'error',
}

export default function AdminOrganizationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [org, setOrg] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [confirmDialog, setConfirmDialog] = useState<'suspend' | 'reactivate' | null>(null)
  const [billingDialog, setBillingDialog] = useState(false)
  const [billingForm, setBillingForm] = useState({ subscription_status: '', plan: '', trial_ends_at: '' })

  const loadOrg = async () => {
    try {
      const res = await api.get(`/platform-admin/organizations/${id}`)
      setOrg(res.data)
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'Failed to load organization')
    }
    setLoading(false)
  }

  useEffect(() => { if (id) loadOrg() }, [id])

  const handleBillingSave = async () => {
    setActionLoading(true)
    try {
      await api.patch(`/platform-admin/organizations/${id}/billing`, billingForm)
      setMessage('Billing updated successfully')
      setBillingDialog(false)
      loadOrg()
    } catch { setMessage('Failed to update billing') }
    setActionLoading(false)
  }

  const handleStatusToggle = async () => {
    if (!org) return
    const newStatus = org.subscription_status === 'suspended' ? 'active' : 'suspended'
    setActionLoading(true)
    try {
      await api.patch(`/platform-admin/organizations/${org.id}/status`, { status: newStatus })
      setMessage(`Organization ${newStatus === 'suspended' ? 'suspended' : 'reactivated'}`)
      loadOrg()
    } catch { setMessage('Failed to update status') }
    setActionLoading(false)
    setConfirmDialog(null)
  }

  if (loading) return <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /></Box>
  if (!org) return <Alert severity="error">Organization not found</Alert>

  return (
    <Box>
      <Button startIcon={<BackIcon />} onClick={() => navigate('/platform-admin')} sx={{ mb: 3, textTransform: 'none' }}>
        Back to Organizations
      </Button>

      {message && (
        <Alert severity={message.includes('Failed') ? 'error' : 'success'} sx={{ mb: 3, borderRadius: 2 }} onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}

      <Paper sx={{ p: 4, borderRadius: 2.5, mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>{org.name}</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip size="small" label={org.plan || 'No plan'} variant="outlined" />
              <Chip size="small" label={org.subscription_status} color={statusColors[org.subscription_status] || 'default'} />
              {org.stripe_customer_id && <Chip size="small" label="Stripe Connected" variant="outlined" color="success" />}
            </Stack>
          </Box>
          {org.subscription_status !== 'suspended' ? (
            <Button variant="outlined" color="error" onClick={() => setConfirmDialog('suspend')}>
              Suspend Organization
            </Button>
          ) : (
            <Button variant="contained" color="success" onClick={() => setConfirmDialog('reactivate')}>
              Reactivate
            </Button>
          )}
        </Stack>
      </Paper>

      {/* Billing override */}
      <Paper sx={{ p: 4, borderRadius: 2.5, mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Billing Controls</Typography>
          <Button size="small" startIcon={<EditIcon />} onClick={() => {
            setBillingForm({ subscription_status: org.subscription_status || '', plan: org.plan || '', trial_ends_at: org.trial_ends_at ? new Date(org.trial_ends_at).toISOString().slice(0, 10) : '' })
            setBillingDialog(true)
          }}>Override Billing</Button>
        </Stack>
        <Grid container spacing={2}>
          <Grid item xs={4}><Typography variant="caption" color="#6B7280">Plan</Typography><Typography variant="body2" fontWeight={600}>{org.plan || '—'}</Typography></Grid>
          <Grid item xs={4}><Typography variant="caption" color="#6B7280">Status</Typography><Typography variant="body2" fontWeight={600}>{org.subscription_status || '—'}</Typography></Grid>
          <Grid item xs={4}><Typography variant="caption" color="#6B7280">Trial Ends</Typography><Typography variant="body2" fontWeight={600}>{org.trial_ends_at ? new Date(org.trial_ends_at).toLocaleDateString('en-GB') : '—'}</Typography></Grid>
        </Grid>
      </Paper>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3, borderRadius: 2.5 }}>
            <Typography variant="body2" color="#6B7280">Total Users</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{org.stats?.totalUsers || 0}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3, borderRadius: 2.5 }}>
            <Typography variant="body2" color="#6B7280">Active Users</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#059669' }}>{org.stats?.activeUsers || 0}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3, borderRadius: 2.5 }}>
            <Typography variant="body2" color="#6B7280">Shifts (30d)</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#7C3AED' }}>{org.stats?.recentShifts || 0}</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 4, borderRadius: 2.5, mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>Users</Typography>
        {org.users?.length === 0 ? (
          <Typography color="#9CA3AF" sx={{ textAlign: 'center', py: 4 }}>No users</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>MFA</TableCell>
                  <TableCell>Joined</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {org.users?.map((user: any) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{user.email}</Typography>
                    </TableCell>
                    <TableCell><Chip size="small" label={user.role.replace('_', ' ')} variant="outlined" /></TableCell>
                    <TableCell><Chip size="small" label={user.status} color={user.status === 'active' ? 'success' : 'default'} /></TableCell>
                    <TableCell>{user.mfa_enabled ? 'Yes' : 'No'}</TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Paper sx={{ p: 4, borderRadius: 2.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>Billing History</Typography>
        {org.invoices?.length === 0 ? (
          <Typography color="#9CA3AF" sx={{ textAlign: 'center', py: 4 }}>No invoices</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Invoice</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {org.invoices?.map((inv: any) => (
                  <TableRow key={inv.id}>
                    <TableCell><Typography variant="body2" fontWeight={600}>{inv.invoice_number}</Typography></TableCell>
                    <TableCell>{inv.description}</TableCell>
                    <TableCell>£{parseFloat(inv.amount).toFixed(2)}</TableCell>
                    <TableCell><Chip size="small" label={inv.status} color={inv.status === 'paid' ? 'success' : 'default'} /></TableCell>
                    <TableCell>
                      {inv.issued_at ? new Date(inv.issued_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={!!confirmDialog} onClose={() => setConfirmDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{confirmDialog === 'suspend' ? 'Suspend Organization' : 'Reactivate Organization'}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="#6B7280">
            {confirmDialog === 'suspend'
              ? `This will revoke all users' access to ${org.name}. They will only be able to access billing and learning. Are you sure?`
              : `This will restore full access for ${org.name}. Are you sure?`}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(null)}>Cancel</Button>
          <Button onClick={handleStatusToggle} variant="contained" disabled={actionLoading}
            color={confirmDialog === 'suspend' ? 'error' : 'success'}>
            {actionLoading ? 'Processing...' : confirmDialog === 'suspend' ? 'Suspend' : 'Reactivate'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Billing override dialog */}
      <Dialog open={billingDialog} onClose={() => setBillingDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Override Billing — {org.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField select label="Subscription Status" value={billingForm.subscription_status} onChange={e => setBillingForm({ ...billingForm, subscription_status: e.target.value })} fullWidth size="small">
              <MenuItem value="trial">Trial</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="past_due">Past Due</MenuItem>
              <MenuItem value="canceled">Canceled</MenuItem>
              <MenuItem value="expired">Expired</MenuItem>
            </TextField>
            <TextField select label="Plan" value={billingForm.plan} onChange={e => setBillingForm({ ...billingForm, plan: e.target.value })} fullWidth size="small">
              <MenuItem value="starter">Starter</MenuItem>
              <MenuItem value="professional">Professional</MenuItem>
            </TextField>
            <TextField type="date" label="Trial Ends At" value={billingForm.trial_ends_at} onChange={e => setBillingForm({ ...billingForm, trial_ends_at: e.target.value })} fullWidth size="small" InputLabelProps={{ shrink: true }} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBillingDialog(false)}>Cancel</Button>
          <Button onClick={handleBillingSave} variant="contained" disabled={actionLoading}>{actionLoading ? 'Saving...' : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
