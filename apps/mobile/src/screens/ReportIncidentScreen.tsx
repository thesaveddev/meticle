import { useEffect, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, radii, spacing, typography, useAppColors } from '../theme'
import { useDynamicStyles } from '../utils/patchStaticStyles'
import type { AuthSession } from '../types'
import { PrimaryButton } from '../components/PrimaryButton'
import { hapticLight, hapticWarning } from '../services/haptics'
import { IconIncident } from '../components/Icons'
import { getIncidentCategories, type IncidentCategory } from '../services/api'
import { submitIncidentReport } from '../services/incidentQueue'
import type { IncidentSeverity } from '../types'

const SEVERITY_LEVELS = [
  { key: 'low', label: 'Low', color: '#10B981', desc: 'No harm or very minor' },
  { key: 'medium', label: 'Medium', color: '#F59E0B', desc: 'Required first aid' },
  { key: 'high', label: 'High', color: '#EF4444', desc: 'Hospital or emergency' },
  { key: 'critical', label: 'Critical', color: '#B42318', desc: 'Life-threatening' },
] as const

/** Pre-filled form state. Only the store-screenshot capture tour supplies this. */
export interface IncidentDraft {
  categoryId?: string
  severity?: string
  title?: string
  description?: string
  location?: string
  witnesses?: string
  isNearMiss?: boolean
}

interface Props {
  session: AuthSession
  visitId?: string
  personId?: string
  personName?: string
  onBack: () => void
  onSubmitted?: () => void
  initialDraft?: IncidentDraft
}

