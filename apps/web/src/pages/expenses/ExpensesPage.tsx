import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  Divider, MenuItem, Paper, Snackbar, Stack, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material'
import {
  AccountBalanceWallet as AccountsIcon, Add as AddIcon, Block as VoidIcon,
  CheckCircle as CheckCircleIcon, CloudUpload as UploadIcon, Download as DownloadIcon,
  Edit as EditIcon, HomeWork as HomeWorkIcon, Insights as LedgerIcon, OpenInNew as OpenInNewIcon,
  People as PeopleIcon, Wallet as WalletIcon, WarningAmber as WarningIcon,
} from '@mui/icons-material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { EmptyRow } from '../../components/ui'
import { localToday } from '../../utils/dateFormat'
import FigDialogHeader, { PillOptions } from '../people/dialogHeader'
import './expenses.css'

const CATEGORIES = [
  { value: 'food', label: 'Food' }, { value: 'clothing', label: 'Clothing' },
  { value: 'activities', label: 'Activities' }, { value: 'transport', label: 'Transport' },
  { value: 'personal', label: 'Personal' }, { value: 'health', label: 'Health' },
  { value: 'other', label: 'Other' },
]
const SOURCE_LABELS: Record<string, string> = { house: 'House funds', person: 'Person funds' }
const CASH_SOURCE_OPTIONS = [
  { value: 'bank_withdrawal', label: 'Bank withdrawal' },
  { value: 'cash_float', label: 'Cash float' },
  { value: 'transfer', label: 'Transfer from another tin' },
  { value: 'other', label: 'Other' },
]
const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' }, { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank transfer' }, { value: 'direct_debit', label: 'Direct debit' },
]
const MANAGE_ROLES = ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER']
const VIEW_ROLES = [...MANAGE_ROLES, 'CARE_WORKER']
const PAGE_SIZE = 8
const RECEIPT_LIMIT_BYTES = 10 * 1024 * 1024

type TabKey = 'ledger' | 'petty' | 'checks'

function asArray(value: any, keys: string[] = []): any[] {
  if (Array.isArray(value)) return value
  for (const key of keys) if (Array.isArray(value?.[key])) return value[key]
  return Array.isArray(value?.data) ? value.data : []
}
// The day a cash entry is filed under, and the day in the report's filename:
// both are the operator's own day, not its UTC equivalent.
function today() { return localToday() }
function money(pence: number | string | null | undefined) { return `£${(Number(pence || 0) / 100).toFixed(2)}` }
function personName(person: any) { return `${person?.first_name || ''} ${person?.last_name || ''}`.trim() || person?.email || 'Unnamed staff member' }
function initials(name: string) { return name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || '?' }
function csvCell(value: any) { return `"${String(value ?? '').replace(/"/g, '""')}"` }
// `YYYY-MM-DD` is a calendar day, not an instant: parsing it as UTC midnight
// would show the day before for anyone west of Greenwich.
function parseDay(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}
function dayLabel(iso: string | null | undefined) {
  const date = parseDay(iso)
  return date ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'
}
function longDay(iso: string | null | undefined) {
  const date = parseDay(iso)
  return date ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}
