import { useState, useEffect } from 'react'
import {
  Box, Button, Typography, Stack, Paper, Card, CardContent, Alert, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid, TextField,
  IconButton, Switch, FormControlLabel,
} from '@mui/material'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Plan } from '@meticle/shared'
import {
  CreditCard, Add as AddIcon, Star as StarIcon,
  DeleteOutline as DeleteIcon, Download as DownloadIcon,
} from '@mui/icons-material'
import api from '../../services/api'
import { EmptyState } from '../../components/design/EmptyState'

const stripePublishableKey = (import.meta as any).env?.VITE_STRIPE_PUBLISHABLE_KEY || ''
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null

const PLANS = [
  { id: Plan.STARTER, name: 'Starter', price: '99', description: 'For small care teams', features: ['Core care records and staff tools', 'Scheduling and compliance essentials', 'Email support'] },
  { id: Plan.PROFESSIONAL, name: 'Professional', price: '299', description: 'For growing care teams', popular: true, features: ['Everything in Starter', 'Expanded operational workflows', 'Advanced reporting and priority support'] },
]

type BillingAddress = { line1: string; line2?: string; city: string; postal_code: string; country: 'GB' }

type BillingConfig = {
  domiciliary?: {
    travel_time_paid?: boolean
    travel_pay_included?: boolean
    pay_inter_client_travel?: boolean
    vat_inclusive?: boolean
    vat_rate?: number
  }
  [key: string]: any
}

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
    if (!stripe || !elements) { setError('Stripe is still loading — please wait a moment and try again.'); return }
    const cardElement = elements.getElement(CardElement)
    if (!cardElement) { setError('Please enter your card details.'); return }
    setProcessing(true); setError('')
    try {
      const { data } = await api.post('/billing/create-setup-intent')
      if (!data.clientSecret) {
        setError('Stripe is not configured for secure card collection. Please contact your administrator.')
        setProcessing(false)
        return
      }
      const result = await stripe.confirmCardSetup(data.clientSecret, {          payment_method: { card: cardElement, billing_details: { name: cardholderName || undefined } },
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

      <Box sx={{ p: 2, mb: 2, bgcolor: 'grey.50', borderRadius: 2, border: '1px solid', borderColor: 'grey.200' }}>
        <CardElement options={{
          style: { base: { fontSize: '16px', color: 'text.primary', '::placeholder': { color: 'text.secondary' } } },
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
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>Your card details are collected by Stripe and never handled or stored by Meticle Care.</Typography>
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
  const [subscription, setSubscription] = useState<{ plan: string; subscriptionStatus: string; trialEndsAt: string; currentPeriodEnd: string | null; daysRemaining: number; hasUnpaidInvoice?: boolean; stripeUnavailable?: boolean; domiciliaryMonthlyPricePence?: number | null; domiciliaryActiveMonthlyPricePence?: number | null; domiciliaryQuoteAcceptedAt?: string | null; domiciliaryQuoteUpdatedAt?: string | null; domiciliaryPriceVatBehavior?: 'inclusive' | 'exclusive' | null; domiciliaryStripeSubscriptionId?: string | null; domiciliaryBillingAddress?: BillingAddress | null } | null>(null)
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
  const [billingConfig, setBillingConfig] = useState<BillingConfig | null>(null)
  const [savingBillingConfig, setSavingBillingConfig] = useState(false)
  const [isDomiciliary, setIsDomiciliary] = useState(false)
  const [billingAddress, setBillingAddress] = useState<BillingAddress>({ line1: '', line2: '', city: '', postal_code: '', country: 'GB' })
  const [savingAddress, setSavingAddress] = useState(false)
  const [acceptingQuote, setAcceptingQuote] = useState(false)

  const userStr = localStorage.getItem('user')
  let user: any = null
  try { user = userStr ? JSON.parse(userStr) : null } catch { user = null }
  const isOrgAdmin = user?.role === 'ORG_ADMIN'

  const loadBillingData = async () => {
    try {
      const subRes = await api.get('/billing/subscription')
      setSubscription(subRes.data)
      if (subRes.data?.domiciliaryBillingAddress) {
        setBillingAddress(current => ({ ...current, ...subRes.data.domiciliaryBillingAddress, country: 'GB' }))
      } else if (subRes.data?.plan === 'sales_led') {
        setBillingAddress(current => ({ ...current, line1: '', line2: '', city: '', postal_code: '', country: 'GB' }))
      }
    } catch { /* non-critical */ }
    try {
      const invRes = await api.get('/billing/invoices')
      setInvoices(invRes.data)
    } catch { /* non-critical */ }
    try {
      const pmRes = await api.get('/billing/payment-methods')
      setPaymentMethods(pmRes.data)
    } catch { /* non-critical */ }
    if (isOrgAdmin) {
      try {
        const orgRes = await api.get('/settings/org')
        const types: string[] = orgRes.data?.primary_service_type
          ? [orgRes.data.primary_service_type]
          : (Array.isArray(orgRes.data?.service_types) ? orgRes.data.service_types : [])
        const domiciliary = types.some(type => ['domiciliary', 'live_in'].includes(type))
        setIsDomiciliary(domiciliary)
        if (domiciliary) {
          const configRes = await api.get('/billing/pricing-config')
          setBillingConfig(configRes.data)
        }
      } catch { /* non-critical: non-admins do not have access */ }
    }
  }

  const updateDomiciliaryConfig = (field: string, value: number | boolean) => {
    setBillingConfig((current) => ({
      ...(current || {}),
      domiciliary: {
        ...(current?.domiciliary || {}),
        [field]: value,
      },
    }))
  }

  const saveDomiciliaryAddress = async () => {
    setSavingAddress(true)
    try {
      await api.put('/billing/domiciliary/billing-address', { address: billingAddress })
      setMessage('UK billing address saved.')
      await loadBillingData()
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'Could not save billing address.')
    } finally { setSavingAddress(false) }
  }

  const acceptDomiciliaryQuote = async () => {
    setAcceptingQuote(true)
    try {
      const { data } = await api.post('/billing/domiciliary/accept-quote')
      setMessage(data?.message || 'Domiciliary subscription activated.')
      await loadBillingData()
      window.dispatchEvent(new Event('subscriptionUpdated'))
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'Could not activate the agreed subscription.')
    } finally { setAcceptingQuote(false) }
  }

  const saveBillingConfig = async () => {
    if (!billingConfig) return
    setSavingBillingConfig(true)
    try {
      await api.patch('/billing/pricing-config', { billing_config: billingConfig })
      setMessage('Internal billing configuration saved. It does not change the Stripe plan price.')
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Failed to save billing configuration.')
    } finally {
      setSavingBillingConfig(false)
    }
  }

  useEffect(() => {
    if (!(user?.organization_id || user?.organizationId)) { setLoading(false); return }
    loadBillingData().finally(() => setLoading(false))
  }, [user?.organization_id, user?.organizationId, isOrgAdmin])

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
      const { data } = await api.patch('/billing/subscription', { plan: selectedPlan })
      setMessage(data?.message || `Plan updated to ${PLANS.find(p => p.id === selectedPlan)?.name}.`)
      loadBillingData()
      window.dispatchEvent(new Event('subscriptionUpdated'))
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to update plan.'
      setMessage(msg)
    } finally { setUpdating(false); setSelectedPlan(null) }
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
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 4 }}>Billing</Typography>

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
        <Alert severity="warning" sx={{ mb: 4, borderRadius: 2, bgcolor: 'warning.light', border: '1px solid #FDE68A' }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>Welcome back</Typography>
          <Typography variant="body2">
            {subMessage || 'Your subscription needs attention. Please update your billing information below to restore access.'}
          </Typography>
        </Alert>
      )}

      {!isActive && !isDomiciliary && (
        <Paper sx={{ p: 4, mb: 4, borderRadius: 2.5, border: '2px solid #FEE2E2', bgcolor: 'error.light' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" fontWeight={800} color="#991B1B" sx={{ mb: 0.5 }}>
                {subStatus === 'canceled' ? 'Your subscription has been canceled' : subStatus === 'trial' ? 'Your trial has ended' : 'Your subscription has ended'}
              </Typography>
              <Typography variant="body2" color="#991B1B">
                {subStatus === 'past_due' || subscription?.hasUnpaidInvoice
                  ? 'There is an unpaid invoice. Update your payment method and retry to restore access.'
                  : 'Add a payment card and switch your plan to restore full access to Meticle Care.'}
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
                  sx={{ bgcolor: '#DC2626', '&:hover': { bgcolor: 'error.dark' }, textTransform: 'none', fontWeight: 700 }}
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
        <Alert severity="info" sx={{ mb: 4, borderRadius: 2, bgcolor: 'info.light', border: '1px solid #BAE6FD' }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>Trial limitations</Typography>
          <Typography variant="body2" color="#6B7280">
            Your trial is limited to <strong>10 staff members</strong>. You currently have access to all features including AI insights, compliance tracking, and the rota planner. Upgrade anytime to remove the limit and continue after your trial expires.
          </Typography>
        </Alert>
      )}


      {isDomiciliary && (
        <Paper sx={{ p: 3, mb: 4, border: '1px solid', borderColor: 'divider', borderRadius: 2.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Domiciliary subscription</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
            Pricing is agreed with our team for your organisation. Your care-package billing profiles are separate and do not affect this platform subscription.
          </Typography>
          {subscription?.domiciliaryMonthlyPricePence ? (
            <Stack spacing={1} sx={{ mb: 2 }}>
              <Typography variant="h5" fontWeight={800}>
                Quote: £{(subscription.domiciliaryMonthlyPricePence / 100).toFixed(2)} / month
                <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  {subscription.domiciliaryPriceVatBehavior === 'inclusive' ? 'VAT included' : 'VAT added where applicable'}
                </Typography>
              </Typography>
              {subscription.domiciliaryActiveMonthlyPricePence != null && (
                <Typography variant="body2" color="text.secondary">
                  Currently billed: £{(subscription.domiciliaryActiveMonthlyPricePence / 100).toFixed(2)} / month
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary">
                {subscription.domiciliaryQuoteAcceptedAt && subscription.domiciliaryStripeSubscriptionId && subscription.subscriptionStatus !== 'canceled'
                  ? `Agreed and active${subscription.currentPeriodEnd ? ` · next billing date ${new Date(subscription.currentPeriodEnd).toLocaleDateString('en-GB')}` : ''}`
                  : 'Draft quote for review. It will not be charged until an organisation admin accepts it.'}
              </Typography>
            </Stack>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>No monthly subscription quote is on file yet. Contact the MeticleCare team to agree your price.</Alert>
          )}
          {subscription?.domiciliaryStripeSubscriptionId && subscription?.subscriptionStatus === 'canceled' && (
            <Alert severity="warning" sx={{ mb: 2 }}>The previous domiciliary subscription has been cancelled. Your current quote remains available for review and activation.</Alert>
          )}
          {isOrgAdmin && subscription?.domiciliaryMonthlyPricePence && (
            <Stack spacing={2}>
              <Typography variant="subtitle2" fontWeight={700}>UK billing address for VAT invoices</Typography>
              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Address line 1" value={billingAddress.line1} onChange={e => setBillingAddress({ ...billingAddress, line1: e.target.value })} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Address line 2 (optional)" value={billingAddress.line2 || ''} onChange={e => setBillingAddress({ ...billingAddress, line2: e.target.value })} /></Grid>
                <Grid item xs={12} sm={4}><TextField fullWidth size="small" label="Town / city" value={billingAddress.city} onChange={e => setBillingAddress({ ...billingAddress, city: e.target.value })} /></Grid>
                <Grid item xs={12} sm={4}><TextField fullWidth size="small" label="Postcode" value={billingAddress.postal_code} onChange={e => setBillingAddress({ ...billingAddress, postal_code: e.target.value })} /></Grid>
                <Grid item xs={12} sm={4}><TextField fullWidth size="small" label="Country" value="United Kingdom" disabled /></Grid>
              </Grid>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button variant="outlined" onClick={saveDomiciliaryAddress} disabled={savingAddress || !billingAddress.line1 || !billingAddress.city || !billingAddress.postal_code}>
                  {savingAddress ? <CircularProgress size={18} /> : 'Save billing address'}
                </Button>
                {!paymentMethods.length && <Button variant="outlined" onClick={() => setAddCardOpen(true)}>Add payment card</Button>}
                {!!paymentMethods.length && !subscription?.domiciliaryBillingAddress?.line1 && <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>Save the address before accepting the quote.</Typography>}
                {!(subscription?.domiciliaryQuoteAcceptedAt && subscription?.domiciliaryStripeSubscriptionId && subscription?.subscriptionStatus !== 'canceled') && (
                  <Button variant="contained" onClick={acceptDomiciliaryQuote}
                    disabled={acceptingQuote || !paymentMethods.length || !subscription?.domiciliaryBillingAddress?.line1 || !subscription?.domiciliaryBillingAddress?.city || !subscription?.domiciliaryBillingAddress?.postal_code}>
                    {acceptingQuote ? <CircularProgress size={18} color="inherit" /> : 'Accept quote & activate subscription'}
                  </Button>
                )}
              </Stack>
            </Stack>
          )}
        </Paper>
      )}

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, borderRadius: 2.5, height: '100%' }}>
            <Typography variant="body2" color="#6B7280">Current Plan</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, textTransform: 'capitalize' }}>{isDomiciliary ? 'Sales-led agreement' : subscription?.plan || '—'}</Typography>
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
            <Typography variant="body2" color="#6B7280">{!isActive ? 'Expired On' : 'Next Billing Date'}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              {!isActive
                ? (subscription?.trialEndsAt || subscription?.currentPeriodEnd)
                  ? new Date(subscription.trialEndsAt || subscription.currentPeriodEnd!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '—'
                : (subscription?.currentPeriodEnd || subscription?.trialEndsAt)
                  ? new Date(subscription.currentPeriodEnd || subscription.trialEndsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '—'
              }
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {isOrgAdmin && isDomiciliary && billingConfig?.domiciliary && (
        <Paper sx={{ p: 4, mb: 4, borderRadius: 2.5, border: '1px solid', borderColor: 'grey.200' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 1 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>Domiciliary VAT & travel settings</Typography>
              <Typography variant="body2" color="#6B7280" sx={{ mt: 0.5 }}>
                Client charges are calculated from each care package’s billing profile or package override in Visits & Packages. These settings control invoice VAT and paid travel policy; they do not change your MeticleCare subscription.
              </Typography>
            </Box>
            <Button variant="contained" onClick={saveBillingConfig} disabled={savingBillingConfig} sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' }, bgcolor: '#0F4C81', textTransform: 'none' }}>
              {savingBillingConfig ? <CircularProgress size={18} color="inherit" /> : 'Save settings'}
            </Button>
          </Stack>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" type="number" label="VAT rate (%)" inputProps={{ min: 0, max: 100, step: 0.1 }}
                value={billingConfig.domiciliary.vat_rate ?? 20}
                onChange={(e) => updateDomiciliaryConfig('vat_rate', Math.min(100, Math.max(0, Number(e.target.value || 0))))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel sx={{ ml: 0, mt: 0.5 }}
                control={<Switch checked={!!billingConfig.domiciliary.vat_inclusive} onChange={(e) => updateDomiciliaryConfig('vat_inclusive', e.target.checked)} />}
                label={billingConfig.domiciliary.vat_inclusive ? 'Rates include VAT' : 'Rates exclude VAT'} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel sx={{ ml: 0 }}
                control={<Switch checked={billingConfig.domiciliary.travel_time_paid ?? billingConfig.domiciliary.travel_pay_included ?? true} onChange={(e) => updateDomiciliaryConfig('travel_time_paid', e.target.checked)} />}
                label="Pay carers for travel time" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel sx={{ ml: 0 }}
                control={<Switch checked={billingConfig.domiciliary.pay_inter_client_travel ?? true} onChange={(e) => updateDomiciliaryConfig('pay_inter_client_travel', e.target.checked)} />}
                label="Include travel between client visits" />
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Payment Methods */}
      {isOrgAdmin && <Paper sx={{ p: 4, mb: 4, borderRadius: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Payment Methods</Typography>            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddCardOpen(true)}
              sx={{ bgcolor: '#0F4C81', textTransform: 'none', borderRadius: 2 }}>
            Add Card
          </Button>
        </Stack>

        {paymentMethods.length === 0 ? (
          <EmptyState title="No payment method on file" description="Add a card to manage your subscription" variant="default" />
        ) : (
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            {paymentMethods.map(pm => (
              <CardDisplay key={pm.id} pm={pm} onSetDefault={() => handleSetDefault(pm.id)} onRemove={() => setRemoveCardDialog(pm.id)} />
            ))}
          </Stack>
        )}
      </Paper>}

      {/* Plans */}
      {!isDomiciliary && <Paper sx={{ p: 4, mb: 4, borderRadius: 2.5 }}>
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
                  £{plan.price}<Typography component="span" sx={{ color: 'text.secondary', fontSize: '1rem', fontWeight: 400 }}>/month</Typography>
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
                  {subscription?.plan === plan.id && isActive ? 'Current Plan' : !isActive ? (updating ? 'Switching...' : 'Switch and Renew') : updating ? 'Updating...' : 'Switch Plan'}
                </Button>
              </Box>
            </Card>
          ))}
        </Stack>
      </Paper>}

      {isDomiciliary && isOrgAdmin && <AddCardModal open={addCardOpen} onClose={() => setAddCardOpen(false)} onAdded={handleCardAdded} stripeAvailable={!!stripePromise} />}

      {/* Billing History */}
      <Paper sx={{ p: 4, borderRadius: 2.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>Subscription Billing History</Typography>
        {invoices.length === 0 ? (
          <EmptyState title="No invoices yet" description="Billing history will appear here" variant="default" />
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
                    <TableCell><Chip label={String(inv.status || 'open').replace(/_/g, ' ')} size="small" color={inv.status === 'paid' ? 'success' : ['past_due', 'uncollectible'].includes(inv.status) ? 'error' : ['void', 'deleted'].includes(inv.status) ? 'default' : 'warning'} sx={{ textTransform: 'capitalize' }} /></TableCell>
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
        <DialogTitle>{!isActive ? 'Switch and Renew' : subscription?.plan && selectedPlan !== subscription.plan ? 'Switch Plan' : 'Change Plan'}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="#6B7280">
            {!isActive
              ? <>Switch to <strong>{PLANS.find(p => p.id === selectedPlan)?.name}</strong> plan and renew your subscription?</>
              : <>Switch to <strong>{PLANS.find(p => p.id === selectedPlan)?.name}</strong> plan?</>
            }
          </Typography>
          {!isActive && paymentMethods.length === 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              No payment card on file. Please add a card before renewing.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmUpgrade} variant="contained" disabled={updating || (!isActive && paymentMethods.length === 0)}>{updating ? 'Updating...' : (!isActive ? 'Switch and Renew' : 'Confirm')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default function BillingPage() {
  if (!stripePromise) return <BillingPageInner />
  return <Elements stripe={stripePromise}><BillingPageInner /></Elements>
}
