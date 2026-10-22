import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { CalendarMonth as CalendarIcon, ChevronLeft as PreviousIcon, ChevronRight as NextIcon } from '@mui/icons-material'
import { Box, Button, IconButton, Skeleton, Stack, Typography } from '@mui/material'
import { NavLink, Navigate, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { SectionError } from '../../components/ui'
import PageContainer from '../../components/design/PageContainer'
import PageMeta from '../../components/PageMeta'
import api from '../../services/api'
import { METICLE_COLORS } from '../../context/ThemeContext'

export type ServiceModel = 'domiciliary' | 'supported_living'

export interface HomecareData {
  missed_today: number
  unassigned_today: number
  overdue_calls: number
  completed_today: number
  total_today: number
  training_expiring: number
  docs_expiring: number
  open_incidents: number
  overdue_incident_actions: number
  overdue_care_plans: number
  active_staff: number
  people_supported: number
  carers_working_today: number
  calls_by_status: { status: string; count: number }[]
}

export interface SupportedLivingData {
  stats: {
    total_staff: number
    active_people: number
    staff_on_duty: number
    compliance_rate: number
    open_incidents: number
  }
  rota: Array<{ id: string; start_time: string; end_time: string; status: string; location_name: string; assigned_staff: string }>
  reviews: Array<{ id: string; person: string; item_name: string; due_date: string; entity_type: string; status?: string }>
  widgets: {
    dbs_expiring_soon: number
    training_expiring_soon: number
    overdue_medications: number
    competency_due: number
    open_severe_incidents: number
    staff_below_threshold: number
    compliance_breakdown?: { total_active: number; compliant_count: number; below_threshold: number }
  }
  staffing_coverage?: {
    shifts_with_target: number
    below_minimum_shifts: number
    unstaffed_shifts: number
    coverage_percent: number
    staffing_shortfall: number
    required_coverage_percent: number
    affected_shifts: Array<{ shift_id: string; location_id: string; location_name: string; start_time: string; end_time: string; minimum_staff: number; assigned_staff: number; shortfall: number; coverage_percent: number }>
  }
}

export interface PulseData {
  cards: Array<{ label: string; value: number | string; subtitle: string }>
}

export interface MissionControlContextValue {
  serviceModel: ServiceModel
  date: string
  homecare: HomecareData | null
  supported: SupportedLivingData | null
  pulse: PulseData | null
}

const MissionControlContext = createContext<MissionControlContextValue | null>(null)

/** Shared by every Mission Control view. Only valid beneath MissionControlLayout. */
export function useMissionControlContext(): MissionControlContextValue {
  const value = useContext(MissionControlContext)
  if (!value) throw new Error('useMissionControlContext must be used inside MissionControlLayout')
  return value
}

export const MISSION_CONTROL_TABS = [
  { key: 'today', label: 'Today' },
  { key: 'calls', label: 'Calls' },
  { key: 'staffing', label: 'Staffing' },
  { key: 'compliance', label: 'Compliance' },
  { key: 'care', label: 'Care' },
  { key: 'incidents', label: 'Incidents' },
] as const

const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const shiftDate = (date: string, days: number) => {
  const next = new Date(`${date}T12:00:00`)
  next.setDate(next.getDate() + days)
  return localDate(next)
}
export const formatDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
export const formatTime = (date: string) => new Date(date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
export const statusTitle = (status: string) => status.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
/** The operational date lives in the URL so tab changes and refreshes keep it. Future dates fall back to today. */
export function resolveOperationalDate(param: string | null, today: string): string {
  return param && DATE_PATTERN.test(param) && param <= today ? param : today
}

function DateControls({ date, today, onChange }: { date: string; today: string; onChange: (date: string) => void }) {
  const same = date === today
  return (
    <Stack direction="row" alignItems="center" spacing={0.5} aria-label="Operational date controls">
      <IconButton aria-label="Previous operational day" size="small" onClick={() => onChange(shiftDate(date, -1))}><PreviousIcon fontSize="small" /></IconButton>
      <Button
        aria-label={`Operational date: ${formatDate(date)}. Select date`}
        startIcon={<CalendarIcon fontSize="small" />}
        onClick={() => onChange(today)}
        sx={{ color: 'text.primary', textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
      >{same ? 'Today' : formatDate(date)}</Button>
      <IconButton aria-label="Next operational day" size="small" disabled={date >= today} onClick={() => onChange(shiftDate(date, 1))}><NextIcon fontSize="small" /></IconButton>
    </Stack>
  )
}

/**
 * Tabs are real router links. `aria-current="page"` is set by NavLink for the
 * matching route only, so exactly one tab is active and the styling follows
 * the URL rather than local state.
 */
function MissionControlTabs({ search, serviceModel }: { search: string; serviceModel: ServiceModel }) {
  return (
    <Box component="nav" aria-label="Mission Control sections" sx={{ display: 'flex', gap: 0.5, overflowX: 'auto', mb: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
      {MISSION_CONTROL_TABS.map(tab => (
        <Button
          key={tab.key}
          component={NavLink}
          to={{ pathname: `/mission-control/${tab.key}`, search }}
          // "Calls" is domiciliary vocabulary (homecare visits). A supported-living
          // organisation sees its rota here, so the tab says so. The route key
          // stays `calls` so existing links and bookmarks keep working.
          sx={{
            textTransform: 'none', flexShrink: 0, px: 1.75, py: 1.1, borderRadius: 0,
            borderBottom: '3px solid transparent', color: 'text.secondary', fontWeight: 500,
            '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
            '&[aria-current="page"]': { color: METICLE_COLORS.primary, fontWeight: 700, borderBottomColor: METICLE_COLORS.primary, bgcolor: METICLE_COLORS.infoSoft },
            '&:focus-visible': { outline: '2px solid', outlineColor: METICLE_COLORS.primary, outlineOffset: 2 },
          }}
        >{tab.key === 'calls' && serviceModel === 'supported_living' ? 'Rota' : tab.label}</Button>
      ))}
    </Box>
  )
}

/** `/mission-control` has no content of its own; it opens Today with the same date. */
export function MissionControlIndexRedirect() {
  const { search } = useLocation()
  return <Navigate to={{ pathname: '/mission-control/today', search }} replace />
}

interface LoadedData {
  homecare: HomecareData | null
  supported: SupportedLivingData | null
  pulse: PulseData | null
}

export default function MissionControlLayout({ serviceModel }: { serviceModel: ServiceModel }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { search } = useLocation()
  const today = localDate(new Date())
  const date = resolveOperationalDate(searchParams.get('date'), today)
  const setDate = (next: string) => setSearchParams(previous => {
    const params = new URLSearchParams(previous)
    params.set('date', next)
    return params
  })

  const [data, setData] = useState<LoadedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError(''); setData(null)
    try {
      if (serviceModel === 'domiciliary') {
        const [summaryResult, pulseResult] = await Promise.allSettled([
          api.get('/mission-control/homecare-summary', { params: { date }, timeout: 15000 }),
          api.get('/reporting/overview', { timeout: 15000 }),
        ])
        if (summaryResult.status === 'rejected') throw summaryResult.reason
        setData({
          homecare: summaryResult.value.data,
          supported: null,
          pulse: pulseResult.status === 'fulfilled' ? pulseResult.value.data : null,
        })
      } else {
        const [stats, rota, reviews, widgets, pulse, summary] = await Promise.all([
          api.get('/dashboard/stats', { timeout: 15000 }),
          api.get('/dashboard/today-rota', { params: { date }, timeout: 15000 }),
          api.get('/dashboard/review-scheduler', { timeout: 15000 }),
          api.get('/dashboard/widgets', { timeout: 15000 }),
          api.get('/reporting/overview', { timeout: 15000 }),
          api.get('/mission-control/summary', { timeout: 15000 }),
        ])
        setData({
          homecare: null,
          supported: {
            stats: stats.data,
            rota: rota.data,
            reviews: reviews.data,
            widgets: widgets.data,
            staffing_coverage: summary.data.staffing_coverage,
          },
          pulse: pulse.data,
        })
      }
    } catch (err: any) {
      setError(err.response?.data?.message || (serviceModel === 'domiciliary'
        ? 'Could not load call and coverage information.'
        : 'Could not load the operational overview.'))
    } finally { setLoading(false) }
  }, [date, serviceModel])

  useEffect(() => { void load() }, [load])

  return (
    <PageContainer>
      <PageMeta title="Mission Control" description="Daily operations, staffing, compliance and exceptions." />
      <Box sx={{ minWidth: 0, maxWidth: 1440, mx: 'auto', pb: 4 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} gap={1.5} sx={{ mb: 1.5 }}>
          <Box>
            <Typography component="h1" variant="h4" sx={{ fontWeight: 700, letterSpacing: '-0.025em' }}>Mission Control</Typography>
            <Typography variant="body2" color="text.secondary">Daily operations, staffing, compliance and exceptions.</Typography>
          </Box>
          <DateControls date={date} today={today} onChange={setDate} />
        </Stack>
        <MissionControlTabs search={search} serviceModel={serviceModel} />
        {loading && !data ? (
          <Stack spacing={1.5} role="status" aria-label="Loading Mission Control">
            <Skeleton variant="rounded" height={88} />
            <Skeleton variant="rounded" height={320} />
          </Stack>
        ) : error || !data ? (
          <SectionError message={error || 'Mission Control information is unavailable.'} onRetry={() => void load()} />
        ) : (
          <MissionControlContext.Provider value={{ serviceModel, date, homecare: data.homecare, supported: data.supported, pulse: data.pulse }}>
            <Outlet />
          </MissionControlContext.Provider>
        )}
      </Box>
    </PageContainer>
  )
}