function relativeDay(iso: string | null | undefined) {
  const date = parseDay(iso)
  if (!date) return '—'
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diff = Math.round((startOfToday.getTime() - date.getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return dayLabel(iso)
}
function categoryLabel(value: string) { return CATEGORIES.find(c => c.value === value)?.label || value || 'Uncategorised' }
function errorText(mutation: any) {
  const response = mutation?.error?.response
  return response?.data?.error || response?.data?.message || ''
}
function accountLabel(check: any) {
  if (!check) return ''
  return check.money_source === 'house' ? check.location_name || 'House tin' : check.person_name || 'Personal money'
}

function StatusChip({ label, tone }: { label: string; tone: 'ok' | 'due' | 'bad' | 'neutral' }) {
  return <Chip size="small" label={label} className={`expenses-chip expenses-chip--${tone}`} />
}

export default function ExpensesPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<TabKey>('ledger')
  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [voidId, setVoidId] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [reconcileOpen, setReconcileOpen] = useState(false)
  const [cashCheckOpen, setCashCheckOpen] = useState(false)
  const [signCheck, setSignCheck] = useState<any | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [ledgerPage, setLedgerPage] = useState(0)
  const [reportLoading, setReportLoading] = useState(false)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })
  const [filterSource, setFilterSource] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterPerson, setFilterPerson] = useState('')

  const currentUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} }
  }, [])
  const currentUserId = currentUser.id || currentUser.userId || ''
  const canManage = MANAGE_ROLES.includes(currentUser.role)
  const canView = VIEW_ROLES.includes(currentUser.role)

  const { data: expenseData, isLoading: expensesLoading, isError: expensesError } = useQuery({
    queryKey: ['expenses', filterSource, filterCategory, filterPerson],
    queryFn: () => api.get('/expenses', { params: { moneySource: filterSource || undefined, category: filterCategory || undefined, personId: filterPerson || undefined } }).then(r => r.data),
    enabled: canView,
  })
  const expenses = asArray(expenseData)
  const { data: stats } = useQuery({ queryKey: ['expense-stats'], queryFn: () => api.get('/expenses/stats').then(r => r.data), enabled: canManage })
  const { data: peopleData } = useQuery({ queryKey: ['people-expenses'], queryFn: () => api.get('/people?limit=200').then(r => r.data), enabled: canView })
  const people = asArray(peopleData, ['people'])
  const { data: balancesData } = useQuery({ queryKey: ['petty-cash-balances'], queryFn: () => api.get('/expenses/petty-cash/balances').then(r => r.data), enabled: canManage })
  const balances = asArray(balancesData, ['balances'])
  const { data: transactionData } = useQuery({ queryKey: ['petty-cash-transactions'], queryFn: () => api.get('/expenses/petty-cash/transactions').then(r => r.data), enabled: canManage })
  const transactions = asArray(transactionData, ['transactions'])
  const { data: cashCheckData } = useQuery({ queryKey: ['cash-balance-checks'], queryFn: () => api.get('/expenses/petty-cash/daily-checks').then(r => r.data), enabled: canView })
  const cashChecks = asArray(cashCheckData, ['checks'])
  const { data: reconciliationData } = useQuery({ queryKey: ['cash-reconciliation-requests'], queryFn: () => api.get('/expenses/petty-cash/reconciliations').then(r => r.data), enabled: canView })
  const reconciliations = asArray(reconciliationData, ['requests', 'reconciliations'])
  const { data: locationsData } = useQuery({ queryKey: ['locations'], queryFn: () => api.get('/settings/locations').then(r => r.data), enabled: canManage })
  const locations = asArray(locationsData, ['locations'])
  const { data: staffData } = useQuery({ queryKey: ['expenses-org-members'], queryFn: () => api.get('/staff/org-members').then(r => r.data), enabled: canView })
  const staffMembers = useMemo(() => {
    const all = [...asArray(staffData, ['admins']), ...asArray(staffData, ['staff'])]
    return all.filter((member: any) => member.status === 'active')
  }, [staffData])

  const showError = (message: string) => setSnackbar({ open: true, message, severity: 'error' })
  const showSuccess = (message: string) => setSnackbar({ open: true, message, severity: 'success' })

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/expenses', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['expense-stats'] }); setCreateOpen(false); showSuccess('Expense saved') },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => api.patch(`/expenses/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['expense-stats'] }); setEditId(null); showSuccess('Entry updated') },
  })
  const voidMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.put(`/expenses/${id}/void`, { reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['expense-stats'] }); setVoidId(null); setVoidReason(''); showSuccess('Entry voided') },
  })
  const topUpMutation = useMutation({
    mutationFn: (data: any) => api.post('/expenses/petty-cash/top-up', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['petty-cash-balances'] }); qc.invalidateQueries({ queryKey: ['petty-cash-transactions'] }); setTopUpOpen(false); showSuccess('Cash topped up') },
  })
  const reconcileMutation = useMutation({
    mutationFn: (data: any) => api.post('/expenses/petty-cash/reconcile', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash-reconciliation-requests'] }); setReconcileOpen(false); showSuccess('Reconciliation submitted for review') },
  })
  const reviewReconciliationMutation = useMutation({
    mutationFn: ({ id, decision, reason }: { id: string; decision: 'accepted' | 'rejected'; reason?: string }) => api.post(`/expenses/petty-cash/reconciliations/${id}/review`, { decision, rejectionReason: reason }),
    onMutate: ({ id, decision }) => { setReviewingId(id); if (decision === 'rejected') setRejectingId(null) },
    onSettled: () => setReviewingId(null),
    onSuccess: (_, variables) => { qc.invalidateQueries({ queryKey: ['cash-reconciliation-requests'] }); qc.invalidateQueries({ queryKey: ['petty-cash-balances'] }); qc.invalidateQueries({ queryKey: ['petty-cash-transactions'] }); setRejectionReason(''); showSuccess(variables.decision === 'accepted' ? 'Reconciliation accepted and balance updated' : 'Reconciliation rejected') },
    onError: (e: any) => showError(e.response?.data?.error || 'Could not review reconciliation'),
  })
  const dailyCheckMutation = useMutation({
    mutationFn: (data: any) => api.post('/expenses/petty-cash/daily-check', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash-balance-checks'] }); setCashCheckOpen(false); showSuccess('Cash check recorded and handed over') },
  })
  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.post(`/expenses/petty-cash/daily-checks/${id}/accept`),
    onMutate: (id: string) => setAcceptingId(id),
    onSettled: () => setAcceptingId(null),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash-balance-checks'] }); setSignCheck(null); showSuccess('Cash count signed') },
    onError: (e: any) => showError(e.response?.data?.error || 'Could not sign this cash check'),
  })

  const totals = useMemo(() => {
    const house = balances.filter((b: any) => b.money_source === 'house').reduce((sum: number, b: any) => sum + Number(b.current_balance_pence || 0), 0)
    const person = balances.filter((b: any) => b.money_source === 'person').reduce((sum: number, b: any) => sum + Number(b.current_balance_pence || 0), 0)
    const ledger = stats?.total_amount_pounds != null
      ? money(Math.round(Number(stats.total_amount_pounds) * 100))
      : money(expenses.reduce((sum: number, e: any) => sum + Number(e.amount_pence || 0), 0))
    const entryCount = stats?.total_expenses ?? expenses.length
    const personAccounts = balances.filter((b: any) => b.money_source === 'person').length
    return { house, person, ledger, entryCount, accounts: balances.length, personAccounts }
  }, [balances, expenses, stats])

  const pendingChecks = useMemo(() => cashChecks.filter((c: any) => !c.accepted_at), [cashChecks])
  const myPendingChecks = useMemo(() => pendingChecks.filter((c: any) => c.handed_over_to === currentUserId), [pendingChecks, currentUserId])
  const latestCheckFor = (balance: any) => cashChecks.find((c: any) =>
    c.money_source === balance.money_source &&
    (balance.money_source === 'house' ? c.location_id === balance.location_id : c.person_id === balance.person_id)
  )

  const detailExpense = expenses.find((e: any) => e.id === detailId) || null
  const editExpense = expenses.find((e: any) => e.id === editId) || null

  useEffect(() => { setLedgerPage(0) }, [filterSource, filterCategory, filterPerson])
  useEffect(() => { if (!canManage && tab === 'petty') setTab('ledger') }, [canManage, tab])

  const metrics = useMemo(() => {
    const cards = [
      {
        key: 'ledger', label: 'Total ledger', value: totals.ledger,
        detail: `${totals.entryCount} recorded ${totals.entryCount === 1 ? 'entry' : 'entries'}`,
        icon: <LedgerIcon fontSize="small" />,
      },
      {
        key: 'house', label: 'House funds', value: canManage ? money(totals.house) : '—',
        detail: canManage ? 'Available now' : 'Manager access required',
        icon: <HomeWorkIcon fontSize="small" />,
      },
      {
        key: 'person', label: 'Person funds', value: canManage ? money(totals.person) : '—',
        detail: canManage ? `Across ${totals.personAccounts} ${totals.personAccounts === 1 ? 'person' : 'people'}` : 'Manager access required',
        icon: <PeopleIcon fontSize="small" />,
      },
    ]
    if (pendingChecks.length > 0) {
      cards.push({
        key: 'checks', label: 'Checks waiting', value: String(pendingChecks.length),
        detail: 'Needs a second signature', icon: <WarningIcon fontSize="small" />,
      })
    } else {
      cards.push({
        key: 'accounts', label: 'Cash accounts', value: canManage ? String(totals.accounts) : '—',
        detail: canManage ? 'Locations and people' : 'Manager access required',
        icon: <AccountsIcon fontSize="small" />,
      })
    }
    return cards
  }, [totals, canManage, pendingChecks.length])

  const downloadReport = async () => {
    setReportLoading(true)
    try {
      const response = await api.get('/expenses/report')
      const rows = (response.data.expenses || []).map((e: any) => [e.incurred_date, SOURCE_LABELS[e.money_source] || e.money_source, e.person_name || '', e.category, e.description || '', money(e.amount_pence), e.created_by_name || '', e.is_voided ? 'Yes' : 'No'])
      const csv = [['Date', 'Source', 'Person', 'Category', 'Description', 'Amount', 'Added by', 'Voided'], ...rows].map(row => row.map(csvCell).join(',')).join('\n')
      const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); link.download = `expenses-report-${today()}.csv`; link.click(); URL.revokeObjectURL(link.href)
    } catch { showError('Could not download the report') } finally { setReportLoading(false) }
  }

  if (expensesLoading) return <Box className="expenses-page"><Box className="expenses-empty" role="status" aria-live="polite"><CircularProgress /><Typography className="expenses-empty__copy">Loading the expense workspace</Typography></Box></Box>
  if (expensesError) return <Box className="expenses-page"><Alert severity="error">Expenses could not be loaded. Refresh the page or contact an administrator.</Alert></Box>

  return (
    <Box className="expenses-page">
      <Typography className="expenses-crumbs">Communication / Expenses</Typography>

      <header className="expenses-header">
        <Box className="expenses-header__copy">
          <Typography component="h1" className="expenses-header__title">Expenses</Typography>
          <Typography className="expenses-header__description">A clear record of spending, available cash, and checks that need a second person’s sign-off.</Typography>
        </Box>
        {canManage && (
          <Box className="expenses-actions">
            <Button className="expenses-button expenses-button--quiet" variant="outlined" startIcon={<WalletIcon />} onClick={() => setTopUpOpen(true)}>Top up cash</Button>
            <Button className="expenses-button expenses-button--primary" variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>Add expense</Button>
          </Box>
        )}
      </header>

      {tab === 'checks' && pendingChecks.length > 0 && (
        <CashCheckBanner
          checks={pendingChecks}
          mine={myPendingChecks}
          onSign={(check: any) => setSignCheck(check)}
        />
      )}

      <Tabs className="expenses-tabs" value={tab} onChange={(_e, value: TabKey) => setTab(value)} aria-label="Expense sections">
        <Tab value="ledger" label="Spending ledger" />
        {canManage && <Tab value="petty" label="Petty cash" />}
        <Tab value="checks" label="Daily cash checks" />
      </Tabs>

      <section className="expenses-metrics" aria-label="Expense summary">
        {metrics.map(metric => (
          <Box className="expenses-metric" key={metric.key}>
            <Box className="expenses-metric__top">
              <Typography className="expenses-metric__label">{metric.label}</Typography>
              <Box className={`expenses-metric__icon${metric.key === 'checks' ? ' expenses-metric__icon--warn' : ''}`}>{metric.icon}</Box>
            </Box>
            <Typography className="expenses-metric__value">{metric.value}</Typography>
            <Typography className="expenses-metric__detail">{metric.detail}</Typography>
          </Box>
        ))}
      </section>

      {tab === 'ledger' && (
        <LedgerSection
          expenses={expenses}
          people={people}
          page={ledgerPage}
          setPage={setLedgerPage}
          filterOpen={filterOpen}
          setFilterOpen={setFilterOpen}
          filterSource={filterSource} setFilterSource={setFilterSource}
          filterCategory={filterCategory} setFilterCategory={setFilterCategory}
          filterPerson={filterPerson} setFilterPerson={setFilterPerson}
          onOpen={(expense: any) => setDetailId(expense.id)}
          canManage={canManage}
          onAdd={() => setCreateOpen(true)}
          onTopUp={() => setTopUpOpen(true)}
        />
      )}

      {tab === 'petty' && canManage && (
        <PettyCashSection
          balances={balances}
          transactions={transactions}
          reconciliations={reconciliations}
          currentUserId={currentUserId}
          reviewingId={reviewingId}
          onReconcile={() => setReconcileOpen(true)}
          onDownload={downloadReport}
          reportLoading={reportLoading}
          onOpenCheck={(check: any) => setSignCheck(check)}
          latestCheckFor={latestCheckFor}
          onReview={(id: string, decision: 'accepted' | 'rejected') => reviewReconciliationMutation.mutate({ id, decision })}
          onReject={(id: string) => { setRejectingId(id); setRejectionReason('') }}
        />
      )}

      {tab === 'checks' && (
        <CashChecksSection
          checks={cashChecks}
          currentUserId={currentUserId}
          acceptingId={acceptingId}
          canManage={canManage}
          onOpen={(check: any) => setSignCheck(check)}
          onSign={(check: any) => acceptMutation.mutate(check.id)}
          onCreate={() => setCashCheckOpen(true)}
        />
      )}

      <Dialog className="expenses-dialog" open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <AddExpenseDialog
          people={people}
          locations={locations}
          isLoading={createMutation.isPending}
          error={errorText(createMutation)}
          onSubmit={(data: any) => createMutation.mutate(data)}
          onClose={() => setCreateOpen(false)}
        />
      </Dialog>

      <Dialog className="expenses-dialog" open={Boolean(editId)} onClose={() => setEditId(null)} maxWidth="xs" fullWidth>
        {editExpense && (
          <EditExpenseDialog
            expense={editExpense}
            isLoading={updateMutation.isPending}
            error={errorText(updateMutation)}
            onSubmit={(data: any) => updateMutation.mutate({ id: editExpense.id, data })}
            onClose={() => setEditId(null)}
          />
        )}
      </Dialog>

      <Dialog className="expenses-dialog" open={Boolean(detailId)} onClose={() => setDetailId(null)} maxWidth="xs" fullWidth>
        {detailExpense && (
          <ExpenseDetailDialog
            expense={detailExpense}
            canManage={canManage}
            onClose={() => setDetailId(null)}
            onEdit={() => { setEditId(detailExpense.id); setDetailId(null) }}
            onVoid={() => { setVoidId(detailExpense.id); setVoidReason(''); setDetailId(null) }}
          />
        )}
      </Dialog>

      <Dialog className="expenses-dialog" open={Boolean(voidId)} onClose={() => { setVoidId(null); setVoidReason('') }} maxWidth="xs" fullWidth>
        <FigDialogHeader eyebrow="EXPENSES" title="Void this entry" subtitle="It stays in the audit history but leaves the totals." onClose={() => { setVoidId(null); setVoidReason('') }} />
        <DialogContent sx={{ pt: 1.5 }}>
          {errorText(voidMutation) && <Alert severity="error" className="expenses-dialog__hint">{errorText(voidMutation)}</Alert>}
          <Alert className="expenses-dialog__hint" severity="warning">Voiding cannot be undone. The original amounts and dates remain visible in the audit trail.</Alert>
          <TextField label="Why is this being voided?" fullWidth multiline rows={3} value={voidReason} onChange={e => setVoidReason(e.target.value)} autoFocus />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setVoidId(null); setVoidReason('') }}>Cancel</Button>
          <Button variant="contained" color="warning" disabled={voidReason.trim().length < 3 || voidMutation.isPending} onClick={() => voidId && voidMutation.mutate({ id: voidId, reason: voidReason.trim() })}>
            {voidMutation.isPending ? <CircularProgress size={18} color="inherit" /> : 'Void entry'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog className="expenses-dialog" open={topUpOpen} onClose={() => setTopUpOpen(false)} maxWidth="xs" fullWidth>
        <TopUpDialog
          locations={locations}
          people={people}
          balances={balances}
          isLoading={topUpMutation.isPending}
          error={errorText(topUpMutation)}
          onSubmit={(data: any) => topUpMutation.mutate(data)}
          onClose={() => setTopUpOpen(false)}
        />
      </Dialog>

      <ReconcileDialog
        open={reconcileOpen}
        onClose={() => setReconcileOpen(false)}
        locations={locations}
        people={people}
        balances={balances}
        staffMembers={staffMembers}
        currentUser={currentUser}
        isLoading={reconcileMutation.isPending}
        error={errorText(reconcileMutation)}
        onSubmit={(data: any) => reconcileMutation.mutate(data)}
      />
      <RecordCheckDialog
        open={cashCheckOpen}
        onClose={() => setCashCheckOpen(false)}
        locations={locations}
        people={people}
        balances={balances}
        staffMembers={staffMembers}
        currentUser={currentUser}
        isLoading={dailyCheckMutation.isPending}
        error={errorText(dailyCheckMutation)}
        onSubmit={(data: any) => dailyCheckMutation.mutate(data)}
      />

      <Dialog className="expenses-dialog" open={Boolean(signCheck)} onClose={() => setSignCheck(null)} maxWidth="xs" fullWidth>
        {signCheck && (
          <SignCheckDialog
            check={signCheck}
            currentUser={currentUser}
            currentUserId={currentUserId}
            isLoading={acceptingId === signCheck.id}
            onSign={() => acceptMutation.mutate(signCheck.id)}
            onClose={() => setSignCheck(null)}
          />
        )}
      </Dialog>

      <Dialog className="expenses-dialog" open={Boolean(rejectingId)} onClose={() => { setRejectingId(null); setRejectionReason('') }} maxWidth="xs" fullWidth>
        <FigDialogHeader eyebrow="PETTY CASH" title="Reject reconciliation" subtitle="The balance will not change." onClose={() => { setRejectingId(null); setRejectionReason('') }} />
        <DialogContent sx={{ pt: 1.5 }}>
          <Alert className="expenses-dialog__hint" severity="warning">The person who counted the cash must submit a new reconciliation after the issue is corrected.</Alert>
          <TextField label="Why is it being rejected?" fullWidth multiline rows={3} value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} required autoFocus />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setRejectingId(null); setRejectionReason('') }}>Cancel</Button>
          <Button variant="contained" color="error" disabled={rejectionReason.trim().length < 3 || Boolean(reviewingId)} onClick={() => rejectingId && reviewReconciliationMutation.mutate({ id: rejectingId, decision: 'rejected', reason: rejectionReason.trim() })}>Reject reconciliation</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4500} onClose={() => setSnackbar(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  )
}

