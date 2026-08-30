import { useState, useEffect } from 'react'
import {
  Box, Button, Typography, Stack, Paper, Card, CardContent, Alert, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid, TextField,
  IconButton,
} from '@mui/material'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Plan } from '@meticle/shared'
import {
  CreditCard, Add as AddIcon, Star as StarIcon,
  DeleteOutline as DeleteIcon, Download as DownloadIcon,
} from '@mui/icons-material'
import api from '../../services/api'

const stripePublishableKey = (import.meta as any).env?.VITE_STRIPE_PUBLISHABLE_KEY || ''
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null

const PLANS = [
  { id: Plan.STARTER, name: 'Starter', price: '99', description: 'For small care teams', features: ['Up to 25 staff', 'Staff profiles', 'Basic compliance', 'Email support'] },
  { id: Plan.PROFESSIONAL, name: 'Professional', price: '299', description: 'Complete compliance suite', popular: true, features: ['Up to 100 staff', 'All Starter features', 'Automated rota', 'DBS monitoring', 'Full compliance', 'Priority support'] },
]

function StripeCardForm({ cardholderName, setCardholderName, onSuccess }: {
  cardholderName: string
  setCardholderName: React.Dispatch<React.SetStateAction<string>>
  onSuccess: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)

  const handleStripeSubmit = async () => {
    if (!stripe || !elements) return
    setProcessing(true); setError('')
    try {
      const { data } = await api.post('/billing/create-setup-intent')
      if (!data.clientSecret) {
        setError('Stripe is not configured for secure card collection. Please contact your administrator.')
        setProcessing(false)
        return
      }
      const result = await stripe.confirmCardSetup(data.clientSecret, {          payment_method: { card: elements.getElement(CardElement)!, billing_details: { name: cardholderName || undefined } },
      })
      if (result.error) { setError(result.error.message || 'Failed'); setProcessing(false) }
      else {
        await api.post('/billing/payment-methods', { payment_method_id: result.setupIntent?.payment_method })
        onSuccess()
      }
    } catch (err: any) { setError(err.response?.data?.message || 'Failed'); setProcessing(false) }
  }

  return (
    <Box>
      <Box sx={{ p: 2, mb: 2, bgcolor: '#F8FAFC', borderRadius: 2, border: '1px solid #E5E7EB' }}>
        <CardElement options={{
          style: { base: { fontSize: '16px', color: '#374151', '::placeholder': { color: '#9CA3AF' } } },
          hidePostalCode: true,
        }} />
      </Box>
      <TextField fullWidth size="small" label="Cardholder Name (optional)" value={cardholderName}
        onChange={e => setCardholderName(e.target.value)} sx={{ mb: 1.5 }} />
      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
      <Stack direction="row" spacing={1}>
        <Button variant="contained" onClick={handleStripeSubmit} disabled={processing || !stripe}
          sx={{ bgcolor: '#0F4C81', textTransform: 'none', flex: 1 }}>
          {processing ? <CircularProgress size={20} /> : 'Save Card'}
        </Button>

      </Stack>
    </Box>
  )
}

function AddCardModal({ open, onClose, onAdded, stripeAvailable }: { open: boolean; onClose: () => void; onAdded: () => void; stripeAvailable: boolean }) {
  const [cardholderName, setCardholderName] = useState('')
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, fontSize: '1.1rem' }}>Add Payment Card</DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        {stripeAvailable ? <StripeCardForm cardholderName={cardholderName} setCardholderName={setCardholderName} onSuccess={onAdded} /> : <Alert severity="error">Secure card collection is unavailable. Configure Stripe Elements before adding a payment method.</Alert>}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>Your card details are collected by Stripe and never handled or stored by Meticle.</Typography>
      </DialogContent>
    </Dialog>
  )
}

