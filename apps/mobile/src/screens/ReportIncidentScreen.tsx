import { useState } from 'react'
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, elevation, radii, spacing, type } from '../theme'
import type { AuthSession } from '../types'
import { PrimaryButton } from '../components/PrimaryButton'
import { hapticLight, hapticWarning } from '../services/haptics'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://meticlecare.com/api'

const INCIDENT_CATEGORIES = [
  { key: 'fall', label: 'Fall', icon: '🩹' },
  { key: 'medication_error', label: 'Medication error', icon: '💊' },
  { key: 'pressure_sore', label: 'Pressure sore', icon: '🔴' },
  { key: 'skin_tear', label: 'Skin tear', icon: '🩹' },
  { key: 'choking', label: 'Choking', icon: '⚠️' },
  { key: 'behavioral', label: 'Behavioral', icon: '🧠' },
  { key: 'safeguarding', label: 'Safeguarding', icon: '🛡️' },
  { key: 'equipment_failure', label: 'Equipment', icon: '🔧' },
  { key: 'accident', label: 'Accident', icon: '⚡' },
  { key: 'other', label: 'Other', icon: '📋' },
] as const

const SEVERITY_LEVELS = [
  { key: 'low', label: 'Low', color: '#16A34A', desc: 'No harm or very minor' },
  { key: 'medium', label: 'Medium', color: '#D97706', desc: 'Required first aid' },
  { key: 'high', label: 'High', color: '#DC2626', desc: 'Hospital or emergency' },
  { key: 'critical', label: 'Critical', color: '#7F1D1D', desc: 'Life-threatening' },
] as const

interface Props {
  session: AuthSession
  visitId?: string
  personId?: string
  personName?: string
  onBack: () => void
  onSubmitted?: () => void
}

export function ReportIncidentScreen({ session, visitId, personId, personName, onBack, onSubmitted }: Props) {
  const [category, setCategory] = useState('')
  const [severity, setSeverity] = useState('medium')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [witnesses, setWitnesses] = useState('')
  const [isNearMiss, setIsNearMiss] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter an incident title')
      return
    }
    hapticWarning()
    setSaving(true)
    try {
      const body: any = {
        title: title.trim(),
        description: description.trim() || undefined,
        category_id: category || undefined,
        severity,
        location: location.trim() || undefined,
        is_near_miss: isNearMiss,
        incident_date: new Date().toISOString().split('T')[0],
        incident_time: new Date().toTimeString().slice(0, 5),
      }
      if (personId) body.person_ids = [personId]
      if (visitId) body.visit_id = visitId

      const res = await fetch(`${API_BASE}/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Could not submit')
      }
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
      <SafeAreaView style={styles.screen}>
        <View style={styles.successView}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successTitle}>Incident reported</Text>
          <Text style={styles.successDesc}>Your report has been submitted to the office.</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Report an incident</Text>
        {personName && <Text style={styles.subtitle}>Client: {personName}</Text>}

        {/* Near miss toggle */}
        <Pressable onPress={() => { hapticLight(); setIsNearMiss(!isNearMiss) }} style={styles.nearMissRow}>
          <View style={[styles.checkbox, isNearMiss && styles.checkboxChecked]}>
            {isNearMiss && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.checkboxLabel}>This is a near miss</Text>
            <Text style={styles.checkboxDesc}>No harm occurred but it could have</Text>
          </View>
        </Pressable>

        {/* Category */}
        <Text style={styles.fieldLabel}>Category</Text>
        <View style={styles.chipGrid}>
          {INCIDENT_CATEGORIES.map(c => (
            <Pressable key={c.key} onPress={() => { hapticLight(); setCategory(c.key) }} style={[styles.chip, category === c.key && styles.chipActive]}>
              <Text style={styles.chipIcon}>{c.icon}</Text>
              <Text style={[styles.chipText, category === c.key && styles.chipTextActive]}>{c.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Severity */}
        <Text style={styles.fieldLabel}>Severity</Text>
        <View style={styles.severityRow}>
          {SEVERITY_LEVELS.map(s => (
            <Pressable key={s.key} onPress={() => { hapticLight(); setSeverity(s.key) }} style={[styles.severityBtn, severity === s.key && { backgroundColor: s.color, borderColor: s.color }]}>
              <Text style={[styles.severityLabel, severity === s.key && { color: colors.inverse }]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Title */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Title *</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="Brief title of the incident" placeholderTextColor={colors.subtle} style={styles.input} />
        </View>

        {/* Description */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>What happened?</Text>
          <TextInput multiline value={description} onChangeText={setDescription} placeholder="Describe what happened factually..." placeholderTextColor={colors.subtle} style={[styles.input, styles.textArea]} />
        </View>

        {/* Location */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Location within the property</Text>
          <TextInput value={location} onChangeText={setLocation} placeholder="e.g. Bedroom, bathroom" placeholderTextColor={colors.subtle} style={styles.input} />
        </View>

        {/* Witnesses */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Witnesses</Text>
          <TextInput value={witnesses} onChangeText={setWitnesses} placeholder="Names of any witnesses" placeholderTextColor={colors.subtle} style={styles.input} />
        </View>

        <PrimaryButton label="Submit incident report" onPress={handleSave} loading={saving} disabled={saving} tone="danger" />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.base, paddingTop: spacing.md, paddingBottom: spacing.xxxl },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.base },
  backArrow: { fontFamily: 'System', fontSize: 18, color: colors.primary, fontWeight: '600' },
  backText: { fontFamily: 'System', fontSize: 15, fontWeight: '500', color: colors.primary },
  title: { ...type.title, marginBottom: spacing.xs },
  subtitle: { ...type.body, color: colors.muted, marginBottom: spacing.base },

  /* Near miss */
  nearMissRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.warningSurface, borderRadius: radii.md, borderWidth: 1, borderColor: '#FDE68A', padding: spacing.base, marginBottom: spacing.base },
  checkbox: { width: 24, height: 24, borderRadius: 4, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.warning, borderColor: colors.warning },
  checkmark: { fontFamily: 'System', fontSize: 14, fontWeight: '700', color: colors.inverse },
  checkboxLabel: { fontFamily: 'System', fontSize: 14, fontWeight: '700', color: '#92400E' },
  checkboxDesc: { ...type.small, color: '#A16207', marginTop: 1 },

  /* Category chips */
  fieldLabel: { fontFamily: 'System', fontSize: 12, fontWeight: '600', color: colors.inkLight, marginTop: spacing.base, marginBottom: spacing.sm },
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
  successTitle: { ...type.title },
  successDesc: { ...type.body, color: colors.muted },
})
