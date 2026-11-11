import { useState, useEffect } from 'react'
import {
  Box, Button, Typography, Stack, Paper, Alert, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip,
  Dialog, DialogContent, DialogActions, TextField, FormControlLabel, Switch,
} from '@mui/material'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Plan } from '@meticle/shared'
import {
  CreditCard as CreditCardIcon, Add as AddIcon, Download as DownloadIcon,
  Insights as PlanIcon, CheckCircle as CheckIcon, CalendarMonth as CalendarIcon,
  WarningAmber as WarningIcon, PeopleOutline as StarterIcon,
} from '@mui/icons-material'
import api from '../../services/api'
import { P } from '../../styles/tokens'
import FigDialogHeader from '../people/dialogHeader'
import './billing.css'

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

function planDef(id: string | null | undefined) { return PLANS.find(plan => plan.id === id) }
function planName(id: string | null | undefined) {
  const def = planDef(id)
  if (def) return def.name
  return id ? id.charAt(0).toUpperCase() + id.slice(1) : '—'
}
function planPrice(id: string | null | undefined) {
  const def = planDef(id)
  return def ? `£${def.price} a month` : null
}
function formatDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function brandLabel(brand: string | null | undefined) {
  if (!brand) return 'Card'
  if (brand === 'amex') return 'American Express'
  return brand.charAt(0).toUpperCase() + brand.slice(1)
}

function SectionCard({ title, copy, actions, children, footnote }: { title: string; copy?: string; actions?: React.ReactNode; children: React.ReactNode; footnote?: React.ReactNode }) {
  return (
    <Paper elevation={0} className="bill-card">
      <Box className="bill-card__head">
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h2" className="bill-card__title">{title}</Typography>
          {copy && <Typography className="bill-card__copy">{copy}</Typography>}
        </Box>
        {actions && <Box className="bill-card__actions">{actions}</Box>}
      </Box>
      {children}
      {footnote && <Box className="bill-card__foot">{footnote}</Box>}
    </Paper>
  )
}

function StripeCardForm({ cardholderName, setCardholderName, postalCode, setPostalCode, onSuccess, onCancel }: {
  cardholderName: string
  setCardholderName: React.Dispatch<React.SetStateAction<string>>
  postalCode: string
  setPostalCode: React.Dispatch<React.SetStateAction<string>>
  onSuccess: () => void
  onCancel: () => void
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
      const result = await stripe.confirmCardSetup(data.clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: { name: cardholderName || undefined, address: { postal_code: postalCode || undefined } },
        },
      })
      if (result.error) { setError(result.error.message || 'The card could not be saved.'); setProcessing(false) }
      else {
        await api.post('/billing/payment-methods', { payment_method_id: result.setupIntent?.payment_method })
        onSuccess()
      }
    } catch (err: any) { setError(err.response?.data?.message || 'The card could not be saved.'); setProcessing(false) }
  }

  return (
    <>
      <DialogContent sx={{ pt: 1.5 }}>
        {error && <Alert severity="error" className="bill-alert">{error}</Alert>}
        <Stack spacing={2}>
          <Box>
            <Typography className="bill-field-label">Name on card</Typography>
            <TextField fullWidth size="small" value={cardholderName} onChange={e => setCardholderName(e.target.value)}
              placeholder="As it appears on the card" inputProps={{ maxLength: 120 }} autoFocus />
          </Box>
          <Box>
            <Typography className="bill-field-label">Card number</Typography>
            <Box className="bill-secure-field">
              <CardElement options={{
                style: { base: { fontSize: '16px', color: P.navy, '::placeholder': { color: P.muted } } },
                hidePostalCode: true,
              }} />
            </Box>
            <Typography className="bill-field-hint">Card number, expiry and security code are entered in a secure field from our payment provider.</Typography>
          </Box>
          <Box>
            <Typography className="bill-field-label">Billing postcode</Typography>
            <TextField fullWidth size="small" value={postalCode} onChange={e => setPostalCode(e.target.value.toUpperCase())}
              placeholder="For example, B16 8PE" inputProps={{ maxLength: 12 }} />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" className="bill-button bill-button--primary" onClick={handleStripeSubmit} disabled={processing || !stripe}>
          {processing ? <CircularProgress size={18} color="inherit" /> : 'Save card'}
        </Button>
      </DialogActions>
    </>
  )
}

