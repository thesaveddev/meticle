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
  Info as InfoIcon, DeleteOutline as DeleteIcon,
} from '@mui/icons-material'
import api from '../../services/api'

const stripePublishableKey = (import.meta as any).env?.VITE_STRIPE_PUBLISHABLE_KEY || ''
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null

const TEST_CARD = { number: '4242 4242 4242 4242', exp: '12/28', cvc: '123' }

const PLANS = [
  { id: Plan.STARTER, name: 'Starter', price: '99', description: 'For small care teams', features: ['Up to 25 staff', 'Staff profiles', 'Basic compliance', 'Email support'] },
  { id: Plan.PROFESSIONAL, name: 'Professional', price: '299', description: 'Complete compliance suite', popular: true, features: ['Up to 100 staff', 'All Starter features', 'Automated rota', 'DBS monitoring', 'Full compliance', 'Priority support'] },
]

function StripeCardForm({ manual, setManual, onSuccess, onShowManual }: {
  manual: { number: string; expiry: string; cvc: string; name: string }
  setManual: React.Dispatch<React.SetStateAction<{ number: string; expiry: string; cvc: string; name: string }>>
  onSuccess: () => void
  onShowManual: () => void
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
        onShowManual()
        setProcessing(false)
        return
      }
      const result = await stripe.confirmCardSetup(data.clientSecret, {
        payment_method: { card: elements.getElement(CardElement)!, billing_details: { name: manual.name || undefined } },
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
      <TextField fullWidth size="small" label="Cardholder Name (optional)" value={manual.name}
        onChange={e => setManual(m => ({ ...m, name: e.target.value }))} sx={{ mb: 1.5 }} />
      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
      <Stack direction="row" spacing={1}>
        <Button variant="contained" onClick={handleStripeSubmit} disabled={processing || !stripe}
          sx={{ bgcolor: '#0F4C81', textTransform: 'none', flex: 1 }}>
          {processing ? <CircularProgress size={20} /> : 'Save Card'}
        </Button>
        <Button variant="text" size="small" onClick={onShowManual} sx={{ color: '#6B7280', textTransform: 'none' }}>
          Enter manually
        </Button>
      </Stack>
    </Box>
  )
}

function ManualCardForm({ manual, setManual, error, processing, onSubmit, hasStripe }: {
  manual: { number: string; expiry: string; cvc: string; name: string }
  setManual: React.Dispatch<React.SetStateAction<{ number: string; expiry: string; cvc: string; name: string }>>
  error: string
  processing: boolean
  onSubmit: () => void
  hasStripe: boolean
}) {
  return (
    <Box>
      <Stack spacing={1.5}>
        <TextField fullWidth size="small" label="Card Number" placeholder="4242 4242 4242 4242" value={manual.number}
          onChange={e => setManual(m => ({ ...m, number: e.target.value }))} />
        <Stack direction="row" spacing={1}>
          <TextField size="small" label="Expiry (MM/YY)" placeholder="12/28" value={manual.expiry}
            onChange={e => setManual(m => ({ ...m, expiry: e.target.value }))} sx={{ flex: 1 }} />
          <TextField size="small" label="CVC" placeholder="123" value={manual.cvc}
            onChange={e => setManual(m => ({ ...m, cvc: e.target.value }))} sx={{ width: 100 }} />
        </Stack>
        <TextField fullWidth size="small" label="Cardholder Name" value={manual.name}
          onChange={e => setManual(m => ({ ...m, name: e.target.value }))} />
        {error && <Alert severity="error">{error}</Alert>}
        <Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={onSubmit} disabled={processing}
            sx={{ bgcolor: '#0F4C81', textTransform: 'none', flex: 1 }}>
            {processing ? <CircularProgress size={20} /> : 'Save Card'}
          </Button>
          {hasStripe && (
            <Button variant="text" size="small" onClick={() => setManual(m => ({ ...m, expiry: m.expiry }))} sx={{ color: '#6B7280', textTransform: 'none' }}>
              Back
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  )
}

function AddCardModal({ open, onClose, onAdded, stripeAvailable }: { open: boolean; onClose: () => void; onAdded: () => void; stripeAvailable: boolean }) {
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [manual, setManual] = useState({ number: '', expiry: '', cvc: '', name: '' })

  const handleManualSubmit = async () => {
    if (!manual.number || !manual.expiry) { setError('Card number and expiry required'); return }
    setProcessing(true); setError('')
    try {
      const [month, year] = manual.expiry.split('/')
      const last4 = manual.number.replace(/\s/g, '').slice(-4)
      const brand = manual.number.startsWith('4') ? 'visa' : manual.number.startsWith('5') ? 'mastercard' : manual.number.startsWith('3') ? 'amex' : 'card'
      await api.post('/billing/payment-methods', { card_last_four: last4, card_brand: brand, expiry_month: parseInt(month), expiry_year: parseInt('20' + year), cardholder_name: manual.name })
      onAdded()
    } catch (err: any) { setError(err.response?.data?.message || 'Failed'); setProcessing(false) }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, fontSize: '1.1rem' }}>Add Payment Card</DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        {!showManual && stripeAvailable ? (
          <Elements stripe={stripePromise!}>
            <StripeCardForm manual={manual} setManual={setManual} onSuccess={onAdded} onShowManual={() => setShowManual(true)} />
          </Elements>
        ) : (
          <ManualCardForm
            manual={manual} setManual={setManual} error={error} processing={processing}
            onSubmit={handleManualSubmit} hasStripe={stripeAvailable}
          />
        )}
        <Box sx={{ mt: 2, p: 1.5, bgcolor: '#F0F9FF', borderRadius: 2, border: '1px solid #BAE6FD' }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#0284C7', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <InfoIcon sx={{ fontSize: 14 }} /> Test Mode — Use Stripe test card
          </Typography>
          <Typography variant="caption" sx={{ color: '#0369A1', display: 'block', mt: 0.5 }}>
            Number: <strong>{TEST_CARD.number}</strong> · Expiry: <strong>{TEST_CARD.exp}</strong> · CVC: <strong>{TEST_CARD.cvc}</strong>
          </Typography>
        </Box>
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

export default function BillingPage() {
  const [subscription, setSubscription] = useState<{ plan: string; subscriptionStatus: string; trialEndsAt: string; daysRemaining: number } | null>(null)
  const [invoices, setInvoices] = useState<any[]>([])
  const [paymentMethods, setPaymentMethods] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [message, setMessage] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [addCardOpen, setAddCardOpen] = useState(false)
  const [removeCardDialog, setRemoveCardDialog] = useState('')

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
      if (invRes.data.length === 0) {
        try { await api.post('/billing/seed-invoices'); const i2 = await api.get('/billing/invoices'); setInvoices(i2.data) } catch { /* */ }
      }
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
  if (redirectReason === 'subscription_expired') {
    localStorage.removeItem('redirectReason')
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
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 4 }}>Billing</Typography>

      {message && (
        <Alert severity={message.includes('Failed') ? 'error' : 'success'} sx={{ mb: 4, borderRadius: 2 }} onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}

      {!isActive && (
        <Alert severity="warning" sx={{ mb: 4, borderRadius: 2 }}>
          <Typography variant="subtitle2" fontWeight={700}>Your subscription is no longer active</Typography>
          <Typography variant="body2">Add a payment card to restore access to the platform.</Typography>
          {subStatus === 'past_due' && (
            <Button
              variant="contained"
              size="small"
              sx={{ mt: 1.5, bgcolor: '#DC2626', '&:hover': { bgcolor: '#B91C1C' }, textTransform: 'none' }}
              onClick={async () => {
                try {
                  await api.post('/billing/retry-payment')
                  setMessage('Payment successful!')
                  loadBillingData()
                  window.dispatchEvent(new Event('subscriptionUpdated'))
                } catch {
                  setMessage('Retry failed — check your payment method.')
                }
              }}
            >
              Retry Payment
            </Button>
          )}
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
              {subscription?.trialEndsAt ? new Date(subscription.trialEndsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
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
                <Button fullWidth variant={subscription?.plan === plan.id ? 'outlined' : 'contained'}
                  disabled={subscription?.plan === plan.id || updating}
                  onClick={() => handleUpgradeClick(plan.id)} sx={{ py: 1.5, fontWeight: 800 }}>
                  {subscription?.plan === plan.id ? 'Current Plan' : updating ? 'Updating...' : 'Select Plan'}
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
                <TableCell>Invoice</TableCell><TableCell>Date</TableCell><TableCell>Description</TableCell><TableCell>Amount</TableCell><TableCell>Status</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell><Typography variant="body2" fontWeight={600}>{inv.invoice_number}</Typography></TableCell>
                    <TableCell>{inv.issued_at ? new Date(inv.issued_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</TableCell>
                    <TableCell>{inv.description}</TableCell>
                    <TableCell>£{parseFloat(inv.amount).toFixed(2)}</TableCell>
                    <TableCell><Chip label={inv.status === 'paid' ? 'Paid' : 'Upcoming'} size="small" color={inv.status === 'paid' ? 'success' : 'default'} /></TableCell>
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
