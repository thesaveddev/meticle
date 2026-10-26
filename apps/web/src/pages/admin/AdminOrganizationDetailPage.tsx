import { useState, useEffect } from 'react'
import {
  Box, Typography, Stack, Paper, Grid, Chip, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Alert, CircularProgress, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
} from '@mui/material'
import { useParams } from 'react-router-dom'
import { Edit as EditIcon, OpenInNew as OpenInNewIcon, Delete as DeleteIcon, Upload as UploadIcon } from '@mui/icons-material'
import api from '../../services/api'
import { localDate } from '../../utils/dateFormat'

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
  const [org, setOrg] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [confirmDialog, setConfirmDialog] = useState<'suspend' | 'reactivate' | null>(null)
  const [billingDialog, setBillingDialog] = useState(false)
  const [billingForm, setBillingForm] = useState({ subscription_status: '', plan: '', trial_ends_at: '' })
  const [domiciliaryQuoteForm, setDomiciliaryQuoteForm] = useState({ monthly_price: '', vat_behavior: '' as '' | 'inclusive' | 'exclusive' })
  const [quoteSaving, setQuoteSaving] = useState(false)
  const [orgDocs, setOrgDocs] = useState<any[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [docUploading, setDocUploading] = useState(false)
  const [docForm, setDocForm] = useState({ doc_type: 'DPA', title: '', version: '1.0' })
  const [docFile, setDocFile] = useState<File | null>(null)

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

  const loadDocs = async () => {
    if (!id) return
    setDocsLoading(true)
    try {
      const res = await api.get(`/platform-admin/organizations/${id}/documents`)
      setOrgDocs(res.data.documents || [])
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'Failed to load compliance files')
    } finally { setDocsLoading(false) }
  }

  useEffect(() => { if (id) loadDocs() }, [id])

  const handleDocUpload = async () => {
    if (!id || !docFile) { setMessage('Choose a file to upload.'); return }
    if (!docForm.title.trim()) { setMessage('Give the document a title (e.g. Signed DPA v1.0).'); return }
    setDocUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', docFile)
      fd.append('doc_type', docForm.doc_type)
      fd.append('title', docForm.title.trim())
      fd.append('version', docForm.version || '1.0')
      await api.post(`/platform-admin/organizations/${id}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setMessage('Compliance file stored against this organisation.')
      setDocFile(null)
      setDocForm({ doc_type: 'DPA', title: '', version: '1.0' })
      await loadDocs()
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'Failed to upload compliance file.')
    } finally { setDocUploading(false) }
  }

  const handleDocDelete = async (docId: string) => {
    if (!id) return
    try {
      await api.delete(`/platform-admin/organizations/${id}/documents/${docId}`)
      setMessage('Compliance file deleted.')
      await loadDocs()
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'Failed to delete compliance file.')
    }
  }

  const handleDomiciliaryQuoteSave = async () => {
    const monthlyPrice = Number(domiciliaryQuoteForm.monthly_price)
    if (!Number.isFinite(monthlyPrice) || monthlyPrice <= 0) {
      setMessage('Enter a valid monthly quote amount.')
      return
    }
    setQuoteSaving(true)
    try {
      await api.put(`/platform-admin/organizations/${id}/domiciliary-quote`, {
        monthly_price_pence: Math.round(monthlyPrice * 100),
        vat_behavior: domiciliaryQuoteForm.vat_behavior,
      })
      setMessage('Domiciliary quote saved. The organisation must review and accept the changed quote before it can be charged.')
      await loadOrg()
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'Failed to save domiciliary quote.')
    } finally { setQuoteSaving(false) }
  }

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
      {message && (
        <Alert severity={message.includes('Failed') ? 'error' : 'success'} sx={{ mb: 3, borderRadius: 2 }} onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}

      <Paper sx={{ p: 4, borderRadius: 2.5, mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>{org.name}</Typography>
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

      {(org.primary_service_type === 'domiciliary' || org.primary_service_type === 'live_in' || org.service_types?.some((type: string) => ['domiciliary', 'live_in'].includes(type))) && (
        <Paper sx={{ p: 4, borderRadius: 2.5, mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>Domiciliary subscription quote</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Set the agreed monthly subscription. This is a draft until the organisation admin accepts it in Billing. Changing price or VAT treatment resets that acceptance; it does not immediately change any live Stripe charge.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-start' }}>
            <TextField size="small" type="number" label="Monthly amount (£)" inputProps={{ min: 0.01, step: 0.01 }}
              value={domiciliaryQuoteForm.monthly_price || (org.domiciliary_monthly_price_pence ? (org.domiciliary_monthly_price_pence / 100).toFixed(2) : '')} onChange={e => setDomiciliaryQuoteForm({ ...domiciliaryQuoteForm, monthly_price: e.target.value })} />
            <TextField size="small" select label="VAT treatment" value={domiciliaryQuoteForm.vat_behavior || org.domiciliary_price_vat_behavior || 'exclusive'}
              onChange={e => setDomiciliaryQuoteForm({ ...domiciliaryQuoteForm, vat_behavior: e.target.value as 'inclusive' | 'exclusive' })} sx={{ minWidth: 190 }}>
              <MenuItem value="exclusive">VAT added to quoted price</MenuItem>
              <MenuItem value="inclusive">VAT included in quoted price</MenuItem>
            </TextField>
            <Button variant="contained" onClick={handleDomiciliaryQuoteSave} disabled={quoteSaving || !domiciliaryQuoteForm.monthly_price}>
              {quoteSaving ? 'Saving…' : 'Save quote'}
            </Button>
          </Stack>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={4}><Typography variant="caption" color="text.secondary">Draft quote</Typography><Typography fontWeight={600}>{org.domiciliary_monthly_price_pence ? `£${(org.domiciliary_monthly_price_pence / 100).toFixed(2)} / month` : 'Not set'}</Typography></Grid>
            <Grid item xs={12} sm={4}><Typography variant="caption" color="text.secondary">Active Stripe amount</Typography><Typography fontWeight={600}>{org.domiciliary_active_monthly_price_pence ? `£${(org.domiciliary_active_monthly_price_pence / 100).toFixed(2)} / month` : 'No recorded active contract'}</Typography></Grid>
            <Grid item xs={12} sm={4}><Typography variant="caption" color="text.secondary">Acceptance</Typography><Typography fontWeight={600}>{org.domiciliary_quote_accepted_at ? `Accepted ${new Date(org.domiciliary_quote_accepted_at).toLocaleDateString('en-GB')}` : 'Awaiting organisation acceptance'}</Typography></Grid>
          </Grid>
        </Paper>
      )}

      {/* Billing override */}
      <Paper sx={{ p: 4, borderRadius: 2.5, mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>Billing Controls</Typography>
          <Button size="small" startIcon={<EditIcon />} onClick={() => {
            // The trial end is stored as an instant but edited as a day, so it is read
            // as the admin's own local day. The UTC slice this used to use made the
            // date they were shown disagree with the stored record for part of every day.
            setBillingForm({ subscription_status: org.subscription_status || '', plan: org.plan || '', trial_ends_at: org.trial_ends_at ? localDate(new Date(org.trial_ends_at)) : '' })
            setBillingDialog(true)
          }}>Override Billing</Button>
        </Stack>
        <Grid container spacing={2}>
          <Grid item xs={4}><Typography variant="caption" color="#51637A">Plan</Typography><Typography variant="body2" fontWeight={600}>{org.plan || '—'}</Typography></Grid>
          <Grid item xs={4}><Typography variant="caption" color="#51637A">Status</Typography><Typography variant="body2" fontWeight={600}>{org.subscription_status || '—'}</Typography></Grid>
          <Grid item xs={4}><Typography variant="caption" color="#51637A">Trial Ends</Typography><Typography variant="body2" fontWeight={600}>{org.trial_ends_at ? new Date(org.trial_ends_at).toLocaleDateString('en-GB') : '—'}</Typography></Grid>
        </Grid>
      </Paper>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3, borderRadius: 2.5 }}>
            <Typography variant="body2" color="#51637A">Total Users</Typography>
            <Typography variant="h4" sx={{ fontWeight: 600 }}>{org.stats?.totalUsers || 0}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3, borderRadius: 2.5 }}>
            <Typography variant="body2" color="#51637A">Active Users</Typography>
            <Typography variant="h4" sx={{ fontWeight: 600, color: '#087A55' }}>{org.stats?.activeUsers || 0}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3, borderRadius: 2.5 }}>
            <Typography variant="body2" color="#51637A">Shifts (30d)</Typography>
            <Typography variant="h4" sx={{ fontWeight: 600, color: '#8B7CF6' }}>{org.stats?.recentShifts || 0}</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 4, borderRadius: 2.5, mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>Users</Typography>
        {org.users?.length === 0 ? (
          <Typography color="#5D6E85" sx={{ textAlign: 'center', py: 4 }}>No users</Typography>
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

      <Paper sx={{ p: 4, borderRadius: 2.5, mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>Compliance files</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Signed DPA, DPIA acceptance, ICO certificate, insurance — kept under this organisation so an inspector or customer DDQ is one click, not an inbox search.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
          <TextField size="small" select label="Type" value={docForm.doc_type}
            onChange={e => setDocForm({ ...docForm, doc_type: e.target.value })} sx={{ minWidth: 160 }}>
            <MenuItem value="DPA">DPA</MenuItem><MenuItem value="DPIA">DPIA</MenuItem>
            <MenuItem value="ICO">ICO certificate</MenuItem><MenuItem value="INSURANCE">Insurance</MenuItem>
            <MenuItem value="CONTRACT">Contract</MenuItem><MenuItem value="POLICY">Policy</MenuItem>
            <MenuItem value="OTHER">Other</MenuItem>
          </TextField>
          <TextField size="small" label="Title" placeholder="Signed DPA v1.0" value={docForm.title}
            onChange={e => setDocForm({ ...docForm, title: e.target.value })} sx={{ flex: 1 }} />
          <TextField size="small" label="Version" value={docForm.version}
            onChange={e => setDocForm({ ...docForm, version: e.target.value })} sx={{ maxWidth: 110 }} />
          <Button size="small" variant="outlined" component="label" startIcon={<UploadIcon />}>
            {docFile ? docFile.name : 'Choose file'}
            <input hidden type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={e => setDocFile(e.target.files?.[0] || null)} />
          </Button>
          <Button size="small" variant="contained" onClick={handleDocUpload} disabled={docUploading || !docFile}>
            {docUploading ? 'Storing…' : 'Store file'}
          </Button>
        </Stack>
        {docsLoading ? <Typography color="text.secondary">Loading files…</Typography> : orgDocs.length === 0 ? (
          <Typography color="#5D6E85" sx={{ textAlign: 'center', py: 3 }}>No compliance files stored for this organisation yet.</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow><TableCell>Type</TableCell><TableCell>Title</TableCell><TableCell>Version</TableCell><TableCell>Stored</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
              <TableBody>
                {orgDocs.map((d: any) => (
                  <TableRow key={d.id} hover sx={{ cursor: 'pointer' }} onClick={() => window.open(d.file_url, '_blank', 'noopener')}>
                    <TableCell><Chip size="small" label={d.doc_type} variant="outlined" /></TableCell>
                    <TableCell><Typography variant="body2" fontWeight={600}>{d.title}</Typography><Typography variant="caption" color="text.secondary">{d.file_name}</Typography></TableCell>
                    <TableCell>{d.version}</TableCell>
                    <TableCell>{d.created_at ? new Date(d.created_at).toLocaleDateString('en-GB') : '—'}</TableCell>
                    <TableCell align="right" onClick={e => e.stopPropagation()}>
                      <Button size="small" startIcon={<OpenInNewIcon />} onClick={() => window.open(d.file_url, '_blank', 'noopener')}>Open</Button>
                      <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => handleDocDelete(d.id)}>Delete</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Paper sx={{ p: 4, borderRadius: 2.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>Billing History</Typography>
        {org.invoices?.length === 0 ? (
          <Typography color="#5D6E85" sx={{ textAlign: 'center', py: 4 }}>No invoices</Typography>
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
          <Typography variant="body2" color="#51637A">
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