function AddCardModal({ open, onClose, onAdded, stripeAvailable }: { open: boolean; onClose: () => void; onAdded: () => void; stripeAvailable: boolean }) {
  const [cardholderName, setCardholderName] = useState('')
  const [postalCode, setPostalCode] = useState('')
  return (
    <Dialog className="bill-dialog" open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <FigDialogHeader
        eyebrow="BILLING"
        title="Add a card"
        subtitle="Payments are handled securely by our payment provider. We never see your full card number."
        onClose={onClose}
      />
      {stripeAvailable
        ? <StripeCardForm
            cardholderName={cardholderName}
            setCardholderName={setCardholderName}
            postalCode={postalCode}
            setPostalCode={setPostalCode}
            onSuccess={onAdded}
            onCancel={onClose}
          />
        : <>
            <DialogContent sx={{ pt: 1.5 }}>
              <Alert severity="error">Secure card collection is unavailable. Configure Stripe Elements before adding a payment method.</Alert>
            </DialogContent>
            <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
          </>}
    </Dialog>
  )
}

function MetricCard({ label, value, detail, icon, tone }: { label: string; value: string; detail?: string; icon: React.ReactNode; tone?: 'ok' }) {
  return (
    <Box className="bill-metric">
      <Box className="bill-metric__top">
        <Typography className="bill-metric__label">{label}</Typography>
        <Box className={`bill-metric__icon${tone === 'ok' ? ' bill-metric__icon--ok' : ''}`}>{icon}</Box>
      </Box>
      <Typography className="bill-metric__value">{value}</Typography>
      {detail && <Typography className="bill-metric__detail">{detail}</Typography>}
    </Box>
  )
}

function PaymentMethodsCard({ paymentMethods, onAdd, onSetDefault, onRemove }: any) {
  return (
    <SectionCard
      title="Payment method"
      actions={<Button className="bill-button bill-button--quiet" variant="outlined" startIcon={<AddIcon />} onClick={onAdd}>{paymentMethods.length ? 'Change card' : 'Add card'}</Button>}
    >
      {paymentMethods.length === 0 ? (
        <Box className="bill-empty">
          <Box className="bill-empty__icon"><CreditCardIcon /></Box>
          <Typography className="bill-empty__title">No payment method on file</Typography>
          <Typography className="bill-empty__copy">Add a card so your plan keeps running without a break.</Typography>
        </Box>
      ) : paymentMethods.map((pm: any) => (
        <Box className="bill-row" key={pm.id}>
          <Box className="bill-row__icon"><CreditCardIcon fontSize="small" /></Box>
          <Box className="bill-row__body">
            <Typography className="bill-row__title">{brandLabel(pm.card_brand)} ending {pm.card_last_four || '****'}</Typography>
            <Typography className="bill-row__copy">
              Expires {String(pm.expiry_month || '').padStart(2, '0')} / {pm.expiry_year}
              {pm.cardholder_name ? ` · ${pm.cardholder_name}` : ''}
            </Typography>
          </Box>
          <Box className="bill-row__actions">
            {pm.is_default && <Chip className="bill-chip" size="small" label="Default" />}
            {!pm.is_default && <Button size="small" className="bill-plan__action" onClick={() => onSetDefault(pm.id)}>Make default</Button>}
            <Button size="small" color="error" onClick={() => onRemove(pm.id)}>Remove</Button>
          </Box>
        </Box>
      ))}
    </SectionCard>
  )
}

