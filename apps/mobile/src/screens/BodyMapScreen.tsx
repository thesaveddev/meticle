import { useEffect, useState } from 'react'
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, elevation, radii, spacing, type, FONT, useAppColors } from '../theme'
import { dyn } from '../utils/dynamicStyles'
import type { AuthSession, BodyMapEntry, BodyMapStats } from '../types'
import { getBodyMapEntries, getBodyMapStats, createBodyMapEntry, updateBodyMapEntry } from '../services/api'
import { PrimaryButton } from '../components/PrimaryButton'

const CONDITION_TYPES = [
  { key: 'bruise', label: 'Bruise', color: '#7C3AED', icon: '🟣' },
  { key: 'wound', label: 'Wound', color: '#DC2626', icon: '🔴' },
  { key: 'rash', label: 'Rash', color: '#EA580C', icon: '🟠' },
  { key: 'injection', label: 'Injection', color: '#2563EB', icon: '💉' },
  { key: 'burn', label: 'Burn', color: '#DC2626', icon: '🔥' },
  { key: 'pressure_sore', label: 'Pressure sore', color: '#9333EA', icon: '⚠️' },
  { key: 'scar', label: 'Scar', color: '#6B7280', icon: '—' },
  { key: 'swelling', label: 'Swelling', color: '#0891B2', icon: '🔵' },
  { key: 'skin_tear', label: 'Skin tear', color: '#BE123C', icon: '🩹' },
  { key: 'other', label: 'Other', color: '#6B7280', icon: '❓' },
] as const

const SEVERITIES = [
  { key: 'mild', label: 'Mild', color: '#16A34A' },
  { key: 'moderate', label: 'Moderate', color: '#D97706' },
  { key: 'severe', label: 'Severe', color: '#DC2626' },
] as const

// Body zones mapped to approximate x,y coordinates on the body diagram
const BODY_ZONES_FRONT = [
  { key: 'head', label: 'Head', x: 0.5, y: 0.06, w: 0.18, h: 0.07 },
  { key: 'neck', label: 'Neck', x: 0.5, y: 0.13, w: 0.1, h: 0.03 },
  { key: 'left_shoulder', label: 'L shoulder', x: 0.35, y: 0.17, w: 0.12, h: 0.06 },
  { key: 'right_shoulder', label: 'R shoulder', x: 0.65, y: 0.17, w: 0.12, h: 0.06 },
  { key: 'chest', label: 'Chest', x: 0.5, y: 0.24, w: 0.24, h: 0.1 },
  { key: 'abdomen', label: 'Abdomen', x: 0.5, y: 0.36, w: 0.22, h: 0.08 },
  { key: 'left_upper_arm', label: 'L upper arm', x: 0.22, y: 0.22, w: 0.08, h: 0.1 },
  { key: 'right_upper_arm', label: 'R upper arm', x: 0.78, y: 0.22, w: 0.08, h: 0.1 },
  { key: 'left_forearm', label: 'L forearm', x: 0.16, y: 0.35, w: 0.07, h: 0.1 },
  { key: 'right_forearm', label: 'R forearm', x: 0.84, y: 0.35, w: 0.07, h: 0.1 },
  { key: 'left_hand', label: 'L hand', x: 0.12, y: 0.46, w: 0.06, h: 0.05 },
  { key: 'right_hand', label: 'R hand', x: 0.88, y: 0.46, w: 0.06, h: 0.05 },
  { key: 'pelvis', label: 'Pelvis', x: 0.5, y: 0.45, w: 0.2, h: 0.06 },
  { key: 'left_thigh', label: 'L thigh', x: 0.4, y: 0.54, w: 0.1, h: 0.12 },
  { key: 'right_thigh', label: 'R thigh', x: 0.6, y: 0.54, w: 0.1, h: 0.12 },
  { key: 'left_knee', label: 'L knee', x: 0.4, y: 0.67, w: 0.08, h: 0.05 },
  { key: 'right_knee', label: 'R knee', x: 0.6, y: 0.67, w: 0.08, h: 0.05 },
  { key: 'left_shin', label: 'L shin', x: 0.4, y: 0.74, w: 0.07, h: 0.1 },
  { key: 'right_shin', label: 'R shin', x: 0.6, y: 0.74, w: 0.07, h: 0.1 },
  { key: 'left_foot', label: 'L foot', x: 0.4, y: 0.88, w: 0.08, h: 0.05 },
  { key: 'right_foot', label: 'R foot', x: 0.6, y: 0.88, w: 0.08, h: 0.05 },
] as const

