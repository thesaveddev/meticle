import { useCallback, useEffect, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, elevation, radii, spacing, type, FONT, useAppColors } from '../theme'
import { useDynamicStyles } from '../utils/patchStaticStyles'
import { dyn } from '../utils/dynamicStyles'
import { SkeletonScreen } from '../components/Skeleton'
import { MapPickerModal } from '../components/MapPickerModal'
import type { AuthSession } from '../types'
import { getPersonDetail, getMedicationsForPerson, getBodyMapStats, getDailySummary, getDailyNotes, getPersonAssessments, getPersonDocuments } from '../services/api'

type TabKey = 'overview' | 'care' | 'notes' | 'risks' | 'meds' | 'personal' | 'contacts'

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'document-text-outline' },
  { key: 'care', label: 'Care Plans', icon: 'clipboard-outline' },
  { key: 'notes', label: 'Notes', icon: 'create-outline' },
  { key: 'risks', label: 'Risks', icon: 'shield-outline' },
  { key: 'meds', label: 'Meds', icon: 'medkit-outline' },
  { key: 'personal', label: 'Personal', icon: 'person-outline' },
  { key: 'contacts', label: 'Contacts', icon: 'call-outline' },
]

interface Props {
  personId: string
  session: AuthSession
  onBack: () => void
  onBodyMap?: (personId: string, personName: string) => void
  onNutrition?: (personId: string, personName: string) => void
}

