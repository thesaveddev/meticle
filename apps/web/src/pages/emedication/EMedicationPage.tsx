import React, { useState, useEffect } from 'react'
import { Box, Typography, Paper, Button, Stack, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Autocomplete, Grid, Alert, CircularProgress, IconButton, Tooltip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, InputAdornment, Tabs, Tab, Divider, FormControlLabel, Checkbox, Menu } from '@mui/material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Medication as MedIcon, Warning as WarningIcon, Check as CheckIcon, Close as CloseIcon, Schedule as ScheduleIcon, Print as PrintIcon, ArrowBack as PrevIcon, ArrowForward as NextIcon, Inventory as InventoryIcon, LocalShipping as DeliveryIcon, History as AuditIcon, ArchiveOutlined, RemoveRedEye as ViewArchivedIcon, ArrowDropDown as ArrowDropDownIcon } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

const ROUTES = ['oral', 'topical', 'injection', 'inhalation', 'rectal', 'sublingual', 'other']
const FREQUENCIES = ['once daily', 'twice daily', 'three times daily', 'four times daily', 'as required (PRN)', 'weekly', 'monthly']
const ADMIN_STATUSES = ['given', 'refused', 'missed', 'omitted', 'not_available', 'n/a'] as const
type AdminStatus = typeof ADMIN_STATUSES[number]

const STATUS_CONFIG: Record<AdminStatus, { label: string; color: 'success' | 'error' | 'warning' | 'default'; icon: React.ReactNode }> = {
  given: { label: 'Given', color: 'success', icon: <CheckIcon sx={{ fontSize: 14 }} /> },
  refused: { label: 'Refused', color: 'error', icon: <CloseIcon sx={{ fontSize: 14 }} /> },
  missed: { label: 'Missed', color: 'error', icon: <CloseIcon sx={{ fontSize: 14 }} /> },
  omitted: { label: 'Omitted', color: 'warning', icon: <span style={{ fontSize: 14 }}>&ndash;</span> },
  not_available: { label: 'N/A', color: 'warning', icon: <CloseIcon sx={{ fontSize: 14 }} /> },
  'n/a': { label: 'N/A', color: 'default', icon: <span style={{ fontSize: 14 }}>&ndash;</span> },
}

interface MedicationRecord {
  id: string; title: string; person_id: string; person_name: string
  start_date: string; end_date: string; status: string
}

interface MedicationItem {
  id: string; name: string; dosage: string; unit: string; route: string
  frequency: string; times: string[]; instructions: string
  is_prn: boolean; is_active: boolean; emedication_record_id: string
  start_date?: string; end_date?: string; stock_item_id?: string
  is_controlled_drug?: boolean; prescriber_name?: string; prescriber_phone?: string; prescription_ref?: string
}

interface Administration {
  id: string; emedication_item_id: string; scheduled_time: string
  administered_time: string; status: string; notes: string; user_id?: string
  first_name: string; last_name: string; staff_id?: string
  prn_reason?: string; prn_effectiveness?: string
  wastage_amount?: string; wastage_reason?: string
  batch_number?: string; expiry_date?: string
}

interface MarChartData {
  record: MedicationRecord
  days: string[]
  items: MedicationItem[]
  adminMap: Record<string, Record<string, Administration[]>>
}

interface StaffMember {
  user_id: string; first_name: string; last_name: string; role: string; id?: string; staff_id?: string
}

interface StockItem {
  id: string; medication_name: string; dosage: string; unit: string
  batch_number: string; expiry_date: string; quantity: number; quantity_unit: string
  reorder_level: number; location: string; person_id?: string; status?: string
}

interface Delivery {
  id: string; supplier: string; delivery_note: string; delivery_date: string
  received_by: string; notes: string; created_at: string; items?: DeliveryItem[]
}

interface DeliveryItem {
  id: string; stock_id: string; medication_name: string; dosage: string; unit: string
  batch_number: string; expiry_date: string; quantity: number; quantity_unit: string
}

interface AuditLog {
  id: string; action: string; entity_type: string; entity_id: string
  user_name: string; user_email: string; changes: any
  created_at: string; ip_address: string
}

const todayStr = () => new Date().toISOString().split('T')[0]

function getAdminDisplay(admins: Administration[] | undefined): Administration | undefined {
  if (!admins || admins.length === 0) return undefined
  return admins[admins.length - 1]
}

function formatMonthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
  return `${MONTH_NAMES[m - 1]} ${y}`
}

