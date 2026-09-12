import { useEffect, useState } from 'react'
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, elevation, radii, spacing, type } from '../theme'
import type { AuthSession, DietaryProfile, MealRecord } from '../types'
import { getDietaryProfile, getMealRecords, getDailySummary, createMealRecord } from '../services/api'
import { PrimaryButton } from '../components/PrimaryButton'

const MEAL_TYPES = [
  { key: 'breakfast', label: 'Breakfast', icon: '🌅' },
  { key: 'morning_snack', label: 'AM Snack', icon: '🍎' },
  { key: 'lunch', label: 'Lunch', icon: '🍽️' },
  { key: 'afternoon_snack', label: 'PM Snack', icon: '🧁' },
  { key: 'dinner', label: 'Dinner', icon: '🌙' },
  { key: 'evening_snack', label: 'Evening', icon: '🍵' },
  { key: 'supplement', label: 'Supplement', icon: '💊' },
] as const

const APPETITE_LEVELS = [
  { key: 'poor', label: 'Poor', color: '#DC2626' },
  { key: 'fair', label: 'Fair', color: '#D97706' },
  { key: 'good', label: 'Good', color: '#16A34A' },
  { key: 'excellent', label: 'Excellent', color: '#059669' },
] as const

const FLUID_PRESETS = [0, 50, 100, 150, 200, 250, 300, 500]

interface Props {
  personId: string
  personName: string
  session: AuthSession
  onBack: () => void
}