export function ClientDetailScreen({ personId, session, onBack, onBodyMap, onNutrition }: Props) {
  const c = useAppColors()
  const s = useDynamicStyles(styles)
  const [person, setPerson] = useState<any>(null)
  const [medications, setMedications] = useState<any[]>([])
  const [bodyMapStats, setBodyMapStats] = useState<any>(null)
  const [nutritionSummary, setNutritionSummary] = useState<any>(null)
  const [dailyNotes, setDailyNotes] = useState<any[]>([])
  const [assessments, setAssessments] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<TabKey>('overview')
  const [mapPickerOpen, setMapPickerOpen] = useState(false)
  const [navDest, setNavDest] = useState<{ destination?: string; latitude?: number; longitude?: number; label?: string }>({})
  const [refreshing, setRefreshing] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [personData, medData, bmStats, nutSummary, notesData, assessData, docsData] = await Promise.all([
        getPersonDetail(session.accessToken, personId),
        getMedicationsForPerson(session.accessToken, personId).catch(() => []),
        getBodyMapStats(session.accessToken, personId).catch(() => null),
        getDailySummary(session.accessToken, personId).catch(() => null),
        getDailyNotes(session.accessToken, personId).catch(() => []),
        getPersonAssessments(session.accessToken, personId).catch(() => []),
        getPersonDocuments(session.accessToken, personId).catch(() => []),
      ])
      setPerson(personData)
      setMedications(medData)
      setBodyMapStats(bmStats)
      setNutritionSummary(nutSummary)
      setDailyNotes(notesData)
      setAssessments(assessData)
      setDocuments(docsData)
    } catch (e: any) {
      setError(e.message || 'Could not load details')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [session.accessToken, personId])
  useEffect(() => { loadData() }, [loadData])

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        <Header onBack={onBack} title="Client" c={c} />
        <SkeletonScreen c={c} />
      </View>
    )
  }

  if (error || !person) {
    return (
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        <Header onBack={onBack} title="Client" c={c} />
        <View style={styles.loading}><Text style={[styles.errorText, { color: c.danger }]}>{error || 'Client not found'}</Text></View>
      </View>
    )
  }

  const personName = `${person.first_name} ${person.last_name}`
  const allergies = typeof person.allergies === 'string' ? JSON.parse(person.allergies || '[]') : (person.allergies || [])
  const carePlans = (person.care_plans || []).filter((cp: any) => cp.status === 'active')
  const allCarePlans = person.care_plans || []
  const contacts = person.family_contacts || []
  const emergencyContacts = contacts.filter((ct: any) => ct.is_emergency_contact)
  const otherContacts = contacts.filter((ct: any) => !ct.is_emergency_contact)
  const riskAssessments = person.risk_assessments || []
  const highRisks = riskAssessments.filter((r: any) => r.risk_level === 'high' || r.risk_level === 'critical')

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <Header onBack={onBack} title="Client" c={c} />

      {/* Client hero card */}
      <View style={[styles.heroCard, { backgroundColor: c.surface }]}>
        <View style={styles.heroRow}>
          <View style={[styles.heroAvatar, { backgroundColor: c.primarySurface }]}>
            <Text style={[styles.heroAvatarText, { color: c.primary }]}>{personName.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroName, { color: c.ink }]}>{personName}</Text>
            {person.preferred_name && <Text style={[styles.heroPreferred, { color: c.muted }]}>Preferred: {person.preferred_name}</Text>}
            <View style={styles.tagRow}>
              {person.status && (
                <View style={[styles.tag, { backgroundColor: person.status === 'active' ? c.successSurface : c.surfaceAlt, borderColor: (person.status === 'active' ? c.success : c.muted) + '30' }]}>
                  <Text style={[styles.tagText, { color: person.status === 'active' ? c.successDeep : c.muted }]}>{person.status}</Text>
                </View>
              )}
              {person.support_level && (
                <View style={[styles.tag, { backgroundColor: c.primarySurface, borderColor: c.primary + '30' }]}>
                  <Text style={[styles.tagText, { color: c.primary }]}>{person.support_level.replace(/_/g, ' ')}</Text>
                </View>
              )}
              {person.requires_two_staff && (
                <View style={[styles.tag, { backgroundColor: '#FFF7ED', borderColor: '#FDBA74' }]}>
                  <Text style={[styles.tagText, { color: '#C2410C' }]}>2-person</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Quick stats */}
        <View style={styles.quickStats}>
          {person.date_of_birth && (
            <View style={styles.quickStat}>
              <Ionicons name="calendar-outline" size={14} color={c.muted} />
              <Text style={[styles.quickStatText, { color: c.muted }]}>{new Date(person.date_of_birth).toLocaleDateString('en-GB')}</Text>
            </View>
          )}
          {person.nhs_number && (
            <View style={styles.quickStat}>
              <Ionicons name="card-outline" size={14} color={c.muted} />
              <Text style={[styles.quickStatText, { color: c.muted }]}>{person.nhs_number}</Text>
            </View>
          )}
          {person.gender && (
            <View style={styles.quickStat}>
              <Ionicons name="person-outline" size={14} color={c.muted} />
              <Text style={[styles.quickStatText, { color: c.muted }]}>{person.gender}</Text>
            </View>
          )}
          {person.room_number && (
            <View style={styles.quickStat}>
              <Ionicons name="bed-outline" size={14} color={c.muted} />
              <Text style={[styles.quickStatText, { color: c.muted }]}>Room {person.room_number}</Text>
            </View>
          )}
        </View>

        {/* Navigate */}
        {person.address && (
          <Pressable
            onPress={() => { setNavDest({ destination: person.address, label: personName }); setMapPickerOpen(true) }}
            style={({ pressed }) => [styles.navBtn, { backgroundColor: c.primarySurface }, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="navigate-outline" size={18} color={c.primary} />
            <Text style={[styles.navBtnText, { color: c.primary }]}>Navigate to client</Text>
            <Ionicons name="chevron-forward" size={16} color={c.primary} />
          </Pressable>
        )}

        {/* Allergies alert */}
        {allergies.length > 0 && (
          <View style={[styles.alertCard, { backgroundColor: c.dangerSurface }]}>
            <Ionicons name="warning" size={16} color={c.danger} />
            <Text style={[styles.alertText, { color: c.danger }]}>Allergies: {allergies.join(', ')}</Text>
          </View>
        )}

        {/* High risks alert */}
        {highRisks.length > 0 && (
          <View style={[styles.alertCard, { backgroundColor: '#FFF7ED' }]}>
            <Ionicons name="shield-checkmark" size={16} color="#C2410C" />
            <Text style={[styles.alertText, { color: '#C2410C' }]}>{highRisks.length} high/critical risk{highRisks.length > 1 ? 's' : ''}</Text>
          </View>
        )}

        {/* DNACPR badge */}
        {person.dnacpr_status && (
          <View style={[styles.alertCard, { backgroundColor: person.dnacpr_status === 'active' ? c.dangerSurface : c.successSurface }]}>
            <Ionicons name="heart-dislike-outline" size={16} color={person.dnacpr_status === 'active' ? c.danger : c.success} />
            <Text style={[styles.alertText, { color: person.dnacpr_status === 'active' ? c.danger : c.success }]}>
              DNACPR: {person.dnacpr_status}{person.dnacpr_date ? ` (${new Date(person.dnacpr_date).toLocaleDateString('en-GB')})` : ''}
            </Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tabBar, { backgroundColor: c.surface }]}>
        {TABS.map(t => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, tab === t.key && { backgroundColor: c.primarySurface }, { backgroundColor: c.surfaceAlt }]}>
            <Ionicons name={t.icon as any} size={16} color={tab === t.key ? c.primary : c.muted} />
            <Text style={[styles.tabLabel, { color: tab === t.key ? c.primary : c.muted }]}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Tab content */}
      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData() }} tintColor="transparent" />}>
        {tab === 'overview' && <OverviewTab person={person} bodyMapStats={bodyMapStats} nutritionSummary={nutritionSummary} dailyNotes={dailyNotes} onBodyMap={() => onBodyMap?.(personId, personName)} onNutrition={() => onNutrition?.(personId, personName)} c={c} />}
        {tab === 'care' && <CareTab carePlans={carePlans} allCarePlans={allCarePlans} c={c} />}
        {tab === 'notes' && <NotesTab notes={dailyNotes} c={c} />}
        {tab === 'risks' && <RisksTab risks={riskAssessments} c={c} />}
        {tab === 'meds' && <MedsTab medications={medications} c={c} />}
        {tab === 'personal' && <PersonalTab person={person} c={c} />}
        {tab === 'contacts' && <ContactsTab emergencyContacts={emergencyContacts} otherContacts={otherContacts} person={person} c={c} />}
      </ScrollView>

      <MapPickerModal
        visible={mapPickerOpen}
        onClose={() => setMapPickerOpen(false)}
        destination={navDest.destination}
        latitude={navDest.latitude}
        longitude={navDest.longitude}
        label={navDest.label}
      />
    </View>
  )
}