export default function EMedicationPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
  const userRole = currentUser.role
  const canManage = userRole === 'ORG_ADMIN' || userRole === 'MANAGER'

  const [tab, setTab] = useState(0)
  const [selectedPerson, setSelectedPerson] = useState<any>(null)
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [month, setMonth] = useState(() => {
    const m = todayStr().slice(0, 7)
    return m
  })
  const [recordDialog, setRecordDialog] = useState(false)
  const [editRecord, setEditRecord] = useState<MedicationRecord | null>(null)
  const [archiveDialog, setArchiveDialog] = useState(false)
  const [archiveTargetId, setArchiveTargetId] = useState<string | null>(null)
  const [itemDialog, setItemDialog] = useState(false)
  const [adminDialog, setAdminDialog] = useState(false)
  const [editItem, setEditItem] = useState<MedicationItem | null>(null)
  const [adminTarget, setAdminTarget] = useState<{ itemId: string; date: string; time: string; existingAdmin?: Administration; isPrn?: boolean } | null>(null)
  const [adminForm, setAdminForm] = useState({ status: 'given' as AdminStatus, notes: '', staffUserId: '', prn_reason: '', prn_effectiveness: '', wastage_amount: '', wastage_reason: '', batch_number: '', expiry_date: '' })
  const [adminTime, setAdminTime] = useState('')
  const [recordForm, setRecordForm] = useState({ title: '', start_date: '', end_date: '' })
  const [itemForm, setItemForm] = useState({ name: '', dosage: '', unit: 'mg', route: 'oral', frequency: 'once daily', times: [] as string[], instructions: '', is_prn: false, is_active: true, start_date: '', end_date: '', is_controlled_drug: false, prescriber_name: '', prescriber_phone: '', prescription_ref: '' })
  const [timeInput, setTimeInput] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [adminError, setAdminError] = useState('')
  const [printAnchorEl, setPrintAnchorEl] = useState<null | HTMLElement>(null)

  // Stock state
  const [stockDialog, setStockDialog] = useState(false)
  const [editStock, setEditStock] = useState<StockItem | null>(null)
  const [stockForm, setStockForm] = useState({ medication_name: '', dosage: '', unit: 'mg', batch_number: '', expiry_date: '', quantity: 0, quantity_unit: 'tablets', reorder_level: 10, location: '' })
  const [stockPerson, setStockPerson] = useState<any>(null)

  // Stock adjustment state
  const [adjustDialog, setAdjustDialog] = useState(false)
  const [adjustStockItem, setAdjustStockItem] = useState<StockItem | null>(null)
  const [adjustForm, setAdjustForm] = useState({ adjustment_type: 'damaged', quantity_adjusted: 1, reason: '', adjusted_by: '' })

  // Daily counts state
  const [showArchivedStock, setShowArchivedStock] = useState(false)
  // Daily count state (inline form, no dialog)
  const [countPerson, setCountPerson] = useState<any>(null)
  const [countMedications, setCountMedications] = useState<any[]>([])
  const [countItemsForm, setCountItemsForm] = useState<Record<string, { actual_quantity: number; reason_for_mismatch: string; escalate: boolean }>>({})
  const [countLoading, setCountLoading] = useState(false)
  const [countNoRecords, setCountNoRecords] = useState(false)
  const [editDailyCountId, setEditDailyCountId] = useState<string | null>(null)
  const [editDailyCountItems, setEditDailyCountItems] = useState<any[]>([])

  // Delivery state
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null)
  const [dayAdminDialog, setDayAdminDialog] = useState<{ date: string; admins: any[] } | null>(null)
  const [deliveryDialog, setDeliveryDialog] = useState(false)
  const [deliveryForm, setDeliveryForm] = useState({ supplier: '', delivery_note: '', delivery_date: todayStr(), received_by: '', notes: '', items: [] as any[] })
  const [deliveryItemForm, setDeliveryItemForm] = useState({ medication_name: '', dosage: '', unit: 'mg', batch_number: '', expiry_date: '', quantity: 0, quantity_unit: 'tablets' })

  // Fetch people
  const { data: people, isError: suError } = useQuery({
    queryKey: ['people-list'],
    queryFn: async () => { const res = await api.get('/people'); return res.data as any[] }
  })

  // Fetch staff
  const { data: staffList } = useQuery({
    queryKey: ['org-staff'],
    queryFn: async () => { const res = await api.get('/staff/org-members'); const d = res.data as any; const merged = [...((d.staff || []) as StaffMember[])]; const admins = d.admins?.length ? d.admins : (d.admin ? [d.admin] : []); for (const a of admins) { if (!merged.find((s: any) => s.id === a.id)) merged.unshift(a) } return merged }
  })

  // Ensure MAR
  const ensureMarMutation = useMutation({
    mutationFn: (personId: string) => api.post('/emedication/ensure-monthly-mar', { personId }),
  })

  useEffect(() => {
    if (selectedPerson) {
      ensureMarMutation.mutate(selectedPerson.id, {
        onSettled: () => {
          queryClient.invalidateQueries({ queryKey: ['emedication-records'] })
        }
      })
    }
  }, [selectedPerson?.id])

  // Records - always active
  const { data: recordsData, isLoading: recordsLoading, isError: recordsError } = useQuery({
    queryKey: ['emedication-records', selectedPerson?.id],
    queryFn: async () => {
      if (!selectedPerson) return []
      const res = await api.get(`/emedication/records?personId=${selectedPerson.id}`)
      return (res.data as MedicationRecord[]).filter(r => r.status === 'active')
    },
    enabled: !!selectedPerson
  })

  // Derive active record by matching month string to record TITLE (e.g. "July 2026 MAR").
  // Uses normalizeTitle to handle any locale or formatting differences.
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const [y, m] = month.split('-').map(Number)
  const monthLabel = `${MONTH_NAMES[m - 1]} ${y}`
  const normalizeTitle = (t: string) => t.replace(/[,]+/g, '').replace(/\s+/g, ' ').trim()
  const targetTitle = normalizeTitle(`${monthLabel} MAR`)
  const activeRecord = recordsData?.find(r => normalizeTitle(r.title) === targetTitle) || null

  // Sync selectedRecordId to activeRecord for backward compat
  useEffect(() => {
    if (activeRecord && (!selectedRecordId || activeRecord.id !== selectedRecordId)) {
      setSelectedRecordId(activeRecord.id)
    }
  }, [activeRecord?.id])

  // Chart — always uses activeRecord (derived from month), never selectedRecordId (avoids stale flash)
  const { data: chartData, isLoading: chartLoading, isError: chartError } = useQuery({
    queryKey: ['emedication-chart', activeRecord?.id, month],
    queryFn: async () => {
      if (!activeRecord) return null
      const refDate = month + '-01'
      const res = await api.get(`/emedication/records/${activeRecord.id}/chart?date=${refDate}`)
      return res.data as MarChartData
    },
    enabled: !!activeRecord
  })

  // Overdue
  const { data: overdueData } = useQuery({
    queryKey: ['emedication-overdue'],
    queryFn: async () => { const res = await api.get('/emedication/overdue'); return res.data as any[] },
    refetchInterval: 60000
  })

  // Stock
  const { data: stockData, isLoading: stockLoading, isError: stockError } = useQuery({
    queryKey: ['emedication-stock', showArchivedStock],
    queryFn: async () => {
      const res = await api.get(`/emedication/stock${showArchivedStock ? '?includeArchived=true' : ''}`)
      return res.data as StockItem[]
    },
    enabled: tab === 1
  })

  // Deliveries
  const { data: deliveriesData, isLoading: deliveriesLoading } = useQuery({
    queryKey: ['emedication-deliveries'],
    queryFn: async () => { const res = await api.get('/emedication/deliveries'); return res.data as Delivery[] },
    enabled: tab === 2
  })

  // Daily Counts
  const { data: dailyCounts } = useQuery({
    queryKey: ['emedication-daily-counts', countPerson?.id],
    queryFn: async () => {
      const params = countPerson?.id ? `?personId=${countPerson.id}` : ''
      const res = await api.get(`/emedication/daily-counts${params}`)
      return res.data as any[]
    },
    enabled: tab === 3
  })

  // Audit logs
  const { data: auditLogsData } = useQuery({
    queryKey: ['emedication-audit-logs'],
    queryFn: async () => { const res = await api.get('/emedication/audit-logs'); return res.data as AuditLog[] },
    enabled: tab === 4
  })

  // Mutations
  const recordCreateMutation = useMutation({
    mutationFn: (data: any) => api.post('/emedication/records', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emedication-records'] })
      setRecordDialog(false); setRecordForm({ title: '', start_date: '', end_date: '' })
      setSuccessMsg('Chart created'); setTimeout(() => setSuccessMsg(''), 3000)
    }
  })

  const recordUpdateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/emedication/records/${id}`, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['emedication-records'] })
      setRecordDialog(false); setEditRecord(null)
      setRecordForm({ title: '', start_date: '', end_date: '' })
      setSelectedRecordId(res.data.id)
      setSuccessMsg('Chart updated'); setTimeout(() => setSuccessMsg(''), 3000)
    }
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/emedication/records/${id}`, { status: 'archived' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emedication-records'] })
      setArchiveDialog(false); setArchiveTargetId(null)
      setSelectedRecordId(null)
      setSuccessMsg('Chart archived'); setTimeout(() => setSuccessMsg(''), 3000)
    }
  })

  const itemCreateMutation = useMutation({
    mutationFn: ({ recordId, data }: { recordId: string; data: any }) => api.post(`/emedication/records/${recordId}/items`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emedication-chart'] })
      queryClient.invalidateQueries({ queryKey: ['emedication-stock'] })
      setItemDialog(false); setEditItem(null)
      setItemForm({ name: '', dosage: '', unit: 'mg', route: 'oral', frequency: 'once daily', times: [], instructions: '', is_prn: false, is_active: true, start_date: '', end_date: '', is_controlled_drug: false, prescriber_name: '', prescriber_phone: '', prescription_ref: '' })
      setSuccessMsg('Medication added - stock entry auto-created'); setTimeout(() => setSuccessMsg(''), 3000)
    }
  })

  const itemUpdateMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: any }) => api.patch(`/emedication/items/${itemId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emedication-chart'] })
      setItemDialog(false); setEditItem(null)
      setItemForm({ name: '', dosage: '', unit: 'mg', route: 'oral', frequency: 'once daily', times: [], instructions: '', is_prn: false, is_active: true, start_date: '', end_date: '', is_controlled_drug: false, prescriber_name: '', prescriber_phone: '', prescription_ref: '' })
      setSuccessMsg('Medication updated'); setTimeout(() => setSuccessMsg(''), 3000)
    }
  })

  const itemDeleteMutation = useMutation({
    mutationFn: (itemId: string) => api.delete(`/emedication/items/${itemId}`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['emedication-chart'] })
      const msg = (res.data as any)?.message || 'Medication removed'
      setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000)
    }
  })

  const adminMutation = useMutation({
    mutationFn: (data: any) => api.post('/emedication/administrations', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emedication-chart'] })
      queryClient.invalidateQueries({ queryKey: ['emedication-overdue'] })
      setAdminDialog(false); setAdminTarget(null); setAdminError('')
      setSuccessMsg('Administration logged'); setTimeout(() => setSuccessMsg(''), 3000)
    },
    onError: (err: any) => {
      setAdminError(err?.response?.data?.error?.message || err?.message || 'Failed to save administration')
    }
  })

  const competenceMutation = useMutation({
    mutationFn: (staffProfileId: string) => api.patch(`/emedication/staff/${staffProfileId}/medication-competence`, { medication_competent: true }),
    onSuccess: () => { setAdminError(''); setSuccessMsg('Staff marked as competent'); setTimeout(() => setSuccessMsg(''), 3000) },
    onError: (err: any) => setAdminError(err?.response?.data?.error?.message || 'Failed to update competence')
  })

  const importPrevMutation = useMutation({
    mutationFn: (recordId: string) => api.post(`/emedication/records/${recordId}/import-from-previous`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['emedication-chart'] })
      setSuccessMsg(res.data.message); setTimeout(() => setSuccessMsg(''), 3000)
    }
  })

  const handleSaveDailyCount = async () => {
    if (!countPerson) return
    try {
      const res = await countCreateMutation.mutateAsync({
        person_id: countPerson.id,
        count_date: todayStr(),
        staff_name: `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || currentUser.email,
        matches_physical: true,
      })
      const dailyCountId = (res as any).data?.id || (res as any).id
      for (const med of countMedications) {
        const formData = countItemsForm[med.medication_item_id]
        if (formData) {
          await api.post('/emedication/daily-counts/items', {
            daily_count_id: dailyCountId,
            medication_item_id: med.medication_item_id,
            medication_name: med.medication_name,
            expected_quantity: med.times?.length || 0,
            actual_quantity: formData.actual_quantity,
            reason_for_mismatch: formData.reason_for_mismatch || undefined,
            escalate: formData.escalate || undefined,
          })
        }
      }
      queryClient.invalidateQueries({ queryKey: ['emedication-daily-counts'] })
      setCountMedications([])
      setCountItemsForm({})
      setCountPerson(null)
      setSuccessMsg('Daily count logged'); setTimeout(() => setSuccessMsg(''), 3000)
    } catch { /* handled by mutation */ }
  }

  // Stock mutations
  const stockCreateMutation = useMutation({
    mutationFn: (data: any) => api.post('/emedication/stock', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emedication-stock'] })
      setStockDialog(false); setEditStock(null)
      setStockForm({ medication_name: '', dosage: '', unit: 'mg', batch_number: '', expiry_date: '', quantity: 0, quantity_unit: 'tablets', reorder_level: 10, location: '' })
      setStockPerson(null)
      setSuccessMsg('Stock item added'); setTimeout(() => setSuccessMsg(''), 3000)
    }
  })

  const stockUpdateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/emedication/stock/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emedication-stock'] })
      setStockDialog(false); setEditStock(null)
      setStockPerson(null)
      setSuccessMsg('Stock item updated'); setTimeout(() => setSuccessMsg(''), 3000)
    }
  })

  const stockArchiveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/emedication/stock/${id}/archive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emedication-stock'] })
      setSuccessMsg('Stock item archived'); setTimeout(() => setSuccessMsg(''), 3000)
    }
  })

  const adjustMutation = useMutation({
    mutationFn: ({ stockItemId, data }: { stockItemId: string; data: any }) => api.post(`/emedication/stock/${stockItemId}/adjustments`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emedication-stock'] })
      setAdjustDialog(false); setAdjustStockItem(null)
      setAdjustForm({ adjustment_type: 'damaged', quantity_adjusted: 1, reason: '', adjusted_by: '' })
      setSuccessMsg('Stock adjusted'); setTimeout(() => setSuccessMsg(''), 3000)
    }
  })

  const deliveryCreateMutation = useMutation({
    mutationFn: (data: any) => api.post('/emedication/deliveries', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emedication-deliveries'] })
      queryClient.invalidateQueries({ queryKey: ['emedication-stock'] })
      setDeliveryDialog(false)
      setDeliveryForm({ supplier: '', delivery_note: '', delivery_date: todayStr(), received_by: '', notes: '', items: [] })
      setSuccessMsg('Delivery created'); setTimeout(() => setSuccessMsg(''), 3000)
    }
  })

  const countCreateMutation = useMutation({
    mutationFn: (data: any) => api.post('/emedication/daily-counts', data),
  })

  // Handlers
  const handleCellClick = (item: MedicationItem, date: string, time: string) => {
    const admins = chartData?.adminMap[item.id]?.[date]
    const existingAdmin = admins ? getAdminDisplay(admins) : undefined
    setAdminTarget({ itemId: item.id, date, time, existingAdmin, isPrn: item.is_prn })
    setAdminTime(time)
    setAdminForm({
      status: (existingAdmin?.status as AdminStatus) || 'given',
      notes: existingAdmin?.notes || '',
      staffUserId: existingAdmin?.user_id || currentUser.id || currentUser.userId || '',
      prn_reason: existingAdmin?.prn_reason || '',
      prn_effectiveness: existingAdmin?.prn_effectiveness || '',
      wastage_amount: existingAdmin?.wastage_amount || '',
      wastage_reason: existingAdmin?.wastage_reason || '',
      batch_number: existingAdmin?.batch_number || '',
      expiry_date: existingAdmin?.expiry_date || '',
    })
    setAdminDialog(true)
  }

  const handleSaveAdmin = () => {
    if (!adminTarget) return
    if (adminForm.status === 'given') {
      const item = chartData?.items.find((i: MedicationItem) => i.id === adminTarget.itemId)
      if (item?.stock_item_id) {
        const stock = (stockData || []).find((s: StockItem) => s.id === item.stock_item_id && s.status !== 'archived')
        if (stock && stock.quantity !== null && Number(stock.quantity) <= 0) {
          setAdminError(`No stock available for ${item.name} (${stock.quantity} ${stock.quantity_unit} remaining). Log a delivery or stock adjustment first.`)
          return
        }
      }
    }
    const scheduled = new Date(`${adminTarget.date}T${adminTime || adminTarget.time}:00`).toISOString()
    const payload: any = {
      emedication_item_id: adminTarget.itemId,
      scheduled_time: scheduled,
      status: adminForm.status,
      notes: adminForm.notes,
      staff_user_id: adminForm.staffUserId || undefined,
    }
    if (adminForm.status === 'given') {
      if (adminForm.prn_reason) payload.prn_reason = adminForm.prn_reason
      if (adminForm.prn_effectiveness) payload.prn_effectiveness = adminForm.prn_effectiveness
      if (adminForm.wastage_amount) payload.wastage_amount = adminForm.wastage_amount
      if (adminForm.wastage_reason) payload.wastage_reason = adminForm.wastage_reason
      if (adminForm.batch_number) payload.batch_number = adminForm.batch_number
      if (adminForm.expiry_date) payload.expiry_date = adminForm.expiry_date
    }
    adminMutation.mutate(payload)
  }

  const handleSaveItem = () => {
    const data: any = { ...itemForm }
    if (!data.start_date) delete data.start_date
    if (!data.end_date) delete data.end_date
    if (editItem) {
      itemUpdateMutation.mutate({ itemId: editItem.id, data })
    } else if (activeRecord) {
      itemCreateMutation.mutate({ recordId: activeRecord.id, data })
    }
  }

  const openItemDialog = (item?: MedicationItem) => {
    if (item) {
      setEditItem(item)
      setItemForm({
        name: item.name, dosage: item.dosage, unit: item.unit, route: item.route,
        frequency: item.frequency, times: item.times, instructions: item.instructions || '',
        is_prn: item.is_prn, is_active: item.is_active,
        start_date: item.start_date ? item.start_date.slice(0, 10) : '',
        end_date: item.end_date ? item.end_date.slice(0, 10) : '',
        is_controlled_drug: item.is_controlled_drug || false,
        prescriber_name: item.prescriber_name || '',
        prescriber_phone: item.prescriber_phone || '',
        prescription_ref: item.prescription_ref || ''
      })
    } else {
      setEditItem(null)
      setItemForm({ name: '', dosage: '', unit: 'mg', route: 'oral', frequency: 'once daily', times: [], instructions: '', is_prn: false, is_active: true, start_date: '', end_date: '', is_controlled_drug: false, prescriber_name: '', prescriber_phone: '', prescription_ref: '' })
    }
    setItemDialog(true)
  }

  const handlePrint = () => {
    if (!chartData) return
    const today = todayStr()
    const days = chartData.days

    const su = (people || []).find((u: any) => u.id === chartData.record.person_id)
    const suName = chartData.record.person_name
    const nhsNumber = su?.nhs_number || 'N/A'
    const dob = su?.date_of_birth ? new Date(su.date_of_birth).toLocaleDateString() : 'N/A'
    const age = su?.date_of_birth ? Math.floor((Date.now() - new Date(su.date_of_birth).getTime()) / 31557600000) : ''
    const room = su?.room_number || ''
    const allergiesRaw = su?.allergies
    const normAllergies = (raw: any): { name: string; reaction: string; severity: string; date: string }[] => {
      if (!raw) return []
      if (Array.isArray(raw)) {
        return raw.map((a: any) => {
          if (typeof a === 'string') return { name: a, reaction: '', severity: '', date: '' }
          return {
            name: a.name || a.allergen || a.drug || a.allergen_name || JSON.stringify(a),
            reaction: a.reaction || a.reactions || '',
            severity: a.severity || '',
            date: a.date_identified || a.date || '',
          }
        })
      }
      if (typeof raw === 'object') {
        return Object.entries(raw).map(([k, v]) => ({
          name: k,
          reaction: String(v || ''),
          severity: '',
          date: '',
        }))
      }
      return [{ name: String(raw), reaction: '', severity: '', date: '' }]
    }
    const allergiesList = normAllergies(allergiesRaw)
    const gpName = su?.gp_name || ''
    const gpSurgery = su?.gp_surgery || ''
    const gpPhone = su?.gp_phone || ''
    const weight = su?.weight || ''
    const socialWorkerName = su?.social_worker_name || ''
    const socialWorkerPhone = su?.social_worker_phone || ''
    const pharmacyName = su?.pharmacy_name || ''
    const pharmacyPhone = su?.pharmacy_phone || ''

    const topicalRoutes = new Set(['topical', 'cream', 'ointment', 'gel', 'lotion'])
    const injectionRoutes = new Set(['im', 'intramuscular', 'iv', 'intravenous', 'sc', 'subcutaneous'])
    const patchRoutes = new Set(['transdermal', 'patch'])

    const regularItemsTopical = regularItems.filter(i => topicalRoutes.has(i.route?.toLowerCase()))
    const regularItemsInject = regularItems.filter(i => injectionRoutes.has(i.route?.toLowerCase()))
    const regularItemsPatch = regularItems.filter(i => patchRoutes.has(i.route?.toLowerCase()))
    const regularItemsStandard = regularItems.filter(i =>
      !topicalRoutes.has(i.route?.toLowerCase()) &&
      !injectionRoutes.has(i.route?.toLowerCase()) &&
      !patchRoutes.has(i.route?.toLowerCase())
    )

    // Build staff lookup from adminMap + staffList
    const staffLookup: { initials: string; name: string; role?: string; id?: string }[] = []
    if (chartData?.adminMap) {
      const seen = new Set<string>()
      for (const itemId of Object.keys(chartData.adminMap)) {
        for (const dateKey of Object.keys(chartData.adminMap[itemId])) {
          for (const a of chartData.adminMap[itemId][dateKey]) {
            const key = a.first_name + '|' + a.last_name
            if (!seen.has(key)) {
              seen.add(key)
              const initials = ((a.first_name?.[0] || '') + (a.last_name?.[0] || '')).toUpperCase() || 'S'
              const staffMatch = (staffList || []).find((s: any) =>
                s.first_name === a.first_name && s.last_name === a.last_name
              )
              staffLookup.push({
                initials,
                name: `${a.first_name} ${a.last_name}`,
                role: staffMatch?.role || '',
                id: a.staff_id || staffMatch?.id || staffMatch?.staff_id || ''
              })
            }
          }
        }
      }
    }

    // Collect statuses used
    const codesUsedStatus = new Set<string>()
    const allAdminsWithBatch: any[] = []
    if (chartData?.adminMap) {
      for (const itemId of Object.keys(chartData.adminMap)) {
        for (const dateKey of Object.keys(chartData.adminMap[itemId])) {
          for (const a of chartData.adminMap[itemId][dateKey]) {
            codesUsedStatus.add(a.status)
            if (a.batch_number || a.wastage_amount) {
              allAdminsWithBatch.push({ ...a, dateKey, itemId })
            }
          }
        }
      }
    }

    const statusLabels: Record<string, string> = {
      given: 'Given', refused: 'Refused', missed: 'Missed',
      omitted: 'Omitted',
      not_available: 'Not Available', 'n/a': 'N/A', pending: 'Pending'
    }
    const statusColors: Record<string, string> = {
      given: '#16A34A', refused: '#DC2626', missed: '#DC2626',
      omitted: '#D97706',
      not_available: '#D97706', pending: '#6B7280', 'n/a': '#9CA3AF'
    }
    const marCodes: Record<string, { code: string; label: string }> = {
      given: { code: '✓', label: 'Given' },
      refused: { code: 'R', label: 'Refused' },
      missed: { code: 'X', label: 'Missed' },
      omitted: { code: '-', label: 'Omitted' },
      not_available: { code: 'N', label: 'Not Available' },
      'n/a': { code: 'N/A', label: 'Not Applicable' },
      pending: { code: 'P', label: 'Pending' }
    }
    const standardMarCodes = [
      { code: 'R', label: 'Refused', desc: 'Patient refused medication' },
      { code: 'X', label: 'Missed', desc: 'Dose missed (red)' },
      { code: '-', label: 'Omitted', desc: 'Dose omitted (amber)' },
      { code: 'H', label: 'Hospital', desc: 'Patient in hospital/away' },
      { code: 'N', label: 'Not Available', desc: 'Medication not available' },
      { code: 'C', label: 'Clinical', desc: 'Clinical reason (e.g. low BP)' },
      { code: 'D', label: 'Discontinued', desc: 'Medication discontinued' },
      { code: 'S', label: 'Sleeping', desc: 'Patient asleep' },
      { code: 'V', label: 'Vomited', desc: 'Vomited after administration' }
    ]

    const genCodeKeyHtml = (usedInChart: Set<string>) => {
      const items: string[] = []
      for (const s of Object.keys(statusLabels)) {
        if (usedInChart.has(s)) {
          const mc = marCodes[s]
          items.push(`<span style="display:inline-block;margin-right:10px;margin-bottom:3px"><span style="display:inline-block;width:10px;height:10px;background:${statusColors[s]};border-radius:2px;vertical-align:middle;margin-right:3px"></span><strong>${mc?.code || ''}</strong> ${statusLabels[s]}</span>`)
        }
      }
      return items.join('') + '<br><span style="color:#666;font-size:8px">Standard MAR codes: ' +
        standardMarCodes.map(c => `<strong>${c.code}</strong> - ${c.label}`).join(' | ') + '</span>'
    }

    // ── Helper: admin grid cell ──
    const renderCell = (item: MedicationItem, day: string, time: string, isToday: boolean) => {
      const admins = chartData.adminMap[item.id]?.[day]
      const scheduledTime = new Date(`${day}T${time}:00`)
      const existingScheduled = admins?.find((a: Administration) => {
        const aTime = new Date(a.scheduled_time)
        return aTime.getHours() === scheduledTime.getHours() && aTime.getMinutes() === scheduledTime.getMinutes()
      })
      let cell = `<td class="${isToday ? 'today' : ''}" style="padding:1px 2px;text-align:center;font-size:7px;vertical-align:top">`
      if (existingScheduled) {
        const mc = marCodes[existingScheduled.status] || { code: '?', label: '' }
        const initials = ((existingScheduled.first_name?.[0] || '') + (existingScheduled.last_name?.[0] || '')).toUpperCase() || 'S'
        const bg = statusColors[existingScheduled.status] || '#6B7280'
        cell += `<div style="background:${bg};color:#fff;font-weight:bold;font-size:8px;padding:1px 2px;border-radius:2px;line-height:1.3">${mc.code} ${initials}</div>`
        if (existingScheduled.notes) {
          cell += `<div style="font-size:5px;color:#555;line-height:1.2;margin-top:1px">${existingScheduled.notes.substring(0, 20)}</div>`
        }
      } else {
        cell += '<span style="color:#ddd;font-size:8px">&bull;</span>'
      }
      cell += '</td>'
      return cell
    }

    // ── Build print HTML ──
    let html = `
    <html><head><title>MAR Chart - ${chartData.record.title}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, 'Helvetica Neue', sans-serif; font-size: 9px; margin: 6mm 8mm; color: #111; line-height: 1.3; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; border-bottom: 2px solid #222; padding-bottom: 4px; }
      .header h1 { margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
      .header .sub { color: #555; font-size: 8px; }
      .pat-section { border: 1.5px solid #333; padding: 4px 6px; margin-bottom: 5px; position: relative; }
      .pat-section h2 { font-size: 10px; margin-bottom: 3px; background: #222; color: #fff; display: inline-block; padding: 1px 8px; position: absolute; top: -10px; left: 6px; }
      .pat-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1px 15px; font-size: 8px; margin-top: 6px; }
      .pat-grid .label { color: #666; }
      .pat-grid .val { font-weight: bold; }
      .allergy-box { background: #FEF2F2; border: 1px solid #FECACA; padding: 2px 5px; border-radius: 2px; display: inline-block; }
      .allergy-box .allergen { color: #DC2626; font-weight: bold; }
      .section-title { font-size: 9px; font-weight: bold; background: #333; color: #fff; padding: 2px 6px; margin: 6px 0 3px 0; text-transform: uppercase; letter-spacing: 0.3px; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 4px; }
      th, td { border: 1px solid #999; padding: 1px 2px; text-align: center; font-size: 7px; }
      th { background: #ddd; font-weight: bold; }
      .med-label { text-align: left; font-weight: bold; white-space: nowrap; min-width: 100px; font-size: 7px; line-height: 1.2; }
      .med-label .name { font-size: 8px; }
      .med-label .detail { font-weight: normal; font-size: 6px; color: #444; }
      .today { background: #EFF6FF; }
      .footer { margin-top: 6px; font-size: 7px; color: #888; border-top: 1px solid #ccc; padding-top: 4px; }
      .page-break { page-break-before: always; }
      .key-section { font-size: 7px; margin: 4px 0; }
      .signature-table td { padding: 3px 6px; height: 20px; }
      .empty-section { text-align: center; color: #999; padding: 8px; font-size: 8px; border: 1px dashed #ccc; }
      .flex-row { display: flex; gap: 8px; }
      .flex-row > div { flex: 1; }
      .note-line { border-bottom: 1px solid #ccc; height: 16px; margin-bottom: 2px; }
      .warn-box { background: #FFFBEB; border: 1px solid #FDE68A; padding: 3px 6px; margin: 4px 0; font-size: 7px; }
      .med-group { page-break-inside: avoid; }
      @page { size: landscape; margin: 6mm; }
    </style></head><body>

    <div class="header">
      <div>
        <h1>Medication Administration Record (MAR)</h1>
        <div class="sub">${chartData.record.title}</div>
      </div>
      <div style="text-align:right;font-size:8px">
        <div>Printed: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
        <div>Chart ID: ${chartData.record.id?.substring(0, 8) || '-'}</div>
      </div>
    </div>

    <div class="pat-section" style="margin-top:4px">
      <h2>PATIENT INFORMATION</h2>
      <div style="display:flex;gap:4px;margin-top:7px">
        <div style="flex:1">
          <table style="margin:0">
            <tr><td style="width:80px;text-align:left;background:#eee;font-weight:bold">Name</td><td style="text-align:left;font-weight:bold;font-size:9px">${suName}</td></tr>
            <tr><td style="text-align:left;background:#eee;font-weight:bold">NHS Number</td><td style="text-align:left">${nhsNumber}</td></tr>
            <tr><td style="text-align:left;background:#eee;font-weight:bold">Date of Birth</td><td style="text-align:left">${dob}${age ? ` (${age} years)` : ''}</td></tr>
            <tr><td style="text-align:left;background:#eee;font-weight:bold">Room / Bed</td><td style="text-align:left">${room || 'N/A'}</td></tr>
            <tr><td style="text-align:left;background:#eee;font-weight:bold">Weight</td><td style="text-align:left">${weight || '________ kg'}</td></tr>
          </table>
        </div>
        <div style="flex:1">
          <table style="margin:0">
            <tr><td style="width:80px;text-align:left;background:#eee;font-weight:bold">GP / Surgery</td><td style="text-align:left">${gpName ? `${gpName}${gpSurgery ? `, ${gpSurgery}` : ''}` : '_________________'}</td></tr>
            <tr><td style="text-align:left;background:#eee;font-weight:bold">GP Phone</td><td style="text-align:left">${gpPhone || '_________________'}</td></tr>
            <tr><td style="text-align:left;background:#eee;font-weight:bold">Pharmacy</td><td style="text-align:left">${pharmacyName ? `${pharmacyName}${pharmacyPhone ? ` &mdash; ${pharmacyPhone}` : ''}` : '_________________'}</td></tr>
            <tr><td style="text-align:left;background:#eee;font-weight:bold">Social Worker</td><td style="text-align:left">${socialWorkerName ? `${socialWorkerName}${socialWorkerPhone ? ` &mdash; ${socialWorkerPhone}` : ''}` : '_________________'}</td></tr>
            <tr><td style="text-align:left;background:#eee;font-weight:bold">Chart Period</td><td style="text-align:left">${new Date(chartData.record.start_date).toLocaleDateString()} &ndash; ${new Date(chartData.record.end_date).toLocaleDateString()}</td></tr>
          </table>
        </div>
      </div>
    </div>`

    // ── Allergy section ──
    html += `<div class="pat-section" style="margin-top:8px">
      <h2>ALLERGIES &amp; ADVERSE REACTIONS</h2>
      <div style="margin-top:7px">
        <table style="margin:0">
          <tr><th style="width:40%">Allergen / Drug</th><th style="width:25%">Reaction</th><th style="width:15%">Severity</th><th style="width:20%">Date Identified</th></tr>
          ${allergiesList.length > 0 ? allergiesList.map(a => `<tr><td style="text-align:left" class="allergy-box"><span class="allergen">${a.name}</span></td><td style="text-align:left">${a.reaction}</td><td style="text-align:center">${a.severity}</td><td style="text-align:center">${a.date}</td></tr>`).join('') : '<tr><td colspan="4" style="text-align:center">No known allergies (NKA)</td></tr>'}
        </table>
      </div>
    </div>`

    // ── Prescription Information ──
    const pItem = chartData.items.find((i: any) => i.prescriber_name)
    html += `<div class="section-title">Prescription Information</div>
    <div class="flex-row">
      <div>
        <table>
          <tr><td style="text-align:left;background:#eee;width:100px">Prescriber Name</td><td style="text-align:left">${pItem?.prescriber_name || '___________________'}</td></tr>
          <tr><td style="text-align:left;background:#eee">Prescriber Phone</td><td style="text-align:left">${pItem?.prescriber_phone || '___________________'}</td></tr>
          <tr><td style="text-align:left;background:#eee">Pharmacy</td><td style="text-align:left">${pharmacyName || '___________________'}</td></tr>
        </table>
      </div>
      <div>
        <table>
          <tr><td style="text-align:left;background:#eee;width:100px">Prescription Ref</td><td style="text-align:left">${pItem?.prescription_ref || '___________________'}</td></tr>
          <tr><td style="text-align:left;background:#eee">Date Prescribed</td><td style="text-align:left">${pItem?.start_date ? new Date(pItem.start_date).toLocaleDateString() : '___________________'}</td></tr>
          <tr><td style="text-align:left;background:#eee">Last Review Date</td><td style="text-align:left">___________________</td></tr>
        </table>
      </div>
    </div>
    <div style="font-size:6px;color:#999;margin-bottom:4px">Prescriber details shown from first item with prescriber data. See individual medication rows for item-specific prescribers.</div>`

    // ── Codes Key ──
    html += `<div class="key-section">
      <strong>Administration Codes Used in This Chart:</strong><br>
      ${genCodeKeyHtml(codesUsedStatus)}
    </div>`

    // ── REGULAR MEDICATION GRID ──
    const renderGrid = (items: MedicationItem[], label: string) => {
      if (items.length === 0) return ''
      const rows = items.flatMap(item => item.times.map((time: string) => ({ item, time })))
      let g = `<div class="section-title">${label}</div><table><thead><tr>`
      g += `<th style="min-width:130px;text-align:left">Medication &amp; Instructions</th>`
      for (const day of days) {
        const isToday = day === today
        const dayDate = new Date(day + 'T12:00:00')
        const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dayDate.getDay()]
        g += `<th class="${isToday ? 'today' : ''}" style="min-width:16px;font-size:6px;padding:1px">${dayDate.getDate()}<br><span style="font-weight:normal;font-size:5px">${dayName}</span></th>`
      }
      g += '</tr></thead><tbody>'
      for (const { item, time } of rows) {
        const routeUpper = item.route?.toUpperCase() || ''
        const freqUpper = item.frequency?.toUpperCase() || ''
        const courseDates = item.start_date && item.end_date
          ? ` (${new Date(item.start_date).toLocaleDateString()}-${new Date(item.end_date).toLocaleDateString()})`
          : ''
        g += `<tr><td class="med-label">
          <span class="name">${item.name}</span>
          <span class="detail">${item.dosage}${item.unit} ${routeUpper}</span><br>
          <span class="detail">${freqUpper} @ ${time}${courseDates}</span>
          ${item.instructions ? `<br><span class="detail" style="color:#B45309">${item.instructions}</span>` : ''}
        </td>`
        for (const day of days) {
          g += renderCell(item, day, time, day === today)
        }
        g += '</tr>'
      }
      g += '</tbody></table>'
      return g
    }

    html += renderGrid(regularItemsStandard, 'Regular Medications (Oral / Inhaled / Other)')
    html += renderGrid(regularItemsTopical, 'Topical Medications (Creams, Ointments, Lotions)')
    html += renderGrid(regularItemsInject, 'Injectable Medications (IM / SC / IV)')

    // ── Patch Medications ──
    if (regularItemsPatch.length > 0) {
      html += `<div class="section-title">Patch (Transdermal) Medications</div>
      <table><thead><tr>
        <th>Medication &amp; Strength</th>
        <th>Date Applied</th>
        <th>Time Applied</th>
        <th>Body Location</th>
        <th>Date Removed</th>
        <th>Time Removed</th>
        <th>Staff Initials</th>
        <th>Notes</th>
      </tr></thead><tbody>`
      for (const patchItem of regularItemsPatch) {
        let hasEntries = false
        if (chartData.adminMap[patchItem.id]) {
          for (const dateKey of Object.keys(chartData.adminMap[patchItem.id])) {
            for (const a of chartData.adminMap[patchItem.id][dateKey]) {
              hasEntries = true
              const initials = ((a.first_name?.[0] || '') + (a.last_name?.[0] || '')).toUpperCase() || 'S'
              html += `<tr>
                <td style="font-weight:bold">${patchItem.name} ${patchItem.dosage}${patchItem.unit}</td>
                <td>${new Date(a.scheduled_time).toLocaleDateString('en-GB')}</td>
                <td>${new Date(a.scheduled_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
                <td></td>
                <td></td>
                <td></td>
                <td>${initials}</td>
                <td style="font-size:6px">${a.notes || ''}</td>
              </tr>`
            }
          }
        }
        if (!hasEntries) {
          html += `<tr><td style="font-weight:bold">${patchItem.name} ${patchItem.dosage}${patchItem.unit}</td><td colspan="7" style="color:#999;font-size:7px">No administrations recorded this period</td></tr>`
        }
      }
      html += '</tbody></table>'
    }

    // ── Variable Dose Medications (e.g. Insulin, Warfarin) ──
    const variableDoseItems = regularItems.filter(i =>
      i.name.toLowerCase().includes('insulin') ||
      i.name.toLowerCase().includes('warfarin') ||
      i.name.toLowerCase().includes('heparin') ||
      i.name.toLowerCase().includes('inr') ||
      i.instructions?.toLowerCase().includes('sliding') ||
      i.instructions?.toLowerCase().includes('variable')
    )
    if (variableDoseItems.length > 0) {
      html += `<div class="section-title">Variable Dose Medications</div>
      <table><thead><tr>
        <th>Medication</th><th>Date</th><th>Time</th><th>Test Result</th><th>Dose Given</th><th>Staff Initials</th><th>Notes</th>
      </tr></thead><tbody>`
      for (const vdi of variableDoseItems) {
        let hasData = false
        if (chartData.adminMap[vdi.id]) {
          for (const dateKey of Object.keys(chartData.adminMap[vdi.id])) {
            for (const a of chartData.adminMap[vdi.id][dateKey]) {
              hasData = true
              const initials = ((a.first_name?.[0] || '') + (a.last_name?.[0] || '')).toUpperCase() || 'S'
              html += `<tr>
                <td style="font-weight:bold">${vdi.name} ${vdi.dosage}${vdi.unit}</td>
                <td>${new Date(a.scheduled_time).toLocaleDateString('en-GB')}</td>
                <td>${new Date(a.scheduled_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
                <td>____</td>
                <td>____ ${vdi.unit}</td>
                <td>${initials}</td>
                <td style="font-size:6px">${a.notes || ''}</td>
              </tr>`
            }
          }
        }
        if (!hasData) {
          html += `<tr><td style="font-weight:bold">${vdi.name} ${vdi.dosage}${vdi.unit}</td><td colspan="6" style="color:#999;font-size:7px">No administrations this period. Prescribed dose: ${vdi.dosage}${vdi.unit} ${vdi.frequency} — ${vdi.instructions || ''}</td></tr>`
        }
      }
      html += '</tbody></table>'
    }

    // ── PRN Medications ──
    if (prnItems.length > 0) {
      html += `<div class="page-break"></div><div class="section-title">PRN (As Required) Medications</div>`
      // PRN header section with indication and max dose info
      for (const prnItem of prnItems) {
        html += `<div style="border:1px solid #ccc;padding:2px 4px;margin-bottom:3px;font-size:7px">
          <strong>${prnItem.name}</strong> ${prnItem.dosage}${prnItem.unit} &mdash; ${prnItem.route?.toUpperCase()} &mdash; ${prnItem.frequency}
          <span style="float:right">Max in 24h: ${prnItem.instructions?.match(/max[^]*?\d+\s*(dose|mg|tablet)/i)?.[0] || 'As per prescriber'}</span>
          <br><span style="color:#555">Indication: ${prnItem.instructions || 'As required'} &nbsp; Min interval: ${prnItem.frequency}</span>
        </div>`
      }
      html += `<table><thead><tr>
        <th style="min-width:100px">Medication &amp; Dose</th>
        <th style="min-width:60px">Date / Time</th>
        <th style="min-width:30px">Dose</th>
        <th style="min-width:60px">Reason / Indication</th>
        <th style="min-width:50px">Effectiveness<br><span style="font-weight:normal;font-size:6px">(1-5 or description)</span></th>
        <th style="min-width:40px">Staff</th>
        <th style="min-width:50px">Batch / Expiry</th>
        <th style="min-width:60px">Notes</th>
      </tr></thead><tbody>`
      const prnAdmins: any[] = []
      for (const item of prnItems) {
        if (chartData.adminMap[item.id]) {
          for (const dateKey of Object.keys(chartData.adminMap[item.id])) {
            for (const a of chartData.adminMap[item.id][dateKey]) {
              prnAdmins.push({ ...a, item })
            }
          }
        }
      }
      prnAdmins.sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())
      for (const pa of prnAdmins) {
        const initials = ((pa.first_name?.[0] || '') + (pa.last_name?.[0] || '')).toUpperCase() || 'S'
        const timeStr = new Date(pa.scheduled_time).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        const batchExp = [pa.batch_number, pa.expiry_date].filter(Boolean).join(' / ') || '-'
        html += `<tr>
          <td style="font-weight:bold;text-align:left">${pa.item.name} ${pa.item.dosage}${pa.item.unit}</td>
          <td>${timeStr}</td>
          <td>${pa.item.dosage}${pa.item.unit}</td>
          <td style="text-align:left;font-size:7px">${pa.prn_reason || '-'}</td>
          <td>${pa.prn_effectiveness || '-'}</td>
          <td>${initials}</td>
          <td style="font-size:6px">${batchExp}</td>
          <td style="font-size:6px;text-align:left">${pa.notes || ''}</td>
        </tr>`
      }
      if (prnAdmins.length === 0) {
        html += '<tr><td colspan="8" style="text-align:center;color:#999;padding:6px">No PRN administrations recorded this period.</td></tr>'
      }
      html += '</tbody></table>'
    }

    // ── Controlled Drugs ──
    html += `<div class="section-title">Controlled Drug Record</div>
    <table><thead><tr>
      <th>Date</th><th>Medication</th><th>Dose</th><th>Time</th>
      <th>Running Balance</th><th>Deducted</th><th>Remaining</th>
      <th>Administered By</th><th>Witness</th><th>Batch No.</th>
    </tr></thead><tbody>`
    const cdItems = [...regularItems, ...prnItems].filter(i => i.is_controlled_drug)
    const cdAdminMap: any[] = []
    for (const item of cdItems) {
      if (chartData.adminMap[item.id]) {
        for (const dateKey of Object.keys(chartData.adminMap[item.id])) {
          for (const a of chartData.adminMap[item.id][dateKey]) {
            cdAdminMap.push({ ...a, item })
          }
        }
      }
    }
    cdAdminMap.sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())
    if (cdAdminMap.length > 0) {
      for (const cda of cdAdminMap) {
        const initials = ((cda.first_name?.[0] || '') + (cda.last_name?.[0] || '')).toUpperCase() || 'S'
        html += `<tr>
          <td>${new Date(cda.scheduled_time).toLocaleDateString('en-GB')}</td>
          <td style="text-align:left">${cda.item.name}</td>
          <td>${cda.item.dosage}${cda.item.unit}</td>
          <td>${new Date(cda.scheduled_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
          <td>______</td>
          <td>${cda.item.dosage}${cda.item.unit}</td>
          <td>______</td>
          <td>${initials}</td>
          <td>______</td>
          <td style="font-size:6px">${cda.batch_number || ''}</td>
        </tr>`
      }
    } else {
      // Show blank rows for manual completion
      html += '<tr><td colspan="10" style="text-align:center;color:#999;font-size:7px">No controlled drug administrations in this period. Complete below if applicable.</td></tr>'
      for (let i = 0; i < 5; i++) {
        html += '<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>'
      }
    }
    html += '</tbody></table>'

    // ── Monitoring Information ──
    html += `<div class="section-title">Monitoring / Observations (if applicable)</div>
    <div class="flex-row">
      <div>
        <table>
          <tr><th>Date</th><th>Time</th><th>BP</th><th>Pulse</th><th>Temp</th><th>O2 Sat</th><th>Pain Score</th><th>BM/Glu</th><th>Staff</th></tr>
          ${days.filter((_, i) => i % 3 === 0).slice(0, 10).map(day => `
            <tr>
              <td>${new Date(day + 'T12:00:00').toLocaleDateString('en-GB')}</td>
              <td>___</td><td>___</td><td>___</td><td>___</td><td>___</td><td>___</td><td>___</td><td>___</td>
            </tr>`).join('')}
        </table>
      </div>
    </div>`

    // ── Additional Instructions ──
    const hasInstructions = [...regularItems, ...prnItems].some(i => i.instructions)
    html += `<div class="section-title">Additional Instructions</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px;font-size:7px;margin-bottom:4px">`
    if (hasInstructions) {
      const seen = new Set<string>()
      for (const item of [...regularItems, ...prnItems]) {
        if (item.instructions && !seen.has(item.instructions)) {
          seen.add(item.instructions)
          html += `<span style="background:#f0f0f0;padding:1px 5px;border:1px solid #ddd;border-radius:2px"><strong>${item.name}:</strong> ${item.instructions}</span>`
        }
      }
    }
    html += `<span style="background:#f0f0f0;padding:1px 5px;border:1px solid #ddd;border-radius:2px">__________________</span>
    <span style="background:#f0f0f0;padding:1px 5px;border:1px solid #ddd;border-radius:2px">__________________</span>
    </div>`

    // ── Omission / Refusal Reasons ──
    html += `<div class="section-title">Omission &amp; Refusal Records</div>
    <table><thead><tr>
      <th style="width:15%">Date</th><th style="width:15%">Time</th><th style="width:20%">Medication</th>
      <th style="width:10%">Code</th><th style="width:30%">Reason</th><th style="width:10%">Staff</th>
    </tr></thead><tbody>`
    const omittedOrRefused: any[] = []
    if (chartData.adminMap) {
      for (const itemId of Object.keys(chartData.adminMap)) {
        for (const dateKey of Object.keys(chartData.adminMap[itemId])) {
          for (const a of chartData.adminMap[itemId][dateKey]) {
            if (a.status === 'refused' || a.status === 'missed' || a.status === 'omitted') {
              const item = chartData.items.find((i: any) => i.id === itemId)
              omittedOrRefused.push({ ...a, item, dateKey })
            }
          }
        }
      }
    }
    omittedOrRefused.sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())
    if (omittedOrRefused.length > 0) {
      for (const o of omittedOrRefused) {
        const mc = marCodes[o.status] || { code: '?' }
        const initials = ((o.first_name?.[0] || '') + (o.last_name?.[0] || '')).toUpperCase() || 'S'
        html += `<tr>
          <td>${new Date(o.scheduled_time).toLocaleDateString('en-GB')}</td>
          <td>${new Date(o.scheduled_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
          <td style="text-align:left">${o.item?.name || ''}</td>
          <td><strong>${mc.code}</strong></td>
          <td style="text-align:left;font-size:7px">${o.notes || ''}</td>
          <td>${initials}</td>
        </tr>`
      }
    } else {
      html += '<tr><td colspan="6" style="text-align:center;color:#999">No omitted or refused doses recorded this period.</td></tr>'
    }
    html += '</tbody></table>'

    // ── Staff Signatures ──
    html += `<div class="page-break"></div><div class="section-title">Staff Identification &amp; Signatures</div>
    <table class="signature-table"><thead><tr>
      <th style="width:8%">Initials</th>
      <th style="width:22%">Printed Name</th>
      <th style="width:18%">Signature</th>
      <th style="width:8%">Date</th>
      <th style="width:22%">Job Title / Role</th>
      <th style="width:22%">PIN / Registration No.</th>
    </tr></thead><tbody>`
    for (const s of staffLookup) {
      html += `<tr><td style="font-weight:bold;text-align:center;font-size:9px">${s.initials}</td>
        <td>${s.name}</td>
        <td></td>
        <td></td>
        <td>${s.role || ''}</td>
        <td></td>
      </tr>`
    }
    if (staffLookup.length === 0) {
      html += '<tr><td colspan="6" style="text-align:center;color:#999;padding:8px">No staff recorded this period.</td></tr>'
    }
    html += `<tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    </tbody></table>`

    // ── Audit Trail ──
    html += `<div class="section-title">Audit &amp; Review</div>
    <div class="flex-row">
      <div>
        <table>
          <tr><td style="text-align:left;background:#eee;width:120px">Chart Version</td><td style="text-align:left">1.0</td></tr>
          <tr><td style="text-align:left;background:#eee">Date Chart Created</td><td style="text-align:left">${new Date(chartData.record.start_date).toLocaleDateString()}</td></tr>
          <tr><td style="text-align:left;background:#eee">Last Review Date</td><td style="text-align:left">${new Date().toLocaleDateString('en-GB')}</td></tr>
          <tr><td style="text-align:left;background:#eee">Next Review Date</td><td style="text-align:left">_________________</td></tr>
          <tr><td style="text-align:left;background:#eee">Checked by Pharmacist</td><td style="text-align:left">_________________</td></tr>
        </table>
      </div>
      <div>
        <table>
          <tr><td style="text-align:left;background:#eee;width:120px">Care Setting</td><td style="text-align:left">${chartData.record.title.includes('MAR') ? 'eMAR' : 'Care Home / Supported Living'}</td></tr>
          <tr><td style="text-align:left;background:#eee">Items on Chart</td><td style="text-align:left">${chartData.items.length} (${regularItems.length} regular, ${prnItems.length} PRN)</td></tr>
          <tr><td style="text-align:left;background:#eee">Days Covered</td><td style="text-align:left">${days.length}</td></tr>
          <tr><td style="text-align:left;background:#eee">Chart Status</td><td style="text-align:left">${chartData.record.status}</td></tr>
          <tr><td style="text-align:left;background:#eee">Total Administrations</td><td style="text-align:left">${Object.values(chartData.adminMap).reduce((sum: number, byItem: any) => sum + Object.values(byItem).reduce((s: number, arr: any) => s + arr.length, 0), 0)}</td></tr>
        </table>
      </div>
    </div>`

    // ── Notes / Comments ──
    html += `<div class="section-title">Notes &amp; Comments</div>
    <div style="border:1px solid #999;padding:4px;min-height:40px;margin-bottom:4px">`
    const allNotes = new Set<string>()
    if (chartData.adminMap) {
      for (const itemId of Object.keys(chartData.adminMap)) {
        for (const dateKey of Object.keys(chartData.adminMap[itemId])) {
          for (const a of chartData.adminMap[itemId][dateKey]) {
            if (a.notes && a.notes.length > 5) allNotes.add(`[${new Date(a.scheduled_time).toLocaleDateString('en-GB')} ${new Date(a.scheduled_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}] ${a.notes}`)
          }
        }
      }
    }
    if (allNotes.size > 0) {
      for (const note of allNotes) {
        html += `<div style="font-size:7px;margin-bottom:2px;padding:1px 3px;background:#f9f9f9">&bull; ${note}</div>`
      }
    }
    html += `<div class="note-line"></div><div class="note-line"></div><div class="note-line"></div>
    <div class="note-line"></div><div class="note-line"></div>
    </div>`

    // ── Footer ──
    html += `<div class="footer">
      MAR Chart &mdash; ${chartData.record.title} &mdash; ${suName} &mdash; NHS No: ${nhsNumber} &mdash; Printed: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}<br>
      This record must be completed at the time of administration. Any error or omission must be reported immediately to the prescriber and recorded as an incident.
    </div>
    </body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
  }

  const handlePrintRedacted = () => {
    if (!chartData) return
    const today = todayStr()
    const days = chartData.days

    const su = (people || []).find((u: any) => u.id === chartData.record.person_id)
    const age = su?.date_of_birth ? Math.floor((Date.now() - new Date(su.date_of_birth).getTime()) / 31557600000) : ''

    const topicalRoutes = new Set(['topical', 'cream', 'ointment', 'gel', 'lotion'])
    const injectionRoutes = new Set(['im', 'intramuscular', 'iv', 'intravenous', 'sc', 'subcutaneous'])
    const patchRoutes = new Set(['transdermal', 'patch'])

    const regularItemsTopical = regularItems.filter(i => topicalRoutes.has(i.route?.toLowerCase()))
    const regularItemsInject = regularItems.filter(i => injectionRoutes.has(i.route?.toLowerCase()))
    const regularItemsPatch = regularItems.filter(i => patchRoutes.has(i.route?.toLowerCase()))
    const regularItemsStandard = regularItems.filter(i =>
      !topicalRoutes.has(i.route?.toLowerCase()) &&
      !injectionRoutes.has(i.route?.toLowerCase()) &&
      !patchRoutes.has(i.route?.toLowerCase())
    )

    const staffLookup: { initials: string; name: string; role?: string; id?: string }[] = []
    if (chartData?.adminMap) {
      const seen = new Set<string>()
      for (const itemId of Object.keys(chartData.adminMap)) {
        for (const dateKey of Object.keys(chartData.adminMap[itemId])) {
          for (const a of chartData.adminMap[itemId][dateKey]) {
            const key = a.first_name + '|' + a.last_name
            if (!seen.has(key)) {
              seen.add(key)
              const initials = ((a.first_name?.[0] || '') + (a.last_name?.[0] || '')).toUpperCase() || 'S'
              const staffMatch = (staffList || []).find((s: any) =>
                s.first_name === a.first_name && s.last_name === a.last_name
              )
              staffLookup.push({
                initials,
                name: `${a.first_name} ${a.last_name}`,
                role: staffMatch?.role || '',
                id: a.staff_id || staffMatch?.id || staffMatch?.staff_id || ''
              })
            }
          }
        }
      }
    }

    const codesUsedStatus = new Set<string>()
    if (chartData?.adminMap) {
      for (const itemId of Object.keys(chartData.adminMap)) {
        for (const dateKey of Object.keys(chartData.adminMap[itemId])) {
          for (const a of chartData.adminMap[itemId][dateKey]) {
            codesUsedStatus.add(a.status)
          }
        }
      }
    }
    const statusLabels: Record<string, string> = {
      given: 'Given', refused: 'Refused', missed: 'Missed',
      omitted: 'Omitted',
      not_available: 'Not Available', 'n/a': 'N/A', pending: 'Pending'
    }
    const statusColors: Record<string, string> = {
      given: '#16A34A', refused: '#DC2626', missed: '#DC2626',
      omitted: '#D97706',
      not_available: '#D97706', pending: '#6B7280', 'n/a': '#9CA3AF'
    }
    const marCodes: Record<string, { code: string; label: string }> = {
      given: { code: '✓', label: 'Given' },
      refused: { code: 'R', label: 'Refused' },
      missed: { code: 'X', label: 'Missed' },
      omitted: { code: '-', label: 'Omitted' },
      not_available: { code: 'N', label: 'Not Available' },
      'n/a': { code: 'N/A', label: 'Not Applicable' },
      pending: { code: 'P', label: 'Pending' }
    }
    const standardMarCodes = [
      { code: 'R', label: 'Refused', desc: 'Patient refused medication' },
      { code: 'X', label: 'Missed', desc: 'Dose missed (red)' },
      { code: '-', label: 'Omitted', desc: 'Dose omitted (amber)' },
      { code: 'H', label: 'Hospital', desc: 'Patient in hospital/away' },
      { code: 'N', label: 'Not Available', desc: 'Medication not available' },
      { code: 'C', label: 'Clinical', desc: 'Clinical reason (e.g. low BP)' },
      { code: 'D', label: 'Discontinued', desc: 'Medication discontinued' },
      { code: 'S', label: 'Sleeping', desc: 'Patient asleep' },
      { code: 'V', label: 'Vomited', desc: 'Vomited after administration' }
    ]

    const genCodeKeyHtml = (usedInChart: Set<string>) => {
      const items: string[] = []
      for (const s of Object.keys(statusLabels)) {
        if (usedInChart.has(s)) {
          const mc = marCodes[s]
          items.push(`<span style="display:inline-block;margin-right:10px;margin-bottom:3px"><span style="display:inline-block;width:10px;height:10px;background:${statusColors[s]};border-radius:2px;vertical-align:middle;margin-right:3px"></span><strong>${mc?.code || ''}</strong> ${statusLabels[s]}</span>`)
        }
      }
      return items.join('') + '<br><span style="color:#666;font-size:8px">Standard MAR codes: ' +
        standardMarCodes.map(c => `<strong>${c.code}</strong> - ${c.label}`).join(' | ') + '</span>'
    }

    const renderCell = (item: MedicationItem, day: string, time: string, isToday: boolean) => {
      const admins = chartData.adminMap[item.id]?.[day]
      const scheduledTime = new Date(`${day}T${time}:00`)
      const existingScheduled = admins?.find((a: Administration) => {
        const aTime = new Date(a.scheduled_time)
        return aTime.getHours() === scheduledTime.getHours() && aTime.getMinutes() === scheduledTime.getMinutes()
      })
      let cell = `<td class="${isToday ? 'today' : ''}" style="padding:1px 2px;text-align:center;font-size:7px;vertical-align:top">`
      if (existingScheduled) {
        const mc = marCodes[existingScheduled.status] || { code: '?', label: '' }
        const initials = ((existingScheduled.first_name?.[0] || '') + (existingScheduled.last_name?.[0] || '')).toUpperCase() || 'S'
        const bg = statusColors[existingScheduled.status] || '#6B7280'
        cell += `<div style="background:${bg};color:#fff;font-weight:bold;font-size:8px;padding:1px 2px;border-radius:2px;line-height:1.3">${mc.code} ${initials}</div>`
        if (existingScheduled.notes) {
          cell += `<div style="font-size:5px;color:#555;line-height:1.2;margin-top:1px">${existingScheduled.notes.substring(0, 20)}</div>`
        }
      } else {
        cell += '<span style="color:#ddd;font-size:8px">&bull;</span>'
      }
      cell += '</td>'
      return cell
    }

    const renderGrid = (items: MedicationItem[], label: string) => {
      if (items.length === 0) return ''
      const rows = items.flatMap(item => item.times.map((time: string) => ({ item, time })))
      let g = `<div class="section-title">${label}</div><table><thead><tr>`
      g += `<th style="min-width:130px;text-align:left">Medication &amp; Instructions</th>`
      for (const day of days) {
        const isToday = day === today
        const dayDate = new Date(day + 'T12:00:00')
        const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dayDate.getDay()]
        g += `<th class="${isToday ? 'today' : ''}" style="min-width:16px;font-size:6px;padding:1px">${dayDate.getDate()}<br><span style="font-weight:normal;font-size:5px">${dayName}</span></th>`
      }
      g += '</tr></thead><tbody>'
      for (const { item, time } of rows) {
        const routeUpper = item.route?.toUpperCase() || ''
        const freqUpper = item.frequency?.toUpperCase() || ''
        const courseDates = item.start_date && item.end_date
          ? ` (${new Date(item.start_date).toLocaleDateString()}-${new Date(item.end_date).toLocaleDateString()})`
          : ''
        g += `<tr><td class="med-label">
          <span class="name">${item.name}</span>
          <span class="detail">${item.dosage}${item.unit} ${routeUpper}</span><br>
          <span class="detail">${freqUpper} @ ${time}${courseDates}</span>
          ${item.instructions ? `<br><span class="detail" style="color:#B45309">${item.instructions}</span>` : ''}
        </td>`
        for (const day of days) {
          g += renderCell(item, day, time, day === today)
        }
        g += '</tr>'
      }
      g += '</tbody></table>'
      return g
    }

    let html = `
    <html><head><title>MAR Chart (Redacted) - ${chartData.record.title}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, 'Helvetica Neue', sans-serif; font-size: 9px; margin: 6mm 8mm; color: #111; line-height: 1.3; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; border-bottom: 2px solid #222; padding-bottom: 4px; }
      .header h1 { margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
      .header .sub { color: #555; font-size: 8px; }
      .pat-section { border: 1.5px solid #333; padding: 4px 6px; margin-bottom: 5px; position: relative; }
      .pat-section h2 { font-size: 10px; margin-bottom: 3px; background: #222; color: #fff; display: inline-block; padding: 1px 8px; position: absolute; top: -10px; left: 6px; }
      .pat-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1px 15px; font-size: 8px; margin-top: 6px; }
      .pat-grid .label { color: #666; }
      .pat-grid .val { font-weight: bold; }
      .section-title { font-size: 9px; font-weight: bold; background: #333; color: #fff; padding: 2px 6px; margin: 6px 0 3px 0; text-transform: uppercase; letter-spacing: 0.3px; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 4px; }
      th, td { border: 1px solid #999; padding: 1px 2px; text-align: center; font-size: 7px; }
      th { background: #ddd; font-weight: bold; }
      .med-label { text-align: left; font-weight: bold; white-space: nowrap; min-width: 100px; font-size: 7px; line-height: 1.2; }
      .med-label .name { font-size: 8px; }
      .med-label .detail { font-weight: normal; font-size: 6px; color: #444; }
      .today { background: #EFF6FF; }
      .footer { margin-top: 6px; font-size: 7px; color: #888; border-top: 1px solid #ccc; padding-top: 4px; }
      .page-break { page-break-before: always; }
      .key-section { font-size: 7px; margin: 4px 0; }
      .signature-table td { padding: 3px 6px; height: 20px; }
      .empty-section { text-align: center; color: #999; padding: 8px; font-size: 8px; border: 1px dashed #ccc; }
      .flex-row { display: flex; gap: 8px; }
      .flex-row > div { flex: 1; }
      .note-line { border-bottom: 1px solid #ccc; height: 16px; margin-bottom: 2px; }
      .redacted-banner { background: #000; color: #fff; text-align: center; padding: 8px; font-size: 14px; font-weight: bold; letter-spacing: 3px; margin-bottom: 6px; text-transform: uppercase; }
      @page { size: landscape; margin: 6mm; }
    </style></head><body>

    <div class="redacted-banner">Redacted Copy — Not for Clinical Use</div>

    <div class="header">
      <div>
        <h1>Medication Administration Record (MAR)</h1>
        <div class="sub">${chartData.record.title} — REDACTED</div>
      </div>
      <div style="text-align:right;font-size:8px">
        <div>Printed: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
        <div>Chart ID: ${chartData.record.id?.substring(0, 8) || '-'}</div>
      </div>
    </div>

    <div class="pat-section" style="margin-top:4px">
      <h2>PATIENT INFORMATION [REDACTED]</h2>
      <div style="display:flex;gap:4px;margin-top:7px">
        <div style="flex:1">
          <table style="margin:0">
            <tr><td style="width:80px;text-align:left;background:#eee;font-weight:bold">Name</td><td style="text-align:left;font-weight:bold;font-size:9px">[REDACTED]</td></tr>
            <tr><td style="text-align:left;background:#eee;font-weight:bold">NHS Number</td><td style="text-align:left">[REDACTED]</td></tr>
            <tr><td style="text-align:left;background:#eee;font-weight:bold">Date of Birth</td><td style="text-align:left">${age ? `[REDACTED] (${age} years)` : '[REDACTED]'}</td></tr>
            <tr><td style="text-align:left;background:#eee;font-weight:bold">Room / Bed</td><td style="text-align:left">[REDACTED]</td></tr>
            <tr><td style="text-align:left;background:#eee;font-weight:bold">Weight</td><td style="text-align:left">________ kg</td></tr>
          </table>
        </div>
        <div style="flex:1">
          <table style="margin:0">
            <tr><td style="width:80px;text-align:left;background:#eee;font-weight:bold">GP / Surgery</td><td style="text-align:left">[REDACTED]</td></tr>
            <tr><td style="text-align:left;background:#eee;font-weight:bold">GP Phone</td><td style="text-align:left">[REDACTED]</td></tr>
            <tr><td style="text-align:left;background:#eee;font-weight:bold">Pharmacy</td><td style="text-align:left">[REDACTED]</td></tr>
            <tr><td style="text-align:left;background:#eee;font-weight:bold">Social Worker</td><td style="text-align:left">[REDACTED]</td></tr>
            <tr><td style="text-align:left;background:#eee;font-weight:bold">Chart Period</td><td style="text-align:left">${new Date(chartData.record.start_date).toLocaleDateString()} &ndash; ${new Date(chartData.record.end_date).toLocaleDateString()}</td></tr>
          </table>
        </div>
      </div>
    </div>

    <div class="pat-section" style="margin-top:8px">
      <h2>ALLERGIES [REDACTED]</h2>
      <div style="margin-top:7px;text-align:center;color:#999;font-size:8px">Information withheld for data protection</div>
    </div>

    <div class="key-section">
      <strong>Administration Codes Used in This Chart:</strong><br>
      ${genCodeKeyHtml(codesUsedStatus)}
    </div>`

    html += renderGrid(regularItemsStandard, 'Regular Medications (Oral / Inhaled / Other)')
    html += renderGrid(regularItemsTopical, 'Topical Medications (Creams, Ointments, Lotions)')
    html += renderGrid(regularItemsInject, 'Injectable Medications (IM / SC / IV)')

    // ── Patch section ──
    if (regularItemsPatch.length > 0) {
      html += `<div class="section-title">Patch (Transdermal) Medications</div>
      <table><thead><tr>
        <th>Medication &amp; Strength</th><th>Date Applied</th><th>Time Applied</th><th>Body Location</th>
        <th>Date Removed</th><th>Time Removed</th><th>Staff Initials</th><th>Notes</th>
      </tr></thead><tbody>`
      for (const patchItem of regularItemsPatch) {
        let hasEntries = false
        if (chartData.adminMap[patchItem.id]) {
          for (const dateKey of Object.keys(chartData.adminMap[patchItem.id])) {
            for (const a of chartData.adminMap[patchItem.id][dateKey]) {
              hasEntries = true
              const initials = ((a.first_name?.[0] || '') + (a.last_name?.[0] || '')).toUpperCase() || 'S'
              html += `<tr>
                <td style="font-weight:bold">${patchItem.name} ${patchItem.dosage}${patchItem.unit}</td>
                <td>${new Date(a.scheduled_time).toLocaleDateString('en-GB')}</td>
                <td>${new Date(a.scheduled_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
                <td></td><td></td><td></td>
                <td>${initials}</td><td style="font-size:6px">${a.notes || ''}</td>
              </tr>`
            }
          }
        }
        if (!hasEntries) {
          html += `<tr><td style="font-weight:bold">${patchItem.name} ${patchItem.dosage}${patchItem.unit}</td><td colspan="7" style="color:#999;font-size:7px">No administrations recorded this period</td></tr>`
        }
      }
      html += '</tbody></table>'
    }

    // ── Variable dose ──
    const variableDoseItems = regularItems.filter(i =>
      i.name.toLowerCase().includes('insulin') || i.name.toLowerCase().includes('warfarin') ||
      i.name.toLowerCase().includes('heparin') || i.name.toLowerCase().includes('inr') ||
      i.instructions?.toLowerCase().includes('sliding') || i.instructions?.toLowerCase().includes('variable')
    )
    if (variableDoseItems.length > 0) {
      html += `<div class="section-title">Variable Dose Medications</div>
      <table><thead><tr><th>Medication</th><th>Date</th><th>Time</th><th>Test Result</th><th>Dose Given</th><th>Staff</th><th>Notes</th></tr></thead><tbody>`
      for (const vdi of variableDoseItems) {
        let hasData = false
        if (chartData.adminMap[vdi.id]) {
          for (const dateKey of Object.keys(chartData.adminMap[vdi.id])) {
            for (const a of chartData.adminMap[vdi.id][dateKey]) {
              hasData = true
              const initials = ((a.first_name?.[0] || '') + (a.last_name?.[0] || '')).toUpperCase() || 'S'
              html += `<tr>
                <td style="font-weight:bold">${vdi.name} ${vdi.dosage}${vdi.unit}</td>
                <td>${new Date(a.scheduled_time).toLocaleDateString('en-GB')}</td>
                <td>${new Date(a.scheduled_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
                <td>____</td><td>____ ${vdi.unit}</td>
                <td>${initials}</td><td style="font-size:6px">${a.notes || ''}</td>
              </tr>`
            }
          }
        }
        if (!hasData) {
          html += `<tr><td style="font-weight:bold">${vdi.name} ${vdi.dosage}${vdi.unit}</td><td colspan="6" style="color:#999;font-size:7px">No administrations this period.</td></tr>`
        }
      }
      html += '</tbody></table>'
    }

    // ── PRN ──
    if (prnItems.length > 0) {
      html += `<div class="page-break"></div><div class="section-title">PRN (As Required) Medications</div>`
      for (const prnItem of prnItems) {
        html += `<div style="border:1px solid #ccc;padding:2px 4px;margin-bottom:3px;font-size:7px">
          <strong>${prnItem.name}</strong> ${prnItem.dosage}${prnItem.unit} &mdash; ${prnItem.route?.toUpperCase()} &mdash; ${prnItem.frequency}</div>`
      }
      html += `<table><thead><tr>
        <th style="min-width:100px">Medication &amp; Dose</th><th style="min-width:60px">Date / Time</th>
        <th style="min-width:30px">Dose</th><th style="min-width:60px">Reason</th>
        <th style="min-width:50px">Effectiveness</th><th style="min-width:40px">Staff</th>
        <th style="min-width:50px">Batch</th><th style="min-width:60px">Notes</th>
      </tr></thead><tbody>`
      const prnAdmins: any[] = []
      for (const item of prnItems) {
        if (chartData.adminMap[item.id]) {
          for (const dateKey of Object.keys(chartData.adminMap[item.id])) {
            for (const a of chartData.adminMap[item.id][dateKey]) {
              prnAdmins.push({ ...a, item })
            }
          }
        }
      }
      prnAdmins.sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())
      for (const pa of prnAdmins) {
        const initials = ((pa.first_name?.[0] || '') + (pa.last_name?.[0] || '')).toUpperCase() || 'S'
        const timeStr = new Date(pa.scheduled_time).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        html += `<tr>
          <td style="font-weight:bold;text-align:left">${pa.item.name} ${pa.item.dosage}${pa.item.unit}</td>
          <td>${timeStr}</td><td>${pa.item.dosage}${pa.item.unit}</td>
          <td style="text-align:left;font-size:7px">${pa.prn_reason || '-'}</td>
          <td>${pa.prn_effectiveness || '-'}</td>
          <td>${initials}</td>
          <td style="font-size:6px">${(pa.batch_number || pa.expiry_date) ? [pa.batch_number, pa.expiry_date].filter(Boolean).join(' / ') : '-'}</td>
          <td style="font-size:6px;text-align:left">${pa.notes || ''}</td>
        </tr>`
      }
      if (prnAdmins.length === 0) {
        html += '<tr><td colspan="8" style="text-align:center;color:#999;padding:6px">No PRN administrations recorded this period.</td></tr>'
      }
      html += '</tbody></table>'
    }

    // ── Controlled drugs ──
    const cdItems = [...regularItems, ...prnItems].filter(i => i.is_controlled_drug)
    html += `<div class="section-title">Controlled Drug Record</div>
    <table><thead><tr><th>Date</th><th>Medication</th><th>Dose</th><th>Time</th><th>Running Balance</th>
      <th>Deducted</th><th>Remaining</th><th>Admin By</th><th>Witness</th><th>Batch</th>
    </tr></thead><tbody>`
    const cdAdminMap: any[] = []
    for (const item of cdItems) {
      if (chartData.adminMap[item.id]) {
        for (const dateKey of Object.keys(chartData.adminMap[item.id])) {
          for (const a of chartData.adminMap[item.id][dateKey]) {
            cdAdminMap.push({ ...a, item })
          }
        }
      }
    }
    cdAdminMap.sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())
    if (cdAdminMap.length > 0) {
      for (const cda of cdAdminMap) {
        const initials = ((cda.first_name?.[0] || '') + (cda.last_name?.[0] || '')).toUpperCase() || 'S'
        html += `<tr>
          <td>${new Date(cda.scheduled_time).toLocaleDateString('en-GB')}</td>
          <td style="text-align:left">${cda.item.name}</td>
          <td>${cda.item.dosage}${cda.item.unit}</td>
          <td>${new Date(cda.scheduled_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
          <td>______</td><td>${cda.item.dosage}${cda.item.unit}</td><td>______</td>
          <td>${initials}</td><td>______</td>
          <td style="font-size:6px">${cda.batch_number || ''}</td>
        </tr>`
      }
    } else {
      html += '<tr><td colspan="10" style="text-align:center;color:#999;font-size:7px">No controlled drug administrations in this period.</td></tr>'
      for (let i = 0; i < 5; i++) {
        html += '<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>'
      }
    }
    html += '</tbody></table>'

    // ── Monitoring ──
    html += `<div class="section-title">Monitoring / Observations</div>
    <div class="flex-row">
      <div>
        <table>
          <tr><th>Date</th><th>Time</th><th>BP</th><th>Pulse</th><th>Temp</th><th>O2 Sat</th><th>Pain</th><th>BM/Glu</th><th>Staff</th></tr>
          ${days.filter((_, i) => i % 3 === 0).slice(0, 10).map(day => `
            <tr><td>${new Date(day + 'T12:00:00').toLocaleDateString('en-GB')}</td>
            <td>___</td><td>___</td><td>___</td><td>___</td><td>___</td><td>___</td><td>___</td><td>___</td></tr>`).join('')}
        </table>
      </div>
    </div>`

    // ── Omissions ──
    html += `<div class="section-title">Omission &amp; Refusal Records</div>
    <table><thead><tr>
      <th style="width:15%">Date</th><th style="width:15%">Time</th><th style="width:20%">Medication</th>
      <th style="width:10%">Code</th><th style="width:30%">Reason</th><th style="width:10%">Staff</th>
    </tr></thead><tbody>`
    const omittedOrRefused: any[] = []
    if (chartData.adminMap) {
      for (const itemId of Object.keys(chartData.adminMap)) {
        for (const dateKey of Object.keys(chartData.adminMap[itemId])) {
          for (const a of chartData.adminMap[itemId][dateKey]) {
            if (a.status === 'refused' || a.status === 'missed' || a.status === 'omitted') {
              const item = chartData.items.find((i: any) => i.id === itemId)
              omittedOrRefused.push({ ...a, item, dateKey })
            }
          }
        }
      }
    }
    omittedOrRefused.sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())
    if (omittedOrRefused.length > 0) {
      for (const o of omittedOrRefused) {
        const mc = marCodes[o.status] || { code: '?' }
        const initials = ((o.first_name?.[0] || '') + (o.last_name?.[0] || '')).toUpperCase() || 'S'
        html += `<tr>
          <td>${new Date(o.scheduled_time).toLocaleDateString('en-GB')}</td>
          <td>${new Date(o.scheduled_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
          <td style="text-align:left">${o.item?.name || ''}</td>
          <td><strong>${mc.code}</strong></td>
          <td style="text-align:left;font-size:7px">${o.notes || ''}</td>
          <td>${initials}</td>
        </tr>`
      }
    } else {
      html += '<tr><td colspan="6" style="text-align:center;color:#999">No omitted or refused doses recorded this period.</td></tr>'
    }
    html += '</tbody></table>'

    // ── Staff Signatures ──
    html += `<div class="section-title">Staff Identification &amp; Signatures</div>
    <table class="signature-table"><thead><tr>
      <th style="width:8%">Initials</th><th style="width:22%">Printed Name</th>
      <th style="width:18%">Signature</th><th style="width:8%">Date</th>
      <th style="width:22%">Job Title</th><th style="width:22%">PIN / Reg No.</th>
    </tr></thead><tbody>`
    for (const s of staffLookup) {
      html += `<tr><td style="font-weight:bold;text-align:center;font-size:9px">${s.initials}</td>
        <td>${s.name}</td><td></td><td></td>
        <td>${s.role || ''}</td><td></td>
      </tr>`
    }
    if (staffLookup.length === 0) {
      html += '<tr><td colspan="6" style="text-align:center;color:#999;padding:8px">No staff recorded this period.</td></tr>'
    }
    html += `<tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    </tbody></table>`

    // ── Audit ──
    html += `<div class="section-title">Audit &amp; Review</div>
    <div class="flex-row">
      <div>
        <table>
          <tr><td style="text-align:left;background:#eee;width:120px">Chart Version</td><td style="text-align:left">1.0</td></tr>
          <tr><td style="text-align:left;background:#eee">Date Chart Created</td><td style="text-align:left">${new Date(chartData.record.start_date).toLocaleDateString()}</td></tr>
          <tr><td style="text-align:left;background:#eee">Last Review Date</td><td style="text-align:left">${new Date().toLocaleDateString('en-GB')}</td></tr>
          <tr><td style="text-align:left;background:#eee">Next Review Date</td><td style="text-align:left">_________________</td></tr>
          <tr><td style="text-align:left;background:#eee">Checked by Pharmacist</td><td style="text-align:left">_________________</td></tr>
        </table>
      </div>
      <div>
        <table>
          <tr><td style="text-align:left;background:#eee;width:120px">Items on Chart</td><td style="text-align:left">${chartData.items.length} (${regularItems.length} regular, ${prnItems.length} PRN)</td></tr>
          <tr><td style="text-align:left;background:#eee">Days Covered</td><td style="text-align:left">${days.length}</td></tr>
          <tr><td style="text-align:left;background:#eee">Chart Status</td><td style="text-align:left">${chartData.record.status}</td></tr>
          <tr><td style="text-align:left;background:#eee">Total Administrations</td><td style="text-align:left">${Object.values(chartData.adminMap).reduce((sum: number, byItem: any) => sum + Object.values(byItem).reduce((s: number, arr: any) => s + arr.length, 0), 0)}</td></tr>
        </table>
      </div>
    </div>`

    // ── Notes ──
    html += `<div class="section-title">Notes &amp; Comments</div>
    <div style="border:1px solid #999;padding:4px;min-height:30px;margin-bottom:4px">`
    const allNotes = new Set<string>()
    if (chartData.adminMap) {
      for (const itemId of Object.keys(chartData.adminMap)) {
        for (const dateKey of Object.keys(chartData.adminMap[itemId])) {
          for (const a of chartData.adminMap[itemId][dateKey]) {
            if (a.notes && a.notes.length > 5) allNotes.add(`[${new Date(a.scheduled_time).toLocaleDateString('en-GB')}] ${a.notes}`)
          }
        }
      }
    }
    if (allNotes.size > 0) {
      for (const note of allNotes) {
        html += `<div style="font-size:7px;margin-bottom:2px;padding:1px 3px;background:#f9f9f9">&bull; ${note}</div>`
      }
    }
    html += `<div class="note-line"></div><div class="note-line"></div>
    </div>

    <div class="footer">
      REDACTED MAR — ${chartData.record.title} — Printed: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}<br>
      This is a redacted copy. All patient-identifiable information has been removed for data protection purposes. Not for clinical use.
    </div>
    </body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
  }

  const getMaxTimesForFrequency = (freq: string): number | null => {
    if (freq === 'once daily') return 1
    if (freq === 'twice daily') return 2
    if (freq === 'three times daily') return 3
    if (freq === 'four times daily') return 4
    if (freq === 'weekly' || freq === 'monthly') return 1
    return null // PRN or unknown — unlimited
  }

  const addTime = () => {
    const t = timeInput.trim()
    if (t && /^\d{1,2}:\d{2}$/.test(t) && !itemForm.times.includes(t)) {
      const maxTimes = getMaxTimesForFrequency(itemForm.frequency)
      if (maxTimes !== null && itemForm.times.length >= maxTimes) {
        const freqLabel = itemForm.frequency || 'this frequency'
        setErrorMsg(`This medication is "${freqLabel}" — maximum ${maxTimes} administration time${maxTimes !== 1 ? 's' : ''} allowed. Remove an existing time first.`)
        setTimeout(() => setErrorMsg(''), 5000)
        return
      }
      setItemForm(p => ({ ...p, times: [...p.times, t].sort() }))
      setTimeInput('')
    }
  }

  const removeTime = (t: string) => {
    setItemForm(p => ({ ...p, times: p.times.filter(x => x !== t) }))
  }

  // Derive display data
  const regularItems = chartData?.items.filter((i: any) => !i.is_prn) || []
  const prnItems = chartData?.items.filter((i: any) => i.is_prn) || []

  // Build per-day admin initials from chartData.adminMap
  const dayAdminsMap: Record<string, { initials: string; first_name: string; last_name: string }[]> = {}
  if (chartData?.adminMap) {
    for (const itemId of Object.keys(chartData.adminMap)) {
      for (const dateKey of Object.keys(chartData.adminMap[itemId])) {
        if (!dayAdminsMap[dateKey]) dayAdminsMap[dateKey] = []
        for (const a of chartData.adminMap[itemId][dateKey]) {
          const initials = ((a.first_name?.[0] || '') + (a.last_name?.[0] || '')).toUpperCase() || 'S'
          if (!dayAdminsMap[dateKey].some(x => x.initials === initials && x.first_name === a.first_name)) {
            dayAdminsMap[dateKey].push({ initials, first_name: a.first_name, last_name: a.last_name })
          }
        }
      }
    }
  }

  const openDayAdminDialog = (day: string) => {
    const all: any[] = []
    if (chartData?.adminMap) {
      for (const itemId of Object.keys(chartData.adminMap)) {
        for (const dateKey of Object.keys(chartData.adminMap[itemId])) {
          if (dateKey === day) {
            const item = chartData.items.find((i: any) => i.id === itemId)
            for (const a of chartData.adminMap[itemId][dateKey]) {
              all.push({ ...a, medication_name: item?.name, medication_dosage: item?.dosage, medication_unit: item?.unit })
            }
          }
        }
      }
    }
    all.sort((a: any, b: any) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())
    setDayAdminDialog({ date: day, admins: all })
  }
  const medGroupColors = ['#F0F9FF', '#FEF2F2', '#F0FDF4', '#FFFBEB', '#FAF5FF', '#FDF2F8', '#ECFEFF', '#F5F5F4']
  const getMedColor = (index: number) => medGroupColors[index % medGroupColors.length]

  const lowStockItems = (stockData || []).filter((s: StockItem) => s.quantity <= s.reorder_level && s.status !== 'archived')

  const maxForwardMonth = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 3)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })()

  const handleStockSave = () => {
    const data: any = { ...stockForm }
    if (stockPerson) {
      data.person_id = stockPerson.id
    }
    if (editStock) {
      stockUpdateMutation.mutate({ id: editStock.id, data })
    } else {
      stockCreateMutation.mutate(data)
    }
  }

  const openStockDialog = (item?: StockItem) => {
    if (item) {
      setEditStock(item)
      setStockForm({
        medication_name: item.medication_name, dosage: item.dosage, unit: item.unit,
        batch_number: item.batch_number, expiry_date: item.expiry_date,
        quantity: item.quantity, quantity_unit: item.quantity_unit,
        reorder_level: item.reorder_level, location: item.location
      })
      if (item.person_id) {
        const su = (people || []).find((u: any) => u.id === item.person_id)
        setStockPerson(su || null)
      } else {
        setStockPerson(null)
      }
    } else {
      setEditStock(null)
      setStockForm({ medication_name: '', dosage: '', unit: 'mg', batch_number: '', expiry_date: '', quantity: 0, quantity_unit: 'tablets', reorder_level: 10, location: '' })
      setStockPerson(null)
    }
    setStockDialog(true)
  }

  const openAdjustDialog = (item: StockItem) => {
    setAdjustStockItem(item)
    setAdjustForm({
      adjustment_type: 'damaged',
      quantity_adjusted: 1,
      reason: '',
      adjusted_by: currentUser.first_name ? `${currentUser.first_name} ${currentUser.last_name}` : ''
    })
    setAdjustDialog(true)
  }

  const addDeliveryItem = () => {
    if (!deliveryItemForm.medication_name || !deliveryItemForm.quantity) return
    setDeliveryForm(p => ({
      ...p, items: [...p.items, { ...deliveryItemForm, id: Date.now().toString() }]
    }))
    setDeliveryItemForm({ medication_name: '', dosage: '', unit: 'mg', batch_number: '', expiry_date: '', quantity: 0, quantity_unit: 'tablets' })
  }

  const removeDeliveryItem = (id: string) => {
    setDeliveryForm(p => ({ ...p, items: p.items.filter((i: any) => i.id !== id) }))
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} className="no-print">
        <Typography variant="h4">Medication (eMAR)</Typography>
        <Stack direction="row" spacing={1}>
          {overdueData && overdueData.length > 0 && (
            <Chip icon={<WarningIcon />} label={`${overdueData.length} overdue`} color="error" size="small" />
          )}
          {tab === 1 && lowStockItems.length > 0 && (
            <Chip icon={<WarningIcon />} label={`${lowStockItems.length} low stock`} color="warning" size="small" />
          )}
        </Stack>
      </Stack>

      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg('')}>{successMsg}</Alert>
      )}

      {(suError || recordsError || chartError || (tab === 1 && stockError)) && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => {}}>
          Failed to load data. Please try refreshing the page.
        </Alert>
      )}

      {/* Overdue Alert */}
      {overdueData && overdueData.length > 0 && tab === 0 && (
        <Alert severity="error" sx={{ mb: 2 }} icon={<WarningIcon />}>
          {overdueData.length} overdue medication administration{overdueData.length > 1 ? 's' : ''}.{' '}
          {overdueData.slice(0, 3).map((a: any) => a.person_name).join(', ')}
          {overdueData.length > 3 ? ` and ${overdueData.length - 3} more` : ''} require attention.
        </Alert>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="MAR Chart" icon={<MedIcon />} iconPosition="start" />
          <Tab label="Stock" icon={<InventoryIcon />} iconPosition="start" />
          <Tab label="Deliveries" icon={<DeliveryIcon />} iconPosition="start" />
          <Tab label="Daily Counts" icon={<CheckIcon />} iconPosition="start" />
          <Tab label="Audit Log" icon={<AuditIcon />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* ═══ TAB 0: MAR Chart ═══ */}
      {tab === 0 && (
        <>
          {/* Person Selector */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Autocomplete
              options={people || []}
              getOptionLabel={(o: any) => `${o.first_name} ${o.last_name}`}
              value={selectedPerson}
              onChange={(_, v) => { setSelectedPerson(v); setSelectedRecordId(null); setMonth(todayStr().slice(0, 7)) }}
              renderInput={(params) => <TextField {...params} label="Search Person" size="small" />}
              sx={{ maxWidth: 400 }}
            />
          </Paper>

          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <Paper sx={{ p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700}>MAR Charts</Typography>
                    <Typography variant="caption" color="text.secondary">One month at a time</Typography>
                  </Box>
                  {selectedPerson && (
                    <Button size="small" variant="outlined" startIcon={<ViewArchivedIcon />}
                      onClick={() => navigate('/emedication/archived')}>
                      Archived
                    </Button>
                  )}
                </Stack>

                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 2 }}>
                  <IconButton size="small" disabled={!recordsData?.length} onClick={() => {
                    const [y, m] = month.split('-').map(Number)
                    const d = new Date(y, m - 2, 1)
                    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
                  }}>
                    <PrevIcon fontSize="small" />
                  </IconButton>
                  <Typography variant="body2" fontWeight={600} sx={{ flex: 1, textAlign: 'center' }}>
                    {formatMonthLabel(month)}
                  </Typography>
                  <IconButton size="small" disabled={month >= maxForwardMonth} onClick={() => {
                    const [y, m] = month.split('-').map(Number)
                    const d = new Date(y, m, 1)
                    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
                  }}>
                    <NextIcon fontSize="small" />
                  </IconButton>
                </Stack>

                {recordsLoading || ensureMarMutation.isPending ? (
                  <CircularProgress size={24} />
                ) : !recordsData || recordsData.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography color="text.secondary" variant="body2">
                      {selectedPerson ? 'No active charts.' : 'Select a person.'}
                    </Typography>
                    {selectedPerson && (
                      <Button size="small" variant="text" startIcon={<ViewArchivedIcon />}
                        onClick={() => navigate('/emedication/archived')} sx={{ mt: 1 }}>
                        View Archived Charts
                      </Button>
                    )}
                  </Box>
                ) : (
                  <Paper variant="outlined" sx={{
                    p: 1.5,
                    bgcolor: activeRecord ? '#F0F9FF' : '#FEF2F2',
                    borderColor: activeRecord ? '#0F4C81' : '#FECACA'
                  }}>
                    {activeRecord ? (
                      <>
                        <Typography variant="body2" fontWeight={700}>{activeRecord.title}</Typography>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                          {new Date(activeRecord.start_date).toLocaleDateString()} – {new Date(activeRecord.end_date).toLocaleDateString()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {chartData?.items?.length || 0} medication{(chartData?.items?.length || 0) !== 1 ? 's' : ''}
                        </Typography>
                      </>
                    ) : (
                      <Typography variant="body2" color="error" sx={{ textAlign: 'center', py: 1 }}>
                        No chart for this month
                      </Typography>
                    )}
                  </Paper>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12} md={9}>
              {!activeRecord ? (
                <Paper sx={{ p: 6, textAlign: 'center' }}>
                  <MedIcon sx={{ fontSize: 48, color: '#D1D5DB', mb: 2 }} />
                  <Typography color="text.secondary">No MAR chart for this month. Use the arrows or click a chart in the sidebar.</Typography>
                </Paper>
              ) : chartLoading ? (
                <Paper sx={{ p: 4, textAlign: 'center' }}><CircularProgress size={24} /></Paper>
              ) : !chartData ? (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                  <Typography color="text.secondary">No chart data available</Typography>
                </Paper>
              ) : (
                <>
                  <Paper sx={{ p: 2, mb: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="h6">{chartData.record.title}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {chartData.record.person_name} &bull; {new Date(chartData.record.start_date).toLocaleDateString()} &ndash; {new Date(chartData.record.end_date).toLocaleDateString()}
                          &nbsp;&bull; {chartData.days.length} days
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        {canManage && (
                          <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => openItemDialog()}>
                            Add Medication
                          </Button>
                        )}
                        {canManage && activeRecord && regularItems.length === 0 && (
                          <Button size="small" variant="outlined" onClick={() => importPrevMutation.mutate(activeRecord.id)} disabled={importPrevMutation.isPending}>
                            {importPrevMutation.isPending ? '...' : 'Import Prev Month'}
                          </Button>
                        )}
                        <Button size="small" variant="outlined" startIcon={<PrintIcon />} endIcon={<ArrowDropDownIcon />} onClick={(e) => setPrintAnchorEl(e.currentTarget)}>
                          Print
                        </Button>
                        <Menu anchorEl={printAnchorEl} open={Boolean(printAnchorEl)} onClose={() => setPrintAnchorEl(null)}>
                          <MenuItem onClick={() => { setPrintAnchorEl(null); handlePrint() }}>
                            Print Full MAR
                          </MenuItem>
                          <MenuItem onClick={() => { setPrintAnchorEl(null); handlePrintRedacted() }}>
                            Print Redacted
                          </MenuItem>
                        </Menu>
                        {canManage && activeRecord && (
                          <Tooltip title="Edit chart">
                            <IconButton size="small" onClick={() => {
                              setEditRecord(activeRecord)
                              setRecordForm({ title: activeRecord.title, start_date: activeRecord.start_date, end_date: activeRecord.end_date })
                              setRecordDialog(true)
                            }}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canManage && activeRecord && (
                          <Tooltip title="Archive chart">
                            <IconButton size="small" color="warning" onClick={() => { setArchiveTargetId(activeRecord.id); setArchiveDialog(true) }}>
                              <ArchiveOutlined fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </Stack>
                  </Paper>

                  {/* MAR Grid - Flat (no collapsible groups) */}
                  {regularItems.length === 0 ? (
                    <Paper sx={{ p: 4, textAlign: 'center' }}>
                      <Typography sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>No medication records found</Typography>
                    </Paper>
                  ) : (
                    <Paper sx={{ overflow: 'hidden' }}>
                      <TableContainer sx={{ maxHeight: 600 }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 700, minWidth: 200, bgcolor: '#F9FAFB', position: 'sticky', left: 0, zIndex: 3, borderRight: '2px solid #E5E7EB' }}>
                                Medication
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700, minWidth: 80, bgcolor: '#F8FAFC', position: 'sticky', left: 200, zIndex: 3, borderRight: '1px solid #E5E7EB' }}>
                                Time
                              </TableCell>
                              {chartData.days.map((day, i) => (
                                <TableCell key={day} align="center" sx={{
                                  fontWeight: 700, fontSize: '0.7rem', p: 0.3, minWidth: 42,
                                  bgcolor: day === todayStr() ? '#EFF6FF' : '#F9FAFB',
                                  borderLeft: i > 0 ? '1px solid #F3F4F6' : 'none',
                                  cursor: 'pointer', '&:hover': { bgcolor: '#DBEAFE' }
                                }}
                                  onClick={() => openDayAdminDialog(day)}
                                >
                                  {new Date(day + 'T12:00:00').getDate()}
                                  <br />
                                  <Typography variant="caption" sx={{ fontSize: '0.55rem', color: '#9CA3AF' }}>
                                    {new Date(day + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' }).slice(0, 2)}
                                  </Typography>
                                </TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(() => {
                              const gridRows = regularItems.flatMap((item: MedicationItem) =>
                                item.times.sort().map((time: string) => ({ item, time }))
                              )
                              let prevItemId = ''
                              let medColorIndex = -1
                              const rows: any[] = []
                              for (const { item, time } of gridRows) {
                                if (item.id !== prevItemId) { medColorIndex++; prevItemId = item.id }
                                const medColor = getMedColor(medColorIndex)
                                rows.push(
                                <TableRow key={item.id + time} hover
                                  sx={{ '&:hover td': { bgcolor: medColor } }}
                                >
                                  <TableCell sx={{
                                    fontWeight: 600, fontSize: '0.75rem',
                                    position: 'sticky', left: 0, bgcolor: medColor, zIndex: 1,
                                    borderRight: '2px solid #E5E7EB', whiteSpace: 'nowrap'
                                  }}>
                                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ opacity: item.is_active ? 1 : 0.5 }}>
                                      <MedIcon sx={{ fontSize: 14, color: item.is_active ? '#0F4C81' : '#9CA3AF' }} />
                                      <span style={{ textDecoration: item.is_active ? 'none' : 'line-through' }}>{item.name}</span>
                                      <Typography variant="caption" color="text.secondary">{item.dosage}{item.unit}</Typography>
                                      <Chip label={item.route} size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 18 }} />
                                      {(() => {
                                        const stock = (stockData || []).find((s: StockItem) => s.id === item.stock_item_id && s.status !== 'archived')
                                        if (stock && stock.quantity !== null && Number(stock.quantity) <= 0) {
                                          return <Chip label="No stock" size="small" color="error" sx={{ fontSize: '0.6rem', height: 18 }} />
                                        }
                                        return null
                                      })()}
                                      {!item.is_active && <Chip label="Archived" size="small" variant="outlined" color="default" sx={{ fontSize: '0.6rem', height: 18 }} />}
                                      {canManage && item.is_active && (
                                        <>
                                          <IconButton size="small" sx={{ ml: 0.5 }} onClick={(e) => { e.stopPropagation(); openItemDialog(item) }}>
                                            <EditIcon sx={{ fontSize: 14 }} />
                                          </IconButton>
                                          <IconButton size="small" color="error" onClick={(e) => {
                                            e.stopPropagation()
                                            setConfirmDialog({ message: 'Remove this medication from the chart?', onConfirm: () => itemDeleteMutation.mutate(item.id) })
                                          }}>
                                            <DeleteIcon sx={{ fontSize: 14 }} />
                                          </IconButton>
                                        </>
                                      )}
                                    </Stack>
                                  </TableCell>
                                  <TableCell sx={{
                                    fontWeight: 500, fontSize: '0.75rem', bgcolor: medColor,
                                    whiteSpace: 'nowrap', borderRight: '1px solid #E5E7EB',
                                    position: 'sticky', left: 200, zIndex: 1
                                  }}>
                                    {time}
                                  </TableCell>
                                  {chartData.days.map((day, i) => {
                                    const isFuture = day > todayStr()
                                    const isCellToday = day === todayStr()
                                    const itemStartDate = item.start_date ? item.start_date.slice(0, 10) : null
                                    const itemEndDate = item.end_date ? item.end_date.slice(0, 10) : null
                                    const isArchived = !item.is_active
                                    const isDisabled = (itemStartDate && day < itemStartDate) || (itemEndDate && day > itemEndDate) || isArchived
                                    const scheduledTime = new Date(`${day}T${time}:00`)
                                    const adminsForSlot = (chartData.adminMap[item.id]?.[day] || []).filter((a: Administration) => {
                                      const aTime = new Date(a.scheduled_time)
                                      return aTime.getHours() === scheduledTime.getHours() && aTime.getMinutes() === scheduledTime.getMinutes()
                                    })
                                    const existingAdmin = getAdminDisplay(adminsForSlot)
                                    const config = existingAdmin ? STATUS_CONFIG[existingAdmin.status as AdminStatus] : null
                                    return (
                                      <TableCell key={day} align="center" sx={{
                                        p: 0, minWidth: 36,
                                        cursor: (isFuture || isDisabled) ? 'default' : 'pointer',
                                        bgcolor: isDisabled ? '#F9FAFB' : isCellToday ? '#EFF6FF' : medColor,
                                        borderLeft: i > 0 ? '1px solid #F3F4F6' : 'none',
                                        opacity: (isFuture || isDisabled) ? 0.35 : 1
                                      }}
                                        onClick={() => { if (!isFuture && !isDisabled) handleCellClick(item, day, time) }}
                                      >
                                        {existingAdmin ? (() => {
                                          const initials = ((existingAdmin.first_name?.[0] || '') + (existingAdmin.last_name?.[0] || '')).toUpperCase() || 'S'
                                          const bgColors: Record<string, string> = {
                                            success: '#16A34A', error: '#DC2626', warning: '#D97706', default: '#6B7280'
                                          }
                                          const cellBg = bgColors[config?.color || 'default']
                                          return (
                                            <Tooltip title={`${config?.label || existingAdmin.status}${existingAdmin.notes ? ': ' + existingAdmin.notes : ''}${existingAdmin.prn_reason ? ' | PRN: ' + existingAdmin.prn_reason : ''}${existingAdmin.wastage_amount ? ' | Wastage: ' + existingAdmin.wastage_amount : ''} — ${existingAdmin.first_name || ''} ${existingAdmin.last_name || ''}`}>
                                              <Box sx={{
                                                bgcolor: cellBg, color: 'white', borderRadius: '4px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                width: 26, height: 26, mx: 'auto',
                                                fontSize: '0.6rem', fontWeight: 700, lineHeight: 1
                                              }}>
                                                {initials}
                                              </Box>
                                            </Tooltip>
                                          )
                                        })() : (
                                          <Box sx={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', height: 28,
                                            '&:hover': { bgcolor: '#F0F9FF' }
                                          }}>
                                            <ScheduleIcon sx={{ fontSize: 14, color: '#D1D5DB' }} />
                                          </Box>
                                        )}
                                      </TableCell>
                                    )
                                  })}
                                </TableRow>)
                              }
                              return rows
                            })()}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Paper>
                  )}

                  {/* PRN Section */}
                  {prnItems.length > 0 && (
                    <Paper sx={{ p: 2, mt: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>PRN (As Required) Medications</Typography>
                      <Stack spacing={1}>
                        {prnItems.map((item: MedicationItem) => (
                          <Paper key={item.id} variant="outlined" sx={{ p: 1.5 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ opacity: item.is_active ? 1 : 0.5 }}>
                              <Box>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <MedIcon sx={{ fontSize: 16, color: item.is_active ? '#0F4C81' : '#9CA3AF' }} />
                                  <Typography variant="body2" fontWeight={700} sx={{ textDecoration: item.is_active ? 'none' : 'line-through' }}>{item.name}</Typography>
                                  <Chip label={`${item.dosage} ${item.unit}`} size="small" variant="outlined" />
                                  <Chip label={item.route} size="small" variant="outlined" />
                                  <Chip label="PRN" size="small" color="warning" />
                                  {!item.is_active && <Chip label="Archived" size="small" variant="outlined" color="default" />}
                                </Stack>
                                {item.instructions && (
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>{item.instructions}</Typography>
                                )}
                              </Box>
                              <Stack direction="row" spacing={0.5}>
                                {(() => {
                                  const nowStr = new Date().toISOString().split('T')[0]
                                  const prnStart = item.start_date ? item.start_date.slice(0, 10) : ''
                                  const prnEnd = item.end_date ? item.end_date.slice(0, 10) : ''
                                  const prnDisabled = !!(prnStart && nowStr < prnStart) || !!(prnEnd && nowStr > prnEnd)
                                    || !item.is_active
                                  return (
                                    <Tooltip title={!item.is_active ? 'Archived' : prnDisabled ? 'Outside medication date range' : 'Log PRN administration'}>
                                      <span>
                                        <IconButton size="small" color="success" disabled={prnDisabled} onClick={() => {
                                          const now = new Date()
                                          const dateStr = now.toISOString().split('T')[0]
                                          const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
                                          handleCellClick(item, dateStr, timeStr)
                                        }}>
                                          <CheckIcon fontSize="small" />
                                        </IconButton>
                                      </span>
                                    </Tooltip>
                                  )
                                })()}
                                {canManage && (
                                  <>
                                    <Tooltip title="Edit">
                                      <IconButton size="small" onClick={() => openItemDialog(item)}><EditIcon fontSize="small" /></IconButton>
                                    </Tooltip>
                                    <Tooltip title="Remove">
                                      <IconButton size="small" color="error" onClick={() => setConfirmDialog({
                                        message: 'Remove this medication from the chart?',
                                        onConfirm: () => itemDeleteMutation.mutate(item.id)
                                      })}><DeleteIcon fontSize="small" /></IconButton>
                                    </Tooltip>
                                  </>
                                )}
                              </Stack>
                            </Stack>
                          </Paper>
                        ))}
                      </Stack>
                    </Paper>
                  )}
                </>
              )}
            </Grid>
          </Grid>
        </>
      )}

      {/* ═══ TAB 1: Stock ═══ */}
      {tab === 1 && (
        <Paper sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6">Stock Inventory</Typography>
            <Stack direction="row" spacing={1}>
              <Chip
                label={showArchivedStock ? 'Showing All' : 'Active Only'}
                size="small"
                color={showArchivedStock ? 'warning' : 'default'}
                onClick={() => setShowArchivedStock(!showArchivedStock)}
                variant="outlined"
              />
              <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => openStockDialog()}>
                Add Stock Item
              </Button>
            </Stack>
          </Stack>

          {/* Low stock alert */}
          {lowStockItems.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }} icon={<WarningIcon />}>
              {lowStockItems.length} item{lowStockItems.length > 1 ? 's' : ''} below reorder level:{' '}
              {lowStockItems.map((s: StockItem) => `${s.medication_name} (${s.quantity} ${s.quantity_unit})`).join(', ')}
            </Alert>
          )}

          {stockLoading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress size={24} /></Box>
          ) : !stockData || stockData.length === 0 ? (
            <Typography sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>No medication records found</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Medication</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Dosage</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Batch</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Expiry</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Qty</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Unit</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Reorder Level</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stockData.map((item: StockItem) => {
                    const isLow = item.quantity <= item.reorder_level
                    return (
                      <TableRow key={item.id} hover sx={{ bgcolor: isLow ? '#FEF2F2' : undefined }}>
                        <TableCell sx={{ fontWeight: 600 }}>{item.medication_name}</TableCell>
                        <TableCell>{item.dosage}{item.unit}</TableCell>
                        <TableCell><Typography variant="caption" fontFamily="monospace">{item.batch_number || '\u2014'}</Typography></TableCell>
                        <TableCell>
                          <Chip label={item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : '\u2014'} size="small"
                            color={item.expiry_date && new Date(item.expiry_date) < new Date() ? 'error' : 'default'} />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={600} color={isLow ? 'error' : 'text.primary'}>{item.quantity}</Typography>
                        </TableCell>
                        <TableCell>{item.quantity_unit}</TableCell>
                        <TableCell>{item.reorder_level}</TableCell>
                        <TableCell>{item.location || '\u2014'}</TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="Adjust stock (damaged/expired/lost/returned)">
                              <IconButton size="small" color="warning" onClick={() => openAdjustDialog(item)}>
                                <WarningIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Edit"><IconButton size="small" onClick={() => openStockDialog(item)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                            <Tooltip title="Archive"><IconButton size="small" color="error" onClick={() => setConfirmDialog({
                              message: 'Archive this stock item? It will no longer appear in active stock lists.',
                              onConfirm: () => stockArchiveMutation.mutate(item.id)
                            })}><ArchiveOutlined fontSize="small" /></IconButton></Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* ═══ TAB 2: Deliveries ═══ */}
      {tab === 2 && (
        <Paper sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6">Delivery Tracking</Typography>
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setDeliveryDialog(true)}>
              Log Delivery
            </Button>
          </Stack>
          {deliveriesLoading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress size={24} /></Box>
          ) : !deliveriesData || deliveriesData.length === 0 ? (
            <Typography sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>No deliveries recorded.</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Supplier</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Delivery Note</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Received By</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Items</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Notes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {deliveriesData.map((d: Delivery) => (
                    <TableRow key={d.id} hover>
                      <TableCell>{new Date(d.delivery_date).toLocaleDateString()}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{d.supplier}</TableCell>
                      <TableCell><Typography variant="caption" fontFamily="monospace">{d.delivery_note || '\u2014'}</Typography></TableCell>
                      <TableCell>{d.received_by || '\u2014'}</TableCell>
                      <TableCell>{d.items?.length || 0} item{(d.items?.length || 0) !== 1 ? 's' : ''}</TableCell>
                      <TableCell><Typography variant="caption" color="text.secondary">{d.notes || '\u2014'}</Typography></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* ═══ TAB 3: Daily Counts ═══ */}
      {tab === 3 && (
        <>
          {/* SU Filter - inline, no button */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Daily Medication Counts</Typography>
            <Autocomplete
              options={people || []}
              getOptionLabel={(o: any) => `${o.first_name} ${o.last_name}`}
              value={countPerson}
              onChange={async (_, v) => {
                setCountPerson(v)
                setCountMedications([])
                setCountItemsForm({})
                setCountNoRecords(false)
                if (v?.id) {
                  setCountLoading(true)
                  try {
                    const recordsRes = await api.get(`/emedication/records?personId=${v.id}`)
                    const activeRecords = (recordsRes.data as any[]).filter((r: any) => r.status === 'active')
                    if (activeRecords.length > 0) {
                      const medsRes = await api.get(`/emedication/records/${activeRecords[0].id}/medication-quantities`)
                      setCountMedications(medsRes.data)
                      const init: Record<string, { actual_quantity: number; reason_for_mismatch: string; escalate: boolean }> = {}
                      for (const m of medsRes.data) {
                        init[m.medication_item_id] = { actual_quantity: 0, reason_for_mismatch: '', escalate: false }
                      }
                      setCountItemsForm(init)
                    } else {
                      setCountNoRecords(true)
                    }
                  } catch { setCountNoRecords(true) }
                  setCountLoading(false)
                }
              }}
              renderInput={(params) => <TextField {...params} label="Search Person" size="small" />}
              sx={{ maxWidth: 400 }}
            />
          </Paper>

          {/* Loading state */}
          {countLoading && (
            <Paper sx={{ p: 2, mb: 2, textAlign: 'center' }}>
              <CircularProgress size={24} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Loading medications...</Typography>
            </Paper>
          )}

          {/* No active records message */}
          {countNoRecords && !countLoading && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                No active MAR records found for this person.
              </Typography>
            </Paper>
          )}

          {/* Current-day per-med form */}
          {countPerson && countMedications.length > 0 && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={700}>
                  Today's Count — {new Date().toLocaleDateString()}
                </Typography>
              </Stack>
              {countMedications.map((med: any) => {
                const expected = med.times?.length || 0
                const actual = countItemsForm[med.medication_item_id]?.actual_quantity ?? 0
                const isMismatch = actual !== expected
                return (
                  <Paper key={med.medication_item_id} variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
                    <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap">
                      <Box sx={{ flex: 1, minWidth: 200 }}>
                        <Typography variant="body2" fontWeight={600}>{med.medication_name}</Typography>
                        <Typography variant="caption" color="text.secondary">{med.dosage}{med.unit}</Typography>
                      </Box>
                      <TextField label="Expected" type="number" size="small" sx={{ width: 110 }}
                        value={expected} InputProps={{ readOnly: true }} />
                      <TextField label="Actual" type="number" size="small" sx={{ width: 110 }}
                        value={actual}
                        onChange={(e) => setCountItemsForm(p => ({
                          ...p,
                          [med.medication_item_id]: { ...p[med.medication_item_id], actual_quantity: Number(e.target.value) }
                        }))} />
                    </Stack>
                    {isMismatch && (
                      <Stack direction="row" spacing={2} sx={{ mt: 1.5 }} alignItems="center" flexWrap="wrap">
                        <TextField select label="Reason for Mismatch" size="small" sx={{ minWidth: 200 }}
                          value={countItemsForm[med.medication_item_id]?.reason_for_mismatch || ''}
                          onChange={(e) => setCountItemsForm(p => ({
                            ...p,
                            [med.medication_item_id]: { ...p[med.medication_item_id], reason_for_mismatch: e.target.value }
                          }))}>
                          {['', 'Wastage', 'Count discrepancy', 'Damaged', 'Lost', 'Other'].map(o => (
                            <MenuItem key={o} value={o}>{o || 'Select reason'}</MenuItem>
                          ))}
                        </TextField>
                        <FormControlLabel
                          control={<Checkbox checked={countItemsForm[med.medication_item_id]?.escalate || false}
                            onChange={(e) => setCountItemsForm(p => ({
                              ...p,
                              [med.medication_item_id]: { ...p[med.medication_item_id], escalate: e.target.checked }
                            }))} />}
                          label="Escalate to Manager"
                        />
                      </Stack>
                    )}
                  </Paper>
                )
              })}
              <Button variant="contained" onClick={handleSaveDailyCount}
                disabled={!countPerson || countCreateMutation.isPending}>
                {countCreateMutation.isPending ? 'Saving...' : "Save Today's Count"}
              </Button>
            </Paper>
          )}

          {/* History table */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>Count History</Typography>
            {!dailyCounts || dailyCounts.length === 0 ? (
              <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>No daily counts logged yet.</Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Person</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Staff Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Medications Checked</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Overall Match</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dailyCounts.map((c: any) => (
                      <TableRow key={c.id} hover>
                        <TableCell>{new Date(c.count_date).toLocaleDateString()}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{c.person_name || '\u2014'}</TableCell>
                        <TableCell>{c.staff_name || '\u2014'}</TableCell>
                        <TableCell>{c.items_count || 0} meds</TableCell>
                        <TableCell>
                          <Chip label={c.matches_physical ? 'Yes' : 'No'} size="small"
                            color={c.matches_physical ? 'success' : 'error'} />
                        </TableCell>
                        <TableCell>
                          <Button size="small" variant="text" onClick={async () => {
                            const res = await api.get(`/emedication/daily-counts/${c.id}/items`)
                            setEditDailyCountItems(res.data)
                            setEditDailyCountId(c.id)
                          }}>View Items</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </>
      )}

      {/* ═══ TAB 4: Audit Log ═══ */}
      {tab === 4 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Medication Audit Trail</Typography>
          {!auditLogsData || auditLogsData.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>No audit log entries yet.</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Date/Time</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>User</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Details</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>IP</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {auditLogsData.map((log: AuditLog) => (
                    <TableRow key={log.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString()}</TableCell>
                      <TableCell>{log.user_name}</TableCell>
                      <TableCell>
                        <Chip label={log.action.replace(/_/g, ' ')} size="small"
                          color={log.action.includes('delete') ? 'error' : log.action.includes('create') ? 'success' : 'default'} />
                      </TableCell>
                      <TableCell><Typography variant="caption" color="text.secondary">{log.entity_type}</Typography></TableCell>
                      <TableCell>
                        {log.changes && typeof log.changes === 'object' ? (
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.65rem' }}>
                            {Object.entries(log.changes).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(', ')}
                            {Object.keys(log.changes).length > 3 ? ` +${Object.keys(log.changes).length - 3} more` : ''}
                          </Typography>
                        ) : (
                          <Typography variant="caption" color="text.secondary">{'\u2014'}</Typography>
                        )}
                      </TableCell>
                      <TableCell><Typography variant="caption" color="text.secondary">{log.ip_address || '\u2014'}</Typography></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* ── Dialogs ── */}

      {/* New/Edit Chart Dialog */}
      <Dialog open={recordDialog} onClose={() => { setRecordDialog(false); setEditRecord(null) }} maxWidth="sm" fullWidth>
        <DialogTitle>{editRecord ? 'Edit Medication Chart' : 'New Medication Chart'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Chart Title" fullWidth value={recordForm.title}
              onChange={(e) => setRecordForm(p => ({ ...p, title: e.target.value }))} size="small"
              placeholder="e.g., April 2026 MAR" />
            <TextField label="Start Date" type="date" fullWidth value={recordForm.start_date}
              onChange={(e) => setRecordForm(p => ({ ...p, start_date: e.target.value }))} size="small" InputLabelProps={{ shrink: true }} />
            <TextField label="End Date" type="date" fullWidth value={recordForm.end_date}
              onChange={(e) => setRecordForm(p => ({ ...p, end_date: e.target.value }))} size="small" InputLabelProps={{ shrink: true }} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setRecordDialog(false); setEditRecord(null) }}>Cancel</Button>
          {editRecord ? (
            <Button variant="contained" onClick={() => recordUpdateMutation.mutate({ id: editRecord.id, data: recordForm })}
              disabled={!recordForm.title || !recordForm.start_date || !recordForm.end_date || recordUpdateMutation.isPending}>
              {recordUpdateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          ) : (
            <Button variant="contained" onClick={() => recordCreateMutation.mutate({ ...recordForm, person_id: selectedPerson.id })}
              disabled={!recordForm.title || !recordForm.start_date || !recordForm.end_date || recordCreateMutation.isPending}>
              {recordCreateMutation.isPending ? 'Creating...' : 'Create Chart'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Add/Edit Medication Dialog */}
      <Dialog open={itemDialog} onClose={() => setItemDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editItem ? 'Edit Medication' : 'Add Medication'}</DialogTitle>
        <DialogContent>
          {errorMsg && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMsg('')}>{errorMsg}</Alert>
          )}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Medication Name" fullWidth value={itemForm.name}
              onChange={(e) => setItemForm(p => ({ ...p, name: e.target.value }))} size="small" required />
            <Stack direction="row" spacing={1}>
              <TextField label="Dosage" fullWidth value={itemForm.dosage}
                onChange={(e) => setItemForm(p => ({ ...p, dosage: e.target.value }))} size="small" required />
              <TextField select label="Unit" value={itemForm.unit}
                onChange={(e) => setItemForm(p => ({ ...p, unit: e.target.value }))} size="small" sx={{ minWidth: 100 }}>
                {['mg', 'ml', 'mcg', 'g', 'tablet(s)', 'capsule(s)', 'drop(s)', 'puff(s)', 'patch(es)', 'suppository'].map(u => (
                  <MenuItem key={u} value={u}>{u}</MenuItem>
                ))}
              </TextField>
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField select label="Route" value={itemForm.route}
                onChange={(e) => setItemForm(p => ({ ...p, route: e.target.value }))} size="small" sx={{ flex: 1 }}>
                {ROUTES.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </TextField>
              <TextField select label="Frequency" value={itemForm.frequency}
                onChange={(e) => {
                  setErrorMsg('')
                  const newFreq = e.target.value
                  const maxTimes = getMaxTimesForFrequency(newFreq)
                  const existingTimes = itemForm.times
                  const trimmed = maxTimes !== null ? existingTimes.slice(0, maxTimes) : existingTimes
                  setItemForm(p => ({ ...p, frequency: newFreq, is_prn: newFreq.includes('PRN'), times: trimmed }))
                }} size="small" sx={{ flex: 1 }}>
                {FREQUENCIES.map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
              </TextField>
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField label="Start Date" type="date" fullWidth value={itemForm.start_date}
                onChange={(e) => setItemForm(p => ({ ...p, start_date: e.target.value }))} size="small" InputLabelProps={{ shrink: true }} />
              <TextField label="End Date" type="date" fullWidth value={itemForm.end_date}
                onChange={(e) => setItemForm(p => ({ ...p, end_date: e.target.value }))} size="small" InputLabelProps={{ shrink: true }} />
            </Stack>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Administration Times</Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mb: 0.5 }}>
                {itemForm.times.map(t => (
                  <Chip key={t} label={t} size="small" onDelete={() => removeTime(t)} sx={{ mb: 0.5 }} />
                ))}
              </Stack>
              <TextField size="small" placeholder="Type time e.g. 08:00 and press Enter" value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTime() } }}
                InputProps={{ endAdornment: timeInput ? (<InputAdornment position="end"><IconButton size="small" onClick={addTime}><AddIcon fontSize="small" /></IconButton></InputAdornment>) : undefined }} fullWidth />
            </Box>
            <TextField label="Instructions / Notes" fullWidth value={itemForm.instructions}
              onChange={(e) => setItemForm(p => ({ ...p, instructions: e.target.value }))} size="small" multiline rows={2} />
            <FormControlLabel control={<Checkbox checked={itemForm.is_controlled_drug}
              onChange={(e) => setItemForm(p => ({ ...p, is_controlled_drug: e.target.checked }))} />}
              label={<Typography variant="body2"><Box component="span" sx={{ color: 'error.main', fontWeight: 600 }}>●</Box> Controlled Drug (CD)</Typography>} />
            <Typography variant="subtitle2" sx={{ mt: 1 }}>Prescriber Information</Typography>
            <Stack direction="row" spacing={1}>
              <TextField label="Prescriber Name" fullWidth value={itemForm.prescriber_name}
                onChange={(e) => setItemForm(p => ({ ...p, prescriber_name: e.target.value }))} size="small" />
              <TextField label="Prescriber Phone" fullWidth value={itemForm.prescriber_phone}
                onChange={(e) => setItemForm(p => ({ ...p, prescriber_phone: e.target.value }))} size="small" />
            </Stack>
            <TextField label="Prescription Reference" fullWidth value={itemForm.prescription_ref}
              onChange={(e) => setItemForm(p => ({ ...p, prescription_ref: e.target.value }))} size="small" />
            {editItem && (
              <TextField select label="Active" value={itemForm.is_active ? 'true' : 'false'}
                onChange={(e) => setItemForm(p => ({ ...p, is_active: e.target.value === 'true' }))} size="small">
                <MenuItem value="true">Active</MenuItem>
                <MenuItem value="false">Inactive</MenuItem>
              </TextField>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setItemDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveItem}
            disabled={(() => {
              if (!itemForm.name || !itemForm.dosage) return true
              const maxTimes = getMaxTimesForFrequency(itemForm.frequency)
              if (maxTimes !== null && itemForm.times.length !== maxTimes) return true
              return editItem ? itemUpdateMutation.isPending : itemCreateMutation.isPending
            })()}>
            {editItem ? 'Save Changes' : 'Add Medication'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Log Administration Dialog with PRN + Wastage */}
      {adminDialog && <Dialog open={adminDialog} onClose={() => { setAdminDialog(false); setAdminError('') }} maxWidth="sm" fullWidth>
        <DialogTitle>
          Log Administration
          {adminTarget && (<Typography variant="body2" color="text.secondary">{adminTarget.date} at {adminTime || adminTarget.time}</Typography>)}
        </DialogTitle>
        <DialogContent>
          {adminError && (
            <Alert severity="error" sx={{ mb: 1 }}
              action={adminError.includes('medication assessment') ? (
                <Button size="small" color="inherit" disabled={competenceMutation.isPending}
                  onClick={() => {
                    const selected = (staffList || []).find((s: any) => (s.user_id || s.id) === adminForm.staffUserId)
                    const staffProfId = selected?.staff_id
                    if (staffProfId) competenceMutation.mutate(staffProfId)
                    else setAdminError('Cannot find staff profile for this user')
                  }}>
                  {competenceMutation.isPending ? 'Setting...' : 'Mark as competent'}
                </Button>
              ) : undefined}
            >{adminError}</Alert>
          )}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField select label="Status" fullWidth value={adminForm.status}
              onChange={(e) => setAdminForm(p => ({ ...p, status: e.target.value as AdminStatus }))} size="small">
              {ADMIN_STATUSES.map(s => (<MenuItem key={s} value={s}>{STATUS_CONFIG[s].label}</MenuItem>))}
            </TextField>

            <TextField
              label={adminTarget?.isPrn ? 'Administration Time' : 'Scheduled Time (locked to chart)'}
              type="time" fullWidth value={adminTime}
              disabled={!adminTarget?.isPrn}
              onChange={(e) => setAdminTime(e.target.value)} size="small"
              InputLabelProps={{ shrink: true }}
              helperText={adminTarget?.isPrn
                ? 'PRN — set the actual time this medication was given.'
                : 'Regular medication — time is fixed by the chart schedule.'}
            />

            <Autocomplete
              options={staffList || []}
              getOptionLabel={(o: any) => `${o.first_name} ${o.last_name}`}
              value={(staffList || []).find((s: any) => (s.user_id || s.id) === adminForm.staffUserId) || null}
              onChange={(_, v) => setAdminForm(p => ({ ...p, staffUserId: v?.user_id || v?.id || '' }))}
              renderInput={(params) => <TextField {...params} label="Administered By" size="small" />} size="small"
            />

            <TextField label="Notes" fullWidth value={adminForm.notes}
              onChange={(e) => setAdminForm(p => ({ ...p, notes: e.target.value }))} size="small" multiline rows={2} />

            {/* PRN fields — shown when status is 'given' and target is PRN */}
            {adminForm.status === 'given' && adminTarget?.isPrn && (
              <>
                <Divider />
                <Typography variant="subtitle2" color="warning.dark">PRN Details</Typography>
                <TextField label="Reason for PRN" fullWidth value={adminForm.prn_reason}
                  onChange={(e) => setAdminForm(p => ({ ...p, prn_reason: e.target.value }))} size="small" />
                <TextField select label="Effectiveness" fullWidth value={adminForm.prn_effectiveness}
                  onChange={(e) => setAdminForm(p => ({ ...p, prn_effectiveness: e.target.value }))} size="small">
                  {['Effective', 'Partial', 'Not Effective', 'Not Assessed'].map(o => (<MenuItem key={o} value={o}>{o}</MenuItem>))}
                </TextField>
              </>
            )}

            {/* Wastage fields — shown when status is 'given' */}
            {adminForm.status === 'given' && (
              <>
                <Divider />
                <Typography variant="subtitle2" color="text.secondary">Wastage & Batch</Typography>
                <Stack direction="row" spacing={1}>
                  <TextField label="Wastage Amount" fullWidth value={adminForm.wastage_amount}
                    onChange={(e) => setAdminForm(p => ({ ...p, wastage_amount: e.target.value }))} size="small" placeholder="e.g., 0.5 mg" />
                  <TextField label="Wastage Reason" fullWidth value={adminForm.wastage_reason}
                    onChange={(e) => setAdminForm(p => ({ ...p, wastage_reason: e.target.value }))} size="small" placeholder="e.g., Dropped" />
                </Stack>
                <Stack direction="row" spacing={1}>
                  <TextField label="Batch Number" fullWidth value={adminForm.batch_number}
                    onChange={(e) => setAdminForm(p => ({ ...p, batch_number: e.target.value }))} size="small" />
                  <TextField label="Expiry Date" type="date" fullWidth value={adminForm.expiry_date}
                    onChange={(e) => setAdminForm(p => ({ ...p, expiry_date: e.target.value }))} size="small" InputLabelProps={{ shrink: true }} />
                </Stack>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdminDialog(false)}>Cancel</Button>
          <Button variant="contained" color="success" onClick={handleSaveAdmin}
            disabled={adminMutation.isPending || !adminForm.staffUserId}>
            {adminMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>}

      {/* Stock Dialog */}
      <Dialog open={stockDialog} onClose={() => setStockDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editStock ? 'Edit Stock Item' : 'Add Stock Item'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Medication Name" fullWidth value={stockForm.medication_name}
              onChange={(e) => setStockForm(p => ({ ...p, medication_name: e.target.value }))} size="small" required />
            <Stack direction="row" spacing={1}>
              <TextField label="Dosage" fullWidth value={stockForm.dosage}
                onChange={(e) => setStockForm(p => ({ ...p, dosage: e.target.value }))} size="small" />
              <TextField select label="Unit" value={stockForm.unit}
                onChange={(e) => setStockForm(p => ({ ...p, unit: e.target.value }))} size="small" sx={{ minWidth: 90 }}>
                {['mg', 'ml', 'mcg', 'g'].map(u => (<MenuItem key={u} value={u}>{u}</MenuItem>))}
              </TextField>
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField label="Batch Number" fullWidth value={stockForm.batch_number}
                onChange={(e) => setStockForm(p => ({ ...p, batch_number: e.target.value }))} size="small" />
              <TextField label="Expiry Date" type="date" fullWidth value={stockForm.expiry_date}
                onChange={(e) => setStockForm(p => ({ ...p, expiry_date: e.target.value }))} size="small" InputLabelProps={{ shrink: true }} />
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField label="Quantity" type="number" fullWidth value={stockForm.quantity}
                onChange={(e) => setStockForm(p => ({ ...p, quantity: Number(e.target.value) }))} size="small" />
              <TextField select label="Unit" value={stockForm.quantity_unit}
                onChange={(e) => setStockForm(p => ({ ...p, quantity_unit: e.target.value }))} size="small" sx={{ minWidth: 100 }}>
                {['tablets', 'capsules', 'ml', 'patches', 'puffs', 'ampoules', 'vials', 'packets'].map(u => (<MenuItem key={u} value={u}>{u}</MenuItem>))}
              </TextField>
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField label="Reorder Level" type="number" fullWidth value={stockForm.reorder_level}
                onChange={(e) => setStockForm(p => ({ ...p, reorder_level: Number(e.target.value) }))} size="small" />
              <TextField label="Location" fullWidth value={stockForm.location}
                onChange={(e) => setStockForm(p => ({ ...p, location: e.target.value }))} size="small" placeholder="e.g., Cabinet A" />
            </Stack>
            <Autocomplete
              options={people || []}
              getOptionLabel={(o: any) => `${o.first_name} ${o.last_name}`}
              value={stockPerson}
              onChange={(_, v) => setStockPerson(v)}
              renderInput={(params) => <TextField {...params} label="Person" size="small" required />}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStockDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleStockSave}
            disabled={!stockForm.medication_name || !stockPerson || stockCreateMutation.isPending || stockUpdateMutation.isPending}>
            {editStock ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={adjustDialog} onClose={() => { setAdjustDialog(false); setAdjustStockItem(null) }} maxWidth="sm" fullWidth>
        <DialogTitle>Adjust Stock</DialogTitle>
        <DialogContent>
          {adjustStockItem && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Alert severity="info">
                Adjusting: <strong>{adjustStockItem.medication_name}</strong> &mdash; Current qty: <strong>{adjustStockItem.quantity} {adjustStockItem.quantity_unit}</strong>
              </Alert>
              <TextField select label="Adjustment Type" fullWidth value={adjustForm.adjustment_type}
                onChange={(e) => setAdjustForm(p => ({ ...p, adjustment_type: e.target.value }))} size="small">
                {['damaged', 'expired', 'lost', 'returned', 'other'].map(t => (
                  <MenuItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</MenuItem>
                ))}
              </TextField>
              <TextField label="Quantity Adjusted" type="number" fullWidth value={adjustForm.quantity_adjusted}
                onChange={(e) => setAdjustForm(p => ({ ...p, quantity_adjusted: Number(e.target.value) }))} size="small"
                inputProps={{ min: 1 }} />
              <TextField label="Reason" fullWidth value={adjustForm.reason}
                onChange={(e) => setAdjustForm(p => ({ ...p, reason: e.target.value }))} size="small" multiline rows={2} />
              <TextField label="Adjusted By" fullWidth value={adjustForm.adjusted_by}
                onChange={(e) => setAdjustForm(p => ({ ...p, adjusted_by: e.target.value }))} size="small" />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAdjustDialog(false); setAdjustStockItem(null) }}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={() => {
            if (adjustStockItem) {
              adjustMutation.mutate({ stockItemId: adjustStockItem.id, data: adjustForm })
            }
          }} disabled={adjustMutation.isPending || !adjustForm.reason}>
            {adjustMutation.isPending ? 'Adjusting...' : 'Adjust Stock'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delivery Dialog */}
      <Dialog open={deliveryDialog} onClose={() => setDeliveryDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Log Delivery</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={1}>
              <TextField label="Supplier" fullWidth value={deliveryForm.supplier}
                onChange={(e) => setDeliveryForm(p => ({ ...p, supplier: e.target.value }))} size="small" required />
              <TextField label="Delivery Note #" fullWidth value={deliveryForm.delivery_note}
                onChange={(e) => setDeliveryForm(p => ({ ...p, delivery_note: e.target.value }))} size="small" />
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField label="Delivery Date" type="date" fullWidth value={deliveryForm.delivery_date}
                onChange={(e) => setDeliveryForm(p => ({ ...p, delivery_date: e.target.value }))} size="small" InputLabelProps={{ shrink: true }} />
              <TextField label="Received By" fullWidth value={deliveryForm.received_by}
                onChange={(e) => setDeliveryForm(p => ({ ...p, received_by: e.target.value }))} size="small" />
            </Stack>
            <TextField label="Notes" fullWidth value={deliveryForm.notes}
              onChange={(e) => setDeliveryForm(p => ({ ...p, notes: e.target.value }))} size="small" multiline rows={2} />

            {/* Delivery Items */}
            <Divider />
            <Typography variant="subtitle2">Delivery Items</Typography>
            {deliveryForm.items.map((item: any) => (
              <Paper key={item.id} variant="outlined" sx={{ p: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" fontWeight={600}>{item.medication_name} {item.dosage}{item.unit}</Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip label={`${item.quantity} ${item.quantity_unit}`} size="small" />
                    <IconButton size="small" color="error" onClick={() => removeDeliveryItem(item.id)}><CloseIcon fontSize="small" /></IconButton>
                  </Stack>
                </Stack>
              </Paper>
            ))}
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>Add Item</Typography>
              <Stack spacing={1}>
                <TextField label="Medication Name" fullWidth value={deliveryItemForm.medication_name}
                  onChange={(e) => setDeliveryItemForm(p => ({ ...p, medication_name: e.target.value }))} size="small" />
                <Stack direction="row" spacing={1}>
                  <TextField label="Dosage" fullWidth value={deliveryItemForm.dosage}
                    onChange={(e) => setDeliveryItemForm(p => ({ ...p, dosage: e.target.value }))} size="small" />
                  <TextField select label="Unit" value={deliveryItemForm.unit}
                    onChange={(e) => setDeliveryItemForm(p => ({ ...p, unit: e.target.value }))} size="small" sx={{ minWidth: 80 }}>
                    {['mg', 'ml', 'mcg', 'g'].map(u => (<MenuItem key={u} value={u}>{u}</MenuItem>))}
                  </TextField>
                </Stack>
                <Stack direction="row" spacing={1}>
                  <TextField label="Batch #" fullWidth value={deliveryItemForm.batch_number}
                    onChange={(e) => setDeliveryItemForm(p => ({ ...p, batch_number: e.target.value }))} size="small" />
                  <TextField label="Expiry" type="date" fullWidth value={deliveryItemForm.expiry_date}
                    onChange={(e) => setDeliveryItemForm(p => ({ ...p, expiry_date: e.target.value }))} size="small" InputLabelProps={{ shrink: true }} />
                </Stack>
                <Stack direction="row" spacing={1}>
                  <TextField label="Quantity" type="number" fullWidth value={deliveryItemForm.quantity}
                    onChange={(e) => setDeliveryItemForm(p => ({ ...p, quantity: Number(e.target.value) }))} size="small" />
                  <TextField select label="Unit" value={deliveryItemForm.quantity_unit}
                    onChange={(e) => setDeliveryItemForm(p => ({ ...p, quantity_unit: e.target.value }))} size="small" sx={{ minWidth: 100 }}>
                    {['tablets', 'capsules', 'ml', 'patches', 'puffs', 'ampoules', 'vials', 'packets'].map(u => (<MenuItem key={u} value={u}>{u}</MenuItem>))}
                  </TextField>
                  <Button variant="outlined" size="small" onClick={addDeliveryItem} disabled={!deliveryItemForm.medication_name || !deliveryItemForm.quantity}>Add</Button>
                </Stack>
              </Stack>
            </Paper>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeliveryDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => deliveryCreateMutation.mutate(deliveryForm)}
            disabled={!deliveryForm.supplier || deliveryCreateMutation.isPending || deliveryForm.items.length === 0}>
            {deliveryCreateMutation.isPending ? 'Saving...' : 'Save Delivery'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmDialog} onClose={() => setConfirmDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog?.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => {
            confirmDialog?.onConfirm()
            setConfirmDialog(null)
          }}>Confirm</Button>
        </DialogActions>
      </Dialog>

      {/* View Daily Count Items Dialog */}
      <Dialog open={!!editDailyCountId} onClose={() => { setEditDailyCountId(null); setEditDailyCountItems([]) }} maxWidth="sm" fullWidth>
        <DialogTitle>Daily Count Items</DialogTitle>
        <DialogContent>
          {editDailyCountItems.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>No items recorded for this count.</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Medication</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Expected</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Actual</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Reason</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {editDailyCountItems.map((item: any) => (
                    <TableRow key={item.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{item.medication_name}</TableCell>
                      <TableCell align="right">{item.expected_quantity}</TableCell>
                      <TableCell align="right">
                        <Typography color={item.actual_quantity !== item.expected_quantity ? 'error' : 'text.primary'} fontWeight={600}>
                          {item.actual_quantity}
                        </Typography>
                      </TableCell>
                      <TableCell><Typography variant="caption" color="text.secondary">{item.reason_for_mismatch || '\u2014'}</Typography></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setEditDailyCountId(null); setEditDailyCountItems([]) }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Archive Confirmation Dialog */}
      <Dialog open={archiveDialog} onClose={() => { setArchiveDialog(false); setArchiveTargetId(null) }} maxWidth="xs" fullWidth>
        <DialogTitle>Archive Medication Chart</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ mt: 1 }}>
            <Alert severity="warning">
              Are you sure you want to archive this chart? Archived charts are hidden from the main view but retained for audit purposes. This action cannot be undone.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setArchiveDialog(false); setArchiveTargetId(null) }}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={() => { if (archiveTargetId) archiveMutation.mutate(archiveTargetId) }}
            disabled={archiveMutation.isPending}>
            {archiveMutation.isPending ? 'Archiving...' : 'Archive Chart'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Day Admin Detail Dialog */}
      <Dialog open={!!dayAdminDialog} onClose={() => setDayAdminDialog(null)} maxWidth="md" fullWidth>
        {dayAdminDialog && (
          <>
            <DialogTitle>
              Administrations for {new Date(dayAdminDialog.date + 'T12:00:00').toLocaleDateString('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              <Typography variant="caption" display="block" color="text.secondary">{dayAdminDialog.admins.length} total</Typography>
            </DialogTitle>
            <DialogContent dividers>
              {dayAdminDialog.admins.length === 0 ? (
                <Typography color="text.secondary">No administrations logged for this date.</Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Medication</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Time</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Staff</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Notes / Wastage / PRN</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dayAdminDialog.admins.map((a, idx) => {
                      const cfg = STATUS_CONFIG[a.status as AdminStatus]
                      return (
                        <TableRow key={a.id || idx} hover>
                          <TableCell sx={{ fontWeight: 600 }}>{a.medication_name} {a.medication_dosage}{a.medication_unit}</TableCell>
                          <TableCell>{new Date(a.scheduled_time).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</TableCell>
                          <TableCell>
                            {cfg ? (
                              <Chip icon={cfg.icon as React.ReactElement} label={cfg.label} size="small"
                                color={(cfg.color === 'success' ? 'success' : cfg.color === 'error' ? 'error' : cfg.color === 'warning' ? 'warning' : 'default') as any} />
                            ) : (
                              <Chip label={a.status} size="small" />
                            )}
                          </TableCell>
                          <TableCell>
                            {a.first_name || a.last_name ? `${a.first_name || ''} ${a.last_name || ''}`.trim() : '\u2014'}
                          </TableCell>
                          <TableCell>
                            <Stack spacing={0.5}>
                              {a.notes && <Typography variant="caption">Notes: {a.notes}</Typography>}
                              {a.wastage_amount && <Typography variant="caption">Wastage: {a.wastage_amount}{a.wastage_unit || ''}</Typography>}
                              {a.wastage_reason && <Typography variant="caption">Wastage reason: {a.wastage_reason}</Typography>}
                              {a.prn_reason && <Typography variant="caption">PRN: {a.prn_reason}</Typography>}
                              {!a.notes && !a.wastage_amount && !a.prn_reason && <Typography variant="caption" color="text.disabled">\u2014</Typography>}
                            </Stack>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDayAdminDialog(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  )
}
