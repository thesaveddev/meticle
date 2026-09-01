import { useMemo, useState, useEffect } from 'react'
import {
  Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Grid, IconButton, MenuItem, Paper, Stack, Tab, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Typography,
  Alert, Snackbar,
} from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, History as HistoryIcon, Receipt as ReceiptIcon, Wallet as WalletIcon, Search as SearchIcon, Block as VoidIcon } from '@mui/icons-material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'

const NAVY = '#0F4C81'
const CATEGORIES = [{ value: 'food', label: 'Food' }, { value: 'clothing', label: 'Clothing' }, { value: 'activities', label: 'Activities' }, { value: 'transport', label: 'Transport' }, { value: 'personal', label: 'Personal' }, { value: 'health', label: 'Health' }, { value: 'other', label: 'Other' }]
const SOURCE_LABELS: Record<string, string> = { house: 'House funds', person: 'Person funds' }
function asArray(value: any, keys: string[] = []): any[] { if (Array.isArray(value)) return value; for (const key of keys) if (Array.isArray(value?.[key])) return value[key]; return Array.isArray(value?.data) ? value.data : [] }
function today() { return new Date().toISOString().slice(0, 10) }

export default function ExpensesPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [voidId, setVoidId] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterPerson, setFilterPerson] = useState('')
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [reconcileOpen, setReconcileOpen] = useState(false)
  const [cashCheckOpen, setCashCheckOpen] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [pettyCashSearch, setPettyCashSearch] = useState('')
  const [pettyCashFilter, setPettyCashFilter] = useState<'all' | 'house' | 'person'>('all')
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })

  const showError = (msg: string) => setSnackbar({ open: true, message: msg, severity: 'error' })
  const showSuccess = (msg: string) => setSnackbar({ open: true, message: msg, severity: 'success' })

  // Queries
  const { data: expenseData, isLoading } = useQuery({
    queryKey: ['expenses', filterSource, filterCategory, filterPerson],
    queryFn: () => api.get('/expenses', { params: { moneySource: filterSource || undefined, category: filterCategory || undefined, personId: filterPerson || undefined } }).then(r => r.data),
  })
  const expenses = asArray(expenseData)

  const { data: stats } = useQuery({ queryKey: ['expense-stats'], queryFn: () => api.get('/expenses/stats').then(r => r.data) })

  const { data: peopleData } = useQuery({ queryKey: ['people-expenses'], queryFn: () => api.get('/people?limit=200').then(r => r.data) })
  const people = asArray(peopleData, ['people'])

  const { data: balancesData } = useQuery({ queryKey: ['petty-cash-balances'], queryFn: () => api.get('/expenses/petty-cash/balances').then(r => r.data) })
  const balances = asArray(balancesData, ['balances'])

  const { data: transactionData } = useQuery({ queryKey: ['petty-cash-transactions'], queryFn: () => api.get('/expenses/petty-cash/transactions').then(r => r.data) })
  const transactions = asArray(transactionData, ['transactions'])

  const { data: cashCheckData } = useQuery({ queryKey: ['cash-balance-checks'], queryFn: () => api.get('/expenses/petty-cash/daily-checks').then(r => r.data) })
  const cashChecks = asArray(cashCheckData, ['checks'])

  const { data: locationsData } = useQuery({ queryKey: ['locations'], queryFn: () => api.get('/settings/locations').then(r => r.data) })
  const locations = asArray(locationsData, ['locations'])

  // Mutations with error feedback
  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/expenses', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['expense-stats'] }); setCreateOpen(false); showSuccess('Expense added') },
    onError: (e: any) => showError(e.response?.data?.error || 'Failed to add expense'),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => api.patch(`/expenses/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['expense-stats'] }); setEditId(null); showSuccess('Entry updated') },
    onError: (e: any) => showError(e.response?.data?.error || 'Failed to update entry'),
  })
  const voidMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.put(`/expenses/${id}/void`, { reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['expense-stats'] }); setVoidId(null); setVoidReason(''); showSuccess('Entry voided') },
    onError: (e: any) => showError(e.response?.data?.error || 'Failed to void entry'),
  })
  const topUpMutation = useMutation({
    mutationFn: (data: any) => api.post('/expenses/petty-cash/top-up', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['petty-cash-balances'] }); qc.invalidateQueries({ queryKey: ['petty-cash-transactions'] }); qc.invalidateQueries({ queryKey: ['expense-stats'] }); setTopUpOpen(false); showSuccess('Cash topped up') },
    onError: (e: any) => showError(e.response?.data?.error || 'Failed to top up cash'),
  })
  const reconcileMutation = useMutation({
    mutationFn: (data: any) => api.post('/expenses/petty-cash/reconcile', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['petty-cash-balances'] }); qc.invalidateQueries({ queryKey: ['petty-cash-transactions'] }); setReconcileOpen(false); showSuccess('Cash reconciled') },
    onError: (e: any) => showError(e.response?.data?.error || 'Failed to reconcile cash'),
  })
  const dailyCheckMutation = useMutation({
    mutationFn: (data: any) => api.post('/expenses/petty-cash/daily-check', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash-balance-checks'] }); setCashCheckOpen(false); showSuccess('Cash check saved') },
    onError: (e: any) => showError(e.response?.data?.error || 'Failed to save cash check'),
  })

  // Summary computations
  const pettyCashTotals = useMemo(() => {
    const house = balances.filter((b: any) => b.money_source === 'house').reduce((s: number, b: any) => s + Number(b.current_balance_pence || 0), 0)
    const person = balances.filter((b: any) => b.money_source === 'person').reduce((s: number, b: any) => s + Number(b.current_balance_pence || 0), 0)
    return { house, person, total: house + person, count: balances.length }
  }, [balances])

  const totalHouseSpent = useMemo(() => expenses.filter((e: any) => e.money_source === 'house').reduce((sum: number, e: any) => sum + Number(e.amount_pence || 0), 0), [expenses])
  const totalPersonSpent = useMemo(() => expenses.filter((e: any) => e.money_source !== 'house').reduce((sum: number, e: any) => sum + Number(e.amount_pence || 0), 0), [expenses])

  const filteredBalances = useMemo(() => {
    let result = balances
    if (pettyCashFilter !== 'all') result = result.filter((b: any) => b.money_source === pettyCashFilter)
    if (pettyCashSearch) {
      const q = pettyCashSearch.toLowerCase()
      result = result.filter((b: any) => {
        const name = b.money_source === 'person' ? b.person_name : b.location_name
        return name?.toLowerCase().includes(q)
      })
    }
    return result
  }, [balances, pettyCashFilter, pettyCashSearch])

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress sx={{ color: NAVY }} /></Box>

  return (
    <Box>
      {/* Header */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={2} mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={800}>Expenses</Typography>
          <Typography variant="body2" color="text.secondary">Track spending, petty cash balances, and reconcile funds across locations and people.</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<WalletIcon />} onClick={() => setTopUpOpen(true)} sx={{ textTransform: 'none' }}>Top up</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)} sx={{ bgcolor: NAVY, textTransform: 'none' }}>Add expense</Button>
        </Stack>
      </Stack>

      {/* Top bar */}
      <Grid container spacing={2} mb={3}>
        {[
          { label: 'Total ledger', value: `£${(stats?.total_amount_pounds || 0).toLocaleString()}`, sub: `${stats?.total_expenses || 0} entries` },
          { label: 'House funds', value: `£${(pettyCashTotals.house / 100).toFixed(2)}`, sub: `Spent: £${(totalHouseSpent / 100).toFixed(2)}` },
          { label: 'Person funds', value: `£${(pettyCashTotals.person / 100).toFixed(2)}`, sub: `Spent: £${(totalPersonSpent / 100).toFixed(2)}` },
          { label: 'Cash accounts', value: String(pettyCashTotals.count), sub: `${pettyCashTotals.count} locations/people` },
        ].map((card) => (
          <Grid item xs={12} sm={6} md={3} key={card.label}>
            <Card sx={{ border: '1px solid #E5E7EB', boxShadow: 'none' }}>
              <CardContent>
                <Typography variant="caption" color="text.secondary">{card.label}</Typography>
                <Typography variant="h5" fontWeight={800}>{card.value}</Typography>
                <Typography variant="caption" color="text.secondary">{card.sub}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: '1px solid #E5E7EB' }}>
        <Tab icon={<ReceiptIcon />} iconPosition="start" label="Spending ledger" sx={{ textTransform: 'none' }} />
        <Tab icon={<WalletIcon />} iconPosition="start" label="Petty cash" sx={{ textTransform: 'none' }} />
        <Tab icon={<HistoryIcon />} iconPosition="start" label="Cash checks" sx={{ textTransform: 'none' }} />
      </Tabs>

      {/* Tab 0: Spending ledger */}
      {tab === 0 && (
        <Box sx={{ pt: 2 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Entries cannot be deleted. Managers may void entries with a reason, or edit the description and category only.
          </Alert>

          <Paper sx={{ p: 1.5, mb: 2, border: '1px solid #E5E7EB' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField select size="small" label="Money source" value={filterSource} onChange={e => setFilterSource(e.target.value)} sx={{ minWidth: 170 }}>
                <MenuItem value="">All sources</MenuItem>
                <MenuItem value="house">House funds</MenuItem>
                <MenuItem value="person">Person funds</MenuItem>
              </TextField>
              <TextField select size="small" label="Person" value={filterPerson} onChange={e => setFilterPerson(e.target.value)} sx={{ minWidth: 200 }}>
                <MenuItem value="">All people</MenuItem>
                {people.map((p: any) => <MenuItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</MenuItem>)}
              </TextField>
              <TextField select size="small" label="Category" value={filterCategory} onChange={e => setFilterCategory(e.target.value)} sx={{ minWidth: 150 }}>
                <MenuItem value="">All categories</MenuItem>
                {CATEGORIES.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
              </TextField>
            </Stack>
          </Paper>

          <TableContainer component={Paper} sx={{ border: '1px solid #E5E7EB' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['Date', 'Source', 'Person', 'Category', 'Description', 'Amount', 'Added by', ''].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 800, color: 'text.secondary' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {expenses.length === 0 ? (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py: 6, color: '#9CA3AF' }}>No expenses recorded.</TableCell></TableRow>
                ) : expenses.map((e: any) => (
                  <TableRow key={e.id} hover sx={e.is_voided ? { opacity: 0.5 } : {}}>
                    <TableCell>{new Date(e.incurred_date).toLocaleDateString('en-GB')}</TableCell>
                    <TableCell>
                      <Chip size="small" label={SOURCE_LABELS[e.money_source] || 'Person funds'} color={e.money_source === 'house' ? 'info' : 'default'} />
                      {e.is_voided && <Chip size="small" label="VOID" color="error" sx={{ ml: 0.5 }} />}
                    </TableCell>
                    <TableCell>{e.money_source === 'house' ? '\u2014' : e.person_name || '\u2014'}</TableCell>
                    <TableCell><Chip label={e.category} size="small" /></TableCell>
                    <TableCell>
                      {e.description || '\u2014'}
                      {e.is_voided && e.void_reason && (
                        <Typography variant="caption" display="block" color="error.main" sx={{ mt: 0.5 }}>
                          Void reason: {e.void_reason}
                          {e.voided_by_name && ` \u2014 by ${e.voided_by_name}`}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={e.is_voided ? { textDecoration: 'line-through' } : {}}>
                      {'\u00A3'}{(Number(e.amount_pence || 0) / 100).toFixed(2)}
                    </TableCell>
                    <TableCell>{e.created_by_name || '\u2014'}</TableCell>
                    <TableCell>
                      {!e.is_voided && (
                        <>
                          <IconButton size="small" onClick={() => setEditId(e.id)} title="Edit description or category">
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="warning" onClick={() => { setVoidId(e.id); setVoidReason('') }} title="Void this entry">
                            <VoidIcon fontSize="small" />
                          </IconButton>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Tab 1: Petty cash */}
      {tab === 1 && (
        <Box sx={{ pt: 2 }}>
          <Stack direction="row" spacing={1} mb={2}>
            <Button variant="outlined" startIcon={<WalletIcon />} onClick={() => setTopUpOpen(true)}>Top up</Button>
            <Button variant="outlined" startIcon={<HistoryIcon />} onClick={() => setReconcileOpen(true)}>Reconcile</Button>
            <Button variant="outlined" onClick={async () => {
              setReportLoading(true)
              try {
                const r = await api.get('/expenses/report')
                const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' })
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `expenses-report-${today()}.json`; a.click(); URL.revokeObjectURL(a.href)
              } catch { showError('Failed to download report') }
              finally { setReportLoading(false) }
            }} disabled={reportLoading}>Download report</Button>
          </Stack>

          <Paper sx={{ p: 2, mb: 2, border: '1px solid #E5E7EB' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
              <Box><Typography variant="caption" color="text.secondary">House cash in tins</Typography><Typography variant="h6" fontWeight={800} color="info.main">{'\u00A3'}{(pettyCashTotals.house / 100).toFixed(2)}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Person cash on hand</Typography><Typography variant="h6" fontWeight={800}>{'\u00A3'}{(pettyCashTotals.person / 100).toFixed(2)}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Total cash managed</Typography><Typography variant="h6" fontWeight={800}>{'\u00A3'}{(pettyCashTotals.total / 100).toFixed(2)}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Accounts</Typography><Typography variant="h6" fontWeight={800}>{pettyCashTotals.count}</Typography></Box>
            </Stack>
          </Paper>

          <Paper sx={{ p: 1.5, mb: 2, border: '1px solid #E5E7EB' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField size="small" placeholder="Search by name..." value={pettyCashSearch} onChange={e => setPettyCashSearch(e.target.value)}
                InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} /> }} sx={{ minWidth: 250 }} />
              <TextField select size="small" label="Show" value={pettyCashFilter} onChange={e => setPettyCashFilter(e.target.value as any)} sx={{ minWidth: 150 }}>
                <MenuItem value="all">All accounts</MenuItem>
                <MenuItem value="house">House only</MenuItem>
                <MenuItem value="person">Person only</MenuItem>
              </TextField>
              <Box sx={{ flexGrow: 1 }} />
              <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>{filteredBalances.length} of {balances.length} accounts</Typography>
            </Stack>
          </Paper>

          <TableContainer component={Paper} sx={{ border: '1px solid #E5E7EB', mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>Account</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>Type</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: 'text.secondary' }}>Balance</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>Last reconciled</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredBalances.length === 0 ? (
                  <TableRow><TableCell colSpan={4} align="center" sx={{ py: 6, color: '#9CA3AF' }}>No accounts found.</TableCell></TableRow>
                ) : filteredBalances.map((b: any) => (
                  <TableRow key={`${b.money_source}-${b.id}`} hover>
                    <TableCell><Typography variant="body2" fontWeight={600}>{b.money_source === 'person' ? b.person_name : b.location_name}</Typography></TableCell>
                    <TableCell><Chip size="small" label={b.money_source === 'person' ? 'Person funds' : 'House funds'} color={b.money_source === 'house' ? 'info' : 'default'} variant="outlined" /></TableCell>
                    <TableCell align="right"><Typography variant="body2" fontWeight={700} color={Number(b.current_balance_pence) > 0 ? 'success.main' : 'text.secondary'}>{'\u00A3'}{(Number(b.current_balance_pence || 0) / 100).toFixed(2)}</Typography></TableCell>
                    <TableCell><Typography variant="body2" color="text.secondary">{b.last_reconciled_at ? new Date(b.last_reconciled_at).toLocaleDateString('en-GB') : 'Never'}</Typography></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>Transaction history</Typography>
          <TableContainer component={Paper} sx={{ border: '1px solid #E5E7EB' }}>
            <Table size="small">
              <TableHead>
                <TableRow>{['Date', 'Account', 'Type', 'Amount', 'Balance', 'Notes'].map(h => <TableCell key={h} sx={{ fontWeight: 800, color: 'text.secondary' }}>{h}</TableCell>)}</TableRow>
              </TableHead>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: '#9CA3AF' }}>No transactions yet.</TableCell></TableRow>
                ) : transactions.map((t: any) => (
                  <TableRow key={t.id} hover>
                    <TableCell>{new Date(t.created_at).toLocaleString('en-GB')}</TableCell>
                    <TableCell>{t.money_source === 'person' ? t.person_name : t.location_name}</TableCell>
                    <TableCell><Chip label={t.type.replace('_', ' ')} size="small" /></TableCell>
                    <TableCell align="right">{'\u00A3'}{(Number(t.amount_pence || 0) / 100).toFixed(2)}</TableCell>
                    <TableCell align="right">{'\u00A3'}{(Number(t.new_balance_pence || 0) / 100).toFixed(2)}</TableCell>
                    <TableCell>{t.notes || '\u2014'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Tab 2: Daily cash checks */}
      {tab === 2 && (
        <Box sx={{ pt: 2 }}>
          <Stack direction="row" spacing={1} mb={2}>
            <Button variant="outlined" onClick={() => setCashCheckOpen(true)}>New cash check</Button>
          </Stack>
          <TableContainer component={Paper} sx={{ border: '1px solid #E5E7EB' }}>
            <Table size="small">
              <TableHead>
                <TableRow>{['Date', 'Account', 'Expected', 'Physical in tin', 'Variance', 'Notes'].map(h => <TableCell key={h} sx={{ fontWeight: 800, color: 'text.secondary' }}>{h}</TableCell>)}</TableRow>
              </TableHead>
              <TableBody>
                {cashChecks.length === 0 ? (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: '#9CA3AF' }}>No cash checks recorded.</TableCell></TableRow>
                ) : cashChecks.map((c: any) => (
                  <TableRow key={c.id} hover>
                    <TableCell>{new Date(c.check_date).toLocaleDateString('en-GB')}</TableCell>
                    <TableCell>{c.money_source === 'house' ? c.location_name : c.person_name}</TableCell>
                    <TableCell align="right">{'\u00A3'}{(Number(c.expected_balance_pence) / 100).toFixed(2)}</TableCell>
                    <TableCell align="right">{'\u00A3'}{(Number(c.physical_balance_pence) / 100).toFixed(2)}</TableCell>
                    <TableCell align="right" sx={{ color: Number(c.variance_pence) === 0 ? 'success.main' : 'error.main', fontWeight: 700 }}>{'\u00A3'}{(Number(c.variance_pence) / 100).toFixed(2)}</TableCell>
                    <TableCell>{c.notes || '\u2014'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Dialogs */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add expense</DialogTitle>
        <ExpenseForm people={people} onSubmit={data => createMutation.mutate(data)} onCancel={() => setCreateOpen(false)} isLoading={createMutation.isPending} />
      </Dialog>

      {/* Edit — key={editId} forces remount so state resets per expense */}
      <Dialog open={!!editId} onClose={() => setEditId(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit entry</DialogTitle>
        {editId && <EditExpenseForm key={editId} expense={expenses.find((e: any) => e.id === editId)} onSubmit={data => updateMutation.mutate({ id: editId, data })} onCancel={() => setEditId(null)} isLoading={updateMutation.isPending} />}
      </Dialog>

      <Dialog open={!!voidId} onClose={() => { setVoidId(null); setVoidReason('') }} maxWidth="sm" fullWidth>
        <DialogTitle>Void expense entry</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>This action cannot be undone. The entry will be marked as voided and excluded from totals.</Alert>
          <TextField label="Reason for voiding" fullWidth multiline rows={3} value={voidReason} onChange={e => setVoidReason(e.target.value)} placeholder="Explain why this entry is being voided..." />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setVoidId(null); setVoidReason('') }}>Cancel</Button>
          <Button variant="contained" color="warning" disabled={voidReason.trim().length < 3 || voidMutation.isPending} onClick={() => { if (voidId) voidMutation.mutate({ id: voidId, reason: voidReason.trim() }) }}>
            {voidMutation.isPending ? <CircularProgress size={20} /> : 'Void entry'}
          </Button>
        </DialogActions>
      </Dialog>

      <PettyCashDialog open={topUpOpen} title="Top up cash" locations={locations} people={people} onClose={() => setTopUpOpen(false)}
        onSubmit={(data: any) => topUpMutation.mutate(data)} kind="top_up" isLoading={topUpMutation.isPending} />

      <PettyCashDialog open={reconcileOpen} title="Reconcile cash" locations={locations} people={people} onClose={() => setReconcileOpen(false)}
        onSubmit={(data: any) => reconcileMutation.mutate(data)} kind="reconcile" isLoading={reconcileMutation.isPending} />

      <PettyCashDialog open={cashCheckOpen} title="Daily cash balance check" locations={locations} people={people} onClose={() => setCashCheckOpen(false)}
        onSubmit={(data: any) => dailyCheckMutation.mutate(data)} kind="daily_check" isLoading={dailyCheckMutation.isPending} />

      {/* Error/success snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))} variant="filled" sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  )
}

/* ---------- Add expense form ---------- */
function ExpenseForm({ people, onSubmit, onCancel, isLoading }: { people: any[]; onSubmit: (data: any) => void; onCancel: () => void; isLoading: boolean }) {
  const [source, setSource] = useState('person')
  const [personId, setPersonId] = useState('')
  const [category, setCategory] = useState('food')
  const [amount, setAmount] = useState(0)
  const [description, setDescription] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [date, setDate] = useState(today())

  return (
    <>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField select label="Money source" fullWidth value={source} onChange={e => setSource(e.target.value)}>
            <MenuItem value="person">Person funds</MenuItem>
            <MenuItem value="house">House funds</MenuItem>
          </TextField>
          {source === 'person' && (
            <TextField select label="Person" fullWidth required value={personId} onChange={e => setPersonId(e.target.value)}>
              <MenuItem value="">Select person</MenuItem>
              {people.map(p => <MenuItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</MenuItem>)}
            </TextField>
          )}
          <TextField select label="Category" fullWidth value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
          </TextField>
          <TextField select label="Payment method" fullWidth value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
            <MenuItem value="cash">Cash</MenuItem>
            <MenuItem value="card">Card</MenuItem>
            <MenuItem value="bank_transfer">Bank transfer</MenuItem>
            <MenuItem value="direct_debit">Direct debit</MenuItem>
          </TextField>
          <TextField label="Amount ({'\u00A3'})" type="number" fullWidth value={amount} onChange={e => setAmount(parseFloat(e.target.value) || 0)} inputProps={{ min: 0.01, step: 0.01 }} />
          <TextField label="Description / reason" fullWidth multiline rows={3} value={description} onChange={e => setDescription(e.target.value)} />
          <TextField label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={date} onChange={e => setDate(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={() => onSubmit({ personId: source === 'person' ? personId : null, moneySource: source, paymentMethod, category, amountPence: Math.round(amount * 100), description, incurredDate: date })} disabled={!amount || !date || (source === 'person' && !personId) || isLoading}>
          {isLoading ? <CircularProgress size={20} /> : 'Add expense'}
        </Button>
      </DialogActions>
    </>
  )
}

/* ---------- Edit expense form (description + category only) ---------- */
function EditExpenseForm({ expense, onSubmit, onCancel, isLoading }: { expense: any; onSubmit: (data: any) => void; onCancel: () => void; isLoading: boolean }) {
  const [category, setCategory] = useState(expense?.category || 'food')
  const [description, setDescription] = useState(expense?.description || '')

  if (!expense) return null

  return (
    <>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>Only the description and category can be edited. All other fields are part of the audit record.</Alert>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField select label="Category" fullWidth value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
          </TextField>
          <TextField label="Description" fullWidth multiline rows={3} value={description} onChange={e => setDescription(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={() => onSubmit({ category, description })} disabled={isLoading}>
          {isLoading ? <CircularProgress size={20} /> : 'Save changes'}
        </Button>
      </DialogActions>
    </>
  )
}

/* ---------- Petty cash dialog ---------- */
function PettyCashDialog({ open, title, locations, people, onClose, onSubmit, kind, isLoading }: any) {
  const [moneySource, setMoneySource] = useState('house')
  const [locationId, setLocationId] = useState('')
  const [personId, setPersonId] = useState('')
  const [amount, setAmount] = useState(0)
  const [expected, setExpected] = useState(0)
  const [notes, setNotes] = useState('')
  const [checkDate, setCheckDate] = useState(today())

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setMoneySource('house')
      setLocationId('')
      setPersonId('')
      setAmount(0)
      setExpected(0)
      setNotes('')
      setCheckDate(today())
    }
  }, [open])

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField select label="Cash belongs to" fullWidth value={moneySource} onChange={e => setMoneySource(e.target.value)}>
            <MenuItem value="house">House</MenuItem>
            <MenuItem value="person">Person</MenuItem>
          </TextField>
          {moneySource === 'house' ? (
            <TextField select label="Location" fullWidth value={locationId} onChange={e => setLocationId(e.target.value)}>
              {locations.map((l: any) => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
            </TextField>
          ) : (
            <TextField select label="Person" fullWidth value={personId} onChange={e => setPersonId(e.target.value)}>
              {people.map((p: any) => <MenuItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</MenuItem>)}
            </TextField>
          )}
          {kind === 'daily_check' && (
            <TextField label="Check date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={checkDate} onChange={e => setCheckDate(e.target.value)} />
          )}
          <TextField
            label={kind === 'top_up' ? 'Amount (\u00A3)' : kind === 'daily_check' ? 'Expected cash (\u00A3)' : 'Actual balance (\u00A3)'}
            type="number" fullWidth value={kind === 'daily_check' ? expected : amount}
            onChange={e => (kind === 'daily_check' ? setExpected(parseFloat(e.target.value) || 0) : setAmount(parseFloat(e.target.value) || 0))}
            inputProps={{ min: 0, step: 0.01 }}
          />
          {kind === 'daily_check' && (
            <TextField label="Physical cash in money tin (\u00A3)" type="number" fullWidth value={amount} onChange={e => setAmount(parseFloat(e.target.value) || 0)} inputProps={{ min: 0, step: 0.01 }} />
          )}
          <TextField label="Notes" multiline rows={2} fullWidth value={notes} onChange={e => setNotes(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained"
          disabled={(moneySource === 'house' ? !locationId : !personId) || (kind === 'top_up' ? amount <= 0 : kind === 'daily_check' ? expected < 0 || amount < 0 : amount < 0) || isLoading}
          onClick={() => onSubmit(kind === 'top_up'
            ? { moneySource, locationId: moneySource === 'house' ? locationId : undefined, personId: moneySource === 'person' ? personId : undefined, amountPence: Math.round(amount * 100), notes }
            : kind === 'daily_check'
              ? { moneySource, locationId: moneySource === 'house' ? locationId : undefined, personId: moneySource === 'person' ? personId : undefined, expectedBalancePence: Math.round(expected * 100), physicalBalancePence: Math.round(amount * 100), checkDate, notes }
              : { moneySource, locationId, actualBalancePence: Math.round(amount * 100), notes }
          )}>
          {isLoading ? <CircularProgress size={20} /> : kind === 'top_up' ? 'Top up' : kind === 'daily_check' ? 'Save check' : 'Reconcile'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
