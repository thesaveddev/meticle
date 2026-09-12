import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { colors, commonStyles, radii, spacing, type } from '../theme'
import type { AuthSession } from '../types'
import { getPersonDetail, getMedicationsForPerson } from '../services/api'

interface Props {
  personId: string
  session: AuthSession
  onBack: () => void
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
        setError(e.message || 'Could not load client details')
      } finally {
        setLoading(false)
      }
    })()
  }, [personId])

  if (loading) {
    return (
      <View style={commonStyles.screen}>
        <View style={styles.header}>
          <Pressable onPress={onBack}><Text style={styles.backBtn}>← Back</Text></Pressable>
          <Text style={styles.headerTitle}>Client details</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.loading}><ActivityIndicator color={colors.navy} /><Text style={styles.loadingText}>Loading...</Text></View>
      </View>
    )
  }

  if (error || !person) {
    return (
      <View style={commonStyles.screen}>
        <View style={styles.header}>
          <Pressable onPress={onBack}><Text style={styles.backBtn}>← Back</Text></Pressable>
          <Text style={styles.headerTitle}>Client details</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.loading}><Text style={styles.errorText}>{error || 'Client not found'}</Text></View>
      </View>
    )
  }

  const allergies = typeof person.allergies === 'string' ? JSON.parse(person.allergies || '[]') : (person.allergies || [])
  const carePlans = person.care_plans || []
  const activePlans = carePlans.filter((cp: any) => cp.status === 'active')
  const contacts = person.family_contacts || []
  const emergencyContacts = contacts.filter((c: any) => c.is_emergency_contact)
  const otherContacts = contacts.filter((c: any) => !c.is_emergency_contact)

  return (
    <View style={commonStyles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack}><Text style={styles.backBtn}>← Back</Text></Pressable>
        <Text style={styles.headerTitle}>Client details</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Client name and basic info */}
        <View style={styles.nameCard}>
          <Text style={styles.clientName}>{person.first_name} {person.last_name}</Text>
          <View style={styles.tagRow}>
            {person.support_level && <View style={styles.tag}><Text style={styles.tagText}>{person.support_level.replace(/_/g, ' ')}</Text></View>}
            {person.room_number && <View style={[styles.tag, styles.tagBlue]}><Text style={[styles.tagText, styles.tagTextBlue]}>Room {person.room_number}</Text></View>}
          </View>
          {person.date_of_birth && <Text style={styles.metaText}>DOB: {new Date(person.date_of_birth).toLocaleDateString('en-GB')}</Text>}
          {person.nhs_number && <Text style={styles.metaText}>NHS: {person.nhs_number}</Text>}
        </View>

        {/* Allergies warning */}
        {allergies.length > 0 && (
          <View style={styles.alertCard}>
            <Text style={styles.alertTitle}>⚠ Allergies</Text>
            {allergies.map((a: string, i: number) => (
              <Text key={i} style={styles.alertItem}>{typeof a === 'string' ? a : String(a)}</Text>
            ))}
          </View>
        )}

        {/* Care plans */}
        {activePlans.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Care plans ({activePlans.length})</Text>
            {activePlans.map((cp: any) => (
              <View key={cp.id} style={styles.card}>
                <Text style={styles.cardTitle}>{cp.title}</Text>
                {cp.category && <Text style={styles.cardMeta}>{cp.category}</Text>}
                {cp.description && <Text style={styles.cardBody} numberOfLines={3}>{cp.description}</Text>}
                {cp.review_date && <Text style={styles.cardMeta}>Review: {new Date(cp.review_date).toLocaleDateString('en-GB')}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* Medications */}
        {medications.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Medications ({medications.length})</Text>
            {medications.map((med: any) => (
              <View key={med.id} style={styles.card}>
                <Text style={styles.cardTitle}>{med.medication_name || med.name}</Text>
                {med.dosage && <Text style={styles.cardMeta}>Dosage: {med.dosage}</Text>}
                {med.frequency && <Text style={styles.cardMeta}>Frequency: {med.frequency}</Text>}
                {med.route && <Text style={styles.cardMeta}>Route: {med.route}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* GP details */}
        {(person.gp_name || person.gp_phone) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>GP details</Text>
            <View style={styles.card}>
              {person.gp_name && <Text style={styles.cardTitle}>{person.gp_name}</Text>}
              {person.gp_surgery && <Text style={styles.cardMeta}>{person.gp_surgery}</Text>}
              {person.gp_phone && <Text style={styles.cardBody}>Phone: {person.gp_phone}</Text>}
              {person.gp_email && <Text style={styles.cardBody}>Email: {person.gp_email}</Text>}
            </View>
          </View>
        )}

        {/* Emergency contacts */}
        {emergencyContacts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Emergency contacts</Text>
            {emergencyContacts.map((c: any) => (
              <View key={c.id} style={styles.card}>
                <Text style={styles.cardTitle}>{c.name}</Text>
                {c.relationship && <Text style={styles.cardMeta}>{c.relationship}</Text>}
                {c.phone && <Text style={styles.cardBody}>Phone: {c.phone}</Text>}
                {c.email && <Text style={styles.cardBody}>Email: {c.email}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* Other contacts */}
        {otherContacts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Family contacts</Text>
            {otherContacts.map((c: any) => (
              <View key={c.id} style={styles.card}>
                <Text style={styles.cardTitle}>{c.name}</Text>
                {c.relationship && <Text style={styles.cardMeta}>{c.relationship}</Text>}
                {c.phone && <Text style={styles.cardBody}>Phone: {c.phone}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* Dietary requirements */}
        {person.dietary_requirements && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dietary requirements</Text>
            <View style={styles.card}>
              <Text style={styles.cardBody}>{person.dietary_requirements}</Text>
            </View>
          </View>
        )}

        {/* Communication preferences */}
        {(person.communication_language || person.communication_method) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Communication</Text>
            <View style={styles.card}>
              {person.communication_language && <Text style={styles.cardBody}>Language: {person.communication_language}</Text>}
              {person.communication_method && <Text style={styles.cardBody}>Method: {person.communication_method}</Text>}
              {person.communication_interpreter && <Text style={styles.cardBody}>Interpreter needed</Text>}
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.hairline, backgroundColor: colors.paper },
  headerTitle: { ...type.bodyStrong, color: colors.ink },
  backBtn: { ...type.label, color: colors.navy },
  content: { padding: spacing.md },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { ...type.caption, color: colors.mist },
  errorText: { ...type.body, color: colors.error },
  nameCard: { backgroundColor: colors.paper, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.hairline },
  clientName: { ...type.title, fontSize: 22, marginBottom: spacing.xs },
  tagRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm, flexWrap: 'wrap' },
  tag: { backgroundColor: colors.successSoft, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  tagBlue: { backgroundColor: '#E0F2FE' },
  tagText: { ...type.label, fontSize: 11, color: colors.emeraldDeep },
  tagTextBlue: { color: '#0F4C81' },
  metaText: { ...type.caption, color: colors.mist, marginTop: 2 },
  alertCard: { backgroundColor: '#FEF3C7', borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: '#FDE68A' },
  alertTitle: { ...type.bodyStrong, color: '#92400E', marginBottom: spacing.xs },
  alertItem: { ...type.body, color: '#78350F', fontSize: 14 },
  section: { marginBottom: spacing.md },
  sectionTitle: { ...type.bodyStrong, color: colors.ink, marginBottom: spacing.sm },
  card: { backgroundColor: colors.paper, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.xs, borderWidth: 1, borderColor: colors.hairline },
  cardTitle: { ...type.bodyStrong, color: colors.ink, marginBottom: 2 },
  cardMeta: { ...type.caption, color: colors.mist, marginTop: 2 },
  cardBody: { ...type.body, color: colors.ink, fontSize: 14, marginTop: 4 },
})
