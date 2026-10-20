import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme, spacing, FONT } from '../theme'
import type { AuthSession } from '../types'
import { createRoomCheck, getRoomCheckBoard, type RoomCheckBoard, type RoomCheckBoardRoom } from '../services/api'
import { hapticLight, hapticSuccess } from '../services/haptics'

/**
 * Room checks, on the phone: the rooms that should have a check tonight, and the one
 * screen a support worker needs to clear them from the doorway.
 *
 * The overdue sweep tells the staff rostered at a location that "12 at Ash Grove has
 * no room check recorded today". Until this screen that message was a reminder to do
 * something later on a computer, which is the wrong shape for a residential shift: the
 * person reading it is often standing in the corridor, and the check is a two-minute
 * observation they could make now.
 *
 * Three things the screen is careful about:
 *
 *  * **The list is the sweep's list.** It comes from `GET /mobile/room-checks/today`,
 *    which derives rooms from the residents' own room numbers with the same normalised
 *    key and the same due hour the nudge used. A room cannot be overdue in one place
 *    and checked in the other.
 *  * **Checked rooms stay visible.** The board shows the day's check where there is
 *    one, so the worker can see what has already been done this shift rather than
 *    working against a list that silently empties.
 *  * **A failed save says so, in the sheet.** The sheet stays open with the reason and
 *    the answers still on it, because a check that vanished on a flaky signal would be
 *    recorded nowhere and believed everywhere.
 */

type Props = {
  session?: AuthSession
  onBack: () => void
  /** Called after a check is recorded, so wherever the worker came from can reload. */
  onChanged?: () => void
}

type CheckStatus = 'pass' | 'fail' | 'needs_attention'

const STATUS_LABEL: Record<CheckStatus, string> = {
  pass: 'Checked and fine',
  needs_attention: 'Needs attention',
  fail: 'Not safe',
}

const EMERALD = '#10B981'
const AMBER = '#F59E0B'
const RED = '#EF4444'

const statusColor = (status: string | null) => {
  if (status === 'fail') return RED
  if (status === 'needs_attention') return AMBER
  return EMERALD
}

