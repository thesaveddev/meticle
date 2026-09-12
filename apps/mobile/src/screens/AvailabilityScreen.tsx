import { useEffect, useState } from 'react'
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { colors, commonStyles, radii, spacing, type } from '../theme'
import { PrimaryButton } from '../components/PrimaryButton'
import type { AuthSession, AvailabilityRecord } from '../types'
import { getMyAvailability, addAvailability, deleteAvailability } from '../services/api'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function AvailabilityScreen({ session }: { session: AuthSession }) {
  const [records, setRecords] = useState<AvailabilityRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [selectedDay, setSelectedDay] = useState(1)
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('17:00')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = async () => {
    try {
      const data = await getMyAvailability(session.accessToken)
      setRecords(data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

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

  // Group by day
  const byDay: Record<number, AvailabilityRecord[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
  for (const rec of records) { byDay[rec.day_of_week] = byDay[rec.day_of_week] || []; byDay[rec.day_of_week].push(rec) }

  return (
    <SafeAreaView style={commonStyles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={type.title}>My Availability</Text>
        <Text style={styles.subtitle}>Set the days and times you are available for care calls.</Text>

        {error ? <View style={[styles.alert, styles.alertError]}><Text style={styles.alertText}>{error}</Text></View> : null}
        {success ? <View style={[styles.alert, styles.alertSuccess]}><Text style={styles.alertTextSuccess}>{success}</Text></View> : null}

        {/* Weekly grid */}
        {FULL_DAYS.map((dayName, dayIndex) => (
          <View key={dayIndex} style={styles.dayRow}>
            <Text style={[styles.dayLabel, byDay[dayIndex]?.length > 0 && styles.dayLabelActive]}>{dayName}</Text>
            <View style={styles.daySlots}>
              {(!byDay[dayIndex] || byDay[dayIndex].length === 0) ? (
                <Text style={styles.noSlots}>No availability</Text>
              ) : (
                byDay[dayIndex].map(rec => (
                  <Pressable key={rec.id} onLongPress={() => handleDelete(rec.id)} style={styles.slotChip}>
                    <Text style={styles.slotText}>{rec.start_time} - {rec.end_time}</Text>
                    <Text style={styles.slotDelete}>hold to remove</Text>
                  </Pressable>
                ))
              )}
            </View>
          </View>
        ))}

        {/* Add form */}
        <View style={styles.addForm}>
          <Text style={styles.addTitle}>Add availability</Text>
          <View style={styles.dayPicker}>
            {DAYS.map((d, i) => (
              <Pressable key={i} onPress={() => setSelectedDay(i)} style={[styles.dayBtn, selectedDay === i && styles.dayBtnActive]}>
                <Text style={[styles.dayBtnText, selectedDay === i && styles.dayBtnTextActive]}>{d}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <Text style={styles.fieldLabel}>From</Text>
              <TextInput value={start} onChangeText={setStart} placeholder="09:00" placeholderTextColor={colors.mist} style={commonStyles.field} />
            </View>
            <View style={styles.timeField}>
              <Text style={styles.fieldLabel}>To</Text>
              <TextInput value={end} onChangeText={setEnd} placeholder="17:00" placeholderTextColor={colors.mist} style={commonStyles.field} />
            </View>
          </View>
          <PrimaryButton label={adding ? 'Saving...' : 'Save availability'} onPress={handleAdd} loading={adding} disabled={adding} />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  content: { ...commonStyles.content, paddingTop: spacing.lg },
  subtitle: { ...type.body, color: colors.mist, marginTop: spacing.xs, marginBottom: spacing.lg },
  alert: { marginBottom: spacing.md, padding: spacing.sm, borderRadius: radii.sm },
  alertError: { backgroundColor: colors.errorSoft },
  alertSuccess: { backgroundColor: colors.successSoft },
  alertText: { ...type.caption, color: colors.error },
  alertTextSuccess: { ...type.caption, color: colors.emeraldDeep },
  dayRow: { flexDirection: 'row', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  dayLabel: { width: 70, ...type.bodyStrong, color: colors.mist },
  dayLabelActive: { color: colors.emeraldDeep },
  daySlots: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  noSlots: { ...type.caption, color: colors.mist, paddingVertical: 4 },
  slotChip: { backgroundColor: colors.successSoft, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  slotText: { ...type.label, color: colors.emeraldDeep, fontSize: 12 },
  slotDelete: { ...type.caption, color: colors.mist, fontSize: 10 },
  addForm: { marginTop: spacing.xl, padding: spacing.md, backgroundColor: colors.paper, borderRadius: radii.md, borderWidth: 1, borderColor: colors.hairline },
  addTitle: { ...type.bodyStrong, marginBottom: spacing.md },
  dayPicker: { flexDirection: 'row', gap: 4, marginBottom: spacing.md, flexWrap: 'wrap' },
  dayBtn: { paddingHorizontal: spacing.sm, paddingVertical: 8, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.hairline },
  dayBtnActive: { backgroundColor: colors.emeraldDeep, borderColor: colors.emeraldDeep },
  dayBtnText: { ...type.label, color: colors.mist },
  dayBtnTextActive: { color: colors.white },
  timeRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  timeField: { flex: 1 },
  fieldLabel: { ...type.label, color: colors.ink, marginBottom: spacing.xs },
})