/* ─── Header ─────────────────────────────────────────────── */

function Header({ onBack, title, c }: { onBack: () => void; title: string; c: any }) {
  return (
    <View style={[styles.header, { backgroundColor: c.surface }]}>
      <Pressable onPress={onBack} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={22} color={c.primary} />
      </Pressable>
      <Text style={[styles.headerTitle, { color: c.ink }]}>{title}</Text>
      <View style={{ width: 44 }} />
    </View>
  )
}

/* ─── Tab: Overview ──────────────────────────────────────── */

function OverviewTab({ person, bodyMapStats, nutritionSummary, dailyNotes, onBodyMap, onNutrition, c }: any) {
  return (
    <View>
      {/* Address */}
      {person.address && (
        <Card title="Address" c={c}>
          <InfoRow icon="location-outline" label="Address" value={person.address} c={c} />
          {person.address_line_2 && <InfoRow icon="location-outline" label="" value={person.address_line_2} c={c} />}
          {person.city && <InfoRow icon="location-outline" label="" value={person.city} c={c} />}
          {person.postcode && <InfoRow icon="location-outline" label="Postcode" value={person.postcode} c={c} />}
        </Card>
      )}

      {/* GP Details */}
      {person.gp_name && (
        <Card title="GP Details" c={c}>
          <InfoRow icon="person-outline" label="Name" value={person.gp_name} c={c} />
          {person.gp_surgery && <InfoRow icon="medical-outline" label="Surgery" value={person.gp_surgery} c={c} />}
          {person.gp_phone && <InfoRow icon="call-outline" label="Phone" value={person.gp_phone} c={c} />}
          {person.gp_email && <InfoRow icon="mail-outline" label="Email" value={person.gp_email} c={c} />}
        </Card>
      )}

      {/* Pharmacy */}
      {person.pharmacy_name && (
        <Card title="Pharmacy" c={c}>
          <InfoRow icon="medical-outline" label="Name" value={person.pharmacy_name} c={c} />
          {person.pharmacy_phone && <InfoRow icon="call-outline" label="Phone" value={person.pharmacy_phone} c={c} />}
          {person.pharmacy_address && <InfoRow icon="location-outline" label="Address" value={person.pharmacy_address} c={c} />}
        </Card>
      )}

      {/* Social Worker */}
      {person.social_worker_name && (
        <Card title="Social Worker" c={c}>
          <InfoRow icon="person-outline" label="Name" value={person.social_worker_name} c={c} />
          {person.social_worker_phone && <InfoRow icon="call-outline" label="Phone" value={person.social_worker_phone} c={c} />}
          {person.social_worker_email && <InfoRow icon="mail-outline" label="Email" value={person.social_worker_email} c={c} />}
        </Card>
      )}

      {/* Dietary */}
      {person.dietary_requirements && (
        <Card title="Dietary Requirements" c={c}>
          <Text style={[styles.cardBody, { color: c.ink }]}>{person.dietary_requirements}</Text>
        </Card>
      )}

      {/* Communication */}
      {(person.communication_language || person.communication_method) && (
        <Card title="Communication" c={c}>
          {person.communication_language && <InfoRow icon="language-outline" label="Language" value={person.communication_language} c={c} />}
          {person.communication_method && <InfoRow icon="chatbubble-outline" label="Method" value={person.communication_method} c={c} />}
          {person.communication_interpreter && <InfoRow icon="people-outline" label="Interpreter" value="Needed" c={c} />}
        </Card>
      )}

      {/* Quick access cards */}
      <View style={styles.actionRow}>
        <Pressable style={[styles.actionCard, { backgroundColor: c.surface }]} onPress={onBodyMap}>
          <View style={[styles.actionIconWrap, { backgroundColor: c.dangerSurface }]}>
            <Ionicons name="body-outline" size={22} color={c.danger} />
          </View>
          <View style={styles.actionInfo}>
            <Text style={[styles.actionTitle, { color: c.ink }]}>Body Map</Text>
            {bodyMapStats ? <Text style={[styles.actionDesc, { color: c.muted }]}>{bodyMapStats.active_count} active</Text> : null}
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.muted} />
        </Pressable>

        <Pressable style={[styles.actionCard, { backgroundColor: c.surface }]} onPress={onNutrition}>
          <View style={[styles.actionIconWrap, { backgroundColor: c.successSurface }]}>
            <Ionicons name="restaurant-outline" size={22} color={c.success} />
          </View>
          <View style={styles.actionInfo}>
            <Text style={[styles.actionTitle, { color: c.ink }]}>Nutrition</Text>
            {nutritionSummary ? <Text style={[styles.actionDesc, { color: c.muted }]}>{nutritionSummary.total_meals} meals logged</Text> : null}
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.muted} />
        </Pressable>
      </View>

      {/* Recent notes preview */}
      {dailyNotes.length > 0 && (
        <Card title={`Recent Notes (${dailyNotes.length})`} c={c}>
          {dailyNotes.slice(0, 3).map((note: any) => (
            <View key={note.id} style={styles.notePreview}>
              <Text style={[styles.noteDate, { color: c.muted }]}>{new Date(note.note_date || note.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Text>
              <Text style={[styles.noteText, { color: c.ink }]} numberOfLines={2}>{note.content || note.summary || 'No content'}</Text>
              {note.author_name && <Text style={[styles.noteAuthor, { color: c.muted }]}>by {note.author_name}</Text>}
            </View>
          ))}
        </Card>
      )}
    </View>
  )
}

