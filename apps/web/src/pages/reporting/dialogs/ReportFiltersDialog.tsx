import { useState } from 'react'
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, Divider,
  FormControl, InputLabel, MenuItem, Select, Typography,
} from '@mui/material'
import { Check as CheckIcon } from '@mui/icons-material'
import FigDialogHeader, { PillOptions } from '../../people/dialogHeader'

export interface ReportFilterValues {
  datePreset: string
  statuses: string[]
  locationId: string
  role: string
  departmentId: string
  sort: string
}

export const EMPTY_REPORT_FILTERS: ReportFilterValues = {
  datePreset: '', statuses: [], locationId: '', role: '', departmentId: '', sort: 'date-desc',
}

export const DATE_RANGE_OPTIONS = [
  { value: '', label: 'All time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '3m', label: 'Last 3 months' },
  { value: '12m', label: 'Last 12 months' },
]

export const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'on_leave', label: 'On leave' },
  { value: 'inactive', label: 'Inactive' },
]

export const ROLE_OPTIONS = [
  { value: '', label: 'Any role' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'CARE_WORKER', label: 'Care worker' },
  { value: 'COMPLIANCE_OFFICER', label: 'Compliance' },
]

export const SORT_OPTIONS = [
  { value: 'date-desc', label: 'Date (newest first)' },
  { value: 'date-asc', label: 'Date (oldest first)' },
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
]

export interface BuilderInitialFilter { field: string; op: string; value: string }

export interface BuilderInitial {
  dataset: string
  filters: BuilderInitialFilter[]
  sortBy: string
  sortDir: 'asc' | 'desc'
}

const PRESET_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '3m': 91, '12m': 365 }

/** Translate the Filters dialog into a builder starting point (staff dataset). */
export function reportFiltersToBuilderInitial(
  values: ReportFilterValues,
  locations: { id: string; name: string }[],
  departments: { id: string; name: string }[],
): BuilderInitial {
  const filters: BuilderInitialFilter[] = []
  if (values.datePreset && PRESET_DAYS[values.datePreset]) {
    const d = new Date()
    d.setDate(d.getDate() - (PRESET_DAYS[values.datePreset] - 1))
    const pad = (n: number) => String(n).padStart(2, '0')
    filters.push({ field: 'joined', op: 'gte', value: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` })
  }
  if (values.statuses.length > 0) filters.push({ field: 'status', op: 'in', value: values.statuses.join(', ') })
  if (values.role) filters.push({ field: 'role', op: 'eq', value: values.role })
  const locationName = locations.find(l => l.id === values.locationId)?.name
  if (locationName) filters.push({ field: 'location', op: 'eq', value: locationName })
  const departmentName = departments.find(d => d.id === values.departmentId)?.name
  if (departmentName) filters.push({ field: 'department', op: 'eq', value: departmentName })
  const [sortField, sortDir] = values.sort === 'date-asc' ? ['joined', 'asc' as const]
    : values.sort === 'name-asc' ? ['last_name', 'asc' as const]
    : values.sort === 'name-desc' ? ['last_name', 'desc' as const]
    : ['joined', 'desc' as const]
  return { dataset: 'staff', filters, sortBy: sortField, sortDir }
}

const FIELD_LABEL: Record<keyof ReportFilterValues, string> = {
  datePreset: 'Date range',
  statuses: 'Status',
  locationId: 'Location',
  role: 'Role',
  departmentId: 'Department',
  sort: 'Sort by',
}

/** Figma 10.2 screens 1–2: the report-filters modal. Single column, so the
 *  same dialog serves desktop and mobile widths. */
export default function ReportFiltersDialog({ open, onClose, onCreate, locations, departments, initial }: {
  open: boolean
  onClose: () => void
  onCreate: (values: ReportFilterValues) => void
  locations: { id: string; name: string }[]
  departments: { id: string; name: string }[]
  initial?: ReportFilterValues
}) {
  const [values, setValues] = useState<ReportFilterValues>(initial || EMPTY_REPORT_FILTERS)
  const set = (patch: Partial<ReportFilterValues>) => setValues(v => ({ ...v, ...patch }))

  const toggleStatus = (status: string) =>
    set({ statuses: values.statuses.includes(status) ? values.statuses.filter(s => s !== status) : [...values.statuses, status] })

  const clearAll = () => set({ ...EMPTY_REPORT_FILTERS })

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <FigDialogHeader eyebrow="REPORTS" title="Filters" onClose={onClose} />
      <DialogContent sx={{ pt: 1.5 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.04em' }}>{FIELD_LABEL.datePreset.toUpperCase()}</Typography>
            <FormControl fullWidth size="small" sx={{ mt: 1 }}>
              <InputLabel id="report-filter-range-label">Date range</InputLabel>
              <Select label="Date range" labelId="report-filter-range-label" value={values.datePreset}
                onChange={e => set({ datePreset: e.target.value })}>
                {DATE_RANGE_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.04em' }}>{FIELD_LABEL.statuses.toUpperCase()}</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
              {STATUS_OPTIONS.map(o => {
                const selected = values.statuses.includes(o.value)
                return (
                  <Chip key={o.value} label={o.label} clickable onClick={() => toggleStatus(o.value)}
                    color={selected ? 'primary' : 'default'} variant={selected ? 'filled' : 'outlined'}
                    icon={selected ? <CheckIcon sx={{ color: '#fff !important' }} /> : undefined}
                    sx={selected ? { fontWeight: 600, bgcolor: '#0164C8', color: '#fff', '&:hover': { bgcolor: '#0164C8' } } : { fontWeight: 500 }} />
                )
              })}
            </Box>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.04em' }}>{FIELD_LABEL.locationId.toUpperCase()}</Typography>
            <FormControl fullWidth size="small" sx={{ mt: 1 }}>
              <InputLabel id="report-filter-location-label">Location</InputLabel>
              <Select label="Location" labelId="report-filter-location-label" value={values.locationId}
                onChange={e => set({ locationId: e.target.value })}>
                <MenuItem value="">All locations</MenuItem>
                {locations.map(l => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.04em' }}>{FIELD_LABEL.role.toUpperCase()}</Typography>
            <Box sx={{ mt: 1 }}>
              <PillOptions options={ROLE_OPTIONS} value={values.role} onChange={(v: string) => set({ role: v })} showCheck />
            </Box>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.04em' }}>{FIELD_LABEL.departmentId.toUpperCase()}</Typography>
            <FormControl fullWidth size="small" sx={{ mt: 1 }}>
              <InputLabel id="report-filter-dept-label">Department</InputLabel>
              <Select label="Department" labelId="report-filter-dept-label" value={values.departmentId}
                onChange={e => set({ departmentId: e.target.value })}>
                <MenuItem value="">All departments</MenuItem>
                {departments.map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.04em' }}>{FIELD_LABEL.sort.toUpperCase()}</Typography>
            <FormControl fullWidth size="small" sx={{ mt: 1 }}>
              <InputLabel id="report-filter-sort-label">Sort by</InputLabel>
              <Select label="Sort by" labelId="report-filter-sort-label" value={values.sort}
                onChange={e => set({ sort: e.target.value })}>
                {SORT_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
        </Box>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Button onClick={clearAll} sx={{ textTransform: 'none' }}>Clear all</Button>
        <Button variant="contained" onClick={() => onCreate(values)} sx={{ textTransform: 'none' }}>
          Create report
        </Button>
      </DialogActions>
    </Dialog>
  )
}
