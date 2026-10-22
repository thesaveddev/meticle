import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { elevation, radii, spacing, FONT, typography, useAppColors } from '../theme'
import { useDynamicStyles } from '../utils/patchStaticStyles'
import type {
  AuthSession, MyShift, QueuedShiftClockAction, RosteredShiftStaff, ShiftAttendance,
} from '../types'
import {
  ApiError,
  clockShift,
  getShift,
  getShiftAttendance,
  type ShiftSummary,
} from '../services/api'
import {
  flushShiftClockActions,
  newShiftActionKey,
  pendingShiftClockActions,
  queueShiftClockAction,
} from '../services/shiftClockQueue'
import { hapticLight, hapticSuccess, hapticWarning } from '../services/haptics'
import { PrimaryButton } from '../components/PrimaryButton'

/**
 * The supported-living shift, on the phone: clock on when you take the setting over,
 * clock off when you leave, and reach the handover from the same screen.
 *
 * Until this screen the app could write and acknowledge a handover but not record that
 * anybody had turned up for the shift it belongs to — the one thing the rota, overtime,
 * the 11-hour rest rule and an inspector's question all lean on (blueprint §9.1). The
 * API landed in October; the phone is where a support worker actually is at 07:58.
 *
 * Four decisions, each about the record rather than the layout:
 *
 *  * **The button is only offered to the worker on the shift.** The server refuses
 *    anyone else, and it marks the caller's own roster row, so the screen reads that
 *    row instead of guessing at who is signed in. A manager reads attendance; they do
 *    not clock people in.
 *  * **A press that cannot reach the server is kept on the phone**, with the key it was
 *    created with, and resent as the same action. The banner says so plainly, because
 *    a worker who believes they are on duty while the record says otherwise is the
 *    failure this exists to prevent.
 *  * **The worked time is what the server counted**, not a ticking stopwatch. An open
 *    interval is reported as an open interval: printing a duration for time that has
 *    not been evidenced would be a number that means nothing.
 *  * **The handover is one tap from here**, and the screen says whether it is due, so
 *    the end of the shift is a sequence — clock off, then write what happened — rather
 *    than two unrelated places in the app.
 */
interface Props {
  session: AuthSession
  shiftId: string
  /** The row from the schedule list, when the screen was opened from there. */
  shift?: MyShift | null
  onBack: () => void
  /** Lets the schedule list refresh its badges after a write. */
  onChanged?: () => void
  /** Opens the shift's handover, which this screen summarises. */
  onHandover?: (shiftId: string) => void
  /**
   * Opens the incident report form. A concern raised mid-shift — a fall, a
   * medication error, something that does not look right — should not wait
   * for a computer, and the shift screen is where a support worker is when
   * they see it (blueprint §9.5: the API has been open to reporters since
   * October 2026; this is the screen-side way in for shift-based rotas).
   */
  onReportIncident?: () => void
}

