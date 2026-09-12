import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { colors, elevation, radii, spacing, type } from '../theme'
import type { AuthSession } from '../types'
import { getPersonDetail, getMedicationsForPerson, getBodyMapStats, getDailySummary } from '../services/api'

type TabKey = 'overview' | 'care' | 'body' | 'nutrition' | 'meds' | 'contacts'

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: '📄' },
  { key: 'care', label: 'Care Plans', icon: '📋' },
  { key: 'body', label: 'Body Map', icon: '🩺' },
  { key: 'nutrition', label: 'Nutrition', icon: '🍽️' },
  { key: 'meds', label: 'Meds', icon: '💊' },
  { key: 'contacts', label: 'Contacts', icon: '📞' },
]

interface Props {
  personId: string
  session: AuthSession
  onBack: () => void
  onBodyMap?: (personId: string, personName: string) => void
  onNutrition?: (personId: string, personName: string) => void
}

export function ClientDetailScreen({ personId, session, onBack, onBodyMap, onNutrition }: Props) {
  const [person, setPerson] = useState<any>(null)
  const [medications, setMedications] = useState<any[]>([])
  const [bodyMapStats, setBodyMapStats] = useState<any>(null)
  const [nutritionSummary, setNutritionSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<TabKey>('overview')

  useEffect(() => {
    (async () => {
      try {
        const [personData, medData, bmStats, nutSummary] = await Promise.all([
          getPersonDetail(session.accessToken, personId),
          getMedicationsForPerson(session.accessToken, personId).catch(() => []),
          getBodyMapStats(session.accessToken, personId).catch(() => null),
          getDailySummary(session.accessToken, personId).catch(() => null),
        ])
        setPerson(personData)
        setMedications(medData)
        setBodyMapStats(bmStats)
        setNutritionSummary(nutSummary)
      } catch (e: any) {
        setError(e.message || 'Could not load details')
      } finally {
        setLoading(false)
      }
    })()
  }, [personId])

  if (loading) {
    return (
      <View style={styles.screen}>
        <Header onBack={onBack} title="Client" />
        <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>Loading...</Text></View>
      </View>
    )
  }

  if (error || !person) {
    return (
      <View style={styles.screen}>
        <Header onBack={onBack} title="Client" />
        <View style={styles.loading}><Text style={styles.errorText}>{error || 'Client not found'}</Text></View>
      </View>
    )
  }

  const personName = `${person.first_name} ${person.last_name}`
  const allergies = typeof person.allergies === 'string' ? JSON.parse(person.allergies || '[]') : (person.allergies || [])
  const carePlans = (person.care_plans || []).filter((cp: any) => cp.status === 'active')
  const contacts = person.family_contacts || []
  const emergencyContacts = contacts.filter((c: any) => c.is_emergency_contact)
  const otherContacts = contacts.filter((c: any) => !c.is_emergency_contact)

  return (
    <View style={styles.screen}>
      <Header onBack={onBack} title="Client" />

      {/* Client card */}
      <View style={styles.clientCard}>
        <View style={styles.clientInfo}>
          <Text style={styles.clientName}>{personName}</Text>
          <View style={styles.tagRow}>
            {person.support_level && (
              <View style={[styles.tag, styles.tagGreen]}>
                <Text style={[styles.tagText, { color: colors.successDeep }]}>{person.support_level.replace(/_/g, ' ')}</Text>
              </View>
            )}
            {person.requires_two_staff && (
              <View style={[styles.tag, styles.tagOrange]}>
                <Text style={[styles.tagText, { color: '#C2410C' }]}>2-person call</Text>
              </View>
            )}
          </View>
          <View style={styles.metaRow}>
            {person.date_of_birth && <Text style={styles.metaText}>DOB: {new Date(person.date_of_birth).toLocaleDateString('en-GB')}</Text>}
            {person.nhs_number && <Text style={styles.metaText}>NHS: {person.nhs_number}</Text>}
          </View>
        </View>
      </View>

      {/* Allergies warning */}
      {allergies.length > 0 && (
        <View style={styles.alertCard}>
          <Text style={styles.alertIcon}>⚠️</Text>
          <Text style={styles.alertText}>Allergies: {allergies.join(', ')}</Text>
        </View>
      )}

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
        {TABS.map(t => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, tab === t.key && styles.tabActive]}>
            <Text style={[styles.tabIcon]}>{t.icon}</Text>
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Tab content */}
      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
        {tab === 'overview' && <OverviewTab person={person} />}
        {tab === 'care' && <CareTab carePlans={carePlans} />}
        {tab === 'body' && (
          <View>
            {bodyMapStats && (
              <View style={styles.statsRow}>
                <MiniStat label="Active" value={bodyMapStats.active_count} color={colors.danger} />
                <MiniStat label="Healing" value={bodyMapStats.healing_count} color={colors.warning} />
                <MiniStat label="Resolved" value={bodyMapStats.resolved_count} color={colors.success} />
              </View>
            )}
            <Pressable style={styles.actionCard} onPress={() => onBodyMap?.(personId, personName)}>
              <Text style={styles.actionIcon}>🩺</Text>
              <View style={styles.actionInfo}>
                <Text style={styles.actionTitle}>Open body map</Text>
                <Text style={styles.actionDesc}>View and record conditions on the body diagram</Text>
              </View>
              <Text style={styles.actionArrow}>→</Text>
            </Pressable>
          </View>
        )}
        {tab === 'nutrition' && (
          <View>
            {nutritionSummary && (
              <View style={styles.statsRow}>
                <MiniStat label="Meals" value={nutritionSummary.total_meals} color={colors.primary} />
                <MiniStat label="Fluid" value={`${nutritionSummary.total_fluid_ml || 0}ml`} color={colors.accent} />
                <MiniStat label="Avg intake" value={`${nutritionSummary.avg_consumed_percent || 0}%`} color={colors.success} />
              </View>
            )}
            <Pressable style={styles.actionCard} onPress={() => onNutrition?.(personId, personName)}>
              <Text style={styles.actionIcon}>🍽️</Text>
              <View style={styles.actionInfo}>
                <Text style={styles.actionTitle}>Open nutrition tracker</Text>
                <Text style={styles.actionDesc}>Log meals, track fluid intake, view dietary profile</Text>
              </View>
              <Text style={styles.actionArrow}>→</Text>
            </Pressable>
          </View>
        )}
        {tab === 'meds' && <MedsTab medications={medications} />}
        {tab === 'contacts' && <ContactsTab emergencyContacts={emergencyContacts} otherContacts={otherContacts} person={person} />}
      </ScrollView>
    </View>
  )
}