export function ReportIncidentScreen({ session, visitId, personId, personName, onBack, onSubmitted, initialDraft }: Props) {
  const c = useAppColors()
  const s = useDynamicStyles(styles)
  const [category, setCategory] = useState('')
  const [incidentCategories, setIncidentCategories] = useState<IncidentCategory[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoryLoadError, setCategoryLoadError] = useState(false)
  const [severity, setSeverity] = useState(initialDraft?.severity || 'medium')
  const [title, setTitle] = useState(initialDraft?.title || '')
  const [description, setDescription] = useState(initialDraft?.description || '')
  const [location, setLocation] = useState(initialDraft?.location || '')
  const [witnesses, setWitnesses] = useState(initialDraft?.witnesses || '')
  const [isNearMiss, setIsNearMiss] = useState(initialDraft?.isNearMiss || false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [savedOffline, setSavedOffline] = useState(false)

  useEffect(() => {
    let mounted = true
    getIncidentCategories(session.accessToken)
      .then(categories => {
        if (!mounted) return
        const activeCategories = categories.filter(item => item.is_active)
        setIncidentCategories(activeCategories)
        setCategory(current => {
          if (activeCategories.some(item => item.id === current)) return current
          const draftCategory = activeCategories.find(item => item.id === initialDraft?.categoryId)
          return draftCategory?.id || ''
        })
      })
      .catch(() => {
        if (!mounted) return
        setCategory('')
        setCategoryLoadError(true)
      })
      .finally(() => {
        if (mounted) setCategoriesLoading(false)
      })
    return () => { mounted = false }
  }, [session.accessToken, initialDraft?.categoryId])

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter an incident title')
      return
    }
    hapticWarning()
    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        witnesses: witnesses.trim() || undefined,
        category_id: category || undefined,
        severity: severity as IncidentSeverity,
        location: location.trim() || undefined,
        is_near_miss: isNearMiss,
        ...(personId ? { person_ids: [personId] } : {}),
        ...(visitId ? { visit_id: visitId } : {}),
        incident_date: new Date().toISOString().split('T')[0],
        incident_time: new Date().toTimeString().slice(0, 5),
      }
      const result = await submitIncidentReport(session.accessToken, session.user.id, session.user.organizationId || session.organization?.id || null, payload)
      setSavedOffline(result.queued)
      setSuccess(true)
      setTimeout(() => { onSubmitted?.(); onBack() }, 1500)
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not submit incident')
    } finally {
      setSaving(false)
    }
  }

  if (success) {
    return (
      <SafeAreaView style={[s.screen, { backgroundColor: c.bg }]}>
        <View style={s.successView}>
          <Text style={s.successIcon}>✓</Text>
          <Text style={s.successTitle}>{savedOffline ? 'Report saved on this device' : 'Incident reported'}</Text>
          <Text style={s.successDesc}>{savedOffline ? 'It will be sent securely when your connection returns. Keep this device signed in.' : 'Your report has been submitted to the office.'}</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[s.screen, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={onBack} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
          <Text style={s.backText}>Back</Text>
        </Pressable>
        <Text style={s.title}>Report an incident</Text>
        {personName && <Text style={s.subtitle}>Client: {personName}</Text>}

        {/* Near miss toggle */}
        <Pressable onPress={() => { hapticLight(); setIsNearMiss(!isNearMiss) }} style={s.nearMissRow}>
          <View style={[s.checkbox, isNearMiss && s.checkboxChecked]}>
            {isNearMiss && <Text style={s.checkmark}>✓</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.checkboxLabel}>This is a near miss</Text>
            <Text style={s.checkboxDesc}>No harm occurred but it could have</Text>
          </View>
        </Pressable>

        {/* Category */}
        <Text style={s.fieldLabel}>Category</Text>
        {categoriesLoading && <Text style={s.categoryMessage}>Categories may be unavailable offline; report without a category if needed.</Text>}
        {categoryLoadError && <Text accessibilityRole="alert" style={s.categoryMessage}>Categories could not be loaded. You can still submit without one.</Text>}
        {!categoriesLoading && !categoryLoadError && incidentCategories.length === 0 && <Text style={s.categoryMessage}>No incident categories are configured. You can still submit without one.</Text>}
        <View style={s.chipGrid}>
          {incidentCategories.map(cat => (
            <Pressable key={cat.id} onPress={() => { hapticLight(); setCategory(cat.id) }} style={[s.chip, category === cat.id && s.chipActive]}>
              <IconIncident size={14} color={category === cat.id ? c.inverse : c.primary} />
              <Text style={[s.chipText, category === cat.id && s.chipTextActive]}>{cat.name}</Text>
            </Pressable>
          ))}
        </View>

        {/* Severity */}
        <Text style={s.fieldLabel}>Severity</Text>
        <View style={s.severityRow}>
          {SEVERITY_LEVELS.map(sev => (
            <Pressable key={sev.key} onPress={() => { hapticLight(); setSeverity(sev.key) }} style={[s.severityBtn, severity === sev.key && { backgroundColor: sev.color, borderColor: sev.color }]}>
              <Text style={[s.severityLabel, severity === sev.key && { color: c.inverse }]}>{sev.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Title */}
        <View style={s.fieldGroup}>
          <Text style={s.fieldLabel}>Title *</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="Brief title of the incident" placeholderTextColor={colors.subtle} style={s.input} />
        </View>

        {/* Description */}
        <View style={s.fieldGroup}>
          <Text style={s.fieldLabel}>What happened?</Text>
          <TextInput multiline value={description} onChangeText={setDescription} placeholder="Describe what happened factually..." placeholderTextColor={colors.subtle} style={[s.input, s.textArea]} />
        </View>

        {/* Location */}
        <View style={s.fieldGroup}>
          <Text style={s.fieldLabel}>Location within the property</Text>
          <TextInput value={location} onChangeText={setLocation} placeholder="e.g. Bedroom, bathroom" placeholderTextColor={colors.subtle} style={s.input} />
        </View>

        {/* Witnesses */}
        <View style={s.fieldGroup}>
          <Text style={s.fieldLabel}>Witnesses (up to 2,000 characters)</Text>
          <TextInput value={witnesses} onChangeText={setWitnesses} placeholder="Names of any witnesses" placeholderTextColor={colors.subtle} style={s.input} maxLength={2000} />
        </View>

        <PrimaryButton label="Submit incident report" onPress={handleSave} loading={saving} disabled={saving} tone="danger" />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.base, paddingTop: spacing.md, paddingBottom: spacing.xxxl },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.base },
  backArrow: { fontFamily: 'System', fontSize: 18, color: colors.primary, fontWeight: '600' },
  backText: { fontFamily: 'System', fontSize: 15, fontWeight: '500', color: colors.primary },
  title: { ...typography.title, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.muted, marginBottom: spacing.base },

  /* Near miss */
  nearMissRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.warningSurface, borderRadius: radii.md, borderWidth: 1, borderColor: '#FFF7E6', padding: spacing.base, marginBottom: spacing.base },
  checkbox: { width: 24, height: 24, borderRadius: 4, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.warning, borderColor: colors.warning },
  checkmark: { fontFamily: 'System', fontSize: 14, fontWeight: '700', color: colors.inverse },
  checkboxLabel: { fontFamily: 'System', fontSize: 14, fontWeight: '700', color: '#9A6700' },
  checkboxDesc: { ...typography.small, color: '#9A6700', marginTop: 1 },

  /* Category chips */
  fieldLabel: { fontFamily: 'System', fontSize: 12, fontWeight: '600', color: colors.inkLight, marginTop: spacing.base, marginBottom: spacing.sm },
  categoryMessage: { ...typography.small, color: colors.muted, marginBottom: spacing.sm },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.sm, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipIcon: { fontSize: 14 },
  chipText: { fontFamily: 'System', fontSize: 12, fontWeight: '600', color: colors.muted },
  chipTextActive: { color: colors.inverse },

  /* Severity */
  severityRow: { flexDirection: 'row', gap: spacing.sm },
  severityBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center' },
  severityLabel: { fontFamily: 'System', fontSize: 13, fontWeight: '700', color: colors.muted },

  /* Form */
  fieldGroup: { gap: spacing.xs, marginTop: spacing.sm },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surface, paddingHorizontal: spacing.base, paddingVertical: spacing.md, color: colors.ink, fontFamily: 'System', fontSize: 15 },
  textArea: { minHeight: 100, textAlignVertical: 'top', paddingTop: spacing.md },

  /* Success */
  successView: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  successIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.success, color: colors.inverse, textAlign: 'center', lineHeight: 56, fontSize: 28, fontWeight: '700' },
  successTitle: { ...typography.title },
  successDesc: { ...typography.body, color: colors.muted },
})
