import { useMemo, useState, useEffect } from 'react'
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, MenuItem, Paper, Snackbar, Stack, Tab, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material'
import {
  Add as AddIcon, Block as VoidIcon, CheckCircle as CheckCircleIcon,
  Download as DownloadIcon, Edit as EditIcon, History as HistoryIcon,
  Receipt as ReceiptIcon, Search as SearchIcon, Wallet as WalletIcon,
} from '@mui/icons-material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import './expenses.css'

const CATEGORIES = [
  { value: 'food', label: 'Food' }, { value: 'clothing', label: 'Clothing' },
  { value: 'activities', label: 'Activities' }, { value: 'transport', label: 'Transport' },
  { value: 'personal', label: 'Personal' }, { value: 'health', label: 'Health' },
  { value: 'other', label: 'Other' },
]
const SOURCE_LABELS: Record<string, string> = { house: 'House funds', person: 'Person funds' }
const MANAGE_ROLES = ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER']
const VIEW_ROLES = [...MANAGE_ROLES, 'CARE_WORKER']
const CHECKS_PER_PAGE = 15

function asArray(value: any, keys: string[] = []): any[] {
  if (Array.isArray(value)) return value
  for (const key of keys) if (Array.isArray(value?.[key])) return value[key]
  return Array.isArray(value?.data) ? value.data : []
}
function today() { return new Date().toISOString().slice(0, 10) }
function money(pence: number | string | null | undefined) { return `£${(Number(pence || 0) / 100).toFixed(2)}` }
function pounds(value: number | string | null | undefined) { return `£${Number(value || 0).toLocaleString('en-GB')}` }
function personName(person: any) { return `${person?.first_name || ''} ${person?.last_name || ''}`.trim() || person?.email || 'Unnamed staff member' }
function csvCell(value: any) { return `"${String(value ?? '').replace(/"/g, '""')}"` }