export function NutritionScreen({ personId, personName, session, onBack }: Props) {
  const [profile, setProfile] = useState<DietaryProfile | null>(null)
  const [meals, setMeals] = useState<MealRecord[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [mealType, setMealType] = useState('lunch')
  const [appetite, setAppetite] = useState('good')
  const [amountConsumed, setAmountConsumed] = useState('')
  const [consumedPercent, setConsumedPercent] = useState('80')
  const [fluidMl, setFluidMl] = useState('')
  const [notes, setNotes] = useState('')
  const [refused, setRefused] = useState(false)
  const [refusalReason, setRefusalReason] = useState('')
  const [saving, setSaving] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const load = async () => {
    try {
      const [p, m, s] = await Promise.all([
        getDietaryProfile(session.accessToken, personId).catch(() => null),
        getMealRecords(session.accessToken, personId, today, today).catch(() => []),
        getDailySummary(session.accessToken, personId).catch(() => null),
      ])
      setProfile(p)
      setMeals(m)
      setSummary(s)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await createMealRecord(session.accessToken, personId, {
        meal_type: mealType,
        meal_time: new Date().toTimeString().slice(0, 5),
        appetite_level: appetite,
        amount_consumed: amountConsumed.trim() || undefined,
        consumed_percent: consumedPercent ? Number(consumedPercent) : undefined,
        fluid_ml: fluidMl ? Number(fluidMl) : undefined,
        notes: notes.trim() || undefined,
        refused,
        refusal_reason: refused ? refusalReason.trim() || undefined : undefined,
      })
      setAddOpen(false)
      resetForm()
      await load()
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setMealType('lunch')
    setAppetite('good')
    setAmountConsumed('')
    setConsumedPercent('80')
    setFluidMl('')
    setNotes('')
    setRefused(false)
    setRefusalReason('')
  }

  const fluidTarget = profile?.fluid_daily_target_ml || 2000
  const fluidSoFar = meals.reduce((s, m) => s + (m.fluid_ml || 0), 0)
  const fluidPercent = Math.min(100, Math.round((fluidSoFar / fluidTarget) * 100))

  const allergyFlags = profile ? [
    profile.vegetarian && 'Vegetarian',
    profile.vegan && 'Vegan',
    profile.gluten_free && 'Gluten free',
    profile.dairy_free && 'Dairy free',
    profile.nut_allergy && 'Nut allergy',
    profile.halal && 'Halal',
    profile.kosher && 'Kosher',
  ].filter(Boolean) : []

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Nutrition</Text>
        <Text style={styles.subtitle}>{personName}</Text>

        {/* Fluid tracker */}
        <View style={styles.fluidCard}>
          <View style={styles.fluidHeader}>
            <Text style={styles.fluidTitle}>💧 Fluid intake today</Text>
            <Text style={styles.fluidValue}>{fluidSoFar}ml / {fluidTarget}ml</Text>
          </View>
          <View style={styles.fluidBar}>
            <View style={[styles.fluidFill, { width: `${fluidPercent}%`, backgroundColor: fluidPercent >= 80 ? colors.success : colors.warning }]} />
          </View>
          <Text style={styles.fluidPercent}>{fluidPercent}% of target</Text>
        </View>

        {/* Dietary flags */}
        {allergyFlags.length > 0 && (
          <View style={styles.flagsCard}>
            <Text style={styles.flagsTitle}>Dietary requirements</Text>
            <View style={styles.flagsRow}>
              {allergyFlags.map((flag, i) => (
                <View key={i} style={styles.flagChip}>
                  <Text style={styles.flagText}>{flag}</Text>
                </View>
              ))}
            </View>
            {profile?.texture_modified && (
              <Text style={styles.flagNote}>Texture: {profile.texture_modified}</Text>
            )}
            {profile?.other_allergies && (
              <Text style={styles.flagNote}>Other: {profile.other_allergies}</Text>
            )}
          </View>
        )}

        {/* Today's meals */}
        <Text style={styles.sectionHead}>TODAY'S MEALS ({meals.length})</Text>
        {meals.length > 0 ? (
          meals.map(meal => {
            const mt = MEAL_TYPES.find(m => m.key === meal.meal_type)
            return (
              <View key={meal.id} style={styles.mealCard}>
                <View style={styles.mealHeader}>
                  <Text style={styles.mealIcon}>{mt?.icon || '🍽️'}</Text>
                  <View style={styles.mealInfo}>
                    <Text style={styles.mealType}>{mt?.label || meal.meal_type}</Text>
                    <Text style={styles.mealTime}>{meal.meal_time || '—'} · {meal.consumed_percent != null ? `${meal.consumed_percent}% consumed` : meal.refused ? 'Refused' : '—'}</Text>
                  </View>
                  {meal.appetite_level && (
                    <View style={[styles.appetiteBadge, { backgroundColor: APPETITE_LEVELS.find(a => a.key === meal.appetite_level)?.color + '18' }]}>
                      <Text style={[styles.appetiteText, { color: APPETITE_LEVELS.find(a => a.key === meal.appetite_level)?.color }]}>
                        {meal.appetite_level}
                      </Text>
                    </View>
                  )}
                </View>
                {meal.amount_consumed && <Text style={styles.mealDetail}>Consumed: {meal.amount_consumed}</Text>}
                {meal.fluid_ml != null && meal.fluid_ml > 0 && <Text style={styles.mealDetail}>Fluid: {meal.fluid_ml}ml</Text>}
                {meal.refused && <Text style={styles.mealRefused}>⚠ Refused{meal.refusal_reason ? `: ${meal.refusal_reason}` : ''}</Text>}
                {meal.notes && <Text style={styles.mealNotes}>{meal.notes}</Text>}
              </View>
            )
          })
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No meals recorded today</Text>
            <Text style={styles.emptyCopy}>Tap the button below to log a meal.</Text>
          </View>
        )}

        <PrimaryButton label="Log a meal" onPress={() => setAddOpen(true)} tone="primary" />

        {/* Profile info */}
        {profile && (
          <View style={styles.profileCard}>
            <Text style={styles.profileTitle}>Dietary profile</Text>
            {profile.dietary_type && <Text style={styles.profileRow}>Type: {profile.dietary_type}</Text>}
            {profile.appetite_level && <Text style={styles.profileRow}>Appetite: {profile.appetite_level}</Text>}
            {profile.eating_abilities && <Text style={styles.profileRow}>Abilities: {profile.eating_abilities}</Text>}
            {profile.food_preferences && <Text style={styles.profileRow}>Preferences: {profile.food_preferences}</Text>}
            {profile.food_dislikes && <Text style={styles.profileRow}>Dislikes: {profile.food_dislikes}</Text>}
            {profile.additional_notes && <Text style={styles.profileRow}>Notes: {profile.additional_notes}</Text>}
          </View>
        )}
      </ScrollView>

      {/* Add meal modal */}
      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Log a meal</Text>

              <Text style={styles.fieldLabel}>Meal type</Text>
              <View style={styles.chipRow}>
                {MEAL_TYPES.map(mt => (
                  <Pressable key={mt.key} onPress={() => setMealType(mt.key)} style={[styles.chip, mealType === mt.key && styles.chipActive]}>
                    <Text style={[styles.chipText, mealType === mt.key && styles.chipTextActive]}>{mt.icon} {mt.label}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Appetite</Text>
              <View style={styles.chipRow}>
                {APPETITE_LEVELS.map(a => (
                  <Pressable key={a.key} onPress={() => setAppetite(a.key)} style={[styles.chip, appetite === a.key && { backgroundColor: a.color, borderColor: a.color }]}>
                    <Text style={[styles.chipText, appetite === a.key && { color: colors.inverse }]}>{a.label}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>Consumed %</Text>
                  <TextInput value={consumedPercent} onChangeText={setConsumedPercent} keyboardType="number-pad" placeholder="80" placeholderTextColor={colors.subtle} style={styles.input} />
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>Fluid (ml)</Text>
                  <TextInput value={fluidMl} onChangeText={setFluidMl} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.subtle} style={styles.input} />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Amount consumed (description)</Text>
              <TextInput value={amountConsumed} onChangeText={setAmountConsumed} placeholder="e.g. Half a plate" placeholderTextColor={colors.subtle} style={styles.input} />

              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput multiline value={notes} onChangeText={setNotes} placeholder="Any observations..." placeholderTextColor={colors.subtle} style={[styles.input, styles.textArea]} />

              <Pressable onPress={() => setRefused(!refused)} style={styles.checkboxRow}>
                <View style={[styles.checkbox, refused && styles.checkboxChecked]}>
                  {refused && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>Meal refused</Text>
              </Pressable>

              {refused && (
                <>
                  <Text style={styles.fieldLabel}>Reason for refusal</Text>
                  <TextInput value={refusalReason} onChangeText={setRefusalReason} placeholder="Why refused?" placeholderTextColor={colors.subtle} style={styles.input} />
                </>
              )}

              <PrimaryButton label="Save meal" onPress={handleSave} loading={saving} disabled={saving} />
              <Pressable onPress={() => setAddOpen(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.base, paddingTop: spacing.md, paddingBottom: spacing.xxxl, gap: spacing.base },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  backArrow: { fontFamily: 'System', fontSize: 18, color: colors.primary, fontWeight: '600' },
  backText: { fontFamily: 'System', fontSize: 15, fontWeight: '500', color: colors.primary },
  title: { ...type.title, marginBottom: spacing.xs },
  subtitle: { ...type.body, color: colors.muted },

  /* Fluid */
  fluidCard: { backgroundColor: colors.primarySurface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.primary + '15', padding: spacing.base, ...elevation.sm },
  fluidHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  fluidTitle: { ...type.bodyBold, color: colors.primary },
  fluidValue: { fontFamily: 'System', fontSize: 14, fontWeight: '700', color: colors.primary },
  fluidBar: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  fluidFill: { height: '100%', borderRadius: 4 },
  fluidPercent: { ...type.small, marginTop: spacing.xs, textAlign: 'right' },

  /* Flags */
  flagsCard: { backgroundColor: colors.warningSurface, borderRadius: radii.lg, borderWidth: 1, borderColor: '#FDE68A', padding: spacing.base },
  flagsTitle: { fontFamily: 'System', fontSize: 14, fontWeight: '700', color: '#92400E', marginBottom: spacing.sm },
  flagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  flagChip: { backgroundColor: '#FEF3C7', borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderWidth: 1, borderColor: '#FDE68A' },
  flagText: { fontFamily: 'System', fontSize: 12, fontWeight: '600', color: '#92400E' },
  flagNote: { ...type.small, color: '#78350F', marginTop: spacing.sm },

  /* Section */
  sectionHead: { fontFamily: 'System', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: colors.subtle },

  /* Meals */
  mealCard: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.borderLight, padding: spacing.base, ...elevation.sm },
  mealHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  mealIcon: { fontSize: 24 },
  mealInfo: { flex: 1 },
  mealType: { ...type.bodyBold, fontSize: 15 },
  mealTime: { ...type.small, marginTop: 1 },
  appetiteBadge: { paddingHorizontal: spacing.md, paddingVertical: 3, borderRadius: radii.full },
  appetiteText: { fontFamily: 'System', fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  mealDetail: { ...type.small, marginTop: spacing.sm },
  mealRefused: { ...type.small, color: colors.danger, marginTop: spacing.sm, fontWeight: '600' },
  mealNotes: { ...type.small, marginTop: spacing.xs, fontStyle: 'italic' },

  /* Empty */
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyTitle: { ...type.bodyBold, marginBottom: spacing.xs },
  emptyCopy: { ...type.small, textAlign: 'center' },

  /* Profile */
  profileCard: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.borderLight, padding: spacing.base, ...elevation.sm },
  profileTitle: { ...type.bodyBold, marginBottom: spacing.sm },
  profileRow: { ...type.small, paddingVertical: spacing.xs },

  /* Modal */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(28,25,23,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.bg, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing.xl, maxHeight: '85%', ...elevation.lg },
  modalTitle: { ...type.title, marginBottom: spacing.base },
  fieldLabel: { fontFamily: 'System', fontSize: 12, fontWeight: '600', color: colors.inkLight, marginTop: spacing.base, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.sm, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: 'System', fontSize: 12, fontWeight: '600', color: colors.muted },
  chipTextActive: { color: colors.inverse },
  fieldRow: { flexDirection: 'row', gap: spacing.base },
  fieldHalf: { flex: 1 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surface, paddingHorizontal: spacing.base, paddingVertical: spacing.md, color: colors.ink, fontFamily: 'System', fontSize: 15 },
  textArea: { minHeight: 80, textAlignVertical: 'top', paddingTop: spacing.md },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.base },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.danger, borderColor: colors.danger },
  checkmark: { fontFamily: 'System', fontSize: 14, fontWeight: '700', color: colors.inverse },
  checkboxLabel: { ...type.body, fontSize: 14 },
  cancelBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  cancelText: { fontFamily: 'System', fontSize: 15, fontWeight: '600', color: colors.primary },
})
