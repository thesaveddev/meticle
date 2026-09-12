import { useEffect, useState } from 'react'
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, elevation, radii, spacing, type, FONT, useAppColors } from '../theme'
import { useDynamicStyles } from '../utils/patchStaticStyles'
import { dyn } from '../utils/dynamicStyles'
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
  const c = useAppColors()
  const s = useDynamicStyles(styles)
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
    <SafeAreaView style={[s.screen, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={onBack} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
          <Text style={s.backText}>Back</Text>
        </Pressable>
        <Text style={s.title}>Nutrition</Text>
        <Text style={s.subtitle}>{personName}</Text>

        {/* Fluid tracker */}
        <View style={s.fluidCard}>
          <View style={s.fluidHeader}>
            <Text style={s.fluidTitle}>💧 Fluid intake today</Text>
            <Text style={s.fluidValue}>{fluidSoFar}ml / {fluidTarget}ml</Text>
          </View>
          <View style={s.fluidBar}>
            <View style={[s.fluidFill, { width: `${fluidPercent}%`, backgroundColor: fluidPercent >= 80 ? colors.success : colors.warning }]} />
          </View>
          <Text style={s.fluidPercent}>{fluidPercent}% of target</Text>
        </View>

        {/* Dietary flags */}
        {allergyFlags.length > 0 && (
          <View style={s.flagsCard}>
            <Text style={s.flagsTitle}>Dietary requirements</Text>
            <View style={s.flagsRow}>
              {allergyFlags.map((flag, i) => (
                <View key={i} style={s.flagChip}>
                  <Text style={s.flagText}>{flag}</Text>
                </View>
              ))}
            </View>
            {profile?.texture_modified && (
              <Text style={s.flagNote}>Texture: {profile.texture_modified}</Text>
            )}
            {profile?.other_allergies && (
              <Text style={s.flagNote}>Other: {profile.other_allergies}</Text>
            )}
          </View>
        )}

        {/* Today's meals */}
        <Text style={s.sectionHead}>TODAY'S MEALS ({meals.length})</Text>
        {meals.length > 0 ? (
          meals.map(meal => {
            const mt = MEAL_TYPES.find(m => m.key === meal.meal_type)
            return (
              <View key={meal.id} style={s.mealCard}>
                <View style={s.mealHeader}>
                  <Text style={s.mealIcon}>{mt?.icon || '🍽️'}</Text>
                  <View style={s.mealInfo}>
                    <Text style={s.mealType}>{mt?.label || meal.meal_type}</Text>
                    <Text style={s.mealTime}>{meal.meal_time || '—'} · {meal.consumed_percent != null ? `${meal.consumed_percent}% consumed` : meal.refused ? 'Refused' : '—'}</Text>
                  </View>
                  {meal.appetite_level && (
                    <View style={[s.appetiteBadge, { backgroundColor: APPETITE_LEVELS.find(a => a.key === meal.appetite_level)?.color + '18' }]}>
                      <Text style={[s.appetiteText, { color: APPETITE_LEVELS.find(a => a.key === meal.appetite_level)?.color }]}>
                        {meal.appetite_level}
                      </Text>
                    </View>
                  )}
                </View>
                {meal.amount_consumed && <Text style={s.mealDetail}>Consumed: {meal.amount_consumed}</Text>}
                {meal.fluid_ml != null && meal.fluid_ml > 0 && <Text style={s.mealDetail}>Fluid: {meal.fluid_ml}ml</Text>}
                {meal.refused && <Text style={s.mealRefused}>⚠ Refused{meal.refusal_reason ? `: ${meal.refusal_reason}` : ''}</Text>}
                {meal.notes && <Text style={s.mealNotes}>{meal.notes}</Text>}
              </View>
            )
          })
        ) : (
          <View style={s.emptyCard}>
            <Text style={s.emptyTitle}>No meals recorded today</Text>
            <Text style={s.emptyCopy}>Tap the button below to log a meal.</Text>
          </View>
        )}

        <PrimaryButton label="Log a meal" onPress={() => setAddOpen(true)} tone="primary" />

        {/* Profile info */}
        {profile && (
          <View style={s.profileCard}>
            <Text style={s.profileTitle}>Dietary profile</Text>
            {profile.dietary_type && <Text style={s.profileRow}>Type: {profile.dietary_type}</Text>}
            {profile.appetite_level && <Text style={s.profileRow}>Appetite: {profile.appetite_level}</Text>}
            {profile.eating_abilities && <Text style={s.profileRow}>Abilities: {profile.eating_abilities}</Text>}
            {profile.food_preferences && <Text style={s.profileRow}>Preferences: {profile.food_preferences}</Text>}
            {profile.food_dislikes && <Text style={s.profileRow}>Dislikes: {profile.food_dislikes}</Text>}
            {profile.additional_notes && <Text style={s.profileRow}>Notes: {profile.additional_notes}</Text>}
          </View>
        )}
      </ScrollView>

      {/* Add meal modal */}
      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modal}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.modalTitle}>Log a meal</Text>

              <Text style={s.fieldLabel}>Meal type</Text>
              <View style={s.chipRow}>
                {MEAL_TYPES.map(mt => (
                  <Pressable key={mt.key} onPress={() => setMealType(mt.key)} style={[s.chip, mealType === mt.key && s.chipActive]}>
                    <Text style={[s.chipText, mealType === mt.key && s.chipTextActive]}>{mt.icon} {mt.label}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={s.fieldLabel}>Appetite</Text>
              <View style={s.chipRow}>
                {APPETITE_LEVELS.map(a => (
                  <Pressable key={a.key} onPress={() => setAppetite(a.key)} style={[s.chip, appetite === a.key && { backgroundColor: a.color, borderColor: a.color }]}>
                    <Text style={[s.chipText, appetite === a.key && { color: colors.inverse }]}>{a.label}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={s.fieldRow}>
                <View style={s.fieldHalf}>
                  <Text style={s.fieldLabel}>Consumed %</Text>
                  <TextInput value={consumedPercent} onChangeText={setConsumedPercent} keyboardType="number-pad" placeholder="80" placeholderTextColor={colors.subtle} style={s.input} />
                </View>
                <View style={s.fieldHalf}>
                  <Text style={s.fieldLabel}>Fluid (ml)</Text>
                  <TextInput value={fluidMl} onChangeText={setFluidMl} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.subtle} style={s.input} />
                </View>
              </View>

              <Text style={s.fieldLabel}>Amount consumed (description)</Text>
              <TextInput value={amountConsumed} onChangeText={setAmountConsumed} placeholder="e.g. Half a plate" placeholderTextColor={colors.subtle} style={s.input} />

              <Text style={s.fieldLabel}>Notes</Text>
              <TextInput multiline value={notes} onChangeText={setNotes} placeholder="Any observations..." placeholderTextColor={colors.subtle} style={[s.input, s.textArea]} />

              <Pressable onPress={() => setRefused(!refused)} style={s.checkboxRow}>
                <View style={[s.checkbox, refused && s.checkboxChecked]}>
                  {refused && <Text style={s.checkmark}>✓</Text>}
                </View>
                <Text style={s.checkboxLabel}>Meal refused</Text>
              </Pressable>

              {refused && (
                <>
                  <Text style={s.fieldLabel}>Reason for refusal</Text>
                  <TextInput value={refusalReason} onChangeText={setRefusalReason} placeholder="Why refused?" placeholderTextColor={colors.subtle} style={s.input} />
                </>
              )}

              <PrimaryButton label="Save meal" onPress={handleSave} loading={saving} disabled={saving} />
              <Pressable onPress={() => setAddOpen(false)} style={s.cancelBtn}>
                <Text style={s.cancelText}>Cancel</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
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
