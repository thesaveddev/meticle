/**
 * Attendance and handover for one shift, inside the rota's shift detail dialog.
 *
 * This is the supported-living half of the field record: a support worker clocks
 * on when they take over the setting and off when they leave, and at the end of
 * the shift hands the setting over to whoever comes next with a record a named
 * colleague acknowledges (mobile blueprint §9.1/§9.2).
 *
 * Three things are deliberate:
 *
 *  * The buttons are shown to the worker who is rostered on the shift and to
 *    nobody else. A manager reads the attendance — they do not clock people in,
 *    and the API refuses them anyway.
 *  * A clock-on that cannot reach the server is kept on this device with the
 *    key it was created with, and retried on the next open. The retry is the
 *    same action, not a second one.
 *  * The handover shows what was amended and keeps the earlier wording
 *    available, because the version a colleague read is part of the record.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box, Button, Chip, CircularProgress, Divider, Stack, TextField, Typography,
} from '@mui/material'
import {
  CheckCircle as CheckIcon, CloudOff as OfflineIcon, Edit as EditIcon,
  History as HistoryIcon, Login as ClockOnIcon, Logout as ClockOffIcon,
} from '@mui/icons-material'
import api from '../../../services/api'
import {
  flushPendingShiftActions, newActionKey, pendingActionsForShift, queueShiftAction,
  type PendingShiftAction,
} from './pendingShiftActions'

interface ShiftAttendancePanelProps {
  shiftId: string
  /** True when the signed-in user holds one of this shift's assignments. */
  isAssignedToMe: boolean
  /** Managers and admins may write a handover when nobody on the shift could. */
  isManager: boolean
  /** Called after attendance or handover changes, so the grid can refresh. */
  onRecorded?: () => void
}

const fmtTime = (iso?: string | null) => (iso
  ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  : '—')