/* ─── Tab: Care Plans ────────────────────────────────────── */

function CareTab({ carePlans, allCarePlans, c }: any) {
  if (allCarePlans.length === 0) {
    return <EmptyState icon="clipboard-outline" title="No care plans" subtitle="No care plans have been created yet" c={c} />
  }
  return (
    <View>
      {carePlans.length > 0 && (
        <View style={[styles.sectionHeader, { backgroundColor: c.successSurface }]}>
          <Ionicons name="checkmark-circle" size={16} color={c.success} />
          <Text style={[styles.sectionHeaderText, { color: c.successDeep }]}>{carePlans.length} active care plan{carePlans.length > 1 ? 's' : ''}</Text>
        </View>
      )}
      {carePlans.map((cp: any) => (
        <Card key={cp.id} title={cp.title} c={c}>
          {cp.category && <View style={[styles.planCategory, { backgroundColor: c.primarySurface }]}><Text style={[styles.planCategoryText, { color: c.primary }]}>{cp.category}</Text></View>}
          {cp.description && <Text style={[styles.cardBody, { color: c.ink, marginTop: spacing.xs }]}>{cp.description}</Text>}
          {cp.mobility_level && <InfoRow icon="walk-outline" label="Mobility" value={cp.mobility_level} c={c} />}
          {cp.communication_needs && <InfoRow icon="chatbubble-outline" label="Communication" value={cp.communication_needs} c={c} />}
          {cp.sleep_pattern && <InfoRow icon="moon-outline" label="Sleep" value={cp.sleep_pattern} c={c} />}
          {cp.emergency_info && <InfoRow icon="alert-circle-outline" label="Emergency" value={cp.emergency_info} c={c} />}
          {cp.personal_goals && <InfoRow icon="flag-outline" label="Goals" value={cp.personal_goals} c={c} />}
          {cp.likes_dislikes && <InfoRow icon="heart-outline" label="Likes/Dislikes" value={cp.likes_dislikes} c={c} />}
          {cp.cultural_needs && <InfoRow icon="globe-outline" label="Cultural" value={cp.cultural_needs} c={c} />}
          {cp.review_date && <InfoRow icon="calendar-outline" label="Review" value={new Date(cp.review_date).toLocaleDateString('en-GB')} c={c} />}
        </Card>
      ))}
      {allCarePlans.filter((cp: any) => cp.status !== 'active').length > 0 && (
        <View style={[styles.sectionHeader, { backgroundColor: c.surfaceAlt }]}>
          <Ionicons name="archive-outline" size={16} color={c.muted} />
          <Text style={[styles.sectionHeaderText, { color: c.muted }]}>{allCarePlans.filter((cp: any) => cp.status !== 'active').length} archived</Text>
        </View>
      )}
    </View>
  )
}