const BODY_ZONES_BACK = [
  { key: 'back_of_head', label: 'Back of head', x: 0.5, y: 0.06, w: 0.18, h: 0.07 },
  { key: 'neck_back', label: 'Neck', x: 0.5, y: 0.13, w: 0.1, h: 0.03 },
  { key: 'upper_back', label: 'Upper back', x: 0.5, y: 0.2, w: 0.24, h: 0.1 },
  { key: 'lower_back', label: 'Lower back', x: 0.5, y: 0.34, w: 0.22, h: 0.08 },
  { key: 'left_buttock', label: 'L buttock', x: 0.4, y: 0.44, w: 0.1, h: 0.06 },
  { key: 'right_buttock', label: 'R buttock', x: 0.6, y: 0.44, w: 0.1, h: 0.06 },
  { key: 'left_hamstring', label: 'L hamstring', x: 0.4, y: 0.56, w: 0.1, h: 0.1 },
  { key: 'right_hamstring', label: 'R hamstring', x: 0.6, y: 0.56, w: 0.1, h: 0.1 },
  { key: 'left_calf', label: 'L calf', x: 0.4, y: 0.72, w: 0.07, h: 0.1 },
  { key: 'right_calf', label: 'R calf', x: 0.6, y: 0.72, w: 0.07, h: 0.1 },
  { key: 'left_heel', label: 'L heel', x: 0.4, y: 0.88, w: 0.06, h: 0.05 },
  { key: 'right_heel', label: 'R heel', x: 0.6, y: 0.88, w: 0.06, h: 0.05 },
] as const

function conditionColor(type: string) {
  return CONDITION_TYPES.find(c => c.key === type)?.color || colors.muted
}

function severityBadge(severity: string) {
  return SEVERITIES.find(s => s.key === severity) || SEVERITIES[0]
}

interface Props {
  personId: string
  personName: string
  session: AuthSession
  onBack: () => void
}

