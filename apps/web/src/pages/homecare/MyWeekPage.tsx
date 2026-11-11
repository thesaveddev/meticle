import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Button, Alert, CircularProgress,
  Dialog, DialogContent, DialogActions,
} from '@mui/material'
import {
  CalendarMonth as CalendarIcon,
  CheckCircle as CheckIcon,
  AccessTime as ClockIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon,
  Event as EventIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  SwapHoriz as SwapIcon,
} from '@mui/icons-material'
import FigDialogHeader from '../people/dialogHeader'
import api from '../../services/api'
import { addLocalDays, localDate } from '../../utils/dateFormat'
import './myspace.css'

function time(v: string) {
  return new Date(v).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function startOfWeek(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = (d.getDay() + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - day)
  return d
}

function statusChip(status: string) {
  switch (status) {
    case 'completed': return { label: 'Done', className: 'ms-chip--ok' }
    case 'checked_in': return { label: 'On a visit', className: 'ms-chip--accent' }
    case 'en_route': return { label: 'On the way', className: 'ms-chip--accent' }
    case 'missed': return { label: 'Missed', className: 'ms-chip--danger' }
    case 'cancelled': return { label: 'Cancelled', className: 'ms-chip--neutral' }
    default: return { label: 'Upcoming', className: 'ms-chip--neutral' }
  }
}

export default function MyWeekPage() {
  const [visits, setVisits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [weekOffset, setWeekOffset] = useState(0)
  const [detail, setDetail] = useState<any | null>(null)
  const [startTarget, setStartTarget] = useState<any | null>(null)
  const [startError, setStartError] = useState('')
  const [starting, setStarting] = useState(false)

  const weekStart = addLocalDays(startOfWeek(new Date()), weekOffset * 7)
  const weekEnd = addLocalDays(weekStart, 6)

  const loadWeek = useCallback(async () => {
    setLoading(true)
    setError('')
    const from = new Date(weekStart); from.setHours(0, 0, 0, 0)
    const to = new Date(weekEnd); to.setHours(23, 59, 59, 999)
    try {
      const response = await api.get('/homecare/week-visits', {
        params: { from: from.toISOString(), to: to.toISOString() },
        timeout: 20_000,
      })
      setVisits(Array.isArray(response.data) ? response.data : [])
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load your week. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [weekOffset])

  useEffect(() => { loadWeek() }, [loadWeek])

  // Group calls by day
  const grouped: Record<string, any[]> = {}
  for (const v of visits) {
    const key = localDate(new Date(v.scheduled_start))
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(v)
  }

  const today = localDate()
  const completed = visits.filter(v => v.status === 'completed').length
  const scheduledHours = visits.reduce((total, visit) => {
    const start = new Date(visit.scheduled_start).getTime()
    const end = new Date(visit.scheduled_end).getTime()
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? total + (end - start) / 3_600_000 : total
  }, 0)

  // Monday → Sunday of the selected week, always all seven days
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addLocalDays(weekStart, i)
    const key = localDate(date)
    return {
      key,
      date,
      isToday: key === today,
      label: date.toLocaleDateString('en-GB', { weekday: 'short' }),
      dateLabel: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      longLabel: date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
      visits: (grouped[key] || []).slice().sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()),
    }
  })

  const daysWithVisits = days.filter(day => day.visits.length > 0)
  const todayVisits = days.find(day => day.isToday)?.visits || []
  const nextVisit = todayVisits.find(visit => !['completed', 'missed', 'cancelled', 'checked_in'].includes(visit.status)) || null

  const weekLabel = `${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`

  const startVisit = async () => {
    if (!startTarget) return
    setStarting(true)
    setStartError('')
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('This browser cannot share a location, so a visit cannot be started from it.'))
          return
        }
        navigator.geolocation.getCurrentPosition(
          resolve,
          () => reject(new Error('Allow location access to start a visit — it confirms you are at the person’s address.')),
          { enableHighAccuracy: true, timeout: 15_000 },
        )
      })
      await api.post(`/homecare/visits/${startTarget.id}/check-in`, {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy_meters: Math.round(position.coords.accuracy),
      })
      setStartTarget(null)
      await loadWeek()
    } catch (err: any) {
      setStartError(err?.response?.data?.message || err?.message || 'Could not start this visit. Please try again.')
    } finally {
      setStarting(false)
    }
  }

  return (
    <Box className="myspace">
      <Typography className="ms-crumbs">My space / My week</Typography>

      <header className="ms-header">
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h1" className="ms-header__title">My week</Typography>
          <Typography className="ms-header__copy">
            Your visits for {weekLabel} · {visits.length} {visits.length === 1 ? 'visit' : 'visits'}, {completed} done
          </Typography>
        </Box>
        <Box className="ms-header__actions">
          <Button variant="contained" className="ms-button ms-button--primary" startIcon={<SwapIcon />} onClick={() => { window.location.assign('/swap-transfer') }}>
            Swap a visit
          </Button>
        </Box>
      </header>

      <Box className="ms-weekbar">
        <div className="ms-weekpill">
          <Button className="ms-icon-button" aria-label="Previous week" onClick={() => setWeekOffset(offset => offset - 1)}>
            <ChevronLeftIcon fontSize="small" />
          </Button>
          <CalendarIcon className="ms-weekpill__icon" />
          <span className="ms-weekpill__label">{weekLabel}</span>
          <Button className="ms-icon-button" aria-label="Next week" onClick={() => setWeekOffset(offset => offset + 1)}>
            <ChevronRightIcon fontSize="small" />
          </Button>
        </div>
        {weekOffset !== 0 && (
          <Button variant="outlined" className="ms-button ms-button--quiet" onClick={() => setWeekOffset(0)}>This week</Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={loadWeek}>Try again</Button>}>
          {error}
        </Alert>
      )}

      {visits.length > 0 && (
        <section className="ms-metrics" aria-label="Week summary">
          <div className="ms-metric">
            <div className="ms-metric__top">
              <Typography className="ms-metric__label">Visits this week</Typography>
              <span className="ms-metric__icon"><CalendarIcon fontSize="small" /></span>
            </div>
            <Typography className="ms-metric__value">{visits.length}</Typography>
          </div>
          <div className="ms-metric">
            <div className="ms-metric__top">
              <Typography className="ms-metric__label">Done</Typography>
              <span className="ms-metric__icon ms-metric__icon--ok"><CheckIcon fontSize="small" /></span>
            </div>
            <Typography className="ms-metric__value">{completed}</Typography>
            <Typography className="ms-metric__detail">{Math.round((completed / visits.length) * 100)}% of this week</Typography>
          </div>
          <div className="ms-metric">
            <div className="ms-metric__top">
              <Typography className="ms-metric__label">Hours</Typography>
              <span className="ms-metric__icon"><ClockIcon fontSize="small" /></span>
            </div>
            <Typography className="ms-metric__value">{Math.round(scheduledHours * 10) / 10} h</Typography>
            <Typography className="ms-metric__detail">Scheduled call time</Typography>
          </div>
        </section>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : daysWithVisits.length === 0 ? (
        <section className="ms-empty-card">
          <span className="ms-empty__icon"><CalendarIcon /></span>
          <Typography className="ms-empty__title">No visits this week</Typography>
          <Typography className="ms-empty__copy">
            Calls you are assigned appear here by day as soon as the rota is published. Try another week, or ask your manager if you expected calls.
          </Typography>
          {weekOffset !== 0 && (
            <Button variant="contained" className="ms-button ms-button--primary ms-empty__action" onClick={() => setWeekOffset(0)}>
              Back to this week
            </Button>
          )}
        </section>
      ) : (
        <Box className="ms-days">
          {daysWithVisits.map(day => (
            <section className="ms-day" key={day.key}>
              <Typography component="h2" className="ms-day__title">{day.longLabel}</Typography>
              {day.visits.map((visit: any) => {
                const chip = statusChip(visit.status)
                const meta = [
                  visit.person_name,
                  visit.person_address,
                  visit.status === 'completed' && visit.check_in_at ? `done at ${time(visit.check_in_at)}` : null,
                ].filter(Boolean).join(' · ')
                return (
                  <div
                    key={visit.id}
                    className="ms-visit"
                    role="button"
                    tabIndex={0}
                    onClick={() => setDetail(visit)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setDetail(visit)
                      }
                    }}
                  >
                    <span className={`ms-visit__icon${visit.status === 'completed' ? ' ms-visit__icon--done' : visit.status === 'missed' ? ' ms-visit__icon--missed' : ''}`}>
                      {visit.status === 'completed' ? <CheckIcon fontSize="small" /> : <ClockIcon fontSize="small" />}
                    </span>
                    <div className="ms-visit__body">
                      <p className="ms-visit__line">
                        <span className="ms-visit__time">{time(visit.scheduled_start)} – {time(visit.scheduled_end)}</span>
                        {' · '}
                        <span className="ms-visit__name">{visit.label}</span>
                      </p>
                      {meta && <p className="ms-visit__meta">{meta}</p>}
                    </div>
                    <div className="ms-visit__actions">
                      <span className={`ms-chip ${chip.className}`}>{chip.label}</span>
                      {nextVisit?.id === visit.id && (
                        <Button
                          variant="outlined"
                          className="ms-button ms-button--quiet"
                          onClick={event => { event.stopPropagation(); setStartError(''); setStartTarget(visit) }}
                        >
                          Start visit
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </section>
          ))}
        </Box>
      )}

      <Typography className="ms-footnote">Your visits for the selected week, from the live rota.</Typography>

      <Dialog className="ms-dialog" open={!!detail} onClose={() => setDetail(null)} maxWidth="xs" fullWidth>
        {detail && (
          <>
            <FigDialogHeader
              eyebrow="MY WEEK"
              title={detail.label}
              subtitle={new Date(detail.scheduled_start).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              onClose={() => setDetail(null)}
            />
            <DialogContent>
              <div className="ms-detail">
                <div className="ms-detail__row">
                  <span className={`ms-chip ${statusChip(detail.status).className}`}>{statusChip(detail.status).label}</span>
                </div>
                <div className="ms-detail__row">
                  <ClockIcon className="ms-detail__icon" />
                  <span>{time(detail.scheduled_start)} – {time(detail.scheduled_end)}</span>
                </div>
                {detail.person_name && (
                  <div className="ms-detail__row">
                    <PersonIcon className="ms-detail__icon" />
                    <span>{detail.person_name}</span>
                  </div>
                )}
                {detail.person_address && (
                  <div className="ms-detail__row">
                    <LocationIcon className="ms-detail__icon" />
                    <span>{detail.person_address}</span>
                  </div>
                )}
                {!detail.person_name && !detail.person_address && (
                  <div className="ms-detail__row">
                    <EventIcon className="ms-detail__icon" />
                    <span>No client details recorded for this call.</span>
                  </div>
                )}
              </div>
            </DialogContent>
          </>
        )}
      </Dialog>

      <Dialog className="ms-dialog" open={!!startTarget} onClose={() => setStartTarget(null)} maxWidth="xs" fullWidth>
        <FigDialogHeader
          eyebrow="MY WEEK"
          title="Start this visit?"
          subtitle={startTarget ? `${startTarget.label}${startTarget.person_name ? ` · ${startTarget.person_name}` : ''} at ${time(startTarget.scheduled_start)}` : undefined}
          onClose={() => setStartTarget(null)}
        />
        <DialogContent>
          {startError && <Alert severity="error">{startError}</Alert>}
          <Typography className="ms-dialog__note">
            Starting the visit records the time and shares your position with the office, so the call is backed by
            evidence that you were there. Keep the app open until it confirms.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStartTarget(null)}>Cancel</Button>
          <Button variant="contained" className="ms-button ms-button--primary" onClick={startVisit} disabled={starting}>
            {starting ? <CircularProgress size={18} color="inherit" /> : 'Start visit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
