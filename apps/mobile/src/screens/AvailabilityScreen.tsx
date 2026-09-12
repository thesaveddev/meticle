import { useCallback, useEffect, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, elevation, radii, spacing, type, FONT, useAppColors } from '../theme'
import { dyn } from '../utils/dynamicStyles'
import { PrimaryButton } from '../components/PrimaryButton'
import type { AuthSession, AvailabilityRecord } from '../types'
import { getMyAvailability, addAvailability, deleteAvailability } from '../services/api'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function AvailabilityScreen({ session }: { session: AuthSession }) {
  const c = useAppColors()
  const [records, setRecords] = useState<AvailabilityRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [selectedDay, setSelectedDay] = useState(1)
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('17:00')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [refreshing, setRefreshing] = useState(false)
  const load = useCallback(async () => {
    try {
      const data = await getMyAvailability(session.accessToken)
      setRecords(data)
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false) }
  }, [session.accessToken])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    setAdding(true); setError(''); setSuccess('')
    try {
      await addAvailability(session.accessToken, selectedDay, start, end)
      setSuccess('Availability saved')
      await load()
    } catch (e: any) { setError(e.message || 'Could not save') }
    finally { setAdding(false) }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteAvailability(session.accessToken, id)
      await load()
    } catch { /* ignore */ }
  }

  const byDay: Record<number, AvailabilityRecord[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
  for (const rec of records) {
    byDay[rec.day_of_week] = byDay[rec.day_of_week] || []
    byDay[rec.day_of_week].push(rec)
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={c.primary} />}>
        <Text style={styles.pageTitle}>My Availability</Text>
        <Text style={styles.subtitle}>Set the days and times you're available for calls.</Text>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorIcon}>!</Text>
            <Text style={styles.errorMsg}>{error}</Text>
          </View>
        ) : null}
        {success ? (
          <View style={styles.successBanner}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successMsg}>{success}</Text>
          </View>
        ) : null}

        {/* Weekly grid */}
        <View style={styles.weekCard}>
          {FULL_DAYS.map((dayName, dayIndex) => (
            <View key={dayIndex} style={[styles.dayRow, dayIndex < 6 && styles.dayRowBorder]}>
              <Text style={[styles.dayLabel, byDay[dayIndex]?.length > 0 && styles.dayLabelActive]}>
                {dayName.slice(0, 3)}
              </Text>
              <View style={styles.daySlots}>
                {(!byDay[dayIndex] || byDay[dayIndex].length === 0) ? (
                  <Text style={styles.noSlots}>—</Text>
                ) : (
                  byDay[dayIndex].map(rec => (
                    <Pressable
                      key={rec.id}
                      onLongPress={() => handleDelete(rec.id)}
                      style={styles.slotChip}
                    >
                      <Text style={styles.slotText}>{rec.start_time} – {rec.end_time}</Text>
                      <Text style={styles.slotHint}>hold to remove</Text>
                    </Pressable>
                  ))
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Add form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Add availability</Text>

          <View style={styles.dayPicker}>
            {DAYS.map((d, i) => (
              <Pressable
                key={i}
                onPress={() => setSelectedDay(i)}
                style={[styles.dayBtn, selectedDay === i && styles.dayBtnActive]}
              >
                <Text style={[styles.dayBtnText, selectedDay === i && styles.dayBtnTextActive]}>{d}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <Text style={styles.fieldLabel}>From</Text>
              <TextInput
                value={start}
                onChangeText={setStart}
                placeholder="09:00"
                placeholderTextColor={colors.subtle}
                style={styles.input}
              />
            </View>
            <View style={styles.timeField}>
              <Text style={styles.fieldLabel}>To</Text>
              <TextInput
                value={end}
                onChangeText={setEnd}
                placeholder="17:00"
                placeholderTextColor={colors.subtle}
                style={styles.input}
              />
            </View>
          </View>

          <PrimaryButton
            label={adding ? 'Saving...' : 'Save availability'}
            onPress={handleAdd}
            loading={adding}
            disabled={adding}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.base, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  pageTitle: { ...type.title, marginBottom: spacing.xs },
  subtitle: { ...type.body, color: colors.muted, marginBottom: spacing.base },

  /* Messages */
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.dangerSurface, padding: spacing.md, borderRadius: radii.md, marginBottom: spacing.base },
  errorIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.danger, color: colors.inverse, textAlign: 'center', lineHeight: 22, fontSize: 13, fontWeight: '700' },
  errorMsg: { ...type.small, color: colors.dangerDeep, flex: 1 },
  successBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.successSurface, padding: spacing.md, borderRadius: radii.md, marginBottom: spacing.base },
  successIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.success, color: colors.inverse, textAlign: 'center', lineHeight: 22, fontSize: 13, fontWeight: '700' },
  successMsg: { ...type.small, color: colors.successDeep, flex: 1 },

  /* Week card */
  weekCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    marginBottom: spacing.base,
    ...elevation.sm,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
  },
  dayRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  dayLabel: { width: 48, fontFamily: 'System', fontSize: 13, fontWeight: '600', color: colors.muted },
  dayLabelActive: { color: colors.successDeep },
  daySlots: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  noSlots: { ...type.small, color: colors.subtle },
  slotChip: {
    backgroundColor: colors.successSurface,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderWidth: 1,
    borderColor: colors.success + '20',
  },
  slotText: { fontFamily: 'System', fontSize: 13, fontWeight: '600', color: colors.successDeep },
  slotHint: { fontFamily: 'System', fontSize: 9, color: colors.muted, marginTop: 1 },

  /* Form */
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.base,
    gap: spacing.base,
    ...elevation.sm,
  },
  formTitle: { ...type.bodyBold },
  dayPicker: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  dayBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  dayBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayBtnText: { fontFamily: 'System', fontSize: 12, fontWeight: '600', color: colors.muted },
  dayBtnTextActive: { color: colors.inverse },
  timeRow: { flexDirection: 'row', gap: spacing.base },
  timeField: { flex: 1 },
  fieldLabel: { fontFamily: 'System', fontSize: 12, fontWeight: '600', color: colors.inkLight, marginBottom: spacing.xs },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.ink,
    fontFamily: 'System',
    fontSize: 15,
  },
})
