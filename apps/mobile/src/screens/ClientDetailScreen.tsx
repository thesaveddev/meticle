import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { colors, elevation, radii, spacing, type } from '../theme'
import type { AuthSession } from '../types'
import { getPersonDetail, getMedicationsForPerson } from '../services/api'

interface Props {
  personId: string
  session: AuthSession
  onBack: () => void
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={cdStyles.card}>
      <Text style={cdStyles.cardTitle}>{title}</Text>
      {children}
    </View>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={cdStyles.infoRow}>
      <Text style={cdStyles.infoLabel}>{label}</Text>
      <Text style={cdStyles.infoValue}>{value}</Text>
    </View>
  )
}

export function ClientDetailScreen({ personId, session, onBack }: Props) {
  const [person, setPerson] = useState<any>(null)
  const [medications, setMedications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const [personData, medData] = await Promise.all([
          getPersonDetail(session.accessToken, personId),
          getMedicationsForPerson(session.accessToken, personId).catch(() => []),
        ])
        setPerson(personData)
        setMedications(medData)
      } catch (e: any) {
        setError(e.message || 'Could not load details')
      } finally {
        setLoading(false)
      }
    })()
  }, [personId])

  if (loading) {
    return (
      <View style={cdStyles.screen}>
        <View style={cdStyles.header}>
          <Pressable onPress={onBack} style={cdStyles.backBtn}>
            <Text style={cdStyles.backArrow}>←</Text>
            <Text style={cdStyles.backText}>Back</Text>
          </Pressable>
          <Text style={cdStyles.headerTitle}>Client</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={cdStyles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={cdStyles.loadingText}>Loading...</Text>
        </View>
      </View>
    )
  }

  if (error || !person) {
    return (
      <View style={cdStyles.screen}>
        <View style={cdStyles.header}>
          <Pressable onPress={onBack} style={cdStyles.backBtn}>
            <Text style={cdStyles.backArrow}>←</Text>
            <Text style={cdStyles.backText}>Back</Text>
          </Pressable>
          <Text style={cdStyles.headerTitle}>Client</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={cdStyles.loading}>
          <Text style={cdStyles.errorText}>{error || 'Client not found'}</Text>
        </View>
      </View>
    )
  }

  const allergies = typeof person.allergies === 'string' ? JSON.parse(person.allergies || '[]') : (person.allergies || [])
  const carePlans = (person.care_plans || []).filter((cp: any) => cp.status === 'active')
  const contacts = person.family_contacts || []
  const emergencyContacts = contacts.filter((c: any) => c.is_emergency_contact)
  const otherContacts = contacts.filter((c: any) => !c.is_emergency_contact)

  return (
    <View style={cdStyles.screen}>
      <View style={cdStyles.header}>
        <Pressable onPress={onBack} style={cdStyles.backBtn}>
          <Text style={cdStyles.backArrow}>←</Text>
          <Text style={cdStyles.backText}>Back</Text>
        </Pressable>
        <Text style={cdStyles.headerTitle}>Client</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={cdStyles.content} showsVerticalScrollIndicator={false}>
        {/* Name & tags */}
        <View style={cdStyles.nameCard}>
          <Text style={cdStyles.clientName}>{person.first_name} {person.last_name}</Text>
          <View style={cdStyles.tagRow}>
            {person.support_level && (
              <View style={cdStyles.tag}>
                <Text style={cdStyles.tagText}>{person.support_level.replace(/_/g, ' ')}</Text>
              </View>
            )}
            {person.room_number && (
              <View style={[cdStyles.tag, cdStyles.tagBlue]}>
                <Text style={[cdStyles.tagText, { color: colors.primary }]}>Room {person.room_number}</Text>
              </View>
            )}
          </View>
          <View style={cdStyles.metaRow}>
            {person.date_of_birth && <Text style={cdStyles.metaText}>DOB: {new Date(person.date_of_birth).toLocaleDateString('en-GB')}</Text>}
            {person.nhs_number && <Text style={cdStyles.metaText}>NHS: {person.nhs_number}</Text>}
          </View>
        </View>

        {/* Allergies alert */}
        {allergies.length > 0 && (
          <View style={cdStyles.alertCard}>
            <View style={cdStyles.alertHeader}>
              <Text style={cdStyles.alertIcon}>⚠️</Text>
              <Text style={cdStyles.alertTitle}>Allergies</Text>
            </View>
            {allergies.map((a: string, i: number) => (
              <Text key={i} style={cdStyles.alertItem}>{typeof a === 'string' ? a : String(a)}</Text>
            ))}
          </View>
        )}

        {/* Care plans */}
        {carePlans.length > 0 && (
          <InfoCard title={`Care plans (${carePlans.length})`}>
            {carePlans.map((cp: any) => (
              <View key={cp.id} style={cdStyles.planBlock}>
                <Text style={cdStyles.planTitle}>{cp.title}</Text>
                {cp.category && <Text style={cdStyles.planMeta}>{cp.category}</Text>}
                {cp.description && <Text style={cdStyles.planDesc} numberOfLines={3}>{cp.description}</Text>}
                {cp.review_date && <Text style={cdStyles.planMeta}>Review: {new Date(cp.review_date).toLocaleDateString('en-GB')}</Text>}
              </View>
            ))}
          </InfoCard>
        )}

        {/* Medications */}
        {medications.length > 0 && (
          <InfoCard title={`Medications (${medications.length})`}>
            {medications.map((med: any) => (
              <View key={med.id} style={cdStyles.planBlock}>
                <Text style={cdStyles.planTitle}>💊 {med.medication_name || med.name}</Text>
                {med.dosage && <InfoRow label="Dosage" value={med.dosage} />}
                {med.frequency && <InfoRow label="Frequency" value={med.frequency} />}
                {med.route && <InfoRow label="Route" value={med.route} />}
              </View>
            ))}
          </InfoCard>
        )}

        {/* GP */}
        {(person.gp_name || person.gp_phone) && (
          <InfoCard title="GP details">
            {person.gp_name && <InfoRow label="Name" value={person.gp_name} />}
            {person.gp_surgery && <InfoRow label="Surgery" value={person.gp_surgery} />}
            {person.gp_phone && <InfoRow label="Phone" value={person.gp_phone} />}
            {person.gp_email && <InfoRow label="Email" value={person.gp_email} />}
          </InfoCard>
        )}

        {/* Emergency contacts */}
        {emergencyContacts.length > 0 && (
          <InfoCard title="Emergency contacts">
            {emergencyContacts.map((c: any) => (
              <View key={c.id} style={cdStyles.planBlock}>
                <Text style={cdStyles.planTitle}>{c.name}</Text>
                {c.relationship && <Text style={cdStyles.planMeta}>{c.relationship}</Text>}
                {c.phone && <InfoRow label="Phone" value={c.phone} />}
                {c.email && <InfoRow label="Email" value={c.email} />}
              </View>
            ))}
          </InfoCard>
        )}

        {/* Other contacts */}
        {otherContacts.length > 0 && (
          <InfoCard title="Family contacts">
            {otherContacts.map((c: any) => (
              <View key={c.id} style={cdStyles.planBlock}>
                <Text style={cdStyles.planTitle}>{c.name}</Text>
                {c.relationship && <Text style={cdStyles.planMeta}>{c.relationship}</Text>}
                {c.phone && <InfoRow label="Phone" value={c.phone} />}
              </View>
            ))}
          </InfoCard>
        )}

        {/* Dietary */}
        {person.dietary_requirements && (
          <InfoCard title="Dietary requirements">
            <Text style={cdStyles.planDesc}>{person.dietary_requirements}</Text>
          </InfoCard>
        )}

        {/* Communication */}
        {(person.communication_language || person.communication_method) && (
          <InfoCard title="Communication">
            {person.communication_language && <InfoRow label="Language" value={person.communication_language} />}
            {person.communication_method && <InfoRow label="Method" value={person.communication_method} />}
            {person.communication_interpreter && <InfoRow label="Interpreter" value="Needed" />}
          </InfoCard>
        )}
      </ScrollView>
    </View>
  )
}

const cdStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.surface,
    ...elevation.sm,
  },
  headerTitle: { ...type.bodyBold, color: colors.ink },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  backArrow: { fontFamily: 'System', fontSize: 18, color: colors.primary, fontWeight: '600' },
  backText: { fontFamily: 'System', fontSize: 15, fontWeight: '500', color: colors.primary },
  content: { padding: spacing.base },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { ...type.small },
  errorText: { ...type.body, color: colors.danger },

  /* Name card */
  nameCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.base,
    marginBottom: spacing.base,
    ...elevation.sm,
  },
  clientName: { fontFamily: 'System', fontSize: 22, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  tagRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm, flexWrap: 'wrap' },
  tag: { backgroundColor: colors.successSurface, borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: 3, borderWidth: 1, borderColor: colors.success + '20' },
  tagBlue: { backgroundColor: colors.primarySurface, borderColor: colors.primary + '20' },
  tagText: { fontFamily: 'System', fontSize: 11, fontWeight: '600', color: colors.successDeep, textTransform: 'capitalize' },
  metaRow: { flexDirection: 'row', gap: spacing.base, marginTop: spacing.sm },
  metaText: { ...type.small },

  /* Alert */
  alertCard: {
    backgroundColor: colors.warningSurface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  alertHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  alertIcon: { fontSize: 18 },
  alertTitle: { fontFamily: 'System', fontSize: 15, fontWeight: '700', color: '#92400E' },
  alertItem: { fontFamily: 'System', fontSize: 14, color: '#78350F', lineHeight: 20 },

  /* Card sections */
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.base,
    marginBottom: spacing.base,
    ...elevation.sm,
  },
  cardTitle: { fontFamily: 'System', fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: spacing.md },
  planBlock: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderLight },
  planTitle: { ...type.bodyBold, fontSize: 14 },
  planMeta: { ...type.small, marginTop: 2 },
  planDesc: { ...type.body, fontSize: 14, marginTop: spacing.xs, lineHeight: 20 },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs + 2 },
  infoLabel: { ...type.small, flex: 1 },
  infoValue: { ...type.body, fontSize: 14, flex: 2, textAlign: 'right' },
})