/* ─── Tab: Notes ─────────────────────────────────────────── */

function NotesTab({ notes, c }: any) {
  if (notes.length === 0) {
    return <EmptyState icon="create-outline" title="No care notes" subtitle="No daily notes have been recorded yet" c={c} />
  }
  return (
    <View>
      {notes.map((note: any) => (
        <View key={note.id} style={[styles.noteCard, { backgroundColor: c.surface }]}>
          <View style={styles.noteHeader}>
            <View style={[styles.noteDot, { backgroundColor: c.primary }]} />
            <Text style={[styles.noteDate, { color: c.muted }]}>{new Date(note.note_date || note.created_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</Text>
          </View>
          <Text style={[styles.noteContent, { color: c.ink }]}>{note.content || note.summary || 'No content'}</Text>
          {note.note_type && <View style={[styles.planCategory, { backgroundColor: c.primarySurface, alignSelf: 'flex-start', marginTop: spacing.xs }]}><Text style={[styles.planCategoryText, { color: c.primary }]}>{note.note_type}</Text></View>}
          {note.author_name && <Text style={[styles.noteAuthor, { color: c.muted, marginTop: spacing.xs }]}>Recorded by {note.author_name}</Text>}
        </View>
      ))}
    </View>
  )
}

/* ─── Tab: Risks ─────────────────────────────────────────── */

function RisksTab({ risks, c }: any) {
  if (risks.length === 0) {
    return <EmptyState icon="shield-checkmark-outline" title="No risk assessments" subtitle="No risk assessments have been recorded" c={c} />
  }
  const riskColors: Record<string, { bg: string; text: string; icon: string }> = {
    low: { bg: c.successSurface, text: c.successDeep, icon: 'checkmark-circle-outline' },
    medium: { bg: c.warningSurface, text: c.warning, icon: 'alert-circle-outline' },
    high: { bg: '#FEF2F2', text: '#DC2626', icon: 'warning-outline' },
    critical: { bg: '#FEE2E2', text: '#B91C1C', icon: 'skull-outline' },
  }
  return (
    <View>
      {risks.map((risk: any) => {
        const rc = riskColors[risk.risk_level] || riskColors.low
        return (
          <View key={risk.id} style={[styles.riskCard, { backgroundColor: c.surface, borderLeftColor: rc.text, borderLeftWidth: 3 }]}>
            <View style={styles.riskHeader}>
              <View style={[styles.riskBadge, { backgroundColor: rc.bg }]}>
                <Ionicons name={rc.icon as any} size={14} color={rc.text} />
                <Text style={[styles.riskBadgeText, { color: rc.text }]}>{risk.risk_level}</Text>
              </View>
              {risk.type && <Text style={[styles.riskType, { color: c.muted }]}>{risk.type}</Text>}
            </View>
            {risk.details && <Text style={[styles.riskDetails, { color: c.ink }]}>{risk.details}</Text>}
            {risk.mitigation_actions && (
              <View style={styles.riskMitigation}>
                <Text style={[styles.riskMitigationLabel, { color: c.muted }]}>Mitigation:</Text>
                <Text style={[styles.riskMitigationText, { color: c.ink }]}>{risk.mitigation_actions}</Text>
              </View>
            )}
            {risk.review_date && <Text style={[styles.riskReview, { color: c.muted }]}>Review: {new Date(risk.review_date).toLocaleDateString('en-GB')}</Text>}
          </View>
        )
      })}
    </View>
  )
}

/* ─── Tab: Meds ──────────────────────────────────────────── */

function MedsTab({ medications, c }: any) {
  if (medications.length === 0) {
    return <EmptyState icon="medkit-outline" title="No medications" subtitle="No medications have been recorded" c={c} />
  }
  return (
    <View>
      {medications.map((med: any) => (
        <View key={med.id} style={[styles.medCard, { backgroundColor: c.surface }]}>
          <View style={[styles.medIcon, { backgroundColor: c.primarySurface }]}>
            <Ionicons name="medkit" size={18} color={c.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.medName, { color: c.ink }]}>{med.medication_name || med.name}</Text>
            {med.dosage && <Text style={[styles.medDetail, { color: c.muted }]}>{med.dosage}{med.frequency ? ` · ${med.frequency}` : ''}</Text>}
            {med.route && <Text style={[styles.medDetail, { color: c.muted }]}>Route: {med.route}</Text>}
            {med.time_of_day && <Text style={[styles.medDetail, { color: c.muted }]}>Time: {med.time_of_day}</Text>}
            {med.prsn_administering && <Text style={[styles.medDetail, { color: c.muted }]}>Admin: {med.prsn_administering}</Text>}
          </View>
        </View>
      ))}
    </View>
  )
}

/* ─── Tab: Personal ──────────────────────────────────────── */

function PersonalTab({ person, c }: any) {
  return (
    <View>
      <Card title="Personal Details" c={c}>
        {person.preferred_name && <InfoRow icon="heart-outline" label="Preferred name" value={person.preferred_name} c={c} />}
        {person.pronouns && <InfoRow icon="person-outline" label="Pronouns" value={person.pronouns} c={c} />}
        {person.gender && <InfoRow icon="person-outline" label="Gender" value={person.gender} c={c} />}
        {person.ethnicity && <InfoRow icon="globe-outline" label="Ethnicity" value={person.ethnicity} c={c} />}
        {person.marital_status && <InfoRow icon="people-outline" label="Marital status" value={person.marital_status} c={c} />}
        {person.religion && <InfoRow icon="earth-outline" label="Religion" value={person.religion} c={c} />}
        {person.nationality && <InfoRow icon="flag-outline" label="Nationality" value={person.nationality} c={c} />}
      </Card>

      <Card title="Admission" c={c}>
        {person.admission_date && <InfoRow icon="calendar-outline" label="Admitted" value={new Date(person.admission_date).toLocaleDateString('en-GB')} c={c} />}
        {person.admission_source && <InfoRow icon="arrow-down-outline" label="Source" value={person.admission_source} c={c} />}
        {person.funding_type && <InfoRow icon="cash-outline" label="Funding" value={person.funding_type} c={c} />}
        {person.funding_details && <InfoRow icon="document-text-outline" label="Details" value={person.funding_details} c={c} />}
      </Card>

      <Card title="Flags & Tags" c={c}>
        {(() => {
          const flags = typeof person.flags === 'string' ? JSON.parse(person.flags || '[]') : (person.flags || [])
          const tags = typeof person.tags === 'string' ? JSON.parse(person.tags || '[]') : (person.tags || [])
          if (flags.length === 0 && tags.length === 0) return <Text style={[styles.emptyText, { color: c.muted }]}>No flags or tags</Text>
          return (
            <View style={styles.tagRow}>
              {flags.map((f: string, i: string) => (
                <View key={`f${i}`} style={[styles.tag, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                  <Text style={[styles.tagText, { color: '#DC2626' }]}>{f}</Text>
                </View>
              ))}
              {tags.map((t: string, i: string) => (
                <View key={`t${i}`} style={[styles.tag, { backgroundColor: c.primarySurface, borderColor: c.primary + '30' }]}>
                  <Text style={[styles.tagText, { color: c.primary }]}>{t}</Text>
                </View>
              ))}
            </View>
          )
        })()}
      </Card>

      <Card title="Discharge" c={c}>
        {person.discharge_date && <InfoRow icon="calendar-outline" label="Date" value={new Date(person.discharge_date).toLocaleDateString('en-GB')} c={c} />}
        {person.discharge_reason && <InfoRow icon="alert-circle-outline" label="Reason" value={person.discharge_reason} c={c} />}
        {person.discharge_destination && <InfoRow icon="location-outline" label="Destination" value={person.discharge_destination} c={c} />}
        {person.discharge_summary && <Text style={[styles.cardBody, { color: c.ink, marginTop: spacing.xs }]}>{person.discharge_summary}</Text>}
        {!person.discharge_date && <Text style={[styles.emptyText, { color: c.muted }]}>No discharge information</Text>}
      </Card>

      <Card title="Advance Decisions" c={c}>
        {person.advance_decision && <InfoRow icon="document-text-outline" label="Decision" value={person.advance_decision} c={c} />}
        {person.advance_decision_date && <InfoRow icon="calendar-outline" label="Date" value={new Date(person.advance_decision_date).toLocaleDateString('en-GB')} c={c} />}
        {person.dnacpr_status && <InfoRow icon="heart-dislike-outline" label="DNACPR" value={`${person.dnacpr_status}${person.dnacpr_date ? ` (${new Date(person.dnacpr_date).toLocaleDateString('en-GB')})` : ''}`} c={c} />}
        {person.dnacpr_review_date && <InfoRow icon="calendar-outline" label="DNACPR review" value={new Date(person.dnacpr_review_date).toLocaleDateString('en-GB')} c={c} />}
        {person.dnacpr_details && <Text style={[styles.cardBody, { color: c.ink, marginTop: spacing.xs }]}>{person.dnacpr_details}</Text>}
        {!person.advance_decision && !person.dnacpr_status && <Text style={[styles.emptyText, { color: c.muted }]}>No advance decisions recorded</Text>}
      </Card>
    </View>
  )
}

/* ─── Tab: Contacts ──────────────────────────────────────── */

function ContactsTab({ emergencyContacts, otherContacts, person, c }: any) {
  return (
    <View>
      {emergencyContacts.length > 0 && (
        <Card title="Emergency Contacts" c={c}>
          {emergencyContacts.map((ct: any) => (
            <View key={ct.id} style={styles.contactBlock}>
              <View style={styles.contactRow}>
                <View style={[styles.contactAvatar, { backgroundColor: c.dangerSurface }]}>
                  <Ionicons name="alert-circle" size={16} color={c.danger} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.contactName, { color: c.ink }]}>{ct.name}</Text>
                  {ct.relationship && <Text style={[styles.contactMeta, { color: c.muted }]}>{ct.relationship}</Text>}
                </View>
              </View>
              {ct.phone && (
                <Pressable style={[styles.contactPhone, { backgroundColor: c.surfaceAlt }]}>
                  <Ionicons name="call-outline" size={14} color={c.primary} />
                  <Text style={[styles.contactPhoneText, { color: c.primary }]}>{ct.phone}</Text>
                </Pressable>
              )}
              {ct.email && (
                <View style={styles.contactPhone}>
                  <Ionicons name="mail-outline" size={14} color={c.muted} />
                  <Text style={[styles.contactPhoneText, { color: c.muted }]}>{ct.email}</Text>
                </View>
              )}
            </View>
          ))}
        </Card>
      )}

      {otherContacts.length > 0 && (
        <Card title="Family Contacts" c={c}>
          {otherContacts.map((ct: any) => (
            <View key={ct.id} style={styles.contactBlock}>
              <View style={styles.contactRow}>
                <View style={[styles.contactAvatar, { backgroundColor: c.primarySurface }]}>
                  <Ionicons name="person" size={16} color={c.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.contactName, { color: c.ink }]}>{ct.name}</Text>
                  {ct.relationship && <Text style={[styles.contactMeta, { color: c.muted }]}>{ct.relationship}</Text>}
                </View>
              </View>
              {ct.phone && (
                <View style={styles.contactPhone}>
                  <Ionicons name="call-outline" size={14} color={c.muted} />
                  <Text style={[styles.contactPhoneText, { color: c.muted }]}>{ct.phone}</Text>
                </View>
              )}
            </View>
          ))}
        </Card>
      )}

      {emergencyContacts.length === 0 && otherContacts.length === 0 && (
        <EmptyState icon="call-outline" title="No contacts" subtitle="No contacts have been added yet" c={c} />
      )}
    </View>
  )
}