export function BodyMapScreen({ personId, personName, session, onBack }: Props) {
  const c = useAppColors()
  const [entries, setEntries] = useState<BodyMapEntry[]>([])
  const [stats, setStats] = useState<BodyMapStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'front' | 'back'>('front')
  const [addOpen, setAddOpen] = useState(false)
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [conditionType, setConditionType] = useState('bruise')
  const [severity, setSeverity] = useState('mild')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [detailEntry, setDetailEntry] = useState<BodyMapEntry | null>(null)

  const load = async () => {
    try {
      const [e, s] = await Promise.all([
        getBodyMapEntries(session.accessToken, personId),
        getBodyMapStats(session.accessToken, personId),
      ])
      setEntries(e)
      setStats(s)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const zones = view === 'front' ? BODY_ZONES_FRONT : BODY_ZONES_BACK

  // Find entries per zone for the current view
  const entriesByZone: Record<string, BodyMapEntry[]> = {}
  for (const entry of entries) {
    if (entry.body_view === view) {
      if (!entriesByZone[entry.body_zone]) entriesByZone[entry.body_zone] = []
      entriesByZone[entry.body_zone].push(entry)
    }
  }

  const handleZonePress = (zoneKey: string) => {
    const zoneEntries = entriesByZone[zoneKey]
    if (zoneEntries && zoneEntries.length > 0) {
      setDetailEntry(zoneEntries[0])
    } else {
      setSelectedZone(zoneKey)
      setAddOpen(true)
    }
  }

  const handleSave = async () => {
    if (!selectedZone) return
    setSaving(true)
    try {
      const zone = zones.find(z => z.key === selectedZone)
      await createBodyMapEntry(session.accessToken, {
        person_id: personId,
        body_view: view,
        body_zone: selectedZone,
        zone_x: zone?.x,
        zone_y: zone?.y,
        condition_type: conditionType,
        description: description.trim() || undefined,
        severity,
      })
      setAddOpen(false)
      setSelectedZone(null)
      setDescription('')
      setConditionType('bruise')
      setSeverity('mild')
      await load()
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const handleResolve = async (entry: BodyMapEntry) => {
    Alert.alert('Resolve condition', 'Mark this as resolved?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Resolve',
        onPress: async () => {
          try {
            await updateBodyMapEntry(session.accessToken, entry.id, {
              status: 'resolved',
            })
            setDetailEntry(null)
            await load()
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Could not resolve')
          }
        },
      },
    ])
  }

  const activeEntries = entries.filter(e => e.status === 'active')
  const healingEntries = entries.filter(e => e.status === 'healing')

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Body Map</Text>
        <Text style={styles.subtitle}>{personName}</Text>

        {/* Stats */}
        {stats && (
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { borderLeftColor: colors.danger }]}>
              <Text style={[styles.statValue, { color: colors.danger }]}>{stats.active_count}</Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: colors.warning }]}>
              <Text style={[styles.statValue, { color: colors.warning }]}>{stats.healing_count}</Text>
              <Text style={styles.statLabel}>Healing</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: colors.success }]}>
              <Text style={[styles.statValue, { color: colors.success }]}>{stats.resolved_count}</Text>
              <Text style={styles.statLabel}>Resolved</Text>
            </View>
          </View>
        )}

        {/* View toggle */}
        <View style={styles.toggleRow}>
          <Pressable onPress={() => setView('front')} style={[styles.toggleBtn, view === 'front' && styles.toggleActive]}>
            <Text style={[styles.toggleText, view === 'front' && styles.toggleTextActive]}>Front</Text>
          </Pressable>
          <Pressable onPress={() => setView('back')} style={[styles.toggleBtn, view === 'back' && styles.toggleActive]}>
            <Text style={[styles.toggleText, view === 'back' && styles.toggleTextActive]}>Back</Text>
          </Pressable>
        </View>

        {/* Body diagram */}
        <View style={styles.diagramCard}>
          <View style={styles.bodyOutline}>
            {/* Simple body silhouette */}
            <View style={styles.bodySilhouette}>
              {/* Head */}                <View style={[styles.bodyPart, { top: '2%' as any, left: '40%' as any, width: '20%' as any, height: '8%' as any, borderRadius: 10 }]} />
              {/* Neck */}
              <View style={[styles.bodyPart, { top: '10%' as any, left: '45%' as any, width: '10%' as any, height: '4%' as any }]} />
              {/* Torso */}
              <View style={[styles.bodyPart, { top: '14%' as any, left: '30%' as any, width: '40%' as any, height: '22%' as any, borderRadius: 8 }]} />
              {/* Left arm */}
              <View style={[styles.bodyPart, { top: '14%' as any, left: '16%' as any, width: '12%' as any, height: '28%' as any, borderRadius: 6 }]} />
              {/* Right arm */}
              <View style={[styles.bodyPart, { top: '14%' as any, right: '16%' as any, width: '12%' as any, height: '28%' as any, borderRadius: 6 }]} />
              {/* Hips */}
              <View style={[styles.bodyPart, { top: '36%' as any, left: '33%' as any, width: '34%' as any, height: '10%' as any, borderRadius: 6 }]} />
              {/* Left leg */}
              <View style={[styles.bodyPart, { top: '46%' as any, left: '33%' as any, width: '14%' as any, height: '36%' as any, borderRadius: 6 }]} />
              {/* Right leg */}
              <View style={[styles.bodyPart, { top: '46%' as any, right: '33%' as any, width: '14%' as any, height: '36%' as any, borderRadius: 6 }]} />
              {/* Left foot */}
              <View style={[styles.bodyPart, { bottom: '2%' as any, left: '30%' as any, width: '16%' as any, height: '6%' as any, borderRadius: 8 }]} />
              {/* Right foot */}
              <View style={[styles.bodyPart, { bottom: '2%' as any, right: '30%' as any, width: '16%' as any, height: '6%' as any, borderRadius: 8 }]} />
            </View>

            {/* Tap zones overlay */}
            {zones.map(zone => {
              const zoneEntries = entriesByZone[zone.key]
              const hasEntries = zoneEntries && zoneEntries.length > 0
              return (
                <Pressable
                  key={zone.key}
                  onPress={() => handleZonePress(zone.key)}
                  style={[
                    styles.zoneOverlay,
                    { top: zone.y * 100 + '%', left: (zone.x - zone.w / 2) * 100 + '%', width: zone.w * 100 + '%', height: zone.h * 100 + '%' } as any,
                  ]}
                >
                  {hasEntries && (
                    <View style={[styles.zoneDot, { backgroundColor: conditionColor(zoneEntries![0].condition_type) }]}>
                      <Text style={styles.zoneDotText}>{zoneEntries!.length}</Text>
                    </View>
                  )}
                </Pressable>
              )
            })}
          </View>
          <Text style={styles.diagramHint}>Tap a zone to add or view conditions</Text>
        </View>

        {/* Active conditions list */}
        {activeEntries.length > 0 && (
          <View>
            <Text style={styles.sectionHead}>ACTIVE CONDITIONS ({activeEntries.length})</Text>
            {activeEntries.map(entry => (
              <Pressable key={entry.id} onPress={() => setDetailEntry(entry)} style={styles.entryCard}>
                <View style={[styles.entryDot, { backgroundColor: conditionColor(entry.condition_type) }]} />
                <View style={styles.entryInfo}>
                  <Text style={styles.entryZone}>{entry.body_zone.replace(/_/g, ' ')}</Text>
                  <Text style={styles.entryType}>{entry.condition_type.replace(/_/g, ' ')} · {entry.severity}</Text>
                  {entry.description && <Text style={styles.entryDesc} numberOfLines={1}>{entry.description}</Text>}
                </View>
                <View style={[styles.severityBadge, { backgroundColor: severityBadge(entry.severity).color + '18' }]}>
                  <Text style={[styles.severityText, { color: severityBadge(entry.severity).color }]}>{entry.severity}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Healing */}
        {healingEntries.length > 0 && (
          <View>
            <Text style={styles.sectionHead}>HEALING ({healingEntries.length})</Text>
            {healingEntries.map(entry => (
              <Pressable key={entry.id} onPress={() => setDetailEntry(entry)} style={styles.entryCard}>
                <View style={[styles.entryDot, { backgroundColor: conditionColor(entry.condition_type) + '60' }]} />
                <View style={styles.entryInfo}>
                  <Text style={styles.entryZone}>{entry.body_zone.replace(/_/g, ' ')}</Text>
                  <Text style={styles.entryType}>{entry.condition_type.replace(/_/g, ' ')} · {entry.severity}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {entries.length === 0 && !loading && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🩺</Text>
            <Text style={styles.emptyTitle}>No conditions recorded</Text>
            <Text style={styles.emptyCopy}>Tap a zone on the body diagram to add a condition.</Text>
          </View>
        )}
      </ScrollView>

      {/* Add entry modal */}
      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Add condition</Text>
              <Text style={styles.modalZone}>Zone: {selectedZone?.replace(/_/g, ' ')}</Text>

              <Text style={styles.fieldLabel}>Condition type</Text>
              <View style={styles.chipRow}>
                {CONDITION_TYPES.map(ct => (
                  <Pressable
                    key={ct.key}
                    onPress={() => setConditionType(ct.key)}
                    style={[styles.chip, conditionType === ct.key && { backgroundColor: ct.color, borderColor: ct.color }]}
                  >
                    <Text style={[styles.chipText, conditionType === ct.key && { color: colors.inverse }]}>
                      {ct.icon} {ct.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Severity</Text>
              <View style={styles.chipRow}>
                {SEVERITIES.map(s => (
                  <Pressable
                    key={s.key}
                    onPress={() => setSeverity(s.key)}
                    style={[styles.chip, severity === s.key && { backgroundColor: s.color, borderColor: s.color }]}
                  >
                    <Text style={[styles.chipText, severity === s.key && { color: colors.inverse }]}>{s.label}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Description (optional)</Text>
              <TextInput
                multiline
                value={description}
                onChangeText={setDescription}
                placeholder="Describe the condition..."
                placeholderTextColor={colors.subtle}
                style={[styles.input, styles.textArea]}
              />

              <View style={styles.modalActions}>
                <PrimaryButton label="Save" onPress={handleSave} loading={saving} disabled={saving} />
                <Pressable onPress={() => setAddOpen(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Detail modal */}
      <Modal visible={!!detailEntry} transparent animationType="fade" onRequestClose={() => setDetailEntry(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            {detailEntry && (
              <>
                <Text style={styles.modalTitle}>{detailEntry.condition_type.replace(/_/g, ' ')}</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Zone</Text>
                  <Text style={styles.detailValue}>{detailEntry.body_zone.replace(/_/g, ' ')}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Severity</Text>
                  <View style={[styles.severityBadge, { backgroundColor: severityBadge(detailEntry.severity).color + '18' }]}>
                    <Text style={[styles.severityText, { color: severityBadge(detailEntry.severity).color }]}>{detailEntry.severity}</Text>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <Text style={styles.detailValue}>{detailEntry.status}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Recorded</Text>
                  <Text style={styles.detailValue}>{new Date(detailEntry.recorded_date).toLocaleDateString('en-GB')}</Text>
                </View>
                {detailEntry.description && (
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailLabel}>Description</Text>
                    <Text style={styles.detailBody}>{detailEntry.description}</Text>
                  </View>
                )}
                {detailEntry.recorded_by_name && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Recorded by</Text>
                    <Text style={styles.detailValue}>{detailEntry.recorded_by_name}</Text>
                  </View>
                )}
                {detailEntry.status !== 'resolved' && (
                  <PrimaryButton label="Mark as resolved" onPress={() => handleResolve(detailEntry)} tone="success" />
                )}
                <Pressable onPress={() => setDetailEntry(null)} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Close</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.base, paddingTop: spacing.md, paddingBottom: spacing.xxxl },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.base },
  backArrow: { fontFamily: 'System', fontSize: 18, color: colors.primary, fontWeight: '600' },
  backText: { fontFamily: 'System', fontSize: 15, fontWeight: '500', color: colors.primary },
  title: { ...type.title, marginBottom: spacing.xs },
  subtitle: { ...type.body, color: colors.muted, marginBottom: spacing.base },

  /* Stats */
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.base },
  statCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radii.md,
    borderLeftWidth: 3, borderWidth: 1, borderColor: colors.borderLight, padding: spacing.md, ...elevation.sm,
  },
  statValue: { fontFamily: 'System', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { ...type.small, marginTop: 2 },

  /* Toggle */
  toggleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.base },
  toggleBtn: {
    flex: 1, paddingVertical: spacing.md, borderRadius: radii.md, alignItems: 'center',
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
  },
  toggleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleText: { fontFamily: 'System', fontSize: 14, fontWeight: '600', color: colors.muted },
  toggleTextActive: { color: colors.inverse },

  /* Diagram */
  diagramCard: {
    backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1,
    borderColor: colors.borderLight, padding: spacing.base, marginBottom: spacing.base, ...elevation.sm,
  },
  bodyOutline: { width: '100%', aspectRatio: 0.55, position: 'relative' },
  bodySilhouette: { ...StyleSheet.absoluteFill },
  bodyPart: {
    position: 'absolute', backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
  },
  zoneOverlay: { position: 'absolute', zIndex: 10 },
  zoneDot: {
    width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', ...elevation.sm,
  },
  zoneDotText: { fontFamily: 'System', fontSize: 10, fontWeight: '700', color: colors.inverse },
  diagramHint: { ...type.caption, textAlign: 'center', marginTop: spacing.sm },

  /* Entries */
  sectionHead: {
    fontFamily: 'System', fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
    textTransform: 'uppercase', color: colors.subtle, marginBottom: spacing.sm, marginTop: spacing.base,
  },
  entryCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: radii.md, borderWidth: 1, borderColor: colors.borderLight,
    padding: spacing.md, marginBottom: spacing.sm, gap: spacing.md, ...elevation.sm,
  },
  entryDot: { width: 10, height: 10, borderRadius: 5 },
  entryInfo: { flex: 1 },
  entryZone: { ...type.bodyBold, fontSize: 14, textTransform: 'capitalize' },
  entryType: { ...type.small, textTransform: 'capitalize', marginTop: 1 },
  entryDesc: { ...type.caption, marginTop: 2 },
  severityBadge: { paddingHorizontal: spacing.md, paddingVertical: 3, borderRadius: radii.full },
  severityText: { fontFamily: 'System', fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },

  /* Empty */
  emptyCard: {
    backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.xxl,
    alignItems: 'center', borderWidth: 1, borderColor: colors.borderLight, marginTop: spacing.xxl,
  },
  emptyIcon: { fontSize: 32, marginBottom: spacing.md },
  emptyTitle: { ...type.bodyBold, marginBottom: spacing.xs },
  emptyCopy: { ...type.small, textAlign: 'center', paddingHorizontal: spacing.lg },

  /* Modal */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(28,25,23,0.5)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: colors.bg, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
    padding: spacing.xl, maxHeight: '85%', ...elevation.lg,
  },
  modalTitle: { ...type.title, marginBottom: spacing.xs },
  modalZone: { ...type.small, color: colors.primary, textTransform: 'capitalize', marginBottom: spacing.base },
  fieldLabel: { fontFamily: 'System', fontSize: 12, fontWeight: '600', color: colors.inkLight, marginTop: spacing.base, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.sm,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
  },
  chipText: { fontFamily: 'System', fontSize: 12, fontWeight: '600', color: colors.muted },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radii.md,
    backgroundColor: colors.surface, paddingHorizontal: spacing.base, paddingVertical: spacing.md,
    color: colors.ink, fontFamily: 'System', fontSize: 15,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top', paddingTop: spacing.md },
  modalActions: { marginTop: spacing.base, gap: spacing.sm },
  cancelBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  cancelText: { fontFamily: 'System', fontSize: 15, fontWeight: '600', color: colors.primary },

  /* Detail */
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  detailLabel: { ...type.small, flex: 1 },
  detailValue: { ...type.body, fontSize: 14, textTransform: 'capitalize', flex: 2, textAlign: 'right' },
  detailBlock: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  detailBody: { ...type.body, fontSize: 14, marginTop: spacing.xs },
})