function CardDisplay({ pm, onSetDefault, onRemove }: { pm: any; onSetDefault: () => void; onRemove: () => void }) {
  const bg = pm.card_brand === 'amex' ? 'linear-gradient(135deg, #1A1F71, #2E86AB)' :
    pm.card_brand === 'mastercard' ? 'linear-gradient(135deg, #EB001B, #F79E1B)' :
    'linear-gradient(135deg, #0F4C81, #2563EB)'

  return (
    <Box sx={{
      width: 360, p: '20px 24px', py: '28px', borderRadius: 2.5, position: 'relative', overflow: 'hidden',
      background: bg, color: 'white', boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
      border: pm.is_default ? '1.5px solid #F59E0B' : 'none',
      '&:hover .card-remove': { opacity: 1 },
    }}>
      {/* Top row: chip + default badge */}
      <Box sx={{ mb: 3.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ width: 42, height: 32, borderRadius: 1.5, bgcolor: 'rgba(255,215,0,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CreditCard sx={{ fontSize: 18, color: 'rgba(255,215,0,0.7)' }} />
        </Box>
        {pm.is_default && (
          <Chip icon={<StarIcon sx={{ fontSize: 12 }} />} label="Default" size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 700, height: 24, fontSize: '0.7rem', backdropFilter: 'blur(4px)' }} />
        )}
      </Box>

      {/* Card Number */}
      <Typography sx={{ fontSize: '1.35rem', letterSpacing: 4, mb: 2.5, opacity: 0.95, fontFamily: '"Courier New", monospace' }}>
        •••• •••• •••• {pm.card_last_four || '****'}
      </Typography>

      {/* Bottom row: Expiry + Name + Remove */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-end">
        <Box>
          <Typography variant="caption" sx={{ opacity: 0.5, fontSize: '0.5rem', textTransform: 'uppercase', letterSpacing: 1 }}>Expires</Typography>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, letterSpacing: 1 }}>
            {pm.expiry_month?.toString().padStart(2, '0')}/{String(pm.expiry_year).slice(-2)}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.85 }}>
            {pm.cardholder_name || (pm.card_brand ? pm.card_brand.toUpperCase() : '')}
          </Typography>
          <IconButton size="small" onClick={onRemove} className="card-remove"
            sx={{ opacity: 0, transition: 'opacity 0.15s', color: 'rgba(255,255,255,0.7)', p: 0.5, '&:hover': { color: 'white', bgcolor: 'rgba(255,0,0,0.25)' } }}>
            <DeleteIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Stack>
      </Stack>

      {/* Set Default link */}
      {!pm.is_default && (
        <Button size="small" onClick={onSetDefault}
          sx={{ mt: 1.5, color: 'rgba(255,255,255,0.7)', fontSize: '0.65rem', textTransform: 'none', px: 1, minWidth: 0,
            bgcolor: 'rgba(255,255,255,0.08)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)', color: 'white' } }}>
          Make Default
        </Button>
      )}
    </Box>
  )
}

