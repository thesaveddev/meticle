import { useState } from 'react'
import {
  Box, Typography, Grid, Card, CardContent, Button, Chip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Stack, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, CircularProgress, Alert, IconButton, Tabs, Tab,
} from '@mui/material'
import {
  Add as AddIcon, Receipt as ReceiptIcon, AccountBalanceWallet as WalletIcon,
  History as HistoryIcon, Edit as EditIcon, Delete as DeleteIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'

const CATEGORIES = [
  { value: 'food', label: 'Food' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'activities', label: 'Activities' },
  { value: 'transport', label: 'Transport' },
  { value: 'personal', label: 'Personal' },
  { value: 'health', label: 'Health' },
  { value: 'other', label: 'Other' },
]

interface TabPanelProps { children?: React.ReactNode; index: number; value: number }
function TabPanel({ children, value, index }: TabPanelProps) {
  return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null
}

function fmtDate(d: string | Date) { return new Date(d).toLocaleDateString('en-GB') }
function fmtDateTime(d: string | Date) { return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) }
function todayStr() { return new Date().toISOString().slice(0, 10) }

export default function ExpensesPage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState('')
  const [filterSu, setFilterSu] = useState('')
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [reconcileOpen, setReconcileOpen] = useState(false)

  const { data: expenses, isLoading } = useQuery({
    queryKey: ['expenses', filterCategory, filterSu],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filterCategory) params.set('category', filterCategory)
      if (filterSu) params.set('serviceUserId', filterSu)
      const res = await api.get(`/expenses?${params}`)
      return res.data
    },
  })

  const { data: stats } = useQuery({
    queryKey: ['expense-stats'],
    queryFn: async () => { const res = await api.get('/expenses/stats'); return res.data },
  })

  const { data: serviceUsers } = useQuery({
    queryKey: ['service-users-list'],
    queryFn: async () => { const res = await api.get('/service-users?limit=200'); return res.data },
  })

  const { data: balances } = useQuery({
    queryKey: ['petty-cash-balances'],
    queryFn: async () => { const res = await api.get('/expenses/petty-cash/balances'); return res.data },
  })

  const { data: transactions } = useQuery({
    queryKey: ['petty-cash-transactions'],
    queryFn: async () => { const res = await api.get('/expenses/petty-cash/transactions'); return res.data },
  })

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => { const res = await api.get('/settings/locations'); return res.data },
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/expenses', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); queryClient.invalidateQueries({ queryKey: ['expense-stats'] }); setCreateOpen(false) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/expenses/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); setEditOpen(false); setEditId(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  })

  const topUpMutation = useMutation({
    mutationFn: (data: any) => api.post('/expenses/petty-cash/top-up', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['petty-cash-balances'] }); queryClient.invalidateQueries({ queryKey: ['petty-cash-transactions'] }); setTopUpOpen(false) },
  })

  const reconcileMutation = useMutation({
    mutationFn: (data: any) => api.post('/expenses/petty-cash/reconcile', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['petty-cash-balances'] }); queryClient.invalidateQueries({ queryKey: ['petty-cash-transactions'] }); setReconcileOpen(false) },
  })

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">Expense Tracking</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<WalletIcon />} onClick={() => setTopUpOpen(true)}>Top Up</Button>
          <Button variant="outlined" startIcon={<HistoryIcon />} onClick={() => setReconcileOpen(true)}>Reconcile</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>Add Expense</Button>
        </Stack>
      </Stack>

      {stats && (
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card><CardContent>
              <Typography color="text.secondary" variant="caption">Total Spent</Typography>
              <Typography variant="h5">£{stats.total_amount_pounds.toFixed(2)}</Typography>
            </CardContent></Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card><CardContent>
              <Typography color="text.secondary" variant="caption">Number of Expenses</Typography>
              <Typography variant="h5">{stats.total_expenses}</Typography>
            </CardContent></Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card><CardContent>
              <Typography color="text.secondary" variant="caption">Top Category</Typography>
              <Typography variant="h5">{stats.by_category[0]?.category || '—'}</Typography>
              <Typography variant="caption">£{(stats.by_category[0]?.total_pounds || 0).toFixed(2)}</Typography>
            </CardContent></Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card><CardContent>
              <Typography color="text.secondary" variant="caption">Locations with Spend</Typography>
              <Typography variant="h5">{stats.by_location.length}</Typography>
            </CardContent></Card>
          </Grid>
        </Grid>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab icon={<ReceiptIcon />} label="Spending Ledger" />
        <Tab icon={<WalletIcon />} label="Petty Cash" />
      </Tabs>

      <TabPanel value={tab} index={0}>
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField select label="Category" size="small" value={filterCategory} onChange={e => setFilterCategory(e.target.value)} sx={{ minWidth: 160 }}>
                <MenuItem value="">All</MenuItem>
                {CATEGORIES.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
              </TextField>
              <TextField select label="Person" size="small" value={filterSu} onChange={e => setFilterSu(e.target.value)} sx={{ minWidth: 200 }}>
                <MenuItem value="">All</MenuItem>
                {serviceUsers?.map((su: any) => <MenuItem key={su.id} value={su.id}>{su.first_name} {su.last_name}</MenuItem>)}
              </TextField>
            </Stack>
          </CardContent>
        </Card>

        {isLoading ? <CircularProgress /> : !expenses?.length ? (
          <Alert severity="info">No expenses recorded yet. Click "Add Expense" to record the first entry.</Alert>
        ) : (
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell><TableCell>Person</TableCell><TableCell>Category</TableCell>
                  <TableCell>Description</TableCell><TableCell align="right">Amount</TableCell><TableCell>Added By</TableCell><TableCell width={100}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {expenses.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell>{fmtDate(e.incurred_date)}</TableCell>
                    <TableCell>{e.service_user_name}</TableCell>
                    <TableCell><Chip label={e.category} size="small" /></TableCell>
                    <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description || '—'}</TableCell>
                    <TableCell align="right">£{(e.amount_pence / 100).toFixed(2)}</TableCell>
                    <TableCell>{e.created_by_name || '—'}</TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => { setEditId(e.id); setEditOpen(true) }}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(e.id)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      <TabPanel value={tab} index={1}>
        <Stack direction="row" spacing={1} mb={2}>
          <Button variant="outlined" startIcon={<WalletIcon />} onClick={() => setTopUpOpen(true)}>Top Up</Button>
          <Button variant="outlined" startIcon={<HistoryIcon />} onClick={() => setReconcileOpen(true)}>Reconcile</Button>
        </Stack>

        <Grid container spacing={2} mb={3}>
          {balances?.map((b: any) => (
            <Grid item xs={12} sm={6} md={4} key={b.id}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2">{b.location_name}</Typography>
                  <Typography variant="h4" color="primary">£{(b.current_balance_pence / 100).toFixed(2)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {b.last_reconciled_at ? `Last reconciled: ${fmtDate(b.last_reconciled_at)}` : 'Never reconciled'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {transactions?.length > 0 && (
          <>
            <Typography variant="subtitle1" mb={1}>Transaction History</Typography>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell><TableCell>Location</TableCell><TableCell>Type</TableCell>
                    <TableCell align="right">Amount</TableCell><TableCell>New Balance</TableCell><TableCell>Notes</TableCell><TableCell>By</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell>{fmtDateTime(t.created_at)}</TableCell>
                      <TableCell>{t.location_name}</TableCell>
                      <TableCell><Chip label={t.type.replace('_', ' ')} size="small" color={t.type === 'top_up' ? 'success' : t.type === 'reconciliation' ? 'info' : 'warning'} /></TableCell>
                      <TableCell align="right">£{(t.amount_pence / 100).toFixed(2)}</TableCell>
                      <TableCell>£{(t.new_balance_pence / 100).toFixed(2)}</TableCell>
                      <TableCell>{t.notes || '—'}</TableCell>
                      <TableCell>{t.performed_by_name || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </TabPanel>

      {/* Create Expense Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Expense</DialogTitle>
        <ExpenseForm serviceUsers={serviceUsers} onSubmit={data => createMutation.mutate(data)} onCancel={() => setCreateOpen(false)} isLoading={createMutation.isPending} />
      </Dialog>

      {/* Edit Expense Dialog */}
      <Dialog open={editOpen} onClose={() => { setEditOpen(false); setEditId(null) }} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Expense</DialogTitle>
        {editId && <ExpenseForm
          serviceUsers={serviceUsers}
          initialData={expenses?.find((e: any) => e.id === editId)}
          onSubmit={data => updateMutation.mutate({ id: editId, data })}
          onCancel={() => { setEditOpen(false); setEditId(null) }}
          isLoading={updateMutation.isPending}
        />}
      </Dialog>

      {/* Top Up Dialog */}
      <Dialog open={topUpOpen} onClose={() => setTopUpOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Petty Cash Top Up</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField select label="Location" fullWidth required id="topup-location">
              {locations?.map((l: any) => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
            </TextField>
            <TextField label="Amount (£)" type="number" fullWidth required id="topup-amount" inputProps={{ min: 0.01, step: 0.01 }} />
            <TextField label="Notes" fullWidth multiline rows={2} id="topup-notes" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTopUpOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => {
            const loc = (document.getElementById('topup-location') as HTMLInputElement).value
            const amt = parseFloat((document.getElementById('topup-amount') as HTMLInputElement).value)
            const notes = (document.getElementById('topup-notes') as HTMLInputElement).value
            if (loc && amt > 0) topUpMutation.mutate({ locationId: loc, amountPence: Math.round(amt * 100), notes })
          }} disabled={topUpMutation.isPending}>{topUpMutation.isPending ? <CircularProgress size={20} /> : 'Top Up'}</Button>
        </DialogActions>
      </Dialog>

      {/* Reconcile Dialog */}
      <Dialog open={reconcileOpen} onClose={() => setReconcileOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reconcile Petty Cash</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField select label="Location" fullWidth required id="reconcile-location">
              {locations?.map((l: any) => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
            </TextField>
            <TextField label="Actual Balance (£)" type="number" fullWidth required id="reconcile-amount" inputProps={{ min: 0, step: 0.01 }} />
            <TextField label="Notes" fullWidth multiline rows={2} id="reconcile-notes" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReconcileOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => {
            const loc = (document.getElementById('reconcile-location') as HTMLInputElement).value
            const amt = parseFloat((document.getElementById('reconcile-amount') as HTMLInputElement).value)
            const notes = (document.getElementById('reconcile-notes') as HTMLInputElement).value
            if (loc && amt >= 0) reconcileMutation.mutate({ locationId: loc, actualBalancePence: Math.round(amt * 100), notes })
          }} disabled={reconcileMutation.isPending}>{reconcileMutation.isPending ? <CircularProgress size={20} /> : 'Reconcile'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function ExpenseForm({ serviceUsers, initialData, onSubmit, onCancel, isLoading }: {
  serviceUsers: any[]; initialData?: any; onSubmit: (data: any) => void; onCancel: () => void; isLoading: boolean
}) {
  const [serviceUserId, setServiceUserId] = useState(initialData?.service_user_id || '')
  const [category, setCategory] = useState(initialData?.category || 'food')
  const [amountPence, setAmountPence] = useState(initialData ? initialData.amount_pence / 100 : 0)
  const [description, setDescription] = useState(initialData?.description || '')
  const [incurredDate, setIncurredDate] = useState(initialData?.incurred_date || todayStr())

  return (
    <>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField select label="Person" fullWidth required value={serviceUserId} onChange={e => setServiceUserId(e.target.value)}>
            {serviceUsers?.map((su: any) => <MenuItem key={su.id} value={su.id}>{su.first_name} {su.last_name}</MenuItem>)}
          </TextField>
          <TextField select label="Category" fullWidth required value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
          </TextField>
          <TextField label="Amount (£)" type="number" fullWidth required value={amountPence} onChange={e => setAmountPence(parseFloat(e.target.value) || 0)} inputProps={{ min: 0.01, step: 0.01 }} />
          <TextField label="Description" fullWidth multiline rows={2} value={description} onChange={e => setDescription(e.target.value)} />
          <TextField label="Date" type="date" fullWidth required value={incurredDate} onChange={e => setIncurredDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={() => onSubmit({
          serviceUserId, category, amountPence: Math.round(amountPence * 100), description, incurredDate,
        })} disabled={!serviceUserId || !amountPence || !incurredDate || isLoading}>
          {isLoading ? <CircularProgress size={20} /> : initialData ? 'Update' : 'Add Expense'}
        </Button>
      </DialogActions>
    </>
  )
}
