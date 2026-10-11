import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Box, Stack, Typography, Checkbox,
} from '@mui/material'
import {
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'
import {
  AccessTime as TimeIcon,
  Description as NoteIcon,
  Medication as MedIcon,
  Warning as WarningIcon,
  PriorityHigh as CriticalIcon,
  Info as InfoIcon,
  NavigateNext as NextIcon,
  PostAdd as AddNoteIcon,
  Medication as RecordMedIcon,
  Report as ReportIncidentIcon,
  AddTask as CreateTaskIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import PersonAvatar from '../../components/PersonAvatar'
import { Card, SectionError, EmptyRow, StatusBadge } from '../../components/ui'

/**
 * Types mirror GET /dashboard/daily-overview. The endpoint aggregates five
 * queries so the sections stay consistent to one instant; each section still
 * fails independently here via its own retry wrapper.
 */
export interface DailyOverview {
  people: Array<{
    id: string; name: string; room: string | null; photo_url: string | null
    status: string
    notes_today: number
    next_task: { label: string; time: string | null } | null
  }>
  tasks: Array<{ id: string; title: string; status: string; priority: string; due_date: string | null; person_name: string | null }>
  activity: Array<{ id: string; kind: 'care_note' | 'medication'; time: string; title: string; summary: string | null; person_name: string; photo_url: string | null }>
  medication: { due_now: number; upcoming: number; completed: number }
  appointments: Array<{ id: string; title: string; start_time: string; status: string; person_name: string; room: string | null; photo_url: string | null }>
}

export function useDailyOverview() {
  return useQuery<DailyOverview>({
    queryKey: ['dashboard', 'daily-overview'],
    queryFn: () => api.get('/dashboard/daily-overview', { timeout: 15000 }).then(r => r.data),
    refetchInterval: 60_000,
  })
}

const PEOPLE_STATUS_VARIANT: Record<string, { variant: 'success' | 'warning' | 'danger'; label: string }> = {
  stable: { variant: 'success' as const, label: 'Stable' },
  needs_support: { variant: 'warning' as const, label: 'Needs support' },
  under_review: { variant: 'danger' as const, label: 'Under review' },
}

const timeOf = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''

/** People you're supporting — compact table with real next-event data. */
export function PeopleOverviewCard({ data, loading, error, onRetry }: { data?: DailyOverview['people']; loading: boolean; error: boolean; onRetry: () => void }) {
  const navigate = useNavigate()
  return (
    <Card header={{ title: "People you're supporting", onViewAll: () => navigate('/people') }} sx={{ height: '100%' }}>
      {loading ? (
        <Stack spacing={1.5}>{[0, 1, 2].map(i => <SkeletonLine key={i} />)}</Stack>
      ) : error ? (
        <SectionError message="Unable to load the people you support." onRetry={onRetry} />
      ) : !data?.length ? (
        <EmptyRow message="No people are active yet. Add the people you support to see them here." />
      ) : (
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Name', 'Room', 'Status', 'Next'].map(h => (
                <th key={h} align="left" style={{ paddingBottom: 8, borderBottom: '1px solid var(--mc-border)', fontSize: 11, fontWeight: 600, color: 'var(--mc-text-muted)', textTransform: 'none', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map(person => {
              const tone = PEOPLE_STATUS_VARIANT[person.status] ?? PEOPLE_STATUS_VARIANT.stable
              return (
                <tr
                  key={person.id}
                  onClick={() => navigate(`/people/${person.id}`)}
                  style={{ cursor: 'pointer', borderBottom: '1px solid var(--mc-border-soft, var(--mc-border))' }}
                >
                  <td style={{ padding: '10px 8px 10px 0' }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <PersonAvatar photoUrl={person.photo_url} name={person.name} sx={{ width: 32, height: 32, fontSize: 13 }} />
                      <Typography sx={{ fontSize: 'var(--font-md)', fontWeight: 600 }}>{person.name}</Typography>
                    </Stack>
                  </td>
                  <td style={{ padding: '10px 4px', fontSize: 'var(--font-sm)', color: 'var(--mc-text-secondary)' }}>{person.room || '—'}</td>
                  <td style={{ padding: '10px 4px' }}><StatusBadge tone={tone.variant === 'danger' ? 'error' : tone.variant} label={tone.label} /></td>
                  <td style={{ padding: '10px 0', fontSize: 'var(--font-sm)', color: 'var(--mc-text-secondary)', whiteSpace: 'nowrap' }}>
                    {person.next_task
                      ? <>{person.next_task.label}{person.next_task.time ? <> · <TimeIcon sx={{ fontSize: 12, verticalAlign: '-2px', mr: 0.25 }} />{timeOf(person.next_task.time)}</> : null}</>
                      : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </Box>
      )}
    </Card>
  )
}

function SkeletonLine() {
  return <Box sx={{ height: 36, borderRadius: 'var(--radius-sm)', bgcolor: 'var(--mc-surface-hover)' }} />
}

/** Today's tasks — compact checklist backed by the real tasks table. */
export function TodaysTasks({ data, loading, error, onRetry }: { data?: DailyOverview['tasks']; loading: boolean; error: boolean; onRetry: () => void }) {
  const navigate = useNavigate()
  return (
    <Card header={{ title: "Today's tasks", onViewAll: () => navigate('/tasks') }} sx={{ height: '100%' }}>
      {loading ? (
        <Stack spacing={1.5}>{[0, 1, 2].map(i => <SkeletonLine key={i} />)}</Stack>
      ) : error ? (
        <SectionError message="Unable to load today's tasks." onRetry={onRetry} />
      ) : !data?.length ? (
        <EmptyRow message="No tasks due today. Add one from the Tasks board." />
      ) : (
        <Stack divider={<Box sx={{ height: 1, bgcolor: 'var(--mc-border-soft, var(--mc-border))' }} />}>
          {data.map(task => {
            const overdue = task.due_date && task.status !== 'completed' && new Date(task.due_date) < new Date(new Date().toDateString())
            return (
              <Box
                key={task.id}
                component="button"
                type="button"
                onClick={() => navigate('/tasks')}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25, width: '100%',
                  textAlign: 'left', border: 0, bgcolor: 'transparent', cursor: 'pointer', font: 'inherit', color: 'inherit',
                  '&:hover': { bgcolor: 'var(--mc-surface-hover)' }, borderRadius: 'var(--radius-sm)',
                  '&:focus-visible': { outline: '2px solid var(--mc-primary)', outlineOffset: -2 },
                }}
              >
                <Checkbox
                  checked={task.status === 'completed'}
                  tabIndex={-1}
                  sx={{ p: 0.5, color: 'var(--mc-text-muted)', '&.Mui-checked': { color: 'var(--mc-success)' } }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 'var(--font-md)', fontWeight: 500, textDecoration: task.status === 'completed' ? 'line-through' : 'none', color: task.status === 'completed' ? 'var(--mc-text-muted)' : 'inherit' }}>
                    {task.title}
                  </Typography>
                  {task.person_name && <Typography variant="caption" sx={{ color: 'text.secondary' }}>{task.person_name}</Typography>}
                </Box>
                {overdue
                  ? <StatusBadge tone="error" label="Overdue" />
                  : task.priority === 'urgent' || task.priority === 'high'
                    ? <StatusBadge tone="warning" label="Priority" />
                    : null}
              </Box>
            )
          })}
        </Stack>
      )}
    </Card>
  )
}

/** Right-rail alerts, derived from real widget counts. Quiet unless real. */
export function AlertsPanel({ widgets, loading, error, onRetry }: {
  widgets?: {
    overdue_medications: number; open_severe_incidents: number; dbs_expiring_soon: number
    training_expiring_soon: number; competency_due: number; staff_below_threshold: number; pending_leave_requests: number
  } | null
  loading: boolean
  error: boolean
  onRetry: () => void
}) {
  const navigate = useNavigate()
  const alerts = useMemo(() => {
    if (!widgets) return []
    const list: Array<{ tone: 'danger' | 'warning' | 'info'; title: string; detail: string; path: string }> = []
    if (widgets.open_severe_incidents > 0) list.push({ tone: 'danger', title: `${widgets.open_severe_incidents} critical incident${widgets.open_severe_incidents === 1 ? '' : 's'} open`, detail: 'Needs follow-up', path: '/incidents' })
    if (widgets.overdue_medications > 0) list.push({ tone: 'warning', title: `${widgets.overdue_medications} medication${widgets.overdue_medications === 1 ? '' : 's'} overdue`, detail: 'Doses past their scheduled time', path: '/emedication' })
    if (widgets.staff_below_threshold > 0) list.push({ tone: 'warning', title: `${widgets.staff_below_threshold} staff below compliance threshold`, detail: 'Review staff records', path: '/staff' })
    if (widgets.competency_due > 0) list.push({ tone: 'info', title: `${widgets.competency_due} competency assessment${widgets.competency_due === 1 ? '' : 's'} due`, detail: 'Assessments awaiting review', path: '/compliance/competency' })
    if (widgets.dbs_expiring_soon > 0) list.push({ tone: 'info', title: `${widgets.dbs_expiring_soon} background check${widgets.dbs_expiring_soon === 1 ? '' : 's'} expiring`, detail: 'Renew within 30 days', path: '/compliance/identity' })
    if (widgets.training_expiring_soon > 0) list.push({ tone: 'info', title: `${widgets.training_expiring_soon} training record${widgets.training_expiring_soon === 1 ? '' : 's'} expiring`, detail: 'Refresh within 30 days', path: '/compliance/training' })
    if (widgets.pending_leave_requests > 0) list.push({ tone: 'info', title: `${widgets.pending_leave_requests} leave request${widgets.pending_leave_requests === 1 ? '' : 's'} pending`, detail: 'Awaiting your review', path: '/leave' })
    return list.slice(0, 5)
  }, [widgets])

  const toneIcon = { danger: <CriticalIcon fontSize="small" />, warning: <WarningIcon fontSize="small" />, info: <InfoIcon fontSize="small" /> }
  const toneColor = {
    danger: { bg: 'var(--mc-danger-soft)', fg: 'var(--mc-danger-text)' },
    warning: { bg: 'var(--mc-warning-soft)', fg: 'var(--mc-warning-text)' },
    info: { bg: 'var(--mc-info-soft)', fg: 'var(--mc-info-text)' },
  }

  return (
    <Card header={{ title: 'Alerts & updates' }} sx={{ height: '100%' }}>
      {loading ? (
        <Stack spacing={1.5}>{[0, 1, 2].map(i => <SkeletonLine key={i} />)}</Stack>
      ) : error ? (
        <SectionError message="Unable to load alerts." onRetry={onRetry} />
      ) : alerts.length === 0 ? (
        <EmptyRow message="Nothing needs attention. Everything is up to date." />
      ) : (
        <Stack spacing={1}>
          {alerts.map(alert => (
            <Box
              key={alert.title}
              component="button"
              type="button"
              onClick={() => navigate(alert.path)}
              sx={{
                display: 'flex', alignItems: 'flex-start', gap: 1.25, p: 1.25, width: '100%', textAlign: 'left',
                border: 0, borderRadius: 'var(--radius-md)', bgcolor: toneColor[alert.tone].bg, cursor: 'pointer', font: 'inherit',
                '&:hover': { filter: 'brightness(0.98)' },
                '&:focus-visible': { outline: '2px solid var(--mc-primary)', outlineOffset: 2 },
              }}
            >
              <Box sx={{ color: toneColor[alert.tone].fg, display: 'flex', mt: 0.25 }}>{toneIcon[alert.tone]}</Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: toneColor[alert.tone].fg }}>{alert.title}</Typography>
                <Typography variant="caption" sx={{ color: toneColor[alert.tone].fg, opacity: 0.8, display: 'block' }}>{alert.detail}</Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      )}
    </Card>
  )
}

/** Upcoming appointments — real appointments joined to people. */
export function UpcomingAppointments({ data, loading, error, onRetry }: { data?: DailyOverview['appointments']; loading: boolean; error: boolean; onRetry: () => void }) {
  const navigate = useNavigate()
  return (
    <Card header={{ title: 'Upcoming appointments', onViewAll: () => navigate('/appointments') }} sx={{ height: '100%' }}>
      {loading ? (
        <Stack spacing={1.5}>{[0, 1, 2].map(i => <SkeletonLine key={i} />)}</Stack>
      ) : error ? (
        <SectionError message="Unable to load today's appointments." onRetry={onRetry} />
      ) : !data?.length ? (
        <EmptyRow message="No appointments scheduled for today." />
      ) : (
        <Stack divider={<Box sx={{ height: 1, bgcolor: 'var(--mc-border-soft, var(--mc-border))' }} />}>
          {data.map(apt => (
            <Box
              key={apt.id}
              component="button"
              type="button"
              onClick={() => navigate('/appointments')}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25, width: '100%', textAlign: 'left',
                border: 0, bgcolor: 'transparent', cursor: 'pointer', font: 'inherit', color: 'inherit',
                '&:hover': { bgcolor: 'var(--mc-surface-hover)' }, borderRadius: 'var(--radius-sm)',
                '&:focus-visible': { outline: '2px solid var(--mc-primary)', outlineOffset: -2 },
              }}
            >
              <Box sx={{ minWidth: 44 }}>
                <Typography sx={{ fontSize: 'var(--font-sm)', fontWeight: 600 }}>{timeOf(apt.start_time)}</Typography>
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 'var(--font-md)', fontWeight: 600 }}>{apt.title}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {apt.person_name}{apt.room ? ` · Room ${apt.room}` : ''}
                </Typography>
              </Box>
              <NextIcon sx={{ fontSize: 16, color: 'var(--mc-text-muted)' }} />
            </Box>
          ))}
        </Stack>
      )}
    </Card>
  )
}

/** Care notes activity — today's daily notes and medication events in one feed. */
export function CareNotesActivity({ data, loading, error, onRetry }: { data?: DailyOverview['activity']; loading: boolean; error: boolean; onRetry: () => void }) {
  const navigate = useNavigate()
  return (
    <Card header={{ title: 'Care notes activity', onViewAll: () => navigate('/people') }} sx={{ height: '100%' }}>
      {loading ? (
        <Stack spacing={1.5}>{[0, 1, 2].map(i => <SkeletonLine key={i} />)}</Stack>
      ) : error ? (
        <SectionError message="Unable to load today's activity." onRetry={onRetry} />
      ) : !data?.length ? (
        <EmptyRow message="No care notes or medication events recorded yet today." />
      ) : (
        <Stack divider={<Box sx={{ height: 1, bgcolor: 'var(--mc-border-soft, var(--mc-border))' }} />}>
          {data.map(item => (
            <Box
              key={`${item.kind}-${item.id}`}
              onClick={() => navigate('/people')}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25, cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                '&:hover': { bgcolor: 'var(--mc-surface-hover)' },
              }}
            >
              <Typography sx={{ fontSize: 'var(--font-sm)', color: 'var(--mc-text-secondary)', minWidth: 44 }}>{timeOf(item.time)}</Typography>
              <Box sx={{
                width: 30, height: 30, borderRadius: 'var(--radius-sm)', display: 'grid', placeItems: 'center', flexShrink: 0,
                bgcolor: item.kind === 'medication' ? 'var(--mc-secondary-soft)' : 'var(--mc-primary-soft)',
                color: item.kind === 'medication' ? 'var(--mc-secondary)' : 'var(--mc-primary)',
              }}>
                {item.kind === 'medication' ? <MedIcon sx={{ fontSize: 16 }} /> : <NoteIcon sx={{ fontSize: 16 }} />}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={0.75} alignItems="baseline">
                  <Typography sx={{ fontSize: 'var(--font-sm)', fontWeight: 600 }}>{item.kind === 'medication' ? 'Medication given' : 'Care note'}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>{item.person_name}</Typography>
                </Stack>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.kind === 'medication' ? item.title : item.summary || item.title}
                </Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      )}
    </Card>
  )
}

/** Medication overview — donut of today's administrations from the eMAR tables. */
export function MedicationOverview({ data, loading, error, onRetry }: { data?: DailyOverview['medication']; loading: boolean; error: boolean; onRetry: () => void }) {
  const navigate = useNavigate()
  const total = data ? data.due_now + data.upcoming + data.completed : 0
  const chartData = data ? [
    { name: 'Due today', value: data.due_now, color: 'var(--mc-warning)' },
    { name: 'Upcoming', value: data.upcoming, color: 'var(--mc-info)' },
    { name: 'Completed', value: data.completed, color: 'var(--mc-success)' },
  ].filter(d => d.value > 0) : []

  return (
    <Card header={{ title: 'Medication overview', onViewAll: () => navigate('/emedication') }} sx={{ height: '100%' }}>
      {loading ? (
        <SkeletonLine />
      ) : error ? (
        <SectionError message="Unable to load medication data." onRetry={onRetry} />
      ) : total === 0 ? (
        <EmptyRow message="No medications scheduled today." />
      ) : (
        <Stack alignItems="center" spacing={2} sx={{ py: 1 }}>
          <Box sx={{ position: 'relative', width: 160, height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} dataKey="value" innerRadius={52} outerRadius={72} paddingAngle={3} strokeWidth={0}>
                  {chartData.map(entry => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontSize: 'var(--font-2xl)', fontWeight: 600, lineHeight: 1.1 }}>{data!.due_now}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>due today</Typography>
              </Box>
            </Box>
          </Box>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap justifyContent="center">
            {[
              { label: 'Due today', value: data!.due_now, color: 'var(--mc-warning)' },
              { label: 'Upcoming', value: data!.upcoming, color: 'var(--mc-info)' },
              { label: 'Completed', value: data!.completed, color: 'var(--mc-success)' },
            ].map(legend => (
              <Stack key={legend.label} direction="row" spacing={0.75} alignItems="center">
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: legend.color }} />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>{legend.value} {legend.label}</Typography>
              </Stack>
            ))}
          </Stack>
        </Stack>
      )}
    </Card>
  )
}

/** Quick actions — shortcuts, not content. Small, quiet, one row. */
export function QuickActions() {
  const navigate = useNavigate()
  const actions = [
    { label: 'Add care note', icon: <AddNoteIcon fontSize="small" />, color: 'var(--mc-primary)', soft: 'var(--mc-primary-soft)', path: '/people' },
    { label: 'Record medication', icon: <RecordMedIcon fontSize="small" />, color: 'var(--mc-secondary)', soft: 'var(--mc-secondary-soft)', path: '/emedication' },
    { label: 'Report incident', icon: <ReportIncidentIcon fontSize="small" />, color: 'var(--mc-danger)', soft: 'var(--mc-danger-soft)', path: '/incidents' },
    { label: 'Create task', icon: <CreateTaskIcon fontSize="small" />, color: 'var(--mc-warning)', soft: 'var(--mc-warning-soft)', path: '/tasks' },
  ]
  return (
    <Card header={{ title: 'Quick actions' }} sx={{ height: '100%' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
        {actions.map(action => (
          <Box
            key={action.label}
            component="button"
            type="button"
            onClick={() => navigate(action.path)}
            sx={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 1.25, p: 1.25, textAlign: 'left',
              border: '1px solid var(--mc-border)', borderRadius: 'var(--radius-md)', bgcolor: 'var(--mc-surface)',
              cursor: 'pointer', font: 'inherit', color: 'inherit', transition: 'border-color var(--mc-transition)',
              '&:hover': { borderColor: 'var(--mc-border-strong)' },
              '&:focus-visible': { outline: '2px solid var(--mc-primary)', outlineOffset: 2 },
            }}
          >
            <Box sx={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', display: 'grid', placeItems: 'center', bgcolor: action.soft, color: action.color, flexShrink: 0 }}>
              {action.icon}
            </Box>
            <Typography sx={{ fontSize: 'var(--font-sm)', fontWeight: 600 }}>{action.label}</Typography>
          </Box>
        ))}
      </Stack>
    </Card>
  )
}