function CashCheckBanner({ checks, mine, onSign }: { checks: any[]; mine: any[]; onSign: (check: any) => void }) {
  const first = checks[0]
  const count = checks.length
  return (
    <Box className="expenses-banner" role="status">
      <Box className="expenses-banner__icon"><WarningIcon /></Box>
      <Box className="expenses-banner__copy-wrap">
        <Typography className="expenses-banner__title">
          {count} {count === 1 ? 'check needs' : 'checks need'} a second signature
        </Typography>
        <Typography className="expenses-banner__copy">
          {accountLabel(first)}’s money was counted on {relativeDay(first.check_date)} by {first.counted_by_name || 'a staff member'}. Another person needs to count and sign.
        </Typography>
      </Box>
      {mine.length > 0
        ? <Button className="expenses-button expenses-button--quiet" variant="outlined" onClick={() => onSign(mine[0])}>Sign now</Button>
        : <Typography className="expenses-banner__waiting">Awaiting {first.handed_over_to_name || 'the assigned staff member'}</Typography>}
    </Box>
  )
}

function SectionCard({ title, copy, actions, children, footnote }: { title: string; copy?: string; actions?: ReactNode; children: ReactNode; footnote?: ReactNode }) {
  return (
    <Paper elevation={0} className="expenses-card">
      <Box className="expenses-card__head">
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h2" className="expenses-card__title">{title}</Typography>
          {copy && <Typography className="expenses-card__copy">{copy}</Typography>}
        </Box>
        {actions && <Box className="expenses-card__actions">{actions}</Box>}
      </Box>
      {children}
      {footnote && <Box className="expenses-card__foot">{footnote}</Box>}
    </Paper>
  )
}