/* ─── Sub-components ────────────────────────────────────────── */

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backArrow}>←</Text>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 60 }} />
    </View>
  )
}

function MiniStat({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={[styles.miniStatValue, { color }]}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

function OverviewTab({ person }: { person: any }) {
  return (
    <View>
      {person.room_number && <Card title="Location"><InfoRow label="Room" value={person.room_number} /></Card>}
      {person.gp_name && (
        <Card title="GP details">
          <InfoRow label="Name" value={person.gp_name} />
          {person.gp_surgery && <InfoRow label="Surgery" value={person.gp_surgery} />}
          {person.gp_phone && <InfoRow label="Phone" value={person.gp_phone} />}
          {person.gp_email && <InfoRow label="Email" value={person.gp_email} />}
        </Card>
      )}
      {person.dietary_requirements && <Card title="Dietary"><Text style={styles.cardBody}>{person.dietary_requirements}</Text></Card>}
      {(person.communication_language || person.communication_method) && (
        <Card title="Communication">
          {person.communication_language && <InfoRow label="Language" value={person.communication_language} />}
          {person.communication_method && <InfoRow label="Method" value={person.communication_method} />}
          {person.communication_interpreter && <InfoRow label="Interpreter" value="Needed" />}
        </Card>
      )}
    </View>
  )
}

function CareTab({ carePlans }: { carePlans: any[] }) {
  if (carePlans.length === 0) {
    return <View style={styles.emptyTab}><Text style={styles.emptyTitle}>No active care plans</Text></View>
  }
  return (
    <View>
      {carePlans.map((cp: any) => (
        <Card key={cp.id} title={cp.title}>
          {cp.category && <Text style={styles.cardMeta}>{cp.category}</Text>}
          {cp.description && <Text style={styles.cardBody}>{cp.description}</Text>}
          {cp.review_date && <Text style={styles.cardMeta}>Review: {new Date(cp.review_date).toLocaleDateString('en-GB')}</Text>}
        </Card>
      ))}
    </View>
  )
}

function MedsTab({ medications }: { medications: any[] }) {
  if (medications.length === 0) {
    return <View style={styles.emptyTab}><Text style={styles.emptyTitle}>No medications recorded</Text></View>
  }
  return (
    <View>
      {medications.map((med: any) => (
        <Card key={med.id} title={`💊 ${med.medication_name || med.name}`}>
          {med.dosage && <InfoRow label="Dosage" value={med.dosage} />}
          {med.frequency && <InfoRow label="Frequency" value={med.frequency} />}
          {med.route && <InfoRow label="Route" value={med.route} />}
        </Card>
      ))}
    </View>
  )
}

function ContactsTab({ emergencyContacts, otherContacts, person }: { emergencyContacts: any[]; otherContacts: any[]; person: any }) {
  return (
    <View>
      {emergencyContacts.length > 0 && (
        <Card title="Emergency contacts">
          {emergencyContacts.map((c: any) => (
            <View key={c.id} style={styles.contactBlock}>
              <Text style={styles.contactName}>{c.name}</Text>
              {c.relationship && <Text style={styles.contactMeta}>{c.relationship}</Text>}
              {c.phone && <InfoRow label="Phone" value={c.phone} />}
            </View>
          ))}
        </Card>
      )}
      {otherContacts.length > 0 && (
        <Card title="Family contacts">
          {otherContacts.map((c: any) => (
            <View key={c.id} style={styles.contactBlock}>
              <Text style={styles.contactName}>{c.name}</Text>
              {c.relationship && <Text style={styles.contactMeta}>{c.relationship}</Text>}
              {c.phone && <InfoRow label="Phone" value={c.phone} />}
            </View>
          ))}
        </Card>
      )}
      {emergencyContacts.length === 0 && otherContacts.length === 0 && (
        <View style={styles.emptyTab}><Text style={styles.emptyTitle}>No contacts on file</Text></View>
      )}
    </View>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  )
}

/* ─── Styles ────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.base, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
    backgroundColor: colors.surface, ...elevation.sm,
  },
  headerTitle: { ...type.bodyBold, color: colors.ink },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  backArrow: { fontFamily: 'System', fontSize: 18, color: colors.primary, fontWeight: '600' },
  backText: { fontFamily: 'System', fontSize: 15, fontWeight: '500', color: colors.primary },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { ...type.small },
  errorText: { ...type.body, color: colors.danger },

  /* Client card */
  clientCard: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderLight, padding: spacing.base },
  clientInfo: { flex: 1 },
  clientName: { fontFamily: 'System', fontSize: 20, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  tagRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm, flexWrap: 'wrap' },
  tag: { borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: 3, borderWidth: 1 },
  tagGreen: { backgroundColor: colors.successSurface, borderColor: colors.success + '20' },
  tagOrange: { backgroundColor: '#FFF7ED', borderColor: '#FDBA74' },
  tagText: { fontFamily: 'System', fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  metaRow: { flexDirection: 'row', gap: spacing.base, marginTop: spacing.sm },
  metaText: { ...type.small },

  /* Alert */
  alertCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.warningSurface, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: '#FDE68A' },
  alertIcon: { fontSize: 16 },
  alertText: { ...type.small, color: '#92400E', flex: 1, fontWeight: '600' },

  /* Tabs */
  tabBar: { paddingHorizontal: spacing.base, paddingVertical: spacing.sm, gap: spacing.xs, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  tab: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.sm, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.borderLight },
  tabActive: { backgroundColor: colors.primarySurface, borderColor: colors.primary + '30' },
  tabIcon: { fontSize: 12 },
  tabLabel: { fontFamily: 'System', fontSize: 11, fontWeight: '600', color: colors.muted },
  tabLabelActive: { color: colors.primary },

  /* Tab content */
  tabContent: { padding: spacing.base, paddingBottom: spacing.xxxl },

  /* Stats */
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.base },
  miniStat: { flex: 1, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.borderLight, padding: spacing.md, alignItems: 'center', ...elevation.sm },
  miniStatValue: { fontFamily: 'System', fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  miniStatLabel: { ...type.small, marginTop: 2 },

  /* Action card */
  actionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.borderLight, padding: spacing.base, marginBottom: spacing.base, gap: spacing.md, ...elevation.sm },
  actionIcon: { fontSize: 28 },
  actionInfo: { flex: 1 },
  actionTitle: { ...type.bodyBold },
  actionDesc: { ...type.small, marginTop: 2 },
  actionArrow: { fontFamily: 'System', fontSize: 20, color: colors.primary, fontWeight: '600' },

  /* Cards */
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.borderLight, padding: spacing.base, marginBottom: spacing.base, ...elevation.sm },
  cardTitle: { fontFamily: 'System', fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: spacing.sm },
  cardMeta: { ...type.small, marginTop: spacing.xs },
  cardBody: { ...type.body, fontSize: 14, lineHeight: 20 },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs + 2 },
  infoLabel: { ...type.small, flex: 1 },
  infoValue: { ...type.body, fontSize: 14, flex: 2, textAlign: 'right' },

  contactBlock: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderLight },
  contactName: { ...type.bodyBold, fontSize: 14 },
  contactMeta: { ...type.small, marginTop: 2 },

  /* Empty */
  emptyTab: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyTitle: { ...type.bodyBold },
})