function clock(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function dayLabel(value: string) {
  return new Date(value).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

function stamp(value: string) {
  const date = new Date(value)
  return `${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} at ${clock(value)}`
}

function shiftTypeLabel(value: string) {
  return (value || 'shift').replace(/_/g, ' ').replace(/^\w/, character => character.toUpperCase())
}

/** Hours and minutes as a person would say them, or nothing when there is nothing. */
export function workedLabel(minutes: number): string {
  if (!minutes || minutes <= 0) return ''
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}m`
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

export function ShiftClockScreen({ session, shiftId, shift, onBack, onChanged, onHandover, onReportIncident }: Props) {
  const c = useAppColors()
  const s = useDynamicStyles(styles)
  const token = session.accessToken

  const [attendance, setAttendance] = useState<ShiftAttendance | null>(null)
  const [header, setHeader] = useState<MyShift | ShiftSummary | null>(shift ?? null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState<'clock-on' | 'clock-off' | 'sync' | ''>('')
  const [note, setNote] = useState('')
  const [queued, setQueued] = useState<QueuedShiftClockAction[]>([])

  const load = useCallback(async () => {
    setLoadError('')
    try {
      const [record, shiftHeader] = await Promise.all([
        getShiftAttendance(token, shiftId),
        // A notification or a cold start carries the id and nothing else; the row from
        // the schedule is only a shortcut.
        shift ? Promise.resolve(shift) : getShift(token, shiftId),
      ])
      setAttendance(record)
      setHeader(shiftHeader)
      setQueued(await pendingShiftClockActions(shiftId))
    } catch (error: any) {
      setLoadError(error?.message || 'Could not load this shift')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [shiftId, shift, token])

  useEffect(() => { load() }, [load])

  /**
   * Send anything the phone is still holding for this shift, then show the result.
   *
   * This runs when the screen opens because that is when the connection is most likely
   * back — the worker is looking at the shift again. A refusal is not a failure to
   * retry: the reload that follows is what the server actually recorded.
   */
  const sync = useCallback(async (announce: boolean) => {
    if (!token) return
    const waiting = await pendingShiftClockActions(shiftId)
    if (waiting.length === 0) return
    setBusy(current => (current === '' ? 'sync' : current))
    const result = await flushShiftClockActions(token, { shiftId })
    setQueued(await pendingShiftClockActions(shiftId))
    setBusy(current => (current === 'sync' ? '' : current))
    if (result.synced > 0) {
      setNotice(`${result.synced} saved ${result.synced === 1 ? 'action was' : 'actions were'} sent.`)
      await load()
      onChanged?.()
    } else if (announce && result.remaining > 0) {
      setActionError('Still no connection. The saved action stays on this phone.')
    } else if (result.refused > 0) {
      // The server would not accept it — most often because the interval it describes
      // is already closed. Saying so, and reloading, is more useful than silence.
      setActionError('A saved clock action could not be recorded. The record below is what the server has.')
      await load()
    }
  }, [load, onChanged, shiftId, token])

  useEffect(() => { sync(false) }, [sync])

  const myRow = useMemo(
    () => (attendance?.rostered || []).find((row: RosteredShiftStaff) => row.is_me) || null,
    [attendance],
  )

  const submitClock = async (action: 'clock-on' | 'clock-off') => {
    hapticWarning()
    setBusy(action)
    setActionError('')
    setNotice('')
    const payload = {
      action_key: newShiftActionKey(),
      recorded_at: new Date().toISOString(),
      note: note.trim() || null,
    }
    try {
      await clockShift(token, shiftId, action, payload)
      hapticSuccess()
      setNote('')
      setNotice(action === 'clock-on' ? 'You are on duty.' : 'You are clocked off.')
      await load()
      onChanged?.()
    } catch (error: any) {
      // No status at all, or a server-side failure, means the request did not change
      // the record: keep the press with its own key so the retry is the same action.
      const unreachable = !(error instanceof ApiError) || error.status >= 500
      if (unreachable) {
        setQueued(await queueShiftClockAction({ shiftId, action, payload }))
        setNotice('')
        setActionError('No connection. Saved on this phone — it will be sent when you are back online.')
      } else {
        setActionError(error?.message || 'Could not record that. Try again.')
        // A 409 means the record already says the opposite of what the screen showed —
        // somebody else's action landed, or this one was replayed. Show the truth.
        await load()
      }
    } finally {
      setBusy('')
    }
  }

  const headerRow = header as MyShift | null
  const handover = headerRow?.handover ?? null
  const handoverDue = headerRow?.handover_due === true
  const onDuty = myRow?.on_duty === true
  const clockedOff = !!myRow?.clocked_off_at && !onDuty
  const worked = workedLabel(myRow?.worked_minutes ?? 0)
  const canClock = !!myRow && !!attendance && attendance.status !== 'cancelled'

  if (loading) {
    return (
      <View style={[s.screen, { backgroundColor: c.bg }]}>
        <Header onBack={onBack} c={c} s={s} />
        <View style={s.centered}>
          <ActivityIndicator color={c.primary} />
          <Text style={[s.centeredText, { color: c.muted }]}>Loading this shift…</Text>
        </View>
      </View>
    )
  }

  if (loadError || !attendance) {
    return (
      <View style={[s.screen, { backgroundColor: c.bg }]}>
        <Header onBack={onBack} c={c} s={s} />
        <View style={s.centered}>
          <Ionicons name="cloud-offline-outline" size={44} color={c.borderLight} />
          <Text style={[s.errorTitle, { color: c.ink }]}>Could not load this shift</Text>
          <Text style={[s.centeredText, { color: c.muted }]}>
            {loadError || 'The shift did not come back from the server. Check your connection and try again.'}
          </Text>
          <PrimaryButton label="Try again" size="small" onPress={() => { setLoading(true); load() }} />
        </View>
      </View>
    )
  }

  return (
    <View style={[s.screen, { backgroundColor: c.bg }]}>
      <Header onBack={onBack} c={c} s={s} />
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load() }}
            tintColor="transparent"
            colors={['transparent']}
          />
        )}
      >
        {/* Where and when */}
        <View style={[s.card, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
          <View style={s.cardTitleRow}>
            <Text style={[s.cardTitle, { color: c.ink }]} numberOfLines={2}>
              {attendance.location_name || header?.location_name || 'Shift'}
            </Text>
            <View style={[s.chip, { backgroundColor: onDuty ? c.successSurface : clockedOff ? c.surfaceAlt : c.warningSurface }]}>
              <Text style={[s.chipText, { color: onDuty ? c.successDeep : clockedOff ? c.muted : c.warning }]}>
                {onDuty ? 'On duty' : clockedOff ? 'Clocked off' : 'Not clocked on'}
              </Text>
            </View>
          </View>
          <Text style={[s.cardMeta, { color: c.muted }]}>
            {`${shiftTypeLabel(attendance.shift_type)} · ${dayLabel(attendance.start_time)}`}
          </Text>
          <Text style={[s.cardMeta, { color: c.subtle }]}>
            {`${clock(attendance.start_time)}–${clock(attendance.end_time)}`}
          </Text>
        </View>

        {notice ? (
          <View style={[s.banner, { backgroundColor: c.successSurface, borderColor: c.success + '40' }]}>
            <Text testID="shift-clock-notice" style={[s.bannerText, { color: c.successDeep }]}>{notice}</Text>
          </View>
        ) : null}

        {actionError ? (
          <View style={[s.banner, { backgroundColor: c.dangerSurface, borderColor: c.danger + '40' }]}>
            <Text testID="shift-clock-error" style={[s.bannerText, { color: c.danger }]}>{actionError}</Text>
          </View>
        ) : null}

        {queued.length > 0 ? (
          <View style={[s.banner, s.queueBanner, { backgroundColor: c.warningSurface, borderColor: c.warning + '40' }]}>
            <Ionicons name="cloud-offline-outline" size={16} color={c.warning} />
            <Text style={[s.bannerText, s.queueText, { color: c.warning }]}>
              {queued.length === 1
                ? '1 clock action is saved on this phone and has not been sent.'
                : `${queued.length} clock actions are saved on this phone and have not been sent.`}
            </Text>
            <Pressable
              onPress={() => { hapticLight(); sync(true) }}
              disabled={busy !== ''}
              accessibilityRole="button"
              accessibilityLabel="Send the saved clock actions now"
              testID="shift-clock-retry"
            >
              <Text style={[s.queueAction, { color: c.warning }]}>{busy === 'sync' ? 'Sending…' : 'Try now'}</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Your attendance: the one thing this screen is for. */}
        <View style={[s.card, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
          <Text style={[s.label, { color: c.subtle }]}>Your attendance</Text>

          {!myRow ? (
            <>
              <Text style={[s.sectionTitle, { color: c.ink }]}>You are not rostered on this shift</Text>
              <Text style={[s.body, { color: c.muted }]}>
                Only the staff assigned to a shift can clock on or off it. The people who are on it are listed below.
              </Text>
            </>
          ) : onDuty ? (
            <>
              <Text testID="shift-clock-state" style={[s.stateLine, { color: c.successDeep }]}>
                {`On duty since ${clock(myRow.clocked_on_at)}`}
              </Text>
              {worked ? (
                <Text style={[s.body, { color: c.muted }]}>{`Completed so far: ${worked}`}</Text>
              ) : null}
              <Text style={[s.helper, { color: c.muted }]}>
                Clock off when you leave the setting. The next worker reads your handover before they take over.
              </Text>
            </>
          ) : clockedOff ? (
            <>
              <Text testID="shift-clock-state" style={[s.stateLine, { color: c.ink }]}>
                {`Clocked off at ${clock(myRow.clocked_off_at)}`}
              </Text>
              <Text style={[s.body, { color: c.muted }]}>
                {worked ? `Worked ${worked}.` : 'No worked time was recorded for this interval.'}
              </Text>
            </>
          ) : (
            <>
              <Text testID="shift-clock-state" style={[s.stateLine, { color: c.ink }]}>Not clocked on yet</Text>
              <Text style={[s.body, { color: c.muted }]}>
                Clock on when you arrive so the rota records that the setting was covered.
              </Text>
            </>
          )}

          {canClock ? (
            <>
              <Text style={[s.fieldLabel, { color: c.muted }]}>
                {onDuty ? 'Note for the record (optional)' : 'Anything to note? (optional)'}
              </Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder={onDuty ? 'Keys handed to the evening worker, for example.' : 'Arrived to a quiet house, for example.'}
                placeholderTextColor={c.subtle}
                maxLength={5000}
                accessibilityLabel="Note for the clock record"
                style={[s.input, { color: c.ink, borderColor: c.border, backgroundColor: c.bg }]}
              />

              <View style={s.action}>
                {onDuty ? (
                  <PrimaryButton
                    label="Clock off"
                    tone="danger"
                    loading={busy === 'clock-off'}
                    disabled={busy !== ''}
                    onPress={() => submitClock('clock-off')}
                  />
                ) : (
                  <PrimaryButton
                    label={clockedOff ? 'Clock on again' : 'Clock on'}
                    tone="success"
                    loading={busy === 'clock-on'}
                    disabled={busy !== ''}
                    onPress={() => submitClock('clock-on')}
                  />
                )}
              </View>
              {clockedOff ? (
                <Text style={[s.helper, { color: c.muted }]}>
                  Clock on again only if you are going back on duty. An earlier interval stays in the record.
                </Text>
              ) : null}
            </>
          ) : null}

          <View style={[s.divider, { backgroundColor: c.borderLight }]} />

          <Text style={[s.label, { color: c.subtle }]}>On this shift</Text>
          {attendance.rostered.length === 0 ? (
            <Text style={[s.body, { color: c.muted }]}>No staff are rostered on this shift.</Text>
          ) : (
            attendance.rostered.map(row => (
              <View key={row.staff_id} style={s.rosterRow}>
                <View style={s.rosterWho}>
                  <Text style={[s.rosterName, { color: c.ink }]} numberOfLines={1}>
                    {`${row.first_name} ${row.last_name}${row.is_me ? ' (you)' : ''}`}
                  </Text>
                  {row.is_overtime ? (
                    <View style={[s.chip, { backgroundColor: c.warningSurface }]}>
                      <Text style={[s.chipText, { color: c.warning }]}>OT</Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  style={[s.rosterState, { color: row.on_duty ? c.successDeep : c.muted }]}
                  numberOfLines={2}
                >
                  {row.clocked_on_at
                    ? `${clock(row.clocked_on_at)}${row.clocked_off_at ? `–${clock(row.clocked_off_at)}` : '–now'}${workedLabel(row.worked_minutes) ? ` · ${workedLabel(row.worked_minutes)}` : ''}`
                    : row.assignment_status === 'pending' ? 'Claim not approved' : 'No record'}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* The handover the shift owes, and the way to it. */}
        <View style={[s.card, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
          <View style={s.cardTitleRow}>
            <Text style={[s.sectionTitle, { color: c.ink, marginTop: 0 }]}>Shift handover</Text>
            {handoverDue && !handover ? (
              <View style={[s.chip, { backgroundColor: c.dangerSurface }]}>
                <Text style={[s.chipText, { color: c.danger }]}>Handover due</Text>
              </View>
            ) : null}
          </View>

          {handover ? (
            <>
              <Text style={[s.label, { color: c.subtle }]}>
                {`v${handover.version} · ${handover.author_name} · ${stamp(handover.recorded_at)}`}
              </Text>
              <Text style={[s.body, { color: c.ink }]} numberOfLines={3}>{handover.what_happened}</Text>
              <Text style={[s.helper, { color: handover.acknowledgement_count > 0 ? c.successDeep : c.warning }]}>
                {handover.viewer_acknowledged
                  ? 'You have read this.'
                  : handover.acknowledgement_count > 0
                    ? `Read by ${handover.acknowledgement_count} ${handover.acknowledgement_count === 1 ? 'person' : 'people'}.`
                    : 'Nobody has read this yet.'}
              </Text>
            </>
          ) : (
            <Text style={[s.body, { color: c.muted }]}>
              {handoverDue
                ? 'This shift has ended and no handover has been recorded. Write what happened so the next worker takes over knowing it.'
                : 'No handover yet. Write what happened, what is still outstanding and who knows about it.'}
            </Text>
          )}

          {onHandover ? (
            <View style={s.action}>
              <PrimaryButton
                label={handover ? 'Open the handover' : 'Write the handover'}
                tone="outline"
                disabled={busy !== ''}
                onPress={() => { hapticLight(); onHandover(shiftId) }}
              />
            </View>
          ) : null}
        </View>

        {/* A concern seen on shift should not wait for a computer. */}
        {onReportIncident ? (
          <View style={[s.card, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
            <Text style={[s.sectionTitle, { color: c.ink, marginTop: 0 }]}>Safety</Text>
            <Text style={[s.body, { color: c.muted }]}>
              Seen a fall, a medication error or something that does not look right? File it now — it reaches the office as an incident report.
            </Text>
            <View style={s.action}>
              <PrimaryButton
                label="Report an incident"
                tone="danger"
                disabled={busy !== ''}
                onPress={() => { hapticLight(); onReportIncident() }}
              />
            </View>
          </View>
        ) : null}

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </View>
  )
}

function Header({ onBack, c, s }: { onBack: () => void; c: any; s: any }) {
  return (
    <View style={[s.header, { backgroundColor: c.surface, borderBottomColor: c.borderLight }]}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={s.backButton}>
        <Ionicons name="arrow-back" size={24} color={c.ink} />
      </Pressable>
      <Text style={[s.headerTitle, { color: c.ink }]}>This shift</Text>
      <View style={{ width: 40 }} />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.title, fontSize: 17 },
  content: { padding: spacing.base, gap: spacing.sm },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  centeredText: { fontFamily: FONT, fontSize: 13, textAlign: 'center' },
  errorTitle: { fontFamily: FONT, fontSize: 16, fontWeight: '700' },

  card: { borderRadius: radii.lg, borderWidth: 1, padding: spacing.base, gap: spacing.xs, ...elevation.sm },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardTitle: { flex: 1, fontFamily: FONT, fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  cardMeta: { fontFamily: FONT, fontSize: 13 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  chipText: { fontFamily: FONT, fontSize: 11, fontWeight: '700' },

  banner: { borderRadius: radii.md, borderWidth: 1, padding: spacing.sm },
  bannerText: { fontFamily: FONT, fontSize: 12, lineHeight: 17, fontWeight: '500' },
  queueBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  queueText: { flex: 1 },
  queueAction: { fontFamily: FONT, fontSize: 12, fontWeight: '700' },

  sectionTitle: { fontFamily: FONT, fontSize: 14, fontWeight: '700', marginTop: spacing.xs, marginBottom: 2 },
  stateLine: { fontFamily: FONT, fontSize: 19, fontWeight: '700', letterSpacing: -0.3, marginTop: 2 },
  label: { fontFamily: FONT, fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
  body: { fontFamily: FONT, fontSize: 14, lineHeight: 20 },
  helper: { fontFamily: FONT, fontSize: 12, lineHeight: 17, marginTop: spacing.xs },
  divider: { height: 1, marginVertical: spacing.sm },

  fieldLabel: { fontFamily: FONT, fontSize: 12, fontWeight: '600', marginTop: spacing.sm },
  input: {
    borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    fontFamily: FONT, fontSize: 14, minHeight: 44,
  },
  action: { marginTop: spacing.sm },

  rosterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 5 },
  rosterWho: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rosterName: { flexShrink: 1, fontFamily: FONT, fontSize: 13, fontWeight: '600' },
  rosterState: { fontFamily: FONT, fontSize: 12, textAlign: 'right' },
})