function PlansCard({ currentPlan, isActive, updating, onSwitch }: any) {
  return (
    <SectionCard title="Plans" copy="Change at any time. Prices exclude VAT.">
      <Box className="bill-plans">
        {PLANS.map(plan => {
          const current = currentPlan === plan.id
          return (
            <Box className={`bill-plan${current && isActive ? ' bill-plan--current' : ''}`} key={plan.id}>
              <Box className="bill-plan__top">
                <Box className="bill-plan__icon">{plan.id === Plan.PROFESSIONAL ? <PlanIcon fontSize="small" /> : <StarterIcon fontSize="small" />}</Box>
                {current && isActive && <Chip className="bill-chip" size="small" label="Your plan" />}
              </Box>
              <Typography className="bill-plan__name">{plan.name} · £{plan.price} a month</Typography>
              <Typography className="bill-plan__desc">{plan.description}</Typography>
              {!(current && isActive) && (
                <Button className="bill-plan__action" disabled={updating} onClick={() => onSwitch(plan.id)}>
                  {!isActive ? 'Switch and renew' : `Switch to ${plan.name}`} →
                </Button>
              )}
            </Box>
          )
        })}
      </Box>
    </SectionCard>
  )
}

function AddonsCard({ addons, isOrgAdmin, isActive, addonBusy, onPurchase, onCancelAddon }: any) {
  return (
    <SectionCard title="Add-ons" copy="Optional extras, billed monthly together with your plan from the next billing date.">
      {!addons ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : addons.catalog.length === 0 ? (
        <Box className="bill-empty">
          <Box className="bill-empty__icon"><AddIcon /></Box>
          <Typography className="bill-empty__title">No add-ons available</Typography>
          <Typography className="bill-empty__copy">Optional extras will appear here.</Typography>
        </Box>
      ) : addons.catalog.map((addon: any) => {
        const active = addons.active.includes(addon.slug)
        const busy = addonBusy === addon.slug
        return (
          <Box className="bill-row bill-row--stacked" key={addon.slug}>
            <Box className="bill-row__body">
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography className="bill-row__title">{addon.name}</Typography>
                {active && <Chip className="bill-chip" size="small" label="Active" />}
              </Stack>
              <Typography className="bill-row__copy">{addon.description}</Typography>
              <Typography className="bill-row__copy" sx={{ color: 'var(--bill-accent) !important', fontWeight: 600 }}>{addon.amountDisplay}</Typography>
            </Box>
            {isOrgAdmin && (
              <Box className="bill-row__actions">
                {active ? (
                  <Button size="small" variant="outlined" color="error" disabled={busy} onClick={() => onCancelAddon(addon.slug)}>
                    {busy ? <CircularProgress size={16} /> : 'Cancel'}
                  </Button>
                ) : (
                  <Button size="small" variant="contained" className="bill-button bill-button--primary" disabled={busy || !isActive} onClick={() => onPurchase(addon.slug)}>
                    {busy ? <CircularProgress size={16} color="inherit" /> : 'Purchase'}
                  </Button>
                )}
              </Box>
            )}
          </Box>
        )
      })}
      {!isActive && addons?.catalog.length > 0 && (
        <Typography className="bill-note">Add-ons need an active plan subscription — renew your plan first.</Typography>
      )}
    </SectionCard>
  )
}