function BillingPageInner() {
  const [subscription, setSubscription] = useState<{ plan: string; subscriptionStatus: string; trialEndsAt: string; currentPeriodEnd: string | null; daysRemaining: number; hasUnpaidInvoice?: boolean; stripeUnavailable?: boolean } | null>(null)
  const [invoices, setInvoices] = useState<any[]>([])
  const [paymentMethods, setPaymentMethods] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [message, setMessage] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [addCardOpen, setAddCardOpen] = useState(false)
  const [removeCardDialog, setRemoveCardDialog] = useState('')
  const [retrying, setRetrying] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const userStr = localStorage.getItem('user')
  let user: any = null
  try { user = userStr ? JSON.parse(userStr) : null } catch { user = null }

  const loadBillingData = async () => {
    try {
      const subRes = await api.get('/billing/subscription')
      setSubscription(subRes.data)
    } catch { /* non-critical */ }
    try {
      const invRes = await api.get('/billing/invoices')
      setInvoices(invRes.data)
    } catch { /* non-critical */ }
    try {
      const pmRes = await api.get('/billing/payment-methods')
      setPaymentMethods(pmRes.data)
    } catch { /* non-critical */ }
  }

  useEffect(() => {
    if (!user?.organization_id) { setLoading(false); return }
    loadBillingData().finally(() => setLoading(false))
  }, [user?.organization_id])

  const handleCardAdded = async () => {
    setAddCardOpen(false)
    setMessage('Card added successfully.')
    loadBillingData()
  }

  const handleDownloadInvoice = async (inv: any) => {
    setDownloadingId(inv.id)
    try {
      const res = await api.get(`/billing/invoices/${inv.id}/download`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoice-${(inv.invoice_number || inv.id).replace(/[^A-Za-z0-9-_]/g, '')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* ignore */ } finally {
      setDownloadingId(null)
    }
  }

  const handleSetDefault = async (id: string) => {
    try {
      await api.patch(`/billing/payment-methods/${id}/default`)
      loadBillingData()
      setMessage('Default card updated.')
    } catch { setMessage('Failed.') }
  }

  const handleRemoveCard = async (id: string) => {
    try {
      await api.delete(`/billing/payment-methods/${id}`)
      loadBillingData()
      setMessage('Card removed.')
    } catch (err: any) { setMessage(err.response?.data?.message || 'Failed to remove card.') }
    setRemoveCardDialog('')
  }

  const handleUpgradeClick = (planId: string) => { setSelectedPlan(planId); setConfirmOpen(true) }
  const handleConfirmUpgrade = async () => {
    if (!selectedPlan) return
    setUpdating(true); setConfirmOpen(false)
    try {
      await api.patch('/billing/subscription', { plan: selectedPlan })
      setMessage(`Plan updated to ${PLANS.find(p => p.id === selectedPlan)?.name}.`)
      loadBillingData()
    } catch { setMessage('Failed to update plan.') }
    finally { setUpdating(false); setSelectedPlan(null) }
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>

  const redirectReason = localStorage.getItem('redirectReason')
  const subMessage = localStorage.getItem('subscriptionMessage')
  const isRedirectedFromBlock = redirectReason === 'subscription_expired'
  if (isRedirectedFromBlock) {
    localStorage.removeItem('redirectReason')
    localStorage.removeItem('subscriptionMessage')
  }

  const subStatus = subscription?.subscriptionStatus
  const trialEndsAt = subscription?.trialEndsAt ? new Date(subscription.trialEndsAt) : null
  const daysRemaining = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000)) : 0
  const isTrialActive = subStatus === 'trial' && trialEndsAt && trialEndsAt > new Date()
  const isActive = subStatus === 'active' || !!isTrialActive

  let statusLabel: string
  let statusColor: 'success' | 'warning' | 'error' | 'default' = 'default'
  if (subStatus === 'active') { statusLabel = 'Active'; statusColor = 'success' }
  else if (isTrialActive) { statusLabel = `Trial (${daysRemaining}d left)`; statusColor = 'warning' }
  else if (subStatus === 'trial') { statusLabel = 'Trial Expired'; statusColor = 'error' }
  else { statusLabel = subStatus ? subStatus.charAt(0).toUpperCase() + subStatus.slice(1) : 'Inactive'; statusColor = 'error' }

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Billing</Typography>
        {isActive && (
          <Button
            variant="text"
            size="small"
            onClick={() => window.location.href = '/'}
            sx={{ textTransform: 'none', color: '#6B7280' }}
          >
            ← Back to dashboard
          </Button>
        )}
      </Stack>

      {subscription?.stripeUnavailable && (
        <Alert severity="error" sx={{ mb: 4, borderRadius: 2 }}>
          <Typography variant="subtitle2" fontWeight={700}>Stripe billing is not configured on the server</Typography>
          <Typography variant="body2">Payment cards, subscriptions and invoices are unavailable until the administrator adds a valid live Stripe key and webhook secret. Please contact your system administrator.</Typography>
        </Alert>
      )}

      {message && (
        <Alert severity={message.includes('Failed') ? 'error' : 'success'} sx={{ mb: 4, borderRadius: 2 }} onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}      {isRedirectedFromBlock && (
        <Alert severity="warning" sx={{ mb: 4, borderRadius: 2, bgcolor: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>Welcome back</Typography>
          <Typography variant="body2">
            {subMessage || 'Your subscription needs attention. Please update your billing information below to restore access.'}
          </Typography>
        </Alert>
      )}

      {!isActive && (
        <Paper sx={{ p: 4, mb: 4, borderRadius: 2.5, border: '2px solid #FEE2E2', bgcolor: '#FEF2F2' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" fontWeight={800} color="#991B1B" sx={{ mb: 0.5 }}>
                {subStatus === 'canceled' ? 'Your subscription has been canceled' : subStatus === 'trial' ? 'Your trial has ended' : 'Your subscription has ended'}
              </Typography>
              <Typography variant="body2" color="#991B1B">
                {subStatus === 'past_due' || subscription?.hasUnpaidInvoice
                  ? 'There is an unpaid invoice. Update your payment method and retry to restore access.'
                  : 'Add a payment card and renew your plan to restore full access to Meticle.'}
              </Typography>
              {subscription?.hasUnpaidInvoice && (
                <Typography variant="caption" color="#B91C1C" sx={{ mt: 0.5, display: 'block' }}>
                  Unpaid invoice: {invoices.find(i => i.status === 'open')?.description || 'subscription invoice'}
                </Typography>
              )}
            </Box>
            <Stack direction="row" spacing={2} flexShrink={0}>
              {(subStatus === 'past_due' || subscription?.hasUnpaidInvoice) && (
                <Button
                  variant="contained"
                  size="small"
                  disabled={retrying}
                  sx={{ bgcolor: '#DC2626', '&:hover': { bgcolor: '#B91C1C' }, textTransform: 'none', fontWeight: 700 }}
                  onClick={async () => {
                    setRetrying(true)
                    setMessage('')
                    try {
                      const { data } = await api.post('/billing/retry-payment')
                      if (data.requiresAction && data.clientSecret && stripePromise) {
                        setMessage('Your bank requires you to confirm this payment — please complete the pop-up.')
                        const stripe = await stripePromise
                        if (!stripe) { setMessage('Payment not confirmed — try again in a moment.'); return }
                        const result = await stripe.confirmCardPayment(data.clientSecret)
                        if (result.error) {
                          setMessage(`Payment not confirmed: ${result.error.message}`)
                        } else {
                          setMessage('Payment successful!')
                          loadBillingData()
                          window.dispatchEvent(new Event('subscriptionUpdated'))
                        }
                      } else {
                        setMessage('Payment successful!')
                        loadBillingData()
                        window.dispatchEvent(new Event('subscriptionUpdated'))
                      }
                    } catch (err: any) {
                      setMessage(err?.response?.data?.message || 'Retry failed — check your payment method.')
                    } finally {
                      setRetrying(false)
                    }
                  }}
                >
                  {retrying ? <CircularProgress size={18} color="inherit" /> : 'Retry Payment'}
                </Button>
              )}
              <Button
                variant="contained"
                size="small"
                disabled={updating}
                sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A66' }, textTransform: 'none', fontWeight: 700 }}
                onClick={() => handleUpgradeClick(subscription?.plan || 'starter')}
              >
                {updating ? <CircularProgress size={18} color="inherit" /> : (subStatus === 'canceled' ? 'Renew Subscription' : subStatus === 'trial' ? 'Subscribe Now' : 'Renew Now')}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      {isTrialActive && (
        <Alert severity="info" sx={{ mb: 4, borderRadius: 2, bgcolor: '#F0F9FF', border: '1px solid #BAE6FD' }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>Trial limitations</Typography>
          <Typography variant="body2" color="#6B7280">
            Your trial is limited to <strong>10 staff members</strong>. You currently have access to all features including AI insights, compliance tracking, and the rota planner. Upgrade anytime to remove the limit and continue after your trial expires.
          </Typography>
        </Alert>
      )}


      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, borderRadius: 2.5, height: '100%' }}>
            <Typography variant="body2" color="#6B7280">Current Plan</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, textTransform: 'capitalize' }}>{subscription?.plan || '—'}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, borderRadius: 2.5, height: '100%' }}>
            <Typography variant="body2" color="#6B7280">Status</Typography>
            <Chip label={statusLabel} color={statusColor} size="small" sx={{ fontWeight: 700, textTransform: 'capitalize', mt: 0.5 }} />
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, borderRadius: 2.5, height: '100%' }}>
            <Typography variant="body2" color="#6B7280">Next Billing Date</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              {(subscription?.currentPeriodEnd || subscription?.trialEndsAt)
                ? new Date(subscription.currentPeriodEnd || subscription.trialEndsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—'}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Payment Methods */}
      <Paper sx={{ p: 4, mb: 4, borderRadius: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Payment Methods</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddCardOpen(true)}
            sx={{ bgcolor: '#0F4C81', textTransform: 'none', borderRadius: 2 }}>
            Add Card
          </Button>
          <AddCardModal open={addCardOpen} onClose={() => setAddCardOpen(false)} onAdded={handleCardAdded} stripeAvailable={!!stripePromise} />
        </Stack>

        {paymentMethods.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CreditCard sx={{ fontSize: 48, color: '#D1D5DB', mb: 1 }} />
            <Typography color="#9CA3AF" sx={{ mb: 1 }}>No payment method on file</Typography>
            <Typography variant="caption" color="#6B7280">Add a card to manage your subscription</Typography>
          </Box>
        ) : (
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            {paymentMethods.map(pm => (
              <CardDisplay key={pm.id} pm={pm} onSetDefault={() => handleSetDefault(pm.id)} onRemove={() => setRemoveCardDialog(pm.id)} />
            ))}
          </Stack>
        )}
      </Paper>

      {/* Plans */}
      <Paper sx={{ p: 4, mb: 4, borderRadius: 2.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 4 }}>Choose a Plan</Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={4}>
          {PLANS.map((plan) => (
            <Card key={plan.id} sx={{
              flex: 1, position: 'relative', overflow: 'visible',
              border: subscription?.plan === plan.id ? '2px solid #0F4C81' : '1px solid #E5E7EB', borderRadius: 3,
            }}>
              {plan.popular && (
                <Box sx={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', bgcolor: '#0F4C81', color: 'white', px: 2, py: 0.5, borderRadius: 9999, fontSize: '0.75rem', fontWeight: 800, zIndex: 10 }}>
                  Most Popular
                </Box>
              )}
              <CardContent sx={{ pt: plan.popular ? 5 : 3, pb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>{plan.name}</Typography>
                <Typography sx={{ color: '#0F4C81', fontSize: '2.5rem', fontWeight: 800 }}>
                  £{plan.price}<Typography component="span" sx={{ color: '#6B7280', fontSize: '1rem', fontWeight: 400 }}>/month</Typography>
                </Typography>
                <Typography variant="body2" color="#6B7280" sx={{ mt: 1, mb: 2 }}>{plan.description}</Typography>
                <Stack spacing={1}>
                  {plan.features.map((f) => <Typography key={f} variant="body2" color="#374151">✓ {f}</Typography>)}
                </Stack>
              </CardContent>
              <Box sx={{ px: 3, pb: 3 }}>
                <Button fullWidth variant={subscription?.plan === plan.id && isActive ? 'outlined' : 'contained'}
                  disabled={(subscription?.plan === plan.id && isActive) || updating}
                  onClick={() => handleUpgradeClick(plan.id)} sx={{ py: 1.5, fontWeight: 800 }}>
                  {subscription?.plan === plan.id && isActive ? 'Current Plan' : !isActive ? (updating ? 'Renewing...' : 'Renew') : updating ? 'Updating...' : 'Select Plan'}
                </Button>
              </Box>
            </Card>
          ))}
        </Stack>
      </Paper>

      {/* Billing History */}
      <Paper sx={{ p: 4, borderRadius: 2.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>Billing History</Typography>
        {invoices.length === 0 ? (
          <Typography variant="body2" color="#9CA3AF" sx={{ textAlign: 'center', py: 4 }}>No invoices yet.</Typography>
        ) : (
          <TableContainer>
            <Table>
              <TableHead><TableRow>
                <TableCell>Invoice</TableCell><TableCell>Date</TableCell><TableCell>Description</TableCell><TableCell>Amount</TableCell><TableCell>Status</TableCell><TableCell align="right">Download</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell><Typography variant="body2" fontWeight={600}>{inv.invoice_number}</Typography></TableCell>
                    <TableCell>{inv.issued_at ? new Date(inv.issued_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</TableCell>
                    <TableCell>{inv.description}</TableCell>
                    <TableCell>£{parseFloat(inv.amount).toFixed(2)}</TableCell>
                    <TableCell><Chip label={inv.status === 'paid' ? 'Paid' : 'Upcoming'} size="small" color={inv.status === 'paid' ? 'success' : 'default'} /></TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        title={`Download ${inv.invoice_number}`}
                        disabled={downloadingId === inv.id}
                        onClick={(e) => { e.stopPropagation(); handleDownloadInvoice(inv) }}
                      >
                        {downloadingId === inv.id ? <CircularProgress size={16} /> : <DownloadIcon fontSize="small" />}
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Remove Card Confirmation */}
      <Dialog open={!!removeCardDialog} onClose={() => setRemoveCardDialog('')} maxWidth="xs" fullWidth>
        <DialogTitle>Remove Card</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="#6B7280">Are you sure you want to remove this card?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveCardDialog('')}>Cancel</Button>
          <Button onClick={() => handleRemoveCard(removeCardDialog)} variant="contained" color="error">Remove</Button>
        </DialogActions>
      </Dialog>

      {/* Upgrade Confirmation */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Change Plan</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="#6B7280">
            Switch to <strong>{PLANS.find(p => p.id === selectedPlan)?.name}</strong> plan?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmUpgrade} variant="contained" disabled={updating}>{updating ? 'Updating...' : 'Confirm'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default function BillingPage() {
  if (!stripePromise) return <BillingPageInner />
  return <Elements stripe={stripePromise}><BillingPageInner /></Elements>
}