function LedgerSection({ expenses, people, page, setPage, filterOpen, setFilterOpen, filterSource, setFilterSource, filterCategory, setFilterCategory, filterPerson, setFilterPerson, onOpen, canManage, onAdd, onTopUp }: any) {
  const pageCount = Math.max(1, Math.ceil(expenses.length / PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const start = current * PAGE_SIZE
  const visible = expenses.slice(start, start + PAGE_SIZE)
  const hasFilters = Boolean(filterSource || filterCategory || filterPerson)

  return (
    <SectionCard
      title="Spending ledger"
      copy="Every entry stays traceable. Entries are voided, never deleted."
      actions={<Button className="expenses-button expenses-button--quiet" variant="outlined" onClick={() => setFilterOpen(!filterOpen)}>Filter{hasFilters ? ' · on' : ''}</Button>}
      footnote={expenses.length > 0 ? `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, expenses.length)} of ${expenses.length}` : undefined}
    >
      {filterOpen && (
        <Box className="expenses-filter">
          <TextField select size="small" label="Paid from" value={filterSource} onChange={e => setFilterSource(e.target.value)}>
            <MenuItem value="">All sources</MenuItem>
            <MenuItem value="house">House funds</MenuItem>
            <MenuItem value="person">A person’s money</MenuItem>
          </TextField>
          <TextField select size="small" label="Person" value={filterPerson} onChange={e => setFilterPerson(e.target.value)}>
            <MenuItem value="">All people</MenuItem>
            {people.map((p: any) => <MenuItem key={p.id} value={p.id}>{personName(p)}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Category" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <MenuItem value="">All categories</MenuItem>
            {CATEGORIES.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
          </TextField>
          {hasFilters && <Button className="expenses-button expenses-button--quiet" onClick={() => { setFilterSource(''); setFilterCategory(''); setFilterPerson('') }}>Clear</Button>}
        </Box>
      )}

      {expenses.length === 0 ? (
        <Box className="expenses-empty">
          <Box className="expenses-empty__icon"><LedgerIcon /></Box>
          <Typography className="expenses-empty__title">No expenses yet</Typography>
          <Typography className="expenses-empty__copy">
            {hasFilters
              ? 'Nothing matches these filters. Clear them to see the rest of the ledger.'
              : 'Start by topping up a cash account, then add each expense with its receipt. Nothing is ever deleted, so the record stays complete.'}
          </Typography>
          {canManage && !hasFilters && (
            <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2 }}>
              <Button className="expenses-button expenses-button--quiet" variant="outlined" onClick={onTopUp}>Top up cash</Button>
              <Button className="expenses-button expenses-button--primary" variant="contained" onClick={onAdd}>Add expense</Button>
            </Stack>
          )}
        </Box>
      ) : (
        <>
          <TableContainer className="expenses-table-wrap expenses-table-wrap--ledger">
            <Table className="expenses-table" size="small" aria-label="Spending ledger">
              <TableHead>
                <TableRow>{['Date', 'What for', 'From', 'Person', 'Amount', 'Receipt'].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow>
              </TableHead>
              <TableBody>
                {visible.map((e: any) => (
                  <TableRow
                    key={e.id}
                    hover
                    tabIndex={0}
                    className={`expenses-row${e.is_voided ? ' expenses-row--void' : ''}`}
                    onClick={() => onOpen(e)}
                    onKeyDown={(event: any) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(e) } }}
                  >
                    <TableCell className="expenses-table__date">{dayLabel(e.incurred_date)}</TableCell>
                    <TableCell>
                      <Typography className="expenses-table__what">{e.description || 'Untitled expense'}</Typography>
                      <Typography className="expenses-table__sub">{categoryLabel(e.category)}</Typography>
                    </TableCell>
                    <TableCell>{SOURCE_LABELS[e.money_source] || 'Person funds'}</TableCell>
                    <TableCell>{e.money_source === 'person' ? e.person_name || '—' : e.location_name || '—'}</TableCell>
                    <TableCell className="expenses-table__amount">{money(e.amount_pence)}</TableCell>
                    <TableCell><StatusChip label={e.receipt_url ? 'Attached' : 'Missing'} tone={e.receipt_url ? 'ok' : 'bad'} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box className="expenses-mobile-list">
            {visible.map((e: any) => (
              <Box
                className={`expenses-mobile-row${e.is_voided ? ' expenses-row--void' : ''}`}
                key={e.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpen(e)}
                onKeyDown={(event: any) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(e) } }}
              >
                <Box className="expenses-mobile-row__top">
                  <Box sx={{ minWidth: 0 }}>
                    <Typography className="expenses-mobile-row__primary">{e.description || 'Untitled expense'}</Typography>
                    <Typography className="expenses-mobile-row__secondary">
                      {dayLabel(e.incurred_date)} · {SOURCE_LABELS[e.money_source] || 'Person funds'} · {e.money_source === 'person' ? e.person_name || '—' : e.location_name || '—'}
                    </Typography>
                  </Box>
                  <Typography className="expenses-table__amount">{money(e.amount_pence)}</Typography>
                </Box>
                <Box className="expenses-mobile-row__bottom">
                  <StatusChip label={categoryLabel(e.category)} tone="neutral" />
                  <StatusChip label={e.receipt_url ? 'Receipt attached' : 'Receipt missing'} tone={e.receipt_url ? 'ok' : 'bad'} />
                </Box>
              </Box>
            ))}
          </Box>

          {pageCount > 1 && (
            <Box className="expenses-pager">
              <Button size="small" className="expenses-button expenses-button--quiet" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</Button>
              <Typography className="expenses-status-copy">Page {current + 1} of {pageCount}</Typography>
              <Button size="small" className="expenses-button expenses-button--quiet" disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)}>Next</Button>
            </Box>
          )}
        </>
      )}
    </SectionCard>
  )
}

function PettyCashSection({ balances, transactions, reconciliations, currentUserId, reviewingId, onReconcile, onDownload, reportLoading, onOpenCheck, latestCheckFor, onReview, onReject }: any) {
  return (
    <>
      <SectionCard
        title="Cash accounts"
        copy="House tins and each person’s money"
        actions={<>
          <Button className="expenses-button expenses-button--quiet" variant="outlined" onClick={onReconcile}>Request reconciliation</Button>
          {onDownload && <Button className="expenses-button expenses-button--quiet" variant="outlined" startIcon={<DownloadIcon />} onClick={onDownload} disabled={reportLoading}>{reportLoading ? 'Preparing…' : 'CSV report'}</Button>}
        </>}
      >
        <TableContainer className="expenses-table-wrap expenses-table-wrap--accounts">
          <Table className="expenses-table" size="small" aria-label="Cash accounts">
            <TableHead>
              <TableRow>{['Account', 'Location', 'Balance', 'Last checked'].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow>
            </TableHead>
            <TableBody>
              {balances.length === 0 ? (
                <TableRow><TableCell colSpan={4}><EmptyRow message="No cash accounts yet. Top up cash to open the first tin." /></TableCell></TableRow>
              ) : balances.map((b: any) => {
                const label = b.money_source === 'person' ? b.person_name || 'Personal money' : 'House tin'
                const check = latestCheckFor(b)
                return (
                  <TableRow
                    key={`${b.money_source}-${b.id}`}
                    hover
                    tabIndex={check ? 0 : undefined}
                    className={check ? 'expenses-row' : undefined}
                    onClick={check ? () => onOpenCheck(check) : undefined}
                    onKeyDown={check ? (event: any) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpenCheck(check) } } : undefined}
                  >
                    <TableCell>
                      <Box className="expenses-account">
                        <Avatar className={`expenses-avatar${b.money_source === 'house' ? ' expenses-avatar--house' : ''}`}>{b.money_source === 'house' ? <HomeWorkIcon fontSize="small" /> : initials(label)}</Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography className="expenses-table__what">{label}</Typography>
                          <Typography className="expenses-table__sub">{b.money_source === 'house' ? 'Shared spending' : 'Personal money'}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{b.location_name || '—'}</TableCell>
                    <TableCell className="expenses-table__amount">{money(b.current_balance_pence)}</TableCell>
                    <TableCell>
                      {check ? (
                        <>
                          <Typography className={check.accepted_at ? 'expenses-table__what' : 'expenses-table__what expenses-text--danger'}>{relativeDay(check.check_date)}</Typography>
                          <Typography className={check.accepted_at ? 'expenses-table__sub' : 'expenses-table__sub expenses-text--danger'}>
                            {check.accepted_at ? 'Signed by 2 people' : 'Second signature needed'}
                          </Typography>
                        </>
                      ) : (
                        <Typography className="expenses-table__sub">Not checked yet</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <Box className="expenses-mobile-list">
          {balances.length === 0 ? <EmptyRow message="No cash accounts yet." /> : balances.map((b: any) => {
            const label = b.money_source === 'person' ? b.person_name || 'Personal money' : 'House tin'
            const check = latestCheckFor(b)
            return (
              <Box className="expenses-mobile-row" key={`${b.money_source}-${b.id}`} role={check ? 'button' : undefined} tabIndex={check ? 0 : undefined} onClick={check ? () => onOpenCheck(check) : undefined}>
                <Box className="expenses-mobile-row__top">
                  <Box sx={{ minWidth: 0 }}>
                    <Typography className="expenses-mobile-row__primary">{label}</Typography>
                    <Typography className="expenses-mobile-row__secondary">{b.location_name || '—'} · {check ? `${relativeDay(check.check_date)} · ${check.accepted_at ? 'Signed by 2 people' : 'Second signature needed'}` : 'Not checked yet'}</Typography>
                  </Box>
                  <Typography className="expenses-table__amount">{money(b.current_balance_pence)}</Typography>
                </Box>
              </Box>
            )
          })}
        </Box>
      </SectionCard>

      {(reconciliations.length > 0) && (
        <SectionCard title="Reconciliation review" copy="Review the recorded count before it changes the account balance.">
          <TableContainer className="expenses-table-wrap">
            <Table className="expenses-table" size="small" aria-label="Petty cash reconciliation requests">
              <TableHead>
                <TableRow>{['Date', 'Account', 'Expected', 'Counted', 'Variance', 'Requested by', 'Reviewer', 'Status', ''].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow>
              </TableHead>
              <TableBody>
                {reconciliations.map((r: any) => (
                  <TableRow key={r.id} hover>
                    <TableCell className="expenses-table__date">{dayLabel(r.created_at)}</TableCell>
                    <TableCell>{r.money_source === 'person' ? r.person_name : r.location_name || 'House tin'}</TableCell>
                    <TableCell className="expenses-table__amount">{money(r.expected_balance_pence)}</TableCell>
                    <TableCell className="expenses-table__amount">{money(r.actual_balance_pence)}</TableCell>
                    <TableCell className="expenses-table__amount">{money(r.variance_pence)}</TableCell>
                    <TableCell>{r.requested_by_name || '—'}</TableCell>
                    <TableCell>{r.handed_over_to_name || '—'}</TableCell>
                    <TableCell>
                      <StatusChip
                        label={r.status === 'pending' ? 'Awaiting review' : r.status === 'accepted' ? 'Accepted' : 'Rejected'}
                        tone={r.status === 'accepted' ? 'ok' : r.status === 'rejected' ? 'bad' : 'due'}
                      />
                      {r.rejection_reason && <Typography className="expenses-table__sub">{r.rejection_reason}</Typography>}
                    </TableCell>
                    <TableCell>
                      {r.status === 'pending' && r.handed_over_to === currentUserId && (
                        <Box className="expenses-table__actions">
                          <Button size="small" variant="contained" color="success" disabled={reviewingId === r.id} onClick={() => onReview(r.id, 'accepted')}>
                            {reviewingId === r.id ? <CircularProgress size={14} color="inherit" /> : 'Accept'}
                          </Button>
                          <Button size="small" variant="outlined" color="error" disabled={reviewingId === r.id} onClick={() => onReject(r.id)}>Reject</Button>
                        </Box>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </SectionCard>
      )}

      <SectionCard title="Account history" copy="Top-ups and accepted reconciliations, in time order.">
        <TableContainer className="expenses-table-wrap">
          <Table className="expenses-table" size="small" aria-label="Petty cash transaction history">
            <TableHead>
              <TableRow>{['Date', 'Account', 'Type', 'Change', 'Balance after', 'Notes'].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow>
            </TableHead>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow><TableCell colSpan={6}><EmptyRow message="No cash movements yet." /></TableCell></TableRow>
              ) : transactions.map((t: any) => (
                <TableRow key={t.id} hover>
                  <TableCell className="expenses-table__date">{dayLabel(t.created_at)}</TableCell>
                  <TableCell>{t.money_source === 'person' ? t.person_name : t.location_name || 'House tin'}</TableCell>
                  <TableCell><StatusChip label={String(t.type).replace(/_/g, ' ')} tone="neutral" /></TableCell>
                  <TableCell className="expenses-table__amount">{money(t.amount_pence)}</TableCell>
                  <TableCell className="expenses-table__amount">{money(t.new_balance_pence)}</TableCell>
                  <TableCell>{t.notes || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>
    </>
  )
}

function CashChecksSection({ checks, currentUserId, acceptingId, canManage, onOpen, onSign, onCreate }: any) {
  const [page, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(checks.length / PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const visible = checks.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)

  const status = (check: any) => {
    if (!check.accepted_at) return <StatusChip label="1 signature" tone="due" />
    const variance = Number(check.variance_pence || 0)
    return variance === 0
      ? <StatusChip label="Matched" tone="ok" />
      : <StatusChip label={`Signed · ${money(Math.abs(variance))} off`} tone="neutral" />
  }
  const signedBy = (check: any) => [check.counted_by_name, check.accepted_by_name].filter(Boolean).join(', ') || '—'

  return (
    <SectionCard
      title="Daily cash checks"
      copy="Two people count, two people sign"
      actions={canManage ? <Button className="expenses-button expenses-button--quiet" variant="outlined" onClick={onCreate}>Record a check</Button> : undefined}
      footnote={checks.length > 0 ? `Showing ${current * PAGE_SIZE + 1}–${Math.min((current + 1) * PAGE_SIZE, checks.length)} of ${checks.length}` : undefined}
    >
      <TableContainer className="expenses-table-wrap expenses-table-wrap--checks">
        <Table className="expenses-table" size="small" aria-label="Daily cash checks">
          <TableHead>
            <TableRow>{['Date', 'Account', 'Expected', 'Counted', 'Signed by', 'Status', ''].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow>
          </TableHead>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow><TableCell colSpan={7}><EmptyRow message="No cash checks yet. A check is complete once a second person signs it." /></TableCell></TableRow>
            ) : visible.map((check: any) => (
              <TableRow
                key={check.id}
                hover
                tabIndex={0}
                className="expenses-row"
                onClick={() => onOpen(check)}
                onKeyDown={(event: any) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(check) } }}
              >
                <TableCell className="expenses-table__date">{dayLabel(check.check_date)}</TableCell>
                <TableCell>{accountLabel(check)}</TableCell>
                <TableCell className="expenses-table__amount">{money(check.expected_balance_pence)}</TableCell>
                <TableCell className="expenses-table__amount">{money(check.physical_balance_pence)}</TableCell>
                <TableCell>{signedBy(check)}</TableCell>
                <TableCell>{status(check)}</TableCell>
                <TableCell>
                  {!check.accepted_at && check.handed_over_to === currentUserId && (
                    <Button size="small" variant="contained" disabled={acceptingId === check.id} onClick={event => { event.stopPropagation(); onSign(check) }}>
                      {acceptingId === check.id ? <CircularProgress size={14} color="inherit" /> : 'Sign'}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box className="expenses-mobile-list">
        {visible.length === 0 ? <EmptyRow message="No cash checks yet." /> : visible.map((check: any) => (
          <Box className="expenses-mobile-row" key={check.id} role="button" tabIndex={0} onClick={() => onOpen(check)}>
            <Box className="expenses-mobile-row__top">
              <Box sx={{ minWidth: 0 }}>
                <Typography className="expenses-mobile-row__primary">{accountLabel(check)}</Typography>
                <Typography className="expenses-mobile-row__secondary">{dayLabel(check.check_date)} · counted by {check.counted_by_name || '—'}</Typography>
              </Box>
              {status(check)}
            </Box>
            <Box className="expenses-mobile-row__bottom">
              <Typography className="expenses-table__sub">Expected {money(check.expected_balance_pence)} · Counted {money(check.physical_balance_pence)}</Typography>
              {!check.accepted_at && check.handed_over_to === currentUserId && (
                <Button size="small" variant="contained" disabled={acceptingId === check.id} onClick={event => { event.stopPropagation(); onSign(check) }}>Sign</Button>
              )}
            </Box>
          </Box>
        ))}
      </Box>

      {pageCount > 1 && (
        <Box className="expenses-pager">
          <Button size="small" className="expenses-button expenses-button--quiet" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</Button>
          <Typography className="expenses-status-copy">Page {current + 1} of {pageCount}</Typography>
          <Button size="small" className="expenses-button expenses-button--quiet" disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)}>Next</Button>
        </Box>
      )}
    </SectionCard>
  )
}

function ExpenseDetailDialog({ expense, canManage, onClose, onEdit, onVoid }: any) {
  return (
    <>
      <FigDialogHeader
        eyebrow="EXPENSES"
        title={expense.description || 'Expense'}
        subtitle={`${longDay(expense.incurred_date)} · ${SOURCE_LABELS[expense.money_source] || 'Person funds'}`}
        onClose={onClose}
      />
      <DialogContent sx={{ pt: 1.5 }}>
        {expense.is_voided && (
          <Alert severity="warning" className="expenses-dialog__hint">
            Voided{expense.void_reason ? `: ${expense.void_reason}` : ''}. The entry stays in the audit history and is excluded from totals.
          </Alert>
        )}
        <Stack spacing={1.75}>
          <DetailRow label="Amount" value={money(expense.amount_pence)} strong />
          <DetailRow label="Category" value={categoryLabel(expense.category)} />
          <DetailRow label="Paid from" value={SOURCE_LABELS[expense.money_source] || 'Person funds'} />
          <DetailRow label={expense.money_source === 'person' ? 'Person' : 'Location'} value={expense.money_source === 'person' ? expense.person_name || '—' : expense.location_name || '—'} />
          <DetailRow label="Payment method" value={(PAYMENT_METHODS.find(m => m.value === expense.payment_method)?.label) || expense.payment_method || '—'} />
          <DetailRow label="Added by" value={expense.created_by_name || '—'} />
          <Divider />
          <Box className="expenses-detail__receipt">
            <Typography className="expenses-detail__label">Receipt</Typography>
            {expense.receipt_url
              ? <Button size="small" className="expenses-button expenses-button--quiet" variant="outlined" startIcon={<OpenInNewIcon />} href={expense.receipt_url} target="_blank" rel="noopener noreferrer">Open receipt</Button>
              : <Typography className="expenses-table__sub">No receipt attached.</Typography>}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {canManage && !expense.is_voided && <Button startIcon={<EditIcon />} onClick={onEdit}>Edit</Button>}
        {canManage && !expense.is_voided && <Button color="warning" startIcon={<VoidIcon />} onClick={onVoid}>Void</Button>}
      </DialogActions>
    </>
  )
}

function DetailRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Box className="expenses-detail__row">
      <Typography className="expenses-detail__label">{label}</Typography>
      <Typography className={strong ? 'expenses-detail__value expenses-detail__value--strong' : 'expenses-detail__value'}>{value}</Typography>
    </Box>
  )
}

function AddExpenseDialog({ people, locations, isLoading, error, onSubmit, onClose }: any) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(today())
  const [source, setSource] = useState<'house' | 'person'>('house')
  const [accountId, setAccountId] = useState('')
  const [category, setCategory] = useState('food')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [receiptUrl, setReceiptUrl] = useState('')
  const [receiptName, setReceiptName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInput = useRef<HTMLInputElement | null>(null)

  const uploadReceipt = async (file?: File) => {
    if (!file) return
    setUploadError('')
    if (file.size > RECEIPT_LIMIT_BYTES) { setUploadError('Choose a photo or PDF up to 10 MB.'); return }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post('/settings/upload', formData)
      setReceiptUrl(res.data.url)
      setReceiptName(file.name)
    } catch (e: any) {
      setUploadError(e.response?.data?.error || 'Could not upload this receipt. Try again.')
    } finally {
      setUploading(false)
    }
  }

  const canSave = Boolean(description.trim()) && amount > 0 && Boolean(accountId) && !uploading

  const save = () => {
    if (!canSave) return
    onSubmit({
      moneySource: source,
      locationId: source === 'house' ? accountId : undefined,
      personId: source === 'person' ? accountId : undefined,
      category,
      amountPence: Math.round(amount * 100),
      description: description.trim(),
      paymentMethod,
      incurredDate: date,
      receiptUrl: receiptUrl || undefined,
    })
  }

  return (
    <>
      <FigDialogHeader eyebrow="EXPENSES" title="Add expense" subtitle="Amounts, dates and people can’t be changed after saving." onClose={onClose} />
      <DialogContent sx={{ pt: 1.5 }}>
        {error && <Alert severity="error" className="expenses-dialog__hint">{error}</Alert>}
        <Stack spacing={2.25}>
          <Box>
            <Typography className="expenses-detail__label">What for</Typography>
            <TextField fullWidth size="small" sx={{ mt: 0.75 }} value={description} onChange={e => setDescription(e.target.value)} inputProps={{ maxLength: 500 }} placeholder="Weekly food shop" autoFocus />
          </Box>
          <Stack direction="row" spacing={2}>
            <Box sx={{ flex: 1 }}>
              <Typography className="expenses-detail__label">Amount</Typography>
              <TextField fullWidth size="small" sx={{ mt: 0.75 }} type="number" value={amount || ''} onChange={e => setAmount(Number(e.target.value) || 0)} inputProps={{ min: 0.01, step: 0.01 }} InputProps={{ startAdornment: <Typography sx={{ mr: 0.5, color: 'text.secondary' }}>£</Typography> }} placeholder="86.40" />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography className="expenses-detail__label">Date</Typography>
              <TextField fullWidth size="small" sx={{ mt: 0.75 }} type="date" value={date} onChange={e => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Box>
          </Stack>
          <Box>
            <Typography className="expenses-detail__label">Paid from</Typography>
            <Box sx={{ mt: 1 }}>
              <PillOptions
                options={[{ value: 'house', label: 'House funds' }, { value: 'person', label: 'A person’s money' }]}
                value={source}
                onChange={(value: string) => { setSource(value as 'house' | 'person'); setAccountId('') }}
                showCheck
              />
            </Box>
          </Box>
          <TextField
            select fullWidth size="small"
            label={source === 'house' ? 'Location' : 'Person'}
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
          >
            <MenuItem value="">{source === 'house' ? 'Select the house' : 'Select the person'}</MenuItem>
            {source === 'house'
              ? locations.map((l: any) => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)
              : people.map((p: any) => <MenuItem key={p.id} value={p.id}>{personName(p)}</MenuItem>)}
          </TextField>
          <Stack direction="row" spacing={2}>
            <TextField select fullWidth size="small" label="Category" value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
            </TextField>
            <TextField select fullWidth size="small" label="Payment method" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              {PAYMENT_METHODS.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
            </TextField>
          </Stack>
          <Box
            className={`expenses-dropzone${uploading ? ' expenses-dropzone--busy' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => fileInput.current?.click()}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInput.current?.click() } }}
          >
            <input
              ref={fileInput}
              type="file"
              accept="image/*,application/pdf"
              hidden
              onChange={e => { uploadReceipt(e.target.files?.[0]); e.target.value = '' }}
            />
            {uploading ? <CircularProgress size={22} /> : <UploadIcon color="primary" />}
            <Typography className="expenses-dropzone__title">{receiptName || (uploading ? 'Uploading receipt…' : 'Attach the receipt')}</Typography>
            <Typography className="expenses-dropzone__copy">{receiptName ? 'Click to replace this file' : 'Photo or PDF · up to 10 MB'}</Typography>
          </Box>
          {uploadError && <Typography className="expenses-text--danger">{uploadError}</Typography>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" className="expenses-button expenses-button--primary" disabled={!canSave || isLoading} onClick={save}>
          {isLoading ? <CircularProgress size={18} color="inherit" /> : 'Save expense'}
        </Button>
      </DialogActions>
    </>
  )
}

function EditExpenseDialog({ expense, isLoading, error, onSubmit, onClose }: any) {
  const [category, setCategory] = useState(expense?.category || 'food')
  const [description, setDescription] = useState(expense?.description || '')
  return (
    <>
      <FigDialogHeader eyebrow="EXPENSES" title="Edit this entry" subtitle="Only the description and category change." onClose={onClose} />
      <DialogContent sx={{ pt: 1.5 }}>
        {error && <Alert severity="error" className="expenses-dialog__hint">{error}</Alert>}
        <Alert className="expenses-dialog__hint" severity="info">The amount, date, source and receipt stay as recorded, so the audit trail stays intact.</Alert>
        <Stack spacing={2}>
          <TextField select fullWidth size="small" label="Category" value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
          </TextField>
          <TextField label="What for" fullWidth size="small" multiline rows={3} value={description} onChange={e => setDescription(e.target.value)} inputProps={{ maxLength: 500 }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" className="expenses-button expenses-button--primary" disabled={isLoading} onClick={() => onSubmit({ category, description })}>
          {isLoading ? <CircularProgress size={18} color="inherit" /> : 'Save changes'}
        </Button>
      </DialogActions>
    </>
  )
}

function TopUpDialog({ locations, people, balances, isLoading, error, onSubmit, onClose }: any) {
  const [accountKey, setAccountKey] = useState('')
  const [amount, setAmount] = useState(0)
  const [source, setSource] = useState('bank_withdrawal')

  const accounts = useMemo(() => {
    const balanceFor = (moneySource: string, id: string) => balances.find((b: any) =>
      b.money_source === moneySource && (moneySource === 'house' ? b.location_id === id : b.person_id === id))
    const options = locations.map((l: any) => ({
      key: `house:${l.id}`, moneySource: 'house' as const, id: l.id,
      label: `House tin · ${l.name}`, balance: Number(balanceFor('house', l.id)?.current_balance_pence || 0),
    }))
    for (const p of people) {
      options.push({
        key: `person:${p.id}`, moneySource: 'person' as const, id: p.id,
        label: `${personName(p)} · personal money`, balance: Number(balanceFor('person', p.id)?.current_balance_pence || 0),
      })
    }
    return options
  }, [locations, people, balances])

  const selected = accounts.find((a: any) => a.key === accountKey)
  const canSave = Boolean(selected) && amount > 0 && !isLoading

  const save = () => {
    if (!selected) return
    onSubmit({
      moneySource: selected.moneySource,
      locationId: selected.moneySource === 'house' ? selected.id : undefined,
      personId: selected.moneySource === 'person' ? selected.id : undefined,
      amountPence: Math.round(amount * 100),
      notes: CASH_SOURCE_OPTIONS.find(o => o.value === source)?.label || 'Top up',
    })
  }

  return (
    <>
      <FigDialogHeader eyebrow="EXPENSES" title="Top up cash" subtitle="Add money to a cash account." onClose={onClose} />
      <DialogContent sx={{ pt: 1.5 }}>
        {error && <Alert severity="error" className="expenses-dialog__hint">{error}</Alert>}
        <Stack spacing={2.25}>
          <TextField select fullWidth size="small" label="Account" value={accountKey} onChange={e => setAccountKey(e.target.value)} autoFocus>
            <MenuItem value="">Select an account</MenuItem>
            {accounts.map((account: any) => (
              <MenuItem key={account.key} value={account.key}>
                {account.label} — {money(account.balance)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth size="small" label="Amount" type="number" value={amount || ''}
            onChange={e => setAmount(Number(e.target.value) || 0)}
            inputProps={{ min: 0.01, step: 0.01 }}
            InputProps={{ startAdornment: <Typography sx={{ mr: 0.5, color: 'text.secondary' }}>£</Typography> }}
            helperText={selected ? `New balance: ${money(selected.balance + Math.round(amount * 100))}` : ' '}
          />
          <TextField select fullWidth size="small" label="Source" value={source} onChange={e => setSource(e.target.value)}>
            {CASH_SOURCE_OPTIONS.map(option => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" className="expenses-button expenses-button--primary" disabled={!canSave} onClick={save}>
          {isLoading ? <CircularProgress size={18} color="inherit" /> : 'Top up'}
        </Button>
      </DialogActions>
    </>
  )
}

function ReconcileDialog({ open, onClose, locations, people, balances, staffMembers, currentUser, isLoading, error, onSubmit }: any) {
  const [source, setSource] = useState<'house' | 'person'>('house')
  const [accountId, setAccountId] = useState('')
  const [counted, setCounted] = useState(0)
  const [handedOverTo, setHandedOverTo] = useState('')
  const [notes, setNotes] = useState('')

  const balance = useMemo(() => {
    const match = balances.find((b: any) => b.money_source === source && (source === 'house' ? b.location_id : b.person_id) === accountId)
    return Number(match?.current_balance_pence || 0)
  }, [balances, source, accountId])
  const variance = Math.round(counted * 100) - balance
  const canSave = Boolean(accountId) && Boolean(handedOverTo) && !isLoading

  useEffect(() => {
    if (open) { setSource('house'); setAccountId(''); setCounted(0); setHandedOverTo(''); setNotes('') }
  }, [open])

  const save = () => {
    onSubmit({
      moneySource: source,
      locationId: source === 'house' ? accountId : undefined,
      personId: source === 'person' ? accountId : undefined,
      actualBalancePence: Math.round(counted * 100),
      handedOverTo,
      notes: notes || undefined,
    })
  }

  return (
    <Dialog className="expenses-dialog" open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <FigDialogHeader eyebrow="PETTY CASH" title="Request reconciliation" subtitle="A second staff member reviews the count before the balance changes." onClose={onClose} />
      <DialogContent sx={{ pt: 1.5 }}>
        {error && <Alert severity="error" className="expenses-dialog__hint">{error}</Alert>}
        <Stack spacing={2.25}>
          <Box>
            <Typography className="expenses-detail__label">Cash belongs to</Typography>
            <Box sx={{ mt: 1 }}>
              <PillOptions
                options={[{ value: 'house', label: 'House' }, { value: 'person', label: 'Person' }]}
                value={source}
                onChange={(value: string) => { setSource(value as 'house' | 'person'); setAccountId('') }}
              />
            </Box>
          </Box>
          <TextField select fullWidth size="small" label={source === 'house' ? 'Location' : 'Person'} value={accountId} onChange={e => setAccountId(e.target.value)}>
            <MenuItem value="">{source === 'house' ? 'Select location' : 'Select person'}</MenuItem>
            {source === 'house'
              ? locations.map((l: any) => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)
              : people.map((p: any) => <MenuItem key={p.id} value={p.id}>{personName(p)}</MenuItem>)}
          </TextField>
          <TextField
            fullWidth size="small" label="Cash counted" type="number" value={counted || ''}
            onChange={e => setCounted(Number(e.target.value) || 0)}
            InputProps={{ startAdornment: <Typography sx={{ mr: 0.5, color: 'text.secondary' }}>£</Typography> }}
            helperText={accountId ? `Recorded balance: ${money(balance)} · difference ${money(Math.abs(variance))}` : ' '}
          />
          <TextField select fullWidth size="small" label="Reviewed by" value={handedOverTo} onChange={e => setHandedOverTo(e.target.value)} helperText="A different active staff member must approve or reject this.">
            <MenuItem value="">Select reviewing staff member</MenuItem>
            {staffMembers.filter((s: any) => s.id !== (currentUser.id || currentUser.userId)).map((s: any) => <MenuItem key={s.id} value={s.id}>{personName(s)}</MenuItem>)}
          </TextField>
          <TextField fullWidth size="small" label="Notes (optional)" multiline rows={2} value={notes} onChange={e => setNotes(e.target.value)} inputProps={{ maxLength: 500 }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" className="expenses-button expenses-button--primary" disabled={!canSave} onClick={save}>
          {isLoading ? <CircularProgress size={18} color="inherit" /> : 'Send for review'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function RecordCheckDialog({ open, onClose, locations, people, balances, staffMembers, currentUser, isLoading, error, onSubmit }: any) {
  const [source, setSource] = useState<'house' | 'person'>('house')
  const [accountId, setAccountId] = useState('')
  const [date, setDate] = useState(today())
  const [counted, setCounted] = useState(0)
  const [handedOverTo, setHandedOverTo] = useState('')
  const [notes, setNotes] = useState('')

  const balance = useMemo(() => {
    const match = balances.find((b: any) => b.money_source === source && (source === 'house' ? b.location_id : b.person_id) === accountId)
    return Number(match?.current_balance_pence || 0)
  }, [balances, source, accountId])
  const variance = Math.round(counted * 100) - balance
  const canSave = Boolean(accountId) && Boolean(handedOverTo) && counted > 0 && !isLoading

  useEffect(() => {
    if (open) { setSource('house'); setAccountId(''); setDate(today()); setCounted(0); setHandedOverTo(''); setNotes('') }
  }, [open])

  const save = () => {
    onSubmit({
      moneySource: source,
      locationId: source === 'house' ? accountId : undefined,
      personId: source === 'person' ? accountId : undefined,
      expectedBalancePence: balance,
      physicalBalancePence: Math.round(counted * 100),
      checkDate: date,
      handedOverTo,
      notes: notes || undefined,
    })
  }

  return (
    <Dialog className="expenses-dialog" open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <FigDialogHeader eyebrow="PETTY CASH" title="Record a cash check" subtitle="You count the cash; a second person signs it off." onClose={onClose} />
      <DialogContent sx={{ pt: 1.5 }}>
        {error && <Alert severity="error" className="expenses-dialog__hint">{error}</Alert>}
        <Stack spacing={2.25}>
          <Box>
            <Typography className="expenses-detail__label">Cash belongs to</Typography>
            <Box sx={{ mt: 1 }}>
              <PillOptions
                options={[{ value: 'house', label: 'House' }, { value: 'person', label: 'Person' }]}
                value={source}
                onChange={(value: string) => { setSource(value as 'house' | 'person'); setAccountId('') }}
              />
            </Box>
          </Box>
          <TextField select fullWidth size="small" label={source === 'house' ? 'Location' : 'Person'} value={accountId} onChange={e => setAccountId(e.target.value)}>
            <MenuItem value="">{source === 'house' ? 'Select location' : 'Select person'}</MenuItem>
            {source === 'house'
              ? locations.map((l: any) => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)
              : people.map((p: any) => <MenuItem key={p.id} value={p.id}>{personName(p)}</MenuItem>)}
          </TextField>
          <TextField fullWidth size="small" label="Check date" type="date" value={date} onChange={e => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField
            fullWidth size="small" label="Cash you counted" type="number" value={counted || ''}
            onChange={e => setCounted(Number(e.target.value) || 0)}
            InputProps={{ startAdornment: <Typography sx={{ mr: 0.5, color: 'text.secondary' }}>£</Typography> }}
            helperText={accountId ? `Recorded balance: ${money(balance)} · difference ${money(Math.abs(variance))}` : ' '}
          />
          <TextField select fullWidth size="small" label="Handed over to" value={handedOverTo} onChange={e => setHandedOverTo(e.target.value)} helperText="A different active staff member must sign this count.">
            <MenuItem value="">Select the second person</MenuItem>
            {staffMembers.filter((s: any) => s.id !== (currentUser.id || currentUser.userId)).map((s: any) => <MenuItem key={s.id} value={s.id}>{personName(s)}</MenuItem>)}
          </TextField>
          <TextField fullWidth size="small" label="Notes (optional)" multiline rows={2} value={notes} onChange={e => setNotes(e.target.value)} inputProps={{ maxLength: 500 }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" className="expenses-button expenses-button--primary" disabled={!canSave} onClick={save}>
          {isLoading ? <CircularProgress size={18} color="inherit" /> : 'Record check'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function SignCheckDialog({ check, currentUser, currentUserId, isLoading, onSign, onClose }: any) {
  const expected = Number(check.expected_balance_pence || 0)
  const counted = Number(check.physical_balance_pence || 0)
  const variance = counted - expected
  const matches = variance === 0
  const mine = check.handed_over_to === currentUserId
  const accepted = Boolean(check.accepted_at)

  return (
    <>
      <FigDialogHeader
        eyebrow="EXPENSES"
        title={accepted ? 'Cash check' : 'Sign the cash check'}
        subtitle={`${accountLabel(check)} · counted by ${check.counted_by_name || 'a staff member'} on ${longDay(check.check_date)}`}
        onClose={onClose}
      />
      <DialogContent sx={{ pt: 1.5 }}>
        {accepted && <Alert severity="success" className="expenses-dialog__hint">Signed by {check.accepted_by_name || 'a second staff member'}.</Alert>}
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TextField fullWidth size="small" label="Expected" value={money(expected)} InputProps={{ readOnly: true }} className="expenses-field--readonly" />
          <TextField fullWidth size="small" label="Counted" value={money(counted)} InputProps={{ readOnly: true }} className="expenses-field--readonly" />
        </Stack>
        <Box className={`expenses-band${matches ? '' : ' expenses-band--due'}`}>
          <Box className="expenses-band__icon">{matches ? <CheckCircleIcon /> : <WarningIcon />}</Box>
          <Box>
            <Typography className="expenses-band__title">{matches ? 'It matches' : `${money(Math.abs(variance))} difference`}</Typography>
            <Typography className="expenses-band__copy">
              {matches
                ? 'The count matches the expected balance.'
                : `The count is ${variance > 0 ? 'over' : 'under'} the expected balance. Sign only if you are satisfied the difference is explained.`}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ mt: 2 }}>
          <TextField fullWidth size="small" label="Signed by" value={personName(currentUser)} InputProps={{ readOnly: true }} className="expenses-field--readonly" helperText="You can’t be the same person who did the first count." />
        </Box>
        {!accepted && !mine && (
          <Typography className="expenses-status-copy" sx={{ mt: 1.5 }}>
            Awaiting {check.handed_over_to_name || 'the assigned staff member'} to sign.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{accepted || !mine ? 'Close' : 'Cancel'}</Button>
        {!accepted && mine && (
          <Button variant="contained" className="expenses-button expenses-button--primary" disabled={isLoading} onClick={onSign}>
            {isLoading ? <CircularProgress size={18} color="inherit" /> : 'Sign check'}
          </Button>
        )}
      </DialogActions>
    </>
  )
}