/** `HH:MM` on the device's clock — what a person would write in the log book. */
function clockTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function RoomChecksScreen({ session, onBack, onChanged }: Props) {
  const { colors: c } = useTheme()
  const token = session?.accessToken || ''
  const [board, setBoard] = useState<RoomCheckBoard | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')

  // The sheet: which room, and the answers being written.
  const [room, setRoom] = useState<RoomCheckBoardRoom | null>(null)
  const [status, setStatus] = useState<CheckStatus>('pass')
  const [cleanliness, setCleanliness] = useState(0)
  const [safety, setSafety] = useState(0)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const load = useCallback(async () => {
    if (!token) return
    try {
      const next = await getRoomCheckBoard(token)
      setBoard(next)
      setLoadError('')
    } catch (err) {
      // A screen that shows nothing has to say why: an empty board and an unreachable
      // server look identical otherwise, and the worker concludes there is nothing to do.
      setLoadError(err instanceof Error ? err.message : 'Could not load room checks')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const openSheet = (target: RoomCheckBoardRoom) => {
    hapticLight()
    setRoom(target)
    setStatus('pass')
    setCleanliness(0)
    setSafety(0)
    setNotes('')
    setSaveError('')
  }

  const closeSheet = () => {
    if (saving) return
    setRoom(null)
    setSaveError('')
  }

  const save = async () => {
    if (!room || saving) return
    setSaving(true)
    setSaveError('')
    try {
      await createRoomCheck(token, {
        room_number: room.room_number,
        location_id: room.location_id,
        status,
        cleanliness_rating: cleanliness || undefined,
        safety_rating: safety || undefined,
        notes: notes.trim() || undefined,
      })
      hapticSuccess()
      const number = room.room_number
      setRoom(null)
      setNotice(`Room ${number} checked.`)
      await load()
      onChanged?.()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save the check')
    } finally {
      setSaving(false)
    }
  }

  const summary = useMemo(() => {
    if (!board) return ''
    const total = board.rooms.length
    const done = total - board.outstanding
    return `${done} of ${total} checked today`
  }, [board])

  const renderRoom = ({ item }: { item: RoomCheckBoardRoom }) => {
    const checked = !!item.checked_at
    return (
      <Pressable
        onPress={() => openSheet(item)}
        accessibilityRole="button"
        accessibilityLabel={checked
          ? `Room ${item.room_number} at ${item.location_name}, checked at ${clockTime(item.checked_at!)} by ${item.checked_by_name || 'a colleague'}`
          : `Room ${item.room_number} at ${item.location_name}, not checked today. Record a check`}
        testID={`room-check-${item.room_key}`}
        style={({ pressed }) => [styles.card, {
          backgroundColor: c.surface,
          borderColor: checked ? c.borderLight : AMBER + '55',
          borderLeftColor: checked ? statusColor(item.status) : AMBER,
          opacity: pressed ? 0.85 : 1,
        }]}
      >
        <View style={[styles.roomBadge, { backgroundColor: checked ? statusColor(item.status) + '18' : AMBER + '18' }]}>
          <Text style={[styles.roomNumber, { color: checked ? statusColor(item.status) : AMBER }]} numberOfLines={1}>
            {item.room_number}
          </Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: c.ink }]} numberOfLines={1}>
            Room {item.room_number}
          </Text>
          <Text style={[styles.cardMeta, { color: c.muted }]} numberOfLines={1}>{item.location_name}</Text>
          <Text style={[styles.cardState, { color: checked ? c.muted : AMBER }]} numberOfLines={1}>
            {checked
              ? `Checked ${clockTime(item.checked_at!)}${item.checked_by_name ? ` · ${item.checked_by_name}` : ''}`
              : 'Not checked today'}
          </Text>
        </View>
        <Ionicons
          name={checked ? 'checkmark-circle' : 'add-circle'}
          size={26}
          color={checked ? statusColor(item.status) : AMBER}
        />
      </Pressable>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.borderLight }]}>
        <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={c.ink} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: c.ink }]}>Room checks</Text>
          {board?.applicable && board.outstanding > 0 && (
            <Text testID="room-check-outstanding" style={[styles.headerBadge, { backgroundColor: AMBER }]}>
              {board.outstanding}
            </Text>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={c.primary} />
          <Text style={[styles.centeredText, { color: c.muted }]}>Loading today's rooms...</Text>
        </View>
      ) : !board ? (
        // A failed load is not "this provider has no rooms": saying so would tell the
        // worker their building has nothing to check when the truth is the phone could
        // not reach the server, and the overdue room would stay unchecked.
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={48} color={c.borderLight} />
          <Text style={[styles.emptyTitle, { color: c.ink }]}>Could not load room checks</Text>
          <Text testID="room-check-error" style={[styles.centeredText, { color: c.muted }]}>
            {loadError || 'The board did not come back from the server.'}
          </Text>
          <Pressable onPress={() => { setLoading(true); load() }} accessibilityRole="button" testID="room-check-retry">
            <Text style={[styles.retry, { color: c.primary }]}>Try again</Text>
          </Pressable>
        </View>
      ) : !board.applicable ? (
        <View style={styles.centered}>
          <Ionicons name="bed-outline" size={48} color={c.borderLight} />
          <Text style={[styles.emptyTitle, { color: c.ink }]}>Room checks are for residential care</Text>
          <Text style={[styles.centeredText, { color: c.muted }]}>
            This provider does not have rooms to check. Nothing to do here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={board.rooms}
          keyExtractor={(item) => item.room_key}
          renderItem={renderRoom}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load() }}
              tintColor="transparent"
            />
          }
          ListHeaderComponent={(
            <View style={styles.headerBlock}>
              <Text style={[styles.summary, { color: c.ink }]}>{summary}</Text>
              <Text style={[styles.summaryMeta, { color: board.outstanding > 0 && board.due ? AMBER : c.muted }]}>
                {board.outstanding === 0
                  ? 'Every room has a check for today.'
                  : board.due
                    ? `Due by ${String(board.due_hour).padStart(2, '0')}:00 — overdue since then.`
                    : `Due by ${String(board.due_hour).padStart(2, '0')}:00 today.`}
              </Text>
              {notice ? (
                <Text testID="room-check-notice" style={[styles.notice, { color: c.primary, backgroundColor: c.primarySurface }]}>
                  {notice}
                </Text>
              ) : null}
              {loadError ? (
                <Pressable onPress={load} accessibilityRole="button" testID="room-check-retry">
                  <Text style={[styles.error, { color: RED }]}>{loadError} Tap to try again.</Text>
                </Pressable>
              ) : null}
            </View>
          )}
          ListEmptyComponent={(
            <View style={styles.centered}>
              <Ionicons name="bed-outline" size={48} color={c.borderLight} />
              <Text style={[styles.emptyTitle, { color: c.ink }]}>No rooms to check</Text>
              <Text style={[styles.centeredText, { color: c.muted }]}>
                No resident at your location has a room number recorded, so there is nothing
                for this screen to ask you to check.
              </Text>
            </View>
          )}
        />
      )}

      <Modal
        visible={!!room}
        transparent
        animationType="slide"
        onRequestClose={closeSheet}
      >
        <View style={styles.sheetBackdrop}>
          <View style={[styles.sheet, { backgroundColor: c.surface }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: c.ink }]}>
                Room {room?.room_number}
              </Text>
              <Pressable onPress={closeSheet} style={styles.sheetClose} accessibilityRole="button" accessibilityLabel="Close" testID="room-check-close">
                <Ionicons name="close" size={22} color={c.muted} />
              </Pressable>
            </View>
            <Text style={[styles.sheetMeta, { color: c.muted }]}>
              {room?.location_name}
              {room?.checked_at ? ` · already checked at ${clockTime(room.checked_at)}` : ''}
            </Text>

            <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled">
              <Text style={[styles.fieldLabel, { color: c.ink }]}>What did you find?</Text>
              <View style={styles.statusRow}>
                {(Object.keys(STATUS_LABEL) as CheckStatus[]).map(option => {
                  const selected = status === option
                  return (
                    <Pressable
                      key={option}
                      onPress={() => { hapticLight(); setStatus(option) }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={STATUS_LABEL[option]}
                      testID={`room-check-status-${option}`}
                      style={[styles.statusChip, {
                        borderColor: selected ? statusColor(option) : c.borderLight,
                        backgroundColor: selected ? statusColor(option) + '18' : 'transparent',
                      }]}
                    >
                      <Text style={[styles.statusChipText, { color: selected ? statusColor(option) : c.muted }]}>
                        {STATUS_LABEL[option]}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>

              <RatingRow label="Cleanliness" value={cleanliness} onChange={setCleanliness} colors={c} testID="cleanliness" />
              <RatingRow label="Safety" value={safety} onChange={setSafety} colors={c} testID="safety" />

              <Text style={[styles.fieldLabel, { color: c.ink }]}>Notes (optional)</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Something the next shift should know"
                placeholderTextColor={c.subtle}
                multiline
                maxLength={2000}
                style={[styles.notes, { color: c.ink, borderColor: c.borderLight, backgroundColor: c.bg }]}
                testID="room-check-notes"
              />

              {saveError ? (
                <Text testID="room-check-save-error" style={[styles.error, { color: RED }]}>{saveError}</Text>
              ) : null}
            </ScrollView>

            <Pressable
              onPress={save}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Record room check"
              testID="room-check-save"
              style={({ pressed }) => [styles.saveBtn, {
                backgroundColor: c.primary,
                opacity: saving || pressed ? 0.7 : 1,
              }]}
            >
              {saving ? (
                <ActivityIndicator color={c.inverse} />
              ) : (
                <Text style={[styles.saveText, { color: c.inverse }]}>
                  {room?.checked_at ? 'Record another check' : 'Record check'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  )
}

/** Five pressable dots: 1..5, and 0 means "not rated", which is a real answer. */
function RatingRow({
  label, value, onChange, colors, testID,
}: {
  label: string
  value: number
  onChange: (next: number) => void
  colors: any
  testID: string
}) {
  return (
    <View style={styles.ratingRow}>
      <Text style={[styles.fieldLabel, { color: colors.ink }]}>{label}</Text>
      <View style={styles.dots}>
        {[1, 2, 3, 4, 5].map(n => {
          const filled = value >= n
          return (
            <Pressable
              key={n}
              onPress={() => { hapticLight(); onChange(value === n ? 0 : n) }}
              accessibilityRole="button"
              accessibilityLabel={`${label} ${n} of 5`}
              accessibilityState={{ selected: filled }}
              testID={`${testID}-${n}`}
              hitSlop={6}
            >
              <Ionicons name={filled ? 'ellipse' : 'ellipse-outline'} size={22} color={filled ? colors.primary : colors.borderLight} />
            </Pressable>
          )
        })}
        <Text style={[styles.ratingValue, { color: colors.subtle }]}>{value ? `${value}/5` : 'not rated'}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: '700', fontFamily: FONT, letterSpacing: -0.3 },
  headerBadge: {
    fontSize: 11, fontFamily: 'Inter-Bold', color: '#FFFFFF',
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10, overflow: 'hidden',
  },
  list: { padding: 16, gap: 8 },
  headerBlock: { gap: 6, marginBottom: 8 },
  summary: { fontSize: 16, fontFamily: 'Inter-SemiBold' },
  summaryMeta: { fontSize: 13, fontFamily: FONT },
  notice: {
    marginTop: 6, fontSize: 13, fontFamily: 'Inter-Medium',
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, overflow: 'hidden',
  },
  error: { fontSize: 13, fontFamily: FONT, marginTop: 8 },
  retry: { fontSize: 14, fontFamily: 'Inter-SemiBold', marginTop: 4 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    borderRadius: 14, borderWidth: 1, borderLeftWidth: 4,
  },
  roomBadge: { width: 46, height: 46, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  roomNumber: { fontSize: 16, fontFamily: 'Inter-Bold' },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 15, fontFamily: 'Inter-SemiBold' },
  cardMeta: { fontSize: 12, fontFamily: FONT },
  cardState: { fontSize: 12, fontFamily: 'Inter-Medium', marginTop: 2 },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8, flexGrow: 1 },
  centeredText: { fontSize: 13, fontFamily: FONT, textAlign: 'center' },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter-SemiBold' },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(27,36,48,0.45)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '88%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 18, fontFamily: 'Inter-Bold' },
  sheetClose: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  sheetMeta: { fontSize: 13, fontFamily: FONT, marginTop: 2, marginBottom: 12 },
  sheetBody: { maxHeight: 380 },
  fieldLabel: { fontSize: 13, fontFamily: 'Inter-SemiBold', marginTop: 12, marginBottom: 8 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  statusChipText: { fontSize: 12, fontFamily: 'Inter-Medium' },
  ratingRow: { marginTop: 4 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingValue: { fontSize: 11, fontFamily: FONT, marginLeft: 4 },
  notes: {
    minHeight: 74, borderWidth: 1, borderRadius: 12, padding: 12,
    fontSize: 14, fontFamily: FONT, textAlignVertical: 'top',
  },
  saveBtn: { marginTop: 16, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 15, fontFamily: 'Inter-SemiBold' },
})
