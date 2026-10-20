import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { elevation, radii, spacing, FONT, typography, useAppColors } from '../theme'
import { useDynamicStyles } from '../utils/patchStaticStyles'
import type { AuthSession, MyShift, ShiftHandoverView, ShiftHandoverRevision } from '../types'
import {
  ApiError,
  acknowledgeShiftHandover,
  getShift,
  getShiftHandover,
  recordShiftHandover,
  type ShiftSummary,
} from '../services/api'
import { clearHandoverDraft, readHandoverDraft, writeHandoverDraft } from '../services/storage'
import { hapticLight, hapticWarning } from '../services/haptics'
import { PrimaryButton } from '../components/PrimaryButton'

/**
 * The supported-living shift handover, on the phone (blueprint §7 / §9.2).
 *
 * The defining artefact of supported living is the transfer of responsibility at
 * the end of a shift, and until this screen existed the only place a worker could
 * write one was the web rota's shift dialog — which is exactly where they are not
 * standing when the shift ends.
 *
 * Four decisions, each of them about the record rather than the layout:
 *
 *  * **Amending keeps the old wording.** The API stores every version; this screen
 *    shows the history rather than only the current text, because an amendment that
 *    hides what a colleague already read is not a record.
 *  * **The author is never offered acknowledgement.** The server refuses it with a
 *    400, and a button that exists only to be refused is worse than no button; the
 *    author sees who has read it instead.
 *  * **A handover that cannot reach the server is kept on the phone.** End of a
 *    night shift is when signal is worst, and losing the paragraph a carer just
 *    composed is the failure that makes them stop bothering. The draft comes back
 *    with the screen and is sent when they say so — never silently in the
 *    background, because the wording is theirs and they should see it land.
 *  * **Nothing is written until it says what happened.** The server requires it; the
 *    screen says so before the round trip.
 */
interface Props {
  session: AuthSession
  shiftId: string
  /** The row from the schedule list, when the screen was opened from there. */
  shift?: MyShift | null
  onBack: () => void
  /** Lets the schedule list refresh its badges after a write. */
  onChanged?: () => void
}