const fmtDateTime = (iso?: string | null) => (iso
  ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '—')

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}m`
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

export default function ShiftAttendancePanel({ shiftId, isAssignedToMe, isManager, onRecorded }: ShiftAttendancePanelProps) {
  const [attendance, setAttendance] = useState<any>(null)
  const [handoverView, setHandoverView] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [queued, setQueued] = useState<PendingShiftAction[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [composing, setComposing] = useState(false)
  const [form, setForm] = useState({ what_happened: '', outstanding: '', who_is_aware: '' })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [attendanceRes, handoverRes] = await Promise.all([
        api.get(`/shifts/${shiftId}/attendance`, { silentError: true }),
        api.get(`/shifts/${shiftId}/handover`, { silentError: true }),
      ])
      setAttendance(attendanceRes.data)
      setHandoverView(handoverRes.data)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load this shift’s attendance.')
    } finally {
      setLoading(false)
    }
  }, [shiftId])

  useEffect(() => { load() }, [load])

  // The queue is per shift, and it is drained as soon as the panel opens: the
  // worker is most likely to have a connection when they are looking at the
  // shift they clocked on to.
  const sendQueuedAction = useCallback(async (item: PendingShiftAction) => {
    return api.post(`/shifts/${item.shiftId}/offline/${item.action}`, { ...item.payload, action_key: item.key })
  }, [])

  useEffect(() => {
    let cancelled = false
    const sync = async () => {
      setQueued(pendingActionsForShift(shiftId))
      const waiting = pendingActionsForShift(shiftId)
      if (waiting.length === 0) return
      setBusy('sync')
      const result = await flushPendingShiftActions(sendQueuedAction)
      if (cancelled) return
      setBusy('')
      setQueued(pendingActionsForShift(shiftId))
      if (result.synced > 0) {
        setNotice(`${result.synced} saved ${result.synced === 1 ? 'action' : 'actions'} synced.`)
        await load()
        onRecorded?.()
      }
    }
    sync()
    return () => { cancelled = true }
  }, [shiftId])

  // The API marks the caller's own roster row and whether they wrote the
  // current handover, so nothing here has to guess at who is signed in.
  const myRow = useMemo(() => (attendance?.rostered || []).find((row: any) => row.is_me) || null, [attendance])
  const anyoneOnDuty = useMemo(
    () => (attendance?.rostered || []).some((row: any) => row.on_duty),
    [attendance],
  )

  const submitClock = async (kind: 'clock-on' | 'clock-off') => {
    setBusy(kind)
    setNotice('')
    setError('')
    const payload = { action_key: newActionKey(), recorded_at: new Date().toISOString() }
    try {
      await api.post(`/shifts/${shiftId}/${kind}`, payload, { silentError: true })
      await load()
      onRecorded?.()
    } catch (err: any) {
      if (!err?.response) {
        // No response at all: the request never reached the server. Keep it,
        // with the key it was created with, so the next attempt sends the same
        // action rather than a second one.
        queueShiftAction({ shiftId, action: kind, payload })
        setQueued(pendingActionsForShift(shiftId))
        setNotice('No connection. Saved on this device — it will sync when you are back online.')
      } else {
        setError(err.response.data?.message || 'Could not record that. Try again.')
      }
    } finally {
      setBusy('')
    }
  }

  const submitHandover = async () => {
    if (!form.what_happened.trim()) {
      setError('Say what happened during the shift.')
      return
    }
    setBusy('handover')
    setNotice('')
    setError('')
    const payload = {
      action_key: newActionKey(),
      recorded_at: new Date().toISOString(),
      what_happened: form.what_happened.trim(),
      outstanding: form.outstanding.trim() || null,
      who_is_aware: form.who_is_aware.trim() || null,
    }
    try {
      await api.post(`/shifts/${shiftId}/handover`, payload, { silentError: true })
      setComposing(false)
      await load()
      onRecorded?.()
    } catch (err: any) {
      if (!err?.response) {
        queueShiftAction({ shiftId, action: 'handover', payload })
        setQueued(pendingActionsForShift(shiftId))
        setComposing(false)
        setNotice('No connection. The handover is saved on this device and will sync when you are back online.')
      } else {
        setError(err.response.data?.message || 'Could not record the handover.')
      }
    } finally {
      setBusy('')
    }
  }

  const acknowledge = async () => {
    setBusy('acknowledge')
    setNotice('')
    setError('')
    try {
      await api.post(`/shifts/${shiftId}/handover/acknowledge`, {}, { silentError: true })
      await load()
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not acknowledge the handover.')
    } finally {
      setBusy('')
    }
  }

  const retryQueue = async () => {
    setBusy('sync')
    setNotice('')
    const result = await flushPendingShiftActions(sendQueuedAction)
    setBusy('')
    setQueued(pendingActionsForShift(shiftId))
    if (result.synced > 0) {
      setNotice(`${result.synced} saved ${result.synced === 1 ? 'action' : 'actions'} synced.`)
      await load()
      onRecorded?.()
    } else {
      setNotice('Still no connection. The saved actions stay on this device.')
    }
  }

  const handover = handoverView?.handover || null
  const revisions: any[] = handoverView?.revisions || []
  const viewerAcknowledged = handoverView?.viewer_acknowledged === true
  const amAuthor = handoverView?.viewer_is_author === true
  const canWriteHandover = isAssignedToMe || isManager

  if (loading) {
    return (
      <Box sx={{ py: 2, textAlign: 'center' }}>
        <CircularProgress size={20} />
      </Box>
    )
  }

  return (
    <Stack spacing={1.5}>
      <Divider />
      <Box>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Attendance</Typography>
          {attendance?.unattended && (
            <Chip label="No one clocked on" size="small"
              sx={{ height: 17, fontSize: '0.58rem', fontWeight: 600, bgcolor: 'notice.warning.bg', color: 'notice.warning.fg' }} />
          )}
          {!attendance?.unattended && !anyoneOnDuty && (
            <Chip label="Shift closed" size="small"
              sx={{ height: 17, fontSize: '0.58rem', fontWeight: 600, bgcolor: 'notice.subtle.bg', color: 'text.secondary' }} />
          )}
          {anyoneOnDuty && (
            <Chip label="On duty" size="small"
              sx={{ height: 17, fontSize: '0.58rem', fontWeight: 600, bgcolor: 'notice.success.bg', color: 'notice.success.fg' }} />
          )}
        </Stack>

        {attendance?.actual_start_at && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            On site {fmtTime(attendance.actual_start_at)}
            {attendance.actual_end_at ? ` – ${fmtTime(attendance.actual_end_at)}` : ' – now'}
          </Typography>
        )}

        {(attendance?.rostered || []).length === 0 ? (
          <Typography variant="body2" color="text.secondary">No staff are rostered on this shift.</Typography>
        ) : (
          <Stack spacing={0.5}>
            {(attendance?.rostered || []).map((row: any) => (
              <Stack key={row.staff_id} direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" sx={{ minWidth: 120 }}>
                  {row.first_name} {row.last_name}
                  {row.is_overtime && (
                    <Chip label="OT" size="small" sx={{ ml: 0.5, height: 15, fontSize: '0.55rem', bgcolor: 'notice.warning.bg', color: 'notice.warning.fg', fontWeight: 600 }} />
                  )}
                </Typography>
                <Typography variant="body2" color={row.on_duty ? 'notice.success.fg' : 'text.secondary'} sx={{ fontWeight: row.on_duty ? 600 : 400 }}>
                  {row.clocked_on_at
                    ? `${fmtTime(row.clocked_on_at)}${row.clocked_off_at ? ` – ${fmtTime(row.clocked_off_at)}` : ' – now'}${row.worked_minutes ? ` · ${formatMinutes(row.worked_minutes)}` : ''}`
                    : 'No record'}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}

        {isAssignedToMe && (
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            {myRow?.on_duty ? (
              <Button size="small" variant="contained" color="warning" startIcon={busy === 'clock-off' ? undefined : <ClockOffIcon />}
                onClick={() => submitClock('clock-off')} disabled={busy !== ''}>
                {busy === 'clock-off' ? <CircularProgress size={14} sx={{ color: 'white' }} /> : 'Clock off'}
              </Button>
            ) : (
              <Button size="small" variant="contained" startIcon={busy === 'clock-on' ? undefined : <ClockOnIcon />}
                onClick={() => submitClock('clock-on')} disabled={busy !== ''}>
                {busy === 'clock-on' ? <CircularProgress size={14} sx={{ color: 'white' }} /> : 'Clock on'}
              </Button>
            )}
          </Stack>
        )}

        {queued.length > 0 && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1, p: 1, borderRadius: 1, bgcolor: 'notice.warning.bg' }}>
            <OfflineIcon sx={{ fontSize: 16, color: 'notice.warning.fg' }} />
            <Typography variant="caption" sx={{ color: 'notice.warning.fg', fontWeight: 600 }}>
              {queued.length} {queued.length === 1 ? 'action is' : 'actions are'} saved on this device and not yet sent.
            </Typography>
            <Button size="small" sx={{ ml: 'auto', fontSize: '0.68rem', textTransform: 'none' }}
              onClick={retryQueue} disabled={busy !== ''}>
              {busy === 'sync' ? <CircularProgress size={12} /> : 'Try now'}
            </Button>
          </Stack>
        )}
      </Box>

      <Divider />

      <Box>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Handover</Typography>
          {handover && handover.version > 1 && (
            <Chip label={`Version ${handover.version}`} size="small"
              sx={{ height: 17, fontSize: '0.58rem', bgcolor: 'notice.info.bg', color: 'notice.info.fg' }} />
          )}
          {handover && viewerAcknowledged && (
            <Chip label="You acknowledged this" size="small"
              sx={{ height: 17, fontSize: '0.58rem', bgcolor: 'notice.success.bg', color: 'notice.success.fg' }} />
          )}
        </Stack>

        {!handover && !composing && (
          <Typography variant="body2" color="text.secondary">No handover has been recorded for this shift.</Typography>
        )}

        {handover && (
          <Stack spacing={0.75}>
            <Typography variant="body2">{handover.what_happened}</Typography>
            {handover.outstanding && (
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'notice.warning.fg' }}>Outstanding</Typography>
                <Typography variant="body2">{handover.outstanding}</Typography>
              </Box>
            )}
            {handover.who_is_aware && (
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>Who is aware</Typography>
                <Typography variant="body2">{handover.who_is_aware}</Typography>
              </Box>
            )}
            <Typography variant="caption" color="text.secondary">
              {handover.author_name} · {fmtDateTime(handover.updated_at || handover.recorded_at)}
            </Typography>

            {(handover.acknowledgements || []).length > 0 ? (
              <Stack spacing={0.25}>
                {(handover.acknowledgements || []).map((ack: any) => (
                  <Stack key={ack.id} direction="row" spacing={0.5} alignItems="center">
                    <CheckIcon sx={{ fontSize: 14, color: 'notice.success.fg' }} />
                    <Typography variant="caption" color="text.secondary">
                      Acknowledged by {ack.acknowledged_by_name} · {fmtDateTime(ack.acknowledged_at)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Typography variant="caption" color="text.secondary">Nobody has acknowledged this yet.</Typography>
            )}

            {revisions.length > 1 && (
              <Box>
                <Button size="small" startIcon={<HistoryIcon />} sx={{ fontSize: '0.68rem', textTransform: 'none', minWidth: 0 }}
                  onClick={() => setShowHistory((open) => !open)}>
                  {showHistory ? 'Hide earlier versions' : `Show ${revisions.length - 1} earlier ${revisions.length - 1 === 1 ? 'version' : 'versions'}`}
                </Button>
                {showHistory && (
                  <Stack spacing={0.75} sx={{ mt: 0.5, p: 1, borderRadius: 1, bgcolor: 'notice.subtle.bg' }}>
                    {revisions.slice(1).map((revision: any) => (
                      <Box key={revision.id}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                          Version {revision.version} · {revision.author_name} · {fmtDateTime(revision.recorded_at)}
                        </Typography>
                        <Typography variant="body2">{revision.what_happened}</Typography>
                        {revision.outstanding && <Typography variant="caption" color="text.secondary">Outstanding: {revision.outstanding}</Typography>}
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
            )}

            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {!amAuthor && !viewerAcknowledged && (
                <Button size="small" variant="contained" startIcon={<CheckIcon />} onClick={acknowledge} disabled={busy !== ''}>
                  {busy === 'acknowledge' ? <CircularProgress size={14} sx={{ color: 'white' }} /> : 'Acknowledge'}
                </Button>
              )}
              {canWriteHandover && (
                <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => {
                  setForm({
                    what_happened: handover.what_happened || '',
                    outstanding: handover.outstanding || '',
                    who_is_aware: handover.who_is_aware || '',
                  })
                  setComposing(true)
                }} disabled={busy !== ''}>
                  Amend
                </Button>
              )}
            </Stack>
          </Stack>
        )}

        {!handover && canWriteHandover && !composing && (
          <Button size="small" variant="outlined" sx={{ mt: 1 }}
            onClick={() => { setForm({ what_happened: '', outstanding: '', who_is_aware: '' }); setComposing(true) }}>
            Record handover
          </Button>
        )}

        {composing && (
          <Stack spacing={1} sx={{ mt: 1 }}>
            <TextField size="small" multiline minRows={3} label="What happened during the shift" required
              value={form.what_happened} onChange={(e) => setForm((f) => ({ ...f, what_happened: e.target.value }))} />
            <TextField size="small" multiline minRows={2} label="Outstanding (optional)"
              value={form.outstanding} onChange={(e) => setForm((f) => ({ ...f, outstanding: e.target.value }))} />
            <TextField size="small" label="Who is aware (optional)"
              value={form.who_is_aware} onChange={(e) => setForm((f) => ({ ...f, who_is_aware: e.target.value }))} />
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="contained" onClick={submitHandover} disabled={busy !== ''}>
                {busy === 'handover' ? <CircularProgress size={14} sx={{ color: 'white' }} /> : 'Save handover'}
              </Button>
              <Button size="small" onClick={() => setComposing(false)} disabled={busy !== ''}>Cancel</Button>
            </Stack>
          </Stack>
        )}
      </Box>

      {notice && (
        <Typography variant="caption" sx={{ color: 'notice.warning.fg', fontWeight: 600 }}>{notice}</Typography>
      )}
      {error && (
        <Typography variant="caption" sx={{ color: 'notice.error.fg', fontWeight: 600 }}>{error}</Typography>
      )}
    </Stack>
  )
}