export default function ExpensesPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [voidId, setVoidId] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [reconcileOpen, setReconcileOpen] = useState(false)
  const [cashCheckOpen, setCashCheckOpen] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const onReviewReconciliation = (id: string, reason: string) => reviewReconciliationMutation.mutate({ id, decision: 'rejected', reason })
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['expense-stats'] }); setCreateOpen(false); showSuccess('Expense added') },
    onError: (e: any) => showError(e.response?.data?.error || 'Could not add expense'),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => api.patch(`/expenses/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['expense-stats'] }); setEditId(null); showSuccess('Entry updated') },
    onError: (e: any) => showError(e.response?.data?.error || 'Could not update entry'),
  })
  const voidMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.put(`/expenses/${id}/void`, { reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['expense-stats'] }); setVoidId(null); setVoidReason(''); showSuccess('Entry voided') },
    onError: (e: any) => showError(e.response?.data?.error || 'Could not void entry'),
  })
  const topUpMutation = useMutation({
    mutationFn: (data: any) => api.post('/expenses/petty-cash/top-up', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['petty-cash-balances'] }); qc.invalidateQueries({ queryKey: ['petty-cash-transactions'] }); setTopUpOpen(false); showSuccess('Cash topped up') },
    onError: (e: any) => showError(e.response?.data?.error || 'Could not top up cash'),
  })
  const reconcileMutation = useMutation({
    mutationFn: (data: any) => api.post('/expenses/petty-cash/reconcile', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash-reconciliation-requests'] }); setReconcileOpen(false); showSuccess('Reconciliation submitted for review') },
    onError: (e: any) => showError(e.response?.data?.error || 'Could not submit reconciliation'),
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
    onError: (e: any) => showError(e.response?.data?.error || 'Could not save cash check'),
  })
  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.post(`/expenses/petty-cash/daily-checks/${id}/accept`),
    onMutate: (id) => setAcceptingId(id),
    onSettled: () => setAcceptingId(null),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash-balance-checks'] }); showSuccess('Cash count accepted') },
    onError: (e: any) => showError(e.response?.data?.error || 'Could not accept cash count'),
  })

  const totals = useMemo(() => {
    const house = balances.filter((b: any) => b.money_source === 'house').reduce((sum: number, b: any) => sum + Number(b.current_balance_pence || 0), 0)
    const person = balances.filter((b: any) => b.money_source === 'person').reduce((sum: number, b: any) => sum + Number(b.current_balance_pence || 0), 0)
    const ledger = stats?.total_amount_pounds != null ? pounds(stats.total_amount_pounds * 100) : money(expenses.reduce((sum: number, e: any) => sum + Number(e.amount_pence || 0), 0))
    return { house, person, ledger, accounts: balances.length }
  }, [balances, expenses, stats])

  if (expensesLoading) return <Box className="expenses-page"><Box className="expenses-empty" role="status" aria-live="polite"><CircularProgress /><Typography className="expenses-empty__copy">Loading the expense workspace</Typography></Box></Box>
  if (expensesError) return <Box className="expenses-page"><Alert severity="error">Expenses could not be loaded. Refresh the page or contact an administrator.</Alert></Box>

  return (
    <Box className="expenses-page">
      <header className="expenses-header">
        <Box className="expenses-header__copy">
          <Typography component="h1" className="expenses-header__title">Expenses</Typography>
          <Typography className="expenses-header__description">A clear record of spending, available cash, and checks that still need a second person’s sign-off.</Typography>
        </Box>
        {canManage && <Box className="expenses-actions">
          <Button className="expenses-button expenses-button--quiet" variant="outlined" startIcon={<WalletIcon />} onClick={() => setTopUpOpen(true)}>Top up cash</Button>
          <Button className="expenses-button expenses-button--primary" variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>Add expense</Button>
        </Box>}
      </header>

      <section className="expenses-summary" aria-label="Expense summary">
        <SummaryItem label="Total ledger" value={totals.ledger} detail={`${stats?.total_expenses ?? expenses.length} recorded entries`} primary />
        <SummaryItem label="House funds" value={canManage ? money(totals.house) : '—'} detail={canManage ? 'Available now' : 'Manager access required'} />
        <SummaryItem label="Person funds" value={canManage ? money(totals.person) : '—'} detail={canManage ? 'Available now' : 'Manager access required'} />
        <SummaryItem label="Cash accounts" value={canManage ? String(totals.accounts) : '—'} detail={canManage ? 'Locations and people' : 'Manager access required'} />
      </section>

      <Tabs className="expenses-tabs" value={tab} onChange={(_, value) => setTab(value)} aria-label="Expense sections">
        <Tab icon={<ReceiptIcon />} iconPosition="start" label="Spending ledger" />
        {canManage && <Tab icon={<WalletIcon />} iconPosition="start" label="Petty cash" />}
        <Tab icon={<HistoryIcon />} iconPosition="start" label="Daily cash checks" />
      </Tabs>

      {tab === 0 && <LedgerTab
        expenses={expenses} people={people} filterSource={filterSource} filterCategory={filterCategory} filterPerson={filterPerson}
        setFilterSource={setFilterSource} setFilterCategory={setFilterCategory} setFilterPerson={setFilterPerson}
        onEdit={setEditId} onVoid={(id: string) => { setVoidId(id); setVoidReason('') }} canManage={canManage}
      />}
      {tab === 1 && canManage && <PettyCashTab balances={balances} transactions={transactions} reconciliations={reconciliations} currentUserId={currentUserId} onTopUp={() => setTopUpOpen(true)} onReconcile={() => setReconcileOpen(true)} onReview={(id: string, decision: 'accepted' | 'rejected', reason?: string) => reviewReconciliationMutation.mutate({ id, decision, reason })} reviewingId={reviewingId} setRejectingId={setRejectingId} onDownload={async () => {
        setReportLoading(true)
        try {
          const response = await api.get('/expenses/report')
          const rows = (response.data.expenses || []).map((e: any) => [e.incurred_date, SOURCE_LABELS[e.money_source] || e.money_source, e.person_name || '', e.category, e.description || '', money(e.amount_pence), e.created_by_name || '', e.is_voided ? 'Yes' : 'No'])
          const csv = [['Date', 'Source', 'Person', 'Category', 'Description', 'Amount', 'Added by', 'Voided'], ...rows].map(row => row.map(csvCell).join(',')).join('\n')
          const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); link.download = `expenses-report-${today()}.csv`; link.click(); URL.revokeObjectURL(link.href)
        } catch { showError('Could not download the report') } finally { setReportLoading(false) }
      }} reportLoading={reportLoading} />}
      {((tab === 1 && !canManage) || tab === 2) && <CashChecksTab cashChecks={cashChecks} reconciliations={reconciliations} currentUserId={currentUserId} onNewCheck={() => setCashCheckOpen(true)} onAccept={(id: string) => acceptMutation.mutate(id)} onReview={(id: string, decision: 'accepted' | 'rejected', reason?: string) => reviewReconciliationMutation.mutate({ id, decision, reason })} reviewingId={reviewingId} setRejectingId={setRejectingId} acceptingId={acceptingId} canCreate={canManage} />}

      <Dialog className="expenses-dialog" open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add expense</DialogTitle>
        <ExpenseForm people={people} locations={locations} onSubmit={(data: any) => createMutation.mutate(data)} onCancel={() => setCreateOpen(false)} isLoading={createMutation.isPending} />
      </Dialog>
      <Dialog className="expenses-dialog" open={Boolean(editId)} onClose={() => setEditId(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit ledger entry</DialogTitle>
        {editId && <EditExpenseForm key={editId} expense={expenses.find((e: any) => e.id === editId)} onSubmit={(data: any) => updateMutation.mutate({ id: editId, data })} onCancel={() => setEditId(null)} isLoading={updateMutation.isPending} />}
      </Dialog>
      <Dialog className="expenses-dialog" open={Boolean(voidId)} onClose={() => { setVoidId(null); setVoidReason('') }} maxWidth="sm" fullWidth>
        <DialogTitle>Void ledger entry</DialogTitle>
        <DialogContent><Alert className="expenses-dialog__hint" severity="warning">The entry will remain in the audit history, but will be excluded from totals. This cannot be undone.</Alert><TextField label="Reason for voiding" fullWidth multiline rows={3} value={voidReason} onChange={e => setVoidReason(e.target.value)} /></DialogContent>
        <DialogActions><Button onClick={() => { setVoidId(null); setVoidReason('') }}>Cancel</Button><Button variant="contained" color="warning" disabled={voidReason.trim().length < 3 || voidMutation.isPending} onClick={() => voidId && voidMutation.mutate({ id: voidId, reason: voidReason.trim() })}>{voidMutation.isPending ? <CircularProgress size={20} /> : 'Void entry'}</Button></DialogActions>
      </Dialog>
      <PettyCashDialog open={topUpOpen} title="Top up cash" locations={locations} people={people} balances={balances} onClose={() => setTopUpOpen(false)} onSubmit={(data: any) => topUpMutation.mutate(data)} kind="top_up" isLoading={topUpMutation.isPending} />
      <PettyCashDialog open={reconcileOpen} title="Request cash reconciliation" locations={locations} people={people} balances={balances} staffMembers={staffMembers} currentUser={currentUser} onClose={() => setReconcileOpen(false)} onSubmit={(data: any) => reconcileMutation.mutate(data)} kind="reconcile" isLoading={reconcileMutation.isPending} />
      <PettyCashDialog open={cashCheckOpen} title="Daily cash balance check" locations={locations} people={people} balances={balances} staffMembers={staffMembers} currentUser={currentUser} onClose={() => setCashCheckOpen(false)} onSubmit={(data: any) => dailyCheckMutation.mutate(data)} kind="daily_check" isLoading={dailyCheckMutation.isPending} />
      <Dialog className="expenses-dialog" open={Boolean(rejectingId)} onClose={() => { setRejectingId(null); setRejectionReason('') }} maxWidth="sm" fullWidth>
        <DialogTitle>Reject reconciliation</DialogTitle>
        <DialogContent><Alert className="expenses-dialog__hint" severity="warning">The balance will not change. The person who counted the cash must submit a new reconciliation after the issue is corrected.</Alert><TextField label="Reason for rejection" fullWidth multiline rows={3} value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} required /></DialogContent>
        <DialogActions><Button onClick={() => { setRejectingId(null); setRejectionReason('') }}>Cancel</Button><Button variant="contained" color="error" disabled={rejectionReason.trim().length < 3 || Boolean(reviewingId)} onClick={() => rejectingId && onReviewReconciliation(rejectingId, rejectionReason.trim())}>Reject reconciliation</Button></DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4500} onClose={() => setSnackbar(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}><Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))} variant="filled">{snackbar.message}</Alert></Snackbar>
    </Box>
  )
}

function SummaryItem({ label, value, detail, primary = false }: { label: string; value: string; detail: string; primary?: boolean }) {
  return <div className="expenses-summary__item" data-primary={primary || undefined}><span className="expenses-summary__label">{label}</span><span className="expenses-summary__value">{value}</span><span className="expenses-summary__detail">{detail}</span></div>
}

function LedgerTab({ expenses, people, filterSource, filterCategory, filterPerson, setFilterSource, setFilterCategory, setFilterPerson, onEdit, onVoid, canManage }: any) {
  return <Box>
    <Box className="expenses-section-heading"><Box><Typography component="h2" className="expenses-section-heading__title">Spending ledger</Typography><Typography className="expenses-section-heading__copy">Every entry stays traceable. Voiding is used instead of deletion.</Typography></Box><Typography className="expenses-status-copy">{expenses.length} visible {expenses.length === 1 ? 'entry' : 'entries'}</Typography></Box>
    <Alert className="expenses-audit-note" severity="info">Amounts, sources, dates, and people are fixed after creation. Managers can update the category or description; corrections remain visible in the audit history.</Alert>
    <Box className="expenses-filter-bar">
      <TextField select size="small" label="Money source" value={filterSource} onChange={e => setFilterSource(e.target.value)}><MenuItem value="">All sources</MenuItem><MenuItem value="house">House funds</MenuItem><MenuItem value="person">Person funds</MenuItem></TextField>
      <TextField select size="small" label="Person" value={filterPerson} onChange={e => setFilterPerson(e.target.value)}><MenuItem value="">All people</MenuItem>{people.map((p: any) => <MenuItem key={p.id} value={p.id}>{personName(p)}</MenuItem>)}</TextField>
      <TextField select size="small" label="Category" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}><MenuItem value="">All categories</MenuItem>{CATEGORIES.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}</TextField>
      {(filterSource || filterCategory || filterPerson) && <Button className="expenses-button expenses-button--quiet" onClick={() => { setFilterSource(''); setFilterCategory(''); setFilterPerson('') }}>Clear filters</Button>}
    </Box>
    <LedgerTable expenses={expenses} onEdit={onEdit} onVoid={onVoid} canManage={canManage} />
  </Box>
}

function LedgerTable({ expenses, onEdit, onVoid, canManage }: any) {
  const empty = <Box className="expenses-empty"><Typography className="expenses-empty__title">No expenses match these filters</Typography><Typography className="expenses-empty__copy">Try clearing a filter, or add the first expense for this period.</Typography></Box>
  return <>
    <TableContainer component={Paper} className="expenses-table-wrap expenses-table-wrap--ledger"><Table className="expenses-table" size="small" aria-label="Spending ledger"><TableHead><TableRow>{['Date', 'Source', 'Account', 'Category', 'Description', 'Amount', 'Added by', ''].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead><TableBody>{expenses.length === 0 ? <TableRow><TableCell colSpan={8}>{empty}</TableCell></TableRow> : expenses.map((e: any) => <TableRow key={e.id} hover sx={e.is_voided ? { opacity: 0.5 } : undefined}><TableCell>{new Date(e.incurred_date).toLocaleDateString('en-GB')}</TableCell><TableCell><Chip size="small" label={SOURCE_LABELS[e.money_source] || 'Person funds'} variant="outlined" /></TableCell><TableCell>{e.money_source === 'house' ? e.location_name || 'House funds' : e.person_name || 'Person funds'}</TableCell><TableCell><Chip size="small" label={e.category} variant="outlined" /></TableCell><TableCell>{e.description || '—'}{e.is_voided && <Typography className="expenses-status-copy" display="block">Voided: {e.void_reason || 'No reason recorded'}</Typography>}</TableCell><TableCell className="expenses-table__amount" sx={e.is_voided ? { textDecoration: 'line-through' } : undefined}>{money(e.amount_pence)}</TableCell><TableCell>{e.created_by_name || '—'}</TableCell><TableCell><Box className="expenses-table__actions">{canManage && !e.is_voided && <><IconButton size="small" aria-label="Edit entry" title="Edit description or category" onClick={() => onEdit(e.id)}><EditIcon fontSize="small" /></IconButton><IconButton size="small" color="warning" aria-label="Void entry" title="Void entry" onClick={() => onVoid(e.id)}><VoidIcon fontSize="small" /></IconButton></>}</Box></TableCell></TableRow>)}</TableBody></Table></TableContainer>
    <Paper className="expenses-panel expenses-mobile-list">{expenses.length === 0 ? empty : expenses.map((e: any) => <Box className="expenses-mobile-row" key={e.id}><Box className="expenses-mobile-row__top"><Box sx={{ minWidth: 0 }}><Typography className="expenses-mobile-row__primary">{e.description || 'Untitled expense'}</Typography><Typography className="expenses-mobile-row__secondary">{new Date(e.incurred_date).toLocaleDateString('en-GB')} · {e.money_source === 'house' ? e.location_name || 'House funds' : e.person_name || 'Person funds'}</Typography></Box><Typography className="expenses-table__amount">{money(e.amount_pence)}</Typography></Box><Box className="expenses-mobile-row__bottom"><Chip size="small" label={e.is_voided ? 'Voided' : e.category} variant="outlined" />{canManage && !e.is_voided && <Box className="expenses-table__actions"><IconButton size="small" aria-label="Edit entry" onClick={() => onEdit(e.id)}><EditIcon fontSize="small" /></IconButton><IconButton size="small" color="warning" aria-label="Void entry" onClick={() => onVoid(e.id)}><VoidIcon fontSize="small" /></IconButton></Box>}</Box></Box>)}</Paper>
  </>
}

function PettyCashTab({ balances, transactions, reconciliations, currentUserId, onTopUp, onReconcile, onReview, reviewingId, setRejectingId, onDownload, reportLoading }: any) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const visible = balances.filter((b: any) => (filter === 'all' || b.money_source === filter) && (!search || (b.money_source === 'person' ? b.person_name : b.location_name)?.toLowerCase().includes(search.toLowerCase())))
  const pendingForMe = reconciliations.filter((r: any) => r.status === 'pending' && r.handed_over_to === currentUserId)
  return <Box>
    <Box className="expenses-section-heading"><Box><Typography component="h2" className="expenses-section-heading__title">Petty cash</Typography><Typography className="expenses-section-heading__copy">Balances change only after an independent staff member approves a reconciliation.</Typography></Box><Box className="expenses-actions"><Button className="expenses-button expenses-button--quiet" variant="outlined" startIcon={<WalletIcon />} onClick={onTopUp}>Top up</Button><Button className="expenses-button expenses-button--quiet" variant="outlined" onClick={onReconcile}>Request reconciliation</Button><Button className="expenses-button expenses-button--quiet" variant="outlined" startIcon={<DownloadIcon />} onClick={onDownload} disabled={reportLoading}>{reportLoading ? 'Preparing…' : 'CSV report'}</Button></Box></Box>
    <Box className="expenses-attention" role="status"><Box><Typography className="expenses-attention__title">Maker-checker control</Typography><Typography className="expenses-attention__copy">A reconciliation is pending until the assigned second staff member accepts it. Rejected requests do not change the balance.</Typography></Box><Typography className="expenses-status-copy">{pendingForMe.length} awaiting your review</Typography></Box>
    <Box className="expenses-filter-bar"><TextField size="small" label="Find an account" placeholder="Location or person" value={search} onChange={e => setSearch(e.target.value)} InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} /> }} /><TextField select size="small" label="Account type" value={filter} onChange={e => setFilter(e.target.value)}><MenuItem value="all">All accounts</MenuItem><MenuItem value="house">House funds</MenuItem><MenuItem value="person">Person funds</MenuItem></TextField><Typography className="expenses-status-copy">{visible.length} of {balances.length} accounts</Typography></Box>
    <TableContainer component={Paper} className="expenses-table-wrap"><Table className="expenses-table" size="small" aria-label="Petty cash accounts"><TableHead><TableRow>{['Account', 'Type', 'Available balance', 'Last reconciled'].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead><TableBody>{visible.length === 0 ? <TableRow><TableCell colSpan={4}><Box className="expenses-empty"><Typography className="expenses-empty__title">No accounts found</Typography><Typography className="expenses-empty__copy">Try a different search or account type.</Typography></Box></TableCell></TableRow> : visible.map((b: any) => <TableRow key={`${b.money_source}-${b.id}`} hover><TableCell><Typography fontWeight={700}>{b.money_source === 'person' ? b.person_name : b.location_name}</Typography></TableCell><TableCell><Chip size="small" label={b.money_source === 'person' ? 'Person funds' : 'House funds'} variant="outlined" /></TableCell><TableCell className="expenses-table__amount">{money(b.current_balance_pence)}</TableCell><TableCell>{b.last_reconciled_at ? new Date(b.last_reconciled_at).toLocaleDateString('en-GB') : 'Not reconciled'}</TableCell></TableRow>)}</TableBody></Table></TableContainer>
    <Box className="expenses-section-heading" sx={{ mt: 5 }}><Box><Typography component="h2" className="expenses-section-heading__title">Reconciliation review</Typography><Typography className="expenses-section-heading__copy">Review the recorded count before it changes the account balance.</Typography></Box></Box>
    <TableContainer component={Paper} className="expenses-table-wrap"><Table className="expenses-table" size="small" aria-label="Petty cash reconciliation requests"><TableHead><TableRow>{['Date', 'Account', 'Expected', 'Counted', 'Variance', 'Requested by', 'Reviewer', 'Status', ''].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead><TableBody>{reconciliations.length === 0 ? <TableRow><TableCell colSpan={9}><Box className="expenses-empty"><Typography className="expenses-empty__title">No reconciliation requests</Typography><Typography className="expenses-empty__copy">New requests will appear here for an independent review.</Typography></Box></TableCell></TableRow> : reconciliations.map((r: any) => <TableRow key={r.id} hover><TableCell>{new Date(r.created_at).toLocaleString('en-GB')}</TableCell><TableCell>{r.money_source === 'person' ? r.person_name : r.location_name}</TableCell><TableCell className="expenses-table__amount">{money(r.expected_balance_pence)}</TableCell><TableCell className="expenses-table__amount">{money(r.actual_balance_pence)}</TableCell><TableCell className="expenses-table__amount">{money(r.variance_pence)}</TableCell><TableCell>{r.requested_by_name || '—'}</TableCell><TableCell>{r.handed_over_to_name || '—'}</TableCell><TableCell><Chip size="small" label={r.status === 'pending' ? 'Awaiting review' : r.status === 'accepted' ? 'Accepted' : 'Rejected'} color={r.status === 'accepted' ? 'success' : r.status === 'rejected' ? 'error' : 'warning'} variant="outlined" />{r.rejection_reason && <Typography className="expenses-status-copy" display="block">{r.rejection_reason}</Typography>}</TableCell><TableCell>{r.status === 'pending' && r.handed_over_to === currentUserId && <Box className="expenses-table__actions"><Button size="small" variant="contained" color="success" disabled={reviewingId === r.id} onClick={() => onReview(r.id, 'accepted')}>{reviewingId === r.id ? <CircularProgress size={16} color="inherit" /> : 'Accept'}</Button><Button size="small" variant="outlined" color="error" disabled={reviewingId === r.id} onClick={() => setRejectingId(r.id)}>Reject</Button></Box>}</TableCell></TableRow>)}</TableBody></Table></TableContainer>
    <Box className="expenses-section-heading" sx={{ mt: 5 }}><Box><Typography component="h2" className="expenses-section-heading__title">Transaction history</Typography><Typography className="expenses-section-heading__copy">Top-ups and accepted reconciliations remain listed in time order.</Typography></Box></Box>
    <TableContainer component={Paper} className="expenses-table-wrap"><Table className="expenses-table" size="small" aria-label="Petty cash transaction history"><TableHead><TableRow>{['Date', 'Account', 'Type', 'Change', 'Balance after', 'Notes'].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead><TableBody>{transactions.length === 0 ? <TableRow><TableCell colSpan={6}><Box className="expenses-empty"><Typography className="expenses-empty__title">No cash movements yet</Typography></Box></TableCell></TableRow> : transactions.map((t: any) => <TableRow key={t.id} hover><TableCell>{new Date(t.created_at).toLocaleString('en-GB')}</TableCell><TableCell>{t.money_source === 'person' ? t.person_name : t.location_name}</TableCell><TableCell><Chip size="small" label={String(t.type).replace('_', ' ')} variant="outlined" /></TableCell><TableCell className="expenses-table__amount">{money(t.amount_pence)}</TableCell><TableCell className="expenses-table__amount">{money(t.new_balance_pence)}</TableCell><TableCell>{t.notes || '—'}</TableCell></TableRow>)}</TableBody></Table></TableContainer>
  </Box>
}

function CashChecksTab({ cashChecks, reconciliations, currentUserId, onNewCheck, onAccept, acceptingId, canCreate, onReview, reviewingId, setRejectingId }: any) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const filtered = useMemo(() => cashChecks.filter((c: any) => { const q = search.toLowerCase(); return !q || [c.location_name, c.person_name, c.counted_by_name, c.handed_over_to_name, c.notes].some(v => String(v || '').toLowerCase().includes(q)) }), [cashChecks, search])
  const pages = Math.ceil(filtered.length / CHECKS_PER_PAGE)
  const visible = filtered.slice(page * CHECKS_PER_PAGE, (page + 1) * CHECKS_PER_PAGE)
  useEffect(() => setPage(0), [search])
  return <Box>
    {reconciliations?.some((r: any) => r.status === 'pending' && r.handed_over_to === currentUserId) && <>
      <Box className="expenses-section-heading"><Box><Typography component="h2" className="expenses-section-heading__title">Reconciliation review</Typography><Typography className="expenses-section-heading__copy">Review the count before the account balance is changed.</Typography></Box></Box>
      <TableContainer component={Paper} className="expenses-table-wrap"><Table className="expenses-table" size="small" aria-label="Assigned reconciliation reviews"><TableHead><TableRow>{['Date', 'Account', 'Expected', 'Counted', 'Variance', 'Requested by', ''].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead><TableBody>{reconciliations.filter((r: any) => r.status === 'pending' && r.handed_over_to === currentUserId).map((r: any) => <TableRow key={r.id}><TableCell>{new Date(r.created_at).toLocaleString('en-GB')}</TableCell><TableCell>{r.money_source === 'person' ? r.person_name : r.location_name}</TableCell><TableCell className="expenses-table__amount">{money(r.expected_balance_pence)}</TableCell><TableCell className="expenses-table__amount">{money(r.actual_balance_pence)}</TableCell><TableCell className="expenses-table__amount">{money(r.variance_pence)}</TableCell><TableCell>{r.requested_by_name || '—'}</TableCell><TableCell><Box className="expenses-table__actions"><Button size="small" variant="contained" color="success" disabled={reviewingId === r.id} onClick={() => onReview(r.id, 'accepted')}>{reviewingId === r.id ? <CircularProgress size={16} color="inherit" /> : 'Accept'}</Button><Button size="small" variant="outlined" color="error" disabled={reviewingId === r.id} onClick={() => setRejectingId(r.id)}>Reject</Button></Box></TableCell></TableRow>)}</TableBody></Table></TableContainer>
    </>}
    <Box className="expenses-section-heading"><Box><Typography component="h2" className="expenses-section-heading__title">Daily cash checks</Typography><Typography className="expenses-section-heading__copy">A check is complete only after the named second staff member accepts it.</Typography></Box>{canCreate && <Button className="expenses-button expenses-button--primary" variant="contained" startIcon={<CheckCircleIcon />} onClick={onNewCheck}>Record a check</Button>}</Box>
    <Box className="expenses-attention"><Box><Typography className="expenses-attention__title">Two-person control</Typography><Typography className="expenses-attention__copy">The person who counts the cash cannot approve their own count. Pending checks stay visible until the assigned confirmer accepts them.</Typography></Box><Typography className="expenses-status-copy">{filtered.length} of {cashChecks.length} checks</Typography></Box>
    <Box className="expenses-filter-bar"><TextField size="small" label="Search checks" placeholder="Account, staff member, or note" value={search} onChange={e => setSearch(e.target.value)} InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} /> }} /><Box /><Typography className="expenses-status-copy">Page {pages ? page + 1 : 0} of {pages}</Typography></Box>
    <TableContainer component={Paper} className="expenses-table-wrap expenses-table-wrap--checks"><Table className="expenses-table" size="small" aria-label="Daily cash checks"><TableHead><TableRow>{['Date', 'Account', 'Expected', 'Physical', 'Variance', 'Counted by', 'Handed over to', 'Status', ''].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead><TableBody>{visible.length === 0 ? <TableRow><TableCell colSpan={9}><Box className="expenses-empty"><Typography className="expenses-empty__title">No cash checks found</Typography><Typography className="expenses-empty__copy">New checks will appear here with their acceptance history.</Typography></Box></TableCell></TableRow> : visible.map((c: any) => <TableRow key={c.id} hover><TableCell>{new Date(c.check_date).toLocaleDateString('en-GB')}</TableCell><TableCell>{c.money_source === 'house' ? c.location_name : c.person_name}</TableCell><TableCell className="expenses-table__amount">{money(c.expected_balance_pence)}</TableCell><TableCell className="expenses-table__amount">{money(c.physical_balance_pence)}</TableCell><TableCell className="expenses-table__amount">{money(c.variance_pence)}</TableCell><TableCell>{c.counted_by_name || '—'}</TableCell><TableCell>{c.handed_over_to_name || '—'}</TableCell><TableCell>{c.accepted_at ? <><Chip size="small" label="Accepted" color="success" variant="outlined" /><Typography className="expenses-status-copy" display="block">{c.accepted_by_name} · {new Date(c.accepted_at).toLocaleString('en-GB')}</Typography></> : <Chip size="small" label="Awaiting acceptance" color="warning" variant="outlined" />}</TableCell><TableCell>{!c.accepted_at && c.handed_over_to === currentUserId && <Button size="small" variant="contained" color="success" startIcon={<CheckCircleIcon />} disabled={acceptingId === c.id} onClick={() => onAccept(c.id)}>{acceptingId === c.id ? <CircularProgress size={16} color="inherit" /> : 'Accept'}</Button>}</TableCell></TableRow>)}</TableBody></Table></TableContainer>
    <Paper className="expenses-panel expenses-mobile-list">{visible.length === 0 ? <Box className="expenses-empty"><Typography className="expenses-empty__title">No cash checks found</Typography></Box> : visible.map((c: any) => <Box className="expenses-mobile-row" key={c.id}><Box className="expenses-mobile-row__top"><Box sx={{ minWidth: 0 }}><Typography className="expenses-mobile-row__primary">{c.money_source === 'house' ? c.location_name : c.person_name}</Typography><Typography className="expenses-mobile-row__secondary">{new Date(c.check_date).toLocaleDateString('en-GB')} · Counted by {c.counted_by_name || '—'}</Typography></Box>{c.accepted_at ? <Chip size="small" label="Accepted" color="success" variant="outlined" /> : <Chip size="small" label="Pending" color="warning" variant="outlined" />}</Box><Box className="expenses-mobile-row__bottom"><Typography className="expenses-status-copy">Expected {money(c.expected_balance_pence)} · Physical {money(c.physical_balance_pence)}</Typography>{!c.accepted_at && c.handed_over_to === currentUserId && <Button size="small" variant="contained" color="success" onClick={() => onAccept(c.id)} disabled={acceptingId === c.id}>{acceptingId === c.id ? 'Saving…' : 'Accept count'}</Button>}</Box></Box>)}</Paper>
    {pages > 1 && <Stack direction="row" justifyContent="center" spacing={2} mt={2}><Button className="expenses-button expenses-button--quiet" size="small" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button><Button className="expenses-button expenses-button--quiet" size="small" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}>Next</Button></Stack>}
  </Box>
}

function ExpenseForm({ people, locations, onSubmit, onCancel, isLoading }: any) {
  const [source, setSource] = useState('person'); const [personId, setPersonId] = useState(''); const [locationId, setLocationId] = useState(''); const [category, setCategory] = useState('food'); const [amount, setAmount] = useState(0); const [description, setDescription] = useState(''); const [paymentMethod, setPaymentMethod] = useState('cash'); const [date, setDate] = useState(today())
  return <><DialogContent><Alert className="expenses-dialog__hint" severity="info">Enter the transaction once. The account, amount, date, and payment method cannot be changed afterwards.</Alert><Stack spacing={2}><TextField select label="Money source" fullWidth value={source} onChange={e => { setSource(e.target.value); setPersonId(''); setLocationId('') }}><MenuItem value="person">Person funds</MenuItem><MenuItem value="house">House funds</MenuItem></TextField>{source === 'person' ? <TextField select label="Person" fullWidth required value={personId} onChange={e => setPersonId(e.target.value)}><MenuItem value="">Select person</MenuItem>{people.map((p: any) => <MenuItem key={p.id} value={p.id}>{personName(p)}</MenuItem>)}</TextField> : <TextField select label="Location" fullWidth required value={locationId} onChange={e => setLocationId(e.target.value)}><MenuItem value="">Select house location</MenuItem>{locations.map((l: any) => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}</TextField>}<TextField select label="Category" fullWidth value={category} onChange={e => setCategory(e.target.value)}>{CATEGORIES.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}</TextField><TextField select label="Payment method" fullWidth value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}><MenuItem value="cash">Cash</MenuItem><MenuItem value="card">Card</MenuItem><MenuItem value="bank_transfer">Bank transfer</MenuItem><MenuItem value="direct_debit">Direct debit</MenuItem></TextField><TextField label="Amount (£)" type="number" fullWidth value={amount || ''} onChange={e => setAmount(Number(e.target.value) || 0)} inputProps={{ min: 0.01, step: 0.01 }} /><TextField label="Description / reason" fullWidth multiline rows={2} value={description} onChange={e => setDescription(e.target.value)} /><TextField label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={date} onChange={e => setDate(e.target.value)} /></Stack></DialogContent><DialogActions><Button onClick={onCancel}>Cancel</Button><Button className="expenses-button expenses-button--primary" variant="contained" disabled={!amount || !date || (source === 'person' ? !personId : !locationId) || isLoading} onClick={() => onSubmit({ personId: source === 'person' ? personId : null, locationId: source === 'house' ? locationId : undefined, moneySource: source, paymentMethod, category, amountPence: Math.round(amount * 100), description, incurredDate: date })}>{isLoading ? <CircularProgress size={20} /> : 'Add expense'}</Button></DialogActions></>
}

function EditExpenseForm({ expense, onSubmit, onCancel, isLoading }: any) {
  const [category, setCategory] = useState(expense?.category || 'food'); const [description, setDescription] = useState(expense?.description || '')
  return <><DialogContent><Alert className="expenses-dialog__hint" severity="info">Only the description and category can be edited. The original financial details remain part of the audit record.</Alert><Stack spacing={2}><TextField select label="Category" fullWidth value={category} onChange={e => setCategory(e.target.value)}>{CATEGORIES.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}</TextField><TextField label="Description" fullWidth multiline rows={3} value={description} onChange={e => setDescription(e.target.value)} /></Stack></DialogContent><DialogActions><Button onClick={onCancel}>Cancel</Button><Button className="expenses-button expenses-button--primary" variant="contained" disabled={isLoading} onClick={() => onSubmit({ category, description })}>{isLoading ? <CircularProgress size={20} /> : 'Save changes'}</Button></DialogActions></>
}

function PettyCashDialog({ open, title, locations, people, balances, staffMembers = [], currentUser = {}, onClose, onSubmit, kind, isLoading }: any) {
  const [source, setSource] = useState('house'); const [locationId, setLocationId] = useState(''); const [personId, setPersonId] = useState(''); const [amount, setAmount] = useState(0); const [expected, setExpected] = useState(0); const [notes, setNotes] = useState(''); const [date, setDate] = useState(today()); const [escalate, setEscalate] = useState(false); const [escalationReason, setEscalationReason] = useState(''); const [handedOverTo, setHandedOverTo] = useState('')
  const isCheck = kind === 'daily_check'
  const isReconcile = kind === 'reconcile'
  const selectedBalance = useMemo(() => { if (!balances || (!isCheck && !isReconcile && kind !== 'top_up')) return 0; const id = source === 'house' ? locationId : personId; const match = balances.find((b: any) => b.money_source === source && (source === 'house' ? b.location_id : b.person_id) === id); return Number(match?.current_balance_pence || 0) / 100 }, [balances, isCheck, isReconcile, kind, source, locationId, personId])
  useEffect(() => { if (open) { setSource('house'); setLocationId(''); setPersonId(''); setAmount(0); setExpected(0); setNotes(''); setDate(today()); setEscalate(false); setEscalationReason(''); setHandedOverTo('') } }, [open])
  useEffect(() => { if (isCheck || isReconcile) setExpected(selectedBalance) }, [isCheck, isReconcile, selectedBalance])
  const variance = amount - expected; const hasVariance = (isCheck || isReconcile) && amount > 0 && Math.abs(variance) > 0.001
  const hasSelectedAccount = source === 'house' ? Boolean(locationId) : Boolean(personId)
  const projectedBalance = selectedBalance + Math.max(amount, 0)
  return <Dialog className="expenses-dialog" open={open} onClose={onClose} maxWidth="sm" fullWidth><DialogTitle>{title}</DialogTitle><DialogContent><Stack spacing={2}><TextField select label="Cash belongs to" fullWidth value={source} onChange={e => { setSource(e.target.value); setLocationId(''); setPersonId('') }}><MenuItem value="house">House</MenuItem><MenuItem value="person">Person</MenuItem></TextField>{source === 'house' ? <TextField select label="Location" fullWidth value={locationId} onChange={e => setLocationId(e.target.value)}><MenuItem value="">Select location</MenuItem>{locations.map((l: any) => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}</TextField> : <TextField select label="Person" fullWidth value={personId} onChange={e => setPersonId(e.target.value)}><MenuItem value="">Select person</MenuItem>{people.map((p: any) => <MenuItem key={p.id} value={p.id}>{personName(p)}</MenuItem>)}</TextField>}{isCheck && <><TextField label="Check date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={date} onChange={e => setDate(e.target.value)} /><TextField className="expenses-field--readonly" label="Counted by" fullWidth value={personName(currentUser)} InputProps={{ readOnly: true }} helperText="Taken from your signed-in account." /><TextField select label="Handed over to" fullWidth required value={handedOverTo} onChange={e => setHandedOverTo(e.target.value)} helperText="A different active staff member must accept this count."><MenuItem value="">Select confirming staff member</MenuItem>{staffMembers.filter((s: any) => s.id !== (currentUser.id || currentUser.userId)).map((s: any) => <MenuItem key={s.id} value={s.id}>{personName(s)}</MenuItem>)}</TextField></>}{isReconcile && <TextField select label="Reviewed by" fullWidth required value={handedOverTo} onChange={e => setHandedOverTo(e.target.value)} helperText="A different active staff member must approve or reject this reconciliation."><MenuItem value="">Select reviewing staff member</MenuItem>{staffMembers.filter((s: any) => s.id !== (currentUser.id || currentUser.userId)).map((s: any) => <MenuItem key={s.id} value={s.id}>{personName(s)}</MenuItem>)}</TextField>}{isCheck || isReconcile ? <><TextField className="expenses-field--readonly" label="Expected balance (£)" type="number" fullWidth value={expected.toFixed(2)} InputProps={{ readOnly: true }} /><TextField label={isCheck ? 'Physical cash in money tin (£)' : 'Counted balance (£)'} type="number" fullWidth value={amount || ''} onChange={e => setAmount(Number(e.target.value) || 0)} inputProps={{ min: 0, step: 0.01 }} /></> : <>{kind === 'top_up' && hasSelectedAccount && <Box className="expenses-balance-preview" aria-live="polite"><Box><Typography className="expenses-balance-preview__label">Current balance</Typography><Typography className="expenses-balance-preview__value">{money(Math.round(selectedBalance * 100))}</Typography></Box><Typography className="expenses-balance-preview__plus">+</Typography><Box><Typography className="expenses-balance-preview__label">Top-up amount</Typography><Typography className="expenses-balance-preview__value">{money(Math.round(Math.max(amount, 0) * 100))}</Typography></Box><Box className="expenses-balance-preview__result"><Typography className="expenses-balance-preview__label">Balance after top-up</Typography><Typography className="expenses-balance-preview__value">{money(Math.round(projectedBalance * 100))}</Typography></Box></Box>}<TextField label={kind === 'top_up' ? 'Amount (£)' : 'Actual balance (£)'} type="number" fullWidth value={amount || ''} onChange={e => setAmount(Number(e.target.value) || 0)} inputProps={{ min: 0, step: 0.01 }} /></>}{hasVariance && <><Alert severity="warning">Variance: {money(Math.round(variance * 100))}. Record an escalation if the difference cannot be resolved.</Alert><TextField select label="Escalate to manager" fullWidth value={escalate ? 'yes' : 'no'} onChange={e => setEscalate(e.target.value === 'yes')}><MenuItem value="no">No</MenuItem><MenuItem value="yes">Yes</MenuItem></TextField>{escalate && <TextField label="Escalation reason" fullWidth multiline rows={2} value={escalationReason} onChange={e => setEscalationReason(e.target.value)} />}</>}<TextField label="Notes" fullWidth multiline rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></Stack></DialogContent><DialogActions><Button onClick={onClose}>Cancel</Button><Button className="expenses-button expenses-button--primary" variant="contained" disabled={(source === 'house' ? !locationId : !personId) || (kind === 'top_up' ? amount <= 0 : (isCheck || isReconcile) ? amount < 0 || !handedOverTo : amount < 0) || isLoading} onClick={() => onSubmit(kind === 'top_up' ? { moneySource: source, locationId: source === 'house' ? locationId : undefined, personId: source === 'person' ? personId : undefined, amountPence: Math.round(amount * 100), notes } : isCheck ? { moneySource: source, locationId: source === 'house' ? locationId : undefined, personId: source === 'person' ? personId : undefined, expectedBalancePence: Math.round(expected * 100), physicalBalancePence: Math.round(amount * 100), checkDate: date, notes, escalate, escalationReason: escalate ? escalationReason : undefined, handedOverTo } : { moneySource: source, locationId: source === 'house' ? locationId : undefined, personId: source === 'person' ? personId : undefined, actualBalancePence: Math.round(amount * 100), handedOverTo, notes })}>{isLoading ? <CircularProgress size={20} /> : kind === 'top_up' ? 'Top up cash' : isCheck ? 'Record and hand over' : 'Save reconciliation'}</Button></DialogActions></Dialog>
}