function clock(value: string) {
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

export function HandoverScreen({ session, shiftId, shift, onBack, onChanged }: Props) {
  const c = useAppColors()
  const s = useDynamicStyles(styles)
  const token = session.accessToken

  const [view, setView] = useState<ShiftHandoverView | null>(null)
  const [header, setHeader] = useState<MyShift | ShiftSummary | null>(shift ?? null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [saving, setSaving] = useState(false)
  const [acknowledging, setAcknowledging] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftRestored, setDraftRestored] = useState(false)
  const [savedOffline, setSavedOffline] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const [whatHappened, setWhatHappened] = useState('')
  const [outstanding, setOutstanding] = useState('')
  const [whoIsAware, setWhoIsAware] = useState('')

  const load = useCallback(async () => {
    setLoadError('')
    try {
      const [handoverView, shiftHeader] = await Promise.all([
        getShiftHandover(token, shiftId),
        // Only fetch the header when the caller did not already have the row: a
        // notification deep link carries the id and nothing else.
        shift ? Promise.resolve(shift) : getShift(token, shiftId),
      ])
      setView(handoverView)
      setHeader(shiftHeader)
      setEditing(!handoverView.handover)

      const handover = handoverView.handover
      setWhatHappened(handover?.what_happened ?? '')
      setOutstanding(handover?.outstanding ?? '')
      setWhoIsAware(handover?.who_is_aware ?? '')

      // A draft typed with no connection outranks the stored wording: it is what the
      // carer wrote and has not yet managed to send.
      const draft = await readHandoverDraft(shiftId)
      if (draft) {
        setWhatHappened(draft.whatHappened)
        setOutstanding(draft.outstanding)
        setWhoIsAware(draft.whoIsAware)
        setDraftRestored(true)
        setEditing(true)
      }
    } catch (error: any) {
      setLoadError(error?.message || 'Could not load this shift')
    } finally {
      setLoading(false)
    }
  }, [shiftId, shift, token])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    hapticWarning()
    setActionError('')
    const text = whatHappened.trim()
    if (!text) {
      setActionError('Say what happened during the shift before saving.')
      return
    }
    setSaving(true)
    try {
      await recordShiftHandover(token, shiftId, {
        what_happened: text,
        outstanding: outstanding.trim() || null,
        who_is_aware: whoIsAware.trim() || null,
      })
      await clearHandoverDraft(shiftId)
      setSavedOffline(false)
      setDraftRestored(false)
      setEditing(false)
      await load()
      onChanged?.()
    } catch (error: any) {
      // Distinguish "nobody could hear you" from "the server refused this". A
      // refused handover (403, validation) is shown; an unreachable one is kept.
      const unreachable = !(error instanceof ApiError) || error.status >= 500
      if (unreachable) {
        await writeHandoverDraft({
          shiftId,
          whatHappened: text,
          outstanding,
          whoIsAware,
          savedAt: new Date().toISOString(),
        })
        setSavedOffline(true)
      } else {
        setActionError(error.message || 'Could not save the handover')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleAcknowledge = () => {
    Alert.alert(
      'Acknowledge this handover',
      'This records that you have read it, under your name.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: "I've read it",
          onPress: async () => {
            hapticLight()
            setAcknowledging(true)
            setActionError('')
            try {
              await acknowledgeShiftHandover(token, shiftId)
              await load()
              onChanged?.()
            } catch (error: any) {
              setActionError(error?.message || 'Could not record the acknowledgement')
            } finally {
              setAcknowledging(false)
            }
          },
        },
      ],
    )
  }

  const handover = view?.handover ?? null
  const handoverDue = (header as MyShift | null)?.handover_due === true

  if (loading) {
    return (
      <View style={[s.screen, { backgroundColor: c.bg }]}>
        <Header onBack={onBack} c={c} s={s} />
        <View style={s.centered}>
          <ActivityIndicator color={c.primary} />
          <Text style={[s.centeredText, { color: c.muted }]}>Loading handover…</Text>
        </View>
      </View>
    )
  }

  if (loadError) {
    return (
      <View style={[s.screen, { backgroundColor: c.bg }]}>
        <Header onBack={onBack} c={c} s={s} />
        <View style={s.centered}>
          <Text style={[s.errorTitle, { color: c.ink }]}>Could not load the handover</Text>
          <Text style={[s.centeredText, { color: c.muted }]}>{loadError}</Text>
          <PrimaryButton label="Try again" size="small" onPress={() => { setLoading(true); load().finally(() => setLoading(false)) }} />
        </View>
      </View>
    )
  }

  return (
    <View style={[s.screen, { backgroundColor: c.bg }]}>
      <Header onBack={onBack} c={c} s={s} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {/* Where and when */}
        <View style={[s.card, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
          <View style={s.cardTitleRow}>
            <Text style={[s.cardTitle, { color: c.ink }]} numberOfLines={2}>
              {header?.location_name || 'Shift'}
            </Text>
            {handoverDue ? (
              <View style={[s.chip, { backgroundColor: c.dangerSurface }]}>
                <Text style={[s.chipText, { color: c.danger }]}>Handover due</Text>
              </View>
            ) : null}
          </View>
          <Text style={[s.cardMeta, { color: c.muted }]}>
            {header ? `${shiftTypeLabel(header.shift_type)} · ${dayLabel(header.start_time)}` : ''}
          </Text>
          {header ? (
            <Text style={[s.cardMeta, { color: c.subtle }]}>
              {clock(header.start_time)}–{clock(header.end_time)}
            </Text>
          ) : null}
        </View>

        {savedOffline ? (
          <View style={[s.banner, { backgroundColor: c.warningSurface, borderColor: c.warning + '40' }]}>
            <Text style={[s.bannerText, { color: c.warning }]}>
              Saved on this phone. It has not reached the server yet — press Save again when you have signal.
            </Text>
          </View>
        ) : draftRestored ? (
          <View style={[s.banner, { backgroundColor: c.primarySurface, borderColor: c.primary + '30' }]}>
            <Text style={[s.bannerText, { color: c.primary }]}>
              This is the handover you started on this phone. Send it when you are ready.
            </Text>
          </View>
        ) : null}

        {actionError ? (
          <View style={[s.banner, { backgroundColor: c.dangerSurface, borderColor: c.danger + '40' }]}>
            <Text style={[s.bannerText, { color: c.danger }]}>{actionError}</Text>
          </View>
        ) : null}

        {/* The current handover */}
        {handover ? (
          <View style={[s.card, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
            <Text style={[s.label, { color: c.subtle }]}>
              {`Version ${handover.version} · ${handover.author_name} · ${stamp(handover.recorded_at)}`}
            </Text>
            <Text style={[s.sectionTitle, { color: c.ink }]}>What happened</Text>
            <Text style={[s.body, { color: c.ink }]}>{handover.what_happened}</Text>

            {handover.outstanding ? (
              <>
                <Text style={[s.sectionTitle, { color: c.ink }]}>Outstanding</Text>
                <Text style={[s.body, { color: c.ink }]}>{handover.outstanding}</Text>
              </>
            ) : null}

            {handover.who_is_aware ? (
              <>
                <Text style={[s.sectionTitle, { color: c.ink }]}>Who is aware</Text>
                <Text style={[s.body, { color: c.ink }]}>{handover.who_is_aware}</Text>
              </>
            ) : null}

            {/* Read receipts are the evidence the transfer happened. */}
            <View style={[s.divider, { backgroundColor: c.borderLight }]} />
            <Text style={[s.label, { color: c.subtle }]}>
              {handover.acknowledgements.length === 0
                ? 'Nobody has read this yet'
                : `Read by ${handover.acknowledgements.length} ${handover.acknowledgements.length === 1 ? 'person' : 'people'}`}
            </Text>
            {handover.acknowledgements.map(acknowledgement => (
              <View key={acknowledgement.id} style={s.ackRow}>
                <Ionicons name="checkmark-circle" size={16} color={c.success} />
                <Text style={[s.ackText, { color: c.ink }]}>
                  {acknowledgement.acknowledged_by_name}
                  <Text style={{ color: c.subtle }}>{` · ${stamp(acknowledgement.acknowledged_at)}`}</Text>
                </Text>
              </View>
            ))}

            {view?.viewer_is_author ? (
              <Text style={[s.helper, { color: c.muted }]}>
                You wrote this handover, so somebody else has to acknowledge it — an acknowledgement by the author evidences nothing.
              </Text>
            ) : view?.viewer_acknowledged ? (
              <Text style={[s.helper, { color: c.success }]}>You have acknowledged this handover.</Text>
            ) : (
              <View style={s.ackButton}>
                <PrimaryButton
                  label="I have read this handover"
                  tone="outline"
                  loading={acknowledging}
                  onPress={handleAcknowledge}
                />
              </View>
            )}

            {!editing ? (
              <Pressable
                onPress={() => { hapticLight(); setEditing(true) }}
                accessibilityRole="button"
                accessibilityLabel="Amend this handover"
                style={({ pressed }) => [s.textButton, pressed && { opacity: 0.7 }]}
              >
                <Text style={[s.textButtonLabel, { color: c.primary }]}>Amend this handover</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={[s.card, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
            <Text style={[s.sectionTitle, { color: c.ink }]}>No handover recorded</Text>
            <Text style={[s.body, { color: c.muted }]}>
              This shift has no handover yet. Write what happened, what is still outstanding and who knows about it, so the next worker takes over knowing it.
            </Text>
          </View>
        )}

        {/* The form: always shown when there is nothing yet, otherwise on demand. */}
        {editing ? (
          <View style={[s.card, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
            <Text style={[s.sectionTitle, { color: c.ink }]}>
              {handover ? 'Amend the handover' : 'Write the handover'}
            </Text>
            <Text style={[s.fieldLabel, { color: c.muted }]}>What happened</Text>
            <TextInput
              value={whatHappened}
              onChangeText={setWhatHappened}
              placeholder="How the shift went, anything a colleague needs to know."
              placeholderTextColor={c.subtle}
              multiline
              maxLength={10000}
              accessibilityLabel="What happened during the shift"
              style={[s.input, s.inputTall, { color: c.ink, borderColor: c.border, backgroundColor: c.bg }]}
            />
            <Text style={[s.fieldLabel, { color: c.muted }]}>Outstanding</Text>
            <TextInput
              value={outstanding}
              onChangeText={setOutstanding}
              placeholder="Anything unfinished or due next."
              placeholderTextColor={c.subtle}
              multiline
              maxLength={10000}
              accessibilityLabel="What is outstanding"
              style={[s.input, { color: c.ink, borderColor: c.border, backgroundColor: c.bg }]}
            />
            <Text style={[s.fieldLabel, { color: c.muted }]}>Who is aware</Text>
            <TextInput
              value={whoIsAware}
              onChangeText={setWhoIsAware}
              placeholder="Who has been told, and about what."
              placeholderTextColor={c.subtle}
              maxLength={5000}
              accessibilityLabel="Who is aware"
              style={[s.input, { color: c.ink, borderColor: c.border, backgroundColor: c.bg }]}
            />

            <View style={s.formActions}>
              <PrimaryButton
                label={handover ? 'Save amendment' : 'Record handover'}
                loading={saving}
                disabled={saving || !whatHappened.trim()}
                onPress={handleSave}
              />
              {handover ? (
                <Pressable
                  onPress={() => {
                    hapticLight()
                    setEditing(false)
                    setActionError('')
                    setWhatHappened(handover.what_happened)
                    setOutstanding(handover.outstanding ?? '')
                    setWhoIsAware(handover.who_is_aware ?? '')
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel the amendment"
                  style={({ pressed }) => [s.textButton, pressed && { opacity: 0.7 }]}
                >
                  <Text style={[s.textButtonLabel, { color: c.muted }]}>Cancel</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* The wording a colleague already read must survive the amendment. */}
        {view && view.revisions.length > 1 ? (
          <View style={[s.card, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
            <Pressable
              onPress={() => { hapticLight(); setHistoryOpen(open => !open) }}
              accessibilityRole="button"
              accessibilityLabel={`Version history, ${view.revisions.length} versions`}
              style={({ pressed }) => [s.historyHeader, pressed && { opacity: 0.7 }]}
            >
              <Text style={[s.sectionTitle, { color: c.ink, marginBottom: 0 }]}>
                {`Version history (${view.revisions.length})`}
              </Text>
              <Ionicons name={historyOpen ? 'chevron-up' : 'chevron-down'} size={18} color={c.subtle} />
            </Pressable>
            {historyOpen ? view.revisions.map((revision: ShiftHandoverRevision) => (
              <View key={revision.id} style={[s.revision, { borderColor: c.borderLight }]}>
                <Text style={[s.label, { color: c.subtle }]}>
                  {`v${revision.version} · ${revision.author_name} · ${stamp(revision.recorded_at)}${revision.source === 'offline' ? ' · sent later' : ''}`}
                </Text>
                <Text style={[s.body, { color: c.ink }]}>{revision.what_happened}</Text>
              </View>
            )) : null}
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
      <Text style={[s.headerTitle, { color: c.ink }]}>Shift handover</Text>
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

  sectionTitle: { fontFamily: FONT, fontSize: 14, fontWeight: '700', marginTop: spacing.xs, marginBottom: 2 },
  label: { fontFamily: FONT, fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
  body: { fontFamily: FONT, fontSize: 14, lineHeight: 20 },
  helper: { fontFamily: FONT, fontSize: 12, lineHeight: 17, marginTop: spacing.xs },
  divider: { height: 1, marginVertical: spacing.sm },

  ackRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  ackText: { fontFamily: FONT, fontSize: 13, flex: 1 },
  ackButton: { marginTop: spacing.sm },

  fieldLabel: { fontFamily: FONT, fontSize: 12, fontWeight: '600', marginTop: spacing.sm },
  input: {
    borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    fontFamily: FONT, fontSize: 14, minHeight: 44, textAlignVertical: 'top',
  },
  inputTall: { minHeight: 110 },
  formActions: { marginTop: spacing.md, gap: spacing.xs },

  textButton: { paddingVertical: spacing.sm, alignItems: 'center', marginTop: spacing.xs },
  textButtonLabel: { fontFamily: FONT, fontSize: 13, fontWeight: '700' },

  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  revision: { borderTopWidth: 1, paddingTop: spacing.sm, marginTop: spacing.sm, gap: 2 },
})