/* ─── Shared Components ──────────────────────────────────── */

function Card({ title, children, c }: { title: string; children: React.ReactNode; c: any }) {
  return (
    <View style={[styles.card, { backgroundColor: c.surface }]}>
      <Text style={[styles.cardTitle, { color: c.ink }]}>{title}</Text>
      {children}
    </View>
  )
}

function InfoRow({ icon, label, value, c }: { icon: string; label: string; value: string; c: any }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLabelWrap}>
        <Ionicons name={icon as any} size={14} color={c.muted} />
        <Text style={[styles.infoLabel, { color: c.muted }]}>{label}</Text>
      </View>
      <Text style={[styles.infoValue, { color: c.ink }]}>{value}</Text>
    </View>
  )
}

function EmptyState({ icon, title, subtitle, c }: { icon: string; title: string; subtitle: string; c: any }) {
  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIconWrap, { backgroundColor: c.surfaceAlt }]}>
        <Ionicons name={icon as any} size={28} color={c.muted} />
      </View>
      <Text style={[styles.emptyTitle, { color: c.ink }]}>{title}</Text>
      <Text style={[styles.emptySub, { color: c.muted }]}>{subtitle}</Text>
    </View>
  )
}

/* ─── Styles ─────────────────────────────────────────────── */

const styles = StyleSheet.create({
  screen: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', fontFamily: FONT, letterSpacing: -0.3 },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  errorText: { fontSize: 15, fontFamily: FONT },

  /* Hero card */
  heroCard: { padding: spacing.base, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight },
  heroRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  heroAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  heroAvatarText: { fontSize: 20, fontWeight: '700', fontFamily: FONT },
  heroName: { fontSize: 20, fontWeight: '700', fontFamily: FONT, letterSpacing: -0.3 },
  heroPreferred: { fontSize: 13, fontFamily: FONT, marginTop: 2 },

  tagRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm, flexWrap: 'wrap' },
  tag: { borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 3, borderWidth: 1 },
  tagText: { fontSize: 11, fontWeight: '600', fontFamily: FONT, textTransform: 'capitalize' },

  quickStats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  quickStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  quickStatText: { fontSize: 13, fontFamily: FONT },

  navBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderRadius: radii.md },
  navBtnText: { flex: 1, fontSize: 14, fontWeight: '600', fontFamily: FONT },

  alertCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md },
  alertText: { fontSize: 13, fontWeight: '600', fontFamily: FONT, flex: 1 },

  /* Tabs */
  tabBar: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, gap: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight },
  tab: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radii.md },
  tabLabel: { fontSize: 12, fontWeight: '600', fontFamily: FONT },

  /* Tab content */
  tabContent: { padding: spacing.base, paddingBottom: spacing.xxxl },

  /* Cards */
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.base, marginBottom: spacing.md, ...elevation.sm },
  cardTitle: { fontSize: 15, fontWeight: '700', fontFamily: FONT, marginBottom: spacing.sm },
  cardBody: { fontSize: 14, fontFamily: FONT, lineHeight: 20 },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: spacing.xs + 2, gap: spacing.sm },
  infoLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minWidth: 100 },
  infoLabel: { fontSize: 13, fontFamily: FONT },
  infoValue: { fontSize: 14, fontFamily: FONT, flex: 1, textAlign: 'right' },

  /* Action cards */
  actionRow: { gap: spacing.sm, marginBottom: spacing.md },
  actionCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.base, paddingVertical: spacing.md, borderRadius: radii.lg, ...elevation.sm },
  actionIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  actionInfo: { flex: 1 },
  actionTitle: { fontSize: 14, fontWeight: '600', fontFamily: FONT },
  actionDesc: { fontSize: 12, fontFamily: FONT, marginTop: 2 },

  /* Notes */
  noteCard: { borderRadius: radii.lg, padding: spacing.base, marginBottom: spacing.md, ...elevation.sm },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  noteDot: { width: 8, height: 8, borderRadius: 4 },
  noteDate: { fontSize: 12, fontFamily: FONT, fontWeight: '600' },
  noteContent: { fontSize: 14, fontFamily: FONT, lineHeight: 20 },
  noteAuthor: { fontSize: 12, fontFamily: FONT },
  notePreview: { paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight },
  noteText: { fontSize: 14, fontFamily: FONT, lineHeight: 20, marginTop: 2 },

  /* Risks */
  riskCard: { borderRadius: radii.lg, padding: spacing.base, marginBottom: spacing.md, ...elevation.sm },
  riskHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  riskBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.sm },
  riskBadgeText: { fontSize: 11, fontWeight: '700', fontFamily: FONT, textTransform: 'uppercase' },
  riskType: { fontSize: 12, fontFamily: FONT },
  riskDetails: { fontSize: 14, fontFamily: FONT, lineHeight: 20 },
  riskMitigation: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight },
  riskMitigationLabel: { fontSize: 12, fontWeight: '600', fontFamily: FONT, marginBottom: 2 },
  riskMitigationText: { fontSize: 14, fontFamily: FONT, lineHeight: 20 },
  riskReview: { fontSize: 12, fontFamily: FONT, marginTop: spacing.xs },

  /* Meds */
  medCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, borderRadius: radii.lg, padding: spacing.base, marginBottom: spacing.md, ...elevation.sm },
  medIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  medName: { fontSize: 15, fontWeight: '600', fontFamily: FONT },
  medDetail: { fontSize: 13, fontFamily: FONT, marginTop: 2 },

  /* Contacts */
  contactBlock: { paddingVertical: spacing.md },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  contactAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  contactName: { fontSize: 15, fontWeight: '600', fontFamily: FONT },
  contactMeta: { fontSize: 12, fontFamily: FONT, marginTop: 2 },
  contactPhone: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs, marginLeft: 52 },
  contactPhoneText: { fontSize: 14, fontFamily: FONT },

  /* Care plan category */
  planCategory: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.sm },
  planCategoryText: { fontSize: 11, fontWeight: '600', fontFamily: FONT, textTransform: 'uppercase' },

  /* Section header */
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md, marginBottom: spacing.md },
  sectionHeaderText: { fontSize: 13, fontWeight: '600', fontFamily: FONT },

  /* Empty state */
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xxl },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  emptyTitle: { fontSize: 16, fontWeight: '600', fontFamily: FONT, marginBottom: spacing.xs },
  emptySub: { fontSize: 14, fontFamily: FONT, textAlign: 'center' },
  emptyText: { fontSize: 14, fontFamily: FONT },
})