function InvoicesCard({ invoices, downloadingId, onDownload }: any) {
  return (
    <SectionCard title="Invoices" copy={invoices.length ? 'Download for your accounts' : undefined}>
      {invoices.length === 0 ? (
        <Box className="bill-empty">
          <Box className="bill-empty__icon"><DownloadIcon /></Box>
          <Typography className="bill-empty__title">No invoices yet</Typography>
          <Typography className="bill-empty__copy">Your invoices will appear here each month, ready to download for your accounts.</Typography>
        </Box>
      ) : (
        <TableContainer className="bill-table-wrap">
          <Table className="bill-table" size="small" aria-label="Invoices">
            <TableHead>
              <TableRow>{['Date', 'Invoice', 'Amount', ''].map((label, index) => <TableCell key={label || index}>{label}</TableCell>)}</TableRow>
            </TableHead>
            <TableBody>
              {invoices.map((inv: any) => (
                <TableRow key={inv.id} hover>
                  <TableCell>{formatDate(inv.issued_at) || '—'}</TableCell>
                  <TableCell>
                    <Typography className="bill-table__strong">{inv.invoice_number}</Typography>
                    <Typography className="bill-row__copy">{inv.description}</Typography>
                  </TableCell>
                  <TableCell className="bill-table__amount">£{parseFloat(inv.amount).toFixed(2)}</TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="outlined" className="bill-button bill-button--quiet" disabled={downloadingId === inv.id} onClick={() => onDownload(inv)}>
                      {downloadingId === inv.id ? <CircularProgress size={16} /> : 'Download'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </SectionCard>
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
  const [addons, setAddons] = useState<{ catalog: { slug: string; name: string; description: string; amountDisplay: string }[]; active: string[] } | null>(null)
  const [addonBusy, setAddonBusy] = useState<string | null>(null)
  const [addonConfirm, setAddonConfirm] = useState<string | null>(null)
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
    try {
      const addonRes = await api.get('/billing/addons')
      setAddons(addonRes.data)
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
    } catch { setMessage('Failed to update the default card.') }
  }

  const handleRemoveCard = async (id: string) => {
    try {
      await api.delete(`/billing/payment-methods/${id}`)
      loadBillingData()
      setMessage('Card removed.')
    } catch (err: any) { setMessage(err.response?.data?.message || 'Failed to remove card.') }
    setRemoveCardDialog('')
  }

  const handleAddonPurchase = async () => {
    const slug = addonConfirm
    if (!slug) return
    setAddonBusy(slug); setAddonConfirm(null)
    try {
      const { data } = await api.post('/billing/addons/purchase', { addon: slug })
      setMessage(data?.message || 'Add-on added.')
      await loadBillingData()
      window.dispatchEvent(new Event('subscriptionUpdated'))
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'Could not add the add-on.')
    } finally { setAddonBusy(null) }
  }

  const handleAddonCancel = async (slug: string) => {
    setAddonBusy(slug)
    try {
      const { data } = await api.post('/billing/addons/cancel', { addon: slug })
      setMessage(data?.message || 'Add-on cancelled.')
      await loadBillingData()
      window.dispatchEvent(new Event('subscriptionUpdated'))
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'Could not cancel the add-on.')
    } finally { setAddonBusy(null) }
  }

  const handleUpgradeClick = (planId: string) => { setSelectedPlan(planId); setConfirmOpen(true) }
  const handleConfirmUpgrade = async () => {
    if (!selectedPlan) return
    setUpdating(true); setConfirmOpen(false)
    try {
      const { data } = await api.patch('/billing/subscription', { plan: selectedPlan })
      setMessage(data?.message || `Plan updated to ${planName(selectedPlan)}.`)
      loadBillingData()
      window.dispatchEvent(new Event('subscriptionUpdated'))
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to update plan.'
      setMessage(msg)
    } finally { setUpdating(false); setSelectedPlan(null) }
  }

  if (loading) return <Box className="bill-page" sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>

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
  if (subStatus === 'active') statusLabel = 'Active'
  else if (isTrialActive) statusLabel = 'Trial'
  else if (subStatus === 'trial') statusLabel = 'Trial ended'
  else statusLabel = subStatus ? subStatus.charAt(0).toUpperCase() + subStatus.slice(1) : 'Inactive'

  const hasCard = paymentMethods.length > 0
  const nextPaymentDate = formatDate(subscription?.currentPeriodEnd || subscription?.trialEndsAt)
  const currentPlanLabel = isDomiciliary ? 'Sales-led agreement' : planName(subscription?.plan)
  const currentPlanDetail = isDomiciliary
    ? (subscription?.domiciliaryActiveMonthlyPricePence ?? subscription?.domiciliaryMonthlyPricePence)
      ? `£${(((subscription?.domiciliaryActiveMonthlyPricePence ?? subscription?.domiciliaryMonthlyPricePence) || 0) / 100).toFixed(2)} a month`
      : 'Agreed with our team'
    : planPrice(subscription?.plan)
  const statusDetail = isTrialActive ? `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} left`
    : subStatus === 'past_due' ? 'Payment needs attention'
    : !isActive ? 'Access is limited until renewed'
    : undefined
  const nextPaymentDetail = !hasCard && !isDomiciliary
    ? 'Add a card to set this'
    : !isActive
      ? 'Renew to restart billing'
      : isDomiciliary
        ? 'Agreed monthly subscription'
        : `${planPrice(subscription?.plan) || 'Plan price'}, excluding VAT`

  return (
    <Box className="bill-page">
      <Typography className="bill-crumbs">Billing</Typography>

      <header className="bill-header">
        <Typography component="h1" className="bill-header__title">Billing</Typography>
        <Typography className="bill-header__copy">Your plan, payment method and invoices.</Typography>
      </header>

      {subscription?.stripeUnavailable && (
        <Alert severity="error" className="bill-alert">
          <Typography variant="subtitle2" fontWeight={600}>Stripe billing is not configured on the server</Typography>
          <Typography variant="body2">Payment cards, subscriptions and invoices are unavailable until the administrator adds a valid live Stripe key and webhook secret. Please contact your system administrator.</Typography>
        </Alert>
      )}

      {message && (
        <Alert severity={/\b(failed|error|could not)\b/i.test(message) ? 'error' : 'success'} className="bill-alert" onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}

      {isRedirectedFromBlock && (
        <Alert severity="warning" className="bill-alert">
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>Welcome back</Typography>
          <Typography variant="body2">
            {subMessage || 'Your subscription needs attention. Please update your billing information below to restore access.'}
          </Typography>
        </Alert>
      )}

      {isOrgAdmin && !isDomiciliary && !hasCard && (
        <Box className="bill-banner" role="status">
          <Box className="bill-banner__icon"><CreditCardIcon /></Box>
          <Box className="bill-banner__body">
            <Typography className="bill-banner__title">No payment method on file</Typography>
            <Typography className="bill-banner__copy">Add a card so your {currentPlanLabel === '—' ? 'Meticle Care' : currentPlanLabel} plan keeps running without a break.</Typography>
          </Box>
          <Box className="bill-banner__actions">
            <Button className="bill-button bill-button--primary" variant="contained" onClick={() => setAddCardOpen(true)}>Add card</Button>
          </Box>
        </Box>
      )}

      {!isActive && !isDomiciliary && (
        <Box className="bill-banner" role="status">
          <Box className="bill-banner__icon"><WarningIcon /></Box>
          <Box className="bill-banner__body">
            <Typography className="bill-banner__title">
              {subStatus === 'canceled' ? 'Your subscription has been canceled' : subStatus === 'trial' ? 'Your trial has ended' : 'Your subscription has ended'}
            </Typography>
            <Typography className="bill-banner__copy">
              {subStatus === 'past_due' || subscription?.hasUnpaidInvoice
                ? 'There is an unpaid invoice. Update your payment method and retry to restore access.'
                : 'Add a payment card and switch your plan to restore full access to Meticle Care.'}
            </Typography>
            {subscription?.hasUnpaidInvoice && (
              <Typography className="bill-banner__copy">Unpaid invoice: {invoices.find(i => i.status === 'open')?.description || 'subscription invoice'}</Typography>
            )}
          </Box>
          <Box className="bill-banner__actions">
            {(subStatus === 'past_due' || subscription?.hasUnpaidInvoice) && (
              <Button
                variant="contained"
                color="error"
                className="bill-button"
                disabled={retrying}
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
                {retrying ? <CircularProgress size={18} color="inherit" /> : 'Retry payment'}
              </Button>
            )}
            <Button className="bill-button bill-button--primary" variant="contained" disabled={updating} onClick={() => handleUpgradeClick(subscription?.plan || 'starter')}>
              {updating ? <CircularProgress size={18} color="inherit" /> : (subStatus === 'canceled' ? 'Renew subscription' : subStatus === 'trial' ? 'Subscribe now' : 'Renew now')}
            </Button>
          </Box>
        </Box>
      )}

      {isTrialActive && (
        <Alert severity="info" className="bill-alert">
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>Trial limitations</Typography>
          <Typography variant="body2">
            Your trial is limited to <strong>10 staff members</strong>. You currently have access to all features including AI insights, compliance tracking, and the rota planner. Upgrade anytime to remove the limit and continue after your trial expires.
          </Typography>
        </Alert>
      )}

      <section className="bill-metrics" aria-label="Subscription summary">
        <MetricCard label="Current plan" value={currentPlanLabel} detail={currentPlanDetail || undefined} icon={<PlanIcon fontSize="small" />} />
        <MetricCard label="Status" value={statusLabel} detail={statusDetail} icon={<CheckIcon fontSize="small" />} tone={isActive ? 'ok' : undefined} />
        <MetricCard
          label="Next payment"
          value={isActive && nextPaymentDate ? nextPaymentDate : '—'}
          detail={isActive ? nextPaymentDetail : 'Renew to restart billing'}
          icon={<CalendarIcon fontSize="small" />}
        />
      </section>

      {isDomiciliary && (
        <>
          <SectionCard
            title="Domiciliary subscription"
            copy="Pricing is agreed with our team for your organisation. Your care-package billing profiles are separate and do not affect this platform subscription."
          >
            {subscription?.domiciliaryMonthlyPricePence ? (
              <>
                <Box className="bill-quote">
                  <Typography className="bill-quote__price">
                    Quote: £{(subscription.domiciliaryMonthlyPricePence / 100).toFixed(2)} / month
                    <Typography component="span" className="bill-row__copy" sx={{ ml: 1 }}>
                      {subscription.domiciliaryPriceVatBehavior === 'inclusive' ? 'VAT included' : 'VAT added where applicable'}
                    </Typography>
                  </Typography>
                  {subscription.domiciliaryActiveMonthlyPricePence != null && (
                    <Typography className="bill-row__copy">Currently billed: £{(subscription.domiciliaryActiveMonthlyPricePence / 100).toFixed(2)} / month</Typography>
                  )}
                  <Typography className="bill-row__copy">
                    {subscription.domiciliaryQuoteAcceptedAt && subscription.domiciliaryStripeSubscriptionId && subscription.subscriptionStatus !== 'canceled'
                      ? `Agreed and active${subscription.currentPeriodEnd ? ` · next billing date ${new Date(subscription.currentPeriodEnd).toLocaleDateString('en-GB')}` : ''}`
                      : 'Draft quote for review. It will not be charged until an organisation admin accepts it.'}
                  </Typography>
                </Box>
              </>
            ) : (
              <Box sx={{ px: 3, pb: 3 }}><Alert severity="info">No monthly subscription quote is on file yet. Contact the MeticleCare team to agree your price.</Alert></Box>
            )}
            {subscription?.domiciliaryStripeSubscriptionId && subscription?.subscriptionStatus === 'canceled' && (
              <Box sx={{ px: 3, pb: 3 }}><Alert severity="warning">The previous domiciliary subscription has been cancelled. Your current quote remains available for review and activation.</Alert></Box>
            )}
            {isOrgAdmin && subscription?.domiciliaryMonthlyPricePence && (
              <>
                <Box sx={{ px: 3, pt: 1 }}><Typography variant="subtitle2" fontWeight={600}>UK billing address for VAT invoices</Typography></Box>
                <Box className="bill-fields" sx={{ pt: 1.5 }}>
                  <TextField fullWidth size="small" label="Address line 1" value={billingAddress.line1} onChange={e => setBillingAddress({ ...billingAddress, line1: e.target.value })} />
                  <TextField fullWidth size="small" label="Address line 2 (optional)" value={billingAddress.line2 || ''} onChange={e => setBillingAddress({ ...billingAddress, line2: e.target.value })} />
                  <TextField fullWidth size="small" label="Town / city" value={billingAddress.city} onChange={e => setBillingAddress({ ...billingAddress, city: e.target.value })} />
                  <TextField fullWidth size="small" label="Postcode" value={billingAddress.postal_code} onChange={e => setBillingAddress({ ...billingAddress, postal_code: e.target.value })} />
                  <TextField fullWidth size="small" label="Country" value="United Kingdom" disabled />
                </Box>
                <Box className="bill-note" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
                  <Button variant="outlined" className="bill-button bill-button--quiet" onClick={saveDomiciliaryAddress} disabled={savingAddress || !billingAddress.line1 || !billingAddress.city || !billingAddress.postal_code}>
                    {savingAddress ? <CircularProgress size={18} /> : 'Save billing address'}
                  </Button>
                  {!paymentMethods.length && <Button variant="outlined" className="bill-button bill-button--quiet" onClick={() => setAddCardOpen(true)}>Add payment card</Button>}
                  {!!paymentMethods.length && !subscription?.domiciliaryBillingAddress?.line1 && (
                    <Typography className="bill-row__copy">Save the address before accepting the quote.</Typography>
                  )}
                  {!(subscription?.domiciliaryQuoteAcceptedAt && subscription?.domiciliaryStripeSubscriptionId && subscription?.subscriptionStatus !== 'canceled') && (
                    <Button variant="contained" className="bill-button bill-button--primary" onClick={acceptDomiciliaryQuote}
                      disabled={acceptingQuote || !paymentMethods.length || !subscription?.domiciliaryBillingAddress?.line1 || !subscription?.domiciliaryBillingAddress?.city || !subscription?.domiciliaryBillingAddress?.postal_code}>
                      {acceptingQuote ? <CircularProgress size={18} color="inherit" /> : 'Accept quote & activate subscription'}
                    </Button>
                  )}
                </Box>
              </>
            )}
          </SectionCard>

          {isOrgAdmin && billingConfig?.domiciliary && (
            <SectionCard
              title="VAT & travel settings"
              copy="Client charges come from each package’s billing profile. These settings control invoice VAT and paid travel policy; they do not change your MeticleCare subscription."
              actions={(
                <Button variant="contained" className="bill-button bill-button--primary" onClick={saveBillingConfig} disabled={savingBillingConfig}>
                  {savingBillingConfig ? <CircularProgress size={18} color="inherit" /> : 'Save settings'}
                </Button>
              )}
            >
              <Box className="bill-fields" sx={{ py: 2 }}>
                <TextField fullWidth size="small" type="number" label="VAT rate (%)" inputProps={{ min: 0, max: 100, step: 0.1 }}
                  value={billingConfig.domiciliary.vat_rate ?? 20}
                  onChange={(e) => updateDomiciliaryConfig('vat_rate', Math.min(100, Math.max(0, Number(e.target.value || 0))))} />
                <FormControlLabel sx={{ ml: 0 }} control={<Switch checked={!!billingConfig.domiciliary.vat_inclusive} onChange={(e) => updateDomiciliaryConfig('vat_inclusive', e.target.checked)} />}
                  label={billingConfig.domiciliary.vat_inclusive ? 'Rates include VAT' : 'Rates exclude VAT'} />
                <FormControlLabel sx={{ ml: 0 }} control={<Switch checked={billingConfig.domiciliary.travel_time_paid ?? billingConfig.domiciliary.travel_pay_included ?? true} onChange={(e) => updateDomiciliaryConfig('travel_time_paid', e.target.checked)} />}
                  label="Pay carers for travel time" />
                <FormControlLabel sx={{ ml: 0 }} control={<Switch checked={billingConfig.domiciliary.pay_inter_client_travel ?? true} onChange={(e) => updateDomiciliaryConfig('pay_inter_client_travel', e.target.checked)} />}
                  label="Include travel between client visits" />
              </Box>
            </SectionCard>
          )}
        </>
      )}

      {isOrgAdmin && (
        <PaymentMethodsCard
          paymentMethods={paymentMethods}
          onAdd={() => setAddCardOpen(true)}
          onSetDefault={handleSetDefault}
          onRemove={setRemoveCardDialog}
        />
      )}

      {!isDomiciliary && (
        <PlansCard currentPlan={subscription?.plan} isActive={isActive} updating={updating} onSwitch={handleUpgradeClick} />
      )}

      {!isDomiciliary && (
        <AddonsCard
          addons={addons}
          isOrgAdmin={isOrgAdmin}
          isActive={isActive}
          addonBusy={addonBusy}
          onPurchase={setAddonConfirm}
          onCancelAddon={handleAddonCancel}
        />
      )}

      <InvoicesCard invoices={invoices} downloadingId={downloadingId} onDownload={handleDownloadInvoice} />

      {invoices.length === 0 && (
        <Typography className="bill-footnote">Plan, status and prices are from the live account.</Typography>
      )}

      {isOrgAdmin && <AddCardModal open={addCardOpen} onClose={() => setAddCardOpen(false)} onAdded={handleCardAdded} stripeAvailable={!!stripePromise} />}

      <Dialog className="bill-dialog" open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
        {selectedPlan && (() => {
          const target = planDef(selectedPlan)
          const current = planDef(subscription?.plan)
          const raisingPrice = Number(target?.price || 0) > Number(current?.price || 0)
          const lost = current ? current.features.filter(feature => !feature.startsWith('Everything in') && !(target?.features || []).includes(feature)) : []
          const gained = (target?.features || []).filter(feature => !feature.startsWith('Everything in'))
          const changeDate = formatDate(subscription?.currentPeriodEnd)
          return (
            <>
              <FigDialogHeader
                eyebrow="BILLING"
                title={`Switch to ${target?.name || 'this plan'}?`}
                subtitle={target ? `£${target.price} a month from your next billing date.` : undefined}
                onClose={() => setConfirmOpen(false)}
              />
              <DialogContent sx={{ pt: 1.5 }}>
                {isActive && lost.length > 0 ? (
                  <Box className="bill-band">
                    <Box className="bill-band__icon"><WarningIcon fontSize="small" /></Box>
                    <Box>
                      <Typography className="bill-band__title">You’ll lose some features</Typography>
                      <Typography className="bill-band__copy">{lost.join(', ')}. Your data stays safe.</Typography>
                    </Box>
                  </Box>
                ) : raisingPrice ? (
                  <Box className="bill-band">
                    <Box className="bill-band__icon"><CheckIcon fontSize="small" /></Box>
                    <Box>
                      <Typography className="bill-band__title">You’ll get more</Typography>
                      <Typography className="bill-band__copy">{gained.join(', ')}.</Typography>
                    </Box>
                  </Box>
                ) : null}
                <Typography className="bill-dialog__note">
                  {isActive
                    ? `The change starts on ${changeDate || 'your next billing date'}. You can switch back at any time.`
                    : 'Switching and renewing restores full access immediately.'}
                </Typography>
                {!isActive && paymentMethods.length === 0 && (
                  <Alert severity="warning" sx={{ mt: 2 }}>No payment card on file. Please add a card before renewing.</Alert>
                )}
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
                <Button variant="contained" className="bill-button bill-button--primary" onClick={handleConfirmUpgrade} disabled={updating || (!isActive && paymentMethods.length === 0)}>
                  {updating ? <CircularProgress size={18} color="inherit" /> : 'Switch plan'}
                </Button>
              </DialogActions>
            </>
          )
        })()}
      </Dialog>

      <Dialog className="bill-dialog" open={!!removeCardDialog} onClose={() => setRemoveCardDialog('')} maxWidth="xs" fullWidth>
        <FigDialogHeader eyebrow="BILLING" title="Remove this card?" subtitle="Your plan will keep running until its next payment." onClose={() => setRemoveCardDialog('')} />
        <DialogContent sx={{ pt: 1.5 }}>
          <Typography className="bill-dialog__note">If this is the only card on file, add another before the next billing date so the subscription does not lapse.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveCardDialog('')}>Cancel</Button>
          <Button onClick={() => handleRemoveCard(removeCardDialog)} variant="contained" color="error">Remove</Button>
        </DialogActions>
      </Dialog>

      <Dialog className="bill-dialog" open={!!addonConfirm} onClose={() => setAddonConfirm(null)} maxWidth="xs" fullWidth>
        <FigDialogHeader
          eyebrow="BILLING"
          title={`Add ${addons?.catalog.find(a => a.slug === addonConfirm)?.name || 'this add-on'}?`}
          onClose={() => setAddonConfirm(null)}
        />
        <DialogContent sx={{ pt: 1.5 }}>
          <Typography className="bill-dialog__note">
            Add this to your subscription for {addons?.catalog.find(a => a.slug === addonConfirm)?.amountDisplay}?
            It is billed together with your plan from the next billing date.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddonConfirm(null)}>Cancel</Button>
          <Button onClick={handleAddonPurchase} variant="contained" className="bill-button bill-button--primary" disabled={!!addonBusy}>
            {addonBusy ? <CircularProgress size={18} color="inherit" /> : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default function BillingPage() {
  if (!stripePromise) return <BillingPageInner />
  return <Elements stripe={stripePromise}><BillingPageInner /></Elements>
}
